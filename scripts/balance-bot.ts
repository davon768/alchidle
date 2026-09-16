/**
 * Headless balance bot. Plays the game perfectly and reports pacing, so changes to numbers can be
 * measured instead of guessed at. Real players are roughly 2× slower than this.
 *
 *   npm run bot                       one 6-hour run, stopping at the first ascension
 *   npm run bot -- 12 --runs 5        five 12-hour runs, full length, with a summary
 *   npm run bot -- --single-herb      plant one herb everywhere (never cross-breeds)
 *   npm run bot -- --no-research      never start a study
 *   npm run bot -- --starter          only ever use the lowest tier of content it has unlocked
 *   npm run bot -- --json             machine-readable output
 *   npm run bot -- --dump state.json  write the final state out, for questions a summary cannot answer
 *
 * The toggles exist to isolate a system's contribution: run with and without it and diff the
 * time-to-ascension. Runs under plain Node via scripts/register-ts.mjs.
 *
 * Alongside pacing it reports what the Workshop could actually afford — how deep into the upgrade list
 * it bought, the income at each level, and every upgrade that never came within saving distance in any
 * run. That last one exists because the bot spent a long time reporting the Workshop as fine while two
 * thirds of it was unreachable, and a list nobody can afford should be a finding rather than a silence.
 */
import fs from 'node:fs';
import type { GameState, Mods } from '../src/core/types.ts';
import { newState } from '../src/core/state.ts';
import { computeMods } from '../src/core/mods.ts';
import {
  buyUnitPrice, count, hasAll, plantCost, profLevelOf, qualCounts, qualityMixMult,
  researchStatus, simulate, syncSlots, unlockedRecipes, unlockedZones,
} from '../src/core/engine.ts';
import {
  brew, buy, buyUpgrade, buySkill, harvestAll, plant, selectRecipe, sell,
  skillStatus,
  upgradeOpen, sowBest, startExpedition, startResearch, toggleRepeat,
} from '../src/core/actions.ts';
import { learnNode, nodeStatus, pointsFree } from '../src/core/staff.ts';
import { canDelve, canHire, hireAdventurer, partyReport, setKit, startDelve, suppliable } from '../src/core/party.ts';
import { delveOdds, hireCost } from '../src/data/adventurers.ts';
import { ROLES, apprenticeLevel } from '../src/data/apprentices.ts';
import { PLANTS } from '../src/data/plants.ts';
import { ALL_ITEMS } from '../src/data/items.ts';
import { UPGRADES, upgradeCost } from '../src/data/upgrades.ts';
import { SKILLS } from '../src/data/skills.ts';
import { RESEARCH, researchCost } from '../src/data/research.ts';
import { ASC_NODES, ascCost, ascStatus } from '../src/data/ascension.ts';
import { ascend, buyAscNode } from '../src/core/actions.ts';
import { QUALITIES } from '../src/data/quality.ts';

/** Simulated seconds between decisions. The engine itself is correct for any dt. */
const STEP = 5;

export interface BotOptions {
  hours: number;
  stopAtAscend: boolean;
  research: boolean;
  /** Plant a single herb everywhere instead of alternating — cross-breeding needs unlike neighbours. */
  singleHerb: boolean;
  /**
   * Retained so older invocations keep working; hiring no longer exists, so it does nothing.
   */
  hireRatio: number;
  /**
   * Play like someone who never moves on: brew the cheapest recipe, plant the cheapest herb, send
   * every party to the first zone. Compared against the default (always the best available) this
   * measures whether the game applies any pressure to progress through its own content.
   */
  starter: boolean;
  /** Write the final game state to this path, for questions a summary cannot answer. */
  dump?: string;
  /** Filled in by the run: upgrade ids that were open but never came within saving distance. */
  unreachable?: Set<string>;
  /** One set per completed run, so the report can intersect rather than union them. */
  unreachablePerRun?: Set<string>[];
}

export interface BotResult {
  ascendMinutes: number | null;
  levelMinutes: Record<string, number>;
  level: number;
  runGold: number;
  brewed: number;
  harvested: number;
  /** Potions sold at each quality tier. */
  tiersSold: number[];
  avgSaleQualityMult: number;
  studiesDone: number;
  strainsFound: number;
  seedsHeld: number;
  topProficiencies: [string, number][];
  apprentices: number;
  bestApprenticeLevel: number;
  /** Gold per minute over the stretch leading up to each level — the curve costs must be set against. */
  goldPerMinAtLevel: Record<number, number>;
  endGold: number;
  endGoldPerMin: number;
  /** The whole final state, only when --dump asked for it. */
  finalState: GameState | null;
  /** How many distinct upgrades were bought, and the level of the deepest one — is the tail reachable? */
  upgradesOwned: number;
  deepestUpgrade: { name: string; level: number } | null;
  /** Minutes until any item reaches proficiency 50, and until any apprentice reaches level 25. */
  minutesToProf50: number | null;
  minutesToApprenticeCap: number | null; // level 25
  /** Save size in KB, and the biggest collections in the state — a leak shows up as these climbing. */
  saveKB: number;
  biggest: [string, number][];
  /** Minutes each completed run took, first ascension onwards (only when the bot is allowed to ascend). */
  runMinutes: number[];
  /** What the player actually had in hand the moment the ascension gate opened. */
  atAscend: { level: number; studies: number; apprentices: number; recipes: number; trade: boolean; guild: boolean; dungeon: boolean; goldPerSec: number; act: Record<string, number> } | null;
  /** The adventurer company: how deep it got, how many signed on, and how many relic ranks it holds. */
  partyDepth: number;
  adventurers: number;
  relicRanks: number;
}

const last = <T>(arr: T[], ok: (x: T) => boolean): T | undefined => arr.filter(ok).slice(-1)[0];

/** Keep every plot busy. Alternating two herbs is what makes cross-breeding possible at all. */
function tendGarden(s: GameState, m: Mods, opts: BotOptions): void {
  harvestAll(s);
  const affordable = PLANTS.filter((p) => p.level <= s.level && s.gold > plantCost(s, m, p) * 4);
  if (!affordable.length) return;
  const choices = opts.starter
    ? [affordable[0]]
    : opts.singleHerb ? [affordable[affordable.length - 1]] : affordable.slice(-2);

  // Sow every mutated seed on hand: a strain now stays with the bed, so a seed is a permanent upgrade
  // to one plot rather than a single planting, and holding them back is never right.
  for (const [key, n] of Object.entries(s.seeds)) {
    if (n <= 0) continue;
    for (let i = 0; i < n; i++) if (!sowBest(s, key)) break;
  }
  s.plots.forEach((p, i) => {
    if (p.plantId) return;
    plant(s, i, choices[i % choices.length].id);
  });
}

function tendCauldrons(s: GameState, m: Mods, opts: BotOptions): void {
  s.cauldrons.forEach((c, i) => {
    if (c.active) return;
    const usable = unlockedRecipes(s).filter((rc) => hasAll(s, rc.inputs));
    const r = opts.starter ? usable[0] : usable[usable.length - 1];
    if (!r) return;
    selectRecipe(s, i, r.id);
    brew(s, i); // the bot never stirs: this is the idle baseline
    if (i < m.autoBrew && !c.repeat) toggleRepeat(s, i);
  });
}

/** Sell everything brewed, recording what quality it went out at. */
function sellStock(s: GameState, tiersSold: number[], sold: { w: number; n: number }): void {
  // Whatever the company drinks on its way down is not stock. A player does this with Keep in reserve.
  const reserve = new Map<string, number>();
  for (const id of s.party.kit) if (id) reserve.set(id, s.party.roster.length * 3);
  for (const r of unlockedRecipes(s)) {
    const have = Math.floor(count(s, r.id)) - (reserve.get(r.id) ?? 0);
    if (have <= 0) continue;
    const tiers = qualCounts(s, r.id);
    let left = have;
    for (let t = 0; t < tiers.length && left > 0; t++) {
      const take = Math.min(left, tiers[t]);
      tiersSold[t] += take;
      left -= take;
    }
    sold.w += qualityMixMult(s, r.id, have) * have;
    sold.n += have;
    sell(s, r.id, have);
  }
}

/**
 * How far ahead the bot is willing to save. A player will hold gold for a card worth holding for, but
 * not forever: past this, the upgrade is not a goal, it is scenery.
 */
const SAVE_MINUTES = 45;
/**
 * While saving, still take anything costing under this share of the purse.
 *
 * Measured against the purse rather than against the target's price, which is the version that matters:
 * a cheap compounding upgrade pays for itself many times over before an expensive one is even affordable,
 * and gating incidentals on 2% of a distant target starved exactly those. That cost 55 minutes on the
 * first ascension — the old cheapest-first bot, for all its blindness, was right that twenty levels of
 * fertiliser beat holding gold.
 */
const INCIDENTAL = 0.1;

/**
 * Buy upgrades the way a player does: pick something worth having and save for it.
 *
 * The old rule — always the cheapest affordable, six a pass — was not perfect play but *cheap* play,
 * and it hid most of the Workshop. Re-buying the infinite cheap entries forever, the bot never
 * accumulated enough for anything expensive: it stopped dead at level 22 while playing on to level 60,
 * bought 23 of 66 upgrades, and never once touched the deep half of the list. Because upgrades compound
 * into income, that also quietly depressed every gold figure the bot has ever reported.
 *
 * The horizon is what keeps this honest in both directions. An upgrade the bot could reach by saving
 * for up to `SAVE_MINUTES` of current income is a goal worth banking for; one beyond that is recorded
 * as **unreachable** rather than silently skipped, which is the whole point — an upgrade list nobody can
 * afford should show up as a finding, not as a list that merely never gets bought.
 */
function buyUpgrades(s: GameState, opts: BotOptions): void {
  const perMin = Math.max(1, s.stats.runGold / Math.max(1, s.stats.runTime / 60));
  const horizon = s.gold + perMin * SAVE_MINUTES;

  for (let g = 0; g < 6; g++) {
    const open = UPGRADES.filter((u) => upgradeOpen(s, u))
      .map((u) => ({ u, owned: s.upgrades[u.id] ?? 0, cost: upgradeCost(u, s.upgrades[u.id] ?? 0) }))
      .filter((o) => o.u.max === 0 || o.owned < o.u.max);

    // Anything open but past the horizon is out of reach *at this income*. Early on that is most of the
    // list and means nothing, so an entry is cleared again the moment it comes within reach: what
    // survives to the end is the set that never once came within saving distance, at any income the run
    // ever reached.
    for (const o of open) {
      if (o.cost > horizon) opts.unreachable?.add(o.u.id);
      else opts.unreachable?.delete(o.u.id);
    }

    // The target: something worth saving for. Prefer a card never opened, then the deepest one, since
    // depth is how this list encodes strength.
    const target = open
      .filter((o) => o.cost <= horizon)
      .sort((a, b) => (a.owned === 0 ? 0 : 1) - (b.owned === 0 ? 0 : 1)
        || b.u.level - a.u.level
        || a.cost - b.cost)[0];
    if (!target) break;

    if (target.cost <= s.gold) { buyUpgrade(s, target.u.id); continue; }

    // Saving for it. Take anything trivial enough not to delay it, otherwise bank and stop.
    const incidental = open
      .filter((o) => o.cost <= s.gold * INCIDENTAL)
      .sort((a, b) => (a.owned === 0 ? 0 : 1) - (b.owned === 0 ? 0 : 1) || a.cost - b.cost)[0];
    if (!incidental) break;
    buyUpgrade(s, incidental.u.id);
  }
}

function spendGold(s: GameState, m: Mods, opts: BotOptions): void {
  for (const it of ALL_ITEMS) {
    if (!it.buyLevel || it.buyLevel > s.level) continue;
    if (count(s, it.id) < 40 && s.gold > buyUnitPrice(it.id) * 80) buy(s, it.id, 40);
  }
  buyUpgrades(s, opts);
  for (let g = 0; g < 4; g++) {
    const node = SKILLS.filter((n) => skillStatus(s, n).ok)[0];
    if (!node) break;
    buySkill(s, node.id);
  }
  if (!opts.research) return;
  // Fill every free desk, cheapest study first — studies compete with upgrades for the same gold.
  for (let g = 0; g < 3; g++) {
    const open = RESEARCH.filter((r) => researchStatus(s, m, r.id).ok)
      .map((r) => ({ r, cost: researchCost(r, s.research.done[r.id] ?? 0) }))
      .filter((o) => hasAll(s, o.cost))
      .sort((a, b) => (a.cost[0]?.qty ?? 0) - (b.cost[0]?.qty ?? 0))[0];
    if (!open) break;
    startResearch(s, open.r.id);
  }
}

/**
 * Spend whatever skill points the apprentices have earned. There is nothing to hire any more: each
 * craft's apprentice arrives through the Library, so all the bot decides is where the points go. It
 * buys the cheapest available node in each tree, which favours capacity and keeps it honest about
 * breadth rather than cherry-picking the strongest stat.
 */
function tendStaff(s: GameState, _m: Mods, _opts: BotOptions): void {
  for (const role of ROLES) {
    const a = s.staff.crew[role.id];
    if (!a) continue;
    for (let guard = 0; guard < 12; guard++) {
      if (pointsFree(a) <= 0) break;
      const next = role.tree
        .map((n) => ({ n, st: nodeStatus(a, n, s.asc.count) }))
        .filter((x) => x.st.ok)
        .sort((x, y) => x.st.cost - y.st.cost)[0];
      if (!next) break;
      const before = a.nodes[next.n.id] ?? 0;
      learnNode(s, role.id, next.n.id);
      if ((a.nodes[next.n.id] ?? 0) === before) break;
    }
  }
}

/**
 * Run the adventurer company: hire while gold allows, keep the two strongest combat potions in the kit,
 * and descend whenever the odds are worth the supplies. Failed delves still pay a third of the haul and
 * half the XP, so waiting for certainty is never right — but neither is walking into a 10% chance.
 */
function tendCompany(s: GameState, m: Mods, opts: BotOptions): void {
  if (m.partySlots < 1) return;
  // A balanced company: the front rank first, then damage, then the extras.
  const order = opts.starter ? ['blade'] : ['warden', 'mage', 'ranger', 'cleric', 'blade', 'rogue'];
  // Never spend the last of the purse on a signing fee: upgrades and studies compete for the same gold.
  while (canHire(s, m) && s.gold >= hireCost(s.party.roster.length) * 3) {
    const pick = order[s.party.roster.length % order.length];
    if (!hireAdventurer(s, pick)) break;
  }
  const combat = unlockedRecipes(s).filter((r) => suppliable(r.id));
  for (let i = 0; i < Math.floor(m.kitSlots); i++) {
    const want = combat[combat.length - 1 - i];
    if (want && s.party.kit[i] !== want.id) setKit(s, i, want.id);
  }
  if (!s.party.repeat && m.autoDelve >= 1) s.party.repeat = true;
  if (canDelve(s, m) && delveOdds(partyReport(s, m).power, s.party.depth + 1) >= 0.25) startDelve(s, m);
}


export function runBot(opts: BotOptions): BotResult {
  let s = newState();
  const levelMinutes: Record<string, number> = {};
  const tiersSold = new Array(QUALITIES.length).fill(0);
  const sold = { w: 0, n: 0 };
  let ascendMinutes: number | null = null;
  let minutesToProf50: number | null = null;
  let minutesToApprenticeCap: number | null = null;
  let atAscend: BotResult['atAscend'] = null;
  const runMinutes: number[] = [];
  const goldPerMinAtLevel: Record<number, number> = {};
  let lastSample = { t: 0, gold: 0 };
  let runStart = 0;

  for (let t = 0; t < opts.hours * 3600; t += STEP) {
    const m = computeMods(s);
    syncSlots(s, m);

    tendGarden(s, m, opts);
    tendCauldrons(s, m, opts);
    const zones = unlockedZones(s);
    const zone = opts.starter ? zones[0] : zones[zones.length - 1];
    if (zone) s.expeditions.forEach((e, i) => { if (!e) startExpedition(s, i, zone.id); });
    sellStock(s, tiersSold, sold);
    tendStaff(s, m, opts);
    tendCompany(s, m, opts);
    spendGold(s, m, opts);

    simulate(s, STEP);

    for (const L of [10, 20, 30, 40, 50]) {
      if (levelMinutes[`lvl${L}`] === undefined && s.level >= L) levelMinutes[`lvl${L}`] = +(t / 60).toFixed(1);
    }
    // Income at each level, sampled the first time that level is reached. This is the curve an upgrade's
    // price has to be set against: a card introduced at level L is only content if someone at level L can
    // earn it. Extrapolating a cost curve instead of measuring this is how the top of the Workshop list
    // ended up priced past anything the game produces.
    for (let L = 5; L <= 100; L += 5) {
      if (goldPerMinAtLevel[L] === undefined && s.level >= L) {
        // The *marginal* rate since the last milestone, not the run average. A running average is
        // dragged down by every early minute, which is precisely the wrong error to make when the
        // question is what a player earns once they are deep. Lifetime gold, so an ascension in the
        // middle of the window does not reset it to nothing.
        const mins = (t - lastSample.t) / 60;
        goldPerMinAtLevel[L] = mins > 0 ? Math.round((s.stats.totalGold - lastSample.gold) / mins) : 0;
        lastSample = { t, gold: s.stats.totalGold };
      }
    }
    if (minutesToProf50 === null && Object.keys(s.prof).some((id) => profLevelOf(s, id) >= 50)) {
      minutesToProf50 = +(t / 60).toFixed(1);
    }
    if (minutesToApprenticeCap === null && Object.values(s.staff.crew).some((a) => a && apprenticeLevel(a.xp) >= 25)) {
      minutesToApprenticeCap = +(t / 60).toFixed(1);
    }
    if (ascendMinutes === null && ascStatus(s).ok) {
      ascendMinutes = +(t / 60).toFixed(1);
      atAscend = {
        level: s.level,
        studies: Object.values(s.research.done).reduce((a, b) => a + b, 0),
        apprentices: Object.keys(s.staff.crew).length,
        recipes: unlockedRecipes(s).length,
        trade: s.level >= 6,
        guild: s.level >= 8,
        dungeon: s.level >= 10,
        goldPerSec: +(s.stats.runGold / Math.max(1, t)).toFixed(1),
        // What the run actually *did*, for calibrating a stone formula that is not just gold.
        act: {
          gold: Math.round(s.stats.runGold), brewed: Math.round(s.stats.brewed), harvested: Math.round(s.stats.harvested),
          expeditions: s.stats.expeditions, kills: s.stats.kills, bosses: s.stats.bosses,
          contracts: s.stats.contracts, trades: s.stats.trades, spells: s.stats.spellsCast, delves: s.stats.delves,
          studies: Object.values(s.research.done).reduce((x, y) => x + y, 0),
          bestFloor: Math.max(0, ...Object.values(s.dungeons)), bestQuality: s.stats.bestQuality,
          profTotal: Object.keys(s.prof).length, strains: Object.keys(s.catalogue).length, partyDepth: s.party.depth,
        },
      };
      if (opts.stopAtAscend) break;
    }
    // Perform the Magnum Opus the moment it is available — the cadence a player chasing stones plays at —
    // then spend every stone on the cheapest node going, and start the next run.
    if (!opts.stopAtAscend && ascStatus(s).ok) {
      const next = ascend(s);
      if (next) {
        s = next;
        runMinutes.push(+((t - runStart) / 60).toFixed(1));
        runStart = t;
        // Prefer a perk never bought over another rank of one already owned — the same correction the
        // Workshop needed. It matters more here: the one-off perks are what the Great Work now spares
        // from the reset, so a bot taking the cheapest rank every time would buy none of them and
        // measure a game in which nothing ever carries over.
        for (let g = 0; g < 40; g++) {
          const pick = ASC_NODES
            .map((n) => ({ n, cost: ascCost(n, s.asc.nodes[n.id] ?? 0), owned: s.asc.nodes[n.id] ?? 0 }))
            .filter((x) => (x.n.max === 0 || x.owned < x.n.max) && x.cost <= s.asc.stones)
            .sort((x, y) => (x.owned === 0 ? 0 : 1) - (y.owned === 0 ? 0 : 1) || x.cost - y.cost)[0];
          if (!pick) break;
          buyAscNode(s, pick.n.id);
        }
      }
    }
  }

  // Hand this run's verdict over and start the next one clean. Sharing one set across runs made the
  // report a union: an upgrade bought comfortably in one run still showed as unreachable because a
  // different run never got there.
  if (opts.unreachable) {
    opts.unreachablePerRun?.push(new Set(opts.unreachable));
    opts.unreachable.clear();
  }

  return {
    ascendMinutes,
    levelMinutes,
    level: s.level,
    runGold: Math.round(s.stats.runGold),
    brewed: Math.round(s.stats.brewed),
    harvested: Math.round(s.stats.harvested),
    tiersSold,
    avgSaleQualityMult: sold.n ? +(sold.w / sold.n).toFixed(4) : 1,
    studiesDone: Object.values(s.research.done).reduce((a, b) => a + b, 0),
    strainsFound: Object.keys(s.catalogue).length,
    seedsHeld: Object.values(s.seeds).reduce((a, b) => a + b, 0),
    topProficiencies: Object.keys(s.prof)
      .map((id): [string, number] => [id, profLevelOf(s, id)])
      .filter(([, l]) => l > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6),
    apprentices: Object.keys(s.staff.crew).length,
    bestApprenticeLevel: Math.max(0, ...Object.values(s.staff.crew).map((a) => (a ? apprenticeLevel(a.xp) : 0))),
    // What the purse looks like at the end, which is what says whether the deep upgrades are content
    // or decoration: an entry costing more than the whole late run earns is one nobody will ever buy.
    endGold: Math.round(s.gold),
    endGoldPerMin: Math.round(s.stats.runGold / Math.max(1, s.stats.runTime / 60)),
    upgradesOwned: Object.keys(s.upgrades).filter((id) => (s.upgrades[id] ?? 0) > 0).length,
    deepestUpgrade: UPGRADES.filter((u) => (s.upgrades[u.id] ?? 0) > 0)
      .sort((a, b) => b.level - a.level)
      .map((u) => ({ name: u.name, level: u.level }))[0] ?? null,
    minutesToProf50,
    minutesToApprenticeCap,
    saveKB: Math.round(JSON.stringify(s).length / 1024),
    biggest: ([
      ['items', Object.keys(s.items).length], ['qual', Object.keys(s.qual).length], ['prof', Object.keys(s.prof).length],
      ['demand', Object.keys(s.demand).length], ['gear', s.gear.length], ['seeds', Object.keys(s.seeds).length],
      ['strains', Object.keys(s.strains).length], ['catalogue', Object.keys(s.catalogue).length],
      ['contracts', s.guild.contracts.length], ['offers', s.trade.offers.length], ['buffs', s.buffs.length],
      ['combatLog', s.combat.log.length], ['combatBuffs', s.combat.buffs.length], ['cooldowns', Object.keys(s.combat.cooldowns).length],
      ['roster', s.party.roster.length], ['relics', Object.keys(s.party.relics).length], ['familiars', Object.keys(s.familiars).length],
      ['spells', Object.keys(s.spells).length], ['skills', Object.keys(s.skills).length], ['upgrades', Object.keys(s.upgrades).length],
    ] as [string, number][]).sort((x, y) => y[1] - x[1]).slice(0, 6),
    runMinutes,
    goldPerMinAtLevel,
    atAscend,
    finalState: opts.dump ? s : null,
    partyDepth: s.party.depth,
    adventurers: s.party.roster.length,
    relicRanks: Object.values(s.party.relics).reduce((a, x) => a + x, 0),
  };
}

// ── CLI ──────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const num = (name: string, fallback: number) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? Number(argv[i + 1]) : fallback;
};

const hours = Number(argv.find((a) => !a.startsWith('--') && !Number.isNaN(Number(a)))) || 6;
const runs = num('runs', 1);
const opts: BotOptions = {
  hours,
  stopAtAscend: !flag('full'),
  dump: argv.includes('--dump') ? argv[argv.indexOf('--dump') + 1] : undefined,
  unreachable: new Set<string>(),
  unreachablePerRun: [] as Set<string>[],
  research: !flag('no-research'),
  singleHerb: flag('single-herb'),
  hireRatio: flag('no-hire') ? 0 : num('hire-ratio', 1),
  starter: flag('starter'),
};

const results: BotResult[] = [];
for (let i = 0; i < runs; i++) results.push(runBot(opts));

if (opts.dump && results[0]?.finalState) {
  fs.writeFileSync(opts.dump, JSON.stringify(results[0].finalState, null, 1));
  console.log(`
final state of run 1 written to ${opts.dump}`);
}

if (flag('json')) {
  console.log(JSON.stringify({ opts, results }, null, 2));
} else {
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const asc = results.map((r) => r.ascendMinutes).filter((x): x is number => x !== null);
  console.log(`\nBalance bot — ${runs} run(s) of ${hours}h`
    + `${opts.stopAtAscend ? ', stopping at first ascension' : ''}`
    + `${opts.research ? '' : ', no research'}${opts.singleHerb ? ', single herb' : ''}`
    + `${opts.starter ? ', STARTER CONTENT ONLY' : ''}\n`);
  for (const [i, r] of results.entries()) {
    console.log(`run ${i + 1}: ascend ${r.ascendMinutes ?? '—'} min · level ${r.level}`
      + ` · ${r.brewed} brewed · quality ×${r.avgSaleQualityMult}`
      + ` · ${r.studiesDone} studies · ${r.strainsFound} strains`);
    console.log(`        tiers sold ${r.tiersSold.join('/')} · levels ${JSON.stringify(r.levelMinutes)}`);
    console.log(`        top proficiency ${r.topProficiencies.slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ')}`
      + ` · ${r.apprentices} apprentices (best lv ${r.bestApprenticeLevel})`);
    console.log(`        purse ${r.endGold.toExponential(2)}, earning ${r.endGoldPerMin.toExponential(2)}/min in the current run`);
    console.log(`        upgrades ${r.upgradesOwned}/${UPGRADES.length} bought`
      + (r.deepestUpgrade ? `, deepest ${r.deepestUpgrade.name} (level ${r.deepestUpgrade.level})` : ''));
  }
  const perRun = opts.unreachablePerRun ?? [];
  const neverReachable = perRun.length
    ? [...perRun[0]].filter((id) => perRun.every((set) => set.has(id)))
    : [...(opts.unreachable ?? [])];
  const unreachable = neverReachable
    .map((id) => UPGRADES.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => !!u)
    .sort((x, y) => x.level - y.level);
  if (unreachable.length) {
    console.log(`
⚠ ${unreachable.length} upgrade(s) never came within ${SAVE_MINUTES} minutes of income in any run —`
      + ' open, but priced past anything this economy earns:');
    for (const u of unreachable) {
      console.log(`   level ${String(u.level).padStart(3)}  ${u.name.padEnd(24)} ${u.baseCost.toExponential(1)}`);
    }
  }

  {
    // Averaged across runs, and stated with its spread. One run's figure swings by more than an order of
    // magnitude — a level crossed just after a big sale reads as a fortune — and anchoring a cost curve
    // on a single sample of it produced two answers 27x apart, in opposite directions.
    const lv = [...new Set(results.flatMap((r) => Object.keys(r.goldPerMinAtLevel).map(Number)))].sort((a, b) => a - b);
    const at = (L: number) => results
      .map((r) => r.goldPerMinAtLevel[L])
      .filter((x): x is number => x !== undefined && x > 0);
    if (lv.length) {
      console.log(`\nincome at each level, gold/min (mean of ${results.length} run(s)):`);
      console.log('   ' + lv.map((L) => {
        const xs = at(L);
        return xs.length ? `${L}:${(xs.reduce((a, b) => a + b, 0) / xs.length).toExponential(1)}` : `${L}:-`;
      }).join('  '));
      console.log('   spread ' + lv.map((L) => {
        const xs = at(L);
        return xs.length > 1 ? `${L}:${(Math.max(...xs) / Math.min(...xs)).toFixed(0)}x` : `${L}:-`;
      }).join('  '));
    }
  }

  if (asc.length) {
    console.log(`\nascension: mean ${mean(asc).toFixed(1)} min, `
      + `range ${Math.min(...asc).toFixed(1)}–${Math.max(...asc).toFixed(1)} `
      + `(DESIGN.md §3 baseline: ~104 min, v1.2, this policy)`);
  }
  const got = (pick: (r: BotResult) => number | null) => results.map(pick).filter((x): x is number => x !== null);
  const p50 = got((r) => r.minutesToProf50);
  const cap = got((r) => r.minutesToApprenticeCap);
  if (p50.length) console.log(`proficiency 50: mean ${mean(p50).toFixed(0)} min (${p50.length}/${runs} runs reached it)`);
  if (cap.length) console.log(`apprentice level 25: mean ${mean(cap).toFixed(0)} min (${cap.length}/${runs} runs reached it)`);
  const runs2 = results.map((r) => r.runMinutes).filter((x) => x.length > 1);
  if (runs2.length) {
    const n = Math.max(...runs2.map((x) => x.length));
    const per: string[] = [];
    for (let i = 0; i < Math.min(n, 6); i++) {
      const xs = runs2.map((x) => x[i]).filter((x): x is number => x !== undefined);
      per.push(`run ${i + 1}: ${mean(xs).toFixed(1)}m`);
    }
    console.log(`run lengths — ${per.join(' · ')}`);
  }
  const snaps = results.map((r) => r.atAscend).filter((x): x is NonNullable<BotResult['atAscend']> => !!x);
  if (snaps.length) {
    console.log(`at ascension: level ${mean(snaps.map((x) => x.level)).toFixed(1)}`
      + ` · ${mean(snaps.map((x) => x.studies)).toFixed(1)} studies · ${mean(snaps.map((x) => x.apprentices)).toFixed(1)} apprentices`
      + ` · ${mean(snaps.map((x) => x.recipes)).toFixed(1)} recipes · ${mean(snaps.map((x) => x.goldPerSec)).toFixed(1)} gold/sec`
      + ` · trade ${snaps.filter((x) => x.trade).length}/${snaps.length}, guild ${snaps.filter((x) => x.guild).length}/${snaps.length}, dungeons ${snaps.filter((x) => x.dungeon).length}/${snaps.length}`);
  }
  console.log(`company: mean depth ${mean(results.map((r) => r.partyDepth)).toFixed(1)}`
    + ` · ${mean(results.map((r) => r.adventurers)).toFixed(1)} adventurers · ${mean(results.map((r) => r.relicRanks)).toFixed(1)} relic ranks`);
  console.log(`quality multiplier: mean ×${mean(results.map((r) => r.avgSaleQualityMult)).toFixed(3)}`);
  console.log(`strains found: mean ${mean(results.map((r) => r.strainsFound)).toFixed(1)}`
    + ` · studies: mean ${mean(results.map((r) => r.studiesDone)).toFixed(1)}\n`);
}
