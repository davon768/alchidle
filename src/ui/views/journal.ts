import { html, type TemplateResult } from 'lit-html';
import type { GameState } from '../../core/types';
import { ACHIEVEMENTS } from '../../data/achievements';
import { describeEffects } from '../../core/mods';
import { exportSave, importSave, saveGame, wipeSave } from '../../core/save';
import { newState } from '../../core/state';
import { game } from '../../core/game';
import { toast } from '../../core/engine';
import { fmt, fmtTime, setNotation } from '../../core/format';
import { act, closeModal, openModal, refresh, sectionTitle } from '../common';
import { domNodes, heapMB, looksExternal, rendersPerSecond, runtime } from '../../core/diagnostics';
import { buildReport, downloadReport, logStalls } from '../../core/log';

function showExport(): void {
  const code = exportSave(game.s);
  openModal(html`<div class="modal">
    <h2>Export save</h2>
    <p class="muted small">Copy this code somewhere safe. Paste it into Import on any device to continue.</p>
    <textarea readonly .value=${code} @focus=${(e: Event) => (e.target as HTMLTextAreaElement).select()}></textarea>
    <div class="row">
      <button class="btn primary" @click=${() => navigator.clipboard?.writeText(code).then(() => toast('Copied to clipboard.', 'good'))}>Copy</button>
      <button class="btn" @click=${closeModal}>Close</button>
    </div>
  </div>`);
}

function showImport(): void {
  let text = '';
  openModal(html`<div class="modal">
    <h2>Import save</h2>
    <p class="warn small">This replaces your current progress.</p>
    <textarea placeholder="Paste save code…" @input=${(e: Event) => (text = (e.target as HTMLTextAreaElement).value)}></textarea>
    <div class="row">
      <button class="btn primary" @click=${() => {
        try {
          game.s = importSave(text);
          setNotation(game.s.settings.notation);
          saveGame(game.s);
          toast('Save imported.', 'good');
          closeModal();
        } catch {
          toast('That save code is invalid.', 'warn');
        }
        refresh();
      }}>Import</button>
      <button class="btn" @click=${closeModal}>Cancel</button>
    </div>
  </div>`);
}

function confirmWipe(): void {
  openModal(html`<div class="modal">
    <h2>Hard reset?</h2>
    <p class="warn">Deletes everything, including ascension progress and achievements. Consider exporting first.</p>
    <div class="row">
      <button class="btn danger" @click=${() => { wipeSave(); game.s = newState(); saveGame(game.s); closeModal(); refresh(); }}>Delete everything</button>
      <button class="btn" @click=${closeModal}>Cancel</button>
    </div>
  </div>`);
}

/** Save size, sampled rather than measured every frame: serialising the whole state at 10 fps is exactly
 *  the kind of waste this panel exists to find. */
let sizeKB = 0;
let sizeAt = 0;
function saveKB(s: GameState): number {
  const now = Date.now();
  if (now - sizeAt > 5000) {
    sizeAt = now;
    sizeKB = Math.round(exportSave(s).length / 1024);
  }
  return sizeKB;
}

export function journalView(s: GameState): TemplateResult {
  const earned = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).length;
  const st = s.stats;
  const rows: [string, string][] = [
    ['Gold earned this run', fmt(st.runGold)], ['Gold earned (lifetime)', fmt(st.totalGold)], ['Best run', fmt(Math.max(st.bestRunGold, st.runGold))],
    ['Potions brewed', fmt(st.brewed)], ['Potions sold', fmt(st.potionsSold)], ['Harvests', fmt(st.harvested)],
    ['Expeditions', fmt(st.expeditions)], ['Contracts', fmt(st.contracts)], ['Trades', fmt(st.trades)],
    ['Monsters slain', fmt(st.kills)], ['Bosses slain', fmt(st.bosses)], ['Defeats', fmt(st.deaths)],
    ['Gear found', fmt(st.gearFound)], ['Spells cast', fmt(st.spellsCast)], ['World events', fmt(st.events)],
    ['Rift delves', fmt(st.delves)], ['Deepest company delve', fmt(s.party.depth)], ['Deepest Rift (this run)', fmt(s.riftDepth)], ['Time this run', fmtTime(st.runTime)], ['Total play time', fmtTime(st.playTime)],
  ];
  return html`<div class="view">
    ${sectionTitle('🏆 Achievements', `${earned} / ${ACHIEVEMENTS.length} — each grants a permanent bonus`)}
    <div class="grid">
      ${ACHIEVEMENTS.map((a) => html`<div class="card ${s.achievements[a.id] ? 'highlight' : 'locked'}">
        <h3>${a.icon} ${a.name}</h3>
        <div class="small muted">${a.desc}</div>
        <div class="small good">${describeEffects(a.reward)}</div>
      </div>`)}
    </div>

    ${sectionTitle('📊 Statistics')}
    <div class="card table-wrap"><table class="table">${rows.map(([k, v]) => html`<tr><td class="muted">${k}</td><td><b>${v}</b></td></tr>`)}</table></div>

    ${sectionTitle('🩺 Diagnostics', 'Useful if the game ever feels slow or the tab crashes — quote these numbers in a bug report')}
    <div class="card">
      <div class="stat-grid">
        <div>⏱ ${fmtTime((Date.now() - runtime.started) / 1000)} this session</div>
        <div>🖼 ${rendersPerSecond().toFixed(1)} draws/sec</div>
        <div>🧩 ${fmt(domNodes())} elements (peak ${fmt(runtime.peakNodes)})</div>
        <div>💾 ${fmt(saveKB(s))} KB save</div>
        <div>🧠 ${heapMB() === null ? 'n/a in this browser' : `${heapMB()} MB heap`}</div>
        <div class=${runtime.renderErrors > 0 ? 'warn' : ''}>⚠️ ${runtime.renderErrors} draw error${runtime.renderErrors === 1 ? '' : 's'}${runtime.recoveries > 0 ? ` · ${runtime.recoveries} rebuilt` : ''}</div>
        <div class=${logStalls().count > 0 ? 'warn' : ''}>🧊 ${logStalls().count} freeze${logStalls().count === 1 ? '' : 's'}${logStalls().count ? ` · worst ${(logStalls().worst / 1000).toFixed(1)}s` : ''}</div>
      </div>
      ${runtime.firstError ? html`<div class="small warn">First error: ${runtime.firstError}</div>
        ${runtime.firstErrorStack ? html`<div class="dim small" style="word-break:break-all">${runtime.firstErrorStack}</div>` : ''}
        ${runtime.lastError && runtime.lastError !== runtime.firstError ? html`<div class="small warn">Last error: ${runtime.lastError}</div>` : ''}
        ${looksExternal(runtime.firstError)
          ? html`<div class="small">This one comes from outside the game: something is editing the page as it draws — a browser
              extension, a page translation, or a reader mode are the usual culprits. The screen rebuilds itself when it happens,
              so the game keeps running; turning extensions off for this page should stop it entirely.</div>`
          : ''}` : ''}
      <div class="row">
        <button class="btn primary" @click=${() => { downloadReport(game.s); toast('Log saved. Send the file along with what you saw.', 'good'); }}>⬇ Download log</button>
        <button class="btn" @click=${() => navigator.clipboard?.writeText(buildReport(game.s))
          .then(() => toast('Log copied — paste it anywhere.', 'good'))
          .catch(() => toast('Could not reach the clipboard; use Download instead.', 'warn'))}>Copy log</button>
      </div>
      <div class="dim small">The log covers this session only: what your browser is, how often the screen
        drew, every error and freeze, and a summary of your save — no items, no save data. If something looked
        wrong or the tab locked up, grab it before reloading: a reload starts the log over.</div>
      <div class="dim">Elements should settle at a few hundred and stay there. A peak that keeps climbing the longer you play is the signature of a leak — that is the number worth reporting.</div>
    </div>

    ${sectionTitle('⚙️ Settings & Save')}
    <div class="card">
      <div class="row">
        <span>Number format:</span>
        ${(['suffix', 'sci'] as const).map((n) => html`<button class="btn small ${s.settings.notation === n ? 'on' : ''}"
          @click=${act((g) => { g.settings.notation = n; setNotation(n); })}>${n === 'suffix' ? '1.5M' : '1.5e6'}</button>`)}
      </div>
      <div class="row">
        <span>Item pop-ups:</span>
        <button class="btn small ${s.settings.lootPops ? 'on' : ''}" @click=${act((g) => (g.settings.lootPops = !g.settings.lootPops))}>
          ${s.settings.lootPops ? 'ON' : 'OFF'}</button>
        <span class="dim">Lists items in the activity feed as they're added to your inventory.</span>
      </div>
      <div class="row">
        <button class="btn primary" @click=${() => { saveGame(game.s); toast('Game saved.', 'good'); }}>💾 Save now</button>
        <button class="btn" @click=${showExport}>Export</button>
        <button class="btn" @click=${showImport}>Import</button>
        <button class="btn danger" @click=${confirmWipe}>Hard reset</button>
      </div>
      <div class="dim">The game autosaves every 15 seconds and whenever you leave the page.</div>
    </div>
  </div>`;
}
