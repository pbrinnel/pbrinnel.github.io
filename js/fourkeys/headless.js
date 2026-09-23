'use strict';

    // ---- HEADLESS (boss) -------------------------------------------------------
    // His body, cut clean at the collar, and the ball is his head. A head
    // anywhere on his body hurts him. A head that lands on the collar end, he
    // puts on: he can see for as long as he wears it, it leaves you sluggish,
    // and he hands it back at whichever of the original's angles lands
    // furthest from you. He cannot see, so he goes by touch -- every hit turns
    // his collar to the side it landed on and brings it over the spot. Put the
    // next one where the last one went and he has it.
    let HL_HP       = 16;      // hits to finish him
    // What a catch costs you. He does NOT heal on it: a boss who undoes your
    // work is a treadmill, not a fight. He takes the head off you for a moment
    // and leaves the same helping of SLUGGISH on you that one of the original's
    // phantom heads does, which stacks and runs down the same way.
    let HL_DRAG     = 3;
    let HL_NECK     = 0.22;    // share of his length, from the collar end, that catches
    let HL_HOLD     = 1.2;     // seconds he wears a head before he hands it back
    let HL_DON      = 0.2;     // seconds a head takes to go on him, and to come back off
    let HL_REACT    = 0.12;    // seconds between a touch and the lurch after it
    let HL_LURCH0   = 320;     // px/s he lurches at, fresh
    let HL_LURCH1   = 640;     // ...and nearly finished
    let HL_EASE     = 0.22;    // seconds: how he settles into where he is going
    let HL_FLIP     = 0.3;     // seconds to turn over
    let HL_GROPE_AT = 2.5;     // seconds untouched before he starts feeling about
    let HL_GROPE    = 70;      // px/s while he does
    let HL_W0       = 560;     // how long he arrives
    let HL_W1       = 300;     // ...and how long he is once finished
    let HL_Y        = 150;     // where his middle hangs
    let HL_BOB      = 10;      // px he drifts up and down
    let HL_YELL     = 0.5;     // odds a catch after his first gets a BRANDON! too
    // The act a run draws him from, 1 easy to 3 hard. Nothing he does can cost
    // you a life: a catch costs tempo and gives him a little back, and there is
    // no barrage at all, so he opens.
    let HL_LVL      = 0;
    LAB_KNOBS.push('HL_LVL', 'HL_HP', 'HL_DRAG', 'HL_NECK', 'HL_HOLD', 'HL_DON', 'HL_REACT',
                   'HL_LURCH0', 'HL_LURCH1', 'HL_EASE', 'HL_FLIP', 'HL_GROPE_AT', 'HL_GROPE',
                   'HL_W0', 'HL_W1', 'HL_Y', 'HL_BOB', 'HL_YELL');

    // Where his head was, in his own levelled box: u along him from the boot,
    // v down from his top. Read off paddle.webp: a line across the neck just
    // under the beard, then round the hair. It is his head and nothing else, so
    // the shoulder beside it stays. Geometry, not feel, so these stay consts.
    const HL_CUT = [[0.84, 0.445], [0.836, 0.30], [0.845, 0.12], [0.87, 0.02], [0.90, -0.05],
                    [0.97, -0.05], [1.02, 0.05], [1.02, 0.29], [0.975, 0.345], [0.945, 0.40],
                    [0.935, 0.455]];
    // ...and a head he has put on sits where his own did: its middle, its width
    // as a share of his length, and the lean his own head had
    const HL_HEAD_U = 0.8875, HL_HEAD_V = 0.215, HL_HEAD_W = 0.105;
    const HL_HEAD_TILT = 13.3 * Math.PI / 180;
    const HL_SPRITE_W = 900;   // baked once this long, and scaled

    let hl = null;
    let hlMaskCache = null;

    LAB_BOSS.headless = {
        start: hlStart,
        reset() { hl = null; },
        update: hlUpdate,
        contact(br, ball) {
            if (ball.hlPass) return null;      // one he is letting go of goes out through him
            return maskContact(ball, br.x + bw / 2, br.y + bh / 2, br.wigA || 0, bw, bh, hlMask(), hlFace() < 0);
        },
        touch: hlTouch,
        glances() { return bossIF > 0; },
        hit: hlHit,
        draw: hlDraw,
        drawFall: hlDrawFall,
        holds(ball) { return !!hl && hl.held === ball; },
        skipBall(ball) { return !!hl && hl.held === ball; },
        ballR(ball) {
            if (!hl || !(ball.hlOff > 0)) return bRX();
            return bRX() + (HL_HEAD_W * bw / 2 - bRX()) * ball.hlOff;
        },
        climb() { return 1; },
        finish(b) { b.hp = Math.min(b.hp, 1); return true; },
        state(b) {
            return { name: 'HEADLESS', hp: b.hp, max: b.maxHp, w: bw,
                     line: 'caught ' + hl.catches + (hl.held ? ' · wearing your head' : hl.whole ? ' · whole'
                           : hl.turn > 0 ? ' · turning over' : hl.groping ? ' · feeling about' : '') };
        }
    };

    function hlStart(b) {
        bw = HL_W0;
        bh = bw / SHAPE_ASPECT;
        b.hp = b.maxHp = HL_HP;
        b.x = (LW - bw) / 2;
        b.y = -(bh + 40);
        // no yell to open the fight: he has nothing to yell with until he is
        // wearing your head
        bossServed = true;
        hl = { face: 1, from: 1, turn: 0, cx: LW / 2, tx: LW / 2, bob: 0,
               feel: null, feelT: 0, still: 0, nextGrope: HL_GROPE_AT, groping: false,
               held: null, holdT: 0, don: 0, whole: false, said: false, catches: 0 };
    }

    // which way his collar points as far as a head is concerned: the old way
    // until a turn is halfway over, the new way after
    function hlFace() {
        return hl.turn > 0 && hl.turn < 0.5 ? hl.from : hl.face;
    }

    // how he is drawn across: his facing, going through nothing as he turns
    function hlScaleX() {
        return hl.turn > 0 ? hl.from * Math.cos(Math.PI * hl.turn) : hl.face;
    }

    // how far along him a point is: 0 at his boot, 1 at the collar end
    function hlAlong(b, x) {
        const u = (x - b.x) / bw;
        return hlFace() > 0 ? u : 1 - u;
    }

    // a point in his own box, in the field, whichever way he faces
    function hlPoint(b, u, v) {
        return { x: b.x + (hlFace() > 0 ? u : 1 - u) * bw, y: b.y + v * bh };
    }

    // the middle of his collar end, measured from his own middle
    function hlReach() { return bw / 2 - bw * HL_NECK / 2; }

    // He shrinks off his damage the way the original does, and a catch that
    // gives some back grows him again.
    function hlSize(b) {
        const dmg = Math.max(0, 1 - b.hp / b.maxHp);
        bw = HL_W0 + (HL_W1 - HL_W0) * dmg;
        bh = bw / SHAPE_ASPECT;
        return dmg;
    }

    // Turn the collar to the side of him a touch was on, then bring it over
    // the spot. The collar always ends up on the field, so his body hangs
    // inward from it.
    function hlGoTo(x) {
        const side = x < hl.cx ? -1 : 1;
        if (side !== hl.face) { hl.from = hl.face; hl.face = side; hl.turn = 1e-6; }
        hl.tx = x - side * hlReach();
    }

    function hlUpdate(b, dt) {
        const dmg = hlSize(b);
        if (phase === 'entrance') {
            // lowered in the way the original is, bar growing with him
            const raw = enterK(), k = raw * raw * (3 - 2 * raw);
            const from = -(bh + 40);
            hl.cx = hl.tx = LW / 2;
            b.x = hl.cx - bw / 2;
            b.y = from + (HL_Y - bh / 2 - from) * k;
            return;
        }
        const live = phase === 'play';
        if (hl.turn > 0 && (hl.turn += dt / HL_FLIP) >= 1) hl.turn = 0;
        if (hl.held && !balls.includes(hl.held)) hl.held = null;   // a reset took it off him

        if (live) {
            if (hl.feel !== null && (hl.feelT -= dt) <= 0) { hlGoTo(hl.feel); hl.feel = null; }
            // left alone, he shuffles about feeling for it. no turning over for
            // that: a turn is his answer to being touched
            if (!hl.held && hl.feel === null) {
                hl.still += dt;
                if (hl.still >= hl.nextGrope && Math.abs(hl.tx - hl.cx) < 2) {
                    hl.groping = true;
                    const step = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 120);
                    hl.tx = Math.max(bw * 0.3, Math.min(LW - bw * 0.3, hl.cx + step));
                    hl.still = 0;
                    hl.nextGrope = 0.4 + Math.random() * 0.6;
                }
            }
            const top = hl.groping ? HL_GROPE : HL_LURCH0 + (HL_LURCH1 - HL_LURCH0) * dmg;
            hl.cx += Math.max(-top, Math.min(top, (hl.tx - hl.cx) / HL_EASE)) * dt;
            hl.bob += dt;
        }
        b.x = hl.cx - bw / 2;
        b.y = HL_Y - bh / 2 + Math.sin(hl.bob * 1.3) * HL_BOB;

        // the head he has on sits where his own did, and is his until he lets go
        if (hl.held) {
            hl.don = Math.min(1, hl.don + dt / HL_DON);
            const p = hlPoint(b, HL_HEAD_U, HL_HEAD_V), h = hl.held;
            h.x = p.x; h.y = p.y;
            h.vx = 0; h.vy = 0; h.spin = 0; h.eng = 0;
            if (live && (hl.holdT -= dt) <= 0) hlLetGo(b);
        }
        // one he has let go of goes out through him rather than off him, and
        // comes back to its own size as it goes
        for (const ball of balls) {
            if (ball.hlOff > 0) ball.hlOff = Math.max(0, ball.hlOff - dt / HL_DON);
            if (ball.hlPass && ball.y - extY(ball) > b.y + bh) ball.hlPass = false;
        }
    }

    // A head has met him. On the collar end, and with his shoulders free, he
    // has it: true, and the physics leaves it alone. Anywhere else it bounces
    // and wounds him as any hit on a boss does -- see hlHit.
    function hlTouch(br, ball, hit) {
        if (hl.held || hlAlong(br, hit.cx) < 1 - HL_NECK) return false;
        hl.held = ball; hl.holdT = HL_HOLD; hl.don = 0;
        hl.catches++;
        ball.vx = 0; ball.vy = 0; ball.spin = 0; ball.eng = 0; ball.boost = 1;
        // it costs you the head for a moment, and it leaves you sluggish
        const sgs = segs();
        const sg = sgs.reduce((a, s) => Math.abs(s.cx - ball.x) < Math.abs(a.cx - ball.x) ? s : a, sgs[0]);
        dragT = Math.min(DRAG_CAP, dragT + HL_DRAG);
        paddle.jt[sg.i] = 1;
        paddle.tilt[sg.i] = Math.max(-1, Math.min(1, (ball.x - sg.cx) / Math.max(1, sg.w / 2)));
        // he knows where it is now
        hl.feel = null; hl.tx = hl.cx; hl.groping = false; hl.still = 0;
        // and at last he has something to yell with
        if (!hl.said || Math.random() < HL_YELL) {
            hl.said = true;
            const p = hlPoint(br, HL_HEAD_U, 1);
            shout = { x: p.x, y: br.y + bh + 8, life: SHOUT_SECS };
        }
        return true;
    }

    // Back to you, at the rally's speed and never faster. He can see while he
    // has it on, so of the angles the original draws back to he takes the one
    // that lands furthest from where you are.
    function hlLetGo(b) {
        const ball = hl.held, s = effSpeed();
        hl.held = null;
        hl.still = 0; hl.nextGrope = HL_GROPE_AT;
        let pick = 0, far = -1;
        for (const a of SLAM_ANGLES) {
            const d = Math.abs(labFold(ball.x - Math.tan(a) * Math.max(0, padY() - ball.y)) - paddle.x);
            if (d > far) { far = d; pick = a; }
        }
        ball.vx = -Math.sin(pick) * s;
        ball.vy = Math.cos(pick) * s;
        ball.angle = HL_HEAD_TILT * hlFace();
        ball.hlPass = true;
        ball.hlOff = 1;
    }

    function hlHit(b, cx, cy) {
        if (bossIF > 0) return;
        b.flash = 1;
        bossIF = BOSS_IF;
        b.hp = Math.max(0, b.hp - 1);
        bossHits++;
        const done = b.hp <= 1e-6;
        const x = cx === undefined ? b.x + bw / 2 : cx;
        award(BOSS_PTS * (done ? 5 : 1), x, cy === undefined ? b.y : cy);
        if (done) {
            // the head that finished him goes on, and he comes apart whole
            hl.whole = true;
            hl.held = null;
            b.alive = false;
            clearStage();
            if (impact) impact.flip = hlFace() < 0;
            return;
        }
        // he felt that, there
        hl.feel = x; hl.feelT = HL_REACT;
        hl.still = 0; hl.groping = false; hl.nextGrope = HL_GROPE_AT;
        if (bossHits % BOSS_CAP === 0 && !capsule) {
            const pool = capsulePool();
            capsule = { x: b.x + bw / 2, y: b.y + bh / 2, kind: pool[(Math.random() * pool.length) | 0] };
        }
        if (++hits === 4 || hits === 12) bumpSpeed(1.12);
    }

    // MASK with his head taken off, the cells whose middles fall inside the cut
    function hlMask() {
        if (hlMaskCache) return hlMaskCache;
        hlMaskCache = MASK.map((line, r) => [...line].map((ch, c) =>
            ch === '#' && !hlInCut((c + 0.5) / MCOLS, (r + 0.5) / MROWS)));
        return hlMaskCache;
    }

    function hlInCut(u, v) {
        let inside = false;
        for (let i = 0, j = HL_CUT.length - 1; i < HL_CUT.length; j = i++) {
            const [ui, vi] = HL_CUT[i], [uj, vj] = HL_CUT[j];
            if ((vi > v) !== (vj > v) && u < (uj - ui) * (v - vi) / (vj - vi) + ui) inside = !inside;
        }
        return inside;
    }

    // 'raw' is him cut at the collar, 'flash' his hit flash in the same shape,
    // and 'grey' is him whole and colourless -- the head that finished him on
    // his shoulders -- for coming apart
    function hlSprite(kind) {
        const k = 'hl-' + kind;
        if (spriteCache.has(k)) return spriteCache.get(k);
        if (!ready(paddleImg) || !ready(ballImg)) return null;
        const w = HL_SPRITE_W, h = w / SHAPE_ASPECT;
        const c = document.createElement('canvas');
        c.width = Math.round(w * SS); c.height = Math.round(h * SS);
        const g = c.getContext('2d');
        g.scale(SS, SS);
        if (kind === 'grey') g.filter = 'grayscale(1) brightness(0.94)';
        placeShape(g, w, h, false);
        g.filter = 'none';
        g.globalCompositeOperation = 'destination-out';
        g.beginPath();
        HL_CUT.forEach(([u, v], i) => i ? g.lineTo(u * w, v * h) : g.moveTo(u * w, v * h));
        g.closePath();
        g.fill();
        g.globalCompositeOperation = 'source-over';
        if (kind === 'flash') {
            g.globalCompositeOperation = 'source-in';
            g.fillStyle = '#f2efe9';
            g.fillRect(0, 0, w, h);
            g.globalCompositeOperation = 'source-over';
        }
        if (kind === 'grey') {
            g.save();
            g.translate(HL_HEAD_U * w, HL_HEAD_V * h);
            g.rotate(HL_HEAD_TILT);
            g.filter = 'grayscale(1) brightness(0.94)';
            const hw = HL_HEAD_W * w, hh = hw * (BALL_RY / BALL_RX);
            g.drawImage(ballImg, -hw / 2, -hh / 2, hw, hh);
            g.restore();
        }
        spriteCache.set(k, c);
        return c;
    }

    // a head on his shoulders, drawn in his own frame, for a body `w` long.
    // `k` runs 0 -> 1 as it goes on: from the size it is in play to the size
    // his own head was. Where his frame is mirrored the face is put back the
    // right way round, so it does not flip over the moment he lets go of it.
    function hlDrawHead(w, k, sx) {
        if (!ready(ballImg)) return;
        const h = w / SHAPE_ASPECT;
        const small = BALL_RX * 2, full = HL_HEAD_W * w;
        const hw = small + (full - small) * k, hh = hw * (BALL_RY / BALL_RX);
        ctx.save();
        ctx.translate((HL_HEAD_U - 0.5) * w, (HL_HEAD_V - 0.5) * h);
        ctx.rotate(HL_HEAD_TILT * k);
        if (sx < 0) ctx.scale(-1, 1);
        ctx.drawImage(ballImg, -hw / 2, -hh / 2, hw, hh);
        ctx.restore();
    }

    function hlDraw(b) {
        const sp = hlSprite('raw');
        if (!sp) return;
        const o = b.jt > 0 ? wobble(b.jt) * JIG_BRICK : 0;
        ctx.save();
        ctx.translate(b.x + b.jnx * o + bw / 2, b.y + b.jny * o + bh / 2);
        if (b.wigA) ctx.rotate(b.wigA);
        ctx.scale(hlScaleX(), 1);
        ctx.drawImage(sp, -bw / 2, -bh / 2, bw, bh);
        if (b.flash > 0) {
            ctx.globalAlpha = Math.min(1, b.flash) * 0.7;
            ctx.drawImage(hlSprite('flash'), -bw / 2, -bh / 2, bw, bh);
            ctx.globalAlpha = 1;
        }
        if (hl.held) hlDrawHead(bw, hl.don, hlScaleX());
        ctx.restore();
        if (LAB.zone) hlDrawZone(b);

        // his health, where the original wears his
        const grow = phase === 'entrance' ? enterK() : 1;
        if (grow <= 0.001) return;
        const barW = Math.min(bw * 0.72, LW - 120) * grow;
        labBar(Math.max(12, Math.min(LW - 12 - barW, b.x + bw / 2 - barW / 2)), Math.max(10, b.y - 16),
               barW, b.hp / b.maxHp);
    }

    // lab only: the cells that catch, the cells that hurt, and where his collar
    // is headed
    function hlDrawZone(b) {
        const mask = hlMask(), f = hlFace();
        const cw = bw / MCOLS, ch = bh / MROWS;
        for (let r = 0; r < MROWS; r++) {
            for (let c = 0; c < MCOLS; c++) {
                const own = f > 0 ? c : MCOLS - 1 - c;
                if (!mask[r][own]) continue;
                ctx.fillStyle = (own + 0.5) / MCOLS >= 1 - HL_NECK
                    ? 'rgba(207,107,78,0.42)' : 'rgba(111,175,58,0.16)';
                ctx.fillRect(b.x + c * cw + 1, b.y + r * ch + 1, cw - 2, ch - 2);
            }
        }
        const tx = hl.tx + hl.face * hlReach();
        ctx.strokeStyle = '#cf6b4e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(tx, b.y + bh + 4);
        ctx.lineTo(tx, b.y + bh + 24);
        ctx.stroke();
    }

    // The takeover's first beat, his way: the same hold, drain and sag as the
    // original, then the same peel, boot first and face last -- only it is
    // your head that goes last.
    function hlDrawFall() {
        const c = bossFall;
        if (!c) return;
        const wilt = Math.max(0, Math.min(1, ascendT / A_DIE));
        const e = wilt * wilt * (3 - 2 * wilt);
        const sag = e * F_SAG, lean = e * F_LEAN;
        ctx.save();
        if (hl.face < 0) { ctx.translate(c.x, 0); ctx.scale(-1, 1); ctx.translate(-c.x, 0); }
        if (ascendT < A_DIE) {
            const sp = hlSprite('raw');
            if (sp) {
                const w = c.w, h = w / SHAPE_ASPECT;
                ctx.translate(c.x, c.y + sag);
                ctx.rotate(lean);
                if (e > 0.001) ctx.filter = 'grayscale(' + e.toFixed(3) + ')';
                ctx.drawImage(sp, -w / 2, -h / 2, w, h);
                hlDrawHead(w, 1, 1);
                ctx.filter = 'none';
            }
        } else {
            c.sprite = hlSprite('grey');
            drawCrumble(c, sag, lean, true);
        }
        ctx.restore();
    }