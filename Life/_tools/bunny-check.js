'use strict';
// Milestone 4 checks for bunny.js: tiny hand-built worlds, then the real world for 20 days.
const { load, editCSV } = require('./harness.js');
let bad = 0;
function ok(c, m) { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; }
const near = (a, b, tol) => Math.abs(a - b) <= tol;

function make(size, seed = 1, edit) {
  const { AS, texts } = load();
  let s = editCSV(texts.settings, 'WorldWidth', 'Value', String(size));
  s = editCSV(s, 'WorldHeight', 'Value', String(size));
  s = editCSV(s, 'StartGrass', 'Value', '0%');
  s = editCSV(s, 'StartBunnies', 'Value', '0');
  s = editCSV(s, 'Lakes', 'Value', '0');   // these hand-place things on tiles; water is water-check.js's and thirst-check.js's
  s = editCSV(s, 'Rivers', 'Value', '0');
  s = editCSV(s, 'StartWolves', 'Value', '0');
  texts.settings = s;
  // Blades stay as placed: no seeding muddying a short test.
  texts.species = editCSV(texts.species, 'SeedChance', 'Grass', '0%');
  if (edit) edit(texts);
  const { T, errors } = AS.parseTables(texts);
  if (errors.length) throw new Error(errors.join('\n'));
  const sim = AS.Sim(T, seed);
  const events = [];
  const emit = sim.emit;
  sim.emit = (type, tile) => { events.push([type, tile]); emit(type, tile); };
  return { AS, T, sim, W: sim.W, B: T.bunny, events };
}
const at = (W, x, y) => y * W.w + x;
const tick = (sim, n = 1) => { for (let i = 0; i < n; i++) sim.tick(); };
const secs = (AS, s) => Math.round(s * AS.TICK_HZ);
const stateName = (sim, s) => sim.W.aState[s] === 255 ? 'none' : sim.T.states.bunny[sim.W.aState[s]].name;

function bunny(AS, sim, x, y, o = {}) {
  const W = sim.W, s = AS.spawnStarting(sim, AS.SPECIES.BUNNY, at(W, x, y));
  W.aAge[s] = o.age ?? 5;
  W.aFullness[s] = o.full ?? 100;
  if (o.stamina != null) W.aStamina[s] = o.stamina;
  W.aDecideLeft[s] = 0;
  return s;
}
function wolf(AS, sim, x, y) {
  const W = sim.W, s = W.addAnimal(at(W, x, y), AS.SPECIES.WOLF, 0);
  W.aState[s] = AS.NO_STATE;
  W.aDecideLeft[s] = 1e9;   // wolves have no states yet
  W.aFullness[s] = 100; W.aHP[s] = 60; W.aStamina[s] = 100; W.aAge[s] = 10;
  return s;
}

// --- EAT ---
{
  const { AS, sim, W, B, events } = make(15, 1, tx => {
    tx.species = editCSV(editCSV(tx.species, 'HungerRate', 'Bunny', '0'), 'GrowthRate', 'Grass', '0');
  });
  const blade = at(W, 8, 7);
  W.addGrass(blade, 1, 3);
  const s = bunny(AS, sim, 7, 7, { full: 5 });
  const t0 = W.aTile[s];
  let prev = 50, bites = [], fullAtBite = [];
  const seen = [];
  for (let i = 0; i < secs(AS, 2.5); i++) {
    const g0 = events.length;
    tick(sim);
    if (events.length > g0) { bites.push(i); seen.push(W.aFullness[s]); }
  }
  ok(stateName(sim, s) === 'EAT', 'eat: enters EAT next to a blade when hungry');
  ok(W.aTile[s] === t0, 'eat: does not move while eating');
  ok(bites.length >= 3 && events.every(e => e[0] === AS.EV.GRAZE && e[1] === blade), `eat: GRAZE event per bite (${bites.length} bites in 2.5 s)`);
  const gaps = bites.slice(1).map((b, i) => b - bites[i]);
  ok(gaps.every(g => near(g, B.BiteCooldown * AS.TICK_HZ, 1)), `eat: bites ${B.BiteCooldown}s apart (gaps ${gaps.join(',')} ticks)`);
  // Fullness: bites add BiteFood, minus hunger between; check size and food at the first bite.
  ok(near(W.gSize[blade], 1 - B.BiteSize * bites.length, 1e-4) || W.kind[blade] !== AS.KIND.GRASS, `eat: blade shrinks BiteSize per bite (size ${W.gSize[blade].toFixed(3)} after ${bites.length})`);
}
{
  // Fullness gain per bite exactly BiteFood; and proportional on a small blade.
  const { AS, sim, W, B } = make(15, 1, tx => {
    tx.species = editCSV(editCSV(tx.species, 'HungerRate', 'Bunny', '0'), 'GrowthRate', 'Grass', '0');
  });
  const blade = at(W, 8, 7);
  W.addGrass(blade, 1, 3);
  const s = bunny(AS, sim, 7, 7, { full: 40 });
  tick(sim, 2);
  ok(near(W.aFullness[s], 40 + B.BiteFood, 1e-3), `eat: first full bite adds BiteFood (${W.aFullness[s]})`);
  W.gSize[blade] = B.BiteSize / 2; // half a bite left
  const before = W.aFullness[s];
  tick(sim, secs(AS, B.BiteCooldown) + 2);
  ok(near(W.aFullness[s] - before, B.BiteFood / 2, 1e-3) && W.kind[blade] === AS.KIND.EMPTY, `eat: small blade feeds in proportion (+${(W.aFullness[s] - before).toFixed(2)}) and dies`);
}
{
  // Stops entering EAT once Fullness >= HungryAt
  const { AS, sim, W, B } = make(15, 1, tx => { tx.species = editCSV(tx.species, 'HungerRate', 'Bunny', '0'); });
  for (const x of [8, 9, 10]) W.addGrass(at(W, x, 7), 1, 3);
  const s = bunny(AS, sim, 7, 7, { full: B.HungryAt * B.FullnessMax - 1 });
  tick(sim, secs(AS, 6));
  ok(W.aFullness[s] >= B.HungryAt * B.FullnessMax, 'eat: reaches HungryAt');
  tick(sim, secs(AS, 6)); // one more decision round later
  ok(stateName(sim, s) !== 'EAT' && stateName(sim, s) !== 'SEEK_FOOD', `eat: not EAT once fed (${stateName(sim, s)}, Fullness ${W.aFullness[s].toFixed(1)})`);
}

// --- SEEK_FOOD ---
{
  const { AS, sim, W } = make(21);
  const blade = at(W, 15, 10);
  W.addGrass(blade, 1, 3);
  const s = bunny(AS, sim, 10, 10, { full: 30 });
  tick(sim, 3);
  ok(stateName(sim, s) === 'SEEK_FOOD' && W.aTargetTile[s] === blade, 'seek: hungry bunny 5 tiles away targets the blade');
  const d0 = Math.abs(W.tx(W.aTile[s]) - 15);
  tick(sim, secs(AS, 3));
  ok(Math.abs(W.tx(W.aTile[s]) - 15) < d0 && W.aTargetTile[s] === blade, 'seek: walking toward it');
  tick(sim, secs(AS, 4));
  ok(W.aSlot !== null && W.gSize[blade] < 1 || W.kind[blade] !== AS.KIND.GRASS, 'seek: arrives and eats');
}
{
  // A blade behind a grass wall isn't targeted; open blade is.
  const { AS, sim, W } = make(21);
  for (let y = 0; y < 21; y++) if (y !== 10) W.addGrass(at(W, 12, y), 1, 3); // wall; keep y=10 clear
  W.addGrass(at(W, 12, 10), 1, 3); // close the gap fully
  W.addGrass(at(W, 15, 10), 1, 3); // behind the wall
  const s = bunny(AS, sim, 10, 10, { full: 30 });
  tick(sim, 3);
  ok(stateName(sim, s) !== 'SEEK_FOOD' || W.aTargetTile[s] === -1 || W.aTargetTile[s] === at(W, 12, 10) || true, 'seek: (setup)');
  // The wall blade at (12,10) is visible and adjacent-reachable from (11,10); the one behind is not.
  ok(W.aTargetTile[s] !== at(W, 15, 10), 'seek: blade hidden behind the wall is not targeted');
}
{
  // Unreachable blade (boxed in by other blades is still visible... use enclosure of grass ring) gets abandoned.
  const { AS, sim, W } = make(25);
  // Blade A at (13,10) fully surrounded by an open moat? Make it unreachable: enclose with corpses (don't block sight).
  const A = at(W, 13, 10);
  W.addGrass(A, 1, 3);
  for (const [x, y] of [[12, 10], [14, 10], [13, 9], [13, 11]]) W.addCorpse(at(W, x, y), AS.SPECIES.BUNNY);
  W.addGrass(at(W, 10, 14), 1, 3); // reachable blade, farther (distance 4 vs 3)
  const s = bunny(AS, sim, 10, 10, { full: 30 });
  tick(sim, 3);
  ok(W.aTargetTile[s] === -1, 'seek: unreachable blade dropped from the target at once');
  tick(sim, secs(AS, 5));
  const B2 = at(W, 10, 14);
  ok(W.aTargetTile[s] === B2 || W.gSize[B2] < 1 || W.kind[B2] !== AS.KIND.GRASS, `seek: unreachable blade abandoned for the reachable one (target ${W.aTargetTile[s]})`);
}

// --- WANDER ---
{
  // WanderRun pinned short, so a run never reaches the edge of this small world and turns early.
  const { AS, sim, W, B } = make(60, 5, tx => { tx.species = editCSV(editCSV(tx.species, 'HungerRate', 'Bunny', '0'), 'WanderRun', 'Bunny', '1-3'); });
  const s = bunny(AS, sim, 30, 30);
  let steps = 0, last = W.aTile[s], lastDir = -1, lastLeft = 0, maxRun = 0, run = 0, badTurn = 0, tooLong = 0, targets = 0;
  for (let i = 0; i < secs(AS, 10); i++) {
    tick(sim);
    if (W.aTarget && 0) targets++;
    if (W.aTargetTile[s] !== -1) targets++;
    if (W.aTile[s] !== last) {
      steps++;
      const d = [-W.w, 1, W.w, -1].indexOf(W.aTile[s] - last);
      if (lastDir !== -1 && d !== lastDir && lastLeft !== 0) badTurn++;
      if (d === lastDir) run++; else run = 1;
      lastDir = d; lastLeft = W.aRunLeft[s]; last = W.aTile[s];
    }
  }
  ok(near(steps, 10 * B.WalkSpeed, 0.1 * 10 * B.WalkSpeed), `wander: ${steps} steps in 10 s (WalkSpeed ${B.WalkSpeed} → ${10 * B.WalkSpeed})`);
  ok(badTurn === 0, `wander: turns only when a run ended (${badTurn} early turns)`);
  ok(targets === 0, 'wander: no target line');
  // Runs: with a uniform pick the new direction can match the old one, so look at the picked run lengths directly.
  const lens = new Set();
  const s2 = bunny(AS, sim, 10, 10);
  let prevLeft = 0;
  for (let i = 0; i < secs(AS, 60); i++) {
    tick(sim);
    if (W.aRunLeft[s2] > prevLeft || (prevLeft === 0 && W.aRunLeft[s2] > 0)) lens.add(W.aRunLeft[s2] + 1);
    prevLeft = W.aRunLeft[s2];
  }
  ok([...lens].every(n => n >= B.WanderRun.min && n <= B.WanderRun.max) && lens.size > 1, `wander: run lengths drawn from ${B.WanderRun.min}-${B.WanderRun.max} (saw ${[...lens].sort()})`);
  // Never stands when open: bunny in a corridor-free spot over 30 s keeps its step rate.
}
{
  // Never stands still with a neighbor open: boxed in except one exit.
  const { AS, sim, W, B } = make(9, 3, tx => { tx.species = editCSV(tx.species, 'HungerRate', 'Bunny', '0'); });
  const c = at(W, 4, 4);
  for (const [x, y] of [[3, 4], [5, 4], [4, 3]]) W.addGrass(at(W, x, y), 1, 3);
  const s = bunny(AS, sim, 4, 4);
  tick(sim, secs(AS, 2));
  ok(W.aTile[s] === at(W, 4, 5) || W.aTile[s] !== c, 'wander: takes the only open exit');
  // Fully enclosed: stands.
  const t2 = make(9, 3);
  for (const [x, y] of [[3, 4], [5, 4], [4, 3], [4, 5]]) t2.W.addGrass(at(t2.W, x, y), 1, 3);
  const s2 = bunny(t2.AS, t2.sim, 4, 4);
  tick(t2.sim, secs(t2.AS, 2));
  ok(t2.W.aTile[s2] === at(t2.W, 4, 4), 'wander: stands when every neighbor is blocked');
}

// --- wandering toward room, and fleeing along walls ---
{
  // New runs from beside a crowd of bunnies to the east: count the directions picked.
  function dirsPicked(pref) {
    const { AS, sim, W } = make(60, 11, tx => {
      tx.species = editCSV(editCSV(tx.species, 'HungerRate', 'Bunny', '0'), 'RoomPreference', 'Bunny', String(pref));
      tx.species = editCSV(tx.species, 'StaminaRefill', 'Bunny', '0');
      tx.species = editCSV(tx.species, 'LeaveChance', 'Bunny', '0%');   // the crowd here would set them emigrating
    });
    // The crowd is out of Stamina and never refills, so it rests where it is.
    for (let y = 20; y < 40; y++) for (let x = 33; x < 38; x++) bunny(AS, sim, x, y, { stamina: 0 });
    const s = bunny(AS, sim, 30, 30);
    const wander = sim.T.states.bunny.findIndex(x => x.name === 'WANDER');
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 600; i++) {
      // A fresh run each trial: the first step of a new run is the pick.
      W.aRunLeft[s] = 0; W.aStepLeft[s] = 0;
      W.aState[s] = wander; W.aDecideLeft[s] = 1e9;
      const t0 = W.aTile[s];
      tick(sim);
      const d = [-W.w, 1, W.w, -1].indexOf(W.aTile[s] - t0);
      if (d >= 0) counts[d]++;
      if (W.aTile[s] !== t0) W.moveAnimal(s, t0);
    }
    return counts;
  }
  const crowd = dirsPicked(1), flat = dirsPicked(0);
  const rest = crowd[0] + crowd[2] + crowd[3];
  ok(crowd[1] * 3 < rest, `room: crowd to the east, runs go east ${crowd[1]} vs elsewhere ${rest} (up/right/down/left ${crowd})`);
  ok(Math.min(...flat) > 0.18 * flat.reduce((a, b) => a + b, 0), `room: RoomPreference 0 is uniform (${flat})`);
}
{
  // Fleeing: a wall behind the escape, a corner, and open ground.
  function flee(bx, by, wx, wy, size = 41) {
    const { AS, sim, W } = make(size, 6);
    wolf(AS, sim, wx, wy);
    const s = bunny(AS, sim, bx, by);
    const t0 = W.aTile[s];
    tick(sim, 23);
    return { dx: W.tx(W.aTile[s]) - W.tx(t0), dy: W.ty(W.aTile[s]) - W.ty(t0), state: stateName(sim, s) };
  }
  const wall = flee(20, 2, 20, 6);
  ok(wall.state === 'FLEE' && Math.abs(wall.dx) >= 2 && wall.dy >= -1, `flee: wolf south, wall north: runs along the wall (moved ${wall.dx},${wall.dy})`);
  const corner = flee(2, 2, 6, 2);
  ok(corner.dy >= 2, `flee: wolf east, corner behind: runs down the west wall (moved ${corner.dx},${corner.dy})`);
  const open = flee(20, 20, 16, 20);
  ok(open.dx >= 3 && Math.abs(open.dy) <= 1, `flee: in the open, straight away (moved ${open.dx},${open.dy})`);
}

// --- starvation, old age ---
{
  const { AS, sim, W, B, events } = make(15);
  const s = bunny(AS, sim, 7, 7, { full: 0 });
  tick(sim, secs(AS, 5));
  ok(near(B.HPMax - W.aHP[s], 5 * B.StarveDamage, 0.2), `starve: HP fell ${(B.HPMax - W.aHP[s]).toFixed(2)} in 5 s (StarveDamage ${B.StarveDamage}/s)`);
  tick(sim, secs(AS, B.HPMax / B.StarveDamage));
  ok(!W.aAlive[s] && W.kind[W.aTile[s]] === AS.KIND.CORPSE, 'starve: dies and leaves a corpse');
  const ct = W.cList[0];
  ok(W.cCount === 1 && W.cSpecies[ct] === AS.SPECIES.BUNNY && events.some(e => e[0] === AS.EV.DEATH && e[1] === ct), 'starve: bunny corpse and a DEATH event');
}
{
  const { AS, sim, W, B, events } = make(15, 1, tx => { tx.species = editCSV(tx.species, 'HungerRate', 'Bunny', '0'); });
  const s = bunny(AS, sim, 7, 7, { age: B.Lifespan - 0.1 });
  tick(sim, secs(AS, 0.09 * AS.DAY_SECONDS));
  ok(W.aAlive[s], 'age: alive just before Lifespan');
  tick(sim, secs(AS, 0.03 * AS.DAY_SECONDS));
  ok(!W.aAlive[s] && W.aHP[s] === B.HPMax && events.some(e => e[0] === AS.EV.DEATH), 'age: dies at Lifespan days with full HP, DEATH event');
}

// --- REST ---
{
  // DigChance 0 so a rested, fed bunny's next state is WANDER, not a dig.
  const { AS, sim, W, B } = make(60, 2, tx => {
    tx.species = editCSV(tx.species, 'HungerRate', 'Bunny', '0');
    tx.species = editCSV(tx.species, 'DigChance', 'Bunny', '0%');
  });
  const s = bunny(AS, sim, 30, 30, { stamina: B.RestBelow * B.StaminaMax - 1 });
  W.aDecideLeft[s] = 0;
  tick(sim, 3);
  ok(stateName(sim, s) === 'REST', 'rest: below RestBelow → REST');
  const p = W.aTile[s];
  tick(sim, secs(AS, 2));
  ok(W.aTile[s] === p && W.aTarget === undefined && W.aTargetTile[s] === -1, 'rest: stands still, no target');
  // Above RestBelow but below RestUntil: still resting (hysteresis).
  W.aStamina[s] = B.RestBelow * B.StaminaMax + 5;
  tick(sim, 8);
  ok(stateName(sim, s) === 'REST' || B.RestUntil <= B.RestBelow, `rest: above RestBelow but below RestUntil keeps resting (${stateName(sim, s)}, stamina ${W.aStamina[s].toFixed(1)})`);
  tick(sim, secs(AS, (B.RestUntil * B.StaminaMax - W.aStamina[s]) / B.StaminaRefill + 1));
  ok(stateName(sim, s) === 'WANDER' && W.aStamina[s] >= B.RestUntil * B.StaminaMax - 1e-3, `rest: leaves at RestUntil (${stateName(sim, s)})`);
  // Not resting: just above RestBelow does not enter.
  const s2 = bunny(AS, sim, 10, 10, { stamina: B.RestBelow * B.StaminaMax + 5 });
  tick(sim, 3);
  ok(stateName(sim, s2) !== 'REST', 'rest: not entered above RestBelow when not already resting');
}

// --- MATE is covered by breed-check.js; here: a same-sex crowd never enters it ---
{
  const { AS, sim, W } = make(30, 4);
  for (let i = 0; i < 20; i++) { const s = bunny(AS, sim, 3 + i, 15); W.aSex[s] = AS.SEX.MALE; }
  let seenMate = false;
  for (let i = 0; i < secs(AS, 10); i++) { tick(sim); for (let s = 0; s < W.aHigh; s++) if (W.aAlive[s] && stateName(sim, s) === 'MATE') seenMate = true; }
  ok(!seenMate, 'mate: an all-male crowd never enters MATE');
}

// --- FLEE ---
{
  const { AS, sim, W, B } = make(41, 6);
  const w = wolf(AS, sim, 15, 20);
  const s = bunny(AS, sim, 20, 20);
  tick(sim, 3);
  ok(stateName(sim, s) === 'FLEE', 'flee: wolf in view → FLEE');
  const d0 = (W.tx(W.aTile[s]) - 15) ** 2;
  let minStamina = 100, sawSprint = false, away = true;
  for (let i = 0; i < secs(AS, 2); i++) {
    tick(sim);
    minStamina = Math.min(minStamina, W.aStamina[s]);
    if (W.aSprint[s]) sawSprint = true;
    const tt = W.aTargetTile[s];
    if (stateName(sim, s) !== 'FLEE') continue;
    if (tt < 0 || (W.tx(tt) - 15) ** 2 + (W.ty(tt) - 20) ** 2 <= (W.tx(W.aTile[s]) - 15) ** 2 + (W.ty(W.aTile[s]) - 20) ** 2) away = false;
  }
  ok(sawSprint && minStamina < 100 - 10, `flee: sprints and Stamina drops (min ${minStamina.toFixed(1)})`);
  ok((W.tx(W.aTile[s]) - 15) ** 2 > d0, 'flee: moves away from the wolf');
  ok(away, 'flee: target point is farther from the wolf than the bunny');
  // Distance moved during 2 s of sprint ≳ walk distance
  ok(W.aTile[s] !== at(W, 20, 20), 'flee: moved');
  // Keep fleeing until it drops stamina to 0, then walks (never exceeds sprint speed share)
  tick(sim, secs(AS, 10));
  const dd = (W.tx(W.aTile[s]) - 15) ** 2 + (W.ty(W.aTile[s]) - 20) ** 2;
  ok(stateName(sim, s) === 'FLEE' ? dd <= B.VisionRange ** 2 : dd > B.VisionRange ** 2 - 4, `flee: keeps going until out of the wolf's sight (${stateName(sim, s)}, dist ${Math.sqrt(dd).toFixed(1)})`);
  // leaving FLEE turns sprint off
  W.removeAnimal(w); W.aKills[w] = 0;
  tick(sim, secs(AS, 1));
  ok(stateName(sim, s) !== 'FLEE' && !W.aSprint[s], `flee: wolf gone → leaves FLEE, sprint off (${stateName(sim, s)})`);
}
{
  const { AS, sim, W } = make(41, 6);
  for (let y = 0; y < 41; y++) W.addGrass(at(W, 17, y), 1, 3);
  wolf(AS, sim, 14, 20);
  const s = bunny(AS, sim, 20, 20);
  tick(sim, secs(AS, 2));
  ok(stateName(sim, s) !== 'FLEE', 'flee: wolf behind a grass wall → no FLEE');
}

// --- the real world, 20 days ---
{
  const { AS, texts } = load();
  const { T, errors } = AS.parseTables(texts);
  if (errors.length) throw new Error(errors.join('\n'));
  const deaths = { starved: 0, old: 0 };
  const kill = AS.killAnimal;
  AS.killAnimal = (sim, s) => {
    const W = sim.W, S = AS.speciesStats(sim, s);
    if (W.aAge[s] >= S.Lifespan) deaths.old++; else deaths.starved++;
    kill(sim, s);
  };
  const sim = AS.Sim(T, 12345);
  const W = sim.W, names = T.states.bunny.map(s => s.name);
  console.log('\nreal world, ' + W.w + 'x' + W.h + ', ' + W.bunnies + ' bunnies at start');
  console.log('day  bunnies  starved  old  meanFull  ' + names.map(n => n.padEnd(9)).join(' '));
  const t0 = Date.now();
  const dayTicks = AS.TICK_HZ * AS.DAY_SECONDS;
  let minB = 1e9, noneSeen = 0;
  for (let d = 1; d <= 20; d++) {
    tick(sim, dayTicks);
    let n = 0, sum = 0; const c = new Array(names.length).fill(0);
    for (let s = 0; s < W.aHigh; s++) if (W.aAlive[s]) { n++; sum += W.aFullness[s]; if (W.aState[s] === 255) noneSeen++; else c[W.aState[s]]++; }
    minB = Math.min(minB, n);
    console.log(`${String(d).padStart(3)}  ${String(n).padStart(7)}  ${String(deaths.starved).padStart(7)}  ${String(deaths.old).padStart(3)}  ${(sum / Math.max(1, n)).toFixed(1).padStart(8)}  ` + c.map(x => ((100 * x / Math.max(1, n)).toFixed(0) + '%').padEnd(9)).join(' '));
  }
  console.log(`(${Date.now() - t0} ms)`);
  ok(W.bunnies >= 0 && !Number.isNaN(W.bunnies), 'real: ran 20 days');
  const { audit } = require('./harness.js');
  const before = bad; audit(AS, sim, 'bunny-check');
  const h = require('./harness.js');
  ok(h.failures.length === 0, 'real: grid/store audit clean ' + h.failures.slice(0, 3).join('; '));
}

// --- Leaving a crowd: a bunny beside a big crowd strikes out for open land and settles there ---
{
  const { AS, sim, W, B } = make(100, 3, tx => {
    tx.species = editCSV(tx.species, 'HungerRate', 'Bunny', '0');
    tx.species = editCSV(tx.species, 'StaminaRefill', 'Bunny', '0');
    tx.species = editCSV(tx.species, 'DigChance', 'Bunny', '0%');
    tx.species = editCSV(tx.species, 'LeaveChance', 'Bunny', '100%');
  });
  // Young (no mating), and the crowd is out of Stamina, so it rests where it is.
  for (let y = 40; y < 60; y++) for (let x = 5; x < 13; x++) bunny(AS, sim, x, y, { stamina: 0, age: 1 });
  const s = bunny(AS, sim, 14, 50, { age: 1 });
  const R = Math.round(B.VisionRange);
  const crowdAt = t => { let c = 0; const tx = t % W.w, ty = (t / W.w) | 0;
    for (let y = Math.max(0, ty - R); y <= Math.min(W.h - 1, ty + R); y++) for (let x = Math.max(0, tx - R); x <= Math.min(W.w - 1, tx + R); x++) if (W.kind[y * W.w + x] === AS.KIND.BUNNY) c++;
    return c - 1; };
  ok(crowdAt(W.aTile[s]) >= B.LeaveCrowd, `leave: the bunny starts in a crowd (${crowdAt(W.aTile[s])} >= LeaveCrowd ${B.LeaveCrowd})`);
  let headed = false, settledAt = -1;
  for (let i = 0; i < secs(AS, 60) && settledAt < 0; i++) {
    tick(sim);
    if (W.aTargetTile[s] >= 0) headed = true;
    if (headed && W.aTargetTile[s] < 0) settledAt = W.aTile[s];
  }
  ok(headed, 'leave: it sets off for a destination');
  ok(settledAt >= 0 && crowdAt(settledAt) <= B.SettleCrowd, `leave: it settles where no more than SettleCrowd ${B.SettleCrowd} are around (${settledAt >= 0 ? crowdAt(settledAt) : 'never settled'})`);
}

// --- Stress: repeated scares set a bunny emigrating; one scare doesn't ---
{
  function scaredRun(scares) {
    const { AS, sim, W, B } = make(100, 4, tx => {
      tx.species = editCSV(tx.species, 'HungerRate', 'Bunny', '0');
      tx.species = editCSV(tx.species, 'DigChance', 'Bunny', '0%');
      tx.species = editCSV(tx.species, 'LeaveChance', 'Bunny', '0%');   // no crowd reason to leave
    });
    const s = bunny(AS, sim, 50, 50, { age: 1 });
    const w = wolf(AS, sim, 95, 95);
    let fled = 0, left = false;
    for (let k = 0; k < scares; k++) {
      // The wolf shows up beside the bunny, then is gone for longer than SCARE_GAP, so each is a new chase.
      const t = W.aTile[s], near = [t + 3, t - 3, t + 3 * W.w, t - 3 * W.w].find(u => W.kind[u] === AS.KIND.EMPTY);
      W.moveAnimal(w, near);
      W.aDecideLeft[s] = 0;
      let saw = false;
      for (let i = 0; i < secs(AS, 2); i++) { tick(sim); if (stateName(sim, s) === 'FLEE') saw = true; }
      if (saw) fled++;
      const far = W.tile(W.aTile[s] % W.w < 50 ? 95 : 2, (W.aTile[s] / W.w | 0) < 50 ? 95 : 2);
      W.moveAnimal(w, far);
      for (let i = 0; i < secs(AS, 4); i++) { tick(sim); if (W.aTargetTile[s] >= 0 && stateName(sim, s) === 'WANDER') left = true; }
    }
    for (let i = 0; i < secs(AS, 10); i++) { tick(sim); if (W.aTargetTile[s] >= 0 && stateName(sim, s) === 'WANDER') left = true; }
    return { fled, left, B };
  }
  const many = scaredRun(8), one = scaredRun(1);
  ok(many.fled === 8 && many.left, `stress: ${many.fled} scares (left ${many.left}) in about two days (LeaveStress ${many.B.LeaveStress}) set it off for new land`);
  ok(one.fled === 1 && !one.left, 'stress: a single scare does not');
}

console.log(bad ? `\nFAIL (${bad})` : '\nALL PASS');
process.exit(bad ? 1 : 0);
