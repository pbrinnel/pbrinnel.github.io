// Node check of glyphs.js (no DOM): ids, colors, glyphFor, animalGlyph, stageOf.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const ctx = vm.createContext({ console, crypto: globalThis.crypto });
vm.runInContext('globalThis.AS = { V: 0 };', ctx);
for (const f of [...require('./harness.js').SIM_FILES, 'render', 'marks']) {
  const file = path.join(ROOT, 'js', f + '.js');
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
}
const AS = ctx.AS;
let bad = 0;
const check = (c, m) => { if (!c) { bad++; console.log('FAIL: ' + m); } };

const ids = Object.entries(AS.GLYPH);
check(ids.length === 16, `16 glyph ids, got ${ids.length}`);
check(new Set(ids.map(e => e[1])).size === 16, 'ids distinct');
for (const [name, id] of ids) {
  check(Number.isInteger(id) && id >= 0 && id < AS.CELL_COLOR.length, `${name} id range`);
  check(/^#[0-9a-f]{6}$/.test(AS.COLORS[id]), `${name} has COLORS entry`);
  check(AS.CELL_COLOR[id] >>> 24 === 255, `${name} has CELL_COLOR`);
}
const seen = new Set();
for (const sp of [0, 1]) for (const sx of [0, 1]) for (const st of [0, 1, 2]) {
  const id = AS.animalGlyph(sp, sx, st);
  check(!seen.has(id) && id >= 4, `animalGlyph(${sp},${sx},${st}) distinct`);
  seen.add(id);
}
check(seen.size === 12, '12 animal combos');
check(AS.animalGlyph(0, 0, 1) === AS.GLYPH.BUNNY_MALE_ADULT, 'BUNNY_MALE_ADULT name matches');
check(AS.animalGlyph(1, 1, 2) === AS.GLYPH.WOLF_FEMALE_ELDER, 'WOLF_FEMALE_ELDER name matches');
check(AS.COLORS[AS.GLYPH.BUNNY_MALE_BABY] === AS.COLORS[AS.GLYPH.BUNNY_MALE_ADULT], 'baby color = adult');
check(AS.COLORS[AS.GLYPH.WOLF_MALE_ELDER] !== AS.COLORS[AS.GLYPH.WOLF_MALE_ADULT], 'elder dimmer');

// glyphFor on a real world
const { load } = require('./harness.js');
const { texts } = load();
const { T } = AS.parseTables(texts);
const sim = AS.Sim(T, 1), W = sim.W;
const empties = [];
for (let t = 0; t < W.n && empties.length < 8; t++) if (W.kind[t] === AS.KIND.EMPTY) empties.push(t);
const cases = [[0, 'GRASS_0'], [0.34, 'GRASS_1'], [0.5, 'GRASS_1'], [0.67, 'GRASS_2'], [1.0, 'GRASS_2'], [1 / 3, 'GRASS_1'], [0.3333, 'GRASS_0']];
empties.slice(0, cases.length).forEach((t, i) => {
  W.addGrass(t, cases[i][0], 0);
  check(AS.glyphFor(sim, t) === AS.GLYPH[cases[i][1]], `size ${cases[i][0]} -> ${cases[i][1]}`);
});
const ec = empties[cases.length];
check(ec === undefined || AS.glyphFor(sim, ec) === -1, 'empty -> -1');
const e0 = empties[7];
if (e0 !== undefined) { W.addCorpse(e0, AS.SPECIES.WOLF); check(AS.glyphFor(sim, e0) === AS.GLYPH.CORPSE, 'corpse'); }
check(!AS.GLYPH_NAMES.includes(undefined) && AS.GLYPH_NAMES.length === 16, 'names');

// stageOf
const b = T.bunny;
check(AS.stageOf(b, 0) === 0, 'newborn is baby');
check(AS.stageOf(b, b.TimeToMature) === 1, 'at maturity is adult');
check(AS.stageOf(b, b.ElderAt * b.Lifespan) === 2, 'at ElderAt is elder');

// Glide math
const DT = AS.DT;
check(AS.glideProgress(0.5, 0.5, 0) === 0, 'glide 0 at start');
check(Math.abs(AS.glideProgress(0.5, 0.5, 1) - DT / 0.5) < 1e-9, 'glide advances by alpha*DT');
check(AS.glideProgress(0, 0.5, 0) === 1, 'glide 1 at end');
check(AS.glideProgress(-0.3, 0.5, 0.5) === 1, 'glide clamps high');
check(AS.glideProgress(0.9, 0.5, 0) === 0, 'glide clamps low');
check(Math.abs(AS.glideProgress(0.25, 0.5, 0) - 0.5) < 1e-9, 'glide halfway');

// Marks rationing
const EV = AS.EV, RATE = T.world.MarksPerSecond;
function fakeSim(size = 4096) {
  return { events: { type: new Uint8Array(size), tile: new Int32Array(size), size, written: 0 } };
}
function push(sim, type, tile = 0) {
  const e = sim.events, i = e.written++ % e.size; e.type[i] = type; e.tile[i] = tile;
}
function aliveCount(marks, nowMs) {   // draw into a recording ctx, count arcs
  let arcs = 0;
  const ctx = { canvas: { width: 1e6, height: 1e6 }, beginPath() {}, arc() { arcs++; }, stroke() {}, set lineWidth(v) {}, set globalAlpha(v) {}, set strokeStyle(v) {} };
  const W = { w: 100 };
  marks.draw(ctx, { W }, { x: 0, y: 0, scale: 10 }, 1, nowMs);
  return arcs;
}
function tilesDrawn(marks, nowMs) {
  const seen = new Set();
  const ctx = { canvas: { width: 1e6, height: 1e6 }, beginPath() {}, arc(x) { seen.add(Math.round(x / 10 - 0.5)); }, stroke() {}, set lineWidth(v) {}, set globalAlpha(v) {}, set strokeStyle(v) {} };
  marks.draw(ctx, { W: { w: 1e5 } }, { x: 0, y: 0, scale: 10 }, 1, nowMs);
  return seen;
}
{
  const marks = AS.Marks(T), sim = fakeSim();
  marks.consume(sim, 0);   // adopts the sim
  for (let i = 0; i < 500; i++) push(sim, EV.GRAZE, i);
  for (let i = 0; i < 10; i++) push(sim, EV.DEATH, 600 + i);
  marks.consume(sim, 10);
  const n = aliveCount(marks, 10 + 100);
  // Alive marks tell us creation counts only while all are within the fade; count = created.
  check(n <= RATE, `burst made ${n} marks, over ${RATE}`);
  check(n >= 10 + Math.floor(RATE * 0.5) - 10, 'burst made the expected marks');
  // Deaths all present: replay with deaths first too
  const m2 = AS.Marks(T), s2 = fakeSim();
  m2.consume(s2, 0);
  for (let i = 0; i < 10; i++) push(s2, EV.DEATH, i);
  for (let i = 0; i < 500; i++) push(s2, EV.GRAZE, 100 + i);
  m2.consume(s2, 10);
  const t2 = tilesDrawn(m2, 110);
  let d2 = 0; for (let i = 0; i < 10; i++) if (t2.has(i)) d2++;
  check(d2 === 10, `deaths first: all 10 marked, got ${d2}`);
  check(t2.size <= RATE, 'deaths first: within budget');
  const m3 = AS.Marks(T), s3 = fakeSim();
  m3.consume(s3, 0);
  for (let i = 0; i < 500; i++) push(s3, EV.GRAZE, i);
  m3.consume(s3, 10);
  check(aliveCount(m3, 20) <= RATE / 2, `graze alone capped at half (${aliveCount(m3, 20)})`);
  const m4 = AS.Marks(T), s4 = fakeSim();
  m4.consume(s4, 0);
  for (let i = 0; i < 500; i++) push(s4, EV.GRAZE, i);
  for (let i = 0; i < 10; i++) push(s4, EV.DEATH, 700 + i);
  m4.consume(s4, 10);
  // Count deaths by tile via a recording ctx
  const seenTiles = new Set();
  const ctx4 = { canvas: { width: 1e6, height: 1e6 }, beginPath() {}, arc(x) { seenTiles.add(Math.round(x / 10 - 0.5)); }, stroke() {}, set lineWidth(v) {}, set globalAlpha(v) {}, set strokeStyle(v) {} };
  m4.draw(ctx4, { W: { w: 1000 } }, { x: 0, y: 0, scale: 10 }, 1, 100);
  let deaths = 0; for (let i = 0; i < 10; i++) if (seenTiles.has(700 + i)) deaths++;
  check(deaths === 10, `all 10 deaths marked, got ${deaths}`);
}
{
  // Never more than RATE created in any real second, over 10 s of constant spam.
  const marks = AS.Marks(T), sim = fakeSim(); marks.consume(sim, 0);
  let created = 0, total = 0;
  const fadeMs = T.world.MarkFade * 1000;
  for (let ms = 0; ms < 10000; ms += 16) {
    for (let i = 0; i < 50; i++) push(sim, i % 3 ? EV.BITE : EV.GRAZE, i);
    marks.consume(sim, ms);
    if (ms % 1000 < 16) { total = 0; }
  }
  // Count by sampling alive marks each frame can't give creations; use window of one fade.
  const m = AS.Marks(T), s = fakeSim(); m.consume(s, 0);
  let maxAlive = 0;
  for (let ms = 0; ms < 10000; ms += 16) {
    for (let i = 0; i < 50; i++) push(s, EV.BITE, i);
    m.consume(s, ms);
    maxAlive = Math.max(maxAlive, aliveCount(m, ms));
  }
  check(maxAlive <= RATE * Math.ceil(fadeMs / 1000) + RATE, `alive peaked at ${maxAlive}`);
}
{
  // Sliding window: from a steady stream (mixed types, uneven frame times), every 1000 ms
  // span starting at any creation time sees at most RATE marks start.
  const marks = AS.Marks(T), sim = fakeSim(); marks.consume(sim, 0);
  const first = new Map(); let next = 1;
  for (let ms = 0; ms < 10000; ms += 7 + (ms % 5)) {
    for (let i = 0; i < 6; i++) push(sim, i % 4 === 0 ? EV.GRAZE : i % 4 === 1 ? EV.BITE : EV.DEATH, next++);
    marks.consume(sim, ms);
    for (const t of tilesDrawn(marks, ms)) if (!first.has(t)) first.set(t, ms);
  }
  const times = [...first.values()].sort((a, b) => a - b);
  let worst = 0;
  for (let i = 0; i < times.length; i++) {
    let n = 0;
    for (let j = i; j < times.length && times[j] < times[i] + 1000; j++) n++;
    worst = Math.max(worst, n);
  }
  check(times.length > RATE * 5, `stream made marks (${times.length})`);
  check(worst <= RATE, `sliding 1000 ms window saw ${worst} marks start, cap ${RATE}`);
  console.log(`sliding window: ${times.length} marks over 10 s, worst 1 s span ${worst} (cap ${RATE})`);
}
{
  // Off-screen events neither mark nor spend budget: a burst of far GRAZE, then one near.
  const marks = AS.Marks(T), sim = fakeSim(); sim.W = { w: 100 };
  const cam = { visible: () => ({ x0: 0, y0: 0, x1: 9, y1: 9 }) };
  marks.consume(sim, 0, cam);
  for (let i = 0; i < 500; i++) push(sim, EV.GRAZE, 50 * 100 + 50 + (i % 40));   // x 50+, y 50
  push(sim, EV.GRAZE, 3 * 100 + 4);                                              // x 4, y 3
  push(sim, EV.DEATH, 10 * 100 + 10);                                            // 1-tile margin
  push(sim, EV.DEATH, 11 * 100 + 11);                                            // just outside
  marks.consume(sim, 10, cam);
  const seen = tilesDrawn(marks, 100);
  check(seen.has(304), 'on-screen graze marked after an off-screen burst');
  check(seen.has(1010), 'margin event marked');
  check(!seen.has(1111) && seen.size === 2, `off-screen events unmarked (${seen.size} marks)`);
}
{
  // Cursor survives a sim swap: old events aren't replayed, new ones are.
  const marks = AS.Marks(T), a = fakeSim(), b = fakeSim();
  marks.consume(a, 0);
  for (let i = 0; i < 5; i++) push(b, EV.BITE, i);   // before the swap
  marks.consume(b, 10);                               // swap: skips b's 5 old events
  check(aliveCount(marks, 20) === 0, 'swap does not replay old events');
  push(b, EV.BITE, 9); marks.consume(b, 30);
  check(aliveCount(marks, 40) === 1, 'swap then new event marks');
  // Ring overrun: more than size written between consumes
  const c = fakeSim(8); marks.consume(c, 100);
  for (let i = 0; i < 100; i++) push(c, EV.DEATH, i);
  marks.consume(c, 200);
  check(aliveCount(marks, 210) <= 8, 'overrun reads at most the ring');
}
console.log(bad ? `FAIL (${bad})` : `PASS (${ids.length} glyphs, 12 animal combos, ${cases.length} grass cases)`);
process.exit(bad ? 1 : 0);
