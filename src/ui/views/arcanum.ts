import { html, type TemplateResult } from 'lit-html';
import type { GameState, Mods } from '../../core/types';
import { REAGENTS, SPELLS, ritualEffects, spellRankMult, type SpellDef } from '../../data/spells';
import { item } from '../../data/items';
import { count, hasAll, profLevelOf } from '../../core/engine';
import { castRitual, craftReagent, learnSpell, manaMax, manaRegenRate, maxCraftable, rankUpCost, rankUpSpell, toggleAutoRitual, toggleSpellSlot } from '../../core/magic';
import { describeEffects } from '../../core/mods';
import { fmt, fmtTime } from '../../core/format';
import { act, bar, costChips, sectionTitle, ui } from '../common';

const BUFF_LABEL = { attackMult: 'attack', defenseMult: 'defense', critChance: 'crit chance', dodge: 'dodge', spellMult: 'spell power' };

export function describeSpell(sp: SpellDef, rank: number): string {
  const r = Math.max(1, rank);
  if (sp.ritual) return `${describeEffects(ritualEffects(sp, r))} for ${fmtTime(sp.ritual.duration)}`;
  const fx = sp.combat!;
  const pw = spellRankMult(r);
  const pct = (v: number) => `${Math.round(v * pw * 100)}%`;
  switch (fx.type) {
    case 'damage': return `Deals ${pct(fx.mult)} spell power${fx.slow ? `, slows for ${fx.slow}s` : ''}`;
    case 'drain': return `Deals ${pct(fx.mult)} spell power, heals ${Math.round(fx.heal * 100)}% of it`;
    case 'heal': return `Heals ${pct(fx.pct)} of max HP`;
    case 'shield': return `Shield worth ${pct(fx.pct)} of max HP`;
    case 'buff': return `+${pct(fx.value)} ${BUFF_LABEL[fx.stat]} for ${fx.duration}s`;
  }
}

function spellCard(s: GameState, m: Mods, sp: SpellDef): TemplateResult {
  const rank = s.spells[sp.id] ?? 0;
  const locked = s.level < sp.level;
  const equipped = s.spellSlots.includes(sp.id);
  const buff = s.buffs.find((b) => b.id === sp.id);
  const nextCost = rank > 0 && rank < sp.maxRank ? rankUpCost(sp, rank) : null;
  return html`<div class="card ${locked ? 'locked' : ''} ${equipped || buff ? 'highlight' : ''}">
    <div class="row between">
      <h3>${locked ? '🔒' : sp.icon} ${sp.name}</h3>
      <span class="dim">${sp.school} · ${rank > 0 ? `Rank ${rank}/${sp.maxRank}` : `Lv ${sp.level}`}</span>
    </div>
    <div class="muted small">${sp.desc}</div>
    <div class="small"><b>${describeSpell(sp, rank)}</b></div>
    <div class="dim">${sp.mana} mana${sp.cooldown ? ` · ${sp.cooldown}s cooldown` : ''}${nextCost ? ` · next rank: ${describeSpell(sp, rank + 1)}` : ''}</div>
    ${rank === 0
      ? html`<div class="row">${costChips(s, sp.learn)}</div>
          <button class="btn primary" ?disabled=${locked || !hasAll(s, sp.learn)} @click=${act((st) => learnSpell(st, sp.id))}>📘 Learn</button>`
      : html`
          ${nextCost ? html`<div class="row"><span class="dim">Rank up:</span>${costChips(s, nextCost)}
            <button class="btn small" ?disabled=${!hasAll(s, nextCost)} @click=${act((st) => rankUpSpell(st, sp.id))}>⬆ Rank ${rank + 1}</button></div>` : ''}
          ${sp.kind === 'combat'
            ? html`<button class="btn ${equipped ? 'on' : ''}" @click=${act((st) => toggleSpellSlot(st, sp.id))}>${equipped ? '✓ Equipped' : 'Equip'} (${s.spellSlots.length}/${Math.floor(m.spellSlots)})</button>`
            : html`<div class="row"><span class="dim">Cast cost:</span>${costChips(s, sp.ritual!.reagents)}<span class="chip ${s.mana < sp.mana ? 'lack' : ''}">🔷 ${sp.mana}</span></div>
              <div class="row">
                <button class="btn primary" @click=${act((st) => castRitual(st, sp.id))}>${buff ? `Recast (${fmtTime(buff.remaining)} left)` : 'Cast ritual'}</button>
                <button class="btn small ${s.autoRituals[sp.id] ? 'on' : ''}" ?disabled=${m.autoRitual <= 0} @click=${act((st) => toggleAutoRitual(st, sp.id))}>🔁 Auto ${s.autoRituals[sp.id] ? 'ON' : 'OFF'}</button>
              </div>`}`}
  </div>`;
}

export function arcanumView(s: GameState, m: Mods): TemplateResult {
  const mMax = manaMax(s, m);
  const spells = SPELLS.filter((sp) => sp.kind === ui.spellTab && sp.level <= s.level + 10);
  const reagents = REAGENTS.filter((r) => r.level <= s.level + 5);
  return html`<div class="view">
    ${sectionTitle('🔮 Arcanum', 'Combat spells fight for you in dungeons. Rituals empower your garden, cauldrons, shop and expeditions.')}
    <div class="card">
      ${bar(s.mana / mMax, undefined, `${fmt(Math.floor(s.mana))} / ${fmt(mMax)} mana · +${manaRegenRate(s, m).toFixed(1)}/s`, 'mana tall')}
      <div class="dim">Combat spells and rituals share one mana pool — Mana Draughts on your potion belt top it up in battle.
        ${m.autoRitual <= 0 ? ' Assign a Scribe apprentice to keep rituals running automatically.' : ` Your Scribes keep up to ${Math.floor(m.autoRitual)} ritual${Math.floor(m.autoRitual) > 1 ? 's' : ''} running.`}</div>
    </div>
    <div class="pill-tabs">
      <button class="btn small ${ui.spellTab === 'combat' ? 'active' : ''}" @click=${act(() => (ui.spellTab = 'combat'))}>⚔️ Combat spells</button>
      <button class="btn small ${ui.spellTab === 'ritual' ? 'active' : ''}" @click=${act(() => (ui.spellTab = 'ritual'))}>🕯️ Rituals</button>
    </div>
    <div class="grid wide">${spells.map((sp) => spellCard(s, m, sp))}</div>

    ${sectionTitle('🧪 Arcane Workbench', 'Craft spell reagents from herbs, expedition finds and dungeon drops')}
    <div class="grid">
      ${reagents.map((r) => {
        const def = item(r.id);
        const locked = r.level > s.level;
        const max = maxCraftable(s, r.inputs);
        return html`<div class="card ${locked ? 'locked' : ''}">
          <div class="row between"><h3>${locked ? '🔒' : def.icon} ${def.name}</h3><span class="dim">Owned ${fmt(Math.floor(count(s, r.id)))} · 🎖️ ${profLevelOf(s, r.id)}</span></div>
          <div class="row">${costChips(s, r.inputs)}</div>
          ${locked ? html`<div class="dim">Level ${r.level}</div>` : html`<div class="row">
            ${[1, 5].map((q) => html`<button class="btn small" ?disabled=${max < q} @click=${act((st) => craftReagent(st, r.id, q))}>×${q}</button>`)}
            <button class="btn small gold" ?disabled=${max < 1} @click=${act((st) => craftReagent(st, r.id, max))}>Max (${fmt(max)})</button>
          </div>`}
        </div>`;
      })}
    </div>
  </div>`;
}
