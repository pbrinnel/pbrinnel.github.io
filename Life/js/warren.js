// Warren holes: the refuge bunnies run to (bunny.js, FLEE and HIDE) and dig (bunny.js, DIG).
// A hole is ground, not an occupant (world.js), so this file only keeps their clocks: it
// notes which holes a bunny stands on and collapses the ones nobody has used for CollapseDays.
// Placing a hole is world.js's addHole, called by bunny.js's DIG and start.js.
(function (AS) {
  'use strict';

  // Every tick: a bunny standing on a hole uses it. The list is short, so this is cheaper than
  // sampling hourly, and a bunny that only ducks in for a minute still counts.
  // Once per in-world hour: a hole unused for CollapseDays turns back into bare ground, where
  // grass may return. holeUsedAt is only ever written here and when the hole is dug.
  AS.warrenTick = function (sim) {
    const W = sim.W, list = W.hList, now = sim.simSeconds;
    for (let i = 0; i < W.hCount; i++) {
      if (W.kind[list[i]] === AS.KIND.BUNNY) W.holeUsedAt[list[i]] = now;
    }
    if (sim.tickCount % AS.TICKS_PER_HOUR !== 0) return;
    const limit = sim.T.world.CollapseDays * AS.DAY_SECONDS;
    // Backward, because removing a hole swaps the last one into its place.
    for (let i = W.hCount - 1; i >= 0; i--) {
      const t = list[i];
      if (W.kind[t] !== AS.KIND.BUNNY && now - W.holeUsedAt[t] > limit) W.removeHole(t);
    }
  };

  // Is there a hole within r tiles (a circle) of tile t?
  AS.holeWithin = function (W, t, r) {
    if (W.hCount === 0) return false;
    const x = t % W.w, y = (t / W.w) | 0, ri = Math.floor(r), r2 = r * r;
    const y0 = Math.max(0, y - ri), y1 = Math.min(W.h - 1, y + ri);
    const x0 = Math.max(0, x - ri), x1 = Math.min(W.w - 1, x + ri);
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - x, dy = yy - y;
        if (dx * dx + dy * dy <= r2 && W.hole[yy * W.w + xx]) return true;
      }
    }
    return false;
  };
})(globalThis.AS);
