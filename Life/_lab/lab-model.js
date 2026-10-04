// What the lab's editor, its search and its summaries agree on: how a table cell's text
// reads as a number and is written back in the same style, and how a set of seed runs is
// scored. Paul's goal (memory: a self-sustaining ecosystem) is that grass, bunnies and
// wolves all persist; the score measures exactly that, nothing about which numbers.
//
//   LAB.parseValue(text) → { kind: 'num' | 'pct' | 'range', v | lo,hi, decimals } or null
//   LAB.formatValue(parsed, x | [lo, hi]) → cell text in the original style
//   LAB.tunables(texts) → [{ file, row, col, text, unit, parsed, group }] every numeric cell
//   LAB.summarize(results) → { seeds, survived, survivalRate, meanAllAliveDays, ..., score }
(function (root) {
  'use strict';
  const LAB = root.LAB = root.LAB || {};

  const SPECIES_COLS = ['Bunny', 'Wolf', 'Grass'];
  // Not tuning knobs: identity, size of the world and the seed are set in settings.csv
  // for a reason (the benchmark and replays depend on them), Glyph/Diet aren't numbers, and the God tab's numbers (NukeRadius, ScorchDays) don't shape a run.
  const SKIP_ROWS = new Set(['Glyph', 'Diet', 'Seed', 'WorldWidth', 'WorldHeight', 'NukeRadius', 'ScorchDays']);

  LAB.parseValue = function (text) {
    const s = String(text).trim().replace(/[–—]/g, '-');
    let m = s.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) return { kind: 'range', lo: +m[1], hi: +m[2], decimals: 0 };
    m = s.match(/^([+-]?\d*\.?\d+)\s*%$/);
    if (m) return { kind: 'pct', v: +m[1], decimals: decimalsOf(m[1]) };
    m = s.match(/^[+-]?\d*\.?\d+$/);
    if (m) return { kind: 'num', v: +s, decimals: decimalsOf(s) };
    return null;
  };

  function decimalsOf(s) { const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; }

  // Keeps the cell's look: a whole number stays whole, a percent keeps its "%", a range
  // stays "a-b" with lo ≤ hi. A value that needs more precision than the original gets it
  // (up to 3 decimals), so a search can make fine steps.
  LAB.formatValue = function (p, x) {
    if (p.kind === 'range') {
      let lo = Math.max(0, Math.round(x[0])), hi = Math.max(0, Math.round(x[1]));
      if (lo > hi) [lo, hi] = [hi, lo];
      return lo === hi ? String(lo) : `${lo}-${hi}`;
    }
    const v = Math.max(0, x);
    const d = p.decimals === 0 && Number.isInteger(p.v) && Math.abs(v - Math.round(v)) < 1e-9 ? 0
      : Math.min(3, Math.max(p.decimals, needed(v)));
    const t = String(+v.toFixed(d));
    return p.kind === 'pct' ? t + '%' : t;
  };

  function needed(v) {
    for (let d = 0; d <= 3; d++) if (Math.abs(+v.toFixed(d) - v) < 1e-9) return d;
    return 3;
  }

  LAB.tunables = function (texts) {
    const out = [];
    const sp = LAB.csvCells(texts.species);
    const header = texts.species.replace(/^﻿/, '').split(/\r?\n/)[0].split(',').map(h => h.trim());
    const unitCol = header.indexOf('Unit');
    for (const r of sp) {
      const row = r.cells[0];
      if (!row || SKIP_ROWS.has(row)) continue;
      for (const col of SPECIES_COLS) {
        const ci = header.indexOf(col);
        const text = r.cells[ci] || '';
        const parsed = LAB.parseValue(text);
        if (parsed) out.push({ file: 'species', row, col, text, unit: r.cells[unitCol] || '', parsed, group: col });
      }
    }
    for (const r of LAB.csvCells(texts.settings)) {
      const row = r.cells[0];
      if (!row || SKIP_ROWS.has(row)) continue;
      const parsed = LAB.parseValue(r.cells[1] || '');
      if (parsed) out.push({ file: 'settings', row, col: 'Value', text: r.cells[1], unit: '', parsed, group: 'World' });
    }
    return out;
  };

  // results: worker results (see worker.js). A seed's "all-alive days" are the days until
  // the first species died out or bunnies boomed past the cap (a boom means wolves lost
  // control of them); a seed that ran every asked day with all three alive "survived".
  // score = mean over seeds of all-alive days / days asked, in 0–1: 1 means every seed
  // kept all three species for the whole run.
  LAB.summarize = function (results) {
    const ok = results.filter(r => r && r.endReason && r.endReason !== 'error' && r.endReason !== 'canceled');
    const count = { 'wolves extinct': 0, 'bunnies extinct': 0, 'grass extinct': 0, 'bunny boom': 0,
      'wolves declining': 0, 'grass collapsing': 0, survived: 0 };
    let frac = 0, days = 0;
    for (const r of ok) {
      count[r.endReason] = (count[r.endReason] || 0) + 1;
      const alive = r.endReason === 'survived' ? r.daysAsked : Math.max(0, r.daysRun - 1);
      days += alive;
      frac += r.daysAsked ? alive / r.daysAsked : 0;
    }
    const n = ok.length;
    return {
      seeds: n,
      errors: results.length - n,
      survived: count.survived,
      survivalRate: n ? count.survived / n : 0,
      meanAllAliveDays: n ? days / n : 0,
      wolvesExtinct: count['wolves extinct'],
      wolvesDeclining: count['wolves declining'],
      grassCollapsing: count['grass collapsing'],
      bunniesExtinct: count['bunnies extinct'],
      grassExtinct: count['grass extinct'],
      booms: count['bunny boom'],
      score: n ? frac / n : 0,
    };
  };

  if (typeof module !== 'undefined') module.exports = LAB;
})(typeof globalThis !== 'undefined' ? globalThis : this);
