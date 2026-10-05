// The bunny's states (states.csv, Species = Bunny). animals.js owns the body and the decide
// loop: enter() is asked in Priority order a few times a second, act() runs every tick.
// Only act() moves, and only through AS.stepTo, which enforces speed and one thing per tile.
(function (AS) {
  'use strict';

  const K = AS.KIND, EV = AS.EV;

  // How far ahead, in tiles, the flee intent line points from the bunny.
  const FLEE_LOOKAHEAD = 4;
  // The escape directions FLEE weighs, as [cos, sin] of the turn from straight away from the
  // hunter: straight first (it wins ties), then 45 and 90 degrees to either side.
  const FLEE_TURNS = [[1, 0], [Math.SQRT1_2, Math.SQRT1_2], [Math.SQRT1_2, -Math.SQRT1_2], [0, 1], [0, -1]];
  // A tile of the escape path this near the edge of the world, or off it, counts as wall...
  const FLEE_WALL_MARGIN = 2;
  // ...and costs this many tiles of distance gained from the wolf, so a bunny turns along
  // a wall once running on would put several path tiles against it.
  const FLEE_WALL_COST = 1.5;
  // A blade a bunny couldn't path to is left out of its choices for this long (sim
  // seconds), so it tries a different blade instead of re-picking the same one every
  // decision. BAD_N such blades are remembered per bunny.
  const BAD_SECONDS = 10;
  const BAD_N = 4;
  // A companion stops and waits within this many tiles of the bunny it is emigrating with.
  const FOLLOW_NEAR = 2;
  // An emigrant's destination: tries for one near water, and how near is near (walking tiles).
  const GOAL_TRIES = 12, GOAL_WATER = 12;
  // Scares closer together than this (sim seconds) are one chase, and count once.
  const SCARE_GAP = 3;
  // How often, in sim seconds, an emigrant looks around to see whether to settle.
  const SETTLE_EVERY = 1;
  // An emigrant paths, within sight, to a tile this many tiles nearer its destination.
  const AWAY_GAIN = 4;
  // A dig timer within this of 0 is done (1/30 s has no exact binary value).
  const DIG_EPS = 1e-9;

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
      m.hole = grow(m.hole, Int32Array, 1);        // FLEE's hole; -1 none (set at every decision)
      m.digTile = grow(m.digTile, Int32Array, 1);  // DIG's tile; -1 none (a state that isn't DIG never reads it)
      m.digLeft = grow(m.digLeft, Float64Array, 1); // seconds of digging left
      m.badTile = grow(m.badTile, Int32Array, BAD_N);
      m.badUntil = grow(m.badUntil, Int32Array, BAD_N);   // sim tick the entry expires at
      m.badOwner = grow(m.badOwner, Uint32Array, BAD_N);  // serial, so a reused slot starts clean
      m.badNext = grow(m.badNext, Uint8Array, 1);
      m.awayTo = grow(m.awayTo, Int32Array, 1);    // an emigrant's destination tile
      m.awayFor = grow(m.awayFor, Uint32Array, 1); // the serial awayTo belongs to; another = not emigrating
      m.checkAt = grow(m.checkAt, Float64Array, 1); // sim.simSeconds of the last crowd check
      m.checkFor = grow(m.checkFor, Uint32Array, 1); // the serial checkAt belongs to
      m.stress = grow(m.stress, Float64Array, 1);  // stress as of stressAt (it fades by StressHalfLife)
      m.stressAt = grow(m.stressAt, Float64Array, 1);
      m.scareAt = grow(m.scareAt, Float64Array, 1); // sim.simSeconds of the last scare counted
      m.stressFor = grow(m.stressFor, Uint32Array, 1); // the serial these three belong to
      m.awayFrom = grow(m.awayFrom, Int32Array, 1); // where this trip began (TravelMin is measured from it)
      m.natal = grow(m.natal, Uint8Array, 1);      // 1: this trip is its natal dispersal (settles on arrival)
      m.dispFor = grow(m.dispFor, Uint32Array, 1); // the serial whose dispersal was decided (once a life)
      m.lead = grow(m.lead, Int32Array, 1);        // a companion's leader slot; -1 = it leads itself
      m.leadSerial = grow(m.leadSerial, Uint32Array, 1);
      m.cap = W.aCap;
    }
    return m;
  }

  // The state indices come from the CSV order, so find REST and DIG by name once per table
  // set. digHazard turns DigChance (per day) into a rate, the way grass.js does SeedChance, so a
  // roll at each decision adds up to DigChance a day however often decisions come.
  let idxT = null, restIdx = -1, digIdx = -1, digPerDecision = 0;
  function indices(T) {
    if (idxT !== T) {
      idxT = T;
      restIdx = T.states.bunny.findIndex(st => st.name === 'REST');
      digIdx = T.states.bunny.findIndex(st => st.name === 'DIG');
      const c = T.bunny.DigChance, perDay = T.bunny.DecidePerSec * AS.DAY_SECONDS;
      digPerDecision = c >= 1 ? 1 : c > 0 ? 1 - Math.exp(Math.log(1 - c) / perDay) : 0;
    }
  }

  // ---- shared pieces ---------------------------------------------------------------------

  const nb = new Int32Array(4);
  const open = new Int32Array(4);

  // Matchers and goals are created once; they read these instead of closing over a call.
  let mW = null, mMem = null, mSim = null, mSelf = 0, mGoalTile = 0;
  // Anything that hunts bunnies (species.csv's Prey rows: wolves and humans), by the bitmask
  // AS.relations gives; the HIDE and FLEE decisions set mThreat first.
  let mThreat = 0;
  const isThreat = t => { const k = mW.kind[t]; return k >= K.BUNNY && ((mThreat >> (k - K.BUNNY)) & 1) === 1; };
  const isFreeHole = t => mW.hole[t] === 1 && mW.kind[t] === K.EMPTY;
  const isHoleTile = t => t === mGoalTile;
  // Bare ground a bunny can dig: nothing on it, not already a hole, not scorched.
  const isBare = (W, t) => W.kind[t] === K.EMPTY && W.hole[t] === 0 && W.scorch[t] === 0;
  const isFreshBlade = t => {
    if (mW.kind[t] !== K.GRASS) return false;
    const base = mSelf * BAD_N, now = mSim.tickCount, owner = mW.aSerial[mSelf];
    for (let i = 0; i < BAD_N; i++) {
      if (mMem.badTile[base + i] === t && mMem.badOwner[base + i] === owner && mMem.badUntil[base + i] > now) return false;
    }
    return true;
  };
  // A tile at least AWAY_GAIN nearer the emigrant's destination (mGoalTile) than it is now.
  let mAwayNeed = 0;
  const isNearerAway = t => {
    const w = mW.w, dx = (t % w) - (mGoalTile % w), dy = ((t / w) | 0) - ((mGoalTile / w) | 0);
    return dx * dx + dy * dy <= mAwayNeed;
  };
  // A bunny of the other sex not already emigrating: who a leaving bunny takes along.
  const isCompanion = t => {
    if (mW.kind[t] !== K.BUNNY) return false;
    const p = mW.aSlot[t];
    return mW.aSex[p] !== mW.aSex[mSelf] && mMem.awayFor[p] !== mW.aSerial[p];
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

  // The tile one step from t in direction d, or -1 off the world.
  function dirTile(W, t, d) {
    const x = (t % W.w) + DX[d], y = ((t / W.w) | 0) + DY[d];
    return W.inside(x, y) ? y * W.w + x : -1;
  }

  const bestAdjacentBlade = (W, t) => AS.bestAdjacentBlade(W, t);

  // ---- emigrating ----------------------------------------------------------------------------

  // Bunnies in the square r tiles around t, not counting the one on t.
  function crowdAt(W, t, r) {
    const w = W.w, tx = t % w, ty = (t / w) | 0;
    const x0 = Math.max(0, tx - r), x1 = Math.min(w - 1, tx + r), y0 = Math.max(0, ty - r), y1 = Math.min(W.h - 1, ty + r);
    let c = 0;
    for (let y = y0; y <= y1; y++) {
      const row = y * w;
      for (let x = x0; x <= x1; x++) if (W.kind[row + x] === K.BUNNY) c++;
    }
    return c - 1;
  }

  // Within GOAL_WATER walking tiles of a shore, or anywhere in a world with no water.
  function nearWater(W, t) {
    if (W.waterCount === 0) return true;
    if (W.waterStale || !W.wDist) W.buildWaterField();
    return W.wDist[t] <= GOAL_WATER;
  }

  // A destination for a trip that began at `from`: a tile a random `run` from t (at least
  // minD) at a random angle, clamped to the world, and at least minD from `from` so a trip
  // never doubles back home. In a world with water it is also within GOAL_WATER walking
  // tiles of a shore if one of GOAL_TRIES such tiles is: a bunny can't live out of reach of
  // water, and one sent into dry land turned back to its home lake to drink every time.
  function farGoal(sim, t, run, from, minD) {
    const W = sim.W, fx = from % W.w, fy = (from / W.w) | 0;
    let g = -1, gFar = -1;
    for (let i = 0; i < GOAL_TRIES; i++) {
      const a = sim.rng.next() * 2 * Math.PI, r = Math.max(minD, sim.rng.inRange(run));
      const x = Math.min(W.w - 1, Math.max(0, Math.round(t % W.w + r * Math.cos(a))));
      const y = Math.min(W.h - 1, Math.max(0, Math.round(((t / W.w) | 0) + r * Math.sin(a))));
      g = y * W.w + x;
      if (Math.hypot(x - fx, y - fy) < minD) continue;
      if (gFar < 0) gFar = g;
      if (nearWater(W, g)) return g;
    }
    return gFar >= 0 ? gFar : g;
  }

  // How far, in tiles, a trip must take a bunny from where it began before it may settle:
  // TravelMin of the world's longer side.
  const travelMin = (W, S) => (S.TravelMin > 0 ? S.TravelMin : 0) * Math.max(W.w, W.h);
  const farFrom = (W, t, from, d) => Math.hypot(t % W.w - from % W.w, ((t / W.w) | 0) - ((from / W.w) | 0)) >= d;

  // Stress (Paul): scares and hunger with nothing to eat add to it, and it halves every
  // StressHalfLife days, so scares that come faster than they fade build up (repeated
  // harassment, not one bad chase) and LeaveStress sets a bunny emigrating. Stored as a value
  // and the time of it, and faded only when read or added to, so it costs nothing per tick.
  function stressNow(sim, s, m) {
    const W = sim.W, now = sim.simSeconds, S = AS.speciesStats(sim, s);
    if (m.stressFor[s] !== W.aSerial[s]) { m.stressFor[s] = W.aSerial[s]; m.stress[s] = 0; m.scareAt[s] = -Infinity; m.stressAt[s] = now; }
    if (now > m.stressAt[s]) {
      m.stress[s] *= Math.pow(0.5, (now - m.stressAt[s]) / (S.StressHalfLife * AS.DAY_SECONDS));
      m.stressAt[s] = now;
    }
    return m.stress[s];
  }
  function addStress(sim, s, amount) {
    if (!(amount > 0) || !(AS.speciesStats(sim, s).LeaveStress > 0)) return;
    const m = mem(sim.W);
    m.stress[s] = stressNow(sim, s, m) + amount;
  }
  // The inspector's view: stress now (faded to this moment), whether it is away (emigrating
  // or leaving home), and which.
  AS.bunnyStress = function (sim, s) {
    const m = mem(sim.W);
    const away = m.awayFor[s] === sim.W.aSerial[s];
    return { stress: stressNow(sim, s, m), away, leavingHome: away && m.natal[s] === 1 };
  };
  // A scare: one per chase. Fleeing, hiding and fleeing again from the same wolf within
  // SCARE_GAP seconds is still the one chase.
  function scared(sim, s) {
    const S = AS.speciesStats(sim, s);
    if (!(S.LeaveStress > 0)) return;
    const m = mem(sim.W), now = sim.simSeconds;
    stressNow(sim, s, m);
    if (now - m.scareAt[s] < SCARE_GAP) return;
    m.scareAt[s] = now;
    m.stress[s] += S.ScareStress;
  }

  // Leaving a crowd, with hysteresis (Paul): a wandering bunny, not yet elderly, with
  // LeaveCrowd or more bunnies around it sets off, with LeaveChance a day, for a destination
  // RoamRun tiles away in any direction, and keeps choosing new ones until it stands
  // somewhere near water with no more than SettleCrowd within SettleRange. Then it settles and is content with a
  // crowd again. Leaving thins the crowd, so most of a colony stays. It takes the nearest
  // bunny of the other sex not already leaving along, which follows it and settles when it
  // does: a lone settler never finds a mate, and a pair can found a colony. Takes this step
  // and returns true while emigrating; false lets a plain run go on (also how an emigrant
  // gets around a lake or a meadow its straight line runs into).
  function emigrateStep(sim, s, S, t) {
    const W = sim.W, m = mem(W), serial = W.aSerial[s], r = Math.round(S.VisionRange);
    if (m.awayFor[s] !== serial) {
      if (W.aRunLeft[s] > 0) return false;
      const now = sim.simSeconds, since = m.checkFor[s] === serial ? now - m.checkAt[s] : 0;
      m.checkFor[s] = serial; m.checkAt[s] = now;
      if (!(since > 0) || W.aAge[s] >= S.ElderAt * S.Lifespan) return false;
      // Natal dispersal (Paul): grown up, a bunny born in this world leaves home once, with
      // DisperseChance, for a spot DisperseRun away, and settles when it gets there.
      // Decided once a life, at its first wander as an adult; the first generation, placed
      // as adults where the world began, is already home.
      let natal = false;
      if (S.DisperseRun && m.dispFor[s] !== serial && W.aParentA[s] !== 0 && AS.stageOfSlot(sim, s) === AS.STAGE.ADULT) {
        m.dispFor[s] = serial;
        natal = S.DisperseChance > 0 && sim.rng.next() < S.DisperseChance;
      }
      if (natal) {
        m.awayFor[s] = serial; m.lead[s] = -1; m.natal[s] = 1; m.checkAt[s] = now; m.awayFrom[s] = t;
        m.awayTo[s] = farGoal(sim, t, S.DisperseRun, t, travelMin(W, S));
        takeCompanion(sim, s, S, t, m);
        return false;   // the trip starts on its next step
      }
      // Stressed past LeaveStress it goes; crowded, it goes with LeaveChance a day.
      const stressed = S.LeaveStress > 0 && stressNow(sim, s, m) >= S.LeaveStress;
      if (!stressed) {
        if (!(S.LeaveCrowd > 0 && S.LeaveChance > 0) || crowdAt(W, t, r) < S.LeaveCrowd) return false;
        if (sim.rng.next() >= 1 - Math.pow(1 - Math.min(S.LeaveChance, 1 - 1e-9), since / AS.DAY_SECONDS)) return false;
      }
      m.stress[s] = 0;   // a fresh start where it settles
      m.awayFor[s] = serial;
      m.lead[s] = -1;
      m.natal[s] = 0;
      m.checkAt[s] = now;
      m.awayFrom[s] = t;
      m.awayTo[s] = farGoal(sim, t, S.RoamRun, t, travelMin(W, S));
      takeCompanion(sim, s, S, t, m);
    } else if (m.lead[s] >= 0) {
      return followStep(sim, s, m, t);
    } else if (!m.natal[s] && sim.simSeconds - m.checkAt[s] >= SETTLE_EVERY) {
      // Settling looks SettleRange around, much wider than sight, so a pair doesn't stop
      // just past its colony's edge and merge back in; and only near water, where it can live.
      m.checkAt[s] = sim.simSeconds;
      if (farFrom(W, t, m.awayFrom[s], travelMin(W, S)) && crowdAt(W, t, Math.round(S.SettleRange)) <= S.SettleCrowd && nearWater(W, t)) {
        m.awayFor[s] = 0;
        W.aTargetTile[s] = -1;
        return false;
      }
    }
    if (W.aRunLeft[s] > 0) return false;
    const g = m.awayTo[s];
    W.aTargetTile[s] = g;
    // There: a natal disperser is home; an emigrant takes a new destination, and a plain run
    // before heading for it.
    const gx = g % W.w, gy = (g / W.w) | 0, tx = t % W.w, ty = (t / W.w) | 0;
    const left = Math.hypot(tx - gx, ty - gy);
    if (left <= AWAY_GAIN) {
      if (m.natal[s] && farFrom(W, t, m.awayFrom[s], travelMin(W, S))) { m.awayFor[s] = 0; m.natal[s] = 0; W.aTargetTile[s] = -1; }
      else m.awayTo[s] = farGoal(sim, t, m.natal[s] ? S.DisperseRun : S.RoamRun, m.awayFrom[s], travelMin(W, S));
      return false;
    }
    // Path, within sight, to a tile AWAY_GAIN nearer the destination: bunnies can't cross
    // grass, and a straight-line step stalls at every meadow. None within sight (walled in
    // by water or grass that way): try another destination after a plain run.
    mW = W; mGoalTile = g; mAwayNeed = (left - AWAY_GAIN) * (left - AWAY_GAIN);
    const best = AS.pathNext(sim, t, isNearerAway, S.VisionRange);
    if (best < 0 || best === t) { m.awayTo[s] = farGoal(sim, t, m.natal[s] ? S.DisperseRun : S.RoamRun, m.awayFrom[s], travelMin(W, S)); return false; }
    AS.stepTo(sim, s, best);
    return true;
  }

  // The open neighbor of t that most shortens the straight line to g, or -1 if none does.
  function closerStep(W, t, g) {
    const gx = g % W.w, gy = (g / W.w) | 0;
    const d2 = u => (u % W.w - gx) ** 2 + (((u / W.w) | 0) - gy) ** 2;
    let best = -1, bestD = d2(t);
    for (let i = 0, k = W.neighbors4(t, nb); i < k; i++) {
      const u = nb[i];
      if (W.kind[u] !== K.EMPTY) continue;
      const d = d2(u);
      if (d < bestD) { best = u; bestD = d; }
    }
    return best;
  }

  // The nearest visible bunny of the other sex not already away comes along: a lone settler
  // never finds a mate, and a pair can found a colony.
  function takeCompanion(sim, s, S, t, m) {
    const W = sim.W;
    mW = W; mSelf = s; mMem = m;
    const ct = AS.nearestVisible(sim, t, S.VisionRange, isCompanion);
    if (ct < 0) return;
    const c = W.aSlot[ct];
    m.awayFor[c] = W.aSerial[c]; m.lead[c] = s; m.leadSerial[c] = W.aSerial[s]; m.natal[c] = 0;
    W.aRunLeft[c] = 0;
  }

  // A companion keeps near its leader, and settles when the leader settles or dies.
  function followStep(sim, s, m, t) {
    const W = sim.W, L = m.lead[s];
    if (!W.aAlive[L] || W.aSerial[L] !== m.leadSerial[s] || m.awayFor[L] !== m.leadSerial[s]) {
      m.awayFor[s] = 0;
      W.aTargetTile[s] = -1;
      return false;
    }
    if (W.aRunLeft[s] > 0) return false;
    const lt = W.aTile[L];
    W.aTargetTile[s] = lt;
    const dx = (t % W.w) - (lt % W.w), dy = ((t / W.w) | 0) - ((lt / W.w) | 0);
    if (dx * dx + dy * dy <= FOLLOW_NEAR * FOLLOW_NEAR) return true;
    mW = W; mGoalTile = lt;
    let next = AS.pathNext(sim, t, touchesGoal, AS.speciesStats(sim, s).VisionRange);
    if (next < 0 || next === t) next = closerStep(W, t, lt);
    if (next < 0) return false;
    AS.stepTo(sim, s, next);
    return true;
  }

  // One step of a wander run: keep going while the way ahead is open, otherwise pick a new
  // open direction and run length right away. Shared by WANDER and by SEEK_FOOD when it has
  // no usable target, so a bunny never stands where it could be walking. An emigrating bunny
  // heads for its destination instead.
  function wanderStep(sim, s) {
    const W = sim.W;
    if (W.aStepLeft[s] > 0) return;
    const t = W.aTile[s], S = AS.speciesStats(sim, s);
    if ((S.LeaveCrowd > 0 && S.LeaveChance > 0 || S.LeaveStress > 0 || S.DisperseRun) && emigrateStep(sim, s, S, t)) return;
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
    const d = pickRoomDir(sim, s, K.BUNNY, open, n);
    W.aRunDir[s] = d;
    W.aRunLeft[s] = sim.rng.inRange(S.WanderRun);
    if (AS.stepTo(sim, s, dirTile(W, t, d))) W.aRunLeft[s]--;
  }

  // Every state but FLEE starts with sprint off and a fresh run.
  function calmStart(sim, s) {
    AS.setSprint(sim, s, false);
    sim.W.aRunLeft[s] = 0;
  }

  // ---- the states -------------------------------------------------------------------------

  AS.registerStates('bunny', {
    // "Stay still in the hole." Hunters can't bite a bunny on a hole or hunt it (wolf.js), so the
    // bunny simply waits; once no hunter is in sight the next decision lets it get on with life.
    HIDE: {
      enter(sim, s) {
        const W = sim.W;
        if (!W.hole[W.aTile[s]]) return false;
        mW = W;
        mThreat = AS.relations(sim.T).threat[AS.SPECIES.BUNNY];
        return AS.nearestVisible(sim, W.aTile[s], AS.speciesStats(sim, s).VisionRange, isThreat) >= 0;
      },
      start: calmStart,
      act(sim, s) {
        AS.setSprint(sim, s, false);
        sim.W.aTargetTile[s] = -1;
      },
    },

    // "Sprint to the nearest free hole it can see; with none in reach sprint away from the
    // nearest wolf, bending along a wall instead of into it; walk when out of Stamina."
    FLEE: {
      enter(sim, s) {
        const W = sim.W, S = AS.speciesStats(sim, s);
        mW = W;
        mThreat = AS.relations(sim.T).threat[AS.SPECIES.BUNNY];
        const wolf = AS.nearestVisible(sim, W.aTile[s], S.VisionRange, isThreat);
        if (wolf < 0) return false;
        const m = mem(W);
        m.wolf[s] = wolf;
        m.hole[s] = S.HoleRange > 0 && W.hCount > 0 ? AS.nearestVisible(sim, W.aTile[s], S.HoleRange, isFreeHole) : -1;
        return true;
      },
      start(sim, s) { sim.W.aRunLeft[s] = 0; scared(sim, s); },
      act(sim, s) {
        const W = sim.W, w = W.w, t = W.aTile[s], wolf = mem(W).wolf[s];
        const tx = t % w, ty = (t / w) | 0, wx = wolf % w, wy = (wolf / w) | 0;
        AS.setSprint(sim, s, true);   // refuses at 0 Stamina, so it walks then

        // A hole in reach beats running away: head for it. If it was taken or the way is
        // blocked, run away as below.
        const h = mem(W).hole[s];
        if (h >= 0 && W.hole[h] && (W.kind[h] === K.EMPTY || h === t)) {
          W.aTargetTile[s] = h;
          W.aTargetSlot[s] = -1;
          if (h === t || W.aStepLeft[s] > 0) return;   // on it: HIDE takes over at the next decision
          mW = W; mGoalTile = h;
          const step = AS.pathNext(sim, t, isHoleTile, AS.speciesStats(sim, s).HoleRange);
          if (step >= 0) { AS.stepTo(sim, s, step); return; }
        }

        // The escape point is FLEE_LOOKAHEAD tiles out along the best of a few directions:
        // straight away from the wolf, or turned by FLEE_TURNS, scored by how far it ends
        // from the wolf minus FLEE_WALL_COST for each tile of the way that is off the world or
        // within FLEE_WALL_MARGIN of its edge. Straight away is tried first and a turn must
        // score strictly higher, so with no wall near the bunny runs straight as it always has.
        // A turn must also start on an open tile. The intent line points at the chosen point.
        let ax = tx - wx, ay = ty - wy;
        const len = Math.sqrt(ax * ax + ay * ay) || 1;
        ax /= len; ay /= len;
        let bestC = -1, bestScore = -Infinity, bex = 0, bey = 0;
        // Far enough from every edge that no tile of any path can count as wall: straight away.
        const far = FLEE_WALL_MARGIN + FLEE_LOOKAHEAD + 1;
        const clear = tx >= far && ty >= far && tx < w - far && ty < W.h - far;
        for (let c = 0; c < (clear ? 1 : FLEE_TURNS.length); c++) {
          const cs = FLEE_TURNS[c][0], sn = FLEE_TURNS[c][1];
          const cx = ax * cs - ay * sn, cy = ax * sn + ay * cs;
          let near = 0;
          for (let i = 1; i <= FLEE_LOOKAHEAD && !clear; i++) {
            const px = Math.round(tx + cx * i), py = Math.round(ty + cy * i);
            if (px < FLEE_WALL_MARGIN || py < FLEE_WALL_MARGIN || px >= w - FLEE_WALL_MARGIN || py >= W.h - FLEE_WALL_MARGIN) near++;
          }
          let ex = Math.round(tx + cx * FLEE_LOOKAHEAD), ey = Math.round(ty + cy * FLEE_LOOKAHEAD);
          ex = ex < 0 ? 0 : ex >= w ? w - 1 : ex;
          ey = ey < 0 ? 0 : ey >= W.h ? W.h - 1 : ey;
          if (c > 0) {
            const fx = Math.round(tx + cx), fy = Math.round(ty + cy);
            if (!W.inside(fx, fy) || W.kind[fy * w + fx] !== K.EMPTY) continue;
          }
          const score = Math.sqrt((ex - wx) * (ex - wx) + (ey - wy) * (ey - wy)) - FLEE_WALL_COST * near;
          if (score > bestScore) { bestScore = score; bestC = c; bex = ex; bey = ey; }
          // Nothing near a wall on the straight path: no turn can beat it, so skip them.
          if (c === 0 && near === 0) break;
        }
        W.aTargetTile[s] = bey * w + bex;
        W.aTargetSlot[s] = -1;

        if (W.aStepLeft[s] > 0) return;
        // Straight away: the open neighbor that gets farthest from the wolf. A turn: the open
        // neighbor nearest the escape point. Either way it must get farther from the wolf than
        // where it is, or it stands (cornered).
        const k = W.neighbors4(t, nb);
        const d0 = (tx - wx) * (tx - wx) + (ty - wy) * (ty - wy);
        let best = -1, bestD = bestC === 0 ? d0 : Infinity;
        for (let i = 0; i < k; i++) {
          const n = nb[i];
          if (W.kind[n] !== K.EMPTY) continue;
          const dx = (n % w) - wx, dy = ((n / w) | 0) - wy, d2 = dx * dx + dy * dy;
          if (bestC === 0) {
            if (d2 > bestD) { bestD = d2; best = n; }
          } else if (d2 > d0) {
            const ex = (n % w) - bex, ey = ((n / w) | 0) - bey, e2 = ex * ex + ey * ey;
            if (e2 < bestD) { bestD = e2; best = n; }
          }
        }
        if (best >= 0) AS.stepTo(sim, s, best);
      },
    },

    // Thirst outranks food but not fear: HIDE and FLEE come first (animals.js, AS.drinkState).
    DRINK: AS.drinkState,

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
        AS.grazeBite(sim, s, blade);
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

    // "Dig a hole on a bare 4-neighbor tile for DigSeconds." The roll is made first, because
    // it is the cheap test and nearly always says no. A fed adult only: a hungry one has
    // better things to do, and FLEE and HIDE outrank this whenever a wolf is in sight.
    DIG: {
      enter(sim, s) {
        const W = sim.W, m = mem(W), S = AS.speciesStats(sim, s), t = W.aTile[s];
        indices(sim.T);
        // Already digging: carry on while the tile is still bare (act() abandons it if not).
        if (W.aState[s] === digIdx && m.digTile[s] >= 0 && isBare(W, m.digTile[s])) return true;
        if (AS.stageOfSlot(sim, s) !== AS.STAGE.ADULT || AS.isHungry(sim, s)) return false;
        if (!(digPerDecision > 0) || !(digPerDecision >= 1 || sim.rng.chance(digPerDecision))) return false;
        // Which neighbors may take a hole: within WarrenRadius of one, or, when no hole is
        // within HoleRange, any (this bunny founds a warren).
        const k = W.neighbors4(t, nb);
        const founds = !AS.holeWithin(W, t, S.HoleRange);
        let n = 0;
        for (let i = 0; i < k; i++) {
          const c = nb[i];
          if (isBare(W, c) && (founds || AS.holeWithin(W, c, sim.T.world.WarrenRadius))) open[n++] = c;
        }
        if (n === 0) return false;
        m.digTile[s] = open[sim.rng.int(n)];
        m.digLeft[s] = S.DigSeconds;
        return true;
      },
      start: calmStart,
      act(sim, s) {
        const W = sim.W, m = mem(W), tile = m.digTile[s];
        AS.setSprint(sim, s, false);
        if (tile < 0 || !isBare(W, tile)) {
          // Something else took the tile: give up and let the next decision choose.
          m.digTile[s] = -1;
          W.aTargetTile[s] = -1;
          W.aDecideLeft[s] = 0;
          return;
        }
        W.aTargetTile[s] = tile;
        W.aTargetSlot[s] = -1;
        m.digLeft[s] -= AS.DT;
        if (m.digLeft[s] > DIG_EPS) return;
        W.addHole(tile, sim.simSeconds);
        m.digTile[s] = -1;
        W.aTargetTile[s] = -1;
        W.aDecideLeft[s] = 0;
      },
    },

    // Hysteresis: it rests below RestBelow and stays down until RestUntil.
    REST: {
      enter(sim, s) {
        const W = sim.W, S = AS.speciesStats(sim, s);
        indices(sim.T);
        const limit = (W.aState[s] === restIdx ? S.RestUntil : S.RestBelow) * S.StaminaMax;
        return W.aStamina[s] < limit;
      },
      start: calmStart,
      act(sim, s) { AS.setSprint(sim, s, false); },
    },

    // "Walk a run of WanderRun tiles in a random direction." Always enters.
    WANDER: {
      enter() { return true; },
      // Wandering hungry means SEEK_FOOD found no blade in sight: this land isn't feeding it.
      start(sim, s) {
        calmStart(sim, s);
        if (AS.isHungry(sim, s)) addStress(sim, s, AS.speciesStats(sim, s).HungerStress);
      },
      act: wanderStep,
    },
  });
})(globalThis.AS);
