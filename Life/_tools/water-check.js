'use strict';
// The ground and its water (terrain.js, water.js; world.js wDepth and the flow layer): every world
// has an elevation grown before day 0; the water rules settle water on it, lower than the land,
// more with more Rain, leaving the map only at river mouths, and keep running, so day 0 is
// already at rest; animals wade water no deeper than WadeDepth and swim deeper; drinking
// takes real water; water holds nothing else, never blocks sight and survives a nuke; Scatter
// has no water.
const { audit, failures } = require('./harness.js');
const { stage, tally, editCSV } = require('./kit.js');
const { ok, done } = tally();

// A world from the real tables with some cells changed: [[file, row, col, value]...].
// Water on whatever the shipped default, since these are the water checks. Shorter growing and
// settling than the game's, so dozens of worlds stay quick; the rules are the same.
function make(seed, edits = []) {
  return stage({ seed, bare: false, settings: { Water: 'on', GrowRounds: QUICK_ROUNDS, PreRunDays: QUICK_DAYS },
    edit: texts => { for (const [file, row, col, v] of edits) texts[file] = editCSV(texts[file], row, col, v); } });
}
const set = (k, v) => ['settings', k, 'Value', String(v)];
const QUICK_ROUNDS = 200, QUICK_DAYS = 20;
const DAY = 600;   // TICK_HZ * DAY_SECONDS, asserted below

// How many separate pieces the land is in (4-connected, as animals walk), and the water count.
function landPieces(AS, W) {
  const seen = new Uint8Array(W.n), q = new Int32Array(W.n), nb = new Int32Array(4);
  let pieces = 0, water = 0;
  for (let t0 = 0; t0 < W.n; t0++) {
    if (W.isOpenWater(t0)) { water++; continue; }
    if (seen[t0]) continue;
    pieces++;
    let head = 0, tail = 0;
    seen[t0] = 1; q[tail++] = t0;
    while (head < tail) {
      const k = W.neighbors4(q[head++], nb);
      for (let i = 0; i < k; i++) if (!seen[nb[i]] && !W.isOpenWater(nb[i])) { seen[nb[i]] = 1; q[tail++] = nb[i]; }
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
      if (W.isOpenWater(t)) wSum += e; else { lSum += e; lN++; }
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
      else if (W.isOpenWater(t) && ![t - 1, t + 1, t - W.w, t + W.w, t - 2, t + 2].some(u => u >= 0 && u < W.n && W.outlet[u])) strayEdge++;
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
  ok(landPieces(a.AS, a.W).water === 0 && a.W.water, 'Rain 0: no water, but the water rules, for water poured in');
  const b = make(3, [set('StartLayout', 'Scatter')]);
  ok(landPieces(b.AS, b.W).water === 0 && b.W.elev.some(e => e > 0) && !b.W.water, 'Scatter: no water and no water rules, but the ground has height');
}

// ---- Grown elsewhere (main.js grows it in a worker): the same world, tile for tile ----
{
  const direct = make(6);
  const elsewhere = make(6);   // its own sandbox, as a worker has
  const { AS: A2, T: T2 } = elsewhere;
  const grown = A2.growTerrain({ T: T2, seed: 6, W: A2.World(T2) }, true);
  const copy = structuredClone(grown);   // what crosses to the page
  const laid = direct.AS.Sim(direct.T, 6, { terrain: copy });
  const a = direct.W, b = laid.W;
  let same = a.waterCount === b.waterCount && a.bunnies === b.bunnies && a.wolves === b.wolves && a.gCount === b.gCount;
  for (let t = 0; t < a.n && same; t++) if (a.kind[t] !== b.kind[t] || a.elev[t] !== b.elev[t] || a.wDepth[t] !== b.wDepth[t] || a.water.G[t] !== b.water.G[t]) same = false;
  ok(same, 'a world laid from terrain grown in another sandbox is the same as one grown in place');
  for (let i = 0; i < DAY; i++) { direct.sim.tick(); laid.tick(); }
  let still = direct.W.bunnies === b.bunnies && direct.W.wolves === b.wolves;
  for (let t = 0; t < a.n && still; t++) if (a.kind[t] !== b.kind[t] || a.wDepth[t] !== b.wDepth[t]) still = false;
  ok(still, 'and a day later they are still the same');
}

// ---- Same seed, same ground and water ----
{
  const a = make(9), b = make(9), c = make(10);
  let same = true, other = false;
  for (let t = 0; t < a.W.n; t++) {
    if (a.W.kind[t] !== b.W.kind[t] || a.W.elev[t] !== b.W.elev[t]) same = false;
    if ((a.W.isOpenWater(t)) !== (c.W.isOpenWater(t))) other = true;
  }
  ok(same && other, 'the same seed makes the same ground and water; another seed makes others');
}

// ---- Several days of a Meadows world: the water keeps moving and settled, animals wade only
// the shallows, and the audit holds ----
{
  let hz = 0, animalsSeen = 0, deep = 0, nonSwimmer = 0, longest = 0, wading = 0, births = 0, nearWater = 0, drift = 0, blinking = 0, tiles = 0;
  for (const seed of [4, 5, 6]) {
    const { AS, sim, W } = make(seed);
    const wet0 = W.waterCount, inDeep = [];
    hz = AS.TICK_HZ;
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
        if (d > 0) {
          wading++;
          if (d > AS.wadeOf(sim, s)) { deep++; if (AS.speciesStats(sim, s).SwimCost == null) nonSwimmer++; inDeep[s] = (inDeep[s] || 0) + 12; longest = Math.max(longest, inDeep[s]); } else inDeep[s] = 0;
        } else inDeep[s] = 0;
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
  // Deep water is swimming: only for swimmers, and never for long (a crossing, a flight, or
  // the water rising over it until it walks out).
  ok(nonSwimmer === 0 && longest <= 60 * hz, `only swimmers are ever in deep water, and none stays a minute (${deep} sightings swimming, longest ${(longest / hz).toFixed(0)} s)`);
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
  for (let t = 0; t < m.W.n; t++) if (m.W.isOpenWater(t)) wet++;
  for (let t = 0; t < m.W.n; t++) {
    const touches = !m.W.isOpenWater(t) && [t - 1, t + 1, t - m.W.w, t + m.W.w].some(u => u >= 0 && u < m.W.n && Math.abs(m.W.tx(u) - m.W.tx(t)) <= 1 && m.W.isOpenWater(u));
    if (!m.W.isOpenWater(t) && (m.W.beach[t] === 1) !== touches) beachBad++;
  }
  ok(wet > 0 && beachBad === 0, 'water: beach is exactly the land touching it');
  let wrongDepth = 0; for (let t = 0; t < m.W.n; t++) if ((m.W.isOpenWater(t)) !== (m.W.wDepth[t] > 0)) wrongDepth++;
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
    let any = -1; for (let t = 0; t < W.n && any < 0; t++) if (W.beach[t] && W.isBare(t)) any = t;
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
  let w = -1; for (let t = 0; t < W.n && w < 0; t++) if (W.isOpenWater(t) && W.isOpenWater(t - 1) && W.isOpenWater(t + 1)) w = t;
  const throws = f => { try { f(); return false; } catch (e) { return true; } };
  ok(w >= 0, 'found a water tile');
  ok(throws(() => W.addGrass(w, 1, 0)), 'no blade on water');
  ok(throws(() => W.addCorpse(w, AS.SPECIES.BUNNY)), 'no corpse on water');
  ok(throws(() => W.addHole(w, 0)), 'no warren hole on water');
  ok(throws(() => W.addWater(w)), 'water on water is refused (the tile is taken)');
  for (const sp of AS.SPECIES_KEY.map((_, i) => i)) {
    const a = W.addAnimal(w, sp, 0), standing = W.kind[w] === AS.kindOf(sp);
    W.removeAnimal(a);
    ok(standing && W.isOpenWater(w), `a ${AS.SPECIES_KEY[sp]} can stand in water, and it is water again when it leaves`);
  }
  ok(!AS.debugDropCorpse(sim, w, AS.SPECIES.BUNNY), 'the debug corpse drop leaves water alone');
  // The paint modes' brush, centered on the lake and wide enough to cover it.
  const before = W.kind.slice(), wasWet = W.flow.slice(), cx = W.tx(w), cy = W.ty(w);
  for (const kind of ['grass', 'bunny', 'wolf', 'human']) AS.paintCircle(sim, kind, cx, cy, 6);
  let paintedOnWater = 0, placed = 0;
  for (let t = 0; t < W.n; t++) {
    if (wasWet[t] && W.kind[t] !== before[t]) paintedOnWater++;
    if (!wasWet[t] && W.kind[t] !== before[t]) placed++;
  }
  ok(paintedOnWater === 0 && placed > 0, `paint modes skip water and still paint the land around it (${placed} tiles)`);
  // A hole can't be dug on water: the bunny's dig only picks bare ground (W.isBare), which
  // water never is.
  ok(W.isBare(w) === false && W.isOpenWater(w), 'open water is not bare');
}

// ---- A nuke leaves water alone and does not scorch it ----
{
  const { AS, sim, W, K } = make(2);
  let w = -1; for (let t = 0; t < W.n && w < 0; t++) if (W.isOpenWater(t)) w = t;
  const before = W.flow.reduce((n, f) => n + (f === AS.FLOW.WATER ? 1 : 0), 0);
  AS.nuke(sim, w, 60);
  const after = W.flow.reduce((n, f) => n + (f === AS.FLOW.WATER ? 1 : 0), 0);
  let scorchedWater = 0, scorchedLand = 0;
  for (let t = 0; t < W.n; t++) if (W.scorch[t] > 0) { if (W.isOpenWater(t)) scorchedWater++; else scorchedLand++; }
  ok(before === after && before > 0, `a nuke on a lake leaves all ${before} water tiles`);
  ok(scorchedWater === 0 && scorchedLand > 0, 'water is not scorched; the land around it is');
  const f0 = failures.length; audit(AS, sim, 'after nuke');
  ok(failures.length === f0, 'the audit holds after a nuke over water');
}

// ---- Sight crosses water, and paths go around it ----
{
  // A bare 40 x 20 world with a wall of water at x = 20 except a gap at the bottom, deeper
  // than anything wades (Water off: no rules to move it); these wolves can't swim.
  const { AS, sim, W, K } = make(1, [set('WorldWidth', 40), set('WorldHeight', 20), set('StartGrass', 0), set('StartBunnies', 0), set('StartWolves', 0), set('Water', 'off'), ['species', 'SwimCost', 'Wolf', '']]);
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
    if (!W.isBare(from) || !W.isBare(goal) || from === goal) continue;
    const step = AS.pathNext(sim, from, t => t === goal, 40);
    if (step < 0) continue;
    found++;
    if (W.isOpenWater(step)) wet++;
    const dx = W.tx(step) - W.tx(from), dy = W.ty(step) - W.ty(from);
    if (step !== from && dx * dx + dy * dy !== 1) wet++;
  }
  ok(found > 100 && wet === 0, `pathNext never steps onto water deeper than the walker wades (${found} paths)`);
  // The weighted pathfinder honors the caller's Infinity for water, as wolf.js's cost does.
  let wetW = 0, foundW = 0;
  for (let n = 0; n < 200; n++) {
    const from = sim.rng.int(W.n), goal = sim.rng.int(W.n);
    if (!W.isBare(from) || !W.isBare(goal) || from === goal) continue;
    const step = AS.pathNextWeighted(sim, from, t => t === goal, 40, t => (W.isOpenWater(t) ? Infinity : 1));
    if (step < 0) continue;
    foundW++;
    if (W.isOpenWater(step)) wetW++;
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
  ok(hunted && onWater === 0, 'a wolf that can\'t swim sees a bunny across deep water, hunts it and never enters the water');
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
  ok(AS.stepTo(sim, wolf, across) && W.isOpenWater(W.tile(20, 6)), 'and out the other side, leaving water behind it');
}

// ---- Swimming: wolves well, bunnies badly; Stamina runs out, then they drown ----
{
  const world = (w, h, edits = []) => make(1, [set('WorldWidth', w), set('WorldHeight', h), set('StartGrass', 0), set('StartBunnies', 0), set('StartWolves', 0), set('Water', 'off'), ...edits]);
  // A river across the map, deeper than anything wades, no ford; a carcass across it.
  const river = stamina => {
    const env = world(40, 12, [['species', 'CorpseDecay', 'Bunny', '100']]);
    const { AS, sim, W, T } = env;
    const DEEP = 1 + T.human.WadeDepth;
    for (let y = 0; y < W.h; y++) for (const x of [20, 21, 22]) W.addWater(W.tile(x, y), DEEP);
    W.addCorpse(W.tile(25, 6), AS.SPECIES.BUNNY, 0);
    const wolf = AS.spawnStarting(sim, AS.SPECIES.WOLF, W.tile(18, 6));
    W.aFullness[wolf] = 10; W.aStamina[wolf] = stamina * T.wolf.StaminaMax;
    const full0 = W.aFullness[wolf];
    let swam = false, lowest = W.aStamina[wolf], fed = false, wentInWith = Infinity, before = W.aStamina[wolf], wasDeep = false;
    for (let i = 0; i < 30 * AS.TICK_HZ && !fed; i++) {
      sim.tick();
      const deep = W.wDepth[W.aTile[wolf]] > T.wolf.WadeDepth;
      if (deep) { swam = true; lowest = Math.min(lowest, W.aStamina[wolf]); }
      if (deep && !wasDeep) wentInWith = Math.min(wentInWith, before);
      wasDeep = deep; before = W.aStamina[wolf];
      fed = W.aFullness[wolf] > full0;
    }
    return { swam, fed, lowest, wentInWith, T };
  };
  const a = river(1);
  ok(a.swam && a.fed && a.lowest < a.T.wolf.StaminaMax, `a rested wolf swims a river to a carcass across it (Stamina down to ${a.lowest.toFixed(0)})`);
  const b = river((a.T.wolf.SwimAt + a.T.wolf.RestBelow) / 2), need = a.T.wolf.SwimAt * a.T.wolf.StaminaMax;
  ok(b.fed && b.wentInWith >= need - 1e-9, `one short of SwimAt waits on the bank until it has it, then swims (went in with ${b.wentInWith.toFixed(1)}, SwimAt ${need})`);
  // A world all deep water, no land anywhere: each swims until its Stamina is gone, then drowns.
  const { AS, sim, W, T } = world(30, 20);
  for (let t = 0; t < W.n; t++) W.addWater(t, 1 + T.human.WadeDepth);
  const bun = AS.spawnStarting(sim, AS.SPECIES.BUNNY, W.tile(10, 10)), wolf = AS.spawnStarting(sim, AS.SPECIES.WOLF, W.tile(20, 10));
  const bunSer = W.aSerial[bun], wolfSer = W.aSerial[wolf];
  const alive = (s, ser) => W.aAlive[s] && W.aSerial[s] === ser;
  let bunAt = -1, wolfAt = -1;
  for (let i = 0; i < 120 * AS.TICK_HZ && (bunAt < 0 || wolfAt < 0); i++) {
    sim.tick();
    if (bunAt < 0 && !alive(bun, bunSer)) bunAt = i / AS.TICK_HZ;
    if (wolfAt < 0 && !alive(wolf, wolfSer)) wolfAt = i / AS.TICK_HZ;
  }
  const lasts = S => S.StaminaMax / S.SwimCost + S.HPMax / S.DrownDamage;
  ok(bunAt > 0 && Math.abs(bunAt - lasts(T.bunny)) < 1, `a bunny in deep water drowns once its Stamina and then HP run out (${bunAt.toFixed(1)} s)`);
  ok(wolfAt > bunAt && Math.abs(wolfAt - lasts(T.wolf)) < 1, `a wolf lasts far longer (${wolfAt.toFixed(1)} s)`);
  ok(W.cCount === 0, 'drowned animals leave no body');
  ok(T.bunny.SwimAt == null, 'a bunny never takes to deep water by choice (no SwimAt): only to flee');
}
{
  // A fleeing bunny swims only toward a bank it can reach on its Stamina (Paul, 12 Oct 2026):
  // a one-tile stream it crosses; a river wider than its reach it won't go into.
  const run = width => {
    const { AS, sim, W, T } = make(1, [set('WorldWidth', 50), set('WorldHeight', 15), set('StartGrass', 0), set('StartBunnies', 0), set('StartWolves', 0), set('Water', 'off'),
      ['species', 'WalkSpeed', 'Wolf', '0'], ['species', 'SprintSpeed', 'Wolf', '0'], ['species', 'SwimCost', 'Wolf', ''], ['species', 'HoleRange', 'Bunny', '0']]);
    const DEEP = 1 + T.bunny.WadeDepth;
    for (let y = 0; y < W.h; y++) for (let x = 20; x < 20 + width; x++) W.addWater(W.tile(x, y), DEEP);
    const bun = AS.spawnStarting(sim, AS.SPECIES.BUNNY, W.tile(19, 7)), ser = W.aSerial[bun];
    AS.spawnStarting(sim, AS.SPECIES.WOLF, W.tile(14, 7));
    let swam = false, across = false;
    for (let i = 0; i < 8 * AS.TICK_HZ && W.aAlive[bun] && W.aSerial[bun] === ser; i++) {
      sim.tick();
      if (W.wDepth[W.aTile[bun]] > T.bunny.WadeDepth) swam = true;
      if (W.tx(W.aTile[bun]) >= 20 + width) across = true;
    }
    return { swam, across, alive: W.aAlive[bun] && W.aSerial[bun] === ser };
  };
  const narrow = run(1), wide = run(8);
  ok(narrow.swam && narrow.across && narrow.alive, 'a fleeing bunny swims a one-tile stream to get away');
  ok(!wide.swam && wide.alive, 'it won\'t go into a river wider than it can swim; it runs along the bank instead');
}

// ---- Drinking takes real water: WaterLiters a meter, from the tile it drinks ----
{
  const { AS, sim, W, T } = make(1, [set('WorldWidth', 40), set('WorldHeight', 20), set('StartGrass', 0), set('StartBunnies', 0), set('StartWolves', 0), set('Rain', 0)]);
  // A small pond poured into the world's rules, and a thirsty wolf on its shore.
  AS.paintCircle(sim, 'water', 20, 10, 1);
  let shore = -1; for (let t = 0; t < W.n && shore < 0; t++) if (W.beach[t] && W.isBare(t)) shore = t;
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
  let w = -1; for (let t = 0; t < W.n && w < 0; t++) if (W.isOpenWater(t)) w = t;
  const text = require('fs').readFileSync(require('path').join(__dirname, '../js/inspect.js'), 'utf8');
  const vm = require('vm');
  vm.runInContext(text, vm.createContext({ AS }), {});   // adds AS.describe next to the sim's own files
  const d = AS.describe(sim, { tile: w, serial: 0, slot: -1, hole: false });
  const ground = d && d.rows.find(r => r.name === 'Ground');
  ok(d && d.title === 'Water' && ground && ground.value === 'Water' && d.rows.some(r => r.name === 'Elevation'), 'tapping water selects it: the inspector says "Water", with the tile under it');
}

if (failures.length) console.log([...new Set(failures)].slice(0, 20).join('\n'));
done('All water checks passed', failures.length);
