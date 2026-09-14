import type { GameState, GearItem, GearSlot, ItemStack } from './types';
import { addGold, addItem, count, emitGain, gainProf, hasAll, profBonusOf, removeItem, toast } from './engine';
import { computeMods } from './mods';
import { DUNGEON_MAP } from '../data/combat';
import {
  FORGE_TIERS, GEAR_CAP, RARITIES, enhanceCost, gearBase, gearName, gearPrimary, gearValue, rollGear, rollRarity, salvageDust,
} from '../data/gear';

export function findGear(s: GameState, uid: string): GearItem | undefined {
  return s.gear.find((g) => g.uid === uid);
}

export function isEquipped(s: GameState, uid: string): boolean {
  return Object.values(s.equipped).includes(uid);
}

export function newGear(s: GameState, tier: number, rarity: number, slot?: GearSlot): GearItem {
  return rollGear(`g${s.nextGearId++}`, tier, rarity, slot);
}

/** Adds a drop to the armory — or salvages it into Arcane Dust if it's below the auto-salvage rarity or the armory is full. */
export function addGear(s: GameState, it: GearItem): void {
  s.stats.gearFound++;
  s.stats.bestRarity = Math.max(s.stats.bestRarity, it.rarity);
  if (it.rarity < s.settings.autoSalvage || s.gear.length >= GEAR_CAP) {
    // A full bag used to swallow drops without a word, which reads as loot simply stopping.
    if (s.gear.length >= GEAR_CAP && it.rarity >= s.settings.autoSalvage) {
      toast(`🎒 Your armory is full (${GEAR_CAP}) — ${gearName(it)} was salvaged for dust. Salvage some gear to keep new finds.`, 'warn');
    }
    addItem(s, 'arcanedust', salvageDust(it));
    return;
  }
  s.gear.push(it);
  emitGain({ key: it.uid, icon: gearBase(it).icon, name: gearName(it), qty: 1, color: RARITIES[it.rarity].color });
  if (it.rarity >= 3) toast(`✨ ${RARITIES[it.rarity].name} drop: ${gearName(it)}`, 'epic');
}

/** Rough power rating used for "better / worse" hints. */
export function gearScore(it: GearItem): number {
  let score = 0;
  for (const e of gearPrimary(it)) {
    score += e.stat === 'maxHp' ? e.value * 0.2 : e.stat === 'maxMana' ? e.value * 0.3 : e.stat === 'defense' ? e.value * 1.5 : e.value;
  }
  return score * (1 + it.affixes.length * 0.08);
}

export function equip(s: GameState, uid: string): void {
  const it = findGear(s, uid);
  if (it) s.equipped[gearBase(it).slot] = uid;
}

export function unequip(s: GameState, slot: GearSlot): void {
  s.equipped[slot] = null;
}

function remove(s: GameState, uid: string): GearItem | null {
  if (isEquipped(s, uid)) return null;
  const i = s.gear.findIndex((g) => g.uid === uid);
  return i < 0 ? null : s.gear.splice(i, 1)[0];
}

export function sellGear(s: GameState, uid: string): void {
  const it = remove(s, uid);
  if (it) addGold(s, gearValue(it));
}

export function salvageGear(s: GameState, uid: string): void {
  const it = remove(s, uid);
  if (it) addItem(s, 'arcanedust', salvageDust(it));
}

export function salvageBelow(s: GameState, rarity: number): void {
  let dust = 0;
  let n = 0;
  for (const it of [...s.gear]) {
    if (it.rarity < rarity && remove(s, it.uid)) {
      dust += salvageDust(it);
      n++;
    }
  }
  if (n > 0) {
    addItem(s, 'arcanedust', dust);
    toast(`Salvaged ${n} item${n > 1 ? 's' : ''} into ${dust} Arcane Dust.`, 'good');
  }
}

export function enhanceGear(s: GameState, uid: string): void {
  const it = findGear(s, uid);
  if (!it) return;
  const cost = enhanceCost(it);
  if (s.gold < cost.gold || count(s, 'arcanedust') < cost.dust) {
    toast('Not enough gold or Arcane Dust.', 'warn');
    return;
  }
  addGold(s, -cost.gold, false);
  removeItem(s, 'arcanedust', cost.dust);
  it.enhance++;
}

export function forgeUnlocked(s: GameState, tier: number): boolean {
  const ft = FORGE_TIERS[tier - 1];
  return !!ft && s.level >= DUNGEON_MAP[ft.dungeon].level;
}

/** Forge cost after the tier's forging-proficiency discount. */
export function forgeCost(s: GameState, tier: number): ItemStack[] {
  const ft = FORGE_TIERS[tier - 1];
  const b = profBonusOf(s, `forge${tier}`);
  return ft.cost.map((c) => ({ id: c.id, qty: Math.ceil(c.qty * (1 - b.cost)) }));
}

export function forgeGear(s: GameState, tier: number, slot: GearSlot): void {
  const ft = FORGE_TIERS[tier - 1];
  if (!ft || !forgeUnlocked(s, tier)) return;
  const cost = forgeCost(s, tier);
  if (!hasAll(s, cost)) {
    toast('Missing forging materials.', 'warn');
    return;
  }
  if (s.gear.length >= GEAR_CAP) {
    toast('Your armory is full — sell or salvage something first.', 'warn');
    return;
  }
  for (const c of cost) c.id === 'gold' ? addGold(s, -c.qty, false) : removeItem(s, c.id, c.qty);
  const b = profBonusOf(s, `forge${tier}`);
  const it = newGear(s, tier, rollRarity(1.5 * (1 + b.luck), 1 + b.minRarity), slot);
  addGear(s, it);
  gainProf(s, computeMods(s), `forge${tier}`);
  toast(`⚒️ Forged ${RARITIES[it.rarity].name} ${gearName(it)}`, it.rarity >= 3 ? 'epic' : 'good');
}
