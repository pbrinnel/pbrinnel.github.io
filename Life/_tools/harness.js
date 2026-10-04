// Headless checks for Life (the sim). Loads the sim's own files into a VM (they never touch
// the DOM), runs seeded sims, and checks invariants.
//
//   node Life/_tools/harness.js [days=12] [seed=12345]
//
// Exit code 0 = every check passed.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
// glyphs.js is DOM-free until a sheet is built, and holds the life-stage helper animals use.
const SIM_FILES = ['tables', 'rng', 'world', 'grass', 'corpse', 'warren', 'sim', 'start', 'sight', 'animals', 'breed', 'bunny', 'wolf', 'glyphs'];

function load(overrides = {}) {
  const ctx = vm.createContext({ console, crypto: globalThis.crypto });
  vm.runInContext('globalThis.AS = { V: 0 };', ctx);
  for (const f of SIM_FILES) {
    const file = path.join(ROOT, 'js', f + '.js');
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  }
  const texts = {};
  for (const f of ['species', 'variables', 'states', 'settings']) {
    texts[f] = overrides[f] ?? fs.readFileSync(path.join(ROOT, 'tables', f + '.csv'), 'utf8');
  }
  return { AS: ctx.AS, texts };
}

// Replace one cell: settings by name, or species by stat + column.
function editCSV(text, rowName, col, value) {
  const lines = text.split('\n');
  const head = lines[0].split(',');
  const ci = head.indexOf(col);
  const i = lines.findIndex(l => l.split(',')[0] === rowName);
  if (i < 0 || ci < 0) throw new Error(`no ${rowName}/${col}`);
  const cells = lines[i].split(',');
  cells[ci] = value;
  lines[i] = cells.join(',');
  return lines.join('\n');
}

const failures = [];
function check(cond, msg) { if (!cond) failures.push(msg); return cond; }

// Grid ↔ store consistency. Returns a short hash of the world for determinism checks.
function audit(AS, sim, label) {
  const W = sim.W, K = AS.KIND;
  let grass = 0, corpses = 0, animals = 0, holes = 0;
  for (let t = 0; t < W.n; t++) {
    const k = W.kind[t];
    if (k === K.GRASS) {
      grass++;
      const i = W.gSlot[t];
      check(i >= 0 && i < W.gCount && W.gList[i] === t, `${label}: blade ${t} missing from gList`);
      const s = W.gSize[t], a = W.gAge[t];
      check(s >= 0 && s <= 1 && !Number.isNaN(s), `${label}: blade ${t} size ${s}`);
      check(a >= 0 && !Number.isNaN(a), `${label}: blade ${t} age ${a}`);
      check(a < sim.T.grass.Lifespan + 1 / 24 + 1e-6, `${label}: blade ${t} outlived Lifespan (${a})`);
    } else {
      check(W.gSlot[t] === -1, `${label}: tile ${t} has gSlot but no blade`);
    }
    if (k === K.CORPSE) {
      corpses++;
      check(W.cList[W.cSlot[t]] === t, `${label}: corpse ${t} missing from cList`);
      check(W.cNut[t] >= -1e-6 && !Number.isNaN(W.cNut[t]), `${label}: corpse ${t} nutrient ${W.cNut[t]}`);
    }
    if (k === K.BUNNY || k === K.WOLF) {
      animals++;
      const s = W.aSlot[t];
      check(s >= 0 && W.aAlive[s] && W.aTile[s] === t, `${label}: animal grid/slot mismatch at ${t}`);
    }
    if (W.hole[t]) {
      holes++;
      check(W.hList[W.hSlot[t]] === t, `${label}: hole ${t} missing from hList`);
      check(k !== K.GRASS, `${label}: grass on hole ${t}`);
      check(k !== K.WOLF, `${label}: a wolf stands on hole ${t}`);
    } else {
      check(W.hSlot[t] === -1, `${label}: tile ${t} has hSlot but no hole`);
    }
    const src = W.boostSrc[t];
    if (src >= 0) {
      check(W.kind[src] === K.CORPSE, `${label}: tile ${t} boosted by ${src}, which isn't a corpse`);
      const R = sim.T[AS.SPECIES_KEY[W.cSpecies[src]]].CorpseRadius;
      const dx = W.tx(t) - W.tx(src), dy = W.ty(t) - W.ty(src);
      check(dx * dx + dy * dy <= R * R + 1e-9, `${label}: tile ${t} boosted from outside the radius`);
    }
  }
  check(grass === W.gCount, `${label}: ${grass} blades on grid, gCount ${W.gCount}`);
  check(holes === W.hCount, `${label}: ${holes} holes on grid, hCount ${W.hCount}`);
  check(corpses === W.cCount, `${label}: ${corpses} corpses on grid, cCount ${W.cCount}`);
  check(animals === W.bunnies + W.wolves, `${label}: animal counts`);
  let h = 2166136261;
  for (let t = 0; t < W.n; t++) {
    h = Math.imul(h ^ W.kind[t], 16777619);
    h = Math.imul(h ^ Math.round(W.gSize[t] * 1e4), 16777619);
  }
  return (h >>> 0).toString(16);
}

function run(days, seed, onDay) {
  const { AS, texts } = load();
  const { T, errors } = AS.parseTables(texts);
  if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
  const sim = AS.Sim(T, seed);
  const ticksPerDay = AS.TICK_HZ * AS.DAY_SECONDS;
  for (let d = 1; d <= days; d++) {
    for (let i = 0; i < ticksPerDay; i++) sim.tick();
    if (onDay) onDay(AS, sim, d);
  }
  return { AS, sim };
}

if (require.main === module) {
  const days = Number(process.argv[2] || 12);
  const seed = Number(process.argv[3] || 12345);

  console.log('day  blades  meanSize  full  corpses');
  const t0 = Date.now();
  const a = run(days, seed, (AS, sim, d) => {
    const W = sim.W;
    let sum = 0, full = 0;
    for (let i = 0; i < W.gCount; i++) { const s = W.gSize[W.gList[i]]; sum += s; if (s >= 1) full++; }
    console.log(`${String(d).padStart(3)}  ${String(W.gCount).padStart(6)}  ${(sum / Math.max(1, W.gCount)).toFixed(3).padStart(8)}  ${String(full).padStart(5)}  ${W.cCount}`);
    audit(AS, sim, `day ${d}`);
  });
  const ms = Date.now() - t0;
  const ticks = a.sim.tickCount;
  console.log(`${ticks} ticks in ${ms} ms (${(ms / ticks).toFixed(3)} ms/tick incl. audits)`);

  const h1 = audit(a.AS, a.sim, 'final');
  const b = run(days, seed);
  check(audit(b.AS, b.sim, 'replay') === h1, 'same seed gave a different world');
  const c = run(days, seed + 1);
  check(audit(c.AS, c.sim, 'other') !== h1, 'a different seed gave the same world');

  if (failures.length) {
    console.log(`\nFAIL (${failures.length})`);
    console.log([...new Set(failures)].slice(0, 30).join('\n'));
    process.exit(1);
  }
  console.log('\nPASS');
}

module.exports = { load, run, audit, check, failures, editCSV, SIM_FILES };
