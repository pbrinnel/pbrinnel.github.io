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
  const FAR_ANIMAL = [['#e0a868', '#f2cc96'], ['#b4b2ab', '#dcdad2'], ['#e08fd8', '#f0b8ea']].map(r => r.map(abgr));   // [species][sex]

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

  // Soil wetness (Paul, from the weather mockup): the soil water a tile holds against its room
  // (W.water.G over W.water.room, the quantity fire.js reads as dryness) sets a signed level,
  // -SOIL_DRY_BELOW.length (driest) .. SOIL_WET_ABOVE.length (wettest). Wet soil darkens and cools
  // the tile (a WET_RGB veil, WET_ALPHA by level, stronger than the mockup's); dry soil fades
  // the grass toward straw (sprites.js, DRY_MIX), the ground untouched.
  // The wet side reads how far a tile is ABOVE ITS OWN RECENT AVERAGE (Paul, 13 Oct 2026: a
  // shower must leave a visible swath on ground that is already damp): a slow average of the
  // tile's share, over about SOIL_AVG_DAYS, and the excess over it is what darkens, easing back
  // as the tile dries toward its average. The dry side stays on the absolute share, which is
  // what fire reads. A shower adds about one hundredth of the room, so the excess steps double
  // from a few thousandths.
  const SOIL_WET_ABOVE = [0.004, 0.009, 0.02];
  const SOIL_DRY_BELOW = [0.008, 0.004, 0.002];
  const SOIL_AVG_DAYS = 1.5;
  // A tile's average is moved on at most once per this much sim time (a day is AS.DAY_SECONDS),
  // by since / (tau + since) of the way, so a long gap between visits (fast speed) takes a big
  // step without overshooting and a slow speed costs almost nothing.
  const SOIL_AVG_TAU_S = SOIL_AVG_DAYS * AS.DAY_SECONDS, SOIL_AVG_MIN_S = 0.1 * AS.DAY_SECONDS;
  // A level is left only once the share is this much (relative) past its threshold, so a tile
  // sitting on one doesn't flap as the water steps.
  const SOIL_HYSTERESIS = 0.15;
  const WET_RGB = '6,16,32';
  const WET_ALPHA = [0.36, 0.5, 0.62];
  // The far view's colors for the same levels: the grass mixed toward FAR_WET / FAR_STRAW, the
  // bare ground toward a cool gray-blue (it cannot get darker).
  const FAR_WET_GRASS = '#0b1c34', FAR_WET_GROUND = '#1e3048', FAR_STRAW_HEX = AS.STRAW;
  const FAR_WET_GRASS_MIX = [0.35, 0.5, 0.62], FAR_WET_GROUND_MIX = [0.3, 0.5, 0.7], FAR_DRY_MIX = [0.25, 0.45, 0.62];
  // Over real time, like water (DESIGN.md, Photosensitivity): the soil is swept for new levels
  // once per SOIL_SWEEP_MS, a tile moves one level at a time, each taking SOIL_FADE_MS and the
  // next beginning no sooner, so a tile never changes its drawn level more than once per
  // SOIL_FADE_MS and a back-and-forth takes twice that. A swath darkening is a slow fade
  // spread over the sweep, never a sudden change of a large area.
  const SOIL_SWEEP_MS = 500, SOIL_FADE_MS = AS.SOIL_FADE_MS = 2000;

  // The far view's tile colors by soil level (index level + SOIL_DRY_BELOW.length, see SOIL_WET_ABOVE):
  // FAR_GRASS_BY[third][index] and FAR_GROUND_BY[index].
  const SOIL_LEVELS_DRY = SOIL_DRY_BELOW.length, SOIL_LEVELS_WET = SOIL_WET_ABOVE.length;
  const FAR_GRASS_BY = FAR_GRASS.map(c => {
    const row = [];
    for (let l = -SOIL_LEVELS_DRY; l <= SOIL_LEVELS_WET; l++) {
      row.push(l < 0 ? mixAbgr(c, abgr(FAR_STRAW_HEX), FAR_DRY_MIX[-l - 1]) : l > 0 ? mixAbgr(c, abgr(FAR_WET_GRASS), FAR_WET_GRASS_MIX[l - 1]) : c);
    }
    return row;
  });
  const FAR_GROUND_BY = [];
  for (let l = -SOIL_LEVELS_DRY; l <= SOIL_LEVELS_WET; l++) FAR_GROUND_BY.push(l > 0 ? mixAbgr(FAR_GROUND, abgr(FAR_WET_GROUND), FAR_WET_GROUND_MIX[l - 1]) : FAR_GROUND);

  // Fire's far-view colors (Paul's pick, option E of the fire mockup): burning tiles by how hard
  // they burn (catching, then mid flames to the last part), a tile that burnt out recently
  // glowing as embers, then the scorch above. The close-up palette is AS.FIRE_PALETTE.
  const FAR_FIRE_MID = abgr('#b8461e'), FAR_FIRE_HIGH = abgr('#e07a34'), FAR_EMBER = abgr('#6a2a14');
  // A burning animal, far out: a red that no species' color is near (orange read as a tan bunny).
  const FAR_ALIGHT = abgr('#e8402a');
  // A tile that burnt out within the last FIRE_EMBER_HOURS of in-world time still glows: its
  // scorch is within that long of FireScorchDays (the most a fire leaves). Up close, the glow
  // is EMBER_PIXELS pixels that go out one by one as the hours pass; each is lit about a third
  // of the time, stepping with the sway clock (sprites.js, FLAME_HOLD_MS).
  const FIRE_EMBER_HOURS = 12;
  const EMBER_PIXELS = 3, EMBER_FIRST_ROW = 5, EMBER_LIT_EVERY = 3;
  // Scattered ash on ground a fire burnt (W.ash): ASH_PIXELS gray pixels in the lower rows of the
  // tile, placed by a hash of the tile, fainter as the ash is spent or weathers.
  const ASH_PIXELS = 4, ASH_FIRST_ROW = 4, ASH_ROWS = 4;
  const SALT_ASH_X = 10, SALT_ASH_Y = 20, SALT_EMBER_X = 30;
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
  const LOCATE_ALPHA = AS.LOCATE_ALPHA = 0.9;
  const LOCATE_CSS_PX = 2;
  const LOCATE_MIN_CSS_PX = 14;
  const LOCATE_PIP_CSS_PX = 5;
  const LOCATE_PIPS_MAX = 200;
  // A pulse (the graph's quick look): rings that ease in over LOCATE_PULSE_IN_MS, shrinking from
  // 1 + LOCATE_PULSE_GROW times their size, and are faded out by LOCATE_PULSE_MS.
  const LOCATE_PULSE_IN_MS = 250, LOCATE_PULSE_MS = 2000, LOCATE_PULSE_GROW = 0.5, LOCATE_PULSES_MAX = 12;
  // The graph's colors (graph.js), so a ring matches the kind's line; ui.js marks a toggled
  // count with the same color. Fires have no line: they take the flames' yellow from the fire
  // palette, since the orange the bunnies' line uses is taken.
  const rgbOf = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');
  const LOCATE_COLORS = AS.LOCATE_COLORS = Object.freeze({ blades: '25,158,112', bunnies: '217,89,38', wolves: '57,135,229', humans: '199,99,179', corpses: '200,200,190', fires: rgbOf(AS.FIRE_PALETTE.y) });

  // Lenses (lenses.js): the map seen through one set of items. Everything not in an item dims and
  // each item's members light in its color; all of it eases over LENS_FADE_MS of real time, a
  // switch of lens crossfades, and a long frame moves it at most LENS_DT_MAX_MS' worth (DESIGN.md,
  // Photosensitivity). Tile sets with many members tint, small ones ring (RING_MAX in lenses.js).
  const LENS_FADE_MS = 300, LENS_DT_MAX_MS = 100;
  const LENS_DIM_RGB = [8, 10, 8], LENS_DIM_ALPHA = 0.55, LENS_TINT_ALPHA = 0.42;
  const LENS_RING_R = 0.68;   // tiles; a locate ring is 0.8
  const LENS_RING_MIN_CSS_PX = 4, LENS_RING_CSS_PX = 2, LENS_RING_HALO_CSS_PX = 4;
  const LENS_RING_ALPHA = 0.95, LENS_HALO_ALPHA = 0.65, LENS_HALO_RGB = '10,12,10';
  // Members are found in a pass over the view plus a margin, at most every LENS_SCAN_MS (or when the
  // view leaves it), never per frame; the whole-map counts that decide tint or ring come every LENS_COUNT_MS.
  const LENS_SCAN_MS = 250, LENS_COUNT_MS = 500, LENS_SCAN_MARGIN = 0.25, LENS_SCAN_MARGIN_MIN = 8;
  // Zoomed out, so many animals that rings would be a smear are painted as pixels (LENS_MARK_ALPHA) instead.
  const LENS_FAR_RINGS_MAX = 2000, LENS_MARK_ALPHA = 0.9;
  const LENS_SHOWER_ALPHA = 0.5, LENS_STORM_ALPHA = 0.95, LENS_SHOWER_CSS_PX = 2, LENS_STORM_DASH_CSS_PX = [6, 4];
  const LENS_BOLT_MIN_CSS_PX = 12;   // the storm's bolt mark, at least this tall
  const LENS_BOLT = [[0.12, -0.55], [-0.28, 0.06], [-0.02, 0.06], [-0.14, 0.55], [0.28, -0.1], [0.02, -0.1]];
  const LENS_MIN_ALPHA = 0.003;

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
  // Water against an animal (sprites.js "in the water"): the line where it meets the body,
  // and a swimmer's wake, WAKE_STEPS sprite pixels long, fading from WAKE_ALPHA.
  const WATERLINE = '#8fb4d6';
  // Past the world's edge (the camera lets the view pan half a screen beyond it): darker than
  // the ground, with a faint line along the edge, so it is clear where the world ends.
  const OUTSIDE = '#040504', EDGE_LINE = 'rgba(176,186,150,0.28)';
  const WAKE_STEPS = 4, WAKE_ALPHA = 0.75;

  // Water changes are drawn over real time, never in the sim's own steps (DESIGN.md,
  // Photosensitivity). The water steps every 0.5 sim seconds, so at speed a shore tile can flip
  // wet and dry, or change depth band, dozens of times a second, and bright blue on dark ground
  // reads as flashing. Each tile instead eases between its looks at no more than 1 /
  // WATER_FADE_MS of a look per millisecond: a full wet-dry-wet cycle takes at least twice that,
  // at any speed. Long enough to read as water arriving at the slowest speed too.
  const WATER_FADE_MS = AS.WATER_FADE_MS = 1200;
  // A wading animal's stance follows the drawn water, not the sim's: it changes only once the
  // tile on its feet is at least this much water, so a shore tile flipping every step can't
  // flick the animal's feet in and out of view. At WATER_STANCE_MIN a fade has taken half its time.
  const WATER_STANCE_MIN = 0.5;
  const WADE_FLOOR_M = 1e-3;   // the depth a drying tile still counts for while its water is on screen

  // Rain (Paul, 13 Oct 2026; the mockup's R5 without its haze): sparse soft streaks, rings on
  // water and small splashes on ground. Where it rains follows the sim: per RAIN_CELL-tile cell,
  // `a` rises over RAIN_IN_MS while a shower covers the cell, holds STREAK_HOLD_MS after it
  // leaves, and fades over RAIN_OUT_MS. Everything that MOVES runs on real time (the clock the
  // draw is given), so rain looks the same at 1x and 50x and nothing vibrates. Close view only:
  // a drop is far smaller than a far-view tile.
  const RAIN_CELL = 4;
  const STREAK_HOLD_MS = AS.STREAK_HOLD_MS = 1200, RAIN_IN_MS = 300, RAIN_OUT_MS = 1500;
  const RAIN_STALE_MS = STREAK_HOLD_MS + RAIN_IN_MS + RAIN_OUT_MS;   // a cell unseen this long is back at nothing
  const RAIN_ALPHA = 0.7, RAIN_ALPHA_STEPS = 6;
  const RAIN_FIELD_MIN = 0.03;        // below this share of a cell's rain nothing is drawn
  const STREAKS_PER_CELL = 4, STREAK_LEN = 5;   // sprite pixels; the trail fades toward its tail
  const STREAK_SPEED = 24, STREAK_SPEED_SPREAD = 10;   // sprite pixels per real second
  const RIPPLES_PER_CELL = 2, RIPPLE_SECONDS = 1.1, RIPPLE_SPREAD = 0.3;   // each lives about a second, born at zero strength
  const RIPPLE_GROW = 4.5;            // a ring's radius runs from 1 to 1 + this many sprite pixels, twice as wide as tall
  const SPLASH_SPECK_FROM = 0.3, SPLASH_SPECK_SPAN = 0.25;   // the side specks come in over this part of the splash's life
  const STREAK_RGB = AS.STREAK_RGB = '196,216,238';
  const STREAK_SLOPE = 0.7;           // sideways sprite pixels per pixel fallen, in a wind of AS.GUSTS.FULL_KMH
  const STREAK_STAIR_AT = 2;          // device px per sprite pixel from which a streak is drawn pixel by pixel, else as one dash
  const SALT_STREAK_X = 41, SALT_STREAK_Y = 42, SALT_STREAK_V = 43, SALT_RIPPLE = 44;

  // Lightning (Paul, 13 Oct 2026: bolder, even if less realistic): a bright pale blue-white bolt
  // with forked branches from above the screen to the struck tile, a soft local glow a few tiles
  // across and a scorch mark where it lands. It fades in over BOLT_IN_MS, holds, fades out;
  // nothing outside the glow's circle brightens, and the line is a few pixels wide. At most one
  // bolt starts per BOLT_GAP_MS of real time (a strike in between is skipped; its fire shows
  // anyway). The scorch mark outlasts it and fades with the ground (SCAR_*).
  const BOLT_GAP_MS = AS.BOLT_GAP_MS = 5000, BOLT_IN_MS = 200, BOLT_HOLD_MS = 600, BOLT_OUT_MS = 1200;
  const BOLT_PEAK = AS.BOLT_PEAK = 0.95, BOLT_RGB = AS.BOLT_RGB = '226,238,255', BOLT_HALO_RGB = '140,180,240', BOLT_GLOW_RGB = '170,200,255';
  const BOLT_CORE_CSS_PX = 2.5, BOLT_BRANCH_CSS_PX = 1.5, BOLT_HALO_MULT = 3, BOLT_HALO_ALPHA = 0.22, BOLT_BRANCH_ALPHA = 0.85;
  const BOLT_GLOW_TILES = AS.BOLT_GLOW_TILES = 2.5, BOLT_GLOW_PEAK = 0.55;   // the glow's radius, and its alpha at the center
  const BOLT_ABOVE_TILES = 3;         // it starts this far above the top of the view when it strikes
  const BOLT_LEAN_TILES = 3;          // ... and as far sideways at most
  const BOLT_STEP_TILES = 0.42, BOLT_JAG_TILES = 0.22;
  const BOLT_BRANCHES_MIN = 2, BOLT_BRANCH_EXTRA_CHANCE = 0.55;   // two forks, a third now and then
  const BOLT_BRANCH_FROM = 0.2, BOLT_BRANCH_TO = 0.75;            // where along the bolt a fork leaves it
  const BOLT_BRANCH_STEPS_MIN = 9, BOLT_BRANCH_STEPS_SPAN = 7, BOLT_BRANCH_DRIFT_TILES = 0.5;
  const BOLT_FAR_CSS_PX = 4, BOLT_FAR_GLOW_CSS_PX = 11;   // the far view's mark and its glow
  // The scorch mark: SCAR_PIXELS dark pixels around the tile's middle and SCAR_SPECKS fainter ones
  // farther out. It lands as the bolt peaks, fades in over SCAR_IN_MS, stays at full for the first
  // SCAR_FULL_SHARE of the ground's FireScorchDays and fades over the rest, in SCAR_STEPS steps.
  const SCAR_RGB = '22,14,10', SCAR_ALPHA = 0.85, SCAR_SPECK_ALPHA = 0.4, SCAR_PIXELS = 6, SCAR_SPECKS = 4;
  const SCAR_IN_MS = 600, SCAR_FULL_SHARE = 0.5, SCAR_STEPS = 8, SCAR_KEEP = 24;
  const SALT_BOLT = 51, SALT_SCAR = 55;

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

  const KIND = AS.KIND, FLOW = AS.FLOW, EV = AS.EV, HOLD = AS.SPRITE_HOLD, FRAME = AS.SPRITE_FRAME;

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
    const gusts = AS.Gusts();          // the wind on the grass (sprites.js)
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

    // Scorch shows fully dark until it has this many days left, then fades: the shorter of the
    // nuke's and a fire's, so a fire's burnt ground is as dark as a crater, and a crater still
    // greens from its rim (less scorch there) inward.
    const scorchFadeDays = sim => Math.min(sim.T.world.ScorchDays, sim.T.world.FireScorchDays);

    // ---- water, drawn over real time ----------------------------------------------------
    // Per tile: tgt (the sim's look now: 0 dry, 1..3 the depth band + 1), and w[3t + band], how
    // much of each band's look is on screen (0..1). A settled tile has weight 1 on its own band
    // and 0 elsewhere. A tile joins `list` when its target changes and leaves when its weights
    // have reached it, so a frame touches only the tiles that are moving. Going wet (or deeper)
    // raises the new band's weight; the old band's look is held under it until it is fully there,
    // so a crossfade between two wet looks never dips toward the ground. Going dry lowers every
    // weight. A target that flips back mid-fade just turns the weights around from where they are.
    let water = null, lastDrawMs = 0;
    function waterStepTicks() {
      return AS.WATER_STEP_DAYS ? Math.max(1, Math.round(AS.WATER_STEP_DAYS * AS.DAY_SECONDS * AS.TICK_HZ)) : 1;
    }
    function updateWater(sim, nowMs) {
      const W = sim.W, n = W.n;
      if (!water || water.W !== W || water.n !== n) {
        water = { W, n, tgt: new Uint8Array(n), w: new Float32Array(n * 3), fade: new Uint8Array(n), list: new Int32Array(n), count: 0, step: -1, flips: -1, wet: -1, ms: nowMs };
        const D = W.wDepth, tgt = water.tgt, w = water.w;
        for (let t = 0; t < n; t++) if (D[t] > 0) { const c = AS.waterBand(D[t]) + 1; tgt[t] = c; w[t * 3 + c - 1] = 1; }
        water.step = Math.floor(sim.tickCount / waterStepTicks()); water.flips = W.wetFlips; water.wet = W.waterCount;
        return;
      }
      const st = Math.floor(sim.tickCount / waterStepTicks());
      // Depths change only in a water step or when something is painted (which flips tiles), so
      // one pass over the world per frame at most, and none while nothing has moved.
      if (st !== water.step || W.wetFlips !== water.flips || W.waterCount !== water.wet) {
        water.step = st; water.flips = W.wetFlips; water.wet = W.waterCount;
        const D = W.wDepth, tgt = water.tgt, fade = water.fade, list = water.list;
        for (let t = 0; t < n; t++) {
          const d = D[t], c = d > 0 ? AS.waterBand(d) + 1 : 0;
          if (c !== tgt[t]) { tgt[t] = c; if (!fade[t]) { fade[t] = 1; list[water.count++] = t; } }
        }
      }
      if (!(nowMs > water.ms)) return;
      const d = (nowMs - water.ms) / WATER_FADE_MS;
      water.ms = nowMs;
      const w = water.w, tgt = water.tgt, fade = water.fade, list = water.list;
      for (let i = 0; i < water.count; i++) {
        const t = list[i], b = t * 3, c = tgt[t];
        let done;
        if (c === 0) {
          done = true;
          for (let k = 0; k < 3; k++) { let v = w[b + k]; if (v > 0) { v -= d; if (v <= 0) v = 0; else done = false; w[b + k] = v; } }
        } else {
          let v = w[b + c - 1] + d;
          done = v >= 1;
          if (done) { v = 1; for (let k = 0; k < 3; k++) w[b + k] = 0; }
          w[b + c - 1] = v;
        }
        if (done) { fade[t] = 0; list[i] = list[--water.count]; i--; }
      }
    }
    // How much water is on screen at tile t (0..1: the layers laid over each other), and the band
    // that shows most. Both are for the checks and the wading stance.
    function waterShown(t) {
      const b = t * 3, w = water.w;
      return 1 - (1 - w[b]) * (1 - w[b + 1]) * (1 - w[b + 2]);
    }
    function bandShown(t) {
      const b = t * 3, w = water.w;
      if (waterShown(t) <= 0) return -1;
      return w[b] >= w[b + 1] && w[b] >= w[b + 2] ? 0 : w[b + 1] >= w[b + 2] ? 1 : 2;
    }
    // The far view's color of a tile under its fading water: `c`, the ground without water,
    // under the band looks, the fullest first, as drawn up close.
    function farWaterMix(c, t) {
      const b = t * 3, w = water.w;
      let i0 = 0, i1 = 1, i2 = 2, x;
      if (w[b + i0] < w[b + i1]) { x = i0; i0 = i1; i1 = x; }
      if (w[b + i1] < w[b + i2]) { x = i1; i1 = i2; i2 = x; }
      if (w[b + i0] < w[b + i1]) { x = i0; i0 = i1; i1 = x; }
      if (w[b + i0] > 0) c = mixAbgr(c, FAR_WATERS[i0], w[b + i0]);
      if (w[b + i1] > 0) c = mixAbgr(c, FAR_WATERS[i1], w[b + i1]);
      if (w[b + i2] > 0) c = mixAbgr(c, FAR_WATERS[i2], w[b + i2]);
      return c;
    }
    // A water tile up close, at its place on screen. Settled, one sprite; fading, the bands that
    // are on screen, fullest first, each at its weight.
    const wOrder = [0, 1, 2];
    function drawWater(t, tx, ty, img, sh, px, dx, dy, dw, dh) {
      if (!water.fade[t]) {
        const c = water.tgt[t];
        if (c) { const id = AS.spriteWater(tx, ty, c - 1); ctx.drawImage(img, sh.sx(id), sh.sy(id), px, px, dx, dy, dw, dh); }
        return;
      }
      const b = t * 3, w = water.w;
      wOrder[0] = 0; wOrder[1] = 1; wOrder[2] = 2;
      if (w[b] < w[b + 1]) { wOrder[0] = 1; wOrder[1] = 0; }
      if (w[b + wOrder[1]] < w[b + 2]) { const x = wOrder[1]; wOrder[1] = 2; wOrder[2] = x; }
      if (w[b + wOrder[0]] < w[b + wOrder[1]]) { const x = wOrder[0]; wOrder[0] = wOrder[1]; wOrder[1] = x; }
      for (let i = 0; i < 3; i++) {
        const band = wOrder[i], a = w[b + band];
        if (a <= 0) break;
        const id = AS.spriteWater(tx, ty, band);
        ctx.globalAlpha = a;
        ctx.drawImage(img, sh.sx(id), sh.sy(id), px, px, dx, dy, dw, dh);
      }
      ctx.globalAlpha = 1;
    }
    // The depth an animal's feet are in, as drawn: the sim's, once the drawn water on its tile
    // is at least WATER_STANCE_MIN, else none.
    function stanceDepth(W, t) {
      const shown = waterShown(t) >= WATER_STANCE_MIN;
      return shown ? (W.wDepth[t] > 0 ? W.wDepth[t] : WADE_FLOOR_M) : 0;
    }

    // ---- soil wetness, drawn over real time ----------------------------------------------
    // Per tile: tgt (the level its soil is at now), cur (the level on screen), nxt and prog (a
    // tile moving from cur toward nxt, one level at a time, prog 0..1 of the way) and act (it is
    // in `list`: moving or about to). A sweep takes tgt up to date, a slice of the world a
    // frame, and a tile whose tgt differs from cur joins the list and leaves it when they
    // agree; a frame touches only the tiles moving. A fade whose tgt turns back runs backwards
    // from where it is, so a tile that flaps never completes a change. Only worlds with rain
    // (and so soil water) have any of it. avg and stamp (sim seconds of its last update) are
    // each tile's slow average share, kept by the same sweep, so there is no extra pass.
    let soil = null;
    // f: the share of the tile's room now; ex: how far it is above its recent average.
    function levelOf(f, ex, prev) {
      // Wet from the top level down, dry likewise: a level holds while the share stays within
      // SOIL_HYSTERESIS of its threshold, and is taken only once past it.
      let l = 0;
      for (let i = SOIL_WET_ABOVE.length - 1; i >= 0; i--) {
        if (ex >= SOIL_WET_ABOVE[i] * (prev > i ? 1 - SOIL_HYSTERESIS : 1 + SOIL_HYSTERESIS)) { l = i + 1; break; }
      }
      if (l === 0 && f < SOIL_DRY_BELOW[0] * (prev < 0 ? 1 + SOIL_HYSTERESIS : 1 - SOIL_HYSTERESIS)) {
        l = -1;
        for (let i = 1; i < SOIL_DRY_BELOW.length; i++) {
          if (f < SOIL_DRY_BELOW[i] * (prev < -i ? 1 + SOIL_HYSTERESIS : 1 - SOIL_HYSTERESIS)) l = -(i + 1); else break;
        }
      }
      return l;
    }
    function soilIsLive(sim) {
      return !!(sim.W.water && sim.weather && sim.weather.field);
    }
    function updateSoil(sim, nowMs) {
      if (!soilIsLive(sim)) { soil = null; return; }
      const W = sim.W, n = W.n, G = W.water.G, room = W.water.room;
      if (!soil || soil.W !== W || soil.n !== n) {
        soil = { W, n, tgt: new Int8Array(n), cur: new Int8Array(n), nxt: new Int8Array(n), prog: new Float32Array(n), act: new Uint8Array(n), list: new Int32Array(n), avg: new Float32Array(n), stamp: new Float32Array(n), count: 0, pos: 0, ms: nowMs };
        const simS0 = sim.tickCount * AS.DT;
        for (let t = 0; t < n; t++) { const g = G[t] / room; soil.avg[t] = g; soil.stamp[t] = simS0; soil.tgt[t] = soil.cur[t] = soil.nxt[t] = levelOf(g, 0, 0); }
        return;
      }
      const dt = nowMs - soil.ms;
      if (!(dt > 0)) return;
      soil.ms = nowMs;
      const tgt = soil.tgt, cur = soil.cur, nxt = soil.nxt, prog = soil.prog, act = soil.act, list = soil.list, avg = soil.avg, stamp = soil.stamp;
      const simS = sim.tickCount * AS.DT;
      // Sweep a slice of the world, so the whole of it is looked at once per SOIL_SWEEP_MS.
      let count = Math.min(n, Math.ceil(n * Math.min(dt, SOIL_SWEEP_MS) / SOIL_SWEEP_MS));
      let t = soil.pos;
      while (count-- > 0) {
        const g = G[t] / room, since = simS - stamp[t];
        if (since >= SOIL_AVG_MIN_S) { avg[t] += (g - avg[t]) * since / (SOIL_AVG_TAU_S + since); stamp[t] = simS; }
        else if (since < 0) stamp[t] = simS;   // the clock went back (a loaded save): start the average's clock again
        const l = levelOf(g, g - avg[t], tgt[t]);
        if (l !== tgt[t]) { tgt[t] = l; if (!act[t] && l !== cur[t]) { act[t] = 1; list[soil.count++] = t; } }
        if (++t === n) t = 0;
      }
      soil.pos = t;
      const d = dt / SOIL_FADE_MS;
      // Every moving tile, every frame, so each tile's levels are read once and the count is kept local.
      let live = soil.count;
      for (let i = 0; i < live; i++) {
        const u = list[i], tg = tgt[u];
        let p = prog[u], cu = cur[u];
        if (p === 0) {
          // Idle: begin a step toward the target, if it is still away from the screen.
          if (tg === cu) { act[u] = 0; list[i] = list[--live]; i--; continue; }
          nxt[u] = cu + (tg > cu ? 1 : -1);
        }
        const nx = nxt[u];
        // Toward nxt while the target is that way, back toward cur when it is not.
        const forward = (tg > cu) === (nx > cu) && tg !== cu;
        p += forward ? d : -d;
        if (p >= 1) { cu = nx; cur[u] = cu; p = 0; }
        else if (p <= 0) p = 0;
        prog[u] = p;
        if (p === 0 && tg === cu) { nxt[u] = cu; act[u] = 0; list[i] = list[--live]; i--; }
      }
      soil.count = live;
    }
    // The grass sprite for a blade at soil level l: dried (sprites.js) below 0, else the plain one.
    function grassId(third, lean, l) {
      return l < 0 ? AS.spriteGrassDry(third, lean, -l) : lean > 0 ? AS.spriteGrassLean(third) : lean < 0 ? AS.spriteGrassLeanLeft(third) : AS.spriteGrass(third);
    }
    // The veil's alpha on tile t as drawn: its level's, eased with the next while it moves.
    const veil = l => (l > 0 ? WET_ALPHA[l - 1] : 0);
    function veilOf(t) {
      const c = soil.cur[t], p = soil.prog[t];
      return p > 0 ? veil(c) * (1 - p) + veil(soil.nxt[t]) * p : veil(c);
    }
    // The far view's color of a tile (a blade of `third` when third >= 0, else bare ground).
    function farSoil(t, third) {
      const row = third >= 0 ? FAR_GRASS_BY[third] : FAR_GROUND_BY, c = row[soil.cur[t] + SOIL_LEVELS_DRY];
      const p = soil.prog[t];
      return p > 0 ? mixAbgr(c, row[soil.nxt[t] + SOIL_LEVELS_DRY], p) : c;
    }

    function fillCells(sim, nowMs) {
      updateWater(sim, nowMs === undefined ? lastDrawMs : nowMs);
      updateSoil(sim, nowMs === undefined ? lastDrawMs : nowMs);
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
      const bg = FAR_GROUND;
      const corpse = FAR_CORPSE, waters = FAR_WATERS, wtgt = water.tgt, wfade = water.fade, holeAt = W.hole, scorch = W.scorch, fullDays = scorchFadeDays(sim);
      const lo = 1 / 3, hi = 2 / 3;
      const flow = W.flow, ash = W.ash, fireDays = sim.T.world.FireScorchDays, emberDays = FIRE_EMBER_HOURS / 24;
      // The soil's arrays, looked up once: a property read per tile adds up over the whole map.
      const sCur = soil ? soil.cur : null, sAct = soil ? soil.act : null;
      for (let t = 0, n = W.n; t < n; t++) {
        const k = kind[t];
        if (flow[t] === FLOW.FIRE) px[t] = AS.fireLook(AS.fireStage(W, t)).flame >= AS.FLAME.MID ? FAR_FIRE_HIGH : FAR_FIRE_MID;
        else if (k === KIND.GRASS) {
          const z = size[t], third = z < lo ? 0 : z < hi ? 1 : 2;
          px[t] = sCur !== null && (sCur[t] !== 0 || sAct[t]) ? farSoil(t, third) : FAR_GRASS[third];
        }
        else if (k === KIND.CORPSE) px[t] = corpse;
        else if (wtgt[t] !== 0 && !wfade[t]) px[t] = waters[wtgt[t] - 1];   // under a wading animal too
        else {
          // Ground; a tile whose water is arriving or leaving has it mixed over the ground.
          let c;
          if (scorch[t] > 0) {
            const ground = mixAbgr(bg, FAR_SCORCH, Math.min(1, scorch[t] / fullDays)), left = scorch[t];
            // Embers glow only where a fuel fire burnt out (it left ash), never on a nuke's crater.
            c = ash[t] > 0 && left > fireDays - emberDays && left <= fireDays ? mixAbgr(ground, FAR_EMBER, (left - (fireDays - emberDays)) / emberDays) : ground;
          } else c = holeAt[t] ? FAR_HOLE : sCur !== null && (sCur[t] > 0 || sAct[t]) ? farSoil(t, -1) : bg;   // empty ground (wet, or a hole), or an animal that the loop below paints
          px[t] = wfade[t] ? farWaterMix(c, t) : c;
        }
      }
      for (let s = 0, hiSlot = W.aHigh; s < hiSlot; s++) {
        // Alight, an animal takes the fire's bright color in place of its species', steady (no alternating).
        if (W.aAlive[s]) px[W.aTile[s]] = W.aAlight[s] > 0 ? FAR_ALIGHT : FAR_ANIMAL[W.aSpecies[s]][W.aSex[s]];
      }
      cell.ctx.putImageData(cell.img, 0, 0);
    }

    // The wet veil, collected while the tiles are drawn and laid over them in a few strokes:
    // tiles at rest by level (one path and fill each), tiles still moving one at a time at
    // their own alpha. Over a tile whose water is coming or going the veil is the share the
    // water has not covered, and over settled water there is none.
    const veilRects = [[], [], []], veilMoving = [];
    function veilReset() {
      for (const r of veilRects) r.length = 0;
      veilMoving.length = 0;
    }
    function veilAdd(t, dx, dy, dw, dh) {
      const fading = water.fade[t];
      if (!fading && !soil.act[t]) {
        if (!water.tgt[t]) { const r = veilRects[soil.cur[t] - 1]; r.push(dx, dy, dw, dh); }
        return;
      }
      let a = veilOf(t);
      if (fading) a *= 1 - waterShown(t);
      else if (water.tgt[t]) return;
      if (a > 0) veilMoving.push(dx, dy, dw, dh, a);
    }
    function veilDraw() {
      ctx.fillStyle = `rgb(${WET_RGB})`;
      for (let l = 0; l < veilRects.length; l++) {
        const r = veilRects[l];
        if (!r.length) continue;
        ctx.globalAlpha = WET_ALPHA[l];
        ctx.beginPath();
        for (let i = 0; i < r.length; i += 4) ctx.rect(r[i], r[i + 1], r[i + 2], r[i + 3]);
        ctx.fill();
      }
      for (let i = 0; i < veilMoving.length; i += 5) {
        ctx.globalAlpha = veilMoving[i + 4];
        ctx.fillRect(veilMoving[i], veilMoving[i + 1], veilMoving[i + 2], veilMoving[i + 3]);
      }
      ctx.globalAlpha = 1;
    }

    function drawSprites(sim, cam, sheet, sel, dpr, nowMs) {
      const W = sim.W, v = cam.visible();
      if (v.x1 < v.x0 || v.y1 < v.y0) return;
      const s = cam.scale * dpr;
      const sh = sheet.get(Math.max(1, Math.round(s)));
      const img = sh.canvas, px = sh.px;
      const kind = W.kind, size = W.gSize, flow = W.flow;
      // Pixel art: nearest-neighbor, so a tile drawn a pixel wider than the sprite doesn't
      // blur or pull in the neighboring sprite's edge.
      ctx.imageSmoothingEnabled = false;
      const ox = cam.x * s, oy = cam.y * s;
      // Burnt ground is ground, not height: the topo lines go over it (water and grass go over them).
      drawScorch(sim, v, s, ox, oy);
      drawAshAndEmbers(sim, v, s, ox, oy, nowMs);
      if (contoursOn) drawContours(sim, cam, dpr, true);
      const sCur = soil ? soil.cur : null, sAct = soil ? soil.act : null;
      veilReset();
      for (let ty = v.y0; ty <= v.y1; ty++) {
        const dy = Math.round(ty * s - oy), dh = Math.round((ty + 1) * s - oy) - dy;
        const row = ty * W.w;
        for (let tx = v.x0; tx <= v.x1; tx++) {
          const k = kind[row + tx];
          let id, id2 = -1;
          // Wet soil: a veil over the tile once it is drawn (veilDraw), but not over fire, and
          // over water only as much as the water has not yet covered it.
          if (sCur && (sCur[row + tx] > 0 || sAct[row + tx]) && flow[row + tx] !== FLOW.FIRE) {
            const dx = Math.round(tx * s - ox);
            veilAdd(row + tx, dx, dy, Math.round((tx + 1) * s - ox) - dx, dh);
          }
          if (flow[row + tx] === FLOW.FIRE) {
            const bx = Math.round(tx * s - ox);
            drawBurning(W, row + tx, tx, ty, img, sh, px, bx, dy, Math.round((tx + 1) * s - ox) - bx, dh, nowMs);
            continue;
          }
          if (W.hole[row + tx]) {
            // The hole is ground: it goes under a corpse that lies on it, and under any animal.
            const dx = Math.round(tx * s - ox), dw = Math.round((tx + 1) * s - ox) - dx;
            const hid = AS.spriteHole();
            ctx.drawImage(img, sh.sx(hid), sh.sy(hid), px, px, dx, dy, dw, dh);
          }
          if (k === KIND.GRASS) {
            const third = AS.grassGlyph(size[row + tx]) - AS.GLYPH.GRASS_0;
            const lean = gusts.leans(tx, ty);
            if (sCur && (sCur[row + tx] < 0 || sAct[row + tx])) {
              // Dried grass, crossing to the next step while its level moves.
              id = grassId(third, lean, sCur[row + tx]);
              if (soil.prog[row + tx] > 0) { id2 = grassId(third, lean, soil.nxt[row + tx]); if (id2 === id) id2 = -1; }
            } else id = lean > 0 ? AS.spriteGrassLean(third) : lean < 0 ? AS.spriteGrassLeanLeft(third) : AS.spriteGrass(third);
          }
          else if (k === KIND.CORPSE) {
            // A body with meat on it lies flat, eye shut; once the meat is gone, a skull. A
            // body with none to begin with (a species with no MeatOnBody) lies there for a moment after the death,
            // so it doesn't snap straight to a skull.
            if (W.cMeat[row + tx] > 0) id = AS.spriteCarcass(W.cSpecies[row + tx]);
            else if (nowMs < deathUntil[row + tx]) id = AS.spriteCarcass(W.cSpecies[row + tx]);
            else id = AS.spriteSkull(W.cSpecies[row + tx]);
          } else {
            // Water, as drawn over real time (updateWater), under a wading animal too; nothing
            // for empty ground or an animal on land (own pass).
            const dx = Math.round(tx * s - ox);
            drawWater(row + tx, tx, ty, img, sh, px, dx, dy, Math.round((tx + 1) * s - ox) - dx, dh);
            continue;
          }
          const dx = Math.round(tx * s - ox), dw = Math.round((tx + 1) * s - ox) - dx;
          ctx.drawImage(img, sh.sx(id), sh.sy(id), px, px, dx, dy, dw, dh);
          if (id2 >= 0) {
            ctx.globalAlpha = soil.prog[row + tx];
            ctx.drawImage(img, sh.sx(id2), sh.sy(id2), px, px, dx, dy, dw, dh);
            ctx.globalAlpha = 1;
          }
        }
      }
      veilDraw();
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
        // In water (sprites.js, "in the water"): the tile under it now, mid-glide the one it is
        // nearer. Swimming: low, legs under, bobbing; drowning: down to its eyes. Wading: feet under.
        const under = p < 0.5 ? W.aFrom[a] : W.aTile[a], depth = stanceDepth(W, under);
        if (depth > 0) {
          const stage = stageOf(sim, a, W), left = facing.left(a);
          const dx = Math.round(ax * s - ox), dy = Math.round(ay * s - oy);
          if (depth > AS.wadeOf(sim, a)) {
            const drowning = !(W.aStamina[a] > 0);
            const bob = drowning ? 0 : ((nowMs + AS.spriteIdleOffset(serial) * 1000) % AS.SWIM_BOB_MS < AS.SWIM_BOB_MS / 2 ? 0 : 1);
            const firstHidden = AS.spriteEyeRow(sp) + 1 + (drowning ? 0 : AS.SWIM_BELOW) - bob;
            const id = AS.spriteIndex(sp, W.aSex[a], stage, left, AS.SPRITE_FRAME.STAND);
            const cutY = AS.spriteRowPx(px, stage, AS.SWIM_CUT), shownH = AS.spriteRowPx(px, stage, firstHidden);
            ctx.drawImage(img, sh.sx(id), sh.sy(id), px, shownH, dx, dy + cutY - shownH, px, shownH);
            if (W.aAlight[a] > 0) drawAlight(sim, a, img, sh, px, stage, dx, dy + cutY - AS.spriteRowPx(px, stage, AS.SPRITE_SIZE), nowMs);
            const lineH = Math.max(1, AS.spriteRowPx(px, stage, firstHidden + 1) - shownH);
            const span = AS.spriteRowSpan(sp, AS.SPRITE_FRAME.STAND, firstHidden, left);
            if (span) waterline(dx, dy + cutY, px, stage, span, lineH, moving && !drowning && W.aTile[a] % W.w !== W.aFrom[a] % W.w ? (left ? 1 : -1) : 0);
          } else {
            const id = AS.spriteIndex(sp, W.aSex[a], stage, left, posed[0]);
            const feetY = AS.spriteRowPx(px, stage, AS.SPRITE_SIZE - 1), lift = Math.round(posed[1] * unit);
            ctx.drawImage(img, sh.sx(id), sh.sy(id), px, feetY, dx, dy - lift, px, feetY);
            if (W.aAlight[a] > 0) drawAlight(sim, a, img, sh, px, stage, dx, dy - lift, nowMs);
            const span = AS.spriteRowSpan(sp, posed[0], AS.SPRITE_SIZE - 1, left);
            if (span) waterline(dx, dy + feetY, px, stage, span, Math.max(1, px - feetY), 0);
          }
          continue;
        }
        // A bunny that has reached a hole shows only its ears and eyes (arriving or leaving, it
        // is drawn whole, gliding over the hole).
        const peeking = sp === 0 && !moving && W.hole[W.aTile[a]] === 1;
        const stage = stageOf(sim, a, W);
        const id = peeking
          ? AS.spritePeek(W.aSex[a])
          : AS.spriteIndex(sp, W.aSex[a], stage, facing.left(a), posed[0]);
        // Lift in whole sprite pixels, so the body hops in the art's own grid.
        const bx = Math.round(ax * s - ox), by = Math.round(ay * s - oy) - Math.round((peeking ? 0 : posed[1]) * unit);
        ctx.drawImage(img, sh.sx(id), sh.sy(id), px, px, bx, by, px, px);
        if (W.aAlight[a] > 0 && !peeking) drawAlight(sim, a, img, sh, px, stage, bx, by, nowMs);
      }
      ctx.imageSmoothingEnabled = true;
    }

    // Flames on a burning animal (W.aAlight > 0), drawn over its sprite at (dx, dy) in device px,
    // so it stays fully in view: it is alive and moving, never engulfed. Tall tongues for the
    // first ALIGHT_TALL_SHARE of its fire, the lower mid flames after, so it reads as burning
    // from the first moment and settles as the fire does. A baby gets the flame at its own
    // (smaller) size, bottom-centered like its sprite. The sway is the tiles' rule, on a clock
    // of its own per animal (its serial).
    // The flames ride ALIGHT_RAISE sprite rows above the body's own rows, licking up from its
    // back, so the body shows under them instead of being swallowed.
    const ALIGHT_TALL_SHARE = 0.5, ALIGHT_RAISE = 2;
    function drawAlight(sim, a, img, sh, px, stage, dx, dy, nowMs) {
      const W = sim.W, hours = sim.T[AS.SPECIES_KEY[W.aSpecies[a]]].AlightHours;
      const burned = hours > 0 ? 1 - W.aAlight[a] / hours : 0;
      const flame = burned < ALIGHT_TALL_SHARE ? AS.FLAME.TONGUES_TALL : AS.FLAME.MID;
      const fid = AS.spriteFire(flame, AS.flameFrame(nowMs, W.aSerial[a], 0));
      const b = AS.spriteRowPx(px, stage, AS.SPRITE_SIZE) - AS.spriteRowPx(px, stage, 0);
      ctx.drawImage(img, sh.sx(fid), sh.sy(fid), px, px, dx + AS.spriteColPx(px, stage, 0), dy + AS.spriteRowPx(px, stage, 0) - Math.round(ALIGHT_RAISE * b / AS.SPRITE_SIZE), b, b);
    }

    // Where the water meets an animal: a lighter line under the columns its body covers in the
    // first row under water, and swimming sideways (back: -1 behind a right-facing swimmer,
    // 1 a left-facing one; 0 none) a short V wake that fades behind it. It moves only with
    // the animal (Paul's pick, 12 Oct 2026).
    function waterline(dx, y, px, stage, span, h, back) {
      const x0 = dx + AS.spriteColPx(px, stage, span[0]), x1 = dx + AS.spriteColPx(px, stage, span[1] + 1);
      ctx.fillStyle = WATERLINE;
      ctx.fillRect(x0, y, Math.max(1, x1 - x0), h);
      if (!back) return;
      const cw = Math.max(1, AS.spriteColPx(px, stage, 1) - AS.spriteColPx(px, stage, 0));
      for (let k = 1; k <= WAKE_STEPS; k++) {
        ctx.globalAlpha = WAKE_ALPHA * (1 - (k - 1) / WAKE_STEPS);
        const x = back < 0 ? x0 - k * cw : x1 + (k - 1) * cw, spread = Math.ceil(k / 2) * h;
        ctx.fillRect(x, y - spread, cw, h);
        ctx.fillRect(x, y + spread, cw, h);
      }
      ctx.globalAlpha = 1;
    }

    // A burning tile (option E): the burning thing charred by how far along the fire is, with
    // flames over it; in the last part full flames hide it. The look comes from the sim's stage
    // (AS.fireLook); the sway is real time, per tile (AS.flameFrame).
    function drawBurning(W, t, tx, ty, img, sh, px, dx, dy, dw, dh, nowMs) {
      const look = AS.fireLook(AS.fireStage(W, t));
      // A painted ember on bare ground has nothing to char: the flames stand on the ground.
      if (look.char >= 0 && W.kind[t] !== KIND.EMPTY) {
        let id;
        if (W.kind[t] === KIND.GRASS) {
          // A blade on dry soil burns in its straw color, not green (the level it is drawn at, so it matches the step it was in).
          const third = AS.grassGlyph(W.gSize[t]) - AS.GLYPH.GRASS_0, dry = soil ? -soil.cur[t] : 0;
          id = dry > 0 ? AS.spriteCharGrassDry(third, look.char, dry) : AS.spriteCharGrass(third, look.char);
        }
        else if (W.cMeat[t] > 0 || nowMs < deathUntil[t]) id = AS.spriteCharCarcass(W.cSpecies[t], look.char);
        else id = AS.spriteCharSkull(W.cSpecies[t], look.char);
        ctx.drawImage(img, sh.sx(id), sh.sy(id), px, px, dx, dy, dw, dh);
      }
      const fid = AS.spriteFire(look.flame, AS.flameFrame(nowMs, tx, ty));
      ctx.drawImage(img, sh.sx(fid), sh.sy(fid), px, px, dx, dy, dw, dh);
    }

    // Ash on every tile that has some (W.ash), thinning as grass spends it and the weather takes it,
    // and embers on the ones that burnt out lately (scorch from FireScorchDays down by
    // FIRE_EMBER_HOURS), over the scorch. A nuke's crater has scorch but no ash, so it gets neither.
    // Ash is batched per alpha step, by its share of a full blade's.
    const ashRects = Array.from({ length: SCORCH_FADE_STEPS + 1 }, () => []);
    const emberTiles = [];
    function drawAshAndEmbers(sim, v, s, ox, oy, nowMs) {
      const W = sim.W, scorch = W.scorch, ash = W.ash, fireDays = sim.T.world.FireScorchDays, emberDays = FIRE_EMBER_HOURS / 24;
      const fullAsh = sim.T.grass.Ash;
      for (const r of ashRects) r.length = 0;
      emberTiles.length = 0;
      let any = false;
      for (let ty = v.y0; ty <= v.y1; ty++) {
        const dy = Math.round(ty * s - oy), dh = Math.round((ty + 1) * s - oy) - dy;
        const row = ty * W.w;
        for (let tx = v.x0; tx <= v.x1; tx++) {
          const here = ash[row + tx];
          if (!(here > 0)) continue;
          const left = scorch[row + tx];
          const dx = Math.round(tx * s - ox), dw = Math.round((tx + 1) * s - ox) - dx;
          const u = Math.max(1, Math.round(dw / AS.SPRITE_SIZE)), uh = Math.max(1, Math.round(dh / AS.SPRITE_SIZE));
          const list = ashRects[Math.max(1, Math.ceil(Math.min(1, here / fullAsh) * SCORCH_FADE_STEPS))];
          for (let k = 0; k < ASH_PIXELS; k++) {
            const ax = Math.floor(AS.spriteHash(tx, ty, SALT_ASH_X + k) * AS.SPRITE_SIZE);
            const ay = ASH_FIRST_ROW + Math.floor(AS.spriteHash(tx, ty, SALT_ASH_Y + k) * ASH_ROWS);
            list.push(dx + Math.round(ax * dw / AS.SPRITE_SIZE), dy + Math.round(ay * dh / AS.SPRITE_SIZE), u, uh);
          }
          any = true;
          if (left > fireDays - emberDays && left <= fireDays) emberTiles.push(tx, ty, dx, dy, dw, dh, (left - (fireDays - emberDays)) / emberDays);
        }
      }
      if (!any) return;
      ctx.fillStyle = AS.FIRE_PALETTE.a;
      for (let q = 1; q <= SCORCH_FADE_STEPS; q++) {
        const list = ashRects[q];
        if (!list.length) continue;
        ctx.globalAlpha = q / SCORCH_FADE_STEPS;
        ctx.beginPath();
        for (let i = 0; i < list.length; i += 4) ctx.rect(list[i], list[i + 1], list[i + 2], list[i + 3]);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < emberTiles.length; i += 7) {
        const tx = emberTiles[i], ty = emberTiles[i + 1], dx = emberTiles[i + 2], dy = emberTiles[i + 3], dw = emberTiles[i + 4], dh = emberTiles[i + 5], f = emberTiles[i + 6];
        const step = AS.flameStep(nowMs, tx, ty), u = Math.max(1, Math.round(dw / AS.SPRITE_SIZE)), uh = Math.max(1, Math.round(dh / AS.SPRITE_SIZE));
        for (let k = 0; k < EMBER_PIXELS && f > k / EMBER_PIXELS; k++) {
          const ex = Math.floor(AS.spriteHash(tx, ty, SALT_EMBER_X + k) * AS.SPRITE_SIZE);
          ctx.fillStyle = (step + k) % EMBER_LIT_EVERY === 0 ? AS.FIRE_PALETTE.e : AS.FIRE_PALETTE.k;
          ctx.fillRect(dx + Math.round(ex * dw / AS.SPRITE_SIZE), dy + Math.round((EMBER_FIRST_ROW + k) * dh / AS.SPRITE_SIZE), u, uh);
        }
      }
    }

    // Scorched tiles, first of all (under the topo lines), fully dark until the last
    // scorchFadeDays, then fading out in steps.
    function drawScorch(sim, v, s, ox, oy) {
      const W = sim.W, scorch = W.scorch, fullDays = scorchFadeDays(sim);
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

    // ---- rain and lightning, over everything ---------------------------------------------
    // Rain (sprite mode only): per RAIN_CELL-tile cell, `a` is how much of its rain shows (0..1),
    // eased toward 1 while `until` (real ms) is ahead of the clock and toward 0 after; `seen` is
    // the last frame the cell was looked at, so one off screen for RAIN_STALE_MS starts again
    // from nothing instead of popping in as the view comes back to it. The drops themselves are
    // placed by hashes of the cell and moved by the real clock, so only `a` ever depends on the sim.
    let rain = null;
    const dropRects = Array.from({ length: RAIN_ALPHA_STEPS }, () => []);
    const ringList = Array.from({ length: RAIN_ALPHA_STEPS }, () => []);
    function updateRain(sim, cam, nowMs) {
      const sh = sim.weather && sim.weather.showers;
      if (!sh) { rain = null; return; }
      const W = sim.W, cw = Math.ceil(W.w / RAIN_CELL), ch = Math.ceil(W.h / RAIN_CELL);
      if (!rain || rain.W !== W) rain = { W, cw, ch, a: new Float32Array(cw * ch), until: new Float64Array(cw * ch), seen: new Float64Array(cw * ch), ms: nowMs };
      const dt = Math.max(0, Math.min(nowMs - rain.ms, RAIN_STALE_MS));
      rain.ms = nowMs;
      const v = cam.visible();
      const cx0 = Math.max(0, Math.floor(v.x0 / RAIN_CELL)), cx1 = Math.min(cw - 1, Math.floor(v.x1 / RAIN_CELL));
      const cy0 = Math.max(0, Math.floor(v.y0 / RAIN_CELL)), cy1 = Math.min(ch - 1, Math.floor(v.y1 / RAIN_CELL));
      if (cx1 < cx0 || cy1 < cy0) return;
      // Cells under a shower in view are held for STREAK_HOLD_MS from now.
      for (let i = 0; i < sh.n; i++) {
        const x = sh.x[i], y = sh.y[i], r = sh.r[i];
        if (x + r < v.x0 || x - r > v.x1 + 1 || y + r < v.y0 || y - r > v.y1 + 1) continue;
        const r2 = r * r;
        const ax0 = Math.max(cx0, Math.floor((x - r) / RAIN_CELL)), ax1 = Math.min(cx1, Math.floor((x + r) / RAIN_CELL));
        const ay0 = Math.max(cy0, Math.floor((y - r) / RAIN_CELL)), ay1 = Math.min(cy1, Math.floor((y + r) / RAIN_CELL));
        for (let cy = ay0; cy <= ay1; cy++) {
          const dy = (cy + 0.5) * RAIN_CELL - y;
          for (let cx = ax0; cx <= ax1; cx++) {
            const dx = (cx + 0.5) * RAIN_CELL - x;
            if (dx * dx + dy * dy <= r2) rain.until[cy * cw + cx] = nowMs + STREAK_HOLD_MS;
          }
        }
      }
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        const c = cy * cw + cx;
        let a = nowMs - rain.seen[c] > RAIN_STALE_MS ? 0 : rain.a[c];
        rain.seen[c] = nowMs;
        if (rain.until[c] > nowMs) a = Math.min(1, a + dt / RAIN_IN_MS);
        else a = Math.max(0, a - dt / RAIN_OUT_MS);
        rain.a[c] = a;
      }
    }
    // The rain's strength at a point (tile coordinates): the cells' values blended between their
    // centers, so a shower's edge is soft instead of a ragged row of 4-tile squares.
    function rainAt(x, y) {
      const cw = rain.cw, ch = rain.ch, gx = x / RAIN_CELL - 0.5, gy = y / RAIN_CELL - 0.5;
      const i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j, a = rain.a;
      const i0 = i < 0 ? 0 : i, i1 = i + 1 > cw - 1 ? cw - 1 : i + 1, j0 = j < 0 ? 0 : j, j1 = j + 1 > ch - 1 ? ch - 1 : j + 1;
      const top = a[j0 * cw + i0] * (1 - fx) + a[j0 * cw + i1] * fx, bot = a[j1 * cw + i0] * (1 - fx) + a[j1 * cw + i1] * fx;
      return top * (1 - fy) + bot * fy;
    }
    const smooth01 = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
    function drawRain(sim, cam, dpr, nowMs) {
      if (!rain) return;
      const W = rain.W, v = cam.visible(), s = cam.scale * dpr, u = s / AS.SPRITE_SIZE, cw = rain.cw;
      const cx0 = Math.max(0, Math.floor(v.x0 / RAIN_CELL)), cx1 = Math.min(cw - 1, Math.floor(v.x1 / RAIN_CELL));
      const cy0 = Math.max(0, Math.floor(v.y0 / RAIN_CELL)), cy1 = Math.min(rain.ch - 1, Math.floor(v.y1 / RAIN_CELL));
      const wind = sim.wind, a = rain.a, tSec = nowMs / 1000, S = AS.SPRITE_SIZE;
      const slope = wind ? wind.toX * Math.min(1, wind.kmh / AS.GUSTS.FULL_KMH) * STREAK_SLOPE : 0;
      const stair = u >= STREAK_STAIR_AT, cellPx = RAIN_CELL * s, span = cellPx + STREAK_LEN * u;
      const dash = Math.max(1, Math.round(u)), steps = RAIN_ALPHA_STEPS, waterOn = !!water;
      for (const r of dropRects) r.length = 0;
      for (const r of ringList) r.length = 0;
      const bucket = f => Math.min(steps, Math.max(1, Math.ceil(f * steps))) - 1;
      let any = false;
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        const c = cy * cw + cx;
        // A cell with no rain of its own may still be reached by a neighbor's, through rainAt.
        if (a[c] + (cx > 0 ? a[c - 1] : 0) + (cx < cw - 1 ? a[c + 1] : 0) + (cy > 0 ? a[c - cw] : 0) + (cy < rain.ch - 1 ? a[c + cw] : 0) <= 0.01) continue;
        const bx = cx * cellPx - cam.x * s, by = cy * cellPx - cam.y * s;
        for (let k = 0; k < STREAKS_PER_CELL; k++) {
          const hx = AS.spriteHash(cx, cy, SALT_STREAK_X + k * 2) * cellPx;
          const speed = (STREAK_SPEED + AS.spriteHash(cx, cy, SALT_STREAK_V + k * 2) * STREAK_SPEED_SPREAD) * u;
          // The head's place down the cell; the dash trails above it, slanted back against the way it falls.
          const head = (AS.spriteHash(cx, cy, SALT_STREAK_Y + k * 2) * span + speed * tSec) % span;
          const f = rainAt(cx * RAIN_CELL + hx / s, cy * RAIN_CELL + Math.min(head, cellPx) / s);
          if (f < RAIN_FIELD_MIN) continue;
          if (stair) {
            for (let j = 0; j < STREAK_LEN; j++) {
              const yy = head - j * u;
              if (yy < 0 || yy > cellPx) continue;
              dropRects[bucket(f * (1 - j / STREAK_LEN))].push(Math.round(bx + hx + slope * yy), Math.round(by + yy), dash, dash);
            }
          } else {
            dropRects[bucket(f * 0.6)].push(Math.round(bx + hx + slope * head), Math.round(by + head - STREAK_LEN * u), dash, Math.max(dash, Math.round(STREAK_LEN * u)));
          }
          any = true;
        }
        for (let k = 0; k < RIPPLES_PER_CELL; k++) {
          const per = RIPPLE_SECONDS * (1 - RIPPLE_SPREAD / 2 + AS.spriteHash(cx, cy, SALT_RIPPLE + k * 3) * RIPPLE_SPREAD);
          const life = (tSec + AS.spriteHash(cx, cy, SALT_RIPPLE + k * 3 + 1) * per) / per, cyc = Math.floor(life), ph = life - cyc;
          const px = cx * RAIN_CELL + AS.spriteHash(cx * 16 + k, cyc, SALT_RIPPLE + k * 3 + 2) * RAIN_CELL;
          const py = cy * RAIN_CELL + AS.spriteHash(cy * 16 + k, cyc, SALT_RIPPLE + k * 3 + 2) * RAIN_CELL;
          const tx = Math.floor(px), ty = Math.floor(py);
          if (tx >= W.w || ty >= W.h) continue;
          const f = rainAt(px, py);
          if (f < RAIN_FIELD_MIN) continue;
          if (waterOn && waterShown(ty * W.w + tx) >= WATER_STANCE_MIN) {
            // A ring on water, born at zero strength so the rain's edge moving under it never pops it in.
            const al = f * (1 - ph) * smooth01(ph * 6), r = (1 + RIPPLE_GROW * ph) * u;
            if (al > 0.01) ringList[bucket(al)].push((px - cam.x) * s, (py - cam.y) * s, r, r * 0.5);
          } else {
            // A dot where a drop landed, its two side specks coming in late.
            const al = f * Math.sin(Math.PI * ph), sp = al * 0.7 * smooth01((ph - SPLASH_SPECK_FROM) / SPLASH_SPECK_SPAN);
            const x = Math.round((tx - cam.x) * s + Math.floor((px - tx) * S) * u), y = Math.round((ty - cam.y) * s + Math.floor((py - ty) * S) * u);
            if (al > 0.01) dropRects[bucket(al)].push(x, y, dash, dash);
            if (sp > 0.01) dropRects[bucket(sp)].push(x - dash, y - dash, dash, dash, x + dash, y - dash, dash, dash);
          }
          any = true;
        }
      }
      if (!any) return;
      ctx.fillStyle = `rgb(${STREAK_RGB})`;
      ctx.strokeStyle = `rgb(${STREAK_RGB})`;
      ctx.lineWidth = Math.max(dpr, 0.8 * u);
      for (let q = 0; q < steps; q++) {
        const list = dropRects[q], rings = ringList[q];
        if (!list.length && !rings.length) continue;
        ctx.globalAlpha = RAIN_ALPHA * (q + 1) / steps;
        if (list.length) {
          ctx.beginPath();
          for (let i = 0; i < list.length; i += 4) ctx.rect(list[i], list[i + 1], list[i + 2], list[i + 3]);
          ctx.fill();
        }
        if (rings.length) {
          ctx.beginPath();
          for (let i = 0; i < rings.length; i += 4) { ctx.moveTo(rings[i] + rings[i + 2], rings[i + 1]); ctx.ellipse(rings[i], rings[i + 1], rings[i + 2], rings[i + 3], 0, 0, Math.PI * 2); }
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    // Lightning: strikes the sim has logged (sim.weather.strikes) since the last frame; the
    // newest of them on screen starts a bolt if the last began BOLT_GAP_MS ago. The bolt's
    // path and forks are worked out once, in tile coordinates, so they stay put as the view
    // moves. Seen from the far view the same bolt is a small bright mark (drawBoltFar).
    let boltSim = null, boltSeen = 0, boltLastMs = -Infinity, bolt = null, scars = [];
    function consumeStrikes(sim, cam, nowMs) {
      const st = sim.weather && sim.weather.strikes;
      if (!st) { boltSim = null; bolt = null; scars = []; return; }
      if (boltSim !== sim || st.n < boltSeen) { boltSim = sim; boltSeen = st.n; bolt = null; scars = []; boltLastMs = -Infinity; return; }
      if (st.n === boltSeen) return;
      const cap = st.tile.length, v = cam.visible(), W = sim.W;
      let pick = -1;
      for (let k = st.n - 1; k >= Math.max(boltSeen, st.n - cap); k--) {
        const t = st.tile[k % cap], x = t % W.w, y = (t / W.w) | 0;
        if (x >= v.x0 && x <= v.x1 && y >= v.y0 && y <= v.y1) { pick = k; break; }
      }
      boltSeen = st.n;
      if (pick < 0 || nowMs - boltLastMs < BOLT_GAP_MS) return;
      const t = st.tile[pick % cap], x = t % W.w + 0.5, y = ((t / W.w) | 0) + 0.45, k = pick;
      const top = v.y0 - BOLT_ABOVE_TILES, x0 = x + (AS.spriteHash(k, t, SALT_BOLT) - 0.5) * 2 * BOLT_LEAN_TILES;
      const steps = Math.max(2, Math.ceil((y - top) / BOLT_STEP_TILES)), pts = new Float64Array((steps + 1) * 2);
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        // Straight from the sky to the tile, kicked sideways at each joint, the kicks dying to nothing at the ground.
        const jag = i === steps ? 0 : (i % 2 ? 1 : -1) * (AS.spriteHash(i, k, SALT_BOLT + 1) * 0.7 + 0.3) * BOLT_JAG_TILES * (1 - f * f);
        pts[i * 2] = x0 + (x - x0) * f + jag;
        pts[i * 2 + 1] = top + (y - top) * f;
      }
      // Forks leave the bolt part of the way down and wander off sideways, never reaching the ground.
      const nb = BOLT_BRANCHES_MIN + (AS.spriteHash(k, t, SALT_BOLT + 2) < BOLT_BRANCH_EXTRA_CHANCE ? 1 : 0), branches = [];
      for (let b = 0; b < nb; b++) {
        const at = Math.floor(steps * (BOLT_BRANCH_FROM + (BOLT_BRANCH_TO - BOLT_BRANCH_FROM) * ((b + AS.spriteHash(k, b, SALT_BOLT + 3)) / nb)));
        const len = BOLT_BRANCH_STEPS_MIN + Math.floor(AS.spriteHash(k, b, SALT_BOLT + 4) * BOLT_BRANCH_STEPS_SPAN);
        const dir = (b + (AS.spriteHash(k, t, SALT_BOLT + 5) < 0.5 ? 0 : 1)) % 2 ? 1 : -1;
        const bp = new Float64Array((len + 1) * 2);
        let bx = pts[at * 2], by = pts[at * 2 + 1];
        bp[0] = bx; bp[1] = by;
        for (let i = 1; i <= len; i++) {
          bx += dir * BOLT_BRANCH_DRIFT_TILES * (0.5 + AS.spriteHash(i, k + b * 7, SALT_BOLT + 6));
          by = Math.min(y - 0.5, by + BOLT_STEP_TILES * (0.5 + AS.spriteHash(i, k + b * 7, SALT_BOLT + 7) * 0.6));
          bp[i * 2] = bx; bp[i * 2 + 1] = by;
        }
        branches.push(bp);
      }
      bolt = { pts, branches, x, y, t0: nowMs };
      boltLastMs = nowMs;
      scars.push({ tile: t, atSec: sim.tickCount * AS.DT, born: nowMs });
      if (scars.length > SCAR_KEEP) scars.shift();
    }
    // The bolt's brightness now, 0..1: in over BOLT_IN_MS, held, out over BOLT_OUT_MS. Null once it is over.
    function boltLevel(nowMs) {
      if (!bolt) return null;
      const age = nowMs - bolt.t0;
      if (age >= BOLT_IN_MS + BOLT_HOLD_MS + BOLT_OUT_MS) { bolt = null; return null; }
      return age < BOLT_IN_MS ? smooth01(age / BOLT_IN_MS) : age < BOLT_IN_MS + BOLT_HOLD_MS ? 1 : 1 - smooth01((age - BOLT_IN_MS - BOLT_HOLD_MS) / BOLT_OUT_MS);
    }
    function glow(cx, cy, r, peak, rgb) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `rgba(${rgb},${peak})`);
      g.addColorStop(0.45, `rgba(${rgb},${peak * 0.35})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }
    function drawBolt(cam, dpr, nowMs) {
      const f = boltLevel(nowMs);
      if (f === null || f <= 0.01) return;
      const s = cam.scale * dpr, trace = p => {
        ctx.beginPath();
        for (let i = 0; i < p.length; i += 2) {
          const x = (p[i] - cam.x) * s, y = (p[i + 1] - cam.y) * s;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      };
      // The glow stays inside a circle of BOLT_GLOW_TILES around the struck tile.
      glow((bolt.x - cam.x) * s, (bolt.y - cam.y) * s, BOLT_GLOW_TILES * s, BOLT_GLOW_PEAK * f, BOLT_GLOW_RGB);
      const core = Math.max(BOLT_CORE_CSS_PX * dpr, s / AS.SPRITE_SIZE);
      ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
      ctx.lineWidth = core * BOLT_HALO_MULT;
      ctx.strokeStyle = `rgba(${BOLT_HALO_RGB},${BOLT_HALO_ALPHA * f})`;
      trace(bolt.pts);
      ctx.lineWidth = BOLT_BRANCH_CSS_PX * dpr;
      ctx.strokeStyle = `rgba(${BOLT_RGB},${BOLT_PEAK * BOLT_BRANCH_ALPHA * f})`;
      for (const b of bolt.branches) trace(b);
      ctx.lineWidth = core;
      ctx.strokeStyle = `rgba(${BOLT_RGB},${BOLT_PEAK * f})`;
      trace(bolt.pts);
    }
    // Zoomed out, a bolt is a small bright mark at the strike tile with a soft glow, fading the same way.
    function drawBoltFar(cam, dpr, nowMs) {
      const f = boltLevel(nowMs);
      if (f === null || f <= 0.01) return;
      const s = cam.scale * dpr, cx = (bolt.x - cam.x) * s, cy = (bolt.y - cam.y) * s, m = Math.max(BOLT_FAR_CSS_PX * dpr, s);
      glow(cx, cy, BOLT_FAR_GLOW_CSS_PX * dpr, BOLT_GLOW_PEAK * f, BOLT_GLOW_RGB);
      ctx.fillStyle = `rgba(${BOLT_RGB},${BOLT_PEAK * f})`;
      ctx.fillRect(cx - m / 2, cy - m / 2, m, m);
    }
    // Scorch marks of the strikes that drew a bolt: they land as it peaks and fade with the ground
    // (full for the first SCAR_FULL_SHARE of FireScorchDays, then out in SCAR_STEPS steps).
    function drawScars(sim, cam, dpr, nowMs) {
      if (!scars.length) return;
      const W = sim.W, v = cam.visible(), s = cam.scale * dpr, u = s / AS.SPRITE_SIZE, days = sim.T.world.FireScorchDays, nowSec = sim.tickCount * AS.DT;
      const px = Math.max(1, Math.round(u));
      ctx.fillStyle = `rgb(${SCAR_RGB})`;
      for (let i = scars.length - 1; i >= 0; i--) {
        const sc = scars[i], old = (nowSec - sc.atSec) / AS.DAY_SECONDS / days;
        if (old >= 1) { scars.splice(i, 1); continue; }
        const tx = sc.tile % W.w, ty = (sc.tile / W.w) | 0;
        if (tx < v.x0 || tx > v.x1 || ty < v.y0 || ty > v.y1) continue;
        const land = smooth01((nowMs - sc.born - BOLT_IN_MS) / SCAR_IN_MS);
        const fade = old <= SCAR_FULL_SHARE ? 1 : 1 - (old - SCAR_FULL_SHARE) / (1 - SCAR_FULL_SHARE);
        const a = land * Math.ceil(fade * SCAR_STEPS) / SCAR_STEPS;
        if (a <= 0) continue;
        const ox = (tx - cam.x) * s, oy = (ty - cam.y) * s;
        for (let pass = 0; pass < 2; pass++) {
          ctx.globalAlpha = a * (pass ? SCAR_SPECK_ALPHA : SCAR_ALPHA);
          ctx.beginPath();
          // Core pixels within the middle four columns and rows of the tile, specks anywhere in it.
          for (let q = 0; q < (pass ? SCAR_SPECKS : SCAR_PIXELS); q++) {
            const cx = pass ? Math.floor(AS.spriteHash(sc.tile, q, SALT_SCAR) * AS.SPRITE_SIZE) : 2 + Math.floor(AS.spriteHash(sc.tile, q, SALT_SCAR + 1) * 4);
            const cy = pass ? Math.floor(AS.spriteHash(sc.tile, q, SALT_SCAR + 2) * AS.SPRITE_SIZE) : 2 + Math.floor(AS.spriteHash(sc.tile, q, SALT_SCAR + 3) * 4);
            ctx.rect(Math.round(ox + cx * u), Math.round(oy + cy * u), px, px);
          }
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
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
      if (c.flips !== W.wetFlips) {
        // Only the squares that read a tile that flipped can have changed: its own, and the one
        // before it where it sits on the shared row or column. A cache too far behind looks at all.
        if (W.wetFlips - c.flips > AS.FLIP_LOG) c.check.fill(1);
        else {
          const log = W.flipLog, mask = AS.FLIP_LOG - 1, check = c.check;
          for (let f = c.flips; f < W.wetFlips; f++) {
            const t = log[f & mask], x = t % W.w, y = (t / W.w) | 0;
            const qx = (x / CONTOUR_CHUNK) | 0, qy = (y / CONTOUR_CHUNK) | 0;
            const bx = x % CONTOUR_CHUNK === 0 && qx > 0, by = y % CONTOUR_CHUNK === 0 && qy > 0;
            const i = qy * c.cw + qx;
            if (qx < c.cw && qy < c.ch) check[i] = 1;
            if (bx) check[i - 1] = 1;
            if (by) check[i - c.cw] = 1;
            if (bx && by) check[i - c.cw - 1] = 1;
          }
        }
        c.flips = W.wetFlips;
      }
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
    // alphaScale and radiusScale shape a pulse (pulseLocate); a toggled ring is drawn at 1 and 1.
    function drawLocate(sim, cam, dpr, key, alphaScale, radiusScale) {
      const W = sim.W, s = cam.scale * dpr;
      const r = Math.max(LOCATE_MIN_CSS_PX * dpr, s * 1.6) / 2 * radiusScale;
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
      } else if (key === 'fires') {
        for (let ty = y0; ty <= y1; ty++) {
          const row = ty * W.w;
          for (let tx = x0; tx <= x1; tx++) if (W.flow[row + tx] === FLOW.FIRE) ring(tx, ty);
        }
        // Burning animals are fires too, ringed where they are drawn.
        for (let a = 0, hi = W.aHigh; a < hi; a++) {
          if (!W.aAlive[a] || !(W.aAlight[a] > 0)) continue;
          animalPos(W, a, curAlpha, pos);
          if (pos[0] >= x0 && pos[0] <= x1 && pos[1] >= y0 && pos[1] <= y1) ring(pos[0], pos[1]);
        }
      } else {
        const kind = key === 'blades' ? KIND.GRASS : KIND.CORPSE;
        for (let ty = y0; ty <= y1; ty++) {
          const row = ty * W.w;
          for (let tx = x0; tx <= x1; tx++) if (W.kind[row + tx] === kind) ring(tx, ty);
        }
      }
      const a = LOCATE_ALPHA * alphaScale, color = LOCATE_COLORS[key];
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

    // A quick look from the graph (pulseLocate): rings on every member of a kind that ease in over
    // LOCATE_PULSE_IN_MS and are gone by LOCATE_PULSE_MS, on the real clock, whatever the sim speed.
    // They overlap freely (up to LOCATE_PULSES_MAX at once) and are drawn apart from the toggled rings.
    let pulses = [];
    function drawPulses(sim, cam, dpr, nowMs) {
      pulses = pulses.filter(p => nowMs - p.t0 < LOCATE_PULSE_MS);
      for (const p of pulses) {
        const age = nowMs - p.t0;
        // In: alpha 0 to 1 while the ring shrinks onto its mark; out: alpha 1 to 0.
        const k = age < LOCATE_PULSE_IN_MS ? smooth01(age / LOCATE_PULSE_IN_MS) : 1 - smooth01((age - LOCATE_PULSE_IN_MS) / (LOCATE_PULSE_MS - LOCATE_PULSE_IN_MS));
        if (k > 0.01) drawLocate(sim, cam, dpr, p.kind, k, 1 + LOCATE_PULSE_GROW * (age < LOCATE_PULSE_IN_MS ? 1 - smooth01(age / LOCATE_PULSE_IN_MS) : 0));
      }
    }

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


    // ---- lenses ----------------------------------------------------------------------------------
    // One canvas, a pixel per tile of the view, holds the dimming and every tint: the dim is its
    // fill, each lit tile is wiped back toward clear by its item's alpha, and tints go over. It is
    // drawn scaled up in one call, in both views. Rings are drawn on the main canvas afterwards.
    // Members come from lists the throttled scan keeps (see LENS_SCAN_MS); each frame touches only
    // the members, plus the one fill and upload of the view's pixels.
    const lens = {
      ready: false, id: null, has: null, hidden: null, dim: 0, ms: -1, W: null, rect: null, scanMs: -Infinity,
      countsMs: -Infinity, countsSim: null, a: null, scanned: null, need: null, liveIdx: null, lists: null,
      canvas: null, lctx: null, img: null, u32: null, w: 0, h: 0, order: [],
    };
    function lensInit() {
      if (lens.ready || !AS.LENSES) return lens.ready;
      const n = AS.LENS_ITEM_IDS.length;
      lens.a = new Float32Array(n); lens.scanned = new Uint8Array(n); lens.need = new Uint8Array(n); lens.liveIdx = new Int32Array(n);
      lens.lists = AS.LENS_ITEM_IDS.map(() => AS.lensNewList());
      lens.ready = true;
      return true;
    }
    const lensApproach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
    const lensRgbaDim = alpha => (Math.round(alpha * 255) << 24 | LENS_DIM_RGB[2] << 16 | LENS_DIM_RGB[1] << 8 | LENS_DIM_RGB[0]) >>> 0;

    // The tiles whose centers lie inside the live showers, within rect R: fn(tile) for each.
    function eachShowerTile(sim, R, fn) {
      const sh = sim.weather && sim.weather.showers;
      if (!sh) return;
      const w = sim.W.w;
      for (let i = 0; i < sh.n; i++) {
        const x = sh.x[i], y = sh.y[i], r = sh.r[i], r2 = r * r;
        const ty0 = Math.max(R.y0, Math.floor(y - r)), ty1 = Math.min(R.y1, Math.ceil(y + r));
        const tx0 = Math.max(R.x0, Math.floor(x - r)), tx1 = Math.min(R.x1, Math.ceil(x + r));
        for (let ty = ty0; ty <= ty1; ty++) {
          const dy = ty + 0.5 - y;
          for (let tx = tx0; tx <= tx1; tx++) { const dx = tx + 0.5 - x; if (dx * dx + dy * dy <= r2) fn(ty * w + tx); }
        }
      }
    }

    function drawLens(sim, cam, dpr, nowMs) {
      const L = lens, IDS = AS.LENS_ITEM_IDS, ITEMS = AS.LENS_ITEMS, W = sim.W, N = IDS.length;
      const step = L.ms < 0 ? 0 : Math.min(LENS_DT_MAX_MS, Math.max(0, nowMs - L.ms)) / LENS_FADE_MS;
      L.ms = nowMs;
      L.dim = lensApproach(L.dim, L.id ? 1 : 0, step);
      let live = 0;
      for (let i = 0; i < N; i++) {
        const target = L.has && L.has[i] && !(L.hidden && L.hidden.has(IDS[i])) ? 1 : 0;
        let a = lensApproach(L.a[i], target, step);
        if (a <= LENS_MIN_ALPHA && target === 0) a = 0;
        L.a[i] = a;
        if (a > 0) L.liveIdx[live++] = i; else L.scanned[i] = 0;
      }
      // Nothing to show yet or any more. A lens just chosen starts from here next frame, so its clock keeps running.
      if (L.dim <= LENS_MIN_ALPHA && live === 0) { L.dim = 0; if (L.id === null) L.ms = -1; return; }
      const v = cam.visible(), R = { x0: Math.max(0, v.x0), y0: Math.max(0, v.y0), x1: Math.min(W.w - 1, v.x1), y1: Math.min(W.h - 1, v.y1) };
      if (R.x1 < R.x0 || R.y1 < R.y0) return;
      const s = cam.scale * dpr, far = cam.scale < CELL_PX;
      // Members: rescan when the view leaves the scanned rect, an item newly shows, or the scan is old.
      let sc = L.rect, rescan = L.W !== W || !sc || R.x0 < sc.x0 || R.y0 < sc.y0 || R.x1 > sc.x1 || R.y1 > sc.y1 || nowMs - L.scanMs >= LENS_SCAN_MS || nowMs < L.scanMs;
      for (let k = 0; k < live && !rescan; k++) if (!L.scanned[L.liveIdx[k]]) rescan = true;
      if (rescan) {
        const mx = Math.max(LENS_SCAN_MARGIN_MIN, Math.round((R.x1 - R.x0 + 1) * LENS_SCAN_MARGIN)), my = Math.max(LENS_SCAN_MARGIN_MIN, Math.round((R.y1 - R.y0 + 1) * LENS_SCAN_MARGIN));
        sc = L.rect = { x0: Math.max(0, R.x0 - mx), y0: Math.max(0, R.y0 - my), x1: Math.min(W.w - 1, R.x1 + mx), y1: Math.min(W.h - 1, R.y1 + my) };
        L.need.fill(0);
        for (let k = 0; k < live; k++) { L.need[L.liveIdx[k]] = 1; L.scanned[L.liveIdx[k]] = 1; }
        AS.lensScanTiles(sim, soil ? soil.cur : null, sc, L.need, L.lists);
        AS.lensScanAnimals(sim, L.need, L.lists);
        L.W = W; L.scanMs = nowMs;
      }
      // Whole-map counts decide tint or ring (and the Info legend asks for the same ones).
      if (live > 0 && (L.countsSim !== sim || nowMs - L.countsMs >= LENS_COUNT_MS || nowMs < L.countsMs)) {
        L.countsSim = sim;
        AS.lensCounts(sim, api);
      }
      // The view's pixels: the dim, then each item's members wipe it and tint.
      const lw = R.x1 - R.x0 + 1, lh = R.y1 - R.y0 + 1;
      if (!L.canvas) { L.canvas = document.createElement('canvas'); L.lctx = L.canvas.getContext('2d'); }
      if (L.w !== lw || L.h !== lh) {
        L.canvas.width = L.w = lw; L.canvas.height = L.h = lh;
        L.img = L.lctx.createImageData(lw, lh); L.u32 = new Uint32Array(L.img.data.buffer);
      }
      const d = L.img.data, u32 = L.u32, w = W.w;
      u32.fill(lensRgbaDim(LENS_DIM_ALPHA * L.dim));
      const wipe = (t, a) => {
        const x = t % w - R.x0, y = ((t / w) | 0) - R.y0;
        if (x < 0 || y < 0 || x >= lw || y >= lh) return;
        const p = (y * lw + x) * 4 + 3;
        d[p] = d[p] * (1 - a);
      };
      const tint = (t, rgb, ca) => {
        const x = t % w - R.x0, y = ((t / w) | 0) - R.y0;
        if (x < 0 || y < 0 || x >= lw || y >= lh) return;
        const p = (y * lw + x) * 4, pa = d[p + 3] / 255, oa = ca + pa * (1 - ca);
        if (oa <= 0) return;
        const k = pa * (1 - ca);
        d[p] = (rgb[0] * ca + d[p] * k) / oa; d[p + 1] = (rgb[1] * ca + d[p + 1] * k) / oa; d[p + 2] = (rgb[2] * ca + d[p + 2] * k) / oa;
        d[p + 3] = oa * 255;
      };
      const ringItems = [], tintItems = [];
      let showersIdx = -1;
      for (let k = 0; k < live; k++) {
        const i = L.liveIdx[k], it = ITEMS[IDS[i]], list = L.lists[i];
        if (it.kind === 'showers') { showersIdx = i; tintItems.push(i); continue; }
        const asRing = it.kind === 'animals' ? !(far && list.n / 2 > LENS_FAR_RINGS_MAX) : it.draw === 'ring';
        (asRing ? ringItems : tintItems).push(i);
        const a = L.a[i];
        if (it.kind === 'tiles') for (let j = 0; j < list.n; j++) wipe(list.a[j], a);
        else for (let j = 0; j < list.n; j += 2) {
          const sl = list.a[j];
          if (!W.aAlive[sl] || W.aSerial[sl] !== list.a[j + 1]) continue;
          wipe(W.aTile[sl], a);
          if (W.aFrom[sl] !== W.aTile[sl]) wipe(W.aFrom[sl], a);
        }
      }
      if (showersIdx >= 0) eachShowerTile(sim, R, t => wipe(t, L.a[showersIdx]));
      // The biggest tints first, so a small set's color is on top; the showers are few (a handful of circles), so last.
      tintItems.sort((p, q) => (p === showersIdx ? 1 : 0) - (q === showersIdx ? 1 : 0) || L.lists[q].n - L.lists[p].n);
      for (const i of tintItems) {
        const it = ITEMS[IDS[i]], list = L.lists[i], a = L.a[i];
        if (it.kind === 'showers') eachShowerTile(sim, R, t => tint(t, it.rgb, LENS_TINT_ALPHA * a));
        else if (it.kind === 'tiles') for (let j = 0; j < list.n; j++) tint(list.a[j], it.rgb, LENS_TINT_ALPHA * a);
        else for (let j = 0; j < list.n; j += 2) {
          const sl = list.a[j];
          if (W.aAlive[sl] && W.aSerial[sl] === list.a[j + 1]) tint(W.aTile[sl], it.rgb, LENS_MARK_ALPHA * a);
        }
      }
      L.lctx.putImageData(L.img, 0, 0);
      const smooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      const dx = Math.round((R.x0 - cam.x) * s), dy = Math.round((R.y0 - cam.y) * s);
      ctx.drawImage(L.canvas, 0, 0, lw, lh, dx, dy, Math.round((R.x1 + 1 - cam.x) * s) - dx, Math.round((R.y1 + 1 - cam.y) * s) - dy);
      ctx.imageSmoothingEnabled = smooth;
      // Showers: the outline of each, dashed with a bolt on a storm.
      if (showersIdx >= 0) {
        const sh = sim.weather.showers, a = L.a[showersIdx], bolt = Math.max(s, LENS_BOLT_MIN_CSS_PX * dpr) * 1.2;
        for (let i = 0; i < sh.n; i++) {
          const x = sh.x[i], y = sh.y[i], r = sh.r[i];
          if (x + r < R.x0 || x - r > R.x1 + 1 || y + r < R.y0 || y - r > R.y1 + 1) continue;
          const cx = (x - cam.x) * s, cy = (y - cam.y) * s, storm = sh.storm[i] === 1;
          ctx.beginPath();
          ctx.arc(cx, cy, r * s, 0, Math.PI * 2);
          ctx.lineWidth = LENS_SHOWER_CSS_PX * dpr;
          ctx.strokeStyle = `rgba(255,255,255,${(storm ? LENS_STORM_ALPHA : LENS_SHOWER_ALPHA) * a})`;
          if (storm) ctx.setLineDash(LENS_STORM_DASH_CSS_PX.map(q => q * dpr));
          ctx.stroke();
          if (storm) {
            ctx.setLineDash([]);
            ctx.beginPath();
            LENS_BOLT.forEach(([bx, by], q) => (q ? ctx.lineTo(cx + bx * bolt, cy + by * bolt) : ctx.moveTo(cx + bx * bolt, cy + by * bolt)));
            ctx.closePath();
            ctx.lineWidth = 3 * dpr;
            ctx.strokeStyle = `rgba(${LENS_HALO_RGB},${0.7 * a})`;
            ctx.stroke();
            ctx.fillStyle = `rgba(255,255,255,${a})`;
            ctx.fill();
          }
        }
      }
      // Rings: a dark halo under the item's color, one path per item.
      const rr = Math.max(LENS_RING_R * s, LENS_RING_MIN_CSS_PX * dpr);
      for (const i of ringItems) {
        const it = ITEMS[IDS[i]], list = L.lists[i], a = L.a[i];
        ctx.beginPath();
        const ring = (tx, ty) => { const cx = (tx + 0.5 - cam.x) * s, cy = (ty + 0.5 - cam.y) * s; ctx.moveTo(cx + rr, cy); ctx.arc(cx, cy, rr, 0, Math.PI * 2); };
        if (it.kind === 'tiles') for (let j = 0; j < list.n; j++) { const t = list.a[j]; ring(t % w, (t / w) | 0); }
        else for (let j = 0; j < list.n; j += 2) {
          const sl = list.a[j];
          if (!W.aAlive[sl] || W.aSerial[sl] !== list.a[j + 1]) continue;
          animalPos(W, sl, curAlpha, pos);
          if (pos[0] < R.x0 - 1 || pos[0] > R.x1 + 1 || pos[1] < R.y0 - 1 || pos[1] > R.y1 + 1) continue;
          ring(pos[0], pos[1]);
        }
        ctx.lineWidth = LENS_RING_HALO_CSS_PX * dpr;
        ctx.strokeStyle = `rgba(${LENS_HALO_RGB},${LENS_HALO_ALPHA * a})`;
        ctx.stroke();
        ctx.lineWidth = LENS_RING_CSS_PX * dpr;
        ctx.strokeStyle = `rgba(${it.rgb[0]},${it.rgb[1]},${it.rgb[2]},${LENS_RING_ALPHA * a})`;
        ctx.stroke();
      }
    }

    const api = {
      setIntentLines(on) { intentLines = !!on; },
      setContours(on) { contoursOn = !!on; },
      // Meters between topo lines (each spacing is worked out once per world, then kept).
      setContourStep(m) { if (m > 0) contourStep = m; },
      get contourStep() { return contourStep; },
      // The far view's one-pixel-per-tile picture of the world, brought up to date (the minimap draws it).
      // nowMs: the clock the water's fades run on (defaults to the last frame's).
      farCanvas(sim, nowMs) { fillCells(sim, nowMs); return cell.canvas; },
      // The water drawn on tile t now (0..1) and its fullest band (-1 none), after a draw or farCanvas.
      waterLevel(t) { return water ? waterShown(t) : 0; },
      waterBand(t) { return water ? bandShown(t) : -1; },
      // Tiles whose water is moving between looks.
      get waterFading() { return water ? water.count : 0; },
      // The soil level drawn on tile t (-3 driest .. 3 wettest, 0 none), after a draw or farCanvas; and the tiles moving between levels.
      soilLevel(t) { return soil ? soil.cur[t] : 0; },
      get soilFading() { return soil ? soil.count : 0; },
      // How much of tile t's streaks shows now (0..1), after a draw.
      streakLevel(t) {
        if (!rain) return 0;
        const W = rain.W, c = (((t / W.w) | 0) / RAIN_CELL | 0) * rain.cw + ((t % W.w) / RAIN_CELL | 0);
        return rain.a[c];
      },
      // The bolt on screen: null, or { age (real ms) }; and how many strike scorch marks are kept.
      get bolt() { return bolt ? { age: lastDrawMs - bolt.t0 } : null; },
      get scars() { return scars.length; },
      get contours() { return contoursOn; },
      get intentLines() { return intentLines; },
      // sel: null or { tile, serial, slot }; alpha: 0–1 through the current tick; nowMs: real
      // time (performance.now()), which the event holds run on; speed: the sim speed asked
      // for (0 paused, Infinity max), to tell when steps are too short to animate.
      draw(sim, cam, sheet, sel, alpha, nowMs, speed) {
        const dpr = sizeCanvas();
        nowMs = nowMs || 0;
        lastDrawMs = nowMs;
        updateWater(sim, nowMs);
        updateSoil(sim, nowMs);
        stepSpeed = speed === undefined ? 1 : speed;
        if (statesFor !== sim.T) buildStates(sim.T);
        frameNo++;
        consumeEvents(sim, cam, nowMs);
        curAlpha = alpha;
        clock = (sim.tickCount + alpha) * AS.DT;
        facing.update(sim.W);
        const s = cam.scale * dpr, W0 = sim.W;
        const wx = Math.round(-cam.x * s), wy = Math.round(-cam.y * s), ww = Math.round((W0.w - cam.x) * s) - wx, wh = Math.round((W0.h - cam.y) * s) - wy;
        ctx.fillStyle = OUTSIDE;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = AS.COLORS.background;
        ctx.fillRect(wx, wy, ww, wh);
        if (cam.scale >= CELL_PX) {
          gusts.update(sim, nowMs, stepSpeed, alpha);
          drawSprites(sim, cam, sheet, sel, dpr, nowMs);
          updateRain(sim, cam, nowMs);
          drawRain(sim, cam, dpr, nowMs);
          consumeStrikes(sim, cam, nowMs);
          drawScars(sim, cam, dpr, nowMs);
          drawBolt(cam, dpr, nowMs);
        } else {
          consumeStrikes(sim, cam, nowMs);
          fillCells(sim, nowMs);
          const W = sim.W;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(cell.canvas, 0, 0, W.w, W.h, -cam.x * s, -cam.y * s, W.w * s, W.h * s);
          ctx.imageSmoothingEnabled = true;
          if (contoursOn) drawContours(sim, cam, dpr, false);
          drawBoltFar(cam, dpr, nowMs);
        }
        ctx.strokeStyle = EDGE_LINE;
        ctx.lineWidth = dpr;
        ctx.strokeRect(wx - dpr / 2, wy - dpr / 2, ww + dpr, wh + dpr);
        if (blasts.length) drawBlasts(cam, dpr, nowMs);
        if (lens.id !== null || lens.dim > 0) drawLens(sim, cam, dpr, nowMs); else lens.ms = -1;
        if (located) for (const key of located) if (LOCATE_COLORS[key]) drawLocate(sim, cam, dpr, key, 1, 1);
        if (pulses.length) drawPulses(sim, cam, dpr, nowMs);
        if (sel) drawSelection(sim, cam, sel, dpr);
        if (preview) drawRadiusPreview(cam, dpr, nowMs);
      },
      // Show the size a radius covers (tiles; a nuke's in its own color), fading from nowMs.
      radiusPreview(r, nuke, nowMs) { preview = { r, nuke: !!nuke, t0: nowMs }; },
      // The kinds to ring ('bunnies', 'wolves', 'humans', 'blades', 'corpses', 'fires'): a Set, read
      // every frame; top is how many CSS px of the canvas's top the HUD covers, so pips stay below it.
      locate(kinds, top) { located = kinds && kinds.size ? kinds : null; locTop = top || 0; },
      get located() { return located ? [...located] : []; },
      // A quick look at a kind (the graph's legend): rings on all of its members that ease in and
      // fade out over LOCATE_PULSE_MS, however the toggled rings are set. nowMs: real time.
      pulseLocate(kind, nowMs) {
        if (!LOCATE_COLORS[kind]) return;
        if (pulses.length >= LOCATE_PULSES_MAX) pulses.shift();
        pulses.push({ kind, t0: nowMs === undefined ? performance.now() : nowMs });
      },
      get pulses() { return pulses.length; },
      // A nuke went off at tile (tx, ty), radius in tiles; the effect starts now (real time).
      blast(tx, ty, radius, nowMs) {
        if (blasts.length >= MAX_BLASTS) blasts.shift();
        blasts.push({ x: tx + 0.5, y: ty + 0.5, r: radius, t0: nowMs === undefined ? performance.now() : nowMs });
      },
      get blasts() { return blasts.length; },
      // The lens to look through (an id from AS.LENSES, or null for none) and which of its items are
      // unticked (a Set of item ids, read every frame). The dim and the tints ease over LENS_FADE_MS,
      // so switching crossfades and an unticked item eases out.
      setLens(id, hidden) {
        if (!lensInit()) return;
        const def = id && AS.LENSES.find(l => l.id === id);
        lens.id = def ? def.id : null;
        lens.has = new Uint8Array(AS.LENS_ITEM_IDS.length);
        if (def) for (const item of def.items) lens.has[AS.LENS_ITEM_INDEX[item]] = 1;
        lens.hidden = hidden || null;
      },
      get lens() { return lens.id; },
      // How much of an item is on screen now (0..1, eased) and of the dimming, after a draw.
      lensLevel(itemId) { return lens.ready ? lens.a[AS.LENS_ITEM_INDEX[itemId]] : 0; },
      get lensDim() { return lens.dim; },
      // lensCounts calls this when it has fresh counts, so the draw doesn't make its own for a while.
      lensCountsFresh() { lens.countsMs = lastDrawMs; },
      // The soil level drawn on every tile (Int8Array, -3 driest .. 3 wettest), or null in a world without rain.
      get soilLevels() { return soil ? soil.cur : null; },
    };
    return api;
  };
})(globalThis.AS);
