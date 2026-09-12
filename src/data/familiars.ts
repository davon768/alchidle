/**
 * Familiars: companions found on expeditions, levelled by feeding them potions, each granting a passive
 * bonus while equipped.
 *
 * They are deliberately a *sink* placed between three systems that already exist — exploration finds
 * them, brewing feeds them, and their bonuses land in `computeMods` alongside everything else. Feeding
 * a finer potion is worth more, so quality gets another use beyond the market.
 *
 * Bonuses arrive in milestones every 5 levels rather than as a trickle per level, matching the rest of
 * the game's progression.
 */
import type { Effect } from '../core/types';

export interface FamiliarDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  zone: string; // where it is found
  chance: number; // per completed expedition in that zone, before rareFind
  /** Granted once per completed milestone, so a level-20 familiar has four of these applied. */
  milestone: Effect[];
  flavor: string;
}

/** Levels are milestones: one every this many, up to FAMILIAR_MAX. */
export const FAMILIAR_STEP = 5;
export const FAMILIAR_MAX = 50;
/** Milestones a familiar has earned at a given level. */
export const milestonesAt = (level: number): number => Math.floor(Math.min(level, FAMILIAR_MAX) / FAMILIAR_STEP);

export const FAMILIARS: FamiliarDef[] = [
  { id: 'fam_cat', name: 'Hearth Cat', icon: '🐈', zone: 'meadow', chance: 0.04,
    desc: 'Sleeps by the cauldron and somehow the brew comes out better.',
    milestone: [{ stat: 'brewSpeed', value: 0.05 }, { stat: 'brewQuality', value: 0.02 }],
    flavor: 'Purrs at precisely the right moment.' },
  { id: 'fam_raven', name: 'Ledger Raven', icon: '🐦‍⬛', zone: 'forest', chance: 0.035,
    desc: 'Counts coins better than you do.',
    milestone: [{ stat: 'sellPrice', value: 0.05 }, { stat: 'tradeBonus', value: 0.03 }],
    flavor: 'Has opinions about your pricing.' },
  { id: 'fam_sprite', name: 'Garden Sprite', icon: '🧚', zone: 'meadow', chance: 0.03,
    desc: 'Tends the beds while nobody is looking.',
    milestone: [{ stat: 'growSpeed', value: 0.06 }, { stat: 'mutationChance', value: 0.08 }],
    flavor: 'Leaves tiny footprints in the soil.' },
  { id: 'fam_salamander', name: 'Ember Salamander', icon: '🦎', zone: 'caves', chance: 0.03,
    desc: 'Keeps the fire exactly where it should be.',
    milestone: [{ stat: 'attack', value: 4 }, { stat: 'critChance', value: 0.01 }],
    flavor: 'Warm to the touch. Do not touch.' },
  { id: 'fam_owl', name: 'Archive Owl', icon: '🦉', zone: 'ruins', chance: 0.025,
    desc: 'Reads over your shoulder and turns pages early.',
    milestone: [{ stat: 'researchSpeed', value: 0.08 }, { stat: 'xpGain', value: 0.03 }],
    flavor: 'Judges your filing system.' },
  { id: 'fam_homunculus', name: 'Homunculus', icon: '👺', zone: 'spine', chance: 0.02,
    desc: 'You made it. It has notes.',
    milestone: [{ stat: 'doubleBrew', value: 0.02 }, { stat: 'ingredientSave', value: 0.02 }],
    flavor: 'Insists it was a collaboration.' },
  { id: 'fam_wisp', name: 'Star Wisp', icon: '🌟', zone: 'observatory', chance: 0.02,
    desc: 'A fragment of something that fell.',
    milestone: [{ stat: 'rareFind', value: 0.06 }, { stat: 'spellPower', value: 5 }],
    flavor: 'Hums when the sky is clear.' },
];

export const FAMILIAR_MAP: Record<string, FamiliarDef> = Object.fromEntries(FAMILIARS.map((f) => [f.id, f]));
export const familiarsOfZone = (zone: string): FamiliarDef[] => FAMILIARS.filter((f) => f.zone === zone);

// ── Feeding ──────────────────────────────────────────────────
/**
 * XP from feeding one potion. Scales with the potion's base value so late recipes stay relevant, and
 * with its quality tier so a Masterwork is worth feeding rather than selling.
 */
export function feedXp(potionValue: number, qualityMult: number): number {
  return Math.max(1, Math.sqrt(potionValue) * qualityMult);
}

/** XP from level L to L+1. Reaching 50 is a long grind, in keeping with proficiency. */
export function familiarXpToNext(level: number): number {
  return Math.floor(20 * 1.16 ** (level - 1));
}

const CUM: number[] = [0, 0];
for (let L = 1; L < FAMILIAR_MAX; L++) CUM[L + 1] = CUM[L] + familiarXpToNext(L);

export function familiarLevel(xp: number): number {
  let lo = 1;
  let hi = FAMILIAR_MAX;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (CUM[mid] <= xp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function familiarProgress(xp: number): { level: number; into: number; need: number } {
  const level = familiarLevel(xp);
  if (level >= FAMILIAR_MAX) return { level, into: 1, need: 1 };
  return { level, into: xp - CUM[level], need: CUM[level + 1] - CUM[level] };
}

/** Everything an equipped familiar currently contributes. */
export function familiarEffects(def: FamiliarDef, level: number): Effect[] {
  const n = milestonesAt(level);
  return n <= 0 ? [] : def.milestone.map((e) => ({ stat: e.stat, value: e.value * n }));
}
