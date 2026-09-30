'use strict';

    // ---- IDOL (boss) --------------------------------------------------------------
    // His head as a stone monument, hung at the top the way Doh hangs at the
    // end of Arkanoid. ball.webp is only 141 x 209, so a photograph of a head
    // goes soft past about twice that -- but stone is a flat material and hides
    // it, so he can be enormous. His face is in two coats, both of them old:
    // Brandons laid in courses like stone over the top, and under them his
    // own head packed like dark fieldstones, older still. A hit knocks the
    // pieces round where it lands clean off, whole, and they tumble away; only
    // a hit on the photograph under both coats hurts him. Nothing grows back,
    // so every bite is progress, and the fight is digging one hole deep
    // rather than scraping the whole face.
    //
    // A head only ever meets the edge of him, so on its own that would leave
    // the middle of his face covered to the end. Hits on him close together
    // make a streak, and every bite in a streak after the first cracks the
    // coat it struck inward from where it landed, toward the middle of him --
    // IDOL_CRACK further for each hit in the streak. A long rally splits him
    // open; a lost head or a pause of IDOL_STREAK_GAP starts it over.
    //
    // A spinning head takes a bigger
    // bite, so the SPIN rule under BONUS reads how much the next hit will
    // knock off. His face is a curve, so anything off its middle comes back
    // at a slant.
    //
    // A hit on bare face knocks him back: he jolts up IDOL_RECOIL and settles
    // over IDOL_RECOIL_SECS, so the next shot has further to go. Without it
    // the ball ping-ponged between his chin and you faster than he could be
    // hurt, and the fight was a rattle rather than shots.
    //
    // He wanders along the top, slowly, to places of his own choosing. Every
    // so often he shakes for IDOL_SHAKE, his shadow gathering on the floor
    // where he will land, and then drops like the stone he is, all the way
    // to the floor. Landing, he throws IDOL_DEBRIS chunks off his chin along
    // your line, out both ways: the first that reaches you is a helping of
    // SLUGGISH -- one a landing, however many meet you -- so beside him is
    // not safe either. Down there his crown is in
    // reach, the one part of him the ball never gets to up top, and a bite
    // out of it is IDOL_CROWN times the size. Land on your middle and he pins you where you
    // stand until he rises again, IDOL_DOWN later and slowly; land on your
    // end and he only shoves you aside. Down there he is a
    // wall: you cannot get past him, and nor can the ball, so whichever side
    // of him you are on is the side you play from until he goes back up --
    // except that a head going over the top of him to the other side sends
    // him straight back up, quickly (IDOL_RISE_QUICK), so you are never left
    // walled off from your own head.
    //
    // He does not drop on a head under him: falling, he knocks it straight
    // down ahead of him, a spike nobody could answer. At the end of his
    // shake he holds, still shaking, until no head is under him or about to
    // be (IDOL_CLEAR_LOOK), and drops anyway after IDOL_CLEAR_MAX so a
    // rally under him cannot keep him up there.
    //
    // Under IDOL_HURT_AT of his health he attacks IDOL_HURT_PACE times as
    // often, and every other attack is a double stomp: the same tell, then
    // two drops, each quicker than the single one -- he falls harder, stays
    // down less, and is back up faster -- and between them a short tremor
    // (IDOL_STOMP_SHAKE) in which he slides over to where you are, so the
    // second comes down on wherever the first sent you.
    let IDOL_HP        = 18;     // hits on bare face to finish him
    let IDOL_W         = 290;    // how wide he is
    let IDOL_Y         = 50;     // where his middle hangs; his crown is off the top
    let IDOL_BITE      = 40;     // px round where a head lands that its stone comes off
    let IDOL_BRICK     = 0.8;    // ...and the rubble under it, as a share of that
    let IDOL_CRACK     = 22;     // px a crack runs inward, per hit in the streak after the first
    let IDOL_CRACK_MAX = 200;    // ...and at most
    let IDOL_CRACK_W   = 13;     // px either side of its line a crack clears
    let IDOL_STREAK_GAP = 4;     // seconds between hits before the streak is lost
    let IDOL_SPIN      = 1;      // ...and this much bigger again at max-bonus spin
    let IDOL_WALK      = 45;     // px/s he wanders at
    let IDOL_WAIT_MIN  = 1.5;    // seconds he heads for one place before picking another, at least...
    let IDOL_WAIT_MAX  = 4.5;    // ...and at most
    let IDOL_DROP_MIN  = 7;      // seconds between drops, at least...
    let IDOL_DROP_MAX  = 13;     // ...and at most
    let IDOL_SHAKE     = 1.5;    // the shaking before a drop, which is the tell
    let IDOL_SHAKE_PX  = 5;      // ...and how hard
    let IDOL_CLEAR_LOOK = 0.25;  // seconds ahead a head's path is read for whether it will be under him
    let IDOL_CLEAR_MAX = 1.2;    // ...and seconds at most he holds for it
    let IDOL_G         = 2600;   // px/s^2 he falls at
    let IDOL_DOWN      = 3;      // seconds he stays down
    let IDOL_RISE      = 150;    // px/s he goes back up at
    let IDOL_RISE_QUICK = 700;   // ...and when a head has gone over him
    let IDOL_CLIMB     = 0.4;    // how much of the original's climb this fight has
    let IDOL_RECOIL    = 60;     // px a hit on bare face knocks him up
    let IDOL_RECOIL_SECS = 0.5;  // ...and how quickly he settles back, a time constant
    let IDOL_DEBRIS    = 2;      // chunks off his chin each way along your line when he lands
    let IDOL_DEBRIS_V  = 420;    // ...px/s they set off at
    let IDOL_DEBRIS_RUN = 120;   // ...and px they skitter before they stop
    let IDOL_HOLD      = 2.5;    // seconds at most he waits, rising, for a head over him to go
    let IDOL_CROWN     = 2.5;    // a bite out of his crown while he is down, times an ordinary one
    let IDOL_HURT_AT   = 0.8;    // share of his health under which he is in his second phase
    let IDOL_HURT_PACE = 2;      // ...and how many times as often he attacks in it
    let IDOL_STOMP_FAST = 1.6;   // a double stomp's fall and rise, times the single drop's
    let IDOL_STOMP_DOWN = 0.7;   // ...seconds each stays down
    let IDOL_STOMP_SHAKE = 0.6;  // ...the tremor before the second
    let IDOL_STOMP_TRACK = 320;  // ...and px/s he slides over you in it
    // The act a run draws him from, 1 easy to 3 hard. Every attack of his is a
    // drop, and telegraphed, and at Paul's numbers a bite stays open
    // for several returns, so what he mostly asks for is aim.
    let IDOL_LVL       = 2;
    // His death (idolDie): the stone still on him crumbles off from where the
    // last blow landed, outward, while the colour goes, and he trembles harder
    // and harder until the head under it bursts. Whatever stone is still on
    // him then goes with the blast.
    let IDOL_DIE_PEEL  = 1.2;    // seconds from the blow until the last of the stone lets go, if the blast has not had it
    let IDOL_DIE_SHAKE = 4;      // px he trembles by, at most, just before he bursts
    let IDOL_DIE_BLAST = 420;    // px/s the pieces of his head burst out at
    LAB_KNOBS.push('IDOL_CLEAR_LOOK', 'IDOL_CLEAR_MAX');
    LAB_KNOBS.push('IDOL_DIE_PEEL', 'IDOL_DIE_SHAKE', 'IDOL_DIE_BLAST');
    LAB_KNOBS.push('IDOL_LVL', 'IDOL_HP', 'IDOL_W', 'IDOL_Y', 'IDOL_BITE', 'IDOL_SPIN',
                   'IDOL_BRICK', 'IDOL_CRACK', 'IDOL_CRACK_MAX', 'IDOL_CRACK_W',
                   'IDOL_STREAK_GAP', 'IDOL_WALK', 'IDOL_WAIT_MIN',
                   'IDOL_WAIT_MAX', 'IDOL_DROP_MIN', 'IDOL_DROP_MAX', 'IDOL_SHAKE', 'IDOL_SHAKE_PX',
                   'IDOL_G', 'IDOL_DOWN', 'IDOL_RISE', 'IDOL_RISE_QUICK', 'IDOL_CLIMB',
                   'IDOL_HURT_AT', 'IDOL_HURT_PACE', 'IDOL_STOMP_FAST', 'IDOL_STOMP_DOWN',
                   'IDOL_STOMP_SHAKE', 'IDOL_STOMP_TRACK', 'IDOL_RECOIL', 'IDOL_RECOIL_SECS',
                   'IDOL_DEBRIS', 'IDOL_DEBRIS_V', 'IDOL_DEBRIS_RUN', 'IDOL_CROWN', 'IDOL_HOLD');

    // His two coats, each a heap of whole pieces (idolCoat). A piece is there
    // or it is gone, so he breaks in Brandon-shaped chunks, never in squares.
    // `seed` keeps each coat the same every run.
    const IDOL_STONE = { kind: 'ashlar', seed: 7 };
    const IDOL_BRICKS = { kind: 'rubble', seed: 19 };
    const IDOL_CHIPS_MAX = 140;      // pieces tumbling off him at once, at most

    let idol = null;

    LAB_BOSS.idol = {
        start(b) {
            bw = IDOL_W;
            bh = bw * (BALL_RY / BALL_RX);
            b.hp = b.maxHp = IDOL_HP;
            b.x = (LW - bw) / 2;
            b.y = -(bh + 40);
            idol = { stone: idolCoat(IDOL_STONE), brick: idolCoat(IDOL_BRICKS), chips: [], dust: [], t: 0, pend: null, bites: 0, streak: 0, lastHit: -99,
                     x: LW / 2, tx: LW / 2, wander: IDOL_WAIT_MIN, cy: IDOL_Y,
                     stage: 'idle', st: 0, vy: 0, jx: 0, pin: null, side: 0, drops: 0, balk: 0, balks: 0,
                     doubles: 0, dblNext: true, dbl: 0, debris: [], debrisHits: 0, recoils: 0, crownBites: 0,
                     next: IDOL_DROP_MIN + Math.random() * (IDOL_DROP_MAX - IDOL_DROP_MIN) };
        },
        reset() { idol = null; },
        update(b, dt) {
            bw = IDOL_W;
            bh = bw * (BALL_RY / BALL_RX);
            if (phase === 'entrance') {
                const raw = enterK(), k = raw * raw * (3 - 2 * raw);
                const from = -(bh + 40);
                b.x = (LW - bw) / 2;
                b.y = from + (IDOL_Y - bh / 2 - from) * k;
                return;
            }
            if (phase === 'play') idol.t += dt;
            // a head lost, or too long between hits, and the streak is gone
            if (phase !== 'play' || idol.t - idol.lastHit > IDOL_STREAK_GAP) idol.streak = 0;
            idolCrossed();
            idolMove(dt);
            b.x = idol.x + idol.jx - bw / 2;
            b.y = idol.cy - bh / 2;
            idolDebrisStep(dt);
            idol.chips = idol.chips.filter(c => clock - c.t0 < c.life);
            idol.dust = idol.dust.filter(c => clock - c.t0 < c.life);
        },
        contact(br, ball) {
            if (idolEject(br, ball)) { idol.pend = null; return null; }
            const hit = ellipseContact(ball, br.x + bw / 2, br.y + bh / 2, bw / 2, bh / 2);
            // which coat it met: the stone if there is any, else the rubble, else him
            if (!hit) idol.pend = null;
            else if (idolAt(idol.stone, br, hit.cx, hit.cy)) idol.pend = { coat: idol.stone };
            else if (idolAt(idol.brick, br, hit.cx, hit.cy)) idol.pend = { coat: idol.brick };
            else idol.pend = { bare: true };
            return hit;
        },
        // falling, he only knocks the ball down ahead of him: no chip, no wound
        touch(br, ball, hit) {
            idol.hitBall = ball;
            if (idol.stage !== 'fall') return false;
            labBounce(ball, hit);
            ball.vy = Math.abs(ball.vy);
            idol.pend = null;
            return true;
        },
        fence: idolFence,
        // stone clacks like a statue; bare face flashes like any boss
        glances() { return !idol.pend || !idol.pend.bare || bossIF > 0; },
        hit(b, cx, cy) {
            const p = idol.pend;
            idol.pend = null;
            if (!p) return;
            if (!p.bare) {
                // the same number the rule under BONUS is filled from
                const k = Math.max(0, Math.min(1, (liveSpinMul() - 1) / (SPIN_MUL - 1)));
                const low = p.coat === idol.brick;
                // down on the floor, his crown is in reach, and soft
                const crown = (idol.stage === 'down' || idol.stage === 'rise') && cy < b.y + bh * 0.3;
                if (crown) { idol.crownBites++; idolRollOff(cx, cy); }
                const r = IDOL_BITE * (1 + IDOL_SPIN * k) * (low ? IDOL_BRICK : 1) * (crown ? IDOL_CROWN : 1);
                idolChip(b, p.coat, cx, cy, r);
                idolStreak();
                if (idol.streak > 1) {
                    idolCrack(b, p.coat, cx, cy, Math.min(IDOL_CRACK_MAX, IDOL_CRACK * (idol.streak - 1)));
                }
                return;
            }
            if ((idol.stage === 'down' || idol.stage === 'rise') && cy < b.y + bh * 0.3) idolRollOff(cx, cy);
            if (bossIF > 0) return;
            idolStreak();                  // a wound keeps the streak going too
            b.flash = 1;
            bossIF = BOSS_IF;
            b.hp = Math.max(0, b.hp - 1);
            bossHits++;
            // knocked back up, if he is up there to be knocked
            if (idol.stage === 'idle' || idol.stage === 'shake') {
                idol.cy = Math.max(IDOL_Y - IDOL_RECOIL * 1.5, idol.cy - IDOL_RECOIL);
                idol.recoils++;
            }
            const done = b.hp <= 1e-6;
            award(BOSS_PTS * (done ? 5 : 1), cx, cy);
            if (done) { idolDie(b, cx, cy); return; }
            if (bossHits % BOSS_CAP === 0 && !capsule) {
                capsule = { x: cx, y: cy, kind: labCapKind() };
            }
            if (++hits === 4 || hits === 12) bumpSpeed(1.12);
        },
        draw: idolDraw,
        drawFall() { idolDying(); labHeadFall(idolDrawChips); },
        climb() { return IDOL_CLIMB; },
        finish(b) {
            b.hp = Math.min(b.hp, 1);
            for (const coat of [idol.stone, idol.brick]) { for (const pc of coat.pieces) pc.on = false; coat.dirty = true; }
            return true;
        },
        state(b) {
            const gone = coat => Math.round(100 * coat.pieces.filter(pc => !pc.on).length / coat.pieces.length);
            const bare = gone(idol.brick);
            return { name: 'IDOL', hp: b.hp, max: b.maxHp, w: bw,
                     line: 'stone ' + gone(idol.stone) + '% off, rubble ' + bare + '% off · ' + idol.bites + ' bites · streak ' + idol.streak + ' · ' +
                           idol.stage + (idol.pin ? ', pinning you' : '') + ' · ' + idol.drops + ' drops (' + idol.balks + ' held for a head under him), ' +
                           idol.doubles + ' double stomps · ' + idol.recoils + ' knocked back · ' + idol.crownBites +
                           ' crown bites · debris ' + idol.debrisHits + ' on you' };
        }
    };

    const idolRand = (a, b) => a + Math.random() * (b - a);

    // While he is falling or down, which side of his middle each head in
    // play is on; one that changes sides has gone over him, and he goes back
    // up quickly (idolMove) so you can follow it
    function idolCrossed() {
        const low = idol.stage === 'fall' || idol.stage === 'down';
        for (const ball of balls) {
            const side = Math.sign(ball.x - idol.x);
            if (low && !ball.stuck && ball.idolSide && side && side !== ball.idolSide) idol.quick = true;
            ball.idolSide = low ? side : 0;
        }
    }

    // A head whose middle has got inside him -- he fell past it faster than
    // it was knocked ahead of him, or landed on it -- is shot back out of the
    // top of his head, or out under his chin while his top is off the screen.
    // Left in there it bounced off the inside of his outline and wounded him
    // every BOSS_IF, which finished him in seconds. True if it moved one.
    const IDOL_INSIDE = 0.92;        // how deep, as a share of his outline, counts as inside
    function idolEject(br, ball) {
        const cx = br.x + bw / 2, cy = br.y + bh / 2;
        const q = Math.hypot((ball.x - cx) / (bw / 2), (ball.y - cy) / (bh / 2));
        if (q >= IDOL_INSIDE) return false;
        const s = effSpeed() * (ball.boost || 1), ry = extY(ball);
        const up = cy - bh / 2 - ry - 4 > ry;
        ball.x = Math.max(extX(ball), Math.min(LW - extX(ball), ball.x));
        ball.y = up ? cy - bh / 2 - ry - 4 : cy + bh / 2 + ry + 4;
        const a = (Math.random() - 0.5) * 0.6;
        ball.vx = Math.sin(a) * s;
        ball.vy = (up ? -1 : 1) * Math.cos(a) * s;
        return true;
    }

    // Wandering while he is up; the shake, the drop, the wait and the climb
    // back otherwise. The cycle runs through a lost head and a serve like
    // anything that is already falling would, and only a rally starts one.
    function idolMove(dt) {
        const h = bw * (BALL_RY / BALL_RX);
        idol.jx = 0;
        // settling back down after a knock, while he is up
        if (idol.stage === 'idle' || idol.stage === 'shake') idol.cy += (IDOL_Y - idol.cy) * (1 - Math.exp(-dt / IDOL_RECOIL_SECS));
        switch (idol.stage) {
            case 'idle': {
                if ((idol.wander -= dt) <= 0) {
                    idol.tx = idolRand(bw / 2 + 20, LW - bw / 2 - 20);
                    idol.wander = idolRand(IDOL_WAIT_MIN, IDOL_WAIT_MAX);
                }
                // easing in to where he is going, so he settles rather than stops
                const d = idol.tx - idol.x;
                const v = Math.sign(d) * IDOL_WALK * Math.min(1, Math.abs(d) / 40);
                idol.x += Math.abs(v * dt) > Math.abs(d) ? d : v * dt;
                if (phase === 'play' && (idol.next -= dt) <= 0) {
                    // hurt, the double stomp takes turns with the drop, the double first
                    if (idolHurt() && idol.dblNext) { idol.dbl = 2; idol.doubles++; }
                    if (idolHurt()) idol.dblNext = !idol.dblNext;
                    idol.stage = 'shake';
                    idol.st = 0;
                }
                break;
            }
            case 'shake': {
                idol.st += dt;
                // the second of a double: short, and sliding over to you
                const second = idol.dbl === 1;
                if (second) {
                    const d = Math.max(bw / 2, Math.min(LW - bw / 2, paddle.x)) - idol.x;
                    idol.x += Math.sign(d) * Math.min(Math.abs(d), IDOL_STOMP_TRACK * dt);
                }
                // a tremor that builds, not a strobe: he moves, nothing flashes
                idol.jx = Math.sin(idol.st * 55) * IDOL_SHAKE_PX * Math.min(1, idol.st / 0.6);
                if (idol.st < (second ? IDOL_STOMP_SHAKE : IDOL_SHAKE)) break;
                // a head under him holds him up, shaking, until it is clear
                if (idolHeadUnder() && (idol.balk += dt) < IDOL_CLEAR_MAX) {
                    if (idol.balk <= dt) idol.balks++;
                    break;
                }
                idol.balk = 0;
                idol.stage = 'fall'; idol.vy = 0; idol.drops++;
                break;
            }
            case 'fall': {
                idol.vy += IDOL_G * (idol.dbl ? IDOL_STOMP_FAST * IDOL_STOMP_FAST : 1) * dt;
                idol.cy += idol.vy * dt;
                const floor = padY() + padH() / 2 + 6;
                // Your middle under where he will land: he stops where he met
                // you, and you are his until he rises. Anything less is a
                // graze, and he shoves you out to the side you were on
                // (idolFence) on his way down. Judged on his footprint on the
                // floor, because the slice of him at your height starts at
                // nothing and grows, and a middle is never under it at first.
                const c = idolChord();
                if (c && Math.abs(paddle.x - idol.x) < idolChord(floor - h / 2)) {
                    idol.pin = { x: paddle.x };
                    idolLand();
                } else if (c && idolOver() > 0 && !idol.side) {
                    idol.side = paddle.x < idol.x ? -1 : 1;
                }
                if (idol.stage === 'fall' && idol.cy + h / 2 >= floor) {
                    idol.cy = floor - h / 2;
                    idolLand();
                }
                break;
            }
            case 'down':
                if ((idol.st += dt) >= (idol.dbl ? IDOL_STOMP_DOWN : IDOL_DOWN) || idol.quick) {
                    idol.stage = 'rise';
                    idol.pin = null;
                    idol.side = 0;          // he may be over you: no fence until you are clear
                }
                break;
            case 'rise':
                // Not up through a head over him: it would be pinned between him
                // and the ceiling. He waits IDOL_HOLD at most, so a head that
                // stays up there cannot keep him down; idolEject has it then.
                if (balls.some(q => q.y < idol.cy - h * 0.3 && Math.abs(q.x - idol.x) < bw / 2 + BALL_RX) &&
                    (idol.hold = (idol.hold || 0) + dt) < IDOL_HOLD) break;
                idol.cy = Math.max(IDOL_Y, idol.cy - (idol.quick ? IDOL_RISE_QUICK
                                                   : IDOL_RISE * (idol.dbl ? IDOL_STOMP_FAST : 1)) * dt);
                if (idol.cy <= IDOL_Y) {
                    idol.quick = false;
                    idol.hold = 0;
                    if (idol.dbl === 2) { idol.dbl = 1; idol.stage = 'shake'; idol.st = 0; break; }
                    idol.dbl = 0;
                    idol.stage = 'idle';
                    idol.next = idolRand(IDOL_DROP_MIN, IDOL_DROP_MAX) / (idolHurt() ? IDOL_HURT_PACE : 1);
                }
                break;
        }
    }

    // A head off his crown while he is down is turned off his nearer side,
    // or it bounces between his crown and the ceiling for good.
    function idolRollOff(cx, cy) {
        const ball = idol.hitBall;
        if (!ball) return;
        let nx = ball.x - cx, ny = ball.y - cy;
        const l = Math.hypot(nx, ny) || 1;
        const side = ball.x < idol.x ? -1 : 1;
        labSteer(ball, { nx: nx / l, ny: ny / l }, idol.x + side * (bw / 2 + 80), idol.cy, 0.6);
    }

    // Whether a head in play is below him and across his width, or will be
    // within IDOL_CLEAR_LOOK on its way: one he would spike if he dropped.
    // One on the paddle waiting to be served is going nowhere yet.
    function idolHeadUnder() {
        const reach = bw / 2 + BALL_RX;
        return balls.some(q => !q.stuck && q.y > idol.cy &&
                          Math.min(q.x, q.x + q.vx * IDOL_CLEAR_LOOK) < idol.x + reach &&
                          Math.max(q.x, q.x + q.vx * IDOL_CLEAR_LOOK) > idol.x - reach);
    }

    // in his second phase: under IDOL_HURT_AT of his health
    function idolHurt() {
        const b = bricks[0];
        return !!b && b.hp < b.maxHp * IDOL_HURT_AT;
    }

    function idolLand() {
        idol.stage = 'down';
        idol.st = 0;
        idol.vy = 0;
        // stone off his chin where he hit
        const b = bricks[0];
        b.x = idol.x - bw / 2;
        b.y = idol.cy - bw * (BALL_RY / BALL_RX) / 2;
        for (let i = 0; i < 16; i++) idolDust(b.x + bw * (0.25 + Math.random() * 0.5), b.y + bh * 0.95);
        // chunks off his chin, out along your line both ways
        const c = idolChord(), n = Math.max(0, Math.round(IDOL_DEBRIS)), drop = { hit: false };
        for (const dir of [-1, 1]) {
            for (let i = 0; i < n; i++) {
                const v = IDOL_DEBRIS_V * (0.7 + 0.3 * (i + 1) / n);
                idol.debris.push({ drop, x: idol.x + dir * c * 0.9, dir, v, run: 0, max: IDOL_DEBRIS_RUN * (0.6 + 0.4 * (i + 1) / n),
                                   rot: Math.random() * 6.28, spin: dir * (6 + Math.random() * 6), tone: (Math.random() * IDOL_RUBBLE.length) | 0,
                                   hop: Math.random() * 6.28 });
            }
        }
    }

    // The chunks off his chin: they skitter out along your line, slowing to a
    // stop, and one that meets you is spent on you.
    const IDOL_DEBRIS_W = 26;        // how big a chunk is, across
    function idolDebrisStep(dt) {
        if (phase !== 'play') { idol.debris = []; return; }
        for (let i = idol.debris.length - 1; i >= 0; i--) {
            const d = idol.debris[i];
            const k = Math.max(0, 1 - d.run / d.max), step = d.v * k * dt + 20 * dt;
            d.x += d.dir * step;
            d.run += step;
            d.rot += d.spin * k * dt;
            const sg = segs().find(s => Math.abs(d.x - s.cx) < s.w / 2 + IDOL_DEBRIS_W * 0.4);
            // under him, you are pinned already: nothing he throws out reaches you there
            if (sg && !idol.pin && !d.drop.hit) { d.drop.hit = true; addDrag(sg, d.x); idol.debrisHits++; idol.debris.splice(i, 1); continue; }
            if (d.run >= d.max || d.x < -IDOL_DEBRIS_W || d.x > LW + IDOL_DEBRIS_W) idol.debris.splice(i, 1);
        }
    }

    // his shadow on the floor while he shakes, gathering where he will land,
    // and the chunks skittering along it after
    function idolDrawFloor() {
        const base = padY() + padH() / 2;
        if (idol.stage === 'shake' || idol.stage === 'fall') {
            const k = idol.stage === 'fall' ? 1 : Math.min(1, idol.st / (idol.dbl === 1 ? IDOL_STOMP_SHAKE : IDOL_SHAKE));
            const w = bw * 0.45 * (0.5 + 0.5 * k);
            ctx.save();
            ctx.globalAlpha = 0.18 + 0.32 * k;
            ctx.fillStyle = IDOL_RUBBLE[0];
            ctx.beginPath();
            ctx.ellipse(idol.x, base, w, 10, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.5 * k;
            ctx.strokeStyle = IDOL_ASHLAR[0];
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }
        for (const d of idol.debris) {
            const sp = idolCobble(IDOL_RUBBLE[d.tone]);
            if (!sp) continue;
            const w = IDOL_DEBRIS_W, h = w * (BALL_RY / BALL_RX);
            const hop = Math.abs(Math.sin(d.run / 30 + d.hop)) * 6 * Math.max(0, 1 - d.run / d.max);
            ctx.save();
            ctx.translate(d.x, base - h / 2 - hop);
            ctx.rotate(d.rot);
            ctx.drawImage(sp, -w / 2, -h / 2, w, h);
            ctx.restore();
        }
    }

    // how far into the paddle's span his outline reaches across the band the
    // paddle lies in, or 0 if it does not: the widest chord of him in that band
    function idolChord(cy = idol.cy) {
        const a = bw / 2, e = bw * (BALL_RY / BALL_RX) / 2;
        const top = padY() - padH() / 2, bot = padY() + padH() / 2;
        const dy = Math.max(top, Math.min(bot, cy)) - cy;
        if (Math.abs(dy) >= e) return 0;
        return a * Math.sqrt(1 - (dy / e) * (dy / e));
    }
    function idolOver() {
        const c = idolChord();
        if (!c) return 0;
        const hs = halfSpan();
        return Math.min(paddle.x + hs, idol.x + c) - Math.max(paddle.x - hs, idol.x - c);
    }

    // After the paddle has moved: pinned, he stays put; otherwise, while any
    // of the IDOL is down in the paddle's band, he cannot cross it.
    function idolFence() {
        if (phase === 'entrance') return;
        const was = paddle.x;
        if (idol.pin) {
            paddle.x = idol.pin.x;
        } else {
            const c = idolChord();
            if (!c) { idol.side = 0; return; }
            const hs = halfSpan();
            if (!idol.side) {
                // clear of him now, so from here on this is your side
                if (idolOver() <= 0) idol.side = paddle.x < idol.x ? -1 : 1;
                return;
            }
            paddle.x = idol.side < 0 ? Math.min(paddle.x, idol.x - c - hs)
                                     : Math.max(paddle.x, idol.x + c + hs);
            paddle.x = Math.max(hs, Math.min(LW - hs, paddle.x));
        }
        if (paddle.x !== was) { paddle.prevX = paddle.x; paddle.vx = 0; }
    }

    // A coat: every piece of it, laid out once in the baked head's own pixels
    // (the grey head sprite's, 2x ball.webp), back to front. The stone is
    // courses of him lying level -- brick-shaped already -- closer together
    // than he is tall so each lies on the one under it, in a running bond,
    // each piece a weathered shade of his own and set a little crooked. The
    // rubble is his head at every angle in staggered rows. Only pieces whose
    // middles are on his face are kept; the bake cuts them to his outline.
    const IDOL_ASHLAR = ['#a39a86', '#968c78', '#aaa18c', '#8e8674', '#9d9483', '#8a8470'];
    // the rubble is cold dark slate against the stone's warm pale, so a hole
    // in the stone shows it plainly, and it is nothing like his skin under it
    const IDOL_RUBBLE = ['#4a5160', '#3f4655', '#566072', '#454c5a', '#5d6679', '#3b4250'];
    const IDOL_COURSE = 0.075;       // a course of the stone, as a share of his height
    const IDOL_COBBLE = 0.07;        // ...and a fieldstone head in the rubble
    const IDOL_MORTAR = 1.5;         // how much bigger than a stone piece the mortar behind it is
    const IDOL_MORTAR_RUBBLE = 1.25; // ...and behind a fieldstone
    function idolCoat(g) {
        const W = (ballImg.naturalWidth || 141) * 2, H = (ballImg.naturalHeight || 209) * 2;   // as baked
        let seed = g.seed * 7919 + 13;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        const tones = g.kind === 'ashlar' ? IDOL_ASHLAR : IDOL_RUBBLE;
        const pieces = [];
        const add = (x, y, w, h, a) => {
            const du = x / W - 0.5, dv = y / H - 0.5;
            if (du * du * 4 + dv * dv * 4 > 1.02) return;
            pieces.push({ x, y, w, h, a, mir: rnd() < 0.5, tone: (rnd() * tones.length) | 0, on: true });
        };
        if (g.kind === 'ashlar') {
            const ch = H * IDOL_COURSE, cw = ch * SHAPE_ASPECT;
            for (let row = 0, y = ch / 2; y < H + ch; row++, y += ch * 0.6) {
                for (let bx = (row % 2 ? -cw / 2 : 0) - rnd() * cw * 0.2; bx < W + cw; bx += cw * 0.8) {
                    const s = 1 + (rnd() - 0.5) * 0.18;
                    add(bx + cw / 2, y + (rnd() - 0.5) * ch * 0.15, cw * s, ch * s, (rnd() - 0.5) * 0.12);
                }
            }
        } else {
            const hh = H * IDOL_COBBLE, hw = hh * (BALL_RX / BALL_RY);
            for (let row = 0, y = 0; y < H + hh; row++, y += hh * 0.62) {
                for (let bx = (row % 2 ? hw * 0.55 : 0) - rnd() * hw * 0.4; bx < W + hw; bx += hw * 1.05) {
                    const s = 0.85 + rnd() * 0.35;
                    add(bx, y + (rnd() - 0.5) * hh * 0.25, hw * s, hh * s, (rnd() - 0.5) * Math.PI * 1.4);
                }
            }
        }
        return { g, W, H, pieces, canvas: null, dirty: true };
    }

    // a piece's middle in the field, on the head drawn at b
    function idolPieceAt(coat, b, pc) {
        return { x: b.x + pc.x * bw / coat.W, y: b.y + pc.y * bh / coat.H };
    }

    // whether a coat still covers the point a head met him at: any piece
    // whose middle is within its own reach of it
    function idolAt(coat, b, x, y) {
        const k = bw / coat.W;
        for (const pc of coat.pieces) {
            if (!pc.on) continue;
            const m = idolPieceAt(coat, b, pc), reach = Math.max(pc.w, pc.h) * 0.5 * k;
            if (Math.hypot(m.x - x, m.y - y) < reach) return true;
        }
        return false;
    }

    // every piece of a coat still on him whose middle is within r of (x, y)
    // comes off, and tumbles; the nearest one always does, so no hit on a
    // coat is ever for nothing
    function idolKnock(coat, b, x, y, r) {
        let near = null, nd = Infinity, n = 0;
        for (const pc of coat.pieces) {
            if (!pc.on) continue;
            const m = idolPieceAt(coat, b, pc), d = Math.hypot(m.x - x, m.y - y);
            if (d < nd) { nd = d; near = pc; }
            if (d < r) { idolFall(coat, b, pc); n++; }
        }
        if (!n && near && nd < r * 2) idolFall(coat, b, near);
    }

    // one piece off him: gone from the coat, and falling as itself. `blast`,
    // his head bursting under it, throws it out from his middle instead
    function idolFall(coat, b, pc, blast = 0, cap = IDOL_CHIPS_MAX) {
        pc.on = false;
        coat.dirty = true;
        if (idol.chips.length >= cap) return;
        const m = idolPieceAt(coat, b, pc), k = bw / coat.W;
        const ox = m.x - (b.x + bw / 2), oy = m.y - (b.y + bh / 2);
        const out = Math.sign(ox) || 1;
        let vx = out * (30 + Math.random() * 90), vy = -60 - Math.random() * 90;
        if (blast) {
            const l = Math.hypot(ox, oy) || 1, s = blast * (0.5 + 0.7 * Math.random());
            vx = ox / l * s;
            vy = oy / l * s - blast * 0.3;
        }
        idol.chips.push({ coat, pc, x0: m.x, y0: m.y, w: pc.w * k, h: pc.h * k, vx, vy,
                          va: (Math.random() - 0.5) * (blast ? 16 : 8), t0: clock, life: 1.3 + Math.random() * 0.5 });
    }

    // a puff of grit, for what does not come off in pieces
    function idolDust(x, y) {
        idol.dust.push({ x0: x, y0: y, vx: (Math.random() - 0.5) * 120, vy: -40 - Math.random() * 80,
                         s: 2 + Math.random() * 3, t0: clock, life: 0.8 + Math.random() * 0.5 });
    }

    // a bite out of a coat: the middle of it gone, the edge of it thinned
    function idolStreak() {
        idol.streak++;
        idol.lastHit = idol.t;
    }

    // A crack from where a head struck, in toward the middle of his face,
    // wandering a little as it goes: every piece of the coat along it off.
    function idolCrack(b, coat, x, y, len) {
        const mx = b.x + bw / 2, my = b.y + bh / 2;
        let ang = Math.atan2(my - y, mx - x);
        const step = IDOL_CRACK_W * 0.6;
        let px = x, py = y;
        for (let d = 0; d < len; d += step) {
            ang += (Math.random() - 0.5) * 0.5;
            px += Math.cos(ang) * step;
            py += Math.sin(ang) * step;
            for (const pc of coat.pieces) {
                if (!pc.on) continue;
                const m = idolPieceAt(coat, b, pc);
                if (Math.hypot(m.x - px, m.y - py) < IDOL_CRACK_W) idolFall(coat, b, pc);
            }
        }
    }

    function idolChip(b, coat, x, y, r) {
        idol.bites++;
        idolKnock(coat, b, x, y, r);
    }

    // the pieces coming off him, each turning as it falls, and the grit
    function idolDrawChips() {
        for (const c of idol.chips) {
            const sp = idolPieceSprite(c.coat, c.pc);
            if (!sp) continue;
            const t = clock - c.t0;
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - t / c.life);
            ctx.translate(c.x0 + c.vx * t, c.y0 + c.vy * t + 450 * t * t);
            ctx.rotate(c.pc.a + c.va * t);
            if (c.pc.mir) ctx.scale(-1, 1);
            ctx.drawImage(sp, -c.w / 2, -c.h / 2, c.w, c.h);
            ctx.restore();
        }
        ctx.fillStyle = '#8a8272';
        for (const c of idol.dust) {
            const t = clock - c.t0;
            ctx.globalAlpha = Math.max(0, 1 - t / c.life);
            ctx.fillRect(c.x0 + c.vx * t - c.s / 2, c.y0 + c.vy * t + 450 * t * t - c.s / 2, c.s, c.s);
        }
        ctx.globalAlpha = 1;
    }

    // He dies in whatever stone he still had on, and it crumbles off him
    // (idolDying) while the colour goes out of the face under it; then the
    // bare grey head bursts, out from its middle, rather than peeling away
    // chin first the way a body does.
    const IDOL_DIE_STEP = 0.05;      // the stone lets go in clumps this far apart, so he is rebaked a few times, not every frame
    const IDOL_DIE_CHIPS = 600;      // ...and all of it may be in the air at once
    function idolDie(b, cx, cy) {
        b.alive = false;
        clearStage();
        labHeadDied(b.x + bw / 2, b.y + bh / 2, bw);
        bossFall.cover = (x, y, w, h) => { idolDrawCoat(idol.brick, x, y, w, h); idolDrawCoat(idol.stone, x, y, w, h); };
        // each piece still on him lets go when the wave out from the blow
        // reaches it, the rubble a little after the stone over it
        const far = Math.max(bw, bh);
        for (const coat of [idol.stone, idol.brick]) {
            for (const pc of coat.pieces) {
                if (!pc.on) continue;
                const m = idolPieceAt(coat, b, pc);
                const go = IDOL_DIE_PEEL * (0.1 + 0.75 * Math.min(1, Math.hypot(m.x - cx, m.y - cy) / far) +
                                            (coat === idol.brick ? 0.1 : 0) + 0.15 * Math.random());
                pc.go = Math.round(go / IDOL_DIE_STEP) * IDOL_DIE_STEP;
            }
        }
        for (const p of bossFall.pieces) {
            const du = (p.u + 0.5) / HEAD_COLS - 0.5, dv = (p.v + 0.5) / HEAD_ROWS - 0.5;
            const a = Math.random() * Math.PI * 2, s = IDOL_DIE_BLAST * (0.7 + 0.6 * Math.random());
            p.vx = du * 2 * s + Math.cos(a) * s * 0.25;
            p.vy = dv * 2 * s + Math.sin(a) * s * 0.25 - s * 0.2;
            p.spin = (Math.random() - 0.5) * 7;
            p.wait = Math.random() * 0.06;
        }
        idol.die = { x: bossFall.x, blown: false };
    }

    // His death, frame by frame, in step with the takeover's clock: the stone
    // letting go, the tremor building, and at A_DIE the burst, which takes
    // what stone is left with it. Run from his drawFall, since nothing steps
    // him once he is dead.
    function idolDying() {
        const c = bossFall, d = idol && idol.die;
        if (!c || !c.head || !d) return;
        const t = ascendT, blast = t >= A_DIE;
        const wilt = Math.max(0, Math.min(1, t / A_DIE)), e = wilt * wilt * (3 - 2 * wilt);
        const k = Math.max(0, Math.min(1, (t - A_DIE * 0.35) / (A_DIE * 0.65)));
        c.x = d.x + (blast ? 0 : Math.sin(clock * 55) * IDOL_DIE_SHAKE * k * k);
        // where labHeadFall is drawing him this frame, sag and tremor and all
        const at = { x: c.x - bw / 2, y: c.y - bh / 2 + e * F_SAG };
        for (const coat of [idol.stone, idol.brick]) {
            for (const pc of coat.pieces) {
                if (pc.on && (blast || t >= pc.go)) idolFall(coat, at, pc, blast ? IDOL_DIE_BLAST : 0, IDOL_DIE_CHIPS);
            }
        }
        if (blast && !d.blown) {
            d.blown = true;
            for (let i = 0; i < 40; i++) {
                const a = Math.random() * Math.PI * 2, r = Math.random();
                idolDust(c.x + Math.cos(a) * bw * 0.4 * r, c.y + F_SAG + Math.sin(a) * bh * 0.4 * r);
            }
        }
        idol.chips = idol.chips.filter(q => clock - q.t0 < q.life);
        idol.dust = idol.dust.filter(q => clock - q.t0 < q.life);
    }

    // The sprite one piece is drawn with: a Brandon carved the way the
    // statues are, or his head flat in its stone with a faint pass of his
    // own shading, in the piece's tone and at the coat's size.
    function idolPieceSprite(coat, pc) {
        if (coat.g.kind === 'ashlar') {
            const ch = coat.H * IDOL_COURSE;
            return shapeSprite('idolA' + pc.tone, IDOL_ASHLAR[pc.tone], ch * SHAPE_ASPECT, ch, 'statue');
        }
        return idolCobble(IDOL_RUBBLE[pc.tone]);
    }

    // A coat as it stands, baked into a canvas of its own whenever a piece
    // comes off, and only then: each piece on a dark halo of itself (the
    // mortar, which goes with it), then cut to his outline, with a faint
    // pass of his own shading over it so it still reads as his face.
    function idolBake(coat) {
        if (!coat.dirty && coat.canvas) return coat.canvas;
        const flat = headSprite2('flat', '#000000');
        if (!flat || !ready(paddleImg)) return null;
        const c = coat.canvas || (coat.canvas = document.createElement('canvas'));
        c.width = flat.width; c.height = flat.height;
        const x = c.getContext('2d');
        x.clearRect(0, 0, c.width, c.height);
        const sx = c.width / coat.W, sy = c.height / coat.H;
        const stone = coat.g.kind === 'ashlar';
        const halo = stone ? IDOL_MORTAR : IDOL_MORTAR_RUBBLE;
        const place = (pc, k, img) => {
            x.save();
            x.translate(pc.x * sx, pc.y * sy);
            x.rotate(pc.a);
            if (pc.mir) x.scale(-1, 1);
            const w = pc.w * sx * k, h = pc.h * sy * k;
            x.drawImage(img, -w / 2, -h / 2, w, h);
            x.restore();
        };
        const sprites = coat.pieces.map(pc => pc.on ? idolPieceSprite(coat, pc) : null);
        if (coat.pieces.some((pc, i) => pc.on && !sprites[i])) return null;
        // every piece's mortar first, under all of them: a wider dark copy of
        // him that goes when he does, so what is still on reads as solid
        coat.pieces.forEach((pc, i) => { if (pc.on) place(pc, halo, idolShade(sprites[i], stone ? '#3e382f' : '#1c2028')); });
        coat.pieces.forEach((pc, i) => { if (pc.on) place(pc, 1, sprites[i]); });
        x.globalAlpha = 0.18;
        x.globalCompositeOperation = 'overlay';
        x.drawImage(ballImg, 0, 0, c.width, c.height);
        x.globalAlpha = 1;
        x.globalCompositeOperation = 'destination-in';
        x.drawImage(flat, 0, 0);
        x.globalCompositeOperation = 'source-over';
        coat.dirty = false;
        return c;
    }

    // a piece's outline filled flat in `ink` -- its mortar -- baked once per piece and ink
    const idolShades = new Map();
    function idolShade(sp, ink) {
        if (!idolShades.has(sp)) idolShades.set(sp, {});
        const got = idolShades.get(sp);
        if (got[ink]) return got[ink];
        const c = document.createElement('canvas');
        c.width = sp.width; c.height = sp.height;
        const g = c.getContext('2d');
        g.drawImage(sp, 0, 0);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = ink;
        g.fillRect(0, 0, c.width, c.height);
        got[ink] = c;
        return c;
    }

    // his head as a fieldstone: flat in the stone's colour, with the same
    // faint pass of his own shading the carved statues get, so a face is in it
    function idolCobble(ink) {
        const k = 'idolCobble' + ink;
        if (spriteCache.has(k)) return spriteCache.get(k);
        const flat = headSprite2('flat', ink), grey = headSprite2('grey');
        if (!flat || !grey) return null;
        const c = document.createElement('canvas');
        c.width = flat.width; c.height = flat.height;
        const g = c.getContext('2d');
        g.drawImage(flat, 0, 0);
        g.globalCompositeOperation = 'source-atop';
        g.globalAlpha = 0.3;
        g.drawImage(grey, 0, 0);
        spriteCache.set(k, c);
        return c;
    }

    function idolDrawCoat(coat, x, y, w, h) {
        const c = idolBake(coat);
        if (c) ctx.drawImage(c, x, y, w, h);
    }

    function idolDraw(b) {
        const o = b.jt > 0 ? wobble(b.jt) * JIG_BRICK * 0.5 : 0;   // he barely gives when struck
        const x = b.x + b.jnx * o, y = b.y + b.jny * o, w = bw, h = bh;
        const rim = headSprite2('flat', STONE_RIM);
        if (!rim) return;
        // the pale stone round the outside of him, the statues' mark
        const m = STONE_RIM_W * 1.6;
        ctx.drawImage(rim, x - m, y - m * h / w, w + 2 * m, h + 2 * m * h / w);
        // the photograph, under everything
        ctx.drawImage(ballImg, x, y, w, h);
        // the rubble over it, and the stone over that
        idolDrawCoat(idol.brick, x, y, w, h);
        idolDrawCoat(idol.stone, x, y, w, h);
        if (b.flash > 0) {
            ctx.globalAlpha = Math.min(1, b.flash) * 0.7;
            ctx.drawImage(headSprite2('flat', '#f2efe9'), x, y, w, h);
            ctx.globalAlpha = 1;
        }
        idolDrawChips();
        idolDrawFloor();
        // his crown is off the top of the screen, so his health runs along it
        const grow = phase === 'entrance' ? enterK() : 1;
        if (grow > 0.001) labBar(LW / 2 - 150 * grow, 10, 300 * grow, b.hp / b.maxHp);
    }