'use strict';

    // ---- CONGA (mini-boss) ------------------------------------------------------------
    // When a stage is down to its last several bricks, they get up, link head
    // to boot, and the line toddles across the field, coming down a notch at
    // each wall the way Centipede does. Only the one in front can be knocked
    // out. Hit any of the others and the whole line turns round, its back
    // becoming its front -- so a shot that misses the leader is how you steer,
    // turning the line until its front comes round to where you can reach it.
    // Making a level's entrance, or on an open field, a line of them comes in
    // from the top of the screen instead, filing down an aisle in the wall
    // (congaAisle) and turning off along the bottom of it. With no aisle
    // through to the top they walk on from off one side, under the wall.
    //
    // Stone is in the way, not a wall: the front of the line meeting it steps
    // a notch down (or up) and walks on the way it was going, so a block in
    // the middle of the room is gone round rather than penning the line into
    // one half of it. The walls turn it. The line keeps below the lowest brick
    // still breakable (congaCeil), so it never walks over the wall, and it has
    // more room to rise into as the wall is cleared.
    //
    // The line goes where its front went, every one of them, the way
    // Centipede's does: the front leaves a path (conga.trail) and each one
    // behind walks it CONGA_LINK body lengths after the one ahead. So it
    // turns square where the front turned, and never cuts a corner across a
    // lane or through the stone the front went round.
    let CONGA_AT    = 8;       // bricks left when they get up
    let CONGA_N     = 8;       // how many walk on to an open field, or onto a level
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
        start(entering) {
            conga = { line: [], formed: false, forming: 0, dir: 1, vdir: 1, drop: 0, flip: false,
                      lost: 0, turns: 0, turnT: 0, trail: [] };
            if (LAB.open || entering) {
                const x = congaAisle();
                if (x === null) congaWalkOn(Math.random() < 0.5 ? 1 : -1);
                else congaDropIn(x);
            }
            return true;
        },
        enter() {
            const lead = conga.line[0];
            const at = () => ({ x: Math.max(60, Math.min(LW - 60, lead.cx)), y: lead.cy + bh / 2 + 8 });
            return Object.assign(at(), { at });
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

    // a line of them walking on from off one side (`from`: -1 the left, 1
    // the right), already linked, along the top of the room under the wall
    function congaWalkOn(from) {
        const kinds = ['R', 'O', 'G', 'Y'];
        const gap = bw * CONGA_LINK, y = congaCeil();
        for (let i = 0; i < Math.max(1, Math.round(CONGA_N)); i++) {
            const b = newBrick(0, 0, kinds[i % kinds.length], 1);
            congaJoin(b, from < 0 ? -bw / 2 - i * gap : LW + bw / 2 + i * gap, y);
            b.head = from < 0 ? 0 : Math.PI;
            bricks.push(b);
            conga.line.push(b);
        }
        conga.dir = from < 0 ? 1 : -1;
        conga.formed = true;
        congaLay();
        congaSync();
    }

    // The middle of a column with nothing in it from the top of the screen
    // down to where the line will walk, picked at random, or null. Rows set
    // half a brick over block the columns either side of them.
    function congaAisle() {
        const ceil = congaCeil(), step = bw + GAP;
        const cols = Math.round((LW - 2 * MARGIN + GAP) / step), open = [];
        for (let c = 0; c < cols; c++) {
            const cx = MARGIN + c * step + bw / 2;
            if (!bricks.some(b => b.alive && !b.conga && b.y < ceil && Math.abs(b.x + bw / 2 - cx) < bw * 0.9)) open.push(cx);
        }
        return open.length ? open[(Math.random() * open.length) | 0] : null;
    }

    // a line of them filing down from above the screen at x, the front one
    // just out of sight, to the bottom of the wall -- where the path runs
    // out, and he turns off toward whichever side has more room
    function congaDropIn(x) {
        const kinds = ['R', 'O', 'G', 'Y'];
        const n = Math.max(1, Math.round(CONGA_N)), gap = bw * CONGA_LINK;
        const ceil = congaCeil(), top = -bh / 2 - n * gap;
        conga.trail = [{ x, y: top, d: 0 }, { x, y: ceil, d: ceil - top }];
        for (let i = 0; i < n; i++) {
            const b = newBrick(0, 0, kinds[i % kinds.length], 1);
            congaJoin(b, x, 0);
            b.pd = -bh / 2 - top - i * gap;
            b.cy = congaAt(b.pd).y;
            b.head = Math.PI / 2;
            bricks.push(b);
            conga.line.push(b);
        }
        conga.dir = x < LW / 2 ? 1 : -1;
        conga.formed = true;
        congaSync();
    }

    // ---- the path ------------------------------------------------------------
    // Points the front has walked through, oldest first, each marked with how
    // far along the path it is (`d`). Everyone in the line has his own (`pd`), and
    // stands wherever the path is at it. The front walks the path too while
    // he is behind its end -- the one who was in front of him knocked out --
    // and walks on from its end, adding to it, once he gets there.

    // a path along the line as it stands: what it starts from, walking on or
    // formed up, and what it is turned round into (congaHit) is laid by hand
    function congaLay() {
        const line = conga.line.filter(b => b.alive);
        let d = 0;
        const pts = [];
        for (let i = line.length - 1; i >= 0; i--) {
            const b = line[i];
            if (pts.length) d += Math.hypot(b.cx - pts[pts.length - 1].x, b.cy - pts[pts.length - 1].y);
            pts.push({ x: b.cx, y: b.cy, d });
            b.pd = d;
        }
        conga.trail = pts;
    }

    // where the path is at d
    function congaAt(d) {
        const tr = conga.trail;
        if (d <= tr[0].d) return tr[0];
        let lo = 0, hi = tr.length - 1;
        if (d >= tr[hi].d) return tr[hi];
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tr[m].d <= d) lo = m; else hi = m; }
        const a = tr[lo], b = tr[hi], k = (d - a.d) / Math.max(1e-6, b.d - a.d);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }

    // the front, walking d further: along the path while he is behind its
    // end, and past its end making more of it
    function congaWalk(lead, d) {
        const tr = conga.trail, end = tr[tr.length - 1].d;
        if (lead.pd < end) {
            lead.pd = Math.min(end, lead.pd + d);
            const p = congaAt(lead.pd);
            lead.cx = p.x; lead.cy = p.y;
            return false;
        }
        return true;
    }
    function congaMark(lead) {
        const tr = conga.trail, last = tr[tr.length - 1];
        const d = Math.hypot(lead.cx - last.x, lead.cy - last.y);
        if (d < 0.01) return;
        lead.pd = last.d + d;
        tr.push({ x: lead.cx, y: lead.cy, d: lead.pd });
    }

    // the highest the front of the line may walk: under the lowest brick of
    // the wall that can still be broken, or the top row once there is none
    function congaCeil() {
        let low = TOP;
        for (const b of bricks) {
            if (b.alive && !b.conga && b.kind !== 'X') low = Math.max(low, b.y + bh + GAP);
        }
        return low + bh / 2;
    }

    // the stone the front one would walk into by going to cx, if any: one he
    // is already standing in does not count, or a notch down into stone
    // would leave him turning on the spot for ever
    function congaStone(lead, cx) {
        for (const b of bricks) {
            if (!b.alive || b.kind !== 'X') continue;
            const mx = b.x + bw / 2, my = b.y + bh / 2;
            if (Math.abs(lead.cy - my) >= bh * 0.9) continue;
            if (Math.abs(lead.cx - mx) < bw * 0.95) continue;
            if (Math.abs(cx - mx) < bw * 0.95) return b;
        }
        return null;
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
                if (conga.forming <= 0) { conga.formed = true; congaLay(); }
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
            const free = congaWalk(lead, v * dt);
            if (!free) {
                // still catching up to where the one before him got to
            } else if (conga.drop > 0) {
                const d = Math.min(conga.drop, v * dt);
                lead.cy += conga.vdir * d;
                if ((conga.drop -= d) <= 0 && conga.flip) conga.dir = -conga.dir;
            } else {
                const to = lead.cx + conga.dir * v * dt;
                const lo = bw / 2, hi = LW - bw / 2;
                const wall = (conga.dir > 0 && to >= hi) || (conga.dir < 0 && to <= lo);
                const stone = !wall && congaStone(lead, to);
                if (wall || stone) {
                    if (wall) lead.cx = Math.max(lo, Math.min(hi, to));
                    // a notch down -- or, once the floor is reached, back up,
                    // but never up into the wall. A wall turns him round at
                    // the bottom of it; a stone is stepped past.
                    // Already outside that band, he heads back into it: a bounce
                    // there would send him on away from it, off the screen.
                    const ceil = congaCeil(), floor = Math.max(CONGA_FLOOR, ceil + CONGA_DROP);
                    if (lead.cy < ceil) conga.vdir = 1;
                    else if (lead.cy > floor) conga.vdir = -1;
                    else {
                        const next = lead.cy + conga.vdir * CONGA_DROP;
                        if (next > floor || next < ceil) conga.vdir = -conga.vdir;
                    }
                    conga.drop = CONGA_DROP;
                    conga.flip = !!wall;
                } else lead.cx = to;
            }
            if (free) congaMark(lead);
            // everybody else a link behind the one in front, along the path.
            // One knocked out of the middle leaves a gap the rest close up by
            // walking quicker, not by jumping.
            const gap = bw * CONGA_LINK;
            for (let i = 1; i < line.length; i++) {
                const b = line[i], want = line[i - 1].pd - gap;
                b.pd = b.pd > want ? want : Math.min(want, b.pd + v * 2 * dt);
                const p = congaAt(b.pd);
                b.cx = p.x; b.cy = p.y;
            }
            // what nobody is standing on any more
            const tr = conga.trail, last = line[line.length - 1].pd;
            let cut = 0;
            while (cut < tr.length - 2 && tr[cut + 1].d <= last) cut++;
            if (cut > 0) tr.splice(0, cut);
            for (const b of line) b.step += dt * TODDLE_HZ * Math.PI * 2;
        }
        // facing: the leader the way he is walking, everybody else -- and the
        // leader too, while he is still on a path laid for him -- along the path
        const end = conga.trail[conga.trail.length - 1].d;
        for (let i = 0; i < line.length; i++) {
            const b = line[i];
            let want = conga.dir > 0 ? 0 : Math.PI;
            if (i > 0 || b.pd < end - 0.5) {
                const p = congaAt(b.pd + 4), q = congaAt(b.pd - 4);
                if (Math.hypot(p.x - q.x, p.y - q.y) > 0.5) want = Math.atan2(p.y - q.y, p.x - q.x);
            }
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
            if (conga.formed && !conga.line.length) labMiniDown();
            maybeDropCapsule(b.cx, b.cy);
            if (++hits === 4 || hits === 12) bumpSpeed(1.12);
            if (!bricks.some(x => x.alive && x.kind !== 'X')) clearStage();
            return;
        }
        if (conga.turnT > 0) return;
        // Not while any of them is still coming on, off the screen or up in the
        // wall: the back would lead from out there, and nobody could reach it.
        const ceil = congaCeil();
        if (line.some(x => x.cy < ceil - 1 || x.cx < bw / 2 - 1 || x.cx > LW - bw / 2 + 1)) return;
        // anyone else: the whole line turns round, and the back is the front.
        // The path they are standing on turns round with them: the stretch
        // from the back one to the front one, end for end.
        const hd = line[0].pd, td = line[line.length - 1].pd;
        const pts = [Object.assign({}, congaAt(hd), { d: td })];
        for (let i = conga.trail.length - 1; i >= 0; i--) {
            const p = conga.trail[i];
            if (p.d > td && p.d < hd) pts.push({ x: p.x, y: p.y, d: hd + td - p.d });
        }
        pts.push(Object.assign({}, congaAt(td), { d: hd }));
        conga.trail = pts;
        for (const x of line) x.pd = hd + td - x.pd;
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