/**
 * Adventurer parties: a company of heroes you hire, supply with your own potions, and send down into
 * the Endless Rift.
 *
 * This is the system that gives brewing a reason to exist outside the Market. A delve spends one bottle
 * of every kitted potion *per adventurer*, and the party always drinks the finest bottles it has, so a
 * Legendary run goes measurably deeper than a Common one. What comes back is materials, gold, hero XP
 * and — every tenth depth, off the thing that lives down there — a relic.
 *
 * Depth is the long game. What a depth demands grows 18% forever while a hero's own power grows only by
 * levels, so the way down is more adventurers, better supplies and stacked relics. Depth, heroes and
 * relics all survive ascension, like familiars and apprentices.
 */
import type { Effect, GameState, Mods, StatKey } from '../core/types';

export interface AdventurerClass {
  id: string;
  name: string;
  icon: string;
  desc: string;
  power: number; // base contribution to party power at level 1
  guard: number; // share of the party's resilience; higher means fewer injuries
  haul?: number; // extra share of everything the delve brings back
  relicLuck?: number; // extra chance of a relic outside a boss depth
  mend?: number; // share cut from an injured companion's rest
  flavor: string;
}

export const CLASSES: AdventurerClass[] = [
  { id: 'warden', name: 'Warden', icon: '🛡️', power: 11, guard: 1.7,
    desc: 'Holds the line so the others come home.',
    flavor: 'Has never once been the first through a door.' },
  { id: 'blade', name: 'Blademaster', icon: '⚔️', power: 19, guard: 0.8,
    desc: 'Hits hardest, bleeds easiest.',
    flavor: 'Names every sword. Loses every sword.' },
  { id: 'ranger', name: 'Ranger', icon: '🏹', power: 13, guard: 1.1, haul: 0.3,
    desc: 'Fights well and packs better — the party brings back 30% more.',
    flavor: 'Knows exactly how much a bag holds, then adds one more thing.' },
  { id: 'mage', name: 'Rift Mage', icon: '🔮', power: 22, guard: 0.6,
    desc: 'The most power in the company, and the least armour.',
    flavor: 'Reads the Rift the way you read a recipe.' },
  { id: 'cleric', name: 'Cleric', icon: '⚕️', power: 9, guard: 1.5, mend: 0.45,
    desc: 'Injured companions rest 45% less.',
    flavor: 'Carries bandages, prayers, and strong opinions about your potions.' },
  { id: 'rogue', name: 'Rogue', icon: '🗡️', power: 14, guard: 0.9, relicLuck: 0.06, haul: 0.1,
    desc: 'Turns up relics between the boss depths.',
    flavor: 'Was already inside when you finished explaining the plan.' },
];

export const CLASS_MAP: Record<string, AdventurerClass> = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

// ── Levels ───────────────────────────────────────────────────
export const ADV_MAX = 60;

/** XP from level L to L+1. Delves are slow, so this is tuned to tens of hours for a maxed hero. */
export function advXpToNext(level: number): number {
  return Math.floor(10 * 1.09 ** (level - 1));
}

const CUM: number[] = [0, 0];
for (let L = 1; L < ADV_MAX; L++) CUM[L + 1] = CUM[L] + advXpToNext(L);

export function advLevel(xp: number): number {
  let lo = 1;
  let hi = ADV_MAX;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (CUM[mid] <= xp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function advProgress(xp: number): { level: number; into: number; need: number } {
  const level = advLevel(xp);
  if (level >= ADV_MAX) return { level, into: 1, need: 1 };
  return { level, into: xp - CUM[level], need: CUM[level + 1] - CUM[level] };
}

/** Gold to take on the next adventurer. Each one costs far more than the last. */
export function hireCost(hired: number): number {
  return Math.round(2500 * 4.2 ** hired);
}

// ── The depth ladder ─────────────────────────────────────────
/** Every tenth depth is a boss: far stronger, slower, and the only guaranteed source of relics. */
export const BOSS_EVERY = 10;
export const isBossDepth = (depth: number): boolean => depth > 0 && depth % BOSS_EVERY === 0;

/** Party power a depth demands. Grows forever; hero levels alone never keep up. */
export function delveReq(depth: number): number {
  return 30 * 1.18 ** depth * (isBossDepth(depth) ? 2.2 : 1);
}

/** Seconds a delve to this depth takes at 1× delve speed. */
export function delveTime(depth: number): number {
  return 100 * 1.04 ** depth * (isBossDepth(depth) ? 1.5 : 1);
}

/** Odds the party comes back victorious, from how far its power exceeds what the depth demands. */
export function delveOdds(power: number, depth: number): number {
  const r = power / delveReq(depth);
  return Math.max(0.05, Math.min(0.95, 0.05 + ((r - 0.5) / 1.5) * 0.9));
}

/** XP each adventurer earns from a depth. */
export function delveXp(depth: number): number {
  return 6 + depth * 1.5;
}

/** Gold a successful delve pays. */
export function delveGold(depth: number): number {
  return Math.round(100 * 1.18 ** depth);
}

/** Seconds an injured adventurer sits out after a failed delve. */
export function injuryRest(depth: number, mend: number): number {
  return Math.round((90 + depth * 5) * (1 - Math.min(0.8, mend)));
}

// ── What comes back ──────────────────────────────────────────
export interface DelveDrop {
  id: string;
  min: number;
  max: number;
  chance: number;
  depth: number; // first depth it can appear at
}

export const DELVE_DROPS: DelveDrop[] = [
  { id: 'clearwater', min: 3, max: 8, chance: 0.8, depth: 1 },
  { id: 'quartz', min: 2, max: 5, chance: 0.7, depth: 1 },
  { id: 'batwing', min: 2, max: 5, chance: 0.5, depth: 3 },
  { id: 'crystal', min: 1, max: 3, chance: 0.5, depth: 5 },
  { id: 'arcanedust', min: 4, max: 10, chance: 0.5, depth: 8 },
  { id: 'relic', min: 1, max: 2, chance: 0.35, depth: 10 },
  { id: 'ironore', min: 2, max: 5, chance: 0.4, depth: 12 },
  { id: 'ectoplasm', min: 1, max: 3, chance: 0.35, depth: 15 },
  { id: 'stardust', min: 1, max: 3, chance: 0.35, depth: 20 },
  { id: 'soulink', min: 1, max: 2, chance: 0.25, depth: 24 },
  { id: 'wyrmscale', min: 1, max: 3, chance: 0.3, depth: 26 },
  { id: 'phoenix', min: 1, max: 2, chance: 0.2, depth: 32 },
  { id: 'voidessence', min: 1, max: 3, chance: 0.4, depth: 36 },
];

/** Quantity multiplier on everything a delve brings back, from how deep it went. */
export function haulMult(depth: number): number {
  return 1 + depth * 0.09;
}

// ── Supplies ─────────────────────────────────────────────────
/**
 * Power a single supplied potion adds, as a share of the party's own strength. Potency already folds in
 * the potion belt bonuses, the potion's proficiency and — the point of all this — its quality tier.
 */
export const SUPPLY_WEIGHT = 0.28;

/**
 * Bottles of each kitted potion a delve drinks: one per adventurer, and another round for every ten
 * depths. The deeper the company goes, the harder your cauldrons have to work to keep it going — which
 * is the whole reason the Rift hangs off brewing rather than standing on its own.
 */
export function supplyNeed(party: number, depth: number): number {
  return party * (1 + Math.floor(depth / 10));
}

/** Guard lost when the party goes down with nothing in the kit. Not a penalty for the empty slots, only for empty hands. */
export const UNSUPPLIED_GUARD = 0.7;

const e = (stat: StatKey, value: number): Effect => ({ stat, value });

/** Bonuses the whole workshop earns from a mapped Rift, applied in computeMods. */
export function depthEffects(depth: number): Effect[] {
  const bands = Math.floor(depth / 5);
  return bands > 0 ? [e('rareFind', 0.05 * bands), e('scavYield', 0.03 * bands)] : [];
}

/** Is the company chartered yet? Used by the tab, the goal and the bot. */
export const companyOpen = (s: GameState, m: Mods): boolean => m.partySlots >= 1 || (s.party?.roster.length ?? 0) > 0;
