// The world's wind: a direction and a strength that drift slowly over in-world time, from
// the world's seed. Fire spread and the drawing read it; nothing here changes the world.
//
//   sim.wind = { from, kmh, toX, toY }   updated in place by AS.weatherTick, read-only to
//                                        everyone else
//     from  radians, a compass bearing the wind blows FROM: 0 = north, PI/2 = east,
//           PI = south, 3PI/2 = west, in [0, 2PI)
//     kmh   strength in km/h, 0 .. typical x WindSpells
//     toX, toY  the unit vector it blows TOWARD, in tile coordinates (x right, y down)
//
// The model, all per in-world hour so changing WEATHER_EVERY_TICKS doesn't change its
// character: three mean-reverting random walks (exact Ornstein-Uhlenbeck steps). `gust` and
// `spell` multiply the strength (the spell wanders several times slower, so now and then
// the wind stays strong for a good while) and `veer` swings the direction around the
// world's prevailing one. The strength is the world's typical wind times
// exp(GUST_SD * gust + SPELL_SD * spell), centered so its median is the typical wind:
// lognormal, so it is never negative and is mostly near typical, with a tail of stronger
// spells, cut off at typical x WindSpells.
//
// Its own generator, seeded from the world's seed and kept apart from sim.rng: a world's
// animals and grass play out exactly the same whatever the wind does.
(function (AS) {
  'use strict';

  const SEED_SALT = 0x71d0a9c3;       // keeps the wind's generator apart from sim.rng and the ground's
  const WEATHER_EVERY_TICKS = 5;      // the wind updates this often; it is far slower than a tick
  const GUST_SD = 0.25;               // spread of ln(strength / typical) from the quick walk
  const SPELL_SD = 0.3;               // ... and from the slow one that makes the spells
  const SPELL_SLOWER = 4;             // the spell walk takes this many times WindChangeHours
  const VEER_SD = 0.6;                // radians the direction wanders around the prevailing one
  const VEER_SLOWER = 2;              // the direction takes this many times WindChangeHours
  const MAX_DRAW = 3;                 // a walk's random push is cut off at this many deviations, so no step jumps

  const CALM_BELOW_KMH = 2;           // windWords: under this, calm
  const WINDY_FROM_KMH = 20;          // ... from this, windy; between, a breeze

  const TAU = Math.PI * 2;
  const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

  // One walk step of `dt` hours with time constant `tau` hours: exact for any dt, so the
  // distribution it settles to doesn't depend on how often it is stepped.
  function walk(x, dt, tau, rng) {
    const keep = Math.exp(-dt / tau);
    let g = Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(TAU * rng.next());
    g = Math.max(-MAX_DRAW, Math.min(MAX_DRAW, g));
    return x * keep + Math.sqrt(1 - keep * keep) * g;
  }

  // A fresh draw from a walk's settled distribution, so a world doesn't start from a lull.
  function settled(rng) {
    const g = Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(TAU * rng.next());
    return Math.max(-MAX_DRAW, Math.min(MAX_DRAW, g));
  }

  // The wind model for a world: { wind, step() }. `every` is the update interval in ticks;
  // the check builds it at other values to prove the statistics don't depend on it.
  AS.Wind = function (T, seed, every = WEATHER_EVERY_TICKS) {
    const rng = AS.makeRng((seed ^ SEED_SALT) >>> 0);
    // WindChangeHours is "noticeably" in the sense of a time constant: the quick walk forgets
    // about 63% of where it was in that long.
    const range = T.world.Wind, spells = T.world.WindSpells, hours = T.world.WindChangeHours;
    const typical = range.min + rng.next() * (range.max - range.min);
    const prevailing = rng.next() * TAU;
    let gust = settled(rng), spell = settled(rng), veer = settled(rng);
    const dt = every / AS.TICKS_PER_HOUR;
    const wind = { from: 0, kmh: 0, toX: 0, toY: 0 };
    wind.typical = typical;
    wind.prevailing = prevailing;

    function set() {
      const f = Math.exp(GUST_SD * gust + SPELL_SD * spell);
      wind.kmh = Math.min(typical * spells, typical * f);
      const from = ((prevailing + VEER_SD * veer) % TAU + TAU) % TAU;
      wind.from = from;
      wind.toX = -Math.sin(from);
      wind.toY = Math.cos(from);
    }
    set();

    return {
      wind, every,
      step() {
        gust = walk(gust, dt, hours, rng);
        spell = walk(spell, dt, hours * SPELL_SLOWER, rng);
        veer = walk(veer, dt, hours * VEER_SLOWER, rng);
        set();
      },
    };
  };

  // Called first in sim.tick.
  AS.weatherTick = function (sim) {
    const m = sim.weather;
    if (sim.tickCount % m.every === 0) m.step();
  };

  // The words the Info window uses.
  AS.windWords = function (kmh) {
    return kmh < CALM_BELOW_KMH ? 'calm' : kmh < WINDY_FROM_KMH ? 'breeze' : 'windy';
  };

  // The compass point (of eight) a bearing in radians falls nearest to.
  AS.windFromName = function (from) {
    const i = Math.round((((from % TAU) + TAU) % TAU) / (TAU / COMPASS.length)) % COMPASS.length;
    return COMPASS[i];
  };

  AS.WIND = Object.freeze({ CALM_BELOW_KMH, WINDY_FROM_KMH, WEATHER_EVERY_TICKS, GUST_SD, SPELL_SD, SPELL_SLOWER, VEER_SD, VEER_SLOWER, MAX_DRAW });
})(globalThis.AS);
