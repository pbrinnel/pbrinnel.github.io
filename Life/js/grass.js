// Grass: growth every tick, then age, seeding and old-age death rolled once per in-world
// hour. The hour is spread over TICKS_PER_HOUR ticks, one slice of tiles per tick, so no
// single tick pays for the whole meadow.
(function (AS) {
  'use strict';

  const HOURS_PER_DAY = 24;
  const DAYS_PER_HOUR = 1 / HOURS_PER_DAY;
  // A blade bitten below this is dead; float error must not leave an invisible sliver.
  const DEAD_SIZE = 1e-6;

  // SeedChance is "seeds at least once per day", so it becomes a per-day hazard rate and the
  // hourly chance follows from it. Boost multiplies the rate, not the chance, so it can never
  // push the chance past 1; the lakeshore's boost (W.shore) multiplies it the same way. Rebuilt when the tables change (one per sim in practice).
  let cachedT = null, hourlyRate = 0, seedsAlways = false, sproutRate = 0;
  // Per-day chance → per-hour hazard rate, so a boost multiplies the rate, not the chance.
  const hourlyHazard = c => (c > 0 && c < 1 ? -Math.log(1 - c) / HOURS_PER_DAY : 0);
  function prepare(T) {
    cachedT = T;
    const c = T.grass.SeedChance;
    seedsAlways = c >= 1;
    hourlyRate = hourlyHazard(c);
    sproutRate = T.grass.SproutChance >= 1 ? Infinity : hourlyHazard(T.grass.SproutChance);
  }

  const nb = new Int32Array(4);

  AS.grassTick = function (sim) {
    const { T, W, rng } = sim;
    if (T !== cachedT) prepare(T);
    const g = T.grass, gSize = W.gSize, gList = W.gList, boostSrc = W.boostSrc, cNut = W.cNut;
    const base = g.GrowthRate * AS.DT_DAYS, shore = W.shore;

    for (let i = 0, n = W.gCount; i < n; i++) {
      const t = gList[i], s = gSize[t];
      if (s >= 1) continue;
      // A lakeshore's boost multiplies the base rate, so a corpse's boost multiplies on top of it.
      const rate = base * shore[t];
      let grown = s + rate;
      const src = boostSrc[t];
      if (src >= 0 && grown < 1) {
        // Each unit of extra growth costs the corpse one unit of Nutrient.
        const boost = sim.T[AS.SPECIES_KEY[W.cSpecies[src]]].CorpseBoost;
        let extra = rate * (boost - 1);
        if (extra > 1 - grown) extra = 1 - grown;
        if (extra > cNut[src]) extra = cNut[src];
        if (extra > 0) { cNut[src] -= extra; grown += extra; }
      }
      gSize[t] = grown < 1 ? grown : 1;
    }

    const phase = sim.tickCount % AS.TICKS_PER_HOUR;
    const firstNew = W.nextSerial;   // blades seeded in this pass wait for the next hour
    const scorch = W.scorch;
    for (let t = phase; t < W.n; t += AS.TICKS_PER_HOUR) {
      // Scorched ground cools an hour at a time; nothing grows on it until it reaches 0.
      let burnt = scorch[t];
      if (burnt > 0) { burnt = burnt > DAYS_PER_HOUR ? burnt - DAYS_PER_HOUR : 0; scorch[t] = burnt; }
      // An empty tile can grow a blade by itself (SproutChance), so grass can come back to
      // land it has lost; a nearby corpse speeds that up like it speeds seeding.
      if (W.kind[t] === AS.KIND.EMPTY) {
        if (sproutRate > 0 && !W.hole[t] && burnt === 0 && !W.beach[t]) {
          const ps = 1 - Math.exp(-sproutRate * shore[t] * (boostSrc[t] >= 0 ? AS.corpseBoost(sim, t) : 1));
          if (rng.chance(ps)) W.addGrass(t, g.SproutSize, 0);
        }
        continue;
      }
      if (W.kind[t] !== AS.KIND.GRASS || W.serial[t] >= firstNew) continue;
      const age = W.gAge[t] += DAYS_PER_HOUR;
      if (age >= g.Lifespan) { W.removeGrass(t); continue; }
      if (gSize[t] < 1) continue;
      let p;
      if (seedsAlways) p = 1;
      else if (hourlyRate === 0) continue;
      else {
        const src = boostSrc[t];
        p = 1 - Math.exp(-hourlyRate * shore[t] * (src >= 0 ? AS.corpseBoost(sim, t) : 1));
      }
      if (p < 1 && !rng.chance(p)) continue;
      const k = W.neighbors4(t, nb);
      let free = 0;
      for (let j = 0; j < k; j++) if (W.kind[nb[j]] === AS.KIND.EMPTY && !W.hole[nb[j]] && scorch[nb[j]] === 0 && !W.beach[nb[j]]) nb[free++] = nb[j];
      if (free) W.addGrass(nb[rng.int(free)], g.SproutSize, 0);
    }
  };

  AS.grassBite = function (sim, t, amount) {
    const W = sim.W;
    if (W.kind[t] !== AS.KIND.GRASS) return 0;
    const size = W.gSize[t];
    const taken = amount < size ? amount : size;
    const left = size - taken;
    if (left <= DEAD_SIZE) W.removeGrass(t);
    else W.gSize[t] = left;
    return taken;
  };

  AS.grassStage = function (sim, t) {
    const g = sim.T.grass, age = sim.W.gAge[t];
    if (g.ElderAt != null && age >= g.ElderAt * g.Lifespan) return 'Elder';
    return age >= g.TimeToMature ? 'Mature' : 'Sprout';
  };
})(globalThis.AS);
