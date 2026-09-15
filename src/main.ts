import './styles.css';
import { game } from './core/game';
import { loadGame, saveGame } from './core/save';
import { checkAchievements, simulate, tick, toast } from './core/engine';
import { computeMods } from './core/mods';
import { checkGoals } from './core/goals';
import { setNotation } from './core/format';
import { mount, resetRender, showOfflineSummary } from './ui/app';
import { runtime } from './core/diagnostics';
import { installGlobalCapture, logEvent, noteFrame } from './core/log';

const TICK_MS = 100;
const RENDER_MS = 100;
const AUTOSAVE_MS = 15_000;
/** Gaps longer than this (sleeping tab, backgrounded Android app) are fast-forwarded and summarized. */
const CATCH_UP_SECONDS = 5;
const SUMMARY_SECONDS = 60;

function catchUp(awaySeconds: number): void {
  const cap = computeMods(game.s).offlineHours * 3600;
  const t0 = performance.now();
  const summary = simulate(game.s, Math.min(awaySeconds, cap));
  const took = Math.round(performance.now() - t0);
  // A long catch-up is the likeliest cause of a tab that seems to hang, so it always goes in the log.
  logEvent(took > 400 ? 'stall' : 'note', `caught up ${Math.round(awaySeconds)}s of absence in ${took}ms`);
  if (awaySeconds >= SUMMARY_SECONDS) showOfflineSummary(summary, awaySeconds);
}

installGlobalCapture();

const loaded = loadGame();
if (loaded) game.s = loaded;
setNotation(game.s.settings.notation);
const rerender = mount(document.getElementById('app')!);

// Dev-only console hooks for testing and balancing, e.g. `__alchemy.game.s.gold = 1e6`.
if (import.meta.env.DEV) {
  // Import through the app's own module graph: after HMR, Vite serves timestamped URLs, so a bare
  // `import('/src/...')` from the console would load separate copies that don't affect the running game.
  void Promise.all([import('./core/actions'), import('./core/engine'), import('./core/state'), import('./core/staff'), import('./ui/common'), import('./core/telemetry')]).then(
    ([actions, engine, state, staff, common, telemetry]) => {
      (window as unknown as Record<string, unknown>).__alchemy = {
        game, actions, engine, state, staff, computeMods, saveGame, ui: common.ui, refresh: common.refresh, telemetry,
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
    logEvent('tick', err);
  }
}, TICK_MS);

setInterval(() => {
  try {
    checkAchievements(game.s);
    checkGoals(game.s);
  } catch (err) {
    console.error('[alchemy] achievement/goal check failed:', err);
    logEvent('tick', `achievement/goal check: ${err}`);
  }
}, 1000);
let saveFailures = 0;
setInterval(() => {
  if (saveGame(game.s) || saveFailures++ > 3) return;
  logEvent('error', 'autosave failed — localStorage may be full or blocked');
}, AUTOSAVE_MS);

let lastRender = 0;
let renderErrors = 0;
function frame(t: number): void {
  // Reschedule FIRST. If rerender() throws and the next frame is never requested, the whole UI
  // freezes for good — every bar stops while the game keeps ticking invisibly behind it.
  requestAnimationFrame(frame);
  // Measured every frame, not every draw: a stall is a gap in the browser\u2019s own loop.
  noteFrame(t);
  if (t - lastRender < RENDER_MS) return;
  lastRender = t;
  runtime.renders++;
  try {
    rerender();
  } catch (err) {
    renderErrors++;
    runtime.renderErrors = renderErrors;
    runtime.lastError = String(err);
    if (!runtime.firstError) {
      runtime.firstError = String(err);
      runtime.firstErrorStack = String((err as Error)?.stack ?? '').split(String.fromCharCode(10)).slice(0, 6).join(' | ');
    }
    if (renderErrors <= 20) {
      logEvent('render', `draw failed: ${err}`);
    }
    if (renderErrors <= 3) {
      console.error('[alchemy] render failed — rebuilding the screen:', err);
      if (renderErrors === 1) toast('Something went wrong drawing the screen. The game kept running; the display has been rebuilt.', 'warn');
    }
    // A failed draw can leave lit pointing at nodes that are gone, and every later draw hits the same
    // damage. Rebuild from nothing instead of limping: one dropped frame beats a frozen screen.
    try {
      resetRender();
      runtime.recoveries++;
    } catch (fatal) {
      console.error('[alchemy] rebuilding the screen failed too:', fatal);
    }
  }
}
requestAnimationFrame(frame);

// Save whenever the page is hidden — covers tab close on the web and app backgrounding on Android.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveGame(game.s);
});
window.addEventListener('pagehide', () => saveGame(game.s));
