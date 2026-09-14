/**
 * Headless balance bot. Plays the game perfectly and reports pacing, so changes to numbers can be
 * measured instead of guessed at. Real players are roughly 2× slower than this.
 *
 *   npm run bot                       one 6-hour run, stopping at the first ascension
 *   npm run bot -- 12 --runs 5        five 12-hour runs, full length, with a summary
 *   npm run bot -- --single-herb      plant one herb everywhere (never cross-breeds)
 *   npm run bot -- --no-research      never start a study
 *   npm run bot -- --no-hire          never hire apprentices
 *   npm run bot -- --hire-ratio 25    hire only when one costs under 1/25th of the purse
 *   npm run bot -- --starter          only ever use the lowest tier of content it has unlocked
 *   npm run bot -- --json             machine-readable output
 *
 * The two toggles exist to isolate a system's contribution: run with and without it and diff the
 * time-to-ascension. Runs under plain Node via scripts/register-ts.mjs.
 */
import type { GameState, Mods } from '../src/core/types.ts';
import { newState } from '../src/core/state.ts';
import { computeMods } from '../src/core/mods.ts';
import {
  buyUnitPrice, count, hasAll, plantCost, profLevelOf, qualCounts, qualityMixMult,
  researchStatus, simulate, syncSlots, unlockedRecipes, unlockedZones,
} from '../src/core/engine.ts';
import {
  brew, buy, buyUpgrade, buySkill, harvestAll, plant, selectRecipe, sell,
  skillStatus, sowBest, startExpedition, startResearch, toggleRepeat,
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
  /** Minutes until any item reaches proficiency 50, and until any apprentice reaches level 25. */
  minutesToProf50: number | null;
  minutesToApprenticeCap: number | null; // level 25
  /** Save size in KB, and the biggest collections in the state — a leak shows up as these climbing. */
  saveKB: number;
  biggest: [string, number][];
  /** Minutes each completed run took, first ascension onwards (only when the bot is allowed to ascend). */
  runMinutes: number[];
  /** What the player actually had in hand the moment the ascension gate opened. */
  atAscend: { level: number; studies: number; apprentices: number; recipes: number; trade: boolean; guild: boolean; dungeon: boolean; goldPerSec: number } | null;
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

function spendGold(s: GameState, m: Mods, opts: BotOptions): void {
  for (const it of ALL_ITEMS) {
    if (!it.buyLevel || it.buyLevel > s.level) continue;
    if (count(s, it.id) < 40 && s.gold > buyUnitPrice(it.id) * 80) buy(s, it.id, 40);
  }
  for (let g = 0; g < 6; g++) {
    const best = UPGRADES.filter((u) => u.level <= s.level)
      .map((u) => ({ u, cost: upgradeCost(u, s.upgrades[u.id] ?? 0) }))
      .filter((o) => o.cost <= s.gold * 0.5)
      .sort((a, b) => a.cost - b.cost)[0];
    if (!best) break;
    buyUpgrade(s, best.u.id);
  }
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
        .map((n) => ({ n, st: nodeStatus(a, n) }))
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
        for (let g = 0; g < 40; g++) {
          const pick = ASC_NODES
            .map((n) => ({ n, cost: ascCost(n, s.asc.nodes[n.id] ?? 0), owned: s.asc.nodes[n.id] ?? 0 }))
            .filter((x) => (x.n.max === 0 || x.owned < x.n.max) && x.cost <= s.asc.stones)
            .sort((x, y) => x.cost - y.cost)[0];
          if (!pick) break;
          buyAscNode(s, pick.n.id);
        }
      }
    }
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
    atAscend,
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
  research: !flag('no-research'),
  singleHerb: flag('single-herb'),
  hireRatio: flag('no-hire') ? 0 : num('hire-ratio', 1),
  starter: flag('starter'),
};

const results: BotResult[] = [];
for (let i = 0; i < runs; i++) results.push(runBot(opts));

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
  }
  if (asc.length) {
    console.log(`\nascension: mean ${mean(asc).toFixed(1)} min, `
      + `range ${Math.min(...asc).toFixed(1)}–${Math.max(...asc).toFixed(1)} `
      + `(DESIGN.md §3 baseline: ~98 min under this policy)`);
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
