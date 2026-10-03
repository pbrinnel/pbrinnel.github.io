// Seeded randomness. Everything the sim rolls comes from one of these, so a seed in
// settings.csv replays a run exactly. Drawing never rolls from it.
(function (AS) {
  'use strict';

  // mulberry32: one 32-bit word of state, fast, and plenty for a sim.
  AS.makeRng = function (seed) {
    let s = seed >>> 0;
    function next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next,
      int: n => Math.floor(next() * n),            // 0 … n-1
      chance: p => next() < p,
      inRange: r => r.min + Math.floor(next() * (r.max - r.min + 1)), // a {min, max} from tables.js
      state: () => s,
    };
  };

  AS.newSeed = function () {
    const a = new Uint32Array(1);
    globalThis.crypto.getRandomValues(a);
    return a[0];
  };
})(globalThis.AS);
