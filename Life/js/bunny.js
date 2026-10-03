// The bunny's states (states.csv, Species = Bunny). animals.js owns the body and the decide
// loop: enter() is asked in Priority order a few times a second, act() runs every tick.
// Only act() moves, and only through AS.stepTo, which enforces speed and one thing per tile.
(function (AS) {
  'use strict';

  const K = AS.KIND, EV = AS.EV;

  // How far ahead, in tiles, the flee intent line points from the bunny.
  const FLEE_LOOKAHEAD = 4;
  // A blade a bunny couldn't path to is left out of its choices for this long (sim
  // seconds), so it tries a different blade instead of re-picking the same one every
  // decision. BAD_N such blades are remembered per bunny.
  const BAD_SECONDS = 10;
  const BAD_N = 4;

  // Direction d = 0 up, 1 right, 2 down, 3 left. aRunDir holds one, because W.neighbors4
  // drops off-world neighbors and so can't give a direction a stable number.
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

  // ---- per-bunny memory the world's fields don't have ----------------------------------

  // Each decision writes what it chose here and act() reads it: the decide loop clears the
  // target fields when the state changes, which would otherwise erase a choice made by
  // enter() in the same breath. Keyed by world, indexed by animal slot.
  const memOf = new WeakMap();
  function mem(W) {
    let m = memOf.get(W);
    if (!m) { m = { cap: 0 }; memOf.set(W, m); }
    if (m.cap < W.aCap) {
      const grow = (old, Ctor, n) => { const a = new Ctor(W.aCap * n); if (old) a.set(old); return a; };
      m.food = grow(m.food, Int32Array, 1);        // SEEK_FOOD's blade; -1 none
      m.mate = grow(m.mate, Int32Array, 1);        // MATE's partner slot
      m.mateSerial = grow(m.mateSerial, Uint32Array, 1);
      m.wolf = grow(m.wolf, Int32Array, 1);        // the wolf's tile at the last decision
      m.badTile = grow(m.badTile, Int32Array, BAD_N);
      m.badUntil = grow(m.badUntil, Int32Array, BAD_N);   // sim tick the entry expires at
      m.badOwner = grow(m.badOwner, Uint32Array, BAD_N);  // serial, so a reused slot starts clean
      m.badNext = grow(m.badNext, Uint8Array, 1);
      m.cap = W.aCap;
    }
    return m;
  }

  // The state indices come from the CSV order, so find REST by name once per table set.
  let idxT = null, restIdx = -1;
  function restIndex(T) {
    if (idxT !== T) { idxT = T; restIdx = T.states.bunny.findIndex(st => st.name === 'REST'); }
    return restIdx;
  }

  // ---- shared pieces ---------------------------------------------------------------------

  const nb = new Int32Array(4);
  const open = new Int32Array(4);

  // Matchers and goals are created once; they read these instead of closing over a call.
  let mW = null, mMem = null, mSim = null, mSelf = 0, mGoalTile = 0;
  const isWolf = t => mW.kind[t] === K.WOLF;
  const isFreshBlade = t => {
    if (mW.kind[t] !== K.GRASS) return false;
    const base = mSelf * BAD_N, now = mSim.tickCount, owner = mW.aSerial[mSelf];
    for (let i = 0; i < BAD_N; i++) {
      if (mMem.badTile[base + i] === t && mMem.badOwner[base + i] === owner && mMem.badUntil[base + i] > now) return false;
    }
    return true;
  };
  // A bunny of the other sex that meets the MATE conditions.
  const isPartner = t => {
    if (mW.kind[t] !== K.BUNNY) return false;
    const p = mW.aSlot[t];
    return mW.aSex[p] !== mW.aSex[mSelf] && AS.canMate(mSim, p);
  };
  // An empty tile touching the goal tile, a blade or a partner (pathNext only tests tiles a walker can stand on).
  const touchesGoal = t => {
    const w = mW.w, dx = (t % w) - (mGoalTile % w), dy = ((t / w) | 0) - ((mGoalTile / w) | 0);
    return dx * dx + dy * dy === 1;
  };

  // The tile one step from t in direction d, or -1 off the world.
  function dirTile(W, t, d) {
    const x = (t % W.w) + DX[d], y = ((t / W.w) | 0) + DY[d];
    return W.inside(x, y) ? y * W.w + x : -1;
  }

  // The adjacent blade with the most Size (ties go to neighbor order), or -1.
  function bestAdjacentBlade(W, t) {
    const k = W.neighbors4(t, nb);
    let best = -1, bestSize = -1;
    for (let i = 0; i < k; i++) {
      const n = nb[i];
      if (W.kind[n] === K.GRASS && W.gSize[n] > bestSize) { best = n; bestSize = W.gSize[n]; }
    }
    return best;
  }

  // One step of a wander run: keep going while the way ahead is open, otherwise pick a new
  // open direction and run length right away. Shared by WANDER and by SEEK_FOOD when it has
  // no usable target, so a bunny never stands where it could be walking.
  function wanderStep(sim, s) {
    const W = sim.W;
    if (W.aStepLeft[s] > 0) return;
    const t = W.aTile[s];
    if (W.aRunLeft[s] > 0) {
      const ahead = dirTile(W, t, W.aRunDir[s]);
      if (ahead >= 0 && W.kind[ahead] === K.EMPTY) {
        if (AS.stepTo(sim, s, ahead)) W.aRunLeft[s]--;
        return;
      }
      W.aRunLeft[s] = 0;
    }
    let n = 0;
    for (let d = 0; d < 4; d++) {
      const nt = dirTile(W, t, d);
      if (nt >= 0 && W.kind[nt] === K.EMPTY) open[n++] = d;
    }
    if (n === 0) return;
    const d = open[sim.rng.int(n)];
    W.aRunDir[s] = d;
    W.aRunLeft[s] = sim.rng.inRange(AS.speciesStats(sim, s).WanderRun);
    if (AS.stepTo(sim, s, dirTile(W, t, d))) W.aRunLeft[s]--;
  }

  // Every state but FLEE starts with sprint off and a fresh run.
  function calmStart(sim, s) {
    AS.setSprint(sim, s, false);
    sim.W.aRunLeft[s] = 0;
  }

  // ---- the states -------------------------------------------------------------------------

  AS.registerStates('bunny', {
    // "Sprint away from the nearest wolf; walk when out of Stamina."
    FLEE: {
      enter(sim, s) {
        const W = sim.W;
        mW = W;
        const wolf = AS.nearestVisible(sim, W.aTile[s], AS.speciesStats(sim, s).VisionRange, isWolf);
        if (wolf < 0) return false;
        mem(W).wolf[s] = wolf;
        return true;
      },
      start(sim, s) { sim.W.aRunLeft[s] = 0; },
      act(sim, s) {
        const W = sim.W, w = W.w, t = W.aTile[s], wolf = mem(W).wolf[s];
        const tx = t % w, ty = (t / w) | 0, wx = wolf % w, wy = (wolf / w) | 0;
        AS.setSprint(sim, s, true);   // refuses at 0 Stamina, so it walks then

        // The intent line points a few tiles straight away from the wolf, kept inside the world.
        let ax = tx - wx, ay = ty - wy;
        const len = Math.sqrt(ax * ax + ay * ay) || 1;
        let ex = Math.round(tx + ax / len * FLEE_LOOKAHEAD), ey = Math.round(ty + ay / len * FLEE_LOOKAHEAD);
        ex = ex < 0 ? 0 : ex >= w ? w - 1 : ex;
        ey = ey < 0 ? 0 : ey >= W.h ? W.h - 1 : ey;
        W.aTargetTile[s] = ey * w + ex;
        W.aTargetSlot[s] = -1;

        if (W.aStepLeft[s] > 0) return;
        // The open neighbor that gets farthest from the wolf; stand if none gets farther
        // than where it is (cornered).
        const k = W.neighbors4(t, nb);
        let best = -1, bestD = (tx - wx) * (tx - wx) + (ty - wy) * (ty - wy);
        for (let i = 0; i < k; i++) {
          const n = nb[i];
          if (W.kind[n] !== K.EMPTY) continue;
          const dx = (n % w) - wx, dy = ((n / w) | 0) - wy, d2 = dx * dx + dy * dy;
          if (d2 > bestD) { bestD = d2; best = n; }
        }
        if (best >= 0) AS.stepTo(sim, s, best);
      },
    },

    // "Bite the blade every BiteCooldown." Stands still while it eats.
    EAT: {
      enter(sim, s) {
        return AS.isHungry(sim, s) && bestAdjacentBlade(sim.W, sim.W.aTile[s]) >= 0;
      },
      start: calmStart,
      act(sim, s) {
        const W = sim.W, S = AS.speciesStats(sim, s);
        const blade = bestAdjacentBlade(W, W.aTile[s]);
        W.aTargetTile[s] = blade;   // -1 once nothing is left; it waits for the next decision
        W.aTargetSlot[s] = -1;
        if (blade < 0 || W.aBiteLeft[s] > 0) return;
        const removed = AS.grassBite(sim, blade, S.BiteSize);
        // A bite of a blade smaller than BiteSize feeds in proportion to what it removed.
        const full = W.aFullness[s] + S.BiteFood * removed / S.BiteSize;
        W.aFullness[s] = full < S.FullnessMax ? full : S.FullnessMax;
        W.aBiteLeft[s] = S.BiteCooldown;
        sim.emit(EV.GRAZE, blade);
      },
    },

    // "Walk toward the nearest visible blade." Walking only.
    SEEK_FOOD: {
      enter(sim, s) {
        const W = sim.W, S = AS.speciesStats(sim, s);
        if (!AS.isHungry(sim, s) || bestAdjacentBlade(W, W.aTile[s]) >= 0) return false;
        mW = W; mSim = sim; mSelf = s; mMem = mem(W);
        const blade = AS.nearestVisible(sim, W.aTile[s], S.VisionRange, isFreshBlade);
        if (blade < 0) return false;
        mMem.food[s] = blade;
        return true;
      },
      start: calmStart,
      act(sim, s) {
        const W = sim.W, m = mem(W), S = AS.speciesStats(sim, s);
        let blade = m.food[s];
        // The blade may have been eaten (or died of old age) since the decision.
        if (blade >= 0 && W.kind[blade] !== K.GRASS) blade = m.food[s] = -1;
        W.aTargetTile[s] = blade;
        W.aTargetSlot[s] = -1;
        if (blade < 0) { wanderStep(sim, s); return; }
        if (W.aStepLeft[s] > 0) return;

        mW = W; mGoalTile = blade;
        const step = AS.pathNext(sim, W.aTile[s], touchesGoal, S.VisionRange);
        // Next to it: decide on the next tick, so EAT takes over without a visible pause.
        if (step === W.aTile[s]) { W.aDecideLeft[s] = 0; return; }
        if (step < 0) {
          // Unreachable: remember it so the next decision picks a different blade, and walk
          // like WANDER in the meantime.
          const base = s * BAD_N, i = m.badNext[s];
          m.badTile[base + i] = blade;
          m.badOwner[base + i] = W.aSerial[s];
          m.badUntil[base + i] = sim.tickCount + Math.ceil(BAD_SECONDS * AS.TICK_HZ);
          m.badNext[s] = (i + 1) % BAD_N;
          m.food[s] = -1;
          W.aTargetTile[s] = -1;
          wanderStep(sim, s);
          return;
        }
        AS.stepTo(sim, s, step);
      },
    },

    // "Walk to nearest eligible bunny of the other sex; adjacent → mate." The partner only
    // has to meet the MATE conditions, whatever it is doing. Walking only.
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
        // Gone, replaced by another animal in its slot, or no longer eligible (it may have
        // just mated with someone else): let the next decision choose, and walk meanwhile.
        if (!W.aAlive[p] || W.aSerial[p] !== m.mateSerial[s] || !AS.canMate(sim, p) || !AS.canMate(sim, s)) {
          W.aTargetTile[s] = -1; W.aTargetSlot[s] = -1;
          wanderStep(sim, s);
          return;
        }
        const pt = W.aTile[p];
        W.aTargetTile[s] = pt;
        W.aTargetSlot[s] = p;
        W.aTargetSerial[s] = W.aSerial[p];
        mW = W; mGoalTile = pt;
        if (touchesGoal(W.aTile[s])) {
          AS.mate(sim, s, p);   // the next decision moves both on
          return;
        }
        if (W.aStepLeft[s] > 0) return;
        const step = AS.pathNext(sim, W.aTile[s], touchesGoal, AS.speciesStats(sim, s).VisionRange);
        if (step < 0) {
          // Unreachable now: drop it and let the next decision choose.
          W.aTargetTile[s] = -1; W.aTargetSlot[s] = -1;
          m.mateSerial[s] = 0;
          wanderStep(sim, s);
          return;
        }
        AS.stepTo(sim, s, step);
      },
    },

    // Hysteresis: it rests below RestBelow and stays down until RestUntil.
    REST: {
      enter(sim, s) {
        const W = sim.W, S = AS.speciesStats(sim, s);
        const limit = (W.aState[s] === restIndex(sim.T) ? S.RestUntil : S.RestBelow) * S.StaminaMax;
        return W.aStamina[s] < limit;
      },
      start: calmStart,
      act(sim, s) { AS.setSprint(sim, s, false); },
    },

    // "Walk a run of WanderRun tiles in a random direction." Always enters.
    WANDER: {
      enter() { return true; },
      start: calmStart,
      act: wanderStep,
    },
  });
})(globalThis.AS);
