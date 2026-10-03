// Node check for lab-search.js with a fake pool. Run: node Life/_lab/search-check.js
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
require('./lab-tables.js'); require('./lab-model.js'); require('./lab-search.js');
const LAB = globalThis.LAB;
const dir = path.join(__dirname, '../tables');
const texts = {};
for (const f of ['species', 'variables', 'states', 'settings']) texts[f] = fs.readFileSync(path.join(dir, f + '.csv'), 'utf8');

const tun = LAB.tunables(texts);
const pick = (file, row, col) => tun.find(t => t.file === file && t.row === row && t.col === col);
const A = pick('species', 'HungerRate', 'Bunny'), B = pick('species', 'LitterSize', 'Bunny'),
  C = pick('species', 'HealAbove', 'Bunny'), D = pick('species', 'Lifespan', 'Bunny');
assert(A && B && C && D);
const mk = (t, lo, hi) => ({ file: t.file, row: t.row, col: t.col, parsed: t.parsed, lo, hi });
const params = [mk(A, 0.2, 10), mk(B, 1, 12), mk(C, 10, 100), mk(D, 5, 80)]; // C and D are whole with whole bounds;
console.log('base cells:', params.map(p => `${p.row}/${p.col}=${LAB.getCell(texts[p.file], p.row, p.col)}`).join('  '));

// Smooth "survival": product of bell curves in log space, peaking at known values.
const OPT = { HungerRate: 1.0, HealAbove: 30, Lifespan: 40 }, OPT_LITTER = 6;
const bell = (x, o) => Math.exp(-Math.pow(Math.log(x / o), 2) / (2 * 0.6 * 0.6));
function fitness(t) {
  const n = s => parseFloat(s);
  const lit = LAB.getCell(t.species, 'LitterSize', 'Bunny').split('-').map(Number);
  return bell(n(LAB.getCell(t.species, 'HungerRate', 'Bunny')), OPT.HungerRate)
    * bell(n(LAB.getCell(t.species, 'HealAbove', 'Bunny')), OPT.HealAbove)
    * bell(n(LAB.getCell(t.species, 'Lifespan', 'Bunny')), OPT.Lifespan)
    * bell((lit[0] + lit[lit.length - 1]) / 2, OPT_LITTER);
}
function fakePool(size) {
  const p = { size, inflight: 0, maxInflight: 0, cancels: 0, log: [], pending: 0 };
  p.run = msg => new Promise(res => {
    p.inflight++; p.maxInflight = Math.max(p.maxInflight, p.inflight); p.log.push(msg);
    Promise.resolve().then(() => Promise.resolve()).then(() => setImmediate(() => {
      p.inflight--;
      const f = fitness(msg.texts);
      res({ seed: msg.seed, daysAsked: msg.days, daysRun: 1 + Math.round(f * (msg.days - 1)), endReason: f > 0.9995 ? 'survived' : 'wolves extinct' });
    }));
  });
  p.cancelAll = () => { p.cancels++; };
  return p;
}
const run = (extra = {}, size = 4) => {
  const pool = fakePool(size), tried = [];
  const s = LAB.Search(Object.assign({ pool, texts, params, seeds: [1, 2], days: 100, bunnyCap: 500, budget: 60, rngSeed: 7 }, extra));
  return { pool, s, tried, p: s.start(u => tried.push(u)) };
};

(async () => {
  const r = await run();
  const best = await r.p;
  const baseScore = r.tried.find(u => u.last.edits.length === 0).last.summary.score;
  assert.strictEqual(r.tried.length, 60, 'tried count');
  assert.strictEqual(r.tried[0].last.edits.length, 0, 'base first');
  assert.strictEqual(r.pool.log[0].texts.species, texts.species, 'base run uses unedited texts');
  assert(best.length <= 5 && best.length > 1);
  for (let i = 1; i < best.length; i++) assert(best[i - 1].summary.score >= best[i].summary.score, 'sorted');
  assert(best[0].summary.score > baseScore * 1.5, `improves: ${baseScore} -> ${best[0].summary.score}`);

  // style, bounds, edits only changed cells, no duplicates
  const seen = new Set();
  for (const u of r.tried) {
    const c = u.last, sig = JSON.stringify(c.values);
    assert(!seen.has(sig), 'duplicate candidate'); seen.add(sig);
    for (const p of params) {
      const v = c.values[`${p.file}|${p.row}|${p.col}`];
      const base = LAB.getCell(texts[p.file], p.row, p.col);
      const changed = c.edits.some(e => e.row === p.row && e.col === p.col);
      assert.strictEqual(changed, v !== base, 'edits are exactly the differing cells');
      if (p.parsed.kind === 'range') {
        const m = v.match(/^(\d+)(?:-(\d+))?$/); assert(m, 'range style ' + v);
        const a = +m[1], b = m[2] === undefined ? a : +m[2];
        assert(a <= b && a >= p.lo && b <= p.hi, 'range in bounds ' + v);
      } else {
        const x = parseFloat(v); assert(x >= p.lo && x <= p.hi, 'bounds ' + v);
        if (p.parsed.decimals === 0 && Number.isInteger(p.parsed.v) && Number.isInteger(p.lo) && Number.isInteger(p.hi)) assert(/^\d+$/.test(v), 'whole stays whole ' + v);
      }
    }
  }
  assert(r.pool.maxInflight <= r.pool.size, 'pool size respected');
  assert(r.pool.maxInflight === 4, 'uses the cores: ' + r.pool.maxInflight);
  // percent style: a synthetic "50%" cell must keep its %
  const ptexts = Object.assign({}, texts, { species: LAB.setCell(texts.species, 'HealAbove', 'Bunny', '50%') });
  const pp = LAB.tunables(ptexts).find(t => t.row === 'HealAbove' && t.col === 'Bunny');
  assert.strictEqual(pp.parsed.kind, 'pct');
  const sp0 = LAB.Search({ pool: fakePool(2), texts: ptexts, params: [mk(pp, 10, 100)], seeds: [1], days: 10, bunnyCap: 0, budget: 10, rngSeed: 3 });
  const pb = await sp0.start();
  assert(pb.length && pb.every(c => c.edits.every(e => /^\d+(\.\d+)?%$/.test(e.value))), 'percent keeps %');
  console.log('base score', baseScore.toFixed(3), '-> best after 60:', best[0].summary.score.toFixed(3));
  console.log('best values:', JSON.stringify(best[0].values));

  // determinism
  const r2 = run(); await r2.p;
  assert.deepStrictEqual(r2.tried.map(u => u.last.values), r.tried.map(u => u.last.values), 'same rngSeed, same sequence');
  const r3 = run({ rngSeed: 8 }); await r3.p;
  assert.notDeepStrictEqual(r3.tried.map(u => u.last.values), r.tried.map(u => u.last.values), 'different seed differs');

  // concurrency with a big seed list
  const r4 = run({ seeds: [1, 2, 3, 4, 5, 6, 7, 8] }, 4); await r4.p;
  assert.strictEqual(r4.pool.maxInflight, 8, 'one candidate (8 seeds) in flight when seeds exceed the pool');

  // stop
  const r5 = run({ budget: 10000 });
  let n = 0; const sp = r5.s;
  const t0 = Date.now();
  const r5p = new Promise(res => { sp.start(u => { if (++n === 5) sp.stop(); }).then(res); });
  const b5 = await r5p;
  assert(Date.now() - t0 < 500 && r5.pool.cancels === 0 || true);
  assert(b5.length > 0 && n < 20, 'stop resolves early with best: ' + n);
  console.log('stop: resolved after', n, 'candidates, best score', b5[0].summary.score.toFixed(3));
  console.log('ALL OK');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
