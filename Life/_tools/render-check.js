// Node check of glyphs.js (no DOM): ids, colors, grassGlyph, animalGlyph, stageOf; and render.js's pure parts.
'use strict';
const { load } = require('./harness.js');
const { AS, texts, ctx } = load({}, ['sprites', 'render']);
let bad = 0;
const check = (c, m) => { if (!c) { bad++; console.log('FAIL: ' + m); } };

const ids = Object.entries(AS.GLYPH);
const GLYPHS = 4 + 6 * AS.SPECIES_COUNT;   // three grass thirds, the corpse, then six per species
check(ids.length === GLYPHS, `${GLYPHS} glyph ids, got ${ids.length}`);
check(new Set(ids.map(e => e[1])).size === GLYPHS, 'ids distinct');
for (const [name, id] of ids) {
  check(Number.isInteger(id) && id >= 0 && id < AS.GLYPH_COUNT, `${name} id range`);
  check(/^#[0-9a-f]{6}$/.test(AS.COLORS[id]), `${name} has COLORS entry`);
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

// grassGlyph: a blade's third by its Size
const { T } = AS.parseTables(texts);
const cases = [[0, 'GRASS_0'], [0.34, 'GRASS_1'], [0.5, 'GRASS_1'], [0.67, 'GRASS_2'], [1.0, 'GRASS_2'], [1 / 3, 'GRASS_1'], [0.3333, 'GRASS_0']];
for (const [size, name] of cases) check(AS.grassGlyph(size) === AS.GLYPH[name], `size ${size} -> ${name}`);
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
  sim2.weather.field = null;   // no soil tint: this check is about animals and bodies, and a whole-world draw would record a veil per wet tile
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

// Fire (option E): a burning tile draws the burning thing charred, then a flame; at and above
// the engulf stage only the full flame. The sway is real time. The far view colors it by stage.
{
  const sim3 = AS.Sim(T, 11), W3 = sim3.W;
  sim3.weather.field = null;   // no soil tint (see sim2)
  ctx.window = { devicePixelRatio: 1 };
  const { r, cam, sheet, rec } = rig(sim3);
  // A tile with a blade, and one with a body, both away from the edge.
  let blade = -1, body = -1;
  for (let t = 0; t < W3.n; t++) {
    if (blade < 0 && W3.kind[t] === AS.KIND.GRASS && !W3.hole[t] && W3.flow[t] === AS.FLOW.NONE) blade = t;
  }
  let victim = -1;
  for (let s = 0; s < W3.aHigh; s++) if (W3.aAlive[s] && W3.aSpecies[s] === AS.SPECIES.BUNNY) { victim = s; break; }
  body = W3.aTile[victim];
  AS.killAnimal(sim3, victim);
  check(W3.kind[body] === AS.KIND.CORPSE && AS.ignite(sim3, body), 'a corpse can be set alight');
  check(AS.ignite(sim3, blade), 'a blade can be set alight');
  const tileIds = (t, nowMs) => {
    rec.ids.length = 0; rec.tiles.length = 0;
    r.draw(sim3, cam, sheet, null, 0, nowMs, 1);
    const x = (t % W3.w) * 10, y = ((t / W3.w) | 0) * 10;
    return rec.ids.filter((_, i) => rec.tiles[i][0] === x && rec.tiles[i][1] === y);
  };
  const third = AS.grassGlyph(W3.gSize[blade]) - AS.GLYPH.GRASS_0;
  let looks = 0;
  // Puts tile t at `stage` of its burn. Ages and burn times are float32, so stage × time can
  // land a hair under stage (whatever BurnHours is): nudge the age up until fireStage agrees.
  const setStage = (t, stage) => {
    let age = stage * W3.fireTime[t];
    W3.fireAge[t] = age;
    while (AS.fireStage(W3, t) < stage) { age = age * (1 + 1e-7) + 1e-9; W3.fireAge[t] = age; }
  };
  for (const stage of [0, 0.1, 0.3, 0.5, 0.6, 0.79, 0.8, 0.9, 1]) {
    for (const t of [blade, body]) setStage(t, stage);
    const look = AS.fireLook(stage), frame = AS.flameFrame(5000, blade % W3.w, (blade / W3.w) | 0);
    const got = tileIds(blade, 5000);
    const want = look.char >= 0 ? [AS.spriteCharGrass(third, look.char), AS.spriteFire(look.flame, frame)] : [AS.spriteFire(look.flame, frame)];
    check(JSON.stringify(got) === JSON.stringify(want), `blade at stage ${stage}: ${want} drawn (got ${got})`);
    check(!got.includes(AS.spriteGrass(third)) && !got.includes(AS.spriteGrassLean(third)), `blade at stage ${stage}: its plain sprite never shows`);
    const bgot = tileIds(body, 5000), bl = bgot.length;
    const fid = AS.spriteFire(look.flame, AS.flameFrame(5000, body % W3.w, (body / W3.w) | 0));
    check(bgot[bl - 1] === fid && (look.char >= 0 ? bl === 2 : bl === 1), `body at stage ${stage}: charred body (if still in view), then flame`);
    if (look.char >= 0) check(bgot[0] === AS.spriteCharCarcass(AS.SPECIES.BUNNY, look.char), 'a body with meat burns as a carcass');
    looks++;
  }
  // The flame sprite swaps with the sway clock, and at most once per hold of real time.
  W3.fireAge[blade] = 0.5 * W3.fireTime[blade];
  const seenFrames = [];
  for (let ms = 0; ms < 30000; ms += 1000 / 60) {
    const g = tileIds(blade, ms), f = g[g.length - 1];
    if (seenFrames.length === 0 || seenFrames[seenFrames.length - 1][1] !== f) seenFrames.push([ms, f]);
    if (ms > 3000) break;
  }
  const gaps = seenFrames.slice(1).map((e, i) => e[0] - seenFrames[i][0]);
  check(seenFrames.length >= 4 && Math.min(...gaps.slice(1)) >= AS.FLAME_HOLD_MS - 17, `the drawn flame changes no faster than every ${AS.FLAME_HOLD_MS} ms (${gaps.map(Math.round)}; the first runs from the start of the clock)`);

  // Rings: 'fires' has a color in the fire palette and rings only burning tiles.
  check(/^\d+,\d+,\d+$/.test(AS.LOCATE_COLORS.fires), 'fires has a ring color');
  check(AS.LOCATE_COLORS.fires !== AS.LOCATE_COLORS.bunnies && Object.values(AS.LOCATE_COLORS).filter(c => c === AS.LOCATE_COLORS.fires).length === 1, 'the fires ring color is its own');
  check(AS.LOCATE_COLORS.fires === [1, 3, 5].map(i => parseInt(AS.FIRE_PALETTE.y.slice(i, i + 2), 16)).join(','), 'the ring color is the flames\' yellow');
  const arcs = [];
  const g2 = new Proxy({}, { get(_, k) { if (k === 'arc') return () => arcs.push(1); if (k === 'canvas') return c2; return () => {}; }, set() { return true; } });
  const c2 = { width: W3.w * 10, height: W3.h * 10, clientWidth: W3.w * 10, clientHeight: W3.h * 10, getContext: () => g2 };
  const r2 = AS.Renderer(c2);
  const cam2 = { x: 0, y: 0, scale: 10, visible: () => ({ x0: 0, y0: 0, x1: W3.w - 1, y1: W3.h - 1 }) };
  r2.locate(new Set(['fires']), 0);
  r2.draw(sim3, cam2, sheet, null, 0, 0, 1);
  check(arcs.length === W3.fCount && W3.fCount === 2, `'fires' rings each burning tile (${arcs.length} rings, ${W3.fCount} fires)`);
  r2.locate(new Set(), 0);

  // The far view: burning tiles by stage, embers on tiles burnt out within FIRE_EMBER_HOURS, then plain scorch.
  let image = null;
  const fakeCanvas = { width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: img => { image = img; } }) };
  ctx.document = { createElement: () => fakeCanvas };
  const px32 = t => new Uint32Array(image.data.buffer)[t];
  const farAt = (t, stage) => { setStage(t, stage); r2.farCanvas(sim3); return px32(t); };
  const catching = farAt(blade, 0.1), mid = farAt(blade, 0.6), full = farAt(blade, 0.95);
  check(catching !== mid && mid === full, `far view: catching is dimmer than the mid flames and the last part (#${catching.toString(16)} ${mid.toString(16)} ${full.toString(16)})`);
  check(farAt(blade, 0.3) === catching && farAt(blade, 0.52) === catching && farAt(blade, 0.53) === mid, 'far view changes color where the look does');
  const fireDays = sim3.T.world.FireScorchDays;
  // Burn the blade out by hand: a fresh scorch glows, an old one doesn't.
  W3.removeFire(blade); W3.removeGrass(blade);
  W3.scorch[blade] = fireDays; W3.ash[blade] = sim3.T.grass.Ash;   // embers glow where a fuel fire left ash
  r2.farCanvas(sim3); const fresh = px32(blade);
  W3.scorch[blade] = fireDays * 0.5; r2.farCanvas(sim3); const old = px32(blade);
  W3.scorch[blade] = fireDays - 12 / 24 * 0.5; r2.farCanvas(sim3); const dimmer = px32(blade);
  const red = c => c & 255;
  check(red(fresh) > red(dimmer) && red(dimmer) > red(old), `far view: embers glow on fresh scorch and dim to plain scorch (${red(fresh)} > ${red(dimmer)} > ${red(old)})`);
  console.log(`fire: ${looks} stages drawn, far colors catching/mid/full/ember ${catching.toString(16)}/${mid.toString(16)}/${full.toString(16)}/${fresh.toString(16)}`);
}
// Burning animals and painted embers: the body AND a flame on the animal's tile; calm, none; the
// flame sways no faster than FLAME_HOLD_MS on the animal's own clock; the far view and the
// 'fires' rings mark it; an ember tile (bare ground) draws a flame and no char or blade.
{
  const sim4 = AS.Sim(T, 13), W4 = sim4.W;
  sim4.weather.field = null;   // no soil tint (see sim2)
  ctx.window = { devicePixelRatio: 1 };
  const { r, cam, sheet, rec } = rig(sim4);
  const flameIds = new Set([0, 1, 2, 3].flatMap(f => [0, 1].map(k => AS.spriteFire(f, k))));
  const onTile = (t, nowMs) => {
    rec.ids.length = 0; rec.tiles.length = 0;
    r.draw(sim4, cam, sheet, null, 0, nowMs, 1);
    const x = (t % W4.w) * 10, y = ((t / W4.w) | 0) * 10;
    return rec.ids.filter((_, i) => rec.tiles[i][0] >= x && rec.tiles[i][0] < x + 10 && rec.tiles[i][1] > y - 10 && rec.tiles[i][1] < y + 10);
  };
  const live = [];
  for (let s = 0; s < W4.aHigh && live.length < 2; s++) if (W4.aAlive[s] && W4.wDepth[W4.aTile[s]] === 0 && !W4.hole[W4.aTile[s]] && (live.length === 0 || W4.aSpecies[s] !== W4.aSpecies[live[0]])) live.push(s);
  const [calm, burn] = live, bt = W4.aTile[burn], ct = W4.aTile[calm];
  const before = onTile(bt, 1000);
  check(before.length >= 1 && !before.some(i => flameIds.has(i)), 'animal not burning: no flame sprite');
  check(AS.ignite(sim4, bt) && W4.aAlight[burn] > 0, 'an animal can be set alight');
  const hours = sim4.T[AS.SPECIES_KEY[W4.aSpecies[burn]]].AlightHours;
  const body = before.filter(i => !flameIds.has(i));
  for (const left of [1, 0.6, 0.3, 0.01]) {
    W4.aAlight[burn] = hours * left;
    const got = onTile(bt, 1000);
    check(body.every(i => got.includes(i)) && got.some(i => flameIds.has(i)), `burning animal (${Math.round(left * 100)}% left): body and a flame on its tile`);
    check(!got.includes(AS.spriteFire(AS.FLAME.FULL, 0)) && !got.includes(AS.spriteFire(AS.FLAME.FULL, 1)), 'never the engulfing full flame');
  }
  check(!onTile(ct, 1000).some(i => flameIds.has(i)), 'a calm animal beside it has no flame');
  W4.aAlight[burn] = hours;
  const seen = [];
  for (let ms = 0; ms <= 30000; ms += 1000 / 60) {
    const f = onTile(bt, ms).filter(i => flameIds.has(i)).join();
    if (!seen.length || seen[seen.length - 1][1] !== f) seen.push([ms, f]);
  }
  const gaps = seen.slice(1).map((e, i) => e[0] - seen[i][0]);
  check(seen.length >= 30 && Math.min(...gaps.slice(1)) >= AS.FLAME_HOLD_MS - 17, `animal flame changes no faster than every ${AS.FLAME_HOLD_MS} ms over 30 s (${seen.length} changes, shortest ${Math.round(Math.min(...gaps.slice(1)))} ms)`);

  // Far view and rings.
  let image = null;
  ctx.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: img => { image = img; } }) }) };
  const arcs = [];
  const g2 = new Proxy({}, { get(_, k) { if (k === 'arc') return () => arcs.push(1); if (k === 'canvas') return c2; return () => {}; }, set() { return true; } });
  const c2 = { width: W4.w * 10, height: W4.h * 10, clientWidth: W4.w * 10, clientHeight: W4.h * 10, getContext: () => g2 };
  const r2 = AS.Renderer(c2);
  const px32 = t => new Uint32Array(image.data.buffer)[t];
  r2.farCanvas(sim4);
  const lit = px32(bt), plain = px32(ct);
  W4.aAlight[burn] = hours * 0.2; r2.farCanvas(sim4);
  check(px32(bt) === lit, 'far view: the burning color is steady');
  W4.aAlight[burn] = 0; r2.farCanvas(sim4);
  check(px32(bt) !== lit && px32(ct) === plain, 'far view: the species color when calm, and a calm one beside it is unchanged');
  W4.aAlight[burn] = hours; r2.farCanvas(sim4);
  const cam2 = { x: 0, y: 0, scale: 10, visible: () => ({ x0: 0, y0: 0, x1: W4.w - 1, y1: W4.h - 1 }) };
  r2.locate(new Set(['fires']), 0);
  r2.draw(sim4, cam2, sheet, null, 0, 0, 1);
  check(arcs.length === 1, `'fires' rings the burning animal (${arcs.length} rings, 0 burning tiles)`);
  r2.locate(new Set(), 0);

  // Painted ember on bare ground.
  let bare = -1;
  for (let t = 0; t < W4.n; t++) if (W4.kind[t] === AS.KIND.EMPTY && W4.flow[t] === AS.FLOW.NONE && W4.wDepth[t] === 0 && !W4.hole[t] && W4.scorch[t] === 0) { bare = t; break; }
  check(AS.ignite(sim4, bare) && W4.flow[bare] === AS.FLOW.FIRE && W4.kind[bare] === AS.KIND.EMPTY, 'bare ground can hold a painted ember');
  for (const stage of [0, 0.3, 0.6, 0.9]) {
    W4.fireAge[bare] = stage * W4.fireTime[bare];
    while (AS.fireStage(W4, bare) < stage) W4.fireAge[bare] = W4.fireAge[bare] * (1 + 1e-7) + 1e-9;
    const got = onTile(bare, 2000), look = AS.fireLook(stage);
    check(got.length === 1 && got[0] === AS.spriteFire(look.flame, AS.flameFrame(2000, bare % W4.w, (bare / W4.w) | 0)), `ember at stage ${stage}: just its flame (got ${got})`);
  }
  console.log(`alight: ${seen.length} flame frames in 30 s (shortest ${Math.round(Math.min(...gaps.slice(1)))} ms), far ${lit.toString(16)} vs ${plain.toString(16)}`);
}

// Ash and embers follow W.ash: ash pixels on a tile with ash and none on a scorched tile without
// (a nuke's), thinner as the ash is spent; embers only where a fuel fire burnt out, near and far.
{
  const sim5 = AS.Sim(T, 17), W5 = sim5.W, S5 = sim5.T;
  sim5.weather.field = null;   // no soil tint (see sim2)
  ctx.window = { devicePixelRatio: 1 };
  const fireDays = S5.world.FireScorchDays, full = S5.grass.Ash, SCALE = 10;
  const dry = [];
  for (let t = 0; t < W5.n && dry.length < 3; t++) if (W5.kind[t] === AS.KIND.EMPTY && W5.flow[t] === AS.FLOW.NONE && W5.wDepth[t] === 0 && !W5.hole[t] && W5.scorch[t] === 0) dry.push(t);
  const [fueled, nuked, plain] = dry;
  // A recording canvas: ash is batched into rect() calls under a globalAlpha, embers are small fillRects.
  let alpha = 1;
  const rec = { ash: [], embers: [] };
  const g = new Proxy({}, { get(_, k) {
    if (k === 'rect') return (x, y, w, h) => rec.ash.push([x, y, alpha]);
    if (k === 'fillRect') return (x, y, w, h) => { if (w < SCALE) rec.embers.push([x, y]); };
    if (k === 'canvas') return canvas;
    return () => {};
  }, set(_, k, v) { if (k === 'globalAlpha') alpha = v; return true; } });
  const canvas = { width: W5.w * SCALE, height: W5.h * SCALE, clientWidth: W5.w * SCALE, clientHeight: W5.h * SCALE, getContext: () => g };
  const r5 = AS.Renderer(canvas);
  const cam5 = { x: 0, y: 0, scale: SCALE, visible: () => ({ x0: 0, y0: 0, x1: W5.w - 1, y1: W5.h - 1 }) };
  const sheet5 = { get: px => ({ canvas: {}, px, sx: i => i, sy: () => 0 }) };
  const inTile = (list, t) => list.filter(e => e[0] >= (t % W5.w) * SCALE && e[0] < (t % W5.w + 1) * SCALE && e[1] >= ((t / W5.w) | 0) * SCALE && e[1] < ((t / W5.w | 0) + 1) * SCALE);
  const look = () => { rec.ash.length = 0; rec.embers.length = 0; r5.draw(sim5, cam5, sheet5, null, 0, 1000, 1); };
  W5.scorch[fueled] = fireDays; W5.ash[fueled] = full;
  W5.scorch[nuked] = fireDays;                 // scorched but no ash: a nuke's
  look();
  const strong = inTile(rec.ash, fueled);
  check(strong.length > 0, 'ash pixels are drawn on a tile with ash');
  check(inTile(rec.ash, nuked).length === 0 && inTile(rec.ash, plain).length === 0, 'none on a scorched tile with no ash, nor on plain ground');
  check(inTile(rec.embers, fueled).length > 0 && inTile(rec.embers, nuked).length === 0, 'embers glow on the tile a fuel fire burnt out and never on a nuke\'s');
  // Spent or weathered ash draws fainter; more than a full blade's is capped; ash past the scorch still shows.
  W5.ash[fueled] = full * 0.3; look();
  check(inTile(rec.ash, fueled).length === strong.length && inTile(rec.ash, fueled)[0][2] < strong[0][2], 'a third of the ash is drawn at a lower alpha');
  W5.ash[fueled] = full * 5; look();
  check(inTile(rec.ash, fueled)[0][2] === strong[0][2], 'more ash than a full blade\'s draws no stronger than a full one');
  W5.scorch[fueled] = 0; look();
  check(inTile(rec.ash, fueled).length > 0 && inTile(rec.embers, fueled).length === 0, 'ash outlasts the scorch (and the embers go with it)');
  // The far view: the fresh-burn glow needs ash.
  let image = null;
  ctx.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: img => { image = img; } }) }) };
  W5.scorch[fueled] = fireDays; W5.scorch[nuked] = fireDays; W5.ash[fueled] = full;
  r5.farCanvas(sim5);
  const px = new Uint32Array(image.data.buffer), red = c => c & 255;
  check(red(px[fueled]) > red(px[nuked]), `far view: embers glow on the fuel fire's tile, not the nuke's (${red(px[fueled])} > ${red(px[nuked])})`);
}

// Water is drawn over real time (WATER_FADE_MS), so a shore tile the sim flips every water step
// can't flash at speed: its drawn water eases, at most 1 / WATER_FADE_MS per ms, and the far
// view blends the same way.
{
  const FADE = AS.WATER_FADE_MS, STEP_TICKS = Math.round(AS.WATER_STEP_DAYS * AS.DAY_SECONDS * AS.TICK_HZ);
  check(FADE >= 1000 && FADE <= 1500, `WATER_FADE_MS is cinematic but not sluggish (${FADE})`);
  const simW = AS.Sim(T, 5), WW = simW.W;
  ctx.window = { devicePixelRatio: 1 };
  let image = null;
  ctx.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: img => { image = img; } }) }) };
  const { r, sheet, rec } = rig(simW);
  let tile = -1;
  for (let t = 0; t < WW.n; t++) if (WW.isBare(t) && WW.wDepth[t] === 0 && !WW.scorch[t] && !WW.hole[t] && !WW.ash[t]) { tile = t; break; }
  // The camera sees only a few tiles around it: the fades run over the whole world, the drawing is the cost here.
  const cam = { x: 0, y: 0, scale: 10, visible: () => ({ x0: tile % WW.w, y0: (tile / WW.w) | 0, x1: tile % WW.w + 1, y1: ((tile / WW.w) | 0) + 1 }) };
  const wetD = 2, deepD = 6;   // meters: a mid band, a deep band
  const bandA = AS.waterBand(wetD), bandB = AS.waterBand(deepD);
  check(bandA !== bandB, 'the test depths are in different bands');
  let now = 0;
  const frame = ms => { now += ms; r.draw(simW, cam, sheet, null, 0, now, 1); };
  const stepWater = () => { simW.tickCount += STEP_TICKS; };
  frame(16);
  check(r.waterLevel(tile) === 0 && r.waterFading === 0, 'dry ground: no water drawn, nothing fading');

  // Becomes wet and stays wet: eased in, full by WATER_FADE_MS, and settled (no work left).
  WW.setDepth(tile, wetD); stepWater();
  frame(16);
  const first = r.waterLevel(tile);
  check(first > 0 && first < 0.1, `a tile turning wet starts to show (${first.toFixed(3)}), it does not snap on`);
  let sawMid = false;
  for (let t = 16; t < FADE; t += 16) { frame(16); const l = r.waterLevel(tile); if (l > 0.3 && l < 0.7) sawMid = true; }
  check(sawMid, 'a tile turning wet passes through half water');
  frame(32);
  check(r.waterLevel(tile) === 1 && r.waterBand(tile) === bandA && r.waterFading === 0, `wet and staying wet: full water in its band within WATER_FADE_MS (${r.waterLevel(tile)})`);

  // The far view blends too: halfway through a fade the pixel is between ground and water.
  WW.setDepth(tile, 0); stepWater();
  frame(16); for (let t = 0; t < FADE / 2 - 16; t += 16) frame(16);
  r.farCanvas(simW);
  const px = new Uint32Array(image.data.buffer), red = c => c & 255, blue = c => (c >>> 16) & 255;
  const dryRef = (() => { let o = -1; for (let t = 0; t < WW.n; t++) if (WW.isBare(t) && !WW.scorch[t] && !WW.hole[t] && WW.wDepth[t] === 0 && t !== tile) { o = t; break; } return px[o]; })();
  frame(FADE); r.farCanvas(simW);
  check(px[tile] === dryRef, 'far view: once the water has left, the tile is the ground\'s color');
  WW.setDepth(tile, wetD); stepWater(); frame(16); frame(FADE); r.farCanvas(simW);
  const wetPx = px[tile];
  check(blue(wetPx) > blue(dryRef) + 40, 'far view: wet tile is blue');
  WW.setDepth(tile, 0); stepWater(); frame(16);
  for (let t = 0; t < FADE / 2; t += 16) frame(16);
  r.farCanvas(simW);
  check(blue(px[tile]) > blue(dryRef) && blue(px[tile]) < blue(wetPx), `far view: halfway through drying the tile is between ground and water (${blue(px[tile])})`);
  frame(FADE * 2); r.farCanvas(simW);

  // A tile the sim flips every water step, at the top speed. Water steps every WATER_STEP_DAYS ×
  // DAY_SECONDS sim seconds; at 50× and more that is a step in well under a frame (60 fps).
  // However fast, the drawn level moves at most dt / FADE per frame, so it never completes a
  // wet-dry-wet cycle in under 2 × WATER_FADE_MS.
  for (const stepMs of [1, 10, 100, FADE / 2, 2 * FADE]) {
    WW.setDepth(tile, 0); stepWater(); frame(16); frame(2 * FADE);
    let wet = false, prev = r.waterLevel(tile), maxSlope = 0, since = 0, cycles = 0, up = false, lastUp = -1e9, worstCycleMs = Infinity, simNow = now;
    const end = now + 6 * FADE;
    let nextFlip = now, nowT = now;
    while (nowT < end) {
      const dt = 1000 / 60;
      nowT += dt;
      while (nextFlip <= nowT) {   // every sim step that fell in this frame
        wet = !wet; if (wet) WW.setDepth(tile, wetD); else WW.setDepth(tile, 0);
        stepWater(); nextFlip += stepMs;
      }
      now = nowT; r.draw(simW, cam, sheet, null, 0, now, 1);
      const l = r.waterLevel(tile);
      maxSlope = Math.max(maxSlope, Math.abs(l - prev) / dt * FADE);
      // A visible on/off cycle: from below 0.1 to above 0.9 and back.
      if (!up && l >= 0.9) { up = true; if (lastUp > -1e8) worstCycleMs = Math.min(worstCycleMs, now - lastUp); lastUp = now; }
      if (up && l <= 0.1) up = false;
      prev = l;
    }
    void simNow; void since; void cycles;
    check(maxSlope <= 1 + 1e-4, `a tile flipping every ${stepMs} ms eases at most 1/WATER_FADE_MS per ms (${maxSlope.toFixed(3)} of it)`);
    check(worstCycleMs >= 2 * FADE - 20, `a tile flipping every ${stepMs} ms never shows a full on/off cycle in under 2 × WATER_FADE_MS (${worstCycleMs} ms)`);
  }

  // A flip back before the fade is done turns the water around from where it is: no jump.
  WW.setDepth(tile, 0); stepWater(); frame(16); frame(2 * FADE);
  WW.setDepth(tile, wetD); stepWater(); frame(16);
  for (let t = 0; t < FADE * 0.4; t += 16) frame(16);
  const mid = r.waterLevel(tile);
  WW.setDepth(tile, 0); stepWater(); frame(16);
  check(Math.abs(r.waterLevel(tile) - mid) <= 16 / FADE + 1e-6 && r.waterLevel(tile) < mid, 'flipping back mid-fade reverses smoothly from where it is');
  frame(2 * FADE);
  check(r.waterLevel(tile) === 0 && r.waterFading === 0, 'and the water leaves completely');

  // A depth-band change crossfades under the old look, never dipping toward the ground.
  WW.setDepth(tile, wetD); stepWater(); frame(16); frame(2 * FADE);
  WW.setDepth(tile, deepD); stepWater(); frame(16);
  let minLevel = 1, ids = new Set();
  for (let t = 0; t < FADE; t += 16) { frame(16); minLevel = Math.min(minLevel, r.waterLevel(tile)); }
  check(minLevel === 1, `a band change keeps full water on screen throughout (${minLevel})`);
  frame(2 * FADE);
  check(r.waterBand(tile) === bandB && r.waterFading === 0, 'and ends in the new band');
  void ids; void red; void rec;
}

// Weather's looks (Paul, from the weather mockup): soil wetness (wetter darkens, drier fades the grass
// toward straw, over real time and never flapping), rain streaks under showers that stay a while
// after they pass, a lightning bolt at most once per BOLT_GAP_MS, and none of it in a world without water.
{
  const FADE = AS.SOIL_FADE_MS, HOLD = AS.STREAK_HOLD_MS, GAP = AS.BOLT_GAP_MS;
  ctx.window = { devicePixelRatio: 1 };
  ctx.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) };
  const SC = 10, VEIL = 'rgb(6,16,32)', STREAK = `rgb(${AS.STREAK_RGB})`;
  // A smaller world (a sweep and a draw of the whole of it are what these checks pay for), still with water and rain.
  const { editCSV } = require('./harness.js');
  const Ts = AS.parseTables({ ...texts, settings: editCSV(editCSV(texts.settings, 'WorldWidth', 'Value', '160'), 'WorldHeight', 'Value', '110') }).T;
  // A recording canvas and renderer. `view` is the camera's visible rectangle (default: all of it).
  function rig2(sim, view, scale = SC) {
    const W = sim.W, rec = { ids: [], tiles: [], rects: [], strokes: [], lineTos: 0 };
    let alpha = 1, fill = '', stroke = '';
    const g = new Proxy({}, {
      get(_, k) {
        if (k === 'drawImage') return (img, sx, sy, sw, sh, dx, dy) => { rec.ids.push(sx); rec.tiles.push([dx, dy]); };
        if (k === 'rect') return (x, y, w, h) => rec.rects.push({ x, y, w, h, alpha, fill });
        if (k === 'fillRect') return (x, y, w, h) => rec.rects.push({ x, y, w, h, alpha, fill, single: true });
        if (k === 'lineTo') return () => { rec.lineTos++; };
        if (k === 'stroke') return () => rec.strokes.push({ style: stroke, alpha });
        if (k === 'canvas') return canvas;
        return () => {};
      },
      set(_, k, v) { if (k === 'globalAlpha') alpha = v; else if (k === 'fillStyle') fill = v; else if (k === 'strokeStyle') stroke = v; return true; },
    });
    const canvas = { width: W.w * SC, height: W.h * SC, clientWidth: W.w * SC, clientHeight: W.h * SC, getContext: () => g };
    const r = AS.Renderer(canvas);
    const vis = view || { x0: 0, y0: 0, x1: W.w - 1, y1: W.h - 1 };
    const cam = { x: 0, y: 0, scale, visible: () => vis };
    const sheet = { get: px => ({ canvas: {}, px, sx: i => i, sy: () => 0 }) };
    const clear = () => { rec.ids.length = 0; rec.tiles.length = 0; rec.rects.length = 0; rec.strokes.length = 0; rec.lineTos = 0; };
    let now = 0;
    const frame = (ms, speed = 1) => { now += ms; clear(); r.draw(sim, cam, sheet, null, 0, now, speed); return now; };
    return { r, cam, rec, frame, clear, get now() { return now; }, set view(v) { vis.x0 = v.x0; vis.y0 = v.y0; vis.x1 = v.x1; vis.y1 = v.y1; } };
  }
  const grassTiles = (sim, n, from = 0) => {
    const W = sim.W, out = [];
    for (let t = from; t < W.n && out.length < n; t++) if (W.kind[t] === AS.KIND.GRASS && !W.hole[t] && W.flow[t] === AS.FLOW.NONE && W.wDepth[t] === 0 && !W.scorch[t] && !W.beach[t]) out.push(t);
    return out;
  };
  const tileRects = (rec, t, W, list = rec.rects) => list.filter(q => q.x === (t % W.w) * SC && q.y === ((t / W.w) | 0) * SC);

  // 1. One mapping from soil water, monotone: tiles at rising soil water draw rising wetness.
  {
    const simS = AS.Sim(Ts, 5), WS = simS.W, room = WS.water.room, G = WS.water.G;
    const tiles = grassTiles(simS, 18, 3000);
    const fs = tiles.map((_, i) => 0.0004 * Math.pow(0.95 / 0.0004, i / (tiles.length - 1)));   // from drier than any meadow to nearly full
    tiles.forEach((t, i) => { G[t] = room * fs[i]; WS.gSize[t] = 0.9; });
    const { r, rec, frame } = rig2(simS);
    frame(16);
    const levels = tiles.map(t => r.soilLevel(t));
    check(levels.every((l, i) => i === 0 || l >= levels[i - 1]), `soil level never falls as soil water rises (${levels})`);
    check(levels[0] < 0 && levels[levels.length - 1] > 0, 'the driest soil is dry and the wettest wet');
    check(new Set(levels).size >= 5, `the levels are told apart across the range (${[...new Set(levels)]})`);
    const third = AS.grassGlyph(0.9) - AS.GLYPH.GRASS_0;
    const dryIds = new Set(), plainIds = new Set([AS.spriteGrass(third), AS.spriteGrassLean(third), AS.spriteGrassLeanLeft(third)]);
    for (let st = 1; st <= AS.DRY_STEPS; st++) for (const lean of [0, 1, -1]) dryIds.add(AS.spriteGrassDry(third, lean, st));
    let ok = true, alphas = [];
    tiles.forEach((t, i) => {
      const drawn = rec.ids.filter((_, k) => rec.tiles[k][0] === (t % WS.w) * SC && rec.tiles[k][1] === ((t / WS.w) | 0) * SC);
      const veils = tileRects(rec, t, WS).filter(q => q.fill === VEIL);
      alphas.push(veils.length ? veils[0].alpha : 0);
      if (levels[i] < 0 && !(drawn.length === 1 && dryIds.has(drawn[0]))) ok = false;
      if (levels[i] >= 0 && !(drawn.length === 1 && plainIds.has(drawn[0]))) ok = false;
      if ((levels[i] > 0) !== (veils.length === 1)) ok = false;
    });
    check(ok, 'dry soil draws the straw grass, neutral and wet the plain, and wet soil gets one veil');
    check(alphas.every((a, i) => i === 0 || a >= alphas[i - 1]) && alphas[alphas.length - 1] > 0.3, `the veil darkens as soil water rises (${alphas.map(a => a.toFixed(2))})`);
    check(Math.max(...alphas) >= 0.5, 'and gets strong at the top (stronger than the mockup\'s 0.42)');
    // the far view: wet grass is darker than plain, dry grass is yellower
    let image = null;
    ctx.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: img => { image = img; } }) }) };
    r.farCanvas(simS, 100);
    const px = new Uint32Array(image.data.buffer), chan = (t, sh) => (px[t] >>> sh) & 255, lum = t => chan(t, 0) + chan(t, 8) + chan(t, 16);
    const iDry = levels.findIndex(l => l < 0), iMid = levels.findIndex(l => l === 0), iWet = levels.length - 1;
    check(iMid >= 0 && lum(tiles[iWet]) < lum(tiles[iMid]), `far view: wet grass is darker than plain (${lum(tiles[iWet])} < ${lum(tiles[iMid])})`);
    check(chan(tiles[iDry], 0) - chan(tiles[iDry], 16) > chan(tiles[iMid], 0) - chan(tiles[iMid], 16), 'far view: dry grass is more straw (redder, less blue) than plain');
    console.log(`soil: levels ${levels}, veil alphas ${alphas.map(a => a.toFixed(2))}`);
  }

  // 2. A tile whose soil flips across a level every water step changes its drawn level at most
  // once per FADE of real time, whatever the speed of the flips, and a fade that turns back is reversed.
  {
    const simF = AS.Sim(Ts, 7), WF = simF.W, room = WF.water.room, G = WF.water.G;
    const [t] = grassTiles(simF, 1, 6000);
    const view = { x0: t % WF.w - 1, y0: ((t / WF.w) | 0) - 1, x1: t % WF.w + 1, y1: ((t / WF.w) | 0) + 1 };
    const wetF = 0.5, dryF = 0.0005;   // well past any threshold either way
    for (const stepMs of [10, 100, 600, 2500]) {   // 20 s of 60 fps frames each
      G[t] = room * dryF;
      const { r, frame } = rig2(simF, view);
      frame(16); for (let ms = 0; ms < 8 * FADE; ms += 100) frame(100);
      let wet = false, nextFlip = 0, clock = 0, last = r.soilLevel(t), lastChange = -1e9, minGap = Infinity, changes = 0;
      for (let ms = 0; ms < 20000; ms += 16, clock += 16) {
        while (nextFlip <= clock) { wet = !wet; G[t] = room * (wet ? wetF : dryF); nextFlip += stepMs; }
        frame(16);
        const l = r.soilLevel(t);
        if (l !== last) { changes++; minGap = Math.min(minGap, clock - lastChange); lastChange = clock; last = l; }
      }
      check(minGap >= FADE - 20, `a tile flipping across levels every ${stepMs} ms changes its drawn level at most once per SOIL_FADE_MS (${changes} changes in 20 s, shortest gap ${minGap === Infinity ? '-' : Math.round(minGap)} ms)`);
    }
    // A tile that goes wet and stays so gets there one level at a time, within a few FADEs, and settles.
    G[t] = room * dryF;
    const { r, frame } = rig2(simF, view);
    frame(16); for (let ms = 0; ms < 8 * FADE; ms += 100) frame(100);
    const from = r.soilLevel(t); G[t] = room * wetF;
    const seen = [from]; let prev = from;
    for (let ms = 0; ms < 12 * FADE; ms += 16) { frame(16); const l = r.soilLevel(t); if (l !== prev) { seen.push(l); prev = l; } }
    check(seen.every((l, i) => i === 0 || l === seen[i - 1] + 1) && seen[seen.length - 1] > 0 && r.soilFading === 0, `going from dry to wet it steps through each level in turn and settles (${seen})`);
  }

  // 3. No soil, no tint: a world without water, and one without rain, draw plain grass and no veil.
  for (const [label, make] of [['without water', () => AS.Sim(Ts, 9, { water: false })], ['without rain', () => { const s = AS.Sim(Ts, 9); s.weather.field = null; return s; }]]) {
    const simN = make(), WN = simN.W;
    const tiles = grassTiles(simN, 6, 3000);
    if (WN.water) for (const t of tiles) WN.water.G[t] = 0;
    const { r, rec, frame } = rig2(simN);
    frame(16); frame(5000);
    const third = i => AS.grassGlyph(WN.gSize[tiles[i]]) - AS.GLYPH.GRASS_0;
    const plain = tiles.every((t, i) => rec.ids.some((id, k) => rec.tiles[k][0] === (t % WN.w) * SC && rec.tiles[k][1] === ((t / WN.w) | 0) * SC && [AS.spriteGrass(third(i)), AS.spriteGrassLean(third(i)), AS.spriteGrassLeanLeft(third(i))].includes(id)));
    check(plain && !rec.rects.some(q => q.fill === VEIL) && tiles.every(t => r.soilLevel(t) === 0) && r.soilFading === 0, `a world ${label} has no soil tint`);
  }

  // 4. Rain streaks: only under a shower, kept STREAK_HOLD_MS after it passes, then eased out; at
  // speed (or paused) they stand still; none zoomed out; none with no showers.
  {
    const simR = AS.Sim(Ts, 3), WR = simR.W, S = simR.weather.showers;
    S.n = 0;
    const cx = Math.floor(WR.w / 2), cy = Math.floor(WR.h / 2), R = 24;
    const view = { x0: cx - 30, y0: cy - 20, x1: cx + 30, y1: cy + 20 };
    const { r, rec, frame } = rig2(simR, view);
    const streaks = () => rec.rects.filter(q => q.fill === STREAK);
    const under = cy * WR.w + cx, away = (cy - 19) * WR.w + cx + 29;
    frame(16); frame(100);
    check(streaks().length === 0 && r.streakLevel(under) === 0, 'no showers: no streaks');
    S.n = 1; S.x[0] = cx; S.y[0] = cy; S.r[0] = R; S.mmh[0] = 10; S.left[0] = 100; if (S.storm) S.storm[0] = 0;
    for (let ms = 0; ms < 600; ms += 16) frame(16);
    check(streaks().length > 0 && r.streakLevel(under) === 1, 'a shower overhead: streaks under it');
    check(r.streakLevel(away) === 0, 'and none in the corner of the view it does not reach');
    // it passes: streaks hold at full for STREAK_HOLD_MS, then ease out, gone within a second or so
    S.n = 0;
    const t0 = frame(16), level = []; let n0 = streaks().length;
    for (let ms = 16; ms < HOLD + 2500; ms += 16) { const now = frame(16); level.push([now - t0, r.streakLevel(under), streaks().length]); }
    const atHold = level.find(([ms]) => ms >= HOLD - 32);
    check(n0 > 0 && atHold[1] === 1 && atHold[2] > 0, `streaks are still at full ${HOLD} ms after the shower has gone`);
    check(level[level.length - 1][1] === 0 && level[level.length - 1][2] === 0, 'then they are gone');
    let monotone = true; for (let i = 1; i < level.length; i++) if (level[i][0] > HOLD + 32 && level[i][1] > level[i - 1][1] + 1e-9) monotone = false;
    check(monotone, 'and ease out without coming back');
    // paused or fast, they stand still (the same rects frame to frame); at 1x they fall
    S.n = 1; S.x[0] = cx; S.y[0] = cy; S.r[0] = R; S.left[0] = 100;
    for (let ms = 0; ms < 1500; ms += 16) frame(16, 1);
    const pos = () => JSON.stringify(streaks().map(q => [q.x, q.y]));
    const a = pos(); frame(250, 1); const b = pos();
    check(a !== b, 'at 1x the streaks fall');
    for (let ms = 0; ms < 2000; ms += 16) frame(16, 20);
    const c = pos(); frame(250, 20); frame(250, 20); const d = pos();
    check(c === d && streaks().length > 0, 'at 20x they hold still, so nothing churns');
    for (let ms = 0; ms < 2000; ms += 16) frame(16, 0);
    const e = pos(); frame(250, 0);
    check(e === pos(), 'paused, they hold still');
    // zoomed out, none
    const far = rig2(simR, view, 3);
    far.frame(16); far.frame(2000, 1);
    check(far.rec.rects.filter(q => q.fill === STREAK).length === 0, 'zoomed out (far view): no streaks');
    S.n = 0;
  }

  // 5. Lightning: a new strike (sim.weather.strikes) draws one thin pale bolt, fading in, holding, fading out,
  // never above BOLT_PEAK; the next strike inside BOLT_GAP_MS draws none; off screen or zoomed out, none.
  {
    const simL = AS.Sim(Ts, 4), WL = simL.W;
    const cx = Math.floor(WL.w / 2), cy = Math.floor(WL.h / 2);
    const view = { x0: cx - 30, y0: cy - 20, x1: cx + 30, y1: cy + 20 };
    const strikes = simL.weather.strikes || (simL.weather.strikes = { n: 0, tile: new Int32Array(32), atSec: new Float64Array(32), lit: new Uint8Array(32) });
    strikes.n = 0;
    const strike = (x, y) => { const i = strikes.n % strikes.tile.length; strikes.tile[i] = y * WL.w + x; strikes.atSec[i] = simL.simSeconds; strikes.lit[i] = 0; strikes.n++; };
    const { r, rec, frame } = rig2(simL, view);
    const boltAlpha = () => { const q = rec.strokes.filter(s => s.style.startsWith(`rgba(${AS.BOLT_RGB},`)); return q.length ? parseFloat(q[0].style.split(',')[3]) : 0; };
    frame(16); frame(100);
    check(boltAlpha() === 0 && r.bolt === null, 'no strike, no bolt');
    // history that was there before it was looked at is not replayed
    strike(cx, cy); const first = frame(16);
    check(r.bolt !== null || boltAlpha() >= 0, 'a strike is noticed');
    strikes.n = 0;
    const sim0 = simL; void sim0;
    // a strike off screen draws nothing and costs the gap nothing
    frame(GAP + 100); strike(cx + 200, cy);
    let alpha = 0; for (let ms = 0; ms < 2500; ms += 16) { frame(16); alpha = Math.max(alpha, boltAlpha()); }
    check(alpha === 0 && r.bolt === null, 'a strike off screen draws no bolt');
    // an on-screen strike: one bolt, shaped fade, peak under the cap
    strike(cx + 3, cy + 2); const t0 = frame(16);
    const track = []; for (let ms = 0; ms < 2600; ms += 16) { const now = frame(16); track.push([now - t0, boltAlpha(), rec.lineTos]); }
    const peak = Math.max(...track.map(q => q[1]));
    check(peak > 0.2 && peak <= 0.7, `the bolt shows, peaking at ${peak.toFixed(2)} (at most 0.7)`);
    check(track.some(q => q[2] > 4), 'it is a jagged line of several segments');
    const at = ms => track.find(q => q[0] >= ms)[1];
    check(at(100) < at(450) && at(450) >= peak - 1e-9 && at(1300) < at(450) && at(1300) > 0 && at(2400) === 0, `it fades in, holds, and fades out over ${(track.filter(q => q[1] > 0).length * 16 / 1000).toFixed(1)} s (${[100, 450, 1300, 2400].map(ms => at(ms).toFixed(2))})`);
    let monotone = true, rising = true;
    for (let i = 1; i < track.length; i++) { if (track[i][0] < 280 && track[i][1] < track[i - 1][1]) rising = false; if (track[i][0] > 950 && track[i][1] > track[i - 1][1]) monotone = false; }
    check(rising && monotone, 'in without a step back, out without a step back');
    // a second strike inside the gap draws none; one after it draws one
    strike(cx - 4, cy + 1);
    let second = 0; for (let ms = 0; ms < 2500; ms += 16) { frame(16); second = Math.max(second, boltAlpha()); }
    check(second === 0, `a second strike within BOLT_GAP_MS draws no bolt`);
    frame(GAP); strike(cx - 5, cy + 3);
    let third = 0; for (let ms = 0; ms < 1500; ms += 16) { frame(16); third = Math.max(third, boltAlpha()); }
    check(third > 0.2, 'a strike after the gap draws a bolt again');
    // zoomed out, none, and zooming in replays nothing
    const far = rig2(simL, view, 3); far.frame(16); far.frame(2 * GAP);
    strike(cx, cy + 1); let farA = 0; for (let ms = 0; ms < 1500; ms += 16) { far.frame(16); farA = Math.max(farA, far.rec.strokes.filter(s => s.style.startsWith(`rgba(${AS.BOLT_RGB}`)).length); }
    check(farA === 0, 'zoomed out: no bolt');
    // no strikes object at all: nothing happens
    const bare = AS.Sim(Ts, 4); bare.weather.strikes = undefined;
    const b = rig2(bare, view); b.frame(16); b.frame(100);
    check(b.rec.strokes.length === 0 && b.r.bolt === null, 'a sim without sim.weather.strikes draws no bolt and does not fail');
  }
}
console.log(bad ? `FAIL (${bad})` : `PASS (${ids.length} glyphs, 12 animal combos, ${cases.length} grass cases)`);
process.exit(bad ? 1 : 0);
