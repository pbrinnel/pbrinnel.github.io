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
  // -SOIL_DRY_BELOW.length (driest) .. SOIL_WET_AT.length (wettest). Wet soil darkens and cools
  // the tile (a WET_RGB veil, WET_ALPHA by level, stronger than the mockup's); dry soil fades
  // the grass toward straw (sprites.js, DRY_MIX), the ground untouched. Meadow soil sits at a few
  // hundredths of its room and a shower adds about one hundredth, so the steps are spaced by
  // doubling from there rather than evenly: a swath shows on ground that was dry, and ground
  // beside water, always near its room, is always the darkest.
  const SOIL_WET_AT = [0.03, 0.08, 0.2];
  const SOIL_DRY_BELOW = [0.008, 0.004, 0.002];
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

  // The far view's tile colors by soil level (index level + SOIL_DRY_BELOW.length, see SOIL_WET_AT):
  // FAR_GRASS_BY[third][index] and FAR_GROUND_BY[index].
  const SOIL_LEVELS_DRY = SOIL_DRY_BELOW.length, SOIL_LEVELS_WET = SOIL_WET_AT.length;
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
  const LOCATE_ALPHA = 0.9;
  const LOCATE_CSS_PX = 2;
  const LOCATE_MIN_CSS_PX = 14;
  const LOCATE_PIP_CSS_PX = 5;
  const LOCATE_PIPS_MAX = 200;
  // The graph's colors (graph.js), so a ring matches the kind's line; ui.js marks a toggled
  // count with the same color. Fires have no line: they take the flames' yellow from the fire
  // palette, since the orange the bunnies' line uses is taken.
  const rgbOf = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');
  const LOCATE_COLORS = AS.LOCATE_COLORS = Object.freeze({ blades: '25,158,112', bunnies: '217,89,38', wolves: '57,135,229', humans: '199,99,179', corpses: '200,200,190', fires: rgbOf(AS.FIRE_PALETTE.y) });

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

  // Rain streaks (Paul's mockup A look): short thin slanted dashes, a few to a STREAK_CELL-tile
  // square, under every shower in view. A shower crosses the screen in a fraction of a second,
  // so a cell keeps its streaks STREAK_HOLD_MS of real time after the shower leaves it, easing
  // in over STREAK_IN_MS and out over STREAK_OUT_MS; a cell's streaks cannot come and go faster
  // than the sum of the three. Up to STREAK_MOVE_MAX_SPEED the streaks fall (STREAK_FALL_PX
  // sprite pixels a second, a sprite pixel being one-eighth of a tile); faster, or paused, they
  // hold still, fainter, so nothing churns. The fall is eased in and out over STREAK_MOTION_MS.
  const STREAK_CELL = 4, STREAK_PER_CELL = 5, STREAK_LEN = 5;
  const STREAK_HOLD_MS = AS.STREAK_HOLD_MS = 1200, STREAK_IN_MS = 300, STREAK_OUT_MS = 1000;
  const STREAK_STALE_MS = STREAK_HOLD_MS + STREAK_IN_MS + STREAK_OUT_MS;   // a cell unseen this long is back at nothing
  const STREAK_MOVE_MAX_SPEED = 5, STREAK_MOTION_MS = 1000, STREAK_FALL_PX = 56;
  const STREAK_ALPHA = 0.5, STREAK_STILL_ALPHA = 0.26, STREAK_ALPHA_STEPS = 4;
  const STREAK_RGB = AS.STREAK_RGB = '170,196,226';
  const STREAK_SLOPE = 0.7;           // sideways sprite pixels per pixel fallen, in a wind of AS.GUSTS.FULL_KMH
  const STREAK_STAIR_AT = 2;          // device px per sprite pixel from which a streak is drawn pixel by pixel, else as one dash
  const SALT_STREAK_X = 41, SALT_STREAK_Y = 42;

  // Lightning (Paul's L1): a thin jagged muted pale line from above the screen to the struck
  // tile, easing in, holding, easing out, never above BOLT_PEAK and with no glow; nothing
  // else on screen brightens. At most one bolt starts per BOLT_GAP_MS of real time (a strike
  // in between is skipped; its fire shows anyway).
  const BOLT_GAP_MS = AS.BOLT_GAP_MS = 5000, BOLT_IN_MS = 300, BOLT_HOLD_MS = 600, BOLT_OUT_MS = 1000;
  const BOLT_PEAK = AS.BOLT_PEAK = 0.6, BOLT_RGB = AS.BOLT_RGB = '176,186,200';
  const BOLT_ABOVE_TILES = 3;         // it starts this far above the top of the view when it strikes
  const BOLT_LEAN_TILES = 3;          // ... and as far sideways at most
  const BOLT_STEP_TILES = 0.42, BOLT_JAG_TILES = 0.22;
  const SALT_BOLT = 51;

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
    // (and so soil water) have any of it.
    let soil = null;
    function levelOf(f, prev) {
      // Wet from the top level down, dry likewise: a level holds while the share stays within
      // SOIL_HYSTERESIS of its threshold, and is taken only once past it.
      let l = 0;
      for (let i = SOIL_WET_AT.length - 1; i >= 0; i--) {
        if (f >= SOIL_WET_AT[i] * (prev > i ? 1 - SOIL_HYSTERESIS : 1 + SOIL_HYSTERESIS)) { l = i + 1; break; }
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
        soil = { W, n, tgt: new Int8Array(n), cur: new Int8Array(n), nxt: new Int8Array(n), prog: new Float32Array(n), act: new Uint8Array(n), list: new Int32Array(n), count: 0, pos: 0, ms: nowMs };
        for (let t = 0; t < n; t++) soil.tgt[t] = soil.cur[t] = soil.nxt[t] = levelOf(G[t] / room, 0);
        return;
      }
      const dt = nowMs - soil.ms;
      if (!(dt > 0)) return;
      soil.ms = nowMs;
      const tgt = soil.tgt, cur = soil.cur, nxt = soil.nxt, prog = soil.prog, act = soil.act, list = soil.list;
      // Sweep a slice of the world, so the whole of it is looked at once per SOIL_SWEEP_MS.
      let count = Math.min(n, Math.ceil(n * Math.min(dt, SOIL_SWEEP_MS) / SOIL_SWEEP_MS));
      let t = soil.pos;
      while (count-- > 0) {
        const l = levelOf(G[t] / room, tgt[t]);
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
        if (W.kind[t] === KIND.GRASS) id = AS.spriteCharGrass(AS.grassGlyph(W.gSize[t]) - AS.GLYPH.GRASS_0, look.char);
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

    // ---- rain streaks and lightning, over everything (sprite mode only) ----------------
    // Streaks: per STREAK_CELL-tile cell, `a` is how much of its streaks show (0..1), eased
    // toward 1 while `until` (real ms) is ahead of the clock and toward 0 after; `seen` is the
    // last frame the cell was looked at, so one off screen for STREAK_STALE_MS starts again
    // from nothing instead of popping in as the view comes back to it.
    let rain = null;
    const streakRects = Array.from({ length: STREAK_ALPHA_STEPS }, () => []);
    function updateRain(sim, cam, dpr, nowMs) {
      const sh = sim.weather && sim.weather.showers;
      if (!sh) { rain = null; return; }
      const W = sim.W, cw = Math.ceil(W.w / STREAK_CELL), ch = Math.ceil(W.h / STREAK_CELL);
      if (!rain || rain.W !== W) rain = { W, cw, ch, a: new Float32Array(cw * ch), until: new Float64Array(cw * ch), seen: new Float64Array(cw * ch), ms: nowMs, motion: 0, phase: 0 };
      const dt = Math.max(0, Math.min(nowMs - rain.ms, STREAK_STALE_MS));
      rain.ms = nowMs;
      const v = cam.visible();
      const cx0 = Math.max(0, Math.floor(v.x0 / STREAK_CELL)), cx1 = Math.min(cw - 1, Math.floor(v.x1 / STREAK_CELL));
      const cy0 = Math.max(0, Math.floor(v.y0 / STREAK_CELL)), cy1 = Math.min(ch - 1, Math.floor(v.y1 / STREAK_CELL));
      if (cx1 < cx0 || cy1 < cy0) return;
      // Cells under a shower in view are held for STREAK_HOLD_MS from now.
      for (let i = 0; i < sh.n; i++) {
        const x = sh.x[i], y = sh.y[i], r = sh.r[i];
        if (x + r < v.x0 || x - r > v.x1 + 1 || y + r < v.y0 || y - r > v.y1 + 1) continue;
        const r2 = r * r;
        const ax0 = Math.max(cx0, Math.floor((x - r) / STREAK_CELL)), ax1 = Math.min(cx1, Math.floor((x + r) / STREAK_CELL));
        const ay0 = Math.max(cy0, Math.floor((y - r) / STREAK_CELL)), ay1 = Math.min(cy1, Math.floor((y + r) / STREAK_CELL));
        for (let cy = ay0; cy <= ay1; cy++) {
          const dy = (cy + 0.5) * STREAK_CELL - y;
          for (let cx = ax0; cx <= ax1; cx++) {
            const dx = (cx + 0.5) * STREAK_CELL - x;
            if (dx * dx + dy * dy <= r2) rain.until[cy * cw + cx] = nowMs + STREAK_HOLD_MS;
          }
        }
      }
      // They fall while the sim runs at a pace the eye can follow, and stand still otherwise.
      const moving = stepSpeed > 0 && stepSpeed <= STREAK_MOVE_MAX_SPEED;
      const m = rain.motion, dm = dt / STREAK_MOTION_MS;
      rain.motion = moving ? Math.min(1, m + dm) : Math.max(0, m - dm);
      rain.phase += STREAK_FALL_PX * rain.motion * dt / 1000;
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        const c = cy * cw + cx;
        let a = nowMs - rain.seen[c] > STREAK_STALE_MS ? 0 : rain.a[c];
        rain.seen[c] = nowMs;
        if (rain.until[c] > nowMs) a = Math.min(1, a + dt / STREAK_IN_MS);
        else a = Math.max(0, a - dt / STREAK_OUT_MS);
        rain.a[c] = a;
      }
    }
    function drawRain(sim, cam, dpr) {
      if (!rain) return;
      const v = cam.visible(), s = cam.scale * dpr, ox = cam.x * s, oy = cam.y * s, u = s / AS.SPRITE_SIZE;
      const cw = rain.cw;
      const cx0 = Math.max(0, Math.floor(v.x0 / STREAK_CELL)), cx1 = Math.min(cw - 1, Math.floor(v.x1 / STREAK_CELL));
      const cy0 = Math.max(0, Math.floor(v.y0 / STREAK_CELL)), cy1 = Math.min(rain.ch - 1, Math.floor(v.y1 / STREAK_CELL));
      const wind = sim.wind;
      const slope = wind ? wind.toX * Math.min(1, wind.kmh / AS.GUSTS.FULL_KMH) * STREAK_SLOPE : 0;
      const stair = u >= STREAK_STAIR_AT, cellPx = STREAK_CELL * s, span = cellPx + STREAK_LEN * u;
      const peak = STREAK_STILL_ALPHA + (STREAK_ALPHA - STREAK_STILL_ALPHA) * rain.motion;
      const dash = Math.max(1, Math.round(u)), phase = rain.phase * u;
      for (const r of streakRects) r.length = 0;
      let any = false;
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        const a = rain.a[cy * cw + cx];
        if (a <= 0.01) continue;
        const list = streakRects[Math.min(STREAK_ALPHA_STEPS, Math.ceil(a * STREAK_ALPHA_STEPS)) - 1];
        const bx = cx * cellPx - ox, by = cy * cellPx - oy;
        for (let k = 0; k < STREAK_PER_CELL; k++) {
          const hx = AS.spriteHash(cx, cy, SALT_STREAK_X + k * 2) * cellPx;
          // The head's place down the cell; the dash trails above it, slanted back against the way it falls.
          const head = (AS.spriteHash(cx, cy, SALT_STREAK_Y + k * 2) * span + phase) % span;
          if (stair) {
            for (let j = 0; j < STREAK_LEN; j++) {
              const yy = head - j * u;
              if (yy < 0 || yy > cellPx) continue;
              list.push(Math.round(bx + hx + slope * yy), Math.round(by + yy), dash, dash);
            }
          } else {
            list.push(Math.round(bx + hx + slope * head), Math.round(by + head - STREAK_LEN * u), dash, Math.max(dash, Math.round(STREAK_LEN * u)));
          }
        }
        any = true;
      }
      if (!any) return;
      ctx.fillStyle = `rgb(${STREAK_RGB})`;
      for (let q = 0; q < STREAK_ALPHA_STEPS; q++) {
        const list = streakRects[q];
        if (!list.length) continue;
        ctx.globalAlpha = peak * (q + 1) / STREAK_ALPHA_STEPS;
        ctx.beginPath();
        for (let i = 0; i < list.length; i += 4) ctx.rect(list[i], list[i + 1], list[i + 2], list[i + 3]);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Lightning: strikes the sim has logged (sim.weather.strikes) since the last frame; the
    // newest of them on screen starts a bolt if the last began BOLT_GAP_MS ago. The bolt's
    // path is worked out once, in tile coordinates, so it stays put as the view moves.
    let boltSim = null, boltSeen = 0, boltLastMs = -Infinity, bolt = null;
    // Zoomed out (`show` false) the strikes are read and let go, so zooming in doesn't replay them.
    function consumeStrikes(sim, cam, nowMs, show) {
      const st = sim.weather && sim.weather.strikes;
      if (!st) { boltSim = null; bolt = null; return; }
      if (boltSim !== sim || st.n < boltSeen) { boltSim = sim; boltSeen = st.n; bolt = null; boltLastMs = -Infinity; return; }
      if (!show) { boltSeen = st.n; return; }
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
      bolt = { pts, t0: nowMs };
      boltLastMs = nowMs;
    }
    function drawBolt(cam, dpr, nowMs) {
      if (!bolt) return;
      const age = nowMs - bolt.t0, total = BOLT_IN_MS + BOLT_HOLD_MS + BOLT_OUT_MS;
      if (age >= total) { bolt = null; return; }
      const e = x => x * x * (3 - 2 * x);   // eased 0..1
      const f = age < BOLT_IN_MS ? e(age / BOLT_IN_MS) : age < BOLT_IN_MS + BOLT_HOLD_MS ? 1 : 1 - e((age - BOLT_IN_MS - BOLT_HOLD_MS) / BOLT_OUT_MS);
      if (f <= 0.01) return;
      const s = cam.scale * dpr, p = bolt.pts;
      ctx.beginPath();
      for (let i = 0; i < p.length; i += 2) {
        const x = (p[i] - cam.x) * s, y = (p[i + 1] - cam.y) * s;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
      ctx.lineWidth = Math.max(dpr, s / AS.SPRITE_SIZE);
      ctx.strokeStyle = `rgba(${BOLT_RGB},${BOLT_PEAK * f})`;
      ctx.stroke();
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
        const W = rain.W, c = (((t / W.w) | 0) / STREAK_CELL | 0) * rain.cw + ((t % W.w) / STREAK_CELL | 0);
        return rain.a[c];
      },
      // The bolt on screen: null, or { age (real ms) }.
      get bolt() { return bolt ? { age: lastDrawMs - bolt.t0 } : null; },
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
          updateRain(sim, cam, dpr, nowMs);
          drawRain(sim, cam, dpr);
          consumeStrikes(sim, cam, nowMs, true);
          drawBolt(cam, dpr, nowMs);
        } else {
          consumeStrikes(sim, cam, nowMs, false);
          bolt = null;
          fillCells(sim, nowMs);
          const W = sim.W;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(cell.canvas, 0, 0, W.w, W.h, -cam.x * s, -cam.y * s, W.w * s, W.h * s);
          ctx.imageSmoothingEnabled = true;
          if (contoursOn) drawContours(sim, cam, dpr, false);
        }
        ctx.strokeStyle = EDGE_LINE;
        ctx.lineWidth = dpr;
        ctx.strokeRect(wx - dpr / 2, wy - dpr / 2, ww + dpr, wh + dpr);
        if (blasts.length) drawBlasts(cam, dpr, nowMs);
        if (located) for (const key of located) if (LOCATE_COLORS[key]) drawLocate(sim, cam, dpr, key);
        if (sel) drawSelection(sim, cam, sel, dpr);
        if (preview) drawRadiusPreview(cam, dpr, nowMs);
      },
      // Show the size a radius covers (tiles; a nuke's in its own color), fading from nowMs.
      radiusPreview(r, nuke, nowMs) { preview = { r, nuke: !!nuke, t0: nowMs }; },
      // The kinds to ring ('bunnies', 'wolves', 'humans', 'blades', 'corpses', 'fires'): a Set, read
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
