// Mating and birth, for any species (wolves reuse this): who may mate, what mating does,
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

  // The conditions in states.csv's MATE row. Only adults breed; a female also needs her
  // cooldown over and no pregnancy running or waiting to be born. Males have no cooldown.
  AS.canMate = function (sim, s) {
    const W = sim.W;
    if (!W.aAlive[s]) return false;
    const S = AS.speciesStats(sim, s);
    if (AS.stageOfSlot(sim, s) !== AS.STAGE.ADULT) return false;
    if (W.aFullness[s] < S.MateFullness * S.FullnessMax) return false;
    if (W.aSex[s] === AS.SEX.FEMALE && (W.aMateCd[s] > 0 || W.aPregnant[s] > 0 || W.aLitter[s] > 0)) return false;
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
    // A hole is a wall to wolves, so a wolf's litter is never born onto one.
    const wolf = W.aSpecies[s] === AS.SPECIES.WOLF;
    for (let i = 0; i < k; i++) if (W.kind[nb[i]] === K.EMPTY && !(wolf && W.hole[nb[i]])) free[room++] = nb[i];
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
