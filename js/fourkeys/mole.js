'use strict';

    // ---- MOLE (mini-boss) ------------------------------------------------------------
    // Somewhere in an ordinary stage, MOLE_COUNT brandons are the photograph nobody
    // dyed -- the gauntlet's bounty, so anyone who has sat on the throne knows
    // to look at him. When a head comes at him he trades places with a brick
    // beside him, and the brick takes the hit meant for him. He cannot hide in
    // stone or in a gap. Boxed in, he hops further -- to any brick within
    // MOLE_REACH spaces, and failing that to the nearest few anywhere -- so
    // breaking the wall round him never leaves him a sitting duck; a longer
    // hop only takes him longer, which is your moment. The stage cannot end
    // while one is up, and once they are all that is left standing they run
    // for the edge, the way the hat's last few do. Each is his own share of
    // MINI BOSS CLEAR.
    let MOLE_HP     = 4;       // hits to finish him
    let MOLE_NOTICE = 110;     // px from his edge a head coming at him gets a move
    let MOLE_SWAP   = 0.16;    // seconds a trade takes
    let MOLE_COOL   = 0.7;     // seconds after one before he can make another
    let MOLE_DAZE   = 0.6;     // seconds a hit stops him moving
    let MOLE_ODDS   = 1;       // chance he sees one coming
    let MOLE_DIAG   = 1;       // 1: corner to corner counts as beside him
    let MOLE_PTS    = 100;     // a hit; the one that finishes him pays five of these
    let MOLE_RUN    = 6;       // seconds his run takes, once he is the last one
    let MOLE_REACH  = 2.5;     // spaces he will hop, with nothing next to him
    let MOLE_FAR    = 3;       // ...and with nothing that close either, the nearest this many anywhere
    let MOLE_COUNT  = 2;       // how many come up
    // The act a run draws him from, 1 easy to 3 hard. He cannot touch you: all
    // he does is refuse to be hit, so the only thing he costs is time.
    let MOLE_LVL    = 1;
    LAB_KNOBS.push('MOLE_LVL', 'MOLE_HP', 'MOLE_NOTICE', 'MOLE_SWAP', 'MOLE_COOL', 'MOLE_DAZE',
                   'MOLE_ODDS', 'MOLE_DIAG', 'MOLE_PTS', 'MOLE_RUN', 'MOLE_REACH', 'MOLE_FAR', 'MOLE_COUNT');

    let moles = [];                // each: { brick, cool, daze, swaps, ran, gone, fade }
    function moleOf(b) { return moles.find(m => m.brick === b) || null; }

    // Making an entrance, he surfaces in a hole the wall has lost, fading up
    // out of it over MOLE_FADE, and cannot be hit or move until he is there.
    const MOLE_FADE = 1.4;

    LAB_MINI.mole = {
        // they come on early: there are two to find
        wait: [1.5, 3],
        // each one of the stage's own, picked where he has the most places to
        // go -- and no wall, no moles. Making an entrance, each is one more
        // instead, in whichever empty slot of the wall has the most round it.
        start(entering) {
            moles = [];
            for (let i = 0; i < Math.max(1, Math.round(MOLE_COUNT)); i++) {
                const pool = bricks.filter(b => b.alive && b.kind !== 'X' && !b.mole);
                if (!pool.length) break;
                const room = b => moleMoves(b).length;
                let b = null;
                if (entering) {
                    const holes = moleHoles();
                    const most = holes.length ? Math.max(...holes.map(room)) : 0;
                    if (most > 0) {
                        const picks = holes.filter(h => room(h) >= Math.min(3, most));
                        const h = picks[(Math.random() * picks.length) | 0];
                        b = newBrick(h.x, h.y, 'R', 1);
                        bricks.push(b);
                    }
                }
                if (!b) {
                    const most = Math.max(...pool.map(room));
                    const picks = pool.filter(o => room(o) >= Math.min(3, most));
                    b = picks[(Math.random() * picks.length) | 0];
                }
                b.mole = true;
                b.lab = true;
                b.hp = b.maxHp = MOLE_HP;
                moles.push({ brick: b, cool: 0, daze: 0, swaps: 0, ran: false, gone: false, fade: entering ? 0 : 1 });
            }
            return moles.length > 0;
        },
        // the first shouts through the runtime; the rest shout for themselves
        enter() {
            const at = b => () => ({ x: b.x + bw / 2, y: b.y + bh + 8 });
            for (const m of moles.slice(1)) {
                const p = at(m.brick)();
                labShout(p.x, p.y, 'BRANDON!', SHOUT_SECS * 1.6, at(m.brick));
            }
            const b = moles[0].brick;
            return Object.assign(at(b)(), { at: at(b) });
        },
        // still surfacing: a head goes straight through where he is coming up
        contact(br) { const m = br.mole && moleOf(br); return m && m.fade < 1 ? null : undefined; },
        reset() { moles = []; },
        update: moleUpdate,
        hit: moleHit,
        left: moleLeft,
        drawBrick(b) { if (!b.mole) return false; moleDraw(b); return true; },
        finish() {
            const up = moles.filter(m => m.brick.alive);
            for (const m of up) m.brick.hp = 1;
            return up.length > 0;
        },
        acts: {
            // the moles and whatever is beside them, and nothing else breakable
            alone() {
                const up = moles.filter(m => m.brick.alive);
                if (!up.length) return false;
                const keep = new Set(up.flatMap(m => [m.brick, ...moleMoves(m.brick)]));
                for (const b of bricks) if (b.alive && b.kind !== 'X' && !keep.has(b)) b.alive = false;
                moleLeft(bricks.filter(b => b.alive && b.kind !== 'X'));   // alone already: they run
                return true;
            }
        },
        state() {
            const up = moles.filter(m => m.brick.alive);
            return { name: 'MOLE', hp: up.reduce((s, m) => s + m.brick.hp, 0), max: moles.length * MOLE_HP,
                     alive: up.length > 0,
                     line: moles.map(m => !m.brick.alive ? (m.gone ? 'got away' : 'finished')
                         : 'traded ' + m.swaps + ' · ' + moleMoves(m.brick).length + ' places to go'
                           + (m.brick.flee ? ' · running' : '')).join(' / ') };
        }
    };

    // every slot of this screen's wall with nothing alive in it
    function moleHoles() {
        const rows = LEVELS[stage].rows || [];
        const cols = Math.max(...rows.filter(r => r[0] !== '>').map(r => r.length));
        const out = [];
        rows.forEach((row, r) => {
            const half = row[0] === '>';
            for (let c = 0; c < cols - (half ? 1 : 0); c++) {
                const x = MARGIN + (c + (half ? 0.5 : 0)) * (bw + GAP), y = TOP + r * (bh + GAP);
                if (!bricks.some(o => o.alive && Math.abs(o.x - x) < bw / 2 && Math.abs(o.y - y) < bh / 2)) {
                    out.push({ x, y });
                }
            }
        });
        return out;
    }

    // where a brick belongs: the slot it is sliding to, or the one it is in
    function moleSlot(b) { return b.slide ? { x: b.slide.x1, y: b.slide.y1 } : { x: b.x, y: b.y }; }

    // the bricks beside him he could trade with: alive, breakable, standing
    // still, next to him on the grid, and not the other mole
    function moleMoves(m) {
        const a = moleSlot(m), px = (bw + GAP) * 1.01, py = (bh + GAP) * 1.01;
        return bricks.filter(o => {
            if (o === m || o.mole || !o.alive || o.kind === 'X' || o.flee || o.slide) return false;
            const dx = Math.abs(o.x - a.x), dy = Math.abs(o.y - a.y);
            if (dx > px || dy > py) return false;
            return MOLE_DIAG >= 0.5 || dx < 1 || dy < 1;
        });
    }

    // Where he can get to from here: next door if anywhere, else within
    // MOLE_REACH spaces, else the nearest MOLE_FAR of whatever is left.
    function moleEscapes(m) {
        const near = moleMoves(m);
        if (near.length) return near;
        const a = moleSlot(m), step = bw + GAP;
        const rest = bricks.filter(o => o !== m && !o.mole && o.alive && o.kind !== 'X' && !o.flee && !o.slide)
            .map(o => ({ o, d: Math.hypot(o.x - a.x, o.y - a.y) })).sort((p, q) => p.d - q.d);
        const reach = rest.filter(r => r.d <= step * MOLE_REACH);
        return (reach.length ? reach : rest.slice(0, Math.max(1, Math.round(MOLE_FAR)))).map(r => r.o);
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
    // cups do in a shell game. A long hop arcs higher and takes longer.
    function moleSwap(a, b) {
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const nx = -dy / d, ny = dx / d;
        const far = Math.max(1, d / (bw + GAP));
        const lift = bh * 0.6 * Math.sqrt(far), secs = MOLE_SWAP * Math.sqrt(far);
        a.slide = { x0: a.x, y0: a.y, x1: b.x, y1: b.y, t: 0, nx, ny, lift, secs };
        b.slide = { x0: b.x, y0: b.y, x1: a.x, y1: a.y, t: 0, nx: -nx, ny: -ny, lift, secs };
    }

    // every frame, after the hat's runners have moved and before the physics,
    // so a head meets everybody where they have got to
    function moleUpdate(dt) {
        for (const b of bricks) {
            const s = b.slide;
            if (!s) continue;
            if (b.flee || !b.alive) { b.slide = null; continue; }
            s.t = Math.min(1, s.t + dt / (s.secs || MOLE_SWAP));
            const k = s.t * s.t * (3 - 2 * s.t), lift = Math.sin(Math.PI * s.t) * s.lift;
            b.x = s.x0 + (s.x1 - s.x0) * k + s.nx * lift;
            b.y = s.y0 + (s.y1 - s.y0) * k + s.ny * lift;
            if (s.t >= 1) { b.x = s.x1; b.y = s.y1; b.slide = null; }
        }
        for (const mole of moles) moleStep(mole, dt);
    }

    function moleStep(mole, dt) {
        const m = mole.brick;
        if (mole.fade < 1) { mole.fade = Math.min(1, mole.fade + dt / MOLE_FADE); return; }
        if (!m.alive) {
            // off the edge with health left: he got away
            if (m.hp > 0 && !mole.gone) {
                mole.gone = true;
                callout = { text: 'HE GOT AWAY', color: '#f2efe9', life: CALLOUT_SECS * 1.6 };
            }
            return;
        }
        if (phase !== 'play') return;
        // the rest of the wall gone from round them another way (run off): they run too
        if (!mole.ran && !m.flee && !bricks.some(o => !o.mole && o.alive && o.kind !== 'X')) {
            moleLeft(bricks.filter(o => o.alive && o.kind !== 'X'));
            return;
        }
        mole.cool = Math.max(0, mole.cool - dt);
        mole.daze = Math.max(0, mole.daze - dt);
        if (m.flee || m.slide || mole.cool > 0 || mole.daze > 0) return;
        const threat = moleThreat(m);
        if (!threat) return;
        mole.cool = MOLE_COOL;                 // one decision per head, whichever way it goes
        if (Math.random() >= MOLE_ODDS) return;
        const moves = moleEscapes(m);
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
        const mole = moleOf(b);
        if (mole) mole.daze = MOLE_DAZE;
        if (--b.hp > 0) { award(MOLE_PTS, b.x + bw / 2, b.y); return; }
        b.alive = false;
        b.slide = null;
        shockwave(b);
        award(MOLE_PTS * 5, b.x + bw / 2, b.y);
        labMiniDown(1 / Math.max(1, moles.length));
        if (b.flee) round.hunter++;
        if (!capsule) {
            capsule = { x: b.x + bw / 2, y: b.y + bh / 2, kind: labCapKind() };
        }
        if (++hits === 4 || hits === 12) bumpSpeed(1.12);
        const left = bricks.filter(x => x.alive && x.kind !== 'X');
        if (!left.length) clearStage();
        else if (moleLeft(left)) { /* the last of them are off */ }
        else if (LEVELS[stage].talks && left.length <= FLEE_AT && fleeRoll < 0) {
            fleeRoll = FLEE_REROLL;
            tossForFlight();
        }
    }

    // A brick has just died and the stage goes on. If the moles are all that
    // is left, there is nowhere to hide: they run. True if they have set off.
    function moleLeft(left) {
        if (!left.length || !left.every(b => b.mole)) return false;
        const off = moles.filter(m => m.brick.alive && !m.ran);
        for (const mole of off) {
            mole.brick.slide = null;
            mole.ran = true;
            walkOff(mole.brick, FLEE_WAIT, MOLE_RUN);
        }
        return off.length > 0;
    }

    function moleDraw(b) {
        const sp = shapeSprite('mole', null, bw, bh, false);    // the photograph, undyed
        if (!sp) return;
        const o = b.jt > 0 ? wobble(b.jt) * JIG_BRICK : 0;
        const mole = moleOf(b);
        const k = mole ? mole.fade : 1;
        ctx.save();
        // surfacing: up out of the hole as he fades in
        ctx.translate(b.x + b.jnx * o + bw / 2, b.y + b.jny * o + bh / 2 + (1 - k) * (1 - k) * bh * 0.8);
        if (b.wigA) ctx.rotate(b.wigA);
        ctx.globalAlpha = k * k;
        ctx.drawImage(sp, -bw / 2, -bh / 2, bw, bh);
        ctx.globalAlpha = 1;
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
        if (LAB.moves && mole && !b.flee) {
            ctx.strokeStyle = 'rgba(201,169,78,0.8)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            for (const n of moleMoves(b)) ctx.strokeRect(n.x - 3, n.y - 3, bw + 6, bh + 6);
            ctx.setLineDash([]);
        }
    }