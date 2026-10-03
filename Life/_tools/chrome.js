// Opens a page in a real windowed Chrome (throwaway profile, no background throttling) and
// drives it over the DevTools protocol. Shared by the tools that need real timing or
// long-running pages: the page must not be throttled the way a hidden tab is.
//
//   const page = await require('./chrome.js').open(url, { port, size: [w, h] });
//   await page.ev('js expression', awaitPromise = true)  → value
//   await page.send(method, params)                      → raw protocol result
//   page.close()                                         closes Chrome, deletes the profile
'use strict';
const { spawn } = require('child_process');
const os = require('os'), path = require('path'), fs = require('fs');

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));

exports.open = async function (url, opts = {}) {
  const port = opts.port || 9341;
  const [w, h] = opts.size || [900, 700];
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'life-chrome-'));
  const chrome = spawn(CHROME, [`--user-data-dir=${profile}`, `--remote-debugging-port=${port}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', `--window-size=${w},${h}`, 'about:blank'], { stdio: 'ignore' });
  const close = () => {
    chrome.kill();
    setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 500);
  };
  process.on('exit', () => chrome.kill());
  process.on('SIGINT', () => { close(); process.exit(130); });

  let ws;
  for (let i = 0; i < 50 && !ws; i++) {
    try {
      const t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(x => x.type === 'page');
      if (t) ws = new WebSocket(t.webSocketDebuggerUrl);
    } catch (e) { /* Chrome not up yet */ }
    if (!ws) await sleep(200);
  }
  if (!ws) { close(); throw new Error('Chrome never opened a debug port'); }
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = m => { const x = JSON.parse(m.data); if (pending.has(x.id)) { pending.get(x.id)(x); pending.delete(x.id); } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr, wait = true) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: wait });
    if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 600));
    return r.result.result.value;
  };
  await send('Page.navigate', { url });
  return { ev, send, close: () => { ws.close(); close(); } };
};
