// Water, as physics (Paul, 11 Oct 2026: consistent rules, nothing faked). Every tile holds
// two kinds of water, moved by one set of rules, the same on every tile every step:
//
//   Rain falls on every tile. Surface water flows toward lower water surfaces, faster the
//   deeper and steeper it is (Manning: speed = SurfaceFlow · depth^(2/3) · √slope, m/s); it
//   soaks into the soil as fast as Infiltration and as far as the soil has room, and
//   evaporates (Evaporation). Soil water flows toward a lower water table through the soil
//   (Darcy: SoilFlow m/day × the water's thickness × the table's slope); plants draw it out
//   (Transpiration, less as the soil dries). A soil fuller than its room pushes the extra up
//   as surface water: springs and seeps. Both leave the map only at its river mouths.
//
// Stability limits, the same on every tile: a tile never gives more than it has, nor more to
// one neighbor than a fifth of the difference in their levels (it trades with four at once).
// Depths under TINY are float rounding and count as none.
//
// Time moves in steps, each the same three moves in order: the exchange, a surface move, a
// soil move. During play one step runs every STEP_TICKS ticks (STEP_DAYS of the world's time),
// so every look at the water sees it at the same point of a step: rain and springs arrive a
// little each step, as they would, rather than in lumps that come and drain away (which made
// thousands of tiles blink wet and dry). terrain.js runs them before day 0 (preRun): coarse
// steps to settle the world quickly, then SETTLE_DAYS of play's own steps, so day 0 is
// already at rest under the rules it will run by.
//
//   AS.Water(grid, S, outlet) → water
//     grid: { w, h, n, elev }; S: the world's settings (sim.terrain); outlet: Uint8Array, 1 at a river mouth
//     water.H, water.G      surface water depth and soil water (m of water), Float64Array
//     water.step(days)       one step of `days`
//     water.preRun(days)     `days` before day 0, ending at rest under play's steps
//     water.listWet()        after H is changed from outside (pouring, drinking)
//     water.totals           m of water since made: { rain, evap, et, out } (per tile area)
//
//   AS.waterTick(sim)        the sim's tick: a step when one is due, then the world told (syncWater)
//   AS.syncWater(sim)        W.wDepth and the tiles' kinds made to match water.H
//   The world's water is W.water (terrain.js makes it; paint.js makes one to pour into a world
//   without).
(function (AS) {
  'use strict';
  // Math's functions looked up once: hot loops (and the Node sandbox the checks run in, where
  // each global lookup is slow) don't pay for it on every call.
  const { sqrt, cbrt, min, max } = Math;

  const TILE_M = AS.TILE_M = 10;   // m across a tile: the map is 4.5 × 3 km
  const POROSITY = 0.3;            // share of the soil that is room for water
  const SEC_PER_DAY = 86400;
  const TINY = 1e-6;               // m: below this a depth is float rounding, counted as none
  const STEP_TICKS = 15;           // ticks between steps during play
  const STEP_DAYS = STEP_TICKS / (AS.DAY_SECONDS * AS.TICK_HZ);   // sim.js sets the clock first
  const SPINUP_STEP_DAYS = 1 / 8;  // the pre-run's coarse steps
  const SETTLE_DAYS = 10;          // the pre-run's last days, in play's own steps
  const FIELD_STEPS = 10;          // the way-to-water field is rebuilt at most this often (steps)
  AS.WATER_TINY = TINY;
  AS.SOIL_POROSITY = POROSITY;
  AS.WATER_STEP_DAYS = STEP_DAYS;

  AS.Water = function (grid, S, outlet) {
    const { w, h, n } = grid, E = grid.elev;
    const H = new Float64Array(n), G = new Float64Array(n), dH = new Float64Array(n), dG = new Float64Array(n), L = new Float64Array(n);
    // The soil's floor under each tile (the ground minus SoilDepth): the ground doesn't move.
    const floor = new Float64Array(n);
    for (let i = 0; i < n; i++) floor[i] = E[i] - S.SoilDepth;
    const wet = new Int32Array(n), touched = new Int32Array(n), mark = new Uint8Array(n);
    let wetN = 0;
    const room = S.SoilDepth * POROSITY;
    const totals = { rain: 0, evap: 0, et: 0, out: 0 };
    const rain = S.Rain / 1000, evap = S.Evaporation / 1000, et = S.Transpiration / 1000, inf = S.Infiltration / 1000;
    const want = new Float64Array(4), nb = new Int32Array(4);

    function nbs(i) {
      const x = i % w, y = (i / w) | 0;
      nb[0] = x > 0 ? i - 1 : -1; nb[1] = x < w - 1 ? i + 1 : -1; nb[2] = y > 0 ? i - w : -1; nb[3] = y < h - 1 ? i + w : -1;
    }
    function listWet() { wetN = 0; for (let i = 0; i < n; i++) if (H[i] > 0) wet[wetN++] = i; }

    // Rain, soaking in, springs, evaporation and transpiration on every tile, for dt days.
    function exchange(dt) {
      wetN = 0;
      for (let i = 0; i < n; i++) {
        let d = H[i] + rain * dt, g = G[i];
        totals.rain += rain * dt;
        const soak = min(d, inf * dt, max(0, room - g));
        d -= soak; g += soak;
        if (g > room) { d += g - room; g = room; }
        if (d > 0) { const e = min(d, evap * dt); d -= e; totals.evap += e; }
        if (g > 0) { const e = min(g, et * dt * g / room); g -= e; totals.et += e; }
        H[i] = d < TINY ? 0 : d; G[i] = g;
        if (H[i] > 0) wet[wetN++] = i;
      }
    }

    // Surface water, one move of dt days. Only tiles holding water do any work, and only the
    // tiles they touch are finished off: the same rule, skipping dry tiles.
    function surface(dt) {
      const sec = dt * SEC_PER_DAY;
      let touchedN = 0;
      for (let j = 0; j < wetN; j++) { const i = wet[j]; mark[i] = 1; touched[touchedN++] = i; dH[i] = 0; }
      for (let j = 0; j < wetN; j++) {
        const i = wet[j], d = H[i], Hi = E[i] + d;
        nbs(i);
        const flux = S.SurfaceFlow * cbrt(d * d) * d * sec / TILE_M;   // ks · d^(2/3) · d, before the slope
        let total = 0, scale = 1, off = 0;
        for (let k = 0; k < 4; k++) {
          const u = nb[k]; want[k] = 0;
          if (u < 0) continue;
          const drop = Hi - (E[u] + H[u]);
          if (drop <= 0) continue;
          want[k] = flux * sqrt(drop / TILE_M);
          const cap = drop / 5;
          if (want[k] > cap) scale = min(scale, cap / want[k]);
          total += want[k];
        }
        if (outlet[i]) {   // a river mouth: the ground goes on past the edge at this tile's height, bare
          off = flux * sqrt(d / TILE_M);
          if (off > d / 5) scale = min(scale, d / 5 / off);
          total += off;
        }
        if (total <= 0) continue;
        if (total * scale > d) scale = d / total;
        for (let k = 0; k < 4; k++) {
          if (!(want[k] > 0)) continue;
          const u = nb[k];
          if (!mark[u]) { mark[u] = 1; touched[touchedN++] = u; dH[u] = 0; }
          dH[u] += want[k] * scale;
        }
        totals.out += off * scale;
        dH[i] -= total * scale;
      }
      wetN = 0;
      for (let j = 0; j < touchedN; j++) {
        const i = touched[j]; mark[i] = 0;
        const v = H[i] + dH[i]; H[i] = v < TINY ? 0 : v;
        if (H[i] > 0) wet[wetN++] = i;
      }
    }

    // Soil water, one move of dt days: toward a lower water table (the soil's floor, the ground
    // minus SoilDepth, plus the water's height in it); out of the map only at a river mouth.
    // Darcy: SoilFlow × thickness × (drop / TILE_M) × dt over a tile's width, as water (× POROSITY).
    function soil(dt) {
      const k = S.SoilFlow * dt * POROSITY / (TILE_M * TILE_M), perM = 1 / POROSITY, capK = POROSITY / 5;
      for (let i = 0; i < n; i++) { L[i] = floor[i] + G[i] * perM; dG[i] = 0; }
      for (let y = 0, i = 0; y < h; y++) {
        for (let x = 0; x < w; x++, i++) {
          const g = G[i];
          if (g <= 0) continue;
          const thick = g * perM, top = L[i], kt = k * thick;
          let total = 0, scale = 1, a = 0, b = 0, c = 0, d = 0;
          if (x > 0) { const dr = top - L[i - 1]; if (dr > 0) { a = kt * dr; const cap = dr * capK; if (a > cap) scale = min(scale, cap / a); total += a; } }
          if (x < w - 1) { const dr = top - L[i + 1]; if (dr > 0) { b = kt * dr; const cap = dr * capK; if (b > cap) scale = min(scale, cap / b); total += b; } }
          if (y > 0) { const dr = top - L[i - w]; if (dr > 0) { c = kt * dr; const cap = dr * capK; if (c > cap) scale = min(scale, cap / c); total += c; } }
          if (y < h - 1) { const dr = top - L[i + w]; if (dr > 0) { d = kt * dr; const cap = dr * capK; if (d > cap) scale = min(scale, cap / d); total += d; } }
          const off = outlet[i] ? kt * thick : 0;
          total += off;
          if (total <= 0) continue;
          if (total * scale > g) scale = g / total;
          if (a > 0) dG[i - 1] += a * scale;
          if (b > 0) dG[i + 1] += b * scale;
          if (c > 0) dG[i - w] += c * scale;
          if (d > 0) dG[i + w] += d * scale;
          totals.out += off * scale;
          dG[i] -= total * scale;
        }
      }
      for (let i = 0; i < n; i++) { const v = G[i] + dG[i]; G[i] = v > 0 ? v : 0; }
    }

    function step(dt) { exchange(dt); surface(dt); soil(dt); }
    function run(days, dt) { for (let t = 0; t < days - 1e-9; t += dt) step(dt); }
    function preRun(days) {
      const settle = min(days, SETTLE_DAYS);
      run(days - settle, SPINUP_STEP_DAYS);
      run(settle, STEP_DAYS);
    }

    return { H, G, room, totals, step, preRun, listWet };
  };

  AS.waterTick = function (sim) {
    const wat = sim.W.water;
    if (!wat || sim.tickCount % STEP_TICKS !== 0) return;
    wat.step(STEP_DAYS);
    AS.syncWater(sim);
    // The way-to-water field is a guide: rebuilt every FIELD_STEPS steps when shores have
    // moved, not at every one.
    if (sim.W.wetMoved && (sim.tickCount / STEP_TICKS) % FIELD_STEPS === 0) { sim.W.wetMoved = false; sim.W.waterStale = true; }
  };

  // Water reaching a tile drowns its blade, floods its hole and washes its corpse away
  // (world.js setDepth, after corpse.js lets the corpse's grass boost go); an animal stays
  // and wades or steps out (moving.js).
  AS.syncWater = function (sim) {
    const W = sim.W, H = W.water.H, D = W.wDepth, n = W.n;
    for (let t = 0; t < n; t++) {
      const h = H[t];
      if (h > 0) {
        if (D[t] > 0) { D[t] = h; continue; }
        if (W.kind[t] === AS.KIND.CORPSE) AS.corpseRemove(sim, t);
        W.setDepth(t, h);
      } else if (D[t] > 0) W.setDepth(t, 0);
    }
  };
})(globalThis.AS);
