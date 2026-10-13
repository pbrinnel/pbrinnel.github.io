'use strict';
// Fire (js/fire.js, and the fire layer in world.js): what can be lit, how it spreads, what stops
// it, and what it leaves behind. Each scene sets the fire rows it needs itself, so nothing here
// depends on the shipped numbers, only on their signs.
//   node Life/_tools/fire-check.js
const { audit, failures } = require('./harness.js');
const { stage, tally, quiet, tick } = require('./kit.js');
const { ok, done } = tally();

const HOUR_TICKS = 25;   // AS.TICKS_PER_HOUR, checked below
const FIRE = {           // the fire rows every scene starts from (a scene overrides what it studies)
  FireSpread: 2, FireWind: 1, FireDryness: '100%', FireScorchDays: 2,
};
const BURN = [['BurnHours', 'Grass', 4], ['BurnHours', 'Bunny', 3], ['BurnHours', 'Wolf', 5], ['BurnHours', 'Human', 5],
  ['CorpseDecay', 'Bunny', 10], ['CorpseDecay', 'Wolf', 10]];
// What an animal does in a fire, set per scene: catches always, burns 4 hours at 2 HP a second.
const ANIMAL = [['CatchFire', 'Bunny', '100%'], ['CatchFire', 'Wolf', '100%'], ['CatchFire', 'Human', '100%'],
  ['AlightHours', 'Bunny', 4], ['AlightHours', 'Wolf', 4], ['AlightHours', 'Human', 4],
  ['BurnDamage', 'Bunny', 2], ['BurnDamage', 'Wolf', 2], ['BurnDamage', 'Human', 2]];

// A world filled with full blades, calm, no water rules, nothing growing or dying.
function meadow({ size = 41, seed = 1, settings = {}, fill = true, animals = [] } = {}) {
  const s = stage({ size, seed, settings: Object.assign({}, FIRE, settings), species: [quiet.grass, BURN, ANIMAL, animals] });
  s.AS.weatherTick = () => {};   // this scene's wind is the one it sets
  setWind(s.sim, 0, 1, 0);
  if (fill) for (let t = 0; t < s.W.n; t++) s.W.addGrass(t, 1, 0);
  return s;
}
function setWind(sim, kmh, toX, toY) { sim.wind.kmh = kmh; sim.wind.toX = toX; sim.wind.toY = toY; }
const hours = (sim, h) => tick(sim, Math.round(h * HOUR_TICKS));
function burnOut(sim, maxHours = 400) {
  for (let i = 0; i < maxHours * HOUR_TICKS && sim.W.fCount > 0; i++) sim.tick();
}
// Tiles a fire has reached: burning now, or burnt (scorched).
const reached = W => { let n = 0; for (let t = 0; t < W.n; t++) if (W.flow[t] === 2 || W.scorch[t] > 0) n++; return n; };
const reachedAt = (W, t) => W.flow[t] === 2 || W.scorch[t] > 0;
const audited = (s, label) => audit(s.AS, s.sim, label);

// ---- the clock these numbers assume
{
  const { AS } = meadow({ size: 5 });
  ok(AS.TICKS_PER_HOUR === HOUR_TICKS, 'the check\'s hour is the sim\'s');
}

// ---- ignite: what can catch
{
  const s = stage({ size: 12, settings: FIRE, species: [quiet.grass, BURN, ANIMAL] });
  const { AS, sim, W } = s;
  const at = (x, y) => W.tile(x, y);
  W.addGrass(at(1, 1), 1, 0);
  W.addGrass(at(3, 1), 0.5, 0);
  W.addCorpse(at(5, 1), AS.SPECIES.BUNNY, 0); AS.corpseAdded(sim, at(5, 1));
  W.addAnimal(at(7, 1), AS.SPECIES.BUNNY, 0);
  W.addWater(at(9, 1));
  W.addHole(at(1, 4));
  W.addCorpse(at(3, 4), AS.SPECIES.BUNNY, 0);   // a body that died in a hole
  W.addHole(at(3, 4));
  const before = sim.rng.state();
  ok(AS.ignite(sim, at(1, 1)) && W.flow[at(1, 1)] === AS.FLOW.FIRE, 'a blade can be set alight');
  ok(W.fireTime[at(1, 1)] === sim.T.grass.BurnHours, 'a full blade burns Grass BurnHours');
  ok(AS.ignite(sim, at(3, 1)) && Math.abs(W.fireTime[at(3, 1)] - 0.5 * sim.T.grass.BurnHours) < 1e-6, 'a half blade burns half as long');
  ok(AS.ignite(sim, at(5, 1)) && W.fireTime[at(5, 1)] === sim.T.bunny.BurnHours, 'a corpse burns its species\' BurnHours');
  ok(!AS.ignite(sim, at(1, 1)), 'a tile already burning refuses');
  ok(!AS.ignite(sim, at(9, 1)) && W.flow[at(9, 1)] === AS.FLOW.WATER, 'water refuses');
  ok(!AS.ignite(sim, at(1, 4)), 'a hole with nothing on it refuses');
  ok(!AS.ignite(sim, at(3, 4)), 'a hole with a corpse on it refuses');
  ok(W.fCount === 3, 'three fires burn');
  let threw = 0;
  for (const t of [at(9, 1), at(1, 1), at(1, 4), at(7, 1)]) { try { W.addFire(t, 1); } catch (e) { threw++; } }
  ok(threw === 4, 'W.addFire itself refuses water, a burning tile, a hole and an animal');
  ok(AS.ignite(sim, at(7, 1)) && W.flow[at(7, 1)] === AS.FLOW.NONE && W.aAlight[W.aSlot[at(7, 1)]] > 0, 'an animal can be set alight, and its tile does not burn');
  ok(sim.rng.state() === before, 'lighting a fire draws no dice');
  ok(audited(s, 'ignite') && failures.length === 0, 'the layers audit with three fires and a burning animal');
  ok(AS.fireStage(W, at(1, 1)) === 0 && AS.fireStage(W, at(0, 8)) === 0, 'fireStage starts at 0, and is 0 off fire');
  hours(sim, 2);
  const f = AS.fireStage(W, at(1, 1));
  ok(f > 0.3 && f < 0.7, `fireStage is the share burnt (${f.toFixed(2)} of a 4 h burn after 2 h)`);
}

// ---- a lone blade burns out without a single die rolled, and leaves scorch
{
  const s = stage({ size: 9, settings: Object.assign({}, FIRE, { RootSurvive: '0%' }), species: [quiet.grass, BURN] });   // (a roots roll is a die: roots-check.js)
  const { AS, sim, W } = s, t = W.tile(4, 4);
  W.addGrass(t, 1, 0);
  const rng0 = sim.rng.state();
  AS.ignite(sim, t);
  const rngLit = sim.rng.state();
  burnOut(sim);
  ok(W.fCount === 0 && W.flow[t] === AS.FLOW.NONE, 'the fire ends');
  ok(W.kind[t] === AS.KIND.EMPTY && W.gCount === 0, 'the blade is gone');
  ok(W.scorch[t] > 0 && W.scorch[t] <= sim.T.world.FireScorchDays, `the ground is scorched (${W.scorch[t].toFixed(2)} days left of ${sim.T.world.FireScorchDays})`);
  ok(sim.rng.state() === rngLit && rngLit === rng0, 'a fire with nothing to spread to rolls no dice');
  // A bigger scorch already there is kept.
  const u = W.tile(2, 2);
  W.addGrass(u, 1, 0); W.scorch[u] = 100; AS.ignite(sim, u); burnOut(sim);
  ok(W.scorch[u] > sim.T.world.FireScorchDays, 'burning out keeps a longer scorch that was already there');
  ok(audited(s, 'lone') && failures.length === 0, 'audit after');
}

// ---- no fire: nothing drawn, whatever the tick count
{
  const s = stage({ size: 20, settings: FIRE, species: [quiet.grass, BURN] });
  const { AS, sim, W } = s;
  for (let t = 0; t < W.n; t += 3) W.addGrass(t, 1, 0);
  const before = sim.rng.state();
  for (let i = 0; i < 300; i++) { AS.fireTick(sim); AS.fireStep(sim, 0.2); sim.tickCount++; }
  ok(sim.rng.state() === before, 'fireTick and fireStep with no fire leave sim.rng where it was');
}

// ---- a meadow fire spreads, burns out, and leaves only scorch
{
  const s = meadow({ size: 41 });
  const { AS, sim, W } = s;
  const mid = W.tile(20, 20);
  AS.ignite(sim, mid);
  let peak = 0, lastAudit = 0;
  for (let i = 0; i < 400 * HOUR_TICKS && (W.fCount > 0); i++) {
    sim.tick();
    peak = Math.max(peak, W.fCount);
    if (i - lastAudit >= 40) { lastAudit = i; audited(s, 'meadow'); }
  }
  const scorched = (() => { let n = 0; for (let t = 0; t < W.n; t++) if (W.scorch[t] > 0) n++; return n; })();
  ok(W.fCount === 0, 'the meadow fire burns out');
  ok(peak > 20, `it spread: ${peak} tiles burning at once at the peak`);
  ok(scorched > W.n * 0.9, `most of the meadow burnt (${scorched} of ${W.n})`);
  ok(W.gCount === W.n - scorched, 'every blade it burnt is gone, and none it did not reach');
  let sloppy = 0;
  for (let t = 0; t < W.n; t++) if ((W.kind[t] === AS.KIND.GRASS) === (W.scorch[t] > 0)) sloppy++;
  ok(sloppy === 0, 'every tile is either an unburnt blade or scorched ground');
  ok(audited(s, 'meadow end') && failures.length === 0, 'the layers audit through the fire and after');
}

// ---- corpses burn, and leave no boost behind
{
  const s = meadow({ size: 21, settings: { FireSpread: 3 } });
  const { AS, sim, W } = s;
  const spots = [[10, 10], [11, 10], [4, 14], [16, 5]];
  for (const [x, y] of spots) {
    const t = W.tile(x, y);
    W.removeGrass(t);
    W.addCorpse(t, y % 2 ? AS.SPECIES.WOLF : AS.SPECIES.BUNNY, 0);
    AS.corpseAdded(sim, t);
  }
  let boosted = 0;
  for (let t = 0; t < W.n; t++) if (W.boostSrc[t] >= 0) boosted++;
  ok(boosted > 0, 'the corpses boost grass around them to start with');
  AS.ignite(sim, W.tile(10, 10));
  ok(W.fireTime[W.tile(10, 10)] === sim.T.bunny.BurnHours, 'the bunny\'s body burns the bunny\'s hours');
  burnOut(sim);
  ok(W.cCount === 0, 'every corpse in the fire burnt (they caught from their neighbors)');
  let left = 0;
  for (let t = 0; t < W.n; t++) if (W.boostSrc[t] >= 0) left++;
  ok(left === 0, 'no boost is left behind');
  ok(W.scorch[W.tile(10, 10)] > 0 && W.kind[W.tile(10, 10)] === AS.KIND.EMPTY, 'a corpse leaves scorched bare ground');
  ok(audited(s, 'corpses') && failures.length === 0, 'audit after (boostSrc names only corpses, none left)');
  // A corpse alone, boost and all, with no grass: burns out and releases a neighboring corpse's tiles.
  const q = stage({ size: 15, settings: FIRE, species: [quiet.grass, BURN] });
  const a = q.W.tile(7, 7), b = q.W.tile(9, 7);
  for (const t of [a, b]) { q.W.addCorpse(t, q.AS.SPECIES.BUNNY, 0); q.AS.corpseAdded(q.sim, t); }
  q.AS.ignite(q.sim, a); burnOut(q.sim);
  let mine = 0;
  for (let t = 0; t < q.W.n; t++) if (q.W.boostSrc[t] === a) mine++;
  let theirs = 0;
  for (let t = 0; t < q.W.n; t++) if (q.W.boostSrc[t] === b) theirs++;
  ok(mine === 0 && theirs > 0 && q.W.kind[b] === q.AS.KIND.CORPSE, 'a burnt corpse hands its tiles to the one still standing');
  ok(audited(q, 'two corpses') && failures.length === 0, 'audit');
}

// ---- firebreaks: water and bare ground stop it, wider or not
for (const [label, width, water] of [['a bare strip 1 wide', 1, false], ['a bare strip 2 wide', 2, false], ['a river 1 wide', 1, true], ['a river 2 wide', 2, true]]) {
  const s = meadow({ size: [41, 21], settings: { FireSpread: 4 } });
  const { AS, sim, W } = s;
  const x0 = 20;
  const cut = [];
  for (let y = 0; y < W.h; y++) for (let x = x0; x < x0 + width; x++) {
    const t = W.tile(x, y);
    W.removeGrass(t);
    cut.push(t);
  }
  if (water) for (const t of cut) W.addWater(t);
  AS.ignite(sim, W.tile(5, 10));
  burnOut(sim);
  let beyond = 0, near = 0, wet = 0;
  for (let t = 0; t < W.n; t++) {
    if (W.tx(t) >= x0 + width && reachedAt(W, t)) beyond++;
    if (W.tx(t) < x0 && W.scorch[t] > 0) near++;
    if (W.wDepth[t] > 0 && W.flow[t] !== AS.FLOW.WATER) wet++;
  }
  ok(near > 0.9 * x0 * W.h, `${label}: the near side burnt (${near} of ${x0 * W.h})`);
  ok(beyond === 0, `${label}: nothing beyond it burnt`);
  ok(wet === 0 && cut.every(t => (W.flow[t] === AS.FLOW.WATER) === water && W.scorch[t] === 0), `${label}: the strip itself is untouched`);
  ok(audited(s, label) && failures.length === 0, `${label}: audit`);
}

// ---- wet soil slows it (the water rules' soil, stood in by a stub that holds only the numbers fire reads)
{
  const burnt = wetShare => {
    const s = meadow({ size: 41, settings: { FireSpread: 1 } });
    const { AS, sim, W } = s;
    AS.waterTick = () => {};
    W.water = { G: new Float64Array(W.n).fill(wetShare * 0.6), room: 0.6 };
    AS.ignite(sim, W.tile(20, 20));
    hours(sim, 8);
    return reached(W);
  };
  const dry = burnt(0), damp = burnt(0.6), soaked = burnt(1);
  ok(dry > damp && damp > 1, `damp soil burns less than dry soil (${dry} tiles in 8 h vs ${damp})`);
  ok(soaked === 1, 'soil full to its room does not carry the fire at all');
  // And with no water rules, FireDryness stands in.
  const setting = d => {
    const s = meadow({ size: 41, settings: { FireSpread: 1, FireDryness: d } });
    s.AS.ignite(s.sim, s.W.tile(20, 20));
    hours(s.sim, 8);
    return reached(s.W);
  };
  const a = setting('100%'), b = setting('30%'), c = setting('0%');
  ok(a > b && b > 1 && c === 1, `without water rules, FireDryness sets it (${a} tiles at 100%, ${b} at 30%, ${c} at 0%)`);
}

// ---- wind: more downwind, less upwind
{
  const extent = (kmh, toX, toY) => {
    const s = meadow({ size: 61, settings: { FireSpread: 0.6, FireWind: 1 } });
    const { AS, sim, W } = s;
    setWind(sim, kmh, toX, toY);
    AS.ignite(sim, W.tile(30, 30));
    hours(sim, 14);
    let east = 0, west = 0, north = 0, south = 0;
    for (let t = 0; t < W.n; t++) {
      if (!reachedAt(W, t)) continue;
      const dx = W.tx(t) - 30, dy = W.ty(t) - 30;
      east = Math.max(east, dx); west = Math.max(west, -dx); south = Math.max(south, dy); north = Math.max(north, -dy);
    }
    return { east, west, north, south, area: reached(W) };
  };
  const calm = extent(0, 1, 0), gale = extent(AS_FULL(), 1, 0), breeze = extent(AS_FULL() / 3, 1, 0), north = extent(AS_FULL(), 0, -1);
  function AS_FULL() { return meadow({ size: 5 }).AS.FIRE.FULL_WIND_KMH; }
  ok(gale.east > gale.west + 5, `a strong wind carries it farther downwind (${gale.east} tiles east, ${gale.west} west)`);
  ok(Math.abs(calm.east - calm.west) <= 3 && Math.abs(calm.north - calm.south) <= 3, `calm air spreads it evenly (${calm.east}/${calm.west}, ${calm.north}/${calm.south})`);
  ok(breeze.east - breeze.west > 0 && breeze.east - breeze.west < gale.east - gale.west, `a breeze tilts it less than a gale (${breeze.east - breeze.west} vs ${gale.east - gale.west})`);
  ok(north.north > north.south + 5, `the wind's direction is the fire's (blowing north: ${north.north} north, ${north.south} south)`);
}

// ---- water puts fire out, and fire never stands on a wet tile
{
  const s = meadow({ size: 15, settings: { FireSpread: 4 } });
  const { AS, sim, W } = s;
  const a = W.tile(7, 7), b = W.tile(8, 7);
  AS.ignite(sim, a); AS.ignite(sim, b);
  hours(sim, 0.4);
  const burning = W.fCount;
  W.setDepth(a, 1);
  // (The blades beside new water go too, as beaches: their fires end with them.)
  ok(W.flow[a] === AS.FLOW.WATER && W.fCount < burning && W.kind[a] === AS.KIND.EMPTY, 'water poured on a burning tile puts it out (and drowns the blade)');
  ok(audited(s, 'doused') && failures.length === 0, 'audit after dousing');
  // The corpse route, as water.js takes it: the corpse goes first, then the depth.
  const c = W.tile(3, 3);
  W.removeGrass(c); W.addCorpse(c, AS.SPECIES.BUNNY, 0); AS.corpseAdded(sim, c); AS.ignite(sim, c);
  const n = W.fCount;
  AS.corpseRemove(sim, c); W.setDepth(c, 1);
  ok(W.fCount === n - 1 && W.flow[c] === AS.FLOW.WATER, 'a burning corpse washed away leaves water, not fire');
  // Running with water standing among the grass: no wet tile is ever burning.
  let bad = 0;
  for (let i = 0; i < 60; i++) {
    hours(sim, 0.5);
    if (i === 10) W.setDepth(W.tile(10, 7), 1);
    for (let t = 0; t < W.n; t++) if (W.flow[t] === AS.FLOW.FIRE && W.wDepth[t] > 0) bad++;
  }
  ok(bad === 0, 'no wet tile is ever burning');
  ok(audited(s, 'water') && failures.length === 0, 'audit');
  // Its fuel taken by someone else (a bite, old age) ends it too.
  const d = meadow({ size: 9 });
  const t = d.W.tile(4, 4);
  d.AS.ignite(d.sim, t);
  d.AS.grassBite(d.sim, t, 1);
  ok(d.W.fCount === 0 && d.W.flow[t] === d.AS.FLOW.NONE, 'a burning blade eaten whole takes the fire with it');
  ok(audited(d, 'bitten') && failures.length === 0, 'audit');
}

// ---- the same seed gives the same fire; another seed another
{
  const run = seed => {
    const s = meadow({ size: 41, seed, settings: { FireSpread: 1 } });
    s.AS.ignite(s.sim, s.W.tile(20, 20));
    hours(s.sim, 9);
    const burnt = [];
    for (let t = 0; t < s.W.n; t++) if (reachedAt(s.W, t)) burnt.push(t);
    return burnt.join() + '|' + s.sim.rng.state();
  };
  ok(run(5) === run(5), 'the same seed burns the same tiles');
  ok(run(5) !== run(6), 'another seed burns others');
}

// ---- rates are per hour, not per step
{
  const area = (seed, step) => {
    const s = meadow({ size: 41, seed, settings: { FireSpread: 0.5 } });
    const { AS, sim, W } = s;
    AS.ignite(sim, W.tile(20, 20));
    const total = 9;
    for (let i = 0; i < Math.round(total / step); i++) AS.fireStep(sim, step);
    return reached(W);
  };
  const base = AS => AS;   // (kept simple: the step sizes are explicit below)
  const { AS } = meadow({ size: 5 });
  const every = AS.FIRE.EVERY / AS.TICKS_PER_HOUR;
  const SEEDS = 12;
  const mean = step => { let sum = 0; for (let k = 1; k <= SEEDS; k++) sum += area(k, step); return sum / SEEDS; };
  const full = mean(every), half = mean(every / 2), fine = mean(every / 5);
  ok(Math.abs(full - half) < 0.15 * half, `the burnt area barely depends on the step: ${full.toFixed(0)} tiles at ${every.toFixed(2)} h, ${half.toFixed(0)} at half, ${fine.toFixed(0)} at a fifth`);
  void base;
}

// ---- an animal beside a fire catches it, by its species' CatchFire
{
  // Six animals (two of each species) in a ring round a meadow's fire, the fire stepped
  // directly (nothing else ticks, so nobody wanders off), until all are alight or `maxHours`.
  const ring = (catchFire, { maxHours = 80, hole = false } = {}) => {
    const rows = ['Bunny', 'Wolf', 'Human'].map(sp => ['CatchFire', sp, catchFire]);
    const s = meadow({ size: 31, settings: { FireSpread: 1 }, animals: rows });
    const { AS, sim, W } = s;
    const spots = [[10, 10], [20, 10], [10, 20], [20, 20], [15, 8], [15, 22]];
    const slots = spots.map(([x, y], i) => {
      const t = W.tile(x, y);
      W.removeGrass(t);
      if (hole) W.addHole(t);
      return AS.spawnStarting(sim, hole ? 0 : i % 3, t);   // only bunnies may stand on a hole
    });
    AS.ignite(sim, W.tile(15, 15));
    const step = AS.FIRE.EVERY / AS.TICKS_PER_HOUR;
    let h = 0, caughtAt = slots.map(() => -1);
    for (; h < maxHours && W.fCount > 0; h += step) {
      AS.fireStep(sim, step);
      slots.forEach((a, i) => { if (caughtAt[i] < 0 && W.aAlight[a] > 0) caughtAt[i] = h; });
    }
    return { s, slots, caughtAt, W, AS, sim };
  };
  const hot = ring('100%');
  ok(hot.caughtAt.every(h => h >= 0), `with CatchFire 100% every animal beside the fire catches (after ${hot.caughtAt.map(h => h.toFixed(1)).join(', ')} h)`);
  ok(hot.slots.every((a, i) => hot.W.aAlight[a] === hot.sim.T[hot.AS.SPECIES_KEY[i % 3]].AlightHours), 'a fresh catch has its species\' AlightHours left');
  ok(hot.slots.every(a => hot.W.flow[hot.W.aTile[a]] === hot.AS.FLOW.NONE), 'the animals\' own tiles never burn');
  const cold = ring('0%');
  ok(cold.caughtAt.every(h => h < 0) && cold.W.fCount === 0, 'with CatchFire 0 none catches, though the meadow all burns');
  const holed = ring('100%', { hole: true });
  ok(holed.caughtAt.every(h => h < 0), 'a bunny in its warren hole beside the fire never catches (a hole is safe)');
  // Less readily takes longer, on average over a few worlds.
  const mean = cf => {
    let sum = 0, n = 0;
    for (let k = 1; k <= 6; k++) {
      const rows = ['Bunny', 'Wolf', 'Human'].map(sp => ['CatchFire', sp, cf]);
      const s = meadow({ size: 31, seed: k, settings: { FireSpread: 1 }, animals: rows });
      const { AS, sim, W } = s;
      const t = W.tile(20, 15); W.removeGrass(t);
      const a = AS.spawnStarting(sim, 0, t);
      AS.ignite(sim, W.tile(15, 15));
      const step = AS.FIRE.EVERY / AS.TICKS_PER_HOUR;
      let h = 0;
      for (; h < 200 && W.aAlight[a] === 0 && W.fCount > 0; h += step) AS.fireStep(sim, step);
      if (W.aAlight[a] > 0) { sum += h; n++; }
    }
    return n ? sum / n : Infinity;
  };
  const quick = mean('100%'), slow = mean('15%');
  ok(slow > quick, `a less flammable animal catches later (${quick.toFixed(1)} h at 100%, ${slow.toFixed(1)} h at 15%)`);
  // The same dice: an animal beside a fire is one roll per step, like a blade.
  ok(audited(hot.s, 'animals in fire') && failures.length === 0, 'audit');
}

// ---- alight: damage over time, no healing, water douses, it burns out, or kills
{
  const mk = (extra = [], settings = {}) => {
    const s = stage({ size: 15, settings: Object.assign({}, FIRE, settings), species: [quiet.grass, BURN, ANIMAL, quiet.hunger, extra] });
    s.AS.weatherTick = () => {};
    return s;
  };
  // Loses BurnDamage x time, then it is out and the HP stays.
  {
    const s = mk(); const { AS, sim, W } = s;
    const t = W.tile(7, 7), a = AS.spawnStarting(sim, 0, t);
    const S = sim.T.bunny;
    ok(AS.ignite(sim, t) && W.aAlight[a] === S.AlightHours, 'ignite sets an animal alight for AlightHours');
    ok(!AS.ignite(sim, t), 'a burning animal refuses a second ignite');
    const ticks = Math.round(S.AlightHours * AS.TICKS_PER_HOUR);
    tick(sim, Math.round(AS.TICKS_PER_HOUR));   // one hour
    const lost1 = S.HPMax - W.aHP[a];
    ok(Math.abs(lost1 - S.BurnDamage * AS.TICKS_PER_HOUR * AS.DT) < 1e-3, `an hour alight costs BurnDamage x time (${lost1.toFixed(2)} HP)`);
    tick(sim, ticks - Math.round(AS.TICKS_PER_HOUR));
    ok(W.aAlight[a] === 0 && W.aAlive[a], 'AlightHours later it is out, and alive');
    const lost = S.HPMax - W.aHP[a];
    ok(Math.abs(lost - S.BurnDamage * ticks * AS.DT) < 1e-3, `the whole burn cost ${lost.toFixed(2)} HP = BurnDamage x AlightHours x clock`);
    tick(sim, 30);
    ok(W.aHP[a] > S.HPMax - lost, 'once out it heals again');
    ok(audited(s, 'alight') && failures.length === 0, 'audit');
  }
  // It does not heal while alight: hurt first, then watch HP only fall.
  {
    const s = mk(); const { AS, sim, W } = s;
    const t = W.tile(7, 7), a = AS.spawnStarting(sim, 1, t);
    W.aHP[a] = 30;
    AS.ignite(sim, t);
    let rose = 0, last = W.aHP[a];
    for (let i = 0; i < 60; i++) { sim.tick(); if (W.aHP[a] > last + 1e-6) rose++; last = W.aHP[a]; }
    ok(rose === 0 && last < 30, 'a burning animal never heals');
  }
  // Water puts it out at once.
  {
    const s = mk(); const { AS, sim, W } = s;
    const t = W.tile(7, 7), a = AS.spawnStarting(sim, 2, t);
    AS.ignite(sim, t);
    tick(sim, 10);
    const hp = W.aHP[a], here = W.aTile[a];   // (it has walked on since)
    W.setDepth(here, 0.1);   // the water comes to it
    sim.tick();
    ok(W.aAlight[a] === 0, 'standing in water puts it out at once');
    ok(W.aHP[a] >= hp - 1e-4, 'and the tick it is put out costs no fire damage');
    ok(!AS.ignite(sim, W.aTile[a]) && W.aAlight[a] === 0, 'a wading animal cannot be set alight');
  }
  // It dies of it: a burning corpse, cause Burned; in water, no body.
  {
    const s = mk([['BurnDamage', 'Bunny', 600]]); const { AS, sim, W } = s;
    const t = W.tile(7, 7), a = AS.spawnStarting(sim, 0, t);
    AS.ignite(sim, t);
    tick(sim, 3);
    ok(!W.aAlive[a] && W.cCount === 1, 'an animal burnt to 0 HP dies and leaves a corpse');
    const c = W.cList[0];
    ok(W.cCause[c] === AS.CAUSE.BURNED, 'its cause is Burned');
    ok(W.flow[c] === AS.FLOW.FIRE && W.fireTime[c] === sim.T.bunny.BurnHours, 'the corpse is burning, for its species\' BurnHours');
    burnOut(sim);
    ok(W.cCount === 0 && W.scorch[c] > 0, 'the body burns away like any corpse and scorches the ground');
    ok(audited(s, 'burnt') && failures.length === 0, 'audit');
  }
  {
    const s = mk([['BurnDamage', 'Wolf', 600]]); const { AS, sim, W } = s;
    // Hole: the body of a bunny that dies alight in a hole does not burn (a hole never burns).
    const s2 = mk([['BurnDamage', 'Bunny', 600]]);
    const th = s2.W.tile(3, 3); s2.W.addHole(th);
    const b = s2.AS.spawnStarting(s2.sim, 0, th);
    s2.AS.ignite(s2.sim, th);   // refused: it is in its hole
    ok(s2.W.aAlight[b] === 0, 'an animal in a hole refuses to catch');
    s2.W.aAlight[b] = 5;        // (it ran in while burning)
    tick(s2.sim, 3);
    ok(s2.W.cCount === 1 && s2.W.fCount === 0, 'one that dies alight in a hole leaves a body that does not burn');
    // In water: no corpse, as ever.
    const t = W.tile(7, 7), a = AS.spawnStarting(sim, 1, t);
    W.setDepth(t, 0.1);
    AS.killAnimal(sim, a, AS.CAUSE.BURNED);
    ok(W.cCount === 0 && W.fCount === 0, 'a death in water leaves no corpse, burning or not');
  }
  // Fire catches from a burning neighbor while it lives its ordinary life: the whole thing, ticking.
  {
    const s = mk([['CatchFire', 'Bunny', '100%']], { FireSpread: 20 });
    const { AS, sim, W } = s;
    for (let t = 0; t < W.n; t++) if (W.tile(7, 7) !== t) W.addGrass(t, 1, 0);
    const a = AS.spawnStarting(sim, 0, W.tile(7, 7));
    AS.ignite(sim, W.tile(7, 8));
    tick(sim, 60);
    ok(W.aAlight[a] > 0 || !W.aAlive[a], 'ticking the whole sim, an animal beside a fire is set alight');
  }
}

// ---- painted fire on bare ground: a brief ember that lights the fuel beside it and burns out
{
  const s = stage({ size: 12, settings: Object.assign({}, FIRE, { FireSpread: 10, EmberHours: 1 }), species: [quiet.grass, BURN, ANIMAL] });
  const { AS, sim, W } = s;
  s.AS.weatherTick = () => {};
  setWind(sim, 0, 1, 0);
  const t = W.tile(5, 5), blade = W.tile(6, 5), far = W.tile(10, 10);
  W.addGrass(blade, 1, 0); W.addGrass(far, 1, 0);
  ok(W.isBare(t), 'the ground is bare');
  ok(AS.ignite(sim, t) && W.flow[t] === AS.FLOW.FIRE && W.kind[t] === AS.KIND.EMPTY, 'bare ground can be set alight');
  ok(W.fireTime[t] === sim.T.world.EmberHours, 'an ember burns EmberHours');
  ok(!W.isBare(t), 'a burning ember is not bare (nothing is placed on it)');
  burnOut(sim);
  ok(W.kind[blade] === AS.KIND.EMPTY && W.scorch[blade] > 0, 'the ember lit the blade beside it (and it burnt)');
  ok(W.kind[far] === AS.KIND.GRASS && W.scorch[far] === 0, 'a blade out of reach is untouched');
  ok(W.fCount === 0 && W.flow[t] === AS.FLOW.NONE && W.kind[t] === AS.KIND.EMPTY, 'the ember goes out and leaves nothing');
  ok(W.scorch[t] > 0 && W.scorch[t] <= sim.T.world.FireScorchDays, 'it scorches the ground');
  ok(!AS.ignite(sim, t), 'scorched ground refuses (nothing left to burn)');
  ok(audited(s, 'ember') && failures.length === 0, 'audit');
  // A painted brush over a mixed patch: everything but water and holes catches.
  const q = stage({ size: 12, settings: FIRE, species: [quiet.grass, BURN, ANIMAL] });
  const w = q.W;
  w.addGrass(w.tile(5, 5), 1, 0); q.AS.spawnStarting(q.sim, 0, w.tile(6, 5)); w.addWater(w.tile(7, 5)); w.addHole(w.tile(5, 6));
  const lit = q.AS.paintCircle(q.sim, 'fire', 6, 5, 1.5);
  const a = w.aSlot[w.tile(6, 5)];
  ok(w.flow[w.tile(7, 5)] === q.AS.FLOW.WATER && w.flow[w.tile(5, 6)] === q.AS.FLOW.NONE, 'the brush leaves water and the hole alone');
  ok(w.aAlight[a] > 0 && w.flow[w.tile(5, 5)] === q.AS.FLOW.FIRE && w.flow[w.tile(6, 4)] === q.AS.FLOW.FIRE, 'the brush lights the animal, the blade and the bare ground');
  ok(lit > 0 && audited(q, 'brush') && failures.length === 0, `FIRE MODE counts what caught (${lit}) and the layers audit`);
}

// ---- fire never spreads onto bare ground, and nothing walks into a painted ember
{
  const s = meadow({ size: [41, 21], settings: { FireSpread: 4 } });
  const { AS, sim, W } = s;
  const bare = [];
  for (let y = 0; y < W.h; y++) for (let x = 20; x < 24; x++) { const t = W.tile(x, y); W.removeGrass(t); bare.push(t); }
  const painted = W.tile(21, 10);
  AS.ignite(sim, painted);   // the only way onto bare ground
  AS.ignite(sim, W.tile(5, 10));
  let onBare = 0;
  for (let i = 0; i < 400 * HOUR_TICKS && W.fCount > 0; i++) {
    sim.tick();
    for (const t of bare) if (t !== painted && W.flow[t] === AS.FLOW.FIRE) onBare++;
  }
  ok(onBare === 0, 'fire never spreads onto bare ground');
  ok(bare.every(t => (t === painted) === (W.scorch[t] > 0)), 'only the painted tile of the bare strip was scorched');
}
{
  // A living world, embers and animals together, asserted every tick.
  const s = stage({ seed: 3, size: [60, 45], bare: false, settings: Object.assign({ StartLayout: 'Meadows' }, FIRE, { FireSpread: 1 }), species: [ANIMAL] });
  const { AS, sim, W } = s;
  const K = AS.KIND;
  let stood = 0, burnedAnimals = 0, ticks = 0, painted = 0;
  const pick = (() => { let x = 12345; return n => { x = (Math.imul(x, 1103515245) + 12345) >>> 0; return x % n; }; })();
  for (let i = 0; i < 4000; i++) {
    if (i % 25 === 0) painted += AS.paintCircle(sim, 'fire', pick(W.w), pick(W.h), 2 + pick(3));
    sim.tick(); ticks++;
    for (let k = 0; k < W.fCount; k++) { const t = W.fList[k]; if (W.kind[t] >= K.BUNNY) stood++; }
    for (let a = 0; a < W.aHigh; a++) {
      if (!W.aAlive[a]) continue;
      if (W.flow[W.aTile[a]] === AS.FLOW.FIRE) stood++;
      if (W.aAlight[a] > 0) burnedAnimals++;
    }
  }
  ok(stood === 0, `no animal ever stood on a burning tile (${ticks} ticks, ${painted} tiles painted, ${burnedAnimals} animal-ticks alight)`);
  ok(burnedAnimals > 0, 'the run did burn animals');
  ok(audited(s, 'embers and animals') && failures.length === 0, 'the layers audit after');
}

// ---- a burning animal lights the fuel beside it, by its species' SpreadFire
{
  const SQ = Math.SQRT1_2;
  // One alight bunny at the middle of a meadow, calm; fireStep run directly (nothing else ticks)
  // for `trials` passes of `dt` hours, putting out what it lit and refilling its fire each time.
  // Returns how often each of the 8 neighbors caught, and the whole count.
  const trial = (share, { trials = 4000, dt = 0.1, tweak = null } = {}) => {
    const s = meadow({ size: 9, settings: { FireSpread: 1 }, animals: [['SpreadFire', 'Bunny', share]] });
    const { AS, sim, W } = s;
    const t = W.tile(4, 4);
    W.removeGrass(t);
    const a = AS.spawnStarting(sim, 0, t);
    AS.ignite(sim, t);   // (counts it as alight, which the fire pass looks at)
    if (tweak) tweak(s, t);
    const rng0 = sim.rng.state();
    const hits = new Array(81).fill(0);
    for (let i = 0; i < trials; i++) {
      W.aAlight[a] = 100;
      AS.fireStep(sim, dt);
      for (let k = W.fCount - 1; k >= 0; k--) { const u = W.fList[k]; hits[u]++; W.removeFire(u); }
    }
    return { s, a, t, hits, trials, dt, drew: sim.rng.state() !== rng0 };
  };
  const rateOf = (r, u) => {   // the chance per pass, turned back into a rate per hour
    const p = r.hits[u] / r.trials;
    return -Math.log(1 - p) / r.dt;
  };
  const half = trial('50%');
  const { W: HW } = half.s;
  const side = rateOf(half, HW.tile(4, 3)), corner = rateOf(half, HW.tile(5, 3));
  ok(Math.abs(side - 0.5) < 0.06, `SpreadFire 50% lights a side neighbor at half a burning tile's rate (${side.toFixed(3)} per hour, want 0.5)`);
  ok(Math.abs(corner - 0.5 * SQ) < 0.06, `and a corner at 1/sqrt 2 of that (${corner.toFixed(3)}, want ${(0.5 * SQ).toFixed(3)})`);
  const full = trial('100%');
  ok(Math.abs(rateOf(full, full.s.W.tile(3, 4)) - 1) < 0.08, `SpreadFire 100% lights a neighbor at a burning tile's whole rate (${rateOf(full, full.s.W.tile(3, 4)).toFixed(3)}, want 1)`);
  // The same pass from a burning tile in the animal's place, for comparison.
  {
    const s = meadow({ size: 9, settings: { FireSpread: 1 } });
    const { AS, sim, W } = s;
    const t = W.tile(4, 4);
    let n = 0;
    for (let i = 0; i < 4000; i++) {
      W.addFire(t, 1000); W.fireAge[t] = 0;
      AS.fireStep(sim, 0.1);
      for (let k = W.fCount - 1; k >= 0; k--) { const u = W.fList[k]; if (u === W.tile(3, 4)) n++; W.removeFire(u); }
    }
    ok(Math.abs(-Math.log(1 - n / 4000) / 0.1 - rateOf(full, full.s.W.tile(3, 4))) < 0.12, 'SpreadFire 100% matches a burning tile\'s own rate on the same neighbor');
  }
  const none = trial('0%', { trials: 600 });
  ok(none.hits.every(n => n === 0), 'SpreadFire 0 lights nothing');
  ok(!none.drew, 'and draws no dice');
  ok(half.hits.every((n, u) => n === 0 || (Math.abs(u % 9 - 4) <= 1 && Math.abs(((u / 9) | 0) - 4) <= 1 && u !== half.t)), 'only the 8 neighbors ever catch');

  // What it won't light: water, a hole, a burning tile, scorch, bare ground, and (by design) another animal.
  const tweak = ({ AS, sim, W }, t) => {
    const at = (dx, dy) => W.tile(4 + dx, 4 + dy);
    const clear = u => { if (W.kind[u] === AS.KIND.GRASS) W.removeGrass(u); };
    clear(at(-1, 0)); W.addWater(at(-1, 0));
    clear(at(1, 0)); W.addHole(at(1, 0));
    clear(at(0, -1));                       // bare
    clear(at(0, 1)); W.scorch[at(0, 1)] = 5; // scorched
    clear(at(-1, -1)); AS.spawnStarting(sim, 1, at(-1, -1));   // another animal
  };
  const r = trial('100%', { trials: 1500, tweak });
  const W2 = r.s.W, at2 = (dx, dy) => W2.tile(4 + dx, 4 + dy);
  ok([[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1]].every(([dx, dy]) => r.hits[at2(dx, dy)] === 0), 'it never lights water, a hole, bare ground, a scorched tile or another animal');
  ok(r.hits[at2(1, 1)] > 0, 'while the grass beside it does catch');
  ok(W2.aAlight[W2.aSlot[at2(-1, -1)]] === 0, 'the other animal stays unlit');

  // A firebreak does not stop a runner: grass | bare strip 3 wide | grass, a bunny alight crossing it.
  {
    const s = meadow({ size: 15, settings: { FireSpread: 1 }, animals: [['SpreadFire', 'Bunny', '100%']] });
    const { AS, sim, W } = s;
    for (let y = 0; y < 15; y++) for (let x = 6; x <= 8; x++) W.removeGrass(W.tile(x, y));
    const a = AS.spawnStarting(sim, 0, W.tile(7, 7));
    AS.ignite(sim, W.tile(7, 7));
    let farLit = false;
    for (let x = 7; x <= 8 && !farLit; x++) {   // the step into the strip's last column is beside the far grass
      if (x !== 7) W.moveAnimal(a, W.tile(x, 7));
      W.aAlight[a] = 100;
      for (let i = 0; i < 200 && !farLit; i++) {
        AS.fireStep(sim, 0.1);
        farLit = W.flow[W.tile(9, 6)] === AS.FLOW.FIRE || W.flow[W.tile(9, 7)] === AS.FLOW.FIRE || W.flow[W.tile(9, 8)] === AS.FLOW.FIRE;
      }
    }
    ok(farLit, 'a burning animal at the far edge of a 3 wide bare strip lights the grass beyond (no fire stood on the strip)');
    ok(![6, 7, 8].some(x => W.flow[W.tile(x, 3)] === AS.FLOW.FIRE) && audited(s, 'runner'), 'the strip itself never burns, and the layers audit');
  }

  // Through the real tick: an animal set alight in a meadow leaves a trail of fire behind it.
  {
    const s = meadow({ size: 31, settings: { FireSpread: 1 }, animals: [['SpreadFire', 'Bunny', '100%'], ['AlightHours', 'Bunny', 8], ['BurnDamage', 'Bunny', 0]] });
    const { AS, sim, W } = s;
    W.removeGrass(W.tile(15, 15));
    const a = AS.spawnStarting(sim, 0, W.tile(15, 15));
    AS.ignite(sim, W.tile(15, 15));
    ok(sim.alightBound > 0, 'an animal set alight is counted');
    hours(sim, 6);
    ok(reached(W) > 0, `a bunny alight in a meadow lights it through the ordinary tick (${reached(W)} tiles reached)`);
    ok(W.aAlight[a] <= 2.5, 'it burns down as before');
    burnOut(sim);
    hours(sim, 10);
    ok(sim.alightBound === 0 && W.fCount === 0, 'when the last fire is out the count is back to zero');
  }

  // No fire and nobody alight: fire.js draws nothing (same dice as with the fire pass removed).
  {
    const run = off => {
      const m = meadow({ size: 15, animals: [['SpreadFire', 'Bunny', '100%']] });
      m.W.removeGrass(m.W.tile(7, 7));
      m.AS.spawnStarting(m.sim, 0, m.W.tile(7, 7));
      if (off) m.AS.fireStep = () => {};
      tick(m.sim, 300);
      return m.sim.rng.state();
    };
    ok(run(false) === run(true), 'with no fire and nobody alight the fire pass draws nothing');
  }
}

// ---- the properties window names the cause
{
  const s = stage({ size: 9, settings: FIRE, species: [quiet.grass, BURN, ANIMAL, [['BurnDamage', 'Bunny', 600]]], files: ['inspect'] });
  const { AS, sim, W } = s;
  const t = W.tile(4, 4);
  AS.spawnStarting(sim, 0, t);
  AS.ignite(sim, t);
  tick(sim, 3);
  const d = AS.describe(sim, { tile: W.cList[0], serial: W.serial[W.cList[0]], slot: -1 });
  const row = d && d.rows.find(r => r.name === 'Cause');
  ok(row && row.value === 'Burned', `the Cause row reads Burned (${row && row.value})`);
}

// ---- the same worlds with no fire in them (the rest of the suite, plus the full-world replay in harness.js, run through the new tick)
{
  const run = () => {
    const s = stage({ seed: 3, size: [60, 45], bare: false, settings: { StartLayout: 'Meadows' } });
    for (let i = 0; i < 3 * 600; i++) s.sim.tick();
    return `${audit(s.AS, s.sim, 'free')} ${s.sim.rng.state()} ${s.W.fCount}`;
  };
  const a = run();
  ok(a === run() && a.endsWith(' 0') && failures.length === 0, `a world nobody lit runs as before: no fire, same dice (${a})`);
}

done('ALL PASS');
