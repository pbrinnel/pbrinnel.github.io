'use strict';

    // ---- DODONGO (boss) ----------------------------------------------------------
    // His head at boss size, in full colour, and the mouth is the one in the
    // photograph. Any head that goes in is swallowed. A plain one he keeps for
    // a moment, heals a little on, and spits back at you. One that is turning
    // hard enough goes off inside him: a wound, and he coughs it out. The SPIN
    // rule under BONUS is the reading of whether the next one will do anything,
    // so the fight is working the head up on your own paddle and then putting
    // it somewhere you could hit by accident.
    let DOD_LVL   = 0;
    let DOD_HP    = 8;       // wounds to finish him
    let DOD_W     = 300;     // how wide he is
    let DOD_Y     = 115;     // where his middle hangs
    let DOD_MOUTH = 0.34;    // how much of his width the mouth takes
    let DOD_SPIN  = 0.6;     // share of max-bonus spin a head needs to go off inside him
    let DOD_HOLD  = 1.2;     // seconds he keeps a plain one
    let DOD_HEAL  = 1;       // ...and the hits it gives him back
    let DOD_SWAY  = 30;      // px he drifts either side
    let DOD_CLIMB = 0.5;     // how much of the original's climb this fight has
    LAB_KNOBS.push('DOD_LVL', 'DOD_HP', 'DOD_W', 'DOD_Y', 'DOD_MOUTH', 'DOD_SPIN', 'DOD_HOLD',
                   'DOD_HEAL', 'DOD_SWAY', 'DOD_CLIMB');

    // where his mouth is in the photograph: its middle, and how tall it is as a
    // share of his height. DOD_LIP is how far down him the way in starts, since
    // what a head actually meets is his outline rather than his face.
    const DOD_MOUTH_U = 0.5, DOD_MOUTH_V = 0.72, DOD_MOUTH_H = 0.13;
    const DOD_LIP = 0.55;

    let dod = null;

    LAB_BOSS.dodongo = {
        start(b) {
            bw = DOD_W;
            bh = bw * (BALL_RY / BALL_RX);
            b.hp = b.maxHp = DOD_HP;
            b.x = (LW - bw) / 2;
            b.y = -(bh + 40);
            dod = { t: 0, held: null, holdT: 0, gulp: 0, fed: 0, blew: 0, cough: 0 };
        },
        reset() { dod = null; },
        update(b, dt) {
            bw = DOD_W;
            bh = bw * (BALL_RY / BALL_RX);
            if (phase === 'entrance') {
                const raw = enterK(), k = raw * raw * (3 - 2 * raw);
                const from = -(bh + 40);
                b.x = (LW - bw) / 2;
                b.y = from + (DOD_Y - bh / 2 - from) * k;
                return;
            }
            if (phase === 'play') dod.t += dt;
            b.x = LW / 2 + Math.sin(dod.t * 0.4) * DOD_SWAY - bw / 2;
            b.y = DOD_Y - bh / 2;
            if (dod.cough > 0) dod.cough = Math.max(0, dod.cough - dt);
            // one he has given back is out through him, not off him, until it
            // is clear of his chin
            for (const k of balls) if (k.dodOut && k.y - extY(k) > b.y + bh) k.dodOut = false;
            if (!dod.held) return;
            if (!balls.includes(dod.held)) { dod.held = null; return; }
            // held in his mouth, out of sight, until he gives it back
            const m = dodMouth(b);
            dod.held.x = m.x;
            dod.held.y = m.y;
            dod.held.vx = 0; dod.held.vy = 0; dod.held.spin = 0; dod.held.eng = 0;
            dod.gulp = Math.min(1, dod.gulp + dt / 0.25);
            if (phase === 'play' && (dod.holdT -= dt) <= 0) dodSpit(b);
        },
        contact(br, ball) {
            if (ball.dodOut) return null;            // one he is giving back goes out through him
            return ellipseContact(ball, br.x + bw / 2, br.y + bh / 2, bw / 2, bh / 2);
        },
        // anything that is not the mouth is just his face: solid, and it says so
        glances() { return true; },
        touch(br, ball, hit) {
            if (dod.held || ball.dodOut) return false;
            const m = dodMouth(br);
            // His mouth is a way in, not a spot on his face. A head only ever
            // meets his outline, so what counts is arriving under him inside
            // the mouth's span: that goes in, and his outline anywhere else is
            // just his face.
            if (Math.abs(hit.cx - m.x) > DOD_MOUTH * bw / 2) return false;
            if (hit.cy < br.y + bh * DOD_LIP) return false;
            // in it goes
            dod.held = ball;
            dod.gulp = 0;
            dod.fed++;
            ball.vx = 0; ball.vy = 0; ball.boost = 1;
            const turn = Math.abs(turnOf(ball));
            if (turn >= DOD_SPIN * SPIN_FULL) {
                dodHurt(br, hit.cx, hit.cy);
                dod.holdT = 0.25;                     // he coughs it straight back out
                dod.blew++;
                dod.cough = 1;
            } else {
                dod.holdT = DOD_HOLD;
                br.hp = Math.min(br.maxHp, br.hp + DOD_HEAL);
            }
            return true;
        },
        hit() { /* his face takes nothing: see touch */ },
        holds(ball) { return !!dod && dod.held === ball; },
        skipBall(ball) { return !!dod && dod.held === ball; },
        draw: dodDraw,
        drawFall() { labHeadFall(); },
        climb() { return DOD_CLIMB; },
        finish(b) { b.hp = Math.min(b.hp, 1); return true; },
        state(b) {
            const turn = liveTurn();
            return { name: 'DODONGO', hp: b.hp, max: b.maxHp, w: bw,
                     line: 'the head is turning ' + turn.toFixed(0) + ' of the ' +
                           Math.round(DOD_SPIN * SPIN_FULL) + ' it takes · fed ' + dod.fed +
                           ' · ' + dod.blew + ' went off' };
        }
    };

    function dodMouth(b) {
        return { x: b.x + DOD_MOUTH_U * bw, y: b.y + DOD_MOUTH_V * bh };
    }

    function dodHurt(b, cx, cy) {
        b.flash = 1;
        b.hp = Math.max(0, b.hp - 1);
        bossHits++;
        const done = b.hp <= 1e-6;
        award(BOSS_PTS * (done ? 5 : 2), cx, cy);
        if (done) {
            dod.held = null;
            b.alive = false;
            clearStage();
            labHeadDied(b.x + bw / 2, b.y + bh / 2, bw);
            return;
        }
        if (bossHits % BOSS_CAP === 0 && !capsule) {
            const pool = capsulePool();
            capsule = { x: b.x + bw / 2, y: b.y + bh, kind: pool[(Math.random() * pool.length) | 0] };
        }
        if (++hits === 4 || hits === 12) bumpSpeed(1.12);
    }

    // back out of the mouth, at the rally's speed and never faster, at the
    // angle of the original's that lands furthest from you
    function dodSpit(b) {
        const ball = dod.held;
        dod.held = null;
        if (!ball) return;
        const m = dodMouth(b), s = effSpeed();
        ball.x = m.x;
        ball.y = m.y;
        let pick = 0, far = -1;
        for (const a of SLAM_ANGLES) {
            const d = Math.abs(labFold(ball.x - Math.tan(a) * Math.max(0, padY() - ball.y)) - paddle.x);
            if (d > far) { far = d; pick = a; }
        }
        ball.vx = -Math.sin(pick) * s;
        ball.vy = Math.cos(pick) * s;
        ball.dodOut = true;
    }

    function dodDraw(b) {
        const w = bw, h = bh;
        if (!ready(ballImg)) return;
        const o = b.jt > 0 ? wobble(b.jt) * JIG_BRICK * 0.6 : 0;
        const x = b.x + b.jnx * o, y = b.y + b.jny * o;
        ctx.drawImage(ballImg, x, y, w, h);
        // whatever he is swallowing, going down
        if (dod.held) {
            const m = dodMouth(b), k = 1 - dod.gulp;
            const r = bRX() * (0.35 + 0.65 * k);
            ctx.globalAlpha = 0.85 * k + 0.15;
            drawBall(m.x, m.y, r, dod.held.angle);
            ctx.globalAlpha = 1;
        }
        if (b.flash > 0) {
            ctx.globalAlpha = Math.min(1, b.flash) * 0.7;
            ctx.drawImage(headSprite2('flat', '#f2efe9'), x, y, w, h);
            ctx.globalAlpha = 1;
        }
        if (LAB.zone) {
            // lab only: the way in, which is his underside inside the mouth's span
            const m = dodMouth(b);
            ctx.fillStyle = 'rgba(207,107,78,0.35)';
            ctx.fillRect(m.x - DOD_MOUTH * w / 2, y + h * DOD_LIP, DOD_MOUTH * w, h * (1 - DOD_LIP));
        }
        const grow = phase === 'entrance' ? enterK() : 1;
        if (grow > 0.001) labBar(LW / 2 - 150 * grow, 10, 300 * grow, b.hp / b.maxHp);
    }