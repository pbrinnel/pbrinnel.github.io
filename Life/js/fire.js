// Fire: a flow a tile can be in (world.js owns the layer), burning the solid under it. A
// blade or a corpse is the fuel; bare ground, holes and water never burn, so they are
// firebreaks. Animals don't burn yet, and fire doesn't spread onto a tile with one.
//
//   AS.ignite(sim, t) → bool      the one way a fire starts: PAINT's FIRE MODE now, lightning
//                                 and humans later. False unless t has fuel, no flow and no hole.
//   AS.fireTick(sim)              every FIRE_EVERY ticks: ages each burning tile, lets it light
//                                 its neighbors, and ends the ones that have burnt through.
//   AS.fireStep(sim, hours)       the same pass for `hours` of in-world time (the checks call it
//                                 at other step sizes to prove the rates are per hour)
//   AS.fireStage(W, t) → 0..1     how far through its burn a tile is (age / burn time), 0 when
//                                 it isn't burning; the drawing reads it
//
// A burning tile has an age (hours) and a burn time (how long its fuel lasts, set when it
// catches: a blade's is Grass BurnHours times its Size, a corpse's its species' BurnHours).
// While it burns, each of its 8 neighbors that has fuel and no flow may catch, as a chance per
// in-world hour with this rate (per hour):
//
//   FireSpread × fuel × dryness × wind × (1 / distance)
//
//   fuel      the neighbor's: a blade's Size (0..1), a corpse counts as full
//   dryness   0..1, 1 - soil water / the soil's room under the neighbor, so a drought burns
//             readily and wet ground hardly at all; FireDryness where the world has no water rules
//   wind      max(0, 1 + FireWind × s × cos), s = wind strength / FULL_WIND_KMH (at most 1),
//             cos the angle between the way to the neighbor and the way the wind blows: more
//             downwind, less upwind, and a gale strong enough can stop it upwind altogether
//   distance  1 for the 4 sides, √2 for the 4 corners: a fire creeps at a given speed, so a
//             corner (farther away) is lit at 1/√2 the rate
//
// The hour's rate becomes the chance for a step exactly (1 - exp(-rate × hours), as grass.js
// does), so the fire spreads at the same speed whatever FIRE_EVERY is. A tile's last step is
// cut short at its burn time for the same reason. Rolls come from sim.rng, and only when some
// tile is burning with a neighbor that could catch: a world without fire draws nothing.
//
// Burning out: the solid is gone (a blade removed; a corpse through corpse.js so the grass it
// was boosting is released), the tile's flow is NONE, and the ground is scorched for
// FireScorchDays (the larger of that and any scorch it already had). The ash that makes grass
// regrow faster comes in a later step.
(function (AS) {
  'use strict';

  const FIRE_EVERY = 3;          // ticks between fire passes (about an eighth of an in-world hour): short enough that the pass length hardly shows in the fire's speed
  const FULL_WIND_KMH = 30;      // the wind strength that counts as s = 1 (about WindSpells × a typical Wind)
  const MIN_BLADE_BURN = 0.2;    // a blade burns at least this share of a full blade's BurnHours, so a sprout still burns briefly
  AS.FIRE = Object.freeze({ EVERY: FIRE_EVERY, FULL_WIND_KMH, MIN_BLADE_BURN });

  const KIND = AS.KIND, FLOW = AS.FLOW;
  const SQRT2 = Math.SQRT2;
  // The 8 neighbors: offset, and 1 / distance. Dir cosines are worked out per pass from the wind.
  const DX = [0, 1, 1, 1, 0, -1, -1, -1];
  const DY = [-1, -1, 0, 1, 1, 1, 0, -1];
  const LEN = DX.map((x, i) => Math.hypot(x, DY[i]));
  const dirRate = new Float64Array(8);   // per direction: the wind factor / distance, for this pass

  const hasFuel = (W, t) => (W.kind[t] === KIND.GRASS || W.kind[t] === KIND.CORPSE) && !W.hole[t];

  // How long the fuel on tile t burns, in in-world hours.
  function burnHours(sim, t) {
    const W = sim.W;
    if (W.kind[t] === KIND.GRASS) return sim.T.grass.BurnHours * Math.max(MIN_BLADE_BURN, W.gSize[t]);
    return sim.T[AS.SPECIES_KEY[W.cSpecies[t]]].BurnHours;
  }

  AS.ignite = function (sim, t) {
    const W = sim.W;
    if (!hasFuel(W, t) || W.flow[t] !== FLOW.NONE) return false;
    W.addFire(t, burnHours(sim, t));
    return true;
  };

  AS.fireStage = function (W, t) {
    if (W.flow[t] !== FLOW.FIRE) return 0;
    const p = W.fireAge[t] / W.fireTime[t];
    return p < 0 ? 0 : p > 1 ? 1 : p;
  };

  function burnOut(sim, t) {
    const W = sim.W;
    W.removeFire(t);
    if (W.kind[t] === KIND.GRASS) W.removeGrass(t);
    else AS.corpseRemove(sim, t);
    const days = sim.T.world.FireScorchDays;
    if (days > W.scorch[t]) W.scorch[t] = days;
  }

  AS.fireStep = function (sim, hours) {
    const W = sim.W;
    if (W.fCount === 0) return;
    const { rng, T } = sim, S = T.world, w = W.w, h = W.h;
    // The wind's pull on each direction: 1 + FireWind × s × cos, never below 0, over distance.
    const wind = sim.wind, s = Math.min(1, wind.kmh / FULL_WIND_KMH);
    for (let d = 0; d < 8; d++) {
      const cos = (DX[d] * wind.toX + DY[d] * wind.toY) / LEN[d];
      dirRate[d] = Math.max(0, 1 + S.FireWind * s * cos) / LEN[d];
    }
    const soil = W.water, G = soil ? soil.G : null, room = soil ? soil.room : 1;
    const drySet = S.FireDryness, spread = S.FireSpread;
    const fireAge = W.fireAge, fireTime = W.fireTime, kind = W.kind, flow = W.flow, hole = W.hole, gSize = W.gSize;
    // Backwards, as corpse.js does: burning out swaps the last tile into this slot, and that one
    // is either done this pass or caught during it, so neither wants another turn.
    for (let k = W.fCount - 1; k >= 0; k--) {
      const t = W.fList[k];
      const age = fireAge[t], time = fireTime[t];
      // How long it spread this pass: all of it, less any part after it burnt through, plus the
      // part of the pass it was already burning when it caught (see below), which only a tile
      // younger than a pass (age < hours) hasn't had yet.
      const credit = age < hours ? age : 0;
      const live = Math.min(hours + credit, time - age + credit);
      if (live > 0) {
        const x = t % w, y = (t / w) | 0;
        for (let d = 0; d < 8; d++) {
          const nx = x + DX[d], ny = y + DY[d];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const u = ny * w + nx;
          if (flow[u] !== FLOW.NONE || hole[u]) continue;
          const fuel = kind[u] === KIND.GRASS ? gSize[u] : kind[u] === KIND.CORPSE ? 1 : 0;
          if (fuel <= 0) continue;
          const dry = G ? 1 - G[u] / room : drySet;
          const rate = spread * fuel * (dry < 0 ? 0 : dry > 1 ? 1 : dry) * dirRate[d];
          if (!(rate > 0)) continue;
          if (rng.chance(1 - Math.exp(-rate * live))) {
            W.addFire(u, burnHours(sim, u));
            // It caught some time in this pass but can only act from the next, so it starts half
            // a pass old (on average how long it has really been burning) and its first pass
            // makes up the other half's spreading: the fire's speed doesn't depend on how long
            // a pass is.
            fireAge[u] = hours / 2;
          }
        }
      }
      if (age + hours >= time) burnOut(sim, t);
      else fireAge[t] = age + hours;
    }
  };

  AS.fireTick = function (sim) {
    if (sim.tickCount % FIRE_EVERY !== 0 || sim.W.fCount === 0) return;
    AS.fireStep(sim, FIRE_EVERY / AS.TICKS_PER_HOUR);
  };
})(globalThis.AS);
