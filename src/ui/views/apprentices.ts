import { html, type TemplateResult } from 'lit-html';
import type { Apprentice, Effect, GameState, Mods, RoleId } from '../../core/types';
import {
  MASTER_XP, ROLES, ROLE_MAP, TALENTS, TRAIT_MAP, apprXpToNext, apprenticeCap, apprenticeCapacity, createApprentice, repushDelay,
} from '../../data/apprentices';
import {
  assignRole, dismiss, effectiveTrainRate, graduate, hire, hireCost, rerollCandidates, rerollCost, setMode, tuitionRate, workersOf,
} from '../../core/staff';
import { describeEffects } from '../../core/mods';
import { fmt, fmtTime } from '../../core/format';
import { act, bar, closeModal, gold, openModal, sectionTitle } from '../common';

const plural = (unit: string, n: number) => (n === 1 ? unit : unit === 'party' ? 'parties' : `${unit}s`);

function talentTag(t: number): TemplateResult {
  const T = TALENTS[t];
  return html`<span class="rank-tag" style="background:${T.color}33;color:${T.color}">${T.name}</span>`;
}

function traitChips(a: Apprentice): TemplateResult {
  return html`${a.traits.map((id) => {
    const t = TRAIT_MAP[id];
    return t ? html`<span class="chip" title=${t.desc}>${t.icon} ${t.name}</span>` : '';
  })}`;
}

function dutyText(a: Apprentice): string {
  if (!a.role) return 'No role — assign one to put them to work.';
  const n = apprenticeCapacity(a);
  switch (a.role) {
    case 'squire': return `Pushes deeper ${fmtTime(repushDelay(a))} after you recover from a retreat`;
    case 'shopkeeper': return `Auto-sells ${n} ${plural('potion type', n)}`;
    case 'scribe': return `Keeps ${n} ${plural('ritual', n)} running`;
    default: return `Tends ${n} ${plural(ROLE_MAP[a.role].unit, n)}`;
  }
}

function confirmGraduate(a: Apprentice): void {
  const r = ROLE_MAP[a.role!];
  const T = TALENTS[a.talent];
  openModal(html`<div class="modal">
    <h2>🎓 Graduate ${a.icon} ${a.name}?</h2>
    <p class="muted">${a.name} leaves your workshop for the Hall of Masters, freeing their slot.</p>
    <div>Permanent bonus: <b class="good">${describeEffects(r.master, T.master)}, +${Math.round(MASTER_XP * 100)}% apprentice XP</b></div>
    <div class="dim">Masters survive ascension. Until you train a replacement you lose ${a.name}'s current work: ${dutyText(a)}.</div>
    <div class="row">
      <button class="btn gold" @click=${act((st) => { graduate(st, a.id); closeModal(); })}>Graduate</button>
      <button class="btn" @click=${closeModal}>Keep them working</button>
    </div>
  </div>`);
}

function confirmDismiss(a: Apprentice): void {
  openModal(html`<div class="modal">
    <h2>Dismiss ${a.icon} ${a.name}?</h2>
    <p class="warn">They leave for good, with all their training. Hiring fees are not refunded.</p>
    <div class="row">
      <button class="btn danger" @click=${act((st) => { dismiss(st, a.id); closeModal(); })}>Dismiss</button>
      <button class="btn" @click=${closeModal}>Cancel</button>
    </div>
  </div>`);
}

function apprenticeCard(s: GameState, m: Mods, a: Apprentice): TemplateResult {
  const cap = apprenticeCap(a);
  const maxed = a.level >= cap;
  const role = a.role ? ROLE_MAP[a.role] : null;
  const reachable = role ? role.perks.filter((p) => p.level <= cap) : [];
  const earned = reachable.filter((p) => p.level <= a.level).length;
  const next = reachable.find((p) => p.level > a.level);
  const need = apprXpToNext(a.level);
  const tuition = tuitionRate(a);
  return html`<div class="card ${maxed ? 'highlight' : ''}">
    <div class="row between"><h3>${a.icon} ${a.name}</h3>${talentTag(a.talent)}</div>
    <div class="row">${traitChips(a)}</div>
    <div class="row between small">
      <b>Level ${a.level}<span class="dim"> / ${cap}</span></b>
      <span class="dim">${a.mode === 'train' ? '📚 Studying' : role ? `${role.icon} ${role.name}` : 'Idle'}</span>
    </div>
    ${bar(maxed ? 1 : a.xp / need, TALENTS[a.talent].color, maxed ? 'Ready to graduate' : `${fmt(a.xp)} / ${fmt(need)} XP`)}
    <select @change=${(e: Event) => act((st) => assignRole(st, a.id, ((e.target as HTMLSelectElement).value || null) as RoleId | null))(e)}>
      <option value="" ?selected=${!a.role}>— No role —</option>
      ${ROLES.map((r) => html`<option value=${r.id} ?selected=${a.role === r.id} ?disabled=${s.level < r.level}>${r.icon} ${r.name}${s.level < r.level ? ` (level ${r.level})` : ''}</option>`)}
    </select>
    <div class="small ${a.role ? '' : 'warn'}">${dutyText(a)}${a.role && a.mode === 'train' ? ' — paused while studying' : ''}</div>
    <div class="row">
      <button class="btn small ${a.mode === 'work' ? 'on' : ''}" @click=${act((st) => setMode(st, a.id, 'work'))}>🛠️ Work</button>
      <button class="btn small ${a.mode === 'train' ? 'on' : ''}" ?disabled=${maxed} @click=${act((st) => setMode(st, a.id, 'train'))}>📚 Study</button>
    </div>
    ${a.mode === 'train' && !maxed
      ? html`<div class="dim ${s.gold < tuition ? 'warn' : ''}">+${effectiveTrainRate(s, m, a).toFixed(2)} XP/s · tuition ${gold(tuition)}/s${s.gold < tuition ? " — can't afford, paused" : ''}</div>`
      : html`<div class="dim">Earns XP from the work they do. Studying is faster but costs tuition.</div>`}
    ${role ? html`<div class="dim">Perks ${earned}/${reachable.length}${next ? ` · next at ${next.level}: ${describeEffects(next.effects)}` : ''}</div>` : ''}
    <div class="row">
      ${maxed ? html`<button class="btn small gold" ?disabled=${!a.role} @click=${() => confirmGraduate(a)}>🎓 Graduate</button>` : ''}
      <button class="btn small danger" @click=${() => confirmDismiss(a)}>Dismiss</button>
    </div>
  </div>`;
}

function candidateCard(s: GameState, a: Apprentice, i: number, full: boolean): TemplateResult {
  const cost = hireCost(s, a);
  return html`<div class="card">
    <div class="row between"><h3>${a.icon} ${a.name}</h3>${talentTag(a.talent)}</div>
    <div class="row">${traitChips(a)}</div>
    <div class="dim">Potential: level ${apprenticeCap(a)} · learns ×${TALENTS[a.talent].xp}</div>
    <button class="btn primary" ?disabled=${full || s.gold < cost} @click=${act((st) => hire(st, i))}>${full ? 'No free slot' : html`Hire · 🪙 ${fmt(cost)}`}</button>
  </div>`;
}

function mastersSection(s: GameState): TemplateResult {
  const merged: Record<string, Effect> = {};
  for (const ms of s.staff.masters) {
    for (const e of ROLE_MAP[ms.role].master) (merged[e.stat] ??= { stat: e.stat, value: 0 }).value += e.value * TALENTS[ms.talent].master;
  }
  const n = s.staff.masters.length;
  return html`${sectionTitle('🏛️ Hall of Masters', `${n} graduate${n === 1 ? '' : 's'} · permanent bonuses that survive ascension`)}
    <div class="card">
      ${n
        ? html`<div class="small">Total: <b class="good">${describeEffects(Object.values(merged))}, +${Math.round(n * MASTER_XP * 100)}% apprentice XP</b></div>
            <div class="row">${s.staff.masters.map((ms) => html`<span class="chip" title=${`${TALENTS[ms.talent].name} Master ${ROLE_MAP[ms.role].name}`}>${ms.icon} ${ms.name} ${ROLE_MAP[ms.role].icon}</span>`)}</div>`
        : html`<div class="dim">Train an apprentice to their level cap, then graduate them for a permanent bonus. Every master also mentors your future apprentices (+${Math.round(MASTER_XP * 100)}% apprentice XP each).</div>`}
    </div>`;
}

function roleGuide(s: GameState): TemplateResult {
  const levels = [1, 10, 25, 50];
  return html`${sectionTitle('📘 Roles', 'Each role automates one system and grows with training')}
    <div class="card table-wrap"><table class="table">
      <tr><th>Role</th><th>Duty</th><th>Handles at level 1 / 10 / 25 / 50</th><th>First perks (every 5 levels)</th></tr>
      ${ROLES.map((r) => html`<tr style=${s.level < r.level ? 'opacity:.45' : ''}>
        <td><b>${r.icon} ${r.name}</b>${s.level < r.level ? html`<div class="dim">Unlocks at level ${r.level}</div>` : ''}</td>
        <td class="small">${r.desc}</td>
        <td class="small">${r.id === 'squire'
          ? `re-push after ${levels.map((L) => fmtTime(repushDelay(createApprentice('', '', '', 0, [], 'squire', L)))).join(' / ')}`
          : `${levels.map((L) => r.capacity(L)).join(' / ')} ${plural(r.unit, 2)}`}</td>
        <td class="dim">${r.perks.slice(0, 3).map((p) => `${p.level}: ${describeEffects(p.effects)}`).join(' · ')} …</td>
      </tr>`)}
    </table></div>`;
}

export function staffView(s: GameState, m: Mods): TemplateResult {
  const slots = Math.floor(m.apprenticeSlots);
  const full = s.staff.hired.length >= slots;
  const reroll = rerollCost(s);
  return html`<div class="view">
    ${sectionTitle('👥 Apprentices', html`${s.staff.hired.length}/${slots} slots · hire, train and graduate apprentices to run your workshop`)}
    <div class="card">
      <div class="row">
        <span class="chip">🧑‍🌾 ${fmt(Math.floor(m.autoHarvest))} plots</span>
        <span class="chip">🧑‍🔬 ${fmt(Math.floor(m.autoBrew))} cauldrons</span>
        <span class="chip">🧝 ${fmt(Math.floor(m.autoScav))} parties</span>
        <span class="chip">🧑‍💼 ${fmt(Math.floor(m.autoSell))} auto-sell</span>
        <span class="chip">🧙 ${fmt(Math.floor(m.autoRitual))} rituals</span>
        <span class="chip">🤺 ${workersOf(s, 'squire').length ? 'squire on duty' : 'no squire'}</span>
      </div>
      <div class="dim">Apprentice XP ×${m.apprenticeXp.toFixed(2)} · studying speed also rises with your own proficiency in that craft</div>
    </div>
    ${s.staff.hired.length
      ? html`<div class="grid wide">${s.staff.hired.map((a) => apprenticeCard(s, m, a))}</div>`
      : html`<div class="card dim">No apprentices yet — hire one below. A Gardener or Brewer makes a great first hire.</div>`}

    ${sectionTitle('📋 Candidates', html`New applicants in ${fmtTime(s.staff.refresh)}`)}
    <div class="row">
      <button class="btn small" ?disabled=${s.gold < reroll} @click=${act(rerollCandidates)}>🔄 Call new applicants (🪙${fmt(reroll)})</button>
      ${full ? html`<span class="dim">All slots full — build Apprentice Quarters in the 🔨 Workshop, or graduate someone.</span>` : ''}
    </div>
    <div class="grid wide">${s.staff.candidates.map((a, i) => candidateCard(s, a, i, full))}</div>

    ${mastersSection(s)}
    ${roleGuide(s)}
  </div>`;
}
