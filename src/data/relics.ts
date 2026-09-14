/**
 * Rift relics: what the boss at every tenth depth is guarding.
 *
 * A relic is not a piece of gear — nothing equips it, nothing drops it twice for nothing. Each one is a
 * permanent rank you keep forever, ascension included, and pulling the same relic again raises its rank
 * instead of cluttering the bag. Deeper bosses put deeper relics into the pool, so the tenth boss is
 * still worth fighting when you have beaten forty.
 */
import type { Effect, StatKey } from '../core/types';

export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  depth: number; // shallowest depth whose boss can be holding it
  effects: Effect[]; // per rank
  flavor: string;
}

const e = (stat: StatKey, value: number): Effect => ({ stat, value });

export const RELICS: RelicDef[] = [
  { id: 'r_wardstone', name: 'Ward Stone', icon: '🗿', depth: 10,
    desc: 'A boundary marker from something that had boundaries.',
    effects: [e('partyPower', 0.07)], flavor: 'Warm on the side that faces down.' },
  { id: 'r_hourglass', name: 'Cracked Hourglass', icon: '⏳', depth: 10,
    desc: 'The sand falls a little faster than it should.',
    effects: [e('delveSpeed', 0.06), e('brewSpeed', 0.03)], flavor: 'Nobody has found the other half.' },
  { id: 'r_seal', name: "Merchant's Seal", icon: '🪙', depth: 10,
    desc: 'Pressed into wax by a house that no longer exists.',
    effects: [e('sellPrice', 0.05), e('tradeBonus', 0.04)], flavor: 'Still opens doors. Somehow.' },
  { id: 'r_compass', name: 'Riftcompass', icon: '🧭', depth: 20,
    desc: 'Points down, always, whichever way down is today.',
    effects: [e('partyPower', 0.06), e('scavSpeed', 0.05)], flavor: 'The needle hums when you get close.' },
  { id: 'r_beads', name: 'Beadstring of Focus', icon: '📿', depth: 20,
    desc: 'Counting them steadies the hands at the cauldron.',
    effects: [e('brewQuality', 0.03), e('partyPower', 0.03)], flavor: 'One bead short. Always one bead short.' },
  { id: 'r_phial', name: 'Everfull Phial', icon: '⚗️', depth: 30,
    desc: 'Carries one more supply than the packs can hold.',
    effects: [e('kitSlots', 1)], flavor: 'Empty. Heavy. Both at once.' },
  { id: 'r_sigil', name: 'Void Sigil', icon: '🜛', depth: 30,
    desc: 'Drawn in a hand that had too many fingers.',
    effects: [e('partyPower', 0.09), e('rareFind', 0.06)], flavor: 'Do not copy it out. Do not.' },
  { id: 'r_banner', name: 'Banner of the Lost Company', icon: '🏴', depth: 40,
    desc: 'Someone got this far before you. This is all that came back.',
    effects: [e('partyPower', 0.08), e('partySlots', 1)], flavor: 'Six names stitched in. Six.' },
  { id: 'r_crown', name: 'Crown of the Deep', icon: '👑', depth: 50,
    desc: 'It was a crown before the Rift got hold of it.',
    effects: [e('partyPower', 0.12), e('delveSpeed', 0.05), e('stoneGain', 0.05)],
    flavor: 'Fits anyone. That is the unsettling part.' },
];

export const RELIC_MAP: Record<string, RelicDef> = Object.fromEntries(RELICS.map((r) => [r.id, r]));

/** Everything a relic contributes at its current rank. */
export function relicEffects(def: RelicDef, rank: number): Effect[] {
  return def.effects.map((x) => ({ stat: x.stat, value: x.value * rank }));
}

/**
 * Which relic a boss at this depth is holding. Deeper bosses can still hand over shallow relics — that is
 * what keeps ranks climbing — but the newest relic in reach is three times as likely as the oldest.
 */
export function rollRelic(depth: number, rnd = Math.random): RelicDef | null {
  const pool = RELICS.filter((r) => r.depth <= depth);
  if (pool.length === 0) return null;
  const weights = pool.map((r) => 1 + 2 * (r.depth / Math.max(1, depth)));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rnd() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
