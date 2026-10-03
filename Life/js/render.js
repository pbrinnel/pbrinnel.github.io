// Draws the world to the canvas. Read-only on the sim: nothing here changes it.
//
// Two modes by zoom. Glyph mode copies pre-rendered glyphs from the sheet, for the visible
// tiles only. Cell mode, once tiles are too small to read a glyph, paints one pixel per
// tile into a world-sized image and scales it up in a single draw. Nothing flashes or
// animates apart from animals gliding between tiles.
(function (AS) {
  'use strict';

  // Below this many CSS px per tile, glyphs give way to solid squares (DESIGN.md).
  const CELL_PX = AS.CELL_PX = 6;
  const SELECT_COLOR = '#f2d9a6';
  const SELECT_WIDTH = 1.5;   // CSS px
  // Animals this far outside the view still draw, so one gliding in is never cut off.
  const VIEW_MARGIN = 1;

  // Faint lines from each animal to what it is after (glyph mode only).
  const INTENT_LINES = true;
  const INTENT_ALPHA = 0.5;
  // Drawn twice, a wider background-colored stroke under the colored one, so a line reads
  // over bright grass as well as black ground.
  const INTENT_CSS_PX = 1.25, INTENT_HALO_CSS_PX = 3;
  const INTENT_HALO_COLOR = '#0a0c0a';

  const KIND = AS.KIND, G = AS.GLYPH;

  // How far through its current step an animal is, 0–1. alpha is how far real time is
  // between the last tick and the next, so a step glides smoothly at any speed.
  AS.glideProgress = function (stepLeft, stepDur, alpha) {
    const p = 1 - (stepLeft - alpha * AS.DT) / stepDur;
    return p < 0 ? 0 : p > 1 ? 1 : p;
  };

  AS.Renderer = function (canvas) {
    const ctx = canvas.getContext('2d');
    const cell = { canvas: null, ctx: null, img: null, px: null, w: 0, h: 0 };
    const pos = new Float64Array(2), pos2 = new Float64Array(2);   // scratch for animalPos: no per-frame allocation
    let curAlpha = 0;                  // this frame's alpha, for animalPos

    function sizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      return dpr;
    }

    // Where an animal is drawn, in tile coordinates (top-left of its tile), into out[0..1]:
    // between the tile it stepped from and the one it is on.
    function animalPos(W, s, alpha, out) {
      const t = W.aTile[s], f = W.aFrom[s], w = W.w;
      const p = AS.glideProgress(W.aStepLeft[s], W.aStepDur[s], alpha);
      const tx = t % w, ty = (t / w) | 0, fx = f % w, fy = (f / w) | 0;
      out[0] = fx + (tx - fx) * p;
      out[1] = fy + (ty - fy) * p;
    }

    function stageGlyph(sim, s, W) {
      const sp = W.aSpecies[s];
      return AS.animalGlyph(sp, W.aSex[s], AS.stageOf(sim.T[AS.SPECIES_KEY[sp]], W.aAge[s]));
    }

    function fillCells(sim) {
      const W = sim.W;
      if (cell.w !== W.w || cell.h !== W.h) {
        cell.canvas = document.createElement('canvas');
        cell.canvas.width = cell.w = W.w;
        cell.canvas.height = cell.h = W.h;
        cell.ctx = cell.canvas.getContext('2d');
        cell.img = cell.ctx.createImageData(W.w, W.h);
        cell.px = new Uint32Array(cell.img.data.buffer);
      }
      const px = cell.px, kind = W.kind, size = W.gSize, col = AS.CELL_COLOR;
      const bg = AS.CELL_BG, g0 = col[G.GRASS_0], g1 = col[G.GRASS_1], g2 = col[G.GRASS_2];
      const corpse = col[G.CORPSE];
      const lo = 1 / 3, hi = 2 / 3;
      for (let t = 0, n = W.n; t < n; t++) {
        const k = kind[t];
        if (k === KIND.GRASS) { const z = size[t]; px[t] = z < lo ? g0 : z < hi ? g1 : g2; }
        else if (k === KIND.CORPSE) px[t] = corpse;
        else px[t] = bg;   // empty, or an animal that the loop below paints
      }
      for (let s = 0, hiSlot = W.aHigh; s < hiSlot; s++) {
        if (W.aAlive[s]) px[W.aTile[s]] = col[stageGlyph(sim, s, W)];
      }
      cell.ctx.putImageData(cell.img, 0, 0);
    }

    function drawGlyphs(sim, cam, sheet, dpr) {
      const W = sim.W, v = cam.visible();
      if (v.x1 < v.x0 || v.y1 < v.y0) return;
      const s = cam.scale * dpr;
      const sh = sheet.get(Math.max(1, Math.round(s)));
      const img = sh.canvas, px = sh.px;
      const kind = W.kind, size = W.gSize;
      const ox = cam.x * s, oy = cam.y * s;
      for (let ty = v.y0; ty <= v.y1; ty++) {
        const dy = Math.round(ty * s - oy), dh = Math.round((ty + 1) * s - oy) - dy;
        const row = ty * W.w;
        for (let tx = v.x0; tx <= v.x1; tx++) {
          const k = kind[row + tx];
          let id;
          if (k === KIND.GRASS) id = AS.grassGlyph(size[row + tx]);
          else if (k === KIND.CORPSE) id = G.CORPSE;
          else continue;   // empty, or an animal (own pass)
          const dx = Math.round(tx * s - ox), dw = Math.round((tx + 1) * s - ox) - dx;
          ctx.drawImage(img, sh.sx(id), sh.sy(id), px, px, dx, dy, dw, dh);
        }
      }
      if (INTENT_LINES) drawIntent(sim, v, s, ox, oy, dpr);
      // Animals, over the ground. Slots are stable, so this is one pass over the used range.
      const aAlive = W.aAlive, alpha = curAlpha;
      for (let a = 0, hiSlot = W.aHigh; a < hiSlot; a++) {
        if (!aAlive[a]) continue;
        animalPos(W, a, alpha, pos);
        const ax = pos[0], ay = pos[1];
        if (ax < v.x0 - VIEW_MARGIN || ax > v.x1 + VIEW_MARGIN ||
            ay < v.y0 - VIEW_MARGIN || ay > v.y1 + VIEW_MARGIN) continue;
        const id = stageGlyph(sim, a, W);
        ctx.drawImage(img, sh.sx(id), sh.sy(id), px, px,
          Math.round(ax * s - ox), Math.round(ay * s - oy), s, s);
      }
    }

    // One path per species-and-sex color, one stroke each: there may be thousands of lines.
    function drawIntent(sim, v, s, ox, oy, dpr) {
      const W = sim.W, alpha = curAlpha, half = s / 2;
      const line = INTENT_CSS_PX * dpr, halo = INTENT_HALO_CSS_PX * dpr;
      ctx.globalAlpha = INTENT_ALPHA;
      for (let grp = 0; grp < 4; grp++) {
        ctx.beginPath();
        let any = false;
        for (let a = 0, hiSlot = W.aHigh; a < hiSlot; a++) {
          if (!W.aAlive[a] || (W.aSpecies[a] << 1 | W.aSex[a]) !== grp) continue;
          const tt = W.aTargetTile[a];
          if (tt < 0) continue;
          animalPos(W, a, alpha, pos);
          const ax = pos[0], ay = pos[1];
          if (ax < v.x0 - VIEW_MARGIN || ax > v.x1 + VIEW_MARGIN ||
              ay < v.y0 - VIEW_MARGIN || ay > v.y1 + VIEW_MARGIN) continue;
          let bx, by;
          const ts = W.aTargetSlot[a];
          if (ts >= 0 && W.aAlive[ts] && W.aSerial[ts] === W.aTargetSerial[a]) {
            animalPos(W, ts, alpha, pos2);
            bx = pos2[0]; by = pos2[1];
          } else { bx = tt % W.w; by = (tt / W.w) | 0; }
          ctx.moveTo(ax * s - ox + half, ay * s - oy + half);
          ctx.lineTo(bx * s - ox + half, by * s - oy + half);
          any = true;
        }
        if (any) {
          ctx.lineWidth = halo;
          ctx.strokeStyle = INTENT_HALO_COLOR;
          ctx.stroke();
          ctx.lineWidth = line;
          ctx.strokeStyle = AS.COLORS[AS.animalGlyph(grp >> 1, grp & 1, AS.STAGE.ADULT)];
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawSelection(sim, cam, sel, dpr) {
      const W = sim.W, s = cam.scale * dpr;
      if (sel.slot >= 0 && W.aAlive[sel.slot]) animalPos(W, sel.slot, curAlpha, pos);
      else { pos[0] = sel.tile % W.w; pos[1] = (sel.tile / W.w) | 0; }
      const lw = SELECT_WIDTH * dpr;
      ctx.lineWidth = lw;
      ctx.strokeStyle = SELECT_COLOR;
      // Inset by half the line so the whole outline stays inside the tile's own square.
      ctx.strokeRect((pos[0] - cam.x) * s + lw / 2, (pos[1] - cam.y) * s + lw / 2, s - lw, s - lw);
    }

    return {
      // sel: null or { tile, serial, slot }; alpha: 0–1 through the current tick.
      // marks (optional): an AS.Marks; nowMs: real time (performance.now()), for the marks.
      draw(sim, cam, sheet, sel, alpha, marks, nowMs) {
        const dpr = sizeCanvas();
        curAlpha = alpha;
        ctx.fillStyle = AS.COLORS.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const s = cam.scale * dpr;
        if (cam.scale >= CELL_PX) {
          drawGlyphs(sim, cam, sheet, dpr);
        } else {
          fillCells(sim);
          const W = sim.W;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(cell.canvas, 0, 0, W.w, W.h, -cam.x * s, -cam.y * s, W.w * s, W.h * s);
          ctx.imageSmoothingEnabled = true;
        }
        if (marks) { marks.consume(sim, nowMs, cam); marks.draw(ctx, sim, cam, dpr, nowMs); }
        if (sel) drawSelection(sim, cam, sel, dpr);
      },
    };
  };
})(globalThis.AS);
