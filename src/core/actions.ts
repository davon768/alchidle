import type { GameState } from './types';
import { computeMods } from './mods';
import { newState } from './state';
import {
  addGold, addItem, buyUnitPrice, count, doSell, generateContract, generateOffers, hasAll, harvestPlot, plantCost,
  removeItem, offerGetQty, gainXp, skillPointsFree, startBrew, toast,
} from './engine';
import { PLANT_MAP } from '../data/plants';
import { RECIPE_MAP } from '../data/recipes';
import { ZONE_MAP } from '../data/zones';
import { item } from '../data/items';
import { UPGRADE_MAP, upgradeCost } from '../data/upgrades';
import { ROW_POINTS, SKILL_MAP, skillRankCost, type SkillNode } from '../data/skills';
import { GUILD_MAP, GUILD_UNLOCK_LEVEL, rankFor, rankName } from '../data/guilds';
import { ASC_MAP, ascCost, stonesFor } from '../data/ascension';

// ── Garden ───────────────────────────────────────────────────
export function plant(s: GameState, idx: number, plantId: string): boolean {
  const m = computeMods(s);
  const p = PLANT_MAP[plantId];
  const plot = s.plots[idx];
  if (!plot || plot.plantId || !p || p.level > s.level) return false;
  const cost = plantCost(s, m, p);
  if (s.gold < cost) {
    toast('Not enough gold to plant.', 'warn');
    return false;
  }
  addGold(s, -cost, false);
  plot.plantId = plantId;
  plot.progress = 0;
  plot.ready = false;
  return true;
}

export function plantAll(s: GameState, plantId: string): void {
  s.plots.forEach((p, i) => { if (!p.plantId) plant(s, i, plantId); });
}

export function harvest(s: GameState, idx: number): void {
  harvestPlot(s, computeMods(s), s.plots[idx]);
}

export function harvestAll(s: GameState): void {
  const m = computeMods(s);
  for (const p of s.plots) harvestPlot(s, m, p);
}

export function clearPlot(s: GameState, idx: number): void {
  const plot = s.plots[idx];
  if (plot) Object.assign(plot, { plantId: null, progress: 0, ready: false });
}

// ── Brewing ──────────────────────────────────────────────────
export function selectRecipe(s: GameState, ci: number, recipeId: string): void {
  const c = s.cauldrons[ci];
  if (c && !c.active && RECIPE_MAP[recipeId]?.level <= s.level) c.recipeId = recipeId;
}

export function brew(s: GameState, ci: number): void {
  const c = s.cauldrons[ci];
  if (c && !c.active && !startBrew(s, c)) toast('Missing ingredients.', 'warn');
}

export function cancelBrew(s: GameState, ci: number): void {
  const c = s.cauldrons[ci];
  if (!c?.active || !c.recipeId) return;
  for (const inp of RECIPE_MAP[c.recipeId].inputs) addItem(s, inp.id, inp.qty);
  c.active = false;
  c.progress = 0;
  c.repeat = false;
}

export function toggleRepeat(s: GameState, ci: number): void {
  const c = s.cauldrons[ci];
  if (!c) return;
  if (ci >= computeMods(s).autoBrew) {
    toast('Assign a Brewer apprentice (👥 Apprentices) to tend this cauldron — trained Brewers tend more cauldrons.', 'warn');
    return;
  }
  c.repeat = !c.repeat;
  if (c.repeat && !c.active) startBrew(s, c);
}

// ── Expeditions ──────────────────────────────────────────────
export function startExpedition(s: GameState, slot: number, zoneId: string): void {
  const z = ZONE_MAP[zoneId];
  if (!z || z.level > s.level || slot >= s.expeditions.length || s.expeditions[slot]) return;
  if (s.expeditions.some((e) => e?.zoneId === zoneId)) {
    toast('A party is already exploring there.', 'warn');
    return;
  }
  s.expeditions[slot] = { zoneId, progress: 0, repeat: slot < computeMods(s).autoScav };
}

export function recall(s: GameState, slot: number): void {
  s.expeditions[slot] = null;
}

export function toggleExpRepeat(s: GameState, slot: number): void {
  const e = s.expeditions[slot];
  if (!e) return;
  if (slot >= computeMods(s).autoScav) {
    toast('Assign a Scout apprentice (👥 Apprentices) to tend this party — trained Scouts tend more parties.', 'warn');
    return;
  }
  e.repeat = !e.repeat;
}

// ── Market ───────────────────────────────────────────────────
export function sell(s: GameState, id: string, qty: number): number {
  return doSell(s, computeMods(s), id, qty);
}

export function sellAllPotions(s: GameState): void {
  const m = computeMods(s);
  let total = 0;
  const belt = new Set(s.belt.filter(Boolean));
  for (const id of Object.keys(s.items)) {
    // Potions on the combat belt are never bulk-sold.
    if (item(id).kind === 'potion' && !belt.has(id)) total += doSell(s, m, id, Math.max(0, count(s, id) - s.settings.keepReserve));
  }
  if (total > 0) toast(`Sold potions for ${Math.round(total).toLocaleString()} gold.`, 'good');
}

export function buy(s: GameState, id: string, qty: number): void {
  const def = item(id);
  if (def.buyLevel === undefined || def.buyLevel > s.level) return;
  const cost = buyUnitPrice(id) * qty;
  if (s.gold < cost) {
    toast('Not enough gold.', 'warn');
    return;
  }
  addGold(s, -cost, false);
  addItem(s, id, qty);
}

export function toggleAutoSell(s: GameState, id: string): void {
  if (!s.autoSell[id]) {
    const cap = Math.floor(computeMods(s).autoSell);
    const used = Object.values(s.autoSell).filter(Boolean).length;
    if (used >= cap) {
      toast(cap > 0 ? `Your Shopkeepers can handle ${cap} potion type${cap > 1 ? 's' : ''} — train them or hire another.` : 'Assign a Shopkeeper apprentice to auto-sell potions.', 'warn');
      return;
    }
  }
  s.autoSell[id] = !s.autoSell[id];
}

// ── Workshop ─────────────────────────────────────────────────
export function buyUpgrade(s: GameState, id: string): void {
  const u = UPGRADE_MAP[id];
  const owned = s.upgrades[id] ?? 0;
  if (!u || (u.max > 0 && owned >= u.max) || u.level > s.level) return;
  const cost = upgradeCost(u, owned);
  if (s.gold < cost) return;
  addGold(s, -cost, false);
  s.upgrades[id] = owned + 1;
}

// ── Skills ───────────────────────────────────────────────────
export function pointsInTree(s: GameState, tree: string): number {
  let total = 0;
  for (const [id, rank] of Object.entries(s.skills)) {
    const node = SKILL_MAP[id];
    if (node?.tree === tree) for (let r = 0; r < rank; r++) total += skillRankCost(node, r);
  }
  return total;
}

export function skillStatus(s: GameState, node: SkillNode): { ok: boolean; reason: string; cost: number } {
  const rank = s.skills[node.id] ?? 0;
  const cost = skillRankCost(node, rank);
  if (node.maxRank > 0 && rank >= node.maxRank) return { ok: false, reason: 'Maxed', cost };
  const needRow = node.row * ROW_POINTS;
  if (pointsInTree(s, node.tree) < needRow) return { ok: false, reason: `Spend ${needRow} points in this tree`, cost };
  for (const r of node.req ?? []) {
    if ((s.skills[r.id] ?? 0) < r.rank) return { ok: false, reason: `Requires ${SKILL_MAP[r.id].name} ${r.rank}`, cost };
  }
  if (skillPointsFree(s, computeMods(s)) < cost) return { ok: false, reason: `Need ${cost} skill point${cost > 1 ? 's' : ''}`, cost };
  return { ok: true, reason: '', cost };
}

export function buySkill(s: GameState, id: string): void {
  const node = SKILL_MAP[id];
  if (node && skillStatus(s, node).ok) s.skills[id] = (s.skills[id] ?? 0) + 1;
}

export function respecCost(s: GameState): number {
  return Math.round(50 * s.level ** 2);
}

export function respec(s: GameState): void {
  const cost = respecCost(s);
  if (s.gold < cost) {
    toast('Not enough gold to reset skills.', 'warn');
    return;
  }
  addGold(s, -cost, false);
  s.skills = {};
  toast('Skill points refunded.', 'info');
}

// ── Trading ──────────────────────────────────────────────────
export function acceptOffer(s: GameState, i: number): void {
  const o = s.trade.offers[i];
  if (!o || o.used) return;
  if (!hasAll(s, o.give)) {
    toast('You can\'t afford that trade.', 'warn');
    return;
  }
  const bonus = computeMods(s).tradeBonus;
  for (const g of o.give) g.id === 'gold' ? addGold(s, -g.qty, false) : removeItem(s, g.id, g.qty);
  for (const g of o.get) g.id === 'gold' ? addGold(s, offerGetQty(g, bonus)) : addItem(s, g.id, offerGetQty(g, bonus));
  o.used = true;
  s.stats.trades++;
  toast(`🐪 Trade complete: ${o.title}`, 'good');
}

export function refreshOffersCost(s: GameState): number {
  return Math.round(20 * s.level ** 1.5);
}

export function refreshOffers(s: GameState): void {
  const cost = refreshOffersCost(s);
  if (s.gold < cost) return;
  addGold(s, -cost, false);
  s.trade.offers = generateOffers(s);
  s.trade.timer = 300;
}

// ── Guilds ───────────────────────────────────────────────────
export function joinGuild(s: GameState, id: string): void {
  if (!GUILD_MAP[id] || s.level < GUILD_UNLOCK_LEVEL || s.guild.id === id) return;
  s.guild = { id, rep: 0, contracts: [] };
  toast(`You joined ${GUILD_MAP[id].name}!`, 'epic');
}

/** Deliver potions to a contract, or claim a finished slay contract (kills are counted automatically in dungeons). */
export function deliver(s: GameState, idx: number): void {
  const c = s.guild.contracts[idx];
  if (!c) return;
  if (c.kind === 'slay') {
    if (c.delivered < c.qty) {
      toast('Keep hunting — the bounty isn\'t finished yet.', 'warn');
      return;
    }
  } else {
    const n = Math.min(count(s, c.recipeId), c.qty - c.delivered);
    if (n <= 0) {
      toast('You have none of that potion to deliver.', 'warn');
      return;
    }
    removeItem(s, c.recipeId, n);
    c.delivered += n;
    if (c.delivered < c.qty) return;
  }

  const m = computeMods(s);
  const before = rankFor(s.guild.rep);
  addGold(s, c.gold * m.contractReward);
  s.guild.rep += c.rep * m.repGain;
  gainXp(s, m, c.kind === 'slay' ? c.rep : RECIPE_MAP[c.recipeId].xp * c.qty * 0.5);
  s.stats.contracts++;
  s.guild.contracts[idx] = generateContract(s);
  toast('📜 Contract fulfilled!', 'good');
  const after = rankFor(s.guild.rep);
  if (after > before) toast(`🛡️ Guild rank up: ${rankName(after)}!`, 'epic');
}

export function rerollCost(s: GameState): number {
  return Math.round(15 * s.level ** 1.5);
}

export function rerollContract(s: GameState, idx: number): void {
  const cost = rerollCost(s);
  if (!s.guild.contracts[idx] || s.gold < cost) return;
  addGold(s, -cost, false);
  s.guild.contracts[idx] = generateContract(s);
}

// ── Ascension ────────────────────────────────────────────────
export function buyAscNode(s: GameState, id: string): void {
  const node = ASC_MAP[id];
  const owned = s.asc.nodes[id] ?? 0;
  if (!node || (node.max > 0 && owned >= node.max)) return;
  const cost = ascCost(node, owned);
  if (s.asc.stones < cost) return;
  s.asc.stones -= cost;
  s.asc.nodes[id] = owned + 1;
}

/** Performs the Magnum Opus. Returns the fresh run state, or null if not yet possible. */
export function ascend(s: GameState): GameState | null {
  const stones = stonesFor(s.stats.runGold, computeMods(s).stoneGain);
  if (stones <= 0) return null;
  const next = newState(s);
  next.asc.stones += stones;
  next.asc.total += stones;
  next.asc.count++;
  return next;
}
