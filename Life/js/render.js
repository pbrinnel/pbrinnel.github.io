// Draws the world to the canvas. Read-only on the sim: nothing here changes it.
//
// Two modes by zoom. Sprite mode copies pre-rendered sprites from the sheet, for the
// visible tiles only. Cell mode, once tiles are too small to read a sprite, paints one
// pixel per tile into a world-sized image and scales it up in a single draw, in brighter
// colors than the sprites' so animals and grass still read from far away. Nothing flashes;
// animals glide between tiles and change frame at walking pace.
(function (AS) {
  'use strict';

  // Below this many CSS px per tile, sprites give way to solid squares (DESIGN.md).
  const CELL_PX = AS.CELL_PX = 6;
  const SELECT_COLOR = '#f2d9a6';
  const SELECT_WIDTH = 1.5;   // CSS px
  // Animals this far outside the view still draw, so one gliding in is never cut off.
  const VIEW_MARGIN = 1;

  // Faint lines from each animal to what it is after (sprite mode only). Off until the
  // viewer turns them on; the selected animal's own line shows either way.
  const INTENT_ALPHA = 0.5;
  // Drawn twice, a wider background-colored stroke under the colored one, so a line reads
  // over bright grass as well as black ground.
  const INTENT_CSS_PX = 1.25, INTENT_HALO_CSS_PX = 3;
  const INTENT_HALO_COLOR = '#0a0c0a';

  // Cell mode's colors, as 0xAABBGGRR for the world-sized ImageData (little-endian). Grass
  // by third, then corpse and ground; animals by species and sex. Brighter than the sprites
  // so a single pixel stays visible against the ground.
  function abgr(hex) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
  }
  const FAR_GRASS = ['#2c4a2c', '#3f7040', '#62a457'].map(abgr);
  const FAR_CORPSE = abgr('#6a6250'), FAR_GROUND = abgr('#121410'), FAR_HOLE = abgr('#3d2e20');
  const FAR_ANIMAL = [['#e0a868', '#f2cc96'], ['#8fb2e0', '#c0d6f2']].map(r => r.map(abgr));   // [species][sex]

  // Real time an event holds a pose, whatever the speed, so nothing flickers (DESIGN.md,
  // Photosensitivity): a meatless death's fallen sprite, a bite's flinch, a mouthful or bite, a birth's hop.
  const DEATH_HOLD_MS = 700, FLINCH_HOLD_MS = 300, ACTION_HOLD_MS = 300, BIRTH_HOLD_MS = 400;
  // Events this many tiles outside the view are skipped: nobody sees them.
  const EVENT_MARGIN = 2;
  // A bite timer that rose by more than this since the last frame means a bite landed.
  const BITE_RISE = 1e-6;

  const KIND = AS.KIND, EV = AS.EV, HOLD = AS.SPRITE_HOLD, FRAME = AS.SPRITE_FRAME;

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
    let clock = 0;                     // this frame's sim time in seconds, for the idle fidget
    const posed = new Float64Array(2); // scratch for spritePose: frame, lift
    const facing = AS.SpriteFacing();
    let intentLines = false;
    let stepSpeed = 1;                 // sim seconds per real second this frame (0 = paused)
    // Per-slot event holds, in real ms: which pose, until when, for which animal (serial).
    let holdKind = new Uint8Array(0), holdUntil = new Float64Array(0), holdSerial = new Uint32Array(0);
    // Per-slot memory for spotting a bite: the timer last frame, and the last frame the
    // animal was drawn (a gap means the timer is stale, so it can't count as a bite).
    let prevBite = new Float64Array(0), seenFrame = new Int32Array(0), seenSerial = new Uint32Array(0);
    let frameNo = 0;
    // When each tile's death pose ends, real ms; a corpse with no meat shows the fallen animal until then.
    let deathUntil = new Float64Array(0);
    let evSim = null, evCursor = 0;
    // State ids by species, from states.csv names, for the poses that depend on what it is doing.
    let statesFor = null;
    const restState = [new Uint8Array(256), new Uint8Array(256)];
    const mateState = [new Uint8Array(256), new Uint8Array(256)];

    function growSlots(W) {
      if (holdKind.length >= W.aCap) return;
      const n = W.aCap;
      const grow = (old, C) => { const a = new C(n); a.set(old); return a; };
      holdKind = grow(holdKind, Uint8Array); holdUntil = grow(holdUntil, Float64Array);
      holdSerial = grow(holdSerial, Uint32Array); prevBite = grow(prevBite, Float64Array);
      seenFrame = grow(seenFrame, Int32Array); seenSerial = grow(seenSerial, Uint32Array);
    }

    function startHold(W, a, kind, nowMs, ms) {
      holdKind[a] = kind; holdUntil[a] = nowMs + ms; holdSerial[a] = W.aSerial[a];
    }

    function buildStates(T) {
      statesFor = T;
      for (let sp = 0; sp < 2; sp++) {
        restState[sp].fill(0); mateState[sp].fill(0);
        const list = T.states[AS.SPECIES_KEY[sp]];
        for (let i = 0; i < list.length; i++) {
          if (list[i].name === 'REST' || list[i].name === 'GIVE_UP') restState[sp][i] = 1;
          if (list[i].name === 'MATE') mateState[sp][i] = 1;
        }
      }
    }

    // The animal on tile `t` next to `tile` whose bite timer is running and whose target is
    // `tile`: who just bit or grazed there. Catches bites that a fast frame's timer misses.
    const nbAt = new Int32Array(4);
    function markBiter(W, tile, species, nowMs) {
      const k = W.neighbors4(tile, nbAt);
      for (let i = 0; i < k; i++) {
        const n = nbAt[i];
        if (W.kind[n] !== (species ? KIND.WOLF : KIND.BUNNY)) continue;
        const a = W.aSlot[n];
        if (W.aTargetTile[a] === tile && W.aBiteLeft[a] > 0) startHold(W, a, HOLD.ACTION, nowMs, ACTION_HOLD_MS);
      }
    }

    // Reads the sim's new events into holds. A different sim (benchmark, reload) restarts
    // the cursor, and an overrun of the ring reads only what is left of it.
    function consumeEvents(sim, cam, nowMs) {
      const W = sim.W, ev = sim.events;
      growSlots(W);
      if (evSim !== sim || ev.written < evCursor) {
        evSim = sim;
        evCursor = ev.written;
        holdKind.fill(0); seenFrame.fill(0);
        deathUntil = new Float64Array(W.n);
        return;
      }
      if (ev.written - evCursor > ev.size) evCursor = ev.written - ev.size;
      const v = cam.visible();
      for (; evCursor < ev.written; evCursor++) {
        const i = evCursor % ev.size, tile = ev.tile[i];
        const x = tile % W.w, y = (tile / W.w) | 0;
        if (x < v.x0 - EVENT_MARGIN || x > v.x1 + EVENT_MARGIN ||
            y < v.y0 - EVENT_MARGIN || y > v.y1 + EVENT_MARGIN) continue;
        switch (ev.type[i]) {
          case EV.DEATH: deathUntil[tile] = nowMs + DEATH_HOLD_MS; break;
          case EV.BITE:
            if (W.kind[tile] === KIND.BUNNY) startHold(W, W.aSlot[tile], HOLD.FLINCH, nowMs, FLINCH_HOLD_MS);
            markBiter(W, tile, 1, nowMs);
            break;
          case EV.GRAZE: markBiter(W, tile, 0, nowMs); break;
          case EV.BIRTH:
            if (W.kind[tile] === KIND.BUNNY || W.kind[tile] === KIND.WOLF) {
              startHold(W, W.aSlot[tile], HOLD.BIRTH, nowMs, BIRTH_HOLD_MS);
            }
            break;
        }
      }
    }

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

    function stageOf(sim, s, W) {
      return AS.stageOf(sim.T[AS.SPECIES_KEY[W.aSpecies[s]]], W.aAge[s]);
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
      const px = cell.px, kind = W.kind, size = W.gSize;
      const bg = FAR_GROUND, g0 = FAR_GRASS[0], g1 = FAR_GRASS[1], g2 = FAR_GRASS[2];
      const corpse = FAR_CORPSE, holeAt = W.hole;
      const lo = 1 / 3, hi = 2 / 3;
      for (let t = 0, n = W.n; t < n; t++) {
        const k = kind[t];
        if (k === KIND.GRASS) { const z = size[t]; px[t] = z < lo ? g0 : z < hi ? g1 : g2; }
        else if (k === KIND.CORPSE) px[t] = corpse;
        else px[t] = holeAt[t] ? FAR_HOLE : bg;   // empty ground (or a hole), or an animal that the loop below paints
      }
      for (let s = 0, hiSlot = W.aHigh; s < hiSlot; s++) {
        if (W.aAlive[s]) px[W.aTile[s]] = FAR_ANIMAL[W.aSpecies[s]][W.aSex[s]];
      }
      cell.ctx.putImageData(cell.img, 0, 0);
    }

    function drawSprites(sim, cam, sheet, sel, dpr, nowMs) {
      const W = sim.W, v = cam.visible();
      if (v.x1 < v.x0 || v.y1 < v.y0) return;
      const s = cam.scale * dpr;
      const sh = sheet.get(Math.max(1, Math.round(s)));
      const img = sh.canvas, px = sh.px;
      const kind = W.kind, size = W.gSize;
      // Pixel art: nearest-neighbor, so a tile drawn a pixel wider than the sprite doesn't
      // blur or pull in the neighboring sprite's edge.
      ctx.imageSmoothingEnabled = false;
      const ox = cam.x * s, oy = cam.y * s;
      for (let ty = v.y0; ty <= v.y1; ty++) {
        const dy = Math.round(ty * s - oy), dh = Math.round((ty + 1) * s - oy) - dy;
        const row = ty * W.w;
        for (let tx = v.x0; tx <= v.x1; tx++) {
          const k = kind[row + tx];
          let id;
          if (W.hole[row + tx]) {
            // The hole is ground: it goes under a corpse that lies on it, and under any animal.
            const dx = Math.round(tx * s - ox), dw = Math.round((tx + 1) * s - ox) - dx;
            const hid = AS.spriteHole();
            ctx.drawImage(img, sh.sx(hid), sh.sy(hid), px, px, dx, dy, dw, dh);
          }
          if (k === KIND.GRASS) {
            const third = AS.grassGlyph(size[row + tx]) - AS.GLYPH.GRASS_0;
            id = AS.grassLeans(tx, ty, nowMs / 1000) ? AS.spriteGrassLean(third) : AS.spriteGrass(third);
          }
          else if (k === KIND.CORPSE) {
            // A body with meat on it lies flat, eye shut; once the meat is gone, a skull. A
            // body with none to begin with (a wolf's) lies there for a moment after the death,
            // so it doesn't snap straight to a skull.
            if (W.cMeat[row + tx] > 0) id = AS.spriteCarcass(W.cSpecies[row + tx]);
            else if (nowMs < deathUntil[row + tx]) id = AS.spriteCarcass(W.cSpecies[row + tx]);
            else id = AS.spriteSkull(W.cSpecies[row + tx]);
          } else continue;   // empty, or an animal (own pass)
          const dx = Math.round(tx * s - ox), dw = Math.round((tx + 1) * s - ox) - dx;
          ctx.drawImage(img, sh.sx(id), sh.sy(id), px, px, dx, dy, dw, dh);
        }
      }
      if (intentLines) drawIntent(sim, v, s, ox, oy, dpr, -1);
      else if (sel && sel.slot >= 0 && W.aAlive[sel.slot]) drawIntent(sim, v, s, ox, oy, dpr, sel.slot);
      // Animals, over the ground. Slots are stable, so this is one pass over the used range.
      const aAlive = W.aAlive, alpha = curAlpha;
      const unit = px / AS.SPRITE_SIZE;   // one sprite pixel, in device px
      const serials = W.aSerial, aState = W.aState, biteLeft = W.aBiteLeft;
      for (let a = 0, hiSlot = W.aHigh; a < hiSlot; a++) {
        if (!aAlive[a]) continue;
        animalPos(W, a, alpha, pos);
        const ax = pos[0], ay = pos[1];
        if (ax < v.x0 - VIEW_MARGIN || ax > v.x1 + VIEW_MARGIN ||
            ay < v.y0 - VIEW_MARGIN || ay > v.y1 + VIEW_MARGIN) continue;
        const sp = W.aSpecies[a], serial = serials[a];
        const p = AS.glideProgress(W.aStepLeft[a], W.aStepDur[a], alpha);
        const moving = W.aTile[a] !== W.aFrom[a] && p < 1;
        // A bite timer that rose since the last frame is a bite or a mouthful.
        if (seenFrame[a] === frameNo - 1 && seenSerial[a] === serial && biteLeft[a] > prevBite[a] + BITE_RISE) {
          startHold(W, a, HOLD.ACTION, nowMs, ACTION_HOLD_MS);
        }
        seenFrame[a] = frameNo; seenSerial[a] = serial; prevBite[a] = biteLeft[a];
        const st = aState[a];
        // Mating partners face each other.
        if (!moving && mateState[sp][st]) {
          const tt = W.aTargetTile[a];
          if (tt >= 0) {
            const dx = tt % W.w - W.aTile[a] % W.w, dy = ((tt / W.w) | 0) - ((W.aTile[a] / W.w) | 0);
            if (dx * dx + dy * dy === 1 && dx !== 0) facing.turn(a, dx < 0 ? 1 : 0);
          }
        }
        const hold = holdSerial[a] === serial && nowMs < holdUntil[a] ? holdKind[a] : HOLD.NONE;
        const stepMs = stepSpeed > 0 ? W.aStepDur[a] * 1000 / stepSpeed : Infinity;
        AS.spritePose(sp, moving, W.aSprint[a] === 1, restState[sp][st] === 1, W.aWinded[a] === 1,
          W.aPregnant[a] > 0, hold, stepMs, p, clock + AS.spriteIdleOffset(serial), posed);
        // A bunny that has reached a hole shows only its ears and eyes (arriving or leaving, it
        // is drawn whole, gliding over the hole).
        const peeking = sp === 0 && !moving && W.hole[W.aTile[a]] === 1;
        const id = peeking
          ? AS.spritePeek(W.aSex[a])
          : AS.spriteIndex(sp, W.aSex[a], stageOf(sim, a, W), facing.left(a), posed[0]);
        // Lift in whole sprite pixels, so the body hops in the art's own grid.
        ctx.drawImage(img, sh.sx(id), sh.sy(id), px, px,
          Math.round(ax * s - ox), Math.round(ay * s - oy) - Math.round((peeking ? 0 : posed[1]) * unit), px, px);
      }
      ctx.imageSmoothingEnabled = true;
    }

    // One path per species-and-sex color, one stroke each: there may be thousands of lines.
    // only >= 0 draws just that slot's line.
    function drawIntent(sim, v, s, ox, oy, dpr, only) {
      const W = sim.W, alpha = curAlpha, half = s / 2;
      const line = INTENT_CSS_PX * dpr, halo = INTENT_HALO_CSS_PX * dpr;
      ctx.globalAlpha = INTENT_ALPHA;
      for (let grp = 0; grp < 4; grp++) {
        ctx.beginPath();
        let any = false;
        for (let a = only >= 0 ? only : 0, hiSlot = only >= 0 ? only + 1 : W.aHigh; a < hiSlot; a++) {
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
      setIntentLines(on) { intentLines = !!on; },
      get intentLines() { return intentLines; },
      // sel: null or { tile, serial, slot }; alpha: 0–1 through the current tick; nowMs: real
      // time (performance.now()), which the event holds run on; speed: the sim speed asked
      // for (0 paused, Infinity max), to tell when steps are too short to animate.
      draw(sim, cam, sheet, sel, alpha, nowMs, speed) {
        const dpr = sizeCanvas();
        nowMs = nowMs || 0;
        stepSpeed = speed === undefined ? 1 : speed;
        if (statesFor !== sim.T) buildStates(sim.T);
        frameNo++;
        consumeEvents(sim, cam, nowMs);
        curAlpha = alpha;
        clock = (sim.tickCount + alpha) * AS.DT;
        facing.update(sim.W);
        ctx.fillStyle = AS.COLORS.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const s = cam.scale * dpr;
        if (cam.scale >= CELL_PX) {
          drawSprites(sim, cam, sheet, sel, dpr, nowMs);
        } else {
          fillCells(sim);
          const W = sim.W;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(cell.canvas, 0, 0, W.w, W.h, -cam.x * s, -cam.y * s, W.w * s, W.h * s);
          ctx.imageSmoothingEnabled = true;
        }
        if (sel) drawSelection(sim, cam, sel, dpr);
      },
    };
  };
})(globalThis.AS);
