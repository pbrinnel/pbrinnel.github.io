// The human's states (states.csv, Species = Human). A human hunts, rests and roams with the
// same states wolves do (wolf.js, AS.hunterStates: FEED, HUNT, GIVE_UP, REST, PROWL), steered
// by species.csv's Prey and EatsCarcass rows; its numbers (slow, huge Stamina, a chase it
// rarely gives up) are what make it a marathon hunter. The one state of its own is FORAGE:
// with no meat or prey in sight, a hungry human eats grass. Humans never breed, so there is
// no MATE state.
(function (AS) {
  'use strict';

  const K = AS.KIND;
  const { walkToward, prowlStep, calmStart } = AS.hunterKit;

  // FORAGE's blade per human, by slot (-1 none); like the wolf's choices, read by act() after
  // the decide loop has cleared the target fields.
  const memOf = new WeakMap();
  function food(W) {
    let m = memOf.get(W);
    if (!m) m = { food: new Int32Array(0) };
    if (m.food.length < W.aCap) {
      const a = new Int32Array(W.aCap).fill(-1);
      a.set(m.food);
      m.food = a;
      memOf.set(W, m);
    }
    return m.food;
  }

  let mW = null;
  const isBlade = t => mW.kind[t] === K.GRASS;

  const states = {
    // "Walk (chewing through grass) to the nearest blade; bite an adjacent blade for GrassFood
    // each BiteCooldown." Runs only below HungryAt and below FEED and HUNT, so meat and prey
    // always come first. A blade next to it is eaten whatever it was walking to.
    FORAGE: {
      enter(sim, s) {
        if (!AS.isHungry(sim, s)) return false;
        const W = sim.W;
        if (AS.bestAdjacentBlade(W, W.aTile[s]) >= 0) { food(W)[s] = -1; return true; }
        mW = W;
        const t = AS.nearestVisible(sim, W.aTile[s], AS.speciesStats(sim, s).VisionRange, isBlade);
        if (t < 0) return false;
        food(W)[s] = t;
        return true;
      },
      start: calmStart,
      act(sim, s) {
        const W = sim.W, fm = food(W);
        const next = AS.bestAdjacentBlade(W, W.aTile[s]);
        if (next >= 0) {
          W.aTargetTile[s] = next;
          W.aTargetSlot[s] = -1;
          if (W.aBiteLeft[s] <= 0) AS.grazeBite(sim, s, next);
          return;
        }
        let blade = fm[s];
        if (blade >= 0 && W.kind[blade] !== K.GRASS) blade = fm[s] = -1;
        W.aTargetTile[s] = blade;
        W.aTargetSlot[s] = -1;
        if (blade < 0) { prowlStep(sim, s); return; }
        if (W.aStepLeft[s] > 0) return;
        // No way there: let the next decision choose, and wander meanwhile.
        if (!walkToward(sim, s, blade)) { fm[s] = -1; W.aTargetTile[s] = -1; prowlStep(sim, s); }
      },
    },
  };

  AS.registerStates('human', { ...AS.hunterStates, ...states });
})(globalThis.AS);
