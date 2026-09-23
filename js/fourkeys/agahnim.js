'use strict';

    // ---- AGAHNIM (boss) ----------------------------------------------------------
    // No wall and no barrage: just him and you, hitting one head back and
    // forth. He stands upright -- the one thing in this game that is on its
    // feet -- and he meets the head and sends it back, and every exchange winds
    // it up faster the way a brick bounce does. Past AG_MEET he cannot get
    // there any more, and every contact from then on is a wound. So the head
    // that beats him is one you have kept alive for a dozen exchanges, which is
    // also a head that is now very fast coming at you. Lose it and the rally
    // starts again at walking pace.
    let AG_LVL   = 0;
    let AG_HP    = 6;       // wounds to finish him
    let AG_W     = 300;     // how tall he stands
    let AG_Y     = 165;     // where his middle is
    // px/s: the fastest head he can still send back. A rally on the boss stage
    // opens near 457 and every exchange adds BRICK_BUMP, so this is about a
    // dozen of them before he starts taking it.
    let AG_MEET  = 580;
    let AG_SPEED = 320;     // px/s he moves to meet one
    let AG_DRIFT = 0.3;     // how much of the field he wanders when nothing is coming
    let AG_CLIMB = 0.6;     // how much of the original's climb this fight has
    LAB_KNOBS.push('AG_LVL', 'AG_HP', 'AG_W', 'AG_Y', 'AG_MEET', 'AG_SPEED', 'AG_DRIFT', 'AG_CLIMB');

    let ag = null;

    LAB_BOSS.agahnim = {
        start(b) {
            b.hp = b.maxHp = AG_HP;
            ag = { x: LW / 2, vx: 0, home: LW / 2, t: 0, rally: 0, met: 0, flash: 0, jt: 0, jnx: 0, jny: 0 };
            agBox(b);
        },
        reset() { ag = null; },
        update(b, dt) {
            if (ag.flash > 0) ag.flash = Math.max(0, ag.flash - dt * 6);
            if (ag.jt > 0) ag.jt = Math.max(0, ag.jt - dt * JIG_DECAY);
            if (phase === 'entrance') { agBox(b); return; }
            if (phase === 'play') {
                ag.t += dt;
                // he goes to meet whatever is on its way up
                let pick = null, soon = Infinity;
                for (const k of balls) {
                    if (k.stuck || caught(k) || k.vy >= 0) continue;
                    const t = (k.y - AG_Y) / -k.vy;
                    if (t >= 0 && t < soon) { soon = t; pick = k; }
                }
                const want = pick ? labFold(pick.x + pick.vx * soon)
                                  : LW / 2 + Math.sin(ag.t * 0.5) * AG_DRIFT * LW / 2;
                const step = AG_SPEED * dt;
                const dx = Math.max(-step, Math.min(step, want - ag.x));
                ag.x = Math.max(AG_W / 4, Math.min(LW - AG_W / 4, ag.x + dx));
                ag.vx = dx / Math.max(dt, 1e-4);
            }
            agBox(b);
        },
        contact(br, ball) {
            // upright: his own box turned a quarter, so his head points at the ceiling
            return maskContact(ball, ag.x, AG_Y, -Math.PI / 2, AG_W, AG_W / SHAPE_ASPECT, MASK, false);
        },
        // every contact is his to deal with: he either sends it back or takes it
        touch(br, ball, hit) {
            const fast = Math.hypot(ball.vx, ball.vy);
            ag.jt = 1;
            ag.jnx = Math.sign(hit.cx - ag.x) || 1;
            ag.jny = 0;
            if (fast > AG_MEET) {
                labBounce(ball, hit);
                agHit(br, hit.cx, hit.cy);
                return true;
            }
            // met, and sent back at whichever of the original's angles lands
            // furthest from you -- and the exchange winds the head up
            ag.met++;
            ag.rally++;
            const s = effSpeed() * (ball.boost || 1);
            ball.y = Math.max(ball.y, AG_Y + AG_W / SHAPE_ASPECT / 2 + extY(ball) + 2);
            let pick = 0, far = -1;
            for (const a of SLAM_ANGLES) {
                const d = Math.abs(labFold(ball.x - Math.tan(a) * Math.max(0, padY() - ball.y)) - paddle.x);
                if (d > far) { far = d; pick = a; }
            }
            ball.vx = -Math.sin(pick) * s;
            ball.vy = Math.cos(pick) * s;
            bumpSpeed(BRICK_BUMP);
            rings.push({ x: hit.cx, y: hit.cy, t: 1 });
            return true;
        },
        hit(b, cx, cy) { agHit(b, cx, cy); },
        draw: agDraw,
        drawFall: agDrawFall,
        climb() { return AG_CLIMB; },
        finish(b) { b.hp = Math.min(b.hp, 1); return true; },
        state(b) {
            const fast = Math.max(0, ...balls.filter(k => !k.stuck).map(k => Math.hypot(k.vx, k.vy)));
            return { name: 'AGAHNIM', hp: b.hp, max: b.maxHp,
                     line: 'the head is doing ' + Math.round(fast) + ' px/s · he can still meet ' +
                           Math.round(AG_MEET) + ' · ' + ag.rally + ' exchanges' };
        }
    };

    function agBox(b) {
        bw = AG_W / SHAPE_ASPECT;         // upright: his thickness across, his length down
        bh = AG_W;
        b.x = ag.x - bw / 2;
        b.y = AG_Y - bh / 2;
    }

    function agHit(b, cx, cy) {
        const br = bricks[0];
        if (bossIF > 0) return;
        bossIF = BOSS_IF;
        ag.flash = 1;
        br.hp = Math.max(0, br.hp - 1);
        bossHits++;
        const done = br.hp <= 1e-6;
        award(BOSS_PTS * (done ? 5 : 2), cx, cy);
        if (done) {
            br.alive = false;
            clearStage();
            bossFall = shatter(ag.x, AG_Y, AG_W, A_DIE_T);
            if (impact) { impact.x = ag.x; impact.y = AG_Y; impact.w = AG_W; impact.rot = -Math.PI / 2; }
            return;
        }
        if (bossHits % BOSS_CAP === 0 && !capsule) {
            const pool = capsulePool();
            capsule = { x: ag.x, y: AG_Y, kind: pool[(Math.random() * pool.length) | 0] };
        }
        if (++hits === 4 || hits === 12) bumpSpeed(1.12);
    }

    function agDraw(b) {
        const sp = shapeSprite('boss', null, BOSS_W0, BOSS_H, false);
        if (!sp) return;
        const th = AG_W / SHAPE_ASPECT;
        const o = ag.jt > 0 ? wobble(ag.jt) * JIG_BRICK : 0;
        const k = phase === 'entrance' ? enterK() : 1;
        const y = AG_Y - (1 - k) * (AG_Y + AG_W);
        ctx.save();
        ctx.translate(ag.x + ag.jnx * o, y);
        ctx.rotate(-Math.PI / 2);
        ctx.drawImage(sp, -AG_W / 2, -th / 2, AG_W, th);
        if (ag.flash > 0) {
            ctx.globalAlpha = Math.min(1, ag.flash) * 0.7;
            ctx.drawImage(shapeSprite('flash', '#f2efe9', BOSS_W0, BOSS_H, true), -AG_W / 2, -th / 2, AG_W, th);
            ctx.globalAlpha = 1;
        }
        ctx.restore();
        if (k > 0.001) labBar(LW / 2 - 150 * k, 10, 300 * k, b.hp / b.maxHp);
    }

    // he is the one who stands, so his end is lying down: the turn eases out of
    // him over the drain, and then he comes apart level like everybody else
    function agDrawFall() {
        const c = bossFall;
        if (!c) return;
        const wilt = Math.max(0, Math.min(1, ascendT / A_DIE));
        const e = wilt * wilt * (3 - 2 * wilt);
        const turn = -Math.PI / 2 * (1 - e);
        if (ascendT < A_DIE) {
            drawFigure(c.x, c.y + e * F_SAG, c.w, 1, e, turn + e * F_LEAN);
            return;
        }
        drawCrumble(c, e * F_SAG, e * F_LEAN, true);
    }