'use strict';

    // ---- MOLE (mini-boss) ------------------------------------------------------------
    // Somewhere in an ordinary stage, one brandon is the photograph nobody
    // dyed -- the gauntlet's bounty, so anyone who has sat on the throne knows
    // to look at him. When a head comes at him he trades places with a brick
    // beside him, and the brick takes the hit meant for him. He cannot hide in
    // stone or in a gap, so everything broken round him is one less place to
    // go. The stage cannot end while he is up, and once he is the last one
    // standing he runs for the edge, the way the hat's last few do.
    let MOLE_HP     = 4;       // hits to finish him
    let MOLE_NOTICE = 110;     // px from his edge a head coming at him gets a move
    let MOLE_SWAP   = 0.16;    // seconds a trade takes
    let MOLE_COOL   = 0.7;     // seconds after one before he can make another
    let MOLE_DAZE   = 0.6;     // seconds a hit stops him moving
    let MOLE_ODDS   = 1;       // chance he sees one coming
    let MOLE_DIAG   = 1;       // 1: corner to corner counts as beside him
    let MOLE_PTS    = 100;     // a hit; the one that finishes him pays five of these
    let MOLE_RUN    = 6;       // seconds his run takes, once he is the last one
    // The act a run draws him from, 1 easy to 3 hard. He cannot touch you: all
    // he does is refuse to be hit, so the only thing he costs is time.
    let MOLE_LVL    = 1;
    LAB_KNOBS.push('MOLE_LVL', 'MOLE_HP', 'MOLE_NOTICE', 'MOLE_SWAP', 'MOLE_COOL', 'MOLE_DAZE',
                   'MOLE_ODDS', 'MOLE_DIAG', 'MOLE_PTS', 'MOLE_RUN');

    let mole = null;

    LAB_MINI.mole = {
        // one of the stage's own, picked where he has the most places to go --
        // and no wall, no mole
        start() {
            const pool = bricks.filter(b => b.kind !== 'X');
            if (!pool.length) return false;
            const room = b => moleMoves(b).length;
            const most = Math.max(...pool.map(room));
            const picks = pool.filter(b => room(b) >= Math.min(3, most));
            const b = picks[(Math.random() * picks.length) | 0];
            b.mole = true;
            b.lab = true;
            b.hp = b.maxHp = MOLE_HP;
            mole = { brick: b, cool: 0, daze: 0, swaps: 0, ran: false, gone: false };
            return true;
        },
        reset() { mole = null; },
        update: moleUpdate,
        hit: moleHit,
        left: moleLeft,
        drawBrick(b) { if (!b.mole) return false; moleDraw(b); return true; },
        finish() { if (!mole || !mole.brick.alive) return false; mole.brick.hp = 1; return true; },
        acts: {
            // the mole and whatever is beside him, and nothing else breakable
            alone() {
                if (!mole || !mole.brick.alive) return false;
                const keep = new Set([mole.brick, ...moleMoves(mole.brick)]);
                for (const b of bricks) if (b.alive && b.kind !== 'X' && !keep.has(b)) b.alive = false;
                moleLeft(bricks.filter(b => b.alive && b.kind !== 'X'));   // alone already: he runs
                return true;
            }
        },
        state() {
            const m = mole.brick;
            return { name: 'MOLE', hp: m.hp, max: m.maxHp, alive: m.alive,
                     line: !m.alive ? (mole.gone ? 'got away' : 'finished')
                         : 'traded ' + mole.swaps + ' · ' + moleMoves(m).length + ' places to go' + (m.flee ? ' · running' : '') };
        }
    };

    // where a brick belongs: the slot it is sliding to, or the one it is in
    function moleSlot(b) { return b.slide ? { x: b.slide.x1, y: b.slide.y1 } : { x: b.x, y: b.y }; }

    // the bricks beside him he could trade with: alive, breakable, standing
    // still, and next to him on the grid
    function moleMoves(m) {
        const a = moleSlot(m), px = (bw + GAP) * 1.01, py = (bh + GAP) * 1.01;
        return bricks.filter(o => {
            if (o === m || !o.alive || o.kind === 'X' || o.flee || o.slide) return false;
            const dx = Math.abs(o.x - a.x), dy = Math.abs(o.y - a.y);
            if (dx > px || dy > py) return false;
            return MOLE_DIAG >= 0.5 || dx < 1 || dy < 1;
        });
    }

    // the first head in play coming at him and inside MOLE_NOTICE of his edge
    function moleThreat(m) {
        const cx = m.x + bw / 2, cy = m.y + bh / 2;
        for (const b of balls) {
            if (b.stuck || caught(b)) continue;
            if (b.vx * (cx - b.x) + b.vy * (cy - b.y) <= 0) continue;
            const qx = Math.max(m.x, Math.min(m.x + bw, b.x));
            const qy = Math.max(m.y, Math.min(m.y + bh, b.y));
            if (Math.hypot(qx - b.x, qy - b.y) - bMAX() <= MOLE_NOTICE) return b;
        }
        return null;
    }

    // the two of them trade slots, one passing over and one under, the way
    // cups do in a shell game
    function moleSwap(a, b) {
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const nx = -dy / d, ny = dx / d;
        const lift = bh * 0.6;
        a.slide = { x0: a.x, y0: a.y, x1: b.x, y1: b.y, t: 0, nx, ny, lift };
        b.slide = { x0: b.x, y0: b.y, x1: a.x, y1: a.y, t: 0, nx: -nx, ny: -ny, lift };
    }

    // every frame, after the hat's runners have moved and before the physics,
    // so a head meets everybody where they have got to
    function moleUpdate(dt) {
        for (const b of bricks) {
            const s = b.slide;
            if (!s) continue;
            if (b.flee || !b.alive) { b.slide = null; continue; }
            s.t = Math.min(1, s.t + dt / MOLE_SWAP);
            const k = s.t * s.t * (3 - 2 * s.t), lift = Math.sin(Math.PI * s.t) * s.lift;
            b.x = s.x0 + (s.x1 - s.x0) * k + s.nx * lift;
            b.y = s.y0 + (s.y1 - s.y0) * k + s.ny * lift;
            if (s.t >= 1) { b.x = s.x1; b.y = s.y1; b.slide = null; }
        }
        if (!mole) return;
        const m = mole.brick;
        if (!m.alive) {
            // off the edge with health left: he got away
            if (m.hp > 0 && !mole.gone) {
                mole.gone = true;
                callout = { text: 'HE GOT AWAY', color: '#f2efe9', life: CALLOUT_SECS * 1.6 };
            }
            return;
        }
        if (phase !== 'play') return;
        mole.cool = Math.max(0, mole.cool - dt);
        mole.daze = Math.max(0, mole.daze - dt);
        if (m.flee || m.slide || mole.cool > 0 || mole.daze > 0) return;
        const threat = moleThreat(m);
        if (!threat) return;
        mole.cool = MOLE_COOL;                 // one decision per head, whichever way it goes
        if (Math.random() >= MOLE_ODDS) return;
        const moves = moleMoves(m);
        if (!moves.length) return;             // nowhere to go: he takes it
        // the one furthest from where the head will be a moment from now
        const hx = threat.x + threat.vx * 0.15, hy = threat.y + threat.vy * 0.15;
        let pick = null, far = -1;
        for (const o of moves) {
            const d = Math.hypot(o.x + bw / 2 - hx, o.y + bh / 2 - hy);
            if (d > far) { far = d; pick = o; }
        }
        moleSwap(m, pick);
        mole.swaps++;
    }

    // hitBrick's work for him: health instead of one hit, and a capsule always
    function moleHit(b) {
        b.flash = 1;
        if (mole) mole.daze = MOLE_DAZE;
        if (--b.hp > 0) { award(MOLE_PTS, b.x + bw / 2, b.y); return; }
        b.alive = false;
        b.slide = null;
        shockwave(b);
        award(MOLE_PTS * 5, b.x + bw / 2, b.y);
        if (b.flee) round.hunter++;
        if (!capsule) {
            const pool = capsulePool();
            capsule = { x: b.x + bw / 2, y: b.y + bh / 2, kind: pool[(Math.random() * pool.length) | 0] };
        }
        if (++hits === 4 || hits === 12) bumpSpeed(1.12);
        const left = bricks.filter(x => x.alive && x.kind !== 'X');
        if (!left.length) clearStage();
        else if (LEVELS[stage].talks && left.length <= FLEE_AT && fleeRoll < 0) {
            fleeRoll = FLEE_REROLL;
            tossForFlight();
        }
    }

    // A brick has just died and the stage goes on. If he is all that is left,
    // there is nowhere to hide: he runs. True if he has set off.
    function moleLeft(left) {
        if (!mole || mole.ran || !mole.brick.alive) return false;
        if (left.length !== 1 || left[0] !== mole.brick) return false;
        const m = mole.brick;
        m.slide = null;
        mole.ran = true;
        walkOff(m, FLEE_WAIT, MOLE_RUN);
        return true;
    }

    function moleDraw(b) {
        const sp = shapeSprite('mole', null, bw, bh, false);    // the photograph, undyed
        if (!sp) return;
        const o = b.jt > 0 ? wobble(b.jt) * JIG_BRICK : 0;
        ctx.save();
        ctx.translate(b.x + b.jnx * o + bw / 2, b.y + b.jny * o + bh / 2);
        if (b.wigA) ctx.rotate(b.wigA);
        ctx.drawImage(sp, -bw / 2, -bh / 2, bw, bh);
        if (b.flash > 0) {
            ctx.globalAlpha = Math.min(1, b.flash) * 0.75;
            ctx.drawImage(shapeSprite('flash', '#f2efe9', bw, bh, true), -bw / 2, -bh / 2, bw, bh);
            ctx.globalAlpha = 1;
        }
        ctx.restore();
        // nothing hung on him until he has been hit; then, what is left of him
        if (b.hp < b.maxHp) {
            const w = bw * 0.72;
            labBar(b.x + (bw - w) / 2, b.y - 8, w, b.hp / b.maxHp, 3);
        }
        if (LAB.moves && mole && mole.brick === b && !b.flee) {
            ctx.strokeStyle = 'rgba(201,169,78,0.8)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            for (const n of moleMoves(b)) ctx.strokeRect(n.x - 3, n.y - 3, bw + 6, bh + 6);
            ctx.setLineDash([]);
        }
    }