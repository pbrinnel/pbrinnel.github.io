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
    // His fire is his weapon. He drips embers, and every so often flares and
    // flings a few at you, as many as the fire left in him (lamp.heat) will
    // make: each one that lands is a helping of SLUGGISH. So lighting lamps
    // disarms him as well as opening him, and the fight is hottest when you
    // have the least of it.
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
    // was when the last lamp caught. Below LAMP_BLOW_AT of his health he
    // answers a window: LAMP_BLOW_DELAY into it he swells up, turned to the
    // lamp with the least time left, and blows it out. The swell is the tell
    // and the chance -- hit him during it and he chokes on it, and the window
    // runs its course.
    let LAMP_LVL    = 4;
    let LAMP_HP     = 26;     // hits to finish him, once you can reach him
    let LAMP_N      = 3;      // how many lamps there are
    let LAMP_SECS   = 13;     // how long a hit keeps one lit
    let LAMP_WARN   = 2.5;    // ...and the last of that, over which the stone creeps back
    let LAMP_W      = 143;    // how long a lamp is
    let LAMP_Y      = 250;    // the line they drift about
    let LAMP_BOB    = 40;     // px either side of it they drift
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
    let LAMP_DRIP   = 0.7;    // embers a second he drips, with all his fire in him
    let LAMP_FLING_MIN = 5;   // seconds between his flings, at least...
    let LAMP_FLING_MAX = 8;   // ...and at most
    let LAMP_FLING  = 3;      // embers in a fling, with all his fire in him
    let LAMP_FLARE  = 0.7;    // seconds he flares up before he flings, which is the tell
    let LAMP_EMBER_G = 260;   // px/s² an ember falls at
    let LAMP_EMBER_SIZE = 0.4; // ...and how big it is, of a head
    let LAMP_BLOW_AT    = 0.75; // share of his health under which he blows lamps out
    let LAMP_BLOW_DELAY = 2;    // seconds into a window before he swells
    let LAMP_BLOW_WIND  = 1.4;  // seconds he swells, which is the tell and the time to choke him
    let LAMP_BLOW_GUST  = 0.5;  // ...and the gust's trip across to the lamp
    LAB_KNOBS.push('LAMP_LVL', 'LAMP_HP', 'LAMP_N', 'LAMP_SECS', 'LAMP_WARN', 'LAMP_W', 'LAMP_Y', 'LAMP_STEER',
                   'LAMP_BOSS_W', 'LAMP_BOSS_Y', 'LAMP_SINK', 'LAMP_SWEEP', 'LAMP_CLIMB', 'LAMP_BOB', 'LAMP_BOB_RATE',
                   'LAMP_SPARKS', 'LAMP_COOL', 'LAMP_STEAL', 'LAMP_MOTES', 'LAMP_MOTE_SECS',
                   'LAMP_DRIP', 'LAMP_FLING_MIN', 'LAMP_FLING_MAX', 'LAMP_FLING', 'LAMP_FLARE', 'LAMP_EMBER_G', 'LAMP_EMBER_SIZE',
                   'LAMP_BLOW_AT', 'LAMP_BLOW_DELAY', 'LAMP_BLOW_WIND', 'LAMP_BLOW_GUST');

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
                     motes: [], blowAt: -1, blow: null, gust: [], blown: 0, choked: 0, puffs: [],
                     sink: 0, embers: [], drip: 0, flingT: LAMP_FLING_MIN, flare: -1, flung: 0, landed: 0 };
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
            if (open && !lamp.wasOpen) {
                lamp.windows++;
                lamp.blowAt = b.hp < b.maxHp * LAMP_BLOW_AT ? LAMP_BLOW_DELAY : -1;
            }
            if (!open) lamp.blowAt = -1;
            lamp.wasOpen = open;
            // his fire: a share of it gone into every lamp that holds it, as
            // fast as the stream carries it off, and back only once that lamp
            // is all the way out
            const want = 1 - lamp.lamps.reduce((s, l) => s + lampHeld(l), 0) / lamp.lamps.length;
            lamp.heat += Math.max(-dt / LAMP_COOL, Math.min(dt / LAMP_COOL, want - lamp.heat));
            lampBlowStep(b, dt);
            lampEmberStep(dt);
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
            return maskContact(ball, lamp.x, lamp.y, 0, LAMP_BOSS_W, h, MASK, false);
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
        // them is out.
        glances() { return !lamp.pend && !lampOpen(); },
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
            if (!lampOpen() || bossIF > 0) return;
            b.flash = 1;
            bossIF = BOSS_IF;
            b.hp = Math.max(0, b.hp - 1);
            bossHits++;
            // struck while he swells, he chokes on it and the lamp stays lit
            if (lamp.blow && !lamp.blow.gone) {
                lamp.blow = null;
                lamp.choked++;
                const h = LAMP_BOSS_W / SHAPE_ASPECT;
                lamp.puffs.push({ x: lamp.x + LAMP_BOSS_W * 0.36, y: lamp.y - h * 0.1, t: 0 });
            }
            const done = b.hp <= 1e-6;
            award(BOSS_PTS * (done ? 5 : 1), cx, cy);
            if (done) {
                lamp.embers = [];
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
                            : ' · he cannot be touched') + ' · ' + lamp.windows + ' windows · blown out ' +
                           lamp.blown + ' · choked ' + lamp.choked + (lamp.blow ? ' · blowing' : '') +
                           ' · embers ' + lamp.embers.length + ' (' + lamp.landed + ' landed)' };
        }
    };

    function lampOpen() { return lamp.lamps.every(l => l.on > 0); }

    // His answer to a window, once he is hurt enough: LAMP_BLOW_DELAY into
    // it he swells toward the lamp with the least time left, and the gust
    // puts it out -- unless a hit chokes him first (see hit).
    function lampBlowStep(b, dt) {
        lamp.gust = lamp.gust.filter(g => (g.t += dt) < LAMP_BLOW_GUST * 1.4);
        lamp.puffs = lamp.puffs.filter(p => (p.t += dt) < 0.8);
        if (phase !== 'play') { lamp.blow = null; return; }
        const bl = lamp.blow;
        if (bl) {
            bl.t += dt;
            const h = LAMP_BOSS_W / SHAPE_ASPECT;
            if (bl.t >= LAMP_BLOW_WIND && !bl.gone) {
                bl.gone = true;
                for (let i = 0; i < 26; i++) {
                    lamp.gust.push({ t: -Math.random() * LAMP_BLOW_GUST * 0.4, l: bl.l,
                                     sx: lamp.x + LAMP_BOSS_W * 0.36, sy: lamp.y - h * 0.1,     // his mouth
                                     sway: (Math.random() - 0.5) * 50, len: 10 + Math.random() * 18 });
                }
            }
            if (bl.t >= LAMP_BLOW_WIND + LAMP_BLOW_GUST) {
                if (bl.l.on > 0) { bl.l.on = 0; bl.l.lit = 99; lamp.blown++; }
                lamp.blow = null;
            }
            return;
        }
        if (lamp.blowAt < 0 || (lamp.blowAt -= dt) > 0) return;
        lamp.blowAt = -1;
        const lit = lamp.lamps.filter(l => l.on > 0).sort((p, q) => p.on - q.on);
        if (lit.length) lamp.blow = { l: lit[0], t: 0, gone: false };
    }

    // His embers: a drip as steady as the fire left in him, and now and then
    // a flare and a fling of a few toward you. They fall, and one that comes
    // down on you is a helping of SLUGGISH.
    function lampEmberStep(dt) {
        const h = LAMP_BOSS_W / SHAPE_ASPECT, r = BALL_RX * 2 * LAMP_EMBER_SIZE;
        if (phase === 'play') {
            const drop = (x, y, vx, vy) => lamp.embers.push({ x, y, vx, vy, rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 5 });
            for (lamp.drip += dt * LAMP_DRIP * lamp.heat; lamp.drip >= 1; lamp.drip--) {
                drop(lamp.x + (Math.random() - 0.5) * LAMP_BOSS_W * 0.8, lamp.y + h * 0.3, (Math.random() - 0.5) * 40, 20);
            }
            if (lamp.flare >= 0) {
                if ((lamp.flare += dt) >= LAMP_FLARE) {
                    lamp.flare = -1;
                    const n = Math.round(LAMP_FLING * lamp.heat), sx = lamp.x, sy = lamp.y + h * 0.3;
                    const px = segs()[0].cx, py = padY();
                    for (let i = 0; i < n; i++) {
                        // aimed to land about you, spread either side of you
                        const tx = px + (i - (n - 1) / 2) * 110, T = 1.4;
                        drop(sx, sy, (tx - sx) / T, (py - sy - 0.5 * LAMP_EMBER_G * T * T) / T);
                        lamp.flung++;
                    }
                }
            } else if ((lamp.flingT -= dt) <= 0) {
                lamp.flingT = LAMP_FLING_MIN + Math.random() * (LAMP_FLING_MAX - LAMP_FLING_MIN);
                if (Math.round(LAMP_FLING * lamp.heat) > 0) lamp.flare = 0;
            }
        } else lamp.flare = -1;
        for (let i = lamp.embers.length - 1; i >= 0; i--) {
            const m = lamp.embers[i];
            if (phase === 'play') {
                m.vy += LAMP_EMBER_G * dt;
                m.x += m.vx * dt;
                m.y += m.vy * dt;
                m.rot += m.spin * dt;
            }
            if (m.y > padY() - padH() / 2 - r && m.y < padY() + padH() / 2) {
                const sg = segs().find(s => Math.abs(m.x - s.cx) < s.w / 2 + r);
                if (sg) { addDrag(sg, m.x); lamp.landed++; lamp.embers.splice(i, 1); continue; }
            }
            if (m.y > LH + r || m.x < -r || m.x > LW + r) lamp.embers.splice(i, 1);
        }
    }

    // the flare before a fling: 0 to 1 over LAMP_FLARE, a swell of his glow
    function lampFlare() { return lamp.flare >= 0 ? Math.min(1, lamp.flare / LAMP_FLARE) : 0; }

    function lampDrawEmbers() {
        const r = BALL_RX * 2 * LAMP_EMBER_SIZE, rh = r * (BALL_RY / BALL_RX);
        const tint = headSprite2('flat', EMB_INK);
        for (const m of lamp.embers) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.5;
            ctx.drawImage(padGlow(EMB_INK), m.x - r * 1.6, m.y - r * 1.6, r * 3.2, r * 3.2);
            ctx.restore();
            ctx.save();
            ctx.translate(m.x, m.y);
            ctx.rotate(m.rot);
            ctx.drawImage(ballImg, -r / 2, -rh / 2, r, rh);
            ctx.globalAlpha = 0.6;
            ctx.drawImage(tint, -r / 2, -rh / 2, r, rh);
            ctx.restore();
        }
        // his choking: grey puffs off his mouth, swelling and fading
        for (const p of lamp.puffs) {
            const k = p.t / 0.8;
            ctx.save();
            ctx.globalAlpha = 0.35 * (1 - k);
            ctx.fillStyle = '#b9b4ac';
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.arc(p.x + i * 14 * (1 + k), p.y - i * 6 - 20 * k, 8 + 14 * k, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    // how swollen he is: up over the wind-up, and out again with the gust
    function lampSwell() {
        const bl = lamp.blow;
        if (!bl) return 0;
        if (bl.t < LAMP_BLOW_WIND) { const k = bl.t / LAMP_BLOW_WIND; return k * k; }
        return Math.max(0, 1 - (bl.t - LAMP_BLOW_WIND) / (LAMP_BLOW_GUST * 0.5));
    }

    // the gust: pale streaks from his mouth across to the lamp
    function lampDrawGust() {
        if (!lamp.gust.length) return;
        ctx.save();
        ctx.strokeStyle = '#e8eef2';
        ctx.lineCap = 'round';
        for (const g of lamp.gust) {
            if (g.t < 0) continue;
            const p = Math.min(1, g.t / LAMP_BLOW_GUST);
            const tx = g.l.u * LW, ty = g.l.y;
            const at = q => ({ x: g.sx + (tx - g.sx) * q + Math.sin(q * Math.PI) * g.sway,
                               y: g.sy + (ty - g.sy) * q });
            const a = at(p), z = at(Math.max(0, p - g.len / Math.hypot(tx - g.sx, ty - g.sy)));
            ctx.globalAlpha = 0.55 * Math.sin(Math.min(1, g.t / (LAMP_BLOW_GUST * 1.4)) * Math.PI);
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(z.x, z.y); ctx.lineTo(a.x, a.y); ctx.stroke();
        }
        ctx.restore();
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
            const sx = lamp.x + m.dx, sy = lamp.y + m.dy, tx = m.l.u * LW, ty = m.l.y;
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
    // `lit` 0 draws the dim wick a cold lamp keeps.
    function lampFlame(x, y, k, lit) {
        const tall = lit ? 10 + 42 * k : 7, wide = lit ? 9 + 7 * k : 5;
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
            lampGlow(lamp.x, lamp.y, LAMP_BOSS_W * 0.6, lamp.heat * (1 + 0.8 * lampFlare()));
            // swelling to blow, he leans a little toward the lamp he means
            const sw = lampSwell(), side = lamp.blow ? Math.sign(lamp.blow.l.u * LW - lamp.x) : 0;
            ctx.save();
            ctx.translate(lamp.x, lamp.y);
            ctx.rotate(side * 0.12 * sw);
            ctx.scale(1 + 0.08 * sw, 1 + 0.16 * sw);
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
        lampDrawGust();
        lampDrawEmbers();
        lampDrawSparks();
        lampDrawMotes();
        const grow = phase === 'entrance' ? enterK() : 1;
        if (grow > 0.001) {
            const w = Math.min(LAMP_BOSS_W * 0.72, LW - 120) * grow;
            labBar(Math.max(12, Math.min(LW - 12 - w, lamp.x - w / 2)),
                   Math.max(10, lamp.y - h / 2 - 16), w, b.hp / b.maxHp);
        }
    }