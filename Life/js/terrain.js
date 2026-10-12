// The ground's height, and the water that comes from it (Paul, 11 Oct 2026). Every tile gets
// an elevation in meters (W.elev, 0 to Relief): rolling hills from noise, with a few broad
// bowls pressed in. Water isn't placed: it settles where the ground holds it and runs
// downhill. A priority flood from the world's edges (water leaves the map there) finds the
// level water would stand at on every tile; each bowl that level makes fills Rain of the way
// from its floor to its brim, and is a lake where it is at least LakeDepth deep. Summing one
// unit of rain per tile down the way water drains gives how much ground drains through each
// tile: RiverDrain or more is a river, wider where it drains much more. The first frame is the settled world; nothing
// flows in from random spots.
//
// Rivers get fords every BridgeEvery tiles along their length, and the land is then made one
// piece, as the hand-laid lakes and rivers were: a cut-off piece is bridged across the
// shortest run of river (or, failing that, of lake), or filled in if it is small.
//
// Uses its own generator, seeded from the world's seed, so the ground doesn't shift when
// anything that draws on sim.rng changes. sim.js calls AS.layTerrain for every world.
(function (AS) {
  'use strict';

  // ---- the shape of the ground (look, not tuning: these only make it look natural) ----
  const OCTAVES = 5;              // hills with smaller hills on them
  const WARP_SCALE = 90;          // tiles: how broad the bends in ridges and valleys are
  const WARP = 18;                // tiles: how far they bend
  const WARP_STEP = 4;            // tiles between the points the warp is worked out at
  const BOWL_RADIUS = [14, 46];   // tiles: how wide a bowl is (its dip fades out past that)
  const BOWL_DEPTH = [0.18, 0.40]; // a bowl's depth as a share of the noise's range
  const BOWL_MARGIN = 30;         // tiles a bowl's center keeps from the wall (less in a small world)
  const BOWL_FALLOFF = 1.6;       // how quickly a bowl's dip fades with distance
  const FLOOD_EPS = 1e-4;         // m: the slope the flood gives a flat, so every tile drains somewhere
  const WIDE_RIVER = 4;           // a river draining this many times RiverDrain is two tiles wide
  const FORD_LEN = 3;             // tiles of clear land a ford leaves along the river
  const POCKET_MAX = 40;
  const SPILL_PASSES = 8;         // rounds of hollows filling and spilling into the next ones down          // a cut-off land piece this small is filled in rather than bridged
  const BRIDGE_TRIES = 40;        // land pieces mended before giving up
  const SEED_SALT = 0x5eed7e44;   // keeps the ground's generator apart from sim.rng

  const K = AS.KIND;
  const LAKE = 1, RIVER = 2;      // wet[] values

  // Octaves of lattice noise, each half the scale and `gain` times the weight of the last,
  // evaluated with plain loops over typed arrays: it runs once per tile.
  function fbm(rng, w, h, scale, octaves, gain) {
    const lat = [], gws = [], inv = [], amps = [];
    let amp = 1, sum = 0;
    for (let o = 0; o < octaves; o++) {
      const sc = Math.max(1, scale / (1 << o)), gw = Math.ceil(w / sc) + 2, gh = Math.ceil(h / sc) + 2;
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

  // W.elev: hills, bowls pressed in, then stretched to 0..Relief meters.
  function elevation(W, S, rng) {
    const pad = WARP + 2;   // the warp can look up to WARP tiles outside the world
    const hills = fbm(rng, W.w + 2 * pad, W.h + 2 * pad, S.Hilliness, OCTAVES, S.Roughness);
    const wx = fbm(rng, W.w + 2 * pad, W.h + 2 * pad, WARP_SCALE, 2, 0.5);
    const wy = fbm(rng, W.w + 2 * pad, W.h + 2 * pad, WARP_SCALE, 2, 0.5);
    const margin = Math.min(BOWL_MARGIN, Math.min(W.w, W.h) / 10), bowls = [];
    for (let i = 0; i < S.Bowls; i++) {
      bowls.push({
        x: margin + rng.next() * Math.max(0, W.w - 2 * margin), y: margin + rng.next() * Math.max(0, W.h - 2 * margin),
        r: BOWL_RADIUS[0] + rng.next() * (BOWL_RADIUS[1] - BOWL_RADIUS[0]), d: BOWL_DEPTH[0] + rng.next() * (BOWL_DEPTH[1] - BOWL_DEPTH[0]),
      });
    }
    const E = W.elev;
    // The warp bends slowly (WARP_SCALE), so it is worked out every WARP_STEP tiles and
    // blended between: the same ground for a fraction of the work.
    const gw = Math.ceil((W.w - 1) / WARP_STEP) + 2, gh = Math.ceil((W.h - 1) / WARP_STEP) + 2;
    const gx = new Float32Array(gw * gh), gy = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const px = i * WARP_STEP + pad, py = j * WARP_STEP + pad;
      gx[j * gw + i] = WARP * (2 * wx(px, py) - 1);
      gy[j * gw + i] = WARP * (2 * wy(px, py) - 1);
    }
    for (let y = 0; y < W.h; y++) {
      const fj = y / WARP_STEP, j = Math.floor(fj), v = fj - j;
      for (let x = 0; x < W.w; x++) {
        const fi = x / WARP_STEP, i = Math.floor(fi), u = fi - i, g = j * gw + i;
        const dx = (gx[g] * (1 - u) + gx[g + 1] * u) * (1 - v) + (gx[g + gw] * (1 - u) + gx[g + gw + 1] * u) * v;
        const dy = (gy[g] * (1 - u) + gy[g + 1] * u) * (1 - v) + (gy[g + gw] * (1 - u) + gy[g + gw + 1] * u) * v;
        E[y * W.w + x] = hills(x + pad + dx, y + pad + dy);
      }
    }
    // Each bowl only touches the ground within twice its radius, where its dip is still felt.
    for (const b of bowls) {
      const reach = 2 * b.r;
      for (let y = Math.max(0, Math.floor(b.y - reach)); y <= Math.min(W.h - 1, Math.ceil(b.y + reach)); y++) {
        for (let x = Math.max(0, Math.floor(b.x - reach)); x <= Math.min(W.w - 1, Math.ceil(b.x + reach)); x++) {
          const q = ((x - b.x) ** 2 + (y - b.y) ** 2) / (b.r * b.r);
          if (q < 4) E[y * W.w + x] -= b.d * Math.exp(-q * BOWL_FALLOFF);
        }
      }
    }
    let lo = Infinity, hi = -Infinity;
    for (let t = 0; t < W.n; t++) { if (E[t] < lo) lo = E[t]; if (E[t] > hi) hi = E[t]; }
    const k = hi > lo ? S.Relief / (hi - lo) : 0;
    for (let t = 0; t < W.n; t++) E[t] = (E[t] - lo) * k;
  }

  // The priority flood from the edges. Returns the level water would stand at on each tile
  // (F) and each tile's drain (recv: the tile it was reached from, -1 at the edge).
  function flood(W) {
    const E = W.elev, n = W.n, F = new Float32Array(n), recv = new Int32Array(n).fill(-1);
    const seen = new Uint8Array(n), nb = new Int32Array(4);
    const hi = new Int32Array(n), hv = new Float32Array(n);
    let hn = 0;
    const push = (i, v) => {
      let k = hn++;
      while (k > 0) { const p = (k - 1) >> 1; if (hv[p] <= v) break; hi[k] = hi[p]; hv[k] = hv[p]; k = p; }
      hi[k] = i; hv[k] = v;
    };
    const pop = () => {
      const top = hi[0], i = hi[--hn], v = hv[hn];
      let k = 0;
      for (;;) {
        let c = 2 * k + 1;
        if (c >= hn) break;
        if (c + 1 < hn && hv[c + 1] < hv[c]) c++;
        if (hv[c] >= v) break;
        hi[k] = hi[c]; hv[k] = hv[c]; k = c;
      }
      hi[k] = i; hv[k] = v;
      return top;
    };
    for (let t = 0; t < n; t++) {
      const x = t % W.w, y = (t / W.w) | 0;
      if (x === 0 || y === 0 || x === W.w - 1 || y === W.h - 1) { seen[t] = 1; F[t] = E[t]; push(t, F[t]); }
    }
    while (hn) {
      const c = pop();
      for (let i = 0, k = W.neighbors4(c, nb); i < k; i++) {
        const u = nb[i];
        if (seen[u]) continue;
        seen[u] = 1; F[u] = Math.max(E[u], F[c] + FLOOD_EPS); recv[u] = c; push(u, F[u]);
      }
    }
    return { F, recv };
  }

  // Lakes and rivers into wet[]. A hollow (a connected patch the flood raised) fills from its
  // floor toward its brim by how much rain reaches it: Rain times the square root of how many
  // tiles drain into it per tile of its own, so a hollow fed by a big catchment fills more.
  // One that fills spills over its rim, and its water runs on downhill, maybe into the next
  // hollow; one that doesn't is where its water ends. Inside a hollow that isn't full water
  // runs down the real slope to the floor; inside a full one it is under the lake on its way
  // to the rim; elsewhere it follows the flood's drain. Each pass finds the hollows that are
  // now full, until no more fill. A tile that RiverDrain tiles or more drain through, out of
  // the water, is river, two wide past WIDE_RIVER times that, with a ford every BridgeEvery
  // tiles along it. Returns the lakes' centers.
  function settleWater(W, S, F, recv, wet) {
    const n = W.n, E = W.elev, nb = new Int32Array(4);
    const raised = t => F[t] - E[t] > FLOOD_EPS * 10;
    // The hollows: id per tile (-1 outside one), each one's floor, brim and size.
    const bowl = new Int32Array(n).fill(-1), floor = [], brim = [], size = [], stack = [];
    for (let t0 = 0; t0 < n; t0++) {
      if (bowl[t0] >= 0 || !raised(t0)) continue;
      const id = floor.length;
      let lo = E[t0], hi = F[t0], c0 = 0;
      bowl[t0] = id; stack.push(t0);
      while (stack.length) {
        const c = stack.pop();
        c0++;
        if (E[c] < lo) lo = E[c];
        if (F[c] > hi) hi = F[c];
        for (let i = 0, k = W.neighbors4(c, nb); i < k; i++) if (bowl[nb[i]] < 0 && raised(nb[i])) { bowl[nb[i]] = id; stack.push(nb[i]); }
      }
      floor.push(lo); brim.push(hi); size.push(c0);
    }
    const full = new Uint8Array(floor.length), fill = new Float64Array(floor.length);
    const down = new Int32Array(n), key = new Float32Array(n), order = new Int32Array(n), drain = new Float32Array(n);
    for (let pass = 0; ; pass++) {
      for (let t = 0; t < n; t++) {
        const b = bowl[t];
        if (b < 0 || full[b]) { down[t] = recv[t]; key[t] = F[t]; continue; }
        let best = -1, low = E[t];
        for (let i = 0, k = W.neighbors4(t, nb); i < k; i++) if (E[nb[i]] < low) { low = E[nb[i]]; best = nb[i]; }
        down[t] = best; key[t] = E[t];
      }
      // Every drain goes to a lower key, so highest first passes each tile's rain on in time.
      for (let t = 0; t < n; t++) order[t] = t;
      order.sort((a, b) => key[b] - key[a]);
      drain.fill(1);
      const into = new Float64Array(floor.length);
      for (let k = 0; k < n; k++) {
        const c = order[k], d = down[c];
        if (d >= 0) drain[d] += drain[c];
        else if (bowl[c] >= 0 && !full[bowl[c]]) into[bowl[c]] += drain[c];   // pools on the floor
      }
      let more = false;
      for (let b = 0; b < floor.length; b++) {
        if (full[b]) continue;
        fill[b] = S.Rain * Math.sqrt(into[b] / size[b]);
        if (fill[b] >= 1 && brim[b] - floor[b] >= S.LakeDepth) { full[b] = 1; more = true; }
      }
      if (!more || pass >= SPILL_PASSES) break;
    }
    // Lakes: each hollow at least LakeDepth deep, to its floor plus its fill of its depth.
    const sx = new Float64Array(floor.length), sy = new Float64Array(floor.length), cnt = new Int32Array(floor.length);
    for (let t = 0; t < n; t++) {
      const b = bowl[t];
      if (b < 0 || brim[b] - floor[b] < S.LakeDepth || !(S.Rain > 0)) continue;
      const level = full[b] ? brim[b] : floor[b] + Math.min(1, fill[b]) * (brim[b] - floor[b]);
      if (E[t] <= level || full[b]) { wet[t] = LAKE; sx[b] += t % W.w; sy[b] += (t / W.w) | 0; cnt[b]++; }
    }
    const lakes = [];
    for (let b = 0; b < floor.length; b++) if (cnt[b]) lakes.push({ x: sx[b] / cnt[b], y: sy[b] / cnt[b] });
    if (!(S.RiverDrain > 0)) return lakes;
    // How far down its river each river tile is, from the river's source: a ford is where
    // that comes round to a multiple of BridgeEvery.
    const along = new Int32Array(n), river = new Uint8Array(n);
    for (let t = 0; t < n; t++) if (!wet[t] && drain[t] >= S.RiverDrain) river[t] = 1;
    for (let k = 0; k < n; k++) {
      const c = order[k], r = down[c];
      if (river[c] && r >= 0 && river[r]) along[r] = Math.max(along[r], along[c] + 1);
    }
    const every = Math.max(FORD_LEN + 1, Math.round(S.BridgeEvery));
    for (let t = 0; t < n; t++) {
      if (!river[t] || along[t] % every < FORD_LEN) continue;
      wet[t] = RIVER;
      // A big river is two tiles wide: across its flow, onto the lower side.
      if (drain[t] >= S.RiverDrain * WIDE_RIVER && down[t] >= 0) {
        const x = t % W.w, y = (t / W.w) | 0, across = down[t] % W.w !== x;   // flowing sideways: widen up or down
        const a = across ? (y > 0 ? t - W.w : -1) : (x > 0 ? t - 1 : -1);
        const b = across ? (y < W.h - 1 ? t + W.w : -1) : (x < W.w - 1 ? t + 1 : -1);
        const side = a < 0 ? b : b < 0 ? a : (E[a] <= E[b] ? a : b);
        if (side >= 0 && !wet[side]) wet[side] = RIVER;
      }
    }
    return lakes;
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

  // Joins land piece `from` to another by turning the shortest run of wet tiles between them
  // (river only, or any water when `anyWet`) into land. Returns whether it found one.
  function bridgePiece(W, wet, label, from, anyWet) {
    const prev = new Int32Array(W.n).fill(-2), queue = new Int32Array(W.n), nb = new Int32Array(4);
    let head = 0, tail = 0;
    for (let t = 0; t < W.n; t++) if (label[t] === from) { prev[t] = -1; queue[tail++] = t; }
    while (head < tail) {
      const t = queue[head++], k = W.neighbors4(t, nb);
      for (let i = 0; i < k; i++) {
        const u = nb[i];
        if (prev[u] !== -2) continue;
        if (label[u] && label[u] !== from) {
          for (let v = t; v >= 0 && wet[v]; v = prev[v]) wet[v] = 0;
          return true;
        }
        if (wet[u] === RIVER || (anyWet && wet[u])) { prev[u] = t; queue[tail++] = u; }
      }
    }
    return false;
  }

  // Makes the land one piece: the smallest piece is bridged to another across river, else
  // across any water, else filled if it is small.
  function keepLandWhole(W, wet) {
    for (let n = 0; n < BRIDGE_TRIES; n++) {
      const { label, sizes } = landPieces(W, wet);
      if (sizes.length <= 1) return;
      let small = 0;
      for (let i = 1; i < sizes.length; i++) if (sizes[i] < sizes[small]) small = i;
      if (bridgePiece(W, wet, label, small + 1, false)) continue;
      if (sizes[small] <= POCKET_MAX) {
        for (let t = 0; t < W.n; t++) if (label[t] === small + 1) wet[t] = LAKE;
        continue;
      }
      if (!bridgePiece(W, wet, label, small + 1, true)) return;
    }
  }

  // This world's own terrain values, each drawn from its settings.csv span (Paul: every world
  // feels different, under the same rules), plus the settings that are single values. Drawn
  // first, from the ground's own generator, so a seed always makes the same ground.
  const SPANS = ['Relief', 'Hilliness', 'Roughness', 'Bowls', 'LakeDepth', 'Rain', 'RiverDrain'];
  AS.terrainOf = function (sim, rng) {
    const S = Object.assign({}, sim.T.world);
    for (const k of SPANS) {
      const r = S[k];
      S[k] = r.min + rng.next() * (r.max - r.min);
      if (k === 'Bowls') S[k] = Math.round(S[k]);
    }
    sim.terrain = S;
    return S;
  };

  // Every world: the elevation; with `water`, the lakes and rivers it makes (world.js
  // addWater) and the shore the grass is boosted along. Returns the lakes' centers.
  AS.layTerrain = function (sim, water) {
    const { W, T } = sim, rng = AS.makeRng((sim.seed ^ SEED_SALT) >>> 0);
    const S = AS.terrainOf(sim, rng);
    elevation(W, S, rng);
    if (!water) return [];
    const { F, recv } = flood(W);
    const wet = new Uint8Array(W.n);
    const lakes = settleWater(W, S, F, recv, wet);
    keepLandWhole(W, wet);
    for (let t = 0; t < W.n; t++) if (wet[t]) W.addWater(t);
    W.setShore(T.grass.WaterRadius, T.grass.WaterBoost);
    return lakes;
  };

  AS.terrainShape = Object.freeze({ landPieces });   // for checks
})(globalThis.AS);
