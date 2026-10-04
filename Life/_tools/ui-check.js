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
  appendChild(c) { writes++; this.children.push(c); return c; }
  append(...cs) { for (const c of cs) { writes++; this.children.push(typeof c === 'string' ? Object.assign(new El('#text'), { _text: c }) : c); } }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  blur() {}
  fire(t, e = {}) { (this.listeners[t] || []).forEach(f => f(e)); }
  all(p, out = []) { if (p(this)) out.push(this); this.children.forEach(c => c.all(p, out)); return out; }
}
function build(debug, extra = {}) {
  const ids = { hud: new El('div'), errors: new El('div'), inspector: new El('aside'), graph: new El('aside') };
  ids.graph._hidden = true;
  ids.errors._hidden = true; ids.inspector._hidden = true;
  const doc = { createElement: t => new El(t), getElementById: i => ids[i], listeners: {},
    addEventListener(t, f) { (this.listeners[t] ||= []).push(f); } };
  const ctx = { document: doc, globalThis: null, AS: {} }; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(require('path').join(__dirname, '../js/ui.js'), 'utf8'), ctx);
  const calls = [], tools = [];
  const speeds = [0, 1, 2, 5, 20, Infinity];
  const ui = ctx.AS.UI({ debug, speeds, onSpeed: i => calls.push(i), onDebugTool: m => tools.push(m), onCloseInspector: () => calls.push('closed'), onBench: () => calls.push('bench'), onGraph: () => calls.push('graph'), ...extra });
  return { ui, ids, doc, calls, tools };
}
const btns = (ids) => ids.hud.all(e => e.tagName === 'BUTTON' && e.className.includes('hud-btn') && !e.className.split(' ').includes('hud-tool'));
let n = 0; const ok = m => console.log('ok', ++n, m);
const input = { speedIndex: 1, achieved: 1, day: 3.24, seed: 1234567, counts: { bunnies: 0, wolves: 0, blades: 23999, corpses: 1234567 } };

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
  assert.deepStrictEqual(tools.map(t => t.textContent), ['Select', 'Drop α†', 'Drop Ω†']); ok('debug tools exist');
}
{ const { tools, ids } = (() => { const r = build(true); return { tools: r.tools, ids: r.ids }; })();
  const t = ids.hud.all(e => e.className.split(' ').includes('hud-tool')); t[1].fire('click'); t[2].fire('click');
  assert.deepStrictEqual(tools, ['corpse-bunny', 'corpse-wolf']); ok('debug tools call onDebugTool');
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
  const info = ids.hud.all(e => e.className === 'hud-info')[0];
  const names = info.children.map(c => c.className);
  assert(names.indexOf('hud-bench') === names.indexOf('hud-seed') + 1 && names.indexOf('hud-bench') < names.indexOf('hud-tools')); ok('Benchmark button sits after the seed, before the debug tools');
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
console.log('all passed');
