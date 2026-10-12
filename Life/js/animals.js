// What every animal does each tick, whatever its species: its body (hunger, thirst,
// starving, healing, stamina, swimming, age, death), bites, and the decide loop. How it
// steps from tile to tile is moving.js; the shared DRINK state is drink.js.
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

  AS.registerStates = function (key, impls) { IMPL[key] = impls; statesT = null; };

  // Each species' states in states.csv order, as their { enter, act, start } objects, for
  // whichever table set was asked last: the tick needs one per animal per tick, so not by name.
  let statesT = null, statesBy = null;
  function statesOf(T) {
    if (T !== statesT) {
      statesT = T;
      statesBy = AS.SPECIES_KEY.map(k => (IMPL[k] && T.states[k] ? T.states[k].map(st => IMPL[k][st.name]) : null));
    }
    return statesBy;
  }

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

  // An animal's species column of the tables. Called on nearly every decision, so the columns
  // are kept as an array by species code for whichever table set was asked last.
  let statsT = null, statsBy = null;
  AS.speciesStats = (sim, s) => {
    if (sim.T !== statsT) { statsT = sim.T; statsBy = AS.SPECIES_KEY.map(k => statsT[k]); }
    return statsBy[sim.W.aSpecies[s]];
  };

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
  // first, then fire if it was alight (it is what finished it), else whichever meter is empty
  // (both: starved and thirsty).
  function bodyCause(sim, s, burning) {
    const W = sim.W, S = AS.speciesStats(sim, s), C = AS.CAUSE;
    if (W.aAge[s] >= S.Lifespan) return C.OLD_AGE;
    if (burning) return C.BURNED;
    const hungry = W.aFullness[s] === 0, dry = W.waterCount > 0 && W.aWater[s] === 0;
    return hungry && dry ? C.STARVED_THIRSTY : hungry ? C.STARVED : dry ? C.THIRST : C.UNKNOWN;
  }

  AS.killAnimal = function (sim, s, cause) {
    const W = sim.W, t = W.aTile[s], sp = W.aSpecies[s], alight = W.aAlight[s] > 0;
    W.removeAnimal(s);
    // One that dies in water leaves no body: the water carries it off, as it washes away a
    // corpse it reaches (water.js).
    if (!(W.wDepth[t] > 0)) {
      W.addCorpse(t, sp, cause);
      AS.corpseAdded(sim, t);
      // One that was alight when it died, whatever killed it, burns on as a corpse by fire's
      // normal rules (a hole's corpse never burns).
      if (alight) AS.ignite(sim, t);
    }
    sim.emit(EV.DEATH, t);
  };

  // Starting animals (DESIGN.md "Making a world"): 50/50 sex, a random age within adulthood, full
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

  // ---- the tick -----------------------------------------------------------------------

  function decide(sim, s, list) {
    const W = sim.W;
    for (let i = 0; i < list.length; i++) {
      const st = list[i];
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
    const W = sim.W, T = sim.T, dt = AS.DT, states = statesOf(T);
    // Thirst reads the way-to-water field. Nothing in this loop makes it stale, so it is
    // brought up to date once, here, when there is water and anyone to drink it.
    if (W.waterCount > 0 && AS.POP_KEY.some(k => W[k] > 0)) W.ensureWaterField();
    for (let s = 0, hi = W.aHigh; s < hi; s++) {
      if (!W.aAlive[s]) continue;
      const sp = W.aSpecies[s], S = T[AS.SPECIES_KEY[sp]];

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
        let wat = W.aWater[s] - S.ThirstRate * burn * dt;
        if (wat < 0) wat = 0;
        W.aWater[s] = wat;
        thirsty = wat === 0;
      }
      // Fire on the animal: water puts it out at once; else it burns for AlightHours of
      // in-world time and takes BurnDamage a second. Burning animals don't heal.
      let burning = W.aAlight[s] > 0;
      if (burning) {
        if (W.wDepth[W.aTile[s]] > 0) { W.aAlight[s] = 0; burning = false; }
        else W.aAlight[s] = Math.max(0, W.aAlight[s] - 1 / AS.TICKS_PER_HOUR);
      }
      let hp = W.aHP[s];
      if (burning) hp -= S.BurnDamage * dt;
      if (full === 0) hp -= S.StarveDamage * dt;
      // A dry animal doesn't heal, or a wolf's HealRate would outweigh its small ThirstDamage forever.
      else if (full > S.HealAbove * S.FullnessMax && hp < S.HPMax && !thirsty && !burning) hp = Math.min(S.HPMax, hp + S.HealRate * dt);
      if (thirsty) hp -= S.ThirstDamage * dt;
      const deep = W.wDepth[W.aTile[s]] > (S.WadeDepth || 0) && S.SwimCost != null;
      if (deep && W.aStamina[s] === 0) hp -= S.DrownDamage * dt;
      W.aHP[s] = hp;
      if (hp <= 0 || W.aAge[s] >= S.Lifespan) { AS.killAnimal(sim, s, bodyCause(sim, s, burning)); continue; }

      if (deep) {
        W.aSprint[s] = 0;
        const st = W.aStamina[s] - S.SwimCost * dt;
        if (st <= 0) { W.aStamina[s] = 0; W.aWinded[s] = 1; } else W.aStamina[s] = st;
      } else if (W.aSprint[s]) {
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
        decide(sim, s, states[sp]);
        W.aDecideLeft[s] += 1 / S.DecidePerSec;
      }
      const wade = S.WadeDepth || 0, swimming = W.wDepth[W.aTile[s]] > wade;
      if (swimming && !AS.swimsNow(sim, s)) { AS.wadeOut(sim, s); continue; }
      if (W.aState[s] !== NO_STATE) states[sp][W.aState[s]].act(sim, s);
      // Swimming with nowhere to go (a plain wander, say) is no reason to stay in: out.
      if (swimming && W.aAlive[s] && W.wDepth[W.aTile[s]] > wade && W.aStepLeft[s] <= 0 && W.aTargetTile[s] < 0) AS.wadeOut(sim, s);
    }
  };
})(globalThis.AS);
