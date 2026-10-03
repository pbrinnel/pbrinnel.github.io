const vm = require('vm'), fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../js/camera.js'), 'utf8');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

function make(cw, ch, W = { w: 300, h: 200 }) {
  const handlers = {}, wh = {};
  const canvas = { clientWidth: cw, clientHeight: ch,
    addEventListener(t, f, o) { (handlers[t] ||= []).push(f); if (t === 'wheel') canvas.wheelOpts = o; },
    setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  const window = { addEventListener(t, f) { (wh[t] ||= []).push(f); } };
  const ctx = { AS: {}, window, Math, Map };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const cam = ctx.AS.Camera(canvas, W);
  const taps = [];
  cam.attach((x, y) => taps.push([x, y]));
  const fire = (t, e) => (handlers[t] || []).forEach(f => f(Object.assign({ pointerType: 'touch', button: 0, preventDefault() {} }, e)));
  return { cam, canvas, taps, fire, wh, W };
}

{ // start view
  const { cam } = make(800, 600);
  ok(cam.scale === 16, 'start scale 16');
  ok(near(cam.x + 800 / 16 / 2, 150) && near(cam.y + 600 / 16 / 2, 100), 'start centered');
  ok(cam.maxScale === 48, 'maxScale 48');
}
{ // zoomAt invariant + bounds
  const { cam } = make(800, 600);
  let worst = 0, inb = true;
  for (let i = 0; i < 2000; i++) {
    const px = Math.random() * 800, py = Math.random() * 600;
    const before = cam.screenToTile(px, py);
    const s0 = cam.scale, x0 = cam.x, y0 = cam.y;
    cam.zoomAt(px, py, Math.exp((Math.random() - 0.5) * 1.5));
    const after = cam.screenToTile(px, py);
    // Clamping may legitimately shift the view at the walls; only check when it didn't.
    const unclamped = true;
    if (cam.x > 0 && cam.y > 0 && cam.x + 800 / cam.scale < 300 && cam.y + 600 / cam.scale < 200 && cam.scale !== cam.minScale() && cam.scale !== 48)
      worst = Math.max(worst, Math.abs(before.x - after.x), Math.abs(before.y - after.y));
    if (cam.scale < cam.minScale() - 1e-12 || cam.scale > 48 + 1e-12) inb = false;
  }
  ok(worst <= 1e-9, 'zoomAt keeps point fixed (drift ' + worst + ')');
  ok(inb, 'scale within [minScale, maxScale]');
}
{ // exact fixed-point from a mid-world state
  const { cam } = make(800, 600);
  const b = cam.screenToTile(300, 200); cam.zoomAt(300, 200, 1.7); const a = cam.screenToTile(300, 200);
  ok(near(b.x, a.x) && near(b.y, a.y), 'zoomAt exact drift 0 mid-world');
}
{ // clamp
  const { cam } = make(375, 812);
  cam.zoomAt(100, 100, 1e-6);
  ok(near(cam.scale, cam.minScale()), 'zoom out hits minScale');
  const vh = 812 / cam.scale;
  ok(near(cam.x, 0) && near(cam.y, (200 - vh) / 2), 'smaller axis centered (y), fitting axis at 0');
  cam.panBy(500, 500);
  ok(near(cam.y, (200 - vh) / 2), 'pan cannot move a centered axis');
  const m = make(800, 600).cam;
  m.panBy(1e6, 1e6);
  ok(m.x === 0 && m.y === 0, 'clamped to top-left');
  m.panBy(-1e6, -1e6);
  ok(near(m.x, 300 - 800 / 16) && near(m.y, 200 - 600 / 16), 'clamped to bottom-right');
}
{ // visible
  const { cam } = make(800, 600);
  cam.x = 10.5; cam.y = 20.25;
  let v = cam.visible();
  ok(v.x0 === 10 && v.x1 === Math.ceil(10.5 + 50) - 1 && v.y0 === 20 && v.y1 === Math.ceil(20.25 + 37.5) - 1, 'visible mid-world ' + JSON.stringify(v));
  cam.x = 0; cam.y = 0; cam.scale = 16;
  v = cam.visible();
  ok(v.x0 === 0 && v.x1 === 49 && v.y1 === 37, 'visible integer edge exclusive ' + JSON.stringify(v));
  const s = make(375, 812).cam; s.zoomAt(0, 0, 1e-6);
  v = s.visible();
  ok(v.x0 === 0 && v.x1 === 299 && v.y0 === 0 && v.y1 === 199, 'visible clipped to world ' + JSON.stringify(v));
  const t = make(800, 600, { w: 10, h: 10 }).cam; t.x = 20; t.y = 20;
  v = t.visible(); ok(v.x1 < v.x0 || v.x0 > 9, 'visible none when off world');
}
{ // tap
  const t = make(800, 600);
  t.fire('pointerdown', { pointerId: 1, clientX: 400, clientY: 300 });
  t.fire('pointermove', { pointerId: 1, clientX: 403, clientY: 302 });
  const ex = t.cam.screenToTile(403, 302);
  t.fire('pointerup', { pointerId: 1, clientX: 403, clientY: 302 });
  ok(t.taps.length === 1 && t.taps[0][0] === Math.floor(ex.x) && t.taps[0][1] === Math.floor(ex.y), 'tap tile ' + t.taps[0]);
  ok(near(t.cam.x + 25, 150), 'tap did not pan');
}
{ // drag
  const t = make(800, 600), x0 = t.cam.x, y0 = t.cam.y;
  t.fire('pointerdown', { pointerId: 1, clientX: 400, clientY: 300 });
  t.fire('pointermove', { pointerId: 1, clientX: 415, clientY: 300 });
  t.fire('pointermove', { pointerId: 1, clientX: 430, clientY: 300 });
  t.fire('pointerup', { pointerId: 1, clientX: 430, clientY: 300 });
  ok(near(t.cam.x, x0 - 30 / 16) && near(t.cam.y, y0), '30px drag pans 30/scale');
  ok(t.taps.length === 0, 'drag fires no tap');
}
{ // pinch
  const t = make(800, 600), x0 = t.cam.x, y0 = t.cam.y;
  const before = t.cam.screenToTile(400, 300);
  t.fire('pointerdown', { pointerId: 1, clientX: 350, clientY: 300 });
  t.fire('pointerdown', { pointerId: 2, clientX: 450, clientY: 300 });
  t.fire('pointermove', { pointerId: 1, clientX: 300, clientY: 300 });
  t.fire('pointermove', { pointerId: 2, clientX: 500, clientY: 300 });
  ok(near(t.cam.scale, 32), 'pinch 100→200 doubles scale (' + t.cam.scale + ')');
  const after = t.cam.screenToTile(400, 300);
  ok(near(before.x, after.x) && near(before.y, after.y), 'pinch about midpoint');
  t.fire('pointerup', { pointerId: 2, clientX: 500, clientY: 300 });
  ok(t.taps.length === 0, 'pinch fires no tap');
  // lift one, move other: pan with no jump
  const cx = t.cam.x;
  t.fire('pointermove', { pointerId: 1, clientX: 300, clientY: 300 });
  ok(near(t.cam.x, cx), 'no jump after lifting a finger');
  t.fire('pointermove', { pointerId: 1, clientX: 340, clientY: 300 });
  ok(near(t.cam.x, cx - 40 / 32), 'remaining finger pans');
  t.fire('pointerup', { pointerId: 1, clientX: 340, clientY: 300 });
  ok(t.taps.length === 0, 'no tap after pinch+pan');
}
{ // tap off world
  const t = make(375, 812); t.cam.zoomAt(0, 0, 1e-6);
  t.fire('pointerdown', { pointerId: 1, clientX: 100, clientY: 5 });
  t.fire('pointerup', { pointerId: 1, clientX: 100, clientY: 5 });
  ok(t.taps.length === 1 && t.taps[0][0] === -1 && t.taps[0][1] === -1, 'tap off world → -1,-1');
}
{ // wheel
  const t = make(800, 600);
  const b = t.cam.screenToTile(200, 150), s = t.cam.scale;
  let prevented = false;
  t.fire('wheel', { clientX: 200, clientY: 150, deltaY: -100, deltaMode: 0, ctrlKey: false, preventDefault() { prevented = true; } });
  ok(near(t.cam.scale, s * Math.exp(0.15)), 'wheel -100 zooms in');
  const a = t.cam.screenToTile(200, 150);
  ok(near(a.x, b.x) && near(a.y, b.y), 'wheel zoom at cursor');
  ok(prevented && t.canvas.wheelOpts && t.canvas.wheelOpts.passive === false, 'wheel prevents default, non-passive');
}
{ // resize keeps center
  const t = make(800, 600);
  t.cam.panBy(-100, -80);
  const cx = t.cam.x + 400 / t.cam.scale, cy = t.cam.y + 300 / t.cam.scale, sc = t.cam.scale;
  t.canvas.clientWidth = 600; t.canvas.clientHeight = 800;
  t.wh.resize.forEach(f => f());
  ok(near(t.cam.x + 300 / t.cam.scale, cx) && near(t.cam.y + 400 / t.cam.scale, cy) && t.cam.scale === sc, 'resize keeps view center');
}
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
