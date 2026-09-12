import type { GameState } from './types';
import { newState, SAVE_VERSION } from './state';
import type { RoleId } from './types';
import { PROF_MAP } from '../data/proficiency';
import { RESEARCH_MAP } from '../data/research';
import { TRAIT_MAP, parseSeed } from '../data/mutations';
import { FAMILIAR_MAP } from '../data/familiars';
import { createApprentice } from '../data/apprentices';

const KEY = 'alchemy-idle-save';

/** Fill in any fields missing from an older save using fresh defaults, so adding new systems never breaks old saves. */
function mergeDefaults<T>(defaults: T, loaded: unknown): T {
  if (loaded === undefined || loaded === null) return defaults;
  if (typeof defaults !== 'object' || defaults === null || Array.isArray(defaults)) return loaded as T;
  if (typeof loaded !== 'object' || Array.isArray(loaded)) return defaults;
  const out: Record<string, unknown> = { ...(loaded as Record<string, unknown>) };
  for (const [k, v] of Object.entries(defaults as Record<string, unknown>)) {
    out[k] = mergeDefaults(v, (loaded as Record<string, unknown>)[k]);
  }
  return out as T;
}

type LegacySave = Partial<GameState> & { mastery?: Record<string, number> };

function migrate(raw: LegacySave): GameState {
  const s = mergeDefaults(newState(), raw) as GameState & { mastery?: Record<string, number> };
  // v1 → v2: recipe mastery (units brewed) becomes brewing proficiency XP at the normal per-brew rate.
  if (raw.mastery && Object.keys(s.prof).length === 0) {
    for (const [id, units] of Object.entries(raw.mastery)) {
      const d = PROF_MAP[id];
      if (d) s.prof[id] = units * d.xp;
    }
  }
  delete s.mastery;
  // v2 → v3: bought automation (gnome, coal, falcon, clerk) becomes experienced apprentices.
  const legacyHelpers: [string, RoleId, string, string][] = [
    ['gnome', 'gardener', 'Gnorbert', '🧙'], ['flame', 'brewer', 'Cinder', '🧑‍🔬'], ['falcon', 'scout', 'Talon', '🧝'], ['clerk', 'shopkeeper', 'Bramble', '🧑‍💼'],
  ];
  for (const [upgrade, role, name, icon] of legacyHelpers) {
    if (!s.upgrades[upgrade]) continue;
    delete s.upgrades[upgrade];
    s.staff.hired.push(createApprentice(`a${s.staff.nextId++}`, name, icon, 0, [], role, 10));
  }
  // v3 → v4: potion quality. `qual` starts empty and engine.qualCounts reconciles each potion's
  // total into Common the first time it is touched, so pre-quality stock simply becomes Common.
  if (s.asc.nodes['automata']) {
    s.asc.nodes['loyal'] = s.asc.nodes['automata'];
    delete s.asc.nodes['automata'];
  }
  // v4 → v5: the Research Library. mergeDefaults supplies an empty queue and ledger, so older saves
  // simply start with nothing researched; drop any study whose project no longer exists.
  s.research.queue = s.research.queue.filter((q) => RESEARCH_MAP[q.id]);
  // v5 → v6: cross-breeding. Older plots have no `trait` field; mergeDefaults cannot reach inside the
  // array, so normalise them here and drop seeds for traits that no longer exist.
  // Unknown traits are dropped like unknown seeds: a trait with no definition would throw in the
  // garden view, and a render that throws used to take the whole UI down with it.
  for (const plot of s.plots) {
    if (plot.trait === undefined) plot.trait = null;
    else if (plot.trait !== null && !TRAIT_MAP[plot.trait]) plot.trait = null;
  }
  // v6 → v7: the stir window became a wall-clock stamp. Old cauldrons carry `stirLeft`; a missing
  // `stirStart` would read as NaN through Date.now() arithmetic, so close every window on load.
  for (const c of s.cauldrons as (typeof s.cauldrons[number] & { stirLeft?: number })[]) {
    delete c.stirLeft;
    if (typeof c.stirStart !== 'number' || !Number.isFinite(c.stirStart)) c.stirStart = 0;
    if (typeof c.stirTarget !== 'number' || !Number.isFinite(c.stirTarget)) c.stirTarget = 0.5;
    if (typeof c.stirQ !== 'number' || !Number.isFinite(c.stirQ)) c.stirQ = 0;
  }
  for (const key of Object.keys(s.seeds)) if (!TRAIT_MAP[parseSeed(key).trait]) delete s.seeds[key];
  // v7 → v8: familiars. mergeDefaults supplies the empty records; drop anything whose definition is
  // gone and trim the equipped list so a stale id cannot reach computeMods.
  for (const id of Object.keys(s.familiars)) if (!FAMILIAR_MAP[id]) delete s.familiars[id];
  s.equippedFamiliars = s.equippedFamiliars.filter((id) => s.familiars[id] !== undefined);
  s.version = SAVE_VERSION;
  return s;
}

export function saveGame(s: GameState): boolean {
  try {
    s.lastTick = Date.now();
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): GameState | null {
  try {
    const txt = localStorage.getItem(KEY);
    if (!txt) return null;
    return migrate(JSON.parse(txt));
  } catch {
    return null;
  }
}

export function wipeSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

export function exportSave(s: GameState): string {
  s.lastTick = Date.now();
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function importSave(code: string): GameState {
  const bin = atob(code.trim());
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return migrate(JSON.parse(new TextDecoder().decode(bytes)));
}
