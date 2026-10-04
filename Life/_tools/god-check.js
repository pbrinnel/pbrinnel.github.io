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
console.log(bad ? `${bad} FAILED` : 'all passed');
process.exit(bad ? 1 : 0);
