// Checks AS.benchMath (the pure parts of Life/js/bench.js) in a Node vm, and
// prints one tick's cost at each step as a first look at the numbers.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const ctx = vm.createContext({ console, crypto: globalThis.crypto });
vm.runInContext('globalThis.AS = { V: 0 };', ctx);
for (const f of [...require('./harness.js').SIM_FILES, 'bench']) {
  const file = path.join(ROOT, 'js', f + '.js');
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
}
const AS = ctx.AS;
AS.TICK_BUDGET_MS = 12;   // main.js sets this in the browser
const texts = {};
for (const f of ['species', 'variables', 'states', 'settings']) texts[f] = fs.readFileSync(path.join(ROOT, 'tables', f + '.csv'), 'utf8');
const { T, errors } = AS.parseTables(texts);
assert(!errors.length, errors.join('\n'));
const M = AS.benchMath;

let n = 0; const ok = m => console.log('ok', ++n, m);
const near = (a, b, eps, m) => assert(Math.abs(a - b) <= eps, `${m}: ${a} vs ${b}`);

// worldFor
const paul = Math.round(T.world.WorldWidth * T.world.WorldHeight * T.world.StartGrass);
for (const blades of M.BLADE_STEPS) {
  const { w, h, share, fits } = M.worldFor(T, blades);
  assert(fits && w <= 2000 && h <= 2000, 'fits ' + blades);
  near(w / h, T.world.WorldWidth / T.world.WorldHeight, 0.02 * T.world.WorldWidth / T.world.WorldHeight, 'aspect ' + blades);
  assert(share >= T.world.StartGrass && share <= 1);
  const sim = AS.Sim(M.derive(T, w, h, { bunnies: 0, wolves: 0 }, share), 1, { grassAges: 'mixed' });
  const got = sim.W.gCount;
  assert(Math.abs(got - blades) / blades <= 0.01, `${blades}: got ${got}`);
  console.log(`   ${String(blades).padStart(7)} -> ${w}x${h} @ ${(share * 100).toFixed(1)}%  (${got} blades)`);
}
ok('worldFor: aspect, sides <= 2000, blades within 1% for every step');
{ // From the tables: a blade count that fits at StartGrass, and one past what the side cap holds.
  const aspect = T.world.WorldWidth / T.world.WorldHeight;
  const capTiles = aspect >= 1 ? 2000 * Math.round(2000 / aspect) : Math.round(2000 * aspect) * 2000;
  const a = M.worldFor(T, Math.floor(capTiles * T.world.StartGrass / 4)), b = M.worldFor(T, Math.ceil(capTiles * T.world.StartGrass * 1.2));
  assert.strictEqual(a.share, T.world.StartGrass); assert(b.share > T.world.StartGrass && Math.max(b.w, b.h) === 2000);
  ok('share stays Paul\'s while the world fits, rises when the side cap bites'); }
{ const r = M.worldFor(T, 5e6); assert(!r.fits && r.w <= 2000 && r.h <= 2000); ok('a step that cannot fit is flagged'); }
{ const r = M.worldFor(T, 768000, 2000, 1000); assert(r.fits); const r2 = M.worldFor(T, 2660000, 2000, 100000); assert(!r2.fits); ok('animals are kept room for'); }
{ const { w, h } = M.worldFor(T, paul); assert(w === T.world.WorldWidth && h === T.world.WorldHeight); ok("Paul's own blade count gives Paul's own world size"); }

// percentile
const hundred = Array.from({ length: 100 }, (_, i) => i + 1);
assert.strictEqual(M.percentile(hundred, 95), 95);
assert.strictEqual(M.percentile(hundred, 50), 50);
assert.strictEqual(M.percentile(hundred, 100), 100);
assert.strictEqual(M.percentile([5, 1, 3], 50), 3);
assert.strictEqual(M.percentile([7], 95), 7);
assert.strictEqual(M.percentile([], 95), 0);
ok('percentile on known arrays');

// verdict
const steady = Array(180).fill(16.6);
const mix = (frac, ms, n = 200) => Array.from({ length: n }, (_, i) => (i < frac * n ? ms : 16.6));
assert(M.verdict(steady)); ok('verdict passes a steady 16.6 ms series');
assert(M.verdict(mix(0.04, 25))); ok('verdict passes 4% at 25 ms');
assert(!M.verdict(mix(0.06, 25))); ok('verdict fails 6% at 25 ms');
assert(!M.verdict([...steady, 60])); ok('verdict fails a single 60 ms hitch');
assert(M.verdict([...steady, 49])); ok('verdict allows a single 49 ms frame');
assert(M.verdict(Array(100).fill(18))); ok('verdict allows timer jitter (18 ms)');
assert(!M.verdict([])); ok('verdict fails an empty series');

// largestSmooth
const step = (blades, a, b) => ({ blades, views: { start: { smooth: a }, out: { smooth: b } } });
const steps = [step(1, true, true), step(2, true, false), step(3, false, true), step(4, true, true)];
assert.strictEqual(M.largestSmooth(steps, 'start'), 2);
assert.strictEqual(M.largestSmooth(steps, 'out'), 1);
assert.strictEqual(M.largestSmooth([step(1, false, false)], 'start'), 0);
assert.strictEqual(M.largestSmooth([step(1, true, true), { blades: 2, views: {} }], 'start'), 1);
ok('largestSmooth stops at the first failure even if a later step passes');

// keepUpSpeed: 12 ms budget, 60 fps, 30 ticks/s
near(M.keepUpSpeed(1, 12, 30), 24, 1e-9, 'keepUp 1ms');
near(M.keepUpSpeed(0.2, 12, 30), 120, 1e-9, 'keepUp 0.2ms');
assert(M.keepUpSpeed(25, 12, 30) < 1);
assert.strictEqual(M.speedText(M.keepUpSpeed(0.5, 12, 30)), '≈ 48×');
assert.strictEqual(M.speedText(0.4), '< 1×');
assert.strictEqual(M.keepUpSpeed(0, 12, 30), Infinity);
assert.strictEqual(M.keepUpSpeed(1), 24);   // defaults come from AS.TICK_BUDGET_MS and AS.TICK_HZ
ok('keepUpSpeed math and text');

// summaryText, both series
const row = (count, speed, a, b, blades) => ({ count, blades: blades || count, speed, views: { start: { smooth: a }, out: { smooth: b } } });
const rows = [row(12000, 80, true, true), row(24000, 41.2, true, true), row(48000, 20, true, false), row(96000, 9, false, false)];
const arows = [row(1000, 70, true, true, 36000), row(2000, 35, true, true, 36000), row(4000, 17, true, false, 36000), row(8000, 8, false, false, 36000)];
const sum = M.summaryText(rows, arows, { paulBlades: 24000, grassTotal: 7, animalTotal: 7 });
assert.strictEqual(sum[0], 'Grass alone: smooth (60 fps at 1×) up to 48,000 blades at the default zoom and 24,000 zoomed out.');
assert.strictEqual(sum[1], 'Animals: smooth (60 fps at 1×) up to 4,000 animals at the default zoom and 2,000 zoomed out (with 36,000 blades).');
assert.strictEqual(sum[2], "Fastest speed that keeps up at 24,000 blades (Paul's world): ≈ 41×");
assert.strictEqual(sum[3], 'With 1,000 animals: keeps up to ≈ 70×');
ok('summaryText wording, grass and animals');
console.log('   ' + sum.join('\n   '));
{ const all = M.BLADE_STEPS.map(b => row(b, 5, true, true));
  assert(M.summaryText(all, null, { grassTotal: 7 })[0].endsWith('(the largest step tested).')); ok('summaryText says when the last step passed');
  const none = M.summaryText([row(12000, 5, false, false)], null, {});
  assert.strictEqual(none[0], 'Grass alone: smooth (60 fps at 1×) not even at 12,000 blades at the default zoom and not even at 12,000 zoomed out.'); ok('summaryText when nothing passed');
  const noted = M.summaryText(rows, null, { notes: ['Ran out of memory at 5 blades.'] });
  assert.strictEqual(noted[noted.length - 1], 'Ran out of memory at 5 blades.'); ok('notes come last');
}

// animals
{ const a = M.animalsFor(T, 1000);
  assert.strictEqual(a.bunnies + a.wolves, 1000);
  near(a.wolves / 1000, T.world.StartWolves / (T.world.StartBunnies + T.world.StartWolves), 0.001, 'wolf share');
  const tiny = M.animalsFor(T, 3); assert(tiny.wolves >= 1 && tiny.bunnies + tiny.wolves === 3);
  const one = M.animalsFor(T, 1); assert.strictEqual(one.wolves, 1);
  ok('animalsFor splits by the start ratio and keeps at least one wolf');
  for (const n of M.ANIMAL_STEPS) { const w = M.animalWorldFor(T, n); assert(w.fits && w.w === 600 && w.h === 400 && w.share === T.world.StartGrass); }
  const big = M.animalWorldFor(T, 64000);
  const sim = AS.Sim(M.derive(T, big.w, big.h, big.animals, big.share), 1, { grassAges: 'mixed', bodies: 'mixed' });
  assert.strictEqual(sim.W.bunnies + sim.W.wolves, 64000); assert.strictEqual(sim.W.gCount, Math.round(240000 * T.world.StartGrass));
  ok('the 600x400 animal world holds its blades plus 64,000 animals, and a Sim builds from it');
  assert(!M.animalWorldFor(T, 220000).fits); ok('too many animals is flagged');
}

// reportText holds both tables
{ const mk = (rs, extra) => rs.map(r => ({ ...r, w: 600, h: 400, share: 0.15, tickMs: 1.5, speed: 16, views: { start: { p95: 17, workP95: 3, worst: 20, drawP95: 2, smooth: true }, out: { p95: 17, workP95: 3, worst: 20, drawP95: 2, smooth: false } } }));
  const text = M.reportText([{ key: 'grass', rows: mk(rows) }, { key: 'animals', rows: mk(arows) }], ['summary line'], ['device line']);
  assert(text.includes('Grass only') && text.includes('Animals (with 36,000 blades)'));
  assert(/\banimals\s+world/.test(text) && /\bblades\s+world/.test(text) && text.includes('600×400 @ 15%'));
  assert(text.includes('summary line') && text.includes('device line'));
  ok('reportText has both tables');
}

// timeTicks with a clock that only moves in 0.1 ms steps, like Chrome's performance.now()
for (const trueMs of [0.05, 0.135, 0.9, 7]) {
  let t = 0;
  const got = M.timeTicks(() => { t += trueMs; }, () => Math.floor(t / 0.1 + 1e-9) * 0.1);
  assert(Math.abs(got - trueMs) / trueMs <= 0.01, `timeTicks ${trueMs}: ${got}`);
}
ok('timeTicks accurate to 1% on a 0.1 ms clock (0.05, 0.135, 0.9, 7 ms ticks)');
assert.deepStrictEqual([1, 0.05, 12, 123.4, 0.135, 12.34].map(M.fmtTick), ['1.00', '0.0500', '12.0', '123', '0.135', '12.3']); ok('fmtTick');

// Smooth with the display's own rate and the work measured separately
{ const frames = (n, ms) => Array(n).fill(ms);
  assert(M.verdict(frames(90, 33.3), frames(90, 2), 30)); ok('30 Hz series with 2 ms of work passes');
  assert(!M.verdict(frames(90, 33.3), frames(90, 2), 60)); ok('the same 33 ms spacing fails on a 60 Hz display');
  assert(!M.verdict(frames(180, 16.6), frames(180, 20), 60)); ok('60 Hz with 20 ms of work fails');
  const jitter = frames(200, 16.6).map((x, i) => (i < 12 ? 25 : x));
  assert(!M.verdict(jitter, frames(200, 3), 60)); ok('60 Hz, steady work, 6% of intervals at 25 ms fails');
  assert(M.verdict(frames(180, 8.3), frames(180, 5), 120)); ok('120 Hz display is judged at 60 fps, not 120');
  assert(M.verdict(frames(180, 16.6), frames(180, 17.5), 60)); ok('work within the 1 ms Safari tolerance passes');
}
// Paul's world line
{ const mk = b => row(b, 41.2, true, true);
  const reached = M.summaryText(M.BLADE_STEPS.slice(0, 3).map(mk), null, { paulBlades: 24000, refreshHz: 60 });
  assert.strictEqual(reached[1], "Fastest speed that keeps up at 24,000 blades (Paul's world): ≈ 41×"); assert.strictEqual(reached.length, 2);
  const notReached = M.summaryText([mk(12000)], null, { paulBlades: 24000 });
  assert.strictEqual(notReached[1], "The run stopped before reaching 24,000 blades (Paul's world)."); ok("Paul's world line, reached and not reached");
  const capped = M.summaryText(M.BLADE_STEPS.slice(0, 3).map(mk), null, { paulBlades: 24000, refreshHz: 30 });
  assert(capped[2].startsWith('This browser shows only 30 frames a second')); ok('capped-refresh line appears below 60 Hz');
}

// Early numbers: one tick per step, in Node (the browser will differ).
console.log('\nNode tick timings (median of 40 ticks after 30 warm-up ticks):');
for (const blades of M.BLADE_STEPS.filter(b => b <= 192000)) {
  const { w, h } = M.worldFor(T, blades);
  const sim = AS.Sim(M.derive(T, w, h, { bunnies: 0, wolves: 0 }, M.worldFor(T, blades).share), 20240611, { grassAges: 'mixed' });
  for (let i = 0; i < 30; i++) sim.tick();
  const ms = [];
  for (let i = 0; i < 40; i++) { const t0 = process.hrtime.bigint(); sim.tick(); ms.push(Number(process.hrtime.bigint() - t0) / 1e6); }
  const med = M.percentile(ms, 50);
  console.log(`  ${String(sim.W.gCount).padStart(7)} blades  ${w}x${h}  ${med.toFixed(3)} ms/tick  keeps up ${M.speedText(M.keepUpSpeed(med))}`);
}
console.log('\nNode tick timings with animals (600x400, mixed bodies):');
for (const n of M.ANIMAL_STEPS) {
  const b = M.animalWorldFor(T, n);
  const sim = AS.Sim(M.derive(T, b.w, b.h, b.animals, b.share), 20240611, { grassAges: 'mixed', bodies: 'mixed' });
  for (let i = 0; i < 10; i++) sim.tick();
  const ms = [];
  for (let i = 0; i < 10; i++) { const t0 = process.hrtime.bigint(); sim.tick(); ms.push(Number(process.hrtime.bigint() - t0) / 1e6); }
  const med = M.percentile(ms, 50);
  console.log(`  ${String(n).padStart(6)} animals  ${med.toFixed(2)} ms/tick  keeps up ${M.speedText(M.keepUpSpeed(med))}`);
}
console.log('all passed');
