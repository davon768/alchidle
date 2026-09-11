import { RECIPE_MAP } from './recipes';

export type ItemKind = 'herb' | 'material' | 'potion' | 'reagent';

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  kind: ItemKind;
  value: number; // base gold value
  buyLevel?: number; // if set, can be bought at the market from this level
}

const BASE_ITEMS: ItemDef[] = [
  // Herbs — grown in the garden
  { id: 'sunleaf', name: 'Sunleaf', icon: '🌿', kind: 'herb', value: 1 },
  { id: 'moonpetal', name: 'Moonpetal', icon: '🌸', kind: 'herb', value: 3 },
  { id: 'emberroot', name: 'Emberroot', icon: '🥕', kind: 'herb', value: 8 },
  { id: 'frostcap', name: 'Frostcap', icon: '🍄', kind: 'herb', value: 14 },
  { id: 'mandrake', name: 'Mandrake Root', icon: '🫚', kind: 'herb', value: 20 },
  { id: 'dreamlotus', name: 'Dream Lotus', icon: '🪷', kind: 'herb', value: 50 },
  { id: 'bloodthorn', name: 'Bloodthorn', icon: '🌹', kind: 'herb', value: 90 },
  { id: 'starbloom', name: 'Starbloom', icon: '🌼', kind: 'herb', value: 220 },
  { id: 'voidvine', name: 'Voidvine', icon: '🥀', kind: 'herb', value: 1100 },
  // Materials — found on expeditions, some sold at the market
  { id: 'clearwater', name: 'Clearwater', icon: '💧', kind: 'material', value: 1, buyLevel: 1 },
  { id: 'quartz', name: 'Quartz', icon: '🪨', kind: 'material', value: 6, buyLevel: 9 },
  { id: 'slimegel', name: 'Slime Gel', icon: '🟢', kind: 'material', value: 8, buyLevel: 12 },
  { id: 'batwing', name: 'Bat Wing', icon: '🦇', kind: 'material', value: 15, buyLevel: 15 },
  { id: 'crystal', name: 'Crystal Shard', icon: '🔮', kind: 'material', value: 30, buyLevel: 20 },
  { id: 'relic', name: 'Ancient Relic', icon: '🏺', kind: 'material', value: 400 },
  { id: 'wyrmscale', name: 'Wyrm Scale', icon: '🐲', kind: 'material', value: 300 },
  { id: 'stardust', name: 'Stardust', icon: '✨', kind: 'material', value: 180 },
  { id: 'phoenix', name: 'Phoenix Feather', icon: '🪶', kind: 'material', value: 2500 },
  { id: 'voidessence', name: 'Void Essence', icon: '🌑', kind: 'material', value: 2000 },
  // Dungeon materials — dropped by monsters
  { id: 'ironore', name: 'Iron Ore', icon: '⛏️', kind: 'material', value: 10 },
  { id: 'fang', name: 'Beast Fang', icon: '🦷', kind: 'material', value: 14 },
  { id: 'bonedust', name: 'Bone Dust', icon: '🦴', kind: 'material', value: 30 },
  { id: 'ectoplasm', name: 'Ectoplasm', icon: '👻', kind: 'material', value: 45 },
  { id: 'mithril', name: 'Mithril Ore', icon: '🔩', kind: 'material', value: 110 },
  { id: 'elemcore', name: 'Elemental Core', icon: '🧿', kind: 'material', value: 150 },
  { id: 'sirenscale', name: 'Siren Scale', icon: '🐚', kind: 'material', value: 380 },
  { id: 'krakenink', name: 'Kraken Ink', icon: '🦑', kind: 'material', value: 450 },
  { id: 'adamant', name: 'Adamantite', icon: '⚙️', kind: 'material', value: 1200 },
  { id: 'dragonheart', name: 'Dragon Heart', icon: '❤️‍🔥', kind: 'material', value: 2800 },
  { id: 'starmetal', name: 'Star Metal', icon: '☄️', kind: 'material', value: 5000 },
  { id: 'voidshard', name: 'Void Shard', icon: '🟣', kind: 'material', value: 6000 },
  { id: 'arcanedust', name: 'Arcane Dust', icon: '✴️', kind: 'material', value: 5 },
  // Reagents — crafted at the Arcane Workbench, used to learn and cast spells
  { id: 'runechalk', name: 'Rune Chalk', icon: '🖍️', kind: 'reagent', value: 20 },
  { id: 'spellink', name: 'Spell Ink', icon: '🖋️', kind: 'reagent', value: 25 },
  { id: 'manacrystal', name: 'Mana Crystal', icon: '💎', kind: 'reagent', value: 90 },
  { id: 'soulink', name: 'Soul Ink', icon: '📜', kind: 'reagent', value: 140 },
  { id: 'emberrune', name: 'Ember Rune', icon: '♨️', kind: 'reagent', value: 300 },
  { id: 'frostrune', name: 'Frost Rune', icon: '🧊', kind: 'reagent', value: 320 },
  { id: 'tidesigil', name: 'Tide Sigil', icon: '🌊', kind: 'reagent', value: 1500 },
  { id: 'dragonsigil', name: 'Dragonfire Sigil', icon: '🔶', kind: 'reagent', value: 7000 },
  { id: 'voidsigil', name: 'Void Sigil', icon: '⚫', kind: 'reagent', value: 18000 },
];

export const ITEM_MAP: Record<string, ItemDef> = Object.fromEntries(BASE_ITEMS.map((i) => [i.id, i]));

for (const r of Object.values(RECIPE_MAP)) {
  ITEM_MAP[r.id] = { id: r.id, name: r.name, icon: r.icon, kind: 'potion', value: r.value };
}

export const ALL_ITEMS: ItemDef[] = Object.values(ITEM_MAP);

export function item(id: string): ItemDef {
  return ITEM_MAP[id] ?? { id, name: id, icon: '❔', kind: 'material', value: 0 };
}
