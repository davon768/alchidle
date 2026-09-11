import type { Effect, GameState } from '../core/types';
import { profLevel } from './proficiency';

const bestProf = (s: GameState) => Math.max(1, ...Object.values(s.prof).map(profLevel));

export interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  check: (s: GameState) => boolean;
  reward: Effect[];
}

const sellBonus = (v: number): Effect[] => [{ stat: 'sellPrice', value: v }];

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_brew', name: 'First Bubbles', icon: '🧪', desc: 'Brew your first potion.', check: (s) => s.stats.brewed >= 1, reward: sellBonus(0.01) },
  { id: 'brew_100', name: 'Journeyman Brewer', icon: '⚗️', desc: 'Brew 100 potions.', check: (s) => s.stats.brewed >= 100, reward: [{ stat: 'brewSpeed', value: 0.02 }] },
  { id: 'brew_10k', name: 'Potion Factory', icon: '🏭', desc: 'Brew 10,000 potions.', check: (s) => s.stats.brewed >= 10_000, reward: [{ stat: 'brewSpeed', value: 0.05 }] },
  { id: 'harvest_100', name: 'Green Fingers', icon: '🌿', desc: 'Harvest 100 times.', check: (s) => s.stats.harvested >= 100, reward: [{ stat: 'growSpeed', value: 0.02 }] },
  { id: 'harvest_5k', name: 'Breadbasket', icon: '🧺', desc: 'Harvest 5,000 times.', check: (s) => s.stats.harvested >= 5000, reward: [{ stat: 'harvestYield', value: 0.05 }] },
  { id: 'exp_25', name: 'Wanderlust', icon: '🧭', desc: 'Finish 25 expeditions.', check: (s) => s.stats.expeditions >= 25, reward: [{ stat: 'scavSpeed', value: 0.03 }] },
  { id: 'gold_1k', name: 'Pocket Money', icon: '🪙', desc: 'Earn 1,000 gold in total.', check: (s) => s.stats.totalGold >= 1e3, reward: sellBonus(0.01) },
  { id: 'gold_1m', name: 'Millionaire', icon: '💰', desc: 'Earn 1M gold in total.', check: (s) => s.stats.totalGold >= 1e6, reward: sellBonus(0.03) },
  { id: 'gold_1b', name: 'Tycoon', icon: '🏦', desc: 'Earn 1B gold in total.', check: (s) => s.stats.totalGold >= 1e9, reward: sellBonus(0.05) },
  { id: 'lvl_10', name: 'Promising Alchemist', icon: '🎓', desc: 'Reach level 10.', check: (s) => s.level >= 10, reward: [{ stat: 'xpGain', value: 0.03 }] },
  { id: 'lvl_50', name: 'Archmage', icon: '🧙', desc: 'Reach level 50.', check: (s) => s.level >= 50, reward: [{ stat: 'xpGain', value: 0.1 }] },
  { id: 'guild_rank3', name: 'Respected', icon: '🛡️', desc: 'Reach Adept in a guild.', check: (s) => s.guild.rep >= 2000, reward: [{ stat: 'repGain', value: 0.05 }] },
  { id: 'contracts_50', name: 'Reliable Supplier', icon: '📜', desc: 'Complete 50 contracts.', check: (s) => s.stats.contracts >= 50, reward: [{ stat: 'contractReward', value: 0.1 }] },
  { id: 'trades_25', name: 'Caravan Regular', icon: '🐪', desc: 'Complete 25 trades.', check: (s) => s.stats.trades >= 25, reward: [{ stat: 'tradeBonus', value: 0.05 }] },
  { id: 'rift_10', name: 'Into the Abyss', icon: '🌀', desc: 'Reach Rift depth 10.', check: (s) => s.riftDepth >= 10, reward: [{ stat: 'rareFind', value: 0.1 }] },
  { id: 'panacea', name: 'The Great Work', icon: '🜔', desc: "Brew a Philosopher's Panacea.", check: (s) => (s.prof['p_panacea'] ?? 0) > 0, reward: sellBonus(0.1) },
  { id: 'prof_25', name: 'Journeyman Artisan', icon: '🎖️', desc: 'Reach proficiency 25 in anything.', check: (s) => bestProf(s) >= 25, reward: [{ stat: 'masteryRate', value: 0.05 }] },
  { id: 'prof_50', name: 'Specialist', icon: '🏅', desc: 'Reach proficiency 50 in anything.', check: (s) => bestProf(s) >= 50, reward: [{ stat: 'masteryRate', value: 0.1 }] },
  { id: 'prof_100', name: 'Perfectionist', icon: '💯', desc: 'Reach proficiency 100 in anything.', check: (s) => bestProf(s) >= 100,
    reward: [{ stat: 'masteryRate', value: 0.2 }, { stat: 'sellPrice', value: 0.1 }] },
  { id: 'ascend_1', name: 'Magnum Opus', icon: '🌟', desc: 'Ascend for the first time.', check: (s) => s.asc.count >= 1, reward: [{ stat: 'stoneGain', value: 0.05 }] },
  { id: 'kills_100', name: 'Monster Hunter', icon: '🗡️', desc: 'Defeat 100 monsters.', check: (s) => s.stats.kills >= 100, reward: [{ stat: 'attackMult', value: 0.03 }] },
  { id: 'kills_5k', name: 'Slayer', icon: '⚔️', desc: 'Defeat 5,000 monsters.', check: (s) => s.stats.kills >= 5000, reward: [{ stat: 'attackMult', value: 0.1 }] },
  { id: 'bosses_10', name: 'Boss Breaker', icon: '👑', desc: 'Defeat 10 bosses.', check: (s) => s.stats.bosses >= 10, reward: [{ stat: 'lootFind', value: 0.1 }] },
  { id: 'spells_5', name: 'Spellscribe', icon: '📘', desc: 'Learn 5 spells.', check: (s) => Object.keys(s.spells).length >= 5, reward: [{ stat: 'spellMult', value: 0.05 }] },
  { id: 'legendary', name: 'Legendary Find', icon: '🌟', desc: 'Find a Legendary item.', check: (s) => s.stats.bestRarity >= 4, reward: [{ stat: 'lootFind', value: 0.1 }] },
  { id: 'dragonslayer', name: 'Dragonslayer', icon: '🐉', desc: "Clear the Dragon's Lair.", check: (s) => (s.dungeons['lair'] ?? 0) >= 25, reward: [{ stat: 'hpMult', value: 0.1 }] },
  { id: 'void_25', name: 'Void Walker', icon: '🌌', desc: 'Reach floor 25 of the Void Citadel.', check: (s) => (s.dungeons['void'] ?? 0) >= 25,
    reward: [{ stat: 'attackMult', value: 0.1 }, { stat: 'spellMult', value: 0.1 }] },
  { id: 'events_25', name: 'Town Favorite', icon: '🎪', desc: 'Witness 25 world events.', check: (s) => s.stats.events >= 25, reward: [{ stat: 'xpGain', value: 0.05 }] },
  { id: 'hire_1', name: 'Taking on Help', icon: '👥', desc: 'Hire your first apprentice.', check: (s) => s.staff.hired.length > 0 || s.staff.masters.length > 0,
    reward: [{ stat: 'apprenticeXp', value: 0.05 }] },
  { id: 'graduate_1', name: 'Graduation Day', icon: '🎓', desc: 'Graduate an apprentice.', check: (s) => s.staff.masters.length >= 1, reward: [{ stat: 'apprenticeXp', value: 0.1 }] },
  { id: 'masters_10', name: 'Hall of Fame', icon: '🏛️', desc: 'Graduate 10 apprentices.', check: (s) => s.staff.masters.length >= 10,
    reward: [{ stat: 'apprenticeXp', value: 0.15 }, { stat: 'sellPrice', value: 0.05 }] },
  { id: 'ascend_10', name: 'Cycle of Rebirth', icon: '♻️', desc: 'Ascend 10 times.', check: (s) => s.asc.count >= 10, reward: [{ stat: 'stoneGain', value: 0.1 }] },
];
