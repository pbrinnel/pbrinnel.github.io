'use strict';

    // ---- TWINS (boss) -----------------------------------------------------------------
    // Two of him, facing each other across the top: a big slow one who throws
    // the original's phantom heads, and a small quick one who fights the way
    // the original does after his second wind -- as a head comes up at him he
    // may turn to meet it at an angle, or draw back, turn to an angle of his
    // choosing and slam it back off that, or draw back, catch it, and hand it
    // back so gently you are early for it. It is the original's own machine
    // (reactToBall), his numbers and all, run for one twin instead of the boss.
    // Put one down and the other gets some health back, goes twice as fast
    // and takes up the dead one's move as well as his own, so the order you
    // kill them in picks the fight you finish on: a big one who slams, or a
    // small one who throws.
    //
    // They come on one at a time: the small one alone for TW_SOLO, then he
    // goes back up and the big one comes down alone for as long, and then
    // both of them for the rest of it. They shout BRANDON! together, and the
    // one left only says "...".

    let TW_HP_BIG      = 24;      // hits to put the big one down
    let TW_HP_SMALL    = 18;      // ...and the small one
    let TW_SOLO        = 5;       // seconds of play each has alone before they fight together
    let TW_W_BIG       = 430;     // how long the big one is
    let TW_W_SMALL     = 210;     // ...and the small one
    let TW_SWEEP_BIG   = 0.35;    // rad/s the big one patrols at
    let TW_SWEEP_SMALL = 1.25;    // ...and the small one
    let TW_THROW       = 2.4;     // seconds between phantom heads, for whoever throws them
    let TW_HEAL        = 0.33;    // share of his health the survivor gets back
    let TW_ALONE_PACE  = 2;       // how much faster the survivor goes
    let TW_YELL_MIN    = 4;       // seconds between their shouts, at least...
    let TW_YELL_MAX    = 8;       // ...and at most
    let TW_Y           = 135;     // where they hang
    let TW_CLIMB       = 0.8;     // how much of the original's climb this fight has
    // The act a run draws them from, 1 easy to 3 hard. Two targets, a barrage
    // and a slam at once, and the survivor heals and picks up the other move
    // -- the longest fight of the new ones.
    let TW_LVL         = 3;
    LAB_KNOBS.push('TW_LVL', 'TW_HP_BIG', 'TW_HP_SMALL', 'TW_W_BIG', 'TW_W_SMALL', 'TW_SWEEP_BIG',
                   'TW_SWEEP_SMALL', 'TW_THROW', 'TW_HEAL', 'TW_Y', 'TW_CLIMB', 'TW_ALONE_PACE', 'TW_YELL_MIN', 'TW_YELL_MAX', 'TW_SOLO');

    let tw = null;

    LAB_BOSS.twins = {
        start(b) {
            const one = (key, w, hp, sweep, mir, dy, ph) => ({
                key, w, h: w / SHAPE_ASPECT,
                x: LW / 2, y: -200, dy, hp, maxHp: hp, flash: 0, pace: 1,
                jt: 0, jnx: 0, jny: 0, iframes: 0, alive: true, sweep, mir, ph,
                throws: key === 'big', slams: key === 'small', throwT: TW_THROW, fall: null,
                tilt: null, lunge: null, seen: new Set(),
                away: key === 'small' ? 0 : 1        // 1 when he is up out of the field
            });
            tw = { t: 0, pend: null, order: [], yell: TW_YELL_MIN, open: 0,
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
            if (phase === 'play') tw.open += dt;
            for (const t of tw.twins) {
                if (t.fall) stepCrumble(t.fall, dt, 0.5);
                if (!t.alive) continue;
                if (t.iframes > 0) t.iframes = Math.max(0, t.iframes - dt);
                if (t.flash > 0) t.flash = Math.max(0, t.flash - dt * 6);
                if (t.jt > 0) t.jt = Math.max(0, t.jt - dt * JIG_DECAY);
                if (phase === 'play') t.ph += (t.key === 'big' ? TW_SWEEP_BIG : TW_SWEEP_SMALL) * t.pace * dt;
                t.x = LW / 2 + Math.sin(t.ph) * Math.max(0, (LW - t.w) / 2) * 0.92;
                const y = TW_Y + t.dy;
                const at = entering ? -(t.h + 40) + (y + t.h + 40) * e : y;
                // up out of the field while it is not his turn, eased there and back
                t.away += Math.max(-dt / TW_TURN, Math.min(dt / TW_TURN, (twOn(t) ? 0 : 1) - t.away));
                const aw = t.away * t.away * (3 - 2 * t.away);
                t.y = at - (at + t.h / 2 + 40) * aw;
                if (t.away > 0.05) { t.tilt = null; t.lunge = null; continue; }
                // the thrower's barrage, the original's phantoms, only in a rally
                if (t.throws && phase === 'play' && (t.throwT -= dt) <= 0) {
                    t.throwT = TW_THROW;
                    if (phantoms.length < PH_CAP) {
                        const a = Math.PI * (0.2 + Math.random() * 0.6);
                        phantoms.push({ x: t.x, y: t.y, vx: Math.cos(a) * PH_SPEED, vy: Math.sin(a) * PH_SPEED,
                                        angle: Math.random() * 6.28, spin: (Math.random() - 0.5) * 18, life: PH_LIFE });
                    }
                }
                twReact(t, dt);
            }
            // together, the same word at the same moment; the one left alone
            // has nothing to say
            if (phase === 'play' && (tw.yell -= dt) <= 0) {
                tw.yell = TW_YELL_MIN + Math.random() * (TW_YELL_MAX - TW_YELL_MIN);
                const live = tw.twins.filter(t => t.alive);
                const here = live.filter(t => t.away < 0.05);
                for (const t of here) labShout(t.x, twY(t) + t.h / 2 + 8, live.length > 1 ? 'BRANDON!' : '...');
            }
            b.hp = tw.twins.reduce((s, t) => s + (t.alive ? t.hp : 0), 0);
            twBox(b);
        },
        contact(br, ball) {
            for (const t of tw.twins) {       // the small one first: he hangs in front
                if (!t.alive || t.away > 0.5) continue;
                const hit = maskContact(ball, t.x, twY(t), twAng(t), t.w, t.h, MASK, t.mir);
                if (hit) { tw.pend = t; return hit; }
            }
            tw.pend = null;
            return null;
        },
        // He came forward into this one: it goes back off the angle he turned
        // to, square off his face, at the rally's speed. On a fake he only
        // catches it, and holds it (see holds). Anything else is an ordinary
        // bounce off however he is turned.
        touch(br, ball, hit) {
            const t = tw.pend;
            const l = t && t.lunge;
            if (!l || l.ball !== ball || l.stage === 'back') return false;
            if (!l.fake) {
                const s = effSpeed() * (ball.boost || 1);
                labBounce(ball, hit);
                ball.vx = -Math.sin(l.aim) * s;
                ball.vy = Math.cos(l.aim) * s;
                l.stage = 'back';
            } else if (l.stage === 'rear') {
                l.stage = 'hold';
                l.wait = FAKE_MIN + Math.random() * (FAKE_MAX - FAKE_MIN);
                l.dx = ball.x - t.x;
                l.dy = ball.y - twY(t);
            } else return false;
            twHit(t, hit.cx, hit.cy);
            tw.pend = null;
            return true;
        },
        holds(ball) { return tw.twins.some(t => t.alive && twCaught(t, ball)); },
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

    // where he is drawn and met: drawn back or come forward by his lunge...
    function twY(t) { return t.y + (t.lunge ? t.lunge.off : 0); }
    // ...and turned by his tilt, eased in and out
    function twAng(t) {
        const k = t.tilt ? t.tilt.k : 0;
        return t.tilt ? t.tilt.a * k * k * (3 - 2 * k) : 0;
    }

    function twCaught(t, ball) {
        return !!t.lunge && t.lunge.ball === ball && (t.lunge.stage === 'hold' || t.lunge.stage === 'touch');
    }

    // The original's reactToBall, for one twin: a head coming up under him
    // gets one roll, a turn to meet it, a draw back to hit it, both, or
    // neither, and each lets go once its ball has turned back.
    // Whose turn it is: the small one's, then the big one's, then both --
    // and whoever is left, once one is down.
    const TW_TURN = 0.8;              // seconds going up out of the field, or coming down
    function twOn(t) {
        if (tw.twins.some(o => o !== t && !o.alive)) return true;
        if (tw.open < TW_SOLO) return t.key === 'small';
        if (tw.open < TW_SOLO * 2) return t.key === 'big';
        return true;
    }

    function twReact(t, dt) {
        const live = t.slams && phase === 'play';
        if (live) {
            for (const ball of balls) {
                if (ball.stuck) continue;
                if (ball.vy >= 0) { t.seen.delete(ball); continue; }
                const gap = ball.y - (twY(t) + t.h / 2);
                if (t.seen.has(ball) || gap < 0 || gap > NOTICE_PX) continue;
                if (Math.abs(ball.x - t.x) > t.w / 2 + NOTICE_PX * 0.5) continue;   // headed for the other one
                t.seen.add(ball);
                if (!t.tilt && Math.random() < TILT_ODDS) {
                    const a = TILT_MIN + Math.random() * (TILT_MAX - TILT_MIN);
                    t.tilt = { ball, a: Math.random() < 0.5 ? -a : a, k: 0, out: false };
                }
                if (!t.lunge && Math.random() < LUNGE_ODDS) {
                    const aim = SLAM_ANGLES[(Math.random() * SLAM_ANGLES.length) | 0];
                    t.lunge = { ball, off: 0, stage: 'rear', fake: Math.random() < FAKE_ODDS, aim };
                    if (!t.tilt || t.tilt.ball === ball) t.tilt = { ball, a: aim, k: t.tilt ? t.tilt.k : 0, out: false };
                }
            }
            for (const ball of t.seen) if (!balls.includes(ball)) t.seen.delete(ball);
        }
        if (t.tilt) {
            const tb = t.tilt.ball;
            if (!live || !balls.includes(tb) || (tb.vy >= 0 && !twCaught(t, tb))) t.tilt.out = true;
            t.tilt.k = t.tilt.out ? t.tilt.k - dt / TILT_OUT : Math.min(1, t.tilt.k + dt / TILT_IN);
            if (t.tilt.out && t.tilt.k <= 0) t.tilt = null;
        }
        const l = t.lunge;
        if (!l) return;
        const ball = l.ball;
        const gone = !live || !balls.includes(ball);
        if (twCaught(t, ball)) {
            if (gone) l.stage = 'back';
            if (l.stage === 'hold' && (l.wait -= dt) <= 0) l.stage = 'touch';
        } else if (l.stage !== 'back' && (gone || ball.vy >= 0)) {
            l.stage = 'back';
        }
        if (l.stage === 'rear' && !l.fake) {
            // forward once the gap left is what the rest of the swing takes
            const swing = (LUNGE_PX - l.off) / LUNGE_SPEED;
            const gap = ball.y - extY(ball) - (twY(t) + t.h / 2);
            if (gap <= (Math.abs(ball.vy) + LUNGE_SPEED) * swing) l.stage = 'lunge';
        }
        const st = l.stage;
        const want = st === 'rear' || st === 'hold' ? -REAR_PX
                   : st === 'lunge' ? LUNGE_PX : st === 'touch' ? TOUCH_PX : 0;
        const rate = (st === 'lunge' ? LUNGE_SPEED : st === 'touch' ? TOUCH_SPEED : REAR_SPEED) * dt;
        l.off += Math.max(-rate, Math.min(rate, want - l.off));
        // the one he caught goes where he went
        if (twCaught(t, ball) && !gone) { ball.x = t.x + l.dx; ball.y = twY(t) + l.dy; }
        if (st === 'touch' && l.off >= TOUCH_PX - 0.5) {
            // let go at the end of the reach, barely moving, off the angle he turned to
            const m = Math.hypot(ball.vx, ball.vy) || 1;
            ball.vx = -Math.sin(l.aim) * m;
            ball.vy = Math.cos(l.aim) * m;
            ball.boost = TOUCH_MUL;
            l.stage = 'back';
        }
        if (l.stage === 'back' && Math.abs(l.off) < 0.5) t.lunge = null;
    }

    // the box the physics looks for them in: round both of them, however far
    // they have drawn back, come forward or turned
    function twBox(b) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const t of tw.twins) {
            if (!t.alive) continue;
            const tall = t.h / 2 + Math.abs(Math.sin(twAng(t))) * t.w / 2;
            x0 = Math.min(x0, t.x - t.w / 2); x1 = Math.max(x1, t.x + t.w / 2);
            y0 = Math.min(y0, twY(t) - tall); y1 = Math.max(y1, twY(t) + tall);
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
        // whatever he was holding falls out of his hands, down at you
        if (t.lunge && twCaught(t, t.lunge.ball)) {
            const ball = t.lunge.ball;
            ball.vy = Math.abs(ball.vy) || effSpeed();
        }
        t.lunge = null;
        t.tilt = null;
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
            other.pace = TW_ALONE_PACE;
            labShout(other.x, other.y + other.h / 2 + 8, '...');
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
        ctx.translate(t.x + t.jnx * o, twY(t) + t.jny * o);
        ctx.rotate(twAng(t));
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