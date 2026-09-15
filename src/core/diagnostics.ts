/**
 * Runtime counters for diagnosing performance complaints in the wild.
 *
 * The game state itself is provably bounded (see the leak probe in the balance-bot notes), so when a
 * browser struggles the useful question is what the *page* is doing: how often it is drawing, whether
 * the DOM is growing, and whether draws are failing. This is read-only bookkeeping, never persisted.
 */
export interface Runtime {
  started: number;
  renders: number;
  renderErrors: number;
  lastError: string | null;
  /** The first failure and where it came from — later ones are usually just the same damage again. */
  firstError: string | null;
  firstErrorStack: string | null;
  /** Draws recovered by rebuilding the tree from scratch. */
  recoveries: number;
  peakNodes: number;
}

export const runtime: Runtime = {
  started: Date.now(),
  renders: 0,
  renderErrors: 0,
  lastError: null,
  firstError: null,
  firstErrorStack: null,
  recoveries: 0,
  peakNodes: 0,
};

/**
 * Whether a render failure looks like the page being edited from outside the app.
 *
 * lit walks its own comment markers; when an extension, a page translation or a reader mode rewrites the
 * DOM those markers go missing and lit reaches for a node that is gone. Nothing inside the game can
 * produce that, so naming it saves the next person guessing at the game's own code.
 */
export function looksExternal(err: string | null): boolean {
  return !!err && /nextSibling|parentNode|insertBefore|removeChild|of null/i.test(err);
}

/** Current DOM size, tracking the high-water mark so a leak shows up as a rising floor. */
export function domNodes(): number {
  const n = document.getElementsByTagName('*').length;
  if (n > runtime.peakNodes) runtime.peakNodes = n;
  return n;
}

/** Heap in MB where the browser exposes it (Chromium only; Firefox and Safari return null). */
export function heapMB(): number | null {
  const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return mem ? Math.round(mem.usedJSHeapSize / 1048576) : null;
}

export function rendersPerSecond(): number {
  const secs = (Date.now() - runtime.started) / 1000;
  return secs > 0 ? runtime.renders / secs : 0;
}
