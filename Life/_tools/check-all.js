// Runs every headless check for Life and the tuning lab, one after another, and prints one
// line each plus a verdict. Run it before and after any change:
//
//   node Life/_tools/check-all.js          (about 3 minutes; nothing needs a browser)
//
// A check fails if it exits non-zero or prints a FAIL line. The browser checks
// (browser-*.js, run-bench.js, shoot.js) need the page served and Chrome; they aren't run
// here — see Life/MAP.md.
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const TOOLS = __dirname, LAB = path.join(__dirname, '../_lab');
const CHECKS = [
  // [file, args, node flags]
  [path.join(TOOLS, 'harness.js'), ['12'], []],        // grid/store audits + same seed → same world
  [path.join(TOOLS, 'tables-check.js'), [], []],       // CSV loading, units, error messages
  [path.join(TOOLS, 'grass-check.js'), [], []],
  [path.join(TOOLS, 'sight-check.js'), [], ['--expose-gc']],
  [path.join(TOOLS, 'bunny-check.js'), [], []],
  [path.join(TOOLS, 'breed-check.js'), [], []],
  [path.join(TOOLS, 'wolf-check.js'), [], []],
  [path.join(TOOLS, 'human-check.js'), [], []],
  [path.join(TOOLS, 'warren-check.js'), [], []],
  [path.join(TOOLS, 'god-check.js'), [], []],
  [path.join(TOOLS, 'inspect-check.js'), [], []],
  [path.join(TOOLS, 'camera-check.js'), [], []],
  [path.join(TOOLS, 'render-check.js'), [], []],
  [path.join(TOOLS, 'sprites-check.js'), [], []],
  [path.join(TOOLS, 'ui-check.js'), [], []],
  [path.join(TOOLS, 'graph-check.js'), [], []],
  [path.join(TOOLS, 'graph-smoke.js'), [], []],
  [path.join(TOOLS, 'bench-check.js'), [], []],
  [path.join(LAB, 'search-check.js'), [], []],
  [path.join(LAB, 'ui-lab-check.js'), [], []],
];
const TIMEOUT_MS = 10 * 60 * 1000;

let failed = 0;
const t0 = Date.now();
for (const [file, args, flags] of CHECKS) {
  const t = Date.now();
  const r = spawnSync(process.execPath, [...flags, file, ...args], { encoding: 'utf8', timeout: TIMEOUT_MS, cwd: path.join(__dirname, '../..') });
  const outText = (r.stdout || '') + (r.stderr || '');
  const failLines = outText.split('\n').filter(l => /^\s*FAIL\b/.test(l));
  const ok = r.status === 0 && !failLines.length;
  if (!ok) failed++;
  const last = outText.trim().split('\n').pop() || '';
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${path.relative(path.join(__dirname, '../..'), file).padEnd(34)} ${((Date.now() - t) / 1000).toFixed(0).padStart(4)} s  ${ok ? last.slice(0, 60) : ''}`);
  if (!ok) {
    for (const l of (failLines.length ? failLines : outText.trim().split('\n').slice(-12))) console.log('       ' + l);
  }
}
console.log(`\n${failed ? `${failed} check(s) FAILED` : 'All checks passed'} in ${((Date.now() - t0) / 1000).toFixed(0)} s.`);
process.exit(failed ? 1 : 0);
