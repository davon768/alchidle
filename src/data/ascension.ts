import type { Effect, GameState } from '../core/types';

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
export const ASC_MIN_GOLD = 600_000;

/**
 * What each further ascension demands. Nearly everything that earns gold is permanent — research,
 * proficiency, apprentices, familiars, stone resonance — so a flat target made every run shorter than
 * the last: measured at 77, 40, 31 and 22 minutes. The target has to outgrow the compounding, or the
 * Great Work stops being a milestone and becomes a lap counter.
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
  return Math.min(60, 15 + 3 * count);
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
 * 3 stones at the first target, then the square root of gold earned (4× gold = 2× stones). Measured
 * against the *first* target rather than the current one, so a run that clears a bigger gate is worth
 * more stones: roughly 1.6× per ascension at the minimum.
 */
export function stonesFor(runGold: number, stoneGain: number, count = 0): number {
  if (runGold < ascGoldTarget(count)) return 0;
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
