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
  const SP_COUNT = AS.SPECIES_COUNT;
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
  // Meters of water addWater lays when not told a depth.
  const LAID_DEPTH = 1;
  // Tiles across a block of the animal counts (W.anyNear).
  const NEAR_BLOCK = 8;

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
      // How many holes are within the bunny's HomeRange of each tile (a circle), kept by
      // addHole and removeHole: a tile with any is "home" (bunny.js); null with no HomeRange.
      holeNear: T.bunny && T.bunny.HomeRange > 0 ? new Uint16Array(n) : null,
      hList: new Int32Array(n),
      hSlot: new Int32Array(n).fill(-1),
      hCount: 0,

      // Scorched ground, by tile: days left. A nuke sets it (god.js), the hourly grass pass counts
      // it down (grass.js). While it is above 0 no blade may stand, seed or sprout there and no
      // hole may be dug; animals walk over it. Only a ground property, so `kind` is untouched.
      scorch: new Float32Array(n),

      // How deep the water on a tile is, in meters (0 on land). Any depth makes the tile water.
      wDepth: new Float32Array(n),
      // River mouths: 1 where water leaves the map (terrain.js), or null in a world without water.
      outlet: null,
      // The water rules running this world's water (AS.Water, water.js), or null: a world made
      // with Water off, whose water (laid by hand, in the checks) stays as laid.
      water: null,
      wetFlips: 0,      // tiles that have turned wet or dry (setDepth)
      wetMoved: false,  // a shore moved since water.js last rebuilt the way-to-water field

      // Height of the ground in meters (0 to settings.csv Relief), laid once at world build
      // by terrain.js. Lakes and rivers are where it holds and drains water.
      elev: new Float32Array(n),

      // The beach: land tiles 4-adjacent to water (1 = beach), kept by addWater and setDepth. An
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

      // How many of each species are in each NEAR_BLOCK × NEAR_BLOCK block, kept by
      // addAnimal, removeAnimal and moveAnimal: a search for hunters or prey can first ask
      // anyNear whether any are about, and skip its scan when none are (most of the time).
      nearCount: new Uint16Array(Math.ceil(w / NEAR_BLOCK) * Math.ceil(h / NEAR_BLOCK) * SP_COUNT),
    };
    const nearCols = Math.ceil(w / NEAR_BLOCK);
    const blockOf = t => (((t / w) | 0) / NEAR_BLOCK | 0) * nearCols + ((t % w) / NEAR_BLOCK | 0);
    // Whether any animal of the species in `mask` (bit = species code) is within `range` tiles
    // of tile t (a square, so a circle's search can trust a no).
    W.anyNear = function (t, range, mask) {
      const x = t % w, y = (t / w) | 0, r = Math.ceil(range);
      const bx0 = Math.max(0, x - r) / NEAR_BLOCK | 0, bx1 = Math.min(w - 1, x + r) / NEAR_BLOCK | 0;
      const by0 = Math.max(0, y - r) / NEAR_BLOCK | 0, by1 = Math.min(h - 1, y + r) / NEAR_BLOCK | 0;
      const C = W.nearCount;
      for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
        const b = (by * nearCols + bx) * SP_COUNT;
        for (let sp = 0; sp < SP_COUNT; sp++) if (((mask >> sp) & 1) && C[b + sp] > 0) return true;
      }
      return false;
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

    // A tile can be claimed when nothing is on it. `wet` also allows unoccupied water (an
    // animal wading in).
    function claim(t, kind, wet) {
      const k = W.kind[t];
      if (k !== KIND.EMPTY && !(wet && k === KIND.WATER)) throw new Error(`tile ${t} is taken (kind ${W.kind[t]})`);
      W.kind[t] = kind;
    }
    // What a tile shows when whatever was on it leaves: water if it has any, else bare ground.
    function free(t) { W.kind[t] = W.wDepth[t] > 0 ? KIND.WATER : KIND.EMPTY; }

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

    // Water's depth on a tile, as the water rules (water.js) move it during play. Getting
    // wet drowns a blade, floods a warren hole and puts out scorched ground; a corpse must
    // already be gone (corpse.js lets its grass boost go first); an animal stays (it wades, or
    // moving.js walks it out if the water is too deep for it). A tile with nothing on it
    // shows as water while it has any. The bare beach follows the shore: a blade on land that
    // comes to touch water dies. wetFlips counts shores moved, for whatever caches a picture
    // of them (render.js's topo lines); wetMoved tells water.js to rebuild the way-to-water
    // field.
    const nbs4 = new Int32Array(4), nbs4b = new Int32Array(4);
    W.setDepth = function (t, d) {
      const was = W.wDepth[t] > 0, now = d > 0;
      W.wDepth[t] = now ? d : 0;
      if (was === now) return;
      if (now) {
        if (W.kind[t] === KIND.CORPSE) throw new Error(`tile ${t}: remove the corpse before the water comes`);
        W.waterCount++;
        if (W.kind[t] === KIND.GRASS) W.removeGrass(t);
        if (W.hole[t]) W.removeHole(t);
        W.scorch[t] = 0;   // ground under water isn't burning
        if (W.kind[t] === KIND.EMPTY) W.kind[t] = KIND.WATER;
      } else {
        W.waterCount--;
        if (W.kind[t] === KIND.WATER) W.kind[t] = KIND.EMPTY;
      }
      W.wetFlips++;
      W.wetMoved = true;
      refreshBeach(t);
      for (let i = 0, k = W.neighbors4(t, nbs4); i < k; i++) refreshBeach(nbs4[i]);
    };
    function refreshBeach(u) {
      let beach = 0;
      if (!(W.wDepth[u] > 0)) for (let i = 0, k = W.neighbors4(u, nbs4b); i < k; i++) if (W.wDepth[nbs4b[i]] > 0) { beach = 1; break; }
      W.beach[u] = beach;
      if (beach && W.kind[u] === KIND.GRASS) W.removeGrass(u);
    }

    // Water laid on an empty tile, `depth` meters deep (LAID_DEPTH when not given: the
    // checks' hand-built worlds): at world build (terrain.js), before anything else is placed.
    W.addWater = function (t, depth) {
      if (W.hole[t] || W.scorch[t] > 0) throw new Error(`tile ${t} can't take water`);
      claim(t, KIND.WATER);
      W.wDepth[t] = depth > 0 ? depth : LAID_DEPTH;
      if (W.water) { W.water.H[t] = W.wDepth[t]; W.water.listWet(); }   // the rules move it from here
      W.waterCount++;
      W.waterStale = true;
      refreshBeach(t);
      for (let i = 0, k = W.neighbors4(t, nbs4); i < k; i++) refreshBeach(nbs4[i]);
    };

    // Multi-source breadth-first search over land from every shore tile, so a thirsty animal
    // anywhere knows which way the water is in O(1). It runs on first need after the lakes
    // are in (animals.js calls it before any thirst work), and again when marked stale: by
    // addWater, and by water.js once a step when shores have moved. A tile with an animal
    // wading on it is water here too.
    W.buildWaterField = function () {
      W.waterStale = false;
      if (!W.wDist) { W.wDist = new Uint16Array(n); W.wNext = new Int32Array(n); W.wShore = new Int32Array(n); }
      const dist = W.wDist, next = W.wNext, shore = W.wShore, queue = new Int32Array(n), nb = new Int32Array(4);
      dist.fill(WATER_NONE); next.fill(-1); shore.fill(-1);
      let head = 0, tail = 0;
      const D = W.wDepth;
      for (let t = 0; t < n; t++) {
        if (D[t] > 0) continue;
        const k = W.neighbors4(t, nb);
        for (let i = 0; i < k; i++) {
          if (D[nb[i]] > 0) { dist[t] = 0; shore[t] = t; queue[tail++] = t; break; }
        }
      }
      while (head < tail) {
        const t = queue[head++], k = W.neighbors4(t, nb);
        for (let i = 0; i < k; i++) {
          const u = nb[i];
          if (dist[u] !== WATER_NONE || D[u] > 0) continue;
          dist[u] = dist[t] + 1; next[u] = t; shore[u] = shore[t];
          queue[tail++] = u;
        }
      }
    };
    W.ensureWaterField = () => { if (W.waterStale || !W.wDist) W.buildWaterField(); };

    // Digs a hole on tile t. Bare ground only: no blade on it, no wolf standing there, no water, not scorched.
    W.addHole = function (t, usedAt) {
      if (W.hole[t]) throw new Error(`tile ${t} is already a hole`);
      if (W.kind[t] === KIND.GRASS || W.kind[t] === KIND.WATER || (W.kind[t] >= KIND.BUNNY && W.kind[t] !== KIND.BUNNY)) throw new Error(`tile ${t} can't be dug (kind ${W.kind[t]})`);
      if (W.scorch[t] > 0) throw new Error(`tile ${t} is scorched; it can't be dug`);
      W.hole[t] = 1;
      W.holeUsedAt[t] = usedAt || 0;
      W.hSlot[t] = W.hCount;
      W.hList[W.hCount++] = t;
      markHome(t, 1);
    };
    function markHome(t, d) {
      if (!W.holeNear) return;
      const R = T.bunny.HomeRange, r = Math.floor(R), R2 = R * R, cx = t % w, cy = (t / w) | 0;
      for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++) {
        for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 <= R2) W.holeNear[y * w + x] += d;
        }
      }
    }

    // A collapsed hole is bare ground again. Whatever stands on it stays.
    W.removeHole = function (t) {
      if (!W.hole[t]) throw new Error(`no hole on tile ${t}`);
      const i = W.hSlot[t], last = W.hList[--W.hCount];
      W.hList[i] = last;
      W.hSlot[last] = i;
      W.hSlot[t] = -1;
      W.hole[t] = 0;
      W.holeUsedAt[t] = 0;
      markHome(t, -1);
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
      free(t);
      W.serial[t] = 0;
      W.cNut[t] = 0;
      W.cMeat[t] = 0;
      W.cAge[t] = 0;
      W.cCause[t] = 0;
    };

    // Returns the new slot. The caller fills in the rest of the animal's fields.
    W.addAnimal = function (t, species, sex) {
      if (W.hole[t] && !AS.canEnterHole(species)) throw new Error(`tile ${t} is a warren hole; only bunnies can enter`);
      claim(t, AS.kindOf(species), true);   // painted into water: it wades, or moving.js walks it out
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
      W.nearCount[blockOf(t) * SP_COUNT + species]++;
      return s;
    };

    W.removeAnimal = function (s) {
      const t = W.aTile[s];
      W.aAlive[s] = 0;
      W.aSlot[t] = -1;
      free(t);
      W[POP_KEY[W.aSpecies[s]]]--;
      W.nearCount[blockOf(t) * SP_COUNT + W.aSpecies[s]]--;
      W.aFree.push(s);
    };

    // Steps an animal to an empty tile, or into water (how deep is the caller's rule:
    // moving.js canStand). The caller times the step (aStepLeft, aStepDur).
    W.moveAnimal = function (s, t2) {
      const t = W.aTile[s];
      if (W.hole[t2] && !AS.canEnterHole(W.aSpecies[s])) throw new Error(`tile ${t2} is a warren hole; only bunnies can enter`);
      claim(t2, W.kind[t], true);
      free(t);
      const b1 = blockOf(t), b2 = blockOf(t2);
      if (b1 !== b2) { W.nearCount[b1 * SP_COUNT + W.aSpecies[s]]--; W.nearCount[b2 * SP_COUNT + W.aSpecies[s]]++; }
      W.aSlot[t] = -1;
      W.aSlot[t2] = s;
      W.aFrom[s] = t;
      W.aTile[s] = t2;
    };

    return W;
  };
})(globalThis.AS);
