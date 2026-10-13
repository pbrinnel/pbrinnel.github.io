// The HUD over the map: the bar, the tab windows and their controls, the keys, and hud(),
// which shows the speed, day and counts every frame. Some parts are their own files, handed
// on through ui: the PAINT tab's controls (paint-tab.js), the properties window
// (properties.js), and the cards and error page (cards.js).
//
// The bar is always visible: speed buttons, the day, the tab buttons (Info, PAINT, and Debug
// with ?debug) and Hide UI. Each tab button opens and closes its own window, any of them at
// once. Hide UI hides the bar, the windows, the graph and the properties window (CSS,
// `ui-off` on <body>) and leaves a faint button in the corner.
//
// AS.UI({ debug, speeds, onSpeed(i), onDebugTool(mode), onBench(), onGraph(), onMinimap(),
//         lines (initial on/off), onLines(on), water (initial on/off), onWater(on),
//         elevation (initial on/off), onElevation(on): the topo lines, contourStep (m), onContourStep(m),
//         inspect ('off' | 'click' | 'hover'), onInspect(mode): the properties window,
//         inspectEmpty (initial on/off), onInspectEmpty(on): bare tiles can be picked,
//         onRadius(mode, tiles): the Radius slider moved (for the preview),
//         windows (the tab windows open at first: keys of 'info', 'paint', 'debug'; default ['info']),
//         onWindows(keys): the open ones, after the viewer opens or closes one,
//         onNuke(on), onLocate(key, on): a count's ring toggle ('bunnies', 'wolves', 'humans', 'blades', 'corpses', 'fires') }) → ui
//   ui.hud({ speedIndex, achieved, day, seed, humansSeen, firesSeen, counts: { bunnies, wolves, humans, total, blades, corpses, fires } })
//                                 (humansSeen: this world has had a human, so their count shows; firesSeen: likewise a fire)
//     optional wind: { from (radians, the bearing it blows from), kmh }: the Info window's Wind row, an arrow
//     the way it blows and words ("breeze, 14 km/h from the west"); without it the row stays hidden
//   ui.windows, ui.setWindow(key, on)  the tab windows open (each tab button toggles its own;
//                                    closing PAINT disarms its mode)
//   ui.hidden, ui.setHidden(on)      Hide UI (the H key toggles it; never remembered across loads)
//   ui.nuke, ui.setNuke(on)          NUKE MODE armed (main.js reads it through onNuke)
//   ui.mode, ui.setMode(name)        the PAINT tab's one armed mode: 'nuke', 'grass', 'bunny', 'wolf', 'human', 'water', 'fire' or ''
//                                    (onMode(name) on every change; onNuke(on) when nuke flips)
//   ui.setRadiusDefaults(nuke, brush)  the Radius slider's starting values (settings.csv); a radius the
//                                    viewer chose earlier (kept per mode in localStorage) wins. Called once the tables load.
//   ui.radiusOf(mode)                the radius in tiles that mode will use now (the slider's value for the armed mode)
//   ui.setRadius(mode, r)            sets and keeps a mode's radius, as the slider does
//   ui.crowd(info)                   the "That's a crowd" card: info = { limit, onKeep(), onStop() }; null hides it
//   ui.errors(errors, warnings)   the sim didn't start; show why
//   ui.warnings(warnings)         the sim started; say quietly what the CSVs have extra
//   ui.lock(on)                   true: speed buttons, Benchmark, Graph, debug tools and keys do nothing
//   ui.setIcons(draw)             swaps the count letters for sprite icons: draw(key, canvas)
//                                 paints the icon for 'bunnies', 'wolves', 'humans', 'blades', 'corpses', 'fires' or the paint modes
//   ui.ended(info)                the run is over: info = { titles: ['WOLVES EXTINCT', …], day,
//                                 onNew(), onContinue() }; null hides it
//   ui.inspector(desc)            null hides the panel; else { title, rows: [{ name, value, range, tip }] }
//                                 (opts.onCloseInspector() runs when the × is pressed)
//
// hud() runs every animation frame, so every write to the DOM goes through a cache that
// skips it when the displayed value hasn't changed.
(function (AS) {
  'use strict';

  // The Wind row's arrow points up (north) at rest; CSS rotates it to the way the wind blows.
  const WIND_ARROW = '<svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden="true"><path d="M0 -8 L5 4 L0 1 L-5 4 Z" fill="currentColor"/></svg>';
  // Figures below this get one decimal ("2.5×"); above it, whole numbers ("312×").
  const DECIMAL_BELOW = 10;
  const NUMBER_KEYS = '123456';
  // The speed Space resumes to when nothing has been chosen yet.
  const FALLBACK_RUN_INDEX = 1;
  const DEBUG_TOOLS = [
    ['select', 'Select', 'Click to inspect'],
    ...AS.SPECIES_KEY.map(k => ['corpse-' + k, `Drop ${k} body`, `Click a tile to drop a ${k} corpse`]),
  ];
  // A speed's icon: two bars to pause, more play triangles for faster (one per step up to
  // four), a triangle against a bar for Max.
  function speedIcon(s) {
    const tri = (x, w) => `<path d="M${x} 3 L${x + w} 8 L${x} 13 Z" fill="currentColor"/>`;
    if (s === 0) return '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3" width="3" height="10" rx="1" fill="currentColor"/><rect x="9" y="3" width="3" height="10" rx="1" fill="currentColor"/></svg>';
    if (s === Infinity) return `<svg width="18" height="16" viewBox="0 0 18 16" aria-hidden="true">${tri(2, 9)}<rect x="12" y="3" width="3" height="10" rx="1" fill="currentColor"/></svg>`;
    const k = s <= 1 ? 1 : s <= 2 ? 2 : s <= 5 ? 3 : 4, w = [8, 7, 6, 5][k - 1], step = w;
    let paths = ''; for (let i = 0; i < k; i++) paths += tri(2 + i * step, w);
    return `<svg width="${4 + k * step}" height="16" viewBox="0 0 ${4 + k * step} 16" aria-hidden="true">${paths}</svg>`;
  }

  // The tabs, in bar order: key, label, tooltip. Debug is there only with ?debug (Paul,
  // 12 Oct 2026: not needed for now).
  const ALL_TABS = [
    ['info', 'Info', 'Counts, rings on the map, the graph, the minimap, topo and intent lines, and the properties window'],
    ['paint', 'PAINT', 'Paint grass, animals and water, or drop a nuke'],
    ['debug', 'Debug', 'Water, Benchmark, the seed and the debug tools'],
  ];
  // Where each tab window's dragged place is kept, under the names they first had (Info was
  // the side panel, PAINT the God tab), so windows stay where viewers put them.
  const POS_KEYS = { info: 'life-side-pos', paint: 'life-god-pos', debug: 'life-debug-pos' };
  // Counts in HUD order: a label (empty: the sprite icon replaces it once the sheet exists, see
  // setIcons; the total keeps its word), key in the counts object, tooltip.
  const COUNTS = [
    ['', 'bunnies', 'bunnies'],
    ['', 'wolves', 'wolves'],
    ['', 'humans', 'humans'],
    ['Total', 'total', 'all animals together'],
    ['', 'blades', 'blades of grass'],
    ['', 'corpses', 'corpses'],
    ['', 'fires', 'tiles burning'],
  ];

  AS.UI = function (opts) {
    const { debug, speeds, onSpeed, onDebugTool, onCloseInspector, onBench, onGraph, onLines, onWater, onWindows, onNuke, onMode, onLocate, onElevation, onInspect, onInspectEmpty, onMinimap, onContourStep, onRadius } = opts;
    const hudEl = document.getElementById('hud');
    const errorsEl = document.getElementById('errors');
    const inspEl = document.getElementById('inspector');
    const graphEl = document.getElementById('graph');
    const { el, cachedText, fmtInt } = AS.uiParts;
    const fmtMult = x => (x < DECIMAL_BELOW ? String(Math.round(x * 10) / 10) : fmtInt(x)) + '×';

    let current = -1;     // the speed index last chosen here or reported by hud(); Space toggles from it
    let shown = -1;       // the speed index whose button is highlighted; only hud() moves it
    let lastRunning = -1; // the last non-pause index, for Space
    let locked = false;   // the benchmark is running: nothing here changes the sim

    // ---- bar ----
    const top = el('div', 'hud-top');
    const strip = el('div', 'hud-strip');
    // Speeds as small icons (Paul, 12 Oct 2026, option A of five): pause bars, one to four
    // play triangles, a triangle to a bar for Max; the lit one is the speed asked for. Beside
    // them, its name and the speed the sim is really keeping, "5× (4.8×)", "Max (312×)".
    const speedBox = el('div', 'hud-speeds');
    const speedName = el('span', 'hud-speedname', '');
    const speedLabel = s => (s === 0 ? 'Pause' : s === Infinity ? 'Max' : s + '×');
    const buttons = speeds.map((s, i) => {
      const label = speedLabel(s);
      const b = el('button', 'hud-btn hud-speed');
      b.type = 'button';
      b.title = label;
      b.setAttribute('aria-label', label);
      b.innerHTML = speedIcon(s);
      b.addEventListener('click', () => { choose(i); b.blur(); });
      speedBox.appendChild(b);
      return b;
    });
    const dayEl = el('span', 'hud-day', '');
    const tabBox = el('div', 'hud-tabs');
    // Each tab is its own window (Paul, 12 Oct 2026: like the graph and the minimap, toggled
    // on and left open), with a title bar to drag it by on a computer (drag.js); a phone hides
    // the title bar and stacks the open ones under the bar.
    const tabBtns = {}, tabPanels = {}, tabWins = {}, tabHeads = {};
    const TABS = ALL_TABS.filter(([key]) => key !== 'debug' || debug);
    for (const [key, label, tip] of TABS) {
      const b = el('button', 'hud-btn hud-tab', label);
      b.type = 'button';
      b.title = tip;
      b.addEventListener('click', () => { setWindow(key, !openWins.has(key)); b.blur(); });
      tabBox.appendChild(b);
      tabBtns[key] = b;
      const win = el('div', 'hud-tabstrip hud-win-' + key);
      win.hidden = true;
      const head = el('div', 'hud-side-head');
      head.appendChild(el('span', 'hud-side-title', label));
      head.title = 'Drag to move; double-click to put it back';
      const panel = el('div', 'hud-panel hud-panel-' + key);
      win.append(head, panel);
      tabWins[key] = win; tabHeads[key] = head; tabPanels[key] = panel;
    }
    const hideBtn = el('button', 'hud-btn hud-hide', 'Hide UI');
    hideBtn.type = 'button';
    hideBtn.title = 'Hide everything but the world (H brings it back)';
    hideBtn.addEventListener('click', () => { setHidden(true); hideBtn.blur(); });
    // The behind-speed note comes after the tabs, so its coming and going moves nothing.
    strip.append(speedBox, speedName, dayEl, tabBox, hideBtn);

    // The small faint button that brings the UI back; CSS shows it only while hidden.
    const showBtn = el('button', 'hud-show', 'Show UI');
    showBtn.type = 'button';
    showBtn.title = 'Show the UI (H)';
    showBtn.addEventListener('click', () => { setHidden(false); showBtn.blur(); });
    if (document.body) document.body.appendChild(showBtn);

    // Every tab is a stack of labeled rows (Paul, 11 Oct 2026: the tabs keep growing): a row's
    // name, then its controls, wrapping as needed. A new control joins a row or starts one.
    function section(tab, title, tip) {
      const sec = el('div', 'hud-sec hud-sec-' + title.toLowerCase().replace(/[^a-z]+/g, '-'));
      const head = el('span', 'hud-sec-title', title);
      if (tip) head.title = tip;
      const body = el('div', 'hud-sec-body');
      sec.append(head, body);
      tabPanels[tab].appendChild(sec);
      return body;
    }
    const showCounts = section('info', 'Counts', 'Tap a count to ring every one of that kind on the map');
    const showWind = section('info', 'Wind', 'The world\'s wind: where it blows from and how hard');
    const showWindows = section('info', 'Windows');
    const showElev = section('info', 'Map', 'What is drawn over the world');
    const showProps = section('info', 'Properties', 'The properties window: what something is and how it is doing');
    const showTables = section('info', 'Tables');
    const paintModes = section('paint', 'Modes');
    const paintSize = section('paint', 'Size');
    // Without ?debug there is no Debug tab: its controls are built but never shown.
    const offPage = el('div');
    const dbgWorld = tabPanels.debug ? section('debug', 'World') : offPage;
    const dbgTools = tabPanels.debug ? section('debug', 'Tools') : offPage;

    // ---- Info tab (key 'info') ----
    const countsBox = el('span', 'hud-counts');
    const countEls = {}, glyphEls = {}, countBoxes = {};
    for (const [glyph, key, tip] of COUNTS) {
      const c = countBoxes[key] = el('span', 'hud-count');
      c.title = tip;
      // A species or thing's count is also a toggle: on, every one of that kind is ringed on
      // the map, and the count wears the same ring color (AS.LOCATE_COLORS) to say so.
      if (key !== 'total' && onLocate) {
        c.classList.add('hud-locate');
        c.title = 'Ring the ' + tip + ' on the map';
        c.setAttribute('role', 'button');
        c.setAttribute('aria-pressed', 'false');
        c.tabIndex = 0;
        if (AS.LOCATE_COLORS && AS.LOCATE_COLORS[key]) c.style.setProperty('--loc', `rgb(${AS.LOCATE_COLORS[key]})`);
        const toggleLocate = () => {
          if (locked) return;
          const on = !c.classList.contains('on');
          c.classList.toggle('on', on);
          c.setAttribute('aria-pressed', String(on));
          onLocate(key, on);
        };
        c.addEventListener('click', toggleLocate);
        c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleLocate(); } });
      }
      glyphEls[key] = c.appendChild(el('span', 'hud-glyph', glyph));
      countEls[key] = el('span', `hud-num hud-num-${key}`, '');
      c.appendChild(countEls[key]);
      countsBox.appendChild(c);
    }
    showCounts.appendChild(countsBox);

    // The Wind row stays hidden until hud() is given a wind (the checks and older callers have none).
    const windArrow = el('span', 'hud-wind-arrow');
    windArrow.innerHTML = WIND_ARROW;
    const windText = el('span', 'hud-wind-text', '');
    showWind.append(windArrow, windText);
    const windRow = showWind.parentNode;
    windRow.hidden = true;

    // The window closes itself too (its ×), so the button reads the window's state in hud().
    let graphBtn = null;
    if (onGraph) {
      graphBtn = el('button', 'hud-control hud-graph', 'Graph');
      graphBtn.type = 'button';
      graphBtn.title = 'Population over the whole run';
      graphBtn.addEventListener('click', () => { if (!locked) onGraph(); graphBtn.blur(); });
      showWindows.appendChild(graphBtn);
    }

    // Likewise the minimap: its × closes it too, so hud() reads the window's state.
    let miniBtn = null;
    const miniEl = document.getElementById('minimap');
    if (onMinimap) {
      miniBtn = el('button', 'hud-control hud-minimap', 'Minimap');
      miniBtn.type = 'button';
      miniBtn.title = 'The whole world, with a box on what you see: click it to go there';
      miniBtn.addEventListener('click', () => { if (!locked) onMinimap(); miniBtn.blur(); });
      showWindows.appendChild(miniBtn);
    }

    // Unlike Graph, the Lines button owns its state: nothing else changes it.
    let linesBtn = null;
    if (onLines) {
      let linesOn = !!opts.lines;
      linesBtn = el('button', 'hud-control hud-lines', 'Intent lines');
      linesBtn.type = 'button';
      linesBtn.title = 'Show every animal\'s line to what it is after (the selected animal\'s always shows)';
      linesBtn.classList.toggle('on', linesOn);
      linesBtn.addEventListener('click', () => {
        if (!locked) { linesOn = !linesOn; linesBtn.classList.toggle('on', linesOn); onLines(linesOn); }
        linesBtn.blur();
      });
      showElev.appendChild(linesBtn);
    }
    // Topo lines (render.js): every few meters of the ground's height. Kept per viewer.
    let elevBtn = null;
    if (onElevation) {
      let elevOn = !!opts.elevation;
      elevBtn = el('button', 'hud-control hud-elev', 'Topo lines');
      elevBtn.type = 'button';
      elevBtn.title = 'Show topo lines: how high the ground is';
      elevBtn.classList.toggle('on', elevOn);
      elevBtn.addEventListener('click', () => {
        if (!locked) { elevOn = !elevOn; elevBtn.classList.toggle('on', elevOn); onElevation(elevOn); }
        elevBtn.blur();
      });
      showElev.appendChild(elevBtn);
    }
    // How far apart the topo lines are, down to a line every CONTOUR_STEPS[0] m for every
    // little rise. A slider over a few round spacings; kept per viewer by main.js.
    let contourInput = null;
    if (onContourStep) {
      const CONTOUR_STEPS = [0.5, 1, 2, 5, 10, 20];
      const box = el('span', 'hud-slider');
      const label = el('span', 'hud-slider-label', '');
      contourInput = el('input', 'hud-slider-input');
      contourInput.type = 'range';
      contourInput.min = '0';
      contourInput.max = String(CONTOUR_STEPS.length - 1);
      contourInput.step = '1';
      const at = Math.max(0, CONTOUR_STEPS.indexOf(opts.contourStep));
      contourInput.value = String(at < 0 ? 3 : at);
      contourInput.setAttribute('aria-label', 'Meters between topo lines');
      box.title = 'Meters between topo lines (every fifth is bolder)';
      const show = () => { label.textContent = 'a line every ' + CONTOUR_STEPS[+contourInput.value] + ' m'; };
      show();
      contourInput.addEventListener('input', () => { show(); if (!locked) onContourStep(CONTOUR_STEPS[+contourInput.value]); });
      box.append(label, contourInput);
      showElev.appendChild(box);
    }
    // The properties window: Off, Click (select to inspect) or Hover (what is under the
    // mouse). One of three, kept per viewer by main.js.
    const inspBtns = [];
    if (onInspect) {
      const box = el('span', 'hud-insp');
      let mode = opts.inspect || 'click';
      for (const [key, label, tip] of [['off', 'Off', 'No properties window'], ['click', 'Click', 'Click or tap something to see its properties'], ['hover', 'Hover', 'See the properties of what the mouse is over (a tap still picks on a touch screen)']]) {
        const b = el('button', 'hud-control hud-insp-btn', label);
        b.type = 'button';
        b.title = tip;
        b.classList.toggle('on', key === mode);
        b.addEventListener('click', () => {
          if (!locked && key !== mode) {
            mode = key;
            for (const o of inspBtns) o.classList.toggle('on', o === b);
            onInspect(key);
          }
          b.blur();
        });
        inspBtns.push(b);
        box.appendChild(b);
      }
      showProps.appendChild(box);
    }
    // Inspect Empty Tiles: bare ground can be picked too, to see the tile's own properties.
    let emptyBtn = null;
    if (onInspectEmpty) {
      let on = !!opts.inspectEmpty;
      emptyBtn = el('button', 'hud-control hud-insp-empty', 'Inspect Empty Tiles');
      emptyBtn.type = 'button';
      emptyBtn.title = 'Let a click (or hover) on bare ground show that tile: its position, elevation and ground';
      emptyBtn.classList.toggle('on', on);
      emptyBtn.addEventListener('click', () => {
        if (!locked) { on = !on; emptyBtn.classList.toggle('on', on); onInspectEmpty(on); }
        emptyBtn.blur();
      });
      showProps.appendChild(emptyBtn);
    }
    // ---- Debug tab ----
    // Water is laid when a world is built, so a flip starts a new world (main.js's onWater).
    let waterBtn = null;
    if (onWater) {
      let waterOn = !!opts.water;
      waterBtn = el('button', 'hud-control hud-water', 'Water');
      waterBtn.type = 'button';
      waterBtn.title = 'Starts a new world with/without lakes, rivers and thirst';
      waterBtn.classList.toggle('on', waterOn);
      waterBtn.addEventListener('click', () => {
        if (!locked) { waterOn = !waterOn; waterBtn.classList.toggle('on', waterOn); onWater(waterOn); }
        waterBtn.blur();
      });
      dbgWorld.appendChild(waterBtn);
    }
    let benchBtn = null;
    if (onBench) {
      benchBtn = el('button', 'hud-control', 'Benchmark');
      benchBtn.type = 'button';
      benchBtn.title = 'Measure how large a world this device keeps smooth';
      benchBtn.addEventListener('click', () => { if (!locked) onBench(); benchBtn.blur(); });
      dbgTools.appendChild(benchBtn);
    }
    const seedBox = el('span', 'hud-seed');
    seedBox.title = 'Paste into Seed in tables/settings.csv to replay this start';
    const seedNum = el('span', 'hud-seednum', '');
    seedBox.append('Seed ', seedNum);
    dbgWorld.appendChild(seedBox);

    const warnBtn = el('button', 'hud-warn', '');
    warnBtn.type = 'button';
    warnBtn.hidden = true;
    const warnList = el('ul', 'hud-warnlist');
    warnList.hidden = true;
    warnBtn.addEventListener('click', () => { warnList.hidden = !warnList.hidden; warnBtn.blur(); });
    showTables.appendChild(warnBtn);

    const toolButtons = [];
    if (debug) {
      const tools = el('span', 'hud-tools');
      const toolBtns = DEBUG_TOOLS.map(([mode, label, tip]) => {
        const b = el('button', 'hud-btn hud-tool' + (mode === 'select' ? ' on' : ''), label);
        b.type = 'button';
        b.title = tip;
        b.addEventListener('click', () => {
          if (locked) return;
          toolBtns.forEach(o => o.classList.toggle('on', o === b));
          onDebugTool(mode);
          b.blur();
        });
        tools.appendChild(b);
        toolButtons.push(b);
        return b;
      });
      dbgTools.appendChild(tools);
    }

    // ---- PAINT tab ----
    const paint = AS.PaintTab(paintModes, paintSize, { onNuke, onMode, onRadius, isLocked: () => locked });

    top.append(strip, ...Object.values(tabWins));
    // The side panel starts just under the bar, whose height can change (it wraps when narrow).
    const placeSide = () => document.documentElement.style.setProperty('--hud-bar', strip.offsetHeight + 'px');
    if (typeof ResizeObserver === 'function') new ResizeObserver(placeSide).observe(strip);
    hudEl.append(top, warnList);
    // Taps on the HUD belong to the HUD, not to the map under it.
    for (const t of ['pointerdown', 'pointerup', 'wheel']) {
      top.addEventListener(t, e => e.stopPropagation());
      warnList.addEventListener(t, e => e.stopPropagation());
    }

    const openWins = new Set();
    let quiet = false;
    function setWindow(key, on) {
      if (!tabWins[key]) return;
      on = !!on;
      if (on === openWins.has(key)) return;
      if (on) openWins.add(key); else openWins.delete(key);
      tabWins[key].hidden = !on;
      tabBtns[key].classList.toggle('on', on);
      // On a computer Info sits down the left; the graph and minimap step aside (CSS) unless
      // it has been dragged somewhere else.
      if (key === 'info' && document.body) document.body.classList.toggle('side-open', on);
      // A mode works only while its window is open, so a closed PAINT can't paint behind your back.
      if (key === 'paint' && !on) paint.setMode('');
      if (onWindows && !quiet) onWindows([...openWins]);
    }
    // The first windows open quietly: onWindows is for the viewer's changes (main.js keeps them).
    quiet = true;
    for (const key of opts.windows === undefined ? ['info'] : opts.windows) setWindow(key, true);
    quiet = false;

    let uiHidden = false;
    function setHidden(on) {
      on = !!on;
      if (on === uiHidden) return;
      uiHidden = on;
      if (document.body) document.body.classList.toggle('ui-off', on);
    }

    function choose(i) {
      if (locked) return;
      if (speeds[i] !== 0) lastRunning = i;
      current = i;
      onSpeed(i);
    }

    // ---- keys ----
    function typing(t) {
      const tag = t && t.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!(t && t.isContentEditable);
    }
    document.addEventListener('keydown', e => {
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (locked) { if (e.key === ' ') e.preventDefault(); return; }
      if (e.key === 'h' || e.key === 'H') { setHidden(!uiHidden); return; }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (speeds[current] === 0) {
          choose(lastRunning >= 0 ? lastRunning : Math.min(FALLBACK_RUN_INDEX, speeds.length - 1));
        } else {
          choose(speeds.indexOf(0));
        }
      } else {
        const i = NUMBER_KEYS.indexOf(e.key);
        if (i >= 0 && e.key.length === 1 && i < speeds.length) choose(i);
      }
    });
    // A focused button would otherwise also click on Space's key-up.
    document.addEventListener('keyup', e => {
      if (e.key === ' ' && !typing(e.target)) e.preventDefault();
    });

    // ---- hud ----
    const setSpeedName = cachedText(speedName);
    const setDay = cachedText(dayEl);
    const setSeed = cachedText(seedNum);
    const setWindText = cachedText(windText);
    let windDeg = null;   // the arrow's whole-degree angle as last written
    const setCount = {};
    for (const [, key] of COUNTS) setCount[key] = cachedText(countEls[key]);

    let graphOn = false, miniOn = false;
    function hud(s) {
      if (graphBtn && graphEl) {
        const on = !graphEl.hidden;
        if (on !== graphOn) { graphOn = on; graphBtn.classList.toggle('on', on); }
      }
      if (miniBtn && miniEl) {
        const on = !miniEl.hidden;
        if (on !== miniOn) { miniOn = on; miniBtn.classList.toggle('on', on); }
      }
      if (s.speedIndex !== shown) {
        buttons.forEach((b, i) => b.classList.toggle('on', i === s.speedIndex));
        shown = s.speedIndex;
        current = s.speedIndex;
        if (speeds[current] !== 0) lastRunning = current;
      }
      const speed = speeds[s.speedIndex];
      setSpeedName(speed > 0 && s.achieved > 0 ? `${speedLabel(speed)} (${fmtMult(s.achieved)})` : speedLabel(speed));
      setDay('Day ' + s.day.toFixed(1));
      for (const [, key] of COUNTS) setCount[key](fmtInt(s.counts[key]));
      // Humans are optional: their count shows only once this world has had one.
      const showHumans = !!s.humansSeen;
      if (countBoxes.humans.hidden === showHumans) countBoxes.humans.hidden = !showHumans;
      // Fire is the same: the count shows once this world has had a fire.
      const showFires = !!s.firesSeen;
      if (countBoxes.fires.hidden === showFires) countBoxes.fires.hidden = !showFires;
      setSeed(String(s.seed));
      if (s.wind) {
        if (windRow.hidden) windRow.hidden = false;
        const kmh = Math.round(s.wind.kmh), words = AS.windWords(s.wind.kmh);
        setWindText(words === 'calm' ? 'calm' : `${words}, ${kmh} km/h from the ${AS.windFromName(s.wind.from)}`);
        // It blows toward the bearing opposite the one it comes from.
        const deg = (((Math.round(s.wind.from * 180 / Math.PI) + 180) % 360) + 360) % 360;
        if (deg !== windDeg) { windDeg = deg; windArrow.style.transform = `rotate(${deg}deg)`; }
      }
    }

    function warnings(list) {
      warnList.textContent = '';
      for (const w of list) warnList.appendChild(el('li', '', w));
      warnBtn.textContent = list.length === 1 ? '1 table warning' : `${list.length} table warnings`;
      warnBtn.hidden = list.length === 0;
      if (!list.length) warnList.hidden = true;
    }

    // ---- dragging, the properties window, the cards ----
    // The tab windows drag by their title bars, like the graph.
    if (AS.Draggable) {
      for (const key of Object.keys(tabWins)) {
        AS.Draggable(tabWins[key], tabHeads[key], POS_KEYS[key], key === 'info' ? (moved => document.body && document.body.classList.toggle('side-moved', moved)) : undefined);
      }
    }
    const props = AS.PropertiesWindow(inspEl, { below: top, onClose: onCloseInspector });
    const cards = AS.Cards({ hudEl, errorsEl });

    // Disabling the buttons also dims them; the handlers check `locked` as well.
    function lock(on) {
      locked = !!on;
      for (const b of [...buttons, benchBtn, graphBtn, miniBtn, linesBtn, elevBtn, contourInput, ...inspBtns, emptyBtn, waterBtn, ...toolButtons]) {
        if (b) b.disabled = locked;
      }
      paint.lock(locked);
    }

    // The letters and mode names stand in until the sprite sheet exists (it needs the tables);
    // then each becomes a small canvas with the same sprite the world draws.
    function setIcons(draw) {
      const icon = key => {
        const cv = document.createElement('canvas');
        cv.className = 'hud-icon';
        cv.setAttribute('aria-hidden', 'true');
        draw(key, cv);
        return cv;
      };
      for (const [label, key] of COUNTS) {
        if (label) continue;   // the total is a word, not a sprite
        const cv = icon(key);
        glyphEls[key].replaceWith(cv);
        glyphEls[key] = cv;
      }
      paint.setIcons(icon);
    }

    return {
      hud, warnings, lock, setWindow, setHidden, setIcons,
      errors: cards.errors, ended: cards.ended, crowd: cards.crowd,
      inspector: props.show,
      setNuke: paint.setNuke, setMode: paint.setMode,
      setRadiusDefaults: paint.setRadiusDefaults, setRadius: paint.setRadius, radiusOf: paint.radiusOf,
      get windows() { return [...openWins]; },
      get hidden() { return uiHidden; },
      get nuke() { return paint.mode === 'nuke'; },
      get mode() { return paint.mode; },
    };
  };
})(globalThis.AS);
