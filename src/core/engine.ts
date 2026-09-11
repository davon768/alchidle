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
import { dungeonUnlocked, tickCombat } from './combat';
import { tickMagic } from './magic';
import { tickEvents } from './events';
import { tickStaff, workXp } from './staff';

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
export function addItem(s: GameState, id: string, qty: number): void {
  s.items[id] = (s.items[id] ?? 0) + qty;
  if (qty > 0 && !quiet) {
    const d = item(id);
    emitGain({ key: id, icon: d.icon, name: d.name, qty });
  }
}
export function removeItem(s: GameState, id: string, qty: number): void {
  s.items[id] = Math.max(0, (s.items[id] ?? 0) - qty);
}
export function hasAll(s: GameState, stacks: ItemStack[], times = 1): boolean {
  return stacks.every((st) => (st.id === 'gold' ? s.gold : count(s, st.id)) >= st.qty * times);
}
export function addGold(s: GameState, amount: number, earned = true): void {
  s.gold += amount;
  if (earned && amount > 0) {
    s.stats.runGold += amount;
    s.stats.totalGold += amount;
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
/** Combat potion strength for a specific potion (global potion power × that potion's proficiency potency). */
export function potionPotency(s: GameState, m: Mods, id: string): number {
  return m.potionPower * (1 + profBonusOf(s, id).potency);
}

// ── Economy ──────────────────────────────────────────────────
export const DEMAND_FLOOR = 0.2;

export function demandOf(s: GameState, id: string): number {
  return s.demand[id] ?? 1;
}
function demandDrop(s: GameState, id: string): number {
  return 0.005 / (1 + profBonusOf(s, id).market);
}
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

/** Total gold for selling `qty` of an item; potion prices slide down as demand drops with each unit. */
export function sellValue(s: GameState, m: Mods, id: string, qty: number): number {
  if (qty <= 0) return 0;
  if (item(id).kind !== 'potion') return ingredientUnitPrice(s, m, id) * qty;
  const base = potionBasePrice(s, m, id);
  const d = demandOf(s, id);
  const step = demandDrop(s, id);
  if (d <= DEMAND_FLOOR) return base * DEMAND_FLOOR * qty;
  const aboveFloor = Math.min(qty, Math.ceil((d - DEMAND_FLOOR) / step));
  const sliding = aboveFloor * (d - (step * (aboveFloor - 1)) / 2);
  return base * (sliding + (qty - aboveFloor) * DEMAND_FLOOR);
}

export function doSell(s: GameState, m: Mods, id: string, qty: number): number {
  qty = Math.min(qty, count(s, id));
  if (qty <= 0) return 0;
  const gold = sellValue(s, m, id, qty);
  removeItem(s, id, qty);
  addGold(s, gold);
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
  return PLANTS.filter((p) => p.level <= s.level);
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
export function growRate(s: GameState, m: Mods, plantId: string): number {
  return m.growSpeed * (1 + profBonusOf(s, plantId).speed);
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
  fit<Plot>(s.plots, Math.floor(m.plots), () => ({ plantId: null, progress: 0, ready: false }));
  fit<Cauldron>(s.cauldrons, Math.floor(m.cauldrons), () => ({ recipeId: null, progress: 0, active: false, repeat: false }));
  fit(s.expeditions, Math.floor(m.expSlots), () => null);
  while (s.belt.length < Math.floor(m.potionSlots)) s.belt.push(null);
}

export function startBrew(s: GameState, c: Cauldron): boolean {
  const r = c.recipeId ? RECIPE_MAP[c.recipeId] : null;
  if (!r || !hasAll(s, r.inputs)) return false;
  for (const inp of r.inputs) removeItem(s, inp.id, inp.qty);
  c.active = true;
  c.progress = 0;
  return true;
}

function completeBrew(s: GameState, m: Mods, r: Recipe): void {
  const b = profBonusOf(s, r.id);
  const out = 1 + b.yield + (Math.random() < Math.min(1, m.doubleBrew + b.double) ? 1 : 0);
  addItem(s, r.id, out);
  s.stats.brewed += out;
  gainXp(s, m, r.xp * out);
  gainProf(s, m, r.id);
  if (Math.random() < Math.min(0.75, m.ingredientSave + b.save)) for (const inp of r.inputs) addItem(s, inp.id, inp.qty);
  if (autoSellActive(s, m, r.id)) {
    const extra = count(s, r.id) - s.settings.keepReserve;
    if (extra > 0) {
      const gold = doSell(s, m, r.id, extra);
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
export function harvestPlot(s: GameState, m: Mods, plot: Plot): void {
  if (!plot.plantId || !plot.ready) return;
  const p = PLANT_MAP[plot.plantId];
  const b = profBonusOf(s, p.id);
  addItem(s, p.herb, rollAmount(p.yield * m.harvestYield) + b.yield + (Math.random() < b.double ? 1 : 0));
  s.stats.harvested++;
  gainXp(s, m, 1 + p.level * 0.2);
  gainProf(s, m, p.id);
  plot.ready = false;
  plot.progress = 0;
  const cost = plantCost(s, m, p);
  if (s.gold >= cost) addGold(s, -cost, false);
  else plot.plantId = null;
}

function completeExpedition(s: GameState, m: Mods, z: ZoneDef): void {
  const mult = z.endless ? riftRewardMult(s.riftDepth) : 1;
  for (const d of z.drops) {
    const chance = Math.min(1, d.chance * (d.rare ? m.rareFind : 1));
    if (Math.random() >= chance) continue;
    const qty = rollAmount(randInt(d.min, d.max) * m.scavYield * mult);
    if (qty <= 0) continue;
    if (d.id === 'gold') addGold(s, qty);
    else addItem(s, d.id, qty);
  }
  gainXp(s, m, z.xp * Math.sqrt(mult));
  s.stats.expeditions++;
  if (z.endless) s.riftDepth++;
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
        harvestPlot(s, m, plot);
        workXp(s, m, 'gardener', i, time / 60);
        continue;
      }
      const p = PLANT_MAP[plot.plantId];
      const rate = growRate(s, m, p.id);
      const need = (p.time - plot.progress) / rate;
      if (t >= need) { t -= need; plot.progress = p.time; plot.ready = true; }
      else { plot.progress += t * rate; t = 0; }
    }
  });

  // Cauldrons tended by a Brewer can repeat.
  s.cauldrons.forEach((c, ci) => {
    let t = dt;
    for (let g = 0; c.active && c.recipeId && t > 0 && g < GUARD; g++) {
      const r = RECIPE_MAP[c.recipeId];
      const rate = brewRate(s, m, r.id);
      const need = (r.time - c.progress) / rate;
      if (t < need) { c.progress += t * rate; t = 0; break; }
      t -= need;
      completeBrew(s, m, r);
      c.active = false;
      c.progress = 0;
      if (ci < m.autoBrew) {
        workXp(s, m, 'brewer', ci, r.time / 40);
        if (c.repeat) startBrew(s, c);
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
    s.demand[id] = d < 1 ? Math.min(1, d + dt * 0.004 * m.demandRecovery) : Math.max(1, d - dt * 0.002);
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

  tickMagic(s, m, dt);
  tickEvents(s, m, dt);
  tickCombat(s, m, dt);
  tickStaff(s, m, dt);
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
