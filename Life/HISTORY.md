# Life — History

Why the rules are what they are: what was measured, what was tried and dropped, and how the
numbers got where they are. The rules themselves are in DESIGN.md; this file is the record
behind them. Add to it when a change is measured or an idea is rejected, newest last in
its section.

Quick tests are "gross tests" (Paul's method): a few seeds for a few weeks of world time,
judged by direction. Wolves not increasing means a bad run, and runs stop as soon as their
direction is clear.

---

## Decisions and what they replaced

### Looks
- **Sprites over glyphs** (3 Oct 2026): 8×8 pixel sprites replaced the original font
  glyphs.
- **Carcass and skull** (Paul's pick): a body lies flat with its eye shut, then a skull;
  chosen over bones, X eyes and a legs-up pose.
- **No event marks** (3 Oct 2026): the sprites act out bites, eating, births and deaths
  themselves, so the fading marks that used to flag them were removed.
- **Intent lines off by default**: Paul found them ugly.
- **Topo lines** were chosen over shaded ground in a mockup.
- **Swimming looks** (12 Oct 2026): picked from a mockup of four options (low in the water,
  head and back, each with or without a ring): head and back, with a short wake, sinking
  to the eyes when drowning, wading feet hidden.
- **Locate rings**: a first try was a one-off fade, which Paul swapped for a steady toggle.

### Controls
- **Tabs** (4 Oct 2026) were named Show/Hide and Create/Destroy, then Info, Debug, God, then
  Info, PAINT, Debug (11 Oct). They floated across the top at first, which hid too much of
  the world. Until 12 Oct they were one shared strip, one tab open at a time.
- **Intent lines** moved from Debug to Info (12 Oct 2026). Debug is hidden behind `?debug`
  (12 Oct 2026: not needed for now).
- **PAINT modes** were words until 12 Oct 2026, then icons.
- **Panning past the edge** (12 Oct 2026): zoomed in with windows at the sides, the world's
  edge was stuck to the side of the screen. Half a screen past the edge, no further, so the
  world is never lost.

### World and water
- **Water** (4–5 Oct 2026), on by default since 5 Oct.
- **No fords**: wading is by depth (`WadeDepth`), not by marked crossings.
- **Every edge tile an outlet** combed parallel streams in from every side; water now leaves
  only at `RiverMouths` places, so valleys gather into branching systems.
- **Shore grass blocked drinking**, so water is ringed by a bare beach.
- **Ground grown, water by physics** (11–12 Oct 2026): realistic river beds, consistent
  water rules, nothing faked, and nothing settling to watch on day 1.
- **Water keeps running in play** (12 Oct 2026). Longer steps let rain and springs arrive in
  lumps that drained away between looks, and thousands of tiles blinked wet and dry; even
  steps see a steady trickle as steady.
- **The shore boost** (grass growing faster near water) was removed (12 Oct 2026).

### Animals
- **One-bite kills that fed the wolf on the spot** failed: a wolf's stomach holds 100 and it
  hunts below 80, so most of a big meal was wasted. Now the bite kills and the wolf eats the
  carcass (4 Oct 2026: a wolf doesn't take a nibble and let the rabbit go).
- **Bodies rot within a day** for a bunny: they lingered too long, and a quicker rot also
  leaves wolves less to scavenge.
- **Small game** (wolves eating unseen prey) was rejected as phony.
- **Wolves roaming on a grid heading** (5 Oct 2026) made big packs sweep the map in parallel
  lines; destinations are now in any direction, diagonals included.
- **A shared map of open land** for dispersal felt like a hivemind; each animal now knows
  only its own land.
- **Stress from thirst**: none, since water moves only slowly, so leaving can't fix it.

---

## Measurements behind the rules

### Bunnies keep to their warrens (12 Oct 2026)
Three in four bunnies a wolf caught had no free hole within reach. With home ranges,
hiding longer, eating when desperate, and swimming only toward land they can see,
3 seeds × 20 days: drownings 47-72 → 14-31 a world, thirst and starvation about halved,
bunnies at day 20 587-1,296 → 888-1,486, wolves 94-150 → 126; wolf kills about the same
(145-179 → 166-183).

### Young adults leave home (5 Oct 2026)
Chunks of the map never refilled. Paul first asked for trips of 1/5 to 2/3 of the map;
bunnies live 7 days, and young ones reached a median 37 tiles (90% under 66) before dying
of old age, so none arrived. At 5%-15% of the longer side (22-67 tiles), a third arrive
(median 38 tiles), and 3 seeds kept bunnies 220-682 and wolves 76-98 at day 60.

Detours used to aim at a fixed spot; waiting to reach one chased it forever, so a young
bunny is now home the moment it has gone its own trip length.

With every young bunny leaving alone that far, few settled anywhere with a mate and bunnies
crashed in 2 of 3 seeds (42-77 at day 60). With companions, half of them leaving did better
on average than all (bunnies 119-974 against 65-684 at day 60, bunny squares 8-44 against
3-26); every seed is noisy, and wolves do well on bunnies spread wide (89-142 at day 60).

Spread in squares 30 tiles across (seeds 1-3, day 60, on vs off): bunnies in 30/23/13
against 45/6/28, wolves in 33/36/23 against 34/31/26; wolves start stronger with it
(102-105 at day 20 against 66-72), which presses bunnies. Gross test, 3 seeds × 60 days:
every species alive.

### Bunnies leave big crowds (5 Oct 2026)
They only grew existing colonies, never founded remote ones. What it took, each found by
measuring emigrants in a 30-day run: alone, a settler never found a mate; settling by
`VisionRange` stopped pairs just past their colony's edge, to merge back in; destinations
in dry land sent them home to drink; and bunnies can't cross grass, so they path within
sight toward a tile a few nearer the destination rather than step in a straight line.
Seed 1, day 30: bunnies in 37 of 150 30-tile cells (22 without emigration), and 289 litters
born with 5 or fewer other bunnies near (199). Seeds 2 and 3 were crowded less, so fewer
left, and spread about the same as without. Gross test, 3 seeds × 60 days: every species
alive, bunnies 318-1,548.

### Harassed or hungry bunnies leave (5 Oct 2026)
Two 30-day runs: 128 and 303 stress departures, peak stress about 9. Gross test, 3 seeds ×
60 days: every species alive; bunnies 134-924 at day 60 against 318-1,548 without it, and
wolves 57-80 against 74-91.

### Wolves roam when they find nothing (4–5 Oct 2026)
They circled hunted-out land until they died, and in large numbers they owned the board
and bunnies had no chance. Gross test, water on, 3 seeds × 60 days: before, bunnies died
out in 2 of 3 seeds by day 49; with `RoamHunger` 5, `StarveDamage` 2 and `Lifespan` 60, all
three seeds kept every species (day 60: bunnies 173-1,262, wolves 73-81). Wolves were then
a little weak (Paul), so wolf `RoamAfter` went to 3 days: day 60 wolves 71-111 and rising,
bunnies 322-648.

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

---

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
- **Wolves were starving among plenty of bunnies,** not failing to catch them: from about
  day 12, 5–14 wolves starved every 3 days while bunnies tripled. Faster sprints and more
  stamina changed almost nothing; food per bite did. Wolf `BiteFood` 20 (from 10, now saved) kept
  all three species for 200 days on 11 of 12 fresh seeds (average 197 days, wolves ending
  around 100 instead of a handful), against 9 of 12. Harder bites made it worse: a bunny
  that dies in fewer bites feeds a wolf less.
- **One-bite kills, carcass eating, the meadows start and warren holes** (4 Oct) changed
  the balance at once. Quick tests (3 seeds × 30 days): bunnies barely dug, so warrens
  collapsed within days; `DigChance` 50% and `CollapseDays` 10 keep about 30 holes alive
  at day 30. With refuges, 14 starting wolves were too few (one seed in three lost them);
  `StartWolves` 50 kept all three species on 3 of 3 seeds, wolves still rising at day 30.
- Starting grass used to die back to the meadows' outlines (old blades in the middles all
  died together); evenly spread ages and meadows 55% filled start near where grass
  settles (about 10,000 easing to 7,500 blades over 20 days, against 16,400 crashing to
  6,000).
- **Space and wolf territories:** a 450×300 world at the same density (340 bunnies in 13
  colonies, 112 wolves in 7 packs) kept all three species on 3 of 3 seeds for 30 days,
  against 1 of 3 in the 300×200 world; territories on top kept more bunnies and lost no
  seeds (2 of 3 without). Wolves still drift down from their large start (to 65–104).
- **Wolves bred as fast as bunnies** (both matured in 3 days), so wolf numbers chased
  every bunny boom and overshot; real wolves take years to mature, rabbits months. Wolf
  `TimeToMature` 15 days. Quick test (3 seeds × 30 days): wolves lower early on (0.6× their
  start against 0.7×), all three species on 2 of 3 seeds; adding `MateCooldown` 20 was too
  much (1 of 3). Thirty days is too short to see the overshoot; Paul analyzes longer runs.
- Wandering toward room (`RoomPreference` 1) against random wandering, 3 seeds × 30 days:
  same seeds survived (2 of 3), but wolves held up a little better (0.68× their start
  against 0.60×) and lasted longer on the seed that lost them (day 26 against day 20).
- With wandering toward room, runs reached ~500 days (Paul), limited by wolves dying out.
  Activity-based hunger (`RestHunger` 0.5, `SprintHunger` 1.5) plus wolf `StarveDamage`
  0.4 (was 1): 3 of 3 seeds for 30 days with wolves at 95–96, against 2 of 3 with the old
  rules; each piece alone kept 3 of 3 but with fewer wolves (61–92).
- Hunger and thirst drained too fast (Paul). All species' `HungerRate` and `ThirstRate` at
  1/3 of their old values (bunny hunger 2 → 0.667, wolf 0.9 → 0.3). With water on (3
  seeds × 30 days) 1/3 kept all three species with bunnies 173–554 and wolves 258–335
  (1/2 left one seed with 2 bunnies; the old rates lost the bunnies on 2 seeds). With
  water off it roughly doubles both populations by day 30 (wolves 318–341, bunnies
  1,673–2,564, against 119–172 and 642–923). Thirst is now the main non-age bunny death
  with water on.
- Wolves stayed fragile at low numbers while bunnies and grass bounced back (Paul).
  Wolf `LitterSize` 3–5 (was 1–2) and `MateRange` 80: quick test (3 seeds × 30 days) kept
  3 of 3 either way; litters alone gave the most wolves (1.17× their start), both together
  boomed higher (peak 208) and were falling by day 30 (0.90×). Committed together for
  Paul's long runs; mate range is for scattered survivors, which 30 days can't show.
- Roaming after `RoamAfter` 1 day without seeing a bunny: wolves 1.26× their start at day
  30 (3 of 3 seeds), against 0.90× without roaming and 1.05× roaming after half a day;
  bunnies end a little lower (642–923).
- **Wolves remembering where a bunny hid** (`TrackSeconds`) helped over 50 days (wolves
  1.35× their start instead of 1.1× at the old food, 3.7× instead of 3.2× at `BiteFood`
  20) but not over 200: with `BiteFood` 20, 15 s of memory kept 10 of 12 fresh seeds
  alive against 11 of 12 without. It ships at 0 (off); the rule is there to turn on.
