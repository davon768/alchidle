/**
 * Plant cross-breeding. A ripe plot whose neighbour holds a *different* herb can throw a mutated seed:
 * the same herb, carrying one trait. Seeds are consumable — a trait lasts for the planting it was sown from — but every plant × trait pair you discover is recorded permanently in the seed catalogue, and
 * the catalogue itself pays a small standing bonus. That is what makes collecting all of them worth it.
 */
import type { Effect } from '../core/types';

export interface TraitDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
}

export const TRAITS: TraitDef[] = [
  { id: 'swift', name: 'Swift', icon: '💨', color: '#7fd8ff', desc: 'Grows 40% faster.' },
  { id: 'bountiful', name: 'Bountiful', icon: '🧺', color: '#5fd068', desc: '+2 herbs per harvest.' },
  { id: 'radiant', name: 'Radiant', icon: '🌟', color: '#f5d76e', desc: '35% chance of a bonus herb.' },
  { id: 'hardy', name: 'Hardy', icon: '🪨', color: '#c9d6ff', desc: 'Costs nothing to sow, and its replant is free too.' },
];

export const TRAIT_MAP: Record<string, TraitDef> = Object.fromEntries(TRAITS.map((t) => [t.id, t]));

/** Base chance that harvesting a plot beside a different herb yields a mutated seed. */
export const CROSS_CHANCE = 0.02;

/** Seed keys are `plantId:trait`. */
export const seedKey = (plantId: string, trait: string): string => `${plantId}:${trait}`;
export function parseSeed(key: string): { plantId: string; trait: string } {
  const [plantId, trait] = key.split(':');
  return { plantId, trait };
}

/**
 * How strong a strain is at a given rank. The first seed of a strain puts it in a bed; every seed after
 * that deepens the strain itself, and every bed carrying it gets the benefit.
 *
 * This exists because seeds outgrow their use otherwise. A mature garden throws thousands of seeds a day
 * against a handful of beds, so without somewhere for the surplus to go the tray just fills up — which is
 * exactly what it used to do. The curve is logarithmic: always worth another seed, never running away.
 */
export function strainStrength(rank: number): number {
  return 1 + 0.35 * Math.log2(Math.max(1, rank));
}

/** What a trait does to the plot it is sown in. */
export interface TraitEffect {
  speed: number; // multiplies growth rate
  yield: number; // flat extra herbs
  double: number; // chance of a bonus herb
  free: boolean; // sowing (and the automatic replant after harvest) costs no gold
}

export function traitEffect(trait: string | null, rank = 1): TraitEffect {
  const st = strainStrength(rank);
  switch (trait) {
    case 'swift': return { speed: 1 + 0.4 * st, yield: 0, double: 0, free: false };
    case 'bountiful': return { speed: 1, yield: 2 * st, double: 0, free: false };
    case 'radiant': return { speed: 1, yield: 0, double: Math.min(1, 0.35 * st), free: false };
    // Hardy pays in gold saved, which cannot grow past free — so its deeper ranks pay in herbs instead,
    // or every Hardy seed after the first would be worth nothing.
    case 'hardy': return { speed: 1, yield: 0.8 * (st - 1), double: 0, free: true };
    default: return { speed: 1, yield: 0, double: 0, free: false };
  }
}

/** Traits described with their current rank folded in, for the tray and the plot badges. */
export function describeTrait(trait: string, rank: number): string {
  const e = traitEffect(trait, rank);
  switch (trait) {
    case 'swift': return `Grows ${Math.round((e.speed - 1) * 100)}% faster.`;
    case 'bountiful': return `+${e.yield.toFixed(1)} herbs per harvest.`;
    case 'radiant': return `${Math.round(e.double * 100)}% chance of a bonus herb.`;
    case 'hardy': return `Free to sow and free to replant${e.yield > 0.05 ? `, +${e.yield.toFixed(1)} herbs per harvest` : ''}.`;
    default: return '';
  }
}

/** Every plant × trait pair recorded in the catalogue pays this, forever. */
export const CATALOGUE_BONUS: Effect[] = [
  { stat: 'growSpeed', value: 0.01 },
  { stat: 'harvestYield', value: 0.01 },
];
