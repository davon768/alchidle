import { html, nothing, type TemplateResult } from 'lit-html';
import { ROLE_MAP, type RoleId } from '../data/apprentices';
import { setHandover, working } from '../core/automation';
import type { GameState, GearSlot, ItemStack } from '../core/types';
import { game } from '../core/game';
import { item, type ItemKind } from '../data/items';
import { qualCounts } from '../core/engine';
import { quality } from '../data/quality';
import type { UpgradeGroup } from '../data/upgrades';
import { fmt } from '../core/format';

export type TabId =
  | 'garden' | 'brew' | 'explore' | 'staff' | 'dungeon' | 'party' | 'market' | 'inventory' | 'proficiency' | 'arcanum' | 'armory'
  | 'trade' | 'guild' | 'workshop' | 'library' | 'familiars' | 'skills' | 'ascend' | 'goals' | 'ledger' | 'journal';

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
  /** Which Workshop section is shown; 'all' groups them under headings. */
  shopGroup: 'all' as 'all' | UpgradeGroup,
  /** Potion chosen for feeding familiars; falls back to whatever is on hand. */
  feedPotion: '' as string,
  /** Item keys gained since the Inventory tab was last open (shows NEW badges). */
  /** Which seeds are selected for each cross on the bench. A half-finished thought, not progress. */
  crossPick: {} as Record<string, { a: string; b: string }>,
  /** Whether the crossing bench is expanded. Shut by default: the garden is the screen. */
  benchOpen: false,
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
export function qualityChips(s: GameState, id: string, includeCommon = false): TemplateResult | typeof nothing {
  if (item(id).kind !== 'potion') return nothing;
  const tiers = qualCounts(s, id);
  const parts = tiers.map((n, t) => ({ n: Math.floor(n), t })).filter((x) => x.n > 0 && (includeCommon || x.t > 0));
  if (!parts.length) return nothing;
  return html`<div class="qual-row">${parts.map(
    (x) => html`<span class="qual-chip" style="--q:${quality(x.t).color}" title=${`${quality(x.t).name}: ×${quality(x.t).value} value, ×${quality(x.t).potency} combat potency`}>${quality(x.t).mark || quality(x.t).name} ${fmt(x.n)}</span>`,
  )}</div>`;
}

export function bar(frac: number, color?: string, label?: string, cls = ''): TemplateResult {
  const pct = Math.max(0, Math.min(1, frac)) * 100;
  return html`<div class="bar ${cls}"><div class="fill" style="width:${pct}%;${color ? `background:${color}` : ''}"></div>${label ? html`<span class="bar-label">${label}</span>` : nothing}</div>`;
}

export function gold(n: number): TemplateResult {
  return html`<span class="gold-text">🪙 ${fmt(n)}</span>`;
}

/**
 * The handover switch: who is deciding here, you or your apprentice.
 *
 * Shown on every screen an apprentice acts on, because automation that cannot be turned off is not a
 * convenience, it is a loss of the game. It only appears once that craft actually has an apprentice with
 * something to decide — an inert toggle on an empty craft is just noise.
 *
 * Turning it off stops the *choosing* only. The apprentice still tends the beds and pots assigned to
 * them; that is what they are, and a toggle should not amount to firing someone you have spent a hundred
 * levels training.
 */
export function handover(s: GameState, role: string, what: string): TemplateResult | typeof nothing {
  const named = role === 'meta' ? 'Your eternal perks' : ROLE_MAP[role as RoleId]?.name;
  if (!named) return nothing;
  if (role !== 'meta' && !s.staff.crew[role as RoleId]) return nothing;
  const auto = working(s, role);
  return html`<label class="handover ${auto ? 'on' : ''}" title=${auto
      ? `${named} ${role === 'meta' ? 'handle' : 'decides'} ${what}. Switch off to do it yourself.`
      : `You decide ${what}. Switch on to hand it back to ${named}.`}>
    <input type="checkbox" .checked=${auto} @change=${act((st) => setHandover(st, role, !auto))} />
    <span>${auto ? `${named} ${role === 'meta' ? 'handle' : 'decides'} ${what}` : `You decide ${what}`}</span>
  </label>`;
}

export function sectionTitle(title: string, sub?: string | TemplateResult): TemplateResult {
  return html`<div class="section-title"><h2>${title}</h2>${sub ? html`<div class="sub">${sub}</div>` : nothing}</div>`;
}
