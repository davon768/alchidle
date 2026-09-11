import type { CombatBuffStat, Effect, ItemStack } from '../core/types';

export type SpellCombat =
  | { type: 'damage'; mult: number; slow?: number } // mult × spell power; slow = seconds of enemy slow
  | { type: 'drain'; mult: number; heal: number } // heals this fraction of damage dealt
  | { type: 'heal'; pct: number }
  | { type: 'shield'; pct: number }
  | { type: 'buff'; stat: CombatBuffStat; value: number; duration: number };

export interface SpellDef {
  id: string;
  name: string;
  icon: string;
  school: 'Fire' | 'Frost' | 'Arcane' | 'Nature' | 'Shadow' | 'Storm';
  kind: 'combat' | 'ritual';
  level: number;
  desc: string;
  learn: ItemStack[]; // may include gold
  rankCost: ItemStack[]; // cost of rank N+1 = rankCost × N
  maxRank: number;
  mana: number;
  cooldown?: number;
  combat?: SpellCombat;
  ritual?: { effects: Effect[]; duration: number; reagents: ItemStack[] };
}

export const SPELLS: SpellDef[] = [
  // ── Combat spells (equip in spell slots; cast automatically in battle) ──
  { id: 'firebolt', name: 'Firebolt', icon: '🔥', school: 'Fire', kind: 'combat', level: 10, mana: 6, cooldown: 3, maxRank: 10,
    desc: 'Hurl a bolt of flame.', combat: { type: 'damage', mult: 1.6 },
    learn: [{ id: 'runechalk', qty: 3 }, { id: 'spellink', qty: 2 }, { id: 'gold', qty: 300 }], rankCost: [{ id: 'runechalk', qty: 2 }, { id: 'spellink', qty: 1 }] },
  { id: 'rejuvenate', name: 'Rejuvenate', icon: '💚', school: 'Nature', kind: 'combat', level: 11, mana: 12, cooldown: 12, maxRank: 10,
    desc: 'Mend your wounds when below 60% HP.', combat: { type: 'heal', pct: 0.25 },
    learn: [{ id: 'runechalk', qty: 3 }, { id: 'spellink', qty: 3 }, { id: 'gold', qty: 400 }], rankCost: [{ id: 'spellink', qty: 2 }] },
  { id: 'frostlance', name: 'Frost Lance', icon: '❄️', school: 'Frost', kind: 'combat', level: 14, mana: 10, cooldown: 6, maxRank: 10,
    desc: 'Pierce and slow the enemy for 4s.', combat: { type: 'damage', mult: 1.3, slow: 4 },
    learn: [{ id: 'runechalk', qty: 5 }, { id: 'spellink', qty: 4 }, { id: 'gold', qty: 800 }], rankCost: [{ id: 'runechalk', qty: 3 }] },
  { id: 'arcaneshield', name: 'Arcane Shield', icon: '🔰', school: 'Arcane', kind: 'combat', level: 16, mana: 15, cooldown: 18, maxRank: 10,
    desc: 'A barrier that absorbs damage.', combat: { type: 'shield', pct: 0.3 },
    learn: [{ id: 'manacrystal', qty: 2 }, { id: 'soulink', qty: 2 }, { id: 'gold', qty: 1500 }], rankCost: [{ id: 'manacrystal', qty: 1 }] },
  { id: 'drainlife', name: 'Drain Life', icon: '🩸', school: 'Shadow', kind: 'combat', level: 18, mana: 14, cooldown: 8, maxRank: 10,
    desc: 'Steal life: heals for half the damage dealt.', combat: { type: 'drain', mult: 1.8, heal: 0.5 },
    learn: [{ id: 'soulink', qty: 4 }, { id: 'gold', qty: 2500 }], rankCost: [{ id: 'soulink', qty: 1 }] },
  { id: 'empower', name: 'Empower', icon: '💪', school: 'Arcane', kind: 'combat', level: 20, mana: 16, cooldown: 18, maxRank: 10,
    desc: '+50% attack for 8s.', combat: { type: 'buff', stat: 'attackMult', value: 0.5, duration: 8 },
    learn: [{ id: 'manacrystal', qty: 3 }, { id: 'spellink', qty: 5 }, { id: 'gold', qty: 4000 }], rankCost: [{ id: 'manacrystal', qty: 1 }] },
  { id: 'chainlightning', name: 'Chain Lightning', icon: '⚡', school: 'Storm', kind: 'combat', level: 24, mana: 22, cooldown: 9, maxRank: 10,
    desc: 'Lightning that arcs again and again.', combat: { type: 'damage', mult: 3.2 },
    learn: [{ id: 'emberrune', qty: 3 }, { id: 'frostrune', qty: 3 }, { id: 'gold', qty: 12000 }], rankCost: [{ id: 'emberrune', qty: 1 }, { id: 'frostrune', qty: 1 }] },
  { id: 'stoneskin', name: 'Stoneskin', icon: '🗿', school: 'Nature', kind: 'combat', level: 26, mana: 20, cooldown: 20, maxRank: 10,
    desc: '+80% defense for 10s.', combat: { type: 'buff', stat: 'defenseMult', value: 0.8, duration: 10 },
    learn: [{ id: 'frostrune', qty: 4 }, { id: 'runechalk', qty: 10 }, { id: 'gold', qty: 15000 }], rankCost: [{ id: 'frostrune', qty: 1 }] },
  { id: 'meteor', name: 'Meteor', icon: '☄️', school: 'Fire', kind: 'combat', level: 35, mana: 45, cooldown: 22, maxRank: 10,
    desc: 'Call down a falling star.', combat: { type: 'damage', mult: 7 },
    learn: [{ id: 'emberrune', qty: 8 }, { id: 'tidesigil', qty: 3 }, { id: 'gold', qty: 80000 }], rankCost: [{ id: 'emberrune', qty: 2 }, { id: 'tidesigil', qty: 1 }] },
  { id: 'arcanesurge', name: 'Arcane Surge', icon: '🌀', school: 'Arcane', kind: 'combat', level: 45, mana: 40, cooldown: 30, maxRank: 10,
    desc: '+100% spell power for 10s.', combat: { type: 'buff', stat: 'spellMult', value: 1, duration: 10 },
    learn: [{ id: 'dragonsigil', qty: 3 }, { id: 'tidesigil', qty: 5 }, { id: 'gold', qty: 400000 }], rankCost: [{ id: 'tidesigil', qty: 2 }] },
  { id: 'voidrift', name: 'Void Rift', icon: '🕳️', school: 'Shadow', kind: 'combat', level: 55, mana: 90, cooldown: 30, maxRank: 10,
    desc: 'Tear open reality beneath the enemy.', combat: { type: 'damage', mult: 14 },
    learn: [{ id: 'voidsigil', qty: 4 }, { id: 'dragonsigil', qty: 3 }, { id: 'gold', qty: 2e6 }], rankCost: [{ id: 'voidsigil', qty: 1 }] },

  // ── Rituals (cast from the Arcanum; timed buffs to your whole operation) ──
  { id: 'verdantsurge', name: 'Verdant Surge', icon: '🌱', school: 'Nature', kind: 'ritual', level: 12, mana: 30, maxRank: 10,
    desc: 'Your garden grows wild.', ritual: { duration: 300, reagents: [{ id: 'spellink', qty: 1 }],
      effects: [{ stat: 'growSpeed', value: 0.5 }, { stat: 'harvestYield', value: 0.2 }] },
    learn: [{ id: 'spellink', qty: 5 }, { id: 'gold', qty: 500 }], rankCost: [{ id: 'spellink', qty: 3 }] },
  { id: 'alchhaste', name: 'Alchemist\'s Haste', icon: '⚗️', school: 'Arcane', kind: 'ritual', level: 14, mana: 35, maxRank: 10,
    desc: 'Every cauldron bubbles faster.', ritual: { duration: 300, reagents: [{ id: 'runechalk', qty: 1 }],
      effects: [{ stat: 'brewSpeed', value: 0.4 }, { stat: 'doubleBrew', value: 0.05 }] },
    learn: [{ id: 'runechalk', qty: 8 }, { id: 'gold', qty: 1000 }], rankCost: [{ id: 'runechalk', qty: 3 }] },
  { id: 'goldentongue', name: 'Golden Tongue', icon: '💰', school: 'Arcane', kind: 'ritual', level: 18, mana: 40, maxRank: 10,
    desc: 'Customers find you irresistible.', ritual: { duration: 300, reagents: [{ id: 'manacrystal', qty: 1 }],
      effects: [{ stat: 'sellPrice', value: 0.3 }, { stat: 'tradeBonus', value: 0.2 }] },
    learn: [{ id: 'manacrystal', qty: 3 }, { id: 'soulink', qty: 2 }, { id: 'gold', qty: 3000 }], rankCost: [{ id: 'manacrystal', qty: 2 }] },
  { id: 'farsight', name: 'Farsight', icon: '👁️', school: 'Frost', kind: 'ritual', level: 22, mana: 45, maxRank: 10,
    desc: 'See hidden paths and hidden treasure.', ritual: { duration: 300, reagents: [{ id: 'frostrune', qty: 1 }],
      effects: [{ stat: 'scavSpeed', value: 0.4 }, { stat: 'rareFind', value: 0.5 }, { stat: 'lootFind', value: 0.3 }] },
    learn: [{ id: 'frostrune', qty: 3 }, { id: 'gold', qty: 8000 }], rankCost: [{ id: 'frostrune', qty: 1 }] },
  { id: 'battlehymn', name: 'Battle Hymn', icon: '🎺', school: 'Fire', kind: 'ritual', level: 24, mana: 50, maxRank: 10,
    desc: 'Steel your body for the dungeon.', ritual: { duration: 300, reagents: [{ id: 'emberrune', qty: 1 }],
      effects: [{ stat: 'attackMult', value: 0.25 }, { stat: 'defenseMult', value: 0.2 }, { stat: 'hpMult', value: 0.2 }] },
    learn: [{ id: 'emberrune', qty: 3 }, { id: 'gold', qty: 10000 }], rankCost: [{ id: 'emberrune', qty: 1 }] },
  { id: 'scholar', name: 'Scholar\'s Insight', icon: '📖', school: 'Arcane', kind: 'ritual', level: 30, mana: 60, maxRank: 10,
    desc: 'Everything teaches you something.', ritual: { duration: 300, reagents: [{ id: 'tidesigil', qty: 1 }],
      effects: [{ stat: 'xpGain', value: 0.5 }, { stat: 'masteryRate', value: 0.5 }] },
    learn: [{ id: 'tidesigil', qty: 3 }, { id: 'gold', qty: 40000 }], rankCost: [{ id: 'tidesigil', qty: 1 }] },
  { id: 'greatwork', name: 'Invocation of the Great Work', icon: '🜔', school: 'Arcane', kind: 'ritual', level: 50, mana: 150, maxRank: 10,
    desc: 'The whole world bends toward gold.', ritual: { duration: 300, reagents: [{ id: 'dragonsigil', qty: 1 }],
      effects: [{ stat: 'growSpeed', value: 0.3 }, { stat: 'brewSpeed', value: 0.3 }, { stat: 'scavSpeed', value: 0.3 }, { stat: 'sellPrice', value: 0.3 }] },
    learn: [{ id: 'voidsigil', qty: 2 }, { id: 'dragonsigil', qty: 3 }, { id: 'gold', qty: 1e6 }], rankCost: [{ id: 'dragonsigil', qty: 1 }] },
];

export const SPELL_MAP: Record<string, SpellDef> = Object.fromEntries(SPELLS.map((s) => [s.id, s]));

/** Combat spells get +15% power per rank above 1. */
export function spellRankMult(rank: number): number {
  return 1 + 0.15 * (rank - 1);
}

/** Ritual effects get +10% per rank above 1. */
export function ritualEffects(sp: SpellDef, rank: number): Effect[] {
  const mult = 1 + 0.1 * (Math.max(1, rank) - 1);
  return (sp.ritual?.effects ?? []).map((e) => ({ stat: e.stat, value: e.value * mult }));
}

export interface ReagentRecipe {
  id: string; // output reagent item
  level: number;
  inputs: ItemStack[];
}

/** Arcane Workbench recipes: instant crafting from garden, expedition and dungeon materials. */
export const REAGENTS: ReagentRecipe[] = [
  { id: 'runechalk', level: 10, inputs: [{ id: 'quartz', qty: 2 }, { id: 'clearwater', qty: 1 }] },
  { id: 'spellink', level: 10, inputs: [{ id: 'moonpetal', qty: 2 }, { id: 'batwing', qty: 1 }] },
  { id: 'manacrystal', level: 15, inputs: [{ id: 'crystal', qty: 2 }, { id: 'mandrake', qty: 1 }] },
  { id: 'soulink', level: 15, inputs: [{ id: 'ectoplasm', qty: 1 }, { id: 'spellink', qty: 2 }] },
  { id: 'emberrune', level: 22, inputs: [{ id: 'emberroot', qty: 2 }, { id: 'elemcore', qty: 1 }, { id: 'runechalk', qty: 1 }] },
  { id: 'frostrune', level: 22, inputs: [{ id: 'frostcap', qty: 2 }, { id: 'elemcore', qty: 1 }, { id: 'runechalk', qty: 1 }] },
  { id: 'tidesigil', level: 30, inputs: [{ id: 'krakenink', qty: 1 }, { id: 'sirenscale', qty: 1 }, { id: 'manacrystal', qty: 1 }] },
  { id: 'dragonsigil', level: 40, inputs: [{ id: 'dragonheart', qty: 1 }, { id: 'emberrune', qty: 2 }, { id: 'stardust', qty: 2 }] },
  { id: 'voidsigil', level: 55, inputs: [{ id: 'voidshard', qty: 1 }, { id: 'voidessence', qty: 1 }, { id: 'manacrystal', qty: 2 }] },
];
