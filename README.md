# ⚗️ Alchemy Idle

A browser-first alchemist idle game: grow herbs, scavenge for rare materials, brew potions, sell and trade them, rise through a guild, and perform the **Magnum Opus** to ascend and start again stronger. Built so the same code can ship as an Android app.

**▶ Play it:** https://davon768.github.io/alchidle/ (deployed automatically from `main` by GitHub Actions — see [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

In dev builds, `window.__alchemy` exposes the live game, actions and engine for testing (e.g. `__alchemy.game.s.gold = 1e6`).

## Tech

- **TypeScript + Vite**: fast dev server, tiny static output (~25 KB gzipped), so it runs on any web host or inside a WebView.
- **lit-html** for rendering: the whole UI re-renders about 10 times a second and lit-html only updates the DOM nodes that changed.
- **No backend**: saves go to `localStorage`, with export/import codes for moving between devices.

## Project layout

```
src/
  core/      engine (tick, offline sim), actions, modifiers, save/load, formatting
  data/      ALL game content: items, plants, recipes, zones, skills, upgrades, guilds, ascension, achievements
  ui/        app shell + one view per tab
```

Content is data-driven. Adding a potion, zone, skill or upgrade means adding one entry in `src/data/`; the UI and engine pick it up automatically. See [DESIGN.md](DESIGN.md) for the systems, balance levers, Android plan and the roadmap of recommended additions.

## Android

See the **Android** section of [DESIGN.md](DESIGN.md). Short version: Capacitor wraps `dist/` in a native app project.

## Working from another computer

One-time setup (needs Git, Node.js 22+ and access to the private `alchidle-claude` repo):

```bash
git clone https://github.com/davon768/alchidle.git
cd alchidle
npm run setup
```

After that, `git pull` / `git push` keep the code in sync. Claude Code conversations and memory for this project sync automatically through hooks in `.claude/settings.json` (see `scripts/claude-sync.mjs`): they're pulled when a session starts and pushed while you work. To continue a synced conversation, run `claude --resume` in this folder. Check the sync any time with `npm run sync:status`.
