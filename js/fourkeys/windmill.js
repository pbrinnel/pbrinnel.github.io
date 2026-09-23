'use strict';

    // ---- WINDMILL (boss) ------------------------------------------------------------
    // Brandons as the sails of a slow wheel, with a big head at the hub that
    // stays upright while the bodies turn round it. Only the hub can be hurt.
    // Thread the ball through the gaps as they come round, or knock sails off
    // to open the wheel up -- every sail lost turns the rest faster, and each
    // one falls at you on its way out. Both routes work, and picking one is the
    // fight. The sails do the returning: one swinging through the ball sends it
    // back at an angle you did not give it.
    let WM_HP       = 10;     // hits on the hub to finish him
    let WM_SAILS    = 6;      // how many sails he has
    let WM_SAIL_HP  = 3;      // hits to knock one off
    let WM_SAIL     = 150;    // px, how long a sail is
    let WM_R0       = 40;     // px from the hub's middle to where a sail starts
    let WM_HUB      = 72;     // px, how wide the head at the hub is
    let WM_SPIN0    = 0.45;   // rad/s the wheel turns with every sail on
    let WM_SPIN1    = 1.5;    // ...and with one left
    let WM_Y        = 175;    // where the hub hangs
    let WM_DRIFT    = 70;     // px he drifts either side
    let WM_FALL     = 420;    // px/s^2 a sail comes down at once it is off
    let WM_BOOTS_IN = 1;      // 1: their boots at the hub; 0: their heads
    let WM_CLIMB    = 0.2;    // how much of the original's climb this fight has
    // The act a run draws him from, 1 easy to 3 hard. The returns off a turning
    // sail are the least predictable in the set and a sail coming off lands
    // SLUGGISH on you, but there are two ways in, so he sits in the middle.
    let WM_LVL      = 1;
    LAB_KNOBS.push('WM_LVL', 'WM_HP', 'WM_SAILS', 'WM_SAIL_HP', 'WM_SAIL', 'WM_R0', 'WM_HUB',
                   'WM_SPIN0', 'WM_SPIN1', 'WM_Y', 'WM_DRIFT', 'WM_FALL', 'WM_BOOTS_IN', 'WM_CLIMB');

    let wm = null;

    LAB_BOSS.windmill = {
        start(b) {
            b.hp = b.maxHp = WM_HP;
            const n = Math.max(1, Math.round(WM_SAILS));
            wm = { ang: 0, t: 0, cx: LW / 2, cy: -300, omega: WM_SPIN0, pend: null, lost: 0,
                   sails: Array.from({ length: n }, () => ({ hp: WM_SAIL_HP, alive: true, flash: 0 })),
                   falling: [], dying: [] };
            wmBox(b);
        },
        reset() { wm = null; },
        update(b, dt) {
            const n = wm.sails.length, left = wm.sails.filter(s => s.alive).length;
            const k = n > 1 ? Math.min(1, (n - left) / (n - 1)) : 0;
            wm.omega = WM_SPIN0 + (WM_SPIN1 - WM_SPIN0) * k;
            if (phase !== 'over') wm.ang += wm.omega * dt;
            if (phase === 'entrance') {
                const raw = enterK(), e = raw * raw * (3 - 2 * raw);
                const from = -(WM_R0 + WM_SAIL + 20);
                wm.cx = LW / 2;
                wm.cy = from + (WM_Y - from) * e;
            } else {
                if (phase === 'play') wm.t += dt;
                wm.cx = LW / 2 + Math.sin(wm.t * 0.3) * WM_DRIFT;
                wm.cy = WM_Y;
            }
            wmBox(b);
            for (const s of wm.sails) if (s.flash > 0) s.flash = Math.max(0, s.flash - dt * 6);
            // the ones knocked off, on their way down to you
            for (const f of wm.falling) {
                f.vy += WM_FALL * dt;
                f.x += f.vx * dt; f.y += f.vy * dt;
                f.psi += f.spin * dt;
                if (f.spent || phase !== 'play') continue;
                for (const sg of segs()) {
                    if (Math.abs(f.x - sg.cx) < sg.w / 2 + WM_SAIL * 0.3 &&
                        Math.abs(f.y - padY()) < padH() / 2 + WM_SAIL * 0.12) {
                        addDrag(sg, f.x);          // one of him landing on you: a helping of SLUGGISH
                        f.spent = true;
                        break;
                    }
                }
            }
            wm.falling = wm.falling.filter(f => f.y < LH + WM_SAIL);
        },
        contact(br, ball) {
            const hub = ellipseContact(ball, wm.cx, wm.cy, WM_HUB / 2, WM_HUB / 2 * (BALL_RY / BALL_RX));
            if (hub) { wm.pend = { hub: true }; return hub; }
            const h = WM_SAIL / SHAPE_ASPECT;
            for (let i = 0; i < wm.sails.length; i++) {
                if (!wm.sails[i].alive) continue;
                const g = wmSail(i);
                const hit = maskContact(ball, g.x, g.y, g.psi, WM_SAIL, h, MASK, false);
                if (hit) { wm.pend = { sail: i }; return hit; }
            }
            wm.pend = null;
            return null;
        },
        glances() { return !!wm.pend && !!wm.pend.hub && bossIF > 0; },
        hit(b, cx, cy) {
            const p = wm.pend;
            wm.pend = null;
            if (!p) return;
            if (!p.hub) { wmSailHit(p.sail, cx, cy); return; }
            if (bossIF > 0) return;
            b.flash = 1;
            bossIF = BOSS_IF;
            b.hp = Math.max(0, b.hp - 1);
            bossHits++;
            const done = b.hp <= 1e-6;
            award(BOSS_PTS * (done ? 5 : 1), cx, cy);
            if (done) { wmDie(b); return; }
            if (bossHits % BOSS_CAP === 0 && !capsule) {
                const pool = capsulePool();
                capsule = { x: wm.cx, y: wm.cy, kind: pool[(Math.random() * pool.length) | 0] };
            }
            if (++hits === 4 || hits === 12) bumpSpeed(1.12);
        },
        draw: wmDraw,
        drawFall() { labHeadFall(wmDrawDying); },
        climb() { return WM_CLIMB; },
        finish(b) { b.hp = Math.min(b.hp, 1); return true; },
        state(b) {
            const left = wm.sails.filter(s => s.alive).length;
            return { name: 'WINDMILL', hp: b.hp, max: b.maxHp, w: bw,
                     line: 'sails ' + left + ' / ' + wm.sails.length + ' · turning ' + wm.omega.toFixed(2) + ' rad/s' };
        }
    };

    // the square the physics looks for him in: the whole wheel
    function wmBox(b) {
        const R = WM_R0 + WM_SAIL;
        bw = bh = 2 * R;
        b.x = wm.cx - R;
        b.y = wm.cy - R;
    }

    // where sail i is, and how it is turned: its boots at the hub unless
    // WM_BOOTS_IN is off, in which case its head is
    function wmSail(i) {
        const phi = wm.ang + i * Math.PI * 2 / wm.sails.length;
        const r = WM_R0 + WM_SAIL / 2;
        return { x: wm.cx + Math.cos(phi) * r, y: wm.cy + Math.sin(phi) * r, phi, r,
                 psi: WM_BOOTS_IN >= 0.5 ? phi : phi + Math.PI };
    }

    // hits it has left, as the wall's own ladder: gold, silver, then slate
    function wmKind(hp) { return hp >= 3 ? 'A' : hp === 2 ? 'S' : 'S2'; }

    // a sail knocked loose goes the way the wheel was carrying it, turning as it did
    function wmLoose(i) {
        const g = wmSail(i);
        const v = wm.omega * g.r;
        return { x: g.x, y: g.y, vx: -Math.sin(g.phi) * v, vy: Math.cos(g.phi) * v - 40,
                 psi: g.psi, spin: wm.omega, kind: 'S2' };
    }

    function wmSailHit(i, cx, cy) {
        const s = wm.sails[i];
        s.flash = 1;
        if (--s.hp > 0) { award(25, cx, cy); return; }
        s.alive = false;
        wm.lost++;
        wm.falling.push(wmLoose(i));
        award(25 * WM_SAIL_HP * 2, cx, cy);
        maybeDropCapsule(cx, cy);
    }

    function wmDie(b) {
        // every sail left comes off with him, and falls on its own clock
        for (let i = 0; i < wm.sails.length; i++) {
            if (!wm.sails[i].alive) continue;
            const f = wmLoose(i);
            f.kind = wmKind(wm.sails[i].hp);
            wm.sails[i].alive = false;
            wm.falling.push(f);
        }
        wm.dying = wm.falling.map(f => Object.assign({}, f, { t0: clock }));
        wm.falling = [];
        b.alive = false;
        clearStage();
        labHeadDied(wm.cx, wm.cy, WM_HUB);
    }

    function wmDrawSail(x, y, psi, kind, flash, alpha) {
        const h = WM_SAIL / SHAPE_ASPECT;
        const sp = shapeSprite('wm' + kind, brickColor(kind), WM_SAIL, h, false);
        if (!sp) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);
        ctx.rotate(psi);
        ctx.drawImage(sp, -WM_SAIL / 2, -h / 2, WM_SAIL, h);
        if (flash > 0) {
            ctx.globalAlpha = alpha * Math.min(1, flash) * 0.75;
            ctx.drawImage(shapeSprite('flash', '#f2efe9', WM_SAIL, h, true), -WM_SAIL / 2, -h / 2, WM_SAIL, h);
        }
        ctx.restore();
    }

    function wmDraw(b) {
        for (let i = 0; i < wm.sails.length; i++) {
            const s = wm.sails[i];
            if (!s.alive) continue;
            const g = wmSail(i);
            wmDrawSail(g.x, g.y, g.psi, wmKind(s.hp), s.flash, 1);
        }
        for (const f of wm.falling) wmDrawSail(f.x, f.y, f.psi, f.kind, 0, f.spent ? 0.45 : 1);
        // the hub over the sails' ends, the right way up whatever they are doing
        const hw = WM_HUB, hh = hw * (BALL_RY / BALL_RX);
        if (ready(ballImg)) ctx.drawImage(ballImg, wm.cx - hw / 2, wm.cy - hh / 2, hw, hh);
        if (b.flash > 0) {
            ctx.globalAlpha = Math.min(1, b.flash) * 0.7;
            ctx.drawImage(headSprite2('flat', '#f2efe9'), wm.cx - hw / 2, wm.cy - hh / 2, hw, hh);
            ctx.globalAlpha = 1;
        }
        const grow = phase === 'entrance' ? enterK() : 1;
        if (grow > 0.001) labBar(LW / 2 - 150 * grow, 10, 300 * grow, b.hp / b.maxHp);
    }

    // the sails that came off with him, falling on the clock they were let go on
    function wmDrawDying() {
        for (const f of wm.dying) {
            const t = clock - f.t0;
            const y = f.y + f.vy * t + WM_FALL * t * t / 2;
            if (y > LH + WM_SAIL) continue;
            wmDrawSail(f.x + f.vx * t, y, f.psi + f.spin * t, f.kind, 0, Math.max(0, 1 - t / 3));
        }
    }