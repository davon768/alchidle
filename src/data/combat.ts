import type { Drop } from './zones';

export interface MonsterDef {
  name: string;
  icon: string;
}

export interface DungeonDef {
  id: string;
  name: string;
  icon: string;
  level: number;
  desc: string;
  floors: number; // 0 = endless
  tier: number; // gear tier dropped here
  // Floor-1 stats of a normal enemy; every floor multiplies them by FLOOR_GROWTH
  hp: number;
  atk: number;
  def: number;
  gold: number;
  xp: number;
  enemies: MonsterDef[];
  boss: MonsterDef;
  drops: Drop[]; // per kill
  bossDrops: Drop[];
}

/** Foes per floor. On boss floors the boss appears after this many guards. */
export const FLOOR_KILLS = 5;
export const FLOOR_GROWTH = 1.1;
export const REWARD_GROWTH = 1.08;
export const DUNGEON_UNLOCK_LEVEL = 10;

export const RANK_MULT = {
  normal: { hp: 1, atk: 1, reward: 1 },
  elite: { hp: 2.5, atk: 1.3, reward: 3 },
  boss: { hp: 6, atk: 1.5, reward: 6 },
  champion: { hp: 8, atk: 1.6, reward: 15 },
} as const;

export const DUNGEONS: DungeonDef[] = [
  { id: 'goblin', name: 'Goblin Warrens', icon: '👺', level: 10, floors: 10, tier: 1, desc: 'Tunnels full of thieves, rats and stolen ore.',
    hp: 70, atk: 22, def: 8, gold: 10, xp: 4,
    enemies: [{ name: 'Goblin Sneak', icon: '👺' }, { name: 'Cave Rat', icon: '🐀' }, { name: 'Goblin Brute', icon: '👹' }],
    boss: { name: 'Chieftain Gorrak', icon: '👑' },
    drops: [{ id: 'ironore', min: 1, max: 2, chance: 0.5 }, { id: 'fang', min: 1, max: 1, chance: 0.35 }],
    bossDrops: [{ id: 'ironore', min: 5, max: 10, chance: 1 }, { id: 'fang', min: 3, max: 6, chance: 1 }] },
  { id: 'crypt', name: 'Haunted Crypt', icon: '🪦', level: 15, floors: 15, tier: 2, desc: 'The dead here do not rest — and they drop useful bits.',
    hp: 150, atk: 38, def: 16, gold: 35, xp: 12,
    enemies: [{ name: 'Skeleton', icon: '💀' }, { name: 'Restless Spirit', icon: '👻' }, { name: 'Ghoul', icon: '🧟' }],
    boss: { name: 'The Bone King', icon: '☠️' },
    drops: [{ id: 'bonedust', min: 1, max: 2, chance: 0.5 }, { id: 'ectoplasm', min: 1, max: 1, chance: 0.3 }],
    bossDrops: [{ id: 'bonedust', min: 5, max: 10, chance: 1 }, { id: 'ectoplasm', min: 3, max: 6, chance: 1 }, { id: 'relic', min: 1, max: 1, chance: 0.5, rare: true }] },
  { id: 'forge', name: 'Elemental Forge', icon: '⚒️', level: 22, floors: 20, tier: 3, desc: 'An abandoned dwarven forge overrun by living flame.',
    hp: 520, atk: 105, def: 45, gold: 140, xp: 38,
    enemies: [{ name: 'Fire Imp', icon: '😈' }, { name: 'Magma Golem', icon: '🗿' }, { name: 'Storm Wisp', icon: '🌩️' }],
    boss: { name: 'Ignis the Forgelord', icon: '🌋' },
    drops: [{ id: 'mithril', min: 1, max: 2, chance: 0.45 }, { id: 'elemcore', min: 1, max: 1, chance: 0.3 }],
    bossDrops: [{ id: 'mithril', min: 5, max: 10, chance: 1 }, { id: 'elemcore', min: 3, max: 6, chance: 1 }] },
  { id: 'temple', name: 'Drowned Temple', icon: '🛕', level: 30, floors: 20, tier: 4, desc: 'Something in the flooded halls still worships the deep.',
    hp: 1800, atk: 300, def: 130, gold: 550, xp: 105,
    enemies: [{ name: 'Merfolk Raider', icon: '🧜' }, { name: 'Giant Crab', icon: '🦀' }, { name: 'Deep One', icon: '🐙' }],
    boss: { name: 'Kraken Matriarch', icon: '🦑' },
    drops: [{ id: 'sirenscale', min: 1, max: 1, chance: 0.4 }, { id: 'krakenink', min: 1, max: 1, chance: 0.3 }],
    bossDrops: [{ id: 'sirenscale', min: 3, max: 6, chance: 1 }, { id: 'krakenink', min: 3, max: 6, chance: 1 }, { id: 'relic', min: 1, max: 3, chance: 1 }] },
  { id: 'lair', name: "Dragon's Lair", icon: '🐉', level: 40, floors: 25, tier: 5, desc: 'Gold, bones and a very old, very angry dragon.',
    hp: 6500, atk: 850, def: 360, gold: 2400, xp: 300,
    enemies: [{ name: 'Drake', icon: '🦎' }, { name: 'Kobold Zealot', icon: '🦊' }, { name: 'Wyvern', icon: '🪽' }],
    boss: { name: 'Vermithrax the Ancient', icon: '🐉' },
    drops: [{ id: 'adamant', min: 1, max: 1, chance: 0.35 }, { id: 'dragonheart', min: 1, max: 1, chance: 0.12, rare: true }, { id: 'wyrmscale', min: 1, max: 2, chance: 0.4 }],
    bossDrops: [{ id: 'adamant', min: 3, max: 6, chance: 1 }, { id: 'dragonheart', min: 2, max: 4, chance: 1 }, { id: 'phoenix', min: 1, max: 1, chance: 0.5, rare: true }] },
  { id: 'void', name: 'Void Citadel', icon: '🌌', level: 55, floors: 0, tier: 6, desc: 'Endless floors between the stars. Gear tier rises every 10 floors.',
    hp: 24000, atk: 2400, def: 1000, gold: 11000, xp: 850,
    enemies: [{ name: 'Void Stalker', icon: '👁️' }, { name: 'Null Wraith', icon: '🌫️' }, { name: 'Star Eater', icon: '🪐' }],
    boss: { name: 'Herald of the Void', icon: '🌑' },
    drops: [{ id: 'voidshard', min: 1, max: 1, chance: 0.3 }, { id: 'starmetal', min: 1, max: 1, chance: 0.25 }, { id: 'voidessence', min: 1, max: 2, chance: 0.4 }],
    bossDrops: [{ id: 'voidshard', min: 3, max: 6, chance: 1 }, { id: 'starmetal', min: 3, max: 6, chance: 1 }, { id: 'phoenix', min: 1, max: 2, chance: 1 }] },
];

export const DUNGEON_MAP: Record<string, DungeonDef> = Object.fromEntries(DUNGEONS.map((d) => [d.id, d]));

export function isBossFloor(d: DungeonDef, floor: number): boolean {
  return floor % 10 === 0 || (d.floors > 0 && floor === d.floors);
}

/** Gear tier dropped on a floor: the Void Citadel keeps climbing every 10 floors. */
export function floorTier(d: DungeonDef, floor: number): number {
  return d.floors === 0 ? d.tier + Math.floor((floor - 1) / 10) : d.tier;
}
