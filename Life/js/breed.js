// Mating and birth, for any species that breeds (wolves reuse this; humans never do): who may mate, what mating does,
// and a due mother's birth. The MATE state that walks bunnies together is in bunny.js; the
// call to tryBirth is in animals.js's tick.
(function (AS) {
  'use strict';

  const K = AS.KIND;

  // The father of a pregnancy in progress, by the mother's slot. Not in the world's fields:
  // aParentA/B are the mother's own parents. The serial tells a slot reused by someone else
  // from the father who died.
  const fatherOf = new WeakMap();
  function fathers(W) {
    let f = fatherOf.get(W);
    if (!f) f = { cap: 0 };
    if (f.cap < W.aCap) {
      const slot = new Int32Array(W.aCap), serial = new Uint32Array(W.aCap);
      if (f.slot) { slot.set(f.slot); serial.set(f.serial); }
      f.slot = slot; f.serial = serial; f.cap = W.aCap;
      fatherOf.set(W, f);
    }
    return f;
  }

  // Territory: a female breeds only while no more than PackLimit other adults of her species
  // stand within TerritoryRange tiles (Chebyshev, so a square scan of aSlot, stopping as soon as
  // she is over the limit). Keeps a thriving pack from outgrowing its range. Blank PackLimit
  // (bunnies) turns the rule off.
  function crowded(sim, s, S) {
    const W = sim.W, t = W.aTile[s], sp = W.aSpecies[s], r = Math.floor(S.TerritoryRange);
    const cx = W.tx(t), cy = W.ty(t);
    const x0 = Math.max(0, cx - r), x1 = Math.min(W.w - 1, cx + r);
    const y0 = Math.max(0, cy - r), y1 = Math.min(W.h - 1, cy + r);
    let n = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const o = W.aSlot[y * W.w + x];
        if (o < 0 || o === s || W.aSpecies[o] !== sp || !W.aAlive[o]) continue;
        if (AS.stageOfSlot(sim, o) !== AS.STAGE.ADULT) continue;
        if (++n > S.PackLimit) return true;
      }
    }
    return false;
  }

  // The conditions in states.csv's MATE row. Only adults breed; a female also needs her
  // cooldown over, no pregnancy running or waiting to be born, and room in her territory.
  // Males have no cooldown and no territory.
  AS.canMate = function (sim, s) {
    const W = sim.W;
    if (!W.aAlive[s]) return false;
    const S = AS.speciesStats(sim, s);
    if (S.LitterSize == null) return false;   // a species with no mating stats never breeds (humans)
    if (AS.stageOfSlot(sim, s) !== AS.STAGE.ADULT) return false;
    if (W.aFullness[s] < S.MateFullness * S.FullnessMax) return false;
    if (W.aSex[s] === AS.SEX.FEMALE && (W.aMateCd[s] > 0 || W.aPregnant[s] > 0 || W.aLitter[s] > 0)) return false;
    if (S.PackLimit != null && W.aSex[s] === AS.SEX.FEMALE && crowded(sim, s, S)) return false;
    return true;
  };

  const adjacent = (W, a, b) => {
    const dx = (a % W.w) - (b % W.w), dy = ((a / W.w) | 0) - ((b / W.w) | 0);
    return dx * dx + dy * dy === 1;
  };

  // Instant. Both pay MateCost; she starts her pregnancy and rolls the litter now, so a
  // birth that has to wait knows how much room it needs. Returns whether it happened.
  AS.mate = function (sim, a, b) {
    const W = sim.W;
    if (!W.aAlive[a] || !W.aAlive[b] || a === b) return false;
    if (W.aSpecies[a] !== W.aSpecies[b] || W.aSex[a] === W.aSex[b]) return false;
    if (!adjacent(W, W.aTile[a], W.aTile[b])) return false;
    if (!AS.canMate(sim, a) || !AS.canMate(sim, b)) return false;
    const S = AS.speciesStats(sim, a);
    const mother = W.aSex[a] === AS.SEX.FEMALE ? a : b, father = mother === a ? b : a;
    const cost = S.MateCost * S.FullnessMax;
    W.aFullness[a] = Math.max(0, W.aFullness[a] - cost);
    W.aFullness[b] = Math.max(0, W.aFullness[b] - cost);
    W.aPregnant[mother] = S.PregnancyDays;
    W.aLitter[mother] = sim.rng.inRange(S.LitterSize);
    const f = fathers(W);
    f.slot[mother] = father;
    f.serial[mother] = W.aSerial[father];
    return true;
  };

  const free = new Int32Array(4), nb = new Int32Array(4);

  // A due mother births the whole litter onto free 4-neighbor tiles, or waits for room.
  AS.tryBirth = function (sim, s) {
    const W = sim.W, rng = sim.rng, n = W.aLitter[s];
    const k = W.neighbors4(W.aTile[s], nb);
    let room = 0;
    // A hole is a wall to all but bunnies, so their litters are never born onto one.
    const holes = AS.canEnterHole(W.aSpecies[s]);
    for (let i = 0; i < k; i++) if (W.kind[nb[i]] === K.EMPTY && (holes || !W.hole[nb[i]])) free[room++] = nb[i];
    if (room < n) return;

    const species = W.aSpecies[s], S = AS.speciesStats(sim, s);
    const motherSerial = W.aSerial[s], f = fathers(W);
    const father = f.slot[s], fatherSerial = f.serial[s];
    // Which tiles when there are more than needed: a partial shuffle.
    for (let i = 0; i < n; i++) {
      const j = i + rng.int(room - i), t = free[j];
      free[j] = free[i]; free[i] = t;
      const b = W.addAnimal(t, species, rng.int(2));   // may grow the stores, so use W.* afresh
      W.aFullness[b] = S.FullnessMax;
      W.aHP[b] = S.HPMax;
      W.aStamina[b] = S.StaminaMax;
      W.aDecideLeft[b] = rng.next() / S.DecidePerSec;
      W.aState[b] = AS.NO_STATE;
      W.aParentA[b] = motherSerial;
      W.aParentB[b] = fatherSerial;
      sim.emit(AS.EV.BIRTH, t);
    }
    W.aChildren[s] += n;
    if (fatherSerial && W.aAlive[father] && W.aSerial[father] === fatherSerial) W.aChildren[father] += n;
    W.aLitter[s] = 0;
    fathers(W).serial[s] = 0;   // the stores may have grown above
    W.aMateCd[s] = S.MateCooldown;
  };
})(globalThis.AS);
