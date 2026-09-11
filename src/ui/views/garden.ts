import { html, type TemplateResult } from 'lit-html';
import type { GameState, Mods } from '../../core/types';
import { PLANT_MAP } from '../../data/plants';
import { item } from '../../data/items';
import { growRate, plantCost, profBonusOf, profLevelOf, unlockedPlants } from '../../core/engine';
import { clearPlot, harvest, harvestAll, plant, plantAll } from '../../core/actions';
import { fmt, fmtTime } from '../../core/format';
import { act, bar, gold, sectionTitle, ui } from '../common';

export function gardenView(s: GameState, m: Mods): TemplateResult {
  const plants = unlockedPlants(s);
  if (!plants.some((p) => p.id === ui.plantChoice)) ui.plantChoice = plants[0].id;
  const readyCount = s.plots.filter((p) => p.ready).length;
  const chosen = PLANT_MAP[ui.plantChoice];

  return html`<div class="view">
    ${sectionTitle('🌱 Garden', html`${s.plots.length} plots · ${m.autoHarvest > 0 ? html`<span class="good">Gnomes auto-harvesting</span>` : 'Tap ripe plants to harvest'}`)}

    <div class="card">
      <div class="dim">Choose what to plant — each herb has its own 🎖️ proficiency</div>
      <div class="pill-tabs">
        ${plants.map((p) => html`<button class="btn small ${ui.plantChoice === p.id ? 'active' : ''}" @click=${act(() => (ui.plantChoice = p.id))}>
          ${item(p.herb).icon} ${p.name} · 🪙${fmt(plantCost(s, m, p))} · Lv ${profLevelOf(s, p.id)}
        </button>`)}
      </div>
      <div class="row between">
        <span class="muted small">${item(chosen.herb).icon} ${chosen.name}: ${fmtTime(chosen.time / growRate(s, m, chosen.id))} to grow ·
          ~${fmt(chosen.yield * m.harvestYield + profBonusOf(s, chosen.id).yield)} per harvest · 🎖️ proficiency ${profLevelOf(s, chosen.id)}/100 · replants automatically</span>
        <div class="row">
          <button class="btn small primary" @click=${act((st) => plantAll(st, ui.plantChoice))}>Plant all empty</button>
          <button class="btn small" ?disabled=${readyCount === 0} @click=${act(harvestAll)}>Harvest all (${readyCount})</button>
        </div>
      </div>
    </div>

    <div class="plots">
      ${s.plots.map((plot, i) => {
        if (!plot.plantId) {
          return html`<div class="plot empty" @click=${act((st) => plant(st, i, ui.plantChoice))}>
            <div class="sprout">🟫</div>
            <div class="small">Plant ${chosen.name}</div>
            ${gold(plantCost(s, m, chosen))}
          </div>`;
        }
        const p = PLANT_MAP[plot.plantId];
        const frac = plot.progress / p.time;
        const icon = plot.ready ? item(p.herb).icon : frac < 0.5 ? '🌱' : '🌿';
        return html`<div class="plot ${plot.ready ? 'ready' : ''}" @click=${act((st) => harvest(st, i))}>
          <div class="sprout" style="transform:scale(${plot.ready ? 1.15 : 0.6 + frac * 0.5})">${icon}</div>
          <div class="small">${p.name} <span class="dim">Lv ${profLevelOf(s, p.id)}</span></div>
          ${plot.ready
            ? html`<button class="btn small primary">Harvest</button>`
            : html`${bar(frac, '#5fd068')}<span class="dim">${fmtTime((p.time - plot.progress) / growRate(s, m, p.id))}</span>`}
          <button class="plot-clear" title="Clear plot (no refund)" @click=${act((st) => clearPlot(st, i))}>✕</button>
        </div>`;
      })}
    </div>
    ${s.plots.length < 4 ? html`<div class="dim">Buy more plots in the 🔨 Workshop, or unlock them in the Herbalism skill tree.</div>` : ''}
  </div>`;
}
