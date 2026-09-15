import { html, type TemplateResult } from 'lit-html';
import type { GameState, Mods } from '../../core/types';
import { SOURCES, SOURCE_INFO, findStalls, recentIncome, type IncomeSource } from '../../core/ledger';
import { fmt, fmtPct, fmtTime } from '../../core/format';
import { act, bar, sectionTitle, ui, type TabId } from '../common';

/**
 * Income over the last hour as a bar per minute. Deliberately not a library: a sparkline is a row of
 * divs, and the whole point of this tab is to be cheap enough to leave open while the game runs.
 */
function sparkline(series: number[]): TemplateResult | string {
  if (series.length < 2) return '';
  const peak = Math.max(...series, 1);
  return html`<div class="spark" title="Gold earned each minute, oldest on the left">
    ${series.map((v) => html`<div class="spark-bar" style="height:${Math.max(2, (v / peak) * 100)}%"
      title=${`${fmt(Math.round(v))} gold`}></div>`)}
  </div>`;
}

function incomePanel(s: GameState): TemplateResult {
  const recent = recentIncome();
  const lifetime = SOURCES
    .map((source) => ({ source, gold: s.income[source] ?? 0 }))
    .filter((x) => x.gold > 0)
    .sort((a, b) => b.gold - a.gold);
  const lifeTotal = lifetime.reduce((a, x) => a + x.gold, 0);

  if (recent.total <= 0 && lifeTotal <= 0) {
    return html`<div class="card dim">Nothing earned yet. Sell a potion and this fills in.</div>`;
  }

  const rows = recent.total > 0 ? recent.by : lifetime.map((x) => ({ ...x, share: x.gold / lifeTotal, perHour: 0 }));
  const heading = recent.total > 0
    ? `Last ${recent.minutes < 2 ? 'minute' : `${Math.round(recent.minutes)} minutes`} · ${fmt(Math.round(recent.perHour))} gold/hour`
    : 'Lifetime, by source';

  return html`<div class="card">
    <div class="row between"><h3>💰 Where your gold comes from</h3><span class="dim">${heading}</span></div>
    ${sparkline(recent.series)}
    <div class="col" style="gap:6px">
      ${rows.map((r) => {
        const info = SOURCE_INFO[r.source as IncomeSource];
        return html`<div class="ledger-row" @click=${act(() => (ui.tab = info.tab as TabId))} title=${`Open ${info.label}`}>
          <span class="ledger-name">${info.icon} ${info.label}</span>
          ${bar(r.share, undefined, '', 'tall')}
          <span class="ledger-num">${fmt(Math.round(r.gold))}</span>
          <span class="dim ledger-pct">${fmtPct(r.share)}</span>
        </div>`;
      })}
    </div>
    <div class="dim small">${recent.total > 0
      ? 'Measured since the page was opened, up to an hour. Offline earnings are reported in their own summary instead of here.'
      : 'Lifetime totals. The hourly breakdown starts filling in as you play.'}</div>
  </div>`;
}

function stallPanel(s: GameState, m: Mods): TemplateResult {
  const stalls = findStalls(s, m);
  if (!stalls.length) {
    return html`<div class="card highlight">
      <h3>✅ Nothing is idle</h3>
      <div class="muted small">Every bed is planted, every cauldron is running, every desk and party is busy.
        This is what the workshop looks like when it is working.</div>
    </div>`;
  }
  return html`<div class="card">
    <div class="row between"><h3>⚠️ What is holding you up</h3><span class="dim">${stalls.length} to look at</span></div>
    <div class="col" style="gap:8px">
      ${stalls.slice(0, 6).map((x) => html`<div class="stall">
        <span class="big-icon">${x.icon}</span>
        <div class="grow">
          <b>${x.title}</b>
          <div class="dim small">${x.detail}</div>
        </div>
        <button class="btn small" @click=${act(() => (ui.tab = x.tab as TabId))}>Show me</button>
      </div>`)}
    </div>
  </div>`;
}

export function ledgerView(s: GameState, m: Mods): TemplateResult {
  const recent = recentIncome();
  return html`<div class="view">
    ${sectionTitle('📊 Ledger', html`What each system is actually paying you, and what is standing still.
      ${recent.total > 0 ? html`· earning <b>${fmt(Math.round(recent.perHour))}</b> gold/hour` : ''}`)}
    ${stallPanel(s, m)}
    ${incomePanel(s)}
    <div class="card">
      <div class="row between"><h3>⏱️ This run</h3><span class="dim">${fmtTime(s.stats.runTime)} in</span></div>
      <div class="stat-grid">
        <div>🪙 ${fmt(Math.round(s.stats.runGold))} earned this run</div>
        <div>📈 ${fmt(Math.round(s.stats.runGold / Math.max(1, s.stats.runTime / 3600)))} gold/hour average</div>
        <div>⚗️ ${fmt(Math.round(s.stats.brewed))} brewed</div>
        <div>🌿 ${fmt(Math.round(s.stats.harvested))} harvested</div>
      </div>
      <div class="dim small">The average covers the whole run; the hourly figure above is what you are earning
        <i>now</i>. When the second is below the first, something has stalled since.</div>
    </div>
  </div>`;
}
