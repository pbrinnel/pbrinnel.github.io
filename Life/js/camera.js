// The camera: which part of the world is on screen, and the drag / pinch / wheel gestures
// that move it.
//
// Everything here is in CSS pixels; the renderer owns the canvas backing store and its
// device-pixel ratio. The view is (x, y) = the world tile under the canvas's top-left
// corner, plus `scale` = CSS pixels per tile. The renderer reads x, y, scale and visible()
// every frame.
(function (AS) {
  'use strict';

  const START_SCALE = 16;   // CSS px per tile at load (clamped to the allowed range)
  const MAX_SCALE = 48;     // CSS px per tile when fully zoomed in
  // A press that moves less than this, in total, is a tap, not a drag. Pans also wait until
  // it is exceeded so a tap never nudges the map under the player's finger.
  const TAP_SLOP = 8;
  const WHEEL_ZOOM = 0.0015;      // zoom exponent per pixel of wheel delta
  const PINCH_WHEEL_BOOST = 10;   // a trackpad pinch (wheel + ctrlKey) sends tiny deltas
  const LINE_PX = 16;             // wheel deltaMode 1 (lines) → pixels
  // Keyboard panning (desktop): CSS px of screen per second while a key is held, so it
  // feels the same at every zoom; Shift moves KEY_PAN_FAST times as fast.
  const KEY_PAN_SPEED = 700;
  const KEY_PAN_FAST = 3;
  // Key → screen direction the view moves (WASD and the arrows).
  const PAN_KEYS = {
    w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0],
    ArrowUp: [0, -1], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowRight: [1, 0],
  };

  const WHEEL_LINES = 1, WHEEL_PAGES = 2;

  AS.Camera = function (canvas, W) {
    const cam = {
      x: 0, y: 0, scale: START_SCALE,
      maxScale: MAX_SCALE,

      // The scale at which the whole world just fits the canvas.
      minScale() {
        return Math.min(canvas.clientWidth / W.w, canvas.clientHeight / W.h);
      },

      screenToTile(cssX, cssY) {
        return { x: cam.x + cssX / cam.scale, y: cam.y + cssY / cam.scale };
      },

      // Zoom by `factor`, keeping the world point under (cssX, cssY) where it is.
      zoomAt(cssX, cssY, factor) {
        const wx = cam.x + cssX / cam.scale;
        const wy = cam.y + cssY / cam.scale;
        cam.scale = clampScale(cam.scale * factor);
        cam.x = wx - cssX / cam.scale;
        cam.y = wy - cssY / cam.scale;
        cam.clamp();
      },

      // A screen drag: the content follows the finger.
      panBy(dxCss, dyCss) {
        cam.x -= dxCss / cam.scale;
        cam.y -= dyCss / cam.scale;
        cam.clamp();
      },

      // A world smaller than the view sits centered; a larger one never pans past its walls.
      clamp() {
        cam.x = clampAxis(cam.x, canvas.clientWidth / cam.scale, W.w);
        cam.y = clampAxis(cam.y, canvas.clientHeight / cam.scale, W.h);
      },

      // Whole tiles at least partly on screen, clipped to the world, inclusive.
      // x1 < x0 (or y1 < y0) means none.
      visible() {
        const vw = canvas.clientWidth / cam.scale, vh = canvas.clientHeight / cam.scale;
        return {
          x0: Math.max(0, Math.floor(cam.x)),
          y0: Math.max(0, Math.floor(cam.y)),
          x1: Math.min(W.w - 1, Math.ceil(cam.x + vw) - 1),
          y1: Math.min(W.h - 1, Math.ceil(cam.y + vh) - 1),
        };
      },

      attach(onTap) { attach(onTap); },

      // Called once per frame by main.js; moves the view while pan keys are held.
      update(dtMs) {
        let dx = 0, dy = 0;
        for (const k of held) { const v = PAN_KEYS[k]; dx += v[0]; dy += v[1]; }
        if (!dx && !dy) return;
        const step = KEY_PAN_SPEED * (shift ? KEY_PAN_FAST : 1) * dtMs / 1000;
        // panBy moves content with a drag; a key moves the view, the opposite way.
        cam.panBy(-dx * step, -dy * step);
      },

      // Another world in the same canvas: back to the start view over it.
      setWorld(next) {
        W = next;
        startView();
      },
    };

    function clampScale(s) {
      // minScale() can exceed the max on a big canvas with a tiny world; the max wins
      // there, and clamp() centers the world with margins around it.
      return Math.min(MAX_SCALE, Math.max(cam.minScale(), s));
    }

    function clampAxis(pos, viewTiles, worldTiles) {
      if (worldTiles <= viewTiles) return (worldTiles - viewTiles) / 2;
      return Math.min(worldTiles - viewTiles, Math.max(0, pos));
    }

    const held = new Set();   // pan keys currently down
    let shift = false;

    // Size the canvas had when the view last settled, so a resize can find the old center.
    let lastW = canvas.clientWidth, lastH = canvas.clientHeight;

    function startView() {
      cam.scale = clampScale(START_SCALE);
      cam.x = W.w / 2 - canvas.clientWidth / cam.scale / 2;
      cam.y = W.h / 2 - canvas.clientHeight / cam.scale / 2;
      cam.clamp();
    }
    startView();

    function onResize() {
      const cx = cam.x + lastW / cam.scale / 2;
      const cy = cam.y + lastH / cam.scale / 2;
      lastW = canvas.clientWidth;
      lastH = canvas.clientHeight;
      cam.scale = clampScale(cam.scale);
      cam.x = cx - lastW / cam.scale / 2;
      cam.y = cy - lastH / cam.scale / 2;
      cam.clamp();
    }

    // Two fixed slots, reused, so a pointer move allocates nothing. `id` is null when free.
    const slots = [
      { id: null, x: 0, y: 0, lastX: 0, lastY: 0 },
      { id: null, x: 0, y: 0, lastX: 0, lastY: 0 },
    ];
    let count = 0;
    // True from a lone press until it moves past TAP_SLOP, a second pointer lands, or it
    // is canceled. Only then does lifting the pointer count as a tap.
    let tapOk = false;
    let startX = 0, startY = 0;

    function slotFor(id) {
      return slots[0].id === id ? slots[0] : slots[1].id === id ? slots[1] : null;
    }

    function attach(onTap) {
      const rect0 = () => canvas.getBoundingClientRect();

      canvas.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (count >= 2 || slotFor(e.pointerId)) return;
        const r = rect0();
        const s = slots[0].id === null ? slots[0] : slots[1];
        s.id = e.pointerId;
        s.x = s.lastX = e.clientX - r.left;
        s.y = s.lastY = e.clientY - r.top;
        count++;
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* pointer already gone */ }
        if (count === 1) {
          tapOk = true;
          startX = s.x; startY = s.y;
        } else {
          tapOk = false;
        }
      });

      canvas.addEventListener('pointermove', e => {
        const s = slotFor(e.pointerId);
        if (!s) return;
        const r = rect0();
        const nx = e.clientX - r.left, ny = e.clientY - r.top;
        if (count === 2) {
          const o = slots[0] === s ? slots[1] : slots[0];
          // Previous midpoint and spread, from the stored positions, then the new ones.
          const pmx = (s.x + o.x) / 2, pmy = (s.y + o.y) / 2;
          const pd = Math.hypot(s.x - o.x, s.y - o.y);
          s.x = nx; s.y = ny;
          const mx = (s.x + o.x) / 2, my = (s.y + o.y) / 2;
          const d = Math.hypot(s.x - o.x, s.y - o.y);
          // Pan by how far the midpoint moved, then zoom about its new position, so the
          // world point that was under the old midpoint stays under the new one.
          cam.panBy(mx - pmx, my - pmy);
          if (pd > 0 && d > 0) cam.zoomAt(mx, my, d / pd);
          return;
        }
        s.x = nx; s.y = ny;
        if (tapOk && Math.hypot(nx - startX, ny - startY) >= TAP_SLOP) tapOk = false;
        if (tapOk) return;
        cam.panBy(nx - s.lastX, ny - s.lastY);
        s.lastX = nx; s.lastY = ny;
      });

      function release(e, canceled) {
        const s = slotFor(e.pointerId);
        if (!s) return;
        const wasTap = tapOk && !canceled && count === 1;
        s.id = null;
        count--;
        tapOk = false;
        // The remaining finger of a pinch carries on as a pan from where it is now.
        if (count === 1) {
          const o = slots[0].id !== null ? slots[0] : slots[1];
          o.lastX = o.x; o.lastY = o.y;
        }
        if (wasTap) {
          const r = rect0();
          const t = cam.screenToTile(e.clientX - r.left, e.clientY - r.top);
          const tx = Math.floor(t.x), ty = Math.floor(t.y);
          if (tx < 0 || ty < 0 || tx >= W.w || ty >= W.h) onTap(-1, -1);
          else onTap(tx, ty);
        }
      }
      canvas.addEventListener('pointerup', e => release(e, false));
      canvas.addEventListener('pointercancel', e => release(e, true));

      canvas.addEventListener('wheel', e => {
        e.preventDefault();
        let dy = e.deltaY;
        if (e.deltaMode === WHEEL_LINES) dy *= LINE_PX;
        else if (e.deltaMode === WHEEL_PAGES) dy *= canvas.clientHeight;
        if (e.ctrlKey) dy *= PINCH_WHEEL_BOOST;
        const r = rect0();
        cam.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-dy * WHEEL_ZOOM));
      }, { passive: false });

      window.addEventListener('resize', onResize);

      // Pan keys are held, not tapped. Ignored while typing or with Ctrl/Cmd/Alt, so
      // browser shortcuts and form fields keep working.
      const typing = t => t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
      const keyOf = e => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
      window.addEventListener('keydown', e => {
        shift = e.shiftKey;
        if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
        const k = keyOf(e);
        if (!PAN_KEYS[k]) return;
        e.preventDefault();   // arrows would otherwise scroll a panel
        held.add(k);
      });
      window.addEventListener('keyup', e => { shift = e.shiftKey; held.delete(keyOf(e)); });
      // A key released while the window is in the background never sends keyup.
      window.addEventListener('blur', () => held.clear());
      window.addEventListener('orientationchange', onResize);
    }

    return cam;
  };
})(globalThis.AS);
