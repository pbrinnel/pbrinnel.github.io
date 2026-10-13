# Life — code map

How the code is put together, so you can find things without reading everything. The spec
is DESIGN.md (and why it is so, HISTORY.md); the rules are CLAUDE.md. **Keep this file
true**: when you add a file, a field, an event, a tool or a step in the tick, update the
section it belongs in.

**Contents:** [Layout](#layout) · [Files](#files) · [Data](#data-struct-of-arrays-worldjs) ·
[Time](#time) · [Water](#water) · [Behavior](#behavior) · [Sprite poses](#sprite-poses-renderjs--spritesjs) ·
[The page](#the-page) · [Recipes](#recipes) · [Colors](#colors) · [Tools](#tools-_tools-run-from-the-repo-root) ·
[The tuning lab](#the-tuning-lab-_lab)

## Layout

```
life.html            the page (site root): elements, AS.V/BASE/FONT, every <script> in load order
Life/
  CLAUDE.md          rules     DESIGN.md  the spec     HISTORY.md  why: measurements, tuning     MAP.md  this
  style.css          all page styles (HUD, inspector, graph panel, benchmark overlay, errors)
  fonts/             DejaVu Sans Mono subset (woff2) + its license; all UI text
  tables/            species.csv, settings.csv, states.csv, variables.csv: every number
  js/                the sim and the page (below)
  _tools/            headless checks, the benchmark and screenshot drivers (tracked, unpublished)
  _lab/              the tuning lab, a local page + server (tracked, unpublished)
  _original-notes.txt  Paul's first sketch, history only
```

## Files

Plain scripts, no modules or bundler. Each file is an IIFE that adds to one global, `AS`.
`life.html` loads them in this order, and the order matters only for code that runs at
load time: every file reads other files' `AS.*` inside functions, at call time.

**The sim** (never touches the DOM, so the Node checks and the lab's workers run it unchanged):

| File | Role | Exports |
|---|---|---|
| `tables.js` | fetch + parse + validate the CSVs into frozen `T` | `loadTables`, `parseTables` |
| `rng.js` | seeded randomness (mulberry32); the only source the sim may use | `makeRng`, `newSeed` |
| `world.js` | the grid and every store (typed arrays, [Data](#data-struct-of-arrays-worldjs)) and the only code that changes occupancy; the species lists (`SPECIES`, `SPECIES_KEY`, `POP_KEY`, `kindOf`, `canEnterHole`): a species is one entry in each | `World`, `KIND`, `SPECIES`, `SPECIES_KEY`, `SPECIES_COUNT`, `POP_KEY`, `kindOf`, `canEnterHole`, `SEX` |
| `grass.js` | growth (an hour's worth), age, seeding (beside the blade, or carried 2..`SeedReach` to a spot with `SHELTER_MIN` grass neighbors, `SeedFar` of the time), sprouting on empty tiles, old age, all in hourly slices; scorch cooling; ash: weathering (`AshHalfLife`) and the `AshBoost` it gives, the larger of it and a corpse's, spent like Nutrient; roots: aging and resprouting; bites | `grassTick`, `grassBite`, `grassStage` |
| `corpse.js` | decay, and the boost field grass drinks from | `corpseTick`, `corpseAdded`, `corpseBoost` |
| `warren.js` | warren holes' clocks: marks a hole used while a bunny stands on it, collapses holes unused for `CollapseDays` (hourly) | `warrenTick`, `holeWithin` |
| `weather.js` | the world's wind (`sim.wind = { from, kmh, toX, toY }`, `sim.weather`): three mean-reverting walks per in-world hour around the world's typical wind (`Wind`, a range) and a prevailing direction from the seed, capped at typical × `WindSpells`, changing over `WindChangeHours`; its own generator (never `sim.rng`, so worlds play out the same whatever the wind does); `windWords`, `windFromName` for the UI. Rain, on a generator of its own: showers (`sim.weather.showers`, columns x, y, r in tiles, mmh, hours left), disks born over the map and a margin upwind, moving at the wind's speed, each tile getting intensity × the time its center is under one (exact chords) into `water.local`; births follow a spell walk (`RainSpellDays`, `RainSpread`), calibrated so the long-run mean is the world's `Rain`; `dryDays`, `rainToday`. Lightning: a shower is a storm with chance `StormShare` (× up to `DryStormBoost` in a dry spell, when a storm's rain shrinks toward `DryStormRain`); a storm strikes `StrikesPerHour` in a ring from its radius to `StrikeReach` × it, biased downwind (`StrikeAhead`), on a third generator; a strike on fuel lights with chance `AS.fireDryness`; `sim.weather.strikes` is a ring of the last `STRIKE_CAP` (tile, atSec, lit) for the drawing | `Wind`, `weatherTick`, `windWords`, `windFromName`, `WIND` |
| `sim.js` | the fixed tick, populate, events ring, population history | `Sim`, `TICK_HZ`, `DT`, `DAY_SECONDS`, `TICKS_PER_HOUR`, `EV`, `debugDropCorpse` |
| `fire.js` | fire, a Flow-layer agent: `ignite(sim, t)` (the one way a fire starts), `fireTick` (every `FIRE_EVERY` ticks: each burning tile ages and may light its 8 neighbors at `FireSpread` × fuel × soil dryness × wind ÷ distance per hour, then burns out to `FireScorchDays` of scorch and its `Ash` added to `W.ash`, a blade's roots kept with chance `RootSurvive`, its blade or corpse gone), `fireStage` (0..1 through its burn, for the drawing); rolls `sim.rng` only while something burns | `ignite`, `fireTick`, `fireStep`, `fireStage`, `FIRE` |
| `paint.js` | PAINT's powers: the brushes and the nuke ([The page](#the-page)) | `nuke`, `paintCircle` |
| `water.js` | the water rules ([Water](#water)) | `Water`, `waterTick`, `syncWater`, `TILE_M`, `WATER_TINY`, `WATER_STEP_DAYS` |
| `terrain.js` | every world's ground, grown before day 0, and its first water ([Water](#water)) | `growTerrain`, `layTerrain`, `terrainOf`, `terrainShape` |
| `terrain-worker.js` | not a page script: main.js runs it as a Worker to grow a world off the main thread ([Water](#water)) | — |
| `start.js` | the Meadows day-0 layout (`StartLayout`): the ground and water first (`AS.layTerrain`), then meadow grass (never on the beach) aged by depth, bunny colonies at meadow edges, wolf packs in the open (never humans); uses only `sim.rng` | `startMeadows` |
| `sight.js` | line of sight through grass, nearest visible thing, local paths (plain and weighted for chewing) | `lineOfSight`, `nearestVisible`, `nearestVisibleAnimal`, `nearestVisibleIn`, `pathNext`, `pathNextWeighted` |
| `animals.js` | every animal's body (hunger, thirst, healing, stamina, swimming's cost, age), the decide loop, bites, death, spawning; `relations(T)` (who hunts and eats whom); the shared grass bite `grazeBite` | `animalsTick`, `registerStates`, `checkStates`, `speciesStats`, `speedOf`, `setSprint`, `biteAnimal`, `killAnimal`, `spawnStarting`, `relations`, `grazeBite`, `bestAdjacentBlade`, … |
| `moving.js` | how animals get from tile to tile: steps and their time, wading and swimming, chewing through grass, going around, walking out of deep water | `stepTo`, `chewOrStep`, `chewSeconds`, `canStand`, `canEnter`, `wadeOf`, `swimsNow`, `edgeStep`, `edgeReset`, `wadeOut` |
| `drink.js` | the DRINK state every species shares | `drinkState` |
| `escape.js` | the ESCAPE state every species shares (fire within `FireSense`, or alight: a bunny makes for a free hole nearer than the fire and sits in it, one alight for water it knows, the rest run straight away), the nearest burning tile, and the run-away step FLEE shares; draws nothing and costs nothing while no tile burns and nobody is alight | `escapeState`, `nearestFire`, `runFrom` |
| `breed.js` | mating and births, shared by the species that breed (a species with no `LitterSize`, humans, never mates); the female's territory rule (`PackLimit`/`TerritoryRange`) in `canMate` | `canMate`, `mate`, `tryBirth` |
| `bunny.js`, `wolf.js`, `human.js` | each species' states, by the names in `states.csv` ([Behavior](#behavior)). wolf.js's FEED, HUNT, GIVE_UP, REST and PROWL are the hunter states (`AS.hunterStates`), so human.js registers them too and adds FORAGE | (register via `AS.registerStates`) |
| `glyphs.js` | ids (named for the font glyphs the map was first drawn with), the palette, and life stage (`stageOf`), shared by the sprites, the far view and the HUD | `GLYPH`, `COLORS`, `animalGlyph`, `grassGlyph`, `STAGE`, `stageOf` |

**The page:**

| File | Role | Exports |
|---|---|---|
| `sprites.js` | the 8×8 pixel-art sprites as bitmaps, the pose-priority rule, per-slot facing, the pre-rendered sprite sheet ([Sprite poses](#sprite-poses-renderjs--spritesjs)) | `SpriteSheet`, `spritePose`, `spriteIndex`, `SpriteFacing`, `SPRITE_FRAME`, `SPRITE_HOLD`, `spriteNuke`, … |
| `camera.js` | pan/zoom/pinch/wheel/keys, tap → tile; zoomed in, the view pans up to `OVERSCROLL` of itself past the world's edge; `cam.strokes` makes a one-pointer drag call `onStroke` (the brush) instead of panning | `Camera` |
| `render.js` | draws the world: tiles from the sprite sheet, or cell mode zoomed out (its brighter far-view colors at the top); scorch, topo lines, the outside past the edge (`OUTSIDE`, `EDGE_LINE`), locate rings, the nuke's blast, the Radius preview; animals glide and act out events; intent lines; selection; water's look fades between states over `WATER_FADE_MS` (a list of fading tiles, both views); weather: soil wetness levels −3..+3 from `G / room` (a dark veil when wet, straw grass sprites when dry, both views, eased over `SOIL_FADE_MS` with hysteresis), rain streaks in cells under showers held `STREAK_HOLD_MS`, a lightning bolt from `sim.weather.strikes` at most every `BOLT_GAP_MS` | `Renderer`, `CELL_PX`, `glideProgress` |
| `inspect.js` | `variables.csv` → the inspector's rows for a selection | `describe`, `inspectWarnings` |
| `drag.js` | `Draggable(panel, handle, key)`: drag a floating window by its title bar (computer only), kept on screen and remembered per viewer; double-click resets; `place(x, y)` pins it | `Draggable` |
| `graph.js` | the population graph window, from `sim.history` | `Graph`, `graphMath` |
| `minimap.js` | the minimap window | `Minimap` |
| `bench.js` | benchmark mode (grass series, animal series) | `runBench`, `benchMath` |
| `ui-parts.js` | the small DOM helpers the windows share (`el`, `cachedText`, `fmtInt`) | `uiParts` |
| `cards.js` | the end-of-run card, the "That's a crowd" card, the error page | `Cards` |
| `properties.js` | the properties window (`#inspector`) | `PropertiesWindow` |
| `paint-tab.js` | the PAINT tab's modes and Radius slider | `PaintTab` |
| `ui.js` | the bar, the tab windows and their Info and Debug controls, the keys, `hud()`; builds the parts above and hands them on through `ui` ([The page](#the-page)) | `UI` |
| `main.js` | boot, the frame loop, selection, wiring, the brush and the soft limit on painted animals ([The page](#the-page)) | `app`, `TICK_BUDGET_MS` |

## Data: struct of arrays (`world.js`)

`W = sim.W`. Tiles are `t = y * W.w + x`, and a tile has layers (DESIGN.md, World):
- **Solid:** `W.kind[t]` (`AS.KIND`: EMPTY, GRASS, CORPSE, BUNNY, WOLF, HUMAN; an animal's
  kind is `AS.kindOf(species)`), at most one per tile, the truth about who is where. Animals
  tell their own kind by `kind >= BUNNY`.
- **Flow:** `W.flow[t]` (`AS.FLOW`: NONE, WATER, FIRE), at most one per tile; water's
  amount is `wDepth`; fire's state is `fireAge`/`fireTime` (hours) with a dense list
  `fList`/`fSlot`/`fCount`, written only by `addFire`/`removeFire` (taking the blade or
  corpse, or water arriving, puts the fire out). A burning blade neither grows nor seeds. A
  burning tile holds a blade, a corpse, or nothing (a painted ember, `EmberHours`); fire never
  spreads onto bare ground by itself. A burning *animal* carries its fire as `aAlight` (hours
  left), not in the flow layer: it catches from a burning neighbor (`FireSpread` ×
  `CatchFire` × wind ÷ distance) or from `ignite`, loses `BurnDamage` HP/s, doesn't heal, is
  put out by water, and if it dies alight its corpse is lit (cause BURNED for a death by
  fire). `canStand` allows only no flow or shallow water, so nothing walks into fire. `W.isBare(t)`: no solid and no flow (where a blade sprouts, a
  hole is dug, a baby is born, a brush paints); `W.isOpenWater(t)`: water with nothing in it.
- **Ground:** height (`elev`), holes, scorch, beach, and the soil water (`W.water.G`).
- **Air:** the world's wind (`sim.wind`, weather.js).

- **Blades** are indexed by tile (they never move): `gSize`, `gAge` (days), plus a dense
  list `gList[0..gCount)` with `gSlot[t]` for O(1) removal.
- **Warren holes**, by tile: `hole` (1 = a hole), `holeUsedAt` (sim seconds a bunny last
  stood there), dense `hList`/`hSlot`/`hCount`. A hole is *ground*, not an occupant: the
  tile's `kind` stays EMPTY (or BUNNY, or a corpse that died there), so one-thing-per-tile
  is untouched. Only bunnies may enter one (`stepTo`, `tryBirth`, `moveAnimal` and
  `addAnimal` refuse any other species, via `AS.canEnterHole`; hunter pathing costs a hole
  `Infinity`), nothing grows on one (`addGrass` throws; grass.js skips holes), and a bunny
  on one can't be bitten (`biteAnimal`) or picked as prey (wolf.js `isPrey`).
  `addHole`/`removeHole` are world.js's; `holeUsedAt` is written by warren.js and by
  DIG/start. `W.holeNear` counts holes within a bunny's `HomeRange` of each tile (kept by
  `addHole`/`removeHole`).
- **Water**, by tile: `wDepth` (meters, 0 on land), `beach`, and the water field (`wDist`,
  `wNext`, `wShore`); see [Water](#water).
- **Scorch**, by tile: `scorch` (Float32, days left); set by `nuke`, counted down by the
  hourly grass pass; `addGrass` and `addHole` refuse a scorched tile.
- **Flip log**: `W.flipLog`, a ring of the last `FLIP_LOG` tiles that turned wet or dry (world.js
  `setDepth`), so the topo-line cache re-checks only the squares those tiles touch.
- **Sunk blades**, by tile: `sunk`, `sunkSize`, `sunkAge`, `sunkCount`, `soak` (hours wet or
  beach): a blade the water or beach reaches is taken off the tile and kept here, and comes
  back as it was if the tile dries within `DrownHours`; world.js, water.js.
- **Ash**, by tile: `ash` (Float32, grass Size units); added by fire.js `burnOut`, weathered
  and spent on boosted growth by the hourly grass pass, cleared by water (`setDepth`,
  `addWater`) and by a nuke.
- **Roots**, by tile: `roots` (0/1) and `rootAge` (days, the burnt plant's age, still
  counting); set by fire.js `burnOut` (`RootSurvive`), aged and resprouted by the hourly
  grass pass (`ResproutChance`, dying at the grass Lifespan), cleared by `addGrass`, water,
  `addHole` and a nuke.
- **Corpses**, by tile: `cCause` (`AS.CAUSE`: old age, starved, thirst, both, debug, or
  `ATTACKED` plus the biter's species code; set by `addCorpse`, shown as the inspector's
  Cause row), `cNut`, `cMeat` (Fullness left on the body, set from `MeatOnBody` by
  `addCorpse`, eaten down by wolf.js's FEED, zeroed with the corpse), `cAge`, `cSpecies`,
  dense `cList`/`cSlot`/`cCount`; `boostSrc[t]` = the corpse tile boosting tile t, or −1.
- **Animals** live in stable slots (`0..aHigh`, free list `aFree`, never compacted), so a
  slot index is valid for a whole life; `aSerial[s]` tells a reused slot from its old
  occupant. Every field is an `a*` array (see `ANIMAL_FIELDS` in world.js, one line per
  field). `W.aSlot[t]` maps a tile to its animal.
- **Who's near:** each species' animals in each `NEAR_BLOCK`² block, as a linked list
  (`W.nearHead`, the slots' `aNearNext`/`aNearPrev`), kept by `addAnimal`/`removeAnimal`/
  `moveAnimal`. `W.animalsNear(t, range, speciesMask)` puts the slots in the blocks around t
  into `W.nearFound`; `W.anyNear` says whether there are any. sight.js
  `nearestVisibleAnimal(sim, from, range, mask, match)` answers as `nearestVisible` would
  from those few animals (sorted into the circle's own tie order), and `nearestVisibleIn`
  does the same from a dense list (`cList` for carcasses, `hList` for holes). Every search
  for hunters, prey, mates and companions uses them; sight-check proves they pick the tile
  the sweep would.
- **Identity:** anything that remembers another agent stores slot (or tile) **and** serial,
  and checks the serial before trusting it (selection, targets, fathers).

**Who writes what.** Only `world.js`'s add/remove/move functions change `kind`, `aSlot` or
the dense lists. Grass fields: grass.js. Hole fields: world.js (`addHole`/`removeHole`),
`holeUsedAt` also warren.js. Corpse fields and `boostSrc`: corpse.js (`cMeat` also
wolf.js, FEED). Water: water.js through world.js `setDepth`/`addWater`. Animal fields:
animals.js, moving.js, drink.js, escape.js, breed.js, bunny.js, wolf.js, human.js. Everything else (render, inspect,
graph, ui, bench) only reads.

## Time

- **Tick:** fixed `AS.DT` = 1/30 s of sim time (`TICK_HZ`); a day is `DAY_SECONDS` = 20 s.
  `sim.tick()` does, in order: record history at the start of each in-world hour →
  `weatherTick` → `corpseTick` → `grassTick` → `warrenTick` → `waterTick` → `fireTick` → `animalsTick`.
- **Grass:** growth/age/seed/sprout/old-age once per in-world hour, spread over
  `TICKS_PER_HOUR` ticks by tile (`t % TICKS_PER_HOUR`).
- **Water:** a step every `STEP_TICKS` ticks ([Water](#water)).
- **Animals:** body every tick (age, hunger, thirst, starve/heal, stamina + winded,
  swimming, timers), decide every 1/`DecidePerSec` s (random phase per animal), then the
  current state's `act` every tick. Timers are Float64 and snap to 0 within 1e-9 so
  cooldowns last exactly their CSV value.
- **Frame loop (main.js):** each frame runs as many ticks as speed × real time asks,
  within `TICK_BUDGET_MS` (12 ms); past that a fixed speed falls behind and the HUD shows
  the speed actually reached. Then one draw. Drawing never changes the sim, so a seed
  replays exactly at any speed.
- **Determinism:** same tables + same seed → same run, in the page, the Node harness, the
  terrain worker and the lab's workers (checked). Only `sim.rng` may roll dice; never
  `Math.random` in sim code.

## Water

- **The ground** (terrain.js): `W.elev`, meters, grown before day 0. `AS.terrainOf` draws the
  world's own values from the settings' ranges; `pattern` (warped noise: where the ground
  rises fastest); `growGround` (coarse then fine `Grower` rounds: uplift with a rim, routing
  by `steepest` descent with dips filled (`fillDip`) or the full `flood`, implicit stream
  power, creep; water leaves only at `mouths`); lake basins pressed in; stretched to
  `Relief`. Own generator from the seed. `AS.growTerrain(sim, water)` returns
  `{ S, water, elev, outlet, H, G }`; `AS.layTerrain(sim, water, grown)` lays it into the
  world (growing it first if `grown` is missing or for the other water setting): `W.elev`,
  `W.outlet`, `W.water` (the rules, whose `H` is surface water and `G` soil water; dry when
  Rain is 0; with rain a `restingLevel` first guess and the rules for `PreRunDays` first),
  and every wet tile through `addWater`.
- **In the background** (terrain-worker.js): main.js `growInWorker` posts the tables, seed
  and water setting; the worker imports rng, world, sim, water and terrain itself (with
  `?v=`), runs `growTerrain` and transfers the arrays back; `AS.Sim`'s `opts.terrain` hands
  them to `layTerrain`. No Worker (a page opened as a file) → the page grows it.
- **The rules** (water.js): `AS.Water(grid, S, outlet)` → `{ H, G, step(days),
  preRun(days), listWet }`: rain, soaking in, springs, evaporation, transpiration
  (`exchange`), surface flow (Manning, `surface`, only over wet tiles), soil flow (Darcy,
  `soil`, from the precomputed soil floor); stability caps on every exchange; out only at
  river mouths. Every step is the exchange, one surface move and one soil move, so every
  look sees the water at the same point of a step. Before day 0 (`preRun`):
  `SPINUP_STEP_DAYS` steps, then `SETTLE_DAYS` of play's. In play, `waterTick` runs a step
  every `STEP_TICKS` ticks (`WATER_STEP_DAYS`) and `syncWater` makes `W.wDepth` and the
  tiles match `H` (corpses through `corpseRemove`, the rest through world.js `setDepth`),
  and marks the way-to-water field stale every `FIELD_STEPS` steps when shores moved.
- **Depth is the truth:** `W.wDepth` in meters (0 on land; drawn by `AS.waterBand`:
  shallow, mid, deep). With no rules (a world made with Water off, as the checks'
  hand-built ones are) water stays as laid. A wet tile's flow is WATER (only `setDepth` and
  `addWater` write `flow`); its solid layer is empty or a wading animal, nothing else: `setDepth`
  drowns a blade, removes a hole and scorch as a tile gets wet (a corpse is removed first,
  by `syncWater`), and `killAnimal` leaves no corpse in water. `addWater(t, depth)` lays
  water on a bare tile (and into `W.water` if there is one). `W.waterCount` counts wet
  tiles; with none there is no thirst at all. `W.wetFlips` tells render.js which topo
  squares to work out again. `lineOfSight` ignores water. A nuke kills animals in it but
  leaves the water (no scorch).
- **The beach:** `W.beach` (Uint8) marks dry land 4-adjacent to water, kept by `addWater`
  and `setDepth` (which also drops a blade the moving shore reaches); no blade is ever on
  one (`addGrass` throws; grass.js seeding/sprouting, paint.js painting and start.js skip
  them), so animals can always reach the water.
- **The water field** (`buildWaterField`, on first need through `ensureWaterField`, again
  when `waterStale`): `wDist` (walking distance to the nearest beach tile, 0 on one,
  `AS.WATER_NONE` where unreachable), `wNext`, `wShore`; wet tiles (by depth) are its
  water; a guide that ignores animals and blades.
- **Wading and swimming** (moving.js): stepping is one rule, `AS.canStand(W, t, wade)`:
  an empty solid layer, dry or with water no deeper than `AS.wadeOf` (`WadeDepth`); stepTo, chewOrStep, `pathNext`
  (the walker is the animal on `from`), wolf.js's `cost`/`canWalk`/prowl and bunny.js's
  wander, flee and trips all use it. Births, grass, holes and painting (except WATER MODE)
  use bare tiles only (`isBare`). Deeper than it wades is swimming: `AS.canEnter(sim, s, t)` adds water it
  would swim now (`AS.swimsNow`: `SwimCost` set, not winded, Stamina above `RestBelow`, and
  either `SwimAt` reached (or already in) or fleeing, `AS.isFleeing` from bunny.js). A step
  from land into deep water also needs land two tiles ahead within the swimming reach of
  its Stamina (`crossable`); wolf.js re-plans on land when refused. The body tick
  (animals.js) drains `SwimCost` there and, at 0 Stamina, `DrownDamage` HP; `move` uses `SwimSpeed`. wolf.js
  `cost`/`canWalk` take swimmable water at `mInvSwim`; bunny.js FLEE steps use `canEnter`.
  An animal in deep water that isn't swimming now, or swims with no step under way and no
  target, runs `wadeOut` (the nearest standable tile within `OUT_RANGE`).
- **Thirst** (the meter in animals.js, DRINK in drink.js): `aWater` (like Fullness: `WaterMax`, drained each tick by
  `ThirstRate` times the same activity factor as hunger, only when the world has water; 0
  loses `ThirstDamage` HP/s and stops healing). **DRINK** is `AS.drinkState`, shared by
  every species' file: enters below `ThirstyAt` when wading or when `wDist` is within
  `WaterSense` (and stays until the meter is within one tick's burn of full), walks by one
  rule (the cheapest local walk to a free beach tile when one is within `VisionRange`,
  else the water field's next tile), drinks `DrinkRate` per s from its own tile if wading,
  else a wet neighbor (`waterAt`), takes the water from `W.water` (`drinkFrom`:
  `WaterLiters` a meter) and sets `aBiteLeft` per sip for the head-down pose. Priority:
  below ESCAPE, HIDE and FLEE for bunnies, below ESCAPE for wolves and humans.
- The harness audit checks all of this by layer: flow WATER exactly where `wDepth > 0`, a wet tile's solid empty or an animal, no blade, corpse, hole, scorch or beach on it.

## Behavior

- `states.csv` lists each species' states in priority order. The decide loop tries their
  `enter(sim, s)` in that order and switches to the first that says yes; `act(sim, s)` runs
  every tick. Reordering rows reorders behavior; `AS.checkStates` errors if the CSV and
  the code disagree on names. A species places animals only once its states are
  registered (`AS.speciesReady`).
- Movement goes only through `AS.stepTo` (empty tiles) or `AS.chewOrStep` (wolves into
  grass): both respect speed and one-thing-per-tile. Paths: `pathNext` (empty tiles only)
  and `pathNextWeighted` (cost per tile; wolves pay chew time for grass).
- **Who eats whom is data** (species.csv `Prey`, `EatsCarcass`; `AS.relations(T)`, bitmasks
  over species codes; `threat` is the reverse of `prey`): wolves hunt bunnies and humans,
  humans hunt bunnies and wolves, bunnies run from (FLEE/HIDE) every species that lists
  Bunny as prey. Wolves never eat wolf carcasses and humans never eat human ones. Humans are
  never placed at the start (only HUMAN MODE paints them), never breed (no `LitterSize`:
  `canMate` is false), forage grass when hungry with no meat or prey in sight (FORAGE,
  `GrassFood` per bite; blank = `BiteFood`, as bunnies; `grazeBite` is shared with bunny
  EAT), and can't enter holes or catch a bunny in one.
- A hunter's bite kills prey whose HP its `BiteDamage` covers (a human's always does; a
  wolf needs several bites on a human) and feeds nothing (`biteAnimal`); the body holds
  `MeatOnBody`. **FEED** (wolf.js, above HUNT): a hungry hunter that sees a carcass of a
  species it eats with `cMeat > 0` walks to a tile touching it and eats
  `min(BiteFood, cMeat, room)` every `BiteCooldown`, raising `aBiteLeft` (the renderer
  reads that as a mouthful); once feeding it stays until Fullness is `FullnessMax` or the
  meat is gone, past `HungryAt`. Its carcass is kept per wolf in `mem(W)`
  (`feedTile`/`feedSerial`).
- A hunting wolf remembers where it last saw its bunny: wolf.js keeps `seenTile`/`seenAt`
  per wolf in `mem(W)`, and while `TrackSeconds` (species.csv, 0 = off) allows it HUNT
  walks to that tile when the bunny is out of sight (`act` then uses `lineOfSight` instead
  of the bunny's true tile).
- **Desperate hunters** (animals.js, wolf.js): a hunter in PROWL that has seen no prey for
  `RoamAfter` days is roaming (`AS.isRoaming`, set by `prowlStep`); walking then burns
  `RoamHunger` times `HungerRate`.
- **Wandering leans toward room.** When a wander/prowl run starts, `pickRoomDir` (a copy in
  bunny.js and in wolf.js, which humans use) weights each open direction by
  `exp(-RoomPreference * c / (L/2))`, `c` = same-species animals in a box `L` =
  `VisionRange` tiles long reaching out that way; 0 = uniform random. Bunny FLEE's escape
  point is the best of straight-away and ±45°/±90° turns, scored by distance from the wolf
  minus a cost for path tiles at the world's edge (`AS.runFrom`, `RUN_*` in escape.js, which
  ESCAPE also uses to run from a fire).
- **Home and hiding** (bunny.js): `W.holeNear` says a tile is home (`atHome`); SEEK_FOOD
  looks at home only while at home, fed above `StrayAt` and not travelling (`mHomeOnly`);
  `wanderStep` remembers `home` and walks back (`edgeStep`) when strayed; a trip forgets
  it. HIDE holds `HideSeconds` after `threatAt` (set by `threatSeen`); HIDE and FLEE stand
  aside when `desperate` (`DesperateAt`). FLEE runs to a free hole within `HoleRange`,
  DIG makes new ones on bare ground.
- **Bunnies leave crowds** (bunny.js `emigrateStep`, inside `wanderStep`, so SEEK_FOOD with
  nothing to eat follows it too): per-bunny memory `awayTo`/`awayFor` (destination and the
  serial it belongs to), `lead`/`leadSerial` (a companion's leader; -1 leads itself).
  Starts at a run start, not elderly, with `LeaveCrowd`+ bunnies in the `VisionRange`
  square (`crowdAt`) at `LeaveChance` a day, and recruits the nearest visible bunny of the
  other sex not already away (`isCompanion`), which follows (`followStep`: waits within
  `FOLLOW_NEAR`, else `pathNext` to it, else `edgeStep`) and settles when its leader does
  or dies. The leader's destination (`farGoal`) is `RoamRun` away, near water if one of
  `GOAL_TRIES` is (`nearWater`: `wDist` ≤ `GOAL_WATER`); it paths within sight to a tile
  `AWAY_GAIN` nearer (`isNearerAway`), goes around (`edgeStep`) when no such tile is in
  sight, takes a new destination when there or when going around gives up, shows it as the
  target line, and every `SETTLE_EVERY` s settles if near water with ≤ `SettleCrowd` in the
  `SettleRange` square. LeaveChance 0 draws nothing.
- **Bunny stress** (bunny.js `stressNow`/`addStress`/`scared`): `stress`/`stressAt`/
  `scareAt`/`stressFor` per bunny, faded by `StressHalfLife` only when read or added to.
  FLEE's start adds `ScareStress` (not again within `SCARE_GAP` s), WANDER's start adds
  `HungerStress` when hungry (SEEK_FOOD found no blade). `emigrateStep` leaves at
  `LeaveStress` without the crowd roll, and zeroes stress.
- **Natal dispersal** (`DisperseChance`, `DisperseRun`): decided once a life (`dispFor`, by
  serial) at the first wander (bunny, in `emigrateStep`) or prowl (wolf, `prowlStep`) as an
  adult, only for animals with a parent (`aParentA` ≠ 0). Bunnies travel as an emigrant
  with `natal` set (with a companion, `takeCompanion`; settle on arrival, not by crowd);
  wolves go to `dispTo` with `goAround` and are home within `DISPERSE_THERE`. A bunny's trip
  (either kind) starts at `awayFrom`; `farGoal` keeps destinations at least `travelMin`
  (`TravelMin` × the world's longer side) from it, and neither kind settles nearer. A natal
  bunny's own length is `tripMin` (`TravelMin`..`DisperseFar` of that side; DisperseRun
  tiles if DisperseFar is blank); it is home on crossing it, and detours aim only as far as
  is left (`natalRun`).
- **Going around** (moving.js `AS.edgeStep(sim, s, goal, key, canEnter)`): a step toward a
  goal the path search can't reach; greedy while a 4-neighbor gets closer, else edge
  following with the animal's hand (`aSerial & 1`: 1 right, 0 left) on the obstacle,
  leaving the edge once closer than where it met it; `EdgeFollow` steps of edge per trip
  (`key`: a destination tile, or minus a target's serial), then it returns -1 and the key
  stays given up. Per-slot memory in a WeakMap by world; `AS.edgeReset` (the decide loop on
  a state change, and callers when a path is found again). wolf.js `goAround` (chew or
  step) for HUNT, FEED, MATE and the far trips (roam, dispersal); bunny.js for emigrant
  trips (`emigrateStep`) and `followStep`. wolf.js `forget`: when even that fails, the
  target's serial is ignored (`skip`/`skipUntil` in `mem`, read by the matchers through
  `mSkip`) for `ForgetSeconds`.
- **Events:** `sim.emit(AS.EV.X, tile)` into a ring (`sim.events`): BITE, BIRTH, DEATH,
  GRAZE (bunny grazing or wolf chewing). render.js keeps its own cursor and turns them into
  poses.
- **History:** `sim.history` = `{ length, grass, bunnies, wolves, humans }`, one sample per
  in-world hour (Uint32Arrays, doubling). The graph and the lab read it.

## Sprite poses (render.js + sprites.js)

The sprites are bitmaps (ten frames per animal: stand, walk, idle, eat/bite, runA, runB,
rest, winded, dead, pregnant; plus a dimmed dead-pose carcass per species,
`spriteCarcass`; water in three still variants chosen by tile position, `spriteWater`).
`spritePose` (pure) picks the frame: hold, sprint run cycle, walk, winded/resting,
pregnant, idle fidget, stand; a species' `winds` flag decides whether it has a winded
frame.

The renderer reads the sim and never writes it. Each frame, `consumeEvents` reads the
events since its cursor (a swapped-in sim or a ring overrun is handled like any reader's)
and sets **holds**, in real ms (`performance.now()`, so a pose lasts the same at any speed):
DEATH shows the body on that tile's corpse for a moment (`deathUntil`, per tile; only
matters for a corpse with no meat, since one with `cMeat > 0` always draws as its carcass,
lying flat with its eye shut, and as its species' skull once eaten), BITE makes the bunny
there flinch (runA), BIRTH hops the baby, and BITE/GRAZE mark the adjacent animal that
targets that tile as biting or eating (ACTION). A bite is also spotted as an animal's
`aBiteLeft` rising since the last frame it was drawn (the event route covers fast speeds
where the timer has run down within a frame). Steps shorter than `SPRITE_MIN_STEP_MS` of
real time (the `speed` passed to `draw`) glide in the standing pose. Mating animals face
their partner. Cell mode still consumes events, so holds don't replay on zoom-in. Holds
never flash: see DESIGN.md, Photosensitivity.

- **In water** (the tile under it mid-glide: the nearer one): deeper than it wades, it is
  drawn in its standing frame with only the rows down to `SWIM_BELOW` under its eye
  (`spriteEyeRow`) shown, set lower so the water meets it at row `SWIM_CUT`, bobbing a row
  every half `SWIM_BOB_MS` (real time, its own phase); at 0 Stamina (drowning) down to its
  eye row, still. A `WATERLINE` under the next row's span (`spriteRowSpan`), and a fading V
  wake (`WAKE_STEPS`) behind one swimming sideways. Wading: its pose without the bottom
  (feet) row, the line under it. `spriteRowPx`/`spriteColPx` place rows and columns as
  `paint` does (babies smaller).
- **Grass** leans with the wind (`AS.Gusts()` in sprites.js; render.js makes one,
  `update(sim, realMs, speed, alpha)` each sprite-mode frame, `leans(x, y)` → -1/0/+1 per
  tile): gusts are objects moved along `sim.wind`'s direction by elapsed sim time, born at the
  upwind edge, more often, wider and faster with strength (`FULL_KMH`); calm, none. Every
  blade's lean changes at most once per `HOLD_MS` of real time (a change is refused until the
  last is that old); when a gust cycle would be shorter than `CYCLE_HOLDS` holds at this
  speed, blades lean by the average share instead. Left and right lean variants are extra
  sheet sprites (`spriteGrassLean`, `spriteGrassLeanLeft`). The far view doesn't lean.
- **Fire** (render.js, sprites.js): a burning tile draws its blade or body darkened by
  `AS.fireLook(stage)` (`fireStage` from fire.js: below `FIRE_LOOK_AT` engulfing, the thing
  shows, charring through `CHAR_LEVELS` pre-darkened sheet sprites under tongues, then mid
  flames; above it, full flames hide it), the flame swaying a frame at most every
  `FLAME_HOLD_MS` of real time on each tile's own clock (`flameFrame`). Scorched ground fades
  only in its last `min(ScorchDays, FireScorchDays)` days; recently burnt tiles glow with
  embers (`FIRE_EMBER_HOURS`, only where there is ash, so never a nuke's crater), and every
  tile with ash has ash pixels placed by a tile hash, fainter as the ash runs down.
  The far view colors burning tiles by stage and embers fading to scorch. `AS.spriteFlame()`
  is the PAINT and Info icon; 'fires' is a locate kind. A burning animal (`aAlight`) carries
  flames on its back (`drawAlight`, raised `ALIGHT_RAISE` rows) and is `FAR_ALIGHT` red far
  out; 'fires' rings it too. Scorch, ash and embers draw first, under the topo lines, since
  burnt ground is no higher; water and grass draw over the lines.
- **Overlays** (render.js): scorched ground; the Radius slider's fading preview
  (`radiusPreview`, `RADIUS_*`); topo lines from `W.elev` when on (`setContours`, spacing
  `setContourStep`, each spacing cached per world, `CONTOUR_*`: marching squares in
  `CONTOUR_CHUNK` squares, a square on screen worked out again when its wet tiles changed);
  the locate rings for the kinds a count toggles on (`locate(kinds, top)`, `LOCATE_*`,
  `AS.LOCATE_COLORS`: steady rings, edge pips for animals off screen); the nuke's ring and
  glow over real time (`blast()`); past the world's edge, `OUTSIDE` with an `EDGE_LINE`.

## The page

- **The bar and tabs** (ui.js): speeds, day, the window buttons Info, Paint, Graph and Map (each with a small icon), plus Debug only with
  `?debug` (tab keys `info`, `paint`, `debug`; Graph and Map toggle their own windows through `onGraph` / `onMinimap`), and Hide UI (`H`). Each tab is a stack of labeled
  rows made by `section(tab, title)`, to which a new control is appended; each its own
  window, toggled by its button (`setWindow(key, on)`, `ui.windows`, `onWindows` → main.js
  keeps them in localStorage `life-ui-windows`). On a computer they float (CSS, `--side-w`,
  `--hud-bar`: Info down the left, `body.side-open` moving the graph and minimap aside;
  PAINT bottom right; Debug right), dragged by their title bars (drag.js) and resized by a bottom-right grip (`uiParts.Resizable` in ui-parts.js, size kept per window under `life-*-wh`; the graph, minimap and properties window use it too).
  - **Info:** per-species counts, each a toggle that rings that kind on the map through
    `onLocate(key, on)` and wears its color while on; Wind (an arrow the way it blows and
    `windWords`/`windFromName`, from hud's `wind` field, which main.js fills from `sim.wind`;
    hidden until there is one); a Total; a "(click to highlight on map)" hint under the counts; Topo lines (`onElevation`) and their spacing (`onContourStep`); Intent lines
    (`onLines`); Properties Off/Click/Hover through `onInspect`; Inspect Empty Tiles through
    `onInspectEmpty`.
  - **PAINT** (paint-tab.js, in the window ui.js makes): the modes (NUKE, GRASS, RABBIT,
    WOLF, HUMAN, WATER, FIRE: one at a time, `ui.mode`;
    icons once `setIcons` runs (main.js `ICON_SPRITE`), the name kept as `aria-label` and in
    the tooltip; the nuke icon is sprites.js `spriteNuke`) with a Radius slider (0–100; one
    value for every mode, localStorage `life-radius`, default `BrushRadius`; `NukeRadius` is no longer used by the slider), an armed banner with Stop (`.paint-banner`; the colored edge is CSS on the body's `paint-armed`/`nuke-armed`) and
    the "That's a crowd" card (`ui.crowd`, cards.js).
  - **Debug:** the Water button (kept per viewer in localStorage `life-water`; starts a new
    world with `opts.water`), the seed, Benchmark and the debug tools.
  - The properties window (properties.js, `ui.inspector`): a heading row renders as a
    section title. The cards and the error page (cards.js: `ui.ended`, `ui.crowd`,
    `ui.errors`). Keys for speed and Hide UI are ui.js's.
- **PAINT's powers** (paint.js): `paintCircle(sim, 'grass'|'bunny'|'wolf'|'human'|'water'|'fire',
  cx, cy, r, cap?)` is the brush (empty eligible tiles only; random ages, but a species
  with no `LitterSize` (humans) stays adult; radius 0 = one tile; `cap = { room, hit }`
  stops animals at the soft limit; `water` goes through `pourWater`, `fire` through `AS.ignite` alone). `nuke(sim, tile,
  radius?)` destroys everything within the radius (the slider's, default `NukeRadius`):
  animals with no corpse and no event, blades, corpses, holes, and scorches the ground
  (`W.scorch`, days left, `ScorchDays` at the center, shorter to the rim).
- **main.js:** selection (`pickAt`, which with Inspect Empty Tiles returns bare ground as
  `{ empty: true }`, kept picked whatever comes onto it; the properties mode
  `inspectMode`: off, click, or hover, which re-picks under the mouse once per frame after
  it moves), the brush (`paintAt`/`paintLine`, sized by the Radius slider) and the soft
  limit on painted animals (`app.animalLimit`, `AnimalWarnAt`), and `makeWorld` (the world
  grown in the worker, then `AS.Sim`).
- **graph.js:** a draggable, see-through floating window (position and its +/− big or small
  size kept in localStorage, clamped to the viewport; day labels thin out to fit the width).
- **minimap.js** (`#minimap`): the far view's picture (`renderer.farCanvas`, refreshed
  every `MINI_REFRESH_MS`), the view box and dots for the ringed kinds every frame; click
  or drag moves `cam`; +/− size and open state kept in localStorage.

## Recipes

- **A new number:** add a row to `tables/species.csv` (or settings.csv), add it to the
  schema in tables.js (`SPECIES_SCHEMA` / `SETTINGS_SCHEMA`: type and which species must
  fill it), read it as `T.<species>.<Stat>`. Never repeat its value in code or comments.
- **A new state:** a row in `states.csv` at the right priority, and an `{ enter, act,
  start? }` entry in that species' file with the same name.
- **A new inspector row:** a row in `variables.csv` (Applies to: all / bunny / wolf / human /
  grass / corpse / female) and a reader in inspect.js's `READERS`; without a reader the
  row shows "—" and a startup warning.
- **A new animal species:** a column in species.csv (after the last animal, before Grass)
  and states in states.csv; an entry in each list in world.js (`SPECIES`, `SPECIES_KEY`,
  `POP_KEY`, `KIND`) and tables.js (`ANIMALS`); its `Prey` and `EatsCarcass` rows say who it
  hunts and eats (everything that hunts or eats reads those, nothing names a species);
  bitmaps and colors (sprites.js `BITMAPS`/`BY_SPECIES`/`ANIM`, glyphs.js, render.js
  `FAR_ANIMAL`); a count and graph series (ui.js `COUNTS`, graph.js `SERIES`, main.js
  `ICON_SPRITE`); `human-check.js` is the template.
- **A new animal field:** one line in `ANIMAL_FIELDS` (world.js); `addAnimal` zeroes it.
- **A new event:** add to `AS.EV` (sim.js), emit it, give it a pose in render.js
  (`consumeEvents`) and sprites.js.
- **A new check:** start from `_tools/kit.js` (`stage`, `tally`) and add it to check-all's
  list (`slow: true` if it runs the real world for weeks).

## Colors

- **Map:** glyphs.js palette (black ground, greens for grass by size, tan bunnies,
  gray wolves, bone corpses; sexes two shades, elders dimmer) is the base for the
  sprites (sprites.js). The zoomed-out far view has its own brighter colors in render.js.
- **Charts** (graph panel, lab): grass `#199e70`, bunnies `#d95926`, wolves `#3987e5`, humans `#c763b3`.
  Validated as a set for color-blind readers on the `#0a0c0a` background (the map's own
  colors failed that check). Text in charts uses text colors, never series colors.

## Tools (`_tools/`, run from the repo root)

| Command | What it does |
|---|---|
| `node Life/_tools/check-all.js [--quick]` | every headless check below, several at once; before a commit. `--quick` (about a minute) skips the long real-world runs (breed, wolf, water) and shortens the harness's; use it while working |
| `Life/_tools/life-local.command` (shortcut: `Life/_▶ DOUBLE-CLICK TO RUN LIFE LOCALLY.command`) | Paul's way to try his working copy: double-click in Finder (or run it); starts the lab server (repo root, no caching) on 8920 and opens `life.html` |
| `node Life/_tools/thirst-check.js` | the water meter, DRINK, the water field, the crowd at one lake, no-water worlds (Water off is the Rain 0% / RiverDrain 0 world), and cause of death |
| `node Life/_tools/harness.js [days] [seed]` | runs a seed, audits grid ↔ stores every day, checks same seed → same world. `require('./harness.js')` gives `load()` (the sim's files in a Node VM, plus any extra `js/` files), `audit()`, `run()`, `editCSV()`, `SIM_FILES` to other scripts |
| `kit.js` | what the checks share: `stage()` builds a bare world (nothing placed, no water rules) from the real tables with the test's edits, `quiet.*` switches off grass growth, hunger or digging, `tally()` counts ok/FAIL lines and exits with the verdict, plus `at`, `tick`, `secs`, `days`, `stateName`. A new check starts here |
| `node Life/_tools/files-check.js` | life.html loads every `js/` file with one `?v=`, and the harness's and the lab worker's sim file lists match the page's order. Add a new file to all three |
| `*-check.js` | one per module (tables, grass, sight, bunny, breed, wolf, human, warren, paint, water, thirst, inspect, camera, render, ui, graph, bench). Each loads the real files in a Node VM. `bench-check.js --slow` also builds the biggest benchmark worlds and prints Node tick timings |
| `node Life/_tools/profile-tick.js` | where tick time goes at a few world sizes |
| `node Life/_tools/run-bench.js desktop\|phone\|capped30` | the in-page benchmark in a real windowed Chrome (throwaway profile); prints results, saves a screenshot to `.claude/life-shots/` |
| `node Life/_tools/shoot.js desktop\|phone out.png [setup.js] [?query]` | screenshot of the live page in Chrome after running `setup.js` in it (async JS; `AS.app` is the running sim) |
| `node Life/_tools/browser-keys-check.js`, `browser-touch-check.js`, `browser-pick-check.js` | real key, touch and click input through Chrome (picking an animal mid-step) |
| `node Life/_tools/lab-screen.js cfg.json out.json` | coarse screen: each number alone at extreme multiples (e.g. ¼× and 4×), a few short seeds, ranked by effect. Start here when tuning: it finds which numbers matter |
| `node Life/_tools/lab-compare.js cfg.json [out.json]` | a few named sets of changes side by side on the same seeds; check a combination before saving it |
| `node Life/_tools/lab-search.js cfg.json out.json` | the lab's Search, headless, plus a re-check of the best on fresh seeds; fine-tuning, once the screen has found what matters |

`chrome.js` is the shared helper behind every browser tool: a throwaway-profile Chrome
window driven over the DevTools protocol. The lab tools need the lab server running
(`LAB_URL`, default `http://localhost:8920/Life/_lab/`); their configs are JSON files,
usually kept in `.claude/life-shots/`.

The browser tools need the page served (`LIFE_URL`, default
`http://localhost:8914/life.html`) and Google Chrome at its standard macOS path.

## The tuning lab (`_lab/`)

`node Life/_lab/serve.js` → `http://localhost:8920/Life/_lab/` (or the `life-lab` preview
config). Local only: Jekyll never publishes `_lab/`.

- `serve.js` serves the repo and handles `POST /save`, which writes only the cells sent
  into `tables/species.csv` / `settings.csv` (only from loopback, only those files).
- `lab-tables.js` edits single CSV cells, byte-preserving; shared by page and server.
- `lab-model.js` reads cell text as numbers and writes it back in the same style
  (`10%`, `2-4`, `0.25`); lists the tunable cells; scores a set of runs (`summarize`).
- `worker.js` runs one seed headless with the sim's own files; `lab-pool.js` runs many in
  parallel. Runs stop early when a species dies out or bunnies pass the cap, and, with
  `trendStops`, as soon as their direction is clear: wolves below half their start and
  falling ("wolves declining"), or grass below a tenth of its peak and falling ("grass
  collapsing"), in the first `TREND_UNTIL_DAYS` (30) days only: later, wolves dip at the
  bottom of every predator-prey cycle and recover. See `TREND_*` in worker.js; lab-screen.js and lab-compare.js use them by
  default, with a bunny cap of 12,000.
- `lab-search.js` varies chosen cells (seeded, log-space steps) and keeps the best few.
- `index.html`, `lab-ui.js`, `lab.css` are the page.
- Checks: `search-check.js`, `ui-lab-check.js` (both in check-all).
