// How the world looks on day 0 when settings.csv's StartLayout is Meadows: grass in
// meadows of every size with open ground between (the look of temperate grassland from the
// air), partly filled and of every age, as a settled meadow is; bunnies in a few colonies
// just outside meadow edges, each colony with a few warren holes dug around it before its
// bunnies settle; wolves in small packs out in the open, away from the colonies. Water (lakes,
// then little rivers: the Lakes and Rivers settings) goes in first, so the meadows, the colonies
// and the packs are laid on land.
// Paul chose this over scattering everything evenly, which reads as a random, empty world.
//
// Uses only sim.rng, so a seed replays the same start in the page, the harness and the lab.
// sim.js calls AS.startMeadows from populate(); nothing else does.
(function (AS) {
  'use strict';

  const K = AS.KIND;

  // ---- shape of the layout (not tuning numbers: these only make the start look natural) ----
  const OCTAVES = 4;            // meadow edges: big shapes with smaller wiggles on them
  const MEADOW_FILL = 0.55;     // share of meadow tiles that start with a blade: a settled meadow has gaps, which it needs to reseed
  const STRAY_BLADES = 0.004;   // lone seedlings out in the open, per open tile
  const COLONY_SPREAD = 3.5;    // tiles: how far a colony's bunnies scatter from its center
  const PACK_SPREAD = 1.6;      // tiles: a pack starts close together
  const COLONY_GAP = 28;        // tiles between colony centers, at least
  const PACK_GAP = 45;          // tiles between packs
  const PACK_FROM_COLONY = 22;  // tiles from a pack to the nearest colony, at least
  const EDGE_BAND = 0.08;       // field units just outside a meadow where colonies settle
  const BORDER = 6;             // tiles: no colony or pack centered this close to the wall
  const LAKE_STRETCH = 1.5;     // a lake's long axis is at most this many times its short one, at a random angle
  const LAKE_WARP = 0.4;        // how far noise pushes a lake's shore in or out, as a share of its radius
  const LAKE_WARP_SCALE = 3;    // the shore's wiggles are LakeSize / this many tiles wide
  const LAKE_SIZE_SPREAD = 0.3; // each lake's radius varies by up to this share around LakeSize / 2
  const LAKE_EDGE = 5;          // tiles of land kept between a lake and the world's wall
  const LAKE_GAP = 6;           // tiles of land kept between two lakes
  const LAKE_TRIES = 30;        // placements tried per lake wanted before giving up on the rest
  const POCKET_MAX = 40;        // a land pocket this small that a lake cuts off is filled in; a bigger one rejects the lake
  const RIVER_SCALE = 14;       // tiles: how long a river's bends are
  const RIVER_MEANDER = 1.0;    // radians the river's aim swings to either side of straight at its goal, by the noise
  const RIVER_STEER = 0.2;      // share of the turn toward that aim taken each step: smooth bends, and it still gets there
  const RIVER_MIN_STEPS = 8;    // a river this long before it may stop on reaching a lake
  const RIVER_LAKE_SHARE = 0.5; // share of rivers that run to a lake rather than across the map
  const RIVER_START = [0.2, 0.8];   // where along its edge a river starts, as shares of the edge
  const FORD_LEN = [3, 4];      // tiles of clear land a ford leaves, along the river
  const BRIDGE_TRIES = 12;      // land pieces a river may cut off and need mending, before the river is dropped
  const SPOT_TRIES = 4000;
  const UNLIKELY = 0.02;        // chance a spot that misses its preferred ground is taken anyway

  // Value noise on a lattice `scale` tiles apart, smoothstep-blended; octaves halve the scale.
  function noise(rng, w, h, scale) {
    const gw = Math.ceil(w / scale) + 2, gh = Math.ceil(h / scale) + 2;
    const g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = rng.next();
    const s = u => u * u * (3 - 2 * u);
    return (x, y) => {
      const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy);
      const u = s(fx - ix), v = s(fy - iy), i = iy * gw + ix;
      const a = g[i] + (g[i + 1] - g[i]) * u, b = g[i + gw] + (g[i + gw + 1] - g[i + gw]) * u;
      return a + (b - a) * v;
    };
  }
  function meadowField(sim) {
    const { W, rng } = sim, scale = sim.T.world.MeadowSize;
    const layers = [];
    for (let o = 0; o < OCTAVES; o++) layers.push(noise(rng, W.w, W.h, Math.max(1, scale / (1 << o))));
    const vals = new Float32Array(W.n);
    for (let t = 0; t < W.n; t++) {
      const x = t % W.w, y = (t / W.w) | 0;
      let v = 0, amp = 1, sum = 0;
      for (const n of layers) { v += n(x, y) * amp; sum += amp; amp *= 0.5; }
      vals[t] = v / sum;
    }
    return vals;
  }

  // The field value above which the top `cover` share of land tiles lies (lakes aren't land).
  function threshold(vals, cover, W) {
    const land = [];
    for (let t = 0; t < W.n; t++) if (W.kind[t] !== K.WATER) land.push(vals[t]);
    const sorted = Float32Array.from(land).sort();
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * (1 - cover)))];
  }

  function plantGrass(sim, vals, th) {
    const { W, rng } = sim, g = sim.T.grass;
    const range = Math.max(1e-6, 1 - th);
    for (let t = 0; t < W.n; t++) {
      if (W.kind[t] !== K.EMPTY || W.beach[t]) continue;   // the beach stays bare, for drinking
      const d = (vals[t] - th) / range;
      let age = -1;
      if (d >= 0) {
        // Ages spread evenly over the Lifespan, as in a meadow that has been growing a
        // while, so blades die a few at a time instead of all at once.
        if (rng.next() < MEADOW_FILL) age = rng.next() * g.Lifespan;
      } else if (rng.next() < STRAY_BLADES) {
        age = rng.next() * g.TimeToMature;
      }
      if (age >= 0) W.addGrass(t, Math.min(1, g.SproutSize + age * g.GrowthRate), age);
    }
  }

  // `n` spots at least `gap` tiles apart, preferring tiles where `likes(t)` is true.
  function pickSpots(sim, n, gap, likes) {
    const { W, rng } = sim, spots = [];
    for (let tries = 0; spots.length < n && tries < SPOT_TRIES; tries++) {
      const t = rng.int(W.n), x = t % W.w, y = (t / W.w) | 0;
      if (x < BORDER || y < BORDER || x >= W.w - BORDER || y >= W.h - BORDER) continue;
      if (W.kind[t] === K.WATER) continue;
      if (!likes(t) && rng.next() > UNLIKELY) continue;
      if (spots.some(s => (s.x - x) ** 2 + (s.y - y) ** 2 < gap * gap)) continue;
      spots.push({ x, y });
    }
    return spots;
  }

  // `count` animals scattered (gaussian, `spread` tiles) around a center, on empty tiles.
  function settle(sim, species, c, count, spread, bodies) {
    const { W, rng } = sim;
    let placed = 0;
    for (let tries = 0; placed < count && tries < count * 60; tries++) {
      const r = spread * Math.sqrt(-2 * Math.log(1 - rng.next())), a = rng.next() * Math.PI * 2;
      const x = Math.round(c.x + r * Math.cos(a)), y = Math.round(c.y + r * Math.sin(a));
      if (!W.inside(x, y)) continue;
      const t = W.tile(x, y);
      if (W.kind[t] !== K.EMPTY) continue;
      if (W.hole[t] && !AS.canEnterHole(species)) continue;   // a hole is a wall to all but bunnies
      AS.spawnStarting(sim, species, t, bodies);
      placed++;
    }
  }
  // `count` warren holes scattered (gaussian, `spread` tiles) around a colony's center, on
  // bare ground. Dug before the bunnies settle, so some start standing on one.
  function digHoles(sim, c, count, spread) {
    const { W, rng } = sim;
    let dug = 0;
    for (let tries = 0; dug < count && tries < count * 60; tries++) {
      const r = spread * Math.sqrt(-2 * Math.log(1 - rng.next())), a = rng.next() * Math.PI * 2;
      const x = Math.round(c.x + r * Math.cos(a)), y = Math.round(c.y + r * Math.sin(a));
      if (!W.inside(x, y)) continue;
      const t = W.tile(x, y);
      if (W.kind[t] !== K.EMPTY || W.hole[t]) continue;
      W.addHole(t, 0);
      dug++;
    }
  }
  // `total` split as evenly as possible over `groups`.
  const share = (total, groups, i) => Math.floor(total / groups) + (i < total % groups ? 1 : 0);

  // ---- lakes ----

  // Labels the land (every tile `wet` leaves dry) by 4-connected piece, the way animals walk.
  // Returns the piece sizes (index = label - 1) and each tile's label (0 = water).
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

  // wet[] values: LAKE and RIVER tiles become water once everything is laid.
  const LAKE = 1, RIVER = 2;

  // Lays `Lakes` lakes of about `LakeSize` tiles across into `wet`. Each is a circle stretched
  // to an ellipse at a random angle, its shore pushed in and out by noise. Nothing may be
  // landlocked: after a lake goes in, any piece of land it cut off that is small is filled with
  // water, and a lake that cuts off a bigger one is dropped and another tried. Returns the
  // lakes' centers.
  function layLakes(sim, wet) {
    const { W, rng, T } = sim, S = T.world, lakes = [];
    if (!(S.Lakes > 0)) return lakes;
    const warp = noise(rng, W.w, W.h, Math.max(1, S.LakeSize / LAKE_WARP_SCALE));
    for (let tries = 0; lakes.length < S.Lakes && tries < S.Lakes * LAKE_TRIES; tries++) {
      const R = S.LakeSize / 2 * (1 + LAKE_SIZE_SPREAD * (2 * rng.next() - 1));
      const k = 1 + (LAKE_STRETCH - 1) * rng.next(), A = R * Math.sqrt(k), B = R / Math.sqrt(k);
      const ang = rng.next() * Math.PI, cs = Math.cos(ang), sn = Math.sin(ang);
      const reach = Math.ceil(A * (1 + LAKE_WARP)), margin = reach + LAKE_EDGE;
      const cx = margin + rng.next() * (W.w - 1 - 2 * margin), cy = margin + rng.next() * (W.h - 1 - 2 * margin);
      if (!(cx >= margin && cy >= margin)) continue;   // the world is too small for this lake
      if (lakes.some(l => Math.hypot(l.x - cx, l.y - cy) < l.reach + reach + LAKE_GAP)) continue;
      const mine = [];
      for (let y = Math.max(0, Math.floor(cy) - reach); y <= Math.min(W.h - 1, Math.ceil(cy) + reach); y++) {
        for (let x = Math.max(0, Math.floor(cx) - reach); x <= Math.min(W.w - 1, Math.ceil(cx) + reach); x++) {
          const dx = x - cx, dy = y - cy, u = (dx * cs + dy * sn) / A, v = (dy * cs - dx * sn) / B;
          if (Math.hypot(u, v) < 1 + LAKE_WARP * (2 * warp(x, y) - 1)) mine.push(y * W.w + x);
        }
      }
      for (const t of mine) wet[t] = LAKE;
      const { label, sizes } = landPieces(W, wet);
      let main = 0;
      for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[main]) main = i;
      const pockets = sizes.map((n, i) => (i === main ? 0 : n));
      if (sizes.length === 0 || Math.max(...pockets) > POCKET_MAX) { for (const t of mine) wet[t] = 0; continue; }
      if (sizes.length > 1) for (let t = 0; t < W.n; t++) if (label[t] && label[t] !== main + 1) wet[t] = LAKE;
      lakes.push({ x: cx, y: cy, reach });
    }
    return lakes;
  }

  // Joins the land piece `from` (a label in `label`) to another by turning the shortest run of
  // river tiles between them into land: a breadth-first search from the piece through river
  // tiles only, stopping at any land with another label. Returns whether it found one.
  function bridgePiece(W, wet, label, from) {
    const prev = new Int32Array(W.n).fill(-2), queue = new Int32Array(W.n), nb = new Int32Array(4);
    let head = 0, tail = 0;
    for (let t = 0; t < W.n; t++) if (label[t] === from) { prev[t] = -1; queue[tail++] = t; }
    while (head < tail) {
      const t = queue[head++], k = W.neighbors4(t, nb);
      for (let i = 0; i < k; i++) {
        const u = nb[i];
        if (prev[u] !== -2) continue;
        if (label[u] && label[u] !== from) {   // dry land of another piece: the way back is the bridge
          for (let v = t; v >= 0 && wet[v]; v = prev[v]) wet[v] = 0;
          return true;
        }
        if (wet[u] === RIVER) { prev[u] = t; queue[tail++] = u; }
      }
    }
    return false;
  }

  // After a river: if the land is in pieces, bridge the smallest back to the rest, or fill it
  // if it is a small pocket no river tile touches. False if that can't be done (the caller
  // drops the river).
  function keepLandWhole(W, wet) {
    for (let n = 0; n < BRIDGE_TRIES; n++) {
      const { label, sizes } = landPieces(W, wet);
      if (sizes.length <= 1) return sizes.length === 1;
      let small = -1;
      for (let i = 0; i < sizes.length; i++) if (small < 0 || sizes[i] < sizes[small]) small = i;
      if (bridgePiece(W, wet, label, small + 1)) continue;
      if (sizes[small] > POCKET_MAX) return false;
      for (let t = 0; t < W.n; t++) if (label[t] === small + 1) wet[t] = RIVER;
    }
    return landPieces(W, wet).sizes.length === 1;
  }

  // Lays `Rivers` rivers, each `RiverWidth` tiles wide: a walk that starts at a world edge and
  // wanders (noise-steered) toward the opposite side or toward a lake, stopping at the wall or
  // on reaching the lake. Every `BridgeEvery` tiles it leaves a ford of FORD_LEN clear land (plus
  // the river's own width, which the stamps on either side cover), and then the land is checked
  // whole, bridging or dropping the river if not.
  function layRivers(sim, wet, lakes) {
    const { W, rng, T } = sim, S = T.world;
    if (!(S.Rivers > 0)) return;
    const bend = noise(rng, W.w, W.h, RIVER_SCALE);
    for (let r = 0; r < S.Rivers; r++) {
      const width = rng.inRange(S.RiverWidth), rad = width / 2;
      const edge = rng.int(4), along = RIVER_START[0] + (RIVER_START[1] - RIVER_START[0]) * rng.next();
      const horiz = edge < 2;   // starts on the top (0) or bottom (1) wall, else the left (2) or right (3)
      let x = horiz ? along * (W.w - 1) : edge === 2 ? 0 : W.w - 1;
      let y = horiz ? (edge === 0 ? 0 : W.h - 1) : along * (W.h - 1);
      let tx, ty;
      const toLake = lakes.length > 0 && rng.next() < RIVER_LAKE_SHARE;
      if (toLake) { const l = lakes[rng.int(lakes.length)]; tx = l.x; ty = l.y; }
      else {
        const f = 0.1 + 0.8 * rng.next();
        tx = horiz ? f * (W.w - 1) : edge === 2 ? W.w - 1 : 0;
        ty = horiz ? (edge === 0 ? W.h - 1 : 0) : f * (W.h - 1);
      }
      let heading = Math.atan2(ty - y, tx - x);
      const before = Uint8Array.from(wet), steps = 3 * (W.w + W.h);
      let untilFord = Math.round(S.BridgeEvery * (0.5 + 0.5 * rng.next())), fordLeft = 0;
      const ford = Math.ceil(width) + FORD_LEN[0] + rng.int(FORD_LEN[1] - FORD_LEN[0] + 1);
      for (let i = 0; i < steps; i++) {
        if (fordLeft > 0) fordLeft--;
        else if (--untilFord <= 0) { fordLeft = ford; untilFord = S.BridgeEvery; }
        if (fordLeft === 0) {
          for (let yy = Math.max(0, Math.floor(y - rad)); yy <= Math.min(W.h - 1, Math.ceil(y + rad)); yy++) {
            for (let xx = Math.max(0, Math.floor(x - rad)); xx <= Math.min(W.w - 1, Math.ceil(x + rad)); xx++) {
              if ((xx - x) ** 2 + (yy - y) ** 2 <= rad * rad && !wet[yy * W.w + xx]) wet[yy * W.w + xx] = RIVER;
            }
          }
        }
        const aim = Math.atan2(ty - y, tx - x) + (2 * bend(x, y) - 1) * RIVER_MEANDER;
        heading += Math.atan2(Math.sin(aim - heading), Math.cos(aim - heading)) * RIVER_STEER;
        x += Math.cos(heading); y += Math.sin(heading);
        if (x < 0 || y < 0 || x > W.w - 1 || y > W.h - 1) break;
        if (toLake && i >= RIVER_MIN_STEPS && wet[Math.round(y) * W.w + Math.round(x)] === LAKE) break;
      }
      if (!keepLandWhole(W, wet)) wet.set(before);
    }
  }

  // Lays the lakes, then the rivers, then makes it all water (world.js addWater) and works out
  // the shore the grass is boosted along. Returns the lakes' centers.
  function layWater(sim) {
    const { W, T } = sim, wet = new Uint8Array(W.n);
    const lakes = layLakes(sim, wet);
    layRivers(sim, wet, lakes);
    for (let t = 0; t < W.n; t++) if (wet[t]) W.addWater(t);
    W.setShore(T.grass.WaterRadius, T.grass.WaterBoost);
    return lakes.map(l => ({ x: l.x, y: l.y }));
  }

  // Returns the colony and pack centers (for tools that want to look at them).
  AS.startMeadows = function (sim, opts) {
    const { W, T } = sim, S = T.world;
    // Off: no water at all, which is also no thirst (animals.js), the world as it was before water.
    const lakes = (opts.water !== undefined ? opts.water : S.Water) ? layWater(sim) : [];
    const vals = meadowField(sim);
    const th = threshold(vals, S.StartGrass, W);
    // StartGrass 0 means no grass at all, not even lone seedlings (checks build empty worlds).
    if (S.StartGrass > 0) plantGrass(sim, vals, th);

    const out = { colonies: [], packs: [], lakes };
    if (AS.speciesReady('bunny') && S.StartBunnies > 0) {
      const nearEdge = t => vals[t] < th && vals[t] > th - EDGE_BAND;
      out.colonies = pickSpots(sim, Math.max(1, S.BunnyColonies), COLONY_GAP, nearEdge);
      for (const c of out.colonies) digHoles(sim, c, S.HolesPerColony, COLONY_SPREAD);
      out.colonies.forEach((c, i) => settle(sim, AS.SPECIES.BUNNY, c, share(S.StartBunnies, out.colonies.length, i), COLONY_SPREAD, opts.bodies));
    }
    if (AS.speciesReady('wolf') && S.StartWolves > 0) {
      const inOpenAwayFromColonies = t => {
        if (vals[t] >= th) return false;
        const x = t % W.w, y = (t / W.w) | 0;
        return out.colonies.every(c => Math.hypot(c.x - x, c.y - y) > PACK_FROM_COLONY);
      };
      out.packs = pickSpots(sim, Math.max(1, S.WolfPacks), PACK_GAP, inOpenAwayFromColonies);
      out.packs.forEach((p, i) => settle(sim, AS.SPECIES.WOLF, p, share(S.StartWolves, out.packs.length, i), PACK_SPREAD, opts.bodies));
    }
    return out;
  };
})(globalThis.AS);
