import type { Effect, GameState, Mods, StatKey } from './types';
import { SKILL_MAP } from '../data/skills';
import { UPGRADE_MAP } from '../data/upgrades';
import { GUILD_MAP, rankFor } from '../data/guilds';
import { ASC_MAP } from '../data/ascension';
import { ACHIEVEMENTS } from '../data/achievements';
import { gearEffects } from '../data/gear';
import { SPELL_MAP, ritualEffects } from '../data/spells';
import { EVENT_MAP } from '../data/events';
import { fmt } from './format';

export function baseMods(): Mods {
  return {
    growSpeed: 1, harvestYield: 1, seedDiscount: 0,
    brewSpeed: 1, doubleBrew: 0, ingredientSave: 0, masteryRate: 1,
    sellPrice: 1, demandRecovery: 1, tradeBonus: 1, contractReward: 1, repGain: 1,
    scavSpeed: 1, scavYield: 1, rareFind: 1,
    xpGain: 1, stoneGain: 1, offlineHours: 8,
    plots: 2, cauldrons: 1, expSlots: 1, skillPoints: 0, startGold: 0,
    autoHarvest: 0, autoBrew: 0, autoSell: 0, autoScav: 0, autoRitual: 0,
    attack: 0, attackMult: 1, defense: 0, defenseMult: 1, maxHp: 0, hpMult: 1,
    spellPower: 0, spellMult: 1, critChance: 0.05, critDamage: 1.5, dodge: 0,
    maxMana: 0, manaRegen: 0, potionPower: 1, lootFind: 1, enemyPower: 1,
    spellSlots: 2, potionSlots: 3,
  };
}

function apply(m: Mods, effects: Effect[], times: number): void {
  if (times <= 0) return;
  for (const e of effects) m[e.stat] += e.value * times;
}

export function computeMods(s: GameState): Mods {
  const m = baseMods();
  for (const [id, rank] of Object.entries(s.skills)) {
    const node = SKILL_MAP[id];
    if (node) apply(m, node.effects, rank);
  }
  for (const [id, lvl] of Object.entries(s.upgrades)) {
    const u = UPGRADE_MAP[id];
    if (u) apply(m, u.effects, lvl);
  }
  if (s.guild.id) {
    const g = GUILD_MAP[s.guild.id];
    const rank = rankFor(s.guild.rep);
    apply(m, g.perRank, rank);
    for (const ms of g.milestones) if (rank >= ms.rank) apply(m, ms.effects, 1);
  }
  for (const [id, rank] of Object.entries(s.asc.nodes)) {
    const node = ASC_MAP[id];
    if (node) apply(m, node.effects, rank);
  }
  for (const a of ACHIEVEMENTS) if (s.achievements[a.id]) apply(m, a.reward, 1);
  for (const uid of Object.values(s.equipped)) {
    const it = uid ? s.gear.find((g) => g.uid === uid) : undefined;
    if (it) apply(m, gearEffects(it), 1);
  }
  for (const b of s.buffs) {
    const sp = SPELL_MAP[b.id];
    if (sp) apply(m, ritualEffects(sp, s.spells[b.id] ?? 1), 1);
  }
  if (s.event) {
    const ev = EVENT_MAP[s.event.id];
    if (ev) apply(m, ev.effects, 1);
  }

  m.seedDiscount = Math.min(0.75, m.seedDiscount);
  m.doubleBrew = Math.min(1, m.doubleBrew);
  m.ingredientSave = Math.min(0.5, m.ingredientSave);
  m.critChance = Math.min(0.75, m.critChance);
  m.dodge = Math.min(0.6, m.dodge);
  m.sellPrice = Math.max(0.1, m.sellPrice);
  m.tradeBonus = Math.max(0.1, m.tradeBonus);
  m.attackMult = Math.max(0.1, m.attackMult);
  return m;
}

type StatFormat = 'pct' | 'flat' | 'flag' | 'hours';

export const STAT_INFO: Record<StatKey, { label: string; fmt: StatFormat }> = {
  growSpeed: { label: 'grow speed', fmt: 'pct' },
  harvestYield: { label: 'harvest yield', fmt: 'pct' },
  seedDiscount: { label: 'planting discount', fmt: 'pct' },
  brewSpeed: { label: 'brew speed', fmt: 'pct' },
  doubleBrew: { label: 'double-brew chance', fmt: 'pct' },
  ingredientSave: { label: 'ingredient save chance', fmt: 'pct' },
  masteryRate: { label: 'proficiency gain', fmt: 'pct' },
  sellPrice: { label: 'sell price', fmt: 'pct' },
  demandRecovery: { label: 'demand recovery', fmt: 'pct' },
  tradeBonus: { label: 'trade rewards', fmt: 'pct' },
  contractReward: { label: 'contract gold', fmt: 'pct' },
  repGain: { label: 'reputation gain', fmt: 'pct' },
  scavSpeed: { label: 'expedition speed', fmt: 'pct' },
  scavYield: { label: 'expedition loot', fmt: 'pct' },
  rareFind: { label: 'rare find chance', fmt: 'pct' },
  xpGain: { label: 'XP gain', fmt: 'pct' },
  stoneGain: { label: "Philosopher's Stones", fmt: 'pct' },
  offlineHours: { label: 'offline hours', fmt: 'hours' },
  plots: { label: 'garden plot', fmt: 'flat' },
  cauldrons: { label: 'cauldron', fmt: 'flat' },
  expSlots: { label: 'expedition slot', fmt: 'flat' },
  skillPoints: { label: 'skill points', fmt: 'flat' },
  startGold: { label: 'Inheritance rank', fmt: 'flat' },
  autoHarvest: { label: 'Auto-harvest & replant', fmt: 'flag' },
  autoBrew: { label: 'Auto-repeat brewing', fmt: 'flag' },
  autoSell: { label: 'Auto-sell potions', fmt: 'flag' },
  autoScav: { label: 'Auto-repeat expeditions', fmt: 'flag' },
  autoRitual: { label: 'Auto-cast rituals', fmt: 'flag' },
  attack: { label: 'attack', fmt: 'flat' },
  attackMult: { label: 'attack', fmt: 'pct' },
  defense: { label: 'defense', fmt: 'flat' },
  defenseMult: { label: 'defense', fmt: 'pct' },
  maxHp: { label: 'max HP', fmt: 'flat' },
  hpMult: { label: 'max HP', fmt: 'pct' },
  spellPower: { label: 'spell power', fmt: 'flat' },
  spellMult: { label: 'spell power', fmt: 'pct' },
  critChance: { label: 'crit chance', fmt: 'pct' },
  critDamage: { label: 'crit damage', fmt: 'pct' },
  dodge: { label: 'dodge', fmt: 'pct' },
  maxMana: { label: 'max mana', fmt: 'flat' },
  manaRegen: { label: 'mana/sec', fmt: 'flat' },
  potionPower: { label: 'combat potion power', fmt: 'pct' },
  lootFind: { label: 'dungeon loot', fmt: 'pct' },
  enemyPower: { label: 'enemy strength', fmt: 'pct' },
  spellSlots: { label: 'spell slot', fmt: 'flat' },
  potionSlots: { label: 'potion belt slot', fmt: 'flat' },
};

export function describeEffect(e: Effect, times = 1): string {
  const info = STAT_INFO[e.stat];
  const v = e.value * times;
  const sign = v < 0 ? '−' : '+';
  const a = Math.abs(v);
  switch (info.fmt) {
    case 'pct': return `${sign}${+(a * 100).toFixed(1)}% ${info.label}`;
    case 'flat': return `${sign}${a >= 1000 ? fmt(a) : +a.toFixed(a >= 10 ? 0 : 1)} ${info.label}`;
    case 'hours': return `${sign}${+a.toFixed(1)} ${info.label}`;
    case 'flag': return `Unlocks: ${info.label}`;
  }
}

export function describeEffects(effects: Effect[], times = 1): string {
  return effects.map((e) => describeEffect(e, times)).join(', ');
}
