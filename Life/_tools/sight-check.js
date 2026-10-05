'use strict';
const h = require('./harness.js');

let fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('FAIL: ' + m); } }

function mk(w, ht, grassPct = '0%', seed = 1) {
  const { AS, texts } = h.load();
  let s = h.editCSV(texts.settings, 'WorldWidth', 'Value', String(w));
  s = h.editCSV(s, 'WorldHeight', 'Value', String(ht));
  s = h.editCSV(s, 'StartGrass', 'Value', grassPct);
  s = h.editCSV(s, 'StartBunnies', 'Value', '0');
  s = h.editCSV(s, 'Rivers', 'Value', '0');
  s = h.editCSV(s, 'Lakes', 'Value', '0');   // these hand-place things on tiles; water is water-check.js's and thirst-check.js's
  s = h.editCSV(s, 'StartWolves', 'Value', '0');
  const { T, errors } = AS.parseTables({ ...texts, settings: s });
  if (errors.length) throw new Error(errors.join('\n'));
  const sim = AS.Sim(T, seed);
  return { AS, sim, W: sim.W };
}
const at = (W, x, y) => y * W.w + x;
const dist2 = (W, a, b) => (W.tx(a) - W.tx(b)) ** 2 + (W.ty(a) - W.ty(b)) ** 2;

// Independent BFS distance (steps over EMPTY tiles, inside circle), or -1.
function refDist(W, from, goal, range) {
  const d = new Map([[from, 0]]), q = [from], nb = new Int32Array(4);
  if (goal(from)) return 0;
  while (q.length) {
    const c = q.shift();
    const k = W.neighbors4(c, nb);
    for (let i = 0; i < k; i++) {
      const n = nb[i];
      if (d.has(n) || W.kind[n] !== 0 || dist2(W, from, n) > range * range) continue;
      d.set(n, d.get(c) + 1);
      if (goal(n)) return d.get(n);
      q.push(n);
    }
  }
  return -1;
}

// ---- Line of sight ----
{
  const { AS, W } = mk(20, 20);
  const a = at(W, 2, 5), b = at(W, 10, 5);
  ok(AS.lineOfSight(W, a, b), 'clear line');
  W.addGrass(at(W, 6, 5), 1, 0);
  ok(!AS.lineOfSight(W, a, b) && !AS.lineOfSight(W, b, a), 'blade between blocks, both ways');
  W.removeGrass(at(W, 6, 5));
  W.addCorpse(at(W, 6, 5), AS.SPECIES.BUNNY);
  ok(AS.lineOfSight(W, a, b), 'corpse does not block');
  W.removeCorpse(at(W, 6, 5));
  W.addAnimal(at(W, 6, 5), AS.SPECIES.WOLF, 0);
  ok(AS.lineOfSight(W, a, b), 'animal does not block');
  W.removeAnimal(W.aSlot[at(W, 6, 5)]);
  W.addGrass(a, 1, 0); W.addGrass(b, 1, 0);
  ok(AS.lineOfSight(W, a, b), 'endpoints never block');
  ok(AS.lineOfSight(W, a, a), 'same tile');
  ok(AS.lineOfSight(W, a, a + 1) && AS.lineOfSight(W, a, a + W.w + 1), 'adjacent and diagonal');
}
{
  const { AS, W } = mk(40, 40, '40%', 7);
  let n = 0, seen = 0, bad = 0, s = 12345;
  const rnd = m => { s = (s * 1664525 + 1013904223) >>> 0; return s % m; };
  for (let i = 0; i < 200000; i++) {
    const a = rnd(W.n), b = rnd(W.n);
    const r = AS.lineOfSight(W, a, b);
    if (r !== AS.lineOfSight(W, b, a)) bad++;
    n++; if (r) seen++;
  }
  ok(bad === 0, `symmetry: ${bad} of ${n} pairs differ`);
  console.log(`symmetry: ${n} random pairs, ${seen} visible, ${bad} asymmetric`);
}

// ---- nearestVisible ----
{
  const { AS, sim, W } = mk(30, 30);
  const from = at(W, 15, 15), isCorpse = t => W.kind[t] === AS.KIND.CORPSE;
  ok(AS.nearestVisible(sim, from, 8, isCorpse) === -1, 'none -> -1');
  const far = at(W, 20, 15), near = at(W, 12, 15);
  W.addCorpse(far, 0); W.addCorpse(near, 0);
  ok(AS.nearestVisible(sim, from, 8, isCorpse) === near, 'nearest of two');
  W.addGrass(at(W, 13, 15), 1, 0);
  ok(AS.nearestVisible(sim, from, 8, isCorpse) === far, 'skips nearer hidden one');
  W.addGrass(at(W, 17, 15), 1, 0);
  ok(AS.nearestVisible(sim, from, 8, isCorpse) === -1, 'both hidden -> -1');
  // circle, not square: (+6,+6) is d2 72 > 64 but inside the 8-square
  W.addCorpse(at(W, 21, 21), 0);
  ok(AS.nearestVisible(sim, from, 8, t => t === at(W, 21, 21)) === -1, 'corner of the square is outside the circle');
  ok(AS.nearestVisible(sim, from, 8.5, t => t === at(W, 21, 21)) === at(W, 21, 21), 'fractional range 8.5 reaches d2 72');
  // sees a blade, and sees from a tile hemmed by grass
  ok(AS.nearestVisible(sim, from, 8, t => t === at(W, 13, 15)) === at(W, 13, 15), 'sees a blade');
  // edges
  const corner = at(W, 0, 0);
  W.addCorpse(at(W, 2, 1), 0);
  ok(AS.nearestVisible(sim, corner, 6, isCorpse) === at(W, 2, 1), 'works at the corner');
  ok(AS.nearestVisible(sim, at(W, 29, 29), 6, isCorpse) === -1, 'no wrap at opposite corner');
}
{ // brute-force comparison on a random world
  const { AS, sim, W } = mk(60, 60, '40%', 3);
  let s = 99, bad = 0;
  const rnd = m => { s = (s * 1664525 + 1013904223) >>> 0; return s % m; };
  const match = t => W.kind[t] === AS.KIND.GRASS && t % 7 === 0;
  for (let i = 0; i < 3000; i++) {
    const f = rnd(W.n);
    if (W.kind[f] === AS.KIND.GRASS) continue;
    const r = [3, 6.5, 12][i % 3];
    let best = Infinity;
    for (let t = 0; t < W.n; t++) {
      if (t === f) continue;
      const d = dist2(W, f, t);
      if (d <= r * r && d < best && match(t) && AS.lineOfSight(W, f, t)) best = d;
    }
    const got = AS.nearestVisible(sim, f, r, match);
    if ((got < 0 ? Infinity : dist2(W, f, got)) !== best) bad++;
  }
  ok(bad === 0, `nearestVisible vs brute force: ${bad} mismatches`);
  console.log(`nearestVisible vs brute force: ${bad} mismatches`);
}

// ---- pathNext ----
{
  const { AS, sim, W } = mk(20, 20);
  const from = at(W, 5, 10), goalT = at(W, 12, 10), isG = t => t === goalT;
  ok(AS.pathNext(sim, from, t => t === from, 8) === from, 'at goal returns from');
  for (let y = 5; y <= 15; y++) W.addGrass(at(W, 8, y), 1, 0); // wall x=8, y 5..15
  const want = refDist(W, from, isG, 12);
  let cur = from, steps = 0;
  while (cur !== goalT && steps < 100) {
    const nx = AS.pathNext(sim, cur, isG, 12);
    ok(nx >= 0 && W.kind[nx] === 0, 'step onto empty tile');
    if (nx < 0) break;
    cur = nx; steps++;
  }
  ok(cur === goalT && steps === want, `around the wall: ${steps} steps, BFS ${want}`);
  ok(AS.pathNext(sim, from, isG, 7) === -1, 'goal outside range -> -1');
  // walled in
  const { AS: A2, sim: s2, W: W2 } = mk(10, 10);
  const c = at(W2, 5, 5);
  for (const n of [c - 1, c + 1, c - 10, c + 10]) W2.addGrass(n, 1, 0);
  ok(A2.pathNext(s2, c, t => t === at(W2, 8, 8), 8) === -1, 'walled in -> -1');
  // occupied tile is not stepped on or goal
  const { AS: A3, sim: s3, W: W3 } = mk(10, 10);
  W3.addCorpse(at(W3, 5, 5), 0);
  ok(A3.pathNext(s3, at(W3, 3, 5), t => t === at(W3, 5, 5), 8) === -1, 'goal on a non-empty tile is unreachable');
}
{ // random worlds: following steps equals BFS distance
  const { AS, sim, W } = mk(50, 50, '40%', 11);
  let s = 5, bad = 0, n = 0;
  const rnd = m => { s = (s * 1664525 + 1013904223) >>> 0; return s % m; };
  for (let i = 0; i < 60000; i++) {
    const f = rnd(W.n), g = rnd(W.n);
    if (W.kind[f] || W.kind[g] || dist2(W, f, g) > 25) continue;
    const goal = t => t === g, r = 8;
    const want = refDist(W, f, goal, r);
    let cur = f, steps = 0, fail = false;
    for (;;) {
      const nx = AS.pathNext(sim, cur, goal, r);
      if (nx === cur) break;
      if (nx < 0 || W.kind[nx] !== 0) { fail = true; break; }
      // stays in circle of the ORIGINAL from is not required of later calls; skip that
      cur = nx; if (++steps > 200) { fail = true; break; }
    }

    if (want > 10) continue; // winding detours can leave the recentered circle
    n++;
    if (want < 0) { if (AS.pathNext(sim, f, goal, r) !== -1) bad++; continue; }
    // Goals near the start only: each call recenters the circle on the walker, so a long
    // detour could leave it and the walk could (rarely) lengthen. Here it must match BFS.
    if (fail || steps !== want) { bad++; if (bad < 4) console.log("bad", {fail, steps, want, d2: dist2(W, f, g)}); }
  }
  ok(bad === 0, `random pathing: ${bad} bad of ${n}`);
  console.log(`random pathing: ${n} cases, ${bad} bad (walk length == BFS distance)`);
}


// ---- pathNextWeighted ----
{
  const mkCost = W => t => W.kind[t] === 0 ? 1 : W.kind[t] === 1 ? 4 : Infinity;
  // follow it, chewing: the walker enters each step; grass is removed as it is entered
  function follow(AS, sim, W, from, g, range, cost) {
    let cur = from, total = 0, n = 0;
    for (; cur !== g && n++ < 500;) {
      const nx = AS.pathNextWeighted(sim, cur, t => t === g, range, cost);
      if (nx < 0) return -1;
      total += cost(nx); cur = nx;
    }
    return total;
  }
  { // short wall: go around (3 extra steps) vs chew (+3): wall of 1 tile, detour costs more than chew
    const { AS, sim, W } = mk(20, 20);
    const cost = mkCost(W), from = at(W, 5, 10), g = at(W, 7, 10);
    W.addGrass(at(W, 6, 10), 1, 0);
    // straight through: 4 + 1 = 5. Around: 4 moves... (5,10)->(5,9)->(6,9)->(7,9)->(7,10) = 4
    ok(AS.pathNextWeighted(sim, from, t => t === g, 8, cost) !== at(W, 6, 10), 'detour of 4 beats chewing cost 5');
    // thick wall: chew
    for (let y = 0; y < 20; y++) { if (W.kind[at(W, 6, y)] === 0) W.addGrass(at(W, 6, y), 1, 0); }
    ok(AS.pathNextWeighted(sim, from, t => t === g, 8, cost) === at(W, 6, 10), 'chews through a full-height wall (grass is first step)');
    ok(follow(AS, sim, W, from, g, 8, cost) === 5, 'chew total 5');
    // Infinity walls
    const inf = t => (W.kind[t] === 1 ? Infinity : 1);
    ok(AS.pathNextWeighted(sim, from, t => t === g, 8, inf) === -1, 'Infinity tiles are walls');
    ok(AS.pathNextWeighted(sim, from, t => t === from, 8, cost) === from, 'at goal returns from');
    ok(AS.pathNextWeighted(sim, from, t => t === g, 1.5, cost) === -1, 'goal outside range');
  }
  { // random worlds vs a simple Bellman-Ford style reference
    const { AS, sim, W } = mk(40, 40, '60%', 21);
    const cost = mkCost(W), nb = new Int32Array(4);
    let s = 3, bad = 0, n = 0;
    const rnd = m => { s = (s * 1664525 + 1013904223) >>> 0; return s % m; };
    for (let i = 0; i < 6000; i++) {
      const f = rnd(W.n), g = f + (rnd(11) - 5) + (rnd(11) - 5) * W.w, range = 9;
      if (g < 0 || g >= W.n || Math.abs(W.tx(g) - W.tx(f)) > 5) continue;
      if (W.kind[f] || W.kind[g] === 2 || f === g || dist2(W, f, g) > 36) continue;
      const D = new Map([[f, 0]]);
      for (let ch = true; ch;) {
        ch = false;
        for (const [t, d] of [...D]) {
          const k = W.neighbors4(t, nb);
          for (let j = 0; j < k; j++) {
            const m = nb[j];
            if (dist2(W, f, m) > range * range) continue;
            const nd = d + cost(m);
            if (!D.has(m) || D.get(m) > nd) { D.set(m, nd); ch = true; }
          }
        }
      }
      const want = D.get(g);
      // Replanning recenters the circle; use a wide range so the optimum stays inside it.
      const got = follow(AS, sim, W, f, g, range, cost);
      n++;
      if (want === undefined ? got !== -1 : got < 0 || got > want + 1e-9 || got < want - 1e-9) bad++;
    }
    ok(bad === 0, `weighted vs reference: ${bad} bad of ${n}`);
    console.log(`weighted vs reference: ${n} cases, ${bad} bad`);
  }
}

// ---- allocation and timings on the real size ----
{
  const { AS, sim, W } = mk(300, 200, '40%', 42);
  const dense = mk(300, 200, '60%', 43), dcost = t => dense.W.kind[t] === 0 ? 1 : dense.W.kind[t] === 1 ? 4 : Infinity;
  const dEmpt = []; for (let t = 0; t < dense.W.n; t++) if (dense.W.kind[t] === 0) dEmpt.push(t);
  const empties = [];
  for (let t = 0; t < W.n; t++) if (W.kind[t] === 0) empties.push(t);
  const blades = W.gList.subarray(0, W.gCount);
  const N = 20000;
  const pick = (arr, i) => arr[(i * 2654435761 >>> 0) % arr.length];
  const bench = (name, fn) => {
    for (let i = 0; i < 2000; i++) fn(i);
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < N; i++) fn(i);
    console.log(`${name}: ${(Number(process.hrtime.bigint() - t0) / N / 1000).toFixed(2)} us/call`);
  };
  const isBlade = t => W.kind[t] === 1;
  const never = () => false;
  bench('nearestVisible blade, range 12 (typical)', i => AS.nearestVisible(sim, pick(empties, i), 12, isBlade));
  bench('nearestVisible absent, range 12 (full circle)', i => AS.nearestVisible(sim, pick(empties, i), 12, never));
  bench('nearestVisible match=all-empties, range 12', i => AS.nearestVisible(sim, pick(empties, i), 12, t => W.kind[t] === 0));
  bench('nearestVisible rare blade (many LOS calls), range 12', i => AS.nearestVisible(sim, pick(empties, i), 12, t => W.kind[t] === 1 && t % 61 === 0));
  bench('pathNext blade-adjacent goal, range 8', i => AS.pathNext(sim, pick(empties, i), t => W.kind[t] === 0 && t % 13 === 0, 8));
  bench('pathNext unreachable (full BFS), range 8', i => AS.pathNext(sim, pick(empties, i), never, 8));
  bench('pathNextWeighted 60% grass, range 12, far goal', i => dense.AS.pathNextWeighted(dense.sim, pick(dEmpt, i), t => t % 97 === 0 && dense.W.kind[t] === 0, 12, dcost));
  bench('pathNextWeighted 60% grass, range 12, unreachable', i => dense.AS.pathNextWeighted(dense.sim, pick(dEmpt, i), never, 12, dcost));
  void blades;
  global.gc && global.gc();
  const m0 = process.memoryUsage().heapUsed;
  for (let i = 0; i < 100000; i++) {
    const f = pick(empties, i);
    AS.nearestVisible(sim, f, 12, isBlade);
    AS.pathNext(sim, f, never, 8);
    dense.AS.pathNextWeighted(dense.sim, pick(dEmpt, i), never, 12, dcost);
  }
  global.gc && global.gc();
  const grow = (process.memoryUsage().heapUsed - m0) / 1e6;
  console.log(`heap growth over 100k nearestVisible+pathNext: ${grow.toFixed(2)} MB`);
  ok(grow < 5, 'no allocation growth');
}

console.log(fails ? `FAILED (${fails})` : 'ALL OK');
process.exit(fails ? 1 : 0);
