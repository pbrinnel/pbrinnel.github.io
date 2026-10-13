// Drag a floating window by a handle (Paul, 12 Oct 2026: the tab panel, the properties
// window and the minimap move like the graph). Mouse or touch; the window stays inside the
// viewport and its place is kept per viewer. On a phone (narrower than PHONE_PX) windows keep
// their fixed sheets and don't drag.
//
//   AS.Draggable(panel, handle, key, onMoved?) → { moved, reset(), place(x, y) }
//     panel     the fixed-position window; handle: the part that drags it (its buttons don't)
//     key       localStorage key for its place
//     moved     whether it has been placed (false: CSS decides where it sits)
//     place     puts it at x, y and keeps that (resizing pins a window this way before it
//               grows, so its top-left corner stays put whichever corner CSS anchored it by)
//     onMoved(moved) when that changes
(function (AS) {
  'use strict';

  const PHONE_PX = 600;
  const EDGE_KEEP = 40;   // px of a dragged window kept on screen at any edge

  AS.Draggable = function (panel, handle, key, onMoved) {
    const d = { moved: false, reset, place };
    let pos = null, drag = null;
    const desktop = () => (globalThis.innerWidth || 0) > PHONE_PX;
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) pos = { x: saved.x, y: saved.y };
    } catch (e) { /* nothing kept */ }

    function apply() {
      const on = !!pos && desktop();
      if (!on) {
        panel.style.left = panel.style.top = panel.style.right = panel.style.bottom = '';
      } else {
        const r = panel.getBoundingClientRect(), vw = globalThis.innerWidth, vh = globalThis.innerHeight;
        const w = r.width || 200, h = r.height || 100;
        pos.x = Math.min(Math.max(pos.x, EDGE_KEEP - w), vw - EDGE_KEEP);
        pos.y = Math.min(Math.max(pos.y, 0), vh - EDGE_KEEP);
        panel.style.left = pos.x + 'px'; panel.style.top = pos.y + 'px';
        panel.style.right = 'auto'; panel.style.bottom = 'auto';
      }
      if (on !== d.moved) { d.moved = on; panel.classList.toggle('dragged', on); if (onMoved) onMoved(on); }
    }
    function save() { try { localStorage.setItem(key, JSON.stringify(pos)); } catch (e) { /* not kept */ } }
    function place(x, y) { if (!desktop()) return; pos = { x, y }; apply(); save(); }
    function reset() { pos = null; try { localStorage.removeItem(key); } catch (e) { /* fine */ } apply(); }

    handle.classList.add('drag-handle');
    handle.addEventListener('pointerdown', e => {
      if (!desktop() || e.target.closest('button, input')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const r = panel.getBoundingClientRect();
      drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* gone */ }
      e.preventDefault();
    });
    handle.addEventListener('pointermove', e => {
      if (!drag || drag.id !== e.pointerId) return;
      pos = { x: e.clientX - drag.dx, y: e.clientY - drag.dy };
      apply();
    });
    const end = e => { if (drag && drag.id === e.pointerId) { drag = null; if (pos) save(); } };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    // A double-click on the handle puts it back where it started.
    handle.addEventListener('dblclick', e => { if (!e.target.closest('button, input')) reset(); });
    globalThis.addEventListener && globalThis.addEventListener('resize', apply);
    // Shown again after being hidden (display none → shown): re-clamp, in case the viewport changed.
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => { if (pos) apply(); }).observe(panel);
    apply();
    return d;
  };
})(globalThis.AS);
