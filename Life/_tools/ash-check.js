'use strict';
// Ash (fire.js leaves it, grass.js spends and weathers it, world.js/paint.js wash it off): what
// burning out leaves, that nothing grows during the scorch, the boosts and their accounting, the
// half-life, no stacking with a corpse, and that a world with no fire never sees any. Each scene
// sets the rows it studies, so nothing depends on the shipped numbers, only on their signs.
//   node Life/_tools/ash-check.js
const { audit, failures } = require('./harness.js');
const { stage, tally, quiet, days } = require('./kit.js');
const { ok, done } = tally();

const HOUR = 25;   // AS.TICKS_PER_HOUR, checked below
const near = (a, b, tol = 1e-4) => Math.abs(a - b) <= tol;
const FIRE = { FireSpread: 1e-9, FireWind: 0, FireDryness: '100%', FireScorchDays: 2, AshHalfLife: 1e6 };   // a fire that never spreads, ash that never weathers
// Tiles on one row of a world as wide as an hour is long are visited at the same tick of every
// hour, so two tiles in a column grow the same number of hours: the pairs below rely on it.
const column = (AS, W, x, y) => W.tile(x, y);
const burn = (AS, sim, t) => { AS.ignite(sim, t); AS.fireStep(sim, 1e3); };
const GROW = (rate) => [['SeedChance', 'Grass', '0%'], ['SproutChance', 'Grass', '0%'], ['GrowthRate', 'Grass', rate]];
const world = (o = {}) => stage({ size: [HOUR, o.rows || 8], seed: o.seed || 3, settings: Object.assign({}, FIRE, o.settings), species: o.species || [quiet.grass, [['Ash', 'Grass', 1.5], ['Ash', 'Bunny', 2.5], ['Ash', 'Wolf', 3.5]]] });

{
  const { AS } = world();
  ok(AS.TICKS_PER_HOUR === HOUR, 'the check\'s hour is the sim\'s');
}

// ---- what burning out leaves
{
  const s = world(), { AS, sim, W, T } = s;
  const full = W.tile(2, 2), half = W.tile(4, 2), body = W.tile(6, 2), wolf = W.tile(8, 2), twice = W.tile(12, 2);
  W.addGrass(full, 1, 0); W.addGrass(half, 0.5, 0);
  W.addCorpse(body, AS.SPECIES.BUNNY, 0); AS.corpseAdded(sim, body);
  W.addCorpse(wolf, AS.SPECIES.WOLF, 0); AS.corpseAdded(sim, wolf);
  ok(W.ash.every(a => a === 0), 'a fresh world has no ash');
  for (const t of [full, half, body, wolf]) burn(AS, sim, t);
  ok(W.fCount === 0, 'the fires are out');
  ok(near(W.ash[full], T.grass.Ash), `a full blade leaves Ash[Grass] (${W.ash[full]})`);
  ok(near(W.ash[half], T.grass.Ash * 0.5), 'a half blade leaves half as much, by its Size');
  ok(near(W.ash[body], T.bunny.Ash) && near(W.ash[wolf], T.wolf.Ash), 'a body leaves its species\' Ash');
  ok(W.scorch[full] > 0, 'the ground is scorched too');
  // A painted ember on bare ground has no fuel and leaves none.
  const e2 = W.tile(14, 2);
  ok(AS.ignite(sim, e2) && W.kind[e2] === AS.KIND.EMPTY, 'an ember is lit on bare ground');
  AS.fireStep(sim, 1e3);
  ok(W.ash[e2] === 0 && W.scorch[e2] > 0, 'a painted ember leaves scorch but no ash');
  // It adds to ash already there, and an ember leaves what was there alone.
  W.ash[twice] = 0.7; W.addGrass(twice, 1, 0); burn(AS, sim, twice);
  ok(near(W.ash[twice], 0.7 + T.grass.Ash), 'a second burn adds to the ash already there');
  const e3 = W.tile(16, 2); W.ash[e3] = 0.4; AS.ignite(sim, e3); AS.fireStep(sim, 1e3);
  ok(near(W.ash[e3], 0.4), 'an ember on ash leaves it as it was');
  // A burning animal leaves nothing until its body burns.
  const a = W.tile(18, 2); W.addAnimal(a, AS.SPECIES.BUNNY, 0); AS.ignite(sim, a);
  ok(W.ash[a] === 0, 'a burning animal leaves no ash');
  ok(audit(AS, sim, 'burn-outs') && failures.length === 0, 'audit after');
}

// ---- nothing grows during the scorch, and the ash weathers meanwhile
{
  const s = world({ settings: { AshHalfLife: 2 }, species: [[['SeedChance', 'Grass', '0%'], ['SproutChance', 'Grass', '100%'], ['GrowthRate', 'Grass', 1]]] });
  const { AS, sim, W } = s, t = W.tile(3, 3);
  W.ash[t] = 2; W.scorch[t] = 1;
  for (let i = 0; i < days(AS, 0.8); i++) { sim.tick(); if (W.kind[t] !== AS.KIND.EMPTY) break; }
  ok(W.kind[t] === AS.KIND.EMPTY, 'no blade sprouts while the tile is scorched, however sure the sprouting');
  ok(W.ash[t] < 2 && W.ash[t] > 1, `the ash weathers during the scorch (${W.ash[t].toFixed(3)} of 2)`);
  for (let i = 0; i < days(AS, 0.4); i++) sim.tick();
  ok(W.scorch[t] === 0 && W.kind[t] === AS.KIND.GRASS, 'a blade comes once the scorch is over');
}

// ---- growth on ash is faster and costs exactly the ash it gave
{
  const s = world({ settings: { AshBoost: 3 }, species: [GROW(0.2)] });
  const { AS, sim, W } = s, a = column(AS, W, 3, 1), b = column(AS, W, 3, 2), c = column(AS, W, 3, 3);
  W.addGrass(a, 0.2, 0); W.addGrass(b, 0.2, 0); W.addGrass(c, 0.2, 0);
  W.ash[a] = 5; W.ash[c] = 0.1;
  for (let i = 0; i < days(AS, 1); i++) sim.tick();
  ok(W.gSize[a] > W.gSize[b] + 0.1, `a blade on ash grows faster (${W.gSize[a].toFixed(3)} against ${W.gSize[b].toFixed(3)})`);
  ok(near(5 - W.ash[a], W.gSize[a] - W.gSize[b], 1e-3), `the extra growth equals the ash spent (${(W.gSize[a] - W.gSize[b]).toFixed(4)} grown, ${(5 - W.ash[a]).toFixed(4)} spent)`);
  ok(near(W.gSize[c] - W.gSize[b], 0.1, 1e-3) && W.ash[c] === 0, 'a little ash gives only its worth of growth, and is then gone');
  ok(audit(AS, sim, 'growth') && failures.length === 0, 'audit after');
}

// ---- sprouting and seeding are boosted on ash (a gross comparison, same world)
for (const what of ['sprout', 'seed']) {
  const rows = what === 'sprout'
    ? [['SeedChance', 'Grass', '0%'], ['SproutChance', 'Grass', '3%'], ['GrowthRate', 'Grass', 0]]
    : [['SeedChance', 'Grass', '5%'], ['SproutChance', 'Grass', '0%'], ['GrowthRate', 'Grass', 0]];
  const s = stage({ size: [40, 40], seed: 5, settings: Object.assign({}, FIRE, { AshBoost: 3 }), species: [rows] });
  const { AS, sim, W } = s, half = W.w / 2;
  const before = new Set();
  for (let y = 0; y < W.h; y++) for (let x = 0; x < W.w; x++) {
    const t = W.tile(x, y);
    if (x < half) W.ash[t] = 1;
    if (what === 'seed' && x % 2 === 0 && y % 2 === 0) { W.addGrass(t, 1, 0); before.add(t); }
  }
  for (let i = 0; i < days(AS, 1); i++) sim.tick();
  let left = 0, right = 0;
  for (let t = 0; t < W.n; t++) if (W.kind[t] === AS.KIND.GRASS && !before.has(t)) (W.tx(t) < half ? left++ : right++);
  ok(left > right * 1.5 && right > 0, `${what}: new blades on ash ${left}, on plain ground ${right}`);
}

// ---- weathering: a half-life, and gone for good
{
  const s = world({ settings: { AshHalfLife: 2 }, species: [quiet.grass] });
  const { AS, sim, W } = s, t = W.tile(4, 4);
  W.ash[t] = 8;
  for (let i = 0; i < days(AS, 4); i++) sim.tick();
  ok(near(W.ash[t] / 8, 0.25, 0.01), `after two half-lives a quarter is left (${(W.ash[t] / 8).toFixed(3)})`);
  let prev = W.ash[t], monotone = true;
  for (let d = 0; d < 40; d++) { for (let i = 0; i < days(AS, 1); i++) sim.tick(); if (W.ash[t] > prev || W.ash[t] < 0) monotone = false; prev = W.ash[t]; }
  ok(monotone && W.ash[t] === 0, `it only ever falls, and reaches exactly 0 (${W.ash[t]})`);
  ok(audit(AS, sim, 'weathered') && failures.length === 0, 'audit after');
}

// ---- a corpse and ash on one tile: the larger boost only, paid from its own source
for (const [corpseBoost, ashBoost, who] of [[5, 2, 'the corpse'], [2, 4, 'the ash'], [3, 3, 'the ash (a tie)']]) {
  const s = world({ settings: { AshBoost: ashBoost }, species: [GROW(0.1), [['CorpseBoost', 'Bunny', corpseBoost], ['CorpseNutrient', 'Bunny', 100], ['CorpseDecay', 'Bunny', 100], ['CorpseRadius', 'Bunny', 4]]] });
  const { AS, sim, W } = s, c = W.tile(10, 4), a = W.tile(11, 4), b = W.tile(11, 5);
  W.addCorpse(c, AS.SPECIES.BUNNY, 0); AS.corpseAdded(sim, c);
  W.addGrass(a, 0.1, 0); W.addGrass(b, 0.1, 0); W.ash[a] = 5;
  const nut0 = W.cNut[c];
  for (let i = 0; i < days(AS, 1); i++) sim.tick();
  const ashWins = ashBoost >= corpseBoost, plain = 0.1 * 1, grown = W.gSize[a] - 0.1, big = Math.max(corpseBoost, ashBoost);
  ok(near(grown / plain, big, 0.05), `${who} boosts a tile with both, once (${(grown / plain).toFixed(2)} times the plain growth, not ${corpseBoost * ashBoost})`);
  ok(near(W.gSize[b] - 0.1, plain * corpseBoost, 1e-3), 'the neighbor with only the corpse is boosted by it');
  ok(ashWins ? near(5 - W.ash[a], grown - plain, 1e-3) : near(W.ash[a], 5, 1e-3), `${who}: ash ${ashWins ? 'pays for the extra' : 'is left alone'}`);
  // The neighbor with no ash always drinks the corpse; the tile with both drinks it only when it wins.
  const drunk = nut0 - W.cNut[c], want = plain * (corpseBoost - 1) * (ashWins ? 1 : 2);
  ok(near(drunk, want, 1e-3), `${who}: the corpse paid ${drunk.toFixed(3)} (expected ${want.toFixed(3)})`);
}

// ---- water washes it off, a nuke leaves none
{
  const s = world({ species: [quiet.grass] });
  const { AS, sim, W } = s, t = W.tile(5, 5), u = W.tile(20, 2);
  W.ash[t] = 1; W.ash[u] = 1;
  W.setDepth(t, 0.5);
  ok(W.ash[t] === 0, 'ground that goes under water loses its ash');
  W.setDepth(t, 0);
  ok(W.ash[t] === 0, 'and drying out does not bring it back');
  const o = stage({ size: 41, settings: FIRE, species: [quiet.grass] });
  const ax = o.W.tile(20, 20), bx = o.W.tile(21, 20), far = o.W.tile(2, 2);
  o.W.ash[ax] = 2; o.W.ash[bx] = 2; o.W.ash[far] = 2;
  o.AS.nuke(o.sim, ax, 3);
  ok(o.W.ash[ax] === 0 && o.W.ash[bx] === 0 && o.W.scorch[ax] > 0, 'a nuke clears the ash in its circle (and scorches it)');
  ok(near(o.W.ash[far], 2), 'and leaves ash outside it alone');
  o.W.addGrass(o.W.tile(5, 5), 1, 0); o.W.addCorpse(o.W.tile(30, 30), o.AS.SPECIES.WOLF, 0); o.AS.corpseAdded(o.sim, o.W.tile(30, 30));
  o.AS.nuke(o.sim, o.W.tile(10, 10), 40);
  let any = 0; for (let i = 0; i < o.W.n; i++) if (o.W.ash[i] > 0) any++;
  ok(any === 0, 'a nuke over blades and bodies leaves no ash at all');
  ok(audit(o.AS, o.sim, 'nuked') && failures.length === 0, 'audit after');
}

// ---- a world with no fire never has ash, and the boost never applies
{
  const run = boost => {
    const s = stage({ size: [40, 30], bare: false, seed: 9, settings: { AshBoost: boost } });
    for (let i = 0; i < days(s.AS, 3); i++) s.sim.tick();
    return s;
  };
  const a = run(1), b = run(7);
  let ash = 0; for (let t = 0; t < a.W.n; t++) if (a.W.ash[t] !== 0) ash++;
  ok(ash === 0, 'no fire, no ash');
  ok(a.sim.rng.state() === b.sim.rng.state() && a.W.gCount === b.W.gCount, 'AshBoost makes no difference to a world without ash (same dice, same meadow)');
  ok(audit(a.AS, a.sim, 'no fire') && failures.length === 0, 'audit after');
}

done('ALL PASS');
