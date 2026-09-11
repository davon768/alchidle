import { html, type TemplateResult } from 'lit-html';
import type { Contract, GameState, Mods } from '../../core/types';
import { GUILDS, GUILD_MAP, GUILD_UNLOCK_LEVEL, rankFor, rankName, rankThreshold } from '../../data/guilds';
import { RECIPE_MAP } from '../../data/recipes';
import { DUNGEON_MAP } from '../../data/combat';
import { count } from '../../core/engine';
import { deliver, joinGuild, rerollContract, rerollCost } from '../../core/actions';
import { describeEffects } from '../../core/mods';
import { fmt } from '../../core/format';
import { act, bar, chip, closeModal, gold, openModal, sectionTitle } from '../common';

function confirmSwitch(id: string): void {
  const g = GUILD_MAP[id];
  openModal(html`<div class="modal">
    <h2>Switch to ${g.icon} ${g.name}?</h2>
    <p class="muted">Leaving your current guild forfeits <b>all</b> of your reputation and rank perks. This cannot be undone.</p>
    <div class="row"><button class="btn danger" @click=${act((s) => { joinGuild(s, id); closeModal(); })}>Leave and join</button>
    <button class="btn" @click=${closeModal}>Stay</button></div>
  </div>`);
}

function contractCard(s: GameState, m: Mods, c: Contract, i: number, color: string, rerollPrice: number): TemplateResult {
  const reward = html`<div class="row">Reward: ${gold(c.gold * m.contractReward)} <span class="chip">🛡️ ${fmt(c.rep * m.repGain)} rep</span></div>`;
  const reroll = html`<button class="btn small" ?disabled=${s.gold < rerollPrice} @click=${act((st) => rerollContract(st, i))}>🔄 🪙${fmt(rerollPrice)}</button>`;
  if (c.kind === 'slay') {
    const d = DUNGEON_MAP[c.dungeonId ?? ''];
    const done = c.delivered >= c.qty;
    return html`<div class="card ${done ? 'highlight' : ''}">
      <div class="row between"><h3>⚔️ Bounty: ${d?.icon} ${d?.name}</h3><span class="muted">${c.delivered}/${c.qty}</span></div>
      ${bar(c.delivered / c.qty, color)}
      ${reward}
      <div class="row">
        <button class="btn primary" ?disabled=${!done} @click=${act((st) => deliver(st, i))}>${done ? 'Claim bounty' : 'Hunting…'}</button>
        ${reroll}
      </div>
      <div class="dim">Every monster you slay in ${d?.name} counts automatically.</div>
    </div>`;
  }
  const r = RECIPE_MAP[c.recipeId];
  const have = count(s, c.recipeId);
  return html`<div class="card">
    <div class="row between"><h3>${r.icon} ${r.name}</h3><span class="muted">${c.delivered}/${c.qty}</span></div>
    ${bar(c.delivered / c.qty, color)}
    ${reward}
    <div class="row">
      <button class="btn primary" ?disabled=${have < 1} @click=${act((st) => deliver(st, i))}>Deliver (${fmt(Math.floor(have))} owned)</button>
      ${reroll}
    </div>
    <div class="dim">Needs ${chip({ id: c.recipeId, qty: c.qty - c.delivered }, have)}</div>
  </div>`;
}

export function guildView(s: GameState, m: Mods): TemplateResult {
  if (s.level < GUILD_UNLOCK_LEVEL) {
    return html`<div class="view">${sectionTitle('🛡️ Guilds')}<div class="card">Guilds accept members from level ${GUILD_UNLOCK_LEVEL}.</div></div>`;
  }
  const g = s.guild.id ? GUILD_MAP[s.guild.id] : null;

  if (!g) {
    return html`<div class="view">
      ${sectionTitle('🛡️ Choose a Guild', 'You can belong to one guild at a time. Each has its own perks and milestone rewards.')}
      <div class="grid wide">${GUILDS.map((gd) => html`<div class="card" style="border-color:${gd.color}">
        <h3>${gd.icon} ${gd.name}</h3>
        <div class="muted small">${gd.desc}</div>
        <div class="small">Per rank: <b>${describeEffects(gd.perRank)}</b></div>
        ${gd.milestones.map((ms) => html`<div class="small dim">${rankName(ms.rank)}: ${ms.label}</div>`)}
        <button class="btn primary" @click=${act((st) => joinGuild(st, gd.id))}>Join</button>
      </div>`)}</div>
    </div>`;
  }

  const rank = rankFor(s.guild.rep);
  const cur = rankThreshold(rank);
  const next = rankThreshold(rank + 1);
  const rc = rerollCost(s);

  return html`<div class="view">
    ${sectionTitle(`${g.icon} ${g.name}`, g.desc)}
    <div class="card" style="border-color:${g.color}">
      <div class="row between"><h3>Rank: ${rankName(rank)}</h3><span class="muted">${fmt(s.guild.rep)} reputation</span></div>
      ${bar((s.guild.rep - cur) / (next - cur), g.color, `${fmt(s.guild.rep - cur)} / ${fmt(next - cur)} to ${rankName(rank + 1)}`)}
      <div class="small">Current perks: <b>${rank > 0 ? describeEffects(g.perRank, rank) : 'none yet — rank up to earn perks'}</b></div>
      <div class="row">${g.milestones.map((ms) => html`<span class="chip ${rank >= ms.rank ? '' : 'lack'}">${rank >= ms.rank ? '✅' : '🔒'} ${rankName(ms.rank)}: ${ms.label}</span>`)}</div>
    </div>

    ${sectionTitle('📜 Contracts', html`Gold ×${m.contractReward.toFixed(2)} · Reputation ×${m.repGain.toFixed(2)}`)}
    <div class="grid wide">${s.guild.contracts.map((c, i) => contractCard(s, m, c, i, g.color, rc))}</div>

    ${sectionTitle('Other guilds')}
    <div class="row">${GUILDS.filter((o) => o.id !== g.id).map((o) => html`<button class="btn small" @click=${() => confirmSwitch(o.id)}>${o.icon} ${o.name}</button>`)}</div>
  </div>`;
}
