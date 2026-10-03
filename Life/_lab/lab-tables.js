// Edits single cells of the tables' CSV text, leaving every other byte as it was (Notes,
// quoting, line endings, a BOM), so a save from the lab looks like Paul typed the change
// in Numbers. Shared by the page (to build what the workers run) and serve.js (to save).
//
//   LAB.csvCells(text)                    → [{ line, cells: [string] }] (data lines only)
//   LAB.getCell(text, rowName, colName)   → the cell's text, or null
//   LAB.setCell(text, rowName, colName, value) → new text
//   LAB.applyEdits(texts, edits)          → new { species, settings, ... } texts
//     edits: [{ file: 'species' | 'settings', row, col, value }]
(function (root) {
  'use strict';

  // Splits one CSV line into fields, remembering where each field's raw text starts and
  // ends so a single field can be replaced in place.
  function fields(line) {
    const out = [];
    let i = 0;
    for (;;) {
      const start = i;
      let value = '';
      if (line[i] === '"') {
        i++;
        for (;;) {
          if (i >= line.length) break;
          if (line[i] === '"') {
            if (line[i + 1] === '"') { value += '"'; i += 2; continue; }
            i++;
            break;
          }
          value += line[i++];
        }
        while (i < line.length && line[i] !== ',') value += line[i++];
      } else {
        while (i < line.length && line[i] !== ',') value += line[i++];
      }
      out.push({ value, start, end: i });
      if (i >= line.length) break;
      i++;   // the comma
    }
    return out;
  }

  function quote(v) {
    return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  // Lines with their terminators kept, so joining them back is lossless.
  function splitLines(text) {
    return text.match(/[^\r\n]*(\r\n|\r|\n|$)/g).filter((l, i, a) => l !== '' || i < a.length - 1);
  }

  function stripEol(l) { return l.replace(/(\r\n|\r|\n)$/, ''); }

  function header(lines) {
    const first = stripEol(lines[0]).replace(/^﻿/, '');
    return fields(first).map(f => f.value.trim());
  }

  const LAB = root.LAB = root.LAB || {};

  LAB.csvCells = function (text) {
    const lines = splitLines(text);
    return lines.slice(1).map(l => ({ line: l, cells: fields(stripEol(l)).map(f => f.value.trim()) }))
      .filter(r => r.cells.some(c => c !== ''));
  };

  function locate(text, rowName, colName) {
    const lines = splitLines(text);
    const ci = header(lines).indexOf(colName);
    if (ci < 0) return null;
    for (let li = 1; li < lines.length; li++) {
      const body = stripEol(lines[li]);
      const f = fields(body);
      if (f[0] && f[0].value.trim() === rowName) return { lines, li, body, f, ci };
    }
    return null;
  }

  LAB.getCell = function (text, rowName, colName) {
    const at = locate(text, rowName, colName);
    if (!at) return null;
    return at.f[at.ci] ? at.f[at.ci].value.trim() : '';
  };

  LAB.setCell = function (text, rowName, colName, value) {
    const at = locate(text, rowName, colName);
    if (!at) throw new Error(`no cell ${rowName} / ${colName}`);
    const { lines, li, body, f, ci } = at;
    const eol = lines[li].slice(body.length);
    let next;
    if (ci < f.length) {
      next = body.slice(0, f[ci].start) + quote(String(value)) + body.slice(f[ci].end);
    } else {
      next = body + ','.repeat(ci - f.length + 1) + quote(String(value));
    }
    lines[li] = next + eol;
    return lines.join('');
  };

  LAB.applyEdits = function (texts, edits) {
    const out = Object.assign({}, texts);
    for (const e of edits) out[e.file] = LAB.setCell(out[e.file], e.row, e.col, e.value);
    return out;
  };

  if (typeof module !== 'undefined') module.exports = LAB;
})(typeof globalThis !== 'undefined' ? globalThis : this);
