'use strict';

    // ---- the VOID's storm (LUCIFER) ---------------------------------------------
    // He fights in a storm, and it builds with him. The fight opens in the
    // dark: everything a flat silhouette with a cold rim. Lightning comes at
    // odd times, and each strike flips the field between that silhouette and
    // full colour (STORM_MODE 0), or lights it for a moment (1). Where a bolt
    // comes down, his shadow is thrown up huge on the sky behind him, and the
    // thunder follows. Feathers of his fall through the dark, as he did.
    //
    // All of it is the sky, and has to look it, so nothing of it is ever
    // taken for something coming at you: it is drawn behind the field, never
    // rimmed the way the field's pieces are, and it fades out before it
    // reaches you -- a bolt goes into the distance at STORM_HORIZON, a
    // feather is only dark against the dark until a flash shows it.
    //
    // The second part strikes more often, and some of it strikes him.
    // The drain is in the dark and still: no lightning, only your light
    // running up his hand. Through the change the bolts come down into him,
    // quicker and quicker, his shadow on the sky changing with him, and as
    // his body falls away every one of them strikes at once and the field
    // comes up in colour for good.
    //
    // The last part is the storm in full: red, close, constant. Every hit you
    // land on him cracks his sky, each crack running off the last, and the
    // bolts come out of the cracks. A strike may drop the field into his red
    // silhouette for an instant. When he dies the storm dies with him and
    // his cracked sky turns to HIS gold and fades.
    //
    // Nothing here changes the fight: it only draws. What has to be read
    // stays readable, drawn again over the dark: you and your heads (unless
    // STORM_YOU is off), his bar, his beams, capsules, anything said.
    //
    // Photosensitive safety (WCAG 2.3.1, as the brandon.html storm): swells,
    // not strobes. Every strike is a flash and is rationed -- never more than
    // STORM_MAX_FLASH in any second (the limit is three); a strike with no
    // room waits. A sky flash rises over STORM_RISE and falls over
    // STORM_FLASH_SECS, peaking at STORM_PEAK, well short of white. Nothing
    // turns the whole field over in one frame: colour and silhouette always
    // dissolve into each other, and a part-three dip is a ramp down and up.
    // A bolt flickers, but dimly and over a small part of the screen. The red
    // of part three never flashes saturated: its flash is a pale rose. A
    // player whose system asks for reduced motion gets a third of the flash,
    // no dips and no thunder shake.
    let STORM_ON       = 1;
    let STORM_MODE     = 0;      // 0: a strike flips colour and silhouette; 1: it lights the field for STORM_HOLD
    let STORM_HOLD     = 1.6;    // seconds a strike leaves it lit, in mode 1
    let STORM_FADE     = 0.5;    // seconds colour takes to burn back into the dark
    let STORM_GAP1     = 4;      // seconds between strikes in the first part, on average...
    let STORM_GAP2     = 2.6;    // ...the second
    let STORM_GAP3     = 1.4;    // ...the last
    let STORM_JITTER   = 0.7;    // ...give or take this share of it
    let STORM_AT_HIM   = 0.35;   // share of the second part's strikes that hit him
    let STORM_FLASH    = 0.3;    // how bright the sky flashes at a strike
    let STORM_FLASH_SECS = 0.5;  // ...falling away over this
    let STORM_SHADOW   = 0.6;    // his shadow on the sky, how dark; 0 none
    let STORM_SHADOW_X = 2.3;    // ...and how much bigger than him
    let STORM_THUNDER  = 4;      // px the field shakes with the thunder
    let STORM_LAG      = 0.45;   // seconds before it comes, from a far strike; a near one, sooner
    let STORM_FEATHERS = 12;     // feathers falling in the first two parts
    let STORM_YOU      = 1;      // 1: you and your heads stay in colour in the dark
    let STORM_TURN     = 1;      // 1: the change is struck into him
    let STORM_CRACKS   = 1;      // 1: in the last part each hit on him cracks the sky
    let STORM_DIP3     = 0.14;   // seconds a last-part strike drops the field into his silhouette; 0 never
    let STORM_DIP3_ODDS = 0.4;   // ...the share of strikes that do
    let STORM_MAX_FLASH = 2;     // flashes in any one second, never more
    let STORM_RISE     = 0.1;    // seconds a flash takes to come up
    let STORM_HORIZON  = 0.5;    // how far down the field the sky's bolts go before they are gone
    LAB_KNOBS.push('STORM_ON', 'STORM_MODE', 'STORM_HOLD', 'STORM_FADE', 'STORM_GAP1', 'STORM_GAP2', 'STORM_GAP3',
                   'STORM_JITTER', 'STORM_AT_HIM', 'STORM_FLASH', 'STORM_FLASH_SECS', 'STORM_SHADOW', 'STORM_SHADOW_X',
                   'STORM_THUNDER', 'STORM_LAG', 'STORM_FEATHERS', 'STORM_YOU', 'STORM_TURN', 'STORM_CRACKS',
                   'STORM_DIP3', 'STORM_DIP3_ODDS', 'STORM_MAX_FLASH', 'STORM_HORIZON', 'STORM_RISE');
    const STORM_PEAK = 0.45;     // the most a flash ever lights the sky
    const STORM_SWAP = 0.2;      // seconds the dark takes to dissolve into colour at a strike
    const STORM_DIP_RAMP = 0.08; // ...and a dip takes to go down, and again to come up
    // the player's system asking for less motion
    const stormCalm = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

    const STORM_SIL = '#0b0a12', STORM_RIM = '#8d97d4';         // the dark, moonlit
    const STORM_SIL3 = '#140407', STORM_RIM3 = '#d8402c';       // ...and his, in the last part
    const STORM_BOLT = '#eef0ff', STORM_BOLT3 = '#ff7a5c';
    const STORM_GLOW = '170,175,255', STORM_GLOW3 = '255,70,50', STORM_GOLD = '232,182,76';
    const STORM_FEATHER = '#2a2733';
    const STORM_LINK = 16;       // px of bolt per little Brandon in it
    const STORM_CELL = 4;        // px of field per cell of the light mask
    const STORM_RIM_PX = 1.5;

    let storm = null;

    function stormNew() {
        return { lu, last: clock, k: 0, kTo: 0, holdT: 0, next: 2.5, bolts: [], flash: 0, flashUp: 0, flashes: [],
                 shadows: [], quakes: [], shake: 0, feathers: [], cracks: [], dip: 0, hp: null, stage: null,
                 turnNext: 0, fell: false, gold: 0, sky3: 0, buf: null };
    }

    function stormOn() {
        if (!STORM_ON || labB !== LAB_BOSS.lucifer || !lu || !lu.bd || menuUp()) return false;
        if (!storm || storm.lu !== lu) storm = stormNew();
        return true;
    }

    const stormRand = (a, b) => a + Math.random() * (b - a);
    const stormGap = g => g * (1 + (Math.random() * 2 - 1) * STORM_JITTER);
    const stormEase = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

    // where his head is, whichever of him is up
    function stormHim() {
        if (lu.cf && ['turn', 3, 'dying', 'end'].includes(lu.stage)) return { x: lu.cf.fx, y: lu.cf.fy };
        return { x: lu.bd.hx, y: lu.bd.hy };
    }

    // a flash, if the second has room for one
    function stormFlash(power) {
        const now = clock;
        storm.flashes = storm.flashes.filter(t => now - t < 1);
        if (storm.flashes.length >= STORM_MAX_FLASH) return false;
        storm.flashes.push(now);
        storm.flashUp = Math.max(storm.flashUp, power);
        return true;
    }

    // A bolt from the top of the field (or out of a crack) to (x, y): a
    // jagged run, forking once or twice, every link a little Brandon.
    function stormBolt(x, y, red, from, sky) {
        const sx = from ? from.x : x + stormRand(-140, 140), sy = from ? from.y : -10;
        const path = stormJag(sx, sy, x, y, Math.hypot(x - sx, y - sy) * 0.18);
        const forks = [];
        for (let f = 0, n = Math.random() < 0.6 ? 1 : 2; f < n; f++) {
            const i = Math.floor(stormRand(0.2, 0.7) * (path.length - 1)), p = path[i];
            const a = Math.atan2(y - sy, x - sx) + (Math.random() < 0.5 ? -1 : 1) * stormRand(0.4, 0.9);
            const len = stormRand(50, 130);
            forks.push(stormJag(p.x, p.y, p.x + Math.cos(a) * len, p.y + Math.sin(a) * len, len * 0.2));
        }
        storm.bolts.push({ path, forks, t: 0, red, fadeY: sky ? STORM_HORIZON * LH : 0 });
    }

    // midpoint displacement, down to links about STORM_LINK long
    function stormJag(x0, y0, x1, y1, rough) {
        let pts = [{ x: x0, y: y0 }, { x: x1, y: y1 }];
        while (Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) > STORM_LINK * 1.5 && pts.length < 128) {
            const out = [pts[0]];
            for (let i = 1; i < pts.length; i++) {
                const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
                const off = (Math.random() * 2 - 1) * rough;
                out.push({ x: (a.x + b.x) / 2 - dy / d * off, y: (a.y + b.y) / 2 + dx / d * off }, b);
            }
            pts = out;
            rough *= 0.55;
        }
        return pts;
    }

    // A strike: the bolt, the flash, his shadow thrown from where it lands,
    // and the thunder after. `toggle` is whether it may change the dark.
    function stormStrike(opts) {
        if (!stormFlash(opts.power || 1)) return false;
        const him = stormHim();
        const at = opts.him ? { x: him.x, y: him.y } : { x: opts.x !== undefined ? opts.x : stormRand(40, LW - 40), y: STORM_HORIZON * LH + 40 };
        stormBolt(at.x, at.y, opts.red, opts.from, !opts.him);
        if (STORM_SHADOW > 0) storm.shadows.push({ x: at.x, y: him.y + LU_L * 0.6, t: 0, power: opts.power || 1 });
        const near = Math.min(1, Math.abs(at.x - him.x) / (LW / 2));
        storm.quakes.push({ t: -STORM_LAG * (opts.him ? 0.15 : 0.4 + 0.6 * near), power: opts.power || 1 });
        if (opts.toggle === false) return true;
        if (opts.red) {
            if (STORM_DIP3 > 0 && Math.random() < STORM_DIP3_ODDS && !stormCalm()) storm.dip = STORM_DIP3;
        } else if (STORM_MODE === 0) {
            storm.kTo = storm.kTo > 0.5 ? 0 : 1;
        } else {
            storm.kTo = 1; storm.holdT = STORM_HOLD;
        }
        return true;
    }

    function stormStep(dt, b) {
        const s = storm, st = lu.stage, live = phase === 'play' && !lu.mem;
        // a new stage is a new kind of weather
        if (st !== s.stage) {
            if (st === 'drain') { s.kTo = 0; s.holdT = 0; }
            if (st === 'turn') { s.turnNext = 0.8; s.fell = false; s.kTo = 0; s.holdT = 0; }
            if (st === 'dying') s.kTo = 1;
            s.stage = st;
        }
        if (phase === 'entrance') {
            // he comes down in the dark, and the first strike shows him
            if (!s.entered) s.k = s.kTo = 0;
            if (!s.entered && enterK() > 0.55) { s.entered = true; stormStrike({ him: true, power: 1.2 }); }
        } else if (live && (st === 1 || st === 2 || st === 'break')) {
            s.next -= dt;
            if (s.next <= 0) {
                const two = st === 2;
                s.next = stormStrike({ him: two && Math.random() < STORM_AT_HIM }) ? stormGap(two ? STORM_GAP2 : STORM_GAP1) : 0.25;
            }
        } else if (st === 'turn' && STORM_TURN) {
            // struck into him, quicker as the change goes on, and all at once
            // as his body falls
            const T = luCorruptTimes(), k = Math.min(1, lu.sec / T.fallAt);
            if (!s.fell && lu.sec >= T.fallAt) {
                s.fell = true;
                const him = stormHim();
                for (let i = 0; i < 4; i++) stormBolt(him.x, him.y, true, { x: him.x + (i - 1.5) * 160, y: -10 });
                // the one flash of the change that is sure to land: the strikes
                // before it make room for it
                s.flashes = [];
                stormFlash(2.2);
                storm.shadows.push({ x: him.x, y: him.y + LU_L * 0.6, t: 0, power: 2 });
                storm.quakes.push({ t: -0.05, power: 3 });
                s.kTo = 1;
                s.sky3 = 0.0001;
            } else if (!s.fell) {
                s.turnNext -= dt;
                if (s.turnNext <= 0) {
                    s.turnNext = stormStrike({ him: true, red: k > 0.5, toggle: false, power: 0.6 + k * 0.6 }) ? 2.2 - 1.5 * k : 0.25;
                }
            }
        } else if (live && st === 3) {
            s.next -= dt;
            if (s.next <= 0) {
                const from = s.cracks.length ? s.cracks[Math.floor(Math.random() * s.cracks.length)] : null;
                const tip = from ? from.path[from.path.length - 1] : null;
                s.next = stormStrike({ red: true, from: tip, him: Math.random() < 0.3 }) ? stormGap(STORM_GAP3) : 0.25;
            }
        }
        if (st === 3 && !s.fell) { s.fell = true; s.kTo = 1; }   // jumped straight in
        // the sky goes red with the change, and gold as he dies
        s.sky3 = st === 3 || (st === 'turn' && s.fell) ? Math.min(1, s.sky3 + dt / 2) : st === 'dying' || st === 'end' ? Math.max(0, s.sky3 - dt / 3) : 0;
        if (st === 'dying' || st === 'end') s.gold = Math.min(1, s.gold + dt / 1.5);

        // every hit on him in the last part cracks his sky, off the last crack
        if (s.hp !== null && b.hp < s.hp && st === 3 && STORM_CRACKS) stormCrack();
        s.hp = b.hp;

        if (s.holdT > 0 && (s.holdT -= dt) <= 0) s.kTo = 0;
        const calm = stormCalm() ? 2 : 1;
        s.k = s.k < s.kTo ? Math.min(s.kTo, s.k + dt / (STORM_SWAP * calm)) : Math.max(s.kTo, s.k - dt / (STORM_FADE * calm));
        s.dip = Math.max(0, s.dip - dt);
        s.dipK = s.dip > 0 ? Math.min(1, (s.dipK || 0) + dt / STORM_DIP_RAMP) : Math.max(0, (s.dipK || 0) - dt / STORM_DIP_RAMP);
        // the flash: up over STORM_RISE, down over STORM_FLASH_SECS -- a swell
        if (s.flashUp > 0) { s.flash = Math.min(s.flashUp, s.flash + dt / STORM_RISE * s.flashUp); if (s.flash >= s.flashUp) s.flashUp = 0; }
        else s.flash = Math.max(0, s.flash - dt / STORM_FLASH_SECS);
        for (const bo of s.bolts) bo.t += dt;
        s.bolts = s.bolts.filter(bo => bo.t < 0.5);
        for (const sh of s.shadows) sh.t += dt;
        s.shadows = s.shadows.filter(sh => sh.t < STORM_FLASH_SECS * 1.6);
        s.shake = 0;
        for (const q of s.quakes) {
            q.t += dt;
            if (q.t > 0) s.shake = Math.max(s.shake, q.power * Math.max(0, 1 - q.t / 0.6));
        }
        s.quakes = s.quakes.filter(q => q.t < 0.6);
        for (const c of s.cracks) c.grow = Math.min(1, c.grow + dt / 0.3);
        stormFeathersStep(dt);
    }

    function stormCrack() {
        const s = storm, last = s.cracks[s.cracks.length - 1];
        let x0, y0;
        if (!last || Math.random() < 0.18) {
            // a new one, in from the top or a side of the sky
            const side = Math.floor(Math.random() * 3);
            x0 = side === 0 ? stormRand(60, LW - 60) : side === 1 ? 0 : LW;
            y0 = side === 0 ? 0 : stormRand(20, LH * 0.3);
        } else {
            const p = last.path[Math.floor(stormRand(0.4, 1) * (last.path.length - 1))];
            x0 = p.x; y0 = p.y;
        }
        const a = Math.atan2(stormHim().y * 0.6 - y0, LW / 2 - x0) + stormRand(-1.1, 1.1);
        const len = stormRand(60, 140);
        const x1 = Math.max(0, Math.min(LW, x0 + Math.cos(a) * len)), y1 = Math.max(0, Math.min(LH * 0.45, y0 + Math.sin(a) * len));
        s.cracks.push({ path: stormJag(x0, y0, x1, y1, len * 0.22), grow: 0 });
    }

    function stormFeathersStep(dt) {
        const s = storm, want = lu.stage === 1 || lu.stage === 2 || lu.stage === 'break' || lu.stage === 'drain' ? STORM_FEATHERS : 0;
        while (s.feathers.length < want) {
            s.feathers.push({ x: stormRand(0, LW), y: s.feathers.length < want / 2 && !s.seeded ? stormRand(-20, LH) : stormRand(-120, -20),
                              len: 0, a: stormRand(0, 6.3), va: stormRand(-0.8, 0.8),
                              z: stormRand(0.4, 1), ph: stormRand(0, 6.3), sway: stormRand(14, 30) });
            // nearer is bigger and falls faster
            const f = s.feathers[s.feathers.length - 1];
            f.len = 16 + 26 * f.z; f.vy = 14 + 28 * f.z;
        }
        s.seeded = true;
        for (const f of s.feathers) {
            f.y += f.vy * dt; f.ph += dt * 1.3; f.a += f.va * dt;
            f.dx = Math.sin(f.ph) * f.sway;
        }
        // off the bottom; once none are wanted, the ones still above the field never come
        s.feathers = s.feathers.filter(f => f.y < LH + 40 && (want > 0 || f.y > -20));
    }

    function stormDrawFeathers() {
        const img = shapeSprite('stormFeather', STORM_FEATHER, 120, 120 / SHAPE_ASPECT, true);
        if (!img) return;
        // only dark on the dark, until a flash throws them up against the sky;
        // and gone before they come down to you
        const low = padY() - padH() * 6;
        for (const f of storm.feathers) {
            const th = f.len / SHAPE_ASPECT;
            const a = (0.35 + 0.65 * Math.min(1, storm.flash)) * f.z * Math.max(0, Math.min(1, (low - f.y) / 120));
            if (a <= 0.01) continue;
            ctx.save();
            ctx.globalAlpha = a;
            ctx.translate(f.x + f.dx, f.y);
            // a feather rocks as it falls, flat side down
            ctx.rotate(f.a * 0.25 + Math.sin(f.ph) * 0.6);
            ctx.drawImage(img, -f.len / 2, -th / 2, f.len, th);
            ctx.restore();
        }
    }

    // a run of little Brandons along a path, `upTo` of the way
    function stormChain(g, path, img, w, upTo, fadeY) {
        const n = path.length - 1, stop = Math.max(0, Math.min(1, upTo)) * n, a0 = g.globalAlpha;
        for (let i = 0; i < n && i < stop; i++) {
            const a = path[i], b = path[i + 1], f = Math.min(1, stop - i);
            const bx = a.x + (b.x - a.x) * f, by = a.y + (b.y - a.y) * f;
            const len = Math.hypot(bx - a.x, by - a.y);
            if (len < 0.5) continue;
            const th = w;
            g.save();
            if (fadeY) g.globalAlpha = a0 * Math.max(0, Math.min(1, (fadeY - a.y) / (fadeY * 0.35)));
            g.translate((a.x + bx) / 2, (a.y + by) / 2);
            g.rotate(Math.atan2(by - a.y, bx - a.x));
            g.drawImage(img, -len / 2 - 1, -th / 2, len + 2, th);
            g.restore();
        }
    }

    function stormGlowLine(g, path, rgb, alpha, width, upTo, fadeY) {
        const n = Math.max(1, Math.floor((path.length - 1) * (upTo === undefined ? 1 : upTo)));
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.lineCap = g.lineJoin = 'round';
        for (const [wd, a] of [[width * 3, 0.12], [width, 0.35]]) {
            if (fadeY) {
                const gr = g.createLinearGradient(0, fadeY * 0.65, 0, fadeY);
                gr.addColorStop(0, 'rgba(' + rgb + ',' + (alpha * a) + ')');
                gr.addColorStop(1, 'rgba(' + rgb + ',0)');
                g.strokeStyle = gr;
            } else g.strokeStyle = 'rgba(' + rgb + ',' + (alpha * a) + ')';
            g.lineWidth = wd;
            g.beginPath();
            g.moveTo(path[0].x, path[0].y);
            for (let i = 1; i <= n; i++) g.lineTo(path[i].x, path[i].y);
            g.stroke();
        }
        g.restore();
    }

    // a bolt is there for half a second, and dips once in it -- never out
    function stormBoltAlpha(t) {
        if (t < 0.07) return 1;
        if (t < 0.12) return 0.6;
        if (t < 0.2) return 1;
        return Math.max(0, 1 - (t - 0.2) / 0.3);
    }

    function stormDrawBolts() {
        for (const bo of storm.bolts) {
            const al = stormBoltAlpha(bo.t);
            if (al <= 0.01) continue;
            const ink = bo.red ? STORM_BOLT3 : STORM_BOLT, rgb = bo.red ? STORM_GLOW3 : STORM_GLOW;
            const img = shapeSprite('stormBolt' + ink, ink, 60, 60 / SHAPE_ASPECT, true);
            // it reaches down fast, then is all there
            const reach = Math.min(1, bo.t / 0.05);
            stormGlowLine(ctx, bo.path, rgb, al, 7, reach, bo.fadeY);
            for (const fk of bo.forks) stormGlowLine(ctx, fk, rgb, al * 0.7, 4, reach, bo.fadeY);
            if (!img) continue;
            ctx.save();
            ctx.globalAlpha = al;
            stormChain(ctx, bo.path, img, 4, reach, bo.fadeY);
            for (const fk of bo.forks) stormChain(ctx, fk, img, 3, reach, bo.fadeY);
            ctx.restore();
        }
    }

    // his sky, cracked by every hit you land: dark red Brandons along each
    // crack, lit from behind; HIS gold as he dies
    function stormDrawCracks() {
        const s = storm;
        if (!s.cracks.length) return;
        const fade = lu.stage === 'end' ? Math.max(0, 1 - lu.stT / 3) : 1;
        if (fade <= 0) return;
        const rgb = s.gold > 0 ? STORM_GOLD : STORM_GLOW3;
        const img = shapeSprite('stormCrack', s.gold > 0.5 ? '#f3d27a' : '#5a0f18', 60, 60 / SHAPE_ASPECT, true);
        const breathe = 0.75 + 0.25 * Math.sin(clock * 2.1);
        for (const c of s.cracks) {
            stormGlowLine(ctx, c.path, rgb, (0.8 + s.gold) * breathe * fade, 9, c.grow);
            if (img) { ctx.save(); ctx.globalAlpha = fade; stormChain(ctx, c.path, img, 5, c.grow); ctx.restore(); }
        }
    }

    // ---- the pass ----------------------------------------------------------------
    function stormBufs() {
        const W = canvas.width, H = canvas.height, gw = Math.ceil(LW / STORM_CELL), gh = Math.ceil(LH / STORM_CELL);
        if (!storm.buf) {
            const N = 64, noise = new Float32Array(N * N);
            for (let i = 0; i < N * N; i++) noise[i] = Math.random();
            storm.buf = { big: [0, 1, 2, 3].map(() => document.createElement('canvas')), mask: document.createElement('canvas'), noise, N };
        }
        const d = storm.buf;
        for (const c of d.big) if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
        if (d.mask.width !== gw || d.mask.height !== gh) {
            d.mask.width = gw; d.mask.height = gh;
            d.maskData = d.mask.getContext('2d').createImageData(gw, gh);
        }
        d.gw = gw; d.gh = gh;
        return d;
    }

    function stormClear(c) {
        const g = c.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
        g.clearRect(0, 0, c.width, c.height);
        return g;
    }

    function stormNoise(x, y) {
        const d = storm.buf, N = d.N, s = 18, fx = x / s, fy = (y + clock * 30) / s;
        const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const at = (i, j) => d.noise[((j % N + N) % N) * N + ((i % N + N) % N)];
        const ex = tx * tx * (3 - 2 * tx), ey = ty * ty * (3 - 2 * ty);
        const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * ex;
        const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * ex;
        return a + (b - a) * ey;
    }

    // Where the field is in colour: all of it at k 1, none at 0, a ragged
    // edge burning across between; and round you and your heads always --
    // an oval each, so it never reads as a box cut out of the dark, and only
    // round a head that is drawn: one put away (the drain, the change) still
    // sits in the field, up by him, and would show his colour through.
    function stormMask(k) {
        const d = stormBufs(), { gw, gh } = d, px = d.maskData.data, C = STORM_CELL;
        const keep = [];
        if (STORM_YOU) {
            const r = padH() * 1.4;
            for (const sg of segs()) keep.push({ x: sg.cx, y: padY() - r * 0.3, rx: sg.w / 2 + r, ry: r * 1.3 });
            for (const ball of balls) if (!labSkipBall(ball)) keep.push({ x: ball.x, y: ball.y, rx: bRX() * 1.6, ry: bRX() * 1.6 });
        }
        for (let j = 0, i4 = 0; j < gh; j++) {
            const y = (j + 0.5) * C;
            for (let i = 0; i < gw; i++, i4 += 4) {
                const x = (i + 0.5) * C;
                let on = k >= 1 ? 1 : k <= 0 ? 0 : stormNoise(x, y) * 0.8 + 0.1 < k ? 1 : 0;
                if (!on) for (const q of keep) {
                    const u = (x - q.x) / q.rx, v = (y - q.y) / q.ry;
                    if (u * u + v * v < 1) { on = 1; break; }
                }
                px[i4 + 3] = on * 255;
            }
        }
        d.mask.getContext('2d').putImageData(d.maskData, 0, 0);
        return d;
    }

    function stormPass() {
        const s = storm, b = bricks[0];
        const dt = Math.max(0, Math.min(0.1, clock - s.last));
        s.last = clock;
        if (b) stormStep(dt, b);

        const W = canvas.width, H = canvas.height, kk = W / LW;
        const dipping = (s.dipK || 0) > 0;
        const k = Math.min(s.k, 1 - (s.dipK || 0));
        const red = dipping || lu.stage === 3;
        const d = stormMask(k);
        const [sil, rim, lit, shadow] = d.big;
        const sg = stormClear(sil);
        sg.drawImage(canvas, 0, 0);
        sg.globalCompositeOperation = 'source-in';
        sg.fillStyle = red ? STORM_SIL3 : STORM_SIL;
        sg.fillRect(0, 0, W, H);
        const rg = stormClear(rim);
        rg.drawImage(canvas, 0, 0);
        rg.globalCompositeOperation = 'source-in';
        rg.fillStyle = red ? STORM_RIM3 : STORM_RIM;
        rg.fillRect(0, 0, W, H);
        const lg = stormClear(lit);
        lg.drawImage(canvas, 0, 0);
        lg.globalCompositeOperation = 'destination-in';
        lg.imageSmoothingEnabled = false;
        lg.drawImage(d.mask, 0, 0, W, H);
        // his shadow on the sky: the field above the floor, flat, thrown up
        // and away from where the bolt came down
        if (s.shadows.length) {
            const hg = stormClear(shadow);
            hg.drawImage(sil, 0, 0);
            hg.globalCompositeOperation = 'destination-out';
            hg.fillRect(0, (padY() - padH() * 2) * kk, W, H);
        }

        const calm = stormCalm(), shake = calm ? 0 : s.shake, fl = Math.min(STORM_PEAK, STORM_FLASH * s.flash) * (calm ? 0.33 : 1);
        const jx = shake * STORM_THUNDER * (Math.sin(clock * 83) + Math.sin(clock * 51)) / 2;
        const jy = shake * STORM_THUNDER * Math.sin(clock * 67) / 2;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.setTransform(kk, 0, 0, kk, 0, 0);
        // the sky: red from the change on, lit by every flash
        if (s.sky3 > 0) {
            const g = ctx.createLinearGradient(0, 0, 0, LH);
            g.addColorStop(0, 'rgba(70,8,14,' + 0.55 * s.sky3 + ')');
            g.addColorStop(0.6, 'rgba(30,4,8,' + 0.3 * s.sky3 + ')');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, LW, LH);
        }
        if (fl > 0.001) {
            const rgb = red || s.sky3 > 0.5 ? '255,205,195' : '205,210,255';
            const g = ctx.createLinearGradient(0, 0, 0, LH);
            g.addColorStop(0, 'rgba(' + rgb + ',' + fl + ')');
            g.addColorStop(1, 'rgba(' + rgb + ',' + fl * 0.35 + ')');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, LW, LH);
        }
        if (s.feathers.length) stormDrawFeathers();
        stormDrawCracks();
        for (const sh of s.shadows) {
            const life = STORM_FLASH_SECS * 1.6, a = STORM_SHADOW * Math.min(1, sh.power) * Math.min(1, sh.t / STORM_RISE) * Math.max(0, 1 - sh.t / life);
            if (a <= 0.01) continue;
            // thrown up from below him on the side it struck, away from it
            const X = STORM_SHADOW_X * (1 + 0.05 * sh.t);
            ctx.save();
            ctx.globalAlpha = a;
            ctx.translate(sh.x, sh.y);
            ctx.scale(X, X);
            ctx.translate(-sh.x, -sh.y);
            ctx.drawImage(shadow, 0, 0, LW, LH);
            ctx.restore();
        }
        stormDrawBolts();

        // the field, shaken by the thunder
        ctx.translate(jx, jy);
        ctx.globalAlpha = 0.6;
        const rp = STORM_RIM_PX;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(rim, dx * rp, dy * rp, LW, LH);
        ctx.globalAlpha = 1;
        ctx.drawImage(sil, 0, 0, LW, LH);
        ctx.drawImage(lit, 0, 0, LW, LH);
        // and the flash on it too, lighter, never darker
        if (fl > 0.001) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = fl * 0.5;
            ctx.drawImage(rim, 0, 0, LW, LH);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
        }
        ctx.restore();

        // what has to be read over the dark, drawn again; in full colour it
        // already is
        if (k >= 1) return;
        luDrawBeams();
        if (lu.stage === 'drain') luDrawStream();
        if (b) luDrawBars(b);
        drawRings();
        drawCapsule();
        if (typeof powDrawOver === 'function') powDrawOver();
        drawShout();
        if (typeof labDrawShouts === 'function') labDrawShouts();
        drawYell();
        drawTalk();
    }

    LAB_BOSS.lucifer.light = stormPass;
    LAB_BOSS.lucifer.dark = stormOn;
