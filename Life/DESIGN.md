# Life — Design

A predator–prey–resource simulation: bunnies, wolves and blades of grass, each an
independent agent on a tile grid. A sim first; game mechanics come later. (It began as
"Agent Sim Test" in `Test/agent-sim/`.)

**The goal** is a self-sustaining ecosystem: grass, bunnies and wolves all persisting,
whether the populations settle or keep cycling. The numbers are tuned until the sim does
that; some seeds working out is already a good sign.

**The tables live in CSVs** in `tables/`. Open them in Numbers or Excel. They're the source
of truth: the sim will load them at startup, so editing a number there changes the sim.
(Numbers opens a CSV fine, but to save one use File → Export To → CSV.)

| File | Holds |
|---|---|
| `tables/species.csv` | Every stat, one column per species |
| `tables/variables.csv` | Every variable: what raises it, lowers it, and what happens at the limit |
| `tables/states.csv` | Each species' behaviors in priority order |
| `tables/settings.csv` | World size, starting counts, and the seed |

Every number in `species.csv` and `settings.csv` is a placeholder, there to be tuned by
watching the sim run. Everything else in this doc is decided.

---

## Decided

### Scope of version 1
- A simulation you watch. The player's only tool is the inspector: select an agent and
  read all of its properties live.
- Pause, plus run-speed control.
- Minimal graphics: small 8×8 pixel sprites, one per agent (Paul chose them over the
  original font glyphs, 3 Oct 2026).
- No terrain besides grass, no day/night, no seasons.

### World
- A tile grid larger than the screen; drag to pan, scroll or pinch to zoom. On a
  keyboard, WASD or the arrow keys pan too (Shift for faster).
- Solid walls at the edges, no wrap-around.
- **One thing per tile:** a blade, a corpse, or an animal. Nothing shares a tile.
- **Movement is 4-directional** (up, down, left, right).
- **Grass blocks movement.** Bunnies eat their way into a meadow. Wolves go around grass
  when that's quicker, and chew through it when chewing is quicker, counting the time the
  bites take, so a wolf is never walled in for good. A wolf's chewing feeds it nothing.
  It bites at `BiteSize` (Wolf column) every `BiteCooldown`, as part of moving to wherever
  it's going, whatever its state; a hunting wolf will chew toward a bunny it can see.
  Grass still blocks sight, so a bunny deep in a meadow is unseen and stays safe there.
  A prowling wolf has no destination, so when grass blocks its run it turns to an open
  direction if it has one and chews only when walled in. Chewing makes the same faint
  mark as a bunny grazing.
- Every interaction is with an adjacent tile: eating, biting and mating.
- **Grass blocks sight too.** A bunny inside a meadow can't be seen by wolves and can't
  see out. Sight is a line-of-sight check, up to `VisionRange` in a circle. Only grass
  blocks sight; animals and corpses don't.

### Setup
- World size, starting counts and the seed come from `settings.csv` only. Change them
  there and reload; there's no settings panel in the sim.
- **A lived-in world** (Paul, 4 Oct 2026; `StartLayout` Meadows): grass in meadows of
  every size with open ground between, the way temperate grassland looks from the air
  (`StartGrass` is the meadow share, `MeadowSize` the size of the largest). Blades are old
  in the middle of a meadow and younger toward its edge, with a few lone seedlings in the
  open. Bunnies live in `BunnyColonies` colonies just outside meadow edges; wolves run in
  `WolfPacks` packs out in the open, away from the colonies. Populations start smaller and
  concentrated so animals still meet. `StartLayout` Scatter keeps the old even scatter
  (the benchmark uses it).
- **Starting animals** are 50/50 male and female, at random ages within adulthood, with
  full Fullness, HP and Stamina.
- **Scatter only:** every blade starts as a sprout at `StartGrassAge` and Size
  `SproutSize`, a little above 0, so even a sprout feeds a bunny a little. The starting
  blades grow up and die of old age together, as one wave.
- **Seeded:** the same seed gives the same start. Leave `Seed` blank for a new random start
  each run. The seed in use is shown on screen; paste it into `settings.csv` to replay.

### Time
- The sim runs in fixed ticks, separate from drawing, so it runs the same at any speed
  and on any machine.
- 1 day = 20 s at 1× speed. Ages, pregnancies and cooldowns are counted in days.
- Speeds: pause, 1×, 2×, 5×, 20×, and max (as fast as the machine allows).

### Agents
**Bunny and Wolf**
- Sexes: male and female. Only a male–female pair can breed.
- Life stages: Baby → Adult → Elder. Only adults breed; babies and elders move slower.
- Pregnancy lasts `PregnancyDays`, then she gives birth on free 4-neighbor tiles. If
  there isn't room for the whole litter, **the birth waits** until there is, and she
  can't mate again until it happens. While she waits she carries on as normal; she
  doesn't go looking for room.
- Mating happens the moment two eligible bunnies of opposite sex are adjacent; the
  partner only has to meet the MATE conditions, whatever it's doing.
- Newborns start with full Fullness, HP and Stamina, and the litter's two parents as
  Parents.
- **A wolf's bite kills** (Paul, 4 Oct 2026: a wolf doesn't take a nibble and let the
  rabbit go). `BiteDamage` still decides it, and is set to a bunny's full HP. The bite
  itself feeds nothing.
- **Wolves eat the carcass.** A bunny's body holds `MeatOnBody`, whatever killed it. A
  hungry wolf that sees a carcass with meat walks to it and eats `BiteFood` every
  `BiteCooldown`, and keeps eating until it's full or the meat is gone. What's left stays
  for it or another wolf until the corpse rots. (One-bite kills that fed the wolf on the
  spot failed: a wolf's stomach holds 100 and it hunts below 80, so most of a big meal was
  wasted.)
- Starving: at Fullness 0 an animal loses HP each second and dies when HP reaches 0.
- Death leaves a corpse on the tile, which blocks movement like anything else.
- No genetics yet. Every animal of a species has the same stats. Inheritance comes later.
- **Wolves bite bunnies, and that's the only fighting.** Bunnies never fight back and
  wolves never fight each other.
- **One state at a time.** No eating while fleeing or hunting.
- Pregnancy doesn't slow a female down.
- **Winded:** an animal that runs its Stamina to 0 can't sprint again until its Stamina
  is full.
- **A hunting wolf remembers where it last saw its bunny** (Paul, 4 Oct 2026). Grass
  blocks sight, so a bunny can duck out of view; the wolf then walks to the spot where it
  last saw it, picks the chase back up if the bunny reappears, and gives up when it
  reaches the spot and sees nothing or after `TrackSeconds`. Out of sight, it knows only
  what it last saw.

**Grass**
- Each tile of grass is one blade. Its sprite shows its Size in thirds.
- A blade grows from sprout to full Size, then can seed a new blade on an empty
  4-neighbor tile, and dies of old age at its `Lifespan`.
- **Grass can sprout by itself** (Paul): each empty tile has a small `SproutChance` per day
  of growing a new blade, so grass can return to land it has lost and can never go extinct
  for good. A nearby corpse speeds that up by `CorpseBoost`, like seeding. Seeding from
  neighbors works as before.
- **A blade seeds only while it's at full Size.** A bitten blade regrows at `GrowthRate`
  and seeds again once it's full, so grazing slows a meadow's spread. Grass
  `TimeToMature` only sets the Lifestage label.
- Grass has only Sprout and Mature, unless `ElderAt` is filled in for Grass.
- Bunny bites shrink a blade, and a blade bitten down to 0 dies. A bite on a blade
  smaller than `BiteSize` feeds the bunny in proportion to what it removed.

**Corpses**
- Wolves eat a bunny's carcass while it has meat (above); a corpse also feeds grass.
- A corpse holds `CorpseNutrient` and decays over `CorpseDecay` days. Until it's gone, grass
  within `CorpseRadius` grows and seeds `CorpseBoost` times faster.
- **Grass drinks the Nutrient.** Each unit of extra growth the boost gives a blade costs
  the corpse one unit of Nutrient. The corpse is gone when its Nutrient runs out or
  `CorpseDecay` ends, whichever comes first, so a bigger body feeds more grass.
- The boost reaches a circle of `CorpseRadius` tiles.

### What the screen shows
- **Sprites:** 8×8 pixel art drawn in code, no image files: a bunny, a wolf (pointed
  ears, long snout, amber eye), grass as tufts in three heights by Size. A
  body with meat on it lies flat with its eye shut; once eaten, a skull is left until it
  rots (Paul picked these over bones, X eyes and a legs-up pose). Animals face the way they last stepped sideways.
- **Animals move like animals.** Bunnies stretch and hop a pixel mid-step; wolves stride
  and bob a pixel. Standing animals now and then flick an ear or wag the tail, each on
  its own timer so they never move in unison. Frames change with movement, at walking
  pace, so nothing blinks.
- **Animals act out what they do:** a wolf lunges with its jaw open when it bites and the
  bunny flinches; a bunny puts its head down for each mouthful; sprinters gallop with
  ears back; resting animals lie down, and a winded wolf pants; a wolf's body lies there for a
  moment before it becomes a skull; a pregnant female has a rounder belly;
  a newborn hops; a mating pair turns to face each other.
- **Wind** (Paul, 3 Oct 2026): every 25 seconds of real time a gust a few tiles wide rolls
  diagonally across the meadow and the tufts it passes lean a pixel; the rest of the time
  grass is still, so the animals stay the only things moving.
- **Zoomed far out,** once tiles are too small for a sprite to read, each tile becomes a
  solid square: grass shaded by height on dark ground, animals in brighter colors so
  herds and hunters stand out. Sprites come back as you zoom in.
- **Animals glide between tiles.** The sim moves them a whole tile at a time; drawing
  slides the sprite across during each step.
- **Life stage and sex on the map:** babies are drawn smaller and elders in a dimmer
  color; males and females are two shades of their species color.
- **Intent lines:** a faint line from an animal to whatever it's after: wolf → prey,
  bunny → blade, animal → mate, and a line away from the threat for a fleeing bunny.
  Off by default (Paul found them ugly); a Lines button in the HUD shows them for every
  animal, and the selected animal's own line always shows.
- **No event marks** (Paul, 3 Oct 2026): the sprites act out bites, eating, births and
  deaths themselves, so the fading marks that used to flag them are gone.
- **Inspector:** click or tap an agent to select it. An animal is picked where its sprite
  is drawn, even mid-step between two tiles. A panel shows every variable from
  `variables.csv`, live, and the selection follows the agent as it moves. Clicking empty
  ground clears it. Live values only, no life history.
- **Counts:** live totals of bunnies, wolves, blades and corpses.
- **Population graph:** a side panel, shown and hidden from the HUD, plotting grass,
  bunnies and wolves over the whole run on one chart with a logarithmic scale. Scroll and
  zoom along it to see any part of the run's history; hover or tap for the exact counts.

---

## Platform and scale

**Built in HTML + JS.** The page is `life.html` at the site root, loading everything from
`Life/`: paulbrinnel.com/life.html. The page loads the CSVs with `fetch`, so it has to be
served (locally or on the site), not opened as a file.

**Unlisted, always:** found by direct URL only. The page carries `noindex, nofollow`, has
no link-preview tags (`og:`/`twitter:`), and nothing on the site links to it, like
brandon.html and fourkeys.html.

Your target is 4-digit agent counts, and it has to be smooth on a phone as well as the Mac.
Grass counts as agents, and grass will far outnumber the animals: a 300×200 world at 40%
grass is about 24,000 blades. So scale is measured on two counts, **animals** and
**blades**, because they cost very different amounts.

Built this way from day one so we don't have to rewrite later:
- **Grid lookup.** The world is a grid, so finding a neighbor is one array read, not a
  search through every agent. This is the main reason a tile grid scales well.
- **Typed arrays.** Agent data is stored in flat numeric arrays rather than one JS object
  per agent. That's about 5–10× faster at thousands of agents and keeps the phone's
  garbage collector quiet.
- **Grass updates in bulk.** Growth is cheap math per blade; seeding and aging are rolled
  once per in-world hour, not every tick.
- **Animal decisions are staggered.** Each animal re-decides its state a few times a
  second; it moves every tick.
- **Only visible tiles are drawn.** Glyphs are pre-rendered once into an image sheet, and
  the screen draws by copying from it, so zooming out doesn't slow the simulation down.
- **Pathfinding is local.** Because grass blocks, animals need to route around it.
  They path within their `VisionRange` only, never across the whole map.
- **Sight is checked only when deciding.** Line-of-sight through grass is the most
  expensive thing an animal does, so it runs at decision time (a few times a second), not
  every tick.

**Benchmark mode.** This finds the upper limit. It's a button that spawns increasing
numbers of animals and blades, records how long each tick and each frame take, and reports
the largest counts that stay smooth (60 fps at 1×). Run it on the Mac and on your phone.
That gives real numbers for planning.

**Decided at milestone 7: stay on Canvas 2D, on the main thread.** Drawing never cost more
than ~4 ms a frame even with 64,000 animals. The sim sets the limit only at speed: smooth
at 1× to 32,000 animals on the Mac and 64,000 on Paul's iPhone (Safari); at 4,000 animals
it keeps up to ≈16× (Mac) / ≈31× (iPhone). Revisit with a Web Worker if watching at 20×
with more than a few thousand animals matters.

**When to change platforms** (the benchmark tells us):
- Drawing is too slow but the simulation keeps up → switch drawing to WebGL (PixiJS).
  Still a web page.
- The simulation itself is too slow → move it into a Web Worker, then WebAssembly.
  Still a web page.
- Neither is enough, or you want a desktop game → Godot. That's a real port.

**Photosensitivity.** Nothing flashes full-screen or strobes. Animation frames change
only with what an animal is doing (a step, a bite). A pose for an event (a bite, a
mouthful, a flinch, a death) holds for at least a quarter of a second of real time,
whatever the speed, and when the sim runs so fast that steps would flicker, animals
glide in their standing pose instead of cycling their legs.

---

## Milestones

All done (3 Oct 2026). Paul retired the last two, tuning and release, as milestones: the
page is live at its unlisted URL, and tuning and polish carry on as ordinary work.

1. ✓ **Grid + grass.** Blades grow, seed and age; pan, zoom, pause, speed.
2. ✓ **Inspector.** Select a blade or corpse and see its live variables.
3. ✓ **Benchmark mode.** Measure grass alone on the Mac and phone. First scale numbers.
4. ✓ **Bunnies.** Wander, eat, starve, age, die into corpses. Intent lines, event marks.
5. ✓ **Bunny breeding.** Sexes, mating, pregnancy, delayed births.
6. ✓ **Wolves.** Hunting, sprinting and stamina, biting, healing.
7. ✓ **Benchmark again** with animals, then the platform decision (Canvas 2D stays).
   Added along the way: the population graph.

## Tuning notes

The CSV numbers are tuned toward populations that cycle instead of collapsing, in the
tuning lab (`Life/_lab/`, local only; see `Life/MAP.md`), which runs the sim across many
seeds and saves numbers back into `tables/`. What's been found, in order:

- Grass spreading at 30%/day walled bunnies in and hid them from wolves; now 10%/day,
  starting at 15%.
- **Wolves never mated:** they stopped hunting at `HungryAt` 60% but needed
  `MateFullness` 70% to mate, so 0–1 matings happened in 40 days and the wolf breeding
  numbers made no difference at all (a coarse screen of 30 numbers showed it). Wolf
  `HungryAt` is now 80 and `StartWolves` 48: wolves now breed and last ~44 days instead
  of ~30 (4 seeds × 80 days). The loader now warns when `HungryAt` < `MateFullness`.
- Then wolves starved for lack of prey early on: more bunnies at the start
  (`StartBunnies` 450) made them grow instead of crash, and wolves that need less food
  (`HungerRate` 0.6), breed young (`TimeToMature` 3), live long (`Lifespan` 120) and
  see far (`VisionRange` 24) grew fast enough to matter.
- Then bunnies boomed past 10,000 and ate the grass bare by about day 17. Bunnies
  living 7 days instead of 20 (litters unchanged at 2–4) slowed the boom enough:
  6 of 6 seeds kept all three species for 90 days, and on 12 fresh seeds every one
  passed 80 days (shortest 95, average 115; 2 went the full 150). Today's numbers before
  these changes lost their wolves by day 11–15 on the same seeds.
- Past about day 100 the cycles grow until wolves over-hunt the bunnies to zero or
  crash after them. Damping the wolves helped most: `HungerRate` 0.9 and `VisionRange`
  16 (from 0.6 and 24) kept all three species 162 of 200 days on average on 12 fresh
  seeds (3 reached 200), against 137 days (2 reached 200) before. Bunny and grass
  numbers have become touchy: halving or doubling any of them breaks the balance.
- The real trap was grass: once bunnies stripped it, it could only come back from the
  blades left, so bunnies starved and wolves followed. Letting empty tiles sprout on
  their own (`SproutChance`) fixed most of that, but only when it's rare: on 12 fresh
  seeds 9 of 12 kept all three species for 200 days (average 190 days), against 3 of
  12 (162 days) without it. 0.05% and 0.2% did nearly as well (6 and 9 of 12). From
  0.5% up, grass refills the open ground faster than bunnies can clear it, walls the
  wolves off from their prey, and wolves die out (by day 20 at 2%).
- The remaining failures are bunnies eaten to zero or wolves dying out late (days
  145–180), and some survivors end with only a handful of wolves.
- Method that works (Paul): quick gross tests, judged by direction. Wolves not
  increasing means a bad run; runs stop as soon as their direction is clear.
- **Wolves were starving among plenty of bunnies,** not failing to catch them: from about
  day 12, 5–14 wolves starved every 3 days while bunnies tripled. Faster sprints and more
  stamina changed almost nothing; food per bite did. Wolf `BiteFood` 20 (from 10, now saved) kept
  all three species for 200 days on 11 of 12 fresh seeds (average 197 days, wolves ending
  around 100 instead of a handful), against 9 of 12. Harder bites made it worse: a bunny
  that dies in fewer bites feeds a wolf less.
- **Wolves remembering where a bunny hid** (`TrackSeconds`) helped over 50 days (wolves
  1.35× their start instead of 1.1× at the old food, 3.7× instead of 3.2× at `BiteFood`
  20) but not over 200: with `BiteFood` 20, 15 s of memory kept 10 of 12 fresh seeds
  alive against 11 of 12 without. It ships at 0 (off); the rule is there to turn on.
