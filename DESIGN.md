# Alchemy Idle: Design Document

## 1. Core loop

```
 Garden ──herbs──┐
                 ├──► Cauldrons ──potions──► Market / Trading Post / Guild contracts ──► Gold
 Expeditions ─materials┘        │                                                        │
                                └── XP ► Levels ► Skill points ► Skill trees             │
 Gold ► Workshop upgrades & automation ◄──────────────────────────────────────────────────┘
 Gold earned this run ► Magnum Opus (ascension) ► Philosopher's Stones ► Eternal perks ► faster next run
```

Early game is hands-on (click to plant, brew, sell). Automation comes from **apprentices** you hire and train: each role automates one system, and how much it handles grows with training. The game moves from active play to idle play at the pace you invest in your staff.

## 2. Systems (v0.1)

| System | What it does | How it keeps going forever |
|---|---|---|
| **Garden** | 7 herbs, plots grow on a timer, harvest replants automatically | Infinite yield/speed upgrades; "Endless Growth" skill |
| **Brewing** | 23 recipes, including combat potions; late recipes use earlier *potions* as ingredients. Every brew rolls a **quality tier** | **Proficiency** 1–100 for each potion (see below); quality milestones at 30/60/90/100 |
| **Market** | Selling lowers that potion's demand, which recovers over time. Random "hot seller" events | Potion proficiency milestones widen each potion's market; demand recovery scales |
| **Expeditions** | 7 zones with drop tables, rare finds and parallel parties | **The Endless Rift**: every run goes one level deeper (+12% rewards, +4% time) |
| **Trading Post** | Rotating caravans: barter, bulk potion orders, exotic imports, herb buyers | Offers scale with your unlocks; trade bonus stat |
| **Guilds** | 4 guilds with per-rank perks and milestone unlocks; contracts give gold and reputation | Legend ranks I, II, III… continue forever (×3 reputation each) |
| **Research Library** | Long-timer studies (3 min – 12 h) bought with gold and materials, granting permanent bonuses | Two endless projects whose cost and time grow 1.8×/2.1× per repeat |
| **Cross-breeding** | Ripe plots beside a *different* herb throw mutated seeds with one of 4 traits | A seed catalogue of every plant × trait pair, each paying +1% growth and yield forever |
| **Familiars** | 7 companions, one per zone, found on expeditions and levelled by feeding them potions | Level 50 each with a bond every 5 levels; slots go 1 → 3 through the Library |
| **Workshop** | 16 gold upgrades: capacity, infinite multipliers, automation | Infinite-level upgrades with exponential cost |
| **Skill trees** | 5 trees, 52 nodes, row gating (4 points per row), prerequisites, respec | One infinite-rank node per tree absorbs unlimited skill points |
| **Ascension** | Magnum Opus resets the run for Philosopher's Stones (√ of gold earned) | 12 eternal perks, 4 of them infinite; "stone resonance" gives +2% sell price per lifetime stone |
| **Achievements** | 18 achievements, each with a permanent bonus | Easy to add more tiers |
| **Offline progress** | Full simulation of time away (8h base, extendable) with a summary screen | — |

### Combat, magic & events (v0.2)

| System | What it does | How it ties into everything else |
|---|---|---|
| **Dungeons** (level 10) | 6 dungeons (last one endless). You auto-battle floor by floor: 5 foes per floor, and boss floors add a boss after its guards. Death sends you back a floor and pauses auto-advance. Simulated offline too | Drops rare materials that feed potions, reagents and forging. Gold and XP go into the normal economy. Guild slay contracts and Goblin Raid events count your kills |
| **Combat potions** | The potion belt (3+ slots) drinks potions on its own: heals under 50% HP, mana under 25%, re-buffs, bombs on elites and bosses, revives on death | Brewed in the **same cauldrons**. Existing potions gained combat uses (Healing Tonic heals, Emberheart buffs attack, Elixir of Rebirth revives), plus 9 new combat recipes. The `potionPower` stat is the alchemist's edge |
| **Gear** | 4 slots, 6+ tiers, 6 rarities with random affixes, enhancement (+10% base stats per level, endless), Forge crafting, salvage into Arcane Dust, auto-salvage filter | Affixes can roll **economy stats** (grow, brew and expedition speed, sell price, XP), so gear helps every system. Forge costs use dungeon materials |
| **Magic** | Mana pool; 11 combat spells (auto-cast from 2+ spell slots) and 7 rituals (5-minute buffs); spell ranks up to 10 | Rituals buff the garden, cauldrons, market, expeditions and XP through the same modifier pipeline. Reagents are crafted at the Arcane Workbench from herbs, expedition finds and dungeon drops |
| **World events** (level 3) | One random event every 4–8 minutes: 14 kinds, including buffs, mixed trade-offs (Merchant Strike, Eclipse) and specials (Goblin Raid kill quest, Wandering Champion, Mysterious Merchant, Fever in Town) | Plug into modifiers, market demand, the Trading Post and dungeons |
| **Inventory + item pop-ups** | Every item with its count, value, combat effect and "used in" list; NEW badges. Every item gained pops up bottom-left, and repeat gains stack into one counter | Driven by a single `emitGain` hook in `addItem`, so every system reports automatically. Muted during offline catch-up, which gets its own summary |

Also added: Battlemage skill tree (14 nodes), Spellblade Order guild, 4 Workshop upgrades, 3 ascension perks (Eternal Warlord, Arcane Memory, Heirloom Armory) and 8 achievements.

**Combat math:** damage = A²/(A+D), so it never hits zero. Enemies scale ×1.10 per floor and rewards ×1.08. Hero stats = (level base + flat gear) × multipliers.

**Combat balance** (30-minute auto-battle, hero level held fixed): on arrival with previous-tier gear, you reach about 40–85% of a dungeon's floors. With farmed current-tier gear you clear it or nearly clear it. The Dragon's Lair and Void Citadel expect Battlemage skills and ascension perks.

### Potion quality (v0.6)

Every brew rolls one of four tiers — Common, ✦ Fine, ✦✦ Masterwork, ★ Legendary — multiplying that bottle's
sell value (×1 / ×1.6 / ×2.8 / ×6) and its combat potency (×1 / ×1.25 / ×1.6 / ×2.2). Quality must be earned:
a fresh brewer with no proficiency, no quality bonuses and no stirring rolls Common every time, so first-ascension
pacing is unchanged.

The **quality score** feeding the roll is the sum of:

- the `brewQuality` stat — Alchemy skills *Refined Palate* (10 ranks × 0.04) and *Endless Distillation* (0.01/rank)
- that potion's brewing proficiency — milestones at 30, 60, 90 and 100 total +0.5
- the **stirring minigame** on manual brews (below), up to +0.7
- carry-over when a recipe consumes higher-quality potions as ingredients (+0.12 per tier, averaged)

Chances are `fine = min(0.9, q×0.55)`, `master = fine × min(0.5, q×0.25)`, `legend = master × min(0.3, q×0.12)`,
so top tiers stay rare. Expected sale-value multiplier: ×1.00 for a fresh player, ×1.21 at proficiency 100,
×1.47 with the skill node maxed — and ×1.33 on a perfectly stirred manual brew.

**Stirring** is a one-shot window: pressing Brew by hand opens a 3-second sweep bar, and one tap inside the
glowing band banks a bonus for that brew (dead centre pays double the band floor). A miss costs nothing and the
brew proceeds normally, so it never punishes idling; apprentice-repeated brews skip the window entirely and roll
from proficiency and skills alone. This is the game's only active-play minigame — deliberately a single tap at
brew start rather than prompts during the brew, so a 10-minute Panacea never asks to be babysat.

**Interlocks.** Quality raises market price, contract payouts (the guild pays half the quality value on top),
combat potency, and the quality of potions brewed *from* other potions. Combat drinks the best bottle on the
belt; selling, crafting and contracts spend the plainest first, so a Legendary is never consumed by accident.

**Storage.** `items[id]` stays the total and `qual[id][tier]` holds the breakdown, kept in step by
`engine.addItem` / `removeItem`. Systems that only care about totals (demand, auto-sell, recipe inputs) needed
no changes, and pre-quality saves reconcile into Common on first read.

### Research Library (v0.7)

The game's "come back later" hook: every other system pays out in seconds to minutes, so the Library is the
only place a timer runs for hours. 15 studies across four tiers (3 minutes at level 4, up to 12 hours late),
each paid for up front in gold and materials, each granting permanent `Effect[]` through `computeMods` exactly
like upgrades. Studies keep running while the tab is closed and complete correctly during offline catch-up,
and both the queue and the ledger survive ascension — a study begun on one run finishes on the next.

Desks (`researchSlots`) start at 1; *Build the Annex* and *The Scriptorium* each add one, so three studies can
eventually run at once. Two projects (*Continuing Studies*, *Refinement Without End*) are endless, with cost and
time growing 1.8× and 2.1× per completion.

It interlocks with quality in both directions: several studies grant `brewQuality`, and **paying a study's cost
in higher-quality potions shortens it** — up to 35% off, 18% for an all-Legendary payment — which gives
Masterworks a use other than the market.

### Cross-breeding (v0.7)

Harvesting a plot whose neighbour holds a *different* herb has a 2% chance (`mutationChance` scales it) of
throwing a mutated seed: the same herb carrying one of four traits — Swift (×1.4 growth), Bountiful (+2 herbs),
Radiant (35% bonus herb) or Hardy (free to sow, and its replant is free too). Seeds are consumable and a trait
lasts only for the planting it was sown from, so they stay a flow rather than a permanent upgrade.

The permanence lives in the **seed catalogue**: every plant × trait pair ever discovered is recorded forever and
pays +1% growth and +1% harvest yield. With 9 plants × 4 traits that is a +36% ceiling on a collection grind
that only advances when the player deliberately mixes herbs across neighbouring plots — planting one herb
everywhere, as the balance bot does, never crosses at all.

### Familiars (v0.8)

Seven companions, one per zone, each turning up on a completed expedition there (2–4% a run, scaled by
`rareFind`) and never twice. Feeding them potions levels them to 50, and every 5 levels forms a **bond**:
a permanent `Effect[]` applied through `computeMods` while that familiar is out with you. A fully bonded
Hearth Cat is +50% brew speed and +20% quality; the Garden Sprite pushes cross-breeding odds; the Archive
Owl speeds research.

The point is the sink rather than the bonus. Familiars sit between three systems that already exist —
exploration finds them, brewing feeds them, `computeMods` carries their effect — and **feed value scales
with potion quality**, so a ★ Legendary is worth six Commons down a familiar's throat. That gives quality
a use that competes directly with the market, which it previously lacked.

Slots start at 1 and reach 3 through the Library (*Companion Lore*, *The Menagerie*), so which companion
is out is a real choice for most of a run. Familiars and their levels survive ascension.

### Goals (v0.5): the tutorial

28 goals in 7 chapters (Workshop basics, Apprentices, Craft & proficiency, Commerce, Adventure, Magic, The long game) teach every mechanic in the order players meet it. Each goal has a one-line *how*, a short explanation of the mechanic, an optional progress bar, a **Show me** button that opens the right tab, and a one-time reward (gold, or items that help with the next step — for example, the reagent goal pays Rune Chalk and Spell Ink toward learning Firebolt). The banner at the top of every tab shows a claimable goal first, otherwise the next unfinished one; the 🎯 Goals tab lists them all. Goals are checked every second, stay done once reached, and survive ascension, so each reward pays out only once. Content lives in `src/data/goals.ts` — add a goal whenever a new system is added.

### Apprentices (v0.4): replace bought automation

The Workshop's Garden Gnome, Everburning Coal, Trained Falcon and Shop Clerk are gone. Automation now comes from people you hire in the 👥 Apprentices tab (from level 3).

| Role | Automates | Grows with level |
|---|---|---|
| 🧑‍🌾 Gardener | harvest and replant | tends 2 + L/3 plots |
| 🧑‍🔬 Brewer | cauldron 🔁 repeat | tends 1 + L/6 cauldrons |
| 🧝 Scout | expedition 🔁 repeat | tends 1 + L/12 parties |
| 🧑‍💼 Shopkeeper | auto-sell of marked potions | 1 + L/5 potion types |
| 🤺 Squire | resumes pushing floors after a retreat | re-push delay 176s → 15s |
| 🧙 Scribe | recasts auto-marked rituals | 1 + L/10 rituals |

- **Hiring:** 3 candidates rotate every 10 minutes; you can pay to call new ones, and the *Job Fair* event brings 4× more gifted applicants. **Talent** (Common / Gifted / Prodigy: 70 / 25 / 5%) sets the level cap (25 / 40 / 50), learning speed and hiring cost. Each candidate has 1–2 **traits**: Quick Learner, Bookworm, Hard Worker, Frugal, Diligent, Clumsy, or role-affinity traits like Green Thumb (+2 plots as a Gardener).
- **Slots:** 2 to start; more from Apprentice Quarters (Workshop), the Headmaster skill and the Gilded Exchange guild.
- **Training:** apprentices earn XP from the work they do. **Studying** is faster, but costs tuition that rises steeply with level, and they don't work meanwhile. Your own **proficiency** in that craft makes you a better teacher (up to ×2 study speed).
- **Perks every 5 levels** per role (for example, Gardener: +grow speed, +yield, cheaper seeds). They stack across apprentices.
- **Graduation:** at their level cap, an apprentice can graduate into the **Hall of Masters**. They leave, and you get a permanent bonus (× talent: 1 / 1.6 / 2.5) plus +5% apprentice XP for every future apprentice. Masters survive ascension. You choose between keeping a strong worker and banking permanent power.
- **Tie-ins:** the old automation skills and guild milestones now add tending capacity (only while someone of that role is working). New: Training Library (Workshop), Mentorship and Headmaster (Arcana tree), the Loyal Apprentices and Eternal Academy ascension perks, and 3 achievements. Old saves turn bought helpers into level-10 apprentices.

**Backlog ideas for this system:** specializations at level 20 (for example, Gardener → Botanist or Druid); morale and fatigue with rest rotation; lessons that consume ingredients for XP bursts; apprentices as dungeon companions; certification exams at levels 10/25/40 for bonus perks; rival guilds poaching staff; apprentice-driven events ("Ivy had an idea!"); friendships between apprentices who work the same system.

### Proficiency (v0.3): replaces recipe mastery

Every **plant, potion, spell reagent and forge tier** has its own proficiency, levels 1–100 (58 tracks), earned by making that item. XP per action scales with production time, so a 6-second potion and a 10-minute potion level at a similar real-time pace. The curve grows 8.5% per level: about 450K XP to reach 100. The first milestones arrive within minutes to an hour, level 50 takes hours of focus, and level 100 takes **dozens of hours of dedicated production per item**. Maxing all 58 tracks is a very long-term goal. Proficiency is **permanent** through ascension. "Proficiency gain" (the former mastery-gain stat) speeds it up.

Bonuses come from **milestones every 10 levels**, not a small % per level:

| Track | Milestone highlights |
|---|---|
| 🌱 Plants | faster growth (10/40/70), +1 herb per harvest (20/50), cheaper planting (30/90), +value (60), bonus-herb chance (80), **+2 herbs at 100** |
| ⚗️ Potions | faster brewing (10/40/70), +value (20/60/90), extra-potion chance (30), **+1 potion per brew (50 and 100)**, ingredient refunds (80), wider market (40/90), +combat potency (60/100) |
| 🖋️ Reagents | bonus-reagent chance (10/40/80), material refunds (20/60/90), +1 per craft (30/70), **+2 at 100** |
| ⚒️ Forging | cheaper forging (10/30/60/80), rarity luck (20/40/70/90), **minimum Rare at 50, minimum Epic at 100** |

Each milestone raises a notification. The 🎖️ Proficiency tab shows every track, its XP bar, its next milestone and the full milestone checklist. Old saves convert recipe mastery into brewing proficiency XP.

### What persists through ascension
Stones and eternal perks, proficiency, achievements, lifetime stats, settings and your potion belt layout. **Arcane Memory** also keeps spells, and **Heirloom Armory** keeps equipped gear. Everything else resets.

## 3. Balance levers (all in `src/data/`)

- `xpToNext` in `core/state.ts`: level curve (`20 × 1.17^(L-1) + 10L`)
- `stonesFor` in `data/ascension.ts`: prestige formula and the 200K gold minimum
- `riftRewardMult` / `riftTimeMult` in `data/zones.ts`: endless scaling
- `rankThreshold` in `data/guilds.ts`: guild rank curve
- Recipe `value`/`time`/`xp`, plant `cost`/`time`/`yield`, upgrade `baseCost`/`growth`

Pacing targets: first ascension at about 2–4 hours of active play, the Panacea recipe (level 60) around the 3rd–5th ascension, and Rift depth plus infinite nodes as the post-content grind.

Measured with `npm run bot`, 8 runs of 6 simulated hours under its default policy (hire an apprentice
as soon as one is affordable, alternate two herbs so cross-breeding can happen, keep every research desk
busy, buy the cheapest affordable upgrade and skill each step):

| Milestone | Bot | Human (~2× slower) |
|---|---|---|
| Level 10 | ~12 min | ~25 min |
| Level 20 | ~30 min | ~1 h |
| First ascension | **98 min** (range 90–112) | **~3.3 h** |
| An item reaches proficiency 50 | ~158 min | ~5 h |
| An apprentice reaches its cap | ~146 min | ~5 h |

That lands first ascension inside the 2–4 hour design target above. An earlier note in this file put the
bot at ~70 minutes; that figure came from a bot whose policy was not recorded and could not be
reproduced, so it has been replaced rather than chased. **These numbers are only meaningful with the
policy attached** — changing nothing but the order in which the bot hires apprentices moved first
ascension by 30 minutes. Compare configurations with `--single-herb`, `--no-research` and `--no-hire`
rather than reading a single figure as truth.

Cross-breeding and the Research Library were each measured on and off against this policy and land
within run-to-run noise (96–101 minutes across all four combinations), so neither disturbs early pacing.

## 4. Architecture notes

- **One state object** (`GameState`) that is plain JSON, which makes saves trivial. `save.ts` merges any old save onto fresh defaults, so adding fields never breaks existing players. Bump `SAVE_VERSION` and add a migration step when a field changes meaning.
- **Mods pipeline** (`core/mods.ts`): skills, upgrades, guild, ascension and achievements all emit `Effect { stat, value }`. Every system reads from one computed `Mods` object, and new sources plug in with one loop.
- **Deterministic tick** (`engine.tick(state, dt)`) handles any `dt`, so the same code runs 100 ms live ticks, throttled background tabs and 8+ hours of offline catch-up.
- **Numbers** are JS doubles (max ~1.8e308). If late-game scaling ever pushes past that, swap in `break_eternity.js` behind `format.ts`.

## 5. Android

Capacitor wraps the built web app in a native Android project and gives access to native plugins.

```bash
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli
npx cap init "Alchemy Idle" com.yourname.alchemyidle --web-dir dist
npm run build
npx cap add android
npx cap sync android
npx cap open android     # then Run, or Build > Generate Signed App Bundle for Play Store
```

After any web change: `npm run build && npx cap sync android`.

Recommended Android hardening:
1. **Storage**: move saves from `localStorage` to `@capacitor/preferences`, because Android can clear WebView storage. Only `core/save.ts` changes.
2. **Lifecycle**: `@capacitor/app` `pause`/`resume` events. The game already saves on `visibilitychange` and catches up on resume.
3. **Local notifications**: "Your cauldrons have finished" / "Offline storage is full" via `@capacitor/local-notifications`.
4. **Cloud saves**: Google Play Games Saved Games, or Firebase, to sync between browser and phone.
5. Status bar, splash screen and app icon via `@capacitor/status-bar`, `@capacitor/splash-screen` and `@capacitor/assets`.

The UI is already mobile-ready: bottom tab bar under 760 px, safe-area insets, touch-sized buttons, no hover-only controls.

## 6. Recommended additions (prioritized)

*Shipped since this list was written: potion quality tiers (v0.6), the Research Library and cross-breeding (v0.7), familiars and bulk buying (v0.8), events (v0.2) and the scripted balance bot — all documented in §2.*

### High impact, fits the current design
1. **Adventurer parties**: hire heroes with classes for expeditions; brewed potions equip them for deeper Rift runs; Rift **bosses** every 10 depths drop unique relics.

### Long-term retention
2. **Second prestige layer, "Transcendence"**: reset ascensions for *Aether*, which opens a new tree, new recipe tier and new zone. It keeps the endless curve fresh after 50+ ascensions.
3. **Challenges**: ascension runs with restrictions (no garden, market prices halved, one cauldron) that grant permanent unique rewards.
4. **Day/night and seasons**: real-time cycles that boost certain herbs and potions (Moonpetal at night, Emberroot in summer).
5. **Daily quests and weekly guild goals**, kept light with no punishing streaks.

### Polish
6. **Art pass**: replace emoji with a consistent pixel-art or painted icon set; animate cauldrons and plants.
7. **Audio**: bubbling ambience, harvest pops and level-up chimes (Howler.js), with a mute toggle.
8. **Stats and graphs**: gold/hour chart, per-system breakdown, "what's my bottleneck" hints.

### Monetization (if you publish)
Stay ethical and optional: rewarded ad for 2× offline gains, a one-time "supporter pack" (cosmetic cauldrons, extra save slot), cosmetic skins. Avoid energy systems and pay-to-skip in an idle game, where they break the genre's trust.
