// Runs a few named sets of changes side by side on the same seeds and prints how each
// went: the quick way to check a combination before saving it to the tables.
//
//   node Life/_lab/serve.js                       (in another terminal; or the life-lab preview)
//   node Life/_tools/lab-compare.js config.json [out.json]
//
// config: {
//   variants: { "name": [{ row, col, value, file? }], … }   "base" is added automatically (no changes);
//             file (species/settings/…) is needed only for a cell that isn't a numeric tunable, e.g. StartLayout
//   seeds: [1, 2, 3],  days: 60,  bunnyCap: 12000 (default),  trendStops: true (default)
// }
'use strict';
const fs = require('fs');
const chrome = require('./chrome.js');

const [cfgFile, outFile] = process.argv.slice(2);
if (!cfgFile) { console.error('usage: node Life/_tools/lab-compare.js config.json [out.json]'); process.exit(2); }
const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
const LAB_URL = process.env.LAB_URL || 'http://localhost:8920/Life/_lab/';

const PAGE = cfg => `(async () => {
  const cfg = ${JSON.stringify(cfg)};
  const S = window.__cmp = { phase: 'running', done: 0, total: 0, rows: [] };
  const texts = {};
  for (const f of ['species', 'variables', 'states', 'settings']) texts[f] = await (await fetch('/Life/tables/' + f + '.csv', { cache: 'no-store' })).text();
  const tun = LAB.tunables(texts);
  const fileOf = (row, col) => { const t = tun.find(x => x.row === row && x.col === col); if (!t) throw new Error('no tunable ' + row + ' / ' + col); return t.file; };
  const variants = Object.assign({ base: [] }, cfg.variants);
  const pool = LAB.Pool({ v: Date.now() });
  S.total = Object.keys(variants).length * cfg.seeds.length;
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  // Wolf growth, from the hourly history: wolves at the end ÷ at the start (0 if they died
  // out), and the change over the last TREND_DAYS days (still rising = positive).
  const TREND_DAYS = 5;
  const growthOf = r => {
    const w = r.history ? r.history.wolves : null;
    if (!w || !w.length) return { growth: 0, trend: 0 };
    const end = w[w.length - 1], back = w[Math.max(0, w.length - 1 - TREND_DAYS * 24)];
    return { growth: w[0] ? end / w[0] : 0, trend: end - back };
  };
  await Promise.all(Object.entries(variants).map(async ([name, edits]) => {
    const vt = LAB.applyEdits(texts, edits.map(e => ({ file: e.file || fileOf(e.row, e.col), row: e.row, col: e.col, value: String(e.value) })));
    const rs = await Promise.all(cfg.seeds.map(seed => pool.run({ texts: vt, seed, days: cfg.days, bunnyCap: cfg.bunnyCap || 12000, trendStops: cfg.trendStops !== false }).then(r => { S.done++; return r; })));
    S.rows.push({ name, edits, summary: LAB.summarize(rs),
      wolfGrowth: mean(rs.map(r => growthOf(r).growth)), wolfTrend: mean(rs.map(r => growthOf(r).trend)),
      wolfDays: mean(rs.map(r => r.firstExtinct && r.firstExtinct.wolves != null ? r.firstExtinct.wolves : r.daysRun)),
      wolfPeak: mean(rs.map(r => r.peak ? r.peak.wolves : 0)), bunnyPeak: mean(rs.map(r => r.peak ? r.peak.bunnies : 0)),
      seeds: rs.map(r => ({ seed: r.seed, end: r.endReason, days: r.daysRun, final: r.final, peak: r.peak, error: r.error })) });
  }));
  S.phase = 'done';
})()`;

(async () => {
  const page = await chrome.open(LAB_URL, { port: 9343 });
  try {
    for (let i = 0; i < 100 && !(await page.ev('!!(window.LAB && LAB.Pool && LAB.tunables)').catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
    await page.ev(`window.__run = ${PAGE(cfg)}; window.__run.catch(e => { window.__cmp.phase = 'error'; window.__cmp.error = String(e); }); true`, false);
    let s;
    for (;;) {
      await new Promise(r => setTimeout(r, 10000));
      s = await page.ev('window.__cmp');
      if (s.phase !== 'running') break;
    }
    if (s.phase === 'error') throw new Error(s.error);
    if (outFile) fs.writeFileSync(outFile, JSON.stringify(s, null, 1));
    const order = ['base', ...Object.keys(cfg.variants)];
    s.rows.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
    console.log(`${cfg.seeds.length} seeds × ${cfg.days} days`);
    for (const r of s.rows) {
      const m = r.summary;
      const ends = r.seeds.map(x => x.end === 'survived' ? `ok(B${x.final.bunnies} W${x.final.wolves})` : `${x.end.replace(' extinct', '†').replace(' declining', '↓').replace(' collapsing', '↓').replace('bunny boom', 'boom')} d${x.days}`).join(', ');
      console.log(`${r.name.padEnd(28)} wolves ×${r.wolfGrowth.toFixed(2)} ${r.wolfTrend >= 0 ? '+' : ''}${r.wolfTrend.toFixed(0)}  score ${m.score.toFixed(2)}  survived ${m.survived}/${m.seeds}  all-alive ${m.meanAllAliveDays.toFixed(0)}d  wolves last ${r.wolfDays.toFixed(0)}d, peak ${r.wolfPeak.toFixed(0)}  bunny peak ${r.bunnyPeak.toFixed(0)}   [${ends}]`);
    }
  } finally {
    page.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
