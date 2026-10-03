// Runs the tuning lab's Search headless, in a real windowed Chrome (so nothing throttles
// it), from a JSON config, then re-runs the best candidates on fresh seeds. Nothing is
// saved to the tables: the output lists candidates for Paul to try and save in the lab.
//
//   node Life/_lab/serve.js                      (in another terminal; or the life-lab preview)
//   node Life/_tools/lab-search.js config.json out.json
//
// config: {
//   params:   [{ row, col, lo, hi }],            cells to vary (col = Bunny/Wolf/Grass, or Value
//                                                for settings) and their allowed bounds
//   base:     [{ row, col, value }]          optional: cells fixed for this search only (the
//                                                tables on disk are untouched), e.g. StartWolves
//   seeds:    [1, 2, 3, 4],  days: 100,  bunnyCap: 20000,  budget: 120,  rngSeed: 1,
//   verify:   { top: 3, seeds: [101, …], days: 150 }   optional
// }
'use strict';
const { spawn } = require('child_process');
const os = require('os'), path = require('path'), fs = require('fs');

const [cfgFile, outFile] = process.argv.slice(2);
if (!cfgFile || !outFile) { console.error('usage: node Life/_tools/lab-search.js config.json out.json'); process.exit(2); }
const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
const LAB_URL = process.env.LAB_URL || 'http://localhost:8920/Life/_lab/';
const PORT = 9340, CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const POLL_MS = Number(process.env.POLL_MS || 30000);

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'life-lab-search-'));
const chrome = spawn(CHROME, [`--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--window-size=900,700', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Runs inside the lab page. Keeps progress in window.__search for polling.
const PAGE = cfg => `(async () => {
  const cfg = ${JSON.stringify(cfg)};
  const S = window.__search = { phase: 'loading', tried: 0, budget: cfg.budget, best: [], verify: [] };
  const texts = {};
  for (const f of ['species', 'variables', 'states', 'settings']) texts[f] = await (await fetch('/Life/tables/' + f + '.csv', { cache: 'no-store' })).text();
  let tun = LAB.tunables(texts);
  for (const b of cfg.base || []) {
    const t = tun.find(x => x.row === b.row && x.col === b.col);
    if (!t) throw new Error('no tunable ' + b.row + ' / ' + b.col);
    texts[t.file] = LAB.setCell(texts[t.file], b.row, b.col, String(b.value));
  }
  tun = LAB.tunables(texts);
  const params = cfg.params.map(p => {
    const t = tun.find(x => x.row === p.row && x.col === p.col);
    if (!t) throw new Error('no tunable ' + p.row + ' / ' + p.col);
    return { file: t.file, row: p.row, col: p.col, parsed: t.parsed, lo: p.lo, hi: p.hi };
  });
  const pool = LAB.Pool({ v: Date.now() });
  const brief = c => ({ edits: c.edits, summary: c.summary, seeds: (c.results || []).map(r => ({ seed: r.seed, end: r.endReason, days: r.daysRun, final: r.final, peak: r.peak })) });
  S.phase = 'search';
  const search = LAB.Search({ pool, texts, params, seeds: cfg.seeds, days: cfg.days, bunnyCap: cfg.bunnyCap, budget: cfg.budget, rngSeed: cfg.rngSeed || 1 });
  const best = await search.start(u => { S.tried = u.tried; S.best = u.best.map(brief); });
  S.best = best.map(brief);
  if (cfg.verify) {
    S.phase = 'verify';
    for (const c of best.slice(0, cfg.verify.top)) {
      const vt = LAB.applyEdits(texts, c.edits);
      const rs = await Promise.all(cfg.verify.seeds.map(seed => pool.run({ texts: vt, seed, days: cfg.verify.days, bunnyCap: cfg.bunnyCap })));
      S.verify.push({ edits: c.edits, searchScore: c.summary.score, summary: LAB.summarize(rs), seeds: rs.map(r => ({ seed: r.seed, end: r.endReason, days: r.daysRun, final: r.final, peak: r.peak })) });
    }
    // The base too, on the same fresh seeds, as the yardstick.
    const rs = await Promise.all(cfg.verify.seeds.map(seed => pool.run({ texts, seed, days: cfg.verify.days, bunnyCap: cfg.bunnyCap })));
    S.verifyBase = { summary: LAB.summarize(rs), seeds: rs.map(r => ({ seed: r.seed, end: r.endReason, days: r.daysRun })) };
  }
  S.phase = 'done';
  return true;
})()`;

(async () => {
  let ws;
  for (let i = 0; i < 50 && !ws; i++) {
    try { const u = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(t => t.type === 'page'); if (u) ws = new WebSocket(u.webSocketDebuggerUrl); } catch (e) { /* not up */ }
    if (!ws) await sleep(200);
  }
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map();
  ws.onmessage = m => { const x = JSON.parse(m.data); if (pend.has(x.id)) { pend.get(x.id)(x); pend.delete(x.id); } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e, wait = true) => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: wait });
    if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 600));
    return r.result.result.value;
  };
  await send('Page.navigate', { url: LAB_URL });
  for (let i = 0; i < 100 && !(await ev('!!(window.LAB && LAB.Search && LAB.Pool)').catch(() => false)); i++) await sleep(100);
  // Start without awaiting (a long promise would outlive the protocol call); poll instead.
  await ev(`window.__run = ${PAGE(cfg)}; window.__run.catch(e => { window.__search.phase = 'error'; window.__search.error = String(e); }); true`, false);
  const t0 = Date.now();
  let s;
  for (;;) {
    await sleep(POLL_MS);
    s = await ev('window.__search');
    const top = s.best[0];
    console.log(`[${Math.round((Date.now() - t0) / 60000)} min] ${s.phase} ${s.tried}/${s.budget}` +
      (top ? `  best score ${top.summary.score.toFixed(2)} (${top.summary.survived}/${top.summary.seeds} survived): ` +
        (top.edits.map(e => `${e.col} ${e.row}=${e.value}`).join(', ') || 'base') : ''));
    if (s.phase === 'done' || s.phase === 'error') break;
    fs.writeFileSync(outFile, JSON.stringify(s, null, 1));   // partial results survive a crash
  }
  fs.writeFileSync(outFile, JSON.stringify(s, null, 1));
  if (s.phase === 'error') { console.error('search failed: ' + s.error); process.exitCode = 1; }
  console.log(`saved ${outFile} after ${Math.round((Date.now() - t0) / 60000)} min`);
  ws.close();
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => {
  chrome.kill();
  setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 500);
});
