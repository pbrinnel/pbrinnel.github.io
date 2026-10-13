const vm = require('vm'), fs = require('fs');
const calls = {}, drawn = [];   // drawn: every string fillText was given, since the last reset
const c2d = new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 40 }) : (...a) => { calls[k] = (calls[k] || 0) + 1; if (k === 'fillText') drawn.push(a[0]); }, set: () => true });
const mk = () => ({ children: [], style: { setProperty() {} }, classList: { toggle() {} }, listeners: {}, hidden: true, clientWidth: 420, clientHeight: 500, width: 0, height: 0,
  append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); }, addEventListener(t, f) { this.listeners[t] = f; },
  getContext() { return c2d; }, offsetWidth: 420, offsetHeight: 320, getBoundingClientRect() { return { left: this.style.left ? parseFloat(this.style.left) : 8, top: this.style.top ? parseFloat(this.style.top) : 48 }; } });
const panel = mk();
const ctx = { AS: { FONT: 'x' }, document: { getElementById: () => panel, createElement: () => mk(), querySelector: () => null }, devicePixelRatio: 2, innerWidth: 1000, innerHeight: 700,
  localStorage: { m: {}, getItem(k) { return k in this.m ? this.m[k] : null; }, setItem(k, v) { this.m[k] = String(v); } } }; ctx.globalThis = ctx;
vm.createContext(ctx); vm.runInContext(fs.readFileSync(require('path').join(__dirname, '../js/graph.js'), 'utf8'), ctx);
const N = 24000, h = { length: N, grass: new Uint32Array(N), bunnies: new Uint32Array(N), wolves: new Uint32Array(N), humans: new Uint32Array(N) };
for (let i = 0; i < N; i++) { h.grass[i] = 20000 + (i % 977); h.bunnies[i] = i % 300; h.wolves[i] = i < 12000 ? i % 20 : 0; h.humans[i] = i < 6000 ? 0 : i % 7; }
const g = ctx.AS.Graph({}); const sim = { history: h };
g.draw(sim, 0); if (calls.stroke) throw new Error('drew while closed');
g.toggle(); g.draw(sim, 0); const full = calls.stroke;
panel.children[1].listeners.pointermove({ pointerId: 1, clientX: 200, clientY: 5 }); g.draw(sim, 1);
panel.children[1].listeners.wheel({ clientX: 300, deltaY: -800, preventDefault() {} }); g.draw(sim, 2);
h.length = 5; g.draw(sim, 3);

// Dragging the title bar moves the window, keeps it inside the viewport, and remembers where it ended.
const head = panel.children[0];
const down = (x, y) => head.listeners.pointerdown({ target: head, pointerId: 7, pointerType: 'mouse', button: 0, clientX: x, clientY: y, preventDefault() {} });
const move = (x, y) => head.listeners.pointermove({ pointerId: 7, clientX: x, clientY: y });
const up = () => head.listeners.pointerup({ pointerId: 7 });
const assert = require('assert');
assert.strictEqual(g.position(), null, 'no remembered place yet');
down(100, 60); move(400, 260); up();
assert.deepStrictEqual({ ...g.position() }, { x: 308, y: 248 }, 'follows the pointer');
down(400, 260); move(5000, 5000); up();
assert.deepStrictEqual({ ...g.position() }, { x: 1000 - 420, y: 700 - 320 }, 'clamped to the bottom right');
down(600, 400); move(-900, -900); up();
assert.deepStrictEqual({ ...g.position() }, { x: 0, y: 0 }, 'clamped to the top left');
const pressedButton = { ...g.position() };
head.listeners.pointerdown({ target: {}, pointerId: 8, pointerType: 'mouse', button: 0, clientX: 5, clientY: 5, preventDefault() {} });
head.listeners.pointermove({ pointerId: 8, clientX: 300, clientY: 300 });
assert.deepStrictEqual({ ...g.position() }, pressedButton, 'a press on a button in the title bar does not drag');
assert.strictEqual(ctx.localStorage.m['life-graph-pos'], '{"x":0,"y":0}', 'the place is saved');
g.toggle(); g.toggle();
ctx.localStorage.m['life-graph-pos'] = '{"x":900,"y":650}';
const g2 = ctx.AS.Graph({}); g2.toggle();
assert.deepStrictEqual({ ...g2.position() }, { x: 580, y: 380 }, 'a remembered place is restored and clamped to the viewport');
ctx.localStorage.m['life-graph-pos'] = 'garbage';
assert.strictEqual(ctx.AS.Graph({}).position(), null, 'a damaged saved place is ignored');
// The legend entries are buttons: a click gives a quick look on the map (onPulse), with a hint line saying so.
{ h.length = N;   // the full run again (humans appear halfway through it)
  const pulses = [], gp = ctx.AS.Graph({}, { onPulse: k => pulses.push(k) });
  const cv = panel.children[panel.children.length - 1];   // gp's canvas, the last thing it appended
  const at = (x, y) => ({ pointerId: 20, pointerType: 'mouse', button: 0, clientX: 8 + x, clientY: 48 + y });
  gp.toggle(); drawn.length = 0; gp.draw(sim, 100);
  assert(drawn.includes('(click to highlight on the map)'), 'the hint line is drawn under the legend');
  // Legend order: grass, bunnies, wolves (humans once a world has had one); an entry is a 14 px line sample,
  // a gap and the name (40 px in this fake), then a gap.
  const entryW = 19 + 40 + 16, x = i => 40 + i * entryW + 25;
  cv.listeners.pointerdown(at(x(0), 10)); assert.deepStrictEqual(pulses, ['blades'], 'grass is "blades" on the map');
  cv.listeners.pointerdown(at(x(1), 12)); cv.listeners.pointerdown(at(x(2), 8)); cv.listeners.pointerdown(at(x(3), 10));
  assert.deepStrictEqual(pulses, ['blades', 'bunnies', 'wolves', 'humans']);
  cv.listeners.pointerdown(at(x(0), 30)); cv.listeners.pointerdown(at(x(4), 10)); cv.listeners.pointerdown(at(300, 100));
  assert.strictEqual(pulses.length, 4, 'below the legend row, past the last entry, or on the plot is no click');
  gp.draw(sim, 1000); calls.stroke = 0; gp.draw(sim, 2000); const idleStrokes = calls.stroke; calls.stroke = 0;
  cv.listeners.pointermove({ pointerId: 21, clientX: 8 + x(1), clientY: 48 + 10 }); gp.draw(sim, 3000);
  assert(calls.stroke > idleStrokes && cv.style.cursor === 'pointer', 'a hovered entry is underlined and the cursor is a pointer');
  cv.listeners.pointerleave({ pointerId: 21 }); assert.strictEqual(cv.style.cursor, '', 'leaving drops the pointer cursor');
  const quiet = ctx.AS.Graph({}); quiet.toggle(); quiet.draw(sim, 100);
  panel.children[panel.children.length - 1].listeners.pointerdown(at(x(0), 10));   // no onPulse: nothing happens, nothing throws
  gp.toggle(); quiet.toggle(); }
g.toggle(); console.log('smoke ok, strokes', full, calls.stroke);
