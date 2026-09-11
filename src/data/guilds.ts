import type { Effect } from '../core/types';

export interface GuildDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
  perRank: Effect[]; // multiplied by current rank
  milestones: { rank: number; effects: Effect[]; label: string }[];
}

export const GUILD_UNLOCK_LEVEL = 8;

export const GUILDS: GuildDef[] = [
  { id: 'verdant', name: 'The Verdant Circle', icon: '🌿', color: '#5fd068', desc: 'Herbalists and druids who speak with roots.',
    perRank: [{ stat: 'growSpeed', value: 0.06 }, { stat: 'harvestYield', value: 0.06 }],
    milestones: [
      { rank: 2, effects: [{ stat: 'plots', value: 1 }], label: '+1 garden plot' },
      { rank: 4, effects: [{ stat: 'autoHarvest', value: 1 }], label: 'Druid helpers auto-harvest' },
    ] },
  { id: 'crucible', name: 'Order of the Crucible', icon: '⚗️', color: '#b57bff', desc: 'Purist alchemists obsessed with perfection.',
    perRank: [{ stat: 'brewSpeed', value: 0.06 }, { stat: 'doubleBrew', value: 0.015 }],
    milestones: [
      { rank: 2, effects: [{ stat: 'ingredientSave', value: 0.05 }], label: '+5% ingredient save' },
      { rank: 4, effects: [{ stat: 'cauldrons', value: 1 }], label: '+1 cauldron' },
    ] },
  { id: 'gilded', name: 'The Gilded Exchange', icon: '💰', color: '#f5c542', desc: 'Merchants who know the price of everything.',
    perRank: [{ stat: 'sellPrice', value: 0.06 }, { stat: 'tradeBonus', value: 0.04 }],
    milestones: [
      { rank: 2, effects: [{ stat: 'demandRecovery', value: 0.3 }], label: '+30% demand recovery' },
      { rank: 4, effects: [{ stat: 'autoSell', value: 1 }], label: 'Exchange brokers auto-sell' },
    ] },
  { id: 'wayfarer', name: "Wayfarers' Lodge", icon: '🧭', color: '#4fb3ff', desc: 'Explorers who map the unmappable.',
    perRank: [{ stat: 'scavSpeed', value: 0.06 }, { stat: 'scavYield', value: 0.05 }],
    milestones: [
      { rank: 2, effects: [{ stat: 'rareFind', value: 0.25 }], label: '+25% rare finds' },
      { rank: 4, effects: [{ stat: 'expSlots', value: 1 }], label: '+1 expedition slot' },
    ] },
  { id: 'spellblade', name: 'The Spellblade Order', icon: '⚔️', color: '#ff5c5c', desc: 'Battlemages who clear dungeons for coin and glory.',
    perRank: [{ stat: 'attackMult', value: 0.05 }, { stat: 'spellMult', value: 0.05 }, { stat: 'lootFind', value: 0.04 }],
    milestones: [
      { rank: 2, effects: [{ stat: 'potionSlots', value: 1 }], label: '+1 potion belt slot' },
      { rank: 4, effects: [{ stat: 'spellSlots', value: 1 }], label: '+1 spell slot' },
    ] },
];

export const GUILD_MAP: Record<string, GuildDef> = Object.fromEntries(GUILDS.map((g) => [g.id, g]));

const RANK_NAMES = ['Initiate', 'Apprentice', 'Journeyman', 'Adept', 'Master', 'Grandmaster'];
const RANK_REP = [0, 100, 500, 2000, 8000, 30000];

/** Rep needed for a rank. Ranks beyond Grandmaster ("Legend I, II, ...") continue forever at x3 each. */
export function rankThreshold(rank: number): number {
  if (rank < RANK_REP.length) return RANK_REP[rank];
  return RANK_REP[RANK_REP.length - 1] * 3 ** (rank - RANK_REP.length + 1);
}

export function rankFor(rep: number): number {
  let r = 0;
  while (rep >= rankThreshold(r + 1)) r++;
  return r;
}

const ROMAN: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
function roman(num: number): string {
  let out = '';
  for (const [v, s] of ROMAN) while (num >= v) { out += s; num -= v; }
  return out;
}

export function rankName(rank: number): string {
  return rank < RANK_NAMES.length ? RANK_NAMES[rank] : `Legend ${roman(rank - RANK_NAMES.length + 1)}`;
}

export const CONTRACT_COUNT = 3;
