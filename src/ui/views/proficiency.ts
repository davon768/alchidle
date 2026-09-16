import { html, type TemplateResult } from 'lit-html';
import type { GameState, Mods } from '../../core/types';
import { MILESTONES, PROFS, PROF_KIND_INFO, PROF_MAX, describeBonus, nextMilestone, profBonus, profProgress, type ProfKind } from '../../data/proficiency';
import { fmt } from '../../core/format';
import { act, bar, sectionTitle, ui } from '../common';

const KIND_COLOR: Record<ProfKind, string> = { plant: '#5fd068', potion: '#b57bff', reagent: '#4fb3ff', forge: '#ff9f43' };

export function proficiencyView(s: GameState, m: Mods): TemplateResult {
  const open = PROFS.filter((p) => p.level <= s.level);
  const shown = open.filter((p) => ui.profFilter === 'all' || p.kind === ui.profFilter);
  const lockedCount = PROFS.length - open.length;
  const totalLevels = open.reduce((a, p) => a + profProgress(s.prof[p.id] ?? 0).level, 0);
  const filters: ['all' | ProfKind, string][] = [['all', 'All'], ...(Object.entries(PROF_KIND_INFO) as [ProfKind, { name: string; icon: string }][]).map(([k, v]): ['all' | ProfKind, string] => [k, `${v.icon} ${v.name}`])];

  return html`<div class="view">
    ${sectionTitle('🎖️ Proficiency', html`Everything you grow, brew, scribe and forge levels 1–${PROF_MAX} by making it · gain ×${m.masteryRate.toFixed(2)}`)}
    <div class="card">
      <div class="row between">
        <span>Total proficiency: <b>${fmt(totalLevels)}</b> <span class="dim">/ ${fmt(open.length * PROF_MAX)} across ${open.length} unlocked crafts${lockedCount ? ` (${lockedCount} more unlock as you level)` : ''}</span></span>
        <span class="dim">Milestones every 10 levels · kept through the Great Work only with 🎖️ Muscle Memory</span>
      </div>
      ${bar(totalLevels / Math.max(1, open.length * PROF_MAX), '#f5c542')}
    </div>
    <div class="pill-tabs">${filters.map(([f, label]) => html`<button class="btn small ${ui.profFilter === f ? 'active' : ''}" @click=${act(() => (ui.profFilter = f))}>${label}</button>`)}</div>

    <div class="grid wide">
      ${shown.map((p) => {
        const pr = profProgress(s.prof[p.id] ?? 0);
        const next = nextMilestone(p.kind, pr.level);
        const color = KIND_COLOR[p.kind];
        return html`<div class="card ${pr.level >= PROF_MAX ? 'highlight' : ''}">
          <div class="row between">
            <h3>${p.icon} ${p.name}</h3>
            <span><b style="color:${color}">Lv ${pr.level}</b><span class="dim">/${PROF_MAX}</span></span>
          </div>
          ${bar(pr.into / pr.need, color, pr.level >= PROF_MAX ? 'Mastered' : `${fmt(pr.into)} / ${fmt(pr.need)} XP`)}
          <div class="dim">${PROF_KIND_INFO[p.kind].name} · ${fmt(p.xp * m.masteryRate)} XP ${PROF_KIND_INFO[p.kind].verb}</div>
          <div class="small">${next ? html`Next at <b>${next.level}</b>: ${next.label}` : html`<span class="good">🏆 All milestones earned</span>`}</div>
          <div class="ms-row">
            ${MILESTONES[p.kind].map((ms) => html`<span class="ms-pip ${pr.level >= ms.level ? 'on' : ''}" style="--pip:${color}" title=${`Lv ${ms.level}: ${ms.label}`}>${ms.level}</span>`)}
          </div>
          <div class="dim">Now: ${describeBonus(profBonus(p.kind, pr.level))}</div>
        </div>`;
      })}
    </div>
  </div>`;
}
