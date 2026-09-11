import { html, type TemplateResult } from 'lit-html';
import type { GameState, Mods } from '../../core/types';
import { RECIPES, RECIPE_MAP } from '../../data/recipes';
import { profProgress } from '../../data/proficiency';
import { brewRate, count, hasAll, potionBasePrice, profLevelOf, unlockedRecipes } from '../../core/engine';
import { brew, cancelBrew, selectRecipe, toggleRepeat } from '../../core/actions';
import { fmt, fmtTime } from '../../core/format';
import { act, bar, chip, gold, sectionTitle } from '../common';

export function brewView(s: GameState, m: Mods): TemplateResult {
  const recipes = unlockedRecipes(s);
  return html`<div class="view">
    ${sectionTitle('⚗️ Cauldrons', html`${s.cauldrons.length} cauldron${s.cauldrons.length > 1 ? 's' : ''} · ${m.autoBrew > 0 ? html`<span class="good">Auto-repeat unlocked</span>` : 'Brew one batch at a time'}`)}

    <div class="grid wide">
      ${s.cauldrons.map((c, i) => {
        const r = c.recipeId ? RECIPE_MAP[c.recipeId] : null;
        const rate = r ? brewRate(s, m, r.id) : 1;
        const frac = r && c.active ? c.progress / r.time : 0;
        return html`<div class="card">
          <div class="row between">
            <h3>Cauldron ${i + 1}</h3>
            ${r ? html`<span class="dim">🎖️ Proficiency ${profLevelOf(s, r.id)}</span>` : ''}
          </div>
          <div class="cauldron-vis ${c.active ? 'active' : ''}">
            <div class="liquid" style="height:${c.active ? 25 + frac * 75 : 12}%;background:${r?.color ?? '#333'}"></div>
            <div class="bubbles">${r ? r.icon : '🫗'}</div>
          </div>
          <select .value=${c.recipeId ?? ''} ?disabled=${c.active} @change=${(e: Event) => act((st) => selectRecipe(st, i, (e.target as HTMLSelectElement).value))(e)}>
            <option value="" disabled>Choose a recipe…</option>
            ${recipes.map((rc) => html`<option value=${rc.id} ?selected=${rc.id === c.recipeId}>${rc.icon} ${rc.name}</option>`)}
          </select>
          ${r ? html`
            <div class="row">${r.inputs.map((inp) => chip(inp, count(s, inp.id)))} <span class="muted">→</span> ${chip({ id: r.id, qty: 1 })}</div>
            <div class="row between small muted">
              <span>⏱ ${c.active ? fmtTime((r.time - c.progress) / rate) : fmtTime(r.time / rate)}</span>
              <span>Sells ~${gold(potionBasePrice(s, m, r.id))}</span>
            </div>
            <div class="row">
              ${c.active
                ? html`<button class="btn small danger" @click=${act((st) => cancelBrew(st, i))}>Cancel</button>`
                : html`<button class="btn primary" ?disabled=${!hasAll(s, r.inputs)} @click=${act((st) => brew(st, i))}>Brew</button>`}
              <button class="btn small ${c.repeat ? 'on' : ''}" ?disabled=${m.autoBrew <= 0} @click=${act((st) => toggleRepeat(st, i))}>🔁 Repeat ${c.repeat ? 'ON' : 'OFF'}</button>
            </div>` : html`<div class="dim">Pick a recipe to start brewing.</div>`}
        </div>`;
      })}
    </div>

    ${sectionTitle('📖 Recipe Book', 'Each potion has its own 🎖️ proficiency (1–100) with a milestone every 10 levels')}
    <div class="card table-wrap">
      <table class="table">
        <tr><th></th><th>Potion</th><th>Ingredients</th><th>Time</th><th>Value</th><th>Proficiency</th><th>Owned</th></tr>
        ${RECIPES.map((r) => {
          const locked = r.level > s.level;
          const pr = profProgress(s.prof[r.id] ?? 0);
          return html`<tr style=${locked ? 'opacity:.4' : ''}>
            <td class="big-icon" style="font-size:20px">${locked ? '🔒' : r.icon}</td>
            <td><b>${r.name}</b><div class="dim">${locked ? `Unlocks at level ${r.level}` : r.desc}</div></td>
            <td><div class="row">${r.inputs.map((inp) => chip(inp))}</div></td>
            <td>${fmtTime(r.time / brewRate(s, m, r.id))}</td>
            <td>${gold(potionBasePrice(s, m, r.id))}</td>
            <td style="min-width:110px"><b>${pr.level}</b><span class="dim">/100</span>${bar(pr.into / pr.need, '#b57bff', undefined, 'small')}</td>
            <td>${fmt(Math.floor(count(s, r.id)))}</td>
          </tr>`;
        })}
      </table>
    </div>
  </div>`;
}
