'use strict';

    // ---- WINDMILL (boss) ------------------------------------------------------------
    // A garden. Each flower is a big head with brandons for petals, turning
    // slowly round it while the head stays upright, on a stem up out of the
    // top of the screen. Only a head can be hurt, and the garden is beaten
    // when the last head goes. Thread the ball through the gaps as the petals
    // come round, or knock petals off to open a flower up -- every petal lost
    // turns the rest of that flower faster, and each one falls at you on its
    // way out. The petals do the returning: one swinging through the ball
    // sends it back at an angle you did not give it. Neighbours turn opposite
    // ways and stand at staggered heights, so the gaps between flowers open
    // and shut as well as the gaps inside them.
    //
    // A flower stripped of every petal grows them all back at once over
    // WM_REGROW, each one out from the head with its inner end fixed there,
    // and solid only after WM_REGROW_SOLID of growing. Lose one flower and the
    // two left start roaming back and forth. Lose a second and the last one
    // stands still and wilts: its petals drop off it one by one, its colour
    // goes, it shouts, and its health drains away on its own -- the garden
    // dying whether you finish it or not.
    //
    // They arrive slowly and not together: each head peeks down out of the
    // top first, holds there a moment, and only then lowers into place.
    let WM_FLOWERS  = 3;      // how many flowers are in the garden
    let WM_HP       = 5;      // hits on its head to finish one flower
    let WM_SAILS    = 5;      // petals on each flower
    let WM_SAIL_HP  = 3;      // hits to knock one off
    let WM_SAIL     = 104;    // px, how long a petal is
    let WM_R0       = 30;     // px from a head's middle to where a petal starts
    let WM_HUB      = 60;     // px, how wide a head is
    let WM_SPIN0    = 0.5;    // rad/s a flower turns with every petal on
    let WM_SPIN1    = 1.6;    // ...and with one left
    let WM_Y        = 150;    // where the outer flowers' heads hang
    let WM_STAGGER  = 80;     // ...and how much lower every other one hangs
    let WM_DRIFT    = 18;     // px each one sways either side
    let WM_FALL     = 420;    // px/s^2 a petal comes down at once it is off
    let WM_BOOTS_IN = 1;      // 1: their boots at the head; 0: their heads
    let WM_CLIMB    = 0.2;    // how much of the original's climb this fight has
    let WM_REGROW   = 5;      // seconds a stripped flower takes to grow every petal back
    let WM_REGROW_SOLID = 0.5;// ...and how far into that a petal can be hit
    let WM_ROAM     = 150;    // px either side the last two roam
    let WM_ROAM_RATE = 0.7;   // rad/s of that roaming
    let WM_WILT     = 0.2;    // hits a second the last one's health drains at
    let WM_WILT_SHED = 3;     // seconds between petals dropping off it
    let WM_WILT_YELL = 2.6;   // ...and between its shouts
    let WM_ENTER    = 6;      // seconds the garden takes to arrive
    // The act a run draws him from, 1 easy to 3 hard. The returns off a turning
    // petal are the least predictable in the set and a petal coming off lands
    // SLUGGISH on you, but there are two ways in to every flower.
    let WM_LVL      = 1;
    LAB_KNOBS.push('WM_LVL', 'WM_FLOWERS', 'WM_HP', 'WM_SAILS', 'WM_SAIL_HP', 'WM_SAIL', 'WM_R0',
                   'WM_HUB', 'WM_SPIN0', 'WM_SPIN1', 'WM_Y', 'WM_STAGGER', 'WM_DRIFT', 'WM_FALL',
                   'WM_BOOTS_IN', 'WM_CLIMB', 'WM_REGROW', 'WM_REGROW_SOLID', 'WM_ROAM', 'WM_ROAM_RATE',
                   'WM_WILT', 'WM_WILT_SHED', 'WM_WILT_YELL', 'WM_ENTER');

    // each flower's start in the arrival, as a share of it: the outer two
    // first and a little apart, the middle one last
    const WM_ENTER_AT = [0, 0.28, 0.12];
    const WM_PEEK = 30;              // where a head holds, peeking, before it comes down

    const WM_STEM = '#5d7f45';

    let wm = null;

    LAB_BOSS.windmill = {
        start(b) {
            const n = Math.max(1, Math.round(WM_FLOWERS));
            const petals = Math.max(1, Math.round(WM_SAILS));
            wm = { t: 0, pend: null, lost: 0, falling: [], dying: [],
                   flowers: Array.from({ length: n }, (_, i) => ({
                       u: (i + 0.5) / n, low: i % 2 ? WM_STAGGER : 0,
                       dir: i % 2 ? -1 : 1, ang: i * 0.9, ph: i * 1.7, omega: WM_SPIN0,
                       cx: LW / 2, cy: -300, hp: WM_HP, alive: true, flash: 0, iframes: 0, fall: null,
                       grow: -1, roam: 0, still: 0, shedT: WM_WILT_SHED, yellT: 0.5,
                       sails: Array.from({ length: petals }, () => ({ hp: WM_SAIL_HP, alive: true, flash: 0 }))
                   })) };
            b.hp = b.maxHp = n * WM_HP;
            wmBox(b);
        },
        reset() { wm = null; },
        update(b, dt) {
            const entering = phase === 'entrance';
            if (phase === 'play') wm.t += dt;
            const live = wm.flowers.filter(f => f.alive).length;
            for (const f of wm.flowers) {
                if (f.fall) stepCrumble(f.fall, dt, 0);
                if (!f.alive) continue;
                // two left roam, the last one stands; both eased in, never snapped
                const ease = (v, want) => v + Math.max(-dt, Math.min(dt, want - v));
                f.roam = ease(f.roam, live === 2 ? 1 : 0);
                f.still = ease(f.still, live === 1 ? 1 : 0);
                if (phase === 'play') {
                    if (live === 1) wmWither(b, f, dt);
                    else wmRegrowStep(f, dt);
                }
                const n = f.sails.length, left = f.sails.filter(s => s.alive).length;
                const k = n > 1 ? Math.min(1, (n - left) / (n - 1)) : 0;
                f.omega = WM_SPIN0 + (WM_SPIN1 - WM_SPIN0) * k;
                if (phase !== 'over') f.ang += f.omega * f.dir * dt;
                if (f.flash > 0) f.flash = Math.max(0, f.flash - dt * 6);
                if (f.iframes > 0) f.iframes = Math.max(0, f.iframes - dt);
                for (const s of f.sails) if (s.flash > 0) s.flash = Math.max(0, s.flash - dt * 6);
                const y = WM_Y + f.low;
                // Roaming, each swings out from where it stood toward the middle
                // of the field and back -- the pair closing in and parting --
                // or, standing in the middle already, away from the other one.
                // Out and back from its own place, so nothing is ever pushed
                // into a wall.
                const home = f.u * LW;
                const other = wm.flowers.find(o => o !== f && o.alive);
                const way = Math.abs(home - LW / 2) > 1 ? Math.sign(LW / 2 - home)
                          : other ? Math.sign(home - other.u * LW) || 1 : 1;
                const roam = way * WM_ROAM * (1 - Math.cos(wm.t * WM_ROAM_RATE)) / 2 * f.roam;
                f.cx = home + (Math.sin(wm.t * 0.4 + f.ph) * WM_DRIFT) * (1 - f.still) + roam;
                f.cy = entering ? wmArrive(f, wm.flowers.indexOf(f), y) : y;
            }
            if (!b.alive) return;              // the last one withered away just now
            b.hp = wm.flowers.reduce((s, f) => s + (f.alive ? f.hp : 0), 0);
            wmBox(b);
            // the ones knocked off, on their way down to you
            for (const p of wm.falling) {
                p.vy += WM_FALL * dt;
                p.x += p.vx * dt; p.y += p.vy * dt;
                p.psi += p.spin * dt;
                if (p.spent || phase !== 'play') continue;
                for (const sg of segs()) {
                    if (Math.abs(p.x - sg.cx) < sg.w / 2 + WM_SAIL * 0.3 &&
                        Math.abs(p.y - padY()) < padH() / 2 + WM_SAIL * 0.12) {
                        addDrag(sg, p.x);          // one of him landing on you: a helping of SLUGGISH
                        p.spent = true;
                        break;
                    }
                }
            }
            wm.falling = wm.falling.filter(p => p.y < LH + WM_SAIL);
            wm.dying = wm.dying.filter(p => clock - p.t0 < 3);
        },
        contact(br, ball) {
            const h = WM_SAIL / SHAPE_ASPECT;
            for (const f of wm.flowers) {
                if (!f.alive) continue;
                const hub = ellipseContact(ball, f.cx, f.cy, WM_HUB / 2, WM_HUB / 2 * (BALL_RY / BALL_RX));
                if (hub) { wm.pend = { f, hub: true }; return hub; }
                // growing petals are only drawn until they are far enough along to hit
                if (f.grow >= 0 && f.grow < WM_REGROW_SOLID) continue;
                for (let i = 0; i < f.sails.length; i++) {
                    if (!f.sails[i].alive) continue;
                    const g = wmSail(f, i);
                    const hit = maskContact(ball, g.x, g.y, g.psi, g.len, h * g.len / WM_SAIL, MASK, false);
                    if (hit) { wm.pend = { f, sail: i }; return hit; }
                }
            }
            wm.pend = null;
            return null;
        },
        glances() { return !!wm.pend && !!wm.pend.hub && wm.pend.f.iframes > 0; },
        hit(b, cx, cy) {
            const p = wm.pend;
            wm.pend = null;
            if (!p) return;
            const f = p.f;
            if (!p.hub) { wmSailHit(f, p.sail, cx, cy); return; }
            if (f.iframes > 0) return;
            f.flash = 1;
            f.iframes = BOSS_IF;
            f.hp = Math.max(0, f.hp - 1);
            bossHits++;
            b.hp = wm.flowers.reduce((s, o) => s + (o.alive ? o.hp : 0), 0);
            const done = f.hp <= 1e-6;
            award(BOSS_PTS * (done ? 3 : 1), cx, cy);
            if (done) { wmWilt(b, f); return; }
            if (bossHits % BOSS_CAP === 0 && !capsule) {
                const pool = capsulePool();
                capsule = { x: f.cx, y: f.cy, kind: pool[(Math.random() * pool.length) | 0] };
            }
            if (++hits === 4 || hits === 12) bumpSpeed(1.12);
        },
        draw: wmDraw,
        drawFall() { labHeadFall(wmDrawDying); },
        climb() { return WM_CLIMB; },
        enterSecs() { return WM_ENTER; },
        finish(b) {
            // every flower but one goes, and that one has a single hit left
            const live = wm.flowers.filter(f => f.alive);
            for (const f of live.slice(1)) wmWilt(b, f);
            if (live[0]) live[0].hp = 1;
            return true;
        },
        state(b) {
            const live = wm.flowers.filter(f => f.alive);
            return { name: 'WINDMILL', hp: b.hp, max: b.maxHp, w: bw,
                     line: live.length + ' of ' + wm.flowers.length + ' flowers · petals ' +
                           live.map(f => f.sails.filter(s => s.alive).length + (f.grow >= 0 ? ' growing' : '')).join('/') +
                           (live.length === 1 ? ' · wilting' : live.length === 2 ? ' · roaming' : '') };
        }
    };

    // Where a flower is in the arrival: out of sight, then its head peeking
    // down out of the top, a pause there, then lowered into its place.
    function wmArrive(f, i, y) {
        const ease = t => t * t * (3 - 2 * t);
        const late = Math.max(...WM_ENTER_AT);
        const k = Math.max(0, Math.min(1, (enterK() - WM_ENTER_AT[i % WM_ENTER_AT.length]) / (1 - late)));
        const hidden = -(WM_R0 + WM_SAIL + 20);
        if (k < 0.35) return hidden + (WM_PEEK - hidden) * ease(k / 0.35);
        if (k < 0.55) return WM_PEEK + Math.sin((k - 0.35) * 30) * 3;
        return WM_PEEK + (y - WM_PEEK) * ease((k - 0.55) / 0.45);
    }

    // the box the physics looks for the garden in: round every live flower
    function wmBox(b) {
        const R = WM_R0 + WM_SAIL;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const f of wm.flowers) {
            if (!f.alive) continue;
            x0 = Math.min(x0, f.cx - R); x1 = Math.max(x1, f.cx + R);
            y0 = Math.min(y0, f.cy - R); y1 = Math.max(y1, f.cy + R);
        }
        if (x0 === Infinity) return;
        b.x = x0; b.y = y0; bw = x1 - x0; bh = y1 - y0;
    }

    // where petal i of flower f is, how long, and how it is turned: its boots
    // at the head unless WM_BOOTS_IN is off, in which case its head is. A
    // growing petal is shorter, with its inner end still at WM_R0, so it
    // grows outward from the head.
    function wmSail(f, i) {
        const phi = f.ang + i * Math.PI * 2 / f.sails.length;
        const len = WM_SAIL * wmGrown(f);
        const r = WM_R0 + len / 2;
        return { x: f.cx + Math.cos(phi) * r, y: f.cy + Math.sin(phi) * r, phi, r, len,
                 psi: WM_BOOTS_IN >= 0.5 ? phi : phi + Math.PI };
    }

    // how far its petals have grown back, 1 when they are not growing
    function wmGrown(f) {
        if (f.grow < 0) return 1;
        const k = Math.min(1, f.grow / WM_REGROW);
        return k * k * (3 - 2 * k);
    }

    // stripped bare: every petal starts again at nothing, all at once
    function wmRegrowStep(f, dt) {
        if (f.grow >= 0) {
            if ((f.grow += dt) >= WM_REGROW) f.grow = -1;
            return;
        }
        if (f.sails.some(s => s.alive)) return;
        for (const s of f.sails) { s.alive = true; s.hp = WM_SAIL_HP; s.flash = 0; }
        f.grow = 0;
    }

    // The last flower: standing still, letting its petals go one at a time,
    // its health running out on its own, and shouting about it.
    function wmWither(b, f, dt) {
        f.grow = -1;
        f.hp = Math.max(0, f.hp - WM_WILT * dt);
        if ((f.shedT -= dt) <= 0) {
            f.shedT = WM_WILT_SHED;
            const on = f.sails.map((s, i) => s.alive ? i : -1).filter(i => i >= 0);
            if (on.length) {
                const i = on[(Math.random() * on.length) | 0];
                f.sails[i].alive = false;
                const p = wmLoose(f, i);
                p.kind = wmKind(f.sails[i].hp);
                wm.falling.push(p);
            }
        }
        if ((f.yellT -= dt) <= 0) {
            f.yellT = WM_WILT_YELL;
            labShout(f.cx, f.cy + WM_HUB * 0.8);
        }
        if (f.hp <= 1e-6) wmWilt(b, f);
    }

    // hits it has left, as the wall's own ladder: gold, silver, then slate
    function wmKind(hp) { return hp >= 3 ? 'A' : hp === 2 ? 'S' : 'S2'; }

    // a petal knocked loose goes the way its flower was carrying it, turning as it did
    function wmLoose(f, i) {
        const g = wmSail(f, i);
        const v = f.omega * f.dir * g.r;
        return { x: g.x, y: g.y, vx: -Math.sin(g.phi) * v, vy: Math.cos(g.phi) * v - 40,
                 psi: g.psi, spin: f.omega * f.dir, kind: 'S2' };
    }

    function wmSailHit(f, i, cx, cy) {
        const s = f.sails[i];
        s.flash = 1;
        if (--s.hp > 0) { award(25, cx, cy); return; }
        s.alive = false;
        wm.lost++;
        wm.falling.push(wmLoose(f, i));
        award(25 * WM_SAIL_HP * 2, cx, cy);
        maybeDropCapsule(cx, cy);
    }

    // A flower is finished: its head comes apart where it hung, and the
    // petals it still had drop off it without landing on you -- you earned
    // the head, not a faceful of him. The last one is the garden's end.
    function wmWilt(b, f) {
        f.alive = false;
        f.hp = 0;
        for (let i = 0; i < f.sails.length; i++) {
            if (!f.sails[i].alive) continue;
            const p = wmLoose(f, i);
            p.kind = wmKind(f.sails[i].hp);
            p.t0 = clock;
            f.sails[i].alive = false;
            wm.dying.push(p);
        }
        b.hp = wm.flowers.reduce((s, o) => s + (o.alive ? o.hp : 0), 0);
        if (wm.flowers.some(o => o.alive)) {
            f.fall = headShatter(f.cx, f.cy, WM_HUB, 1.2);
            wmBox(b);
            return;
        }
        // whatever is still falling at you stops mattering with him
        for (const p of wm.falling) wm.dying.push(Object.assign({}, p, { t0: clock }));
        wm.falling = [];
        b.alive = false;
        clearStage();
        labHeadDied(f.cx, f.cy, WM_HUB);
    }

    function wmDrawSail(x, y, psi, kind, flash, alpha, len) {
        const h = WM_SAIL / SHAPE_ASPECT;
        const sp = shapeSprite('wm' + kind, brickColor(kind), WM_SAIL, h, false);
        if (!sp) return;
        const l = len === undefined ? WM_SAIL : len, lh = h * l / WM_SAIL;
        if (l < 1) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);
        ctx.rotate(psi);
        ctx.drawImage(sp, -l / 2, -lh / 2, l, lh);
        if (flash > 0) {
            ctx.globalAlpha = alpha * Math.min(1, flash) * 0.75;
            ctx.drawImage(shapeSprite('flash', '#f2efe9', WM_SAIL, h, true), -l / 2, -lh / 2, l, lh);
        }
        ctx.restore();
    }

    // a stem from the top of the screen down to the back of the head, bowed
    // a little the way it sways, with a leaf off it
    function wmDrawStem(f) {
        const top = f.u * LW;
        const mx = (top + f.cx) / 2 + (f.cx - top) * 0.6, my = f.cy * 0.45;
        ctx.strokeStyle = WM_STEM;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(top, 0);
        ctx.quadraticCurveTo(mx, my, f.cx, f.cy);
        ctx.stroke();
        ctx.fillStyle = WM_STEM;
        ctx.beginPath();
        ctx.ellipse(mx + 9 * f.dir, my, 12, 5, 0.6 * f.dir, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1;
    }

    function wmDraw(b) {
        for (const f of wm.flowers) if (f.alive) wmDrawStem(f);
        for (const f of wm.flowers) {
            if (f.fall) drawHeadCrumble(f.fall, headSprite2('grey'));
            if (!f.alive) continue;
            for (let i = 0; i < f.sails.length; i++) {
                const s = f.sails[i];
                if (!s.alive) continue;
                const g = wmSail(f, i);
                // still too young to hit, and drawn a little see-through to say so
                const soft = f.grow >= 0 && f.grow < WM_REGROW_SOLID ? 0.55 : 1;
                wmDrawSail(g.x, g.y, g.psi, wmKind(s.hp), s.flash, soft, g.len);
            }
        }
        for (const p of wm.falling) wmDrawSail(p.x, p.y, p.psi, p.kind, 0, p.spent ? 0.45 : 1);
        wmDrawDying();
        // the heads over their petals' ends, the right way up whatever those are doing
        const hw = WM_HUB, hh = hw * (BALL_RY / BALL_RX);
        for (const f of wm.flowers) {
            if (!f.alive) continue;
            if (ready(ballImg)) ctx.drawImage(ballImg, f.cx - hw / 2, f.cy - hh / 2, hw, hh);
            // wilting, the colour goes out of it as its health does
            if (f.still > 0 && headSprite2('grey')) {
                ctx.globalAlpha = f.still * (1 - f.hp / WM_HP);
                ctx.drawImage(headSprite2('grey'), f.cx - hw / 2, f.cy - hh / 2, hw, hh);
                ctx.globalAlpha = 1;
            }
            if (f.flash > 0) {
                ctx.globalAlpha = Math.min(1, f.flash) * 0.7;
                ctx.drawImage(headSprite2('flat', '#f2efe9'), f.cx - hw / 2, f.cy - hh / 2, hw, hh);
                ctx.globalAlpha = 1;
            }
            if (f.hp < WM_HP) labBar(f.cx - hw * 0.4, f.cy - hh / 2 - 8, hw * 0.8, f.hp / WM_HP, 3);
        }
        const grow = phase === 'entrance' ? enterK() : 1;
        if (grow > 0.001) labBar(LW / 2 - 150 * grow, 10, 300 * grow, b.hp / b.maxHp);
    }

    // petals let go of, falling on the clock they were let go on
    function wmDrawDying() {
        for (const p of wm.dying) {
            const t = clock - p.t0;
            const y = p.y + p.vy * t + WM_FALL * t * t / 2;
            if (y > LH + WM_SAIL) continue;
            wmDrawSail(p.x + p.vx * t, y, p.psi + p.spin * t, p.kind, 0, Math.max(0, 1 - t / 3));
        }
    }
