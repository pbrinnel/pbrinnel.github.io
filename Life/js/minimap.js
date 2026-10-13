// The minimap (Paul, 11 Oct 2026): the whole world, always fully zoomed out, in a small window
// with a box on what the screen shows. Click or drag on it to move the view there. Animals of
// the kinds whose rings are on (the Info tab's counts) show as dots in their ring color,
// so a few last wolves are easy to find. The Info tab's Minimap button opens and closes
// it; +/− switches small (MINI_SMALL tiles per pixel) and big (one tile per pixel). Both
// choices are kept per viewer.
//
// AS.Minimap(cam, mapCanvas, renderer) → { open, toggle(), draw(sim, located, nowMs) }
//   draw    called every frame by main.js: the world picture is refreshed every MINI_REFRESH_MS
//           of real time (it is the far view's own one-pixel-per-tile picture, render.js
//           farCanvas), the view box and dots every frame.
(function (AS) {
  'use strict';

  const MINI_SMALL = 2;          // tiles per CSS pixel when small
  const MINI_REFRESH_MS = 200;   // how often the world picture is redrawn
  const DOT_CSS_PX = 3;
  const BOX_COLOR = '#e8d9a0';   // the HUD's "on" color
  const OPEN_KEY = 'life-minimap', SIZE_KEY = 'life-minimap-size';
  const SIZE_PX_KEY = 'life-minimap-wh';   // the window size dragged with the corner grip, { w, h } in CSS px
  const MIN_CANVAS_PX = 80, PHONE_PX = 600;
  const SPECIES_OF = { bunnies: 'BUNNY', wolves: 'WOLF', humans: 'HUMAN' };

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* not kept */ } };

  AS.Minimap = function (cam, mapCanvas, renderer) {
    const panel = document.getElementById('minimap');
    const m = { open: load(OPEN_KEY, '0') === '1', toggle, draw };
    let small = load(SIZE_KEY, 'small') !== 'big';
    let sized = null, pictureAt = -Infinity;   // the canvas's size key; when the picture was last drawn

    const head = el('div', 'mini-head');
    const title = el('span', 'mini-title', 'Map');
    const sizeBtn = el('button', 'hud-btn mini-size');
    sizeBtn.type = 'button';
    const closeBtn = el('button', 'win-close mini-close', '×');
    closeBtn.type = 'button';
    closeBtn.title = 'Close';
    head.append(title, sizeBtn, closeBtn);
    const canvas = el('canvas', 'mini-canvas');
    panel.append(head, canvas);
    const ctx = canvas.getContext('2d');
    const drag = AS.Draggable ? AS.Draggable(panel, head, 'life-minimap-pos') : null;
    if (drag) head.title = 'Drag to move; double-click to put it back';
    // The corner grip (ui-parts.js). The window is its map, so a dragged size only says how big
    // the map may be: it keeps the world's shape and the window follows it (draw()). On a phone
    // the window hangs from the bar's right edge and can't be pinned, so there is no grip.
    let custom = null;   // { w, h }: the most the window may take, or null for small / big
    const sizer = AS.uiParts && AS.uiParts.Resizable
      ? AS.uiParts.Resizable(panel, {
          key: SIZE_PX_KEY, minW: 120, minH: 120,
          enabled: () => (globalThis.innerWidth || 0) > PHONE_PX,
          pin: () => { if (drag) { const b = panel.getBoundingClientRect(); drag.place(b.left, b.top); } },
          apply: size => { custom = size; sized = null; },
        })
      : null;
    // Gestures on the panel are the panel's; the map under it never sees them.
    for (const t of ['pointerdown', 'pointerup', 'wheel']) panel.addEventListener(t, e => e.stopPropagation());

    function applySize() {
      sizeBtn.textContent = small ? '+' : '−';
      sizeBtn.title = small ? 'Bigger map' : 'Smaller map';
      panel.classList.toggle('mini-small', small);
      sized = null;
    }
    sizeBtn.addEventListener('click', () => { small = !small; if (sizer) sizer.reset(); save(SIZE_KEY, small ? 'small' : 'big'); applySize(); sizeBtn.blur(); });
    closeBtn.addEventListener('click', () => { toggle(); closeBtn.blur(); });
    function toggle() {
      m.open = !m.open;
      panel.hidden = !m.open;
      save(OPEN_KEY, m.open ? '1' : '0');
      pictureAt = -Infinity;
    }
    panel.hidden = !m.open;
    applySize();

    // Click or drag: the view's center goes to that point of the world.
    let world = null, dragging = null;
    function moveTo(e) {
      if (!world) return;
      const r = canvas.getBoundingClientRect();
      const wx = (e.clientX - r.left) / r.width * world.w, wy = (e.clientY - r.top) / r.height * world.h;
      cam.x = wx - mapCanvas.clientWidth / cam.scale / 2;
      cam.y = wy - mapCanvas.clientHeight / cam.scale / 2;
      cam.clamp();
    }
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* gone */ }
      moveTo(e);
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', e => { if (dragging === e.pointerId) moveTo(e); });
    const end = e => { if (dragging === e.pointerId) dragging = null; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    const picture = document.createElement('canvas'), pctx = picture.getContext('2d');
    // On a phone it sits just under the bar (CSS, from --hud-bottom), whose height changes with the open tab.
    const hudTop = document.querySelector('#hud .hud-top');
    let hudH = -1;
    function draw(sim, located, nowMs) {
      if (!m.open) return;
      const h = hudTop ? hudTop.offsetHeight : 0;
      if (h !== hudH) { hudH = h; panel.style.setProperty('--hud-bottom', h + 'px'); }
      const W = sim.W;
      world = W;
      const dpr = Math.max(1, Math.round(globalThis.devicePixelRatio || 1));
      // CSS size: the world at MINI_SMALL tiles a pixel or one, kept inside the screen.
      const per = small ? MINI_SMALL : 1;
      const maxW = Math.max(MIN_CANVAS_PX, (globalThis.innerWidth || 800) - 32);
      let cssW = Math.min(W.w / per, maxW);
      if (custom) {
        // What is left of the dragged window once the title bar, padding and border are taken out.
        const room = (custom.w - (panel.offsetWidth - canvas.offsetWidth)), tall = (custom.h - (panel.offsetHeight - canvas.offsetHeight));
        cssW = Math.max(MIN_CANVAS_PX, Math.min(room, tall * W.w / W.h, maxW));
      }
      const cssH = cssW * W.h / W.w;
      const key = cssW + 'x' + cssH + '@' + dpr;
      if (sized !== key) {
        sized = key;
        canvas.style.width = cssW + 'px';
        canvas.style.height = cssH + 'px';
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        pictureAt = -Infinity;
      }
      if (nowMs - pictureAt >= MINI_REFRESH_MS) {
        pictureAt = nowMs;
        const src = renderer.farCanvas(sim);
        if (picture.width !== W.w || picture.height !== W.h) { picture.width = W.w; picture.height = W.h; }
        pctx.drawImage(src, 0, 0);
      }
      const sx = canvas.width / W.w, sy = canvas.height / W.h;
      ctx.imageSmoothingEnabled = small;   // big is one tile a pixel: keep it crisp
      ctx.drawImage(picture, 0, 0, canvas.width, canvas.height);
      // Dots for the ringed kinds of animal, and corpses.
      if (located && located.size) {
        const r = DOT_CSS_PX * dpr / 2;
        for (const key2 of located) {
          const rgb = AS.LOCATE_COLORS && AS.LOCATE_COLORS[key2];
          if (!rgb) continue;
          ctx.fillStyle = `rgb(${rgb})`;
          ctx.beginPath();
          if (SPECIES_OF[key2]) {
            const sp = AS.SPECIES[SPECIES_OF[key2]];
            for (let s = 0, hi = W.aHigh; s < hi; s++) {
              if (!W.aAlive[s] || W.aSpecies[s] !== sp) continue;
              const t = W.aTile[s], x = (t % W.w + 0.5) * sx, y = (((t / W.w) | 0) + 0.5) * sy;
              ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2);
            }
          } else if (key2 === 'corpses') {
            for (let t = 0; t < W.n; t++) {
              if (W.kind[t] !== AS.KIND.CORPSE) continue;
              const x = (t % W.w + 0.5) * sx, y = (((t / W.w) | 0) + 0.5) * sy;
              ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2);
            }
          }
          ctx.fill();
        }
      }
      // The view.
      const vw = mapCanvas.clientWidth / cam.scale, vh = mapCanvas.clientHeight / cam.scale;
      ctx.strokeStyle = BOX_COLOR;
      ctx.lineWidth = Math.max(1, 1.5 * dpr);
      ctx.strokeRect(cam.x * sx, cam.y * sy, vw * sx, vh * sy);
    }
    return m;
  };
})(globalThis.AS);
