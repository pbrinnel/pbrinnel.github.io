// Splits grassTick's cost into the growth pass and the hourly slice, on a mixed-age world.
const h = require('./harness.js');
const { AS, texts } = h.load();
const { T } = AS.parseTables(texts);
for (const N of [24000, 96000, 384000]) {
  const area = N / T.world.StartGrass, w = Math.round(Math.sqrt(area * 1.5)), hh = Math.round(area / w);
  const T2 = Object.freeze({ ...T, world: Object.freeze({ ...T.world, WorldWidth: w, WorldHeight: hh }) });
  const sim = AS.Sim(T2, 1, { grassAges: 'mixed' });
  for (let i = 0; i < 300; i++) sim.tick();           // warm the JIT
  const n = 300;
  let t = process.hrtime.bigint();
  for (let i = 0; i < n; i++) sim.tick();
  const tick = Number(process.hrtime.bigint() - t) / 1e6 / n;
  // growth only: same loop as grass.js's first pass
  const W = sim.W; t = process.hrtime.bigint();
  for (let k = 0; k < n; k++) for (let i = 0, c = W.gCount; i < c; i++) { const tt = W.gList[i]; if (W.gSize[tt] >= 1) continue; }
  const scan = Number(process.hrtime.bigint() - t) / 1e6 / n;
  let growing = 0; for (let i = 0; i < W.gCount; i++) if (W.gSize[W.gList[i]] < 1) growing++;
  console.log(`${String(W.gCount).padStart(7)} blades ${w}x${hh}: tick ${tick.toFixed(3)} ms, bare list scan ${scan.toFixed(3)} ms, growing ${(100 * growing / W.gCount).toFixed(0)}%`);
}

console.log('--- sequential tile scan instead of the dense list');
for (const N of [24000, 96000, 384000]) {
  const area = N / T.world.StartGrass, w = Math.round(Math.sqrt(area * 1.5)), hh = Math.round(area / w);
  const T2 = Object.freeze({ ...T, world: Object.freeze({ ...T.world, WorldWidth: w, WorldHeight: hh }) });
  const sim = AS.Sim(T2, 1, { grassAges: 'mixed' });
  const W = sim.W, n = 300, kind = W.kind, gSize = W.gSize;
  let sink = 0;
  for (let k = 0; k < 50; k++) for (let tt = 0; tt < W.n; tt++) if (kind[tt] === 1 && gSize[tt] < 1) sink++;
  const t = process.hrtime.bigint();
  for (let k = 0; k < n; k++) for (let tt = 0; tt < W.n; tt++) if (kind[tt] === 1 && gSize[tt] < 1) sink++;
  console.log(`${String(W.gCount).padStart(7)} blades: sequential scan ${(Number(process.hrtime.bigint() - t) / 1e6 / n).toFixed(3)} ms (${sink > 0})`);
}
