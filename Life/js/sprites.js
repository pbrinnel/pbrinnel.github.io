// What close-up drawing looks like: 8x8 pixel-art sprites with a walk animation, and the
// sheet that holds every sprite pre-rendered at one tile size so the renderer can copy
// from it. Sprites replaced the font glyphs the map was first drawn with, because letters
// can't show which way an animal faces or that it is walking.
//
// Bitmaps face right; a left-facing sprite is painted mirrored into its own sheet slot, so
// the renderer never flips at draw time. Codes: x base color, d darker (shade), w lighter
// (highlight), e eye, y amber eye, n nose, f fang, p pink (tongue), s skin, q spear
// shaft, m spearhead. Colors come from AS.COLORS (glyphs.js),
// so the species and sexes still read the same as the HUD. The flames have a code set of
// their own (r o y w: deep red, orange, yellow, pale core), since their colors belong to fire
// and not to any species.
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
  // ... and the same shift mirrored, for wind that blows toward the left of the screen.
  const GRASS_LEAN_LEFT = GRASS_BITMAPS.map(m => m.map((row, j) => (j < LEAN_ROWS ? row.slice(1) + '.' : row)));
  // A warren hole: a dark opening in a rim of lighter dirt (r rim, o opening), earthy on
  // purpose so it never reads as an animal. The peeking bunny is the same hole with ears and eyes
  // up out of it, in the bunny's own colors (x body, d inner ear, e eye).
  const HOLE_BITMAP = ['........', '..rrrr..', '.rroorr.', 'rroooorr', 'rroooorr', '.rroorr.', '..rrrr..', '........'];
  const PEEK_BITMAP = ['..x..x..', '..d..d..', '.rxxxxr.', 'rrxexexr', 'rroooorr', '.rroorr.', '..rrrr..', '........'];
  // Water: the whole tile in one blue (u), with a few lighter (v) and darker (k) pixels as
  // still ripples. Three variants, picked by tile position, so a lake isn't a visible grid of
  // one repeated tile; none of it moves.
  const WATER_BITMAPS = [
    ['uuuuuuuu', 'uuvvuuuu', 'uuuuuuku', 'ukuuuuuu', 'uuuuvvuu', 'uuuuuuuu', 'kuuvuuuu', 'uuuuuuuk'],
    ['uuuuuuuu', 'uukuuuvu', 'uuuuuuuu', 'vvuuukuu', 'uuuuuuuu', 'ukuuuvvu', 'uuuuuuuu', 'uuuvuuuu'],
    ['uvuuuuuu', 'uuuuukuu', 'kuuuuuuu', 'uuuuvvuu', 'uuuuuuuu', 'uuvuuuku', 'uuuuuuuu', 'uuuukuuu'],
  ];
  // The PAINT window's nuke button (Paul, 12 Oct 2026: icons for the modes): a mushroom cloud
  // in the blast's orange, the only icon with no thing of its own in the world.
  const NUKE_BITMAP = ['..wwww..', '.wxxxxw.', 'wxxddxxw', '.xxxxxx.', '...xx...', '...xx...', '..xxxx..', '.dddddd.'];
  // Fire (Paul's pick, option E of the fire mockup, 12 Oct 2026): flames over a burning tile in
  // two sway frames each (the second leans a pixel), by how far through its burn the tile is:
  // tongues on the thing as it catches, taller tongues, flames with it showing through, and
  // last full flames with a deep red base, so nothing of it shows. Each is lowered to sit on
  // the tile's lower half as the fire starts low and climbs.
  const blank = n => Array.from({ length: n }, () => '........');
  const lowered = (m, n) => blank(n).concat(m.slice(0, SIZE - n));
  const TONGUES_SMALL = [
    ['........', '........', '..o.....', '.oy..o..', '........', '........', '........', '........'],
    ['........', '........', '...o....', '..yo.o..', '........', '........', '........', '........'],
  ].map(m => lowered(m, 2));
  const TONGUES_TALL = [
    ['..o.....', '.oyo..o.', '.oywooyo', 'royywyor', '.r.rr.r.', '........', '........', '........'],
    ['.....o..', '.o..oyo.', 'oyoowyo.', 'royywyor', '.r.rr.r.', '........', '........', '........'],
  ].map(m => lowered(m, 1));
  const FLAMES_MID = [
    ['........', '........', '........', '...o....', '..oy..o.', '..oyo.oo', '.royyoor', '.rooyyor'],
    ['........', '........', '........', '....o...', '.o..yo..', 'oo.oyo..', 'rooyyor.', 'royyoor.'],
  ];
  // The lower half is solid red under the flames, so the burning thing is hidden entirely.
  const ENGULF_FROM = 4;
  const FLAMES_FULL = [
    ['........', '...o....', '..oy....', '..oyo.o.', '.oyw.oyo', '.oywyoyo', 'royywyor', 'rooyyyor'],
    ['........', '....o...', '....yo..', '.o.oyo..', 'oyo.wyo.', 'oyoywyo.', 'royywyor', 'royyyoor'],
  ].map(m => m.map((row, j) => (j < ENGULF_FROM ? row : row.replace(/\./g, 'r'))));
  // Sheet order: small tongues, tall tongues, mid flames, full flames; two sway frames each.
  const FIRE_BITMAPS = [].concat(TONGUES_SMALL, TONGUES_TALL, FLAMES_MID, FLAMES_FULL);
  const FLAME = Object.freeze({ TONGUES_SMALL: 0, TONGUES_TALL: 1, MID: 2, FULL: 3 });
  AS.FLAME = FLAME;
  const BITMAPS = { fire: FIRE_BITMAPS, nuke: [NUKE_BITMAP], hole: [HOLE_BITMAP], water: WATER_BITMAPS, peek: [PEEK_BITMAP], bunny: BUNNY, wolf: WOLF, human: HUMAN, carcass: CARCASS_BITMAPS, skull: SKULL_BITMAPS, grass: GRASS_BITMAPS, grassLean: GRASS_LEAN, grassLeanLeft: GRASS_LEAN_LEFT };
  AS.SPRITE_BITMAPS = BITMAPS;
  AS.SPRITE_CODES = 'xdweynfprosqmuvk';
  AS.SPRITE_FIRE_CODES = 'royw';
  AS.SPRITE_SIZE = SIZE;

  // ---- palette ----------------------------------------------------------------------
  const GRASS_COLORS = ['#4f7a3c', '#5e9a46', '#7fc06a'];
  const SHADE_DARK = 0.6, SHADE_LIGHT = 1.35;
  // A carcass is its species' color at this brightness, so it never reads as a live animal.
  const CARCASS_BRIGHTNESS = 0.65;
  const ELDER_BRIGHTNESS = 0.72;
  const HOLE_RIM = '#8a6a45', HOLE_DARK = '#150f0a';
  const NUKE_COLOR = '#e0662f';
  // Fire's colors, muted on purpose: a big fire is warm, never a white flare (Paul's mockup).
  // r o y w are the flames; k a dim ember, e a lit one, a is ash. render.js draws embers and ash.
  const FIRE_PALETTE = AS.FIRE_PALETTE = Object.freeze({ r: '#7e2812', o: '#c8581c', y: '#e09a3a', w: '#efc97a', k: '#3a1a0e', e: '#d0602a', a: '#56524a' });
  // How dark a burning thing gets while the fire on it grows (brightness, one per look that
  // still shows it): the first is a hint of char, the last nearly black.
  const CHAR_BRIGHTNESS = [0.8, 0.6, 0.42];
  // Drought (Paul's pick, option E of the weather mockup): grass fades toward straw as its soil
  // dries, DRY_MIX being how far toward STRAW each step goes (render.js says which step a tile is in).
  const STRAW = '#b59a55', DRY_MIX = [0.3, 0.5, 0.66];
  const WATER_BASE = '#2b5c8c', WATER_LIGHT = '#3a6e9f', WATER_DARK = '#244f7c';
  // How each depth band is shaded from those (Paul, 11 Oct 2026: water shows its depth the way
  // grass shows its size): shallow lighter, deep darker. Below WATER_MID_M meters is shallow,
  // from WATER_DEEP_M deep.
  const WATER_DEPTHS = [1.28, 1, 0.7];
  const WATER_MID_M = 1, WATER_DEEP_M = 4;
  AS.waterBand = d => (d < WATER_MID_M ? 0 : d < WATER_DEEP_M ? 1 : 2);
  AS.WATER_DEPTH_SHADES = WATER_DEPTHS;
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

  // The color a share f of the way from hex a to hex b.
  function mixHex(a, b, f) {
    const x = hexToRgb(a), y = hexToRgb(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * f).toString(16).padStart(2, '0')).join('');
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

  // ---- play (binky and wrestle) ---------------------------------------------------------
  // How a playing animal is drawn on top of where the sim has it: an offset in tiles, a lift,
  // a tilt, and sometimes a frame. All of it runs on REAL time (nowMs), never the sim's, so it
  // reads the same at 50x as at 1x, and it only moves and tilts the sprite: never a flash or
  // a change of brightness (photosensitive players). The sim's PLAY states (play.js) choose
  // the kind; CHASE needs nothing here, the animals just run.
  // A binky is 0-2 small lead-in hops, then one bigger hop with a twist in the air, then a
  // rest. Slots are fixed-length so any moment can be found without replaying the past; what
  // a slot holds is hashed from its index and the animal's serial, so binkies vary.
  // Every binky covers the same BINKY_SPAN however many hops it has, and every other one
  // faces the other way, so each starts where the last one landed: no gliding back.
  // Each hop crouches before it leaves the ground and lands front paws first, dipping its
  // nose and settling level, instead of stopping dead at the bottom of the arc.
  const BINKY_HOP_S = 0.5, BINKY_TWIST_S = 0.75, BINKY_MAX_HOPS = 2, BINKY_REST_S = 1;
  const BINKY_SLOT_S = BINKY_MAX_HOPS * BINKY_HOP_S + BINKY_TWIST_S + BINKY_REST_S;
  const BINKY_HOP_LIFT = 0.4, BINKY_HOP_LIFT_STEP = 0.1, BINKY_TWIST_LIFT = 0.85, BINKY_TWIST_TILT = 0.55;
  const BINKY_SPAN = 0.9;                              // tiles one binky travels
  const BINKY_CROUCH = 0.15, BINKY_LAND = 0.25;        // shares of a hop on the ground before and after the air
  const BINKY_CROUCH_TILT = -0.12, BINKY_LAND_TILT = 0.22;   // haunches down to push off; nose down on landing
  // The landing tilt as a share of the landing so far: a quick dip, then a damped settle.
  const landSettle = p => Math.exp(-4 * p) * Math.sin(Math.PI * Math.min(1, p * 1.6));
  // One hop's lift and tilt at share q of it, with `air` the tilt while airborne.
  function hopPose(q, lift, air, out) {
    if (q < BINKY_CROUCH) { out[1] = 0; out[2] = BINKY_CROUCH_TILT * Math.sin(Math.PI * q / BINKY_CROUCH); out[3] = FRAME.STAND; return 0; }
    if (q < 1 - BINKY_LAND) {
      const a = (q - BINKY_CROUCH) / (1 - BINKY_CROUCH - BINKY_LAND);
      out[1] = 4 * a * (1 - a) * lift; out[2] = air(a); out[3] = FRAME.RUN_B; return a;
    }
    out[1] = 0; out[2] = BINKY_LAND_TILT * landSettle((q - 1 + BINKY_LAND) / BINKY_LAND); out[3] = FRAME.STAND;
    return 1;
  }
  const level = () => 0;
  // A wrestle: both animals nudge at each other, and every WRESTLE_LUNGE_EVERY_S one of them
  // (alternating) lunges for WRESTLE_LUNGE_S while the other recoils a little.
  const WRESTLE_LUNGE_EVERY_S = 1.7, WRESTLE_LUNGE_S = 0.3, WRESTLE_LUNGE_REACH = 0.45, WRESTLE_RECOIL = 0.12;
  const WRESTLE_NUDGE = 0.07, WRESTLE_WOBBLE = 0.25, WRESTLE_LUNGE_TILT = 0.35, WRESTLE_LUNGE_LIFT = 0.25;
  const WRESTLE_PUP_BOUNCE = 0.32;   // pups are bouncier (tiles of lift)
  const PLAY_HASH = (a, b) => (((Math.imul(a + 11, 73856093) ^ Math.imul(b - 7, 19349663)) >>> 0) % 10000) / 10000;
  const hopArc = p => Math.sin(Math.PI * Math.max(0, Math.min(1, p)));
  // out[0] = along (tiles, toward the way it faces for a binky, toward the partner for a
  // wrestle), out[1] = lift (tiles), out[2] = tilt (radians, clockwise when facing right),
  // out[3] = frame, or -1 for the ordinary pose, out[4] = 1 when a binky faces the other way
  // (out[0] is then along that way). which: 0 or 1, the two partners' order.
  AS.playPose = function (kind, nowMs, serial, baby, which, out) {
    const t = nowMs / 1000 + serial * 0.37;
    out[0] = 0; out[1] = 0; out[2] = 0; out[3] = -1; out[4] = 0;
    if (kind === AS.PLAY.BINKY) {
      const slot = Math.floor(t / BINKY_SLOT_S), u = t - slot * BINKY_SLOT_S;
      const n = Math.floor(PLAY_HASH(slot, serial) * (BINKY_MAX_HOPS + 1));
      const lead = n * BINKY_HOP_S, step = BINKY_SPAN / (n + 1), x0 = -BINKY_SPAN / 2;
      out[4] = slot & 1;
      if (u < lead) {
        const k = Math.floor(u / BINKY_HOP_S);
        const a = hopPose(u / BINKY_HOP_S - k, BINKY_HOP_LIFT + BINKY_HOP_LIFT_STEP * k, level, out);
        out[0] = x0 + (k + a) * step;
      } else if (u < lead + BINKY_TWIST_S) {
        const a = hopPose((u - lead) / BINKY_TWIST_S, BINKY_TWIST_LIFT, p => Math.sin(p * 2 * Math.PI) * BINKY_TWIST_TILT, out);
        out[0] = x0 + (n + a) * step;
      } else {
        out[0] = -x0; out[3] = FRAME.STAND;   // at rest where it landed; the next binky turns back from here
      }
    } else if (kind === AS.PLAY.WRESTLE) {
      const tt = t + which * 0.4, lu = tt % WRESTLE_LUNGE_EVERY_S;
      const lp = lu < WRESTLE_LUNGE_S ? hopArc(lu / WRESTLE_LUNGE_S) : 0;
      const lunger = Math.floor(tt / WRESTLE_LUNGE_EVERY_S) % 2 === which;
      out[0] = WRESTLE_NUDGE * Math.sin(t * 5.2 + which * 2) + (lunger ? WRESTLE_LUNGE_REACH : -WRESTLE_RECOIL) * lp;
      out[1] = (baby ? WRESTLE_PUP_BOUNCE * Math.abs(Math.sin(t * 2 * Math.PI * 1.4 + which * 2.1)) : 0) + (lunger ? WRESTLE_LUNGE_LIFT * lp : 0);
      out[2] = WRESTLE_WOBBLE * Math.sin(t * 3.1 + which) + (lunger ? WRESTLE_LUNGE_TILT * lp : 0);
      out[3] = lunger && lp > 0 ? FRAME.RUN_A : FRAME.STAND;
    }
  };

  // ---- in the water ------------------------------------------------------------------
  // Swimming (Paul's pick, 12 Oct 2026, option B of four): an animal in water deeper than it
  // wades sits low, the water meeting it at sprite row SWIM_CUT of its cell, with its head
  // and the top of its back above: SWIM_BELOW rows under its eye (the bunny's eye sits lower
  // in its art than the wolf's or the human's, so it is measured from the eye). It bobs one
  // sprite pixel every half SWIM_BOB_MS. Out of Stamina (drowning) it sinks to its eyes and
  // stops bobbing. Wading, only its feet (the bottom row) are under. render.js draws these.
  AS.SWIM_CUT = 6;
  AS.SWIM_BELOW = 1;
  AS.SWIM_BOB_MS = 1600;
  // Where sprite row j (column i) starts, in device px from the top (left) of an animal's
  // cell at tile size px, by stage: a baby is drawn smaller, bottom-centered, as paint() does.
  const scaledPx = (px, stage) => Math.max(MIN_SCALED_PX, Math.round(px * (stage === AS.STAGE.BABY ? BABY_SCALE : 1)));
  AS.spriteRowPx = (px, stage, j) => { const b = scaledPx(px, stage); return px - b + Math.round(j * b / SIZE); };
  AS.spriteColPx = (px, stage, i) => { const b = scaledPx(px, stage); return Math.floor((px - b) / 2) + Math.round(i * b / SIZE); };

  // ---- fire's look ----------------------------------------------------------------------
  // What a burning tile shows for how far through its burn it is (AS.fireStage, 0..1). Pure,
  // so render.js and the checks share the one mapping. `char` is which charring of the burning
  // thing shows (an index into CHAR_BRIGHTNESS), or -1 when full flames hide it; `flame` is
  // which flame sits over it (AS.FLAME). The thing stays in view for the first
  // FIRE_ENGULF_AT of its burn (about 80%).
  const FIRE_CATCH_UNTIL = 0.25, FIRE_TALL_UNTIL = 0.53, FIRE_ENGULF_AT = 0.8;
  AS.FIRE_LOOK_AT = Object.freeze({ CATCH_UNTIL: FIRE_CATCH_UNTIL, TALL_UNTIL: FIRE_TALL_UNTIL, ENGULF_AT: FIRE_ENGULF_AT });
  const LOOKS = Object.freeze([
    Object.freeze({ char: 0, flame: FLAME.TONGUES_SMALL }),
    Object.freeze({ char: 1, flame: FLAME.TONGUES_TALL }),
    Object.freeze({ char: 2, flame: FLAME.MID }),
    Object.freeze({ char: -1, flame: FLAME.FULL }),
  ]);
  AS.fireLook = stage => (stage < FIRE_CATCH_UNTIL ? LOOKS[0] : stage < FIRE_TALL_UNTIL ? LOOKS[1] : stage < FIRE_ENGULF_AT ? LOOKS[2] : LOOKS[3]);

  // Photosensitivity (DESIGN.md): a flame, and each ember, changes at most once per
  // FLAME_HOLD_MS of real time, whatever the sim speed, and each tile on its own offset so a
  // fire never changes all at once. A step counts up by one every hold; the flame shows its
  // parity, an ember its step mod 3.
  const FLAME_HOLD_MS = AS.FLAME_HOLD_MS = 800;
  const SALT_FLAME = 4;
  AS.flameStep = (nowMs, x, y) => Math.floor((nowMs + hash01(x, y, SALT_FLAME) * FLAME_HOLD_MS) / FLAME_HOLD_MS);
  AS.flameFrame = (nowMs, x, y) => AS.flameStep(nowMs, x, y) & 1;

  // ---- sheet layout -----------------------------------------------------------------
  // Animals: ((((species*2+sex)*3+stage)*2+faceLeft)*FRAMES+frame), then each species'
  // skull, the three grass thirds, the three leaning right, the three leaning left, each species' carcass, the hole,
  // the bunny peeking out of it (by sex), the water (three depths × three variants), the
  // nuke icon, the eight flames (four kinds × two sway frames), and last the charred things:
  // for each charring (CHAR_BRIGHTNESS) the three grass thirds, then each species' carcass,
  // then each species' skull; then the dried grass (see DRY0); and at the very end the charred
  // dried grass (see CHARDRY0).
  const N_SPECIES = AS.SPECIES_COUNT;
  const ANIMAL_SPRITES = N_SPECIES * 2 * 3 * 2 * FRAMES;
  const SKULL0 = ANIMAL_SPRITES, GRASS0 = SKULL0 + N_SPECIES, LEAN0 = GRASS0 + 3, LEAN_LEFT0 = LEAN0 + 3, CARCASS0 = LEAN_LEFT0 + 3;
  // Water comes in WATER_DEPTHS shades (shallow, mid, deep), each in every ripple variant.
  const HOLE0 = CARCASS0 + N_SPECIES, PEEK0 = HOLE0 + 1, WATER0 = PEEK0 + 2, NUKE0 = WATER0 + WATER_DEPTHS.length * WATER_BITMAPS.length;
  const FIRE0 = NUKE0 + 1, CHAR0 = FIRE0 + FIRE_BITMAPS.length, CHARRED_THINGS = 3 + 2 * N_SPECIES;
  // Last, the dried grass: for each step of dryness the three thirds standing, leaning right and
  // leaning left (nine to a step).
  const DRY0 = CHAR0 + CHAR_BRIGHTNESS.length * CHARRED_THINGS, DRY_PER_STEP = 9;
  // Last of all, a dry blade that caught fire: each dry step charred at each level, the three
  // thirds. It keeps its straw color under the char, so burning never turns a dry blade green.
  const CHARDRY0 = DRY0 + DRY_MIX.length * DRY_PER_STEP, COUNT = CHARDRY0 + DRY_MIX.length * CHAR_BRIGHTNESS.length * 3;
  const SHEET_COLS = 19;
  const BY_SPECIES = [BUNNY, WOLF, HUMAN];
  // The row of a species' standing eye, and the columns a frame's row covers ([first, last],
  // mirrored when facing left; null if the row is empty): where a swimmer's water meets it.
  AS.spriteEyeRow = species => BY_SPECIES[species][FRAME.STAND].findIndex(r => /[ey]/.test(r));
  AS.spriteRowSpan = function (species, frame, row, faceLeft) {
    const r = BY_SPECIES[species][frame][row];
    if (!r) return null;
    const lo = r.search(/[^.]/);
    if (lo < 0) return null;
    let hi = SIZE - 1;
    while (r[hi] === '.') hi--;
    return faceLeft ? [SIZE - 1 - hi, SIZE - 1 - lo] : [lo, hi];
  };
  AS.SPRITE_COUNT = COUNT;
  AS.SPRITE_FRAMES = FRAMES;
  AS.spriteSkull = species => SKULL0 + species;
  AS.spriteGrass = third => GRASS0 + third;
  AS.spriteGrassLean = third => LEAN0 + third;
  AS.spriteGrassLeanLeft = third => LEAN_LEFT0 + third;
  AS.spriteCarcass = species => CARCASS0 + species;
  AS.spriteHole = () => HOLE0;
  AS.spriteNuke = () => NUKE0;
  // One flame sprite (the mid flames' first frame) for the PAINT and Info icons.
  AS.spriteFlame = () => FIRE0 + 2 * FLAME.MID;
  AS.spriteFire = (flame, frame) => FIRE0 + 2 * flame + frame;
  // A burning thing at charring `level` (0..CHAR_BRIGHTNESS.length-1, from AS.fireLook).
  AS.spriteCharGrass = (third, level) => CHAR0 + level * CHARRED_THINGS + third;
  AS.spriteCharCarcass = (species, level) => CHAR0 + level * CHARRED_THINGS + 3 + species;
  AS.spriteCharSkull = (species, level) => CHAR0 + level * CHARRED_THINGS + 3 + N_SPECIES + species;
  AS.CHAR_LEVELS = CHAR_BRIGHTNESS.length;
  // A blade dried to `step` (1..DRY_STEPS), standing (lean 0), leaning right (1) or left (-1).
  AS.DRY_STEPS = DRY_MIX.length;
  AS.spriteGrassDry = (third, lean, step) => DRY0 + (step - 1) * DRY_PER_STEP + (lean > 0 ? 3 : lean < 0 ? 6 : 0) + third;
  // The same blade burning (charring `level`, as AS.spriteCharGrass), dried to `step`.
  AS.spriteCharGrassDry = (third, level, step) => CHARDRY0 + ((step - 1) * CHAR_BRIGHTNESS.length + level) * 3 + third;
  AS.STRAW = STRAW;
  AS.DRY_MIX = DRY_MIX;
  AS.spritePeek = sex => PEEK0 + sex;   // a bunny in a hole, by sex
  // A water tile's sprite: its depth band (AS.waterBand: 0 shallow, 1 mid, 2 deep) and a ripple
  // variant from its position, a fixed scramble of x and y, never random.
  AS.spriteWater = (x, y, band = 1) => WATER0 + band * WATER_BITMAPS.length + ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 8) % WATER_BITMAPS.length;

  // ---- wind gusts ----------------------------------------------------------------------
  // The world's wind (sim.wind) drawn on the grass: bands of leaning blades roll downwind
  // across the meadow, upright between them. The stronger the wind, the more often a gust
  // comes, the wider it is and the faster it travels. Band speed is a look, not physics (a
  // sim day lasts seconds), so it is tiles per sim second, not the wind's km/h.
  //
  // Every gust is an object with a position along the wind's axis, moved by (band speed x
  // elapsed sim time) each frame. New ones are born at the upwind edge on a timer. So when the
  // wind's strength or direction drifts, bands keep moving from where they are instead of
  // jumping, and a turning wind swings them around the world's center.
  //
  // Photosensitivity (DESIGN.md): the decision per blade goes through one rule. A blade's lean
  // (-1 left, 0 upright, +1 right) changes at most once per HOLD_MS of real time, whatever the
  // speed and whatever the wind does, because a change is refused until the last one is
  // HOLD_MS old. So a blade a band reaches stays leaning for HOLD_MS after it passes, and
  // stays upright for HOLD_MS before the next. When gusts would come faster than that can
  // show (cycles under CYCLE_HOLDS holds of real time), the bands are dropped and each blade
  // leans or not by a dice roll, with the share of time a blade spends leaning at that wind
  // as the odds, redrawn once per HOLD_MS (per blade offset, so they don't all change together).
  const HOLD_MS = 1200;
  const FULL_KMH = 40;               // the wind strength drawn at full strength (s = 1)
  const GUST_EVERY_CALM = 9, GUST_EVERY_GAIN = 5;      // seconds between gusts: calm - gain x s
  const GUST_WIDTH_BASE = 1.5, GUST_WIDTH_GAIN = 3;    // tiles
  const GUST_SPEED_BASE = 4, GUST_SPEED_GAIN = 14;     // tiles per sim second
  const CYCLE_HOLDS = 3;             // a gust cycle shorter than this many holds of real time is averaged
  const MAX_SHARE = 0.9;             // never lean every blade, so a strong wind still shows its gaps
  const SIDE_BLUR = 0.25;            // when |toX| is under this, a side view can't tell which way it blows: blades lean either way
  const MAX_SPAWNS_PER_FRAME = 64;   // a frame at Max speed spans many cycles; only the ones still on screen matter
  const SALT_SIDE = 1, SALT_SLOT = 2, SALT_OFFSET = 3;
  const hash01 = (x, y, k) => (Math.imul(Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(k, 83492791), 2654435761) >>> 8) / 16777216;
  AS.spriteHash = hash01;   // a tile's fixed scramble, 0..1: where its ash and embers fall

  AS.GUSTS = Object.freeze({ HOLD_MS, FULL_KMH, CYCLE_HOLDS, SIDE_BLUR, MAX_SHARE });

  // update(sim, realMs, speed, alpha) once per frame, then leans(x, y) per tile. realMs:
  // performance.now(); speed: the sim speed asked for (0 paused, Infinity max); alpha: 0..1
  // through the current tick.
  AS.Gusts = function () {
    let gusts = [];                  // { pos, width }: front's place along the wind axis, tiles from the world's center
    let simT = -1, since = 0;        // last sim time seen; sim seconds since the last birth
    let owner = null, w = 0, h = 0, R = 0;
    let state = null, changedAt = null;   // per tile: the lean shown, and the real ms it last changed
    let wind = { toX: 0, toY: 0 }, now = 0, calm = true, averaged = false, share = 0;

    function reset(sim) {
      owner = sim; w = sim.W.w; h = sim.W.h; R = Math.hypot(w, h) / 2;
      state = new Int8Array(w * h);
      changedAt = new Float64Array(w * h).fill(-Infinity);
      gusts = []; simT = -1; since = 0;
    }
    const strength = kmh => Math.max(0, Math.min(1, kmh / FULL_KMH));

    return {
      update(sim, realMs, speed, alpha = 0) {
        if (sim !== owner || sim.W.w !== w || sim.W.h !== h) reset(sim);
        now = realMs;
        const wd = sim.wind, t = (sim.tickCount + alpha) * AS.DT;
        wind = wd;
        calm = !(wd.kmh >= AS.WIND.CALM_BELOW_KMH);
        if (calm) { gusts.length = 0; simT = t; since = 0; averaged = false; return; }
        const s = strength(wd.kmh);
        const every = GUST_EVERY_CALM - GUST_EVERY_GAIN * s, width = GUST_WIDTH_BASE + GUST_WIDTH_GAIN * s;
        const bandSpeed = GUST_SPEED_BASE + GUST_SPEED_GAIN * s;
        if (simT < 0) {
          // A meadow that has been windy a while: gusts already spread across it.
          for (let p = R - 0.5 * every * bandSpeed; p > -R; p -= every * bandSpeed) gusts.push({ pos: p, width });
          since = 0.5 * every;
          simT = t;
        }
        const dt = Math.max(0, t - simT);
        simT = t;
        for (const g of gusts) g.pos += bandSpeed * dt;
        since += dt;
        if (since >= every) {
          let n = Math.min(MAX_SPAWNS_PER_FRAME, Math.floor(since / every));
          since = since % every;
          // The newest was born `since` ago, the one before it `every` earlier, and so on.
          for (; n > 0; n--) {
            const pos = -R + bandSpeed * (since + (n - 1) * every);
            if (pos - width <= R) gusts.push({ pos, width });
          }
        }
        gusts = gusts.filter(g => g.pos - g.width <= R);
        // Averaged when a cycle at this speed, in real seconds, is too short for holds to fit.
        const mult = speed > 0 ? speed : 0;
        averaged = every / mult < CYCLE_HOLDS * HOLD_MS / 1000;
        // Share of time a blade leans at 1x: the pass plus the hold that follows it.
        share = Math.min(MAX_SHARE, (width / bandSpeed + HOLD_MS / 1000) / every);
      },
      leans(x, y) {
        const i = y * w + x;
        let want = 0;
        if (!calm) {
          let lit;
          if (averaged) lit = hash01(x, y, SALT_SLOT + 16 * Math.floor((now + hash01(x, y, SALT_OFFSET) * HOLD_MS) / HOLD_MS)) < share;
          else {
            const a = (x + 0.5 - w / 2) * wind.toX + (y + 0.5 - h / 2) * wind.toY;
            lit = false;
            for (const g of gusts) { const d = g.pos - a; if (d >= 0 && d < g.width) { lit = true; break; } }
          }
          // Each blade's own threshold spreads the switch from "leans right" to "leans
          // left" over a range of toX, so a wind swinging past vertical turns blades gradually.
          if (lit) want = wind.toX + (hash01(x, y, SALT_SIDE) - 0.5) * 2 * SIDE_BLUR >= 0 ? 1 : -1;
        }
        if (want !== state[i] && now - changedAt[i] >= HOLD_MS) { state[i] = want; changedAt[i] = now; }
        return state[i];
      },
    };
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
  function paint(g, ox, oy, px, map, base, flip, scale, dim, pal) {
    const b = Math.max(MIN_SCALED_PX, Math.round(px * scale));
    const off = ox + Math.floor((px - b) / 2), top = oy + px - b;
    const col = pal || {
      x: base, d: shade(base, SHADE_DARK), w: shade(base, SHADE_LIGHT),
      e: EYE, y: AMBER, n: NOSE, f: FANG, p: TONGUE, r: HOLE_RIM, o: HOLE_DARK, s: SKIN, q: SHAFT, m: SPEARHEAD, u: WATER_BASE, v: WATER_LIGHT, k: WATER_DARK,
    };
    if (dim && !pal) for (const k of Object.keys(col)) col[k] = shade(col[k], dim);
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
      at(NUKE0, (x, y) => paint(g, x, y, px, NUKE_BITMAP, NUKE_COLOR, false, 1));
      for (let sx2 = 0; sx2 < 2; sx2++) {
        at(PEEK0 + sx2, (x, y) => paint(g, x, y, px, PEEK_BITMAP, AS.COLORS[AS.animalGlyph(0, sx2, AS.STAGE.ADULT)], false, 1));
      }
      for (let d = 0; d < WATER_DEPTHS.length; d++) for (let i = 0; i < WATER_BITMAPS.length; i++) {
        at(WATER0 + d * WATER_BITMAPS.length + i, (x, y) => paint(g, x, y, px, WATER_BITMAPS[i], WATER_BASE, false, 1, WATER_DEPTHS[d]));
      }
      FIRE_BITMAPS.forEach((m, i) => at(FIRE0 + i, (x, y) => paint(g, x, y, px, m, null, false, 1, 0, FIRE_PALETTE)));
      for (let lv = 0; lv < CHAR_BRIGHTNESS.length; lv++) {
        const dim = CHAR_BRIGHTNESS[lv];
        for (let i = 0; i < 3; i++) at(AS.spriteCharGrass(i, lv), (x, y) => paint(g, x, y, px, GRASS_BITMAPS[i], GRASS_COLORS[i], false, 1, dim));
        for (let sp = 0; sp < N_SPECIES; sp++) {
          at(AS.spriteCharCarcass(sp, lv), (x, y) => paint(g, x, y, px, CARCASS_BITMAPS[sp], AS.COLORS[AS.animalGlyph(sp, 0, AS.STAGE.ADULT)], false, 1, CARCASS_BRIGHTNESS * dim));
          at(AS.spriteCharSkull(sp, lv), (x, y) => paint(g, x, y, px, SKULL_BITMAPS[sp], AS.COLORS[AS.GLYPH.CORPSE], false, CORPSE_SCALE, dim));
        }
      }
      for (let step = 1; step <= DRY_MIX.length; step++) for (let i = 0; i < 3; i++) {
        const base = mixHex(GRASS_COLORS[i], STRAW, DRY_MIX[step - 1]);
        at(AS.spriteGrassDry(i, 0, step), (x, y) => paint(g, x, y, px, GRASS_BITMAPS[i], base, false, 1));
        at(AS.spriteGrassDry(i, 1, step), (x, y) => paint(g, x, y, px, GRASS_LEAN[i], base, false, 1));
        at(AS.spriteGrassDry(i, -1, step), (x, y) => paint(g, x, y, px, GRASS_LEAN_LEFT[i], base, false, 1));
        for (let lv = 0; lv < CHAR_BRIGHTNESS.length; lv++) at(AS.spriteCharGrassDry(i, lv, step), (x, y) => paint(g, x, y, px, GRASS_BITMAPS[i], base, false, 1, CHAR_BRIGHTNESS[lv]));
      }
      for (let i = 0; i < 3; i++) {
        at(GRASS0 + i, (x, y) => paint(g, x, y, px, GRASS_BITMAPS[i], GRASS_COLORS[i], false, 1));
        at(LEAN0 + i, (x, y) => paint(g, x, y, px, GRASS_LEAN[i], GRASS_COLORS[i], false, 1));
        at(LEAN_LEFT0 + i, (x, y) => paint(g, x, y, px, GRASS_LEAN_LEFT[i], GRASS_COLORS[i], false, 1));
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
