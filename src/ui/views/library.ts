import { html, type TemplateResult } from 'lit-html';
import type { GameState, Mods } from '../../core/types';
import { RESEARCH, RESEARCH_MAP, researchCost, researchTime } from '../../data/research';
import { researchActive, researchDone, researchStatus } from '../../core/engine';
import { cancelResearch, startResearch } from '../../core/actions';
import { fmtTime } from '../../core/format';
import { act, bar, costChips, sectionTitle } from '../common';
import { QUALITY_RESEARCH_BOOST } from '../../data/research';
import { QUAL_MAX } from '../../data/quality';

export function libraryView(s: GameState, m: Mods): TemplateResult {
  const desks = Math.floor(m.researchSlots);
  const queue = s.research.queue;
  const available = RESEARCH.filter((r) => r.level <= s.level);
  const finished = RESEARCH.filter((r) => researchDone(s, r.id) > 0 && !r.repeat);

  return html`<div class="view">
    ${sectionTitle('📚 Research Library', html`${queue.length}/${desks} desk${desks > 1 ? 's' : ''} in use ·
      studies keep running while you are away${m.researchSpeed > 1 ? html` · <span class="good">${Math.round(m.researchSpeed * 100)}% speed</span>` : ''}`)}

    <div class="grid wide">
      ${Array.from({ length: desks }, (_, i) => {
        const st = queue[i];
        const def = st ? RESEARCH_MAP[st.id] : null;
        if (!st || !def) {
          return html`<div class="card dim">
            <h3>Empty desk</h3>
            <div>Pick a study below. Long projects keep going while the game is closed.</div>
          </div>`;
        }
        const left = (st.time - st.progress) / Math.max(0.0001, m.researchSpeed);
        return html`<div class="card">
          <div class="row between"><h3>${def.icon} ${def.name}</h3><span class="dim">⏳ ${fmtTime(left)}</span></div>
          ${bar(st.progress / st.time, '#4fb3ff')}
          <div class="small muted">${def.desc}</div>
          <button class="btn small danger" @click=${act((g) => cancelResearch(g, i))}>Abandon</button>
        </div>`;
      })}
    </div>

    ${sectionTitle('🔖 Studies', 'Costs are paid when a study begins.')}
    <div class="card">
      <div class="row between">
        <div class="row">
          <span>Pay studies with your finest bottles:</span>
          <button class="btn small ${s.settings.fineStudies ? 'on' : ''}"
            @click=${act((g) => (g.settings.fineStudies = !g.settings.fineStudies))}>${s.settings.fineStudies ? 'ON' : 'OFF'}</button>
        </div>
        <span class="dim small">Up to −${Math.round(QUAL_MAX * QUALITY_RESEARCH_BOOST * 100)}% study time</span>
      </div>
      <div class="dim small">${s.settings.fineStudies
        ? 'Studies draw the highest quality potions you hold, and finish sooner for it. Your best bottles go to the Library instead of the Market.'
        : 'Studies draw your cheapest potions, so they keep your finest for selling — and get no time bonus. Turn this on to trade fine bottles for faster research.'}</div>
    </div>
    <div class="card table-wrap">
      <table class="table">
        <tr><th></th><th>Study</th><th>Cost</th><th>Time</th><th></th></tr>
        ${available.map((r) => {
          const done = researchDone(s, r.id);
          const status = researchStatus(s, m, r.id);
          const busy = researchActive(s, r.id);
          const complete = done > 0 && !r.repeat;
          return html`<tr style=${complete ? 'opacity:.5' : ''}>
            <td class="big-icon" style="font-size:20px">${r.icon}</td>
            <td>
              <b>${r.name}</b>${r.repeat ? html` <span class="dim">×${done}</span>` : ''}
              <div class="dim">${r.desc}</div>
            </td>
            <td><div class="row">${costChips(s, researchCost(r, done))}</div></td>
            <td>${fmtTime(researchTime(r, done) / Math.max(0.0001, m.researchSpeed))}</td>
            <td>${complete
              ? html`<span class="good">✓ Done</span>`
              : busy
                ? html`<span class="dim">In progress</span>`
                : html`<button class="btn small primary" ?disabled=${!status.ok} title=${status.reason}
                    @click=${act((g) => startResearch(g, r.id))}>Study</button>`}</td>
          </tr>`;
        })}
      </table>
    </div>

    ${finished.length
      ? html`${sectionTitle('✅ Completed', `${finished.length} of ${RESEARCH.filter((r) => !r.repeat).length} studies finished`)}
        <div class="card"><div class="row wrap">${finished.map((r) => html`<span class="chip" title=${r.desc}>${r.icon} ${r.name}</span>`)}</div></div>`
      : ''}
  </div>`;
}
