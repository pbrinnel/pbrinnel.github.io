'use strict';

    // ==== FOUR KEYS: the runtime ============================================
    // The seam between the engine and everything built on top of it. Each boss
    // is a module in LAB_BOSS, each mini-boss one in LAB_MINI and each paddle
    // one in LAB_PAD; the engine only ever talks to whichever is up, through
    // the lab* functions below -- one for each place it had to be taught
    // something.
    //
    // This file and the modules beside it are loaded BEFORE the engine, both
    // here and in the boss lab, which injects the same files at the top of
    // brandon.html's closure. So nothing in any of them may READ one of the
    // engine's consts at load time: inside a function is fine, since by then
    // the engine is up. The functions are hoisted; the numbers are literals.
    //
    // Their numbers are lets so the lab's panel can reach them and Paul can
    // tune them live.

    const LAB_KNOBS = [];         // every tunable name, each file adding its own
    const LAB_BOSS = {};          // who can take the boss stage
    const LAB_MINI = {};          // ...and who can ride an ordinary one
    let labB = null;              // the boss module on now, or null for the original
    let labM = null;              // the mini-boss riding this stage, or null

    // The original boss has no file of his own, but he is in the roster with
    // the rest: which of the five levels draws on him, or 0 for none. No level
    // has asked for him since the five got their own bosses.
    let ORIG_LVL = 0;
    LAB_KNOBS.push('ORIG_LVL');

    const LAB = window.LAB = {
        endless: true,            // lives never run out
        freeze: false,            // the world held, for scripted checks
        slow: false,              // the world at a third of its speed, to watch them think
        boss: 'headless',         // who the boss stage gets: a LAB_BOSS key, or null for the original
        mini: 'mole',             // who rides the ordinary stages: a LAB_MINI key, or null
        open: false,              // the stage stood up with no bricks in it at all
        zone: false,              // shade HEADLESS's collar
        moves: false,             // outline where the MOLE can go
        pad: 'standard',          // which paddle is in hand: a LAB_PAD key
        knobs: LAB_KNOBS,
        get() {
            const o = {};
            for (const k of LAB_KNOBS) o[k] = eval(k);
            return o;
        },
        set(k, v) {
            if (!LAB_KNOBS.includes(k)) return;
            LAB.v_ = v;
            eval(k + ' = LAB.v_');
        },
        get stageNames() { return LEVELS.map(l => l.dbg); },
        fight(who) { LAB.boss = who; LAB.open = false; startAt(LEVELS.length - 1); },
        usePad(key) { LAB.pad = key; labPadUse(key); },
        stageAt(n, open) { LAB.open = !!open; startAt(n); },
        give(kind) {
            if (phase !== 'play' && phase !== 'ready') return false;
            applyCapsule(kind);
            return true;
        },
        // the next hit is the last, whoever is up
        finish() {
            if (labM && labM.finish && labM.finish()) return true;
            const b = bricks && bricks[0];
            if (!b || b.kind !== 'Z' || !b.alive) return false;
            if (labB) return labB.finish(b);
            b.hp = Math.min(b.hp, BOSS_D_LAST);
            return true;
        },
        // a mini-boss's own test buttons, by name
        act(name) { return !!(labM && labM.acts && labM.acts[name] && labM.acts[name]()); },
        // the hub, and its saved progress -- reachable from anywhere, since the
        // point of the buttons is to get you back to it
        hub() { menuOpen(); },
        prog(name) { return !!LAB_MINI.menu.acts[name](); },
        state() {
            const o = { phase, stage: LAB.open ? 'OPEN FIELD' : LEVELS[stage].dbg };
            const b = bricks && bricks[0];
            if (labB && b) o.boss = labB.state(b);
            if (labM) o.mini = labM.state();
            o.pad = labPadState();
            return o;
        },
        // the console bridge: reads and writes anything in the game's closure
        ev: src => eval(src)
    };

    // ---- the game's questions, and who answers them -----------------------------
    // A stage is being stood up, and nobody from the last one survives it.
    function labStageReset() {
        if (labB && labB.reset) labB.reset();
        if (labM && labM.reset) labM.reset();
        labB = null;
        labM = null;
    }

    // the boss stage has just been built as the original: make it whoever the
    // lab picked
    function labBossStart() {
        labB = (LAB.boss && LAB_BOSS[LAB.boss]) || null;
        if (labB) labB.start(bricks[0]);
    }

    // An ordinary stage has its bricks in. An open field has them taken away
    // again, and then the mini-boss comes on -- or does not, if it cannot ride
    // what is left (a mole needs a wall to hide in).
    function labMiniStart() {
        if (LAB.open) bricks = [];
        labM = (LAB.mini && LAB_MINI[LAB.mini]) || null;
        if (labM && !labM.start()) labM = null;
    }

    function labHolds(ball) { return !!(labB && labB.holds && labB.holds(ball)); }

    // hitBrick's first question: is this one somebody's to take? Asked before
    // the original's half second between wounds, which the new ones keep for
    // themselves.
    function labHit(b, cx, cy) {
        if (b.kind === 'Z' && labB) { labB.hit(b, cx, cy); return true; }
        if (b.lab && labM && labM.hit) { labM.hit(b, cx, cy); return true; }
        return false;
    }

    // whether a mini-boss still has to be beaten before the stage can end
    function labBusy() { return !!(labM && labM.busy && labM.busy()); }

    // a brick has died and some are left; true if the mini-boss takes it from there
    function labLeft(left) { return !!(labM && labM.left && labM.left(left)); }

    // for the ones that are not bricks: when they go, the stage may be done
    function labClearIfDone() {
        if (phase !== 'play') return;
        if (!bricks.some(x => x.alive && x.kind !== 'X') && !labBusy()) clearStage();
    }

    function labContact(br, ball) {
        if (br.kind === 'Z' && labB) return labB.contact(br, ball);
        if (br.lab && labM && labM.contact) {
            const hit = labM.contact(br, ball);
            if (hit !== undefined) return hit;
        }
        return contact(br, ball);
    }

    // true: the boss has dealt with this contact himself, bounce and all
    function labTouch(br, ball, hit) {
        return br.kind === 'Z' && labB && labB.touch ? labB.touch(br, ball, hit) : false;
    }

    // a ring where it struck rather than a flash: the hit that does nothing
    function labGlances(br, hit) {
        if (br.kind === 'Z' && labB) return labB.glances ? labB.glances(br, hit) : bossIF > 0;
        if (br.lab && labM && labM.glances) return labM.glances(br, hit);
        return br.kind === 'X' || (br.kind === 'Z' && bossIF > 0);
    }

    function labCeiling(ball) { if (labM && labM.ceiling) labM.ceiling(ball); }

    // once a substep, for anything a head can meet that is not in bricks[]
    function labBallStep(ball) {
        if (labB && labB.ballStep) labB.ballStep(ball);
        if (labM && labM.ballStep) labM.ballStep(ball);
    }

    function labUpdate(dt) {
        labPadUpdate(dt);
        menuWatch(dt);           // outside labM: it is what notices a level ending
        if (labM) labM.update(dt);
        // after the paddle has gone where the hand sent it, and before the
        // physics: a boss standing on the floor can hold him back from it
        if (labB && labB.fence && bricks && bricks[0] && bricks[0].kind === 'Z' && bricks[0].alive) labB.fence();
    }
    function labDrawBrick(b) { return !!(b.lab && labM && labM.drawBrick && labM.drawBrick(b)); }
    function labDrawMini() { if (labM && labM.draw) labM.draw(); }
    // the hub has no ball in it: he carries his head, and nothing is served
    function labSkipBall(b) { return menuUp() || !!(labB && labB.skipBall && labB.skipBall(b)); }
    function labBallR(b) { return labB && labB.ballR ? labB.ballR(b) : bRX(); }
    // how much of the original's climb this fight has
    function labClimb() { return labB && labB.climb ? labB.climb() : 1; }

    // ---- shared by more than one of them ---------------------------------------------
    // how far a head reaches from its middle along the unit vector (nx, ny):
    // it is an ellipse, so that depends on which way it is facing
    function labReach(ball, nx, ny) {
        const c = Math.cos(ball.angle), s = Math.sin(ball.angle);
        const ux = nx * c + ny * s, uy = ny * c - nx * s;
        return Math.hypot(bRX() * ux, bRY() * uy);
    }

    // contact(), for a brandon anywhere: a w x h box centred on (cx, cy),
    // turned `ang`, read through `mask` (MASK's layout, or rows of true and
    // false like it), mirrored left to right when `mirror`, the way he is drawn
    // with scale(-1, 1). Where it touched, in the field, or null.
    function maskContact(ball, cx, cy, ang, w, h, mask, mirror) {
        const cols = mask[0].length, rows = mask.length;
        const cw = w / cols, chh = h / rows;
        const c = Math.cos(-ang), s = Math.sin(-ang);
        const dx = ball.x - cx, dy = ball.y - cy;
        const bx = w / 2 + dx * c - dy * s, by = h / 2 + dx * s + dy * c;
        const pad = Math.max(cw, chh) * 0.5;
        const rx = bRX() + pad, ry = bRY() + pad;
        const aa = -(ball.angle - ang);
        const ca = Math.cos(aa), sa = Math.sin(aa);
        const span = bMAX() + pad;
        const c0 = Math.max(0, Math.floor((bx - span) / cw)), c1 = Math.min(cols - 1, Math.floor((bx + span) / cw));
        const r0 = Math.max(0, Math.floor((by - span) / chh)), r1 = Math.min(rows - 1, Math.floor((by + span) / chh));
        if (c0 > c1 || r0 > r1) return null;
        let sx = 0, sy = 0, n = 0;
        for (let r = r0; r <= r1; r++) {
            for (let q = c0; q <= c1; q++) {
                const cell = mask[r][mirror ? cols - 1 - q : q];
                if (!cell || cell === '.') continue;
                const px = (q + 0.5) * cw, py = (r + 0.5) * chh;
                const ex = px - bx, ey = py - by;
                const lx = ex * ca - ey * sa, ly = ex * sa + ey * ca;
                if ((lx / rx) ** 2 + (ly / ry) ** 2 > 1) continue;
                sx += px; sy += py; n++;
            }
        }
        if (!n) return null;
        const mx = sx / n - w / 2, my = sy / n - h / 2;
        const c2 = Math.cos(ang), s2 = Math.sin(ang);
        return { cx: cx + mx * c2 - my * s2, cy: cy + mx * s2 + my * c2 };
    }

    // A head: the ellipse inscribed in its box, rx and ry its half-sizes. Met
    // where the line from its middle to the ball crosses its outline, which on
    // anything this round is as good as the nearest point.
    function ellipseContact(ball, cx, cy, rx, ry) {
        const qx = (ball.x - cx) / rx, qy = (ball.y - cy) / ry;
        const q = Math.hypot(qx, qy);
        if (q < 1e-6) return { cx, cy: cy + ry };
        const px = cx + rx * qx / q, py = cy + ry * qy / q;
        let nx = qx / q / rx, ny = qy / q / ry;
        const nl = Math.hypot(nx, ny);
        nx /= nl; ny /= nl;
        if (q <= 1) return { cx: px, cy: py };
        const gap = (ball.x - px) * nx + (ball.y - py) * ny;
        return gap <= labReach(ball, nx, ny) ? { cx: px, cy: py } : null;
    }

    // an upright box, x0..x1 across and y0..y1 down
    function boxContact(ball, x0, y0, x1, y1) {
        const qx = Math.max(x0, Math.min(x1, ball.x)), qy = Math.max(y0, Math.min(y1, ball.y));
        const dx = ball.x - qx, dy = ball.y - qy, d = Math.hypot(dx, dy);
        if (d < 1e-6) {
            // its middle is inside: out through whichever face is nearest
            const f = [[ball.x - x0, x0, ball.y], [x1 - ball.x, x1, ball.y],
                       [ball.y - y0, ball.x, y0], [y1 - ball.y, ball.x, y1]].sort((a, b) => a[0] - b[0])[0];
            return { cx: f[1], cy: f[2] };
        }
        return d <= labReach(ball, dx / d, dy / d) ? { cx: qx, cy: qy } : null;
    }

    // a round-ended bar from (ax, ay) to (bx, by), r thick either side
    function capsuleContact(ball, ax, ay, bx, by, r) {
        const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1;
        const t = Math.max(0, Math.min(1, ((ball.x - ax) * vx + (ball.y - ay) * vy) / l2));
        const qx = ax + vx * t, qy = ay + vy * t;
        const dx = ball.x - qx, dy = ball.y - qy, d = Math.hypot(dx, dy);
        if (d < 1e-6) return { cx: qx, cy: qy };
        const nx = dx / d, ny = dy / d;
        return d - r <= labReach(ball, nx, ny) ? { cx: qx + nx * r, cy: qy + ny * r } : null;
    }

    // the bounce stepBall gives anything in bricks[], for the things that are not
    function labBounce(b, hit) {
        const s = effSpeed() * (b.boost || 1);
        let nx = b.x - hit.cx, ny = b.y - hit.cy;
        let len = Math.hypot(nx, ny);
        if (len < 1e-4) { nx = 0; ny = 1; len = 1; }
        nx /= len; ny /= len;
        const dot = b.vx * nx + b.vy * ny;
        if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; }
        b.x += nx * 4; b.y += ny * 4;
        if (Math.abs(b.vy) < s * 0.16) {
            b.vy = (b.vy < 0 ? -1 : 1) * s * 0.16;
            const q = Math.hypot(b.vx, b.vy) || 1;
            b.vx = b.vx / q * s; b.vy = b.vy / q * s;
        }
        bumpSpeed(BRICK_BUMP);
        return { nx, ny };
    }

    // x folded back off the side walls, where a head's middle can reach
    function labFold(x) {
        const lo = BALL_RX, span = LW - 2 * BALL_RX;
        let p = x - lo;
        p = ((p % (2 * span)) + 2 * span) % (2 * span);
        return lo + (p > span ? 2 * span - p : p);
    }

    // the boss's thin health bar, anywhere
    function labBar(x, y, w, frac, h = 5) {
        ctx.fillStyle = 'rgba(242,239,233,0.14)';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#c4703c';
        ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
    }

    // ball.webp baked once, at twice its own size so a big head stays as sharp
    // as it can: 'flat' in one colour (hit flashes), 'grey' with the colour out
    // of it (coming apart), 'stone' carved (the IDOL)
    function headSprite2(kind, color) {
        const k = 'head2-' + kind + (color || '');
        if (spriteCache.has(k)) return spriteCache.get(k);
        if (!ready(ballImg)) return null;
        const w = ballImg.naturalWidth * 2, h = ballImg.naturalHeight * 2;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        if (kind === 'grey') g.filter = 'grayscale(1) brightness(0.94)';
        g.drawImage(ballImg, 0, 0, w, h);
        g.filter = 'none';
        if (kind === 'flat' || kind === 'stone') {
            g.globalCompositeOperation = 'source-in';
            g.fillStyle = kind === 'stone' ? STONE : color;
            g.fillRect(0, 0, w, h);
        }
        if (kind === 'stone') {
            // the same faint pass of his own shading the statues get
            g.globalCompositeOperation = 'source-atop';
            g.globalAlpha = 0.2;
            g.filter = 'grayscale(1) contrast(1.1) brightness(1.7)';
            g.drawImage(ballImg, 0, 0, w, h);
            g.filter = 'none';
            g.globalAlpha = 1;
        }
        g.globalCompositeOperation = 'source-over';
        spriteCache.set(k, c);
        return c;
    }

    // a head coming apart, the way a body does along MASK: a grid over it, the
    // chin letting go first and the crown last. stepCrumble moves it -- it only
    // needs the pieces -- and drawHeadCrumble draws it.
    const HEAD_COLS = 8, HEAD_ROWS = 12;
    function headShatter(x, y, w, span) {
        const pieces = [];
        for (let v = 0; v < HEAD_ROWS; v++) {
            for (let u = 0; u < HEAD_COLS; u++) {
                const du = (u + 0.5) / HEAD_COLS - 0.5, dv = (v + 0.5) / HEAD_ROWS - 0.5;
                if (du * du * 4 + dv * dv * 4 > 1.1) continue;
                pieces.push({ u, v, wait: (1 - (v + 0.5) / HEAD_ROWS) * span * 0.8 + Math.random() * span * 0.2,
                              vx: du * 40 + (Math.random() - 0.5) * 14, vy: -4 - Math.random() * 12,
                              spin: (Math.random() - 0.5) * 0.9, rot: 0, dx: 0, dy: 0, age: 0 });
            }
        }
        return { x, y, w, t: 0, pieces, head: true };
    }

    function drawHeadCrumble(c, sprite) {
        if (!sprite) return;
        const w = c.w, h = w * (BALL_RY / BALL_RX);
        const x0 = c.x - w / 2, y0 = c.y - h / 2;
        const cw = w / HEAD_COLS, ch = h / HEAD_ROWS;
        const sw = sprite.width / HEAD_COLS, sh = sprite.height / HEAD_ROWS;
        for (const s of c.pieces) {
            const a = Math.max(0, 1 - s.age / F_GONE);
            if (a <= 0.002) continue;
            ctx.save();
            ctx.globalAlpha = a;
            ctx.translate(x0 + (s.u + 0.5) * cw + s.dx, y0 + (s.v + 0.5) * ch + s.dy);
            ctx.rotate(s.rot);
            ctx.drawImage(sprite, s.u * sw, s.v * sh, sw, sh, -cw / 2 - 0.5, -ch / 2 - 0.5, cw + 1, ch + 1);
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }

    // A head boss's end, for the takeover's first beat: the colour going out of
    // him over A_DIE, then coming apart. `extra` draws whatever else of him is
    // still falling. The takeover's white cut-out is his body's shape, which is
    // wrong for a head, so his own flash stands in for it while the blow holds.
    function labHeadFall(extra) {
        const c = bossFall;
        if (!c || !c.head) return;
        const wilt = Math.max(0, Math.min(1, ascendT / A_DIE));
        const e = wilt * wilt * (3 - 2 * wilt);
        const w = c.w, h = w * (BALL_RY / BALL_RX);
        if (extra) extra();
        if (ascendT < A_DIE) {
            if (ready(ballImg)) {
                if (e > 0.001) ctx.filter = 'grayscale(' + e.toFixed(3) + ')';
                ctx.drawImage(ballImg, c.x - w / 2, c.y - h / 2 + e * F_SAG, w, h);
                ctx.filter = 'none';
            }
        } else {
            drawHeadCrumble(c, headSprite2('grey'));
        }
        const a = impact ? (impact.t < HIT_HOLD ? 1 : 1 - (impact.t - HIT_HOLD) / HIT_FADE) : 0;
        if (a > 0.002) {
            ctx.globalAlpha = a;
            ctx.drawImage(headSprite2('flat', '#f2efe9'), c.x - w / 2, c.y - h / 2, w, h);
            ctx.globalAlpha = 1;
        }
    }

    // a head boss has just died: clearStage has stood the takeover up, and this
    // swaps its body-shaped pieces and cut-out for a head's
    function labHeadDied(x, y, w) {
        bossFall = headShatter(x, y, w, A_DIE_T);
        if (impact) impact.w = 0;
    }