import type { GameState, Mods } from './types';
import { addGold, availableIngredients, randInt, toast } from './engine';
import { addGear, newGear } from './armory';
import { dungeonUnlocked } from './combat';
import { EVENTS, EVENT_GAP, EVENT_MAP, EVENT_UNLOCK_LEVEL, raidTarget, type EventDef } from '../data/events';
import { DUNGEONS, DUNGEON_UNLOCK_LEVEL } from '../data/combat';
import { rollRarity } from '../data/gear';

function eligible(s: GameState, ev: EventDef): boolean {
  if (ev.level > s.level) return false;
  if ((ev.special === 'raid' || ev.special === 'champion') && s.level < DUNGEON_UNLOCK_LEVEL) return false;
  return true;
}

export function startEvent(s: GameState, ev: EventDef): void {
  s.event = { id: ev.id, remaining: ev.duration, progress: 0 };
  s.stats.events++;
  switch (ev.special) {
    case 'fever':
      for (const id of ['p_heal', 'p_gheal']) s.demand[id] = 2.2;
      break;
    case 'champion':
      s.combat.champion = true;
      break;
    case 'jobfair':
      // Apprentices are no longer hired from a candidate list, so the fair is a teaching day instead:
      // the standing bonus in data/events.ts does the work while it runs.
      break;
    case 'merchant': {
      const pool = availableIngredients(s, 8).filter((i) => i.value >= 30);
      for (const it of pool.sort(() => Math.random() - 0.5).slice(0, 2)) {
        const qty = randInt(2, 5);
        s.trade.offers.unshift({ title: '🧳 Mysterious Merchant', give: [{ id: 'gold', qty: Math.round(it.value * qty * 0.8) }], get: [{ id: it.id, qty }], used: false });
      }
      break;
    }
  }
  const goal = ev.special === 'raid' ? ` Slay ${raidTarget(s.level)} monsters!` : '';
  toast(`${ev.icon} ${ev.name}: ${ev.desc}${goal}`, 'epic');
}

export function endEvent(s: GameState, success: boolean): void {
  const ev = s.event ? EVENT_MAP[s.event.id] : null;
  if (ev?.special === 'champion') s.combat.champion = false;
  if (ev?.special === 'raid' && !success) toast('👺 The raiders slipped away with some caravan goods.', 'warn');
  if (ev && !ev.special) toast(`${ev.icon} ${ev.name} has ended.`, 'info');
  s.event = null;
  s.eventTimer = randInt(EVENT_GAP[0], EVENT_GAP[1]);
}

export function tickEvents(s: GameState, _m: Mods, dt: number): void {
  if (s.level < EVENT_UNLOCK_LEVEL) return;
  if (s.event) {
    s.event.remaining -= dt;
    if (s.event.remaining <= 0) endEvent(s, false);
    return;
  }
  s.eventTimer -= dt;
  if (s.eventTimer > 0) return;
  const pool = EVENTS.filter((e) => eligible(s, e));
  let r = Math.random() * pool.reduce((a, e) => a + e.weight, 0);
  for (const ev of pool) {
    r -= ev.weight;
    if (r <= 0) return startEvent(s, ev);
  }
}

/** Called for every monster killed; advances the Goblin Raid objective. */
export function onEventKill(s: GameState, m: Mods): void {
  if (s.event?.id !== 'raid') return;
  s.event.progress++;
  if (s.event.progress < raidTarget(s.level)) return;
  const gold = Math.round(150 * s.level ** 1.5 * m.contractReward);
  addGold(s, gold);
  const best = [...DUNGEONS].reverse().find((d) => dungeonUnlocked(s, d));
  if (best) addGear(s, newGear(s, best.tier, rollRarity(m.lootFind * 2, 2)));
  toast(`👺 Raid repelled! The caravans reward you with ${gold.toLocaleString()} gold and a gift.`, 'epic');
  endEvent(s, true);
}
