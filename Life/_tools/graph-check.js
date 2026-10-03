const vm = require('vm'), fs = require('fs'), assert = require('assert');
const ctx = { AS: {}, document: { getElementById() { return null; } } }; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require('path').join(__dirname, '../js/graph.js'), 'utf8'), ctx);
const M = ctx.AS.graphMath;
let n = 0; const ok = m => console.log('ok', ++n, m);
const near = (a, b, e = 1e-9) => assert(Math.abs(a - b) < e, `${a} vs ${b}`);

near(M.yOf(0), 0); near(M.yOf(9), 1); near(M.yOf(99), 2); ok('log mapping: 0 on the floor, 9 -> 1, 99 -> 2');
assert(M.yOf(0) < M.yOf(1) && M.yOf(1) < M.yOf(10)); ok('log mapping monotonic');
assert.strictEqual(M.topDecade(0), 1); assert.strictEqual(M.topDecade(9), 1); assert.strictEqual(M.topDecade(10), 2); assert.strictEqual(M.topDecade(23999), 5);
assert.deepStrictEqual(Array.from(M.yTicks(23999)), [0, 1, 10, 100, 1000, 10000, 100000]); ok('top decade and y ticks');
assert.strictEqual(M.fmtCount(1000), '1k'); assert.strictEqual(M.fmtCount(100000), '100k'); assert.strictEqual(M.fmtCount(10), '10'); ok('tick labels');

for (const [d0, d1] of [[0, 3], [0, 40], [0, 1000], [250, 262], [0, 0.5]]) {
  const t = M.dayTicks(d0, d1);
  assert(t.length >= 2 && t.length <= 12, `${d0}-${d1}: ${t.length}`);
  assert(t.every(x => x >= d0 - 1e-6 && x <= d1 + 1e-6));
  const step = t[1] - t[0]; assert([1, 2, 5].includes(+(step / Math.pow(10, Math.floor(Math.log10(step)))).toFixed(6)), `step ${step}`);
}
assert.deepStrictEqual(Array.from(M.dayTicks(0, 40)), [0, 5, 10, 15, 20, 25, 30, 35, 40]);
assert.strictEqual(M.niceStep(60), 10); assert.strictEqual(M.niceStep(12), 2); ok('tick choice suits the span (steps 1/2/5 x 10^k)');

// Envelope against a brute-force reference, on exactly representable steps.
{
  const N = 24000, a = new Uint32Array(N);
  let s = 12345; for (let i = 0; i < N; i++) { s = (s * 1103515245 + 12345) >>> 0; a[i] = s % 5000; }
  for (const [h0, h1, W] of [[0, N - 1, 400], [1000, 9000, 400], [500.5, 700.5, 100], [0, 100, 400], [23000, 23999, 250]]) {
    const e = M.envelope(a, N, h0, h1, W), step = (h1 - h0) / W;
    const mn = new Array(W).fill(Infinity), mx = new Array(W).fill(-Infinity);
    for (let i = 0; i < N; i++) { const c = Math.floor((i - h0) / step); if (c >= 0 && c < W) { mn[c] = Math.min(mn[c], a[i]); mx[c] = Math.max(mx[c], a[i]); } }
    let bad = 0; for (let c = 0; c < W; c++) if (e.min[c] !== mn[c] || e.max[c] !== mx[c]) bad++;
    assert(bad <= W * 0.01, `${h0}-${h1}: ${bad} columns differ`); // float edge samples may land one column over
  }
  ok('envelope matches brute force');
  const t0 = process.hrtime.bigint(); for (let k = 0; k < 20; k++) M.envelope(a, N, 0, N - 1, 400);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 20; assert(ms < 20, ms + ' ms'); ok(`envelope of 24,000 samples takes ${ms.toFixed(2)} ms`);
}

// View logic.
{
  let v = M.fitView(2401); near(v.h1, 2400); assert(v.fit && v.follow);
  v = M.advance(v, 2500); near(v.h1, 2499); near(v.h0, 0); ok('fit view grows with the run');
  v = M.zoomAt(v, 2500, 2499, 0.1); // zoom in at the live edge
  assert(v.follow && !v.fit); near(v.h1, 2499); near(v.h0, 2499 - 249.9, 1e-6); ok('zoom at live edge stays following');
  v = M.advance(v, 2600); near(v.h1, 2599); near(v.h1 - v.h0, 249.9, 1e-6); ok('follow-live pins to the end as the run grows');
  v = M.panBy(v, 2600, -500); assert(!v.follow); const h1 = v.h1; v = M.advance(v, 2700); near(v.h1, h1); ok('panned away: stops following');
  v = M.panBy(v, 2700, -1e9); near(v.h0, 0); near(v.h1, 249.9, 1e-6); ok('pan clamps at the start');
  v = M.panBy(v, 2700, 1e9); near(v.h1, 2699); assert(v.follow); ok('pan clamps at the live end and resumes following');
  v = M.zoomAt(v, 2700, 1000, 1e-9); near(v.h1 - v.h0, M.MIN_SPAN_H); ok('zoom in clamps at the minimum span');
  v = M.zoomAt(v, 2700, 1000, 1e9); near(v.h0, 0); near(v.h1, 2699); assert(v.fit); ok('zoom out clamps to the whole run');
  const z = M.zoomAt({ h0: 100, h1: 300, fit: false, follow: false }, 3000, 200, 0.5);
  near(z.h0, 150); near(z.h1, 250); ok('zoom keeps the point under the pointer fixed');
  const tiny = M.fitView(0); assert(tiny.h1 > tiny.h0); const t5 = M.zoomAt(M.fitView(5), 5, 2, 0.01); assert(t5.h0 >= 0 && t5.h1 <= 4); ok('tiny runs stay inside the data');
}
console.log('all passed');
