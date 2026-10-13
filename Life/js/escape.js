// Fire's ESCAPE state, shared by every animal that senses it, and the run-away step it shares
// with the bunny's FLEE. An animal notices a burning tile within FireSense (smell and smoke,
// so no line of sight, unlike seeing a wolf) or finds itself alight, and it outranks
// everything else in states.csv. A bunny makes for a free warren hole nearer than the fire
// and stays in it, since a hole never burns; an animal alight makes for the water it knows
// (water puts it out); the rest run straight away from the fire.
//
//   AS.nearestFire(sim, t, range) → tile of the nearest burning tile within range, or -1
//   AS.runFrom(sim, s, danger)    one step of a sprint away from the tile `danger`
//   AS.escapeState                the ESCAPE state: bunny.js, wolf.js (and so human.js) register it
(function (AS) {
  'use strict';

  const KIND = AS.KIND, FLOW = AS.FLOW;

  // How far ahead, in tiles, the run-away intent line points from the animal.
  const RUN_LOOKAHEAD = 4;
  // The escape directions weighed, as [cos, sin] of the turn from straight away from the
  // danger: straight first (it wins ties), then 45 and 90 degrees to either side.
  const RUN_TURNS = [[1, 0], [Math.SQRT1_2, Math.SQRT1_2], [Math.SQRT1_2, -Math.SQRT1_2], [0, 1], [0, -1]];
  // A tile of the escape path this near the edge of the world, or off it, counts as wall...
  const RUN_WALL_MARGIN = 2;
  // ...and costs this many tiles of distance gained from the danger, so an animal turns along
  // a wall once running on would put several path tiles against it.
  const RUN_WALL_COST = 1.5;
  // Once escaping, an animal keeps at it until the fire is this many tiles beyond FireSense, so
  // one at the edge of its range doesn't step out and back in at every decision.
  const ESCAPE_CLEAR = 2;

  const nb = new Int32Array(4);

  // ---- finding things -----------------------------------------------------------------

  // The nearest tile within `range` (straight-line, nearest first, ties to the lower tile) that
  // `match` accepts, from a world's dense list that holds every such tile (and maybe more).
  // A list longer than the square around `from` is quicker to sweep tile by tile.
  function nearestListed(W, from, range, list, count, match) {
    if (count === 0) return -1;
    const w = W.w, fx = from % w, fy = (from / w) | 0, r = Math.floor(range), r2 = range * range;
    let best = -1, bestD = Infinity;
    if (count > (2 * r + 1) * (2 * r + 1)) {
      const x0 = Math.max(0, fx - r), x1 = Math.min(w - 1, fx + r), y0 = Math.max(0, fy - r), y1 = Math.min(W.h - 1, fy + r);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x - fx, dy = y - fy, d2 = dx * dx + dy * dy;
          if (d2 < bestD && d2 <= r2 && match(y * w + x)) { best = y * w + x; bestD = d2; }
        }
      }
      return best;
    }
    for (let i = 0; i < count; i++) {
      const u = list[i], dx = (u % w) - fx, dy = ((u / w) | 0) - fy, d2 = dx * dx + dy * dy;
      if (d2 <= r2 && (d2 < bestD || (d2 === bestD && u < best)) && match(u)) { best = u; bestD = d2; }
    }
    return best;
  }

  let mW = null;
  const isBurning = t => mW.flow[t] === FLOW.FIRE;
  AS.nearestFire = function (sim, t, range) {
    const W = sim.W;
    if (W.fCount === 0) return -1;
    mW = W;
    return nearestListed(W, t, range, W.fList, W.fCount, isBurning);
  };

  // ---- running away ---------------------------------------------------------------------

  // One step of a run from `danger` (a tile): the escape point is RUN_LOOKAHEAD tiles out along
  // the best of a few directions, straight away or turned by RUN_TURNS, scored by how far it
  // ends from the danger minus RUN_WALL_COST for each tile of the way that is off the world or
  // within RUN_WALL_MARGIN of its edge. Straight away is tried first and a turn must score
  // strictly higher, so with no wall near the animal runs straight. A turn must also start on
  // an open tile. The intent line points at the chosen point. The caller sets sprint.
  AS.runFrom = function (sim, s, danger) {
    const W = sim.W, w = W.w, t = W.aTile[s];
    const tx = t % w, ty = (t / w) | 0, wx = danger % w, wy = (danger / w) | 0;
    let ax = tx - wx, ay = ty - wy;
    const len = Math.sqrt(ax * ax + ay * ay) || 1;
    ax /= len; ay /= len;
    let bestC = -1, bestScore = -Infinity, bex = 0, bey = 0;
    // Far enough from every edge that no tile of any path can count as wall: straight away.
    const far = RUN_WALL_MARGIN + RUN_LOOKAHEAD + 1;
    const clear = tx >= far && ty >= far && tx < w - far && ty < W.h - far;
    for (let c = 0; c < (clear ? 1 : RUN_TURNS.length); c++) {
      const cs = RUN_TURNS[c][0], sn = RUN_TURNS[c][1];
      const cx = ax * cs - ay * sn, cy = ax * sn + ay * cs;
      let near = 0;
      for (let i = 1; i <= RUN_LOOKAHEAD && !clear; i++) {
        const px = Math.round(tx + cx * i), py = Math.round(ty + cy * i);
        if (px < RUN_WALL_MARGIN || py < RUN_WALL_MARGIN || px >= w - RUN_WALL_MARGIN || py >= W.h - RUN_WALL_MARGIN) near++;
      }
      let ex = Math.round(tx + cx * RUN_LOOKAHEAD), ey = Math.round(ty + cy * RUN_LOOKAHEAD);
      ex = ex < 0 ? 0 : ex >= w ? w - 1 : ex;
      ey = ey < 0 ? 0 : ey >= W.h ? W.h - 1 : ey;
      if (c > 0) {
        const fx = Math.round(tx + cx), fy = Math.round(ty + cy);
        if (!W.inside(fx, fy) || !AS.canEnter(sim, s, fy * w + fx)) continue;
      }
      const score = Math.sqrt((ex - wx) * (ex - wx) + (ey - wy) * (ey - wy)) - RUN_WALL_COST * near;
      if (score > bestScore) { bestScore = score; bestC = c; bex = ex; bey = ey; }
      // Nothing near a wall on the straight path: no turn can beat it, so skip them.
      if (c === 0 && near === 0) break;
    }
    W.aTargetTile[s] = bey * w + bex;
    W.aTargetSlot[s] = -1;

    if (W.aStepLeft[s] > 0) return;
    // Straight away: the open neighbor that gets farthest from the danger. A turn: the open
    // neighbor nearest the escape point. Either way it must get farther from the danger than
    // where it is, or it stands (cornered).
    const k = W.neighbors4(t, nb);
    const d0 = (tx - wx) * (tx - wx) + (ty - wy) * (ty - wy);
    let best = -1, bestD = bestC === 0 ? d0 : Infinity;
    for (let i = 0; i < k; i++) {
      const n = nb[i];
      if (!AS.canEnter(sim, s, n)) continue;
      const dx = (n % w) - wx, dy = ((n / w) | 0) - wy, d2 = dx * dx + dy * dy;
      if (bestC === 0) {
        if (d2 > bestD) { bestD = d2; best = n; }
      } else if (d2 > d0) {
        const ex = (n % w) - bex, ey = ((n / w) | 0) - bey, e2 = ex * ex + ey * ey;
        if (e2 < bestD) { bestD = e2; best = n; }
      }
    }
    if (best >= 0) AS.stepTo(sim, s, best);
  };

  // ---- the state --------------------------------------------------------------------------

  // What each decision chose, for act() (the decide loop clears the target fields when the
  // state changes, which would erase a choice made in enter()). By world, indexed by slot.
  const memOf = new WeakMap();
  function mem(W) {
    let m = memOf.get(W);
    if (!m) m = { fire: new Int32Array(0), hole: new Int32Array(0) };
    if (m.fire.length < W.aCap) {
      const grow = old => { const a = new Int32Array(W.aCap).fill(-1); a.set(old); return a; };
      m = { fire: grow(m.fire), hole: grow(m.hole) };
      memOf.set(W, m);
    }
    return m;
  }

  const escIdxOf = new WeakMap();
  function escapeIdx(sim, s) {
    let byKey = escIdxOf.get(sim.T);
    if (!byKey) { byKey = {}; escIdxOf.set(sim.T, byKey); }
    const key = AS.SPECIES_KEY[sim.W.aSpecies[s]];
    if (byKey[key] === undefined) byKey[key] = sim.T.states[key].findIndex(st => st.name === 'ESCAPE');
    return byKey[key];
  }

  // Whether an animal alight at t knows water: it stands in some, or the water field puts a
  // shore within WaterSense (the same knowledge as thirst's).
  function knowsWater(sim, s) {
    const W = sim.W, t = W.aTile[s];
    if (W.waterCount === 0) return false;
    W.ensureWaterField();
    return W.wDepth[t] > 0 || W.wDist[t] <= AS.speciesStats(sim, s).WaterSense;
  }

  // A free warren hole, or the one the animal stands on.
  const isFreeHole = t => mW.hole[t] === 1 && mW.kind[t] === KIND.EMPTY;
  const d2Tiles = (W, a, b) => {
    const dx = (a % W.w) - (b % W.w), dy = ((a / W.w) | 0) - ((b / W.w) | 0);
    return dx * dx + dy * dy;
  };

  let pGoal = 0;
  const isGoalTile = t => t === pGoal;
  const isWet = t => mW.wDepth[t] > 0;

  // A step toward water for an animal alight: into a wet tile it can enter beside it; else the
  // shortest walk within sight; else the water field's way. False when none works.
  function stepToWater(sim, s) {
    const W = sim.W, S = AS.speciesStats(sim, s), t = W.aTile[s];
    W.aTargetTile[s] = W.wShore[t];
    W.aTargetSlot[s] = -1;
    if (W.aStepLeft[s] > 0) return true;
    for (let i = 0, k = W.neighbors4(t, nb); i < k; i++) {
      if (W.wDepth[nb[i]] > 0 && AS.canEnter(sim, s, nb[i])) { AS.stepTo(sim, s, nb[i]); return true; }
    }
    mW = W;
    if (W.wDist[t] <= S.VisionRange) {
      const step = AS.pathNext(sim, t, isWet, S.VisionRange);
      if (step >= 0 && step !== t) { AS.stepTo(sim, s, step); return true; }
    }
    const nxt = W.wNext[t];
    if (nxt >= 0 && AS.canStand(W, nxt, AS.wadeOf(sim, s)) && (AS.canEnterHole(W.aSpecies[s]) || !W.hole[nxt])) {
      AS.stepTo(sim, s, nxt);
      return true;
    }
    return false;
  }

  AS.escapeState = {
    // "A burning tile within FireSense, or the animal itself alight." With no fire anywhere and
    // nobody alight it answers at once, drawing nothing: a world without fire never notices.
    enter(sim, s) {
      const W = sim.W, alight = W.aAlight[s] > 0;
      if (W.fCount === 0 && !alight) return false;
      const S = AS.speciesStats(sim, s), t = W.aTile[s];
      const range = S.FireSense + (W.aState[s] === escapeIdx(sim, s) ? ESCAPE_CLEAR : 0);
      const fire = AS.nearestFire(sim, t, range);
      // Alight with nowhere to go (no water known, no fire to run from) there is nothing to do.
      if (fire < 0 && !(alight && knowsWater(sim, s))) return false;
      const m = mem(W);
      m.fire[s] = fire;
      m.hole[s] = -1;
      // A bunny ahead of a fire that isn't itself alight (a hole is no help to one that is):
      // the hole it stands on, else the nearest free one in HoleRange nearer than the fire.
      if (!alight && fire >= 0 && AS.canEnterHole(W.aSpecies[s]) && S.HoleRange > 0) {
        if (W.hole[t]) m.hole[s] = t;
        else if (W.hCount > 0) {
          mW = W;
          const h = nearestListed(W, t, S.HoleRange, W.hList, W.hCount, isFreeHole);
          if (h >= 0 && d2Tiles(W, t, h) < d2Tiles(W, t, fire)) m.hole[s] = h;
        }
      }
      return true;
    },
    start(sim, s) { sim.W.aRunLeft[s] = 0; },
    act(sim, s) {
      const W = sim.W, t = W.aTile[s], m = mem(W);
      AS.setSprint(sim, s, true);   // refuses at 0 Stamina, so it walks then
      if (W.aAlight[s] > 0 && knowsWater(sim, s) && stepToWater(sim, s)) return;
      const h = m.hole[s];
      if (h >= 0 && W.hole[h] && (W.kind[h] === KIND.EMPTY || h === t)) {
        W.aTargetTile[s] = h;
        W.aTargetSlot[s] = -1;
        if (h === t) { AS.setSprint(sim, s, false); return; }   // safe: stays while the fire is near
        if (W.aStepLeft[s] > 0) return;
        pGoal = h;
        const step = AS.pathNext(sim, t, isGoalTile, AS.speciesStats(sim, s).HoleRange);
        if (step >= 0) { AS.stepTo(sim, s, step); return; }
      }
      if (m.fire[s] >= 0) AS.runFrom(sim, s, m.fire[s]);
    },
  };
})(globalThis.AS);
