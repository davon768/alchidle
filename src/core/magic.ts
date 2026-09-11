import type { GameState, ItemStack, Mods } from './types';
import { computeMods } from './mods';
import { addGold, addItem, count, gainProf, hasAll, profBonusOf, removeItem, rollAmount, toast } from './engine';
import { REAGENTS, SPELL_MAP, type SpellDef } from '../data/spells';

export function manaMax(s: GameState, m: Mods): number {
  return 40 + 4 * s.level + m.maxMana;
}
export function manaRegenRate(s: GameState, m: Mods): number {
  return 0.5 + 0.03 * s.level + m.manaRegen;
}

function pay(s: GameState, stacks: ItemStack[], times = 1): void {
  for (const st of stacks) st.id === 'gold' ? addGold(s, -st.qty * times, false) : removeItem(s, st.id, st.qty * times);
}

export function rankUpCost(sp: SpellDef, rank: number): ItemStack[] {
  return sp.rankCost.map((c) => ({ id: c.id, qty: c.qty * rank }));
}

export function maxCraftable(s: GameState, inputs: ItemStack[]): number {
  return Math.min(...inputs.map((i) => Math.floor(count(s, i.id) / i.qty)));
}

// ── Spellbook ────────────────────────────────────────────────
export function learnSpell(s: GameState, id: string): void {
  const sp = SPELL_MAP[id];
  if (!sp || s.spells[id] || s.level < sp.level) return;
  if (!hasAll(s, sp.learn)) {
    toast('Missing reagents or gold to learn that spell.', 'warn');
    return;
  }
  pay(s, sp.learn);
  s.spells[id] = 1;
  toast(`📘 Learned ${sp.icon} ${sp.name}!`, 'epic');
  if (sp.kind === 'combat' && s.spellSlots.length < Math.floor(computeMods(s).spellSlots)) s.spellSlots.push(id);
}

export function rankUpSpell(s: GameState, id: string): void {
  const sp = SPELL_MAP[id];
  const rank = s.spells[id] ?? 0;
  if (!sp || rank <= 0 || rank >= sp.maxRank) return;
  const cost = rankUpCost(sp, rank);
  if (!hasAll(s, cost)) {
    toast('Missing reagents for that rank.', 'warn');
    return;
  }
  pay(s, cost);
  s.spells[id] = rank + 1;
}

export function toggleSpellSlot(s: GameState, id: string): void {
  const i = s.spellSlots.indexOf(id);
  if (i >= 0) {
    s.spellSlots.splice(i, 1);
    return;
  }
  if (!s.spells[id] || SPELL_MAP[id]?.kind !== 'combat') return;
  if (s.spellSlots.length >= Math.floor(computeMods(s).spellSlots)) {
    toast('All spell slots are full — unequip one first.', 'warn');
    return;
  }
  s.spellSlots.push(id);
}

// ── Rituals ──────────────────────────────────────────────────
export function castRitual(s: GameState, id: string, auto = false): boolean {
  const sp = SPELL_MAP[id];
  if (!sp?.ritual || !s.spells[id]) return false;
  if (s.mana < sp.mana || !hasAll(s, sp.ritual.reagents)) {
    if (!auto) toast('Not enough mana or reagents for that ritual.', 'warn');
    return false;
  }
  s.mana -= sp.mana;
  pay(s, sp.ritual.reagents);
  const existing = s.buffs.find((b) => b.id === id);
  if (existing) existing.remaining = sp.ritual.duration;
  else s.buffs.push({ id, remaining: sp.ritual.duration });
  s.stats.spellsCast++;
  if (!auto) toast(`${sp.icon} ${sp.name} empowers your work.`, 'good');
  return true;
}

export function toggleAutoRitual(s: GameState, id: string): void {
  if (computeMods(s).autoRitual <= 0) {
    toast('Learn Ritualist in the Battlemage tree to auto-cast rituals.', 'warn');
    return;
  }
  s.autoRituals[id] = !s.autoRituals[id];
}

// ── Workbench ────────────────────────────────────────────────
export function craftReagent(s: GameState, id: string, qty: number): void {
  const r = REAGENTS.find((x) => x.id === id);
  if (!r || r.level > s.level) return;
  const n = Math.min(qty, maxCraftable(s, r.inputs));
  if (n <= 0) {
    toast('Missing materials.', 'warn');
    return;
  }
  // Scribing proficiency: refunded crafts cost nothing, and each craft can yield extra reagents.
  const b = profBonusOf(s, id);
  const refunded = Math.min(n, rollAmount(n * b.save));
  pay(s, r.inputs, n - refunded);
  addItem(s, id, n * (1 + b.yield) + rollAmount(n * b.double));
  gainProf(s, computeMods(s), id, n);
}

// ── Tick ─────────────────────────────────────────────────────
export function tickMagic(s: GameState, m: Mods, dt: number): void {
  s.mana = Math.min(manaMax(s, m), s.mana + manaRegenRate(s, m) * dt);
  if (s.buffs.length) {
    for (const b of s.buffs) b.remaining -= dt;
    s.buffs = s.buffs.filter((b) => b.remaining > 0);
  }
  if (m.autoRitual > 0) {
    for (const [id, on] of Object.entries(s.autoRituals)) {
      if (on && !s.buffs.some((b) => b.id === id)) castRitual(s, id, true);
    }
  }
}
