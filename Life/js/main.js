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
  // The inspector refreshes this often; a new selection shows at once.
  const INSPECT_EVERY_MS = 100;

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
  let graph = null;   // made once the tables load; the HUD button may exist before that

  const ui = AS.UI({
    debug,
    speeds: SPEEDS,
    onSpeed: setSpeed,
    onDebugTool: m => { tool = m; },
    onCloseInspector: () => { sel = null; },
    onBench: () => AS.runBench(AS.app),
    onGraph: () => { if (graph) graph.toggle(); },
  });

  try { await document.fonts.load(`32px ${AS.FONT}`, 'αΩ░▒▓†'); } catch (e) { /* draws with a fallback */ }

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
  const sheet = AS.GlyphSheet(AS.FONT, T);
  const renderer = AS.Renderer(canvas);
  // Marks follow the sim on their own: a swapped-in world restarts their event cursor.
  const marks = AS.Marks(T);
  graph = AS.Graph(T);

  cam.attach((tx, ty) => {
    const W = sim.W;
    if (tx < 0) { sel = null; return; }
    const t = W.tile(tx, ty);
    if (tool === 'corpse-bunny' || tool === 'corpse-wolf') {
      AS.debugDropCorpse(sim, t, tool === 'corpse-bunny' ? AS.SPECIES.BUNNY : AS.SPECIES.WOLF);
      return;
    }
    const k = W.kind[t];
    if (k === AS.KIND.EMPTY) sel = null;
    else if (k === AS.KIND.BUNNY || k === AS.KIND.WOLF) {
      const s = W.aSlot[t];
      sel = { tile: t, serial: W.aSerial[s], slot: s };
    } else sel = { tile: t, serial: W.serial[t], slot: -1 };
  });

  // A selection follows its agent, and clears when the agent is gone.
  function liveSelection() {
    if (!sel) return null;
    const W = sim.W;
    if (sel.slot >= 0) {
      if (!W.aAlive[sel.slot] || W.aSerial[sel.slot] !== sel.serial) return (sel = null);
      sel.tile = W.aTile[sel.slot];
    } else if (W.serial[sel.tile] !== sel.serial) return (sel = null);
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

    if (now - window0 >= ACHIEVED_WINDOW_S * 1000) {
      achieved = (sim.simSeconds - simAtWindow0) / ((now - window0) / 1000);
      window0 = now;
      simAtWindow0 = sim.simSeconds;
    }

    const alpha = speed === Infinity ? 1 : acc / AS.DT;
    const t1 = performance.now();
    const live = liveSelection();
    renderer.draw(sim, cam, sheet, live, alpha, marks, now);
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
  //   app.onFrame       null, or fn(intervalMs, tickMs, drawMs, ticks) after every frame
  const app = AS.app = {
    T, cam, renderer, sheet, ui, graph, setSpeed, onFrame: null,
    get sim() { return sim; },
    get sel() { return sel; },
    get speedIndex() { return speedIndex; },
    load(next) {
      sim = next;
      sel = null;
      acc = 0;
      cam.setWorld(next.W);
      window0 = performance.now();
      simAtWindow0 = next.simSeconds;
    },
  };

  // Loading took real time the sim didn't run; start the clocks from here.
  last = window0 = performance.now();
  requestAnimationFrame(frame);
})(globalThis.AS);
