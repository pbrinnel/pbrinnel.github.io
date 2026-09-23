'use strict';

    // ---- GLEEOK (boss) -----------------------------------------------------------
    // Heads on necks, hanging off a body that cannot be hurt at all. Each head
    // takes a few hits, and the last of them does not kill it: it tears the
    // head loose, and a loose head flies free about the field, still alive and
    // still to be finished. One that reaches your line leaves a helping of
    // SLUGGISH on you. So every head you tear off is progress that costs you
    // room: strip all of them and fight the loose ones at once, or finish each
    // one before you tear off the next.
    //
    // He is HEADLESS's body, cut at the same collar, and all three necks come
    // out of the one hole where his head was -- three heads on one neck, not
    // three heads bolted along a torso. That puts the fight in the top middle
    // of the screen, so the body is turned by GL_TILT to bring the collar there
    // and the rest of him runs off the top-left corner. Losing some of him off
    // the edge is the price of the heads hanging where they should.
    let GL_LVL      = 5;
    let GL_HEADS    = 3;      // how many he has
    let GL_HEAD_HP  = 3;      // hits to tear one loose
    let GL_LOOSE_HP = 2;      // ...and to finish it once it is off
    let GL_W        = 560;    // how long his body is
    let GL_Y        = 140;    // where the collar hangs
    let GL_TILT     = 0.32;   // rad his body is turned by, about the collar
    let GL_DRIFT    = 90;     // px either side the collar drifts
    let GL_HEAD_W   = 78;     // how wide a head is
    let GL_NECK     = 145;    // px from the collar out to a head
    let GL_FAN      = 0.72;   // rad between one neck and the next
    // under half GL_FAN, so two necks can never swing into the same place
    let GL_SWING    = 0.18;   // rad either side the necks sway through
    let GL_RATE     = 0.7;    // rad/s of that sway
    let GL_LOOSE    = 210;    // px/s a loose head flies at
    let GL_THICK    = 0.17;   // how thick his body is to a head, as a share of it
    let GL_CLIMB    = 0.5;    // how much of the original's climb this fight has
    LAB_KNOBS.push('GL_LVL', 'GL_HEADS', 'GL_HEAD_HP', 'GL_LOOSE_HP', 'GL_W', 'GL_Y', 'GL_TILT',
                   'GL_DRIFT', 'GL_HEAD_W', 'GL_NECK', 'GL_FAN', 'GL_SWING', 'GL_RATE',
                   'GL_LOOSE', 'GL_THICK', 'GL_CLIMB');

    const GL_BEADS = 5;       // the neck, in heads shrinking into his body

    let gl = null;

    LAB_BOSS.gleeok = {
        start(b) {
            const n = Math.max(1, Math.round(GL_HEADS));
            gl = { t: 0, cx: LW / 2, cy: -GL_W, pend: null, torn: 0, done: 0,
                   heads: Array.from({ length: n }, (_, i) => ({
                       hp: GL_HEAD_HP, alive: true, loose: false, flash: 0, spent: 0,
                       // where in the fan this neck sits, middle one at 0
                       fan: i - (n - 1) / 2, ph: i * 2.1, x: LW / 2, y: 0, vx: 0, vy: 0
                   })) };
            b.maxHp = n * (GL_HEAD_HP + GL_LOOSE_HP);
            b.hp = b.maxHp;
            glBox(b);
        },
        reset() { gl = null; },
        update(b, dt) {
            if (phase === 'entrance') {
                const raw = enterK(), e = raw * raw * (3 - 2 * raw);
                gl.cx = LW / 2;
                gl.cy = -GL_W + (GL_Y + GL_W) * e;
            } else {
                if (phase === 'play') gl.t += dt;
                gl.cx = LW / 2 + Math.sin(gl.t * 0.25) * GL_DRIFT;
                gl.cy = GL_Y;
            }
            for (const k of gl.heads) {
                if (!k.alive) continue;
                if (k.flash > 0) k.flash = Math.max(0, k.flash - dt * 6);
                if (k.spent > 0) k.spent = Math.max(0, k.spent - dt);
                if (!k.loose) {
                    // every neck out of the one collar, fanned and swaying
                    const a = Math.PI / 2 + k.fan * GL_FAN + Math.sin(gl.t * GL_RATE + k.ph) * GL_SWING;
                    k.ax = gl.cx; k.ay = gl.cy;
                    k.x = gl.cx + Math.cos(a) * GL_NECK;
                    k.y = gl.cy + Math.sin(a) * GL_NECK;
                    continue;
                }
                if (phase !== 'play') continue;
                // loose: it flies on, off the walls and the ceiling, and off you
                const r = GL_HEAD_W / 2, ry = r * (BALL_RY / BALL_RX);
                k.x += k.vx * dt;
                k.y += k.vy * dt;
                if (k.x < r && k.vx < 0) k.vx = -k.vx;
                if (k.x > LW - r && k.vx > 0) k.vx = -k.vx;
                if (k.y < ry && k.vy < 0) k.vy = -k.vy;
                if (k.y > padY() - padH() / 2 - ry && k.vy > 0) {
                    k.vy = -Math.abs(k.vy);
                    if (!k.spent) {
                        const sg = segs().find(s => Math.abs(k.x - s.cx) < s.w / 2 + r);
                        if (sg) { addDrag(sg, k.x); k.spent = 1.2; }
                    }
                }
            }
            glBox(b);
        },
        contact(br, ball) {
            const rx = GL_HEAD_W / 2, ry = rx * (BALL_RY / BALL_RX);
            for (const k of gl.heads) {
                if (!k.alive) continue;
                const hit = ellipseContact(ball, k.x, k.y, rx, ry);
                if (hit) { gl.pend = k; return hit; }
            }
            gl.pend = null;
            // his body as one turned capsule: a mask is a grid of upright cells
            // and his body is not upright any more
            const b0 = glBoot();
            return capsuleContact(ball, gl.cx, gl.cy, b0.x, b0.y, GL_W / SHAPE_ASPECT * GL_THICK);
        },
        // his body is not a thing you can hurt, and it says so
        glances() { return !gl.pend; },
        hit(b, cx, cy) {
            const k = gl.pend;
            gl.pend = null;
            if (!k) return;
            k.flash = 1;
            if (--k.hp > 0) { award(BOSS_PTS, cx, cy); return; }
            if (!k.loose) {
                // torn loose: still alive, and now it has the run of the field
                k.loose = true;
                k.hp = GL_LOOSE_HP;
                gl.torn++;
                const a = Math.PI * (0.15 + Math.random() * 0.7);
                k.vx = Math.cos(a) * GL_LOOSE * (Math.random() < 0.5 ? -1 : 1);
                k.vy = Math.sin(a) * GL_LOOSE;
                award(BOSS_PTS * 2, cx, cy);
                maybeDropCapsule(cx, cy);
                return;
            }
            k.alive = false;
            gl.done++;
            award(BOSS_PTS * 3, cx, cy);
            if (gl.heads.some(o => o.alive)) return;
            // the last head: the body has nothing left to hold up
            b.alive = false;
            clearStage();
            // he comes apart from his middle, which is halfway back along him
            const boot = glBoot();
            const mx = (gl.cx + boot.x) / 2, my = (gl.cy + boot.y) / 2;
            bossFall = shatter(mx, my, GL_W, A_DIE_T);
            if (impact) { impact.x = mx; impact.y = my; impact.w = GL_W; }
        },
        draw: glDraw,
        drawFall() {
            const c = bossFall;
            if (!c) return;
            const wilt = Math.max(0, Math.min(1, ascendT / A_DIE));
            const e = wilt * wilt * (3 - 2 * wilt);
            if (ascendT < A_DIE) drawFigure(c.x, c.y + e * F_SAG, c.w, 1, e, e * F_LEAN);
            else drawCrumble(c, e * F_SAG, e * F_LEAN, true);
        },
        climb() { return GL_CLIMB; },
        finish(b) {
            for (const k of gl.heads) if (k.alive) { k.loose = true; k.hp = 1; }
            return true;
        },
        state(b) {
            const on = gl.heads.filter(k => k.alive && !k.loose).length;
            const loose = gl.heads.filter(k => k.alive && k.loose).length;
            return { name: 'GLEEOK', hp: b.hp, max: b.maxHp, w: GL_W,
                     line: on + ' still on him · ' + loose + ' loose · ' + gl.done + ' finished' };
        }
    };

    // his boot end, which is where the turned body reaches to from the collar
    function glBoot() {
        const back = GL_W * HL_HEAD_U;
        return { x: gl.cx - Math.cos(GL_TILT) * back, y: gl.cy - Math.sin(GL_TILT) * back };
    }

    // the box the physics looks for him in: his body and wherever his heads are
    function glBox(b) {
        const h = GL_W / SHAPE_ASPECT, r = GL_HEAD_W;
        const boot = glBoot();
        let x0 = Math.min(gl.cx, boot.x) - h / 2, x1 = Math.max(gl.cx, boot.x) + h / 2;
        let y0 = Math.min(gl.cy, boot.y) - h / 2, y1 = Math.max(gl.cy, boot.y) + h / 2;
        for (const k of gl.heads) {
            if (!k.alive) continue;
            x0 = Math.min(x0, k.x - r); x1 = Math.max(x1, k.x + r);
            y0 = Math.min(y0, k.y - r); y1 = Math.max(y1, k.y + r);
        }
        b.x = x0; b.y = y0; bw = x1 - x0; bh = y1 - y0;
        b.hp = gl.heads.reduce((s, k) => s + (k.alive ? k.hp : 0), 0);
    }

    function glDraw(b) {
        const h = GL_W / SHAPE_ASPECT;
        // HEADLESS's own cut: the same body with the same hole where the head
        // was, which is where all three of these come out of
        const body = hlSprite('raw');
        if (!body || !ready(ballImg)) return;
        const hw = GL_HEAD_W, hh = hw * (BALL_RY / BALL_RX);
        // the necks first: heads shrinking into him, so they read as one animal
        for (const k of gl.heads) {
            if (!k.alive || k.loose) continue;
            for (let i = 1; i <= GL_BEADS; i++) {
                const t = i / (GL_BEADS + 1);
                const w = hw * (0.3 + 0.5 * t), hgt = w * (BALL_RY / BALL_RX);
                ctx.drawImage(ballImg, k.ax + (k.x - k.ax) * t - w / 2,
                              k.ay + (k.y - k.ay) * t - hgt / 2, w, hgt);
            }
        }
        // turned about the collar, so the hole his necks leave by lands on
        // (gl.cx, gl.cy) whatever GL_TILT is
        ctx.save();
        ctx.translate(gl.cx, gl.cy);
        ctx.rotate(GL_TILT);
        ctx.drawImage(body, -GL_W * HL_HEAD_U, -h * HL_HEAD_V, GL_W, h);
        ctx.restore();
        for (const k of gl.heads) {
            if (!k.alive) continue;
            ctx.drawImage(ballImg, k.x - hw / 2, k.y - hh / 2, hw, hh);
            if (k.flash > 0) {
                ctx.globalAlpha = Math.min(1, k.flash) * 0.7;
                ctx.drawImage(headSprite2('flat', '#f2efe9'), k.x - hw / 2, k.y - hh / 2, hw, hh);
                ctx.globalAlpha = 1;
            }
            // what it has left, over it, the way the wall's bricks wear theirs
            if (k.hp < (k.loose ? GL_LOOSE_HP : GL_HEAD_HP)) {
                labBar(k.x - hw * 0.35, k.y - hh / 2 - 7, hw * 0.7,
                       k.hp / (k.loose ? GL_LOOSE_HP : GL_HEAD_HP), 3);
            }
        }
        const grow = phase === 'entrance' ? enterK() : 1;
        if (grow > 0.001) labBar(LW / 2 - 150 * grow, 10, 300 * grow, b.hp / b.maxHp);
    }