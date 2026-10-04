// The population graph: grass, bunnies and wolves over the whole run on one logarithmic
// chart, in a floating window the Info tab's Graph button shows and hides. Drag it by its
// title bar (mouse or touch); it stays inside the viewport and its place is remembered.
//
// AS.Graph(T) → { open, toggle(), draw(sim, nowMs) }
//   open    whether the window is showing
//   toggle  shows or hides the window (the Graph button calls it through main.js)
//   draw    called every frame by main.js; redraws only while open, throttled unless the user
//           is interacting, from sim.history (see sim.js)
//
// The numbers that don't touch the DOM are in AS.graphMath, so a Node script can test them.
(function (AS) {
  'use strict';

  const HOURS_PER_DAY = 24;       // history has one sample per in-world hour
  // Zooming in stops when this few hours fill the plot; below it the samples are the data.
  const MIN_SPAN_H = 12;
  const EPS_H = 1e-6;             // "at the live end" tolerance, in hours
  const ZOOM_PER_WHEEL_NOTCH = 1.0015;   // factor = this ^ deltaY
  const REDRAW_MS = 200;          // idle redraw rate while the run grows
  const TARGET_TICKS = 6;         // about this many x ticks across the plot

  // Colors validated against #0a0c0a for color-blind safety; text never uses them.
  // Series icons in the legend, live labels and readout, CSS px, and the gap after one.
  const ICON_PX = 12, ICON_GAP = 4;
  const COLORS = { grass: '#199e70', bunnies: '#d95926', wolves: '#3987e5' };
  const TEXT = '#d8d4c8', DIM = '#8a8d80', GRID = '#1f241d', AXIS = '#3a4036';
  const LINE_W = 2;
  const FONT_PX = 11;
  // top holds legend and readout; right holds the live labels (tick, icon, up to "999,999")
  const MARGIN = { left: 40, right: 90, top: 40, bottom: 22 };
  const POS_KEY = 'life-graph-pos';   // the window's remembered { x, y }, CSS px from the viewport's top-left
  const LABEL_GAP = 12;           // direct labels are kept at least this far apart, in px
  const SERIES = [
    { key: 'grass', name: 'grass' },
    { key: 'bunnies', name: 'bunnies' },
    { key: 'wolves', name: 'wolves' },
  ];

  // ---- pure math ----
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  // log10(1 + count): zero sits on the baseline, so extinction is a line on the floor.
  const yOf = c => Math.log10(1 + c);
  // The top decade: 10^D is the smallest power of ten above every count.
  const topDecade = max => Math.max(1, Math.ceil(yOf(max)));
  function fmtCount(c) {
    if (c >= 1e6) return c / 1e6 + 'M';
    if (c >= 1e3) return c / 1e3 + 'k';
    return String(c);
  }
  // Tick counts for the y axis: 0, 1, 10, 100 ... up to the top decade.
  function yTicks(max) {
    const out = [0];
    for (let k = 0, D = topDecade(max); k <= D; k++) out.push(Math.pow(10, k));
    return out;
  }
  // A 1, 2 or 5 times a power of ten near span / TARGET_TICKS.
  function niceStep(span) {
    const raw = Math.max(span / TARGET_TICKS, 1e-9);
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / p;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
  }
  // Round day counts inside [d0, d1].
  function dayTicks(d0, d1) {
    const step = niceStep(d1 - d0), out = [];
    // Counted in whole steps, so no float drift (and no -0) creeps into the labels.
    for (let k = Math.max(0, Math.ceil(d0 / step - EPS_H)); k * step <= d1 + EPS_H; k++) out.push(k * step);
    return out;
  }
  // Per pixel column, the min and max of arr over the samples in [h0 + c*step, h0 + (c+1)*step),
  // where step = (h1 - h0) / width. A column with no sample keeps min = Infinity, max = -Infinity.
  function envelope(arr, n, h0, h1, width) {
    const step = (h1 - h0) / width;
    const min = new Float64Array(width).fill(Infinity), max = new Float64Array(width).fill(-Infinity);
    for (let c = 0; c < width; c++) {
      const lo = Math.max(0, Math.ceil(h0 + c * step)), hi = Math.min(n - 1, Math.ceil(h0 + (c + 1) * step) - 1);
      for (let i = lo; i <= hi; i++) {
        if (arr[i] < min[c]) min[c] = arr[i];
        if (arr[i] > max[c]) max[c] = arr[i];
      }
    }
    return { min, max };
  }

  // A view is { h0, h1, fit, follow } in hours. fit: showing the whole run, so it grows with
  // it. follow: the right edge is at the live end and stays there as the run grows.
  const liveEnd = n => Math.max(n - 1, 1);
  const fitView = n => ({ h0: 0, h1: liveEnd(n), fit: true, follow: true });
  function clampView(v, n) {
    const live = liveEnd(n);
    const span = clamp(v.h1 - v.h0, Math.min(MIN_SPAN_H, live), live);
    const h0 = clamp(v.h0, 0, live - span);
    return { h0, h1: h0 + span, fit: v.fit, follow: v.follow };
  }
  // After the user moves the view: clamp it and work out whether it now follows live.
  function settle(v, n) {
    const c = clampView(v, n), live = liveEnd(n);
    c.follow = c.h1 >= live - EPS_H;
    c.fit = c.follow && c.h0 <= EPS_H;
    return c;
  }
  // The run has grown (or not): keep a fit or following view glued to the live end.
  function advance(v, n) {
    if (v.fit) return fitView(n);
    const live = liveEnd(n);
    if (v.follow) { const span = v.h1 - v.h0; return clampView({ h0: live - span, h1: live, fit: false, follow: true }, n); }
    return clampView(v, n);
  }
  function zoomAt(v, n, anchor, factor) {
    const span = v.h1 - v.h0, frac = (anchor - v.h0) / span, ns = span * factor;
    const h0 = anchor - frac * ns;
    return settle({ h0, h1: h0 + ns }, n);
  }
  const panBy = (v, n, dh) => settle({ h0: v.h0 + dh, h1: v.h1 + dh }, n);

  // Keeps a window of w × h inside a viewport of vw × vh; one wider or taller than the
  // viewport sits at 0 so its title bar is still reachable.
  function clampWindow(x, y, w, h, vw, vh) {
    return { x: clamp(x, 0, Math.max(0, vw - w)), y: clamp(y, 0, Math.max(0, vh - h)) };
  }

  AS.graphMath = { clampWindow, yOf, topDecade, yTicks, fmtCount, niceStep, dayTicks, envelope, fitView, clampView, settle, advance, zoomAt, panBy, liveEnd, MIN_SPAN_H };

  // ---- the panel ----
  const fmtInt = n => Math.round(n).toLocaleString('en-US');
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  AS.Graph = function (T) {
    const panel = document.getElementById('graph');
    const strip = document.querySelector('#hud .hud-top');
    const g = { open: false, toggle, draw };

    const head = el('div', 'graph-head');
    const title = el('span', 'graph-title', 'Population');
    const wholeBtn = el('button', 'hud-btn graph-whole', 'Whole run');
    wholeBtn.type = 'button';
    wholeBtn.title = 'Fit the whole run';
    const closeBtn = el('button', 'hud-btn graph-close', '×');
    closeBtn.type = 'button';
    closeBtn.title = 'Close';
    head.append(title, wholeBtn, closeBtn);
    head.title = 'Drag to move';
    const canvas = el('canvas', 'graph-canvas');
    panel.append(head, canvas);
    const ctx = canvas.getContext('2d');
    // Gestures on the panel are the panel's; the map under it never sees them.
    for (const t of ['pointerdown', 'pointerup', 'wheel']) panel.addEventListener(t, e => e.stopPropagation());

    let simSeen = null, view = null;
    let dirty = true, lastDraw = -Infinity;
    let hoverX = null;                   // CSS px within the canvas, or null
    let stripH = -1;
    const pointers = new Map();          // id → { x, y, touch }
    let pinch = null;                    // previous { dist, midX } while two fingers are down

    function placeUnderStrip() {
      if (!strip) return;
      const h = strip.offsetHeight;
      if (h !== stripH) { stripH = h; panel.style.setProperty('--hud-bottom', h + 'px'); }
    }
    if (strip && typeof ResizeObserver === 'function') new ResizeObserver(placeUnderStrip).observe(strip);

    // ---- the window's place ----
    // Until it has been dragged (or one was remembered) the window sits under the bar, which
    // CSS does from --hud-bottom; after that it is placed by left/top and clamped.
    let pos = null;
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY));
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) pos = { x: saved.x, y: saved.y };
    } catch (e) { /* nothing remembered */ }
    const viewW = () => globalThis.innerWidth || 0, viewH = () => globalThis.innerHeight || 0;
    function applyPos() {
      if (!pos) { panel.style.left = ''; panel.style.top = ''; return; }
      const w = panel.offsetWidth, h = panel.offsetHeight;
      // Not measurable yet (hidden, or no layout): leave it as set rather than guess.
      if (w > 0 && viewW() > 0) pos = clampWindow(pos.x, pos.y, w, h, viewW(), viewH());
      panel.style.left = pos.x + 'px';
      panel.style.top = pos.y + 'px';
    }
    function savePos() { try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch (e) { /* not kept */ } }
    g.position = () => (pos ? { x: pos.x, y: pos.y } : null);
    globalThis.addEventListener && globalThis.addEventListener('resize', () => { if (g.open) applyPos(); });
    globalThis.addEventListener && globalThis.addEventListener('orientationchange', () => { if (g.open) applyPos(); });

    // Showing the window again after Hide UI (display none → shown) changes its box: re-clamp
    // there, in case the viewport changed while it was away.
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => { if (g.open) applyPos(); }).observe(panel);

    // Mouse or touch on the title bar (not its buttons) drags the window.
    let drag = null;   // { id, dx, dy }: pointer id and its offset inside the window
    head.addEventListener('pointerdown', e => {
      if (e.target !== head && e.target !== title) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const r = panel.getBoundingClientRect();
      drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
      if (head.setPointerCapture) { try { head.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ } }
      e.preventDefault();
    });
    head.addEventListener('pointermove', e => {
      if (!drag || drag.id !== e.pointerId) return;
      pos = { x: e.clientX - drag.dx, y: e.clientY - drag.dy };
      applyPos();
    });
    const endDrag = e => {
      if (!drag || drag.id !== e.pointerId) return;
      drag = null;
      if (pos) savePos();
    };
    head.addEventListener('pointerup', endDrag);
    head.addEventListener('pointercancel', endDrag);

    function toggle() {
      g.open = !g.open;
      panel.hidden = !g.open;
      if (g.open) { placeUnderStrip(); applyPos(); dirty = true; }
    }
    closeBtn.addEventListener('click', toggle);
    wholeBtn.addEventListener('click', () => {
      if (!simSeen) return;
      view = fitView(simSeen.history.length);
      dirty = true;
    });

    // Plot rectangle in CSS px.
    function plotRect() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      return { x0: MARGIN.left, x1: Math.max(MARGIN.left + 1, w - MARGIN.right), y0: MARGIN.top, y1: Math.max(MARGIN.top + 1, h - MARGIN.bottom), w, h };
    }
    const hourAt = (px, r) => view.h0 + (px - r.x0) / (r.x1 - r.x0) * (view.h1 - view.h0);

    // ---- input ----
    function localX(e) { return e.clientX - canvas.getBoundingClientRect().left; }
    canvas.addEventListener('wheel', e => {
      if (!simSeen) return;
      e.preventDefault();
      const r = plotRect(), n = simSeen.history.length;
      view = zoomAt(view, n, hourAt(clamp(localX(e), r.x0, r.x1), r), Math.pow(ZOOM_PER_WHEEL_NOTCH, e.deltaY));
      dirty = true;
    }, { passive: false });
    canvas.addEventListener('pointerdown', e => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' });
      if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ } }
      if (pointers.size === 2) pinch = null;
      if (e.pointerType === 'touch' && pointers.size === 1) hoverX = localX(e);
      dirty = true;
    });
    canvas.addEventListener('pointermove', e => {
      if (!simSeen) return;
      const p = pointers.get(e.pointerId), r = plotRect(), n = simSeen.history.length;
      if (!p) { hoverX = localX(e); dirty = true; return; }       // mouse hover
      if (pointers.size === 2) {
        p.x = e.clientX; p.y = e.clientY;
        const [a, b] = [...pointers.values()];
        const dist = Math.max(1, Math.abs(a.x - b.x)), midX = (a.x + b.x) / 2 - canvas.getBoundingClientRect().left;
        if (pinch) {
          view = zoomAt(view, n, hourAt(pinch.midX, r), pinch.dist / dist);
          view = panBy(view, n, -(midX - pinch.midX) / (r.x1 - r.x0) * (view.h1 - view.h0));
        }
        pinch = { dist, midX };
        hoverX = null;
      } else if (p.touch) {
        hoverX = localX(e);                                       // one finger reads the chart
      } else {
        view = panBy(view, n, -(e.clientX - p.x) / (r.x1 - r.x0) * (view.h1 - view.h0));   // mouse drags
        hoverX = localX(e);
      }
      p.x = e.clientX; p.y = e.clientY;
      dirty = true;
    });
    const release = e => {
      const p = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      pinch = null;
      if (p && p.touch) hoverX = null;
      dirty = true;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('pointerleave', e => { if (!pointers.has(e.pointerId)) { hoverX = null; dirty = true; } });

    // ---- drawing ----
    function sizeCanvas(dpr) {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      }
    }

    function draw(sim, now) {
      if (!g.open) return;
      if (sim !== simSeen) { simSeen = sim; view = fitView(sim.history.length); dirty = true; }
      // Input marks the view dirty, so it redraws every frame while the user is on it.
      if (!dirty && now - lastDraw < REDRAW_MS) return;
      dirty = false; lastDraw = now;
      const hist = sim.history, n = hist.length;
      view = advance(view, n);
      const dpr = globalThis.devicePixelRatio || 1;
      sizeCanvas(dpr);
      const r = plotRect();
      if (r.w < 2 || r.h < 2) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, r.w, r.h);
      ctx.font = `${FONT_PX}px ${AS.FONT}`;
      ctx.textBaseline = 'middle';

      // The scale is the whole run's top decade, so panning doesn't rescale the lines.
      let max = 0;
      for (const s of SERIES) { const a = hist[s.key]; for (let i = 0; i < n; i++) if (a[i] > max) max = a[i]; }
      const yTop = yOf(Math.pow(10, topDecade(max)));
      const Y = c => r.y1 - yOf(c) / yTop * (r.y1 - r.y0);
      const span = view.h1 - view.h0;
      const X = h => r.x0 + (h - view.h0) / span * (r.x1 - r.x0);

      // Gridlines at the decades and y labels.
      ctx.lineWidth = 1;
      ctx.textAlign = 'right';
      for (const c of yTicks(max)) {
        const y = Math.round(Y(c)) + 0.5;
        ctx.strokeStyle = c === 0 ? AXIS : GRID;
        ctx.beginPath(); ctx.moveTo(r.x0, y); ctx.lineTo(r.x1, y); ctx.stroke();
        ctx.fillStyle = DIM; ctx.fillText(fmtCount(c), r.x0 - 6, y);
      }
      // X axis in days.
      ctx.textAlign = 'center';
      // Zoomed in past a day per tick the labels need decimals.
      const dayStep = niceStep((view.h1 - view.h0) / HOURS_PER_DAY);
      const decimals = dayStep < 1 ? Math.ceil(-Math.log10(dayStep) - 1e-9) : 0;
      for (const d of dayTicks(view.h0 / HOURS_PER_DAY, view.h1 / HOURS_PER_DAY)) {
        const x = Math.round(X(d * HOURS_PER_DAY)) + 0.5;
        ctx.strokeStyle = GRID;
        ctx.beginPath(); ctx.moveTo(x, r.y0); ctx.lineTo(x, r.y1); ctx.stroke();
        ctx.fillStyle = DIM; ctx.fillText(decimals ? d.toFixed(decimals) : fmtInt(d), x, r.y1 + 12);
      }
      ctx.textAlign = 'right'; ctx.fillStyle = DIM;
      ctx.fillText('day', r.w - 4, r.y1 + 12);

      // Lines.
      ctx.save();
      ctx.beginPath(); ctx.rect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0 + 2); ctx.clip();
      ctx.lineWidth = LINE_W; ctx.lineJoin = 'round';
      const width = Math.max(1, Math.round(r.x1 - r.x0));
      const perCol = span / width;
      for (const s of SERIES) {
        const a = hist[s.key];
        ctx.strokeStyle = COLORS[s.key];
        ctx.beginPath();
        if (perCol > 1) {
          // Many samples per pixel: one min-to-max stroke per column.
          const env = envelope(a, n, view.h0, view.h1, width);
          let last = null, started = false;
          for (let c = 0; c < width; c++) {
            if (env.min[c] === Infinity) continue;
            const x = r.x0 + (c + 0.5) * (r.x1 - r.x0) / width;
            const yLo = Y(env.min[c]), yHi = Y(env.max[c]);
            // Enter at the end nearer the previous point so the stroke stays one line.
            const first = last !== null && Math.abs(yLo - last) > Math.abs(yHi - last) ? yHi : yLo;
            const second = first === yLo ? yHi : yLo;
            if (!started) { ctx.moveTo(x, first); started = true; } else ctx.lineTo(x, first);
            ctx.lineTo(x, second);
            last = second;
          }
        } else {
          for (let i = Math.max(0, Math.floor(view.h0) - 1), end = Math.min(n - 1, Math.ceil(view.h1) + 1); i <= end; i++) {
            if (i === Math.max(0, Math.floor(view.h0) - 1)) ctx.moveTo(X(i), Y(a[i])); else ctx.lineTo(X(i), Y(a[i]));
          }
        }
        ctx.stroke();
      }
      ctx.restore();

      // Direct labels at the live end.
      if (n > 0 && view.h1 >= liveEnd(n) - EPS_H) {
        const ends = SERIES.map(s => ({ s, y: Y(hist[s.key][n - 1]), v: hist[s.key][n - 1] })).sort((p, q) => p.y - q.y);
        for (let i = 1; i < ends.length; i++) ends[i].ly = Math.max(ends[i].y, (ends[i - 1].ly ?? ends[i - 1].y) + LABEL_GAP);
        ends[0].ly = ends[0].y;
        ctx.textAlign = 'left';
        for (const e of ends) {
          ctx.strokeStyle = COLORS[e.s.key]; ctx.lineWidth = LINE_W;
          ctx.beginPath(); ctx.moveTo(r.x1 + 3, e.ly); ctx.lineTo(r.x1 + 10, e.ly); ctx.stroke();
          const ix = r.x1 + 13 + icon(e.s.key, r.x1 + 13, e.ly);
          ctx.fillStyle = TEXT; ctx.fillText(fmtInt(e.v), ix, e.ly);
        }
      }

      // Legend, always shown.
      ctx.textAlign = 'left';
      let lx = MARGIN.left;
      for (const s of SERIES) {
        ctx.strokeStyle = COLORS[s.key]; ctx.lineWidth = LINE_W;
        ctx.beginPath(); ctx.moveTo(lx, 10); ctx.lineTo(lx + 14, 10); ctx.stroke();
        const ix = lx + 19 + icon(s.key, lx + 19, 10);
        ctx.fillStyle = TEXT; ctx.fillText(s.name, ix, 10);
        lx = ix + ctx.measureText(s.name).width + 16;
      }

      // Crosshair and readout of the hour under the pointer.
      if (hoverX !== null && n > 0 && hoverX >= r.x0 && hoverX <= r.x1) {
        const i = clamp(Math.round(hourAt(hoverX, r)), 0, n - 1), x = Math.round(X(i)) + 0.5;
        ctx.strokeStyle = DIM; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, r.y0); ctx.lineTo(x, r.y1); ctx.stroke();
        let rx = MARGIN.left;
        ctx.fillStyle = TEXT; ctx.textAlign = 'left';
        const day = `day ${(i / HOURS_PER_DAY).toFixed(1)}`;
        ctx.fillText(day, rx, 28); rx += ctx.measureText(day).width + 14;
        for (const s of SERIES) {
          const v = hist[s.key][i];
          ctx.fillStyle = COLORS[s.key]; ctx.beginPath(); ctx.arc(x, Y(v), 3, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = COLORS[s.key]; ctx.lineWidth = LINE_W;
          ctx.beginPath(); ctx.moveTo(rx, 28); ctx.lineTo(rx + 8, 28); ctx.stroke();
          const t = fmtInt(v), ix = rx + 12 + icon(s.key, rx + 12, 28);
          ctx.fillStyle = TEXT; ctx.fillText(t, ix, 28); rx = ix + ctx.measureText(t).width + 12;
        }
      }
    }

    // Each series is labeled with the sprite the world draws for it (main.js supplies
    // them once the sprite sheet exists). Draws it centered on y; returns the width used.
    let icons = null;
    function icon(key, x, y) {
      const cv = icons && icons[key];
      if (!cv) return 0;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(cv, x, Math.round(y - ICON_PX / 2), ICON_PX, ICON_PX);
      return ICON_PX + ICON_GAP;
    }
    // icons: { grass, bunnies, wolves } → canvases (any size; drawn at ICON_PX).
    g.setIcons = m => { icons = m; };

    return g;
  };
})(globalThis.AS);
