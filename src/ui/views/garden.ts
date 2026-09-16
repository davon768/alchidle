import { html, type TemplateResult } from 'lit-html';
import type { GameState, Mods } from '../../core/types';
import { PLANT_MAP } from '../../data/plants';
import { TRAITS, TRAIT_MAP, describeTrait, parseSeed } from '../../data/mutations';
import { item } from '../../data/items';
import { growRate, plantCost, profBonusOf, profLevelOf, strainRank, unlockedPlants } from '../../core/engine';
import { clearPlot, harvest, harvestAll, plant, plantAll, sowAll, sowBest } from '../../core/actions';
import { fmt, fmtTime } from '../../core/format';
import { act, bar, gold, refresh, sectionTitle, ui } from '../common';
import { HYBRIDS, HYBRID_MAP, codexProgress, crossBonus, crossHerbCost, knownCrosses } from '../../data/hybrids';
import { cancelCross, crossStatus, startCross } from '../../core/crossing';

/**
 * The crossing bench.
 *
 * What finally gives the seed tray a purpose: a cross is paid for in seeds, one carrying each parent, so
 * a seed is now either a strain rank or crossing material and spending it is a choice. Which trait you
 * feed in changes the result, which is why the picker shows the traits rather than just a count.
 *
 * Recipes are never listed before they are learned — an unread cross shows as a locked slot, because the
 * whole point is that a hybrid is something you found.
 */
function crossingBench(s: GameState): TemplateResult | string {
  const prog = codexProgress(s);
  if (!prog.known && !prog.found) {
    // Nothing read yet: say where pages come from rather than showing an empty shelf.
    return html`<div class="card">
      <div class="row between"><b>🧬 Crossing Bench</b><span class="dim">no recipes yet</span></div>
      <div class="dim small">Somewhere out there people have written down how to cross two herbs into one
        that does not grow wild. Torn journal pages turn up on expeditions, in the hoards of dungeon
        bosses, and folded into the studies your Library finishes.</div>
    </div>`;
  }

  const bench = s.bench;
  const open = knownCrosses(s);
  const pick = ui.crossPick ?? {};
  return html`<div class="card">
    <div class="row between">
      <b>🧬 Crossing Bench</b>
      <span class="dim">${prog.found}/${prog.total} discovered · ${prog.known - prog.found} lead${prog.known - prog.found === 1 ? '' : 's'} open</span>
    </div>

    ${bench ? (() => {
      const h = HYBRID_MAP[bench.hybrid];
      const left = Math.max(0, bench.time - bench.progress);
      return html`<div class="small">Crossing <b>${h?.name ?? bench.hybrid}</b></div>
        ${bar(bench.progress / bench.time, '#7fd8ff', fmtTime(left) + ' left')}
        <button class="btn small" @click=${act((st) => cancelCross(st))}>Scrap it</button>`;
    })() : ''}

    ${!bench && open.length ? html`<div class="col" style="gap:8px">
      ${open.map((h) => {
        const a = PLANT_MAP[h.parents[0]];
        const b = PLANT_MAP[h.parents[1]];
        const seedsFor = (plantId: string) => Object.entries(s.seeds)
          .filter(([k, n]) => n > 0 && parseSeed(k).plantId === plantId);
        const mine = pick[h.id] ?? { a: '', b: '' };
        const st = crossStatus(s, h, mine.a, mine.b);
        const bonus = crossBonus(mine.a, mine.b);
        const chip = (key: string, side: 'a' | 'b') => {
          const tr = TRAIT_MAP[parseSeed(key).trait];
          const on = mine[side] === key;
          return html`<button class="btn small seed-chip ${on ? 'primary' : ''}" style="--t:${tr?.color ?? '#888'}"
            @click=${() => { ui.crossPick = { ...pick, [h.id]: { ...mine, [side]: on ? '' : key } }; refresh(); }}>
            ${tr?.icon} ${tr?.name}<span class="dim"> ×${s.seeds[key]}</span>
          </button>`;
        };
        return html`<div class="cross-row">
          <div class="row between">
            <b class="small">${a?.name} × ${b?.name}</b>
            <span class="dim small">${s.level < h.level ? `needs level ${h.level}` : `${crossHerbCost(h)} of each herb`}</span>
          </div>
          <div class="dim small">"${h.hint}"</div>
          <div class="row wrap" style="gap:4px">
            <span class="dim small">${a?.name} seed:</span>
            ${seedsFor(h.parents[0]).length ? seedsFor(h.parents[0]).map(([k]) => chip(k, 'a'))
              : html`<span class="dim small warn">none in the tray</span>`}
          </div>
          <div class="row wrap" style="gap:4px">
            <span class="dim small">${b?.name} seed:</span>
            ${seedsFor(h.parents[1]).length ? seedsFor(h.parents[1]).map(([k]) => chip(k, 'b'))
              : html`<span class="dim small warn">none in the tray</span>`}
          </div>
          ${bonus.notes.length ? html`<div class="small good">${bonus.notes.join(' · ')}</div>` : ''}
          <button class="btn small ${st.ok ? 'primary' : ''}" ?disabled=${!st.ok} title=${st.reason}
            @click=${act((g) => startCross(g, h.id, mine.a, mine.b))}>
            ${st.ok ? 'Cross them' : st.reason || 'Cross them'}
          </button>
        </div>`;
      })}
    </div>` : ''}

    ${prog.found ? html`<div class="dim small">Discovered: ${HYBRIDS.filter((h) => s.codex[h.id]).map((h) => h.name).join(', ')}.
      A cross once made is known forever — the Great Work unmakes the garden, never the notebook.</div>` : ''}
  </div>`;
}

/** Mutated seeds on hand, plus how much of the catalogue has been filled in. */
function seedTray(s: GameState): TemplateResult | string {
  const held = Object.entries(s.seeds).filter(([, n]) => n > 0);
  const found = Object.keys(s.catalogue).length;
  const total = unlockedPlants(s).length * TRAITS.length;
  const sown = s.plots.filter((p) => p.trait).length;
  if (!held.length && !found) return '';
  return html`<div class="card">
    <div class="row between">
      <b>🌾 Seed Tray</b>
      <span class="dim" title="Every strain you discover pays +1% growth and +1% yield, forever">
        ${sown}/${s.plots.length} beds sown · catalogue ${found}/${total} strains · +${found}% growth and yield</span>
    </div>
    <div class="dim small">A sown strain belongs to the bed and survives every replant, your Gardener's included.
      A seed goes into a bed of that herb that has none; once they all carry it, further seeds breed the
      strain deeper and every bed carrying it grows stronger.</div>
    ${held.length
      ? html`<div class="row wrap">${held.map(([key, n]) => {
          const { plantId, trait } = parseSeed(key);
          const t = TRAIT_MAP[trait];
          const pl = PLANT_MAP[plantId];
          if (!t || !pl) return '';
          const rank = strainRank(s, plantId, trait);
          const beds = s.plots.filter((q) => q.plantId === plantId && q.trait === trait).length;
          const needsBed = s.plots.some((q) => (q.plantId === plantId && !q.trait) || !q.plantId);
          return html`<span class="seed-group">
            <button class="btn small seed-chip" style="--t:${t.color}"
              title=${`${describeTrait(trait, rank)} ${needsBed ? `Sows into a ${pl.name} bed and stays there.` : `Every bed that can carry it does (${beds}) — this breeds the strain deeper.`}`}
              @click=${act((st) => sowBest(st, key))}>
              ${t.icon} ${t.name} ${pl.name}
              <span class="dim">×${n}${rank > 1 ? ` · rank ${rank}` : ''}</span>
            </button>
            ${n > 1 ? html`<button class="btn small" title=${`Sow all ${n}`} @click=${act((st) => sowAll(st, key))}>All</button>` : ''}
          </span>`;
        })}</div>`
      : html`<div class="dim">No seeds on hand. Grow two different herbs side by side and a mutation may turn up at harvest.</div>`}
  </div>`;
}

export function gardenView(s: GameState, m: Mods): TemplateResult {
  const plants = unlockedPlants(s);
  if (!plants.some((p) => p.id === ui.plantChoice)) ui.plantChoice = plants[0].id;
  const readyCount = s.plots.filter((p) => p.ready).length;
  const chosen = PLANT_MAP[ui.plantChoice];

  return html`<div class="view">
    ${sectionTitle('🌱 Garden', html`${s.plots.length} plots · ${m.autoHarvest > 0
      ? html`<span class="good">🧑‍🌾 ${Math.min(Math.floor(m.autoHarvest), s.plots.length)}/${s.plots.length} plots tended by Gardeners</span>`
      : 'Tap ripe plants to harvest — hire a Gardener apprentice to automate'}`)}

    <div class="card">
      <div class="dim">Choose what to plant — each herb has its own 🎖️ proficiency</div>
      <div class="pill-tabs">
        ${plants.map((p) => html`<button class="btn small ${ui.plantChoice === p.id ? 'active' : ''}" @click=${act(() => (ui.plantChoice = p.id))}>
          ${item(p.herb).icon} ${p.name} · 🪙${fmt(plantCost(s, m, p))} · Lv ${profLevelOf(s, p.id)}
        </button>`)}
      </div>
      <div class="row between">
        <span class="muted small">${item(chosen.herb).icon} ${chosen.name}: ${fmtTime(chosen.time / growRate(s, m, chosen.id))} to grow ·
          ~${fmt(chosen.yield * m.harvestYield + profBonusOf(s, chosen.id).yield)} per harvest · 🎖️ proficiency ${profLevelOf(s, chosen.id)}/100 · replants automatically</span>
        <div class="row">
          <button class="btn small primary" @click=${act((st) => plantAll(st, ui.plantChoice))}>Plant all empty</button>
          <button class="btn small" ?disabled=${readyCount === 0} @click=${act(harvestAll)}>Harvest all (${readyCount})</button>
        </div>
      </div>
    </div>

    ${crossingBench(s)}
    ${seedTray(s)}

    <div class="plots">
      ${s.plots.map((plot, i) => {
        if (!plot.plantId) {
          return html`<div class="plot empty" @click=${act((st) => plant(st, i, ui.plantChoice))}>
            <div class="sprout">🟫</div>
            <div class="small">Plant ${chosen.name}</div>
            ${gold(plantCost(s, m, chosen))}
          </div>`;
        }
        const p = PLANT_MAP[plot.plantId];
        if (!p) return html`<div class="plot empty" @click=${act((st) => clearPlot(st, i))}><div class="sprout">❓</div><div class="small">Unknown plant — click to clear</div></div>`;
        const trait = plot.trait ? TRAIT_MAP[plot.trait] : undefined;
        const frac = plot.progress / p.time;
        const icon = plot.ready ? item(p.herb).icon : frac < 0.5 ? '🌱' : '🌿';
        return html`<div class="plot ${plot.ready ? 'ready' : ''}" @click=${act((st) => harvest(st, i))}>
          ${i < m.autoHarvest ? html`<span class="tend-badge" title="Tended by your Gardeners">🧑‍🌾</span>` : ''}
          <div class="sprout" style="transform:scale(${plot.ready ? 1.15 : 0.6 + frac * 0.5})">${icon}</div>
          <div class="small">${p.name} <span class="dim">Lv ${profLevelOf(s, p.id)}</span></div>
          ${trait ? (() => {
            const rk = strainRank(s, plot.plantId, plot.trait);
            return html`<div class="trait-badge" style="--t:${trait.color}"
              title=${`${describeTrait(plot.trait as string, rk)} This bed keeps the strain through every replant.`}>${trait.icon} ${trait.name}${rk > 1 ? html` <span class="dim">${rk}</span>` : ''}</div>`;
          })() : ''}
          ${plot.ready
            ? html`<button class="btn small primary">Harvest</button>`
            : html`${bar(frac, trait ? trait.color : '#5fd068')}<span class="dim">${fmtTime((p.time - plot.progress) / growRate(s, m, p.id, plot.trait))}</span>`}
          <button class="plot-clear" title=${plot.trait ? 'Clear this bed — the sown strain is lost' : 'Clear plot (no refund)'} @click=${act((st) => clearPlot(st, i))}>✕</button>
        </div>`;
      })}
    </div>
    ${s.plots.length < 4 ? html`<div class="dim">Buy more plots in the 🔨 Workshop, or unlock them in the Herbalism skill tree.</div>` : ''}
  </div>`;
}
