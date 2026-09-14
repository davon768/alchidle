/**
 * The adventurer company: hiring, supplying and running delves into the Endless Rift.
 *
 * A delve is resolved the way an expedition is — it runs on a timer through `tick` and pays out when it
 * lands — but unlike an expedition it can fail. Failure is never a loss of an adventurer: it costs the
 * supplies, pays a fraction of the haul, and puts one of the company on a rest timer. Depth only ever
 * goes down when they win, so the ladder is a ratchet.
 */
import type { Adventurer, Delve, GameState, Mods } from './types';
import { addGold, addItem, gainXp, potionPotency, randInt, removeItem, rollAmount, takenTier, toast } from './engine';
import { computeMods } from './mods';
import { workXp } from './staff';
import { RECIPE_MAP } from '../data/recipes';
import { quality } from '../data/quality';
import { RELIC_MAP, rollRelic } from '../data/relics';
import {
  ADV_MAX, CLASS_MAP, DELVE_DROPS, SUPPLY_WEIGHT, UNSUPPLIED_GUARD,
  advLevel, delveGold, delveOdds, delveReq, delveTime, delveXp, hireCost, haulMult, injuryRest, isBossDepth, supplyNeed,
} from '../data/adventurers';

/** Potions the supply kit accepts: anything with a combat effect, which is what a party can actually drink. */
export const suppliable = (id: string): boolean => !!RECIPE_MAP[id]?.combat;

export const advReady = (a: Adventurer): boolean => a.rest <= 0;

/** One adventurer's contribution before supplies and relics. */
export function heroPower(a: Adventurer): number {
  const cls = CLASS_MAP[a.cls];
  if (!cls) return 0;
  return cls.power * (1 + 0.14 * (advLevel(a.xp) - 1));
}

export interface PartyReport {
  ready: Adventurer[];
  base: number; // raw hero power
  supply: number; // share added by the kit, e.g. 0.6 for +60%
  power: number; // what a delve would set out with
  guard: number;
  haul: number;
  relicLuck: number;
  mend: number;
  /** Per kit slot: the potion, whether enough bottles are on hand, and what it would add. */
  slots: { id: string | null; need: number; have: number; tier: number; add: number }[];
}

/**
 * What the company would take down right now. Pure: it counts the bottles but never spends them, so the
 * UI, the odds display and the delve itself all read the same numbers.
 */
export function partyReport(s: GameState, m: Mods): PartyReport {
  const ready = s.party.roster.filter(advReady);
  const base = ready.reduce((a, x) => a + heroPower(x), 0);
  const need = supplyNeed(ready.length, nextDepth(s));
  const slots: PartyReport['slots'] = [];
  let supply = 0;
  let filled = 0;
  for (let i = 0; i < Math.floor(m.kitSlots); i++) {
    const id = s.party.kit[i] ?? null;
    if (!id || !suppliable(id)) {
      slots.push({ id: null, need, have: 0, tier: 0, add: 0 });
      continue;
    }
    // The party drinks its best bottles first, so a Legendary stock shows up here as more power.
    const tiers = (s.qual[id] ?? [Math.floor(s.items[id] ?? 0)]).slice();
    let left = need;
    let have = 0;
    let weighted = 0;
    let best = 0;
    for (let t = tiers.length - 1; t >= 0 && left > 0; t--) {
      const take = Math.min(left, Math.floor(tiers[t] ?? 0));
      if (take <= 0) continue;
      if (have === 0) best = t; // the finest bottle they would open
      have += take;
      left -= take;
      weighted += take * quality(t).potency;
    }
    const enough = have >= need && need > 0;
    const add = enough ? SUPPLY_WEIGHT * potionPotency(s, m, id) * (weighted / Math.max(1, have)) : 0;
    if (enough) {
      supply += add;
      filled++;
    }
    slots.push({ id, need, have, tier: best, add });
  }
  const guardAvg = ready.length ? ready.reduce((a, x) => a + (CLASS_MAP[x.cls]?.guard ?? 1), 0) / ready.length : 0;
  return {
    ready,
    base,
    supply,
    slots,
    power: base * m.partyPower * (1 + supply),
    guard: guardAvg * (filled > 0 ? 1 : UNSUPPLIED_GUARD),
    haul: 1 + ready.reduce((a, x) => a + (CLASS_MAP[x.cls]?.haul ?? 0), 0),
    relicLuck: ready.reduce((a, x) => a + (CLASS_MAP[x.cls]?.relicLuck ?? 0), 0),
    mend: ready.reduce((a, x) => a + (CLASS_MAP[x.cls]?.mend ?? 0), 0),
  };
}

/**
 * Bottles of a potion the company is holding for its next delve. Selling — by hand in bulk, or by a
 * Shopkeeper on auto — keeps this back on top of the player's own reserve, so supplying the party and
 * running a potion shop are not silently at war.
 */
export function kitReserve(s: GameState, m: Mods, id: string): number {
  const p = s.party;
  if (!p || !id || !p.kit.slice(0, Math.floor(m.kitSlots)).includes(id)) return 0;
  return supplyNeed(p.roster.filter(advReady).length, nextDepth(s));
}

/** The depth the next delve goes to. */
export const nextDepth = (s: GameState): number => s.party.depth + 1;

// ── Roster ───────────────────────────────────────────────────
export function canHire(s: GameState, m: Mods): boolean {
  return s.party.roster.length < Math.floor(m.partySlots) && s.gold >= hireCost(s.party.roster.length);
}

export function hireAdventurer(s: GameState, clsId: string): boolean {
  const m = computeMods(s);
  const cls = CLASS_MAP[clsId];
  if (!cls || !canHire(s, m)) return false;
  const cost = hireCost(s.party.roster.length);
  addGold(s, -cost, false);
  s.party.roster.push({ uid: `a${s.party.nextId++}`, cls: clsId, xp: 0, rest: 0 });
  toast(`${cls.icon} A ${cls.name} signs on with your company.`, 'epic');
  return true;
}

/** Let someone go. Their levels go with them, so this is a real cost, not a free reroll. */
export function dismissAdventurer(s: GameState, uid: string): void {
  const i = s.party.roster.findIndex((a) => a.uid === uid);
  if (i < 0 || s.party.delve) return;
  const cls = CLASS_MAP[s.party.roster[i].cls];
  s.party.roster.splice(i, 1);
  toast(`${cls?.icon ?? '🚪'} ${cls?.name ?? 'Your adventurer'} takes their pay and goes.`, 'info');
}

export function setKit(s: GameState, slot: number, potionId: string | null): void {
  if (potionId && !suppliable(potionId)) return;
  while (s.party.kit.length <= slot) s.party.kit.push(null);
  // One potion per slot: the same tonic twice is a trap, not a strategy.
  if (potionId) for (let i = 0; i < s.party.kit.length; i++) if (i !== slot && s.party.kit[i] === potionId) s.party.kit[i] = null;
  s.party.kit[slot] = potionId;
}

// ── Delving ──────────────────────────────────────────────────
export function canDelve(s: GameState, m: Mods): boolean {
  return !s.party.delve && m.partySlots >= 1 && s.party.roster.some(advReady);
}

/** Send the company down. Supplies are spent at departure, best bottles first. */
export function startDelve(s: GameState, m: Mods): boolean {
  if (!canDelve(s, m)) return false;
  const depth = nextDepth(s);
  const ready = s.party.roster.filter(advReady);
  const need = supplyNeed(ready.length, depth);
  let supply = 0;
  let supplied = 0;
  for (let i = 0; i < Math.floor(m.kitSlots); i++) {
    const id = s.party.kit[i];
    if (!id || !suppliable(id)) continue;
    const have = Math.floor(s.items[id] ?? 0);
    if (have < need) continue;
    const taken = removeItem(s, id, need, 'high');
    const weighted = taken.reduce((a, n, t) => a + n * quality(t).potency, 0) / Math.max(1, need);
    supply += SUPPLY_WEIGHT * potionPotency(s, m, id) * weighted;
    supplied++;
    if (takenTier(taken) >= 2) {
      toast(`${RECIPE_MAP[id].icon} The company packs ${quality(takenTier(taken)).name} ${RECIPE_MAP[id].name}.`, 'good');
    }
  }
  const base = ready.reduce((a, x) => a + heroPower(x), 0);
  const power = base * m.partyPower * (1 + supply);
  const time = delveTime(depth) / Math.max(0.1, m.delveSpeed);
  s.party.delve = { depth, progress: 0, time, power, supplied };
  toast(`🌀 The company descends to depth ${depth}${isBossDepth(depth) ? ' — something is waiting' : ''}.`, isBossDepth(depth) ? 'epic' : 'info');
  return true;
}

function delveLoot(s: GameState, m: Mods, depth: number, haul: number, share: number): void {
  const mult = haulMult(depth) * haul * share;
  addGold(s, Math.round(delveGold(depth) * haul * share));
  for (const d of DELVE_DROPS) {
    if (d.depth > depth) continue;
    if (Math.random() >= Math.min(1, d.chance * (d.id === 'relic' ? m.rareFind : 1))) continue;
    const qty = rollAmount(randInt(d.min, d.max) * mult);
    if (qty > 0) addItem(s, d.id, qty);
  }
}

function awardRelic(s: GameState, depth: number): void {
  const def = rollRelic(depth);
  if (!def) return;
  const rank = (s.party.relics[def.id] ?? 0) + 1;
  s.party.relics[def.id] = rank;
  toast(`${def.icon} ${def.name}${rank > 1 ? ` rank ${rank}` : ''} — torn out of the deep!`, 'epic');
}

/** Hurt one of the company. The heavily armoured are far less likely to be the one who limps home. */
function injure(report: { ready: Adventurer[]; guard: number; mend: number }, depth: number): void {
  const pool = report.ready;
  if (pool.length === 0) return;
  if (Math.random() >= 0.9 / (1 + report.guard)) return;
  const weights = pool.map((a) => 1 / Math.max(0.2, CLASS_MAP[a.cls]?.guard ?? 1));
  let roll = Math.random() * weights.reduce((a, b) => a + b, 0);
  let hurt = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) { hurt = pool[i]; break; }
  }
  hurt.rest = injuryRest(depth, report.mend);
  const cls = CLASS_MAP[hurt.cls];
  toast(`🩹 Your ${cls?.name ?? 'adventurer'} comes back hurt and needs rest.`, 'warn');
}

function resolveDelve(s: GameState, m: Mods, d: Delve): void {
  const report = partyReport(s, m);
  const ready = report.ready.length ? report.ready : s.party.roster;
  const won = Math.random() < delveOdds(d.power, d.depth);
  s.stats.delves++;
  if (won) {
    s.party.depth = Math.max(s.party.depth, d.depth);
    delveLoot(s, m, d.depth, report.haul, 1);
    gainXp(s, m, delveGold(d.depth) * 0.15);
    if (isBossDepth(d.depth) || Math.random() < report.relicLuck) awardRelic(s, d.depth);
    if (isBossDepth(d.depth)) s.stats.bosses++;
    toast(`🌀 Depth ${d.depth} cleared! The company presses on.`, isBossDepth(d.depth) ? 'epic' : 'good');
  } else {
    delveLoot(s, m, d.depth, report.haul, 0.3);
    injure({ ready: report.ready, guard: report.guard, mend: report.mend }, d.depth);
    toast(`🌀 Depth ${d.depth} turned them back. They salvage what they can.`, 'warn');
  }
  const xp = delveXp(d.depth) * (won ? 1 : 0.5);
  for (const a of ready) if (advLevel(a.xp) < ADV_MAX) a.xp += xp;
  workXp(s, m, 'captain', 0, d.time / 45);
  s.party.delve = null;
}

/** Per-tick company upkeep: rest timers, the delve in progress, and the Captain sending them back down. */
export function tickParty(s: GameState, m: Mods, dt: number): void {
  const p = s.party;
  for (const a of p.roster) if (a.rest > 0) a.rest = Math.max(0, a.rest - dt);
  let t = dt;
  for (let g = 0; t > 0 && g < 50; g++) {
    if (!p.delve) {
      if (!p.repeat || m.autoDelve < 1 || !canDelve(s, m)) break;
      if (!startDelve(s, m)) break;
    }
    const d = p.delve;
    if (!d) break;
    const left = d.time - d.progress;
    if (t < left) { d.progress += t; t = 0; break; }
    t -= left;
    resolveDelve(s, m, d);
  }
}

/** Relic ranks in a readable order for the UI. */
export function relicList(s: GameState): { id: string; rank: number }[] {
  return Object.entries(s.party.relics)
    .filter(([id, rank]) => RELIC_MAP[id] && rank > 0)
    .map(([id, rank]) => ({ id, rank }))
    .sort((a, b) => RELIC_MAP[a.id].depth - RELIC_MAP[b.id].depth);
}

export { delveOdds, delveReq, hireCost, isBossDepth };
