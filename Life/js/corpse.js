// Corpses feed grass. Each corpse claims the tiles of its CorpseRadius circle in
// W.boostSrc; grass.js reads that to grow and seed faster and to drink the corpse's Nutrient.
// A tile belongs to one corpse at a time (no stacking), so overlap can't multiply the boost.
(function (AS) {
  'use strict';

  const rangeOf = (T, W, t) => T[AS.SPECIES_KEY[W.cSpecies[t]]].CorpseRadius;

  // Gives every unclaimed tile inside t's circle to t. Tiles another corpse holds stay with it.
  function claim(W, t, R) {
    const cx = W.tx(t), cy = W.ty(t), R2 = R * R, reach = Math.floor(R);
    const y0 = Math.max(0, cy - reach), y1 = Math.min(W.h - 1, cy + reach);
    const x0 = Math.max(0, cx - reach), x1 = Math.min(W.w - 1, cx + reach);
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        if (dx * dx + dy * dy > R2) continue;
        const i = y * W.w + x;
        if (W.boostSrc[i] === -1) W.boostSrc[i] = t;
      }
    }
  }

  AS.corpseAdded = function (sim, t) {
    const W = sim.W;
    claim(W, t, rangeOf(sim.T, W, t));
  };

  // Frees every tile t holds, then lets any corpse whose circle can overlap t's take them.
  function release(sim, t) {
    const { T, W } = sim;
    const R = rangeOf(T, W, t);
    const cx = W.tx(t), cy = W.ty(t), R2 = R * R, reach = Math.floor(R);
    const y0 = Math.max(0, cy - reach), y1 = Math.min(W.h - 1, cy + reach);
    const x0 = Math.max(0, cx - reach), x1 = Math.min(W.w - 1, cx + reach);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * W.w + x;
        if (W.boostSrc[i] === t) W.boostSrc[i] = -1;
      }
    }
    W.removeCorpse(t);
    for (let k = 0; k < W.cCount; k++) {
      const o = W.cList[k];
      const Ro = rangeOf(T, W, o), dx = W.tx(o) - cx, dy = W.ty(o) - cy, far = R + Ro;
      if (dx * dx + dy * dy <= far * far) claim(W, o, Ro);
    }
  }

  AS.corpseTick = function (sim) {
    const { T, W } = sim;
    // Backwards: removing a corpse swaps the last one into its slot, and that one is done.
    for (let k = W.cCount - 1; k >= 0; k--) {
      const t = W.cList[k];
      const age = W.cAge[t] += AS.DT_DAYS;
      if (age >= T[AS.SPECIES_KEY[W.cSpecies[t]]].CorpseDecay || W.cNut[t] <= 0) release(sim, t);
    }
  };

  AS.corpseBoost = function (sim, t) {
    const src = sim.W.boostSrc[t];
    return src >= 0 ? sim.T[AS.SPECIES_KEY[sim.W.cSpecies[src]]].CorpseBoost : 1;
  };
})(globalThis.AS);
