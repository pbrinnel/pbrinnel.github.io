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
| `world.js` | the grid and every store (typed arrays) + the only code that changes occupancy | `World`, `KIND`, `SPECIES`, `SPECIES_KEY`, `SEX` |
| `grass.js` | growth every tick; age, seeding, sprouting on empty tiles, old age in hourly slices; bites | `grassTick`, `grassBite`, `grassStage` |
| `corpse.js` | decay, and the boost field grass drinks from | `corpseTick`, `corpseAdded`, `corpseBoost` |
| `sim.js` | the fixed tick, populate, events ring, population history | `Sim`, `TICK_HZ`, `DT`, `DAY_SECONDS`, `TICKS_PER_HOUR`, `EV`, `debugDropCorpse` |
| `start.js` | the Meadows day-0 layout (`StartLayout`): meadow grass aged by depth, bunny colonies at meadow edges, wolf packs in the open; uses only `sim.rng` | `startMeadows` |
| `sight.js` | line of sight through grass, nearest visible thing, local paths (plain and weighted for chewing) | `lineOfSight`, `nearestVisible`, `pathNext`, `pathNextWeighted` |
| `animals.js` | every animal's body, steps, the decide loop, bites, death, spawning | `animalsTick`, `registerStates`, `checkStates`, `stepTo`, `chewOrStep`, `biteAnimal`, `killAnimal`, `spawnStarting`, … |
| `breed.js` | mating and births, shared by both species | `canMate`, `mate`, `tryBirth` |
| `bunny.js`, `wolf.js` | each species' states, by the names in `states.csv` | (register via `AS.registerStates`) |
| `glyphs.js` | glyph ids, palette, life stage, the pre-rendered glyph sheet | `GLYPH`, `COLORS`, `CELL_COLOR`, `GlyphSheet`, `stageOf`, … |
| `sprites.js` | the 8×8 pixel-art sprites (bunny, wolf, corpse, grass) as bitmaps (ten frames per animal: stand, walk, idle, eat/bite, runA, runB, rest, winded, dead, pregnant; plus a dimmed dead-pose carcass per species, `spriteCarcass`), the pose-priority rule (`spritePose`, pure), per-slot facing, and the pre-rendered sprite sheet | `SpriteSheet`, `spritePose`, `spriteIndex`, `SpriteFacing`, `SPRITE_FRAME`, `SPRITE_HOLD`, … |
| `camera.js` | pan/zoom/pinch/wheel/keys, tap → tile | `Camera` |
| `render.js` | draw: visible tiles from the sprite sheet, or cell mode zoomed out (its brighter far-view colors live at the top of render.js); animals glide and act out events (below); intent lines (off by default, the selected animal's always on); selection | `Renderer`, `CELL_PX`, `glideProgress` |
| `inspect.js` | `variables.csv` → the inspector's rows for a selection | `describe`, `inspectWarnings` |
| `graph.js` | the population graph panel (from `sim.history`) | `Graph`, `graphMath` |
| `bench.js` | benchmark mode (grass series, animal series) | `runBench`, `benchMath` |
| `ui.js` | HUD strip, inspector panel, errors page, keys for speed | `UI` |
| `main.js` | boot, the frame loop, selection, wiring | `app`, `TICK_BUDGET_MS` |

Sim files (`tables` … `wolf`, plus `glyphs` for `stageOf`) never touch the DOM, so the
Node harness and the lab's workers run them unchanged.

## Data: struct of arrays (`world.js`)

`W = sim.W`. One thing per tile; `W.kind[t]` (`AS.KIND`: EMPTY, GRASS, CORPSE, BUNNY,
WOLF) is the truth about who is where. Tiles are `t = y * W.w + x`.

- **Blades** are indexed by tile (they never move): `gSize`, `gAge` (days), plus a dense
  list `gList[0..gCount)` with `gSlot[t]` for O(1) removal.
- **Corpses**, by tile: `cNut`, `cMeat` (Fullness left on the body, set from `MeatOnBody` by `addCorpse`, eaten down by wolf.js's FEED, zeroed with the corpse), `cAge`, `cSpecies`, dense `cList`/`cSlot`/`cCount`;
  `boostSrc[t]` = the corpse tile boosting tile t, or −1.
- **Animals** live in stable slots (`0..aHigh`, free list `aFree`, never compacted), so a
  slot index is valid for a whole life; `aSerial[s]` tells a reused slot from its old
  occupant. Every field is an `a*` array (see `ANIMAL_FIELDS` in world.js, one line per
  field). `W.aSlot[t]` maps a tile to its animal.
- **Identity:** anything that remembers another agent stores slot (or tile) **and** serial,
  and checks the serial before trusting it (selection, targets, fathers).

**Who writes what.** Only `world.js`'s add/remove/move functions change `kind`, `aSlot` or
the dense lists. Grass fields: grass.js. Corpse fields and `boostSrc`: corpse.js (`cMeat` also wolf.js, FEED). Animal
fields: animals.js, breed.js, bunny.js, wolf.js. Everything else (render, inspect,
graph, ui, bench) only reads.

## Time

- **Tick:** fixed `AS.DT` = 1/30 s of sim time (`TICK_HZ`); a day is `DAY_SECONDS` = 20 s.
  `sim.tick()` does, in order: record history at the start of each in-world hour →
  `corpseTick` → `grassTick` → `animalsTick`.
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
- A wolf's bite kills a bunny and feeds nothing (`biteAnimal`); the body holds `MeatOnBody`. **FEED** (wolf.js, above HUNT): a hungry wolf that sees a carcass with `cMeat > 0` walks to a tile touching it and eats `min(BiteFood, cMeat, room)` every `BiteCooldown`, raising `aBiteLeft` (the renderer reads that as a mouthful); once feeding it stays until Fullness is `FullnessMax` or the meat is gone, past `HungryAt`. Its carcass is kept per wolf in `mem(W)` (`feedTile`/`feedSerial`).
- A hunting wolf remembers where it last saw its bunny: wolf.js keeps `seenTile`/`seenAt` per wolf in `mem(W)`, and while `TrackSeconds` (species.csv, 0 = off) allows it HUNT walks to that tile when the bunny is out of sight (`act` then uses `lineOfSight` instead of the bunny's true tile).
- **Events:** `sim.emit(AS.EV.X, tile)` into a ring (`sim.events`): BITE, BIRTH, DEATH,
  GRAZE (bunny grazing or wolf chewing). render.js keeps its own cursor and turns them into poses.
- **History:** `sim.history` = `{ length, grass, bunnies, wolves }`, one sample per
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
- **A new inspector row:** a row in `variables.csv` (Applies to: all / bunny / wolf /
  grass / corpse / female) and a reader in inspect.js's `READERS`; without a reader the
  row shows "—" and a startup warning.
- **A new animal field:** one line in `ANIMAL_FIELDS` (world.js); `addAnimal` zeroes it.
- **A new event:** add to `AS.EV` (sim.js), emit it, give it a pose in render.js (`consumeEvents`) and sprites.js.

## Colors

- **Map:** glyphs.js palette (black ground, greens for grass by size, tan bunnies,
  gray-blue wolves, bone corpses; sexes two shades, elders dimmer) is the base for the
  sprites (sprites.js). The zoomed-out far view has its own brighter colors in render.js.
- **Charts** (graph panel, lab): grass `#199e70`, bunnies `#d95926`, wolves `#3987e5`.
  Validated as a set for color-blind readers on the `#0a0c0a` background (the map's own
  colors failed that check). Text in charts uses text colors, never series colors.

## Tools (`_tools/`, run from the repo root)

| Command | What it does |
|---|---|
| `node Life/_tools/check-all.js` | every headless check below; run before and after changes |
| `Life/_tools/life-local.command` (shortcut: `Life/_▶ DOUBLE-CLICK TO RUN LIFE LOCALLY.command`) | Paul's way to try his working copy: double-click in Finder (or run it); starts the lab server (repo root, no caching) on 8920 and opens `life.html` |
| `node Life/_tools/harness.js [days] [seed]` | runs a seed, audits grid ↔ stores every day, checks same seed → same world. `require('./harness.js')` gives `load()`, `run()`, `editCSV()`, `SIM_FILES` to other scripts |
| `*-check.js` | one per module (tables, grass, sight, bunny, breed, wolf, inspect, camera, render, ui, graph, bench). Each loads the real files in a Node VM |
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
