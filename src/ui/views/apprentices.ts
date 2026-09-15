import { html, type TemplateResult } from 'lit-html';
import type { GameState, Mods, RoleId } from '../../core/types';
import { APPRENTICE_MAX, APPR_ROW_POINTS, NAMES, ROLES, type ApprenticeNode } from '../../data/apprentices';
import { RESEARCH } from '../../data/research';
import {
  capacityOf, describeNode, nodeStatus, pointsFree, pointsSpent, progressOf, repushDelay,
} from '../../core/staff';
import { learnApprenticeNode, respecApprentice } from '../../core/actions';
import { fmt, fmtTime } from '../../core/format';
import { act, bar, sectionTitle } from '../common';

/** The Library study that brings a craft's apprentice in, so a locked card can say where to look. */
const studyFor = (role: RoleId) => RESEARCH.find((r) => r.unlocksRole === role);

function nodeButton(s: GameState, role: RoleId, node: ApprenticeNode): TemplateResult {
  const a = s.staff.crew[role]!;
  const rank = a.nodes[node.id] ?? 0;
  const status = nodeStatus(a, node, s.asc.count);
  const maxed = node.maxRank > 0 && rank >= node.maxRank;
  // A rebirth-gated talent is shown, not hidden: knowing what the next Great Work opens is the point.
  const rebirthLocked = !!node.minAsc && s.asc.count < node.minAsc;
  // The mark stays after it unlocks. These are the talents that hand a whole system over, they are what
  // a player is hunting for by the third or fourth rebirth, and a tier you can only identify while it is
  // still out of reach is no use at all.
  const judgement = !!node.minAsc;
  return html`<div class="appr-node ${maxed ? 'maxed' : status.ok ? 'ready' : 'locked'}">
    <div class="row between">
      <b class="small">${rebirthLocked ? '🌟' : node.icon} ${node.name}${judgement && !rebirthLocked ? html`<span class="tag-judgement" title="Judgement: this apprentice decides for themself">🌟</span>` : ''}</b>
      <span class="dim">${rank}${node.maxRank > 0 ? `/${node.maxRank}` : ' ∞'}</span>
    </div>
    <div class="small good">${describeNode(node, 1)}${node.maxRank !== 1 ? ' each' : ''}</div>
    ${rank > 0 ? html`<div class="dim">Now: ${describeNode(node, rank)}</div>` : ''}
    ${node.flavor ? html`<div class="dim">${node.flavor}</div>` : ''}
    ${rebirthLocked
      ? html`<div class="small warn">🌟 Opens after ${node.minAsc} Great Work${node.minAsc! > 1 ? 's' : ''} — you have done ${s.asc.count}.</div>`
      : ''}
    <button class="btn small ${status.ok ? 'primary' : ''}" ?disabled=${!status.ok}
      title=${status.reason} @click=${act((st) => learnApprenticeNode(st, role, node.id))}>
      ${maxed ? 'Fully learned' : rebirthLocked ? 'Not yet' : `${status.cost} point${status.cost > 1 ? 's' : ''}`}
    </button>
  </div>`;
}

export function staffView(s: GameState, _m: Mods): TemplateResult {
  const crew = ROLES.filter((r) => s.staff.crew[r.id]);
  const locked = ROLES.filter((r) => !s.staff.crew[r.id]);

  return html`<div class="view">
    ${sectionTitle('👥 Apprentices', html`${crew.length}/${ROLES.length} crafts staffed ·
      they level by doing the work, and every level is a skill point you choose where to spend`)}

    ${crew.length === 0
      ? html`<div class="card dim">Nobody yet. Apprentices are unlocked by study — start
          <b>A Gardener’s Hands</b> in the 📚 Library.</div>`
      : ''}

    ${crew.map((role) => {
      const a = s.staff.crew[role.id]!;
      const pr = progressOf(a);
      const free = pointsFree(a);
      const spent = pointsSpent(a);
      const rows = [...new Set(role.tree.map((n) => n.row))].sort((x, y) => x - y);
      return html`<div class="card">
        <div class="row between">
          <h3>${role.icon} ${NAMES[role.id]} <span class="dim">· ${role.name}</span></h3>
          <span class="dim">Lv ${pr.level}/${APPRENTICE_MAX} · tends ${fmt(capacityOf(a))} ${role.unit}${capacityOf(a) === 1 ? '' : 's'}</span>
        </div>
        <div class="muted small">${role.desc}</div>
        ${pr.level >= APPRENTICE_MAX
          ? html`<div class="small good">Has learned everything the work can teach.</div>`
          : bar(pr.into / pr.need, '#b57bff', `${fmt(Math.floor(pr.into))} / ${fmt(Math.ceil(pr.need))} xp to level ${pr.level + 1}`, 'tall')}
        <div class="row between">
          <span class=${free > 0 ? 'good' : 'dim'}><b>${free}</b> skill point${free === 1 ? '' : 's'} to spend${spent > 0 ? ` · ${spent} spent` : ''}</span>
          ${spent > 0 ? html`<button class="btn small" title="Refund every point in this tree, free"
            @click=${act((st) => respecApprentice(st, role.id))}>↺ Rethink</button>` : ''}
        </div>
        ${role.id === 'squire' && s.staff.crew.squire
          ? html`<div class="dim">Rallies you ${fmtTime(repushDelay(a))} after a retreat.</div>` : ''}
        ${rows.map((row) => {
          const need = row * APPR_ROW_POINTS;
          const open = spent >= need;
          return html`<div class="appr-row ${open ? '' : 'locked'}">
            ${row > 0 ? html`<div class="dim small">${open ? '' : `Spend ${need} points in this tree to open`}</div>` : ''}
            <div class="appr-grid">${role.tree.filter((n) => n.row === row).map((n) => nodeButton(s, role.id, n))}</div>
          </div>`;
        })}
      </div>`;
    })}

    ${locked.length
      ? html`${sectionTitle('🔒 Not yet staffed', 'Each craft has one apprentice, unlocked by a study in the Library')}
        <div class="grid wide">${locked.map((role) => {
          const study = studyFor(role.id);
          return html`<div class="card locked">
            <div class="row between"><h3>${role.icon} ${role.name}</h3>
              <span class="dim">${study ? `Level ${study.level}` : ''}</span></div>
            <div class="muted small">${role.desc}</div>
            ${study ? html`<div class="dim">Unlocked by <b>${study.icon} ${study.name}</b> in the 📚 Library.</div>` : ''}
          </div>`;
        })}</div>`
      : ''}
  </div>`;
}
