/**
 * Apprentices: one per craft, unlocked through the Library, levelled by doing their work, and shaped
 * by an upgrade tree you spend their skill points in.
 *
 * There is no hiring, no candidate list and no rolling for talents or traits. An apprentice is not a
 * lucky draw you keep rerolling for — it is a long-running investment you direct. Every level is one
 * skill point, and where those points go decides whether your Gardener tends many beds badly or few
 * beds superbly. Their levels and spent points survive ascension, like proficiency and research.
 */
import type { Effect, RoleId, StatKey } from '../core/types';
import type { ProfKind } from './proficiency';

export type { RoleId };

/** One node of a role's upgrade tree. */
export interface ApprenticeNode {
  id: string;
  name: string;
  icon: string;
  row: number; // needs row × APPR_ROW_POINTS points already spent in this tree
  maxRank: number; // 0 = infinite
  cost: number; // skill points per rank
  effects?: Effect[]; // per rank, applied while the apprentice is on the job
  capacity?: number; // per rank, added to how many units this apprentice tends
  flavor?: string;
}

export interface RoleDef {
  id: RoleId;
  name: string;
  icon: string;
  desc: string;
  unit: string; // what they tend: plot, cauldron, party…
  baseCapacity: number; // tended before any capacity node is bought
  mentor?: ProfKind; // your own proficiency in this craft speeds their learning
  tree: ApprenticeNode[];
}

const e = (stat: StatKey, value: number): Effect => ({ stat, value });

/** Points that must already be spent in a tree before its next row opens. */
export const APPR_ROW_POINTS = 3;
/** Levels an apprentice can reach; each is one skill point. */
export const APPRENTICE_MAX = 60;

const endless = (id: string, name: string, icon: string, effects: Effect[], flavor: string): ApprenticeNode =>
  ({ id, name, icon, row: 3, maxRank: 0, cost: 3, effects, flavor });

export const ROLES: RoleDef[] = [
  {
    id: 'gardener', name: 'Gardener', icon: '🧑‍🌾', unit: 'plot', baseCapacity: 2, mentor: 'plant',
    desc: 'Harvests and replants the plots they tend.',
    tree: [
      { id: 'g_beds', name: 'More Beds', icon: '🟫', row: 0, maxRank: 10, cost: 1, capacity: 1,
        flavor: 'Tends one more plot.' },
      { id: 'g_steady', name: 'Steady Hands', icon: '✋', row: 0, maxRank: 10, cost: 1, effects: [e('growSpeed', 0.04)] },
      { id: 'g_baskets', name: 'Full Baskets', icon: '🧺', row: 1, maxRank: 10, cost: 1, effects: [e('harvestYield', 0.05)] },
      { id: 'g_thrift', name: 'Thrifty Sower', icon: '🪙', row: 2, maxRank: 8, cost: 2, effects: [e('seedDiscount', 0.03)] },
      { id: 'g_mutagen', name: 'Curious Grafter', icon: '🌾', row: 2, maxRank: 5, cost: 2, effects: [e('mutationChance', 0.1)],
        flavor: 'Cross-breeds turn up more often.' },
      endless('g_endless', 'Green Forever', '♾️', [e('growSpeed', 0.02), e('harvestYield', 0.02)], 'Infinite rank.'),
    ],
  },
  {
    id: 'brewer', name: 'Brewer', icon: '🧑‍🔬', unit: 'cauldron', baseCapacity: 1, mentor: 'potion',
    desc: 'Keeps the cauldrons they tend on 🔁 repeat.',
    tree: [
      { id: 'b_cauldrons', name: 'Another Burner', icon: '⚗️', row: 0, maxRank: 8, cost: 1, capacity: 1,
        flavor: 'Tends one more cauldron.' },
      { id: 'b_steady', name: 'Even Heat', icon: '🔥', row: 0, maxRank: 10, cost: 1, effects: [e('brewSpeed', 0.04)] },
      { id: 'b_double', name: 'Double Distillation', icon: '💧', row: 1, maxRank: 10, cost: 1, effects: [e('doubleBrew', 0.02)] },
      { id: 'b_stir', name: 'Practised Stir', icon: '🥄', row: 1, maxRank: 5, cost: 1, effects: [e('autoStir', 0.12)],
        flavor: 'Stirs the pot unprompted, so brews you never touch still come out finer.' },
      { id: 'b_thrift', name: 'Careful Measures', icon: '⚖️', row: 2, maxRank: 8, cost: 2, effects: [e('ingredientSave', 0.02)] },
      { id: 'b_fine', name: 'Fine Hand', icon: '✦', row: 2, maxRank: 8, cost: 2, effects: [e('brewQuality', 0.02)],
        flavor: 'Better odds of Fine, Masterwork and Legendary.' },
      endless('b_endless', 'Distilling Forever', '♾️', [e('brewSpeed', 0.02), e('masteryRate', 0.02)], 'Infinite rank.'),
    ],
  },
  {
    id: 'scout', name: 'Scout', icon: '🧝', unit: 'party', baseCapacity: 1,
    desc: 'Sends the expedition parties they tend back out on 🔁 repeat.',
    tree: [
      { id: 's_parties', name: 'Second Party', icon: '🧭', row: 0, maxRank: 6, cost: 2, capacity: 1,
        flavor: 'Tends one more party.' },
      { id: 's_swift', name: 'Swift March', icon: '💨', row: 0, maxRank: 10, cost: 1, effects: [e('scavSpeed', 0.04)] },
      { id: 's_haul', name: 'Bigger Packs', icon: '🎒', row: 1, maxRank: 10, cost: 1, effects: [e('scavYield', 0.05)] },
      { id: 's_keen', name: 'Keen Eye', icon: '👁️', row: 2, maxRank: 8, cost: 2, effects: [e('rareFind', 0.08)],
        flavor: 'Rare finds, and familiars, turn up sooner.' },
      endless('s_endless', 'Ever Onward', '♾️', [e('scavSpeed', 0.02), e('scavYield', 0.02)], 'Infinite rank.'),
    ],
  },
  {
    id: 'shopkeeper', name: 'Shopkeeper', icon: '🧑‍💼', unit: 'potion type', baseCapacity: 1,
    desc: 'Auto-sells the potion types you mark in the Market as they finish brewing.',
    tree: [
      { id: 'k_stalls', name: 'Wider Counter', icon: '🏪', row: 0, maxRank: 8, cost: 1, capacity: 1,
        flavor: 'Auto-sells one more potion type.' },
      { id: 'k_haggle', name: 'Haggling', icon: '💬', row: 0, maxRank: 10, cost: 1, effects: [e('sellPrice', 0.03)] },
      { id: 'k_demand', name: 'Word of Mouth', icon: '📣', row: 1, maxRank: 8, cost: 1, effects: [e('demandRecovery', 0.1)],
        flavor: 'Markets recover faster from a glut.' },
      { id: 'k_contracts', name: 'Guild Standing', icon: '📜', row: 2, maxRank: 8, cost: 2, effects: [e('contractReward', 0.06)] },
      { id: 'k_rep', name: 'Reputation', icon: '🛡️', row: 2, maxRank: 6, cost: 2, effects: [e('repGain', 0.08)] },
      endless('k_endless', 'Always Trading', '♾️', [e('sellPrice', 0.015), e('tradeBonus', 0.015)], 'Infinite rank.'),
    ],
  },
  {
    id: 'squire', name: 'Squire', icon: '🤺', unit: 'dungeon', baseCapacity: 1,
    desc: 'After you retreat from a floor, turns auto-advance back on to push deeper again.',
    tree: [
      { id: 'q_valor', name: 'Valor', icon: '⚔️', row: 0, maxRank: 10, cost: 1, effects: [e('attackMult', 0.03)] },
      { id: 'q_guard', name: 'Shield Work', icon: '🛡️', row: 0, maxRank: 10, cost: 1, effects: [e('defenseMult', 0.03)] },
      { id: 'q_vigor', name: 'Vigor', icon: '❤️', row: 1, maxRank: 8, cost: 1, effects: [e('hpMult', 0.04)] },
      { id: 'q_potions', name: 'Belt Drill', icon: '🧪', row: 2, maxRank: 8, cost: 2, effects: [e('potionPower', 0.04)] },
      { id: 'q_loot', name: 'Sharp Eyes', icon: '💰', row: 2, maxRank: 8, cost: 2, effects: [e('lootFind', 0.06)] },
      endless('q_endless', 'Ever Deeper', '♾️', [e('attackMult', 0.015), e('defenseMult', 0.015)], 'Infinite rank.'),
    ],
  },
  {
    id: 'scribe', name: 'Scribe', icon: '🧙', unit: 'ritual', baseCapacity: 1, mentor: 'reagent',
    desc: 'Recasts the rituals you mark as Auto whenever they expire.',
    tree: [
      { id: 'c_rituals', name: 'Second Circle', icon: '🕯️', row: 0, maxRank: 6, cost: 2, capacity: 1,
        flavor: 'Tends one more ritual.' },
      { id: 'c_flow', name: 'Mana Flow', icon: '🫧', row: 0, maxRank: 10, cost: 1, effects: [e('manaRegen', 0.15)] },
      { id: 'c_pool', name: 'Deeper Well', icon: '💎', row: 1, maxRank: 10, cost: 1, effects: [e('maxMana', 15)] },
      { id: 'c_power', name: 'Sigil Craft', icon: '✨', row: 2, maxRank: 8, cost: 2, effects: [e('spellMult', 0.04)] },
      { id: 'c_research', name: 'Careful Copyist', icon: '📚', row: 2, maxRank: 6, cost: 2, effects: [e('researchSpeed', 0.05)],
        flavor: 'Studies in the Library finish sooner.' },
      endless('c_endless', 'Ink Without End', '♾️', [e('manaRegen', 0.08), e('spellMult', 0.015)], 'Infinite rank.'),
    ],
  },
];

export const ROLE_MAP: Record<RoleId, RoleDef> = Object.fromEntries(ROLES.map((r) => [r.id, r])) as Record<RoleId, RoleDef>;
export const NODE_MAP: Record<string, ApprenticeNode> = Object.fromEntries(ROLES.flatMap((r) => r.tree.map((n) => [n.id, n])));
export const roleOfNode: Record<string, RoleId> = Object.fromEntries(ROLES.flatMap((r) => r.tree.map((n) => [n.id, r.id])));

export const NAMES: Record<RoleId, string> = {
  gardener: 'Bramble', brewer: 'Cinder', scout: 'Talon', shopkeeper: 'Pip', squire: 'Rook', scribe: 'Quill',
};

// ── Levels and points ────────────────────────────────────────
/**
 * XP from level L to L+1. Work is the only source now, so this is tuned against what an actively used
 * apprentice actually earns: roughly level 20 by a first ascension, 50 after a long haul.
 */
export function apprXpToNext(level: number): number {
  return Math.floor(8 * 1.1 ** (level - 1));
}

const CUM: number[] = [0, 0];
for (let L = 1; L < APPRENTICE_MAX; L++) CUM[L + 1] = CUM[L] + apprXpToNext(L);

export function apprenticeLevel(xp: number): number {
  let lo = 1;
  let hi = APPRENTICE_MAX;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (CUM[mid] <= xp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function apprenticeProgress(xp: number): { level: number; into: number; need: number } {
  const level = apprenticeLevel(xp);
  if (level >= APPRENTICE_MAX) return { level, into: 1, need: 1 };
  return { level, into: xp - CUM[level], need: CUM[level + 1] - CUM[level] };
}

/** Total XP to reach a level — used when migrating older saves. */
export const apprXpForLevel = (level: number): number => CUM[Math.max(1, Math.min(APPRENTICE_MAX, level))] ?? 0;

/** Cost of the next rank of a node; infinite-rank nodes get steadily dearer. */
export function nodeRankCost(node: ApprenticeNode, rank: number): number {
  return node.maxRank === 0 ? node.cost + Math.floor(rank / 4) : node.cost;
}
