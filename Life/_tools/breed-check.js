'use strict';
// Milestone 5: mating, pregnancy, births, and the MATE state, in tiny hand-built worlds,
// then the real world for 40 days (run twice: same seed, same output).
const fs = require('fs'), path = require('path'), vm = require('vm');
const { SIM_FILES, editCSV } = require('./harness.js');
const ROOT = path.resolve(__dirname, '..');
let bad = 0;
function ok(c, m) { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; }
const near = (a, b, tol) => Math.abs(a - b) <= tol;

function loadAS() {
  const ctx = vm.createContext({ console, crypto: globalThis.crypto });
  vm.runInContext('globalThis.AS = { V: 0 };', ctx);
  for (const f of [...SIM_FILES, 'inspect']) {
    const file = path.join(ROOT, 'js', f + '.js');
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  }
  const texts = {};
  for (const f of ['species', 'variables', 'states', 'settings']) texts[f] = fs.readFileSync(path.join(ROOT, 'tables', f + '.csv'), 'utf8');
  return { AS: ctx.AS, texts };
}

function make(size, seed = 1, edit) {
  const { AS, texts } = loadAS();
  let s = editCSV(texts.settings, 'WorldWidth', 'Value', String(size));
  s = editCSV(s, 'WorldHeight', 'Value', String(size));
  s = editCSV(s, 'StartGrass', 'Value', '0%');
  s = editCSV(s, 'StartBunnies', 'Value', '0');
  s = editCSV(s, 'Lakes', 'Value', '0');   // these hand-place things on tiles; lakes are water-check.js's
  s = editCSV(s, 'StartWolves', 'Value', '0');
  texts.settings = s;
  texts.species = editCSV(texts.species, 'HungerRate', 'Bunny', '0');
  texts.species = editCSV(texts.species, 'SeedChance', 'Grass', '0%');
  if (edit) edit(texts);
  const { T, errors } = AS.parseTables(texts);
  if (errors.length) throw new Error(errors.join('\n'));
  const sim = AS.Sim(T, seed);
  const events = [], emit = sim.emit;
  sim.emit = (type, tile) => { events.push([type, tile]); emit(type, tile); };
  return { AS, T, sim, W: sim.W, B: T.bunny, events };
}
const at = (W, x, y) => y * W.w + x;
const tick = (sim, n = 1) => { for (let i = 0; i < n; i++) sim.tick(); };
const secs = (AS, s) => Math.round(s * AS.TICK_HZ);
const days = (AS, d) => Math.round(d * AS.TICK_HZ * AS.DAY_SECONDS);
const stateName = (sim, s) => sim.W.aState[s] === 255 ? 'none' : sim.T.states.bunny[sim.W.aState[s]].name;

function bunny(AS, sim, x, y, sex, o = {}) {
  const W = sim.W, s = AS.spawnStarting(sim, AS.SPECIES.BUNNY, at(W, x, y));
  W.aSex[s] = sex;
  W.aAge[s] = o.age ?? 5;
  W.aFullness[s] = o.full ?? 100;
  W.aDecideLeft[s] = 0;
  return s;
}
const M = 0, F = 1;

// --- eligibility ---
{
  const { AS, sim, W, B } = make(30);
  const base = { age: 5 };
  const adultM = bunny(AS, sim, 2, 2, M), adultF = bunny(AS, sim, 4, 2, F);
  ok(AS.canMate(sim, adultM) && AS.canMate(sim, adultF), 'eligible: a fed adult of either sex');
  const baby = bunny(AS, sim, 6, 2, F, { age: B.TimeToMature / 2 });
  const elder = bunny(AS, sim, 8, 2, F, { age: B.ElderAt * B.Lifespan + 0.5 });
  const hungry = bunny(AS, sim, 10, 2, F, { full: B.MateFullness * B.FullnessMax - 1 });
  const preg = bunny(AS, sim, 12, 2, F); W.aPregnant[preg] = 0.5; W.aLitter[preg] = 2;
  const due = bunny(AS, sim, 14, 2, F); W.aPregnant[due] = 0; W.aLitter[due] = 2;
  const cool = bunny(AS, sim, 16, 2, F); W.aMateCd[cool] = 1;
  ok(!AS.canMate(sim, baby), 'eligible: a baby is not');
  ok(!AS.canMate(sim, elder), 'eligible: an elder is not');
  ok(!AS.canMate(sim, hungry), 'eligible: an underfed bunny is not');
  ok(!AS.canMate(sim, preg), 'eligible: a pregnant female is not');
  ok(!AS.canMate(sim, due), 'eligible: a due female is not');
  ok(!AS.canMate(sim, cool), 'eligible: a female on cooldown is not');
  W.aMateCd[adultM] = 5;
  ok(AS.canMate(sim, adultM), 'eligible: a male has no cooldown');
  ok(!AS.mate(sim, adultM, adultM), 'mate: refuses itself');
}

// --- wolf territory: a crowded female wolf doesn't breed ---
{
  const { AS, sim, W, T } = make(60, 5);
  const wolf = (x, y, sex, o = {}) => {
    const s = AS.spawnStarting(sim, AS.SPECIES.WOLF, at(W, x, y));
    W.aSex[s] = sex; W.aAge[s] = o.age ?? 20; W.aFullness[s] = 100; W.aDecideLeft[s] = 0;
    return s;
  };
  const L = T.wolf.PackLimit, R = T.wolf.TerritoryRange;
  ok(L != null && R != null && T.bunny.PackLimit == null, 'territory: wolves have the rule, bunnies are blank');
  const f = wolf(30, 30, F);
  const row = (n, dx, dy, o) => { for (let i = 0; i < n; i++) wolf(30 + dx + (i % 7) * 2, 30 + dy + ((i / 7) | 0) * 2, i % 2 ? F : M, o); };
  row(L, -R, -R);   // exactly PackLimit others, on the range's far corner
  ok(AS.canMate(sim, f), 'territory: PackLimit others in range, she can mate');
  wolf(30 + R, 30 + R, M);
  ok(!AS.canMate(sim, f), 'territory: one more than PackLimit, she cannot');
  const m = wolf(31, 30, M);
  ok(AS.canMate(sim, m), 'territory: a male is never gated');
  const g = wolf(10, 50, F);
  for (let i = 0; i < L + 1; i++) wolf(10 + R + 1, 50 - R + i, M);
  ok(AS.canMate(sim, g), 'territory: wolves just outside TerritoryRange do not count');
  const h = wolf(50, 8, F);
  for (let i = 0; i < L + 1; i++) wolf(50 - (i % 7) * 2, 8 + 2 * ((i / 7) | 0) + 2, M, { age: 0.1 });
  ok(AS.canMate(sim, h), 'territory: babies do not count');
  const b = bunny(AS, sim, 5, 5, F);
  for (let i = 0; i < L + 3; i++) bunny(AS, sim, 6 + i, 5, M);
  ok(AS.canMate(sim, b), 'territory: a crowd of bunnies is not gated');
}

// --- a male next to each ineligible female never mates ---
{
  const { AS, sim, W, B } = make(30, 2);
  const cases = [
    ['baby', { age: B.TimeToMature / 2 }], ['elder', { age: B.ElderAt * B.Lifespan + 0.5 }],
    ['underfed', { full: 10 }], ['pregnant', {}, f => { W.aPregnant[f] = 0.9; W.aLitter[f] = 2; }],
    ['due', {}, f => { W.aPregnant[f] = 0; W.aLitter[f] = 2; }], ['cooling down', {}, f => { W.aMateCd[f] = 1.5; }],
  ];
  const pairs = cases.map(([name, o, fix], i) => {
    const y = 3 + i * 4, m = bunny(AS, sim, 10, y, M), f = bunny(AS, sim, 12, y, F, o);
    if (fix) fix(f);
    return [name, m, f];
  });
  const full0 = pairs.map(([, m]) => W.aFullness[m]);
  tick(sim, secs(AS, 8));
  pairs.forEach(([name, m, f], i) => ok(W.aFullness[m] === full0[i] && W.aChildren[m] === 0 && !(name !== 'pregnant' && name !== 'due' && W.aPregnant[f] > 0), `never mates: male + ${name} female`));
}

// --- same sex never mates ---
{
  const { AS, sim, W } = make(80, 3);
  const a = bunny(AS, sim, 40, 10, M), b = bunny(AS, sim, 43, 10, M), c = bunny(AS, sim, 40, 70, F), d = bunny(AS, sim, 43, 70, F);
  tick(sim, secs(AS, 15));
  ok(W.aFullness[a] === 100 && W.aFullness[b] === 100 && W.aFullness[c] === 100 && W.aFullness[d] === 100 && W.aPregnant[c] === 0 && W.aPregnant[d] === 0, 'same-sex pairs never mate');
}

// --- find, mate, pregnancy, birth ---
{
  const { AS, sim, W, B, events } = make(40, 4);
  const m = bunny(AS, sim, 15, 20, M), f = bunny(AS, sim, 20, 20, F);
  const mSer = W.aSerial[m], fSer = W.aSerial[f];
  let t = 0;
  while (W.aLitter[f] === 0 && t < secs(AS, 20)) { tick(sim); t++; }
  ok(W.aLitter[f] > 0, `pair 5 apart found each other and mated after ${(t / AS.TICK_HZ).toFixed(1)} s`);
  const cost = B.MateCost * B.FullnessMax;
  ok(near(W.aFullness[m], 100 - cost, 1e-3) && near(W.aFullness[f], 100 - cost, 1e-3), `mating: both lost MateCost (${W.aFullness[m].toFixed(1)}, ${W.aFullness[f].toFixed(1)})`);
  ok(near(W.aPregnant[f], B.PregnancyDays, 2 * AS.DT_DAYS), `mating: pregnant for PregnancyDays (${W.aPregnant[f].toFixed(4)})`);
  const litter = W.aLitter[f];
  ok(litter >= B.LitterSize.min && litter <= B.LitterSize.max, `mating: litter ${litter} within ${B.LitterSize.min}-${B.LitterSize.max}`);
  ok(!AS.canMate(sim, f), 'mating: she is no longer eligible');
  ok(events.every(e => e[0] !== AS.EV.BIRTH), 'mating: no event mark at mating');
  // the father stays near: he must not mate with her again; run to birth
  let before = events.length, born = 0;
  while (!events.some(e => e[0] === AS.EV.BIRTH) && W.aAlive[f] && t < days(AS, 2)) { tick(sim); t++; }
  const births = events.filter(e => e[0] === AS.EV.BIRTH);
  ok(births.length === litter, `birth: ${births.length} BIRTH events = litter ${litter}`);
  const kids = [];
  for (let s = 0; s < W.aHigh; s++) if (W.aAlive[s] && W.aParentA[s] === fSer) kids.push(s);
  ok(kids.length === litter, 'birth: newborns exist with the mother as Parent A');
  const nbrs = new Int32Array(4), k = W.neighbors4(W.aTile[f], nbrs);
  const nset = new Set(nbrs.slice(0, k));
  ok(kids.every(s => nset.has(W.aTile[s])), 'birth: litter on her 4-neighbor tiles');
  ok(kids.every(s => births.some(e => e[1] === W.aTile[s])), 'birth: each BIRTH event is on a baby tile');
  ok(kids.every(s => W.aAge[s] < 2 * AS.DT_DAYS && W.aFullness[s] === B.FullnessMax && W.aHP[s] === B.HPMax && W.aStamina[s] === B.StaminaMax), 'birth: newborns age 0, full Fullness/HP/Stamina');
  ok(kids.every(s => W.aParentB[s] === mSer), 'birth: Parents = mother + father serials');
  ok(W.aChildren[f] === litter && W.aChildren[m] === litter, `birth: both parents' Children = ${litter}`);
  ok(near(W.aMateCd[f], B.MateCooldown, 3 * AS.DT_DAYS), `birth: MateCooldown starts at birth (${W.aMateCd[f].toFixed(3)})`);
  ok(W.aLitter[f] === 0 && W.aPregnant[f] === 0, 'birth: litter and pregnancy cleared');
  ok(kids.every(s => AS.stageOfSlot(sim, s) === AS.STAGE.BABY && !AS.canMate(sim, s)), 'birth: newborns are babies and not eligible');
}

// --- boxed in: the birth waits ---
{
  const { AS, sim, W, B, events } = make(9, 5);
  const f = bunny(AS, sim, 4, 4, F);
  W.aLitter[f] = 3; W.aPregnant[f] = 0;
  const around = [[4, 3], [5, 4], [4, 5], [3, 4]].map(([x, y]) => at(W, x, y));
  for (const t of around) W.addGrass(t, 1, 3);
  const hold = () => { W.aStepLeft[f] = 100; };   // she'd walk off once a tile frees; pin her
  for (let i = 0; i < secs(AS, 3); i++) { hold(); tick(sim); }
  ok(W.aLitter[f] === 3 && !events.some(e => e[0] === AS.EV.BIRTH), 'waiting: boxed in, still due');
  const row = AS.describe(sim, { tile: W.aTile[f], serial: W.aSerial[f], slot: f }).rows.find(r => r.name === 'Pregnant');
  ok(row && row.value === 'Due, waiting for room', `waiting: inspector says "${row && row.value}"`);
  ok(!AS.canMate(sim, f), 'waiting: she cannot mate');
  W.removeGrass(around[0]); W.removeGrass(around[1]);
  for (let i = 0; i < secs(AS, 1); i++) { hold(); tick(sim); }
  ok(W.aLitter[f] === 3, 'waiting: two free tiles are not enough for three');
  W.removeGrass(around[2]);
  hold(); tick(sim);
  ok(W.aLitter[f] === 0 && events.filter(e => e[0] === AS.EV.BIRTH).length === 3, 'waiting: births the tick the third tile opens');
  ok(near(W.aMateCd[f], B.MateCooldown, 2 * AS.DT_DAYS), 'waiting: cooldown starts when the birth finally happens');
}

// --- father dies before the birth ---
{
  const { AS, sim, W } = make(40, 6);
  const m = bunny(AS, sim, 15, 20, M), f = bunny(AS, sim, 19, 20, F);
  const fSer = W.aSerial[f], mSer = W.aSerial[m];
  let t = 0;
  while (W.aLitter[f] === 0 && t < secs(AS, 20)) { tick(sim); t++; }
  const litter = W.aLitter[f];
  AS.killAnimal(sim, m);
  // a newcomer takes his slot: it must not be credited
  const other = bunny(AS, sim, 30, 30, M);
  while (W.aLitter[f] > 0 && t < days(AS, 2)) { tick(sim); t++; }
  ok(W.aLitter[f] === 0 && W.aChildren[f] === litter, `father dead: mother's Children = ${W.aChildren[f]}`);
  ok(other === m && W.aSerial[other] !== mSer && W.aChildren[other] === 0, 'father dead: the newcomer reusing his slot is not credited');
  let kidsOk = true;
  for (let s = 0; s < W.aHigh; s++) if (W.aAlive[s] && W.aParentA[s] === fSer && W.aParentB[s] !== mSer) kidsOk = false;
  ok(kidsOk, 'father dead: newborns still list him as Parent B');
}

// --- real world, 40 days ---
function realRun() {
  const { AS, texts } = loadAS();
  const { T, errors } = AS.parseTables(texts);
  if (errors.length) throw new Error(errors.join('\n'));
  const lines = [];
  const kill = AS.killAnimal;
  const c = { starved: 0, old: 0, births: 0 };
  AS.killAnimal = (sim, s) => {
    const W = sim.W, S = AS.speciesStats(sim, s);
    if (W.aAge[s] >= S.Lifespan) c.old++; else c.starved++;
    kill(sim, s);
  };
  const sim = AS.Sim(T, 12345), W = sim.W;
  const emit = sim.emit; sim.emit = (ty, t) => { if (ty === AS.EV.BIRTH) c.births++; emit(ty, t); };
  const names = T.states.bunny.map(s => s.name), mateIdx = names.indexOf('MATE');
  lines.push('day  bunnies  births  starved  old  meanFull  MATE%  pregnant  due');
  const dayTicks = AS.TICK_HZ * AS.DAY_SECONDS;
  for (let d = 1; d <= 40; d++) {
    for (let i = 0; i < dayTicks; i++) sim.tick();
    let n = 0, sum = 0, mate = 0, preg = 0, due = 0;
    for (let s = 0; s < W.aHigh; s++) if (W.aAlive[s]) {
      n++; sum += W.aFullness[s];
      if (W.aState[s] === mateIdx) mate++;
      if (W.aPregnant[s] > 0) preg++; else if (W.aLitter[s] > 0) due++;
    }
    lines.push(`${String(d).padStart(3)}  ${String(n).padStart(7)}  ${String(c.births).padStart(6)}  ${String(c.starved).padStart(7)}  ${String(c.old).padStart(3)}  ${(sum / Math.max(1, n)).toFixed(1).padStart(8)}  ${(100 * mate / Math.max(1, n)).toFixed(1).padStart(5)}  ${String(preg).padStart(8)}  ${String(due).padStart(3)}`);
  }
  return { AS, sim, lines };
}
{
  const a = realRun();
  console.log('\nreal world, 40 days\n' + a.lines.join('\n'));
  const b = realRun();
  ok(a.lines.join('\n') === b.lines.join('\n'), 'real: same seed, same 40-day output');
  const h = require('./harness.js');
  h.audit(a.AS, a.sim, 'breed-check');
  ok(h.failures.length === 0, 'real: grid/store audit clean ' + h.failures.slice(0, 3).join('; '));
}
console.log(bad ? `\nFAIL (${bad})` : '\nALL PASS');
process.exit(bad ? 1 : 0);
