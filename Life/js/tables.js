// Loads tables/*.csv into one frozen config object, T. The CSVs are the source of truth
// and every number in them is a placeholder, so this file checks shape and sanity only,
// never particular values. Problems are reported in words Paul can act on in Numbers.
(function (AS) {
  'use strict';

  const FILES = ['species', 'variables', 'states', 'settings'];
  // In AS.SPECIES order: a species' code is its index here.
  const ANIMALS = ['Bunny', 'Wolf', 'Human'];
  const ALL = [...ANIMALS, 'Grass'];
  // The animals that breed; a species with none of the mating stats never mates (humans).
  const BREEDERS = ['Bunny', 'Wolf'];

  // Each stat the code reads: its type, and which species must fill it in. A cell left
  // blank for any other species reads as null.
  //   num   plain number ≥ 0
  //   pos   number > 0 (the sim divides by it, or 0 would stall it)
  //   frac  percent, 0–100 → 0–1 (a "%" on the value or a "% of …" unit)
  //   ratio percent with no upper bound (speeds as a share of the adult's)
  //   range "a-b" or a single whole number → {min, max}
  //   species space-separated animal species names → frozen array of species codes (AS.SPECIES)
  //   text  kept as written
  const SPECIES_SCHEMA = [
    ['WalkSpeed', 'num', ANIMALS],
    ['SprintSpeed', 'num', ANIMALS],
    ['StaminaMax', 'pos', ANIMALS],
    ['StaminaRefill', 'num', ANIMALS],
    ['SprintCost', 'num', ANIMALS],
    ['FullnessMax', 'pos', ANIMALS],
    ['HungerRate', 'num', ANIMALS],
    ['StarveDamage', 'num', ANIMALS],
    ['RestHunger', 'num', ANIMALS],
    ['SprintHunger', 'num', ANIMALS],
    ['WaterMax', 'pos', ANIMALS],
    ['ThirstRate', 'num', ANIMALS],
    ['ThirstyAt', 'frac', ANIMALS],
    ['DrinkRate', 'pos', ANIMALS],
    ['ThirstDamage', 'num', ANIMALS],
    ['WaterSense', 'num', ANIMALS],
    ['HPMax', 'pos', ANIMALS],
    ['HealRate', 'num', ANIMALS],
    ['HealAbove', 'frac', ANIMALS],
    ['HungryAt', 'frac', ANIMALS],
    ['RestBelow', 'frac', ANIMALS],
    ['RestUntil', 'frac', ANIMALS],
    ['SprintRange', 'num', ['Wolf', 'Human']],
    ['TrackSeconds', 'num', ['Wolf', 'Human']],
    ['HoleRange', 'num', ['Bunny']],
    ['DigChance', 'frac', ['Bunny']],
    ['DigSeconds', 'num', ['Bunny']],
    ['WanderRun', 'range', ANIMALS],
    ['RoomPreference', 'num', ANIMALS],
    ['DecidePerSec', 'pos', ANIMALS],
    ['Diet', 'text', []],
    ['Prey', 'species', []],         // blank = hunts nothing
    ['EatsCarcass', 'species', []],  // blank = eats no carcasses
    ['BiteDamage', 'num', ['Wolf', 'Human']],
    ['BiteCooldown', 'pos', ANIMALS],
    ['BiteFood', 'num', ANIMALS],
    ['GrassFood', 'num', []],        // blank = a grazer's BiteFood
    ['BiteSize', 'num', ANIMALS],
    ['TimeToMature', 'num', ALL],
    ['Lifespan', 'pos', ALL],
    ['ElderAt', 'frac', ANIMALS],
    ['VisionRange', 'num', ANIMALS],
    ['PregnancyDays', 'num', BREEDERS],
    ['LitterSize', 'range', BREEDERS],
    ['MateCooldown', 'num', BREEDERS],
    ['MateFullness', 'frac', BREEDERS],
    ['MateCost', 'frac', BREEDERS],
    ['RoamAfter', 'num', []],        // blank = never roams
    ['RoamRun', 'range', []],
    ['MateRange', 'num', []],        // blank = a mate must be in sight
    ['PackLimit', 'num', []],        // blank = no territory rule
    ['TerritoryRange', 'num', []],
    ['BabySpeed', 'ratio', ANIMALS],
    ['ElderSpeed', 'ratio', ANIMALS],
    ['GrowthRate', 'num', ['Grass']],
    ['SproutSize', 'frac', ['Grass']],
    ['SproutChance', 'frac', ['Grass']],
    ['SeedChance', 'frac', ['Grass']],
    ['WaterRadius', 'num', ['Grass']],
    ['WaterBoost', 'num', ['Grass']],
    ['CorpseNutrient', 'num', ANIMALS],
    ['CorpseDecay', 'pos', ANIMALS],
    ['MeatOnBody', 'num', ANIMALS],
    ['CorpseRadius', 'num', ANIMALS],
    ['CorpseBoost', 'num', ANIMALS],
  ];

  // Kept small enough that one grid's typed arrays stay well inside a phone's memory.
  const MAX_SIDE = 2000;
  const MIN_SIDE = 3;
  const MAX_SEED = 4294967295;

  const SETTINGS_SCHEMA = [
    ['WorldWidth', 'side'],
    ['WorldHeight', 'side'],
    ['StartBunnies', 'count'],
    ['StartWolves', 'count'],
    ['StartGrass', 'frac'],
    ['StartGrassAge', 'num'],
    ['StartLayout', 'layout'],
    ['Water', 'onoff'],
    ['Lakes', 'count'],
    ['LakeSize', 'pos'],
    ['Rivers', 'count'],
    ['RiverWidth', 'range'],
    ['BridgeEvery', 'pos'],
    ['MeadowSize', 'pos'],
    ['BunnyColonies', 'count'],
    ['WolfPacks', 'count'],
    ['HolesPerColony', 'count'],
    ['WarrenRadius', 'num'],
    ['CollapseDays', 'num'],
    ['NukeRadius', 'pos'],
    ['ScorchDays', 'pos'],
    ['BrushRadius', 'num'],
    ['AnimalWarnAt', 'pos'],
    ['Seed', 'seed'],
  ];
  // How the world is laid out on day 0 (sim.js populate, start.js).
  const LAYOUTS = ['Meadows', 'Scatter'];

  // RFC 4180-style: quoted fields, doubled quotes, CRLF, and the BOM a spreadsheet may add.
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const rows = [];
    let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
        } else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(f => f.trim() !== ''));
  }

  // " Did you mean …?" when a name only differs in case or spacing, else ''.
  function didYouMean(want, names) {
    const key = want.toLowerCase();
    for (const n of names) {
      if (n.replace(/\s+/g, '').toLowerCase() === key) return ` Did you mean "${n}"? Names must match exactly.`;
    }
    return '';
  }

  // Rows as objects keyed by header, so a column moved in Numbers still reads right.
  function table(file, text, need, errors) {
    const rows = parseCSV(text);
    if (!rows.length) { errors.push(`${file}.csv is empty.`); return []; }
    const head = rows[0].map(h => h.trim());
    if (head.length === 1 && /[;\t]/.test(head[0])) {
      errors.push(`${file}.csv doesn't look comma-separated. Export it as CSV with commas, not tabs or semicolons.`);
      return [];
    }
    for (const h of need) {
      if (!head.includes(h)) errors.push(`${file}.csv has no "${h}" column.${didYouMean(h, head)}`);
    }
    return rows.slice(1).map((r, i) => {
      const o = { _line: i + 2 };
      head.forEach((h, j) => { o[h] = (r[j] || '').trim(); });
      return o;
    });
  }

  const DASHES = /[–—]/g;

  function toNumber(s) {
    if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function notANumber(raw) {
    const hint = /\d,\d/.test(raw) ? ' Remove thousands separators, and use a . for decimals.' : '';
    return `"${raw}" is not a number.${hint}`;
  }

  // Returns {value}, maybe with a {warning}, or {error}.
  function convert(raw, type, unit) {
    const s = raw.replace(DASHES, '-').trim();
    if (type === 'text') return { value: raw.trim() };
    if (type === 'species') {
      const codes = [];
      for (const name of s.split(/\s+/).filter(Boolean)) {
        const i = ANIMALS.findIndex(a => a.toLowerCase() === name.toLowerCase());
        if (i < 0) return { error: `"${name}" isn't an animal species. Use ${ANIMALS.join(', ')}` };
        codes.push(i);
      }
      return { value: Object.freeze(codes) };
    }
    if (type === 'range') {
      const m = s.match(/^(\d+)\s*(?:-\s*(\d+))?$/);
      if (!m) return { error: `"${raw}" should be a whole number or a range like 2-4` };
      const min = Number(m[1]), max = m[2] === undefined ? min : Number(m[2]);
      if (min > max) return { error: `range "${raw}" runs backwards` };
      return { value: Object.freeze({ min, max }) };
    }
    const pct = s.endsWith('%');
    const n = toNumber(pct ? s.slice(0, -1).trim() : s);
    if (Number.isNaN(n)) return { error: notANumber(raw).slice(0, -1) };
    if (n < 0) return { error: `"${raw}" can't be negative` };
    if (type === 'pos' && n === 0) return { error: `must be more than 0` };
    if (type === 'frac' || type === 'ratio') {
      // A "% of …" unit or a "%" on the value means percent; a bare number is a share.
      const pctUnit = /^%/.test(unit || '');
      const v = pct || pctUnit ? n / 100 : n;
      if (type === 'frac' && v > 1) {
        return { error: `"${raw}" is more than 100%. Write ${n}% (or ${n / 100}) for ${n} percent` };
      }
      // Excel can export a percent cell as a share (0.7 for 70%), which a "% of" column
      // would read as 0.7%.
      if (pctUnit && !pct && n > 0 && n < 1) {
        return { value: v, warning: `"${raw}" reads as ${n}%. If you meant ${n * 100}%, write ${n * 100}` };
      }
      return { value: v };
    }
    if (pct) return { error: `"${raw}" shouldn't be a percent` };
    return { value: n };
  }

  function parseSpecies(rows, errors, warnings) {
    const out = {};
    for (const Sp of ALL) out[Sp.toLowerCase()] = {};
    const byStat = new Map();
    for (const r of rows) {
      if (!r.Stat) continue;
      if (byStat.has(r.Stat)) errors.push(`species.csv, line ${r._line}: stat "${r.Stat}" appears twice.`);
      byStat.set(r.Stat, r);
    }
    const known = new Set(SPECIES_SCHEMA.map(s => s[0]));
    for (const [stat, type, needs] of SPECIES_SCHEMA) {
      const r = byStat.get(stat);
      if (!r) { errors.push(`species.csv has no "${stat}" row.${didYouMean(stat, byStat.keys())}`); continue; }
      for (const sp of ALL) {
        const raw = r[sp] || '';
        const key = sp.toLowerCase();
        if (raw === '') {
          if (needs.includes(sp)) errors.push(`species.csv, ${stat}, ${sp}: needs a value.`);
          out[key][stat] = null;
          continue;
        }
        const c = convert(raw, type, r.Unit);
        if (c.error) errors.push(`species.csv, ${stat}, ${sp}: ${c.error}.`);
        else out[key][stat] = c.value;
        if (c.warning) warnings.push(`species.csv, ${stat}, ${sp}: ${c.warning}.`);
      }
    }
    for (const stat of byStat.keys()) {
      if (!known.has(stat)) warnings.push(`species.csv: "${stat}" isn't used by the sim yet.`);
    }
    for (const Sp of ANIMALS) {
      const s = out[Sp.toLowerCase()];
      if (s.RestUntil != null && s.RestBelow != null && s.RestUntil < s.RestBelow) {
        errors.push(`species.csv, ${Sp}: RestUntil is below RestBelow, so a resting animal would never get up.`);
      }
      if (s.CorpseBoost != null && s.CorpseBoost < 1) {
        errors.push(`species.csv, CorpseBoost, ${Sp}: below 1 would slow grass down near a corpse.`);
      }
      if (s.ElderAt != null && s.Lifespan && s.TimeToMature != null && s.ElderAt * s.Lifespan < s.TimeToMature) {
        warnings.push(`species.csv, ${Sp}: ElderAt comes before TimeToMature, so a ${Sp.toLowerCase()} goes straight from baby to elder.`);
      }
      // An animal stops eating once it isn't hungry; if that's below what mating needs,
      // it can never get full enough to breed (how wolves died out in tuning).
      if (s.HungryAt != null && s.MateFullness != null && s.HungryAt < s.MateFullness) {
        warnings.push(`species.csv, ${Sp}: HungryAt is below MateFullness, so a ${Sp.toLowerCase()} stops eating before it's full enough to mate.`);
      }
      if (s.MateCost != null && s.MateFullness != null && s.MateCost > s.MateFullness) {
        warnings.push(`species.csv, ${Sp}: MateCost is more than MateFullness, so mating can leave a parent starving.`);
      }
    }
    for (const Sp of ALL) {
      const s = out[Sp.toLowerCase()];
      if (s.TimeToMature != null && s.Lifespan && s.TimeToMature >= s.Lifespan) {
        warnings.push(`species.csv, ${Sp}: TimeToMature is at or past Lifespan, so it dies before it matures.`);
      }
    }
    for (const k of Object.keys(out)) Object.freeze(out[k]);
    return out;
  }

  function parseSettings(rows, errors, warnings) {
    const by = new Map();
    for (const r of rows) {
      if (!r.Setting) continue;
      if (by.has(r.Setting)) errors.push(`settings.csv, line ${r._line}: "${r.Setting}" appears twice.`);
      by.set(r.Setting, r);
    }
    const out = {};
    for (const [name, type] of SETTINGS_SCHEMA) {
      const r = by.get(name);
      if (!r) { errors.push(`settings.csv has no "${name}" row.${didYouMean(name, by.keys())}`); continue; }
      const raw = r.Value.replace(DASHES, '-').trim();
      const where = `settings.csv, ${name}`;
      if (type === 'seed') {
        if (raw === '') { out[name] = null; continue; }
        const n = toNumber(raw);
        if (!Number.isInteger(n) || n < 0 || n > MAX_SEED) {
          errors.push(`${where}: "${raw}" should be blank or a whole number from 0 to ${MAX_SEED}.`);
        } else out[name] = n;
        continue;
      }
      if (type === 'onoff') {
        const v = { on: true, '1': true, yes: true, true: true, off: false, '0': false, no: false, false: false }[raw.toLowerCase()];
        if (v === undefined) errors.push(`${where}: "${raw}" should be on or off.`);
        else out[name] = v;
        continue;
      }
      if (type === 'layout') {
        const hit = LAYOUTS.find(l => l.toLowerCase() === raw.toLowerCase());
        if (!hit) errors.push(`${where}: "${raw}" should be one of ${LAYOUTS.join(', ')}.`);
        else out[name] = hit;
        continue;
      }
      if (raw === '') { errors.push(`${where}: needs a value.`); continue; }
      const c = convert(raw, type === 'frac' || type === 'range' ? type : 'num', '');
      if (c.error) { errors.push(`${where}: ${c.error}.`); continue; }
      const v = c.value;
      if (type === 'range') {
        if (v.min < 1) errors.push(`${where}: "${raw}" should be at least 1 tile.`);
        else out[name] = v;
        continue;
      }
      if ((type === 'side' || type === 'count') && !Number.isInteger(v)) {
        errors.push(`${where}: "${raw}" should be a whole number.`);
      } else if (type === 'side' && (v < MIN_SIDE || v > MAX_SIDE)) {
        errors.push(`${where}: "${raw}" should be between ${MIN_SIDE} and ${MAX_SIDE} tiles.`);
      } else if (type === 'pos' && v === 0) {
        errors.push(`${where}: must be more than 0.`);
      } else out[name] = v;
    }
    const known = new Set(SETTINGS_SCHEMA.map(s => s[0]));
    for (const k of by.keys()) if (!known.has(k)) warnings.push(`settings.csv: "${k}" isn't used by the sim yet.`);
    if (out.WorldWidth && out.WorldHeight && out.StartGrass != null &&
        out.StartBunnies != null && out.StartWolves != null) {
      const tiles = out.WorldWidth * out.WorldHeight;
      const used = Math.round(tiles * out.StartGrass) + out.StartBunnies + out.StartWolves;
      if (used > tiles) {
        errors.push(`settings.csv: StartGrass, StartBunnies and StartWolves need ${used} tiles; the world has ${tiles}.`);
      }
    }
    return Object.freeze(out);
  }

  function parseStates(rows, errors) {
    const out = {};
    for (const r of rows) {
      if (!r.Species || !r.State) continue;
      const sp = r.Species.toLowerCase();
      const p = toNumber(r.Priority);
      (out[sp] = out[sp] || []).push(Object.freeze({
        name: r.State, priority: Number.isNaN(p) ? null : p,
        enter: r['Enter when'], does: r.Does,
      }));
    }
    for (const sp of Object.keys(out)) {
      if (!ALL.some(S => S.toLowerCase() === sp)) {
        errors.push(`states.csv: "${r0(sp)}" isn't a species. Use ${ALL.join(', ')}.`);
      }
    }
    for (const S of ANIMALS) {
      if (!out[S.toLowerCase()]) errors.push(`states.csv has no ${S} states.`);
    }
    for (const sp of Object.keys(out)) {
      const list = out[sp];
      const seen = new Set();
      for (const s of list) {
        if (seen.has(s.name)) errors.push(`states.csv: ${r0(sp)} has state ${s.name} twice.`);
        seen.add(s.name);
        if (sp !== 'grass' && s.priority === null) {
          errors.push(`states.csv: ${r0(sp)} ${s.name} needs a number in Priority.`);
        }
      }
      const pr = list.filter(s => s.priority !== null).map(s => s.priority);
      if (new Set(pr).size !== pr.length) errors.push(`states.csv: two ${r0(sp)} states share a Priority.`);
      // Priority order is the order the decide loop tries them in.
      list.sort((a, b) => (a.priority ?? 1e9) - (b.priority ?? 1e9));
      Object.freeze(list);
    }
    return Object.freeze(out);
  }

  function r0(sp) { return sp[0].toUpperCase() + sp.slice(1); }

  function parseVariables(rows) {
    return Object.freeze(rows.filter(r => r.Variable).map(r => Object.freeze({
      name: r.Variable,
      kind: r.Kind,
      appliesTo: Object.freeze(r['Applies to'].split(/\s+/).filter(Boolean).map(s => s.toLowerCase())),
      range: r.Range, up: r['Goes up when'], down: r['Goes down when'], limit: r['At the limit'],
    })));
  }

  // texts: {species, variables, states, settings} as raw CSV text.
  AS.parseTables = function (texts) {
    const errors = [], warnings = [];
    const sp = table('species', texts.species, ['Stat', 'Unit', ...ALL], errors);
    const vr = table('variables', texts.variables, ['Variable', 'Kind', 'Applies to'], errors);
    const st = table('states', texts.states, ['Species', 'Priority', 'State', 'Enter when', 'Does'], errors);
    const se = table('settings', texts.settings, ['Setting', 'Value'], errors);
    if (errors.length) return { T: null, errors, warnings };
    const species = parseSpecies(sp, errors, warnings);
    const T = Object.freeze({
      bunny: species.bunny,
      wolf: species.wolf,
      human: species.human,
      grass: species.grass,
      world: parseSettings(se, errors, warnings),
      states: parseStates(st, errors),
      variables: parseVariables(vr),
    });
    return { T: errors.length ? null : T, errors, warnings };
  };

  AS.loadTables = async function (v) {
    const texts = {};
    const errors = [];
    await Promise.all(FILES.map(async f => {
      try {
        const res = await fetch(`${AS.BASE || ''}tables/${f}.csv?v=${v}`, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        texts[f] = await res.text();
      } catch (e) {
        errors.push(`Couldn't load ${AS.BASE || ''}tables/${f}.csv (${e.message}). The page has to be served, not opened as a file.`);
      }
    }));
    if (errors.length) return { T: null, errors, warnings: [] };
    return AS.parseTables(texts);
  };
})(globalThis.AS);
