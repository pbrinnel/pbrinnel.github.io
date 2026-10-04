// Node check of sprites.js (no DOM): bitmaps, sprite indices, the pose rule, facing memory.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const ctx = vm.createContext({ console, crypto: globalThis.crypto });
vm.runInContext('globalThis.AS = { V: 0 };', ctx);
for (const f of [...require('./harness.js').SIM_FILES, 'sprites']) {
  const file = path.join(ROOT, 'js', f + '.js');
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
}
const AS = ctx.AS;
let bad = 0;
const check = (c, m) => { if (!c) { bad++; console.log('FAIL: ' + m); } };

// Bitmaps: 8 rows of 8 known characters (or '.').
const SIZE = AS.SPRITE_SIZE, ALLOWED = new Set(AS.SPRITE_CODES + '.');
const maps = [];
const B = AS.SPRITE_BITMAPS;
B.bunny.forEach((m, i) => maps.push([`bunny ${i}`, m]));
B.wolf.forEach((m, i) => maps.push([`wolf ${i}`, m]));
B.carcass.forEach((m, i) => maps.push([`carcass ${i}`, m]));
B.skull.forEach((m, i) => maps.push([`skull ${i}`, m]));
B.hole.forEach((m, i) => maps.push([`hole ${i}`, m]));
B.peek.forEach((m, i) => maps.push([`peek ${i}`, m]));
B.grassLean.forEach((m, i) => maps.push([`grass lean ${i}`, m]));
B.grass.forEach((m, i) => maps.push([`grass ${i}`, m]));
check(B.bunny.length === AS.SPRITE_FRAMES && B.wolf.length === AS.SPRITE_FRAMES, 'every species has SPRITE_FRAMES frames');
check(B.grass.length === 3, 'three grass bitmaps');
for (const [name, m] of maps) {
  check(m.length === SIZE, `${name}: ${SIZE} rows, got ${m.length}`);
  m.forEach((row, j) => {
    check(row.length === SIZE, `${name} row ${j}: ${SIZE} chars, got ${row.length}`);
    for (const c of row) check(ALLOWED.has(c), `${name} row ${j}: unknown code '${c}'`);
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
for (let sp = 0; sp < 2; sp++) for (let sx = 0; sx < 2; sx++) for (let st = 0; st < 3; st++)
  for (let fl = 0; fl < 2; fl++) for (let fr = 0; fr < AS.SPRITE_FRAMES; fr++)
    add(AS.spriteIndex(sp, sx, st, fl, fr), `sp${sp} sex${sx} stage${st} left${fl} frame${fr}`);
for (let sp = 0; sp < 2; sp++) add(AS.spriteSkull(sp), `skull ${sp}`);
for (let sp = 0; sp < 2; sp++) add(AS.spriteCarcass(sp), `carcass ${sp}`);
add(AS.spriteHole(), 'hole');
for (let sx = 0; sx < 2; sx++) add(AS.spritePeek(sx), `peek sex${sx}`);
for (let t = 0; t < 3; t++) add(AS.spriteGrassLean(t), `grass lean ${t}`);
for (let t = 0; t < 3; t++) add(AS.spriteGrass(t), `grass ${t}`);
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
for (const sp of [0, 1]) {
  const name = sp ? 'wolf' : 'bunny';
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
// Winded is the wolf's only.
eq(pose(1, false, false, true, true, false, H.NONE, SLOW, 0, 0), F.WINDED, 0, 'winded wolf resting');
eq(pose(1, false, false, false, true, false, H.NONE, SLOW, 0, 0), F.WINDED, 0, 'winded wolf standing');
eq(pose(0, false, false, true, true, false, H.NONE, SLOW, 0, 0), F.REST, 0, 'bunny never shows winded');
// Lean bitmaps: top rows shifted right by one, the rest unchanged.
B.grass.forEach((m, i) => m.forEach((row, j) => {
  const want = j < 4 ? '.' + row.slice(0, 7) : row;
  check(B.grassLean[i][j] === want, `grass lean ${i} row ${j}`);
}));
// Gust band: one gust per period; inside the band leans, outside doesn't, between gusts none.
{
  const x = 40, y = 10, every = 25, speed = 18, width = 5;
  // The front reaches this tile at tIn and the band's tail clears it at tOut.
  const pos = x + y * 0.5, tIn = pos / speed, tOut = (pos + width) / speed;
  check(AS.grassLeans(x, y, tIn + 0.01), 'tile inside the gust band leans');
  check(!AS.grassLeans(x, y, tOut + 0.01), 'tile behind the band does not lean');
  check(!AS.grassLeans(x, y, tIn - 0.05), 'tile ahead of the band does not lean');
  check(AS.grassLeans(x, y, tIn + 0.01 + every), 'the gust repeats each period');
  let leaning = 0;
  for (let c = 0; c < every; c += 0.05) if (AS.grassLeans(x, y, c)) leaning++;
  check(leaning > 0 && leaning * 0.05 < 2 * (width / speed) + 0.2, `a tile leans only briefly per period (${leaning * 0.05}s)`);
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
console.log(bad ? `FAIL (${bad})` : `PASS (${maps.length} bitmaps, ${seen.size} sprites)`);
process.exit(bad ? 1 : 0);
