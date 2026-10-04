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
      m.feedTile = grow(m.feedTile, Int32Array);    // FEED's carcass tile
      m.feedSerial = grow(m.feedSerial, Uint32Array); // that corpse's serial, since a tile is reused
      m.bunnyAt = grow(m.bunnyAt, Float64Array);    // sim.simSeconds this wolf last saw any bunny
      m.bunnyFor = grow(m.bunnyFor, Uint32Array);   // the serial bunnyAt belongs to (slots are reused)
      m.cap = W.aCap;
    }
    return m;
  }

  // State indices come from the CSV order, so find them by name once per table set.
  let idxT = null, HUNT = -1, GIVE_UP = -1, REST = -1, FEED = -1;
  function indices(T) {
    if (idxT !== T) {
      idxT = T;
      const find = n => T.states.wolf.findIndex(st => st.name === n);
      HUNT = find('HUNT'); FEED = find('FEED'); GIVE_UP = find('GIVE_UP'); REST = find('REST');
    }
  }

  // ---- shared pieces ----------------------------------------------------------------------

  // Float32 meat after subtractions can leave dust; below this it counts as eaten.
  const MEAT_EPS = 1e-4;

  const nb = new Int32Array(4), open = new Int32Array(4), grassDirs = new Int32Array(4);

  // Matchers, goals and costs are created once and read these instead of closing over a call.
  let mSim = null, mW = null, mSelf = 0, mGoal = 0, mFrom = 0, mInvSpeed = 0;
  const isGoalTile = t => t === mGoal;
  // A bunny on a warren hole is safe, so it isn't prey.
  const isBunny = t => mW.kind[t] === K.BUNNY && !mW.hole[t];
  const hasMeat = t => mW.kind[t] === K.CORPSE && mW.cMeat[t] > 0;
  const isPartner = t => {
    if (mW.kind[t] !== K.WOLF) return false;
    const p = mW.aSlot[t];
    return mW.aSex[p] !== mW.aSex[mSelf] && AS.canMate(mSim, p);
  };
  // Grass costs its bites on top of the step; anything else that occupies a tile can't be entered.
  const cost = t => {
    const k = mW.kind[t];
    if (k === K.EMPTY) return mW.hole[t] ? Infinity : mInvSpeed;   // a hole is a wall to wolves
    if (k === K.GRASS) return mInvSpeed + AS.chewSeconds(mSim, mSelf, t);
    return Infinity;
  };
  // A tile the wolf can bite its goal from: touching the goal tile, and either where it
  // stands or one it can occupy once any blade on it is chewed away.
  const touchesGoal = t => {
    if (t !== mFrom && ((mW.kind[t] !== K.EMPTY && mW.kind[t] !== K.GRASS) || mW.hole[t])) return false;
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
  // A ready wolf hears and scents a ready mate well beyond sight (MateRange; blank = sight
  // only), as real wolves find each other by howling and scent, so wolves thinned out to a
  // scattered few can still pair up. The nearest visible partner wins if there is one.
  function nearestPartner(sim, s) {
    const W = sim.W, S = AS.speciesStats(sim, s);
    const near = AS.nearestVisible(sim, W.aTile[s], S.VisionRange, isPartner);
    if (near >= 0 || !(S.MateRange > S.VisionRange)) return near;
    const t0 = W.aTile[s], x0 = t0 % W.w, y0 = (t0 / W.w) | 0, r2 = S.MateRange * S.MateRange;
    let best = -1, bestD = Infinity;
    for (let a = 0, hi = W.aHigh; a < hi; a++) {
      if (!W.aAlive[a] || a === s || W.aSpecies[a] !== W.aSpecies[s]) continue;
      const t = W.aTile[a], dx = t % W.w - x0, dy = ((t / W.w) | 0) - y0, d = dx * dx + dy * dy;
      if (d <= r2 && d < bestD && isPartner(t)) { best = t; bestD = d; }
    }
    return best;
  }

  // One step toward a goal beyond the pathfinder's reach (it searches only VisionRange):
  // to the open or chewable 4-neighbor that most shortens the straight-line distance.
  const farNb = new Int32Array(4);
  function headToward(sim, s, goal) {
    const W = sim.W, t = W.aTile[s], gx = goal % W.w, gy = (goal / W.w) | 0;
    const d2 = u => (u % W.w - gx) ** 2 + (((u / W.w) | 0) - gy) ** 2;
    let best = -1, bestD = d2(t);
    for (let i = 0, k = W.neighbors4(t, farNb); i < k; i++) {
      const u = farNb[i];
      if ((W.kind[u] !== K.EMPTY && W.kind[u] !== K.GRASS) || (W.hole && W.hole[u])) continue;
      const d = d2(u);
      if (d < bestD) { best = u; bestD = d; }
    }
    if (best < 0) return false;
    AS.chewOrStep(sim, s, best);
    return true;
  }

  function walkToward(sim, s, goalTile, exact) {
    const W = sim.W;
    mSim = sim; mW = W; mSelf = s; mGoal = goalTile; mFrom = W.aTile[s];
    mInvSpeed = 1 / AS.speedOf(sim, s);
    const next = AS.pathNextWeighted(sim, mFrom, exact ? isGoalTile : touchesGoal, AS.speciesStats(sim, s).VisionRange, cost);
    if (next < 0) return false;
    if (next !== mFrom) AS.chewOrStep(sim, s, next);
    return true;
  }

  // ---- wandering toward room ---------------------------------------------------------------

  // A new run's direction, chosen from dirs[0..n) (open directions) with a lean away from
  // crowds of the animal's own kind: each direction is weighted exp(-RoomPreference * c /
  // (L / 2)), where c counts same-kind animals in the box L tiles long (L = VisionRange,
  // rounded) and L + 1 wide, starting next to the animal and reaching out along that
  // direction, and L / 2 is "a crowd" for any vision range. Runs only when a run starts, and
  // reads the grid's occupancy (W.kind) rather than any list. RoomPreference 0 keeps the
  // plain uniform draw, so a table with 0 replays exactly as before.
  const roomW = new Float64Array(4);
  function pickRoomDir(sim, s, kind, dirs, n) {
    const rp = AS.speciesStats(sim, s).RoomPreference;
    if (!(rp > 0) || n === 1) return n === 1 ? dirs[0] : dirs[sim.rng.int(n)];
    const W = sim.W, w = W.w, h = W.h, t = W.aTile[s], tx = t % w, ty = (t / w) | 0;
    const L = Math.max(1, Math.round(AS.speciesStats(sim, s).VisionRange)), half = L >> 1;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const d = dirs[i], dx = DX[d], dy = DY[d];
      let x0 = dx ? Math.min(tx + dx, tx + dx * L) : tx - half, x1 = dx ? Math.max(tx + dx, tx + dx * L) : tx + half;
      let y0 = dy ? Math.min(ty + dy, ty + dy * L) : ty - half, y1 = dy ? Math.max(ty + dy, ty + dy * L) : ty + half;
      if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 >= w) x1 = w - 1; if (y1 >= h) y1 = h - 1;
      let c = 0;
      for (let y = y0; y <= y1; y++) {
        const row = y * w;
        for (let x = x0; x <= x1; x++) if (W.kind[row + x] === kind) c++;
      }
      sum += roomW[i] = Math.exp(-rp * c / (L / 2));
    }
    let r = sim.rng.next() * sum;
    for (let i = 0; i < n - 1; i++) { r -= roomW[i]; if (r < 0) return dirs[i]; }
    return dirs[n - 1];
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
      if (W.kind[nt] === K.EMPTY && !W.hole[nt]) open[nOpen++] = d;
      else if (W.kind[nt] === K.GRASS) grassDirs[nGrass++] = d;
    }
    if (W.aRunLeft[s] > 0) {
      const ahead = dirTile(W, t, W.aRunDir[s]);
      if (ahead >= 0 && W.kind[ahead] === K.EMPTY && !W.hole[ahead]) {
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
    // A wolf that hasn't seen a bunny for RoamAfter days roams (Paul): it keeps going the
    // way it was heading, in runs of RoamRun tiles, until it finds prey or meets a wall,
    // instead of circling the land it has hunted out.
    const S = AS.speciesStats(sim, s), m = mem(W), now = sim.simSeconds;
    if (m.bunnyFor[s] !== W.aSerial[s]) { m.bunnyFor[s] = W.aSerial[s]; m.bunnyAt[s] = now; }
    mW = W;
    if (AS.nearestVisible(sim, t, S.VisionRange, isBunny) >= 0) m.bunnyAt[s] = now;
    const roaming = S.RoamAfter > 0 && now - m.bunnyAt[s] > S.RoamAfter * AS.DAY_SECONDS;
    let d;
    if (roaming && nOpen > 0 && open.subarray(0, nOpen).includes(W.aRunDir[s])) d = W.aRunDir[s];
    else if (nOpen > 0) d = pickRoomDir(sim, s, K.WOLF, open, nOpen);
    else if (nGrass > 0) d = grassDirs[sim.rng.int(nGrass)];
    else return;
    W.aRunDir[s] = d;
    W.aRunLeft[s] = sim.rng.inRange(roaming ? S.RoamRun : S.WanderRun);
    if (AS.chewOrStep(sim, s, dirTile(W, t, d))) W.aRunLeft[s]--;
  }

  function calmStart(sim, s) {
    AS.setSprint(sim, s, false);
    sim.W.aRunLeft[s] = 0;
  }

  // ---- the states --------------------------------------------------------------------------

  AS.registerStates('wolf', {
    // "Walk to the carcass; eat BiteFood from it every BiteCooldown until full or the meat is
    // gone." A feeding wolf gorges past HungryAt: stopping there would leave the rest of a
    // body to rot while the wolf walked off to hunt, and Fullness would sit wasted at the cap.
    FEED: {
      enter(sim, s) {
        const W = sim.W, S = AS.speciesStats(sim, s);
        indices(sim.T);
        const feeding = W.aState[s] === FEED;
        if (feeding ? !(W.aFullness[s] < S.FullnessMax) : !AS.isHungry(sim, s)) return false;
        const m = mem(W);
        // Keep the carcass it was at while there is meat on it (it may be right under the
        // wolf's nose and out of line of sight behind grass the wolf chewed to get there).
        const ft = m.feedTile[s];
        if (feeding && ft >= 0 && W.kind[ft] === K.CORPSE && W.serial[ft] === m.feedSerial[s] && W.cMeat[ft] > 0) return true;
        mW = W;
        const t = AS.nearestVisible(sim, W.aTile[s], S.VisionRange, hasMeat);
        if (t < 0) return false;
        m.feedTile[s] = t;
        m.feedSerial[s] = W.serial[t];
        return true;
      },
      start: calmStart,
      act(sim, s) {
        const W = sim.W, m = mem(W), S = AS.speciesStats(sim, s), ft = m.feedTile[s];
        AS.setSprint(sim, s, false);
        if (!(W.kind[ft] === K.CORPSE && W.serial[ft] === m.feedSerial[s] && W.cMeat[ft] > 0)) {
          // Eaten up or rotted away: wait for the next decision.
          W.aTargetTile[s] = -1;
          m.feedTile[s] = -1;
          return;
        }
        W.aTargetTile[s] = ft;
        W.aTargetSlot[s] = -1;
        if (adjacent(W, W.aTile[s], ft)) {
          if (W.aBiteLeft[s] > 0) return;
          const bite = Math.min(S.BiteFood, W.cMeat[ft], S.FullnessMax - W.aFullness[s]);
          if (!(bite > 0)) return;
          W.cMeat[ft] -= bite;
          if (W.cMeat[ft] < MEAT_EPS) W.cMeat[ft] = 0;
          W.aFullness[s] += bite;
          // Raising the bite timer is what the renderer reads as a mouthful (render.js).
          W.aBiteLeft[s] = S.BiteCooldown;
          return;
        }
        if (W.aStepLeft[s] > 0) return;
        if (!walkToward(sim, s, ft)) { W.aTargetTile[s] = -1; m.feedTile[s] = -1; }
      },
    },

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
          m.bunnyAt[s] = sim.simSeconds; m.bunnyFor[s] = W.aSerial[s];
          return true;
        }
        // Nothing in view: a wolf already hunting keeps looking for TrackSeconds, until it
        // reaches the spot or its bunny is gone.
        if (cur !== HUNT || !(S.TrackSeconds > 0)) return false;
        const p = m.prey[s];
        if (!W.aAlive[p] || W.aSerial[p] !== m.preySerial[s]) return false;
        if (W.hole[W.aTile[p]]) return false;   // it ducked into a hole: the hunt is over
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
        if (W.hole[pt]) {
          // Into a hole: out of reach. Wait for the next decision to end the hunt.
          W.aTargetTile[s] = -1; W.aTargetSlot[s] = -1;
          AS.setSprint(sim, s, false);
          return;
        }
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
        const t = nearestPartner(sim, s);
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
        const S = AS.speciesStats(sim, s), t = W.aTile[s];
        const dx = pt % W.w - t % W.w, dy = ((pt / W.w) | 0) - ((t / W.w) | 0);
        const far = dx * dx + dy * dy > S.VisionRange * S.VisionRange;
        if (far ? !headToward(sim, s, pt) : !walkToward(sim, s, pt)) {
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
