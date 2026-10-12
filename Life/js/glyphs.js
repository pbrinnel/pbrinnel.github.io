// What each drawable thing is called and what color it is, and an animal's life stage. The
// ids began as the font glyphs the map was first drawn with; the sprites (sprites.js) and the
// far view (render.js) now draw everything, keyed by these ids and colors.
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

  const STAGE = AS.STAGE = Object.freeze({ BABY: 0, ADULT: 1, ELDER: 2 });

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
  AS.GLYPH_COUNT = ANIMAL_BASE + N_SPECIES * 6;
  AS.GLYPH_NAMES = Object.freeze(names);

  AS.animalGlyph = (species, sex, stage) => ANIMAL_BASE + (species * 2 + sex) * 3 + stage;

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

  // The grass third (0, 1 or 2) of a Size in [0, 1]: [0,1/3), [1/3,2/3), [2/3,1].
  const THIRD = 1 / 3;
  AS.grassGlyph = size => (size < THIRD ? G.GRASS_0 : size < 2 * THIRD ? G.GRASS_1 : G.GRASS_2);

  // Baby until it reaches TimeToMature, elder from ElderAt (a share) of its Lifespan.
  AS.stageOf = function (Tsp, age) {
    if (age < Tsp.TimeToMature) return STAGE.BABY;
    return age >= Tsp.ElderAt * Tsp.Lifespan ? STAGE.ELDER : STAGE.ADULT;
  };
})(globalThis.AS);
