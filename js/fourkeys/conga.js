'use strict';

    // ---- CONGA (mini-boss) ------------------------------------------------------------
    // When a stage is down to its last several bricks, they get up, link head
    // to boot, and the line toddles across the field, coming down a notch at
    // each wall the way Centipede does. Only the one in front can be knocked
    // out. Hit any of the others and the whole line turns round, its back
    // becoming its front -- so a shot that misses the leader is how you steer,
    // turning the line until its front comes round to where you can reach it.
    // On an open field, a line of them walks on instead.
    let CONGA_AT    = 7;       // bricks left when they get up
    let CONGA_N     = 7;       // how many walk on to an open field
    let CONGA_SPEED = 80;      // px/s the front one walks at
    let CONGA_RUSH  = 0.12;    // ...and this share faster for every one knocked out
    let CONGA_DROP  = 46;      // px, a notch
    let CONGA_FLOOR = 330;     // the lowest the line comes, down from the top
    let CONGA_LINK  = 0.92;    // how far apart they walk, in body lengths
    let CONGA_FORM  = 1.2;     // seconds to get up out of the wall and into line
    let CONGA_TURN  = 0.25;    // seconds after a turn before a hit can turn them again
    // The act a run draws them from, 1 easy to 3 hard. They take your room
    // rather than your lives: the longer the line lives, the lower it walks.
    let CONGA_LVL   = 3;
    LAB_KNOBS.push('CONGA_LVL', 'CONGA_AT', 'CONGA_N', 'CONGA_SPEED', 'CONGA_RUSH', 'CONGA_DROP',
                   'CONGA_FLOOR', 'CONGA_LINK', 'CONGA_FORM', 'CONGA_TURN');

    let conga = null;

    LAB_MINI.conga = {
        start() {
            conga = { line: [], formed: false, forming: 0, dir: 1, vdir: 1, drop: 0,
                      lost: 0, turns: 0, turnT: 0 };
            if (LAB.open) congaWalkOn();
            return true;
        },
        reset() { conga = null; },
        update: congaUpdate,
        hit: congaHit,
        contact(br, ball) {
            if (!br.conga) return undefined;
            return maskContact(ball, br.x + bw / 2, br.y + bh / 2, br.psi || 0, bw, bh, MASK, !!br.mir);
        },
        // a hit on one behind the leader turns the line, which is not nothing
        glances() { return false; },
        drawBrick(b) { if (!b.conga) return false; congaDraw(b); return true; },
        finish() {
            if (!conga || !conga.formed) return false;
            const line = conga.line.filter(b => b.alive);
            for (let i = 1; i < line.length; i++) line[i].alive = false;
            conga.line = line.slice(0, 1);
            return true;
        },
        acts: {
            // straight to the stage's last few, so the line gets up now
            down() {
                if (!conga || conga.formed || conga.forming > 0) return false;
                const left = bricks.filter(b => b.alive && b.kind !== 'X');
                const keep = left.slice().sort(() => Math.random() - 0.5).slice(0, Math.max(1, Math.round(CONGA_AT)));
                for (const b of left) if (!keep.includes(b)) b.alive = false;
                congaForm();
                return true;
            }
        },
        state() {
            const n = conga.line.filter(b => b.alive).length;
            return { name: 'CONGA', line: conga.formed || conga.forming > 0
                ? n + ' in line · ' + conga.lost + ' knocked out · turned round ' + conga.turns + '×'
                : 'gets up when ' + Math.round(CONGA_AT) + ' are left' };
        }
    };

    function congaJoin(b, cx, cy) {
        b.lab = true; b.conga = true;
        b.hp = b.maxHp = 1;
        b.flee = null; b.slide = null;
        b.cx = cx; b.cy = cy;
        b.head = 0;                               // the way he faces, as an angle
        b.step = Math.random() * Math.PI * 2;     // where he is in his toddle
    }

    // the stage's last few get up out of the wall and into a line across the
    // top, the rightmost at the front, walking right
    function congaForm() {
        const segs = bricks.filter(b => b.alive && b.kind !== 'X').sort((a, b) => b.x - a.x);
        const n = segs.length, gap = bw * CONGA_LINK, y = TOP + bh / 2;
        const x0 = Math.min(LW - bw / 2, Math.max(bw / 2 + (n - 1) * gap, LW / 2 + (n - 1) * gap / 2));
        segs.forEach((b, i) => {
            congaJoin(b, b.x + bw / 2, b.y + bh / 2);
            b.from = { x: b.cx, y: b.cy };
            b.to = { x: x0 - i * gap, y };
        });
        conga.line = segs;
        conga.forming = CONGA_FORM;
        conga.dir = 1;
        conga.vdir = 1;
        // the hat's coin toss stays out of it
        fleeRoll = Infinity;
        talk = [];
    }

    // an open field: a line of them walking on from the left, already linked
    function congaWalkOn() {
        const kinds = ['R', 'O', 'G', 'Y'];
        const gap = bw * CONGA_LINK, y = TOP + bh / 2;
        for (let i = 0; i < Math.max(1, Math.round(CONGA_N)); i++) {
            const b = newBrick(0, 0, kinds[i % kinds.length], 1);
            congaJoin(b, -bw / 2 - i * gap, y);
            bricks.push(b);
            conga.line.push(b);
        }
        conga.formed = true;
        congaSync();
    }

    function congaUpdate(dt) {
        if (!conga) return;
        if (!conga.formed) {
            if (conga.forming > 0) {
                conga.forming = Math.max(0, conga.forming - dt);
                const raw = 1 - conga.forming / CONGA_FORM, k = raw * raw * (3 - 2 * raw);
                for (const b of conga.line) {
                    if (!b.alive) continue;
                    b.cx = b.from.x + (b.to.x - b.from.x) * k;
                    // up out of the wall, and down into line
                    b.cy = b.from.y + (b.to.y - b.from.y) * k - Math.sin(Math.PI * raw) * bh;
                }
                if (conga.forming <= 0) conga.formed = true;
            } else if (phase === 'play') {
                const left = bricks.filter(b => b.alive && b.kind !== 'X').length;
                if (left > 0 && left <= CONGA_AT) congaForm();
            }
            congaSync();
            return;
        }
        conga.line = conga.line.filter(b => b.alive);
        const line = conga.line;
        if (!line.length) return;
        if (conga.turnT > 0) conga.turnT = Math.max(0, conga.turnT - dt);
        // everybody holds still while you are waiting to serve
        if (phase === 'play') {
            const v = CONGA_SPEED * (1 + CONGA_RUSH * conga.lost);
            const lead = line[0];
            if (conga.drop > 0) {
                const d = Math.min(conga.drop, v * dt);
                lead.cy += conga.vdir * d;
                if ((conga.drop -= d) <= 0) conga.dir = -conga.dir;
            } else {
                lead.cx += conga.dir * v * dt;
                const lo = bw / 2, hi = LW - bw / 2;
                if ((conga.dir > 0 && lead.cx >= hi) || (conga.dir < 0 && lead.cx <= lo)) {
                    lead.cx = Math.max(lo, Math.min(hi, lead.cx));
                    // a notch down -- or, once the floor is reached, back up
                    const next = lead.cy + conga.vdir * CONGA_DROP;
                    if (next > CONGA_FLOOR || next < TOP + bh / 2) conga.vdir = -conga.vdir;
                    conga.drop = CONGA_DROP;
                }
            }
            // everybody else keeps his distance from the one in front of him
            const gap = bw * CONGA_LINK;
            for (let i = 1; i < line.length; i++) {
                const a = line[i - 1], b = line[i];
                const dx = b.cx - a.cx, dy = b.cy - a.cy, d = Math.hypot(dx, dy);
                if (d > gap) { b.cx = a.cx + dx / d * gap; b.cy = a.cy + dy / d * gap; }
            }
            for (const b of line) b.step += dt * TODDLE_HZ * Math.PI * 2;
        }
        // facing: the leader the way he is walking, everybody else the one ahead
        for (let i = 0; i < line.length; i++) {
            const b = line[i];
            const want = i === 0 ? (conga.dir > 0 ? 0 : Math.PI)
                                 : Math.atan2(line[i - 1].cy - b.cy, line[i - 1].cx - b.cx);
            const d = Math.atan2(Math.sin(want - b.head), Math.cos(want - b.head));
            b.head += d * (1 - Math.exp(-dt / 0.08));
        }
        congaSync();
    }

    // where each of them is drawn and met: facing left is a mirror, never him
    // upside down, and the toddle rocks him and lifts him a little each step
    function congaSync() {
        const walking = conga.formed && phase === 'play';
        for (const b of conga.line) {
            if (!b.alive) continue;
            b.mir = Math.cos(b.head) < 0;
            let psi = b.mir ? b.head + Math.PI : b.head;
            psi = Math.atan2(Math.sin(psi), Math.cos(psi));
            const hop = walking ? Math.abs(Math.sin(b.step)) * TODDLE_HOP : 0;
            b.psi = psi + (walking ? Math.sin(b.step) * TODDLE_LEAN : 0);
            b.x = b.cx - bw / 2;
            b.y = b.cy - bh / 2 - hop;
        }
    }

    function congaHit(b) {
        const line = conga.line.filter(x => x.alive);
        if (!conga.formed || b === line[0]) {
            // the one in front: knocked out, and the next one leads
            b.alive = false;
            b.flash = 1;
            shockwave(b);
            award((TIERS[b.kind] ? TIERS[b.kind].pts : 50) * 2, b.cx, b.cy - bh / 2);
            conga.lost++;
            conga.line = line.filter(x => x !== b);
            maybeDropCapsule(b.cx, b.cy);
            if (++hits === 4 || hits === 12) bumpSpeed(1.12);
            if (!bricks.some(x => x.alive && x.kind !== 'X')) clearStage();
            return;
        }
        if (conga.turnT > 0) return;
        // anyone else: the whole line turns round, and the back is the front
        line.reverse();
        conga.line = line;
        const lead = line[0], next = line[1];
        conga.dir = next ? (lead.cx < next.cx ? -1 : 1) : -conga.dir;
        conga.drop = 0;
        conga.turnT = CONGA_TURN;
        conga.turns++;
    }

    function congaDraw(b) {
        const sp = shapeSprite(b.kind, brickColor(b.kind), bw, bh, false);
        if (!sp) return;
        const o = b.jt > 0 ? wobble(b.jt) * JIG_BRICK : 0;
        ctx.save();
        ctx.translate(b.x + bw / 2 + b.jnx * o, b.y + bh / 2 + b.jny * o);
        ctx.rotate(b.psi || 0);
        if (b.mir) ctx.scale(-1, 1);
        ctx.drawImage(sp, -bw / 2, -bh / 2, bw, bh);
        if (b.flash > 0) {
            ctx.globalAlpha = Math.min(1, b.flash) * 0.75;
            ctx.drawImage(shapeSprite('flash', '#f2efe9', bw, bh, true), -bw / 2, -bh / 2, bw, bh);
            ctx.globalAlpha = 1;
        }
        ctx.restore();
    }