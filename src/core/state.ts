import type { CombatState, GameState, Stats } from './types';
import { startGoldFor } from '../data/ascension';
import { profLevel } from '../data/proficiency';

export const SAVE_VERSION = 12;

/**
 * XP from one level to the next.
 *
 * Two pieces. Up to SOFTEN_AT the curve climbs 21% a level, which is what paces the first run through
 * the content; after that it eases to 16% so the hundred-level ceiling is a long climb rather than a
 * wall — at a flat 21% the last level alone would cost more XP than the entire run before it.
 *
 * The scale has been raised twice: every system in the game is gated on level, and at the original
 * numbers all of them arrived inside the first half hour.
 */
const SOFTEN_AT = 40;
export function xpToNext(level: number): number {
  const early = 1.21 ** (Math.min(level, SOFTEN_AT) - 1);
  const late = 1.16 ** Math.max(0, level - SOFTEN_AT);
  return Math.floor(65 * early * late + 40 * level);
}

/** Skill points earned from levels: 1 per level after the first, +2 bonus every 10th level. */
export function levelSkillPoints(level: number): number {
  return level - 1 + Math.floor(level / 10) * 2;
}

function freshStats(): Stats {
  return {
    runGold: 0, totalGold: 0, bestRunGold: 0, brewed: 0, harvested: 0, expeditions: 0,
    potionsSold: 0, contracts: 0, trades: 0, playTime: 0, runTime: 0,
    kills: 0, bosses: 0, deaths: 0, gearFound: 0, bestRarity: 0, spellsCast: 0, events: 0, bestQuality: 0, runQuality: 0, delves: 0,
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
  'kills', 'bosses', 'deaths', 'gearFound', 'bestRarity', 'spellsCast', 'events', 'bestQuality', 'delves',
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
    strains: {},
    codex: {},
    clues: {},
    bench: null,
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
    income: {},
    runStart: {},
    guild: { id: null, rep: 0, contracts: [] },
    trade: { offers: [], timer: 0 },
    asc: { stones: 0, total: 0, count: 0, nodes: {} },
    stats: freshStats(),
    achievements: {},
    goals: {},
    autoSell: {},
    settings: { notation: 'suffix', keepReserve: 10, autoSalvage: 0, lootPops: true, fineStudies: false },
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
    party: { roster: [], kit: [], delve: null, depth: 0, relics: {}, repeat: false, nextId: 1 },
    staff: { crew: {}, repush: 0 },
    autoOff: {},
    lastTick: Date.now(),
  };
  if (prev) {
    s.asc = prev.asc;
    // Kept deliberately, and not for sale in the tree: every achievement tests a *lifetime* stat, so
    // clearing them would re-award the whole list within one tick and mean nothing.
    s.achievements = prev.achievements;
    // Also kept deliberately: goal rewards pay out once, so resetting them would make the tutorial an
    // infinitely repeatable source of gold and items.
    s.goals = prev.goals;
    s.income = prev.income; // a lifetime record with no power attached
    // Knowledge, not stock: the garden, the seeds and the strains are all unmade, but a recipe once read
    // stays read and a hybrid once discovered stays plantable. Deliberately not for sale in the tree.
    s.codex = prev.codex;
    s.clues = prev.clues;
    s.settings = prev.settings; // display preferences, not progress
    s.autoOff = prev.autoOff; // how you like to play, not progress: a handover survives the rebirth
    s.stats.bestRunGold = Math.max(prev.stats.bestRunGold, prev.stats.runGold);
    for (const k of LIFETIME_STATS) s.stats[k] = prev.stats[k];
    s.gold += startGoldFor(s.asc.nodes['head_start'] ?? 0);

    // Everything below here is bought back, one node at a time. The Great Work unmakes the workshop
    // entirely; the ascension tree is meant to be the only permanence in the game, because a rebirth
    // that leaves proficiency, studies, apprentices and a veteran company standing is not a beginning,
    // it is a lap. Anything not listed here resets, including the Repeat and auto-sell choices, which
    // name recipes the new run has not unlocked yet.
    if (s.asc.nodes['mastery']) s.prof = prev.prof;
    if (s.asc.nodes['archive']) s.research = prev.research;
    if (s.asc.nodes['seedvault']) {
      s.catalogue = prev.catalogue;
      s.strains = prev.strains;
    }
    if (s.asc.nodes['menagerie']) {
      s.familiars = prev.familiars;
      s.equippedFamiliars = prev.equippedFamiliars;
    }
    if (s.asc.nodes['loyal']) s.staff = prev.staff;
    if (s.asc.nodes['company_legacy']) {
      // Only the delve in progress is abandoned: the world it was walking through no longer exists.
      s.party = { ...prev.party, delve: null };
    }
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
  s.runStart = snapshotRun(s);
  return s;
}

/**
 * The carried-over tallies as this run starts. Everything the Great Work weighs is measured against it,
 * so a run is judged on what it did rather than on a lifetime total it inherited.
 */
export function snapshotRun(s: GameState): Record<string, number> {
  const keys: (keyof Stats)[] = [
    'brewed', 'harvested', 'expeditions', 'potionsSold', 'contracts', 'trades',
    'kills', 'bosses', 'gearFound', 'spellsCast', 'events', 'delves',
  ];
  const snap: Record<string, number> = {};
  for (const k of keys) snap[k] = s.stats[k];
  snap.studies = Object.values(s.research.done).reduce((a, b) => a + b, 0);
  snap.profLevels = totalProficiency(s);
  snap.partyDepth = s.party.depth;
  snap.strains = Object.keys(s.catalogue).length;
  return snap;
}

/** Proficiency levels summed across every track — the game's broadest measure of craft. */
export function totalProficiency(s: GameState): number {
  let total = 0;
  for (const xp of Object.values(s.prof)) total += profLevel(xp);
  return total;
}
