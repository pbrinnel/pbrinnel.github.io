// The tuning lab's page: edit the sim's numbers, run seeds in workers, search, and save.
// The pure helpers at the top (LAB.ui) have no DOM and are checked by ui-lab-check.js.
(function (root) {
  'use strict';
  const LAB = root.LAB = root.LAB || {};
  const ui = LAB.ui = {};

  const COLORS = { grass: '#199e70', bunnies: '#d95926', wolves: '#3987e5' };
  ui.COLORS = COLORS;

  const ARROW = ' → ';   // the shipped font has →
  const key = t => `${t.file}|${t.row}|${t.col}`;
  ui.key = key;
  ui.label = t => (t.group === 'World' ? t.row : `${t.group} ${t.row}`);

  ui.thousands = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const norm = s => String(s).trim().replace(/[–—]/g, '-');

  // fields: { key: text }. Returns the cells whose text differs from the loaded one and
  // parses; `invalid` lists the keys whose text doesn't parse.
  ui.buildEdits = function (tunables, fields) {
    const edits = [], invalid = [];
    for (const t of tunables) {
      const k = key(t);
      if (!(k in fields)) continue;
      const text = norm(fields[k]);
      if (text === norm(t.text)) continue;
      if (!LAB.parseValue(text)) { invalid.push(k); continue; }
      edits.push({ file: t.file, row: t.row, col: t.col, value: text });
    }
    return { edits, invalid };
  };

  // "Wolf LitterSize: 1-2 → 2-3", from edits and the loaded tunables.
  ui.changedList = function (tunables, edits) {
    const by = new Map(tunables.map(t => [key(t), t]));
    return edits.map(e => {
      const t = by.get(`${e.file}|${e.row}|${e.col}`);
      return `${t ? ui.label(t) : e.row}: ${t ? t.text : '?'}${ARROW}${e.value}`;
    });
  };

  ui.filesText = function (edits) {
    const f = [...new Set(edits.map(e => e.file + '.csv'))];
    return f.length > 1 ? f.slice(0, -1).join(', ') + ' and ' + f[f.length - 1] : f[0] || '';
  };

  ui.summarySentence = function (s, days, bunnyCap) {
    if (!s.seeds) return s.errors ? `${s.errors} seed${s.errors === 1 ? '' : 's'} failed with an error.` : 'No seeds finished.';
    const lead = s.survived === s.seeds && s.seeds > 1 ? `All ${s.seeds} seeds kept all three species for ${days} days.`
      : `${s.survived} of ${s.seeds} seed${s.seeds === 1 ? '' : 's'} kept all three species for ${days} days.`;
    const others = [];
    if (s.wolvesExtinct) others.push(`wolves died out in ${s.wolvesExtinct}`);
    if (s.bunniesExtinct) others.push(`bunnies died out in ${s.bunniesExtinct}`);
    if (s.grassExtinct) others.push(`grass died out in ${s.grassExtinct}`);
    if (s.booms) others.push(`bunnies boomed past ${ui.thousands(bunnyCap)} in ${s.booms}`);
    let out = lead;
    if (others.length) out += ` Others: ${others.join(', ')}.`;
    out += ` Average all-alive: ${Math.round(s.meanAllAliveDays)} days. Score ${s.score.toFixed(2)}.`;
    if (s.errors) out += ` ${s.errors} seed${s.errors === 1 ? '' : 's'} failed or were stopped.`;
    return out;
  };

  ui.seedCaption = function (r) {
    const base = `seed ${r.seed}`;
    switch (r.endReason) {
      case 'survived': return `${base} · survived`;
      case 'bunny boom': return `${base} · bunny boom day ${r.daysRun}`;
      case 'error': return `${base} · error`;
      case 'canceled': return `${base} · stopped`;
      default: return `${base} · ${r.endReason} day ${r.daysRun}`;
    }
  };

  // Default search range for a cell: half to double its current value.
  ui.defaultRange = function (p) {
    const lo = p.kind === 'range' ? p.lo : p.v, hi = p.kind === 'range' ? p.hi : p.v;
    if (lo === 0 && hi === 0) return { lo: 0, hi: 1 };
    // A count or range that starts at 1 or more never defaults to 0 (a litter of 0 means no
    // babies); the user can still type 0 into the range by hand.
    const whole = p.kind === 'range' || Number.isInteger(p.v);
    const low = lo >= 1 && whole ? Math.max(1, Math.floor(lo / 2)) : +(lo / 2).toFixed(3);
    return { lo: low, hi: +Math.max(hi * 2, low + 1e-9).toFixed(3) };
  };

  // Per pixel column: min and max of log10(1 + count) over the samples that fall in the
  // column. Sample i falls in column floor(i*cols/n), i.e. column c covers [ceil(c*n/cols), ceil((c+1)*n/cols)). Needs n >= cols.
  ui.downsample = function (arr, cols) {
    const n = arr.length, min = new Float64Array(cols), max = new Float64Array(cols);
    for (let c = 0; c < cols; c++) {
      const a = Math.ceil(c * n / cols), b = Math.ceil((c + 1) * n / cols);
      let lo = Infinity, hi = -Infinity;
      for (let i = a; i < b; i++) { const v = Math.log10(1 + arr[i]); if (v < lo) lo = v; if (v > hi) hi = v; }
      min[c] = lo; max[c] = hi;
    }
    return { min, max };
  };

  // Top of the shared y-axis, in log10 units: the next whole decade above the highest count.
  ui.yTop = function (results) {
    let m = 0;
    for (const r of results) if (r && r.history) for (const k of ['grass', 'bunnies', 'wolves']) {
      const h = r.history[k];
      for (let i = 0; i < h.length; i++) if (h[i] > m) m = h[i];
    }
    return Math.max(2, Math.ceil(Math.log10(1 + m) - 1e-9));
  };

  ui.tickLabel = k => k >= 6 ? (10 ** (k - 6)) + 'M' : k >= 3 ? (10 ** (k - 3)) + 'k' : String(10 ** k);

  if (typeof document === 'undefined') { if (typeof module !== 'undefined') module.exports = LAB; return; }

  // ---------------------------------------------------------------- page ---------
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  let loaded = null;          // the tables as on disk
  let tun = [];               // LAB.tunables(loaded)
  let fields = {};            // key -> applied text
  let invalid = new Set();
  let vary = {};              // key -> { lo, hi } for search
  const rows = {};            // key -> { row, input, sub }
  let pool = null;
  let runId = 0, results = [], selected = null, runHistory = [], running = false;
  let searchObj = null;

  const TABLES = ['species', 'variables', 'states', 'settings'];
  async function loadTables() {
    const t = {};
    await Promise.all(TABLES.map(async n => {
      const r = await fetch(`/Life/tables/${n}.csv`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`${n}.csv: HTTP ${r.status}`);
      t[n] = await r.text();
    }));
    return t;
  }

  function currentEdits() { return ui.buildEdits(tun, fields).edits; }
  function currentTexts() { return LAB.applyEdits(loaded, currentEdits()); }

  // ------------------------------------------------------------ numbers --------
  function buildNumbers() {
    const list = $('numberList');
    list.textContent = '';
    for (const k of Object.keys(rows)) delete rows[k];
    for (const g of ['Bunny', 'Wolf', 'Human', 'Grass', 'World']) {
      const box = el('div', 'group');
      box.appendChild(el('h3', null, g));
      for (const t of tun.filter(x => x.group === g)) {
        const k = key(t);
        const row = el('div', 'row');
        const cb = el('input'); cb.type = 'checkbox'; cb.title = 'vary in search'; cb.setAttribute('aria-label', 'vary ' + ui.label(t) + ' in search');
        cb.checked = !!vary[k];
        const name = el('div', 'name');
        name.append(t.row + ' ');
        if (t.unit) name.appendChild(el('span', 'unit', t.unit));
        const input = el('input', 'val'); input.type = 'text'; input.value = fields[k]; input.spellcheck = false;
        input.setAttribute('aria-label', ui.label(t));
        const sub = el('div', 'sub');
        const commit = () => {
          const text = input.value.trim();
          if (!LAB.parseValue(text)) { invalid.add(k); refresh(); return; }
          invalid.delete(k); fields[k] = text; input.value = text; refresh();
        };
        input.addEventListener('blur', commit);
        input.addEventListener('change', commit);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
        cb.addEventListener('change', () => {
          if (cb.checked) {
            const p = LAB.parseValue(fields[k]);
            vary[k] = ui.defaultRange(p);
          } else delete vary[k];
          refresh();
        });
        row.append(cb, name, input, sub);
        box.appendChild(row);
        rows[k] = { row, input, sub, t, cb };
      }
      list.appendChild(box);
    }
    applyFilter();
  }

  function applyFilter() {
    const q = $('filter').value.trim().toLowerCase();
    for (const k in rows) {
      const { row, t } = rows[k];
      row.hidden = !!q && !(`${t.row} ${t.group} ${t.unit}`.toLowerCase().includes(q));
    }
    document.querySelectorAll('#numberList .group').forEach(g => { g.hidden = ![...g.querySelectorAll('.row')].some(r => !r.hidden); });
  }

  function refresh() {
    const { edits } = ui.buildEdits(tun, fields);
    const changed = new Set(edits.map(e => `${e.file}|${e.row}|${e.col}`));
    for (const k in rows) {
      const r = rows[k];
      r.row.classList.toggle('changed', changed.has(k));
      r.row.classList.toggle('invalid', invalid.has(k));
      r.sub.textContent = '';
      if (invalid.has(k)) r.sub.appendChild(el('span', 'err', `Not a number, percent or range like 2-4: "${r.input.value}"`));
      if (changed.has(k)) {
        r.sub.appendChild(el('span', null, `was ${r.t.text}`));
        const b = el('button', null, 'reset'); b.type = 'button';
        b.addEventListener('click', () => { fields[k] = r.t.text; r.input.value = r.t.text; invalid.delete(k); refresh(); });
        r.sub.appendChild(b);
      }
      r.cb.checked = !!vary[k];
      if (vary[k]) {
        const rng = el('span', 'rng');
        rng.append('range ');
        const lo = el('input'), hi = el('input');
        for (const [inp, f] of [[lo, 'lo'], [hi, 'hi']]) {
          inp.type = 'number'; inp.step = 'any'; inp.value = vary[k][f];
          inp.setAttribute('aria-label', `${ui.label(r.t)} range ${f}`);
          inp.addEventListener('change', () => { const v = parseFloat(inp.value); if (isFinite(v)) vary[k][f] = v; });
        }
        rng.append(lo, ' to ', hi);
        r.sub.appendChild(rng);
      }
    }
    $('saveBtn').disabled = !edits.length || invalid.size > 0;
    const nv = Object.keys(vary).length;
    $('searchParams').textContent = nv ? `${nv} number${nv === 1 ? '' : 's'} will be varied: ${Object.keys(vary).map(k => ui.label(rows[k].t)).join(', ')}.` : 'No numbers ticked yet.';
  }

  function resetAll() {
    fields = {}; invalid = new Set();
    for (const t of tun) fields[key(t)] = t.text;
    for (const k in rows) rows[k].input.value = rows[k].t.text;
    refresh();
  }

  // --------------------------------------------------------------- charts ------
  function sizeCanvas(c, fallbackW, fallbackH) {
    const dpr = root.devicePixelRatio || 1;
    const w = c.clientWidth || fallbackW, h = c.clientHeight || fallbackH;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    return { g, w, h };
  }

  // opts: { yTop (log units), xMax (days), axes, hoverDay }
  function drawChart(canvas, r, opts) {
    const big = !!opts.axes;
    const { g, w, h } = sizeCanvas(canvas, big ? 600 : 190, big ? 300 : 90);
    const pad = big ? { l: 46, r: 10, t: 10, b: 38 } : { l: 2, r: 2, t: 3, b: 3 };
    const pw = Math.max(10, w - pad.l - pad.r), ph = Math.max(10, h - pad.t - pad.b);
    const X = d => pad.l + d / opts.xMax * pw, Y = v => pad.t + ph - v / opts.yTop * ph;
    g.font = '11px AgentSimMono, monospace';
    g.lineWidth = 1;
    // frame / grid
    g.strokeStyle = '#1d261d'; g.fillStyle = '#7d887d';
    if (big) {
      g.textAlign = 'right'; g.textBaseline = 'middle';
      g.beginPath(); g.moveTo(pad.l, Y(0) + .5); g.lineTo(pad.l + pw, Y(0) + .5); g.stroke();
      for (let k = 0; k <= opts.yTop; k++) {
        const y = Math.round(Y(Math.log10(1 + 10 ** k))) + .5;
        g.beginPath(); g.moveTo(pad.l, y); g.lineTo(pad.l + pw, y); g.stroke();
        g.fillText(ui.tickLabel(k), pad.l - 5, y);
      }
      g.textAlign = 'center'; g.textBaseline = 'top';
      const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find(s => opts.xMax / s <= 10) || 1000;
      for (let d = 0; d <= opts.xMax; d += step) { g.fillText(String(d), X(d), pad.t + ph + 6); }
      g.fillText('days (axis floor is 0 animals)', pad.l + pw / 2, pad.t + ph + 22);
    } else {
      g.strokeRect(.5, .5, w - 1, h - 1);
    }
    g.lineJoin = 'round';
    g.lineWidth = big ? 2 : 1.5;
    for (const sp of ['grass', 'bunnies', 'wolves']) {
      const arr = r.history[sp], n = arr.length;
      if (!n) continue;
      g.strokeStyle = COLORS[sp];
      g.beginPath();
      const cols = Math.floor(pw);
      if (n <= cols) {
        for (let i = 0; i < n; i++) {
          const x = X(i / 24), y = Y(Math.log10(1 + arr[i]));
          i ? g.lineTo(x, y) : g.moveTo(x, y);
        }
      } else {
        // The run may be shorter than the axis: columns span only its own days.
        const span = Math.max(1, Math.floor(cols * (n / 24) / opts.xMax));
        const ds = ui.downsample(arr, Math.min(span, n));
        const m = ds.min.length;
        let last = null;
        for (let c = 0; c < m; c++) {
          const x = pad.l + (c + .5) * (n / 24 / m) / opts.xMax * pw;
          const yl = Y(ds.min[c]), yh = Y(ds.max[c]);
          const down = last === null || last <= (yl + yh) / 2;   // keep the stroke continuous
          const a = down ? yh : yl, b = down ? yl : yh;
          c ? g.lineTo(x, a) : g.moveTo(x, a);
          g.lineTo(x, b); last = b;
        }
      }
      g.stroke();
    }
    if (big && opts.hoverDay != null) {
      const x = Math.round(X(opts.hoverDay)) + .5;
      g.strokeStyle = '#7d887d'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, pad.t); g.lineTo(x, pad.t + ph); g.stroke();
    }
    return { pad, pw };
  }

  function showDetail(i) {
    selected = i;
    document.querySelectorAll('#grid .card').forEach((c, j) => c.classList.toggle('sel', j === i));
    const r = results[i], box = $('detail');
    if (!r || !r.history) { box.hidden = true; return; }
    box.hidden = false; box.textContent = '';
    box.appendChild(el('div', null, ui.seedCaption(r)));
    const lg = el('div', 'legend');
    for (const [k, name] of [['grass', 'grass'], ['bunnies', 'bunnies'], ['wolves', 'wolves']]) {
      const s = el('span'); const sw = el('span', 'sw'); sw.style.background = COLORS[k]; s.append(sw, name); lg.appendChild(s);
    }
    box.appendChild(lg);
    const canvas = el('canvas'); box.appendChild(canvas);
    const ro = el('div', 'readout', 'Hover the chart for the counts on any day.'); box.appendChild(ro);
    const opts = { yTop: ui.yTop([r]), xMax: Math.max(1, r.daysAsked || r.daysRun), axes: true, hoverDay: null };
    let geo = drawChart(canvas, r, opts);
    const move = ev => {
      const rect = canvas.getBoundingClientRect();
      const px = (ev.clientX - rect.left) / rect.width * (canvas.clientWidth);
      const day = Math.min((r.history.grass.length - 1) / 24, Math.max(0, (px - geo.pad.l) / geo.pw * opts.xMax));
      const idx = Math.round(day * 24);
      opts.hoverDay = idx / 24;
      geo = drawChart(canvas, r, opts);
      const f = k => ui.thousands(r.history[k][idx]);
      ro.textContent = `day ${(idx / 24).toFixed(1)} · grass ${f('grass')} · bunnies ${f('bunnies')} · wolves ${f('wolves')}`;
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerleave', () => { opts.hoverDay = null; geo = drawChart(canvas, r, opts); });
  }

  // ----------------------------------------------------------------- runs ------
  function setRunning(on) {
    running = on;
    $('runBtn').disabled = on; $('stopBtn').disabled = !on;
  }

  function paintGrid(days) {
    const done = results.filter(Boolean);
    const yTop = ui.yTop(done);
    document.querySelectorAll('#grid .card').forEach((card, i) => {
      const r = results[i];
      if (!r || !r.history) return;
      drawChart(card.querySelector('canvas'), r, { yTop, xMax: days, axes: false });
    });
  }

  async function run() {
    const nSeeds = Math.max(1, Math.min(64, parseInt($('rSeeds').value) || 8));
    const days = Math.max(1, parseInt($('rDays').value) || 100);
    const cap = Math.max(0, parseInt($('rCap').value) || 0);
    const first = Math.max(0, parseInt($('rFirst').value) || 0);
    if (invalid.size) { $('runStatus').textContent = 'Fix the red numbers first.'; return; }
    if (searchObj) { $('runStatus').textContent = 'A search is running; stop it first.'; return; }
    const { edits } = ui.buildEdits(tun, fields);
    const texts = LAB.applyEdits(loaded, edits);
    const id = ++runId;
    results = new Array(nSeeds).fill(null); selected = null;
    $('detail').hidden = true; $('summary').textContent = '';
    const grid = $('grid'); grid.textContent = '';
    const cards = [], notes = [];
    for (let i = 0; i < nSeeds; i++) {
      const card = el('div', 'card'); const cv = el('canvas'); const cap2 = el('div', 'cap', `seed ${first + i} · waiting`);
      card.append(cv, cap2); card.addEventListener('click', () => showDetail(i));
      grid.appendChild(card); cards.push(cap2); notes.push(card);
    }
    setRunning(true);
    $('runStatus').textContent = `Running ${nSeeds} seeds × ${days} days on ${pool.size} worker${pool.size === 1 ? '' : 's'}...`;
    let finished = 0;
    const jobs = [];
    for (let i = 0; i < nSeeds; i++) {
      const seed = first + i;
      jobs.push(pool.run({ texts, seed, days, bunnyCap: cap, progressEvery: Math.max(1, Math.round(days / 20)) }, m => {
        if (id !== runId) return;
        cards[i].textContent = `seed ${seed} · day ${m.day}/${days} · g ${ui.thousands(m.grass)} b ${ui.thousands(m.bunnies)} w ${ui.thousands(m.wolves)}`;
      }).then(r => {
        if (id !== runId) return;
        if (r.seed == null) r.seed = seed;
        results[i] = r; finished++;
        cards[i].textContent = ui.seedCaption(r) + (r.endReason === 'error' ? `: ${r.error}` : '');
        cards[i].classList.toggle('bad', r.endReason === 'error');
        paintGrid(days);
        $('runStatus').textContent = `${finished} of ${nSeeds} seeds done.`;
      }));
    }
    await Promise.all(jobs);
    if (id !== runId) return;
    const s = LAB.summarize(results);
    $('summary').textContent = ui.summarySentence(s, days, cap);
    $('runStatus').textContent = '';
    setRunning(false);
    runHistory.unshift({ n: ++runCount, s, edits, days });
    runHistory = runHistory.slice(0, 8);
    paintHistory();
    paintGrid(days);
    if (!results.some(r => r && r.history && r.history.grass.length)) return;
    const firstOk = results.findIndex(r => r && r.history);
    if (firstOk >= 0) showDetail(firstOk);
  }
  let runCount = 0;

  function paintHistory() {
    const ol = $('history'); ol.textContent = '';
    for (const h of runHistory) {
      const ch = ui.changedList(tun, h.edits);
      const li = el('li', null, `Run ${h.n}: ${h.s.survived}/${h.s.seeds} survived (${h.days} days), score ${h.s.score.toFixed(2)} — ${ch.length ? 'changed: ' + ch.join('; ') : 'no changes'}`);
      ol.appendChild(li);
    }
  }

  function stop() { runId++ ; pool.cancelAll(); setRunning(false); $('runStatus').textContent = 'Stopped.'; }

  // --------------------------------------------------------------- search ------
  function candidateEl(c, i, n) {
    const li = el('li');
    const left = el('div');
    const s = c.summary;
    left.appendChild(el('div', null, `#${i + 1} · score ${s.score.toFixed(2)} · survived ${s.survived}/${s.seeds}`));
    // Compare against what is in the fields now (the search started from them), not the disk.
    const lines = c.edits.map(e => {
      const t = rows[`${e.file}|${e.row}|${e.col}`].t;
      return `${ui.label(t)}: ${fields[key(t)]}${ARROW}${e.value}`;
    });
    left.appendChild(el('div', 'dim', lines.join('; ') || 'no changes'));
    const b = el('button', null, 'Use these'); b.type = 'button';
    b.addEventListener('click', () => {
      for (const e of c.edits) {
        const k = `${e.file}|${e.row}|${e.col}`;
        fields[k] = e.value; invalid.delete(k); rows[k].input.value = e.value;
      }
      refresh();
    });
    li.append(left, b);
    return li;
  }

  async function startSearch() {
    if (!LAB.Search) return;
    if (running) { $('sStatus').textContent = 'A run is going; stop it first.'; return; }
    if (invalid.size) { $('sStatus').textContent = 'Fix the red numbers first.'; return; }
    const keys = Object.keys(vary);
    if (!keys.length) { $('sStatus').textContent = 'Tick at least one number to vary.'; return; }
    const params = [];
    for (const k of keys) {
      const t = rows[k].t, v = vary[k];
      if (!(isFinite(v.lo) && isFinite(v.hi) && v.lo <= v.hi)) { $('sStatus').textContent = `${ui.label(t)}: range needs low ≤ high.`; return; }
      params.push({ file: t.file, row: t.row, col: t.col, parsed: LAB.parseValue(fields[k]), lo: v.lo, hi: v.hi });
    }
    const budget = Math.max(1, parseInt($('sTries').value) || 60);
    const nSeeds = Math.max(1, parseInt($('sSeeds').value) || 4);
    const days = Math.max(1, parseInt($('sDays').value) || 60);
    const first = Math.max(0, parseInt($('rFirst').value) || 0);
    const seeds = Array.from({ length: nSeeds }, (_, i) => first + i);
    const bunnyCap = Math.max(0, parseInt($('rCap').value) || 0);
    let s;
    try { s = searchObj = LAB.Search({ pool, texts: currentTexts(), params, seeds, days, bunnyCap, budget }); }
    catch (err) { $('sStatus').textContent = 'Search failed to start: ' + err.message; searchObj = null; return; }
    $('sStart').disabled = true; $('sStop').disabled = false;
    $('sStatus').textContent = 'Starting...';
    const paint = u => {
      if (searchObj !== s) return;
      $('sStatus').textContent = `Tried ${u.tried} of ${u.budget}.`;
      const ol = $('sBest'); ol.textContent = '';
      (u.best || []).slice(0, 5).forEach((c, i, a) => ol.appendChild(candidateEl(c, i, a.length)));
    };
    try { const best = await s.start(paint); if (best && searchObj === s) $('sStatus').textContent += ' Done.'; }
    catch (err) { if (searchObj === s) $('sStatus').textContent = 'Search error: ' + err.message; }
    if (searchObj === s) searchObj = null;
    $('sStart').disabled = false; $('sStop').disabled = true;
  }

  function stopSearch() {
    if (searchObj) { const s = searchObj; s.stop(); $('sStatus').textContent += ' Stopped.'; }
    $('sStart').disabled = false; $('sStop').disabled = true;
  }

  // ----------------------------------------------------------------- save ------
  function openSave() {
    const { edits } = ui.buildEdits(tun, fields);
    if (!edits.length) return;
    const ul = $('saveList'); ul.textContent = '';
    for (const line of ui.changedList(tun, edits)) ul.appendChild(el('li', null, line));
    $('saveConfirm').hidden = false; $('saveMsg').textContent = ''; $('saveMsg').className = '';
  }

  async function doSave() {
    const { edits } = ui.buildEdits(tun, fields);
    const msg = $('saveMsg');
    try {
      const res = await fetch('/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ edits }) });
      const text = await res.text();
      let j; try { j = JSON.parse(text); } catch (e) { j = { ok: false, error: text || `HTTP ${res.status}` }; }
      if (!j.ok) throw new Error(j.error || 'save failed');
      const n = edits.length, files = ui.filesText(edits), keepVary = Object.keys(vary);
      await init(true);
      for (const k of keepVary) if (rows[k]) vary[k] = vary[k] || ui.defaultRange(LAB.parseValue(fields[k]));
      refresh();
      $('saveConfirm').hidden = true;
      msg.className = ''; msg.textContent = `Saved ${n} change${n === 1 ? '' : 's'} to ${files}.`;
    } catch (err) {
      msg.className = 'err'; msg.textContent = 'Not saved: ' + err.message;
    }
  }

  // ----------------------------------------------------------------- init ------
  async function init(reload) {
    loaded = await loadTables();
    tun = LAB.tunables(loaded);
    fields = {}; invalid = new Set();
    for (const t of tun) fields[key(t)] = t.text;
    if (reload) for (const k of Object.keys(vary)) if (!(k in fields)) delete vary[k];
    buildNumbers(); refresh();
  }

  async function main() {
    if (!LAB.Search) { $('searchBody').hidden = true; $('searchNA').hidden = false; }
    pool = LAB.Pool({ v: String(Date.now()) });
    try { await init(false); } catch (err) { $('numberList').textContent = 'Could not load the tables: ' + err.message; return; }
    $('filter').addEventListener('input', applyFilter);
    $('resetAll').addEventListener('click', resetAll);
    $('runBtn').addEventListener('click', run);
    $('stopBtn').addEventListener('click', stop);
    $('sStart').addEventListener('click', startSearch);
    $('sStop').addEventListener('click', stopSearch);
    $('saveBtn').addEventListener('click', openSave);
    $('saveNo').addEventListener('click', () => { $('saveConfirm').hidden = true; });
    $('saveYes').addEventListener('click', doSave);
    let t = null;
    root.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (results.some(Boolean)) { paintGrid(parseInt($('rDays').value) || 100); if (selected != null) showDetail(selected); } }, 150); });
  }
  main();
})(typeof globalThis !== 'undefined' ? globalThis : this);
