import './styles.css';
import { game } from './core/game';
import { loadGame, saveGame } from './core/save';
import { checkAchievements, simulate, tick, toast } from './core/engine';
import { computeMods } from './core/mods';
import { checkGoals } from './core/goals';
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
  void Promise.all([import('./core/actions'), import('./core/engine'), import('./core/state'), import('./core/staff'), import('./ui/common')]).then(
    ([actions, engine, state, staff, common]) => {
      (window as unknown as Record<string, unknown>).__alchemy = {
        game, actions, engine, state, staff, computeMods, saveGame, ui: common.ui, refresh: common.refresh,
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
  try {
    if (dt > CATCH_UP_SECONDS) catchUp(dt);
    else if (dt > 0) tick(game.s, dt);
  } catch (err) {
    console.error('[alchemy] tick failed:', err);
  }
}, TICK_MS);

setInterval(() => {
  try {
    checkAchievements(game.s);
    checkGoals(game.s);
  } catch (err) {
    console.error('[alchemy] achievement/goal check failed:', err);
  }
}, 1000);
setInterval(() => saveGame(game.s), AUTOSAVE_MS);

let lastRender = 0;
let renderErrors = 0;
function frame(t: number): void {
  // Reschedule FIRST. If rerender() throws and the next frame is never requested, the whole UI
  // freezes for good — every bar stops while the game keeps ticking invisibly behind it.
  requestAnimationFrame(frame);
  if (t - lastRender < RENDER_MS) return;
  lastRender = t;
  try {
    rerender();
  } catch (err) {
    renderErrors++;
    if (renderErrors <= 3) {
      console.error('[alchemy] render failed — the game is still running:', err);
      if (renderErrors === 1) toast('Something went wrong drawing the screen. The game is still running; please report it.', 'warn');
    }
  }
}
requestAnimationFrame(frame);

// Save whenever the page is hidden — covers tab close on the web and app backgrounding on Android.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveGame(game.s);
});
window.addEventListener('pagehide', () => saveGame(game.s));
