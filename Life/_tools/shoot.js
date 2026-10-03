// Screenshots the live sim in a real windowed Chrome (throwaway profile, no background
// throttling), after running a setup script in the page.
//
//   node Life/_tools/shoot.js <desktop|phone> <out.png> [setup-file.js] [query]
//
// The setup file is evaluated in the page (it may await) once AS.app exists; its value is
// printed. It should leave the view the way the screenshot wants it.
'use strict';
const { spawn } = require('child_process');
const os = require('os'), path = require('path'), fs = require('fs');

const [mode = 'desktop', out = 'shot.png', setupFile, query = ''] = process.argv.slice(2);
// A full http(s) or file URL as the query shoots that page instead (e.g. the tuning lab).
const URL = /^(https?|file):/.test(query) ? query : (process.env.LIFE_URL || 'http://localhost:8914/life.html') + query;
const DEBUG_PORT = 9334;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-sim-shot-'));
const chrome = spawn(CHROME, [
  `--user-data-dir=${profile}`, `--remote-debugging-port=${DEBUG_PORT}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows', '--window-size=1440,900', 'about:blank',
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  let wsUrl;
  for (let i = 0; i < 50 && !wsUrl; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json();
      wsUrl = (list.find(t => t.type === 'page') || {}).webSocketDebuggerUrl;
    } catch (e) { /* not up yet */ }
    if (!wsUrl) await sleep(200);
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = m => { const x = JSON.parse(m.data); if (x.id && pending.has(x.id)) { pending.get(x.id)(x); pending.delete(x.id); } };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 800));
    return r.result.result.value;
  };
  if (mode === 'phone') {
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  }
  await send('Page.navigate', { url: URL });
  for (let i = 0; i < 100 && !(await evaluate('!!((window.AS && AS.app) || (window.LAB && LAB.Pool))').catch(() => false)); i++) await sleep(100);
  if (setupFile) {
    const src = fs.readFileSync(setupFile, 'utf8');
    console.log(JSON.stringify(await evaluate(`(async () => { ${src} })()`)));
  }
  const errs = await evaluate(`window.__errs || []`);
  if (errs.length) console.log('page errors:', errs);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  console.log('saved ' + out);
  ws.close();
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => {
  chrome.kill();
  setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 500);
});
