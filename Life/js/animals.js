// What every animal does each tick, whatever its species: its body (hunger, starving,
// healing, stamina, age, death), its steps across tiles, and the decide loop.
//
// The decide loop walks the species' states in states.csv order (Priority) and enters the
// first whose `enter` says yes; the state's `act` then runs every tick. Each species file
// (bunny.js, wolf.js) registers its states by the names states.csv uses, so reordering
// priorities in the CSV reorders behavior, and a name the code doesn't know is an error.
(function (AS) {
  'use strict';

  const KIND = AS.KIND, EV = AS.EV;
  // aState before an animal's first decision: it does nothing until it has decided.
  const NO_STATE = AS.NO_STATE = 255;

  // Per species key: { STATE_NAME: { enter(sim, s) → bool, act(sim, s), start?(sim, s) } }.
  const IMPL = AS.STATE_IMPL = Object.fromEntries(AS.SPECIES_KEY.map(k => [k, null]));

  AS.registerStates = function (key, impls) { IMPL[key] = impls; };

  // A species places animals only once its states exist; a milestone adds one at a time.
  AS.speciesReady = key => IMPL[key] !== null;

  // states.csv and the registered code must name the same states. Returns error strings
  // for the species that are built, and a warning for each that isn't yet.
  AS.checkStates = function (T) {
    const errors = [], warnings = [];
    for (const key of AS.SPECIES_KEY) {
      const Sp = key[0].toUpperCase() + key.slice(1);
      const impl = IMPL[key];
      if (!impl) {
        warnings.push(`${Sp} behavior isn't built yet, so none are placed.`);
        continue;
      }
      const csv = (T.states[key] || []).map(st => st.name);
      for (const name of csv) {
        if (!impl[name]) errors.push(`states.csv: ${Sp} state ${name} isn't something the sim knows how to do.`);
      }
      for (const name of Object.keys(impl)) {
        if (!csv.includes(name)) errors.push(`states.csv has no ${Sp} state ${name}, which the sim needs.`);
      }
    }
    return { errors, warnings };
  };

  // ---- body helpers the species files share ---------------------------------------

  // Who hunts and eats whom, from species.csv's Prey and EatsCarcass rows: per species code,
  // a bitmask over species codes (bit q set = species q). threat[q] is every species that
  // lists q as prey, which is what q runs from. Built once per table set.
  const relationsOf = new WeakMap();
  AS.relations = function (T) {
    let r = relationsOf.get(T);
    if (r) return r;
    const n = AS.SPECIES_KEY.length;
    r = { prey: new Int32Array(n), eats: new Int32Array(n), threat: new Int32Array(n) };
    for (let sp = 0; sp < n; sp++) {
      const S = T[AS.SPECIES_KEY[sp]];
      for (const q of S.Prey || []) { r.prey[sp] |= 1 << q; r.threat[q] |= 1 << sp; }
      for (const q of S.EatsCarcass || []) r.eats[sp] |= 1 << q;
    }
    relationsOf.set(T, r);
    return r;
  };

  AS.speciesStats = (sim, s) => sim.T[AS.SPECIES_KEY[sim.W.aSpecies[s]]];

  AS.stageOfSlot = (sim, s) => AS.stageOf(AS.speciesStats(sim, s), sim.W.aAge[s]);

  AS.isHungry = (sim, s) => {
    const S = AS.speciesStats(sim, s);
    return sim.W.aFullness[s] < S.HungryAt * S.FullnessMax;
  };

  // Tiles per second right now: sprint or walk, slowed for babies and elders. Pregnancy
  // doesn't slow anyone (DESIGN.md).
  AS.speedOf = function (sim, s) {
    const S = AS.speciesStats(sim, s), W = sim.W;
    let v = W.aSprint[s] ? S.SprintSpeed : S.WalkSpeed;
    const stage = AS.stageOf(S, W.aAge[s]);
    if (stage === AS.STAGE.BABY) v *= S.BabySpeed;
    else if (stage === AS.STAGE.ELDER) v *= S.ElderSpeed;
    return v;
  };

  // Sprinting needs Stamina. One that runs it to 0 is winded and walks until its Stamina
  // is full again (Paul), so it can't flicker between sprinting and walking on a trickle.
  AS.setSprint = function (sim, s, on) {
    sim.W.aSprint[s] = on && !sim.W.aWinded[s] && sim.W.aStamina[s] > 0 ? 1 : 0;
  };

  // Wading (Paul, 11 Oct 2026): an animal walks into water up to its WadeDepth (meters;
  // blank = none), slowed to WadeSpeed of its speed there; deeper water is a wall to it.
  AS.wadeOf = (sim, s) => AS.speciesStats(sim, s).WadeDepth || 0;
  // Whether an animal wading `wade` m deep can step onto t: open ground, or water with
  // nothing in it no deeper than that. Holes are the caller's rule.
  AS.canStand = (W, t, wade) => {
    const k = W.kind[t];
    return k === KIND.EMPTY || (k === KIND.WATER && W.wDepth[t] <= wade);
  };

  // One step to a 4-neighbor it can stand on, if the last step has finished. Returns
  // whether it moved. The step's time comes from the speed at the moment it starts.
  AS.stepTo = function (sim, s, t2) {
    const W = sim.W;
    if (W.aStepLeft[s] > 0 || !AS.canStand(W, t2, AS.wadeOf(sim, s))) return false;
    return move(sim, s, t2);
  };
  function move(sim, s, t2) {
    const W = sim.W;
    if (W.hole[t2] && !AS.canEnterHole(W.aSpecies[s])) return false;   // a hole is a wall to all but bunnies
    let v = AS.speedOf(sim, s);
    if (W.wDepth[t2] > 0) { const f = AS.speciesStats(sim, s).WadeSpeed; if (f != null) v *= f; }
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

  // The adjacent blade with the most Size (ties go to neighbor order), or -1.
  const gnb = new Int32Array(4);
  AS.bestAdjacentBlade = function (W, t) {
    const k = W.neighbors4(t, gnb);
    let best = -1, bestSize = -1;
    for (let i = 0; i < k; i++) {
      const n = gnb[i];
      if (W.kind[n] === KIND.GRASS && W.gSize[n] > bestSize) { best = n; bestSize = W.gSize[n]; }
    }
    return best;
  };

  // One bite of a blade that feeds the animal: GrassFood (BiteFood where GrassFood is blank)
  // for a full BiteSize, in proportion for a smaller blade. Bunnies graze and humans forage
  // with this. The caller has checked the bite timer.
  AS.grazeBite = function (sim, s, blade) {
    const W = sim.W, S = AS.speciesStats(sim, s);
    const removed = AS.grassBite(sim, blade, S.BiteSize);
    const full = W.aFullness[s] + (S.GrassFood != null ? S.GrassFood : S.BiteFood) * removed / S.BiteSize;
    W.aFullness[s] = full < S.FullnessMax ? full : S.FullnessMax;
    W.aBiteLeft[s] = S.BiteCooldown;
    sim.emit(EV.GRAZE, blade);
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

  // One bite of an adjacent animal: BiteDamage, and no food. A hunter eats the carcass its
  // kill leaves behind (wolf.js, FEED), not the live animal. Returns whether a bite landed;
  // a killing bite leaves a corpse and counts as a kill.
  AS.biteAnimal = function (sim, s, prey) {
    const W = sim.W;
    if (W.aBiteLeft[s] > 0 || !W.aAlive[prey]) return false;
    if (W.hole[W.aTile[prey]]) return false;   // safe in a hole
    const S = AS.speciesStats(sim, s);
    W.aBiteLeft[s] = S.BiteCooldown;
    const t = W.aTile[prey];
    sim.emit(EV.BITE, t);
    W.aHP[prey] -= S.BiteDamage;
    if (W.aHP[prey] <= 0) {
      AS.killAnimal(sim, prey, AS.CAUSE.ATTACKED + W.aSpecies[s]);
      W.aKills[s]++;
    }
    return true;
  };

  // `cause` is an AS.CAUSE for the corpse; the body's own deaths work theirs out (bodyCause).
  // What killed an animal whose HP ran out or whose Lifespan ended in its own body tick: old age
  // first, else whichever meter is empty (both: starved and thirsty).
  function bodyCause(sim, s) {
    const W = sim.W, S = AS.speciesStats(sim, s), C = AS.CAUSE;
    if (W.aAge[s] >= S.Lifespan) return C.OLD_AGE;
    const hungry = W.aFullness[s] === 0, dry = W.waterCount > 0 && W.aWater[s] === 0;
    return hungry && dry ? C.STARVED_THIRSTY : hungry ? C.STARVED : dry ? C.THIRST : C.UNKNOWN;
  }

  AS.killAnimal = function (sim, s, cause) {
    const W = sim.W, t = W.aTile[s], sp = W.aSpecies[s];
    W.removeAnimal(s);
    // One that dies in water leaves no body: the water carries it off, as it washes away a
    // corpse it reaches (water.js).
    if (!(W.wDepth[t] > 0)) {
      W.addCorpse(t, sp, cause);
      AS.corpseAdded(sim, t);
    }
    sim.emit(EV.DEATH, t);
  };

  // Starting animals (DESIGN.md "Setup"): 50/50 sex, a random age within adulthood, full
  // Fullness, HP and Stamina.
  // bodies 'mixed' (benchmarks only): Fullness anywhere from half of HungryAt to full.
  AS.spawnStarting = function (sim, species, t, bodies) {
    const W = sim.W, rng = sim.rng, S = sim.T[AS.SPECIES_KEY[species]];
    const s = W.addAnimal(t, species, rng.int(2));
    const adultFrom = S.TimeToMature, elderAt = S.ElderAt * S.Lifespan;
    W.aAge[s] = adultFrom + rng.next() * Math.max(0, elderAt - adultFrom);
    W.aWater[s] = S.WaterMax;
    W.aFullness[s] = bodies === 'mixed'
      ? S.FullnessMax * (S.HungryAt / 2 + rng.next() * (1 - S.HungryAt / 2))
      : S.FullnessMax;
    W.aHP[s] = S.HPMax;
    W.aStamina[s] = S.StaminaMax;
    // Spread decisions across the decide interval so they don't all land on one tick.
    W.aDecideLeft[s] = rng.next() / S.DecidePerSec;
    W.aState[s] = NO_STATE;
    return s;
  };

  // ---- thirst: the DRINK state every species shares ------------------------------------

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
    if (k === KIND.EMPTY) return dW.hole[t] && !dHoles ? Infinity : dInvSpeed;
    if (k === KIND.GRASS) return dInvSpeed + AS.chewSeconds(dSim, dSelf, t);
    if (k === KIND.WATER && dW.wDepth[t] <= dWade) return dInvSpeed;
    return Infinity;
  };
  // A shore tile an animal could drink from (a blade on it is chewed away on arrival).
  const isShoreGoal = t => dW.wDist[t] === 0 && (dW.kind[t] === KIND.EMPTY ? !dW.hole[t] || dHoles : dW.kind[t] === KIND.GRASS);

  // One move toward neighbor u: a step onto empty ground, or a bite at a blade in the way. A
  // grazer (hunts nothing) eats what it bites, as it would anyway; a hunter just chews through.
  function drinkMove(sim, s, u) {
    const W = sim.W;
    if (W.kind[u] === KIND.EMPTY || W.kind[u] === KIND.WATER) return AS.stepTo(sim, s, u);
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
        if (d < bestD && (W.kind[u] === KIND.EMPTY ? hole || !W.hole[u] : W.kind[u] === KIND.GRASS)) { best = u; bestD = d; }
      }
      if (best >= 0) drinkMove(sim, s, best);
    },
  };

  // ---- out of deep water --------------------------------------------------------------

  // An animal in water deeper than it wades (the water rose, or was poured on it) does
  // nothing else until it is out (Paul, 11 Oct 2026: animals step out): the nearest tile it
  // can stand on within sight, through water of any depth, at its wading speed; none in
  // sight, the shallowest neighbor that is shallower than here.
  let oW = null, oWade = 0, oHoles = false;
  const outCost = t => {
    const k = oW.kind[t];
    return (k === KIND.EMPTY || k === KIND.WATER) && (oHoles || !oW.hole[t]) ? 1 : Infinity;
  };
  const isStandable = t => AS.canStand(oW, t, oWade) && (oHoles || !oW.hole[t]);
  const onb = new Int32Array(4);
  function wadeOut(sim, s) {
    const W = sim.W;
    if (W.aStepLeft[s] > 0) return;
    const t = W.aTile[s];
    oW = W; oWade = AS.wadeOf(sim, s); oHoles = AS.canEnterHole(W.aSpecies[s]);
    let next = AS.pathNextWeighted(sim, t, isStandable, AS.speciesStats(sim, s).VisionRange, outCost);
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
  }

  // ---- the tick -----------------------------------------------------------------------

  function decide(sim, s, key) {
    const W = sim.W, list = sim.T.states[key], impl = IMPL[key];
    for (let i = 0; i < list.length; i++) {
      const st = impl[list[i].name];
      if (st.enter(sim, s)) {
        if (W.aState[s] !== i) {
          W.aState[s] = i;
          W.aTargetTile[s] = -1;
          W.aTargetSlot[s] = -1;
          AS.edgeReset(W, s);
          if (st.start) st.start(sim, s);
        }
        return;
      }
    }
  }

  // 1/30 s has no exact binary value, so counting a timer down tick by tick can stop a
  // hair above 0 and cost a whole extra tick. Anything within TIMER_EPS of 0 is 0.
  const TIMER_EPS = 1e-9;
  const countDown = (v, dt) => { const r = v - dt; return Math.abs(r) < TIMER_EPS ? 0 : r; };

  AS.animalsTick = function (sim) {
    const W = sim.W, T = sim.T, dt = AS.DT;
    for (let s = 0, hi = W.aHigh; s < hi; s++) {
      if (!W.aAlive[s]) continue;
      const key = AS.SPECIES_KEY[W.aSpecies[s]], S = T[key];

      // Body.
      W.aAge[s] += AS.DT_DAYS;
      // Activity sets the burn: standing still (resting, hiding, eating in place) costs
      // RestHunger times HungerRate, sprinting SprintHunger times, walking HungerRate.
      // A hunter that has gone RoamAfter days without seeing prey is desperate: walking costs
      // it RoamHunger times as much, so hunters starve out of hunted-out land rather than
      // patrol it for weeks.
      const moving = W.aStepLeft[s] > 0;
      const burn = W.aSprint[s] ? S.SprintHunger : moving ? 1 : S.RestHunger;
      const hungerBurn = moving && !W.aSprint[s] && S.RoamHunger > 1 && AS.isRoaming(sim, s) ? S.RoamHunger : burn;
      let full = W.aFullness[s] - S.HungerRate * hungerBurn * dt;
      if (full < 0) full = 0;
      W.aFullness[s] = full;
      // Thirst burns by the same activity factor as hunger. A world with no water has no
      // thirst at all, so the meter stays put and nothing about such a world changes.
      let thirsty = false;
      if (W.waterCount > 0) {
        W.ensureWaterField();
        let wat = W.aWater[s] - S.ThirstRate * burn * dt;
        if (wat < 0) wat = 0;
        W.aWater[s] = wat;
        thirsty = wat === 0;
      }
      let hp = W.aHP[s];
      if (full === 0) hp -= S.StarveDamage * dt;
      // A dry animal doesn't heal, or a wolf's HealRate would outweigh its small ThirstDamage forever.
      else if (full > S.HealAbove * S.FullnessMax && hp < S.HPMax && !thirsty) hp = Math.min(S.HPMax, hp + S.HealRate * dt);
      if (thirsty) hp -= S.ThirstDamage * dt;
      W.aHP[s] = hp;
      if (hp <= 0 || W.aAge[s] >= S.Lifespan) { AS.killAnimal(sim, s, bodyCause(sim, s)); continue; }

      if (W.aSprint[s]) {
        const st = W.aStamina[s] - S.SprintCost * dt;
        if (st <= 0) { W.aStamina[s] = 0; W.aSprint[s] = 0; W.aWinded[s] = 1; } else W.aStamina[s] = st;
      } else if (W.aStamina[s] < S.StaminaMax) {
        const st = W.aStamina[s] + S.StaminaRefill * dt;
        if (st >= S.StaminaMax) { W.aStamina[s] = S.StaminaMax; W.aWinded[s] = 0; } else W.aStamina[s] = st;
      }
      W.aBiteLeft[s] = countDown(W.aBiteLeft[s], dt);
      W.aStepLeft[s] = countDown(W.aStepLeft[s], dt);
      if (W.aPregnant[s] > 0) W.aPregnant[s] = Math.max(0, W.aPregnant[s] - AS.DT_DAYS);
      // Due (Pregnant reached 0 with a litter still waiting): births happen only when the
      // whole litter fits, so this retries every tick until it does.
      else if (W.aLitter[s] > 0) AS.tryBirth(sim, s);
      if (W.aMateCd[s] > 0) W.aMateCd[s] = Math.max(0, W.aMateCd[s] - AS.DT_DAYS);

      // Mind: re-pick the state a few times a second, act every tick.
      W.aDecideLeft[s] -= dt;
      if (W.aDecideLeft[s] <= 0) {
        decide(sim, s, key);
        W.aDecideLeft[s] += 1 / S.DecidePerSec;
      }
      const d = W.wDepth[W.aTile[s]];
      if (d > 0 && d > AS.wadeOf(sim, s)) { wadeOut(sim, s); continue; }
      if (W.aState[s] !== NO_STATE) IMPL[key][T.states[key][W.aState[s]].name].act(sim, s);
    }
  };
})(globalThis.AS);
