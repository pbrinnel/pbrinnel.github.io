// Grass: growth, age, seeding and old-age death, all once per in-world hour. The hour is
// spread over TICKS_PER_HOUR ticks, one slice of tiles per tick, so no single tick pays for
// the whole meadow.
(function (AS) {
  'use strict';

  const HOURS_PER_DAY = 24;
  const DAYS_PER_HOUR = 1 / HOURS_PER_DAY;
  // A blade bitten below this is dead; float error must not leave an invisible sliver.
  const DEAD_SIZE = 1e-6;
  // Ash weathered below this (in grass Size) is gone, so a tile's last trace doesn't linger for
  // ever as a number too small to boost anything or to draw.
  const ASH_GONE = 1e-3;

  // SeedChance is "seeds at least once per day", so it becomes a per-day hazard rate and the
  // hourly chance follows from it. A corpse's boost multiplies the rate, not the chance, so it
  // can never push the chance past 1. Rebuilt when the tables change (one per sim in practice).
  // sproutP and seedP: the hourly chances with no boost, worked out once. ashBoost and ashKeep:
  // the boost on a tile with ash, and the share of its ash that survives an hour.
  let cachedT = null, resproutRate = 0, hourlyRate = 0, seedsAlways = false, sproutRate = 0, sproutP = 0, seedP = 0, ashBoost = 1, ashKeep = 1;
  // Per-day chance → per-hour hazard rate, so a boost multiplies the rate, not the chance.
  const hourlyHazard = c => (c > 0 && c < 1 ? -Math.log(1 - c) / HOURS_PER_DAY : 0);
  function prepare(T) {
    cachedT = T;
    const c = T.grass.SeedChance;
    seedsAlways = c >= 1;
    hourlyRate = hourlyHazard(c);
    sproutRate = T.grass.SproutChance >= 1 ? Infinity : hourlyHazard(T.grass.SproutChance);
    sproutP = 1 - Math.exp(-sproutRate);
    seedP = 1 - Math.exp(-hourlyRate);
    resproutRate = T.world.ResproutChance >= 1 ? Infinity : hourlyHazard(T.world.ResproutChance);
    ashBoost = T.world.AshBoost;
    ashKeep = Math.pow(2, -1 / (HOURS_PER_DAY * T.world.AshHalfLife));
  }

  const nb = new Int32Array(4);

  AS.grassTick = function (sim) {
    const { T, W, rng } = sim;
    if (T !== cachedT) prepare(T);
    const g = T.grass, gSize = W.gSize, boostSrc = W.boostSrc, cNut = W.cNut;
    // A blade grows an hour's worth when the hourly pass reaches its tile (not a sliver every
    // tick: the same growth a day, a 25th of the work).
    const rate = g.GrowthRate * DAYS_PER_HOUR;

    const phase = sim.tickCount % AS.TICKS_PER_HOUR;
    const firstNew = W.nextSerial;   // blades seeded in this pass wait for the next hour
    const scorch = W.scorch, ash = W.ash, roots = W.roots;
    for (let t = phase; t < W.n; t += AS.TICKS_PER_HOUR) {
      // Scorched ground cools an hour at a time; nothing grows on it until it reaches 0.
      let burnt = scorch[t];
      if (burnt > 0) { burnt = burnt > DAYS_PER_HOUR ? burnt - DAYS_PER_HOUR : 0; scorch[t] = burnt; }
      // Ash weathers whatever is on the tile, scorched or not. Its boost counts only once the
      // scorch is over: a blade can't stand on scorch, and a bare tile checks it below.
      let cinder = ash[t];
      if (cinder > 0) { cinder *= ashKeep; if (cinder < ASH_GONE) cinder = 0; ash[t] = cinder; }
      // Roots are the burnt plant and age like it, scorched or not; at the Lifespan it was due to
      // die anyway, so they go before they can resprout.
      if (roots[t]) {
        const old = W.rootAge[t] + DAYS_PER_HOUR;
        if (old >= g.Lifespan) { roots[t] = 0; W.rootAge[t] = 0; } else W.rootAge[t] = old;
      }
      // A bare tile can grow a blade by itself (SproutChance), so grass can come back to
      // land it has lost; a nearby corpse speeds that up like it speeds seeding. Ground with living
      // roots rolls its resprout instead (below).
      if (W.kind[t] === AS.KIND.EMPTY) {
        const open = W.flow[t] === AS.FLOW.NONE && !W.hole[t] && burnt === 0 && !W.beach[t];   // where a blade may start
        if (W.roots[t] && open) {
          // Living roots put up a small blade of the same plant (its age goes on) in place of the
          // plain sprout roll, boosted by the one larger boost on the tile like a sprout. With
          // ResproutChance 0 they simply wait.
          if (resproutRate > 0) {
            let boost = 1;
            if (cinder > 0) boost = ashBoost;
            if (boostSrc[t] >= 0) { const cb = AS.corpseBoost(sim, t); if (cb > boost) boost = cb; }
            if (rng.chance(1 - Math.exp(-resproutRate * boost))) W.addGrass(t, g.SproutSize, W.rootAge[t]);   // (addGrass ends the roots)
          }
        } else if (sproutRate > 0 && open) {
          let ps;
          if (cinder > 0) {
            // One boost per tile, the larger (a tie is the ash's), as corpse.js keeps overlap from stacking.
            let boost = ashBoost;
            if (boostSrc[t] >= 0) { const cb = AS.corpseBoost(sim, t); if (cb > boost) boost = cb; }
            ps = 1 - Math.exp(-sproutRate * boost);
          } else ps = boostSrc[t] >= 0 ? 1 - Math.exp(-sproutRate * AS.corpseBoost(sim, t)) : sproutP;
          if (rng.chance(ps)) W.addGrass(t, g.SproutSize, 0);
        }
        continue;
      }
      // A burning blade is fuel now: it neither grows nor seeds (nor ages: fire.js ends it).
      if (W.kind[t] !== AS.KIND.GRASS || W.serial[t] >= firstNew || W.flow[t] === AS.FLOW.FIRE) continue;
      const s = gSize[t];
      if (s < 1) {
        let grown = s + rate;
        const src = boostSrc[t];
        if ((src >= 0 || cinder > 0) && grown < 1) {
          // Each unit of extra growth costs its source one unit: the corpse's Nutrient, or the
          // tile's ash. Only the larger boost applies, and the ash wins a tie.
          const cb = src >= 0 ? sim.T[AS.SPECIES_KEY[W.cSpecies[src]]].CorpseBoost : 0;
          const fromAsh = cinder > 0 && ashBoost >= cb;
          let extra = rate * ((fromAsh ? ashBoost : cb) - 1);
          if (extra > 1 - grown) extra = 1 - grown;
          const left = fromAsh ? cinder : cNut[src];
          if (extra > left) extra = left;
          if (extra > 0) { if (fromAsh) ash[t] = cinder - extra; else cNut[src] -= extra; grown += extra; }
        }
        gSize[t] = grown < 1 ? grown : 1;
      }
      const age = W.gAge[t] += DAYS_PER_HOUR;
      if (age >= g.Lifespan) { W.removeGrass(t); continue; }
      if (gSize[t] < 1) continue;
      let p;
      if (seedsAlways) p = 1;
      else if (hourlyRate === 0) continue;
      else {
        const src = boostSrc[t], a = ash[t];   // (a: what growth left of it just now)
        if (a > 0) {
          let boost = ashBoost;
          if (src >= 0) { const cb = AS.corpseBoost(sim, t); if (cb > boost) boost = cb; }
          p = 1 - Math.exp(-hourlyRate * boost);
        } else p = src >= 0 ? 1 - Math.exp(-hourlyRate * AS.corpseBoost(sim, t)) : seedP;
      }
      if (p < 1 && !rng.chance(p)) continue;
      const k = W.neighbors4(t, nb);
      let free = 0;
      for (let j = 0; j < k; j++) if (W.isBare(nb[j]) && !W.hole[nb[j]] && scorch[nb[j]] === 0 && !W.beach[nb[j]]) nb[free++] = nb[j];
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
