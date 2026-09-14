import type { CombatEffect, ItemStack } from '../core/types';

export interface Recipe {
  id: string; // also the id of the potion it produces
  name: string;
  icon: string;
  color: string; // liquid color used in the cauldron UI
  level: number;
  time: number; // seconds per brew at 1x speed
  inputs: ItemStack[];
  value: number; // base sell price of one potion
  xp: number;
  desc: string;
  combat?: CombatEffect[]; // usable from the potion belt; the first effect decides when it's drunk
}

const RAW: Recipe[] = [
  { id: 'p_heal', name: 'Minor Healing Tonic', icon: '🧪', color: '#e0475b', level: 1, time: 6, value: 15, xp: 5,
    inputs: [{ id: 'sunleaf', qty: 2 }, { id: 'clearwater', qty: 1 }], desc: 'Every adventurer\'s first purchase.',
    combat: [{ type: 'heal', value: 0.3 }] },
  { id: 'p_sleep', name: 'Sleep Draught', icon: '🌙', color: '#7a6cf0', level: 3, time: 10, value: 35, xp: 9,
    inputs: [{ id: 'moonpetal', qty: 2 }, { id: 'clearwater', qty: 1 }], desc: 'A gentle lullaby in a bottle.' },
  { id: 'p_salve', name: 'Slime Salve', icon: '🫙', color: '#5fd068', level: 5, time: 12, value: 50, xp: 12,
    inputs: [{ id: 'slimegel', qty: 1 }, { id: 'sunleaf', qty: 2 }], desc: 'Soothes burns. Smells awful.' },
  { id: 'p_night', name: 'Owl-Eye Draught', icon: '🦉', color: '#3c4bb0', level: 7, time: 18, value: 90, xp: 18,
    inputs: [{ id: 'batwing', qty: 1 }, { id: 'moonpetal', qty: 2 }], desc: 'See clearly in the dark — and strike true.',
    combat: [{ type: 'buff', stat: 'critChance', value: 0.15, duration: 30 }] },
  { id: 'p_fire', name: 'Emberheart Tonic', icon: '🔥', color: '#ff7a2f', level: 9, time: 20, value: 140, xp: 25,
    inputs: [{ id: 'emberroot', qty: 2 }, { id: 'quartz', qty: 1 }], desc: 'Warms the body and fires the blood.',
    combat: [{ type: 'buff', stat: 'attackMult', value: 0.25, duration: 30 }] },
  { id: 'p_mana', name: 'Mana Draught', icon: '🫧', color: '#4f8dff', level: 10, time: 12, value: 60, xp: 14,
    inputs: [{ id: 'moonpetal', qty: 2 }, { id: 'quartz', qty: 1 }, { id: 'clearwater', qty: 1 }], desc: 'Tastes like static.',
    combat: [{ type: 'mana', value: 0.4 }] },
  { id: 'p_ironskin', name: 'Ironskin Tonic', icon: '🥌', color: '#8a93a6', level: 12, time: 20, value: 130, xp: 22,
    inputs: [{ id: 'ironore', qty: 1 }, { id: 'frostcap', qty: 2 }], desc: 'Your skin goes grey and hard as a shield.',
    combat: [{ type: 'buff', stat: 'defenseMult', value: 0.5, duration: 40 }] },
  { id: 'p_frost', name: 'Frostbite Elixir', icon: '❄️', color: '#7fd8ff', level: 13, time: 30, value: 240, xp: 38,
    inputs: [{ id: 'frostcap', qty: 2 }, { id: 'crystal', qty: 1 }], desc: 'A skin of rime that turns blades.',
    combat: [{ type: 'buff', stat: 'defenseMult', value: 0.3, duration: 30 }] },
  { id: 'p_clarity', name: 'Elixir of Clarity', icon: '💠', color: '#a8f0e8', level: 16, time: 40, value: 480, xp: 60,
    inputs: [{ id: 'crystal', qty: 1 }, { id: 'p_sleep', qty: 1 }, { id: 'frostcap', qty: 2 }], desc: 'Scholars pay handsomely for focus.',
    combat: [{ type: 'mana', value: 0.7 }] },
  { id: 'p_gheal', name: 'Greater Healing Draught', icon: '❤️‍🩹', color: '#ff3355', level: 16, time: 30, value: 260, xp: 40,
    inputs: [{ id: 'p_heal', qty: 1 }, { id: 'mandrake', qty: 1 }, { id: 'bonedust', qty: 1 }], desc: 'Knits bone in seconds.',
    combat: [{ type: 'heal', value: 0.6 }] },
  { id: 'p_phantom', name: 'Phantom Draught', icon: '🫥', color: '#c9d6ff', level: 19, time: 35, value: 340, xp: 50,
    inputs: [{ id: 'ectoplasm', qty: 1 }, { id: 'moonpetal', qty: 2 }], desc: 'Blows pass through you. Mostly.',
    combat: [{ type: 'buff', stat: 'dodge', value: 0.25, duration: 40 }] },
  { id: 'p_dream', name: 'Dreamweaver Philter', icon: '🪷', color: '#d58cff', level: 21, time: 55, value: 900, xp: 105,
    inputs: [{ id: 'dreamlotus', qty: 2 }, { id: 'moonpetal', qty: 1 }, { id: 'crystal', qty: 1 }], desc: 'Lucid dreams, prophetic visions.' },
  { id: 'p_alchfire', name: 'Alchemist\'s Fire', icon: '🧨', color: '#ffb02e', level: 22, time: 30, value: 520, xp: 70,
    inputs: [{ id: 'elemcore', qty: 1 }, { id: 'emberroot', qty: 2 }, { id: 'slimegel', qty: 1 }], desc: 'Thrown, not drunk. Hopefully.',
    combat: [{ type: 'bomb', value: 0.3 }] },
  { id: 'p_berserk', name: 'Berserker Brew', icon: '🍺', color: '#b33a1a', level: 27, time: 50, value: 900, xp: 110,
    inputs: [{ id: 'fang', qty: 2 }, { id: 'bloodthorn', qty: 1 }, { id: 'p_fire', qty: 1 }], desc: 'Red vision, heavy hands.',
    combat: [{ type: 'buff', stat: 'attackMult', value: 0.8, duration: 40 }] },
  { id: 'p_vigor', name: "Dragon's Vigor", icon: '🐉', color: '#c4302b', level: 29, time: 90, value: 1800, xp: 160,
    inputs: [{ id: 'wyrmscale', qty: 1 }, { id: 'emberroot', qty: 2 }, { id: 'p_heal', qty: 1 }], desc: 'Strength of a wyrm for one glorious hour.',
    combat: [{ type: 'buff', stat: 'attackMult', value: 0.6, duration: 45 }] },
  { id: 'p_siren', name: "Siren's Serenade", icon: '🎶', color: '#2ec4b6', level: 32, time: 70, value: 2200, xp: 200,
    inputs: [{ id: 'sirenscale', qty: 1 }, { id: 'krakenink', qty: 1 }, { id: 'p_mana', qty: 1 }], desc: 'The sea sings magic into you.',
    combat: [{ type: 'mana', value: 1 }, { type: 'buff', stat: 'spellMult', value: 0.5, duration: 30 }] },
  { id: 'p_star', name: 'Starlight Draught', icon: '🌠', color: '#ffe27a', level: 36, time: 120, value: 4500, xp: 300,
    inputs: [{ id: 'stardust', qty: 3 }, { id: 'starbloom', qty: 2 }], desc: 'Glows faintly. Tastes like midnight.',
    combat: [{ type: 'buff', stat: 'spellMult', value: 0.6, duration: 45 }] },
  { id: 'p_rebirth', name: 'Elixir of Rebirth', icon: '🪶', color: '#ff9f43', level: 42, time: 180, value: 12000, xp: 550,
    inputs: [{ id: 'phoenix', qty: 1 }, { id: 'starbloom', qty: 2 }, { id: 'p_vigor', qty: 1 }], desc: 'Death becomes a minor inconvenience.',
    combat: [{ type: 'revive', value: 0.6 }] },
  { id: 'p_dragonblood', name: 'Dragonblood Elixir', icon: '🫀', color: '#8b0000', level: 42, time: 150, value: 9000, xp: 600,
    inputs: [{ id: 'dragonheart', qty: 1 }, { id: 'p_vigor', qty: 1 }, { id: 'bloodthorn', qty: 2 }], desc: 'Burns like dragonfire going down.',
    combat: [{ type: 'buff', stat: 'attackMult', value: 1, duration: 60 }, { type: 'buff', stat: 'defenseMult', value: 0.6, duration: 60 }, { type: 'heal', value: 0.5 }] },
  { id: 'p_void', name: 'Void Tincture', icon: '🕳️', color: '#5b2a86', level: 52, time: 300, value: 30000, xp: 1000,
    inputs: [{ id: 'voidessence', qty: 2 }, { id: 'voidvine', qty: 2 }, { id: 'p_dream', qty: 1 }], desc: 'Do not stare into the bottle.',
    combat: [{ type: 'bomb', value: 0.35 }] },
  { id: 'p_voidbomb', name: 'Void Grenade', icon: '💣', color: '#3d1466', level: 56, time: 200, value: 22000, xp: 1100,
    inputs: [{ id: 'voidshard', qty: 1 }, { id: 'p_alchfire', qty: 1 }, { id: 'starmetal', qty: 1 }], desc: 'Unmakes whatever it lands on.',
    combat: [{ type: 'bomb', value: 0.5 }] },
  { id: 'p_bog', name: 'Mirefen Draught', icon: '🐸', color: '#4a7c3f', level: 24, time: 40, value: 800, xp: 27,
    inputs: [{ id: 'bogiron', qty: 1 }, { id: 'slimegel', qty: 2 }], desc: 'Swamp water, refined. Somehow that helps.',
    combat: [{ type: 'buff', stat: 'defenseMult', value: 0.8, duration: 40 }] },
  { id: 'p_rime', name: 'Rimewater Elixir', icon: '🧊', color: '#9fe8ff', level: 35, time: 80, value: 2600, xp: 90,
    inputs: [{ id: 'frostheart', qty: 1 }, { id: 'frostcap', qty: 3 }], desc: 'Cold enough that blows slide off you.',
    combat: [{ type: 'buff', stat: 'dodge', value: 0.4, duration: 45 }] },
  { id: 'p_hazel', name: 'Witchhazel Salve', icon: '🌾', color: '#c8a45c', level: 46, time: 105, value: 8500, xp: 280,
    inputs: [{ id: 'witchhazel', qty: 2 }, { id: 'graveash', qty: 1 }], desc: 'Closes wounds you did not know you had.',
    combat: [{ type: 'heal', value: 0.8 }] },
  { id: 'p_grave', name: 'Gravebind Philter', icon: '⚱️', color: '#6b6b7d', level: 50, time: 130, value: 11000, xp: 370,
    inputs: [{ id: 'graveash', qty: 2 }, { id: 'bonedust', qty: 3 }, { id: 'p_gheal', qty: 1 }], desc: 'Ties the soul on a little tighter.',
    combat: [{ type: 'revive', value: 0.4 }] },
  { id: 'p_abyss', name: 'Abyssal Tonic', icon: '🌊', color: '#1b6b8f', level: 62, time: 200, value: 55000, xp: 1800,
    inputs: [{ id: 'abyssalpearl', qty: 2 }, { id: 'ashlily', qty: 2 }], desc: 'Drink deep. The deep drinks back.',
    combat: [{ type: 'mana', value: 1 }, { type: 'buff', stat: 'spellMult', value: 0.8, duration: 45 }] },
  { id: 'p_mirror', name: 'Mirrorbloom Essence', icon: '🎋', color: '#bfe7e0', level: 68, time: 240, value: 90000, xp: 3000,
    inputs: [{ id: 'mirrorbloom', qty: 3 }, { id: 'runesteel', qty: 1 }], desc: 'Blows land on a reflection instead of you.',
    combat: [{ type: 'buff', stat: 'dodge', value: 0.35, duration: 50 }, { type: 'buff', stat: 'critChance', value: 0.2, duration: 50 }] },
  { id: 'p_ember', name: 'Emberfall Brew', icon: '🔥', color: '#ff6b1a', level: 74, time: 280, value: 160000, xp: 5300,
    inputs: [{ id: 'emberglass', qty: 2 }, { id: 'soulthistle', qty: 2 }, { id: 'p_berserk', qty: 1 }], desc: 'Bottled falling sky.',
    combat: [{ type: 'buff', stat: 'attackMult', value: 1.4, duration: 55 }] },
  { id: 'p_soul', name: 'Soulbind Elixir', icon: '🏵️', color: '#d98cff', level: 80, time: 330, value: 290000, xp: 9600,
    inputs: [{ id: 'soulthistle', qty: 3 }, { id: 'titanheart', qty: 1 }], desc: 'Whatever breaks, it will not be you.',
    combat: [{ type: 'heal', value: 0.9 }, { type: 'buff', stat: 'defenseMult', value: 1, duration: 60 }] },
  { id: 'p_aurora', name: 'Aurora Philter', icon: '🌈', color: '#8ef0d0', level: 88, time: 420, value: 650000, xp: 21000,
    inputs: [{ id: 'auroradust', qty: 3 }, { id: 'glassfern', qty: 2 }], desc: 'Light you can swallow.',
    combat: [{ type: 'mana', value: 1 }, { type: 'buff', stat: 'spellMult', value: 1.5, duration: 60 }] },
  { id: 'p_eternal', name: 'Elixir of Eternity', icon: '♾️', color: '#ffe9a8', level: 96, time: 600, value: 1600000, xp: 53000,
    inputs: [{ id: 'eternabloom', qty: 3 }, { id: 'aethersteel', qty: 1 }, { id: 'p_panacea', qty: 1 }], desc: 'The Panacea was the draft. This is the fair copy.',
    combat: [{ type: 'heal', value: 1 }, { type: 'revive', value: 0.8 }] },
  { id: 'p_magnum', name: 'Magnum Opus Draught', icon: '🜛', color: '#fff2c2', level: 100, time: 900, value: 4500000, xp: 150000,
    inputs: [{ id: 'p_eternal', qty: 1 }, { id: 'p_aurora', qty: 1 }, { id: 'p_soul', qty: 1 }], desc: 'Every lesson you have learned, in one bottle.',
    combat: [{ type: 'heal', value: 1 }, { type: 'mana', value: 1 }, { type: 'buff', stat: 'attackMult', value: 2, duration: 90 }] },
  { id: 'p_panacea', name: "Philosopher's Panacea", icon: '🜔', color: '#f5d76e', level: 60, time: 600, value: 150000, xp: 3000,
    inputs: [{ id: 'p_rebirth', qty: 1 }, { id: 'p_void', qty: 1 }, { id: 'p_star', qty: 1 }], desc: 'The Great Work, distilled.',
    combat: [{ type: 'heal', value: 1 }, { type: 'mana', value: 1 }] },
];

/** Sorted by level — unlock lists and contract pools rely on this order. */
export const RECIPES: Recipe[] = RAW.sort((a, b) => a.level - b.level);

export const RECIPE_MAP: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export function describeCombatEffect(e: CombatEffect, power = 1): string {
  const pct = (v: number) => `${Math.round(v * power * 100)}%`;
  switch (e.type) {
    case 'heal': return `Heals ${pct(e.value)} HP`;
    case 'mana': return `Restores ${pct(e.value)} mana`;
    case 'revive': return `Revives at ${pct(e.value)} HP on death`;
    case 'bomb': return `Deals ${pct(e.value)} of enemy HP (less vs bosses)`;
    case 'buff': {
      const label = { attackMult: 'attack', defenseMult: 'defense', critChance: 'crit chance', dodge: 'dodge', spellMult: 'spell power' }[e.stat];
      return `+${pct(e.value)} ${label} for ${e.duration}s`;
    }
  }
}
