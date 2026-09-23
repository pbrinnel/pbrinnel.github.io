'use strict';

    // ---- TWINS (boss) -----------------------------------------------------------------
    // Two of him, facing each other across the top: a big slow one who throws
    // the original's phantom heads, and a small quick one who meets the ball
    // and sends it off at whichever of the original's angles lands furthest
    // from you. Put one down and the other gets his health back and takes up
    // the dead one's move as well as his own, so the order you kill them in
    // picks the fight you finish on: a big one who slams, or a small one who
    // throws.
    let TW_HP_BIG      = 8;       // hits to put the big one down
    let TW_HP_SMALL    = 6;       // ...and the small one
    let TW_W_BIG       = 430;     // how long the big one is
    let TW_W_SMALL     = 210;     // ...and the small one
    let TW_SWEEP_BIG   = 0.35;    // rad/s the big one patrols at
    let TW_SWEEP_SMALL = 1.25;    // ...and the small one
    let TW_THROW       = 2.4;     // seconds between phantom heads, for whoever throws them
    let TW_HEAL        = 1;       // share of his health the survivor gets back
    let TW_Y           = 135;     // where they hang
    let TW_CLIMB       = 0.8;     // how much of the original's climb this fight has
    // The act a run draws them from, 1 easy to 3 hard. Two targets, a barrage
    // and a slam at once, and the survivor heals to full and picks up the other
    // move -- the longest fight of the new ones.
    let TW_LVL         = 3;
    LAB_KNOBS.push('TW_LVL', 'TW_HP_BIG', 'TW_HP_SMALL', 'TW_W_BIG', 'TW_W_SMALL', 'TW_SWEEP_BIG',
                   'TW_SWEEP_SMALL', 'TW_THROW', 'TW_HEAL', 'TW_Y', 'TW_CLIMB');

    let tw = null;

    LAB_BOSS.twins = {
        start(b) {
            const one = (key, w, hp, sweep, mir, dy, ph) => ({
                key, w, h: w / SHAPE_ASPECT, x: LW / 2, y: -200, dy, hp, maxHp: hp, flash: 0,
                jt: 0, jnx: 0, jny: 0, iframes: 0, alive: true, sweep, mir, ph,
                throws: key === 'big', slams: key === 'small', throwT: TW_THROW, fall: null
            });
            tw = { t: 0, pend: null, order: [],
                   twins: [one('small', TW_W_SMALL, TW_HP_SMALL, TW_SWEEP_SMALL, true, 34, Math.PI / 2),
                           one('big', TW_W_BIG, TW_HP_BIG, TW_SWEEP_BIG, false, -8, -Math.PI / 2)] };
            b.maxHp = TW_HP_BIG + TW_HP_SMALL;
            b.hp = b.maxHp;
            twBox(b);
        },
        reset() { tw = null; },
        update(b, dt) {
            const entering = phase === 'entrance';
            const raw = enterK(), e = raw * raw * (3 - 2 * raw);
            for (const t of tw.twins) {
                if (t.fall) stepCrumble(t.fall, dt, 0.5);
                if (!t.alive) continue;
                if (t.iframes > 0) t.iframes = Math.max(0, t.iframes - dt);
                if (t.flash > 0) t.flash = Math.max(0, t.flash - dt * 6);
                if (t.jt > 0) t.jt = Math.max(0, t.jt - dt * JIG_DECAY);
                if (phase === 'play') t.ph += (t.key === 'big' ? TW_SWEEP_BIG : TW_SWEEP_SMALL) * dt;
                t.x = LW / 2 + Math.sin(t.ph) * Math.max(0, (LW - t.w) / 2) * 0.92;
                const y = TW_Y + t.dy;
                t.y = entering ? -(t.h + 40) + (y + t.h + 40) * e : y;
                // the thrower's barrage, the original's phantoms, only in a rally
                if (t.throws && phase === 'play' && (t.throwT -= dt) <= 0) {
                    t.throwT = TW_THROW;
                    if (phantoms.length < PH_CAP) {
                        const a = Math.PI * (0.2 + Math.random() * 0.6);
                        phantoms.push({ x: t.x, y: t.y, vx: Math.cos(a) * PH_SPEED, vy: Math.sin(a) * PH_SPEED,
                                        angle: Math.random() * 6.28, spin: (Math.random() - 0.5) * 18, life: PH_LIFE });
                    }
                }
            }
            b.hp = tw.twins.reduce((s, t) => s + (t.alive ? t.hp : 0), 0);
            twBox(b);
        },
        contact(br, ball) {
            for (const t of tw.twins) {       // the small one first: he hangs in front
                if (!t.alive) continue;
                const hit = maskContact(ball, t.x, t.y, 0, t.w, t.h, MASK, t.mir);
                if (hit) { tw.pend = t; return hit; }
            }
            tw.pend = null;
            return null;
        },
        // the slammer does his own bouncing: off at an angle of his choosing
        touch(br, ball, hit) {
            const t = tw.pend;
            if (!t || !t.slams || ball.y < t.y) return false;
            const s = effSpeed() * (ball.boost || 1);
            ball.y = Math.max(ball.y, t.y + t.h / 2 + extY(ball) + 2);
            let pick = 0, far = -1;
            for (const a of SLAM_ANGLES) {
                const d = Math.abs(labFold(ball.x - Math.tan(a) * Math.max(0, padY() - ball.y)) - paddle.x);
                if (d > far) { far = d; pick = a; }
            }
            ball.vx = -Math.sin(pick) * s;
            ball.vy = Math.cos(pick) * s;
            bumpSpeed(BRICK_BUMP);
            twHit(t, hit.cx, hit.cy);
            tw.pend = null;
            return true;
        },
        glances() { return !!tw.pend && tw.pend.iframes > 0; },
        hit(b, cx, cy) {
            const t = tw.pend;
            tw.pend = null;
            if (t) twHit(t, cx, cy);
        },
        draw: twDraw,
        drawFall: twDrawFall,
        climb() { return TW_CLIMB; },
        finish(b) {
            const live = tw.twins.filter(t => t.alive);
            if (live.length === 2) twDown(live[0]);          // the small one goes, and the big one takes it up
            for (const t of tw.twins) if (t.alive) t.hp = 1;
            return true;
        },
        state(b) {
            const says = t => t.key + (t.alive ? ' ' + t.hp + '/' + t.maxHp + ' ' +
                         [t.throws && 'throws', t.slams && 'slams'].filter(Boolean).join(' + ') : ' down');
            return { name: 'TWINS', hp: b.hp, max: b.maxHp, w: bw,
                     line: tw.twins.map(says).join(' · ') + (tw.order.length ? ' · ' + tw.order[0] + ' went first' : '') };
        }
    };

    // the box the physics looks for them in: round both of them
    function twBox(b) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const t of tw.twins) {
            if (!t.alive) continue;
            x0 = Math.min(x0, t.x - t.w / 2); x1 = Math.max(x1, t.x + t.w / 2);
            y0 = Math.min(y0, t.y - t.h / 2); y1 = Math.max(y1, t.y + t.h / 2);
        }
        if (x0 === Infinity) return;
        b.x = x0; b.y = y0; bw = x1 - x0; bh = y1 - y0;
    }

    function twHit(t, cx, cy) {
        // the physics jolts the box round both of them; this is the one it hit
        const d = Math.hypot(t.x - cx, t.y - cy) || 1;
        kick(t, (t.x - cx) / d, (t.y - cy) / d, 1);
        if (t.iframes > 0) return;
        t.flash = 1;
        t.iframes = BOSS_IF;
        t.hp = Math.max(0, t.hp - 1);
        bossHits++;
        award(BOSS_PTS, cx, cy);
        if (t.hp <= 0) twDown(t);
        else if (++hits === 4 || hits === 12) bumpSpeed(1.12);
    }

    function twDown(t) {
        t.alive = false;
        t.hp = 0;
        tw.order.push(t.key);
        const other = tw.twins.find(o => o !== t && o.alive);
        const b = bricks[0];
        if (other) {
            t.fall = shatter(t.x, t.y, t.w, 1.6);
            // the one left standing takes up what his brother did, and gets
            // his health back to do it with
            other.throws = other.throws || t.throws;
            other.slams = other.slams || t.slams;
            other.hp = Math.min(other.maxHp, other.hp + Math.round(TW_HEAL * other.maxHp));
            shout = { x: other.x, y: other.y + other.h / 2 + 8, life: SHOUT_SECS };
            award(BOSS_PTS * 3, t.x, t.y);
            b.hp = other.hp;
            return;
        }
        // the second of them: the fight is over, and the takeover gets this one
        b.alive = false;
        clearStage();
        bossFall = shatter(t.x, t.y, t.w, A_DIE_T);
        bossFall.flip = t.mir;
        if (impact) { impact.x = t.x; impact.y = t.y; impact.w = t.w; impact.flip = t.mir; }
    }

    // a body the way drawBoss draws the original, at any size, either way round
    function twDrawBody(t) {
        const sp = shapeSprite('boss', null, BOSS_W0, BOSS_H, false);
        if (!sp) return;
        const o = t.jt > 0 ? wobble(t.jt) * JIG_BRICK : 0;
        ctx.save();
        ctx.translate(t.x + t.jnx * o, t.y + t.jny * o);
        if (t.mir) ctx.scale(-1, 1);
        ctx.drawImage(sp, -t.w / 2, -t.h / 2, t.w, t.h);
        if (t.flash > 0) {
            ctx.globalAlpha = Math.min(1, t.flash) * 0.7;
            ctx.drawImage(shapeSprite('flash', '#f2efe9', BOSS_W0, BOSS_H, true), -t.w / 2, -t.h / 2, t.w, t.h);
            ctx.globalAlpha = 1;
        }
        ctx.restore();
    }

    // a crumble, mirrored when he faced left, so his boot still goes first
    function twCrumble(c, mir, sag, lean) {
        ctx.save();
        if (mir) { ctx.translate(c.x, 0); ctx.scale(-1, 1); ctx.translate(-c.x, 0); }
        drawCrumble(c, sag, lean, true);
        ctx.restore();
    }

    function twDraw(b) {
        for (const t of tw.twins) if (t.fall) twCrumble(t.fall, t.mir, 0, 0);
        // the big one behind, the small one in front of him
        for (const t of tw.twins.slice().reverse()) {
            if (!t.alive) continue;
            twDrawBody(t);
            const grow = phase === 'entrance' ? enterK() : 1;
            if (grow > 0.001) {
                const w = Math.min(t.w * 0.7, 300) * grow;
                labBar(t.x - w / 2, Math.max(10, t.y - t.h / 2 - 12), w, t.hp / t.maxHp, 4);
            }
        }
    }

    // The last of them, the original's end: the colour going, then the peel.
    // Whatever is left of the first one is not drawn: nothing steps it once
    // the fight is over, and it would hang there in the air.
    function twDrawFall() {
        const c = bossFall;
        if (!c) return;
        const wilt = Math.max(0, Math.min(1, ascendT / A_DIE));
        const e = wilt * wilt * (3 - 2 * wilt);
        if (ascendT < A_DIE) {
            ctx.save();
            if (c.flip) { ctx.translate(c.x, 0); ctx.scale(-1, 1); ctx.translate(-c.x, 0); }
            drawFigure(c.x, c.y + e * F_SAG, c.w, 1, e, e * F_LEAN);
            ctx.restore();
            return;
        }
        twCrumble(c, c.flip, e * F_SAG, e * F_LEAN);
    }