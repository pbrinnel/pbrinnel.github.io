// Runs every headless check for Life and the tuning lab, several at once, and prints one line
// each (in list order) plus a verdict.
//
//   node Life/_tools/check-all.js           every check (a few minutes; before a commit)
//   node Life/_tools/check-all.js --quick   skips the long real-world runs (about a minute; while working)
//
// A check fails if it exits non-zero or prints a FAIL line. The browser checks
// (browser-*.js, run-bench.js, shoot.js) need the page served and Chrome; they aren't run
// here — see Life/MAP.md.
'use strict';
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const TOOLS = __dirname, LAB = path.join(__dirname, '../_lab'), REPO = path.join(__dirname, '../..');
const QUICK = process.argv.includes('--quick');
// slow: long seeded runs of the whole world (tens of days, some twice), left out of --quick.
// quickArgs: what a check runs with under --quick instead of args.
const CHECKS = [
  { file: path.join(TOOLS, 'harness.js'), args: ['12'], quickArgs: ['3'] },   // grid/store audits + same seed → same world
  { file: path.join(TOOLS, 'tables-check.js') },       // CSV loading, units, error messages
  { file: path.join(TOOLS, 'files-check.js') },        // page, harness and lab load the same files
  { file: path.join(TOOLS, 'grass-check.js') },
  { file: path.join(TOOLS, 'sight-check.js'), flags: ['--expose-gc'] },
  { file: path.join(TOOLS, 'bunny-check.js') },
  { file: path.join(TOOLS, 'play-check.js') },
  { file: path.join(TOOLS, 'breed-check.js'), slow: true },
  { file: path.join(TOOLS, 'wolf-check.js'), slow: true },
  { file: path.join(TOOLS, 'human-check.js') },
  { file: path.join(TOOLS, 'warren-check.js') },
  { file: path.join(TOOLS, 'weather-check.js') },
  { file: path.join(TOOLS, 'rain-check.js') },
  { file: path.join(TOOLS, 'lightning-check.js') },
  { file: path.join(TOOLS, 'paint-check.js') },
  { file: path.join(TOOLS, 'fire-check.js') },
  { file: path.join(TOOLS, 'escape-check.js') },
  { file: path.join(TOOLS, 'ash-check.js') },
  { file: path.join(TOOLS, 'roots-check.js') },
  { file: path.join(TOOLS, 'water-check.js'), slow: true },
  { file: path.join(TOOLS, 'thirst-check.js') },
  { file: path.join(TOOLS, 'inspect-check.js') },
  { file: path.join(TOOLS, 'camera-check.js') },
  { file: path.join(TOOLS, 'render-check.js') },
  { file: path.join(TOOLS, 'sprites-check.js') },
  { file: path.join(TOOLS, 'ui-check.js') },
  { file: path.join(TOOLS, 'graph-check.js') },
  { file: path.join(TOOLS, 'graph-smoke.js') },
  { file: path.join(TOOLS, 'bench-check.js') },
  { file: path.join(LAB, 'search-check.js') },
  { file: path.join(LAB, 'ui-lab-check.js') },
].filter(c => !(QUICK && c.slow));
const TIMEOUT_MS = 10 * 60 * 1000;
// Leave a core for the machine; the checks are single-threaded and independent.
const PARALLEL = Math.max(1, Math.min(CHECKS.length, (os.availableParallelism ? os.availableParallelism() : os.cpus().length) - 1));

function run(c) {
  return new Promise(resolve => {
    const t = Date.now();
    const args = (QUICK && c.quickArgs) || c.args || [];
    const p = spawn(process.execPath, [...(c.flags || []), c.file, ...args], { cwd: REPO });
    let out = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { out += d; });
    const timer = setTimeout(() => { out += '\nFAIL timed out'; p.kill(); }, TIMEOUT_MS);
    p.on('close', code => { clearTimeout(timer); resolve({ code, out, secs: (Date.now() - t) / 1000 }); });
  });
}

function report(c, r) {
  const failLines = r.out.split('\n').filter(l => /^\s*FAIL\b/.test(l));
  const ok = r.code === 0 && !failLines.length;
  const last = r.out.trim().split('\n').pop() || '';
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${path.relative(REPO, c.file).padEnd(34)} ${r.secs.toFixed(0).padStart(4)} s  ${ok ? last.slice(0, 60) : ''}`);
  if (!ok) for (const l of (failLines.length ? failLines : r.out.trim().split('\n').slice(-12))) console.log('       ' + l);
  return ok;
}

(async () => {
  const t0 = Date.now();
  const results = new Array(CHECKS.length);
  let next = 0, printed = 0, failed = 0;
  // Lines print in list order: each waits for the checks above it.
  const flush = () => { while (printed < CHECKS.length && results[printed]) { if (!report(CHECKS[printed], results[printed])) failed++; printed++; } };
  const worker = async () => { while (next < CHECKS.length) { const i = next++; results[i] = await run(CHECKS[i]); flush(); } };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  const skipped = QUICK ? ' (quick: the long world runs were skipped)' : '';
  console.log(`\n${failed ? `${failed} check(s) FAILED` : 'All checks passed'} in ${((Date.now() - t0) / 1000).toFixed(0)} s${skipped}.`);
  process.exit(failed ? 1 : 0);
})();
