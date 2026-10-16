// PLAY, the state bunnies and wolves share (states.csv: between REST and WANDER / PROWL).
// A fed, rested animal off on no trip rolls PlayChance (young) or PlayChanceAdult a day at
// each decision that would otherwise have reached WANDER/PROWL; a win starts a session of
// PlaySeconds. The roller invites the nearest same-species animal within PlayRange that is
// only wandering, prowling or resting; that one joins at once. A bunny with nobody near plays
// alone (a binky, PlayJoyAlone); a species with no PlayJoyAlone (wolves) needs a partner.
//
// A session pays Wellbeing as it goes (PlayJoy over its length, so one that is cut short by
// anything higher in the list, or by the partner leaving, pays in part and needs no hook),
// capped at WellbeingMax, and drains Stamina at PlayStamina a second on top of the usual
// refill, so an animal that just played has less sprint.
//
// What render will need (the hop, twist and wrestle are its job): AS.playKind(sim, s) and
// AS.playPartner(sim, s). Both are derived from the clock, never stored, so they are always
// in step with where the animals are.
(function (AS) {
  'use strict';

  // The look of a session right now. BINKY: hopping and twisting (alone, or a bunny pair
  // close together); CHASE: one darting after the other; WRESTLE: a wolf pair close together.
  const KINDS = AS.PLAY = Object.freeze({ NONE: 0, BINKY: 1, CHASE: 2, WRESTLE: 3 });

  // Partners swap who chases every PLAY_SWAP sim seconds, and the chase is the first
  // PLAY_CHASE_SHARE of each turn; the rest of it they stand together. On the sim clock, so
  // both read the same phase.
  const PLAY_SWAP = 6;
  const PLAY_CHASE_SHARE = 0.6;
  // Only these states are "not busy": an animal in any other ignores an invitation.
  const IDLE_STATES = ['WANDER', 'PROWL', 'REST'];
  // A session timer within this of 0 is over (DT has no exact binary value).
  const LEFT_EPS = 1e-9;

  const nb = new Int32Array(4);

  // ---- per-animal session memory, by slot ------------------------------------------------
  const memOf = new WeakMap();
  function mem(W) {
    let m = memOf.get(W);
    if (!m) { m = { cap: 0 }; memOf.set(W, m); }
    if (m.cap < W.aCap) {
      const grow = (old, Ctor) => { const a = new Ctor(W.aCap); if (old) a.set(old); return a; };
      m.forSerial = grow(m.forSerial, Uint32Array);  // the serial this session belongs to; another = none
      m.left = grow(m.left, Float64Array);           // sim seconds of session left
      m.len = grow(m.len, Float64Array);             // its whole length, to pay PlayJoy in proportion
      m.partner = grow(m.partner, Int32Array);       // the partner's slot; -1 = alone
      m.anchor = grow(m.anchor, Int32Array);         // where it was when the session began
      m.startAt = grow(m.startAt, Float64Array);     // sim.simSeconds the pair's clock started (the inviter's start)
      m.lead = grow(m.lead, Uint8Array);             // 1 = the inviter (chases first)
      m.cap = W.aCap;
    }
    return m;
  }

  // ---- table facts, per table set ----------------------------------------------------------
  // playIdx[sp]: the PLAY state's index, -1 for a species without one. idle[sp][i]: state i is
  // one an invitation can interrupt. hazard[sp] = [young, adult] chance per decision.
  let cacheT = null, playIdx = null, idle = null, hazard = null;
  function cache(T) {
    if (cacheT === T) return;
    cacheT = T;
    playIdx = []; idle = []; hazard = [];
    AS.SPECIES_KEY.forEach((k, sp) => {
      const list = T.states[k] || [], S = T[k];
      playIdx[sp] = list.findIndex(st => st.name === 'PLAY');
      idle[sp] = Uint8Array.from(list, st => (IDLE_STATES.includes(st.name) ? 1 : 0));
      // PlayChance is a rate that may exceed 1 a day, so a decision's chance is the
      // Poisson one, 1 - exp(-rate per decision), not digHazard's share of a probability.
      const perDay = S.DecidePerSec * AS.DAY_SECONDS;
      const per = r => (r > 0 ? 1 - Math.exp(-r / perDay) : 0);
      hazard[sp] = [per(S.PlayChance), per(S.PlayChanceAdult)];
    });
  }

  const adjacent = (W, a, b) => Math.abs((a % W.w) - (b % W.w)) <= 1 && Math.abs(((a / W.w) | 0) - ((b / W.w) | 0)) <= 1;

  // Fed, watered and (when asked) rested. A trip is the species' own business (opts.onTrip).
  function content(sim, s, S, opts, staminaFloor) {
    const W = sim.W;
    if (AS.isHungry(sim, s)) return false;
    if (W.waterCount > 0 && W.aWater[s] < S.ThirstyAt * S.WaterMax) return false;
    if (W.aStamina[s] < staminaFloor * S.StaminaMax) return false;
    return !opts.onTrip(sim, s);
  }

  // Whether slot s has a session going that its partner (if any) is still part of.
  function live(sim, s, m) {
    const W = sim.W;
    if (m.forSerial[s] !== W.aSerial[s] || !(m.left[s] > LEFT_EPS)) return false;
    const p = m.partner[s];
    if (p < 0) return true;
    return W.aAlive[p] && W.aState[p] === playIdx[W.aSpecies[p]] && m.forSerial[p] === W.aSerial[p] && m.left[p] > LEFT_EPS && m.partner[p] === s;
  }

  // ---- the invitation ---------------------------------------------------------------------
  let mSim = null, mW = null, mSelf = 0, mOpts = null;
  // A tile holding a same-species animal that is idle and content enough to join.
  const isJoiner = t => {
    const W = mW;
    if (W.kind[t] !== AS.kindOf(W.aSpecies[mSelf])) return false;
    const p = W.aSlot[t];
    if (p === mSelf || !idle[W.aSpecies[p]][W.aState[p]]) return false;
    const S = AS.speciesStats(mSim, p);
    // A resting animal may join only once it would get up anyway (its Stamina is above RestBelow).
    return content(mSim, p, S, mOpts, S.RestBelow);
  };

  function begin(m, s, serial, len, partner, anchor, startAt, lead) {
    m.forSerial[s] = serial; m.left[s] = len; m.len[s] = len; m.partner[s] = partner;
    m.anchor[s] = anchor; m.startAt[s] = startAt; m.lead[s] = lead;
  }

  function join(sim, j, inviter, len, startAt) {
    const W = sim.W, m = mem(W);
    begin(m, j, W.aSerial[j], len, inviter, W.aTile[j], startAt, 0);
    W.aState[j] = playIdx[W.aSpecies[j]];
    W.aTargetTile[j] = -1; W.aTargetSlot[j] = -1;
    AS.edgeReset(W, j);
    AS.setSprint(sim, j, false);
    W.aRunLeft[j] = 0;
  }

  // ---- moving about each other -------------------------------------------------------------
  // Whether the pair is in its chase phase, and whether s is the one chasing, now.
  function roles(sim, s, m) {
    const el = sim.simSeconds - m.startAt[s], turn = Math.floor(el / PLAY_SWAP);
    return { chasing: el - turn * PLAY_SWAP < PLAY_CHASE_SHARE * PLAY_SWAP, chaser: ((turn & 1) === 0) === (m.lead[s] === 1) };
  }

  // One greedy step: the neighbor that gets s nearest to (toward) or farthest from the goal
  // tile, within PlayRange of where the session began (and wherever opts.stayOk allows), or
  // none when nothing beats standing still. Greedy is enough: a session is a few seconds.
  function stepAbout(sim, s, goal, toward, S, opts, m) {
    const W = sim.W, w = W.w, t = W.aTile[s], k = W.neighbors4(t, nb);
    const gx = goal % w, gy = (goal / w) | 0, ax = m.anchor[s] % w, ay = (m.anchor[s] / w) | 0;
    const d2 = c => { const dx = (c % w) - gx, dy = ((c / w) | 0) - gy; return dx * dx + dy * dy; };
    const r2 = S.PlayRange * S.PlayRange;
    let best = -1, bestD = d2(t);
    for (let i = 0; i < k; i++) {
      const c = nb[i], ox = (c % w) - ax, oy = ((c / w) | 0) - ay;
      if (ox * ox + oy * oy > r2 || !opts.stayOk(W, s, t, c) || !AS.canEnter(sim, s, c)) continue;
      if (W.hole[c] && !AS.canEnterHole(W.aSpecies[s])) continue;
      const d = d2(c);
      if (toward ? d < bestD : d > bestD) { best = c; bestD = d; }
    }
    if (best >= 0) AS.stepTo(sim, s, best);
  }

  // ---- what render reads --------------------------------------------------------------------
  // The look of s's session now (AS.PLAY), NONE when it isn't playing.
  AS.playKind = function (sim, s) {
    const W = sim.W, m = mem(W);
    cache(sim.T);
    if (W.aState[s] !== playIdx[W.aSpecies[s]] || !live(sim, s, m)) return KINDS.NONE;
    const p = m.partner[s];
    if (p < 0) return KINDS.BINKY;
    const close = adjacent(W, W.aTile[s], W.aTile[p]);
    if (close && !roles(sim, s, m).chasing) return OPTS_OF[W.aSpecies[s]].closeKind;
    return KINDS.CHASE;
  };
  // The slot s plays with, or -1 (alone, or not playing).
  AS.playPartner = function (sim, s) {
    const W = sim.W, m = mem(W);
    cache(sim.T);
    return W.aState[s] === playIdx[W.aSpecies[s]] && live(sim, s, m) ? m.partner[s] : -1;
  };

  // ---- the state ------------------------------------------------------------------------------
  // opts: onTrip(sim, s) → bool (the species' own trips); stayOk(W, s, from, to) → bool (a
  // bunny already at home stays home); closeKind: the look of a pair standing together.
  const OPTS_OF = [];
  AS.playState = function (species, opts) {
    OPTS_OF[species] = opts;
    return {
      enter(sim, s) {
        const W = sim.W, S = AS.speciesStats(sim, s), sp = W.aSpecies[s], m = mem(W), serial = W.aSerial[s];
        cache(sim.T);
        // Going on: the session isn't over, its partner is still in it, and nothing it needs
        // has come up. Everything higher in the list has already had its say.
        if (W.aState[s] === playIdx[sp] && live(sim, s, m)) return content(sim, s, S, opts, 0);
        if (!content(sim, s, S, opts, S.RestUntil)) return false;
        const h = hazard[sp][AS.stageOfSlot(sim, s) === AS.STAGE.BABY ? 0 : 1];
        if (!(h > 0) || !(h >= 1 || sim.rng.chance(h))) return false;
        mSim = sim; mW = W; mSelf = s; mOpts = opts;
        const t = AS.nearestVisibleAnimal(sim, W.aTile[s], S.PlayRange, 1 << sp, isJoiner);
        if (t < 0 && !(S.PlayJoyAlone > 0)) return false;
        const len = S.PlaySeconds.min + sim.rng.next() * (S.PlaySeconds.max - S.PlaySeconds.min);
        const j = t < 0 ? -1 : W.aSlot[t];
        begin(m, s, serial, len, j, W.aTile[s], sim.simSeconds, 1);
        if (j >= 0) join(sim, j, s, len, sim.simSeconds);
        return true;
      },
      start(sim, s) {
        AS.setSprint(sim, s, false);
        sim.W.aRunLeft[s] = 0;
      },
      act(sim, s) {
        const W = sim.W, S = AS.speciesStats(sim, s), m = mem(W);
        AS.setSprint(sim, s, false);
        if (!live(sim, s, m)) { W.aTargetTile[s] = -1; W.aTargetSlot[s] = -1; W.aDecideLeft[s] = 0; return; }
        m.left[s] -= AS.DT;
        const st = W.aStamina[s] - S.PlayStamina * AS.DT;
        W.aStamina[s] = st > 0 ? st : 0;
        const p = m.partner[s];
        AS.raiseWellbeing(sim, s, (p < 0 ? S.PlayJoyAlone : S.PlayJoy) * AS.DT / m.len[s], S.WellbeingMax);
        if (!(m.left[s] > LEFT_EPS)) { W.aTargetTile[s] = -1; W.aTargetSlot[s] = -1; W.aDecideLeft[s] = 0; return; }
        if (p < 0) { W.aTargetTile[s] = -1; W.aTargetSlot[s] = -1; return; }   // a binky stays where it is
        const pt = W.aTile[p];
        W.aTargetTile[s] = pt; W.aTargetSlot[s] = p; W.aTargetSerial[s] = W.aSerial[p];
        if (W.aStepLeft[s] > 0) return;
        const r = roles(sim, s, m), close = adjacent(W, W.aTile[s], pt);
        // The chaser closes in; the chased runs while the chase lasts; together they stand.
        if (r.chaser) { if (!close) stepAbout(sim, s, pt, true, S, opts, m); }
        else if (r.chasing) stepAbout(sim, s, pt, false, S, opts, m);
      },
    };
  };
})(globalThis.AS);
