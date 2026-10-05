// What close-up drawing looks like: 8x8 pixel-art sprites with a walk animation, and the
// sheet that holds every sprite pre-rendered at one tile size so the renderer can copy
// from it (the same shape glyphs.js's GlyphSheet returns). Sprites replaced the font
// glyphs because letters can't show which way an animal faces or that it is walking.
//
// Bitmaps face right; a left-facing sprite is painted mirrored into its own sheet slot, so
// the renderer never flips at draw time. Codes: x base color, d darker (shade), w lighter
// (highlight), e eye, y amber eye, n nose, f fang, p pink (tongue), s skin, q spear
// shaft, m spearhead. Colors come from AS.COLORS (glyphs.js),
// so the species and sexes still read the same as the HUD.
//
// The sheet is DOM-free until a canvas is asked for, so Node checks can load this file for
// the pose rule and the index helpers.
(function (AS) {
  'use strict';

  const SIZE = 8;   // bitmap rows and columns

  // ---- bitmaps ----------------------------------------------------------------------
  // Frames, in the order every species lists them (FRAME below names the slots): stand,
  // walk, idle fidget, act (bunny eats, wolf bites), runA, runB, rest, winded, dead,
  // pregnant. A bunny never shows winded, so its slot repeats rest and the sheet keeps one
  // shape for every species. A human never shows pregnant either (it never breeds), so that
  // slot repeats stand.
  const BUNNY_REST = ['........', '........', '........', '....xxx.', '.xxxxxxx', 'wxxxxxex', 'xxxxxxxx', '.d....d.'];
  const BUNNY = [
    ['.....x..', '.....xx.', '.....xx.', '..xxxxxx', '.xxxxxex', 'wxxxxxx.', '.xxxxxx.', '..d..dd.'],
    ['......x.', '.....xx.', '.....xx.', '.xxxxxxx', 'wxxxxxex', '.xxxxxx.', 'dd....dd', '........'],
    ['......x.', '.....x..', '.....xx.', '..xxxxxx', '.xxxxxex', 'wxxxxxx.', '.xxxxxx.', '..d..dd.'],
    ['........', '........', '..xxxx..', '.xxxxxxx', 'wxxxxxxx', '.xxxxxex', '.xxxxxxn', '..d..dd.'],
    ['........', '...xx...', '....xx..', '.xxxxxxx', 'wxxxxxex', '.xxxxxx.', 'd.....dd', '........'],
    ['........', '...xx...', '....xx..', '.xxxxxxx', 'wxxxxxex', '.xxxxxx.', '..dd.d..', '...d.d..'],
    BUNNY_REST,
    BUNNY_REST,
    ['........', '........', '..d..d..', '.xxxxxx.', 'wxxxxxxx', '.xxxxxxx', '......xx', '........'],
    ['.....x..', '.....xx.', '.....xx.', '..xxxxxx', '.xxxxxex', 'wxxxxxxx', 'xxwwwwx.', '.dd..dd.'],
  ];
  const WOLF = [
    ['.....x.x', '.....xxx', 'd...xxyx', '.dxxxxxn', '..xxxxx.', '..xwwxx.', '..d.d.d.', '..d.d.d.'],
    ['.....x.x', '.....xxx', 'd...xxyx', '.dxxxxxn', '..xxxxx.', '..xwwxx.', '.d..d..d', 'd...d...'],
    ['.....x.x', 'd....xxx', '.d..xxyx', '..xxxxxn', '..xxxxx.', '..xwwxx.', '..d.d.d.', '..d.d.d.'],
    ['........', '.....x.x', 'd....xxx', '.dxxxxyx', '..xxxxxn', '..xwwx.f', '.d..d..d', 'd....d..'],
    ['........', '....xx..', 'd...xxyx', 'dxxxxxxn', '.xxxxxx.', '.xwwxx..', 'dd....dd', '........'],
    ['........', '....xx..', 'd...xxyx', 'dxxxxxxn', '.xxxxxx.', '.xwwxx..', '..ddd...', '..d.d...'],
    ['........', '........', '........', '.....x.x', '.....xxx', 'd...xxyx', 'dxxxxxxn', '.xxxxxdd'],
    ['........', '........', '........', '.....x.x', '.....xxx', 'd...xxyx', 'dxxxxxxn', '.xxxxxdp'],
    ['........', '........', '..d.d.d.', '.xxxxxx.', 'dxxxxxxx', '.xwwxxxx', '.....xdx', '.....x.x'],
    ['.....x.x', '.....xxx', 'd...xxyx', '.dxxxxxn', '.xxxxxx.', '.xwwwwx.', '..d.d.d.', '..d.d.d.'],
  ];
  // A hunter with a spear, upright and facing right: head (s skin, e eye), tunic (x), spear
  // (q shaft, m head) held upright at the right edge so it reads as a spear, not a stick.
  const HUMAN_STAND = ['......m.', '...ss.q.', '...se.q.', '..xxxxq.', '..xxxsq.', '..xxx.q.', '..s.s.q.', '..d.d.q.'];
  const HUMAN = [
    HUMAN_STAND,
    ['......m.', '...ss.q.', '...se.q.', '..xxxxq.', '..xxxsq.', '..xxx.q.', '.s...sq.', '.d...dq.'],
    ['........', '...ss.m.', '...se.q.', '..xxxxq.', '..xxxsq.', '..xxx.q.', '..s.s.q.', '..d.d.q.'],
    ['........', '...ss...', '...se...', '..xxxs..', '..xxsqqm', '..xx.s..', '.s...s..', '.d...d..'],
    ['........', '....ss..', '....se..', '..xxxx..', '.xxxxsqm', '..xxx...', '.s...s..', 's.....d.'],
    ['........', '....ss..', '....se..', '..xxxx..', '.xxxxsqm', '..xxx...', '..s.s...', '...dd...'],
    ['........', '......m.', '......q.', '...ss.q.', '...se.q.', '..xxxsq.', '..xxxxq.', '..dsssq.'],
    ['........', '........', '........', '........', '....ss.m', '..xxse.q', '..xxxxq.', '..dsssq.'],
    ['........', '........', '........', '........', '........', '.xxxxxse', 'dqqqqqqm', '........'],
    HUMAN_STAND,
  ];
  // A body with meat still on it lies flat with its eye shut (Paul's pick: it reads as
  // dead at full zoom, where X eyes or legs-up read as a blob); once the meat is gone,
  // a skull is left until the corpse rots away. By species.
  const CARCASS_BITMAPS = [
    ['........', '........', '........', '......x.', '.....xx.', '..xxxxxx', 'wxxxxxdx', '.xxxxxxx'],
    ['........', '........', '........', '.....x.x', '.....xxx', 'd...xxdx', 'dxxxxxxn', '.xxxxxdd'],
    ['........', '........', '........', '......ss', 'dxxxxxsd', 'ssxxxqqm', '........', '........'],
  ];
  const SKULL_BITMAPS = [
    ['........', '........', '........', '..xxxx..', '.xxxxxxx', '.xdxxxxx', '..xxx.x.', '...x.x..'],
    ['........', '........', '..x..x..', '.xxxx...', 'xxxxxxxx', 'xdxxxxxx', '.xxx.x.x', '........'],
    ['........', '........', '..xxxx..', '.xxxxxx.', '.xdxxdx.', '.xxxxxx.', '..xxxx..', '..x.x.x.'],
  ];
  // Sprout, middle, full: the three thirds of a blade's size.
  const GRASS_BITMAPS = [
    ['........', '........', '........', '........', '...x....', '....x...', '..x.x...', '...dd...'],
    ['........', '........', '..x..x..', '...x.x..', '.x.x.x..', '..xx.xx.', '..xxxx..', '...dd...'],
    ['.x...x..', '..x.x..x', 'x.x.x.x.', '.xx.xxx.', '.x.xx.x.', 'xx.xx.xx', '.xxxxxx.', '..dddd..'],
  ];
  // A gust leans a tuft: its top LEAN_ROWS rows shift one pixel right, the roots stay put.
  const LEAN_ROWS = 4;
  const GRASS_LEAN = GRASS_BITMAPS.map(m => m.map((row, j) => (j < LEAN_ROWS ? '.' + row.slice(0, SIZE - 1) : row)));
  // A warren hole: a dark opening in a rim of lighter dirt (r rim, o opening), earthy on
  // purpose so it never reads as an animal. The peeking bunny is the same hole with ears and eyes
  // up out of it, in the bunny's own colors (x body, d inner ear, e eye).
  const HOLE_BITMAP = ['........', '..rrrr..', '.rroorr.', 'rroooorr', 'rroooorr', '.rroorr.', '..rrrr..', '........'];
  const PEEK_BITMAP = ['..x..x..', '..d..d..', '.rxxxxr.', 'rrxexexr', 'rroooorr', '.rroorr.', '..rrrr..', '........'];
  const BITMAPS = { hole: [HOLE_BITMAP], peek: [PEEK_BITMAP], bunny: BUNNY, wolf: WOLF, human: HUMAN, carcass: CARCASS_BITMAPS, skull: SKULL_BITMAPS, grass: GRASS_BITMAPS, grassLean: GRASS_LEAN };
  AS.SPRITE_BITMAPS = BITMAPS;
  AS.SPRITE_CODES = 'xdweynfprosqm';
  AS.SPRITE_SIZE = SIZE;

  // ---- palette ----------------------------------------------------------------------
  const GRASS_COLORS = ['#4f7a3c', '#5e9a46', '#7fc06a'];
  const SHADE_DARK = 0.6, SHADE_LIGHT = 1.35;
  // A carcass is its species' color at this brightness, so it never reads as a live animal.
  const CARCASS_BRIGHTNESS = 0.65;
  const ELDER_BRIGHTNESS = 0.72;
  const HOLE_RIM = '#8a6a45', HOLE_DARK = '#150f0a';
  const EYE = '#141210', AMBER = '#e8b84a', NOSE = '#1a1a1e', FANG = '#f2ece0', TONGUE = '#d99a9a';
  const SKIN = '#d9a066', SHAFT = '#a07a4a', SPEARHEAD = '#d4d8dc';
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
  const FRAME = AS.SPRITE_FRAME = Object.freeze({
    STAND: 0, WALK: 1, IDLE: 2, ACT: 3, RUN_A: 4, RUN_B: 5, REST: 6, WINDED: 7, DEAD: 8, PREGNANT: 9,
  });
  // What an event is holding an animal in, set by the renderer and lasting a fixed span of
  // real time: a flinch from a bite, a mouthful or a bite of its own, a birth's hop.
  const HOLD = AS.SPRITE_HOLD = Object.freeze({ NONE: 0, FLINCH: 1, ACTION: 2, BIRTH: 3 });
  // Per species: the frame shown across each equal slice of a walking step (cycle), how many
  // sprite pixels the body rises in that slice (lift), and the frame used while fidgeting.
  // winds: whether the species has a panting frame for being out of breath (a bunny rests instead).
  const ANIM = [
    { cycle: [1, 1, 0], lift: [1, 1, 0], idle: FRAME.IDLE, winds: false },          // bunny: hops
    { cycle: [1, 1, 0, 0], lift: [0, 1, 0, 0], idle: FRAME.IDLE, winds: true },     // wolf: strides, bobs once
    { cycle: [1, 1, 0, 0], lift: [0, 1, 0, 0], idle: FRAME.IDLE, winds: true },     // human: strides, bobs once
  ];
  // A sprint's step is two halves: legs out and airborne, then gathered.
  const RUN_CYCLE = [FRAME.RUN_A, FRAME.RUN_B], RUN_LIFT = [1, 0];
  const FRAMES = 10;                // frames per species in the sheet
  const IDLE_PERIOD = 4;            // seconds between an idle animal's fidgets
  const IDLE_LEN = 0.35;            // seconds each fidget lasts
  const HASH_MUL = 2654435761;      // Knuth's multiplicative hash, to spread serials
  // A step shorter than this in real time (fast speeds) would flicker the legs, so the
  // animal glides in its standing pose instead (DESIGN.md, Photosensitivity).
  const MIN_STEP_REAL_MS = AS.SPRITE_MIN_STEP_MS = 180;

  // Each animal's idle clock starts at its own offset, so a crowd doesn't fidget in unison.
  AS.spriteIdleOffset = serial => ((Math.imul(serial, HASH_MUL) >>> 0) / 4294967296) * IDLE_PERIOD;

  // Which frame and how many sprite pixels of lift for an animal, by priority: an event's
  // hold, then a sprint's run cycle, then a walk, then (standing) winded, resting,
  // pregnant, an idle fidget, plain standing. stepMs is how long the current step lasts in
  // real time (Infinity when paused); p (0-1) is how far through it; clock is the idle
  // clock in seconds. Writes out[0] = frame, out[1] = lift. (A death is drawn by the
  // renderer from the corpse, since the animal is gone by then.)
  AS.spritePose = function (species, moving, sprinting, resting, winded, pregnant, hold, stepMs, p, clock, out) {
    const a = ANIM[species];
    out[1] = 0;
    if (hold === HOLD.FLINCH) { out[0] = FRAME.RUN_A; return; }
    if (hold === HOLD.ACTION) { out[0] = FRAME.ACT; return; }
    if (hold === HOLD.BIRTH) { out[0] = FRAME.WALK; out[1] = 1; return; }
    if (moving && stepMs >= MIN_STEP_REAL_MS) {
      const cycle = sprinting ? RUN_CYCLE : a.cycle, lift = sprinting ? RUN_LIFT : a.lift;
      const n = cycle.length, k = Math.min(n - 1, Math.floor(p * n));
      out[0] = cycle[k]; out[1] = lift[k];
      return;
    }
    if (moving) { out[0] = pregnant ? FRAME.PREGNANT : FRAME.STAND; return; }
    if (a.winds && winded) { out[0] = FRAME.WINDED; return; }
    if (resting) { out[0] = FRAME.REST; return; }
    if (pregnant) { out[0] = FRAME.PREGNANT; return; }
    out[0] = clock % IDLE_PERIOD < IDLE_LEN ? a.idle : FRAME.STAND;
  };

  // ---- sheet layout -----------------------------------------------------------------
  // Animals: ((((species*2+sex)*3+stage)*2+faceLeft)*FRAMES+frame), then each species'
  // skull, the three grass thirds, the three leaning ones, each species' carcass, the hole,
  // and the bunny peeking out of it (by sex).
  const N_SPECIES = AS.SPECIES_COUNT;
  const ANIMAL_SPRITES = N_SPECIES * 2 * 3 * 2 * FRAMES;
  const SKULL0 = ANIMAL_SPRITES, GRASS0 = SKULL0 + N_SPECIES, LEAN0 = GRASS0 + 3, CARCASS0 = LEAN0 + 3;
  const HOLE0 = CARCASS0 + N_SPECIES, PEEK0 = HOLE0 + 1, COUNT = PEEK0 + 2;
  const SHEET_COLS = 19;
  const BY_SPECIES = [BUNNY, WOLF, HUMAN];
  AS.SPRITE_COUNT = COUNT;
  AS.SPRITE_FRAMES = FRAMES;
  AS.spriteSkull = species => SKULL0 + species;
  AS.spriteGrass = third => GRASS0 + third;
  AS.spriteGrassLean = third => LEAN0 + third;
  AS.spriteCarcass = species => CARCASS0 + species;
  AS.spriteHole = () => HOLE0;
  AS.spritePeek = sex => PEEK0 + sex;   // a bunny in a hole, by sex

  // Wind: now and then a band sweeps diagonally across the meadow and tufts in it lean.
  // `clock` is real seconds, so a gust looks the same at any sim speed. Grass otherwise
  // stands still, so only animals draw the eye.
  const GUST_EVERY = 25, GUST_SPEED = 18, GUST_WIDTH = 5;   // seconds, tiles/s, tiles
  AS.grassLeans = function (x, y, clock) {
    const front = (clock % GUST_EVERY) * GUST_SPEED - GUST_WIDTH, d = x + y * 0.5 - front;
    return d >= 0 && d < GUST_WIDTH;
  };
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
      // Turns an animal toward whoever it is facing (a mate); it keeps that side until it
      // steps sideways.
      turn(a, toLeft) { left[a] = toLeft; },
    };
  };

  // Paints one bitmap into the px x px cell at (ox, oy) of g. A scaled sprite is bottom-
  // centered in its cell; its pixels land on whole device pixels.
  function paint(g, ox, oy, px, map, base, flip, scale, dim) {
    const b = Math.max(MIN_SCALED_PX, Math.round(px * scale));
    const off = ox + Math.floor((px - b) / 2), top = oy + px - b;
    const col = {
      x: base, d: shade(base, SHADE_DARK), w: shade(base, SHADE_LIGHT),
      e: EYE, y: AMBER, n: NOSE, f: FANG, p: TONGUE, r: HOLE_RIM, o: HOLE_DARK, s: SKIN, q: SHAFT, m: SPEARHEAD,
    };
    if (dim) for (const k of Object.keys(col)) col[k] = shade(col[k], dim);
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
      for (let sp = 0; sp < N_SPECIES; sp++) for (let sx2 = 0; sx2 < 2; sx2++) for (let st = 0; st < 3; st++) {
        let base = AS.COLORS[AS.animalGlyph(sp, sx2, AS.STAGE.ADULT)];
        if (st === AS.STAGE.ELDER) base = shade(base, ELDER_BRIGHTNESS);
        const frames = BY_SPECIES[sp];
        for (let fl = 0; fl < 2; fl++) for (let fr = 0; fr < FRAMES; fr++) {
          at(AS.spriteIndex(sp, sx2, st, fl, fr), (x, y) =>
            paint(g, x, y, px, frames[fr], base, fl === 1, st === AS.STAGE.BABY ? BABY_SCALE : 1));
        }
      }
      for (let sp = 0; sp < N_SPECIES; sp++) {
        const base = AS.COLORS[AS.animalGlyph(sp, 0, AS.STAGE.ADULT)];
        at(CARCASS0 + sp, (x, y) => paint(g, x, y, px, CARCASS_BITMAPS[sp], base, false, 1, CARCASS_BRIGHTNESS));
        at(SKULL0 + sp, (x, y) => paint(g, x, y, px, SKULL_BITMAPS[sp], AS.COLORS[AS.GLYPH.CORPSE], false, CORPSE_SCALE));
      }
      at(HOLE0, (x, y) => paint(g, x, y, px, HOLE_BITMAP, HOLE_RIM, false, 1));
      for (let sx2 = 0; sx2 < 2; sx2++) {
        at(PEEK0 + sx2, (x, y) => paint(g, x, y, px, PEEK_BITMAP, AS.COLORS[AS.animalGlyph(0, sx2, AS.STAGE.ADULT)], false, 1));
      }
      for (let i = 0; i < 3; i++) {
        at(GRASS0 + i, (x, y) => paint(g, x, y, px, GRASS_BITMAPS[i], GRASS_COLORS[i], false, 1));
        at(LEAN0 + i, (x, y) => paint(g, x, y, px, GRASS_LEAN[i], GRASS_COLORS[i], false, 1));
      }
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
