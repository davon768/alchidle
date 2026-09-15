/**
 * A recording of real play, kept so balance can be judged on evidence instead of on the bot's opinion.
 *
 * The balance bot plays perfectly and never gets bored, which makes it a good measure of *reachability*
 * and a poor one of what actually happens: it never leaves a cauldron idle, never forgets a party, never
 * buys the wrong upgrade. This records what a person really did.
 *
 * Two streams, because an idle game's events are not all the same size:
 *
 * - **Minutes.** A snapshot a minute of rates and state — what was earned and from where, what was made,
 *   how much sat idle. Thousands of brews an hour cannot be logged one by one, and nothing is learned
 *   from trying; the rate is the thing that matters.
 * - **Moments.** The discrete decisions and milestones — a purchase, a talent, a level, an ascension, a
 *   relic, a death. These are rare enough to keep whole, and they are what a rate cannot explain.
 *
 * Unlike the fault log this survives a reload, because a balance question spans hours. It lives in its
 * own `localStorage` key rather than in the save: a recording should never be able to damage a game.
 */
import type { GameState } from './types';
import { SOURCES, findStalls, type IncomeSource } from './ledger';
import { computeMods } from './mods';
import { logStalls } from './log';

const KEY = 'alchemy-idle-telemetry';
const MINUTES = 720; // half a day of snapshots
const MOMENTS = 1200;
const BUDGET_BYTES = 300_000;

export type MomentKind =
  | 'level' | 'upgrade' | 'skill' | 'talent' | 'research' | 'ascend'
  | 'relic' | 'hire' | 'death' | 'goal' | 'unlock' | 'note';

interface Minute {
  t: number;
  lvl: number;
  gold: number;
  /** Gold earned in this minute, per source — the only way to see the income mix shift over a session. */
  by: Partial<Record<IncomeSource, number>>;
  brewed: number;
  harvested: number;
  kills: number;
  exped: number;
  delves: number;
  asc: number;
  depth: number;
  /** What was standing idle, from the Ledger's own analysis. A system that stalls for an hour is a bug. */
  idle: string[];
  /** Freezes *in this minute*. */
  freezes: number;
}

interface Moment {
  t: number;
  kind: MomentKind;
  msg: string;
  gold?: number;
}

interface Tape {
  started: number;
  minutes: Minute[];
  moments: Moment[];
}

let tape: Tape = { started: Date.now(), minutes: [], moments: [] };
let loaded = false;
/**
 * Counter values at the last snapshot, so each minute reports its own share rather than a total.
 *
 * Deliberately *not* persisted with the tape. The counters it marks are lifetime totals that live in the
 * save, so restoring it across a reload would work — and would be wrong: the first snapshot after a
 * reload would then bank everything that happened while the game was closed, which is the same lie the
 * `quiet` skip exists to prevent. Losing one minute of rates per reload is the cheaper mistake.
 */
let mark: Record<string, number> = {};
let sinceSave = 0;

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) tape = JSON.parse(raw) as Tape;
  } catch {
    /* a corrupt recording is not worth a crash; start a fresh one */
  }
  tape.minutes ??= [];
  tape.moments ??= [];
  tape.started ??= Date.now();
}

function persist(): void {
  try {
    let text = JSON.stringify(tape);
    // Trim oldest-first until it fits. A recording must never be the thing that fills storage and stops
    // the game from saving.
    while (text.length > BUDGET_BYTES && (tape.minutes.length > 60 || tape.moments.length > 100)) {
      tape.minutes.splice(0, 30);
      tape.moments.splice(0, 50);
      text = JSON.stringify(tape);
    }
    localStorage.setItem(KEY, text);
  } catch {
    /* storage full or blocked: keep recording in memory and stop trying to write */
  }
}

/** Record a decision or a milestone. Rare by nature, so each is kept whole. */
export function moment(kind: MomentKind, msg: string, gold?: number): void {
  load();
  tape.moments.push({ t: Date.now(), kind, msg: String(msg).slice(0, 160), ...(gold === undefined ? {} : { gold: Math.round(gold) }) });
  if (tape.moments.length > MOMENTS) tape.moments.shift();
}

/**
 * Take a snapshot if a minute has passed. Called from the tick, and deliberately skipped during offline
 * catch-up: hours of simulated time arriving in one step would read as one impossibly rich minute and
 * make every rate in the recording a lie.
 */
export function tickTelemetry(s: GameState, dt: number, quiet: boolean): void {
  if (quiet) return;
  load();
  const now = Date.now();
  const last = tape.minutes[tape.minutes.length - 1];
  if (last && now - last.t < 60_000) return;

  const since = (k: string, v: number) => {
    const was = mark[k] ?? v;
    mark[k] = v;
    return Math.max(0, Math.round(v - was));
  };
  // Read the lifetime per-source totals and difference them, rather than the Ledger's rolling window:
  // that window is measured in whole minutes, so asking for "the last minute" exactly as a new minute
  // begins can fall between two buckets and report nothing at all.
  const by: Partial<Record<IncomeSource, number>> = {};
  for (const src of SOURCES) {
    const gained = since(`inc:${src}`, s.income?.[src] ?? 0);
    if (gained > 0) by[src] = gained;
  }

  let idle: string[] = [];
  try {
    idle = findStalls(s, computeMods(s)).slice(0, 3).map((x) => x.title);
  } catch {
    /* the recording must never break the tick */
  }

  tape.minutes.push({
    t: now,
    lvl: s.level,
    gold: Math.round(s.gold),
    by,
    brewed: since('brewed', s.stats.brewed),
    harvested: since('harvested', s.stats.harvested),
    kills: since('kills', s.stats.kills),
    exped: since('exped', s.stats.expeditions),
    delves: since('delves', s.stats.delves),
    asc: s.asc.count,
    depth: s.party?.depth ?? 0,
    idle,
    // A delta like everything else beside it: a running session total in a row of per-minute figures
    // reads as a minute that froze 43 times.
    freezes: since('freezes', logStalls().count),
  });
  if (tape.minutes.length > MINUTES) tape.minutes.shift();

  sinceSave += dt;
  if (sinceSave > 120) {
    sinceSave = 0;
    persist();
  }
}

export function telemetrySize(): { minutes: number; moments: number; hours: number } {
  load();
  const span = tape.minutes.length ? (tape.minutes[tape.minutes.length - 1].t - tape.minutes[0].t) / 3_600_000 : 0;
  return { minutes: tape.minutes.length, moments: tape.moments.length, hours: +span.toFixed(1) };
}

export function clearTelemetry(): void {
  tape = { started: Date.now(), minutes: [], moments: [] };
  mark = {};
  persist();
}

/**
 * The recording, as JSON. Structured rather than prose because the point is to be read against itself —
 * income mix over time, a rate that fell to nothing, a system that never once contributed.
 */
export function buildTape(s: GameState): string {
  load();
  persist();
  const m = tape.minutes;
  const span = m.length ? (m[m.length - 1].t - m[0].t) / 3_600_000 : 0;
  return JSON.stringify({
    game: 'alchemy-idle',
    saveVersion: s.version,
    generated: new Date().toISOString(),
    covering: { hours: +span.toFixed(2), minutes: m.length, moments: tape.moments.length },
    now: {
      level: s.level,
      gold: Math.round(s.gold),
      ascensions: s.asc.count,
      stones: s.asc.stones,
      runMinutes: Math.round(s.stats.runTime / 60),
      partyDepth: s.party?.depth ?? 0,
      lifetime: { brewed: Math.round(s.stats.brewed), harvested: Math.round(s.stats.harvested), kills: s.stats.kills, delves: s.stats.delves },
      apprentices: Object.keys(s.staff.crew).length,
      upgrades: s.upgrades,
      research: Object.keys(s.research.done).length,
    },
    minutes: m,
    moments: tape.moments,
  }, null, 1);
}

export function downloadTape(s: GameState): void {
  const blob = new Blob([buildTape(s)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `alchemy-idle-play-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
