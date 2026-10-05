// Node check of glyphs.js (no DOM): ids, colors, glyphFor, animalGlyph, stageOf.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const ctx = vm.createContext({ console, crypto: globalThis.crypto });
vm.runInContext('globalThis.AS = { V: 0 };', ctx);
for (const f of [...require('./harness.js').SIM_FILES, 'sprites', 'render']) {
  const file = path.join(ROOT, 'js', f + '.js');
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
}
const AS = ctx.AS;
let bad = 0;
const check = (c, m) => { if (!c) { bad++; console.log('FAIL: ' + m); } };

const ids = Object.entries(AS.GLYPH);
const GLYPHS = 4 + 6 * AS.SPECIES_COUNT;   // three grass thirds, the corpse, then six per species
check(ids.length === GLYPHS, `${GLYPHS} glyph ids, got ${ids.length}`);
check(new Set(ids.map(e => e[1])).size === GLYPHS, 'ids distinct');
for (const [name, id] of ids) {
  check(Number.isInteger(id) && id >= 0 && id < AS.CELL_COLOR.length, `${name} id range`);
  check(/^#[0-9a-f]{6}$/.test(AS.COLORS[id]), `${name} has COLORS entry`);
  check(AS.CELL_COLOR[id] >>> 24 === 255, `${name} has CELL_COLOR`);
}
const seen = new Set();
for (let sp = 0; sp < AS.SPECIES_COUNT; sp++) for (const sx of [0, 1]) for (const st of [0, 1, 2]) {
  const id = AS.animalGlyph(sp, sx, st);
  check(!seen.has(id) && id >= 4, `animalGlyph(${sp},${sx},${st}) distinct`);
  seen.add(id);
}
check(seen.size === 6 * AS.SPECIES_COUNT, 'six animal combos per species');
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
check(!AS.GLYPH_NAMES.includes(undefined) && AS.GLYPH_NAMES.length === GLYPHS, 'names');

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

// Drawing through a recording canvas: sprite ids copied (the sheet's sx is the id itself),
// and intent-line segments (moveTo calls).
const IDS = AS.SPRITE_COUNT;
function rig(sim) {
  const rec = { ids: [], tiles: [], lines: 0 };
  const g = new Proxy({}, { get(_, k) {
    if (k === 'drawImage') return (img, sx, sy, sw, sh, dx, dy) => { rec.ids.push(sx); rec.tiles.push([dx, dy]); };
    if (k === 'moveTo') return () => { rec.lines++; };
    if (k === 'canvas') return canvas;
    return () => {};
  }, set() { return true; } });
  const canvas = { width: 100, height: 100, clientWidth: 100, clientHeight: 100, getContext: () => g };
  const r = AS.Renderer(canvas);
  const cam = { x: 0, y: 0, scale: 10, visible: () => ({ x0: 0, y0: 0, x1: sim.W.w - 1, y1: sim.W.h - 1 }) };
  const sheet = { get: px => ({ canvas: {}, px, sx: i => i, sy: () => 0 }) };
  return { r, cam, sheet, rec };
}
{
  // A species whose bodies hold no meat (pinned here: wolves' is a table number) keeps the
  // fallen-body-then-skull behavior the death test below covers.
  const noMeat = AS.parseTables({ ...texts, species: require('./harness.js').editCSV(texts.species, 'MeatOnBody', 'Wolf', '0') }).T;
  const sim2 = AS.Sim(noMeat, 7), W2 = sim2.W;
  ctx.window = { devicePixelRatio: 1 };
  const { r, cam, sheet, rec } = rig(sim2);
  check(r.intentLines === false, 'intent lines are off by default');
  let hunter = -1;
  for (let s = 0; s < W2.aHigh; s++) if (W2.aAlive[s]) { hunter = s; break; }
  W2.aTargetTile[hunter] = (W2.aTile[hunter] + 1) % W2.n; W2.aTargetSlot[hunter] = -1;
  const sel = { tile: W2.aTile[hunter], serial: W2.aSerial[hunter], slot: hunter };
  r.draw(sim2, cam, sheet, null, 0, 0, 1);
  check(rec.lines === 0, `lines off, nothing selected: no lines (${rec.lines})`);
  rec.lines = 0; r.draw(sim2, cam, sheet, sel, 0, 10, 1);
  check(rec.lines === 1, `lines off: only the selected animal's line (${rec.lines})`);
  r.setIntentLines(true); rec.lines = 0; r.draw(sim2, cam, sheet, null, 0, 20, 1);
  check(rec.lines >= 1 && r.intentLines === true, 'lines on: everyone\'s lines');
  r.setIntentLines(false);

  // A wolf's death (no meat) shows its body lying on the corpse's tile for a while, then its skull.
  let victim = -1;
  for (let s = 0; s < W2.aHigh; s++) if (W2.aAlive[s] && W2.aSpecies[s] === AS.SPECIES.WOLF) { victim = s; break; }
  const vt = W2.aTile[victim], dead = AS.spriteCarcass(AS.SPECIES.WOLF), skull = AS.spriteSkull(AS.SPECIES.WOLF);
  AS.killAnimal(sim2, victim);
  rec.ids.length = 0; r.draw(sim2, cam, sheet, null, 0, 100, 1);
  check(rec.ids.includes(dead), 'death: the body is drawn');
  check(!rec.ids.includes(skull) || W2.cCount > 1, 'death: in place of the skull');
  rec.ids.length = 0; r.draw(sim2, cam, sheet, null, 0, 100 + 5000, 1);
  check(!rec.ids.includes(dead) && rec.ids.includes(skull), 'death: skull once the hold ends');
  void vt;

  // A bunny's body, with meat: lying flat, however long ago it died; a skull once eaten.
  let bun = -1;
  for (let s = 0; s < W2.aHigh; s++) if (W2.aAlive[s] && W2.aSpecies[s] === AS.SPECIES.BUNNY) { bun = s; break; }
  const bt = W2.aTile[bun];
  AS.killAnimal(sim2, bun);
  rec.ids.length = 0; r.draw(sim2, cam, sheet, null, 0, 20000, 1);
  check(rec.ids.includes(AS.spriteCarcass(AS.SPECIES.BUNNY)), 'carcass: a body with meat draws lying flat');
  W2.cMeat[bt] = 0;
  rec.ids.length = 0; r.draw(sim2, cam, sheet, null, 0, 40000, 1);
  check(!rec.ids.includes(AS.spriteCarcass(AS.SPECIES.BUNNY)) && rec.ids.includes(AS.spriteSkull(AS.SPECIES.BUNNY)), 'carcass: a skull once the meat is gone');
}
console.log(bad ? `FAIL (${bad})` : `PASS (${ids.length} glyphs, 12 animal combos, ${cases.length} grass cases)`);
process.exit(bad ? 1 : 0);
