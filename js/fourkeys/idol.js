'use strict';

    // ---- IDOL (boss) --------------------------------------------------------------
    // His head as a stone monument, hung at the top the way Doh hangs at the
    // end of Arkanoid. ball.webp is only 141 x 209, so a photograph of a head
    // goes soft past about twice that -- but stone is a flat material and hides
    // it, so he can be enormous. Every hit knocks stone off his face and the
    // photograph shows through. Only a hit on bare face hurts him, and the stone
    // creeps back over whatever is open, so the fight is putting the next head
    // where the last one went. A spinning head takes a bigger bite, so the SPIN
    // rule under BONUS reads how much the next hit will knock off. He has no
    // attack: his face is a curve, so anything off its middle comes back at a slant.
    let IDOL_HP        = 10;     // hits on bare face to finish him
    let IDOL_W         = 290;    // how wide he is
    let IDOL_Y         = 105;    // where his middle hangs; his crown is off the top
    let IDOL_BITE      = 40;     // px round where a head lands that its stone comes off
    let IDOL_SPIN      = 1;      // ...and this much bigger again at max-bonus spin
    let IDOL_BARE      = 0.3;    // stone at or under this is bare face
    let IDOL_REGROW_AT = 5;      // seconds bare before the stone starts back
    let IDOL_REGROW    = 0.4;    // ...and how fast it comes, in whole blocks a second
    let IDOL_SWAY      = 24;     // px he drifts either side
    let IDOL_CLIMB     = 0.4;    // how much of the original's climb this fight has
    // The act a run draws him from, 1 easy to 3 hard. He has no attack and, at
    // Paul's numbers, a bite stays open for several returns, so the only thing
    // he asks for is aim.
    let IDOL_LVL       = 2;
    LAB_KNOBS.push('IDOL_LVL', 'IDOL_HP', 'IDOL_W', 'IDOL_Y', 'IDOL_BITE', 'IDOL_SPIN',
                   'IDOL_BARE', 'IDOL_REGROW_AT', 'IDOL_REGROW', 'IDOL_SWAY', 'IDOL_CLIMB');

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
                     inside: new Uint8Array(IDOL_N), chips: [], t: 0, pend: null, bites: 0 };
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
            b.x = LW / 2 + Math.sin(idol.t * 0.35) * IDOL_SWAY - bw / 2;
            b.y = IDOL_Y - bh / 2;
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
                     line: 'bare ' + Math.round(100 * bare / n) + '% of his face · ' + idol.bites + ' bites' };
        }
    };

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