import { PLANTS } from './plants';
import { RECIPES } from './recipes';
import { REAGENTS } from './spells';
import { FORGE_TIERS } from './gear';
import { DUNGEON_MAP } from './combat';
import { item } from './items';

export type ProfKind = 'plant' | 'potion' | 'reagent' | 'forge';

/** Bonuses a proficiency grants; milestones add to these. */
export interface ProfBonus {
  speed: number; // +x production speed (grow/brew)
  yield: number; // flat extra output per action
  double: number; // chance of +1 extra output
  value: number; // +x sell value
  save: number; // chance the inputs are refunded
  cost: number; // −x planting / forging cost
  luck: number; // +x forge rarity luck
  minRarity: number; // raises the forge's guaranteed rarity
  potency: number; // +x combat effect of this potion
  market: number; // +x market depth (demand falls slower when selling)
}

export interface Milestone {
  level: number;
  label: string;
  bonus: Partial<ProfBonus>;
}

export const PROF_MAX = 100;
export const PROF_KIND_INFO: Record<ProfKind, { name: string; icon: string; verb: string }> = {
  plant: { name: 'Herbalism', icon: '🌱', verb: 'per harvest' },
  potion: { name: 'Brewing', icon: '⚗️', verb: 'per brew' },
  reagent: { name: 'Scribing', icon: '🖋️', verb: 'per reagent crafted' },
  forge: { name: 'Forging', icon: '⚒️', verb: 'per item forged' },
};

const M = (level: number, label: string, bonus: Partial<ProfBonus>): Milestone => ({ level, label, bonus });

export const MILESTONES: Record<ProfKind, Milestone[]> = {
  plant: [
    M(10, '10% faster growth', { speed: 0.1 }),
    M(20, '+1 herb per harvest', { yield: 1 }),
    M(30, '−20% planting cost', { cost: 0.2 }),
    M(40, '15% faster growth', { speed: 0.15 }),
    M(50, '+1 herb per harvest', { yield: 1 }),
    M(60, '+25% herb value', { value: 0.25 }),
    M(70, '20% faster growth', { speed: 0.2 }),
    M(80, '20% chance of a bonus herb', { double: 0.2 }),
    M(90, '−30% planting cost', { cost: 0.3 }),
    M(100, 'Perfect Bloom: +2 herbs per harvest', { yield: 2 }),
  ],
  potion: [
    M(10, '10% faster brewing', { speed: 0.1 }),
    M(20, '+15% sell value', { value: 0.15 }),
    M(30, '10% chance of an extra potion', { double: 0.1 }),
    M(40, '15% faster brewing, wider market', { speed: 0.15, market: 0.5 }),
    M(50, '+1 potion per brew', { yield: 1 }),
    M(60, '+25% value, +15% combat potency', { value: 0.25, potency: 0.15 }),
    M(70, '20% faster brewing', { speed: 0.2 }),
    M(80, '15% chance ingredients are refunded', { save: 0.15 }),
    M(90, '+35% value, much wider market', { value: 0.35, market: 1 }),
    M(100, 'Perfected: +1 potion per brew, +25% potency', { yield: 1, potency: 0.25 }),
  ],
  reagent: [
    M(10, '10% chance of a bonus reagent', { double: 0.1 }),
    M(20, '10% chance materials are refunded', { save: 0.1 }),
    M(30, '+1 reagent per craft', { yield: 1 }),
    M(40, '+10% bonus reagent chance', { double: 0.1 }),
    M(50, '+25% reagent value', { value: 0.25 }),
    M(60, '+10% refund chance', { save: 0.1 }),
    M(70, '+1 reagent per craft', { yield: 1 }),
    M(80, '+15% bonus reagent chance', { double: 0.15 }),
    M(90, '+15% refund chance', { save: 0.15 }),
    M(100, 'Arch-Scribe: +2 reagents per craft', { yield: 2 }),
  ],
  forge: [
    M(10, '−10% forging cost', { cost: 0.1 }),
    M(20, '+25% rarity luck', { luck: 0.25 }),
    M(30, '−10% forging cost', { cost: 0.1 }),
    M(40, '+25% rarity luck', { luck: 0.25 }),
    M(50, 'Always Rare or better', { minRarity: 1 }),
    M(60, '−10% forging cost', { cost: 0.1 }),
    M(70, '+50% rarity luck', { luck: 0.5 }),
    M(80, '−10% forging cost', { cost: 0.1 }),
    M(90, '+100% rarity luck', { luck: 1 }),
    M(100, 'Master Smith: always Epic or better', { minRarity: 1 }),
  ],
};

export interface ProfDef {
  id: string; // plant id, potion id, reagent id, or 'forgeN'
  name: string;
  icon: string;
  kind: ProfKind;
  xp: number; // proficiency XP per action — scaled by production time so every item levels at a similar pace
  level: number; // player level that unlocks it
}

export const PROFS: ProfDef[] = [
  ...PLANTS.map((p): ProfDef => ({ id: p.id, name: p.name, icon: item(p.herb).icon, kind: 'plant', xp: p.time / 20, level: p.level })),
  ...RECIPES.map((r): ProfDef => ({ id: r.id, name: r.name, icon: r.icon, kind: 'potion', xp: r.time / 15, level: r.level })),
  ...REAGENTS.map((r): ProfDef => ({ id: r.id, name: item(r.id).name, icon: item(r.id).icon, kind: 'reagent', xp: Math.max(0.5, item(r.id).value / 40), level: r.level })),
  ...FORGE_TIERS.map((f): ProfDef => ({ id: `forge${f.tier}`, name: `Forging · Tier ${f.tier}`, icon: '⚒️', kind: 'forge', xp: 3 * f.tier, level: DUNGEON_MAP[f.dungeon].level })),
];

export const PROF_MAP: Record<string, ProfDef> = Object.fromEntries(PROFS.map((p) => [p.id, p]));

/** XP from level L to L+1. Early milestones come quickly; the total to reach 100 is ~450K XP — dozens of hours per item. */
export function profXpToNext(level: number): number {
  return Math.floor(12 * 1.085 ** (level - 1));
}

/** CUM[L] = total XP needed to reach level L. */
const CUM: number[] = [0, 0];
for (let L = 1; L < PROF_MAX; L++) CUM[L + 1] = CUM[L] + profXpToNext(L);

export function profLevel(xp: number): number {
  let lo = 1;
  let hi = PROF_MAX;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (CUM[mid] <= xp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function profProgress(xp: number): { level: number; into: number; need: number } {
  const level = profLevel(xp);
  if (level >= PROF_MAX) return { level, into: 1, need: 1 };
  return { level, into: xp - CUM[level], need: CUM[level + 1] - CUM[level] };
}

export function emptyBonus(): ProfBonus {
  return { speed: 0, yield: 0, double: 0, value: 0, save: 0, cost: 0, luck: 0, minRarity: 0, potency: 0, market: 0 };
}

export function profBonus(kind: ProfKind, level: number): ProfBonus {
  const b = emptyBonus();
  for (const ms of MILESTONES[kind]) {
    if (ms.level > level) break;
    for (const [k, v] of Object.entries(ms.bonus)) b[k as keyof ProfBonus] += v as number;
  }
  return b;
}

export function nextMilestone(kind: ProfKind, level: number): Milestone | null {
  return MILESTONES[kind].find((ms) => ms.level > level) ?? null;
}

export function describeBonus(b: ProfBonus): string {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const parts: string[] = [];
  if (b.speed) parts.push(`+${pct(b.speed)} speed`);
  if (b.yield) parts.push(`+${b.yield} output`);
  if (b.double) parts.push(`${pct(b.double)} bonus chance`);
  if (b.value) parts.push(`+${pct(b.value)} value`);
  if (b.save) parts.push(`${pct(b.save)} refund chance`);
  if (b.cost) parts.push(`−${pct(b.cost)} cost`);
  if (b.luck) parts.push(`+${pct(b.luck)} rarity luck`);
  if (b.minRarity) parts.push(`+${b.minRarity} min rarity`);
  if (b.potency) parts.push(`+${pct(b.potency)} potency`);
  if (b.market) parts.push(`+${pct(b.market)} market depth`);
  return parts.join(', ') || 'No bonuses yet — first milestone at level 10';
}
