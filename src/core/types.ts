/** Every number the game's systems read from. Base values live in mods.ts; skills, upgrades, guilds, ascension, gear, rituals, events and achievements add to them. */
export interface Mods {
  // Garden
  growSpeed: number;
  harvestYield: number;
  seedDiscount: number;
  mutationChance: number; // multiplies the cross-breeding chance
  // Brewing
  brewSpeed: number;
  doubleBrew: number;
  ingredientSave: number;
  masteryRate: number;
  brewQuality: number; // raises the odds of Fine / Masterwork / Legendary potions
  autoStir: number; // share of a hand stir a trained Brewer supplies on brews you never stirred
  // Commerce
  sellPrice: number;
  demandRecovery: number;
  tradeBonus: number;
  contractReward: number;
  repGain: number;
  // Exploration
  scavSpeed: number;
  scavYield: number;
  rareFind: number;
  // Meta
  xpGain: number;
  stoneGain: number;
  offlineHours: number;
  // Capacity
  plots: number;
  cauldrons: number;
  expSlots: number;
  skillPoints: number;
  startGold: number;
  // Automation capacity: plots / cauldrons / parties / potion types / rituals handled automatically.
  // Only counts while at least one apprentice of the matching role is working (see computeMods).
  autoHarvest: number;
  autoBrew: number;
  autoSell: number;
  autoScav: number;
  autoRitual: number;
  // Judgement, not repetition: these let an apprentice decide rather than just tend more of the same.
  // Each is a flag (>= 1 means on) and, like every auto stat, is zeroed unless that craft is staffed.
  autoPlant: number;
  autoRotate: number;
  autoSeeds: number;
  autoRecipe: number;
  autoSpread: number;
  autoBuy: number;
  autoRoute: number;
  autoSupply: number;
  autoRift: number;
  autoSellAll: number;
  autoContract: number;
  autoTrade: number;
  autoBelt: number;
  autoEquip: number;
  autoGear: number;
  autoDungeon: number;
  autoReagent: number;
  autoStudy: number;
  autoFeed: number;
  autoKit: number;
  autoHire: number;
  autoWait: number;
  autoGoals: number;
  autoSkills: number;
  apprenticeXp: number;
  // Research Library
  // Adventurer company
  partySlots: number; // adventurers who can be on the roster at once (0 = company not chartered)
  kitSlots: number; // potion types the supply kit carries
  delveSpeed: number;
  partyPower: number; // multiplies everything the company brings to a depth
  autoDelve: number; // delves a Captain sends back down on their own
  researchSlots: number; // studies that can run at once
  researchSpeed: number;
  familiarSlots: number; // familiars that can be equipped at once
  // Combat (flat values add to the hero's level-based stats; *Mult values multiply the total)
  attack: number;
  attackMult: number;
  defense: number;
  defenseMult: number;
  maxHp: number;
  hpMult: number;
  spellPower: number;
  spellMult: number;
  critChance: number;
  critDamage: number;
  dodge: number;
  maxMana: number;
  manaRegen: number;
  potionPower: number;
  lootFind: number;
  enemyPower: number;
  spellSlots: number;
  potionSlots: number;
}

export type StatKey = keyof Mods;

export interface Effect {
  stat: StatKey;
  value: number;
}

export interface ItemStack {
  id: string; // item id, or 'gold'
  qty: number;
}

export interface Plot {
  plantId: string | null;
  progress: number;
  ready: boolean;
  trait: string | null; // mutation sown into this plot, from data/mutations.ts
}

export interface Cauldron {
  recipeId: string | null;
  progress: number;
  active: boolean;
  repeat: boolean;
  // Stirring minigame: a mash window that opens when you start a brew by hand.
  // Wall-clock stamp (ms) rather than a ticked countdown, so the window closes on time whatever the
  // tick size — including when an offline catch-up runs the whole thing in one step.
  stirStart: number; // Date.now() when the window opened; 0 = closed
  stirClicks: number; // taps worked into this brew so far
  stirQ: number; // quality score banked for the brew in progress
}

export interface Expedition {
  zoneId: string;
  progress: number;
  repeat: boolean;
}

export interface Contract {
  kind?: 'deliver' | 'slay'; // undefined = deliver (older saves)
  recipeId: string; // potion to deliver ('' for slay contracts)
  dungeonId?: string; // dungeon to hunt in (slay contracts)
  qty: number;
  delivered: number;
  gold: number;
  rep: number;
  qual?: number; // accumulated quality credit from the potions handed in so far
}

export interface TradeOffer {
  title: string;
  give: ItemStack[];
  get: ItemStack[];
  used: boolean;
}

export interface Stats {
  runGold: number;
  totalGold: number;
  bestRunGold: number;
  brewed: number;
  harvested: number;
  expeditions: number;
  potionsSold: number;
  contracts: number;
  trades: number;
  playTime: number;
  runTime: number;
  kills: number;
  bosses: number;
  deaths: number;
  gearFound: number;
  bestRarity: number;
  spellsCast: number;
  events: number;
  bestQuality: number; // best potion quality tier ever brewed
  runQuality: number; // best tier brewed *this run* — a lifetime max cannot say what this run achieved
  delves: number; // Rift delves the company has run
}

// ── Combat & magic ───────────────────────────────────────────
export type CombatBuffStat = 'attackMult' | 'defenseMult' | 'critChance' | 'dodge' | 'spellMult';

/** What a potion does when used from the potion belt. Values scale with the potionPower stat. */
export type CombatEffect =
  | { type: 'heal'; value: number } // fraction of max HP
  | { type: 'mana'; value: number } // fraction of max mana
  | { type: 'buff'; stat: CombatBuffStat; value: number; duration: number }
  | { type: 'bomb'; value: number } // fraction of the enemy's max HP (reduced vs bosses)
  | { type: 'revive'; value: number }; // used automatically on death, revives at this fraction of max HP

export type GearSlot = 'weapon' | 'helm' | 'armor' | 'trinket';

export interface GearItem {
  uid: string;
  base: string;
  tier: number;
  rarity: number;
  quality: number; // 0.9–1.1 roll on primary stats
  enhance: number;
  affixes: Effect[];
}

export interface ActiveBuff {
  id: string; // ritual spell id
  remaining: number;
}

export interface CombatBuff {
  source: string;
  stat: CombatBuffStat;
  value: number;
  remaining: number;
}

export type EnemyRank = 'normal' | 'elite' | 'boss' | 'champion';

export interface Enemy {
  name: string;
  icon: string;
  rank: EnemyRank;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  speed: number;
  xp: number;
  gold: number;
}

export interface CombatState {
  dungeonId: string | null;
  floor: number;
  kills: number;
  autoAdvance: boolean;
  enemy: Enemy | null;
  hp: number;
  shield: number;
  heroTimer: number;
  enemyTimer: number;
  potionCd: number;
  cooldowns: Record<string, number>;
  buffs: CombatBuff[];
  slow: number;
  dead: number; // seconds until recovered
  retreated: boolean; // dropped a floor after a defeat (a Squire will push again)
  champion: boolean; // a Wandering Champion is waiting to spawn
  log: string[];
}

/** A study in progress at the Library. */
export interface Study {
  id: string; // research id
  progress: number; // seconds of research done
  time: number; // total seconds this study needs (cost/time grow for repeatable projects)
}

export interface ResearchState {
  queue: Study[]; // running studies, one per slot
  done: Record<string, number>; // research id -> times completed
}

export interface EventState {
  id: string;
  remaining: number;
  progress: number;
}

// ── Apprentices ──────────────────────────────────────────────
export type RoleId = 'gardener' | 'brewer' | 'scout' | 'shopkeeper' | 'squire' | 'scribe' | 'captain';

/** One craft's apprentice. There is exactly one per role, unlocked through the Library. */
export interface Apprentice {
  role: RoleId;
  xp: number; // lifetime work XP; level and skill points are derived from it
  nodes: Record<string, number>; // upgrade tree ranks, keyed by node id
}

export interface StaffState {
  crew: Partial<Record<RoleId, Apprentice>>;
  repush: number; // Squire timer
}

// ── Adventurer company ───────────────────────────────────────
/** One hired hero. Level and the skills that come with it are derived from delve XP. */
export interface Adventurer {
  uid: string;
  cls: string; // data/adventurers.ts class id
  xp: number;
  rest: number; // seconds of injury left; an injured adventurer adds nothing to the party
}

/** A delve in progress. Depth is fixed when it sets out, so a relic run cannot be re-aimed mid-descent. */
export interface Delve {
  depth: number;
  progress: number;
  time: number; // total seconds this delve takes, banked at departure
  power: number; // party power at departure, supplies included
  supplied: number; // kit slots that were actually filled
}

export interface PartyState {
  roster: Adventurer[];
  kit: (string | null)[]; // potion ids the company drinks on the way down
  delve: Delve | null;
  depth: number; // deepest depth cleared; the next delve goes one lower
  relics: Record<string, number>; // relic id → rank
  repeat: boolean; // a Captain sends them straight back down
  nextId: number;
}

export interface GameState {
  version: number;
  gold: number;
  items: Record<string, number>;
  /** Per-quality-tier counts for potions: qual[id][tier]. Sums to items[id]; see data/quality.ts. */
  qual: Record<string, number[]>;
  seeds: Record<string, number>; // mutated seeds on hand, keyed `plantId:trait`
  catalogue: Record<string, true>; // every plant × trait pair ever discovered (permanent)
  /** Rank per strain, keyed `plantId:trait`: how many seeds of it have been sown (permanent). */
  strains: Record<string, number>;
  /**
   * Hybrid crosses discovered, and the ones read about but not yet made. Both are *knowledge* rather than
   * stock, so both survive the Great Work unconditionally — re-finding the same journal page every run
   * would be a chore rather than a challenge. See data/hybrids.ts.
   */
  codex: Record<string, true>;
  clues: Record<string, true>;
  /** The crossing bench, when something is on it. One cross at a time. */
  bench: { hybrid: string; seedA: string; seedB: string; progress: number; time: number } | null;
  level: number;
  xp: number;
  skills: Record<string, number>;
  upgrades: Record<string, number>;
  plots: Plot[];
  cauldrons: Cauldron[];
  expeditions: (Expedition | null)[];
  riftDepth: number;
  demand: Record<string, number>;
  hotPotion: string | null;
  hotTimer: number;
  prof: Record<string, number>; // proficiency XP per plant / potion / reagent / forge tier (permanent)
  /** Lifetime gold earned per source — see core/ledger.ts. The recent window is in memory, not here. */
  income: Record<string, number>;
  /**
   * Every carried-over counter as it stood when this run began. Most of the game's tallies are lifetime,
   * so "what did this run do" is the difference against this — which is what the Great Work now weighs.
   */
  runStart: Record<string, number>;
  guild: { id: string | null; rep: number; contracts: Contract[] };
  trade: { offers: TradeOffer[]; timer: number };
  asc: { stones: number; total: number; count: number; nodes: Record<string, number> };
  stats: Stats;
  achievements: Record<string, boolean>;
  goals: Record<string, 'done' | 'claimed'>; // tutorial goals (permanent; rewards pay out once ever)
  autoSell: Record<string, boolean>;
  settings: { notation: 'suffix' | 'sci'; keepReserve: number; autoSalvage: number; lootPops: boolean; fineStudies: boolean };
  // Magic
  mana: number;
  spells: Record<string, number>; // learned spell ranks
  spellSlots: string[]; // equipped combat spells
  autoRituals: Record<string, boolean>;
  buffs: ActiveBuff[]; // active ritual buffs
  // Combat
  belt: (string | null)[]; // potion ids on the potion belt
  gear: GearItem[];
  equipped: Record<GearSlot, string | null>; // gear uids
  nextGearId: number;
  combat: CombatState;
  dungeons: Record<string, number>; // best floor cleared per dungeon
  // Events
  event: EventState | null;
  eventTimer: number;
  // Research Library
  research: ResearchState;
  /** Familiars found so far, by id, with the XP fed into each. */
  familiars: Record<string, number>;
  equippedFamiliars: string[];
  // Adventurer company (kept through ascension only with the Standing Company perk)
  party: PartyState;
  // Apprentices
  staff: StaffState;
  /**
   * Crafts the player has taken back from their apprentice, keyed by role (plus 'meta' for the two
   * eternal perks that spend for you). An apprentice still tends their beds and pots — that is what they
   * *are* — but stops making choices: what to plant, which recipe, what to sell, where to send a party.
   */
  autoOff: Record<string, true>;
  lastTick: number;
}
