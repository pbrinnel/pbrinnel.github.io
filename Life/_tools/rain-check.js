// Local rain (weather.js showers, water.js `local`): rain falls from showers the wind carries,
// so the land is patchy, there are wet and dry spells, and over the long run a tile still gets
// the world's Rain. Nothing here depends on the tables' particular numbers: the values a test
// needs are set here or read back from the tables.
//   node Life/_tools/rain-check.js
'use strict';
const { stage, tally, tick, days } = require('./kit.js');
const { audit, failures } = require('./harness.js');
const { ok, done } = tally();

const W0 = 180, H0 = 120;           // a small map keeps the long runs quick; showers are far bigger than it, as on the shipped one
const RAIN = 12;                    // mm a day for the long runs (a rainy world gives a tight mean quickly)
const SEEDS = [1, 2, 3];
const LONG_DAYS = 20;               // days per long run
const SPELL_TEST_RAIN = 0.3;        // the rate-only runs need no rain to speak of, only births to be cheap
const SPELL_EVERY = 15;             // the spell runs use the coarsest interval, which is exact too, for speed

const { AS, T } = stage({ seed: 1, size: 9 });
const HR = AS.TICKS_PER_HOUR;
const TILE_KM = AS.TILE_M / 1000;
const world = (over) => Object.assign({}, T.world, over);

// A wind model with rain on over a w x h map. over: settings for the world's own S.
function model(seed, over = {}, every, w = W0, h = H0, Tx = T) {
  const m = AS.Wind(Tx, seed, every);
  m.startRain(Object.assign({}, Tx.world, { Rain: RAIN }, over), w, h);
  return m;
}
const sumField = (f) => { let s = 0; for (let i = 0; i < f.length; i++) s += f[i]; return s; };

// Runs a model for d days, taking the field each weather step (as water does): the mean mm a
// day per tile and the longest dry stretch (dryDays).
function run(m, d) {
  const n = W0 * H0, stepsPerDay = 24 * HR / m.every;
  let total = 0, maxDry = 0;
  for (let s = 0, steps = d * stepsPerDay; s < steps; s++) {
    m.step();
    maxDry = Math.max(maxDry, m.dryDays);
    total += sumField(m.field);
    m.clearRain();
  }
  return { perTileDay: total / n / d, maxDry };
}

// ---- the long-run mean is Rain, at any weather interval ----
{
  const everyDefault = AS.WIND.WEATHER_EVERY_TICKS;
  const r = SEEDS.map(s => run(model(s, { RainSpread: 0 }), LONG_DAYS));
  const mean = r.reduce((a, x) => a + x.perTileDay, 0) / r.length;
  ok(Math.abs(mean / RAIN - 1) < 0.15, `steady rate: mean rain over ${SEEDS.length} seeds x ${LONG_DAYS} days is ${mean.toFixed(1)} mm a day per tile, Rain is ${RAIN}`);
  // The spells are centered on their mean, so they don't bias it. The rate alone is cheap to run long.
  let sum = 0, cnt = 0;
  for (let s = 1; s <= 24; s++) {
    const m = AS.Wind(T, s, SPELL_EVERY);
    m.startRain(world({ Rain: SPELL_TEST_RAIN, RainSpread: 1, RainSpellDays: 5 }), 20, 20);
    for (let i = 0; i < 24 * HR / SPELL_EVERY * 100; i++) { m.step(); sum += m.spellRate; cnt++; }
  }
  ok(Math.abs(sum / cnt - 1) < 0.2, `wet and dry spells average ${(sum / cnt).toFixed(2)} x the mean birth rate (24 seeds x 100 days)`);
  // Another interval draws other numbers, so only the long-run mean is compared; the fine
  // interval is dear, so it runs for fewer days.
  const SHORT = 6;
  const stat = (every) => SEEDS.map(s => run(model(s, { RainSpread: 0 }, every), SHORT).perTileDay).reduce((a, b) => a + b) / SEEDS.length;
  const ref = stat(everyDefault);
  for (const every of [1, everyDefault * 3]) {
    const o = stat(every);
    ok(Math.abs(o / ref - 1) < 0.3, `interval ${every} ticks (default ${everyDefault}): mean ${o.toFixed(1)} vs ${ref.toFixed(1)} mm a day over ${SHORT} days`);
  }
}

// ---- rain is patchy: on a map the size of the shipped one, a day's rain differs from tile to tile ----
{
  const n = 450 * 300;
  const m = AS.Wind(T, 2, SPELL_EVERY);
  m.startRain(world({ Rain: RAIN }), 450, 300);
  const day = new Float64Array(n);
  let cvSum = 0, cvDays = 0;
  for (let d = 0; d < 10; d++) {
    day.fill(0);
    for (let s = 0; s < 24 * HR / SPELL_EVERY; s++) { m.step(); const f = m.field; for (let i = 0; i < n; i++) day[i] += f[i]; m.clearRain(); }
    let a = 0, b = 0;
    for (let i = 0; i < n; i++) { a += day[i]; b += day[i] * day[i]; }
    if (a > 0) { const mean = a / n; cvSum += Math.sqrt(Math.max(0, b / n - mean * mean)) / mean; cvDays++; }
  }
  const cv = cvSum / cvDays;
  ok(cvDays > 0 && cv > 0.2, `daily totals vary across tiles (coefficient of variation ${cv.toFixed(2)} over ${cvDays} rainy days; uniform rain gives 0)`);
}

// ---- the same sky, handed to the water at any step size, adds up the same ----
{
  const every = AS.WIND.WEATHER_EVERY_TICKS;
  const fine = model(4, {}, every), coarse = model(4, {}, every);
  const a = new Float64Array(W0 * H0), b = new Float64Array(W0 * H0);
  const steps = 24 * HR / every * 10;
  for (let s = 1; s <= steps; s++) {
    fine.step(); coarse.step();
    for (let i = 0; i < a.length; i++) a[i] += fine.field[i];
    fine.clearRain();
    if (s % 3 === 0) { for (let i = 0; i < b.length; i++) b[i] += coarse.field[i]; coarse.clearRain(); }
  }
  let same = true, tot = 0;
  for (let i = 0; i < a.length; i++) { if (Math.abs(a[i] - b[i]) > 1e-3) same = false; tot += a[i]; }
  ok(same && tot > 0, `taking the field every step or every third step gives the same rain on every tile (${(tot / a.length).toFixed(2)} mm per tile in 10 days)`);
}

// ---- one shower in a steady wind: it moves at the wind's speed and direction, and a tile gets intensity x time under it ----
{
  const steady = (every) => {
    const { T: Ts } = stage({ seed: 1, size: 9, settings: { Wind: '10', WindChangeHours: 1e9 } });
    const m = AS.Wind(Ts, 5, every);
    m.startRain(Object.assign({}, Ts.world, { Rain: 0 }), W0, H0);
    return m;
  };
  const R = 20, MMH = 7, LIFE = 100;
  const results = [];
  for (const every of [1, AS.WIND.WEATHER_EVERY_TICKS, 15]) {
    const m = steady(every), wd = m.wind;
    ok(m.showers.n === 0, 'Rain 0 (no births): the sky starts empty');
    const speed = wd.kmh * 1000 / AS.TILE_M;               // tiles an hour
    const x0 = W0 / 2 - wd.toX * 100, y0 = H0 / 2 - wd.toY * 100;   // upwind of the middle, off the map's tiles in the way
    m.release(x0, y0, R, MMH, LIFE);
    const hours = 200 / speed * 2;                          // long enough to cross the middle and go on
    const steps = Math.round(hours * HR / every);
    const acc = new Float64Array(W0 * H0);
    for (let s = 0; s < steps; s++) { m.step(); for (let i = 0; i < acc.length; i++) acc[i] += m.field[i]; m.clearRain(); }
    const t = steps * every / HR;
    const dx = m.showers.x[0] - x0, dy = m.showers.y[0] - y0;
    ok(Math.abs(Math.hypot(dx, dy) / (speed * t) - 1) < 1e-3 && (dx * wd.toX + dy * wd.toY) / Math.hypot(dx, dy) > 0.9999,
      `interval ${every}: the shower moved ${Math.hypot(dx, dy).toFixed(0)} tiles in ${t.toFixed(1)} h, at the wind's ${speed.toFixed(1)} tiles an hour and its direction`);
    // Tiles near the middle at several distances from the shower's line.
    const px = Math.round(W0 / 2), py = Math.round(H0 / 2);
    let worst = 0;
    for (const off of [0, 5, 10, 15, 19, 22]) {
      const x = Math.round(px - wd.toY * off), y = Math.round(py + wd.toX * off);   // off tiles to the side of the line
      const qx = x + 0.5 - x0, qy = y + 0.5 - y0;
      const dist = Math.abs(qx * -wd.toY + qy * wd.toX);                            // true distance of the tile's center from the line
      const want = dist < R ? MMH * 2 * Math.sqrt(R * R - dist * dist) / speed : 0;
      worst = Math.max(worst, Math.abs(acc[y * W0 + x] - want) / Math.max(want, 1));
    }
    ok(worst < 2e-3, `interval ${every}: tiles at different distances from its path got intensity x time under it (worst error ${(worst * 100).toFixed(3)}%)`);
    results.push(acc);
  }
  let diff = 0;
  for (let i = 0; i < results[0].length; i++) diff = Math.max(diff, Math.abs(results[0][i] - results[1][i]), Math.abs(results[2][i] - results[1][i]));
  ok(diff < 0.01, `the whole rain field is the same at all three intervals (largest difference ${diff.toFixed(4)} mm)`);
}

// ---- wet and dry spells ----
{
  const DRY_RAIN = 2, SPELL_DAYS = 100;
  const dryRun = (seed, spread) => run(model(seed, { Rain: DRY_RAIN, RainSpellDays: 5, RainSpread: spread }, SPELL_EVERY), SPELL_DAYS).maxDry;
  const spells = SEEDS.map(s => dryRun(s, 1)), flat = SEEDS.map(s => dryRun(s, 0));
  const dry = Math.max(...spells), dryFlat = Math.max(...flat);
  ok(dry >= 3, `dry spells last days: dryDays reached ${dry.toFixed(1)}`);
  ok(dry > dryFlat, `... longer with spells than without (${dry.toFixed(1)} vs ${dryFlat.toFixed(1)} days at the same mean rain)`);
  const m = model(9, { RainSpread: 1 }, SPELL_EVERY);
  let min = Infinity, max = 0;
  for (let i = 0; i < 24 * HR / SPELL_EVERY * 100; i++) { m.step(); m.clearRain(); min = Math.min(min, m.spellRate); max = Math.max(max, m.spellRate); }
  ok(max / min > 4, `the birth rate swings between wet and dry spells (${min.toFixed(2)} to ${max.toFixed(2)} x its mean)`);
  const m0 = model(9, { RainSpread: 0 });
  for (let i = 0; i < 100; i++) m0.step();
  ok(m0.spellRate === 1, 'RainSpread 0: a steady rate');
}

// ---- rainToday and the shape other code reads ----
{
  const m = model(2, { Rain: 3 }, SPELL_EVERY);
  let good = true, peak = 0;
  for (let i = 0; i < 24 * HR / m.every * 20; i++) {
    m.step();
    const S = m.showers;
    for (const k of ['x', 'y', 'r', 'mmh', 'left']) if (!(S[k] && S[k].constructor.name === 'Float64Array') || S[k].length < S.n) good = false;
    for (let j = 0; j < S.n; j++) if (!(S.r[j] > 0 && S.mmh[j] > 0 && S.left[j] > 0)) good = false;
    peak = Math.max(peak, m.rainToday);
    m.clearRain();
  }
  ok(good, 'showers: n live ones with center, radius in tiles, mm an hour and hours left');
  ok(peak > 0 && Number.isFinite(m.rainToday) && m.rainToday >= 0, `rainToday is the mean mm over the map in the last day (peaked at ${peak.toFixed(2)})`);
}

// ---- only water worlds have showers; the weather never touches sim.rng or the wind ----
{
  const dry = stage({ seed: 5, size: 30, bare: false, settings: { Rain: 0 } }).sim;
  const off = stage({ seed: 5, size: 30, bare: false, settings: { Water: 'off' } }).sim;
  for (const s of [dry, off]) { tick(s, 300); }
  ok(dry.weather.field === null && off.weather.field === null && dry.weather.showers.n === 0 && off.weather.showers.n === 0,
    'Rain 0 and Water off: no showers, no field');
  const a = AS.Wind(T, 7, 5), b = AS.Wind(T, 7, 5);
  b.startRain(world({ Rain: RAIN }), W0, H0);
  let same = true;
  for (let i = 0; i < 5000; i++) { a.step(); b.step(); b.clearRain(); if (a.wind.kmh !== b.wind.kmh || a.wind.from !== b.wind.from) same = false; }
  ok(same, 'the wind is the same whether or not it rains');
  const { AS: A, sim: s } = stage({ seed: 6, size: 40, bare: false, settings: { Water: 'on', GrowRounds: 50, PreRunDays: 5, Rain: '5' } });
  const before = s.rng.state();
  for (let i = 0; i < 20000; i++) { A.weatherTick(s); s.tickCount++; if (s.weather.field) s.weather.clearRain(); }
  ok(s.weather.field && s.rng.state() === before, 'with showers running, 20000 weather ticks leave sim.rng where it was');
}

// ---- the water takes the field: totals add up, the field is clear after each step ----
{
  const { AS: A, sim, W } = stage({ seed: 8, size: [120, 90], bare: false, settings: { Water: 'on', GrowRounds: 100, PreRunDays: 10, Rain: '8', StartBunnies: 0, StartWolves: 0 } });
  const wat = W.water, wt = sim.weather;
  ok(wat.local === wt.field && wt.field, 'play: the water takes its rain from the weather\'s field');
  let mm = 0;
  const clear = wt.clearRain;
  wt.clearRain = () => { mm += sumField(wt.field); clear(); };
  const start = wat.totals.rain;
  tick(sim, days(A, 20));
  ok(Math.abs((wat.totals.rain - start) * 1000 - mm) < 1e-3 * Math.max(1, mm) && mm > 0, `water.totals.rain gained exactly what the showers gave (${(mm / W.n).toFixed(1)} mm per tile in 20 days)`);
  while (sim.tickCount % Math.round(A.WATER_STEP_DAYS * A.DAY_SECONDS * A.TICK_HZ) !== 1) tick(sim, 1);
  ok(sumField(wt.field) === 0, 'the field is clear after the water takes it');
}

// ---- grass drowns only under standing water (Paul, 12 Oct 2026) ----
{
  const { AS: A, sim, W, T: Tx } = stage({ seed: 3, size: [30, 20], bare: false, settings: { Water: 'on', Rain: '0', GrowRounds: 20, PreRunDays: 1, StartBunnies: 0, StartWolves: 0, StartGrass: '0%' } });
  const wat = W.water, H = wat.H, drown = Tx.world.DrownHours;
  const stepH = A.WATER_STEP_DAYS * 24, stepTicks = Math.round(A.WATER_STEP_DAYS * A.DAY_SECONDS * A.TICK_HZ);
  // A flat spot with room around it: the middle, and its east neighbor (which the water makes beach).
  const cx = 15, cy = 10, a = W.tile(cx, cy), b = W.tile(cx + 1, cy);
  for (let t = 0; t < W.n; t++) if (W.wDepth[t] > 0) W.setDepth(t, 0);
  H.fill(0); wat.listWet();
  while (sim.tickCount % stepTicks !== 0) tick(sim, 1);
  // One water step with tile a holding POUR meters, as a shower would leave it.
  const POUR = 1;
  const stepWith = (wet) => { if (wet) { H[a] = POUR; wat.listWet(); } tick(sim, stepTicks); };
  const plant = (t) => { if (W.kind[t] === A.KIND.GRASS) W.removeGrass(t); W.addGrass(t, 0.8, 7); };
  const hoursNeeded = Math.ceil(drown / stepH);

  // water that stands less than DrownHours and drains off: both blades come back
  H.fill(0); plant(a); plant(b);
  stepWith(true);
  const kept = [W.sunkSize[a], W.sunkAge[a]];
  ok(W.kind[a] === A.KIND.EMPTY && W.sunk[a] === 1, 'water on a blade takes it off the tile, kept sunk');
  ok(W.sunk[b] === 1 && W.sunkCount === 2 && W.gCount === 0, `... and so does the shore a blade next to it (${W.sunkCount} sunk, ${W.gCount} standing)`);
  for (let i = 0; i < Math.floor(hoursNeeded / 2); i++) stepWith(true);
  ok(W.sunk[a] === 1 && W.sunkSize[a] === kept[0] && W.sunkAge[a] === kept[1], `it neither grows nor ages under water; after ${((Math.floor(hoursNeeded / 2) + 1) * stepH).toFixed(1)} h of ${drown} the blade is still there, under`);
  H.fill(0); wat.listWet();
  tick(sim, stepTicks); tick(sim, stepTicks);
  const back = 2 * A.WATER_STEP_DAYS;   // it has grown only for the steps since the water left
  ok(W.kind[a] === A.KIND.GRASS && W.sunkCount === 0 && W.gSize[a] >= kept[0] && W.gAge[a] >= kept[1] && W.gAge[a] - kept[1] <= back + 1e-6,
    'water that drained off in time leaves the blade alive, with the size and age it went under with');
  ok(W.kind[b] === A.KIND.GRASS, 'and so is the one on the shore');

  // water that stands DrownHours: gone for good, and the ground is bare when it drains
  H.fill(0); plant(a);
  for (let i = 0; i < hoursNeeded + 2; i++) stepWith(true);
  ok(W.sunk[a] === 0 && W.kind[a] === A.KIND.EMPTY, `after ${(hoursNeeded + 2) * stepH} h under water (DrownHours ${drown}) the blade has drowned`);
  H.fill(0); wat.listWet();
  tick(sim, stepTicks); tick(sim, stepTicks);
  ok(W.kind[a] === A.KIND.EMPTY && W.sunkCount === 0, 'and does not come back when the water leaves');
  const before = failures.length;
  audit(A, sim, 'drown');
  ok(failures.length === before, 'the grid and stores agree after all that' + failures.slice(before).join('; '));
}
done('ALL PASS');
