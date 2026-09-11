import { html, type TemplateResult } from 'lit-html';
import type { GameState, GearItem, Mods } from '../../core/types';
import { FORGE_TIERS, GEAR_CAP, GEAR_SLOTS, RARITIES, SLOT_INFO, enhanceCost, gearBase, gearEffects, gearName, gearValue, salvageDust } from '../../data/gear';
import { DUNGEON_MAP } from '../../data/combat';
import { count, hasAll, profLevelOf } from '../../core/engine';
import { enhanceGear, equip, findGear, forgeCost, forgeGear, forgeUnlocked, gearScore, isEquipped, salvageBelow, salvageGear, sellGear, unequip } from '../../core/armory';
import { heroStats } from '../../core/combat';
import { describeEffects } from '../../core/mods';
import { fmt } from '../../core/format';
import { act, chip, costChips, sectionTitle, ui } from '../common';
import { heroStatGrid } from './dungeon';

function gearHeader(it: GearItem): TemplateResult {
  const r = RARITIES[it.rarity];
  return html`<div class="row between">
    <span class="gear-name" style="color:${r.color}">${gearBase(it).icon} ${gearName(it)}</span>
    <span class="dim">T${it.tier} ${r.name}</span>
  </div>
  <div class="small">${describeEffects(gearEffects(it))}</div>`;
}

function equippedCard(s: GameState, slot: (typeof GEAR_SLOTS)[number]): TemplateResult {
  const uid = s.equipped[slot];
  const it = uid ? findGear(s, uid) : undefined;
  if (!it) {
    return html`<div class="card"><h3>${SLOT_INFO[slot].icon} ${SLOT_INFO[slot].name}</h3><div class="dim">Empty — equip something below or forge one.</div></div>`;
  }
  const cost = enhanceCost(it);
  return html`<div class="card gear-card" style="--rarity:${RARITIES[it.rarity].color}">
    <div class="dim">${SLOT_INFO[slot].icon} ${SLOT_INFO[slot].name}</div>
    ${gearHeader(it)}
    <div class="row"><span class="dim">Enhance +${it.enhance + 1} (+10% base stats):</span>${chip({ id: 'gold', qty: cost.gold }, s.gold)}${chip({ id: 'arcanedust', qty: cost.dust }, count(s, 'arcanedust'))}</div>
    <div class="row">
      <button class="btn small gold" ?disabled=${s.gold < cost.gold || count(s, 'arcanedust') < cost.dust} @click=${act((st) => enhanceGear(st, it.uid))}>⬆ Enhance</button>
      <button class="btn small" @click=${act((st) => unequip(st, slot))}>Unequip</button>
    </div>
  </div>`;
}

function bagCard(s: GameState, it: GearItem): TemplateResult {
  const slot = gearBase(it).slot;
  const cur = s.equipped[slot] ? findGear(s, s.equipped[slot]!) : undefined;
  const diff = cur ? gearScore(it) - gearScore(cur) : 1;
  return html`<div class="card gear-card" style="--rarity:${RARITIES[it.rarity].color}">
    ${gearHeader(it)}
    <div class="small ${diff > 0 ? 'better' : 'worse'}">${cur ? (diff > 0 ? `▲ Stronger than your ${SLOT_INFO[slot].name.toLowerCase()}` : '▼ Weaker than equipped') : `▲ Your ${SLOT_INFO[slot].name.toLowerCase()} slot is empty`}</div>
    <div class="row">
      <button class="btn small primary" @click=${act((st) => equip(st, it.uid))}>Equip</button>
      <button class="btn small" @click=${act((st) => sellGear(st, it.uid))}>Sell 🪙${fmt(gearValue(it))}</button>
      <button class="btn small" @click=${act((st) => salvageGear(st, it.uid))}>Salvage ✴️${salvageDust(it)}</button>
    </div>
  </div>`;
}

export function armoryView(s: GameState, m: Mods): TemplateResult {
  const bag = s.gear
    .filter((g) => !isEquipped(s, g.uid) && (ui.armoryFilter === 'all' || gearBase(g).slot === ui.armoryFilter))
    .sort((a, b) => b.rarity - a.rarity || b.tier - a.tier || gearScore(b) - gearScore(a));
  const salvageOpts: [number, string][] = [[0, 'Off'], [1, 'Common'], [2, '≤ Fine'], [3, '≤ Rare']];

  return html`<div class="view">
    ${sectionTitle('🗡️ Armory', html`${s.gear.length}/${GEAR_CAP} items · ✴️ ${fmt(Math.floor(count(s, 'arcanedust')))} Arcane Dust`)}
    <div class="grid">${GEAR_SLOTS.map((slot) => equippedCard(s, slot))}</div>
    <div class="card">${heroStatGrid(heroStats(s, m), m)}</div>

    ${sectionTitle('🎒 Gear Bag', 'Drops from dungeon monsters — bosses always drop gear')}
    <div class="row between">
      <div class="pill-tabs">
        ${(['all', ...GEAR_SLOTS] as const).map((f) => html`<button class="btn small ${ui.armoryFilter === f ? 'active' : ''}" @click=${act(() => (ui.armoryFilter = f))}>
          ${f === 'all' ? 'All' : `${SLOT_INFO[f].icon} ${SLOT_INFO[f].name}`}</button>`)}
      </div>
      <div class="row">
        <span class="small muted">Auto-salvage drops:</span>
        ${salvageOpts.map(([v, label]) => html`<button class="btn small ${s.settings.autoSalvage === v ? 'on' : ''}" @click=${act((st) => (st.settings.autoSalvage = v))}>${label}</button>`)}
        <button class="btn small danger" @click=${act((st) => salvageBelow(st, 2))}>Salvage all ≤ Fine</button>
      </div>
    </div>
    ${bag.length ? html`<div class="grid wide">${bag.map((it) => bagCard(s, it))}</div>` : html`<div class="dim">No spare gear. Fight in ⚔️ Dungeons or forge some below.</div>`}

    ${sectionTitle('⚒️ Forge', 'Craft a random item (always Fine or better) for the chosen slot')}
    <div class="pill-tabs">
      ${GEAR_SLOTS.map((slot) => html`<button class="btn small ${ui.forgeSlot === slot ? 'active' : ''}" @click=${act(() => (ui.forgeSlot = slot))}>${SLOT_INFO[slot].icon} ${SLOT_INFO[slot].name}</button>`)}
    </div>
    <div class="grid">
      ${FORGE_TIERS.map((ft) => {
        const d = DUNGEON_MAP[ft.dungeon];
        const open = forgeUnlocked(s, ft.tier);
        const cost = forgeCost(s, ft.tier);
        return html`<div class="card ${open ? '' : 'locked'}">
          <div class="row between"><h3>Tier ${ft.tier} <span class="dim">🎖️ ${profLevelOf(s, `forge${ft.tier}`)}</span></h3><span class="dim">${d.icon} ${d.name} materials</span></div>
          <div class="row">${costChips(s, cost)}</div>
          <button class="btn gold" ?disabled=${!open || !hasAll(s, cost)} @click=${act((st) => forgeGear(st, ft.tier, ui.forgeSlot))}>
            ${open ? `⚒️ Forge ${SLOT_INFO[ui.forgeSlot].name}` : `Level ${d.level}`}</button>
        </div>`;
      })}
    </div>
  </div>`;
}
