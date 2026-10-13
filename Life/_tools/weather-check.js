// The wind (weather.js): seeded and its own, smooth, bounded, mostly near typical with
// stronger spells now and then, the same at any update interval, and never a touch on the
// sim's own dice. Nothing here depends on the table's particular numbers.
//   node Life/_tools/weather-check.js
'use strict';
const { stage, tally, tick, days } = require('./kit.js');
const { audit } = require('./harness.js');
const { ok, done } = tally();

const SEEDS = [1, 2, 3, 4, 5, 6];
const DAYS = 400;                 // per seed, for the statistics
const SPELL_X = 1.5;              // "a spell": strength over this many times typical

const { AS, T } = stage({ seed: 1, size: 9 });
const HR = AS.TICKS_PER_HOUR;
const World = AS.WIND;
const S = T.world;
const model = (seed, every) => AS.Wind(T, seed, every);

// Runs a model for `d` days, sampling every in-world hour: the series of { from, kmh }.
function series(m, d) {
  const out = [];
  const total = d * 24 * HR;
  for (let i = 0; i < total; i++) {
    if (i % m.every === 0) m.step();
    if (i % HR === 0) out.push({ from: m.wind.from, kmh: m.wind.kmh });
  }
  return out;
}
// Smallest angle between two bearings.
const turn = (a, b) => { const d = Math.abs(a - b) % (2 * Math.PI); return Math.min(d, 2 * Math.PI - d); };

// ---- same seed, same wind; another seed, another
{
  const a = series(model(7), 20), b = series(model(7), 20), c = series(model(8), 20);
  ok(a.every((p, i) => p.from === b[i].from && p.kmh === b[i].kmh), 'the same seed gives the same wind, hour for hour');
  ok(a.some((p, i) => p.kmh !== c[i].kmh), 'another seed gives another wind');
  ok(model(7).wind.prevailing !== model(8).wind.prevailing, 'each seed has its own prevailing direction');
  const typ = SEEDS.map(s => model(s).wind.typical);
  ok(typ.every(t => t >= S.Wind.min && t <= S.Wind.max), `each world's typical wind is drawn from the Wind range (${typ.map(t => t.toFixed(1)).join(', ')})`);
  ok(new Set(typ).size === typ.length || S.Wind.min === S.Wind.max, 'worlds draw different typical winds');
}

// ---- the sim's wind is the model's, and it never touches sim.rng
{
  const { AS: A, sim: s } = stage({ seed: 5, size: 9 });
  const before = s.rng.state();
  for (let i = 0; i < 20000; i++) { A.weatherTick(s); s.tickCount++; }
  ok(s.rng.state() === before, 'running weatherTick 20000 times leaves sim.rng where it was');
  ok(s.wind === s.weather.wind && Number.isFinite(s.wind.kmh), 'sim.wind is the live wind');
}

// ---- a world plays out the same with or without the wind running
// (a dry world: the wind carries the showers, so with water and rain, no weather means no rain)
{
  const run = (wind) => {
    const { AS: A, sim: s } = stage({ seed: 3, size: [60, 45], bare: false, settings: { StartLayout: 'Meadows', Rain: 0 } });
    if (!wind) A.weatherTick = () => {};
    const n = days(A, 3);
    for (let i = 0; i < n; i++) s.tick();
    return `${audit(A, s, 'w')} ${s.rng.state()} ${s.W.bunnies} ${s.W.wolves} ${s.W.gCount}`;
  };
  const a = run(true), b = run(false);
  ok(a === b, `3 days: world hash, rng state and counts are identical with and without wind (${a})`);
}

// ---- bounds, smoothness, and how often it is windy
{
  const stats = (every) => {
    let n = 0, spell = 0, near = 0, maxTurnHr = 0, maxRelHr = 0, maxAbsHr = 0, over = false, under = false;
    const means = [];
    for (const seed of SEEDS) {
      const m = model(seed, every), typ = m.wind.typical, cap = typ * S.WindSpells;
      const s = series(m, DAYS);
      let sum = 0;
      for (let i = 0; i < s.length; i++) {
        const k = s[i].kmh;
        if (k > cap * (1 + 1e-9)) over = true;
        if (k < 0) under = true;
        n++; sum += k / typ;
        if (k > SPELL_X * typ) spell++;
        if (k > 0.5 * typ && k < 1.5 * typ) near++;
        if (i) {
          maxTurnHr = Math.max(maxTurnHr, turn(s[i].from, s[i - 1].from));
          maxAbsHr = Math.max(maxAbsHr, Math.abs(k - s[i - 1].kmh) / typ);
        }
      }
      means.push(sum / s.length);
    }
    return { n, spell: spell / n, near: near / n, maxTurnHr, maxAbsHr, over, under, mean: means.reduce((a, b) => a + b) / means.length };
  };
  const a = stats(World.WEATHER_EVERY_TICKS);
  const hours = S.WindChangeHours;
  // The most one hour can move a walk, whatever the interval: it starts at its cut-off
  // (MAX_DRAW) and every step's push is at its cut-off too, each shrunk by the steps after.
  const hourMove = (tau, every) => {
    const k = Math.exp(-(every / HR) / tau), n = HR / every;
    return World.MAX_DRAW * ((1 - Math.pow(k, n)) + Math.sqrt(1 - k * k) * (1 - Math.pow(k, n)) / (1 - k));
  };
  const veerMax = (every) => World.VEER_SD * hourMove(hours * World.VEER_SLOWER, every);
  ok(!a.over && !a.under, `strength stays within 0 .. typical x WindSpells over ${a.n} hours`);
  ok(a.maxTurnHr <= veerMax(World.WEATHER_EVERY_TICKS) + 1e-9, `the direction turns at most ${(a.maxTurnHr * 180 / Math.PI).toFixed(1)} degrees in an hour (bound ${(veerMax(World.WEATHER_EVERY_TICKS) * 180 / Math.PI).toFixed(1)})`);
  const gMax = Math.exp(World.GUST_SD * (hourMove(hours, World.WEATHER_EVERY_TICKS) + World.MAX_DRAW) + World.SPELL_SD * (hourMove(hours * World.SPELL_SLOWER, World.WEATHER_EVERY_TICKS) + World.MAX_DRAW));
  ok(a.maxAbsHr < gMax, `the strength moves at most ${a.maxAbsHr.toFixed(2)} x typical in an hour (no jumps)`);
  ok(a.spell > 0.005, `spells above ${SPELL_X} x typical happen (${(a.spell * 100).toFixed(1)}% of hours)`);
  ok(a.spell < 0.25, `... and are a minority`);
  ok(a.near > 0.6, `most hours sit within half to one and a half times typical (${(a.near * 100).toFixed(0)}%)`);

  // Step-size independence: twice as often (and half as often) gives the same character.
  const b = stats(Math.max(1, Math.round(World.WEATHER_EVERY_TICKS / 2)));
  const c = stats(World.WEATHER_EVERY_TICKS * 2);
  const close = (x, y, tol) => Math.abs(x - y) <= tol;
  for (const [name, o, every] of [['half the interval', b, Math.max(1, Math.round(World.WEATHER_EVERY_TICKS / 2))], ['double the interval', c, World.WEATHER_EVERY_TICKS * 2]]) {
    ok(close(o.spell, a.spell, 0.05) && close(o.near, a.near, 0.08) && close(o.mean, a.mean, 0.1),
      `${name}: spells ${(o.spell * 100).toFixed(1)}% vs ${(a.spell * 100).toFixed(1)}%, near typical ${(o.near * 100).toFixed(0)}% vs ${(a.near * 100).toFixed(0)}%, mean ${o.mean.toFixed(2)} vs ${a.mean.toFixed(2)} x typical`);
    ok(o.maxTurnHr <= veerMax(every) + 1e-9, `${name}: still smooth (${(o.maxTurnHr * 180 / Math.PI).toFixed(1)} degrees an hour at most)`);
  }
}

// ---- direction: unit vector blows toward, opposite the bearing it comes from
{
  const m = model(9, World.WEATHER_EVERY_TICKS);
  let good = true;
  for (let i = 0; i < 500; i++) {
    m.step();
    const w = m.wind, f = w.from;
    if (!(f >= 0 && f < 2 * Math.PI) || Math.abs(Math.hypot(w.toX, w.toY) - 1) > 1e-9) good = false;
    // The point the wind comes from, as an offset: (sin f, -cos f) with north up (-y).
    if (Math.abs(w.toX + Math.sin(f)) > 1e-9 || Math.abs(w.toY - Math.cos(f)) > 1e-9) good = false;
  }
  ok(good, 'from is in [0, 2 PI) and (toX, toY) is the unit vector away from that bearing');
}

// ---- the words
{
  const lo = World.CALM_BELOW_KMH, hi = World.WINDY_FROM_KMH, e = 1e-6;
  ok(AS.windWords(0) === 'calm' && AS.windWords(lo - e) === 'calm', 'below the calm line is calm');
  ok(AS.windWords(lo) === 'breeze' && AS.windWords(hi - e) === 'breeze', 'between the lines is a breeze');
  ok(AS.windWords(hi) === 'windy' && AS.windWords(hi * 3) === 'windy', 'from the windy line up is windy');
  const names = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  const q = Math.PI / 4;
  ok(names.every((n, i) => AS.windFromName(i * q) === n && AS.windFromName(i * q + q * 0.49) === n && AS.windFromName(i * q - q * 0.49 + 2 * Math.PI) === n), 'windFromName gives eight compass points, each over its own slice');
  ok(AS.windFromName(2 * Math.PI - 0.01) === 'north' && AS.windFromName(-0.01) === 'north', 'just under a full turn is north again');
}

// ---- every kind of world has wind
{
  for (const settings of [{ Water: 'off' }, { StartLayout: 'Scatter' }]) {
    const { sim: s } = stage({ size: 40, bare: false, settings });
    tick(s, 100);
    ok(s.wind && s.wind.kmh >= 0, `a world with ${JSON.stringify(settings)} has wind`);
  }
}
done('ALL PASS');
