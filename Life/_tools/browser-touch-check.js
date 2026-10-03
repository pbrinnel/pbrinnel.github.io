// Real touch-event drag on the map (CDP Input.dispatchTouchEvent) at phone size.
'use strict';
const { spawn } = require('child_process'); const os = require('os'), path = require('path'), fs = require('fs');
const PORT = 9336, CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-sim-touch-'));
const chrome = spawn(CHROME, [`--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check', '--window-size=600,900', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let url; for (let i = 0; i < 50 && !url; i++) { try { url = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch (e) {} if (!url) await sleep(200); }
  const ws = new WebSocket(url); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(); ws.onmessage = m => { const x = JSON.parse(m.data); if (pend.has(x.id)) { pend.get(x.id)(x); pend.delete(x.id); } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.result.value;
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.navigate', { url: process.env.LIFE_URL || 'http://localhost:8914/life.html' });
  for (let i = 0; i < 100 && !(await ev('!!(window.AS && AS.app)')); i++) await sleep(100);
  await ev('AS.app.setSpeed(0), 1');
  const before = await ev('[AS.app.cam.x, AS.app.cam.y]');
  const pts = [[200, 500], [180, 470], [150, 430], [120, 400], [100, 380]];
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
  for (const p of pts.slice(1)) { await sleep(30); await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p[0], y: p[1] }] }); }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(200);
  const after = await ev('[AS.app.cam.x, AS.app.cam.y, AS.app.cam.scale]');
  console.log(JSON.stringify({ before, after, movedTiles: [(after[0] - before[0]).toFixed(2), (after[1] - before[1]).toFixed(2)], expectedTiles: [(100 / after[2]).toFixed(2), (120 / after[2]).toFixed(2)] }));
  ws.close();
})().catch(e => console.error(e)).finally(() => { chrome.kill(); setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 500); });
