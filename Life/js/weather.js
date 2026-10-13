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
//
// RAIN falls from showers carried by that wind (Paul, 12 Oct 2026: rain is local). A shower is
// a disk that rains `mmh` mm an hour on every tile under it, moves at the wind's real speed
// and direction, and ends after its life. Showers are born at random places over a region
// that reaches past the map on every side by the farthest the strongest wind can carry one
// during its life, so a shower born off the map can drift onto it and the map's coverage is
// even. How often they are born follows a slow lognormal walk (wet and dry spells over
// days). The world's `Rain` stays the long-run mean (see startRain). Rain has its own
// generator too (seed, SEED_SALT and RAIN_SALT), apart from the wind's: the wind is the same
// whether or not it rains. Only a world with water and Rain above 0 has showers
// (terrain.js layTerrain calls startRain); every other world has none, draws nothing, and
// everything below stays empty.
//
//   sim.weather.showers  the live showers, struct of arrays (read the arrays off `showers`
//                        each time: they are replaced when they grow). Only [0, n) is live,
//                        and the order changes as showers end.
//       n         how many
//       x, y      center in tile coordinates (floats, x right, y down; the map is
//                 [0, WorldWidth) x [0, WorldHeight)); may be off the map: cull when drawing
//       r         radius in tiles
//       mmh       rain under it, mm an hour
//       left      in-world hours of its life left
//   sim.weather.dryDays    in-world days since any rain fell on the map (counted from day 0)
//   sim.weather.rainToday  mean mm over the map in the last in-world day
//   sim.weather.spellRate  the wet/dry spell now: the birth rate as a multiple of its mean
//   sim.weather.field      Float32Array, one per tile: mm that fell on the tile since the
//                          water last took it (water.js exchange); null with no showers
//   sim.weather.clearRain()  water calls it after each step, zeroing only the rows rain touched
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
  const RAIN_SALT = 0x3c9e5a1d;       // keeps the showers' generator apart from the wind's
  const PIECE_RADII = 1;              // a shower's path is cut into pieces no longer than this many radii, so each piece's box of tiles stays small
  const POISSON_CHUNK = 30;           // births are drawn in chunks of at most this mean (Knuth's method underflows for large ones)
  const SHOWERS_START = 64;           // room for this many live showers; the arrays double when full
  const HOURS_PER_DAY = 24;

  const CALM_BELOW_KMH = 2;           // windWords: under this, calm
  const WINDY_FROM_KMH = 20;          // ... from this, windy; between, a breeze

  const TAU = Math.PI * 2;
  const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

  // One walk step of `dt` hours with time constant `tau` hours: exact for any dt, so the
  // distribution it settles to doesn't depend on how often it is stepped.
  // `cut` limits the random push to that many deviations: the wind uses MAX_DRAW so no step
  // jumps; the rain's spell walk uses Infinity, so its settled distribution is exactly normal
  // and the lognormal rate averages exactly what startRain centers it on.
  function walk(x, dt, tau, rng, cut = MAX_DRAW) {
    const keep = Math.exp(-dt / tau);
    let g = Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(TAU * rng.next());
    g = Math.max(-cut, Math.min(cut, g));
    return x * keep + Math.sqrt(1 - keep * keep) * g;
  }

  // A fresh draw from a walk's settled distribution, so a world doesn't start from a lull.
  function settled(rng, cut = MAX_DRAW) {
    const g = Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(TAU * rng.next());
    return Math.max(-cut, Math.min(cut, g));
  }

  // A count with mean m (Knuth), in chunks so a large mean can't underflow exp(-m).
  function poisson(m, rng) {
    let k = 0;
    while (m > 0) {
      const part = Math.min(m, POISSON_CHUNK);
      m -= part;
      const limit = Math.exp(-part);
      let p = rng.next();
      while (p > limit) { k++; p *= rng.next(); }
    }
    return k;
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

    // ---- showers ----
    const rrng = AS.makeRng((seed ^ SEED_SALT ^ RAIN_SALT) >>> 0);
    const showers = { n: 0, x: null, y: null, r: null, mmh: null, left: null };
    const grow = (cap) => {
      for (const k of ['x', 'y', 'r', 'mmh', 'left']) {
        const a = new Float64Array(cap);
        if (showers[k]) a.set(showers[k]);
        showers[k] = a;
      }
    };
    grow(SHOWERS_START);
    const weather = { wind, every, showers, field: null, dryDays: 0, rainToday: 0, spellRate: 1 };
    let rain = null;   // set by startRain: the world's grid and shower numbers
    let wet = 0;       // the rain's spell walk: wet above 0, dry below (startRain draws it)

    // The shower ending at slot i leaves; the last takes its place.
    function remove(i) {
      const last = --showers.n;
      for (const k of ['x', 'y', 'r', 'mmh', 'left']) showers[k][i] = showers[k][last];
    }

    // Rain onto the field from one shower for `act` hours of straight travel at (vx, vy)
    // tiles an hour from its center (cx, cy). A tile is rained on while its center is inside
    // the disk, so its mm are mmh x the hours that is true: the disk's center is c + v t, and
    // |q - v t| <= R (q: tile center minus c) is a quadratic in t whose roots bound the
    // time inside. Exact for any step length, which is why the rain doesn't depend on
    // WEATHER_EVERY_TICKS. The path is cut into pieces of at most PIECE_RADII radii and
    // only the tiles in a piece's box are looked at: a long path across a wide map stays
    // as cheap as the area it wets, not the box around the whole path.
    function deposit(cx, cy, R, mmh, vx, vy, act) {
      const { w, h, field } = rain;
      const v2 = vx * vx + vy * vy, R2 = R * R;
      const pieces = Math.max(1, Math.ceil(Math.sqrt(v2) * act / (PIECE_RADII * R)));
      const dtp = act / pieces;
      for (let k = 0; k < pieces; k++) {
        const ta = k * dtp, tb = ta + dtp;
        const ax = cx + vx * ta, ay = cy + vy * ta, bx = cx + vx * tb, by = cy + vy * tb;
        const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - R)), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + R));
        const y0 = Math.max(0, Math.floor(Math.min(ay, by) - R)), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + R));
        if (x0 > x1 || y0 > y1) continue;
        let touched = false;
        for (let y = y0; y <= y1; y++) {
          const qy = y + 0.5 - cy;
          for (let x = x0, i = y * w + x0; x <= x1; x++, i++) {
            const qx = x + 0.5 - cx;
            const c = qx * qx + qy * qy - R2;
            let lo, hi;
            if (v2 === 0) { if (c > 0) continue; lo = ta; hi = tb; }
            else {
              const b = qx * vx + qy * vy, disc = b * b - v2 * c;
              if (disc <= 0) continue;
              const sq = Math.sqrt(disc);
              lo = Math.max((b - sq) / v2, ta); hi = Math.min((b + sq) / v2, tb);
              if (hi <= lo) continue;
            }
            const mm = mmh * (hi - lo);
            field[i] += mm; rain.stepMm += mm; touched = true;
          }
        }
        if (touched) { if (y0 < rain.dirtyLo) rain.dirtyLo = y0; if (y1 > rain.dirtyHi) rain.dirtyHi = y1; }
      }
    }

    // A shower that has `act` hours of this step left to live: rain, move, age. Gone when its life is.
    function advance(i, act) {
      const S = showers;
      act = Math.min(act, S.left[i]);
      if (act > 0) {
        const f = wind.kmh * 1000 / AS.TILE_M;   // km/h in tiles an hour
        const vx = wind.toX * f, vy = wind.toY * f;
        if (rain.depositing) deposit(S.x[i], S.y[i], S.r[i], S.mmh[i], vx, vy, act);
        S.x[i] += vx * act; S.y[i] += vy * act;
        S.left[i] -= act;
      }
      return S.left[i] > 0;
    }

    // One step of dt hours: showers already out rain and move, then the step's births (each
    // at a random moment in it, so it only has the rest of the step to rain) do the same.
    function showerStep(dtH) {
      const S = showers;
      for (let i = S.n - 1; i >= 0; i--) if (!advance(i, dtH)) remove(i);
      const births = poisson(rain.birthsPerDay * weather.spellRate * dtH / HOURS_PER_DAY, rrng);
      for (let b = 0; b < births; b++) {
        if (S.n === S.x.length) grow(S.x.length * 2);
        const i = S.n++;
        S.x[i] = -rain.margin + rrng.next() * (rain.w + 2 * rain.margin);
        S.y[i] = -rain.margin + rrng.next() * (rain.h + 2 * rain.margin);
        S.r[i] = rain.radius.min + rrng.next() * (rain.radius.max - rain.radius.min);
        S.mmh[i] = rain.mmh.min + rrng.next() * (rain.mmh.max - rain.mmh.min);
        S.left[i] = rain.hours.min + rrng.next() * (rain.hours.max - rain.hours.min);
        if (!advance(i, rrng.next() * dtH)) remove(i);
      }
    }

    // Turns showers on for a world with water and Rain above 0 (terrain.js layTerrain; S: the
    // world's own settings, w x h its tiles). Calibrated so the long-run mean rain on a tile
    // is S.Rain mm a day, exactly in expectation:
    //
    //   A point is rained on by a shower for as long as its disk is over the point. Add that
    //   up over all the places the shower might have been born (it moves rigidly, so wherever
    //   the point is, the shower's disk sweeps the point's neighborhood the same way) and
    //   each shower contributes its intensity x its life x its disk's area, in mm km2,
    //   whatever the wind does. So with showers born at `rho` per km2 per day, a point gets
    //
    //       rho x E[mm an hour] x E[hours] x E[pi r2]  mm a day,
    //
    //   the three drawn independently, and rho = Rain / that. The means are those of the
    //   uniform ranges the settings give: E[mm an hour] and E[hours] are the middles of their
    //   ranges, and E[r2] for a diameter uniform in [d1, d2] is (d1^2 + d1 d2 + d2^2) / 12,
    //   not the square of the mean radius. The births per day are rho x the birth region's
    //   area, which is the map grown by `margin` on every side: the farthest the strongest
    //   wind (typical x WindSpells) carries a shower in its longest life, plus its largest
    //   radius, so no shower born outside could ever reach the map and none is missed. The
    //   wet and dry spells multiply the rate by a lognormal, centered on its mean (x
    //   exp(-spread^2 / 2)) so the long-run total stays Rain.
    weather.startRain = function (S, w, h) {
      const tileKm = AS.TILE_M / 1000, n = w * h;
      const d = S.ShowerKm, i = S.ShowerMmPerHour, l = S.ShowerHours;
      const eR2 = (d.min * d.min + d.min * d.max + d.max * d.max) / 12;
      const perShower = (i.min + i.max) / 2 * (l.min + l.max) / 2 * Math.PI * eR2;   // mm km2
      const marginKm = typical * spells * l.max + d.max / 2;
      const margin = marginKm / tileKm;
      const areaKm2 = (w + 2 * margin) * (h + 2 * margin) * tileKm * tileKm;
      const birthsPerDay = S.Rain / perShower * areaKm2;
      const dtH = every / AS.TICKS_PER_HOUR;
      rain = {
        w, h, n, margin, birthsPerDay,
        radius: { min: d.min / 2 / tileKm, max: d.max / 2 / tileKm },
        mmh: i, hours: l,
        spread: S.RainSpread, tau: S.RainSpellDays * HOURS_PER_DAY,
        field: new Float32Array(n), stepMm: 0, dirtyLo: h, dirtyHi: -1, depositing: false,
        ring: new Float64Array(Math.max(1, Math.round(HOURS_PER_DAY / dtH))), ringAt: 0, ringSum: 0,
        dtH,
      };
      weather.field = rain.field;
      weather.dryDays = 0; weather.rainToday = 0;
      wet = settled(rrng, Infinity);
      setSpellRate();
      // The sky before day 0 isn't recorded: showers born over the last longest-life are
      // already out, with today's wind and spell, so day 0 doesn't open on a clear sky.
      for (let t = 0; t < l.max; t += dtH) showerStep(dtH);
      rain.depositing = true;
    };


    function setSpellRate() {
      weather.spellRate = Math.exp(rain.spread * wet - rain.spread * rain.spread / 2);
    }

    // Puts one shower out at once, from the next step on (center and radius in tiles). The
    // checks use it to follow a single shower; nothing in the game does.
    weather.release = function (x, y, radius, mmh, hours) {
      const S = showers;
      if (S.n === S.x.length) grow(S.x.length * 2);
      const i = S.n++;
      S.x[i] = x; S.y[i] = y; S.r[i] = radius; S.mmh[i] = mmh; S.left[i] = hours;
    };

    // Zeroes what rain wrote since the last call: only the rows it touched.
    weather.clearRain = function () {
      if (!rain || rain.dirtyHi < rain.dirtyLo) return;
      rain.field.fill(0, rain.dirtyLo * rain.w, (rain.dirtyHi + 1) * rain.w);
      rain.dirtyLo = rain.h; rain.dirtyHi = -1;
    };

    function rainStep() {
      wet = walk(wet, rain.dtH, rain.tau, rrng, Infinity);
      setSpellRate();
      rain.stepMm = 0;
      showerStep(rain.dtH);
      const mean = rain.stepMm / rain.n;
      weather.dryDays = rain.stepMm > 0 ? 0 : weather.dryDays + rain.dtH / HOURS_PER_DAY;
      rain.ringSum += mean - rain.ring[rain.ringAt];
      rain.ring[rain.ringAt] = mean;
      rain.ringAt = (rain.ringAt + 1) % rain.ring.length;
      weather.rainToday = Math.max(0, rain.ringSum);
    }
    weather.step = function () {
      gust = walk(gust, dt, hours, rng);
      spell = walk(spell, dt, hours * SPELL_SLOWER, rng);
      veer = walk(veer, dt, hours * VEER_SLOWER, rng);
      set();
      if (rain) rainStep();
    };
    return weather;
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
