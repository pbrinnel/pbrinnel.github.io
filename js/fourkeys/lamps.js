'use strict';

    // ---- LAMPS (boss) ------------------------------------------------------------
    // He hangs above a row of stone brandons, stood on end, and he cannot be
    // touched while any of them is stone. The boss burns the way the EMBER
    // paddle does, and a hit on a cold lamp steals some of his fire: a stream
    // of it pulled off him and across to the lamp, the way the original's
    // second wind drank the life out of you, and the lamp catches as it
    // arrives. Every lamp lit takes its share of him, and he only gets a
    // share back when its lamp has gone all the way out. With every lamp lit
    // there is no fire left in him: he is only brandon, and open. Hits land
    // until the first lamp goes out and a share of the fire comes home. Three
    // clocks and one target, and the head can only be in one place: top up the
    // one that is fading, or take the shot while the window is open. They
    // drift slowly up and down where they stand, each on its own beat, so the
    // shot that lit one a moment ago is not the shot that lights it now.
    let LAMP_LVL    = 4;
    let LAMP_HP     = 16;     // hits to finish him, once you can reach him
    let LAMP_N      = 3;      // how many lamps there are
    let LAMP_SECS   = 10.9;   // how long a hit keeps one lit
    let LAMP_W      = 143;    // how long a lamp is
    let LAMP_Y      = 305;    // the line they drift about
    let LAMP_BOB    = 75;     // px either side of it they drift, a quarter of the field top to bottom
    let LAMP_BOB_RATE = 0.4;  // rad/s of that drift
    let LAMP_BOSS_W = 420;    // how long he is
    let LAMP_BOSS_Y = 95;     // ...and where he hangs
    let LAMP_SPARKS = 22;     // sparks a second off a lit lamp, or off him burning
    let LAMP_COOL   = 0.6;    // seconds his fire takes to go out, or to come back
    let LAMP_STEAL  = 0.9;    // seconds the stream of his fire runs into a lamp being lit
    let LAMP_MOTES  = 45;     // specks of it a second, while it runs
    let LAMP_MOTE_SECS = 0.7; // ...each one's trip across
    let LAMP_SWEEP  = 0.4;    // rad/s of his patrol
    let LAMP_CLIMB  = 0.6;    // how much of the original's climb this fight has
    LAB_KNOBS.push('LAMP_LVL', 'LAMP_HP', 'LAMP_N', 'LAMP_SECS', 'LAMP_W', 'LAMP_Y',
                   'LAMP_BOSS_W', 'LAMP_BOSS_Y', 'LAMP_SWEEP', 'LAMP_CLIMB', 'LAMP_BOB', 'LAMP_BOB_RATE', 'LAMP_SPARKS', 'LAMP_COOL', 'LAMP_STEAL', 'LAMP_MOTES', 'LAMP_MOTE_SECS');

    const LAMP_UP = -Math.PI / 2;     // stood on end, head at the top

    let lamp = null;

    LAB_BOSS.lamps = {
        start(b) {
            b.hp = b.maxHp = LAMP_HP;
            const n = Math.max(1, Math.round(LAMP_N));
            // y is where the entrance starts him: the first frame is drawn
            // before he has been updated once
            lamp = { t: 0, x: LW / 2, y: -LAMP_BOSS_W, pend: null, lit: 0, windows: 0, wasOpen: false, heat: 1, sparks: [],
                     lamps: Array.from({ length: n }, (_, i) => ({ u: (i + 0.5) / n, on: 0, y: LAMP_Y,
                                                                  ph: i * 2.3, lit: 99, acc: 0 })),
                     motes: [] };
            lampBox(b);
        },
        reset() { lamp = null; },
        update(b, dt) {
            if (phase === 'play') {
                lamp.t += dt;
                for (const l of lamp.lamps) if (l.on > 0) l.on = Math.max(0, l.on - dt);
            }
            for (const l of lamp.lamps) l.y = LAMP_Y + Math.sin(clock * LAMP_BOB_RATE + l.ph) * LAMP_BOB;
            const k = phase === 'entrance' ? enterK() : 1;
            const e = k * k * (3 - 2 * k);
            lamp.x = LW / 2 + Math.sin(lamp.t * LAMP_SWEEP) * Math.max(0, (LW - LAMP_BOSS_W) / 2);
            lamp.y = -LAMP_BOSS_W + (LAMP_BOSS_Y + LAMP_BOSS_W) * e;
            const open = lampOpen();
            if (open && !lamp.wasOpen) lamp.windows++;
            lamp.wasOpen = open;
            // his fire: a share of it gone into every lamp that holds it, as
            // fast as the stream carries it off, and back only once that lamp
            // is all the way out
            const want = 1 - lamp.lamps.reduce((s, l) => s + lampHeld(l), 0) / lamp.lamps.length;
            lamp.heat += Math.max(-dt / LAMP_COOL, Math.min(dt / LAMP_COOL, want - lamp.heat));
            lampStealStep(dt);
            lampSparkStep(b, dt);
            lampBox(b);
        },
        contact(br, ball) {
            const lw = LAMP_W, lh = lw / SHAPE_ASPECT;
            for (const l of lamp.lamps) {
                const hit = maskContact(ball, l.u * LW, l.y, LAMP_UP, lw, lh, MASK, false);
                if (hit) { lamp.pend = l; return hit; }
            }
            lamp.pend = null;
            const h = LAMP_BOSS_W / SHAPE_ASPECT;
            return maskContact(ball, lamp.x, lamp.y, 0, LAMP_BOSS_W, h, MASK, false);
        },
        // A lamp never takes a wound, but lighting it is not nothing, so it
        // gets no ring: the stone going is the answer. He rings while any of
        // them is out.
        glances() { return !lamp.pend && !lampOpen(); },
        hit(b, cx, cy) {
            const l = lamp.pend;
            lamp.pend = null;
            if (l) {
                // a cold one has to be lit off him; one still burning is only topped up
                if (l.on <= 0) l.lit = 0;
                l.on = LAMP_SECS;
                lamp.lit++;
                return;
            }
            if (!lampOpen() || bossIF > 0) return;
            b.flash = 1;
            bossIF = BOSS_IF;
            b.hp = Math.max(0, b.hp - 1);
            bossHits++;
            const done = b.hp <= 1e-6;
            award(BOSS_PTS * (done ? 5 : 1), cx, cy);
            if (done) {
                b.alive = false;
                clearStage();
                bossFall = shatter(lamp.x, lamp.y, LAMP_BOSS_W, A_DIE_T);
                if (impact) { impact.x = lamp.x; impact.y = lamp.y; impact.w = LAMP_BOSS_W; }
                return;
            }
            if (bossHits % BOSS_CAP === 0 && !capsule) {
                const pool = capsulePool();
                capsule = { x: lamp.x, y: lamp.y, kind: pool[(Math.random() * pool.length) | 0] };
            }
            if (++hits === 4 || hits === 12) bumpSpeed(1.12);
        },
        draw: lampDraw,
        drawFall() {
            const c = bossFall;
            if (!c) return;
            const wilt = Math.max(0, Math.min(1, ascendT / A_DIE));
            const e = wilt * wilt * (3 - 2 * wilt);
            if (ascendT < A_DIE) drawFigure(c.x, c.y + e * F_SAG, c.w, 1, e, e * F_LEAN);
            else drawCrumble(c, e * F_SAG, e * F_LEAN, true);
        },
        climb() { return LAMP_CLIMB; },
        finish(b) {
            b.hp = Math.min(b.hp, 1);
            for (const l of lamp.lamps) { l.on = LAMP_SECS; l.lit = 99; }
            return true;
        },
        state(b) {
            const on = lamp.lamps.filter(l => l.on > 0).length;
            const soon = Math.min(...lamp.lamps.map(l => l.on).filter(v => v > 0), Infinity);
            return { name: 'LAMPS', hp: b.hp, max: b.maxHp,
                     line: on + ' of ' + lamp.lamps.length + ' lit' +
                           (on === lamp.lamps.length ? ' · he is open, ' + soon.toFixed(1) + ' s left'
                            : ' · he cannot be touched') + ' · ' + lamp.windows + ' windows' };
        }
    };

    function lampOpen() { return lamp.lamps.every(l => l.on > 0); }

    // the box the physics looks in: him and the whole row, wherever it
    // drifts -- stood on end, a lamp is its length tall
    function lampBox(b) {
        const h = LAMP_BOSS_W / SHAPE_ASPECT;
        b.x = 0; bw = LW;
        b.y = Math.min(lamp.y - h / 2, LAMP_Y - LAMP_BOB - LAMP_W / 2);
        bh = Math.max(lamp.y + h / 2, LAMP_Y + LAMP_BOB + LAMP_W / 2) - b.y;
    }

    // how lit a lamp is, 1 just struck to 0 stone cold
    function lampWarm(l) { return l.on > 0 ? Math.min(1, l.on / LAMP_SECS) * lampCaught(l) : 0; }

    // how much of its fire a lamp being lit has taken off him: the stream's share
    function lampHeld(l) { return l.on > 0 ? Math.min(1, l.lit / LAMP_STEAL) : 0; }
    // ...and how much of it has arrived, a trip behind
    function lampCaught(l) { return Math.max(0, Math.min(1, (l.lit - LAMP_MOTE_SECS * 0.6) / LAMP_STEAL)); }

    // The stream: while a lamp is being lit, specks of him leave from all
    // over his body on a bowed path to it, each on the siphon's own ease --
    // slow off, quick across, slow in -- and fading up and out on the way.
    function lampStealStep(dt) {
        const h = LAMP_BOSS_W / SHAPE_ASPECT;
        for (const l of lamp.lamps) {
            l.lit += dt;
            if (l.on <= 0 || l.lit >= LAMP_STEAL) continue;
            for (l.acc += dt * LAMP_MOTES; l.acc >= 1; l.acc--) {
                lamp.motes.push({ t: 0, l, sway: (Math.random() - 0.5) * 120,
                                  dx: (Math.random() - 0.5) * LAMP_BOSS_W * 0.8, dy: (Math.random() - 0.5) * h * 0.5,
                                  ink: Math.random() < 0.4 ? EMB_RIM : EMB_INK });
            }
        }
        lamp.motes = lamp.motes.filter(m => (m.t += dt) < LAMP_MOTE_SECS);
    }

    function lampDrawMotes() {
        if (!lamp.motes.length) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const m of lamp.motes) {
            const p = m.t / LAMP_MOTE_SECS, e = p * p * (3 - 2 * p);
            const sx = lamp.x + m.dx, sy = lamp.y + m.dy, tx = m.l.u * LW, ty = m.l.y;
            const x = sx + (tx - sx) * e + Math.sin(p * Math.PI) * m.sway;
            const y = sy + (ty - sy) * e;
            const a = Math.sin(p * Math.PI);
            const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
            g.addColorStop(0, m.ink);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = 0.5 * a;
            ctx.fillStyle = g;
            ctx.fillRect(x - 9, y - 9, 18, 18);
            ctx.globalAlpha = 0.9 * a;
            ctx.fillStyle = '#fff1d6';
            ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
        }
        ctx.restore();
    }

    // Sparks off whatever is burning: each lit lamp as much as it is lit, and
    // him as much as his fire is in him. EMBER's own sparks, kept here rather
    // than in the paddle's list so a fight's worth of them never crowds his out.
    function lampSparkStep(b, dt) {
        const lw = LAMP_W, lh = lw / SHAPE_ASPECT;
        const burn = (k, x, y, rx, ry) => {
            if (Math.random() >= dt * LAMP_SPARKS * k) return;
            lamp.sparks.push({ x: x + (Math.random() - 0.5) * rx * 2, y: y + (Math.random() - 0.5) * ry * 2,
                               vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 70, t: 0,
                               life: 0.7 + Math.random() * 0.8, s: 2 + Math.random() * 2.5,
                               ink: Math.random() < 0.4 ? EMB_RIM : EMB_INK, ph: Math.random() * 6.28 });
        };
        if (phase !== 'entrance') {
            for (const l of lamp.lamps) burn(lampWarm(l), l.u * LW, l.y, lh * 0.4, lw * 0.45);
            const h = LAMP_BOSS_W / SHAPE_ASPECT;
            burn(lamp.heat * 2.5, lamp.x, lamp.y, LAMP_BOSS_W * 0.45, h * 0.35);
        }
        for (const p of lamp.sparks) {
            p.t += dt;
            p.x += p.vx * dt + Math.sin(p.t * 3 + p.ph) * 25 * dt;
            p.y += p.vy * dt;
            p.vy -= 30 * dt;
        }
        lamp.sparks = lamp.sparks.filter(p => p.t < p.life);
    }

    function lampDrawSparks() {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const p of lamp.sparks) {
            const a = Math.max(0, 1 - p.t / p.life);
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s * 2.4);
            g.addColorStop(0, p.ink);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = a * 0.55;
            ctx.fillStyle = g;
            ctx.fillRect(p.x - p.s * 2.4, p.y - p.s * 2.4, p.s * 4.8, p.s * 4.8);
            ctx.globalAlpha = a;
            ctx.fillStyle = '#fff1d6';
            ctx.fillRect(p.x - p.s / 4, p.y - p.s / 4, p.s / 2, p.s / 2);
        }
        ctx.restore();
    }

    // EMBER's light under a body: a steady glow with a slow breath in it
    function lampGlow(x, y, r, k) {
        // a gradient throws on a position that is not a number, and a throw
        // in draw() stops the loop for good
        if (k <= 0.002 || !Number.isFinite(x + y + r)) return;
        const g = ctx.createRadialGradient(x, y, 8, x, y, r);
        g.addColorStop(0, EMB_INK);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = EMB_GLOW * k * (0.85 + 0.15 * Math.sin(clock * 1.7));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // a sprite at (x, y), turned, as solid as `a`
    function lampLay(sprite, x, y, w, h, ang, a) {
        if (!sprite || a <= 0.002) return;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
        ctx.restore();
    }

    function lampDraw(b) {
        const lw = LAMP_W, lh = lw / SHAPE_ASPECT;
        const raw = shapeSprite('lampRaw', null, lw, lh, false);
        const stone = shapeSprite('lampStone', STONE, lw, lh, 'statue');
        const ember = padTint('padEmber', EMB_INK);
        if (!raw || !stone) return;
        for (const l of lamp.lamps) {
            const x = l.u * LW, warm = lampWarm(l);
            // lit, he burns; the stone comes back over him as his time runs
            // out, so the clock is the picture rather than a number
            lampGlow(x, l.y, lw * 0.7, warm);
            lampLay(raw, x, l.y, lw, lh, LAMP_UP, 1);
            lampLay(ember, x, l.y, lw, lh, LAMP_UP, 0.72);
            lampLay(stone, x, l.y, lw, lh, LAMP_UP, 1 - warm);
        }
        const h = LAMP_BOSS_W / SHAPE_ASPECT;
        const body = shapeSprite('boss', null, BOSS_W0, BOSS_H, false);
        if (body) {
            lampGlow(lamp.x, lamp.y, LAMP_BOSS_W * 0.6, lamp.heat);
            ctx.drawImage(body, lamp.x - LAMP_BOSS_W / 2, lamp.y - h / 2, LAMP_BOSS_W, h);
            lampLay(padTint('lampBossEmber', EMB_INK), lamp.x, lamp.y, LAMP_BOSS_W, h, 0, 0.72 * lamp.heat);
            if (b.flash > 0) {
                ctx.globalAlpha = Math.min(1, b.flash) * 0.7;
                ctx.drawImage(shapeSprite('flash', '#f2efe9', BOSS_W0, BOSS_H, true),
                              lamp.x - LAMP_BOSS_W / 2, lamp.y - h / 2, LAMP_BOSS_W, h);
                ctx.globalAlpha = 1;
            }
        }
        lampDrawSparks();
        lampDrawMotes();
        const grow = phase === 'entrance' ? enterK() : 1;
        if (grow > 0.001) {
            const w = Math.min(LAMP_BOSS_W * 0.72, LW - 120) * grow;
            labBar(Math.max(12, Math.min(LW - 12 - w, lamp.x - w / 2)),
                   Math.max(10, lamp.y - h / 2 - 16), w, b.hp / b.maxHp);
        }
    }