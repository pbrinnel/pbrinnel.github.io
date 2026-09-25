'use strict';

    // ---- GLEEOK (boss) -----------------------------------------------------------
    // Heads on necks, hanging off a body that cannot be hurt while it has one
    // on a neck. Each head
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
    // of the screen, so the body is stood on its end by GL_TILT, legs in the
    // air, with the collar at the bottom and most of him off the top of the
    // screen. Losing him off the edge is the price of the heads hanging where
    // they should.
    //
    // Every head still on its neck fires now and then: it swells green for
    // GL_CHARGE, then looses a few slow phantoms down the line of its neck, in
    // three columns GL_BURST_ARC apart and staggered like brickwork (GL_BURST)
    // -- few enough to see a way through, slow enough to take it. Each one
    // that lands is a helping of SLUGGISH, and SLUGGISH stacks.
    //
    // While he has a head on a neck the body is stone -- a coat of it swelling
    // in and out over him -- and it falls away when the body opens.
    //
    // A head torn loose is small, turning slowly, slow, harmless to shoot at
    // and one hit from finished: the payoff for the three it took to tear it.
    //
    // With no head left on a neck, the body is open: it has health of its own,
    // GL_BODY_HP, with its own bar, and it is the body that ends the fight.
    // From then on it grows heads back one at a time, each over GL_REGROW,
    // with nothing to hit until it is whole -- and a whole one shuts the body
    // again. Kill the body and whatever it was still growing dies with it.
    //
    // He arrives slowly: one head pokes down out of the top first, then the
    // three fan apart as the whole of him lowers in, all three shouting.
    let GL_LVL      = 5;
    let GL_HEADS    = 3;      // how many he has
    let GL_HEAD_HP  = 3;      // hits to tear one loose
    let GL_LOOSE_HP = 1;      // ...and to finish it once it is off
    let GL_LOOSE_SIZE = 0.67; // ...how big it is, loose, of one on a neck
    let GL_LOOSE_SPIN = 1.2;  // ...and rad/s it turns at
    let GL_W        = 560;    // how long his body is
    let GL_Y        = 140;    // where the collar hangs
    let GL_TILT     = 1.5708; // rad his body is turned by, about the collar: on end, legs up
    let GL_DRIFT    = 90;     // px either side the collar drifts
    let GL_HEAD_W   = 78;     // how wide a head is
    let GL_NECK     = 145;    // px from the collar out to a head
    let GL_FAN      = 0.72;   // rad between one neck and the next
    // under half GL_FAN, so two necks can never swing into the same place
    let GL_SWING    = 0.18;   // rad either side the necks sway through
    let GL_RATE     = 0.7;    // rad/s of that sway
    let GL_LOOSE    = 140;    // px/s a loose head flies at
    let GL_THICK    = 0.17;   // how thick his body is to a head, as a share of it
    // The hole his head left is where its middle was, not where his neck
    // meets his shoulders, and his spine runs to one side of it. So he is slid
    // along his length onto the necks by GL_SEAT_U, and across by GL_SEAT_V
    // until his spine is over the collar.
    let GL_SEAT_U   = 12;     // px toward the necks
    let GL_SEAT_V   = -55;    // px across him
    let GL_CLIMB    = 0.15;   // how much of the original's climb this fight has
    let GL_BODY_HP  = 8;      // hits on his body, once it has no head on a neck
    let GL_REGROW   = 10;     // seconds to grow one head back
    let GL_ENTER    = 6;      // seconds he takes to arrive
    let GL_FIRE_MIN = 6;      // seconds between one head's bursts, at least...
    let GL_FIRE_MAX = 11;     // ...and at most
    let GL_CHARGE   = 0.7;    // the green swell before it fires, which is the tell
    let GL_BURST_GAP  = 1.0;  // seconds from one row of a burst to the next
    let GL_BURST_ARC  = 0.26; // rad between one column and the next
    let GL_BURST_SPEED = 100; // px/s the phantoms of a burst travel at
    let GL_BURST_SIZE = 0.25; // ...and how big they are, of a real head
    let GL_BURST_MAX  = 30;   // phantoms in the air at most, all heads together
    let GL_STONE_A0   = 0.35; // the stone over a shut body: at its thinnest...
    let GL_STONE_A1   = 0.7;  // ...at its thickest...
    let GL_STONE_HZ   = 0.5;  // ...and swells a second, slow enough never to read as a flash
    let GL_REGROW_WAIT2 = 6;  // seconds after the first head is back before the second starts
    let GL_REGROW_WAIT3 = 10; // ...and after the second before the third
    LAB_KNOBS.push('GL_LVL', 'GL_HEADS', 'GL_HEAD_HP', 'GL_LOOSE_HP', 'GL_W', 'GL_Y', 'GL_TILT',
                   'GL_DRIFT', 'GL_HEAD_W', 'GL_NECK', 'GL_FAN', 'GL_SWING', 'GL_RATE',
                   'GL_LOOSE', 'GL_THICK', 'GL_SEAT_U', 'GL_SEAT_V', 'GL_CLIMB', 'GL_FIRE_MIN', 'GL_FIRE_MAX', 'GL_CHARGE',
                   'GL_BURST_GAP', 'GL_BURST_ARC', 'GL_BURST_SPEED', 'GL_BURST_SIZE', 'GL_BURST_MAX', 'GL_LOOSE_SIZE',
                   'GL_LOOSE_SPIN', 'GL_STONE_A0', 'GL_STONE_A1', 'GL_STONE_HZ', 'GL_REGROW_WAIT2',
                   'GL_REGROW_WAIT3',
                   'GL_BODY_HP', 'GL_REGROW', 'GL_ENTER');

    const GL_BEADS = 9;       // the neck, in heads shrinking into his body, from the collar out
    // a burst: [column, row] for each phantom, the column -1 left to 1 right
    // and the row in GL_BURST_GAPs -- the middle column half a row behind the
    // outer two, so the three are staggered and there is always a lane
    const GL_BURST = [[-1, 0], [1, 0], [0, 0.5], [0, 1.5]];

    let gl = null;

    LAB_BOSS.gleeok = {
        start(b) {
            const n = Math.max(1, Math.round(GL_HEADS));
            gl = { t: 0, cx: LW / 2, cy: -GL_W, pend: null, torn: 0, done: 0, spread: 0, yelled: false, wait: 0, stone: 1,
                   body: GL_BODY_HP, bodyFlash: 0, bodyIF: 0, bared: false, regrown: 0,
                   heads: Array.from({ length: n }, (_, i) => ({
                       hp: GL_HEAD_HP, alive: true, loose: false, flash: 0, spent: 0,
                       // where in the fan this neck sits, middle one at 0
                       fan: i - (n - 1) / 2, ph: i * 2.1, x: LW / 2, y: 0, vx: 0, vy: 0,
                       // staggered, so the first bursts come one head at a time
                       fire: GL_FIRE_MIN * (0.6 + i * 0.55) + Math.random() * 2, charge: 0, shots: 0, shotT: 0,
                       grow: -1,              // seconds into growing back, or -1 when whole
                       rot: 0                 // turned by, once it is loose
                   })) };
            b.maxHp = n * (GL_HEAD_HP + GL_LOOSE_HP) + GL_BODY_HP;
            b.hp = b.maxHp;
            glBox(b);
        },
        reset() { gl = null; },
        update(b, dt) {
            if (phase === 'entrance') glEnter();
            else {
                if (phase === 'play') gl.t += dt;
                gl.cx = LW / 2 + Math.sin(gl.t * 0.25) * GL_DRIFT;
                gl.cy = GL_Y;
                gl.spread = 1;
            }
            if (gl.bodyFlash > 0) gl.bodyFlash = Math.max(0, gl.bodyFlash - dt * 6);
            if (gl.bodyIF > 0) gl.bodyIF = Math.max(0, gl.bodyIF - dt);
            if (phase === 'play') glRegrow(dt);
            // the stone coat: on while he is shut, off while he is open
            gl.stone += Math.max(-dt * 2, Math.min(dt * 2, (glOpen() ? 0 : 1) - gl.stone));
            for (const k of gl.heads) {
                if (!k.alive) continue;
                if (k.flash > 0) k.flash = Math.max(0, k.flash - dt * 6);
                if (k.spent > 0) k.spent = Math.max(0, k.spent - dt);
                if (!k.loose) {
                    // every neck out of the one collar, fanned and swaying
                    const a = Math.PI / 2 + (k.fan * GL_FAN + Math.sin(gl.t * GL_RATE + k.ph) * GL_SWING) * gl.spread;
                    const reach = GL_NECK * glGrown(k);
                    k.ax = gl.cx; k.ay = gl.cy;
                    k.x = gl.cx + Math.cos(a) * reach;
                    k.y = gl.cy + Math.sin(a) * reach;
                    if (phase === 'play' && k.grow < 0) glFire(k, a, dt);
                    else { k.charge = 0; k.shots = 0; }
                    continue;
                }
                if (phase !== 'play') continue;
                // loose: it flies on, turning, off the walls and the ceiling, and off you
                k.rot += GL_LOOSE_SPIN * dt;
                const r = GL_HEAD_W * GL_LOOSE_SIZE / 2, ry = r * (BALL_RY / BALL_RX);
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
            for (const k of gl.heads) {
                if (!k.alive || k.grow >= 0) continue;     // nothing to hit until it is whole
                const hit = glHeadContact(ball, k);
                if (hit) { gl.pend = k; return hit; }
            }
            // his body as one turned capsule: a mask is a grid of upright cells
            // and his body is not upright any more
            const a = glSpine(0), z = glSpine(1);
            const hit = capsuleContact(ball, a.x, a.y, z.x, z.y, GL_W / SHAPE_ASPECT * GL_THICK);
            gl.pend = hit ? 'body' : null;
            return hit;
        },
        // his body cannot be hurt while a head is on it, and it says so
        glances() { return !gl.pend || (gl.pend === 'body' && (!glOpen() || gl.bodyIF > 0)); },
        hit(b, cx, cy) {
            const k = gl.pend;
            gl.pend = null;
            if (!k) return;
            if (k === 'body') {
                if (!glOpen() || gl.bodyIF > 0) return;
                gl.body = Math.max(0, gl.body - 1);
                gl.bodyFlash = 1;
                gl.bodyIF = BOSS_IF;
                award(BOSS_PTS * (gl.body <= 0 ? 5 : 1), cx, cy);
                if (gl.body <= 0) glDie(b);
                return;
            }
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
        },
        enterSecs() { return GL_ENTER; },
        draw: glDraw,
        drawFall() {
            const c = bossFall;
            if (!c) return;
            const wilt = Math.max(0, Math.min(1, ascendT / A_DIE));
            const e = wilt * wilt * (3 - 2 * wilt);
            if (ascendT < A_DIE) drawFigure(c.x, c.y, c.w, 1, e, GL_TILT);
            else drawCrumble(c, 0, GL_TILT, true);
        },
        climb() { return GL_CLIMB; },
        finish(b) {
            // every head off him, and one hit left in the body
            for (const k of gl.heads) { k.alive = false; k.grow = -1; }
            gl.bared = true;
            gl.body = 1;
            return true;
        },
        state(b) {
            const on = gl.heads.filter(k => k.alive && !k.loose && k.grow < 0).length;
            const loose = gl.heads.filter(k => k.alive && k.loose).length;
            const growing = gl.heads.filter(k => k.alive && k.grow >= 0).length;
            return { name: 'GLEEOK', hp: b.hp, max: b.maxHp, w: GL_W,
                     line: on + ' on him · ' + loose + ' loose · ' + growing + ' growing · ' +
                           (glOpen() ? 'body open ' + gl.body + '/' + GL_BODY_HP : 'body shut') };
        }
    };

    // a point in his own frame -- x along him toward his head, y across,
    // both from the collar -- out in the field, where he is turned
    function glLocal(lx, ly) {
        const c = Math.cos(GL_TILT), s = Math.sin(GL_TILT);
        return { x: gl.cx + lx * c - ly * s, y: gl.cy + lx * s + ly * c };
    }

    // the top left of the box his body is drawn in, in his own frame
    function glOrigin() {
        const h = GL_W / SHAPE_ASPECT;
        return { x: GL_SEAT_U - GL_W * HL_HEAD_U, y: GL_SEAT_V - h * HL_HEAD_V };
    }

    // along the middle of his box, 0 at his shoulders to 1 at his boot
    function glSpine(t) {
        const o = glOrigin(), h = GL_W / SHAPE_ASPECT;
        const x0 = o.x + GL_W * (HL_HEAD_U - 0.1), x1 = o.x;
        return glLocal(x0 + (x1 - x0) * t, o.y + h / 2);
    }

    // the middle of the box his body is drawn in, which is where drawFigure
    // and the crumble turn him about
    function glMiddle() {
        const o = glOrigin(), h = GL_W / SHAPE_ASPECT;
        return glLocal(o.x + GL_W / 2, o.y + h / 2);
    }

    // Nothing on a neck that can be hit: the body is open.
    function glOpen() { return !gl.heads.some(k => k.alive && !k.loose && k.grow < 0); }

    // A head: the ellipse inscribed in it, turned by however far it has spun
    // loose. Met in its own frame and handed back in the field's.
    function glHeadContact(ball, k) {
        const rx = GL_HEAD_W * (k.loose ? GL_LOOSE_SIZE : 1) / 2, ry = rx * (BALL_RY / BALL_RX);
        if (!k.loose) return ellipseContact(ball, k.x, k.y, rx, ry);
        const c = Math.cos(-k.rot), s = Math.sin(-k.rot);
        const dx = ball.x - k.x, dy = ball.y - k.y;
        const local = { x: k.x + dx * c - dy * s, y: k.y + dx * s + dy * c, angle: ball.angle - k.rot };
        const hit = ellipseContact(local, k.x, k.y, rx, ry);
        if (!hit) return null;
        const hx = hit.cx - k.x, hy = hit.cy - k.y;
        return { cx: k.x + hx * c + hy * s, cy: k.y - hx * s + hy * c };
    }

    // how far a head has grown back, 1 when it is whole
    function glGrown(k) {
        if (k.grow < 0) return 1;
        const t = Math.min(1, k.grow / GL_REGROW);
        return t * t * (3 - 2 * t);
    }

    // Once he has been left with nothing on a neck he starts growing heads
    // back, one at a time, into whichever places are empty.
    function glRegrow(dt) {
        if (glOpen()) gl.bared = true;
        if (!gl.bared) return;
        const growing = gl.heads.find(k => k.alive && k.grow >= 0);
        if (growing) {
            if ((growing.grow += dt) >= GL_REGROW) {
                growing.grow = -1;
                growing.fire = GL_FIRE_MIN;
                // a breather before the next: longer the more of him is back
                const whole = gl.heads.filter(k => k.alive && !k.loose && k.grow < 0).length;
                gl.wait = whole >= 2 ? GL_REGROW_WAIT3 : GL_REGROW_WAIT2;
            }
            return;
        }
        if (glOpen()) gl.wait = 0;                 // stripped bare again: straight back to it
        if ((gl.wait -= dt) > 0) return;
        const empty = gl.heads.find(k => !k.alive);
        if (!empty) return;
        Object.assign(empty, { alive: true, loose: false, hp: GL_HEAD_HP, flash: 0, spent: 0,
                               charge: 0, shots: 0, grow: 0 });
        gl.regrown++;
    }

    // The body is dead: what it was still growing goes with it, and so do
    // any heads still loose on the field.
    function glDie(b) {
        for (const k of gl.heads) { k.alive = false; k.grow = -1; }
        b.alive = false;
        clearStage();
        // he comes apart about the middle of his box, turned as he stood
        const m = glMiddle();
        bossFall = shatter(m.x, m.y, GL_W, A_DIE_T);
        // the white cut-out levels itself as it burns off, and he is on
        // end, so it would swing through the air; his colour going says it
        if (impact) impact.w = 0;
    }

    // His arrival, off enterK: one head pokes down out of the top and holds
    // there, the three of them one on top of another; then they fan apart,
    // shouting, as the whole of him lowers in to where he fights.
    const GL_POKE = 0.15, GL_HOLD = 0.4;      // shares of the entrance
    function glEnter() {
        const k = enterK(), ease = t => t * t * (3 - 2 * t);
        const peek = 36 - GL_NECK, hidden = -GL_NECK - GL_HEAD_W;
        gl.cx = LW / 2;
        if (k < GL_POKE) {
            gl.cy = hidden + (peek - hidden) * ease(k / GL_POKE);
            gl.spread = 0;
        } else if (k < GL_HOLD) {
            gl.cy = peek + Math.sin((k - GL_POKE) * 40) * 3;     // looking about
            gl.spread = 0;
        } else {
            const t = (k - GL_HOLD) / (1 - GL_HOLD);
            gl.cy = peek + (GL_Y - peek) * ease(t);
            gl.spread = ease(Math.min(1, t * 3));
            // once they are far enough apart to be three, each shouts, its
            // bubble riding under it on the way down -- the middle one's a
            // little lower, so the three do not run into one another
            if (!gl.yelled && t > 0.25) {
                gl.yelled = true;
                const hh = GL_HEAD_W * (BALL_RY / BALL_RX);
                for (const h of gl.heads) {
                    const drop = h.fan === 0 ? hh * 0.7 : 0;
                    labShout(h.x, h.y, 'BRANDON!', 2.4, () => ({ x: h.x, y: h.y + hh / 2 + 10 + drop }));
                }
            }
        }
    }

    // One head on its neck: counting down to a burst, swelling green, then
    // firing it a volley at a time down the line its neck points along.
    function glFire(k, a, dt) {
        if (k.shots > 0) {
            // what is due by now leaves, each down its own column
            k.shotT += dt;
            while (k.shots > 0) {
                const [col, row] = GL_BURST[GL_BURST.length - k.shots];
                if (k.shotT < row * GL_BURST_GAP) break;
                k.shots--;
                if (phantoms.length >= GL_BURST_MAX) continue;
                const d = a + col * GL_BURST_ARC;
                // the slowness is the whole of their life: they live long
                // enough to cross the field at it
                phantoms.push({ x: k.x, y: k.y, vx: Math.cos(d) * GL_BURST_SPEED, vy: Math.sin(d) * GL_BURST_SPEED,
                                angle: Math.random() * 6.28, spin: (Math.random() - 0.5) * 6, scale: GL_BURST_SIZE,
                                life: PH_LIFE * PH_SPEED / GL_BURST_SPEED });
            }
            if (!k.shots) k.fire = GL_FIRE_MIN + Math.random() * (GL_FIRE_MAX - GL_FIRE_MIN);
            return;
        }
        if (k.charge > 0) {
            if ((k.charge += dt) < GL_CHARGE) return;
            k.charge = 0;
            k.shots = GL_BURST.length;
            k.shotT = 0;
            return;
        }
        if ((k.fire -= dt) <= 0) k.charge = 1e-6;
    }

    // his body cut, in stone: the shape filled flat, with a faint pass of his
    // own shading kept so it is still him under it
    let glStoneBake = null;
    function glStoneBody(body) {
        if (glStoneBake) return glStoneBake;
        const c = document.createElement('canvas');
        c.width = body.width; c.height = body.height;
        const g = c.getContext('2d');
        g.drawImage(body, 0, 0);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = STONE;
        g.fillRect(0, 0, c.width, c.height);
        g.globalCompositeOperation = 'source-atop';
        g.globalAlpha = 0.25;
        g.filter = 'grayscale(1) contrast(1.1) brightness(1.7)';
        g.drawImage(body, 0, 0);
        return (glStoneBake = c);
    }

    // the box the physics looks for him in: his body and wherever his heads are
    function glBox(b) {
        const h = GL_W / SHAPE_ASPECT, r = GL_HEAD_W;
        const a = glSpine(0), boot = glSpine(1);
        let x0 = Math.min(gl.cx, a.x, boot.x) - h / 2, x1 = Math.max(gl.cx, a.x, boot.x) + h / 2;
        let y0 = Math.min(gl.cy, a.y, boot.y) - h / 2, y1 = Math.max(gl.cy, a.y, boot.y) + h / 2;
        for (const k of gl.heads) {
            if (!k.alive) continue;
            x0 = Math.min(x0, k.x - r); x1 = Math.max(x1, k.x + r);
            y0 = Math.min(y0, k.y - r); y1 = Math.max(y1, k.y + r);
        }
        b.x = x0; b.y = y0; bw = x1 - x0; bh = y1 - y0;
        b.hp = gl.heads.reduce((s, k) => s + (k.alive && k.grow < 0 ? k.hp : 0), 0) + gl.body;
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
            const gs = 0.25 + 0.75 * glGrown(k);
            for (let i = 0; i < GL_BEADS; i++) {
                const t = i / GL_BEADS;
                const w = hw * (0.45 + 0.35 * t) * gs, hgt = w * (BALL_RY / BALL_RX);
                ctx.drawImage(ballImg, k.ax + (k.x - k.ax) * t - w / 2,
                              k.ay + (k.y - k.ay) * t - hgt / 2, w, hgt);
            }
        }
        // turned about the collar and seated on it, so his shoulders are
        // where his necks come out whatever GL_TILT is
        const o = glOrigin();
        ctx.save();
        ctx.translate(gl.cx, gl.cy);
        ctx.rotate(GL_TILT);
        ctx.drawImage(body, o.x, o.y, GL_W, h);
        // shut, he is stone: a coat of it swelling slowly in and out over him
        const stone = gl.stone > 0.002 ? glStoneBody(body) : null;
        if (stone) {
            const breath = GL_STONE_A0 + (GL_STONE_A1 - GL_STONE_A0) * (0.5 + 0.5 * Math.sin(clock * GL_STONE_HZ * Math.PI * 2));
            ctx.globalAlpha = gl.stone * breath;
            ctx.drawImage(stone, o.x, o.y, GL_W, h);
            ctx.globalAlpha = 1;
        }
        // struck while open: the same body again, added over itself
        if (gl.bodyFlash > 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = Math.min(1, gl.bodyFlash) * 0.6;
            ctx.drawImage(body, o.x, o.y, GL_W, h);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
        }
        ctx.restore();
        for (const k of gl.heads) {
            if (!k.alive) continue;
            // still growing: small, and see-through, since there is nothing to hit yet
            if (k.grow >= 0) {
                const gw = hw * (0.25 + 0.75 * glGrown(k)), gh = gw * (BALL_RY / BALL_RX);
                ctx.globalAlpha = 0.6;
                ctx.drawImage(ballImg, k.x - gw / 2, k.y - gh / 2, gw, gh);
                ctx.globalAlpha = 1;
                continue;
            }
            // the swell before a burst: green washing up over him and a glow
            // round him, rising once -- a tell, not a flash
            const sw = k.charge > 0 ? Math.min(1, k.charge / GL_CHARGE) : k.shots > 0 ? 1 : 0;
            if (sw > 0) {
                const r = hw * 0.95;
                const g = ctx.createRadialGradient(k.x, k.y, hw * 0.2, k.x, k.y, r);
                g.addColorStop(0, PH_LOOK.color);
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.globalAlpha = PH_LOOK.glow * 1.6 * sw;
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(k.x, k.y, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
            if (k.loose) {
                // small, and slowly turning
                const lw = hw * GL_LOOSE_SIZE, lh = lw * (BALL_RY / BALL_RX);
                ctx.save();
                ctx.translate(k.x, k.y);
                ctx.rotate(k.rot);
                ctx.drawImage(ballImg, -lw / 2, -lh / 2, lw, lh);
                if (k.flash > 0) {
                    ctx.globalAlpha = Math.min(1, k.flash) * 0.7;
                    ctx.drawImage(headSprite2('flat', '#f2efe9'), -lw / 2, -lh / 2, lw, lh);
                }
                ctx.restore();
                continue;
            }
            ctx.drawImage(ballImg, k.x - hw / 2, k.y - hh / 2, hw, hh);
            const green = sw > 0 ? phantomSprite(PH_LOOK) : null;
            if (green) {
                ctx.globalAlpha = 0.55 * sw;
                ctx.drawImage(green, k.x - hw / 2, k.y - hh / 2, hw, hh);
                ctx.globalAlpha = 1;
            }
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
        // the body's own bar, just above the collar, from the first time it is open
        if (gl.bared) labBar(gl.cx - 80, gl.cy - 24, 160, gl.body / GL_BODY_HP, 5);
        const grow = phase === 'entrance' ? enterK() : 1;
        if (grow > 0.001) labBar(LW / 2 - 150 * grow, 10, 300 * grow, b.hp / b.maxHp);
    }