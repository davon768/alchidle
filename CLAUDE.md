# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Alchemy Idle is a browser-first alchemist idle game (TypeScript + Vite + lit-html, no backend, `localStorage` saves) built to wrap as an Android app with Capacitor later. `DESIGN.md` is the source of truth for systems, balance numbers, the Android plan and the feature backlog — update it whenever a system changes.

## Commands

- `npm run dev` — Vite dev server on http://localhost:5173 (also defined as `alchemy-dev` in `.claude/launch.json`).
- `npm run build` — `tsc --noEmit` + `vite build`. This is the only automated check: there is no test suite or linter.
- `npm run typecheck` — types only.
- `npm run setup` — one-time setup on a new computer (install + pull Claude conversation sync).
- `npm run sync:status | sync:pull | sync:push` — Claude conversation/memory sync (see below).

Deployment: every push to `main` runs `.github/workflows/deploy.yml`, which builds and force-pushes `dist/` to the `gh-pages` branch served at https://davon768.github.io/alchidle/. Pushing `main` publishes the live game, so only push when the user asks.

## Architecture

- **`src/data/`** — all content is data-driven: items, plants, recipes, zones, skills, upgrades, guilds, ascension, achievements, dungeons (`combat.ts`), spells/reagents, gear, events, proficiency, apprentices. Adding content means adding entries; the engine and UI pick them up. `RECIPES` must stay sorted by level (unlock lists and contract pools slice from the end).
- **`src/core/types.ts`** — `GameState` is one plain-JSON object. `Mods` holds every number the systems read.
- **`src/core/mods.ts` → `computeMods(s)`** — the single modifier pipeline. Skills, upgrades, guild rank, ascension nodes, achievements, equipped gear, ritual buffs, the active event, working apprentices and graduated masters all emit `Effect { stat, value }` onto base values. New bonus sources plug in here. The `auto*` stats are *capacities* (plots/cauldrons/parties/potion types/rituals tended) and are zeroed unless that craft has an apprentice; a craft's capacity comes from its own tree (`capacityOf` in `core/staff.ts`).
- **`src/core/engine.ts` → `tick(s, dt)`** — correct for any `dt`: 100 ms live ticks, throttled background tabs and offline catch-up all use it. `simulate()` runs it in ≤4000 steps with `quiet = true`, which suppresses toasts and item pop-ups (offline gets a summary modal instead). Sub-systems ticked from here: `magic.ts` (mana, rituals), `events.ts`, `combat.ts` (0.25 s sub-steps, auto-battle), `staff.ts` (apprentices). `addItem()` emits the gain signal that drives the UI pop-up feed.
- **Goals** (`data/goals.ts`, `core/goals.ts`) are the tutorial: one goal per mechanic, each with a *how*, an explanation and a one-time reward, shown in the top banner and the 🎯 Goals tab. When you add a system, add a goal that teaches it.
- **Proficiency** (`data/proficiency.ts`, accessed via `profBonusOf` / `gainProf` in the engine) replaced recipe mastery: every plant, potion, reagent and forge tier levels 1–100 with milestone bonuses every 10 levels.
- **Saves** (`core/save.ts`): `mergeDefaults()` fills missing fields from `newState()`, so adding fields never breaks old saves. When a field changes meaning, bump `SAVE_VERSION` in `state.ts` and add a step to `migrate()` (v2: mastery → proficiency XP; v3: bought automation upgrades → apprentices; v9: hired staff and graduated masters → one apprentice per craft; v11: a `runStart` snapshot, since the Great Work now weighs what a *run* did). Migration steps must test the **raw** save, not the merged object — `mergeDefaults` fills every field from a fresh state, so "is this field missing?" is always false after the merge.. `newState(prev)` defines what survives ascension. `migrate()` also validates every id that indexes into game data (plants, recipes, zones, spells, guilds, dungeons, adventurer classes, relics, the belt and the supply kit) and drops the ones whose content is gone — content ids are load-bearing, and `computeMods` runs in both the tick and the render, so one stale id used to take down the whole game.
- **UI**: `src/ui/app.ts` re-renders the whole app with lit-html ~10×/s via `requestAnimationFrame`. Views in `src/ui/views/` are pure `(s, m) => TemplateResult`; state changes go through `act(fn)`, which re-renders immediately. Tabs unlock through `TABS[].unlocked`, and the nav is grouped: each tab carries a `group` (Production, Commerce, Adventure, Your people, Growth, Records) and the sidebar prints a heading per group, hidden on the phone strip. Reading order comes from `TAB_ORDER` — a new tab needs an entry there as well as a group, or it lands at the bottom. A group with nothing unlocked prints no heading.
- Circular imports between core modules (engine ↔ combat/magic/staff/events/armory) are intentional and safe: nothing runs at module load.
- A failed draw rebuilds the screen from nothing (`resetRender` in `ui/app.ts`) rather than re-rendering into a damaged tree. lit tracks what it drew through comment markers in the DOM, so anything editing the page from outside — an extension, a page translation, a reader mode — ejects those markers and every later draw walks into a missing node. The Journal's Diagnostics panel records the *first* failure with its stack and names that cause when the message matches.

## Testing and balancing

- Verify in the Browser pane against the dev server, plus `npm run build`.
- DEV builds expose `window.__alchemy = { game, actions, engine, state, staff, computeMods, saveGame, ui, refresh }` — the app's live module instances. A bare `await import('/src/...')` from the console after HMR loads *separate* module copies (Vite serves timestamped URLs): fine for pure simulation on a separate `newState()`, but it cannot affect — and must not be used to save over — the running game.
- To show a test state in the live UI: stash `__alchemy.game.s`, swap in the test state, inspect, then restore it and call `saveGame` (autosave runs every 15 s). Screenshots can be stale when the app window is hidden (rAF pauses); prefer `get_page_text` or DOM reads.
- The bot reports `saveKB` and its six biggest collections: a leak shows up as those climbing across horizons. Measured 7 / 9 / 10 KB at 6 / 24 / 72 h, bounded by content.
- **Balance bot**: `npm run bot` (`scripts/balance-bot.ts`, run under plain Node via the extensionless-import hook in `scripts/register-ts.mjs`). `npm run bot -- 12 --runs 5 --json`; `--no-research`, `--single-herb`, `--no-hire` and `--hire-ratio N` switch parts of its policy off so a system's contribution can be isolated. It plays perfectly; humans are ~2× slower. The bot performs the Magnum Opus itself under `--full` and reports `run lengths`, which is the number that matters for prestige pacing: runs must grow, not shrink. Current baseline under the default policy: first ascension **110 min** (range 101–130), then 127 / 202 / 361 / 376 / 442 min for runs 2–6; at the gate the bot is level ~31 with 7 studies, 3 apprentices and 16 recipes unlocked. Content runs to level 100; the bot reaches level ~56 in 60 simulated hours, inside its late long runs. See DESIGN.md §3 for the full table. **Absolute times track the bot's own policy** (changing only when it hires moved first ascension by 30 minutes), so compare configurations rather than trusting a single number, and re-derive the table if the policy changes.

## Owner's design preferences

- Long, effectively endless progression. Prefer milestone bonuses (every 5 or 10 levels) over small per-level percentages.
- New systems must interlock with existing ones (consume and produce other systems' items and stats), surface their activity through toasts and item pop-ups, and be re-balanced with the bot afterwards.
- Automation comes from apprentices, never from one-off purchases. There is exactly one per craft, unlocked by a Library study; they level by doing their work and spend skill points in a per-craft upgrade tree the player directs. No hiring, rolling or slots.
- Apprentice trees run to level 100 and end in *judgement* rather than capacity — choosing what to plant, brew or fetch. Those talents carry `minAsc` and open a layer per rebirth. `core/automation.ts` holds them all, runs once a second from `tick`, and calls the same functions a player's click would. Potion consumers (belt, supply kit, familiars, contracts) must run before the Shopkeeper's Open Books sells the surplus.

## Claude conversation sync

`.claude/settings.json` hooks run `scripts/claude-sync.mjs`: SessionStart pulls, Stop pushes in the background (at most every 10 minutes), SessionEnd pushes. It mirrors this project's `~/.claude/projects/<project-slug>/*.jsonl` transcripts and `memory/` to the **private** repo named in `scripts/claude-sync.config.json`, via a clone in `~/.claude-sync/`. Never point it at the public `alchidle` repo — transcripts contain everything from past sessions. `npm run sync:status` shows what it sees.
