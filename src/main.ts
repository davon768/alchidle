import './styles.css';
import { game } from './core/game';
import { loadGame, saveGame } from './core/save';
import { checkAchievements, simulate, tick } from './core/engine';
import { computeMods } from './core/mods';
import { setNotation } from './core/format';
import { mount, showOfflineSummary } from './ui/app';

const TICK_MS = 100;
const RENDER_MS = 100;
const AUTOSAVE_MS = 15_000;
/** Gaps longer than this (sleeping tab, backgrounded Android app) are fast-forwarded and summarized. */
const CATCH_UP_SECONDS = 5;
const SUMMARY_SECONDS = 60;

function catchUp(awaySeconds: number): void {
  const cap = computeMods(game.s).offlineHours * 3600;
  const summary = simulate(game.s, Math.min(awaySeconds, cap));
  if (awaySeconds >= SUMMARY_SECONDS) showOfflineSummary(summary, awaySeconds);
}

const loaded = loadGame();
if (loaded) game.s = loaded;
setNotation(game.s.settings.notation);
const rerender = mount(document.getElementById('app')!);

// Dev-only console hooks for testing and balancing, e.g. `__alchemy.game.s.gold = 1e6`.
if (import.meta.env.DEV) {
  // Import through the app's own module graph: after HMR, Vite serves timestamped URLs, so a bare
  // `import('/src/...')` from the console would load separate copies that don't affect the running game.
  void Promise.all([import('./core/actions'), import('./core/engine'), import('./core/state'), import('./ui/common')]).then(
    ([actions, engine, state, common]) => {
      (window as unknown as Record<string, unknown>).__alchemy = {
        game, actions, engine, state, computeMods, saveGame, ui: common.ui, refresh: common.refresh,
      };
    },
  );
}

if (loaded) {
  const away = (Date.now() - game.s.lastTick) / 1000;
  if (away > CATCH_UP_SECONDS) catchUp(away);
}

let last = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = (now - last) / 1000;
  last = now;
  if (dt > CATCH_UP_SECONDS) catchUp(dt);
  else if (dt > 0) tick(game.s, dt);
}, TICK_MS);

setInterval(() => checkAchievements(game.s), 1000);
setInterval(() => saveGame(game.s), AUTOSAVE_MS);

let lastRender = 0;
function frame(t: number): void {
  if (t - lastRender >= RENDER_MS) {
    lastRender = t;
    rerender();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Save whenever the page is hidden — covers tab close on the web and app backgrounding on Android.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveGame(game.s);
});
window.addEventListener('pagehide', () => saveGame(game.s));
