'use strict';

    // ---- SPLITTER (mini-boss) -------------------------------------------------------------
    // Pang's rule, with him for the balloons: one big brandon drifting about
    // the top of the field, and every hit splits him into two of half the size
    // that fly apart and drift faster, down to the smallest, which a hit pops.
    // Whether to split the big ones now or pick off the small ones first is
    // the decision: every split is one more thing in the air bouncing the ball
    // back at you. They wear the wall's ladder for how many splits they have
    // left -- gold, then silver, then slate for the ones that pop.
    let SPLIT_W      = 240;    // how long the first one is
    let SPLIT_LEVELS = 3;      // how many sizes, the first one's included
    let SPLIT_SPEED  = 70;     // px/s the first one drifts at
    let SPLIT_FASTER = 1.5;    // ...and each size down drifts this much faster
    let SPLIT_FLOOR  = 330;    // the lowest any of them comes, down from the top
    let SPLIT_GRACE  = 0.35;   // seconds a new half is see-through, and cannot be hit
    let SPLIT_PTS    = 60;     // a split; a pop pays three of these
    // The act a run draws him from, 1 easy to 3 hard. None of them can touch
    // you either; they only crowd the air and make the returns harder to read.
    let SPLIT_LVL    = 1;
    LAB_KNOBS.push('SPLIT_LVL', 'SPLIT_W', 'SPLIT_LEVELS', 'SPLIT_SPEED', 'SPLIT_FASTER',
                   'SPLIT_FLOOR', 'SPLIT_GRACE', 'SPLIT_PTS');

    let splitter = null;

    LAB_MINI.splitter = {
        start() {
            splitter = { pieces: [splitPiece(LW / 2, 130, 0, 1)], splits: 0, pops: 0 };
            return true;
        },
        reset() { splitter = null; },
        busy() { return !!splitter && splitter.pieces.length > 0; },
        update: splitUpdate,
        ballStep: splitBallStep,
        draw: splitDraw,
        finish() {
            if (!splitter || !splitter.pieces.length) return false;
            const p = splitter.pieces[0];
            splitter.pieces = [splitPiece(p.x, p.y, Math.max(0, Math.round(SPLIT_LEVELS) - 1), 1)];
            return true;
        },
        state() {
            return { name: 'SPLITTER', line: splitter.pieces.length + ' of him · split ' + splitter.splits +
                                             '× · popped ' + splitter.pops };
        }
    };

    function splitPiece(x, y, lvl, dir) {
        const w = SPLIT_W * Math.pow(0.5, lvl), sp = SPLIT_SPEED * Math.pow(SPLIT_FASTER, lvl);
        return { x, y, lvl, w, h: w / SHAPE_ASPECT, vx: dir * sp, vy: sp * 0.55,
                 flash: 0, grace: 0, mir: dir < 0 };
    }

    // how many more splits a piece has in it, as the wall's ladder
    function splitKind(p) {
        const left = Math.round(SPLIT_LEVELS) - 1 - p.lvl;
        return left >= 2 ? 'A' : left === 1 ? 'S' : 'S2';
    }

    function splitUpdate(dt) {
        if (!splitter) return;
        for (const p of splitter.pieces) {
            if (p.flash > 0) p.flash = Math.max(0, p.flash - dt * 6);
            if (p.grace > 0) p.grace = Math.max(0, p.grace - dt);
        }
        if (phase !== 'play') return;          // they hang still while you are waiting to serve
        for (const p of splitter.pieces) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.x - p.w / 2 < 0) { p.x = p.w / 2; p.vx = Math.abs(p.vx); }
            if (p.x + p.w / 2 > LW) { p.x = LW - p.w / 2; p.vx = -Math.abs(p.vx); }
            if (p.y - p.h / 2 < 8) { p.y = 8 + p.h / 2; p.vy = Math.abs(p.vy); }
            if (p.y + p.h / 2 > SPLIT_FLOOR) { p.y = SPLIT_FLOOR - p.h / 2; p.vy = -Math.abs(p.vy); }
            p.mir = p.vx < 0;                  // his head leads
        }
    }

    function splitBallStep(b) {
        if (!splitter) return;
        for (const p of splitter.pieces) {
            if (p.grace > 0) continue;
            const hit = maskContact(b, p.x, p.y, 0, p.w, p.h, MASK, p.mir);
            if (!hit) continue;
            labBounce(b, hit);
            splitHit(p, hit);
            return;
        }
    }

    function splitHit(p, hit) {
        const all = splitter.pieces;
        all.splice(all.indexOf(p), 1);
        if (p.lvl < Math.round(SPLIT_LEVELS) - 1) {
            // two of him, half the size, off in either direction and up
            for (const dir of [-1, 1]) {
                const q = splitPiece(p.x + dir * p.w / 4, p.y, p.lvl + 1, dir);
                q.vy = -Math.abs(q.vy);
                q.grace = SPLIT_GRACE;
                all.push(q);
            }
            splitter.splits++;
            award(SPLIT_PTS, hit.cx, hit.cy);
            return;
        }
        splitter.pops++;
        award(SPLIT_PTS * 3, hit.cx, hit.cy);
        maybeDropCapsule(p.x, p.y);
        if (!all.length) labClearIfDone();
    }

    function splitDraw() {
        if (!splitter) return;
        for (const p of splitter.pieces) {
            const kind = splitKind(p);
            const sp = shapeSprite('sp' + kind, brickColor(kind), p.w, p.h, false);
            if (!sp) continue;
            ctx.save();
            ctx.globalAlpha = p.grace > 0 ? 0.5 : 1;
            ctx.translate(p.x, p.y);
            if (p.mir) ctx.scale(-1, 1);
            ctx.drawImage(sp, -p.w / 2, -p.h / 2, p.w, p.h);
            if (p.flash > 0) {
                ctx.globalAlpha = Math.min(1, p.flash) * 0.75;
                ctx.drawImage(shapeSprite('flash', '#f2efe9', p.w, p.h, true), -p.w / 2, -p.h / 2, p.w, p.h);
            }
            ctx.restore();
        }
    }