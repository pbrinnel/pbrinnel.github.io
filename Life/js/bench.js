// Benchmark mode: swaps the run for test worlds of growing size, measures how long each tick
// and each frame take at the default zoom and zoomed all the way out, and reports the
// largest worlds that stay smooth (60 fps at 1×) plus how fast the sim could be run. Two
// series run one after the other: grass alone, then a fixed world with growing animal counts.
//
// AS.runBench(app)   called by the HUD's Benchmark button; app is AS.app (see main.js)
// AS.benchMath       the pure parts, so a Node test can check them without a browser
//
// It only measures and reports. The page is reloaded to get the real run back.
(function (AS) {
  'use strict';

  // Blades per step. Each step doubles, so the report shows where the curve bends.
  const BLADE_STEPS = [12000, 24000, 48000, 96000, 192000, 384000, 768000];
  // The animal series runs in one fixed world, so only the animal count changes.
  const ANIMAL_WORLD = Object.freeze({ w: 600, h: 400 });
  const ANIMAL_STEPS = [1000, 2000, 4000, 8000, 16000, 32000, 64000];
  // The table limit on a world side (tables.js MAX_SIDE).
  const MAX_SIDE = 2000;
  // The same seed every run, so one device's results can be compared with another's.
  const BENCH_SEED = 20240611;
  const NO_ANIMALS = Object.freeze({ bunnies: 0, wolves: 0 });

  // Animals split bunnies:wolves like the start counts in the tables, with at least one wolf.
  function animalsFor(T, total) {
    const b = T.world.StartBunnies, w = T.world.StartWolves;
    const wolves = Math.min(total, Math.max(1, Math.round(total * w / (b + w))));
    return { bunnies: total - wolves, wolves };
  }

  // The animal series' world: ANIMAL_WORLD at Paul's StartGrass share, `total` animals.
  function animalWorldFor(T, total) {
    const { w, h } = ANIMAL_WORLD;
    const share = T.world.StartGrass;
    return { w, h, share, animals: animalsFor(T, total), fits: Math.round(w * h * share) + total <= w * h };
  }

  // The first second of a view is not measured: the new world is still being touched for
  // the first time and the glyph cache is filling.
  const WARM_S = 1;
  // The animal series has twice the steps' worth of cost per second, so its views are shorter
  // to keep the whole run to a few minutes.
  const MEASURE_S = 3;
  const MEASURE_S_ANIMALS = 2;
  // Raw tick cost. Browsers coarsen performance.now() (0.1 ms in Chrome without
  // cross-origin isolation), so single ticks can't be timed. Ticks run in batches grown
  // until one batch lasts at least BATCH_MIN_MS, which makes the timer's step a small share
  // of it; the median of TICK_BATCHES batches is taken.
  const BATCH_MIN_MS = 20;
  const TICK_BATCHES = 5;
  const MAX_BATCH_TICKS = 4096;
  // The speed that "keeps up" assumes the display runs at this rate and ticks get
  // AS.TICK_BUDGET_MS of every frame.
  const FRAMES_PER_S = 60;

  // Smooth means 60 fps. Timers jitter a little, so a frame interval counts as on time up
  // to the frame length plus this share.
  const SMOOTH_MS = 1000 / FRAMES_PER_S;
  const JITTER_TOLERANCE = 0.1;
  // Safari rounds performance.now() to whole milliseconds, so a frame's measured work can
  // read this much over what it took.
  const WORK_TOLERANCE_MS = 1;
  const SMOOTH_SHARE = 0.95;
  // One frame longer than this is a visible hitch, however good the rest is.
  const HITCH_MS = 50;

  // After the last step the map is replaced by one this big, so the page isn't drawing a
  // huge world behind the results.
  const PARKED_WORLD = 20;
  const BENCH_SPEED_INDEX = 1;
  // Frames to let go by after a world is built before the label moves on, so the browser
  // gets to paint the new label while the world builds.
  const PAINT_FRAMES = 2;
  const REFRESH_RATES = [24, 30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240];
  const UA_MAX = 110;

  const VIEWS = [
    { key: 'start', label: 'default zoom' },
    { key: 'out', label: 'zoomed out' },
  ];

  const fmtInt = n => Math.round(n).toLocaleString('en-US');
  const worldText = r => `${r.w}×${r.h} @ ${Number((r.share * 100).toFixed(1))}%`;
  const fmtMs = x => (x < 10 ? x.toFixed(2) : x.toFixed(1));

  // ---- pure parts ----

  // A world shaped like Paul's (WorldWidth:WorldHeight) with Paul's StartGrass share, big
  // enough for `blades` blades. When that would pass the side limit, the world is the
  // largest of that shape that fits and the share goes up to reach the count, so a step
  // stays comparable to the others. `animals` tiles are kept free for the step's animals;
  // if the blades still don't fit, `fits` is false and the step is skipped.
  function worldFor(T, blades, maxSide, animals) {
    const max = maxSide || MAX_SIDE;
    const share = T.world.StartGrass;
    const aspect = T.world.WorldWidth / T.world.WorldHeight;
    let w = Math.round(Math.sqrt(blades / share * aspect));
    let h = Math.round(blades / share / w);
    const clamped = w > max || h > max;
    if (clamped) {
      if (aspect >= 1) { w = max; h = Math.max(1, Math.round(max / aspect)); }
      else { h = max; w = Math.max(1, Math.round(max * aspect)); }
    }
    w = Math.max(1, w); h = Math.max(1, h);
    const tiles = w * h;
    return { w, h, share: clamped ? blades / tiles : share, fits: blades + (animals || 0) <= tiles };
  }

  // The tables with another world size, grass share and animal count. T is frozen, so this
  // builds a copy.
  function derive(T, w, h, animals, share) {
    return Object.freeze({
      ...T,
      world: Object.freeze({
        ...T.world, WorldWidth: w, WorldHeight: h,
        StartGrass: share === undefined ? T.world.StartGrass : share,
        StartBunnies: animals.bunnies, StartWolves: animals.wolves,
      }),
    });
  }

  // Nearest-rank percentile of a list of numbers (p in 0..100).
  function percentile(arr, p) {
    if (!arr.length) return 0;
    const s = Float64Array.from(arr).sort();
    return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p / 100 * s.length) - 1))];
  }

  // Smooth, per view, needs both:
  //   the work fits 60 fps: tick + draw time (`works`, one entry per frame) is within
  //     SMOOTH_MS for SMOOTH_SHARE of frames, and no frame's work is a hitch;
  //   frames arrive steadily at the rate the display really runs (`refreshHz`, capped at
  //     FRAMES_PER_S, so a 120 Hz screen isn't asked for 120 fps and a browser that caps
  //     pages at 30 Hz isn't asked for 60): the same share of intervals within one display
  //     frame plus JITTER_TOLERANCE, and none a hitch.
  // Without `works` only the interval rule applies.
  function verdict(intervals, works, refreshHz) {
    if (!intervals.length) return false;
    const rate = Math.min(refreshHz > 0 ? refreshHz : FRAMES_PER_S, FRAMES_PER_S);
    const steady = (list, limit) => {
      let onTime = 0, worst = 0;
      for (const x of list) {
        if (x <= limit) onTime++;
        if (x > worst) worst = x;
      }
      return onTime / list.length >= SMOOTH_SHARE && worst <= HITCH_MS;
    };
    if (!steady(intervals, 1000 / rate * (1 + JITTER_TOLERANCE))) return false;
    return !works || !works.length || steady(works, SMOOTH_MS + WORK_TOLERANCE_MS);
  }

  // The largest step (by `count`: blades or animals, whichever the series steps) where this view passed and every smaller step did too. Steps are in
  // order; a step the run never reached has no entry for the view and ends the walk.
  function largestSmooth(steps, view) {
    let best = 0;
    for (const s of steps) {
      const v = s.views && s.views[view];
      if (!v || !v.smooth) break;
      best = s.count !== undefined ? s.count : s.blades;
    }
    return best;
  }

  // The fastest speed multiple whose ticks fit in the tick budget at FRAMES_PER_S.
  function keepUpSpeed(tickMs, budgetMs, tickHz) {
    const budget = budgetMs === undefined ? AS.TICK_BUDGET_MS : budgetMs;
    const hz = tickHz === undefined ? AS.TICK_HZ : tickHz;
    if (!(tickMs > 0)) return Infinity;
    return (budget / tickMs) * FRAMES_PER_S / hz;
  }
  const speedText = x => (x < 1 ? '< 1×' : x === Infinity ? '> 9,999×' : '≈ ' + fmtInt(x) + '×');

  // Plain-English lines for the top of the report. Each rows list has one entry per step
  // reached, with `count` (the series' own measure) and `blades`.
  function summaryText(grassRows, animalRows, opts) {
    const o = opts || {};
    const lines = [];
    // The unit is spoken once, after the first view's figure.
    const part = (rows, view, unit) => {
      const n = largestSmooth(rows, view);
      const u = unit ? ' ' + unit : '';
      return n ? `up to ${fmtInt(n)}${u}` : `not even at ${fmtInt(rows.length ? rows[0].count : 0)}${u}`;
    };
    // All steps passed in both views: say the top of the range wasn't a limit.
    const topped = (rows, total) => !!total && rows.length === total &&
      ['start', 'out'].every(v => largestSmooth(rows, v) === rows[rows.length - 1].count);
    const line = (name, rows, unit, total, extra) =>
      `${name}: smooth (${FRAMES_PER_S} fps at 1×) ${part(rows, 'start', unit)} at the default zoom and ${part(rows, 'out', '').replace(/^up to /, '')} zoomed out` +
      `${extra || ''}${topped(rows, total) ? ' (the largest step tested)' : ''}.`;
    lines.push(line('Grass alone', grassRows, 'blades', o.grassTotal));
    if (animalRows && animalRows.length) {
      lines.push(line('Animals', animalRows, 'animals', o.animalTotal, ` (with ${fmtInt(animalRows[0].blades)} blades)`));
    }
    if (o.paulBlades) {
      // The step nearest Paul's world, by its nominal size; reported only if the run got there.
      let idx = 0;
      BLADE_STEPS.forEach((b, i) => {
        if (Math.abs(Math.log(b / o.paulBlades)) < Math.abs(Math.log(BLADE_STEPS[idx] / o.paulBlades))) idx = i;
      });
      if (idx < grassRows.length) {
        lines.push(`Fastest speed that keeps up at ${fmtInt(grassRows[idx].blades)} blades (Paul's world): ${speedText(grassRows[idx].speed)}`);
      } else {
        lines.push(`The run stopped before reaching ${fmtInt(BLADE_STEPS[idx])} blades (Paul's world).`);
      }
    }
    if (animalRows && animalRows.length) {
      lines.push(`With ${fmtInt(animalRows[0].count)} animals: keeps up to ${speedText(animalRows[0].speed)}`);
    }
    if (o.refreshHz > 0 && o.refreshHz < FRAMES_PER_S) {
      lines.push(`This browser shows only ${o.refreshHz} frames a second, so the page can't look smoother than that here; the numbers above say whether the work would fit ${FRAMES_PER_S}.`);
    }
    for (const n of o.notes || []) lines.push(n);
    return lines;
  }

  function nearestRefresh(medianMs) {
    if (!(medianMs > 0)) return 0;
    const hz = 1000 / medianMs;
    return REFRESH_RATES.reduce((a, b) => (Math.abs(b - hz) < Math.abs(a - hz) ? b : a));
  }

  // What a series' table is headed with.
  const seriesTitle = sr => sr.key === 'animals'
    ? `Animals (with ${fmtInt(sr.rows.length ? sr.rows[0].blades : 0)} blades)`
    : 'Grass only';
  const seriesUnit = sr => (sr.key === 'animals' ? 'animals' : 'blades');

  // The copyable text version of everything the panel shows. `series` is a list of
  // { key: 'grass' | 'animals', rows }.
  function reportText(series, summary, device) {
    const out = ['Agent Sim Test benchmark', ''];
    out.push(...summary, '');
    for (const sr of series) {
      if (!sr.rows.length) continue;
      const head = [seriesUnit(sr), 'world', 'tick ms', 'keeps up',
        'dz p95', 'dz work95', 'dz worst', 'dz draw95', 'dz', 'zo p95', 'zo work95', 'zo worst', 'zo draw95', 'zo'];
      const body = sr.rows.map(r => [
        fmtInt(r.count), worldText(r), fmtTick(r.tickMs), speedText(r.speed),
        ...VIEWS.flatMap(v => {
          const x = r.views[v.key];
          return x ? [fmtMs(x.p95), fmtMs(x.workP95), fmtMs(x.worst), fmtMs(x.drawP95), x.smooth ? 'ok' : 'slow'] : ['-', '-', '-', '-', '-'];
        }),
      ]);
      const widths = head.map((h, i) => Math.max(h.length, ...body.map(b => b[i].length)));
      const line = cells => cells.map((c, i) => c.padStart(widths[i])).join('  ');
      out.push(seriesTitle(sr), line(head), ...body.map(line), '');
    }
    out.push('dz = default zoom, zo = zoomed out; times in ms per frame (work = tick + draw CPU time).', '', ...device);
    return out.join('\n');
  }

  // Milliseconds per call of tick(), timed with `now` (a clock in ms, which may be coarse).
  function timeTicks(tick, now) {
    let n = 1;
    const batch = () => {
      const t0 = now();
      for (let i = 0; i < n; i++) tick();
      return now() - t0;
    };
    // Grow the batch until it is long enough to time; the growth runs are warm-up too.
    while (n < MAX_BATCH_TICKS && batch() < BATCH_MIN_MS) n *= 2;
    const per = [];
    for (let i = 0; i < TICK_BATCHES; i++) per.push(batch() / n);
    return percentile(per, 50);
  }

  // Three significant figures with trailing zeros kept, so 1 ms reads 1.00.
  const fmtTick = x => (x >= 100 ? x.toFixed(0) : x.toPrecision(3));

  AS.benchMath = {
    BLADE_STEPS, ANIMAL_STEPS, SMOOTH_MS, JITTER_TOLERANCE, HITCH_MS,
    worldFor, derive, percentile, verdict, largestSmooth, keepUpSpeed, speedText, summaryText,
    nearestRefresh, reportText, timeTicks, fmtTick, animalsFor, animalWorldFor,
  };

  // ---- the run ----

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
  async function paintFrames() { for (let i = 0; i < PAINT_FRAMES; i++) await nextFrame(); }

  // Collects frame timings from app.onFrame for one view: the warm-up is dropped, the rest
  // kept. A hidden tab makes the browser throttle frames, which makes the numbers worthless,
  // so any hiding throws the samples away and the view starts over once the tab is back.
  function measureView(app, ui, measureS) {
    return new Promise(resolve => {
      const attempt = () => {
        const s = { interval: [], tick: [], draw: [] };
        let startAt = null;
        let done = false;
        const stop = () => {
          done = true;
          app.onFrame = null;
          document.removeEventListener('visibilitychange', onVis);
        };
        const abandon = () => {
          if (done) return;
          stop();
          ui.paused(true);
          const back = () => {
            if (document.hidden) return;
            document.removeEventListener('visibilitychange', back);
            ui.paused(false);
            attempt();
          };
          document.addEventListener('visibilitychange', back);
        };
        const onVis = () => { if (document.hidden) abandon(); };
        document.addEventListener('visibilitychange', onVis);
        if (document.hidden) { abandon(); return; }
        app.onFrame = (interval, tickMs, drawMs) => {
          if (document.hidden) { abandon(); return; }
          const now = performance.now();
          if (startAt === null) startAt = now;
          const t = (now - startAt) / 1000;
          if (t >= WARM_S) { s.interval.push(interval); s.tick.push(tickMs); s.draw.push(drawMs); }
          if (t >= WARM_S + measureS) { stop(); resolve(s); }
        };
      };
      attempt();
    });
  }

  function viewResult(s, refreshHz) {
    const works = s.tick.map((t, i) => t + s.draw[i]);
    return {
      n: s.interval.length,
      p95: percentile(s.interval, 95),
      workP95: percentile(works, 95),
      worst: s.interval.reduce((a, b) => Math.max(a, b), 0),
      drawP95: percentile(s.draw, 95),
      smooth: verdict(s.interval, works, refreshHz),
    };
  }

  function deviceLines(refreshHz) {
    const ua = String(navigator.userAgent || '');
    return [
      `Viewport ${innerWidth}×${innerHeight} CSS px, devicePixelRatio ${devicePixelRatio}`,
      `Display refresh ${refreshHz ? refreshHz + ' Hz' : 'unknown'} (measured)`,
      `${ua.length > UA_MAX ? ua.slice(0, UA_MAX) + '…' : ua}`,
      new Date().toISOString().slice(0, 10),
    ];
  }

  AS.runBench = function (app) {
    if (document.getElementById('bench-confirm') || document.getElementById('bench-block')) return;

    // ---- confirm ----
    const confirmBox = el('div', 'bench-panel bench-confirm');
    confirmBox.id = 'bench-confirm';
    const card = el('div', 'bench-card');
    card.appendChild(el('p', '', 'The benchmark replaces this run with test worlds of growing size. It takes a couple of minutes; keep this tab in front and don\'t touch the map.'));
    const row = el('div', 'bench-buttons');
    const start = el('button', 'hud-btn', 'Start');
    const cancel = el('button', 'hud-btn', 'Cancel');
    start.type = cancel.type = 'button';
    row.append(start, cancel);
    card.appendChild(row);
    confirmBox.appendChild(card);
    for (const t of ['pointerdown', 'pointerup', 'wheel']) confirmBox.addEventListener(t, e => e.stopPropagation());
    document.body.appendChild(confirmBox);
    cancel.addEventListener('click', () => confirmBox.remove());
    start.addEventListener('click', () => { confirmBox.remove(); run(app).catch(e => failRun(app, e)); });
  };

  // Whatever else throws still ends the run: the layer and label go, the page unlocks, and
  // the panel says why. Steps already finished are lost with the exception, so it shows none.
  function failRun(app, e) {
    console.error(e);
    app.onFrame = null;
    for (const id of ['bench-block', 'bench-results']) { const x = document.getElementById(id); if (x) x.remove(); }
    for (const x of document.querySelectorAll('.bench-progress')) x.remove();
    app.ui.paused = null;
    app.ui.lock(false);
    showResults([{ key: 'grass', rows: [] }], [`Stopped: ${e && e.message}`], 0, app.T);
  }

  // The two series, in run order. `build` turns a step's count into what the world needs.
  const SERIES = [
    {
      key: 'grass', name: 'grass', unit: 'blades', steps: BLADE_STEPS, measureS: MEASURE_S,
      build: (T, n) => ({ ...worldFor(T, n, MAX_SIDE, 0), animals: NO_ANIMALS, opts: { grassAges: 'mixed' } }),
      count: W => W.gCount,
    },
    {
      key: 'animals', name: 'animals', unit: 'animals', steps: ANIMAL_STEPS, measureS: MEASURE_S_ANIMALS,
      build: (T, n) => ({ ...animalWorldFor(T, n), opts: { grassAges: 'mixed', bodies: 'mixed' } }),
      count: W => W.bunnies + W.wolves,
    },
  ];

  async function run(app) {
    const ui = app.ui;
    ui.lock(true);

    // A transparent layer keeps pointer and wheel input from reaching the camera.
    const block = el('div', 'bench-block');
    block.id = 'bench-block';
    for (const t of ['pointerdown', 'pointerup', 'pointermove', 'wheel', 'touchstart', 'touchmove', 'contextmenu']) {
      block.addEventListener(t, e => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
    }
    const label = el('div', 'bench-progress', '');
    document.body.append(block, label);
    const text = s => { label.dataset.text = s; label.textContent = s; };
    ui.paused = on => {
      label.textContent = on ? 'Paused: bring this tab back to the front' : label.dataset.text || '';
    };

    const T = app.T;
    const notes = [];
    const done = SERIES.map(sr => ({ key: sr.key, rows: [] }));
    let refreshHz = 0;
    let failed = false;
    const canvas = document.getElementById('map');

    try {
      for (let si = 0; si < SERIES.length && !failed; si++) {
        const sr = SERIES[si];
        const rows = done[si].rows;
        for (let i = 0; i < sr.steps.length; i++) {
          const n = sr.steps[i];
          const prefix = `Benchmark · ${sr.name} step ${i + 1} of ${sr.steps.length} · ${fmtInt(n)} ${sr.unit}`;
          const b = sr.build(T, n);
          if (!b.fits) { notes.push(`${fmtInt(n)} ${sr.unit} doesn't fit the ${MAX_SIDE}-tile world limit.`); break; }
          text(`${prefix} · building the world`);
          await paintFrames();

          let sim;
          try {
            sim = AS.Sim(derive(T, b.w, b.h, b.animals, b.share), BENCH_SEED, b.opts);
          } catch (e) {
            const oom = e instanceof RangeError;
            if (!oom) console.error(e);
            notes.push(oom || /memory|allocat|array/i.test(String(e && e.message))
              ? `Ran out of memory at ${fmtInt(n)} ${sr.unit}.` : `Stopped: ${e && e.message}`);
            failed = !oom;
            break;
          }

          app.load(sim);
          app.setSpeed(BENCH_SPEED_INDEX);
          const r = { count: sr.count(sim.W), blades: sim.W.gCount, w: b.w, h: b.h, share: b.share, tickMs: 0, speed: 0, views: {} };

          for (const v of VIEWS) {
            if (v.key === 'out') {
              // A factor this small clamps to the whole-world view.
              app.cam.zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, 1e-9);
            }
            text(`${prefix} · ${v.label}`);
            const s = await measureView(app, ui, sr.measureS);
            // The first, lightest view shows the display's own rate (some browsers cap pages
            // below the display's); every view is judged against it.
            if (!refreshHz) refreshHz = nearestRefresh(percentile(s.interval, 50));
            r.views[v.key] = viewResult(s, refreshHz);
          }

          text(`${prefix} · timing ticks`);
          app.setSpeed(0);
          await paintFrames();
          const simNow = app.sim;
          r.tickMs = timeTicks(() => simNow.tick(), () => performance.now());
          r.speed = keepUpSpeed(r.tickMs);
          rows.push(r);

          if (!r.views.start.smooth && !r.views.out.smooth) break;
        }
      }
    } catch (e) {
      console.error(e);
      notes.push(`Stopped: ${e && e.message}`);
      failed = true;
    }

    app.onFrame = null;
    app.setSpeed(0);
    // Drop the big world so its memory is free and the page stops drawing it.
    try {
      const T2 = derive(T, PARKED_WORLD, PARKED_WORLD, NO_ANIMALS);
      app.load(AS.Sim(T2, BENCH_SEED, { grassAges: 'mixed' }));
    } catch (e) { /* the results still show */ }
    block.remove();
    label.remove();
    ui.paused = null;
    if (failed) ui.lock(false);
    showResults(done, notes, refreshHz, T);
  }

  // ---- results ----
  function buildTable(sr) {
    const wrap = el('div', 'bench-tablewrap');
    const table = el('table', 'bench-table');
    const th = (t, span, cls) => { const c = el('th', cls || '', t); if (span) c.colSpan = span; return c; };
    const head1 = el('tr');
    head1.append(th('', 4), th('Default zoom', 5, 'bench-group'), th('Zoomed out', 5, 'bench-group'));
    const head2 = el('tr');
    for (const t of [seriesUnit(sr), 'world', 'tick ms', 'keeps up']) head2.appendChild(th(t));
    for (let k = 0; k < VIEWS.length; k++) {
      for (const t of ['frame p95', 'work p95', 'worst', 'draw p95', 'smooth']) head2.appendChild(th(t, 0, t === 'frame p95' ? 'bench-gstart' : ''));
    }
    table.appendChild(el('thead')).append(head1, head2);
    const tbody = el('tbody');
    for (const r of sr.rows) {
      const tr = el('tr');
      const cells = [fmtInt(r.count), worldText(r), fmtTick(r.tickMs), speedText(r.speed)];
      for (const v of VIEWS) {
        const x = r.views[v.key];
        cells.push(...(x ? [fmtMs(x.p95), fmtMs(x.workP95), fmtMs(x.worst), fmtMs(x.drawP95), x.smooth ? 'yes' : 'no'] : ['', '', '', '', '']));
      }
      cells.forEach((c, i) => {
        const td = el('td', i === 8 || i === 13 ? (c === 'no' ? 'bench-bad' : 'bench-good') : '', c);
        if (i === 4 || i === 9) td.className += ' bench-gstart';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function showResults(series, notes, refreshHz, T) {
    const paulBlades = Math.round(T.world.WorldWidth * T.world.WorldHeight * T.world.StartGrass);
    const grass = series[0].rows;
    const animals = series[1] ? series[1].rows : [];
    const summary = summaryText(grass, animals, {
      paulBlades, refreshHz, notes, grassTotal: BLADE_STEPS.length, animalTotal: ANIMAL_STEPS.length,
    });
    const device = deviceLines(refreshHz);
    const text = reportText(series, summary, device);

    const panel = el('div', 'bench-panel bench-results');
    panel.id = 'bench-results';
    for (const t of ['pointerdown', 'pointerup', 'wheel']) panel.addEventListener(t, e => e.stopPropagation());
    const card = el('div', 'bench-card bench-wide');
    card.appendChild(el('h1', 'bench-title', 'Benchmark results'));
    for (const s of summary) card.appendChild(el('p', 'bench-sum', s));

    for (const sr of series) {
      if (!sr.rows.length) continue;
      card.appendChild(el('h2', 'bench-subtitle', seriesTitle(sr)));
      card.appendChild(buildTable(sr));
    }
    card.appendChild(el('p', 'bench-note', 'Times are milliseconds per frame. Smooth: the work (tick + draw) fits 1/60 s in at least 95% of frames and no frame\'s work or spacing passes 50 ms, and at least 95% of frames arrive on the display\'s own rhythm. Keeps up: the fastest speed whose ticks fit the frame\'s tick budget.'));
    const dev = el('div', 'bench-device');
    for (const d of device) dev.appendChild(el('div', '', d));
    card.appendChild(dev);

    const buttons = el('div', 'bench-buttons');
    const copy = el('button', 'hud-btn', 'Copy results');
    const back = el('button', 'hud-btn', 'Back to the sim');
    copy.type = back.type = 'button';
    const status = el('span', 'bench-status', '');
    buttons.append(copy, back, status);
    card.appendChild(buttons);
    back.addEventListener('click', () => location.reload());

    // If the clipboard is refused, the text goes into a box and is selected for a hand copy.
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
        status.textContent = 'Copied.';
      } catch (e) {
        let box = card.querySelector('textarea');
        if (!box) {
          box = el('textarea', 'bench-text');
          box.readOnly = true;
          box.value = text;
          box.rows = 12;
          card.appendChild(box);
        }
        box.focus();
        box.select();
        status.textContent = 'Copy was blocked. The text is selected below; copy it by hand.';
      }
    });

    panel.appendChild(card);
    document.body.appendChild(panel);
  }
})(globalThis.AS);
