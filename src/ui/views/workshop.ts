import { html, type TemplateResult } from 'lit-html';
import type { GameState, Mods } from '../../core/types';
import { GROUPS, GROUP_INFO, UPGRADES, upgradeCost, type UpgradeDef, type UpgradeGroup } from '../../data/upgrades';
import { affordableLevels, buyUpgrade, buyUpgradeMax, upgradeOpen } from '../../core/actions';
import { RESEARCH_MAP } from '../../data/research';
import { researchDone } from '../../core/engine';
import { describeEffects } from '../../core/mods';
import { fmt } from '../../core/format';
import { act, sectionTitle, ui } from '../common';

function upgradeCard(s: GameState, u: UpgradeDef): TemplateResult {
  const owned = s.upgrades[u.id] ?? 0;
  const maxed = u.max > 0 && owned >= u.max;
  // Some upgrades extend a system a study opens; buying one before that would be a gold-only bypass.
  const needsStudy = !!u.req && researchDone(s, u.req) <= 0;
  const locked = !upgradeOpen(s, u);
  const cost = upgradeCost(u, owned);
  const n = maxed || locked ? 0 : affordableLevels(s, u.id);
  return html`<div class="card ${locked ? 'locked' : ''} ${maxed ? 'highlight' : ''}">
    <div class="row between">
      <h3>${locked ? '🔒' : u.icon} ${u.name}</h3>
      <span class="dim">${u.max > 0 ? `${owned}/${u.max}` : `Lv ${owned}`}</span>
    </div>
    <div class="muted small">${u.desc}</div>
    ${needsStudy
      ? html`<div class="dim small">🔒 Finish <b>${RESEARCH_MAP[u.req ?? ""]?.name ?? u.req}</b> in the 📚 Library first — this extends what that study opens.</div>`
      : ''}
    <div class="small">${describeEffects(u.effects)}${u.max !== 1 ? ' each' : ''}</div>
    ${owned > 0 && u.max !== 1 ? html`<div class="dim">Total: ${describeEffects(u.effects, owned)}</div>` : ''}
    <div class="row">
      <button class="btn ${maxed ? '' : 'gold'}" ?disabled=${maxed || locked || s.gold < cost}
        @click=${act((st) => buyUpgrade(st, u.id))}>
        ${maxed ? 'Owned' : needsStudy ? 'Needs a study' : locked ? `Level ${u.level}` : `🪙 ${fmt(cost)}`}
      </button>
      ${n > 1
        ? html`<button class="btn small" title=${`Buy ${fmt(n)} level${n > 1 ? 's' : ''}`}
            @click=${act((st) => buyUpgradeMax(st, u.id))}>Max · +${fmt(n)}</button>`
        : ''}
    </div>
  </div>`;
}

export function workshopView(s: GameState, m: Mods): TemplateResult {
  // Show a little past the current level so there is always something to save toward, but not the
  // whole hundred-level list at once.
  const visible = UPGRADES.filter((u) => u.level <= s.level + 5);
  const shown = ui.shopGroup === 'all' ? visible : visible.filter((u) => u.group === ui.shopGroup);
  const spend = visible.filter((u) => u.level <= s.level && !(u.max > 0 && (s.upgrades[u.id] ?? 0) >= u.max));
  const affordable = spend.filter((u) => s.gold >= upgradeCost(u, s.upgrades[u.id] ?? 0)).length;

  const groupsWithContent = GROUPS.filter((g) => visible.some((u) => u.group === g));
  const filters: [UpgradeGroup | 'all', string][] = [
    ['all', 'All'],
    ...groupsWithContent.map((g) => [g, `${GROUP_INFO[g].icon} ${GROUP_INFO[g].label}`] as [UpgradeGroup, string]),
  ];

  return html`<div class="view">
    ${sectionTitle('🔨 Workshop', html`Gold spent on the run you are in — all of it resets when you ascend.
      ${affordable > 0 ? html`· <span class="good">${affordable} you can afford now</span>` : ''}`)}

    <div class="pill-tabs">
      ${filters.map(([g, label]) => html`<button class="btn small ${ui.shopGroup === g ? 'active' : ''}"
        @click=${act(() => (ui.shopGroup = g))}>${label}</button>`)}
    </div>

    ${ui.shopGroup === 'all'
      ? groupsWithContent.map((g) => {
          const items = visible.filter((u) => u.group === g);
          const owned = items.reduce((a, u) => a + (s.upgrades[u.id] ?? 0), 0);
          return html`<section class="col" style="gap:8px">
            <div class="row between">
              <h3>${GROUP_INFO[g].icon} ${GROUP_INFO[g].label}</h3>
              <span class="dim">${owned > 0 ? `${fmt(owned)} bought` : 'nothing yet'}</span>
            </div>
            <div class="grid">${items.map((u) => upgradeCard(s, u))}</div>
          </section>`;
        })
      : html`<div class="grid">${shown.map((u) => upgradeCard(s, u))}</div>`}

    <div class="card dim small">
      The <b>auto</b> stats are not for sale here: tending plots, cauldrons, parties, sales and rituals comes
      from apprentices in 👥 Apprentices and nowhere else. The Workshop sells space and speed — another bed,
      another cauldron, another seat on the company charter — never someone to work it for you.
      ${m.offlineHours > 8 ? html`<br />Offline progress currently runs ${fmt(m.offlineHours)} hours.` : ''}
    </div>
  </div>`;
}
