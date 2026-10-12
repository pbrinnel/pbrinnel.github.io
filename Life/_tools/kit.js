// What the headless checks share: a bare world to hand-place things on, time in ticks, and
// the pass/fail tally. harness.js loads the sim; this builds test worlds on top of it.
//
//   const { stage, tally, at, tick, secs, days } = require('./kit.js');
//   const { ok, done } = tally();
//   const { AS, T, sim, W } = stage({ size: 9, species: [quiet.grass] });
//   ok(W.gCount === 0, 'no grass');
//   done('ALL PASS');
'use strict';
const { load, editCSV } = require('./harness.js');

// A bare world: nothing placed and no water rules, since checks hand-place things on tiles
// (water included) and the water rules would move it.
const BARE = { StartGrass: '0%', StartBunnies: '0', StartWolves: '0', Water: 'off' };

// Species edits that keep a short test about one thing: [row, column, value] lists.
const quiet = {
  // Blades stay as placed: no seeding, sprouting or growth.
  grass: [['SeedChance', 'Grass', '0%'], ['SproutChance', 'Grass', '0%'], ['GrowthRate', 'Grass', '0']],
  seeding: [['SeedChance', 'Grass', '0%']],
  // Nobody gets hungry.
  hunger: ['Bunny', 'Wolf', 'Human'].map(sp => ['HungerRate', sp, '0']),
  // Bunnies don't dig warrens unasked.
  digging: [['DigChance', 'Bunny', '0%']],
};

// Builds a sim from the shipped tables with these changes:
//   size        a number (square) or [w, h]
//   bare        false to keep the shipped starting animals, grass and water (default true)
//   settings    { Name: value } settings rows
//   species     lists of [row, column, value] (e.g. quiet.grass), applied in order
//   edit(texts) any other change to the CSV texts, last
//   seed        default 1
//   events      true to record every sim.emit as [type, tile, tick] in `events`
//   files       extra js/ files to load after the sim's (e.g. ['inspect'])
function stage(o = {}) {
  const { AS, texts } = load({}, o.files);
  const settings = Object.assign({}, o.bare === false ? {} : BARE, o.settings);
  if (o.size != null) {
    const [w, h] = Array.isArray(o.size) ? o.size : [o.size, o.size];
    settings.WorldWidth = w; settings.WorldHeight = h;
  }
  for (const k in settings) texts.settings = editCSV(texts.settings, k, 'Value', String(settings[k]));
  for (const list of o.species || []) for (const [row, col, v] of list) texts.species = editCSV(texts.species, row, col, String(v));
  if (o.edit) o.edit(texts);
  const { T, errors } = AS.parseTables(texts);
  if (errors.length) throw new Error(errors.join('\n'));
  const sim = AS.Sim(T, o.seed ?? 1);
  const events = [];
  if (o.events) {
    const emit = sim.emit;
    sim.emit = (type, tile) => { events.push([type, tile, sim.tickCount]); emit(type, tile); };
  }
  return { AS, T, sim, W: sim.W, K: AS.KIND, events };
}

// Counts failures; done() prints the verdict and exits non-zero on any (check-all reads both).
function tally() {
  let bad = 0;
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; return c; };
  const done = (passLine = 'ALL PASS', extra = 0) => {
    const n = bad + extra;
    console.log(n ? `\nFAIL (${n})` : '\n' + passLine);
    process.exit(n ? 1 : 0);
  };
  return { ok, done, get bad() { return bad; } };
}

const at = (W, x, y) => y * W.w + x;
const tick = (sim, n = 1) => { for (let i = 0; i < n; i++) sim.tick(); };
const secs = (AS, s) => Math.round(s * AS.TICK_HZ);
const days = (AS, d) => Math.round(d * AS.TICK_HZ * AS.DAY_SECONDS);
// An animal's state name, or 'none'.
const stateName = (AS, sim, s) => {
  const W = sim.W;
  return W.aState[s] === 255 ? 'none' : sim.T.states[AS.SPECIES_KEY[W.aSpecies[s]]][W.aState[s]].name;
};

module.exports = { stage, tally, quiet, BARE, at, tick, secs, days, stateName, editCSV };
