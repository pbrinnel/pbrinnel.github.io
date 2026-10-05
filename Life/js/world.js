// The grid and every agent store, as flat typed arrays (struct of arrays).
//
// One thing per tile, so `kind` is the truth about who is where. Only the add/remove/move
// functions in this file write `kind`, `aSlot` or the dense lists; everything else writes
// its own fields and calls these to change occupancy, so the grid can't drift from the
// stores.
//
// Blades and corpses never move, so their fields are indexed by tile. Animals move, so
// they live in stable slots (a free list, never compacted): a slot index stays valid for
// an animal's whole life, and `serial` tells a reused slot or tile from the old occupant.
(function (AS) {
  'use strict';

  // WATER sits below the animal kinds because the code tells an animal by `kind >= BUNNY`;
  // every other test asks for EMPTY or for one named kind, so water is simply "taken".
  const KIND = AS.KIND = Object.freeze({ EMPTY: 0, GRASS: 1, CORPSE: 2, WATER: 3, BUNNY: 4, WOLF: 5, HUMAN: 6 });
  // Animal species codes, used in `aSpecies` and `cSpecies`. The kind of a species' animals
  // is ANIMAL_KIND0 + its code, so a new species is one entry in each list below.
  const SP = AS.SPECIES = Object.freeze({ BUNNY: 0, WOLF: 1, HUMAN: 2 });
  AS.SPECIES_KEY = Object.freeze(['bunny', 'wolf', 'human']);
  AS.SPECIES_COUNT = AS.SPECIES_KEY.length;
  AS.ANIMAL_KIND0 = KIND.BUNNY;
  AS.kindOf = species => KIND.BUNNY + species;
  // The world's live head count of each species, by code (W.bunnies, W.wolves, W.humans).
  const POP_KEY = AS.POP_KEY = Object.freeze(['bunnies', 'wolves', 'humans']);
  // Only bunnies may stand on a warren hole; to every other species it is a wall.
  AS.canEnterHole = species => species === SP.BUNNY;
  AS.SEX = Object.freeze({ MALE: 0, FEMALE: 1 });

  // Why a corpse is a corpse (W.cCause, shown by the inspector's Cause row). A kill is ATTACKED
  // plus the biter's species code, so a new species needs no new cause.
  AS.CAUSE = Object.freeze({ UNKNOWN: 0, OLD_AGE: 1, STARVED: 2, THIRST: 3, STARVED_THIRSTY: 4, DEBUG: 5, ATTACKED: 16 });

  const ANIMAL_START_CAPACITY = 1024;
  // wDist for a tile no water can be reached from.
  const WATER_NONE = AS.WATER_NONE = 0xFFFF;

  // Fields of one animal, by array type. A new field is one line here. Countdown timers are
  // Float64: counted down by 1/30 s a tick, Float32 rounding lands a whole tick late.
  const ANIMAL_FIELDS = {
    aAlive: Uint8Array,
    aSerial: Uint32Array,
    aSpecies: Uint8Array,
    aSex: Uint8Array,
    aTile: Int32Array,     // where it is now (the grid points back via aSlot)
    aFrom: Int32Array,     // the tile it last stepped from, for gliding
    // A step from aFrom to aTile takes aStepDur seconds; drawing glides across it using
    // aStepLeft (seconds until the step is done and the next may start).
    aStepLeft: Float64Array,
    aStepDur: Float64Array,
    aAge: Float32Array,    // days
    aFullness: Float32Array,
    aWater: Float32Array,  // the water meter, like Fullness; drained and refilled by animals.js and DRINK
    aStamina: Float32Array,
    aHP: Float32Array,
    aState: Uint8Array,    // index into T.states[species]
    aSprint: Uint8Array,
    aWinded: Uint8Array,       // ran Stamina to 0; no sprinting until it's full again
    aTargetTile: Int32Array,   // -1 none; the intent line ends here
    aTargetSlot: Int32Array,   // -1 when the target isn't an animal
    aTargetSerial: Uint32Array,
    aRunDir: Uint8Array,
    aRunLeft: Uint16Array,
    aDecideLeft: Float64Array, // seconds until it re-picks its state
    aBiteLeft: Float64Array,
    aPregnant: Float32Array,   // days left; 0 = not pregnant
    aLitter: Uint8Array,       // babies waiting to be born
    aMateCd: Float32Array,     // days left
    aParentA: Uint32Array,     // serials; 0 = first generation
    aParentB: Uint32Array,
    aChildren: Uint16Array,
    aKills: Uint16Array,
  };

  AS.World = function (T) {
    const w = T.world.WorldWidth, h = T.world.WorldHeight, n = w * h;

    const W = {
      w, h, n,
      kind: new Uint8Array(n),
      serial: new Uint32Array(n),   // serial of the blade or corpse on a tile
      nextSerial: 1,                // 0 means "nobody", so serials start at 1

      // Grass, by tile. gList holds the live blades densely; gSlot is each tile's place in it.
      gSize: new Float32Array(n),
      gAge: new Float32Array(n),    // days
      gList: new Int32Array(n),
      gSlot: new Int32Array(n).fill(-1),
      gCount: 0,

      // Corpses, by tile, same pattern.
      cNut: new Float32Array(n),
      cMeat: new Float32Array(n),   // Fullness left on the body for wolves; written by addCorpse, wolf.js (eating)
      cAge: new Float32Array(n),    // days
      cCause: new Uint8Array(n),    // AS.CAUSE: how it died; written by addCorpse
      cSpecies: new Uint8Array(n),
      cList: new Int32Array(n),
      cSlot: new Int32Array(n).fill(-1),
      cCount: 0,

      // Warren holes, by tile. A hole is ground, not an occupant: the tile's `kind` stays
      // EMPTY (or a bunny, or a corpse that died there), so one-thing-per-tile is untouched.
      // Only bunnies may stand on one (stepTo, tryBirth, moveAnimal), and no blade grows on
      // one. holeUsedAt is the sim second a bunny last stood there; warren.js writes it.
      // hList holds the holes densely, hSlot is each tile's place in it.
      hole: new Uint8Array(n),
      holeUsedAt: new Float64Array(n),
      hList: new Int32Array(n),
      hSlot: new Int32Array(n).fill(-1),
      hCount: 0,

      // Scorched ground, by tile: days left. A nuke sets it (god.js), the hourly grass pass counts
      // it down (grass.js). While it is above 0 no blade may stand, seed or sprout there and no
      // hole may be dug; animals walk over it. Only a ground property, so `kind` is untouched.
      scorch: new Float32Array(n),

      // Grass growth multiplier by tile (1 = none), fixed at world build by setShore: the shore
      // of a lake grows grass faster. Static, so grass.js only reads it.
      shore: new Float32Array(n).fill(1),

      // The beach: land tiles 4-adjacent to water (1 = beach), kept up to date by addWater. An
      // animal drinks from one, so no blade may stand on one (addGrass refuses; grass.js, god.js
      // and start.js skip them), or a lakeshore of grass would wall the animals off the water.
      beach: new Uint8Array(n),

      // Water, by tile, found once by buildWaterField (below) and read by DRINK: the walking
      // distance to the nearest shore tile (a land tile touching water; 0 on one,
      // WATER_NONE where no water can be reached), the next tile of the way there (-1 on a
      // shore tile) and which shore tile that is. A guide only: it ignores animals, blades and
      // holes. waterCount is how many tiles are water; with none there is no thirst at all.
      waterCount: 0,
      waterStale: false,
      wDist: null, wNext: null, wShore: null,

      // The corpse tile that boosts each tile's grass, or -1. Written only by corpse.js.
      boostSrc: new Int32Array(n).fill(-1),

      // Animals, by slot. aSlot maps a tile to the animal on it.
      aSlot: new Int32Array(n).fill(-1),
      aCap: 0,
      aHigh: 0,          // slots 0 … aHigh-1 have been used; loops stop here
      aFree: [],         // freed slots, reused before aHigh grows
      bunnies: 0,
      wolves: 0,
      humans: 0,
    };

    function growAnimals(cap) {
      for (const [f, Ctor] of Object.entries(ANIMAL_FIELDS)) {
        const a = new Ctor(cap);
        if (W[f]) a.set(W[f]);
        W[f] = a;
      }
      W.aCap = cap;
    }
    growAnimals(ANIMAL_START_CAPACITY);

    W.tile = (x, y) => y * w + x;
    W.tx = t => t % w;
    W.ty = t => (t / w) | 0;
    W.inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
    W.isEmpty = t => W.kind[t] === KIND.EMPTY;

    // The four neighbors of tile t that are inside the world, written into out (an
    // Int32Array of 4). Returns how many. Walls at the edges, no wrap.
    W.neighbors4 = function (t, out) {
      const x = t % w, y = (t / w) | 0;
      let k = 0;
      if (y > 0) out[k++] = t - w;
      if (x < w - 1) out[k++] = t + 1;
      if (y < h - 1) out[k++] = t + w;
      if (x > 0) out[k++] = t - 1;
      return k;
    };

    function claim(t, kind) {
      if (W.kind[t] !== KIND.EMPTY) throw new Error(`tile ${t} is taken (kind ${W.kind[t]})`);
      W.kind[t] = kind;
    }

    W.addGrass = function (t, size, age) {
      if (W.hole[t]) throw new Error(`tile ${t} is a warren hole; no grass grows there`);
      if (W.scorch[t] > 0) throw new Error(`tile ${t} is scorched; no grass grows there`);
      if (W.beach[t]) throw new Error(`tile ${t} is beach (touches water); no grass grows there`);
      claim(t, KIND.GRASS);
      W.serial[t] = W.nextSerial++;
      W.gSize[t] = size;
      W.gAge[t] = age;
      W.gSlot[t] = W.gCount;
      W.gList[W.gCount++] = t;
    };

    W.removeGrass = function (t) {
      if (W.kind[t] !== KIND.GRASS) throw new Error(`no blade on tile ${t}`);
      const i = W.gSlot[t], last = W.gList[--W.gCount];
      W.gList[i] = last;
      W.gSlot[last] = i;
      W.gSlot[t] = -1;
      W.kind[t] = KIND.EMPTY;
      W.serial[t] = 0;
      W.gSize[t] = 0;
      W.gAge[t] = 0;
    };

    // Lakes, laid at world build only (start.js). Water is a tile kind of its own: nothing
    // enters, stands on, is born on, grows on or is dug into it, and it never changes.
    W.addWater = function (t) {
      if (W.hole[t] || W.scorch[t] > 0) throw new Error(`tile ${t} can't take water`);
      claim(t, KIND.WATER);
      W.waterCount++;
      W.waterStale = true;
      const nbw = new Int32Array(4), k = W.neighbors4(t, nbw);
      for (let i = 0; i < k; i++) W.beach[nbw[i]] = 1;
    };

    // Multi-source breadth-first search over land from every shore tile, so a thirsty animal
    // anywhere knows which way the water is in O(1). Water never changes after the world is
    // built, so this runs once, on first need after the lakes are in (animals.js calls it
    // before any thirst work); a later addWater marks it stale and it runs again.
    W.buildWaterField = function () {
      W.waterStale = false;
      if (!W.wDist) { W.wDist = new Uint16Array(n); W.wNext = new Int32Array(n); W.wShore = new Int32Array(n); }
      const dist = W.wDist, next = W.wNext, shore = W.wShore, queue = new Int32Array(n), nb = new Int32Array(4);
      dist.fill(WATER_NONE); next.fill(-1); shore.fill(-1);
      let head = 0, tail = 0;
      for (let t = 0; t < n; t++) {
        if (W.kind[t] === KIND.WATER) continue;
        const k = W.neighbors4(t, nb);
        for (let i = 0; i < k; i++) {
          if (W.kind[nb[i]] === KIND.WATER) { dist[t] = 0; shore[t] = t; queue[tail++] = t; break; }
        }
      }
      while (head < tail) {
        const t = queue[head++], k = W.neighbors4(t, nb);
        for (let i = 0; i < k; i++) {
          const u = nb[i];
          if (dist[u] !== WATER_NONE || W.kind[u] === KIND.WATER) continue;
          dist[u] = dist[t] + 1; next[u] = t; shore[u] = shore[t];
          queue[tail++] = u;
        }
      }
    };
    W.ensureWaterField = () => { if (W.waterStale) W.buildWaterField(); };

    // Land within `radius` tiles (a circle) of any water tile grows grass `boost` times faster.
    // Done once after the lakes are in, so no tick does distance work.
    W.setShore = function (radius, boost) {
      W.shore.fill(1);
      const R2 = radius * radius, reach = Math.floor(radius);
      for (let t = 0; t < n; t++) {
        if (W.kind[t] !== KIND.WATER) continue;
        const cx = t % w, cy = (t / w) | 0;
        // Only a lake's rim can reach land, and its rim's circles cover whatever the inner tiles' would.
        if ((cx > 0 && W.kind[t - 1] === KIND.WATER) && (cx < w - 1 && W.kind[t + 1] === KIND.WATER) &&
            (cy > 0 && W.kind[t - w] === KIND.WATER) && (cy < h - 1 && W.kind[t + w] === KIND.WATER)) continue;
        for (let y = Math.max(0, cy - reach); y <= Math.min(h - 1, cy + reach); y++) {
          for (let x = Math.max(0, cx - reach); x <= Math.min(w - 1, cx + reach); x++) {
            if ((x - cx) ** 2 + (y - cy) ** 2 <= R2) W.shore[y * w + x] = boost;
          }
        }
      }
    };

    // Digs a hole on tile t. Bare ground only: no blade on it, no wolf standing there, no water, not scorched.
    W.addHole = function (t, usedAt) {
      if (W.hole[t]) throw new Error(`tile ${t} is already a hole`);
      if (W.kind[t] === KIND.GRASS || W.kind[t] === KIND.WATER || (W.kind[t] >= KIND.BUNNY && W.kind[t] !== KIND.BUNNY)) throw new Error(`tile ${t} can't be dug (kind ${W.kind[t]})`);
      if (W.scorch[t] > 0) throw new Error(`tile ${t} is scorched; it can't be dug`);
      W.hole[t] = 1;
      W.holeUsedAt[t] = usedAt || 0;
      W.hSlot[t] = W.hCount;
      W.hList[W.hCount++] = t;
    };

    // A collapsed hole is bare ground again. Whatever stands on it stays.
    W.removeHole = function (t) {
      if (!W.hole[t]) throw new Error(`no hole on tile ${t}`);
      const i = W.hSlot[t], last = W.hList[--W.hCount];
      W.hList[i] = last;
      W.hSlot[last] = i;
      W.hSlot[t] = -1;
      W.hole[t] = 0;
      W.holeUsedAt[t] = 0;
    };

    // species is AS.SPECIES.*; the corpse's Nutrient, decay and boost come from that species.
    W.addCorpse = function (t, species, cause) {
      claim(t, KIND.CORPSE);
      W.cCause[t] = cause || 0;
      W.serial[t] = W.nextSerial++;
      W.cSpecies[t] = species;
      W.cNut[t] = T[AS.SPECIES_KEY[species]].CorpseNutrient;
      W.cMeat[t] = T[AS.SPECIES_KEY[species]].MeatOnBody;
      W.cAge[t] = 0;
      W.cSlot[t] = W.cCount;
      W.cList[W.cCount++] = t;
    };

    W.removeCorpse = function (t) {
      if (W.kind[t] !== KIND.CORPSE) throw new Error(`no corpse on tile ${t}`);
      const i = W.cSlot[t], last = W.cList[--W.cCount];
      W.cList[i] = last;
      W.cSlot[last] = i;
      W.cSlot[t] = -1;
      W.kind[t] = KIND.EMPTY;
      W.serial[t] = 0;
      W.cNut[t] = 0;
      W.cMeat[t] = 0;
      W.cAge[t] = 0;
      W.cCause[t] = 0;
    };

    // Returns the new slot. The caller fills in the rest of the animal's fields.
    W.addAnimal = function (t, species, sex) {
      if (W.hole[t] && !AS.canEnterHole(species)) throw new Error(`tile ${t} is a warren hole; only bunnies can enter`);
      claim(t, AS.kindOf(species));
      let s = W.aFree.length ? W.aFree.pop() : W.aHigh++;
      if (s >= W.aCap) growAnimals(W.aCap * 2);
      for (const f of Object.keys(ANIMAL_FIELDS)) W[f][s] = 0;
      W.aAlive[s] = 1;
      W.aSerial[s] = W.nextSerial++;
      W.aSpecies[s] = species;
      W.aSex[s] = sex;
      W.aTile[s] = t;
      W.aFrom[s] = t;
      W.aStepDur[s] = 1;
      W.aTargetTile[s] = -1;
      W.aTargetSlot[s] = -1;
      W.aSlot[t] = s;
      W[POP_KEY[species]]++;
      return s;
    };

    W.removeAnimal = function (s) {
      const t = W.aTile[s];
      W.aAlive[s] = 0;
      W.aSlot[t] = -1;
      W.kind[t] = KIND.EMPTY;
      W[POP_KEY[W.aSpecies[s]]]--;
      W.aFree.push(s);
    };

    // Steps an animal to an empty tile. The caller times the step (aStepLeft, aStepDur).
    W.moveAnimal = function (s, t2) {
      const t = W.aTile[s];
      if (W.hole[t2] && !AS.canEnterHole(W.aSpecies[s])) throw new Error(`tile ${t2} is a warren hole; only bunnies can enter`);
      claim(t2, W.kind[t]);
      W.kind[t] = KIND.EMPTY;
      W.aSlot[t] = -1;
      W.aSlot[t2] = s;
      W.aFrom[s] = t;
      W.aTile[s] = t2;
    };

    return W;
  };
})(globalThis.AS);
