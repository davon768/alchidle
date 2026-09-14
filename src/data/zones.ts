export interface Drop {
  id: string; // item id or 'gold'
  min: number;
  max: number;
  chance: number; // 0..1
  rare?: boolean; // chance scaled by the rareFind stat
}

export interface ZoneDef {
  id: string;
  name: string;
  icon: string;
  level: number;
  time: number;
  xp: number;
  desc: string;
  drops: Drop[];
  /**
   * Multiplies every drop quantity. Drop tables say *what* a zone yields; this says how richly, so the
   * curve can be tuned without rewriting each table. Zones used to pay about the same per minute from
   * level 1 to 38, which is why the first zone never stopped being a reasonable choice.
   */
  bounty?: number;
  endless?: boolean; // rewards and duration scale with depth
}

export const ZONES: ZoneDef[] = [
  { id: 'meadow', name: 'Whispering Meadow', icon: '🌾', level: 1, time: 20, xp: 3, desc: 'A calm stream and curious slimes.',
    drops: [
      { id: 'clearwater', min: 3, max: 6, chance: 1 },
      { id: 'quartz', min: 1, max: 2, chance: 0.3 },
      { id: 'slimegel', min: 1, max: 2, chance: 0.35 },
      { id: 'gold', min: 5, max: 20, chance: 0.25 },
    ] },
  { id: 'forest', name: 'Old Forest', icon: '🌲', level: 5, time: 45, xp: 10, bounty: 1.3, desc: 'Gnarled trees hide bat roosts.',
    drops: [
      { id: 'clearwater', min: 2, max: 5, chance: 1 },
      { id: 'batwing', min: 1, max: 3, chance: 0.6 },
      { id: 'slimegel', min: 1, max: 3, chance: 0.5 },
      { id: 'relic', min: 1, max: 1, chance: 0.02, rare: true },
    ] },
  { id: 'caves', name: 'Crystal Caves', icon: '💎', level: 10, time: 90, xp: 32, bounty: 1.75, desc: 'Glittering veins in the dark.',
    drops: [
      { id: 'quartz', min: 2, max: 5, chance: 1 },
      { id: 'crystal', min: 1, max: 3, chance: 0.7 },
      { id: 'batwing', min: 1, max: 2, chance: 0.4 },
      { id: 'relic', min: 1, max: 1, chance: 0.04, rare: true },
    ] },
  { id: 'ruins', name: 'Sunken Ruins', icon: '🏛️', level: 18, time: 180, xp: 137, bounty: 1.3, desc: 'A drowned city of forgotten alchemists.',
    drops: [
      { id: 'crystal', min: 2, max: 5, chance: 1 },
      { id: 'relic', min: 1, max: 2, chance: 0.25, rare: true },
      { id: 'gold', min: 200, max: 800, chance: 0.5 },
      { id: 'stardust', min: 1, max: 1, chance: 0.05, rare: true },
    ] },
  { id: 'mire', name: 'Mirefen', icon: '🐸', level: 23, time: 200, xp: 280, bounty: 1.4, desc: 'Black water, sunken iron, and things that croak in the dark.',
    drops: [
      { id: 'bogiron', min: 2, max: 5, chance: 0.9 },
      { id: 'slimegel', min: 3, max: 7, chance: 0.7 },
      { id: 'ectoplasm', min: 1, max: 2, chance: 0.25 },
      { id: 'relic', min: 1, max: 1, chance: 0.08, rare: true },
    ] },
  { id: 'spine', name: "Dragon's Spine", icon: '🌋', level: 28, time: 300, xp: 590, bounty: 3.6, desc: 'Volcanic peaks where wyrms shed their scales.',
    drops: [
      { id: 'wyrmscale', min: 1, max: 3, chance: 0.9 },
      { id: 'quartz', min: 5, max: 12, chance: 1 },
      { id: 'phoenix', min: 1, max: 1, chance: 0.08, rare: true },
    ] },
  { id: 'glacier', name: 'Shattered Glacier', icon: '🧊', level: 33, time: 360, xp: 1200, bounty: 2.6, desc: 'A sea frozen mid-storm, and something asleep beneath it.',
    drops: [
      { id: 'frostheart', min: 1, max: 4, chance: 0.9 },
      { id: 'crystal', min: 3, max: 7, chance: 0.8 },
      { id: 'quartz', min: 6, max: 14, chance: 1 },
      { id: 'stardust', min: 1, max: 2, chance: 0.12, rare: true },
    ] },
  { id: 'observatory', name: 'Fallen Observatory', icon: '🔭', level: 38, time: 480, xp: 2450, bounty: 6.1, desc: 'A star crashed here. Its dust remains.',
    drops: [
      { id: 'stardust', min: 3, max: 8, chance: 1 },
      { id: 'phoenix', min: 1, max: 1, chance: 0.25, rare: true },
      { id: 'relic', min: 1, max: 3, chance: 0.4 },
    ] },
  { id: 'wastes', name: 'Bone Wastes', icon: '💀', level: 44, time: 540, xp: 4800, bounty: 7.5, desc: 'A battlefield nobody won, still being fought over.',
    drops: [
      { id: 'graveash', min: 2, max: 6, chance: 0.9 },
      { id: 'bonedust', min: 4, max: 10, chance: 0.8 },
      { id: 'relic', min: 1, max: 3, chance: 0.45 },
      { id: 'phoenix', min: 1, max: 1, chance: 0.12, rare: true },
    ] },
  { id: 'rift', name: 'The Endless Rift', icon: '🌀', level: 50, time: 600, xp: 9560, endless: true,
    bounty: 3.4, desc: 'Every descent goes deeper. Rewards grow with depth, forever.',
    drops: [
      { id: 'voidessence', min: 1, max: 3, chance: 1 },
      { id: 'stardust', min: 3, max: 10, chance: 0.8 },
      { id: 'phoenix', min: 1, max: 2, chance: 0.3, rare: true },
      { id: 'gold', min: 5000, max: 20000, chance: 0.6 },
    ] },
  { id: 'trench', name: 'Abyssal Trench', icon: '🌊', level: 58, time: 700, xp: 24000, bounty: 12, desc: 'Pressure, dark, and a city that should not be down here.',
    drops: [
      { id: 'abyssalpearl', min: 1, max: 4, chance: 0.9 },
      { id: 'sirenscale', min: 2, max: 5, chance: 0.6 },
      { id: 'krakenink', min: 2, max: 5, chance: 0.5 },
      { id: 'voidessence', min: 1, max: 2, chance: 0.2, rare: true },
    ] },
  { id: 'caldera', name: 'Emberfall Wastes', icon: '🔥', level: 70, time: 840, xp: 95000, bounty: 26, desc: 'The sky rains fire here, and has for a very long time.',
    drops: [
      { id: 'emberglass', min: 1, max: 4, chance: 0.9 },
      { id: 'wyrmscale', min: 3, max: 8, chance: 0.7 },
      { id: 'adamant', min: 1, max: 3, chance: 0.4 },
      { id: 'dragonheart', min: 1, max: 1, chance: 0.15, rare: true },
    ] },
  { id: 'aurora', name: 'Aurora Reach', icon: '🌈', level: 84, time: 1000, xp: 460000, bounty: 60, desc: 'Light with weight to it, drifting over a shore made of sky.',
    drops: [
      { id: 'auroradust', min: 1, max: 4, chance: 0.9 },
      { id: 'starmetal', min: 1, max: 3, chance: 0.5 },
      { id: 'voidshard', min: 1, max: 3, chance: 0.4 },
      { id: 'phoenix', min: 1, max: 3, chance: 0.3, rare: true },
    ] },
];

export const ZONE_MAP: Record<string, ZoneDef> = Object.fromEntries(ZONES.map((z) => [z.id, z]));

/** Rift scaling: each depth level multiplies rewards by 1.12 and time by 1.04. */
export function riftRewardMult(depth: number): number {
  return 1.12 ** depth;
}
export function riftTimeMult(depth: number): number {
  return 1.04 ** depth;
}
