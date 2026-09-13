import type { Effect } from '../core/types';

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  level: number; // player level required to see it
  baseCost: number;
  growth: number;
  max: number; // 0 = infinite
  effects: Effect[]; // per level
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'plot', name: 'Garden Plot', icon: '🟫', desc: 'Till another plot of soil.', level: 1, baseCost: 25, growth: 2.6, max: 8, effects: [{ stat: 'plots', value: 1 }] },
  { id: 'fertilizer', name: 'Mandrake Fertilizer', icon: '💩', desc: 'Bigger harvests.', level: 1, baseCost: 30, growth: 1.85, max: 0, effects: [{ stat: 'harvestYield', value: 0.1 }] },
  { id: 'sundial', name: 'Enchanted Sundial', icon: '☀️', desc: 'Plants grow faster.', level: 2, baseCost: 40, growth: 1.9, max: 0, effects: [{ stat: 'growSpeed', value: 0.1 }] },
  { id: 'cauldron', name: 'Copper Cauldron', icon: '🍲', desc: 'Brew another potion at once.', level: 2, baseCost: 200, growth: 5, max: 5, effects: [{ stat: 'cauldrons', value: 1 }] },
  { id: 'bellows', name: 'Dwarven Bellows', icon: '🌬️', desc: 'Cauldrons boil faster.', level: 2, baseCost: 60, growth: 1.9, max: 0, effects: [{ stat: 'brewSpeed', value: 0.1 }] },
  { id: 'labels', name: 'Fancy Labels', icon: '🏷️', desc: 'Customers pay more.', level: 3, baseCost: 80, growth: 1.95, max: 0, effects: [{ stat: 'sellPrice', value: 0.08 }] },
  { id: 'boots', name: 'Seven-League Boots', icon: '👢', desc: 'Expeditions finish faster.', level: 3, baseCost: 100, growth: 1.85, max: 0, effects: [{ stat: 'scavSpeed', value: 0.1 }] },
  { id: 'satchel', name: 'Expedition Pack', icon: '🎒', desc: 'Run another expedition at once.', level: 5, baseCost: 500, growth: 6, max: 3, effects: [{ stat: 'expSlots', value: 1 }] },
  { id: 'sieve', name: 'Silver Sieve', icon: '🥄', desc: 'Find more on expeditions.', level: 5, baseCost: 120, growth: 1.85, max: 0, effects: [{ stat: 'scavYield', value: 0.08 }] },
  { id: 'quarters', name: 'Apprentice Quarters', icon: '🛏️', desc: 'Somewhere decent to sleep. They learn quicker for it.', level: 3, baseCost: 300, growth: 4, max: 4, effects: [{ stat: 'apprenticeXp', value: 0.15 }] },
  { id: 'library', name: 'Training Library', icon: '📚', desc: 'Apprentices learn faster.', level: 5, baseCost: 500, growth: 2.2, max: 0, effects: [{ stat: 'apprenticeXp', value: 0.1 }] },
  { id: 'hourglass', name: 'Sleeper\'s Hourglass', icon: '⌛', desc: '+2 hours of offline progress.', level: 8, baseCost: 5000, growth: 3, max: 4, effects: [{ stat: 'offlineHours', value: 2 }] },
  { id: 'ledger', name: 'Guild Ledger', icon: '📒', desc: 'More reputation per contract.', level: 8, baseCost: 1000, growth: 1.9, max: 0, effects: [{ stat: 'repGain', value: 0.1 }] },
  { id: 'whetstone', name: 'Runed Whetstone', icon: '🪨', desc: 'Sharper blades, harder hits.', level: 10, baseCost: 800, growth: 1.9, max: 0, effects: [{ stat: 'attackMult', value: 0.08 }] },
  { id: 'wardrunes', name: 'Warding Runes', icon: '🔰', desc: 'Protective runes stitched into your coat.', level: 10, baseCost: 800, growth: 1.9, max: 0, effects: [{ stat: 'defenseMult', value: 0.08 }, { stat: 'hpMult', value: 0.05 }] },
  { id: 'manafont', name: 'Mana Font', icon: '⛲', desc: 'A basin of liquid mana in the workshop.', level: 10, baseCost: 1000, growth: 1.9, max: 0, effects: [{ stat: 'maxMana', value: 15 }, { stat: 'manaRegen', value: 0.25 }] },
  { id: 'bandolier', name: 'Potion Bandolier', icon: '🎽', desc: 'Carry another potion into battle.', level: 12, baseCost: 5000, growth: 6, max: 2, effects: [{ stat: 'potionSlots', value: 1 }] },
  { id: 'lens', name: 'Philosopher\'s Lens', icon: '🔍', desc: 'More Philosopher\'s Stones on ascension.', level: 20, baseCost: 25000, growth: 2.5, max: 0, effects: [{ stat: 'stoneGain', value: 0.05 }] },
];

export const UPGRADE_MAP: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export function upgradeCost(u: UpgradeDef, owned: number): number {
  return Math.ceil(u.baseCost * u.growth ** owned);
}
