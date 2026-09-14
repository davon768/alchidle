/**
 * The Research Library: a queue of long-timer projects (minutes to days) that grant permanent bonuses.
 *
 * It is the game's "come back later" hook — every other system pays out in seconds to minutes — and the
 * only competitor for the materials the player would otherwise sell. Projects survive ascension, so a
 * study started on one run finishes on the next.
 */
import type { Effect, ItemStack, RoleId } from '../core/types';

export interface ResearchDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  level: number; // player level before it appears
  time: number; // seconds at 1× research speed
  cost: ItemStack[]; // paid when the study starts; 'gold' allowed
  req?: string[]; // other research ids that must be finished first
  effects?: Effect[]; // permanent modifiers, applied once finished (per completion when repeatable)
  unlocksRole?: RoleId; // brings this craft's apprentice into the workshop when the study finishes
  repeat?: boolean; // endless: can be researched again and again, cost and time growing each time
  growth?: number; // cost/time multiplier per completion for repeatable projects
}

/** Player level at which the Library tab appears — matches the first study. */
export const RESEARCH_UNLOCK_LEVEL = 3;

const MIN = 60;
const HOUR = 3600;

export const RESEARCH: ResearchDef[] = [
  // ── Tier 1: the first hour ──────────────────────────────────
  // Apprentices are unlocked here rather than hired. Each is cheap and quick, so automation arrives
  // steadily through the early game instead of waiting on a lucky roll in a candidate list.
  { id: 'appr_gardener', name: 'A Gardener\'s Hands', icon: '🧑‍🌾', level: 3, time: 2 * MIN,
    desc: 'Write down how the beds are kept, and someone can keep them for you.',
    cost: [{ id: 'gold', qty: 150 }], unlocksRole: 'gardener' },
  { id: 'appr_brewer', name: 'A Brewer\'s Notes', icon: '🧑‍🔬', level: 5, time: 6 * MIN,
    desc: 'Set the method down plainly and the cauldrons need not be watched.',
    cost: [{ id: 'gold', qty: 600 }], unlocksRole: 'brewer' },
  { id: 'appr_scout', name: 'Trail Signs', icon: '🧝', level: 8, time: 20 * MIN,
    desc: 'Map the safe roads so a party can walk them without you.',
    cost: [{ id: 'gold', qty: 4000 }, { id: 'batwing', qty: 10 }], unlocksRole: 'scout' },
  { id: 'appr_shopkeeper', name: 'Shop Ledgers', icon: '🧑‍💼', level: 11, time: 40 * MIN,
    desc: 'Somebody has to mind the counter while you are at the cauldron.',
    cost: [{ id: 'gold', qty: 18000 }], req: ['ledger'], unlocksRole: 'shopkeeper' },
  { id: 'appr_squire', name: 'Squire\'s Drill', icon: '🤺', level: 14, time: 90 * MIN,
    desc: 'Teach one to carry the pack, and to say get up when you would rather not.',
    cost: [{ id: 'gold', qty: 60000 }, { id: 'ironore', qty: 30 }], unlocksRole: 'squire' },
  { id: 'appr_scribe', name: 'A Scribe\'s Alphabet', icon: '🧙', level: 18, time: 3 * HOUR,
    desc: 'The sigils can be copied. Slowly, and by someone else.',
    cost: [{ id: 'gold', qty: 200000 }, { id: 'soulink', qty: 6 }], req: ['annex'], unlocksRole: 'scribe' },

  { id: 'company', name: 'Charter a Company', icon: '🏕️', level: 16, time: 2 * HOUR,
    desc: 'Sign articles with a sell-sword, and give your Captain someone to shout at.',
    cost: [{ id: 'gold', qty: 120000 }, { id: 'relic', qty: 4 }], req: ['cartography'], unlocksRole: 'captain',
    effects: [{ stat: 'partySlots', value: 2 }] },
  { id: 'expedition_writ', name: 'The Deep Writ', icon: '📜', level: 22, time: 5 * HOUR,
    desc: 'Standing orders that let two more adventurers draw supplies from your stores.',
    cost: [{ id: 'gold', qty: 800000 }, { id: 'voidessence', qty: 4 }], req: ['company', 'scriptorium'],
    effects: [{ stat: 'partySlots', value: 2 }, { stat: 'kitSlots', value: 1 }] },
  { id: 'catalog', name: 'Catalogue the Shelves', icon: '🗂️', level: 4, time: 3 * MIN,
    desc: 'Put the library in order. Everything after this goes faster.',
    cost: [{ id: 'gold', qty: 400 }],
    effects: [{ stat: 'researchSpeed', value: 0.25 }] },
  { id: 'glasswork', name: 'Finer Glasswork', icon: '🔬', level: 5, time: 8 * MIN,
    desc: 'Thinner walls, truer measures — every brew comes out a little better.',
    cost: [{ id: 'gold', qty: 900 }, { id: 'quartz', qty: 8 }], req: ['catalog'],
    effects: [{ stat: 'brewQuality', value: 0.08 }] },
  { id: 'soil', name: 'Soil Chemistry', icon: '🧫', level: 5, time: 10 * MIN,
    desc: 'Understand what the herbs actually eat.',
    cost: [{ id: 'gold', qty: 1200 }, { id: 'sunleaf', qty: 60 }], req: ['catalog'],
    effects: [{ stat: 'growSpeed', value: 0.2 }, { stat: 'harvestYield', value: 0.15 }] },
  { id: 'ledger', name: 'The Merchant\'s Ledger', icon: '📒', level: 7, time: 15 * MIN,
    desc: 'Study what the town actually pays, and when.',
    cost: [{ id: 'gold', qty: 2500 }], req: ['catalog'],
    effects: [{ stat: 'sellPrice', value: 0.15 }, { stat: 'demandRecovery', value: 0.3 }] },

  // ── Tier 2: an evening ──────────────────────────────────────
  { id: 'annex', name: 'Build the Annex', icon: '🏛️', level: 9, time: 40 * MIN,
    desc: 'A second reading desk. Two studies can run at once.',
    cost: [{ id: 'gold', qty: 9000 }, { id: 'ironore', qty: 20 }], req: ['catalog'],
    effects: [{ stat: 'researchSlots', value: 1 }] },
  { id: 'distillation', name: 'Theory of Distillation', icon: '⚗️', level: 10, time: 35 * MIN,
    desc: 'Why the second pass is always cleaner than the first.',
    cost: [{ id: 'gold', qty: 7000 }, { id: 'p_heal', qty: 15 }], req: ['glasswork'],
    effects: [{ stat: 'brewSpeed', value: 0.2 }, { stat: 'brewQuality', value: 0.1 }] },
  { id: 'cartography', name: 'Cartography', icon: '🗺️', level: 12, time: 50 * MIN,
    desc: 'Better maps mean shorter roads and richer hauls.',
    cost: [{ id: 'gold', qty: 12000 }, { id: 'relic', qty: 2 }], req: ['ledger'],
    effects: [{ stat: 'scavSpeed', value: 0.25 }, { stat: 'rareFind', value: 0.3 }] },
  { id: 'companionship', name: 'Companion Lore', icon: '🐾', level: 11, time: 45 * MIN,
    desc: 'Learn what they eat, and why a second one tolerates the first.',
    cost: [{ id: 'gold', qty: 15000 }, { id: 'p_heal', qty: 20 }], req: ['catalog'],
    effects: [{ stat: 'familiarSlots', value: 1 }] },
  { id: 'grafting', name: 'Grafting and Cuttings', icon: '🌿', level: 13, time: 75 * MIN,
    desc: 'Coax a cutting into taking root, and the strange herbs become growable.',
    cost: [{ id: 'gold', qty: 18000 }, { id: 'mandrake', qty: 12 }], req: ['soil'],
    effects: [{ stat: 'growSpeed', value: 0.15 }] },

  // ── Tier 3: overnight ───────────────────────────────────────
  { id: 'pedagogy', name: 'Pedagogy', icon: '🎓', level: 15, time: 3 * HOUR,
    desc: 'Teach properly and your apprentices learn twice as fast.',
    cost: [{ id: 'gold', qty: 60000 }, { id: 'crystal', qty: 15 }], req: ['annex'],
    effects: [{ stat: 'apprenticeXp', value: 0.5 }, { stat: 'masteryRate', value: 0.15 }] },
  { id: 'transmute', name: 'Principles of Transmutation', icon: '🜛', level: 18, time: 5 * HOUR,
    desc: 'The Great Work, approached honestly for once.',
    cost: [{ id: 'gold', qty: 150000 }, { id: 'p_clarity', qty: 8 }, { id: 'elemcore', qty: 4 }], req: ['distillation', 'pedagogy'],
    effects: [{ stat: 'brewQuality', value: 0.15 }, { stat: 'xpGain', value: 0.2 }] },
  { id: 'scriptorium', name: 'The Scriptorium', icon: '📜', level: 20, time: 6 * HOUR,
    desc: 'A third desk, and scribes who know what to do with it.',
    cost: [{ id: 'gold', qty: 400000 }, { id: 'soulink', qty: 10 }], req: ['pedagogy'],
    effects: [{ stat: 'researchSlots', value: 1 }, { stat: 'researchSpeed', value: 0.5 }] },

  // ── Tier 4: the long haul, and the endless tail ─────────────
  { id: 'menagerie', name: 'The Menagerie', icon: '🏛️', level: 24, time: 7 * HOUR,
    desc: 'Room, board and bickering for a third companion.',
    cost: [{ id: 'gold', qty: 900000 }, { id: 'crystal', qty: 30 }], req: ['companionship', 'scriptorium'],
    effects: [{ stat: 'familiarSlots', value: 1 }] },
  { id: 'starcharts', name: 'Star Charts', icon: '🌌', level: 28, time: 12 * HOUR,
    desc: 'Chart what falls, and learn to catch it.',
    cost: [{ id: 'gold', qty: 3000000 }, { id: 'stardust', qty: 40 }], req: ['transmute', 'cartography'],
    effects: [{ stat: 'rareFind', value: 0.5 }, { stat: 'stoneGain', value: 0.15 }] },
  { id: 'sigilcraft', name: 'Sigil Craft', icon: '🔹', level: 40, time: 6 * HOUR,
    desc: 'A third sigil on the belt, and a deeper well to draw it from.',
    cost: [{ id: 'gold', qty: 500000 }, { id: 'soulink', qty: 20 }], req: ['scriptorium'],
    effects: [{ stat: 'spellSlots', value: 1 }, { stat: 'maxMana', value: 60 }] },
  { id: 'highsigil', name: 'The High Sigils', icon: '🔆', level: 72, time: 16 * HOUR,
    desc: 'The sigils the Bastion was built to contain. One more slot, and the mana to fill it.',
    cost: [{ id: 'gold', qty: 2e8 }, { id: 'titansigil', qty: 3 }], req: ['sigilcraft', 'starcharts'],
    effects: [{ stat: 'spellSlots', value: 1 }, { stat: 'maxMana', value: 240 }, { stat: 'manaRegen', value: 2 }] },
  { id: 'endless_study', name: 'Continuing Studies', icon: '♾️', level: 16, time: 90 * MIN,
    desc: 'There is always more to read. Each repetition costs and takes more.',
    cost: [{ id: 'gold', qty: 50000 }], req: ['annex'], repeat: true, growth: 1.8,
    effects: [{ stat: 'brewSpeed', value: 0.04 }, { stat: 'growSpeed', value: 0.04 }, { stat: 'scavSpeed', value: 0.04 }] },
  { id: 'endless_refine', name: 'Refinement Without End', icon: '💠', level: 22, time: 4 * HOUR,
    desc: 'Chase the perfect bottle forever.',
    cost: [{ id: 'gold', qty: 500000 }, { id: 'crystal', qty: 25 }], req: ['transmute'], repeat: true, growth: 2.1,
    effects: [{ stat: 'brewQuality', value: 0.03 }, { stat: 'sellPrice', value: 0.05 }] },
];

export const RESEARCH_MAP: Record<string, ResearchDef> = Object.fromEntries(RESEARCH.map((r) => [r.id, r]));

/** Cost and time grow for each completion of a repeatable project. */
export function researchCost(def: ResearchDef, done: number): ItemStack[] {
  const g = def.repeat ? (def.growth ?? 1.8) ** done : 1;
  return def.cost.map((c) => ({ id: c.id, qty: Math.ceil(c.qty * g) }));
}
export function researchTime(def: ResearchDef, done: number): number {
  const g = def.repeat ? (def.growth ?? 1.8) ** done : 1;
  return def.time * g;
}

/** Higher-quality potions spent on a study shorten it — up to a third off for an all-Legendary payment. */
export const QUALITY_RESEARCH_BOOST = 0.06;
