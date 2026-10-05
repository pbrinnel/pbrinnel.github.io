'use strict';
// The God tab's nuke (js/god.js): everything within NukeRadius goes (animals with no corpse
// and no event, blades, corpses, holes) and nothing outside it; the grid and stores still
// audit; the ground is scorched, longest at the center; nothing grows or is dug on it until
// it cools, and then grass can return.
const { load, audit, editCSV, failures } = require('./harness.js');
let bad = 0;
function ok(c, m) { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; }

const RADIUS = 20, DAYS = 8;
const { AS, texts } = load();
let s = texts.settings;
for (const [k, v] of [['WorldWidth', '150'], ['WorldHeight', '100'], ['NukeRadius', String(RADIUS)], ['ScorchDays', String(DAYS)]]) s = editCSV(s, k, 'Value', v);
texts.settings = s;
texts.species = editCSV(texts.species, 'DigChance', 'Bunny', '100%');   // bunnies dig whenever they may
const { T, errors } = AS.parseTables(texts);
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
const sim = AS.Sim(T, 7), W = sim.W, K = AS.KIND;
const DAY = AS.TICK_HZ * AS.DAY_SECONDS;
const days = n => { for (let i = 0; i < n * DAY; i++) sim.tick(); };
days(4);
// A few blades of our own in the blast, so the test never depends on where this seed's
// meadows happen to fall.
for (const [x, y] of [[72, 47], [78, 53], [70, 52]]) {
  const t = W.tile(x, y);
  if (W.kind[t] === K.EMPTY && !W.hole[t] && !(W.scorch[t] > 0)) W.addGrass(t, 1, 0);
}
// Corpses from nowhere in the blast and outside it, so both are exercised.
const center = W.tile(75, 50);
for (const [x, y] of [[75, 50], [80, 55], [100, 50], [20, 20]]) {
  const t = W.tile(x, y);
  if (W.hole[t]) W.removeHole(t);
  AS.debugDropCorpse(sim, t, AS.SPECIES.BUNNY);
}
const inside = t => { const dx = W.tx(t) - 75, dy = W.ty(t) - 50; return dx * dx + dy * dy <= RADIUS * RADIUS; };
const tally = () => {
  const c = { in: { animals: 0, blades: 0, corpses: 0, holes: 0 }, out: { animals: 0, blades: 0, corpses: 0, holes: 0 } };
  for (let t = 0; t < W.n; t++) {
    const o = inside(t) ? c.in : c.out, k = W.kind[t];
    if (k === K.BUNNY || k === K.WOLF) o.animals++; else if (k === K.GRASS) o.blades++; else if (k === K.CORPSE) o.corpses++;
    if (W.hole[t]) o.holes++;
  }
  return c;
};
const before = tally();
ok(before.in.animals > 0 && before.in.blades > 0 && before.in.corpses > 0 && before.in.holes > 0, `the blast area starts full: ${JSON.stringify(before.in)}`);
const events = sim.events.written;
const r = AS.nuke(sim, center);
const after = tally();
ok(Object.values(after.in).every(v => v === 0), 'nothing alive, growing, dead or dug is left inside the radius');
ok(JSON.stringify(after.out) === JSON.stringify(before.out), 'nothing outside the radius changed');
ok(r.animals === before.in.animals && r.blades === before.in.blades && r.corpses === before.in.corpses && r.holes === before.in.holes, 'the returned counts match what was destroyed');
let leftBodies = 0;
for (let t = 0; t < W.n; t++) if (inside(t) && W.kind[t] !== K.EMPTY) leftBodies++;
ok(leftBodies === 0 && sim.events.written === events, 'no corpse, no meat, no DEATH event left behind by the animals');
const fails0 = failures.length;
audit(AS, sim, 'after nuke');
ok(failures.length === fails0, 'the grid and stores audit after a nuke' + (failures.length > fails0 ? ': ' + failures.slice(fails0, fails0 + 3).join('; ') : ''));

// Scorch: set inside only, longest at the center, shorter toward the rim.
let inOk = true, outOk = true, mono = true;
for (let t = 0; t < W.n; t++) {
  if (inside(t) && !(W.scorch[t] > 0)) inOk = false;
  if (!inside(t) && W.scorch[t] !== 0) outOk = false;
}
ok(inOk && outOk, 'every tile in the radius is scorched and none outside');
ok(Math.abs(W.scorch[center] - DAYS) < 1e-5, 'the center is scorched for ScorchDays');
for (let d = 1; d <= RADIUS; d++) if (!(W.scorch[W.tile(75 + d, 50)] < W.scorch[W.tile(75 + d - 1, 50)])) mono = false;
ok(mono && W.scorch[W.tile(75 + RADIUS, 50)] > 0, 'scorch shortens steadily toward the rim but never reaches 0 inside it');

// Nothing grows or is dug on scorch while it lasts (audit checks grass/holes on scorch daily),
// and it counts down to bare ground.
let scorchedLeft = 0, regrown = 0;
for (let d = 1; d <= DAYS + 12; d++) {
  days(1);
  const f = failures.length; audit(AS, sim, `day +${d}`);
  if (failures.length > f) { ok(false, 'audit after nuke, day +' + d + ': ' + failures[f]); break; }
}
for (let t = 0; t < W.n; t++) if (W.scorch[t] > 0) scorchedLeft++;
ok(scorchedLeft === 0, 'every tile has cooled by ScorchDays plus a little');
for (let t = 0; t < W.n; t++) if (inside(t) && W.kind[t] === K.GRASS) regrown++;
ok(regrown > 0, `grass grows back on cooled ground (${regrown} blades in the crater)`);

// Direct guards.
const t0 = W.tile(75, 50);
W.scorch[t0] = 1;
let threwG = false, threwH = false;
try { W.addGrass(t0, 0.5, 0); } catch (e) { threwG = true; }
try { W.addHole(t0, 0); } catch (e) { threwH = true; }
ok(threwG && threwH, 'addGrass and addHole refuse a scorched tile');
W.scorch[t0] = 0;

// ---- The paint modes' brush (AS.paintCircle) ----
{
  const sim2 = AS.Sim(T, 11), W2 = sim2.W, P = AS.SPECIES;
  const cx = 60, cy = 40, R = 9;
  const inCircle = (t, r = R) => (W2.tx(t) - cx) ** 2 + (W2.ty(t) - cy) ** 2 <= r * r;
  for (const kind of ['grass', 'bunny', 'wolf']) {
    // Scatter obstacles: a scorched strip, a few holes, and whatever already stands there.
    for (let x = cx - 3; x <= cx + 3; x++) { const t = W2.tile(x, cy + 2); if (W2.kind[t] === K.EMPTY && !W2.hole[t]) W2.scorch[t] = 5; }
    for (const [x, y] of [[cx, cy], [cx + 1, cy + 5], [cx - 4, cy - 3]]) { const t = W2.tile(x, y); if (W2.kind[t] === K.EMPTY && !(W2.scorch[t] > 0) && !W2.hole[t]) W2.addHole(t, 0); }
    const eligible = [], snap = new Map();
    for (let t = 0; t < W2.n; t++) {
      snap.set(t, W2.kind[t]);
      if (!inCircle(t) || W2.kind[t] !== K.EMPTY) continue;
      if (kind === 'grass' ? (W2.hole[t] || W2.scorch[t] > 0) : kind === 'wolf' && W2.hole[t]) continue;
      eligible.push(t);
    }
    const placed = AS.paintCircle(sim2, kind, cx, cy, R);
    const want = kind === 'grass' ? K.GRASS : kind === 'bunny' ? K.BUNNY : K.WOLF;
    let filled = 0, changedOutside = 0, bad2 = 0;
    for (let t = 0; t < W2.n; t++) {
      if (W2.kind[t] !== snap.get(t)) { if (inCircle(t) && eligible.includes(t) && W2.kind[t] === want) filled++; else changedOutside++; }
    }
    ok(placed === eligible.length && filled === eligible.length && changedOutside === 0 && eligible.length > 20, `${kind}: exactly the ${eligible.length} empty eligible tiles in the circle get one (placed ${placed}), nothing else changes`);
    let sexes = new Set(), minAge = Infinity, maxAge = -1;
    const S = kind === 'grass' ? T.grass : T[kind];
    for (const t of eligible) {
      if (kind === 'grass') {
        const a = W2.gAge[t];
        minAge = Math.min(minAge, a); maxAge = Math.max(maxAge, a);
        if (a < 0 || a >= S.Lifespan || Math.abs(W2.gSize[t] - Math.min(1, S.SproutSize + a * S.GrowthRate)) > 1e-6) bad2++;
        if (W2.scorch[t] > 0 || W2.hole[t]) bad2++;
      } else {
        const s2 = W2.aSlot[t], a = W2.aAge[s2];
        sexes.add(W2.aSex[s2]); minAge = Math.min(minAge, a); maxAge = Math.max(maxAge, a);
        if (a < 0 || a >= S.Lifespan * 0.95 || W2.aFullness[s2] !== S.FullnessMax || W2.aHP[s2] !== S.HPMax || W2.aStamina[s2] !== S.StaminaMax) bad2++;
        if (kind === 'wolf' && W2.hole[t]) bad2++;
      }
    }
    ok(bad2 === 0, `${kind}: ages in range, full body, none on forbidden ground`);
    ok(maxAge - minAge > 0.5 * S.Lifespan * (kind === 'grass' ? 1 : 0.95) * 0.5, `${kind}: ages spread (${minAge.toFixed(1)}..${maxAge.toFixed(1)} days)`);
    if (kind !== 'grass') ok(sexes.size === 2, `${kind}: both sexes appear`);
    ok(AS.paintCircle(sim2, kind, cx, cy, R) === 0, `${kind}: painting again over a full circle adds nothing`);
    const fz = failures.length; audit(AS, sim2, 'after paint ' + kind);
    ok(failures.length === fz, `${kind}: the grid and stores audit after painting`);
    // Clear it for the next kind.
    for (const t of eligible) {
      if (W2.kind[t] === K.GRASS) W2.removeGrass(t); else if (W2.kind[t] === K.BUNNY || W2.kind[t] === K.WOLF) W2.removeAnimal(W2.aSlot[t]);
    }
  }
  // Bunnies may stand on holes; scorch and edges don't stop them; the world edge clips.
  const ht = W2.tile(10, 10); if (W2.kind[ht] === K.EMPTY) { if (!W2.hole[ht]) W2.addHole(ht, 0); }
  AS.paintCircle(sim2, 'bunny', 10, 10, 2);
  ok(W2.kind[ht] === K.BUNNY, 'a bunny can be painted onto a warren hole');
  let threw = false;
  try { AS.paintCircle(sim2, 'wolf', 0, 0, 3); AS.paintCircle(sim2, 'grass', W2.w - 1, W2.h - 1, 3); } catch (e) { threw = true; }
  ok(!threw, 'a brush over the world corner is clipped, not an error');
  // Painted animals of every age act normally for a few days.
  AS.paintCircle(sim2, 'bunny', 70, 60, 6); AS.paintCircle(sim2, 'wolf', 90, 60, 6);
  const f2 = failures.length;
  for (let d = 1; d <= 4; d++) { for (let i = 0; i < DAY; i++) sim2.tick(); audit(AS, sim2, 'painted, day ' + d); }
  ok(failures.length === f2, 'the sim runs and audits for 4 days after painting animals');
}
console.log(bad ? `${bad} FAILED` : 'all passed');
process.exit(bad ? 1 : 0);
