import { html, render, type TemplateResult } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import type { GameState, Mods } from '../core/types';
import { game } from '../core/game';
import { computeMods, describeEffects } from '../core/mods';
import { onGain, onToast, skillPointsFree, type Gain, type OfflineSummary, type ToastKind } from '../core/engine';
import { manaMax } from '../core/magic';
import { xpToNext } from '../core/state';
import { fmt, fmtTime } from '../core/format';
import { RECIPES } from '../data/recipes';
import { PLANTS } from '../data/plants';
import { ZONES } from '../data/zones';
import { DUNGEONS, DUNGEON_UNLOCK_LEVEL } from '../data/combat';
import { GUILD_UNLOCK_LEVEL } from '../data/guilds';
import { ASC_MIN_GOLD } from '../data/ascension';
import { EVENT_MAP, raidTarget } from '../data/events';
import { SPELL_MAP } from '../data/spells';
import { bar, chip, closeModal, openModal, setRerender, ui, type TabId } from './common';
import { gardenView } from './views/garden';
import { brewView } from './views/brew';
import { exploreView } from './views/explore';
import { dungeonView } from './views/dungeon';
import { marketView } from './views/market';
import { inventoryView } from './views/inventory';
import { arcanumView } from './views/arcanum';
import { armoryView } from './views/armory';
import { tradeView } from './views/trade';
import { guildView } from './views/guild';
import { workshopView } from './views/workshop';
import { libraryView } from './views/library';
import { skillsView } from './views/skills';
import { ascendView } from './views/ascend';
import { journalView } from './views/journal';
import { proficiencyView } from './views/proficiency';
import { staffView } from './views/apprentices';
import { goalBanner, goalsView } from './views/goals';
import { GOALS } from '../data/goals';
import { RESEARCH_UNLOCK_LEVEL } from '../data/research';
import { apprenticeCap } from '../data/apprentices';

interface TabDef {
  id: TabId;
  icon: string;
  label: string;
  unlocked: (s: GameState) => boolean;
  dot?: (s: GameState, m: Mods) => boolean;
}

const combatOpen = (s: GameState) => s.level >= DUNGEON_UNLOCK_LEVEL || s.asc.count > 0;

const TABS: TabDef[] = [
  { id: 'garden', icon: '🌱', label: 'Garden', unlocked: () => true, dot: (s, m) => m.autoHarvest <= 0 && s.plots.some((p) => p.ready || !p.plantId) },
  { id: 'brew', icon: '⚗️', label: 'Cauldrons', unlocked: () => true, dot: (s) => s.cauldrons.some((c) => !c.active) },
  { id: 'explore', icon: '🧭', label: 'Expeditions', unlocked: () => true, dot: (s) => s.expeditions.some((e) => !e) },
  { id: 'staff', icon: '👥', label: 'Apprentices', unlocked: (s) => s.level >= 3 || s.staff.hired.length > 0 || s.staff.masters.length > 0,
    dot: (s) => s.staff.hired.some((a) => !a.role || a.level >= apprenticeCap(a)) },
  { id: 'dungeon', icon: '⚔️', label: 'Dungeons', unlocked: (s) => s.level >= DUNGEON_UNLOCK_LEVEL, dot: (s) => !s.combat.dungeonId },
  { id: 'market', icon: '🏪', label: 'Market', unlocked: () => true },
  { id: 'inventory', icon: '🎒', label: 'Inventory', unlocked: () => true },
  { id: 'proficiency', icon: '🎖️', label: 'Proficiency', unlocked: (s) => Object.keys(s.prof).length > 0 },
  { id: 'arcanum', icon: '🔮', label: 'Arcanum', unlocked: combatOpen },
  { id: 'armory', icon: '🗡️', label: 'Armory', unlocked: (s) => combatOpen(s) || s.gear.length > 0 },
  { id: 'workshop', icon: '🔨', label: 'Workshop', unlocked: (s) => s.level >= 2 || s.stats.runGold >= 20 || s.asc.count > 0 },
  { id: 'skills', icon: '📜', label: 'Skills', unlocked: (s) => s.level >= 2, dot: (s, m) => skillPointsFree(s, m) > 0 },
  { id: 'library', icon: '📚', label: 'Library', unlocked: (s) => s.level >= RESEARCH_UNLOCK_LEVEL || Object.keys(s.research.done).length > 0,
    dot: (s, m) => s.research.queue.length < Math.floor(m.researchSlots) },
  { id: 'trade', icon: '🐪', label: 'Trading Post', unlocked: (s) => s.level >= 6 },
  { id: 'guild', icon: '🛡️', label: 'Guilds', unlocked: (s) => s.level >= GUILD_UNLOCK_LEVEL },
  { id: 'ascend', icon: '🌟', label: 'Magnum Opus', unlocked: (s) => s.asc.count > 0 || s.stats.runGold >= ASC_MIN_GOLD * 0.2 },
  { id: 'goals', icon: '🎯', label: 'Goals', unlocked: () => true, dot: (s) => GOALS.some((g) => s.goals[g.id] === 'done') },
  { id: 'journal', icon: '📓', label: 'Journal', unlocked: () => true },
];

// ── Activity feed: messages and item gains get their own column (or strip), never covering the game ──
interface Toast { id: number; msg: string; kind: ToastKind; t: number }
const MSG_MAX = 8;
let toasts: Toast[] = [];
let toastId = 0;

onToast((msg, kind) => {
  toasts = [{ id: ++toastId, msg, kind, t: performance.now() }, ...toasts].slice(0, MSG_MAX);
});

/** Repeated gains of the same item within a few seconds merge into one bumping counter. */
interface Pop extends Gain { bump: number; t: number }
const MERGE_MS = 5000;
const GAIN_MAX = 14;
let pops: Pop[] = [];

onGain((g) => {
  ui.newItems.add(g.key);
  if (!game.s.settings.lootPops) return;
  const now = performance.now();
  const p = pops.find((x) => x.key === g.key && now - x.t < MERGE_MS);
  if (p) {
    p.qty += g.qty;
    p.bump++;
    p.t = now;
    pops = [p, ...pops.filter((x) => x !== p)];
  } else {
    pops = [{ ...g, bump: 0, t: now }, ...pops].slice(0, GAIN_MAX);
  }
});

function feedTemplate(s: GameState): TemplateResult {
  const now = performance.now();
  const age = (t: number) => now - t;
  const latest = toasts[0] && age(toasts[0].t) < 6000 ? toasts[0] : null;
  const recent = pops.filter((p) => age(p.t) < 8000).slice(0, 8);
  return html`<aside class="feed" aria-label="Activity">
    <div class="feed-full">
      <section>
        <h4>Messages</h4>
        ${toasts.length
          ? html`<div class="feed-list">${repeat(toasts, (t) => t.id, (t) => html`<div class="toast ${t.kind} ${age(t.t) > 10000 ? 'stale' : ''}">${t.msg}</div>`)}</div>`
          : html`<div class="feed-empty">Level-ups, events and discoveries show up here.</div>`}
      </section>
      ${s.settings.lootPops ? html`<section>
        <h4>Items gained</h4>
        ${pops.length
          ? html`<div class="feed-list">${repeat(pops, (p) => `${p.key}:${p.bump}`, (p) => html`<div class="pop ${age(p.t) > 6000 ? 'stale' : ''}" style=${p.color ? `border-color:${p.color}` : ''}>
              <span class="pop-icon">${p.icon}</span><span class="pop-qty">+${fmt(p.qty)}</span><span class="pop-name" style=${p.color ? `color:${p.color}` : ''}>${p.name}</span>
            </div>`)}</div>`
          : html`<div class="feed-empty">Harvests, brews and loot show up here.</div>`}
      </section>` : ''}
    </div>
    <div class="feed-compact" aria-live="polite">
      ${latest
        ? html`<span class="feed-msg ${latest.kind}">${latest.msg}</span>`
        : recent.length
          ? recent.map((p) => html`<span class="mini-pop" title=${p.name}>${p.icon} +${fmt(p.qty)}</span>`)
          : html`<span class="feed-empty">Activity shows up here</span>`}
    </div>
  </aside>`;
}

// ── Guidance ─────────────────────────────────────────────────
/** Shown when every available goal is claimed: what the next level unlocks. */
function nextUnlock(s: GameState): string | null {
  const unlocks = [
    ...RECIPES.map((r) => ({ lvl: r.level, text: `${r.icon} ${r.name}` })),
    ...PLANTS.map((p) => ({ lvl: p.level, text: `${p.name} seeds` })),
    ...ZONES.map((z) => ({ lvl: z.level, text: `${z.icon} ${z.name}` })),
    ...DUNGEONS.map((d) => ({ lvl: d.level, text: `${d.icon} ${d.name}` })),
    { lvl: 2, text: '📜 Skills' },
    { lvl: 3, text: '👥 Apprentices (hire help to automate)' },
    { lvl: 6, text: '🐪 Trading Post' },
    { lvl: GUILD_UNLOCK_LEVEL, text: '🛡️ Guilds' },
    { lvl: DUNGEON_UNLOCK_LEVEL, text: '⚔️ Dungeons, 🔮 Arcanum & 🗡️ Armory' },
  ].filter((u) => u.lvl > s.level);
  if (unlocks.length) {
    const lvl = Math.min(...unlocks.map((u) => u.lvl));
    return `Reach level ${lvl} to unlock ${unlocks.filter((u) => u.lvl === lvl).map((u) => u.text).join(', ')}.`;
  }
  if (s.asc.count === 0 && s.stats.runGold < ASC_MIN_GOLD) return `Earn ${fmt(ASC_MIN_GOLD)} gold this run to perform the 🌟 Magnum Opus.`;
  return null;
}

/** World event banner plus active ritual buffs. */
function statusStrip(s: GameState): TemplateResult | string {
  const ev = s.event ? EVENT_MAP[s.event.id] : null;
  if (!ev && s.buffs.length === 0) return '';
  return html`<div class="view" style="margin-bottom:14px;gap:8px">
    ${ev && s.event ? html`<div class="event-banner">
      <span class="big-icon">${ev.icon}</span>
      <div class="grow">
        <b>${ev.name}</b> <span class="muted small">${ev.desc}</span>
        ${ev.special === 'raid' ? html`<div class="small">Monsters slain: <b>${s.event.progress}</b> / ${raidTarget(s.level)}</div>` : ''}
        ${ev.special === 'champion' && s.combat.champion ? html`<div class="small">The champion appears as your next dungeon foe.</div>` : ''}
        ${ev.effects.length ? html`<div class="dim">${describeEffects(ev.effects)}</div>` : ''}
      </div>
      <span class="muted">${fmtTime(s.event.remaining)}</span>
    </div>` : ''}
    ${s.buffs.length ? html`<div class="row">${s.buffs.map((b) => html`<span class="buff-chip">${SPELL_MAP[b.id]?.icon} ${SPELL_MAP[b.id]?.name} · ${fmtTime(b.remaining)}</span>`)}</div>` : ''}
  </div>`;
}

// ── Layout ───────────────────────────────────────────────────
function viewFor(tab: TabId, s: GameState, m: Mods): TemplateResult {
  switch (tab) {
    case 'garden': return gardenView(s, m);
    case 'brew': return brewView(s, m);
    case 'explore': return exploreView(s, m);
    case 'staff': return staffView(s, m);
    case 'dungeon': return dungeonView(s, m);
    case 'market': return marketView(s, m);
    case 'inventory': return inventoryView(s, m);
    case 'proficiency': return proficiencyView(s, m);
    case 'arcanum': return arcanumView(s, m);
    case 'armory': return armoryView(s, m);
    case 'trade': return tradeView(s, m);
    case 'guild': return guildView(s, m);
    case 'workshop': return workshopView(s);
    case 'library': return libraryView(s, m);
    case 'skills': return skillsView(s, m);
    case 'ascend': return ascendView(s, m);
    case 'goals': return goalsView(s);
    case 'journal': return journalView(s);
  }
}

function switchTab(id: TabId): void {
  if (ui.tab === 'inventory' && id !== 'inventory') ui.newItems.clear();
  ui.tab = id;
  rerenderNow();
}

function appTemplate(): TemplateResult {
  const s = game.s;
  const m = computeMods(s);
  const tabs = TABS.filter((t) => t.unlocked(s));
  if (!tabs.some((t) => t.id === ui.tab)) ui.tab = 'garden';
  const free = skillPointsFree(s, m);
  const need = xpToNext(s.level);
  const banner = goalBanner(s);
  const unlock = banner ? null : nextUnlock(s);
  const mMax = manaMax(s, m);

  return html`<div class="shell">
    <header class="header">
      <div class="brand">⚗️ Alchemy Idle</div>
      <div class="res"><span class="big gold-text">🪙 ${fmt(s.gold)}</span></div>
      <div class="lvl">
        <div class="row between small"><b>Level ${s.level}</b><span class="dim">${fmt(s.xp)} / ${fmt(need)} XP</span></div>
        ${bar(s.xp / need)}
      </div>
      ${combatOpen(s) ? html`<div class="lvl" style="flex-basis:150px;min-width:110px" title="Mana">
        <div class="row between small"><b>🔷 Mana</b><span class="dim">${fmt(Math.floor(s.mana))} / ${fmt(mMax)}</span></div>
        ${bar(s.mana / mMax, undefined, undefined, 'mana')}
      </div>` : ''}
      ${free > 0 ? html`<span class="sp-badge" @click=${() => switchTab('skills')}>${free} skill pt${free > 1 ? 's' : ''}</span>` : ''}
      ${s.asc.total > 0 ? html`<div class="res" title="Philosopher's Stones">💎 ${fmt(s.asc.stones)}</div>` : ''}
      <div class="spacer"></div>
    </header>
    <nav class="nav">
      ${tabs.map((t) => html`<button class="tab ${ui.tab === t.id ? 'active' : ''}" @click=${() => switchTab(t.id)}>
        <span class="icon">${t.icon}</span><span>${t.label}</span>${t.dot?.(s, m) && ui.tab !== t.id ? html`<span class="dot"></span>` : ''}
      </button>`)}
    </nav>
    <main class="main">
      ${banner ?? (unlock ? html`<div class="view" style="margin-bottom:14px"><div class="goal">🔭 ${unlock}</div></div>` : '')}
      ${statusStrip(s)}
      ${viewFor(ui.tab, s, m)}
    </main>
    ${feedTemplate(s)}
    ${ui.modal ? html`<div class="modal-bg" @click=${(e: Event) => { if (e.target === e.currentTarget) closeModal(); }}>${ui.modal}</div>` : ''}
  </div>`;
}

let root: HTMLElement;
function rerenderNow(): void {
  render(appTemplate(), root);
}

export function mount(el: HTMLElement): () => void {
  root = el;
  setRerender(rerenderNow);
  rerenderNow();
  return rerenderNow;
}

export function showOfflineSummary(sum: OfflineSummary, awaySeconds: number): void {
  if (sum.gold < 1 && sum.items.length === 0 && sum.kills === 0) return;
  const capped = awaySeconds > sum.seconds + 1;
  openModal(html`<div class="modal">
    <h2>🌙 While you were away…</h2>
    <div class="muted">You were gone for ${fmtTime(awaySeconds)}.${capped ? html` Only <b>${fmtTime(sum.seconds)}</b> counted — extend your offline limit with the Hourglass, Time Weaving or Timeless Sleep.` : ''}</div>
    ${sum.gold !== 0 ? html`<div>Gold: <b class="gold-text">${sum.gold > 0 ? '+' : ''}${fmt(sum.gold)}</b></div>` : ''}
    ${sum.levels > 0 ? html`<div>Levels gained: <b class="good">+${sum.levels}</b></div>` : ''}
    ${sum.kills > 0 ? html`<div>Monsters slain: <b>${fmt(sum.kills)}</b>${sum.gear > 0 ? html` · Gear found: <b>${fmt(sum.gear)}</b>` : ''}</div>` : ''}
    <div class="row">${sum.items.slice(0, 24).map((st) => chip(st))}</div>
    <button class="btn primary" @click=${closeModal}>Continue</button>
  </div>`);
}
