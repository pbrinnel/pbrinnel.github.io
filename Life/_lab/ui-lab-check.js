// node Life/_lab/ui-lab-check.js
'use strict';
const assert = require('assert');
const LAB = require('./lab-tables.js');
require('./lab-model.js');
require('./lab-ui.js');
const fs = require('fs'), path = require('path');
const ui = LAB.ui;
const dir = path.resolve(__dirname, '../tables');
const texts = {}; for (const n of ['species', 'variables', 'states', 'settings']) texts[n] = fs.readFileSync(path.join(dir, n + '.csv'), 'utf8');
const tun = LAB.tunables(texts);
const fields = {}; for (const t of tun) fields[ui.key(t)] = t.text;

// edits
assert.deepStrictEqual(ui.buildEdits(tun, fields), { edits: [], invalid: [] });
fields['species|LitterSize|Wolf'] = '2-3';
fields['settings|StartWolves|Value'] = '20';
fields['species|HPMax|Bunny'] = 'abc';
fields['species|SeedChance|Grass'] = ' 10% ';   // same value, only spaces
fields['species|WalkSpeed|Bunny'] = '2.50';
let b = ui.buildEdits(tun, fields);
assert.deepStrictEqual(b.invalid, ['species|HPMax|Bunny']);
assert.deepStrictEqual(b.edits.map(e => `${e.file}/${e.row}/${e.col}=${e.value}`),
  ['species/WalkSpeed/Bunny=2.50', 'species/LitterSize/Wolf=2-3', 'settings/StartWolves/Value=20']);
const out = LAB.applyEdits(texts, b.edits);
assert.strictEqual(LAB.getCell(out.species, 'LitterSize', 'Wolf'), '2-3');
assert.strictEqual(LAB.getCell(out.settings, 'StartWolves', 'Value'), '20');

// changed list
assert.deepStrictEqual(ui.changedList(tun, b.edits),
  ['Bunny WalkSpeed: 2 → 2.50', 'Wolf LitterSize: 1-2 → 2-3', 'StartWolves: 12 → 20']);
assert.strictEqual(ui.filesText(b.edits), 'species.csv and settings.csv');
assert.strictEqual(ui.filesText([b.edits[0]]), 'species.csv');

// summary sentences
const S = o => Object.assign({ seeds: 8, errors: 0, survived: 0, meanAllAliveDays: 0, wolvesExtinct: 0, bunniesExtinct: 0, grassExtinct: 0, booms: 0, score: 0 }, o);
assert.strictEqual(ui.summarySentence(S({ survived: 3, wolvesExtinct: 4, booms: 1, meanAllAliveDays: 71.2, score: 0.78 }), 100, 20000),
  '3 of 8 seeds kept all three species for 100 days. Others: wolves died out in 4, bunnies boomed past 20,000 in 1. Average all-alive: 71 days. Score 0.78.');
assert.strictEqual(ui.summarySentence(S({ survived: 8, meanAllAliveDays: 100, score: 1 }), 100, 20000),
  'All 8 seeds kept all three species for 100 days. Average all-alive: 100 days. Score 1.00.');
assert.strictEqual(ui.summarySentence(S({ seeds: 1, survived: 0, bunniesExtinct: 1, meanAllAliveDays: 9, score: 0.09 }), 100, 20000),
  '0 of 1 seed kept all three species for 100 days. Others: bunnies died out in 1. Average all-alive: 9 days. Score 0.09.');
assert.ok(/failed or were stopped/.test(ui.summarySentence(S({ seeds: 3, survived: 3, errors: 2, score: 1, meanAllAliveDays: 5 }), 5, 1)));
assert.strictEqual(ui.summarySentence(S({ seeds: 0, errors: 2 }), 5, 1), '2 seeds failed with an error.');
// and against the real summarize
const sm = LAB.summarize([{ endReason: 'survived', daysAsked: 10, daysRun: 10 }, { endReason: 'wolves extinct', daysAsked: 10, daysRun: 5 }]);
assert.ok(ui.summarySentence(sm, 10, 20000).startsWith('1 of 2 seeds kept'));

// captions
assert.strictEqual(ui.seedCaption({ seed: 3, endReason: 'wolves extinct', daysRun: 31 }), 'seed 3 · wolves extinct day 31');
assert.strictEqual(ui.seedCaption({ seed: 5, endReason: 'survived' }), 'seed 5 · survived');
assert.strictEqual(ui.thousands(1234567), '1,234,567');
assert.deepStrictEqual(ui.defaultRange({ kind: 'num', v: 4 }), { lo: 2, hi: 8 });
assert.deepStrictEqual(ui.defaultRange({ kind: 'range', lo: 2, hi: 4 }), { lo: 1, hi: 8 });
assert.deepStrictEqual(ui.defaultRange({ kind: 'range', lo: 1, hi: 2 }), { lo: 1, hi: 4 });
assert.deepStrictEqual(ui.defaultRange({ kind: 'num', v: 1 }), { lo: 1, hi: 2 });
assert.deepStrictEqual(ui.defaultRange({ kind: 'num', v: 12 }), { lo: 6, hi: 24 });
assert.deepStrictEqual(ui.defaultRange({ kind: 'num', v: 0.5 }), { lo: 0.25, hi: 1 });
assert.deepStrictEqual(ui.defaultRange({ kind: 'num', v: 0 }), { lo: 0, hi: 1 });

// downsample vs brute force
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (const [n, cols] of [[100, 10], [2400, 300], [2401, 299], [37, 37], [1000, 1]]) {
  const arr = Uint32Array.from({ length: n }, () => Math.floor(rnd() * rnd() * 50000));
  const d = ui.downsample(arr, cols);
  const seen = new Array(n).fill(0);
  for (let c = 0; c < cols; c++) {
    let lo = Infinity, hi = -Infinity, cnt = 0;
    for (let i = 0; i < n; i++) if (Math.floor(i * cols / n) === c) {
      const v = Math.log10(1 + arr[i]); lo = Math.min(lo, v); hi = Math.max(hi, v); cnt++; seen[i]++;
    }
    assert.ok(cnt > 0, 'empty column');
    assert.ok(Math.abs(d.min[c] - lo) < 1e-12 && Math.abs(d.max[c] - hi) < 1e-12, `col ${c} of ${n}/${cols}`);
  }
  assert.ok(seen.every(x => x === 1), 'every sample in exactly one column');
}
assert.strictEqual(ui.yTop([{ history: { grass: [0, 5], bunnies: [150], wolves: [0] } }]), 3);
assert.strictEqual(ui.yTop([]), 2);
assert.strictEqual(ui.tickLabel(3), '1k'); assert.strictEqual(ui.tickLabel(5), '100k'); assert.strictEqual(ui.tickLabel(2), '100');
console.log('ui-lab-check: all passed');
