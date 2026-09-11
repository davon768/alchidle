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

/** What a trait does to the plot it is sown in. */
export interface TraitEffect {
  speed: number; // multiplies growth rate
  yield: number; // flat extra herbs
  double: number; // chance of a bonus herb
  free: boolean; // sowing (and the automatic replant after harvest) costs no gold
}

export function traitEffect(trait: string | null): TraitEffect {
  switch (trait) {
    case 'swift': return { speed: 1.4, yield: 0, double: 0, free: false };
    case 'bountiful': return { speed: 1, yield: 2, double: 0, free: false };
    case 'radiant': return { speed: 1, yield: 0, double: 0.35, free: false };
    case 'hardy': return { speed: 1, yield: 0, double: 0, free: true };
    default: return { speed: 1, yield: 0, double: 0, free: false };
  }
}

/** Every plant × trait pair recorded in the catalogue pays this, forever. */
export const CATALOGUE_BONUS: Effect[] = [
  { stat: 'growSpeed', value: 0.01 },
  { stat: 'harvestYield', value: 0.01 },
];
