import { html, type TemplateResult } from 'lit-html';
import type { GameState, Mods } from '../../core/types';
import { ZONES, ZONE_MAP, riftRewardMult } from '../../data/zones';
import { item } from '../../data/items';
import { expBaseTime } from '../../core/engine';
import { recall, startExpedition, toggleExpRepeat } from '../../core/actions';
import { fmt, fmtPct, fmtTime } from '../../core/format';
import { act, bar, sectionTitle } from '../common';

export function exploreView(s: GameState, m: Mods): TemplateResult {
  const freeSlot = s.expeditions.findIndex((e) => !e);
  return html`<div class="view">
    ${sectionTitle('🧭 Expeditions', html`${s.expeditions.length} part${s.expeditions.length > 1 ? 'ies' : 'y'} · loot is collected automatically`)}

    <div class="grid">
      ${s.expeditions.map((e, i) => {
        if (!e) return html`<div class="card"><h3>Party ${i + 1}</h3><div class="dim">Resting at camp. Send them somewhere below.</div></div>`;
        const z = ZONE_MAP[e.zoneId];
        const time = expBaseTime(s, z);
        return html`<div class="card">
          <div class="row between"><h3>${z.icon} ${z.name}</h3><span class="dim">Party ${i + 1}</span></div>
          ${bar(e.progress / time, '#4fb3ff', fmtTime((time - e.progress) / m.scavSpeed))}
          <div class="row">
            <button class="btn small ${e.repeat ? 'on' : ''}" ?disabled=${m.autoScav <= 0} @click=${act((st) => toggleExpRepeat(st, i))}>🔁 Repeat ${e.repeat ? 'ON' : 'OFF'}</button>
            <button class="btn small danger" @click=${act((st) => recall(st, i))}>Recall</button>
          </div>
        </div>`;
      })}
    </div>

    ${sectionTitle('🗺️ Destinations', `Speed ×${fmt(m.scavSpeed)} · Loot ×${fmt(m.scavYield)} · Rare finds ×${fmt(m.rareFind)}`)}
    <div class="grid wide">
      ${ZONES.map((z) => {
        const locked = z.level > s.level;
        const busy = s.expeditions.some((e) => e?.zoneId === z.id);
        const mult = z.endless ? riftRewardMult(s.riftDepth) : 1;
        return html`<div class="card ${locked ? 'locked' : ''}">
          <div class="row between">
            <h3>${locked ? '🔒' : z.icon} ${z.name}</h3>
            <span class="dim">${locked ? `Level ${z.level}` : fmtTime(expBaseTime(s, z) / m.scavSpeed)}</span>
          </div>
          <div class="muted small">${z.desc}</div>
          ${z.endless ? html`<div class="small">Depth <b>${s.riftDepth}</b> · rewards ×${fmt(mult)}</div>` : ''}
          <div class="row">
            ${z.drops.map((d) => html`<span class="chip" title=${d.id === 'gold' ? 'Gold' : item(d.id).name}>
              ${d.id === 'gold' ? '🪙' : item(d.id).icon} ${fmt(d.min * mult)}–${fmt(d.max * mult)}
              <span class="chip-have">${fmtPct(Math.min(1, d.chance * (d.rare ? m.rareFind : 1)))}</span>
            </span>`)}
          </div>
          <button class="btn primary" ?disabled=${locked || busy || freeSlot < 0}
            @click=${act((st) => startExpedition(st, st.expeditions.findIndex((e) => !e), z.id))}>
            ${busy ? 'Party exploring…' : freeSlot < 0 ? 'No free party' : 'Send party'}
          </button>
        </div>`;
      })}
    </div>
  </div>`;
}
