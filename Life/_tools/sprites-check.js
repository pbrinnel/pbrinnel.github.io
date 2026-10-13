// Node check of sprites.js (no DOM): bitmaps, sprite indices, the pose rule, facing memory.
'use strict';
const { load } = require('./harness.js');
const { AS, texts } = load({}, ['sprites']);
let bad = 0;
const check = (c, m) => { if (!c) { bad++; console.log('FAIL: ' + m); } };

// Bitmaps: 8 rows of 8 known characters (or '.').
const SIZE = AS.SPRITE_SIZE, ALLOWED = new Set(AS.SPRITE_CODES + '.');
const maps = [];
const B = AS.SPRITE_BITMAPS;
B.bunny.forEach((m, i) => maps.push([`bunny ${i}`, m]));
B.wolf.forEach((m, i) => maps.push([`wolf ${i}`, m]));
B.human.forEach((m, i) => maps.push([`human ${i}`, m]));
B.carcass.forEach((m, i) => maps.push([`carcass ${i}`, m]));
B.skull.forEach((m, i) => maps.push([`skull ${i}`, m]));
B.hole.forEach((m, i) => maps.push([`hole ${i}`, m]));
B.peek.forEach((m, i) => maps.push([`peek ${i}`, m]));
B.grassLean.forEach((m, i) => maps.push([`grass lean ${i}`, m]));
B.grassLeanLeft.forEach((m, i) => maps.push([`grass lean left ${i}`, m]));
B.grass.forEach((m, i) => maps.push([`grass ${i}`, m]));
B.water.forEach((m, i) => maps.push([`water ${i}`, m]));
B.nuke.forEach((m, i) => maps.push([`nuke icon ${i}`, m]));
const FIRE_ALLOWED = new Set(AS.SPRITE_FIRE_CODES + '.');   // flames have their own code set
B.fire.forEach((m, i) => maps.push([`flame ${i}`, m, FIRE_ALLOWED]));
check(B.bunny.length === AS.SPRITE_FRAMES && B.wolf.length === AS.SPRITE_FRAMES && B.human.length === AS.SPRITE_FRAMES, 'every species has SPRITE_FRAMES frames');
check(B.carcass.length === AS.SPECIES_COUNT && B.skull.length === AS.SPECIES_COUNT, 'a carcass and a skull per species');
// The human carries a spear in every pose but the fallen one: spearhead (m) or shaft (q) shows.
B.human.forEach((m, i) => { if (i !== AS.SPRITE_FRAME.DEAD) check(m.some(r => /[qm]/.test(r)), `human frame ${i} shows its spear`); });
check(B.grass.length === 3, 'three grass bitmaps');
for (const [name, m, allowed = ALLOWED] of maps) {
  check(m.length === SIZE, `${name}: ${SIZE} rows, got ${m.length}`);
  m.forEach((row, j) => {
    check(row.length === SIZE, `${name} row ${j}: ${SIZE} chars, got ${row.length}`);
    for (const c of row) check(allowed.has(c), `${name} row ${j}: unknown code '${c}'`);
  });
  check(m.some(r => /[^.]/.test(r)), `${name} is not blank`);
}

// Indices: distinct and in range across every combination, plus corpse and grass.
const seen = new Set();
const add = (i, what) => {
  check(Number.isInteger(i) && i >= 0 && i < AS.SPRITE_COUNT, `${what} index ${i} in range`);
  check(!seen.has(i), `${what} index ${i} distinct`);
  seen.add(i);
};
for (let sp = 0; sp < AS.SPECIES_COUNT; sp++) for (let sx = 0; sx < 2; sx++) for (let st = 0; st < 3; st++)
  for (let fl = 0; fl < 2; fl++) for (let fr = 0; fr < AS.SPRITE_FRAMES; fr++)
    add(AS.spriteIndex(sp, sx, st, fl, fr), `sp${sp} sex${sx} stage${st} left${fl} frame${fr}`);
for (let sp = 0; sp < AS.SPECIES_COUNT; sp++) add(AS.spriteSkull(sp), `skull ${sp}`);
for (let sp = 0; sp < AS.SPECIES_COUNT; sp++) add(AS.spriteCarcass(sp), `carcass ${sp}`);
add(AS.spriteHole(), 'hole');
add(AS.spriteNuke(), 'nuke icon');
for (let sx = 0; sx < 2; sx++) add(AS.spritePeek(sx), `peek sex${sx}`);
for (let t = 0; t < 3; t++) add(AS.spriteGrassLean(t), `grass lean ${t}`);
for (let t = 0; t < 3; t++) add(AS.spriteGrassLeanLeft(t), `grass lean left ${t}`);
for (let t = 0; t < 3; t++) add(AS.spriteGrass(t), `grass ${t}`);
// Fire: eight flames (four kinds, two sway frames) and every charring of a blade, carcass and skull.
check(B.fire.length === 8, 'eight flame bitmaps: four kinds, two sway frames each');
for (let f = 0; f < 4; f++) for (let fr = 0; fr < 2; fr++) add(AS.spriteFire(f, fr), `flame ${f} frame ${fr}`);
check(AS.spriteFlame() === AS.spriteFire(AS.FLAME.MID, 0), 'spriteFlame is the mid flame\'s first frame');
for (let lv = 0; lv < AS.CHAR_LEVELS; lv++) {
  for (let t = 0; t < 3; t++) add(AS.spriteCharGrass(t, lv), `charred grass ${t} level ${lv}`);
  for (let sp = 0; sp < AS.SPECIES_COUNT; sp++) { add(AS.spriteCharCarcass(sp, lv), `charred carcass ${sp} level ${lv}`); add(AS.spriteCharSkull(sp, lv), `charred skull ${sp} level ${lv}`); }
}
// Dried grass: each step of dryness in all three poses and thirds.
for (let st = 1; st <= AS.DRY_STEPS; st++) for (const lean of [0, 1, -1]) for (let t = 0; t < 3; t++) add(AS.spriteGrassDry(t, lean, st), `dry grass step ${st} lean ${lean} third ${t}`);
// Burning dry grass: each dry step charred at each level keeps its own sprite, apart from the green ones.
for (let st = 1; st <= AS.DRY_STEPS; st++) for (let lv = 0; lv < AS.CHAR_LEVELS; lv++) for (let t = 0; t < 3; t++) add(AS.spriteCharGrassDry(t, lv, st), `charred dry grass step ${st} level ${lv} third ${t}`);
// Water: in each depth band (AS.waterBand) every variant turns up somewhere, by position alone.
const waterSeen = new Set(), bands = AS.WATER_DEPTH_SHADES.length;
for (let b = 0; b < bands; b++) for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) waterSeen.add(AS.spriteWater(x, y, b));
check(waterSeen.size === B.water.length * bands, `all ${B.water.length} water variants are used in each of ${bands} depths (${waterSeen.size})`);
check(AS.waterBand(0.1) === 0 && AS.waterBand(2) === 1 && AS.waterBand(30) === 2, 'depth bands: shallow, mid, deep');
for (const i of waterSeen) add(i, `water ${i}`);
check(seen.size === AS.SPRITE_COUNT, `every index used once (${seen.size} of ${AS.SPRITE_COUNT})`);

// Pose rule. Arguments: species, moving, sprinting, resting, winded, pregnant, hold, stepMs, p, clock.
const F = AS.SPRITE_FRAME, H = AS.SPRITE_HOLD, FAST = AS.SPRITE_MIN_STEP_MS - 1, SLOW = 1000;
const pose = (sp, mv, spr, rest, wi, preg, hold, ms, p, clock) => {
  AS.spritePose(sp, mv, spr, rest, wi, preg, hold, ms, p, clock, out);
  return [out[0], out[1]];
};
const eq = (got, f, l, m) => check(got[0] === f && got[1] === l, `${m}: got frame ${got[0]} lift ${got[1]}, want ${f} ${l}`);
check(F.STAND === 0 && Object.values(F).length === AS.SPRITE_FRAMES, 'every frame has a named slot');
// Standing: the idle window is found by scanning the clock, not by assuming its numbers.
const out = new Float64Array(2);
for (const sp of [0, 1, 2]) {
  const name = ['bunny', 'wolf', 'human'][sp];
  let idleAt = -1, standAt = -1;
  for (let c = 0; c < 20; c += 0.01) {
    const [f, l] = pose(sp, false, false, false, false, false, H.NONE, SLOW, 0, c);
    check(l === 0, `${name} standing never lifts (clock ${c.toFixed(2)})`);
    check(f === F.STAND || f === F.IDLE, `${name} standing uses stand or idle`);
    if (f === F.IDLE && idleAt < 0) idleAt = c;
    if (f === F.STAND && standAt < 0) standAt = c;
  }
  check(idleAt >= 0 && standAt >= 0, `${name} both stands and fidgets`);
  // Walking changes pose across a step; frames are real, lift whole pixels.
  const seq = [];
  for (let p = 0; p <= 1; p += 0.01) {
    const [f, l] = pose(sp, true, false, false, false, false, H.NONE, SLOW, p, 0);
    check(f >= 0 && f < AS.SPRITE_FRAMES && Number.isInteger(l) && l >= 0, `${name} walk frame and lift valid`);
    seq.push(f + ':' + l);
  }
  check(new Set(seq).size > 1, `${name} walking changes pose across a step`);
  check(pose(sp, true, false, false, false, false, H.NONE, SLOW, 0.5, 0)[0] === pose(sp, true, false, false, false, false, H.NONE, SLOW, 0.5, 1.5)[0], `${name} idle clock doesn't affect a step`);
  // Sprint: run frames, lift 1 then 0.
  eq(pose(sp, true, true, false, false, false, H.NONE, SLOW, 0.1, 0), F.RUN_A, 1, `${name} sprint first half`);
  eq(pose(sp, true, true, false, false, false, H.NONE, SLOW, 0.9, 0), F.RUN_B, 0, `${name} sprint second half`);
  // Sprinting without moving is just standing.
  check(pose(sp, false, true, false, false, false, H.NONE, SLOW, 0, standAt)[0] === F.STAND, `${name} sprint flag alone does nothing`);
  // Rest, pregnant, in priority order.
  eq(pose(sp, false, false, true, false, false, H.NONE, SLOW, 0, 0), F.REST, 0, `${name} resting`);
  eq(pose(sp, false, false, false, false, true, H.NONE, SLOW, 0, standAt), F.PREGNANT, 0, `${name} pregnant standing`);
  eq(pose(sp, false, false, true, false, true, H.NONE, SLOW, 0, 0), F.REST, 0, `${name} rest beats pregnant`);
  const pw = pose(sp, true, false, false, false, true, H.NONE, SLOW, 0.1, 0);
  check(pw[0] === pose(sp, true, false, false, false, false, H.NONE, SLOW, 0.1, 0)[0], `${name} pregnant still walks the walk cycle`);
  // Holds beat everything.
  eq(pose(sp, true, true, true, true, true, H.ACTION, SLOW, 0.5, 0), F.ACT, 0, `${name} action beats sprint, rest, pregnant`);
  eq(pose(sp, true, true, true, true, true, H.FLINCH, SLOW, 0.5, 0), F.RUN_A, 0, `${name} flinch shows runA`);
  const bh = pose(sp, false, false, false, false, false, H.BIRTH, SLOW, 0, 0);
  check(bh[1] === 1, `${name} birth hop lifts`);
  // Fast steps glide standing; holds still show.
  eq(pose(sp, true, false, false, false, false, H.NONE, FAST, 0.5, 0), F.STAND, 0, `${name} fast walk glides standing`);
  eq(pose(sp, true, true, false, false, false, H.NONE, 0, 0.5, 0), F.STAND, 0, `${name} max speed sprint glides standing`);
  eq(pose(sp, true, true, false, false, false, H.ACTION, FAST, 0.5, 0), F.ACT, 0, `${name} fast: action hold still shows`);
  eq(pose(sp, true, false, false, false, true, H.NONE, FAST, 0.5, 0), F.PREGNANT, 0, `${name} fast pregnant glides in pregnant pose`);
  check(pose(sp, true, false, false, false, false, H.NONE, Infinity, 0.5, 0).length === 2, 'paused (infinite step) still poses');
}
// Winded is the wolf's and the human's; a bunny rests instead.
eq(pose(2, false, false, false, true, false, H.NONE, SLOW, 0, 0), F.WINDED, 0, 'winded human standing');
eq(pose(1, false, false, true, true, false, H.NONE, SLOW, 0, 0), F.WINDED, 0, 'winded wolf resting');
eq(pose(1, false, false, false, true, false, H.NONE, SLOW, 0, 0), F.WINDED, 0, 'winded wolf standing');
eq(pose(0, false, false, true, true, false, H.NONE, SLOW, 0, 0), F.REST, 0, 'bunny never shows winded');
// Lean bitmaps: top rows shifted one pixel, the rest unchanged; left is the mirror shift.
B.grass.forEach((m, i) => m.forEach((row, j) => {
  const want = j < 4 ? '.' + row.slice(0, 7) : row;
  check(B.grassLean[i][j] === want, `grass lean ${i} row ${j}`);
  const wantL = j < 4 ? row.slice(1) + '.' : row;
  check(B.grassLeanLeft[i][j] === wantL, `grass lean left ${i} row ${j}`);
}));
check(B.grassLeanLeft.length === 3, 'three left-leaning grass bitmaps');

// Wind gusts. A synthetic sim whose wind we drive; frames at 60 fps of real time.
{
  const G = AS.GUSTS, HOLD = G.HOLD_MS, FPS_MS = 1000 / 60;
  const W = 40, H = 30;
  const mkSim = wind => ({ W: { w: W, h: H }, tickCount: 0, wind });
  // Tiles sampled: a few hundred, spread over the world.
  const tiles = [];
  for (let k = 0; k < 400; k++) tiles.push([(k * 7) % W, (k * 13) % H]);

  // Runs `sec` real seconds at `speed`; windAt(simSec) gives the wind. Returns the shortest
  // real time seen between two changes of one tile, and counts of lean directions.
  function run(speed, sec, windAt) {
    const gu = AS.Gusts(), wind = { from: 0, kmh: 0, toX: 0, toY: 0 }, sim = mkSim(wind);
    const last = tiles.map(() => 0), at = tiles.map(() => -Infinity);
    let minGap = Infinity, flips = 0, right = 0, left = 0, frames = 0;
    let simSec = 0;
    for (let ms = 0; ms < sec * 1000; ms += FPS_MS) {
      const dtSim = speed === Infinity ? 5 : speed * FPS_MS / 1000;   // Max: about five sim seconds a frame
      simSec += dtSim;
      sim.tickCount = Math.floor(simSec / AS.DT);
      Object.assign(wind, windAt(simSec));
      gu.update(sim, ms, speed, (simSec / AS.DT) % 1);
      tiles.forEach(([x, y], i) => {
        const l = gu.leans(x, y);
        if (l > 0) right++; else if (l < 0) left++;
        if (l !== last[i]) { minGap = Math.min(minGap, ms - at[i]); at[i] = ms; last[i] = l; flips++; }
      });
      frames++;
    }
    return { minGap, flips, right, left, frames };
  }
  const wind = (kmh, from) => ({ from, kmh, toX: -Math.sin(from), toY: Math.cos(from) });
  // Calm: nothing leans.
  { const r = run(1, 20, () => wind(AS.WIND.CALM_BELOW_KMH * 0.5, 1)); check(r.flips === 0 && r.right + r.left === 0, 'calm wind: no blade leans'); }
  // A steady windy wind at 1x: gusts come and go, toward the wind's side.
  {
    const to = (from, k = 30) => run(1, 60, () => wind(k, from));
    const e = to(3 * Math.PI / 2), w = to(Math.PI / 2);   // wind from the west blows east (+x)
    check(e.flips > 100 && e.right > 0 && e.left === 0, `wind from the west: gusts lean right only (${e.right}/${e.left}, ${e.flips} flips)`);
    check(w.left > 0 && w.right === 0, `wind from the east: gusts lean left only (${w.right}/${w.left})`);
    const v = to(0);   // from the north: straight down the screen
    check(v.left > 0 && v.right > 0, `wind straight down the screen: blades lean either way (${v.right}/${v.left})`);
    const share = (e.right + e.left) / (e.frames * tiles.length);
    check(share > 0.02 && share < 0.8, `gusts leave room between them (${share.toFixed(3)} of blade-frames lean)`);
  }
  // The hold rule at every speed, with the wind's strength and direction drifting hard.
  const drift = t => wind(8 + 30 * (0.5 + 0.5 * Math.sin(t / 3)), 1 + 2.5 * Math.sin(t / 7));
  const gaps = {};
  for (const sp of [1, 2, 5, 20, 200, Infinity]) {
    const r = run(sp === 200 ? 200 : sp, 60, drift);
    gaps[sp] = [Math.round(r.minGap), r.flips];
    check(r.minGap >= HOLD, `speed ${sp}: no blade changes lean twice within ${HOLD} ms (shortest ${Math.round(r.minGap)} ms, ${r.flips} changes)`);
    check(r.flips > 0, `speed ${sp}: blades do lean`);
  }
  console.log('gusts: [shortest real gap between changes (ms), changes] by speed', JSON.stringify(gaps));
  // Pause freezes the bands.
  {
    const gu = AS.Gusts(), wd = wind(30, 3 * Math.PI / 2), sim = mkSim(wd);
    gu.update(sim, 0, 1, 0);
    let before = ''; for (const [x, y] of tiles) before += gu.leans(x, y);
    for (let ms = 2000; ms < 8000; ms += 100) gu.update(sim, ms, 0, 0);   // tickCount frozen
    let mid = ''; for (const [x, y] of tiles) mid += gu.leans(x, y);   // frozen from here on
    for (let ms = 8000; ms < 12000; ms += 100) gu.update(sim, ms, 0, 0);
    let after = ''; for (const [x, y] of tiles) after += gu.leans(x, y);
    check(after === mid, 'paused: the picture is frozen');
  }
}
// Fire's look by stage (option E): the burning thing stays in view for the first 80% of its
// burn, charring darker, then full flames hide it. Monotone: never lighter, never shorter.
{
  const L = AS.fireLook, A = AS.FIRE_LOOK_AT;
  check(A.ENGULF_AT === 0.8, 'the thing is in view for 80% of its burn');
  check(L(0).char === 0 && L(0).flame === AS.FLAME.TONGUES_SMALL, 'a tile that has just caught: small tongues, a hint of char');
  check(L(A.CATCH_UNTIL - 1e-9).flame === AS.FLAME.TONGUES_SMALL && L(A.CATCH_UNTIL).flame === AS.FLAME.TONGUES_TALL, 'tall tongues from CATCH_UNTIL');
  check(L(A.TALL_UNTIL).flame === AS.FLAME.MID && L(A.TALL_UNTIL).char === 2, 'mid flames from TALL_UNTIL, darkest char');
  check(L(0.79).char === 2 && L(0.79).flame === AS.FLAME.MID, 'just under 0.8: still visible, mid flames');
  check(L(0.8).char === -1 && L(1).char === -1 && L(0.8).flame === AS.FLAME.FULL, 'at and above 0.8: full flames, nothing of it shows');
  let prev = L(0), steps = 0;
  for (let i = 1; i <= 1000; i++) {
    const cur = L(i / 1000);
    check(cur.flame >= prev.flame && (cur.char >= prev.char || cur.char === -1), `look never goes back at ${i / 1000}`);
    if (cur !== prev) steps++;
    prev = cur;
    if (cur.char >= 0) check(cur.char < AS.CHAR_LEVELS, 'char level has a sprite');
  }
  check(steps === 3, `four looks over a burn (${steps + 1})`);
  // The full flame's lower half is solid, so the engulfed thing cannot show through.
  check(B.fire.slice(6).every(m => m.slice(4).every(r => !r.includes('.'))), 'full flames fill the lower half of the tile');
  check(B.fire.slice(0, 6).some(m => m.some(r => r.includes('.')) ), 'tongues and mid flames leave the thing visible');
}
// Sway (Photosensitivity): a tile's flame frame, and its ember steps, change at most once per
// FLAME_HOLD_MS of real time, each tile on its own offset. 30 s at 60 fps over many tiles.
{
  const HOLD = AS.FLAME_HOLD_MS, FRAME_MS = 1000 / 60, tiles = [];
  for (let k = 0; k < 300; k++) tiles.push([(k * 7) % 53, (k * 13) % 37]);
  const lastF = tiles.map(([x, y]) => AS.flameFrame(0, x, y)), lastS = tiles.map(([x, y]) => AS.flameStep(0, x, y)), at = tiles.map(() => -Infinity);
  let minGap = Infinity, changes = 0;
  const phases = new Set();
  for (let ms = 0; ms < 30000; ms += FRAME_MS) {
    tiles.forEach(([x, y], i) => {
      const f = AS.flameFrame(ms, x, y), st = AS.flameStep(ms, x, y);
      check(st - lastS[i] <= 1, 'a step never jumps by more than one at 60 fps');
      if (st !== lastS[i]) { minGap = Math.min(minGap, ms - at[i]); at[i] = ms; changes++; }
      void f; lastS[i] = st; lastF[i] = f;
    });
  }
  tiles.forEach(([x, y]) => phases.add(AS.flameStep(0, x, y) + ':' + Math.round(AS.spriteHash(x, y, 4) * 20)));
  check(minGap >= HOLD - FRAME_MS - 1e-6, `no tile changes twice within ${HOLD} ms (shortest ${minGap.toFixed(1)} ms)`);
  check(changes >= tiles.length * 36 && changes <= tiles.length * 38, `each tile changes about every ${HOLD} ms (${(changes / tiles.length).toFixed(1)} per tile in 30 s)`);
  // Not in unison: at any moment the tiles are spread over the hold.
  const at0 = new Set(tiles.map(([x, y]) => Math.round((((10000 + AS.spriteHash(x, y, 4) * HOLD) % HOLD) / HOLD) * 10)));
  check(at0.size >= 8, `tiles change at different moments (${at0.size} of 10 slots hit)`);
  check(phases.size > 5, 'the offsets differ per tile');
  console.log(`flames: shortest real gap between changes ${minGap.toFixed(1)} ms, ${(changes / tiles.length).toFixed(1)} changes per tile in 30 s`);
}
// Idle offsets spread over the period.
const offs = new Set();
for (let s = 1; s <= 50; s++) offs.add(AS.spriteIdleOffset(s).toFixed(3));
check(offs.size > 40, 'idle offsets differ per serial');

// Facing: follows the last sideways step, survives a vertical one, resets on a new serial.
{
  const W = { aCap: 2, aHigh: 1, w: 10, aAlive: [1, 0], aSerial: [1, 0], aTile: [5, 0], aFrom: [4, 0] };
  const f = AS.SpriteFacing();
  f.update(W); check(f.left(0) === 0, 'steps right: faces right');
  W.aTile[0] = 14; W.aFrom[0] = 15; f.update(W); check(f.left(0) === 1, 'steps left: faces left');
  W.aTile[0] = 24; W.aFrom[0] = 14; f.update(W); check(f.left(0) === 1, 'vertical step keeps the side');
  W.aSerial[0] = 2; f.update(W); check(f.left(0) === 0, 'new animal in the slot starts facing right');
  W.aCap = 100; W.aHigh = 50; for (let i = 1; i < 50; i++) { W.aAlive[i] = 1; W.aSerial[i] = i; W.aTile[i] = 1; W.aFrom[i] = 2; }
  f.update(W); check(f.left(49) === 1 && f.left(0) === 0, 'grows with aCap, keeping slots');
}
// In the water: each species has an eye in its standing frame, above the swimming cut, so a
// swimmer always shows its eyes; rows and columns land where paint() puts them; spans mirror.
{
  const F = AS.SPRITE_FRAME, S = AS.STAGE;
  for (let sp = 0; sp < AS.SPECIES_COUNT; sp++) {
    const e = AS.spriteEyeRow(sp);
    check(e >= 0 && e + 1 + AS.SWIM_BELOW <= AS.SWIM_CUT, `species ${sp}: eye row ${e} stays above the water when swimming`);
    const r = AS.spriteRowSpan(sp, F.STAND, e + 1, false), l = AS.spriteRowSpan(sp, F.STAND, e + 1, true);
    check(r && l && l[0] === 7 - r[1] && l[1] === 7 - r[0], `species ${sp}: a waterline span mirrors when facing left`);
  }
  check(AS.spriteRowPx(48, S.ADULT, 3) === 18 && AS.spriteColPx(48, S.ADULT, 8) === 48, 'an adult\'s rows and columns are whole sprite pixels of its cell');
  check(AS.spriteRowPx(48, S.BABY, 8) === 48 && AS.spriteRowPx(48, S.BABY, 0) > 0, 'a baby\'s rows end at its cell\'s bottom (drawn smaller, bottom-centered)');
}
console.log(bad ? `FAIL (${bad})` : `PASS (${maps.length} bitmaps, ${seen.size} sprites)`);
process.exit(bad ? 1 : 0);
