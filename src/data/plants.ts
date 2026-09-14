export interface PlantDef {
  id: string;
  herb: string; // item produced
  name: string;
  icon: string; // growing icon
  level: number;
  cost: number; // gold to plant
  time: number; // seconds to grow at 1x
  /**
   * Herbs per harvest at 1×. Fractional values are fine — the engine rolls them.
   *
   * These climb with level on purpose. Grow time and seed cost both scale with the herb's value, so a
   * flat yield left every plant earning about the same per minute and there was no reason to ever move
   * on from Sunleaf. Yield is the third term that makes later beds worth the wait.
   */
  yield: number;
}

export const PLANTS: PlantDef[] = [
  { id: 'sunleaf', herb: 'sunleaf', name: 'Sunleaf', icon: '🌱', level: 1, cost: 1, time: 8, yield: 3 },
  { id: 'moonpetal', herb: 'moonpetal', name: 'Moonpetal', icon: '🌱', level: 3, cost: 4, time: 15, yield: 3 },
  { id: 'emberroot', herb: 'emberroot', name: 'Emberroot', icon: '🌱', level: 8, cost: 10, time: 30, yield: 3 },
  { id: 'frostcap', herb: 'frostcap', name: 'Frostcap', icon: '🌱', level: 12, cost: 20, time: 45, yield: 3.7 },
  { id: 'mandrake', herb: 'mandrake', name: 'Mandrake', icon: '🌱', level: 14, cost: 20, time: 50, yield: 3.2 },
  { id: 'dreamlotus', herb: 'dreamlotus', name: 'Dream Lotus', icon: '🌱', level: 20, cost: 50, time: 90, yield: 3.75 },
  { id: 'bloodthorn', herb: 'bloodthorn', name: 'Bloodthorn', icon: '🌱', level: 26, cost: 90, time: 120, yield: 4.6 },
  { id: 'starbloom', herb: 'starbloom', name: 'Starbloom', icon: '🌱', level: 34, cost: 220, time: 180, yield: 5.75 },
  { id: 'witchhazel', herb: 'witchhazel', name: 'Witch Hazel', icon: '🌱', level: 42, cost: 500, time: 230, yield: 6.8 },
  { id: 'voidvine', herb: 'voidvine', name: 'Voidvine', icon: '🌱', level: 50, cost: 1100, time: 300, yield: 8.2 },
  { id: 'ashlily', herb: 'ashlily', name: 'Ashen Lily', icon: '🌱', level: 58, cost: 2500, time: 380, yield: 9.8 },
  { id: 'mirrorbloom', herb: 'mirrorbloom', name: 'Mirrorbloom', icon: '🌱', level: 66, cost: 5800, time: 480, yield: 11.6 },
  { id: 'soulthistle', herb: 'soulthistle', name: 'Soul Thistle', icon: '🌱', level: 74, cost: 13000, time: 600, yield: 13.8 },
  { id: 'glassfern', herb: 'glassfern', name: 'Glass Fern', icon: '🌱', level: 82, cost: 30000, time: 760, yield: 16.4 },
  { id: 'eternabloom', herb: 'eternabloom', name: 'Eternabloom', icon: '🌱', level: 90, cost: 70000, time: 960, yield: 19.5 },
];

export const PLANT_MAP: Record<string, PlantDef> = Object.fromEntries(PLANTS.map((p) => [p.id, p]));
