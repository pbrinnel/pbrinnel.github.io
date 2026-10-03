// Event marks: brief soft rings where bites, births, deaths and grazing happen, so they
// show at speed. They run on REAL time and are rationed per real second, so 20× speed can't
// make more of them or flicker: each mark eases in and out (sin), is an outline never a
// fill, and never covers more than a tile or so. Nothing here touches the sim.
(function (AS) {
  'use strict';

  const MARKS_ENABLED = true;
  // Most marks alive at once, whatever the budget and fade say.
  const MAX_MARKS = 64;
  // Events this many tiles outside the view still get marks, so a ring at the edge isn't cut.
  const VIEW_MARGIN = 1;
  // No span of this many real ms may see more than MarksPerSecond marks start (a sliding
  // window, so the cap holds across any second, not just aligned ones).
  const WINDOW_MS = 1000;
  // GRAZE may only start while fewer than this share of the budget started in the last
  // window, so bites, births and deaths always have room.
  const GRAZE_BUDGET_SHARE = 0.5;

  // Peak alpha at mid-fade, and ring radius as a share of the tile (at the start → at the end).
  const PEAK_ALPHA = 0.7, GRAZE_PEAK_ALPHA = 0.45;
  const RING_START = 0.55, RING_END = 0.85;
  const GRAZE_RING_START = 0.3, GRAZE_RING_END = 0.45;
  // Each ring is drawn twice: a wider stroke in the background color, then the colored one,
  // so it reads over black ground and over bright grass alike.
  const LINE_CSS_PX = 1.75, HALO_CSS_PX = 3.5;
  const HALO_COLOR = '#0a0c0a';
  // A ring never gets smaller than this radius, so a mark is visible in cell mode.
  const MIN_RADIUS_PX = 3;   // device px

  const COLOR = [];
  COLOR[AS.EV.BITE] = '#c46a62';    // muted red
  COLOR[AS.EV.BIRTH] = '#e6dfb8';   // pale cream
  COLOR[AS.EV.DEATH] = '#b8b6aa';   // bone gray
  COLOR[AS.EV.GRAZE] = '#e8efd8';   // pale cream-green, light enough to read on grass

  AS.Marks = function (T) {
    if (!MARKS_ENABLED) return { consume() {}, draw() {} };
    const rate = T.world.MarksPerSecond;
    const fadeMs = T.world.MarkFade * 1000;
    const tile = new Int32Array(MAX_MARKS);
    const type = new Uint8Array(MAX_MARKS);
    const born = new Float64Array(MAX_MARKS).fill(-1);   // real ms; -1 = free
    let head = 0;
    let cursorSim = null, cursor = 0;
    // Start times of the last `budget` marks, as a ring; `oldest` is the next to overwrite,
    // which is also the oldest entry. -Infinity = never started.
    const budget = Math.max(1, Math.floor(rate));
    const starts = new Float64Array(budget).fill(-Infinity);
    let oldest = 0;

    function slotFor(nowMs, mayOverwrite) {
      for (let k = 0; k < MAX_MARKS; k++) {
        const i = (head + k) % MAX_MARKS;
        if (born[i] < 0 || nowMs - born[i] >= fadeMs) { head = (i + 1) % MAX_MARKS; return i; }
      }
      if (!mayOverwrite) return -1;
      const i = head;
      head = (head + 1) % MAX_MARKS;
      return i;
    }

    // How many marks started within the last window.
    function recent(nowMs) {
      let n = 0;
      for (let k = 0; k < budget; k++) if (nowMs - starts[k] < WINDOW_MS) n++;
      return n;
    }

    // cam (optional): events outside its visible tiles (plus VIEW_MARGIN) are skipped
    // without spending budget, since the cap is about what is on screen.
    function consume(sim, nowMs, cam) {
      const ev = sim.events;
      if (cursorSim !== sim || ev.written < cursor) {
        // A different sim (benchmark, reload): marks from the old one don't belong here.
        cursorSim = sim;
        cursor = ev.written;
        born.fill(-1);   // the budget ring stays: it is about real time, not about the sim
        return;
      }
      if (ev.written - cursor > ev.size) cursor = ev.written - ev.size;
      const v = cam ? cam.visible() : null, ww = sim.W ? sim.W.w : 1;
      for (; cursor < ev.written; cursor++) {
        const i = cursor % ev.size, ty = ev.type[i];
        if (v) {
          const x = ev.tile[i] % ww, y = (ev.tile[i] / ww) | 0;
          if (x < v.x0 - VIEW_MARGIN || x > v.x1 + VIEW_MARGIN ||
              y < v.y0 - VIEW_MARGIN || y > v.y1 + VIEW_MARGIN) continue;
        }
        const graze = ty === AS.EV.GRAZE;
        if (nowMs - starts[oldest] < WINDOW_MS) continue;   // a full budget in the last window
        if (graze && recent(nowMs) >= budget * GRAZE_BUDGET_SHARE) continue;
        const slot = slotFor(nowMs, !graze);
        if (slot < 0) continue;
        starts[oldest] = nowMs;
        oldest = (oldest + 1) % budget;
        tile[slot] = ev.tile[i];
        type[slot] = ty;
        born[slot] = nowMs;
      }
    }

    function draw(ctx, sim, cam, dpr, nowMs) {
      const W = sim.W, s = cam.scale * dpr;
      const ox = cam.x * s, oy = cam.y * s;
      const cw = ctx.canvas.width, ch = ctx.canvas.height;
      const line = LINE_CSS_PX * dpr, halo = HALO_CSS_PX * dpr;
      for (let i = 0; i < MAX_MARKS; i++) {
        if (born[i] < 0) continue;
        const t = (nowMs - born[i]) / fadeMs;
        if (t >= 1) { born[i] = -1; continue; }
        if (t < 0) continue;
        const graze = type[i] === AS.EV.GRAZE;
        const r0 = graze ? GRAZE_RING_START : RING_START, r1 = graze ? GRAZE_RING_END : RING_END;
        const radius = Math.max(MIN_RADIUS_PX * dpr, (r0 + (r1 - r0) * t) * s);
        const cx = ((tile[i] % W.w) + 0.5) * s - ox, cy = (((tile[i] / W.w) | 0) + 0.5) * s - oy;
        if (cx < -radius || cy < -radius || cx > cw + radius || cy > ch + radius) continue;
        ctx.globalAlpha = Math.sin(Math.PI * t) * (graze ? GRAZE_PEAK_ALPHA : PEAK_ALPHA);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        ctx.lineWidth = halo;
        ctx.strokeStyle = HALO_COLOR;
        ctx.stroke();
        ctx.lineWidth = line;
        ctx.strokeStyle = COLOR[type[i]];
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    return { consume, draw };
  };
})(globalThis.AS);
