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

  AS.uiParts = { el, cachedText, fmtInt, Resizable };
})(globalThis.AS);
