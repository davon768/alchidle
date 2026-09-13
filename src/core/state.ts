import type { CombatState, GameState, Stats } from './types';
import { startGoldFor } from '../data/ascension';

export const SAVE_VERSION = 9;

export function xpToNext(level: number): number {
  return Math.floor(25 * 1.21 ** (level - 1) + 15 * level);
}

/** Skill points earned from levels: 1 per level after the first, +2 bonus every 10th level. */
export function levelSkillPoints(level: number): number {
  return level - 1 + Math.floor(level / 10) * 2;
}

function freshStats(): Stats {
  return {
    runGold: 0, totalGold: 0, bestRunGold: 0, brewed: 0, harvested: 0, expeditions: 0,
    potionsSold: 0, contracts: 0, trades: 0, playTime: 0, runTime: 0,
    kills: 0, bosses: 0, deaths: 0, gearFound: 0, bestRarity: 0, spellsCast: 0, events: 0, bestQuality: 0,
  };
}

export function freshCombat(): CombatState {
  return {
    dungeonId: null, floor: 1, kills: 0, autoAdvance: true, enemy: null, hp: 1, shield: 0,
    heroTimer: 0, enemyTimer: 0, potionCd: 0, cooldowns: {}, buffs: [], slow: 0, dead: 0, retreated: false, champion: false, log: [],
  };
}

/** Stats that survive ascension (everything except the per-run counters). */
const LIFETIME_STATS: (keyof Stats)[] = [
  'totalGold', 'brewed', 'harvested', 'expeditions', 'potionsSold', 'contracts', 'trades', 'playTime',
  'kills', 'bosses', 'deaths', 'gearFound', 'bestRarity', 'spellsCast', 'events', 'bestQuality',
];

/**
 * A brand-new run. When `prev` is given (ascension), everything permanent carries over:
 * ascension tree, stones, achievements, proficiency, lifetime stats, settings and belt layout —
 * the Hall of Masters, plus spells (Arcane Memory), equipped gear (Heirloom Armory) and apprentices (Loyal Apprentices) if owned.
 */
export function newState(prev?: GameState): GameState {
  const s: GameState = {
    version: SAVE_VERSION,
    gold: 20,
    items: { clearwater: 6 },
    qual: {},
    seeds: {},
    catalogue: {},
    level: 1,
    xp: 0,
    skills: {},
    upgrades: {},
    plots: [],
    cauldrons: [],
    expeditions: [],
    riftDepth: 0,
    demand: {},
    hotPotion: null,
    hotTimer: 90,
    prof: {},
    guild: { id: null, rep: 0, contracts: [] },
    trade: { offers: [], timer: 0 },
    asc: { stones: 0, total: 0, count: 0, nodes: {} },
    stats: freshStats(),
    achievements: {},
    goals: {},
    autoSell: {},
    settings: { notation: 'suffix', keepReserve: 10, autoSalvage: 0, lootPops: true },
    mana: 0,
    spells: {},
    spellSlots: [],
    autoRituals: {},
    buffs: [],
    belt: [],
    gear: [],
    equipped: { weapon: null, helm: null, armor: null, trinket: null },
    nextGearId: 1,
    combat: freshCombat(),
    dungeons: {},
    event: null,
    eventTimer: 180,
    research: { queue: [], done: {} },
    familiars: {},
    equippedFamiliars: [],
    staff: { crew: {}, repush: 0 },
    lastTick: Date.now(),
  };
  if (prev) {
    s.asc = prev.asc;
    s.achievements = prev.achievements;
    s.goals = prev.goals;
    s.prof = prev.prof;
    s.autoSell = prev.autoSell;
    s.settings = prev.settings;
    s.belt = prev.belt;
    s.stats.bestRunGold = Math.max(prev.stats.bestRunGold, prev.stats.runGold);
    for (const k of LIFETIME_STATS) s.stats[k] = prev.stats[k];
    s.gold += startGoldFor(s.asc.nodes['head_start'] ?? 0);
    s.research = prev.research; // studies and their bonuses are permanent, like proficiency
    s.catalogue = prev.catalogue; // the seed catalogue is a lifetime record
    s.familiars = prev.familiars; // companions stay with you through ascension
    s.equippedFamiliars = prev.equippedFamiliars;
    s.staff = prev.staff; // apprentices and their trees are a lifetime investment
    if (s.asc.nodes['arcane_memory']) {
      s.spells = prev.spells;
      s.spellSlots = prev.spellSlots;
      s.autoRituals = prev.autoRituals;
    }
    if (s.asc.nodes['heirloom']) {
      const kept = new Set(Object.values(prev.equipped).filter(Boolean));
      s.gear = prev.gear.filter((g) => kept.has(g.uid));
      s.equipped = prev.equipped;
      s.nextGearId = prev.nextGearId;
    }
  }
  return s;
}
