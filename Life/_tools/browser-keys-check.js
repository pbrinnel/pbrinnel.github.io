'use strict';
const { spawn } = require('child_process'); const os = require('os'), path = require('path'), fs = require('fs');
const PORT = 9337, CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-sim-keys-'));
const chrome = spawn(CHROME, [`--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`, '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--window-size=1200,900', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let url; for (let i = 0; i < 50 && !url; i++) { try { url = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch (e) {} if (!url) await sleep(200); }
  const ws = new WebSocket(url); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(); ws.onmessage = m => { const x = JSON.parse(m.data); if (pend.has(x.id)) { pend.get(x.id)(x); pend.delete(x.id); } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.result.value;
  await send('Page.navigate', { url: process.env.LIFE_URL || 'http://localhost:8914/life.html' });
  for (let i = 0; i < 100 && !(await ev('!!(window.AS && AS.app)')); i++) await sleep(100);
  await ev('AS.app.setSpeed(0), 1');
  const key = async (type, k, code, vk, mods = 0) => send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, modifiers: mods });
  const pos = () => ev('[AS.app.cam.x, AS.app.cam.y]');
  const hold = async (k, code, vk, ms, mods = 0) => { const a = await pos(); await key('rawKeyDown', k, code, vk, mods); await sleep(ms); await key('keyUp', k, code, vk, mods); await sleep(50); const b = await pos(); return [(b[0] - a[0]).toFixed(1), (b[1] - a[1]).toFixed(1)]; };
  console.log('D 500ms (expect ~+22 x):', await hold('d', 'KeyD', 68, 500));
  console.log('ArrowUp 500ms (expect ~-22 y):', await hold('ArrowUp', 'ArrowUp', 38, 500));
  console.log('Shift+A 500ms (expect ~-66 x):', await hold('A', 'KeyA', 65, 500, 8));
  console.log('speed still paused after keys:', await ev('AS.app.speedIndex'));
  ws.close();
})().catch(e => console.error(e)).finally(() => { chrome.kill(); setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 500); });
