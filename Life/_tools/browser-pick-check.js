// Real mouse clicks pick an animal where its glyph is drawn, even mid-step between tiles.
//
//   node Life/_tools/browser-pick-check.js        (needs life.html served; LIFE_URL to override)
'use strict';
const chrome = require('./chrome.js');
const URL = process.env.LIFE_URL || 'http://localhost:8914/life.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const page = await chrome.open(URL, { port: 9342, size: [1200, 900] });
  let failed = 0;
  const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };
  try {
    for (let i = 0; i < 100 && !(await page.ev('!!(window.AS && AS.app)').catch(() => false)); i++) await sleep(100);
    // Run until some animal is about halfway through a step, then pause there.
    const target = await page.ev(`(async () => {
      const app = AS.app, W = app.sim.W, cam = app.cam;
      app.setSpeed(0);
      for (let i = 0; i < 600; i++) app.sim.tick();
      for (let i = 0; i < 400; i++) {
        app.sim.tick();
        for (let s = 0; s < W.aHigh; s++) {
          if (!W.aAlive[s] || W.aFrom[s] === W.aTile[s]) continue;
          const p = AS.glideProgress(W.aStepLeft[s], W.aStepDur[s], 0);
          if (p > 0.4 && p < 0.6) {
            const ax = W.tx(W.aFrom[s]), ay = W.ty(W.aFrom[s]);
            const wx = ax + (W.tx(W.aTile[s]) - ax) * p + 0.5, wy = ay + (W.ty(W.aTile[s]) - ay) * p + 0.5;
            cam.x = wx - innerWidth / 2 / cam.scale; cam.y = wy - innerHeight / 2 / cam.scale; cam.clamp();
            const r = document.getElementById('map').getBoundingClientRect();
            return { s, serial: W.aSerial[s], p, sx: r.left + (wx - cam.x) * cam.scale, sy: r.top + (wy - cam.y) * cam.scale,
              tileScreen: [r.left + (W.tx(W.aTile[s]) + 0.5 - cam.x) * cam.scale, r.top + (W.ty(W.aTile[s]) + 0.5 - cam.y) * cam.scale] };
          }
        }
      }
      return null;
    })()`);
    check(!!target, 'found an animal mid-step');
    if (target) {
      const click = async (x, y) => {
        for (const type of ['mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
        await sleep(150);
        return page.ev('AS.app.sel ? AS.app.sel.serial : 0');
      };
      check(await click(target.sx, target.sy) === target.serial, `click on the glyph (${Math.round(target.p * 100)}% through its step) selects it`);
      const empty = await page.ev(`(() => {
        const app = AS.app, W = app.sim.W, cam = app.cam, r = document.getElementById('map').getBoundingClientRect();
        for (let y = Math.ceil(cam.y) + 6; y < cam.y + innerHeight / cam.scale - 2; y++) for (let x = Math.ceil(cam.x) + 2; x < cam.x + innerWidth / cam.scale - 2; x++) {
          let clear = true;
          for (let dy = -1; dy <= 1 && clear; dy++) for (let dx = -1; dx <= 1; dx++) if (W.kind[W.tile(x + dx, y + dy)] !== AS.KIND.EMPTY) { clear = false; break; }
          if (clear) return [r.left + (x + 0.5 - cam.x) * cam.scale, r.top + (y + 0.5 - cam.y) * cam.scale];
        }
        return null;
      })()`);
      if (empty) check(await click(empty[0], empty[1]) === 0, 'click on empty ground clears the selection');
    }
  } finally {
    page.close();
  }
  console.log(failed ? `${failed} FAILED` : 'all passed');
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
