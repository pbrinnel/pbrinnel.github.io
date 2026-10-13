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
console.log(bad ? `FAIL (${bad})` : `PASS (${ids.length} glyphs, 12 animal combos, ${cases.length} grass cases)`);
process.exit(bad ? 1 : 0);
