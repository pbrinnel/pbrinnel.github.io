'use strict';

    // ---- GLEEOK (boss) -----------------------------------------------------------
    // Heads on necks, hanging off a body that cannot be hurt while it has one
    // on a neck. Each head takes a few hits, and the last of them does not
    // kill it: it tears the head loose, and a loose head flies free about the
    // field, still alive and still to be finished. One that reaches your line
    // leaves a helping of SLUGGISH on you.
    //
    // A ball can't be aimed at one head of three, so the fight hands you the
    // choosing in other ways:
    //
    //   The lunges. Every GL_LUNGE_MIN..GL_LUNGE_MAX, the head nearest you
    //   draws back, shaking, with a mark on your line that follows you, and
    //   snaps down its neck at you: under it and you are SLUGGISH. Then it
    //   hangs low and dazed for GL_LUNGE_DAZE, near the ball and worth
    //   GL_LUNGE_DMG a hit. It is on the heads' own clock rather than on
    //   where you stand, since the ball decides where you stand.
    //
    //   What you tear off. Finishing a loose head does not pop it: the ball
    //   shoots it, and it flies at GL_AMMO_SPEED, turning onto whatever of
    //   his is nearest the way it went -- a head on a neck, the big head, or
    //   the body once it is open -- and hurts what it meets. So a head torn
    //   loose is a threat and a shot at once.
    //
    //   The stone. While he has a head on a neck the body is stone, and a
    //   ball off it is turned GL_STONE_STEER of the way toward the nearest
    //   head, so the biggest thing up there sends you somewhere useful
    //   instead of nowhere.
    //
    // A head counts a hit only from a ball coming into it, and then not again
    // for GL_HEAD_IF: a head moves, and one that moves over the ball would
    // otherwise be hurt every frame the two overlap.
    //
    // With no head left on a neck the body opens, and it is a race: the big
    // head starts growing out of the collar at once, over GL_REGROW, and the
    // body is open only until it is whole. Open, he sags GL_SAG into the
    // field and thrashes -- rocks GL_THRASH either side of GL_TILT, his
    // collar swinging wider -- and the stump of his neck spits a burst of its
    // own. Empty the body in time and the big head hurries to finish. Once it
    // is whole the stone is back; tear it loose and the body opens again with
    // whatever it had left.
    //
    // The big head is GL_BIG times the size. It fires three ways at once,
    // down its neck and out to both sides -- the way through is the diagonals
    // under it -- and its bite STUNS as well (GL_BIG_STUN), the one thing in
    // the fight that does, so it stays a surprise. Loose, it is the chase the
    // fight ends on: GL_BIG_LOOSE_HP hits, faster than a small one, knocked
    // across the field by every one of them, and it bounces off you rather
    // than bursting. He dies when the body is empty and the big head is gone,
    // in whichever order.
    //
    // The one bar, along the top, is all of it: the small heads, loose hits
    // and all, the body, and the big head, which is counted from the start.
    // It only ever goes down.
    //
    // Every head still on its neck fires now and then: it swells green for
    // GL_CHARGE, then looses a few phantoms down the line of its neck, in
    // three columns GL_BURST_ARC apart and staggered like brickwork
    // (GL_BURST). The columns are further apart by the time they reach you
    // than you are long, so there is always room to stand between two. Only
    // one head bursts or lunges at a time, so one never fills the gaps in
    // another. Each phantom that lands is a helping of SLUGGISH.
    //
    // He is HEADLESS's body, cut at the same collar, and all three necks come
    // out of the one hole where his head was. That puts the fight in the top
    // middle of the screen, so the body is stood on its end by GL_TILT, legs
    // in the air, with the collar at the bottom and most of him off the top
    // of the screen, leant off upright so a slant of him stays on the field.
    //
    // He arrives slowly: one head pokes down out of the top first, then the
    // three fan apart as the whole of him lowers in, all three shouting.
    let GL_LVL      = 5;
    let GL_HEADS    = 3;      // how many he has
    let GL_HEAD_HP  = 6;      // hits to tear one loose
    let GL_LOOSE_HP = 1;      // ...and to finish it once it is off
    let GL_LOOSE_SIZE = 0.67; // ...how big it is, loose, of one on a neck
    let GL_LOOSE_SPIN = 1.2;  // ...and rad/s it turns at
    let GL_W        = 560;    // how long his body is
    let GL_Y        = 140;    // where the collar hangs
    let GL_TILT     = 1.0472; // rad his body is turned by, about the collar: legs up, leant 30 degrees off upright
    let GL_DRIFT    = 90;     // px either side the collar drifts
    let GL_HEAD_W   = 78;     // how wide a head is
    let GL_NECK     = 145;    // px from the collar out to a head
    let GL_FAN      = 0.9;    // rad between one neck and the next
    // under half GL_FAN, so two necks can never swing into the same place
    let GL_SWING    = 0.25;   // rad either side the necks sway through
    let GL_RATE     = 0.7;    // rad/s of that sway
    let GL_LOOSE    = 140;    // px/s a loose head flies at
    let GL_THICK    = 0.17;   // how thick his body is to a head, as a share of it
    // The hole his head left is where its middle was, not where his neck
    // meets his shoulders. So he is slid along his length by GL_SEAT_U and
    // across by GL_SEAT_V until the stump of his neck sits on the collar,
    // which is where the necks come out, whatever GL_TILT leans him to.
    let GL_SEAT_U   = 27;     // px toward the necks
    let GL_SEAT_V   = -17;    // px across him
    let GL_CLIMB    = 0.15;   // how much of the original's climb this fight has
    let GL_BODY_HP  = 8;      // hits on his body, once it has no head on a neck
    let GL_REGROW   = 8;      // seconds the big head takes to grow, which is how long the body is open for
    let GL_SAG      = 100;    // px he sags into the field while he is open
    let GL_STUMP_MIN = 4;     // seconds between the stump's bursts while he is open, at least...
    let GL_STUMP_MAX = 6;     // ...and at most
    let GL_HEAD_IF  = 0.25;   // seconds after a head is hit before it can be hit again
    let GL_ENTER    = 6;      // seconds he takes to arrive
    let GL_FIRE_MIN = 9;      // seconds between one head's bursts, at least...
    let GL_FIRE_MAX = 14;     // ...and at most
    let GL_CHARGE   = 0.7;    // the green swell before it fires, which is the tell
    let GL_BURST_GAP  = 1.3;  // seconds from one row of a burst to the next
    let GL_BURST_ARC  = 0.62; // rad between one column and the next
    let GL_BURST_SPEED = 170; // px/s the phantoms of a burst travel at
    let GL_BURST_SIZE = 0.25; // ...and how big they are, of a real head
    let GL_BURST_MAX  = 30;   // phantoms in the air at most, all heads together
    let GL_STONE_A0   = 0.35; // the stone over a shut body: at its thinnest...
    let GL_STONE_A1   = 0.7;  // ...at its thickest...
    let GL_STONE_HZ   = 0.5;  // ...and swells a second, slow enough never to read as a flash
    let GL_STONE_STEER = 0.6; // share of the way a ball off the stone is turned toward the nearest head
    let GL_BIG      = 2;      // the big head's size, of a small one
    let GL_BIG_HP   = 2;      // ...its hits to tear loose, of a small one's
    let GL_BIG_CHARGE = 1.4;  // seconds of shaking and swelling before it fires, which is its tell
    let GL_BIG_SHAKE = 5;     // ...px it shakes, at the height of that
    let GL_BIG_ARC  = 0.6;    // rad between its columns, down each way
    let GL_BIG_NECK = 0.6;    // its neck, of a small one's
    let GL_BIG_BOB  = 6;      // px it bobs while it waits...
    let GL_BIG_ROLL = 0.07;   // ...rad it rolls...
    let GL_BIG_HZ   = 0.35;   // ...and how many times a second
    let GL_BIG_STUN = 1.0;    // seconds its bite holds you STUNNED, before the SLUGGISH
    let GL_BIG_LOOSE_HP = 8;  // hits to finish it once it is loose
    let GL_BIG_LOOSE = 260;   // ...and px/s it flies at, and is knocked away at
    let GL_BIG_KNOCK_IF = 0.9; // ...and seconds it tumbles after a knock before it can be hit again
    let GL_LUNGE_FIRST = 6;   // seconds into the fight before the first lunge
    let GL_LUNGE_MIN   = 8;   // seconds between one lunge and the next, at least...
    let GL_LUNGE_MAX   = 12;  // ...and at most
    let GL_LUNGE_REAR  = 0.6; // seconds it draws back and shakes, its eye on you -- the tell
    let GL_LUNGE_BITE  = 0.22; // seconds from there down to your line
    let GL_LUNGE_DAZE  = 1.6; // seconds it hangs low and dazed after
    let GL_LUNGE_LOW   = 140; // ...px over your line it hangs at
    let GL_LUNGE_BACK  = 0.7; // seconds it takes to get back up its neck
    let GL_LUNGE_DMG   = 2;   // what a hit on a dazed head is worth
    let GL_LUNGE_IF    = 0.3; // ...and how long before the next one can land
    let GL_AMMO_SPEED  = 520; // px/s a finished loose head is shot at
    let GL_AMMO_CONE   = 0.9; // rad either side of its way it looks for something of his
    let GL_AMMO_TURN   = 4;   // rad/s it turns onto that
    let GL_AMMO_DMG    = 1;   // what it does to a head
    let GL_AMMO_BODY   = 2;   // ...and to the open body
    let GL_THRASH      = 0.22; // rad either side of GL_TILT the open body rocks
    let GL_THRASH_HZ   = 0.6; // ...times a second
    let GL_THRASH_DRIFT = 1.4; // ...his drift, times GL_DRIFT
    let GL_THRASH_PACE = 2.5; // ...and times as fast
    // Looks being tried out in the boss lab, each on its own switch, all off
    // here, so the game draws him as he has been until one is picked.
    let GL_LOOK_GLOW   = 0;      // fire light round his collar and under each head
    let GL_LOOK_WINGS  = 0;      // wings behind him, their bones Brandons, their skin crimson
    let GL_LOOK_HORNS  = 0;      // bone horns on every head and spines down every neck
    let GL_LOOK_HYDRA  = 0;      // each head its own element: fire, ice, storm; the big one crimson
    let GL_LOOK_BREATH = 0;      // fire at the mouth as a head swells, and a jet as it fires
    let GL_LOOK_SKY    = 0;      // the top of the field burning, ash drifting up through it
    let GL_WING_HZ     = 0.35;   // wingbeats a second
    LAB_KNOBS.push('GL_LOOK_GLOW', 'GL_LOOK_WINGS', 'GL_LOOK_HORNS', 'GL_LOOK_HYDRA', 'GL_LOOK_BREATH', 'GL_LOOK_SKY', 'GL_WING_HZ');
    LAB_KNOBS.push('GL_LVL', 'GL_HEADS', 'GL_HEAD_HP', 'GL_LOOSE_HP', 'GL_W', 'GL_Y', 'GL_TILT',
                   'GL_DRIFT', 'GL_HEAD_W', 'GL_NECK', 'GL_FAN', 'GL_SWING', 'GL_RATE',
                   'GL_LOOSE', 'GL_THICK', 'GL_SEAT_U', 'GL_SEAT_V', 'GL_CLIMB', 'GL_FIRE_MIN', 'GL_FIRE_MAX', 'GL_CHARGE',
                   'GL_BURST_GAP', 'GL_BURST_ARC', 'GL_BURST_SPEED', 'GL_BURST_SIZE', 'GL_BURST_MAX', 'GL_LOOSE_SIZE',
                   'GL_LOOSE_SPIN', 'GL_STONE_A0', 'GL_STONE_A1', 'GL_STONE_HZ', 'GL_STONE_STEER',
                   'GL_BIG', 'GL_BIG_HP', 'GL_BIG_CHARGE', 'GL_BIG_SHAKE',
                   'GL_BIG_ARC', 'GL_BIG_NECK', 'GL_BIG_BOB', 'GL_BIG_ROLL', 'GL_BIG_HZ', 'GL_BIG_STUN',
                   'GL_BIG_LOOSE_HP', 'GL_BIG_LOOSE', 'GL_BIG_KNOCK_IF', 'GL_SAG', 'GL_STUMP_MIN', 'GL_STUMP_MAX', 'GL_HEAD_IF',
                   'GL_LUNGE_FIRST', 'GL_LUNGE_MIN', 'GL_LUNGE_MAX', 'GL_LUNGE_REAR', 'GL_LUNGE_BITE', 'GL_LUNGE_DAZE',
                   'GL_LUNGE_LOW', 'GL_LUNGE_BACK', 'GL_LUNGE_DMG', 'GL_LUNGE_IF',
                   'GL_AMMO_SPEED', 'GL_AMMO_CONE', 'GL_AMMO_TURN', 'GL_AMMO_DMG', 'GL_AMMO_BODY',
                   'GL_THRASH', 'GL_THRASH_HZ', 'GL_THRASH_DRIFT', 'GL_THRASH_PACE',
                   'GL_BODY_HP', 'GL_REGROW', 'GL_ENTER');

    const GL_BEADS = 9;       // the neck, in heads shrinking into his body, from the collar out -- at least
    // a burst: [column, row] for each phantom, the column -1 left to 1 right
    // and the row in GL_BURST_GAPs -- the middle column half a row behind the
    // outer two, so the three are staggered and there is always a lane
    const GL_BURST = [[-1, 0], [1, 0], [0, 0.5], [0, 1.5]];
    // ...and the big head's, down each of its three ways: half as many again,
    // staggered the same way
    const GL_BIG_BURST = [[-1, 0], [1, 0], [0, 0.5], [-1, 1.5], [1, 1.5], [0, 2]];
    const GL_AMMO_LIFE = 2;   // seconds a shot head flies before it is spent, whatever it meets
    // a head's size, of GL_HEAD_W
    const glSize = k => k.big ? GL_BIG : 1;
    // the big head's hits to tear loose
    const glBigHp = () => Math.max(1, Math.round(GL_HEAD_HP * GL_BIG_HP));
    // what a head still has in it, loose hits and all
    const glLeft = k => k.loose ? k.hp : k.hp + (k.big ? GL_BIG_LOOSE_HP : GL_LOOSE_HP);

    let gl = null;

    // a head as it hangs on its neck, whole
    function glHead(fan, big) {
        return { hp: big ? glBigHp() : GL_HEAD_HP, alive: true, loose: false, flash: 0, iF: 0,
                 // where in the fan this neck sits, middle one at 0
                 fan, ph: fan * 2.1, x: LW / 2, y: 0, vx: 0, vy: 0, bx: LW / 2, by: 0,
                 fire: GL_FIRE_MIN * 0.5, charge: 0, shots: 0, shotT: 0,
                 grow: -1,              // seconds into growing, or -1 when whole
                 rot: 0,                // turned by, once it is loose
                 big, jx: 0, roll: 0,   // the big one, and its shake
                 wind: 0, lg: null,     // how far the big one is drawn back, and a lunge
                 shot: null, cd: 0 };   // shot off the ball, and the big one's pause between knocks
    }

    LAB_BOSS.gleeok = {
        start(b) {
            const n = Math.max(1, Math.round(GL_HEADS));
            gl = { t: 0, ph: 0, cx: LW / 2, cy: -GL_W, pend: null, hitBall: null, torn: 0, done: 0, spread: 0, yelled: false,
                   stone: 1, tilt: GL_TILT, thrash: 0, sag: 0,
                   body: GL_BODY_HP, bodyFlash: 0, bodyIF: 0, bigUsed: false, pops: [], away: false,
                   lungeT: GL_LUNGE_FIRST, stump: { x: LW / 2, y: 0, fire: 1.5, charge: 0, shots: 0, shotT: 0 },
                   heads: Array.from({ length: n }, (_, i) => {
                       const k = glHead(i - (n - 1) / 2, false);
                       // staggered, so the first bursts come one head at a time
                       k.fire = GL_FIRE_MIN * (0.6 + i * 0.55) + Math.random() * 2;
                       return k;
                   }) };
            b.maxHp = n * (GL_HEAD_HP + GL_LOOSE_HP) + GL_BODY_HP + glBigHp() + GL_BIG_LOOSE_HP;
            b.hp = b.maxHp;
            glBox(b);
        },
        reset() { gl = null; },
        update(b, dt) {
            if (phase === 'entrance') { glEnter(); gl.tilt = GL_TILT; }
            else {
                if (phase === 'play') gl.t += dt;
                // Open, he sags and thrashes: rocks about the collar and swings
                // wider and quicker. With the big head gone as well he is spent
                // and only sags, so the last of the body is not a long wait.
                const open = glOpen(), spent = gl.bigUsed && !gl.heads.some(k => k.alive && k.big);
                gl.sag += Math.max(-dt * 1.5, Math.min(dt * 1.5, (open ? 1 : 0) - gl.sag));
                gl.thrash += Math.max(-dt * 1.5, Math.min(dt * 1.5, (open && !spent ? 1 : 0) - gl.thrash));
                if (phase === 'play') gl.ph += dt * 0.25 * (1 + (GL_THRASH_PACE - 1) * gl.thrash);
                gl.cx = LW / 2 + Math.sin(gl.ph) * GL_DRIFT * (1 + (GL_THRASH_DRIFT - 1) * gl.thrash);
                gl.cy = GL_Y + GL_SAG * gl.sag;
                gl.spread = 1;
                gl.tilt = GL_TILT + Math.sin(gl.t * GL_THRASH_HZ * Math.PI * 2) * GL_THRASH * gl.thrash;
            }
            if (gl.bodyFlash > 0) gl.bodyFlash = Math.max(0, gl.bodyFlash - dt * 6);
            if (gl.bodyIF > 0) gl.bodyIF = Math.max(0, gl.bodyIF - dt);
            if (phase === 'play') {
                // the body open for the first time starts the race
                if (!gl.bigUsed && glOpen()) glGrowBig();
                glGrow(dt);
                glLungeClock(dt);
                // the stump spits while he is open
                gl.stump.x = gl.cx; gl.stump.y = gl.cy;
                if (glOpen()) glFire(gl.stump, Math.PI / 2, dt, GL_STUMP_MIN, GL_STUMP_MAX);
                else { gl.stump.charge = 0; gl.stump.fire = Math.max(gl.stump.fire, 1.5); }
            }
            // the stone coat: on while he is shut, off while he is open
            gl.stone += Math.max(-dt * 2, Math.min(dt * 2, (glOpen() ? 0 : 1) - gl.stone));
            for (const k of gl.heads) {
                if (!k.alive) continue;
                if (k.flash > 0) k.flash = Math.max(0, k.flash - dt * 6);
                if (k.iF > 0) k.iF = Math.max(0, k.iF - dt);
                if (!k.loose) {
                    // every neck out of the one collar, fanned and swaying
                    const a = Math.PI / 2 + (k.fan * GL_FAN + Math.sin(gl.t * GL_RATE + k.ph) * GL_SWING) * gl.spread;
                    // the big one winds up: drawn back up its neck as it swells, then
                    // eased out again, never snapped, or it would jump onto the ball
                    const want = k.big && k.charge > 0 ? Math.min(1, k.charge / GL_BIG_CHARGE) : 0;
                    k.wind = want > k.wind ? want : Math.max(want, k.wind - dt * 3);
                    const wind = k.wind;
                    const reach = GL_NECK * (k.big ? GL_BIG_NECK : 1) * glGrown(k) * (1 - 0.18 * wind * wind);
                    k.jx = k.charge > 0 ? Math.sin(clock * 52) * GL_BIG_SHAKE * wind : 0;
                    // the big one idles while it waits: a slow bob and roll, stilled by the wind-up
                    const idle = k.big && !k.lg ? (1 - wind) * glGrown(k) : 0, ph = clock * GL_BIG_HZ * Math.PI * 2;
                    k.ax = gl.cx; k.ay = gl.cy;
                    k.bx = gl.cx + Math.cos(a) * reach + k.jx;
                    k.by = gl.cy + Math.sin(a) * reach + idle * Math.sin(ph * 0.5 + 1) * GL_BIG_BOB;
                    if (phase !== 'play') k.lg = null;
                    if (k.lg) glLunge(k, dt);
                    else {
                        k.x = k.bx; k.y = k.by;
                        k.roll = idle * Math.sin(ph) * GL_BIG_ROLL;
                    }
                    if (phase === 'play' && k.grow < 0 && !k.lg) {
                        if (k.big) glFireBig(k, a, dt);
                        else glFire(k, a, dt, GL_FIRE_MIN, GL_FIRE_MAX);
                    } else if (!k.lg) { k.charge = 0; k.shots = 0; }
                    continue;
                }
                if (phase !== 'play') continue;
                if (k.shot) { glShot(k, dt); continue; }
                // loose: it flies on, turning, off the walls and the ceiling, and off you
                k.rot += GL_LOOSE_SPIN * dt;
                if (k.cd > 0) k.cd = Math.max(0, k.cd - dt);
                const r = GL_HEAD_W * glSize(k) * GL_LOOSE_SIZE / 2, ry = r * (BALL_RY / BALL_RX);
                k.x += k.vx * dt;
                k.y += k.vy * dt;
                if (k.x < r && k.vx < 0) k.vx = -k.vx;
                if (k.x > LW - r && k.vx > 0) k.vx = -k.vx;
                if (k.y < ry && k.vy < 0) k.vy = -k.vy;
                if (k.y > padY() - padH() / 2 - ry && k.vy > 0) {
                    const sg = segs().find(s => Math.abs(k.x - s.cx) < s.w / 2 + r);
                    // a small one is spent on you; the big one is the kill, so it
                    // only knocks you and goes on
                    if (sg && !k.big) { addDrag(sg, k.x); glPop(k); continue; }
                    if (sg && !k.cd) { addDrag(sg, k.x); k.cd = 1; }
                    k.vy = -Math.abs(k.vy);
                }
            }
            glBox(b);
        },
        contact(br, ball) {
            for (const k of gl.heads) {
                // nothing to hit until it is whole, and a shot one is the ball's already
                if (!k.alive || k.grow >= 0 || k.shot) continue;
                if (glEject(ball, k)) { gl.pend = null; return null; }
                const hit = glHeadContact(ball, k);
                if (hit) { gl.pend = k; return hit; }
            }
            // his body as one turned capsule: a mask is a grid of upright cells
            // and his body is not upright any more
            const a = glSpine(0), z = glSpine(1);
            const hit = capsuleContact(ball, a.x, a.y, z.x, z.y, GL_W / SHAPE_ASPECT * GL_THICK);
            gl.pend = hit ? 'body' : null;
            return hit;
        },
        // Off the stone, the bounce is his: turned toward the nearest head on
        // a neck, as far as it can be without going back into him. Anything
        // else goes on to the engine, which needs to know which ball it was.
        touch(br, ball, hit) {
            gl.hitBall = ball;
            const k = gl.pend;
            gl.away = !!k && k !== 'body' && (k.x - ball.x) * (ball.vx - k.vx) + (k.y - ball.y) * (ball.vy - k.vy) <= 0;
            if (k !== 'body' || glOpen()) return false;
            gl.pend = null;
            const n = labBounce(ball, hit);
            rings.push({ x: hit.cx, y: hit.cy, t: 1 });
            let best = null, bd = Infinity;
            for (const k of gl.heads) {
                if (!k.alive || k.loose || k.grow >= 0) continue;
                const d = Math.hypot(k.x - ball.x, k.y - ball.y);
                if (d < bd) { bd = d; best = k; }
            }
            if (best) labSteer(ball, n, best.x, best.y, GL_STONE_STEER);
            return true;
        },
        // his body cannot be hurt while a head is on it, and it says so; nor can
        // a head the ball is on its way out of, or one just hit
        glances() {
            if (!gl.pend) return true;
            if (gl.pend === 'body') return !glOpen() || gl.bodyIF > 0;
            return gl.away || gl.pend.iF > 0;
        },
        hit(b, cx, cy) {
            const k = gl.pend, ball = gl.hitBall, away = gl.away;
            gl.pend = null; gl.hitBall = null; gl.away = false;
            if (!k) return;
            if (k === 'body') {
                if (!glOpen() || gl.bodyIF > 0) return;
                glBodyWound(1, cx, cy);
                return;
            }
            if (k.iF > 0 || away) return;
            const dazed = k.lg && k.lg.st === 'daze';
            k.iF = dazed ? GL_LUNGE_IF : GL_HEAD_IF;
            if (k.loose && !k.big) {
                // a small loose head's last hit shoots it at him
                k.flash = 1;
                if (--k.hp > 0) { award(BOSS_PTS, cx, cy); return; }
                award(BOSS_PTS * 3, cx, cy);
                glLaunch(k, ball);
                return;
            }
            // The big one loose is knocked away by every hit, half toward the
            // middle of the field, and tumbles a moment -- or the ball pins it
            // to the ceiling and takes every hit it has in a second.
            if (k.loose && ball) {
                let dx = k.x - ball.x, dy = k.y - ball.y, d = Math.hypot(dx, dy) || 1;
                const mx = LW / 2 - k.x, my = LH * 0.4 - k.y, m = Math.hypot(mx, my) || 1;
                dx = dx / d + mx / m; dy = dy / d + my / m; d = Math.hypot(dx, dy) || 1;
                k.vx = dx / d * GL_BIG_LOOSE;
                k.vy = dy / d * GL_BIG_LOOSE;
                k.iF = GL_BIG_KNOCK_IF;
            }
            glWound(k, dazed ? GL_LUNGE_DMG : 1, cx, cy);
        },
        enterSecs() { return GL_ENTER; },
        draw: glDraw,
        drawFall() {
            const c = bossFall;
            if (!c) return;
            const tilt = gl ? gl.tilt : GL_TILT;
            const wilt = Math.max(0, Math.min(1, ascendT / A_DIE));
            const e = wilt * wilt * (3 - 2 * wilt);
            if (ascendT < A_DIE) drawFigure(c.x, c.y, c.w, 1, e, tilt);
            else drawCrumble(c, 0, tilt, true);
        },
        climb() { return GL_CLIMB; },
        finish(b) {
            // every small head gone, the body empty, and the big head loose
            // with one hit left in it
            glStrip();
            const k = glGrowBig();
            k.grow = -1;
            Object.assign(k, { loose: true, hp: 1, y: GL_Y + GL_NECK, vx: GL_LOOSE, vy: GL_LOOSE * 0.6 });
            glBox(b);
            return true;
        },
        // the lab's jumps
        acts: {
            // no head on a neck: the body open and thrashing
            body(b) { LAB_BOSS.gleeok.start(b); glStrip(); gl.body = GL_BODY_HP; glBox(b); return true; },
            // the body emptied and the big head all but grown
            big(b) { LAB_BOSS.gleeok.start(b); glStrip(); glGrowBig().grow = GL_REGROW - 0.5; glBox(b); return true; },
            // the head nearest you goes for you now
            lunge() {
                const pad = segs()[0].cx;
                const k = gl.heads.filter(k => k.alive && !k.loose && k.grow < 0 && !k.lg)
                                  .sort((p, q) => Math.abs(p.bx - pad) - Math.abs(q.bx - pad))[0];
                if (!k || phase !== 'play') return false;
                k.charge = 0; k.shots = 0;
                glLungeStart(k);
                return true;
            }
        },
        state(b) {
            const on = gl.heads.filter(k => k.alive && !k.loose && k.grow < 0).length;
            const loose = gl.heads.filter(k => k.alive && k.loose).length;
            const big = gl.heads.find(k => k.alive && k.big);
            const lg = gl.heads.find(k => k.lg);
            return { name: 'GLEEOK', hp: b.hp, max: b.maxHp, w: GL_W,
                     line: on + ' on him · ' + loose + ' loose · ' +
                           (glOpen() ? 'body open ' + gl.body + '/' + GL_BODY_HP : 'body shut') +
                           (big ? ' · big head ' + (big.grow >= 0 ? 'growing' : big.loose ? 'loose' : big.hp + '/' + glBigHp()) : '') +
                           (lg ? ' · lunge: ' + lg.lg.st : '') };
        }
    };

    // an angle folded into -pi..pi
    function glAngle(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

    // a point in his own frame -- x along him toward his head, y across,
    // both from the collar -- out in the field, where he is turned
    function glLocal(lx, ly) {
        const c = Math.cos(gl.tilt), s = Math.sin(gl.tilt);
        return { x: gl.cx + lx * c - ly * s, y: gl.cy + lx * s + ly * c };
    }

    // the top left of the box his body is drawn in, in his own frame
    function glOrigin() {
        const h = GL_W / SHAPE_ASPECT;
        return { x: GL_SEAT_U - GL_W * HL_HEAD_U, y: GL_SEAT_V - h * HL_HEAD_V };
    }

    // along the middle of his box, 0 at his shoulders to 1 at his boot
    function glSpine(t) {
        const o = glOrigin(), h = GL_W / SHAPE_ASPECT;
        const x0 = o.x + GL_W * (HL_HEAD_U - 0.1), x1 = o.x;
        return glLocal(x0 + (x1 - x0) * t, o.y + h / 2);
    }

    // how far (x, y) is from his body's outline, less than 0 inside it
    function glBodyGap(x, y) {
        const a = glSpine(0), z = glSpine(1);
        const vx = z.x - a.x, vy = z.y - a.y, l2 = vx * vx + vy * vy || 1;
        const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / l2));
        return Math.hypot(x - a.x - vx * t, y - a.y - vy * t) - GL_W / SHAPE_ASPECT * GL_THICK;
    }

    // the middle of the box his body is drawn in, which is where drawFigure
    // and the crumble turn him about
    function glMiddle() {
        const o = glOrigin(), h = GL_W / SHAPE_ASPECT;
        return glLocal(o.x + GL_W / 2, o.y + h / 2);
    }

    // Nothing on a neck that can be hit, and something left in the body: it
    // is open.
    function glOpen() { return gl.body > 0 && !gl.heads.some(k => k.alive && !k.loose && k.grow < 0); }

    // A head: the ellipse inscribed in it, turned by however far it has spun
    // loose. Met in its own frame and handed back in the field's.
    function glHeadContact(ball, k) {
        const rx = GL_HEAD_W * glSize(k) * (k.loose ? GL_LOOSE_SIZE : 1) / 2, ry = rx * (BALL_RY / BALL_RX);
        if (!k.loose) return ellipseContact(ball, k.x, k.y, rx, ry);
        const c = Math.cos(-k.rot), s = Math.sin(-k.rot);
        const dx = ball.x - k.x, dy = ball.y - k.y;
        const local = { x: k.x + dx * c - dy * s, y: k.y + dx * s + dy * c, angle: ball.angle - k.rot };
        const hit = ellipseContact(local, k.x, k.y, rx, ry);
        if (!hit) return null;
        const hx = hit.cx - k.x, hy = hit.cy - k.y;
        return { cx: k.x + hx * c + hy * s, cy: k.y - hx * s + hy * c };
    }

    // A head whose middle has got inside a head -- grown round it, lunged
    // over it, or thrown out over it by the big one's wind-up -- is put back
    // outside, heading away. Left in, its outline pushed it further in every
    // frame and it never came out. True if it moved one.
    const GL_INSIDE = 0.9;           // how deep, as a share of a head's outline, counts as inside
    function glEject(ball, k) {
        const rx = GL_HEAD_W * glSize(k) * (k.loose ? GL_LOOSE_SIZE : 1) / 2, ry = rx * (BALL_RY / BALL_RX);
        let dx = ball.x - k.x, dy = ball.y - k.y;
        if (Math.hypot(dx / rx, dy / ry) >= GL_INSIDE) return false;
        if (Math.hypot(dx, dy) < 1e-3) { dx = 0; dy = 1; }
        const q = Math.hypot(dx / rx, dy / ry), ux = dx / q, uy = dy / q;      // the outline, that way
        const l = Math.hypot(dx, dy), nx = dx / l, ny = dy / l;
        ball.x = Math.max(extX(ball), Math.min(LW - extX(ball), k.x + ux + nx * (extX(ball) + 4)));
        ball.y = k.y + uy + ny * (extY(ball) + 4);
        const sp = effSpeed() * (ball.boost || 1);
        ball.vx = nx * sp;
        ball.vy = ny * sp;
        labUnflat(ball, sp);
        return true;
    }

    // A head hurt, by the ball or by a head shot into it. On a neck, its last
    // hit tears it loose; loose, the big one's last is the end of him.
    function glWound(k, n, cx, cy) {
        k.flash = 1;
        k.hp = Math.max(0, k.hp - n);
        if (k.hp > 0) { award(BOSS_PTS * n, cx, cy); return; }
        if (!k.loose) {
            // torn loose: still alive, and now it has the run of the field
            k.loose = true;
            k.hp = k.big ? GL_BIG_LOOSE_HP : GL_LOOSE_HP;
            k.charge = 0; k.shots = 0; k.jx = 0; k.lg = null; k.roll = 0; k.iF = 0;
            gl.torn++;
            const a = Math.PI * (0.15 + Math.random() * 0.7);
            const sp = k.big ? GL_BIG_LOOSE : GL_LOOSE;
            k.vx = Math.cos(a) * sp * (Math.random() < 0.5 ? -1 : 1);
            k.vy = Math.sin(a) * sp;
            award(BOSS_PTS * 2, cx, cy);
            maybeDropCapsule(cx, cy);
            return;
        }
        award(BOSS_PTS * (k.big ? 5 : 3), cx, cy);
        glPop(k);
        glDoneYet();
    }

    // the body empty and the big head gone, in either order, is the end of him
    function glDoneYet() {
        if (gl.body <= 0 && gl.bigUsed && !gl.heads.some(k => k.alive && k.big)) glDie(bricks[0]);
    }

    // The open body hurt. Emptied while the big head is still growing, it
    // hurries, so winning the race is not rewarded with a wait.
    function glBodyWound(n, cx, cy) {
        gl.body = Math.max(0, gl.body - n);
        gl.bodyFlash = 1;
        gl.bodyIF = BOSS_IF;
        award(BOSS_PTS * (gl.body <= 0 ? 3 : n), cx, cy);
        if (gl.body > 0) return;
        for (const k of gl.heads) if (k.alive && k.grow >= 0) k.grow = Math.max(k.grow, GL_REGROW - 1);
        glDoneYet();
    }

    // every small head gone and the body empty: where the lab's jumps and
    // finish start from
    function glStrip() {
        for (const k of gl.heads) { k.alive = false; k.lg = null; }
        gl.body = 0;
        phantoms = [];
    }

    // A loose head gone, shot or burst on you: it swells and fades where it was.
    const GL_POP_SECS = 0.28;
    function glPop(k) {
        k.alive = false;
        k.shot = null;
        gl.done++;
        const w = GL_HEAD_W * glSize(k) * GL_LOOSE_SIZE;
        gl.pops.push({ x: k.x, y: k.y, w, rot: k.rot, t0: clock });
    }

    // how far a head has grown, 1 when it is whole
    function glGrown(k) {
        if (k.grow < 0) return 1;
        const t = Math.min(1, k.grow / GL_REGROW);
        return t * t * (3 - 2 * t);
    }

    // The big head, out of the middle of the collar, once and for good.
    function glGrowBig() {
        gl.bigUsed = true;
        const k = glHead(0, true);
        k.grow = 0;
        k.x = k.bx = gl.cx; k.y = k.by = gl.cy;
        gl.heads.push(k);
        return k;
    }
    function glGrow(dt) {
        for (const k of gl.heads) {
            if (!k.alive || k.grow < 0 || (k.grow += dt) < GL_REGROW) continue;
            k.grow = -1;
            k.fire = GL_FIRE_MIN * 0.5;
            const hh = GL_HEAD_W * glSize(k) * (BALL_RY / BALL_RX);
            labShout(k.x, k.y, 'BRANDON!', 2.4, () => ({ x: k.x, y: k.y + hh / 2 + 10 }));
        }
    }

    // The last of him is gone: whatever is still loose goes with him.
    function glDie(b) {
        for (const k of gl.heads) { k.alive = false; k.lg = null; }
        b.alive = false;
        clearStage();
        // he comes apart about the middle of his box, turned as he stood
        const m = glMiddle();
        bossFall = shatter(m.x, m.y, GL_W, A_DIE_T);
        // the white cut-out levels itself as it burns off, and he is on
        // end, so it would swing through the air; his colour going says it
        if (impact) impact.w = 0;
    }

    // His arrival, off enterK: one head pokes down out of the top and holds
    // there, the three of them one on top of another; then they fan apart,
    // shouting, as the whole of him lowers in to where he fights.
    const GL_POKE = 0.15, GL_HOLD = 0.4;      // shares of the entrance
    function glEnter() {
        const k = enterK(), ease = t => t * t * (3 - 2 * t);
        const peek = 36 - GL_NECK, hidden = -GL_NECK - GL_HEAD_W;
        gl.cx = LW / 2;
        if (k < GL_POKE) {
            gl.cy = hidden + (peek - hidden) * ease(k / GL_POKE);
            gl.spread = 0;
        } else if (k < GL_HOLD) {
            gl.cy = peek + Math.sin((k - GL_POKE) * 40) * 3;     // looking about
            gl.spread = 0;
        } else {
            const t = (k - GL_HOLD) / (1 - GL_HOLD);
            gl.cy = peek + (GL_Y - peek) * ease(t);
            gl.spread = ease(Math.min(1, t * 3));
            // once they are far enough apart to be three, each shouts, its
            // bubble riding under it on the way down -- the middle one's a
            // little lower, so the three do not run into one another
            if (!gl.yelled && t > 0.25) {
                gl.yelled = true;
                const hh = GL_HEAD_W * (BALL_RY / BALL_RX);
                for (const h of gl.heads) {
                    const drop = h.fan === 0 ? hh * 0.7 : 0;
                    labShout(h.x, h.y, 'BRANDON!', 2.4, () => ({ x: h.x, y: h.y + hh / 2 + 10 + drop }));
                }
            }
        }
    }

    // another head on a neck swelling, firing or lunging: this one waits its turn
    function glBusy(k) {
        return gl.heads.some(o => o !== k && o.alive && !o.loose && (o.charge > 0 || o.shots > 0 || o.lg));
    }

    // the one of you nearest x -- two of you, on DOUBLE
    function glNearSeg(x) {
        return segs().reduce((p, s) => Math.abs(s.cx - x) < Math.abs(p.cx - x) ? s : p);
    }

    // The lunges' clock, one for all of them: when it runs out and nothing
    // else is swelling, firing or lunging, the head nearest you goes for you.
    function glLungeClock(dt) {
        if ((gl.lungeT -= dt) > 0) return;
        if (gl.heads.some(o => o.alive && !o.loose && (o.charge > 0 || o.shots > 0 || o.lg))) return;
        const pad = segs()[0].cx;
        const k = gl.heads.filter(o => o.alive && !o.loose && o.grow < 0)
                          .sort((p, q) => Math.abs(p.bx - pad) - Math.abs(q.bx - pad))[0];
        if (!k) return;
        glLungeStart(k);
        gl.lungeT = GL_LUNGE_MIN + Math.random() * (GL_LUNGE_MAX - GL_LUNGE_MIN);
    }
    function glLungeStart(k) {
        k.lg = { st: 'rear', t: 0, tx: k.bx, x0: k.bx, y0: k.by };
    }

    // A lunge, a stage at a time: it draws back up its neck and shakes, its
    // eye on you -- the mark on your line follows you until it goes -- then
    // snaps down to where you were, rises a little way, hangs there dazed,
    // and goes back up its neck.
    function glLunge(k, dt) {
        const L = k.lg, hw = GL_HEAD_W * glSize(k), hh = hw * (BALL_RY / BALL_RX);
        const floor = padY() - padH() / 2 - hh / 2, low = padY() - GL_LUNGE_LOW;
        L.t += dt;
        if (L.st === 'rear') {
            const e = Math.min(1, L.t / GL_LUNGE_REAR);
            L.tx = Math.max(hw / 2, Math.min(LW - hw / 2, glNearSeg(k.bx).cx));
            k.x = k.ax + (k.bx - k.ax) * (1 - 0.25 * e) + Math.sin(clock * 52) * 4 * e;
            k.y = k.ay + (k.by - k.ay) * (1 - 0.25 * e);
            if (L.t >= GL_LUNGE_REAR) { L.st = 'bite'; L.t = 0; L.x0 = k.x; L.y0 = k.y; }
            return;
        }
        if (L.st === 'bite') {
            const e = Math.min(1, L.t / GL_LUNGE_BITE), q = e * e;
            k.x = L.x0 + (L.tx - L.x0) * q;
            k.y = L.y0 + (floor - L.y0) * q;
            if (e >= 1) { glBite(k, L.tx); L.st = 'daze'; L.t = 0; }
            return;
        }
        if (L.st === 'daze') {
            const e = Math.min(1, L.t / 0.25), s = e * e * (3 - 2 * e);
            k.x = L.tx;
            k.y = floor + (low - floor) * s;
            k.roll = Math.sin(clock * Math.PI * 3) * 0.25;
            if (L.t >= GL_LUNGE_DAZE) { L.st = 'back'; L.t = 0; }
            return;
        }
        const e = Math.min(1, L.t / GL_LUNGE_BACK), s = e * e * (3 - 2 * e);
        k.x = L.tx + (k.bx - L.tx) * s;
        k.y = low + (k.by - low) * s;
        k.roll *= 1 - s;
        if (e >= 1) { k.lg = null; k.roll = 0; k.fire = Math.max(k.fire, GL_FIRE_MIN * 0.5); }
    }

    // where it lands: you under it are SLUGGISH, and the big one STUNS you first
    function glBite(k, x) {
        const rx = GL_HEAD_W * glSize(k) / 2;
        rings.push({ x, y: padY() - padH() / 2, t: 1 });
        const sg = segs().find(s => Math.abs(x - s.cx) < s.w / 2 + rx * 0.7);
        if (!sg) return;
        // the boss lab runs brandon.html's engine, which has no stun unless the build lends it one
        if (k.big && typeof stunPad === 'function') stunPad(GL_BIG_STUN);
        addDrag(sg, x);
    }

    // What a shot head can meet: the heads still up, the big one loose or
    // not, and the body while it is open -- each as a point to turn toward.
    function glMarks(k) {
        const out = [];
        for (const o of gl.heads) {
            if (o === k || !o.alive || o.grow >= 0 || o.shot || (o.loose && !o.big)) continue;
            out.push({ ref: o, x: o.x, y: o.y });
        }
        if (glOpen()) { const p = glSpine(0.15); out.push({ ref: 'body', x: p.x, y: p.y }); }
        return out;
    }

    // A finished loose head, shot off the ball: away from where the ball
    // struck it, never downward, and onto whatever of his lies nearest that
    // way within GL_AMMO_CONE.
    function glLaunch(k, ball) {
        let dx = ball ? k.x - ball.x : 0, dy = ball ? k.y - ball.y : -1;
        const d = Math.hypot(dx, dy) || 1;
        dx /= d; dy /= d;
        if (dy > -0.3) { dy = -0.3; const q = Math.hypot(dx, dy); dx /= q; dy /= q; }
        const way = Math.atan2(dy, dx);
        let best = null, ba = GL_AMMO_CONE;
        for (const m of glMarks(k)) {
            const off = Math.abs(glAngle(Math.atan2(m.y - k.y, m.x - k.x) - way));
            if (off < ba) { ba = off; best = m.ref; }
        }
        k.hp = 0;
        k.shot = { tgt: best, t: 0 };
        k.vx = dx * GL_AMMO_SPEED;
        k.vy = dy * GL_AMMO_SPEED;
    }

    // A shot head in flight: it turns onto its mark, hurts the first thing of
    // his it meets, and is spent on that, a wall, stone, or time.
    function glShot(k, dt) {
        const S = k.shot;
        S.t += dt;
        k.rot += GL_LOOSE_SPIN * 6 * dt;
        const t = S.tgt === 'body' ? (glOpen() ? glSpine(0.15) : null)
                : S.tgt && S.tgt.alive && !S.tgt.shot ? S.tgt : null;
        if (t) {
            const now = Math.atan2(k.vy, k.vx);
            const turn = Math.max(-GL_AMMO_TURN * dt, Math.min(GL_AMMO_TURN * dt, glAngle(Math.atan2(t.y - k.y, t.x - k.x) - now)));
            k.vx = Math.cos(now + turn) * GL_AMMO_SPEED;
            k.vy = Math.sin(now + turn) * GL_AMMO_SPEED;
        }
        k.x += k.vx * dt;
        k.y += k.vy * dt;
        const r = GL_HEAD_W * GL_LOOSE_SIZE / 2;
        for (const m of glMarks(k)) {
            if (m.ref === 'body') continue;
            const o = m.ref, or = GL_HEAD_W * glSize(o) * (o.loose ? GL_LOOSE_SIZE : 1) / 2;
            if (Math.hypot(o.x - k.x, o.y - k.y) > r + or * 0.85) continue;
            glPop(k);
            glWound(o, GL_AMMO_DMG, o.x, o.y);
            return;
        }
        if (glBodyGap(k.x, k.y) < r) {
            if (glOpen()) glBodyWound(GL_AMMO_BODY, k.x, k.y);
            else rings.push({ x: k.x, y: k.y, t: 1 });
            glPop(k);
            return;
        }
        if (k.x < r || k.x > LW - r || k.y < r || k.y > padY() - 40 || S.t > GL_AMMO_LIFE) glPop(k);
    }

    // One head on its neck, or the stump: counting down (lo..hi seconds) to a
    // burst, swelling green, then firing it a volley at a time down line a.
    function glFire(k, a, dt, lo, hi) {
        if (k.shots > 0) {
            // what is due by now leaves, each down its own column
            k.shotT += dt;
            while (k.shots > 0) {
                const [col, row] = GL_BURST[GL_BURST.length - k.shots];
                if (k.shotT < row * GL_BURST_GAP) break;
                k.shots--;
                if (phantoms.length >= GL_BURST_MAX) continue;
                const d = a + col * GL_BURST_ARC;
                // the slowness is the whole of their life: they live long
                // enough to cross the field at it
                phantoms.push({ x: k.x, y: k.y, vx: Math.cos(d) * GL_BURST_SPEED, vy: Math.sin(d) * GL_BURST_SPEED,
                                angle: Math.random() * 6.28, spin: (Math.random() - 0.5) * 6, scale: GL_BURST_SIZE,
                                life: PH_LIFE * PH_SPEED / GL_BURST_SPEED });
            }
            if (!k.shots) k.fire = lo + Math.random() * (hi - lo);
            return;
        }
        if (k.charge > 0) {
            if ((k.charge += dt) < GL_CHARGE) return;
            k.charge = 0;
            k.shots = GL_BURST.length;
            k.shotT = 0;
            return;
        }
        if ((k.fire -= dt) <= 0 && !glBusy(k) && !(gl.lungeT <= 0)) k.charge = 1e-6;
    }

    // The big head: counting down, then shaking and drawing back as it swells
    // for GL_BIG_CHARGE, then GL_BIG_BURST down its neck and out to either
    // side of it at once, a row at a time.
    function glFireBig(k, a, dt) {
        if (k.shots > 0) {
            k.shotT += dt;
            while (k.shots > 0) {
                const [col, row] = GL_BIG_BURST[GL_BIG_BURST.length - k.shots];
                if (k.shotT < row * GL_BURST_GAP) break;
                k.shots--;
                for (const way of [0, -Math.PI / 2, Math.PI / 2]) {
                    if (phantoms.length >= GL_BURST_MAX) break;
                    const d = a + way + col * GL_BIG_ARC;
                    phantoms.push({ x: k.x, y: k.y, vx: Math.cos(d) * GL_BURST_SPEED, vy: Math.sin(d) * GL_BURST_SPEED,
                                    angle: Math.random() * 6.28, spin: (Math.random() - 0.5) * 6, scale: GL_BURST_SIZE,
                                    life: PH_LIFE * PH_SPEED / GL_BURST_SPEED });
                }
            }
            if (!k.shots) k.fire = GL_FIRE_MIN + Math.random() * (GL_FIRE_MAX - GL_FIRE_MIN);
            return;
        }
        if (k.charge > 0) {
            if ((k.charge += dt) < GL_BIG_CHARGE) return;
            k.charge = 0;
            k.shots = GL_BIG_BURST.length;
            k.shotT = 0;
            return;
        }
        if ((k.fire -= dt) <= 0) k.charge = 1e-6;
    }

    // his body cut, in stone: the shape filled flat, with a faint pass of his
    // own shading kept so it is still him under it
    let glStoneBake = null;
    function glStoneBody(body) {
        if (glStoneBake) return glStoneBake;
        const c = document.createElement('canvas');
        c.width = body.width; c.height = body.height;
        const g = c.getContext('2d');
        g.drawImage(body, 0, 0);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = STONE;
        g.fillRect(0, 0, c.width, c.height);
        g.globalCompositeOperation = 'source-atop';
        g.globalAlpha = 0.25;
        g.filter = 'grayscale(1) contrast(1.1) brightness(1.7)';
        g.drawImage(body, 0, 0);
        return (glStoneBake = c);
    }

    // the box the physics looks for him in: his body and wherever his heads are
    function glBox(b) {
        const h = GL_W / SHAPE_ASPECT, r = GL_HEAD_W;
        const a = glSpine(0), boot = glSpine(1);
        let x0 = Math.min(gl.cx, a.x, boot.x) - h / 2, x1 = Math.max(gl.cx, a.x, boot.x) + h / 2;
        let y0 = Math.min(gl.cy, a.y, boot.y) - h / 2, y1 = Math.max(gl.cy, a.y, boot.y) + h / 2;
        for (const k of gl.heads) {
            if (!k.alive) continue;
            x0 = Math.min(x0, k.x - r); x1 = Math.max(x1, k.x + r);
            y0 = Math.min(y0, k.y - r); y1 = Math.max(y1, k.y + r);
        }
        b.x = x0; b.y = y0; bw = x1 - x0; bh = y1 - y0;
        // everything left to hit, the big head from the start, so it only goes down
        b.hp = gl.heads.reduce((s, k) => s + (k.alive ? glLeft(k) : 0), 0) + gl.body +
               (gl.bigUsed ? 0 : glBigHp() + GL_BIG_LOOSE_HP);
    }

    // ---- looks being tried out (the GL_LOOK_ switches) ---------------------------
    const GL_FIRE = '#e2683a', GL_FIRE_RIM = '#ffb072', GL_FIRE_CORE = '#fff1d6';
    // each head's element, by where it sits in the fan: fire, ice, storm; the big one's crimson
    const glInk = k => k.big ? '#ff3a44' : GL_LOOK_HYDRA ? (['#ff6a2a', '#86d8ff', '#ffe36a'][Math.round(k.fan) + 1] || GL_FIRE) : GL_FIRE;

    // a soft round light, added over what is there
    function glLight(x, y, r, ink, a) {
        if (a <= 0.002 || !Number.isFinite(x + y + r)) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, ink);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = a;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Behind everything: the sky, the wings, the light at his collar.
    function glLookBack() {
        if (GL_LOOK_SKY) {
            ctx.save();
            const g = ctx.createLinearGradient(0, 0, 0, 330);
            g.addColorStop(0, 'rgba(150, 38, 18, 0.42)');
            g.addColorStop(1, 'rgba(150, 38, 18, 0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, LW, 330);
            // ash going up through it, the same forty flecks forever
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 40; i++) {
                const sx = (i * 197.3) % LW, sp = 18 + (i * 7) % 23;
                const y = 340 - ((clock * sp + i * 53) % 360), x = sx + Math.sin(clock * 0.7 + i) * 14;
                ctx.globalAlpha = 0.5 * Math.max(0, Math.min(1, y / 120));
                ctx.fillStyle = i % 3 ? GL_FIRE_RIM : GL_FIRE;
                ctx.fillRect(x, y, 2, 2);
            }
            ctx.restore();
        }
        if (GL_LOOK_WINGS) glLookWings();
        if (GL_LOOK_GLOW) glLight(gl.cx, gl.cy, 280, GL_FIRE, 0.28 + 0.06 * Math.sin(clock * 1.2));
    }

    // Two wings out of his shoulders, beating slowly: each bone a run of
    // Brandons shrinking to its tip, the way his necks are, and a crimson skin
    // between the bones, scalloped in toward his shoulder between the tips.
    // angle from level (down is positive) and length, lowest bone first: spread across the
    // top of the field, since anything pointing up is off the screen
    const GL_WING_BONES = [[0.42, 290], [0.12, 340], [-0.18, 330], [-0.48, 270]];
    function glLookWings() {
        const beat = Math.sin(clock * GL_WING_HZ * Math.PI * 2);
        for (const side of [-1, 1]) {
            const sx = gl.cx + side * 26, sy = gl.cy - 18;
            const tips = GL_WING_BONES.map(([a, len], i) => {
                const ang = a - beat * 0.14 * (1 + i * 0.25) - 0.05;
                return { x: sx + side * Math.cos(ang) * len, y: sy + Math.sin(ang) * len };
            });
            // the skin
            ctx.save();
            const g = ctx.createRadialGradient(sx, sy, 20, sx, sy, 340);
            g.addColorStop(0, 'rgba(170, 30, 40, 0.8)');
            g.addColorStop(1, 'rgba(110, 16, 28, 0.5)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(tips[0].x, tips[0].y);
            for (let i = 1; i < tips.length; i++) {
                const a = tips[i - 1], z = tips[i];
                const mx = (a.x + z.x) / 2, my = (a.y + z.y) / 2;
                ctx.quadraticCurveTo(mx + (sx - mx) * 0.35, my + (sy - my) * 0.35, z.x, z.y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 170, 120, 0.55)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
            // the bones
            for (const t of tips) {
                const n = 9;
                for (let i = n; i >= 1; i--) {
                    const k = i / n, w = GL_HEAD_W * (0.5 - 0.32 * k), h = w * (BALL_RY / BALL_RX);
                    ctx.drawImage(ballImg, sx + (t.x - sx) * k - w / 2, sy + (t.y - sy) * k - h / 2, w, h);
                }
            }
        }
    }

    // Spines down a neck: a bone point off its outside every other bead.
    function glLookSpines(k, beads, gs) {
        const dx = k.x - k.ax, dy = k.y - k.ay, l = Math.hypot(dx, dy) || 1;
        // the outside of the neck is away from the middle of the fan
        const side = (k.fan > 0 ? 1 : k.fan < 0 ? -1 : 1);
        const nx = -dy / l * side, ny = dx / l * side;
        ctx.save();
        ctx.fillStyle = '#e6dac0';
        ctx.strokeStyle = '#5b4d38';
        ctx.lineWidth = 1;
        for (let i = 1; i < beads; i += 2) {
            const t = i / beads, w = GL_HEAD_W * (0.45 + 0.35 * t) * gs;
            const bx = k.ax + dx * t, by = k.ay + dy * t, r = w * 0.4, len = w * 0.35;
            ctx.beginPath();
            ctx.moveTo(bx + nx * r - dx / l * len * 0.3, by + ny * r - dy / l * len * 0.3);
            ctx.lineTo(bx + nx * (r + len) - dx / l * len * 0.4, by + ny * (r + len) - dy / l * len * 0.4);
            ctx.lineTo(bx + nx * r + dx / l * len * 0.3, by + ny * r + dy / l * len * 0.3);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    }

    // Two horns off the top of a head, drawn in its own frame before the
    // head, so they grow out from behind it: swept back and out, and curling up.
    function glLookHorns(w, h) {
        ctx.save();
        ctx.fillStyle = '#e6dac0';
        ctx.strokeStyle = '#5b4d38';
        ctx.lineWidth = Math.max(1, w * 0.02);
        for (const s of [-1, 1]) {
            const bx = s * w * 0.22, by = -h * 0.3;
            ctx.beginPath();
            ctx.moveTo(bx - s * w * 0.09, by + h * 0.06);
            ctx.quadraticCurveTo(bx + s * w * 0.5, by - h * 0.05, bx + s * w * 0.55, by - h * 0.42);
            ctx.quadraticCurveTo(bx + s * w * 0.3, by - h * 0.12, bx + s * w * 0.08, by + h * 0.02);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    }

    // Under a head: its element's light round it, and fire at its mouth as
    // it swells and fires.
    function glLookUnder(k, hw, hh) {
        if (GL_LOOK_GLOW || GL_LOOK_HYDRA) glLight(k.x, k.y + hh * 0.25, hw * (k.loose ? 0.6 : 0.95), glInk(k), GL_LOOK_HYDRA ? 0.55 : 0.35);
        if (!GL_LOOK_BREATH || k.loose) return;
        const sw = k.charge > 0 ? Math.min(1, k.charge / (k.big ? GL_BIG_CHARGE : GL_CHARGE)) : 0;
        const firing = k.shots > 0;
        if (!sw && !firing) return;
        // along the neck, out of his mouth
        const dx = k.x - k.ax, dy = k.y - k.ay, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
        const mx = k.x + ux * hh * 0.42, my = k.y + uy * hh * 0.42;
        const len = firing ? hw * 1.4 : hw * 0.5 * sw, ink = glInk(k);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
            const t = (i + 1) / 3, fl = 1 + 0.12 * Math.sin(clock * 11 + i * 2);
            const cx = mx + ux * len * t * 0.6, cy = my + uy * len * t * 0.6, r = hw * (0.12 + 0.16 * t) * fl * (firing ? 1 : 0.6 + 0.4 * sw);
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            g.addColorStop(0, GL_FIRE_CORE);
            g.addColorStop(0.4, ink);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(cx, cy, r * 0.7, r * (1 + t), Math.atan2(uy, ux) - Math.PI / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    function glDraw(b) {
        const h = GL_W / SHAPE_ASPECT;
        // HEADLESS's own cut: the same body with the same hole where the head
        // was, which is where all three of these come out of
        const body = hlSprite('raw');
        if (!body || !ready(ballImg)) return;
        const hw = GL_HEAD_W, hh = hw * (BALL_RY / BALL_RX);
        glLookBack();
        // where a lunge means to land: a mark on your line that follows you
        // while it draws back, and stays put once it goes -- growing in once,
        // steady, never blinking. The big one's is STUNNED's colour.
        for (const k of gl.heads) {
            if (!k.alive || !k.lg || (k.lg.st !== 'rear' && k.lg.st !== 'bite')) continue;
            const e = k.lg.st === 'rear' ? Math.min(1, k.lg.t / GL_LUNGE_REAR) : 1;
            const mw = GL_HEAD_W * glSize(k) * (0.5 + 0.5 * e), my = padY() - padH() / 2;
            ctx.save();
            ctx.globalAlpha = 0.18 + 0.3 * e;
            ctx.fillStyle = k.big ? '#e0283c' : '#f2efe9';
            ctx.beginPath();
            ctx.ellipse(k.lg.tx, my, mw / 2, mw * 0.12, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        // the necks first: heads shrinking into him, so they read as one animal,
        // and more of them the further a lunge stretches it
        for (const k of gl.heads) {
            if (!k.alive || k.loose) continue;
            const gs = (0.25 + 0.75 * glGrown(k)) * (k.big ? 1 + (GL_BIG - 1) * 0.5 : 1);
            const beads = Math.max(GL_BEADS, Math.round(Math.hypot(k.x - k.ax, k.y - k.ay) / (hw * 0.3)));
            for (let i = 0; i < beads; i++) {
                const t = i / beads;
                const w = hw * (0.45 + 0.35 * t) * gs, hgt = w * (BALL_RY / BALL_RX);
                ctx.drawImage(ballImg, k.ax + (k.x - k.ax) * t - w / 2,
                              k.ay + (k.y - k.ay) * t - hgt / 2, w, hgt);
            }
            if (GL_LOOK_HORNS) glLookSpines(k, beads, gs);
        }
        // turned about the collar and seated on it, so his shoulders are
        // where his necks come out however he is turned
        const o = glOrigin();
        ctx.save();
        ctx.translate(gl.cx, gl.cy);
        ctx.rotate(gl.tilt);
        ctx.drawImage(body, o.x, o.y, GL_W, h);
        // shut, he is stone: a coat of it swelling slowly in and out over him
        const stone = gl.stone > 0.002 ? glStoneBody(body) : null;
        if (stone) {
            const breath = GL_STONE_A0 + (GL_STONE_A1 - GL_STONE_A0) * (0.5 + 0.5 * Math.sin(clock * GL_STONE_HZ * Math.PI * 2));
            ctx.globalAlpha = gl.stone * breath;
            ctx.drawImage(stone, o.x, o.y, GL_W, h);
            ctx.globalAlpha = 1;
        }
        // struck while open: the same body again, added over itself
        if (gl.bodyFlash > 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = Math.min(1, gl.bodyFlash) * 0.6;
            ctx.drawImage(body, o.x, o.y, GL_W, h);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
        }
        ctx.restore();
        // the stump swelling green before it spits, the same tell as a head's
        const st = gl.stump, ssw = st.charge > 0 ? Math.min(1, st.charge / GL_CHARGE) : st.shots > 0 ? 1 : 0;
        if (ssw > 0) {
            const r = GL_HEAD_W * 0.8;
            const g = ctx.createRadialGradient(gl.cx, gl.cy, r * 0.2, gl.cx, gl.cy, r);
            g.addColorStop(0, PH_LOOK.color);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = PH_LOOK.glow * 1.6 * ssw;
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(gl.cx, gl.cy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        for (const k of gl.heads) {
            if (!k.alive) continue;
            const hw = GL_HEAD_W * glSize(k), hh = hw * (BALL_RY / BALL_RX);
            // still growing: small, and see-through, since there is nothing to hit yet
            if (k.grow >= 0) {
                const gw = hw * (0.25 + 0.75 * glGrown(k)), gh = gw * (BALL_RY / BALL_RX);
                ctx.globalAlpha = 0.6;
                ctx.drawImage(ballImg, k.x - gw / 2, k.y - gh / 2, gw, gh);
                ctx.globalAlpha = 1;
                continue;
            }
            // the swell before a burst: green washing up over him and a glow
            // round him, rising once -- a tell, not a flash
            const sw = k.charge > 0 ? Math.min(1, k.charge / (k.big ? GL_BIG_CHARGE : GL_CHARGE)) : k.shots > 0 ? 1 : 0;
            glLookUnder(k, hw, hh);
            if (sw > 0) {
                const r = hw * 0.95;
                const g = ctx.createRadialGradient(k.x, k.y, hw * 0.2, k.x, k.y, r);
                g.addColorStop(0, PH_LOOK.color);
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.globalAlpha = PH_LOOK.glow * 1.6 * sw;
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(k.x, k.y, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
            if (k.loose) {
                // small, and slowly turning
                const lw = hw * GL_LOOSE_SIZE, lh = lw * (BALL_RY / BALL_RX);
                // shot, it drags a fading tail of itself, so it reads as thrown
                if (k.shot) {
                    const sp = Math.hypot(k.vx, k.vy) || 1;
                    for (const [back, a] of [[0.05, 0.3], [0.1, 0.15]]) {
                        ctx.globalAlpha = a;
                        ctx.drawImage(ballImg, k.x - k.vx * back - lw / 2, k.y - k.vy * back - lh / 2, lw, lh);
                    }
                    ctx.globalAlpha = 1;
                }
                ctx.save();
                ctx.translate(k.x, k.y);
                ctx.rotate(k.rot);
                if (GL_LOOK_HORNS) glLookHorns(lw, lh);
                ctx.drawImage(ballImg, -lw / 2, -lh / 2, lw, lh);
                if (k.flash > 0) {
                    ctx.globalAlpha = Math.min(1, k.flash) * 0.7;
                    ctx.drawImage(headSprite2('flat', '#f2efe9'), -lw / 2, -lh / 2, lw, lh);
                }
                ctx.restore();
                if (k.big && k.hp < GL_BIG_LOOSE_HP) labBar(k.x - lw * 0.35, k.y - lh / 2 - 7, lw * 0.7, k.hp / GL_BIG_LOOSE_HP, 3);
                continue;
            }
            ctx.save();
            ctx.translate(k.x, k.y);
            if (k.roll) ctx.rotate(k.roll);
            if (GL_LOOK_HORNS) glLookHorns(hw, hh);
            ctx.drawImage(ballImg, -hw / 2, -hh / 2, hw, hh);
            const green = sw > 0 ? phantomSprite(PH_LOOK) : null;
            if (green) {
                ctx.globalAlpha = 0.55 * sw;
                ctx.drawImage(green, -hw / 2, -hh / 2, hw, hh);
                ctx.globalAlpha = 1;
            }
            if (k.flash > 0) {
                ctx.globalAlpha = Math.min(1, k.flash) * 0.7;
                ctx.drawImage(headSprite2('flat', '#f2efe9'), -hw / 2, -hh / 2, hw, hh);
                ctx.globalAlpha = 1;
            }
            ctx.restore();
            // dazed after a bite: three little brandons going round over it
            if (k.lg && k.lg.st === 'daze') {
                const sw = 14, sh = sw * (BALL_RY / BALL_RX);
                for (let i = 0; i < 3; i++) {
                    const a = clock * 4 + i * Math.PI * 2 / 3;
                    ctx.drawImage(ballImg, k.x + Math.cos(a) * hw * 0.45 - sw / 2,
                                  k.y - hh / 2 - 6 + Math.sin(a) * 6 - sh / 2, sw, sh);
                }
            }
            // what it has left, over it, the way the wall's bricks wear theirs
            const full = k.loose ? GL_LOOSE_HP : k.big ? glBigHp() : GL_HEAD_HP;
            if (k.hp < full) labBar(k.x - hw * 0.35, k.y - hh / 2 - 7, hw * 0.7, k.hp / full, 3);
        }
        gl.pops = gl.pops.filter(p => clock - p.t0 < GL_POP_SECS);
        for (const p of gl.pops) {
            const k = (clock - p.t0) / GL_POP_SECS, w = p.w * (1 + 0.6 * k), h = w * (BALL_RY / BALL_RX);
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.globalAlpha = 1 - k;
            ctx.drawImage(ballImg, -w / 2, -h / 2, w, h);
            ctx.globalAlpha = (1 - k) * 0.7;
            ctx.drawImage(headSprite2('flat', '#f2efe9'), -w / 2, -h / 2, w, h);
            ctx.restore();
        }
        const grow = phase === 'entrance' ? enterK() : 1;
        if (grow > 0.001) labBar(LW / 2 - 150 * grow, 10, 300 * grow, b.hp / b.maxHp);
    }