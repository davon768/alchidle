import type { Apprentice, GameState, Mods, RoleId } from './types';
import { toast } from './engine';
import { moment } from './telemetry';
import { describeEffects } from './mods';
import {
  APPRENTICE_MAX, APPR_ROW_POINTS, NAMES, NODE_MAP, ROLE_MAP, ROLES,
  apprenticeLevel, apprenticeProgress, nodeRankCost, roleOfNode, type ApprenticeNode,
} from '../data/apprentices';
import { PROFS, profLevel } from '../data/proficiency';

export function apprenticeOf(s: GameState, role: RoleId): Apprentice | undefined {
  return s.staff.crew[role];
}
export const hasApprentice = (s: GameState, role: RoleId): boolean => !!s.staff.crew[role];

/** Bring a role's apprentice into the workshop. Called when its Library study finishes. */
export function unlockApprentice(s: GameState, role: RoleId): void {
  if (s.staff.crew[role]) return;
  s.staff.crew[role] = { role, xp: 0, nodes: {} };
  const def = ROLE_MAP[role];
  toast(`${def.icon} ${NAMES[role]} joins your workshop as your ${def.name}!`, 'epic');
}

// ── Levels, points and the tree ──────────────────────────────
export const levelOf = (a: Apprentice): number => apprenticeLevel(a.xp);
export const progressOf = (a: Apprentice): { level: number; into: number; need: number } => apprenticeProgress(a.xp);

/** One skill point per level. */
export const pointsEarned = (a: Apprentice): number => levelOf(a);

export function pointsSpent(a: Apprentice): number {
  let total = 0;
  for (const [id, rank] of Object.entries(a.nodes)) {
    const node = NODE_MAP[id];
    if (!node) continue;
    for (let r = 0; r < rank; r++) total += nodeRankCost(node, r);
  }
  return total;
}

export const pointsFree = (a: Apprentice): number => pointsEarned(a) - pointsSpent(a);

/**
 * Whether a node can be bought right now, and why not.
 *
 * `asc` is the number of Great Works performed: the deepest talents in every tree are judgement rather
 * than capacity, and they stay shut until the player has been round at least once.
 */
export function nodeStatus(a: Apprentice, node: ApprenticeNode, asc = 0): { ok: boolean; reason: string; cost: number } {
  const rank = a.nodes[node.id] ?? 0;
  const cost = nodeRankCost(node, rank);
  if (node.maxRank > 0 && rank >= node.maxRank) return { ok: false, reason: 'Fully learned', cost };
  if (node.minAsc && asc < node.minAsc) {
    return { ok: false, reason: `Opens after ${node.minAsc} ascension${node.minAsc > 1 ? 's' : ''}`, cost };
  }
  if (pointsSpent(a) < node.row * APPR_ROW_POINTS) {
    return { ok: false, reason: `Spend ${node.row * APPR_ROW_POINTS} points in this tree first`, cost };
  }
  if (pointsFree(a) < cost) return { ok: false, reason: `Needs ${cost} skill point${cost > 1 ? 's' : ''}`, cost };
  return { ok: true, reason: '', cost };
}

export function learnNode(s: GameState, role: RoleId, nodeId: string): void {
  const a = s.staff.crew[role];
  const node = NODE_MAP[nodeId];
  if (!a || !node || roleOfNode[nodeId] !== role) return;
  const status = nodeStatus(a, node, s.asc.count);
  if (!status.ok) {
    if (status.reason) toast(status.reason, 'warn');
    return;
  }
  a.nodes[nodeId] = (a.nodes[nodeId] ?? 0) + 1;
  moment('talent', `${ROLE_MAP[role].name}: ${node.name} rank ${a.nodes[nodeId]}`);
}

/** Refund every point in a tree so it can be spent again. Free: the points were earned by working. */
export function respecApprentice(s: GameState, role: RoleId): void {
  const a = s.staff.crew[role];
  if (!a) return;
  a.nodes = {};
  moment('talent', `reset the ${ROLE_MAP[role].name} tree at level ${levelOf(a)}`);
  toast(`${ROLE_MAP[role].icon} ${NAMES[role]} starts afresh — every point is yours to spend again.`, 'good');
}

/** How many units of its craft this apprentice tends. */
export function capacityOf(a: Apprentice): number {
  const def = ROLE_MAP[a.role];
  let n = def.baseCapacity;
  for (const [id, rank] of Object.entries(a.nodes)) {
    const node = NODE_MAP[id];
    if (node?.capacity) n += node.capacity * rank;
  }
  return Math.max(1, n);
}

/** Everything a role's tree currently contributes to the modifier pipeline. */
export function apprenticeEffects(a: Apprentice): { stat: keyof Mods; value: number }[] {
  const out: { stat: keyof Mods; value: number }[] = [];
  for (const [id, rank] of Object.entries(a.nodes)) {
    const node = NODE_MAP[id];
    if (!node?.effects || rank <= 0) continue;
    for (const eff of node.effects) out.push({ stat: eff.stat, value: eff.value * rank });
  }
  return out;
}

// ── Earning ──────────────────────────────────────────────────
/** Your own proficiency in a craft makes you a better teacher (up to ×2 at proficiency 100). */
function mentorMult(s: GameState, role: RoleId): number {
  const kind = ROLE_MAP[role].mentor;
  if (!kind) return 1 + s.level / 100;
  let best = 1;
  for (const p of PROFS) if (p.kind === kind) best = Math.max(best, profLevel(s.prof[p.id] ?? 0));
  return 1 + best / 100;
}

/** Credit an apprentice for a piece of work it tended. `index` is which unit, so only tended ones count. */
export function workXp(s: GameState, m: Mods, role: RoleId, index: number, amount: number): void {
  const a = s.staff.crew[role];
  if (!a || amount <= 0) return;
  if (index >= capacityOf(a)) return;
  const before = levelOf(a);
  if (before >= APPRENTICE_MAX) return;
  a.xp += amount * m.apprenticeXp * mentorMult(s, role);
  const after = levelOf(a);
  if (after > before) {
    toast(`${ROLE_MAP[role].icon} ${NAMES[role]} reached level ${after} — ${after - before} skill point${after - before > 1 ? 's' : ''} to spend.`, 'good');
  }
}

/** Seconds a Squire waits after your recovery before pushing deeper again. */
export function repushDelay(a: Apprentice): number {
  return Math.max(15, 180 - 3 * levelOf(a));
}

export function describeNode(node: ApprenticeNode, rank = 1): string {
  const parts: string[] = [];
  if (node.capacity) parts.push(`+${node.capacity * rank} tended`);
  if (node.effects) parts.push(describeEffects(node.effects, rank));
  return parts.filter(Boolean).join(', ');
}

export { ROLES, ROLE_MAP, NAMES, APPRENTICE_MAX, APPR_ROW_POINTS };

/**
 * Per-tick apprentice upkeep. All that remains is the Squire: after a defeat drops you a floor and you
 * recover, it turns auto-advance back on. Candidate refreshes, tuition and study time are gone with the
 * hiring system — apprentices now earn only by working, which `workXp` handles.
 */
export function tickStaff(s: GameState, _m: Mods, dt: number): void {
  const st = s.staff;
  const c = s.combat;
  const squire = st.crew.squire;
  if (squire && c.dungeonId && c.retreated && !c.autoAdvance && c.dead <= 0) {
    st.repush += dt;
    if (st.repush >= repushDelay(squire)) {
      c.autoAdvance = true;
      c.retreated = false;
      st.repush = 0;
      toast(`🤺 ${NAMES.squire} rallies you — pushing deeper again!`, 'info');
    }
  } else {
    st.repush = 0;
  }
}
