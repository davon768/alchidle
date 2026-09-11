import type { Apprentice, GameState, Mods, RoleId } from './types';
import { addGold, randInt, toast } from './engine';
import { computeMods, describeEffects } from './mods';
import {
  CANDIDATE_REFRESH, NAMES, PORTRAITS, ROLES, ROLE_MAP, TALENTS, TRAITS, TRAIT_MAP,
  apprXpToNext, apprenticeCap, apprenticeCapacity, createApprentice, repushDelay, traitXpMult, tuitionMult,
} from '../data/apprentices';
import { PROFS, profLevel } from '../data/proficiency';

export function findApprentice(s: GameState, id: string): Apprentice | undefined {
  return s.staff.hired.find((a) => a.id === id);
}

export function workersOf(s: GameState, role: RoleId): Apprentice[] {
  return s.staff.hired.filter((a) => a.role === role && a.mode === 'work');
}

/** The apprentice tending slot `index` of a role (plot, cauldron, party…). Bonus capacity from skills is credited to the lead worker. */
export function tenderOf(s: GameState, role: RoleId, index: number): Apprentice | null {
  const workers = workersOf(s, role);
  let i = index;
  for (const a of workers) {
    const c = apprenticeCapacity(a);
    if (i < c) return a;
    i -= c;
  }
  return workers[0] ?? null;
}

// ── Training ─────────────────────────────────────────────────
/** Your own proficiency in a craft makes you a better teacher (up to ×2 at proficiency 100). */
function mentorMult(s: GameState, role: RoleId): number {
  const kind = ROLE_MAP[role].mentor;
  if (!kind) return 1 + s.level / 100;
  let best = 1;
  for (const p of PROFS) if (p.kind === kind) best = Math.max(best, profLevel(s.prof[p.id] ?? 0));
  return 1 + best / 100;
}

/** Base study speed (XP/s) before XP multipliers. */
export function trainRate(s: GameState, a: Apprentice): number {
  return (0.5 + 0.05 * a.level) * (a.role ? mentorMult(s, a.role) : 1);
}

export function effectiveTrainRate(s: GameState, m: Mods, a: Apprentice): number {
  return trainRate(s, a) * m.apprenticeXp * TALENTS[a.talent].xp * traitXpMult(a, false);
}

/** Gold per second while studying — rises steeply with level. */
export function tuitionRate(a: Apprentice): number {
  return (0.5 + 0.05 * a.level) * 2 * 1.13 ** (a.level - 1) * tuitionMult(a);
}

export function gainApprenticeXp(_s: GameState, m: Mods, a: Apprentice, amount: number, working: boolean): void {
  const cap = apprenticeCap(a);
  if (a.level >= cap || amount <= 0) return;
  a.xp += amount * m.apprenticeXp * TALENTS[a.talent].xp * traitXpMult(a, working);
  let need = apprXpToNext(a.level);
  while (a.xp >= need && a.level < cap) {
    a.xp -= need;
    a.level++;
    need = apprXpToNext(a.level);
    const perk = a.role ? ROLE_MAP[a.role].perks.find((p) => p.level === a.level) : undefined;
    if (perk) toast(`${a.icon} ${a.name} reached level ${a.level}: ${describeEffects(perk.effects)}`, 'good');
  }
  if (a.level >= cap) {
    a.xp = 0;
    toast(`🎓 ${a.icon} ${a.name} has mastered their craft and is ready to graduate!`, 'epic');
  }
}

/** Credit work XP to whichever apprentice handles slot `index` of `role`. */
export function workXp(s: GameState, m: Mods, role: RoleId, index: number, amount: number): void {
  const a = tenderOf(s, role, index);
  if (a) gainApprenticeXp(s, m, a, amount, true);
}

// ── Hiring ───────────────────────────────────────────────────
export function rollCandidate(s: GameState, luck = 1): Apprentice {
  const weights = TALENTS.map((t, i) => t.weight * (i > 0 ? luck : 1));
  let r = Math.random() * weights.reduce((x, y) => x + y, 0);
  let talent = 0;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      talent = i;
      break;
    }
  }
  const pool = [...TRAITS].sort(() => Math.random() - 0.5);
  const traits = [pool[0].id];
  if (Math.random() < 0.4) {
    const clash = (a: string, b: string) => [a, b].includes('clumsy') && [a, b].includes('diligent');
    const second = pool.slice(1).find((t) => !clash(t.id, pool[0].id));
    if (second) traits.push(second.id);
  }
  return createApprentice(`a${s.staff.nextId++}`, NAMES[randInt(0, NAMES.length - 1)], PORTRAITS[randInt(0, PORTRAITS.length - 1)], talent, traits);
}

export function rollCandidates(s: GameState, luck = 1): Apprentice[] {
  return [0, 1, 2].map(() => rollCandidate(s, luck));
}

export function hireCost(s: GameState, a: Apprentice): number {
  return Math.round(40 * (1 + s.level) ** 1.4 * TALENTS[a.talent].cost);
}

/** Suggest the first unlocked role nobody is doing yet. */
function suggestRole(s: GameState, a: Apprentice): RoleId | null {
  const affinity = a.traits.map((id) => TRAIT_MAP[id]?.role).find((r) => r && s.level >= ROLE_MAP[r].level);
  if (affinity) return affinity;
  const open = ROLES.filter((r) => s.level >= r.level);
  return (open.find((r) => !s.staff.hired.some((h) => h.role === r.id)) ?? open[0])?.id ?? null;
}

export function hire(s: GameState, index: number): void {
  const a = s.staff.candidates[index];
  if (!a) return;
  if (s.staff.hired.length >= Math.floor(computeMods(s).apprenticeSlots)) {
    toast('No free apprentice slots — build Apprentice Quarters in the 🔨 Workshop.', 'warn');
    return;
  }
  const cost = hireCost(s, a);
  if (s.gold < cost) {
    toast('Not enough gold to hire.', 'warn');
    return;
  }
  addGold(s, -cost, false);
  s.staff.candidates.splice(index, 1);
  a.role = suggestRole(s, a);
  s.staff.hired.push(a);
  toast(`👥 ${a.icon} ${a.name} joins your workshop${a.role ? ` as a ${ROLE_MAP[a.role].name}` : ''}!`, 'good');
}

export function dismiss(s: GameState, id: string): void {
  s.staff.hired = s.staff.hired.filter((a) => a.id !== id);
}

export function assignRole(s: GameState, id: string, role: RoleId | null): void {
  const a = findApprentice(s, id);
  if (!a || (role && s.level < ROLE_MAP[role].level)) return;
  a.role = role;
}

export function setMode(s: GameState, id: string, mode: 'work' | 'train'): void {
  const a = findApprentice(s, id);
  if (!a || (mode === 'train' && a.level >= apprenticeCap(a))) return;
  a.mode = mode;
}

/** A maxed apprentice leaves to join the Hall of Masters: a permanent bonus that survives ascension. */
export function graduate(s: GameState, id: string): void {
  const a = findApprentice(s, id);
  if (!a || !a.role || a.level < apprenticeCap(a)) return;
  dismiss(s, id);
  s.staff.masters.push({ name: a.name, icon: a.icon, role: a.role, talent: a.talent });
  toast(`🏛️ ${a.icon} ${a.name} graduates as a ${TALENTS[a.talent].name} Master ${ROLE_MAP[a.role].name}!`, 'epic');
}

export function rerollCost(s: GameState): number {
  return Math.round(25 * s.level ** 1.3);
}

export function rerollCandidates(s: GameState): void {
  const cost = rerollCost(s);
  if (s.gold < cost) return;
  addGold(s, -cost, false);
  s.staff.candidates = rollCandidates(s);
  s.staff.refresh = CANDIDATE_REFRESH;
}

// ── Tick ─────────────────────────────────────────────────────
export function tickStaff(s: GameState, m: Mods, dt: number): void {
  const st = s.staff;
  st.refresh -= dt;
  if (st.refresh <= 0) {
    st.candidates = rollCandidates(s);
    st.refresh = CANDIDATE_REFRESH;
  }

  for (const a of st.hired) {
    if (a.mode !== 'train' || a.level >= apprenticeCap(a)) continue;
    const cost = tuitionRate(a) * dt;
    if (s.gold < cost) continue; // can't pay tuition: study pauses
    addGold(s, -cost, false);
    gainApprenticeXp(s, m, a, trainRate(s, a) * dt, false);
  }

  // Squires: after a defeat-retreat and recovery, push deeper again.
  const c = s.combat;
  const squires = workersOf(s, 'squire');
  if (squires.length && c.dungeonId && c.retreated && !c.autoAdvance && c.dead <= 0) {
    st.repush += dt;
    if (st.repush >= Math.min(...squires.map(repushDelay))) {
      c.autoAdvance = true;
      c.retreated = false;
      st.repush = 0;
      toast(`🤺 ${squires[0].name} rallies you — pushing deeper again!`, 'info');
    }
  } else {
    st.repush = 0;
  }
}
