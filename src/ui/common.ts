import { html, nothing, type TemplateResult } from 'lit-html';
import type { GameState, GearSlot, ItemStack } from '../core/types';
import { game } from '../core/game';
import { item, type ItemKind } from '../data/items';
import { qualCounts } from '../core/engine';
import { quality } from '../data/quality';
import { fmt } from '../core/format';

export type TabId =
  | 'garden' | 'brew' | 'explore' | 'staff' | 'dungeon' | 'market' | 'inventory' | 'proficiency' | 'arcanum' | 'armory'
  | 'trade' | 'guild' | 'workshop' | 'skills' | 'ascend' | 'goals' | 'journal';

export const ui = {
  tab: 'garden' as TabId,
  skillTree: 'herb',
  plantChoice: 'sunleaf',
  modal: null as TemplateResult | null,
  marketFilter: 'potion' as 'potion' | 'herb' | 'material' | 'reagent',
  invFilter: 'all' as 'all' | ItemKind | 'gear',
  armoryFilter: 'all' as 'all' | GearSlot,
  forgeSlot: 'weapon' as GearSlot,
  spellTab: 'combat' as 'combat' | 'ritual',
  profFilter: 'all' as 'all' | 'plant' | 'potion' | 'reagent' | 'forge',
  /** Item keys gained since the Inventory tab was last open (shows NEW badges). */
  newItems: new Set<string>(),
};

let rerender: () => void = () => {};
export function setRerender(fn: () => void): void {
  rerender = fn;
}
export function refresh(): void {
  rerender();
}

/** Wrap a state mutation as an event handler that re-renders afterwards. */
export function act(fn: (s: GameState) => void): (e: Event) => void {
  return (e: Event) => {
    e.stopPropagation();
    fn(game.s);
    rerender();
  };
}

export function openModal(t: TemplateResult): void {
  ui.modal = t;
  rerender();
}
export function closeModal(): void {
  ui.modal = null;
  rerender();
}

/** Item chip, e.g. "🌿 2". Pass `have` to color it red when you lack enough. */
export function chip(st: ItemStack, have?: number): TemplateResult {
  const isGold = st.id === 'gold';
  const def = isGold ? null : item(st.id);
  const lack = have !== undefined && have < st.qty;
  return html`<span class="chip ${lack ? 'lack' : ''}" title=${isGold ? 'Gold' : def!.name}>
    <span class="chip-icon">${isGold ? '🪙' : def!.icon}</span>${fmt(st.qty)}${have !== undefined && !isGold ? html`<span class="chip-have">/${fmt(Math.floor(have))}</span>` : nothing}
  </span>`;
}

/** Chips for a cost list, showing what you have (gold compared against your purse). */
export function costChips(s: GameState, stacks: ItemStack[], times = 1): TemplateResult {
  return html`${stacks.map((st) => chip({ id: st.id, qty: st.qty * times }, st.id === 'gold' ? s.gold : s.items[st.id] ?? 0))}`;
}

/**
 * Per-tier breakdown for a potion, e.g. "✦ 3 · ✦✦ 1". Renders nothing when everything on hand is Common,
 * so plain inventories stay uncluttered.
 */
export function qualityChips(s: GameState, id: string): TemplateResult | typeof nothing {
  if (item(id).kind !== 'potion') return nothing;
  const tiers = qualCounts(s, id);
  const parts = tiers.map((n, t) => ({ n: Math.floor(n), t })).filter((x) => x.t > 0 && x.n > 0);
  if (!parts.length) return nothing;
  return html`<div class="qual-row">${parts.map(
    (x) => html`<span class="qual-chip" style="--q:${quality(x.t).color}" title=${`${quality(x.t).name}: ×${quality(x.t).value} value, ×${quality(x.t).potency} potency`}>${quality(x.t).mark} ${fmt(x.n)}</span>`,
  )}</div>`;
}

export function bar(frac: number, color?: string, label?: string, cls = ''): TemplateResult {
  const pct = Math.max(0, Math.min(1, frac)) * 100;
  return html`<div class="bar ${cls}"><div class="fill" style="width:${pct}%;${color ? `background:${color}` : ''}"></div>${label ? html`<span class="bar-label">${label}</span>` : nothing}</div>`;
}

export function gold(n: number): TemplateResult {
  return html`<span class="gold-text">🪙 ${fmt(n)}</span>`;
}

export function sectionTitle(title: string, sub?: string | TemplateResult): TemplateResult {
  return html`<div class="section-title"><h2>${title}</h2>${sub ? html`<div class="sub">${sub}</div>` : nothing}</div>`;
}
