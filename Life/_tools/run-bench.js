// Runs the in-page benchmark in a real (windowed) Chrome with a throwaway profile, driven
// over the DevTools protocol, and prints the results panel's text.
//
//   node Life/_tools/run-bench.js [desktop|phone|capped30] [port=8914]
//
// capped30 hands the page only every other animation frame, the way Firefox on iOS does.
//
// The background-throttling flags keep Chrome from slowing frames when the window is
// covered, so the numbers don't depend on what else is on screen.
'use strict';
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const mode = process.argv[2] || 'desktop';
const port = process.argv[3] || '8914';
const URL = process.env.LIFE_URL || `http://localhost:${port}/life.html`;
const DEBUG_PORT = 9333;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-sim-bench-'));

const chrome = spawn(CHROME, [
  `--user-data-dir=${profile}`, `--remote-debugging-port=${DEBUG_PORT}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--window-size=1440,900', '--new-window', 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json();
      const page = list.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('Chrome never opened a debug port');
}

async function main() {
  const ws = new WebSocket(await target());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = m => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params = {}) => new Promise(res => {
    const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evaluate = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
    return r.result.result.value;
  };

  if (mode === 'capped30') {
    await send('Page.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = cb => raf(() => raf(cb));
    })();` });
  }
  if (mode === 'phone') {
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 3, mobile: true });
  }
  await send('Page.navigate', { url: URL });
  for (let i = 0; i < 100 && !(await evaluate('!!(window.AS && AS.app)').catch(() => false)); i++) await sleep(100);
  await evaluate(`AS.runBench(AS.app); [...document.querySelectorAll('#bench-confirm button')].find(b => b.textContent === 'Start').click(); true`);
  const t0 = Date.now();
  let last = '';
  for (;;) {
    await sleep(2000);
    const s = await evaluate(`(() => {
      const r = document.getElementById('bench-results');
      if (r) return 'DONE\\n' + r.innerText;
      const p = document.querySelector('.bench-progress');
      return p ? p.textContent : '(no progress label)';
    })()`);
    if (s.startsWith('DONE')) {
      console.log(s.slice(5));
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const file = path.join(__dirname, '../../.claude/life-shots', `bench-${mode}-results.png`);
      fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
      console.error('screenshot: ' + file);
      break;
    }
    if (s !== last) { console.error(`[${Math.round((Date.now() - t0) / 1000)} s] ${s}`); last = s; }
    if (Date.now() - t0 > 10 * 60 * 1000) { console.error('timed out'); break; }
  }
  ws.close();
}

main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => {
  chrome.kill();
  setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 500);
});
