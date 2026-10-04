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
maps.push(['corpse', B.corpse]);
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
add(AS.SPRITE_CORPSE, 'corpse');
for (let t = 0; t < 3; t++) add(AS.spriteGrass(t), `grass ${t}`);
check(seen.size === AS.SPRITE_COUNT, `every index used once (${seen.size} of ${AS.SPRITE_COUNT})`);

// Pose rule. The idle window is found by scanning the clock, not by assuming its numbers.
const out = new Float64Array(2);
for (const sp of [0, 1]) {
  const name = sp ? 'wolf' : 'bunny';
  let idleFrame = -1, idleAt = -1, standAt = -1;
  for (let c = 0; c < 20; c += 0.01) {
    AS.spritePose(sp, false, 0, c, out);
    check(out[1] === 0, `${name} standing never lifts (clock ${c.toFixed(2)})`);
    if (out[0] !== 0 && idleAt < 0) { idleAt = c; idleFrame = out[0]; }
    if (out[0] === 0 && standAt < 0) standAt = c;
    check(out[0] === 0 || out[0] === idleFrame, `${name} standing uses frame 0 or the one idle frame`);
  }
  check(idleAt >= 0 && standAt >= 0, `${name} both stands and fidgets`);
  AS.spritePose(sp, false, 0, idleAt, out);
  check(out[0] === idleFrame && out[1] === 0, `${name} idle window shows the idle frame, no lift`);
  AS.spritePose(sp, false, 0, standAt + 0.0001, out);
  check(out[0] === 0 && out[1] === 0, `${name} outside the window: frame 0, no lift`);
  // Across a step the frames come from the cycle; every one is a real frame, lift small.
  const frames = [];
  for (let p = 0; p <= 1; p += 0.01) {
    AS.spritePose(sp, true, p, 0, out);
    check(out[0] >= 0 && out[0] < AS.SPRITE_FRAMES, `${name} step frame in range`);
    check(Number.isInteger(out[1]) && out[1] >= 0, `${name} lift is whole sprite pixels`);
    frames.push(out[0] + ':' + out[1]);
  }
  const runs = frames.filter((f, i) => i === 0 || f !== frames[i - 1]);
  check(new Set(runs).size > 1, `${name} walking changes pose across a step`);
  AS.spritePose(sp, true, 0, 0, out);
  const first = out[0] + ':' + out[1];
  AS.spritePose(sp, true, 1, 0, out);
  check(first !== out[0] + ':' + out[1] || runs.length > 2, `${name} step starts and ends differently`);
  AS.spritePose(sp, true, 0.5, 0, out); const mid = out[0];
  AS.spritePose(sp, true, 0.5, 1.5, out);
  check(out[0] === mid, `${name} idle clock doesn't affect a step`);
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
