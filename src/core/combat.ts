import type { CombatEffect, Enemy, EnemyRank, GameState, Mods } from './types';
import { addGold, addItem, count, gainXp, isQuiet, potionPotency, randInt, removeItem, rollAmount, takenTier, toast } from './engine';
import { qualityName } from '../data/quality';
import { computeMods } from './mods';
import { manaMax } from './magic';
import { addGear, newGear } from './armory';
import { onEventKill } from './events';
import { moment } from './telemetry';
import { workXp } from './staff';
import { fmt } from './format';
import {
  DUNGEONS, DUNGEON_MAP, FLOOR_GROWTH, FLOOR_KILLS, RANK_MULT, REWARD_GROWTH, floorTier, isBossFloor, type DungeonDef,
} from '../data/combat';
import type { Drop } from '../data/zones';
import { RECIPE_MAP } from '../data/recipes';
import { SPELL_MAP, spellRankMult } from '../data/spells';
import { rollRarity } from '../data/gear';

const STEP = 0.25; // combat resolution in seconds
const RECOVER_TIME = 20;
export const POTION_CD = 2;
/** Seconds between the hero's swings. The enemy's own rate is its `speed`, halved again while slowed. */
export const HERO_SWING = 1;
/** Hero regeneration, as a fraction of max HP per second. */
export const HERO_REGEN = 0.01;
const CHAMPION = { name: 'Wandering Champion', icon: '🏆' };

export interface HeroStats {
  maxHp: number;
  atk: number;
  def: number;
  sp: number;
  crit: number;
  critDmg: number;
  dodge: number;
}

/** Hero stats = level base + flat gear/skill stats, times multipliers (including active combat buffs). */
export function heroStats(s: GameState, m: Mods): HeroStats {
  let atkM = m.attackMult, defM = m.defenseMult, spM = m.spellMult, crit = m.critChance, dodge = m.dodge;
  for (const b of s.combat.buffs) {
    if (b.stat === 'attackMult') atkM += b.value;
    else if (b.stat === 'defenseMult') defM += b.value;
    else if (b.stat === 'spellMult') spM += b.value;
    else if (b.stat === 'critChance') crit += b.value;
    else dodge += b.value;
  }
  const L = s.level;
  return {
    maxHp: (80 + 20 * L + m.maxHp) * m.hpMult,
    atk: (8 + 2.5 * L + m.attack) * atkM,
    def: (4 + 1.5 * L + m.defense) * defM,
    sp: (8 + 2.5 * L + m.spellPower) * spM,
    crit: Math.min(0.75, crit),
    critDmg: m.critDamage,
    dodge: Math.min(0.6, dodge),
  };
}

/** Seconds between this enemy's swings, including any slow currently on it. */
export function enemySwingSeconds(e: Enemy, slow: number): number {
  return 1 / Math.max(0.0001, e.speed * (slow > 0 ? 0.6 : 1));
}

/** Everything the battle HUD needs to say how a fight is actually going. Averages out the ±10% roll. */
export interface Forecast {
  heroHit: number; // average damage per swing, crits included
  heroDps: number;
  enemyHit: number; // average damage taken per enemy swing, dodge included
  enemyDps: number;
  regen: number; // HP per second the hero recovers
  netIncoming: number; // enemy DPS minus regeneration
  killSeconds: number; // time to drop the current enemy
  dieSeconds: number | null; // time until the hero falls, or null if they out-heal the damage
  winning: boolean;
  swingsToKill: number; // swings needed for a *fresh* enemy of this kind
  killsPerMin: number; // sustained clear rate, floored by the swing timer
}

export function forecast(s: GameState, hero: HeroStats, e: Enemy): Forecast {
  const c = s.combat;
  const heroHit = dmgFormula(hero.atk, e.def) * (1 + hero.crit * (hero.critDmg - 1));
  const heroDps = heroHit / HERO_SWING;
  const enemyHit = dmgFormula(e.atk, hero.def) * (1 - hero.dodge);
  const enemyDps = enemyHit / enemySwingSeconds(e, c.slow);
  const regen = hero.maxHp * HERO_REGEN;
  const netIncoming = enemyDps - regen;
  const killSeconds = heroDps > 0 ? Math.max(0, e.hp) / heroDps : Infinity;
  const dieSeconds = netIncoming > 0 ? (Math.max(0, c.hp) + c.shield) / netIncoming : null;
  // You cannot kill faster than you swing, so the clear rate is floored by the swing timer rather
  // than by raw DPS — which is the whole story once one hit is enough.
  const swingsToKill = Math.max(1, Math.ceil(e.maxHp / Math.max(1e-9, heroHit)));
  const killsPerMin = 60 / (swingsToKill * HERO_SWING);
  return { heroHit, heroDps, enemyHit, enemyDps, regen, netIncoming, killSeconds, dieSeconds,
    winning: dieSeconds === null || killSeconds < dieSeconds, swingsToKill, killsPerMin };
}

/** Hero stats as they would be with nothing equipped — the baseline the gear panel compares against. */
export function heroStatsBare(s: GameState): HeroStats {
  const bare = { ...s, equipped: { weapon: null, helm: null, armor: null, trinket: null } } as GameState;
  return heroStats(bare, computeMods(bare));
}

export function dungeonUnlocked(s: GameState, d: DungeonDef): boolean {
  if (s.level < d.level) return false;
  const i = DUNGEONS.indexOf(d);
  if (i < 0) return false;
  if (i === 0) return true;
  const prev = DUNGEONS[i - 1];
  return (s.dungeons[prev.id] ?? 0) >= prev.floors;
}

/** Highest floor you may select: one past your best (capped at the dungeon's last floor). */
export function maxFloor(s: GameState, d: DungeonDef): number {
  const best = s.dungeons[d.id] ?? 0;
  return d.floors === 0 ? best + 1 : Math.min(d.floors, best + 1);
}

function log(s: GameState, msg: string): void {
  if (isQuiet()) return;
  const l = s.combat.log;
  l.push(msg);
  if (l.length > 8) l.shift();
}

export const dmgFormula = (a: number, d: number) => (a * a) / (a + d);

export function spawnEnemy(s: GameState, m: Mods, d: DungeonDef, floor: number): Enemy {
  const c = s.combat;
  // Boss floors: clear the guards first, then the boss appears (so parking on a boss floor can't farm bosses back-to-back).
  let rank: EnemyRank = isBossFloor(d, floor) && c.kills >= FLOOR_KILLS ? 'boss' : Math.random() < 0.06 ? 'elite' : 'normal';
  if (c.champion) {
    rank = 'champion';
    c.champion = false;
  }
  const mon = rank === 'boss' ? d.boss : rank === 'champion' ? CHAMPION : d.enemies[Math.floor(Math.random() * d.enemies.length)];
  const sc = FLOOR_GROWTH ** (floor - 1) * m.enemyPower;
  const rm = RANK_MULT[rank];
  const rew = REWARD_GROWTH ** (floor - 1) * rm.reward;
  const hp = d.hp * sc * rm.hp;
  return {
    name: rank === 'elite' ? `Elite ${mon.name}` : mon.name,
    icon: mon.icon,
    rank,
    hp,
    maxHp: hp,
    atk: d.atk * sc * rm.atk,
    def: d.def * sc,
    speed: rank === 'boss' ? 0.7 : 0.8 + Math.random() * 0.3,
    xp: d.xp * rew,
    gold: d.gold * rew,
  };
}

function strike(hero: HeroStats, e: Enemy, power: number, spell: boolean): number {
  let dmg = dmgFormula(power, spell ? e.def * 0.5 : e.def) * (0.9 + Math.random() * 0.2);
  if (Math.random() < hero.crit) dmg *= hero.critDmg;
  e.hp -= dmg;
  return dmg;
}

function rollDrops(s: GameState, m: Mods, drops: Drop[], mult: number): void {
  for (const d of drops) {
    if (Math.random() >= Math.min(1, d.chance * (d.rare ? m.rareFind : 1))) continue;
    const qty = rollAmount(randInt(d.min, d.max) * mult);
    if (qty > 0) addItem(s, d.id, qty);
  }
}

/** Drink the first belt potion whose trigger condition is met. Returns true if combat buffs changed. */
function usePotion(s: GameState, m: Mods, hero: HeroStats, e: Enemy): boolean {
  const c = s.combat;
  if (c.potionCd > 0) return false;
  const mana = manaMax(s, m);
  const slots = Math.min(Math.floor(m.potionSlots), s.belt.length);
  for (let i = 0; i < slots; i++) {
    const id = s.belt[i];
    const fx = id ? RECIPE_MAP[id]?.combat : undefined;
    if (!id || !fx?.length || count(s, id) < 1) continue;
    const first = fx[0];
    const want =
      first.type === 'heal' ? c.hp < hero.maxHp * 0.5
      : first.type === 'mana' ? s.mana < mana * 0.25
      : first.type === 'buff' ? !c.buffs.some((b) => b.source === id)
      : first.type === 'bomb' ? e.rank !== 'normal' && e.hp > e.maxHp * 0.2
      : false;
    if (!want) continue;
    // In a fight you reach for the best bottle on the belt.
    const tier = takenTier(removeItem(s, id, 1, 'high'));
    let buffed = false;
    for (const f of fx) buffed = applyPotion(s, m, hero, e, id, f, mana, tier) || buffed;
    c.potionCd = POTION_CD;
    log(s, `${RECIPE_MAP[id].icon} Used ${qualityName(tier, RECIPE_MAP[id].name)}`);
    return buffed;
  }
  return false;
}

function applyPotion(s: GameState, m: Mods, hero: HeroStats, e: Enemy, source: string, f: CombatEffect, mana: number, tier = 0): boolean {
  const c = s.combat;
  const pp = potionPotency(s, m, source, tier);
  switch (f.type) {
    case 'heal': c.hp = Math.min(hero.maxHp, c.hp + hero.maxHp * f.value * pp); return false;
    case 'mana': s.mana = Math.min(mana, s.mana + mana * f.value * pp); return false;
    case 'buff': c.buffs.push({ source, stat: f.stat, value: f.value * pp, remaining: f.duration }); return true;
    case 'bomb': e.hp -= e.maxHp * f.value * pp * (e.rank === 'boss' || e.rank === 'champion' ? 0.35 : 1); return false;
    case 'revive': return false;
  }
}

/** Auto-cast equipped spells that are off cooldown and useful right now. Returns true if buffs changed. */
function castSpells(s: GameState, m: Mods, hero: HeroStats, e: Enemy): boolean {
  const c = s.combat;
  let buffed = false;
  for (const id of s.spellSlots.slice(0, Math.floor(m.spellSlots))) {
    const sp = SPELL_MAP[id];
    const rank = s.spells[id] ?? 0;
    const fx = sp?.combat;
    if (!fx || rank <= 0 || (c.cooldowns[id] ?? 0) > 0 || s.mana < sp.mana || e.hp <= 0) continue;
    const want =
      fx.type === 'heal' ? c.hp < hero.maxHp * 0.6
      : fx.type === 'shield' ? c.shield <= 0
      : fx.type === 'buff' ? !c.buffs.some((b) => b.source === id)
      : true;
    if (!want) continue;
    s.mana -= sp.mana;
    c.cooldowns[id] = sp.cooldown ?? 5;
    s.stats.spellsCast++;
    const pw = spellRankMult(rank);
    switch (fx.type) {
      case 'damage': {
        const dmg = strike(hero, e, hero.sp * fx.mult * pw, true);
        if (fx.slow) c.slow = fx.slow;
        log(s, `${sp.icon} ${sp.name} hits for ${fmt(dmg)}`);
        break;
      }
      case 'drain': {
        const dmg = strike(hero, e, hero.sp * fx.mult * pw, true);
        c.hp = Math.min(hero.maxHp, c.hp + dmg * fx.heal);
        log(s, `${sp.icon} ${sp.name} drains ${fmt(dmg)}`);
        break;
      }
      case 'heal': c.hp = Math.min(hero.maxHp, c.hp + hero.maxHp * fx.pct * pw); break;
      case 'shield': c.shield = hero.maxHp * fx.pct * pw; break;
      case 'buff': c.buffs.push({ source: id, stat: fx.stat, value: fx.value * pw, remaining: fx.duration }); buffed = true; break;
    }
  }
  return buffed;
}

function onKill(s: GameState, m: Mods, d: DungeonDef, e: Enemy): void {
  const c = s.combat;
  addGold(s, e.gold, true, 'dungeon');
  gainXp(s, m, e.xp);
  s.stats.kills++;
  const floorLoot = m.lootFind * (1 + 0.04 * (c.floor - 1));
  rollDrops(s, m, d.drops, floorLoot * (e.rank === 'elite' ? 2 : 1));
  if (e.rank === 'boss' || e.rank === 'champion') {
    s.stats.bosses++;
  // Bosses sit on hoards, and hoards have books in them. The surest of the three sources, because a boss
  // is a deliberate trip rather than something that happens while you are elsewhere.
  if (Math.random() < 0.25) addItem(s, 'journal_page', 1);
    rollDrops(s, m, d.bossDrops, floorLoot);
  }
  const gearChance = { normal: 0.03, elite: 0.4, boss: 1, champion: 1 }[e.rank] * m.lootFind;
  if (Math.random() < gearChance) {
    const luck = m.lootFind * { normal: 1, elite: 2, boss: 3, champion: 5 }[e.rank];
    const min = e.rank === 'champion' ? 3 : e.rank === 'boss' ? 1 : 0;
    addGear(s, newGear(s, floorTier(d, c.floor), rollRarity(luck, min)));
  }
  for (const k of s.guild.contracts) if (k.kind === 'slay' && k.dungeonId === d.id && k.delivered < k.qty) k.delivered++;
  onEventKill(s, m);
  workXp(s, m, 'squire', 0, 0.3 + c.floor * 0.03);
  log(s, `${e.icon} ${e.name} defeated · +${fmt(e.gold)} gold`);
  c.enemy = null;
  if (e.rank === 'champion') {
    toast(`🏆 You defeated the Wandering Champion!`, 'epic');
    return; // bonus fight: doesn't count toward the floor
  }
  c.kills++;
  const cleared = isBossFloor(d, c.floor) ? e.rank === 'boss' : c.kills >= FLOOR_KILLS;
  if (!cleared) return;
  c.kills = 0;
  if (c.floor > (s.dungeons[d.id] ?? 0)) {
    s.dungeons[d.id] = c.floor;
    if (d.floors > 0 && c.floor === d.floors) {
      const next = DUNGEONS[DUNGEONS.indexOf(d) + 1];
      toast(`🏆 ${d.name} conquered!${next ? ` ${next.icon} ${next.name} awaits (level ${next.level}).` : ''}`, 'epic');
    }
  }
  if (c.autoAdvance && (d.floors === 0 || c.floor < d.floors)) c.floor++;
}

function onDeath(s: GameState, m: Mods, hero: HeroStats): void {
  const c = s.combat;
  const reviveId = s.belt.slice(0, Math.floor(m.potionSlots)).find((id) => id && count(s, id) >= 1 && RECIPE_MAP[id]?.combat?.[0]?.type === 'revive');
  if (reviveId) {
    const fx = RECIPE_MAP[reviveId].combat![0];
    const tier = takenTier(removeItem(s, reviveId, 1, 'high'));
    c.hp = hero.maxHp * Math.min(1, fx.value * potionPotency(s, m, reviveId, tier));
    log(s, `${RECIPE_MAP[reviveId].icon} Revived by ${qualityName(tier, RECIPE_MAP[reviveId].name)}!`);
    return;
  }
  s.stats.deaths++;
  moment('death', `fell on floor ${s.combat.floor} of ${s.combat.dungeonId ?? 'nowhere'}`);
  const floor = c.floor;
  c.dead = RECOVER_TIME;
  c.enemy = null;
  c.buffs = [];
  c.shield = 0;
  c.kills = 0;
  if (c.floor > 1) {
    c.floor--;
    c.autoAdvance = false;
    c.retreated = true;
  }
  toast(`☠️ Defeated on floor ${floor}. Retreating to floor ${c.floor} — auto-advance paused.`, 'warn');
  log(s, `☠️ You were defeated on floor ${floor}`);
}

export function tickCombat(s: GameState, m: Mods, dt: number): void {
  const c = s.combat;
  let hero = heroStats(s, m);
  if (!c.dungeonId) {
    c.hp = hero.maxHp;
    return;
  }
  const d = DUNGEON_MAP[c.dungeonId];
  if (!d) {
    c.dungeonId = null;
    return;
  }
  let t = dt;
  for (let g = 0; t > 1e-9 && g < 400_000; g++) {
    const step = Math.min(STEP, t);
    t -= step;
    if (c.dead > 0) {
      c.dead -= step;
      if (c.dead <= 0) {
        c.dead = 0;
        c.hp = hero.maxHp;
      }
      continue;
    }
    for (const k in c.cooldowns) c.cooldowns[k] = Math.max(0, c.cooldowns[k] - step);
    c.potionCd = Math.max(0, c.potionCd - step);
    c.slow = Math.max(0, c.slow - step);
    if (c.buffs.length) {
      for (const b of c.buffs) b.remaining -= step;
      const before = c.buffs.length;
      c.buffs = c.buffs.filter((b) => b.remaining > 0);
      if (c.buffs.length !== before) hero = heroStats(s, m);
    }
    c.hp = Math.min(hero.maxHp, c.hp + hero.maxHp * 0.01 * step);
    if (!c.enemy) {
      c.enemy = spawnEnemy(s, m, d, c.floor);
      c.enemyTimer = 0;
      c.heroTimer = 0;
    }
    const e = c.enemy;
    if (usePotion(s, m, hero, e)) hero = heroStats(s, m);
    if (castSpells(s, m, hero, e)) hero = heroStats(s, m);
    c.heroTimer += step;
    while (c.heroTimer >= 1 && e.hp > 0) {
      c.heroTimer -= 1;
      strike(hero, e, hero.atk, false);
    }
    if (e.hp <= 0) {
      onKill(s, m, d, e);
      continue;
    }
    c.enemyTimer += step * e.speed * (c.slow > 0 ? 0.6 : 1);
    while (c.enemyTimer >= 1) {
      c.enemyTimer -= 1;
      if (Math.random() < hero.dodge) continue;
      let dmg = dmgFormula(e.atk, hero.def) * (0.9 + Math.random() * 0.2);
      if (c.shield > 0) {
        const absorbed = Math.min(c.shield, dmg);
        c.shield -= absorbed;
        dmg -= absorbed;
      }
      c.hp -= dmg;
      if (c.hp <= 0) {
        onDeath(s, m, hero);
        break;
      }
    }
  }
  // Line up the next foe before returning. A sub-step that ends on a kill used to leave combat.enemy
  // null until the next one began, which is every sub-step once you out-level a dungeon — the arena
  // and the battle readout then had nothing to show. The next sub-step would have spawned this same
  // enemy and reset the same timers, so bringing it forward changes nothing but what is on screen.
  if (c.dungeonId && c.dead <= 0 && !c.enemy) {
    c.enemy = spawnEnemy(s, m, d, c.floor);
    c.enemyTimer = 0;
    c.heroTimer = 0;
  }
}

// ── Player actions ───────────────────────────────────────────
export function enterDungeon(s: GameState, id: string): void {
  const d = DUNGEON_MAP[id];
  if (!d || !dungeonUnlocked(s, d)) return;
  const c = s.combat;
  c.dungeonId = id;
  c.floor = Math.max(1, Math.min(maxFloor(s, d), s.dungeons[id] ?? 1));
  c.kills = 0;
  c.enemy = null;
  c.dead = 0;
  c.buffs = [];
  c.shield = 0;
  c.log = [];
  c.hp = heroStats(s, computeMods(s)).maxHp;
}

export function leaveDungeon(s: GameState): void {
  const c = s.combat;
  c.dungeonId = null;
  c.enemy = null;
  c.buffs = [];
  c.shield = 0;
  c.dead = 0;
}

export function setFloor(s: GameState, floor: number): void {
  const c = s.combat;
  const d = c.dungeonId ? DUNGEON_MAP[c.dungeonId] : null;
  if (!d) return;
  const f = Math.max(1, Math.min(maxFloor(s, d), floor));
  if (f === c.floor) return;
  c.floor = f;
  c.kills = 0;
  c.enemy = null;
}

export function toggleAutoAdvance(s: GameState): void {
  s.combat.autoAdvance = !s.combat.autoAdvance;
  s.combat.retreated = false; // a manual choice — Squires won't override it
}

/** Hard ceiling on the potion belt, enforced here and in computeMods so the two cannot drift apart. */
export const BELT_MAX = 8;

export function setBeltSlot(s: GameState, i: number, id: string | null): void {
  // Both arguments index stored data: an out-of-range slot used to pad the belt with nulls forever, and
  // an id with no recipe behind it would render as an unknown item for the rest of the save's life.
  if (!Number.isInteger(i) || i < 0 || i >= BELT_MAX) return;
  if (id && !RECIPE_MAP[id]) return;
  while (s.belt.length <= i) s.belt.push(null);
  s.belt[i] = id;
}
