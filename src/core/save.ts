import type { GameState } from './types';
import { freshCombat, newState, snapshotRun, SAVE_VERSION } from './state';
import { DUNGEON_MAP } from '../data/combat';
import { BELT_MAX } from './combat';
import type { RoleId } from './types';
import { PROF_MAP } from '../data/proficiency';
import { RESEARCH_MAP } from '../data/research';
import { TRAIT_MAP, parseSeed } from '../data/mutations';
import { FAMILIAR_MAP } from '../data/familiars';
import { ROLE_MAP, apprXpForLevel } from '../data/apprentices';
import { CLASS_MAP, KIT_MAX } from '../data/adventurers';
import { PLANT_MAP } from '../data/plants';
import { RECIPE_MAP } from '../data/recipes';
import { ZONE_MAP } from '../data/zones';
import { SPELL_MAP } from '../data/spells';
import { GUILD_MAP } from '../data/guilds';
import { RELIC_MAP } from '../data/relics';

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

type LegacyApprentice = { role?: RoleId | null; level?: number };
type LegacyStaff = { hired?: LegacyApprentice[]; masters?: { role?: RoleId }[]; nextId?: number };
type LegacySave = Partial<GameState> & { mastery?: Record<string, number> };

/** Unlock a craft and credit it with the XP an apprentice of that level had earned. */
function legacyRole(s: GameState, role: RoleId, level: number): void {
  if (!ROLE_MAP[role]) return;
  const existing = s.staff.crew[role];
  const xp = apprXpForLevel(Math.max(1, level));
  if (existing) existing.xp = Math.max(existing.xp, xp);
  else s.staff.crew[role] = { role, xp, nodes: {} };
}

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
  // v2 → v3: bought automation (gnome, coal, falcon, clerk) becomes an apprentice in that craft.
  const legacyHelpers: [string, RoleId][] = [
    ['gnome', 'gardener'], ['flame', 'brewer'], ['falcon', 'scout'], ['clerk', 'shopkeeper'],
  ];
  for (const [upgrade, role] of legacyHelpers) {
    if (!s.upgrades[upgrade]) continue;
    delete s.upgrades[upgrade];
    legacyRole(s, role, 10);
  }
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
  // v11 → v12: stirring became a mash, so the sweet-spot centre it used to aim at is dead weight.
  type LegacyCauldron = typeof s.cauldrons[number] & { stirLeft?: number; stirTarget?: number };
  for (const c of s.cauldrons as LegacyCauldron[]) {
    delete c.stirLeft;
    delete c.stirTarget;
    if (typeof c.stirStart !== 'number' || !Number.isFinite(c.stirStart)) c.stirStart = 0;
    if (typeof c.stirClicks !== 'number' || !Number.isFinite(c.stirClicks)) c.stirClicks = 0;
    if (typeof c.stirQ !== 'number' || !Number.isFinite(c.stirQ)) c.stirQ = 0;
  }
  // Both halves of a seed key have to still exist: checking only the trait left seeds for deleted plants
  // sitting in the tray forever, invisible and unsowable.
  for (const key of Object.keys(s.seeds)) {
    const { plantId, trait } = parseSeed(key);
    if (!TRAIT_MAP[trait] || !PLANT_MAP[plantId]) delete s.seeds[key];
  }
  for (const key of Object.keys(s.strains ?? {})) if (!TRAIT_MAP[parseSeed(key).trait] || !PLANT_MAP[parseSeed(key).plantId]) delete s.strains[key];
  // v7 → v8: familiars. mergeDefaults supplies the empty records; drop anything whose definition is
  // gone and trim the equipped list so a stale id cannot reach computeMods.
  for (const id of Object.keys(s.familiars)) if (!FAMILIAR_MAP[id]) delete s.familiars[id];
  s.equippedFamiliars = s.equippedFamiliars.filter((id) => s.familiars[id] !== undefined);
  // v8 → v9: hiring is gone. Every craft the player had staffed — working or graduated — becomes that
  // craft's single apprentice, credited with the XP its old level represented. Talents, traits,
  // candidate lists and the Hall of Masters have no equivalent and are dropped. Points are unspent, so
  // the tree is theirs to lay out fresh.
  const oldStaff = (raw.staff ?? {}) as LegacyStaff;
  for (const a of oldStaff.hired ?? []) if (a?.role) legacyRole(s, a.role, a.level ?? 1);
  for (const mr of oldStaff.masters ?? []) if (mr?.role) legacyRole(s, mr.role, 25);
  for (const role of Object.keys(s.staff.crew) as RoleId[]) {
    if (!ROLE_MAP[role]) delete s.staff.crew[role];
  }
  // mergeDefaults keeps keys it does not recognise, so the old hiring fields would otherwise ride
  // along in every future save. Nothing reads them; drop them.
  for (const dead of ['hired', 'masters', 'candidates', 'refresh', 'nextId']) {
    delete (s.staff as unknown as Record<string, unknown>)[dead];
  }
  // v9 → v10: the adventurer company. mergeDefaults supplies an empty roster; drop any adventurer or
  // relic whose definition is gone, since either would throw in the Company view or in computeMods.
  s.party.roster = s.party.roster.filter((a) => CLASS_MAP[a.cls]);
  for (const id of Object.keys(s.party.relics)) if (!RELIC_MAP[id]) delete s.party.relics[id];
  // Every id that indexes into game data, checked once here rather than defended at each of the dozens
  // of places that read it. An id whose content is gone is dropped; nothing else about the save changes.
  s.party.kit = s.party.kit.slice(0, KIT_MAX).map((id) => (id && RECIPE_MAP[id]?.combat ? id : null));
  for (const plot of s.plots) if (plot.plantId && !PLANT_MAP[plot.plantId]) Object.assign(plot, { plantId: null, progress: 0, ready: false });
  for (const c of s.cauldrons) {
    if (c.recipeId && !RECIPE_MAP[c.recipeId]) Object.assign(c, { recipeId: null, active: false, progress: 0, repeat: false, stirQ: 0 });
  }
  s.expeditions = s.expeditions.map((e) => (e && ZONE_MAP[e.zoneId] ? e : null));
  s.belt = s.belt.slice(0, BELT_MAX).map((id) => (id && RECIPE_MAP[id] ? id : null));
  s.spellSlots = s.spellSlots.filter((id) => SPELL_MAP[id]);
  for (const id of Object.keys(s.spells)) if (!SPELL_MAP[id]) delete s.spells[id];
  for (const id of Object.keys(s.autoSell)) if (!RECIPE_MAP[id]) delete s.autoSell[id];
  if (s.guild.id && !GUILD_MAP[s.guild.id]) s.guild = { id: null, rep: 0, contracts: [] };
  s.guild.contracts = s.guild.contracts.filter((c) => (c.recipeId ? !!RECIPE_MAP[c.recipeId] : true));
  if (s.combat.dungeonId && !DUNGEON_MAP[s.combat.dungeonId]) s.combat = freshCombat();
  // v10 → v11: the Great Work now weighs what a *run* did, measured against a snapshot taken when the
  // run began. A save from before this has no snapshot, and without one every lifetime tally — hundreds
  // of thousands of brews — would read as this run's work and pay out a windfall. Start counting now.
  // Test the *raw* save, not the merged object: mergeDefaults fills runStart from a fresh state, so the
  // merged copy always has one (all zeros) and an "is it empty" check never fires.
  if (raw.runStart === undefined) s.runStart = snapshotRun(s);
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
