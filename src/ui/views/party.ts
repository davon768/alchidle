import { html, type TemplateResult } from 'lit-html';
import type { GameState, Mods } from '../../core/types';
import { CLASSES, CLASS_MAP, ADV_MAX, advProgress, delveGold, hireCost, isBossDepth } from '../../data/adventurers';
import { RELIC_MAP, relicEffects } from '../../data/relics';
import { RECIPES, RECIPE_MAP, describeCombatEffect } from '../../data/recipes';
import { RESEARCH_MAP, type ResearchDef } from '../../data/research';
import { count, potionPotency, researchDone } from '../../core/engine';
import { canDelve, canHire, dismissAdventurer, hireAdventurer, nextDepth, partyReport, setKit, startDelve, suppliable } from '../../core/party';
import { delveOdds, delveReq } from '../../data/adventurers';
import { describeEffects } from '../../core/mods';
import { quality } from '../../data/quality';
import { fmt, fmtPct, fmtTime } from '../../core/format';
import { act, bar, costChips, sectionTitle, ui } from '../common';

/** The whole chain of studies that ends at the charter, so the wait is legible rather than mysterious. */
function charterChain(s: GameState): { def: ResearchDef; done: boolean; open: boolean }[] {
  const chain: string[] = [];
  const walk = (id: string) => {
    const def = RESEARCH_MAP[id];
    if (!def) return;
    for (const r of def.req ?? []) walk(r);
    if (!chain.includes(id)) chain.push(id);
  };
  walk('company');
  return chain.map((id) => {
    const def = RESEARCH_MAP[id];
    const done = researchDone(s, id) > 0;
    return { def, done, open: !done && def.level <= s.level && (def.req ?? []).every((r) => researchDone(s, r) > 0) };
  });
}

function lockedCard(s: GameState): TemplateResult {
  const chain = charterChain(s);
  const charter = RESEARCH_MAP['company'];
  const next = chain.find((x) => !x.done);
  return html`<div class="card">
    <h3>🏕️ No company yet</h3>
    <div class="muted small">Adventurers sign articles, not contracts of employment. The charter is a study:
      finish <b>${charter.icon} ${charter.name}</b> in the 📚 Library and the roster opens — and your Captain
      comes with it, so the company can keep delving while you work.</div>
    <div class="col" style="gap:4px">
      ${chain.map((x) => html`<div class="small ${x.done ? 'good' : x.open ? '' : 'dim'}">
        ${x.done ? '✅' : x.open ? '📖' : '🔒'} ${x.def.icon} ${x.def.name}
        <span class="dim">· level ${x.def.level}${x.done ? ' · done' : x.def.level > s.level ? ` (you are ${s.level})` : ''}</span>
      </div>`)}
    </div>
    <div class="row"><span class="small muted">Charter costs:</span>${costChips(s, charter.cost)}</div>
    <div class="dim small">🏺 Relics turn up on expeditions from the Old Forest onwards, and far more often in the Sunken Ruins.</div>
    <button class="btn primary" @click=${act(() => (ui.tab = next && next.def.level > s.level ? 'goals' : 'library'))}>
      ${next && next.def.level > s.level ? `Level ${next.def.level} needed — see Goals` : 'Open the Library'}</button>
  </div>`;
}

function rosterCard(a: { uid: string; cls: string; xp: number; rest: number }, busy: boolean): TemplateResult {
  const cls = CLASS_MAP[a.cls];
  const p = advProgress(a.xp);
  const hurt = a.rest > 0;
  return html`<div class="card ${hurt ? 'locked' : ''}">
    <div class="row between">
      <h3>${cls.icon} ${cls.name}</h3>
      <span class="dim">Lv ${p.level}${p.level >= ADV_MAX ? ' · max' : ''}</span>
    </div>
    <div class="muted small">${cls.desc}</div>
    ${p.level >= ADV_MAX ? '' : bar(p.into / p.need, '#4fb3ff', `${fmt(Math.floor(p.into))} / ${fmt(p.need)} XP`)}
    <div class="small">Power <b>${fmt(Math.round(cls.power * (1 + 0.14 * (p.level - 1))))}</b> · guard ×${cls.guard}</div>
    ${hurt
      ? html`<div class="warn small">🩹 Resting — back in ${fmtTime(a.rest)}</div>`
      : html`<div class="dim">${cls.flavor}</div>`}
    <button class="btn small danger" ?disabled=${busy} title=${busy ? 'Not while they are down the Rift' : 'They keep their levels; you do not'}
      @click=${act((st) => dismissAdventurer(st, a.uid))}>Let go</button>
  </div>`;
}

function kitSection(s: GameState, m: Mods): TemplateResult {
  const report = partyReport(s, m);
  const options = RECIPES.filter((r) => suppliable(r.id));
  return html`<div class="card">
    <div class="row between">
      <h3>🎒 Supply kit</h3>
      <span class="dim">+${fmtPct(report.supply)} party power</span>
    </div>
    <div class="muted small">Each delve drinks one bottle of every kitted potion per adventurer, and another round for every ten depths — finest bottles first.
      Quality is the difference: a ★ Legendary tonic is worth more than twice a Common one down there.</div>
    <div class="grid">
      ${report.slots.map((slot, i) => {
        const r = slot.id ? RECIPE_MAP[slot.id] : null;
        const short = !!r && slot.have < slot.need;
        return html`<div class="card">
          <div class="row between"><b>Slot ${i + 1}</b>${r ? html`<span class="dim">${fmt(Math.floor(count(s, r.id)))} in store</span>` : ''}</div>
          <select @change=${(e: Event) => act((st) => setKit(st, i, (e.target as HTMLSelectElement).value || null))(e)}>
            <option value="" ?selected=${!slot.id}>— empty —</option>
            ${options.map((o) => html`<option value=${o.id} ?selected=${slot.id === o.id}>${o.icon} ${o.name}</option>`)}
          </select>
          ${r ? html`
            <div class="small ${short ? 'warn' : 'good'}">${short
              ? `Needs ${slot.need} bottle${slot.need > 1 ? 's' : ''} — ${slot.have} on hand`
              : `${slot.need} × ${quality(slot.tier).mark || 'Common'} ready · +${fmtPct(slot.add)} power`}</div>
            <div class="dim small">${(r.combat ?? []).map((f) => describeCombatEffect(f, potionPotency(s, m, r.id, slot.tier))).join(' · ')}</div>`
            : html`<div class="dim small">Any potion with a combat effect can go in the kit.</div>`}
        </div>`;
      })}
    </div>
  </div>`;
}

function delveCard(s: GameState, m: Mods): TemplateResult {
  const report = partyReport(s, m);
  const depth = nextDepth(s);
  const d = s.party.delve;
  const req = delveReq(depth);
  const odds = delveOdds(report.power, depth);
  const boss = isBossDepth(depth);
  if (d) {
    const left = d.time - d.progress;
    return html`<div class="card highlight">
      <div class="row between"><h3>🌀 Delving — depth ${d.depth}${isBossDepth(d.depth) ? ' · BOSS' : ''}</h3>
        <span class="dim">${fmtPct(delveOdds(d.power, d.depth))} odds</span></div>
      ${bar(d.progress / d.time, '#a06cf0', fmtTime(left))}
      <div class="small">Descended with <b>${fmt(Math.round(d.power))}</b> power and ${d.supplied} supply slot${d.supplied === 1 ? '' : 's'} filled.</div>
      <div class="dim">Nothing to do but wait. Whatever happens, they come back.</div>
    </div>`;
  }
  return html`<div class="card">
    <div class="row between"><h3>🌀 Next descent — depth ${depth}${boss ? ' · BOSS' : ''}</h3>
      <span class="dim ${odds > 0.7 ? 'good' : odds < 0.4 ? 'warn' : ''}">${fmtPct(odds)} odds</span></div>
    ${boss ? html`<div class="goal">👹 A boss holds this depth: far stronger, but the only sure source of a relic.</div>` : ''}
    <div class="small">Party power <b>${fmt(Math.round(report.power))}</b> vs <b>${fmt(Math.round(req))}</b> demanded
      · haul ×${fmt(report.haul)} · pays about ${fmt(delveGold(depth))} gold</div>
    ${bar(report.power / req, odds > 0.7 ? '#5fd068' : '#f5c542')}
    <div class="dim small">${report.ready.length} of ${s.party.roster.length} ready · base ${fmt(Math.round(report.base))} power, supplies +${fmtPct(report.supply)}</div>
    <div class="row">
      <button class="btn primary" ?disabled=${!canDelve(s, m)}
        title=${!canDelve(s, m) ? 'Every adventurer is resting, or you have none' : `Depth ${depth}`}
        @click=${act((st) => startDelve(st, m))}>Descend</button>
      <button class="btn small ${s.party.repeat ? 'on' : ''}" ?disabled=${m.autoDelve < 1}
        title=${m.autoDelve < 1 ? 'Needs your Captain — unlocked with the company charter' : 'Your Captain resupplies and marches them straight back down'}
        @click=${act((st) => (st.party.repeat = !st.party.repeat))}>🔁 Repeat ${s.party.repeat ? 'ON' : 'OFF'}</button>
    </div>
  </div>`;
}

export function partyView(s: GameState, m: Mods): TemplateResult {
  const slots = Math.floor(m.partySlots);
  const relics = Object.entries(s.party.relics).filter(([id, r]) => RELIC_MAP[id] && r > 0);
  const chartered = slots >= 1 || s.party.roster.length > 0;
  return html`<div class="view">
    ${sectionTitle('🏕️ The Company', chartered
      ? html`Deepest cleared: <b>${s.party.depth}</b> · ${s.party.roster.length} / ${slots} adventurers · ${fmt(s.stats.delves)} delves run`
      : 'Heroes you hire, supply from your own cauldrons, and send down the Endless Rift.')}

    ${!chartered ? lockedCard(s) : html`
      ${delveCard(s, m)}
      ${kitSection(s, m)}

      ${sectionTitle('🗡️ Roster', 'Adventurers level by delving. Injuries heal on their own — nobody is ever lost.')}
      <div class="grid">${s.party.roster.map((a) => rosterCard(a, !!s.party.delve))}</div>

      ${s.party.roster.length < slots ? html`
        ${sectionTitle('📝 Take on an adventurer', `Next signing fee: 🪙 ${fmt(hireCost(s.party.roster.length))} — every one after costs far more`)}
        <div class="grid">
          ${CLASSES.map((c) => html`<div class="card">
            <div class="row between"><h3>${c.icon} ${c.name}</h3><span class="dim">${c.power} power</span></div>
            <div class="muted small">${c.desc}</div>
            <div class="dim small">Guard ×${c.guard}${c.haul ? ` · +${fmtPct(c.haul)} haul` : ''}${c.relicLuck ? ` · +${fmtPct(c.relicLuck)} relic chance` : ''}${c.mend ? ` · −${fmtPct(c.mend)} rest` : ''}</div>
            <button class="btn gold" ?disabled=${!canHire(s, m)} @click=${act((st) => hireAdventurer(st, c.id))}>
              🪙 ${fmt(hireCost(s.party.roster.length))}</button>
          </div>`)}
        </div>` : html`<div class="card dim">Every seat on the charter is filled. Train your Captain or finish The Deep Writ to widen it.</div>`}

      ${sectionTitle('🏺 Relics', relics.length
        ? 'Permanent, stacking, and yours through every ascension.'
        : 'Rift bosses guard one every tenth depth. You have none yet.')}
      <div class="grid">
        ${relics.map(([id, rank]) => {
          const def = RELIC_MAP[id];
          return html`<div class="card highlight">
            <div class="row between"><h3>${def.icon} ${def.name}</h3><span class="dim">Rank ${rank}</span></div>
            <div class="muted small">${def.desc}</div>
            <div class="small good">${describeEffects(relicEffects(def, rank))}</div>
            <div class="dim">${def.flavor}</div>
          </div>`;
        })}
      </div>`}
  </div>`;
}
