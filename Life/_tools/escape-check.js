'use strict';
// Animals and fire (js/escape.js, the ESCAPE state): who runs, where to, and that a world with
// no fire never notices the state exists. Each scene sets the rows it studies, so nothing here
// depends on the shipped numbers, only on their signs.
//   node Life/_tools/escape-check.js
const { audit, failures } = require('./harness.js');
const { stage, tally, quiet, tick, stateName } = require('./kit.js');
const { ok, done } = tally();

// Rows every scene starts from: a fire that effectively doesn't spread (the patch is the patch; FireSpread must be above 0), animals
// that don't tire, starve or hurt much, and set senses so a scene is about fire, not vision.
const BASE = { FireSpread: 1e-9, FireWind: 0, FireDryness: '100%', FireScorchDays: 1 };
const rows = (sp, col, v) => [[sp, col, v]];
const SENSES = [].concat(
  ...['Bunny', 'Wolf', 'Human'].map(sp => [['FireSense', sp, 12], ['StaminaMax', sp, 1000], ['BurnDamage', sp, 1], ['HungerRate', sp, 0], ['ThirstRate', sp, 0]]),
  [['HoleRange', 'Bunny', 8], ['WaterSense', 'Bunny', 40], ['WaterSense', 'Wolf', 40], ['WaterSense', 'Human', 40]]);
function scene({ size = 31, settings = {}, extra = [] } = {}) {
  const s = stage({ size, settings: Object.assign({}, BASE, settings), species: [quiet.grass, quiet.digging, SENSES, extra] });
  s.AS.weatherTick = () => {};
  return s;
}
const SPECIES = ['bunny', 'wolf', 'human'];
const TICKS_S = 30;   // AS.TICK_HZ, ticks in a second
const dist = (W, a, b) => Math.hypot(a % W.w - b % W.w, ((a / W.w) | 0) - ((b / W.w) | 0));
const nearestBurning = (W, t) => { let d = Infinity; for (let k = 0; k < W.fCount; k++) d = Math.min(d, dist(W, t, W.fList[k])); return d; };
// A burning patch (embers lasting `hours`) of side 3 centered on (cx, cy).
function patch(W, cx, cy, hours = 1e4) {
  for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) W.addFire(W.tile(x, y), hours);
}
const stateAt = (AS, sim, a) => stateName(AS, sim, a);

// ---- the table: ESCAPE comes first for everyone
{
  const { AS, T } = scene();
  ok(SPECIES.every(k => T.states[k][0].name === 'ESCAPE' && T.states[k][0].priority === 1), 'ESCAPE is Priority 1 for every species');
}

// ---- flee: an animal near a burning patch runs from it and never steps on it
for (const key of SPECIES) {
  const { AS, sim, W } = scene();
  const sp = AS.SPECIES[key.toUpperCase()];
  patch(W, 15, 15);
  const a = AS.spawnStarting(sim, sp, W.tile(15, 22));   // 6 tiles from the patch's edge, within FireSense
  const start = nearestBurning(W, W.aTile[a]);
  let entered = false, onFire = false;
  for (let i = 0; i < 6 * TICKS_S; i++) {
    tick(sim);
    if (stateAt(AS, sim, a) === 'ESCAPE') entered = true;
    if (W.flow[W.aTile[a]] === AS.FLOW.FIRE) onFire = true;
  }
  const end = nearestBurning(W, W.aTile[a]);
  ok(entered, `${key}: a burning patch in range puts it in ESCAPE`);
  ok(end > start, `${key}: it ends farther from the fire (${start.toFixed(1)} -> ${end.toFixed(1)} tiles)`);
  ok(!onFire && W.aAlight[a] === 0 && W.aAlive[a], `${key}: it never stands on a burning tile, and never catches`);
  ok(audit(AS, sim, 'flee ' + key) && failures.length === 0, `${key}: audit`);
}

// ---- out of range: fire beyond FireSense is none of its business
{
  const { AS, sim, W } = scene();
  patch(W, 3, 3);
  const a = AS.spawnStarting(sim, AS.SPECIES.WOLF, W.tile(26, 26));
  const t0 = W.aTile[a];
  ok(AS.nearestFire(sim, t0, 12) === -1, 'nearestFire sees nothing beyond its range');
  let entered = false;
  for (let i = 0; i < 4 * TICKS_S; i++) { tick(sim); if (stateAt(AS, sim, a) === 'ESCAPE') entered = true; }
  ok(!entered, 'a fire beyond FireSense does not set it running');
}

// ---- nearestFire: the nearest, by either route (a short list, and a list longer than the window)
{
  const { AS, sim, W } = scene({ size: 41 });
  const here = W.tile(20, 20);
  ok(AS.nearestFire(sim, here, 12) === -1, 'no fire: -1');
  W.addFire(W.tile(26, 20), 1e4); W.addFire(W.tile(20, 15), 1e4); W.addFire(W.tile(38, 38), 1e4);
  ok(AS.nearestFire(sim, here, 12) === W.tile(20, 15), 'the nearest of a few');
  ok(AS.nearestFire(sim, here, 4) === -1, 'beyond range: -1');
  for (let y = 30; y < 41; y++) for (let x = 0; x < 41; x++) if (W.flow[W.tile(x, y)] === 0) W.addFire(W.tile(x, y), 1e4);   // more burning tiles than the window holds
  ok(AS.nearestFire(sim, here, 12) === W.tile(20, 15), 'the same nearest when the sweep is by tile');
}

// ---- a bunny with a hole makes for it and sits in it while the fire passes
{
  const { AS, sim, W } = scene({ settings: { FireSpread: 3 } });
  const set = (x, y) => W.tile(x, y);
  for (let t = 0; t < W.n; t++) W.addGrass(t, 1, 0);
  // A bare strip with the hole at its east end; grass touches the hole on all other sides.
  for (let x = 17; x <= 20; x++) W.removeGrass(set(x, 15));
  W.addHole(set(20, 15), 0);
  const b = AS.spawnStarting(sim, AS.SPECIES.BUNNY, set(17, 15));
  AS.ignite(sim, set(2, 15));
  const hole = set(20, 15);
  let onHoleEscape = 0, everAlight = false, hiddenElsewhere = false, burntBeside = false;
  const maxHP = W.aHP[b];
  for (let i = 0; i < 400 * TICKS_S / 10 && (W.fCount > 0 || i < 5); i++) {
    tick(sim);
    if (!W.aAlive[b]) break;
    if (W.aAlight[b] > 0) everAlight = true;
    if (W.aTile[b] === hole && stateAt(AS, sim, b) === 'ESCAPE') onHoleEscape++;
    if (W.aTile[b] !== hole && W.aTile[b] !== set(17, 15) && W.aTile[b] !== set(18, 15) && W.aTile[b] !== set(19, 15)) hiddenElsewhere = true;
  }
  burntBeside = W.scorch[set(20, 14)] > 0 || W.scorch[set(21, 15)] > 0 || W.scorch[set(19, 14)] > 0;
  ok(burntBeside, 'the fire burnt the grass right beside the hole');
  ok(W.aAlive[b] && !everAlight && W.aHP[b] === maxHP, 'the bunny never caught and lost no HP');
  ok(W.aTile[b] === hole && onHoleEscape > 30, `it ran to the hole and sat in it in ESCAPE (${onHoleEscape} ticks)`);
  ok(!hiddenElsewhere, 'it never left the strip');
  ok(W.fCount === 0, 'the fire burnt out');
  // with the fire out ESCAPE lets go
  tick(sim, 3 * TICKS_S);
  ok(stateAt(AS, sim, b) !== 'ESCAPE', 'with the fire out it is no longer in ESCAPE');
  ok(audit(AS, sim, 'hole') && failures.length === 0, 'hole: audit');
}

// ---- a hole farther than the fire is no help: the bunny runs instead
{
  const { AS, sim, W } = scene();
  patch(W, 15, 15);
  W.addHole(W.tile(15, 28), 0);   // far side, farther than the fire
  const b = AS.spawnStarting(sim, AS.SPECIES.BUNNY, W.tile(15, 21));
  const start = nearestBurning(W, W.aTile[b]);
  tick(sim, 3 * TICKS_S);
  ok(nearestBurning(W, W.aTile[b]) > start, 'a hole beyond the fire is ignored: the bunny runs from the fire');
}

// ---- alight: for water when it knows some, else from the fire
{
  // The lake is a column of shallow water (wadeable) at x = 24; the animal starts alight at x = 5.
  const lake = (W, depth = 0.05) => { for (let y = 0; y < W.h; y++) W.addWater(W.tile(24, y), depth); };
  for (const [key, x0] of [['wolf', 14], ['bunny', 5], ['human', 14]]) {
    const { AS, sim, W } = scene({ extra: [['WaterSense', key[0].toUpperCase() + key.slice(1), 60]] });
    lake(W);
    const sp = AS.SPECIES[key.toUpperCase()];
    const a = AS.spawnStarting(sim, sp, W.tile(x0, 15));
    AS.ignite(sim, W.aTile[a]);
    const hp0 = W.aHP[a];
    let entered = false, wet = false, maxD = 0;
    for (let i = 0; i < 12 * TICKS_S && W.aAlive[a]; i++) {
      tick(sim);
      if (stateAt(AS, sim, a) === 'ESCAPE') entered = true;
      if (W.wDepth[W.aTile[a]] > 0) wet = true;
      if (W.aAlight[a] === 0) break;
    }
    ok(entered && wet, `${key}: alight, it makes for the water and stands in it (${x0} -> 24)`);
    ok(W.aAlive[a] && W.aAlight[a] === 0, `${key}: the water puts it out and it lives (HP ${W.aHP[a].toFixed(1)} of ${hp0})`);
    ok(audit(AS, sim, 'alight ' + key) && failures.length === 0, `${key}: alight audit`);
  }
  // Water beyond what it knows (WaterSense short), with a fire beside it: it runs from the fire.
  {
    const { AS, sim, W } = scene({ extra: [['WaterSense', 'Wolf', 3]] });
    lake(W);
    patch(W, 7, 15);
    const a = AS.spawnStarting(sim, AS.SPECIES.WOLF, W.tile(7, 19));
    AS.ignite(sim, W.aTile[a]);
    const start = nearestBurning(W, W.aTile[a]);
    let wet = false;
    for (let i = 0; i < 3 * TICKS_S && W.aAlive[a]; i++) { tick(sim); if (W.wDepth[W.aTile[a]] > 0) wet = true; }
    ok(!wet && nearestBurning(W, W.aTile[a]) > start, 'alight with water beyond WaterSense, it flees the fire instead');
  }
  // No water in the world at all: the same.
  {
    const { AS, sim, W } = scene();
    patch(W, 7, 15);
    const a = AS.spawnStarting(sim, AS.SPECIES.HUMAN, W.tile(7, 19));
    AS.ignite(sim, W.aTile[a]);
    const start = nearestBurning(W, W.aTile[a]);
    tick(sim, 3 * TICKS_S);
    ok(stateAt(AS, sim, a) === 'ESCAPE' && nearestBurning(W, W.aTile[a]) > start, 'alight with no water anywhere, it flees the fire');
  }
  // Alight, no fire to run from and no water: nothing for ESCAPE to do, so it does not enter.
  {
    const { AS, sim, W } = scene();
    const a = AS.spawnStarting(sim, AS.SPECIES.WOLF, W.tile(7, 19));
    AS.ignite(sim, W.aTile[a]);
    ok(AS.escapeState.enter(sim, a) === false, 'alight with nothing to run from or to: ESCAPE does not enter');
  }
}

// ---- no fire anywhere: ESCAPE never enters and draws nothing
{
  const { AS, sim, W } = scene({ settings: { StartBunnies: 6, StartWolves: 3 }, extra: [] });
  for (let t = 0; t < 40; t++) { const e = W.tile(t % 31, 3 + ((t / 31) | 0) * 4); if (W.kind[e] === 0 && W.flow[e] === 0) AS.spawnStarting(sim, AS.SPECIES.BUNNY, e); }
  AS.spawnStarting(sim, AS.SPECIES.WOLF, W.tile(20, 20));
  AS.spawnStarting(sim, AS.SPECIES.HUMAN, W.tile(22, 22));
  let drew = false, entered = false;
  for (let i = 0; i < 20; i++) {
    for (let s = 0; s < W.aHigh; s++) {
      if (!W.aAlive[s]) continue;
      const before = sim.rng.state();
      if (AS.escapeState.enter(sim, s)) entered = true;
      if (sim.rng.state() !== before) drew = true;
    }
    tick(sim, 15);
  }
  ok(!entered && !drew, 'with no fire ESCAPE never enters and the rng state never moves');
  ok(AS.nearestFire(sim, W.tile(5, 5), 12) === -1, 'nearestFire with no fire is -1');
}

// ---- ESCAPE outranks everything
{
  // A lake so thirst counts; every animal starving, dry and tired, with food, prey or a hunter in sight.
  const { AS, sim, W } = scene({ size: 41 });
  for (let y = 0; y < W.h; y++) W.addWater(W.tile(38, y), 0.05);
  patch(W, 20, 20);
  const bunny = AS.spawnStarting(sim, AS.SPECIES.BUNNY, W.tile(20, 27));
  const wolfNearBunny = AS.spawnStarting(sim, AS.SPECIES.WOLF, W.tile(23, 27));   // hunts the bunny; the bunny would FLEE
  const bunnyFood = W.tile(19, 27);
  W.addGrass(bunnyFood, 1, 0);
  const wolf = AS.spawnStarting(sim, AS.SPECIES.WOLF, W.tile(27, 20));
  const prey = AS.spawnStarting(sim, AS.SPECIES.BUNNY, W.tile(31, 20));   // a bunny the hungry wolf sees
  const human = AS.spawnStarting(sim, AS.SPECIES.HUMAN, W.tile(20, 13));
  for (const a of [bunny, wolf, human]) { W.aFullness[a] = 0; W.aWater[a] = 0; W.aStamina[a] = 1; W.aDecideLeft[a] = 0; }
  // (a wolf next to the bunny is a hunter in sight; the hungry wolf has prey in sight)
  tick(sim);
  ok(stateAt(AS, sim, bunny) === 'ESCAPE', 'a hungry, thirsty bunny with a wolf in sight escapes the fire first');
  ok(stateAt(AS, sim, wolf) === 'ESCAPE', 'a hungry, thirsty wolf with prey in sight escapes the fire first');
  ok(stateAt(AS, sim, human) === 'ESCAPE', 'a hungry, thirsty human escapes the fire first');
  ok(wolfNearBunny >= 0 && prey >= 0, 'scene set up');
}

done('ALL PASS');
