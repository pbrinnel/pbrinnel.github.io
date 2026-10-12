// The ground, and the water on it, made before day 0 (Paul, 11 Oct 2026: realistic river beds,
// and no settling to watch on day 1). In order:
//
//   1. The ground is grown, not drawn: it starts almost flat and is lifted, round after round
//      (GrowRounds), faster where the world's noise is high (its ranges) and near the edge (a
//      rim, the region's watershed), while rivers cut it (stream power: ground wears down in
//      proportion to how much ground drains through it × its slope, RiverCut) and slopes
//      soften (HillSoften). Water leaves the map only at a few river mouths (RiverMouths),
//      so the valleys gather into branching systems that run to them. Small dips fill with
//      what the water carries in. Coarse to fine: most rounds on a half-size grid, the last
//      FINE_ROUNDS at full size. Then it is stretched to 0..Relief meters.
//   2. Lake basins (Bowls) are pressed in, as glaciers scoop them.
//   3. With Water on, the water rules (water.js) run for PreRunDays from a rough first guess
//      (each hollow half full, the soil half full), so day 0 is already at rest, and keep
//      running during play (W.water). Nothing joins land across water: animals wade the
//      shallows, and deep water is a wall, as it is.
//
// Uses its own generator from the world's seed, so the ground doesn't shift when anything
// that draws on sim.rng changes. sim.js and start.js call AS.layTerrain for every world.
(function (AS) {
  'use strict';
  // Math's functions looked up once: hot loops (and the Node sandbox the checks run in, where
  // each global lookup is slow) don't pay for it on every call.
  const { sqrt, min, max, abs, floor, ceil, round, exp, pow, SQRT1_2, SQRT2 } = Math;

  // ---- the shape of the ground (look, not tuning: these only make it look natural) ----
  const OCTAVES = 5;              // the uplift pattern: hills with smaller hills on them
  const WARP_SCALE = 90;          // tiles: how broad the bends in the pattern are
  const WARP = 18;                // tiles: how far they bend
  const UPLIFT = 0.01;            // how far the fastest-rising ground lifts a round (units of the pattern)
  const UPLIFT_FLOOR = 0.2;       // the lowest ground still rises this share as fast as the highest
  const RIM = 1.5, RIM_BAND = 0.08; // the edge rises up to RIM more, fading in over RIM_BAND of the shorter side
  const MOUTH_W = 3;              // tiles wide, each river mouth
  const STREAM_M = 0.5;           // stream power: erosion ∝ (drainage area)^STREAM_M × slope
  const FINE_ROUNDS = 60;         // the last rounds, at full size
  const FILL_MAX = 3000;          // dips filled one basin at a time before routing by the full flood
  const FILL_REGION_MAX = 5000;   // a basin bigger than this is left to the full flood
  const BOWL_RADIUS = [10, 40];   // tiles: a lake basin's size (its dip fades out past that)
  const BOWL_DEPTH = [0.05, 0.17]; // a basin's depth as a share of Relief
  const BOWL_MARGIN = 30;         // tiles a basin's center keeps from the wall (less in a small world)
  const BOWL_FALLOFF = 1.6;       // how quickly a basin's dip fades with distance
  const GUESS_FULL = 0.5;         // the water's first guess: each hollow this full
  const SEED_SALT = 0x5eed7e44;   // keeps the ground's generator apart from sim.rng
  const D8X = [-1, 1, 0, 0, -1, 1, -1, 1], D8Y = [0, 0, -1, 1, -1, -1, 1, 1];

  // Octaves of lattice noise, each half the scale and `gain` times the weight of the last,
  // evaluated with plain loops over typed arrays: it runs once per tile.
  function fbm(rng, w, h, scale, octaves, gain) {
    const lat = [], gws = [], inv = [], amps = [];
    let amp = 1, sum = 0;
    for (let o = 0; o < octaves; o++) {
      const sc = max(1, scale / (1 << o)), gw = ceil(w / sc) + 2, gh = ceil(h / sc) + 2;
      const g = new Float32Array(gw * gh);
      for (let i = 0; i < g.length; i++) g[i] = rng.next();
      lat.push(g); gws.push(gw); inv.push(1 / sc); amps.push(amp); sum += amp; amp *= gain;
    }
    for (let o = 0; o < octaves; o++) amps[o] /= sum;
    return (x, y) => {
      if (x < 0) x = 0;
      if (y < 0) y = 0;
      let v = 0;
      for (let o = 0; o < octaves; o++) {
        const fx = x * inv[o], fy = y * inv[o], ix = fx | 0, iy = fy | 0;
        let u = fx - ix, w2 = fy - iy;
        u = u * u * (3 - 2 * u); w2 = w2 * w2 * (3 - 2 * w2);
        const g = lat[o], gw = gws[o], i = iy * gw + ix;
        const a = g[i] + (g[i + 1] - g[i]) * u, b = g[i + gw] + (g[i + gw + 1] - g[i + gw]) * u;
        v += (a + (b - a) * w2) * amps[o];
      }
      return v;
    };
  }

  // The uplift pattern, 0..1: warped noise (Hilliness wide, Roughness rugged).
  function pattern(w, h, S, rng) {
    const pad = WARP + 2, out = new Float64Array(w * h);
    const hills = fbm(rng, w + 2 * pad, h + 2 * pad, S.Hilliness, OCTAVES, S.Roughness);
    const wx = fbm(rng, w + 2 * pad, h + 2 * pad, WARP_SCALE, 2, 0.5);
    const wy = fbm(rng, w + 2 * pad, h + 2 * pad, WARP_SCALE, 2, 0.5);
    let lo = Infinity, hi = -Infinity;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const px = x + pad, py = y + pad;
      const v = hills(px + WARP * (2 * wx(px, py) - 1), py + WARP * (2 * wy(px, py) - 1));
      out[y * w + x] = v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    for (let t = 0; t < out.length; t++) out[t] = (out[t] - lo) / (hi - lo || 1);
    return out;
  }

  // River mouths on a w × h grid: spots are shares of the way round the edge (clockwise from
  // the top-left corner), each MOUTH_W tiles wide.
  function mouths(w, h, spots) {
    const out = new Uint8Array(w * h), per = 2 * (w - 1) + 2 * (h - 1);
    if (per <= 0) { out[0] = 1; return out; }
    const at = p => {
      p = ((p % per) + per) % per;
      if (p < w - 1) return p;
      p -= w - 1; if (p < h - 1) return p * w + (w - 1);
      p -= h - 1; if (p < w - 1) return (h - 1) * w + (w - 1 - p);
      p -= w - 1; return (h - 1 - p) * w;
    };
    for (const f of spots) for (let k = 0; k < MOUTH_W; k++) out[at(round(f * per) + k)] = 1;
    return out;
  }

  // ---- growing the ground on one grid -----------------------------------------------------

  function Grower(w, h) {
    const n = w * h;
    const recv = new Int32Array(n), order = new Int32Array(n), cnt = new Int32Array(n + 1), start = new Int32Array(n + 1), donor = new Int32Array(n);
    const pits = new Int32Array(n);
    let pitN = 0;
    // Priority flood buffers (the fallback router).
    const F = new Float64Array(n), seen = new Uint8Array(n), hi = new Int32Array(n), hv = new Float64Array(n);
    // Dip-filling buffers.
    const mark = new Uint32Array(n), fHi = new Int32Array(n), fHv = new Float64Array(n), reg = new Int32Array(n), q = new Int32Array(n), dist = new Int32Array(n), inReg = new Uint32Array(n);
    let gen = 0;

    // Each tile drains to its steepest lower neighbor (8 ways); mouths drain off the map. The
    // order (mouths first) comes from walking up through donors. False if any tile is a dip.
    const OFF = D8X.map((dx, d) => D8Y[d] * w + dx);
    // One tile's steepest lower neighbor, or -1; `edge` checks each neighbor is on the map.
    function lowest(E, t, x, y, edge) {
      const e = E[t];
      let best = -1, bestS = 0;
      for (let d = 0; d < 8; d++) {
        if (edge) { const xx = x + D8X[d], yy = y + D8Y[d]; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; }
        const u = t + OFF[d], drop = e - E[u];
        if (drop <= 0) continue;
        const sl = d < 4 ? drop : drop * SQRT1_2;
        if (sl > bestS) { bestS = sl; best = u; }
      }
      return best;
    }
    function steepest(E, outlet) {
      cnt.fill(0); pitN = 0;
      for (let y = 0; y < h; y++) {
        const edgeRow = y === 0 || y === h - 1;
        for (let x = 0, t = y * w; x < w; x++, t++) {
          if (outlet[t]) { recv[t] = -1; continue; }
          const best = lowest(E, t, x, y, edgeRow || x === 0 || x === w - 1);
          if (best < 0) { pits[pitN++] = t; continue; }
          recv[t] = best; cnt[best]++;
        }
      }
      if (pitN) return false;
      start[0] = 0; for (let t = 0; t < n; t++) start[t + 1] = start[t] + cnt[t];
      cnt.fill(0);
      for (let t = 0; t < n; t++) { const r = recv[t]; if (r >= 0) donor[start[r] + cnt[r]++] = t; }
      let on = 0;
      for (let t = 0; t < n; t++) if (recv[t] < 0) order[on++] = t;
      for (let k = 0; k < on; k++) { const c = order[k]; for (let j = start[c]; j < start[c + 1]; j++) order[on++] = donor[j]; }
      return true;
    }

    // The full flood from the mouths (8 ways), lowest first: every tile drains to the tile it
    // was reached from, so water crosses dips to their spill.
    function flood(E, outlet) {
      recv.fill(-1); seen.fill(0);
      let hn = 0, on = 0;
      const push = (i, v) => { let k = hn++; while (k > 0) { const p = (k - 1) >> 1; if (hv[p] <= v) break; hi[k] = hi[p]; hv[k] = hv[p]; k = p; } hi[k] = i; hv[k] = v; };
      for (let t = 0; t < n; t++) if (outlet[t]) { seen[t] = 1; F[t] = E[t]; push(t, F[t]); }
      while (hn) {
        const c = hi[0];
        { const i = hi[--hn], v = hv[hn]; let k = 0; for (;;) { let c2 = 2 * k + 1; if (c2 >= hn) break; if (c2 + 1 < hn && hv[c2 + 1] < hv[c2]) c2++; if (hv[c2] >= v) break; hi[k] = hi[c2]; hv[k] = hv[c2]; k = c2; } hi[k] = i; hv[k] = v; }
        order[on++] = c;
        const cx = c % w, cy = (c / w) | 0;
        for (let d = 0; d < 8; d++) {
          const x = cx + D8X[d], y = cy + D8Y[d];
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const u = y * w + x;
          if (seen[u]) continue;
          seen[u] = 1; const f = E[u] > F[c] + 1e-6 ? E[u] : F[c] + 1e-6; F[u] = f; recv[u] = c; push(u, f);
        }
      }
    }

    // Fills the basin around dip t0 with what the water carries in, up to where it spills
    // (lower ground or a mouth), with a hair of slope down to the spill so water runs out.
    function fillDip(E, outlet, t0) {
      const g = ++gen;
      let hn = 0, rn = 0, level = E[t0], spill = -1;
      const push = (i, v) => { let k = hn++; while (k > 0) { const p = (k - 1) >> 1; if (fHv[p] <= v) break; fHi[k] = fHi[p]; fHv[k] = fHv[p]; k = p; } fHi[k] = i; fHv[k] = v; };
      const pop = () => { const top = fHi[0], i = fHi[--hn], v = fHv[hn]; let k = 0; for (;;) { let c = 2 * k + 1; if (c >= hn) break; if (c + 1 < hn && fHv[c + 1] < fHv[c]) c++; if (fHv[c] >= v) break; fHi[k] = fHi[c]; fHv[k] = fHv[c]; k = c; } fHi[k] = i; fHv[k] = v; return top; };
      const addNbs = c => { const cx = c % w, cy = (c / w) | 0; for (let d = 0; d < 8; d++) { const x = cx + D8X[d], y = cy + D8Y[d]; if (x < 0 || y < 0 || x >= w || y >= h) continue; const u = y * w + x; if (mark[u] === g) continue; mark[u] = g; push(u, E[u]); } };
      mark[t0] = g; reg[rn++] = t0; inReg[t0] = g; addNbs(t0);
      while (hn) {
        const u = pop();
        if (E[u] < level || outlet[u]) { spill = u; break; }
        level = E[u]; reg[rn++] = u; inReg[u] = g; addNbs(u);
        if (rn > FILL_REGION_MAX) return;
      }
      if (spill < 0) return;
      let qh = 0, qt = 0;
      const sx = spill % w, sy = (spill / w) | 0;
      for (let k = 0; k < rn; k++) {
        const t = reg[k]; dist[t] = -1;
        if (abs(t % w - sx) <= 1 && abs(((t / w) | 0) - sy) <= 1) { dist[t] = 1; q[qt++] = t; }
      }
      while (qh < qt) {
        const c = q[qh++], cx = c % w, cy = (c / w) | 0;
        for (let d = 0; d < 8; d++) {
          const x = cx + D8X[d], y = cy + D8Y[d];
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const u = y * w + x;
          if (inReg[u] !== g || dist[u] >= 0) continue;
          dist[u] = dist[c] + 1; q[qt++] = u;
        }
      }
      for (let k = 0; k < rn; k++) { const t = reg[k], e = level + 1e-6 * max(1, dist[t]); if (E[t] < e) E[t] = e; }
    }

    // `rounds` rounds of lifting, cutting and creeping, from `startE` (or almost flat ground
    // in the pattern's shape).
    function run(pat, outlet, S, rounds, startE) {
      const E = new Float64Array(n), up = new Float64Array(n), A = new Float64Array(n), lap = new Float64Array(n);
      const band = max(1, RIM_BAND * min(w, h));
      for (let t = 0; t < n; t++) {
        const x = t % w, y = (t / w) | 0;
        const e = max(0, 1 - min(x, y, w - 1 - x, h - 1 - y) / band);
        up[t] = outlet[t] ? 0 : UPLIFT * (UPLIFT_FLOOR + (1 - UPLIFT_FLOOR) * pat[t]) * (1 + RIM * e * e);
        E[t] = startE ? startE[t] : pat[t] * 0.01;
      }
      for (let r = 0; r < rounds; r++) {
        for (let t = 0; t < n; t++) E[t] += up[t];
        // Route: the steepest way down; a few dips filled; else the full flood.
        let ok = steepest(E, outlet);
        if (!ok && pitN <= FILL_MAX) { for (let k = 0; k < pitN; k++) fillDip(E, outlet, pits[k]); ok = steepest(E, outlet); }
        if (!ok) flood(E, outlet);
        A.fill(1);
        for (let k = n - 1; k >= 0; k--) { const c = order[k]; if (recv[c] >= 0) A[recv[c]] += A[c]; }
        // Stream power, implicit (so a tile never cuts below the one it drains to; a tile below
        // its outlet is raised toward it: a dip filling).
        for (let k = 0; k < n; k++) {
          const c = order[k], rc = recv[c];
          if (rc < 0) continue;
          const diag = c % w !== rc % w && ((c / w) | 0) !== ((rc / w) | 0);
          const f = S.RiverCut * (STREAM_M === 0.5 ? sqrt(A[c]) : pow(A[c], STREAM_M)) / (diag ? SQRT2 : 1);
          E[c] = (E[c] + f * E[rc]) / (1 + f);
        }
        // Creep: each tile moves toward the neighbors it has; mouths stay at sea level.
        if (S.HillSoften > 0) {
          for (let t = 0; t < n; t++) {
            if (outlet[t]) { lap[t] = 0; continue; }
            const x = t % w, y = (t / w) | 0;
            let sum = 0, k = 0;
            if (x > 0) { sum += E[t - 1]; k++; } if (x < w - 1) { sum += E[t + 1]; k++; }
            if (y > 0) { sum += E[t - w]; k++; } if (y < h - 1) { sum += E[t + w]; k++; }
            lap[t] = sum - k * E[t];
          }
          for (let t = 0; t < n; t++) E[t] += S.HillSoften * lap[t];
        }
      }
      return E;
    }
    return { run };
  }

  // The ground for a w × h world, 0..1 before stretching; coarse then fine.
  function growGround(w, h, pat, spots, S) {
    const fine = min(S.GrowRounds, FINE_ROUNDS), coarse = S.GrowRounds - fine;
    let startE = null;
    if (coarse > 0 && w >= 8 && h >= 8) {
      const cw = ceil(w / 2), ch = ceil(h / 2), small = new Float64Array(cw * ch);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) small[y * cw + x] = pat[min(h - 1, 2 * y) * w + min(w - 1, 2 * x)];
      const Ec = Grower(cw, ch).run(small, mouths(cw, ch, spots), S, coarse, null);
      startE = new Float64Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const fx = min(cw - 1.001, x / 2), fy = min(ch - 1.001, y / 2), ix = floor(fx), iy = floor(fy), u = fx - ix, v = fy - iy;
        const a = Ec[iy * cw + ix], b = Ec[iy * cw + ix + 1], c = Ec[(iy + 1) * cw + ix], d = Ec[(iy + 1) * cw + ix + 1];
        startE[y * w + x] = (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
      }
    }
    return Grower(w, h).run(pat, mouths(w, h, spots), S, startE ? fine : S.GrowRounds, startE);
  }

  // ---- water ------------------------------------------------------------------------------

  // The level water would rest at on every tile (4 ways, from the mouths): the first guess's
  // hollows.
  function restingLevel(W, outlet) {
    const n = W.n, E = W.elev, F = new Float64Array(n), seen = new Uint8Array(n), hi = new Int32Array(n), hv = new Float64Array(n), nb = new Int32Array(4);
    let hn = 0;
    const push = (i, v) => { let k = hn++; while (k > 0) { const p = (k - 1) >> 1; if (hv[p] <= v) break; hi[k] = hi[p]; hv[k] = hv[p]; k = p; } hi[k] = i; hv[k] = v; };
    for (let t = 0; t < n; t++) if (outlet[t]) { seen[t] = 1; F[t] = E[t]; push(t, F[t]); }
    while (hn) {
      const c = hi[0];
      { const i = hi[--hn], v = hv[hn]; let k = 0; for (;;) { let c2 = 2 * k + 1; if (c2 >= hn) break; if (c2 + 1 < hn && hv[c2 + 1] < hv[c2]) c2++; if (hv[c2] >= v) break; hi[k] = hi[c2]; hv[k] = hv[c2]; k = c2; } hi[k] = i; hv[k] = v; }
      for (let i = 0, k = W.neighbors4(c, nb); i < k; i++) {
        const u = nb[i];
        if (seen[u]) continue;
        seen[u] = 1; F[u] = max(E[u], F[c]); push(u, F[u]);
      }
    }
    return F;
  }

  // Labels the land (every tile wet[] leaves dry) by 4-connected piece, the way animals walk.
  function landPieces(W, wet) {
    const label = new Int32Array(W.n), queue = new Int32Array(W.n), nb = new Int32Array(4), sizes = [];
    for (let t0 = 0; t0 < W.n; t0++) {
      if (wet[t0] || label[t0]) continue;
      const id = sizes.length + 1;
      let head = 0, tail = 0;
      label[t0] = id; queue[tail++] = t0;
      while (head < tail) {
        const k = W.neighbors4(queue[head++], nb);
        for (let i = 0; i < k; i++) if (!wet[nb[i]] && !label[nb[i]]) { label[nb[i]] = id; queue[tail++] = nb[i]; }
      }
      sizes.push(tail);
    }
    return { label, sizes };
  }

  // This world's own terrain values, each drawn from its settings.csv span (Paul: every world
  // feels different, under the same rules), plus the settings that are single values. Drawn
  // first, from the ground's own generator, so a seed always makes the same ground.
  const SPANS = ['Relief', 'Hilliness', 'Roughness', 'Bowls', 'RiverMouths', 'Rain'];
  const WHOLE = ['Bowls', 'RiverMouths'];
  AS.terrainOf = function (sim, rng) {
    const S = Object.assign({}, sim.T.world);
    for (const k of SPANS) {
      const r = S[k];
      S[k] = r.min + rng.next() * (r.max - r.min);
      if (WHOLE.includes(k)) S[k] = round(S[k]);
    }
    sim.terrain = S;
    return S;
  };

  // The slow part, which needs nothing of the world but its size: the ground into W.elev and,
  // with `water`, the rules settled on it. Returns { S, outlet, wat }.
  function grow(sim, water) {
    const W = sim.W, rng = AS.makeRng((sim.seed ^ SEED_SALT) >>> 0);
    const S = AS.terrainOf(sim, rng);
    const spots = [];
    for (let i = 0; i < max(1, S.RiverMouths); i++) spots.push(rng.next());
    const pat = pattern(W.w, W.h, S, rng);
    const G0 = S.GrowRounds > 0 ? growGround(W.w, W.h, pat, spots, S) : pat;
    // Stretched to 0..Relief, so basins press in to depths in meters; then stretched again below.
    let lo = Infinity, hi = -Infinity;
    for (let t = 0; t < W.n; t++) { if (G0[t] < lo) lo = G0[t]; if (G0[t] > hi) hi = G0[t]; }
    const E = W.elev, k = hi > lo ? S.Relief / (hi - lo) : 0;
    for (let t = 0; t < W.n; t++) E[t] = (G0[t] - lo) * k;
    const margin = min(BOWL_MARGIN, min(W.w, W.h) / 10);
    for (let i = 0; i < S.Bowls; i++) {
      const bx = margin + rng.next() * max(0, W.w - 2 * margin), by = margin + rng.next() * max(0, W.h - 2 * margin);
      const br = BOWL_RADIUS[0] + rng.next() * (BOWL_RADIUS[1] - BOWL_RADIUS[0]), bd = (BOWL_DEPTH[0] + rng.next() * (BOWL_DEPTH[1] - BOWL_DEPTH[0])) * S.Relief;
      for (let y = max(0, floor(by - 2 * br)); y <= min(W.h - 1, ceil(by + 2 * br)); y++) {
        for (let x = max(0, floor(bx - 2 * br)); x <= min(W.w - 1, ceil(bx + 2 * br)); x++) {
          const q = ((x - bx) ** 2 + (y - by) ** 2) / (br * br);
          if (q < 4) E[y * W.w + x] -= bd * exp(-q * BOWL_FALLOFF);
        }
      }
    }
    // Stretched again, so lowest to highest is exactly Relief with the basins in.
    lo = Infinity; hi = -Infinity;
    for (let t = 0; t < W.n; t++) { if (E[t] < lo) lo = E[t]; if (E[t] > hi) hi = E[t]; }
    const k2 = hi > lo ? S.Relief / (hi - lo) : 0;
    for (let t = 0; t < W.n; t++) E[t] = (E[t] - lo) * k2;
    if (!water) return { S, outlet: null, wat: null };

    // The water: a rough first guess, then the rules for PreRunDays. A world with no rain
    // still gets the rules (dry), so water poured into it flows.
    const outlet = mouths(W.w, W.h, spots);
    const wat = AS.Water(W, S, outlet);
    if (!(S.Rain > 0)) return { S, outlet, wat };
    const F = restingLevel(W, outlet);
    for (let t = 0; t < W.n; t++) {
      const d = (F[t] - E[t]) * GUESS_FULL;
      wat.H[t] = d > AS.WATER_TINY ? d : 0;
      wat.G[t] = wat.H[t] > 0 ? wat.room : wat.room * 0.5;
    }
    wat.listWet();
    wat.preRun(S.PreRunDays);
    return { S, outlet, wat };
  }

  // grow() as plain arrays, for a worker to send back (main.js, terrain-worker.js): the same
  // seed and tables make the same numbers wherever it runs.
  AS.growTerrain = function (sim, water) {
    const { S, outlet, wat } = grow(sim, water);
    return { S, water: !!water, elev: sim.W.elev, outlet, H: wat ? wat.H : null, G: wat ? wat.G : null };
  };

  // Every world: the ground; with `water`, the water the rules settle on it (world.js
  // addWater, W.wDepth). `grown` is growTerrain's result for this seed, made elsewhere, or
  // left out to grow it here. Returns the centers of the lakes (bodies of water of LAKE_MIN
  // tiles or more).
  const LAKE_MIN = 40;
  AS.layTerrain = function (sim, water, grown) {
    const W = sim.W;
    let S, outlet, wat;
    if (grown && grown.water === !!water) {
      sim.terrain = S = grown.S;
      W.elev.set(grown.elev);
      outlet = grown.outlet;
      if (outlet) {
        wat = AS.Water(W, S, outlet);
        if (grown.H) { wat.H.set(grown.H); wat.G.set(grown.G); wat.listWet(); }
      }
    } else ({ S, outlet, wat } = grow(sim, water));
    if (!water) return [];
    W.outlet = outlet;
    if (!(S.Rain > 0)) { W.water = wat; return []; }
    const wet = new Uint8Array(W.n);
    for (let t = 0; t < W.n; t++) {
      if (!(wat.H[t] > 0)) continue;
      wet[t] = 1;
      W.addWater(t, wat.H[t]);
    }
    W.water = wat;   // after laying it, which would otherwise copy each tile back into it
    // The lakes' centers: bodies of water LAKE_MIN tiles or more.
    const { label, sizes } = landPieces(W, wet.map(v => (v ? 0 : 1)));
    const sx = new Float64Array(sizes.length), sy = new Float64Array(sizes.length);
    for (let t = 0; t < W.n; t++) if (label[t]) { sx[label[t] - 1] += t % W.w; sy[label[t] - 1] += (t / W.w) | 0; }
    const lakes = [];
    for (let i = 0; i < sizes.length; i++) if (sizes[i] >= LAKE_MIN) lakes.push({ x: sx[i] / sizes[i], y: sy[i] / sizes[i] });
    return lakes;
  };

  AS.terrainShape = Object.freeze({ landPieces });   // for checks
})(globalThis.AS);
