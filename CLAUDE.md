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
- **`src/core/mods.ts` → `computeMods(s)`** — the single modifier pipeline. Skills, upgrades, guild rank, ascension nodes, achievements, equipped gear, ritual buffs, the active event, working apprentices and graduated masters all emit `Effect { stat, value }` onto base values. New bonus sources plug in here. The `auto*` stats are *capacities* (plots/cauldrons/parties/potion types/rituals tended) and are zeroed unless an apprentice of that role is working.
- **`src/core/engine.ts` → `tick(s, dt)`** — correct for any `dt`: 100 ms live ticks, throttled background tabs and offline catch-up all use it. `simulate()` runs it in ≤4000 steps with `quiet = true`, which suppresses toasts and item pop-ups (offline gets a summary modal instead). Sub-systems ticked from here: `magic.ts` (mana, rituals), `events.ts`, `combat.ts` (0.25 s sub-steps, auto-battle), `staff.ts` (apprentices). `addItem()` emits the gain signal that drives the UI pop-up feed.
- **Proficiency** (`data/proficiency.ts`, accessed via `profBonusOf` / `gainProf` in the engine) replaced recipe mastery: every plant, potion, reagent and forge tier levels 1–100 with milestone bonuses every 10 levels.
- **Saves** (`core/save.ts`): `mergeDefaults()` fills missing fields from `newState()`, so adding fields never breaks old saves. When a field changes meaning, bump `SAVE_VERSION` in `state.ts` and add a step to `migrate()` (v2: mastery → proficiency XP; v3: bought automation upgrades → level-10 apprentices). `newState(prev)` defines what survives ascension.
- **UI**: `src/ui/app.ts` re-renders the whole app with lit-html ~10×/s via `requestAnimationFrame`. Views in `src/ui/views/` are pure `(s, m) => TemplateResult`; state changes go through `act(fn)`, which re-renders immediately. Tabs unlock through `TABS[].unlocked`.
- Circular imports between core modules (engine ↔ combat/magic/staff/events/armory) are intentional and safe: nothing runs at module load.

## Testing and balancing

- Verify in the Browser pane against the dev server, plus `npm run build`.
- DEV builds expose `window.__alchemy = { game, actions, engine, state, staff, computeMods, saveGame, ui, refresh }` — the app's live module instances. A bare `await import('/src/...')` from the console after HMR loads *separate* module copies (Vite serves timestamped URLs): fine for pure simulation on a separate `newState()`, but it cannot affect — and must not be used to save over — the running game.
- To show a test state in the live UI: stash `__alchemy.game.s`, swap in the test state, inspect, then restore it and call `saveGame` (autosave runs every 15 s). Screenshots can be stale when the app window is hidden (rAF pauses); prefer `get_page_text` or DOM reads.
- **Balance bot pattern**: `s = state.newState()`, then loop `{ choose actions via core/actions + staff; engine.simulate(s, 5) }` for N simulated hours, recording time-to-level, time to `ASC_MIN_GOLD`, proficiency and apprentice levels. The bot plays perfectly; humans are ~2× slower. Current targets: first ascension ≈ 70 bot-minutes (~2–3 h human); a Common apprentice reaches its cap ≈ 1.5 h after hire; the most-used item reaches proficiency 50 in ≈ 3 h while 100 takes dozens of hours; combat harness: arriving with previous-tier gear clears ~40–85% of a dungeon, farmed current-tier gear nearly clears it.

## Owner's design preferences

- Long, effectively endless progression. Prefer milestone bonuses (every 5 or 10 levels) over small per-level percentages.
- New systems must interlock with existing ones (consume and produce other systems' items and stats), surface their activity through toasts and item pop-ups, and be re-balanced with the bot afterwards.
- Automation comes from hiring and training apprentices, never from one-off purchases.

## Claude conversation sync

`.claude/settings.json` hooks run `scripts/claude-sync.mjs`: SessionStart pulls, Stop pushes in the background (at most every 10 minutes), SessionEnd pushes. It mirrors this project's `~/.claude/projects/<project-slug>/*.jsonl` transcripts and `memory/` to the **private** repo named in `scripts/claude-sync.config.json`, via a clone in `~/.claude-sync/`. Never point it at the public `alchidle` repo — transcripts contain everything from past sessions. `npm run sync:status` shows what it sees.
