/**
 * Where the gold comes from, and what is holding the workshop up.
 *
 * Sixteen systems feed one purse, and until now nothing said which of them was carrying a run or
 * starving. This tags every coin at the point it arrives and watches for the specific stalls a player
 * cannot see: a cauldron idling for want of one herb, a bed left fallow, a party never sent.
 *
 * The recent window lives in memory rather than the save. It is a diagnostic, not progress — a reload
 * costs you the last hour of chart and nothing else — and keeping an hour of buckets per source out of
 * `localStorage` keeps the save the few kilobytes it is. Lifetime totals *are* saved, in `s.income`.
 */
import type { GameState, Mods } from './types';
import { count, demandOf, skillPointsFree } from './engine';
import { RECIPE_MAP } from '../data/recipes';
import { item } from '../data/items';
import { GEAR_CAP } from '../data/gear';
import { GOALS } from '../data/goals';

export type IncomeSource =
  | 'market' | 'autosell' | 'dungeon' | 'expedition' | 'company' | 'contract' | 'trade' | 'event' | 'salvage' | 'other';

export const SOURCE_INFO: Record<IncomeSource, { label: string; icon: string; tab: string }> = {
  market: { label: 'Market sales', icon: '🏪', tab: 'market' },
  autosell: { label: 'Auto-sold brews', icon: '⚗️', tab: 'brew' },
  dungeon: { label: 'Dungeons', icon: '⚔️', tab: 'dungeon' },
  expedition: { label: 'Expeditions', icon: '🧭', tab: 'explore' },
  company: { label: 'The Company', icon: '🏕️', tab: 'party' },
  contract: { label: 'Guild contracts', icon: '📜', tab: 'guild' },
  trade: { label: 'Trading Post', icon: '🐪', tab: 'trade' },
  event: { label: 'World events', icon: '🎲', tab: 'goals' },
  salvage: { label: 'Salvaged gear', icon: '🗡️', tab: 'armory' },
  other: { label: 'Everything else', icon: '✨', tab: 'journal' },
};

export const SOURCES = Object.keys(SOURCE_INFO) as IncomeSource[];

// ── The recent window ────────────────────────────────────────
const BUCKET_MS = 60_000;
const BUCKETS = 60; // one hour of minute buckets

interface Bucket {
  t: number; // wall-clock minute this bucket started
  by: Partial<Record<IncomeSource, number>>;
  total: number;
}

let buckets: Bucket[] = [];

function currentBucket(now: number): Bucket {
  const minute = Math.floor(now / BUCKET_MS) * BUCKET_MS;
  const last = buckets[buckets.length - 1];
  if (last && last.t === minute) return last;
  const fresh: Bucket = { t: minute, by: {}, total: 0 };
  buckets.push(fresh);
  if (buckets.length > BUCKETS) buckets.shift();
  return fresh;
}

/** Record earned gold. Called from `addGold`, which is the single place gold enters the game. */
export function recordIncome(s: GameState, source: IncomeSource, amount: number): void {
  if (!(amount > 0)) return;
  s.income[source] = (s.income[source] ?? 0) + amount;
  const b = currentBucket(Date.now());
  b.by[source] = (b.by[source] ?? 0) + amount;
  b.total += amount;
}

export interface Recent {
  minutes: number;
  total: number;
  perHour: number;
  by: { source: IncomeSource; gold: number; share: number; perHour: number }[];
  /** Per-minute totals, oldest first — the shape of the last hour. */
  series: number[];
}

/** What has come in over the last `windowMinutes`, by source. */
export function recentIncome(windowMinutes = 60): Recent {
  const cutoff = Date.now() - windowMinutes * BUCKET_MS;
  const live = buckets.filter((b) => b.t >= cutoff);
  const by: Partial<Record<IncomeSource, number>> = {};
  let total = 0;
  for (const b of live) {
    total += b.total;
    for (const src of SOURCES) if (b.by[src]) by[src] = (by[src] ?? 0) + (b.by[src] ?? 0);
  }
  // Count the elapsed span, not the number of buckets: a minute with no income still happened.
  const spanMs = live.length ? Math.max(BUCKET_MS, Date.now() - live[0].t) : BUCKET_MS;
  const minutes = spanMs / BUCKET_MS;
  return {
    minutes,
    total,
    perHour: (total / minutes) * 60,
    by: SOURCES
      .map((source) => ({ source, gold: by[source] ?? 0, share: total > 0 ? (by[source] ?? 0) / total : 0, perHour: ((by[source] ?? 0) / minutes) * 60 }))
      .filter((x) => x.gold > 0)
      .sort((a, b) => b.gold - a.gold),
    series: live.map((b) => b.total),
  };
}

/** Wipe the recent window — used when a run ends, so the chart is about the run you are in. */
export function clearRecent(): void {
  buckets = [];
}

// ── Stalls ───────────────────────────────────────────────────
/**
 * Seconds a repeat cauldron has spent unable to start, keyed by the recipe it was trying to brew.
 * In memory only, and decayed so a fixed problem stops being reported.
 */
interface Starve {
  seconds: number;
  last: number; // when it last failed to start
  /** What it was short of at the time. Checking again later is no good: by then the garden has usually
   *  delivered, and the report turns into a vague "waiting on ingredients". */
  missing: Set<string>;
}

/** How long a stall keeps being reported after it stops happening. */
const STALL_WINDOW_S = 300;

const starved = new Map<string, Starve>();

export function noteStarved(recipeId: string, seconds: number, missing: string[]): void {
  const cur = starved.get(recipeId) ?? { seconds: 0, last: Date.now(), missing: new Set<string>() };
  // Only the recent past counts, so a stall that has been going for an hour does not outrank one
  // happening right now.
  cur.seconds = Math.min(STALL_WINDOW_S, cur.seconds + seconds);
  cur.last = Date.now();
  cur.missing = new Set(missing.length ? missing : [...cur.missing]);
  starved.set(recipeId, cur);
}

/**
 * Recipes whose cauldrons are idling for want of ingredients, worst first.
 *
 * A stall fades once it stops recurring: plant the herb it wanted and it drops off the list within a few
 * minutes rather than accusing you of a problem you already fixed.
 */
export function starvedRecipes(): { id: string; seconds: number; share: number; missing: string[] }[] {
  const now = Date.now();
  const out: { id: string; seconds: number; share: number; missing: string[] }[] = [];
  for (const [id, st] of starved) {
    const idleFor = (now - st.last) / 1000;
    const fade = Math.max(0, 1 - idleFor / STALL_WINDOW_S);
    const seconds = st.seconds * fade;
    if (seconds <= 5) {
      if (fade <= 0) starved.delete(id);
      continue;
    }
    out.push({ id, seconds, share: Math.min(1, seconds / STALL_WINDOW_S), missing: [...st.missing] });
  }
  return out.sort((a, b) => b.seconds - a.seconds);
}

export function clearStalls(): void {
  starved.clear();
}

// ── What is holding you up ───────────────────────────────────
export interface Stall {
  icon: string;
  title: string;
  detail: string;
  tab: string;
  /** Rough cost of ignoring it, used only to order the list. */
  weight: number;
}

/**
 * The specific ways a workshop stalls, in the order they are worth fixing.
 *
 * Every entry names the thing to do, not just the symptom — "three cauldrons are waiting on Frostcap"
 * rather than "brewing is slow". Anything that cannot be acted on does not belong here.
 */
export function findStalls(s: GameState, m: Mods): Stall[] {
  const out: Stall[] = [];

  // Cauldrons that cannot restock. The engine notes these as they happen, so a cauldron that stalled
  // while you were on another tab still reports.
  for (const st of starvedRecipes().slice(0, 3)) {
    const r = RECIPE_MAP[st.id];
    if (!r) continue;
    // Prefer what it was actually short of when it stalled; fall back to what is short right now.
    const missing = (st.missing.length ? st.missing : r.inputs.filter((i) => count(s, i.id) < i.qty).map((i) => i.id)).map((id) => item(id).name);
    out.push({
      icon: '⚗️', tab: 'garden', weight: 100 * st.share,
      title: `${r.icon} ${r.name} is waiting on ${missing.length ? missing.join(' and ') : 'ingredients'}`,
      detail: `A cauldron has been idle ${Math.round(st.share * 100)}% of the time for want of it. Plant more, buy it, or send a party where it drops.`,
    });
  }

  const idleCauldrons = s.cauldrons.filter((c, i) => !c.active && (!c.repeat || i >= m.autoBrew)).length;
  if (idleCauldrons > 0 && m.autoBrew > 0) {
    out.push({
      icon: '🔁', tab: 'brew', weight: 60 * idleCauldrons,
      title: `${idleCauldrons} cauldron${idleCauldrons > 1 ? 's' : ''} not on Repeat`,
      detail: 'A cauldron your Brewer tends can restart itself. Anything past their capacity needs the Brewer trained further.',
    });
  }

  const fallow = s.plots.filter((p) => !p.plantId).length;
  if (fallow > 0) {
    out.push({
      icon: '🟫', tab: 'garden', weight: 40 * fallow,
      title: `${fallow} bed${fallow > 1 ? 's' : ''} lying fallow`,
      detail: 'Empty beds grow nothing. Plant them, or check whether a replant failed because gold ran short.',
    });
  }

  const idleParties = s.expeditions.filter((e) => !e).length;
  if (idleParties > 0) {
    out.push({
      icon: '🧭', tab: 'explore', weight: 50 * idleParties,
      title: `${idleParties} expedition slot${idleParties > 1 ? 's' : ''} empty`,
      detail: 'Parties bring back the materials your cauldrons run on. A Scout keeps them going on Repeat.',
    });
  }

  const free = skillPointsFree(s, m);
  if (free > 0) out.push({ icon: '📜', tab: 'skills', weight: 30 * free, title: `${free} skill point${free > 1 ? 's' : ''} unspent`, detail: 'Points do nothing until they are spent.' });

  const desks = Math.floor(m.researchSlots) - s.research.queue.length;
  if (desks > 0) out.push({ icon: '📚', tab: 'library', weight: 45 * desks, title: `${desks} research desk${desks > 1 ? 's' : ''} empty`, detail: 'Studies run while you are away, including offline. An idle desk is the cheapest thing in the game to fix.' });

  if (m.partySlots >= 1 && !s.party.delve && s.party.roster.some((a) => a.rest <= 0)) {
    out.push({ icon: '🏕️', tab: 'party', weight: 55, title: 'The company is standing around', detail: 'Adventurers are rested and no delve is running. Send them down, or have your Captain repeat it.' });
  }

  if (s.gear.length >= GEAR_CAP) {
    out.push({ icon: '🎒', tab: 'armory', weight: 35, title: 'Your armory is full', detail: `New drops are being salvaged for dust instead of kept. Salvage what you will not wear, or raise the auto-salvage filter.` });
  }

  const crushed = Object.keys(s.demand).filter((id) => RECIPE_MAP[id] && demandOf(s, id) < 0.5 && count(s, id) > 0);
  if (crushed.length) {
    const worst = crushed.sort((a, b) => demandOf(s, a) - demandOf(s, b))[0];
    out.push({
      icon: '📉', tab: 'market', weight: 40, title: `${RECIPE_MAP[worst].icon} ${RECIPE_MAP[worst].name} has flooded its market`,
      detail: `Demand is at ${Math.round(demandOf(s, worst) * 100)}%. Spread sales across more recipes, or brew something dearer — expensive potions saturate far more slowly.`,
    });
  }

  const claimable = GOALS.filter((g) => s.goals[g.id] === 'done').length;
  if (claimable > 0) out.push({ icon: '🎯', tab: 'goals', weight: 25 * claimable, title: `${claimable} goal reward${claimable > 1 ? 's' : ''} unclaimed`, detail: 'Finished goals pay out only when claimed.' });

  return out.sort((a, b) => b.weight - a.weight);
}

/** The single most useful thing to do right now, for the one-line hint. */
export function topStall(s: GameState, m: Mods): Stall | null {
  return findStalls(s, m)[0] ?? null;
}
