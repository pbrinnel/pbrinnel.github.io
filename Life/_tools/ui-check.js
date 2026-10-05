// Runs Life/js/ui.js against a minimal fake DOM. Counts every write.
const vm = require('vm'), fs = require('fs'), assert = require('assert');
let writes = 0;
class ClassList {
  constructor(o) { this.o = o; this.s = new Set(); }
  toggle(c, on) { const had = this.s.has(c); on = on === undefined ? !had : on; writes++; on ? this.s.add(c) : this.s.delete(c); this.o._cls = [...this.s].join(' '); }
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
  setAttribute() {}
  replaceWith(n) { if (this.parent) this.parent.children = this.parent.children.map(c => c === this ? n : c); n.parent = this.parent; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null; }
  append(...cs) { for (const c of cs) { writes++; const k = typeof c === 'string' ? Object.assign(new El('#text'), { _text: c }) : c; k.parent = this; this.children.push(k); } }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  blur() {}
  fire(t, e = {}) { (this.listeners[t] || []).forEach(f => f(e)); }
  all(p, out = []) { if (p(this)) out.push(this); this.children.forEach(c => c.all(p, out)); return out; }
}
let LS;   // what the page sees as localStorage (undefined: none, which the page copes with)
function build(debug, extra = {}) {
  const ids = { hud: new El('div'), errors: new El('div'), inspector: new El('aside'), graph: new El('aside') };
  ids.graph._hidden = true;
  ids.errors._hidden = true; ids.inspector._hidden = true;
  const body = new El('body');
  const doc = { createElement: t => new El(t), getElementById: i => ids[i], body, listeners: {},
    addEventListener(t, f) { (this.listeners[t] ||= []).push(f); } };
  const ctx = { document: doc, globalThis: null, AS: {}, localStorage: LS }; ctx.globalThis = ctx;
  vm.createContext(ctx);
  // ui.js builds its debug tools from the species list, which world.js owns.
  vm.runInContext(fs.readFileSync(require('path').join(__dirname, '../js/world.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(require('path').join(__dirname, '../js/ui.js'), 'utf8'), ctx);
  const calls = [], tools = [];
  const speeds = [0, 1, 2, 5, 20, Infinity];
  const ui = ctx.AS.UI({ debug, speeds, onSpeed: i => calls.push(i), onDebugTool: m => tools.push(m), onCloseInspector: () => calls.push('closed'), onBench: () => calls.push('bench'), onGraph: () => calls.push('graph'), ...extra });
  return { ui, ids, doc, calls, tools, body };
}
// The speed buttons only (not the tabs, Hide UI or the debug tools).
const btns = (ids) => ids.hud.all(e => e.className === 'hud-speeds')[0].children;
let n = 0; const ok = m => console.log('ok', ++n, m);
const input = { speedIndex: 1, achieved: 1, day: 3.24, seed: 1234567, counts: { bunnies: 0, wolves: 0, humans: 0, total: 0, blades: 23999, corpses: 1234567 } };

{ const { ui, ids } = build(false);
  ui.hud(input); const w = writes; ui.hud(input);
  assert.strictEqual(writes, w); ok('second identical hud() writes nothing');
  const txt = ids.hud.textContent;
  assert(txt.includes('23,999') && txt.includes('1,234,567')); ok('thousands separators');
  assert(txt.includes('Day 3.2') && txt.includes('Seed 1234567')); ok('day and seed');
  const b = btns(ids); assert.strictEqual(b.length, 6);
  assert.deepStrictEqual(b.map(x => x.textContent), ['Pause', '1×', '2×', '5×', '20×', 'Max']); ok('speed labels');
  assert(b[1].classList.contains('on') && !b[0].classList.contains('on')); ok('active highlighted');
  assert(!ids.hud.textContent.includes('running')); ok('no "running" at full speed');
  ui.hud({ ...input, speedIndex: 4, achieved: 14.2 });
  assert(ids.hud.textContent.includes('running 14×')); ok('running 14×');
  ui.hud({ ...input, speedIndex: 4, achieved: 19 });
  assert(!ids.hud.textContent.includes('running')); ok('within 90% hides running');
  ui.hud({ ...input, speedIndex: 5, achieved: 312.4 });
  assert(ids.hud.textContent.includes('Max (312×)')); ok('Max shows achieved multiple');
  assert(!btns(ids).length || ids.hud.all(e => e.className.split(' ').includes('hud-tool')).length === 0); ok('no debug tools when debug false');
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
  const bench = ids.hud.all(e => e.className === 'hud-bench')[0];
  const info = ids.hud.all(e => e.className === 'hud-panel hud-panel-debug')[0];
  const names = info.children.map(c => c.className);
  assert(names.indexOf('hud-bench') < names.indexOf('hud-seed') && names.indexOf('hud-seed') < names.indexOf('hud-tools')); ok('Debug tab: Lines/Benchmark, then the seed, then the debug tools');
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
  assert.strictEqual(ids.hud.all(e => e.className === 'hud-bench').length, 1); ok('Benchmark button also shown without ?debug');
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
  assert(l && l.textContent === 'Lines'); assert(!l.classList.contains('on')); ok('Lines button starts off when lines is not set');
  l.fire('click'); assert(l.classList.contains('on')); l.fire('click'); assert(!l.classList.contains('on'));
  assert.deepStrictEqual(calls, ['lines:true', 'lines:false']); ok('Lines button toggles and reports its state');
}
{ const { ids } = build(false, { onLines() {}, lines: true });
  const l = ids.hud.all(e => e.className.split(' ').includes('hud-lines'))[0];
  assert(l.classList.contains('on')); ok('Lines button starts on when the saved choice is on');
}

// ---- tabs, Hide UI, NUKE MODE ----
const tabBtn = (ids, label) => ids.hud.all(e => e.className.split(' ').includes('hud-tab') && e.textContent === label)[0];
const panelOf = (ids, key) => ids.hud.all(e => e.className === 'hud-panel hud-panel-' + key)[0];
const stripOf = ids => ids.hud.all(e => e.className === 'hud-tabstrip')[0];
{ const { ids } = build(false);
  const bar = ids.hud.all(e => e.className === 'hud-strip')[0];
  const barText = bar.children.map(c => c.className).join('|');
  for (const c of ['hud-speeds', 'hud-status', 'hud-day', 'hud-tabs', 'hud-hide']) assert(barText.includes(c), c);
  assert(!bar.all(e => e.className.includes('hud-count') || e.className.includes('hud-lines') || e.className.includes('hud-nuke')).length); ok('the bar holds speeds, day, tabs and Hide UI, none of the tab contents');
  assert.deepStrictEqual(ids.hud.all(e => e.className.split(' ').includes('hud-tab')).map(b => b.textContent), ['Info', 'Debug', 'God']); ok('three tabs: Info, Debug, God');
  assert.strictEqual(ids.hud.all(e => e.className.includes('hud-hide'))[0].textContent, 'Hide UI'); ok('a Hide UI button');
}
{ const { ui, ids } = build(false, { onLines() {} });
  assert.strictEqual(ui.tab, 'info'); assert(!stripOf(ids).hidden && !panelOf(ids, 'info').hidden && panelOf(ids, 'debug').hidden && panelOf(ids, 'god').hidden); ok('Info is open by default');
  assert(panelOf(ids, 'info').textContent.includes('Graph') && panelOf(ids, 'info').all(e => e.className === "hud-glyph").length === 6); ok('Info holds the six counts (humans and the Total included) and the Graph button');
  assert(panelOf(ids, 'debug').all(e => e.className.includes('hud-lines')).length === 1 && panelOf(ids, 'debug').textContent.includes('Benchmark') && panelOf(ids, 'debug').textContent.includes('Seed')); ok('Debug holds Lines, Benchmark and the Seed');
  assert(panelOf(ids, 'god').textContent.includes('NUKE MODE')); ok('God holds NUKE MODE');
}
{ const tabs = [];
  const { ui, ids } = build(false, { tab: null, onTab: n => tabs.push(n) });
  assert(stripOf(ids).hidden && ui.tab === null && tabs.length === 0); ok('tab: null starts closed, and the starting tab is not reported');
  tabBtn(ids, 'Debug').fire('click');
  assert(!stripOf(ids).hidden && !panelOf(ids, 'debug').hidden && panelOf(ids, 'info').hidden && tabBtn(ids, 'Debug').classList.contains('on')); ok('clicking a tab opens its strip');
  tabBtn(ids, 'God').fire('click');
  assert(panelOf(ids, 'debug').hidden && !panelOf(ids, 'god').hidden && !tabBtn(ids, 'Debug').classList.contains('on') && tabBtn(ids, 'God').classList.contains('on')); ok('only one tab is open at a time');
  tabBtn(ids, 'God').fire('click');
  assert(stripOf(ids).hidden && ui.tab === null && !tabBtn(ids, 'God').classList.contains('on')); ok('clicking the open tab closes the strip');
  assert.deepStrictEqual(tabs, ['debug', 'god', null]); ok('onTab reports each change (for remembering it)');
}
{ const { ui, ids } = build(false, { tab: 'god' });
  assert(ui.tab === 'god' && !panelOf(ids, 'god').hidden); ok('a remembered tab opens at load');
  const { ui: u2 } = build(false, { tab: 'nonsense' }); assert.strictEqual(u2.tab, null); ok('an unknown remembered tab means closed');
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
  const by = label => ids.hud.all(e => e.textContent === label && e.tagName === 'button' || e.textContent === label && e.className.includes('hud-bench'))[0];
  const names = ['NUKE MODE', 'GRASS MODE', 'RABBIT MODE', 'WOLF MODE', 'HUMAN MODE'], b = names.map(by);
  assert(b.every(Boolean)); ok('the five God modes exist as buttons');
  assert(ids.hud.all(e => e.textContent === 'WOLF MODE').length >= 1 && panelOf(ids, 'god').textContent.includes('RABBIT MODE')); ok('they sit in the God tab');
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
}

// ---- counts: a Total beside the species, humans with their own count ----
{ const { ui, ids } = build(false);
  ui.hud({ ...input, counts: { bunnies: 12000, wolves: 300, humans: 40, total: 12340, blades: 5, corpses: 6 } });
  const txt = ids.hud.textContent;
  assert(txt.includes('Total') && txt.includes('12,340') && txt.includes('12,000') && txt.includes('300') && txt.includes('40')); ok('Info shows a Total (12,340) and a human count');
  assert(ids.hud.all(e => e.className === 'hud-num hud-num-total').length === 1 && ids.hud.all(e => e.className === 'hud-num hud-num-humans').length === 1); ok('Total and humans are counts like the others (fixed width in CSS)');
  const icons = [];
  ui.setIcons((key, cv) => { icons.push(key); });
  assert.deepStrictEqual(icons, ['bunnies', 'wolves', 'humans', 'blades', 'corpses']); ok('icons for every count but the Total, which keeps its word');
}
// ---- the Radius slider: per-mode memory, defaults, keeping, the benchmark lock ----
{ const { ui, ids } = build(false);
  const slider = ids.hud.all(e => e.className === 'hud-radius-input')[0], label = ids.hud.all(e => e.className === 'hud-radius-label')[0];
  const by = l => ids.hud.all(e => e.textContent === l && e.className.includes('hud-bench'))[0];
  assert(slider && slider.disabled && label.textContent === 'Radius –'); ok('the Radius slider is off until a mode is armed');
  ui.setRadiusDefaults(75, 0);
  assert.strictEqual(ui.radiusOf('nuke'), 75); assert.strictEqual(ui.radiusOf('grass'), 0); ok('defaults: NukeRadius for the nuke, BrushRadius (0) for the brushes');
  by('NUKE MODE').fire('click');
  assert(!slider.disabled && slider.value === '75' && label.textContent === 'Radius 75'); ok('NUKE MODE shows Radius 75');
  slider.value = '40'; slider.listeners.input.forEach(f => f());
  assert(ui.radiusOf('nuke') === 40 && label.textContent === 'Radius 40'); ok('moving the slider sets that mode\'s radius and the label');
  by('GRASS MODE').fire('click');
  assert(slider.value === '0' && label.textContent === 'Radius 0' && ui.radiusOf('nuke') === 40); ok('switching modes switches the slider; the nuke keeps 40');
  slider.value = '9'; slider.listeners.input.forEach(f => f());
  by('HUMAN MODE').fire('click');
  assert(label.textContent === 'Radius 0' && ui.radiusOf('grass') === 9); ok('each brush mode has its own radius');
  by('GRASS MODE').fire('click');
  assert(slider.value === '9'); ok('coming back to a mode restores its radius');
  slider.value = '250'; slider.listeners.input.forEach(f => f());
  assert(ui.radiusOf('grass') === 100); ok('the radius tops out at 100');
  ui.lock(true); assert(slider.disabled); slider.value = '5'; slider.listeners.input.forEach(f => f()); assert(ui.radiusOf('grass') === 100); ui.lock(false); assert(!slider.disabled); ok('disabled (and ignored) during the benchmark');
}
{ // Remembered per mode in localStorage, and a stored value beats the default.
  const mem = { 'life-radius-nuke': '12', 'life-radius-wolf': '3' };
  LS = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
  const { ui } = build(false);
  ui.setRadiusDefaults(75, 0);
  assert(ui.radiusOf('nuke') === 12 && ui.radiusOf('wolf') === 3 && ui.radiusOf('bunny') === 0); ok('a radius chosen earlier is remembered per mode; the rest start at their defaults');
  ui.setRadius('bunny', 7);
  assert(mem['life-radius-bunny'] === '7'); ok('a change is written to localStorage');
  LS = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const u2 = build(false).ui; u2.setRadiusDefaults(75, 0); u2.setRadius('wolf', 4);
  assert(u2.radiusOf('wolf') === 4 && u2.radiusOf('nuke') === 75); ok('blocked storage just means no memory');
  LS = undefined;
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
console.log('all passed');
