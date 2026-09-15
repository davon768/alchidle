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

Early game is hands-on (click to plant, brew, sell). Automation comes from **apprentices**: one per craft, unlocked by study in the Library, each automating one system. They level by doing the work and spend the skill points where you tell them, so the game moves from active play to idle play at the pace you invest in your staff.

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
| **Dungeons** (level 10) | 8 dungeons (the Void Citadel endless). You auto-battle floor by floor: 5 foes per floor, and boss floors add a boss after its guards. Death sends you back a floor and pauses auto-advance. Simulated offline too | Drops rare materials that feed potions, reagents and forging. Gold and XP go into the normal economy. Guild slay contracts and Goblin Raid events count your kills |
| **Combat potions** | The potion belt (3+ slots) drinks potions on its own: heals under 50% HP, mana under 25%, re-buffs, bombs on elites and bosses, revives on death | Brewed in the **same cauldrons**. Existing potions gained combat uses (Healing Tonic heals, Emberheart buffs attack, Elixir of Rebirth revives), plus 9 new combat recipes. The `potionPower` stat is the alchemist's edge |
| **Gear** | 4 slots, 6+ tiers, 6 rarities with random affixes, enhancement (+10% base stats per level, endless), Forge crafting, salvage into Arcane Dust, auto-salvage filter | Affixes can roll **economy stats** (grow, brew and expedition speed, sell price, XP), so gear helps every system. Forge costs use dungeon materials |
| **Magic** | Mana pool; 18 combat spells (auto-cast from 2–6 spell slots) and 11 rituals (5-minute buffs); spell ranks up to 10; 13 reagents | Rituals buff the garden, cauldrons, market, expeditions and XP through the same modifier pipeline. Reagents are crafted at the Arcane Workbench from herbs, expedition finds and dungeon drops |
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
brew proceeds normally, so it never punishes idling.

**Your Brewer stirs too.** Quality used to be reachable only by hand, which left idle players — the game's core
audience — at about ×1.04 after six hours. A Brewer apprentice now stirs the pots they tend: half a perfect stir
by level 40 (`min(0.5, level/80)` of `STIR_MAX`), plus 0.12 per rank of their *Practised Stir* node. Hand-stirring
still pays more, and a hand stir replaces the apprentice's effort rather than stacking with it. This is the game's only active-play minigame — deliberately a single tap at
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

**Study time** responds to two things: the `researchSpeed` stat (Archive Owl, the Scribe's Careful Copyist, Library studies), and the quality of the potions paid as cost. The quality cut reaches a third off for an all-Legendary payment, but only when **Pay studies with your finest bottles** is on in the Library — every other system spends cheapest-first, and that default made the bonus unreachable in practice. Off by default: handing the Library your best bottles is a real trade against selling them. The Library shows the cut per study (`−33% quality`) and, when a study charges in potions but the toggle is off, says `no quality bonus` rather than quietly showing the full time. Display and payout share one pure model — `studyCut` in `core/engine.ts` — so the number on the row is the number banked when the study starts.

### Cross-breeding (v0.7, seed tray reworked in v1.0)

Harvesting a plot whose neighbour holds a *different* herb has a 2% chance (`mutationChance` scales it) of
throwing a mutated seed: the same herb carrying one of four traits — Swift (growth), Bountiful (flat herbs),
Radiant (bonus-herb chance) or Hardy (free to sow and free to replant).

**A seed is a permanent upgrade to one bed.** Sowing puts the strain on that plot and it stays there through
every replant, the Gardener's included. It was previously cleared on harvest, which quietly made the whole
system dead content: the moment an apprentice took over, no plot was ever empty, the tray's sow button
(which targeted the first empty plot) did nothing at all, and seeds simply accumulated.

**Surplus seeds breed the strain deeper.** Once every bed that can carry a strain does, further seeds raise
its *rank*, and every bed carrying it gets stronger: `strainStrength(rank) = 1 + 0.35 × log₂(rank)`, applied to
the trait's bonus. Rank 1 is exactly the old value (Swift +40%), rank 9 is +84%, rank 100 is +133%. The curve
has to be logarithmic because supply outruns any fixed number of beds — a mature garden throws ~2,400 seeds a
day against sixteen plots, so a sink with a ceiling just refills the tray. Ranks are permanent and survive
ascension, like the catalogue.

Measured: seeds held after 24 h went from 34–65 sitting unused to 0–1, with no change to first-ascension
pacing (88.8 min mean over four runs, against 90.2 before).

The other permanence lives in the **seed catalogue**: every plant × trait pair ever discovered is recorded
forever and pays +1% growth and +1% harvest yield. With 9 plants × 4 traits that is a +36% ceiling on a
collection grind that only advances when the player deliberately mixes herbs across neighbouring plots —
planting one herb everywhere never crosses at all.

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

### Adventurer parties (v1.0)

A company you hire, supply from your own cauldrons, and send down the Endless Rift. It is the system that
ties brewing, quality, exploration, apprentices and ascension into one line of progression.

**The roster.** Six classes (`data/adventurers.ts`) — Warden, Blademaster, Ranger, Rift Mage, Cleric,
Rogue — trading power against *guard* (who gets hurt), *haul*, *relic luck* and *mend*. Each signing fee is
4.2× the last (2.5K, 10.5K, 44K…), and seats come from the Library (*Charter a Company* +2, *The Deep Writ*
+2), the Captain's tree (+4) and one relic, capped at 8. Adventurers level 1–60 on delve XP alone, so a
maxed hero is tens of hours of delving.

**Supplies are the hook.** Each delve drinks one bottle of every kitted potion per adventurer, plus another
round for every ten depths, *finest bottles first* — so Legendary brewing converts directly into depth
(`SUPPLY_WEIGHT × potency`, and potency already folds in belt bonuses, proficiency and the quality tier).
Two kit slots to start, up to six through the Captain and the Everfull Phial.

**The ladder.** Depth *d* demands `30 × 1.18^d` power and takes `100 × 1.04^d` seconds; odds run from 5% at
half the demanded power to 95% at triple. Winning banks the depth for good — the ladder is a ratchet.
Losing costs the supplies, pays 30% of the haul and half XP, and puts one adventurer (weighted toward the
lightly armoured) on a rest timer. **Nobody is ever lost**, which is what lets the company idle safely.

**Bosses and relics.** Every tenth depth is a boss at 2.2× power and 1.5× time, and the only guaranteed
source of a **relic** (`data/relics.ts`). Relics are permanent stacking *ranks*, not gear: pulling one again
raises its rank, and they feed `computeMods` like every other bonus. Nine of them, from the Ward Stone at
depth 10 to the Crown of the Deep at 50. A Rogue turns them up between bosses.

**Interlocks.** Selling — in bulk or by a Shopkeeper on auto — holds back what the kit needs on top of the player's own reserve, so supplying the party and running a potion shop are not silently at war. The Captain apprentice resupplies and re-sends the company (`autoDelve`); mapped depth pays
the whole workshop +5% rare finds and +3% expedition loot per 5 depths; delves eat potions and return the
materials the forge and the Arcanum want, plus player XP. Roster, relics and depth all survive ascension;
the delve in progress does not.

Bot-measured: first relic inside the first day, depth ~28 after 24 h with two adventurers, and no
measurable change to the ~90-minute first ascension — the charter costs 120K gold and lands well after it.

### The Ledger (v1.1): income attribution and stalls

Sixteen systems feed one purse and nothing said which of them was carrying a run. The Ledger tags every
coin where it arrives (`addGold` is the single entry point, so attribution is one parameter) and reports
income by source over the last hour, with a per-minute sparkline and lifetime totals as a fallback.

The more useful half is **stalls**: the specific, actionable ways a workshop stops earning — a cauldron
idle for want of one named herb, beds lying fallow, empty expedition slots or research desks, an idle
company, a flooded potion market, unspent skill points, unclaimed goals. Each names the fix and links to
the tab. Ingredient stalls record *what was missing when they stalled*, since by the time you look the
garden has usually delivered, and they fade over five minutes so a problem you have solved stops being
reported.

The recent window is in memory, not the save: it is a diagnostic, and an hour of per-source buckets would
be a large share of a 10 KB save. Lifetime totals live in `s.income` and survive ascension.

Building it found a real bug it was designed to find: **a cauldron on Repeat that ran out of ingredients
stopped permanently**, because the only restart lived inside a loop guarded on `c.active`. Restocking did
nothing — Repeat stayed lit and the cauldron never brewed again. The tick now retries idle repeat
cauldrons every step, which is also where the stall data comes from.

### Goals (v0.5): the tutorial

32 goals in 8 chapters (Workshop basics, Apprentices, Craft & proficiency, Commerce, Adventure, Magic, The company, The long game) teach every mechanic in the order players meet it. Each goal has a one-line *how*, a short explanation of the mechanic, an optional progress bar, a **Show me** button that opens the right tab, and a one-time reward (gold, or items that help with the next step — for example, the reagent goal pays Rune Chalk and Spell Ink toward learning Firebolt). The banner at the top of every tab shows a claimable goal first, otherwise the next unfinished one; the 🎯 Goals tab lists them all. Goals are checked every second, stay done once reached, and survive ascension, so each reward pays out only once. Content lives in `src/data/goals.ts` — add a goal whenever a new system is added.

### Apprentices (v0.9): one per craft, shaped by you

Six crafts, six apprentices, no hiring. Each is unlocked by its own study in the Library — *A Gardener's
Hands* at level 3 through *A Scribe's Alphabet* at 18 — so automation arrives on a schedule you can
plan around rather than when a candidate list happens to offer something good.

- **They level by working.** Every plot harvested, cauldron repeated, party sent or potion auto-sold
  credits the apprentice that tended it, and only up to the number it actually tends. Your own
  **proficiency** in that craft makes you a better teacher (up to ×2 at proficiency 100). Level 60 is
  the ceiling; roughly level 20 by a first ascension and 50 after a long haul.
- **Every level is one skill point**, spent in that craft's **upgrade tree**. Five or six nodes per
  role across four rows, each row opening after 3 more points are spent in that tree, ending in an
  infinite-rank node whose cost creeps up. Points can be refunded in full at any time (*Rethink*) —
  they were earned by working, so there is nothing to punish.
- **Breadth or depth is the decision.** A capacity node (*More Beds*, *Another Burner*, *Second Party*…)
  means tending more units; the stat nodes mean tending the same few better. That trade is the whole
  system — a Gardener on ten beds and a Gardener on three superb ones are both valid.
- **Trees reach into other systems.** The Gardener's *Curious Grafter* raises cross-breeding odds, the
  Brewer's *Fine Hand* raises potion quality, the Scout's *Keen Eye* finds familiars sooner, the
  Shopkeeper's *Word of Mouth* speeds demand recovery, the Scribe's *Careful Copyist* speeds research.
- **They survive ascension**, levels and spent points both, like proficiency and research.

What this replaced: hiring from a rolling candidate list, talent tiers (Common/Gifted/Prodigy) that set
a level cap, random traits, apprentice slots, tuition-funded study, and graduation into a Hall of
Masters. All of it was a hunt for a good roll rather than a decision. Old saves convert every craft
that was staffed — working or graduated — into that craft's apprentice with the XP its level
represented, and leave the points unspent so the tree is laid out fresh.

**Backlog ideas for this system:** specializations that branch a tree at level 30; lessons that convert
ingredients into XP bursts; apprentices as dungeon companions; apprentice-driven events.

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

### The Magnum Opus gate (v1.0): a target that grows

The first Great Work asks for **200K gold earned in a run and level 12**. Every one after asks for
**2.5× the gold and three more levels** (`ascGoldTarget` / `ascMinLevel` in `data/ascension.ts`), up to a
level-45 ceiling.

This replaced a flat 200K gold gate, which had a measurable problem: almost everything that earns gold is
permanent — research, proficiency, apprentices, familiars, the company, and stone resonance — while
everything that *paces* a run resets. Bot runs came in at **77, 40, 31 and 22 minutes**: each Great Work
arrived sooner than the last, and a rich later run could clear the gate before the workshop had reopened
the Trading Post. With the scaling gate the same policy measures **98, 84, 121, 122, 347 minutes** — runs
that grow instead of shrinking.

Stones are still `3 × √(runGold / 200K)`, measured against the *first* target rather than the current one,
so clearing a bigger gate is worth more stones: about 1.6× per ascension at the minimum.

The level requirement is the part that answers "I ascended before I unlocked the merchant". Gold can be
rushed with permanent multipliers; levels cannot, because every level is content the run has to re-walk.

### What persists through ascension
Stones and eternal perks, proficiency, achievements, lifetime stats, settings, your potion belt layout, research, the seed catalogue and strain ranks, familiars, apprentices, and the adventurer company (roster, relics and depth). **Arcane Memory** also keeps spells, and **Heirloom Armory** keeps equipped gear. Everything else resets.

### The v1.0 content pass, and what paces it

Content now runs to **level 100** across every system, roughly doubling what was there:

| System | Was | Now | New tiers at |
|---|---|---|---|
| Herbs / beds | 9 | 15 | 42, 58, 66, 74, 82, 90 |
| Potions | 22 | 33 | 24, 35, 46, 50, 62, 68, 74, 80, 88, 96, 100 |
| Expedition zones | 7 | 13 | 23, 33, 44, 58, 70, 84 |
| Dungeons | 6 | 8 | 68 (tier 7), 82 (tier 8) |
| Forge tiers | 6 | 8 | — |
| Materials | 21 | 31 | one per new zone and dungeon |

New tiers extend the existing curves rather than starting new ones: herb value ×1.106 a level, grow time
×1.032, yield ×1.022; zone XP ×1.12; potion gold-per-second climbing ~1.10 a level; dungeon HP ×3.7 and
gold ×4.5 a tier. The Endless Rift stays at level 50 — the finite zones above it are richer at their tier,
and the Rift overtakes them all again once its depth multiplier has had time to compound.

The **Magnum Opus Draught** (level 100) is the new capstone, and the Philosopher's Panacea is now an
*ingredient* of the Elixir of Eternity rather than the end of the line.

**Spells** now run the full distance too. Damage multipliers continue their existing ~1.035-a-level climb
(1.6 at level 10 → 14 at 55 → 95 at 100), and the new rituals deliberately cover the systems that had none:
**Song of the Deep** buffs the adventurer company, **Forgefire Rite** the dungeon run, **Aurora Veil** potion
quality, and **The Eternal Hour** everything at once. Spell slots were the real constraint — 18 combat spells
against a base of 2 — so two Library studies (*Sigil Craft* at 40, *The High Sigils* at 72) add a slot each
plus the mana to use it, taking a fully-invested caster to six.

**Level curve.** Two pieces: 21% a level to 35, easing to 16% after (`SOFTEN_AT` in `core/state.ts`). At a
flat 21% the hundredth level alone would have cost more XP than the whole run before it. Cumulative XP to
level 100 is ~5.9e9. Bot pacing: level 10 at 22 min, 20 at 45, 30 at ~95, 40 at ~420, 50 at ~1450.

**The first ascension is gated on gold, not level**, which is why slowing the level curve alone did not
lengthen a run — it just meant ascending at level 25 instead of 30, having seen *less* of the game. The
first Great Work now asks **600K gold and level 15** (was 200K and level 12). Measured first ascension:
**110 min** (range 101–130) against 78–89 before, at level 31 with 16 recipes unlocked.

Run cadence after the pass: **120 → 127 → 202 → 361 → 376 → 442 minutes**. Levels
55+ are reached inside the late, long runs rather than the early short ones, which is what makes the
back half of the content worth writing.

## 3. Balance levers (all in `src/data/`)

- `xpToNext` in `core/state.ts`: level curve (`65 × 1.21^(L-1) + 40L`, easing to 16% a level past `SOFTEN_AT` = 35)
- `ascGoldTarget` / `ascMinLevel` / `stonesFor` in `data/ascension.ts`: the prestige gate (600K gold and level 15, ×2.5 gold and +3 levels per ascension, level capped at 60) and the stone formula
- `riftRewardMult` / `riftTimeMult` in `data/zones.ts`: endless scaling
- `delveReq` / `delveTime` / `delveGold` / `supplyNeed` in `data/adventurers.ts`: the company’s endless ladder
- `strainStrength` in `data/mutations.ts`: how far a bred strain can be pushed
- `rankThreshold` in `data/guilds.ts`: guild rank curve
- Recipe `value`/`time`/`xp`, plant `cost`/`time`/`yield`, zone `xp`/`bounty`, upgrade `baseCost`/`growth`

**Reward curves.** Every line of content should be worth roughly 1.10× more per level than the one below
it, so moving up is always the obvious choice. Measured spread from the first tier to the last:

| System | Spread | Notes |
|---|---|---|
| Recipes | 100× gold/sec | 2.5 → 250 |
| Dungeons | 1100× gold, 212× xp per kill | steepest, and the model the others were matched to |
| Zones | 106× gold/min and xp/min | `bounty` multiplies drop quantities; each zone is 1.5–3.1× the last |
| Plants | 106× net value/min | yields climb 3 → 8.2; grow time and seed cost already scale with herb value, so a flat yield left every bed earning the same |

**Demand is the fourth curve, and the one that stops a single recipe carrying a run.** Selling drops a
potion's demand 0.0025 a unit; demand recovers toward 100% by `DEMAND_RECOVER` (0.23%) of the remaining
gap each second, a time constant of about 7 minutes. A recipe sold steadily at R units a second settles
at `1 − 0.0025·R / k`, so the sustainable income from one recipe is capped by how *cheap* it is:

| Recipe | Sustained gold/min on three cauldrons | Demand it settles at |
|---|---|---|
| Minor Healing Tonic (15g) | 222 | 0.46 |
| Alchemist's Fire (520g) | 2,807 | 0.89 |
| Philosopher's Panacea (150,000g) | 44,828 | 0.99 |

162× between the ends, and note demand *rises* as you climb: reaching 200K gold needs about 13,000 tonics
but only ~290 Dreamweaver Philters, so a cheap recipe saturates its own market and an expensive one
hardly dents it. That is the pressure to move up the recipe list, and it falls out of the arithmetic
rather than being a rule. Pure Minor Healing Tonic now takes ~12 hours to reach a Magnum Opus.

Recovery used to be a flat 0.004 a second against a 0.005 drop, which made the system inert: under
~0.8 sales a second demand never moved at all, above it demand fell straight to the floor, and there
was no gradient in between. 8,940 tonics could be sold with demand never leaving 1.00.

Zones and plants used to be nearly flat — 5.5× and 4.9× across the whole game — which is why the
Whispering Meadow and Sunleaf never stopped being reasonable choices. They are matched to the others now.

Pacing targets: first ascension at about 2–4 hours of active play, the Panacea recipe (level 60) around the 3rd–5th ascension, and Rift depth plus infinite nodes as the post-content grind.

Measured with `npm run bot` under its default policy (alternate two herbs so cross-breeding can happen,
keep every research desk busy, buy the cheapest affordable upgrade, skill and apprentice node each step):

| Milestone | Bot | Human (~2× slower) |
|---|---|---|
| Level 10 | ~12 min | ~25 min |
| Level 20 | ~30 min | ~1 h |
| First ascension | **98 min** (range 90–112) | **~3.3 h** |
| An item reaches proficiency 50 | ~158 min | ~5 h |
| An apprentice reaches level 25 | ~40 min | ~1.3 h |

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

*Shipped since this list was written: potion quality tiers (v0.6), the Research Library and cross-breeding (v0.7), familiars and bulk buying (v0.8), apprentices rebuilt around unlocks and trees (v0.9), adventurer parties and Rift relics (v1.0), events (v0.2) and the scripted balance bot — all documented in §2.*

### High impact, fits the current design
*(Adventurer parties shipped in v1.0 — see §2.)*

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
