import type { Effect } from '../core/types';

export interface SkillTreeDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
}

export interface SkillNode {
  id: string;
  tree: string;
  name: string;
  icon: string;
  row: number; // row N requires N * ROW_POINTS points spent in this tree
  maxRank: number; // 0 = infinite
  cost: number; // skill points per rank (infinite nodes grow +1 every 5 ranks)
  effects: Effect[]; // per rank
  req?: { id: string; rank: number }[];
  flavor?: string;
}

export const ROW_POINTS = 4;

export const SKILL_TREES: SkillTreeDef[] = [
  { id: 'herb', name: 'Herbalism', icon: '🌿', color: '#5fd068', desc: 'Grow faster, harvest more, tend more plots.' },
  { id: 'alch', name: 'Alchemy', icon: '⚗️', color: '#b57bff', desc: 'Brew faster, waste less, double your output.' },
  { id: 'comm', name: 'Commerce', icon: '💰', color: '#f5c542', desc: 'Sell higher, trade smarter, win the guilds.' },
  { id: 'expl', name: 'Exploration', icon: '🧭', color: '#4fb3ff', desc: 'Faster expeditions, bigger hauls, rarer finds.' },
  { id: 'arca', name: 'Arcana', icon: '✨', color: '#ff7ad9', desc: 'Time, knowledge and the Great Work itself.' },
  { id: 'war', name: 'Battlemage', icon: '⚔️', color: '#ff5c5c', desc: 'Blade, spell and bottle: master dungeon combat.' },
];

const n = (
  tree: string, id: string, name: string, icon: string, row: number, maxRank: number, cost: number,
  effects: Effect[], req?: { id: string; rank: number }[], flavor?: string,
): SkillNode => ({ id, tree, name, icon, row, maxRank, cost, effects, req, flavor });

export const SKILLS: SkillNode[] = [
  // ── Herbalism ─────────────────────────────────────────────
  n('herb', 'green_thumb', 'Green Thumb', '👍', 0, 10, 1, [{ stat: 'growSpeed', value: 0.08 }]),
  n('herb', 'herb_lore', 'Herb Lore', '📗', 0, 5, 1, [{ stat: 'xpGain', value: 0.04 }]),
  n('herb', 'bountiful', 'Bountiful Harvest', '🧺', 1, 10, 1, [{ stat: 'harvestYield', value: 0.06 }], [{ id: 'green_thumb', rank: 1 }]),
  n('herb', 'frugal_sower', 'Frugal Sower', '🪙', 1, 10, 1, [{ stat: 'seedDiscount', value: 0.04 }], [{ id: 'green_thumb', rank: 1 }]),
  n('herb', 'deep_roots', 'Deep Roots', '🌳', 2, 3, 2, [{ stat: 'plots', value: 1 }], [{ id: 'bountiful', rank: 3 }]),
  n('herb', 'moon_cycle', 'Lunar Cycles', '🌗', 2, 5, 1, [{ stat: 'growSpeed', value: 0.1 }], [{ id: 'green_thumb', rank: 5 }]),
  n('herb', 'gnome_friend', 'Friend of Gnomes', '🧙', 3, 1, 3, [{ stat: 'autoHarvest', value: 1 }], [{ id: 'deep_roots', rank: 1 }],
    'Garden gnomes harvest and replant for you.'),
  n('herb', 'twin_sprout', 'Twin Sprouts', '🌱', 3, 5, 2, [{ stat: 'harvestYield', value: 0.1 }], [{ id: 'bountiful', rank: 5 }]),
  n('herb', 'verdant_heart', 'Verdant Heart', '💚', 4, 5, 2, [{ stat: 'harvestYield', value: 0.15 }, { stat: 'growSpeed', value: 0.05 }], [{ id: 'twin_sprout', rank: 3 }]),
  n('herb', 'world_tree', 'Seed of the World Tree', '🌲', 5, 2, 4, [{ stat: 'plots', value: 1 }], [{ id: 'verdant_heart', rank: 3 }, { id: 'deep_roots', rank: 3 }]),
  n('herb', 'endless_growth', 'Endless Growth', '♾️', 6, 0, 2, [{ stat: 'growSpeed', value: 0.02 }, { stat: 'harvestYield', value: 0.02 }], [{ id: 'world_tree', rank: 1 }],
    'Infinite rank. Sink for late-game skill points.'),

  // ── Alchemy ───────────────────────────────────────────────
  n('alch', 'steady_hand', 'Steady Hand', '✋', 0, 10, 1, [{ stat: 'brewSpeed', value: 0.08 }]),
  n('alch', 'apprentice_study', 'Apprentice Studies', '📜', 0, 10, 1, [{ stat: 'xpGain', value: 0.06 }]),
  n('alch', 'precise_measure', 'Precise Measures', '⚖️', 1, 10, 1, [{ stat: 'ingredientSave', value: 0.03 }], [{ id: 'steady_hand', rank: 1 }]),
  n('alch', 'mastery_focus', 'Focused Practice', '🎯', 1, 10, 1, [{ stat: 'masteryRate', value: 0.1 }], [{ id: 'apprentice_study', rank: 3 }]),
  n('alch', 'alembic', 'Alembic Mastery', '🏺', 2, 3, 2, [{ stat: 'cauldrons', value: 1 }], [{ id: 'steady_hand', rank: 3 }]),
  n('alch', 'double_distill', 'Double Distillation', '⚗️', 2, 10, 1, [{ stat: 'doubleBrew', value: 0.03 }], [{ id: 'precise_measure', rank: 3 }]),
  n('alch', 'perpetual_flame', 'Perpetual Flame', '🕯️', 3, 1, 2, [{ stat: 'autoBrew', value: 1 }], [{ id: 'alembic', rank: 1 }],
    'Cauldrons can repeat their recipe automatically.'),
  n('alch', 'volatile_catalyst', 'Volatile Catalyst', '💥', 3, 5, 2, [{ stat: 'brewSpeed', value: 0.12 }], [{ id: 'steady_hand', rank: 8 }]),
  n('alch', 'quintessence', 'Quintessence', '💫', 4, 5, 2, [{ stat: 'doubleBrew', value: 0.05 }], [{ id: 'double_distill', rank: 5 }]),
  n('alch', 'grand_athanor', 'Grand Athanor', '🔥', 5, 2, 4, [{ stat: 'cauldrons', value: 1 }], [{ id: 'volatile_catalyst', rank: 3 }, { id: 'alembic', rank: 3 }]),
  n('alch', 'endless_distill', 'Endless Distillation', '♾️', 6, 0, 2, [{ stat: 'brewSpeed', value: 0.03 }, { stat: 'masteryRate', value: 0.02 }], [{ id: 'grand_athanor', rank: 1 }],
    'Infinite rank.'),

  // ── Commerce ──────────────────────────────────────────────
  n('comm', 'haggler', 'Haggler', '🗣️', 0, 10, 1, [{ stat: 'sellPrice', value: 0.05 }]),
  n('comm', 'bulk_dealer', 'Bulk Dealer', '📦', 0, 10, 1, [{ stat: 'contractReward', value: 0.06 }]),
  n('comm', 'word_of_mouth', 'Word of Mouth', '📣', 1, 10, 1, [{ stat: 'demandRecovery', value: 0.1 }], [{ id: 'haggler', rank: 1 }]),
  n('comm', 'guild_liaison', 'Guild Liaison', '🤝', 1, 10, 1, [{ stat: 'repGain', value: 0.08 }], [{ id: 'bulk_dealer', rank: 1 }]),
  n('comm', 'silver_tongue', 'Silver Tongue', '👅', 2, 10, 1, [{ stat: 'tradeBonus', value: 0.05 }], [{ id: 'haggler', rank: 3 }]),
  n('comm', 'premium_labels', 'Premium Labels', '🏷️', 2, 5, 2, [{ stat: 'sellPrice', value: 0.1 }], [{ id: 'haggler', rank: 5 }]),
  n('comm', 'shop_assistant', 'Shop Assistant', '🧑‍💼', 3, 1, 3, [{ stat: 'autoSell', value: 1 }], [{ id: 'word_of_mouth', rank: 3 }],
    'Automatically sell potions you mark for auto-sale.'),
  n('comm', 'market_maker', 'Market Maker', '📈', 3, 5, 2, [{ stat: 'demandRecovery', value: 0.2 }], [{ id: 'word_of_mouth', rank: 5 }]),
  n('comm', 'merchant_prince', 'Merchant Prince', '👑', 4, 5, 2, [{ stat: 'sellPrice', value: 0.15 }], [{ id: 'premium_labels', rank: 3 }]),
  n('comm', 'trade_empire', 'Trade Empire', '🐪', 5, 5, 3, [{ stat: 'tradeBonus', value: 0.1 }, { stat: 'contractReward', value: 0.1 }], [{ id: 'silver_tongue', rank: 5 }, { id: 'merchant_prince', rank: 1 }]),
  n('comm', 'endless_fortune', 'Endless Fortune', '♾️', 6, 0, 2, [{ stat: 'sellPrice', value: 0.03 }], [{ id: 'merchant_prince', rank: 3 }],
    'Infinite rank.'),

  // ── Exploration ───────────────────────────────────────────
  n('expl', 'trailblazer', 'Trailblazer', '🥾', 0, 10, 1, [{ stat: 'scavSpeed', value: 0.08 }]),
  n('expl', 'keen_eye', 'Keen Eye', '👁️', 1, 10, 1, [{ stat: 'scavYield', value: 0.06 }], [{ id: 'trailblazer', rank: 1 }]),
  n('expl', 'treasure_sense', 'Treasure Sense', '🗝️', 1, 10, 1, [{ stat: 'rareFind', value: 0.1 }], [{ id: 'trailblazer', rank: 2 }]),
  n('expl', 'second_pack', 'Second Pack', '🎒', 2, 2, 2, [{ stat: 'expSlots', value: 1 }], [{ id: 'trailblazer', rank: 3 }]),
  n('expl', 'survivalist', 'Survivalist', '🏕️', 2, 5, 1, [{ stat: 'scavSpeed', value: 0.1 }], [{ id: 'trailblazer', rank: 5 }]),
  n('expl', 'familiar_scout', 'Familiar Scout', '🦅', 3, 1, 3, [{ stat: 'autoScav', value: 1 }], [{ id: 'second_pack', rank: 1 }],
    'Expeditions can repeat automatically.'),
  n('expl', 'cartographer', 'Cartographer', '🗺️', 3, 5, 2, [{ stat: 'scavYield', value: 0.12 }], [{ id: 'keen_eye', rank: 5 }]),
  n('expl', 'rift_walker', 'Rift Walker', '🌀', 4, 5, 2, [{ stat: 'scavYield', value: 0.1 }, { stat: 'rareFind', value: 0.1 }], [{ id: 'cartographer', rank: 2 }]),
  n('expl', 'third_pack', 'Bottomless Bag', '👜', 5, 1, 4, [{ stat: 'expSlots', value: 1 }], [{ id: 'second_pack', rank: 2 }, { id: 'survivalist', rank: 3 }]),
  n('expl', 'endless_journey', 'Endless Journey', '♾️', 6, 0, 2, [{ stat: 'scavSpeed', value: 0.02 }, { stat: 'scavYield', value: 0.02 }], [{ id: 'rift_walker', rank: 1 }],
    'Infinite rank.'),

  // ── Arcana ────────────────────────────────────────────────
  n('arca', 'arcane_focus', 'Arcane Focus', '🔯', 0, 10, 1, [{ stat: 'xpGain', value: 0.05 }]),
  n('arca', 'time_weaving', 'Time Weaving', '⏳', 0, 8, 1, [{ stat: 'offlineHours', value: 1 }]),
  n('arca', 'chronomancy', 'Chronomancy', '🕰️', 1, 10, 2, [
    { stat: 'growSpeed', value: 0.03 }, { stat: 'brewSpeed', value: 0.03 }, { stat: 'scavSpeed', value: 0.03 },
  ], [{ id: 'time_weaving', rank: 2 }]),
  n('arca', 'transmute_insight', 'Transmutation Insight', '🜔', 1, 10, 2, [{ stat: 'stoneGain', value: 0.05 }], [{ id: 'arcane_focus', rank: 3 }]),
  n('arca', 'golden_aura', 'Golden Aura', '🌟', 2, 5, 2, [{ stat: 'sellPrice', value: 0.05 }, { stat: 'harvestYield', value: 0.05 }], [{ id: 'arcane_focus', rank: 5 }]),
  n('arca', 'sage_mind', 'Sage Mind', '🧠', 2, 5, 2, [{ stat: 'masteryRate', value: 0.1 }, { stat: 'xpGain', value: 0.05 }], [{ id: 'arcane_focus', rank: 5 }]),
  n('arca', 'astral_attune', 'Astral Attunement', '🌌', 4, 1, 5, [{ stat: 'plots', value: 1 }, { stat: 'cauldrons', value: 1 }, { stat: 'expSlots', value: 1 }],
    [{ id: 'chronomancy', rank: 5 }, { id: 'golden_aura', rank: 3 }]),
  n('arca', 'endless_arcana', 'The Great Work', '♾️', 5, 0, 3, [
    { stat: 'growSpeed', value: 0.01 }, { stat: 'brewSpeed', value: 0.01 }, { stat: 'scavSpeed', value: 0.01 },
    { stat: 'sellPrice', value: 0.01 }, { stat: 'stoneGain', value: 0.01 },
  ], [{ id: 'astral_attune', rank: 1 }], 'Infinite rank. A little of everything, forever.'),

  // ── Battlemage ────────────────────────────────────────────
  n('war', 'weapon_training', 'Weapon Training', '🗡️', 0, 10, 1, [{ stat: 'attackMult', value: 0.06 }]),
  n('war', 'toughness', 'Toughness', '🫀', 0, 10, 1, [{ stat: 'hpMult', value: 0.08 }]),
  n('war', 'guard', 'Guard Stance', '🛡️', 1, 10, 1, [{ stat: 'defenseMult', value: 0.06 }], [{ id: 'toughness', rank: 1 }]),
  n('war', 'mana_well', 'Mana Well', '🫧', 1, 10, 1, [{ stat: 'maxMana', value: 20 }, { stat: 'manaRegen', value: 0.2 }], [{ id: 'weapon_training', rank: 1 }]),
  n('war', 'spell_slot', 'Spell Weaving', '📘', 2, 2, 3, [{ stat: 'spellSlots', value: 1 }], [{ id: 'mana_well', rank: 3 }]),
  n('war', 'keen_edge', 'Keen Edge', '🎯', 2, 10, 1, [{ stat: 'critChance', value: 0.02 }], [{ id: 'weapon_training', rank: 3 }]),
  n('war', 'potion_belt', 'Quick-Draw Belt', '🧪', 3, 2, 3, [{ stat: 'potionSlots', value: 1 }], [{ id: 'guard', rank: 3 }]),
  n('war', 'arcane_might', 'Arcane Might', '🔮', 3, 10, 1, [{ stat: 'spellMult', value: 0.08 }], [{ id: 'mana_well', rank: 5 }]),
  n('war', 'ritualist', 'Ritualist', '🕯️', 4, 1, 3, [{ stat: 'autoRitual', value: 1 }], [{ id: 'spell_slot', rank: 1 }],
    'Rituals marked "auto" recast themselves when they expire.'),
  n('war', 'evasion', 'Evasion', '💨', 4, 5, 2, [{ stat: 'dodge', value: 0.02 }], [{ id: 'keen_edge', rank: 3 }]),
  n('war', 'brutality', 'Brutality', '💥', 4, 10, 1, [{ stat: 'critDamage', value: 0.1 }], [{ id: 'keen_edge', rank: 5 }]),
  n('war', 'field_alchemy', 'Field Alchemy', '⚗️', 5, 10, 1, [{ stat: 'potionPower', value: 0.1 }], [{ id: 'potion_belt', rank: 1 }],
    'Your combat potions hit harder — the alchemist\'s edge.'),
  n('war', 'treasure_hunter', 'Treasure Hunter', '💰', 5, 10, 1, [{ stat: 'lootFind', value: 0.1 }], [{ id: 'evasion', rank: 1 }]),
  n('war', 'endless_war', 'Endless War', '♾️', 6, 0, 2, [
    { stat: 'attackMult', value: 0.02 }, { stat: 'hpMult', value: 0.02 }, { stat: 'spellMult', value: 0.02 },
  ], [{ id: 'field_alchemy', rank: 3 }], 'Infinite rank.'),
];

export const SKILL_MAP: Record<string, SkillNode> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export function skillRankCost(node: SkillNode, rank: number): number {
  return node.maxRank === 0 ? node.cost + Math.floor(rank / 5) : node.cost;
}
