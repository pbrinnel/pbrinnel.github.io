'use strict';
// Warren holes: wolves can't enter or path through one, a bunny on one can't be bitten or
// hunted, a fleeing bunny runs to a free hole and hides, holes collapse when unused, grass
// never grows on one, bunnies dig, and the Meadows start digs each colony's holes.
// Hand-built worlds like wolf-check's.
const fs = require('fs'), path = require('path'), vm = require('vm');
const { SIM_FILES, editCSV } = require('./harness.js');
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
// A bare world with no animals, no growth and no hunger, and no random digging unless asked.
function make(size, edit, layout = 'Scatter') {
  const { AS, texts } = loadAS();
  let s = editCSV(texts.settings, 'WorldWidth', 'Value', String(size));
  s = editCSV(s, 'WorldHeight', 'Value', String(size));
  s = editCSV(s, 'StartGrass', 'Value', '0%');
  s = editCSV(s, 'StartBunnies', 'Value', '0');
  s = editCSV(s, 'StartWolves', 'Value', '0');
  s = editCSV(s, 'StartLayout', 'Value', layout);
  texts.settings = s;
  for (const sp of ['Bunny', 'Wolf']) texts.species = editCSV(texts.species, 'HungerRate', sp, '0');
  texts.species = editCSV(texts.species, 'SeedChance', 'Grass', '0%');
  texts.species = editCSV(texts.species, 'GrowthRate', 'Grass', '0');
  texts.species = editCSV(texts.species, 'DigChance', 'Bunny', '0%');
  if (edit) edit(texts);
  const { T, errors } = AS.parseTables(texts);
  if (errors.length) throw new Error(errors.join('\n'));
  const sim = AS.Sim(T, 1);
  return { AS, T, sim, W: sim.W, B: T.bunny };
}
const at = (W, x, y) => y * W.w + x;
const tick = (sim, n = 1) => { for (let i = 0; i < n; i++) sim.tick(); };
const secs = (AS, s) => Math.round(s * AS.TICK_HZ);
const days = (AS, d) => Math.round(d * AS.TICK_HZ * AS.DAY_SECONDS);
const sname = (sim, s, key) => sim.W.aState[s] === 255 ? 'none' : sim.T.states[key][sim.W.aState[s]].name;
function animal(AS, sim, sp, x, y, o = {}) {
  const W = sim.W, s = AS.spawnStarting(sim, sp, at(W, x, y));
  W.aSex[s] = o.sex ?? 0;
  W.aAge[s] = o.age ?? (sp === AS.SPECIES.BUNNY ? 5 : 10);
  if (o.full != null) W.aFullness[s] = o.full;
  W.aDecideLeft[s] = 0;
  return s;
}
const wolf = (AS, sim, x, y, o) => animal(AS, sim, AS.SPECIES.WOLF, x, y, o);
const bun = (AS, sim, x, y, o) => animal(AS, sim, AS.SPECIES.BUNNY, x, y, o);
const still = tx => { tx.species = editCSV(editCSV(tx.species, 'WalkSpeed', 'Wolf', '0'), 'SprintSpeed', 'Wolf', '0'); };

// --- the ground rules: addHole, removeHole, grass ---
{
  const { AS, sim, W } = make(20);
  const t = at(W, 5, 5);
  W.addGrass(at(W, 6, 5), 1, 0);
  let threw = false;
  try { W.addHole(at(W, 6, 5), 0); } catch (e) { threw = true; }
  ok(threw, 'ground: a hole can not be dug on a blade');
  W.addHole(t, 0);
  ok(W.hole[t] === 1 && W.hCount === 1 && W.kind[t] === AS.KIND.EMPTY, 'ground: a hole is ground, the tile stays EMPTY');
  threw = false;
  try { W.addGrass(t, 1, 0); } catch (e) { threw = true; }
  ok(threw, 'ground: addGrass refuses a hole');
  const w = wolf(AS, sim, 9, 9);
  threw = false;
  W.addHole(at(W, 10, 9), 0);
  W.aStepLeft[w] = 0;
  try { W.moveAnimal(w, at(W, 10, 9)); } catch (e) { threw = true; }
  ok(threw, 'ground: moveAnimal refuses a wolf onto a hole');
  W.removeHole(t);
  ok(W.hole[t] === 0 && W.hCount === 1, 'ground: removeHole leaves bare ground');
}

// --- grass never grows on a hole (sprouting, seeding), and returns when it collapses ---
{
  const { AS, sim, W } = make(12, tx => {
    tx.species = editCSV(tx.species, 'SeedChance', 'Grass', '100%');
    tx.species = editCSV(tx.species, 'SproutChance', 'Grass', '100%');
    tx.species = editCSV(tx.species, 'Lifespan', 'Grass', '1000');
    tx.settings = editCSV(tx.settings, 'CollapseDays', 'Value', '1000');
  });
  const holes = [at(W, 3, 3), at(W, 4, 3), at(W, 8, 8)];
  for (const h of holes) W.addHole(h, 0);
  W.addGrass(at(W, 5, 3), 1, 3);
  tick(sim, days(AS, 3));
  ok(holes.every(h => W.kind[h] !== AS.KIND.GRASS), 'grass: nothing grew on a hole in three days of seeding and sprouting');
  ok(W.gCount > 20, `grass: grass did grow elsewhere (${W.gCount} blades)`);
}

// --- wolves: a hole is a wall ---
{
  // The bunny can't move, so the test owns where it is.
  const { AS, sim, W } = make(40, tx => {
    tx.species = editCSV(editCSV(tx.species, 'WalkSpeed', 'Bunny', '0'), 'SprintSpeed', 'Bunny', '0');
    tx.species = editCSV(tx.species, 'HoleRange', 'Bunny', '0');
  });
  // A wall of holes at x = 20, y 0..28, gap at 29..39. Wolf on the left, bunny on the right.
  for (let y = 0; y <= 28; y++) W.addHole(at(W, 20, y), 0);
  const w = wolf(AS, sim, 15, 18, { full: 10 }), b = bun(AS, sim, 25, 18);
  const bSer = W.aSerial[b];
  let crossedWall = false, ranEver = false, killed = false, sideB = false;
  for (let i = 0; i < secs(AS, 40) && !killed; i++) {
    tick(sim);
    const wx = W.tx(W.aTile[w]), wy = W.ty(W.aTile[w]);
    if (wx === 20 && wy <= 28) crossedWall = true;
    if (W.hole[W.aTile[w]]) crossedWall = true;
    if (wx > 20) sideB = true;
    if (!W.aAlive[b] || W.aSerial[b] !== bSer) killed = true;
    if (sname(sim, w, 'wolf') === 'HUNT') ranEver = true;
  }
  ok(ranEver && !crossedWall, 'wolf: never stood on the hole wall while hunting past it');
  ok(sideB && killed, 'wolf: paths around the wall through the gap and kills the bunny');
}
{
  // Boxed in by holes on all four sides: a prowling wolf stays put and nothing throws.
  const { AS, sim, W } = make(20);
  for (const [x, y] of [[9, 10], [11, 10], [10, 9], [10, 11]]) W.addHole(at(W, x, y), 0);
  const w = wolf(AS, sim, 10, 10);
  tick(sim, secs(AS, 30));
  ok(W.aTile[w] === at(W, 10, 10), 'wolf: prowling wolf boxed in by holes stays where it is');
}

// --- a bunny on a hole can't be bitten and isn't hunted ---
{
  const { AS, sim, W } = make(30, still);
  const hole = at(W, 15, 15);
  W.addHole(hole, 0);
  const w = wolf(AS, sim, 15, 16, { full: 10 }), b = bun(AS, sim, 15, 15);
  const hp0 = W.aHP[b];
  ok(AS.biteAnimal(sim, w, b) === false && W.aHP[b] === hp0, 'safe: biteAnimal on a bunny in a hole does nothing');
  let hunted = false;
  for (let i = 0; i < secs(AS, 30); i++) {
    tick(sim);
    if (sname(sim, w, 'wolf') === 'HUNT') hunted = true;
  }
  ok(W.aAlive[b] && W.aHP[b] === hp0 && W.aTile[b] === hole, 'safe: the bunny in the hole is unharmed after 30 s with a hungry wolf beside it');
  ok(!hunted, 'safe: the wolf never hunts a bunny that is on a hole');
  ok(sname(sim, b, 'bunny') === 'HIDE', 'safe: the bunny is hiding');
}
{
  // A wolf mid-hunt: its prey (frozen, so the test owns where it is) ends up on a hole, and
  // the hunt ends at the next decision even with TrackSeconds on.
  const { AS, sim, W } = make(30, tx => {
    tx.species = editCSV(tx.species, 'TrackSeconds', 'Wolf', '30');
    tx.species = editCSV(editCSV(tx.species, 'WalkSpeed', 'Bunny', '0'), 'SprintSpeed', 'Bunny', '0');
    tx.species = editCSV(tx.species, 'HoleRange', 'Bunny', '0');
  });
  const w = wolf(AS, sim, 6, 15, { full: 10 }), b = bun(AS, sim, 14, 15);
  W.addHole(at(W, 14, 16), 0);
  tick(sim, secs(AS, 0.5));
  ok(sname(sim, w, 'wolf') === 'HUNT', 'hunt: the wolf is hunting the bunny');
  W.moveAnimal(b, at(W, 14, 16));
  tick(sim, secs(AS, 1));
  ok(sname(sim, w, 'wolf') !== 'HUNT', 'hunt: the hunt ends once its prey is in a hole, even with TrackSeconds on');
}

// --- fleeing to a free hole, hiding, and leaving ---
{
  const { AS, sim, W } = make(30, tx => { still(tx); });
  const hole = at(W, 13, 10);
  W.addHole(hole, 0);
  const w = wolf(AS, sim, 6, 10, { full: 10 }), b = bun(AS, sim, 10, 10);
  let sawFlee = false, hid = -1;
  for (let i = 0; i < secs(AS, 10) && hid < 0; i++) {
    tick(sim);
    if (sname(sim, b, 'bunny') === 'FLEE') sawFlee = true;
    if (W.aTile[b] === hole && sname(sim, b, 'bunny') === 'HIDE') hid = i;
  }
  ok(sawFlee && hid >= 0, `flee: a bunny with a free hole in range runs to it and hides (tick ${hid})`);
  tick(sim, secs(AS, 20));
  ok(W.aTile[b] === hole && sname(sim, b, 'bunny') === 'HIDE', 'hide: it stays put for 20 s while the wolf is in sight');
  // The wolf goes away; the bunny is hungry with a blade in view: it leaves.
  W.removeAnimal(w);
  W.aFullness[b] = 10;
  W.addGrass(at(W, 13, 14), 1, 3);
  tick(sim, secs(AS, 10));
  ok(W.aTile[b] !== hole && sname(sim, b, 'bunny') !== 'HIDE', `hide: with no wolf in sight a hungry bunny leaves (${sname(sim, b, 'bunny')})`);
}
{
  // No hole in range: it flees away as before.
  const { AS, sim, W } = make(40, tx => { still(tx); });
  W.addHole(at(W, 30, 10), 0);   // farther than HoleRange
  const w = wolf(AS, sim, 6, 10, { full: 10 }), b = bun(AS, sim, 10, 10);
  tick(sim, secs(AS, 0.5));
  ok(sname(sim, b, 'bunny') === 'FLEE' && W.aTile[b] % W.w > 10, 'flee: no hole in range, it runs away from the wolf as before');
}
{
  // A taken hole is not free.
  const { AS, sim, W } = make(30, tx => { still(tx); });
  const hole = at(W, 13, 10);
  W.addHole(hole, 0);
  bun(AS, sim, 13, 10);
  wolf(AS, sim, 6, 10, { full: 10 });
  const b2 = bun(AS, sim, 10, 10);
  tick(sim, secs(AS, 5));
  ok(W.aTile[b2] !== hole, 'flee: a second bunny does not run to an occupied hole');
}

// --- collapse ---
{
  const { AS, sim, W } = make(20, tx => { tx.settings = editCSV(tx.settings, 'CollapseDays', 'Value', '1'); tx.species = editCSV(tx.species, 'WalkSpeed', 'Bunny', '0'); });
  const A = at(W, 3, 3), B = at(W, 10, 10);
  W.addHole(A, 0); W.addHole(B, 0);
  const b = bun(AS, sim, 10, 10, { age: 3 });
  tick(sim, days(AS, 0.9));
  ok(W.hole[A] === 1 && W.hole[B] === 1, 'collapse: both holes stand before CollapseDays');
  tick(sim, days(AS, 0.4));
  ok(W.hole[A] === 0 && W.hole[B] === 1 && W.hCount === 1, 'collapse: the unused hole collapsed, the one a bunny stands on did not');
  tick(sim, days(AS, 1.5));
  ok(W.hole[B] === 1, 'collapse: a hole stays as long as a bunny keeps standing on it');
  W.removeAnimal(b);
  tick(sim, days(AS, 1.2));
  ok(W.hole[B] === 0 && W.hCount === 0, 'collapse: once the bunny is gone it collapses after CollapseDays');
}

// --- digging ---
const dig = (tx, extra) => {
  tx.species = editCSV(tx.species, 'DigChance', 'Bunny', '100%');
  tx.species = editCSV(tx.species, 'WanderRun', 'Bunny', '1');
  tx.settings = editCSV(tx.settings, 'CollapseDays', 'Value', '1000');
  if (extra) extra(tx);
};
{
  const { AS, sim, W, B } = make(30, tx => dig(tx));
  const b = bun(AS, sim, 15, 15, { full: 100 });
  tick(sim, secs(AS, B.DigSeconds - 1));
  ok(W.hCount === 0 && sname(sim, b, 'bunny') === 'DIG' && W.aTile[b] === at(W, 15, 15), 'dig: a fed adult stands still digging; no hole before DigSeconds');
  tick(sim, secs(AS, 2));
  const h = W.hList[0];
  const d = Math.abs(W.tx(h) - 15) + Math.abs(W.ty(h) - 15);
  ok(W.hCount >= 1 && d === 1, 'dig: after DigSeconds there is a hole on a 4-neighbor tile');
  ok(W.holeUsedAt[h] > 0, 'dig: a new hole is stamped as used now');
}
{
  const { AS, sim, W } = make(30, tx => dig(tx, t2 => { t2.species = editCSV(t2.species, 'HungerRate', 'Bunny', '0'); }));
  const hungry = bun(AS, sim, 15, 15, { full: 10 });
  tick(sim, secs(AS, 15));
  ok(W.hCount === 0, 'dig: a hungry bunny does not dig');
  const kid = bun(AS, sim, 5, 5, { full: 100, age: 0 });
  tick(sim, secs(AS, 15));
  ok(W.hCount === 0, 'dig: a baby does not dig');
}
{
  // Near a warren: only the neighbor within WarrenRadius of the hole qualifies.
  const { AS, sim, W, T } = make(30, tx => dig(tx));
  W.addHole(at(W, 10, 15), 0);
  const b = bun(AS, sim, 14, 15, { full: 100 });
  tick(sim, secs(AS, T.bunny.DigSeconds + 1));
  ok(W.hCount >= 2 && W.hole[at(W, 13, 15)] === 1, 'dig: a bunny at the edge of a warren digs the one neighbor within WarrenRadius');
}
{
  // A hole in range but out of WarrenRadius: no digging (the hole is a warren already).
  const { AS, sim, W, T } = make(30, tx => dig(tx, t2 => { t2.species = editCSV(t2.species, 'WalkSpeed', 'Bunny', '0'); }));
  W.addHole(at(W, 10, 15), 0);
  bun(AS, sim, 16, 15, { full: 100 });
  tick(sim, secs(AS, T.bunny.DigSeconds * 3));
  ok(W.hCount === 1, 'dig: within HoleRange of a hole but not WarrenRadius, it digs nothing');
}
{
  // Far from any hole: it founds a new warren.
  const { AS, sim, W, T } = make(40, tx => dig(tx));
  W.addHole(at(W, 5, 5), 0);
  bun(AS, sim, 30, 30, { full: 100 });
  tick(sim, secs(AS, T.bunny.DigSeconds + 1));
  ok(W.hCount >= 2 && W.hList.slice(0, W.hCount).some(h => Math.abs(W.tx(h) - 30) + Math.abs(W.ty(h) - 30) === 1), 'dig: a bunny far from any hole founds a new warren');
}
{
  // A dig is abandoned when the tile stops being bare.
  const { AS, sim, W, T } = make(30, tx => dig(tx));
  const b = bun(AS, sim, 15, 15, { full: 100 });
  tick(sim, secs(AS, 2));
  const target = W.aTargetTile[b];
  ok(target >= 0, 'dig: it has a tile in mind');
  W.addGrass(target, 1, 0);
  tick(sim, secs(AS, T.bunny.DigSeconds));
  ok(W.hole[target] === 0, 'dig: abandoned when the tile gets a blade (and no hole appeared on it)');
}
{
  // DigChance is a per-day chance, so the dig rate is -ln(1 - DigChance) per bunny per day.
  // HoleRange 0 lets every bunny found its own hole, so no bunny is shut out by a neighbor's.
  const { AS, sim, W, T } = make(60, tx => {
    tx.species = editCSV(tx.species, 'DigChance', 'Bunny', '50%');
    tx.species = editCSV(tx.species, 'DigSeconds', 'Bunny', '0.1');
    tx.species = editCSV(tx.species, 'HoleRange', 'Bunny', '0');
    tx.settings = editCSV(tx.settings, 'CollapseDays', 'Value', '1000');
  });
  const n = 400;
  let placed = 0;
  for (let y = 1; y < 59 && placed < n; y += 3) for (let x = 1; x < 59 && placed < n; x += 3) { bun(AS, sim, x, y, { full: 100, age: 3 }); placed++; }
  tick(sim, days(AS, 1));
  const frac = W.hCount / placed, expect = -Math.log(1 - 0.5);
  ok(Math.abs(frac - expect) < 0.15, `dig: with DigChance 50% a day, ${frac.toFixed(2)} holes per bunny in a day (expect ${expect.toFixed(2)})`);
}

// --- the Meadows start digs each colony's holes; Scatter digs none ---
{
  const { AS, texts } = loadAS();
  const tx = { ...texts };
  tx.settings = editCSV(tx.settings, 'StartBunnies', 'Value', '60');
  const { T, errors } = AS.parseTables(tx);
  if (errors.length) throw new Error(errors.join('\n'));
  const sim = AS.Sim(T, 3);
  const W = sim.W, per = T.world.HolesPerColony, colonies = T.world.BunnyColonies;
  ok(T.world.StartLayout === 'Meadows' && W.hCount === per * colonies, `start: Meadows digs HolesPerColony (${per}) holes at each of ${colonies} colonies (${W.hCount})`);
  let onHole = 0, wolfOnHole = 0, grassOnHole = 0;
  for (let t = 0; t < W.n; t++) if (W.hole[t]) {
    if (W.kind[t] === AS.KIND.BUNNY) onHole++;
    if (W.kind[t] === AS.KIND.WOLF) wolfOnHole++;
    if (W.kind[t] === AS.KIND.GRASS) grassOnHole++;
  }
  ok(wolfOnHole === 0 && grassOnHole === 0, 'start: no wolf or blade starts on a hole');
  console.log(`     (${onHole} bunnies start standing on a hole)`);
  const sc = AS.Sim(T, 3, { layout: 'scatter' });
  ok(sc.W.hCount === 0, 'start: Scatter layout digs no holes');
}
{
  // The colonies' own holes sit by the colony: each colony center has HolesPerColony within a few spreads.
  const { AS, texts } = loadAS();
  const t0 = { ...texts };
  t0.settings = editCSV(editCSV(editCSV(t0.settings, 'StartBunnies', 'Value', '0'), 'StartWolves', 'Value', '0'), 'StartGrass', 'Value', '0%');
  const t1 = { ...texts };
  t1.settings = editCSV(t1.settings, 'StartBunnies', 'Value', '30');
  const T0 = AS.parseTables(t0).T, T1 = AS.parseTables(t1).T;
  const sim = AS.Sim(T0, 5);
  const out = AS.startMeadows({ W: sim.W, T: T1, rng: sim.rng }, {});
  const W = sim.W;
  ok(out.colonies.length >= 1, `start: ${out.colonies.length} colonies placed`);
  let perfect = true;
  for (const c of out.colonies) {
    let n = 0;
    for (let t = 0; t < W.n; t++) if (W.hole[t] && Math.hypot(W.tx(t) - c.x, W.ty(t) - c.y) < 15) n++;
    if (n !== T1.world.HolesPerColony) perfect = false;
  }
  ok(perfect, 'start: every colony has exactly HolesPerColony holes near its center');
}

console.log(bad ? `\nFAIL (${bad})` : '\nALL PASS');
process.exit(bad ? 1 : 0);
