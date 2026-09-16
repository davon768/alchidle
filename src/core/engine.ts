import type { Cauldron, Contract, GameState, ItemStack, Mods, Plot, TradeOffer } from './types';
import { computeMods } from './mods';
import { levelSkillPoints, xpToNext } from './state';
import { ALL_ITEMS, item, type ItemDef } from '../data/items';
import { PLANTS, PLANT_MAP, type PlantDef } from '../data/plants';
import { RECIPES, RECIPE_MAP, type Recipe } from '../data/recipes';
import { ZONES, ZONE_MAP, riftRewardMult, riftTimeMult, type ZoneDef } from '../data/zones';
import { SKILL_MAP, skillRankCost } from '../data/skills';
import { STONE_RESONANCE } from '../data/ascension';
import { ACHIEVEMENTS } from '../data/achievements';
import { CONTRACT_COUNT } from '../data/guilds';
import { DUNGEONS, REWARD_GROWTH } from '../data/combat';
import { MILESTONES, PROF_MAP, emptyBonus, profBonus, profLevel, type ProfBonus } from '../data/proficiency';
import { QUAL_MAX, quality, qualityName, rollQuality, stirElapsed, STIR_MAX, STIR_WINDOW } from '../data/quality';
import { QUALITY_RESEARCH_BOOST, QUALITY_RESEARCH_MAX, RESEARCH_MAP } from '../data/research';
import { CROSS_CHANCE, TRAITS, familiarity, seedKey, traitEffect } from '../data/mutations';
import { FAMILIAR_MAP, familiarLevel, familiarsOfZone, feedXp, milestonesAt } from '../data/familiars';
import { dungeonUnlocked, tickCombat } from './combat';
import { tickMagic } from './magic';
import { tickEvents } from './events';
import { tickStaff, unlockApprentice, workXp } from './staff';
import { noteStarved as recordStarved, recordIncome, type IncomeSource } from './ledger';
import { kitReserve, tickParty } from './party';
import { bestPlant, tickAutomation } from './automation';
import { moment, tickTelemetry } from './telemetry';
import { tickCrossing } from './crossing';

// ── Notifications ────────────────────────────────────────────
export type ToastKind = 'info' | 'good' | 'warn' | 'epic';
type ToastFn = (msg: string, kind: ToastKind) => void;
const toastListeners: ToastFn[] = [];
let quiet = false;

export function onToast(fn: ToastFn): void {
  toastListeners.push(fn);
}
export function toast(msg: string, kind: ToastKind = 'info'): void {
  if (!quiet) for (const fn of toastListeners) fn(msg, kind);
}
/** True while fast-forwarding (offline catch-up) — UI feedback is suppressed and summarized instead. */
export function isQuiet(): boolean {
  return quiet;
}

/** Something landed in the inventory. Drives the item pop-up feed. */
export interface Gain {
  key: string;
  icon: string;
  name: string;
  qty: number;
  color?: string;
}
type GainFn = (g: Gain) => void;
const gainListeners: GainFn[] = [];
export function onGain(fn: GainFn): void {
  gainListeners.push(fn);
}
export function emitGain(g: Gain): void {
  if (!quiet) for (const fn of gainListeners) fn(g);
}

// ── Small helpers ────────────────────────────────────────────
export function randInt(a: number, b: number): number {
  return a + Math.floor(Math.random() * (b - a + 1));
}
/** 2.3 -> 2 or 3 (30% chance of 3). Keeps fractional bonuses meaningful. */
export function rollAmount(x: number): number {
  const f = Math.floor(x);
  return f + (Math.random() < x - f ? 1 : 0);
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function count(s: GameState, id: string): number {
  return s.items[id] ?? 0;
}

// ── Potion quality bookkeeping ───────────────────────────────
// `items[id]` is the total; `qual[id][tier]` is the breakdown. These two must agree, so every write
// goes through addItem/removeItem. Anything that predates quality (old saves, hand-edited state)
// reconciles into Common the first time it is read.
const isPotion = (id: string): boolean => item(id).kind === 'potion';

/** Per-tier counts for a potion, reconciled against the total so drift always lands in Common. */
export function qualCounts(s: GameState, id: string): number[] {
  const tiers = s.qual[id] ?? (s.qual[id] = []);
  for (let t = 0; t <= QUAL_MAX; t++) tiers[t] = tiers[t] ?? 0;
  tiers.length = QUAL_MAX + 1;
  const total = count(s, id);
  const sum = tiers.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - total) > 1e-6) tiers[0] = Math.max(0, tiers[0] + total - sum);
  return tiers;
}

/** Highest tier the player currently holds any of, or 0. */
export function bestTier(s: GameState, id: string): number {
  if (!isPotion(id)) return 0;
  const tiers = qualCounts(s, id);
  for (let t = QUAL_MAX; t > 0; t--) if (tiers[t] >= 1) return t;
  return 0;
}

export function addItem(s: GameState, id: string, qty: number, tier = 0): void {
  // Reconcile the tiers against the *old* total before changing it — qualCounts treats any
  // mismatch as untiered stock and folds it into Common, which would double-count this add.
  if (isPotion(id)) {
    const tiers = qualCounts(s, id);
    const t = Math.max(0, Math.min(QUAL_MAX, Math.floor(tier)));
    tiers[t] = Math.max(0, tiers[t] + qty);
  }
  s.items[id] = (s.items[id] ?? 0) + qty;
  if (qty > 0 && !quiet) {
    const d = item(id);
    const q = quality(tier);
    emitGain({ key: tier > 0 ? `${id}#${tier}` : id, icon: d.icon, name: qualityName(tier, d.name), qty, color: tier > 0 ? q.color : undefined });
  }
}

/**
 * Take `qty` of an item. For potions, `from` picks which end of the quality range is spent:
 * 'low' (selling, crafting, anything routine) preserves your best bottles, 'high' (combat) drinks them.
 * Returns how many of each tier were actually taken.
 */
export function removeItem(s: GameState, id: string, qty: number, from: 'low' | 'high' = 'low'): number[] {
  const taken = new Array(QUAL_MAX + 1).fill(0);
  const have = count(s, id);
  qty = Math.min(qty, have);
  if (qty <= 0) return taken;
  // Spend the tiers first, while `items[id]` still matches them (see addItem).
  if (isPotion(id)) {
    const tiers = qualCounts(s, id);
    let left = qty;
    const order = from === 'low' ? [0, 1, 2, 3] : [3, 2, 1, 0];
    for (const t of order) {
      if (left <= 0) break;
      const take = Math.min(left, tiers[t]);
      tiers[t] -= take;
      taken[t] += take;
      left -= take;
    }
  }
  s.items[id] = have - qty;
  return taken;
}
export function hasAll(s: GameState, stacks: ItemStack[], times = 1): boolean {
  return stacks.every((st) => (st.id === 'gold' ? s.gold : count(s, st.id)) >= st.qty * times);
}
/** Every coin in the game arrives here, which is why attribution is tagged at this one point. */
export function addGold(s: GameState, amount: number, earned = true, source: IncomeSource = 'other'): void {
  s.gold += amount;
  if (earned && amount > 0) {
    s.stats.runGold += amount;
    s.stats.totalGold += amount;
    // Offline catch-up would land hours of earnings in one bucket and drown the chart; the offline
    // summary reports that separately.
    if (!quiet) recordIncome(s, source, amount);
  }
}

// ── Progression ──────────────────────────────────────────────
export function gainXp(s: GameState, m: Mods, amount: number): void {
  s.xp += amount * m.xpGain;
  let need = xpToNext(s.level);
  while (s.xp >= need) {
    s.xp -= need;
    s.level++;
    need = xpToNext(s.level);
    toast(`Level up! You are now level ${s.level}.`, 'epic');
    moment('level', `reached level ${s.level}`);
  }
}

export function skillPointsTotal(s: GameState, m: Mods): number {
  return levelSkillPoints(s.level) + m.skillPoints;
}
export function skillPointsSpent(s: GameState): number {
  let total = 0;
  for (const [id, rank] of Object.entries(s.skills)) {
    const node = SKILL_MAP[id];
    if (!node) continue;
    for (let r = 0; r < rank; r++) total += skillRankCost(node, r);
  }
  return total;
}
export function skillPointsFree(s: GameState, m: Mods): number {
  return skillPointsTotal(s, m) - skillPointsSpent(s);
}

// ── Proficiency (per plant / potion / reagent / forge tier, 1–100, permanent) ──
export function profLevelOf(s: GameState, id: string): number {
  return profLevel(s.prof[id] ?? 0);
}
export function profBonusOf(s: GameState, id: string): ProfBonus {
  const d = PROF_MAP[id];
  return d ? profBonus(d.kind, profLevelOf(s, id)) : emptyBonus();
}
/** Award proficiency for `times` actions; announces every milestone crossed. */
export function gainProf(s: GameState, m: Mods, id: string, times = 1): void {
  const d = PROF_MAP[id];
  if (!d || times <= 0) return;
  const before = profLevelOf(s, id);
  s.prof[id] = (s.prof[id] ?? 0) + d.xp * times * m.masteryRate;
  const after = profLevelOf(s, id);
  if (after === before) return;
  for (const ms of MILESTONES[d.kind]) {
    if (ms.level > before && ms.level <= after) toast(`🎖️ ${d.icon} ${d.name} proficiency ${ms.level}: ${ms.label}!`, 'epic');
  }
}
/** Combat potion strength (global potion power × that potion's proficiency potency × its quality tier). */
export function potionPotency(s: GameState, m: Mods, id: string, tier = 0): number {
  return m.potionPower * (1 + profBonusOf(s, id).potency) * quality(tier).potency;
}

/** The tier actually taken by a removeItem call — the highest one it drew from. */
export function takenTier(taken: number[]): number {
  for (let t = QUAL_MAX; t > 0; t--) if (taken[t] > 0) return t;
  return 0;
}

// ── Economy ──────────────────────────────────────────────────
export const DEMAND_FLOOR = 0.2;

export function demandOf(s: GameState, id: string): number {
  return s.demand[id] ?? 1;
}
/**
 * How far one sale pushes a potion's demand down. Market proficiency softens it.
 *
 * Paired with DEMAND_RECOVER below, this is what stops a single recipe carrying a whole run. The two
 * numbers set an equilibrium: a potion sold steadily at R a second settles at `1 − 0.0025·R / k`, so
 * concentrating on one recipe depresses its price and spreading across several keeps them all healthy.
 *
 * The useful consequence is that a *valuable* recipe barely notices. Reaching 200K gold needs ~13,000
 * Minor Healing Tonics but only ~290 Dreamweaver Philters, so the expensive brew hardly dents its own
 * market. That is the pressure to move up the recipe list, and it falls out of the arithmetic rather
 * than being a rule anyone has to be told.
 */
function demandDrop(s: GameState, id: string): number {
  return 0.0025 / (1 + profBonusOf(s, id).market);
}

/**
 * Demand pulls back toward 100% by this fraction of the remaining gap each second.
 *
 * It used to recover a flat 0.004 a second, which made the whole system inert: a sale cost 0.005 and a
 * second of recovery gave 0.004 back, so anything under ~0.8 sales a second never moved the price at
 * all, and anything above it fell straight to the floor. There was no gradient — 8,940 tonics could be
 * sold with demand never leaving 1.00. Recovering a share of the gap instead gives a real curve, and
 * a time constant of about 7 minutes: a market that has been flooded takes a while to want more.
 */
export const DEMAND_RECOVER = 0.0023;
export function resonanceMult(s: GameState): number {
  return 1 + STONE_RESONANCE * s.asc.total;
}
/** Price of one potion at 100% demand. */
export function potionBasePrice(s: GameState, m: Mods, id: string): number {
  return item(id).value * m.sellPrice * (1 + profBonusOf(s, id).value) * resonanceMult(s);
}
export function ingredientUnitPrice(s: GameState, m: Mods, id: string): number {
  return item(id).value * 0.5 * m.sellPrice * (1 + profBonusOf(s, id).value) * resonanceMult(s);
}
export function buyUnitPrice(id: string): number {
  return item(id).value * 2;
}

/**
 * Average quality multiplier across the `qty` bottles a sale would take (lowest tiers first,
 * matching removeItem). Anything beyond what's in stock is priced as Common.
 */
export function qualityMixMult(s: GameState, id: string, qty: number): number {
  if (qty <= 0 || !isPotion(id)) return 1;
  const tiers = qualCounts(s, id);
  let left = qty;
  let sum = 0;
  for (let t = 0; t <= QUAL_MAX && left > 0; t++) {
    const take = Math.min(left, tiers[t]);
    sum += take * quality(t).value;
    left -= take;
  }
  return (sum + left) / qty;
}

/**
 * Total gold for selling `qty` of an item; potion prices slide down as demand drops with each unit.
 * Pass `tier` to price that quality specifically, rather than the mix a lowest-first sale would take.
 */
export function sellValue(s: GameState, m: Mods, id: string, qty: number, tier?: number): number {
  if (qty <= 0) return 0;
  if (item(id).kind !== 'potion') return ingredientUnitPrice(s, m, id) * qty;
  const mult = tier === undefined ? qualityMixMult(s, id, qty) : quality(tier).value;
  const base = potionBasePrice(s, m, id) * mult;
  const d = demandOf(s, id);
  const step = demandDrop(s, id);
  if (d <= DEMAND_FLOOR) return base * DEMAND_FLOOR * qty;
  const aboveFloor = Math.min(qty, Math.ceil((d - DEMAND_FLOOR) / step));
  const sliding = aboveFloor * (d - (step * (aboveFloor - 1)) / 2);
  return base * (sliding + (qty - aboveFloor) * DEMAND_FLOOR);
}

/** Take exactly `qty` bottles from one quality tier. Returns how many were actually taken. */
export function removeTier(s: GameState, id: string, tier: number, qty: number): number {
  if (!isPotion(id)) return 0;
  const tiers = qualCounts(s, id);
  const t = Math.max(0, Math.min(QUAL_MAX, Math.floor(tier)));
  const take = Math.min(qty, tiers[t]);
  if (take <= 0) return 0;
  tiers[t] -= take;
  s.items[id] = count(s, id) - take;
  return take;
}

export function doSell(s: GameState, m: Mods, id: string, qty: number, tier?: number, source: IncomeSource = 'market'): number {
  qty = Math.min(qty, tier === undefined ? count(s, id) : qualCounts(s, id)[Math.max(0, Math.min(QUAL_MAX, Math.floor(tier)))]);
  if (qty <= 0) return 0;
  const gold = sellValue(s, m, id, qty, tier);
  if (tier === undefined) removeItem(s, id, qty);
  else removeTier(s, id, tier, qty);
  addGold(s, gold, true, source);
  if (item(id).kind === 'potion') {
    s.demand[id] = Math.max(DEMAND_FLOOR, demandOf(s, id) - demandDrop(s, id) * qty);
    s.stats.potionsSold += qty;
  }
  return gold;
}

// ── Unlocks ──────────────────────────────────────────────────
export function unlockedRecipes(s: GameState): Recipe[] {
  return RECIPES.filter((r) => r.level <= s.level);
}
export function unlockedPlants(s: GameState): PlantDef[] {
  // A hybrid is not gated on level alone: it does not exist for you until you have made the cross, which
  // is the whole point of discovering one. See data/hybrids.ts.
  return PLANTS.filter((p) => p.level <= s.level && (!p.hybrid || s.codex?.[p.id]));
}
export function unlockedZones(s: GameState): ZoneDef[] {
  return ZONES.filter((z) => z.level <= s.level);
}
/** Ingredients the player can currently obtain: herbs, expedition materials and dungeon drops. */
export function availableIngredients(s: GameState, levelBonus = 0): ItemDef[] {
  const lvl = s.level + levelBonus;
  const ids = new Set<string>();
  for (const p of PLANTS) if (p.level <= lvl) ids.add(p.herb);
  for (const z of ZONES) if (z.level <= lvl) for (const d of z.drops) if (d.id !== 'gold') ids.add(d.id);
  for (const d of DUNGEONS) if (d.level <= lvl) for (const dr of d.drops) ids.add(dr.id);
  return ALL_ITEMS.filter((i) => ids.has(i.id)).sort((a, b) => a.value - b.value);
}

// ── Timers ───────────────────────────────────────────────────
export function plantCost(s: GameState, m: Mods, p: PlantDef): number {
  return p.cost * (1 - m.seedDiscount) * (1 - profBonusOf(s, p.id).cost);
}
/** How deeply a strain has been bred. Rank 1 is a strain that has only ever been sown once. */
export function strainRank(s: GameState, plantId: string | null, trait: string | null): number {
  if (!plantId || !trait) return 1;
  return Math.max(1, s.strains?.[seedKey(plantId, trait)] ?? 1);
}

export function growRate(s: GameState, m: Mods, plantId: string, trait: string | null = null): number {
  return m.growSpeed * (1 + profBonusOf(s, plantId).speed) * traitEffect(trait, strainRank(s, plantId, trait)).speed;
}
export function brewRate(s: GameState, m: Mods, recipeId: string): number {
  return m.brewSpeed * (1 + profBonusOf(s, recipeId).speed);
}
export function expBaseTime(s: GameState, z: ZoneDef): number {
  return z.endless ? z.time * riftTimeMult(s.riftDepth) : z.time;
}

/** Grow/shrink slot arrays to match current capacity. */
export function syncSlots(s: GameState, m: Mods): void {
  const fit = <T>(arr: T[], n: number, make: () => T) => {
    while (arr.length < n) arr.push(make());
    if (arr.length > n) arr.length = n;
  };
  fit<Plot>(s.plots, Math.floor(m.plots), () => ({ plantId: null, progress: 0, ready: false, trait: null }));
  fit<Cauldron>(s.cauldrons, Math.floor(m.cauldrons), () => ({ recipeId: null, progress: 0, active: false, repeat: false, stirStart: 0, stirClicks: 0, stirQ: 0 }));
  fit(s.expeditions, Math.floor(m.expSlots), () => null);
  while (s.belt.length < Math.floor(m.potionSlots)) s.belt.push(null);
}

/**
 * Consume a recipe's inputs and start the brew.
 * `byHand` opens the stirring window; apprentice-repeated brews skip it and roll quality from skill alone.
 */
export function startBrew(s: GameState, c: Cauldron, byHand = false, m?: Mods): boolean {
  const r = c.recipeId ? RECIPE_MAP[c.recipeId] : null;
  if (!r || !hasAll(s, r.inputs)) return false;
  // Brewing a potion out of better potions carries some of that quality into the result.
  let carry = 0;
  let carried = 0;
  for (const inp of r.inputs) {
    const taken = removeItem(s, inp.id, inp.qty);
    for (let t = 1; t <= QUAL_MAX; t++) {
      carry += taken[t] * t * 0.12;
      carried += taken[t];
    }
  }
  c.active = true;
  c.progress = 0;
  c.stirQ = (carried > 0 ? carry / Math.max(1, carried) : 0) + autoStirQ(m ?? computeMods(s));
  c.stirStart = byHand ? Date.now() : 0;
  c.stirClicks = 0;
  return true;
}

/**
 * What a trained Brewer stirs in by themselves. Hand-stirring still pays more (STIR_MAX for a perfect
 * tap), but an apprentice means quality is no longer locked behind active play.
 */
export function autoStirQ(m: Mods): number {
  return Math.max(0, Math.min(1, m.autoStir)) * STIR_MAX;
}

/** Quality score for a brew about to finish: standing bonuses + proficiency + whatever the cauldron banked. */
export function brewQualityScore(s: GameState, m: Mods, recipeId: string, banked = 0): number {
  return Math.max(0, m.brewQuality + profBonusOf(s, recipeId).quality + banked);
}

function completeBrew(s: GameState, m: Mods, r: Recipe, banked: number): void {
  const b = profBonusOf(s, r.id);
  const out = 1 + b.yield + (Math.random() < Math.min(1, m.doubleBrew + b.double) ? 1 : 0);
  const tier = rollQuality(brewQualityScore(s, m, r.id, banked));
  addItem(s, r.id, out, tier);
  s.stats.brewed += out;
  if (tier > 0) {
    s.stats.bestQuality = Math.max(s.stats.bestQuality ?? 0, tier);
    s.stats.runQuality = Math.max(s.stats.runQuality ?? 0, tier);
    if (tier >= 2) toast(`${r.icon} ${qualityName(tier, r.name)} — a ${quality(tier).name} brew!`, 'epic');
  }
  gainXp(s, m, r.xp * out * (1 + tier * 0.15));
  gainProf(s, m, r.id);
  if (Math.random() < Math.min(0.75, m.ingredientSave + b.save)) for (const inp of r.inputs) addItem(s, inp.id, inp.qty);
  if (autoSellActive(s, m, r.id)) {
    const extra = count(s, r.id) - s.settings.keepReserve - kitReserve(s, m, r.id);
    if (extra > 0) {
      const gold = doSell(s, m, r.id, extra, undefined, 'autosell');
      workXp(s, m, 'shopkeeper', 0, 0.3 + Math.log10(1 + gold) * 0.3);
    }
  }
}

/** Shopkeepers handle a limited number of potion types: the first N you marked for auto-sale. */
export function autoSellActive(s: GameState, m: Mods, id: string): boolean {
  if (!s.autoSell[id]) return false;
  return Object.keys(s.autoSell).filter((k) => s.autoSell[k]).indexOf(id) < Math.floor(m.autoSell);
}

/** Harvest a ripe plot, then replant the same herb if affordable. */
/** A ripe plot beside a different herb can throw a mutated seed. Returns the seed key if one appeared. */
function rollCrossBreed(s: GameState, m: Mods, idx: number): string | null {
  const plot = s.plots[idx];
  if (!plot?.plantId) return null;
  const neighbours = [s.plots[idx - 1], s.plots[idx + 1]];
  if (!neighbours.some((n) => n?.plantId && n.plantId !== plot.plantId)) return null;
  const known = familiarity(s.level, PLANT_MAP[plot.plantId]?.level ?? s.level);
  if (Math.random() >= CROSS_CHANCE * m.mutationChance * known) return null;
  const trait = TRAITS[Math.floor(Math.random() * TRAITS.length)];
  const key = seedKey(plot.plantId, trait.id);
  s.seeds[key] = (s.seeds[key] ?? 0) + 1;
  const fresh = !s.catalogue[key];
  if (fresh) s.catalogue[key] = true;
  const name = `${trait.icon} ${trait.name} ${PLANT_MAP[plot.plantId].name}`;
  toast(fresh ? `🌾 New strain discovered: ${name}! The seed catalogue pays a little more.` : `🌾 A ${name} seed!`, fresh ? 'epic' : 'good');
  return key;
}

/** `idx` is required: cross-breeding inspects the plot's neighbours, and a defaulted index silently disabled it. */
export function harvestPlot(s: GameState, m: Mods, plot: Plot, idx: number): void {
  if (!plot.plantId || !plot.ready) return;
  const p = PLANT_MAP[plot.plantId];
  const b = profBonusOf(s, p.id);
  const tr = traitEffect(plot.trait, strainRank(s, plot.plantId, plot.trait));
  addItem(s, p.herb, rollAmount(p.yield * m.harvestYield) + b.yield + tr.yield + (Math.random() < b.double + tr.double ? 1 : 0));
  s.stats.harvested++;
  gainXp(s, m, 1 + p.level * 0.2);
  gainProf(s, m, p.id);
  rollCrossBreed(s, m, idx);
  plot.ready = false;
  plot.progress = 0;
  // The strain belongs to the bed, not to the planting. It used to be cleared here, which meant that
  // the moment a Gardener took over the plots were never empty, seeds could never be sown, and the
  // tray just filled up: ~50 seeds a day against ~675,000 harvests. A seed is now a permanent upgrade
  // to one bed, kept until you clear it or plant something else there.
  // Crop Rotation: a Gardener with the talent replants the best herb rather than the one that was there.
  // A bed carrying a sown strain is left alone — the strain belongs to that herb, and swapping would
  // quietly destroy seeds the player spent.
  if (m.autoRotate >= 1 && !plot.trait) {
    const better = bestPlant(s, m);
    if (better && better.id !== plot.plantId) plot.plantId = better.id;
  }
  const cost = tr.free ? 0 : plantCost(s, m, p);
  if (s.gold >= cost) addGold(s, -cost, false);
  else plot.plantId = null;
}

function completeExpedition(s: GameState, m: Mods, z: ZoneDef): void {
  const mult = z.endless ? riftRewardMult(s.riftDepth) : 1;
  for (const d of z.drops) {
    const chance = Math.min(1, d.chance * (d.rare ? m.rareFind : 1));
    if (Math.random() >= chance) continue;
    const qty = rollAmount(randInt(d.min, d.max) * m.scavYield * mult * (z.bounty ?? 1));
    if (qty <= 0) continue;
    if (d.id === 'gold') addGold(s, qty, true, 'expedition');
    else addItem(s, d.id, qty);
  }
  gainXp(s, m, z.xp * Math.sqrt(mult));
  s.stats.expeditions++;
  // Something in the ruins was written on. Rare enough to be a find, common enough to keep the garden
  // fed with leads while a player is out exploring.
  if (Math.random() < 0.06) addItem(s, 'journal_page', 1);
  if (z.endless) s.riftDepth++;
  rollFamiliar(s, m, z);
}

/** A zone's familiar can turn up on any completed expedition there — once only; after that it levels. */
function rollFamiliar(s: GameState, m: Mods, z: ZoneDef): void {
  for (const def of familiarsOfZone(z.id)) {
    if (s.familiars[def.id] !== undefined) continue;
    if (Math.random() >= Math.min(0.5, def.chance * m.rareFind)) continue;
    s.familiars[def.id] = 0;
    if (s.equippedFamiliars.length < Math.floor(m.familiarSlots)) s.equippedFamiliars.push(def.id);
    toast(`${def.icon} A ${def.name} has followed you home!`, 'epic');
    return; // at most one per expedition, so a lucky run cannot empty the zone
  }
}

/** Feed a potion to a familiar. Finer bottles are worth more, which is the point. */
export function feedFamiliar(s: GameState, id: string, potionId: string, qty: number): number {
  const def = FAMILIAR_MAP[id];
  if (!def || s.familiars[id] === undefined || !RECIPE_MAP[potionId]) return 0;
  qty = Math.min(qty, Math.floor(count(s, potionId)));
  if (qty <= 0) return 0;
  const taken = removeItem(s, potionId, qty, 'low');
  let xp = 0;
  taken.forEach((n, tier) => { xp += n * feedXp(RECIPE_MAP[potionId].value, quality(tier).value); });
  const before = familiarLevel(s.familiars[id]);
  s.familiars[id] += xp;
  const after = familiarLevel(s.familiars[id]);
  if (after > before) {
    const gained = milestonesAt(after) - milestonesAt(before);
    if (gained > 0) toast(`${def.icon} ${def.name} reached level ${after} — a new bond forms!`, 'epic');
    else toast(`${def.icon} ${def.name} is now level ${after}.`, 'good');
  }
  return xp;
}

// ── Trade & contracts ────────────────────────────────────────
export function generateOffers(s: GameState): TradeOffer[] {
  const offers: TradeOffer[] = [];
  const ings = availableIngredients(s);
  const recipes = unlockedRecipes(s);

  const target = pick(ings.slice(Math.floor(ings.length / 2)));
  const cheaper = ings.filter((i) => i.value < target.value && i.value >= target.value / 60);
  if (cheaper.length) {
    const src = pick(cheaper);
    const getQty = randInt(2, 6);
    offers.push({ title: 'Barter', give: [{ id: src.id, qty: Math.ceil((target.value * getQty * 0.7) / src.value) }], get: [{ id: target.id, qty: getQty }], used: false });
  }

  const r = pick(recipes.slice(-4));
  const qty = randInt(3, 10);
  offers.push({ title: 'Bulk Order', give: [{ id: r.id, qty }], get: [{ id: 'gold', qty: Math.round(r.value * qty * 1.6) }], used: false });

  const exotic = availableIngredients(s, 10).filter((i) => i.kind === 'material' && i.value >= 15);
  if (exotic.length) {
    const ex = pick(exotic.slice(-3));
    const q = randInt(1, 3);
    offers.push({ title: 'Exotic Import', give: [{ id: 'gold', qty: Math.round(ex.value * q * 1.4) }], get: [{ id: ex.id, qty: q }], used: false });
  }

  const herb = pick(ings.filter((i) => i.kind === 'herb'));
  const hq = randInt(20, 60);
  offers.push({ title: 'Herb Buyer', give: [{ id: herb.id, qty: hq }], get: [{ id: 'gold', qty: Math.round(herb.value * hq * 1.2) }], used: false });
  return offers;
}

/** Trade reward after the trade bonus: gold scales smoothly, items round down but never below the base amount. */
export function offerGetQty(g: ItemStack, bonus: number): number {
  return g.id === 'gold' ? Math.round(g.qty * bonus) : Math.max(g.qty, Math.floor(g.qty * bonus));
}

export function generateContract(s: GameState): Contract {
  // Once dungeons open, guilds also post monster bounties in your deepest unlocked dungeon.
  const open = DUNGEONS.filter((d) => dungeonUnlocked(s, d));
  if (open.length && Math.random() < 0.3) {
    const d = open[open.length - 1];
    const qty = randInt(15, 40);
    const scale = REWARD_GROWTH ** Math.max(0, (s.dungeons[d.id] ?? 1) - 1);
    return { kind: 'slay', recipeId: '', dungeonId: d.id, qty, delivered: 0,
      gold: Math.round(d.gold * scale * qty * 4), rep: Math.round(qty * Math.sqrt(d.gold * scale) * 6) };
  }
  // Favor potions the player has actually brewed, so contracts are achievable rather than dead ends.
  const pool = unlockedRecipes(s).slice(-5);
  const brewed = pool.filter((rc) => (s.prof[rc.id] ?? 0) > 0);
  const r = pick(brewed.length && Math.random() < 0.75 ? brewed : pool);
  const qty = Math.max(1, Math.min(50, Math.round(((5 + s.level / 3) * 30) / (r.time + 10))));
  return { kind: 'deliver', recipeId: r.id, qty, delivered: 0, gold: Math.round(r.value * qty * 1.8), rep: Math.round(qty * Math.sqrt(r.value) * 3) };
}

// ── Research Library ─────────────────────────────────────────
/** Studies advance on their own, including while the tab is closed and during offline catch-up. */
export function tickResearch(s: GameState, m: Mods, dt: number): void {
  if (!s.research?.queue.length) return;
  const rate = m.researchSpeed;
  for (let i = s.research.queue.length - 1; i >= 0; i--) {
    const st = s.research.queue[i];
    st.progress += dt * rate;
    if (st.progress < st.time) continue;
    s.research.queue.splice(i, 1);
    s.research.done[st.id] = (s.research.done[st.id] ?? 0) + 1;
    const def = RESEARCH_MAP[st.id];
    if (!def) continue;
    toast(`📚 Research complete: ${def.icon} ${def.name}!`, 'epic');
    moment('research', `finished ${def.name}`);
    // Studies turn up more than their own result: roughly every third one yields a page from somebody
    // else's notebook. This is one of the three ways a cross is ever found.
    if (Math.random() < 0.34) addItem(s, 'journal_page', 1);
    if (def.unlocksRole) unlockApprentice(s, def.unlocksRole);
  }
}

/** Studies already finished (repeatables count their completions). */
/**
 * The share a study's time is cut by, from the quality of the potions its cost would draw.
 *
 * Pure, and it models exactly the order `removeItem` takes — cheapest-first normally, finest-first when
 * the player has turned that on — so the percentage shown in the Library and the one actually applied
 * when the study begins cannot drift apart.
 */
export function studyCut(s: GameState, cost: ItemStack[], fine = s.settings.fineStudies): number {
  let credit = 0;
  let potions = 0;
  for (const c of cost) {
    if (c.id === 'gold' || !isPotion(c.id)) continue;
    const tiers = qualCounts(s, c.id);
    let left = Math.min(c.qty, count(s, c.id));
    for (const t of fine ? [3, 2, 1, 0] : [0, 1, 2, 3]) {
      if (left <= 0) break;
      const take = Math.min(left, tiers[t]);
      credit += take * t;
      potions += take;
      left -= take;
    }
  }
  return potions > 0 ? Math.min(QUALITY_RESEARCH_MAX, (credit / potions) * QUALITY_RESEARCH_BOOST) : 0;
}

export function researchDone(s: GameState, id: string): number {
  return s.research?.done[id] ?? 0;
}
export function researchActive(s: GameState, id: string): boolean {
  return !!s.research?.queue.some((q) => q.id === id);
}
/** Whether a project can be started right now, and why not. */
export function researchStatus(s: GameState, m: Mods, id: string): { ok: boolean; reason: string } {
  const def = RESEARCH_MAP[id];
  if (!def) return { ok: false, reason: 'Unknown study' };
  if (def.level > s.level) return { ok: false, reason: `Unlocks at level ${def.level}` };
  if (researchActive(s, id)) return { ok: false, reason: 'Already being researched' };
  if (!def.repeat && researchDone(s, id)) return { ok: false, reason: 'Already researched' };
  for (const r of def.req ?? []) {
    if (!researchDone(s, r)) return { ok: false, reason: `Needs ${RESEARCH_MAP[r]?.name ?? r}` };
  }
  if ((s.research?.queue.length ?? 0) >= Math.floor(m.researchSlots)) return { ok: false, reason: 'Every desk is busy' };
  return { ok: true, reason: '' };
}

// ── Main tick ────────────────────────────────────────────────
const GUARD = 20000;

export function tick(s: GameState, dt: number): void {
  const m = computeMods(s);
  syncSlots(s, m);
  s.stats.playTime += dt;
  s.stats.runTime += dt;

  // Plots below the Gardeners' tending capacity harvest and replant themselves.
  s.plots.forEach((plot, i) => {
    let t = dt;
    for (let g = 0; plot.plantId && t > 0 && g < GUARD; g++) {
      if (plot.ready) {
        if (i >= m.autoHarvest) break;
        const time = PLANT_MAP[plot.plantId].time;
        harvestPlot(s, m, plot, i);
        workXp(s, m, 'gardener', i, time / 60);
        continue;
      }
      const p = PLANT_MAP[plot.plantId];
      const rate = growRate(s, m, p.id, plot.trait);
      const need = (p.time - plot.progress) / rate;
      if (t >= need) { t -= need; plot.progress = p.time; plot.ready = true; }
      else { plot.progress += t * rate; t = 0; }
    }
  });

  // Cauldrons tended by a Brewer can repeat.
  s.cauldrons.forEach((c, ci) => {
    // The stir window runs on the wall clock, not on dt, so it closes on time regardless of tick size
    // (and is already closed by the time an offline catch-up finishes).
    if (c.stirStart > 0 && stirElapsed(c.stirStart) >= STIR_WINDOW) c.stirStart = 0;
    // Keep trying to restart an idle repeat cauldron. The only restart used to live inside the loop
    // below, which is guarded on `c.active` — so a cauldron that could not restock the moment a brew
    // finished never tried again, and one gap in supply stopped it for good with Repeat still lit.
    if (!c.active && c.repeat && c.recipeId && ci < m.autoBrew && !startBrew(s, c, false, m)) {
      const r = RECIPE_MAP[c.recipeId];
      recordStarved(c.recipeId, dt, r ? r.inputs.filter((i) => count(s, i.id) < i.qty).map((i) => i.id) : []);
    }
    let t = dt;
    for (let g = 0; c.active && c.recipeId && t > 0 && g < GUARD; g++) {
      const r = RECIPE_MAP[c.recipeId];
      const rate = brewRate(s, m, r.id);
      const need = (r.time - c.progress) / rate;
      if (t < need) { c.progress += t * rate; t = 0; break; }
      t -= need;
      completeBrew(s, m, r, c.stirQ);
      c.active = false;
      c.progress = 0;
      c.stirStart = 0;
      c.stirQ = 0;
      if (ci < m.autoBrew) {
        workXp(s, m, 'brewer', ci, r.time / 40);
        if (c.repeat) startBrew(s, c, false, m);
      }
    }
  });

  s.expeditions.forEach((e, i) => {
    let t = dt;
    for (let g = 0; e && t > 0 && g < GUARD; g++) {
      const z = ZONE_MAP[e.zoneId];
      const time = expBaseTime(s, z);
      const need = (time - e.progress) / m.scavSpeed;
      if (t < need) { e.progress += t * m.scavSpeed; t = 0; break; }
      t -= need;
      completeExpedition(s, m, z);
      if (i < m.autoScav) workXp(s, m, 'scout', i, time / 40);
      if (e.repeat && i < m.autoScav) e.progress = 0;
      else { s.expeditions[i] = null; break; }
    }
  });

  // Market demand drifts back toward 100%; a random potion periodically becomes a hot seller.
  for (const id of Object.keys(s.demand)) {
    const d = s.demand[id];
    // Proportional both ways: back up toward 100% after a glut, and back down from a hot-seller spike.
    const rate = (d < 1 ? DEMAND_RECOVER * m.demandRecovery : DEMAND_RECOVER * 0.6) * dt;
    s.demand[id] = d + (1 - d) * Math.min(1, rate);
  }
  s.hotTimer -= dt;
  if (s.hotTimer <= 0) {
    const r = pick(unlockedRecipes(s));
    s.demand[r.id] = 1.75;
    s.hotPotion = r.id;
    s.hotTimer = 180;
    toast(`📣 The town is craving ${r.icon} ${r.name}! Prices are up.`, 'info');
  }

  s.trade.timer -= dt;
  if (s.trade.timer <= 0 || s.trade.offers.length === 0) {
    s.trade.offers = generateOffers(s);
    s.trade.timer = 300;
  }

  if (s.guild.id) while (s.guild.contracts.length < CONTRACT_COUNT) s.guild.contracts.push(generateContract(s));

  tickResearch(s, m, dt);
  tickMagic(s, m, dt);
  tickEvents(s, m, dt);
  tickCombat(s, m, dt);
  tickStaff(s, m, dt);
  tickParty(s, m, dt);
  // Last: apprentices act on the state the rest of the tick just produced.
  tickAutomation(s, m, dt);
  tickCrossing(s, dt, quiet);
  tickTelemetry(s, dt, quiet);
}

export interface OfflineSummary {
  seconds: number;
  gold: number;
  levels: number;
  items: ItemStack[];
  kills: number;
  gear: number;
}

/** Fast-forward `seconds` of game time in coarse steps (used for offline progress and throttled background tabs). */
export function simulate(s: GameState, seconds: number): OfflineSummary {
  const goldBefore = s.gold;
  const levelBefore = s.level;
  const killsBefore = s.stats.kills;
  const gearBefore = s.stats.gearFound;
  const itemsBefore = { ...s.items };
  quiet = true;
  try {
    const steps = Math.min(4000, Math.max(1, Math.ceil(seconds)));
    const dt = seconds / steps;
    for (let i = 0; i < steps; i++) tick(s, dt);
  } finally {
    quiet = false;
  }
  const items: ItemStack[] = [];
  for (const [id, q] of Object.entries(s.items)) {
    const diff = q - (itemsBefore[id] ?? 0);
    if (Math.abs(diff) >= 1) items.push({ id, qty: diff });
  }
  items.sort((a, b) => b.qty * item(b.id).value - a.qty * item(a.id).value);
  return { seconds, gold: s.gold - goldBefore, levels: s.level - levelBefore, items, kills: s.stats.kills - killsBefore, gear: s.stats.gearFound - gearBefore };
}

export function checkAchievements(s: GameState): void {
  for (const a of ACHIEVEMENTS) {
    if (!s.achievements[a.id] && a.check(s)) {
      s.achievements[a.id] = true;
      toast(`🏆 Achievement: ${a.name}`, 'epic');
    }
  }
}
