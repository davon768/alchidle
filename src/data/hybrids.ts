/**
 * Hybrid herbs: the plants you can only get by discovering them.
 *
 * The seed tray used to be a shelf. Mutated seeds accumulated, you sowed them into beds, and that was the
 * whole of it — no decision, nothing to aim at. Crossing gives the tray a job: **a cross is paid for in
 * seeds**, one carrying each parent herb, so every seed is now either a strain rank or crossing material
 * and the player has to choose which.
 *
 * Two rules shape the list:
 *
 * - **You never start knowing a recipe.** A cross has to be learned from a torn journal page, turned up by
 *   expeditions, dungeon bosses and finished studies. That makes the garden depend on the rest of the
 *   game rather than sitting beside it, and it means a hybrid is something you *found*, not something the
 *   level curve handed you.
 * - **What you learn is permanent.** The Great Work unmakes the garden, the seeds and the strains, but not
 *   the knowledge: a recipe once read stays read, and a hybrid once discovered stays plantable. Knowledge
 *   is not stock. This is the one thing outside the ascension tree that survives a rebirth, and it is
 *   deliberate — re-finding the same journal page every run would be a chore, not a challenge.
 *
 * Hybrids are interleaved through the level curve rather than bunched at the end, so there is something
 * to hunt at most stages of a run.
 */
import type { GameState } from '../core/types';
import { TRAIT_MAP, parseSeed } from './mutations';

export interface HybridDef {
  /** The plant (and herb) this produces — both carry this id, as every other plant does. */
  id: string;
  name: string;
  /** The two parent plant ids. Order never matters. */
  parents: [string, string];
  /** Player level needed to attempt the cross. */
  level: number;
  /** Seconds the cross takes at 1×. */
  time: number;
  /** What the journal page says when you find it, before you have made the cross. */
  hint: string;
}

export const HYBRIDS: HybridDef[] = [
  { id: 'dawnpetal', name: 'Dawnpetal', parents: ['sunleaf', 'moonpetal'], level: 6, time: 120,
    hint: 'Sun and moon in one bed. The commonest pairing in the book, and the first any gardener tries.' },
  { id: 'emberfrost', name: 'Emberfrost', parents: ['emberroot', 'frostcap'], level: 16, time: 300,
    hint: 'Fire root beside cold cap. They should kill each other. They do not.' },
  { id: 'dreamroot', name: 'Dreamroot', parents: ['mandrake', 'dreamlotus'], level: 24, time: 600,
    hint: 'The screaming root and the sleeping flower, grafted while both are dormant.' },
  { id: 'thornlotus', name: 'Thornlotus', parents: ['dreamlotus', 'bloodthorn'], level: 30, time: 900,
    hint: 'A lotus that bites. Handle the seedlings with gloves.' },
  { id: 'starhazel', name: 'Starhazel', parents: ['starbloom', 'witchhazel'], level: 44, time: 1800,
    hint: 'Hazel cut under a bloom of stars, and only then.' },
  { id: 'voidlily', name: 'Voidlily', parents: ['voidvine', 'ashlily'], level: 60, time: 3000,
    hint: 'Ash and absence. The bed it grows in stays cold for a season afterwards.' },
  { id: 'mirrorthistle', name: 'Mirror Thistle', parents: ['mirrorbloom', 'soulthistle'], level: 76, time: 4800,
    hint: 'It shows you the garden as it would have been. Do not plant two side by side.' },
  { id: 'glassbloom', name: 'Glassbloom', parents: ['glassfern', 'eternabloom'], level: 92, time: 7200,
    hint: 'The last page in the book, and the only one written in a hand nobody recognises.' },
];

export const HYBRID_MAP: Record<string, HybridDef> = Object.fromEntries(HYBRIDS.map((h) => [h.id, h]));

/** Every plant id that only exists through a cross, so the garden can hide them until they are found. */
export const HYBRID_PLANTS = new Set(HYBRIDS.map((h) => h.id));

/** Herbs needed of each parent, alongside the two seeds. Scales with what the hybrid is worth. */
export function crossHerbCost(h: HybridDef): number {
  return 20 + h.level;
}

/** The cross a pair of parents makes, in either order, or null. */
export function hybridFor(a: string, b: string): HybridDef | null {
  return HYBRIDS.find((h) => (h.parents[0] === a && h.parents[1] === b)
    || (h.parents[0] === b && h.parents[1] === a)) ?? null;
}

/**
 * What the two seeds you feed the bench are worth beyond simply being consumed.
 *
 * This is the whole reason the tray matters now: a seed spent here is a seed not spent on a strain rank,
 * and *which* seed you spend changes the outcome. Both seeds contribute, so a pairing is a real choice.
 */
export interface CrossBonus {
  /** Multiplier on the time the cross takes. */
  speed: number;
  /** Mutated seeds of the *new* hybrid handed over on success — a head start on its strain. */
  seeds: number;
  /** Whether the parent herbs are refunded. */
  refund: boolean;
  notes: string[];
}

export function crossBonus(seedA: string, seedB: string): CrossBonus {
  const out: CrossBonus = { speed: 1, seeds: 0, refund: false, notes: [] };
  for (const key of [seedA, seedB]) {
    if (!key) continue;
    const trait = parseSeed(key).trait;
    const def = TRAIT_MAP[trait];
    if (!def) continue;
    if (trait === 'swift') { out.speed *= 0.65; out.notes.push(`${def.icon} Swift — the cross takes 35% less time`); }
    if (trait === 'bountiful') { out.seeds += 2; out.notes.push(`${def.icon} Bountiful — 2 seeds of the new strain`); }
    if (trait === 'radiant') { out.seeds += 1; out.notes.push(`${def.icon} Radiant — a seed of the new strain`); }
    if (trait === 'hardy') { out.refund = true; out.notes.push(`${def.icon} Hardy — the parent herbs are not consumed`); }
  }
  return out;
}

/** Crosses the player has read about but not yet made, and can attempt now. */
export function knownCrosses(s: GameState): HybridDef[] {
  return HYBRIDS.filter((h) => s.clues?.[h.id] && !s.codex?.[h.id]);
}

/** How much of the book has been written, for the panel header. */
export function codexProgress(s: GameState): { found: number; known: number; total: number } {
  return {
    found: HYBRIDS.filter((h) => s.codex?.[h.id]).length,
    known: HYBRIDS.filter((h) => s.clues?.[h.id]).length,
    total: HYBRIDS.length,
  };
}
