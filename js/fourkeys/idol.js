'use strict';

    // ---- IDOL (boss) --------------------------------------------------------------
    // His head as a stone monument, hung at the top the way Doh hangs at the
    // end of Arkanoid. ball.webp is only 141 x 209, so a photograph of a head
    // goes soft past about twice that -- but stone is a flat material and hides
    // it, so he can be enormous. His face is in two coats, both of them old:
    // weathered stone blocks over the top, and under them rough rubble, older
    // still. A hit on the stone knocks a block's worth off; a hit on the
    // rubble clears a patch nearly as wide, all the way through; and only a
    // hit on the photograph under both hurts him. Nothing grows back,
    // so every bite is progress, and the fight is digging one hole deep
    // rather than scraping the whole face.
    //
    // A head only ever meets the edge of him, so on its own that would leave
    // the middle of his face covered to the end. Hits on him close together
    // make a streak, and every bite in a streak after the first cracks the
    // coat it struck inward from where it landed, toward the middle of him --
    // IDOL_CRACK further for each hit in the streak. A long rally splits him
    // open; a lost head or a pause of IDOL_STREAK_GAP starts it over.
    //
    // A spinning head takes a bigger
    // bite, so the SPIN rule under BONUS reads how much the next hit will
    // knock off. His face is a curve, so anything off its middle comes back
    // at a slant.
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
    let IDOL_BRICK     = 0.8;    // ...and the rubble under it, as a share of that
    let IDOL_BRICK_DIG = 3;      // how much harder a bite goes into the rubble than the stone
    let IDOL_CRACK     = 22;     // px a crack runs inward, per hit in the streak after the first
    let IDOL_CRACK_MAX = 200;    // ...and at most
    let IDOL_CRACK_W   = 13;     // px either side of its line a crack clears
    let IDOL_STREAK_GAP = 4;     // seconds between hits before the streak is lost
    let IDOL_SPIN      = 1;      // ...and this much bigger again at max-bonus spin
    let IDOL_BARE      = 0.3;    // a coat at or under this is gone
    let IDOL_WALK      = 45;     // px/s he wanders at
    let IDOL_WAIT_MIN  = 1.5;    // seconds he heads for one place before picking another, at least...
    let IDOL_WAIT_MAX  = 4.5;    // ...and at most
    let IDOL_DROP_MIN  = 7;      // seconds between drops, at least...
    let IDOL_DROP_MAX  = 13;     // ...and at most
    let IDOL_SHAKE     = 3;      // the shaking before a drop, which is the tell
    let IDOL_SHAKE_PX  = 5;      // ...and how hard
    let IDOL_G         = 2600;   // px/s^2 he falls at
    let IDOL_DOWN      = 3;      // seconds he stays down
    let IDOL_RISE      = 150;    // px/s he goes back up at
    let IDOL_CLIMB     = 0.4;    // how much of the original's climb this fight has
    // The act a run draws him from, 1 easy to 3 hard. The drop is his only
    // attack and it is telegraphed, and at Paul's numbers a bite stays open
    // for several returns, so what he mostly asks for is aim.
    let IDOL_LVL       = 2;
    LAB_KNOBS.push('IDOL_LVL', 'IDOL_HP', 'IDOL_W', 'IDOL_Y', 'IDOL_BITE', 'IDOL_SPIN',
                   'IDOL_BRICK', 'IDOL_BRICK_DIG', 'IDOL_CRACK', 'IDOL_CRACK_MAX', 'IDOL_CRACK_W',
                   'IDOL_STREAK_GAP', 'IDOL_BARE', 'IDOL_WALK', 'IDOL_WAIT_MIN',
                   'IDOL_WAIT_MAX', 'IDOL_DROP_MIN', 'IDOL_DROP_MAX', 'IDOL_SHAKE', 'IDOL_SHAKE_PX',
                   'IDOL_G', 'IDOL_DOWN', 'IDOL_RISE', 'IDOL_CLIMB');

    // His two coats, each a grid of how much of it is left over each cell.
    // The rubble's cells are half the stone's, so its holes can be finer.
    // `ink` is its chips' colour; `seed` keeps its pattern the same every run.
    const IDOL_STONE = { cols: 12, rows: 18, ink: '#9c937f', kind: 'ashlar', seed: 7 };
    const IDOL_BRICKS = { cols: 24, rows: 36, ink: '#7a6a55', kind: 'rubble', seed: 19 };

    let idol = null;

    LAB_BOSS.idol = {
        start(b) {
            bw = IDOL_W;
            bh = bw * (BALL_RY / BALL_RX);
            b.hp = b.maxHp = IDOL_HP;
            b.x = (LW - bw) / 2;
            b.y = -(bh + 40);
            idol = { stone: idolCoat(IDOL_STONE), brick: idolCoat(IDOL_BRICKS), chips: [], t: 0, pend: null, bites: 0, streak: 0, lastHit: -99,
                     x: LW / 2, tx: LW / 2, wander: IDOL_WAIT_MIN, cy: IDOL_Y,
                     stage: 'idle', st: 0, vy: 0, jx: 0, pin: null, side: 0, drops: 0,
                     next: IDOL_DROP_MIN + Math.random() * (IDOL_DROP_MAX - IDOL_DROP_MIN) };
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
            // a head lost, or too long between hits, and the streak is gone
            if (phase !== 'play' || idol.t - idol.lastHit > IDOL_STREAK_GAP) idol.streak = 0;
            idolMove(dt);
            b.x = idol.x + idol.jx - bw / 2;
            b.y = idol.cy - bh / 2;
            idol.chips = idol.chips.filter(c => clock - c.t0 < c.life);
        },
        contact(br, ball) {
            const hit = ellipseContact(ball, br.x + bw / 2, br.y + bh / 2, bw / 2, bh / 2);
            // which coat it met: the stone if there is any, else the rubble, else him
            if (!hit) idol.pend = null;
            else if (idolAt(idol.stone, br, hit.cx, hit.cy) > IDOL_BARE) idol.pend = { coat: idol.stone };
            else if (idolAt(idol.brick, br, hit.cx, hit.cy) > IDOL_BARE) idol.pend = { coat: idol.brick };
            else idol.pend = { bare: true };
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
                const low = p.coat === idol.brick;
                const r = IDOL_BITE * (1 + IDOL_SPIN * k) * (low ? IDOL_BRICK : 1);
                idolChip(b, p.coat, cx, cy, r, low ? IDOL_BRICK_DIG : 1);
                idolStreak();
                if (idol.streak > 1) {
                    idolCrack(b, p.coat, cx, cy, Math.min(IDOL_CRACK_MAX, IDOL_CRACK * (idol.streak - 1)),
                              low ? IDOL_BRICK_DIG : 1);
                }
                return;
            }
            if (bossIF > 0) return;
            idolStreak();                  // a wound keeps the streak going too
            b.flash = 1;
            bossIF = BOSS_IF;
            b.hp = Math.max(0, b.hp - 1);
            bossHits++;
            const done = b.hp <= 1e-6;
            award(BOSS_PTS * (done ? 5 : 1), cx, cy);
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
            idol.stone.v.fill(0);
            idol.brick.v.fill(0);
            return true;
        },
        state(b) {
            const gone = coat => {
                let n = 0, g = 0;
                for (let i = 0; i < coat.v.length; i++) if (coat.inside[i]) { n++; if (coat.v[i] <= IDOL_BARE) g++; }
                return Math.round(100 * g / n);
            };
            const bare = gone(idol.brick);
            return { name: 'IDOL', hp: b.hp, max: b.maxHp, w: bw,
                     line: 'stone ' + gone(idol.stone) + '% off, rubble ' + bare + '% off · ' + idol.bites + ' bites · streak ' + idol.streak + ' · ' +
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
        const st = idol.stone;
        for (let c = 3; c < st.g.cols - 3; c++) idolDebris(b, st, (st.g.rows - 2) * st.g.cols + c, 1);
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

    // A coat: how much of it is left over each cell of its grid, and which
    // cells are on his face at all.
    function idolCoat(g) {
        const n = g.cols * g.rows;
        const coat = { g, v: new Float32Array(n).fill(1), inside: new Uint8Array(n) };
        for (let r = 0; r < g.rows; r++) {
            for (let c = 0; c < g.cols; c++) {
                const du = (c + 0.5) / g.cols - 0.5, dv = (r + 0.5) / g.rows - 0.5;
                coat.inside[r * g.cols + c] = du * du * 4 + dv * dv * 4 <= 1.02 ? 1 : 0;
            }
        }
        return coat;
    }

    // every cell of a coat within r of (x, y): fn(index, distance)
    function idolEach(coat, b, x, y, r, fn) {
        const g = coat.g, cw = bw / g.cols, ch = bh / g.rows;
        for (let row = 0; row < g.rows; row++) {
            for (let c = 0; c < g.cols; c++) {
                const i = row * g.cols + c;
                if (!coat.inside[i]) continue;
                const d = Math.hypot(b.x + (c + 0.5) * cw - x, b.y + (row + 0.5) * ch - y);
                if (d < r) fn(i, d);
            }
        }
    }

    // how much of a coat is over the point a head met him at: the cell it is
    // in, or the nearest one on his face if it landed on the corner of one outside
    function idolAt(coat, b, x, y) {
        let best = 1, near = Infinity;
        idolEach(coat, b, x, y, Math.max(bw / coat.g.cols, bh / coat.g.rows) * 1.2, (i, d) => {
            if (d < near) { near = d; best = coat.v[i]; }
        });
        return best;
    }

    // a bite out of a coat: the middle of it gone, the edge of it thinned
    function idolStreak() {
        idol.streak++;
        idol.lastHit = idol.t;
    }

    // A crack from where a head struck, in toward the middle of his face,
    // wandering a little as it goes: every cell of the coat along it cleared.
    function idolCrack(b, coat, x, y, len, dig) {
        const mx = b.x + bw / 2, my = b.y + bh / 2;
        let ang = Math.atan2(my - y, mx - x);
        const step = IDOL_CRACK_W * 0.6;
        let px = x, py = y;
        for (let d = 0; d < len; d += step) {
            ang += (Math.random() - 0.5) * 0.5;
            px += Math.cos(ang) * step;
            py += Math.sin(ang) * step;
            idolEach(coat, b, px, py, IDOL_CRACK_W, (i, dd) => {
                const was = coat.v[i];
                coat.v[i] = Math.max(0, was - (1 - dd / IDOL_CRACK_W) * 2 * dig);
                if (was - coat.v[i] > 0.4 && Math.random() < 0.3) idolDebris(b, coat, i, 1);
            });
        }
    }

    function idolChip(b, coat, x, y, r, dig = 1) {
        idol.bites++;
        idolEach(coat, b, x, y, r, (i, d) => {
            const was = coat.v[i];
            coat.v[i] = Math.max(0, was - (1 - d / r) * 1.6 * dig);
            if (was - coat.v[i] > 0.25) idolDebris(b, coat, i, 1 + (Math.random() < 0.5 ? 1 : 0));
        });
    }

    // a flake off cell i of a coat, in its colour, falling on its own clock
    function idolDebris(b, coat, i, n) {
        const g = coat.g, c = i % g.cols, r = (i / g.cols) | 0;
        const cw = bw / g.cols, ch = bh / g.rows;
        const big = coat === idol.stone ? 1 : 0.6;
        for (let k = 0; k < n; k++) {
            idol.chips.push({ x0: b.x + (c + Math.random()) * cw, y0: b.y + (r + Math.random()) * ch,
                              vx: (Math.random() - 0.5) * 120, vy: -40 - Math.random() * 80, ink: g.ink,
                              s: (3 + Math.random() * 5) * big, t0: clock, life: 1.4 + Math.random() * 0.6 });
        }
    }

    function idolDrawChips() {
        for (const c of idol.chips) {
            const t = clock - c.t0;
            ctx.globalAlpha = Math.max(0, 1 - t / c.life);
            ctx.fillStyle = c.ink;
            ctx.fillRect(c.x0 + c.vx * t - c.s / 2, c.y0 + c.vy * t + 450 * t * t - c.s / 2, c.s, c.s);
        }
        ctx.globalAlpha = 1;
    }

    function idolDie(b) {
        // whatever is left of both coats comes off him
        for (const coat of [idol.stone, idol.brick]) {
            for (let i = 0; i < coat.v.length; i++) if (coat.inside[i] && coat.v[i] > 0.1 && Math.random() < 0.5) idolDebris(b, coat, i, 1);
            coat.v.fill(0);
        }
        b.alive = false;
        clearStage();
        labHeadDied(b.x + bw / 2, b.y + bh / 2, bw);
    }

    // A coat's texture, baked once at the head's own size and cut to his
    // shape, then a faint pass of his own shading over it so it still reads
    // as his face. Both are ruins, not building work: no grid and no straight
    // mortar. The stone is courses of uneven height made of blocks of uneven
    // length, each its own weathered shade, joints drawn by hand, corners
    // chipped, cracks across some and moss in others. The rubble under it is
    // rounded fieldstones, darker and warmer, packed any old how.
    const idolBakes = {};
    const IDOL_ASHLAR = ['#a39a86', '#968c78', '#aaa18c', '#8e8674', '#9d9483', '#8a8470'];
    const IDOL_RUBBLE = ['#7a6a55', '#6d5f4c', '#85735b', '#665846', '#8b7a61', '#71634f'];
    function idolTexture(g) {
        const key = g.kind;
        if (idolBakes[key]) return idolBakes[key];
        const flat = headSprite2('flat', '#000000');
        if (!flat) return null;
        const c = document.createElement('canvas');
        const W = c.width = flat.width, H = c.height = flat.height;
        const x = c.getContext('2d');
        let seed = g.seed * 7919 + 13;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        const jig = (v, a) => v + (rnd() - 0.5) * a;
        // a wobbly line from one point to another, as a chisel would leave it
        const wobble = (x0, y0, x1, y1, a) => {
            x.moveTo(x0, y0);
            for (let i = 1; i <= 4; i++) {
                const t = i / 4;
                x.lineTo(jig(x0 + (x1 - x0) * t, i < 4 ? a : 0), jig(y0 + (y1 - y0) * t, i < 4 ? a : 0));
            }
        };
        if (g.kind === 'ashlar') {
            x.fillStyle = '#4a443a';
            x.fillRect(0, 0, W, H);
            let y = 0;
            while (y < H) {
                const ch = H * (0.07 + rnd() * 0.06);
                let bx = -rnd() * W * 0.15;
                while (bx < W) {
                    const cw = W * (0.16 + rnd() * 0.22);
                    const tone = IDOL_ASHLAR[(rnd() * IDOL_ASHLAR.length) | 0];
                    x.fillStyle = tone;
                    x.beginPath();
                    x.moveTo(jig(bx + 2, 2), jig(y + 2, 2));
                    x.lineTo(jig(bx + cw - 2, 2), jig(y + 2, 2));
                    x.lineTo(jig(bx + cw - 2, 2), jig(y + ch - 2, 2));
                    x.lineTo(jig(bx + 2, 2), jig(y + ch - 2, 2));
                    x.closePath();
                    x.fill();
                    // light along its top, shade along its foot
                    x.fillStyle = 'rgba(255,246,228,0.16)';
                    x.fillRect(bx + 3, y + 3, cw - 6, 2);
                    x.fillStyle = 'rgba(30,26,20,0.22)';
                    x.fillRect(bx + 3, y + ch - 5, cw - 6, 3);
                    // weathering: a chipped corner, a crack, a bit of moss
                    if (rnd() < 0.35) {
                        x.fillStyle = '#4a443a';
                        const cx0 = rnd() < 0.5 ? bx + 2 : bx + cw - 2, cy0 = rnd() < 0.5 ? y + 2 : y + ch - 2;
                        const sx = cx0 === bx + 2 ? 1 : -1, sy = cy0 === y + 2 ? 1 : -1, n = 4 + rnd() * 7;
                        x.beginPath(); x.moveTo(cx0, cy0); x.lineTo(cx0 + sx * n, cy0); x.lineTo(cx0, cy0 + sy * n); x.fill();
                    }
                    if (rnd() < 0.3) {
                        x.strokeStyle = 'rgba(40,34,28,0.6)';
                        x.lineWidth = 1;
                        x.beginPath();
                        wobble(bx + cw * rnd(), y + 2, bx + cw * rnd(), y + ch - 2, 5);
                        x.stroke();
                    }
                    if (rnd() < 0.25) {
                        x.fillStyle = 'rgba(96,118,70,0.45)';
                        for (let m = 0; m < 10; m++) x.fillRect(bx + rnd() * cw, y + ch - 4 - rnd() * ch * 0.35, 2, 2);
                    }
                    bx += cw;
                }
                y += ch;
            }
        } else {
            x.fillStyle = '#3a3128';
            x.fillRect(0, 0, W, H);
            let y = 0;
            while (y < H + 10) {
                const rh = H * (0.035 + rnd() * 0.02);
                let bx = -rnd() * 10;
                while (bx < W + 10) {
                    const rw = rh * (1.2 + rnd() * 1.4);
                    const ex = bx + rw / 2, ey = y + rh / 2 + (rnd() - 0.5) * rh * 0.3;
                    x.fillStyle = IDOL_RUBBLE[(rnd() * IDOL_RUBBLE.length) | 0];
                    x.beginPath();
                    x.ellipse(ex, ey, rw / 2 - 1.5, rh / 2 - 1.2, (rnd() - 0.5) * 0.5, 0, Math.PI * 2);
                    x.fill();
                    // rounded: lit from the top left, in shadow to the bottom right
                    x.fillStyle = 'rgba(255,240,215,0.14)';
                    x.beginPath();
                    x.ellipse(ex - rw * 0.12, ey - rh * 0.15, rw * 0.28, rh * 0.22, 0, 0, Math.PI * 2);
                    x.fill();
                    x.fillStyle = 'rgba(20,16,12,0.22)';
                    x.beginPath();
                    x.ellipse(ex + rw * 0.1, ey + rh * 0.18, rw * 0.32, rh * 0.2, 0, 0, Math.PI * 2);
                    x.fill();
                    bx += rw;
                }
                y += rh;
            }
        }
        // his shading, faintly, and then cut to his shape
        x.globalAlpha = 0.18;
        x.globalCompositeOperation = 'overlay';
        x.drawImage(ballImg, 0, 0, W, H);
        x.globalAlpha = 1;
        x.globalCompositeOperation = 'destination-in';
        x.drawImage(flat, 0, 0);
        x.globalCompositeOperation = 'source-over';
        return (idolBakes[key] = c);
    }

    // a coat over him, cell by cell, each as solid as what is left of it
    function idolDrawCoat(coat, x, y, w, h) {
        const tex = idolTexture(coat.g);
        if (!tex) return;
        const g = coat.g, cw = w / g.cols, ch = h / g.rows;
        const sw = tex.width / g.cols, sh = tex.height / g.rows;
        for (let r = 0; r < g.rows; r++) {
            for (let c = 0; c < g.cols; c++) {
                const v = coat.v[r * g.cols + c];
                if (v <= 0.01) continue;
                ctx.globalAlpha = Math.min(1, Math.pow(v, 1.3));
                ctx.drawImage(tex, c * sw, r * sh, sw, sh, x + c * cw, y + r * ch, cw + 0.5, ch + 0.5);
            }
        }
        ctx.globalAlpha = 1;
    }

    function idolDraw(b) {
        const o = b.jt > 0 ? wobble(b.jt) * JIG_BRICK * 0.5 : 0;   // he barely gives when struck
        const x = b.x + b.jnx * o, y = b.y + b.jny * o, w = bw, h = bh;
        const rim = headSprite2('flat', STONE_RIM);
        if (!rim) return;
        // the pale stone round the outside of him, the statues' mark
        const m = STONE_RIM_W * 1.6;
        ctx.drawImage(rim, x - m, y - m * h / w, w + 2 * m, h + 2 * m * h / w);
        // the photograph, under everything
        ctx.drawImage(ballImg, x, y, w, h);
        // the rubble over it, and the stone over that
        idolDrawCoat(idol.brick, x, y, w, h);
        idolDrawCoat(idol.stone, x, y, w, h);
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