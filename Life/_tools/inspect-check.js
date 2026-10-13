'use strict';
const { load } = require('./harness.js');
const { AS: A, texts } = load({}, ['inspect', 'ui-parts']);
// The page starts in imperial; these checks read metric, and the Units block below switches.
const UNITS_DEFAULT = A.units.system;
A.units.set('metric');
const { T } = A.parseTables(texts);
let bad = 0;
const check = (c, m) => { console.log((c ? 'PASS: ' : 'FAIL: ') + m); if (!c) bad++; };
const allValues = [];
const names = d => d.rows.map(r => r.name).join(',');
const val = (d, n) => d.rows.find(r => r.name === n).value;
const sim = A.Sim(T, 7), W = sim.W, K = A.KIND;
const empties = []; for (let t = 0; t < W.n && empties.length < 20; t++) if (W.isBare(t) && !W.hole[t]) empties.push(t);
const grassT = W.gList[0];
check(A.describe(sim, null) === null, 'null selection -> null');

// blade
const sel = t => ({ tile: t, serial: W.serial[t], slot: -1 });
for (let i = 0; i < 100; i++) sim.tick();
let d = A.describe(sim, sel(grassT)); allValues.push(d);
check(names(d) === 'Age,Lifestage,Dead,Size,Burning,Tile,Position,Elevation,Ground,Ash,Roots', 'blade rows: ' + names(d));
check(val(d, 'Age') === W.gAge[grassT].toFixed(2), 'blade age ' + val(d, 'Age'));
check(val(d, 'Size') === W.gSize[grassT].toFixed(2), 'blade size ' + val(d, 'Size'));
check(val(d, 'Dead') === 'No' && val(d, 'Position') === W.tx(grassT) + ', ' + W.ty(grassT), 'blade dead/position');
check(/^Blade of grass #\d+$/.test(d.title), 'blade title: ' + d.title);
// fire: a burning blade shows how far through its burn it is, and its tile is "On fire"
check(val(d, 'Burning') === 'No' && val(d, 'Ground') === 'Ground', 'not burning: Burning No, Ground ' + val(d, 'Ground'));
check(val(d, 'Ash') === 'None', 'no ash: ' + val(d, 'Ash'));
W.ash[grassT] = 0.5; check(val(A.describe(sim, sel(grassT)), 'Ash') === '0.50', 'ash shows its amount: ' + val(A.describe(sim, sel(grassT)), 'Ash')); W.ash[grassT] = 0;
check(A.ignite(sim, grassT), 'ignite takes the blade');
d = A.describe(sim, sel(grassT));
check(val(d, 'Burning') === '0%' && val(d, 'Ground') === 'On fire', 'just lit: Burning ' + val(d, 'Burning') + ', Ground ' + val(d, 'Ground'));
W.fireAge[grassT] = W.fireTime[grassT] * 0.42;
check(val(A.describe(sim, sel(grassT)), 'Burning') === '42%', 'Burning follows fireStage: ' + val(A.describe(sim, sel(grassT)), 'Burning'));
W.removeFire(grassT);
check(val(A.describe(sim, sel(grassT)), 'Burning') === 'No', 'put out: Burning No again');
const e = empties[0];
W.addGrass(e, 0, 0);
check(val(A.describe(sim, sel(e)), 'Lifestage') === 'Sprout', 'new blade Sprout');
W.gAge[e] = T.grass.TimeToMature;
check(val(A.describe(sim, sel(e)), 'Lifestage') === 'Mature', 'blade Mature at TimeToMature');
W.gAge[e] = T.grass.ElderAt ? T.grass.ElderAt * T.grass.Lifespan : 1e6;
check(T.grass.ElderAt == null || val(A.describe(sim, sel(e)), 'Lifestage') === 'Elder', 'blade Elder');
const v0 = T.variables.find(v => v.name === 'Size');
check(d.rows[3].range === v0.range && d.rows[3].tip === 'Up: ' + v0.up + '. Down: ' + v0.down + '. At the limit: ' + v0.limit + '.', 'tip format: ' + d.rows[3].tip);
const posRow = d.rows.find(r => r.name === 'Position');
check(posRow.tip === '', 'Position tip empty: "' + posRow.tip + '"');

// corpse
const ce = empties[1];
W.addCorpse(ce, A.SPECIES.WOLF); A.corpseAdded(sim, ce);
d = A.describe(sim, sel(ce)); allValues.push(d);
check(names(d) === 'Age,Lifestage,Dead,Nutrient,Burning,Cause,Meat,Tile,Position,Elevation,Ground,Ash,Roots', 'corpse rows: ' + names(d));
check(/^Wolf corpse #\d+$/.test(d.title), 'corpse title: ' + d.title);
check(val(d, 'Lifestage') === '—' && val(d, 'Dead') === 'Yes' && val(d, 'Age') === '0.00', 'corpse values');
const CN = T.wolf.CorpseNutrient, cnText = m => String(m % 1 ? m.toFixed(1) : m);
check(val(d, 'Nutrient') === `${CN.toFixed(1)} / ${cnText(CN)}`, 'nutrient ' + val(d, 'Nutrient'));
W.cNut[ce] = 12.34;
check(val(A.describe(sim, sel(ce)), 'Nutrient') === `12.3 / ${cnText(CN)}`, 'nutrient decimals');

// cause of death: every cause is recorded on the corpse and put in words
{
  const C = A.CAUSE, words = [[C.OLD_AGE, 'Old age'], [C.STARVED, 'Starved'], [C.THIRST, 'Died of thirst'], [C.STARVED_THIRSTY, 'Starved and thirsty'],
    [C.DEBUG, 'Dropped (debug)'], [C.ATTACKED + A.SPECIES.WOLF, 'Attacked by a wolf'], [C.ATTACKED + A.SPECIES.HUMAN, 'Attacked by a human']];
  for (const [v, text] of words) { W.cCause[ce] = v; check(val(A.describe(sim, sel(ce)), 'Cause') === text, 'cause ' + v + ' reads "' + text + '"'); }
  W.cCause[ce] = 0;
}

// meat: a bunny's carcass shows what is left of MeatOnBody; a wolf's has none to begin with
const MW = T.wolf.MeatOnBody, MB = T.bunny.MeatOnBody, mtext = m => String(m % 1 ? m.toFixed(1) : m);
check(val(d, 'Meat') === `${MW.toFixed(1)} / ${mtext(MW)}`, 'wolf corpse meat ' + val(d, 'Meat'));
const cb = empties[19];
W.addCorpse(cb, A.SPECIES.BUNNY); A.corpseAdded(sim, cb);
check(val(A.describe(sim, sel(cb)), 'Meat') === `${MB.toFixed(1)} / ${mtext(MB)}`, 'bunny corpse meat starts at MeatOnBody');
W.cMeat[cb] = 12.34;
check(val(A.describe(sim, sel(cb)), 'Meat') === `12.3 / ${mtext(MB)}`, 'meat decimals');

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
const R = 'Fullness,Water,Wellbeing,Stamina,HP,Alight,Age,Lifestage,Dead,State,Target,Sex,';
const TILE = ',Tile,Position,Elevation,Ground,Ash,Roots';   // every selection ends with the tile under it
const RB = R;
const dbm = A.describe(sim, selA(bm)), dbf = A.describe(sim, selA(bf)), dwm = A.describe(sim, selA(wm)), dwf = A.describe(sim, selA(wf));
allValues.push(dbm, dbf, dwm, dwf);
check(names(dbm) === RB + 'Parents,Children,InHole' + TILE, 'male bunny: ' + names(dbm));
check(names(dbf) === RB + 'Pregnant,MateCooldown,Parents,Children,InHole' + TILE, 'female bunny: ' + names(dbf));
check(names(dwm) === R + 'Parents,Children,Kills' + TILE, 'male wolf: ' + names(dwm));
check(names(dwf) === R + 'Pregnant,MateCooldown,Parents,Children,Kills' + TILE, 'female wolf: ' + names(dwf));
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
check(val(dbm, 'Alight') === 'No', 'not alight: Alight No');
W.aAlight[bm] = 3.25; check(val(A.describe(sim, selA(bm)), 'Alight') === '3.3 hours left' || val(A.describe(sim, selA(bm)), 'Alight') === '3.2 hours left', 'alight: hours left ' + val(A.describe(sim, selA(bm)), 'Alight'));
W.aAlight[bm] = 0;
W.aAge[bf] = 0.5; check(val(A.describe(sim, selA(bf)), 'Lifestage') === 'Baby', 'baby');
W.aAge[bf] = 19; check(val(A.describe(sim, selA(bf)), 'Lifestage') === 'Elder', 'elder');
// holes: a bare hole is selectable and shows its own rows; a bunny says whether it is in one
const ht = empties[10];
W.addHole(ht, 0);
const hsel = { tile: ht, serial: W.serial[ht], slot: -1, hole: true };
const dh = A.describe(sim, hsel); allValues.push(dh);
check(dh.title === 'Warren hole' && names(dh) === 'LastUsed,Tile,Position,Elevation,Ground,Ash,Roots', 'hole rows: ' + dh.title + ' / ' + names(dh));
W.holeUsedAt[ht] = sim.simSeconds - 1.5 * A.DAY_SECONDS;
check(val(A.describe(sim, hsel), 'LastUsed') === '1.50 days ago', 'hole LastUsed ' + val(A.describe(sim, hsel), 'LastUsed'));
check(val(dbm, 'InHole') === 'No', 'bunny InHole off a hole');
W.addHole(W.aTile[bm], 0);
check(val(A.describe(sim, selA(bm)), 'InHole') === 'Yes', 'bunny InHole on a hole');
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

// humans: the animal rows that apply (State, Target, Kills...), but none of a breeder's
{
  const hs = A.Sim(T, 3), HW = hs.W;
  let ht = -1; for (let t = 0; t < HW.n; t++) if (HW.isBare(t) && !HW.hole[t] && HW.tx(t) < HW.w - 10 && [2, 6, 9].every(d => HW.isBare(t + d))) { ht = t; break; }
  for (const sex of [0, 1]) {
    const slot = A.spawnStarting(hs, A.SPECIES.HUMAN, ht + sex * 2); HW.aSex[slot] = sex;
    const hd = A.describe(hs, { tile: HW.aTile[slot], serial: HW.aSerial[slot], slot }); allValues.push(hd);
    check(/^(Male|Female) human #\d+$/.test(hd.title), 'human title: ' + hd.title);
    const nm = names(hd);
    check(['Fullness', 'Stamina', 'HP', 'State', 'Target', 'Kills'].every(n => nm.includes(n)), 'human rows: ' + nm);
    check(!/Pregnant|MateCooldown|Parents|Children/.test(nm), `a ${sex ? 'female' : 'male'} human has no breeding rows`);
    check(/^[A-Z_]+$/.test(val(hd, 'State')) || val(hd, 'State') === '—', 'human state shown: ' + val(hd, 'State'));
  }
  const wf = A.spawnStarting(hs, A.SPECIES.WOLF, ht + 6); HW.aSex[wf] = 1;
  check(/Pregnant/.test(names(A.describe(hs, { tile: HW.aTile[wf], serial: HW.aSerial[wf], slot: wf }))), 'a female wolf still has Pregnant');
  HW.removeAnimal(wf);
  A.debugDropCorpse(hs, ht + 9, A.SPECIES.HUMAN);
  const cd = A.describe(hs, { tile: ht + 9, serial: HW.serial[ht + 9], slot: -1 });
  check(/^Human corpse #\d+$/.test(cd.title) && val(cd, 'Meat') === T.human.MeatOnBody.toFixed(1) + ' / ' + T.human.MeatOnBody, 'human corpse: ' + cd.title + ' ' + val(cd, 'Meat'));
}
// An empty tile, picked directly (Inspect Empty Tiles): only the tile's rows.
{ let et = -1; for (let t = 0; t < W.n && et < 0; t++) if (W.isBare(t) && !W.hole[t]) et = t;
  const de = A.describe(sim, { tile: et, serial: 0, slot: -1, empty: true }); allValues.push(de);
  check(de.title === 'Tile ' + W.tx(et) + ', ' + W.ty(et) && names(de) === 'Position,Elevation,Ground,Ash,Roots' && /^\d+(\.\d)? m$/.test(val(de, 'Elevation')), 'empty tile: ' + de.title + ' / ' + names(de) + ' / ' + val(de, 'Elevation')); }
// Units: Elevation and Depth follow AS.units (imperial by default; the sim's meters, converted on the way out).
check(UNITS_DEFAULT === 'imperial', 'the page starts in imperial');
{ const t0 = empties.find(t => W.kind[t] === K.EMPTY), el = W.elev[t0], se = { tile: t0, serial: 0, slot: -1, empty: true };
  const metric = val(A.describe(sim, se), 'Elevation');
  A.units.set('imperial');
  const feet = val(A.describe(sim, se), 'Elevation');
  W.wDepth[t0] = 1; W.flow[t0] = A.FLOW.WATER; const deep = val(A.describe(sim, { tile: t0, serial: 0, slot: -1 }), 'Depth'); W.wDepth[t0] = 0; W.flow[t0] = A.FLOW.NONE;
  A.units.set('metric');
  check(metric === A.units.length(el, 1) && /m$/.test(metric) && /^-?[\d,]+\.\d ft$/.test(feet), 'Elevation reads in m, then in ft: ' + metric + ' / ' + feet);
  check(Math.abs(parseFloat(feet.replace(/,/g, '')) - el / 0.3048) < 0.06, 'the feet are the meters converted');
  check(deep === '3.28 ft', 'Depth of 1 m reads 3.28 ft when imperial: ' + deep); }
const bads = []; for (const x of allValues) for (const r of x.rows) if (!r.heading && (/NaN|undefined/.test(r.value + r.tip + r.range) || r.value === '')) bads.push(r.name);
check(bads.length === 0, 'no NaN/undefined/empty values ' + bads);
console.log(bad ? 'FAILED ' + bad : 'ALL PASS');
process.exit(bad ? 1 : 0);
