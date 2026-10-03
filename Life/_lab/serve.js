// The tuning lab's server: serves the repo (so the lab can run the sim's own files and
// tables) and lets the lab's Save button write tables/species.csv and settings.csv.
//
//   node Life/_lab/serve.js          → http://localhost:8920/Life/_lab/
//
// Saving is accepted only from this Mac (loopback), never from another device on the
// network, and only for those two files; each save changes only the cells sent, through
// lab-tables.js, so Notes and layout stay as Paul left them.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const LAB = require('./lab-tables.js');

const PORT = Number(process.env.PORT || 8920);
const ROOT = path.resolve(__dirname, '../..');
const TABLES = path.join(ROOT, 'Life/tables');
const SAVABLE = new Set(['species', 'settings']);
const MAX_BODY = 1 << 20;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml',
};

const isLoopback = a => a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function serveFile(req, res) {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(ROOT, '.' + rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return send(res, 403, 'outside the repo');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'not found');
    send(res, 200, data, TYPES[path.extname(file)] || 'application/octet-stream');
  });
}

function save(req, res) {
  if (!isLoopback(req.socket.remoteAddress)) return send(res, 403, 'Saving works only from the Mac running the lab.');
  let body = '';
  req.on('data', c => { body += c; if (body.length > MAX_BODY) req.destroy(); });
  req.on('end', () => {
    try {
      const { edits } = JSON.parse(body);
      if (!Array.isArray(edits) || !edits.length) throw new Error('no edits');
      const texts = {};
      for (const e of edits) {
        if (!SAVABLE.has(e.file)) throw new Error(`can't save ${e.file}.csv`);
        if (typeof e.row !== 'string' || typeof e.col !== 'string' || typeof e.value !== 'string') throw new Error('bad edit');
        if (!(e.file in texts)) texts[e.file] = fs.readFileSync(path.join(TABLES, e.file + '.csv'), 'utf8');
      }
      const next = LAB.applyEdits(texts, edits);
      for (const f of Object.keys(next)) fs.writeFileSync(path.join(TABLES, f + '.csv'), next[f]);
      console.log(`saved ${edits.length} cell(s): ` + edits.map(e => `${e.file} ${e.row}/${e.col}=${e.value}`).join(', '));
      send(res, 200, JSON.stringify({ ok: true, saved: edits.length }), 'application/json');
    } catch (err) {
      send(res, 400, JSON.stringify({ ok: false, error: err.message }), 'application/json');
    }
  });
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/save') return save(req, res);
  if (req.method === 'GET' || req.method === 'HEAD') return serveFile(req, res);
  send(res, 405, 'method not allowed');
}).listen(PORT, () => {
  const lan = Object.values(os.networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal);
  console.log(`Tuning lab:  http://localhost:${PORT}/Life/_lab/`);
  if (lan) console.log(`From a phone: http://${lan.address}:${PORT}/Life/_lab/  (runs work; saving only from the Mac)`);
});
