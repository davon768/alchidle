import { html, type TemplateResult } from 'lit-html';
import type { GameState } from '../../core/types';
import { UPGRADES, upgradeCost } from '../../data/upgrades';
import { buyUpgrade } from '../../core/actions';
import { describeEffects } from '../../core/mods';
import { fmt } from '../../core/format';
import { act, sectionTitle } from '../common';

export function workshopView(s: GameState): TemplateResult {
  const visible = UPGRADES.filter((u) => u.level <= s.level + 3);
  return html`<div class="view">
    ${sectionTitle('🔨 Workshop', 'Spend gold on tools, space and helpers. Upgrades reset on ascension.')}
    <div class="grid">
      ${visible.map((u) => {
        const owned = s.upgrades[u.id] ?? 0;
        const maxed = u.max > 0 && owned >= u.max;
        const locked = u.level > s.level;
        const cost = upgradeCost(u, owned);
        return html`<div class="card ${locked ? 'locked' : ''}">
          <div class="row between"><h3>${u.icon} ${u.name}</h3><span class="dim">${u.max > 0 ? `${owned}/${u.max}` : `Lv ${owned}`}</span></div>
          <div class="muted small">${u.desc}</div>
          <div class="small">${describeEffects(u.effects)}${u.max !== 1 ? ' each' : ''}</div>
          ${owned > 0 && u.max !== 1 ? html`<div class="dim">Total: ${describeEffects(u.effects, owned)}</div>` : ''}
          <button class="btn ${maxed ? '' : 'gold'}" ?disabled=${maxed || locked || s.gold < cost} @click=${act((st) => buyUpgrade(st, u.id))}>
            ${maxed ? 'Owned' : locked ? `Level ${u.level}` : `🪙 ${fmt(cost)}`}
          </button>
        </div>`;
      })}
    </div>
  </div>`;
}
