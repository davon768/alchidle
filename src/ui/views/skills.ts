import { html, type TemplateResult } from 'lit-html';
import type { GameState, Mods } from '../../core/types';
import { ROW_POINTS, SKILLS, SKILL_MAP, SKILL_TREES } from '../../data/skills';
import { skillPointsFree, skillPointsTotal } from '../../core/engine';
import { buySkill, pointsInTree, respec, respecCost, skillStatus } from '../../core/actions';
import { describeEffects } from '../../core/mods';
import { fmt } from '../../core/format';
import { act, closeModal, openModal, sectionTitle, ui } from '../common';

function confirmRespec(s: GameState): void {
  openModal(html`<div class="modal">
    <h2>Reset skill points?</h2>
    <p class="muted">All spent points are refunded so you can rebuild. Costs 🪙 ${fmt(respecCost(s))}.</p>
    <div class="row"><button class="btn danger" @click=${act((st) => { respec(st); closeModal(); })}>Reset</button>
    <button class="btn" @click=${closeModal}>Cancel</button></div>
  </div>`);
}

export function skillsView(s: GameState, m: Mods): TemplateResult {
  const tree = SKILL_TREES.find((t) => t.id === ui.skillTree) ?? SKILL_TREES[0];
  const nodes = SKILLS.filter((n) => n.tree === tree.id);
  const rows = [...new Set(nodes.map((n) => n.row))].sort((a, b) => a - b);
  const free = skillPointsFree(s, m);
  const spentHere = pointsInTree(s, tree.id);

  return html`<div class="view">
    ${sectionTitle('📜 Skill Trees', html`<b class=${free > 0 ? 'good' : ''}>${free}</b> free of ${skillPointsTotal(s, m)} points · 1 per level, +2 every 10th level`)}
    <div class="row between">
      <div class="pill-tabs">
        ${SKILL_TREES.map((t) => html`<button class="btn small ${t.id === tree.id ? 'active' : ''}" @click=${act(() => (ui.skillTree = t.id))}>
          ${t.icon} ${t.name} <span class="dim">${pointsInTree(s, t.id)}</span></button>`)}
      </div>
      <button class="btn small danger" @click=${() => confirmRespec(s)}>Respec</button>
    </div>
    <div class="muted small">${tree.desc} Each row needs ${ROW_POINTS} more points spent in this tree. Points here: <b>${spentHere}</b></div>

    <div class="skill-rows" style="--tree-color:${tree.color}">
      ${rows.map((row) => html`<div class="skill-row">
        <div class="row-label">${row === 0 ? 'Start' : `${row * ROW_POINTS} pts`}</div>
        <div class="nodes">
          ${nodes.filter((n) => n.row === row).map((n) => {
            const rank = s.skills[n.id] ?? 0;
            const st = skillStatus(s, n);
            const maxed = n.maxRank > 0 && rank >= n.maxRank;
            const rowLocked = spentHere < row * ROW_POINTS || (n.req ?? []).some((r) => (s.skills[r.id] ?? 0) < r.rank);
            const cls = maxed ? 'maxed' : st.ok ? 'avail' : rowLocked && rank === 0 ? 'locked' : '';
            return html`<div class="skill ${cls}" @click=${act((g) => buySkill(g, n.id))}>
              <div class="row between">
                <b>${n.icon} ${n.name}</b>
                <span class="dim">${rank}${n.maxRank > 0 ? `/${n.maxRank}` : ' ∞'}</span>
              </div>
              ${n.maxRank > 0 && n.maxRank <= 10 ? html`<div class="pips">${Array.from({ length: n.maxRank }, (_, i) => html`<span class="pip ${i < rank ? 'on' : ''}"></span>`)}</div>` : ''}
              <div class="small">${describeEffects(n.effects)}${n.maxRank !== 1 ? ' per rank' : ''}</div>
              ${n.flavor ? html`<div class="dim">${n.flavor}</div>` : ''}
              ${rank > 0 && n.maxRank !== 1 ? html`<div class="dim">Now: ${describeEffects(n.effects, rank)}</div>` : ''}
              ${n.req?.length ? html`<div class="dim">Needs: ${n.req.map((r) => `${SKILL_MAP[r.id].name} ${r.rank}`).join(', ')}</div>` : ''}
              <div class="small ${st.ok ? 'good' : 'muted'}">${maxed ? 'Maxed' : st.ok ? `Click to learn (${st.cost} pt${st.cost > 1 ? 's' : ''})` : st.reason}</div>
            </div>`;
          })}
        </div>
      </div>`)}
    </div>
  </div>`;
}
