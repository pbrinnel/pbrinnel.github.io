// The HUD over the map, and the page that replaces the sim when the tables are bad.
//
// The bar is always visible: speed buttons, the day, three tab buttons (Info, Debug, God)
// and Hide UI. A tab opens a strip under the bar with its controls; the open tab's button
// closes it again, and one tab is open at a time. Hide UI hides the bar, strip, graph window
// and inspector (CSS, `ui-off` on <body>) and leaves a faint button in the corner.
//
// AS.UI({ debug, speeds, onSpeed(i), onDebugTool(mode), onBench(), onGraph(),
//         lines (initial on/off), onLines(on),
//         tab (initial: 'info' | 'debug' | 'god' | null for closed; default 'info'), onTab(name | null),
//         onNuke(on) }) → ui
//   ui.hud({ speedIndex, achieved, day, seed, counts: { bunnies, wolves, blades, corpses } })
//   ui.tab, ui.setTab(name | null)   the open tab
//   ui.hidden, ui.setHidden(on)      Hide UI (the H key toggles it; never remembered across loads)
//   ui.nuke, ui.setNuke(on)          NUKE MODE armed (main.js reads it through onNuke)
//   ui.mode, ui.setMode(name)        the God tab's one armed mode: 'nuke', 'grass', 'bunny', 'wolf' or ''
//                                    (onMode(name) on every change; onNuke(on) when nuke flips)
//   ui.errors(errors, warnings)   the sim didn't start; show why
//   ui.warnings(warnings)         the sim started; say quietly what the CSVs have extra
//   ui.lock(on)                   true: speed buttons, Benchmark, Graph, debug tools and keys do nothing
//   ui.setIcons(draw)             swaps the count letters for sprite icons: draw(key, canvas)
//                                 paints the icon for 'bunnies', 'wolves', 'blades' or 'corpses'
//   ui.ended(info)                the run is over: info = { titles: ['WOLVES EXTINCT', …], day,
//                                 onNew(), onContinue() }; null hides it
//   ui.inspector(desc)            null hides the panel; else { title, rows: [{ name, value, range, tip }] }
//                                 (opts.onCloseInspector() runs when the × is pressed)
//
// hud() runs every animation frame, so every write to the DOM goes through a cache that
// skips it when the displayed value hasn't changed.
(function (AS) {
  'use strict';

  // "running 14×" is shown once the sim falls below this share of the chosen speed.
  const BEHIND_SHARE = 0.9;
  // Figures below this get one decimal ("2.5×"); above it, whole numbers ("312×").
  const DECIMAL_BELOW = 10;
  const NUMBER_KEYS = '123456';
  // The speed Space resumes to when nothing has been chosen yet.
  const FALLBACK_RUN_INDEX = 1;
  const DEBUG_TOOLS = [
    ['select', 'Select', 'Click to inspect'],
    ['corpse-bunny', 'Drop bunny body', 'Click a tile to drop a bunny corpse'],
    ['corpse-wolf', 'Drop wolf body', 'Click a tile to drop a wolf corpse'],
  ];
  // Counts in HUD order: a stand-in label (empty: the sprite icon replaces it once the sheet
  // exists, see setIcons), key in the counts object, tooltip.
  // The tabs, in bar order: key, label, tooltip.
  const TABS = [
    ['info', 'Info', 'Live counts and the population graph'],
    ['debug', 'Debug', 'Lines, Benchmark and the seed'],
    ['god', 'God', 'Powers over the world'],
  ];
  const COUNTS = [
    ['', 'bunnies', 'bunnies'],
    ['', 'wolves', 'wolves'],
    ['', 'blades', 'blades of grass'],
    ['', 'corpses', 'corpses'],
  ];

  const fmtInt = n => Math.round(n).toLocaleString('en-US');
  const fmtMult = x => (x < DECIMAL_BELOW ? String(Math.round(x * 10) / 10) : fmtInt(x)) + '×';

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // A text node whose content is only rewritten when it changes.
  function cachedText(node) {
    let last = node.textContent;
    return s => { if (s !== last) { last = s; node.textContent = s; } };
  }

  AS.UI = function (opts) {
    const { debug, speeds, onSpeed, onDebugTool, onCloseInspector, onBench, onGraph, onLines, onTab, onNuke, onMode } = opts;
    const hudEl = document.getElementById('hud');
    const errorsEl = document.getElementById('errors');
    const inspEl = document.getElementById('inspector');
    const graphEl = document.getElementById('graph');

    let current = -1;     // the speed index last chosen here or reported by hud(); Space toggles from it
    let shown = -1;       // the speed index whose button is highlighted; only hud() moves it
    let lastRunning = -1; // the last non-pause index, for Space
    let locked = false;   // the benchmark is running: nothing here changes the sim

    // ---- bar ----
    const top = el('div', 'hud-top');
    const strip = el('div', 'hud-strip');
    const speedBox = el('div', 'hud-speeds');
    const buttons = speeds.map((s, i) => {
      const label = s === 0 ? 'Pause' : s === Infinity ? 'Max' : s + '×';
      const b = el('button', 'hud-btn', label);
      b.type = 'button';
      b.addEventListener('click', () => { choose(i); b.blur(); });
      speedBox.appendChild(b);
      return b;
    });
    const status = el('span', 'hud-status', '');
    const dayEl = el('span', 'hud-day', '');
    const tabBox = el('div', 'hud-tabs');
    const tabBtns = {}, tabPanels = {};
    const tabStrip = el('div', 'hud-tabstrip');
    tabStrip.hidden = true;
    for (const [key, label, tip] of TABS) {
      const b = el('button', 'hud-btn hud-tab', label);
      b.type = 'button';
      b.title = tip;
      b.addEventListener('click', () => { setTab(openTab === key ? null : key); b.blur(); });
      tabBox.appendChild(b);
      tabBtns[key] = b;
      const panel = el('div', 'hud-panel hud-panel-' + key);
      panel.hidden = true;
      tabPanels[key] = panel;
      tabStrip.appendChild(panel);
    }
    const hideBtn = el('button', 'hud-btn hud-hide', 'Hide UI');
    hideBtn.type = 'button';
    hideBtn.title = 'Hide everything but the world (H brings it back)';
    hideBtn.addEventListener('click', () => { setHidden(true); hideBtn.blur(); });
    // The behind-speed note comes after the tabs, so its coming and going moves nothing.
    strip.append(speedBox, dayEl, tabBox, status, hideBtn);

    // The small faint button that brings the UI back; CSS shows it only while hidden.
    const showBtn = el('button', 'hud-show', 'Show UI');
    showBtn.type = 'button';
    showBtn.title = 'Show the UI (H)';
    showBtn.addEventListener('click', () => { setHidden(false); showBtn.blur(); });
    if (document.body) document.body.appendChild(showBtn);

    // ---- Info tab ----
    const countsBox = el('span', 'hud-counts');
    const countEls = {}, glyphEls = {};
    for (const [glyph, key, tip] of COUNTS) {
      const c = el('span', 'hud-count');
      c.title = tip;
      glyphEls[key] = c.appendChild(el('span', 'hud-glyph', glyph));
      countEls[key] = el('span', `hud-num hud-num-${key}`, '');
      c.appendChild(countEls[key]);
      countsBox.appendChild(c);
    }
    tabPanels.info.appendChild(countsBox);

    // The window closes itself too (its ×), so the button reads the window's state in hud().
    let graphBtn = null;
    if (onGraph) {
      graphBtn = el('button', 'hud-bench hud-graph', 'Graph');
      graphBtn.type = 'button';
      graphBtn.title = 'Population over the whole run';
      graphBtn.addEventListener('click', () => { if (!locked) onGraph(); graphBtn.blur(); });
      tabPanels.info.appendChild(graphBtn);
    }

    // ---- Debug tab ----
    // Unlike Graph, the Lines button owns its state: nothing else changes it.
    let linesBtn = null;
    if (onLines) {
      let linesOn = !!opts.lines;
      linesBtn = el('button', 'hud-bench hud-lines', 'Lines');
      linesBtn.type = 'button';
      linesBtn.title = 'Show every animal\'s line to what it is after (the selected animal\'s always shows)';
      linesBtn.classList.toggle('on', linesOn);
      linesBtn.addEventListener('click', () => {
        if (!locked) { linesOn = !linesOn; linesBtn.classList.toggle('on', linesOn); onLines(linesOn); }
        linesBtn.blur();
      });
      tabPanels.debug.appendChild(linesBtn);
    }
    let benchBtn = null;
    if (onBench) {
      benchBtn = el('button', 'hud-bench', 'Benchmark');
      benchBtn.type = 'button';
      benchBtn.title = 'Measure how large a world this device keeps smooth';
      benchBtn.addEventListener('click', () => { if (!locked) onBench(); benchBtn.blur(); });
      tabPanels.debug.appendChild(benchBtn);
    }
    const seedBox = el('span', 'hud-seed');
    seedBox.title = 'Paste into Seed in tables/settings.csv to replay this start';
    const seedNum = el('span', 'hud-seednum', '');
    seedBox.append('Seed ', seedNum);
    tabPanels.debug.appendChild(seedBox);

    const warnBtn = el('button', 'hud-warn', '');
    warnBtn.type = 'button';
    warnBtn.hidden = true;
    const warnList = el('ul', 'hud-warnlist');
    warnList.hidden = true;
    warnBtn.addEventListener('click', () => { warnList.hidden = !warnList.hidden; warnBtn.blur(); });
    tabPanels.debug.appendChild(warnBtn);

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
      tabPanels.debug.appendChild(tools);
    }

    // ---- God tab ----
    // One mode at a time: 'nuke', or a brush ('grass', 'bunny', 'wolf'), or '' for none.
    // Armed until toggled off, so repeated nukes and strokes work; main.js turns a tap (or a
    // drag, for a brush) on the world into that mode's action while it is on.
    let mode = '';
    const MODES = [
      ['nuke', 'NUKE MODE', 'hud-nuke', 'While on, tapping the world drops a nuke there'],
      ['grass', 'GRASS MODE', 'hud-brush', 'While on, tap or drag to plant grass of random ages on empty ground'],
      ['bunny', 'RABBIT MODE', 'hud-brush', 'While on, tap or drag to add rabbits of random ages on empty ground'],
      ['wolf', 'WOLF MODE', 'hud-brush', 'While on, tap or drag to add wolves of random ages on empty ground'],
    ];
    const modeBtns = {};
    for (const [name, label, cls, tip] of MODES) {
      const b = el('button', 'hud-bench ' + cls, label);
      b.type = 'button';
      b.title = tip;
      b.addEventListener('click', () => { if (!locked) setMode(mode === name ? '' : name); b.blur(); });
      tabPanels.god.appendChild(b);
      modeBtns[name] = b;
    }
    const nukeBtn = modeBtns.nuke;
    function setMode(next) {
      next = modeBtns[next] ? next : '';
      if (next === mode) return;
      const prev = mode;
      mode = next;
      for (const [name, b] of Object.entries(modeBtns)) b.classList.toggle('on', name === mode);
      if (document.body) {
        document.body.classList.toggle('nuke-armed', mode === 'nuke');
        document.body.classList.toggle('paint-armed', mode !== '' && mode !== 'nuke');
      }
      if (onNuke && (prev === 'nuke' || mode === 'nuke')) onNuke(mode === 'nuke');
      if (onMode) onMode(mode);
    }
    const setNuke = on => setMode(on ? 'nuke' : (mode === 'nuke' ? '' : mode));

    top.append(strip, tabStrip);
    hudEl.append(top, warnList);
    // Taps on the HUD belong to the HUD, not to the map under it.
    for (const t of ['pointerdown', 'pointerup', 'wheel']) {
      top.addEventListener(t, e => e.stopPropagation());
      warnList.addEventListener(t, e => e.stopPropagation());
    }

    let openTab = null, quiet = false;
    function setTab(name) {
      if (name !== null && !tabPanels[name]) name = null;
      if (name === openTab) return;
      openTab = name;
      for (const [key] of TABS) {
        tabPanels[key].hidden = key !== name;
        tabBtns[key].classList.toggle('on', key === name);
      }
      tabStrip.hidden = name === null;
      if (onTab && !quiet) onTab(name);
    }
    // The first tab is set quietly: onTab is for the viewer's changes (main.js remembers them).
    quiet = true;
    setTab(opts.tab === undefined ? 'info' : opts.tab);
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
    const setStatus = cachedText(status);
    const setDay = cachedText(dayEl);
    const setSeed = cachedText(seedNum);
    const setCount = {};
    for (const [, key] of COUNTS) setCount[key] = cachedText(countEls[key]);

    let graphOn = false;
    function hud(s) {
      if (graphBtn && graphEl) {
        const on = !graphEl.hidden;
        if (on !== graphOn) { graphOn = on; graphBtn.classList.toggle('on', on); }
      }
      if (s.speedIndex !== shown) {
        buttons.forEach((b, i) => b.classList.toggle('on', i === s.speedIndex));
        shown = s.speedIndex;
        current = s.speedIndex;
        if (speeds[current] !== 0) lastRunning = current;
      }
      const speed = speeds[s.speedIndex];
      let st = '';
      if (speed === Infinity) st = s.achieved > 0 ? `Max (${fmtMult(s.achieved)})` : '';
      else if (speed > 0 && s.achieved < speed * BEHIND_SHARE) st = `running ${fmtMult(s.achieved)}`;
      setStatus(st);
      setDay('Day ' + s.day.toFixed(1));
      for (const [, key] of COUNTS) setCount[key](fmtInt(s.counts[key]));
      setSeed(String(s.seed));
    }

    function warnings(list) {
      warnList.textContent = '';
      for (const w of list) warnList.appendChild(el('li', '', w));
      warnBtn.textContent = list.length === 1 ? '1 table warning' : `${list.length} table warnings`;
      warnBtn.hidden = list.length === 0;
      if (!list.length) warnList.hidden = true;
    }

    // ---- inspector ----
    // Built once; live calls only rewrite the values that changed. The rows are rebuilt
    // only when the set of names changes (a different kind of thing was selected).
    const inspHead = el('div', 'insp-head');
    const inspTitle = el('span', 'insp-title', '');
    const inspClose = el('button', 'hud-btn insp-close', '×');
    inspClose.type = 'button';
    inspClose.title = 'Close';
    inspClose.addEventListener('click', () => { inspector(null); if (onCloseInspector) onCloseInspector(); });
    inspHead.append(inspTitle, inspClose);
    const inspList = el('div', 'insp-list');
    inspEl.append(inspHead, inspList);
    for (const t of ['pointerdown', 'pointerup', 'wheel']) inspEl.addEventListener(t, e => e.stopPropagation());

    const setInspTitle = cachedText(inspTitle);
    let rowKey = '';
    let rowEls = [];   // { row, value, range, setValue, setRange, tip }
    let panelTop = -1;

    // The panel starts under the bar and tab strip, whose height changes as contents wrap.
    function placeInspector() {
      const h = top.offsetHeight;
      if (h !== undefined && h !== panelTop) { panelTop = h; inspEl.style.setProperty('--hud-bottom', h + 'px'); }
    }
    if (typeof ResizeObserver === 'function') new ResizeObserver(placeInspector).observe(top);

    function inspector(desc) {
      if (!desc) { if (!inspEl.hidden) inspEl.hidden = true; return; }
      if (inspEl.hidden) inspEl.hidden = false;
      placeInspector();
      setInspTitle(desc.title);
      const rows = desc.rows;
      const key = rows.map(r => r.name).join('\n');
      if (key !== rowKey) {
        rowKey = key;
        inspList.textContent = '';
        rowEls = rows.map(r => {
          const row = el('div', 'insp-row');
          const val = el('span', 'insp-value', '');
          const range = el('span', 'insp-range', '');
          const cell = el('span', 'insp-cell');
          cell.append(val, range);
          row.append(el('span', 'insp-name', r.name), cell);
          inspList.appendChild(row);
          return { row, setValue: cachedText(val), setRange: cachedText(range), tip: row.title };
        });
      }
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i], e = rowEls[i], tip = r.tip || '';
        e.setValue(String(r.value));
        e.setRange(r.range ? String(r.range) : '');
        if (tip !== e.tip) { e.tip = tip; e.row.title = tip; }
      }
    }

    // opts { title, intro, foot } replace the table-problem wording, for failures that
    // aren't about the CSVs' contents (e.g. the page opened from disk).
    function errors(errs, warns, opts) {
      const o = opts || {};
      hudEl.hidden = true;
      errorsEl.textContent = '';
      const page = el('div', 'err-page');
      page.appendChild(el('h1', '', o.title || 'The tables have problems'));
      page.appendChild(el('p', '', o.intro || 'The sim did not start. Each line names the file, row and column.'));
      const ul = el('ul', 'err-list');
      for (const m of errs) ul.appendChild(el('li', '', m));
      page.appendChild(ul);
      if (warns && warns.length) {
        page.appendChild(el('h2', '', 'Warnings'));
        const wl = el('ul', 'err-list err-warns');
        for (const m of warns) wl.appendChild(el('li', '', m));
        page.appendChild(wl);
      }
      page.appendChild(el('p', 'err-foot', o.foot || 'Fix the CSVs in tables/ and reload the page.'));
      errorsEl.appendChild(page);
      errorsEl.hidden = false;
    }

    // Disabling the buttons also dims them; the handlers check `locked` as well.
    function lock(on) {
      locked = !!on;
      for (const b of [...buttons, benchBtn, graphBtn, linesBtn, ...Object.values(modeBtns), ...toolButtons]) {
        if (b) b.disabled = locked;
      }
    }

    // The letters stand in until the sprite sheet exists (it needs the tables); then each
    // becomes a small canvas with the same sprite the world draws.
    function setIcons(draw) {
      for (const [, key] of COUNTS) {
        const cv = document.createElement('canvas');
        cv.className = 'hud-icon';
        cv.setAttribute('aria-hidden', 'true');
        draw(key, cv);
        glyphEls[key].replaceWith(cv);
        glyphEls[key] = cv;
      }
    }

    // End of a run: a card over the world naming what died out, with a way to start a new
    // world or keep watching what's left.
    let endEl = null;
    function ended(info) {
      if (endEl) { endEl.remove(); endEl = null; }
      if (!info) return;
      endEl = el('div', 'end-card');
      endEl.setAttribute('role', 'dialog');
      for (const t of info.titles) endEl.appendChild(el('div', 'end-title', t));
      endEl.appendChild(el('div', 'end-day', `Day ${info.day.toFixed(1)}`));
      const row = el('div', 'end-buttons');
      const again = el('button', 'hud-bench', 'New world');
      again.type = 'button';
      again.addEventListener('click', () => info.onNew());
      const watch = el('button', 'hud-bench', 'Keep watching');
      watch.type = 'button';
      watch.addEventListener('click', () => info.onContinue());
      row.appendChild(again);
      row.appendChild(watch);
      endEl.appendChild(row);
      document.body.appendChild(endEl);
    }

    return {
      hud, errors, warnings, inspector, lock, setTab, setHidden, setNuke, setMode, ended, setIcons,
      get tab() { return openTab; },
      get hidden() { return uiHidden; },
      get nuke() { return mode === 'nuke'; },
      get mode() { return mode; },
    };
  };
})(globalThis.AS);
