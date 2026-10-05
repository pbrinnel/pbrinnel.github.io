'use strict';
const { load, editCSV } = require('./harness.js');
let bad = 0;
function ok(c, m) { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; }

function make(size, seed = 1, edit) {
  const { AS, texts } = load();
  let s = editCSV(texts.settings, 'WorldWidth', 'Value', String(size));
  s = editCSV(s, 'WorldHeight', 'Value', String(size));
  s = editCSV(s, 'StartGrass', 'Value', '0%');
  s = editCSV(s, 'StartBunnies', 'Value', '0');
  s = editCSV(s, 'Lakes', 'Value', '0');   // these hand-place things on tiles; lakes are water-check.js's
  s = editCSV(s, 'StartWolves', 'Value', '0');
  texts.settings = s;
  // Sprouting off unless a test turns it on, so seeding counts only seeding.
  texts.species = editCSV(texts.species, 'SproutChance', 'Grass', '0%');
  if (edit) edit(texts);
  const { T, errors } = AS.parseTables(texts);
  if (errors.length) throw new Error(errors.join('\n'));
  return { AS, T, sim: AS.Sim(T, seed) };
}
const day = AS => AS.TICK_HZ * AS.DAY_SECONDS;

// (a) lone sprout fills in 1/GrowthRate days, within one tick
{
  const { AS, T, sim } = make(9);
  const W = sim.W, t = W.tile(4, 4);
  W.addGrass(t, 0, 0);
  const ticks = Math.round(day(AS) / T.grass.GrowthRate);
  for (let i = 0; i < ticks - 1; i++) sim.tick();
  const before = W.gSize[t];
  sim.tick();
  ok(before < 1 && W.gSize[t] >= 1 - 1e-5 && W.gSize[t] <= 1, `a: sprout reaches 1 at tick ${ticks} (1/GrowthRate days); size before ${before.toFixed(4)}`);
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
  const nut0 = W.cNut[c], boost = T.wolf.CorpseBoost, base = T.grass.GrowthRate * AS.DT_DAYS;
  sim.tick();
  const grown = W.gSize[g], used = nut0 - W.cNut[c];
  ok(Math.abs(grown - base * boost) < 1e-7, `d: boosted growth ${grown.toExponential(3)} = ${boost} x base ${base.toExponential(3)}`);
  ok(Math.abs(used - (grown - base)) < 1e-6, `d: nutrient fell ${used.toExponential(3)} = extra growth ${(grown - base).toExponential(3)}`);
  // A full blade drinks nothing
  const { AS: A2, sim: s2 } = make(9);
  s2.W.addCorpse(s2.W.tile(4, 4), A2.SPECIES.WOLF); A2.corpseAdded(s2, s2.W.tile(4, 4));
  s2.W.addGrass(s2.W.tile(5, 4), 1, 0);
  const n0 = s2.W.cNut[s2.W.tile(4, 4)]; s2.tick();
  ok(s2.W.cNut[s2.W.tile(4, 4)] === n0, 'd: a full blade does not drink');
  // Outside the radius: no boost
  const { AS: A3, sim: s3 } = make(15);
  const c3 = s3.W.tile(7, 7), far = s3.W.tile(7 + Math.ceil(T.wolf.CorpseRadius) + 1, 7);
  s3.W.addCorpse(c3, A3.SPECIES.WOLF); A3.corpseAdded(s3, c3); s3.W.addGrass(far, 0, 0); s3.tick();
  ok(Math.abs(s3.W.gSize[far] - base) < 1e-9, 'd: grass outside CorpseRadius grows at base rate');
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
  for (let i = 0; i < 5; i++) s3.sim.tick();
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

// stage label
{
  const { AS, T, sim } = make(9);
  const W = sim.W, t = W.tile(1, 1);
  W.addGrass(t, 1, 0);
  const st = [AS.grassStage(sim, t)];
  W.gAge[t] = T.grass.TimeToMature; st.push(AS.grassStage(sim, t));
  ok(st[0] === 'Sprout' && st[1] === 'Mature', `stage: ${st.join(' -> ')} (ElderAt ${T.grass.ElderAt})`);
}

console.log(bad ? `\nFAIL (${bad})` : '\nALL PASS');
process.exit(bad ? 1 : 0);
