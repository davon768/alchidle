import type { Effect } from '../core/types';

export type EventSpecial = 'merchant' | 'champion' | 'fever' | 'raid' | 'jobfair';

export interface EventDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  level: number; // minimum player level
  duration: number; // seconds
  weight: number;
  effects: Effect[];
  special?: EventSpecial;
}

export const EVENT_UNLOCK_LEVEL = 3;
export const EVENT_GAP: [number, number] = [240, 480]; // seconds between events

export const EVENTS: EventDef[] = [
  { id: 'rain', name: 'Bountiful Rain', icon: '🌧️', level: 3, duration: 240, weight: 10, desc: 'Warm rain soaks the gardens.',
    effects: [{ stat: 'growSpeed', value: 0.5 }, { stat: 'harvestYield', value: 0.25 }] },
  { id: 'bard', name: 'Traveling Bard', icon: '🪕', level: 4, duration: 240, weight: 8, desc: 'Songs of old alchemists inspire you.',
    effects: [{ stat: 'xpGain', value: 0.5 }, { stat: 'masteryRate', value: 0.5 }] },
  { id: 'fever', name: 'Fever in Town', icon: '🤒', level: 4, duration: 240, weight: 7, special: 'fever', desc: 'Everyone needs healing potions — now!',
    effects: [{ stat: 'contractReward', value: 0.25 }] },
  { id: 'jobfair', name: 'Job Fair', icon: '🎪', level: 3, duration: 240, weight: 5, special: 'jobfair',
    desc: 'Talented hopefuls are looking for a master — fresh, likely gifted candidates await in 👥 Apprentices.', effects: [{ stat: 'apprenticeXp', value: 0.25 }] },
  { id: 'boom', name: 'Market Boom', icon: '📈', level: 5, duration: 180, weight: 8, desc: 'Coin is flowing through town.',
    effects: [{ stat: 'sellPrice', value: 0.4 }] },
  { id: 'lucky', name: 'Lucky Day', icon: '🍀', level: 5, duration: 180, weight: 6, desc: 'Nothing goes wrong today.',
    effects: [{ stat: 'doubleBrew', value: 0.15 }, { stat: 'ingredientSave', value: 0.1 }] },
  { id: 'meteors', name: 'Meteor Shower', icon: '🌠', level: 6, duration: 240, weight: 6, desc: 'Fallen stars litter the countryside.',
    effects: [{ stat: 'rareFind', value: 1 }, { stat: 'scavYield', value: 0.3 }] },
  { id: 'strike', name: 'Merchant Strike', icon: '📉', level: 7, duration: 180, weight: 5, desc: 'Shops are closed, but caravans pay double.',
    effects: [{ stat: 'sellPrice', value: -0.25 }, { stat: 'tradeBonus', value: 0.6 }] },
  { id: 'festival', name: 'Guild Festival', icon: '🎉', level: 8, duration: 300, weight: 6, desc: 'The guilds are celebrating and generous.',
    effects: [{ stat: 'repGain', value: 1 }, { stat: 'contractReward', value: 0.5 }] },
  { id: 'manastorm', name: 'Mana Storm', icon: '⚡', level: 10, duration: 180, weight: 6, desc: 'Raw magic crackles in the air.',
    effects: [{ stat: 'manaRegen', value: 3 }, { stat: 'spellMult', value: 0.3 }] },
  { id: 'merchant', name: 'Mysterious Merchant', icon: '🧳', level: 10, duration: 300, weight: 5, special: 'merchant',
    desc: 'A hooded trader has rare goods at the Trading Post.', effects: [] },
  { id: 'raid', name: 'Goblin Raid', icon: '👺', level: 10, duration: 300, weight: 6, special: 'raid',
    desc: 'Raiders are harassing caravans! Slay monsters in any dungeon to drive them off.', effects: [{ stat: 'tradeBonus', value: -0.2 }] },
  { id: 'bloodmoon', name: 'Blood Moon', icon: '🩸', level: 12, duration: 240, weight: 5, desc: 'Monsters grow fierce — and so does their loot.',
    effects: [{ stat: 'enemyPower', value: 0.35 }, { stat: 'lootFind', value: 1 }, { stat: 'xpGain', value: 0.25 }] },
  { id: 'champion', name: 'Wandering Champion', icon: '🏆', level: 12, duration: 300, weight: 4, special: 'champion',
    desc: 'A legendary foe stalks the dungeons. Defeat it for Epic gear.', effects: [] },
  { id: 'eclipse', name: 'Eclipse', icon: '🌑', level: 15, duration: 240, weight: 4, desc: 'Spells surge while blades feel heavy.',
    effects: [{ stat: 'spellMult', value: 0.5 }, { stat: 'attackMult', value: -0.2 }] },
];

export const EVENT_MAP: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

export function raidTarget(level: number): number {
  return 15 + Math.floor(level / 2);
}
