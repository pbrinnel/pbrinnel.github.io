'use strict';
// PLAY (play.js): tiny hand-built worlds. The chances are raised so a session starts at the
// first decision; nothing here depends on the shipped values.
const { stage, tally, quiet, editCSV, at, tick, secs, stateName } = require('./kit.js');
const { ok, done } = tally();

function make(size, seed, edit) {
  const r = stage({ size, seed, play: true, species: [quiet.grass, quiet.hunger, quiet.digging], edit: tx => {
    for (const sp of ['Bunny', 'Wolf']) {
      tx.species = editCSV(tx.species, 'PlayChance', sp, '1000');
      tx.species = editCSV(tx.species, 'PlayChanceAdult', sp, '1000');
    }
    if (edit) edit(tx);
  } });
  return r;
}
function animal(AS, sim, species, x, y, o = {}) {
  const W = sim.W, S = sim.T[AS.SPECIES_KEY[species]];
  const s = AS.spawnStarting(sim, species, at(W, x, y));
  W.aAge[s] = o.age ?? S.TimeToMature + 1;
  W.aFullness[s] = o.full ?? S.FullnessMax;
  W.aDecideLeft[s] = 0;
  W.aSex[s] = AS.SEX.MALE;   // two of a sex, so nobody goes off to mate
  return s;
}
// Gives b a first state without letting it decide again, as if it were wandering about.
function idleUntilAsked(AS, sim, b) {
  const W = sim.W, list = sim.T.states[AS.SPECIES_KEY[W.aSpecies[b]]];
  W.aState[b] = list.findIndex(st => st.name === 'WANDER' || st.name === 'PROWL');
  W.aDecideLeft[b] = 1e9;
}
const playing = (AS, sim, s) => stateName(AS, sim, s) === 'PLAY';

// A lone bunny plays alone: a binky, paying PlayJoyAlone, never past WellbeingMax.
{
  const { AS, sim, W, T } = make(30, 1);
  const B = T.bunny, s = animal(AS, sim, AS.SPECIES.BUNNY, 15, 15);
  tick(sim, secs(AS, 1));
  ok(playing(AS, sim, s) && AS.playKind(sim, s) === AS.PLAY.BINKY && AS.playPartner(sim, s) === -1, `alone: a lone bunny binkies (${stateName(AS, sim, s)})`);
  let first = -1;
  for (let i = 0, n = secs(AS, B.PlaySeconds.max + 2); i < n; i++) { tick(sim); if (first < 0 && !playing(AS, sim, s)) first = i / AS.TICK_HZ; }
  ok(first > 0 && first <= B.PlaySeconds.max + 0.5 && first >= B.PlaySeconds.min - 0.5, `alone: a session lasts PlaySeconds (${first.toFixed(1)} s)`);
  ok(W.aWellbeing[s] > 0 && W.aWellbeing[s] <= B.WellbeingMax + 1e-9, `alone: wellbeing rose within WellbeingMax (${W.aWellbeing[s].toFixed(2)})`);
}

// Pairs: the invitation is taken, both play with each other near where they began, a busy
// animal ignores it, and a session costs Stamina.
for (const [species, name] of [['BUNNY', 'bunny'], ['WOLF', 'wolf']]) {
  {
    const { AS, sim, W, T } = make(40, 3);
    const S = T[name], a = animal(AS, sim, AS.SPECIES[species], 20, 20), b = animal(AS, sim, AS.SPECIES[species], 22, 20);
    idleUntilAsked(AS, sim, b);   // b never decides: only an invitation can move it
    tick(sim, secs(AS, 0.5));
    ok(playing(AS, sim, a) && playing(AS, sim, b), `${name} pair: invited one joined (${stateName(AS, sim, a)}, ${stateName(AS, sim, b)})`);
    ok(AS.playPartner(sim, a) === b && AS.playPartner(sim, b) === a, `${name} pair: partners point at each other`);
    const start = [W.aTile[a], W.aTile[b]];
    let far = 0, moved = false;
    const kinds = new Set();
    for (let i = 0, n = secs(AS, S.PlaySeconds.min - 0.5); i < n; i++) {
      tick(sim);
      for (const [s, t0] of [[a, start[0]], [b, start[1]]]) {
        const dx = W.aTile[s] % W.w - t0 % W.w, dy = ((W.aTile[s] / W.w) | 0) - ((t0 / W.w) | 0);
        far = Math.max(far, Math.hypot(dx, dy));
        if (W.aTile[s] !== t0) moved = true;
      }
      kinds.add(AS.playKind(sim, a));
    }
    // A wolf pair that picked a wrestle closed in during the first half second, before start.
    const wrestled = kinds.has(AS.PLAY.WRESTLE);
    ok(moved || wrestled, `${name} pair: they move around each other`);
    ok(far <= S.PlayRange + 1, `${name} pair: they stay within PlayRange of where they began (${far.toFixed(1)})`);
    ok(![...kinds].includes(AS.PLAY.NONE) && (kinds.has(AS.PLAY.CHASE) || wrestled), `${name} pair: kinds seen ${[...kinds]}`);
    ok(W.aStamina[a] < S.StaminaMax, `${name} pair: playing spent Stamina (${W.aStamina[a].toFixed(1)})`);
    ok(W.aWellbeing[a] > 0 && W.aWellbeing[a] <= S.WellbeingMax + 1e-9, `${name} pair: wellbeing rose (${W.aWellbeing[a].toFixed(2)})`);
  }
  {
    const { AS, sim, W } = make(40, 4);
    const a = animal(AS, sim, AS.SPECIES[species], 20, 20), b = animal(AS, sim, AS.SPECIES[species], 22, 20, { full: 0 });
    idleUntilAsked(AS, sim, b);
    tick(sim, secs(AS, 0.5));
    ok(AS.playPartner(sim, a) === -1 && !playing(AS, sim, b), `${name} busy: a hungry one is not invited`);
  }
}

// A wolf needs a partner; a baby and an adult can pair (the young invite adults).
{
  const { AS, sim } = make(40, 5);
  const w = animal(AS, sim, AS.SPECIES.WOLF, 20, 20);
  tick(sim, secs(AS, 2));
  ok(!playing(AS, sim, w), `a lone wolf doesn't play (${stateName(AS, sim, w)})`);
}
{
  const { AS, sim, W, T } = make(40, 6, tx => { tx.species = editCSV(tx.species, 'PlayChanceAdult', 'Bunny', '0'); });
  const kid = animal(AS, sim, AS.SPECIES.BUNNY, 20, 20, { age: 0 }), adult = animal(AS, sim, AS.SPECIES.BUNNY, 21, 20);
  idleUntilAsked(AS, sim, adult);
  tick(sim, secs(AS, 0.5));
  ok(playing(AS, sim, kid) && playing(AS, sim, adult), 'a baby\'s invitation pulls in an adult whose own chance is 0');
}

// Nobody plays at 0.
{
  const { AS, sim } = make(40, 7, tx => { for (const sp of ['Bunny', 'Wolf']) { tx.species = editCSV(tx.species, 'PlayChance', sp, '0'); tx.species = editCSV(tx.species, 'PlayChanceAdult', sp, '0'); } });
  const a = animal(AS, sim, AS.SPECIES.BUNNY, 20, 20), b = animal(AS, sim, AS.SPECIES.BUNNY, 21, 20);
  tick(sim, secs(AS, 5));
  ok(!playing(AS, sim, a) && !playing(AS, sim, b), 'PlayChance 0: nobody plays');
}
done('ALL PASS');
