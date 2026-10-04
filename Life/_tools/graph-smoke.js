const vm = require('vm'), fs = require('fs');
const calls = {};
const c2d = new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 40 }) : (...a) => { calls[k] = (calls[k] || 0) + 1; }, set: () => true });
const mk = () => ({ children: [], style: { setProperty() {} }, listeners: {}, hidden: true, clientWidth: 420, clientHeight: 500, width: 0, height: 0,
  append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); }, addEventListener(t, f) { this.listeners[t] = f; },
  getContext() { return c2d; }, offsetWidth: 420, offsetHeight: 320, getBoundingClientRect() { return { left: this.style.left ? parseFloat(this.style.left) : 8, top: this.style.top ? parseFloat(this.style.top) : 48 }; } });
const panel = mk();
const ctx = { AS: { FONT: 'x' }, document: { getElementById: () => panel, createElement: () => mk(), querySelector: () => null }, devicePixelRatio: 2, innerWidth: 1000, innerHeight: 700,
  localStorage: { m: {}, getItem(k) { return k in this.m ? this.m[k] : null; }, setItem(k, v) { this.m[k] = String(v); } } }; ctx.globalThis = ctx;
vm.createContext(ctx); vm.runInContext(fs.readFileSync(require('path').join(__dirname, '../js/graph.js'), 'utf8'), ctx);
const N = 24000, h = { length: N, grass: new Uint32Array(N), bunnies: new Uint32Array(N), wolves: new Uint32Array(N) };
for (let i = 0; i < N; i++) { h.grass[i] = 20000 + (i % 977); h.bunnies[i] = i % 300; h.wolves[i] = i < 12000 ? i % 20 : 0; }
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
g.toggle(); console.log('smoke ok, strokes', full, calls.stroke);
