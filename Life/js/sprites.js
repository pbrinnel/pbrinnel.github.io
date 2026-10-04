// What close-up drawing looks like: 8x8 pixel-art sprites with a walk animation, and the
// sheet that holds every sprite pre-rendered at one tile size so the renderer can copy
// from it (the same shape glyphs.js's GlyphSheet returns). Sprites replaced the font
// glyphs because letters can't show which way an animal faces or that it is walking.
//
// Bitmaps face right; a left-facing sprite is painted mirrored into its own sheet slot, so
// the renderer never flips at draw time. Codes: x base color, d darker (shade), w lighter
// (highlight), e eye, y amber eye, n nose, f fang. Colors come from AS.COLORS (glyphs.js),
// so the species and sexes still read the same as the HUD.
//
// The sheet is DOM-free until a canvas is asked for, so Node checks can load this file for
// the pose rule and the index helpers.
(function (AS) {
  'use strict';

  const SIZE = 8;   // bitmap rows and columns

  // ---- bitmaps ----------------------------------------------------------------------
  // Bunny: sit (standing), stretch (mid-hop), ear (idle fidget).
  const BUNNY = [
    ['.....x..', '.....xx.', '.....xx.', '..xxxxxx', '.xxxxxex', 'wxxxxxx.', '.xxxxxx.', '..d..dd.'],
    ['......x.', '.....xx.', '.....xx.', '.xxxxxxx', 'wxxxxxex', '.xxxxxx.', 'dd....dd', '........'],
    ['......x.', '.....x..', '.....xx.', '..xxxxxx', '.xxxxxex', 'wxxxxxx.', '.xxxxxx.', '..d..dd.'],
  ];
  // Wolf: stand, stride (legs apart), wag (tail up, idle).
  const WOLF = [
    ['.....x.x', '.....xxx', 'd...xxyx', '.dxxxxxn', '..xxxxx.', '..xwwxx.', '..d.d.d.', '..d.d.d.'],
    ['.....x.x', '.....xxx', 'd...xxyx', '.dxxxxxn', '..xxxxx.', '..xwwxx.', '.d..d..d', 'd...d...'],
    ['.....x.x', 'd....xxx', '.d..xxyx', '..xxxxxn', '..xxxxx.', '..xwwxx.', '..d.d.d.', '..d.d.d.'],
  ];
  const CORPSE_BITMAP =
    ['........', '........', '.x....x.', 'xx....xx', '.xxxxxx.', 'xx....xx', '.x....x.', '........'];
  // Sprout, middle, full: the three thirds of a blade's size.
  const GRASS_BITMAPS = [
    ['........', '........', '........', '........', '...x....', '....x...', '..x.x...', '...dd...'],
    ['........', '........', '..x..x..', '...x.x..', '.x.x.x..', '..xx.xx.', '..xxxx..', '...dd...'],
    ['.x...x..', '..x.x..x', 'x.x.x.x.', '.xx.xxx.', '.x.xx.x.', 'xx.xx.xx', '.xxxxxx.', '..dddd..'],
  ];
  const BITMAPS = { bunny: BUNNY, wolf: WOLF, corpse: CORPSE_BITMAP, grass: GRASS_BITMAPS };
  AS.SPRITE_BITMAPS = BITMAPS;
  AS.SPRITE_CODES = 'xdweynf';
  AS.SPRITE_SIZE = SIZE;

  // ---- palette ----------------------------------------------------------------------
  const GRASS_COLORS = ['#4f7a3c', '#5e9a46', '#7fc06a'];
  const SHADE_DARK = 0.6, SHADE_LIGHT = 1.35;
  const ELDER_BRIGHTNESS = 0.72;
  const EYE = '#141210', AMBER = '#e8b84a', NOSE = '#1a1a1e', FANG = '#f2ece0';
  // Babies and corpses are drawn smaller than a tile, bottom-centered.
  const BABY_SCALE = 0.6, CORPSE_SCALE = 0.8;
  // Smallest edge of a scaled sprite, in px, so it never vanishes at tiny tile sizes.
  const MIN_SCALED_PX = 2;

  function hexToRgb(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }
  // f below 1 darkens toward black, above 1 lightens toward white.
  function shade(h, f) {
    const c = hexToRgb(h).map(v => (f <= 1 ? v * f : v + (255 - v) * (f - 1)));
    return '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }

  // ---- animation --------------------------------------------------------------------
  // Per species: the frame shown across each equal slice of a step (cycle), how many sprite
  // pixels the body rises in that slice (lift), and the frame used while fidgeting (idle).
  // Frame 0 is the standing pose.
  const ANIM = [
    { cycle: [1, 1, 0], lift: [1, 1, 0], idle: 2 },          // bunny: hops
    { cycle: [1, 1, 0, 0], lift: [0, 1, 0, 0], idle: 2 },    // wolf: strides, bobs once
  ];
  const FRAMES = 3;                 // frames per species in the sheet
  const IDLE_PERIOD = 4;            // seconds between an idle animal's fidgets
  const IDLE_LEN = 0.35;            // seconds each fidget lasts
  const HASH_MUL = 2654435761;      // Knuth's multiplicative hash, to spread serials

  // Each animal's idle clock starts at its own offset, so a crowd doesn't fidget in unison.
  AS.spriteIdleOffset = serial => ((Math.imul(serial, HASH_MUL) >>> 0) / 4294967296) * IDLE_PERIOD;

  // Which frame and how many sprite pixels of lift for an animal of `species` that is (or
  // isn't) mid-step, p (0-1) of the way through it, at idle clock `clock` seconds. Writes
  // out[0] = frame, out[1] = lift.
  AS.spritePose = function (species, moving, p, clock, out) {
    const a = ANIM[species];
    if (moving) {
      const n = a.cycle.length, k = Math.min(n - 1, Math.floor(p * n));
      out[0] = a.cycle[k]; out[1] = a.lift[k];
    } else {
      out[0] = clock % IDLE_PERIOD < IDLE_LEN ? a.idle : 0;
      out[1] = 0;
    }
  };

  // ---- sheet layout -----------------------------------------------------------------
  // Animals: ((((species*2+sex)*3+stage)*2+faceLeft)*FRAMES+frame), then the corpse, then
  // the three grass thirds.
  const ANIMAL_SPRITES = 2 * 2 * 3 * 2 * FRAMES;
  const CORPSE = ANIMAL_SPRITES, GRASS0 = CORPSE + 1, COUNT = GRASS0 + 3;
  const SHEET_COLS = 19;
  AS.SPRITE_COUNT = COUNT;
  AS.SPRITE_FRAMES = FRAMES;
  AS.SPRITE_CORPSE = CORPSE;
  AS.spriteGrass = third => GRASS0 + third;
  AS.spriteIndex = (species, sex, stage, faceLeft, frame) =>
    (((species * 2 + sex) * 3 + stage) * 2 + faceLeft) * FRAMES + frame;

  // Which way each animal faces: the direction of its last sideways step, kept per slot
  // (a slot is reused, so the serial says whether the memory belongs to this animal).
  // update() runs once per frame; an animal that has only moved up or down keeps its side.
  AS.SpriteFacing = function () {
    let left = new Uint8Array(0), serial = new Uint32Array(0);
    return {
      update(W) {
        if (left.length < W.aCap) {
          const l = new Uint8Array(W.aCap), s = new Uint32Array(W.aCap);
          l.set(left); s.set(serial);
          left = l; serial = s;
        }
        for (let a = 0, hi = W.aHigh; a < hi; a++) {
          if (!W.aAlive[a]) continue;
          if (serial[a] !== W.aSerial[a]) { serial[a] = W.aSerial[a]; left[a] = 0; }
          const dx = W.aTile[a] % W.w - W.aFrom[a] % W.w;
          if (dx < 0) left[a] = 1; else if (dx > 0) left[a] = 0;
        }
      },
      left: a => left[a],
    };
  };

  // Paints one bitmap into the px x px cell at (ox, oy) of g. A scaled sprite is bottom-
  // centered in its cell; its pixels land on whole device pixels.
  function paint(g, ox, oy, px, map, base, flip, scale) {
    const b = Math.max(MIN_SCALED_PX, Math.round(px * scale));
    const off = ox + Math.floor((px - b) / 2), top = oy + px - b;
    const col = {
      x: base, d: shade(base, SHADE_DARK), w: shade(base, SHADE_LIGHT),
      e: EYE, y: AMBER, n: NOSE, f: FANG,
    };
    for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
      const c = map[j][i];
      if (c === '.') continue;
      const ci = flip ? SIZE - 1 - i : i;
      const x0 = off + Math.round(ci * b / SIZE), x1 = off + Math.round((ci + 1) * b / SIZE);
      const y0 = top + Math.round(j * b / SIZE), y1 = top + Math.round((j + 1) * b / SIZE);
      g.fillStyle = col[c];
      g.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
    }
  }

  // One sheet per integer device-pixel tile size. `T` is unused (kept so main.js builds
  // it the way it built the glyph sheet).
  const SHEETS_KEPT = 4;
  AS.SpriteSheet = function (T) {
    const cache = new Map();   // px -> sheet; Map keeps insertion order, so the first is oldest
    const sx = i => (i % SHEET_COLS), sy = i => ((i / SHEET_COLS) | 0);

    function build(px) {
      const rows = Math.ceil(COUNT / SHEET_COLS);
      const canvas = document.createElement('canvas');
      canvas.width = SHEET_COLS * px;
      canvas.height = rows * px;
      const g = canvas.getContext('2d');
      const at = (i, f) => f(sx(i) * px, sy(i) * px);
      for (let sp = 0; sp < 2; sp++) for (let sx2 = 0; sx2 < 2; sx2++) for (let st = 0; st < 3; st++) {
        let base = AS.COLORS[AS.animalGlyph(sp, sx2, AS.STAGE.ADULT)];
        if (st === AS.STAGE.ELDER) base = shade(base, ELDER_BRIGHTNESS);
        const frames = sp ? WOLF : BUNNY;
        for (let fl = 0; fl < 2; fl++) for (let fr = 0; fr < FRAMES; fr++) {
          at(AS.spriteIndex(sp, sx2, st, fl, fr), (x, y) =>
            paint(g, x, y, px, frames[fr], base, fl === 1, st === AS.STAGE.BABY ? BABY_SCALE : 1));
        }
      }
      at(CORPSE, (x, y) => paint(g, x, y, px, CORPSE_BITMAP, AS.COLORS[AS.GLYPH.CORPSE], false, CORPSE_SCALE));
      for (let i = 0; i < 3; i++) at(GRASS0 + i, (x, y) => paint(g, x, y, px, GRASS_BITMAPS[i], GRASS_COLORS[i], false, 1));
      return { canvas, px, sx: i => sx(i) * px, sy: i => sy(i) * px };
    }

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
