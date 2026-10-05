// The fixed tick. Sim time only moves here, in steps of DT, so a run is the same at every
// speed and on every machine; main.js decides how many ticks to run per frame.
(function (AS) {
  'use strict';

  AS.TICK_HZ = 30;
  AS.DT = 1 / AS.TICK_HZ;        // seconds of sim time per tick
  AS.DAY_SECONDS = 20;           // DESIGN.md: 1 day = 20 s at 1×
  AS.DT_DAYS = AS.DT / AS.DAY_SECONDS;
  // Hourly rolls are spread over this many ticks, one slice of tiles per tick.
  AS.TICKS_PER_HOUR = AS.TICK_HZ * AS.DAY_SECONDS / 24;
  if (!Number.isInteger(AS.TICKS_PER_HOUR)) throw new Error('TICK_HZ × DAY_SECONDS must divide into 24 hours');

  // Events, written by the sim, read by render.js (which acts them out as poses). A ring:
  // readers keep their own cursor. GRAZE is a bunny biting grass, or a wolf chewing it.
  AS.EV = Object.freeze({ BITE: 1, BIRTH: 2, DEATH: 3, GRAZE: 4 });
  const EVENT_RING = 4096;

  // opts.grassAges 'mixed' starts each blade at a random age (and the Size that age grows
  // to) instead of StartGrassAge, and opts.bodies 'mixed' starts each animal at a random
  // Fullness, so some are hungry and hunting or seeking food from the first second. Both
  // make a benchmark world cost what a world mid-run does. opts.layout overrides
  // settings.csv's StartLayout.
  // Population history, one sample per in-world hour (counts at the start of that hour; humans are never placed at the start, so their series starts at 0),
  // for the graph. It grows by doubling, so a long run costs a few bytes per hour.
  const HISTORY_START = 24 * 64;

  function History() {
    const h = { length: 0, cap: HISTORY_START };
    h.grass = new Uint32Array(h.cap);
    h.bunnies = new Uint32Array(h.cap);
    h.wolves = new Uint32Array(h.cap);
    h.humans = new Uint32Array(h.cap);
    h.push = function (g, b, w, hu) {
      if (h.length === h.cap) {
        h.cap *= 2;
        for (const k of ['grass', 'bunnies', 'wolves', 'humans']) { const a = new Uint32Array(h.cap); a.set(h[k]); h[k] = a; }
      }
      h.grass[h.length] = g; h.bunnies[h.length] = b; h.wolves[h.length] = w; h.humans[h.length] = hu;
      h.length++;
    };
    return h;
  }

  AS.Sim = function (T, seed, opts) {
    const rng = AS.makeRng(seed);
    const W = AS.World(T);
    // history.length samples; sample i is the start of in-world hour i (day i / 24).
    const history = History();
    const events = {
      type: new Uint8Array(EVENT_RING),
      tile: new Int32Array(EVENT_RING),
      size: EVENT_RING,
      written: 0,     // total ever written; slot is written % size
    };

    const sim = {
      T, seed, W, rng, events, history,
      tickCount: 0,
      get simSeconds() { return sim.tickCount * AS.DT; },
      get day() { return sim.tickCount * AS.DT_DAYS; },
    };

    sim.emit = function (type, tile) {
      const i = events.written++ % EVENT_RING;
      events.type[i] = type;
      events.tile[i] = tile;
    };

    populate(sim, opts || {});

    sim.tick = function () {
      if (sim.tickCount % AS.TICKS_PER_HOUR === 0) history.push(W.gCount, W.bunnies, W.wolves, W.humans);
      AS.corpseTick(sim);
      AS.grassTick(sim);
      AS.warrenTick(sim);
      AS.animalsTick(sim);
      sim.tickCount++;
    };

    return sim;
  };

  // DESIGN.md "Setup": grass scattered evenly, then animals on random empty tiles.
  // One shuffle of all tiles feeds both, so nothing lands on a taken tile.
  function populate(sim, opts) {
    const { T, W, rng } = sim;
    // Meadows (start.js) lays out a lived-in world; Scatter, or opts.layout 'scatter' (the
    // benchmark, which needs evenly spread load), scatters everything evenly at random.
    const layout = opts.layout || T.world.StartLayout;
    if (layout === 'Meadows' || layout === 'meadows') { AS.startMeadows(sim, opts); return; }
    const order = new Int32Array(W.n);
    for (let i = 0; i < W.n; i++) order[i] = i;
    let k = 0;
    function nextTile() {
      const j = k + rng.int(W.n - k);
      const t = order[j];
      order[j] = order[k];
      order[k++] = t;
      return t;
    }
    const blades = Math.round(W.n * T.world.StartGrass);
    const mixed = opts.grassAges === 'mixed';
    for (let i = 0; i < blades; i++) {
      const age = mixed ? rng.next() * T.grass.Lifespan : T.world.StartGrassAge;
      W.addGrass(nextTile(), Math.min(1, T.grass.SproutSize + age * T.grass.GrowthRate), age);
    }
    // A species places animals only once its behavior is built (AS.speciesReady).
    if (AS.speciesReady('bunny')) {
      for (let i = 0; i < T.world.StartBunnies; i++) AS.spawnStarting(sim, AS.SPECIES.BUNNY, nextTile(), opts.bodies);
    }
    if (AS.speciesReady('wolf')) {
      for (let i = 0; i < T.world.StartWolves; i++) AS.spawnStarting(sim, AS.SPECIES.WOLF, nextTile(), opts.bodies);
    }
  }

  // ?debug only: drops a corpse, clearing a blade if one is there. Corpses have no other
  // source until animals exist.
  AS.debugDropCorpse = function (sim, t, species) {
    const W = sim.W;
    if (W.kind[t] === AS.KIND.GRASS) W.removeGrass(t);
    if (W.kind[t] !== AS.KIND.EMPTY) return false;
    W.addCorpse(t, species, AS.CAUSE.DEBUG);
    AS.corpseAdded(sim, t);
    return true;
  };
})(globalThis.AS);
