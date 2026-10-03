// What an animal can see and where it can walk to: line of sight, the nearest visible thing,
// and local pathfinding. Only grass blocks sight and movement; animals and corpses block
// movement (one thing per tile) but not sight.
//
// Sight is the most expensive thing an animal does, so everything here is allocation-free
// per call: the circle's offsets are built once per range, and the search buffers live in
// a per-world record (see scratch()). All of it is deterministic; no randomness.
(function (AS) {
  'use strict';

  const K = AS.KIND;
  const GRASS = K.GRASS, EMPTY = K.EMPTY;

  // ---- Line of sight ----

  // Bresenham between tile centers; any grass strictly between a and b blocks. The line is
  // always traced from the lower index, because Bresenham run backward can pick different
  // tiles, and sight must be the same both ways.
  AS.lineOfSight = function (W, a, b) {
    if (a === b) return true;
    if (a > b) { const s = a; a = b; b = s; }
    const w = W.w, kind = W.kind;
    let x = a % w, y = (a / w) | 0;
    const x1 = b % w, y1 = (b / w) | 0;
    const dx = x1 - x, dy = y1 - y;
    const adx = dx < 0 ? -dx : dx, ady = dy; // a < b, so y1 >= y
    if (adx <= 1 && ady <= 1) return true;   // adjacent, or diagonal: nothing between
    const sx = dx < 0 ? -1 : 1;
    let err = adx - ady;
    for (;;) {
      const e2 = err * 2;
      if (e2 > -ady) { err -= ady; x += sx; }
      if (e2 < adx) { err += adx; y++; }
      if (x === x1 && y === y1) return true;
      if (kind[y * w + x] === GRASS) return false;
    }
  };

  // ---- Circles of offsets ----

  // For each range: every (dx, dy) other than (0, 0) with dx² + dy² <= range², nearest first.
  // Ties fall in a fixed order (dy, then dx), so "nearest" never depends on the scan.
  const circles = new Map();
  function circle(range) {
    let c = circles.get(range);
    if (c) return c;
    const r = Math.floor(range), r2 = range * range, list = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 <= r2) list.push([d2, dy, dx]);
      }
    }
    list.sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]);
    const n = list.length;
    c = { n, r, r2, dx: new Int32Array(n), dy: new Int32Array(n) };
    for (let i = 0; i < n; i++) { c.dy[i] = list[i][1]; c.dx[i] = list[i][2]; }
    circles.set(range, c);
    return c;
  }

  // ---- Nearest visible ----

  // The nearest tile within range (a circle) for which match(t) is true and which `from` can
  // see, or -1. match runs before the line of sight because it is the cheaper test.
  AS.nearestVisible = function (sim, from, range, match) {
    const W = sim.W, w = W.w, h = W.h, c = circle(range);
    const fx = from % w, fy = (from / w) | 0;
    const cdx = c.dx, cdy = c.dy, n = c.n;
    // Away from the edges the bounds test can be skipped entirely.
    const interior = fx >= c.r && fy >= c.r && fx < w - c.r && fy < h - c.r;
    for (let i = 0; i < n; i++) {
      const x = fx + cdx[i], y = fy + cdy[i];
      if (!interior && (x < 0 || y < 0 || x >= w || y >= h)) continue;
      const t = y * w + x;
      if (match(t) && AS.lineOfSight(W, from, t)) return t;
    }
    return -1;
  };

  // ---- Pathfinding ----

  // Per-world search buffers: a visited stamp per tile (a new generation per search, so
  // nothing is cleared), and a queue holding each tile with the first step that reached it.
  const scratchOf = new WeakMap();
  function scratch(W, cap) {
    let s = scratchOf.get(W);
    if (!s) {
      s = { stamp: new Uint32Array(W.n), gen: 0, queue: null, first: null };
      scratchOf.set(W, s);
    }
    if (!s.queue || s.queue.length < cap) {
      s.queue = new Int32Array(cap);
      s.first = new Int32Array(cap);
    }
    return s;
  }

  // The first step of a shortest path from `from` to the nearest tile where goal(t) is true,
  // walking 4-directionally through EMPTY tiles and never leaving the circle of `range`
  // around `from`. Returns `from` if goal(from) already holds, or -1 if no goal is reachable.
  // goal is tested only on tiles the walker could stand on (empty ones, and `from`).
  //
  // Wolves, which chew through grass when that is quicker, use pathNextWeighted below.
  AS.pathNext = function (sim, from, goal, range) {
    if (goal(from)) return from;
    const W = sim.W, w = W.w, h = W.h, kind = W.kind, c = circle(range);
    const s = scratch(W, c.n + 1);
    const stamp = s.stamp, queue = s.queue, first = s.first;
    if (++s.gen === 0xFFFFFFFF) { stamp.fill(0); s.gen = 1; }
    const gen = s.gen, r2 = c.r2;
    const fx = from % w, fy = (from / w) | 0;
    // Rotating the neighbor order spreads equal-length paths over all four directions.
    const rot = (from + gen) & 3;

    stamp[from] = gen;
    queue[0] = from; first[0] = -1;
    let head = 0, tail = 1;
    while (head < tail) {
      const cur = queue[head], cf = first[head];
      head++;
      const cx = cur % w, cy = (cur / w) | 0;
      for (let k = 0; k < 4; k++) {
        let nx = cx, ny = cy;
        switch ((k + rot) & 3) {
          case 0: ny--; break;
          case 1: nx++; break;
          case 2: ny++; break;
          default: nx--;
        }
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nt = ny * w + nx;
        if (stamp[nt] === gen || kind[nt] !== EMPTY) continue;
        const ddx = nx - fx, ddy = ny - fy;
        if (ddx * ddx + ddy * ddy > r2) continue;
        stamp[nt] = gen;
        const step = cf < 0 ? nt : cf;
        if (goal(nt)) return step;
        queue[tail] = nt; first[tail] = step;
        tail++;
      }
    }
    return -1;
  };
  // ---- Weighted pathfinding (wolves) ----

  // Per-world Dijkstra buffers, kept apart from the breadth-first ones above. A tile's
  // distance is valid only when wStamp matches the current generation; wDone marks it settled.
  const weightedOf = new WeakMap();
  function weightedScratch(W, cap) {
    let s = weightedOf.get(W);
    if (!s) {
      s = {
        gen: 0, stamp: new Uint32Array(W.n), done: new Uint32Array(W.n),
        dist: new Float64Array(W.n), firstOf: new Int32Array(W.n),
        hKey: null, hTile: null,
      };
      weightedOf.set(W, s);
    }
    if (!s.hKey || s.hKey.length < cap) { s.hKey = new Float64Array(cap); s.hTile = new Int32Array(cap); }
    return s;
  }

  // Like pathNext, but a tile costs cost(t) seconds to enter (Infinity = can't be entered),
  // and the walk may cross tiles pathNext would refuse, such as grass the caller chews. It
  // returns the first tile of a least-total-cost path (the caller deals with whatever is on
  // it), `from` if goal(from), or -1. The caller owns what a tile costs; nothing here knows
  // about grass. goal is tested on a tile when it is settled, so the first goal is the
  // cheapest one. Costs must be positive. Ties are broken by the rotated neighbor order and
  // the heap's fixed rule, so a run is repeatable.
  AS.pathNextWeighted = function (sim, from, goal, range, cost) {
    if (goal(from)) return from;
    const W = sim.W, w = W.w, h = W.h, c = circle(range);
    // Each settled tile pushes at most four entries (stale ones are skipped on pop).
    const s = weightedScratch(W, 4 * c.n + 4);
    const stamp = s.stamp, done = s.done, dist = s.dist, firstOf = s.firstOf;
    const hKey = s.hKey, hTile = s.hTile;
    if (++s.gen === 0xFFFFFFFF) { stamp.fill(0); done.fill(0); s.gen = 1; }
    const gen = s.gen, r2 = c.r2;
    const fx = from % w, fy = (from / w) | 0;
    const rot = (from + gen) & 3;

    stamp[from] = gen; dist[from] = 0; firstOf[from] = -1;
    hKey[0] = 0; hTile[0] = from;
    let size = 1;
    while (size > 0) {
      // pop the minimum
      const cur = hTile[0], ck = hKey[0];
      size--;
      if (size > 0) {
        const k = hKey[size], t = hTile[size];
        let i = 0;
        for (;;) {
          let l = 2 * i + 1;
          if (l >= size) break;
          if (l + 1 < size && hKey[l + 1] < hKey[l]) l++;
          if (hKey[l] >= k) break;
          hKey[i] = hKey[l]; hTile[i] = hTile[l]; i = l;
        }
        hKey[i] = k; hTile[i] = t;
      }
      if (done[cur] === gen) continue;
      done[cur] = gen;
      if (cur !== from && goal(cur)) return firstOf[cur];
      const cx = cur % w, cy = (cur / w) | 0, cf = firstOf[cur];
      for (let d = 0; d < 4; d++) {
        let nx = cx, ny = cy;
        switch ((d + rot) & 3) {
          case 0: ny--; break;
          case 1: nx++; break;
          case 2: ny++; break;
          default: nx--;
        }
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nt = ny * w + nx;
        if (done[nt] === gen) continue;
        const ddx = nx - fx, ddy = ny - fy;
        if (ddx * ddx + ddy * ddy > r2) continue;
        const cs = cost(nt);
        if (cs === Infinity) continue;
        const nd = ck + cs;
        if (stamp[nt] === gen && dist[nt] <= nd) continue;
        stamp[nt] = gen; dist[nt] = nd; firstOf[nt] = cf < 0 ? nt : cf;
        // push
        let i = size++;
        while (i > 0) {
          const p = (i - 1) >> 1;
          if (hKey[p] <= nd) break;
          hKey[i] = hKey[p]; hTile[i] = hTile[p]; i = p;
        }
        hKey[i] = nd; hTile[i] = nt;
      }
    }
    return -1;
  };
})(globalThis.AS);
