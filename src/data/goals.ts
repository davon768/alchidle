import type { GameState, ItemStack } from '../core/types';
import { profLevel } from './proficiency';
import { REAGENTS } from './spells';
import { ascGoldTarget, ascMinLevel } from './ascension';
import { apprenticeLevel, ROLES } from './apprentices';

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

/** Every talent gated behind a rebirth — the judgement tier. Derived, so a new one counts automatically. */
const JUDGEMENT = new Set(ROLES.flatMap((r) => r.tree.filter((n) => (n.minAsc ?? 0) > 0).map((n) => n.id)));

const bestProf = (s: GameState) => Math.max(1, ...Object.values(s.prof).map(profLevel));
const ascensionOpen = (s: GameState) => s.asc.count > 0 || s.stats.runGold >= ascGoldTarget(0) * 0.2;

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

  { id: 'ledger', chapter: 'Workshop basics', title: 'Find your bottleneck', level: 5, tab: 'ledger',
    how: 'Earn gold from three different systems, then read the 📊 Ledger.',
    about: 'The Ledger says which system is actually paying you and what is standing still — a cauldron waiting on one herb, a bed left fallow, a party never sent. It is the fastest way to find the one thing holding a run back.',
    check: (s) => Object.keys(s.income ?? {}).length >= 3,
    progress: (s) => [Math.min(3, Object.keys(s.income ?? {}).length), 3], reward: { gold: 500 } },

  // ── Apprentices ────────────────────────────────────────────
  { id: 'hire', chapter: 'Apprentices', title: 'Take on an apprentice', level: 3, tab: 'library',
    how: 'Finish A Gardener\u2019s Hands in the \ud83d\udcda Library.',
    about: 'Apprentices are unlocked by study rather than hired. Each craft has exactly one, and every one you unlock automates part of the workshop for good.',
    check: (s) => Object.keys(s.staff.crew).length > 0, reward: { gold: 150 } },
  { id: 'assign', chapter: 'Apprentices', title: 'Spend a skill point', level: 3, tab: 'staff',
    how: 'Buy anything in an apprentice\u2019s upgrade tree.',
    about: 'Apprentices earn a skill point every level, and levels come from doing their work. You decide where those points go \u2014 more plots tended, or the same few tended better.',
    check: (s) => Object.values(s.staff.crew).some((a) => a && Object.keys(a.nodes).length > 0), reward: { gold: 100 } },
  { id: 'automate', chapter: 'Apprentices', title: 'Automate a cauldron', level: 5, tab: 'brew',
    how: 'With a Brewer working, turn on \ud83d\udd01 Repeat on a cauldron.',
    about: 'A cauldron tended by a Brewer restarts its recipe on its own for as long as the ingredients last.',
    check: (s) => s.cauldrons.some((c) => c.repeat), reward: { gold: 200 } },
  { id: 'judgement', chapter: 'Apprentices', title: 'Let an apprentice decide', level: 8, tab: 'staff',
    when: (s) => s.asc.count >= 1,
    how: 'After your first Magnum Opus, spend an apprentice\u2019s points on a \ud83c\udf1f judgement talent, deep in any tree.',
    about: 'Early talents buy capacity \u2014 more beds tended, more cauldrons watched. The deep ones, marked \ud83c\udf1f, buy judgement: an apprentice who picks what to plant, chooses the recipe worth brewing, restocks the missing reagent, takes the contract, or sends the company down the Rift without you. A new layer opens with every rebirth, and together they are how a workshop eventually runs itself.',
    check: (s) => Object.values(s.staff.crew).some((a) => a && Object.keys(a.nodes).some((id) => JUDGEMENT.has(id))),
    reward: { gold: 25000 } },
  { id: 'event', chapter: 'Apprentices', title: 'Witness a world event', level: 3,
    how: 'Keep playing \u2014 the next event arrives within 8 minutes.',
    about: 'World events change the rules for a few minutes: bountiful rain, market booms, goblin raids. The banner at the top shows what each one does.',
    check: (s) => s.stats.events >= 1, reward: { gold: 150 } },
  { id: 'study', chapter: 'Apprentices', title: 'Grow an apprentice to level 10', level: 5, tab: 'staff',
    how: 'Leave them working \u2014 levels come from the job itself.',
    about: 'Your own proficiency in a craft makes you a better teacher, so the more you brew, the faster your Brewer learns. Ten levels is ten skill points to spend.',
    check: (s) => Object.values(s.staff.crew).some((a) => a && apprenticeLevel(a.xp) >= 10), reward: { gold: 250 } },

  // ── Craft & proficiency ────────────────────────────────────
  { id: 'prof10', chapter: 'Craft & proficiency', title: 'Reach proficiency 10', level: 1, tab: 'proficiency',
    how: 'Keep growing or brewing the same thing, and watch 🎖️ Proficiency.',
    about: 'Everything you grow, brew, craft and forge has its own proficiency, from 1 to 100. Every 10 levels unlocks a milestone: faster, more output, higher value.',
    check: (s) => bestProf(s) >= 10, progress: (s) => [Math.min(10, bestProf(s)), 10], reward: { gold: 400 } },
  { id: 'stir', chapter: 'Craft & proficiency', title: 'Stir a finer potion', level: 2, tab: 'brew',
    how: 'Press Brew by hand, then tap 🥄 STIR as fast as you can before the window closes.',
    about: 'Every brew rolls a quality: Common, ✦ Fine, ✦✦ Masterwork or ★ Legendary. Better bottles sell for more, hit harder in a fight and go deeper down the Rift. Every stir works more quality into the pot, and eighteen fills it; stirring is optional, and a trained Brewer stirs the pots they tend for you.',
    check: (s) => (s.stats.bestQuality ?? 0) >= 1, reward: { gold: 300 } },

  { id: 'crossbreed', chapter: 'Craft & proficiency', title: 'Breed a new strain', level: 3, tab: 'garden',
    how: 'Grow two different herbs in neighbouring plots, then harvest them.',
    about: 'A ripe plot beside a different herb can throw a mutated seed — Swift, Bountiful, Radiant or Hardy. Sowing one upgrades that bed for good: the strain survives every replant, your Gardener’s included. Every strain you discover is also recorded in the catalogue, which pays +1% growth and yield for each one, forever.',
    check: (s) => Object.keys(s.catalogue).length > 0, reward: { gold: 200 } },
  { id: 'crossbench', chapter: 'Craft & proficiency', title: 'Cross two herbs into one', level: 6, tab: 'garden',
    when: (s) => Object.keys(s.clues ?? {}).length > 0,
    how: 'Read a torn journal page, then feed the Crossing Bench a seed of each parent herb.',
    about: 'Some herbs do not grow wild — you have to make them. Pages naming a cross turn up on expeditions, in the hoards of dungeon bosses and folded into finished studies; you never start knowing one. A cross costs a mutated seed of each parent, which is what your seed tray is really for, and the traits you spend change the result: Swift cuts the time, Bountiful and Radiant hand you seeds of the new strain, Hardy spares the herbs. What you discover is yours forever — the Great Work unmakes the garden, never the notebook.',
    check: (s) => Object.keys(s.codex ?? {}).length >= 1, reward: { gold: 2000 } },
  { id: 'familiar', chapter: 'Craft & proficiency', title: 'Make a friend', level: 3, tab: 'explore',
    how: 'Keep sending expeditions until a familiar follows you home.',
    about: 'Every zone has a companion that may turn up on an expedition there. Feed it potions to level it — finer bottles are worth far more — and each bond it forms every 5 levels is a permanent bonus while it is out with you.',
    check: (s) => Object.keys(s.familiars).length > 0, reward: { gold: 250 } },
  { id: 'research', chapter: 'Craft & proficiency', title: 'Begin a study', level: 4, tab: 'library',
    how: 'Start any study in the 📚 Research Library.',
    about: 'Studies run on their own clock — minutes at first, hours later — and keep going while the game is closed. They are the one thing that competes with the market for your materials, and their bonuses last the whole run. They are undone by the Great Work unless you own \ud83c\udfdb\ufe0f The Standing Archive.',
    check: (s) => Object.keys(s.research.done).length > 0 || s.research.queue.length > 0, reward: { gold: 500 } },

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

  // ── The company ────────────────────────────────────────────
  { id: 'company', chapter: 'The company', title: 'Charter a company', level: 14, tab: 'library',
    how: 'Finish Charter a Company in the 📚 Library, then hire an adventurer in 🏕️ Company.',
    about: 'Adventurers delve the Endless Rift for you. Each one you take on costs far more than the last, and every class brings something different — power, protection, bigger hauls or better luck with relics.',
    check: (s) => s.party.roster.length > 0, reward: { gold: 20000 } },
  { id: 'delve', chapter: 'The company', title: 'Supply a delve', level: 14, tab: 'party',
    when: (s) => s.party.roster.length > 0,
    how: 'Put a combat potion in the supply kit, then send the company down.',
    about: 'A delve drinks one bottle of every kitted potion per adventurer — and another round every ten depths — best bottles first — so Legendary brewing goes straight into how deep they can reach. Win and the depth is yours for good; lose and they limp home with a third of the haul.',
    check: (s) => s.stats.delves >= 1, reward: { items: [{ id: 'crystal', qty: 10 }] } },
  { id: 'relic', chapter: 'The company', title: 'Bring back a relic', level: 14, tab: 'party',
    when: (s) => s.party.roster.length > 0,
    how: 'Clear depth 10, where the first Rift boss waits.',
    about: 'Every tenth depth is a boss holding a relic. Relics are ranks, not gear — pulling the same one again makes it stronger. The company and everything it has earned is unmade by the Great Work unless you own \ud83c\udfd5\ufe0f Standing Company.',
    check: (s) => Object.keys(s.party.relics).length > 0,
    progress: (s) => [Math.min(10, s.party.depth), 10], reward: { gold: 250000 } },

  // ── The long game ──────────────────────────────────────────
  { id: 'ascend', chapter: 'The long game', title: 'Perform the Magnum Opus', level: 1, when: ascensionOpen, tab: 'ascend',
    how: `Reach level ${ascMinLevel(0)} and earn ${(ascGoldTarget(0) / 1000).toFixed(0)}K gold in one run, then ascend in 🌟 Magnum Opus.`,
    about: 'Ascending resets your run for Philosopher’s Stones. You keep stones, eternal perks, proficiency, research, apprentices and achievements — and because so much carries over, each Great Work asks for a higher level and 2.5× the gold of the last. Gold is only the gate: the stones themselves weigh thirteen strands of what the run did — what you brewed, grew, studied, slew and discovered — so a run that touched every system pays far better than a rich one that did nothing else.',
    check: (s) => s.asc.count >= 1, progress: (s) => [Math.min(ascGoldTarget(0), s.stats.runGold), ascGoldTarget(0)], reward: { gold: 5000 } },
  { id: 'perk', chapter: 'The long game', title: 'Buy an eternal perk', level: 1, when: (s) => s.asc.count > 0, tab: 'ascend',
    how: 'Spend Philosopher’s Stones in 🌟 Magnum Opus.',
    about: 'Eternal perks never reset. Every stone you’ve ever earned also raises your sell prices by 2%, even after you spend it.',
    check: (s) => Object.values(s.asc.nodes).some((v) => v > 0), reward: { gold: 5000 } },
  { id: 'graduate', chapter: 'The long game', title: 'Master a craft', level: 3, tab: 'staff',
    how: 'Take any apprentice to level 30 by leaving them at their work.',
    about: 'Thirty levels is thirty skill points, enough to take a tree deep rather than wide. Apprentices and their trees are undone by the Great Work unless you own \ud83e\udd1d Loyal Apprentices.',
    check: (s) => Object.values(s.staff.crew).some((a) => a && apprenticeLevel(a.xp) >= 30),
    progress: (s) => {
      const best = Math.max(0, ...Object.values(s.staff.crew).map((a) => (a ? apprenticeLevel(a.xp) : 0)));
      return [Math.min(30, best), 30];
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
