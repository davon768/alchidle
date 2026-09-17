import type { Effect, GameState } from '../core/types';
import { totalProficiency } from '../core/state';

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

/**
 * Gold earned in a run before the *first* Magnum Opus. Later ones ask for far more — see ascGoldTarget.
 *
 * Raised with the v1.0 content pass. The level curve paces how fast the game *opens up*, but it does not
 * pace the first ascension at all — that is gated on gold, so slowing levels alone just meant ascending
 * at level 25 instead of 30, having seen less of the game rather than more of it.
 */
export const ASC_MIN_GOLD = 2_000_000;

/**
 * What each further ascension demands.
 *
 * Set when almost everything that earns gold was permanent — research, proficiency, apprentices,
 * familiars — so a flat target made every run *shorter* than the last: measured at 77, 40, 31 and 22
 * minutes. The target had to outgrow the compounding or the Great Work became a lap counter.
 *
 * Far less compounds now: the Magnum Opus resets everything the tree has not bought back, so a player
 * who has spent their stones elsewhere begins each run very close to where they began the first. The
 * steep target is therefore doing less work than it was, and this number is a candidate for lowering —
 * but only against a measurement, since the answer depends entirely on how much retention a given player
 * has bought, which is now a choice rather than a constant.
 */
export const ASC_GOLD_GROWTH = 2.5;
export function ascGoldTarget(count: number): number {
  return Math.round(ASC_MIN_GOLD * ASC_GOLD_GROWTH ** count);
}

/**
 * The level the Great Work demands, rising with every ascension. Gold alone let a rich later run end
 * before the workshop had even reopened the Trading Post; this makes each run re-walk a little more of
 * the content than the one before it.
 */
export function ascMinLevel(count: number): number {
  // The floor starts above the deepest apprentice study (the Scribe, level 18) on purpose: a first run
  // that can end before the last of your crew is even visible in the Library has skipped its own content.
  return Math.min(60, 20 + 3 * count);
}

/** Whether the Magnum Opus can be performed, and what is still missing. */
export function ascStatus(s: GameState): { ok: boolean; goldNeed: number; levelNeed: number; reason: string } {
  const goldNeed = ascGoldTarget(s.asc.count);
  const levelNeed = ascMinLevel(s.asc.count);
  const shortGold = s.stats.runGold < goldNeed;
  const shortLevel = s.level < levelNeed;
  return {
    ok: !shortGold && !shortLevel,
    goldNeed,
    levelNeed,
    reason: shortGold && shortLevel ? `Needs level ${levelNeed} and more gold this run`
      : shortGold ? 'Not enough gold earned this run'
      : shortLevel ? `Needs level ${levelNeed}` : '',
  };
}
/** Each Philosopher's Stone ever earned permanently adds this much sell price (never lost by spending). */
export const STONE_RESONANCE = 0.02;

/**
 * What the Great Work is worth.
 *
 * Gold used to be the only thing weighed, which said that a run spent brewing Legendaries, clearing the
 * Citadel, breeding strains and finishing studies was worth exactly as much as one that sold herbs. Every
 * system now contributes, each measured against what this run did rather than a lifetime total, and each
 * on its own square-root curve so no single one can be farmed into dominance.
 *
 * Breadth is a **bonus, not a gate**. Wealth is still the backbone — it is what the gate asks for — and a
 * player who ignores combat entirely still ascends perfectly well, just for fewer stones than one who
 * does everything. Requiring every system would turn a preference into a punishment.
 */
export interface StoneSource {
  id: string;
  label: string;
  icon: string;
  /** What this run did. */
  amount: number;
  /** The amount a first ascension typically reaches, so one unit of benchmark is one unit of weight. */
  bench: number;
  weight: number;
  stones: number;
}

/** Each strand of the Great Work, and what a first ascension usually looks like on it. */
const STONE_WEIGHTS: { id: string; label: string; icon: string; bench: number; weight: number }[] = [
  { id: 'wealth', label: 'Gold earned', icon: '🪙', bench: ASC_MIN_GOLD, weight: 1.1 },
  { id: 'craft', label: 'Potions brewed', icon: '⚗️', bench: 4000, weight: 0.45 },
  { id: 'quality', label: 'Finest bottle', icon: '✦', bench: 3, weight: 0.35 },
  { id: 'garden', label: 'Herbs harvested', icon: '🌿', bench: 14000, weight: 0.3 },
  { id: 'explore', label: 'Expeditions run', icon: '🧭', bench: 110, weight: 0.3 },
  { id: 'study', label: 'Studies finished', icon: '📚', bench: 7, weight: 0.35 },
  { id: 'mastery', label: 'Proficiency gained', icon: '🎖️', bench: 250, weight: 0.4 },
  { id: 'combat', label: 'Monsters slain', icon: '⚔️', bench: 600, weight: 0.35 },
  { id: 'depth', label: 'Deepest floor', icon: '🏰', bench: 15, weight: 0.3 },
  { id: 'commerce', label: 'Contracts & trades', icon: '📜', bench: 25, weight: 0.3 },
  { id: 'magic', label: 'Spells cast', icon: '🔮', bench: 250, weight: 0.25 },
  { id: 'company', label: 'Rift delves', icon: '🏕️', bench: 30, weight: 0.3 },
  { id: 'strains', label: 'Strains discovered', icon: '🌾', bench: 14, weight: 0.2 },
];

/** How much of each strand this run actually produced. */
export function runActivity(s: GameState): Record<string, number> {
  const was = s.runStart ?? {};
  const since = (k: string, now: number) => Math.max(0, now - (was[k] ?? 0));
  return {
    wealth: s.stats.runGold,
    craft: since('brewed', s.stats.brewed),
    quality: s.stats.runQuality ?? 0,
    garden: since('harvested', s.stats.harvested),
    explore: since('expeditions', s.stats.expeditions),
    study: since('studies', Object.values(s.research.done).reduce((a, b) => a + b, 0)),
    mastery: since('profLevels', totalProficiency(s)),
    combat: since('kills', s.stats.kills),
    depth: Math.max(0, ...Object.values(s.dungeons), 0),
    commerce: since('contracts', s.stats.contracts) + since('trades', s.stats.trades),
    magic: since('spellsCast', s.stats.spellsCast),
    company: since('delves', s.stats.delves),
    strains: since('strains', Object.keys(s.catalogue).length),
  };
}

/** The full breakdown, so the Magnum Opus screen can show its working rather than one number. */
export function stoneBreakdown(s: GameState, stoneGain: number): { sources: StoneSource[]; total: number } {
  const act = runActivity(s);
  const sources = STONE_WEIGHTS.map((w) => {
    const amount = act[w.id] ?? 0;
    // Square root: doing twice as much is worth about 1.4 times as many stones, never twice.
    const stones = w.weight * Math.sqrt(Math.max(0, amount) / w.bench) * stoneGain;
    return { ...w, amount, stones };
  });
  return { sources, total: sources.reduce((a, x) => a + x.stones, 0) };
}

export function stonesFor(s: GameState, stoneGain: number): number {
  if (!ascStatus(s).ok) return 0;
  return Math.max(1, Math.floor(stoneBreakdown(s, stoneGain).total));
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
  { id: 'diligent', name: 'Diligent Hands', icon: '🎁', desc: 'Goal rewards claim themselves', max: 1, baseCost: 6, growth: 1,
    effects: [{ stat: 'autoGoals', value: 1 }] },
  { id: 'instinct', name: 'Trained Instinct', icon: '📜', desc: 'Skill points spend themselves on the cheapest node available', max: 1, baseCost: 9, growth: 1,
    effects: [{ stat: 'autoSkills', value: 1 }] },
  { id: 'heirloom', name: 'Heirloom Armory', icon: '🗝️', desc: 'Keep your equipped gear when you ascend', max: 1, baseCost: 12, growth: 1,
    effects: [] },

  // ── What survives the Great Work ───────────────────────────
  // The Magnum Opus now unmakes everything it can, and each of these buys one thread back. They are
  // priced above the rest of the tree on purpose: a rank of Quicksilver makes a run faster, whereas one
  // of these changes what every run after it starts from.
  { id: 'mastery', name: 'Muscle Memory', icon: '🎖️', desc: 'Keep all proficiency levels when you ascend', max: 1, baseCost: 15, growth: 1,
    effects: [] },
  { id: 'archive', name: 'The Standing Archive', icon: '🏛️', desc: 'Keep finished studies when you ascend', max: 1, baseCost: 12, growth: 1,
    effects: [] },
  { id: 'company_legacy', name: 'Standing Company', icon: '🏕️', desc: 'Keep your adventurers, their relics and the depth they reached', max: 1, baseCost: 10, growth: 1,
    effects: [] },
  { id: 'menagerie', name: 'The Menagerie', icon: '🐾', desc: 'Keep your familiars when you ascend', max: 1, baseCost: 8, growth: 1,
    effects: [] },
  { id: 'seedvault', name: 'The Seed Vault', icon: '🫙', desc: 'Keep the seed catalogue and every strain you have bred', max: 1, baseCost: 6, growth: 1,
    effects: [] },
];

/**
 * Every thread the Great Work can spare, and the node that spares it.
 *
 * The Magnum Opus resets everything it possibly can: the tree is meant to be the only permanence in the
 * game, so that a rebirth is a real beginning and the tree is what you are playing for. What is left out
 * of this list is left out deliberately — see `newState`.
 */
export const RETENTION: { node: string; label: string }[] = [
  { node: 'mastery', label: 'proficiency' },
  { node: 'archive', label: 'finished studies' },
  { node: 'loyal', label: 'apprentices and their trees' },
  { node: 'company_legacy', label: 'the company and its relics' },
  { node: 'menagerie', label: 'familiars' },
  { node: 'seedvault', label: 'the seed catalogue and strains' },
  { node: 'arcane_memory', label: 'spells and their ranks' },
  { node: 'heirloom', label: 'equipped gear' },
];

export const ASC_MAP: Record<string, AscNode> = Object.fromEntries(ASC_NODES.map((a) => [a.id, a]));

export function ascCost(node: AscNode, owned: number): number {
  return Math.ceil(node.baseCost * node.growth ** owned);
}

/** Starting gold from Inheritance ranks. */
export function startGoldFor(ranks: number): number {
  return ranks <= 0 ? 0 : 500 * 5 ** (ranks - 1);
}
