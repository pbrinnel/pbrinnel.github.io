# Life — Design

A predator–prey–resource simulation: bunnies, wolves and blades of grass, each an
independent agent on a tile grid. A sim first; game mechanics come later. (It began as
"Agent Sim Test" in `Test/agent-sim/`.)

**The goal** is a self-sustaining ecosystem: grass, bunnies and wolves all persisting,
whether the populations settle or keep cycling. The numbers are tuned until the sim does
that; some seeds working out is already a good sign.

**The tables live in CSVs** in `tables/`. Open them in Numbers or Excel. They're the source
of truth: the sim loads them at startup, so editing a number there changes the sim.
(Numbers opens a CSV fine, but to save one use File → Export To → CSV.)

| File | Holds |
|---|---|
| `tables/species.csv` | Every stat, one column per species |
| `tables/variables.csv` | Every variable: what raises it, lowers it, and what happens at the limit |
| `tables/states.csv` | Each species' behaviors in priority order |
| `tables/settings.csv` | World size, starting counts, and the seed |

Every number in `species.csv` and `settings.csv` is a placeholder, there to be tuned by
watching the sim run. Everything else in this doc is decided by Paul; a name and date
says when. Why things are the way they are (measurements, what was tried and dropped, the
tuning so far) is in HISTORY.md.

**Contents:** [Scope](#scope) · [World](#world) · [Making a world](#making-a-world) ·
[Ground and water](#ground-and-water) · [Time](#time) · [Bodies](#bodies) ·
[Hunting and eating](#hunting-and-eating) · [Warrens](#warrens) ·
[Moving and spreading](#moving-and-spreading) · [Humans](#humans) · [Grass](#grass) ·
[Corpses](#corpses) · [Fire and wind (planned)](#fire-and-wind-planned) · [Looks](#looks) · [Controls](#controls) · [PAINT](#paint) ·
[Platform and scale](#platform-and-scale) · [Photosensitivity](#photosensitivity)

---

## Scope
- A simulation you watch. The player's tools are the inspector (select an agent and read
  all of its properties live) and PAINT.
- Pause, plus run-speed control.
- Minimal graphics: small 8×8 pixel sprites, one per agent (3 Oct 2026).
- No day/night, no seasons.

## World
- A tile grid larger than the screen; drag to pan, scroll or pinch to zoom. On a
  keyboard, WASD or the arrow keys pan too (Shift for faster). Zoomed in, the view pans up
  to half a screen past the world's edge, so any edge or corner can be brought to the
  middle, out from under the windows at the sides (12 Oct 2026: no further, so the world is
  never lost); past the edge is darker, with a faint line along it.
- Solid walls at the edges, no wrap-around.
- **A tile has four layers** (Paul, 12 Oct 2026): **Ground** (its height, soil water, a
  warren hole, scorch, beach), always there; **Solid**, at most one: a blade, a corpse or an
  animal; **Flow**, at most one: water (and fire, when it comes); **Air**, always there: the
  wind (later smoke). So a wading wolf is a solid in water's flow, and a burning blade will
  be a solid with fire in its flow; water and fire never share a tile. The layers act on
  each other only through named rules: water drowns grass and carries bodies off; fire will
  burn the solid under it, put out by water; wind will push fire; soil water sets how
  readily things burn.
- **One solid per tile:** a blade, a corpse, or an animal. No two share a tile.
- **Movement is 4-directional** (up, down, left, right).
- Every interaction is with an adjacent tile: eating, biting and mating.
- **Grass blocks movement.** Bunnies eat their way into a meadow. Wolves go around grass
  when that's quicker, and chew through it when chewing is quicker, counting the time the
  bites take, so a wolf is never walled in for good. A wolf's chewing feeds it nothing.
  It bites at `BiteSize` (Wolf column) every `BiteCooldown`, as part of moving to wherever
  it's going, whatever its state; a hunting wolf will chew toward a bunny it can see.
  A prowling wolf has no destination, so when grass blocks its run it turns to an open
  direction if it has one and chews only when walled in. Chewing makes the same faint
  mark as a bunny grazing.
- **Grass blocks sight too.** A bunny inside a meadow can't be seen by wolves and can't
  see out, so a bunny deep in a meadow stays safe there. Sight is a line-of-sight check, up
  to `VisionRange` in a circle. Only grass blocks sight; animals, corpses and water don't.

## Making a world
- World size, starting counts and the seed come from `settings.csv` only. Change them
  there and reload; there's no settings panel in the sim.
- **A lived-in world** (4 Oct 2026; `StartLayout` Meadows): grass in meadows of every size
  with open ground between, the way temperate grassland looks from the air (`StartGrass` is
  the meadow share, `MeadowSize` the size of the largest). Meadows start partly filled with
  blades of every age, as a meadow that has been growing a while is, with a few lone
  seedlings in the open, so the start doesn't die back as one wave.
- Bunnies live in `BunnyColonies` colonies just outside meadow edges; wolves run in
  `WolfPacks` packs out in the open, away from the colonies. Populations start smaller and
  concentrated so animals still meet.
- `StartLayout` Scatter keeps the old even scatter (the benchmark uses it). There, every
  blade starts as a sprout at `StartGrassAge` and Size `SproutSize`, a little above 0, so
  even a sprout feeds a bunny a little; the starting blades grow up and die of old age
  together, as one wave. Scatter has no water.
- **Starting animals** are 50/50 male and female, at random ages within adulthood, with
  full Fullness, HP and Stamina. No humans: they are only painted in.
- **Seeded:** the same seed gives the same start. Leave `Seed` blank for a new random start
  each run. The seed in use is shown on screen; paste it into `settings.csv` to replay.

## Ground and water
**Water** (4–5 Oct 2026) is on by default (`Water` in settings.csv; the Debug tab's Water
button switches it and starts a new world). **The ground is grown, and water settles on it
by physics** (11–12 Oct 2026: realistic river beds, consistent water rules, nothing faked,
and nothing settling to watch on day 1).

- **Growing the ground**, before day 0: the ground starts almost flat and is lifted for
  `GrowRounds` rounds, faster where the world's noise is high (`Hilliness`, `Roughness`: its
  ranges) and near the edge (a rim, the region's watershed), while rivers cut it (stream
  power: wear ∝ how much ground drains through × slope, `RiverCut`) and slopes soften
  (`HillSoften`). Water leaves the map only at `RiverMouths` places on the edge, so valleys
  gather into branching systems running to them. `Bowls` lake basins are pressed in after,
  as glaciers scoop them, and the ground is stretched to `Relief` meters. Then the water
  rules run for `PreRunDays` from a rough first guess.
- **Every world feels different under the same rules:** Relief, Hilliness, Roughness,
  Bowls, RiverMouths and Rain are ranges, and each world draws its own values by its seed.
  Rain 0 makes a dry world.
- **The water rules**, the same on every tile every step: `Rain` falls on every tile (mm a
  day); surface water flows toward lower water surfaces, faster the deeper and steeper
  (Manning, `SurfaceFlow`); it soaks into the soil (`Infiltration`, up to the soil's room,
  30% of `SoilDepth`) and evaporates (`Evaporation`); soil water flows toward a lower water
  table (Darcy, `SoilFlow`) and plants draw it out (`Transpiration`, less as the soil dries);
  full soil pushes its extra up as springs and seeps. A tile is 10 m across.
- **The rules keep running during play** (12 Oct 2026): a short step (36 minutes of the
  world's time) every half second at 1×, each step the same: the exchange, a surface move,
  a soil move. Before day 0 they run in coarse steps to settle quickly, then 10 days of
  play's own steps, so day 0 is already at rest.
- **Water has a depth** (11 Oct 2026), in meters, and depth is the truth: any water makes a
  tile water. A lake's depth is its level minus the ground (it stands level across the
  lake); a river's grows with the ground draining through it. It shows like grass's size:
  shallow water lighter, mid, deep darker (bands at 1 m and 4 m), in the sprites and the far
  view (under a wading animal too), and the properties window gives it (Depth).
- **Rising water** drowns grass, floods warren holes, puts out scorched ground and washes
  corpses away; an animal that dies in water leaves no body. Nukes leave water.
  - **Grass drowns only under standing water** (Paul, 12 Oct 2026; built 13 Oct): a blade
    that water or the beach ring reaches sinks out of sight with its size and age kept; it
    neither grows, seeds, burns nor feeds anyone there. If the tile dries (and leaves the
    beach) within `DrownHours` it comes back as it was; after that it is dead. So water
    that runs over grass and drains off leaves it alive.
- **The beach:** a one-tile bare beach rings all water and moves with the shore. Grass never
  grows there, so animals can always reach water to drink.
- **Wading:** animals wade water up to their `WadeDepth`, at `WadeSpeed`.
- **Swimming** (12 Oct 2026: wolves swim well and rabbits badly, as they do): deeper water
  costs `SwimCost` Stamina a second (no sprinting, no refill) at `SwimSpeed`, and with none
  left `DrownDamage` HP a second. A species with `SwimAt` (wolves, humans) goes in by choice
  with at least that share of its Stamina, so a rested wolf crosses a river after a bunny or
  to a carcass; one without (rabbits) goes in only to flee, and lasts seconds. Animals take
  to deep water only toward land they can see ahead within their swimming reach. Once in,
  an animal carries on while its Stamina is above `RestBelow`, then makes for the nearest
  land; one the water rises over, or with nowhere to go, walks out first.
- **Drinking takes real water:** `WaterLiters` fill a meter, taken from the tile drunk from
  (tiny against a lake; a puddle can be drunk dry), and a wading animal drinks where it
  stands. Thirst itself is under [Bodies](#bodies).
- **Topo lines** show the height: a thin line every 5 m (the viewer's slider picks
  0.5-20 m), every fifth bolder, under grass and animals, off water. The Info tab's toggle
  (kept per viewer, on at first) shows or hides them.

## Time
- The sim runs in fixed ticks, separate from drawing, so it runs the same at any speed
  and on any machine.
- 1 day = 20 s at 1× speed. Ages, pregnancies and cooldowns are counted in days.
- Speeds: pause, 1×, 2×, 5×, 20×, and max (as fast as the machine allows).

## Bodies
For bunnies and wolves (humans differ: see [Humans](#humans)).
- Sexes: male and female. Only a male–female pair can breed.
- Life stages: Baby → Adult → Elder. Only adults breed; babies and elders move slower.
- No genetics yet. Every animal of a species has the same stats. Inheritance comes later.
- **One state at a time.** No eating while fleeing or hunting.
- **Mating** happens the moment two eligible animals of opposite sex are adjacent; the
  partner only has to meet the MATE conditions, whatever it's doing.
- **Pregnancy** lasts `PregnancyDays` and doesn't slow a female down. Then she gives birth
  on free 4-neighbor tiles. If there isn't room for the whole litter, **the birth waits**
  until there is, and she can't mate again until it happens. While she waits she carries
  on as normal; she doesn't go looking for room.
- Newborns start with full Fullness, HP and Stamina, and the litter's two parents as
  Parents.
- **Hunger follows activity** (4 Oct 2026): standing still (resting, hiding, eating in
  place) burns `RestHunger` times `HungerRate`, sprinting `SprintHunger` times, walking
  `HungerRate`. Animals that find no food rest more and so starve slower.
- **Starving:** at Fullness 0 an animal loses `StarveDamage` HP each second and dies when HP
  reaches 0.
- **Thirst** (5 Oct 2026; only in worlds with water): every animal has a water meter that
  drains at `ThirstRate` (scaled by activity like hunger). Below `ThirstyAt` it goes to
  drink, ranked just under fleeing and hiding and above food and mating: it heads for the
  nearest water it knows of (within `WaterSense`, its knowledge of its land), stands on the
  beach (or in the shallows it wades) and drinks `DrinkRate` until full. At an empty meter
  it loses `ThirstDamage` HP a second and can die; a dry animal doesn't heal.
- **Winded:** an animal that runs its Stamina to 0 can't sprint again until its Stamina
  is full.
- Death leaves a corpse on the tile, which blocks movement like anything else.
- **Cause of death** is kept on every corpse and shown in the inspector: Attacked by a
  wolf (or a human), Starved, Died of thirst, Starved and thirsty, Old age.

## Hunting and eating
- **Wolves bite bunnies, and that's the only fighting** (humans aside). Bunnies never fight
  back and wolves never fight each other.
- **A wolf's bite kills** (4 Oct 2026: a wolf doesn't take a nibble and let the rabbit go).
  `BiteDamage` still decides it, and is set to a bunny's full HP. The bite itself feeds
  nothing.
- **Wolves eat the carcass.** A bunny's body holds `MeatOnBody`, whatever killed it. A
  hungry wolf that sees a carcass with meat walks to it and eats `BiteFood` every
  `BiteCooldown`, and keeps eating until it's full or the meat is gone. What's left stays
  for it or another wolf until the corpse rots, which for a bunny is within a day.
- **Who hunts and eats whom is data** (`Prey`, `EatsCarcass`): wolves hunt bunnies and
  humans, humans hunt bunnies and wolves; no species eats its own kind.
- **A hunting wolf remembers where it last saw its bunny** (4 Oct 2026). Grass blocks
  sight, so a bunny can duck out of view; the wolf then walks to the spot where it last saw
  it, picks the chase back up if the bunny reappears, and gives up when it reaches the spot
  and sees nothing or after `TrackSeconds`. Out of sight, it knows only what it last saw.
- **Wolves roam when they find nothing** (4 Oct 2026). A wolf that hasn't seen a bunny for
  `RoamAfter` days heads for a random destination `RoamRun` tiles away in any direction,
  diagonals included, then another, until it finds prey. A roaming wolf is desperate:
  walking costs it `RoamHunger` times the hunger, and starving (`StarveDamage`) kills in a
  day or two, so wolves vacate hunted-out land by leaving or dying instead of patrolling the
  whole map for weeks.
- **Wolves find mates far beyond sight** (4 Oct 2026): a ready wolf senses a ready mate
  within `MateRange` (howling and scent) and travels straight toward it, so wolves thinned
  to a scattered few can still pair up.
- **Wolf territories** (4 Oct 2026): crowded wolves don't breed. A female wolf mates only if
  no more than `PackLimit` other adult wolves are within `TerritoryRange` tiles of her (a
  square). Nothing else about territories exists: wolves still go anywhere and never fight.
  Real packs hold territories and few pairs breed, which keeps wolf numbers at what the land
  can feed instead of overshooting.

## Warrens
- **Warren holes** (4 Oct 2026): bunnies' refuge from wolves, keeping one animal per tile.
  A hole is ground (no grass grows on it) that only bunnies may enter; to a wolf it's a
  wall, and a bunny in one can't be bitten or hunted.
- A fleeing bunny sprints for a free hole within `HoleRange` and hides there.
- Each Meadows colony starts with `HolesPerColony` holes. A fed adult sometimes digs a new
  one (`DigChance` per day, `DigSeconds` to dig) within `WarrenRadius` of its warren, or
  founds a new warren where no hole is near. A hole no bunny has used for `CollapseDays`
  falls in, so warrens grow and die with their colony.
- **Bunnies keep to their warrens** (12 Oct 2026): a bunny grazes within `HomeRange` of a
  hole while it isn't hungrier than `StrayAt` and isn't on a trip, and heads back when it
  strays. It stays in its hole until no hunter has been in sight for `HideSeconds`; hunger
  brings it back out, and one about to die of hunger or thirst (below `DesperateAt`) eats
  or drinks with hunters about.

## Moving and spreading
- **Animals spread toward room** (4 Oct 2026). When a wandering animal picks a direction it
  leans toward the one with fewer of its own kind ahead (`RoomPreference`; 0 = random
  wandering), so crowded colonies and packs leak into empty land. A fleeing bunny with no
  hole in reach picks the escape direction that gains distance without running into a
  wall or corner.
- **Young adults leave home** (natal dispersal, 5 Oct 2026). A bunny or wolf born in the
  world, on growing up, leaves home once with `DisperseChance` for a spot `DisperseRun`
  tiles away (bunnies: near water, by the same knowledge of their land that finds water),
  and is home when it gets there. It is a life stage, not a reaction to crowds, so every
  generation sends explorers out while adults stay put. The first generation, placed where
  the world began, never does.
  - A bunny's trip, leaving home or emigrating, must take it at least `TravelMin` of the
    world's longer side from where it set off before it settles. A young bunny draws its
    own trip length, from `TravelMin` to `DisperseFar` of that side, and is home the moment
    it is that far from where it set off, whatever spot it was aiming at (a detour's new
    spot is measured from where it stands).
  - A leaving bunny takes a companion of the other sex, as an emigrant does.
- **Bunnies leave big crowds** (5 Oct 2026). A wandering bunny, not yet elderly, with
  `LeaveCrowd` or more bunnies within `VisionRange` sets off (`LeaveChance` a day) for
  destinations `RoamRun` tiles away near water, taking the nearest bunny of the other sex
  along, and the pair keeps going until it is near water with no more than `SettleCrowd`
  bunnies within `SettleRange`; then both settle and are content with a crowd again. The
  gap between the two thresholds is the point: they don't stop at the colony's edge, they
  go until they find land nobody uses. Bunnies can't cross grass, so they path within sight
  toward a tile a few nearer the destination.
- **Harassed or hungry bunnies leave too** (5 Oct 2026). Each bunny carries a stress level:
  a scare (starting to flee a hunter, once per chase) adds `ScareStress`, and wandering
  hungry with no grass in sight adds `HungerStress`. It halves every `StressHalfLife` days,
  so one bad chase fades and scares coming faster than that build up. At `LeaveStress` the
  bunny emigrates exactly as a crowded one does, and starts fresh where it settles. Thirst
  adds none.
- **Going around, and giving up** (12 Oct 2026: wolves stood staring at bunnies across a
  river). An animal's path search looks only as far as it can see. When it finds no way to
  where it is going, the animal walks straight at it, and when something is in the way (a
  lake, a river, a crowd) it follows that edge, keeping it on its own side: every animal is
  born left- or right-handed, so two wolves meeting a lake split around it. It leaves the
  edge once it is closer than where it met it, and gives up after `EdgeFollow` steps along
  edges in one trip. Hunters (wolves, humans) then ignore that bunny, carcass or mate for
  `ForgetSeconds` and get on with something else; a bunny's trip picks a new destination.
  Used for every far trip (roaming, leaving home, a mate heard beyond sight), for a chase
  or meal the path search can't reach, and by a bunny following its trip's leader.

## Humans
(4 Oct 2026.) Hunters placed only with HUMAN MODE, as adults; they never breed, so they
last only as long as their lives.
- Marathon runners, not sprinters: a low top speed but stamina that lasts, so they wear
  prey down (persistence hunting).
- One spear strike kills a bunny or a wolf; then they eat the carcass like wolves, and with
  no meat in sight they forage grass for a little food (`GrassFood`). Wolves hunt humans
  too (several bites kill one).
- Like wolves, humans can't enter warren holes and trample through grass.
- Drawn as a little hunter with a spear.
- Humans dying out never ends a run. They're optional and kept quiet: their Info count and
  graph line appear only once a world has had a human.

## Grass
- Each tile of grass is one blade. Its sprite shows its Size in thirds.
- A blade grows from sprout to full Size, then can seed a new blade on an empty
  4-neighbor tile, and dies of old age at its `Lifespan`.
- **Grass needs water** (Paul, 13 Oct 2026): on soil wetter than `GrassWetEnough` of its room
  grass grows, seeds and sprouts at full rate; drier, it slows in step down to `GrassDryFloor`
  on bone-dry soil, so a drought slows grass but never stops it, and reaches the animals
  through their food. A world without water rules is unchanged.
- **Carried seeds fill gaps** (Paul, 13 Oct 2026, so meadows join up and fires run farther):
  a share of seeds (`SeedFar`) is carried 2 to `SeedReach` tiles in a random direction and
  takes root only where other grass shelters it (at least two grass neighbors), else drops
  beside its blade as before. Measured: grass in clumps of 100+ tiles went from 14-18% to
  34-41%, a painted fire burned about 3.5× as far, and the animals stayed in range.
- **A blade seeds only while it's at full Size.** A bitten blade regrows at `GrowthRate`
  and seeds again once it's full, so grazing slows a meadow's spread. Grass
  `TimeToMature` only sets the Lifestage label.
- **Grass can sprout by itself:** each empty tile has a small `SproutChance` per day of
  growing a new blade, so grass can return to land it has lost and can never go extinct
  for good. A nearby corpse speeds that up by `CorpseBoost`, like seeding.
- Grass has only Sprout and Mature, unless `ElderAt` is filled in for Grass.
- Bunny bites shrink a blade, and a blade bitten down to 0 dies. A bite on a blade
  smaller than `BiteSize` feeds the bunny in proportion to what it removed.

## Corpses
- Wolves eat a carcass while it has meat (above); a corpse also feeds grass.
- A corpse holds `CorpseNutrient` and decays over `CorpseDecay` days. Until it's gone, grass
  within a circle of `CorpseRadius` tiles grows and seeds `CorpseBoost` times faster.
- **Grass drinks the Nutrient.** Each unit of extra growth the boost gives a blade costs
  the corpse one unit of Nutrient. The corpse is gone when its Nutrient runs out or
  `CorpseDecay` ends, whichever comes first, so a bigger body feeds more grass.

## Fire and wind (planned)
Decided by Paul, 12 Oct 2026. Wind, fire, animals and fire, and the ash are built;
weather's next part comes next. Fire comes first of the weather systems, and wind is real weather, not an animation.

- **Wind is in the sim** (built). The world has a wind, a direction and a strength that drift
  slowly over the world's time from its seed: breezes most of the time, stronger spells now
  and then, no storms until weather's next part. Grass shows it as **traveling gusts**
  (Paul's pick from a mockup): bands of leaning grass roll across the meadow downwind, more
  often and wider the stronger the wind, upright between them; the old drawing-only gust
  goes. A blade leans for at least 1.2 s of real time once a gust reaches it, and at speeds
  where gusts would flicker, grass shows the average lean instead. Info shows the wind: an
  arrow and words ("breeze, 14 km/h from the west").
- **Fire is a state a tile is in**, like water depth or scorch: a burning blade is still a
  blade, burning down its fuel. Anything on a tile can burn (grass, corpses, animals);
  water never does, and **bare ground doesn't**, so beaches, bare patches and water are
  firebreaks.
- **Spread** to all 8 neighbors, as a chance per second that grows with the neighbor's fuel
  and dryness and with the wind behind it. Dryness comes from the soil water the water rules
  already keep (a setting stands in where there is no water), so droughts need no fire rules
  of their own.
- **How a fire looks** (Paul, from a mockup): what burns stays in view about 80% of its burn,
  charring darker while the fire on it grows (tongues as it catches, taller tongues, then
  flames with it showing through); the last fifth, full flames engulf it; then embers, then
  scorched ground with scattered ash. Each flame sways a pixel at most every 0.8 s on its own
  timer; nothing flashes or brightens all at once.
- **Afterward**, a short scorch (`FireScorchDays`, nothing grows), then the ash makes grass
  regrow faster, as grassland comes back thicker after fire (built 12 Oct 2026; Paul: keep the
  short wait, and wind never moves ash). What burns out leaves ash on its own tile: a blade by
  its Size, a body by its species (`Ash`); a bare ember leaves none, and a nuke vaporizes, so
  it leaves none and clears what was there. Ash works like a corpse's Nutrient: grass on the
  tile grows, seeds and sprouts `AshBoost` times faster, each unit of extra growth spends a
  unit of ash, and where a corpse's boost also reaches, only the larger counts. Ash weathers
  away (`AshHalfLife`) and water washes it off. It shows as gray specks that thin as it goes,
  and only ground that had fuel glows with embers.
- **Grass resprouts from its roots** (Paul, 12 Oct 2026): a burnt blade's roots live through
  the fire with chance `RootSurvive`, and once the scorch is over they put up a small blade
  with chance `ResproutChance` a day (ash or a corpse boosts it as it boosts sprouting). The
  resprout is the same plant, so it keeps the burnt blade's age, and roots that reach the
  grass Lifespan underground die; a burn ages like the meadow around it rather than all at
  once. Water, a dug hole, a nuke or a blade starting there first ends the roots. Roots
  don't show; the properties window has a Roots row.
- **Animals catch fire** (Paul, 12 Oct 2026: anything but water can burn): from a burning
  neighbor, as a chance per hour by how readily its species catches, or when painted. Alight,
  it loses HP every second until its fire burns out or it reaches water, which puts it out;
  if it dies, its body burns on as a corpse (cause: Burned). A burning animal spreads fire to
  the fuel around it like a burning tile, at `SpreadFire` of a tile's rate (Paul, 13 Oct
  2026), so a fleeing animal can carry fire across a firebreak; it doesn't light other
  animals.
- **Animals sense fire and flee it** (built 12 Oct 2026, the ESCAPE state, first for every
  species). Smoke needs no line of sight: a burning tile within `FireSense` is enough, and
  one escaping keeps at it until the fire is a little farther than that. A bunny makes for a
  free hole within `HoleRange` nearer than the fire and sits in it while the fire is near,
  as a hole never burns; the rest sprint straight away from the nearest burning tile, bending
  along a wall. A burning animal makes for water within its `WaterSense`, which puts it out,
  and otherwise runs from the fire (a hole is no help to a bunny already alight). The
  properties window shows Alight: the hours of fire left.
- **Painted fire on bare ground** (Paul, 12 Oct 2026: FIRE MODE should work anywhere but
  water) burns briefly, like a dropped ember, and can light the fuel beside it. Fire never
  spreads onto bare ground by itself, so bare ground is still a firebreak.
- **Starting fires:** one way in, used by PAINT's FIRE MODE now and by lightning and humans
  later.
- **Order:** mockups of the fire and the wind's look; wind; fire; animals and fire; after
  the fire; later, weather's next part (rain that varies, droughts, lightning) and humans
  lighting fires.
- **Rain is local** (Paul, 12 Oct 2026; built 13 Oct): it falls from showers that move with the wind, only
  under them, so the land has wet and dry patches instead of the even rain every tile gets
  now. At the map's size (4.5 × 3 km) a real shower, a few km across at the wind's speed,
  crosses it in well under an in-world hour, so showers are physical and leave wet swaths
  downwind; the look shows what they do (wet ground along a swath, rain streaks under a
  shower, water rising), not slow-drifting clouds, which would be faked and could sweep the
  screen like a flash. On top, wet and dry spells over days, from the world's seed like the
  wind; over the long run a world still gets its `Rain`.
- **Looks** (Paul, from the weather mockup): rain C (local, as above), drought E (grass
  fades toward straw as its soil dries), lightning L1 (a dim, muted bolt that fades, never
  a flash; the strike lights a fire through the one way fire starts).
  From the second mockup (Paul): the wet darkening should be stronger, and a passing
  shower's rain streaks stay on screen longer than its true crossing (about a second at
  least), so they don't read as a twitch.
- **Lightning shouldn't be drowned out** (Paul, 12 Oct 2026; built 13 Oct): a storm's own rain mustn't stop
  the fire it starts from spreading much. Measured: removing a storm's rain changed its
  fires' size by 0.4%. A share of showers are storms (`StormShare`, more in dry spells);
  strikes land in a ring around and ahead of the storm and light fuel with the soil's
  dryness as the chance, a few lightning fires a month on a typical world. As in real storms, strikes can land outside the
  rain core, around and ahead of the shower, and in dry spells storms are mostly dry
  lightning (little rain reaching the ground); a passing shower is brief anyway.
- **Built 13 Oct:** wet soil darkens ground and grass, dry soil turns grass toward straw in
  three steps, both from the soil water fire reads, eased so no tile changes faster than
  every couple of seconds; rain streaks under showers, held at least `STREAK_HOLD_MS`; the
  L1 bolt, at most one every `BOLT_GAP_MS`; Info's Weather row ("storm", "rain, 6 mm
  today", "showers nearby", "dry for 9 days", "clear"). A shower's swath shows plainly after
  a dry spell and hardly at all in a wet one (the soil is already damp); Paul to judge.
- **Rain animation R5 without the haze** (Paul, 13 Oct 2026, built; the first streaks vibrated at
  any speed but 1×): softer, sparser streaks plus ripples on water and splashes on ground,
  all moving on real time so they look the same at every sim speed; only where it rains
  follows the sim. Every shower leaves a visible swath: ground darkens where the soil is
  wetter than it has been lately, then eases back.
- **Lightning more dramatic, even if less realistic** (Paul, 13 Oct 2026, built: the first bolt was
  barely perceptible): a bolder bolt with branches and a local glow and scorch where it
  lands, still never a full-screen flash, still rate-limited.
- **Order:** showers and spells; drought you can see; lightning.

## Looks
- **Sprites:** 8×8 pixel art drawn in code, no image files: a bunny, a wolf (pointed ears,
  long snout, amber eye), grass as tufts in three heights by Size. A body with meat on it
  lies flat with its eye shut; once eaten, a skull is left until it rots. Animals face the
  way they last stepped sideways.
- **Life stage and sex on the map:** babies are drawn smaller and elders in a dimmer
  color; males and females are two shades of their species color.
- **Wolves are gray** (12 Oct 2026), up close and in the far view, so they never share a hue
  with water. The graph and the map's location rings keep the wolves' blue.
- **Animals move like animals.** Bunnies stretch and hop a pixel mid-step; wolves stride
  and bob a pixel. Standing animals now and then flick an ear or wag the tail, each on
  its own timer so they never move in unison. Frames change with movement, at walking
  pace, so nothing blinks. Animals glide between tiles: the sim moves them a whole tile
  at a time, and drawing slides the sprite across during each step.
- **Animals act out what they do:** a wolf lunges with its jaw open when it bites and the
  bunny flinches; a bunny puts its head down for each mouthful; sprinters gallop with ears
  back; resting animals lie down, and a winded wolf pants; a wolf's body lies there for a
  moment before it becomes a skull; a pregnant female has a rounder belly; a newborn hops;
  a mating pair turns to face each other. No event marks (3 Oct 2026): the sprites act it
  all out.
- **In water** (12 Oct 2026): a swimmer sits low, its head and the top of its back above a
  lighter waterline, its legs under, bobbing one sprite pixel every 0.8 s, with a short
  fading V wake behind it when it swims sideways; a drowning one (no Stamina) sinks to its
  eyes and stops bobbing; a wading animal's feet are hidden under the waterline.
- **Wind** (12 Oct 2026; see [Fire and wind](#fire-and-wind-planned)): the world's wind
  shows as traveling gusts: bands of leaning tufts rolling downwind, upright between them;
  calm, the grass is still.
- **Zoomed far out,** once tiles are too small for a sprite to read, each tile becomes a
  solid square: grass shaded by height on dark ground, animals in brighter colors so herds
  and hunters stand out. Sprites come back as you zoom in.
- **Intent lines:** a faint line from an animal to whatever it's after: wolf → prey, bunny
  → blade, animal → mate, and a line away from the threat for a fleeing bunny. Off by
  default; the Info tab's Intent lines toggle shows them for every animal, and the selected
  animal's own line always shows.

## Controls
- **The bar** always shows Pause, the speeds and the day, then the tabs and Hide UI.
  **Hide UI** shows just the world; a small corner button (or the H key) brings it back.
- **Tabs** (4 Oct 2026): each tab button opens and closes its own window, and any of them
  may be open at once (12 Oct 2026: like the graph and minimap, left open to the side).
  Named by what they hold, in this order (11 Oct 2026): Info, PAINT, and Debug. Each tab is
  a stack of labeled rows (a row's name, its controls under or after it), so new controls
  join a row or start one (the tabs keep growing). On a computer the windows float: Info
  down the left under the bar, with the graph and minimap to its right unless dragged;
  PAINT in the bottom right corner; Debug on the right. On a phone each open one is a
  sheet under the bar, at most 40% of the screen, scrolling inside itself, stacked. Which
  are open is kept per viewer.
  - **Info:** everything in it toggles what you see. **Counts** of bunnies, wolves, humans,
    the total, blades and corpses (each count also rings its kind on the map: see Finding
    things), with "(click to highlight on map)" under them. **Overlays:** Topo lines and their spacing (0.5 to
    20 m), and Intent lines (12 Oct 2026). **Properties: Off, Click or Hover**: no
    properties window; click or tap something to see it; or the window shows whatever the
    mouse is over (a tap still picks, so a phone works as with Click). Kept per viewer.
    **Inspect Empty Tiles**, also kept per viewer, lets a click or hover on bare ground pick
    the tile itself. **Tables:** the table-warnings button, when there are any.
  - **The bar's window buttons** (Paul, 12 Oct 2026): Info, Paint, Graph, Map, side by side
    with a small icon each, no taller than the bar. Every window can be resized from its
    bottom-right corner, and keeps its size per viewer (desktop; on a phone the graph only).
    Scrollbars are thin and muted.
  - **Lenses** (Paul, 13 Oct 2026; built as mocked, after Civilization VI's lenses and
    RimWorld's overlays): a row of lens buttons in Info (Fire, Water, Weather, Ground,
    Condition, Activity), one on at a time; the rest of the map dims a little and the
    lens's items show in their colors, with a legend (swatch, name, live count, a checkbox
    per item). Big sets tint, small sets and animals ring. Info is for deep dives; the
    graph's legend icons give a quick look (rings that fade out over about 2 s).
  - **Units** (Paul, 13 Oct 2026): a Metric / Imperial toggle in Info, kept per viewer;
    Imperial by default.
    Everywhere a measure shows (wind km/h or mph, rain mm or inches, elevation, water depth
    and topo spacing m or ft, distances km or mi, the loading screen too) follows it; the
    sim and the tables stay metric.
  - **PAINT:** see [PAINT](#paint).
  - **Debug**, only with `?debug` in the address (12 Oct 2026): **World** (Water, the
    seed), **Tools** (Benchmark, the debug tools).
  - On a computer the tab windows, the properties window and the minimap drag by their
    title bars like the graph, their places kept per viewer; a double-click on a title bar
    puts the window back. A phone keeps its sheets.
- **Inspector** (the properties window): click or tap an agent to select it. An animal is
  picked where its sprite is drawn, even mid-step between two tiles. The window shows every
  variable from `variables.csv`, live, and the selection follows the agent as it moves.
  Clicking empty ground clears it. Live values only, no life history. Every selection's
  properties end with a **Tile** section: the ground under it (Position, Elevation, Ground:
  ground, beach, water or warren hole); an empty tile picked shows only those rows.
- **Population graph:** a floating window you drag by its title bar, remembered where you
  left it, plotting grass, bunnies and wolves over the whole run on one chart with a
  logarithmic scale. Scroll and zoom along it to see any part of the run's history; hover
  or tap for the exact counts.
- **Minimap** (11 Oct 2026): the whole world, always zoomed all the way out, in a small
  window with a box on what the screen shows; click or drag on it to go there. Animals of
  the kinds whose rings are on show as dots. Small (2 tiles a pixel) or big (1), by its +/−
  button; open or closed is kept per viewer. Bottom-left on a computer; on a phone, where
  the properties window is a bottom sheet, just under the bar on the right.
- **Finding things** (5 Oct 2026). Each count in the Info tab (bunnies, wolves, humans,
  grass, corpses) is a toggle: on, every one of that kind on the map is ringed in its graph
  color, and the count wears a border of that color. Rings are steady and follow the
  animals, paused or running. They have a minimum size on screen, so they show zoomed far
  out, and animals off the screen get a pip on the edge of the map in their direction (up
  to 200 per kind).
- **A run ends when a species dies out** (4 Oct 2026): the sim pauses and a card says which
  (WOLVES EXTINCT, BUNNIES EXTINCT, GRASS EXTINCT) and on what day, with **New world** and
  **Keep watching** (which resumes and won't ask again about a species already gone). A
  species a world starts without doesn't count.

## PAINT
Keeping the balance becomes the game. **Modes** (the brushes and the nuke), one at a time,
and **Size** (the Radius slider).
- **The modes are icons** (12 Oct 2026): the world's own sprites for grass, rabbit, wolf,
  human, water and fire, and a pixel mushroom cloud for the nuke, which keeps a red edge so it
  never reads as just another brush; each names itself in its tooltip.
- **GRASS MODE, RABBIT MODE, WOLF MODE, HUMAN MODE:** tap to fill a circle of the brush's
  radius, or drag to paint a stroke; every empty tile that can hold it gets a blade or an
  animal of a random age (animals of random sex, from newborn to elder, full and rested;
  humans always adult). Grass skips warren holes, scorch and the beach; wolves and humans
  skip holes. While a paint mode is on, dragging paints instead of panning (pan with the
  keys). While a mode is on, a banner at the bottom says so ("PAINTING: FIRE", "NUKE ARMED")
  with a Stop button, and the map has a steady colored edge (Paul, 12 Oct 2026). Closing the PAINT window turns its mode off, so nothing paints while it's closed
  (Paul, 12 Oct 2026).
- **FIRE MODE** (12 Oct 2026): tap or drag to set everything in the brush's circle alight but
  water and warren holes: grass, bodies and animals catch, and bare ground gets a brief fire
  of its own; it spreads from there by itself.
  Info shows how many tiles are burning (with its ring toggle) once a world has had a fire,
  and the properties window says how far through its burn a blade or body is.
- **WATER MODE** (11 Oct 2026): tap or drag to pour water, 1 m deep, on bare ground or
  grass (which drowns), never on an animal, a corpse, a warren hole or scorched ground;
  blades left on the new shore go too, as the beach stays bare. It goes into the same water
  rules and flows from there; a world made without water gets the rules when first poured
  on.
- **NUKE MODE** (the first "god" feature): while armed, a tap on the world drops a nuke
  there. Everything within its radius is destroyed outright: animals (no corpses), grass,
  corpses, warren holes. The ground stays scorched, with nothing growing or dug, for up to
  `ScorchDays` at the center and less toward the rim, so the crater greens from its edges.
  The blast shows as an expanding ring and a fading orange glow within its circle, never a
  flash.
- **Radius slider:** one size for every mode (Paul, 12 Oct 2026: not one per brush), 0 (a
  single tile, one agent per tap) to 75 tiles, a circle smaller than the crowd limit; it
  starts at `BrushRadius` and is remembered per viewer. Moving it shows a circle
  that size in the middle of the map, held half a second and then faded out over 1.4 s
  (12 Oct 2026).
- **Too many animals, asked first:** the Info tab shows the total of all animals. Painting
  past `AnimalWarnAt` animals stops at the limit and asks, in plain words, whether to keep
  adding, since big crowds slow the sim down on many devices; Keep adding doubles the limit
  for that world. Births never ask.

---

## Platform and scale

**Built in HTML + JS.** The page is `life.html` at the site root, loading everything from
`Life/`: paulbrinnel.com/life.html. The page loads the CSVs with `fetch`, so it has to be
served (locally or on the site), not opened as a file.

**Unlisted, always:** found by direct URL only. The page carries `noindex, nofollow`, has
no link-preview tags (`og:`/`twitter:`), and nothing on the site links to it, like
brandon.html and fourkeys.html.

The target is 4-digit agent counts, smooth on a phone as well as the Mac. Grass counts as
agents, and grass far outnumbers the animals: a 300×200 world at 40% grass is about 24,000
blades. So scale is measured on two counts, **animals** and **blades**, because they cost
very different amounts.

Built this way so it never needs a rewrite:
- **Grid lookup.** The world is a grid, so finding a neighbor is one array read, not a
  search through every agent. This is the main reason a tile grid scales well.
- **Typed arrays.** Agent data is stored in flat numeric arrays rather than one JS object
  per agent. That's about 5–10× faster at thousands of agents and keeps the phone's
  garbage collector quiet.
- **Grass updates in bulk.** Growth, seeding and aging happen once per in-world hour per
  blade, spread over the hour's ticks, not every tick.
- **Animals look only at what is there.** The world keeps a list of each species' animals
  per 8×8-tile block, so an animal looking for hunters, prey or a mate checks the few nearby
  rather than every tile in sight, and a wolf looking for a carcass checks the carcasses.
- **Worlds are made in the background.** Growing the ground and settling the water (about
  5 s) runs in a worker thread, so the page stays alive behind the loading card.
- **Animal decisions are staggered.** Each animal re-decides its state a few times a
  second; it moves every tick.
- **Only visible tiles are drawn.** Sprites are pre-rendered once into an image sheet, and
  the screen draws by copying from it, so zooming out doesn't slow the simulation down.
- **Pathfinding is local.** Because grass blocks, animals need to route around it.
  They path within their `VisionRange` only, never across the whole map.
- **Sight is checked only when deciding.** Line-of-sight through grass is the most
  expensive thing an animal does, so it runs at decision time (a few times a second), not
  every tick.

**Benchmark mode** finds the upper limit. It's a button that spawns increasing numbers of
animals and blades, records how long each tick and each frame take, and reports the largest
counts that stay smooth (60 fps at 1×). Run it on the Mac and on the phone.

**Decided at milestone 7: stay on Canvas 2D, on the main thread** (only world-making has
moved to a worker since). Drawing never cost more than ~4 ms a frame even with 64,000
animals. The sim sets the limit only at speed: smooth at 1× to 32,000 animals on the Mac
and 64,000 on Paul's iPhone (Safari); at 4,000 animals it keeps up to ≈16× (Mac) / ≈31×
(iPhone). Revisit with a Web Worker if watching at 20× with more than a few thousand
animals matters.

**When to change platforms** (the benchmark tells us):
- Drawing is too slow but the simulation keeps up → switch drawing to WebGL (PixiJS).
  Still a web page.
- The simulation itself is too slow → move it into a Web Worker, then WebAssembly.
  Still a web page.
- Neither is enough, or a desktop game is wanted → Godot. That's a real port.

## Photosensitivity
Nothing flashes full-screen or strobes. Animation frames change only with what an animal is
doing (a step, a bite). A pose for an event (a bite, a mouthful, a flinch, a death) holds
for at least a quarter of a second of real time, whatever the speed, and when the sim runs
so fast that steps would flicker, animals glide in their standing pose instead of cycling
their legs. Water never blinks: its rules run in even steps, and its look eases in and out over
`WATER_FADE_MS` of real time (wet or dry and depth band alike), so even at top speed a tile
never completes an on/off cycle in under twice that (Paul, 12 Oct 2026). A lens's dim and tints
ease over `LENS_FADE_MS`. The bob of a swimmer is slow and its wake moves only with it.
