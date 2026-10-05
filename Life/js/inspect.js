// The inspector's text: turns the selected blade, corpse or animal into the rows the panel
// shows. variables.csv decides WHICH variables appear for what (Applies to, Range and the
// tooltip text all come from there); this file only knows how to READ each one from the
// world's stores and format it. A variable in the CSV with no reader here still shows, as
// "—", and inspectWarnings tells Paul so at startup.
//
//   AS.describe(sim, sel) → null, or { title, rows: [{ name, value, range, tip }] }
//   AS.inspectWarnings(T) → string[]
(function (AS) {
  'use strict';

  const KIND = AS.KIND, SEX = AS.SEX;

  const NONE = '—';
  const DAYS_DECIMALS = 2;
  const SIZE_DECIMALS = 2;
  const POINT_DECIMALS = 1;   // Fullness, Stamina, HP, Nutrient

  // What "Applies to" may say. Anything else is a typo and matches nothing.
  const TOKENS = ['all', ...AS.SPECIES_KEY, 'grass', 'corpse', 'female', 'hole'];

  // The kinds of selectable thing. 'bunnyF' is a female bunny, and so on, so the "female"
  // token can be decided once per kind instead of once per row.
  const THING_TOKENS = {
    grass: ['all', 'grass'],
    corpse: ['all', 'corpse'],
    hole: ['hole'],   // a hole has no age, stage or life to show
  };
  // Each species is a thing of its own; one that breeds has a female variant ('wolfF') that
  // also takes the "female" token. A species that never breeds (humans) has none, so a female
  // human never shows Pregnant or MateCooldown.
  for (const key of AS.SPECIES_KEY) {
    THING_TOKENS[key] = ['all', key];
    THING_TOKENS[key + 'F'] = ['all', key, 'female'];
  }

  // ---- formatting ------------------------------------------------------------------

  function commas(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function num(v, decimals) {
    if (!Number.isFinite(v)) return NONE;
    const s = v.toFixed(decimals);
    const dot = s.indexOf('.');
    return dot < 0 ? commas(s) : commas(s.slice(0, dot)) + s.slice(dot);
  }
  const count = v => num(Math.round(v), 0);
  // Serials are names, not quantities, so no thousands separators: "#1,234" would read as two.
  const serial = v => String(v);
  const days = v => num(v, DAYS_DECIMALS);
  // "62.3 / 100": the current value out of its species' maximum.
  const outOf = (v, max) => Number.isFinite(v) && Number.isFinite(max)
    ? num(v, POINT_DECIMALS) + ' / ' + num(max, max % 1 ? POINT_DECIMALS : 0) : NONE;

  const position = (W, t) => W.tx(t) + ', ' + W.ty(t);
  const speciesName = sp => AS.SPECIES_KEY[sp][0].toUpperCase() + AS.SPECIES_KEY[sp].slice(1);
  const stageName = stage => ['Baby', 'Adult', 'Elder'][stage] || NONE;

  // ---- readers: (sim, ctx) → string -------------------------------------------------
  // ctx = { t (tile), s (animal slot or -1), Tsp (the animal's species stats, or null) }.
  // Each is written for every kind its variable can apply to, whatever the CSV says today.

  const isAnimal = c => c.s >= 0;
  const isCorpse = (sim, c) => !isAnimal(c) && sim.W.kind[c.t] === KIND.CORPSE;

  // Where an animal's target is, in words. The target's own identity is checked by serial,
  // because its slot may have been freed and reused since.
  function targetText(sim, c) {
    const W = sim.W, s = c.s, tt = W.aTargetTile[s];
    if (tt < 0) return 'None';
    const where = position(W, tt);
    const ts = W.aTargetSlot[s];
    if (ts >= 0) {
      const who = '#' + serial(W.aTargetSerial[s]);
      if (W.aAlive[ts] && W.aSerial[ts] === W.aTargetSerial[s]) {
        return speciesName(W.aSpecies[ts]) + ' ' + who + ' at ' + position(W, W.aTile[ts]);
      }
      return 'Animal ' + who + ' (gone)';
    }
    const k = W.kind[tt];
    if (k === KIND.GRASS) return 'Blade at ' + where;
    if (k === KIND.CORPSE) return 'Corpse at ' + where;
    return 'Tile ' + where;
  }

  const timeLeft = (v, zero) => !Number.isFinite(v) ? NONE : v > 0 ? days(v) + ' days left' : zero;

  const READERS = {
    Fullness: (sim, c) => outOf(sim.W.aFullness[c.s], c.Tsp.FullnessMax),
    Stamina: (sim, c) => outOf(sim.W.aStamina[c.s], c.Tsp.StaminaMax),
    HP: (sim, c) => outOf(sim.W.aHP[c.s], c.Tsp.HPMax),
    // A corpse's age is the time since it died, which is its own clock (cAge).
    Age: (sim, c) => {
      const W = sim.W;
      return days(isAnimal(c) ? W.aAge[c.s] : isCorpse(sim, c) ? W.cAge[c.t] : W.gAge[c.t]);
    },
    Lifestage: (sim, c) => {
      if (isAnimal(c)) return stageName(AS.stageOf(c.Tsp, sim.W.aAge[c.s]));
      return isCorpse(sim, c) ? NONE : AS.grassStage(sim, c.t);
    },
    // Everything the inspector can select is alive except a corpse.
    Dead: (sim, c) => isCorpse(sim, c) ? 'Yes' : 'No',
    State: (sim, c) => {
      const st = sim.T.states[AS.SPECIES_KEY[sim.W.aSpecies[c.s]]][sim.W.aState[c.s]];
      return st ? st.name : NONE;
    },
    Target: targetText,
    Position: (sim, c) => position(sim.W, c.t),
    Sex: (sim, c) => sim.W.aSex[c.s] === SEX.FEMALE ? 'Female' : 'Male',
    // A due litter with no room yet is still a pregnancy (DESIGN.md: the birth waits).
    Pregnant: (sim, c) => sim.W.aLitter[c.s] > 0 && !(sim.W.aPregnant[c.s] > 0)
      ? 'Due, waiting for room' : timeLeft(sim.W.aPregnant[c.s], 'No'),
    MateCooldown: (sim, c) => timeLeft(sim.W.aMateCd[c.s], 'Ready'),
    Size: (sim, c) => num(sim.W.gSize[c.t], SIZE_DECIMALS),
    Parents: (sim, c) => {
      const a = sim.W.aParentA[c.s], b = sim.W.aParentB[c.s];
      return !a && !b ? 'None (first generation)' : '#' + serial(a) + ' and #' + serial(b);
    },
    Children: (sim, c) => count(sim.W.aChildren[c.s]),
    Kills: (sim, c) => count(sim.W.aKills[c.s]),
    InHole: (sim, c) => sim.W.hole[c.t] ? 'Yes' : 'No',
    // How long since a bunny last stood on it; it collapses at CollapseDays.
    LastUsed: (sim, c) => days(sim.simSeconds / AS.DAY_SECONDS - sim.W.holeUsedAt[c.t] / AS.DAY_SECONDS) + ' days ago',
    Meat: (sim, c) => outOf(sim.W.cMeat[c.t], sim.T[AS.SPECIES_KEY[sim.W.cSpecies[c.t]]].MeatOnBody),
    Nutrient: (sim, c) => outOf(sim.W.cNut[c.t], sim.T[AS.SPECIES_KEY[sim.W.cSpecies[c.t]]].CorpseNutrient),
  };

  // ---- the per-T row lists ----------------------------------------------------------

  // The hover text: the three "when" cells, minus the empty and "—" ones.
  function tipOf(v) {
    const parts = [];
    const add = (label, text) => {
      if (!text || text === NONE) return;
      parts.push(label + ': ' + text + (/[.!?]$/.test(text) ? '' : '.'));
    };
    add('Up', v.up);
    add('Down', v.down);
    add('At the limit', v.limit);
    return parts.join(' ');
  }

  // Built once per T (T is frozen and never changes), then reused on every call.
  const cache = new WeakMap();
  function listsFor(T) {
    let lists = cache.get(T);
    if (lists) return lists;
    lists = {};
    for (const thing of Object.keys(THING_TOKENS)) {
      const tokens = THING_TOKENS[thing];
      lists[thing] = T.variables
        .filter(v => v.appliesTo.some(tok => tokens.includes(tok)))
        .map(v => ({ name: v.name, range: v.range, tip: tipOf(v), read: READERS[v.name] || null }));
    }
    cache.set(T, lists);
    return lists;
  }

  // ---- public -----------------------------------------------------------------------

  function safe(read, sim, ctx) {
    if (!read) return NONE;
    const s = read(sim, ctx);
    return typeof s === 'string' && !/NaN|undefined/.test(s) ? s : NONE;
  }

  AS.describe = function (sim, sel) {
    if (!sel) return null;
    const W = sim.W, T = sim.T;
    let thing, title, ctx;
    if (sel.slot >= 0) {
      const s = sel.slot, sp = W.aSpecies[s], female = W.aSex[s] === SEX.FEMALE;
      const key = AS.SPECIES_KEY[sp];
      thing = key + (female && T[key].LitterSize != null ? 'F' : '');
      title = (female ? 'Female ' : 'Male ') + key + ' #' + serial(W.aSerial[s]);
      ctx = { t: W.aTile[s], s, Tsp: T[key] };
    } else {
      const t = sel.tile, k = W.kind[t];
      ctx = { t, s: -1, Tsp: null };
      if (k === KIND.CORPSE) {
        thing = 'corpse';
        title = speciesName(W.cSpecies[t]) + ' corpse #' + serial(W.serial[t]);
      } else if (k === KIND.EMPTY && W.hole[t]) {
        thing = 'hole';
        title = 'Warren hole';
      } else {
        thing = 'grass';
        title = 'Blade of grass #' + serial(W.serial[t]);
      }
    }
    const list = listsFor(T)[thing];
    const rows = new Array(list.length);
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      rows[i] = { name: r.name, value: safe(r.read, sim, ctx), range: r.range, tip: r.tip };
    }
    return { title, rows };
  };

  AS.inspectWarnings = function (T) {
    const out = [];
    for (const v of T.variables) {
      if (!READERS[v.name]) out.push(`variables.csv: "${v.name}" has no value in the inspector yet.`);
      for (const tok of v.appliesTo) {
        if (!TOKENS.includes(tok)) {
          out.push(`variables.csv: "${v.name}" says it applies to "${tok}", which the inspector doesn't know. Use ${TOKENS.join(', ')}.`);
        }
      }
    }
    return out;
  };
})(globalThis.AS);
