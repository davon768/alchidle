import { html, type TemplateResult } from 'lit-html';
import type { GameState, Mods } from '../../core/types';
import {
  FAMILIARS, FAMILIAR_MAX, FAMILIAR_STEP, familiarEffects, familiarProgress, feedXp, milestonesAt,
} from '../../data/familiars';
import { RECIPES, RECIPE_MAP } from '../../data/recipes';
import { ZONE_MAP } from '../../data/zones';
import { quality } from '../../data/quality';
import { count, qualCounts } from '../../core/engine';
import { describeEffects } from '../../core/mods';
import { equipFamiliar, feed, unequipFamiliar } from '../../core/actions';
import { fmt } from '../../core/format';
import { act, bar, sectionTitle, ui } from '../common';

/** The potion the player would feed: whatever they have most of, unless they picked one. */
function feedChoice(s: GameState): string | null {
  if (ui.feedPotion && count(s, ui.feedPotion) >= 1) return ui.feedPotion;
  const owned = RECIPES.filter((r) => count(s, r.id) >= 1);
  return owned.length ? owned[owned.length - 1].id : null;
}

export function familiarsView(s: GameState, m: Mods): TemplateResult {
  const slots = Math.floor(m.familiarSlots);
  const found = FAMILIARS.filter((f) => s.familiars[f.id] !== undefined);
  const potion = feedChoice(s);
  const owned = RECIPES.filter((r) => count(s, r.id) >= 1);

  return html`<div class="view">
    ${sectionTitle('🐾 Familiars', html`${found.length}/${FAMILIARS.length} found · ${s.equippedFamiliars.length}/${slots} out ·
      they turn up on expeditions and grow on the potions you feed them`)}

    ${found.length === 0
      ? html`<div class="card dim">None yet. Keep sending expeditions — each zone has its own companion, and a
          finer 🧭 rare-find bonus makes them turn up sooner.</div>`
      : html`<div class="card">
          <div class="row between">
            <b>🍲 Feeding</b>
            <span class="dim">Finer bottles feed better — a ★ Legendary is worth six Commons</span>
          </div>
          ${owned.length
            ? html`<div class="row">
                <select @change=${(e: Event) => act(() => (ui.feedPotion = (e.target as HTMLSelectElement).value))(e)}>
                  ${owned.map((r) => html`<option value=${r.id} ?selected=${r.id === potion}>${r.icon} ${r.name} (${fmt(Math.floor(count(s, r.id)))})</option>`)}
                </select>
                ${potion ? html`<span class="dim">${(() => {
                  const tiers = qualCounts(s, potion);
                  const best = tiers.map((n, t) => ({ n, t })).filter((x) => x.n > 0).pop();
                  return best ? `next fed: ${quality(best.t).mark || 'Common'} · ${fmt(feedXp(RECIPE_MAP[potion].value, quality(best.t).value))} xp each` : '';
                })()}</span>` : ''}
              </div>`
            : html`<div class="dim">Nothing brewed to feed them yet.</div>`}
        </div>`}

    <div class="grid wide">
      ${FAMILIARS.map((f) => {
        const xp = s.familiars[f.id];
        const known = xp !== undefined;
        const zone = ZONE_MAP[f.zone];
        if (!known) {
          const seen = zone && s.level >= zone.level;
          return html`<div class="card locked">
            <div class="row between"><h3>❔ ${seen ? f.name : 'Undiscovered'}</h3><span class="dim">${zone?.icon ?? ''} ${seen ? zone.name : `Level ${zone?.level ?? '?'}`}</span></div>
            <div class="muted small">${seen ? f.desc : 'Explore further to find what lives there.'}</div>
          </div>`;
        }
        const pr = familiarProgress(xp);
        // Only the first `familiarSlots` of the equipped list actually reach computeMods, so read the
        // same slice here — otherwise a card could claim a familiar is out with you while it contributes nothing.
        const out = s.equippedFamiliars.slice(0, slots).includes(f.id);
        const next = Math.min(FAMILIAR_MAX, (milestonesAt(pr.level) + 1) * FAMILIAR_STEP);
        return html`<div class="card ${out ? 'highlight' : ''}">
          <div class="row between">
            <h3>${f.icon} ${f.name}</h3>
            <span class="dim">Lv ${pr.level}/${FAMILIAR_MAX}</span>
          </div>
          <div class="muted small">${f.desc}</div>
          ${bar(pr.into / pr.need, '#b57bff', `${fmt(Math.floor(pr.into))} / ${fmt(Math.ceil(pr.need))} xp`, 'tall')}
          <div class="small good">${milestonesAt(pr.level) > 0 ? describeEffects(familiarEffects(f, pr.level), 1) : 'No bond yet'}</div>
          <div class="dim">${pr.level >= FAMILIAR_MAX ? 'Fully bonded' : `Next bond at level ${next}: ${describeEffects(f.milestone, 1)}`}</div>
          <div class="row">
            ${out
              ? html`<button class="btn small on" @click=${act((st) => unequipFamiliar(st, f.id))}>Out with you ✓</button>`
              : html`<button class="btn small primary" @click=${act((st) => equipFamiliar(st, f.id))}>Take along</button>`}
            ${potion
              ? html`<button class="btn small" ?disabled=${count(s, potion) < 1}
                  @click=${act((st) => feed(st, f.id, potion, 1))}>Feed 1</button>
                <button class="btn small gold" ?disabled=${count(s, potion) < 10}
                  @click=${act((st) => feed(st, f.id, potion, 10))}>Feed 10</button>`
              : ''}
          </div>
          <div class="dim">${f.flavor}</div>
        </div>`;
      })}
    </div>
  </div>`;
}
