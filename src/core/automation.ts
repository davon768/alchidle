/**
 * What your apprentices decide for you.
 *
 * The `auto*` capacities elsewhere are repetition — tending more of a thing you already set up. This is
 * the other half: judgement. A Gardener choosing what to plant, a Brewer choosing what to brew, a Scout
 * choosing where to go. Every talent here is gated behind ascensions in `data/apprentices.ts`, because
 * handing all of it over on a first run would leave nothing to play.
 *
 * Two rules hold the whole file together:
 *
 * - **Nothing here does what the player forbade.** Reserves, auto-salvage filters and the potion belt are
 *   read, never overridden. An apprentice fills gaps; it does not undo choices.
 * - **Every action goes through the same function the player's own click would call**, so an automated
 *   sale, delve or study is identical to a manual one — including its cost, its toast and its ledger tag.
 */
import type { GameState, Mods } from './types';
import {
  count, demandOf, doSell, feedFamiliar, hasAll, plantCost, researchStatus, sellValue, skillPointsFree,
  unlockedPlants, unlockedRecipes, unlockedZones,
} from './engine';
import { acceptOffer, buy, buySkill, deliver, plant, skillStatus, sowAll, startExpedition, startResearch } from './actions';
import { claimGoal } from './goals';
import { craftReagent } from './magic';
import { equip, findGear, gearScore, salvageBelow, enhanceGear } from './armory';
import { dungeonUnlocked, enterDungeon, setBeltSlot } from './combat';
import { advReady, canHire, hireAdventurer, kitReserve, setKit, suppliable } from './party';
import { starvedRecipes } from './ledger';
import { RECIPES, RECIPE_MAP } from '../data/recipes';
import { ITEM_MAP } from '../data/items';
import { ZONES } from '../data/zones';
import { DUNGEONS } from '../data/combat';
import { SKILLS } from '../data/skills';
import { RESEARCH } from '../data/research';
import { GOALS } from '../data/goals';
import { FAMILIAR_MAP } from '../data/familiars';
import { SPELL_MAP } from '../data/spells';
import { GEAR_SLOTS, gearBase } from '../data/gear';
import { CLASSES } from '../data/adventurers';

/** Automation runs on a cadence rather than every tick: most of it is scanning, and none of it is urgent. */
const EVERY = 1;
let since = 0;

const on = (v: number): boolean => v >= 1;

/**
 * Whether this craft's apprentice is still making the decisions, or the player has taken them back.
 *
 * A handover stops *judgement* only — the choosing of what to plant, which recipe to run, what to sell,
 * where to send a party. The apprentice keeps tending the beds and pots they are assigned, because that
 * is what an apprentice is; switching them off entirely would mean firing them, and the tree they have
 * spent a hundred levels in is not something to throw away with a toggle.
 */
export function working(s: GameState, role: string): boolean {
  return !s.autoOff?.[role];
}

/** Hand a craft back and forth. Called from every view that has an apprentice acting on it. */
export function setHandover(s: GameState, role: string, apprenticeDecides: boolean): void {
  s.autoOff ??= {};
  if (apprenticeDecides) delete s.autoOff[role];
  else s.autoOff[role] = true;
}

// ── Garden ───────────────────────────────────────────────────
/** The best herb the player can actually afford to keep planting. */
export function bestPlant(s: GameState, m: Mods): { id: string } | null {
  const open = unlockedPlants(s).filter((p) => s.gold > plantCost(s, m, p) * 4);
  return open.length ? open[open.length - 1] : null;
}

function autoGarden(s: GameState, m: Mods): void {
  if (on(m.autoPlant)) {
    const pick = bestPlant(s, m);
    if (pick) s.plots.forEach((p, i) => { if (!p.plantId && i < m.autoHarvest) plant(s, i, pick.id); });
  }
  if (on(m.autoSeeds)) {
    for (const key of Object.keys(s.seeds)) if ((s.seeds[key] ?? 0) > 0) sowAll(s, key);
  }
}

// ── Cauldrons ────────────────────────────────────────────────
/** Gold per second of brewing, which is what "best recipe" has to mean for a Brewer choosing one. */
const recipeRate = (s: GameState, m: Mods, id: string): number => sellValue(s, m, id, 1) / RECIPE_MAP[id].time;

function autoCauldrons(s: GameState, m: Mods): void {
  if (!on(m.autoRecipe)) return;
  const usable = unlockedRecipes(s)
    .filter((r) => hasAll(s, r.inputs))
    // Batch Planning keeps off the recipes you have already flooded, so demand climbs back while you earn.
    .filter((r) => !on(m.autoSpread) || demandOf(s, r.id) >= 0.6)
    .sort((a, b) => recipeRate(s, m, b.id) - recipeRate(s, m, a.id));
  if (!usable.length) return;
  s.cauldrons.forEach((c, i) => {
    if (c.active || i >= m.autoBrew) return;
    // Spread across the top few rather than piling every cauldron onto one recipe and crushing it.
    const pick = on(m.autoSpread) ? usable[i % Math.min(usable.length, 3)] : usable[0];
    if (pick && c.recipeId !== pick.id) c.recipeId = pick.id;
    // Choosing the recipe is only half of it: a Brewer who picks a brew also runs it. Without this the
    // cauldron sits on a chosen recipe forever, because the engine's restart path needs Repeat lit.
    c.repeat = true;
  });
}

/** Buy the cheap missing ingredient a tended cauldron is stalled on, within a sane share of the purse. */
function autoRestock(s: GameState, m: Mods): void {
  if (!on(m.autoBuy)) return;
  const budget = s.gold * 0.05;
  for (const st of starvedRecipes().slice(0, 3)) {
    const r = RECIPE_MAP[st.id];
    if (!r) continue;
    for (const inp of r.inputs) {
      const def = ITEM_MAP[inp.id];
      if (!def?.buyLevel || def.buyLevel > s.level) continue;
      const short = inp.qty * 20 - count(s, inp.id);
      if (short <= 0) continue;
      const price = def.value * 1.5;
      const afford = Math.min(short, Math.floor(budget / Math.max(1, price)));
      // Go through the same path a player's click would, so the cost and the item pop-up match.
      if (afford >= 1) buy(s, inp.id, afford);
    }
  }
}

// ── Expeditions ──────────────────────────────────────────────
function autoExpeditions(s: GameState, m: Mods): void {
  if (!on(m.autoRoute)) return;
  const open = unlockedZones(s);
  if (!open.length) return;
  const busy = new Set(s.expeditions.filter(Boolean).map((e) => e!.zoneId));

  // Supply Run: if a cauldron is starving for something a zone drops, go and get it.
  let wanted: string | null = null;
  if (on(m.autoSupply)) {
    const need = starvedRecipes()[0];
    wanted = need?.missing[0] ?? null;
  }
  const rift = ZONES.find((z) => z.endless && z.level <= s.level);

  s.expeditions.forEach((e, i) => {
    if (e || i >= m.autoScav) return;
    let pick = wanted ? open.find((z) => !busy.has(z.id) && z.drops.some((d) => d.id === wanted)) : undefined;
    if (!pick && on(m.autoRift) && rift && !busy.has(rift.id)) pick = rift;
    if (!pick) pick = [...open].reverse().find((z) => !busy.has(z.id));
    if (!pick) return;
    busy.add(pick.id);
    startExpedition(s, i, pick.id);
    // A Scout who picks the destination keeps the party going back, rather than being re-asked every second.
    const sent = s.expeditions[i];
    if (sent) sent.repeat = true;
  });
}

// ── Market ───────────────────────────────────────────────────
function autoMarket(s: GameState, m: Mods): void {
  // Open Books sells without being told which types to sell, but still keeps back the player's reserve
  // and whatever the company needs for its next delve.
  if (on(m.autoSellAll)) {
    for (const r of unlockedRecipes(s)) {
      const keep = s.settings.keepReserve + kitReserve(s, m, r.id);
      const extra = Math.floor(count(s, r.id)) - keep;
      if (extra > 0) doSell(s, m, r.id, extra, undefined, 'autosell');
    }
  }
  if (on(m.autoContract)) {
    s.guild.contracts.forEach((c, i) => {
      if (c.kind === 'slay') return;
      if (count(s, c.recipeId) >= c.qty - c.delivered) deliver(s, i);
    });
  }
  if (on(m.autoTrade)) {
    s.trade.offers.forEach((o, i) => {
      if (o.used) return;
      const give = o.give.reduce((a, g) => a + (g.id === 'gold' ? g.qty : sellValue(s, m, g.id, g.qty)), 0);
      const get = o.get.reduce((a, g) => a + (g.id === 'gold' ? g.qty : sellValue(s, m, g.id, g.qty)), 0);
      const affordable = o.give.every((g) => (g.id === 'gold' ? s.gold : count(s, g.id)) >= g.qty);
      if (affordable && get > give * 1.15) acceptOffer(s, i);
    });
  }
}

// ── Adventure ────────────────────────────────────────────────
function autoAdventure(s: GameState, m: Mods): void {
  if (on(m.autoBelt)) {
    const combat = RECIPES.filter((r) => r.combat && r.level <= s.level && count(s, r.id) >= 1)
      .sort((a, b) => b.level - a.level);
    const used = new Set<string>();
    for (let i = 0; i < Math.floor(m.potionSlots); i++) {
      const held = s.belt[i];
      if (held && count(s, held) >= 1) { used.add(held); continue; }
      const pick = combat.find((r) => !used.has(r.id));
      if (pick) { setBeltSlot(s, i, pick.id); used.add(pick.id); }
    }
  }
  if (on(m.autoEquip)) {
    for (const slot of GEAR_SLOTS) {
      const worn = s.equipped[slot] ? findGear(s, s.equipped[slot]!) : undefined;
      const best = s.gear.filter((g) => gearBase(g).slot === slot).sort((a, b) => gearScore(b) - gearScore(a))[0];
      if (best && (!worn || gearScore(best) > gearScore(worn))) equip(s, best.uid);
    }
  }
  if (on(m.autoGear)) {
    if (s.settings.autoSalvage > 0) salvageBelow(s, s.settings.autoSalvage);
    // Spend spare dust on what is actually being worn, best piece first.
    const worn = Object.values(s.equipped).filter(Boolean).map((uid) => findGear(s, uid!)).filter(Boolean);
    const target = worn.sort((a, b) => gearScore(b!) - gearScore(a!))[0];
    if (target) enhanceGear(s, target.uid);
  }
  if (on(m.autoDungeon) && !s.combat.dungeonId) {
    const open = DUNGEONS.filter((d) => dungeonUnlocked(s, d));
    if (open.length) enterDungeon(s, open[open.length - 1].id);
  }
}

// ── Study ────────────────────────────────────────────────────
function autoScribe(s: GameState, m: Mods): void {
  // Keep a small stock of every reagent an automatic ritual consumes, so recasting never stalls.
  if (on(m.autoReagent)) {
    for (const [rid, auto] of Object.entries(s.autoRituals)) {
      if (!auto) continue;
      for (const need of SPELL_MAP[rid]?.ritual?.reagents ?? []) {
        if (count(s, need.id) < need.qty * 5) craftReagent(s, need.id, 1);
      }
    }
  }
  if (on(m.autoStudy)) {
    const open = RESEARCH.filter((r) => researchStatus(s, m, r.id).ok && hasAll(s, r.cost));
    if (open.length) startResearch(s, open[0].id);
  }
  if (on(m.autoFeed)) {
    const spare = RECIPES.filter((r) => count(s, r.id) > s.settings.keepReserve * 3).sort((a, b) => a.value - b.value)[0];
    const fam = s.equippedFamiliars.find((id) => FAMILIAR_MAP[id]);
    if (spare && fam) feedFamiliar(s, fam, spare.id, 1);
  }
}

// ── The company ──────────────────────────────────────────────
function autoCompany(s: GameState, m: Mods): void {
  if (on(m.autoKit)) {
    const need = s.party.roster.filter(advReady).length || 1;
    const stocked = RECIPES.filter((r) => suppliable(r.id) && count(s, r.id) >= need * 2).sort((a, b) => b.level - a.level);
    for (let i = 0; i < Math.floor(m.kitSlots); i++) {
      const held = s.party.kit[i];
      if (held && count(s, held) >= need) continue;
      const pick = stocked.find((r) => !s.party.kit.includes(r.id));
      if (pick) setKit(s, i, pick.id);
    }
  }
  if (on(m.autoHire) && canHire(s, m)) {
    // Fill the front rank first, then damage — the same order a player builds a company in.
    const order = ['warden', 'mage', 'ranger', 'cleric', 'blade', 'rogue'];
    const have = s.party.roster.length;
    const pick = order[have % order.length];
    if (CLASSES.some((c) => c.id === pick)) hireAdventurer(s, pick);
  }
}

// ── Meta (ascension perks, not apprentices) ──────────────────
function autoMeta(s: GameState, m: Mods): void {
  if (on(m.autoGoals)) {
    for (const g of GOALS) if (s.goals[g.id] === 'done') claimGoal(s, g.id);
  }
  if (on(m.autoSkills) && skillPointsFree(s, m) > 0) {
    const next = SKILLS.filter((n) => skillStatus(s, n).ok).sort((a, b) => skillStatus(s, a).cost - skillStatus(s, b).cost)[0];
    if (next) buySkill(s, next.id);
  }
}

/** Run every automation the player's apprentices have earned. Called from `tick`. */
export function tickAutomation(s: GameState, m: Mods, dt: number): void {
  since += dt;
  if (since < EVERY) return;
  since = 0;
  if (working(s, 'gardener')) autoGarden(s, m);
  if (working(s, 'brewer')) { autoCauldrons(s, m); autoRestock(s, m); }
  if (working(s, 'scout')) autoExpeditions(s, m);
  // Everyone who *consumes* potions claims what they need before the Shopkeeper sells the surplus.
  // With the seller first, Open Books emptied the shelves every second and the Quartermaster, the belt
  // and the familiars never saw a bottle.
  if (working(s, 'squire')) autoAdventure(s, m);
  if (working(s, 'scribe')) autoScribe(s, m);
  if (working(s, 'captain')) autoCompany(s, m);
  if (working(s, 'shopkeeper')) autoMarket(s, m);
  if (working(s, 'meta')) autoMeta(s, m);
}
