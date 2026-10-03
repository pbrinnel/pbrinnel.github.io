const vm = require('vm'), fs = require('fs');
const calls = {};
const c2d = new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 40 }) : (...a) => { calls[k] = (calls[k] || 0) + 1; }, set: () => true });
const mk = () => ({ children: [], style: { setProperty() {} }, listeners: {}, hidden: true, clientWidth: 420, clientHeight: 500, width: 0, height: 0,
  append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); }, addEventListener(t, f) { this.listeners[t] = f; },
  getContext() { return c2d; }, getBoundingClientRect() { return { left: 0 }; } });
const panel = mk();
const ctx = { AS: { FONT: 'x' }, document: { getElementById: () => panel, createElement: () => mk(), querySelector: () => null }, devicePixelRatio: 2 }; ctx.globalThis = ctx;
vm.createContext(ctx); vm.runInContext(fs.readFileSync(require('path').join(__dirname, '../js/graph.js'), 'utf8'), ctx);
const N = 24000, h = { length: N, grass: new Uint32Array(N), bunnies: new Uint32Array(N), wolves: new Uint32Array(N) };
for (let i = 0; i < N; i++) { h.grass[i] = 20000 + (i % 977); h.bunnies[i] = i % 300; h.wolves[i] = i < 12000 ? i % 20 : 0; }
const g = ctx.AS.Graph({}); const sim = { history: h };
g.draw(sim, 0); if (calls.stroke) throw new Error('drew while closed');
g.toggle(); g.draw(sim, 0); const full = calls.stroke;
panel.children[1].listeners.pointermove({ pointerId: 1, clientX: 200, clientY: 5 }); g.draw(sim, 1);
panel.children[1].listeners.wheel({ clientX: 300, deltaY: -800, preventDefault() {} }); g.draw(sim, 2);
h.length = 5; g.draw(sim, 3); g.toggle(); console.log('smoke ok, strokes', full, calls.stroke);
