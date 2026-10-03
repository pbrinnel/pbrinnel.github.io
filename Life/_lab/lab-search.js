// The lab's automatic Search: a small evolutionary hill-climb over the cells Paul chose to
// vary. Each candidate is a full set of values for those cells, scored by running every
// seed through the pool (the workers do the heavy lifting; this file only picks numbers).
//
//   const s = LAB.Search({ pool, texts, params, seeds, days, bunnyCap, budget, rngSeed })
//   s.start(onUpdate) → Promise<best>   onUpdate({ tried, budget, best, last }) per candidate
//   s.stop()                            resolves start() early with the best so far
//
// Strategy:
//  1. The base (no edits) is candidate 1, so every other score reads against Paul's numbers.
//  2. After that, pick a parent from the best list (the better ranked, the likelier) and
//     mutate 1..MAX_MUTATED of the params. A number moves by x * exp(N(0, SIGMA)), which
//     steps by proportion whatever the cell's size; a range moves both ends the same way.
//     Results are clamped to [lo, hi], whole-number cells stay whole, and a range keeps lo<=hi.
//  3. A candidate whose cell texts match one already tried is thrown away and re-rolled.
//  4. Several candidates fly at once when the pool has more workers than there are seeds.
// Randomness is a seeded mulberry32, so the same inputs reproduce the same search.
(function (root) {
  'use strict';
  const LAB = root.LAB = root.LAB || {};

  const BEST_KEPT = 5;        // candidates the search hands back
  const SIGMA = 0.3;          // std-dev of the log-space step
  const MAX_MUTATED = 3;      // most params changed in one mutation
  const REROLL_LIMIT = 200;   // tries to find a new candidate before giving up (space exhausted)
  const FROM_ZERO = 0.05;     // a 0 value can't scale; it restarts at this fraction of hi

  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const keyOf = p => `${p.file}|${p.row}|${p.col}`;

  function better(a, b) {
    const x = a.summary, y = b.summary;
    return x.score - y.score || x.survived - y.survived || x.meanAllAliveDays - y.meanAllAliveDays;
  }

  LAB.Search = function (o) {
    const { pool, texts, params, seeds, days, bunnyCap } = o;
    const budget = o.budget;
    const rand = mulberry32((o.rngSeed == null ? 1 : o.rngSeed) >>> 0);
    const normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());

    // A state is one numeric value per param: a number, or [lo, hi] for a range.
    const baseState = params.map(p => p.parsed.kind === 'range' ? [p.parsed.lo, p.parsed.hi] : p.parsed.v);
    // A whole-number cell stays whole, unless its bounds are fractional: asking for a
    // fractional lo/hi (e.g. 0.2-10 on a 2) is asking for fractional values.
    const whole = params.map(p => p.parsed.kind === 'range'
      || (p.parsed.decimals === 0 && Number.isInteger(p.parsed.v) && Number.isInteger(p.lo) && Number.isInteger(p.hi)));

    const lo = (i) => params[i].lo, hi = (i) => params[i].hi;
    const clamp = (i, x) => Math.min(hi(i), Math.max(lo(i), x));

    // Scale one number; wholes are rounded and, if they'd land back on the start, nudged
    // one step so a mutation always changes something.
    function scale(i, x) {
      const start = x > 0 ? x : Math.max(hi(i) * FROM_ZERO, whole[i] ? 1 : 0.01);
      let y = clamp(i, start * Math.exp(normal() * SIGMA));
      if (whole[i]) {
        y = Math.round(y);
        if (y === Math.round(x)) y = clamp(i, y + (rand() < 0.5 ? -1 : 1));
        y = Math.round(clamp(i, y));
      }
      return y;
    }

    function mutate(state) {
      const next = state.map(v => Array.isArray(v) ? v.slice() : v);
      const n = 1 + Math.floor(rand() * Math.min(MAX_MUTATED, params.length));
      const picked = new Set();
      while (picked.size < n) picked.add(Math.floor(rand() * params.length));
      for (const i of picked) {
        if (Array.isArray(next[i])) {
          let a = scale(i, next[i][0]), b = scale(i, next[i][1]);
          if (a > b) [a, b] = [b, a];
          next[i] = [a, b];
        } else next[i] = scale(i, next[i]);
      }
      return next;
    }

    function texted(state) {
      const values = {};
      params.forEach((p, i) => { values[keyOf(p)] = LAB.formatValue(p.parsed, state[i]); });
      return values;
    }

    // Only the cells whose text differs from the base tables.
    function editsFor(values) {
      const edits = [];
      for (const p of params) {
        const value = values[keyOf(p)];
        const cur = LAB.getCell(texts[p.file], p.row, p.col);
        if (cur == null || String(cur).trim() !== value) edits.push({ file: p.file, row: p.row, col: p.col, value });
      }
      return edits;
    }

    let stopped = false, finish = null;

    function start(onUpdate) {
      const tried = new Set();
      const best = [];
      let launched = 0, done = 0, inflight = 0, last = null;
      const maxFlight = Math.max(1, Math.ceil(pool.size / Math.max(1, seeds.length)));
      let exhausted = false;

      return new Promise(resolve => {
        finish = () => resolve(best.slice());

        function nextState() {
          if (launched === 0) return baseState;
          for (let k = 0; k < REROLL_LIMIT; k++) {
            // Rank-weighted pick: weight 1/(rank+1), so the leader is likeliest.
            let parent = baseState;
            if (best.length) {
              let total = 0;
              for (let r = 0; r < best.length; r++) total += 1 / (r + 1);
              let t = rand() * total, r = 0;
              while (r < best.length - 1 && (t -= 1 / (r + 1)) > 0) r++;
              parent = best[r].state;
            }
            const s = mutate(parent);
            if (!tried.has(sig(s))) return s;
          }
          return null;
        }
        const sig = s => params.map((p, i) => LAB.formatValue(p.parsed, s[i])).join('\n');

        function launch() {
          while (!stopped && !exhausted && launched < budget && inflight < maxFlight) {
            const state = nextState();
            if (!state) { exhausted = true; break; }
            tried.add(sig(state));
            launched++;
            inflight++;
            evaluate(state).then(cand => {
              inflight--;
              if (stopped) return;
              done++;
              if (cand.summary.seeds > 0) {
                best.push(cand);
                best.sort((a, b) => better(b, a));
                if (best.length > BEST_KEPT) best.length = BEST_KEPT;
              }
              last = cand;
              if (onUpdate) onUpdate({ tried: done, budget, best: best.slice(), last });
              launch();
            });
          }
          if (!stopped && inflight === 0 && (exhausted || launched >= budget)) resolve(best.slice());
        }

        launch();
      }).then(r => r);

      function evaluate(state) {
        const values = texted(state);
        const edits = editsFor(values);
        const runTexts = LAB.applyEdits(texts, edits);
        return Promise.all(seeds.map(seed => pool.run({ texts: runTexts, seed, days, bunnyCap })))
          .then(results => ({ edits, values, summary: LAB.summarize(results), results, state }));
      }
    }

    return {
      start,
      stop() {
        if (stopped) return;
        stopped = true;
        pool.cancelAll();
        if (finish) finish();
      },
    };
  };

  if (typeof module !== 'undefined') module.exports = LAB;
})(typeof globalThis !== 'undefined' ? globalThis : this);
