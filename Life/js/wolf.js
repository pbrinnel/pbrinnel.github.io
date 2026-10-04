// The wolf's states (states.csv, Species = Wolf). Same contract as bunny.js: enter() in
// Priority order a few times a second, act() every tick, movement only through animals.js's
// helpers. A wolf may walk through grass by chewing it (DESIGN.md "World"), so it moves with
// AS.chewOrStep and plans with AS.pathNextWeighted, which counts the bites against detours.
(function (AS) {
  'use strict';

  const K = AS.KIND;
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

  // ---- per-wolf memory the world's fields don't have --------------------------------------

  // Chosen at a decision, read by act(): the decide loop wipes the target fields on a state
  // change, which would erase a choice enter() made in the same breath.
  const memOf = new WeakMap();
  function mem(W) {
    let m = memOf.get(W);
    if (!m) { m = { cap: 0 }; memOf.set(W, m); }
    if (m.cap < W.aCap) {
      const grow = (old, Ctor) => { const a = new Ctor(W.aCap); if (old) a.set(old); return a; };
      m.prey = grow(m.prey, Int32Array);        // HUNT's bunny slot
      m.preySerial = grow(m.preySerial, Uint32Array);
      m.mate = grow(m.mate, Int32Array);        // MATE's partner slot
      m.mateSerial = grow(m.mateSerial, Uint32Array);
      m.seenTile = grow(m.seenTile, Int32Array);    // where HUNT's bunny was last in sight
      m.seenAt = grow(m.seenAt, Float64Array);      // sim.simSeconds of that sighting
      m.cap = W.aCap;
    }
    return m;
  }

  // State indices come from the CSV order, so find them by name once per table set.
  let idxT = null, HUNT = -1, GIVE_UP = -1, REST = -1;
  function indices(T) {
    if (idxT !== T) {
      idxT = T;
      const find = n => T.states.wolf.findIndex(st => st.name === n);
      HUNT = find('HUNT'); GIVE_UP = find('GIVE_UP'); REST = find('REST');
    }
  }

  // ---- shared pieces ----------------------------------------------------------------------

  const nb = new Int32Array(4), open = new Int32Array(4), grassDirs = new Int32Array(4);

  // Matchers, goals and costs are created once and read these instead of closing over a call.
  let mSim = null, mW = null, mSelf = 0, mGoal = 0, mFrom = 0, mInvSpeed = 0;
  const isGoalTile = t => t === mGoal;
  const isBunny = t => mW.kind[t] === K.BUNNY;
  const isPartner = t => {
    if (mW.kind[t] !== K.WOLF) return false;
    const p = mW.aSlot[t];
    return mW.aSex[p] !== mW.aSex[mSelf] && AS.canMate(mSim, p);
  };
  // Grass costs its bites on top of the step; anything else that occupies a tile can't be entered.
  const cost = t => {
    const k = mW.kind[t];
    if (k === K.EMPTY) return mInvSpeed;
    if (k === K.GRASS) return mInvSpeed + AS.chewSeconds(mSim, mSelf, t);
    return Infinity;
  };
  // A tile the wolf can bite its goal from: touching the goal tile, and either where it
  // stands or one it can occupy once any blade on it is chewed away.
  const touchesGoal = t => {
    if (t !== mFrom && mW.kind[t] !== K.EMPTY && mW.kind[t] !== K.GRASS) return false;
    const w = mW.w, dx = (t % w) - (mGoal % w), dy = ((t / w) | 0) - ((mGoal / w) | 0);
    return dx * dx + dy * dy === 1;
  };
  const adjacent = (W, a, b) => {
    const dx = (a % W.w) - (b % W.w), dy = ((a / W.w) | 0) - ((b / W.w) | 0);
    return dx * dx + dy * dy === 1;
  };

  function dirTile(W, t, d) {
    const x = (t % W.w) + DX[d], y = ((t / W.w) | 0) + DY[d];
    return W.inside(x, y) ? y * W.w + x : -1;
  }

  // One step toward `goalTile` along the cheapest path, chewing where that is quicker than
  // going around. Returns false when no path exists (the caller lets the next decision choose).
  // `exact` walks onto the tile itself instead of to a tile touching it (HUNT's search, where
  // nothing is there to bite).
  function walkToward(sim, s, goalTile, exact) {
    const W = sim.W;
    mSim = sim; mW = W; mSelf = s; mGoal = goalTile; mFrom = W.aTile[s];
    mInvSpeed = 1 / AS.speedOf(sim, s);
    const next = AS.pathNextWeighted(sim, mFrom, exact ? isGoalTile : touchesGoal, AS.speciesStats(sim, s).VisionRange, cost);
    if (next < 0) return false;
    if (next !== mFrom) AS.chewOrStep(sim, s, next);
    return true;
  }

  // PROWL's step: runs of WanderRun tiles. With no destination, a blocked run turns to an
  // open direction if there is one and chews only when walled in (DESIGN.md "World").
  function prowlStep(sim, s) {
    const W = sim.W;
    if (W.aStepLeft[s] > 0) return;
    const t = W.aTile[s];
    let nOpen = 0, nGrass = 0;
    for (let d = 0; d < 4; d++) {
      const nt = dirTile(W, t, d);
      if (nt < 0) continue;
      if (W.kind[nt] === K.EMPTY) open[nOpen++] = d;
      else if (W.kind[nt] === K.GRASS) grassDirs[nGrass++] = d;
    }
    if (W.aRunLeft[s] > 0) {
      const ahead = dirTile(W, t, W.aRunDir[s]);
      if (ahead >= 0 && W.kind[ahead] === K.EMPTY) {
        if (AS.stepTo(sim, s, ahead)) W.aRunLeft[s]--;
        return;
      }
      // Walled in: keep chewing the same blade rather than picking a new one each tick.
      if (ahead >= 0 && nOpen === 0 && W.kind[ahead] === K.GRASS) {
        if (AS.chewOrStep(sim, s, ahead)) W.aRunLeft[s]--;
        return;
      }
      W.aRunLeft[s] = 0;
    }
    let d;
    if (nOpen > 0) d = open[sim.rng.int(nOpen)];
    else if (nGrass > 0) d = grassDirs[sim.rng.int(nGrass)];
    else return;
    W.aRunDir[s] = d;
    W.aRunLeft[s] = sim.rng.inRange(AS.speciesStats(sim, s).WanderRun);
    if (AS.chewOrStep(sim, s, dirTile(W, t, d))) W.aRunLeft[s]--;
  }

  function calmStart(sim, s) {
    AS.setSprint(sim, s, false);
    sim.W.aRunLeft[s] = 0;
  }

  // ---- the states --------------------------------------------------------------------------

  AS.registerStates('wolf', {
    // "Walk toward it; sprint within SprintRange; bite when adjacent."
    HUNT: {
      enter(sim, s) {
        const W = sim.W;
        indices(sim.T);
        if (!AS.isHungry(sim, s)) return false;
        const S = AS.speciesStats(sim, s), cur = W.aState[s];
        // Out of breath mid-chase hands over to GIVE_UP; and once it has given up, the bunny
        // stays safe until the wolf has rested.
        if (cur === HUNT && W.aWinded[s]) return false;
        if (cur === GIVE_UP && W.aStamina[s] < S.RestUntil * S.StaminaMax) return false;
        mW = W;
        const t = AS.nearestVisible(sim, W.aTile[s], S.VisionRange, isBunny);
        const m = mem(W);
        if (t >= 0) {
          // Any bunny in view wins, so a second one appearing mid-search takes over.
          const p = W.aSlot[t];
          m.prey[s] = p;
          m.preySerial[s] = W.aSerial[p];
          m.seenTile[s] = t;
          m.seenAt[s] = sim.simSeconds;
          return true;
        }
        // Nothing in view: a wolf already hunting keeps looking for TrackSeconds, until it
        // reaches the spot or its bunny is gone.
        if (cur !== HUNT || !(S.TrackSeconds > 0)) return false;
        const p = m.prey[s];
        if (!W.aAlive[p] || W.aSerial[p] !== m.preySerial[s]) return false;
        if (W.aTile[s] === m.seenTile[s]) return false;
        return sim.simSeconds - m.seenAt[s] < S.TrackSeconds;
      },
      start: calmStart,
      act(sim, s) {
        const W = sim.W, m = mem(W), p = m.prey[s], S = AS.speciesStats(sim, s);
        if (!W.aAlive[p] || W.aSerial[p] !== m.preySerial[s]) {
          // Caught by someone else, or dead: wait for the next decision.
          W.aTargetTile[s] = -1; W.aTargetSlot[s] = -1;
          AS.setSprint(sim, s, false);
          return;
        }
        const pt = W.aTile[p], t = W.aTile[s];
        if (S.TrackSeconds > 0) {
          // Between decisions the wolf knows only what it sees, so out of sight it heads for
          // the last-seen tile instead of reading the bunny's real position.
          const dx = (pt % W.w) - (t % W.w), dy = ((pt / W.w) | 0) - ((t / W.w) | 0);
          if (dx * dx + dy * dy <= S.VisionRange * S.VisionRange && AS.lineOfSight(W, t, pt)) {
            m.seenTile[s] = pt;
            m.seenAt[s] = sim.simSeconds;
          } else {
            const goal = m.seenTile[s];
            W.aTargetTile[s] = goal;
            W.aTargetSlot[s] = -1;
            AS.setSprint(sim, s, false);
            if (W.aStepLeft[s] > 0 || t === goal) return;
            // No way there: let the next decision give up.
            if (!walkToward(sim, s, goal, true)) { W.aTargetTile[s] = -1; m.seenAt[s] = -Infinity; }
            return;
          }
        }
        W.aTargetTile[s] = pt;
        W.aTargetSlot[s] = p;
        W.aTargetSerial[s] = W.aSerial[p];
        if (adjacent(W, t, pt)) {
          AS.setSprint(sim, s, false);
          AS.biteAnimal(sim, s, p);
          return;
        }
        const dx = (pt % W.w) - (t % W.w), dy = ((pt / W.w) | 0) - ((t / W.w) | 0);
        AS.setSprint(sim, s, dx * dx + dy * dy <= S.SprintRange * S.SprintRange);
        if (W.aStepLeft[s] > 0) return;
        if (!walkToward(sim, s, pt)) { W.aTargetTile[s] = -1; W.aTargetSlot[s] = -1; m.preySerial[s] = 0; }
      },
    },

    // "Stop and rest until Stamina reaches RestUntil; the bunny gets away."
    GIVE_UP: {
      enter(sim, s) {
        const W = sim.W, S = AS.speciesStats(sim, s);
        indices(sim.T);
        const cur = W.aState[s];
        return (cur === HUNT && W.aWinded[s] === 1) || (cur === GIVE_UP && W.aStamina[s] < S.RestUntil * S.StaminaMax);
      },
      start: calmStart,
      act(sim, s) { AS.setSprint(sim, s, false); },
    },

    // As the bunny's, but through the weighted path: chewing allowed, walking only.
    MATE: {
      enter(sim, s) {
        if (!AS.canMate(sim, s)) return false;
        const W = sim.W;
        mSim = sim; mW = W; mSelf = s;
        const t = AS.nearestVisible(sim, W.aTile[s], AS.speciesStats(sim, s).VisionRange, isPartner);
        if (t < 0) return false;
        const m = mem(W), p = W.aSlot[t];
        m.mate[s] = p;
        m.mateSerial[s] = W.aSerial[p];
        return true;
      },
      start: calmStart,
      act(sim, s) {
        const W = sim.W, m = mem(W), p = m.mate[s];
        if (!W.aAlive[p] || W.aSerial[p] !== m.mateSerial[s] || !AS.canMate(sim, p) || !AS.canMate(sim, s)) {
          W.aTargetTile[s] = -1; W.aTargetSlot[s] = -1;
          prowlStep(sim, s);
          return;
        }
        const pt = W.aTile[p];
        W.aTargetTile[s] = pt;
        W.aTargetSlot[s] = p;
        W.aTargetSerial[s] = W.aSerial[p];
        if (adjacent(W, W.aTile[s], pt)) { AS.mate(sim, s, p); return; }
        if (W.aStepLeft[s] > 0) return;
        if (!walkToward(sim, s, pt)) {
          W.aTargetTile[s] = -1; W.aTargetSlot[s] = -1;
          m.mateSerial[s] = 0;
          prowlStep(sim, s);
        }
      },
    },

    REST: {
      enter(sim, s) {
        const W = sim.W, S = AS.speciesStats(sim, s);
        indices(sim.T);
        const limit = (W.aState[s] === REST ? S.RestUntil : S.RestBelow) * S.StaminaMax;
        return W.aStamina[s] < limit;
      },
      start: calmStart,
      act(sim, s) { AS.setSprint(sim, s, false); },
    },

    PROWL: {
      enter() { return true; },
      start: calmStart,
      act: prowlStep,
    },
  });
})(globalThis.AS);
