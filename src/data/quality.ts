/**
 * Potion quality tiers. Every brewed potion rolls a tier; the tier multiplies its sell value and
 * its combat potency. Quality has to be earned — a brewer with no proficiency, no quality bonuses
 * and no stirring always produces Common.
 *
 * Storage note: `GameState.items[id]` stays the *total* count of a potion, and `GameState.qual[id]`
 * holds the per-tier breakdown. engine.addItem/removeItem keep the two in step, so every system that
 * only cares about totals (demand, contracts, auto-sell, recipe inputs) needed no changes.
 */

export interface QualityTier {
  name: string;
  mark: string; // shown next to the potion icon; Common is unmarked
  color: string;
  value: number; // sell price multiplier
  potency: number; // combat effect multiplier
}

export const QUALITIES: QualityTier[] = [
  { name: 'Common', mark: '', color: '#9aa4b2', value: 1, potency: 1 },
  { name: 'Fine', mark: '✦', color: '#5fd068', value: 1.6, potency: 1.25 },
  { name: 'Masterwork', mark: '✦✦', color: '#4f8dff', value: 2.8, potency: 1.6 },
  { name: 'Legendary', mark: '★', color: '#f5d76e', value: 6, potency: 2.2 },
];

export const QUAL_MAX = QUALITIES.length - 1;

export function quality(tier: number): QualityTier {
  return QUALITIES[Math.max(0, Math.min(QUAL_MAX, Math.floor(tier)))];
}

/** A potion's display name at a tier, e.g. "✦✦ Emberheart Tonic". */
export function qualityName(tier: number, name: string): string {
  const q = quality(tier);
  return q.mark ? `${q.mark} ${name}` : name;
}

// ── Rolling a tier ───────────────────────────────────────────
/**
 * Chance of reaching *at least* each tier, from a quality score `q`.
 * q is the sum of: the brewQuality stat, the potion's proficiency quality bonus,
 * the stir minigame result, and carry-over from high-quality potion ingredients.
 */
export function qualityChances(q: number): { fine: number; master: number; legend: number } {
  const fine = Math.min(0.9, Math.max(0, q) * 0.55);
  const master = fine * Math.min(0.5, Math.max(0, q) * 0.25);
  const legend = master * Math.min(0.3, Math.max(0, q) * 0.12);
  return { fine, master, legend };
}

/** Roll a tier 0–3 from a quality score. */
export function rollQuality(q: number): number {
  const c = qualityChances(q);
  const r = Math.random();
  if (r < c.legend) return 3;
  if (r < c.master) return 2;
  if (r < c.fine) return 1;
  return 0;
}

// ── The stirring minigame ────────────────────────────────────
/** Seconds the stir window stays open after a manual brew starts. */
export const STIR_WINDOW = 3;
/** Full sweeps of the marker across the bar during one window. */
export const STIR_SWEEPS = 2.6;
/** Half-width of the sweet spot, as a fraction of the bar. */
export const STIR_BAND = 0.1;
/** Quality score awarded by a dead-centre stir. */
export const STIR_MAX = 0.7;

/** Marker position 0–1, bouncing left↔right. Derived from the window timer, so it needs no extra state. */
export function stirPos(remaining: number): number {
  const elapsed = Math.max(0, STIR_WINDOW - remaining);
  const phase = ((elapsed / STIR_WINDOW) * STIR_SWEEPS * 2) % 2;
  return phase <= 1 ? phase : 2 - phase;
}

/**
 * Quality score from a stir. Anywhere inside the band pays out; dead centre pays double.
 * A miss costs nothing — stirring is optional, never a penalty.
 */
export function stirBonus(pos: number, target: number): number {
  const d = Math.abs(pos - target);
  if (d > STIR_BAND) return 0;
  return STIR_MAX * (0.45 + 0.55 * (1 - d / STIR_BAND));
}

/** Where the sweet spot sits for a brew. Kept away from the edges so it is always reachable. */
export function rollStirTarget(): number {
  return 0.15 + Math.random() * 0.7;
}
