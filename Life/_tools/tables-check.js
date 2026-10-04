'use strict';
const fs = require('fs');
const { load, editCSV } = require('./harness.js');
const { AS, texts: base } = load();
let pass = 0, fail = 0;
const out = (ok, name, msgs) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}\n      ${msgs.length ? msgs.join('\n      ') : '(no messages)'}`); };
const parse = o => AS.parseTables({ ...base, ...o });
const sp = base.species, se = base.settings, st = base.states;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 1. baseline
{
  const r = parse({});
  out(r.errors.length === 0 && r.T, 'real CSVs parse with zero errors', r.errors);
  console.log('      warnings:', JSON.stringify(r.warnings));
  // Conversion checks: each cell is set to a known text first, so these test how the
  // loader reads units, not whatever numbers the tables hold today (they get tuned).
  const known = [
    ['SeedChance', 'Grass', '30%'], ['ElderAt', 'Bunny', '80'], ['LitterSize', 'Bunny', '2-4'],
    ['HungryAt', 'Bunny', '70'], ['HungryAt', 'Wolf', '60'], ['WanderRun', 'Wolf', '4-10'],
    ['HealAbove', 'Bunny', '50'], ['BabySpeed', 'Bunny', '50'], ['SprintRange', 'Bunny', ''],
    ['Glyph', 'Grass', '░ ▒ ▓'],
  ];
  let kt = sp;
  for (const [row, col, v] of known) kt = editCSV(kt, row, col, v);
  const T = parse({ species: kt, settings: editCSV(editCSV(se, 'StartGrass', 'Value', '40%'), 'Seed', 'Value', '') }).T;
  const spot = [
    ['grass.SeedChance 30% → 0.3', Math.abs(T.grass.SeedChance - 0.3) < 1e-12, T.grass.SeedChance],
    ['bunny.ElderAt 80 (% of Lifespan) → 0.8', T.bunny.ElderAt === 0.8, T.bunny.ElderAt],
    ['bunny.LitterSize 2-4 → {2,4}', eq(T.bunny.LitterSize, { min: 2, max: 4 }), T.bunny.LitterSize],
    ['world.StartGrass 40% → 0.4', Math.abs(T.world.StartGrass - 0.4) < 1e-12, T.world.StartGrass],
    ['world.Seed blank → null', T.world.Seed === null, T.world.Seed],
    ['grass.Glyph → three glyphs', eq(T.grass.Glyph, ['░', '▒', '▓']), T.grass.Glyph],
    ['bunny.HungryAt 70 → 0.7', T.bunny.HungryAt === 0.7, T.bunny.HungryAt],
    ['wolf.HungryAt 60 → 0.6', T.wolf.HungryAt === 0.6, T.wolf.HungryAt],
    ['bunny.SprintRange blank → null', T.bunny.SprintRange === null, T.bunny.SprintRange],
    ['bunny states priority order', eq(T.states.bunny.map(s => s.name), ['FLEE', 'EAT', 'SEEK_FOOD', 'MATE', 'REST', 'WANDER']), T.states.bunny.map(s => s.name)],
    ['wolf states order', eq(T.states.wolf.map(s => s.name), ['HUNT', 'GIVE_UP', 'MATE', 'REST', 'PROWL']), T.states.wolf.map(s => s.name)],
    ['variables has every row', T.variables.length === base.variables.trim().split(/\r?\n/).length - 1, T.variables.length],
    ['wolf.WanderRun 4-10 → {4,10}', eq(T.wolf.WanderRun, { min: 4, max: 10 }), T.wolf.WanderRun],
    ['bunny.HealAbove 50 → 0.5', T.bunny.HealAbove === 0.5, T.bunny.HealAbove],
    ['bunny.BabySpeed 50 (% of adult) → 0.5', T.bunny.BabySpeed === 0.5, T.bunny.BabySpeed],
    ['grass states keep file order', eq(T.states.grass.map(s => s.name), ['GROW', 'SEED']), T.states.grass.map(s => s.name)],
  ];
  for (const [n, ok, v] of spot) out(ok, 'spot: ' + n, [JSON.stringify(v)]);
}

// 2. broken inputs
const bad = (name, o, needles = []) => {
  const r = parse(o);
  const text = r.errors.join(' | ');
  const ok = r.T === null && r.errors.length > 0 && needles.every(n => text.includes(n));
  out(ok, 'BAD: ' + name + (needles.length ? `  (expects: ${needles.join(', ')})` : ''), r.errors.length ? r.errors : ['T=' + (r.T ? 'non-null!' : 'null')]);
};
const dropRow = (t, name) => t.split('\n').filter(l => l.split(',')[0] !== name).join('\n');
const sE = (stat, col, v) => ({ species: editCSV(sp, stat, col, v) });
const wE = (name, v) => ({ settings: editCSV(se, name, 'Value', v) });

bad('Bunny WalkSpeed "abc"', sE('WalkSpeed', 'Bunny', 'abc'), ['species.csv', 'WalkSpeed', 'Bunny', 'abc']);
bad('Wolf WalkSpeed -3', sE('WalkSpeed', 'Wolf', '-3'), ['WalkSpeed', 'Wolf']);
bad('Wolf BiteDamage blank', sE('BiteDamage', 'Wolf', ''), ['BiteDamage', 'Wolf']);
bad('Grass SeedChance 130%', sE('SeedChance', 'Grass', '130%'), ['SeedChance', 'Grass']);
bad('Bunny LitterSize 4-2', sE('LitterSize', 'Bunny', '4-2'), ['LitterSize', 'Bunny']);
bad('HungerRate row deleted', { species: dropRow(sp, 'HungerRate') }, ['HungerRate']);
bad('duplicate WalkSpeed row', { species: sp + '\nWalkSpeed,tiles/s,9,9,,' }, ['WalkSpeed']);
bad('Wolf column header renamed', { species: sp.replace('Stat,Unit,Bunny,Wolf', 'Stat,Unit,Bunny,Wulf') }, ['Wolf']);
bad('RestUntil < RestBelow (Bunny 20 vs 30)', sE('RestUntil', 'Bunny', '20'), ['RestUntil', 'RestBelow', 'unny']);
bad('CorpseBoost 0.5 Bunny', sE('CorpseBoost', 'Bunny', '0.5'), ['CorpseBoost', 'unny']);
bad('Grass Glyph two glyphs', sE('Glyph', 'Grass', '░ ▒'), ['Glyph', 'Grass']);
bad('Grass Glyph four glyphs', sE('Glyph', 'Grass', '░ ▒ ▓ █'), ['Glyph', 'Grass']);
bad('WorldWidth 0', wE('WorldWidth', '0'), ['settings.csv', 'WorldWidth']);
bad('WorldWidth 2.5', wE('WorldWidth', '2.5'), ['WorldWidth']);
bad('WorldWidth 5000', wE('WorldWidth', '5000'), ['WorldWidth']);
bad('Seed abc', wE('Seed', 'abc'), ['Seed']);
bad('Seed -1', wE('Seed', '-1'), ['Seed']);
bad('Seed 1.5', wE('Seed', '1.5'), ['Seed']);
// 99% of 60,000 tiles plus 162 animals still fits, so this must NOT be an error; the
// overflow case is the 10x10 world below.
{ const r = parse(wE('StartGrass', '99%')); out(!!r.T && Math.abs(r.T.world.StartGrass - 0.99) < 1e-9, 'OK: StartGrass 99% + 150 bunnies + 12 wolves fits 300x200', r.errors); }
{
  let s = editCSV(se, 'StartGrass', 'Value', '99%'); s = editCSV(s, 'WorldWidth', 'Value', '10'); s = editCSV(s, 'WorldHeight', 'Value', '10');
  bad('overflow, 10x10 world, 99% grass, 150 bunnies', { settings: s }, ['StartGrass', 'StartBunnies']);
}
bad('two Bunny states share priority', { states: st.replace('Bunny,2,EAT', 'Bunny,1,EAT') }, ['Bunny', 'Priority']);
bad('states: Bunny state with blank priority', { states: st.replace('Bunny,2,EAT', 'Bunny,,EAT') }, ['Bunny', 'EAT']);
bad('states: duplicate state name', { states: st + '\nBunny,9,FLEE,x,y' }, ['Bunny', 'FLEE']);
bad('empty species file', { species: '' }, ['species.csv']);
bad('empty settings file', { settings: '' }, ['settings.csv']);
bad('empty states file', { states: '' }, ['states.csv']);
bad('empty variables file', { variables: '' }, ['variables.csv']);
bad('Seed 4294967296', wE('Seed', '4294967296'), ['Seed']);
bad('StartBunnies 1.5', wE('StartBunnies', '1.5'), ['StartBunnies']);
bad('settings row StartWolves deleted', { settings: dropRow(se, 'StartWolves') }, ['StartWolves']);
bad('Bunny WanderRun "a-b"', sE('WanderRun', 'Bunny', 'a-b'), ['WanderRun', 'Bunny']);
bad('Bunny HungryAt 150', sE('HungryAt', 'Bunny', '150'), ['HungryAt', 'Bunny']);
bad('Bunny DecidePerSec 0', sE('DecidePerSec', 'Bunny', '0'), ['DecidePerSec']);
bad('Grass Lifespan 0', sE('Lifespan', 'Grass', '0'), ['Lifespan', 'Grass']);
bad('Bunny SprintSpeed "5 %" (percent on plain number)', sE('SprintSpeed', 'Bunny', '5%'), ['SprintSpeed', 'Bunny']);
bad('species missing Stat column', { species: sp.replace('Stat,Unit', 'Name,Unit') }, ['Stat']);
bad('states missing "Enter when" column', { states: st.replace('Enter when', 'Enter') }, ['Enter when']);
bad('Bunny Glyph blank', sE('Glyph', 'Bunny', ''), ['Glyph', 'Bunny']);
bad('Grass TimeToMature blank', sE('TimeToMature', 'Grass', ''), ['TimeToMature', 'Grass']);
bad('StartGrass 40 (bare 40, meaning 40%)', wE('StartGrass', '40'), ['StartGrass']);
bad('Seed "1e3"? (scientific) -- reported only', wE('Seed', '1e99'), ['Seed']);

// 3. robustness
const clean = parse({});
const same = (name, o) => {
  const r = parse(o);
  const ok = r.errors.length === 0 && r.T && JSON.stringify(r.T) === JSON.stringify(clean.T);
  out(ok, 'SAME: ' + name, r.errors.length ? r.errors : (ok ? ['identical to clean'] : ['parsed but differs: ' + diff(r.T, clean.T)]));
};
// Like same(), but against an explicit canonical edit rather than today's clean tables, so
// a check that sets a value keeps passing after the numbers are tuned.
const sameAs = (name, o, canon) => {
  const r = parse(o), c = parse(canon);
  const ok = r.errors.length === 0 && r.T && c.T && JSON.stringify(r.T) === JSON.stringify(c.T);
  out(ok, 'SAME: ' + name, r.errors.length ? r.errors : (ok ? ['identical to canonical form'] : ['parsed but differs: ' + diff(r.T, c.T)]));
};
const diff = (a, b) => { const d = []; (function w(x, y, p) { if (x && typeof x === 'object' && y && typeof y === 'object') { for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) w(x[k], y[k], p + '.' + k); } else if (x !== y) d.push(`${p}: ${JSON.stringify(x)} vs ${JSON.stringify(y)}`); })(a, b, 'T'); return d.slice(0, 5).join('; '); };
const allBOM = {}, allCRLF = {}, allTrail = {}, allCols = {}, allQuoted = {};
for (const f of Object.keys(base)) {
  allBOM[f] = '﻿' + base[f];
  allCRLF[f] = base[f].replace(/\r?\n/g, '\r\n');
  allTrail[f] = base[f].replace(/\s+$/, '') + '\n\n\n';
  allCols[f] = base[f].split(/\r?\n/).map(l => l + ',,,').join('\n');
  allQuoted[f] = base[f].split(/\r?\n/).map(l => l.split(',').map(c => c).join(',')).join('\n');
}
same('UTF-8 BOM on all files', allBOM);
same('CRLF on all files', allCRLF);
same('CR-only (old Mac Numbers) line endings', Object.fromEntries(Object.keys(base).map(f => [f, base[f].replace(/\r?\n/g, '\r')])));
same('trailing blank lines', allTrail);
same('trailing blank lines with commas ",,,,"', Object.fromEntries(Object.keys(base).map(f => [f, base[f] + '\n,,,,,\n,,,,,\n'])));
same('trailing empty columns ",,,"', allCols);
// quoted Notes
same('Notes cell with comma, quoted ("a, b")', { species: sp.replace('Free movement', '"Free, movement"') });
same('Notes cell with doubled quotes', { species: sp.replace('Free movement', '"say ""hi"""') });
same('Notes cell with embedded newline, quoted', { species: sp.replace('Free movement', '"Free\nmovement"') });
same('every field quoted (Excel-style full quoting) in species', { species: sp.split('\n').map(l => l.split(',').map(c => `"${c}"`).join(',')).join('\n') });
sameAs('en dash range "2–4" Bunny LitterSize', sE('LitterSize', 'Bunny', '2–4'), sE('LitterSize', 'Bunny', '2-4'));
sameAs('em dash range "2—4"', sE('LitterSize', 'Bunny', '2—4'), sE('LitterSize', 'Bunny', '2-4'));
sameAs('spaced range "2 - 4"', sE('LitterSize', 'Bunny', '2 - 4'), sE('LitterSize', 'Bunny', '2-4'));
sameAs('spaces around value " 2 " WalkSpeed Bunny', sE('WalkSpeed', 'Bunny', ' 2 '), sE('WalkSpeed', 'Bunny', '2'));
sameAs('"15 %" StartGrass', wE('StartGrass', '15 %'), wE('StartGrass', '15%'));
sameAs('"15%" StartGrass', wE('StartGrass', '15%'), wE('StartGrass', '0.15'));
sameAs('StartGrass 0.15 (share)', wE('StartGrass', '0.15'), wE('StartGrass', '15%'));
sameAs('StartGrass " 15% " spaces', wE('StartGrass', ' 15% '), wE('StartGrass', '15%'));
sameAs('species "70%" in a % unit column (HungryAt Bunny)', sE('HungryAt', 'Bunny', '70%'), sE('HungryAt', 'Bunny', '70'));
sameAs('species "70.0" HungryAt', sE('HungryAt', 'Bunny', '70.0'), sE('HungryAt', 'Bunny', '70'));
sameAs('WalkSpeed "2.0"', sE('WalkSpeed', 'Bunny', '2.0'), sE('WalkSpeed', 'Bunny', '2'));
sameAs('WalkSpeed "2." (trailing dot)', sE('WalkSpeed', 'Bunny', '2.'), sE('WalkSpeed', 'Bunny', '2'));
same('Seed " " (spaces only)', wE('Seed', '  '));
same('Header with spaces " Stat , Unit "', { species: sp.replace('Stat,Unit,', ' Stat , Unit ,') });
same('Columns reordered (Notes first)', { species: sp.split('\n').map(l => { const c = l.split(','); return [c[5], ...c.slice(0, 5)].join(','); }).join('\n') });
same('Rows shuffled (species reversed after header)', { species: (l => [l[0], ...l.slice(1).reverse()].join('\n'))(sp.trim().split('\n')) });
sameAs('Glyph Grass separated by tabs / multiple spaces', sE('Glyph', 'Grass', '░  ▒\t▓'), sE('Glyph', 'Grass', '░ ▒ ▓'));
sameAs('Glyph Grass with no spaces "░▒▓" (reported)', sE('Glyph', 'Grass', '░▒▓'), sE('Glyph', 'Grass', '░ ▒ ▓'));
{ const r = parse(wE('Seed', '12345')); out(!!r.T && r.T.world.Seed === 12345, 'OK: Seed "12345" reads as 12345', r.errors); }
same('upper/lowercase species names in states ("bunny")', { states: st.replace(/^Bunny,/gm, 'bunny,') });
same('states Priority " 1 " with spaces', { states: st.replace('Bunny,1,FLEE', 'Bunny, 1 ,FLEE') });
same('Priority "1.0"', { states: st.replace('Bunny,1,FLEE', 'Bunny,1.0,FLEE') });
same('BOM + CRLF + quoted + trailing, all at once', Object.fromEntries(Object.keys(base).map(f => [f, '﻿' + allCRLF[f].replace(/\s+$/, '') + '\r\n\r\n'])));
sameAs('Wolf SprintRange written for Bunny too? (blank vs filled; reported)', sE('SprintRange', 'Bunny', ''), sE('SprintRange', 'Bunny', ''));

// 4. unknown extras
const warnTest = (name, o, needle) => {
  const r = parse(o);
  const ok = r.errors.length === 0 && r.T && r.warnings.some(w => w.includes(needle));
  out(ok, 'WARN: ' + name, [...r.errors.map(e => 'ERROR ' + e), ...r.warnings]);
};
warnTest('new stat Foo in species.csv', { species: sp.trimEnd() + '\nFoo,pts,1,2,3,new\n' }, 'Foo');
warnTest('new setting Bar in settings.csv', { settings: se.trimEnd() + '\nBar,5,new\n' }, 'Bar');
warnTest('stat Foo with a comma note quoted', { species: sp.trimEnd() + '\nFoo,pts,"x",2,3,"a, b"\n' }, 'Foo');
// An extra column is ignored without a warning (columns are read by name; a new one
// can't break anything), so this only checks it still parses.
{ const r = parse({ species: sp.split('\n').map((l, i) => i === 0 ? l + ',Colour' : l + ',x').join('\n') }); out(!!r.T && r.T.bunny.WalkSpeed === parse({}).T.bunny.WalkSpeed, 'OK: a new column "Colour" in species.csv still parses', r.errors); }

// extra reported behaviors (informational)
console.log('\n--- informational probes ---');
const probe = (n, o, key) => { const r = parse(o); console.log(`${n}: errors=${JSON.stringify(r.errors)} value=${r.T ? JSON.stringify(key(r.T)) : 'T=null'}`); };
probe('WalkSpeed Bunny "1,000" (unquoted, shifts columns)', sE('WalkSpeed', 'Bunny', '1,000'), T => T.bunny.WalkSpeed);
probe('WalkSpeed Bunny "\\"1,000\\"" quoted', { species: sp.replace('WalkSpeed,tiles/s,2,', 'WalkSpeed,tiles/s,"1,000",') }, T => T.bunny.WalkSpeed);
probe('WalkSpeed Bunny "1e3"', sE('WalkSpeed', 'Bunny', '1e3'), T => T.bunny.WalkSpeed);
probe('WalkSpeed Bunny "2,5" (European decimal, quoted)', { species: sp.replace('WalkSpeed,tiles/s,2,', 'WalkSpeed,tiles/s,"2,5",') }, T => T.bunny.WalkSpeed);
probe('HungryAt Bunny "0.7" (share in a % column)', sE('HungryAt', 'Bunny', '0.7'), T => T.bunny.HungryAt);
probe('BabySpeed "0.5" in % column', sE('BabySpeed', 'Bunny', '0.5'), T => T.bunny.BabySpeed);
probe('BabySpeed "50%"', sE('BabySpeed', 'Bunny', '50%'), T => T.bunny.BabySpeed);
probe('BabySpeed 0 (stuck baby)', sE('BabySpeed', 'Bunny', '0'), T => T.bunny.BabySpeed);
probe('SeedChance "0.3" in a per-day (non-% unit) column', sE('SeedChance', 'Grass', '0.3'), T => T.grass.SeedChance);
probe('SeedChance "30" (no %, unit "per day")', sE('SeedChance', 'Grass', '30'), T => T.grass.SeedChance);
probe('WalkSpeed 0', sE('WalkSpeed', 'Bunny', '0'), T => T.bunny.WalkSpeed);
probe('HPMax 0', sE('HPMax', 'Bunny', '0'), T => T.bunny.HPMax);
probe('FullnessMax 0', sE('FullnessMax', 'Bunny', '0'), T => T.bunny.FullnessMax);
probe('LitterSize "0"', sE('LitterSize', 'Bunny', '0'), T => T.bunny.LitterSize);
probe('LitterSize "2-4-6"', sE('LitterSize', 'Bunny', '2-4-6'), T => T.bunny.LitterSize);
probe('LitterSize "1.5-3"', sE('LitterSize', 'Bunny', '1.5-3'), T => T.bunny.LitterSize);
probe('LitterSize "2 to 4"', sE('LitterSize', 'Bunny', '2 to 4'), T => T.bunny.LitterSize);
probe('LitterSize negative "-2"', sE('LitterSize', 'Bunny', '-2'), T => T.bunny.LitterSize);
probe('WanderRun "0-0"', sE('WanderRun', 'Bunny', '0-0'), T => T.bunny.WanderRun);
probe('Lifespan Bunny 0', sE('Lifespan', 'Bunny', '0'), T => T.bunny.Lifespan);
probe('TimeToMature Bunny 0', sE('TimeToMature', 'Bunny', '0'), T => T.bunny.TimeToMature);
probe('TimeToMature > Lifespan Bunny 50 vs 20', sE('TimeToMature', 'Bunny', '50'), T => T.bunny.TimeToMature);
probe('MateFullness > 100 Bunny 150', sE('MateFullness', 'Bunny', '150'), T => T.bunny.MateFullness);
probe('MateCost > MateFullness (30 vs 60) Bunny MateCost 90', sE('MateCost', 'Bunny', '90'), T => T.bunny.MateCost);
probe('RestBelow 100, RestUntil 100', sE('RestBelow', 'Bunny', '100'), T => T.bunny.RestBelow);
probe('HungryAt 0 Bunny', sE('HungryAt', 'Bunny', '0'), T => T.bunny.HungryAt);
probe('ElderAt 0 Bunny', sE('ElderAt', 'Bunny', '0'), T => T.bunny.ElderAt);
probe('GrowthRate Grass 0', sE('GrowthRate', 'Grass', '0'), T => T.grass.GrowthRate);
probe('VisionRange 0', sE('VisionRange', 'Bunny', '0'), T => T.bunny.VisionRange);
probe('BiteDamage Wolf 0', sE('BiteDamage', 'Wolf', '0'), T => T.wolf.BiteDamage);
probe('BiteCooldown Bunny 0', sE('BiteCooldown', 'Bunny', '0'), T => T.bunny.BiteCooldown);
probe('BiteSize Bunny 0', sE('BiteSize', 'Bunny', '0'), T => T.bunny.BiteSize);
probe('CorpseDecay Bunny 0', sE('CorpseDecay', 'Bunny', '0'), T => T.bunny.CorpseDecay);
probe('Diet filled for Bunny blank?', sE('Diet', 'Bunny', ''), T => T.bunny.Diet);
probe('StartBunnies -1', wE('StartBunnies', '-1'), T => T.world.StartBunnies);
probe('StartBunnies 0, Wolves 0', { settings: editCSV(wE('StartBunnies', '0').settings, 'StartWolves', 'Value', '0') }, T => [T.world.StartBunnies, T.world.StartWolves]);
probe('StartGrass 0', wE('StartGrass', '0'), T => T.world.StartGrass);
probe('StartGrass 100%, tiny overflow', wE('StartGrass', '100%'), T => T.world.StartGrass);
probe('StartGrassAge > Lifespan 500', wE('StartGrassAge', '500'), T => T.world.StartGrassAge);
probe('WorldWidth 3 height 3 too tiny for animals', { settings: editCSV(wE('WorldWidth', '3').settings, 'WorldHeight', 'Value', '3') }, T => T.world);
probe('Seed 0', wE('Seed', '0'), T => T.world.Seed);
probe('Seed "0012"', wE('Seed', '0012'), T => T.world.Seed);
probe('Seed "4294967295"', wE('Seed', '4294967295'), T => T.world.Seed);
probe('Seed "1e3"', wE('Seed', '1e3'), T => T.world.Seed);
probe('Seed "12 345"', wE('Seed', '12 345'), T => T.world.Seed);
probe('Seed "1,234" quoted', { settings: se.replace(/^Seed,,/m, 'Seed,"1,234",') }, T => T.world.Seed);
probe('Seed "1,234" unquoted (columns shift: value becomes 1)', { settings: se.replace(/^Seed,,/m, 'Seed,1,234,') }, T => T.world.Seed);
probe('WorldWidth "300.0"', wE('WorldWidth', '300.0'), T => T.world.WorldWidth);
probe('WorldWidth "30%"', wE('WorldWidth', '30%'), T => T.world.WorldWidth);
probe('StartBunnies "150%"', wE('StartBunnies', '150%'), T => T.world.StartBunnies);
probe('Seed "40%"', wE('Seed', '40%'), T => T.world.Seed);
probe('Duplicate setting row WorldWidth (second wins?)', { settings: se.trimEnd() + '\nWorldWidth,10,\n' }, T => T.world.WorldWidth);
probe('Bunny Walk "NaN"', sE('WalkSpeed', 'Bunny', 'NaN'), T => T.bunny.WalkSpeed);
probe('Bunny Walk "Infinity"', sE('WalkSpeed', 'Bunny', 'Infinity'), T => T.bunny.WalkSpeed);
probe('Bunny Walk "1e999"', sE('WalkSpeed', 'Bunny', '1e999'), T => T.bunny.WalkSpeed);
probe('Bunny Walk "#REF!"', sE('WalkSpeed', 'Bunny', '#REF!'), T => T.bunny.WalkSpeed);
probe('Bunny Walk "$2" / "2 tiles"', sE('WalkSpeed', 'Bunny', '2 tiles'), T => T.bunny.WalkSpeed);
probe('Bunny Walk "−2" (unicode minus)', sE('WalkSpeed', 'Bunny', '−2'), T => T.bunny.WalkSpeed);
probe('Bunny Walk "2 " (nbsp)', sE('WalkSpeed', 'Bunny', '2 '), T => T.bunny.WalkSpeed);
probe('Percent sign fullwidth "70％"', sE('HungryAt', 'Bunny', '70％'), T => T.bunny.HungryAt);
probe('Bunny Wolf-only SprintRange filled in', sE('SprintRange', 'Bunny', '3'), T => T.bunny.SprintRange);
probe('Wolf BiteSize filled in (non-needed)', sE('BiteSize', 'Wolf', '1'), T => T.wolf.BiteSize);
probe('Grass WalkSpeed filled in', sE('WalkSpeed', 'Grass', '1'), T => T.grass.WalkSpeed);
probe('Glyph two chars for Bunny "αα"', sE('Glyph', 'Bunny', 'αα'), T => T.bunny.Glyph);
probe('Glyph multi-codepoint grass emoji', sE('Glyph', 'Grass', '🌱 🌿 🌳'), T => T.grass.Glyph);
probe('states: Grass with number Priority', { states: st.replace('Grass,—,GROW', 'Grass,1,GROW') }, T => T.states.grass.map(s => [s.name, s.priority]));
probe('states: species typo "Bunnny"', { states: st.replace('Bunny,6,WANDER', 'Bunnny,6,WANDER') }, T => Object.keys(T.states));
probe('states: Wolf has no states at all', { states: st.split('\n').filter(l => !l.startsWith('Wolf')).join('\n') }, T => Object.keys(T.states));
probe('states: Bunny has no REST/WANDER (no fallback)', { states: st.split('\n').filter(l => !/WANDER/.test(l)).join('\n') }, T => T.states.bunny.map(s => s.name));
probe('states: unknown state name "DANCE"', { states: st.replace('WANDER', 'DANCE') }, T => T.states.bunny.map(s => s.name));
probe('states: Priority "abc"', { states: st.replace('Bunny,2,EAT', 'Bunny,abc,EAT') }, T => T.states.bunny.map(s => s.name));
probe('states: Priority negative', { states: st.replace('Bunny,2,EAT', 'Bunny,-1,EAT') }, T => T.states.bunny.map(s => s.name));
probe('states: priority "1%"', { states: st.replace('Bunny,2,EAT', 'Bunny,2%,EAT') }, T => T.states.bunny.map(s => s.name));
probe('variables.csv: row w/o "Applies to" value', { variables: base.variables.replace('Bunny Wolf,0 – FullnessMax', ',0 – FullnessMax') }, T => T.variables[0].appliesTo);
probe('species: header missing Notes column (ok?)', { species: sp.split('\n').map(l => l.split(',').slice(0, 5).join(',')).join('\n') }, T => T.bunny.WalkSpeed);
probe('species: only a header row', { species: 'Stat,Unit,Bunny,Wolf,Grass,Notes\n' }, T => 0);
probe('species: short row (fewer cells than header)', { species: sp.replace('WalkSpeed,tiles/s,2,2.5,,Free movement', 'WalkSpeed,tiles/s,2') }, T => [T.bunny.WalkSpeed, T.wolf.WalkSpeed]);
probe('species: Unit column lost % (HungryAt, unit "") with value 70', { species: sp.replace('HungryAt,% of FullnessMax', 'HungryAt,') }, T => T.bunny.HungryAt);
probe('species: Unit renamed "percent of FullnessMax" value 70', { species: sp.replace('HungryAt,% of FullnessMax', 'HungryAt,percent of FullnessMax') }, T => T.bunny.HungryAt);
probe('species: Unit "%" only for BabySpeed 50 (ratio) vs 150', sE('BabySpeed', 'Bunny', '150'), T => T.bunny.BabySpeed);
probe('species: ElderSpeed 150% (faster than adult)', sE('ElderSpeed', 'Bunny', '150'), T => T.bunny.ElderSpeed);
probe('species: SprintSpeed < WalkSpeed', sE('SprintSpeed', 'Bunny', '1'), T => T.bunny.SprintSpeed);
probe('species: HealAbove 100 / MateFullness 0', sE('MateFullness', 'Bunny', '0'), T => T.bunny.MateFullness);
probe('species: LitterSize "3" single', sE('LitterSize', 'Bunny', '3'), T => T.bunny.LitterSize);
probe('species: litter "2-4" with NBSP', sE('LitterSize', 'Bunny', '2 - 4'), T => T.bunny.LitterSize);
probe('species: Tab-separated file (Numbers TSV export) ', { species: sp.replace(/,/g, '\t') }, T => 0);
probe('species: semicolon-separated (European Excel CSV)', { species: sp.replace(/,/g, ';') }, T => 0);
probe('species: header case "stat"', { species: sp.replace('Stat,', 'stat,') }, T => 0);
probe('species: Stat name case "walkspeed"', { species: sp.replace('WalkSpeed,', 'walkspeed,') }, T => 0);
probe('species: Stat name with trailing space "WalkSpeed "', { species: sp.replace('WalkSpeed,', 'WalkSpeed ,') }, T => T.bunny.WalkSpeed);
probe('species: Stat cell written "Walk Speed"', { species: sp.replace('WalkSpeed,', 'Walk Speed,') }, T => 0);
console.log(`\nSUMMARY: ${pass} passed, ${fail} failed, ${pass + fail} checks`);
