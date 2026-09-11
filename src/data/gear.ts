import type { Effect, GearItem, GearSlot, ItemStack, StatKey } from '../core/types';

export const GEAR_SLOTS: GearSlot[] = ['weapon', 'helm', 'armor', 'trinket'];
export const SLOT_INFO: Record<GearSlot, { name: string; icon: string }> = {
  weapon: { name: 'Weapon', icon: '🗡️' },
  helm: { name: 'Helm', icon: '⛑️' },
  armor: { name: 'Armor', icon: '🥋' },
  trinket: { name: 'Trinket', icon: '📿' },
};

export const GEAR_CAP = 60;

export const RARITIES = [
  { name: 'Common', color: '#b8b3c8', mult: 1, affixes: 0, chance: 1 },
  { name: 'Fine', color: '#5fd068', mult: 1.2, affixes: 1, chance: 0.3 },
  { name: 'Rare', color: '#4fb3ff', mult: 1.45, affixes: 2, chance: 0.1 },
  { name: 'Epic', color: '#b57bff', mult: 1.75, affixes: 3, chance: 0.03 },
  { name: 'Legendary', color: '#ff9f43', mult: 2.1, affixes: 4, chance: 0.007 },
  { name: 'Mythic', color: '#ff4f7a', mult: 2.6, affixes: 5, chance: 0.001 },
];

export interface GearBase {
  id: string;
  slot: GearSlot;
  name: string;
  icon: string;
  tier: number;
  primary: Partial<Record<'attack' | 'defense' | 'maxHp' | 'spellPower' | 'maxMana', number>>; // at tier 1
}

const g = (id: string, slot: GearSlot, tier: number, name: string, icon: string, primary: GearBase['primary']): GearBase => ({ id, slot, tier, name, icon, primary });

const BLADE = { attack: 10 };
const STAFF = { spellPower: 10, maxMana: 8 };
const HELM = { defense: 5, maxHp: 25 };
const ARMOR = { defense: 8, maxHp: 40 };
const CHARM = { spellPower: 5, maxHp: 15, maxMana: 12 };

export const GEAR_BASES: GearBase[] = [
  g('w1a', 'weapon', 1, 'Iron Shortsword', '🗡️', BLADE), g('w1b', 'weapon', 1, 'Oak Wand', '🪄', STAFF),
  g('w2a', 'weapon', 2, 'Bone Cleaver', '🪓', BLADE), g('w2b', 'weapon', 2, 'Gravewood Staff', '🦯', STAFF),
  g('w3a', 'weapon', 3, 'Mithril Blade', '⚔️', BLADE), g('w3b', 'weapon', 3, 'Emberglass Rod', '🪄', STAFF),
  g('w4a', 'weapon', 4, 'Trident of Tides', '🔱', BLADE), g('w4b', 'weapon', 4, 'Coral Scepter', '🦯', STAFF),
  g('w5a', 'weapon', 5, 'Dragonfang Greatsword', '🗡️', BLADE), g('w5b', 'weapon', 5, 'Wyrmheart Staff', '🪄', STAFF),
  g('w6a', 'weapon', 6, 'Voidreaver', '⚔️', BLADE), g('w6b', 'weapon', 6, 'Starfall Staff', '🦯', STAFF),
  g('h1', 'helm', 1, 'Leather Cap', '🧢', HELM), g('h2', 'helm', 2, 'Bone Helm', '⛑️', HELM), g('h3', 'helm', 3, 'Mithril Coif', '⛑️', HELM),
  g('h4', 'helm', 4, 'Pearl Diadem', '👑', HELM), g('h5', 'helm', 5, 'Dragonskull Helm', '⛑️', HELM), g('h6', 'helm', 6, 'Crown of Stars', '👑', HELM),
  g('a1', 'armor', 1, 'Padded Vest', '🦺', ARMOR), g('a2', 'armor', 2, 'Grave Robes', '🥋', ARMOR), g('a3', 'armor', 3, 'Mithril Mail', '🥋', ARMOR),
  g('a4', 'armor', 4, 'Scale of the Deep', '🦺', ARMOR), g('a5', 'armor', 5, 'Dragonscale Plate', '🥋', ARMOR), g('a6', 'armor', 6, 'Voidweave Mantle', '🥋', ARMOR),
  g('t1', 'trinket', 1, 'Lucky Tooth', '📿', CHARM), g('t2', 'trinket', 2, 'Spirit Lantern', '🏮', CHARM), g('t3', 'trinket', 3, 'Core Amulet', '🧿', CHARM),
  g('t4', 'trinket', 4, 'Siren\'s Locket', '🐚', CHARM), g('t5', 'trinket', 5, 'Dragon Eye', '👁️', CHARM), g('t6', 'trinket', 6, 'Heart of the Void', '🔮', CHARM),
];

export const GEAR_BASE_MAP: Record<string, GearBase> = Object.fromEntries(GEAR_BASES.map((b) => [b.id, b]));

interface AffixDef { stat: StatKey; min: number; max: number; name: string }
const AFFIXES: AffixDef[] = [
  { stat: 'attackMult', min: 0.04, max: 0.1, name: 'of Might' },
  { stat: 'defenseMult', min: 0.04, max: 0.1, name: 'of the Bulwark' },
  { stat: 'hpMult', min: 0.05, max: 0.12, name: 'of Vitality' },
  { stat: 'spellMult', min: 0.04, max: 0.1, name: 'of Sorcery' },
  { stat: 'critChance', min: 0.01, max: 0.04, name: 'of Precision' },
  { stat: 'critDamage', min: 0.08, max: 0.25, name: 'of Ruin' },
  { stat: 'dodge', min: 0.01, max: 0.03, name: 'of Shadows' },
  { stat: 'potionPower', min: 0.05, max: 0.12, name: 'of the Alchemist' },
  { stat: 'lootFind', min: 0.05, max: 0.15, name: 'of Plunder' },
  { stat: 'manaRegen', min: 0.2, max: 0.6, name: 'of Flowing Mana' },
  { stat: 'xpGain', min: 0.03, max: 0.08, name: 'of Wisdom' },
  { stat: 'sellPrice', min: 0.03, max: 0.07, name: 'of the Merchant' },
  { stat: 'growSpeed', min: 0.05, max: 0.12, name: 'of the Gardener' },
  { stat: 'brewSpeed', min: 0.05, max: 0.12, name: 'of the Brewer' },
  { stat: 'scavSpeed', min: 0.05, max: 0.12, name: 'of the Wanderer' },
  { stat: 'rareFind', min: 0.05, max: 0.15, name: 'of Fortune' },
];
const AFFIX_NAME: Partial<Record<StatKey, string>> = Object.fromEntries(AFFIXES.map((a) => [a.stat, a.name]));

/** Primary stats scale ×2.2 per tier. Tiers beyond 6 (deep Void Citadel) keep scaling. */
export function tierMult(tier: number): number {
  return 2.2 ** (tier - 1);
}

export function gearBase(it: GearItem): GearBase {
  return GEAR_BASE_MAP[it.base];
}

export function gearName(it: GearItem): string {
  const b = gearBase(it);
  const suffix = it.affixes.length ? ' ' + (AFFIX_NAME[it.affixes[0].stat] ?? '') : '';
  return `${b.name}${suffix}${it.enhance > 0 ? ` +${it.enhance}` : ''}`;
}

export function gearPrimary(it: GearItem): Effect[] {
  const b = gearBase(it);
  const mult = tierMult(it.tier) * RARITIES[it.rarity].mult * it.quality * (1 + 0.1 * it.enhance);
  return Object.entries(b.primary).map(([stat, v]) => ({ stat: stat as StatKey, value: (v as number) * mult }));
}

export function gearEffects(it: GearItem): Effect[] {
  return [...gearPrimary(it), ...it.affixes];
}

/** Rarity roll. `luck` multiplies every chance above Common; `min` is a guaranteed floor. */
export function rollRarity(luck: number, min = 0): number {
  const r = Math.random();
  let acc = 0;
  for (let i = RARITIES.length - 1; i >= 1; i--) {
    acc += RARITIES[i].chance * luck;
    if (r < acc) return Math.max(i, min);
  }
  return min;
}

export function rollGear(uid: string, tier: number, rarity: number, slot?: GearSlot): GearItem {
  const baseTier = Math.min(6, tier);
  const pool = GEAR_BASES.filter((b) => b.tier === baseTier && (!slot || b.slot === slot));
  const base = pool[Math.floor(Math.random() * pool.length)];
  const affixScale = 1 + 0.12 * (tier - 1);
  const picked = [...AFFIXES].sort(() => Math.random() - 0.5).slice(0, RARITIES[rarity].affixes);
  return {
    uid,
    base: base.id,
    tier,
    rarity,
    quality: 0.9 + Math.random() * 0.2,
    enhance: 0,
    affixes: picked.map((a) => ({ stat: a.stat, value: (a.min + Math.random() * (a.max - a.min)) * affixScale })),
  };
}

export function gearValue(it: GearItem): number {
  return Math.round(25 * tierMult(it.tier) ** 1.1 * RARITIES[it.rarity].mult ** 2 * (1 + it.enhance * 0.2));
}

export function salvageDust(it: GearItem): number {
  return it.tier * (it.rarity + 1) * 2 + it.enhance * it.tier;
}

export function enhanceCost(it: GearItem): { gold: number; dust: number } {
  return {
    gold: Math.round(gearValue({ ...it, enhance: 0 }) * 2 * 1.5 ** it.enhance),
    dust: it.tier * (it.enhance + 1) * 4,
  };
}

/** Forge recipes: craft a random item of the chosen slot at that tier (at least Fine). */
export const FORGE_TIERS: { tier: number; dungeon: string; cost: ItemStack[] }[] = [
  { tier: 1, dungeon: 'goblin', cost: [{ id: 'ironore', qty: 8 }, { id: 'fang', qty: 3 }, { id: 'gold', qty: 300 }] },
  { tier: 2, dungeon: 'crypt', cost: [{ id: 'bonedust', qty: 8 }, { id: 'ectoplasm', qty: 3 }, { id: 'ironore', qty: 10 }, { id: 'gold', qty: 2000 }] },
  { tier: 3, dungeon: 'forge', cost: [{ id: 'mithril', qty: 8 }, { id: 'elemcore', qty: 3 }, { id: 'gold', qty: 12000 }] },
  { tier: 4, dungeon: 'temple', cost: [{ id: 'sirenscale', qty: 6 }, { id: 'krakenink', qty: 3 }, { id: 'mithril', qty: 10 }, { id: 'gold', qty: 80000 }] },
  { tier: 5, dungeon: 'lair', cost: [{ id: 'adamant', qty: 6 }, { id: 'dragonheart', qty: 2 }, { id: 'gold', qty: 500000 }] },
  { tier: 6, dungeon: 'void', cost: [{ id: 'starmetal', qty: 5 }, { id: 'voidshard', qty: 3 }, { id: 'adamant', qty: 8 }, { id: 'gold', qty: 4e6 }] },
];
