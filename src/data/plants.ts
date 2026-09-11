export interface PlantDef {
  id: string;
  herb: string; // item produced
  name: string;
  icon: string; // growing icon
  level: number;
  cost: number; // gold to plant
  time: number; // seconds to grow at 1x
  yield: number; // herbs per harvest at 1x
}

export const PLANTS: PlantDef[] = [
  { id: 'sunleaf', herb: 'sunleaf', name: 'Sunleaf', icon: '🌱', level: 1, cost: 1, time: 8, yield: 3 },
  { id: 'moonpetal', herb: 'moonpetal', name: 'Moonpetal', icon: '🌱', level: 3, cost: 4, time: 15, yield: 3 },
  { id: 'emberroot', herb: 'emberroot', name: 'Emberroot', icon: '🌱', level: 8, cost: 10, time: 30, yield: 3 },
  { id: 'frostcap', herb: 'frostcap', name: 'Frostcap', icon: '🌱', level: 12, cost: 20, time: 45, yield: 3 },
  { id: 'mandrake', herb: 'mandrake', name: 'Mandrake', icon: '🌱', level: 14, cost: 20, time: 50, yield: 2 },
  { id: 'dreamlotus', herb: 'dreamlotus', name: 'Dream Lotus', icon: '🌱', level: 20, cost: 50, time: 90, yield: 2 },
  { id: 'bloodthorn', herb: 'bloodthorn', name: 'Bloodthorn', icon: '🌱', level: 26, cost: 90, time: 120, yield: 2 },
  { id: 'starbloom', herb: 'starbloom', name: 'Starbloom', icon: '🌱', level: 34, cost: 220, time: 180, yield: 2 },
  { id: 'voidvine', herb: 'voidvine', name: 'Voidvine', icon: '🌱', level: 50, cost: 1100, time: 300, yield: 2 },
];

export const PLANT_MAP: Record<string, PlantDef> = Object.fromEntries(PLANTS.map((p) => [p.id, p]));
