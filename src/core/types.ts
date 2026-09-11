/** Every number the game's systems read from. Base values live in mods.ts; skills, upgrades, guilds, ascension, gear, rituals, events and achievements add to them. */
export interface Mods {
  // Garden
  growSpeed: number;
  harvestYield: number;
  seedDiscount: number;
  // Brewing
  brewSpeed: number;
  doubleBrew: number;
  ingredientSave: number;
  masteryRate: number;
  brewQuality: number; // raises the odds of Fine / Masterwork / Legendary potions
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
  apprenticeSlots: number;
  apprenticeXp: number;
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
}

export interface Cauldron {
  recipeId: string | null;
  progress: number;
  active: boolean;
  repeat: boolean;
  // Stirring minigame: a one-shot window that opens when you start a brew by hand.
  stirLeft: number; // seconds remaining in the window; 0 = closed
  stirTarget: number; // sweet-spot centre, 0–1 across the bar
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

export interface EventState {
  id: string;
  remaining: number;
  progress: number;
}

// ── Apprentices ──────────────────────────────────────────────
export type RoleId = 'gardener' | 'brewer' | 'scout' | 'shopkeeper' | 'squire' | 'scribe';

export interface Apprentice {
  id: string;
  name: string;
  icon: string;
  talent: number; // index into TALENTS
  traits: string[];
  role: RoleId | null;
  mode: 'work' | 'train';
  level: number;
  xp: number;
}

export interface MasterRecord {
  name: string;
  icon: string;
  role: RoleId;
  talent: number;
}

export interface StaffState {
  hired: Apprentice[];
  candidates: Apprentice[];
  refresh: number; // seconds until new candidates arrive
  masters: MasterRecord[]; // graduates — permanent bonuses
  nextId: number;
  repush: number; // Squire timer
}

export interface GameState {
  version: number;
  gold: number;
  items: Record<string, number>;
  /** Per-quality-tier counts for potions: qual[id][tier]. Sums to items[id]; see data/quality.ts. */
  qual: Record<string, number[]>;
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
  guild: { id: string | null; rep: number; contracts: Contract[] };
  trade: { offers: TradeOffer[]; timer: number };
  asc: { stones: number; total: number; count: number; nodes: Record<string, number> };
  stats: Stats;
  achievements: Record<string, boolean>;
  goals: Record<string, 'done' | 'claimed'>; // tutorial goals (permanent; rewards pay out once ever)
  autoSell: Record<string, boolean>;
  settings: { notation: 'suffix' | 'sci'; keepReserve: number; autoSalvage: number; lootPops: boolean };
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
  // Apprentices
  staff: StaffState;
  lastTick: number;
}
