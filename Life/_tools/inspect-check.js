'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { load, SIM_FILES } = require('./harness.js');
const ROOT = path.resolve(__dirname, '..');
const { AS, texts } = load();
const ctx = vm.getContext ? null : null;
// harness's context isn't exposed; run glyphs + inspect in AS's own realm via a fresh context
const vctx = vm.createContext({ console, crypto: globalThis.crypto });
vm.runInContext('globalThis.AS = { V: 0 };', vctx);
for (const f of [...SIM_FILES, 'inspect']) {
  const file = path.join(ROOT, 'js', f + '.js');
  vm.runInContext(fs.readFileSync(file, 'utf8'), vctx, { filename: file });
}
const A = vctx.AS;
const { T } = A.parseTables(texts);
let bad = 0;
const check = (c, m) => { console.log((c ? 'PASS: ' : 'FAIL: ') + m); if (!c) bad++; };
const allValues = [];
const names = d => d.rows.map(r => r.name).join(',');
const val = (d, n) => d.rows.find(r => r.name === n).value;
const sim = A.Sim(T, 7), W = sim.W, K = A.KIND;
const empties = []; for (let t = 0; t < W.n && empties.length < 20; t++) if (W.kind[t] === K.EMPTY) empties.push(t);
const grassT = W.gList[0];
check(A.describe(sim, null) === null, 'null selection -> null');

// blade
const sel = t => ({ tile: t, serial: W.serial[t], slot: -1 });
for (let i = 0; i < 100; i++) sim.tick();
let d = A.describe(sim, sel(grassT)); allValues.push(d);
check(names(d) === 'Age,Lifestage,Dead,Position,Size', 'blade rows: ' + names(d));
check(val(d, 'Age') === W.gAge[grassT].toFixed(2), 'blade age ' + val(d, 'Age'));
check(val(d, 'Size') === W.gSize[grassT].toFixed(2), 'blade size ' + val(d, 'Size'));
check(val(d, 'Dead') === 'No' && val(d, 'Position') === W.tx(grassT) + ', ' + W.ty(grassT), 'blade dead/position');
check(/^Blade of grass #\d+$/.test(d.title), 'blade title: ' + d.title);
const e = empties[0];
W.addGrass(e, 0, 0);
check(val(A.describe(sim, sel(e)), 'Lifestage') === 'Sprout', 'new blade Sprout');
W.gAge[e] = T.grass.TimeToMature;
check(val(A.describe(sim, sel(e)), 'Lifestage') === 'Mature', 'blade Mature at TimeToMature');
W.gAge[e] = T.grass.ElderAt ? T.grass.ElderAt * T.grass.Lifespan : 1e6;
check(T.grass.ElderAt == null || val(A.describe(sim, sel(e)), 'Lifestage') === 'Elder', 'blade Elder');
const v0 = T.variables.find(v => v.name === 'Size');
check(d.rows[4].range === v0.range && d.rows[4].tip === 'Up: ' + v0.up + '. Down: ' + v0.down + '. At the limit: ' + v0.limit + '.', 'tip format: ' + d.rows[4].tip);
check(d.rows[3].tip === '', 'Position tip empty: "' + d.rows[3].tip + '"');

// corpse
const ce = empties[1];
W.addCorpse(ce, A.SPECIES.WOLF); A.corpseAdded(sim, ce);
d = A.describe(sim, sel(ce)); allValues.push(d);
check(names(d) === 'Age,Lifestage,Dead,Position,Nutrient', 'corpse rows: ' + names(d));
check(/^Wolf corpse #\d+$/.test(d.title), 'corpse title: ' + d.title);
check(val(d, 'Lifestage') === '—' && val(d, 'Dead') === 'Yes' && val(d, 'Age') === '0.00', 'corpse values');
const CN = T.wolf.CorpseNutrient, cnText = m => String(m % 1 ? m.toFixed(1) : m);
check(val(d, 'Nutrient') === `${CN.toFixed(1)} / ${cnText(CN)}`, 'nutrient ' + val(d, 'Nutrient'));
W.cNut[ce] = 12.34;
check(val(A.describe(sim, sel(ce)), 'Nutrient') === `12.3 / ${cnText(CN)}`, 'nutrient decimals');

// animals
const mk = (t, sp, sx) => {
  const s = W.addAnimal(t, sp, sx); const Tsp = T[A.SPECIES_KEY[sp]];
  // Age: the middle of adulthood for this species, from the tables, so tuning Lifespan or
  // TimeToMature can't turn the test animal into a baby or an elder.
  W.aFullness[s] = 62.34; W.aStamina[s] = 10; W.aHP[s] = Tsp.HPMax;
  W.aAge[s] = (Tsp.TimeToMature + Tsp.ElderAt * Tsp.Lifespan) / 2; W.aState[s] = 1;
  return s;
};
const selA = s => ({ tile: W.aTile[s], serial: W.aSerial[s], slot: s });
const bm = mk(empties[2], 0, 0), bf = mk(empties[3], 0, 1), wm = mk(empties[4], 1, 0), wf = mk(empties[5], 1, 1);
const R = 'Fullness,Stamina,HP,Age,Lifestage,Dead,State,Target,Position,Sex,';
const dbm = A.describe(sim, selA(bm)), dbf = A.describe(sim, selA(bf)), dwm = A.describe(sim, selA(wm)), dwf = A.describe(sim, selA(wf));
allValues.push(dbm, dbf, dwm, dwf);
check(names(dbm) === R + 'Parents,Children', 'male bunny: ' + names(dbm));
check(names(dbf) === R + 'Pregnant,MateCooldown,Parents,Children', 'female bunny: ' + names(dbf));
check(names(dwm) === R + 'Parents,Children,Kills', 'male wolf: ' + names(dwm));
check(names(dwf) === R + 'Pregnant,MateCooldown,Parents,Children,Kills', 'female wolf: ' + names(dwf));
check(dbf.title.startsWith('Female bunny #') && dwm.title.startsWith('Male wolf #'), 'titles ' + dbf.title + ' / ' + dwm.title);
const TB = T.bunny, maxText = m => String(m % 1 ? m.toFixed(1) : m);
check(val(dbm, 'Fullness') === `62.3 / ${maxText(TB.FullnessMax)}` && val(dbm, 'HP') === `${TB.HPMax.toFixed(1)} / ${maxText(TB.HPMax)}`,
  'fullness/hp ' + val(dbm, 'Fullness') + ' ' + val(dbm, 'HP'));
check(val(dbm, 'Age') === W.aAge[bm].toFixed(2) && val(dbm, 'Lifestage') === 'Adult' && val(dbm, 'Dead') === 'No', 'age/stage/dead ' + val(dbm, 'Age') + ' ' + val(dbm, 'Lifestage'));
check(val(dbm, 'State') === T.states.bunny[1].name, 'state ' + val(dbm, 'State'));
check(val(dbm, 'Sex') === 'Male' && val(dbf, 'Sex') === 'Female', 'sex');
check(val(dbf, 'Pregnant') === 'No' && val(dbf, 'MateCooldown') === 'Ready', 'pregnant/cooldown none');
W.aPregnant[bf] = 1.3; W.aMateCd[bf] = 0.4; W.aParentA[bf] = 5; W.aParentB[bf] = 1234; W.aChildren[bf] = 12345; W.aKills[wf] = 3;
let d2 = A.describe(sim, selA(bf));
check(val(d2, 'Pregnant') === '1.30 days left' && val(d2, 'MateCooldown') === '0.40 days left', 'pregnant text ' + val(d2, 'Pregnant'));
check(val(d2, 'Parents') === '#5 and #1234' && val(dbm, 'Parents') === 'None (first generation)' && val(d2, 'Children') === '12,345', 'parents/children');
W.aAge[bf] = 0.5; check(val(A.describe(sim, selA(bf)), 'Lifestage') === 'Baby', 'baby');
W.aAge[bf] = 19; check(val(A.describe(sim, selA(bf)), 'Lifestage') === 'Elder', 'elder');
// targets
check(val(dbm, 'Target') === 'None', 'target none');
W.aTargetTile[bm] = W.aTile[wm]; W.aTargetSlot[bm] = wm; W.aTargetSerial[bm] = W.aSerial[wm];
let tg = val(A.describe(sim, selA(bm)), 'Target');
check(tg === `Wolf #${W.aSerial[wm]} at ${W.tx(W.aTile[wm])}, ${W.ty(W.aTile[wm])}`, 'live target: ' + tg);
const keepTile = W.aTile[wm]; W.removeAnimal(wm);
tg = val(A.describe(sim, selA(bm)), 'Target'); check(/gone/.test(tg), 'dead target: ' + tg);
W.aTargetTile[bm] = grassT; W.aTargetSlot[bm] = -1;
check(/^Blade at \d+, \d+$/.test(val(A.describe(sim, selA(bm)), 'Target')), 'blade target');
W.aTargetTile[bm] = empties[10];
check(/^Tile \d+, \d+$/.test(val(A.describe(sim, selA(bm)), 'Target')), 'tile target');
allValues.push(A.describe(sim, selA(bm)), A.describe(sim, selA(wf)), d2);

// warnings
check(A.inspectWarnings(T).length === 0, 'real CSV no warnings: ' + JSON.stringify(A.inspectWarnings(T)));
const t2 = A.parseTables({ ...texts, variables: texts.variables + '\nFoo,Dynamic,Grass,0,,,\nBar,Dynamic,Zebra,0,,,\n' }).T;
const w = A.inspectWarnings(t2);
check(w.length === 3 && /"Foo"/.test(w[0]) && /zebra/.test(w[2]), 'fake variable and token: ' + JSON.stringify(w));
const dg = A.describe(A.Sim(t2, 1), (() => { const s = A.Sim(t2, 1); return null; })());
const s2 = A.Sim(t2, 1); const g2 = s2.W.gList[0];
const dd = A.describe(s2, { tile: g2, serial: s2.W.serial[g2], slot: -1 });
check(dd.rows.some(r => r.name === 'Foo' && r.value === '—') && !dd.rows.some(r => r.name === 'Bar'), 'unread row shows —, unknown token never matches');

const bads = []; for (const x of allValues) for (const r of x.rows) if (/NaN|undefined/.test(r.value + r.tip + r.range) || r.value === '') bads.push(r.name);
check(bads.length === 0, 'no NaN/undefined/empty values ' + bads);
console.log(bad ? 'FAILED ' + bad : 'ALL PASS');
process.exit(bad ? 1 : 0);
