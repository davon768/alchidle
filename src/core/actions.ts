import type { GameState, RoleId } from './types';
import { learnNode, respecApprentice as respecTree } from './staff';
import { computeMods } from './mods';
import { newState } from './state';
import {
  addGold, addItem, buyUnitPrice, count, doSell, generateContract, generateOffers, hasAll, harvestPlot, plantCost,
  removeItem, offerGetQty, gainXp, feedFamiliar, researchDone, researchStatus, skillPointsFree, startBrew, toast,
} from './engine';
import { STIR_MAX, STIR_WINDOW, quality, stirBonus, stirElapsed, stirPos } from '../data/quality';
import { QUALITY_RESEARCH_BOOST, RESEARCH_MAP, researchCost, researchTime } from '../data/research';

/** How much of a potion's quality value the guild pays on top of a contract. */
const CONTRACT_QUALITY_WEIGHT = 0.5;
import { PLANT_MAP } from '../data/plants';
import { TRAIT_MAP, parseSeed, traitEffect } from '../data/mutations';
import { RECIPE_MAP } from '../data/recipes';
import { ZONE_MAP } from '../data/zones';
import { item } from '../data/items';
import { fmt } from './format';
import { UPGRADE_MAP, upgradeCost } from '../data/upgrades';
import { ROW_POINTS, SKILL_MAP, skillRankCost, type SkillNode } from '../data/skills';
import { GUILD_MAP, GUILD_UNLOCK_LEVEL, rankFor, rankName } from '../data/guilds';
import { ASC_MAP, ascCost, stonesFor } from '../data/ascension';

// ── Research Library ─────────────────────────────────────────
/**
 * Start a study. Costs are paid up front; spending higher-quality potions on it shortens the work,
 * which gives Masterworks a use other than the market.
 */
export function startResearch(s: GameState, id: string): void {
  const m = computeMods(s);
  const def = RESEARCH_MAP[id];
  const status = researchStatus(s, m, id);
  if (!def || !status.ok) {
    if (status.reason) toast(status.reason, 'warn');
    return;
  }
  const done = researchDone(s, id);
  const cost = researchCost(def, done);
  if (!hasAll(s, cost)) {
    toast('You cannot cover the cost of that study.', 'warn');
    return;
  }
  let qualityCredit = 0;
  let potions = 0;
  for (const c of cost) {
    if (c.id === 'gold') { addGold(s, -c.qty, false); continue; }
    const taken = removeItem(s, c.id, c.qty);
    for (let t = 1; t <= 3; t++) { qualityCredit += taken[t] * t; potions += taken[t]; }
    potions += taken[0];
  }
  const cut = potions > 0 ? Math.min(0.35, (qualityCredit / potions) * QUALITY_RESEARCH_BOOST) : 0;
  s.research.queue.push({ id, progress: 0, time: researchTime(def, done) * (1 - cut) });
  toast(cut > 0.01 ? `📚 Study begun — fine reagents cut ${Math.round(cut * 100)}% off the work.` : '📚 Study begun.', 'good');
}

/** Abandon a study. The time is lost; the materials are not refunded. */
export function cancelResearch(s: GameState, idx: number): void {
  if (s.research.queue[idx]) s.research.queue.splice(idx, 1);
}

// ── Apprentices ──────────────────────────────────────────────
export function learnApprenticeNode(s: GameState, role: RoleId, nodeId: string): void {
  learnNode(s, role, nodeId);
}

export function respecApprentice(s: GameState, role: RoleId): void {
  respecTree(s, role);
}

// ── Familiars ────────────────────────────────────────────────
export function equipFamiliar(s: GameState, id: string): void {
  if (s.familiars[id] === undefined || s.equippedFamiliars.includes(id)) return;
  const slots = Math.floor(computeMods(s).familiarSlots);
  if (s.equippedFamiliars.length >= slots) {
    toast(`Only ${slots} familiar${slots === 1 ? '' : 's'} can be out at once — send one home first.`, 'warn');
    return;
  }
  s.equippedFamiliars.push(id);
}

export function unequipFamiliar(s: GameState, id: string): void {
  s.equippedFamiliars = s.equippedFamiliars.filter((x) => x !== id);
}

/** Feed potions to a familiar; returns the XP gained so the caller can report it. */
export function feed(s: GameState, id: string, potionId: string, qty: number): number {
  return feedFamiliar(s, id, potionId, qty);
}

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
  plot.trait = null; // an ordinary sowing never inherits a previous mutation
  plot.progress = 0;
  plot.ready = false;
  return true;
}

/** Sow a mutated seed into an empty plot. The seed is consumed; the trait lasts for this planting. */
export function plantSeed(s: GameState, idx: number, key: string): boolean {
  const plot = s.plots[idx];
  const { plantId, trait } = parseSeed(key);
  const p = PLANT_MAP[plantId];
  if (!plot || plot.plantId || !p || (s.seeds[key] ?? 0) < 1 || !TRAIT_MAP[trait]) return false;
  const cost = traitEffect(trait).free ? 0 : plantCost(s, computeMods(s), p);
  if (s.gold < cost) {
    toast('Not enough gold to sow that seed.', 'warn');
    return false;
  }
  addGold(s, -cost, false);
  s.seeds[key] -= 1;
  if (s.seeds[key] <= 0) delete s.seeds[key];
  plot.plantId = plantId;
  plot.trait = trait;
  plot.progress = 0;
  plot.ready = false;
  return true;
}

export function plantAll(s: GameState, plantId: string): void {
  s.plots.forEach((p, i) => { if (!p.plantId) plant(s, i, plantId); });
}

export function harvest(s: GameState, idx: number): void {
  // The index matters: cross-breeding looks at the plot's neighbours, so harvesting by hand must
  // roll for mutations exactly as an apprentice-tended harvest does.
  harvestPlot(s, computeMods(s), s.plots[idx], idx);
}

export function harvestAll(s: GameState): void {
  const m = computeMods(s);
  s.plots.forEach((p, i) => harvestPlot(s, m, p, i));
}

export function clearPlot(s: GameState, idx: number): void {
  const plot = s.plots[idx];
  if (plot) Object.assign(plot, { plantId: null, progress: 0, ready: false, trait: null });
}

// ── Brewing ──────────────────────────────────────────────────
export function selectRecipe(s: GameState, ci: number, recipeId: string): void {
  const c = s.cauldrons[ci];
  if (c && !c.active && RECIPE_MAP[recipeId]?.level <= s.level) c.recipeId = recipeId;
}

export function brew(s: GameState, ci: number): void {
  const c = s.cauldrons[ci];
  if (c && !c.active && !startBrew(s, c, true)) toast('Missing ingredients.', 'warn');
}

/**
 * Tap the stir bar. Landing in the sweet spot banks a quality bonus for the brew in progress; a miss
 * costs nothing.
 *
 * `pos` is where the marker actually was on screen, measured from the DOM by the caller. The bar is
 * animated by CSS on the document timeline, which is not the same clock as `Date.now()` — it pauses
 * while the tab is hidden — so scoring a position derived from the wall clock could differ from what
 * the player saw. Taking the observed position makes the hit test true by construction. It falls back
 * to the wall clock only when the caller cannot measure (no DOM, tests).
 */
export function stir(s: GameState, ci: number, pos?: number): void {
  const c = s.cauldrons[ci];
  if (!c?.active || c.stirStart <= 0) return;
  const elapsed = stirElapsed(c.stirStart);
  if (elapsed >= STIR_WINDOW) { c.stirStart = 0; return; }
  const at = pos === undefined || !Number.isFinite(pos) ? stirPos(elapsed) : Math.max(0, Math.min(1, pos));
  const bonus = stirBonus(at, c.stirTarget);
  c.stirStart = 0;
  if (bonus <= 0) {
    toast('The brew clouds for a moment — no quality bonus.', 'warn');
    return;
  }
  c.stirQ += bonus;
  toast(bonus >= STIR_MAX * 0.9 ? '🥄 A perfect stir! The mixture gleams.' : '🥄 A good stir.', 'good');
}

export function cancelBrew(s: GameState, ci: number): void {
  const c = s.cauldrons[ci];
  if (!c?.active || !c.recipeId) return;
  for (const inp of RECIPE_MAP[c.recipeId].inputs) addItem(s, inp.id, inp.qty);
  c.active = false;
  c.progress = 0;
  c.repeat = false;
  c.stirStart = 0;
  c.stirQ = 0;
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
/** Sell bottles of one specific quality, rather than letting a lowest-first sale pick for you. */
export function sellTier(s: GameState, id: string, tier: number, qty: number): number {
  return doSell(s, computeMods(s), id, qty, tier);
}

export function sell(s: GameState, id: string, qty: number): number {
  return doSell(s, computeMods(s), id, qty);
}

/**
 * Bulk-sell potions, keeping the reserve.
 *
 * Belt potions used to be excluded outright, which made them look broken: a potion you had fifty of
 * would simply not sell, with nothing said. The reserve already exists to hold stock back, so it is
 * now the single rule — belt potions sell down to it like everything else, and raising the reserve is
 * how you keep more for a fight.
 */
export function sellAllPotions(s: GameState): void {
  const m = computeMods(s);
  const heldInReserve: string[] = [];
  let total = 0;
  let sold = 0;

  for (const id of Object.keys(s.items)) {
    if (item(id).kind !== 'potion') continue;
    const have = Math.floor(count(s, id));
    if (have <= 0) continue;
    const sellable = have - s.settings.keepReserve;
    if (sellable <= 0) {
      heldInReserve.push(item(id).name);
      continue;
    }
    total += doSell(s, m, id, sellable);
    sold += sellable;
  }

  if (total > 0) {
    toast(`Sold ${fmt(sold)} potion${sold === 1 ? '' : 's'} for ${Math.round(total).toLocaleString()} gold`
      + `${s.settings.keepReserve > 0 ? `, keeping ${s.settings.keepReserve} of each` : ''}.`, 'good');
    return;
  }
  if (heldInReserve.length) {
    toast(`Nothing sold — every potion is within your reserve of ${s.settings.keepReserve}. Lower it to sell more.`, 'warn');
    return;
  }
  toast('No potions to sell.', 'warn');
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
/** How many of a market item the purse covers right now. */
export function affordableUnits(s: GameState, id: string): number {
  const unit = buyUnitPrice(id);
  return unit > 0 ? Math.floor(s.gold / unit) : 0;
}

/**
 * Levels of an upgrade the purse covers, walking the cost curve rather than dividing by the current
 * price — each level costs more than the last, so a flat division would overshoot badly.
 */
export function affordableLevels(s: GameState, id: string, cap = 1000): number {
  const u = UPGRADE_MAP[id];
  if (!u || u.level > s.level) return 0;
  const owned = s.upgrades[id] ?? 0;
  let gold = s.gold;
  let n = 0;
  while (n < cap) {
    if (u.max > 0 && owned + n >= u.max) break;
    const cost = upgradeCost(u, owned + n);
    if (cost > gold) break;
    gold -= cost;
    n++;
  }
  return n;
}

/** Buy as many levels of an upgrade as the purse allows. Returns how many were bought. */
export function buyUpgradeMax(s: GameState, id: string, cap = 1000): number {
  let bought = 0;
  for (let i = 0; i < cap; i++) {
    const before = s.upgrades[id] ?? 0;
    if (affordableLevels(s, id, 1) < 1) break;
    buyUpgrade(s, id);
    if ((s.upgrades[id] ?? 0) === before) break; // refused: stop rather than spin
    bought++;
  }
  return bought;
}

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
    // Hand over the plainest bottles first, so a contract never silently eats a Legendary you were
    // saving. A genuinely high-quality stock still pays: the guild credits what it receives.
    const taken = removeItem(s, c.recipeId, n);
    c.qual = (c.qual ?? 0) + taken.reduce((a, cnt, t) => a + cnt * (quality(t).value - 1) * CONTRACT_QUALITY_WEIGHT, 0);
    c.delivered += n;
    if (c.delivered < c.qty) return;
  }

  const m = computeMods(s);
  const before = rankFor(s.guild.rep);
  const qMult = 1 + (c.qual ?? 0) / Math.max(1, c.qty);
  addGold(s, c.gold * m.contractReward * qMult);
  s.guild.rep += c.rep * m.repGain * qMult;
  gainXp(s, m, c.kind === 'slay' ? c.rep : RECIPE_MAP[c.recipeId].xp * c.qty * 0.5);
  s.stats.contracts++;
  s.guild.contracts[idx] = generateContract(s);
  toast(qMult > 1.01 ? `📜 Contract fulfilled — the guild paid ${Math.round((qMult - 1) * 100)}% extra for the quality!` : '📜 Contract fulfilled!', 'good');
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
