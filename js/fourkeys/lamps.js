'use strict';

    // ---- LAMPS (boss) ------------------------------------------------------------
    // He hangs above a row of stone brandons, stood on end, and he cannot be
    // touched while any of them is stone. The boss burns the way the EMBER
    // paddle does, and a hit on a cold lamp steals some of his fire: a stream
    // of it pulled off him and across to the lamp, the way the original's
    // second wind drank the life out of you, and the lamp catches as it
    // arrives. Every lamp lit takes its share of him, and he only gets a
    // share back when its lamp has gone all the way out. With every lamp lit
    // there is no fire left in him: he is only brandon, and open. They drift
    // slowly up and down where they stand, each on its own beat.
    //
    // His fire is his weapon: the meteor. He rears back, a burning brandon
    // swelling under him and a mark on your line that follows you, and it
    // comes down where the mark stopped. Under it and you are SLUGGISH, and
    // where it lands the ground flares for LAMP_BURN_SECS -- a splash, not a
    // hazard left lying about: dodge the shot and it is gone a moment later,
    // unless you step back into it. Its clock runs as fast as the fire left in him, but
    // never slower than LAMP_MET_KEEP of its pace while any lamp is cold:
    // every LAMP_MET_EVERY with all of them cold, and not at all with all of
    // them lit -- lighting lamps disarms him as well as opening him, without
    // the meteor going quiet for most of the fight, when most lamps are lit.
    //
    // A ball can't be aimed at the one cold lamp, so the lit ones point the
    // way: a ball off a lit lamp tops it up and is turned LAMP_STEER of the
    // way toward the nearest cold one -- or toward him, once none is cold,
    // and then it tops nothing up: a window lasts as long as its first lamp.
    // A lit lamp burns plainly, a flame over its head that shrinks as its
    // time runs; the stone only creeps back over it in its last LAMP_WARN.
    //
    // Open, he has nothing left to burn and sinks LAMP_SINK toward the
    // lamps, so reaching him is a shot rather than the luck of where the ball
    // was when the last lamp caught.
    //
    // Below LAMP_SWOOP_AT of his health he takes his fire back: every
    // LAMP_SWOOP_EVERY he swoops down on the lit lamp nearest him, turning to
    // face it, and drinks it out, then climbs back up hotter. He is low and
    // in the ball's way for the whole of the dive and the drink, and a hit
    // then is worth LAMP_SWOOP_DMG whether he is open or not: it knocks him
    // back up and the lamp stays lit.
    let LAMP_LVL    = 4;
    let LAMP_HP     = 27;     // hits to finish him, once you can reach him
    let LAMP_N      = 3;      // how many lamps there are
    let LAMP_SECS   = 11;     // how long a hit keeps one lit
    let LAMP_WARN   = 2.5;    // ...and the last of that, over which the stone creeps back
    let LAMP_W      = 120;    // how long a lamp is
    let LAMP_Y      = 225;    // the line they drift about: their feet no lower than LAMP_Y + LAMP_W / 2 + LAMP_BOB
    let LAMP_BOB    = 25;     // px either side of it they drift
    let LAMP_BOB_RATE = 0.4;  // rad/s of that drift
    let LAMP_STEER  = 0.8;    // share of the way a ball off a lit lamp is turned toward a cold one
    let LAMP_BOSS_W = 420;    // how long he is
    let LAMP_BOSS_Y = 80;     // ...and where he hangs, as high as he goes and still all on screen
    let LAMP_SINK   = 55;     // px he sinks while he is open
    let LAMP_SPARKS = 22;     // sparks a second off a lit lamp, or off him burning
    let LAMP_COOL   = 0.6;    // seconds his fire takes to go out, or to come back
    let LAMP_STEAL  = 0.9;    // seconds the stream of his fire runs into a lamp being lit
    let LAMP_MOTES  = 45;     // specks of it a second, while it runs
    let LAMP_MOTE_SECS = 0.7; // ...each one's trip across
    let LAMP_SWEEP  = 0.4;    // rad/s of his patrol
    let LAMP_CLIMB  = 0.6;    // how much of the original's climb this fight has
    let LAMP_MET_EVERY = 4;   // seconds between meteors with all his fire in him; slower with less
    let LAMP_MET_KEEP  = 0.5; // ...the share of that pace he keeps however little fire is left, while any lamp is cold
    let LAMP_MET_WIND  = 1.0; // seconds he rears back first, which is the tell
    let LAMP_MET_LOCK  = 0.6; // ...share of that the mark follows you for, before it stops
    let LAMP_MET_FALL  = 0.7; // seconds it takes to come down
    let LAMP_MET_SIZE  = 1.7; // ...and how big it is, of a head
    let LAMP_BURN_SECS = 0.5; // seconds the ground burns where it lands
    let LAMP_BURN_W    = 130; // ...px wide
    let LAMP_BURN_TICK = 1;   // ...and seconds between helpings of SLUGGISH while you stand in it
    let LAMP_SWOOP_AT  = 0.75; // share of his health under which he swoops on his lamps
    let LAMP_SWOOP_EVERY = 12; // seconds between swoops
    let LAMP_SWOOP_DIVE  = 1.5; // seconds down to the lamp, which is the time to knock him away
    let LAMP_SWOOP_DRINK = 0.8; // ...seconds drinking it, when he still can be
    let LAMP_SWOOP_BACK  = 1.0; // ...and seconds back up
    let LAMP_SWOOP_DMG   = 2;   // what a hit on him down there is worth
    LAB_KNOBS.push('LAMP_LVL', 'LAMP_HP', 'LAMP_N', 'LAMP_SECS', 'LAMP_WARN', 'LAMP_W', 'LAMP_Y', 'LAMP_STEER',
                   'LAMP_BOSS_W', 'LAMP_BOSS_Y', 'LAMP_SINK', 'LAMP_SWEEP', 'LAMP_CLIMB', 'LAMP_BOB', 'LAMP_BOB_RATE',
                   'LAMP_SPARKS', 'LAMP_COOL', 'LAMP_STEAL', 'LAMP_MOTES', 'LAMP_MOTE_SECS',
                   'LAMP_MET_EVERY', 'LAMP_MET_KEEP', 'LAMP_MET_WIND', 'LAMP_MET_LOCK', 'LAMP_MET_FALL', 'LAMP_MET_SIZE',
                   'LAMP_BURN_SECS', 'LAMP_BURN_W', 'LAMP_BURN_TICK',
                   'LAMP_SWOOP_AT', 'LAMP_SWOOP_EVERY', 'LAMP_SWOOP_DIVE', 'LAMP_SWOOP_DRINK', 'LAMP_SWOOP_BACK', 'LAMP_SWOOP_DMG');

    const LAMP_UP = -Math.PI / 2;     // stood on end, head at the top

    let lamp = null;

    LAB_BOSS.lamps = {
        start(b) {
            b.hp = b.maxHp = LAMP_HP;
            const n = Math.max(1, Math.round(LAMP_N));
            // y is where the entrance starts him: the first frame is drawn
            // before he has been updated once
            lamp = { t: 0, x: LW / 2, y: -LAMP_BOSS_W, pend: null, lit: 0, windows: 0, wasOpen: false, heat: 1, sparks: [],
                     lamps: Array.from({ length: n }, (_, i) => ({ u: (i + 0.5) / n, on: 0, y: LAMP_Y,
                                                                  ph: i * 2.3, lit: 99, acc: 0 })),
                     motes: [], sink: 0, fx: 1,
                     met: null, metT: LAMP_MET_EVERY * 0.6, burns: [], burnCD: 0, metN: 0, metHits: 0,
                     swoop: null, swoopT: LAMP_SWOOP_EVERY * 0.5, swoops: 0, knocked: 0, drunk: 0 };
            lampBox(b);
        },
        reset() { lamp = null; },
        update(b, dt) {
            if (phase === 'play') {
                lamp.t += dt;
                for (const l of lamp.lamps) if (l.on > 0) l.on = Math.max(0, l.on - dt);
            }
            for (const l of lamp.lamps) l.y = LAMP_Y + Math.sin(clock * LAMP_BOB_RATE + l.ph) * LAMP_BOB;
            const k = phase === 'entrance' ? enterK() : 1;
            const e = k * k * (3 - 2 * k);
            lamp.x = LW / 2 + Math.sin(lamp.t * LAMP_SWEEP) * Math.max(0, (LW - LAMP_BOSS_W) / 2);
            const open = lampOpen();
            // Open, he has nothing left to burn and sinks toward the lamps. He
            // cannot rise back through a head over him: it would be pinned
            // between him and the ceiling.
            const over = balls.some(q => q.y < lamp.y && Math.abs(q.x - lamp.x) < LAMP_BOSS_W / 2 + BALL_RX * 2);
            const sinkTo = (open && phase === 'play') || (over && lamp.sink > 0) ? 1 : 0;
            lamp.sink += Math.max(-dt * 1.5, Math.min(dt * 1.5, sinkTo - lamp.sink));
            lamp.y = -LAMP_BOSS_W + (LAMP_BOSS_Y + LAMP_BOSS_W) * e + LAMP_SINK * lamp.sink * lamp.sink * (3 - 2 * lamp.sink);
            if (open && !lamp.wasOpen) lamp.windows++;
            lamp.wasOpen = open;
            lampSwoopStep(b, dt, over);
            // his fire: a share of it gone into every lamp that holds it, as
            // fast as the stream carries it off, and back only once that lamp
            // is all the way out
            const want = 1 - lamp.lamps.reduce((s, l) => s + lampHeld(l), 0) / lamp.lamps.length;
            lamp.heat += Math.max(-dt / LAMP_COOL, Math.min(dt / LAMP_COOL, want - lamp.heat));
            lampMeteorStep(dt);
            lampStealStep(dt);
            lampSparkStep(b, dt);
            lampBox(b);
        },
        contact(br, ball) {
            const lw = LAMP_W, lh = lw / SHAPE_ASPECT;
            for (const l of lamp.lamps) {
                const hit = maskContact(ball, l.u * LW, l.y, LAMP_UP, lw, lh, MASK, false);
                if (hit) { lamp.pend = l; return hit; }
            }
            lamp.pend = null;
            const h = LAMP_BOSS_W / SHAPE_ASPECT;
            // Shut, he lets a head coming down on him from above pass behind
            // him: the gap between his back and the ceiling is a pocket a
            // head can bounce in for good.
            if (!lampOpen() && !lampLow() && ball.vy > 0 && ball.y < lamp.y) return null;
            return maskContact(ball, lamp.x, lamp.y, 0, LAMP_BOSS_W, h, MASK, lamp.fx < 0);
        },
        // Off a lit lamp the bounce is the fight's: turned toward the nearest
        // cold one, or toward him once none is. It tops the lamp up only while
        // another is cold -- with all of them lit the window burns down, or
        // the ball, steered at him, would keep it open for good. A cold one
        // goes on to be lit the ordinary way.
        touch(br, ball, hit) {
            const l = lamp.pend;
            // a head on top of him rolls off his nearer end rather than
            // rattling between him and the ceiling
            if (!l && ball.y < lamp.y) {
                if (lampOpen()) return false;
                const n = labBounce(ball, hit);
                rings.push({ x: hit.cx, y: hit.cy, t: 1 });
                const end = ball.x < lamp.x ? -1 : 1;
                labSteer(ball, n, lamp.x + end * (LAMP_BOSS_W / 2 + 80), lamp.y, 0.6);
                return true;
            }
            if (!l || l.on <= 0) return false;
            lamp.pend = null;
            if (!lampOpen()) l.on = LAMP_SECS;
            const n = labBounce(ball, hit);
            const cold = lamp.lamps.filter(o => o.on <= 0)
                             .sort((p, q) => Math.hypot(p.u * LW - ball.x, p.y - ball.y) - Math.hypot(q.u * LW - ball.x, q.y - ball.y))[0];
            labSteer(ball, n, cold ? cold.u * LW : lamp.x, cold ? cold.y : lamp.y, LAMP_STEER);
            return true;
        },
        // A lamp never takes a wound, but lighting it is not nothing, so it
        // gets no ring: the stone going is the answer. He rings while any of
        // them is out, unless he is down on one of them.
        glances() { return !lamp.pend && !lampOpen() && !lampLow(); },
        hit(b, cx, cy) {
            const l = lamp.pend;
            lamp.pend = null;
            if (l) {
                // a cold one has to be lit off him; one still burning is only topped up
                if (l.on <= 0) l.lit = 0;
                l.on = LAMP_SECS;
                lamp.lit++;
                return;
            }
            const low = lampLow();
            if ((!lampOpen() && !low) || bossIF > 0) return;
            b.flash = 1;
            bossIF = BOSS_IF;
            // down on a lamp, a hit is worth more and knocks him back up off it
            b.hp = Math.max(0, b.hp - (low ? LAMP_SWOOP_DMG : 1));
            bossHits++;
            if (low) {
                lamp.swoop.st = 'back';
                lamp.swoop.t = 0;
                lamp.knocked++;
            }
            const done = b.hp <= 1e-6;
            award(BOSS_PTS * (done ? 5 : 1), cx, cy);
            if (done) {
                lamp.met = null; lamp.burns = []; lamp.swoop = null;
                b.alive = false;
                clearStage();
                bossFall = shatter(lamp.x, lamp.y, LAMP_BOSS_W, A_DIE_T);
                if (impact) { impact.x = lamp.x; impact.y = lamp.y; impact.w = LAMP_BOSS_W; }
                return;
            }
            if (bossHits % BOSS_CAP === 0 && !capsule) {
                capsule = { x: lamp.x, y: lamp.y, kind: labCapKind() };
            }
            if (++hits === 4 || hits === 12) bumpSpeed(1.12);
        },
        draw: lampDraw,
        drawFall() {
            const c = bossFall;
            if (!c) return;
            const wilt = Math.max(0, Math.min(1, ascendT / A_DIE));
            const e = wilt * wilt * (3 - 2 * wilt);
            if (ascendT < A_DIE) drawFigure(c.x, c.y + e * F_SAG, c.w, 1, e, e * F_LEAN);
            else drawCrumble(c, e * F_SAG, e * F_LEAN, true);
        },
        climb() { return LAMP_CLIMB; },
        finish(b) {
            b.hp = Math.min(b.hp, 1);
            for (const l of lamp.lamps) { l.on = LAMP_SECS; l.lit = 99; }
            return true;
        },
        state(b) {
            const on = lamp.lamps.filter(l => l.on > 0).length;
            const soon = Math.min(...lamp.lamps.map(l => l.on).filter(v => v > 0), Infinity);
            return { name: 'LAMPS', hp: b.hp, max: b.maxHp,
                     line: on + ' of ' + lamp.lamps.length + ' lit' +
                           (on === lamp.lamps.length ? ' · he is open, ' + soon.toFixed(1) + ' s left'
                            : ' · he cannot be touched') + ' · ' + lamp.windows + ' windows · meteors ' +
                           lamp.metN + ' (' + lamp.metHits + ' on you) · swoops ' + lamp.swoops + ', knocked ' +
                           lamp.knocked + ', drunk ' + lamp.drunk + (lamp.swoop ? ' · swooping: ' + lamp.swoop.st : '') };
        }
    };

    function lampOpen() { return lamp.lamps.every(l => l.on > 0); }

    // Down on a lamp -- diving or drinking -- he is there to be hit.
    function lampLow() { return !!lamp.swoop && lamp.swoop.st !== 'back'; }

    // How big a meteor is, across.
    const lampMetW = () => BALL_RX * 2 * LAMP_MET_SIZE;

    // The meteor: a clock that runs as fast as his fire, a rear with a mark
    // that follows you, a fall, and the ground burning where it lands.
    function lampMeteorStep(dt) {
        if (phase === 'play') lamp.burns = lamp.burns.filter(p => (p.t += dt) < LAMP_BURN_SECS);
        if (phase !== 'play') { lamp.met = null; return; }
        // standing in the fire
        if (lamp.burnCD > 0) lamp.burnCD = Math.max(0, lamp.burnCD - dt);
        for (const p of lamp.burns) {
            const sg = segs().find(s => Math.abs(s.cx - p.x) < s.w / 2 + LAMP_BURN_W * 0.4);
            if (sg && !lamp.burnCD) { addDrag(sg, p.x); lamp.burnCD = LAMP_BURN_TICK; lamp.metHits++; }
        }
        const m = lamp.met;
        if (m) {
            m.t += dt;
            if (m.st === 'wind') {
                if (m.t < LAMP_MET_WIND * LAMP_MET_LOCK) {
                    const near = segs().reduce((p, q) => Math.abs(q.cx - m.tx) < Math.abs(p.cx - m.tx) ? q : p);
                    m.tx = Math.max(LAMP_BURN_W / 2, Math.min(LW - LAMP_BURN_W / 2, near.cx));
                }
                if (m.t >= LAMP_MET_WIND) { m.st = 'fall'; m.t = 0; m.x0 = lamp.x; m.y0 = lamp.y + LAMP_BOSS_W / SHAPE_ASPECT * 0.35; }
                return;
            }
            if (m.t < LAMP_MET_FALL) return;
            // down: on you, and the ground alight
            const py = padY() - padH() / 2, r = lampMetW() / 2;
            const sg = segs().find(s => Math.abs(s.cx - m.tx) < s.w / 2 + r * 0.7);
            if (sg) { addDrag(sg, m.tx); lamp.metHits++; lamp.burnCD = LAMP_BURN_TICK; }
            lamp.burns.push({ x: m.tx, t: 0 });
            rings.push({ x: m.tx, y: py, t: 1 });
            for (let i = 0; i < 26; i++) {
                lamp.sparks.push({ x: m.tx + (Math.random() - 0.5) * r * 2, y: py, vx: (Math.random() - 0.5) * 260,
                                   vy: -80 - Math.random() * 220, t: 0, life: 0.5 + Math.random() * 0.6,
                                   s: 2 + Math.random() * 3, ink: Math.random() < 0.4 ? EMB_RIM : EMB_INK, ph: Math.random() * 6.28 });
            }
            lamp.met = null;
            return;
        }
        if (lamp.swoop) return;              // one thing at a time
        const pace = lampOpen() ? 0 : LAMP_MET_KEEP + (1 - LAMP_MET_KEEP) * lamp.heat;
        if ((lamp.metT -= dt * pace) > 0) return;
        lamp.metT = LAMP_MET_EVERY;
        lamp.met = { st: 'wind', t: 0, tx: segs()[0].cx };
        lamp.metN++;
    }

    // where the meteor is while it falls: on a curve, gathering speed
    function lampMetAt(m) {
        const k = Math.min(1, m.t / LAMP_MET_FALL), ty = padY() - padH() / 2 - lampMetW() * 0.3;
        return { x: m.x0 + (m.tx - m.x0) * k, y: m.y0 + (ty - m.y0) * k * k };
    }

    // how far into rearing back he is, 0 to 1 -- his glow swells with it
    function lampRear() { return lamp.met && lamp.met.st === 'wind' ? Math.min(1, lamp.met.t / LAMP_MET_WIND) : 0; }

    // The swoop: down to a lit lamp, turned to face it, a drink, and back up
    // -- held down while a head is over him, which he would otherwise pin to
    // the ceiling on the way.
    function lampSwoopStep(b, dt, over) {
        const sw = lamp.swoop;
        if (phase !== 'play' || !sw) {
            if (phase !== 'play') lamp.swoop = null;
            lamp.fx += Math.max(-dt * 3, Math.min(dt * 3, 1 - lamp.fx));
            if (phase !== 'play' || b.hp >= b.maxHp * LAMP_SWOOP_AT || lamp.met) return;
            if ((lamp.swoopT -= dt) > 0) return;
            const lit = lamp.lamps.filter(l => l.on > 0);
            if (!lit.length) return;          // goes as soon as there is one to drink
            lamp.swoopT = LAMP_SWOOP_EVERY;
            const l = lit.sort((p, q) => Math.abs(p.u * LW - lamp.x) - Math.abs(q.u * LW - lamp.x))[0];
            // his head is his right end; a lamp on the left, he turns round to face it
            // lx/ly from the start: a knock can land before the first step of the dive
            lamp.swoop = { st: 'dive', t: 0, l, x0: lamp.x, y0: lamp.y, lx: lamp.x, ly: lamp.y, face: l.u < 0.4 ? -1 : 1 };
            lamp.swoops++;
            return;
        }
        if (!(sw.st === 'back' && over)) sw.t += dt;
        const h = LAMP_BOSS_W / SHAPE_ASPECT;
        // his mouth is LAMP_BOSS_W * 0.36 along from his middle, on the side he faces
        const tx = sw.l.u * LW - sw.face * LAMP_BOSS_W * 0.36, ty = sw.l.y - LAMP_W / 2 + h * 0.1;
        const ease = k => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
        const px = lamp.x, py = lamp.y;      // where his patrol has him
        lamp.fx += Math.max(-dt * 3, Math.min(dt * 3, (sw.st === 'back' ? 1 : sw.face) - lamp.fx));
        if (sw.st === 'dive') {
            const k = ease(sw.t / LAMP_SWOOP_DIVE);
            lamp.x = sw.x0 + (tx - sw.x0) * k;
            lamp.y = sw.y0 + (ty - sw.y0) * k;
            if (sw.t >= LAMP_SWOOP_DIVE) { sw.st = 'drink'; sw.t = 0; }
        } else if (sw.st === 'drink') {
            lamp.x = tx + Math.sin(clock * 40) * 2;
            lamp.y = ty;
            // the lamp's fire running back into him
            for (sw.acc = (sw.acc || 0) + dt * LAMP_MOTES; sw.acc >= 1; sw.acc--) {
                lamp.motes.push({ t: 0, l: sw.l, rev: true, sway: (Math.random() - 0.5) * 40, dx: 0, dy: 0,
                                  ink: Math.random() < 0.4 ? EMB_RIM : EMB_INK });
            }
            if (sw.t >= LAMP_SWOOP_DRINK) {
                if (sw.l.on > 0) { sw.l.on = 0; sw.l.lit = 99; lamp.drunk++; }
                sw.st = 'back'; sw.t = 0;
            }
        }
        if (sw.st === 'back') {
            // from wherever he was last put, down there -- a knock can come
            // between frames, after his patrol has already moved him
            if (sw.bx === undefined) { sw.bx = sw.lx; sw.by = sw.ly; }
            const k = ease(sw.t / LAMP_SWOOP_BACK);
            lamp.x = sw.bx + (px - sw.bx) * k;
            lamp.y = sw.by + (py - sw.by) * k;
            if (sw.t >= LAMP_SWOOP_BACK) lamp.swoop = null;
        }
        sw.lx = lamp.x; sw.ly = lamp.y;
    }

    // his fire coming down: the mark on your line while he rears, the
    // meteor as it falls, and the ground burning after
    function lampDrawMeteor() {
        const m = lamp.met, w = lampMetW(), hh = w * (BALL_RY / BALL_RX);
        const tint = headSprite2('flat', EMB_INK);
        const head = (x, y, sc, rot) => {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.7 * sc;
            ctx.drawImage(padGlow(EMB_INK), x - w * 1.3 * sc, y - w * 1.3 * sc, w * 2.6 * sc, w * 2.6 * sc);
            ctx.restore();
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rot);
            ctx.drawImage(ballImg, -w * sc / 2, -hh * sc / 2, w * sc, hh * sc);
            ctx.globalAlpha = 0.65;
            ctx.drawImage(tint, -w * sc / 2, -hh * sc / 2, w * sc, hh * sc);
            ctx.restore();
        };
        if (m) {
            const py = padY() - padH() / 2;
            // the mark: a column of his light standing on your line where it
            // will land, growing in once and steady after, never blinking
            const e = m.st === 'wind' ? Math.min(1, m.t / LAMP_MET_WIND) : 1, cw = w * 0.9;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createLinearGradient(0, py + padH(), 0, py - 170);
            g.addColorStop(0, EMB_RIM);
            g.addColorStop(1, 'rgba(226,104,58,0)');
            ctx.globalAlpha = 0.12 + 0.3 * e;
            ctx.fillStyle = g;
            ctx.fillRect(m.tx - cw / 2, py - 170, cw, 170 + padH());
            ctx.globalAlpha = 0.35 + 0.4 * e;
            ctx.fillStyle = EMB_INK;
            ctx.beginPath();
            ctx.ellipse(m.tx, py + padH() / 2, cw * (0.5 + 0.2 * e), 9, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            if (m.st === 'wind') head(lamp.x, lamp.y + LAMP_BOSS_W / SHAPE_ASPECT * 0.35, 0.3 + 0.7 * e, clock * 2);
            else {
                // a tail of itself behind it, so it reads as falling fire
                const k = m.t;
                for (const [back, a] of [[0.12, 0.25], [0.06, 0.45]]) {
                    m.t = Math.max(0, k - back);
                    const p = lampMetAt(m);
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.globalAlpha = a;
                    ctx.drawImage(padGlow(EMB_RIM), p.x - w, p.y - w, w * 2, w * 2);
                    ctx.restore();
                }
                m.t = k;
                const at = lampMetAt(m);
                head(at.x, at.y, 1, clock * 6);
            }
        }
        // the ground alight: a row of flames along your line, dying down
        for (const p of lamp.burns) {
            const k = 1 - p.t / LAMP_BURN_SECS, base = padY() + padH() / 2 + 2;
            lampGlow(p.x, base, LAMP_BURN_W * 0.6, k * 1.2);
            for (let i = 0; i < 7; i++) {
                const x = p.x + (i / 6 - 0.5) * LAMP_BURN_W * 0.9;
                lampFlame(x, base, k * (0.65 + 0.35 * Math.sin(clock * 5 + i * 1.7)), 1, 1.7);
            }
        }
    }

    // the box the physics looks in: him and the whole row, wherever it
    // drifts -- stood on end, a lamp is its length tall
    function lampBox(b) {
        const h = LAMP_BOSS_W / SHAPE_ASPECT;
        b.x = 0; bw = LW;
        b.y = Math.min(lamp.y - h / 2, LAMP_Y - LAMP_BOB - LAMP_W / 2);
        bh = Math.max(lamp.y + h / 2, LAMP_Y + LAMP_BOB + LAMP_W / 2) - b.y;
    }

    // how lit a lamp is: 1 all the while it burns, down to 0 over its last
    // LAMP_WARN, so lit and cold never look alike
    function lampWarm(l) { return l.on > 0 ? Math.min(1, l.on / Math.max(0.01, LAMP_WARN)) * lampCaught(l) : 0; }
    // ...and how much of its time is left, which the flame over it shows
    function lampLeft(l) { return l.on > 0 ? Math.min(1, l.on / LAMP_SECS) * lampCaught(l) : 0; }

    // how much of its fire a lamp being lit has taken off him: the stream's share
    function lampHeld(l) { return l.on > 0 ? Math.min(1, l.lit / LAMP_STEAL) : 0; }
    // ...and how much of it has arrived, a trip behind
    function lampCaught(l) { return Math.max(0, Math.min(1, (l.lit - LAMP_MOTE_SECS * 0.6) / LAMP_STEAL)); }

    // The stream: while a lamp is being lit, specks of him leave from all
    // over his body on a bowed path to it, each on the siphon's own ease --
    // slow off, quick across, slow in -- and fading up and out on the way.
    function lampStealStep(dt) {
        const h = LAMP_BOSS_W / SHAPE_ASPECT;
        for (const l of lamp.lamps) {
            l.lit += dt;
            if (l.on <= 0 || l.lit >= LAMP_STEAL) continue;
            for (l.acc += dt * LAMP_MOTES; l.acc >= 1; l.acc--) {
                lamp.motes.push({ t: 0, l, sway: (Math.random() - 0.5) * 120,
                                  dx: (Math.random() - 0.5) * LAMP_BOSS_W * 0.8, dy: (Math.random() - 0.5) * h * 0.5,
                                  ink: Math.random() < 0.4 ? EMB_RIM : EMB_INK });
            }
        }
        lamp.motes = lamp.motes.filter(m => (m.t += dt) < LAMP_MOTE_SECS);
    }

    function lampDrawMotes() {
        if (!lamp.motes.length) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const m of lamp.motes) {
            const p = m.t / LAMP_MOTE_SECS, e = p * p * (3 - 2 * p);
            const h = LAMP_BOSS_W / SHAPE_ASPECT;
            let sx = lamp.x + m.dx, sy = lamp.y + m.dy, tx = m.l.u * LW, ty = m.l.y;
            // drunk back: from the lamp's head to his mouth
            if (m.rev) { sx = tx; sy = ty - LAMP_W / 2; tx = lamp.x + lamp.fx * LAMP_BOSS_W * 0.36; ty = lamp.y - h * 0.1; }
            const x = sx + (tx - sx) * e + Math.sin(p * Math.PI) * m.sway;
            const y = sy + (ty - sy) * e;
            const a = Math.sin(p * Math.PI);
            const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
            g.addColorStop(0, m.ink);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = 0.5 * a;
            ctx.fillStyle = g;
            ctx.fillRect(x - 9, y - 9, 18, 18);
            ctx.globalAlpha = 0.9 * a;
            ctx.fillStyle = '#fff1d6';
            ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
        }
        ctx.restore();
    }

    // Sparks off whatever is burning: each lit lamp as much as it is lit, and
    // him as much as his fire is in him. EMBER's own sparks, kept here rather
    // than in the paddle's list so a fight's worth of them never crowds his out.
    function lampSparkStep(b, dt) {
        const lw = LAMP_W, lh = lw / SHAPE_ASPECT;
        const burn = (k, x, y, rx, ry) => {
            if (Math.random() >= dt * LAMP_SPARKS * k) return;
            lamp.sparks.push({ x: x + (Math.random() - 0.5) * rx * 2, y: y + (Math.random() - 0.5) * ry * 2,
                               vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 70, t: 0,
                               life: 0.7 + Math.random() * 0.8, s: 2 + Math.random() * 2.5,
                               ink: Math.random() < 0.4 ? EMB_RIM : EMB_INK, ph: Math.random() * 6.28 });
        };
        if (phase !== 'entrance') {
            for (const l of lamp.lamps) burn(lampWarm(l), l.u * LW, l.y, lh * 0.4, lw * 0.45);
            const h = LAMP_BOSS_W / SHAPE_ASPECT;
            burn(lamp.heat * 2.5, lamp.x, lamp.y, LAMP_BOSS_W * 0.45, h * 0.35);
        }
        for (const p of lamp.sparks) {
            p.t += dt;
            p.x += p.vx * dt + Math.sin(p.t * 3 + p.ph) * 25 * dt;
            p.y += p.vy * dt;
            p.vy -= 30 * dt;
        }
        lamp.sparks = lamp.sparks.filter(p => p.t < p.life);
    }

    function lampDrawSparks() {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const p of lamp.sparks) {
            const a = Math.max(0, 1 - p.t / p.life);
            ctx.globalAlpha = a * 0.55;
            ctx.drawImage(padGlow(p.ink), p.x - p.s * 2.4, p.y - p.s * 2.4, p.s * 4.8, p.s * 4.8);
            ctx.globalAlpha = a;
            ctx.fillStyle = '#fff1d6';
            ctx.fillRect(p.x - p.s / 4, p.y - p.s / 4, p.s / 2, p.s / 2);
        }
        ctx.restore();
    }

    // EMBER's light under a body: a steady glow with a slow breath in it
    function lampGlow(x, y, r, k) {
        // a gradient throws on a position that is not a number, and a throw
        // in draw() stops the loop for good
        if (k <= 0.002 || !Number.isFinite(x + y + r)) return;
        const g = ctx.createRadialGradient(x, y, 8, x, y, r);
        g.addColorStop(0, EMB_INK);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = EMB_GLOW * k * (0.85 + 0.15 * Math.sin(clock * 1.7));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // a sprite at (x, y), turned, as solid as `a`
    function lampLay(sprite, x, y, w, h, ang, a) {
        if (!sprite || a <= 0.002) return;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
        ctx.restore();
    }

    // A flame stood on (x, y): a teardrop of EMBER's colours, `k` of its
    // full height, flickering in its shape rather than in its brightness.
    // `lit` 0 draws the dim wick a cold lamp keeps; `sc` scales the lot.
    function lampFlame(x, y, k, lit, sc = 1) {
        // a gradient throws on a position that is not a number, and a throw
        // in draw() stops the loop for good
        if (!Number.isFinite(x + y + k)) return;
        const tall = (lit ? 10 + 42 * k : 7) * sc, wide = (lit ? 9 + 7 * k : 5) * sc;
        const fl = 1 + 0.08 * Math.sin(clock * 9 + x);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = lit ? 0.9 : 0.35;
        const g = ctx.createRadialGradient(x, y - tall * 0.3, 1, x, y - tall * 0.3, tall * 0.7);
        g.addColorStop(0, '#fff1d6');
        g.addColorStop(0.35, EMB_RIM);
        g.addColorStop(1, 'rgba(226,104,58,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y - tall * 0.35 * fl, wide, tall * 0.55 * fl, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function lampDraw(b) {
        const lw = LAMP_W, lh = lw / SHAPE_ASPECT;
        const raw = shapeSprite('lampRaw', null, lw, lh, false);
        const stone = shapeSprite('lampStone', STONE, lw, lh, 'statue');
        const ember = padTint('padEmber', EMB_INK);
        if (!raw || !stone) return;
        for (const l of lamp.lamps) {
            const x = l.u * LW, warm = lampWarm(l);
            // lit, he burns; the stone comes back over him as his time runs
            // out, so the clock is the picture rather than a number
            lampGlow(x, l.y, lw * 0.9, warm * 1.4);
            lampLay(raw, x, l.y, lw, lh, LAMP_UP, 1);
            lampLay(ember, x, l.y, lw, lh, LAMP_UP, 0.72);
            lampLay(stone, x, l.y, lw, lh, LAMP_UP, 1 - warm);
            // a flame over his head for the time he has left, and a cold one
            // a small dim wick, so the one to go for is plain at a glance
            lampFlame(x, l.y - lw / 2 - 4, lampLeft(l), l.on > 0 ? 1 : 0);
        }
        const h = LAMP_BOSS_W / SHAPE_ASPECT;
        const body = shapeSprite('boss', null, BOSS_W0, BOSS_H, false);
        if (body) {
            // rearing back to throw, he flares and swells; swooping, he dips his
            // head toward the lamp and turns to face it
            const rear = lampRear();
            lampGlow(lamp.x, lamp.y, LAMP_BOSS_W * 0.6, Math.max(lamp.heat, rear) * (1 + 0.8 * rear));
            const sw = lamp.swoop, dip = sw && sw.st === 'dive' ? Math.sin(Math.min(1, sw.t / LAMP_SWOOP_DIVE) * Math.PI) * 0.18 : 0;
            ctx.save();
            ctx.translate(lamp.x, lamp.y);
            ctx.rotate(dip * lamp.fx - 0.08 * rear);
            ctx.scale(lamp.fx * (1 + 0.06 * rear), 1 + 0.12 * rear);
            ctx.translate(-lamp.x, -lamp.y);
            ctx.drawImage(body, lamp.x - LAMP_BOSS_W / 2, lamp.y - h / 2, LAMP_BOSS_W, h);
            lampLay(padTint('lampBossEmber', EMB_INK), lamp.x, lamp.y, LAMP_BOSS_W, h, 0, 0.72 * lamp.heat);
            if (b.flash > 0) {
                ctx.globalAlpha = Math.min(1, b.flash) * 0.7;
                ctx.drawImage(shapeSprite('flash', '#f2efe9', BOSS_W0, BOSS_H, true),
                              lamp.x - LAMP_BOSS_W / 2, lamp.y - h / 2, LAMP_BOSS_W, h);
                ctx.globalAlpha = 1;
            }
            ctx.restore();
        }
        lampDrawMeteor();
        lampDrawSparks();
        lampDrawMotes();
        const grow = phase === 'entrance' ? enterK() : 1;
        if (grow > 0.001) {
            const w = Math.min(LAMP_BOSS_W * 0.72, LW - 120) * grow;
            labBar(Math.max(12, Math.min(LW - 12 - w, lamp.x - w / 2)),
                   Math.max(10, lamp.y - h / 2 - 16), w, b.hp / b.maxHp);
        }
    }