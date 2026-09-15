import { html, type TemplateResult } from 'lit-html';
import type { GameState, Mods } from '../../core/types';
import {
  ASC_GOLD_GROWTH, ASC_NODES, STONE_RESONANCE, ascCost, ascGoldTarget, ascStatus, startGoldFor,
  stoneBreakdown, stonesFor,
} from '../../data/ascension';
import { ascend, buyAscNode } from '../../core/actions';
import { describeEffects } from '../../core/mods';
import { game } from '../../core/game';
import { saveGame } from '../../core/save';
import { toast } from '../../core/engine';
import { fmt, fmtPct } from '../../core/format';
import { act, bar, closeModal, openModal, refresh, sectionTitle, ui } from '../common';

function confirmAscend(stones: number): void {
  openModal(html`<div class="modal">
    <h2>🌟 Perform the Magnum Opus?</h2>
    <p>You will gain <b class="gold-text">${fmt(stones)} Philosopher's Stones</b>.</p>
    <div class="small"><b>Resets:</b> gold, items, level, skills, workshop upgrades, garden, cauldrons, expeditions, guild membership, Rift depth.</div>
    <div class="small"><b>Keeps:</b> Philosopher's Stones & ascension perks, proficiency, achievements, lifetime stats, settings.</div>
    <div class="row">
      <button class="btn gold" @click=${() => {
        const next = ascend(game.s);
        if (next) {
          game.s = next;
          saveGame(next);
          ui.tab = 'ascend';
          toast(`🌟 The Great Work is complete. +${fmt(stones)} Philosopher's Stones.`, 'epic');
        }
        closeModal();
        refresh();
      }}>Ascend</button>
      <button class="btn" @click=${closeModal}>Not yet</button>
    </div>
  </div>`);
}

/**
 * Why this Great Work is worth what it is. The formula weighs every system, so the screen has to show
 * that — a single number would leave the whole point invisible.
 */
function stonePanel(s: GameState, m: Mods): TemplateResult {
  const { sources, total } = stoneBreakdown(s, m.stoneGain);
  const earned = sources.filter((x) => x.stones > 0.004).sort((a, b) => b.stones - a.stones);
  const missing = sources.filter((x) => x.stones <= 0.004);
  return html`<div class="card">
    <div class="row between">
      <h3>💎 What this run is worth</h3>
      <span class="dim">${total.toFixed(2)} stones before rounding</span>
    </div>
    <div class="muted small">Every system counts, each on its own curve — twice the work is about 1.4× the
      stones, never 2×. Breadth pays more than depth in any one thing.</div>
    <div class="col" style="gap:4px">
      ${earned.map((x) => html`<div class="ledger-row">
        <span class="ledger-name">${x.icon} ${x.label}</span>
        ${bar(Math.min(1, x.stones / Math.max(0.001, earned[0].stones)), undefined, '', 'tall')}
        <span class="ledger-num">${fmt(Math.round(x.amount))}</span>
        <span class="dim ledger-pct">+${x.stones.toFixed(2)}</span>
      </div>`)}
    </div>
    ${missing.length
      ? html`<div class="dim small">Nothing yet from: ${missing.map((x) => `${x.icon} ${x.label}`).join(' · ')}.
          Any of them would add to the next Great Work.</div>`
      : html`<div class="small good">Every strand of the work contributed to this one.</div>`}
  </div>`;
}

export function ascendView(s: GameState, m: Mods): TemplateResult {
  const gain = stonesFor(s, m.stoneGain);
  const need = ascStatus(s);
  return html`<div class="view">
    ${sectionTitle('🌟 Magnum Opus', 'Reset your run to earn Philosopher\'s Stones — permanent power that makes every future run faster.')}
    <div class="card highlight">
      <div class="row between">
        <h3>💎 ${fmt(s.asc.stones)} Philosopher's Stones</h3>
        <span class="muted">Ascensions: ${s.asc.count} · next asks ${fmt(ascGoldTarget(s.asc.count))}</span>
      </div>
      <div class="small">Stone resonance: every stone ever earned gives +${fmtPct(STONE_RESONANCE)} sell price — even after you spend it. Currently <b class="good">+${fmtPct(STONE_RESONANCE * s.asc.total)}</b> from ${fmt(s.asc.total)} lifetime stones.</div>
      ${need.ok
        ? html`<div>Ascending now grants <b class="gold-text">${fmt(gain)}</b> stones (${fmt(s.stats.runGold)} gold earned this run).</div>
            <button class="btn gold" @click=${() => confirmAscend(gain)}>🌟 Ascend</button>`
        : html`${bar(s.stats.runGold / need.goldNeed, '#f5c542', `${fmt(s.stats.runGold)} / ${fmt(need.goldNeed)} gold earned this run`)}
            ${s.level < need.levelNeed
              ? bar(s.level / need.levelNeed, '#4fb3ff', `level ${s.level} / ${need.levelNeed}`)
              : ''}
            <div class="dim">The Great Work asks for level ${need.levelNeed} and ${fmt(need.goldNeed)} gold in a single run.
              Stones scale with the square root of gold earned, and every Great Work after this one asks for
              ${ASC_GOLD_GROWTH}× the gold and three more levels — because so much of what earns that gold is permanent.</div>`}
    </div>

    ${stonePanel(s, m)}

    ${sectionTitle('💎 Eternal Perks', 'Bought with stones. Never reset.')}
    <div class="grid">
      ${ASC_NODES.map((n) => {
        const owned = s.asc.nodes[n.id] ?? 0;
        const maxed = n.max > 0 && owned >= n.max;
        const cost = ascCost(n, owned);
        return html`<div class="card">
          <div class="row between"><h3>${n.icon} ${n.name}</h3><span class="dim">${n.max > 0 ? `${owned}/${n.max}` : `Rank ${owned}`}</span></div>
          <div class="small">${n.desc}</div>
          ${owned > 0 ? html`<div class="dim">Now: ${n.id === 'head_start' ? `start with 🪙${fmt(startGoldFor(owned))}` : describeEffects(n.effects, owned)}</div>` : ''}
          <button class="btn ${maxed ? '' : 'primary'}" ?disabled=${maxed || s.asc.stones < cost} @click=${act((st) => buyAscNode(st, n.id))}>
            ${maxed ? 'Maxed' : `💎 ${fmt(cost)}`}
          </button>
        </div>`;
      })}
    </div>
  </div>`;
}
