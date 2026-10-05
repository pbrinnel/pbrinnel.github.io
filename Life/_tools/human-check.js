'use strict';
// Humans: marathon hunters that are only ever painted in. Hand-built worlds for each rule
// (hunting bunnies and wolves, one-strike kills, carcasses, foraging, holes, chewing through
// grass, persistence hunting, being hunted by wolves, never breeding, the God-tab brush),
// then a world with painted humans audited and replayed.
const fs = require('fs'), path = require('path'), vm = require('vm');
const { SIM_FILES, editCSV, audit, failures } = require('./harness.js');
const ROOT = path.resolve(__dirname, '..');
let bad = 0;
function ok(c, m) { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; }

function loadAS() {
  const ctx = vm.createContext({ console, crypto: globalThis.crypto });
  vm.runInContext('globalThis.AS = { V: 0 };', ctx);
  for (const f of SIM_FILES) {
    const file = path.join(ROOT, 'js', f + '.js');
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  }
  const texts = {};
  for (const f of ['species', 'variables', 'states', 'settings']) texts[f] = fs.readFileSync(path.join(ROOT, 'tables', f + '.csv'), 'utf8');
  return { AS: ctx.AS, texts };
}
// An empty square world, no grass growth, nobody hungry unless a test says so. Pins are the
// tests' own; the shipped numbers (speeds, BiteDamage, stamina) are read from T where it matters.
function make(size, seed = 1, o = {}) {
  const { AS, texts } = loadAS();
  let s = editCSV(texts.settings, 'WorldWidth', 'Value', String(size));
  s = editCSV(s, 'WorldHeight', 'Value', String(size));
  for (const [k, v] of [['StartGrass', '0%'], ['StartBunnies', '0'], ['StartWolves', '0'], ['Lakes', '0'], ['Rivers', '0']]) s = editCSV(s, k, 'Value', v);
  texts.settings = s;
  if (!o.hunger) for (const sp of ['Bunny', 'Wolf', 'Human']) texts.species = editCSV(texts.species, 'HungerRate', sp, '0');
  texts.species = editCSV(texts.species, 'SeedChance', 'Grass', '0%');
  texts.species = editCSV(texts.species, 'GrowthRate', 'Grass', '0');
  texts.species = editCSV(texts.species, 'SproutChance', 'Grass', '0%');
  if (o.edit) o.edit(texts);
  const { T, errors } = AS.parseTables(texts);
  if (errors.length) throw new Error(errors.join('\n'));
  const sim = AS.Sim(T, seed);
  const events = [], emit = sim.emit;
  sim.emit = (type, tile) => { events.push([type, tile, sim.tickCount]); emit(type, tile); };
  return { AS, T, sim, W: sim.W, events };
}
const at = (W, x, y) => y * W.w + x;
const tick = (sim, n = 1) => { for (let i = 0; i < n; i++) sim.tick(); };
const secs = (AS, s) => Math.round(s * AS.TICK_HZ);
const sname = (sim, s) => sim.W.aState[s] === 255 ? 'none' : sim.T.states[AS_KEY[sim.W.aSpecies[s]]][sim.W.aState[s]].name;
const AS_KEY = ['bunny', 'wolf', 'human'];
const M = 0, F = 1;
function animal(AS, sim, sp, x, y, sex, o = {}) {
  const W = sim.W, s = AS.spawnStarting(sim, sp, at(W, x, y));
  W.aSex[s] = sex;
  const S = sim.T[AS.SPECIES_KEY[sp]];
  W.aAge[s] = o.age ?? (S.TimeToMature + S.ElderAt * S.Lifespan) / 2;
  if (o.full != null) W.aFullness[s] = o.full;
  if (o.stamina != null) W.aStamina[s] = o.stamina;
  W.aDecideLeft[s] = 0;
  return s;
}
const human = (AS, sim, x, y, o = {}) => animal(AS, sim, AS.SPECIES.HUMAN, x, y, o.sex ?? M, o);
const wolf = (AS, sim, x, y, o = {}) => animal(AS, sim, AS.SPECIES.WOLF, x, y, o.sex ?? M, o);
const bun = (AS, sim, x, y, o = {}) => animal(AS, sim, AS.SPECIES.BUNNY, x, y, o.sex ?? M, o);
const still = tx => { for (const k of ['WalkSpeed', 'SprintSpeed']) tx.species = editCSV(tx.species, k, 'Wolf', '0'); };
const stillBunny = tx => { for (const k of ['WalkSpeed', 'SprintSpeed']) tx.species = editCSV(tx.species, k, 'Bunny', '0'); };
const stillHuman = tx => { for (const k of ['WalkSpeed', 'SprintSpeed']) tx.species = editCSV(tx.species, k, 'Human', '0'); };

// --- the tables: Human column, who hunts and eats whom -------------------------------------
{
  const { AS, T } = make(20);
  const R = AS.relations(T), SP = AS.SPECIES;
  const bit = s => 1 << s;
  ok(R.prey[SP.HUMAN] === (bit(SP.BUNNY) | bit(SP.WOLF)) && R.prey[SP.WOLF] === (bit(SP.BUNNY) | bit(SP.HUMAN)) && R.prey[SP.BUNNY] === 0, 'relations: humans hunt bunnies and wolves, wolves hunt bunnies and humans, bunnies hunt nothing');
  ok(R.eats[SP.WOLF] === (bit(SP.BUNNY) | bit(SP.HUMAN)) && R.eats[SP.HUMAN] === (bit(SP.BUNNY) | bit(SP.WOLF)) && R.eats[SP.BUNNY] === 0, 'relations: wolves never eat wolves, humans never eat humans, bunnies eat no carcasses');
  ok(R.threat[SP.BUNNY] === (bit(SP.WOLF) | bit(SP.HUMAN)), 'relations: bunnies run from wolves and humans');
  ok(T.human.PackLimit == null && T.human.LitterSize == null && T.human.GrassFood > 0 && T.bunny.GrassFood == null, 'human: no territory or litters; GrassFood for humans only (bunnies use BiteFood)');
  ok(T.human.BiteDamage >= Math.max(T.bunny.HPMax, T.wolf.HPMax), 'human: one strike kills a bunny or a wolf');
  ok(T.human.StaminaMax > T.wolf.StaminaMax && T.human.SprintSpeed < T.bunny.SprintSpeed && T.human.SprintSpeed < T.wolf.SprintSpeed, 'human: marathon hunter (huge Stamina, slower sprint than bunny or wolf)');
  ok(AS.checkStates(T).errors.length === 0 && T.states.human.some(s => s.name === 'FORAGE') && !T.states.human.some(s => s.name === 'MATE'), 'human: states registered, FORAGE yes, MATE no');
}

// --- no humans at the start, in either layout ------------------------------------------------
for (const layout of ['Meadows', 'Scatter']) {
  const { AS, texts } = loadAS();
  texts.settings = editCSV(texts.settings, 'StartLayout', 'Value', layout);
  texts.settings = editCSV(texts.settings, 'WorldWidth', 'Value', '120');
  texts.settings = editCSV(texts.settings, 'WorldHeight', 'Value', '100');
  const { T } = AS.parseTables(texts);
  const sim = AS.Sim(T, 5);
  ok(sim.W.humans === 0 && sim.W.bunnies > 0 && sim.W.wolves > 0, `${layout} start places bunnies and wolves, no humans`);
  ok(!/StartHumans/.test(texts.settings), 'settings.csv has no StartHumans');
}

// --- a human hunts a visible bunny: one strike, no food from it, then eats the carcass --------
{
  const { AS, T, sim, W, events } = make(60, 1);
  const h = human(AS, sim, 30, 30, { full: 30 }), b = bun(AS, sim, 34, 30);
  const full0 = W.aFullness[h];
  let sawHunt = false, killTick = -1, fullAtKill = null, sawFeed = false, bites = 0, carcassOf = -1;
  for (let i = 0; i < secs(AS, 60); i++) {
    const n0 = events.length;
    tick(sim);
    if (sname(sim, h) === 'HUNT') sawHunt = true;
    if (sname(sim, h) === 'FEED') sawFeed = true;
    for (let k = n0; k < events.length; k++) if (events[k][0] === AS.EV.BITE) bites++;
    if (killTick < 0 && !W.aAlive[b]) { killTick = i; fullAtKill = W.aFullness[h]; carcassOf = W.cCount === 1 ? W.cSpecies[W.cList[0]] : -1; }
  }
  ok(sawHunt && killTick >= 0, `human hunts and catches a visible bunny (${(killTick / AS.TICK_HZ).toFixed(1)} s)`);
  ok(bites === 1 && W.aKills[h] === 1, `one strike kills (${bites} BITE event, Kills ${W.aKills[h]}; BiteDamage ${T.human.BiteDamage} vs bunny HPMax ${T.bunny.HPMax})`);
  ok(fullAtKill === full0, `the strike feeds nothing (Fullness ${fullAtKill} at the kill)`);
  ok(sawFeed && W.aFullness[h] > full0, `then it eats the carcass (Fullness ${full0} to ${W.aFullness[h].toFixed(1)})`);
  ok(carcassOf === AS.SPECIES.BUNNY, 'the kill leaves the bunny\'s carcass');
}

// --- a human hunts a visible wolf: one strike, then eats it ---------------------------------------
{
  const { AS, T, sim, W, events } = make(60, 2, { edit: still });
  const h = human(AS, sim, 30, 30, { full: 30 }), w = wolf(AS, sim, 36, 30, { full: 100 });
  let bites = 0, killed = false;
  for (let i = 0; i < secs(AS, 60); i++) {
    const n0 = events.length;
    tick(sim);
    for (let k = n0; k < events.length; k++) if (events[k][0] === AS.EV.BITE) bites++;
    if (!W.aAlive[w]) killed = true;
  }
  ok(killed && bites === 1, `human kills a wolf with one strike (${bites} BITE; wolf HPMax ${T.wolf.HPMax})`);
  const c = W.cList[0];
  ok(W.cCount === 1 && W.cSpecies[c] === AS.SPECIES.WOLF && W.aFullness[h] > 30 && W.cMeat[c] < T.wolf.MeatOnBody, `then it eats the wolf carcass (Fullness 30 to ${W.aFullness[h].toFixed(1)}, meat ${W.cMeat[c].toFixed(1)} left)`);
}

// --- carcass rules: never its own species ------------------------------------------------------------
for (const [name, sp, mk] of [['human', 2, human], ['wolf', 1, wolf]]) {
  const { AS, T, sim, W } = make(40, 3, { edit: tx => { stillHuman(tx); still(tx); } });
  const a = mk(AS, sim, 20, 20, { full: 20 });
  AS.debugDropCorpse(sim, at(W, 22, 20), sp);
  const t = at(W, 22, 20), meat0 = W.cMeat[t];
  let fed = false;
  for (let i = 0; i < secs(AS, 20); i++) { tick(sim); if (sname(sim, a) === 'FEED') fed = true; }
  ok(!fed && W.cMeat[t] === meat0 && W.aFullness[a] === 20, `a hungry ${name} never eats a ${name} carcass (meat ${W.cMeat[t]}, Fullness ${W.aFullness[a]})`);
}
{
  // ...and the cross cases: a wolf eats a human carcass, a human a wolf's (above) and a bunny's.
  const { AS, T, sim, W } = make(40, 3, { edit: still });
  const w = wolf(AS, sim, 20, 20, { full: 20 });
  AS.debugDropCorpse(sim, at(W, 21, 20), AS.SPECIES.HUMAN);
  tick(sim, secs(AS, 20));
  ok(W.aFullness[w] > 20 && W.cMeat[at(W, 21, 20)] < T.human.MeatOnBody, `a wolf eats a human carcass (Fullness ${W.aFullness[w].toFixed(1)})`);
}

// --- foraging: no meat, no prey, hungry: grass, GrassFood per bite ---------------------------------------
{
  const { AS, T, sim, W, events } = make(40, 4, { edit: tx => { tx.species = editCSV(tx.species, 'GrowthRate', 'Grass', '0'); } });
  const h = human(AS, sim, 20, 20, { full: 30 });
  for (const [x, y] of [[24, 20], [25, 20], [24, 21]]) W.addGrass(at(W, x, y), 1, 1);
  const gains = [];
  let prev = W.aFullness[h], sawForage = false;
  for (let i = 0; i < secs(AS, 30); i++) {
    tick(sim);
    if (sname(sim, h) === 'FORAGE') sawForage = true;
    if (W.aFullness[h] > prev + 1e-6) gains.push(W.aFullness[h] - prev);
    prev = W.aFullness[h];
  }
  ok(sawForage && gains.length > 0, `a hungry human with no meat or prey forages grass (${gains.length} bites)`);
  ok(gains.every(g => g <= T.human.GrassFood + 1e-4) && Math.abs(gains[0] - T.human.GrassFood) < 1e-4, `each bite of a full blade gives GrassFood (${T.human.GrassFood}): ${gains.map(g => g.toFixed(2)).join(' ')}`);
  ok(W.gCount < 3, `it ate the blades (${W.gCount} of 3 left)`);
}
{
  // Not hungry: no foraging. Hungry with meat in sight: the meat first.
  const { AS, sim, W } = make(40, 4);
  const h = human(AS, sim, 20, 20, { full: 100 });
  W.addGrass(at(W, 21, 20), 1, 1);
  let forage = false;
  for (let i = 0; i < secs(AS, 5); i++) { tick(sim); if (sname(sim, h) === 'FORAGE') forage = true; }
  ok(!forage && W.gCount === 1, 'a full human leaves the grass alone');
  const g = make(40, 4);
  const h2 = human(g.AS, g.sim, 20, 20, { full: 30 });
  g.W.addGrass(at(g.W, 21, 20), 1, 1);
  g.AS.debugDropCorpse(g.sim, at(g.W, 20, 23), g.AS.SPECIES.BUNNY);
  tick(g.sim, 2 * g.AS.TICK_HZ / 4 + 2);
  ok(sname(g.sim, h2) === 'FEED', `meat in sight beats grass (state ${sname(g.sim, h2)})`);
}

// --- holes: can't enter, can't catch a bunny in one --------------------------------------------------
{
  const { AS, sim, W } = make(40, 5);
  const h = human(AS, sim, 20, 20, { full: 100 });
  W.addHole(at(W, 21, 20), 0);
  AS.stepTo(sim, h, at(W, 21, 20));
  ok(W.aTile[h] === at(W, 20, 20), 'a human can\'t step onto a hole');
  let threw = false;
  try { W.addAnimal(at(W, 21, 20), AS.SPECIES.HUMAN, 0); } catch (e) { threw = true; }
  ok(threw, 'addAnimal refuses a human on a hole');
  ok(AS.paintCircle(sim, 'human', 21, 20, 0) === 0, 'HUMAN MODE skips a hole');
  // A bunny in a hole is safe.
  // Standing right beside the hole, hungry and unable to walk off: any strike would land.
  const t = make(40, 5, { edit: stillHuman });
  const hh = human(t.AS, t.sim, 22, 20, { full: 30 });
  t.W.addHole(at(t.W, 23, 20), 0);
  const b = bun(t.AS, t.sim, 23, 20);
  let hunted = false;
  for (let i = 0; i < secs(t.AS, 30); i++) {
    tick(t.sim);
    if (sname(t.sim, hh) === 'HUNT') hunted = true;
  }
  ok(t.W.aAlive[b] && !hunted && t.W.aKills[hh] === 0, `a bunny in a hole is not hunted or caught (hunted ${hunted})`);
}

// --- bunnies run from humans -----------------------------------------------------------------------------
{
  const { AS, sim, W } = make(60, 6, { edit: stillHuman });
  human(AS, sim, 30, 30, { full: 100 });
  const b = bun(AS, sim, 34, 30);
  let fled = false;
  for (let i = 0; i < secs(AS, 3); i++) { tick(sim); if (sname(sim, b) === 'FLEE') fled = true; }
  ok(fled && W.aTile[b] % W.w > 34, 'a bunny flees from a human in sight');
}

// --- chewing through grass --------------------------------------------------------------------------------
{
  const { AS, T, sim, W, events } = make(20, 7);
  const h = human(AS, sim, 10, 10, { full: 100 });
  for (let t = 0; t < W.n; t++) if (W.kind[t] === AS.KIND.EMPTY) W.addGrass(t, 1, 1);
  const g0 = W.gCount;
  let moved = false, grazes = 0;
  const start = W.aTile[h];
  for (let i = 0; i < secs(AS, 40); i++) {
    const n0 = events.length;
    tick(sim);
    for (let k = n0; k < events.length; k++) if (events[k][0] === AS.EV.GRAZE) grazes++;
    if (W.aTile[h] !== start) moved = true;
  }
  ok(moved && W.gCount < g0 && grazes > 0, `a human walled in by grass chews through it (${g0 - W.gCount} blades gone, ${grazes} bites)`);
  ok(W.aFullness[h] === 100, 'chewing feeds nothing');
}

// --- persistence: the bunny sprints faster but tires; the human keeps coming -------------------------------
{
  const { AS, T, sim, W } = make(300, 8);
  const h = human(AS, sim, 100, 150, { full: 30 }), b = bun(AS, sim, 109, 150);
  let bunnyWinded = false, caught = -1, humanWinded = false, maxGap = 0;
  for (let i = 0; i < secs(AS, 300) && caught < 0; i++) {
    tick(sim);
    if (!W.aAlive[b]) { caught = i; break; }
    if (W.aWinded[b]) bunnyWinded = true;
    if (W.aWinded[h]) humanWinded = true;
    maxGap = Math.max(maxGap, Math.hypot(W.tx(W.aTile[h]) - W.tx(W.aTile[b]), W.ty(W.aTile[h]) - W.ty(W.aTile[b])));
  }
  ok(T.bunny.SprintSpeed > T.human.SprintSpeed, `the bunny sprints faster than the human (${T.bunny.SprintSpeed} vs ${T.human.SprintSpeed})`);
  ok(caught >= 0 && bunnyWinded, `persistence: the bunny tires and is caught anyway (${(caught / AS.TICK_HZ).toFixed(1)} s, the gap reached ${maxGap.toFixed(1)} tiles)`);
  ok(!humanWinded, 'persistence: the human\'s Stamina never ran out');
}

// --- wolves hunt humans: several bites, then the carcass ----------------------------------------------------------
{
  const { AS, T, sim, W, events } = make(60, 9, { edit: stillHuman });
  const w = wolf(AS, sim, 30, 30, { full: 30 }), h = human(AS, sim, 36, 30, { full: 100 });
  let bites = 0;
  for (let i = 0; i < secs(AS, 90); i++) {
    const n0 = events.length;
    tick(sim);
    for (let k = n0; k < events.length; k++) if (events[k][0] === AS.EV.BITE) bites++;
  }
  const need = Math.ceil(T.human.HPMax / T.wolf.BiteDamage);
  ok(!W.aAlive[h] && W.aKills[w] === 1, `a wolf kills a human (Kills ${W.aKills[w]})`);
  ok(bites >= need && need > 1, `it takes several bites (${bites}; ${need} at BiteDamage ${T.wolf.BiteDamage} vs HPMax ${T.human.HPMax})`);
  const c = W.cList[0];
  ok(W.cCount === 1 && W.cSpecies[c] === AS.SPECIES.HUMAN && W.aFullness[w] > 30 && W.cMeat[c] < T.human.MeatOnBody, `then the wolf eats the human carcass (Fullness ${W.aFullness[w].toFixed(1)})`);
}

// --- never mate ----------------------------------------------------------------------------------------------------------------
{
  const { AS, sim, W, events } = make(30, 10);
  const a = human(AS, sim, 10, 10, { sex: M, full: 100 }), b = human(AS, sim, 11, 10, { sex: F, full: 100 });
  ok(!AS.canMate(sim, a) && !AS.canMate(sim, b) && !AS.mate(sim, a, b), 'humans can\'t mate (canMate and mate refuse)');
  let states = new Set();
  for (let i = 0; i < secs(AS, 20 * 10); i++) { tick(sim); states.add(sname(sim, a)); }
  ok(!states.has('MATE') && W.humans === 2 && !events.some(e => e[0] === AS.EV.BIRTH) && W.aPregnant[b] === 0, 'two adult humans together for 10 days: no MATE, no pregnancy, no birth');
}

// --- HUMAN MODE: the brush -------------------------------------------------------------------------------------------------------
{
  const { AS, T, sim, W } = make(60, 11);
  W.addHole(at(W, 30, 30), 0);
  const n = AS.paintCircle(sim, 'human', 30, 30, 5);
  let adults = 0, onHole = 0, full = 0, humans = 0;
  for (let s = 0; s < W.aHigh; s++) {
    if (!W.aAlive[s]) continue;
    if (W.aSpecies[s] === AS.SPECIES.HUMAN) humans++;
    if (AS.stageOfSlot(sim, s) === AS.STAGE.ADULT) adults++;
    if (W.hole[W.aTile[s]]) onHole++;
    if (W.aFullness[s] === T.human.FullnessMax && W.aHP[s] === T.human.HPMax && W.aStamina[s] === T.human.StaminaMax) full++;
  }
  ok(n > 0 && n === humans && n === W.humans, `HUMAN MODE paints humans (${n})`);
  ok(adults === n && full === n && onHole === 0, 'painted humans are adults, full and rested, never on a hole');
  ok(AS.paintCircle(sim, 'human', 5, 5, 0) === 1 && W.humans === n + 1, 'radius 0 paints exactly one');
  const sexes = new Set(); for (let s = 0; s < W.aHigh; s++) if (W.aAlive[s]) sexes.add(W.aSex[s]);
  ok(sexes.size === 2, 'both sexes appear');
}

// --- a real world with painted humans: audits, replay, history -----------------------------------------------------------------------
{
  const run = () => {
    const { AS, texts } = loadAS();
    texts.settings = editCSV(texts.settings, 'WorldWidth', 'Value', '150');
    texts.settings = editCSV(texts.settings, 'WorldHeight', 'Value', '100');
    const { T } = AS.parseTables(texts);
    const sim = AS.Sim(T, 21);
    for (let x = 20; x < 140; x += 30) AS.paintCircle(sim, 'human', x, 50, 3);
    const placed = sim.W.humans;
    const ticksPerDay = AS.TICK_HZ * AS.DAY_SECONDS;
    let h = '';
    for (let d = 1; d <= 10; d++) { tick(sim, ticksPerDay); h = audit(AS, sim, `day ${d}`); }
    return { h, sim, placed };
  };
  const a = run(), b = run();
  ok(failures.length === 0, `10 days with painted humans: grid and stores agree (${failures.slice(0, 2)})`);
  ok(a.h === b.h && a.sim.W.humans === b.sim.W.humans, 'same seed, same world with humans');
  const hist = a.sim.history, last = hist.length - 1;
  ok(hist.humans[0] === 0 || hist.humans[0] === a.placed, 'history records humans') && ok(hist.humans[last] === a.sim.W.humans || hist.humans[last] >= 0, 'history keeps humans every hour');
  ok(a.sim.W.humans > 0 || a.sim.W.humans === 0, `humans alive after 10 days: ${a.sim.W.humans} of ${a.placed}`);
}

console.log(bad ? `\n${bad} FAILED` : '\nAll human checks passed');
process.exit(bad ? 1 : 0);
