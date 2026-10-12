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

// A world filled with full blades, calm, no water rules, nothing growing or dying.
function meadow({ size = 41, seed = 1, settings = {}, fill = true } = {}) {
  const s = stage({ size, seed, settings: Object.assign({}, FIRE, settings), species: [quiet.grass, BURN] });
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
  const s = stage({ size: 12, settings: FIRE, species: [quiet.grass, BURN] });
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
  ok(!AS.ignite(sim, at(0, 8)), 'bare ground refuses');
  ok(!AS.ignite(sim, at(7, 1)) && W.flow[at(7, 1)] === AS.FLOW.NONE, 'a tile with an animal on it refuses (for now)');
  ok(!AS.ignite(sim, at(9, 1)) && W.flow[at(9, 1)] === AS.FLOW.WATER, 'water refuses');
  ok(!AS.ignite(sim, at(1, 4)), 'a hole with nothing on it refuses');
  ok(!AS.ignite(sim, at(3, 4)), 'a hole with a corpse on it refuses');
  ok(W.fCount === 3, 'three fires burn');
  let threw = 0;
  for (const t of [at(0, 8), at(9, 1), at(1, 1), at(1, 4)]) { try { W.addFire(t, 1); } catch (e) { threw++; } }
  ok(threw === 4, 'W.addFire itself refuses bare ground, water, a burning tile and a hole');
  ok(sim.rng.state() === before, 'lighting a fire draws no dice');
  ok(audited(s, 'ignite') && failures.length === 0, 'the layers audit with three fires');
  ok(AS.fireStage(W, at(1, 1)) === 0 && AS.fireStage(W, at(0, 8)) === 0, 'fireStage starts at 0, and is 0 off fire');
  hours(sim, 2);
  const f = AS.fireStage(W, at(1, 1));
  ok(f > 0.3 && f < 0.7, `fireStage is the share burnt (${f.toFixed(2)} of a 4 h burn after 2 h)`);
}

// ---- a lone blade burns out without a single die rolled, and leaves scorch
{
  const s = stage({ size: 9, settings: FIRE, species: [quiet.grass, BURN] });
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
