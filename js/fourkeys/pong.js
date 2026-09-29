'use strict';

    // ---- PONG (mini-boss) ---------------------------------------------------------------
    // A second you, undyed, lying along the ceiling upside down and sending the
    // ball back off his own deck the way you do -- the end of him to angle it,
    // and his own travel for spin. The ceiling behind him is his floor, and
    // every head that touches it costs him. The one fight where the aim is to
    // get the ball past him rather than into him. Breakout grew out of Pong,
    // so this brings the other player back. On a stage he lies above the wall;
    // on an open field it is just the two of you.
    let PONG_HP    = 5;       // heads past him to finish him
    let PONG_SPEED = 270;     // px/s he can move
    // He is beaten the way a Pong opponent always has been: late, and off the
    // walls. He does not move for a head until it is within PONG_WAKE of him,
    // and he only reads PONG_READ of a bounce off a side wall -- at 0 he runs
    // to where it would land if the walls were not there, and has to turn
    // round once he sees it come off one.
    let PONG_WAKE  = 240;     // px below him a head has to be before he goes for it
    let PONG_READ  = 0.3;     // how much of a bank shot he sees coming
    let PONG_ERR   = 45;      // px he can be out by, rolled each time one comes up at him
    let PONG_AIM   = 0.5;     // how far along himself he tries to take it, to send it away from you
    let PONG_HOME  = 0.3;     // share of the way back to the middle he goes while it is away
    let PONG_Y     = 36;      // his middle, down from the ceiling
    let PONG_W     = 160;     // his length: yours, as you start
    let PONG_PTS   = 150;     // a head past him
    // The act a run draws him from, 1 easy to 3 hard. He cannot hurt you at
    // all -- he only refuses to let anything past -- but he is the one that
    // has to be out-played rather than out-aimed.
    let PONG_LVL   = 5;
    LAB_KNOBS.push('PONG_LVL', 'PONG_HP', 'PONG_SPEED', 'PONG_WAKE', 'PONG_READ', 'PONG_ERR',
                   'PONG_AIM', 'PONG_HOME', 'PONG_Y', 'PONG_W', 'PONG_PTS');

    let pong = null;
    // Making a level's entrance he is a jumpscare. He waits, unseen, for the
    // first head that is about to reach the back wall with nothing left in
    // its way (`due`), then drops out of the ceiling in PONG_POP right where
    // it will get there, shouting, and sends it back. If the wall goes before
    // any head gets up there, he slides in along the ceiling over PONG_ENTER
    // instead. No head gets past him until he is there.
    const PONG_ENTER = 1.8;
    const PONG_POP = 0.22;
    let pongAt = null;               // where `due` saw the head going to reach him

    LAB_MINI.pong = {
        due() {
            const line = PONG_Y + pongH() / 2;
            for (const b of balls) {
                if (b.stuck || caught(b) || b.vy >= 0) continue;
                const t = (b.y - extY(b) - line) / -b.vy;
                if (t < 0 || t > PONG_POP + 0.08) continue;
                const x = labFold(b.x + b.vx * t), mid = (b.x + x) / 2;
                const open = !bricks.some(o => o.alive && o.y + bh > line && o.y < b.y &&
                                               Math.abs(o.x + bw / 2 - mid) < bw / 2 + extX(b));
                if (open) { pongAt = x; return true; }
            }
            return false;
        },
        start(entering) {
            const from = Math.random() < 0.5 ? -1 : 1;
            const pop = entering && pongAt !== null;
            const x0 = pop ? Math.max(PONG_W / 2, Math.min(LW - PONG_W / 2, pongAt))
                     : entering ? LW / 2 + from * (LW / 2 + PONG_W) : LW / 2;
            pongAt = null;
            pong = { x: x0, vx: 0, home: LW / 2, dy: pop ? -(PONG_Y + pongH()) : 0, pop,
                     hp: PONG_HP, maxHp: PONG_HP, flash: 0, jt: 0,
                     goals: 0, returns: 0, fall: null, enter: entering ? 0 : 1, from };
            return true;
        },
        enter() {
            const at = () => ({ x: Math.max(70, Math.min(LW - 70, pong.x)), y: PONG_Y + (pong.dy || 0) + pongH() + 16 });
            return Object.assign(at(), { at });
        },
        reset() { pong = null; },
        busy() { return !!pong && pong.hp > 0; },
        update: pongUpdate,
        ballStep: pongBallStep,
        ceiling(ball) {
            if (!pong || pong.hp <= 0 || phase !== 'play' || pong.enter < 1) return;
            pong.hp--;
            pong.goals++;
            pong.flash = 1;
            award(PONG_PTS, ball.x, 60);
            if (pong.hp > 0) return;
            pong.fall = shatter(pong.x, PONG_Y, PONG_W, 1.2);
            labMiniDown();
            labClearIfDone();
        },
        draw: pongDraw,
        finish() { if (!pong || pong.hp <= 0) return false; pong.hp = 1; return true; },
        state() {
            return { name: 'PONG', hp: pong.hp, max: pong.maxHp,
                     line: pong.hp > 0 ? pong.goals + ' past him · he has sent back ' + pong.returns : 'beaten' };
        }
    };

    const pongH = () => PONG_W / SHAPE_ASPECT;

    function pongUpdate(dt) {
        if (!pong) return;
        if (pong.fall) stepCrumble(pong.fall, dt, 0.2);
        if (pong.hp <= 0) return;
        if (pong.flash > 0) pong.flash = Math.max(0, pong.flash - dt * 4);
        if (pong.jt > 0) pong.jt = Math.max(0, pong.jt - dt * JIG_DECAY);
        if (pong.enter < 1) {
            if (pong.pop) {
                // down out of the ceiling, a little past his line and back
                pong.enter = Math.min(1, pong.enter + dt / PONG_POP);
                const k = pong.enter, e = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
                pong.dy = -(PONG_Y + pongH()) * (1 - e);
                if (pong.enter >= 1) { pong.dy = 0; pong.jt = 1; }
                return;
            }
            pong.enter = Math.min(1, pong.enter + dt / PONG_ENTER);
            const k = pong.enter, e = 1 - Math.pow(1 - k, 3);
            pong.x = LW / 2 + pong.from * (LW / 2 + PONG_W) * (1 - e);
            return;
        }
        if (phase !== 'play') return;
        // the head that will reach him first, of the ones close enough to go for
        const line = PONG_Y + pongH() / 2;
        let pick = null, soon = Infinity;
        for (const b of balls) {
            if (b.stuck || caught(b)) continue;
            if (b.vy >= 0) { b.pongErr = undefined; continue; }
            if (b.y - line > PONG_WAKE) continue;
            const t = (b.y - extY(b) - line) / -b.vy;
            if (t >= 0 && t < soon) { soon = t; pick = b; }
        }
        let tx;
        if (pick) {
            if (pick.pongErr === undefined) pick.pongErr = (Math.random() * 2 - 1) * PONG_ERR;
            // where it will cross his line, and where it would if the walls
            // were not there: he reads PONG_READ of the difference
            const land = labFold(pick.x + pick.vx * soon);
            const naive = Math.max(0, Math.min(LW, pick.x + pick.vx * soon));
            const read = naive + (land - naive) * PONG_READ;
            // off his end on the side that sends it away from you
            const away = paddle.x > land ? 1 : -1;
            tx = read + pick.pongErr + away * PONG_AIM * PONG_W / 2;
            pong.home = null;
        } else {
            if (pong.home === null) pong.home = pong.x + (LW / 2 - pong.x) * PONG_HOME;
            tx = pong.home;
        }
        const step = PONG_SPEED * dt;
        const dx = Math.max(-step, Math.min(step, tx - pong.x));
        pong.x = Math.max(PONG_W / 2, Math.min(LW - PONG_W / 2, pong.x + dx));
        pong.vx = dx / Math.max(dt, 1e-4);
    }

    // his deck, upside down: a head coming up onto his underside goes back
    // down off it, angled by where on him it landed, and spun by his travel
    // the way yours spins it -- turned the other way, since he is upside down
    function pongBallStep(b) {
        // dropping in, he is there to meet it just before he has settled
        if (!pong || pong.hp <= 0 || b.vy >= 0 || pong.enter < (pong.pop ? 0.7 : 1)) return;
        const line = PONG_Y + pongH() / 2, ry = extY(b);
        if (b.y - ry > line || b.y < PONG_Y) return;              // not up to him yet, or already past
        if (Math.abs(b.x - pong.x) > PONG_W / 2 + extX(b) * 0.6) return;   // beside him
        const s = effSpeed() * (b.boost || 1);
        const off = Math.max(-1, Math.min(1, (b.x - pong.x) / (PONG_W / 2)));
        b.y = line + ry + 0.5;
        const a = Math.max(-STEER_CAP, Math.min(STEER_CAP, off * MAX_ANGLE));
        b.vx = Math.sin(a) * s;
        b.vy = Math.cos(a) * s;
        const kick = Math.max(-SPIN_KICK, Math.min(SPIN_KICK, -(off * SPIN_EDGE + pong.vx * SPIN_SWIPE)));
        b.spin = Math.max(-SPIN_MAX, Math.min(SPIN_MAX, b.spin + kick / SPIN_INERTIA));
        b.pongErr = undefined;
        pong.jt = 1;
        pong.returns++;
        bumpSpeed(BRICK_BUMP);
    }

    function pongDraw() {
        if (!pong) return;
        if (pong.fall) pongCrumble(pong.fall);
        if (pong.hp <= 0) return;
        const w = PONG_W, h = pongH();
        const sp = shapeSprite('pong', null, w, h, false);
        if (!sp) return;
        // a knock puts him up into the ceiling a little, the way yours puts you down
        const o = pong.jt > 0 ? wobble(pong.jt) * JIG_PADDLE : 0;
        ctx.save();
        ctx.translate(pong.x, PONG_Y + (pong.dy || 0) - Math.abs(o));
        ctx.scale(1, -1);
        ctx.drawImage(sp, -w / 2, -h / 2, w, h);
        if (pong.flash > 0) {
            ctx.globalAlpha = Math.min(1, pong.flash) * 0.7;
            ctx.drawImage(shapeSprite('flash', '#f2efe9', w, h, true), -w / 2, -h / 2, w, h);
            ctx.globalAlpha = 1;
        }
        ctx.restore();
        if (pong.enter >= 1) labBar(pong.x - 40, PONG_Y + h / 2 + 5, 80, pong.hp / pong.maxHp, 3);
    }

    // drawCrumble, the right way up for a man lying on the ceiling: each piece
    // shows the row of him it came from, turned over, and still falls down
    function pongCrumble(c) {
        const sp = greySprite();
        if (!sp) return;
        const w = c.w, h = w / SHAPE_ASPECT;
        const x0 = c.x - w / 2, y0 = c.y - h / 2;
        const cw = w / MCOLS, ch = h / MROWS;
        const sw = sp.width / MCOLS, sh = sp.height / MROWS;
        for (const s of c.pieces) {
            const a = Math.max(0, 1 - s.age / F_GONE);
            if (a <= 0.002) continue;
            const v = MROWS - 1 - s.v;
            ctx.save();
            ctx.globalAlpha = a;
            ctx.translate(x0 + (s.u + 0.5) * cw + s.dx, y0 + (v + 0.5) * ch + s.dy);
            ctx.rotate(s.rot);
            ctx.scale(1, -1);
            ctx.drawImage(sp, s.u * sw, s.v * sh, sw, sh, -cw / 2 - 0.5, -ch / 2 - 0.5, cw + 1, ch + 1);
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }