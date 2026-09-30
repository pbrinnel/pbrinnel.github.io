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
        usePad(key) {
            LAB.pad = key;
            labPadUse(key);
            if (typeof menuPadKept === 'function') menuPadKept(key);     // remembered for next time
        },
        stageAt(n, open) { LAB.open = !!open; startAt(n); },
        // every capsule the game has, for the lab's give buttons
        get caps() { return CAP_KEYS.map(k => ({ key: k, name: CAPS[k].short })); },
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
        // ...and a boss's, handed his brick
        bossAct(name) {
            const b = bricks && bricks[0];
            return !!(labB && labB.acts && labB.acts[name] && b && b.kind === 'Z' && b.alive && labB.acts[name](b));
        },
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
        labShouts = [];
        labMiniWait = null;
        if (labB && labB.reset) labB.reset();
        if (labM && labM.reset) labM.reset();
        labB = null;
        labM = null;
    }

    // the boss stage has just been built as the original: make it whoever the
    // screen names (BOSS RUSH's, one after another), or else whoever the lab picked
    function labBossStart() {
        const who = (LEVELS[stage] && LEVELS[stage].who) || LAB.boss;
        labB = (who && LAB_BOSS[who]) || null;
        if (labB) labB.start(bricks[0]);
    }

    // An ordinary stage has its bricks in. An open field has them taken away
    // again, and then the mini-boss comes on -- or does not, if it cannot ride
    // what is left (a mole needs a wall to hide in). A level's own screen can
    // name its rider (levels.js); otherwise it is whoever the lab picked.
    //
    // A level's rider makes an entrance. The screen starts without him, and
    // only once the rally has been going MINI_WAIT0..MINI_WAIT1 seconds --
    // rolled fresh every time, or his own `wait` [from, to] -- does he come
    // on, shouting as he does. One with a `due()` of his own comes when that
    // says so instead (PONG, the moment a head is about to reach the back
    // wall). How he comes on (walking, lowering, fading) is his own `enter`;
    // the shout is here, so every one of them has it. The screen cannot end
    // while he is still to come, and if the wall is gone before he is, he
    // comes at once.
    const MINI_WAIT0 = 5, MINI_WAIT1 = 10;
    let labMiniWait = null;          // { who, t }: a rider still to come
    function labMiniStart() {
        if (LAB.open) bricks = [];
        labMiniWait = null;
        const own = LEVELS[stage] && LEVELS[stage].mini;
        if (own && LAB_MINI[own]) {
            const m = LAB_MINI[own], w = m.wait || [MINI_WAIT0, MINI_WAIT1];
            labMiniWait = { who: own, t: m.due ? Infinity : w[0] + Math.random() * (w[1] - w[0]) };
            return;
        }
        const who = LAB.mini;
        labM = (who && LAB_MINI[who]) || null;
        if (labM && !labM.start()) labM = null;
    }

    // his clock runs only in a rally, like everything else that is waiting on you
    function labMiniArrive(dt) {
        const w = labMiniWait;
        if (!w || phase !== 'play') return;
        const wall = bricks.some(b => b.alive && b.kind !== 'X');
        const due = LAB_MINI[w.who].due;
        if ((w.t -= dt) > 0 && wall && !(due && due())) return;
        labMiniWait = null;
        labM = LAB_MINI[w.who];
        if (!labM.start(true)) { labM = null; labClearIfDone(); return; }
        // enter() says where he is shouting from: { x, y }, and `at` if the
        // shout should ride on him as he comes
        const from = labM.enter ? labM.enter() : null;
        if (from) labShout(from.x, from.y, 'BRANDON!', SHOUT_SECS * 1.6, from.at || null);
    }

    // A rider has been beaten, not merely outlasted: the round pays MINI BOSS
    // CLEAR for it, or for `share` of it where he comes in more than one (the
    // MOLEs). One getting off the edge does not count.
    function labMiniDown(share) { if (round) round.mini = Math.min(1, (round.mini || 0) + (share || 1)); }

    function labHolds(ball) { return !!(labB && labB.holds && labB.holds(ball)); }

    // hitBrick's first question: is this one somebody's to take? Asked before
    // the original's half second between wounds, which the new ones keep for
    // themselves.
    function labHit(b, cx, cy) {
        if (b.kind === 'Z' && labB) { labB.hit(b, cx, cy); return true; }
        if (b.lab && labM && labM.hit) { labM.hit(b, cx, cy); return true; }
        return false;
    }

    // whether a mini-boss still has to come, or be beaten, before the stage can end
    function labBusy() { return !!labMiniWait || !!(labM && labM.busy && labM.busy()); }

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
        labBurstStep(dt);
        for (const s of labShouts) s.life -= dt;
        labShouts = labShouts.filter(s => s.life > 0);
        menuWatch(dt);           // outside labM: it is what notices a level ending
        labMiniArrive(dt);
        if (labM) labM.update(dt);
        // after the paddle has gone where the hand sent it, and before the
        // physics: a boss standing on the floor can hold him back from it
        if (labB && labB.fence && bricks && bricks[0] && bricks[0].kind === 'Z' && bricks[0].alive) labB.fence();
    }
    function labDrawBrick(b) { return !!(b.lab && labM && labM.drawBrick && labM.drawBrick(b)); }
    function labDrawMini() { if (labM && labM.draw) labM.draw(); }
    // after the field is drawn and before the popups and the HUD: a boss's
    // pass over the whole of it (the VOLCANO's dark room, dark.js)
    function labDrawLight() { if (labB && labB.dark && labB.dark()) labB.light(); }
    // the hub has no ball in it: he carries his head, and nothing is served
    function labSkipBall(b) { return menuUp() || !!(labB && labB.skipBall && labB.skipBall(b)); }
    function labBallR(b) { return labB && labB.ballR ? labB.ballR(b) : bRX(); }
    // how far he is lifted and turned: walking up the town, or stood up by a boss
    function labLift() { return menuLift() + (labB && labB.lift ? labB.lift() : 0); }
    function labRock(i) { return menuRock(i) + (labB && labB.rock ? labB.rock(i) : 0); }
    // how long this boss takes to arrive: his own, or the original's
    function labEnterSecs() { return labB && labB.enterSecs ? labB.enterSecs() : ENTER_SECS; }

    // Whether a broken brick drops a capsule. Not a flat chance: each brick
    // that drops nothing makes the next likelier by CAP_RAMP, from CAP_BASE
    // straight after a drop, so the rate holds (about 24% a brick at these
    // numbers) but a long dry spell cannot happen -- by the time the ramp
    // reaches certainty one has come. CAP_BASE is kept above zero so two
    // close together still happen now and then. Bricks broken while one is
    // falling are not asked (maybeDropCapsule stops first), so they do not
    // count, or a second would follow the first down almost at once. `mul`
    // is LUCKY's. The count carries across screens and lives.
    let CAP_BASE = 0.1;
    let CAP_RAMP = 0.066;
    LAB_KNOBS.push('CAP_BASE', 'CAP_RAMP');
    let labCapDry = 0;            // bricks asked since the last drop
    function labCapRoll(mul) {
        if (Math.random() >= (CAP_BASE + CAP_RAMP * labCapDry++) * mul) return false;
        labCapDry = 0;
        return true;
    }

    // Which capsule drops, for the engine and every boss alike. A shuffle bag:
    // each capsule the screen allows comes round once, in a random order,
    // before any comes round again, so none is starved for a whole run. A plain
    // roll over the list repeated far more often than it felt fair. On top of
    // the bag, CAP_AGAIN of drops are just the last one again, because a double
    // now and then is fun. A boss screen allows fewer, so it takes what it can
    // from the bag and deals a fresh one when none are left. The paddle's lean
    // (PAD_FAVOUR) is a roll of its own, after this one.
    let CAP_AGAIN = 0.1;
    LAB_KNOBS.push('CAP_AGAIN');
    let labCapBag = [], labCapLast = null;
    function labCapKind() {
        const pool = capsulePool();
        if (pool.includes(labCapLast) && Math.random() < CAP_AGAIN) return labCapLast;
        let i = labCapBag.findIndex(k => pool.includes(k));
        if (i < 0) {
            labCapBag = pool.slice();
            for (let j = labCapBag.length - 1; j > 0; j--) {
                const r = (Math.random() * (j + 1)) | 0;
                [labCapBag[j], labCapBag[r]] = [labCapBag[r], labCapBag[j]];
            }
            // a new bag must not open on the one the old bag closed on, or it
            // repeats behind CAP_AGAIN's back
            if (labCapBag.length > 1 && labCapBag[0] === labCapLast) {
                const r = 1 + ((Math.random() * (labCapBag.length - 1)) | 0);
                [labCapBag[0], labCapBag[r]] = [labCapBag[r], labCapBag[0]];
            }
            i = 0;
        }
        return labCapLast = labCapBag.splice(i, 1)[0];
    }

    // Bubbles from anyone, as many at once as there are shouters -- the
    // engine only has room for the one. Each is drawn by the engine's own
    // drawShout, lent the slot for a moment, so they look exactly like his.
    // `at`, if given, is asked each frame where the shouter is now, so a
    // bubble can ride on someone who is moving.
    let labShouts = [];
    function labShout(x, y, text, life, at) {
        labShouts.push({ x, y, text: text || 'BRANDON!', life: life || SHOUT_SECS, at });
    }
    function labDrawShouts() {
        if (!labShouts.length) return;
        const keep = shout;
        for (const s of labShouts) {
            if (s.at) Object.assign(s, s.at());
            shout = s;
            drawShout();
        }
        shout = keep;
    }

    // ---- the heads going off at the killing blow -------------------------------------
    // Every head in play bursts where it is: its pieces flying apart and
    // turning as they fall, a ring spreading, sparks. A boss's last hit calls
    // it -- the original's in clearStage, one of the lab's from his own -- and
    // the heads are not drawn after: the takeover draws none, and a boss who
    // holds the world still hides the ones he holds. One flash a head, never
    // repeated.
    let labBursts = [];
    const LAB_BURST_SECS = 1.1;      // how long the pieces take to go
    const LAB_BURST_PIECES = 8;
    const LAB_BURST_FALL = 700;      // px/s² the pieces fall at
    function labBurst() {
        for (const b of balls) {
            if (labSkipBall(b)) continue;
            const pieces = [], sparks = [];
            for (let i = 0; i < LAB_BURST_PIECES; i++) {
                const a0 = i / LAB_BURST_PIECES * 2 * Math.PI + Math.random() * 0.3, a1 = a0 + 2 * Math.PI / LAB_BURST_PIECES;
                const mid = (a0 + a1) / 2, sp = 180 + Math.random() * 220;
                pieces.push({ a0, a1, vx: Math.cos(mid) * sp, vy: Math.sin(mid) * sp - 80, va: (Math.random() - 0.5) * 14 });
            }
            for (let i = 0; i < 18; i++) {
                const a = Math.random() * 2 * Math.PI, sp = 150 + Math.random() * 350;
                sparks.push({ vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.3 + Math.random() * 0.4 });
            }
            labBursts.push({ x: b.x, y: b.y, r: labBallR(b), angle: b.angle, t: 0, pieces, sparks });
        }
    }
    function labBurstStep(dt) { labBursts = labBursts.filter(bu => (bu.t += dt) < LAB_BURST_SECS); }
    function labDrawBursts() {
        for (const bu of labBursts) {
            const t = bu.t, k = t / LAB_BURST_SECS;
            ctx.save();
            // the flash, gone in a moment, and the ring after it
            if (t < 0.15) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.8 * (1 - t / 0.15);
                const g = ctx.createRadialGradient(bu.x, bu.y, 0, bu.x, bu.y, bu.r * 3);
                g.addColorStop(0, 'rgba(255,240,210,1)');
                g.addColorStop(1, 'rgba(255,150,60,0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(bu.x, bu.y, bu.r * 3, 0, 2 * Math.PI); ctx.fill();
            }
            if (t < 0.4) {
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 0.7 * (1 - t / 0.4);
                ctx.strokeStyle = '#ffd9a0';
                ctx.lineWidth = 3 * (1 - t / 0.4) + 1;
                ctx.beginPath(); ctx.arc(bu.x, bu.y, bu.r * (1.2 + 9 * t), 0, 2 * Math.PI); ctx.stroke();
            }
            // the head, in pieces: each its own wedge of him, flying and turning
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = Math.max(0, 1 - k * k);
            for (const p of bu.pieces) {
                ctx.save();
                ctx.translate(bu.x + p.vx * t, bu.y + p.vy * t + 0.5 * LAB_BURST_FALL * t * t);
                ctx.rotate(p.va * t);
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, bu.r * 1.6, p.a0, p.a1);
                ctx.closePath();
                ctx.clip();
                drawBall(0, 0, bu.r, bu.angle);
                ctx.restore();
            }
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = '#ffb45a';
            for (const s of bu.sparks) {
                if (t >= s.life) continue;
                ctx.globalAlpha = 1 - t / s.life;
                const d = 1 - Math.exp(-3 * t), sx = bu.x + s.vx / 3 * d, sy = bu.y + s.vy / 3 * d + 120 * t * t;
                ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
            }
            ctx.restore();
        }
    }

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
        labUnflat(b, s);
        bumpSpeed(BRICK_BUMP);
        return { nx, ny };
    }

    // never so near level that the head skates wall to wall and never comes
    // down: at least LAB_FLAT of its speed up or down, as stepBall keeps it
    const LAB_FLAT = 0.16;
    function labUnflat(b, s) {
        if (Math.abs(b.vy) >= s * LAB_FLAT) return;
        b.vy = (b.vy < 0 ? -1 : 1) * s * LAB_FLAT;
        const q = Math.hypot(b.vx, b.vy) || 1;
        b.vx = b.vx / q * s; b.vy = b.vy / q * s;
    }

    // A head just bounced off (n, from labBounce) turned `share` of the way
    // toward (tx, ty) -- never so far that it goes back into what it left,
    // and never so near level that it skates.
    function labSteer(b, n, tx, ty, share) {
        const s = Math.hypot(b.vx, b.vy), now = Math.atan2(b.vy, b.vx);
        const to = Math.atan2(ty - b.y, tx - b.x);
        let turn = Math.atan2(Math.sin(to - now), Math.cos(to - now)) * share;
        for (let i = 0; i < 6 && Math.cos(now + turn) * n.nx + Math.sin(now + turn) * n.ny < 0.15; i++) turn *= 0.5;
        b.vx = Math.cos(now + turn) * s;
        b.vy = Math.sin(now + turn) * s;
        labUnflat(b, s);
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
    // of it (coming apart), 'stone' carved (the IDOL), 'wash' his face under a
    // coat of one colour, as the town's are (the FARM's leaves)
    function headSprite2(kind, color) {
        const k = 'head2-' + kind + (color || '');
        if (spriteCache.has(k)) return spriteCache.get(k);
        if (!ready(ballImg)) return null;
        const w = ballImg.naturalWidth * 2, h = ballImg.naturalHeight * 2;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        if (kind === 'grey') g.filter = 'grayscale(1) brightness(0.94)';
        if (kind === 'wash') g.filter = 'grayscale(1) contrast(1.1) brightness(1.95)';
        g.drawImage(ballImg, 0, 0, w, h);
        g.filter = 'none';
        if (kind === 'wash') {
            g.globalCompositeOperation = 'source-atop';
            g.globalAlpha = 0.8;
            g.fillStyle = color;
            g.fillRect(0, 0, w, h);
            g.globalAlpha = 1;
        }
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
    // A head that had already gone grey before it died (the WINDMILL's last
    // flower) sets c.grey, and starts there rather than flushing back to colour.
    // One that dies wearing something (the IDOL's stone) sets c.cover, drawn
    // over the face as it greys, and c.crumble, the grey head wearing it, to
    // come apart as.
    function labHeadFall(extra) {
        const c = bossFall;
        if (!c || !c.head) return;
        const wilt = Math.max(0, Math.min(1, ascendT / A_DIE));
        const e = wilt * wilt * (3 - 2 * wilt);
        const grey = Math.max(e, c.grey || 0);
        const w = c.w, h = w * (BALL_RY / BALL_RX);
        if (extra) extra();
        if (ascendT < A_DIE) {
            if (ready(ballImg)) {
                ctx.drawImage(ballImg, c.x - w / 2, c.y - h / 2 + e * F_SAG, w, h);
                // the grey laid over him rather than ctx.filter, which Safari ignores
                const g = headSprite2('grey');
                if (g && grey > 0.001) {
                    ctx.globalAlpha = grey;
                    ctx.drawImage(g, c.x - w / 2, c.y - h / 2 + e * F_SAG, w, h);
                    ctx.globalAlpha = 1;
                }
                if (c.cover) c.cover(c.x - w / 2, c.y - h / 2 + e * F_SAG, w, h);
            }
        } else {
            // from where the sag left him, or he jumps back up as he comes apart
            ctx.save();
            ctx.translate(0, F_SAG);
            drawHeadCrumble(c, c.crumble || headSprite2('grey'));
            ctx.restore();
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