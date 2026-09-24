'use strict';

    // ---- IDOL (boss) --------------------------------------------------------------
    // His head as a stone monument, hung at the top the way Doh hangs at the
    // end of Arkanoid. ball.webp is only 141 x 209, so a photograph of a head
    // goes soft past about twice that -- but stone is a flat material and hides
    // it, so he can be enormous. Every hit knocks stone off his face and the
    // photograph shows through. Only a hit on bare face hurts him, and the stone
    // creeps back over whatever is open, so the fight is putting the next head
    // where the last one went. A spinning head takes a bigger bite, so the SPIN
    // rule under BONUS reads how much the next hit will knock off. His face is
    // a curve, so anything off its middle comes back at a slant.
    //
    // He wanders along the top, slowly, to places of his own choosing. Every
    // so often he shakes for IDOL_SHAKE and then drops like the stone he is,
    // all the way to the floor. Land on your middle and he pins you where you
    // stand until he rises again, IDOL_DOWN later and slowly; land on your
    // end and he only shoves you aside. Down there he is a
    // wall: you cannot get past him, and nor can the ball, so whichever side
    // of him you are on is the side you play from until he goes back up.
    let IDOL_HP        = 10;     // hits on bare face to finish him
    let IDOL_W         = 290;    // how wide he is
    let IDOL_Y         = 105;    // where his middle hangs; his crown is off the top
    let IDOL_BITE      = 40;     // px round where a head lands that its stone comes off
    let IDOL_SPIN      = 1;      // ...and this much bigger again at max-bonus spin
    let IDOL_BARE      = 0.3;    // stone at or under this is bare face
    let IDOL_REGROW_AT = 5;      // seconds bare before the stone starts back
    let IDOL_REGROW    = 0.4;    // ...and how fast it comes, in whole blocks a second
    let IDOL_WALK      = 45;     // px/s he wanders at
    let IDOL_WAIT_MIN  = 1.5;    // seconds he heads for one place before picking another, at least...
    let IDOL_WAIT_MAX  = 4.5;    // ...and at most
    let IDOL_DROP_MIN  = 7;      // seconds between drops, at least...
    let IDOL_DROP_MAX  = 13;     // ...and at most
    let IDOL_SHAKE     = 3;      // the shaking before a drop, which is the tell
    let IDOL_SHAKE_PX  = 5;      // ...and how hard
    let IDOL_G         = 2600;   // px/s^2 he falls at
    let IDOL_DOWN      = 3;      // seconds he stays down
    let IDOL_RISE      = 75;     // px/s he goes back up at
    let IDOL_CLIMB     = 0.4;    // how much of the original's climb this fight has
    // The act a run draws him from, 1 easy to 3 hard. The drop is his only
    // attack and it is telegraphed, and at Paul's numbers a bite stays open
    // for several returns, so what he mostly asks for is aim.
    let IDOL_LVL       = 2;
    LAB_KNOBS.push('IDOL_LVL', 'IDOL_HP', 'IDOL_W', 'IDOL_Y', 'IDOL_BITE', 'IDOL_SPIN',
                   'IDOL_BARE', 'IDOL_REGROW_AT', 'IDOL_REGROW', 'IDOL_WALK', 'IDOL_WAIT_MIN',
                   'IDOL_WAIT_MAX', 'IDOL_DROP_MIN', 'IDOL_DROP_MAX', 'IDOL_SHAKE', 'IDOL_SHAKE_PX',
                   'IDOL_G', 'IDOL_DOWN', 'IDOL_RISE', 'IDOL_CLIMB');

    const IDOL_COLS = 12, IDOL_ROWS = 18;    // his stone, in blocks
    const IDOL_N = IDOL_COLS * IDOL_ROWS;

    let idol = null;

    LAB_BOSS.idol = {
        start(b) {
            bw = IDOL_W;
            bh = bw * (BALL_RY / BALL_RX);
            b.hp = b.maxHp = IDOL_HP;
            b.x = (LW - bw) / 2;
            b.y = -(bh + 40);
            idol = { stone: new Float32Array(IDOL_N).fill(1), wait: new Float32Array(IDOL_N),
                     inside: new Uint8Array(IDOL_N), chips: [], t: 0, pend: null, bites: 0,
                     x: LW / 2, tx: LW / 2, wander: IDOL_WAIT_MIN, cy: IDOL_Y,
                     stage: 'idle', st: 0, vy: 0, jx: 0, pin: null, side: 0, drops: 0,
                     next: IDOL_DROP_MIN + Math.random() * (IDOL_DROP_MAX - IDOL_DROP_MIN) };
            for (let r = 0; r < IDOL_ROWS; r++) {
                for (let c = 0; c < IDOL_COLS; c++) {
                    const du = (c + 0.5) / IDOL_COLS - 0.5, dv = (r + 0.5) / IDOL_ROWS - 0.5;
                    idol.inside[r * IDOL_COLS + c] = du * du * 4 + dv * dv * 4 <= 1.02 ? 1 : 0;
                }
            }
        },
        reset() { idol = null; },
        update(b, dt) {
            bw = IDOL_W;
            bh = bw * (BALL_RY / BALL_RX);
            if (phase === 'entrance') {
                const raw = enterK(), k = raw * raw * (3 - 2 * raw);
                const from = -(bh + 40);
                b.x = (LW - bw) / 2;
                b.y = from + (IDOL_Y - bh / 2 - from) * k;
                return;
            }
            if (phase === 'play') idol.t += dt;
            idolMove(dt);
            b.x = idol.x + idol.jx - bw / 2;
            b.y = idol.cy - bh / 2;
            // the stone creeping back over whatever has been bare long enough
            if (phase === 'play') {
                for (let i = 0; i < IDOL_N; i++) {
                    if (idol.stone[i] >= 1 || !idol.inside[i]) continue;
                    if ((idol.wait[i] += dt) >= IDOL_REGROW_AT) idol.stone[i] = Math.min(1, idol.stone[i] + IDOL_REGROW * dt);
                }
            }
            idol.chips = idol.chips.filter(c => clock - c.t0 < c.life);
        },
        contact(br, ball) {
            const hit = ellipseContact(ball, br.x + bw / 2, br.y + bh / 2, bw / 2, bh / 2);
            idol.pend = hit ? { bare: idolStoneAt(br, hit.cx, hit.cy) <= IDOL_BARE } : null;
            return hit;
        },
        // falling, he only knocks the ball down ahead of him: no chip, no wound
        touch(br, ball, hit) {
            if (idol.stage !== 'fall') return false;
            labBounce(ball, hit);
            ball.vy = Math.abs(ball.vy);
            idol.pend = null;
            return true;
        },
        fence: idolFence,
        // stone clacks like a statue; bare face flashes like any boss
        glances() { return !idol.pend || !idol.pend.bare || bossIF > 0; },
        hit(b, cx, cy) {
            const p = idol.pend;
            idol.pend = null;
            if (!p) return;
            if (!p.bare) {
                // the same number the rule under BONUS is filled from
                const k = Math.max(0, Math.min(1, (liveSpinMul() - 1) / (SPIN_MUL - 1)));
                idolChip(b, cx, cy, IDOL_BITE * (1 + IDOL_SPIN * k));
                return;
            }
            if (bossIF > 0) return;
            b.flash = 1;
            bossIF = BOSS_IF;
            b.hp = Math.max(0, b.hp - 1);
            bossHits++;
            const done = b.hp <= 1e-6;
            award(BOSS_PTS * (done ? 5 : 1), cx, cy);
            // the hole he was hit through stays open a little longer
            idolEach(b, cx, cy, IDOL_BITE, i => { idol.wait[i] = Math.min(idol.wait[i], 0); });
            if (done) { idolDie(b); return; }
            if (bossHits % BOSS_CAP === 0 && !capsule) {
                const pool = capsulePool();
                capsule = { x: cx, y: cy, kind: pool[(Math.random() * pool.length) | 0] };
            }
            if (++hits === 4 || hits === 12) bumpSpeed(1.12);
        },
        draw: idolDraw,
        drawFall() { labHeadFall(idolDrawChips); },
        climb() { return IDOL_CLIMB; },
        finish(b) {
            b.hp = Math.min(b.hp, 1);
            idol.stone.fill(0);
            idol.wait.fill(-4);                 // and it stays off a while
            return true;
        },
        state(b) {
            let n = 0, bare = 0;
            for (let i = 0; i < IDOL_N; i++) {
                if (!idol.inside[i]) continue;
                n++;
                if (idol.stone[i] <= IDOL_BARE) bare++;
            }
            return { name: 'IDOL', hp: b.hp, max: b.maxHp, w: bw,
                     line: 'bare ' + Math.round(100 * bare / n) + '% of his face · ' + idol.bites + ' bites · ' +
                           idol.stage + (idol.pin ? ', pinning you' : '') + ' · ' + idol.drops + ' drops' };
        }
    };

    const idolRand = (a, b) => a + Math.random() * (b - a);

    // Wandering while he is up; the shake, the drop, the wait and the climb
    // back otherwise. The cycle runs through a lost head and a serve like
    // anything that is already falling would, and only a rally starts one.
    function idolMove(dt) {
        const h = bw * (BALL_RY / BALL_RX);
        idol.jx = 0;
        switch (idol.stage) {
            case 'idle': {
                if ((idol.wander -= dt) <= 0) {
                    idol.tx = idolRand(bw / 2 + 20, LW - bw / 2 - 20);
                    idol.wander = idolRand(IDOL_WAIT_MIN, IDOL_WAIT_MAX);
                }
                // easing in to where he is going, so he settles rather than stops
                const d = idol.tx - idol.x;
                const v = Math.sign(d) * IDOL_WALK * Math.min(1, Math.abs(d) / 40);
                idol.x += Math.abs(v * dt) > Math.abs(d) ? d : v * dt;
                if (phase === 'play' && (idol.next -= dt) <= 0) { idol.stage = 'shake'; idol.st = 0; }
                break;
            }
            case 'shake':
                idol.st += dt;
                // a tremor that builds, not a strobe: he moves, nothing flashes
                idol.jx = Math.sin(idol.st * 55) * IDOL_SHAKE_PX * Math.min(1, idol.st / 0.6);
                if (idol.st >= IDOL_SHAKE) { idol.stage = 'fall'; idol.vy = 0; idol.drops++; }
                break;
            case 'fall': {
                idol.vy += IDOL_G * dt;
                idol.cy += idol.vy * dt;
                const floor = padY() + padH() / 2 + 6;
                // Your middle under where he will land: he stops where he met
                // you, and you are his until he rises. Anything less is a
                // graze, and he shoves you out to the side you were on
                // (idolFence) on his way down. Judged on his footprint on the
                // floor, because the slice of him at your height starts at
                // nothing and grows, and a middle is never under it at first.
                const c = idolChord();
                if (c && Math.abs(paddle.x - idol.x) < idolChord(floor - h / 2)) {
                    idol.pin = { x: paddle.x };
                    idolLand();
                } else if (c && idolOver() > 0 && !idol.side) {
                    idol.side = paddle.x < idol.x ? -1 : 1;
                }
                if (idol.stage === 'fall' && idol.cy + h / 2 >= floor) {
                    idol.cy = floor - h / 2;
                    idolLand();
                }
                break;
            }
            case 'down':
                if ((idol.st += dt) >= IDOL_DOWN) {
                    idol.stage = 'rise';
                    idol.pin = null;
                    idol.side = 0;          // he may be over you: no fence until you are clear
                }
                break;
            case 'rise':
                idol.cy = Math.max(IDOL_Y, idol.cy - IDOL_RISE * dt);
                if (idol.cy <= IDOL_Y) {
                    idol.stage = 'idle';
                    idol.next = idolRand(IDOL_DROP_MIN, IDOL_DROP_MAX);
                }
                break;
        }
    }

    function idolLand() {
        idol.stage = 'down';
        idol.st = 0;
        idol.vy = 0;
        // stone off his chin where he hit
        const b = bricks[0];
        b.x = idol.x - bw / 2;
        b.y = idol.cy - bw * (BALL_RY / BALL_RX) / 2;
        for (let c = 3; c < IDOL_COLS - 3; c++) idolDebris(b, (IDOL_ROWS - 2) * IDOL_COLS + c, 1);
    }

    // how far into the paddle's span his outline reaches across the band the
    // paddle lies in, or 0 if it does not: the widest chord of him in that band
    function idolChord(cy = idol.cy) {
        const a = bw / 2, e = bw * (BALL_RY / BALL_RX) / 2;
        const top = padY() - padH() / 2, bot = padY() + padH() / 2;
        const dy = Math.max(top, Math.min(bot, cy)) - cy;
        if (Math.abs(dy) >= e) return 0;
        return a * Math.sqrt(1 - (dy / e) * (dy / e));
    }
    function idolOver() {
        const c = idolChord();
        if (!c) return 0;
        const hs = halfSpan();
        return Math.min(paddle.x + hs, idol.x + c) - Math.max(paddle.x - hs, idol.x - c);
    }

    // After the paddle has moved: pinned, he stays put; otherwise, while any
    // of the IDOL is down in the paddle's band, he cannot cross it.
    function idolFence() {
        if (phase === 'entrance') return;
        const was = paddle.x;
        if (idol.pin) {
            paddle.x = idol.pin.x;
        } else {
            const c = idolChord();
            if (!c) { idol.side = 0; return; }
            const hs = halfSpan();
            if (!idol.side) {
                // clear of him now, so from here on this is your side
                if (idolOver() <= 0) idol.side = paddle.x < idol.x ? -1 : 1;
                return;
            }
            paddle.x = idol.side < 0 ? Math.min(paddle.x, idol.x - c - hs)
                                     : Math.max(paddle.x, idol.x + c + hs);
            paddle.x = Math.max(hs, Math.min(LW - hs, paddle.x));
        }
        if (paddle.x !== was) { paddle.prevX = paddle.x; paddle.vx = 0; }
    }

    // every block of his face within r of (x, y): fn(index, distance)
    function idolEach(b, x, y, r, fn) {
        const cw = bw / IDOL_COLS, ch = bh / IDOL_ROWS;
        for (let row = 0; row < IDOL_ROWS; row++) {
            for (let c = 0; c < IDOL_COLS; c++) {
                const i = row * IDOL_COLS + c;
                if (!idol.inside[i]) continue;
                const d = Math.hypot(b.x + (c + 0.5) * cw - x, b.y + (row + 0.5) * ch - y);
                if (d < r) fn(i, d);
            }
        }
    }

    // how much stone is over the point a head met him at: the block it is in,
    // or the nearest one of his face if it landed on the corner of one outside
    function idolStoneAt(b, x, y) {
        let best = 1, near = Infinity;
        idolEach(b, x, y, Math.max(bw / IDOL_COLS, bh / IDOL_ROWS) * 1.2, (i, d) => {
            if (d < near) { near = d; best = idol.stone[i]; }
        });
        return best;
    }

    // a bite out of him: the middle of it bare, the edge of it thinned
    function idolChip(b, x, y, r) {
        idol.bites++;
        idolEach(b, x, y, r, (i, d) => {
            const was = idol.stone[i];
            idol.stone[i] = Math.max(0, was - (1 - d / r) * 1.6);
            idol.wait[i] = 0;
            if (was - idol.stone[i] > 0.25) idolDebris(b, i, 1 + (Math.random() < 0.5 ? 1 : 0));
        });
    }

    // a flake of stone off block i, falling on its own clock
    function idolDebris(b, i, n) {
        const c = i % IDOL_COLS, r = (i / IDOL_COLS) | 0;
        const cw = bw / IDOL_COLS, ch = bh / IDOL_ROWS;
        for (let k = 0; k < n; k++) {
            idol.chips.push({ x0: b.x + (c + Math.random()) * cw, y0: b.y + (r + Math.random()) * ch,
                              vx: (Math.random() - 0.5) * 120, vy: -40 - Math.random() * 80,
                              s: 3 + Math.random() * 5, t0: clock, life: 1.4 + Math.random() * 0.6 });
        }
    }

    function idolDrawChips() {
        ctx.fillStyle = STONE_RIM;
        for (const c of idol.chips) {
            const t = clock - c.t0;
            ctx.globalAlpha = Math.max(0, 1 - t / c.life);
            ctx.fillRect(c.x0 + c.vx * t - c.s / 2, c.y0 + c.vy * t + 450 * t * t - c.s / 2, c.s, c.s);
        }
        ctx.globalAlpha = 1;
    }

    function idolDie(b) {
        // whatever stone is left comes off him
        for (let i = 0; i < IDOL_N; i++) if (idol.inside[i] && idol.stone[i] > 0.1) idolDebris(b, i, 1);
        idol.stone.fill(0);
        b.alive = false;
        clearStage();
        labHeadDied(b.x + bw / 2, b.y + bh / 2, bw);
    }

    function idolDraw(b) {
        const o = b.jt > 0 ? wobble(b.jt) * JIG_BRICK * 0.5 : 0;   // he barely gives when struck
        const x = b.x + b.jnx * o, y = b.y + b.jny * o, w = bw, h = bh;
        const rim = headSprite2('flat', STONE_RIM), stone = headSprite2('stone');
        if (!rim || !stone) return;
        // the pale stone round the outside of him, the statues' mark
        const m = STONE_RIM_W * 1.6;
        ctx.drawImage(rim, x - m, y - m * h / w, w + 2 * m, h + 2 * m * h / w);
        // the photograph, under everything
        ctx.drawImage(ballImg, x, y, w, h);
        // and the stone over it, block by block
        const cw = w / IDOL_COLS, ch = h / IDOL_ROWS;
        const sw = stone.width / IDOL_COLS, sh = stone.height / IDOL_ROWS;
        for (let r = 0; r < IDOL_ROWS; r++) {
            for (let c = 0; c < IDOL_COLS; c++) {
                const s = idol.stone[r * IDOL_COLS + c];
                if (s <= 0.01) continue;
                ctx.globalAlpha = Math.min(1, Math.pow(s, 1.3));
                ctx.drawImage(stone, c * sw, r * sh, sw, sh, x + c * cw, y + r * ch, cw + 0.5, ch + 0.5);
            }
        }
        ctx.globalAlpha = 1;
        if (b.flash > 0) {
            ctx.globalAlpha = Math.min(1, b.flash) * 0.7;
            ctx.drawImage(headSprite2('flat', '#f2efe9'), x, y, w, h);
            ctx.globalAlpha = 1;
        }
        idolDrawChips();
        // his crown is off the top of the screen, so his health runs along it
        const grow = phase === 'entrance' ? enterK() : 1;
        if (grow > 0.001) labBar(LW / 2 - 150 * grow, 10, 300 * grow, b.hp / b.maxHp);
    }