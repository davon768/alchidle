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
| **Brewing** | 23 recipes, including combat potions; late recipes use earlier *potions* as ingredients | **Proficiency** 1–100 for each potion (see below) |
| **Market** | Selling lowers that potion's demand, which recovers over time. Random "hot seller" events | Potion proficiency milestones widen each potion's market; demand recovery scales |
| **Expeditions** | 7 zones with drop tables, rare finds and parallel parties | **The Endless Rift**: every run goes one level deeper (+12% rewards, +4% time) |
| **Trading Post** | Rotating caravans: barter, bulk potion orders, exotic imports, herb buyers | Offers scale with your unlocks; trade bonus stat |
| **Guilds** | 4 guilds with per-rank perks and milestone unlocks; contracts give gold and reputation | Legend ranks I, II, III… continue forever (×3 reputation each) |
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

Measured with the scripted bot (a perfectly attentive player; real players are roughly 2× slower): level 10 at 14 min, level 30 at ~66 min, level 40 at ~3 h on the first run. The second run reaches each milestone about twice as fast.

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

### High impact, fits the current design
1. **Potion quality tiers** (Common → Fine → Masterwork → Legendary): a small optional stirring/timing minigame on manual brews rolls quality, adding active play on top of idle. Auto-brews roll quality from a skill-based chance.
2. **Research Library**: a long-timer queue (minutes to days) that unlocks recipes, new plants and system upgrades. It is the classic idle "come back later" hook and gives skill points something to compete with.
3. **Plant cross-breeding and mutations**: plant two herbs side by side for a chance at mutated seeds with new traits (fast, bountiful, glowing). This gives endless collection depth.
4. **Familiars**: collectible companions (cat, raven, salamander, homunculus) found on expeditions, leveled with potions, each with a passive buff. Equip 1–3.
5. **Adventurer parties**: hire heroes with classes for expeditions; brewed potions equip them for deeper Rift runs; Rift **bosses** every 10 depths drop unique relics.

### Long-term retention
6. **Second prestige layer, "Transcendence"**: reset ascensions for *Aether*, which opens a new tree, new recipe tier and new zone. It keeps the endless curve fresh after 50+ ascensions.
7. **Challenges**: ascension runs with restrictions (no garden, market prices halved, one cauldron) that grant permanent unique rewards.
8. **Day/night and seasons**: real-time cycles that boost certain herbs and potions (Moonpetal at night, Emberroot in summer).
9. **Events**: Harvest Festival, Blood Moon and Starfall weekends with limited recipes and cosmetic rewards.
10. **Daily quests and weekly guild goals**, kept light with no punishing streaks.

### Polish
11. **Art pass**: replace emoji with a consistent pixel-art or painted icon set; animate cauldrons and plants.
12. **Audio**: bubbling ambience, harvest pops and level-up chimes (Howler.js), with a mute toggle.
13. **Stats and graphs**: gold/hour chart, per-system breakdown, "what's my bottleneck" hints.
14. **Buy-max / bulk buttons** and hotkeys on desktop.
15. **Balancing harness**: a headless bot (the dev `__alchemy` hook already allows this) that plays N hours and logs level, gold and time-to-ascend, so pacing changes can be measured.

### Monetization (if you publish)
Stay ethical and optional: rewarded ad for 2× offline gains, a one-time "supporter pack" (cosmetic cauldrons, extra save slot), cosmetic skins. Avoid energy systems and pay-to-skip in an idle game, where they break the genre's trust.
