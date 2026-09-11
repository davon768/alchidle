import { html, type TemplateResult } from 'lit-html';
import type { GameState, Mods } from '../../core/types';
import { RECIPES, RECIPE_MAP } from '../../data/recipes';
import { profProgress } from '../../data/proficiency';
import { QUALITIES, STIR_BAND, qualityChances, stirPos } from '../../data/quality';
import { brewQualityScore, brewRate, count, hasAll, potionBasePrice, profLevelOf, unlockedRecipes } from '../../core/engine';
import { brew, cancelBrew, selectRecipe, stir, toggleRepeat } from '../../core/actions';
import { fmt, fmtTime } from '../../core/format';
import { act, bar, chip, gold, qualityChips, sectionTitle } from '../common';

/** The one-shot stirring minigame: a marker sweeps the bar, tapping inside the glowing band banks quality. */
function stirBar(ci: number, target: number, left: number): TemplateResult {
  const pos = stirPos(left) * 100;
  const band = STIR_BAND * 100;
  return html`<div class="stir" @click=${act((st) => stir(st, ci))} title="Tap while the marker is in the glowing band">
    <div class="stir-track">
      <div class="stir-band" style="left:${Math.max(0, target * 100 - band)}%;width:${band * 2}%"></div>
      <div class="stir-marker" style="left:${pos}%"></div>
    </div>
    <button class="btn small primary stir-btn">🥄 Stir · ${left.toFixed(1)}s</button>
  </div>`;
}

/** Current odds of each quality tier for a recipe, including anything the cauldron has already banked. */
function qualityOdds(s: GameState, m: Mods, recipeId: string, banked: number): TemplateResult {
  const c = qualityChances(brewQualityScore(s, m, recipeId, banked));
  const pct = (v: number) => `${(v * 100).toFixed(v >= 0.1 ? 0 : 1)}%`;
  if (c.fine <= 0) return html`<div class="small muted">Always Common — raise brewing proficiency or stir to improve quality.</div>`;
  return html`<div class="small muted qual-odds">
    ${QUALITIES.slice(1).map((q, i) => html`<span style="color:${q.color}">${q.mark} ${pct([c.fine, c.master, c.legend][i])}</span>`)}
    ${banked > 0 ? html`<span class="good">· stirred</span>` : ''}
  </div>`;
}

export function brewView(s: GameState, m: Mods): TemplateResult {
  const recipes = unlockedRecipes(s);
  return html`<div class="view">
    ${sectionTitle('⚗️ Cauldrons', html`${s.cauldrons.length} cauldron${s.cauldrons.length > 1 ? 's' : ''} · ${m.autoBrew > 0
      ? html`<span class="good">🧑‍🔬 ${Math.min(Math.floor(m.autoBrew), s.cauldrons.length)}/${s.cauldrons.length} tended by Brewers</span>`
      : 'Brew one batch at a time — hire a Brewer apprentice to auto-repeat'}`)}

    <div class="grid wide">
      ${s.cauldrons.map((c, i) => {
        const r = c.recipeId ? RECIPE_MAP[c.recipeId] : null;
        const rate = r ? brewRate(s, m, r.id) : 1;
        const frac = r && c.active ? c.progress / r.time : 0;
        return html`<div class="card">
          <div class="row between">
            <h3>Cauldron ${i + 1}${i < m.autoBrew ? html` <span title="Tended by your Brewers">🧑‍🔬</span>` : ''}</h3>
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
            ${c.stirLeft > 0 ? stirBar(i, c.stirTarget, c.stirLeft) : qualityOdds(s, m, r.id, c.active ? c.stirQ : 0)}
            <div class="row between small muted">
              <span>⏱ ${c.active ? fmtTime((r.time - c.progress) / rate) : fmtTime(r.time / rate)}</span>
              <span>Sells ~${gold(potionBasePrice(s, m, r.id))}</span>
            </div>
            <div class="row">
              ${c.active
                ? html`<button class="btn small danger" @click=${act((st) => cancelBrew(st, i))}>Cancel</button>`
                : html`<button class="btn primary" ?disabled=${!hasAll(s, r.inputs)} @click=${act((st) => brew(st, i))}>Brew</button>`}
              <button class="btn small ${c.repeat ? 'on' : ''}" ?disabled=${i >= m.autoBrew} title=${i >= m.autoBrew ? 'Needs a Brewer apprentice tending this cauldron' : ''} @click=${act((st) => toggleRepeat(st, i))}>🔁 Repeat ${c.repeat ? 'ON' : 'OFF'}</button>
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
            <td>${fmt(Math.floor(count(s, r.id)))}${qualityChips(s, r.id)}</td>
          </tr>`;
        })}
      </table>
    </div>
  </div>`;
}
