'use strict';
// The ground and its water (terrain.js; world.js KIND.WATER): every world has an elevation;
// water settles in its low places and runs down it, more with more Rain; water is impassable
// ground that holds nothing, never blocks sight, survives a nuke, and grass grows and seeds
// faster along it; the land is always one connected piece; Scatter has no water.
const { load, audit, editCSV, failures } = require('./harness.js');
let bad = 0;
function ok(c, m) { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; }

// A world from the real tables with some cells changed: [[file, row, col, value]...].
function make(seed, edits = []) {
  const { AS, texts } = load();
  texts.settings = editCSV(texts.settings, 'Water', 'Value', 'on');   // these are the water checks, whatever the shipped default
  for (const [file, row, col, v] of edits) texts[file] = editCSV(texts[file], row, col, v);
  const { T, errors } = AS.parseTables(texts);
  if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
  const sim = AS.Sim(T, seed);
  return { AS, T, sim, W: sim.W, K: AS.KIND };
}
const set = (k, v) => ['settings', k, 'Value', String(v)];
const DAY = 600;   // TICK_HZ * DAY_SECONDS, asserted below

// How many separate pieces the land is in (4-connected, as animals walk), and the water count.
function landPieces(AS, W) {
  const seen = new Uint8Array(W.n), q = new Int32Array(W.n), nb = new Int32Array(4);
  let pieces = 0, water = 0;
  for (let t0 = 0; t0 < W.n; t0++) {
    if (W.kind[t0] === AS.KIND.WATER) { water++; continue; }
    if (seen[t0]) continue;
    pieces++;
    let head = 0, tail = 0;
    seen[t0] = 1; q[tail++] = t0;
    while (head < tail) {
      const k = W.neighbors4(q[head++], nb);
      for (let i = 0; i < k; i++) if (!seen[nb[i]] && W.kind[nb[i]] !== AS.KIND.WATER) { seen[nb[i]] = 1; q[tail++] = nb[i]; }
    }
  }
  return { pieces, water };
}

{
  const { AS } = make(1);
  ok(AS.TICK_HZ * AS.DAY_SECONDS === DAY, 'a day is the length this check assumes');
}

// ---- Meadows: the ground has height, water sits low on it, the land is one piece ----
{
  let withWater = 0, worst = 0, lowWater = 0, inRelief = 0, total = 20, someWater = 0;
  for (let seed = 1; seed <= total; seed++) {
    const { AS, W, T, sim } = make(seed);
    const { pieces, water } = landPieces(AS, W);
    worst = Math.max(worst, pieces);
    if (water > 0) withWater++;
    someWater += water;
    let lo = Infinity, hi = -Infinity, wSum = 0, lSum = 0, lN = 0;
    for (let t = 0; t < W.n; t++) {
      const e = W.elev[t];
      lo = Math.min(lo, e); hi = Math.max(hi, e);
      if (W.kind[t] === AS.KIND.WATER) wSum += e; else { lSum += e; lN++; }
    }
    // Relief is drawn per world from its span (AS.terrainOf), so the top is that world's own.
    const R = sim.terrain.Relief, span = T.world.Relief;
    if (lo === 0 && Math.abs(hi - R) < 1e-3 && R >= span.min && R <= span.max) inRelief++;
    if (water > 0 && wSum / water < lSum / lN) lowWater++;
  }
  ok(inRelief === total, `${total} seeds: the ground runs from 0 to the world's own Relief, drawn from the setting's range`);
  ok(worst === 1, `${total} seeds: every land tile is reachable from every other (most pieces seen: ${worst})`);
  ok(withWater === total, `${total} seeds: every one has water (${(someWater / total) | 0} water tiles on average)`);
  ok(lowWater === total, 'water sits on low ground: in every seed it is lower on average than the land');
}

// ---- Each world draws its own terrain values, the same for the same seed ----
{
  const a = make(21), b = make(21), c = make(22);
  const keys = ['Relief', 'Hilliness', 'Roughness', 'Bowls', 'LakeDepth', 'Rain', 'RiverDrain'];
  const same = keys.every(k => a.sim.terrain[k] === b.sim.terrain[k]);
  const differ = keys.some(k => a.sim.terrain[k] !== c.sim.terrain[k]);
  const inside = keys.every(k => a.sim.terrain[k] >= a.T.world[k].min && a.sim.terrain[k] <= a.T.world[k].max);
  ok(same && differ && inside, 'terrain values: inside each range, the same for a seed, different for another');
}

// ---- More rain, more water ----
{
  const dry = make(5, [set('Rain', '30%'), set('RiverDrain', 0)]), wet = make(5, [set('Rain', '80%'), set('RiverDrain', 0)]);
  const d = landPieces(dry.AS, dry.W).water, w = landPieces(wet.AS, wet.W).water;
  ok(w > d && d > 0, `the same ground holds more lake with more Rain (${d} tiles at 30%, ${w} at 80%)`);
}

// ---- A stress world: many deep bowls, lots of rain, a small map: the land stays connected ----
{
  let worst = 0, filled = 0, runs = 0;
  for (let seed = 1; seed <= 25; seed++) {
    const { AS, W } = make(seed, [set('WorldWidth', 120), set('WorldHeight', 90), set('Bowls', 14), set('Rain', '95%'), set('LakeDepth', 0), set('RiverDrain', 150), set('StartBunnies', 20), set('StartWolves', 6)]);
    const { pieces, water } = landPieces(AS, W);
    worst = Math.max(worst, pieces); filled += water > 0 ? 1 : 0; runs++;
  }
  ok(worst === 1 && filled > 0, `crowded worlds (${runs} seeds, full bowls and many rivers, small map): land stays one piece`);
}

// ---- Rain 0% and RiverDrain 0, and Scatter, have no water (but still have ground) ----
{
  const a = make(3, [set('Rain', '0%'), set('RiverDrain', 0)]);
  ok(landPieces(a.AS, a.W).water === 0 && a.W.shore.every(v => v === 1), 'Rain 0% and RiverDrain 0: no water and no shore boost');
  const b = make(3, [set('StartLayout', 'Scatter')]);
  ok(landPieces(b.AS, b.W).water === 0 && b.W.shore.every(v => v === 1) && b.W.elev.some(e => e > 0), 'Scatter: no water, but the ground has height');
}

// ---- Same seed, same ground and water ----
{
  const a = make(9), b = make(9), c = make(10);
  let same = true, other = false;
  for (let t = 0; t < a.W.n; t++) {
    if (a.W.kind[t] !== b.W.kind[t] || a.W.elev[t] !== b.W.elev[t]) same = false;
    if ((a.W.kind[t] === a.K.WATER) !== (c.W.kind[t] === c.K.WATER)) other = true;
  }
  ok(same && other, 'the same seed makes the same ground and water; another seed makes others');
}

// ---- Several days of a Meadows world: nothing ever stands on water, and the audit holds ----
{
  let animalsSeen = 0, onWater = 0, births = 0, nearWater = 0;
  for (const seed of [4, 5, 6]) {
    const { AS, sim, W, K } = make(seed);
    const water = []; for (let t = 0; t < W.n; t++) if (W.kind[t] === K.WATER) water.push(t);
    const wet = new Uint8Array(W.n); for (const t of water) wet[t] = 1;
    // Tiles touching water, to see that animals really do come to the lakes.
    const shoreTile = new Uint8Array(W.n);
    for (const t of water) for (const d of [1, -1, W.w, -W.w]) if (W.kind[t + d] !== K.WATER && t + d >= 0 && t + d < W.n) shoreTile[t + d] = 1;
    let peak = 0;
    for (let tick = 0; tick < 4 * DAY; tick++) {
      sim.tick();
      peak = Math.max(peak, W.bunnies + W.wolves);
      if (tick % 12 !== 0) continue;
      for (let s = 0; s < W.aHigh; s++) {
        if (!W.aAlive[s]) continue;
        animalsSeen++;
        if (wet[W.aTile[s]]) onWater++;
        if (shoreTile[W.aTile[s]]) nearWater++;
      }
    }
    for (const t of water) if (W.kind[t] !== K.WATER || W.aSlot[t] !== -1) onWater++;
    births += peak;
    const f0 = failures.length;
    audit(AS, sim, `seed ${seed} after 4 days`);
    ok(failures.length === f0, `seed ${seed}: the grid and stores audit with lakes in the world${failures.length > f0 ? ': ' + failures[f0] : ''}`);
  }
  ok(animalsSeen > 1000 && births > 0, `the run had animals to watch (${animalsSeen} sightings)`);
  ok(onWater === 0, `no animal ever stood on water (${nearWater} sightings were on a lakeshore)`);
}

// ---- Rivers: they exist, are narrow, have fords, and the land stays whole ----
{
  const seeds = 20;
  let worst = 0, withRiver = 0, wide = 0, sampled = 0, fords = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    // Rivers alone (no lakes), so every water tile is river.
    const { AS, W } = make(seed, [set('Rain', '0%'), set('RiverDrain', 800), set('BridgeEvery', 25), set('StartBunnies', 0), set('StartWolves', 0)]);
    const { pieces, water } = landPieces(AS, W);
    worst = Math.max(worst, pieces);
    if (water > 0) withRiver++;
    // Width: a river is one or two tiles across, so no water tile has a 3-tile run both across and down.
    for (let t = 0; t < W.n; t += 3) {
      if (W.kind[t] !== AS.KIND.WATER) continue;
      sampled++;
      let d = 0, e = 0; const x0 = W.tx(t), y0 = W.ty(t);
      for (; d < 4; d++) if (!W.inside(x0 + d, y0) || W.kind[W.tile(x0 + d, y0)] !== AS.KIND.WATER) break;
      for (; e < 4; e++) if (!W.inside(x0, y0 + e) || W.kind[W.tile(x0, y0 + e)] !== AS.KIND.WATER) break;
      if (d >= 4 && e >= 4) wide++;
    }
    // Fords: a river tile's course is broken by a few tiles of land. Count land tiles with
    // water on both sides along a row or a column, within a few tiles.
    for (let t = 0; t < W.n; t++) {
      if (W.kind[t] === AS.KIND.WATER) continue;
      const x = W.tx(t), y = W.ty(t);
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        let a = 0, b = 0;
        for (let k = 1; k <= 3 && !a; k++) if (W.inside(x - dx * k, y - dy * k) && W.kind[W.tile(x - dx * k, y - dy * k)] === AS.KIND.WATER) a = 1;
        for (let k = 1; k <= 3 && !b; k++) if (W.inside(x + dx * k, y + dy * k) && W.kind[W.tile(x + dx * k, y + dy * k)] === AS.KIND.WATER) b = 1;
        if (a && b) { fords++; break; }
      }
    }
  }
  ok(withRiver === seeds, `${seeds} seeds: every world has river water`);
  ok(worst === 1, `${seeds} seeds with rivers: the land stays one piece (most pieces ${worst})`);
  // Where two rivers join the water can be broader, so allow a sliver.
  ok(wide < sampled * 0.02, `rivers are narrow: ${wide} of ${sampled} sampled river tiles have four tiles of water both across and down`);
  ok(fords > 0, `rivers are broken by fords (${fords} land tiles with river close on both sides)`);
  // The default world over more seeds.
  let bad = 0;
  for (let seed = 100; seed < 130; seed++) { const m = make(seed); if (landPieces(m.AS, m.W).pieces !== 1) bad++; }
  ok(bad === 0, 'the default world: land is one piece over 30 more seeds');
  // Many rivers with close fords in a small map still leave the land whole.
  let worstSmall = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const m = make(seed, [set('WorldWidth', 100), set('WorldHeight', 70), set('RiverDrain', 60), set('BridgeEvery', 12), set('StartBunnies', 10), set('StartWolves', 3)]);
    worstSmall = Math.max(worstSmall, landPieces(m.AS, m.W).pieces);
  }
  ok(worstSmall === 1, `crowded rivers in a small map: land stays one piece (${worstSmall})`);
  // A river counts as water for shore and beach.
  const m = make(2, [set('Rain', '0%'), set('RiverDrain', 800)]);
  let wet = 0, beachBad = 0;
  for (let t = 0; t < m.W.n; t++) if (m.W.kind[t] === m.AS.KIND.WATER) wet++;
  for (let t = 0; t < m.W.n; t++) {
    const touches = m.W.kind[t] !== m.AS.KIND.WATER && [t - 1, t + 1, t - m.W.w, t + m.W.w].some(u => u >= 0 && u < m.W.n && Math.abs(m.W.tx(u) - m.W.tx(t)) <= 1 && m.W.kind[u] === m.AS.KIND.WATER);
    if (m.W.kind[t] !== m.AS.KIND.WATER && (m.W.beach[t] === 1) !== touches) beachBad++;
  }
  ok(wet > 0 && beachBad === 0, 'rivers are water: beach is exactly the land touching water');
}

// ---- The beach stays bare: no blade ever stands on a land tile touching water ----
{
  let blades = 0, onBeach = 0, beachTiles = 0;
  for (const seed of [1, 2, 3]) {
    const { AS, sim, W, K } = make(seed);
    for (let t = 0; t < W.n; t++) if (W.beach[t]) beachTiles++;
    for (let tick = 0; tick < 4 * DAY; tick++) {
      sim.tick();
      if (tick % 150 !== 0) continue;
      for (let t = 0; t < W.n; t++) if (W.beach[t]) { blades += W.kind[t] === K.GRASS ? 1 : 0; onBeach += W.kind[t] === K.GRASS ? 1 : 0; }
    }
    // The brush too.
    let any = -1; for (let t = 0; t < W.n && any < 0; t++) if (W.beach[t] && W.kind[t] === K.EMPTY) any = t;
    AS.paintCircle(sim, 'grass', W.tx(any), W.ty(any), 5);
    for (let t = 0; t < W.n; t++) if (W.beach[t] && W.kind[t] === K.GRASS) onBeach++;
    let threw = false; try { W.addGrass(any, 1, 0); } catch (e) { threw = true; }
    if (!threw) onBeach++;
  }
  ok(beachTiles > 500 && onBeach === 0, `no blade on any of ${beachTiles} beach tiles over 3 seeds x 4 days, nor painted (${onBeach} seen)`);
}

// ---- Nothing can be put on water ----
{
  const { AS, sim, W, K } = make(2, [set('StartBunnies', 0), set('StartWolves', 0), set('StartGrass', 0)]);
  let w = -1; for (let t = 0; t < W.n && w < 0; t++) if (W.kind[t] === K.WATER && W.kind[t - 1] === K.WATER && W.kind[t + 1] === K.WATER) w = t;
  const throws = f => { try { f(); return false; } catch (e) { return true; } };
  ok(w >= 0, 'found a water tile');
  ok(throws(() => W.addGrass(w, 1, 0)), 'no blade on water');
  ok(throws(() => W.addCorpse(w, AS.SPECIES.BUNNY)), 'no corpse on water');
  ok(throws(() => W.addHole(w, 0)), 'no warren hole on water');
  ok(throws(() => W.addWater(w)), 'water on water is refused (the tile is taken)');
  for (const sp of AS.SPECIES_KEY.map((_, i) => i)) ok(throws(() => W.addAnimal(w, sp, 0)), `no ${AS.SPECIES_KEY[sp]} on water`);
  ok(!AS.debugDropCorpse(sim, w, AS.SPECIES.BUNNY), 'the debug corpse drop leaves water alone');
  // The paint modes' brush, centered on the lake and wide enough to cover it.
  const before = W.kind.slice(), cx = W.tx(w), cy = W.ty(w);
  for (const kind of ['grass', 'bunny', 'wolf', 'human']) AS.paintCircle(sim, kind, cx, cy, 6);
  let paintedOnWater = 0, placed = 0;
  for (let t = 0; t < W.n; t++) {
    if (before[t] === K.WATER && W.kind[t] !== K.WATER) paintedOnWater++;
    if (before[t] !== K.WATER && W.kind[t] !== before[t]) placed++;
  }
  ok(paintedOnWater === 0 && placed > 0, `paint modes skip water and still paint the land around it (${placed} tiles)`);
  // A hole can't be dug on water: the bunny's dig only picks EMPTY bare ground, and bunny.js asks
  // for kind EMPTY, which water never is.
  ok(W.isEmpty(w) === false, 'water is not "empty"');
}

// ---- A nuke leaves water alone and does not scorch it ----
{
  const { AS, sim, W, K } = make(2);
  let w = -1; for (let t = 0; t < W.n && w < 0; t++) if (W.kind[t] === K.WATER) w = t;
  const before = W.kind.reduce((n, k) => n + (k === K.WATER ? 1 : 0), 0);
  AS.nuke(sim, w, 60);
  const after = W.kind.reduce((n, k) => n + (k === K.WATER ? 1 : 0), 0);
  let scorchedWater = 0, scorchedLand = 0;
  for (let t = 0; t < W.n; t++) if (W.scorch[t] > 0) { if (W.kind[t] === K.WATER) scorchedWater++; else scorchedLand++; }
  ok(before === after && before > 0, `a nuke on a lake leaves all ${before} water tiles`);
  ok(scorchedWater === 0 && scorchedLand > 0, 'water is not scorched; the land around it is');
  const f0 = failures.length; audit(AS, sim, 'after nuke');
  ok(failures.length === f0, 'the audit holds after a nuke over water');
}

// ---- Sight crosses water, and paths go around it ----
{
  // A bare 40 x 20 world with a wall of water at x = 20 except a gap at the bottom.
  const { AS, sim, W, K } = make(1, [set('WorldWidth', 40), set('WorldHeight', 20), set('StartGrass', 0), set('StartBunnies', 0), set('StartWolves', 0), set('Rain', '0%'), set('RiverDrain', 0)]);
  for (let y = 0; y < 15; y++) W.addWater(W.tile(20, y));
  const a = W.tile(12, 5), b = W.tile(28, 5);
  ok(AS.lineOfSight(W, a, b) && AS.lineOfSight(W, b, a), 'line of sight crosses water, both ways');
  const bunny = AS.spawnStarting(sim, AS.SPECIES.BUNNY, b);
  const seen = AS.nearestVisible(sim, a, 16, t => W.kind[t] === AS.kindOf(AS.SPECIES.BUNNY));
  ok(seen === b && bunny >= 0, 'an animal sees another across a lake');
  // Plain paths: every first step is dry land next to the start; none is water.
  let wet = 0, found = 0;
  for (let n = 0; n < 400; n++) {
    const from = sim.rng.int(W.n), gx = sim.rng.int(W.w), gy = sim.rng.int(W.h), goal = W.tile(gx, gy);
    if (W.kind[from] !== K.EMPTY || W.kind[goal] !== K.EMPTY || from === goal) continue;
    const step = AS.pathNext(sim, from, t => t === goal, 40);
    if (step < 0) continue;
    found++;
    if (W.kind[step] === K.WATER) wet++;
    const dx = W.tx(step) - W.tx(from), dy = W.ty(step) - W.ty(from);
    if (step !== from && dx * dx + dy * dy !== 1) wet++;
  }
  ok(found > 100 && wet === 0, `pathNext never steps onto water (${found} paths)`);
  // The weighted pathfinder honors the caller's Infinity for water, as wolf.js's cost does.
  let wetW = 0, foundW = 0;
  for (let n = 0; n < 200; n++) {
    const from = sim.rng.int(W.n), goal = sim.rng.int(W.n);
    if (W.kind[from] !== K.EMPTY || W.kind[goal] !== K.EMPTY || from === goal) continue;
    const step = AS.pathNextWeighted(sim, from, t => t === goal, 40, t => (W.kind[t] === K.WATER ? Infinity : 1));
    if (step < 0) continue;
    foundW++;
    if (W.kind[step] === K.WATER) wetW++;
  }
  ok(foundW > 50 && wetW === 0, `pathNextWeighted with water at Infinity never steps onto it (${foundW} paths)`);
  // A wolf across the lake from a bunny sees it, hunts it, and stays on land the whole time.
  const wolf = AS.spawnStarting(sim, AS.SPECIES.WOLF, a);
  W.aFullness[wolf] = 30;  // hungry, so it hunts rather than prowls, but not starving through the scene
  let hunted = false, onWater = 0;
  for (let tick = 0; tick < 60 * AS.TICK_HZ; tick++) {
    sim.tick();
    if (!W.aAlive[wolf]) break;
    if (W.kind[W.aTile[wolf]] === K.WATER) onWater++;
    if (W.aTargetTile[wolf] >= 0) hunted = true;
  }
  ok(hunted && onWater === 0, 'a wolf that sees a bunny across a lake hunts it and never enters the water');
}

// ---- Grass likes water ----
{
  // A bare 120 x 70 world: water in the top rows, so rows within WaterRadius of it are shore
  // and rows far below are not. WaterRadius is raised to give both regions room.
  const R = 25;
  const edits = [set('WorldWidth', 120), set('WorldHeight', 70), set('StartGrass', 0), set('StartBunnies', 0), set('StartWolves', 0), set('Rain', '0%'), set('RiverDrain', 0),
    ['species', 'WaterBoost', 'Grass', '2'],   // pinned: the shipped value may be 1 (no boost), but the rule is tested at 2
    ['species', 'WaterRadius', 'Grass', String(R)], ['species', 'SproutChance', 'Grass', '0%'], ['species', 'SeedChance', 'Grass', '10%']];
  const build = extra => {
    const m = make(5, [...edits, ...extra]);
    for (let y = 0; y < 8; y++) for (let x = 0; x < m.W.w; x++) m.W.addWater(m.W.tile(x, y));
    m.W.setShore(m.T.grass.WaterRadius, m.T.grass.WaterBoost);
    return m;
  };
  const boost = 2;   // pinned in `edits` above
  const nearRows = [10, 30], farRows = [40, 68];   // the shore ends at row 7 + R = 32
  const inRows = (W, rows, t) => W.ty(t) >= rows[0] && W.ty(t) <= rows[1];
  {
    const { W, sim } = build([]);
    ok(W.shore[W.tile(5, 9)] === boost && W.shore[W.tile(5, 7 + R)] === boost && W.shore[W.tile(5, 7 + R + 1)] === 1,
      `W.shore is WaterBoost within WaterRadius of a lake (${boost}), 1 beyond it`);
    // Growth: a sprout on the shore and one far away, same ticks.
    const near = W.tile(60, 20), far = W.tile(60, 55);
    W.addGrass(near, 0.1, 0.5); W.addGrass(far, 0.1, 0.5);
    for (let i = 0; i < 6; i++) sim.tick();
    const gn = W.gSize[near] - 0.1, gf = W.gSize[far] - 0.1;
    ok(gf > 0 && Math.abs(gn / gf - boost) < 1e-3, `a blade on the shore grows ${boost} times as fast (ratio ${(gn / gf).toFixed(3)})`);
  }
  {
    // Seeding: mature blades on a spaced grid in the shore region and in the far region.
    const { W, sim } = build([]);
    const startNear = [], startFar = [];
    for (let y = 10; y <= 30; y += 3) for (let x = 1; x < W.w; x += 3) { W.addGrass(W.tile(x, y), 1, 1); startNear.push(W.tile(x, y)); }
    for (let y = 44; y <= 64; y += 3) for (let x = 1; x < W.w; x += 3) { W.addGrass(W.tile(x, y), 1, 1); startFar.push(W.tile(x, y)); }
    const known = new Set([...startNear, ...startFar]);
    for (let i = 0; i < DAY; i++) sim.tick();
    let nNear = 0, nFar = 0;
    for (let t = 0; t < W.n; t++) if (W.kind[t] === 1 /* KIND.GRASS */ && !known.has(t)) { if (inRows(W, nearRows, t)) nNear++; else if (inRows(W, farRows, t)) nFar++; }
    ok(nFar > 20 && nNear > nFar * (1 + (boost - 1) * 0.5), `blades near water seed faster: ${nNear} new beside the lake, ${nFar} far from it (WaterBoost ${boost})`);
  }
  {
    // Sprouting on bare ground.
    const { W, sim } = build([['species', 'SproutChance', 'Grass', '30%'], ['species', 'SeedChance', 'Grass', '0%']]);
    for (let i = 0; i < DAY; i++) sim.tick();
    let nNear = 0, nFar = 0;
    for (let t = 0; t < W.n; t++) if (W.kind[t] === 1 /* KIND.GRASS */) { if (inRows(W, nearRows, t)) nNear++; else if (inRows(W, farRows, t)) nFar++; }
    // Per tile, since the two regions differ in size.
    const dNear = nNear / ((nearRows[1] - nearRows[0] + 1) * W.w), dFar = nFar / ((farRows[1] - farRows[0] + 1) * W.w);
    ok(nFar > 100 && dNear > dFar * (1 + (boost - 1) * 0.5), `bare shore sprouts faster: ${dNear.toFixed(3)} of tiles beside the lake, ${dFar.toFixed(3)} far from it`);
  }
  {
    // A corpse's boost multiplies with the shore's rather than replacing it.
    const { AS, W, sim, T } = build([]);
    const a = W.tile(60, 20), b = W.tile(60, 60);
    for (const t of [a, b]) { W.addGrass(W.tile(W.tx(t) + 1, W.ty(t)), 0.1, 0.5); AS.debugDropCorpse(sim, t, AS.SPECIES.BUNNY); }
    const ga = W.tile(61, 20), gb = W.tile(61, 60);
    for (let i = 0; i < 4; i++) sim.tick();
    const ra = W.gSize[ga] - 0.1, rb = W.gSize[gb] - 0.1;
    ok(rb > 0 && Math.abs(ra / rb - boost) < 1e-3, `corpse and shore boosts multiply (ratio ${(ra / rb).toFixed(3)} = WaterBoost)`);
  }
}

// ---- The inspector names it ----
{
  const { AS, sim, W, K } = make(2);
  let w = -1; for (let t = 0; t < W.n && w < 0; t++) if (W.kind[t] === K.WATER) w = t;
  const text = require('fs').readFileSync(require('path').join(__dirname, '../js/inspect.js'), 'utf8');
  const vm = require('vm');
  vm.runInContext(text, vm.createContext({ AS }), {});   // adds AS.describe next to the sim's own files
  const d = AS.describe(sim, { tile: w, serial: 0, slot: -1, hole: false });
  const ground = d && d.rows.find(r => r.name === 'Ground');
  ok(d && d.title === 'Water' && ground && ground.value === 'Water' && d.rows.some(r => r.name === 'Elevation'), 'tapping water selects it: the inspector says "Water", with the tile under it');
}

console.log(bad ? `\n${bad} FAILED` : '\nAll water checks passed');
if (bad || failures.length) { if (failures.length) console.log([...new Set(failures)].slice(0, 20).join('\n')); process.exit(1); }
