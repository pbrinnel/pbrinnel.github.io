// Runs Life/js/ui.js (and the parts it is built from) against a minimal fake DOM. Counts every write.
const vm = require('vm'), fs = require('fs'), assert = require('assert');
let writes = 0;
class ClassList {
  constructor(o) { this.o = o; this.s = new Set(); }
  toggle(c, on) { const had = this.s.has(c); on = on === undefined ? !had : on; writes++; on ? this.s.add(c) : this.s.delete(c); this.o._cls = [...this.s].join(' '); }
  add(c) { this.toggle(c, true); }
  contains(c) { return this.s.has(c); }
}
class El {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this._text = ''; this._hidden = false; this._cls = ''; this.listeners = {}; this.classList = new ClassList(this); this.style = { setProperty() { writes++; } }; }
  set textContent(v) { writes++; this._text = String(v); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  set className(v) { writes++; this._cls = v; this.classList.s = new Set(v.split(/\s+/).filter(Boolean)); }
  get className() { return this._cls; }
  set hidden(v) { writes++; this._hidden = !!v; } get hidden() { return this._hidden; }
  set title(v) { writes++; this._title = v; }
  appendChild(c) { writes++; this.children.push(c); c.parent = this; return c; }
  get parentNode() { return this.parent || null; }
  setAttribute(k, v) { (this.attrs || (this.attrs = {}))[k] = String(v); }
  getBoundingClientRect() { return { left: this.rect ? this.rect.left : 0, top: this.rect ? this.rect.top : 0, width: parseFloat(this.style.width) || (this.rect && this.rect.width) || 300, height: parseFloat(this.style.height) || (this.rect && this.rect.height) || 200 }; }
  setPointerCapture() {}
  getAttribute(k) { return this.attrs && k in this.attrs ? this.attrs[k] : null; }
  replaceWith(n) { if (this.parent) this.parent.children = this.parent.children.map(c => c === this ? n : c); n.parent = this.parent; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null; }
  append(...cs) { for (const c of cs) { writes++; const k = typeof c === 'string' ? Object.assign(new El('#text'), { _text: c }) : c; k.parent = this; this.children.push(k); } }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  blur() {}
  fire(t, e = {}) { (this.listeners[t] || []).forEach(f => f(e)); }
  all(p, out = []) { if (p(this)) out.push(this); this.children.forEach(c => c.all(p, out)); return out; }
}
let LS;   // what the page sees as localStorage (undefined: none, which the page copes with)
function build(debug, extra = {}, win = {}) {
  const ids = { hud: new El('div'), errors: new El('div'), inspector: new El('aside'), graph: new El('aside') };
  ids.graph._hidden = true;
  ids.errors._hidden = true; ids.inspector._hidden = true;
  const body = new El('body');
  const doc = { createElement: t => new El(t), getElementById: i => ids[i], body, listeners: {},
    addEventListener(t, f) { (this.listeners[t] ||= []).push(f); } };
  const ctx = { document: doc, globalThis: null, AS: {}, localStorage: LS, ...win }; ctx.globalThis = ctx;
  vm.createContext(ctx);
  // ui.js builds its debug tools from the species list, which world.js owns.
  vm.runInContext(fs.readFileSync(require('path').join(__dirname, '../js/world.js'), 'utf8'), ctx);
  for (const f of ['weather']) vm.runInContext(fs.readFileSync(require('path').join(__dirname, '../js/' + f + '.js'), 'utf8'), ctx);
  for (const f of ['ui-parts', 'cards', 'properties', 'paint-tab', 'ui']) vm.runInContext(fs.readFileSync(require('path').join(__dirname, '../js/' + f + '.js'), 'utf8'), ctx);
  const calls = [], tools = [];
  const speeds = [0, 1, 2, 5, 20, Infinity];
  const ui = ctx.AS.UI({ debug, speeds, onSpeed: i => calls.push(i), onDebugTool: m => tools.push(m), onCloseInspector: () => calls.push('closed'), onBench: () => calls.push('bench'), onGraph: () => calls.push('graph'), onMinimap: () => calls.push('map'), ...extra });
  return { ui, ids, doc, calls, tools, body, ctx };
}
// The speed buttons only (not the tabs, Hide UI or the debug tools).
const btns = (ids) => ids.hud.all(e => e.className === 'hud-speeds')[0].children;
let n = 0; const ok = m => console.log('ok', ++n, m);
const input = { speedIndex: 1, achieved: 1, day: 3.24, seed: 1234567, counts: { bunnies: 0, wolves: 0, humans: 0, total: 0, blades: 23999, corpses: 1234567, fires: 0 } };

{ const { ui, ids } = build(true);   // with ?debug, so the seed (Debug tab) is on the page
  ui.hud(input); const w = writes; ui.hud(input);
  assert.strictEqual(writes, w); ok('second identical hud() writes nothing');
  const txt = ids.hud.textContent;
  assert(txt.includes('23,999') && txt.includes('1,234,567')); ok('thousands separators');
  assert(txt.includes('Day 3.2') && txt.includes('Seed 1234567')); ok('day and seed');
  const b = btns(ids); assert.strictEqual(b.length, 6);
  assert.deepStrictEqual(b.map(x => x._title || x.title), ['Pause', '1×', '2×', '5×', '20×', 'Max']); ok('speed labels (icons, named in their titles)');
  assert(b[1].classList.contains('on') && !b[0].classList.contains('on')); ok('active highlighted');
  ui.hud({ ...input, speedIndex: 4, achieved: 14.2 });
  assert(ids.hud.textContent.includes('20× (14×)')); ok('a speed shows what it is keeping');
  ui.hud({ ...input, speedIndex: 2, achieved: 1.96 });
  assert(ids.hud.textContent.includes('2× (2×)')); ok('one decimal under ten');
  ui.hud({ ...input, speedIndex: 0, achieved: 0 });
  assert(ids.hud.textContent.includes('Pause') && !ids.hud.textContent.includes('Pause (')); ok('paused shows no figure');
  ui.hud({ ...input, speedIndex: 5, achieved: 312.4 });
  assert(ids.hud.textContent.includes('Max (312×)')); ok('Max shows achieved multiple');
  { const plain = build(false).ids; assert(plain.hud.all(e => e.className.split(' ').includes('hud-tool')).length === 0); } ok('no debug tools when debug false');
}
{ const { ui, ids, doc, calls } = build(false);
  const b = btns(ids); b[3].fire('click'); b[0].fire('click');
  assert.deepStrictEqual(calls, [3, 0]); ok('buttons call onSpeed with index');
  calls.length = 0; ui.hud({ ...input, speedIndex: 3 });
  const kd = e => doc.listeners.keydown.forEach(f => f({ ctrlKey: false, metaKey: false, altKey: false, target: {}, preventDefault() {}, ...e }));
  kd({ key: ' ' }); kd({ key: ' ' }); kd({ key: '5' });
  assert.deepStrictEqual(calls, [0, 3, 4]); ok('Space toggles pause/last speed; key 5 picks index 4');
  kd({ key: '2', target: { tagName: 'INPUT' } }); assert.strictEqual(calls.length, 3); ok('keys ignored in text fields');
}
{ const { ui, ids } = build(true);
  const tools = ids.hud.all(e => e.className.split(' ').includes('hud-tool'));
  assert.deepStrictEqual(tools.map(t => t.textContent), ['Select', 'Drop bunny body', 'Drop wolf body', 'Drop human body']); ok('debug tools exist');
}
{ const { tools, ids } = (() => { const r = build(true); return { tools: r.tools, ids: r.ids }; })();
  const t = ids.hud.all(e => e.className.split(' ').includes('hud-tool')); t[1].fire('click'); t[2].fire('click'); t[3].fire('click');
  assert.deepStrictEqual(tools, ['corpse-bunny', 'corpse-wolf', 'corpse-human']); ok('debug tools call onDebugTool');
}
{ const { ui, ids } = build(false);
  const errs = ['settings.csv row 3, column Seed: not a number <b>x</b>', 'species.csv row 2: bad'];
  ui.errors(errs, ['extra column Foo']);
  assert.strictEqual(ids.errors.hidden, false);
  const t = ids.errors.textContent;
  for (const m of [...errs, 'extra column Foo']) assert(t.includes(m));
  ok('errors() unhides and lists every message via textContent');
  ui.warnings(['a', 'b']);
  assert(ids.hud.all(e => e.className === 'hud-warn')[0].textContent === '2 table warnings'); ok('warnings count');
}
{ const { ui, ids, doc, calls } = build(false);
  ui.hud({ ...input, speedIndex: 1 });
  const b = btns(ids);
  b[4].fire('click'); ui.hud({ ...input, speedIndex: 4 });
  assert(b[4].classList.contains('on') && !b[1].classList.contains('on')); ok('click then hud() moves highlight');
  b[0].fire('click'); ui.hud({ ...input, speedIndex: 0, achieved: 0 });
  assert(b[0].classList.contains('on') && !b[4].classList.contains('on')); ok('click Pause moves highlight');
  const kd = e => doc.listeners.keydown.forEach(f => f({ ctrlKey: false, metaKey: false, altKey: false, target: {}, preventDefault() {}, ...e }));
  calls.length = 0;
  kd({ key: ' ' }); ui.hud({ ...input, speedIndex: calls[0] });
  assert.strictEqual(calls[0], 4); assert(b[4].classList.contains('on') && !b[0].classList.contains('on')); ok('Space resumes and highlight follows');
  kd({ key: ' ' }); ui.hud({ ...input, speedIndex: calls[1] });
  assert.strictEqual(calls[1], 0); assert(b[0].classList.contains('on') && !b[4].classList.contains('on')); ok('Space pauses and highlight follows');
  kd({ key: '3' }); ui.hud({ ...input, speedIndex: 2 });
  assert(b[2].classList.contains('on') && !b[0].classList.contains('on')); ok('number key moves highlight');
}
{ const { ui, ids, calls } = build(false);
  const I = ids.inspector;
  const vals = () => I.all(e => e.className === 'insp-value');
  const desc = (v, extra) => ({ title: 'Blade of grass #1', rows: [
    { name: 'Size', value: v, range: '0 – 1', tip: 'tip A' }, { name: 'Age', value: '3', range: '', tip: '' }, ...(extra || []) ] });
  ui.inspector(null); assert(I.hidden); ok('inspector(null) hides');
  ui.inspector(desc('0.62'));
  assert(!I.hidden && I.textContent.includes('Blade of grass #1') && I.textContent.includes('Size') && I.textContent.includes('0.62')); ok('desc shows title and rows');
  let w = writes; ui.inspector(desc('0.62')); assert.strictEqual(writes, w); ok('same desc writes nothing');
  const [v0, v1] = vals(); const before = [v0._text, v1._text];
  const nodes = vals(); const rowsBefore = I.all(e => e.className === 'insp-row');
  w = writes; ui.inspector(desc('0.63')); const dw = writes - w;
  assert.strictEqual(vals()[0]._text, '0.63'); assert.strictEqual(vals()[1]._text, '3'); assert.strictEqual(dw, 1);
  assert(I.all(e => e.className === 'insp-row').every((r, i) => r === rowsBefore[i])); ok('changed value updates only that node');
  ui.inspector(desc('0.63', [{ name: 'Extra', value: '9' }]));
  assert.strictEqual(vals().length, 3); assert(I.all(e => e.className === 'insp-row')[0] !== rowsBefore[0]); ok('different row set rebuilds');
  const close = I.all(e => e.className.includes('insp-close'))[0];
  close.fire('click'); assert(I.hidden && calls.includes('closed')); ok('x hides and calls onCloseInspector');
}
{ const { ui, ids, doc, calls, tools } = build(true);
  const bench = ids.hud.all(e => e.className === 'hud-control')[0];
  const info = ids.hud.all(e => e.className === 'hud-panel hud-panel-debug')[0];
  // The tab is labeled rows now (Overlays, World, Tools), so read every element in order.
  const names = info.all(() => true).map(c => c.className);
  assert(names.indexOf('hud-seed') < names.indexOf('hud-control') && names.indexOf('hud-control') < names.indexOf('hud-tools')); ok('Debug tab: the World row (seed) before the Tools row (Benchmark, then the debug tools)');
  bench.fire('click'); assert.deepStrictEqual(calls, ['bench']); ok('Benchmark button calls onBench');
  calls.length = 0;
  const kd = e => doc.listeners.keydown.forEach(f => f({ ctrlKey: false, metaKey: false, altKey: false, target: {}, preventDefault() {}, ...e }));
  const tool = ids.hud.all(e => e.className.split(' ').includes('hud-tool'))[1];
  ui.lock(true);
  btns(ids).forEach(b => b.fire('click')); bench.fire('click'); tool.fire('click'); kd({ key: ' ' }); kd({ key: '3' });
  assert.strictEqual(calls.length, 0); assert.strictEqual(tools.length, 0); ok('lock(true): speed buttons, Benchmark, tools and keys do nothing');
  assert(bench.disabled && btns(ids).every(b => b.disabled) && tool.disabled); ok('lock(true) disables the buttons');
  ui.lock(false);
  btns(ids)[2].fire('click'); bench.fire('click'); tool.fire('click'); kd({ key: '4' });
  assert.deepStrictEqual(calls, [2, 'bench', 3]); assert.deepStrictEqual(tools, ['corpse-bunny']); assert(!bench.disabled && btns(ids).every(b => !b.disabled)); ok('lock(false) restores everything');
}
{ const { ids } = build(false);
  assert.strictEqual(ids.hud.all(e => e.className === 'hud-control').length, 0); ok('Benchmark button hidden without ?debug (Paul, 12 Oct 2026)');
}
{ const { ui, ids, calls } = build(false);
  const g = ids.hud.all(e => e.className.split(' ').includes('hud-graph'))[0];
  assert(g && g.textContent === 'Graph'); g.fire('click'); assert.deepStrictEqual(calls, ['graph']); ok('Graph button calls onGraph');
  ui.hud(input); assert(!g.classList.contains('on'));
  ids.graph._hidden = false; ui.hud(input); assert(g.classList.contains('on'));
  ids.graph._hidden = true; ui.hud(input); assert(!g.classList.contains('on')); ok('Graph button highlight follows the panel');
  const w = writes; ids.graph._hidden = true; ui.hud(input); assert.strictEqual(writes, w); ok('Graph state read causes no writes when unchanged');
  ui.lock(true); assert(g.disabled === true); calls.length = 0; g.fire('click'); assert.strictEqual(calls.length, 0); ok('Graph button disabled and inert when locked');
  ui.lock(false); assert(g.disabled === false);
}
{ const { ids, calls } = build(false, { onLines: on => calls.push('lines:' + on) });
  const l = ids.hud.all(e => e.className.split(' ').includes('hud-lines'))[0];
  assert(l && l.textContent === 'Intent lines'); assert(!l.classList.contains('on')); ok('Intent lines button starts off when lines is not set');
  l.fire('click'); assert(l.classList.contains('on')); l.fire('click'); assert(!l.classList.contains('on'));
  assert.deepStrictEqual(calls, ['lines:true', 'lines:false']); ok('Lines button toggles and reports its state');
}
{ const { ids } = build(false, { onLines() {}, lines: true });
  const l = ids.hud.all(e => e.className.split(' ').includes('hud-lines'))[0];
  assert(l.classList.contains('on')); ok('Lines button starts on when the saved choice is on');
}
{ const calls = []; const { ids, ui } = build(true, { onWater: on => calls.push('water:' + on) });
  const w = ids.hud.all(e => e.className.split(' ').includes('hud-water'))[0];
  assert(w && w.textContent === 'Water'); assert(!w.classList.contains('on')); ok('Water button starts off when water is not set');
  assert(/new world/i.test(w._title)); ok('Water button says it starts a new world');
  w.fire('click'); assert(w.classList.contains('on')); w.fire('click'); assert(!w.classList.contains('on'));
  assert.deepStrictEqual(calls, ['water:true', 'water:false']); ok('Water button toggles and reports its state (main.js starts the new world and remembers it)');
  ui.lock(true); w.fire('click'); assert(calls.length === 2); ui.lock(false); ok('Water button does nothing while locked');
}
{ const { ids } = build(true, { onWater() {}, water: true });
  const w = ids.hud.all(e => e.className.split(' ').includes('hud-water'))[0];
  assert(w.classList.contains('on')); ok('Water button starts on when the saved choice is on');
}

// ---- tabs, Hide UI, NUKE MODE ----
const tabBtn = (ids, label) => ids.hud.all(e => e.className.split(' ').includes('hud-tab') && e.textContent === label)[0];
const panelOf = (ids, key) => ids.hud.all(e => e.className === 'hud-panel hud-panel-' + key)[0];
const winOf = (ids, key) => ids.hud.all(e => e.className === 'hud-tabstrip hud-win-' + key)[0];
{ const { ids } = build(false);
  const bar = ids.hud.all(e => e.className === 'hud-strip')[0];
  const barText = bar.children.map(c => c.className).join('|');
  for (const c of ['hud-speeds', 'hud-speedname', 'hud-day', 'hud-tabs', 'hud-hide']) assert(barText.includes(c), c);
  assert(!bar.all(e => e.className.includes('hud-count') || e.className.includes('hud-lines') || e.className.includes('hud-nuke')).length); ok('the bar holds speeds, day, tabs and Hide UI, none of the tab contents');
  assert.deepStrictEqual(ids.hud.all(e => e.className.split(' ').includes('hud-tab')).map(b => b.textContent), ['Info', 'Paint', 'Graph', 'Map']); ok('four window buttons in the bar, in order: Info, Paint, Graph, Map (Debug only with ?debug)');
  assert.deepStrictEqual(build(true).ids.hud.all(e => e.className.split(' ').includes('hud-tab')).map(b => b.textContent), ['Info', 'Paint', 'Graph', 'Map', 'Debug']); ok('with ?debug a fifth: Debug');
  assert(!ids.hud.all(e => e.className.split(' ').includes('hud-water')).length && !ids.hud.textContent.includes('Benchmark')); ok('without ?debug, no Water or Benchmark on the page');
  assert.strictEqual(ids.hud.all(e => e.className.includes('hud-hide'))[0].textContent, 'Hide UI'); ok('a Hide UI button');
}
{ const { ui, ids } = build(true, { onLines() {} });
  assert.strictEqual(ui.windows.join(','), 'info'); assert(!winOf(ids, 'info').hidden && winOf(ids, 'debug').hidden && winOf(ids, 'paint').hidden); ok('Info is open by default, alone');
  assert(!panelOf(ids, 'info').textContent.includes('Graph') && panelOf(ids, 'info').all(e => e.className === "hud-glyph").length === 7); ok('Info holds the seven counts (humans, fires and the Total included) and no Graph button (it moved to the bar)');
  assert(panelOf(ids, 'info').all(e => e.className.includes('hud-lines')).length === 1 && panelOf(ids, 'debug').textContent.includes('Benchmark') && panelOf(ids, 'debug').textContent.includes('Seed')); ok('Info holds Intent lines; Debug holds Benchmark and the Seed');
  assert(panelOf(ids, 'paint').textContent.includes('NUKE MODE')); ok('PAINT holds NUKE MODE');
}
{ const seen = [];
  const { ui, ids } = build(true, { windows: [], onWindows: k => seen.push(k.join(',')) });
  assert(winOf(ids, 'info').hidden && ui.windows.length === 0 && seen.length === 0); ok('windows: [] starts with none open, and that is not reported');
  tabBtn(ids, 'Debug').fire('click');
  assert(!winOf(ids, 'debug').hidden && winOf(ids, 'info').hidden && tabBtn(ids, 'Debug').classList.contains('on')); ok('a tab button opens its own window');
  tabBtn(ids, 'Paint').fire('click');
  assert(!winOf(ids, 'debug').hidden && !winOf(ids, 'paint').hidden && tabBtn(ids, 'Debug').classList.contains('on') && tabBtn(ids, 'Paint').classList.contains('on')); ok('another opens beside it: both stay open');
  tabBtn(ids, 'Paint').fire('click');
  assert(winOf(ids, 'paint').hidden && !winOf(ids, 'debug').hidden && !tabBtn(ids, 'Paint').classList.contains('on')); ok('clicking an open one closes just that window');
  assert.deepStrictEqual(seen, ['debug', 'debug,paint', 'debug']); ok('onWindows reports the open ones after each change (for remembering them)');
}
{ const { ui, ids } = build(false, { windows: ['paint', 'info'] });
  assert(!winOf(ids, 'paint').hidden && !winOf(ids, 'info').hidden && ui.windows.length === 2); ok('remembered windows open at load');
  const { ui: u2 } = build(false, { windows: ['nonsense', 'debug'] }); assert.strictEqual(u2.windows.length, 0); ok('an unknown remembered window (or Debug without ?debug) stays shut');
}
{ const { ui, ids, doc, body } = build(false);
  assert(!body.classList.contains('ui-off') && !ui.hidden);
  ids.hud.all(e => e.className.includes('hud-hide'))[0].fire('click');
  assert(ui.hidden && body.classList.contains('ui-off')); ok('Hide UI sets ui-off on the body (CSS hides bar, strip, graph and inspector)');
  const showBtn = body.all(e => e.className === 'hud-show')[0];
  assert(showBtn && showBtn.textContent === 'Show UI'); showBtn.fire('click');
  assert(!ui.hidden && !body.classList.contains('ui-off')); ok('the corner button brings the UI back');
  const kd = e => doc.listeners.keydown.forEach(f => f({ ctrlKey: false, metaKey: false, altKey: false, target: {}, preventDefault() {}, ...e }));
  kd({ key: 'h' }); assert(ui.hidden); kd({ key: 'H' }); assert(!ui.hidden); ok('H toggles the UI');
  kd({ key: 'h', target: { tagName: 'INPUT' } }); assert(!ui.hidden); ok('H is ignored while typing in an input');
  kd({ key: 'h', ctrlKey: true }); assert(!ui.hidden); ok('Ctrl+H is left to the browser');
}
{ const calls = [];
  const { ui, ids, body } = build(false, { onNuke: on => calls.push(on) });
  const nuke = ids.hud.all(e => e.className.split(' ').includes('hud-nuke'))[0];
  assert(nuke.textContent === 'NUKE MODE' && !nuke.classList.contains('on') && !ui.nuke && !body.classList.contains('nuke-armed')); ok('NUKE MODE starts off');
  nuke.fire('click');
  assert(ui.nuke && nuke.classList.contains('on') && body.classList.contains('nuke-armed') && calls[0] === true); ok('clicking arms it: highlighted, crosshair class, onNuke(true)');
  ui.hud(input); assert(ui.nuke); ok('it stays armed (repeated nukes work)');
  ui.lock(true); assert(nuke.disabled); nuke.fire('click'); assert(ui.nuke); ui.lock(false); ok('locked during the benchmark');
  nuke.fire('click');
  assert(!ui.nuke && !nuke.classList.contains('on') && !body.classList.contains('nuke-armed') && calls.join() === 'true,false'); ok('clicking again disarms it');
}
{ const modes = [], nukes = [];
  const { ui, ids, body } = build(false, { onMode: m => modes.push(m), onNuke: on => nukes.push(on) });
  const by = label => ids.hud.all(e => e.textContent === label && e.tagName === 'button' || e.textContent === label && e.className.includes('hud-control'))[0];
  const names = ['NUKE MODE', 'GRASS MODE', 'RABBIT MODE', 'WOLF MODE', 'HUMAN MODE'], b = names.map(by);
  assert(b.every(Boolean)); ok('the five God modes exist as buttons');
  assert(ids.hud.all(e => e.textContent === 'WOLF MODE').length >= 1 && panelOf(ids, 'paint').textContent.includes('RABBIT MODE')); ok('they sit in the PAINT tab');
  b[1].fire('click');
  assert(ui.mode === 'grass' && b[1].classList.contains('on') && body.classList.contains('paint-armed') && !body.classList.contains('nuke-armed')); ok('GRASS MODE arms: highlighted, crosshair class');
  b[0].fire('click');
  assert(ui.mode === 'nuke' && ui.nuke && !b[1].classList.contains('on') && b[0].classList.contains('on') && !body.classList.contains('paint-armed') && body.classList.contains('nuke-armed') && nukes.join() === 'true'); ok('NUKE MODE turns GRASS MODE off');
  b[2].fire('click');
  assert(ui.mode === 'bunny' && !ui.nuke && nukes.join() === 'true,false' && !b[0].classList.contains('on')); ok('RABBIT MODE turns nuke off (onNuke(false))');
  b[3].fire('click');
  assert(ui.mode === 'wolf' && !b[2].classList.contains('on') && b[3].classList.contains('on')); ok('WOLF MODE turns RABBIT MODE off');
  b[4].fire('click');
  assert(ui.mode === 'human' && !b[3].classList.contains('on') && b[4].classList.contains('on') && body.classList.contains('paint-armed')); ok('HUMAN MODE turns WOLF MODE off');
  ui.lock(true); b[1].fire('click'); assert(ui.mode === 'human' && b.every(x => x.disabled)); ui.lock(false); ok('locked during the benchmark');
  b[4].fire('click');
  assert(ui.mode === '' && !b.some(x => x.classList.contains('on')) && !body.classList.contains('paint-armed') && modes.join() === 'grass,nuke,bunny,wolf,human,'); ok('clicking the active mode turns it off');
  b[1].fire('click'); ui.setWindow('paint', true); ui.setWindow('paint', false);
  assert(ui.mode === '' && !b[1].classList.contains('on') && !body.classList.contains('paint-armed')); ok('closing PAINT disarms its mode');
}

// ---- counts: a Total beside the species, humans with their own count ----
{ const { ui, ids } = build(false);
  ui.hud({ ...input, counts: { bunnies: 12000, wolves: 300, humans: 40, total: 12340, blades: 5, corpses: 6 } });
  const txt = ids.hud.textContent;
  assert(txt.includes('Total') && txt.includes('12,340') && txt.includes('12,000') && txt.includes('300') && txt.includes('40')); ok('Info shows a Total (12,340) and a human count');
  assert(ids.hud.all(e => e.className === 'hud-num hud-num-total').length === 1 && ids.hud.all(e => e.className === 'hud-num hud-num-humans').length === 1); ok('Total and humans are counts like the others (fixed width in CSS)');
  const icons = [];
  ui.setIcons((key, cv) => { icons.push(key); });
  assert.strictEqual(icons.join(','), 'bunnies,wolves,humans,blades,corpses,fires,nuke,blades,bunnies,wolves,humans,water,fires'); ok('icons for every count but the Total (which keeps its word), then one for each PAINT mode');
  const nuke = ids.hud.all(e => e.className.includes('hud-nuke'))[0];
  assert(nuke.textContent === '' && nuke.className.includes('hud-mode-icon') && nuke.getAttribute('aria-label') === 'NUKE MODE' && (nuke._title || nuke.title).startsWith('NUKE MODE: ')); ok('a mode button becomes its icon, keeping its name as its label and in its tooltip');
}
// ---- fires: FIRE MODE, and the fire count that waits for the first fire ----
{ const located = [];
  const { ui, ids } = build(false, { onLocate: (k, on) => located.push(k + ':' + on) });
  const fm = ids.hud.all(e => e.className.includes('hud-brush') && e.getAttribute('aria-label') === 'FIRE MODE')[0];
  assert(fm && /^FIRE MODE: tap or drag to set grass and bodies alight/.test(fm._title || fm.title)); ok('FIRE MODE is a PAINT brush with its label and tooltip');
  fm.fire('click'); assert(ui.mode === 'fire' && fm.classList.contains('on')); ok('clicking it arms the fire mode');
  const box = ids.hud.all(e => e.className.split(' ').includes('hud-count') && e.all(c => c.className === 'hud-num hud-num-fires').length)[0];
  ui.hud({ ...input, counts: { ...input.counts, fires: 0 } });
  assert(box.hidden === true); ok('the fires count is hidden until this world has had a fire');
  ui.hud({ ...input, firesSeen: true, counts: { ...input.counts, fires: 12 } });
  assert(box.hidden === false && box.textContent.includes('12') && (box._title || box.title).includes('tiles burning')); ok('then it shows, with its tooltip');
  ui.hud({ ...input, firesSeen: true, counts: { ...input.counts, fires: 0 } });
  assert(box.hidden === false); ok('and stays once seen, at 0');
  box.fire('click'); box.fire('click');
  assert.deepStrictEqual(located, ['fires:true', 'fires:false']); ok('its ring toggle calls onLocate(fires)');
}
// ---- the Radius slider: one value for every mode, defaults, keeping, the benchmark lock ----
{ const { ui, ids } = build(false);
  const slider = ids.hud.all(e => e.className === 'hud-radius-input')[0], label = ids.hud.all(e => e.className === 'hud-radius-label')[0];
  const by = l => ids.hud.all(e => e.textContent === l && e.className.includes('hud-control'))[0];
  assert(slider && slider.disabled && label.textContent === 'Radius –'); ok('the Radius slider is off until a mode is armed');
  const MAXR = 75;
  ui.setRadiusDefaults(75, 4);
  assert.strictEqual(ui.radiusOf('nuke'), 4); assert.strictEqual(ui.radiusOf('grass'), 4); ok('default: BrushRadius for every mode, the nuke included');
  by('NUKE MODE').fire('click');
  assert(!slider.disabled && slider.value === '4' && label.textContent === 'Radius 4'); ok('NUKE MODE shows the one radius');
  slider.value = '40'; slider.listeners.input.forEach(f => f());
  assert(ui.radiusOf('nuke') === 40 && label.textContent === 'Radius 40'); ok('moving the slider sets the radius and the label');
  by('GRASS MODE').fire('click');
  assert(slider.value === '40' && label.textContent === 'Radius 40' && ui.radiusOf('grass') === 40); ok('switching modes keeps it: the same 40 for GRASS');
  slider.value = '9'; slider.listeners.input.forEach(f => f());
  by('HUMAN MODE').fire('click');
  assert(label.textContent === 'Radius 9' && ui.radiusOf('nuke') === 9 && ui.radiusOf('human') === 9); ok('a change in one mode is every mode\'s (nuke too)');
  slider.value = '250'; slider.listeners.input.forEach(f => f());
  assert(ui.radiusOf('grass') === MAXR && slider.max === String(MAXR)); ok(`the radius tops out at ${MAXR}`);
  ui.lock(true); assert(slider.disabled); slider.value = '5'; slider.listeners.input.forEach(f => f()); assert(ui.radiusOf('grass') === MAXR); ui.lock(false); assert(!slider.disabled); ok('disabled (and ignored) during the benchmark');
  const seen = []; const r2 = build(false, { onRadius: (m, r) => seen.push(m + ':' + r) });
  r2.ui.setRadiusDefaults(75, 2); r2.ids.hud.all(e => e.textContent === 'WATER MODE' || e.getAttribute('aria-label') === 'WATER MODE')[0].fire('click');
  const sl2 = r2.ids.hud.all(e => e.className === 'hud-radius-input')[0]; sl2.value = '11'; sl2.listeners.input.forEach(f => f());
  assert.deepStrictEqual(seen, ['water:11']); ok('the slider still tells main.js (for the fading size preview)');
}
{ // One key in localStorage, and a stored value beats the default.
  const mem = { 'life-radius': '12', 'life-radius-wolf': '3' };
  LS = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
  const { ui } = build(false);
  ui.setRadiusDefaults(75, 0);
  assert(ui.radiusOf('nuke') === 12 && ui.radiusOf('wolf') === 12 && ui.radiusOf('bunny') === 12); ok('a radius chosen earlier is remembered once, for every mode (the old per-mode keys are ignored)');
  ui.setRadius('bunny', 7);
  assert(mem['life-radius'] === '7' && ui.radiusOf('nuke') === 7 && !('life-radius-bunny' in mem)); ok('a change is written under the one key');
  LS = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const u2 = build(false).ui; u2.setRadiusDefaults(75, 6); u2.setRadius('wolf', 4);
  assert(u2.radiusOf('wolf') === 4 && u2.radiusOf('nuke') === 4); ok('blocked storage just means no memory');
  LS = undefined;
}
// ---- the armed banner and its Stop button ----
{ const { ui, ids, body } = build(false);
  const banner = ids.hud.all(e => e.className === 'paint-banner')[0];
  const mode = l => ids.hud.all(e => e.getAttribute('aria-label') === l)[0];
  assert(banner && banner.hidden && banner.parent === ids.hud); ok('the banner exists, hidden, in the HUD');
  mode('FIRE MODE').fire('click');
  assert(!banner.hidden && banner.textContent.includes('PAINTING: FIRE') && banner.textContent.includes('Stop') && body.classList.contains('paint-armed')); ok('arming FIRE shows "PAINTING: FIRE" with a Stop button (the colored edge is CSS on body.paint-armed)');
  mode('NUKE MODE').fire('click');
  assert(!banner.hidden && banner.textContent.includes('NUKE ARMED') && body.classList.contains('nuke-armed')); ok('NUKE shows "NUKE ARMED"');
  const made = []; ui.setIcons((key, cv) => made.push(key));
  mode('GRASS MODE').fire('click');
  assert(made.includes('blades') && banner.all(e => e.className === 'paint-banner-icon')[0].children.length === 1); ok('with icons ready, the banner wears the mode\'s icon');
  const stop = banner.all(e => e.className.includes('paint-stop'))[0];
  ui.lock(true); stop.fire('click'); assert(ui.mode === 'grass'); ui.lock(false); ok('Stop does nothing during the benchmark');
  stop.fire('click');
  assert(ui.mode === '' && banner.hidden && !body.classList.contains('paint-armed') && !mode('GRASS MODE').classList.contains('on')); ok('Stop disarms: banner gone, edge class gone');
  mode('WOLF MODE').fire('click'); assert(!banner.hidden);
  ui.setWindow('paint', true); ui.setWindow('paint', false);
  assert(banner.hidden && ui.mode === ''); ok('closing the Paint window takes the banner away too');
  let swallowed = 0; banner.fire('pointerdown', { stopPropagation: () => swallowed++ }); assert(swallowed === 1); ok('taps on the banner stop there, not painting the map under it');
}
// ---- Info's hint, the bar's window buttons ----
{ const { ids, calls, ui } = build(false);
  const hint = ids.hud.all(e => e.className === 'hud-hint')[0];
  assert(hint && hint.textContent === '(click to highlight on map)' && hint.parent === ids.hud.all(e => e.className === 'hud-sec-body' && e.parent.className.includes('hud-sec-counts'))[0]); ok('Info has the "(click to highlight on map)" hint in the Counts row');
  const bar = ids.hud.all(e => e.className === 'hud-tabs')[0];
  assert.deepStrictEqual(bar.children.map(b => b.textContent), ['Info', 'Paint', 'Graph', 'Map']); ok('Graph and Map are in the bar beside Info and Paint');
  for (const b of bar.children) assert(b.children[0].className === 'hud-tab-icon' && b.children[0].innerHTML.startsWith('<svg')); ok('each of the four has an icon left of its label');
  const [, , g, m] = bar.children;
  g.fire('click'); m.fire('click'); assert.deepStrictEqual(calls, ['graph', 'map']); ok('Graph and Map toggle their windows through onGraph / onMinimap');
  const miniEl = ids.minimap;
  assert(miniEl === undefined); ui.hud(input); assert(!m.classList.contains('on')); ok('Map reads as off without a minimap window');
  ui.lock(true); calls.length = 0; g.fire('click'); m.fire('click'); assert.strictEqual(calls.length, 0); assert(g.disabled && m.disabled); ui.lock(false); ok('both are inert while the benchmark runs');
}
// ---- the × on each window ----
{ const seen = [];
  const { ui, ids, body } = build(true, { windows: ['info', 'paint', 'debug'], onWindows: k => seen.push(k.join(',')) });
  const xOf = key => winOf(ids, key).all(e => e.className.includes('win-close'))[0];
  for (const k of ['info', 'paint', 'debug']) assert(xOf(k) && xOf(k).textContent === '×' && xOf(k)._title === 'Close'); ok('Info, Paint and Debug each have a ×');
  ids.hud.all(e => e.className.includes('paint-stop'));
  ids.hud.all(e => e.getAttribute('aria-label') === 'FIRE MODE')[0].fire('click'); assert(ui.mode === 'fire');
  xOf('paint').fire('click');
  assert(winOf(ids, 'paint').hidden && !tabBtn(ids, 'Paint').classList.contains('on') && ui.mode === '' && !body.classList.contains('paint-armed') && seen[seen.length - 1] === 'info,debug'); ok('× closes Paint like its bar button: button off, remembered windows updated, mode disarmed');
  xOf('info').fire('click');
  assert(winOf(ids, 'info').hidden && !tabBtn(ids, 'Info').classList.contains('on') && !body.classList.contains('side-open') && seen[seen.length - 1] === 'debug'); ok('× closes Info and clears side-open');
  tabBtn(ids, 'Info').fire('click'); assert(!winOf(ids, 'info').hidden); ok('the bar button reopens it');
  assert(ids.inspector.all(e => e.className.includes('win-close')).length === 1); ok('the properties window has its ×');
}
// ---- resizable windows ----
{ const mem = {};
  LS = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } };
  const { ctx, ids } = build(false, {}, { innerWidth: 1200, innerHeight: 800 });
  const panel = new El('aside'); panel.rect = { left: 100, top: 80, width: 300, height: 200 };
  let changes = 0, pinned = 0;
  const r = ctx.AS.uiParts.Resizable(panel, { key: 'k-wh', minW: 200, minH: 120, pin: () => pinned++, onChange: () => changes++ });
  const grip = panel.all(e => e.className === 'resize-grip')[0];
  assert(grip && !grip.hidden); ok('a window gets a resize grip in its corner');
  const ev = (x, y) => ({ pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y, preventDefault() {}, stopPropagation() {} });
  grip.fire('pointerdown', ev(400, 280)); grip.fire('pointermove', ev(500, 330)); grip.fire('pointerup', ev(500, 330));
  assert.deepStrictEqual(panel.style.width + ',' + panel.style.height, '400px,250px'); assert(pinned === 1 && mem['k-wh'] === '{"w":400,"h":250}'); ok('a simulated drag grows the window by the drag, pins it first, and keeps the size');
  grip.fire('pointerdown', ev(500, 330)); grip.fire('pointermove', ev(0, 0)); grip.fire('pointerup', ev(0, 0));
  assert(panel.style.width === '200px' && panel.style.height === '120px'); ok('it never shrinks below its minimum');
  grip.fire('pointerdown', ev(200, 120)); grip.fire('pointermove', ev(9000, 9000)); grip.fire('pointerup', ev(9000, 9000));
  assert(parseFloat(panel.style.width) <= 1200 - 100 && parseFloat(panel.style.height) <= 800 - 80); ok('it never grows past the viewport');
  const p2 = new El('aside'); p2.rect = { left: 0, top: 0, width: 300, height: 200 };
  ctx.AS.uiParts.Resizable(p2, { key: 'k-wh', minW: 200, minH: 120 });
  assert(p2.style.width === parseFloat(panel.style.width) + 'px'); ok('a new page load starts at the remembered size');
  const g2 = p2.all(e => e.className === 'resize-grip')[0]; g2.fire('dblclick', { stopPropagation() {} });
  assert(p2.style.width === '' && !('k-wh' in mem)); ok('double-clicking the grip forgets the size');
  LS = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  const p3 = new El('aside'); const { ctx: c3 } = build(false, {}, { innerWidth: 1200, innerHeight: 800 });
  const r3 = c3.AS.uiParts.Resizable(p3, { key: 'x', minW: 100, minH: 100 }); const g3 = p3.all(e => e.className === 'resize-grip')[0];
  g3.fire('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 0, clientY: 0, preventDefault() {}, stopPropagation() {} }); g3.fire('pointermove', { pointerId: 2, clientX: 50, clientY: 50 }); g3.fire('pointerup', { pointerId: 2 });
  assert(p3.style.width === '350px'); ok('a touch drag works, and blocked storage just means no memory');
  const { ctx: c4 } = build(false, {}, { innerWidth: 400, innerHeight: 800 }); const p4 = new El('aside');
  c4.AS.uiParts.Resizable(p4, { key: 'y', minW: 100, minH: 100, enabled: () => false });
  assert(p4.all(e => e.className === 'resize-grip')[0].hidden === true && p4.style.width === ''); ok('a window that cannot resize (a phone sheet) hides its grip');
  LS = undefined;
  // The tab windows and the properties window each get one.
  const b = build(true, {}, { innerWidth: 1200, innerHeight: 800 });
  for (const key of ['info', 'paint', 'debug']) assert(winOf(b.ids, key).all(e => e.className === 'resize-grip').length === 1);
  assert(b.ids.inspector.all(e => e.className === 'resize-grip').length === 1); ok('Info, Paint, Debug and the properties window all have a grip');
}
// ---- the "That's a crowd" card ----
{ const { ui, body } = build(false);
  const cards = () => body.all(e => e.className.includes('crowd-card'));
  let keep = 0, stop = 0;
  ui.crowd({ limit: 20000, onKeep: () => keep++, onStop: () => stop++ });
  assert(cards().length === 1 && /That's a crowd/.test(cards()[0].textContent) && /Over 20,000 animals/.test(cards()[0].textContent)); ok('the card names the limit, formatted');
  const keepBtn = body.all(e => e.textContent === 'Keep adding')[0], stopBtn = body.all(e => e.textContent === 'Stop here')[0];
  assert(keepBtn && stopBtn); keepBtn.fire('click'); stopBtn.fire('click');
  assert(keep === 1 && stop === 1); ok('Keep adding and Stop here call back');
  ui.crowd({ limit: 40000, onKeep() {}, onStop() {} });
  assert(cards().length === 1 && /40,000/.test(cards()[0].textContent)); ok('showing it again replaces the old card');
  ui.crowd(null); assert(cards().length === 0); ok('null hides it');
}
// ---- the Info window's Wind row ----
{ const { ui, ids, ctx } = build(false);
  const AS = ctx.AS, row = ids.hud.all(e => e.className === 'hud-sec hud-sec-wind')[0];
  const names = panelOf(ids, 'info').children.map(c => c.className);
  assert(row && names.indexOf('hud-sec hud-sec-counts') + 1 === names.indexOf('hud-sec hud-sec-wind') && names.indexOf('hud-sec hud-sec-wind') + 1 === names.indexOf('hud-sec hud-sec-overlays') && !names.includes('hud-sec hud-sec-windows')); ok('Info has a Wind row after Counts and before Overlays; no Windows row any more');
  assert(/wind/i.test(row.children[0]._title)); ok('the Wind row has a tooltip');
  const text = () => row.all(e => e.className === 'hud-wind-text')[0].textContent;
  const arrow = row.all(e => e.className === 'hud-wind-arrow')[0];
  assert(row.hidden); ui.hud(input); assert(row.hidden && text() === ''); ok('hud() without wind leaves the row hidden and does not throw');
  const { CALM_BELOW_KMH, WINDY_FROM_KMH } = AS.WIND, PI = Math.PI;
  const west = 1.5 * PI;   // bearings are radians from north, clockwise
  const cases = [
    [CALM_BELOW_KMH / 2, west, 'calm'],
    [(CALM_BELOW_KMH + WINDY_FROM_KMH) / 2 + 0.4, west, `breeze, ${Math.round((CALM_BELOW_KMH + WINDY_FROM_KMH) / 2 + 0.4)} km/h from the west`],
    [WINDY_FROM_KMH + 6.3, PI / 4, `windy, ${WINDY_FROM_KMH + 6} km/h from the northeast`],
  ];
  for (const [kmh, from, want] of cases) {
    ui.hud({ ...input, wind: { from, kmh } });
    assert(!row.hidden); assert.strictEqual(text(), want);
  } ok('calm, breeze and windy words, rounded km/h and the compass point it comes from');
  for (const [from, deg] of [[0, 180], [PI / 2, 270], [PI, 0], [1.5 * PI, 90], [PI / 4, 225]]) {
    ui.hud({ ...input, wind: { from, kmh: 10 } });
    assert.strictEqual(arrow.style.transform, `rotate(${deg}deg)`);
  } ok('the arrow points the way the wind blows (opposite its bearing)');
  const w = (ui.hud({ ...input, wind: { from: 1, kmh: 10.2 } }), writes);
  ui.hud({ ...input, wind: { from: 1, kmh: 10.4 } }); ui.hud({ ...input, wind: { from: 1.0001, kmh: 10.2 } });
  assert.strictEqual(writes, w); ok('a second identical hud() with wind writes nothing (text and angle only change when what shows changes)');
  ui.hud({ ...input, wind: { from: 1, kmh: 10.2 } }); const before = arrow.style.transform;
  ui.hud({ ...input }); assert.strictEqual(text(), `breeze, 10 km/h from the east`.replace('east', AS.windFromName(1))); assert.strictEqual(arrow.style.transform, before); ok('a later hud() without wind keeps the last reading');
}
console.log('all passed');
