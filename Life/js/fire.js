// Fire: a flow a tile can be in (world.js owns the layer), burning the solid under it. A
// blade or a corpse is the fuel; bare ground, holes and water never catch from a neighbor, so
// they are firebreaks. Only ignite puts fire on bare ground (a brief ember, EmberHours) and
// that ember lights fuel beside it by the normal rules. An animal burns too, but its fire is
// on the animal (W.aAlight, in-world hours left; animals.js counts it down and does the
// damage), not in the tile's flow layer: a burning tile never holds an animal.
//
//   AS.ignite(sim, t) → bool      the one way a fire starts: PAINT's FIRE MODE now, lightning
//                                 and humans later. True when something caught: a blade or
//                                 corpse (no flow, no hole), an animal not already alight (not
//                                 in a hole or water), or bare ground (no hole, not scorched).
//   AS.fireTick(sim)              every FIRE_EVERY ticks: ages each burning tile, lets it light
//                                 its neighbors, and ends the ones that have burnt through.
//   AS.fireStep(sim, hours)       the same pass for `hours` of in-world time (the checks call it
//                                 at other step sizes to prove the rates are per hour)
//   AS.fireStage(W, t) → 0..1     how far through its burn a tile is (age / burn time), 0 when
//                                 it isn't burning; the drawing reads it
//
// A burning tile has an age (hours) and a burn time (how long its fuel lasts, set when it
// catches: a blade's is Grass BurnHours times its Size, a corpse's its species' BurnHours).
// While it burns, each of its 8 neighbors that has fuel (or an animal) and no flow may catch, as
// a chance per in-world hour with this rate (per hour):
//
//   FireSpread × fuel × dryness × wind × (1 / distance)
//
//   fuel      the neighbor's: a blade's Size (0..1), a corpse counts as full; an animal's is its
//             species' CatchFire, and dryness doesn't apply to it (1). A bunny in a warren hole
//             is safe, as a hole's corpse is. An ember (bare ground) has no fuel of its own, so
//             its spread uses the neighbor's, like any other fire's
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
// was boosting is released; an ember has none), the tile's flow is NONE, and the ground is scorched for
// FireScorchDays (the larger of that and any scorch it already had). A blade (by its Size) or a
// body (by its species) leaves ash on the tile, added to what was there (W.ash, the Ash rows);
// grass.js spends it once the scorch is over. An ember leaves none.
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

  // How long the fuel on tile t burns, in in-world hours.
  function burnHours(sim, t) {
    const W = sim.W;
    if (W.kind[t] === KIND.GRASS) return sim.T.grass.BurnHours * Math.max(MIN_BLADE_BURN, W.gSize[t]);
    return sim.T[AS.SPECIES_KEY[W.cSpecies[t]]].BurnHours;
  }

  // Sets animal s alight for its species' AlightHours.
  function setAlight(sim, s) {
    sim.W.aAlight[s] = sim.T[AS.SPECIES_KEY[sim.W.aSpecies[s]]].AlightHours;
  }

  AS.ignite = function (sim, t) {
    const W = sim.W, k = W.kind[t];
    if (W.flow[t] !== FLOW.NONE || W.hole[t]) return false;   // water, a fire already, or a hole (never burns)
    if (k >= KIND.BUNNY) {
      const s = W.aSlot[t];
      if (W.aAlight[s] > 0) return false;
      setAlight(sim, s);
      return true;
    }
    if (k === KIND.EMPTY) {
      if (W.scorch[t] > 0) return false;   // already burnt: nothing left to light
      W.addFire(t, sim.T.world.EmberHours);
      return true;
    }
    W.addFire(t, burnHours(sim, t));   // a blade or a corpse
    return true;
  };

  // The soil's dryness under tile t, 0..1: what scales a blade's catching from a neighbor's fire
  // (fireStep inlines the same formula in its hot loop) and a lightning strike's (weather.js).
  AS.fireDryness = function (sim, t) {
    const soil = sim.W.water;
    const dry = soil ? 1 - soil.G[t] / soil.room : sim.T.world.FireDryness;
    return dry < 0 ? 0 : dry > 1 ? 1 : dry;
  };

  AS.fireStage = function (W, t) {
    if (W.flow[t] !== FLOW.FIRE) return 0;
    const p = W.fireAge[t] / W.fireTime[t];
    return p < 0 ? 0 : p > 1 ? 1 : p;
  };

  function burnOut(sim, t) {
    const W = sim.W;
    // The ash is read before the fuel goes: a blade leaves Ash by its Size, a body by its species.
    // It adds to any ash already there. An ember has no fuel, so it leaves none.
    let ash = 0, roots = false, age = 0;
    if (W.kind[t] === KIND.GRASS) {
      ash = sim.T.grass.Ash * W.gSize[t];
      age = W.gAge[t];   // the roots are this same plant, as old as it was
      // Only a blade has roots (a body or an ember rolls nothing), and a sure answer needs no die.
      const live = sim.T.world.RootSurvive;
      roots = live >= 1 || (live > 0 && sim.rng.chance(live));
    }
    else if (W.kind[t] === KIND.CORPSE) ash = sim.T[AS.SPECIES_KEY[W.cSpecies[t]]].Ash;
    W.removeFire(t);
    if (W.kind[t] === KIND.GRASS) W.removeGrass(t);
    else if (W.kind[t] === KIND.CORPSE) AS.corpseRemove(sim, t);   // (an ember has no solid to remove)
    if (ash > 0) W.ash[t] += ash;
    if (roots) { W.roots[t] = 1; W.rootAge[t] = age; }
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
          const ku = kind[u];
          if (ku >= KIND.BUNNY) {
            // An animal catches by its species' CatchFire; soil dryness is a blade's business.
            const a = W.aSlot[u];
            if (W.aAlight[a] > 0) continue;
            const rate = spread * T[AS.SPECIES_KEY[W.aSpecies[a]]].CatchFire * dirRate[d];
            if (rate > 0 && rng.chance(1 - Math.exp(-rate * live))) setAlight(sim, a);
            continue;
          }
          const fuel = ku === KIND.GRASS ? gSize[u] : ku === KIND.CORPSE ? 1 : 0;
          if (fuel <= 0) continue;
          const dry = G ? 1 - G[u] / room : drySet;   // AS.fireDryness, inlined
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
