'use strict';

    // ---- the VOLCANO's dark room (LAMPS) ----------------------------------------
    // The fight is in the dark: only what burns gives light. Whatever the light
    // doesn't reach is a flat silhouette with an ember rim, the memory scenes'
    // look, and the light turns it back into full colour. No darkening layer
    // is ever laid over a photo: each point is either the photo or the flat
    // silhouette, and DARK_STYLE is only how the two meet --
    //   0  a soft crossfade
    //   1  a ragged edge, drifting up like heat, each point one or the other
    //   2  the same with a band of ember where colour meets dark, like paper
    //      catching
    // What burns is drawn over all of it as it is (lampLater in lamps.js), and
    // so is what has to stay readable: his health, capsules, anything said.
    //
    // His own fire lights the whole of him however little is left, down to
    // 1 / DARK_SELF of it; less fire only shrinks the light he throws. With
    // none, open, he is just his outline.
    let DARK_ON     = 1;      // 1: the room is dark
    let DARK_STYLE  = 2;
    let DARK_SIL    = 1;      // 1: unlit is a flat dark fill; 0: only its rim shows
    let DARK_RIM    = 0.55;   // how bright the ember rim round a silhouette is
    let DARK_RIM_PX = 1.5;    // ...and how thick
    let DARK_ROOM   = 0.22;   // how much each light warms the room behind
    let DARK_FIRE_R = 230;    // px a burning fire lights
    let DARK_COLD_R = 0;      // ...a cold one, as a share of that: none, only its wick shows
    let DARK_BOSS_R = 300;    // px round him he lights, with all his fire in him; less with less
    let DARK_SELF   = 3;      // how much his own fire lights his body: at 1 / DARK_SELF of it or more, all of him
    let DARK_MET_R  = 150;    // px the meteor, its mark and the burning ground light
    let DARK_PAD    = 0;      // 1: the paddle and head give light whatever the paddle (EMBER always does)
    let DARK_PAD_R  = 150;
    let DARK_NOISE  = 0.45;   // how ragged the dissolving edge is
    let DARK_EDGE   = 0.12;   // ...and how wide its burning band
    let DARK_RISE   = 40;     // px/s the raggedness drifts up, like heat
    let DARK_CELL   = 3;      // px of field per cell of the light
    LAB_KNOBS.push('DARK_ON', 'DARK_STYLE', 'DARK_SIL', 'DARK_RIM', 'DARK_RIM_PX', 'DARK_ROOM', 'DARK_FIRE_R', 'DARK_COLD_R',
                   'DARK_BOSS_R', 'DARK_SELF', 'DARK_MET_R', 'DARK_PAD', 'DARK_PAD_R', 'DARK_NOISE', 'DARK_EDGE', 'DARK_RISE', 'DARK_CELL');

    const DARK_AT = 0.45;     // how much light turns a point to colour
    const DARK_PHASES = ['entrance', 'ready', 'play', 'cleared', 'ascend'];

    let darkBuf = null;

    // whether this frame is drawn in the dark: the LAMPS fight, from his
    // entrance to his fall, and nothing over it
    function darkOn() {
        return !!DARK_ON && labB === LAB_BOSS.lamps && !!lamp && DARK_PHASES.includes(phase) && !menuUp();
    }

    // The canvases and buffers, kept from frame to frame: four the size of
    // the screen, and the light at DARK_CELL px a cell.
    function darkBufs() {
        const W = canvas.width, H = canvas.height, cell = Math.max(1, Math.round(DARK_CELL));
        const gw = Math.ceil(LW / cell), gh = Math.ceil(LH / cell);
        if (!darkBuf) darkBuf = { big: [0, 1, 2, 3].map(() => document.createElement('canvas')),
                                  col: document.createElement('canvas'), edge: document.createElement('canvas'), noise: null };
        const d = darkBuf;
        for (const c of d.big) if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
        if (d.col.width !== gw || d.col.height !== gh) {
            d.col.width = d.edge.width = gw;
            d.col.height = d.edge.height = gh;
            d.colData = d.col.getContext('2d').createImageData(gw, gh);
            d.edgeData = d.edge.getContext('2d').createImageData(gw, gh);
            d.L = new Float32Array(gw * gh);
        }
        d.cell = cell; d.gw = gw; d.gh = gh;
        return d;
    }

    function darkClear(c) {
        const g = c.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
        g.clearRect(0, 0, c.width, c.height);
        return g;
    }

    // smooth value noise, 0..1, drifting up
    function darkNoiseAt(x, y) {
        const N = 64, d = darkBuf;
        if (!d.noise) { d.noise = new Float32Array(N * N); for (let i = 0; i < N * N; i++) d.noise[i] = Math.random(); }
        const s = 22, fx = x / s, fy = (y + clock * DARK_RISE) / s;
        const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const at = (i, j) => d.noise[((j % N + N) % N) * N + ((i % N + N) % N)];
        const ex = tx * tx * (3 - 2 * tx), ey = ty * ty * (3 - 2 * ty);
        const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * ex;
        const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * ex;
        return a + (b - a) * ey;
    }

    // what gives light this frame: { x, y, r } in the field
    function darkLights() {
        const out = [];
        // dying, his fires blaze up and burn down with him
        const pyre = bricks[0] && !bricks[0].alive ? lampPyre() : null;
        for (const l of lamp.lamps) {
            const r = pyre ? DARK_FIRE_R * (1 + 0.4 * pyre.blaze) * (1 - pyre.burn * 0.8) * pyre.ash
                           : DARK_FIRE_R * (DARK_COLD_R + (1 - DARK_COLD_R) * lampWarm(l));
            // on its flame, which stands in its middle over the log across its feet
            out.push({ x: l.u * LW, y: l.y + lampHalfH() - LAMP_W / SHAPE_ASPECT * 0.5 - 20, r });
        }
        if (!pyre) out.push({ x: lamp.x, y: lamp.y, r: DARK_BOSS_R * Math.max(lamp.heat, lampRear()) });
        const m = lamp.met;
        if (m) {
            const e = m.st === 'wind' ? Math.min(1, m.t / LAMP_MET_WIND) : 1;
            out.push({ x: m.tx, y: padY(), r: DARK_MET_R * 0.7 * e });
            if (m.st === 'fall') { const p = lampMetAt(m); out.push({ x: p.x, y: p.y, r: DARK_MET_R }); }
        }
        for (const p of lamp.burns) out.push({ x: p.x, y: padY(), r: DARK_MET_R * (1 - p.t / LAMP_BURN_SECS) });
        if (DARK_PAD || LAB.pad === 'ember') {
            for (const sg of segs()) out.push({ x: sg.cx, y: padY(), r: DARK_PAD_R });
            for (const b of balls) out.push({ x: b.x, y: b.y, r: DARK_PAD_R * 0.6 });
        }
        return out.filter(q => q.r > 1 && Number.isFinite(q.x + q.y + q.r));
    }

    // The light over the field, cell by cell, as two masks: where it is
    // colour, and where it is the burning edge. Each light only visits the
    // cells it reaches, and the noise is only read where it could tip a cell.
    function darkMasks(lights) {
        const d = darkBufs(), { cell, gw, gh, L } = d;
        L.fill(0);
        // his body, read off his mask, lit by his own fire whatever reach it throws
        const self = bricks[0] && bricks[0].alive ? Math.max(lamp.heat, lampRear()) * DARK_SELF : 0;
        if (self > 0) {
            const bw0 = LAMP_BOSS_W, bh0 = bw0 / SHAPE_ASPECT, mr = MASK.length, mc = MASK[0].length, flip = lamp.fx < 0;
            const i0 = Math.max(0, Math.floor((lamp.x - bw0 * 0.52) / cell)), i1 = Math.min(gw - 1, Math.ceil((lamp.x + bw0 * 0.52) / cell));
            const j0 = Math.max(0, Math.floor((lamp.y - bh0 * 0.54) / cell)), j1 = Math.min(gh - 1, Math.ceil((lamp.y + bh0 * 0.54) / cell));
            for (let j = j0; j <= j1; j++) {
                const r = Math.floor(((j + 0.5) * cell - lamp.y) / bh0 * mr + mr / 2);
                for (let i = i0; i <= i1; i++) {
                    let u = ((i + 0.5) * cell - lamp.x) / bw0;
                    if (flip) u = -u;
                    const q = Math.floor((u + 0.5) * mc);
                    // a cell either side, so the edge of him is lit to his outline
                    let on = false;
                    for (let jj = r - 1; jj <= r + 1 && !on; jj++) {
                        const row = MASK[jj];
                        if (!row) continue;
                        for (let ii = q - 1; ii <= q + 1; ii++) { const c = row[ii]; if (c && c !== '.') { on = true; break; } }
                    }
                    if (on) L[j * gw + i] += self;
                }
            }
        }
        for (const q of lights) {
            const i0 = Math.max(0, Math.floor((q.x - q.r) / cell)), i1 = Math.min(gw - 1, Math.ceil((q.x + q.r) / cell));
            const j0 = Math.max(0, Math.floor((q.y - q.r) / cell)), j1 = Math.min(gh - 1, Math.ceil((q.y + q.r) / cell));
            const r2 = q.r * q.r;
            for (let j = j0; j <= j1; j++) {
                const dy = (j + 0.5) * cell - q.y;
                for (let i = i0; i <= i1; i++) {
                    const dx = (i + 0.5) * cell - q.x, d2 = (dx * dx + dy * dy) / r2;
                    if (d2 < 1) L[j * gw + i] += (1 - d2) * (1 - d2);
                }
            }
        }
        const col = d.colData.data, edge = d.edgeData.data, half = DARK_NOISE / 2;
        for (let j = 0, k = 0; j < gh; j++) {
            for (let i = 0; i < gw; i++, k++) {
                const l = L[k];
                let c = 0, e = 0;
                if (DARK_STYLE === 0) c = Math.max(0, Math.min(1, (l - 0.15) / 0.6));
                else if (l - half > DARK_AT) c = 1;
                else if (l + half > DARK_AT - DARK_EDGE) {
                    const v = l + (darkNoiseAt((i + 0.5) * cell, (j + 0.5) * cell) - 0.5) * DARK_NOISE;
                    if (v > DARK_AT) c = 1;
                    else if (DARK_STYLE === 2 && v > DARK_AT - DARK_EDGE) e = 1;
                }
                col[k * 4 + 3] = c * 255;
                edge[k * 4 + 3] = e * 255;
            }
        }
        d.col.getContext('2d').putImageData(d.colData, 0, 0);
        d.edge.getContext('2d').putImageData(d.edgeData, 0, 0);
        return d;
    }

    // At the end of the field in draw(), before the popups and the HUD: the
    // field as it was drawn, taken back off the screen and laid down again in
    // the dark, then what burns and what must be read over it.
    function darkPass() {
        const later = lamp.emit || [];
        lamp.emit = null;
        const W = canvas.width, H = canvas.height, k = W / LW;
        const lights = darkLights();
        const d = darkMasks(lights);
        const [sil, rim, lit, brn] = d.big;
        // its silhouette and its rim, both flat, off what was drawn
        const sg = darkClear(sil);
        sg.drawImage(canvas, 0, 0);
        sg.globalCompositeOperation = 'source-in';
        sg.fillStyle = '#0b0908';
        sg.fillRect(0, 0, W, H);
        const rg = darkClear(rim);
        rg.drawImage(canvas, 0, 0);
        rg.globalCompositeOperation = 'source-in';
        rg.fillStyle = EMB_RIM;
        rg.fillRect(0, 0, W, H);
        // colour only where the light reaches
        const lg = darkClear(lit);
        lg.drawImage(canvas, 0, 0);
        lg.globalCompositeOperation = 'destination-in';
        lg.imageSmoothingEnabled = true;
        lg.drawImage(d.col, 0, 0, W, H);
        // the burning band: the silhouette's own shape, lit ember
        if (DARK_STYLE === 2) {
            const bg = darkClear(brn);
            bg.drawImage(rim, 0, 0);
            bg.globalCompositeOperation = 'destination-in';
            bg.imageSmoothingEnabled = true;
            bg.drawImage(d.edge, 0, 0, W, H);
        }

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, W, H);
        // the room, warmed round each light
        ctx.globalCompositeOperation = 'lighter';
        for (const q of lights) {
            const r = q.r * 1.6 * k, g = ctx.createRadialGradient(q.x * k, q.y * k, 0, q.x * k, q.y * k, r);
            g.addColorStop(0, 'rgba(226,104,58,' + DARK_ROOM + ')');
            g.addColorStop(1, 'rgba(226,104,58,0)');
            ctx.fillStyle = g;
            ctx.fillRect(q.x * k - r, q.y * k - r, r * 2, r * 2);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = DARK_RIM;
        const px = DARK_RIM_PX * k;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(rim, dx * px, dy * px);
        ctx.globalAlpha = 1;
        if (DARK_SIL) ctx.drawImage(sil, 0, 0);
        else {
            // only the rim: cut the body back out of it
            ctx.globalCompositeOperation = 'destination-out';
            ctx.drawImage(sil, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.drawImage(lit, 0, 0);
        if (DARK_STYLE === 2) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(brn, 0, 0);
        }
        ctx.restore();

        // what burns, as it is
        lamp.emitNow = true;
        later.forEach(f => f());
        lamp.emitNow = false;
        // and what has to be read over the dark, drawn again on top
        drawRings();
        drawCapsule();
        drawShout();
        if (typeof labDrawShouts === 'function') labDrawShouts();
        drawYell();
        drawTalk();
        if (typeof powDrawOver === 'function') powDrawOver();
    }

    LAB_BOSS.lamps.light = darkPass;
    LAB_BOSS.lamps.dark = darkOn;
