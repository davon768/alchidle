/**
 * A rolling record of what the game did, so a problem can be reported with evidence rather than a
 * description.
 *
 * The Diagnostics panel already counted failures, but a count cannot say what happened *before* the
 * screen went wrong or the tab locked up — and those are exactly the questions worth asking. This keeps
 * the last few hundred notable moments in memory and writes them out on request.
 *
 * It is memory-only and never saved: it is evidence about a session, not part of the game.
 */
import type { GameState } from './types';
import { domNodes, looksExternal, runtime } from './diagnostics';

export type LogKind = 'error' | 'render' | 'stall' | 'tick' | 'life' | 'note';

interface Entry {
  t: number; // wall clock
  kind: LogKind;
  msg: string;
}

const MAX = 250;
const entries: Entry[] = [];
let stalls = 0;
let worstStall = 0;

/** Note something worth seeing in a report. Long messages are trimmed: a stack is not a novel. */
export function logEvent(kind: LogKind, msg: unknown): void {
  entries.push({ t: Date.now(), kind, msg: String(msg).replace(/\s+/g, ' ').slice(0, 300) });
  if (entries.length > MAX) entries.shift();
}

export const logStalls = (): { count: number; worst: number } => ({ count: stalls, worst: worstStall });

/**
 * Watch the gap between drawn frames. A tab that locks up shows here as a long gap while the page was
 * *visible* — a gap while hidden is just the browser parking a background tab, which is normal and must
 * not be reported as a fault.
 */
const STALL_MS = 1200;
let lastFrame = 0;

export function noteFrame(now: number): void {
  const gap = now - lastFrame;
  lastFrame = now;
  if (!gap || gap < STALL_MS) return;
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  stalls++;
  worstStall = Math.max(worstStall, Math.round(gap));
  logEvent('stall', `the page stopped drawing for ${(gap / 1000).toFixed(1)}s while visible`);
}

/** Catch what the game's own try/catch blocks never see: errors from anywhere else on the page. */
export function installGlobalCapture(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (e) => {
    logEvent('error', `${e.message} @ ${e.filename ?? '?'}:${e.lineno ?? 0}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    logEvent('error', `unhandled promise rejection: ${(e as PromiseRejectionEvent).reason}`);
  });
  document.addEventListener('visibilitychange', () => {
    logEvent('life', `tab ${document.visibilityState}`);
    // A hidden tab stops drawing by design; forget the gap so returning is not logged as a stall.
    if (document.visibilityState === 'visible') lastFrame = 0;
  });
  logEvent('life', 'session started');
}

function line(e: Entry, start: number): string {
  const at = ((e.t - start) / 1000).toFixed(1).padStart(8);
  return `${at}s  ${e.kind.padEnd(6)} ${e.msg}`;
}

/**
 * The report itself: environment, counters, what the game state looks like, then the log.
 *
 * Written for someone reading it cold. The ordering matters — the summary at the top usually answers the
 * question, and the log underneath says how it got there.
 */
export function buildReport(s: GameState): string {
  const start = entries[0]?.t ?? Date.now();
  const nav = typeof navigator !== 'undefined' ? navigator : ({ userAgent: 'unknown', language: '?' } as Navigator);
  const mem = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  const stall = logStalls();
  const counts: [string, number][] = [
    ['items', Object.keys(s.items).length], ['gear', s.gear.length], ['prof', Object.keys(s.prof).length],
    ['strains', Object.keys(s.strains ?? {}).length], ['demand', Object.keys(s.demand).length],
    ['plots', s.plots.length], ['cauldrons', s.cauldrons.length], ['roster', s.party?.roster.length ?? 0],
    ['contracts', s.guild.contracts.length], ['buffs', s.buffs.length], ['combatLog', s.combat.log.length],
  ];
  let save = 0;
  try { save = Math.round(JSON.stringify(s).length / 1024); } catch { save = -1; }

  return [
    'ALCHEMY IDLE — diagnostic report',
    `generated       ${new Date().toISOString()}`,
    `save version    ${s.version}`,
    '',
    '── Environment ──────────────────────────────',
    `user agent      ${nav.userAgent}`,
    `language        ${nav.language}`,
    `viewport        ${typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio ?? 1}x` : '?'}`,
    `heap            ${mem ? `${Math.round(mem.usedJSHeapSize / 1048576)} MB of ${Math.round(mem.jsHeapSizeLimit / 1048576)} MB` : 'not exposed by this browser'}`,
    '',
    '── This session ─────────────────────────────',
    `running for     ${((Date.now() - runtime.started) / 60000).toFixed(1)} min`,
    `draws           ${runtime.renders}`,
    `draw errors     ${runtime.renderErrors}  (${runtime.recoveries} rebuilt)`,
    `freezes         ${stall.count}${stall.count ? `, worst ${(stall.worst / 1000).toFixed(1)}s` : ''}`,
    // Count through domNodes() so the high-water mark is current: it only advances when something asks.
    `DOM elements    ${typeof document !== 'undefined' ? domNodes() : 0} (peak ${runtime.peakNodes})`,
    `save size       ${save} KB`,
    runtime.firstError ? `first error     ${runtime.firstError}` : 'first error     none',
    runtime.firstErrorStack ? `  stack         ${runtime.firstErrorStack}` : '',
    runtime.lastError && runtime.lastError !== runtime.firstError ? `last error      ${runtime.lastError}` : '',
    looksExternal(runtime.firstError)
      ? 'note            this error pattern means something outside the game edited the page — an extension, a page translation or a reader mode'
      : '',
    '',
    '── Game state ───────────────────────────────',
    `level ${s.level} · gold ${Math.round(s.gold)} · ascensions ${s.asc.count} · run time ${(s.stats.runTime / 60).toFixed(0)} min`,
    `collections     ${counts.map(([k, n]) => `${k}=${n}`).join(' ')}`,
    '',
    `── Event log (${entries.length}) ────────────────────────`,
    entries.length ? entries.map((e) => line(e, start)).join('\n') : '  nothing notable happened',
    '',
  ].filter((l) => l !== '').join('\n');
}

/** Hand the report to the player as a file. */
export function downloadReport(s: GameState): void {
  const blob = new Blob([buildReport(s)], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `alchemy-idle-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next turn of the loop: revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
