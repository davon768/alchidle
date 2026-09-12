/**
 * Headless balance bot. Plays the game perfectly and reports pacing, so changes to numbers can be
 * measured instead of guessed at. Real players are roughly 2× slower than this.
 *
 *   npm run bot                       one 6-hour run, stopping at the first ascension
 *   npm run bot -- 12 --runs 5        five 12-hour runs, full length, with a summary
 *   npm run bot -- --single-herb      plant one herb everywhere (never cross-breeds)
 *   npm run bot -- --no-research      never start a study
 *   npm run bot -- --json             machine-readable output
 *
 * The two toggles exist to isolate a system's contribution: run with and without it and diff the
 * time-to-ascension. Runs under plain Node via scripts/register-ts.mjs.
 */
import type { GameState, Mods, RoleId } from '../src/core/types.ts';
import { newState } from '../src/core/state.ts';
import { computeMods } from '../src/core/mods.ts';
import {
  buyUnitPrice, count, hasAll, plantCost, profLevelOf, qualCounts, qualityMixMult,
  researchStatus, simulate, syncSlots, unlockedRecipes, unlockedZones,
} from '../src/core/engine.ts';
import {
  brew, buy, buyUpgrade, buySkill, harvestAll, plant, plantSeed, selectRecipe, sell,
  skillStatus, startExpedition, startResearch, toggleRepeat,
} from '../src/core/actions.ts';
import { assignRole, hire, hireCost } from '../src/core/staff.ts';
import { PLANTS } from '../src/data/plants.ts';
import { ALL_ITEMS } from '../src/data/items.ts';
import { UPGRADES, upgradeCost } from '../src/data/upgrades.ts';
import { SKILLS } from '../src/data/skills.ts';
import { RESEARCH, researchCost } from '../src/data/research.ts';
import { ASC_MIN_GOLD } from '../src/data/ascension.ts';
import { QUALITIES } from '../src/data/quality.ts';

/** Simulated seconds between decisions. The engine itself is correct for any dt. */
const STEP = 5;
const ROLES: RoleId[] = ['brewer', 'gardener', 'scout', 'shopkeeper'];

export interface BotOptions {
  hours: number;
  stopAtAscend: boolean;
  research: boolean;
  /** Plant a single herb everywhere instead of alternating — cross-breeding needs unlike neighbours. */
  singleHerb: boolean;
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
}

const last = <T>(arr: T[], ok: (x: T) => boolean): T | undefined => arr.filter(ok).slice(-1)[0];

/** Keep every plot busy. Alternating two herbs is what makes cross-breeding possible at all. */
function tendGarden(s: GameState, m: Mods, opts: BotOptions): void {
  harvestAll(s);
  const affordable = PLANTS.filter((p) => p.level <= s.level && s.gold > plantCost(s, m, p) * 4);
  if (!affordable.length) return;
  const choices = opts.singleHerb ? [affordable[affordable.length - 1]] : affordable.slice(-2);

  // Sow any mutated seeds first — they are strictly better than a plain sowing.
  for (const [key, n] of Object.entries(s.seeds)) {
    if (n <= 0) continue;
    const idx = s.plots.findIndex((p) => !p.plantId);
    if (idx < 0) break;
    plantSeed(s, idx, key);
  }
  s.plots.forEach((p, i) => {
    if (p.plantId) return;
    plant(s, i, choices[i % choices.length].id);
  });
}

function tendCauldrons(s: GameState, m: Mods): void {
  s.cauldrons.forEach((c, i) => {
    if (c.active) return;
    const r = last(unlockedRecipes(s), (rc) => hasAll(s, rc.inputs));
    if (!r) return;
    selectRecipe(s, i, r.id);
    brew(s, i); // the bot never stirs: this is the idle baseline
    if (i < m.autoBrew && !c.repeat) toggleRepeat(s, i);
  });
}

/** Sell everything brewed, recording what quality it went out at. */
function sellStock(s: GameState, tiersSold: number[], sold: { w: number; n: number }): void {
  for (const r of unlockedRecipes(s)) {
    const have = Math.floor(count(s, r.id));
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
 * Hire whenever a slot is free and the purse covers it. This runs *before* discretionary spending:
 * apprentices are the only source of automation, so a player who lets upgrades eat the gold first
 * never automates at all — which is exactly what this bot did until the ordering was fixed.
 */
function tendStaff(s: GameState, m: Mods): void {
  const slots = Math.floor(m.apprenticeSlots);
  for (let guard = 0; guard < 4; guard++) {
    if (s.staff.hired.length >= slots) break;
    const i = s.staff.candidates.findIndex((a) => hireCost(s, a) * 1.2 <= s.gold);
    if (i < 0) break;
    const before = s.staff.hired.length;
    hire(s, i);
    if (s.staff.hired.length === before) break;
  }
  s.staff.hired.forEach((a, i) => {
    if (!a.role) assignRole(s, a.id, ROLES[i % ROLES.length]);
  });
}

export function runBot(opts: BotOptions): BotResult {
  const s = newState();
  const levelMinutes: Record<string, number> = {};
  const tiersSold = new Array(QUALITIES.length).fill(0);
  const sold = { w: 0, n: 0 };
  let ascendMinutes: number | null = null;

  for (let t = 0; t < opts.hours * 3600; t += STEP) {
    const m = computeMods(s);
    syncSlots(s, m);

    tendGarden(s, m, opts);
    tendCauldrons(s, m);
    const zone = last(unlockedZones(s), () => true);
    if (zone) s.expeditions.forEach((e, i) => { if (!e) startExpedition(s, i, zone.id); });
    sellStock(s, tiersSold, sold);
    tendStaff(s, m);       // automation first — it compounds, upgrades do not
    spendGold(s, m, opts);

    simulate(s, STEP);

    for (const L of [10, 20, 30, 40, 50]) {
      if (levelMinutes[`lvl${L}`] === undefined && s.level >= L) levelMinutes[`lvl${L}`] = +(t / 60).toFixed(1);
    }
    if (ascendMinutes === null && s.stats.runGold >= ASC_MIN_GOLD) {
      ascendMinutes = +(t / 60).toFixed(1);
      if (opts.stopAtAscend) break;
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
    apprentices: s.staff.hired.length,
    bestApprenticeLevel: Math.max(0, ...s.staff.hired.map((a) => a.level)),
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
    + `${opts.research ? '' : ', no research'}${opts.singleHerb ? ', single herb' : ''}\n`);
  for (const [i, r] of results.entries()) {
    console.log(`run ${i + 1}: ascend ${r.ascendMinutes ?? '—'} min · level ${r.level}`
      + ` · ${r.brewed} brewed · quality ×${r.avgSaleQualityMult}`
      + ` · ${r.studiesDone} studies · ${r.strainsFound} strains`);
    console.log(`        tiers sold ${r.tiersSold.join('/')} · levels ${JSON.stringify(r.levelMinutes)}`);
    console.log(`        top proficiency ${r.topProficiencies.slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ')}`
      + ` · ${r.apprentices} apprentices (best lv ${r.bestApprenticeLevel})`);
  }
  if (asc.length) {
    console.log(`\nascension: mean ${mean(asc).toFixed(1)} min (target ≈ 70), `
      + `range ${Math.min(...asc).toFixed(1)}–${Math.max(...asc).toFixed(1)}`);
  }
  console.log(`quality multiplier: mean ×${mean(results.map((r) => r.avgSaleQualityMult)).toFixed(3)}`);
  console.log(`strains found: mean ${mean(results.map((r) => r.strainsFound)).toFixed(1)}`
    + ` · studies: mean ${mean(results.map((r) => r.studiesDone)).toFixed(1)}\n`);
}
