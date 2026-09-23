'use strict';

    // ---- THE GUARD (mini-boss) ---------------------------------------------------
    // One brandon patrolling in front of the wall, who turns to face whichever
    // side a head is coming from and commits to it. Hits on the end he is
    // facing ring off him. Hits on his back hurt. He commits early, so the way
    // behind him is a shot that crosses him after he has made his mind up --
    // off a side wall, or off the ceiling. It is the one thing in this game
    // that asks for a bank shot.
    let GUARD_LVL    = 3;
    let GUARD_HP     = 4;      // hits in the back to see him off
    let GUARD_W      = 170;    // how long he is
    let GUARD_Y      = 300;    // the line he patrols
    let GUARD_SPEED  = 110;    // px/s he walks at
    let GUARD_NOTICE = 260;    // px away a head is when he commits to a side
    let GUARD_TURN   = 0.22;   // seconds his turn takes
    let GUARD_PTS    = 150;    // a hit in the back
    LAB_KNOBS.push('GUARD_LVL', 'GUARD_HP', 'GUARD_W', 'GUARD_Y', 'GUARD_SPEED', 'GUARD_NOTICE',
                   'GUARD_TURN', 'GUARD_PTS');

    let guard = null;

    LAB_MINI.guard = {
        start() {
            guard = { x: LW / 2, dir: 1, face: 1, from: 1, turn: 0, hp: GUARD_HP, maxHp: GUARD_HP,
                      flash: 0, jt: 0, jnx: 0, jny: 0, committed: false, blocks: 0, hurt: 0, fall: null };
            return true;
        },
        reset() { guard = null; },
        busy() { return !!guard && guard.hp > 0; },
        update(dt) {
            if (!guard) return;
            if (guard.fall) stepCrumble(guard.fall, dt, 0.2);
            if (guard.hp <= 0) return;
            if (guard.flash > 0) guard.flash = Math.max(0, guard.flash - dt * 6);
            if (guard.jt > 0) guard.jt = Math.max(0, guard.jt - dt * JIG_DECAY);
            if (guard.turn > 0 && (guard.turn += dt / GUARD_TURN) >= 1) guard.turn = 0;
            if (phase !== 'play') return;
            guard.x += guard.dir * GUARD_SPEED * dt;
            if (guard.x < GUARD_W / 2) { guard.x = GUARD_W / 2; guard.dir = 1; }
            if (guard.x > LW - GUARD_W / 2) { guard.x = LW - GUARD_W / 2; guard.dir = -1; }
            // he makes his mind up while it is still on its way, and does not
            // change it until the head has gone by
            let near = null, gap = Infinity;
            for (const b of balls) {
                if (b.stuck || caught(b)) continue;
                const d = Math.hypot(b.x - guard.x, b.y - GUARD_Y);
                if (d < gap) { gap = d; near = b; }
            }
            if (!near || gap > GUARD_NOTICE * 1.6) guard.committed = false;
            if (near && gap <= GUARD_NOTICE && !guard.committed) {
                guard.committed = true;
                const side = near.x < guard.x ? -1 : 1;
                if (side !== guard.face) { guard.from = guard.face; guard.face = side; guard.turn = 1e-6; }
            }
        },
        ballStep(b) {
            if (!guard || guard.hp <= 0) return;
            const h = GUARD_W / SHAPE_ASPECT;
            const hit = maskContact(b, guard.x, GUARD_Y, 0, GUARD_W, h, MASK, guardFace() < 0);
            if (!hit) return;
            labBounce(b, hit);
            guard.jt = 1;
            guard.jnx = Math.sign(guard.x - hit.cx) || 1;
            // his front is the end he is facing; his back is the other one
            const front = (hit.cx - guard.x) * guardFace() > 0;
            if (front) {
                guard.blocks++;
                rings.push({ x: hit.cx, y: hit.cy, t: 1 });
                return;
            }
            guard.flash = 1;
            guard.hurt++;
            award(GUARD_PTS, hit.cx, hit.cy);
            if (--guard.hp > 0) return;
            guard.fall = shatter(guard.x, GUARD_Y, GUARD_W, 1.2);
            guard.fallMir = guardFace() < 0;
            maybeDropCapsule(guard.x, GUARD_Y);
            labClearIfDone();
        },
        draw: guardDraw,
        finish() { if (!guard || guard.hp <= 0) return false; guard.hp = 1; return true; },
        state() {
            return { name: 'THE GUARD', hp: Math.max(0, guard.hp), max: guard.maxHp,
                     line: guard.hp > 0 ? 'facing ' + (guardFace() > 0 ? 'right' : 'left') +
                           ' · blocked ' + guard.blocks + ' · through his back ' + guard.hurt : 'seen off' };
        }
    };

    // which way he is facing as far as a head is concerned: the old way until
    // his turn is halfway through
    function guardFace() {
        return guard.turn > 0 && guard.turn < 0.5 ? guard.from : guard.face;
    }

    function guardDraw() {
        if (!guard) return;
        const w = GUARD_W, h = w / SHAPE_ASPECT;
        if (guard.fall) {
            ctx.save();
            if (guard.fallMir) { ctx.translate(guard.fall.x, 0); ctx.scale(-1, 1); ctx.translate(-guard.fall.x, 0); }
            drawCrumble(guard.fall, 0, 0, true);
            ctx.restore();
        }
        if (guard.hp <= 0) return;
        const sp = shapeSprite('guard', null, w, h, false);
        if (!sp) return;
        const o = guard.jt > 0 ? wobble(guard.jt) * JIG_BRICK : 0;
        const sx = guard.turn > 0 ? guard.from * Math.cos(Math.PI * guard.turn) : guard.face;
        ctx.save();
        ctx.translate(guard.x + guard.jnx * o, GUARD_Y);
        ctx.scale(sx, 1);
        ctx.drawImage(sp, -w / 2, -h / 2, w, h);
        if (guard.flash > 0) {
            ctx.globalAlpha = Math.min(1, guard.flash) * 0.75;
            ctx.drawImage(shapeSprite('flash', '#f2efe9', w, h, true), -w / 2, -h / 2, w, h);
            ctx.globalAlpha = 1;
        }
        ctx.restore();
        labBar(guard.x - 40, GUARD_Y + h / 2 + 6, 80, guard.hp / guard.maxHp, 3);
        if (LAB.zone) {
            // lab only: the half of him that rings, in red
            const f = guardFace();
            ctx.fillStyle = 'rgba(207,107,78,0.3)';
            ctx.fillRect(f > 0 ? guard.x : guard.x - w / 2, GUARD_Y - h / 2, w / 2, h);
        }
    }