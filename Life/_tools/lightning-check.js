// Lightning (weather.js): some showers are thunderstorms, a storm strikes in a ring around its
// rain, and a strike lights fuel by the soil's dryness through AS.ignite. Nothing here depends
// on the tables' particular numbers: each scene sets the rows it studies.
//   node Life/_tools/lightning-check.js
'use strict';
const { stage, tally, tick, days } = require('./kit.js');
const { audit, failures } = require('./harness.js');
const { ok, done } = tally();

const W0 = 200, H0 = 200;      // the geometry scenes: room for a whole ring around a storm in the middle
const SKY = {};                // rain: 0 is rig's default: no births, the scene releases its own storm
const SMALL = '0.3-0.6';       // showers much smaller than the shipped ones, so a test map is not inside one storm's rain
const STEADY = { Wind: '10', WindChangeHours: 1e9 };
const STORMS = { StormShare: '100%', DryStormBoost: 1, DryStormRain: '100%', RainSpread: 0 };
const { AS: A0 } = stage({ size: 9 });
const HR = A0.TICKS_PER_HOUR, CAP = A0.WIND.STRIKE_CAP;

// A bare world with the weather's rain on over its whole map. over: settings, merged into the
// world's own settings, for the sim and for startRain alike.
function rig(over = {}, { seed = 1, size = [W0, H0], rain = 0 } = {}) {
  const s = stage({ seed, size, settings: over });
  s.sim.weather.startRain(Object.assign({}, s.T.world, { Rain: rain }), size[0], size[1]);
  return s;
}
// The strikes made since index `from` (they cannot have wrapped past CAP in one call).
function since(m, from) {
  const out = [];
  for (let i = from; i < m.strikes.n; i++) out.push({ tile: m.strikes.tile[i % CAP], lit: m.strikes.lit[i % CAP], at: m.strikes.atSec[i % CAP] });
  return out;
}
const sumField = (f) => { let s = 0; for (let i = 0; i < f.length; i++) s += f[i]; return s; };

// ---- the shape other code reads ----
{
  const { sim } = rig({ ...SKY, ...STEADY, ...STORMS });
  const m = sim.weather, st = m.strikes;
  ok(st.n === 0 && [st.tile, st.atSec, st.lit].map(a => a.constructor.name).join() === 'Int32Array,Float64Array,Uint8Array'
    && st.tile.length === CAP && st.atSec.length === CAP && st.lit.length === CAP, `sim.weather.strikes: n and rings of ${CAP} (tile Int32, atSec Float64, lit Uint8)`);
  m.release(100, 100, 10, 5, 1, 1);
  m.release(50, 50, 10, 5, 1);
  ok(m.showers.storm.constructor.name === 'Uint8Array' && m.showers.storm[0] === 1 && m.showers.storm[1] === 0, 'showers.storm: a Uint8 column, 1 for a thunderstorm');
}

// ---- where a storm strikes: a ring outside its rain, thicker ahead, at StrikesPerHour ----
{
  const AHEAD = 0.6, REACH = 2.5, R = 10, PER_HOUR = 3, CALLS = 20000;
  const { sim, T } = rig({ ...SKY, ...STEADY, ...STORMS, StrikesPerHour: PER_HOUR, StrikeReach: REACH, StrikeAhead: `${AHEAD * 100}%` });
  const m = sim.weather, cx = W0 / 2, cy = H0 / 2;
  m.release(cx, cy, R, 5, 1e6, 1);
  const heading = Math.atan2(sim.wind.toY, sim.wind.toX);
  const dtH = m.every / HR;
  let dMin = Infinity, dMax = 0, cosSum = 0, n = 0;
  for (let c = 0; c < CALLS; c++) {
    const from = m.strikes.n;
    m.strike(sim);
    for (const s of since(m, from)) {
      const x = s.tile % W0 + 0.5 - cx, y = ((s.tile / W0) | 0) + 0.5 - cy, d = Math.hypot(x, y);
      dMin = Math.min(dMin, d); dMax = Math.max(dMax, d);
      cosSum += (x * Math.cos(heading) + y * Math.sin(heading)) / d; n++;
    }
  }
  const slack = Math.SQRT1_2;   // a tile's center is up to this far from the strike point
  ok(dMin >= R - slack && dMax <= R * REACH + slack, `${n} strikes all fell in the ring from ${R} to ${R * REACH} tiles (saw ${dMin.toFixed(1)} to ${dMax.toFixed(1)})`);
  ok(Math.abs(cosSum / n - AHEAD / 2) < 0.03, `... biased ahead: mean cosine from the heading ${(cosSum / n).toFixed(3)}, ${AHEAD / 2} expected for StrikeAhead ${AHEAD}`);
  const rate = n / (CALLS * dtH);
  ok(Math.abs(rate / PER_HOUR - 1) < 0.05, `... at ${rate.toFixed(2)} strikes an hour from one live storm (StrikesPerHour ${PER_HOUR})`);
  ok(sim.rng.state() === stage({ size: [W0, H0], seed: 1, settings: { ...SKY, ...STEADY, ...STORMS } }).sim.rng.state(), 'striking leaves sim.rng alone');
}

// ---- a shower that is not a storm never strikes; StormShare 0 means no storms ----
{
  const { sim } = rig({ ...SKY, ...STEADY });
  const m = sim.weather;
  m.release(100, 100, 10, 5, 1e6, 0);
  for (let c = 0; c < 2000; c++) m.strike(sim);
  ok(m.strikes.n === 0, 'a shower that is not a storm made no strikes in 2000 steps');
  const flags = (share, seed) => {
    const { sim: s } = rig({ ShowerKm: SMALL, RainSpread: 0, StormShare: share, DryStormBoost: 1 }, { seed, size: [60, 40], rain: 4 });
    let storms = 0, showers = 0;
    const xs = [];
    for (let i = 0; i < 24 * HR / s.weather.every * 2; i++) {
      s.weather.step(); s.weather.strike(s); s.weather.clearRain();
      for (let j = 0; j < s.weather.showers.n; j++) xs.push(s.weather.showers.x[j]);
      storms += s.weather.showers.storm.subarray(0, s.weather.showers.n).reduce((a, b) => a + b, 0);
      showers += s.weather.showers.n;
    }
    return { storms, showers, strikes: s.weather.strikes.n, xs };
  };
  const none = flags('0%', 4), all = flags('100%', 4), some = flags('30%', 4);
  ok(none.showers > 0 && none.storms === 0 && none.strikes === 0, `StormShare 0: ${none.showers} shower-steps, no storm, no strike`);
  ok(all.storms === all.showers && all.strikes > 0, `StormShare 100%: every shower a storm (${all.storms} of ${all.showers}), ${all.strikes} strikes`);
  ok(Math.abs(some.storms / some.showers - 0.3) < 0.15, `StormShare 30%: ${(some.storms / some.showers * 100).toFixed(0)}% of shower-steps were storms`);
  // The storm roll is drawn for every shower, so the share never changes which showers there are
  // (nothing changes the rain with no spread and DryStormRain irrelevant: the births are the same).
  ok(none.xs.length === all.xs.length && none.xs.every((x, i) => x === all.xs[i]), 'the same showers are born whatever StormShare is');
}

// ---- in a live sky, strikes fall only in a storm's ring ----
{
  const { AS, sim } = rig({ ShowerKm: SMALL, RainSpread: 1, StormShare: '40%', DryStormBoost: 2, StrikesPerHour: 6 }, { seed: 3, size: [120, 90], rain: 4 });
  const m = sim.weather, reach = sim.T.world.StrikeReach;
  let seen = 0, bad = 0;
  for (let i = 0; i < 24 * HR * 6; i++) {
    const from = m.strikes.n;
    AS.weatherTick(sim); sim.tickCount++;
    m.clearRain();
    for (const s of since(m, from)) {
      seen++;
      const x = s.tile % 120 + 0.5, y = ((s.tile / 120) | 0) + 0.5;
      let inRing = false;
      for (let j = 0; j < m.showers.n; j++) {
        if (!m.showers.storm[j]) continue;
        const d = Math.hypot(x - m.showers.x[j], y - m.showers.y[j]), r = m.showers.r[j];
        if (d >= r - 1 && d <= r * reach + 1) inRing = true;
      }
      if (!inRing) bad++;
    }
    if (sim.tickCount % m.every === 0 && false) break;
  }
  ok(seen > 10 && bad === 0, `${seen} strikes in 6 days of a live sky, every one in the ring of a live storm (${bad} elsewhere)`);
}

// ---- a strike: water and bare ground burn nothing; fuel lights by the soil's dryness ----
{
  const trial = (dryPct, trials, build) => {
    const { AS, sim, W } = rig({ FireDryness: dryPct }, { size: [11, 11] });
    return { AS, sim, W, m: sim.weather };
  };
  // Water and bare.
  {
    const { AS, sim, W, m } = trial('100%');
    const water = W.tile(2, 2), bare = W.tile(5, 5), grass = W.tile(8, 8);
    W.addWater(water, 0.5);
    W.addGrass(grass, 1, 0);
    m.strikeAt(sim, water); m.strikeAt(sim, bare);
    ok(W.fCount === 0 && m.strikes.n === 2 && m.strikes.lit[0] === 0 && m.strikes.lit[1] === 0, 'a strike on water or on bare ground is drawn but starts no fire');
    m.strikeAt(sim, grass);
    ok(m.strikes.lit[2] === 1 && W.flow[grass] === AS.FLOW.FIRE, 'a strike on a blade in bone-dry ground lights it, through AS.ignite');
    ok(m.strikes.tile[2] === grass && m.strikes.atSec[2] === sim.simSeconds, 'and is recorded with its tile and the sim\'s time');
  }
  // Chance = dryness.
  for (const pct of [0, 40, 85]) {
    const { sim, W, m } = trial(`${pct}%`);
    const t = W.tile(5, 5);
    let lit = 0; const N = 4000;
    for (let i = 0; i < N; i++) {
      W.addGrass(t, 1, 0);
      m.strikeAt(sim, t);
      if (m.strikes.lit[(m.strikes.n - 1) % CAP]) { lit++; W.removeFire(t); }
      W.removeGrass(t);
    }
    const sd = Math.sqrt(pct / 100 * (1 - pct / 100) / N);
    ok(Math.abs(lit / N - pct / 100) < 4 * sd + 1e-9, `FireDryness ${pct}%: a strike on a blade lit it ${(lit / N * 100).toFixed(1)}% of ${N} times`);
  }
  // A corpse and an animal burn too; a strike on the ground with a hole does not.
}

// ---- with water rules, the chance is the soil's own dryness, as fire.js spreads ----
{
  const { AS, sim, W } = stage({ seed: 6, size: 40, bare: false, settings: { Water: 'on', GrowRounds: 50, PreRunDays: 5, Rain: '5', StartBunnies: 0, StartWolves: 0, StartGrass: '0%' } });
  const m = sim.weather, soil = W.water;
  let t = -1;
  for (let i = 0; i < W.n && t < 0; i++) if (W.kind[i] === AS.KIND.EMPTY && W.flow[i] === AS.FLOW.NONE && !W.hole[i] && W.scorch[i] === 0) { try { W.addGrass(i, 1, 0); W.removeGrass(i); t = i; } catch (e) { /* not here */ } }
  ok(t >= 0 && soil, 'a plain land tile in a world with water');
  for (const dry of [0.2, 0.75]) {
    soil.G[t] = soil.room * (1 - dry);
    let lit = 0; const N = 4000;
    for (let i = 0; i < N; i++) {
      W.addGrass(t, 1, 0);
      m.strikeAt(sim, t);
      if (m.strikes.lit[(m.strikes.n - 1) % CAP]) { lit++; W.removeFire(t); }
      W.removeGrass(t);
    }
    ok(Math.abs(lit / N - dry) < 4 * Math.sqrt(dry * (1 - dry) / N), `soil ${(dry * 100).toFixed(0)}% dry: a strike lit the blade ${(lit / N * 100).toFixed(1)}% of ${N} times`);
  }
}

// ---- the ring remembers the newest CAP ----
{
  const { sim, W } = rig({ ...SKY });
  const m = sim.weather, st = m.strikes, N = CAP * 2 + 5;
  for (let i = 0; i < N; i++) m.strikeAt(sim, i % W.n);
  let right = st.n === N;
  for (let k = N - CAP; k < N; k++) if (st.tile[k % CAP] !== k % W.n) right = false;
  ok(right, `after ${N} strikes the ring holds the last ${CAP}, the newest at (n - 1) % ${CAP}`);
}

// ---- the long-run rain is still Rain, with storms in ----
{
  const RAIN = 12, DAYS = 40, SEEDS = [1, 2, 3, 4], SPELL_DAYS = 0.5;   // short spells: many of them average out in a short run
  const mean = (over) => {
    let tot = 0;
    for (const seed of SEEDS) {
      const { T } = stage({ size: 9, seed });
      const m = A0.Wind(T, seed, 15);
      m.startRain(Object.assign({}, T.world, { Rain: RAIN, RainSpread: 1, RainSpellDays: SPELL_DAYS }, over), 20, 20);
      for (let i = 0; i < 24 * HR / 15 * DAYS; i++) { m.step(); tot += sumField(m.field); m.clearRain(); }
    }
    return tot / (20 * 20) / SEEDS.length / DAYS;
  };
  // All storms, and the driest spells nearly rainless: the cut is as large as it can be.
  const heavy = mean({ StormShare: 1, DryStormBoost: 1, DryStormRain: 0 });
  const none = mean({ StormShare: 0 });
  ok(Math.abs(heavy / RAIN - 1) < 0.15, `every shower a storm, dry ones rain-free: mean ${heavy.toFixed(1)} mm a day (Rain ${RAIN})`);
  ok(Math.abs(none / RAIN - 1) < 0.15, `no storms: mean ${none.toFixed(1)} mm a day (Rain ${RAIN})`);
  // The calibration itself: a storm world is born more often to make up what dry storms keep.
  const births = (over) => { const { T } = stage({ size: 9 }); const m = A0.Wind(T, 1, 15); m.startRain(Object.assign({}, T.world, { Rain: RAIN, RainSpread: 1 }, over), 20, 20); let n = 0; for (let i = 0; i < 24 * HR / 15 * 30; i++) { m.step(); n += m.showers.n; m.clearRain(); } return n; };
  ok(births({ StormShare: 1, DryStormBoost: 1, DryStormRain: 0 }) > births({ StormShare: 0 }), 'dry storms rain less, so more showers are born to keep the mean');
}

// ---- no water, no rain: no storms, no strikes ----
{
  for (const settings of [{ Water: 'off' }, { Rain: 0 }]) {
    const { AS, sim } = stage({ seed: 5, size: 30, bare: false, settings });
    for (let i = 0; i < 3000; i++) { AS.weatherTick(sim); sim.tickCount++; }
    ok(sim.weather.showers.n === 0 && sim.weather.strikes.n === 0, `${JSON.stringify(settings)}: no showers, no strikes`);
  }
}

// ---- storms touch only the weather's own dice, and the grid stays whole ----
{
  const { AS, sim } = stage({ seed: 6, size: 40, bare: false, settings: { Water: 'on', GrowRounds: 50, PreRunDays: 5, Rain: '5', ShowerKm: SMALL, StormShare: '100%', StrikesPerHour: 20 } });
  tick(sim, days(AS, 6));
  ok(sim.weather.strikes.n > 0, `a stormy world struck ${sim.weather.strikes.n} times in 6 days`);
  const before = failures.length;
  audit(AS, sim, 'storms');
  ok(failures.length === before, 'the grid and stores agree after the storms' + failures.slice(before).join('; '));
}
done('ALL PASS');
