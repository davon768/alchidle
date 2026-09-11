import type { GameState, ItemStack } from '../core/types';
import { profLevel } from './proficiency';
import { REAGENTS } from './spells';
import { ASC_MIN_GOLD } from './ascension';
import { TALENTS } from './apprentices';

/**
 * Goals are the game's tutorial: each one teaches a single mechanic. They are listed in the order a player
 * meets the systems; the banner shows the first claimable goal, else the first available one.
 * When you add a system, add a goal for it here.
 */
export interface GoalDef {
  id: string;
  chapter: string;
  title: string;
  how: string; // what to do, in one line
  about: string; // how the mechanic works, one or two sentences
  level: number; // player level before the goal appears
  when?: (s: GameState) => boolean; // extra availability condition
  tab?: string; // tab the "Show me" button opens
  check: (s: GameState) => boolean;
  progress?: (s: GameState) => [number, number];
  reward: { gold?: number; items?: ItemStack[] };
}

const bestProf = (s: GameState) => Math.max(1, ...Object.values(s.prof).map(profLevel));
const ascensionOpen = (s: GameState) => s.asc.count > 0 || s.stats.runGold >= ASC_MIN_GOLD * 0.2;

export const GOALS: GoalDef[] = [
  // ── Workshop basics ────────────────────────────────────────
  { id: 'harvest', chapter: 'Workshop basics', title: 'Grow your first herbs', level: 1, tab: 'garden',
    how: 'Plant Sunleaf in the 🌱 Garden, then harvest it when it ripens.',
    about: 'Garden plots grow herbs on a timer. Harvesting replants the same herb automatically if you can afford the seed.',
    check: (s) => s.stats.harvested >= 1, reward: { gold: 15 } },
  { id: 'brew', chapter: 'Workshop basics', title: 'Brew your first potion', level: 1, tab: 'brew',
    how: 'Choose Minor Healing Tonic in a cauldron and press Brew.',
    about: 'Cauldrons turn ingredients into potions. Most early recipes need 💧 Clearwater, found on expeditions or bought at the Market.',
    check: (s) => s.stats.brewed >= 1, reward: { gold: 20, items: [{ id: 'clearwater', qty: 5 }] } },
  { id: 'sell', chapter: 'Workshop basics', title: 'Make your first sale', level: 1, tab: 'market',
    how: 'Sell a potion at the 🏪 Market.',
    about: 'Selling lots of one potion lowers its price until demand recovers, so spread your sales. Watch for 📣 hot sellers paying extra.',
    check: (s) => s.stats.potionsSold >= 1, reward: { gold: 30 } },
  { id: 'expedition', chapter: 'Workshop basics', title: 'Send out an expedition', level: 1, tab: 'explore',
    how: 'Send a party to the Whispering Meadow in 🧭 Expeditions.',
    about: 'Parties travel to a zone and bring back materials automatically. New zones unlock as you level.',
    check: (s) => s.stats.expeditions >= 1, reward: { gold: 25 } },
  { id: 'upgrade', chapter: 'Workshop basics', title: 'Improve your workshop', level: 2, tab: 'workshop',
    how: 'Buy any upgrade in the 🔨 Workshop.',
    about: 'Workshop upgrades add plots and cauldrons and stack speed bonuses. They last until you ascend.',
    check: (s) => Object.values(s.upgrades).some((v) => v > 0), reward: { gold: 50 } },
  { id: 'skill', chapter: 'Workshop basics', title: 'Learn a skill', level: 2, tab: 'skills',
    how: 'Spend a skill point in 📜 Skills.',
    about: 'You earn a skill point every level, plus 2 bonus points every 10th level. Deeper rows of a tree need points spent in that tree first.',
    check: (s) => Object.values(s.skills).some((v) => v > 0), reward: { gold: 60 } },

  // ── Apprentices ────────────────────────────────────────────
  { id: 'hire', chapter: 'Apprentices', title: 'Hire an apprentice', level: 3, tab: 'staff',
    how: 'Hire a candidate in 👥 Apprentices.',
    about: 'Apprentices automate your workshop. Talent sets how high they can level; traits add quirks like extra plots or faster learning.',
    check: (s) => s.staff.hired.length > 0 || s.staff.masters.length > 0, reward: { gold: 150 } },
  { id: 'assign', chapter: 'Apprentices', title: 'Give them a job', level: 3, tab: 'staff',
    how: 'Choose a role for your apprentice.',
    about: 'Each role automates one system: Gardeners harvest, Brewers repeat cauldrons, Scouts repeat expeditions. Trained apprentices handle more at once.',
    check: (s) => s.staff.hired.some((a) => a.role) || s.staff.masters.length > 0, reward: { gold: 100 } },
  { id: 'automate', chapter: 'Apprentices', title: 'Automate a cauldron', level: 3, tab: 'brew',
    how: 'With a Brewer apprentice working, turn on 🔁 Repeat on a cauldron.',
    about: 'A cauldron tended by a Brewer restarts its recipe on its own for as long as the ingredients last.',
    check: (s) => s.cauldrons.some((c) => c.repeat), reward: { gold: 200 } },
  { id: 'event', chapter: 'Apprentices', title: 'Witness a world event', level: 3,
    how: 'Keep playing — the next event arrives within 8 minutes.',
    about: 'World events change the rules for a few minutes: bountiful rain, market booms, goblin raids. The banner at the top shows what each one does.',
    check: (s) => s.stats.events >= 1, reward: { gold: 150 } },
  { id: 'study', chapter: 'Apprentices', title: 'Send an apprentice to study', level: 3, tab: 'staff',
    how: 'Switch an apprentice to 📚 Study.',
    about: 'Studying levels an apprentice faster but costs tuition, and they stop working meanwhile. Your own proficiency in their craft makes them learn faster.',
    check: (s) => s.staff.hired.some((a) => a.mode === 'train') || s.staff.masters.length > 0, reward: { gold: 250 } },

  // ── Craft & proficiency ────────────────────────────────────
  { id: 'prof10', chapter: 'Craft & proficiency', title: 'Reach proficiency 10', level: 1, tab: 'proficiency',
    how: 'Keep growing or brewing the same thing, and watch 🎖️ Proficiency.',
    about: 'Everything you grow, brew, craft and forge has its own proficiency, from 1 to 100. Every 10 levels unlocks a milestone: faster, more output, higher value.',
    check: (s) => bestProf(s) >= 10, progress: (s) => [Math.min(10, bestProf(s)), 10], reward: { gold: 400 } },
  { id: 'stir', chapter: 'Craft & proficiency', title: 'Stir a finer potion', level: 2, tab: 'brew',
    how: 'Press Brew by hand, then tap 🥄 Stir while the marker is inside the glowing band.',
    about: 'Every brew rolls a quality: Common, ✦ Fine, ✦✦ Masterwork or ★ Legendary. Better bottles sell for more and hit harder in a fight. Stirring is optional — a miss costs nothing — and apprentices roll quality from brewing proficiency alone.',
    check: (s) => (s.stats.bestQuality ?? 0) >= 1, reward: { gold: 300 } },

  // ── Commerce ───────────────────────────────────────────────
  { id: 'trade', chapter: 'Commerce', title: 'Strike a deal', level: 6, tab: 'trade',
    how: 'Accept an offer at the 🐪 Trading Post.',
    about: 'Caravans bring new offers every 5 minutes. Bulk orders pay a fixed price that ignores market demand, which makes them great for surplus potions.',
    check: (s) => s.stats.trades >= 1, reward: { gold: 400 } },
  { id: 'guild', chapter: 'Commerce', title: 'Join a guild', level: 8, tab: 'guild',
    how: 'Join a guild in 🛡️ Guilds.',
    about: 'Guild perks grow with your rank. You can belong to only one guild, and switching resets your reputation.',
    check: (s) => !!s.guild.id, reward: { gold: 600 } },
  { id: 'contract', chapter: 'Commerce', title: 'Fulfill a contract', level: 8, tab: 'guild',
    how: 'Deliver the potions a contract asks for, or claim a finished bounty.',
    about: 'Contracts pay gold plus reputation toward your next guild rank. Rerolling one you don’t like costs gold.',
    check: (s) => s.stats.contracts >= 1, reward: { gold: 800 } },

  // ── Adventure ──────────────────────────────────────────────
  { id: 'belt', chapter: 'Adventure', title: 'Pack your potion belt', level: 10, tab: 'dungeon',
    how: 'Put Minor Healing Tonics in a belt slot in ⚔️ Dungeons.',
    about: 'The belt drinks potions for you in battle: healing below 50% HP, buffs as they wear off, bombs on elites and bosses.',
    check: (s) => s.belt.some((id) => id && (s.items[id] ?? 0) >= 1), reward: { items: [{ id: 'p_heal', qty: 10 }] } },
  { id: 'kill', chapter: 'Adventure', title: 'Win your first fight', level: 10, tab: 'dungeon',
    how: 'Enter the Goblin Warrens in ⚔️ Dungeons.',
    about: 'You fight automatically, even offline. Clear 5 foes to advance a floor; if you fall, you retreat one floor and recover.',
    check: (s) => s.stats.kills >= 1, reward: { gold: 500 } },
  { id: 'equip', chapter: 'Adventure', title: 'Gear up', level: 10, tab: 'armory',
    how: 'Equip an item in the 🗡️ Armory.',
    about: 'Gear adds attack, defense and HP. Higher rarities roll bonus stats, and some bonuses even speed up your garden or raise sell prices.',
    check: (s) => Object.values(s.equipped).some(Boolean), reward: { gold: 800 } },

  // ── Magic ──────────────────────────────────────────────────
  { id: 'reagent', chapter: 'Magic', title: 'Craft a spell reagent', level: 10, tab: 'arcanum',
    how: 'Craft Rune Chalk or Spell Ink at the Arcane Workbench, at the bottom of 🔮 Arcanum.',
    about: 'Spells are learned with reagents, crafted from herbs, expedition finds and dungeon drops. Rune Chalk is 2 Quartz + 1 Clearwater; Spell Ink is 2 Moonpetal + 1 Bat Wing.',
    check: (s) => REAGENTS.some((r) => (s.prof[r.id] ?? 0) > 0 || (s.items[r.id] ?? 0) >= 1),
    reward: { items: [{ id: 'runechalk', qty: 3 }, { id: 'spellink', qty: 2 }] } },
  { id: 'spell', chapter: 'Magic', title: 'Learn a spell', level: 10, tab: 'arcanum',
    how: 'Learn Firebolt in 🔮 Arcanum.',
    about: 'Combat spells cast themselves in battle from your spell slots. Rituals boost a whole system for 5 minutes. Both draw from your mana.',
    check: (s) => Object.keys(s.spells).length > 0, reward: { gold: 800 } },

  // ── Adventure (continued) ──────────────────────────────────
  { id: 'boss', chapter: 'Adventure', title: 'Topple a dungeon boss', level: 10, tab: 'dungeon',
    how: 'Reach floor 10 of the Goblin Warrens and defeat Chieftain Gorrak.',
    about: 'Every 10th floor, and a dungeon’s last floor, ends with a boss after its guards. Bosses always drop gear and rare materials.',
    check: (s) => s.stats.bosses >= 1, progress: (s) => [Math.min(10, s.dungeons['goblin'] ?? 0), 10], reward: { gold: 1500 } },
  { id: 'forge', chapter: 'Adventure', title: 'Forge an item', level: 10, tab: 'armory',
    how: 'Forge a weapon or armor piece in the 🗡️ Armory.',
    about: 'The Forge crafts a random item for the slot you choose — always Fine or better — from dungeon materials.',
    check: (s) => Object.keys(s.prof).some((k) => k.startsWith('forge')), reward: { items: [{ id: 'ironore', qty: 8 }, { id: 'fang', qty: 3 }] } },
  { id: 'enhance', chapter: 'Adventure', title: 'Enhance your gear', level: 10, tab: 'armory',
    how: 'Enhance an equipped item in the 🗡️ Armory.',
    about: 'Each enhancement adds +10% to an item’s base stats, with no cap. It costs gold and Arcane Dust, which you get by salvaging gear.',
    check: (s) => s.gear.some((g) => g.enhance > 0), reward: { items: [{ id: 'arcanedust', qty: 30 }] } },

  // ── Magic (continued) ──────────────────────────────────────
  { id: 'ritual', chapter: 'Magic', title: 'Cast a ritual', level: 12, tab: 'arcanum',
    how: 'Learn Verdant Surge in 🔮 Arcanum, then cast it.',
    about: 'Rituals boost a whole system — garden, cauldrons, shop, expeditions — for 5 minutes. A Scribe apprentice can keep them running for you.',
    check: (s) => s.buffs.length > 0, reward: { items: [{ id: 'spellink', qty: 3 }] } },

  // ── The long game ──────────────────────────────────────────
  { id: 'ascend', chapter: 'The long game', title: 'Perform the Magnum Opus', level: 1, when: ascensionOpen, tab: 'ascend',
    how: `Earn ${(ASC_MIN_GOLD / 1000).toFixed(0)}K gold in one run, then ascend in 🌟 Magnum Opus.`,
    about: 'Ascending resets your run for Philosopher’s Stones. You keep stones, eternal perks, proficiency, achievements and your Hall of Masters.',
    check: (s) => s.asc.count >= 1, progress: (s) => [Math.min(ASC_MIN_GOLD, s.stats.runGold), ASC_MIN_GOLD], reward: { gold: 5000 } },
  { id: 'perk', chapter: 'The long game', title: 'Buy an eternal perk', level: 1, when: (s) => s.asc.count > 0, tab: 'ascend',
    how: 'Spend Philosopher’s Stones in 🌟 Magnum Opus.',
    about: 'Eternal perks never reset. Every stone you’ve ever earned also raises your sell prices by 2%, even after you spend it.',
    check: (s) => Object.values(s.asc.nodes).some((v) => v > 0), reward: { gold: 5000 } },
  { id: 'graduate', chapter: 'The long game', title: 'Graduate an apprentice', level: 3, tab: 'staff',
    how: 'Train an apprentice to their level cap, then press 🎓 Graduate.',
    about: 'Graduates join the Hall of Masters: a permanent bonus that survives ascension, and every master makes future apprentices learn faster.',
    check: (s) => s.staff.masters.length >= 1,
    progress: (s) => {
      const best = [...s.staff.hired].sort((a, b) => b.level / TALENTS[b.talent].cap - a.level / TALENTS[a.talent].cap)[0];
      return best ? [best.level, TALENTS[best.talent].cap] : [0, TALENTS[0].cap];
    },
    reward: { gold: 5000 } },
  { id: 'rift', chapter: 'The long game', title: 'Descend the Endless Rift', level: 50, tab: 'explore',
    how: 'Send a party to 🌀 The Endless Rift in Expeditions.',
    about: 'Every trip into the Rift goes one level deeper, with bigger rewards and longer journeys, forever.',
    check: (s) => s.riftDepth >= 1, reward: { gold: 100000 } },
];

export const GOAL_MAP: Record<string, GoalDef> = Object.fromEntries(GOALS.map((g) => [g.id, g]));

/** Chapters in the order they first appear. */
export const GOAL_CHAPTERS: string[] = [...new Set(GOALS.map((g) => g.chapter))];
