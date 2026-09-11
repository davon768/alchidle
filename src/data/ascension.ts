import type { Effect } from '../core/types';

export interface AscNode {
  id: string;
  name: string;
  icon: string;
  desc: string;
  max: number; // 0 = infinite
  baseCost: number;
  growth: number;
  effects: Effect[];
}

/** Minimum gold earned in a run before the Magnum Opus can be performed. */
export const ASC_MIN_GOLD = 200_000;
/** Each Philosopher's Stone ever earned permanently adds this much sell price (never lost by spending). */
export const STONE_RESONANCE = 0.02;

/** 3 stones at the minimum, then grows with the square root of gold earned (4x gold = 2x stones). */
export function stonesFor(runGold: number, stoneGain: number): number {
  if (runGold < ASC_MIN_GOLD) return 0;
  return Math.floor(3 * Math.sqrt(runGold / ASC_MIN_GOLD) * stoneGain);
}

export const ASC_NODES: AscNode[] = [
  { id: 'quicksilver', name: 'Quicksilver Veins', icon: '☿', desc: '+10% grow, brew & expedition speed', max: 0, baseCost: 1, growth: 1.5,
    effects: [{ stat: 'growSpeed', value: 0.1 }, { stat: 'brewSpeed', value: 0.1 }, { stat: 'scavSpeed', value: 0.1 }] },
  { id: 'midas', name: 'Touch of Midas', icon: '🫅', desc: '+15% sell price', max: 0, baseCost: 1, growth: 1.5,
    effects: [{ stat: 'sellPrice', value: 0.15 }] },
  { id: 'scholar', name: 'Eternal Scholar', icon: '📚', desc: '+20% XP gain', max: 0, baseCost: 1, growth: 1.5,
    effects: [{ stat: 'xpGain', value: 0.2 }] },
  { id: 'head_start', name: 'Inheritance', icon: '💰', desc: 'Start each run with more gold', max: 6, baseCost: 1, growth: 2,
    effects: [{ stat: 'startGold', value: 1 }] },
  { id: 'wisdom', name: 'Retained Wisdom', icon: '🧠', desc: '+2 skill points', max: 25, baseCost: 2, growth: 1.45,
    effects: [{ stat: 'skillPoints', value: 2 }] },
  { id: 'eden', name: 'Seeds of Eden', icon: '🍎', desc: '+1 garden plot', max: 4, baseCost: 2, growth: 2.2,
    effects: [{ stat: 'plots', value: 1 }] },
  { id: 'eternal_flame', name: 'Eternal Flame', icon: '🔥', desc: '+1 cauldron', max: 3, baseCost: 3, growth: 2.5,
    effects: [{ stat: 'cauldrons', value: 1 }] },
  { id: 'wanderer', name: 'Wanderer\'s Legacy', icon: '🧭', desc: '+1 expedition slot', max: 2, baseCost: 5, growth: 3,
    effects: [{ stat: 'expSlots', value: 1 }] },
  { id: 'loyal', name: 'Loyal Apprentices', icon: '🤝', desc: 'Your apprentices (and their levels) stay with you when you ascend', max: 1, baseCost: 8, growth: 1,
    effects: [] },
  { id: 'academy', name: 'Eternal Academy', icon: '🏫', desc: '+15% apprentice XP', max: 0, baseCost: 2, growth: 1.6,
    effects: [{ stat: 'apprenticeXp', value: 0.15 }] },
  { id: 'timeless', name: 'Timeless Sleep', icon: '💤', desc: '+4 hours offline progress', max: 6, baseCost: 2, growth: 1.8,
    effects: [{ stat: 'offlineHours', value: 4 }] },
  { id: 'resonance', name: 'Stone Resonance', icon: '💎', desc: '+10% Philosopher\'s Stones gained', max: 0, baseCost: 3, growth: 1.7,
    effects: [{ stat: 'stoneGain', value: 0.1 }] },
  { id: 'guild_legacy', name: 'Guild Legacy', icon: '🛡️', desc: '+25% reputation gain', max: 0, baseCost: 2, growth: 1.6,
    effects: [{ stat: 'repGain', value: 0.25 }] },
  { id: 'warlord', name: 'Eternal Warlord', icon: '⚔️', desc: '+10% attack, defense, HP and spell power', max: 0, baseCost: 2, growth: 1.55,
    effects: [{ stat: 'attackMult', value: 0.1 }, { stat: 'defenseMult', value: 0.1 }, { stat: 'hpMult', value: 0.1 }, { stat: 'spellMult', value: 0.1 }] },
  { id: 'arcane_memory', name: 'Arcane Memory', icon: '📘', desc: 'Keep learned spells and their ranks when you ascend', max: 1, baseCost: 10, growth: 1,
    effects: [] },
  { id: 'heirloom', name: 'Heirloom Armory', icon: '🗝️', desc: 'Keep your equipped gear when you ascend', max: 1, baseCost: 12, growth: 1,
    effects: [] },
];

export const ASC_MAP: Record<string, AscNode> = Object.fromEntries(ASC_NODES.map((a) => [a.id, a]));

export function ascCost(node: AscNode, owned: number): number {
  return Math.ceil(node.baseCost * node.growth ** owned);
}

/** Starting gold from Inheritance ranks. */
export function startGoldFor(ranks: number): number {
  return ranks <= 0 ? 0 : 500 * 5 ** (ranks - 1);
}
