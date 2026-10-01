'use strict';

    // ==== FOUR KEYS: the new capsules ===============================================
    // The eight capsules the sequel adds to brandon.html's eight, tried out in
    // the powerup lab (.claude/powerlab/, on Paul's Mac) and brought in whole.
    // Loaded before the engine like every module, reading nothing of its at
    // load time; the engine reaches in through the pow* calls, one for each
    // place it had to be taught something, and CAPS in engine.js carries
    // their names, colours and letters.
    //
    // K  KATAMARI BRANDON: a brick a head would have broken sticks to that head
    //    instead, and the lump it makes is the head's hitbox from then on. What
    //    the lump hits bounces it; what it would break, it picks up too. When
    //    the clock runs out everything stuck on falls off and hits nothing.
    //
    //    A piece sticks where it was hit and is then drawn in, as if the head
    //    had gravity, until it rests against the head or against pieces
    //    already packed in closer. Left where they were hit, a lump grew out
    //    along whatever line it had been hitting bricks on and ended up a
    //    stick; drawn in, it stays a ball.
    //
    // The others each have their own section below: LASER, PORTAL, MIRROR,
    // CROWD, MIDAS, LUCKY and WILD.
    //
    // Every number is a let so the lab's panel can reach it and Paul can tune
    // it live.

    let KAT_SECS  = 6;      // how long it lasts
    let KAT_MAX   = 10;     // most bricks one head carries; past this they just break
    // At most KAT_BURST pickups per head in any KAT_WINDOW seconds. Without a
    // limit a spinning lump swept up a brick, which put it in reach of the
    // next, which put it in reach of the next, and the whole wall went in a
    // moment. A window rather than a gap between pickups, so two quick ones
    // still land together. While it is full the head still breaks what it
    // hits, but nothing sticks; the lump only bounces off, unless
    // KAT_WAIT_BREAKS lets it break them too.
    let KAT_BURST  = 2;
    let KAT_WINDOW = 1;
    let KAT_WAIT_BREAKS = 0;
    let KAT_SCALE = 0.7;    // a brick's size once it is stuck on
    let KAT_GRAV  = 320;    // px/s a piece is drawn in toward the head at
    let KAT_PACK  = 0.8;    // how tight they pack: 1 just touching, lower overlaps
    let KAT_WRAP  = 0.6;    // how far a piece turns to lie along the lump, 1 all the way
    let KAT_ROLL  = 1;      // how much of the head's turning the lump turns with
    let KAT_DRAG  = 0.12;   // spin each stuck brick takes off, a share per second
    let KAT_PAD   = 1;      // 1: what is stuck on bounces off him too; 0: only the head does
    let KAT_SHED  = 170;    // px/s the pieces fly off at when it wears off
    let KAT_FALL  = 900;    // px/s^2 they fall at
    const KAT_COOL = 0.08;  // seconds one brick is left alone after the lump hits it
    LAB_KNOBS.push('KAT_SECS', 'KAT_MAX', 'KAT_BURST', 'KAT_WINDOW', 'KAT_WAIT_BREAKS', 'KAT_SCALE', 'KAT_GRAV', 'KAT_PACK', 'KAT_WRAP',
                   'KAT_ROLL', 'KAT_DRAG', 'KAT_PAD', 'KAT_SHED', 'KAT_FALL');

    // the capsules this file adds, the rest of CAPS being the game's own
    const POW_KEYS = ['K', 'L', 'T', 'I', 'C', 'A', 'U', '?'];

    let katLoose = [];      // what fell off, falling
    let katOn = new Set();  // the heads carrying anything
    let katField = null;    // the bricks[] it was all picked up from
    let powShow = false;    // KATAMARI's hitbox overlay, for the lab's panel

    // ---- the lump ------------------------------------------------------------------
    // A stuck brick is tested by the edge of his mask: the solid cells with an
    // empty one or the edge beside them. That is about half the cells, and
    // enough, because a lump moves a few px a substep and cannot get a brick
    // between two edge points before one of them is inside it.
    let katEdge = null;
    function katEdgePts() {
        if (katEdge) return katEdge;
        katEdge = [];
        const solid = (r, c) => r >= 0 && r < MROWS && c >= 0 && c < MCOLS && MASK[r][c] === '#';
        for (let r = 0; r < MROWS; r++) for (let c = 0; c < MCOLS; c++) {
            if (!solid(r, c)) continue;
            if (solid(r - 1, c) && solid(r + 1, c) && solid(r, c - 1) && solid(r, c + 1)) continue;
            katEdge.push({ u: (c + 0.5) / MCOLS - 0.5, v: (r + 0.5) / MROWS - 0.5 });
        }
        return katEdge;
    }

    // where a stuck brick is, and which way it faces, now
    function katPose(b, p) {
        const c = Math.cos(b.katA), s = Math.sin(b.katA);
        return { x: b.x + p.ox * c - p.oy * s, y: b.y + p.ox * s + p.oy * c, a: b.katA + p.oa };
    }

    // fn(x, y) for every edge point of everything stuck on; false stops it
    function katEach(b, fn) {
        const pts = katEdgePts();
        for (const p of b.kat) {
            const q = katPose(b, p), pc = Math.cos(q.a), ps = Math.sin(q.a);
            for (const e of pts) {
                const u = e.u * p.w, v = e.v * p.h;
                if (fn(q.x + u * pc - v * ps, q.y + u * ps + v * pc) === false) return;
            }
        }
    }

    // whether this head has had its KAT_BURST pickups inside the last KAT_WINDOW
    function katFull(b) {
        const t = b.katTimes || (b.katTimes = []);
        while (t.length && clock - t[0] >= KAT_WINDOW) t.shift();
        return t.length >= KAT_BURST;
    }

    function katReach(b) {
        let r = 0;
        for (const p of b.kat) r = Math.max(r, Math.hypot(p.ox, p.oy) + Math.hypot(p.w, p.h) / 2);
        return r;
    }

    // How much room a piece takes for packing: a circle of its own area. He
    // is long and thin, so this undersells his length and oversells his
    // depth, which is what lets a lump of them close up into something round.
    const katR = p => Math.sqrt(p.w * p.h) / 2;

    // whether a point is inside a brick's own outline, wiggle and all
    function katInBrick(br, x, y) {
        const a = br.wigA || 0;
        if (a) {
            const ccx = br.x + bw / 2, ccy = br.y + bh / 2;
            const c = Math.cos(-a), s = Math.sin(-a), dx = x - ccx, dy = y - ccy;
            x = ccx + dx * c - dy * s;
            y = ccy + dx * s + dy * c;
        }
        const c = Math.floor((x - br.x) / (bw / MCOLS)), r = Math.floor((y - br.y) / (bh / MROWS));
        return r >= 0 && r < MROWS && c >= 0 && c < MCOLS && MASK[r][c] === '#';
    }

    // hitBrick has just killed one. If a head on KATAMARI did it, the brick
    // goes onto that head where it was, and powUpdate draws it in from there.
    function powBrickGone(br) {
        crSpawn(br);
        const b = labHitBy;
        if (!(fx.K > 0) || !b || !balls.includes(b)) return;
        if (!b.kat) { b.kat = []; b.katA = 0; b.katWas = b.angle; }
        if (b.kat.length >= KAT_MAX || katFull(b)) return;
        b.katTimes.push(clock);
        const dx = br.x + bw / 2 - b.x, dy = br.y + bh / 2 - b.y;
        const c = Math.cos(-b.katA), s = Math.sin(-b.katA);
        const multi = br.kind === 'S' || br.kind === 'A';
        b.kat.push({ ox: dx * c - dy * s, oy: dx * s + dy * c, oa: (br.wigA || 0) - b.katA,
                     w: bw * KAT_SCALE, h: bh * KAT_SCALE, sw: bw, sh: bh,
                     kind: multi ? 'S2' : br.kind });
        katOn.add(b);
        if (round) round.cosmos = Math.max(round.cosmos, b.kat.length);     // COSMOS KING
    }

    // everything on this head comes off, flying outward, and hits nothing
    function katShed(b) {
        for (const p of b.kat || []) {
            const q = katPose(b, p);
            const dx = q.x - b.x, dy = q.y - b.y, d = Math.hypot(dx, dy) || 1;
            katLoose.push({ x: q.x, y: q.y, a: q.a, w: p.w, h: p.h, sw: p.sw, sh: p.sh, kind: p.kind,
                            vx: b.vx * 0.25 + dx / d * KAT_SHED, vy: b.vy * 0.25 + dy / d * KAT_SHED - 60,
                            va: (Math.random() - 0.5) * 8, t: 0 });
        }
        b.kat = null;
        katOn.delete(b);
    }

    // The pull. Nearest first, each piece comes in toward the head at
    // KAT_GRAV until it would be closer to the head, or to one already
    // nearer in, than their two sizes allow -- so the first ones settle on
    // the head and the later ones on top of them. As it comes it turns to
    // lie along the lump rather than stick out of it, by KAT_WRAP.
    function katGather(b, dt) {
        const head = Math.max(bRX(), bRY());
        const list = b.kat.slice().sort((p, q) => Math.hypot(p.ox, p.oy) - Math.hypot(q.ox, q.oy));
        const done = [];
        for (const p of list) {
            const d = Math.hypot(p.ox, p.oy) || 1e-4;
            const ux = p.ox / d, uy = p.oy / d;
            // the nearest this piece may come, along its own line in
            let stop = (head + katR(p)) * KAT_PACK;
            for (const q of done) {
                // where along that line it would first meet q
                const along = q.ox * ux + q.oy * uy, off2 = q.ox * q.ox + q.oy * q.oy - along * along;
                const need = (katR(p) + katR(q)) * KAT_PACK;
                if (off2 < need * need) stop = Math.max(stop, along + Math.sqrt(need * need - off2));
            }
            const nd = Math.max(Math.min(d, stop), d - KAT_GRAV * dt);
            p.ox = ux * nd; p.oy = uy * nd;
            // lying along the lump is his long axis square to the line in
            const want = Math.atan2(uy, ux) + Math.PI / 2;
            let turn = want - p.oa;
            turn = Math.atan2(Math.sin(turn), Math.cos(turn));
            if (Math.abs(turn) > Math.PI / 2) turn -= Math.sign(turn) * Math.PI;   // either end will do
            p.oa += turn * KAT_WRAP * Math.min(1, dt * 6);
            done.push(p);
        }
    }

    // Once a substep, from stepBall, after the head has met the bricks: the
    // lump against the walls, the bricks and him. It is one rigid thing with
    // the head, so whatever it hits turns the head, pushed off the way the
    // head's middle lies from where it struck.
    function powBallStep(b) {
        mrStep(b);
        crStep(b);
        if (!b.kat || !b.kat.length) return;
        const s = effSpeed() * (b.boost || 1);

        let x0 = Infinity, x1 = -Infinity, y0 = Infinity;
        katEach(b, (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); });
        if (!ptOn()) {           // PORTAL takes the side walls away from the lump as well
            if (x0 < 0)  { b.x -= x0;      if (b.vx < 0) { b.vx = -b.vx; b.spin *= SPIN_WALL; } }
            if (x1 > LW) { b.x -= x1 - LW; if (b.vx > 0) { b.vx = -b.vx; b.spin *= SPIN_WALL; } }
        }
        if (y0 < 0)  { b.y -= y0;      if (b.vy < 0) { b.vy = -b.vy; b.spin *= SPIN_WALL; } }

        const reach = katReach(b), half = Math.hypot(bw, bh) / 2;
        for (const br of hitOrder()) {
            if (!br.alive || br.lab || br.kind === 'Z' || (br.katCool || 0) > clock) continue;
            if (Math.hypot(br.x + bw / 2 - b.x, br.y + bh / 2 - b.y) > reach + half) continue;
            let sx = 0, sy = 0, n = 0;
            katEach(b, (x, y) => { if (katInBrick(br, x, y)) { sx += x; sy += y; n++; } });
            if (!n) continue;
            const cx = sx / n, cy = sy / n;
            let nx = b.x - cx, ny = b.y - cy;
            const len = Math.hypot(nx, ny) || 1;
            nx /= len; ny /= len;
            const dot = b.vx * nx + b.vy * ny;
            if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; }
            b.x += nx * 4; b.y += ny * 4;
            if (Math.abs(b.vy) < s * 0.16) {        // the engine's own floor on a flat bounce
                b.vy = (b.vy < 0 ? -1 : 1) * s * 0.16;
                const q = Math.hypot(b.vx, b.vy) || 1;
                b.vx = b.vx / q * s; b.vy = b.vy / q * s;
            }
            br.katCool = clock + KAT_COOL;
            if (katFull(b) && !KAT_WAIT_BREAKS) {      // window full: a bounce, no wound
                rings.push({ x: cx, y: cy, t: 1 });
                bumpSpeed(BRICK_BUMP);
                break;
            }
            if (labGlances(br, { cx, cy })) rings.push({ x: cx, y: cy, t: 1 });
            else kick(br, -nx, -ny, 1);
            labHitBy = b;
            hitBrick(br, cx, cy);
            labHitBy = null;
            bumpSpeed(BRICK_BUMP);
            break;
        }

        if (!KAT_PAD || b.vy <= 0) return;
        for (const sg of segs()) {
            const d = katDeepest(b, sg);
            if (!d) continue;
            katPadHit(b, sg, d.lx, d.depth);
            break;
        }
    }

    // the stuck-on point furthest into one of him, in his own frame, or null
    function katDeepest(b, sg) {
        const hw = sg.w / 2, a = paddle.dip[sg.i], ca = Math.cos(a), sa = Math.sin(a), py = padY();
        let best = null;
        katEach(b, (x, y) => {
            const dx = x - sg.cx, dy = y - py;
            const lx = dx * ca + dy * sa, ly = dy * ca - dx * sa;
            if (Math.abs(lx) > hw) return;
            const e = bodyAt(lx, hw);
            if (!e || ly < e.top || ly > e.bot) return;
            if (!best || ly - e.top > best.depth) best = { lx, depth: ly - e.top };
        });
        return best;
    }

    // What the paddle block in stepBall does when a head lands on him, for a
    // lump landing on him instead: lifted back out of him, sent off at the
    // angle where it touched sets, and counted as the head coming home.
    function katPadHit(b, sg, lx, depth) {
        const hw = sg.w / 2, a = paddle.dip[sg.i];
        b.x += Math.sin(a) * depth; b.y -= Math.cos(a) * depth;
        const off = Math.max(-1, Math.min(1, lx / hw));
        const dipped = DIP_MAX > 0 ? Math.min(1, Math.abs(a) / DIP_MAX) : 0;
        aim(b, off * MAX_ANGLE * labPadAngle() * (1 - dipped) + a + segWig(sg.i));
        const kick = Math.max(-SPIN_KICK, Math.min(SPIN_KICK,
                              off * SPIN_EDGE * labPadEdge() + paddle.vx * SPIN_SWIPE * labPadSwipe()));
        b.spin = Math.max(-SPIN_MAX, Math.min(SPIN_MAX, b.spin + kick / SPIN_INERTIA));
        if (kick) b.kickDir = Math.sign(kick);
        paddle.jt[sg.i] = 1;
        paddle.tilt[sg.i] = off;
        labPadHit(b);
        combo = 0;
        b.pierced.clear();
        b.boost = 1;
        if (++hits === 4 || hits === 12) bumpSpeed(1.12);
    }

    // ---- once a frame --------------------------------------------------------------
    function powUpdate(dt) {
        CAPS.K.secs = KAT_SECS;
        CAPS.T.secs = PT_SECS;
        CAPS.I.secs = MR_SECS; CAPS.C.secs = CR_SECS;
        CAPS.A.secs = MD_SECS;
        CAPS.U.secs = LK_SECS;

        // a new stage: nothing carries over
        if (bricks !== katField) { katField = bricks; katLoose = []; katOn.clear(); }

        for (const b of katOn) if (!(fx.K > 0) || !balls.includes(b)) katShed(b);
        for (const b of katOn) {
            b.katA += (b.angle - b.katWas) * KAT_ROLL;
            b.katWas = b.angle;
            b.spin -= b.spin * Math.min(1, KAT_DRAG * b.kat.length * dt);
            katGather(b, dt);
        }
        for (const p of katLoose) {
            p.vy += KAT_FALL * dt;
            p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt; p.t += dt;
        }
        katLoose = katLoose.filter(p => p.y - p.w < LH);

        lzUpdate(dt);
        lkUpdate();
        mdUpdate(dt);
        wdUpdate();
        crUpdate(dt);
    }

    // ==== LASER ====================================================================
    // L  LASER BRANDON: a gun on each end of him. Every LZ_EVERY seconds both
    //    fire a head, LZ_BURSTS times, so three bursts is six heads. The guns
    //    are fixed to him, so they lean as he leans and turn as BLUE BLUR
    //    turns, and a shot goes the way its gun is pointing.
    //    With LZ_STAYS off a shot is a bolt: it breaks (or hurts) the first
    //    thing it meets and is gone, as Arkanoid's laser was. On, each shot is
    //    a real head that joins the rally.
    let LZ_EVERY  = 2;      // seconds between bursts
    let LZ_BURSTS = 3;      // bursts a capsule gives
    let LZ_FIRST  = 0;      // seconds after pickup the first goes; 0 fires at once
    let LZ_SPEED  = 720;    // px/s a bolt climbs at
    let LZ_SIZE   = 0.6;    // a bolt's size, as a share of a head
    let LZ_MOUNT  = 0.9;    // where the guns sit, as a share of the way out to his ends
    let LZ_STAYS  = 0;      // 1: every shot is a head in play, not a bolt
    LAB_KNOBS.push('LZ_EVERY', 'LZ_BURSTS', 'LZ_FIRST', 'LZ_SPEED', 'LZ_SIZE', 'LZ_MOUNT', 'LZ_STAYS');
    const LZ_FLASH = 0.12;  // seconds of muzzle flash

    let lzBolts = [];       // shots in the air
    let lzT = -1;           // seconds since pickup, or -1 with no capsule on
    let lzFired = 0;        // bursts gone this capsule
    let lzWas = 0;          // fx.L last frame, so a fresh capsule can be told from an old one
    let lzFlash = 0;

    // The two muzzles, on the outside ends of the outermost of him: where
    // each sits and which way it points (`a`, 0 straight up), both turned
    // with the end it is on.
    function lzGuns() {
        const sgs = segs();
        let l = sgs[0], r = sgs[0];
        for (const sg of sgs) { if (sg.cx < l.cx) l = sg; if (sg.cx > r.cx) r = sg; }
        const ly = -padH() * 0.35;
        const at = (sg, side) => {
            const a = segWig(sg.i) + paddle.dip[sg.i], ca = Math.cos(a), sa = Math.sin(a);
            const lx = side * sg.w / 2 * LZ_MOUNT;
            return { x: sg.cx + lx * ca - ly * sa, y: padY() + lx * sa + ly * ca, a, sg };
        };
        return [at(l, -1), at(r, 1)];
    }

    function lzFire() {
        lzFlash = LZ_FLASH;
        for (const g of lzGuns()) {
            const dx = Math.sin(g.a), dy = -Math.cos(g.a);
            if (LZ_STAYS) {
                const b = newBall(g.x + dx * bRY(), g.y + dy * bRY());
                const a = g.a + (Math.random() - 0.5) * 0.1, s = effSpeed();
                b.vx = Math.sin(a) * s; b.vy = -Math.cos(a) * s;
                balls.push(b);
            } else {
                const off = bRY() * LZ_SIZE;
                lzBolts.push({ x: g.x + dx * off, y: g.y + dy * off, dx, dy, a: 0, spin: (Math.random() - 0.5) * 30 });
            }
        }
        if (balls.length >= HEADS_AT) round.heads = true;
    }

    // A bolt meets things the way a head does, through labContact, so bosses
    // and mini-bosses answer it with their own shapes -- tested at a head's
    // size, which a bolt is near enough to that nobody sees the difference.
    function lzStep(dt) {
        const n = Math.max(1, Math.ceil(LZ_SPEED * dt / SUBSTEP_PX));
        for (let k = 0; k < n; k++) {
            for (let i = lzBolts.length - 1; i >= 0; i--) {
                const z = lzBolts[i];
                z.x += z.dx * LZ_SPEED * dt / n;
                z.y += z.dy * LZ_SPEED * dt / n;
                z.a += z.spin * dt / n;
                const m = bRY();
                if (z.y < -m || z.y > LH + m || z.x < -m || z.x > LW + m) { lzBolts.splice(i, 1); continue; }
                const probe = newBall(z.x, z.y);
                probe.angle = z.a; probe.vx = z.dx * LZ_SPEED; probe.vy = z.dy * LZ_SPEED;
                for (const br of hitOrder()) {
                    if (!br.alive) continue;
                    const hit = labContact(br, probe);
                    if (!hit) continue;
                    if (labGlances(br, hit)) rings.push({ x: hit.cx, y: hit.cy, t: 1 });
                    else kick(br, z.dx, z.dy, 1);
                    // SNIPER, if this is the shot that ends the round: set
                    // before the hit, since the hit is what adds the round up
                    const last = bricks.filter(o => o.alive && o.kind !== 'X');
                    round.sniper = last.length === 1 && last[0] === br;
                    hitBrick(br, hit.cx, hit.cy);
                    if (phase === 'play') round.sniper = false;
                    lzBolts.splice(i, 1);
                    break;
                }
                if (phase !== 'play') { lzBolts = []; return; }
            }
        }
    }

    function lzUpdate(dt) {
        CAPS.L.secs = LZ_FIRST + LZ_EVERY * Math.max(1, LZ_BURSTS);
        if (lzFlash > 0) lzFlash = Math.max(0, lzFlash - dt);
        const now = fx.L || 0;
        if (now > lzWas + 1e-6) { lzT = 0; lzFired = 0; }     // a capsule just caught
        lzWas = now;
        if (!(now > 0)) lzT = -1;
        if (phase !== 'play') { lzBolts = []; return; }
        if (lzT >= 0) {
            lzT += dt;
            while (lzFired < LZ_BURSTS && lzT >= LZ_FIRST + lzFired * LZ_EVERY) { lzFire(); lzFired++; }
        }
        lzStep(dt);
    }

    // the guns ride on him while it is on, and flash as they go
    function lzDraw() {
        for (const z of lzBolts) {
            // its trail streams out behind it, whichever way it is going
            ctx.save();
            ctx.translate(z.x, z.y);
            ctx.rotate(Math.atan2(z.dx, -z.dy));
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = CAPS.L.color;
            ctx.fillRect(-2, 0, 4, bRY() * 2.2);
            ctx.restore();
            drawBall(z.x, z.y, bRX() * LZ_SIZE, z.a);
        }
        if (lzT < 0 || !(phase === 'play' || phase === 'ready')) return;
        for (const g of lzGuns()) {
            const o = paddle.jt[g.sg.i] > 0 ? wobble(paddle.jt[g.sg.i]) * JIG_PADDLE : 0;
            ctx.save();
            ctx.translate(g.x, g.y + o);
            ctx.rotate(g.a);
            ctx.fillStyle = '#2b2b2e';
            ctx.fillRect(-5, -16, 10, 22);
            ctx.fillStyle = CAPS.L.color;
            ctx.fillRect(-3, -20, 6, 6);
            if (lzFlash > 0) {
                ctx.globalAlpha = lzFlash / LZ_FLASH;
                ctx.beginPath(); ctx.arc(0, -22, 9, 0, 7); ctx.fill();
            }
            ctx.restore();
        }
    }

    // ==== PORTAL ===================================================================
    // T  PORTAL BRANDON (T for porTal): the side walls are gone. A head that
    //    goes out one side comes in the other at the same height and speed,
    //    as Pac-Man's tunnel or Super Mario Bros. 2's wrapping screens do. He
    //    still stops at the edges; only heads go through.
    let PT_SECS  = 10;
    let PT_GLOW  = 10;      // px, how far the portals' light reaches in from each edge
    LAB_KNOBS.push('PT_SECS', 'PT_GLOW');
    const PT_IN  = '#ff9a3c';   // the left edge's colour, and the right's
    const PT_OUT = '#3ca0ff';

    // The last PT_NEAR px before either edge, a head is eased down toward
    // PT_CATCH px/s, and back up as it comes away from the other. Only its
    // speed: the line it is on never changes. At full speed a head through a
    // portal came out too fast to read, let alone get under; this gives a
    // player time to see where it went. 0 PT_NEAR turns it off.
    let PT_NEAR  = 140;
    let PT_CATCH = 360;
    LAB_KNOBS.push('PT_NEAR', 'PT_CATCH');

    // On while the capsule lasts, and all the time in CHELL's hands -- bosses
    // included: the capsule never drops on a boss (CAPS.T.noBoss), but it is
    // her paddle's own, not a capsule
    const ptOn = () => fx.T > 0 || labPadPortal();

    // what stepBall multiplies this head's speed by, near a portal
    function powSlow(b, s) {
        if (!ptOn() || PT_NEAR <= 0 || s <= PT_CATCH) return 1;
        const d = Math.min(Math.max(0, b.x), Math.max(0, LW - b.x));
        if (d >= PT_NEAR) return 1;
        const k = 1 - d / PT_NEAR, e = k * k * (3 - 2 * k);
        return 1 + (PT_CATCH / s - 1) * e;
    }

    // stepBall's side walls: true when PORTAL has taken them. Each trip
    // through is a PORTALED on the round's bonus.
    function powWrap(b) {
        if (!ptOn()) return false;
        if (b.x < 0 || b.x > LW) {
            b.x += b.x < 0 ? LW : -LW;
            if (round) round.portaled++;
        }
        return true;
    }

    // His share that may go through a wall while PORTAL is on: that much of
    // him sticks out of the other side, and hits and catches there.
    let PT_THROUGH = 0.75;
    LAB_KNOBS.push('PT_THROUGH');

    // how far past a wall his middle may go (padLimit). Never in the town,
    // where leaning on a wall is how a paddle is changed.
    function ptReach() {
        return ptOn() && !(typeof menuUp === 'function' && menuUp()) ? PT_THROUGH * 2 * halfSpan() : 0;
    }
    // An absolute pointer stops at the field's edge, which only puts his
    // middle on the wall. So within half his span of a wall it carries him
    // faster, and at the very edge he is as far through as ptReach allows.
    function ptAim(x) {
        const r = ptReach();
        if (!r) return x;
        const hs = halfSpan();
        if (x < hs) return hs - (hs - x) * r / hs;
        if (x > LW - hs) return LW - hs + (x - (LW - hs)) * r / hs;
        return x;
    }
    // segs() plus a copy, on the far side, of any of him that is through a wall
    function ptSegs(list) {
        if (!ptReach()) return list;
        const out = list.slice();
        for (const sg of list) {
            if (sg.cx - sg.w / 2 < 0) out.push({ cx: sg.cx + LW, w: sg.w, i: sg.i });
            else if (sg.cx + sg.w / 2 > LW) out.push({ cx: sg.cx - LW, w: sg.w, i: sg.i });
        }
        return out;
    }

    // not in the town, where there is no head to go through them
    function ptDraw() {
        if (!ptOn() || (typeof menuUp === 'function' && menuUp())) return;
        const a = (fx.T > 0 ? Math.min(1, fx.T / 0.6) : 1) * (0.75 + 0.25 * Math.sin(clock * 5));
        for (const [x0, ink, dir] of [[0, PT_IN, 1], [LW, PT_OUT, -1]]) {
            const g = ctx.createLinearGradient(x0, 0, x0 + dir * PT_GLOW, 0);
            g.addColorStop(0, ink);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = a;
            ctx.fillStyle = g;
            ctx.fillRect(Math.min(x0, x0 + dir * PT_GLOW), 0, PT_GLOW, LH);
        }
        ctx.globalAlpha = 1;
    }

    // ==== MIRROR and CROWD ==========================================================
    // I  MIRROR (I for mIrror): a copy of him on the ceiling, upside down,
    //    right above you and moving as you move, as a reflection does. A head that reaches it comes back down at an
    //    angle set by where it hit, the way he sends them up.
    // C  CROWD: every brick broken while it is on drops a small brandon who
    //    runs along the floor. Each one bounces a head that reaches him, once.

    let MR_SECS  = 10;
    let MR_Y     = 12;      // px from the top to his middle
    let MR_SCALE = 0.75;    // his size, as a share of yours
    let CR_SECS  = 20;
    let CR_MAX   = 8;       // most on the floor at once
    let CR_SIZE  = 36;      // px tall
    let CR_SPEED = 90;      // px/s they run at
    let CR_LIFE  = 30;      // seconds each one lasts
    LAB_KNOBS.push('MR_SECS', 'MR_Y', 'MR_SCALE',
                   'CR_SECS', 'CR_MAX', 'CR_SIZE', 'CR_SPEED', 'CR_LIFE');

    // A head's real ellipse against one of him lying at cx, cy, turned upside
    // down if `flip`: touching() in engine.js, for a brandon that is not the
    // paddle. null if it is not on him.
    function powTouch(b, cx, cy, hw, flip) {
        let lx = b.x - cx, ly = b.y - cy;
        if (flip) { lx = -lx; ly = -ly; }
        const tc = Math.cos(b.angle), ts = Math.sin(b.angle);
        const lrx = Math.hypot(bRX() * tc, bRY() * ts), lry = Math.hypot(bRX() * ts, bRY() * tc);
        if (Math.abs(lx) >= hw + lrx || Math.abs(ly) >= bodyHalfH(hw * 2) + lry) return null;
        const rest = restOn(lx, hw, lrx, lry);
        if (rest === null || ly < rest) return null;
        const under = bodyUnder(lx, lrx, hw);
        if (under === null || ly - lry > under) return null;
        return { lx, rest };
    }

    // him drawn anywhere: the photograph, turned `rot` more than level
    function powArt(cx, cy, w, rot, alpha) {
        if (!ready(paddleImg)) return;
        const artW = w / BODY_LEN_PER_W, artH = artW / PADDLE_ASPECT;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(cx, cy);
        ctx.rotate(rot + PADDLE_LEVEL);
        ctx.drawImage(paddleImg, -artW / 2 - ART_OFF_X * artW, -artH / 2 - ART_OFF_Y * artH, artW, artH);
        ctx.restore();
    }

    // ---- mirror
    function mrSegs() {
        return segs().map(sg => ({ cx: sg.cx, cy: MR_Y, hw: sg.w / 2 * MR_SCALE, sg }));
    }
    function mrStep(b) {
        if (!(fx.I > 0) || b.vy >= 0) return;
        for (const m of mrSegs()) {
            const c = powTouch(b, m.cx, m.cy, m.hw, true);
            if (!c) continue;
            b.y = m.cy - c.rest;
            const off = Math.max(-1, Math.min(1, (b.x - m.cx) / m.hw));
            const a = Math.max(-STEER_CAP, Math.min(STEER_CAP, off * MAX_ANGLE));
            const sp = Math.hypot(b.vx, b.vy);
            b.vx = Math.sin(a) * sp; b.vy = Math.cos(a) * sp;
            return;
        }
    }
    function mrDraw() {
        if (!(fx.I > 0)) return;
        for (const m of mrSegs()) powArt(m.cx, m.cy, m.hw * 2, Math.PI, Math.min(1, fx.I / 0.6));
    }

    // ---- crowd
    let crowd = [];
    const crFloor = () => LH - CR_SIZE / 2 - 2;
    function crSpawn(br) {
        if (!(fx.C > 0) || crowd.filter(r => !r.pop).length >= CR_MAX) return;
        crowd.push({ x: br.x + bw / 2, y: br.y + bh / 2, vy: -80, dir: Math.random() < 0.5 ? -1 : 1,
                     t: 0, pop: 0, ph: Math.random() * 6 });
    }
    function crUpdate(dt) {
        if (bricks !== crUpdate.field) { crUpdate.field = bricks; crowd = []; }
        for (const r of crowd) {
            r.t += dt;
            if (r.pop) { r.pop += dt; r.y -= 120 * dt; continue; }
            if (r.y < crFloor()) {
                r.vy += 900 * dt;
                r.y = Math.min(crFloor(), r.y + r.vy * dt);
            } else {
                r.x += r.dir * CR_SPEED * dt;
                if (r.x < CR_SIZE / 2) { r.x = CR_SIZE / 2; r.dir = 1; }
                if (r.x > LW - CR_SIZE / 2) { r.x = LW - CR_SIZE / 2; r.dir = -1; }
            }
            if (r.t > CR_LIFE) r.pop = 1e-6;
        }
        crowd = crowd.filter(r => r.pop < 0.4);
    }
    function crStep(b) {
        if (b.vy <= 0) return;
        const hw = CR_SIZE * 0.25, hh = CR_SIZE / 2;
        for (const r of crowd) {
            if (r.pop) continue;
            const ex = extX(b), ey = extY(b);
            if (Math.abs(b.x - r.x) >= hw + ex || Math.abs(b.y - r.y) >= hh + ey) continue;
            b.y = r.y - hh - ey;
            aim(b, Math.max(-1, Math.min(1, (b.x - r.x) / (hw + ex))) * MAX_ANGLE * 0.7);
            combo = 0;
            b.pierced.clear();
            r.pop = 1e-6;
            return;
        }
    }
    // stood up, waddling, facing the way he runs
    function crDraw() {
        if (!ready(paddleImg)) return;
        for (const r of crowd) {
            const artW = CR_SIZE / BODY_LEN_PER_W, artH = artW / PADDLE_ASPECT;
            ctx.save();
            ctx.globalAlpha = r.pop ? Math.max(0, 1 - r.pop / 0.4) : 1;
            ctx.translate(r.x, r.y - Math.abs(Math.sin(r.t * 12 + r.ph)) * 3);
            ctx.scale(r.dir, 1);
            ctx.rotate(PADDLE_LEVEL - Math.PI / 2 + Math.sin(r.t * 12 + r.ph) * 0.12);
            ctx.drawImage(paddleImg, -artW / 2 - ART_OFF_X * artW, -artH / 2 - ART_OFF_Y * artH, artW, artH);
            ctx.restore();
        }
    }

    // ==== MIDAS ===================================================================
    // A  MIDAS BRANDON (A for Au, as gold bricks are): any brick hit while it
    //    is on turns to gold instead of taking the hit. Gold takes MD_HP more
    //    to break and pays MD_PAY when it goes, and it stays gold after the
    //    capsule runs out -- so a wall you touch everywhere is a rich wall and
    //    a long one. While it is on, gold -- turned or born that way -- breaks
    //    in one hit, so what you turned early you can cash in before it ends.
    //    Stone and the bosses are left alone.
    let MD_SECS = 8;
    let MD_HP   = 2;        // hits a turned brick takes
    let MD_PAY  = 150;      // what it pays when it breaks, before the multipliers
    LAB_KNOBS.push('MD_SECS', 'MD_HP', 'MD_PAY');
    const MD_SETTLE = 0.15;
    let mdBits = [];

    // hitBrick's first question after the bosses': true if MIDAS took this hit
    function powHit(b) {
        if (!(fx.A > 0) || b.kind === 'X' || b.kind === 'Z' || b.lab) return false;
        if (b.kind === 'A') {
            // MD_SETTLE after turning, so the same touch cannot turn it and break it
            if (clock - (b.midasAt || -1) > MD_SETTLE) b.hp = 1;
            return false;                          // the engine's gold branch breaks it
        }
        b.kind = 'A';
        b.midas = true;
        b.midasAt = clock;
        b.hp = b.maxHp = Math.max(1, Math.round(MD_HP));
        b.flash = 1;
        for (let n = 0; n < 14; n++) {
            const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 110;
            mdBits.push({ x: b.x + bw / 2 + (Math.random() - 0.5) * bw * 0.8, y: b.y + bh / 2,
                          vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, t: 0 });
        }
        return true;
    }
    function mdUpdate(dt) {
        for (const p of mdBits) { p.t += dt; p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
        mdBits = mdBits.filter(p => p.t < (p.life || 0.6));
        for (const r of mdRings) r.t += dt;
        mdRings = mdRings.filter(r => r.t < GB_RING);
    }
    function mdDraw() {
        for (const r of mdRings) {
            const k = r.t / GB_RING;
            ctx.globalAlpha = 1 - k;
            ctx.strokeStyle = GOLD;
            ctx.lineWidth = 3 * (1 - k) + 1;
            ctx.beginPath();
            ctx.ellipse(r.x, r.y, bw * (0.3 + k * 0.9), bh * (0.5 + k * 1.4), 0, 0, 7);
            ctx.stroke();
        }
        for (const p of mdBits) {
            ctx.globalAlpha = 1 - p.t / (p.life || 0.6);
            ctx.fillStyle = p.ink || GOLD;
            const z = p.size || 3;
            ctx.fillRect(p.x - z / 2, p.y - z / 2, z, z);
        }
        ctx.globalAlpha = 1;
    }

    // ---- gold going ----------------------------------------------------------------
    // Every gold brick, MIDAS's or born, goes out in a little fanfare: a ring
    // of gold thrown off it and a fountain of coins and glints, so breaking
    // one always feels like a payout. hitBrick calls it.
    let GB_BITS = 34;       // pieces thrown
    let GB_RING = 0.45;     // seconds the ring takes to spread and fade
    LAB_KNOBS.push('GB_BITS', 'GB_RING');
    let mdRings = [];
    function goldBurst(b) {
        const x = b.x + bw / 2, y = b.y + bh / 2;
        mdRings.push({ x, y, t: 0 });
        for (let n = 0; n < GB_BITS; n++) {
            const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6, v = 90 + Math.random() * 190;
            mdBits.push({ x: x + (Math.random() - 0.5) * bw * 0.7, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
                          t: 0, life: 0.7 + Math.random() * 0.5, size: 2 + Math.random() * 3,
                          ink: Math.random() < 0.3 ? '#fff6d8' : GOLD });
        }
    }

    // ---- gold's cracks -------------------------------------------------------------
    // Gold takes several hits and stays gold to the last, so what it has left
    // is shown as cracks. Each starts at the edge of his outline -- where a
    // knock would start one -- and wanders in along his length, thinning as
    // it goes, now and then splitting. GC_PER more for each third of it gone,
    // on top of the ones already there, so a brick cracks further rather than
    // differently. GC_LOOKS layouts, picked off each brick's own sway phase,
    // so a row of gold does not crack alike. Baked once per layout and level,
    // cut to his silhouette; drawn inside drawBrick, like the glint.
    const GC_SETS = 3;
    const GC_PER = 2;
    const GC_LOOKS = 3;
    // every crack layout v has, as polylines in his box: [points, width at the start]
    function gcPaths(v) {
        let seed = 977 + v * 7919;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        const edge = katEdgePts(), out = [];
        const walk = (x, y, a, steps, w0) => {
            const pts = [[x, y]], step = bw * 0.04;
            for (let i = 0; i < steps; i++) {
                a += (rnd() - 0.5) * 1.1;
                x += Math.cos(a) * step * (0.7 + rnd() * 0.6);
                y += Math.sin(a) * step * 0.55 * (0.7 + rnd() * 0.6);
                pts.push([x, y]);
                if (i === (steps >> 1) && rnd() < 0.6) walk(x, y, a + (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 0.5), 3 + ((rnd() * 2) | 0), w0 * 0.6);
            }
            const entry = [pts, w0];
            out.push(entry);
            return entry;
        };
        for (let i = 0; i < GC_SETS * GC_PER; i++) {
            const e = edge[(rnd() * edge.length) | 0];
            const x = (e.u + 0.5) * bw, y = (e.v + 0.5) * bh;
            // in from the edge it starts on, mostly along his length
            const along = e.u < 0 ? 0 : Math.PI, toMid = Math.atan2(bh / 2 - y, (bw / 2 - x) * 0.4);
            const a = along + Math.atan2(Math.sin(toMid - along), Math.cos(toMid - along)) * 0.4;
            // its trunk, so the levels count cracks, not branches
            walk(x, y, a, 5 + ((rnd() * 4) | 0), 2.4).first = true;
        }
        return out;
    }
    const gcCache = {};
    function gcSprite(v, level) {
        const k = 'goldCrack' + v + '.' + level + '@' + Math.round(bw);
        if (spriteCache.has(k)) return spriteCache.get(k);
        const sil = shapeSprite('glint', '#fff6d8', bw, bh, true);
        if (!sil || !katEdgePts().length) return null;
        const c = document.createElement('canvas');
        c.width = sil.width; c.height = sil.height;
        const g = c.getContext('2d');
        g.scale(c.width / bw, c.height / bh);
        g.lineCap = 'round'; g.lineJoin = 'round';
        // a crack's trunk and the branches walked off it are pushed together,
        // branches first, so take trunks in order and everything before each
        const paths = gcCache[v + '@' + Math.round(bw)] || (gcCache[v + '@' + Math.round(bw)] = gcPaths(v));
        let trunks = 0, upto = 0;
        for (let i = 0; i < paths.length; i++) {
            if (paths[i].first && ++trunks > level * GC_PER) break;
            upto = i + 1;
        }
        for (const [dx, ink, wk] of [[0.7, 'rgba(255, 244, 200, 0.7)', 1.5], [0, 'rgba(80, 50, 4, 1)', 1]]) {
            g.strokeStyle = ink;
            for (const [pts, w0] of paths.slice(0, upto)) {
                for (let i = 1; i < pts.length; i++) {
                    g.lineWidth = Math.max(0.6, w0 * wk * (1 - i / pts.length * 0.7));
                    g.beginPath();
                    g.moveTo(pts[i - 1][0] + dx, pts[i - 1][1] + dx);
                    g.lineTo(pts[i][0] + dx, pts[i][1] + dx);
                    g.stroke();
                }
            }
        }
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'destination-in';
        g.drawImage(sil, 0, 0);
        spriteCache.set(k, c);
        return c;
    }
    function powCracks(b, kind) {
        if (kind !== 'A' || !(b.maxHp > 1) || b.hp >= b.maxHp) return;
        const level = Math.max(1, Math.min(GC_SETS, Math.ceil((1 - b.hp / b.maxHp) * GC_SETS)));
        const v = Math.floor(((b.wigP || 0) / (Math.PI * 2)) * GC_LOOKS) % GC_LOOKS;
        const sp = gcSprite(Math.max(0, v), level);
        if (sp) ctx.drawImage(sp, -bw / 2, -bh / 2, bw, bh);
    }

    // ---- gold's glimmer ----------------------------------------------------------
    // Gold sat too close to the yellow tier to pick out at a glance, and MIDAS
    // puts a lot of it on the screen. So every gold brick, MIDAS's or not,
    // wears the gloss MODERN does along its top, all the time, and has a band
    // of light cross it every GL_EVERY seconds, and a star that
    // twinkles on it now and then. Each keeps its own time off its own sway
    // phase, so a row of them glints one by one rather than all at once.
    let GL_EVERY = 2.4;     // seconds between sweeps
    let GL_SWEEP = 0.45;    // seconds one takes to cross him
    let GL_ALPHA = 0.6;     // how bright the band is
    let GL_STAR  = 1;       // 1: a twinkle as well; 0: the band alone
    let GL_SHEEN = 0.35;    // the gloss along his top, always on
    LAB_KNOBS.push('GL_EVERY', 'GL_SWEEP', 'GL_ALPHA', 'GL_STAR', 'GL_SHEEN');

    // inside drawBrick, which has already moved to his middle and turned him
    function powGlint(b, kind) {
        if (kind !== 'A') return;
        const sp = shapeSprite('glint', '#fff6d8', bw, bh, true);
        if (!sp) return;
        const gloss = padGloss(padFlat('padGloss', '#ffffff'));
        if (gloss && GL_SHEEN > 0) {
            ctx.globalAlpha = GL_SHEEN;
            ctx.drawImage(gloss, -bw / 2, -bh / 2, bw, bh);
            ctx.globalAlpha = 1;
        }
        const t = ((clock + b.wigP * GL_EVERY / (Math.PI * 2)) % GL_EVERY) / GL_SWEEP;
        if (t < 1) {
            ctx.save();
            ctx.beginPath();
            const x = -bw / 2 + (t * 1.4 - 0.2) * bw;
            ctx.moveTo(x, -bh); ctx.lineTo(x + bw * 0.12, -bh); ctx.lineTo(x - bw * 0.06, bh); ctx.lineTo(x - bw * 0.18, bh);
            ctx.closePath();
            ctx.clip();
            ctx.globalAlpha = GL_ALPHA * Math.sin(t * Math.PI);
            ctx.drawImage(sp, -bw / 2, -bh / 2, bw, bh);
            ctx.restore();
        }
        if (!GL_STAR) return;
        // the twinkle: halfway between sweeps, on a solid cell that changes every time
        const n = Math.floor((clock + b.wigP) / GL_EVERY), u = ((clock + b.wigP) % GL_EVERY) / GL_EVERY;
        const k = Math.max(0, 1 - Math.abs(u - 0.6) / 0.08);
        if (k <= 0) return;
        const cells = katEdgePts();
        const c = cells[Math.abs(Math.floor(Math.sin(n * 12.9898 + b.wigP * 78.233) * 43758.5453)) % cells.length];
        const x = c.u * bw, y = c.v * bh, r = 2 + 4 * k;
        ctx.save();
        ctx.globalAlpha = k;
        ctx.strokeStyle = '#fffbe8';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
        ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
        ctx.stroke();
        ctx.restore();
    }

    // ==== LUCKY ===================================================================
    // U  LUCKY BRANDON (U for lUcky, L being LASER's): while it is on, a
    //    broken brick is LK_MUL times as likely to drop a capsule. Still only
    //    one falling at a time -- that rule is what keeps capsules readable,
    //    so LUCKY fills the gaps between them rather than stacking them up.
    //    It does nothing on a boss, whose capsules come by hits, not chance.
    //    Whatever the rolls do, it pays at least one: the first brick broken
    //    after catching it with nothing falling drops one for certain.
    let LK_SECS = 13;
    let LK_MUL  = 2;
    LAB_KNOBS.push('LK_SECS', 'LK_MUL');
    let lkOwed = false, lkWas = 0;

    // what a brick's chance of a capsule is multiplied by, in labCapRoll
    function powCapMul() { return fx.U > 0 ? LK_MUL : 1; }
    // ...and whether this one is LUCKY's promised drop, which it spends
    function powCapSure() {
        if (!lkOwed) return false;
        lkOwed = false;
        return true;
    }
    // once a frame, so a capsule that runs out before any brick breaks still owes
    function lkUpdate() {
        const now = Math.max(0, fx.U || 0);
        if (now > lkWas + 1e-6) lkOwed = true;         // a capsule just caught
        lkWas = now;
    }

    // ==== WILD ====================================================================
    // ? WILD BRANDON: a capsule that will not settle. Falling, it turns into
    //   each of the others in turn, WD_RATE a second, and is whichever one it
    //   is showing when he catches it. It changes its own kind, so the engine
    //   draws and pays it as that capsule with nothing else to know.
    let WD_RATE = 3;        // changes a second
    LAB_KNOBS.push('WD_RATE');

    function wdUpdate() {
        if (!capsule) return;
        if (capsule.kind === '?') { capsule.wild = true; capsule.wildAt = Math.random() * 100; }
        if (!capsule.wild) return;
        const pool = capsulePool().filter(k => k !== '?');
        if (!pool.length) return;
        capsule.kind = pool[Math.floor(capsule.wildAt + clock * WD_RATE) % pool.length];
    }
    // a ring round it in every colour it could be, so you know it is still deciding
    function wdDraw() {
        if (!capsule || !capsule.wild) return;
        ctx.save();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'hsl(' + ((clock * 360) % 360) + ', 80%, 65%)';
        ctx.beginPath();
        ctx.ellipse(capsule.x, capsule.y, CAP_W * 0.62, CAP_H * 0.9, 0, 0, 7);
        ctx.stroke();
        ctx.restore();
        text('WILD', capsule.x, capsule.y - CAP_H / 2 - 6, 11, '#f2efe9', 'center');
    }

    // ---- drawing -------------------------------------------------------------------
    function powDrawPiece(x, y, a, p) {
        const sp = shapeSprite(p.kind, brickColor(p.kind), p.sw, p.sh, false);
        if (!sp) return;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.drawImage(sp, -p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
    }

    // under the head, so its face stays on top of what it has picked up
    function powDrawBall(b) {
        if (ptOn()) {
            const r = bMAX();
            if (b.x < r) drawBall(b.x + LW, b.y, labBallR(b), b.angle);
            if (b.x > LW - r) drawBall(b.x - LW, b.y, labBallR(b), b.angle);
        }
        if (!b.kat) return;
        for (const p of b.kat) { const q = katPose(b, p); powDrawPiece(q.x, q.y, q.a, p); }
    }

    function powDrawLoose() {
        mrDraw();
        for (const p of katLoose) {
            ctx.globalAlpha = Math.max(0, 1 - p.t / 1.2);
            powDrawPiece(p.x, p.y, p.a, p);
        }
        ctx.globalAlpha = 1;
    }

    // over him: PORTAL's edges, LASER's guns and bolts, the CROWD, MIDAS's sparks,
    // WILD's ring, then the lab's overlay: every point the lump collides with, and the room
    // each piece packs to
    function powDrawOver() {
        ptDraw();
        lzDraw();
        crDraw();
        mdDraw();
        wdDraw();
        if (!powShow) return;
        ctx.save();
        ctx.fillStyle = '#7cff6b';
        ctx.strokeStyle = 'rgba(124, 255, 107, 0.35)';
        for (const b of balls) {
            if (!b.kat) continue;
            katEach(b, (x, y) => { ctx.fillRect(x - 1, y - 1, 2, 2); });
            for (const p of b.kat) {
                const q = katPose(b, p);
                ctx.beginPath(); ctx.arc(q.x, q.y, katR(p) * KAT_PACK, 0, 7); ctx.stroke();
            }
        }
        ctx.restore();
    }
