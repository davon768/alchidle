import { html, type TemplateResult } from 'lit-html';
import type { GameState } from '../../core/types';
import { GOALS, GOAL_CHAPTERS, type GoalDef } from '../../data/goals';
import { claimGoal, currentGoal, goalStatus, type GoalStatus } from '../../core/goals';
import { fmt } from '../../core/format';
import { act, bar, chip, sectionTitle, ui, type TabId } from '../common';

const STATUS_ICON: Record<GoalStatus, string> = { claimed: '✅', done: '🎁', active: '🎯', locked: '🔒' };

function rewardChips(g: GoalDef): TemplateResult {
  return html`${g.reward.gold ? chip({ id: 'gold', qty: g.reward.gold }) : ''}${(g.reward.items ?? []).map((it) => chip(it))}`;
}

function progressBar(s: GameState, g: GoalDef, status: GoalStatus): TemplateResult | string {
  if (!g.progress || status === 'claimed' || status === 'done') return '';
  const [cur, max] = g.progress(s);
  return bar(cur / max, undefined, `${fmt(Math.floor(cur))} / ${fmt(max)}`, 'small');
}

function actions(g: GoalDef, status: GoalStatus, inBanner: boolean): TemplateResult {
  return html`<div class="goal-actions">
    ${status === 'done'
      ? html`<button class="btn small gold" @click=${act((st) => claimGoal(st, g.id))}>Claim ${rewardChips(g)}</button>`
      : g.tab && status === 'active'
        ? html`<button class="btn small" @click=${act(() => (ui.tab = g.tab as TabId))}>Show me</button>`
        : ''}
    ${inBanner ? html`<button class="btn small" @click=${act(() => (ui.tab = 'goals'))}>All goals</button>` : ''}
  </div>`;
}

/** The goal strip at the top of every tab. Null when there's nothing left to show. */
export function goalBanner(s: GameState): TemplateResult | null {
  const g = currentGoal(s);
  if (!g) return null;
  const status = goalStatus(s, g);
  return html`<div class="view" style="margin-bottom:14px">
    <div class="goal-banner ${status}">
      <span class="goal-icon">${STATUS_ICON[status]}</span>
      <div class="goal-text">
        <div><b>${g.title}</b> <span class="dim">· ${g.chapter}</span></div>
        <div class="small">${status === 'done' ? 'Done! Claim your reward.' : g.how}</div>
        <div class="dim">${g.about}</div>
        ${progressBar(s, g, status)}
      </div>
      ${actions(g, status, true)}
    </div>
  </div>`;
}

export function goalsView(s: GameState): TemplateResult {
  const claimed = GOALS.filter((g) => goalStatus(s, g) === 'claimed').length;
  return html`<div class="view">
    ${sectionTitle('🎯 Goals', `${claimed} / ${GOALS.length} complete · each goal teaches one part of the game`)}
    ${bar(claimed / GOALS.length, '#f5c542')}
    ${GOAL_CHAPTERS.map((chapter) => {
      const goals = GOALS.filter((g) => g.chapter === chapter);
      const done = goals.filter((g) => goalStatus(s, g) === 'claimed').length;
      return html`<section class="col" style="gap:8px">
        <div class="row between"><h3>${chapter}</h3><span class="dim">${done} / ${goals.length}</span></div>
        <div class="goal-list">
          ${goals.map((g) => {
            const status = goalStatus(s, g);
            return html`<div class="goal-row ${status}">
              <span class="goal-icon">${STATUS_ICON[status]}</span>
              <div class="goal-text">
                <b>${g.title}</b>
                <div class="small">${status === 'locked' ? `Unlocks at level ${g.level}` : status === 'claimed' ? 'Completed' : g.how}</div>
                <div class="dim">${g.about}</div>
                ${progressBar(s, g, status)}
                ${status === 'active' || status === 'locked' ? html`<div class="row small"><span class="dim">Reward:</span>${rewardChips(g)}</div>` : ''}
              </div>
              ${actions(g, status, false)}
            </div>`;
          })}
        </div>
      </section>`;
    })}
  </div>`;
}
