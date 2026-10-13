// Boots the page and runs the frame loop. Each frame runs however many fixed ticks the
// speed asks for (within a time budget), then draws once. Drawing never changes the sim.
(async function (AS) {
  'use strict';

  // DESIGN.md "Time": pause, 1×, 2×, 5×, 20×, max.
  const SPEEDS = [0, 1, 2, 5, 20, Infinity];
  const START_SPEED = 1;
  // Ticks may use this much of a frame at least; the rest is drawing. Past it a fixed speed
  // falls behind (and the HUD says so) instead of piling up work and freezing the page. The
  // benchmark measures against this fixed figure.
  const TICK_BUDGET_MS = AS.TICK_BUDGET_MS = 12;
  // The budget each frame actually gets: the display's frame time, less what drawing has been
  // taking and FRAME_SLACK_MS for the browser's own compositing, never under TICK_BUDGET_MS.
  // A fixed 12 ms left about 7% of each frame idle at Max (Paul, 13 Oct 2026: more speed).
  const FRAME_SLACK_MS = 2;
  const FRAME_EASE = 0.1;           // how fast the frame and draw estimates follow (per frame)
  const FRAME_MIN_MS = 4, FRAME_MAX_MS = 50;   // frame times outside this aren't the display's
  let frameMs = 1000 / 60, drawMs = 2;
  // A frame longer than this (a background tab, a debugger pause) counts as this long.
  const MAX_FRAME_S = 0.1;
  // The HUD's "running at" figure is measured over about this long.
  const ACHIEVED_WINDOW_S = 1;
  // A tap within this many tiles of an animal's drawn center picks it.
  const PICK_RADIUS = 0.75;
  // Dabs along a brush stroke are at most this far apart (tiles), and at most half the brush's
  // radius when that is larger: a dab is a whole circle, so a big brush needs few of them, and
  // each dab costs only its still-empty tiles.
  const BRUSH_STEP = 1;
  // The inspector refreshes this often; a new selection shows at once.
  const INSPECT_EVERY_MS = 100;
  const LINES_KEY = 'life-intent-lines';
  const ELEV_KEY = 'life-elevation';
  const INSPECT_KEY = 'life-inspect';
  const INSPECT_MODES = ['off', 'click', 'hover'];
  const INSPECT_EMPTY_KEY = 'life-inspect-empty';
  const CONTOUR_KEY = 'life-contour-m';
  const WATER_KEY = 'life-water';
  // The open tab windows (keys of 'info', 'paint', 'debug', comma-separated), remembered per
  // browser. PAINT's key was 'god' until 12 Oct 2026, and a list saved then reads the same.
  const WINDOWS_KEY = 'life-ui-windows';
  const OLD_WINDOW_KEYS = { god: 'paint' };

  const debug = new URLSearchParams(location.search).has('debug');

  // ---- The loading panel (#loading in life.html) ----
  // A plain list of the real steps the page runs to make a world, each marked pending,
  // running or done as it happens, with the numbers the run produced. Every figure comes from
  // the tables, from AS or from the world itself, so retuning a table changes the text.
  // ?loadhold=MS (debugging) keeps the panel up that long after the world is ready.
  const LOAD_HOLD_MS = Math.max(0, Number(new URLSearchParams(location.search).get('loadhold')) || 0);
  const Loading = (function () {
    const listEl = document.getElementById('ld-steps');
    const MARK = { pending: '[..]', running: '[>>]', done: '[ok]', skipped: '[--]' };
    const rows = new Map();
    const born = performance.now();
    const n0 = (x) => Math.round(x).toLocaleString('en-US');
    const n1 = (x, d = 1) => Number(x.toFixed(d)).toLocaleString('en-US');
    const secs = ms => (ms < 1000 ? Math.max(1, Math.round(ms)) + ' ms' : (ms / 1000).toFixed(1) + ' s');
    function addList(parent, cls, lines) {
      const ul = document.createElement('ul');
      ul.className = cls;
      for (const t of lines) { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); }
      parent.appendChild(ul);
      return ul;
    }
    // `desc` is the prose under the step's name; plan() fills in the ones that need the tables.
    function add(id, name, desc) {
      if (!listEl) return;
      const li = document.createElement('li');
      li.className = 'ld-step';
      li.dataset.state = 'pending';
      const head = document.createElement('div');
      head.className = 'ld-head';
      const mark = document.createElement('span'); mark.className = 'ld-mark'; mark.textContent = MARK.pending;
      const nm = document.createElement('span'); nm.className = 'ld-name'; nm.textContent = name;
      const tm = document.createElement('span'); tm.className = 'ld-time';
      head.append(mark, nm, tm);
      li.appendChild(head);
      const row = { li, mark, tm, desc: null, res: null, at: 0 };
      rows.set(id, row);
      if (desc) row.desc = addList(li, 'ld-desc', desc);
      listEl.appendChild(li);
    }
    function describe(id, desc) {
      const r = rows.get(id);
      if (!r || r.desc) return;
      r.desc = addList(r.li, 'ld-desc', desc);
      // The results list sits below the prose.
      if (r.res) r.li.appendChild(r.res);
    }
    function set(id, state, results, ms) {
      const r = rows.get(id);
      if (!r) return;
      r.li.dataset.state = state;
      r.mark.textContent = MARK[state];
      if (state === 'running') {
        r.at = performance.now();
        // The card scrolls when the list is taller than the screen: keep the running step in view.
        const card = listEl.parentNode;
        if (card.scrollHeight > card.clientHeight) card.scrollTop = Math.max(0, r.li.offsetTop - 60);
      }
      if (state === 'done') r.tm.textContent = secs(ms !== undefined ? ms : performance.now() - r.at);
      if (results && results.length) {
        if (r.res) r.res.remove();
        r.res = addList(r.li, 'ld-res', results);
      }
    }
    // Back to pending for the steps a new world repeats.
    function reset(ids) {
      for (const id of ids) {
        const r = rows.get(id);
        if (!r) continue;
        r.li.dataset.state = 'pending'; r.mark.textContent = MARK.pending; r.tm.textContent = '';
        if (r.res) { r.res.remove(); r.res = null; }
      }
    }
    function start(id) { const r = rows.get(id); if (r) r.at = born; set(id, 'running'); }
    return { add, describe, set, reset, start, n0, n1, secs };
  })();
  Loading.add('tables', 'Read data tables');
  Loading.add('states', 'Check behavior states');
  Loading.add('params', 'Set world parameters');
  Loading.add('terrain', 'Grow terrain, settle water (Web Worker)');
  Loading.add('lay', 'Lay out the world');
  Loading.start('tables');

  // One line per stage that does real work, written once the tables are read. A named
  // setting is shown with its value; AS exports the few constants that live in the code.
  function planLoading(T) {
    const S = T.world, n1 = Loading.n1;
    const meadows = String(S.StartLayout).toLowerCase() === 'meadows';
    Loading.describe('terrain', [
      `Ground: ${S.GrowRounds} rounds of uplift, steepest-descent drainage, stream-power erosion (RiverCut ${S.RiverCut}).`,
      `Water: ${S.PreRunDays}-day pre-run, Manning surface flow, Darcy soil flow, ending at play's ${n1(AS.WATER_STEP_DAYS * 1440)}-minute step.`,
    ]);
    Loading.describe('lay', [
      meadows
        ? `${S.BunnyColonies} colonies, ${S.WolfPacks} packs, ${Math.round(S.StartGrass * 100)}% meadow.`
        : `Scattered: ${Math.round(S.StartGrass * 100)}% grass, ${S.StartBunnies} bunnies, ${S.StartWolves} wolves.`,
    ]);
  }
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
  // Water (lakes, rivers, thirst) is the viewer's choice too: on unless they turned it off.
  // The HUD is built before the tables load, so this default can't read settings.csv's Water.
  let radiusReq = null;   // the Radius slider moved since the last frame: preview its size
  const located = new Set();   // kinds whose rings are on (ui onLocate)
  let waterOn = true;
  try { waterOn = localStorage.getItem(WATER_KEY) !== '0'; } catch (e) { /* stays on */ }
  // The properties window: Off, Click (select to inspect) or Hover. Click unless chosen.
  let inspectMode = 'click';
  try { const v = localStorage.getItem(INSPECT_KEY); if (INSPECT_MODES.includes(v)) inspectMode = v; } catch (e) { /* click */ }
  // Inspect Empty Tiles: off unless chosen.
  let inspectEmpty = false;
  try { inspectEmpty = localStorage.getItem(INSPECT_EMPTY_KEY) === '1'; } catch (e) { /* off */ }
  // Meters between topo lines: the viewer's slider, else the renderer's own spacing.
  let contourStep = null;
  try { const v = Number(localStorage.getItem(CONTOUR_KEY)); if (v > 0) contourStep = v; } catch (e) { /* default */ }
  // Topo lines: on unless the viewer turned them off.
  let elevOn = true;
  try { elevOn = localStorage.getItem(ELEV_KEY) !== '0'; } catch (e) { /* stays on */ }
  let linesOn = false;
  try { linesOn = localStorage.getItem(LINES_KEY) === '1'; } catch (e) { /* stays off */ }
  // Which tab windows are open is also the viewer's choice. Nothing stored (or storage blocked): Info.
  let savedWindows;
  try { const v = localStorage.getItem(WINDOWS_KEY); if (v !== null) savedWindows = v ? v.split(',').map(k => OLD_WINDOW_KEYS[k] || k) : []; } catch (e) { /* default */ }
  let nukeOn = false;   // NUKE MODE: a tap on the world drops a nuke instead of selecting
  let brush = '';   // GRASS / RABBIT / WOLF / HUMAN MODE: the kind a tap or drag paints, or ''
  let radiusOf = () => 0;   // the Radius slider's value for a mode; the real one exists once the UI does
  let graph = null;   // made once the tables load; the HUD button may exist before that
  let minimap = null;   // likewise

  const ui = AS.UI({
    debug,
    speeds: SPEEDS,
    onSpeed: setSpeed,
    onDebugTool: m => { tool = m; },
    onCloseInspector: () => { sel = null; },
    onBench: () => AS.runBench(AS.app),
    onGraph: () => { if (graph) graph.toggle(); },
    onMinimap: () => { if (minimap) minimap.toggle(); },
    onRadius: (mode, r) => { radiusReq = { r, nuke: mode === 'nuke' }; },
    windows: savedWindows,
    onWindows: keys => { try { localStorage.setItem(WINDOWS_KEY, keys.join(',')); } catch (e) { /* not kept */ } },
    onNuke: on => { nukeOn = on; },
    // A count's toggle: the kinds to ring on the map, handed to the renderer every frame.
    onLocate: (key, on) => { if (on) located.add(key); else located.delete(key); },
    onMode: m => { brush = m === 'grass' || m === 'water' || m === 'fire' || AS.SPECIES_KEY.includes(m) ? m : ''; },
    water: waterOn,
    onWater: on => {
      waterOn = on;
      try { localStorage.setItem(WATER_KEY, on ? '1' : '0'); } catch (e) { /* the choice just isn't kept */ }
      // Water is laid when a world is built, so the switch starts a new world.
      if (sim) { ui.ended(null); makeWorld(T.world.Seed ?? AS.newSeed()).then(w => { app.load(w); setSpeed(runSpeed); }); }
    },
    inspect: inspectMode,
    onInspect: m => {
      inspectMode = m;
      sel = null;   // a new mode starts with nothing picked
      try { localStorage.setItem(INSPECT_KEY, m); } catch (e) { /* the choice just isn't kept */ }
    },
    inspectEmpty,
    onInspectEmpty: on => {
      inspectEmpty = on;
      if (!on && sel && sel.empty) sel = null;
      try { localStorage.setItem(INSPECT_EMPTY_KEY, on ? '1' : '0'); } catch (e) { /* the choice just isn't kept */ }
    },
    contourStep: contourStep || 5,
    onContourStep: m => {
      contourStep = m;
      try { localStorage.setItem(CONTOUR_KEY, String(m)); } catch (e) { /* the choice just isn't kept */ }
    },
    elevation: elevOn,
    onElevation: on => {
      elevOn = on;
      try { localStorage.setItem(ELEV_KEY, on ? '1' : '0'); } catch (e) { /* the choice just isn't kept */ }
    },
    lines: linesOn,
    onLines: on => {
      linesOn = on;
      try { localStorage.setItem(LINES_KEY, on ? '1' : '0'); } catch (e) { /* the choice just isn't kept */ }
    },
  });

  radiusOf = m => ui.radiusOf(m);
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

  // Making a world takes seconds (terrain.js grows the ground, the water settles). That part
  // runs in a worker (terrain-worker.js) so the page stays alive, with the loading card up;
  // the page then lays the world from it. Without workers (a page opened as a file) the
  // page grows it itself, after giving the card two frames to paint.
  const loadingEl = document.getElementById('loading');
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
  function growInWorker(seed) {
    return new Promise(resolve => {
      let wk;
      try { wk = new Worker(AS.BASE + 'js/terrain-worker.js?v=' + AS.V); } catch (e) { resolve(null); return; }
      const done = r => { wk.terminate(); resolve(r); };
      wk.onmessage = e => done(e.data);
      wk.onerror = e => { e.preventDefault(); done(null); };
      wk.postMessage({ base: new URL(AS.BASE, location.href).href, v: AS.V, T, seed, water: waterOn });
    });
  }
  // The figures the terrain step reports: this world's drawn values and the water that settled.
  function terrainFigures(S, elev, H, G, water) {
    const { n0, n1 } = Loading;
    const out = [
      `Relief ${AS.units.length(S.Relief, 1)}, ${S.RiverMouths} river mouths, rain ${AS.units.rainRate(S.Rain, 2)}`,
    ];
    if (water && H) {
      let wet = 0, soil = 0;
      for (let i = 0; i < H.length; i++) { if (H[i] > 0) wet++; soil += G[i]; }
      const room = S.SoilDepth * AS.SOIL_POROSITY;
      out.push(`At rest: ${n1(100 * wet / H.length)}% of tiles under water, soil ${n0(100 * soil / H.length / room)}% full`);
    } else if (!water) out.push('Water is off, so only the ground was made.');
    return out;
  }
  async function makeWorld(seed) {
    const { n0, n1 } = Loading, W0 = T.world;
    Loading.reset(['params', 'terrain', 'lay']);
    Loading.start('params');
    Loading.set('params', 'done', [
      `${n0(W0.WorldWidth)} x ${n0(W0.WorldHeight)} tiles (${AS.units.distance(W0.WorldWidth * AS.TILE_M / 1000)} x ${AS.units.distance(W0.WorldHeight * AS.TILE_M / 1000)}), seed ${seed}`,
    ]);
    if (loadingEl) { loadingEl.hidden = false; Loading.start('terrain'); await nextFrame(); await nextFrame(); }
    try {
      const grown = typeof Worker === 'function' ? await growInWorker(seed) : null;
      if (grown) Loading.set('terrain', 'done', terrainFigures(grown.S, grown.elev, grown.H, grown.G, grown.water));
      else Loading.set('terrain', 'skipped', ['No Web Worker here, so the ground is grown on the page, inside the next step.']);
      Loading.start('lay');
      await nextFrame(); await nextFrame();
      const made = AS.Sim(T, seed, { water: waterOn, terrain: grown || undefined });
      const W = made.W;
      if (!grown) Loading.set('terrain', 'skipped', terrainFigures(made.terrain, W.elev, W.water && W.water.H, W.water && W.water.G, !!W.water));
      Loading.set('lay', 'done', [
        `${n0(W.gCount)} blades, ${n0(W.bunnies)} bunnies, ${n0(W.wolves)} wolves`,
      ]);
      if (LOAD_HOLD_MS) await new Promise(r => setTimeout(r, LOAD_HOLD_MS));
      return made;
    } finally { if (loadingEl) loadingEl.hidden = true; }
  }

  const { T, errors, warnings } = await AS.loadTables(AS.V);
  if (!T) { ui.errors(errors, warnings); return; }
  {
    const withStates = AS.SPECIES_KEY.filter(key => T.states[key]);
    Loading.set('tables', 'done', [`${Object.keys(T.world).length} settings, ${withStates.length} species`]);
    planLoading(T);
    Loading.start('states');
  }
  const states = AS.checkStates(T);
  if (states.errors.length) { ui.errors(states.errors, warnings.concat(states.warnings)); return; }
  Loading.set('states', 'done', [AS.SPECIES_KEY.filter(key => T.states[key]).map(key => `${key} ${T.states[key].length}`).join(', ') + ' states']);
  const allWarnings = warnings.concat(states.warnings, AS.inspectWarnings(T));
  if (allWarnings.length) ui.warnings(allWarnings);

  const seed = T.world.Seed ?? AS.newSeed();
  ui.setRadiusDefaults(T.world.BrushRadius);
  sim = await makeWorld(seed);
  const canvas = document.getElementById('map');
  const cam = AS.Camera(canvas, sim.W);
  const sheet = AS.SpriteSheet(T);
  // The Info tab's counts show the world's own sprites: a bunny, a wolf, a human, a full tuft, a skull.
  const ICON_CSS_PX = 16;
  const ICON_SPRITE = {
    bunnies: AS.spriteIndex(AS.SPECIES.BUNNY, AS.SEX.MALE, AS.STAGE.ADULT, 0, AS.SPRITE_FRAME.STAND),
    wolves: AS.spriteIndex(AS.SPECIES.WOLF, AS.SEX.MALE, AS.STAGE.ADULT, 0, AS.SPRITE_FRAME.STAND),
    humans: AS.spriteIndex(AS.SPECIES.HUMAN, AS.SEX.MALE, AS.STAGE.ADULT, 0, AS.SPRITE_FRAME.STAND),
    blades: AS.spriteGrass(2),
    corpses: AS.spriteSkull(AS.SPECIES.BUNNY),
    water: AS.spriteWater(0, 0, 0),
    nuke: AS.spriteNuke(),
    fires: AS.spriteFlame(),
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
  graph = AS.Graph(T, {
    // A legend click gives a quick look: rings that ease in and fade out (render.js). Info's
    // counts stay the toggles for a long look. Guarded so the page works before the renderer has it.
    onPulse: kind => { if (typeof renderer.pulseLocate === 'function') renderer.pulseLocate(kind, performance.now()); },
  });
  minimap = AS.Minimap(cam, canvas, renderer);
  graph.setIcons({ grass: drawIcon('blades', document.createElement('canvas')),
    bunnies: drawIcon('bunnies', document.createElement('canvas')),
    wolves: drawIcon('wolves', document.createElement('canvas')),
    humans: drawIcon('humans', document.createElement('canvas')) });

  // A tap picks an animal by where its sprite is drawn: mid-step it's between the tile it
  // left and the one it already occupies, and people tap what they see. Blades and
  // corpses don't move, so they're picked by tile.
  cam.attach((tx, ty, fx, fy) => {
    const W = sim.W;
    if (nukeOn) { if (tx >= 0) app.nukeAt(tx, ty); return; }
    if (brush) { if (tx >= 0) app.paintAt(tx, ty); return; }
    if (tx >= 0 && tool.startsWith('corpse-')) {
      AS.debugDropCorpse(sim, W.tile(tx, ty), AS.SPECIES_KEY.indexOf(tool.slice('corpse-'.length)));
      return;
    }
    // Off: nothing is picked. Hover still picks on a tap, so a touch screen (no hover) works.
    sel = inspectMode === 'off' ? null : pickAt(W, tx, ty, fx, fy);
  }, (x0, y0, x1, y1) => { if (brush) app.paintLine(x0, y0, x1, y1); });

  // What a tap or the pointer at (tx, ty) picks: the animal drawn nearest (fx, fy) in tiles,
  // else the blade, corpse, water or bare hole on the tile; null for nothing.
  function pickAt(W, tx, ty, fx, fy) {
    const s = animalDrawnNear(W, fx, fy);
    if (s >= 0) return { tile: W.aTile[s], serial: W.aSerial[s], slot: s };
    if (tx < 0) return null;
    const t = W.tile(tx, ty), k = W.kind[t];
    // A hole with nothing on it is selectable too (it has no serial, so `hole` marks it).
    const bareHole = k === AS.KIND.EMPTY && W.hole[t] === 1;
    // Water has no serial (0) and never changes, so its selection simply stays.
    if (k === AS.KIND.GRASS || k === AS.KIND.CORPSE || W.isOpenWater(t) || bareHole) return { tile: t, serial: W.serial[t], slot: -1, hole: bareHole };
    // Inspect Empty Tiles: bare ground is picked as the tile itself (its properties only).
    return inspectEmpty ? { tile: t, serial: 0, slot: -1, empty: true } : null;
  }

  // Hover mode: a mouse over the map (no button held) picks what is under it. The pick runs
  // in the frame, at most once per frame, and only after the mouse has moved; what it picked
  // stays picked (and followed) until the mouse moves again or leaves the map.
  let hoverAt = null;
  canvas.addEventListener('pointermove', e => {
    if (inspectMode !== 'hover' || e.pointerType !== 'mouse' || e.buttons) return;
    const r = canvas.getBoundingClientRect();
    hoverAt = cam.screenToTile(e.clientX - r.left, e.clientY - r.top);
  });
  canvas.addEventListener('pointerleave', e => {
    if (inspectMode === 'hover' && e.pointerType === 'mouse') { hoverAt = null; sel = null; }
  });
  function applyHover() {
    if (!hoverAt || inspectMode !== 'hover' || nukeOn || brush) return;
    const W = sim.W, tx = Math.floor(hoverAt.x), ty = Math.floor(hoverAt.y);
    const inside = tx >= 0 && ty >= 0 && tx < W.w && ty < W.h;
    sel = pickAt(W, inside ? tx : -1, inside ? ty : -1, hoverAt.x, hoverAt.y);
    hoverAt = null;
  }

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
    if (sel.empty) return sel;   // a tile stays picked whatever comes to stand or grow on it
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
    if (interval >= FRAME_MIN_MS && interval <= FRAME_MAX_MS) frameMs += (interval - frameMs) * FRAME_EASE;
    const budget = Math.max(TICK_BUDGET_MS, frameMs - drawMs - FRAME_SLACK_MS);
    const t0 = performance.now();

    if (speed === Infinity) {
      do sim.tick(); while (performance.now() - t0 < budget);
      acc = 0;
    } else if (speed > 0) {
      acc += realDt * speed;
      while (acc >= AS.DT) {
        if (performance.now() - t0 >= budget) { acc = Math.min(acc, AS.DT); break; }
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
    applyHover();
    const live = liveSelection();
    renderer.setIntentLines(linesOn);
    renderer.setContours(elevOn);
    if (contourStep) renderer.setContourStep(contourStep);
    // Pips stay below the HUD bar, which covers the canvas's top.
    let top = 0;
    if (located.size && !document.body.classList.contains('ui-off')) { const hud = document.getElementById('hud'); if (hud) top = hud.getBoundingClientRect().bottom; }
    renderer.locate(located, top);
    if (radiusReq) { renderer.radiusPreview(radiusReq.r, radiusReq.nuke, now); radiusReq = null; }
    renderer.draw(sim, cam, sheet, live, alpha, now, speed);
    const shown = live ? live.serial : 0;
    if (shown !== inspected || now - inspectedAt >= INSPECT_EVERY_MS) {
      ui.inspector(AS.describe(sim, live));
      inspected = shown;
      inspectedAt = now;
    }
    graph.draw(sim, now);
    minimap.draw(sim, located, now);
    const W = sim.W;
    ui.hud({
      speedIndex, achieved, day: sim.day, seed: sim.seed, wind: sim.wind, weather: sim.weather, mapW: sim.W.w, mapH: sim.W.h,
      humansSeen: humansSeen || (humansSeen = W.humans > 0),
      firesSeen: firesSeen || (firesSeen = W.fCount > 0),
      counts: { bunnies: W.bunnies, wolves: W.wolves, humans: W.humans, total: W.bunnies + W.wolves + W.humans, blades: W.gCount + W.sunkCount, corpses: W.cCount, fires: W.fCount },
    });
    // CPU time only: the browser's own compositing shows up in `interval`, not here.
    const drewMs = performance.now() - t1;
    drawMs += (drewMs - drawMs) * FRAME_EASE;
    if (app.onFrame) {
      app.onFrame(interval, tickMs, drewMs, sim.tickCount - ticksBefore);
    }
    requestAnimationFrame(frame);
  }
  // For the console, the benchmark and test harnesses.
  //   app.load(sim)     swaps in another world (the benchmark's); the camera re-centers on it
  //   app.nukeAt(x, y)  a nuke on that tile (what a tap does in NUKE MODE)
  //   app.paintAt(x, y), app.paintLine(x0, y0, x1, y1)   the brush of GRASS/RABBIT/WOLF/HUMAN MODE
  //   app.animalLimit   the animal total painting may reach before it asks (AnimalWarnAt, doubled by each Keep adding)
  //   app.onFrame       null, or fn(intervalMs, tickMs, drawMs, ticks) after every frame
  // A run ends the moment a species dies out (Paul): the sim pauses and says which. Keep
  // watching resumes without asking again about the species already gone. A species a
  // world starts without (the benchmark's grass-only worlds) never counts as dying out.
  // Humans are optional (only painted in), so their dying out never ends a run: not listed.
  const EXTINCT = [['wolves', 'WOLVES EXTINCT'], ['bunnies', 'BUNNIES EXTINCT'], ['grass', 'GRASS EXTINCT']];
  // Sunk blades (under water, alive until DrownHours) count: a flood that drains leaves them
  // standing again, so leaving them out drew a deep valley that wasn't grass dying.
  const counts = W => ({ wolves: W.wolves, bunnies: W.bunnies, grass: W.gCount + W.sunkCount });
  let gone = new Set(), absent = new Set(), runSpeed = speedIndex;
  // Whether this world has had a human (they're optional; the Info count hides until then).
  let humansSeen = false;
  // Likewise for fire: the Info count shows once this world has had a burning tile.
  let firesSeen = false;
  function resetEnded() {
    const n = counts(sim.W);
    humansSeen = false;
    firesSeen = false;
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
      onNew() { ui.ended(null); makeWorld(T.world.Seed ?? AS.newSeed()).then(w => { app.load(w); setSpeed(runSpeed); }); },
      onContinue() { ui.ended(null); setSpeed(runSpeed); },
    });
  }

  // The soft limit on painting animals (AnimalWarnAt): painting that would pass it places what
  // fits, stops, and asks. Keep adding doubles the limit; Stop here leaves it, so the next
  // paint asks again. The sim runs on behind the card. Births never ask, only painting.
  let crowdOpen = false;
  function askCrowd() {
    crowdOpen = true;
    ui.crowd({
      limit: app.animalLimit,
      onKeep() { app.animalLimit *= 2; crowdOpen = false; ui.crowd(null); },
      onStop() { crowdOpen = false; ui.crowd(null); },
    });
  }

  const app = AS.app = {
    T, cam, renderer, sheet, ui, graph, setSpeed, onFrame: null,
    get sim() { return sim; },
    get sel() { return sel; },
    get speedIndex() { return speedIndex; },
    // Drops a nuke on tile (tx, ty): the sim side (paint.js) and the explosion drawn over it.
    nukeAt(tx, ty) {
      const r = radiusOf('nuke');
      const out = AS.nuke(sim, sim.W.tile(tx, ty), r);
      renderer.blast(tx, ty, Math.max(r, 0.5), performance.now());   // a 0 radius still shows a tile-sized ring
      return out;
    },
    // A brush dab: the armed kind on every eligible tile within that mode's Radius of tile
    // (tx, ty). Animals stop at the soft limit (animalLimit): the dab places what fits and asks.
    paintAt(tx, ty) {
      if (!brush || tx < 0 || ty < 0 || tx >= sim.W.w || ty >= sim.W.h) return 0;
      const r = radiusOf(brush);
      if (brush === 'grass' || brush === 'water' || brush === 'fire') return AS.paintCircle(sim, brush, tx, ty, r);
      if (crowdOpen) return 0;   // the card is up: the stroke stays stopped until it is answered
      const W = sim.W, cap = { room: app.animalLimit - (W.bunnies + W.wolves + W.humans), hit: false };
      const placed = AS.paintCircle(sim, brush, tx, ty, r, cap);
      if (cap.hit) askCrowd();
      return placed;
    },
    // A brush stroke between two pointer samples (world tiles, fractions kept): a dab every
    // BRUSH_STEP tiles along the segment, so a fast drag leaves no gaps.
    paintLine(x0, y0, x1, y1) {
      const step = brush ? Math.max(BRUSH_STEP, radiusOf(brush) / 2) : BRUSH_STEP;
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
      let placed = 0;
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        placed += app.paintAt(Math.floor(x0 + (x1 - x0) * f), Math.floor(y0 + (y1 - y0) * f));
        if (crowdOpen) break;   // the limit stopped the stroke
      }
      return placed;
    },
    animalLimit: T.world.AnimalWarnAt,
    load(next) {
      sim = next;
      app.animalLimit = T.world.AnimalWarnAt;   // a new world starts with the first limit again
      ui.crowd(null); crowdOpen = false;
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
