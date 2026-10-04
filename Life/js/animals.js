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
  const IMPL = AS.STATE_IMPL = { bunny: null, wolf: null };

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

  // One step to an empty 4-neighbor, if the last step has finished. Returns whether it
  // moved. The step's time comes from the speed at the moment it starts.
  AS.stepTo = function (sim, s, t2) {
    const W = sim.W;
    if (W.aStepLeft[s] > 0 || W.kind[t2] !== KIND.EMPTY) return false;
    if (W.hole[t2] && W.aSpecies[s] === AS.SPECIES.WOLF) return false;   // a hole is a wall to wolves
    const v = AS.speedOf(sim, s);
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

  // Moves toward a 4-neighbor that may hold grass (DESIGN.md: wolves chew through grass
  // when that's quicker). Empty: step. Grass: bite it down, no food, a grazing-sized mark;
  // the step comes on a later tick once the blade is gone. Returns whether it moved.
  AS.chewOrStep = function (sim, s, t2) {
    const W = sim.W;
    if (W.kind[t2] === KIND.EMPTY) return AS.stepTo(sim, s, t2);
    if (W.kind[t2] !== KIND.GRASS || W.aStepLeft[s] > 0 || W.aBiteLeft[s] > 0) return false;
    const S = AS.speciesStats(sim, s);
    if (!(S.BiteSize > 0)) return false;
    AS.grassBite(sim, t2, S.BiteSize);
    W.aBiteLeft[s] = S.BiteCooldown;
    sim.emit(EV.GRAZE, t2);
    return false;
  };

  // One bite of an adjacent animal: BiteDamage, and no food. A wolf eats the carcass its
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
      AS.killAnimal(sim, prey);
      W.aKills[s]++;
    }
    return true;
  };

  AS.killAnimal = function (sim, s) {
    const W = sim.W, t = W.aTile[s], sp = W.aSpecies[s];
    W.removeAnimal(s);
    W.addCorpse(t, sp);
    AS.corpseAdded(sim, t);
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

  function decide(sim, s, key) {
    const W = sim.W, list = sim.T.states[key], impl = IMPL[key];
    for (let i = 0; i < list.length; i++) {
      const st = impl[list[i].name];
      if (st.enter(sim, s)) {
        if (W.aState[s] !== i) {
          W.aState[s] = i;
          W.aTargetTile[s] = -1;
          W.aTargetSlot[s] = -1;
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
      let full = W.aFullness[s] - S.HungerRate * dt;
      if (full < 0) full = 0;
      W.aFullness[s] = full;
      let hp = W.aHP[s];
      if (full === 0) hp -= S.StarveDamage * dt;
      else if (full > S.HealAbove * S.FullnessMax && hp < S.HPMax) hp = Math.min(S.HPMax, hp + S.HealRate * dt);
      W.aHP[s] = hp;
      if (hp <= 0 || W.aAge[s] >= S.Lifespan) { AS.killAnimal(sim, s); continue; }

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
      if (W.aState[s] !== NO_STATE) IMPL[key][T.states[key][W.aState[s]].name].act(sim, s);
    }
  };
})(globalThis.AS);
