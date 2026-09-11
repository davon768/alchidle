import type { Apprentice, Effect, RoleId, StatKey } from '../core/types';
import type { ProfKind } from './proficiency';

export type { RoleId };

export interface RolePerk {
  level: number;
  effects: Effect[];
}

export interface RoleDef {
  id: RoleId;
  name: string;
  icon: string;
  level: number; // player level that unlocks the role
  desc: string;
  unit: string;
  capacity: (level: number) => number; // how many plots / cauldrons / parties / potion types / rituals one apprentice handles
  mentor?: ProfKind; // your proficiency in this craft speeds up their training
  perks: RolePerk[]; // every 5 levels, while working
  master: Effect[]; // permanent bonus when they graduate (× talent)
}

const e = (stat: StatKey, value: number): Effect => ({ stat, value });
const perks = (list: [number, Effect][]): RolePerk[] => list.map(([level, eff]) => ({ level, effects: [eff] }));

export const ROLES: RoleDef[] = [
  { id: 'gardener', name: 'Gardener', icon: '🧑‍🌾', level: 3, unit: 'plot', mentor: 'plant',
    desc: 'Harvests and replants the plots they tend.', capacity: (L) => 2 + Math.floor(L / 3),
    perks: perks([[5, e('growSpeed', 0.05)], [10, e('harvestYield', 0.08)], [15, e('seedDiscount', 0.05)], [20, e('growSpeed', 0.08)], [25, e('harvestYield', 0.1)],
      [30, e('growSpeed', 0.1)], [35, e('harvestYield', 0.12)], [40, e('seedDiscount', 0.1)], [45, e('growSpeed', 0.12)], [50, e('harvestYield', 0.2)]]),
    master: [e('growSpeed', 0.04), e('harvestYield', 0.04)] },
  { id: 'brewer', name: 'Brewer', icon: '🧑‍🔬', level: 3, unit: 'cauldron', mentor: 'potion',
    desc: 'Keeps the cauldrons they tend on 🔁 repeat.', capacity: (L) => 1 + Math.floor(L / 6),
    perks: perks([[5, e('brewSpeed', 0.05)], [10, e('doubleBrew', 0.02)], [15, e('ingredientSave', 0.02)], [20, e('brewSpeed', 0.08)], [25, e('doubleBrew', 0.03)],
      [30, e('brewSpeed', 0.1)], [35, e('ingredientSave', 0.03)], [40, e('doubleBrew', 0.04)], [45, e('brewSpeed', 0.12)], [50, e('masteryRate', 0.15)]]),
    master: [e('brewSpeed', 0.04), e('doubleBrew', 0.01)] },
  { id: 'scout', name: 'Scout', icon: '🧝', level: 5, unit: 'party',
    desc: 'Sends the expedition parties they tend back out on 🔁 repeat.', capacity: (L) => 1 + Math.floor(L / 12),
    perks: perks([[5, e('scavSpeed', 0.05)], [10, e('scavYield', 0.08)], [15, e('rareFind', 0.1)], [20, e('scavSpeed', 0.08)], [25, e('scavYield', 0.1)],
      [30, e('rareFind', 0.15)], [35, e('scavSpeed', 0.1)], [40, e('scavYield', 0.12)], [45, e('rareFind', 0.2)], [50, e('scavSpeed', 0.15)]]),
    master: [e('scavSpeed', 0.04), e('scavYield', 0.04)] },
  { id: 'shopkeeper', name: 'Shopkeeper', icon: '🧑‍💼', level: 6, unit: 'potion type',
    desc: 'Auto-sells the potion types you mark in the Market as they finish brewing.', capacity: (L) => 1 + Math.floor(L / 5),
    perks: perks([[5, e('sellPrice', 0.03)], [10, e('demandRecovery', 0.1)], [15, e('tradeBonus', 0.05)], [20, e('sellPrice', 0.05)], [25, e('contractReward', 0.08)],
      [30, e('demandRecovery', 0.15)], [35, e('sellPrice', 0.07)], [40, e('tradeBonus', 0.1)], [45, e('repGain', 0.1)], [50, e('sellPrice', 0.12)]]),
    master: [e('sellPrice', 0.03), e('tradeBonus', 0.02)] },
  { id: 'squire', name: 'Squire', icon: '🤺', level: 10, unit: 'dungeon',
    desc: 'After you retreat from a floor, turns auto-advance back on to push deeper again.', capacity: () => 1,
    perks: perks([[5, e('attackMult', 0.04)], [10, e('defenseMult', 0.04)], [15, e('potionPower', 0.05)], [20, e('hpMult', 0.06)], [25, e('lootFind', 0.08)],
      [30, e('attackMult', 0.06)], [35, e('critChance', 0.02)], [40, e('defenseMult', 0.06)], [45, e('lootFind', 0.1)], [50, e('potionPower', 0.12)]]),
    master: [e('attackMult', 0.03), e('hpMult', 0.03)] },
  { id: 'scribe', name: 'Scribe', icon: '🧙', level: 12, unit: 'ritual', mentor: 'reagent',
    desc: 'Recasts the rituals you mark as Auto whenever they expire.', capacity: (L) => 1 + Math.floor(L / 10),
    perks: perks([[5, e('manaRegen', 0.2)], [10, e('maxMana', 20)], [15, e('spellMult', 0.05)], [20, e('manaRegen', 0.3)], [25, e('xpGain', 0.05)],
      [30, e('maxMana', 40)], [35, e('spellMult', 0.08)], [40, e('manaRegen', 0.5)], [45, e('masteryRate', 0.08)], [50, e('spellMult', 0.12)]]),
    master: [e('manaRegen', 0.2), e('spellMult', 0.03)] },
];

export const ROLE_MAP: Record<RoleId, RoleDef> = Object.fromEntries(ROLES.map((r) => [r.id, r])) as Record<RoleId, RoleDef>;

/** Talent sets an apprentice's level cap (and so how many perks they can reach), learning speed, hiring cost and master bonus. */
export const TALENTS = [
  { name: 'Common', color: '#b8b3c8', cap: 25, xp: 1, cost: 1, weight: 70, master: 1 },
  { name: 'Gifted', color: '#4fb3ff', cap: 40, xp: 1.25, cost: 3, weight: 25, master: 1.6 },
  { name: 'Prodigy', color: '#ff9f43', cap: 50, xp: 1.5, cost: 8, weight: 5, master: 2.5 },
];

export interface TraitDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  role?: RoleId; // role-affinity traits only apply in that role
  xp?: number; // +x XP from everything
  workXp?: number;
  trainXp?: number;
  tuition?: number; // +x tuition cost (negative = cheaper)
  capacity?: number;
}

export const TRAITS: TraitDef[] = [
  { id: 'quick', name: 'Quick Learner', icon: '⚡', desc: '+30% XP from everything', xp: 0.3 },
  { id: 'bookworm', name: 'Bookworm', icon: '📚', desc: '+100% training XP, −25% work XP', trainXp: 1, workXp: -0.25 },
  { id: 'hardworker', name: 'Hard Worker', icon: '💪', desc: '+50% XP from working', workXp: 0.5 },
  { id: 'frugal', name: 'Frugal', icon: '🪙', desc: 'Training tuition costs 50% less', tuition: -0.5 },
  { id: 'diligent', name: 'Diligent', icon: '📋', desc: 'Handles 1 more in any role', capacity: 1 },
  { id: 'clumsy', name: 'Clumsy', icon: '🫨', desc: 'Handles 1 less (minimum 1), but +25% XP', capacity: -1, xp: 0.25 },
  { id: 'greenthumb', name: 'Green Thumb', icon: '🌱', desc: 'As a Gardener: +2 plots, +25% XP', role: 'gardener', capacity: 2, xp: 0.25 },
  { id: 'bornbrewer', name: 'Born Brewer', icon: '⚗️', desc: 'As a Brewer: +1 cauldron, +25% XP', role: 'brewer', capacity: 1, xp: 0.25 },
  { id: 'pathfinder', name: 'Pathfinder', icon: '🗺️', desc: 'As a Scout: +1 party, +25% XP', role: 'scout', capacity: 1, xp: 0.25 },
  { id: 'silvertongue', name: 'Silver Tongue', icon: '💬', desc: 'As a Shopkeeper: +2 potion types, +25% XP', role: 'shopkeeper', capacity: 2, xp: 0.25 },
  { id: 'inkstained', name: 'Ink-Stained', icon: '🖋️', desc: 'As a Scribe: +1 ritual, +25% XP', role: 'scribe', capacity: 1, xp: 0.25 },
  { id: 'fearless', name: 'Fearless', icon: '🔥', desc: 'As a Squire: re-pushes twice as fast, +25% XP', role: 'squire', xp: 0.25 },
];

export const TRAIT_MAP: Record<string, TraitDef> = Object.fromEntries(TRAITS.map((t) => [t.id, t]));

export const NAMES = ['Ada', 'Bram', 'Cora', 'Dorian', 'Elsa', 'Finn', 'Greta', 'Hugo', 'Ivy', 'Jasper', 'Kira', 'Lionel', 'Mira', 'Nico', 'Orla',
  'Pip', 'Quill', 'Rosa', 'Silas', 'Tamsin', 'Ulric', 'Vera', 'Wren', 'Xander', 'Yara', 'Zeke', 'Bea', 'Otto', 'Juno', 'Rook'];
export const PORTRAITS = ['🧑', '👩', '👨', '🧒', '👧', '👦', '🧑‍🦰', '👩‍🦱', '👨‍🦳', '🧑‍🦱', '👱', '👩‍🦰'];

export const CANDIDATE_REFRESH = 600;
/** Every graduated master mentors your current apprentices. */
export const MASTER_XP = 0.05;

/** XP from level L to L+1. Common (cap 25) ≈ 3.4K XP total, Gifted (40) ≈ 22K, Prodigy (50) ≈ 77K. */
export function apprXpToNext(level: number): number {
  return Math.floor(25 * 1.13 ** (level - 1));
}

export function apprenticeCap(a: Apprentice): number {
  return TALENTS[a.talent].cap;
}

function activeTraits(a: Apprentice): TraitDef[] {
  return a.traits.map((id) => TRAIT_MAP[id]).filter((t) => t && (!t.role || t.role === a.role));
}

export function apprenticeCapacity(a: Apprentice): number {
  if (!a.role) return 0;
  if (a.role === 'squire') return 1;
  const bonus = activeTraits(a).reduce((n, t) => n + (t.capacity ?? 0), 0);
  return Math.max(1, ROLE_MAP[a.role].capacity(a.level) + bonus);
}

/** Seconds a Squire waits after your recovery before pushing deeper again. */
export function repushDelay(a: Apprentice): number {
  const base = Math.max(15, 180 - 4 * a.level);
  return a.traits.includes('fearless') ? base / 2 : base;
}

export function traitXpMult(a: Apprentice, working: boolean): number {
  let mult = 1;
  for (const t of activeTraits(a)) mult += (t.xp ?? 0) + (working ? t.workXp ?? 0 : t.trainXp ?? 0);
  return Math.max(0.1, mult);
}

export function tuitionMult(a: Apprentice): number {
  return Math.max(0.1, 1 + activeTraits(a).reduce((n, t) => n + (t.tuition ?? 0), 0));
}

export function createApprentice(id: string, name: string, icon: string, talent: number, traits: string[], role: RoleId | null = null, level = 1): Apprentice {
  return { id, name, icon, talent, traits, role, mode: 'work', level, xp: 0 };
}
