// How the world looks on day 0 when settings.csv's StartLayout is Meadows: grass in
// meadows of every size with open ground between (the look of temperate grassland from the
// air), old in the middle of a meadow and younger toward its edge; bunnies in a few colonies
// just outside meadow edges, each colony with a few warren holes dug around it before its
// bunnies settle; wolves in small packs out in the open, away from the colonies.
// Paul chose this over scattering everything evenly, which reads as a random, empty world.
//
// Uses only sim.rng, so a seed replays the same start in the page, the harness and the lab.
// sim.js calls AS.startMeadows from populate(); nothing else does.
(function (AS) {
  'use strict';

  const K = AS.KIND;

  // ---- shape of the layout (not tuning numbers: these only make the start look natural) ----
  const OCTAVES = 4;            // meadow edges: big shapes with smaller wiggles on them
  const EDGE_DEPTH = 0.12;      // how far into a meadow (in field units) blades reach full age
  const MEADOW_FILL = 0.9;      // share of meadow tiles that start with a blade
  const STRAY_BLADES = 0.004;   // lone seedlings out in the open, per open tile
  const AGE_MIN = 0.15, AGE_SPAN = 0.8, AGE_JITTER = 0.4;   // blade age as shares of Lifespan
  const COLONY_SPREAD = 3.5;    // tiles: how far a colony's bunnies scatter from its center
  const PACK_SPREAD = 1.6;      // tiles: a pack starts close together
  const COLONY_GAP = 28;        // tiles between colony centers, at least
  const PACK_GAP = 45;          // tiles between packs
  const PACK_FROM_COLONY = 22;  // tiles from a pack to the nearest colony, at least
  const EDGE_BAND = 0.08;       // field units just outside a meadow where colonies settle
  const BORDER = 6;             // tiles: no colony or pack centered this close to the wall
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

  // The field value above which the top `cover` share of tiles lies.
  function threshold(vals, cover) {
    const sorted = Float32Array.from(vals).sort();
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * (1 - cover)))];
  }

  function plantGrass(sim, vals, th) {
    const { W, rng } = sim, g = sim.T.grass;
    const range = Math.max(1e-6, 1 - th);
    for (let t = 0; t < W.n; t++) {
      if (W.kind[t] !== K.EMPTY) continue;
      const d = (vals[t] - th) / range;
      let age = -1;
      if (d >= 0) {
        if (rng.next() < MEADOW_FILL) {
          const depth = Math.min(1, d / EDGE_DEPTH);
          age = g.Lifespan * (AGE_MIN + AGE_SPAN * depth) * (1 - AGE_JITTER + AGE_JITTER * rng.next());
        }
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
      if (species === AS.SPECIES.WOLF && W.hole[t]) continue;   // a hole is a wall to wolves
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

  // Returns the colony and pack centers (for tools that want to look at them).
  AS.startMeadows = function (sim, opts) {
    const { W, T } = sim, S = T.world;
    const vals = meadowField(sim);
    const th = threshold(vals, S.StartGrass);
    // StartGrass 0 means no grass at all, not even lone seedlings (checks build empty worlds).
    if (S.StartGrass > 0) plantGrass(sim, vals, th);

    const out = { colonies: [], packs: [] };
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
