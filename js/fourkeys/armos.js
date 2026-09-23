'use strict';

    // ---- ARMOS (mini-boss) -------------------------------------------------------
    // The hat stage's statues, which already walk off when a round is over,
    // step down and walk while you are still playing. Stone still cannot be
    // broken. But a statue can be put over: take one twice on the same end,
    // inside ARMOS_WINDOW, and it goes over and shatters. Hit the other end in
    // between and it rights itself. After the first hit it leans that way, so
    // the end that is loaded is the one you can see hanging.
    let ARMOS_LVL    = 2;
    let ARMOS_N      = 3;      // how many get up, where a stage has none of its own
    let ARMOS_SPEED  = 55;     // px/s they walk at
    let ARMOS_WINDOW = 2.2;    // seconds a loaded end stays loaded
    let ARMOS_LEAN   = 0.3;    // rad he hangs at once one end is loaded
    let ARMOS_FALL   = 0.45;   // seconds he takes to go over
    let ARMOS_PTS    = 150;    // one put over
    LAB_KNOBS.push('ARMOS_LVL', 'ARMOS_N', 'ARMOS_SPEED', 'ARMOS_WINDOW', 'ARMOS_LEAN',
                   'ARMOS_FALL', 'ARMOS_PTS');

    let armos = null;

    LAB_MINI.armos = {
        start() {
            // the stage's own statues if it has any, and a few of its own if not
            let stones = bricks.filter(b => b.alive && b.kind === 'X');
            if (!stones.length) {
                const n = Math.max(1, Math.round(ARMOS_N));
                for (let i = 0; i < n; i++) {
                    const b = newBrick(MARGIN + (i + 0.5) * (LW - 2 * MARGIN) / n - bw / 2,
                                       TOP + (i % 2) * (bh + GAP), 'X', 1);
                    bricks.push(b);
                    stones.push(b);
                }
            }
            for (const b of stones) {
                b.lab = true;
                b.armos = true;
                b.dir = Math.random() < 0.5 ? -1 : 1;
                b.end = 0;                 // which end is loaded, and since when
                b.endT = 0;
                b.lean = 0;
                b.over = 0;                // his fall, once he is going
                b.step = Math.random() * 6.283;
            }
            armos = { men: stones, over: 0, t: 0 };
            return true;
        },
        reset() { armos = null; },
        busy() { return !!armos && armos.men.some(b => b.alive); },
        update(dt) {
            if (!armos) return;
            armos.t += dt;
            for (const b of armos.men) {
                if (!b.alive) continue;
                if (b.over > 0) {
                    // going over, and then he is gone
                    b.over += dt;
                    if (b.over >= ARMOS_FALL) {
                        b.alive = false;
                        armos.over++;
                        shockwave(b);
                        award(ARMOS_PTS, b.x + bw / 2, b.y);
                        labClearIfDone();
                    }
                    continue;
                }
                if (b.end && (b.endT -= dt) <= 0) { b.end = 0; b.lean = 0; }
                if (phase !== 'play') continue;
                b.x += b.dir * ARMOS_SPEED * dt;
                if (b.x < MARGIN - bw / 2) { b.x = MARGIN - bw / 2; b.dir = 1; }
                if (b.x > LW - MARGIN - bw / 2) { b.x = LW - MARGIN - bw / 2; b.dir = -1; }
                b.step += dt * TODDLE_HZ * Math.PI * 2;
                b.lean = (b.end ? b.end * ARMOS_LEAN : 0) + Math.sin(b.step) * TODDLE_LEAN;
                b.wigA = b.lean;                    // what the ball meets, too
            }
        },
        hit(b, cx) {
            if (!b.armos || b.over > 0) return;
            const end = (cx === undefined ? b.x + bw / 2 : cx) < b.x + bw / 2 ? -1 : 1;
            if (b.end === end) {
                // the same end twice: over he goes
                b.over = 1e-6;
                b.lean = end * ARMOS_LEAN;
                return;
            }
            b.end = end;                            // loaded, and he hangs that way
            b.endT = ARMOS_WINDOW;
            kick(b, -end, 0, 1);
        },
        // stone: a hit that has not put him over rings like stone always has
        glances(br) { return !br.over; },
        drawBrick(b) {
            if (!b.armos) return false;
            const sp = statueSprite();
            if (!sp) return true;
            const m = STONE_RIM_PAD;
            const o = b.jt > 0 ? wobble(b.jt) * JIG_BRICK : 0;
            const k = b.over > 0 ? Math.min(1, b.over / ARMOS_FALL) : 0;
            ctx.save();
            ctx.globalAlpha = 1 - k * 0.9;
            ctx.translate(b.x + b.jnx * o + bw / 2, b.y + b.jny * o + bh / 2 + k * bh * 0.4);
            // over he goes, a quarter turn the way he was hanging
            ctx.rotate((b.lean || 0) + (b.end || 1) * k * Math.PI / 2);
            ctx.drawImage(sp, -bw / 2 - m, -bh / 2 - m, bw + 2 * m, bh + 2 * m);
            ctx.restore();
            ctx.globalAlpha = 1;
            return true;
        },
        finish() {
            const b = armos && armos.men.find(m => m.alive && !m.over);
            if (!b) return false;
            b.end = 1;
            b.endT = ARMOS_WINDOW;
            b.lean = ARMOS_LEAN;
            return true;
        },
        state() {
            const up = armos.men.filter(b => b.alive).length;
            const loaded = armos.men.filter(b => b.alive && b.end).length;
            return { name: 'ARMOS', line: up + ' still up · ' + loaded + ' leaning · ' + armos.over + ' put over' };
        }
    };