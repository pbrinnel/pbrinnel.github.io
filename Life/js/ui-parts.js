// Small DOM helpers the page's windows share: ui.js, cards.js, properties.js, paint-tab.js, and
// the graph and minimap (Resizable).
(function (AS) {
  'use strict';

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // A text node whose content is only rewritten when it changes: hud() and the properties
  // window run every frame, and most values stay put.
  function cachedText(node) {
    let last = node.textContent;
    return s => { if (s !== last) { last = s; node.textContent = s; } };
  }

  const fmtInt = n => Math.round(n).toLocaleString('en-US');

  // A grip in a window's bottom-right corner that resizes it (Paul, 12 Oct 2026). Pointer
  // events, so a finger works as a mouse does. The size is kept per window under `key`.
  //
  //   AS.uiParts.Resizable(panel, { key, minW, minH, enabled?, pin?, apply?, onChange? }) → { size, set(w, h), reset() }
  //     key       localStorage key for the size
  //     enabled() whether the window can be resized now (false: no grip, and no kept size applies;
  //               a phone's sheets span the width, so their sizes are CSS's)
  //     pin()     called when a drag starts: a window CSS anchors by its right or bottom edge is
  //               pinned by its top-left corner first, or the corner under the pointer would run away
  //     apply(size) draws a size ({ w, h } outer px, or null for CSS's own); the default sets
  //               width and height. The minimap uses its own, since its canvas keeps the world's shape
  //     onChange()  after any change, for redrawing
  const GRIP_PAD = 16;   // px of the viewport a resized window never grows into
  function Resizable(panel, opts) {
    const { key, minW, minH } = opts;
    const enabled = opts.enabled || (() => true);
    const r = { size: null, set, reset };
    try {
      const v = JSON.parse(localStorage.getItem(key));
      if (v && Number.isFinite(v.w) && Number.isFinite(v.h)) r.size = { w: v.w, h: v.h };
    } catch (e) { /* nothing kept */ }

    const grip = document.createElement('div');
    grip.className = 'resize-grip';
    grip.title = 'Drag to resize; double-click for the usual size';
    grip.setAttribute('aria-hidden', 'true');
    panel.appendChild(grip);

    const vw = () => globalThis.innerWidth || 1024, vh = () => globalThis.innerHeight || 768;
    // Never larger than the viewport, never smaller than the minimum (the minimum wins in a tiny viewport).
    function clampSize(w, h) {
      return { w: Math.round(Math.max(minW, Math.min(w, vw() - GRIP_PAD))), h: Math.round(Math.max(minH, Math.min(h, vh() - GRIP_PAD))) };
    }
    function defaultApply(size) {
      panel.style.width = size ? size.w + 'px' : '';
      panel.style.height = size ? size.h + 'px' : '';
      // The CSS height cap would otherwise stop the window short of what was dragged.
      panel.style.maxHeight = size ? 'none' : '';
    }
    const paintSize = opts.apply || defaultApply;
    function render() {
      const on = enabled();
      grip.hidden = !on;
      paintSize(on && r.size ? clampSize(r.size.w, r.size.h) : null);
      if (opts.onChange) opts.onChange();
    }
    function save() {
      try { if (r.size) localStorage.setItem(key, JSON.stringify(r.size)); else localStorage.removeItem(key); } catch (e) { /* not kept */ }
    }
    function set(w, h) { r.size = clampSize(w, h); render(); }
    function reset() { r.size = null; save(); render(); }

    let drag = null;
    grip.addEventListener('pointerdown', e => {
      if (!enabled()) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (opts.pin) opts.pin();
      const b = panel.getBoundingClientRect();
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, w: b.width, h: b.height, left: b.left, top: b.top };
      try { grip.setPointerCapture(e.pointerId); } catch (err) { /* gone */ }
      e.preventDefault();
      e.stopPropagation();
    });
    grip.addEventListener('pointermove', e => {
      if (!drag || drag.id !== e.pointerId) return;
      // The window may grow only to the viewport's far edges from where it sits.
      const w = Math.min(drag.w + e.clientX - drag.x, vw() - Math.max(0, drag.left));
      const h = Math.min(drag.h + e.clientY - drag.y, vh() - Math.max(0, drag.top));
      set(w, h);
    });
    const end = e => { if (drag && drag.id === e.pointerId) { drag = null; save(); } };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    grip.addEventListener('dblclick', e => { e.stopPropagation(); reset(); });
    // A smaller viewport shrinks what was kept, without forgetting it.
    globalThis.addEventListener && globalThis.addEventListener('resize', render);
    render();
    return r;
  }

  // Metric or imperial for everything the page shows (Paul, 13 Oct 2026). The sim and the
  // tables stay metric; these functions only convert on the way to the screen. Kept per
  // viewer. Every function takes metric numbers and returns text.
  //
  //   AS.units.system        'metric' | 'imperial'
  //   AS.units.set(system)   changes it, keeps it, and calls every onChange listener
  //   AS.units.onChange(fn)  fn(system) after a change
  //   AS.units.speed(kmh)    "14 km/h" / "9 mph" (whole numbers)
  //   AS.units.rain(mm)      "3 mm" / "0.12 in": a depth of rain
  //   AS.units.rainRate(mmPerDay, d)  "2.50 mm/day" / "0.10 in/day"
  //   AS.units.length(m, d)  "12.3 m" / "40.4 ft": heights and depths; d decimals
  //   AS.units.distance(km, d)  "6.0 km" / "3.7 mi"
  //   AS.units.contourSteps(), AS.units.contourLabel(i)  the topo slider's spacings, in the unit shown
  const UNITS_KEY = 'life-units';
  const MM_PER_IN = 25.4, FT_PER_M = 1 / 0.3048, MI_PER_KM = 1 / 1.609344, MPH_PER_KMH = MI_PER_KM;
  const RAIN_IN_DECIMALS = 2;   // 0.01 in is about a quarter of a millimeter
  // Round feet for the topo lines; the same count of steps as the metric list so the slider keeps its index.
  const CONTOUR_METERS = [0.5, 1, 2, 5, 10, 20];
  const CONTOUR_FEET = [2, 5, 10, 20, 50, 100];
  const units = (function () {
    const listeners = [];
    let system = 'metric';
    try { if (localStorage.getItem(UNITS_KEY) === 'imperial') system = 'imperial'; } catch (e) { /* metric */ }
    const imp = () => system === 'imperial';
    const fixed = (x, d) => x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    return {
      get system() { return system; },
      set(next) {
        const v = next === 'imperial' ? 'imperial' : 'metric';
        if (v === system) return;
        system = v;
        try { localStorage.setItem(UNITS_KEY, v); } catch (e) { /* the choice just isn't kept */ }
        for (const f of listeners) f(v);
      },
      onChange(f) { listeners.push(f); },
      speed: kmh => imp() ? Math.round(kmh * MPH_PER_KMH) + ' mph' : Math.round(kmh) + ' km/h',
      rain: mm => imp() ? fixed(mm / MM_PER_IN, RAIN_IN_DECIMALS) + ' in' : Math.round(mm) + ' mm',
      rainRate: (mm, d = 1) => imp() ? fixed(mm / MM_PER_IN, RAIN_IN_DECIMALS) + ' in/day' : fixed(mm, d) + ' mm/day',
      length: (m, d = 1) => imp() ? fixed(m * FT_PER_M, d) + ' ft' : fixed(m, d) + ' m',
      distance: (km, d = 1) => imp() ? fixed(km * MI_PER_KM, d) + ' mi' : fixed(km, d) + ' km',
      // The topo slider: its i-th spacing as the number shown, and in meters for the renderer.
      contourSteps: () => (imp() ? CONTOUR_FEET : CONTOUR_METERS).slice(),
      contourMeters: i => imp() ? CONTOUR_FEET[i] / FT_PER_M : CONTOUR_METERS[i],
      contourLabel: i => imp() ? CONTOUR_FEET[i] + ' ft' : CONTOUR_METERS[i] + ' m',
      // The slider position whose spacing is nearest `m` meters, in the system shown.
      contourIndex(m) {
        let best = 0;
        for (let i = 1; i < CONTOUR_METERS.length; i++) if (Math.abs(Math.log(this.contourMeters(i) / m)) < Math.abs(Math.log(this.contourMeters(best) / m))) best = i;
        return best;
      },
    };
  })();

  AS.units = units;
  AS.uiParts = { el, cachedText, fmtInt, Resizable };
})(globalThis.AS);
