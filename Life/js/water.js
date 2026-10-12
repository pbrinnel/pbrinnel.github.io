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
// terrain.js runs these before day 0 so a world starts settled.
//
//   AS.Water(grid, S, outlet) → water
//     grid: { w, h, n, elev }; S: the world's settings (sim.terrain); outlet: Uint8Array, 1 at a river mouth
//     water.H, water.G      surface water depth and soil water (m of water), Float64Array
//     water.step(days)       one step: exchange, SUBSTEPS surface moves, a soil move
//     water.totals           m of water since made: { rain, evap, et, out } (per tile area)
(function (AS) {
  'use strict';
  // Math's functions looked up once: hot loops (and the Node sandbox the checks run in, where
  // each global lookup is slow) don't pay for it on every call.
  const { sqrt, cbrt, min, max } = Math;

  const TILE_M = AS.TILE_M = 10;   // m across a tile: the map is 4.5 × 3 km
  const POROSITY = 0.3;            // share of the soil that is room for water
  const SUBSTEPS = 8;              // surface moves per step (surface water is quick, soil slow)
  const SEC_PER_DAY = 86400;
  const TINY = 1e-6;               // m: below this a depth is float rounding, counted as none
  AS.WATER_TINY = TINY;
  AS.SOIL_POROSITY = POROSITY;

  AS.Water = function (grid, S, outlet) {
    const { w, h, n } = grid, E = grid.elev;
    const H = new Float64Array(n), G = new Float64Array(n), dH = new Float64Array(n), dG = new Float64Array(n);
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
      for (let i = 0; i < n; i++) {
        let d = H[i] + rain * dt, g = G[i];
        totals.rain += rain * dt;
        const soak = min(d, inf * dt, max(0, room - g));
        d -= soak; g += soak;
        if (g > room) { d += g - room; g = room; }
        if (d > 0) { const e = min(d, evap * dt); d -= e; totals.evap += e; }
        if (g > 0) { const e = min(g, et * dt * g / room); g -= e; totals.et += e; }
        H[i] = d < TINY ? 0 : d; G[i] = g;
      }
      listWet();
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
    function soil(dt) {
      dG.fill(0);
      for (let i = 0; i < n; i++) {
        const g = G[i];
        if (g <= 0) continue;
        const thick = g / POROSITY, top = E[i] - S.SoilDepth + thick;
        nbs(i);
        let total = 0, scale = 1, off = 0;
        for (let k = 0; k < 4; k++) {
          const u = nb[k]; want[k] = 0;
          if (u < 0) continue;
          const drop = top - (E[u] - S.SoilDepth + G[u] / POROSITY);
          if (drop <= 0) continue;
          want[k] = S.SoilFlow * thick * (drop / TILE_M) * dt / TILE_M * POROSITY;
          const c = drop * POROSITY / 5;
          if (want[k] > c) scale = min(scale, c / want[k]);
          total += want[k];
        }
        if (outlet[i]) { off = S.SoilFlow * thick * (thick / TILE_M) * dt / TILE_M * POROSITY; total += off; }
        if (total <= 0) continue;
        if (total * scale > g) scale = g / total;
        for (let k = 0; k < 4; k++) if (want[k] > 0) dG[nb[k]] += want[k] * scale;
        totals.out += off * scale;
        dG[i] -= total * scale;
      }
      for (let i = 0; i < n; i++) G[i] = max(0, G[i] + dG[i]);
    }

    function step(dt) {
      exchange(dt);
      for (let k = 0; k < SUBSTEPS; k++) surface(dt / SUBSTEPS);
      soil(dt);
    }

    return { H, G, room, totals, step, listWet };
  };
})(globalThis.AS);
