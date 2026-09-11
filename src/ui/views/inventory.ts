import { html, type TemplateResult } from 'lit-html';
import type { GameState, Mods } from '../../core/types';
import { ALL_ITEMS, item, type ItemKind } from '../../data/items';
import { RECIPES, RECIPE_MAP, describeCombatEffect } from '../../data/recipes';
import { REAGENTS, SPELLS } from '../../data/spells';
import { FORGE_TIERS, RARITIES, gearBase, gearName } from '../../data/gear';
import { count, potionPotency, profLevelOf, sellValue } from '../../core/engine';
import { PROF_MAP } from '../../data/proficiency';
import { isEquipped } from '../../core/armory';
import { fmt } from '../../core/format';
import { act, gold, sectionTitle, ui } from '../common';

const KIND_LABEL: Record<ItemKind, string> = { herb: '🌿 Herb', material: '🪨 Material', potion: '🧪 Potion', reagent: '🖋️ Reagent' };

let usesIndex: Record<string, string[]> | null = null;

/** Where each item is used: recipes, reagents, spells and forge tiers. Built once from game data. */
function uses(): Record<string, string[]> {
  if (usesIndex) return usesIndex;
  const u: Record<string, string[]> = {};
  const add = (id: string, label: string) => {
    if (id === 'gold') return;
    const list = (u[id] ??= []);
    if (!list.includes(label)) list.push(label);
  };
  for (const r of RECIPES) for (const i of r.inputs) add(i.id, `${r.icon} ${r.name}`);
  for (const rg of REAGENTS) for (const i of rg.inputs) add(i.id, `${item(rg.id).icon} ${item(rg.id).name}`);
  for (const sp of SPELLS) for (const c of [...sp.learn, ...sp.rankCost, ...(sp.ritual?.reagents ?? [])]) add(c.id, `${sp.icon} ${sp.name}`);
  for (const ft of FORGE_TIERS) for (const c of ft.cost) add(c.id, `⚒️ Forge T${ft.tier}`);
  add('arcanedust', '⬆ Gear enhancing');
  usesIndex = u;
  return u;
}

export function inventoryView(s: GameState, m: Mods): TemplateResult {
  const owned = ALL_ITEMS.filter((i) => count(s, i.id) >= 1);
  const shown = owned.filter((i) => ui.invFilter === 'all' || i.kind === ui.invFilter);
  const worth = owned.reduce((a, i) => a + sellValue(s, m, i.id, Math.floor(count(s, i.id))), 0);
  const filters: [typeof ui.invFilter, string][] = [['all', 'All'], ['herb', '🌿 Herbs'], ['material', '🪨 Materials'], ['potion', '🧪 Potions'], ['reagent', '🖋️ Reagents'], ['gear', '🗡️ Gear']];
  const u = uses();

  return html`<div class="view">
    ${sectionTitle('🎒 Inventory', html`${owned.length} kinds of items · worth about ${gold(worth)} · <span class="badge-new" style="position:static">NEW</span> = gained since you last looked`)}
    <div class="pill-tabs">${filters.map(([f, label]) => html`<button class="btn small ${ui.invFilter === f ? 'active' : ''}" @click=${act(() => (ui.invFilter = f))}>${label}</button>`)}</div>

    ${ui.invFilter === 'gear'
      ? html`<div class="inv-grid">${s.gear.map((g) => html`<div class="inv-tile" style="border-color:${RARITIES[g.rarity].color}">
          ${ui.newItems.has(g.uid) ? html`<span class="badge-new">NEW</span>` : ''}
          <div class="inv-top"><span class="inv-icon">${gearBase(g).icon}</span><b style="color:${RARITIES[g.rarity].color}">${gearName(g)}</b></div>
          <div class="dim">T${g.tier} ${RARITIES[g.rarity].name}${isEquipped(s, g.uid) ? ' · equipped' : ''}</div>
        </div>`)}</div>
        <button class="btn small" @click=${act(() => (ui.tab = 'armory'))}>Manage gear in the 🗡️ Armory</button>`
      : shown.length === 0
        ? html`<div class="card dim">Nothing here yet — your garden, cauldrons, expeditions and dungeons will fill it up.</div>`
        : html`<div class="inv-grid">${shown.map((i) => {
            const fx = RECIPE_MAP[i.id]?.combat;
            const list = u[i.id] ?? [];
            return html`<div class="inv-tile">
              ${ui.newItems.has(i.id) ? html`<span class="badge-new">NEW</span>` : ''}
              <div class="inv-top">
                <span class="inv-icon">${i.icon}</span>
                <div class="col" style="gap:0"><b>${i.name}</b><span class="inv-qty">${fmt(Math.floor(count(s, i.id)))}</span></div>
              </div>
              <div class="dim">${KIND_LABEL[i.kind]} · sells ~${fmt(sellValue(s, m, i.id, 1))} each${PROF_MAP[i.id] ? ` · 🎖️ Lv ${profLevelOf(s, i.id)}` : ''}</div>
              ${fx ? html`<div class="small good">${fx.map((f) => describeCombatEffect(f, potionPotency(s, m, i.id))).join(' · ')}</div>` : ''}
              ${list.length ? html`<div class="dim">Used in: ${list.slice(0, 4).join(', ')}${list.length > 4 ? ` +${list.length - 4} more` : ''}</div>` : ''}
            </div>`;
          })}</div>`}
  </div>`;
}
