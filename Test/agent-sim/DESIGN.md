# Agent Sim Test — Design

A predator–prey–resource simulation: bunnies, wolves and blades of grass, each an
independent agent on a tile grid. A sim first; game mechanics come later.

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
- Minimal graphics, early Dwarf Fortress style: one Unicode glyph per agent.
- No terrain besides grass, no day/night, no seasons.

### World
- A tile grid larger than the screen; drag to pan, scroll or pinch to zoom.
- Solid walls at the edges, no wrap-around.
- **One thing per tile:** a blade, a corpse, or an animal. Nothing shares a tile.
- **Movement is 4-directional** (up, down, left, right).
- **Grass blocks movement.** Bunnies eat their way into a meadow; wolves have to go around.
  Expect meadows to become bunny refuges, and expect wolves to sometimes get walled in by
  spreading grass and starve. That's emergent behavior, not a bug.
- Every interaction is with an adjacent tile: eating, biting and mating.
- **Grass blocks sight too.** A bunny inside a meadow can't be seen by wolves and can't
  see out. Sight is a line-of-sight check, up to `VisionRange`.

### Setup
- World size, starting counts and the seed come from `settings.csv` only. Change them
  there and reload; there's no settings panel in the sim.
- **Everything starts at random:** grass scattered evenly, animals placed on random empty
  tiles.
- **Every blade starts as a sprout** at Age 0. The starting blades grow up and die of old
  age together; the first generation dying off as one wave is expected.
- **Seeded:** the same seed gives the same start. Leave `Seed` blank for a new random start
  each run. The seed in use is shown on screen; paste it into `settings.csv` to replay.

### Time
- The sim runs in fixed ticks, separate from drawing, so it runs the same at any speed
  and on any machine.
- 1 day = 20 s at 1× speed. Ages, pregnancies and cooldowns are counted in days.
- Speeds: pause, 1×, 2×, 5×, 20×, and max (as fast as the machine allows).

### Agents
**Bunny (α) and Wolf (Ω)**
- Sexes: male and female. Only a male–female pair can breed.
- Life stages: Baby → Adult → Elder. Only adults breed; babies and elders move slower.
- Pregnancy lasts `PregnancyDays`, then she gives birth on free tiles next to her. If
  there isn't room for the whole litter, **the birth waits** until there is, and she
  can't mate again until it happens.
- Wolves bite for `BiteDamage`. A bitten bunny can escape wounded and heal. Each bite
  feeds the wolf `BiteFood`, so wolves feed as they bite and never eat carcasses.
- Starving: at Fullness 0 an animal loses HP each second and dies when HP reaches 0.
- Death leaves a corpse (†) on the tile, which blocks movement like anything else.
- No genetics yet. Every animal of a species has the same stats. Inheritance comes later.
- **Wolves bite bunnies, and that's the only fighting.** Bunnies never fight back and
  wolves never fight each other.
- **One state at a time.** No eating while fleeing or hunting.
- Pregnancy doesn't slow a female down.

**Grass (░ ▒ ▓)**
- Each tile of grass is one blade. The glyph shows its Size in thirds.
- A blade grows from sprout to full Size, then can seed a new blade on an empty
  4-neighbor tile, and dies of old age at its `Lifespan`.
- Bunny bites shrink a blade, and a blade bitten down to 0 dies.

**Corpses (†)**
- Not eaten by animals; they only feed grass.
- A corpse holds `CorpseNutrient` and decays over `CorpseDecay` days. Until it's gone, grass
  within `CorpseRadius` grows and seeds `CorpseBoost` times faster.

### What the screen shows
- **Glyphs:** α bunny, Ω wolf, ░▒▓ grass by Size, † corpse.
- **Life stage and sex on the map:** babies are drawn smaller and elders in a dimmer
  color; males and females are two shades of their species color.
- **Intent lines:** a faint line from each animal to whatever it's after: wolf → prey,
  bunny → blade, animal → mate, and a line away from the threat for a fleeing bunny.
- **Event marks:** brief marks where bites, births and deaths happen, so they're
  visible at speed. These fade in and out rather than strobing, and the total number on
  screen is capped, so 20× speed can't turn into flicker (see the photosensitivity note
  under Performance).
- **Inspector:** click or tap an agent to select it. A panel shows every variable from
  `variables.csv`, live, and the selection follows the agent as it moves. Clicking empty
  ground clears it. Live values only, no life history.
- **Counts:** live totals of bunnies, wolves, blades and corpses. A population graph over
  time comes later, not in version 1.

---

## Platform and scale

**Built in HTML + JS** in `Test/agent-sim/`, published at paulbrinnel.com/Test/agent-sim/.
The page loads the CSVs with `fetch`, so it has to be served (locally or on the site), not
opened as a file.

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

**When to change platforms** (the benchmark tells us):
- Drawing is too slow but the simulation keeps up → switch drawing to WebGL (PixiJS).
  Still a web page.
- The simulation itself is too slow → move it into a Web Worker, then WebAssembly.
  Still a web page.
- Neither is enough, or you want a desktop game → Godot. That's a real port.

**Photosensitivity.** Event marks never flash full-screen and never strobe. There's a
fixed cap on how many marks can appear per second, whatever the speed.

---

## Milestones

Each one ends with something to watch.

1. **Grid + grass.** Blades grow, seed and age; pan, zoom, pause, speed.
2. **Inspector.** Select a blade or corpse and see its live variables.
3. **Benchmark mode.** Measure grass alone on the Mac and phone. First scale numbers.
4. **Bunnies.** Wander, eat, starve, age, die into corpses. Intent lines, event marks.
5. **Bunny breeding.** Sexes, mating, pregnancy, delayed births.
6. **Wolves.** Hunting, sprinting and stamina, biting, healing.
7. **Benchmark again** with animals, then the platform decision.
8. **Tuning pass.** Adjust the CSV numbers until the populations cycle instead of collapsing.

