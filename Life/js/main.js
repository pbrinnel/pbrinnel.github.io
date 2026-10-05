// Boots the page and runs the frame loop. Each frame runs however many fixed ticks the
// speed asks for (within a time budget), then draws once. Drawing never changes the sim.
(async function (AS) {
  'use strict';

  // DESIGN.md "Time": pause, 1×, 2×, 5×, 20×, max.
  const SPEEDS = [0, 1, 2, 5, 20, Infinity];
  const START_SPEED = 1;
  // Ticks may use this much of a frame; the rest is drawing. Past it a fixed speed falls
  // behind (and the HUD says so) instead of piling up work and freezing the page.
  const TICK_BUDGET_MS = AS.TICK_BUDGET_MS = 12;
  // A frame longer than this (a background tab, a debugger pause) counts as this long.
  const MAX_FRAME_S = 0.1;
  // The HUD's "running at" figure is measured over about this long.
  const ACHIEVED_WINDOW_S = 1;
  // A tap within this many tiles of an animal's drawn center picks it.
  const PICK_RADIUS = 0.75;
  // Dabs along a brush stroke are at most this far apart (tiles): under a brush's own width,
  // so the stroke is solid, and each dab costs only its still-empty tiles.
  const BRUSH_STEP = 1;
  // The inspector refreshes this often; a new selection shows at once.
  const INSPECT_EVERY_MS = 100;
  const LINES_KEY = 'life-intent-lines';
  // The open tab ('info', 'debug', 'god', or '' for closed), remembered per browser.
  const TAB_KEY = 'life-ui-tab';

  const debug = new URLSearchParams(location.search).has('debug');
  let speedIndex = START_SPEED;
  let sim = null;
  // Frame-loop state. Declared before the UI exists, since a key can change speed while the
  // tables are still loading.
  let acc = 0;
  let last = performance.now();
  let window0 = last, simAtWindow0 = 0, achieved = SPEEDS[START_SPEED];
  let inspected = 0, inspectedAt = 0;   // serial last shown in the inspector, and when
  let tool = 'select';
  let sel = null;
  // Intent lines are the viewer's choice, kept per browser; off when storage is unavailable.
  let linesOn = false;
  try { linesOn = localStorage.getItem(LINES_KEY) === '1'; } catch (e) { /* stays off */ }
  // The open HUD tab is also the viewer's choice. Nothing stored (or storage blocked): Info.
  let savedTab;
  try { const v = localStorage.getItem(TAB_KEY); if (v !== null) savedTab = v === '' ? null : v; } catch (e) { /* default */ }
  let nukeOn = false;   // NUKE MODE: a tap on the world drops a nuke instead of selecting
  let brush = '';   // GRASS / RABBIT / WOLF MODE: the kind a tap or drag paints, or ''
  let graph = null;   // made once the tables load; the HUD button may exist before that

  const ui = AS.UI({
    debug,
    speeds: SPEEDS,
    onSpeed: setSpeed,
    onDebugTool: m => { tool = m; },
    onCloseInspector: () => { sel = null; },
    onBench: () => AS.runBench(AS.app),
    onGraph: () => { if (graph) graph.toggle(); },
    tab: savedTab,
    onTab: name => { try { localStorage.setItem(TAB_KEY, name || ''); } catch (e) { /* not kept */ } },
    onNuke: on => { nukeOn = on; },
    onMode: m => { brush = m === 'grass' || m === 'bunny' || m === 'wolf' ? m : ''; },
    lines: linesOn,
    onLines: on => {
      linesOn = on;
      try { localStorage.setItem(LINES_KEY, on ? '1' : '0'); } catch (e) { /* the choice just isn't kept */ }
    },
  });

  try { await document.fonts.load(`32px ${AS.FONT}`); } catch (e) { /* draws with a fallback */ }

  // Opened from disk, a browser refuses to fetch the CSVs; say how to serve it instead of
  // reporting four load failures as table problems (DESIGN.md: the page must be served).
  if (location.protocol === 'file:') {
    ui.errors([
      'In Terminal, from the folder that holds life.html: npx http-server . -p 8912 -c-1',
      'Then open http://localhost:8912/life.html',
    ], [], {
      title: 'Life has to be served, not opened as a file',
      intro: 'Browsers don\'t let a page opened from your disk read its data files (the tables in Life/tables/). Serve the folder instead:',
      foot: 'Online, paulbrinnel.com/life.html works as is.',
    });
    return;
  }

  const { T, errors, warnings } = await AS.loadTables(AS.V);
  if (!T) { ui.errors(errors, warnings); return; }
  const states = AS.checkStates(T);
  if (states.errors.length) { ui.errors(states.errors, warnings.concat(states.warnings)); return; }
  const allWarnings = warnings.concat(states.warnings, AS.inspectWarnings(T));
  if (allWarnings.length) ui.warnings(allWarnings);

  const seed = T.world.Seed ?? AS.newSeed();
  sim = AS.Sim(T, seed);
  const canvas = document.getElementById('map');
  const cam = AS.Camera(canvas, sim.W);
  const sheet = AS.SpriteSheet(T);
  // The Info tab's counts show the world's own sprites: a bunny, a wolf, a full tuft, a skull.
  const ICON_CSS_PX = 16;
  const ICON_SPRITE = {
    bunnies: AS.spriteIndex(AS.SPECIES.BUNNY, AS.SEX.MALE, AS.STAGE.ADULT, 0, AS.SPRITE_FRAME.STAND),
    wolves: AS.spriteIndex(AS.SPECIES.WOLF, AS.SEX.MALE, AS.STAGE.ADULT, 0, AS.SPRITE_FRAME.STAND),
    blades: AS.spriteGrass(2),
    corpses: AS.spriteSkull(AS.SPECIES.BUNNY),
  };
  function drawIcon(key, cv) {
    // A whole number of device pixels per sprite pixel keeps the pixel art crisp.
    const px = AS.SPRITE_SIZE * Math.max(1, Math.ceil(ICON_CSS_PX * (window.devicePixelRatio || 1) / AS.SPRITE_SIZE));
    const sh = sheet.get(px), i = ICON_SPRITE[key];
    cv.width = cv.height = px;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(sh.canvas, sh.sx(i), sh.sy(i), px, px, 0, 0, px, px);
    return cv;
  }
  ui.setIcons(drawIcon);
  const renderer = AS.Renderer(canvas);
  graph = AS.Graph(T);
  graph.setIcons({ grass: drawIcon('blades', document.createElement('canvas')),
    bunnies: drawIcon('bunnies', document.createElement('canvas')),
    wolves: drawIcon('wolves', document.createElement('canvas')) });

  // A tap picks an animal by where its sprite is drawn: mid-step it's between the tile it
  // left and the one it already occupies, and people tap what they see. Blades and
  // corpses don't move, so they're picked by tile.
  cam.attach((tx, ty, fx, fy) => {
    const W = sim.W;
    if (nukeOn) { if (tx >= 0) app.nukeAt(tx, ty); return; }
    if (brush) { if (tx >= 0) app.paintAt(tx, ty); return; }
    if (tx >= 0 && (tool === 'corpse-bunny' || tool === 'corpse-wolf')) {
      AS.debugDropCorpse(sim, W.tile(tx, ty), tool === 'corpse-bunny' ? AS.SPECIES.BUNNY : AS.SPECIES.WOLF);
      return;
    }
    const s = animalDrawnNear(W, fx, fy);
    if (s >= 0) { sel = { tile: W.aTile[s], serial: W.aSerial[s], slot: s }; return; }
    if (tx < 0) { sel = null; return; }
    const t = W.tile(tx, ty), k = W.kind[t];
    // A hole with nothing on it is selectable too (it has no serial, so `hole` marks it).
    const bareHole = k === AS.KIND.EMPTY && W.hole[t] === 1;
    sel = k === AS.KIND.GRASS || k === AS.KIND.CORPSE || bareHole ? { tile: t, serial: W.serial[t], slot: -1, hole: bareHole } : null;
  }, (x0, y0, x1, y1) => { if (brush) app.paintLine(x0, y0, x1, y1); });

  // The animal whose drawn center is nearest (fx, fy), in tiles, within PICK_RADIUS; or -1.
  function animalDrawnNear(W, fx, fy) {
    const alpha = SPEEDS[speedIndex] === Infinity ? 1 : acc / AS.DT;
    let best = -1, bestD2 = PICK_RADIUS * PICK_RADIUS;
    for (let s = 0, hi = W.aHigh; s < hi; s++) {
      if (!W.aAlive[s]) continue;
      const p = AS.glideProgress(W.aStepLeft[s], W.aStepDur[s], alpha);
      const ax = W.tx(W.aFrom[s]), ay = W.ty(W.aFrom[s]);
      const dx = ax + (W.tx(W.aTile[s]) - ax) * p + 0.5 - fx;
      const dy = ay + (W.ty(W.aTile[s]) - ay) * p + 0.5 - fy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestD2 = d2; best = s; }
    }
    return best;
  }

  // A selection follows its agent, and clears when the agent is gone.
  function liveSelection() {
    if (!sel) return null;
    const W = sim.W;
    if (sel.slot >= 0) {
      if (!W.aAlive[sel.slot] || W.aSerial[sel.slot] !== sel.serial) return (sel = null);
      sel.tile = W.aTile[sel.slot];
    } else if (W.serial[sel.tile] !== sel.serial || (sel.hole && (!W.hole[sel.tile] || W.kind[sel.tile] !== AS.KIND.EMPTY))) return (sel = null);
    return sel;
  }

  // Until a full window has been measured at the new speed, report the speed asked for, so
  // the HUD never claims the sim is behind when it simply hasn't been timed yet. Max has no
  // asked-for figure, so it shows nothing until measured.
  function setSpeed(i) {
    speedIndex = i;
    const s = SPEEDS[i];
    achieved = s === Infinity ? 0 : s;
    window0 = performance.now();
    simAtWindow0 = sim ? sim.simSeconds : 0;
  }

  function frame(now) {
    const interval = now - last;
    cam.strokes = brush !== '';   // a drag paints instead of panning while a brush is armed
    cam.update(Math.min(MAX_FRAME_S * 1000, interval));
    const realDt = Math.min(MAX_FRAME_S, interval / 1000);
    last = now;
    const ticksBefore = sim.tickCount;
    const speed = SPEEDS[speedIndex];
    const t0 = performance.now();

    if (speed === Infinity) {
      do sim.tick(); while (performance.now() - t0 < TICK_BUDGET_MS);
      acc = 0;
    } else if (speed > 0) {
      acc += realDt * speed;
      while (acc >= AS.DT) {
        if (performance.now() - t0 >= TICK_BUDGET_MS) { acc = Math.min(acc, AS.DT); break; }
        sim.tick();
        acc -= AS.DT;
      }
    }

    const tickMs = performance.now() - t0;
    checkEnded();

    if (now - window0 >= ACHIEVED_WINDOW_S * 1000) {
      achieved = (sim.simSeconds - simAtWindow0) / ((now - window0) / 1000);
      window0 = now;
      simAtWindow0 = sim.simSeconds;
    }

    const alpha = speed === Infinity ? 1 : acc / AS.DT;
    const t1 = performance.now();
    const live = liveSelection();
    renderer.setIntentLines(linesOn);
    renderer.draw(sim, cam, sheet, live, alpha, now, speed);
    const shown = live ? live.serial : 0;
    if (shown !== inspected || now - inspectedAt >= INSPECT_EVERY_MS) {
      ui.inspector(AS.describe(sim, live));
      inspected = shown;
      inspectedAt = now;
    }
    graph.draw(sim, now);
    const W = sim.W;
    ui.hud({
      speedIndex, achieved, day: sim.day, seed: sim.seed,
      counts: { bunnies: W.bunnies, wolves: W.wolves, blades: W.gCount, corpses: W.cCount },
    });
    // CPU time only: the browser's own compositing shows up in `interval`, not here.
    if (app.onFrame) {
      app.onFrame(interval, tickMs, performance.now() - t1, sim.tickCount - ticksBefore);
    }
    requestAnimationFrame(frame);
  }
  // For the console, the benchmark and test harnesses.
  //   app.load(sim)     swaps in another world (the benchmark's); the camera re-centers on it
  //   app.nukeAt(x, y)  a nuke on that tile (what a tap does in NUKE MODE)
  //   app.paintAt(x, y), app.paintLine(x0, y0, x1, y1)   the brush of GRASS/RABBIT/WOLF MODE
  //   app.onFrame       null, or fn(intervalMs, tickMs, drawMs, ticks) after every frame
  // A run ends the moment a species dies out (Paul): the sim pauses and says which. Keep
  // watching resumes without asking again about the species already gone. A species a
  // world starts without (the benchmark's grass-only worlds) never counts as dying out.
  const EXTINCT = [['wolves', 'WOLVES EXTINCT'], ['bunnies', 'BUNNIES EXTINCT'], ['grass', 'GRASS EXTINCT']];
  const counts = W => ({ wolves: W.wolves, bunnies: W.bunnies, grass: W.gCount });
  let gone = new Set(), absent = new Set(), runSpeed = speedIndex;
  function resetEnded() {
    const n = counts(sim.W);
    gone = new Set();
    absent = new Set(EXTINCT.filter(([k]) => n[k] === 0).map(([k]) => k));
  }
  function checkEnded() {
    const n = counts(sim.W);
    const fresh = EXTINCT.filter(([k]) => n[k] === 0 && !gone.has(k) && !absent.has(k));
    if (!fresh.length) return;
    fresh.forEach(([k]) => gone.add(k));
    if (speedIndex !== 0) runSpeed = speedIndex;
    setSpeed(0);
    ui.ended({
      titles: EXTINCT.filter(([k]) => gone.has(k)).map(([, t]) => t),
      day: sim.day,
      onNew() { ui.ended(null); app.load(AS.Sim(T, T.world.Seed ?? AS.newSeed())); setSpeed(runSpeed); },
      onContinue() { ui.ended(null); setSpeed(runSpeed); },
    });
  }

  const app = AS.app = {
    T, cam, renderer, sheet, ui, graph, setSpeed, onFrame: null,
    get sim() { return sim; },
    get sel() { return sel; },
    get speedIndex() { return speedIndex; },
    // Drops a nuke on tile (tx, ty): the sim side (god.js) and the explosion drawn over it.
    nukeAt(tx, ty) {
      const out = AS.nuke(sim, sim.W.tile(tx, ty));
      renderer.blast(tx, ty, sim.T.world.NukeRadius, performance.now());
      return out;
    },
    // A brush dab: the armed kind on every eligible tile within BrushRadius of tile (tx, ty).
    paintAt(tx, ty) {
      return brush && tx >= 0 && ty >= 0 && tx < sim.W.w && ty < sim.W.h
        ? AS.paintCircle(sim, brush, tx, ty, sim.T.world.BrushRadius) : 0;
    },
    // A brush stroke between two pointer samples (world tiles, fractions kept): a dab every
    // BRUSH_STEP tiles along the segment, so a fast drag leaves no gaps.
    paintLine(x0, y0, x1, y1) {
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / BRUSH_STEP));
      let placed = 0;
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        placed += app.paintAt(Math.floor(x0 + (x1 - x0) * f), Math.floor(y0 + (y1 - y0) * f));
      }
      return placed;
    },
    load(next) {
      sim = next;
      sel = null;
      resetEnded();
      ui.ended(null);
      acc = 0;
      cam.setWorld(next.W);
      window0 = performance.now();
      simAtWindow0 = next.simSeconds;
    },
  };

  resetEnded();
  // Loading took real time the sim didn't run; start the clocks from here.
  last = window0 = performance.now();
  requestAnimationFrame(frame);
})(globalThis.AS);
