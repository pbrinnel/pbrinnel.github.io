// What each drawable thing looks like: its id, glyph character and color, and the sheet
// that holds every glyph pre-rendered at one tile size so the renderer can copy from it.
//
// Palette: black ground, a few calm muted hues. Grass is the three greens (a sprout is the
// darkest so a young meadow recedes), bunnies a warm tan, wolves a gray-blue, humans a tunic brown (male) or green (female), a corpse
// bone. Sex is two shades of the species color; elders are the same hue dimmed. No pure
// saturated primaries.
(function (AS) {
  'use strict';

  const BACKGROUND = '#0a0c0a';
  const GRASS_COLORS = ['#2f5a33', '#4a8a4a', '#7fc06a'];   // sprout, middle, full
  const BUNNY_MALE = '#b98f58', BUNNY_FEMALE = '#dcb888';
  const WOLF_MALE = '#6f86a3', WOLF_FEMALE = '#98adc8';
  // Hunters: skin and tunic in one color a tile can carry, a warm ochre-brown (the sprite adds its own skin).
  const HUMAN_MALE = '#8c6a40', HUMAN_FEMALE = '#6f8f56';
  const CORPSE_COLOR = '#cfc6ac';
  // How much of the way an elder's color is pulled toward the background.
  const ELDER_DIM = 0.4;

  // The original font glyphs. The page draws sprites now (sprites.js); these remain for
  // GlyphSheet and the ids and colors other files still share.
  const GRASS_CHARS = ['░', '▒', '▓'];
  const BUNNY_CHAR = 'α', WOLF_CHAR = 'Ω', HUMAN_CHAR = 'Ψ', CORPSE_CHAR = '†';

  // Letters' ink fits a square this share of the tile, so neighbors keep a gap between
  // them; a baby's square is BABY_SCALE of that.
  const GLYPH_EM = 0.8;
  const BABY_SCALE = 0.65;
  // Sheets kept per tile size: zooming steps through sizes, and going back is common.
  // Glyphs are measured at this size and scaled down, so the ink box is precise at any px.
  const MEASURE_PX = 100;
  const SHEETS_KEPT = 4;
  const SHEET_COLS = 6;
  // Size of the sheet used to measure how much of its cell each glyph inks.
  const COVERAGE_PX = 24;

  const STAGE = AS.STAGE = Object.freeze({ BABY: 0, ADULT: 1, ELDER: 2 });
  const SP = AS.SPECIES, SEX = AS.SEX, KIND = AS.KIND;

  const N_SPECIES = AS.SPECIES_COUNT;
  // Ids: grass thirds, corpse, then species × sex × stage in a fixed block of six per species.
  const G = AS.GLYPH = {};
  G.GRASS_0 = 0; G.GRASS_1 = 1; G.GRASS_2 = 2; G.CORPSE = 3;
  const ANIMAL_BASE = 4;
  const names = [];
  names[G.GRASS_0] = 'GRASS_0'; names[G.GRASS_1] = 'GRASS_1'; names[G.GRASS_2] = 'GRASS_2';
  names[G.CORPSE] = 'CORPSE';
  const SPECIES_NAMES = ['BUNNY', 'WOLF', 'HUMAN'], SEX_NAMES = ['MALE', 'FEMALE'];
  const STAGE_NAMES = ['BABY', 'ADULT', 'ELDER'];
  for (let sp = 0; sp < N_SPECIES; sp++) for (let sx = 0; sx < 2; sx++) for (let st = 0; st < 3; st++) {
    const id = ANIMAL_BASE + (sp * 2 + sx) * 3 + st;
    G[`${SPECIES_NAMES[sp]}_${SEX_NAMES[sx]}_${STAGE_NAMES[st]}`] = id;
    names[id] = `${SPECIES_NAMES[sp]}_${SEX_NAMES[sx]}_${STAGE_NAMES[st]}`;
  }
  const COUNT = AS.GLYPH_COUNT = ANIMAL_BASE + N_SPECIES * 6;
  AS.GLYPH_NAMES = Object.freeze(names);

  AS.animalGlyph = (species, sex, stage) => ANIMAL_BASE + (species * 2 + sex) * 3 + stage;
  const isBabyId = id => id >= ANIMAL_BASE && (id - ANIMAL_BASE) % 3 === STAGE.BABY;

  function hexToRgb(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  function rgbToHex(c) {
    return '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  }
  function dim(hex) {
    const c = hexToRgb(hex), b = hexToRgb(BACKGROUND);
    return rgbToHex(c.map((v, i) => v + (b[i] - v) * ELDER_DIM));
  }

  const colors = AS.COLORS = { background: BACKGROUND };
  GRASS_COLORS.forEach((c, i) => { colors[i] = c; });
  colors[G.CORPSE] = CORPSE_COLOR;
  const speciesColor = [[BUNNY_MALE, BUNNY_FEMALE], [WOLF_MALE, WOLF_FEMALE], [HUMAN_MALE, HUMAN_FEMALE]];
  for (let sp = 0; sp < N_SPECIES; sp++) for (let sx = 0; sx < 2; sx++) {
    const base = speciesColor[sp][sx];
    colors[AS.animalGlyph(sp, sx, STAGE.BABY)] = base;
    colors[AS.animalGlyph(sp, sx, STAGE.ADULT)] = base;
    colors[AS.animalGlyph(sp, sx, STAGE.ELDER)] = dim(base);
  }

  // For ImageData on a little-endian machine: 0xAABBGGRR.
  function abgr(hex) {
    const [r, g, b] = hexToRgb(hex);
    return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
  }
  AS.CELL_BG = abgr(BACKGROUND);
  // Full glyph colors until a GlyphSheet measures coverage (the Node fallback).
  AS.CELL_COLOR = new Uint32Array(COUNT);
  for (let id = 0; id < COUNT; id++) AS.CELL_COLOR[id] = abgr(colors[id]);
  // Share of its cell each glyph inks (0–1); all 1 until measured.
  AS.GLYPH_COVERAGE = new Float32Array(COUNT).fill(1);

  // Cell mode paints a whole tile in one color, so it uses the glyph's apparent color: the
  // background blended toward the glyph color by how much of the cell the glyph covers.
  // That keeps the map from jumping in brightness when zoom crosses CELL_PX.
  function applyCoverage(cov) {
    const bg = hexToRgb(BACKGROUND);
    for (let id = 0; id < COUNT; id++) {
      const c = hexToRgb(colors[id]);
      AS.GLYPH_COVERAGE[id] = cov[id];
      AS.CELL_COLOR[id] = abgr(rgbToHex(c.map((v, i) => bg[i] + (v - bg[i]) * cov[id])));
    }
  }

  // The grass third (0, 1 or 2) of a Size in [0, 1]: [0,1/3), [1/3,2/3), [2/3,1].
  const THIRD = 1 / 3;
  AS.grassGlyph = size => (size < THIRD ? G.GRASS_0 : size < 2 * THIRD ? G.GRASS_1 : G.GRASS_2);

  // The static thing on tile t, or -1 for empty ground and for animals (drawn in their own
  // pass).
  AS.glyphFor = function (sim, t) {
    const W = sim.W, k = W.kind[t];
    if (k === KIND.GRASS) return AS.grassGlyph(W.gSize[t]);
    if (k === KIND.CORPSE) return G.CORPSE;
    return -1;
  };

  // Baby until it reaches TimeToMature, elder from ElderAt (a share) of its Lifespan.
  AS.stageOf = function (Tsp, age) {
    if (age < Tsp.TimeToMature) return STAGE.BABY;
    return age >= Tsp.ElderAt * Tsp.Lifespan ? STAGE.ELDER : STAGE.ADULT;
  };

  function charFor(id, T) {
    if (id <= G.GRASS_2) return (T && T.grass && T.grass.Glyph && T.grass.Glyph[id]) || GRASS_CHARS[id];
    if (id === G.CORPSE) return CORPSE_CHAR;
    const sp = ((id - ANIMAL_BASE) / 6) | 0;
    const own = T && T[AS.SPECIES_KEY[sp]] && T[AS.SPECIES_KEY[sp]].Glyph;
    return own || [BUNNY_CHAR, WOLF_CHAR, HUMAN_CHAR][sp];
  }

  // One sheet per integer device-pixel tile size, each glyph centered in a px × px cell on a
  // transparent ground. `T` is optional; without it the characters are the spec's.
  AS.GlyphSheet = function (font, T) {
    const cache = new Map();   // px → sheet; Map keeps insertion order, so the first is oldest
    const family = `"${font}", monospace`;

    function build(px) {
      const rows = Math.ceil(COUNT / SHEET_COLS);
      const canvas = document.createElement('canvas');
      canvas.width = SHEET_COLS * px;
      canvas.height = rows * px;
      const ctx = canvas.getContext('2d');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = `${MEASURE_PX}px ${family}`;
      for (let id = 0; id < COUNT; id++) {
        const ch = charFor(id, T);
        const m = ctx.measureText(ch);
        // Ink box relative to the draw origin (left, baseline), at MEASURE_PX.
        const inkL = -m.actualBoundingBoxLeft, inkT = -m.actualBoundingBoxAscent;
        const inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
        const inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
        const cx = (id % SHEET_COLS) * px, cy = ((id / SHEET_COLS) | 0) * px;
        ctx.save();
        // Clip so nothing bleeds into the neighbor cell of the sheet.
        ctx.beginPath();
        ctx.rect(cx, cy, px, px);
        ctx.clip();
        ctx.fillStyle = colors[id];
        if (id <= G.GRASS_2) {
          // Shade glyphs are half-width in a monospace font: stretch the ink box to the
          // whole cell so neighboring blades tile into one texture.
          ctx.setTransform(px / inkW, 0, 0, px / inkH, cx - inkL * px / inkW, cy - inkT * px / inkH);
        } else {
          // Letters keep their proportions, centered by ink on whole pixels so small sizes
          // stay crisp; the larger of ink width and height fills the square.
          const want = px * GLYPH_EM * (isBabyId(id) ? BABY_SCALE : 1);
          const k = Math.min(want / inkH, want / inkW);
          const tx = cx + Math.round((px - inkW * k) / 2) - inkL * k;
          const ty = cy + Math.round((px - inkH * k) / 2) - inkT * k;
          ctx.setTransform(k, 0, 0, k, tx, ty);
        }
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      }
      return { canvas, px, sx: id => (id % SHEET_COLS) * px, sy: id => ((id / SHEET_COLS) | 0) * px };
    }

    // Measured from a real render, so a font or glyph change is picked up automatically.
    try {
      const sh = build(COVERAGE_PX);
      const data = sh.canvas.getContext('2d').getImageData(0, 0, sh.canvas.width, sh.canvas.height).data;
      const stride = sh.canvas.width * 4, cov = new Float32Array(COUNT);
      for (let id = 0; id < COUNT; id++) {
        const x0 = sh.sx(id), y0 = sh.sy(id);
        let sum = 0;
        for (let y = 0; y < COVERAGE_PX; y++) {
          let i = (y0 + y) * stride + x0 * 4 + 3;
          for (let x = 0; x < COVERAGE_PX; x++, i += 4) sum += data[i];
        }
        cov[id] = sum / (255 * COVERAGE_PX * COVERAGE_PX);
      }
      applyCoverage(cov);
      cache.set(COVERAGE_PX, sh);
    } catch (e) { /* keeps the full colors */ }

    return {
      get(px) {
        let s = cache.get(px);
        if (s) return s;
        s = build(px);
        cache.set(px, s);
        if (cache.size > SHEETS_KEPT) cache.delete(cache.keys().next().value);
        return s;
      },
    };
  };
})(globalThis.AS);
