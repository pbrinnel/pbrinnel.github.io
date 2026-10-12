'use strict';
// The ground and its water (terrain.js, water.js; world.js wDepth and KIND.WATER): every world
// has an elevation grown before day 0; the water rules settle water on it, lower than the land,
// more with more Rain, leaving the map only at river mouths, and keep running, so day 0 is
// already at rest; animals wade water no deeper than WadeDepth and never stand in deeper;
// drinking takes real water; water holds nothing else, never blocks sight, survives a nuke,
// and grass grows and seeds faster along it; Scatter has no water.
const { load, audit, editCSV, failures } = require('./harness.js');
let bad = 0;
function ok(c, m) { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; }

// A world from the real tables with some cells changed: [[file, row, col, value]...].
function make(seed, edits = []) {
  const { AS, texts } = load();
  texts.settings = editCSV(texts.settings, 'Water', 'Value', 'on');   // these are the water checks, whatever the shipped default
  // Shorter growing and settling than the game's, so dozens of worlds stay quick; the rules are the same.
  texts.settings = editCSV(texts.settings, 'GrowRounds', 'Value', String(QUICK_ROUNDS));
  texts.settings = editCSV(texts.settings, 'PreRunDays', 'Value', String(QUICK_DAYS));
  for (const [file, row, col, v] of edits) texts[file] = editCSV(texts[file], row, col, v);
  const { T, errors } = AS.parseTables(texts);
  if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
  const sim = AS.Sim(T, seed);
  return { AS, T, sim, W: sim.W, K: AS.KIND };
}
const set = (k, v) => ['settings', k, 'Value', String(v)];
const QUICK_ROUNDS = 200, QUICK_DAYS = 20;
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

// ---- Meadows: the ground has height, water sits low on it ----
{
  let withWater = 0, lowWater = 0, inRelief = 0, total = 8, someWater = 0;
  for (let seed = 1; seed <= total; seed++) {
    const { AS, W, T, sim } = make(seed);
    const { water } = landPieces(AS, W);
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
  ok(withWater === total, `${total} seeds: every one has water (${(someWater / total) | 0} water tiles on average)`);
  ok(lowWater === total, 'water sits on low ground: in every seed it is lower on average than the land');
}

// ---- Each world draws its own terrain values, the same for the same seed ----
{
  const a = make(21), b = make(21), c = make(22);
  const keys = ['Relief', 'Hilliness', 'Roughness', 'Bowls', 'RiverMouths', 'Rain'];
  const same = keys.every(k => a.sim.terrain[k] === b.sim.terrain[k]);
  const differ = keys.some(k => a.sim.terrain[k] !== c.sim.terrain[k]);
  const inside = keys.every(k => a.sim.terrain[k] >= a.T.world[k].min - 0.5 && a.sim.terrain[k] <= a.T.world[k].max + 0.5);
  ok(same && differ && inside, 'terrain values: inside each range, the same for a seed, different for another');
}

// ---- More rain, more water ----
{
  const dry = make(5, [set('Rain', 0.5)]), wet = make(5, [set('Rain', 4)]);
  const d = landPieces(dry.AS, dry.W).water, w = landPieces(wet.AS, wet.W).water;
  ok(w > d, `the same ground holds more water with more Rain (${d} tiles at 0.5 mm a day, ${w} at 4)`);
}

// ---- Water leaves only at the river mouths: no water on the edge except at one ----
{
  let strayEdge = 0, mouthTiles = 0, worlds = 0;
  for (const seed of [2, 3, 4]) {
    const { AS, W } = make(seed);
    worlds++;
    for (let t = 0; t < W.n; t++) {
      const x = t % W.w, y = (t / W.w) | 0;
      if (x !== 0 && y !== 0 && x !== W.w - 1 && y !== W.h - 1) continue;
      if (W.outlet[t]) mouthTiles++;
      // A tile on the edge next to a mouth may hold water that is on its way out.
      else if (W.kind[t] === AS.KIND.WATER && ![t - 1, t + 1, t - W.w, t + W.w, t - 2, t + 2].some(u => u >= 0 && u < W.n && W.outlet[u])) strayEdge++;
    }
  }
  ok(mouthTiles > 0, `${worlds} worlds have river mouths (${mouthTiles} edge tiles)`);
  ok(strayEdge < worlds * 40, `water reaches the edge mostly at the mouths (${strayEdge} other wet edge tiles in ${worlds} worlds)`);
}

// ---- A stress world: lots of rain, many basins, a small map: it builds, and holds together ----
{
  let filled = 0, runs = 0;
  const f0 = failures.length;
  for (let seed = 1; seed <= 10; seed++) {
    const { AS, W, sim } = make(seed, [set('WorldWidth', 120), set('WorldHeight', 90), set('Bowls', 14), set('Rain', 8), set('StartBunnies', 20), set('StartWolves', 6)]);
    filled += landPieces(AS, W).water > 0 ? 1 : 0; runs++;
    for (let i = 0; i < DAY; i++) sim.tick();
    audit(AS, sim, `stress seed ${seed}`);
  }
  ok(filled > 0 && failures.length === f0, `wet small worlds (${runs} seeds, heavy rain, many basins) build and audit a day in${failures.length > f0 ? ': ' + failures[f0] : ''}`);
}

// ---- Rain 0, and Scatter, have no water (but still have ground) ----
{
  const a = make(3, [set('Rain', 0)]);
  ok(landPieces(a.AS, a.W).water === 0 && a.W.shore.every(v => v === 1) && a.W.water, 'Rain 0: no water and no shore boost, but the water rules, for water poured in');
  const b = make(3, [set('StartLayout', 'Scatter')]);
  ok(landPieces(b.AS, b.W).water === 0 && b.W.shore.every(v => v === 1) && b.W.elev.some(e => e > 0) && !b.W.water, 'Scatter: no water and no water rules, but the ground has height');
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

// ---- Several days of a Meadows world: the water keeps moving and settled, animals wade only
// the shallows, and the audit holds ----
{
  let animalsSeen = 0, deep = 0, wading = 0, births = 0, nearWater = 0, drift = 0, blinking = 0, tiles = 0;
  for (const seed of [4, 5, 6]) {
    const { AS, sim, W } = make(seed);
    const wet0 = W.waterCount;
    const was = new Uint8Array(W.n), flips = new Uint16Array(W.n);
    for (let t = 0; t < W.n; t++) was[t] = W.wDepth[t] > 0 ? 1 : 0;
    let peak = 0;
    for (let tick = 0; tick < 4 * DAY; tick++) {
      sim.tick();
      peak = Math.max(peak, W.bunnies + W.wolves);
      if (sim.tickCount % 15 === 1) for (let t = 0; t < W.n; t++) { const v = W.wDepth[t] > 0 ? 1 : 0; if (v !== was[t]) { flips[t]++; was[t] = v; } }
      if (tick % 12 !== 0) continue;
      for (let s = 0; s < W.aHigh; s++) {
        if (!W.aAlive[s]) continue;
        animalsSeen++;
        const d = W.wDepth[W.aTile[s]];
        if (d > 0) { wading++; if (d > AS.wadeOf(sim, s)) deep++; }
        if (W.beach[W.aTile[s]]) nearWater++;
      }
    }
    drift = Math.max(drift, Math.abs(W.waterCount - wet0) / wet0);
    for (let t = 0; t < W.n; t++) if (flips[t] >= 16) blinking++;
    tiles += W.n;
    births += peak;
    const f0 = failures.length;
    audit(AS, sim, `seed ${seed} after 4 days`);
    ok(failures.length === f0, `seed ${seed}: the grid and stores audit with the water moving${failures.length > f0 ? ': ' + failures[f0] : ''}`);
  }
  ok(animalsSeen > 1000 && births > 0 && nearWater > 0, `the run had animals to watch (${animalsSeen} sightings, ${nearWater} on a shore, ${wading} wading)`);
  // Water that rises over an animal leaves it in deep water until it has walked out.
  ok(deep <= animalsSeen / 1000, `animals stand in water deeper than they wade almost never (${deep} sightings)`);
  // Day 0 is at rest (Paul: nothing settling to watch on day 1), at the game's own PreRunDays;
  // these worlds settle for QUICK_DAYS only, so this allows them more.
  ok(drift < 0.25, `the water's extent moves little in the first 4 days (most: ${(100 * drift).toFixed(1)}%)`);
  // Never strobe (CLAUDE.md): tiles don't blink wet and dry; a shore creeping is a flip or two.
  ok(blinking <= tiles / 10000, `hardly any tile turns wet and dry over and over (${blinking} of ${tiles} flipped 16+ times in 4 days)`);
}

// ---- Rivers: running water is water; beach is exactly the land touching it ----
{
  const m = make(2);
  let wet = 0, beachBad = 0;
  for (let t = 0; t < m.W.n; t++) if (m.W.kind[t] === m.AS.KIND.WATER) wet++;
  for (let t = 0; t < m.W.n; t++) {
    const touches = m.W.kind[t] !== m.AS.KIND.WATER && [t - 1, t + 1, t - m.W.w, t + m.W.w].some(u => u >= 0 && u < m.W.n && Math.abs(m.W.tx(u) - m.W.tx(t)) <= 1 && m.W.kind[u] === m.AS.KIND.WATER);
    if (m.W.kind[t] !== m.AS.KIND.WATER && (m.W.beach[t] === 1) !== touches) beachBad++;
  }
  ok(wet > 0 && beachBad === 0, 'water: beach is exactly the land touching it');
  let wrongDepth = 0; for (let t = 0; t < m.W.n; t++) if ((m.W.kind[t] === m.AS.KIND.WATER) !== (m.W.wDepth[t] > 0)) wrongDepth++;
  ok(wrongDepth === 0, 'every water tile has a depth, and no land tile does');
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

// ---- Nothing but an animal can be put in water ----
{
  const { AS, sim, W, K } = make(2, [set('StartBunnies', 0), set('StartWolves', 0), set('StartGrass', 0)]);
  let w = -1; for (let t = 0; t < W.n && w < 0; t++) if (W.kind[t] === K.WATER && W.kind[t - 1] === K.WATER && W.kind[t + 1] === K.WATER) w = t;
  const throws = f => { try { f(); return false; } catch (e) { return true; } };
  ok(w >= 0, 'found a water tile');
  ok(throws(() => W.addGrass(w, 1, 0)), 'no blade on water');
  ok(throws(() => W.addCorpse(w, AS.SPECIES.BUNNY)), 'no corpse on water');
  ok(throws(() => W.addHole(w, 0)), 'no warren hole on water');
  ok(throws(() => W.addWater(w)), 'water on water is refused (the tile is taken)');
  for (const sp of AS.SPECIES_KEY.map((_, i) => i)) {
    const a = W.addAnimal(w, sp, 0), standing = W.kind[w] === AS.kindOf(sp);
    W.removeAnimal(a);
    ok(standing && W.kind[w] === K.WATER, `a ${AS.SPECIES_KEY[sp]} can stand in water, and it is water again when it leaves`);
  }
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
  // A bare 40 x 20 world with a wall of water at x = 20 except a gap at the bottom, deeper
  // than anything wades (Water off: no rules to move it).
  const { AS, sim, W, K } = make(1, [set('WorldWidth', 40), set('WorldHeight', 20), set('StartGrass', 0), set('StartBunnies', 0), set('StartWolves', 0), set('Water', 'off')]);
  const DEEP = 1 + Math.max(...AS.SPECIES_KEY.map(k => sim.T[k].WadeDepth || 0));
  for (let y = 0; y < 15; y++) W.addWater(W.tile(20, y), DEEP);
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
  ok(found > 100 && wet === 0, `pathNext never steps onto water deeper than the walker wades (${found} paths)`);
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
    if (W.wDepth[W.aTile[wolf]] > 0) onWater++;
    if (W.aTargetTile[wolf] >= 0) hunted = true;
  }
  ok(hunted && onWater === 0, 'a wolf that sees a bunny across deep water hunts it and never enters the water');
}

// ---- Grass likes water ----
{
  // A bare 120 x 70 world: water in the top rows (Water off: no rules to move it), so rows
  // within WaterRadius of it are shore and rows far below are not. WaterRadius is raised to
  // give both regions room.
  const R = 25;
  const edits = [set('WorldWidth', 120), set('WorldHeight', 70), set('StartGrass', 0), set('StartBunnies', 0), set('StartWolves', 0), set('Water', 'off'),
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

// ---- Wading: water no deeper than an animal's WadeDepth is ground to it, slower ----
{
  // A bare world with a strip of water across it at x = 20, between the bunny's and the
  // wolf's WadeDepth: the wolf wades it, the bunny can't (Water off: the strip stays as laid).
  const { AS, sim, W, T } = make(1, [set('WorldWidth', 40), set('WorldHeight', 12), set('StartGrass', 0), set('StartBunnies', 0), set('StartWolves', 0), set('Water', 'off')]);
  const mid = (T.bunny.WadeDepth + T.wolf.WadeDepth) / 2;
  ok(T.wolf.WadeDepth > T.bunny.WadeDepth, `wolves wade deeper than bunnies (${T.wolf.WadeDepth} m, ${T.bunny.WadeDepth} m)`);
  for (let y = 0; y < W.h; y++) W.addWater(W.tile(20, y), mid);
  const wolf = AS.spawnStarting(sim, AS.SPECIES.WOLF, W.tile(19, 6)), bun = AS.spawnStarting(sim, AS.SPECIES.BUNNY, W.tile(19, 2));
  const across = W.tile(21, 6), acrossB = W.tile(21, 2);
  ok(AS.pathNext(sim, W.tile(19, 6), t => t === across, 10) === W.tile(20, 6), 'a wolf\'s path goes through water it wades');
  ok(AS.pathNext(sim, W.tile(19, 2), t => t === acrossB, 10) === -1, 'a bunny\'s path can\'t cross water deeper than it wades');
  ok(AS.stepTo(sim, wolf, W.tile(20, 6)) && W.wDepth[W.aTile[wolf]] > 0 && W.kind[W.aTile[wolf]] === AS.kindOf(AS.SPECIES.WOLF), 'a wolf steps into it and stands there');
  ok(!AS.stepTo(sim, bun, W.tile(20, 2)), 'a bunny can\'t step into it');
  const dryDur = 1 / AS.speedOf(sim, wolf);
  ok(Math.abs(W.aStepDur[wolf] - dryDur / T.wolf.WadeSpeed) < 1e-9, `a step into water takes 1 / WadeSpeed as long (${W.aStepDur[wolf].toFixed(3)} s)`);
  W.aStepLeft[wolf] = 0;
  ok(AS.stepTo(sim, wolf, across) && W.kind[W.tile(20, 6)] === AS.KIND.WATER, 'and out the other side, leaving water behind it');
}

// ---- Drinking takes real water: WaterLiters a meter, from the tile it drinks ----
{
  const { AS, sim, W, T } = make(1, [set('WorldWidth', 40), set('WorldHeight', 20), set('StartGrass', 0), set('StartBunnies', 0), set('StartWolves', 0), set('Rain', 0)]);
  // A small pond poured into the world's rules, and a thirsty wolf on its shore.
  AS.paintCircle(sim, 'water', 20, 10, 1);
  let shore = -1; for (let t = 0; t < W.n && shore < 0; t++) if (W.beach[t] && W.kind[t] === AS.KIND.EMPTY) shore = t;
  const wolf = AS.spawnStarting(sim, AS.SPECIES.WOLF, shore);
  W.aWater[wolf] = 0;
  let drank = 0, took = 0, sips = 0;
  for (let i = 0; i < 5 * AS.TICK_HZ && W.aAlive[wolf]; i++) {
    const before = W.aWater[wolf], H = Float64Array.from(W.water.H);
    sim.tick();
    // Only ticks when no water step ran, so the rules' own moves don't mix in.
    if (sim.tickCount % 15 === 1) continue;
    const gained = W.aWater[wolf] - before;
    if (!(gained > 0)) continue;
    drank += gained; sips++;
    for (let t = 0; t < W.n; t++) took += H[t] - W.water.H[t];
  }
  const expect = drank / T.wolf.WaterMax * T.wolf.WaterLiters / 1000 / (AS.TILE_M * AS.TILE_M);
  // A sip that leaves less than WATER_TINY leaves none (the rules' own rounding).
  ok(drank > 0 && Math.abs(took - expect) <= sips * AS.WATER_TINY, `a drink of ${drank.toFixed(1)} points took ${(took * 1e6).toFixed(2)} µm of water off a tile (${(expect * 1e6).toFixed(2)} expected)`);
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
