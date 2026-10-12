// Thirst's DRINK state, shared by every species that drinks: walk to water it knows of and
// drink until the meter is full. The meter itself drains in animals.js's body tick; the way
// to water is world.js's water field.
(function (AS) {
  'use strict';

  const KIND = AS.KIND;

  const drinkIdxOf = new WeakMap();
  function drinkIdx(sim, s) {
    let byKey = drinkIdxOf.get(sim.T);
    if (!byKey) { byKey = {}; drinkIdxOf.set(sim.T, byKey); }
    const key = AS.SPECIES_KEY[sim.W.aSpecies[s]];
    if (byKey[key] === undefined) byKey[key] = sim.T.states[key].findIndex(st => st.name === 'DRINK');
    return byKey[key];
  }

  // The water an animal at t drinks: its own tile when it is wading, else the first wet
  // tile touching it (neighbors4 order), or -1.
  const dnb = new Int32Array(4);
  function waterAt(W, t) {
    if (W.wDepth[t] > 0) return t;
    const k = W.neighbors4(t, dnb);
    for (let i = 0; i < k; i++) if (W.wDepth[dnb[i]] > 0) return dnb[i];
    return -1;
  }

  // What the local path search reads; set before each call, as in wolf.js.
  let dSim = null, dW = null, dSelf = 0, dInvSpeed = 0, dHoles = false, dWade = 0;
  // A tile an animal can walk to, grass counting as the bites it costs to chew through.
  const drinkCost = t => {
    const k = dW.kind[t];
    if (k === KIND.EMPTY) {
      if (dW.flow[t] === AS.FLOW.FIRE) return Infinity;   // a painted ember
      if (dW.flow[t] !== AS.FLOW.NONE) return dW.wDepth[t] <= dWade ? dInvSpeed : Infinity;
      return dW.hole[t] && !dHoles ? Infinity : dInvSpeed;
    }
    if (k === KIND.GRASS) return dInvSpeed + AS.chewSeconds(dSim, dSelf, t);
    return Infinity;
  };
  // A shore tile an animal could drink from (a blade on it is chewed away on arrival).
  const isShoreGoal = t => dW.wDist[t] === 0 && (dW.isBare(t) ? !dW.hole[t] || dHoles : dW.kind[t] === KIND.GRASS);

  // One move toward neighbor u: a step onto empty ground, or a bite at a blade in the way. A
  // grazer (hunts nothing) eats what it bites, as it would anyway; a hunter just chews through.
  function drinkMove(sim, s, u) {
    const W = sim.W;
    if (W.kind[u] === KIND.EMPTY) return AS.stepTo(sim, s, u);
    if (W.kind[u] !== KIND.GRASS || W.aBiteLeft[s] > 0) return false;
    if (AS.relations(sim.T).prey[W.aSpecies[s]] === 0) { AS.grazeBite(sim, s, u); return false; }
    return AS.chewOrStep(sim, s, u);
  }

  // Drinking takes real water (Paul, 11 Oct 2026): WaterLiters fill a whole meter, so a sip
  // lowers the tile it comes from by that many liters spread over the tile (tiny against a
  // lake, but a puddle can be drunk dry). Water laid by hand with no water rules (the checks)
  // isn't touched.
  const LITERS_PER_M3 = 1000;
  function drinkFrom(sim, s, t, gained) {
    const wat = sim.W.water, L = AS.speciesStats(sim, s).WaterLiters;
    if (!wat || !(L > 0)) return;
    const m = gained / AS.speciesStats(sim, s).WaterMax * L / LITERS_PER_M3 / (AS.TILE_M * AS.TILE_M);
    const h = wat.H[t] - m;
    wat.H[t] = h > AS.WATER_TINY ? h : 0;
  }

  // "Walk to a land tile touching water and drink until the meter is full." Enters only when
  // the animal knows water (the water field's distance within WaterSense), so one far from any
  // goes on with its life. It stays in once started until the meter is full.
  AS.drinkState = {
    enter(sim, s) {
      const W = sim.W;
      if (W.waterCount === 0) return false;
      W.ensureWaterField();
      const S = AS.speciesStats(sim, s);
      // Full means within one tick's burn of WaterMax: the body drains the meter before each
      // decision, so an animal that has just topped up is never quite at WaterMax when asked.
      // Judging it by WaterMax itself kept a full drinker in DRINK for good, on the shore tile.
      const full = S.WaterMax - S.ThirstRate * Math.max(1, S.SprintHunger) * AS.DT;
      if (W.aState[s] === drinkIdx(sim, s) && W.aWater[s] < full) return true;
      const t = W.aTile[s];
      return W.aWater[s] < S.ThirstyAt * S.WaterMax && (W.wDepth[t] > 0 || W.wDist[t] <= S.WaterSense);
    },
    start(sim, s) {
      AS.setSprint(sim, s, false);
      sim.W.aRunLeft[s] = 0;
    },
    act(sim, s) {
      const W = sim.W, S = AS.speciesStats(sim, s), t = W.aTile[s];
      AS.setSprint(sim, s, false);
      const water = waterAt(W, t);
      if (water >= 0) {
        W.aTargetTile[s] = water;
        W.aTargetSlot[s] = -1;
        if (W.aStepLeft[s] > 0) return;
        const before = W.aWater[s], wat = before + S.DrinkRate * AS.DT;
        W.aWater[s] = wat < S.WaterMax ? wat : S.WaterMax;
        drinkFrom(sim, s, water, W.aWater[s] - before);
        // A sip every BiteCooldown shows the head-down pose, as a bite of food does.
        if (W.aBiteLeft[s] <= 0) W.aBiteLeft[s] = S.BiteCooldown;
        if (W.aWater[s] >= S.WaterMax) W.aDecideLeft[s] = 0;   // full: the next tick picks what's next
        return;
      }
      W.aTargetTile[s] = W.wShore[t];
      W.aTargetSlot[s] = -1;
      if (W.aStepLeft[s] > 0) return;
      // Near water, one rule all the way in: the cheapest walk to any free shore tile, grass
      // counted as the bites to chew it. Mixing that with the field's own route sent animals
      // back and forth between two plans, so a thirsty one never arrived. Beyond the local
      // search's reach, the field is the way: its next tile if free, else any neighbor nearer.
      const hole = AS.canEnterHole(W.aSpecies[s]);
      if (W.wDist[t] <= S.VisionRange) {
        dSim = sim; dW = W; dSelf = s; dHoles = hole; dWade = AS.wadeOf(sim, s);
        dInvSpeed = 1 / AS.speedOf(sim, s);
        const step = AS.pathNextWeighted(sim, t, isShoreGoal, S.VisionRange, drinkCost);
        if (step >= 0 && step !== t) { drinkMove(sim, s, step); return; }
      }
      const nxt = W.wNext[t];
      const wade = AS.wadeOf(sim, s);
      if (nxt >= 0 && AS.canStand(W, nxt, wade) && (hole || !W.hole[nxt])) { AS.stepTo(sim, s, nxt); return; }
      const k = W.neighbors4(t, dnb);
      let best = -1, bestD = W.wDist[t];
      for (let i = 0; i < k; i++) {
        const u = dnb[i], d = W.wDist[u];
        if (d < bestD && (W.isBare(u) ? hole || !W.hole[u] : W.kind[u] === KIND.GRASS)) { best = u; bestD = d; }
      }
      if (best >= 0) drinkMove(sim, s, best);
    },
  };
})(globalThis.AS);
