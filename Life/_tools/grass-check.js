'use strict';
const { stage, tally, editCSV } = require('./kit.js');
const { ok, done } = tally();

// Sprouting off unless a test turns it on, so seeding counts only seeding.
const make = (size, seed = 1, edit) => stage({ size, seed, species: [[['SproutChance', 'Grass', '0%']]], edit });
const day = AS => AS.TICK_HZ * AS.DAY_SECONDS;

// (a) lone sprout fills in 1/GrowthRate days, within the hour its growth comes in
{
  const { AS, T, sim } = make(9);
  const W = sim.W, t = W.tile(4, 4);
  W.addGrass(t, 0, 0);
  const ticks = Math.round(day(AS) / T.grass.GrowthRate);
  let full = -1;
  for (let i = 0; i < ticks + 2 * AS.TICKS_PER_HOUR && full < 0; i++) { sim.tick(); if (W.gSize[t] >= 1 - 1e-5) full = i + 1; }
  ok(full > 0 && Math.abs(full - ticks) <= AS.TICKS_PER_HOUR && W.gSize[t] <= 1, `a: sprout full at tick ${full}, 1/GrowthRate days is ${ticks} (within an hour = ${AS.TICKS_PER_HOUR})`);
}

// (b) seeding rate matches SeedChance
{
  const { AS, T } = make(9);
  const trials = 2000;
  let hit = 0;
  for (let n = 0; n < trials; n++) {
    const { AS: A, sim } = make(9, 1000 + n);
    const W = sim.W, t = W.tile(4, 4);
    W.addGrass(t, 1, 0);
    // One day, but age is stable only if Lifespan > 1 day; the blade's neighbors are checked for births.
    for (let i = 0; i < day(A); i++) sim.tick();
    if (W.gCount > 1) hit++;
  }
  const rate = hit / trials;
  ok(Math.abs(rate - T.grass.SeedChance) <= 0.03, `b: seeded in ${(rate * 100).toFixed(1)}% of days, SeedChance ${(T.grass.SeedChance * 100)}%`);
}

// (c) death within an hour after Lifespan
{
  const { AS, T, sim } = make(9);
  const W = sim.W, t = W.tile(4, 4);
  W.addGrass(t, 1, 0);
  // Keep it alone: SeedChance 0 would be cleaner but we want the real CSV, so remove offspring.
  const lifeTicks = T.grass.Lifespan * day(AS);
  let diedAt = -1;
  for (let i = 0; i < lifeTicks + AS.TICKS_PER_HOUR * 2 && diedAt < 0; i++) {
    sim.tick();
    for (let u = W.gCount - 1; u >= 0; u--) { const x = W.gList[u]; if (x !== t) W.removeGrass(x); }
    if (W.kind[t] !== AS.KIND.GRASS) diedAt = i + 1;
  }
  const late = diedAt - lifeTicks;
  ok(diedAt > 0 && Math.abs(late) <= AS.TICKS_PER_HOUR, `c: died ${late.toFixed(1)} ticks after Lifespan (negative = early by its roll phase; must be within one hour = = ${AS.TICKS_PER_HOUR})`);
}

// (d) boosted growth, nutrient paid exactly
{
  const { AS, T, sim } = make(9);
  const W = sim.W, c = W.tile(4, 4), g = W.tile(5, 4);
  W.addCorpse(c, AS.SPECIES.WOLF); AS.corpseAdded(sim, c);
  W.addGrass(g, 0, 0);
  // Grass grows once an hour, an hour's worth, so each of these runs one hour.
  const hour = AS.TICKS_PER_HOUR, base = T.grass.GrowthRate * hour * AS.DT_DAYS;
  const nut0 = W.cNut[c], boost = T.wolf.CorpseBoost;
  for (let i = 0; i < hour; i++) sim.tick();
  const grown = W.gSize[g], used = nut0 - W.cNut[c];
  ok(Math.abs(grown - base * boost) < 1e-7, `d: boosted growth ${grown.toExponential(3)} = ${boost} x base ${base.toExponential(3)}`);
  ok(Math.abs(used - (grown - base)) < 1e-6, `d: nutrient fell ${used.toExponential(3)} = extra growth ${(grown - base).toExponential(3)}`);
  // A full blade drinks nothing
  const { AS: A2, sim: s2 } = make(9);
  s2.W.addCorpse(s2.W.tile(4, 4), A2.SPECIES.WOLF); A2.corpseAdded(s2, s2.W.tile(4, 4));
  s2.W.addGrass(s2.W.tile(5, 4), 1, 0);
  const n0 = s2.W.cNut[s2.W.tile(4, 4)]; for (let i = 0; i < hour; i++) s2.tick();
  ok(s2.W.cNut[s2.W.tile(4, 4)] === n0, 'd: a full blade does not drink');
  // Outside the radius: no boost
  const { AS: A3, sim: s3 } = make(15);
  const c3 = s3.W.tile(7, 7), far = s3.W.tile(7 + Math.ceil(T.wolf.CorpseRadius) + 1, 7);
  s3.W.addCorpse(c3, A3.SPECIES.WOLF); A3.corpseAdded(s3, c3); s3.W.addGrass(far, 0, 0); for (let i = 0; i < hour; i++) s3.tick();
  ok(Math.abs(s3.W.gSize[far] - base) < 1e-7, 'd: grass outside CorpseRadius grows at base rate');   // sizes are float32
}

// (e) decay, drain, handover
{
  const { AS, T, sim } = make(15);
  const W = sim.W, a = W.tile(5, 7), b = W.tile(8, 7);
  const sources = () => { const s = new Set(); for (let t = 0; t < W.n; t++) if (W.boostSrc[t] >= 0) s.add(W.boostSrc[t]); return s; };
  W.addCorpse(a, AS.SPECIES.BUNNY); AS.corpseAdded(sim, a);
  const decay = T.bunny.CorpseDecay;
  let gone = -1;
  for (let i = 0; i < decay * day(AS) + 5 && gone < 0; i++) { sim.tick(); if (W.kind[a] !== AS.KIND.CORPSE) gone = i + 1; }
  ok(Math.abs(gone / day(AS) - decay) < 2 / day(AS), `e: bunny corpse gone after ${(gone / day(AS)).toFixed(3)} days, CorpseDecay ${decay}`);
  ok(sources().size === 0, 'e: no boostSrc points at the removed corpse');

  // handover: older corpse a, newer b overlapping; a decays first
  const s2 = make(15), W2 = s2.sim.W, A = s2.AS;
  W2.addCorpse(a, A.SPECIES.BUNNY); A.corpseAdded(s2.sim, a);
  W2.addCorpse(b, A.SPECIES.BUNNY); A.corpseAdded(s2.sim, b);
  const R = T.bunny.CorpseRadius;
  const shared = W2.tile(6, 7);
  ok(W2.boostSrc[shared] === a, 'e: overlap tile stays with the first corpse (no stacking)');
  W2.cAge[a] = decay - A.DT_DAYS / 2;
  s2.sim.tick();
  ok(W2.kind[a] !== A.KIND.CORPSE && W2.boostSrc[shared] === b, 'e: second corpse takes over the shared tile');
  let stale = 0, expect = 0;
  for (let t = 0; t < W2.n; t++) {
    if (W2.boostSrc[t] === a) stale++;
    const dx = W2.tx(t) - 8, dy = W2.ty(t) - 7;
    if (dx * dx + dy * dy <= R * R && W2.boostSrc[t] !== b) expect++;
  }
  ok(stale === 0 && expect === 0, `e: after handover b holds its full circle, none point at a`);

  // drained corpse
  const s3 = make(9), W3 = s3.sim.W, A3 = s3.AS, c = W3.tile(4, 4);
  W3.addCorpse(c, A3.SPECIES.BUNNY); A3.corpseAdded(s3.sim, c);
  for (const t of [W3.tile(3, 4), W3.tile(5, 4)]) W3.addGrass(t, 0, 0);
  W3.cNut[c] = 1e-4;
  for (let i = 0; i < A3.TICKS_PER_HOUR + 5; i++) s3.sim.tick();
  ok(W3.kind[c] !== A3.KIND.CORPSE && W3.cCount === 0, 'e: drained corpse is removed early');
  let ref = 0; for (let t = 0; t < W3.n; t++) if (W3.boostSrc[t] >= 0) ref++;
  ok(ref === 0, 'e: drained corpse leaves no boostSrc');
}

// (f) bites
{
  const { AS, sim } = make(9);
  const W = sim.W, t = W.tile(4, 4);
  W.addGrass(t, 0.6, 0);
  const r1 = AS.grassBite(sim, t, 0.25);
  ok(Math.abs(r1 - 0.25) < 1e-7 && Math.abs(W.gSize[t] - 0.35) < 1e-6 && W.kind[t] === AS.KIND.GRASS, 'f: partial bite returns amount, blade lives');
  const r2 = AS.grassBite(sim, t, 5);
  ok(Math.abs(r2 - 0.35) < 1e-6 && W.kind[t] === AS.KIND.EMPTY && W.gCount === 0, 'f: oversized bite returns remaining Size, blade dies');
  W.addGrass(t, 0.5, 0);
  const r3 = AS.grassBite(sim, t, 0.5);
  ok(r3 === 0.5 && W.kind[t] === AS.KIND.EMPTY, 'f: bite to exactly 0 kills');
  ok(AS.grassBite(sim, t, 1) === 0, 'f: bite on empty tile returns 0');
}

// sprouting: empty tiles with no grass nearby grow blades at SPROUT_TEST per day
{
  const SPROUT_TEST = 0.1, size = 100;
  const { AS, T, sim } = make(size, 7, tx => { tx.species = editCSV(tx.species, 'SproutChance', 'Grass', SPROUT_TEST * 100 + '%'); });
  for (let i = 0; i < day(AS); i++) sim.tick();
  const want = size * size * SPROUT_TEST, got = sim.W.gCount;
  ok(Math.abs(got - want) <= want * 0.1, `sprout: ${got} blades on ${size * size} empty tiles in a day, expected ~${want} (SproutChance ${T.grass.SproutChance * 100}%)`);
}

// carried seeds: SeedFar of the seeds land 2..SeedReach tiles away, only on free ground with at
// least two grass neighbors; the rest, and any carried seed with no such spot, drop on a free 4-neighbor
{
  const SHELTER = [[9, 7], [10, 7], [9, 8], [10, 8], [5, 5], [5, 6]];   // half-grown: sheltered, never seeding
  // One full blade seeds once (an hour, SeedChance 100%); returns [world, parent tile].
  const seedOnce = (far, n, sheltered) => {
    const { AS, sim } = make(15, 5000 + n, tx => {
      tx.species = editCSV(editCSV(editCSV(tx.species, 'SeedChance', 'Grass', '100%'), 'SeedFar', 'Grass', far), 'GrowthRate', 'Grass', '0');
    });
    const W = sim.W, parent = W.tile(7, 7);
    W.addGrass(parent, 1, 0);
    if (sheltered) for (const [x, y] of SHELTER) W.addGrass(W.tile(x, y), 0.5, 0);
    for (let i = 0; i < AS.TICKS_PER_HOUR; i++) sim.tick();
    return { AS, T: sim.T, W, parent };
  };
  const shelterOf = (W, u, K) => { let c = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if ((i || j) && W.kind[W.tile(W.tx(u) + i, W.ty(u) + j)] === K) c++; return c; };
  const trials = 300;
  for (const [far, sheltered, label] of [['100%', true, 'SeedFar 100%'], ['0%', true, 'SeedFar 0%'], ['100%', false, 'SeedFar 100%, no shelter']]) {
    let seeded = 0, carried = 0, bad = 0;
    for (let n = 0; n < trials; n++) {
      const { AS, T, W, parent } = seedOnce(far, n, sheltered);
      const K = AS.KIND.GRASS, sheltering = new Set(SHELTER.map(([x, y]) => W.tile(x, y)));
      sheltering.add(parent);
      for (let u = 0; u < W.n; u++) {
        if (W.kind[u] !== K || sheltering.has(u)) continue;
        seeded++;
        const dx = W.tx(u) - W.tx(parent), dy = W.ty(u) - W.ty(parent), d = Math.hypot(dx, dy);
        if (d === 1) continue;   // dropped at the blade's feet
        carried++;
        // rounding the landing spot to a tile can move it by under a tile, so the bounds carry that slack
        let under = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if ((i || j) && sheltering.has(W.tile(W.tx(u) + i, W.ty(u) + j))) under++;
        if (d < 2 - Math.SQRT1_2 || d > T.grass.SeedReach + Math.SQRT1_2 || under < 2) bad++;
      }
    }
    if (far === '100%' && sheltered) ok(carried > trials * 0.3 && bad === 0, `carried: ${carried}/${seeded} seeds landed away, ${bad} outside 2..SeedReach or on fewer than 2 grass neighbors`);
    else if (!sheltered) ok(seeded > trials * 0.9 && carried === 0, `carried: ${label}, nowhere sheltered: ${seeded} seeds, ${carried} carried (all drop at the feet)`);
    else ok(seeded > trials * 0.9 && carried === 0, `carried: ${label}: ${seeded} seeds, ${carried} carried (SeedFar 0 seeds 4-neighbors only)`);
  }
}

// stage label
{
  const { AS, T, sim } = make(9);
  const W = sim.W, t = W.tile(1, 1);
  W.addGrass(t, 1, 0);
  const st = [AS.grassStage(sim, t)];
  W.gAge[t] = T.grass.TimeToMature; st.push(AS.grassStage(sim, t));
  ok(st[0] === 'Sprout' && st[1] === 'Mature', `stage: ${st.join(' -> ')} (ElderAt ${T.grass.ElderAt})`);
}

// Soil wetness (GrassWetEnough, GrassDryFloor): the hourly pass is run by hand over a stand-in
// soil, so only grass.js is under test. The factor is 1 at w >= GrassWetEnough, GrassDryFloor at
// w = 0, linear between; growth, seeding and sprouting all scale with it.
{
  const hourPass = (sim, soil) => {
    const W = sim.W;
    W.water = soil;
    for (let p = 0; p < sim.AS_TPH; p++) { sim.tickCount = p; sim.AS.grassTick(sim); }
    W.water = null;
  };
  const wetSim = (seed, species) => {
    const { AS, T, sim } = stage({ size: 9, seed, species: [[['SproutChance', 'Grass', '0%']], ...(species || [])] });
    sim.AS = AS; sim.AS_TPH = AS.TICKS_PER_HOUR;
    return { AS, T, sim, W: sim.W };
  };
  const soilAt = (W, w) => ({ G: new Float32Array(W.n).fill(w * 0.1), room: 0.1 });
  const factorOf = (T, w) => { const g = T.grass; return w >= g.GrassWetEnough ? 1 : g.GrassDryFloor + (1 - g.GrassDryFloor) * w / g.GrassWetEnough; };

  // growth: one blade, one hour, at several wetness levels
  {
    const { AS, T, sim, W } = wetSim(1, [[['SeedChance', 'Grass', '0%']]]);
    const t = W.tile(4, 4), rate = T.grass.GrowthRate / 24, E = T.grass.GrassWetEnough;
    const gain = soil => { W.gSize[t] = 0.2; const before = W.gSize[t]; hourPass(sim, soil); return W.gSize[t] - before; };
    W.addGrass(t, 0.2, 0);
    const levels = [0, E / 4, E / 2, E, 3 * E];
    const got = levels.map(w => gain(soilAt(W, w)));
    const none = (() => { W.gSize[t] = 0.2; hourPass(sim, null); return W.gSize[t] - 0.2; })();
    ok(levels.every((w, i) => Math.abs(got[i] - rate * factorOf(T, w)) < 1e-6), `wet growth: gains ${got.map(x => (x / rate).toFixed(3)).join(', ')} of the dry-free rate at w = 0, 1/4, 1/2, 1, 3 x GrassWetEnough (expect ${levels.map(w => factorOf(T, w).toFixed(3)).join(', ')})`);
    ok(Math.abs(got[3] - rate) < 1e-6 && Math.abs(got[0] - rate * T.grass.GrassDryFloor) < 1e-6, 'wet growth: full rate at GrassWetEnough, GrassDryFloor of it on bone-dry soil');
    ok(Math.abs(none - rate) < 1e-6, 'wet growth: no water rules, the plain rate');
  }
  // seeding and sprouting: the chance of an event in an hour is 1 - exp(-hazard x factor)
  for (const kind of ['seeding', 'sprouting']) {
    const E = (kind === 'seeding' ? wetSim(5, [[['SeedChance', 'Grass', '60%'], ['SeedFar', 'Grass', '0%']]])
                                  : wetSim(5, [[['SeedChance', 'Grass', '0%'], ['SproutChance', 'Grass', '40%']]]));
    const { T, sim, W } = E, g = T.grass;
    const haz = -Math.log(1 - (kind === 'seeding' ? g.SeedChance : g.SproutChance)) / 24;
    const clear = () => { for (let u = W.gCount - 1; u >= 0; u--) W.removeGrass(W.gList[u]); };
    const rateAt = w => {
      const soil = soilAt(W, w), trials = kind === 'seeding' ? 4000 : 150;
      let hit = 0, n = 0;
      for (let i = 0; i < trials; i++) {
        clear();
        if (kind === 'seeding') { W.addGrass(W.tile(4, 4), 1, 0); n++; }
        else n += W.n;
        hourPass(sim, soil);
        hit += kind === 'seeding' ? (W.gCount > 1 ? 1 : 0) : W.gCount;
      }
      return { p: hit / n, n };
    };
    for (const w of [0, g.GrassWetEnough / 2, 2 * g.GrassWetEnough]) {
      const { p, n } = rateAt(w), want = 1 - Math.exp(-haz * factorOf(T, w));
      ok(Math.abs(p - want) < 4 * Math.sqrt(want * (1 - want) / n) + 1e-4, `wet ${kind}: ${(p * 100).toFixed(2)}% an hour at w = ${(w * 100).toFixed(2)}% of room, expect ${(want * 100).toFixed(2)}%`);
    }
    const none = (() => { W.water = null; let hit = 0, n = 0; const trials = kind === 'seeding' ? 4000 : 150; for (let i = 0; i < trials; i++) { clear(); if (kind === 'seeding') { W.addGrass(W.tile(4, 4), 1, 0); n++; } else n += W.n; hourPass(sim, null); hit += kind === 'seeding' ? (W.gCount > 1 ? 1 : 0) : W.gCount; } return hit / n; })();
    const want0 = 1 - Math.exp(-haz);
    ok(Math.abs(none - want0) < 4 * Math.sqrt(want0 * (1 - want0) / (kind === 'seeding' ? 4000 : 150 * 81)) + 1e-4, `wet ${kind}: no water rules, ${(none * 100).toFixed(2)}% an hour, the plain ${(want0 * 100).toFixed(2)}%`);
  }
}

done();
