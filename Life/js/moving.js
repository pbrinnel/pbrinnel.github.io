// How animals get from tile to tile, whatever their species: a step onto ground (and how
// long it takes), wading and swimming, chewing through grass, going around what's in the way,
// and walking out of water too deep to stay in. animals.js runs the body and the decide loop;
// the species files choose where to go and call these to get there.
(function (AS) {
  'use strict';

  const KIND = AS.KIND, EV = AS.EV;

  // Wading (Paul, 11 Oct 2026): an animal walks into water up to its WadeDepth (meters;
  // blank = none), slowed to WadeSpeed of its speed there; deeper water is a wall to it.
  AS.wadeOf = (sim, s) => AS.speciesStats(sim, s).WadeDepth || 0;
  // Whether an animal wading `wade` m deep can step onto t: open ground, or water with
  // nothing in it no deeper than that. Holes are the caller's rule.
  AS.canStand = (W, t, wade) => {
    const k = W.kind[t];
    return k === KIND.EMPTY || (k === KIND.WATER && W.wDepth[t] <= wade);
  };

  // Swimming (Paul, 12 Oct 2026: wolves swim well and rabbits badly, as they do). Water
  // deeper than an animal wades costs it SwimCost Stamina a second (no sprinting, no refill)
  // and it moves at SwimSpeed; with no Stamina left it loses DrownDamage HP a second. It goes
  // in by choice only with at least SwimAt of its Stamina; a species without SwimAt goes in
  // only to flee (AS.isFleeing, bunny.js). Once in, it carries on while its Stamina is above
  // RestBelow, then makes for the nearest ground it can stand on (wadeOut). SwimCost blank:
  // it never swims, and deep water is a wall to it.
  const inDeep = (sim, s) => sim.W.wDepth[sim.W.aTile[s]] > AS.wadeOf(sim, s);
  AS.swimsNow = function (sim, s) {
    const W = sim.W, S = AS.speciesStats(sim, s);
    if (S.SwimCost == null || W.aWinded[s]) return false;
    const st = W.aStamina[s] / S.StaminaMax;
    if (!(st > S.RestBelow)) return false;
    if (S.SwimAt == null) return !!(AS.isFleeing && AS.isFleeing(sim, s));
    return inDeep(sim, s) || st >= S.SwimAt;
  };
  // Whether animal s can step onto t now: ground or water it can stand on, or deeper water
  // it would swim and can get across.
  AS.canEnter = (sim, s, t) => AS.canStand(sim.W, t, AS.wadeOf(sim, s)) ||
    (sim.W.kind[t] === KIND.WATER && AS.swimsNow(sim, s) && (inDeep(sim, s) || crossable(sim, s, t)));

  // Into deep water from land only toward land it can see within its swimming reach (Paul,
  // 12 Oct 2026: a rabbit doesn't strike out across water with no far bank in view): the
  // tiles its Stamina lasts at its swimming speed, and land at least two tiles ahead in the
  // direction it would swim, so not the bank it is leaving. A breadth-first walk through the
  // deep water.
  const crossQ = [], crossSeen = new Map();
  function crossable(sim, s, t) {
    const W = sim.W, S = AS.speciesStats(sim, s), wade = AS.wadeOf(sim, s), from = W.aTile[s];
    const sw = S.SwimSpeed != null ? S.SwimSpeed : 1;
    const reach = Math.floor(W.aStamina[s] / S.SwimCost * S.WalkSpeed * sw);
    if (reach < 1) return false;
    const fx = from % W.w, fy = (from / W.w) | 0, dx = t % W.w - fx, dy = ((t / W.w) | 0) - fy;
    crossQ.length = 0; crossSeen.clear();
    crossQ.push(t); crossSeen.set(t, 1);
    for (let i = 0; i < crossQ.length; i++) {
      const u = crossQ[i], d = crossSeen.get(u);
      for (let j = 0, k = W.neighbors4(u, crossNb); j < k; j++) {
        const v = crossNb[j];
        if (crossSeen.has(v) || v === from) continue;
        crossSeen.set(v, d + 1);
        if (AS.canStand(W, v, wade) && (v % W.w - fx) * dx + (((v / W.w) | 0) - fy) * dy >= 2) return true;
        if (W.kind[v] === KIND.WATER && d < reach) crossQ.push(v);
      }
    }
    return false;
  }
  const crossNb = new Int32Array(4);

  // One step to a 4-neighbor it can enter, if the last step has finished. Returns whether it
  // moved. The step's time comes from the speed at the moment it starts.
  AS.stepTo = function (sim, s, t2) {
    const W = sim.W;
    if (W.aStepLeft[s] > 0 || !AS.canEnter(sim, s, t2)) return false;
    return move(sim, s, t2);
  };
  function move(sim, s, t2) {
    const W = sim.W, S = AS.speciesStats(sim, s);
    if (W.hole[t2] && !AS.canEnterHole(W.aSpecies[s])) return false;   // a hole is a wall to all but bunnies
    let v = AS.speedOf(sim, s);
    const d = W.wDepth[t2];
    if (d > 0) { const f = d > AS.wadeOf(sim, s) ? S.SwimSpeed : S.WadeSpeed; if (f != null) v *= f; }
    if (!(v > 0)) return false;
    const dur = 1 / v;
    W.moveAnimal(s, t2);
    // Carry the overshoot of the last tick into this step (at most one tick's worth), so
    // speeds that don't divide evenly into ticks still average out right.
    W.aStepLeft[s] = Math.max(W.aStepLeft[s], -AS.DT) + dur;
    W.aStepDur[s] = dur;
    return true;
  };

  // Seconds a blade on tile t would take this animal to chew away: whole bites of
  // BiteSize, one per BiteCooldown. Pathing weighs this against walking around.
  AS.chewSeconds = function (sim, s, t) {
    const S = AS.speciesStats(sim, s);
    if (!(S.BiteSize > 0)) return Infinity;
    return Math.ceil(sim.W.gSize[t] / S.BiteSize) * S.BiteCooldown;
  };

  // Moves toward a 4-neighbor that may hold grass (DESIGN.md: wolves and humans chew through grass
  // when that's quicker). Empty: step. Grass: bite it down, no food, a grazing-sized mark;
  // the step comes on a later tick once the blade is gone. Returns whether it moved.
  AS.chewOrStep = function (sim, s, t2) {
    const W = sim.W;
    if (W.kind[t2] === KIND.EMPTY || W.kind[t2] === KIND.WATER) return AS.stepTo(sim, s, t2);
    if (W.kind[t2] !== KIND.GRASS || W.aStepLeft[s] > 0 || W.aBiteLeft[s] > 0) return false;
    const S = AS.speciesStats(sim, s);
    if (!(S.BiteSize > 0)) return false;
    AS.grassBite(sim, t2, S.BiteSize);
    W.aBiteLeft[s] = S.BiteCooldown;
    sim.emit(EV.GRAZE, t2);
    return false;
  };

  // ---- going around what's in the way ------------------------------------------------------

  // A step toward a goal the path search can't reach (it looks only VisionRange around), or
  // too far away for it (Paul, 12 Oct 2026). Straight at the goal while some step gets
  // closer; blocked, the animal follows the edge of what's in its way, keeping it on its own
  // side: every animal is born left- or right-handed (its serial's last bit, so the draw costs
  // the world's random numbers nothing), and two wolves meeting a lake split around it. It
  // leaves the edge once it is closer than where it met it and a step gets closer still, and
  // gives up after EdgeFollow steps along edges in one trip, so a cupped shore can't loop it
  // forever (blank: it gives up as soon as it is blocked).
  //
  //   AS.edgeStep(sim, s, goal, key, canEnter) → the tile to step to, or -1 (gave up, walled in)
  //     key        what the trip is for (a destination tile, or minus a target's serial): a new
  //                key starts afresh, and a given-up key stays given up
  //     canEnter   (tile) → whether this animal can step there
  //   The caller makes the step; one it hasn't made yet (a blade still being chewed) is kept.
  const DX4 = [0, 1, 0, -1], DY4 = [-1, 0, 1, 0];
  const EDGE_OFF = 0, EDGE_ON = 1, EDGE_GAVE_UP = 2;
  const edgeOf = new WeakMap();
  function edgeMem(W) {
    let e = edgeOf.get(W);
    if (!e) { e = { cap: 0 }; edgeOf.set(W, e); }
    if (e.cap < W.aCap) {
      const grow = (old, Ctor) => { const a = new Ctor(W.aCap); if (old) a.set(old); return a; };
      e.for = grow(e.for, Uint32Array);    // the serial this slot's trip belongs to
      e.key = grow(e.key, Float64Array);   // the trip's key
      e.mode = grow(e.mode, Uint8Array);   // EDGE_OFF, EDGE_ON or EDGE_GAVE_UP
      e.dir = grow(e.dir, Uint8Array);     // heading along the edge (DX4/DY4 index)
      e.hit = grow(e.hit, Float32Array);   // distance to the goal where it met the edge
      e.left = grow(e.left, Int32Array);   // steps it may still take along edges this trip
      e.at = grow(e.at, Int32Array);       // tile the last step was chosen from
      e.next = grow(e.next, Int32Array);   // that step
      e.cap = W.aCap;
    }
    return e;
  }
  // Forget any trip: the next edgeStep starts afresh (a found path, a new state).
  AS.edgeReset = function (W, s) { const e = edgeMem(W); e.for[s] = 0; };

  AS.edgeStep = function (sim, s, goal, key, canEnter) {
    const W = sim.W, e = edgeMem(W), t = W.aTile[s], w = W.w;
    if (e.for[s] !== W.aSerial[s] || e.key[s] !== key) {
      e.for[s] = W.aSerial[s]; e.key[s] = key; e.mode[s] = EDGE_OFF; e.at[s] = -1;
      const f = AS.speciesStats(sim, s).EdgeFollow;
      e.left[s] = f > 0 ? Math.round(f) : 0;
    }
    if (e.mode[s] === EDGE_GAVE_UP) return -1;
    if (e.at[s] === t && canEnter(e.next[s])) return e.next[s];
    const tx = t % w, ty = (t / w) | 0, gx = goal % w, gy = (goal / w) | 0;
    const here = Math.hypot(tx - gx, ty - gy);
    let best = -1, bestD = here;
    for (let d = 0; d < 4; d++) {
      const x = tx + DX4[d], y = ty + DY4[d];
      if (!W.inside(x, y)) continue;
      const u = y * w + x, dd = Math.hypot(x - gx, y - gy);
      if (dd < bestD && canEnter(u)) { best = u; bestD = dd; }
    }
    const take = u => { e.at[s] = t; e.next[s] = u; return u; };
    if (e.mode[s] === EDGE_OFF) {
      if (best >= 0) return take(best);
      if (e.left[s] <= 0) { e.mode[s] = EDGE_GAVE_UP; return -1; }
      e.mode[s] = EDGE_ON; e.hit[s] = here;
      // Face along the edge with the goal on the animal's hand side.
      const dx = gx - tx, dy = gy - ty;
      const toGoal = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
      e.dir[s] = (W.aSerial[s] & 1) ? (toGoal + 3) & 3 : (toGoal + 1) & 3;
    } else if (best >= 0 && here < e.hit[s]) {
      e.mode[s] = EDGE_OFF;
      return take(best);
    }
    if (e.left[s] <= 0) { e.mode[s] = EDGE_GAVE_UP; return -1; }
    e.left[s]--;
    // Hand on the edge: turn toward it if it falls away, else ahead, else away, else back.
    const hand = (W.aSerial[s] & 1) ? 1 : 3, h = e.dir[s];
    for (let i = 0; i < 4; i++) {
      const d = (h + (i === 0 ? hand : i === 1 ? 0 : i === 2 ? 4 - hand : 2)) & 3;
      const x = tx + DX4[d], y = ty + DY4[d];
      if (!W.inside(x, y)) continue;
      const u = y * w + x;
      if (canEnter(u)) { e.dir[s] = d; return take(u); }
    }
    return -1;
  };

  // ---- out of deep water --------------------------------------------------------------

  // An animal in water deeper than it wades that isn't swimming on purpose (the water rose or
  // was poured on it, or it is tiring: AS.swimsNow) does nothing else until it is out (Paul,
  // 11 Oct 2026: animals step out): the nearest tile it can stand on within OUT_RANGE (it
  // knows its land well beyond sight, as WaterSense says), through water of any depth; none
  // there, the shallowest neighbor that is shallower than here.
  const OUT_RANGE = 40;
  let oW = null, oWade = 0, oHoles = false;
  const outCost = t => {
    const k = oW.kind[t];
    return (k === KIND.EMPTY || k === KIND.WATER) && (oHoles || !oW.hole[t]) ? 1 : Infinity;
  };
  const isStandable = t => AS.canStand(oW, t, oWade) && (oHoles || !oW.hole[t]);
  const onb = new Int32Array(4);
  AS.wadeOut = function (sim, s) {
    const W = sim.W;
    if (W.aStepLeft[s] > 0) return;
    const t = W.aTile[s];
    oW = W; oWade = AS.wadeOf(sim, s); oHoles = AS.canEnterHole(W.aSpecies[s]);
    let next = AS.pathNextWeighted(sim, t, isStandable, Math.max(OUT_RANGE, AS.speciesStats(sim, s).VisionRange), outCost);
    if (next === t) next = -1;
    if (next < 0) {
      let best = W.wDepth[t];
      for (let i = 0, k = W.neighbors4(t, onb); i < k; i++) {
        const u = onb[i];
        if (outCost(u) !== Infinity && W.wDepth[u] < best) { next = u; best = W.wDepth[u]; }
      }
    }
    W.aTargetTile[s] = next;
    W.aTargetSlot[s] = -1;
    if (next >= 0) move(sim, s, next);
  };
})(globalThis.AS);
