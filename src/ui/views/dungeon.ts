import { html, type TemplateResult } from 'lit-html';
import type { GameState, Mods } from '../../core/types';
import { DUNGEONS, DUNGEON_MAP, FLOOR_KILLS, isBossFloor, type DungeonDef } from '../../data/combat';
import { RECIPES, RECIPE_MAP, describeCombatEffect } from '../../data/recipes';
import { SPELL_MAP } from '../../data/spells';
import { item } from '../../data/items';
import { dungeonUnlocked, enterDungeon, heroStats, leaveDungeon, maxFloor, setBeltSlot, setFloor, toggleAutoAdvance, type HeroStats } from '../../core/combat';
import { manaMax } from '../../core/magic';
import { count, potionPotency } from '../../core/engine';
import { fmt, fmtPct, fmtTime } from '../../core/format';
import { act, bar, sectionTitle, ui } from '../common';

export function heroStatGrid(hero: HeroStats, m: Mods): TemplateResult {
  return html`<div class="stat-grid">
    <div>⚔️ ${fmt(hero.atk)} atk</div><div>🛡️ ${fmt(hero.def)} def</div><div>❤️ ${fmt(hero.maxHp)} HP</div>
    <div>✨ ${fmt(hero.sp)} spell</div><div>🎯 ${fmtPct(hero.crit)} crit</div><div>💥 ×${hero.critDmg.toFixed(2)} crit</div>
    <div>💨 ${fmtPct(hero.dodge)} dodge</div><div>🧪 ${fmtPct(m.potionPower)} potions</div><div>💰 ${fmtPct(m.lootFind)} loot</div>
  </div>`;
}

function battlePanel(s: GameState, m: Mods, d: DungeonDef): TemplateResult {
  const c = s.combat;
  const e = c.enemy;
  const hero = heroStats(s, m);
  const mMax = manaMax(s, m);
  const top = maxFloor(s, d);
  const slots = s.spellSlots.slice(0, Math.floor(m.spellSlots));
  const emptySlots = Math.max(0, Math.floor(m.spellSlots) - slots.length);

  return html`<div class="card">
    <div class="row between">
      <h3>${d.icon} ${d.name} · Floor ${c.floor}${d.floors ? ` / ${d.floors}` : ''}</h3>
      <div class="row">
        <button class="btn small" ?disabled=${c.floor <= 1} @click=${act((st) => setFloor(st, st.combat.floor - 1))}>◀ Floor</button>
        <button class="btn small" ?disabled=${c.floor >= top} @click=${act((st) => setFloor(st, st.combat.floor + 1))}>Floor ▶</button>
        <button class="btn small ${c.autoAdvance ? 'on' : ''}" @click=${act(toggleAutoAdvance)}>⏫ Auto-advance ${c.autoAdvance ? 'ON' : 'OFF'}</button>
        <button class="btn small danger" @click=${act(leaveDungeon)}>Leave</button>
      </div>
    </div>
    ${isBossFloor(d, c.floor)
      ? c.kills >= FLOOR_KILLS
        ? html`<div class="small warn">👑 Boss fight: defeat ${d.boss.name} to clear the floor!</div>`
        : bar(c.kills / FLOOR_KILLS, '#ff9f43', `${c.kills} / ${FLOOR_KILLS} guards — then ${d.boss.name} appears`, 'small')
      : bar(c.kills / FLOOR_KILLS, '#ff9f43', `${c.kills} / ${FLOOR_KILLS} foes on this floor`, 'small')}

    <div class="arena">
      <div class="card fighter">
        <div class="avatar">🧙</div>
        <b>You · Lv ${s.level}</b>
        ${bar(Math.max(0, c.hp) / hero.maxHp, undefined, `${fmt(Math.max(0, c.hp))} / ${fmt(hero.maxHp)} HP`, 'hp tall')}
        ${c.shield > 0 ? bar(c.shield / hero.maxHp, undefined, `🔰 ${fmt(c.shield)}`, 'shield small') : ''}
        ${bar(s.mana / mMax, undefined, `${fmt(Math.floor(s.mana))} / ${fmt(mMax)} mana`, 'mana')}
        <div class="row" style="justify-content:center">
          ${c.buffs.map((b) => html`<span class="buff-chip">${RECIPE_MAP[b.source]?.icon ?? SPELL_MAP[b.source]?.icon ?? '✨'} ${Math.ceil(b.remaining)}s</span>`)}
        </div>
      </div>
      <div class="vs">VS</div>
      <div class="card fighter">
        ${c.dead > 0
          ? html`<div class="avatar">☠️</div><b>Recovering…</b><div class="muted">${fmtTime(c.dead)}</div>`
          : e
            ? html`<div class="avatar">${e.icon}</div>
                <div><b>${e.name}</b> ${e.rank !== 'normal' ? html`<span class="rank-tag ${e.rank}">${e.rank}</span>` : ''}</div>
                ${bar(Math.max(0, e.hp) / e.maxHp, undefined, `${fmt(Math.max(0, e.hp))} / ${fmt(e.maxHp)}`, 'enemy tall')}
                <div class="dim">⚔️ ${fmt(e.atk)} · 🛡️ ${fmt(e.def)}${c.slow > 0 ? ' · ❄️ slowed' : ''}</div>`
            : html`<div class="avatar">…</div>`}
      </div>
    </div>

    <div class="row">
      ${slots.map((id) => {
        const sp = SPELL_MAP[id];
        const cd = s.combat.cooldowns[id] ?? 0;
        return html`<div class="spell-pill">
          <b class="small">${sp.icon} ${sp.name}</b>
          <span class="dim">${sp.mana} mana · rank ${s.spells[id] ?? 0}</span>
          ${bar(1 - cd / (sp.cooldown ?? 1), cd > 0 ? '#6f6590' : '#b57bff', undefined, 'small')}
        </div>`;
      })}
      ${Array.from({ length: emptySlots }, () => html`<div class="spell-pill dim">Empty spell slot<br />Learn & equip in 🔮 Arcanum</div>`)}
    </div>

    ${heroStatGrid(hero, m)}
    <div class="combat-log">${[...c.log].reverse().map((l) => html`<div>${l}</div>`)}</div>
  </div>`;
}

function beltPanel(s: GameState, m: Mods): TemplateResult {
  const slots = Math.floor(m.potionSlots);
  const usable = RECIPES.filter((r) => r.combat && r.level <= s.level);
  return html`<div class="card">
    <div class="row between">
      <h3>🧪 Potion Belt</h3>
      <span class="dim">Drunk automatically: heals under 50% HP, mana under 25%, buffs as they expire, bombs on elites & bosses, revives on death.</span>
    </div>
    <div class="grid">
      ${Array.from({ length: slots }, (_, i) => {
        const id = s.belt[i] ?? null;
        const r = id ? RECIPE_MAP[id] : null;
        const have = id ? Math.floor(count(s, id)) : 0;
        return html`<div class="col">
          <select @change=${(e: Event) => act((st) => setBeltSlot(st, i, (e.target as HTMLSelectElement).value || null))(e)}>
            <option value="" ?selected=${!id}>— Empty slot ${i + 1} —</option>
            ${usable.map((p) => html`<option value=${p.id} ?selected=${p.id === id}>${p.icon} ${p.name} (${fmt(Math.floor(count(s, p.id)))})</option>`)}
          </select>
          ${r?.combat ? html`<div class="small">${r.combat.map((f) => describeCombatEffect(f, potionPotency(s, m, r.id))).join(' · ')}</div>
            <div class="dim ${have < 1 ? 'warn' : ''}">${have < 1 ? 'Out of stock — brew more!' : `${fmt(have)} in stock`}</div>` : ''}
        </div>`;
      })}
    </div>
  </div>`;
}

function dungeonCard(s: GameState, d: DungeonDef): TemplateResult {
  const unlocked = dungeonUnlocked(s, d);
  const best = s.dungeons[d.id] ?? 0;
  const here = s.combat.dungeonId === d.id;
  const prev = DUNGEONS[DUNGEONS.indexOf(d) - 1];
  const loot = [...new Set([...d.drops, ...d.bossDrops].map((x) => x.id))];
  return html`<div class="card ${unlocked ? '' : 'locked'} ${here ? 'highlight' : ''}">
    <div class="row between">
      <h3>${unlocked ? d.icon : '🔒'} ${d.name}</h3>
      <span class="dim">Lv ${d.level} · Gear T${d.tier}${d.floors === 0 ? '+' : ''}</span>
    </div>
    <div class="muted small">${d.desc}</div>
    <div class="small">Best floor: <b>${best}</b>${d.floors ? ` / ${d.floors}` : ' (endless)'}</div>
    <div class="row">${loot.map((id) => html`<span class="chip" title=${item(id).name}>${item(id).icon} ${item(id).name}</span>`)}</div>
    ${!unlocked ? html`<div class="dim">${s.level < d.level ? `Requires level ${d.level}` : `Clear ${prev?.name} first`}</div>` : ''}
    <button class="btn primary" ?disabled=${!unlocked || here} @click=${act((st) => enterDungeon(st, d.id))}>${here ? 'Fighting here' : 'Enter'}</button>
  </div>`;
}

export function dungeonView(s: GameState, m: Mods): TemplateResult {
  const d = s.combat.dungeonId ? DUNGEON_MAP[s.combat.dungeonId] : null;
  return html`<div class="view">
    ${sectionTitle('⚔️ Dungeons', 'You fight automatically, even offline. Gear, spells and potions decide how deep you get.')}
    ${d ? battlePanel(s, m, d) : html`<div class="card"><div class="muted">You're resting in town. Pick a dungeon below — and fill your potion belt first.</div>${heroStatGrid(heroStats(s, m), m)}</div>`}
    ${beltPanel(s, m)}
    ${sectionTitle('🗺️ Dungeons', ui.tab === 'dungeon' ? 'Clear the final boss of a dungeon to unlock the next' : '')}
    <div class="grid wide">${DUNGEONS.map((dd) => dungeonCard(s, dd))}</div>
  </div>`;
}
