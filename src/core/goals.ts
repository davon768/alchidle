import type { GameState } from './types';
import { GOALS, GOAL_MAP, type GoalDef } from '../data/goals';
import { addGold, addItem, toast } from './engine';
import { moment } from './telemetry';

export type GoalStatus = 'claimed' | 'done' | 'active' | 'locked';

export function goalAvailable(s: GameState, g: GoalDef): boolean {
  return s.level >= g.level && (!g.when || g.when(s));
}

export function goalStatus(s: GameState, g: GoalDef): GoalStatus {
  const mark = s.goals[g.id];
  if (mark === 'claimed' || mark === 'done') return mark;
  return goalAvailable(s, g) ? 'active' : 'locked';
}

/** The banner goal: a reward waiting to be claimed first, otherwise the next unfinished goal. */
export function currentGoal(s: GameState): GoalDef | null {
  return GOALS.find((g) => goalStatus(s, g) === 'done') ?? GOALS.find((g) => goalStatus(s, g) === 'active') ?? null;
}

/** Marks newly reached goals as done (they stay done even if the condition later stops being true). */
export function checkGoals(s: GameState): void {
  const fresh = GOALS.filter((g) => !s.goals[g.id] && goalAvailable(s, g) && g.check(s));
  for (const g of fresh) s.goals[g.id] = 'done';
  if (fresh.length === 1) toast(`🎯 Goal complete: ${fresh[0].title} — claim your reward`, 'good');
  else if (fresh.length > 1) toast(`🎯 ${fresh.length} goals complete — claim your rewards in 🎯 Goals`, 'good');
}

export function claimGoal(s: GameState, id: string): void {
  const g = GOAL_MAP[id];
  if (!g || s.goals[id] !== 'done') return;
  s.goals[id] = 'claimed';
  if (g.reward.gold) addGold(s, g.reward.gold, false);
  for (const it of g.reward.items ?? []) addItem(s, it.id, it.qty);
  toast(`🎁 Reward claimed: ${g.title}`, 'good');
  moment('goal', `claimed "${g.title}"`);
}
