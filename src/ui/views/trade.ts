import { html, type TemplateResult } from 'lit-html';
import type { GameState, Mods } from '../../core/types';
import { count, hasAll, offerGetQty } from '../../core/engine';
import { acceptOffer, refreshOffers, refreshOffersCost } from '../../core/actions';
import { fmtTime } from '../../core/format';
import { act, chip, sectionTitle } from '../common';

export function tradeView(s: GameState, m: Mods): TemplateResult {
  const cost = refreshOffersCost(s);
  return html`<div class="view">
    ${sectionTitle('🐪 Trading Post', html`A new caravan arrives in ${fmtTime(s.trade.timer)} · Trade rewards ×${m.tradeBonus.toFixed(2)}`)}
    <div class="row">
      <button class="btn small" ?disabled=${s.gold < cost} @click=${act(refreshOffers)}>🔄 Summon new caravan (🪙${cost})</button>
      <span class="dim">Bulk orders ignore market demand, so they're a great outlet for surplus potions.</span>
    </div>
    <div class="grid wide">
      ${s.trade.offers.map((o, i) => html`<div class="card ${o.used ? 'locked' : ''}">
        <h3>${o.title}</h3>
        <div class="row">
          <span class="dim">You give</span>
          ${o.give.map((g) => chip(g, g.id === 'gold' ? s.gold : count(s, g.id)))}
        </div>
        <div class="row">
          <span class="dim">You get</span>
          ${o.get.map((g) => chip({ id: g.id, qty: offerGetQty(g, m.tradeBonus) }))}
        </div>
        <button class="btn primary" ?disabled=${o.used || !hasAll(s, o.give)} @click=${act((st) => acceptOffer(st, i))}>
          ${o.used ? 'Completed' : 'Accept trade'}
        </button>
      </div>`)}
    </div>
  </div>`;
}
