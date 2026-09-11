import { html, type TemplateResult } from 'lit-html';
import type { GameState, Mods } from '../../core/types';
import { ALL_ITEMS, item } from '../../data/items';
import { buyUnitPrice, count, demandOf, sellValue } from '../../core/engine';
import { buy, sell, sellAllPotions, toggleAutoSell } from '../../core/actions';
import { fmt, fmtPct } from '../../core/format';
import { act, gold, sectionTitle, ui } from '../common';

export function marketView(s: GameState, m: Mods): TemplateResult {
  const owned = ALL_ITEMS.filter((i) => i.kind === ui.marketFilter && count(s, i.id) >= 1);
  const buyable = ALL_ITEMS.filter((i) => i.buyLevel !== undefined && i.buyLevel <= s.level);
  const hot = s.hotPotion && (s.demand[s.hotPotion] ?? 1) > 1 ? item(s.hotPotion) : null;

  return html`<div class="view">
    ${sectionTitle('🏪 Market', 'Selling lots of one potion lowers its price — demand recovers over time')}
    ${hot ? html`<div class="goal">📣 Hot seller: <b>${hot.icon} ${hot.name}</b> at ${fmtPct(demandOf(s, hot.id))} demand!</div>` : ''}

    <div class="card">
      <div class="row between">
        <div class="pill-tabs">
          ${([['potion', '🧪 Potions'], ['herb', '🌿 Herbs'], ['material', '🪨 Materials'], ['reagent', '🖋️ Reagents']] as const).map(([f, label]) => html`<button class="btn small ${ui.marketFilter === f ? 'active' : ''}"
            @click=${act(() => (ui.marketFilter = f))}>${label}</button>`)}
        </div>
        ${ui.marketFilter === 'potion' ? html`<div class="row">
          <span class="small muted">Keep in reserve:</span>
          <button class="btn small" @click=${act((st) => (st.settings.keepReserve = Math.max(0, st.settings.keepReserve - 5)))}>−</button>
          <b>${s.settings.keepReserve}</b>
          <button class="btn small" @click=${act((st) => (st.settings.keepReserve += 5))}>+</button>
          <button class="btn small gold" @click=${act(sellAllPotions)}>Sell all potions</button>
        </div>` : ''}
      </div>
      <div class="table-wrap">
        <table class="table">
          <tr><th>Item</th><th>Owned</th><th>Price</th>${ui.marketFilter === 'potion' ? html`<th>Demand</th>` : ''}<th>Sell</th>${ui.marketFilter === 'potion' && m.autoSell > 0 ? html`<th>Auto</th>` : ''}</tr>
          ${owned.length === 0 ? html`<tr><td colspan="6" class="dim">Nothing to sell here yet.</td></tr>` : ''}
          ${owned.map((i) => {
            const have = Math.floor(count(s, i.id));
            return html`<tr>
              <td>${i.icon} ${i.name}</td>
              <td>${fmt(have)}</td>
              <td>${gold(sellValue(s, m, i.id, 1))}</td>
              ${i.kind === 'potion' ? html`<td class=${demandOf(s, i.id) < 0.6 ? 'warn' : demandOf(s, i.id) > 1 ? 'good' : ''}>${fmtPct(demandOf(s, i.id))}</td>` : ''}
              <td><div class="row">
                <button class="btn small" @click=${act((st) => sell(st, i.id, 1))}>1</button>
                <button class="btn small" ?disabled=${have < 10} @click=${act((st) => sell(st, i.id, 10))}>10</button>
                <button class="btn small gold" title=${`All for ~${fmt(sellValue(s, m, i.id, have))}`} @click=${act((st) => sell(st, i.id, have))}>All</button>
              </div></td>
              ${i.kind === 'potion' && m.autoSell > 0 ? html`<td><button class="btn small ${s.autoSell[i.id] ? 'on' : ''}" @click=${act((st) => toggleAutoSell(st, i.id))}>${s.autoSell[i.id] ? 'ON' : 'OFF'}</button></td>` : ''}
            </tr>`;
          })}
        </table>
      </div>
      ${ui.marketFilter === 'potion' && m.autoSell <= 0 ? html`<div class="dim">Hire a Shop Clerk (Workshop) to auto-sell potions as they finish brewing.</div>` : ''}
    </div>

    ${sectionTitle('🛒 Supplies', 'Basic materials for sale — more stock unlocks as you level')}
    <div class="grid">
      ${buyable.map((i) => html`<div class="card">
        <div class="row between"><h3>${i.icon} ${i.name}</h3><span class="dim">Owned ${fmt(Math.floor(count(s, i.id)))}</span></div>
        <div class="row">
          ${[1, 10, 100].map((q) => html`<button class="btn small" ?disabled=${s.gold < buyUnitPrice(i.id) * q} @click=${act((st) => buy(st, i.id, q))}>
            +${q} · 🪙${fmt(buyUnitPrice(i.id) * q)}</button>`)}
        </div>
      </div>`)}
    </div>
  </div>`;
}
