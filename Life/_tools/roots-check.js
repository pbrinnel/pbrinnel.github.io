'use strict';
// Roots (fire.js leaves them, grass.js resprouts from them, world.js/paint.js end them): that
// burning out leaves them on about RootSurvive of the blades and on no body or ember, that nothing
// resprouts during the scorch, that afterward they resprout at about the ResproutChance hazard (and
// faster on ash), that a resprout is an ordinary new blade, what ends them, and that a world with no
// fire never has any. Each scene sets the rows it studies, so nothing depends on the shipped
// numbers, only on their signs.
//   node Life/_tools/roots-check.js
const { audit, failures } = require('./harness.js');
const { stage, tally, quiet, days } = require('./kit.js');
const { ok, done } = tally();

const FIRE = { FireSpread: 1e-9, FireWind: 0, FireDryness: '100%', FireScorchDays: 2, AshHalfLife: 1e6 };   // a fire that never spreads, ash that never weathers
const GROW0 = [['SeedChance', 'Grass', '0%'], ['SproutChance', 'Grass', '0%'], ['GrowthRate', 'Grass', 0]];
const world = (o = {}) => stage({ size: o.size || [30, 30], seed: o.seed || 3, settings: Object.assign({}, FIRE, o.settings), species: o.species || [GROW0] });
const burn = (AS, sim, t) => { AS.ignite(sim, t); AS.fireStep(sim, 1e3); };
const countRoots = W => { let n = 0; for (let t = 0; t < W.n; t++) if (W.roots[t]) n++; return n; };

// ---- what burning out leaves
for (const [share, lo, hi] of [[0, 0, 0], [1, 1, 1], [0.4, 0.3, 0.5]]) {
  const { AS, sim, W } = world({ settings: { RootSurvive: share * 100 + '%' }, size: [60, 40] });
  let blades = 0;
  for (let t = 0; t < W.n; t++) { W.addGrass(t, 0.5 + (t % 5) * 0.1, 0); blades++; }
  ok(countRoots(W) === 0, 'a fresh world has no roots');
  for (let t = 0; t < W.n; t++) burn(AS, sim, t);
  const got = countRoots(W) / blades;
  ok(W.fCount === 0 && W.gCount === 0, 'the blades are all burnt out');
  ok(got >= lo && got <= hi, `RootSurvive ${share * 100}%: ${(got * 100).toFixed(1)}% of ${blades} burnt blades kept roots`);
  ok(audit(AS, sim, 'burnt meadow') && failures.length === 0, 'audit after');
}
{
  const { AS, sim, W } = world({ settings: { RootSurvive: '100%' }, species: [GROW0, [['Ash', 'Bunny', 1]]] });
  const body = W.tile(3, 3), ember = W.tile(6, 3), lit = W.tile(9, 3);
  W.addCorpse(body, AS.SPECIES.BUNNY, 0); AS.corpseAdded(sim, body);
  ok(AS.ignite(sim, ember) && W.kind[ember] === AS.KIND.EMPTY, 'an ember is lit on bare ground');
  W.addGrass(lit, 1, 0);
  burn(AS, sim, body); AS.ignite(sim, ember); AS.fireStep(sim, 1e3);
  ok(W.roots[body] === 0 && W.roots[ember] === 0, 'a burnt body and an ember leave no roots, however sure the survival');
  burn(AS, sim, lit);
  ok(W.roots[lit] === 1, 'a blade does, at 100%');
  W.addGrass(W.tile(12, 3), 1, 4.5); burn(AS, sim, W.tile(12, 3));
  ok(W.rootAge[W.tile(12, 3)] === 4.5, 'and the roots are as old as the blade was');
}

// ---- nothing resprouts during the scorch; afterward a resprout is an ordinary new blade
{
  const { AS, sim, W, T } = world({ settings: { ResproutChance: '100%' } });
  const t = W.tile(4, 4);
  W.roots[t] = 1; W.rootAge[t] = 3; W.scorch[t] = 1;
  for (let i = 0; i < days(AS, 0.8); i++) sim.tick();
  ok(W.kind[t] === AS.KIND.EMPTY && W.roots[t] === 1, 'no resprout while the tile is scorched, however sure the chance');
  let i = 0;
  for (; i < days(AS, 0.5) && W.kind[t] === AS.KIND.EMPTY; i++) sim.tick();
  ok(W.kind[t] === AS.KIND.GRASS, 'a blade comes once the scorch is over');
  const under = days(AS, 0.8) / (AS.TICK_HZ * AS.DAY_SECONDS) + i / (AS.TICK_HZ * AS.DAY_SECONDS);   // days underground, to the tick
  ok(W.scorch[t] === 0 && W.gSize[t] === Math.fround(T.grass.SproutSize), `it is a small blade of SproutSize (${W.gSize[t]})`);
  ok(Math.abs(W.gAge[t] - (3 + under)) < 0.1 && W.gAge[t] > 3.5, `it carries the burnt blade's age plus the time underground (${W.gAge[t].toFixed(2)} from 3)`);
  ok(W.roots[t] === 0 && W.rootAge[t] === 0, 'and the resprout spends the roots and their age');
  ok(audit(AS, sim, 'resprouted') && failures.length === 0, 'audit after');
}

// ---- the rate: the hazard of ResproutChance per day, faster on ash, waiting at 0
{
  const run = (chance, d, prep) => {
    const s = world({ size: [40, 40], settings: { ResproutChance: chance, AshBoost: 4 } });
    for (let t = 0; t < s.W.n; t++) s.W.roots[t] = 1;
    if (prep) prep(s);
    for (let i = 0; i < days(s.AS, d); i++) s.sim.tick();
    return s;
  };
  const day = run('30%', 1);
  const share = day.W.gCount / day.W.n;
  ok(share > 0.22 && share < 0.38, `after a day about ResproutChance (30%) of root tiles resprouted (${(share * 100).toFixed(1)}%)`);
  ok(countRoots(day.W) === day.W.n - day.W.gCount, 'every resprout spent its roots and nothing else did');
  const ash = run('30%', 0.25, s => { for (let t = 0; t < s.W.n; t++) if (s.W.tx(t) < s.W.w / 2) s.W.ash[t] = 1; });
  let left = 0, right = 0;
  for (let t = 0; t < ash.W.n; t++) if (ash.W.kind[t] === ash.AS.KIND.GRASS) (ash.W.tx(t) < ash.W.w / 2 ? left++ : right++);
  ok(left > right * 1.5 && right > 0, `roots on ash resprout faster (${left} on ash, ${right} on plain ground)`);
  const none = run('0%', 3);
  ok(none.W.gCount === 0 && countRoots(none.W) === none.W.n, 'at 0% the roots simply wait');
  ok(audit(none.AS, none.sim, 'waiting') && failures.length === 0, 'audit after');
}

// ---- roots age and die at the Lifespan without resprouting
{
  const { AS, sim, W, T } = world({ settings: { ResproutChance: '0%' } });
  const young = W.tile(3, 3), old = W.tile(5, 3), hot = W.tile(7, 3);
  W.roots[young] = 1; W.rootAge[young] = 0;
  W.roots[old] = 1; W.rootAge[old] = T.grass.Lifespan - 1;
  W.roots[hot] = 1; W.rootAge[hot] = T.grass.Lifespan - 1; W.scorch[hot] = 5;
  for (let i = 0; i < days(AS, 0.5); i++) sim.tick();
  ok(Math.abs(W.rootAge[young] - 0.5) < 0.1 && W.roots[young] === 1, `roots age like a blade (${W.rootAge[young].toFixed(2)} days after half a day)`);
  ok(W.roots[old] === 1 && W.roots[hot] === 1, 'roots near the Lifespan are still there');
  for (let i = 0; i < days(AS, 0.7); i++) sim.tick();
  ok(W.roots[old] === 0 && W.rootAge[old] === 0 && W.roots[hot] === 0 && W.rootAge[hot] === 0 && W.gCount === 0, 'roots that reach the Lifespan die (scorched or not), and put up nothing');
  ok(W.roots[young] === 1, 'younger roots go on waiting');
  ok(audit(AS, sim, 'aged') && failures.length === 0, 'audit after');
}

// ---- what ends roots
{
  const s = world({ settings: { ResproutChance: '0%' } }), { AS, sim, W } = s;
  const wet = W.tile(2, 2), dry = W.tile(3, 2), hole = W.tile(5, 2), laid = W.tile(7, 2), painted = W.tile(9, 2), far = W.tile(25, 25);
  for (const t of [wet, dry, hole, laid, painted, far]) { W.roots[t] = 1; W.rootAge[t] = 2; }
  W.setDepth(wet, 0.5); ok(W.roots[wet] === 0, 'water covering a tile ends its roots');
  W.setDepth(wet, 0); ok(W.roots[wet] === 0, 'and drying out does not bring them back');
  W.addHole(hole, 0); ok(W.roots[hole] === 0, 'a hole dug on it ends them');
  W.addWater(laid, 0.3); ok(W.roots[laid] === 0, 'laid water ends them');
  W.addGrass(painted, 1, 0); ok(W.roots[painted] === 0, 'a blade put there (painted) ends them');
  ok([wet, hole, laid, painted].every(t => W.rootAge[t] === 0), 'and each takes their age with them');
  ok(W.roots[dry] === 1 && W.roots[far] === 1 && W.rootAge[dry] === 2, 'tiles nothing touched keep theirs');
  const o = stage({ size: 41, settings: FIRE, species: [quiet.grass] });
  const a = o.W.tile(20, 20), b = o.W.tile(21, 20), out = o.W.tile(2, 2);
  for (const t of [a, b, out]) { o.W.roots[t] = 1; o.W.rootAge[t] = 2; }
  o.AS.nuke(o.sim, a, 3);
  ok(o.W.roots[a] === 0 && o.W.roots[b] === 0 && o.W.roots[out] === 1 && o.W.rootAge[a] === 0 && o.W.rootAge[b] === 0, 'a nuke ends the roots in its circle only');
  ok(audit(AS, sim, 'ended') && failures.length === 0 && audit(o.AS, o.sim, 'nuked') && failures.length === 0, 'audits after');
}
{
  // A seed landing first: the neighbors of a seeding blade hold roots (resprouting off).
  const { AS, sim, W } = world({ settings: { ResproutChance: '0%' }, species: [[['SeedChance', 'Grass', '100%'], ['SproutChance', 'Grass', '0%'], ['GrowthRate', 'Grass', 0]]] });
  const c = W.tile(10, 10);
  W.addGrass(c, 1, 0);
  const nbs = [W.tile(9, 10), W.tile(11, 10), W.tile(10, 9), W.tile(10, 11)];
  for (const t of nbs) W.roots[t] = 1;
  for (let i = 0; i < days(AS, 1); i++) sim.tick();
  let seeded = 0, stale = 0;
  for (let t = 0; t < W.n; t++) if (W.kind[t] === AS.KIND.GRASS && W.roots[t]) stale++;
  for (const t of nbs) if (W.kind[t] === AS.KIND.GRASS) seeded++;
  ok(seeded > 0 && stale === 0, `a seed landing on root tiles ends their roots (${seeded} seeded, ${stale} blades still holding roots)`);
  ok(audit(AS, sim, 'seeded') && failures.length === 0, 'audit after');
}

// ---- a world with no fire never has roots
{
  const s = stage({ size: [40, 30], bare: false, seed: 9, settings: { RootSurvive: '100%', ResproutChance: '100%' } });
  for (let i = 0; i < days(s.AS, 3); i++) s.sim.tick();
  ok(countRoots(s.W) === 0, 'no fire, no roots');
  ok(audit(s.AS, s.sim, 'no fire') && failures.length === 0, 'audit after');
}

done('ALL PASS');
