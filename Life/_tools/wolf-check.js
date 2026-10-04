'use strict';
// Milestone 6: wolves. Hand-built worlds, then the real world for 60 days (twice).
const fs = require('fs'), path = require('path'), vm = require('vm');
const { SIM_FILES, editCSV } = require('./harness.js');
const ROOT = path.resolve(__dirname, '..');
let bad = 0;
function ok(c, m) { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; }
const near = (a, b, tol) => Math.abs(a - b) <= tol;

function loadAS() {
  const ctx = vm.createContext({ console, crypto: globalThis.crypto });
  vm.runInContext('globalThis.AS = { V: 0 };', ctx);
  const files = SIM_FILES.includes('wolf') ? SIM_FILES : SIM_FILES.concat('wolf');
  for (const f of files) {
    const file = path.join(ROOT, 'js', f + '.js');
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  }
  const texts = {};
  for (const f of ['species', 'variables', 'states', 'settings']) texts[f] = fs.readFileSync(path.join(ROOT, 'tables', f + '.csv'), 'utf8');
  return { AS: ctx.AS, texts };
}
function make(size, seed = 1, hunger = false, edit) {
  const { AS, texts } = loadAS();
  let s = editCSV(texts.settings, 'WorldWidth', 'Value', String(size));
  s = editCSV(s, 'WorldHeight', 'Value', String(size));
  s = editCSV(s, 'StartGrass', 'Value', '0%');
  s = editCSV(s, 'StartBunnies', 'Value', '0');
  s = editCSV(s, 'StartWolves', 'Value', '0');
  texts.settings = s;
  if (!hunger) {
    texts.species = editCSV(texts.species, 'HungerRate', 'Bunny', '0');
    texts.species = editCSV(texts.species, 'HungerRate', 'Wolf', '0');
  }
  texts.species = editCSV(texts.species, 'SeedChance', 'Grass', '0%');
  texts.species = editCSV(texts.species, 'GrowthRate', 'Grass', '0');
  if (edit) edit(texts);
  const { T, errors } = AS.parseTables(texts);
  if (errors.length) throw new Error(errors.join('\n'));
  const sim = AS.Sim(T, seed);
  const events = [], emit = sim.emit;
  sim.emit = (type, tile) => { events.push([type, tile, sim.tickCount]); emit(type, tile); };
  return { AS, T, sim, W: sim.W, B: T.bunny, Wf: T.wolf, events };
}
const at = (W, x, y) => y * W.w + x;
const tick = (sim, n = 1) => { for (let i = 0; i < n; i++) sim.tick(); };
const secs = (AS, s) => Math.round(s * AS.TICK_HZ);
const days = (AS, d) => Math.round(d * AS.TICK_HZ * AS.DAY_SECONDS);
const sname = (sim, s, key) => sim.W.aState[s] === 255 ? 'none' : sim.T.states[key][sim.W.aState[s]].name;
const M = 0, F = 1;
function animal(AS, sim, sp, x, y, sex, o = {}) {
  const W = sim.W, s = AS.spawnStarting(sim, sp, at(W, x, y));
  W.aSex[s] = sex;
  // Default: midway through adulthood, from the tables, so retuning maturity or lifespan
  // can't turn a test's adult into a pup or an elder.
  const S = sim.T[AS.SPECIES_KEY[sp]];
  W.aAge[s] = o.age ?? (S.TimeToMature + S.ElderAt * S.Lifespan) / 2;
  if (o.full != null) W.aFullness[s] = o.full;
  if (o.stamina != null) W.aStamina[s] = o.stamina;
  W.aDecideLeft[s] = 0;
  return s;
}
const wolf = (AS, sim, x, y, o = {}) => animal(AS, sim, AS.SPECIES.WOLF, x, y, o.sex ?? M, o);
const bun = (AS, sim, x, y, o = {}) => animal(AS, sim, AS.SPECIES.BUNNY, x, y, o.sex ?? M, o);
const d2 = (W, a, b) => (W.tx(a) - W.tx(b)) ** 2 + (W.ty(a) - W.ty(b)) ** 2;

// --- the chase, the bites, the kill; bunny side: flee, winded walk, wounds ---
// BiteDamage is pinned below a bunny's HPMax here so the multi-bite path (a wound, the
// healing, several bites to a kill) stays covered; the shipped one-bite kill is tested after.
{
  const { AS, sim, W, B, Wf, events } = make(60, 1, false, tx => { tx.species = editCSV(tx.species, 'BiteDamage', 'Wolf', '8'); });
  const w = wolf(AS, sim, 30, 30, { full: 30 });
  const b = bun(AS, sim, 32, 30);
  const bSer = W.aSerial[b];
  let sprintFar = 0, bunnySprint = 0, bunnyWindedWalk = true, bunnyWinded = false, sawFlee = false, caught = -1, hpAfterFirst = null;
  let fullBefore = W.aFullness[w];
  const biteTicks = [], fullAtBite = [];
  for (let i = 0; i < secs(AS, 40) && caught < 0; i++) {
    const nb0 = events.length;
    const dist2 = W.aAlive[b] ? d2(W, W.aTile[w], W.aTile[b]) : 0;
    tick(sim);
    if (W.aSprint[w] && dist2 > (Wf.SprintRange + 1.5) ** 2) sprintFar++;
    if (W.aAlive[b]) {
      if (sname(sim, b, 'bunny') === 'FLEE') sawFlee = true;
      if (W.aSprint[b]) bunnySprint++;
      if (W.aWinded[b]) { bunnyWinded = true; if (W.aSprint[b]) bunnyWindedWalk = false; }
    }
    for (let k = nb0; k < events.length; k++) if (events[k][0] === AS.EV.BITE) { biteTicks.push(events[k][2]); fullAtBite.push(W.aFullness[w]); if (biteTicks.length === 1) hpAfterFirst = W.aHP[b]; }
    if (!W.aAlive[b]) caught = i;
  }
  ok(sawFlee && bunnySprint > 0, `bunny: FLEE fires and sprints (${bunnySprint} sprint ticks)`);
  ok(bunnyWindedWalk, `bunny: never sprints while winded (winded seen: ${bunnyWinded})`);
  ok(caught >= 0, `chase: the wolf catches the bunny (${(caught / AS.TICK_HZ).toFixed(1)} s)`);
  ok(sprintFar === 0, `chase: sprints only near SprintRange (${sprintFar} far ticks)`);
  // However many bites of BiteDamage it takes to empty HPMax (the tables decide; 8 vs 20
  // is 3), allowing one more for the little healing between bites.
  const killBites = Math.ceil(B.HPMax / Wf.BiteDamage);
  ok(biteTicks.length === killBites || biteTicks.length === killBites + 1, `bites: bunny dies on bite ${biteTicks.length} (BiteDamage ${Wf.BiteDamage}, HPMax ${B.HPMax}, expected ${killBites})`);
  const gaps = biteTicks.slice(1).map((t, i) => t - biteTicks[i]);
  ok(gaps.every(g => g >= Wf.BiteCooldown * AS.TICK_HZ - 1), `bites: never closer than ${Wf.BiteCooldown}s (gaps ${gaps} ticks; a fleeing bunny stretches them)`);
  ok(near(hpAfterFirst, B.HPMax - Wf.BiteDamage, 0.1), `bites: first bite leaves bunny at ${hpAfterFirst.toFixed(2)} HP`);
  // A bite feeds nothing: the wolf eats the carcass afterward (HungerRate is 0 here).
  ok(fullAtBite.every(f => f === 30) && W.aFullness[w] === 30, `bites: no food from a live bunny (Fullness ${W.aFullness[w]} after ${biteTicks.length} bites)`);
  ok(W.aKills[w] === 1 && W.cCount === 1 && W.cSpecies[W.cList[0]] === AS.SPECIES.BUNNY, 'kill: Kills = 1, one bunny corpse');
  ok(events.filter(e => e[0] === AS.EV.BITE).length === biteTicks.length && events.some(e => e[0] === AS.EV.DEATH), 'kill: BITE and DEATH events');
}
{
  // wounds: survive, heal above HealAbove, no heal below it
  const { AS, sim, W, B, Wf } = make(20, 2, false, tx => { tx.species = editCSV(tx.species, 'BiteDamage', 'Wolf', '8'); });
  const w = wolf(AS, sim, 5, 5), b = bun(AS, sim, 6, 5);
  W.aBiteLeft[w] = 0;
  AS.biteAnimal(sim, w, b);
  ok(W.aAlive[b] && near(W.aHP[b], B.HPMax - Wf.BiteDamage, 1e-3), 'wound: one bite leaves HPMax - BiteDamage');
  W.aStepLeft[b] = 1e6; // hold still to heal in place
  W.aFullness[b] = 100;
  const h0 = W.aHP[b];
  W.aStepLeft[w] = 1e6; W.aFullness[w] = 100;
  tick(sim, secs(AS, 4));
  ok(near(W.aHP[b] - h0, 4 * B.HealRate, 0.1), `wound: heals HealRate above HealAbove (+${(W.aHP[b] - h0).toFixed(2)} in 4 s)`);
  W.aFullness[b] = B.HealAbove * B.FullnessMax - 5;
  const h1 = W.aHP[b];
  // HungerRate is 0 here, so Fullness holds
  tick(sim, secs(AS, 3));
  ok(W.aHP[b] === h1, 'wound: no healing below HealAbove');
}
// --- ignores, sight ---
{
  const { AS, sim, W, events } = make(40, 3);
  const w = wolf(AS, sim, 20, 20, { full: 100 }), b = bun(AS, sim, 23, 20);
  W.aStepLeft[b] = 1e6;
  tick(sim, secs(AS, 6));
  ok(sname(sim, w, 'wolf') !== 'HUNT' && !events.some(e => e[0] === AS.EV.BITE), 'fed wolf ignores a bunny in view');
}
{
  const { AS, sim, W, events } = make(40, 3);
  for (let y = 0; y < 40; y++) W.addGrass(at(W, 22, y), 1, 3);
  const w = wolf(AS, sim, 20, 20, { full: 20 }), b = bun(AS, sim, 24, 20);
  W.aStepLeft[b] = 1e6;
  tick(sim, secs(AS, 2));
  ok(sname(sim, w, 'wolf') !== 'HUNT', 'a bunny behind a grass wall is unseen: no HUNT');
}
// --- tracking: a hunting wolf heads for where it last saw its bunny (TrackSeconds) ---
{
  // The bunny is in plain view, the wolf is hunting it, then grass walls go up and the
  // bunny is set down behind the second one: out of sight, and not where it was last seen.
  function scene(track, seed) {
    const g = make(40, seed, false, t => { t.species = editCSV(t.species, 'TrackSeconds', 'Wolf', String(track)); });
    const { AS, sim, W } = g;
    const w = wolf(AS, sim, 6, 20, { full: 20 }), b = bun(AS, sim, 14, 20);
    W.aStepLeft[b] = 1e6;
    tick(sim, secs(AS, 0.4));
    const hunting = sname(sim, w, 'wolf') === 'HUNT' && W.aTargetSlot[w] === b;
    for (let y = 0; y < 40; y++) W.addGrass(at(W, 10, y), 1, 3);
    for (let x = 0; x < 40; x++) if (x !== 10) W.addGrass(at(W, x, 24), 1, 3);
    W.moveAnimal(b, at(W, 14, 27));
    W.aStepLeft[b] = 1e6;
    return { ...g, w, b, hunting, seen: at(W, 14, 20), lostAt: sim.simSeconds };
  }
  const track = 60;
  {
    const { AS, sim, W, w, b, hunting, seen, events } = scene(track, 11);
    ok(hunting, 'track: the wolf hunts the bunny while it is in view');
    let always = true, aimed = true, arrived = -1;
    for (let i = 0; i < secs(AS, 40) && arrived < 0; i++) {
      tick(sim);
      if (W.aTile[w] === seen) { arrived = i; break; }
      if (sname(sim, w, 'wolf') !== 'HUNT') always = false;
      else if (W.aTargetTile[w] !== seen || W.aTargetSlot[w] !== -1) aimed = false;
    }
    ok(arrived >= 0, 'track: the wolf walks to the last-seen tile through the grass');
    ok(always && aimed, 'track: it stays in HUNT, its target the last-seen tile (slot -1), all the way');
    tick(sim, secs(AS, 1));
    ok(sname(sim, w, 'wolf') !== 'HUNT', 'track: arriving without seeing the bunny ends the hunt');
    ok(!events.some(e => e[0] === AS.EV.BITE), 'track: it never bites a bunny it can not see');
  }
  {
    // the bunny comes back into view on the way: the chase resumes and ends in a bite
    const { AS, sim, W, w, b, events } = scene(track, 12);
    tick(sim, secs(AS, 1));
    const still = sname(sim, w, 'wolf') === 'HUNT' && W.aTargetSlot[w] === -1;
    for (let y = 0; y < 40; y++) W.removeGrass(at(W, 10, y)); // clear sight
    for (let x = 0; x < 40; x++) if (x !== 10) W.removeGrass(at(W, x, 24));
    tick(sim, secs(AS, 1));
    ok(still, 'track: searching, before the bunny reappears');
    ok(sname(sim, w, 'wolf') === 'HUNT' && W.aTargetSlot[w] === b, 'track: the bunny reappears and the chase resumes on it');
    tick(sim, secs(AS, 10));
    ok(events.some(e => e[0] === AS.EV.BITE), 'track: the resumed chase ends in a bite');
  }
  {
    // TrackSeconds runs out before the wolf gets there
    const T2 = 2;
    const { AS, sim, W, w, seen, lostAt } = scene(T2, 13);
    let early = true, late = false;
    while (sim.simSeconds < lostAt + T2 + 0.6) {
      tick(sim);
      const hunt = sname(sim, w, 'wolf') === 'HUNT';
      if (sim.simSeconds < lostAt + T2 - 0.5 && !hunt) early = false;
      if (sim.simSeconds >= lostAt + T2 + 0.5 && !hunt) late = true;
    }
    ok(W.aTile[w] !== seen, 'track: (timeout case) the wolf had not reached the tile');
    ok(early && late, `track: gives up TrackSeconds (${T2} s) after losing sight, not before`);
  }
  {
    // 0 forgets at once, as before tracking existed
    const { AS, sim, w } = scene(0, 14);
    ok(sname(sim, w, 'wolf') === 'HUNT', 'track 0: still hunting the instant sight is lost');
    tick(sim, secs(AS, 1));
    ok(sname(sim, w, 'wolf') !== 'HUNT', 'track 0: drops the hunt at the next decision');
  }
}
// --- give up ---
{
  const { AS, sim, W, B, Wf, events } = make(60, 4);
  const w = wolf(AS, sim, 30, 30, { full: 20, stamina: 4 });
  const b = bun(AS, sim, 33, 30);
  let gave = false, bit = false;
  for (let i = 0; i < secs(AS, 5); i++) { tick(sim); if (sname(sim, w, 'wolf') === 'GIVE_UP') gave = true; }
  ok(gave && W.aWinded[w], 'give up: a wolf that runs out of Stamina mid-chase enters GIVE_UP');
  let stillRest = true;
  while (W.aStamina[w] < Wf.RestUntil * Wf.StaminaMax - 5 && sim.tickCount < days(AS, 2)) {
    tick(sim);
    if (sname(sim, w, 'wolf') !== 'GIVE_UP') { stillRest = false; break; }
  }
  ok(stillRest, `give up: it stays in GIVE_UP until Stamina reaches RestUntil (${W.aStamina[w].toFixed(1)})`);
  ok(!events.some(e => e[0] === AS.EV.BITE) && W.aAlive[b] && W.aHP[b] === B.HPMax, 'give up: the bunny got away unbitten');
  tick(sim, secs(AS, 3));
  ok(sname(sim, w, 'wolf') !== 'GIVE_UP' && !W.aWinded[w], `give up: back to normal after rest (${sname(sim, w, 'wolf')})`);
}
// --- prowl ---
{
  const { AS, sim, W, events } = make(40, 5);
  for (let y = 0; y < 40; y++) W.addGrass(at(W, 12, y), 1, 3);
  const w = wolf(AS, sim, 10, 20, { full: 100 });
  W.aDecideLeft[w] = 0;
  tick(sim, 2);
  W.aRunDir[w] = 1; W.aRunLeft[w] = 8;
  W.aStepLeft[w] = 0;
  let chewed = false;
  // run east into the wall; it must turn, not chew
  for (let i = 0; i < secs(AS, 4); i++) { tick(sim); if (events.some(e => e[0] === AS.EV.GRAZE)) chewed = true; if (i === 0) { W.aRunDir[w] = 1; W.aRunLeft[w] = 8; } }
  ok(!chewed, 'prowl: turns at grass in open country, no chewing');
  ok(sname(sim, w, 'wolf') === 'PROWL', 'prowl: state PROWL for a fed wolf');
}
{
  const { AS, sim, W, Wf, events } = make(20, 6);
  const t = at(W, 10, 10);
  for (const [x, y] of [[10, 9], [11, 10], [10, 11], [9, 10]]) W.addGrass(at(W, x, y), 1, 3);
  const w = wolf(AS, sim, 10, 10, { full: 100 });
  const full0 = W.aFullness[w];
  let leftAt = -1;
  for (let i = 0; i < secs(AS, 6) && leftAt < 0; i++) { tick(sim); if (W.aTile[w] !== t) leftAt = i; }
  const grazes = events.filter(e => e[0] === AS.EV.GRAZE);
  ok(leftAt >= 0, `prowl: walled in, it chews its way out (${(leftAt / AS.TICK_HZ).toFixed(1)} s)`);
  ok(grazes.length >= 2 && new Set(grazes.map(e => e[1])).size === 1, `prowl: keeps to one blade (${grazes.length} GRAZE marks)`);
  ok(W.aFullness[w] === full0, 'prowl: chewing feeds nothing');
  ok(grazes.length === Math.ceil(1 / Wf.BiteSize), `prowl: a blade takes ceil(1/BiteSize) bites (${grazes.length})`);
}
// --- chew toward visible prey ---
{
  const { AS, sim, W, events } = make(30, 7);
  const bt = at(W, 9, 9);
  // The west blade is the cheap one; north, east and (7,9) cost a full second to chew, and
  // sight from (8,8) to the bunny stays clear.
  W.addGrass(at(W, 8, 9), 0.3, 3);
  for (const [x, y] of [[9, 8], [10, 9], [7, 9]]) W.addGrass(at(W, x, y), 1, 3);
  for (let x = 2; x <= 8; x++) W.addGrass(at(W, x, 10), 1, 3);
  const w = wolf(AS, sim, 7, 7, { full: 20 }), b = bun(AS, sim, 9, 9);
  W.aStepLeft[b] = 1e6;
  W.aHP[b] = 1000; W.aSprint[b] = 0;
  let firstBite = -1;
  for (let i = 0; i < secs(AS, 8) && firstBite < 0; i++) { tick(sim); W.aStepLeft[b] = 1e6; if (events.some(e => e[0] === AS.EV.BITE)) firstBite = i; }
  for (let i = 0; i < secs(AS, 5); i++) { tick(sim); W.aStepLeft[b] = 1e6; }
  const bt2 = events.filter(e => e[0] === AS.EV.BITE).map(e => e[2]);
  ok(bt2.length >= 4 && bt2.slice(1).every((t, i) => near(t - bt2[i], 0.5 * AS.TICK_HZ, 1)), `bites: a held-still bunny is bitten every BiteCooldown (${bt2.slice(1).map((t, i) => t - bt2[i])} ticks)`);
  const grazes = events.filter(e => e[0] === AS.EV.GRAZE);
  ok(grazes.length > 0 && grazes.every(e => e[1] === at(W, 8, 9)), 'chew-through: hunting wolf chews a 1-blade gap next to the prey');
  ok(firstBite >= 0 && firstBite < secs(AS, 4), `chew-through: bites within ${(firstBite / AS.TICK_HZ).toFixed(1)} s (the detour is 10+ tiles)`);
}
{
  const { AS, sim, W, events } = make(10, 8);
  W.addGrass(at(W, 1, 0), 1, 3); W.addGrass(at(W, 0, 1), 1, 3);
  const w = wolf(AS, sim, 0, 0, { full: 20 }), b = bun(AS, sim, 1, 1);
  W.aStepLeft[b] = 1e6; W.aHP[b] = 1000;
  for (let i = 0; i < secs(AS, 8); i++) { tick(sim); W.aStepLeft[b] = 1e6; }
  ok(events.some(e => e[0] === AS.EV.GRAZE) && events.some(e => e[0] === AS.EV.BITE), 'chew-through: wolf boxed in a corner by grass chews out and bites visible prey');
}
// --- one bite kills; bodies hold meat; FEED ---
{
  // The shipped tables: a single bite kills, and the wolf gains nothing from it.
  const { AS, sim, W, B, Wf, events } = make(20, 21);
  ok(Wf.BiteDamage >= B.HPMax, `one-bite: BiteDamage ${Wf.BiteDamage} reaches a bunny's HPMax ${B.HPMax}`);
  const w = wolf(AS, sim, 5, 5, { full: 30 }), b = bun(AS, sim, 6, 5);
  W.aBiteLeft[w] = 0;
  AS.biteAnimal(sim, w, b);
  const ct = at(W, 6, 5);
  ok(!W.aAlive[b] && W.aKills[w] === 1 && W.kind[ct] === AS.KIND.CORPSE, 'one-bite: the first bite kills and leaves a corpse');
  ok(W.aFullness[w] === 30, 'one-bite: the killing bite feeds nothing');
  ok(W.cMeat[ct] === B.MeatOnBody, `meat: the corpse holds the bunny's MeatOnBody (${W.cMeat[ct]})`);
}
{
  // A starved bunny's body has meat too, and a rotting corpse takes its meat with it.
  const { AS, sim, W, B } = make(20, 22, true);
  const b = bun(AS, sim, 4, 4, { full: 0 });
  W.aHP[b] = 0.01;
  tick(sim, secs(AS, 1));
  ok(!W.aAlive[b] && W.cMeat[at(W, 4, 4)] === B.MeatOnBody, 'meat: a starved bunny leaves a carcass with meat');
  tick(sim, days(AS, B.CorpseDecay) + 5);
  ok(W.kind[at(W, 4, 4)] === AS.KIND.EMPTY && W.cMeat[at(W, 4, 4)] === 0, 'meat: a corpse that rots takes its meat');
}
{
  // Hungry wolf, carcass in sight: walks to it and eats BiteFood per BiteCooldown, past HungryAt.
  // The carcass is pinned big and slow to rot, so it outlasts the meal whatever the tables say.
  const { AS, sim, W, B, Wf, events } = make(40, 23, false, tx => {
    tx.species = editCSV(tx.species, 'MeatOnBody', 'Bunny', '1000');
    tx.species = editCSV(tx.species, 'CorpseDecay', 'Bunny', '10');
  });
  const ct = at(W, 20, 20);
  W.addCorpse(ct, AS.SPECIES.BUNNY); AS.corpseAdded(sim, ct);
  const w = wolf(AS, sim, 26, 20, { full: 10 });
  const meat0 = W.cMeat[ct];
  let fedAt = [], prev = W.aFullness[w], inFeed = true, bad = false, maxF = 0, pastHungry = false;
  for (let i = 0; i < secs(AS, 30); i++) {
    tick(sim);
    const f = W.aFullness[w];
    if (f > prev + 1e-6) fedAt.push([i, f - prev]);
    prev = f;
    if (f > Wf.FullnessMax + 1e-6 || W.cMeat[ct] < 0) bad = true;
    if (f > Wf.HungryAt * Wf.FullnessMax + 1 && sname(sim, w, 'wolf') === 'FEED') pastHungry = true;
    maxF = Math.max(maxF, f);
  }
  ok(fedAt.length >= 3 && fedAt.every(([, d]) => near(d, Wf.BiteFood, 1e-3) || W.aFullness[w] >= Wf.FullnessMax - 1e-3), `feed: each mouthful is BiteFood (${fedAt.length} mouthfuls)`);
  const gaps = fedAt.slice(1).map(([t], i) => t - fedAt[i][0]);
  ok(gaps.every(g => near(g, Wf.BiteCooldown * AS.TICK_HZ, 1)), `feed: a mouthful every BiteCooldown (gaps ${gaps.slice(0, 8)} ticks)`);
  ok(pastHungry, 'feed: keeps eating past HungryAt');
  // HungerRate is 0 here, so every point of Fullness gained is a point of meat lost.
  ok(!bad && near(meat0 - W.cMeat[ct], W.aFullness[w] - 10, 1e-2), 'feed: meat never negative, Fullness never past FullnessMax, meat lost = Fullness gained');
  ok(near(W.aFullness[w], Wf.FullnessMax, 1e-3) && W.cMeat[ct] > 0, `feed: eats until full (${W.aFullness[w].toFixed(1)}), leaving ${W.cMeat[ct].toFixed(0)} meat`);
  ok(sname(sim, w, 'wolf') !== 'FEED', 'feed: a full wolf stops');
  ok(!events.some(e => e[0] === AS.EV.BITE), 'feed: eating a carcass is not a bite on anyone');
}
{
  // Intent line points at the carcass; the bite timer rises per mouthful (what the renderer reads).
  const { AS, sim, W, Wf } = make(40, 24);
  const ct = at(W, 20, 20);
  W.addCorpse(ct, AS.SPECIES.BUNNY); AS.corpseAdded(sim, ct);
  const w = wolf(AS, sim, 23, 20, { full: 10 });
  let rises = 0, prev = 0, aimed = true;
  for (let i = 0; i < secs(AS, 6); i++) {
    tick(sim);
    if (W.aBiteLeft[w] > prev + 1e-6) rises++;
    prev = W.aBiteLeft[w];
    if (sname(sim, w, 'wolf') === 'FEED' && W.aTargetTile[w] !== ct && W.aTargetTile[w] !== -1) aimed = false;
  }
  ok(rises >= 3 && aimed, `feed: target is the carcass tile, bite timer rises per mouthful (${rises})`);
}
{
  // Meat runs out: the wolf takes what is there, never more; a second wolf eats the leftovers.
  const { AS, sim, W, Wf } = make(40, 25);
  const ct = at(W, 20, 20);
  W.addCorpse(ct, AS.SPECIES.BUNNY); AS.corpseAdded(sim, ct);
  W.cMeat[ct] = Wf.BiteFood * 1.5;
  const a = wolf(AS, sim, 22, 20, { full: 10 });
  tick(sim, secs(AS, 8));
  ok(near(W.aFullness[a], 10 + Wf.BiteFood * 1.5, 1e-3) && W.cMeat[ct] === 0, `feed: a wolf eats the meat down to 0, no more (${W.aFullness[a].toFixed(1)}, meat ${W.cMeat[ct]})`);
  ok(sname(sim, a, 'wolf') !== 'FEED' && W.kind[ct] === AS.KIND.CORPSE, 'feed: with the meat gone it leaves the bones');
  // second wolf: half-eaten carcass
  const b = wolf(AS, sim, 18, 20, { full: 10 });
  const ct2 = at(W, 20, 30);
  W.addCorpse(ct2, AS.SPECIES.BUNNY); AS.corpseAdded(sim, ct2);
  W.cMeat[ct2] = 25;
  const c = wolf(AS, sim, 17, 30, { full: 10 });
  tick(sim, secs(AS, 10));
  ok(near(W.aFullness[c], 35, 1e-3) && W.cMeat[ct2] === 0, `feed: leftovers go to the next wolf (${W.aFullness[c].toFixed(1)})`);
}
{
  // Two wolves from different sides of one carcass.
  const { AS, sim, W, Wf } = make(40, 26);
  const ct = at(W, 20, 20);
  W.addCorpse(ct, AS.SPECIES.BUNNY); AS.corpseAdded(sim, ct);
  W.cMeat[ct] = 1000;
  const a = wolf(AS, sim, 15, 20, { full: 10 }), b = wolf(AS, sim, 25, 20, { full: 10 });
  tick(sim, secs(AS, 25));
  ok(W.aFullness[a] > 50 && W.aFullness[b] > 50, `feed: two wolves feed on one carcass (${W.aFullness[a].toFixed(0)}, ${W.aFullness[b].toFixed(0)})`);
}
{
  // A wolf that is not hungry ignores a carcass; a hungry wolf with no carcass in sight does not feed.
  const { AS, sim, W } = make(40, 27);
  const ct = at(W, 20, 20);
  W.addCorpse(ct, AS.SPECIES.BUNNY); AS.corpseAdded(sim, ct);
  const w = wolf(AS, sim, 24, 20, { full: 100 });
  const meat0 = W.cMeat[ct];
  tick(sim, secs(AS, 6));
  ok(sname(sim, w, 'wolf') !== 'FEED' && W.cMeat[ct] === meat0, 'feed: a wolf that is not hungry ignores a carcass');
  const { AS: A2, sim: s2, W: W2 } = make(40, 28);
  const c2 = at(W2, 5, 5);
  W2.addCorpse(c2, A2.SPECIES.BUNNY); A2.corpseAdded(s2, c2);
  const h = wolf(A2, s2, 30, 30, { full: 10 });
  tick(s2, secs(A2, 2));
  ok(sname(s2, h, 'wolf') !== 'FEED', 'feed: a carcass out of sight does not draw a wolf');
}
// --- mating and births ---
{
  const { AS, sim, W, Wf, events } = make(40, 9);
  const m = wolf(AS, sim, 15, 20, { sex: M }), f = wolf(AS, sim, 21, 20, { sex: F });
  const mSer = W.aSerial[m], fSer = W.aSerial[f];
  let t = 0;
  while (W.aLitter[f] === 0 && t < secs(AS, 30)) { tick(sim); t++; }
  ok(W.aLitter[f] > 0, `wolves find each other and mate (${(t / AS.TICK_HZ).toFixed(1)} s)`);
  ok(W.aLitter[f] >= Wf.LitterSize.min && W.aLitter[f] <= Wf.LitterSize.max && near(W.aPregnant[f], Wf.PregnancyDays, 0.01), `mating: litter ${W.aLitter[f]} in ${Wf.LitterSize.min}-${Wf.LitterSize.max}, pregnant ${W.aPregnant[f].toFixed(3)} d`);
  ok(near(W.aFullness[m], 100 - Wf.MateCost * Wf.FullnessMax, 1e-3), 'mating: both pay MateCost');
  const litter = W.aLitter[f];
  while (W.aLitter[f] > 0 && t < days(AS, 4)) { tick(sim); t++; }
  const kids = [];
  for (let s = 0; s < W.aHigh; s++) if (W.aAlive[s] && W.aParentA[s] === fSer) kids.push(s);
  ok(kids.length === litter && kids.every(s => W.aSpecies[s] === AS.SPECIES.WOLF && W.aParentB[s] === mSer), `birth: ${litter} wolf cub(s) with both parents`);
  ok(events.filter(e => e[0] === AS.EV.BIRTH).length === litter && W.aChildren[f] === litter && W.aChildren[m] === litter, 'birth: BIRTH events and Children counts');
  ok(near(W.aMateCd[f], Wf.MateCooldown, 0.05), `birth: MateCooldown ${W.aMateCd[f].toFixed(2)} d starts at birth`);
}

// --- real world, 60 days ---
function realRun() {
  const { AS, texts } = loadAS();
  const { T, errors } = AS.parseTables(texts);
  if (errors.length) throw new Error(errors.join('\n'));
  const c = { bBite: 0, bStarve: 0, bOld: 0, wStarve: 0, wOld: 0, bBirth: 0, wBirth: 0, kills: 0 };
  let inBite = false;
  const kill = AS.killAnimal, bite = AS.biteAnimal;
  AS.biteAnimal = (sim, s, p) => { inBite = true; try { return bite(sim, s, p); } finally { inBite = false; } };
  AS.killAnimal = (sim, s) => {
    const W = sim.W, S = AS.speciesStats(sim, s), isB = W.aSpecies[s] === AS.SPECIES.BUNNY;
    if (inBite) { c.bBite++; c.kills++; }
    else if (W.aAge[s] >= S.Lifespan) isB ? c.bOld++ : c.wOld++;
    else isB ? c.bStarve++ : c.wStarve++;
    kill(sim, s);
  };
  const sim = AS.Sim(T, 12345), W = sim.W;
  const emit = sim.emit;
  sim.emit = (ty, t) => { if (ty === AS.EV.BIRTH) W.kind[t] === AS.KIND.BUNNY ? c.bBirth++ : c.wBirth++; emit(ty, t); };
  const names = T.states.wolf.map(s => s.name);
  const lines = ['day  bunnies  wolves  bBirths  wBirths  kills  bBite  bStarve  bOld  wStarve  wOld  fullB  fullW  ' + names.map(n => n.padEnd(7)).join(' ')];
  lines.push(`  0  ${String(W.bunnies).padStart(7)}  ${String(W.wolves).padStart(6)}`);
  const dayTicks = AS.TICK_HZ * AS.DAY_SECONDS;
  for (let d = 1; d <= 60; d++) {
    for (let i = 0; i < dayTicks; i++) sim.tick();
    if (d % 5) continue;
    let nb = 0, nw = 0, fb = 0, fw = 0; const sc = new Array(names.length).fill(0);
    for (let s = 0; s < W.aHigh; s++) if (W.aAlive[s]) {
      if (W.aSpecies[s] === AS.SPECIES.BUNNY) { nb++; fb += W.aFullness[s]; }
      else { nw++; fw += W.aFullness[s]; if (W.aState[s] !== 255) sc[W.aState[s]]++; }
    }
    const p = (v, n) => String(v).padStart(n);
    lines.push(`${p(d, 3)}  ${p(nb, 7)}  ${p(nw, 6)}  ${p(c.bBirth, 7)}  ${p(c.wBirth, 7)}  ${p(c.kills, 5)}  ${p(c.bBite, 5)}  ${p(c.bStarve, 7)}  ${p(c.bOld, 4)}  ${p(c.wStarve, 7)}  ${p(c.wOld, 4)}  ${(fb / Math.max(1, nb)).toFixed(1).padStart(5)}  ${(fw / Math.max(1, nw)).toFixed(1).padStart(5)}  ` + sc.map(x => ((100 * x / Math.max(1, nw)).toFixed(0) + '%').padEnd(7)).join(' '));
  }
  return { AS, sim, lines };
}
{
  const a = realRun();
  console.log('\nreal world, 60 days\n' + a.lines.join('\n'));
  const b = realRun();
  ok(a.lines.join('\n') === b.lines.join('\n'), 'real: same seed, same 60-day output');
  const h = require('./harness.js');
  h.audit(a.AS, a.sim, 'wolf-check');
  ok(h.failures.length === 0, 'real: grid/store audit clean ' + h.failures.slice(0, 3).join('; '));
}
console.log(bad ? `\nFAIL (${bad})` : '\nALL PASS');
process.exit(bad ? 1 : 0);
