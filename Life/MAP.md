# Life — code map

How the code is put together, so you can find things without reading everything. The spec
is DESIGN.md; the rules are CLAUDE.md. **Keep this file true**: when you add a file, a
field, an event, a tool or a step in the tick, update the section it belongs in.

## Layout

```
life.html            the page (site root): elements, AS.V/BASE/FONT, every <script> in load order
Life/
  CLAUDE.md          rules            DESIGN.md   spec + milestone status      MAP.md  this
  style.css          all page styles (HUD, inspector, graph panel, benchmark overlay, errors)
  fonts/             DejaVu Sans Mono subset (woff2) + its license; every glyph and all UI text
  tables/            species.csv, settings.csv, states.csv, variables.csv: every number
  js/                the sim (below)
  _tools/            headless checks, the benchmark and screenshot drivers (tracked, unpublished)
  _lab/              the tuning lab, a local page + server (tracked, unpublished)
  _original-notes.txt  Paul's first sketch, history only
```

## How the scripts fit together

Plain scripts, no modules or bundler. Each file is an IIFE that adds to one global, `AS`.
`life.html` loads them in this order, and the order matters only for code that runs at
load time: every file reads other files' `AS.*` inside functions, at call time.

| File | Role | Exports |
|---|---|---|
| `tables.js` | fetch + parse + validate the CSVs into frozen `T` | `loadTables`, `parseTables` |
| `rng.js` | seeded randomness (mulberry32); the only source the sim may use | `makeRng`, `newSeed` |
| `world.js` | the grid and every store (typed arrays) + the only code that changes occupancy; the species lists (`SPECIES`, `SPECIES_KEY`, `POP_KEY`, `kindOf`, `canEnterHole`): a species is one entry in each | `World`, `KIND`, `SPECIES`, `SPECIES_KEY`, `SPECIES_COUNT`, `POP_KEY`, `kindOf`, `canEnterHole`, `SEX` |
| `grass.js` | growth every tick; age, seeding, sprouting on empty tiles, old age in hourly slices; bites | `grassTick`, `grassBite`, `grassStage` |
| `warren.js` | warren holes' clocks: marks a hole used while a bunny stands on it, collapses holes unused for `CollapseDays` (hourly); `holeWithin` | `warrenTick`, `holeWithin` |
| `corpse.js` | decay, and the boost field grass drinks from | `corpseTick`, `corpseAdded`, `corpseBoost` |
| `god.js` | God powers: `nuke(sim, tile)` destroys everything within the radius (`NukeRadius` unless the slider says otherwise) (animals with no corpse and no event, blades, corpses, holes) and scorches the ground (`W.scorch`, days left, `ScorchDays` at the center, shorter to the rim); `grass.js` counts scorch down hourly and nothing grows or is dug on it; `paintCircle(sim, 'grass'\|'bunny'\|'wolf'\|'human', cx, cy, r, cap?)` is the GRASS/RABBIT/WOLF/HUMAN MODE brush (empty eligible tiles only; random ages, but a species with no `LitterSize` (humans) stays adult; radius 0 = one tile; `cap = { room, hit }` stops animals at the soft limit); `nuke(sim, tile, radius?)` takes the God tab's Radius slider value (default `NukeRadius`) | `nuke`, `paintCircle` |
| `sim.js` | the fixed tick, populate, events ring, population history | `Sim`, `TICK_HZ`, `DT`, `DAY_SECONDS`, `TICKS_PER_HOUR`, `EV`, `debugDropCorpse` |
| `start.js` | the Meadows day-0 layout (`StartLayout`): lakes first (`Lakes` blobs of `LakeSize` tiles across, flood-filled so no land is cut off; small pockets are filled, a lake that cuts off a big one is dropped), then meadow grass (the lakeshore always starts as meadow) aged by depth, bunny colonies at meadow edges, wolf packs in the open (never humans: they are only painted in); uses only `sim.rng` | `startMeadows` |
| `sight.js` | line of sight through grass, nearest visible thing, local paths (plain and weighted for chewing) | `lineOfSight`, `nearestVisible`, `pathNext`, `pathNextWeighted` |
| `animals.js` | every animal's body, steps, the decide loop, bites, death, spawning; `relations(T)` (who hunts and eats whom, as bitmasks over species codes, from species.csv's `Prey` and `EatsCarcass`; `threat` is the reverse of `prey`); the shared grass bite `grazeBite` (bunny EAT, human FORAGE) | `animalsTick`, `registerStates`, `checkStates`, `stepTo`, `chewOrStep`, `biteAnimal`, `killAnimal`, `spawnStarting`, `relations`, `grazeBite`, `bestAdjacentBlade`, … |
| `breed.js` | mating and births, shared by the species that breed (a species with no `LitterSize`, humans, never mates; a female's `PackLimit`/`TerritoryRange` territory rule is in `canMate`; blank for bunnies = off) | `canMate`, `mate`, `tryBirth` |
| `bunny.js`, `wolf.js`, `human.js` | each species' states, by the names in `states.csv`. wolf.js's FEED, HUNT, GIVE_UP, REST and PROWL are the hunter states (`AS.hunterStates`) and read `Prey`/`EatsCarcass`, so `human.js` registers them for humans too and adds FORAGE (grass when hungry with no meat or prey in sight; no MATE) | (register via `AS.registerStates`) |
| `glyphs.js` | ids, palette and life stage shared by the sprites and HUD; the old glyph sheet (no longer drawn) | `GLYPH`, `COLORS`, `CELL_COLOR`, `GlyphSheet`, `stageOf`, … |
| `sprites.js` | the 8×8 pixel-art sprites (bunny, wolf, human with a spear, corpse, grass, water: three still variants chosen by tile position, `spriteWater`) as bitmaps (ten frames per animal: stand, walk, idle, eat/bite, runA, runB, rest, winded, dead, pregnant; plus a dimmed dead-pose carcass per species, `spriteCarcass`), the pose-priority rule (`spritePose`, pure; a species' `winds` flag decides whether it has a winded frame), per-slot facing, and the pre-rendered sprite sheet | `SpriteSheet`, `spritePose`, `spriteIndex`, `SpriteFacing`, `SPRITE_FRAME`, `SPRITE_HOLD`, … |
| `camera.js` | pan/zoom/pinch/wheel/keys, tap → tile; `cam.strokes` makes a one-pointer drag call `onStroke` (the brush) instead of panning | `Camera` |
| `render.js` | draw (scorched ground, and the nuke's ring and glow over real time, `blast()`): visible tiles from the sprite sheet, or cell mode zoomed out (its brighter far-view colors live at the top of render.js); animals glide and act out events (below); intent lines (off by default, the selected animal's always on); selection | `Renderer`, `CELL_PX`, `glideProgress` |
| `inspect.js` | `variables.csv` → the inspector's rows for a selection | `describe`, `inspectWarnings` |
| `graph.js` | the population graph as a draggable floating window (position kept in localStorage, clamped to the viewport; from `sim.history`) | `Graph`, `graphMath` |
| `bench.js` | benchmark mode (grass series, animal series) | `runBench`, `benchMath` |
| `ui.js` | the bar (speeds, day, Info/Debug/God tabs, Hide UI, `H`), the open tab's strip (Info: per-species counts, a Total, the graph button), God tab modes (NUKE, GRASS, RABBIT, WOLF, HUMAN: one at a time, `ui.mode`) with a Radius slider (0–100; each mode keeps its own value in localStorage, defaults from `NukeRadius`/`BrushRadius`) and the "That's a crowd" card (`ui.crowd`), inspector panel, errors page, keys for speed | `UI` |
| `main.js` | boot, the frame loop, selection, wiring, the brush (`paintAt`/`paintLine`, sized by the Radius slider) and the soft limit on painted animals (`app.animalLimit`, `AnimalWarnAt`) | `app`, `TICK_BUDGET_MS` |

Sim files (`tables` … `human`, plus `glyphs` for `stageOf`) never touch the DOM, so the
Node harness and the lab's workers run them unchanged.

## Data: struct of arrays (`world.js`)

`W = sim.W`. One thing per tile; `W.kind[t]` (`AS.KIND`: EMPTY, GRASS, CORPSE, WATER, BUNNY,
WOLF, HUMAN; an animal's kind is `AS.kindOf(species)`) is the truth about who is where. Tiles are `t = y * W.w + x`.

- **Blades** are indexed by tile (they never move): `gSize`, `gAge` (days), plus a dense
  list `gList[0..gCount)` with `gSlot[t]` for O(1) removal.
- **Warren holes**, by tile: `hole` (1 = a hole), `holeUsedAt` (sim seconds a bunny last stood there), dense `hList`/`hSlot`/`hCount`. A hole is *ground*, not an occupant: the tile's `kind` stays EMPTY (or BUNNY, or a corpse that died there), so one-thing-per-tile is untouched. Only bunnies may enter one (`stepTo`, `tryBirth`, `moveAnimal` and `addAnimal` refuse any other species, via `AS.canEnterHole`; hunter pathing costs a hole `Infinity`), nothing grows on one (`addGrass` throws; grass.js skips holes), and a bunny on one can't be bitten (`biteAnimal`) or picked as prey (wolf.js `isPrey`). `addHole`/`removeHole` are world.js's; `holeUsedAt` is written by warren.js and by DIG/start. Bunnies HIDE on one while a wolf or human is in sight, FLEE runs to a free one within `HoleRange`, DIG makes new ones on bare ground.
- **Water**, by tile: `kind` WATER, laid once at world build by `addWater` (world.js; EMPTY tiles only; start.js's `layLakes` calls it). It sits below the animal kinds because animals are told by `kind >= BUNNY`; everything else tests for EMPTY or one named kind, so water is simply a taken tile: nothing enters, stands on, is born on, is painted on, grows on or is dug into it, and `pathNext`, wolf.js's cost (Infinity: only EMPTY and GRASS are enterable) and `headToward` refuse it. `lineOfSight` ignores it (only GRASS blocks sight). A nuke skips it (no kill, no scorch). A water tile is in no store: `serial` 0, no slot, hole or scorch (the harness audit checks). `W.shore` (Float32, 1 = none) is `WaterBoost` (species.csv, Grass column) within `WaterRadius` of any water, set once by `setShore`; grass.js multiplies growth, seeding and sprouting by it, together with a corpse's boost.
- **Scorch**, by tile: `scorch` (Float32, days left); set by `nuke`, counted down by the hourly grass pass; `addGrass` and `addHole` refuse a scorched tile.
- **Corpses**, by tile: `cNut`, `cMeat` (Fullness left on the body, set from `MeatOnBody` by `addCorpse`, eaten down by wolf.js's FEED, zeroed with the corpse), `cAge`, `cSpecies`, dense `cList`/`cSlot`/`cCount`;
  `boostSrc[t]` = the corpse tile boosting tile t, or −1.
- **Animals** live in stable slots (`0..aHigh`, free list `aFree`, never compacted), so a
  slot index is valid for a whole life; `aSerial[s]` tells a reused slot from its old
  occupant. Every field is an `a*` array (see `ANIMAL_FIELDS` in world.js, one line per
  field). `W.aSlot[t]` maps a tile to its animal.
- **Identity:** anything that remembers another agent stores slot (or tile) **and** serial,
  and checks the serial before trusting it (selection, targets, fathers).

**Who writes what.** Only `world.js`'s add/remove/move functions change `kind`, `aSlot` or
the dense lists. Grass fields: grass.js. Hole fields: world.js (`addHole`/`removeHole`), `holeUsedAt` also warren.js. Corpse fields and `boostSrc`: corpse.js (`cMeat` also wolf.js, FEED). Animal
fields: animals.js, breed.js, bunny.js, wolf.js, human.js. Everything else (render, inspect,
graph, ui, bench) only reads.

## Time

- **Tick:** fixed `AS.DT` = 1/30 s of sim time (`TICK_HZ`); a day is `DAY_SECONDS` = 20 s.
  `sim.tick()` does, in order: record history at the start of each in-world hour →
  `corpseTick` → `grassTick` → `warrenTick` → `animalsTick`.
- **Grass:** growth every tick; age/seed/sprout/old-age once per in-world hour, spread over
  `TICKS_PER_HOUR` ticks by tile (`t % TICKS_PER_HOUR`).
- **Animals:** body every tick (age, hunger, starve/heal, stamina + winded, timers), decide
  every 1/`DecidePerSec` s (random phase per animal), then the current state's `act` every
  tick. Timers are Float64 and snap to 0 within 1e-9 so cooldowns last exactly their CSV
  value.
- **Frame loop (main.js):** each frame runs as many ticks as speed × real time asks,
  within `TICK_BUDGET_MS` (12 ms); past that a fixed speed falls behind and the HUD shows
  the speed actually reached. Then one draw. Drawing never changes the sim, so a seed
  replays exactly at any speed.
- **Determinism:** same tables + same seed → same run, in the page, the Node harness and
  the lab's workers (checked). Only `sim.rng` may roll dice; never `Math.random` in sim code.

## Behavior

- `states.csv` lists each species' states in priority order. The decide loop tries their
  `enter(sim, s)` in that order and switches to the first that says yes; `act(sim, s)` runs
  every tick. Reordering rows reorders behavior; `AS.checkStates` errors if the CSV and
  the code disagree on names. A species places animals only once its states are
  registered (`AS.speciesReady`).
- Movement goes only through `AS.stepTo` (empty tiles) or `AS.chewOrStep` (wolves into
  grass): both respect speed and one-thing-per-tile. Paths: `pathNext` (empty tiles only)
  and `pathNextWeighted` (cost per tile; wolves pay chew time for grass).
- **Who eats whom is data** (species.csv `Prey`, `EatsCarcass`; `AS.relations`): wolves hunt bunnies and humans, humans hunt bunnies and wolves, bunnies run from (FLEE/HIDE) every species that lists Bunny as prey. Wolves never eat wolf carcasses and humans never eat human ones. Humans are never placed at the start (only HUMAN MODE paints them), never breed (no `LitterSize`: `canMate` is false), forage grass when hungry with no meat or prey in sight (`GrassFood` per bite; blank = `BiteFood`, as bunnies), and can't enter holes or catch a bunny in one.
- A hunter's bite kills prey whose HP its `BiteDamage` covers (a human's always does; a wolf needs several bites on a human) and feeds nothing (`biteAnimal`); the body holds `MeatOnBody`. **FEED** (wolf.js, above HUNT): a hungry hunter that sees a carcass of a species it eats with `cMeat > 0` walks to a tile touching it and eats `min(BiteFood, cMeat, room)` every `BiteCooldown`, raising `aBiteLeft` (the renderer reads that as a mouthful); once feeding it stays until Fullness is `FullnessMax` or the meat is gone, past `HungryAt`. Its carcass is kept per wolf in `mem(W)` (`feedTile`/`feedSerial`).
- **Wandering leans toward room.** When a wander/prowl run starts, `pickRoomDir` (a copy in bunny.js and in wolf.js, which humans use) weights each open direction by `exp(-RoomPreference * c / (L/2))`, `c` = same-species animals in a box `L` = `VisionRange` tiles long reaching out that way; 0 = uniform random. Bunny FLEE's escape point is the best of straight-away and ±45°/±90° turns, scored by distance from the wolf minus a cost for path tiles at the world's edge (`FLEE_*` in bunny.js).
- A hunting wolf remembers where it last saw its bunny: wolf.js keeps `seenTile`/`seenAt` per wolf in `mem(W)`, and while `TrackSeconds` (species.csv, 0 = off) allows it HUNT walks to that tile when the bunny is out of sight (`act` then uses `lineOfSight` instead of the bunny's true tile).
- **Events:** `sim.emit(AS.EV.X, tile)` into a ring (`sim.events`): BITE, BIRTH, DEATH,
  GRAZE (bunny grazing or wolf chewing). render.js keeps its own cursor and turns them into poses.
- **History:** `sim.history` = `{ length, grass, bunnies, wolves, humans }`, one sample per
  in-world hour (Uint32Arrays, doubling). The graph and the lab read it.

## Sprite poses (render.js + sprites.js)

The renderer reads the sim and never writes it. Each frame, `consumeEvents` reads the
events since its cursor (a swapped-in sim or a ring overrun is handled like any reader's) and
sets **holds**, in real ms (`performance.now()`, so a pose lasts the same at any speed):
DEATH shows the body on that tile's corpse for a moment (`deathUntil`, per tile; only matters for a corpse with no meat, since one with `cMeat > 0` always draws as its carcass, lying flat with its eye shut, and as its species' skull once eaten), BITE makes the
bunny there flinch (runA), BIRTH hops the baby, and BITE/GRAZE mark the adjacent animal
that targets that tile as biting or eating (ACTION). A bite is also spotted as an animal's
`aBiteLeft` rising since the last frame it was drawn (the event route covers fast speeds
where the timer has run down within a frame). `spritePose` picks the frame: hold, sprint run
cycle, walk, winded/resting, pregnant, idle fidget, stand. Steps shorter than
`SPRITE_MIN_STEP_MS` of real time (the `speed` passed to `draw`) glide in the standing pose.
Mating animals face their partner. Grass leans in a rare gust (`grassLeans`, real seconds: a diagonal band, `GUST_EVERY` apart; sprite mode only, lean variants are extra sheet sprites). Cell mode still consumes events, so holds don't replay on
zoom-in. Holds never flash: see DESIGN.md, Photosensitivity.

## Recipes

- **A new number:** add a row to `tables/species.csv` (or settings.csv), add it to the
  schema in tables.js (`SPECIES_SCHEMA` / `SETTINGS_SCHEMA`: type and which species must
  fill it), read it as `T.<species>.<Stat>`. Never repeat its value in code or comments.
- **A new state:** a row in `states.csv` at the right priority, and an `{ enter, act,
  start? }` entry in that species' file with the same name.
- **A new inspector row:** a row in `variables.csv` (Applies to: all / bunny / wolf / human /
  grass / corpse / female) and a reader in inspect.js's `READERS`; without a reader the
  row shows "—" and a startup warning.
- **A new animal species:** a column in species.csv (after the last animal, before Grass) and states in states.csv; an entry in each list in world.js (`SPECIES`, `SPECIES_KEY`, `POP_KEY`, `KIND`) and tables.js (`ANIMALS`); its `Prey` and `EatsCarcass` rows say who it hunts and eats (everything that hunts or eats reads those, nothing names a species); bitmaps and colors (sprites.js `BITMAPS`/`BY_SPECIES`/`ANIM`, glyphs.js, render.js `FAR_ANIMAL`); a count and graph series (ui.js `COUNTS`, graph.js `SERIES`, main.js `ICON_SPRITE`); `human-check.js` is the template.
- **A new animal field:** one line in `ANIMAL_FIELDS` (world.js); `addAnimal` zeroes it.
- **A new event:** add to `AS.EV` (sim.js), emit it, give it a pose in render.js (`consumeEvents`) and sprites.js.

## Colors

- **Map:** glyphs.js palette (black ground, greens for grass by size, tan bunnies,
  gray-blue wolves, bone corpses; sexes two shades, elders dimmer) is the base for the
  sprites (sprites.js). The zoomed-out far view has its own brighter colors in render.js.
- **Charts** (graph panel, lab): grass `#199e70`, bunnies `#d95926`, wolves `#3987e5`, humans `#c763b3`.
  Validated as a set for color-blind readers on the `#0a0c0a` background (the map's own
  colors failed that check). Text in charts uses text colors, never series colors.

## Tools (`_tools/`, run from the repo root)

| Command | What it does |
|---|---|
| `node Life/_tools/check-all.js` | every headless check below; run before and after changes |
| `Life/_tools/life-local.command` (shortcut: `Life/_▶ DOUBLE-CLICK TO RUN LIFE LOCALLY.command`) | Paul's way to try his working copy: double-click in Finder (or run it); starts the lab server (repo root, no caching) on 8920 and opens `life.html` |
| `node Life/_tools/harness.js [days] [seed]` | runs a seed, audits grid ↔ stores every day, checks same seed → same world. `require('./harness.js')` gives `load()`, `run()`, `editCSV()`, `SIM_FILES` to other scripts |
| `*-check.js` | one per module (tables, grass, sight, bunny, breed, wolf, human, warren, god, water, inspect, camera, render, ui, graph, bench). Each loads the real files in a Node VM |
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
