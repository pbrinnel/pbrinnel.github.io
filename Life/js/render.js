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
  // Water is the one big blue field of the far view; the sprites' own blue, a little lifted.
  const FAR_WATER_HEX = '#2f6495';
  // By depth band (AS.waterBand), shaded as the sprites are: shallow lighter, deep darker.
  const FAR_WATERS = [0, 1, 2].map(b => {
    const f = AS.WATER_DEPTH_SHADES[b], c = [1, 3, 5].map(i => parseInt(FAR_WATER_HEX.slice(i, i + 2), 16));
    return abgr('#' + c.map(v => Math.round(f <= 1 ? v * f : v + (255 - v) * (f - 1))).map(v => Math.min(255, v).toString(16).padStart(2, '0')).join(''));
  });
  // Humans are a bright pink-violet no other species or ground uses, so a hunter stands out from far away.
  const FAR_ANIMAL = [['#e0a868', '#f2cc96'], ['#8fb2e0', '#c0d6f2'], ['#e08fd8', '#f0b8ea']].map(r => r.map(abgr));   // [species][sex]

  // Scorched ground (a nuke's crater, W.scorch): a charcoal brown over the normal ground,
  // fading back to nothing as the tile's timer runs out. The far view mixes the same two
  // colors per tile; sprite mode lays translucent squares under everything else.
  const SCORCH_GROUND = '#2e231b';
  const FAR_SCORCH = abgr(SCORCH_GROUND);
  function mixAbgr(a, b, f) {
    if (f > 1) f = 1;
    const ch = sh => Math.round(((a >>> sh) & 255) * (1 - f) + ((b >>> sh) & 255) * f);
    return (0xff000000 | (ch(16) << 16) | (ch(8) << 8) | ch(0)) >>> 0;
  }
  const SCORCH_FADE_STEPS = 8;   // sprite mode quantizes the fade to this many alphas, so a big crater doesn't pay a state change per tile

  // The explosion, drawn over real time so it lasts the same at any sim speed. A thin ring
  // runs out to the blast radius while a soft orange-red glow swells and fades inside it.
  // Photosensitivity (DESIGN.md): the glow starts and ends at zero alpha and eases through
  // its peak, a single slow swell, never above BLAST_GLOW_PEAK, and it covers only the
  // blast circle; no white, no flicker, nothing full-screen.
  const BLAST_MS = 1500;
  const BLAST_RING_CSS_PX = 2;
  const BLAST_RING_PEAK = 0.5;
  const BLAST_RING_COLOR = '255,150,70';
  const BLAST_GLOW_PEAK = 0.45;
  const BLAST_GLOW_CENTER = '224,84,31', BLAST_GLOW_EDGE = '150,30,10';
  // The glow's alpha at 0 / 0.55 / 1 of its radius, as shares of the current peak: soft edge.
  const BLAST_GLOW_STOPS = [1, 0.5, 0];
  const MAX_BLASTS = 8;   // a hammered tap can't pile up work

  // A count in the Info tab, tapped, toggles rings around every one of that kind on the map,
  // steady (no pulsing: DESIGN.md Photosensitivity), drawn every frame so they follow the
  // animals and show paused. A ring is at least LOCATE_MIN_CSS_PX across, so it shows zoomed
  // far out where a tile is a dot. An animal off the screen gets a pip on the map's edge in
  // its direction, when there are no more than LOCATE_PIPS_MAX of that kind off it (pips for
  // thousands would only line the edges).
  const LOCATE_ALPHA = 0.9;
  const LOCATE_CSS_PX = 2;
  const LOCATE_MIN_CSS_PX = 14;
  const LOCATE_PIP_CSS_PX = 5;
  const LOCATE_PIPS_MAX = 200;
  // The graph's colors (graph.js), so a ring matches the kind's line; ui.js marks a toggled
  // count with the same color.
  const LOCATE_COLORS = AS.LOCATE_COLORS = Object.freeze({ blades: '25,158,112', bunnies: '217,89,38', wolves: '57,135,229', humans: '199,99,179', corpses: '200,200,190' });

  // Topo lines (Paul, 11 Oct 2026, over shading): a thin line every few meters (CONTOUR_M until
  // the viewer's slider picks another spacing) of
  // W.elev, every CONTOUR_BOLD_EVERY-th one bolder, under the grass and animals and never
  // over water. Worked out by marching squares over tile centers, kept in CONTOUR_CHUNK-tile
  // squares so a frame strokes only what is on screen; water moves, so a square on screen is
  // worked out again when the water in it has changed since.
  const CONTOUR_M = 5;                    // the spacing until the viewer picks one (setContourStep)
  const CONTOUR_BOLD_EVERY = 5;
  const CONTOUR_RGB = '176,186,150';
  const CONTOUR_ALPHA = 0.3, CONTOUR_BOLD_ALPHA = 0.54;
  const CONTOUR_CSS_PX = [1, 1.6];        // thin, bold: zoomed out
  const CONTOUR_NEAR_CSS_PX = [1.5, 2.5]; // thin, bold: at play zoom (sprites)
  const CONTOUR_CHUNK = 32;

  // The Radius slider's preview (Paul, 12 Oct 2026): a circle the size the armed mode will
  // cover, in the middle of the map, held RADIUS_HOLD_MS then faded out over RADIUS_FADE_MS
  // of real time, so it shows the size without staying in the way. One slow fade, no blink.
  const RADIUS_HOLD_MS = 500, RADIUS_FADE_MS = 1400;
  const RADIUS_RGB = '232,217,160', RADIUS_NUKE_RGB = '255,150,70';
  const RADIUS_FILL = 0.14, RADIUS_LINE = 0.9;

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
    const blasts = [];   // { x, y, r, t0 }: tile center, radius in tiles, real ms it began
    const reduceMotion = !!(globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
    // State ids by species, from states.csv names, for the poses that depend on what it is doing.
    let statesFor = null;
    const restState = AS.SPECIES_KEY.map(() => new Uint8Array(256));
    const mateState = AS.SPECIES_KEY.map(() => new Uint8Array(256));

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
      for (let sp = 0; sp < restState.length; sp++) {
        restState[sp].fill(0); mateState[sp].fill(0);
        const list = T.states[AS.SPECIES_KEY[sp]];
        for (let i = 0; i < list.length; i++) {
          if (list[i].name === 'REST' || list[i].name === 'GIVE_UP') restState[sp][i] = 1;
          if (list[i].name === 'MATE') mateState[sp][i] = 1;
        }
      }
    }

    // Which species a BITE event and a GRAZE event come from: hunters bite animals, bunnies and
    // humans eat blades (a hunter chewing through grass makes the same GRAZE but isn't marked).
    const BITES = [0, 1, 1], GRAZES = [1, 0, 1];
    // The animal next to `tile` of a species in `who` whose bite timer is running and whose
    // target is `tile`: who just bit or grazed there. Catches bites that a fast frame's timer misses.
    const nbAt = new Int32Array(4);
    function markBiter(W, tile, who, nowMs) {
      const k = W.neighbors4(tile, nbAt);
      for (let i = 0; i < k; i++) {
        const n = nbAt[i];
        if (W.kind[n] < KIND.BUNNY || !who[W.kind[n] - KIND.BUNNY]) continue;
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
            if (W.kind[tile] >= KIND.BUNNY) startHold(W, W.aSlot[tile], HOLD.FLINCH, nowMs, FLINCH_HOLD_MS);
            markBiter(W, tile, BITES, nowMs);
            break;
          case EV.GRAZE: markBiter(W, tile, GRAZES, nowMs); break;
          case EV.BIRTH:
            if (W.kind[tile] >= KIND.BUNNY) {
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
      const corpse = FAR_CORPSE, waters = FAR_WATERS, depth = W.wDepth, holeAt = W.hole, scorch = W.scorch, fullDays = sim.T.world.ScorchDays;
      const lo = 1 / 3, hi = 2 / 3;
      for (let t = 0, n = W.n; t < n; t++) {
        const k = kind[t];
        if (k === KIND.GRASS) { const z = size[t]; px[t] = z < lo ? g0 : z < hi ? g1 : g2; }
        else if (k === KIND.CORPSE) px[t] = corpse;
        else if (depth[t] > 0) px[t] = waters[AS.waterBand(depth[t])];   // under a wading animal too
        else if (scorch[t] > 0) px[t] = mixAbgr(bg, FAR_SCORCH, scorch[t] / fullDays);
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
      if (contoursOn) drawContours(sim, cam, dpr, true);
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
            // body with none to begin with (a species with no MeatOnBody) lies there for a moment after the death,
            // so it doesn't snap straight to a skull.
            if (W.cMeat[row + tx] > 0) id = AS.spriteCarcass(W.cSpecies[row + tx]);
            else if (nowMs < deathUntil[row + tx]) id = AS.spriteCarcass(W.cSpecies[row + tx]);
            else id = AS.spriteSkull(W.cSpecies[row + tx]);
          } else if (W.wDepth[row + tx] > 0) id = AS.spriteWater(tx, ty, AS.waterBand(W.wDepth[row + tx]));   // under a wading animal too
          else continue;   // empty, or an animal on land (own pass)
          const dx = Math.round(tx * s - ox), dw = Math.round((tx + 1) * s - ox) - dx;
          ctx.drawImage(img, sh.sx(id), sh.sy(id), px, px, dx, dy, dw, dh);
        }
      }
      drawScorch(sim, v, s, ox, oy);
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

    // Scorched tiles under everything else. Alpha is the share of ScorchDays left, in steps.
    function drawScorch(sim, v, s, ox, oy) {
      const W = sim.W, scorch = W.scorch, fullDays = sim.T.world.ScorchDays;
      let lastQ = 0;
      for (let ty = v.y0; ty <= v.y1; ty++) {
        const dy = Math.round(ty * s - oy), dh = Math.round((ty + 1) * s - oy) - dy;
        const row = ty * W.w;
        for (let tx = v.x0; tx <= v.x1; tx++) {
          const left = scorch[row + tx];
          if (!(left > 0)) continue;
          const q = Math.min(SCORCH_FADE_STEPS, Math.ceil(left / fullDays * SCORCH_FADE_STEPS));
          if (q !== lastQ) { ctx.globalAlpha = q / SCORCH_FADE_STEPS; if (!lastQ) ctx.fillStyle = SCORCH_GROUND; lastQ = q; }
          const dx = Math.round(tx * s - ox);
          ctx.fillRect(dx, dy, Math.round((tx + 1) * s - ox) - dx, dh);
        }
      }
      if (lastQ) ctx.globalAlpha = 1;
    }

    // The blast effects, over the world. Each runs BLAST_MS of real time, then is dropped.
    function drawBlasts(cam, dpr, nowMs) {
      const s = cam.scale * dpr;
      for (let i = blasts.length - 1; i >= 0; i--) {
        const b = blasts[i], p = (nowMs - b.t0) / BLAST_MS;
        if (p >= 1) { blasts.splice(i, 1); continue; }
        if (p < 0) continue;
        const cx = (b.x - cam.x) * s, cy = (b.y - cam.y) * s;
        const grow = 1 - Math.pow(1 - p, 3);          // fast at first, settling at the edge
        const r = b.r * s * (reduceMotion ? 1 : grow);
        // Swells from 0 to the peak at mid-way and back to 0: sin over the half turn.
        const glow = BLAST_GLOW_PEAK * Math.sin(Math.PI * p) * (reduceMotion ? 0.5 : 1);
        if (glow > 0.002 && r > 0.5) {
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, `rgba(${BLAST_GLOW_CENTER},${glow * BLAST_GLOW_STOPS[0]})`);
          g.addColorStop(0.55, `rgba(${BLAST_GLOW_EDGE},${glow * BLAST_GLOW_STOPS[1]})`);
          g.addColorStop(1, `rgba(${BLAST_GLOW_EDGE},${glow * BLAST_GLOW_STOPS[2]})`);
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        }
        if (!reduceMotion) {
          ctx.lineWidth = BLAST_RING_CSS_PX * dpr;
          ctx.strokeStyle = `rgba(${BLAST_RING_COLOR},${BLAST_RING_PEAK * (1 - p)})`;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }

    // ---- the Radius slider's preview ----
    let preview = null;   // { r (tiles), nuke, t0 (real ms) }
    function drawRadiusPreview(cam, dpr, nowMs) {
      const age = nowMs - preview.t0;
      if (age >= RADIUS_HOLD_MS + RADIUS_FADE_MS) { preview = null; return; }
      const a = age <= RADIUS_HOLD_MS ? 1 : 1 - (age - RADIUS_HOLD_MS) / RADIUS_FADE_MS;
      const s = cam.scale * dpr, r = Math.max(0.5, preview.r + 0.5) * s;
      const cx = canvas.width / 2, cy = canvas.height / 2, rgb = preview.nuke ? RADIUS_NUKE_RGB : RADIUS_RGB;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb},${RADIUS_FILL * a})`;
      ctx.fill();
      ctx.lineWidth = 2 * dpr;
      ctx.strokeStyle = `rgba(${rgb},${RADIUS_LINE * a})`;
      ctx.stroke();
    }

    // ---- topo lines ----
    let contoursOn = false, contourStep = CONTOUR_M;
    const contourCache = new WeakMap();   // world → Map(spacing → contour set, below)
    // Corners a, b, c, d: the centers of tiles (x, y), (x+1, y), (x+1, y+1), (x, y+1).
    const P = [null, [3, 0], [0, 1], [3, 1], [1, 2], [3, 0, 1, 2], [0, 2], [3, 2], [2, 3], [0, 2], [0, 1, 2, 3], [1, 2], [1, 3], [0, 1], [3, 0], null];
    const ex = new Float64Array(4), ey = new Float64Array(4), segThin = [], segBold = [];
    // A set: { step, cw, ch, thin[], bold[] (segments by square), wetN, wetSum (the water
    // each square was worked out with: how many wet tiles and the sum of their indices),
    // flips (W.wetFlips when squares were last marked), check (squares to look at again) }.
    function contoursFor(W) {
      let byStep = contourCache.get(W);
      if (!byStep) { byStep = new Map(); contourCache.set(W, byStep); }
      let c = byStep.get(contourStep);
      if (!c) {
        const cw = Math.ceil(W.w / CONTOUR_CHUNK), ch = Math.ceil(W.h / CONTOUR_CHUNK), m = cw * ch;
        c = { step: contourStep, cw, ch, thin: new Array(m), bold: new Array(m), wetN: new Float64Array(m), wetSum: new Float64Array(m), flips: W.wetFlips, check: new Uint8Array(m) };
        for (let i = 0; i < m; i++) buildSquare(W, c, i);
        byStep.set(contourStep, c);
      }
      if (c.flips !== W.wetFlips) { c.flips = W.wetFlips; c.check.fill(1); }
      return c;
    }
    // The tiles a square's lines read: its own and the row and column after.
    function squareTiles(W, c, i) {
      const cx = i % c.cw, cy = (i / c.cw) | 0;
      return [cx * CONTOUR_CHUNK, cy * CONTOUR_CHUNK, Math.min(W.w - 1, (cx + 1) * CONTOUR_CHUNK), Math.min(W.h - 1, (cy + 1) * CONTOUR_CHUNK)];
    }
    function squareWet(W, c, i) {
      const [x0, y0, x1, y1] = squareTiles(W, c, i), D = W.wDepth;
      let n = 0, sum = 0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const t = y * W.w + x; if (D[t] > 0) { n++; sum += t; } }
      return [n, sum];
    }
    function buildSquare(W, c, i) {
      const [x0, y0, x1, y1] = squareTiles(W, c, i), step = c.step;
      const E = W.elev, D = W.wDepth, w = W.w;
      segThin.length = 0; segBold.length = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i0 = y * w + x;
        if (D[i0] > 0 || D[i0 + 1] > 0 || D[i0 + w] > 0 || D[i0 + w + 1] > 0) continue;
        const a = E[i0], b = E[i0 + 1], c2 = E[i0 + w + 1], d = E[i0 + w];
        const lo = Math.min(a, b, c2, d), hi = Math.max(a, b, c2, d);
        for (let n = Math.max(1, Math.ceil(lo / step)); n * step < hi; n++) {
          const L = n * step;
          const k = (a > L) | (b > L) << 1 | (c2 > L) << 2 | (d > L) << 3, p = P[k];
          if (!p) continue;
          // Edge crossings: 0 top (a-b), 1 right (b-c), 2 bottom (d-c), 3 left (a-d).
          ex[0] = x + (L - a) / (b - a); ey[0] = y;
          ex[1] = x + 1; ey[1] = y + (L - b) / (c2 - b);
          ex[2] = x + (L - d) / (c2 - d); ey[2] = y + 1;
          ex[3] = x; ey[3] = y + (L - a) / (d - a);
          const out = n % CONTOUR_BOLD_EVERY === 0 ? segBold : segThin;
          for (let j = 0; j < p.length; j += 2) out.push(ex[p[j]] + 0.5, ey[p[j]] + 0.5, ex[p[j + 1]] + 0.5, ey[p[j + 1]] + 0.5);
        }
      }
      c.thin[i] = Float32Array.from(segThin);
      c.bold[i] = Float32Array.from(segBold);
      [c.wetN[i], c.wetSum[i]] = squareWet(W, c, i);
    }
    function drawContours(sim, cam, dpr, near) {
      const W = sim.W, c = contoursFor(W), s = cam.scale * dpr, ox = cam.x * s, oy = cam.y * s;
      const cx0 = Math.max(0, Math.floor(cam.x / CONTOUR_CHUNK)), cy0 = Math.max(0, Math.floor(cam.y / CONTOUR_CHUNK));
      const cx1 = Math.min(c.cw - 1, Math.floor((cam.x + canvas.width / s) / CONTOUR_CHUNK)), cy1 = Math.min(c.ch - 1, Math.floor((cam.y + canvas.height / s) / CONTOUR_CHUNK));
      const widths = near ? CONTOUR_NEAR_CSS_PX : CONTOUR_CSS_PX;
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        const i = cy * c.cw + cx;
        if (!c.check[i]) continue;
        c.check[i] = 0;
        const [n, sum] = squareWet(W, c, i);
        if (n !== c.wetN[i] || sum !== c.wetSum[i]) buildSquare(W, c, i);
      }
      for (const [list, alpha, width] of [[c.thin, CONTOUR_ALPHA, widths[0]], [c.bold, CONTOUR_BOLD_ALPHA, widths[1]]]) {
        ctx.beginPath();
        for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
          const seg = list[cy * c.cw + cx];
          for (let i = 0; i < seg.length; i += 4) {
            ctx.moveTo(seg[i] * s - ox, seg[i + 1] * s - oy);
            ctx.lineTo(seg[i + 2] * s - ox, seg[i + 3] * s - oy);
          }
        }
        ctx.lineWidth = width * dpr;
        ctx.strokeStyle = `rgba(${CONTOUR_RGB},${alpha})`;
        ctx.stroke();
      }
    }

    // The rings (see LOCATE_ALPHA), one kind at a time: one path each, as there may be
    // thousands of blades.
    let located = null, locTop = 0;   // a Set of kinds, and the CSS px the HUD covers at the top
    function drawLocate(sim, cam, dpr, key) {
      const W = sim.W, s = cam.scale * dpr;
      const r = Math.max(LOCATE_MIN_CSS_PX * dpr, s * 1.6) / 2;
      const cw = canvas.width, ch = canvas.height;
      const x0 = Math.max(0, Math.floor(cam.x - 1)), y0 = Math.max(0, Math.floor(cam.y - 1));
      const x1 = Math.min(W.w - 1, Math.ceil(cam.x + cw / s + 1)), y1 = Math.min(W.h - 1, Math.ceil(cam.y + ch / s + 1));
      const ring = (tx, ty) => {
        const cx = (tx + 0.5 - cam.x) * s, cy = (ty + 0.5 - cam.y) * s;
        ctx.moveTo(cx + r, cy);
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      };
      ctx.beginPath();
      let pips = 0;
      const species = { bunnies: AS.SPECIES.BUNNY, wolves: AS.SPECIES.WOLF, humans: AS.SPECIES.HUMAN }[key];
      if (species !== undefined) {
        for (let a = 0, hi = W.aHigh; a < hi; a++) {
          if (!W.aAlive[a] || W.aSpecies[a] !== species) continue;
          animalPos(W, a, curAlpha, pos);
          if (pos[0] < x0 || pos[0] > x1 || pos[1] < y0 || pos[1] > y1) {
            if (pips < LOCATE_PIPS_MAX) { offPip[pips * 2] = pos[0]; offPip[pips * 2 + 1] = pos[1]; }
            pips++;
            continue;
          }
          ring(pos[0], pos[1]);
        }
      } else {
        const kind = key === 'blades' ? KIND.GRASS : KIND.CORPSE;
        for (let ty = y0; ty <= y1; ty++) {
          const row = ty * W.w;
          for (let tx = x0; tx <= x1; tx++) if (W.kind[row + tx] === kind) ring(tx, ty);
        }
      }
      const a = LOCATE_ALPHA, color = LOCATE_COLORS[key];
      ctx.lineWidth = (LOCATE_CSS_PX + 2) * dpr;
      ctx.strokeStyle = `rgba(0,0,0,${a * 0.6})`;
      ctx.stroke();
      ctx.lineWidth = LOCATE_CSS_PX * dpr;
      ctx.strokeStyle = `rgba(${color},${a})`;
      ctx.stroke();
      if (pips > 0 && pips <= LOCATE_PIPS_MAX) {
        // Each pip sits where the line from the screen's middle toward the animal leaves the screen.
        // The edges are the visible map's: below the HUD bar (locTop, CSS px) as well.
        const top = locTop * dpr, mx = cw / 2, my = (ch + top) / 2, inset = LOCATE_PIP_CSS_PX * dpr * 1.5;
        ctx.beginPath();
        for (let i = 0; i < pips; i++) {
          const dx = (offPip[i * 2] + 0.5 - cam.x) * s - mx, dy = (offPip[i * 2 + 1] + 0.5 - cam.y) * s - my;
          const k = Math.min((mx - inset) / Math.max(Math.abs(dx), 1e-9), (my - top - inset) / Math.max(Math.abs(dy), 1e-9));
          const px = mx + dx * k, py = my + dy * k, pr = LOCATE_PIP_CSS_PX * dpr;
          ctx.moveTo(px + pr, py);
          ctx.arc(px, py, pr, 0, Math.PI * 2);
        }
        ctx.fillStyle = `rgba(${color},${a})`;
        ctx.fill();
        ctx.lineWidth = dpr;
        ctx.strokeStyle = `rgba(0,0,0,${a * 0.6})`;
        ctx.stroke();
      }
    }
    const offPip = new Float64Array(LOCATE_PIPS_MAX * 2);

    // One path per species-and-sex color, one stroke each: there may be thousands of lines.
    // only >= 0 draws just that slot's line.
    function drawIntent(sim, v, s, ox, oy, dpr, only) {
      const W = sim.W, alpha = curAlpha, half = s / 2;
      const line = INTENT_CSS_PX * dpr, halo = INTENT_HALO_CSS_PX * dpr;
      ctx.globalAlpha = INTENT_ALPHA;
      for (let grp = 0; grp < AS.SPECIES_COUNT * 2; grp++) {
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
      setContours(on) { contoursOn = !!on; },
      // Meters between topo lines (each spacing is worked out once per world, then kept).
      setContourStep(m) { if (m > 0) contourStep = m; },
      get contourStep() { return contourStep; },
      // The far view's one-pixel-per-tile picture of the world, brought up to date (the minimap draws it).
      farCanvas(sim) { fillCells(sim); return cell.canvas; },
      get contours() { return contoursOn; },
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
          if (contoursOn) drawContours(sim, cam, dpr, false);
        }
        if (blasts.length) drawBlasts(cam, dpr, nowMs);
        if (located) for (const key of located) if (LOCATE_COLORS[key]) drawLocate(sim, cam, dpr, key);
        if (sel) drawSelection(sim, cam, sel, dpr);
        if (preview) drawRadiusPreview(cam, dpr, nowMs);
      },
      // Show the size a radius covers (tiles; a nuke's in its own color), fading from nowMs.
      radiusPreview(r, nuke, nowMs) { preview = { r, nuke: !!nuke, t0: nowMs }; },
      // The kinds to ring ('bunnies', 'wolves', 'humans', 'blades', 'corpses'): a Set, read
      // every frame; top is how many CSS px of the canvas's top the HUD covers, so pips stay below it.
      locate(kinds, top) { located = kinds && kinds.size ? kinds : null; locTop = top || 0; },
      get located() { return located ? [...located] : []; },
      // A nuke went off at tile (tx, ty), radius in tiles; the effect starts now (real time).
      blast(tx, ty, radius, nowMs) {
        if (blasts.length >= MAX_BLASTS) blasts.shift();
        blasts.push({ x: tx + 0.5, y: ty + 0.5, r: radius, t0: nowMs === undefined ? performance.now() : nowMs });
      },
      get blasts() { return blasts.length; },
    };
  };
})(globalThis.AS);
