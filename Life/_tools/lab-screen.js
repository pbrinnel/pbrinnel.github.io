// A coarse screen: which numbers matter at all? Moves each number on its own to a few
// extreme multiples of its current value (everything else unchanged), runs a few short
// seeds of each, and ranks the numbers by how much they change the outcome. Fast and
// gross on purpose; fine-tune the few that matter afterwards (lab-search.js or the lab).
//
//   node Life/_lab/serve.js                       (in another terminal; or the life-lab preview)
//   node Life/_tools/lab-screen.js config.json out.json
//
// config: {
//   params:  [{ row, col }] or "all"   cells to move (col = Bunny/Wolf/Grass, or Value for settings)
//   factors: [0.25, 4]                 multiples of the current value to try
//   base:    [{ row, col, value }]     optional, fixed for the whole screen (tables untouched)
//   seeds:   [1, 2, 3],  days: 60,  bunnyCap: 20000
//   rank:    "wolfGrowth"              optional: rank by wolf growth instead of all-alive days
//   trendStops: true (default)        end a run once its direction is clear (worker.js TREND_*);
//                                      bunnyCap defaults to 12,000
// }
// Clamps: a percent stays ≤ 100%; a count or range that was ≥ 1 stays ≥ 1.
'use strict';
const fs = require('fs');
const chrome = require('./chrome.js');

const [cfgFile, outFile] = process.argv.slice(2);
if (!cfgFile || !outFile) { console.error('usage: node Life/_tools/lab-screen.js config.json out.json'); process.exit(2); }
const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
const LAB_URL = process.env.LAB_URL || 'http://localhost:8920/Life/_lab/';
const POLL_MS = Number(process.env.POLL_MS || 15000);

const PAGE = cfg => `(async () => {
  const cfg = ${JSON.stringify(cfg)};
  const S = window.__screen = { phase: 'loading', done: 0, total: 0, rows: [] };
  const texts = {};
  for (const f of ['species', 'variables', 'states', 'settings']) texts[f] = await (await fetch('/Life/tables/' + f + '.csv', { cache: 'no-store' })).text();
  let tun = LAB.tunables(texts);
  for (const b of cfg.base || []) {
    const t = tun.find(x => x.row === b.row && x.col === b.col);
    if (!t) throw new Error('no tunable ' + b.row + ' / ' + b.col);
    texts[t.file] = LAB.setCell(texts[t.file], b.row, b.col, String(b.value));
  }
  tun = LAB.tunables(texts);
  const chosen = cfg.params === 'all' ? tun : cfg.params.map(p => {
    const t = tun.find(x => x.row === p.row && x.col === p.col);
    if (!t) throw new Error('no tunable ' + p.row + ' / ' + p.col);
    return t;
  });
  const isPct = t => t.parsed.kind === 'pct' || /^%/.test(t.unit);
  const scaled = (t, f) => {
    const p = t.parsed;
    if (p.kind === 'range') {
      const floor = p.lo >= 1 ? 1 : 0;
      return LAB.formatValue(p, [Math.max(floor, p.lo * f), Math.max(floor, p.hi * f)]);
    }
    let v = p.v * f;
    if (isPct(t)) v = Math.min(100, v);
    if (p.decimals === 0 && p.v >= 1) v = Math.max(1, Math.round(v));
    return LAB.formatValue(p, v);
  };
  const variants = [{ label: 'base', row: '', col: '', from: '', to: '', texts }];
  for (const t of chosen) {
    for (const f of cfg.factors) {
      const to = scaled(t, f);
      if (to === t.text) continue;
      variants.push({ label: (t.group === 'World' ? '' : t.group + ' ') + t.row, row: t.row, col: t.col, factor: f, from: t.text, to,
        texts: LAB.applyEdits(texts, [{ file: t.file, row: t.row, col: t.col, value: to }]) });
    }
  }
  const pool = LAB.Pool({ v: Date.now() });
  S.total = variants.length * cfg.seeds.length;
  S.phase = 'running';
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
  await Promise.all(variants.map(async v => {
    const rs = await Promise.all(cfg.seeds.map(seed => pool.run({ texts: v.texts, seed, days: cfg.days, bunnyCap: cfg.bunnyCap || 12000, trendStops: cfg.trendStops !== false }).then(r => { S.done++; return r; })));
    const sum = LAB.summarize(rs);
    const wolfDays = rs.map(r => r.firstExtinct && r.firstExtinct.wolves != null ? r.firstExtinct.wolves : r.daysRun);
    S.rows.push({ label: v.label, row: v.row, col: v.col, factor: v.factor, from: v.from, to: v.to,
      score: sum.score, survived: sum.survived, seeds: sum.seeds, allAliveDays: sum.meanAllAliveDays,
      wolvesExtinct: sum.wolvesExtinct, bunniesExtinct: sum.bunniesExtinct, grassExtinct: sum.grassExtinct, booms: sum.booms,
      wolfGrowth: mean(rs.map(r => growthOf(r).growth)), wolfTrend: mean(rs.map(r => growthOf(r).trend)),
      wolfDays: mean(wolfDays), bunnyPeak: mean(rs.map(r => r.peak ? r.peak.bunnies : 0)), wolfPeak: mean(rs.map(r => r.peak ? r.peak.wolves : 0)),
      wolvesDeclining: sum.wolvesDeclining, grassCollapsing: sum.grassCollapsing,
      errors: rs.filter(r => r.endReason === 'error').map(r => r.error) });
  }));
  S.phase = 'done';
})()`;

(async () => {
  const page = await chrome.open(LAB_URL, { port: 9341 });
  try {
    for (let i = 0; i < 100 && !(await page.ev('!!(window.LAB && LAB.Pool && LAB.tunables)').catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
    await page.ev(`window.__run = ${PAGE(cfg)}; window.__run.catch(e => { window.__screen.phase = 'error'; window.__screen.error = String(e); }); true`, false);
    const t0 = Date.now();
    let s;
    for (;;) {
      await new Promise(r => setTimeout(r, POLL_MS));
      s = await page.ev('window.__screen');
      console.log(`[${((Date.now() - t0) / 60000).toFixed(1)} min] ${s.phase} ${s.done}/${s.total} runs`);
      if (s.phase === 'done' || s.phase === 'error') break;
    }
    if (s.phase === 'error') throw new Error(s.error);
    const base = s.rows.find(r => r.label === 'base');
    // Effect: with rank "wolfGrowth", how far wolf growth moved from the base's (Paul: if
    // wolves aren't increasing it's a bad run); otherwise how far all-alive days moved.
    const byGrowth = cfg.rank === 'wolfGrowth';
    for (const r of s.rows) r.effect = byGrowth ? r.wolfGrowth - base.wolfGrowth : r.allAliveDays - base.allAliveDays;
    s.base = base;
    fs.writeFileSync(outFile, JSON.stringify(s, null, 1));
    // One line per number: its best and worst variant, ranked by the bigger swing.
    const byNum = new Map();
    for (const r of s.rows) if (r.label !== 'base') (byNum.get(r.label) || byNum.set(r.label, []).get(r.label)).push(r);
    const ranked = [...byNum].map(([label, rs]) => ({ label, rs, swing: Math.max(...rs.map(r => Math.abs(r.effect))) })).sort((a, b) => b.swing - a.swing);
    const cause = r => [r.wolvesExtinct && `W†${r.wolvesExtinct}`, r.wolvesDeclining && `W↓${r.wolvesDeclining}`, r.grassCollapsing && `G↓${r.grassCollapsing}`, r.bunniesExtinct && `B†${r.bunniesExtinct}`, r.grassExtinct && `G†${r.grassExtinct}`, r.booms && `boom${r.booms}`].filter(Boolean).join(' ') || '';
    const g = r => `×${r.wolfGrowth.toFixed(2)} ${r.wolfTrend >= 0 ? '+' : ''}${r.wolfTrend.toFixed(0)}`;
    console.log(`\nBase: wolves ${g(base)} (growth × start, change over the last days); all three alive ${base.allAliveDays.toFixed(0)} of ${cfg.days} days; ${cause(base)}`);
    if (byGrowth) {
      console.log('number'.padEnd(26) + 'value → wolf growth ×(end/start) and last-days change, how runs ended');
      for (const n of ranked) {
        console.log(n.label.padEnd(26) + n.rs.sort((a, b) => a.factor - b.factor).map(r =>
          `${r.to.padStart(6)} → ${g(r).padEnd(10)} ${cause(r)}`).join('   '));
      }
    } else {
      console.log('number'.padEnd(26) + 'value → all-alive days (Δ vs base), survived, how runs ended');
      for (const n of ranked) {
        console.log(n.label.padEnd(26) + n.rs.sort((a, b) => a.factor - b.factor).map(r =>
          `${r.to.padStart(6)} → ${r.allAliveDays.toFixed(0).padStart(2)}d (${(r.effect >= 0 ? '+' : '') + r.effect.toFixed(0)}) ${r.survived}/${r.seeds} ${cause(r)}`).join('   '));
      }
    }
    console.log(`\nsaved ${outFile} after ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  } finally {
    page.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
