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
  peakNodes: number;
}

export const runtime: Runtime = {
  started: Date.now(),
  renders: 0,
  renderErrors: 0,
  lastError: null,
  peakNodes: 0,
};

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
