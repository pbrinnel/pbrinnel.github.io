'use strict';

    // ---- LAMPS (boss) ------------------------------------------------------------
    // He hangs above a row of stone brandons, and he cannot be touched while
    // any of them is stone. A hit lights one: the stone goes and the
    // photograph is there, and then it cools back over him. With every one of
    // them lit he is open, and hits land until the first goes out again. Three
    // clocks and one target, and the head can only be in one place: top up the
    // one that is fading, or take the shot while the window is open. They
    // drift slowly up and down where they stand, each on its own beat, so the
    // shot that lit one a moment ago is not the shot that lights it now.
    let LAMP_LVL    = 4;
    let LAMP_HP     = 16;     // hits to finish him, once you can reach him
    let LAMP_N      = 3;      // how many lamps there are
    let LAMP_SECS   = 8;      // how long a hit keeps one lit
    let LAMP_W      = 143;    // how long a lamp is
    let LAMP_Y      = 250;    // the line they drift about
    let LAMP_BOB    = 75;     // px either side of it they drift, a quarter of the field top to bottom
    let LAMP_BOB_RATE = 0.4;  // rad/s of that drift
    let LAMP_BOSS_W = 420;    // how long he is
    let LAMP_BOSS_Y = 105;    // ...and where he hangs
    let LAMP_SWEEP  = 0.4;    // rad/s of his patrol
    let LAMP_CLIMB  = 0.6;    // how much of the original's climb this fight has
    LAB_KNOBS.push('LAMP_LVL', 'LAMP_HP', 'LAMP_N', 'LAMP_SECS', 'LAMP_W', 'LAMP_Y',
                   'LAMP_BOSS_W', 'LAMP_BOSS_Y', 'LAMP_SWEEP', 'LAMP_CLIMB', 'LAMP_BOB', 'LAMP_BOB_RATE');

    let lamp = null;

    LAB_BOSS.lamps = {
        start(b) {
            b.hp = b.maxHp = LAMP_HP;
            const n = Math.max(1, Math.round(LAMP_N));
            lamp = { t: 0, x: LW / 2, pend: null, lit: 0, windows: 0, wasOpen: false,
                     lamps: Array.from({ length: n }, (_, i) => ({ u: (i + 0.5) / n, on: 0, y: LAMP_Y,
                                                                  ph: i * 2.3 })) };
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
            lampBox(b);
        },
        contact(br, ball) {
            const lw = LAMP_W, lh = lw / SHAPE_ASPECT;
            for (const l of lamp.lamps) {
                const hit = maskContact(ball, l.u * LW, l.y, 0, lw, lh, MASK, false);
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
            if (l) { l.on = LAMP_SECS; lamp.lit++; return; }
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
            for (const l of lamp.lamps) l.on = LAMP_SECS;
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

    // the box the physics looks in: him and the whole row, wherever it drifts
    function lampBox(b) {
        const h = LAMP_BOSS_W / SHAPE_ASPECT, lh = LAMP_W / SHAPE_ASPECT;
        const x0 = Math.min(lamp.x - LAMP_BOSS_W / 2, LAMP_W / 2 - LAMP_W);
        const x1 = Math.max(lamp.x + LAMP_BOSS_W / 2, LW);
        b.x = x0; bw = x1 - x0;
        b.y = Math.min(lamp.y - h / 2, LAMP_Y - LAMP_BOB - lh / 2);
        bh = Math.max(lamp.y + h / 2, LAMP_Y + LAMP_BOB + lh / 2) - b.y;
    }

    function lampDraw(b) {
        const lw = LAMP_W, lh = lw / SHAPE_ASPECT;
        const raw = shapeSprite('lampRaw', null, lw, lh, false);
        const stone = shapeSprite('lampStone', STONE, lw, lh, 'statue');
        if (!raw || !stone) return;
        for (const l of lamp.lamps) {
            const x = l.u * LW - lw / 2, y = l.y - lh / 2;
            ctx.drawImage(raw, x, y, lw, lh);
            // the stone comes back over him as his time runs out, so the clock
            // is the picture rather than a number
            const cold = l.on > 0 ? 1 - Math.min(1, l.on / LAMP_SECS) : 1;
            if (cold > 0.002) {
                ctx.globalAlpha = cold;
                ctx.drawImage(stone, x, y, lw, lh);
                ctx.globalAlpha = 1;
            }
        }
        const h = LAMP_BOSS_W / SHAPE_ASPECT;
        const body = shapeSprite('boss', null, BOSS_W0, BOSS_H, false);
        if (body) {
            ctx.drawImage(body, lamp.x - LAMP_BOSS_W / 2, lamp.y - h / 2, LAMP_BOSS_W, h);
            if (b.flash > 0) {
                ctx.globalAlpha = Math.min(1, b.flash) * 0.7;
                ctx.drawImage(shapeSprite('flash', '#f2efe9', BOSS_W0, BOSS_H, true),
                              lamp.x - LAMP_BOSS_W / 2, lamp.y - h / 2, LAMP_BOSS_W, h);
                ctx.globalAlpha = 1;
            }
        }
        const grow = phase === 'entrance' ? enterK() : 1;
        if (grow > 0.001) {
            const w = Math.min(LAMP_BOSS_W * 0.72, LW - 120) * grow;
            labBar(Math.max(12, Math.min(LW - 12 - w, lamp.x - w / 2)),
                   Math.max(10, lamp.y - h / 2 - 16), w, b.hp / b.maxHp);
        }
    }