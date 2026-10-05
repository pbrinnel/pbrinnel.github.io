'use strict';
// Thirst (animals.js: the water meter, the DRINK state, cause of death; world.js: the water
// field): the meter drains with activity, a thirsty animal walks to a shore and drinks to full,
// one too far from known water doesn't go, a dry animal loses HP and dies of thirst, DRINK sits
// between the safety states and the food states, a crowd at one small lake all drink, worlds
// without water have no thirst at all, and every corpse records how it died.
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
const KEYS = ['bunny', 'wolf', 'human'];
// A bare world, nobody hungry and nothing growing unless a test says so, Water on, no lakes or
// rivers of its own: tests dig their own with W.addWater.
function make(w, h, o = {}) {
  const { AS, texts } = loadAS();
  let s = editCSV(texts.settings, 'WorldWidth', 'Value', String(w));
  s = editCSV(s, 'WorldHeight', 'Value', String(h));
  for (const [k, v] of [['StartGrass', '0%'], ['StartBunnies', '0'], ['StartWolves', '0'], ['Lakes', '0'], ['Rivers', '0'], ['Water', o.water || 'on']]) s = editCSV(s, k, 'Value', v);
  texts.settings = s;
  if (!o.hunger) for (const sp of ['Bunny', 'Wolf', 'Human']) texts.species = editCSV(texts.species, 'HungerRate', sp, '0');
  texts.species = editCSV(texts.species, 'SeedChance', 'Grass', '0%');
  texts.species = editCSV(texts.species, 'GrowthRate', 'Grass', '0');
  texts.species = editCSV(texts.species, 'SproutChance', 'Grass', '0%');
  texts.species = editCSV(texts.species, 'DigChance', 'Bunny', '0%');
  if (o.edit) o.edit(texts);
  const { T, errors } = AS.parseTables(texts);
  if (errors.length) throw new Error(errors.join('\n'));
  const sim = AS.Sim(T, o.seed || 1);
  return { AS, T, sim, W: sim.W, K: AS.KIND };
}
const at = (W, x, y) => y * W.w + x;
const tick = (sim, n = 1) => { for (let i = 0; i < n; i++) sim.tick(); };
const secs = (AS, s) => Math.round(s * AS.TICK_HZ);
const sname = (sim, s) => sim.W.aState[s] === 255 ? 'none' : sim.T.states[KEYS[sim.W.aSpecies[s]]][sim.W.aState[s]].name;
const lake = (W, x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) W.addWater(at(W, x, y)); };
function put(AS, sim, sp, x, y, o = {}) {
  const s = AS.spawnStarting(sim, sp, at(sim.W, x, y)), W = sim.W, S = sim.T[KEYS[sp]];
  W.aAge[s] = S.TimeToMature + 0.1;   // an adult, mid-life
  if (o.water !== undefined) W.aWater[s] = o.water;
  if (o.full !== undefined) W.aFullness[s] = o.full;
  if (o.sex !== undefined) W.aSex[s] = o.sex;
  return s;
}
// Ticks until animal s is gone (or maxSecs), returning the tile it last stood on: it may walk.
function untilDead(AS, sim, s, maxSecs) {
  const W = sim.W; let t = W.aTile[s];
  for (let i = 0; i < secs(AS, maxSecs) && W.aAlive[s]; i++) { sim.tick(); if (W.aAlive[s]) t = W.aTile[s]; }
  return t;
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---- the meter drains with activity ----
{
  const { AS, T, sim, W } = make(60, 40, { edit: t => { t.species = editCSV(t.species, 'WaterSense', 'Bunny', '0'); } });
  lake(W, 50, 5, 55, 10);
  const s = put(AS, sim, AS.SPECIES.BUNNY, 10, 20);
  const B = T.bunny;
  ok(W.aWater[s] === B.WaterMax, 'a starting animal has a full water meter');
  W.aStamina[s] = 0; tick(sim, 1);   // winded and resting: standing still
  const before = W.aWater[s];
  tick(sim, secs(AS, 5));
  ok(W.aState[s] !== 255 && sname(sim, s) === 'REST' && near(before - W.aWater[s], B.ThirstRate * B.RestHunger * 5, 0.3),
    `standing still, water falls ThirstRate x RestHunger a second (${(before - W.aWater[s]).toFixed(2)} in 5 s)`);
  // Walking burns the full ThirstRate: a bunny on the move (it wanders: it cannot know water).
  const w2 = put(AS, sim, AS.SPECIES.BUNNY, 30, 30); W.aWater[w2] = B.WaterMax;
  tick(sim, secs(AS, 4));
  const lost = B.WaterMax - W.aWater[w2];
  ok(lost > B.ThirstRate * B.RestHunger * 4 * 0.9 && lost <= B.ThirstRate * B.SprintHunger * 4 + 0.01, `moving, it burns more than standing (${lost.toFixed(2)} in 4 s)`);
}

// ---- a thirsty animal walks to water, drinks to full, then goes back to life ----
for (const [sp, name] of [[0, 'bunny'], [1, 'wolf'], [2, 'human']]) {
  const { AS, T, sim, W, K } = make(80, 40);
  lake(W, 55, 10, 62, 20);
  const s = put(AS, sim, sp, 30, 15), S = T[name];
  W.aWater[s] = S.ThirstyAt * S.WaterMax - 1;
  let drinking = false, sips = 0, wasAdjacent = false, backToLife = false, prevBite = 0, minWater = 1e9;
  for (let i = 0; i < secs(AS, 60) && W.aAlive[s]; i++) {
    sim.tick();
    minWater = Math.min(minWater, W.aWater[s]);
    const t = W.aTile[s], touching = [t - 1, t + 1, t - W.w, t + W.w].some(u => W.kind[u] === K.WATER);
    if (sname(sim, s) === 'DRINK') {
      drinking = true;
      if (touching && W.aWater[s] > minWater + 1) wasAdjacent = true;
      if (W.aBiteLeft[s] > prevBite) sips++;
    } else if (drinking && W.aWater[s] > S.WaterMax * 0.97) backToLife = true;
    prevBite = W.aBiteLeft[s];
    if (backToLife) break;
  }
  ok(drinking && wasAdjacent, `${name}: a thirsty one walks to a tile touching water and drinks there`);
  ok(sips > 0, `${name}: a sip raises aBiteLeft (the head-down pose; ${sips} sips)`);
  ok(backToLife && W.aWater[s] > S.WaterMax * 0.97, `${name}: drinks to full, then leaves DRINK for something else (${sname(sim, s)})`);
}

// ---- beyond WaterSense it doesn't go; it enters only when the water is known ----
{
  const { AS, T, sim, W } = make(220, 30, { edit: t => { t.species = editCSV(editCSV(t.species, 'ThirstRate', 'Bunny', '0.3'), 'WaterSense', 'Bunny', '40'); } });
  lake(W, 212, 5, 217, 25);
  const B = T.bunny;
  const far = put(AS, sim, AS.SPECIES.BUNNY, 10, 15, { water: 10 }), close = put(AS, sim, AS.SPECIES.BUNNY, 212 - B.WaterSense + 6, 15, { water: 10 });
  W.wDist; sim.W.ensureWaterField();
  ok(W.wDist[W.aTile[far]] > B.WaterSense && W.wDist[W.aTile[close]] <= B.WaterSense, 'one bunny is beyond WaterSense of the water and one within');
  let farDrank = false, closeDrank = false;
  for (let i = 0; i < secs(AS, 6); i++) { sim.tick(); if (sname(sim, far) === 'DRINK') farDrank = true; if (sname(sim, close) === 'DRINK') closeDrank = true; }
  ok(closeDrank && !farDrank, 'a thirsty bunny enters DRINK only when water is within WaterSense');
}

// ---- at 0 it loses ThirstDamage HP a second and can die of thirst ----
{
  const { AS, T, sim, W } = make(60, 30, { edit: t => { for (const sp of ['Bunny', 'Wolf', 'Human']) t.species = editCSV(t.species, 'WaterSense', sp, '0'); } });
  lake(W, 50, 5, 55, 10);
  for (const [sp, name] of [[0, 'bunny'], [1, 'wolf'], [2, 'human']]) {
    const S = T[name], s = put(AS, sim, sp, 10 + sp * 5, 20, { water: 0, full: 100 });
    const hp0 = W.aHP[s]; tick(sim, secs(AS, 5));
    // No healing while dry, so the loss is exactly ThirstDamage a second.
    ok(near(hp0 - W.aHP[s], S.ThirstDamage * 5, 0.2), `${name}: HP falls ThirstDamage a second at water 0 (${(hp0 - W.aHP[s]).toFixed(2)} in 5 s)`);
  }
  const b = put(AS, sim, AS.SPECIES.BUNNY, 30, 5, { water: 0, full: 100 });
  const t = untilDead(AS, sim, b, T.bunny.HPMax / T.bunny.ThirstDamage + 3);
  ok(!W.aAlive[b] && W.kind[t] === AS.KIND.CORPSE && W.cCause[t] === AS.CAUSE.THIRST, 'a bunny at water 0 dies of thirst and leaves a corpse that says so');
}

// ---- DRINK outranks food and the hunt, but not fleeing or hiding ----
{
  const { AS, T, sim, W } = make(80, 40, { hunger: true });
  lake(W, 55, 10, 62, 20);
  // hungry bunny with a blade beside it, thirsty, water known: DRINK beats EAT
  W.addGrass(at(W, 31, 15), 1, 1);
  const eat = put(AS, sim, AS.SPECIES.BUNNY, 30, 15, { water: 10, full: 10 });
  // a hungry wolf that sees a bunny, thirsty
  const wolf = put(AS, sim, AS.SPECIES.WOLF, 30, 30, { water: 10, full: 10 });
  const prey = put(AS, sim, AS.SPECIES.BUNNY, 36, 30, { water: 100, full: 100 });
  // a thirsty bunny with a wolf in sight: FLEE wins
  const flee = put(AS, sim, AS.SPECIES.BUNNY, 10, 5, { water: 10, full: 100 }), threat = put(AS, sim, AS.SPECIES.WOLF, 14, 5, { water: 100, full: 100 });
  // a thirsty bunny on a hole with a wolf in sight: HIDE wins
  W.addHole(at(W, 10, 35), 0);
  const hide = put(AS, sim, AS.SPECIES.BUNNY, 10, 35, { water: 10, full: 100 }), threat2 = put(AS, sim, AS.SPECIES.WOLF, 14, 35, { water: 100, full: 100 });
  for (const s of [eat, wolf, prey, flee, threat, hide, threat2]) W.aDecideLeft[s] = 0;
  tick(sim, 2);
  ok(sname(sim, eat) === 'DRINK', 'a thirsty hungry bunny with grass beside it drinks first');
  ok(sname(sim, wolf) === 'DRINK', 'a thirsty hungry wolf with prey in sight drinks first');
  ok(sname(sim, flee) === 'FLEE', 'a thirsty bunny with a wolf in sight flees');
  ok(sname(sim, hide) === 'HIDE', 'a thirsty bunny in a hole with a wolf in sight hides');
  const order = names => names.indexOf('DRINK');
  ok(order(T.states.bunny.map(s => s.name)) === 2 && order(T.states.wolf.map(s => s.name)) === 0 && order(T.states.human.map(s => s.name)) === 0, 'states.csv: DRINK after HIDE and FLEE for bunnies, first for wolves and humans');
}

// ---- a crowd of thirsty bunnies at one small lake: they all drink and live ----
{
  for (const seed of [1, 2]) {
    const { AS, T, sim, W } = make(60, 50, { seed, edit: t => { t.species = editCSV(t.species, 'Lifespan', 'Bunny', '1000'); } });   // nobody dies of old age during the run
    lake(W, 26, 20, 33, 27);   // 8 x 8: a small lake with 32 shore tiles
    const crowd = [];
    for (let i = 0; i < 24; i++) {
      for (let tries = 0; tries < 50; tries++) {
        const x = 18 + sim.rng.int(24), y = 12 + sim.rng.int(26), t = at(W, x, y);
        if (W.kind[t] !== AS.KIND.EMPTY) continue;
        crowd.push(put(AS, sim, AS.SPECIES.BUNNY, x, y, { water: 10 })); break;
      }
    }
    let stuckFull = 0;
    const topped = new Set();   // bunnies seen with a full meter after starting at 10
    const heldFull = new Map();   // a drinker seen full this many seconds in a row
    for (let i = 0; i < secs(AS, 90); i++) {
      sim.tick();
      for (const s of crowd) if (W.aAlive[s] && W.aWater[s] > T.bunny.WaterMax - 1) topped.add(s);   // every tick: a full meter lasts well under a second
      if (process.env.DBG && i > secs(AS, 70) && i % 15 === 0 && false) console.log('b3', i, sname(sim, 3), W.tx(W.aTile[3]), W.ty(W.aTile[3]), 'd', W.wDist[W.aTile[3]], 'w', W.aWater[3].toFixed(1), 'nbrs', [W.aTile[3] - 1, W.aTile[3] + 1, W.aTile[3] - W.w, W.aTile[3] + W.w].map(u => W.kind[u]).join(''));
      if (i % 30 !== 0) continue;
      for (const s of crowd) {
        const full = W.aAlive[s] && sname(sim, s) === 'DRINK' && W.aWater[s] > T.bunny.WaterMax - 0.2;
        heldFull.set(s, full ? (heldFull.get(s) || 0) + 1 : 0);
        if (heldFull.get(s) >= 3) stuckFull++;
      }
    }
    if (process.env.DBG) for (const s of crowd) if (!topped.has(s)) console.log('unfilled', s, sname(sim, s), 'w', W.aWater[s].toFixed(1), 'hp', W.aHP[s].toFixed(1), 'd', W.wDist[W.aTile[s]], 'tile', W.tx(W.aTile[s]), W.ty(W.aTile[s]), 'sprint', W.aSprint[s], 'stam', W.aStamina[s].toFixed(0));
    const alive = crowd.filter(s => W.aAlive[s]);
    ok(alive.length === crowd.length && topped.size === crowd.length, `seed ${seed}: ${crowd.length} thirsty bunnies at one small lake all survive and all fill the meter (${alive.length} alive, ${topped.size} filled)`);
    ok(stuckFull === 0, `seed ${seed}: a full drinker leaves its shore tile (${stuckFull} full drinkers still in DRINK)`);
    const f0 = failures.length; audit(AS, sim, 'crowd'); ok(failures.length === f0, 'the audit holds');
  }
}

// ---- no water, no thirst: the meter never drains ----
{
  for (const [label, o] of [['Water off', { water: 'off', edit: null }], ['Water on but no lakes or rivers', {}]]) {
    const { AS, T, sim, W } = make(60, 40, o);
    const s = put(AS, sim, AS.SPECIES.BUNNY, 10, 10), w = put(AS, sim, AS.SPECIES.WOLF, 20, 20);
    tick(sim, secs(AS, 30));
    ok(W.aWater[s] === T.bunny.WaterMax && W.aWater[w] === T.wolf.WaterMax && W.waterCount === 0, `${label}: nothing is thirsty, the meter stays full`);
  }
  // A Meadows world with Water off is the same world as Lakes 0 / Rivers 0.
  const sig = sim => {
    const W = sim.W; let h = 0;
    for (let t = 0; t < W.n; t++) h = (h * 31 + W.kind[t] + (W.hole[t] ? 7 : 0)) >>> 0;
    for (let s = 0; s < W.aHigh; s++) if (W.aAlive[s]) h = (h * 31 + W.aTile[s] * 3 + W.aState[s] + Math.round(W.aFullness[s] * 10)) >>> 0;
    return h + ':' + W.bunnies + ':' + W.wolves + ':' + W.gCount;
  };
  const build = (edits) => {
    const { AS, texts } = loadAS();
    for (const [f, k, c, v] of edits) texts[f] = editCSV(texts[f], k, c, v);
    texts.settings = editCSV(texts.settings, 'WorldWidth', 'Value', '200'); texts.settings = editCSV(texts.settings, 'WorldHeight', 'Value', '140');
    texts.settings = editCSV(texts.settings, 'StartBunnies', 'Value', '120'); texts.settings = editCSV(texts.settings, 'StartWolves', 'Value', '30');
    const { T, errors } = AS.parseTables(texts); if (errors.length) throw new Error(errors.join('\n'));
    return { AS, T };
  };
  const off = build([['settings', 'Water', 'Value', 'off']]), dry = build([['settings', 'Water', 'Value', 'on'], ['settings', 'Lakes', 'Value', '0'], ['settings', 'Rivers', 'Value', '0']]);
  const a = off.AS.Sim(off.T, 4), b = dry.AS.Sim(dry.T, 4);
  const toggled = off.AS.Sim(off.T, 4, { water: true }), toggledOff = dry.AS.Sim(dry.T, 4, { water: false });
  for (let i = 0; i < 4 * 600; i++) { a.tick(); b.tick(); toggledOff.tick(); }
  ok(sig(a) === sig(b) && sig(b) === sig(toggledOff) && a.W.waterCount === 0, `Water off is byte-for-byte the Lakes 0 / Rivers 0 world after 4 days (${sig(a)})`);
  ok(toggled.W.waterCount > 0 && sig(toggled) !== sig(off.AS.Sim(off.T, 4)), 'the Sim option water: true lays water over a table that says off');
}

// ---- the water field: nearest shore by walking ----
{
  const { AS, sim, W, K } = make(50, 40);
  lake(W, 20, 15, 25, 20);
  W.ensureWaterField();
  let wrongBeach = 0, wrongStep = 0, far = 0;
  for (let t = 0; t < W.n; t++) {
    if (W.kind[t] === K.WATER) continue;
    const touches = [t - 1, t + 1, t - W.w, t + W.w].some(u => u >= 0 && u < W.n && Math.abs(W.tx(u) - W.tx(t)) <= 1 && W.kind[u] === K.WATER);
    if ((W.wDist[t] === 0) !== touches) wrongBeach++;
    if (W.wDist[t] > 0) { far++; const n = W.wNext[t]; if (!(W.wDist[n] === W.wDist[t] - 1 && Math.abs(W.tx(n) - W.tx(t)) + Math.abs(W.ty(n) - W.ty(t)) === 1 && W.kind[n] !== K.WATER)) wrongStep++; }
  }
  // distance = Manhattan distance to the lake's nearest shore tile in an open world
  const t0 = at(W, 5, 5), want = Math.abs(5 - 19) + Math.abs(5 - 15);   // to (19, 15), the beach tile nearest
  ok(wrongBeach === 0 && wrongStep === 0 && far > 1000, `the water field: distance 0 exactly on the beach, every other tile's next step is a land neighbor one nearer (${far} tiles)`);
  ok(W.wDist[t0] === want, `distance from a corner is the walking distance to the shore (${W.wDist[t0]})`);
}

// ---- births start with a full meter ----
{
  const { AS, T, sim, W } = make(60, 40, { edit: t => { t.species = editCSV(t.species, 'PregnancyDays', 'Bunny', '0.01'); t.species = editCSV(t.species, 'LitterSize', 'Bunny', '3'); } });
  lake(W, 50, 5, 55, 10);
  const m = put(AS, sim, AS.SPECIES.BUNNY, 20, 20, { sex: 1 }), f = put(AS, sim, AS.SPECIES.BUNNY, 22, 20, { sex: 0 });
  W.aPregnant[m] = 0.001; W.aLitter[m] = 3; W.aState[m] = 255;
  W.aWater[m] = 70;
  tick(sim, 3);
  let kids = 0, full = 0;
  for (let s = 0; s < W.aHigh; s++) if (W.aAlive[s] && s !== m && s !== f) { kids++; if (W.aWater[s] > T.bunny.WaterMax - 1) full++; }
  ok(kids >= 1 && full === kids, `newborns have a full water meter (${full} of ${kids})`);
}

// ---- cause of death is recorded for every way to die ----
{
  const { AS, T, sim, W } = make(60, 30, { hunger: true, edit: t => { for (const sp of ['Bunny', 'Wolf', 'Human']) t.species = editCSV(t.species, 'WaterSense', sp, '0'); } });
  lake(W, 50, 5, 55, 10);
  const C = AS.CAUSE, cause = t => W.cCause[t];
  // starved: empty stomach, full meter
  let s = put(AS, sim, 0, 5, 5, { full: 0, water: 100 }); W.aHP[s] = 0.5;
  let t = untilDead(AS, sim, s, 3); ok(!W.aAlive[s] && cause(t) === C.STARVED, 'starved: recorded');
  // thirst only
  s = put(AS, sim, 0, 5, 10, { full: 100, water: 0 }); W.aHP[s] = 0.5;
  t = untilDead(AS, sim, s, 3); ok(!W.aAlive[s] && cause(t) === C.THIRST, 'died of thirst: recorded');
  // both
  s = put(AS, sim, 0, 5, 15, { full: 0, water: 0 }); W.aHP[s] = 0.5;
  t = untilDead(AS, sim, s, 3); ok(!W.aAlive[s] && cause(t) === C.STARVED_THIRSTY, 'both meters empty: starved and thirsty');
  // old age
  s = put(AS, sim, 0, 5, 20, { full: 100, water: 100 }); W.aAge[s] = T.bunny.Lifespan;
  t = W.aTile[s]; tick(sim, 2); ok(!W.aAlive[s] && cause(t) === C.OLD_AGE, 'old age: recorded');
  // attacked by a wolf, and by a human
  for (const [sp, name] of [[1, 'wolf'], [2, 'human']]) {
    const x = 20 + sp * 8, prey = put(AS, sim, 0, x, 12, { full: 100, water: 100 }), hunter = put(AS, sim, sp, x + 1, 12, { full: 0, water: 100 });
    W.aFullness[hunter] = 0; W.aHP[prey] = 1; W.aDecideLeft[hunter] = 0;
    t = W.aTile[prey]; tick(sim, secs(AS, 3));
    ok(!W.aAlive[prey] && cause(t) === C.ATTACKED + sp, `attacked by a ${name}: recorded`);
  }
  // debug drop
  const spot = at(W, 40, 25);
  AS.debugDropCorpse(sim, spot, 0); ok(cause(spot) === C.DEBUG, 'a debug corpse says so');
  // a corpse that rots leaves no cause behind
  W.removeCorpse(spot); ok(cause(spot) === 0, 'removing a corpse clears its cause');
}

console.log(bad ? `\n${bad} FAILED` : '\nAll thirst checks passed');
if (bad || failures.length) { if (failures.length) console.log([...new Set(failures)].slice(0, 20).join('\n')); process.exit(1); }
