/**
 * The crossing bench: where a journal page becomes a herb nobody else has.
 *
 * Three things had to be true for this to be worth building.
 *
 * **The seed tray needed a job.** Seeds were a shelf — they accumulated, you sowed them, and there was no
 * decision anywhere in it. A cross is paid for in seeds, one carrying each parent, so every seed is now
 * either a strain rank or crossing material. Which trait you spend changes the outcome, so the tray is a
 * hand of cards rather than a pile.
 *
 * **Discovery had to come from outside the garden.** Recipes arrive as torn journal pages from
 * expeditions, dungeon bosses and finished studies, so the garden depends on the rest of the game instead
 * of sitting beside it, and a hybrid is something you found rather than something the level curve handed
 * you at the appointed minute.
 *
 * **Knowledge had to outlast the Great Work.** Everything else in the garden is unmade by a rebirth. A
 * recipe once read stays read — re-finding the same page every run would be a chore, not a challenge.
 */
import type { GameState } from '../core/types';
import { HYBRIDS, HYBRID_MAP, crossBonus, crossHerbCost, type HybridDef } from '../data/hybrids';
import { PLANT_MAP } from '../data/plants';
import { parseSeed, seedKey } from '../data/mutations';
import { count, removeItem, toast } from './engine';
import { moment } from './telemetry';

/** Whether a cross can be started right now, and what is missing if not. */
export function crossStatus(s: GameState, h: HybridDef, seedA: string, seedB: string): { ok: boolean; reason: string } {
  if (s.codex[h.id]) return { ok: false, reason: 'Already discovered.' };
  if (!s.clues[h.id]) return { ok: false, reason: 'You have not read this cross anywhere.' };
  if (s.level < h.level) return { ok: false, reason: `Needs level ${h.level}.` };
  if (s.bench) return { ok: false, reason: 'The bench is already occupied.' };
  if (!seedA || !seedB) return { ok: false, reason: 'Choose a seed of each parent.' };
  if ((s.seeds[seedA] ?? 0) < 1 || (s.seeds[seedB] ?? 0) < 1) return { ok: false, reason: 'Those seeds are gone.' };
  if (seedA === seedB && (s.seeds[seedA] ?? 0) < 2) return { ok: false, reason: 'You only have one of those.' };

  const want = crossHerbCost(h);
  const refunded = crossBonus(seedA, seedB).refund;
  if (!refunded) {
    for (const parent of h.parents) {
      const herb = PLANT_MAP[parent]?.herb ?? parent;
      if (count(s, herb) < want) return { ok: false, reason: `Needs ${want} ${PLANT_MAP[parent]?.name ?? parent}.` };
    }
  }
  return { ok: true, reason: '' };
}

/** Put a cross on the bench. The seeds and herbs are spent now; the discovery comes when it finishes. */
export function startCross(s: GameState, hybridId: string, seedA: string, seedB: string): void {
  const h = HYBRID_MAP[hybridId];
  if (!h) return;
  const status = crossStatus(s, h, seedA, seedB);
  if (!status.ok) {
    if (status.reason) toast(status.reason, 'warn');
    return;
  }
  // The seeds must actually carry the two parents, in either order — otherwise the cross is nonsense.
  const pa = parseSeed(seedA).plantId;
  const pb = parseSeed(seedB).plantId;
  const matches = (pa === h.parents[0] && pb === h.parents[1]) || (pa === h.parents[1] && pb === h.parents[0]);
  if (!matches) {
    toast('Those seeds are not the two parents this cross asks for.', 'warn');
    return;
  }

  const bonus = crossBonus(seedA, seedB);
  s.seeds[seedA] = (s.seeds[seedA] ?? 0) - 1;
  s.seeds[seedB] = (s.seeds[seedB] ?? 0) - 1;
  if (!bonus.refund) {
    for (const parent of h.parents) removeItem(s, PLANT_MAP[parent]?.herb ?? parent, crossHerbCost(h));
  }
  s.bench = { hybrid: h.id, seedA, seedB, progress: 0, time: h.time * bonus.speed };
  toast(`🌿 The cross is on the bench. ${Math.round(s.bench.time / 60)} min.`, 'good');
  moment('note', `began the ${h.name} cross`);
}

/** Abandon a cross. The materials are gone — this is a mistake you are allowed to make. */
export function cancelCross(s: GameState): void {
  if (!s.bench) return;
  s.bench = null;
  toast('The cross is scrapped.', 'info');
}

/** Advance the bench. Called once from the tick, and correct for any dt like everything else. */
export function tickCrossing(s: GameState, dt: number, quiet: boolean): void {
  const b = s.bench;
  if (!b) return;
  b.progress += dt;
  if (b.progress < b.time) return;

  const h = HYBRID_MAP[b.hybrid];
  s.bench = null;
  if (!h) return; // the content is gone; drop it rather than leaving a stuck bench

  s.codex[h.id] = true;
  const bonus = crossBonus(b.seedA, b.seedB);
  // A head start on the new strain, from whatever the spent seeds were carrying.
  if (bonus.seeds > 0) {
    const key = seedKey(h.id, 'bountiful');
    s.seeds[key] = (s.seeds[key] ?? 0) + bonus.seeds;
    s.catalogue[key] = true;
  }
  moment('unlock', `discovered ${h.name}`);
  if (!quiet) {
    toast(`🌟 ${h.name} — a herb that did not exist this morning.`, 'epic');
    if (bonus.seeds > 0) toast(`🫙 ${bonus.seeds} ${h.name} seed${bonus.seeds === 1 ? '' : 's'} came with it.`, 'good');
  }
}

/**
 * Read a page: learn one cross you do not know yet.
 *
 * Biased towards what the player can actually attempt — a page naming a level-90 cross for a level-12
 * gardener is a tease, not a lead — but it will reach a little past them, so there is always something
 * to grow towards. Returns the hybrid learned, or null when the book is complete.
 */
export function readPage(s: GameState, quiet = false): HybridDef | null {
  const reachable = HYBRIDS.filter((h) => !s.clues[h.id] && !s.codex[h.id] && h.level <= s.level + 12);
  const pool = reachable.length ? reachable : HYBRIDS.filter((h) => !s.clues[h.id] && !s.codex[h.id]);
  if (!pool.length) return null;
  const h = pool[Math.floor(Math.random() * pool.length)];
  s.clues[h.id] = true;
  if (!quiet) toast(`📄 A page on the ${h.name} cross: ${PLANT_MAP[h.parents[0]]?.name} × ${PLANT_MAP[h.parents[1]]?.name}.`, 'epic');
  moment('unlock', `read the ${h.name} page`);
  return h;
}

/**
 * Read one page from the satchel: spend it to learn a cross.
 *
 * Reading is deliberately a separate act from finding. A page you can see in your satchel and choose when
 * to open is a thing; knowledge that simply appears at the end of an expedition is a notification. Once
 * the book is complete a page is never spent — it stays as stock worth selling, rather than evaporating.
 */
export function consumePage(s: GameState, quiet = false): boolean {
  if (count(s, 'journal_page') < 1) return false;
  if (!pagesWorthReading(s)) {
    if (!quiet) toast('Every cross in the book is already yours. The page is worth keeping, not reading.', 'info');
    return false;
  }
  removeItem(s, 'journal_page', 1);
  return !!readPage(s, quiet);
}

/** Whether a page could still teach anything. When it cannot, pages stay in the satchel as stock to sell. */
export function pagesWorthReading(s: GameState): boolean {
  return HYBRIDS.some((h) => !s.clues[h.id] && !s.codex[h.id]);
}
