/**
 * Workshop upgrades: gold spent on the run you are in. Everything here resets on ascension, which is
 * what separates it from the ascension tree, research and proficiency.
 *
 * Two rules shape the list. **It must reach as far as the content does** — it used to stop at level 20
 * when the game ended around 40, leaving a level-60 player with nothing to buy and no sink for a purse
 * measured in millions. And **it never sells automation**: the `auto*` capacities come from apprentices
 * and nowhere else. Capacity here means space — another bed, another cauldron, another adventurer on
 * the roster — never someone to tend it for you.
 *
 * Each upgrade belongs to the system it serves, so the Workshop reads as a list of ways to improve the
 * parts of the game you are actually playing rather than one undifferentiated wall of cards.
 */
import type { Effect } from '../core/types';

export type UpgradeGroup = 'garden' | 'brew' | 'market' | 'explore' | 'company' | 'study' | 'combat' | 'meta';

export const GROUP_INFO: Record<UpgradeGroup, { label: string; icon: string }> = {
  garden: { label: 'Garden', icon: '🌱' },
  brew: { label: 'Cauldrons', icon: '⚗️' },
  market: { label: 'Market', icon: '🏪' },
  explore: { label: 'Expeditions', icon: '🧭' },
  company: { label: 'The Company', icon: '🏕️' },
  study: { label: 'Study', icon: '📚' },
  combat: { label: 'Adventure', icon: '⚔️' },
  meta: { label: 'The Long Game', icon: '🌟' },
};

export const GROUPS = Object.keys(GROUP_INFO) as UpgradeGroup[];

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  group: UpgradeGroup;
  level: number; // player level required to see it
  baseCost: number;
  growth: number;
  max: number; // 0 = infinite
  /** A research id that must be finished first: this upgrade extends a system that study opens. */
  req?: string;
  effects: Effect[]; // per level
}

export const UPGRADES: UpgradeDef[] = [
  // ── Garden ─────────────────────────────────────────────────
  { id: 'plot', name: 'Garden Plot', icon: '🟫', group: 'garden', desc: 'Till another plot of soil.', level: 1, baseCost: 25, growth: 2.6, max: 8, effects: [{ stat: 'plots', value: 1 }] },
  { id: 'fertilizer', name: 'Mandrake Fertilizer', icon: '💩', group: 'garden', desc: 'Bigger harvests.', level: 1, baseCost: 30, growth: 1.85, max: 0, effects: [{ stat: 'harvestYield', value: 0.1 }] },
  { id: 'sundial', name: 'Enchanted Sundial', icon: '☀️', group: 'garden', desc: 'Plants grow faster.', level: 2, baseCost: 40, growth: 1.9, max: 0, effects: [{ stat: 'growSpeed', value: 0.1 }] },
  { id: 'seedbank', name: 'Seed Bank', icon: '🫙', group: 'garden', desc: 'Sowing costs less, and a full bank keeps the beds turning when gold is tight.', level: 14, baseCost: 6000, growth: 2.1, max: 8, effects: [{ stat: 'seedDiscount', value: 0.05 }] },
  { id: 'grafting', name: 'Grafting Bench', icon: '🌾', group: 'garden', desc: 'Neighbouring beds cross far more often, so new strains turn up for the seed tray.', level: 26, baseCost: 150000, growth: 2.1, max: 0, effects: [{ stat: 'mutationChance', value: 0.15 }] },
  { id: 'greenhouse', name: 'Glass Greenhouse', icon: '🏡', group: 'garden', desc: 'Beds under glass, past what the yard holds.', level: 32, baseCost: 900000, growth: 4.5, max: 4, effects: [{ stat: 'plots', value: 1 }] },

  // ── Cauldrons ──────────────────────────────────────────────
  { id: 'cauldron', name: 'Copper Cauldron', icon: '🍲', group: 'brew', desc: 'Brew another potion at once.', level: 2, baseCost: 200, growth: 5, max: 5, effects: [{ stat: 'cauldrons', value: 1 }] },
  { id: 'bellows', name: 'Dwarven Bellows', icon: '🌬️', group: 'brew', desc: 'Cauldrons boil faster.', level: 2, baseCost: 60, growth: 1.9, max: 0, effects: [{ stat: 'brewSpeed', value: 0.1 }] },
  { id: 'glassware', name: 'Finer Glassware', icon: '🧫', group: 'brew', desc: 'Better odds of Fine, Masterwork and Legendary bottles.', level: 16, baseCost: 9000, growth: 2.15, max: 0, effects: [{ stat: 'brewQuality', value: 0.02 }] },
  { id: 'condenser', name: 'Reflux Condenser', icon: '🌀', group: 'brew', desc: 'Some ingredients come back out of the steam.', level: 24, baseCost: 60000, growth: 2.2, max: 12, effects: [{ stat: 'ingredientSave', value: 0.02 }] },
  { id: 'twinburner', name: 'Twin Burner', icon: '🔥', group: 'brew', desc: 'A chance the batch comes out double.', level: 30, baseCost: 350000, growth: 2.25, max: 12, effects: [{ stat: 'doubleBrew', value: 0.02 }] },
  { id: 'crucible', name: 'Philosopher\'s Crucible', icon: '⚱️', group: 'brew', desc: 'The finest glassware money can buy, and it shows in every bottle.', level: 52, baseCost: 2.5e8, growth: 2.4, max: 0, effects: [{ stat: 'brewQuality', value: 0.03 }, { stat: 'brewSpeed', value: 0.08 }] },

  // ── Market ─────────────────────────────────────────────────
  { id: 'labels', name: 'Fancy Labels', icon: '🏷️', group: 'market', desc: 'Customers pay more.', level: 3, baseCost: 80, growth: 1.95, max: 0, effects: [{ stat: 'sellPrice', value: 0.08 }] },
  { id: 'criers', name: 'Town Criers', icon: '📣', group: 'market', desc: 'Word spreads, so a flooded market recovers sooner.', level: 20, baseCost: 30000, growth: 2, max: 0, effects: [{ stat: 'demandRecovery', value: 0.15 }] },
  { id: 'caravan', name: 'Caravan Rights', icon: '🐪', group: 'market', desc: 'Better terms at the Trading Post.', level: 28, baseCost: 250000, growth: 2.05, max: 0, effects: [{ stat: 'tradeBonus', value: 0.08 }] },
  { id: 'ledger', name: 'Guild Standing', icon: '📒', group: 'market', desc: 'More reputation per contract.', level: 8, baseCost: 1000, growth: 1.9, max: 0, effects: [{ stat: 'repGain', value: 0.1 }] },
  { id: 'seal', name: 'Guildmaster\'s Seal', icon: '🔏', group: 'market', desc: 'Contracts pay what they ought to.', level: 34, baseCost: 1.2e6, growth: 2.1, max: 0, effects: [{ stat: 'contractReward', value: 0.1 }] },

  // ── Expeditions ────────────────────────────────────────────
  { id: 'boots', name: 'Seven-League Boots', icon: '👢', group: 'explore', desc: 'Expeditions finish faster.', level: 3, baseCost: 100, growth: 1.85, max: 0, effects: [{ stat: 'scavSpeed', value: 0.1 }] },
  { id: 'satchel', name: 'Expedition Pack', icon: '🎒', group: 'explore', desc: 'Run another expedition at once.', level: 5, baseCost: 500, growth: 6, max: 3, effects: [{ stat: 'expSlots', value: 1 }] },
  { id: 'sieve', name: 'Silver Sieve', icon: '🥄', group: 'explore', desc: 'Find more on expeditions.', level: 5, baseCost: 120, growth: 1.85, max: 0, effects: [{ stat: 'scavYield', value: 0.08 }] },
  { id: 'lodestone', name: 'Prospector\'s Lodestone', icon: '🧲', group: 'explore', desc: 'Rare finds — and familiars — turn up sooner.', level: 22, baseCost: 45000, growth: 2.05, max: 0, effects: [{ stat: 'rareFind', value: 0.06 }] },
  { id: 'outpost', name: 'Forward Outpost', icon: '⛺', group: 'explore', desc: 'A base far enough out to run another party from.', level: 44, baseCost: 2.5e7, growth: 8, max: 2, effects: [{ stat: 'expSlots', value: 1 }] },

  // ── The Company ────────────────────────────────────────────
  { id: 'bunkhouse', name: 'Bunkhouse', icon: '🛖', group: 'company', desc: 'Room for another adventurer on the roster.', level: 38, baseCost: 1.2e7, growth: 9, max: 2, req: 'company', effects: [{ stat: 'partySlots', value: 1 }] },
  { id: 'packmules', name: 'Pack Mules', icon: '🫏', group: 'company', desc: 'One more potion goes down the Rift with them.', level: 42, baseCost: 3e7, growth: 12, max: 1, req: 'company', effects: [{ stat: 'kitSlots', value: 1 }] },
  { id: 'ropes', name: 'Rift Rigging', icon: '🪢', group: 'company', desc: 'Fixed lines down the early depths. The company descends quicker.', level: 40, baseCost: 1.5e7, growth: 2.2, max: 0, req: 'company', effects: [{ stat: 'delveSpeed', value: 0.05 }] },
  { id: 'warhorn', name: 'Warhorn', icon: '📯', group: 'company', desc: 'They fight harder for hearing it.', level: 46, baseCost: 6e7, growth: 2.3, max: 0, req: 'company', effects: [{ stat: 'partyPower', value: 0.06 }] },

  // ── Study ──────────────────────────────────────────────────
  { id: 'quarters', name: 'Apprentice Quarters', icon: '🛏️', group: 'study', desc: 'Somewhere decent to sleep. They learn quicker for it.', level: 3, baseCost: 300, growth: 4, max: 4, effects: [{ stat: 'apprenticeXp', value: 0.15 }] },
  { id: 'library', name: 'Training Library', icon: '📚', group: 'study', desc: 'Apprentices learn faster.', level: 5, baseCost: 500, growth: 2.2, max: 0, effects: [{ stat: 'apprenticeXp', value: 0.1 }] },
  { id: 'lamps', name: 'Reading Lamps', icon: '🕯️', group: 'study', desc: 'Studies in the Library finish sooner.', level: 18, baseCost: 20000, growth: 2.1, max: 0, effects: [{ stat: 'researchSpeed', value: 0.06 }] },
  { id: 'kennel', name: 'Companion Kennel', icon: '🐾', group: 'study', desc: 'Room for one more familiar to come along.', level: 36, baseCost: 6e6, growth: 10, max: 1, req: 'companionship', effects: [{ stat: 'familiarSlots', value: 1 }] },
  { id: 'almanac', name: 'Craftsman\'s Almanac', icon: '📓', group: 'study', desc: 'Every craft teaches you more for the doing of it.', level: 48, baseCost: 9e7, growth: 2.3, max: 0, effects: [{ stat: 'masteryRate', value: 0.08 }] },

  // ── Adventure ──────────────────────────────────────────────
  { id: 'whetstone', name: 'Runed Whetstone', icon: '🪨', group: 'combat', desc: 'Sharper blades, harder hits.', level: 10, baseCost: 800, growth: 1.9, max: 0, effects: [{ stat: 'attackMult', value: 0.08 }] },
  { id: 'wardrunes', name: 'Warding Runes', icon: '🔰', group: 'combat', desc: 'Protective runes stitched into your coat.', level: 10, baseCost: 800, growth: 1.9, max: 0, effects: [{ stat: 'defenseMult', value: 0.08 }, { stat: 'hpMult', value: 0.05 }] },
  { id: 'manafont', name: 'Mana Font', icon: '⛲', group: 'combat', desc: 'A basin of liquid mana in the workshop.', level: 10, baseCost: 1000, growth: 1.9, max: 0, effects: [{ stat: 'maxMana', value: 15 }, { stat: 'manaRegen', value: 0.25 }] },
  { id: 'bandolier', name: 'Potion Bandolier', icon: '🎽', group: 'combat', desc: 'Carry another potion into battle.', level: 12, baseCost: 5000, growth: 6, max: 2, effects: [{ stat: 'potionSlots', value: 1 }] },
  { id: 'doses', name: 'Measured Doses', icon: '💉', group: 'combat', desc: 'Every potion you drink mid-fight hits harder.', level: 26, baseCost: 120000, growth: 2.1, max: 0, effects: [{ stat: 'potionPower', value: 0.06 }] },
  { id: 'scales', name: 'Assessor\'s Scales', icon: '⚖️', group: 'combat', desc: 'You know what is worth carrying out of a dungeon.', level: 32, baseCost: 700000, growth: 2.15, max: 0, effects: [{ stat: 'lootFind', value: 0.1 }] },
  { id: 'duellist', name: 'Duellist\'s Drill', icon: '🤺', group: 'combat', desc: 'Find the gap, and step out of theirs.', level: 45, baseCost: 4e7, growth: 3, max: 8, effects: [{ stat: 'critChance', value: 0.015 }, { stat: 'dodge', value: 0.015 }] },
  { id: 'focus', name: 'Archmage\'s Focus', icon: '🔮', group: 'combat', desc: 'Spells land with the weight of the whole workshop behind them.', level: 54, baseCost: 4e8, growth: 2.35, max: 0, effects: [{ stat: 'spellMult', value: 0.08 }] },

  // ── The Long Game ──────────────────────────────────────────
  { id: 'hourglass', name: 'Sleeper\'s Hourglass', icon: '⌛', group: 'meta', desc: '+2 hours of offline progress.', level: 8, baseCost: 5000, growth: 3, max: 4, effects: [{ stat: 'offlineHours', value: 2 }] },
  { id: 'lens', name: 'Philosopher\'s Lens', icon: '🔍', group: 'meta', desc: 'More Philosopher\'s Stones on ascension.', level: 20, baseCost: 25000, growth: 2.5, max: 0, effects: [{ stat: 'stoneGain', value: 0.05 }] },
  { id: 'chalkboard', name: 'Theory Chalkboard', icon: '🧮', group: 'meta', desc: 'You learn faster from everything you do.', level: 30, baseCost: 400000, growth: 2.2, max: 0, effects: [{ stat: 'xpGain', value: 0.06 }] },
  { id: 'observatory', name: 'Rooftop Observatory', icon: '🔭', group: 'meta', desc: 'Read the sky, and the Great Work comes back richer.', level: 60, baseCost: 2e9, growth: 2.5, max: 0, effects: [{ stat: 'stoneGain', value: 0.08 }, { stat: 'xpGain', value: 0.05 }] },
];

export const UPGRADE_MAP: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export function upgradeCost(u: UpgradeDef, owned: number): number {
  return Math.ceil(u.baseCost * u.growth ** owned);
}
