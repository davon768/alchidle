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
/**
 * Stirring is a mash: when you start a brew by hand the window opens, and every tap on the spoon works
 * more quality into the pot until the pot cannot take any more.
 *
 * It replaced a timing game — a marker sweeping a bar, click inside the band — which asked for one
 * precise input and gave nothing for effort. A mash is honest about what it wants, reads the same on a
 * phone as on a desk, and never leaves a player who tried with nothing to show for it.
 */
/** Seconds the stir window stays open after a manual brew starts. */
export const STIR_WINDOW = 4;
/** Quality score a fully stirred pot is worth. */
export const STIR_MAX = 0.7;
/** Stirs that fill the pot completely. Reaching it wants roughly four or five taps a second. */
export const STIR_CLICKS = 18;

/**
 * Quality from a number of stirs. Flat per tap so the bar moves visibly with every one, and capped so
 * hammering past the point of a well-mixed pot does nothing — the reward is speed, not endurance.
 */
export function stirBonus(clicks: number): number {
  return STIR_MAX * Math.min(1, Math.max(0, clicks) / STIR_CLICKS);
}

/** Quality one more tap would add right now — what the button can promise before it is pressed. */
export function stirStep(clicks: number): number {
  return stirBonus(clicks + 1) - stirBonus(clicks);
}

/** Seconds a stir window has been open, from the wall-clock stamp taken when the brew started. */
export function stirElapsed(stirStart: number, now = Date.now()): number {
  return (now - stirStart) / 1000;
}
