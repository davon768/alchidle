import { html, type TemplateResult } from 'lit-html';
import type { Enemy, GameState, Mods } from '../../core/types';
import { DUNGEONS, DUNGEON_MAP, FLOOR_KILLS, isBossFloor, type DungeonDef } from '../../data/combat';
import { RECIPES, RECIPE_MAP, describeCombatEffect } from '../../data/recipes';
import { SPELL_MAP } from '../../data/spells';
import { item } from '../../data/items';
import { RARITIES, gearBase, gearEffects, gearName } from '../../data/gear';
import {
  HERO_SWING, POTION_CD, dungeonUnlocked, enemySwingSeconds, enterDungeon, forecast, heroStats, heroStatsBare,
  leaveDungeon, maxFloor, setBeltSlot, setFloor, toggleAutoAdvance, type HeroStats,
} from '../../core/combat';
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

/**
 * Swing bars run as a looping CSS animation rather than a width bound each render.
 *
 * The app re-renders about 10 times a second, so a value-driven bar on a one-second swing stepped
 * 10% at a time. This hands the motion to the compositor and only re-syncs the animation's phase when
 * it has actually drifted from the game's timer (a new enemy, a slow landing or expiring, or the
 * document timeline pausing while the tab is hidden). Between re-syncs the emitted style string is
 * identical, so lit-html leaves the attribute alone and the animation keeps running untouched.
 */
const swingSync = new Map<string, { period: number; css: string; syncT: number; f0: number }>();

/**
 * Who has just been hit. The views are pure functions of state, and a hit leaves no trace in the state
 * beyond a lower HP number, so this remembers the HP it last drew and flashes the fighter whose number
 * went down. Keyed on the enemy's identity so a fresh spawn is not read as a heal.
 */
/** Kept under the gap between renders so the class drops off between swings: a class that never
 *  clears never re-triggers the animation, and one shake at the start of a beating is not feedback. */
const HIT_FLASH_MS = 150;
/** Ignore drift smaller than this share of max HP — only real swings should flash. */
const HIT_MIN = 0.005;
const lastHp = { hero: -1, enemy: -1, enemyKey: '', heroAt: 0, enemyAt: 0 };

function hitFlash(heroHp: number, heroMax: number, enemy: Enemy | null): { hero: boolean; enemy: boolean } {
  const now = performance.now();
  if (lastHp.hero >= 0 && heroHp < lastHp.hero - Math.max(1e-6, heroMax * HIT_MIN)) lastHp.heroAt = now;
  lastHp.hero = heroHp;
  const key = enemy ? `${enemy.name}#${Math.round(enemy.maxHp)}` : '';
  if (!enemy || key !== lastHp.enemyKey) {
    lastHp.enemyKey = key;
    lastHp.enemy = enemy ? enemy.hp : -1;
  } else {
    if (enemy.hp < lastHp.enemy - enemy.maxHp * HIT_MIN) lastHp.enemyAt = now;
    lastHp.enemy = enemy.hp;
  }
  return { hero: now - lastHp.heroAt < HIT_FLASH_MS, enemy: now - lastHp.enemyAt < HIT_FLASH_MS };
}
const SWING_DRIFT = 0.08; // fraction of a cycle we tolerate before re-phasing

export function swingCss(key: string, fraction: number, period: number): string {
  const now = performance.now() / 1000;
  const prev = swingSync.get(key);
  let resync = !prev || Math.abs(prev.period - period) > 1e-6;
  if (!resync && prev) {
    const expected = ((now - prev.syncT) / period + prev.f0) % 1;
    let drift = Math.abs(expected - fraction);
    if (drift > 0.5) drift = 1 - drift; // the cycle wraps
    resync = drift > SWING_DRIFT;
  }
  if (resync) {
    swingSync.set(key, {
      period,
      syncT: now,
      f0: fraction,
      css: `animation: swing-fill ${period.toFixed(3)}s linear infinite; animation-delay: ${(-fraction * period).toFixed(3)}s;`,
    });
  }
  return swingSync.get(key)!.css;
}

/** A bar that fills smoothly toward the next swing, phase-locked to `fraction` of `period`. */
function swingBar(key: string, fraction: number, period: number, color: string, label: string): TemplateResult {
  return html`<div class="bar tall">
    <div class="fill swing-fill" style="background:${color};${swingCss(key, fraction, period)}"></div>
    <span class="bar-label">${label}</span>
  </div>`;
}

/**
 * The fight, read out plainly: who swings when, how hard each hit lands, and who is winning.
 * All of it is live combat state — heroTimer/enemyTimer are already 0–1 fractions of the way to the
 * next swing, so they render straight as bars.
 */
function telemetryPanel(s: GameState, hero: HeroStats, e: Enemy): TemplateResult {
  const c = s.combat;
  const f = forecast(s, hero, e);
  const every = enemySwingSeconds(e, c.slow);
  const secs = (v: number) => (v === Infinity ? '∞' : v >= 60 ? fmtTime(v) : `${v.toFixed(1)}s`);

  return html`<div class="telemetry">
    <div class="swing-row">
      <span class="swing-who">🧙 You</span>
      ${swingBar('hero', c.heroTimer, HERO_SWING, '#5fd068', `${((1 - c.heroTimer) * HERO_SWING).toFixed(2)}s`)}
      <span class="swing-meta">swings every ${HERO_SWING.toFixed(2)}s · ${fmt(f.heroHit)} a hit</span>
    </div>
    <div class="swing-row">
      <span class="swing-who">${e.icon} ${e.name}</span>
      ${swingBar('enemy', c.enemyTimer, every, '#d44a2a', `${((1 - c.enemyTimer) * every).toFixed(2)}s`)}
      <span class="swing-meta">swings every ${every.toFixed(2)}s${c.slow > 0 ? ' ❄️ slowed' : ''} · ${fmt(f.enemyHit)} a hit</span>
    </div>
    <div class="swing-row">
      <span class="swing-who">🧪 Potion</span>
      ${bar(c.potionCd > 0 ? 1 - c.potionCd / POTION_CD : 1, c.potionCd > 0 ? '#8f83b5' : '#4fb3ff',
        c.potionCd > 0 ? `${c.potionCd.toFixed(1)}s` : 'ready', 'tall potion-cd')}
      <span class="swing-meta">drinks itself when a trigger is met</span>
    </div>

    <div class="forecast ${f.winning ? 'is-good' : 'is-bad'}">
      <div><b>${fmt(f.heroDps)}</b><span class="dim">your DPS</span></div>
      <div><b>${fmt(f.enemyDps)}</b><span class="dim">incoming DPS</span></div>
      <div><b>${fmt(f.regen)}</b><span class="dim">regen / s</span></div>
      <div><b>${secs(f.killSeconds)}</b><span class="dim">to kill</span></div>
      <div><b>${f.killsPerMin >= 10 ? Math.round(f.killsPerMin) : f.killsPerMin.toFixed(1)}</b><span class="dim">kills / min</span></div>
      <div><b>${f.dieSeconds === null ? 'never' : secs(f.dieSeconds)}</b><span class="dim">to fall</span></div>
      <div class="verdict">${f.swingsToKill <= 1
        ? `💥 One hit each — clearing this floor as fast as you can swing`
        : f.dieSeconds === null
          ? '✅ You out-heal this enemy'
          : f.winning ? '✅ Winning this one' : '⚠️ Losing — better gear, potions, or drop a floor'}</div>
    </div>
  </div>`;
}

/** What the equipped gear is actually worth, measured against the same hero wearing nothing. */
function gearImpactPanel(s: GameState, m: Mods): TemplateResult {
  const now = heroStats(s, m);
  const bare = heroStatsBare(s);
  const rows: [string, number, number, (v: number) => string][] = [
    ['⚔️ Attack', now.atk, bare.atk, (v) => fmt(v)],
    ['🛡️ Defense', now.def, bare.def, (v) => fmt(v)],
    ['❤️ Max HP', now.maxHp, bare.maxHp, (v) => fmt(v)],
    ['✨ Spell power', now.sp, bare.sp, (v) => fmt(v)],
    ['🎯 Crit', now.crit, bare.crit, fmtPct],
    ['💨 Dodge', now.dodge, bare.dodge, fmtPct],
  ];
  const worn = Object.values(s.equipped)
    .map((uid) => (uid ? s.gear.find((x) => x.uid === uid) : undefined))
    .filter((g): g is NonNullable<typeof g> => !!g);

  return html`<div class="card">
    <div class="row between">
      <h3>🗡️ What your gear is doing</h3>
      <span class="dim">Equipped total vs the same hero wearing nothing</span>
    </div>
    ${worn.length ? '' : html`<div class="dim">Nothing equipped — forge or loot some in the 🗡️ Armory.</div>`}
    <div class="gear-impact">
      ${rows.map(([label, cur, base, fmtv]) => {
        const delta = cur - base;
        const pct = base > 0 ? delta / base : 0;
        return html`<div class="gi-row">
          <span class="gi-label">${label}</span>
          <span class="dim">${fmtv(base)}</span>
          <span class="dim">→</span>
          <b>${fmtv(cur)}</b>
          <span class="gi-delta ${delta > 1e-4 ? 'good' : delta < -1e-4 ? 'warn' : 'dim'}">
            ${delta > 1e-4 ? '+' : ''}${fmtv(delta)}${base > 0 && Math.abs(pct) > 0.001
              ? ` (${delta > 0 ? '+' : ''}${Math.round(pct * 100)}%)` : ''}
          </span>
        </div>`;
      })}
    </div>
    ${worn.length
      ? html`<div class="row wrap">${worn.map((g) => html`
          <span class="chip" style="border-color:${RARITIES[g.rarity].color};color:${RARITIES[g.rarity].color}"
            title=${gearEffects(g).map((ef) => `${ef.stat} ${ef.value > 0 ? '+' : ''}${ef.value}`).join(', ')}>
            ${gearBase(g).icon} ${gearName(g)}
          </span>`)}</div>`
      : ''}
  </div>`;
}

function battlePanel(s: GameState, m: Mods, d: DungeonDef): TemplateResult {
  const c = s.combat;
  const e = c.enemy;
  const hero = heroStats(s, m);
  const mMax = manaMax(s, m);
  const top = maxFloor(s, d);
  const slots = s.spellSlots.slice(0, Math.floor(m.spellSlots));
  const flash = hitFlash(c.hp, hero.maxHp, e);
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
    ${isBossFloor(d, c.floor) && c.kills >= FLOOR_KILLS
      ? html`<div class="floor-progress boss">👑 <b>Boss fight</b> — defeat ${d.boss.name} to clear floor ${c.floor}</div>`
      : html`<div class="floor-progress">${bar(c.kills / FLOOR_KILLS, '#ff9f43',
          isBossFloor(d, c.floor)
            ? `${c.kills} / ${FLOOR_KILLS} guards cleared — then ${d.boss.name}`
            : `${c.kills} / ${FLOOR_KILLS} foes cleared on floor ${c.floor}`, 'tall')}</div>`}

    <div class="arena">
      <div class="card fighter ${flash.hero ? 'hit' : ''}">
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
      <div class="card fighter ${flash.enemy ? 'hit' : ''}">
        ${c.dead > 0
          ? html`<div class="avatar">☠️</div><b>Recovering…</b><div class="muted">${fmtTime(c.dead)}</div>`
          : e
            ? html`<div class="avatar">${e.icon}</div>
                <div><b>${e.name}</b> ${e.rank !== 'normal' ? html`<span class="rank-tag ${e.rank}">${e.rank}</span>` : ''}</div>
                ${bar(Math.max(0, e.hp) / e.maxHp, undefined, `${fmt(Math.max(0, e.hp))} / ${fmt(e.maxHp)} HP`, 'enemy tall')}
                <div class="dim">⚔️ ${fmt(e.atk)} · 🛡️ ${fmt(e.def)}${c.slow > 0 ? ' · ❄️ slowed' : ''}</div>`
            : html`<div class="avatar">…</div>`}
      </div>
    </div>

    ${e && c.dead <= 0 ? telemetryPanel(s, hero, e) : ''}

    <div class="row">
      ${slots.map((id) => {
        const sp = SPELL_MAP[id];
        if (!sp) return html`<div class="spell-pill dim">Unknown spell</div>`;
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
    ${gearImpactPanel(s, m)}
    ${beltPanel(s, m)}
    ${sectionTitle('🗺️ Dungeons', ui.tab === 'dungeon' ? 'Clear the final boss of a dungeon to unlock the next' : '')}
    <div class="grid wide">${DUNGEONS.map((dd) => dungeonCard(s, dd))}</div>
  </div>`;
}
