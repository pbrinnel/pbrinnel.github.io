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
    //   snaps down its neck at you: under it and you are SLUGGISH. It holds
    //   the snap, still rearing, while a ball is in its way (glInPath). Then it
    //   springs back up and hangs dazed for GL_LUNGE_DAZE, near the ball and worth
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
    // own. From then on the body and the big head are one pool (glGrowBig),
    // so a hit on either counts and the bar along the top is the truth, and
    // the body stays open while the head is up. When the pool is down to its
    // last GL_BIG_LOOSE_HP the head tears free and the body turns to stone,
    // so those last hits are the head's.
    //
    // The big head is GL_BIG times the size. It fires three ways at once,
    // down its neck and out to both sides -- the way through is the diagonals
    // under it -- and its bite STUNS as well (GL_BIG_STUN), the one thing in
    // the fight that does, so it stays a surprise. Loose, it is the chase the
    // fight ends on: the pool's last GL_BIG_LOOSE_HP hits, faster than a
    // small one, knocked across the field by every one of them, and it
    // bounces off you rather than bursting. The pool's last hit throws the
    // head into his stone body (GL_FINALE) and the two blow up together, the
    // bar at nothing.
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
    let GL_HEAD_HP  = 8;      // hits to tear one loose
    let GL_LOOSE_HP = 1;      // ...and to finish it once it is off
    let GL_LOOSE_SIZE = 0.67; // ...how big it is, loose, of one on a neck
    let GL_LOOSE_SPIN = 1.2;  // ...and rad/s it turns at
    let GL_W        = 560;    // how long his body is
    let GL_Y        = 100;    // where the collar hangs
    let GL_TILT     = 1.0472; // rad his body is turned by, about the collar: legs up, leant 30 degrees off upright
    let GL_DRIFT    = 90;     // px either side the collar drifts
    let GL_HEAD_W   = 78;     // how wide a head is
    let GL_NECK     = 145;    // px from the collar out to a head
    let GL_FAN      = 0.9;    // rad between one neck and the next
    // under half GL_FAN, so two necks can never swing into the same place
    let GL_SWING    = 0.25;   // rad either side the necks sway through
    let GL_RATE     = 0.7;    // rad/s of that sway
    let GL_LOOSE    = 140;    // px/s a loose head flies at
    let GL_CHIN     = 0.6;    // rad from straight down a ball off the underside of a head goes at, at least
    let GL_THICK    = 0.17;   // how thick his body is to a head, as a share of it
    // The hole his head left is where its middle was, not where his neck
    // meets his shoulders. So he is slid along his length by GL_SEAT_U and
    // across by GL_SEAT_V until the stump of his neck sits on the collar,
    // which is where the necks come out, whatever GL_TILT leans him to.
    let GL_SEAT_U   = 27;     // px toward the necks
    let GL_SEAT_V   = -17;    // px across him
    let GL_CLIMB    = 0.15;   // how much of the original's climb this fight has
    let GL_BODY_HP  = 8;      // hits on his body, once it has no head on a neck
    let GL_GROW_QUAKE = 4;    // px he trembles by while the big head is coming
    let GL_REGROW   = 8;      // seconds the big head takes to grow, which is how long the body is open for
    let GL_SAG      = 100;    // px he sags into the field while he is open
    let GL_STUMP_MIN = 8;     // seconds between the stump's bursts while he is open, at least...
    let GL_STUMP_MAX = 11;    // ...and at most
    let GL_HEAD_IF  = 0.25;   // seconds after a head is hit before it can be hit again
    let GL_ENTER    = 6;      // seconds he takes to arrive
    let GL_FIRE_MIN = 13;     // seconds between one head's bursts, at least...
    let GL_FIRE_MAX = 20;     // ...and at most
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
    let GL_BIG      = 1.6;    // the big head's size, of a small one
    let GL_BIG_HP   = 9;      // ...its hits to tear loose, its own number so the small heads can change without it
    let GL_BIG_CHARGE = 1.4;  // seconds of shaking and swelling before it fires, which is its tell
    let GL_BIG_SHAKE = 5;     // ...px it shakes, at the height of that
    let GL_BIG_ARC  = 0.6;    // rad between its columns, down each way
    let GL_BIG_NECK = 0.45;   // its neck, of a small one's
    let GL_BIG_BOB  = 6;      // px it bobs while it waits...
    let GL_BIG_ROLL = 0.07;   // ...rad it rolls...
    let GL_BIG_HZ   = 0.35;   // ...and how many times a second
    let GL_BIG_STUN = 1.0;    // seconds its bite holds you STUNNED, before the SLUGGISH
    let GL_BIG_LOOSE_HP = 2;  // the pool's last hits, on the head alone, once it is loose and he is stone
    let GL_FINALE   = 0.45;   // seconds a finished big head takes to fly into his body
    let GL_BIG_LOOSE = 260;   // ...and px/s it flies at, and is knocked away at
    let GL_BIG_KNOCK_IF = 0.9; // ...and seconds it tumbles after a knock before it can be hit again
    let GL_LUNGE_FIRST = 6;   // seconds into the fight before the first lunge
    let GL_LUNGE_MIN   = 8;   // seconds between one lunge and the next, at least...
    let GL_LUNGE_MAX   = 12;  // ...and at most
    let GL_LUNGE_REAR  = 0.6; // seconds it draws back and shakes, its eye on you -- the tell
    let GL_BIG_REAR    = 1.1; // ...and the big head's, whose bite STUNS: time to get out from under it
    let GL_LUNGE_BITE  = 0.22; // seconds from there down to your line
    let GL_LUNGE_HOLD  = 1.2; // seconds at most it holds its bite, still rearing, for a ball in its way (glInPath)
    let GL_LUNGE_DODGE = 0.5; // radians above level a ball it bites down on anyway leaves its side at (glDodge)
    let GL_LUNGE_DAZE  = 1.6; // seconds it hangs low and dazed after
    let GL_LUNGE_GAP   = 110; // ...px between its chin and your line where it hangs, so there is plainly room under it
    let GL_LUNGE_SPRING = 2.2; // ...times a second it bounces as it springs back up there
    let GL_LUNGE_DAMP  = 7;   // ...and how quickly that dies away
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
    // Extra looks, each on its own switch in the boss lab: the wings are his,
    // the rest are off here until one is picked.
    let GL_LOOK_GLOW   = 0;      // fire light round his collar and under each head
    let GL_LOOK_WINGS  = 1;      // little wings on his shoulders, see-through, fluttering
    let GL_LOOK_HYDRA  = 0;      // each head its own colour, the one it throws in
    let GL_LOOK_BREATH = 0;      // fire at the mouth as a head swells, and a jet as it fires
    let GL_LOOK_SKY    = 0;      // the top of the field burning, ash drifting up through it
    let GL_WING_HZ     = 0.47;   // wingbeats a second
    // Whole looks being tried out in the boss lab: 0 as he is, 1 a heraldic
    // wyvern in crimson and gold, 2 a stained-glass window come alive. Either
    // of the new two trades HEADLESS's body for one of its own, centred over
    // the collar -- the body he is hit on as well as the one drawn -- and
    // makes the heads GL_STYLE_HEAD times the size.
    let GL_STYLE       = 2;
    let GL_STYLE_HEAD  = 1.35;
    let GL_STYLE_NECK  = 1.05;    // ...and the necks times as long, to keep the bigger heads apart
    let GL_STYLE_BODY  = 0;      // ...and his body: 0 his own, turned as ever; 1 two of him head to head
    let GL_BODY_RX     = 190;    // the pair's half-width...
    let GL_BODY_RY     = 55;     // ...and half-height
    LAB_KNOBS.push('GL_STYLE', 'GL_STYLE_HEAD', 'GL_STYLE_NECK', 'GL_STYLE_BODY', 'GL_BODY_RX', 'GL_BODY_RY');
    LAB_KNOBS.push('GL_LOOK_GLOW', 'GL_LOOK_WINGS', 'GL_LOOK_HYDRA', 'GL_LOOK_BREATH', 'GL_LOOK_SKY', 'GL_WING_HZ');
    LAB_KNOBS.push('GL_CHIN', 'GL_FINALE');
    LAB_KNOBS.push('GL_LVL', 'GL_HEADS', 'GL_HEAD_HP', 'GL_LOOSE_HP', 'GL_W', 'GL_Y', 'GL_TILT',
                   'GL_DRIFT', 'GL_HEAD_W', 'GL_NECK', 'GL_FAN', 'GL_SWING', 'GL_RATE',
                   'GL_LOOSE', 'GL_THICK', 'GL_SEAT_U', 'GL_SEAT_V', 'GL_CLIMB', 'GL_FIRE_MIN', 'GL_FIRE_MAX', 'GL_CHARGE',
                   'GL_BURST_GAP', 'GL_BURST_ARC', 'GL_BURST_SPEED', 'GL_BURST_SIZE', 'GL_BURST_MAX', 'GL_LOOSE_SIZE',
                   'GL_LOOSE_SPIN', 'GL_STONE_A0', 'GL_STONE_A1', 'GL_STONE_HZ', 'GL_STONE_STEER',
                   'GL_BIG', 'GL_BIG_HP', 'GL_BIG_CHARGE', 'GL_BIG_SHAKE',
                   'GL_BIG_ARC', 'GL_BIG_NECK', 'GL_BIG_BOB', 'GL_BIG_ROLL', 'GL_BIG_HZ', 'GL_BIG_STUN',
                   'GL_BIG_LOOSE_HP', 'GL_BIG_LOOSE', 'GL_BIG_KNOCK_IF', 'GL_SAG', 'GL_STUMP_MIN', 'GL_STUMP_MAX', 'GL_HEAD_IF',
                   'GL_LUNGE_FIRST', 'GL_LUNGE_MIN', 'GL_LUNGE_MAX', 'GL_LUNGE_REAR', 'GL_LUNGE_BITE', 'GL_LUNGE_HOLD', 'GL_LUNGE_DODGE', 'GL_LUNGE_DAZE',
                   'GL_BIG_REAR', 'GL_LUNGE_GAP', 'GL_LUNGE_SPRING', 'GL_LUNGE_DAMP', 'GL_LUNGE_BACK', 'GL_LUNGE_DMG', 'GL_LUNGE_IF',
                   'GL_AMMO_SPEED', 'GL_AMMO_CONE', 'GL_AMMO_TURN', 'GL_AMMO_DMG', 'GL_AMMO_BODY',
                   'GL_THRASH', 'GL_THRASH_HZ', 'GL_THRASH_DRIFT', 'GL_THRASH_PACE',
                   'GL_BODY_HP', 'GL_REGROW', 'GL_ENTER', 'GL_GROW_QUAKE');

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
    const glSize = k => (k.big ? GL_BIG : 1) * (GL_STYLE ? GL_STYLE_HEAD : 1);
    // the big head's hits to tear loose
    const glBigHp = () => Math.max(1, Math.round(GL_BIG_HP));
    // what a head still has in it, loose hits and all
    const glLeft = k => k.loose || k.big ? k.hp : k.hp + GL_LOOSE_HP;

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
                   stone: 1, tilt: GL_TILT, thrash: 0, sag: 0, finale: null, booms: [],
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
                gl.sag += Math.max(-dt * 1.5, Math.min(dt * 1.5, (open && !gl.bigUsed ? 1 : 0) - gl.sag));
                gl.thrash += Math.max(-dt * 1.5, Math.min(dt * 1.5, (open && !spent ? 1 : 0) - gl.thrash));
                if (phase === 'play') gl.ph += dt * 0.25 * (1 + (GL_THRASH_PACE - 1) * gl.thrash);
                gl.cx = LW / 2 + Math.sin(gl.ph) * GL_DRIFT * (1 + (GL_THRASH_DRIFT - 1) * gl.thrash);
                // the whole of him trembling while the big head comes, harder as it does
                const coming = gl.heads.find(k => k.alive && k.big && k.grow >= 0);
                if (coming) gl.cx += Math.sin(clock * 47) * GL_GROW_QUAKE * glGrown(coming);
                gl.cy = GL_Y + GL_SAG * gl.sag;
                gl.spread = 1;
                gl.tilt = GL_TILT + Math.sin(gl.t * GL_THRASH_HZ * Math.PI * 2) * GL_THRASH * gl.thrash;
            }
            if (gl.finale) { glFinaleStep(b, dt); glBox(b); return; }
            if (gl.bodyFlash > 0) gl.bodyFlash = Math.max(0, gl.bodyFlash - dt * 6);
            if (gl.bodyIF > 0) gl.bodyIF = Math.max(0, gl.bodyIF - dt);
            if (phase === 'play') {
                // the body open for the first time starts the race
                if (!gl.bigUsed && glOpen()) glGrowBig();
                glGrow(dt);
                glLungeClock(dt);
                // the stump spits while he is open
                gl.stump.x = gl.cx; gl.stump.y = gl.cy;
                if (glOpen() && !glBigUp()) glFire(gl.stump, Math.PI / 2, dt, GL_STUMP_MIN, GL_STUMP_MAX);
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
                    const reach = GL_NECK * (GL_STYLE ? GL_STYLE_NECK : 1) * (k.big ? GL_BIG_NECK : 1) * glGrown(k) * (1 - 0.18 * wind * wind);
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
            if (gl.finale) { gl.pend = null; return null; }     // nothing to hit: it is over
            for (const k of gl.heads) {
                // nothing to hit until it is whole, and a shot one is the ball's already
                if (!k.alive || k.grow >= 0 || k.shot) continue;
                if (k.lg && k.lg.st === 'bite' && !k.loose) {
                    const rx = GL_HEAD_W * glSize(k) / 2, ry = rx * (BALL_RY / BALL_RX);
                    if (Math.hypot((ball.x - k.x) / rx, (ball.y - k.y) / ry) < 1 || glHeadContact(ball, k)) {
                        glDodge(ball, k); gl.pend = null; return null;
                    }
                    continue;
                }
                if (glEject(ball, k)) { gl.pend = null; return null; }
                const hit = glHeadContact(ball, k);
                if (hit) { gl.pend = k; return hit; }
            }
            if (glPair()) {
                const e = glBodyEll(), hit = ellipseContact(ball, e.x, e.y, e.rx, e.ry);
                gl.pend = hit ? 'body' : null;
                return hit;
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
                if (!k.alive || (k.loose && !k.big) || k.grow >= 0) continue;
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
            if (k !== 'body' && ball) glChin(k, ball, cx, cy);
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
            if (GL_STYLE && gl) glStyleBody(1 - e);
            else if (ascendT < A_DIE) drawFigure(c.x, c.y, c.w, 1, e, tilt);
            else drawCrumble(c, 0, tilt, true);
            glDrawBooms();
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
                           (glOpen() ? 'body open' + (big ? '' : ' ' + gl.body + '/' + GL_BODY_HP) : 'body shut') +
                           (big ? ' · big head ' + (big.grow >= 0 ? 'growing' : big.loose ? 'loose' : 'on its neck') + ', pool ' + big.hp : '') +
                           (lg ? ' · lunge: ' + lg.lg.st + (lg.lg.hold ? ', held ' + lg.lg.hold.toFixed(1) + 's for a ball' : '') : '') };
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

    // two of him head to head (GL_STYLE_BODY), in place of his own body
    const glPair = () => !!(GL_STYLE && GL_STYLE_BODY);
    // ...hit as an ellipse lying across the collar, rocked with him as he thrashes
    function glBodyEll() {
        const r = gl.tilt - GL_TILT;
        return { x: gl.cx, y: gl.cy + GL_BODY_RY * 0.2, rx: GL_BODY_RX, ry: GL_BODY_RY, rot: r };
    }

    // where on his body a head thrown at it goes for
    function glBodyAim() {
        if (!glPair()) return glSpine(0.15);
        const e = glBodyEll();
        return { x: e.x, y: e.y + e.ry * 0.3 };
    }

    // how far (x, y) is from his body's outline, less than 0 inside it
    function glBodyGap(x, y) {
        if (glPair()) {
            const e = glBodyEll();
            return (Math.hypot((x - e.x) / e.rx, (y - e.y) / e.ry) - 1) * Math.min(e.rx, e.ry);
        }
        const a = glSpine(0), z = glSpine(1);
        const vx = z.x - a.x, vy = z.y - a.y, l2 = vx * vx + vy * vy || 1;
        const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / l2));
        return Math.hypot(x - a.x - vx * t, y - a.y - vy * t) - GL_W / SHAPE_ASPECT * GL_THICK;
    }

    // the middle of the box his body is drawn in, which is where drawFigure
    // and the crumble turn him about
    function glMiddle() {
        if (glPair()) { const e = glBodyEll(); return { x: e.x, y: e.y }; }
        const o = glOrigin(), h = GL_W / SHAPE_ASPECT;
        return glLocal(o.x + GL_W / 2, o.y + h / 2);
    }

    // Nothing on a neck that can be hit, and something left in the body: it
    // is open.
    // Shut while a small head is on its neck. With the big head out, open --
    // a hit on the body counts toward the pool as much as one on the head --
    // until the head tears loose for the pool's last hits: then he turns to
    // stone, so the hits that throw the head into him are the head's own.
    function glOpen() {
        if (gl.heads.some(k => k.alive && !k.big && !k.loose && k.grow < 0)) return false;
        const big = gl.heads.find(k => k.alive && k.big);
        return big ? !big.loose : gl.body > 0;
    }
    // the big head, out and whole on its neck
    const glBigUp = () => gl.heads.some(k => k.alive && k.big && !k.loose && k.grow < 0);

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

    // Off the underside of a head on its neck, a ball goes away at a slant,
    // never within GL_CHIN of straight down: it is only a head's height or
    // two above you, and one coming straight back down was on you faster than
    // anyone can react -- most heads lost in the fight were lost that way.
    // It goes off the side of the head it struck.
    function glChin(k, ball, cx, cy) {
        if (k.loose || cy < k.y || ball.vy <= 0 || !GL_CHIN) return;
        const s = Math.hypot(ball.vx, ball.vy);
        if (Math.atan2(Math.abs(ball.vx), ball.vy) >= GL_CHIN) return;
        const side = Math.sign(ball.x - k.x) || Math.sign(ball.vx) || (Math.random() < 0.5 ? -1 : 1);
        ball.vx = side * Math.sin(GL_CHIN) * s;
        ball.vy = Math.cos(GL_CHIN) * s;
    }

    // A head hurt, by the ball or by a head shot into it. On a neck, a small
    // one's last hit tears it loose, and the big one tears loose when the
    // pool (glGrowBig) is down to its last GL_BIG_LOOSE_HP. The pool empty,
    // from the big head or the body, is the end of him.
    function glWound(k, n, cx, cy) {
        k.flash = 1;
        k.hp = Math.max(0, k.hp - n);
        const tear = k.big ? k.hp > 0 && k.hp <= GL_BIG_LOOSE_HP && k.grow < 0 : k.hp <= 0;
        if (!k.loose && tear) {
            // torn loose: still alive, and now it has the run of the field
            k.loose = true;
            if (!k.big) k.hp = GL_LOOSE_HP;
            k.charge = 0; k.shots = 0; k.jx = 0; k.lg = null; k.roll = 0; k.iF = 0;
            gl.torn++;
            const a = Math.PI * (0.15 + Math.random() * 0.7);
            const sp = k.big ? GL_BIG_LOOSE : GL_LOOSE;
            k.vx = Math.cos(a) * sp * (Math.random() < 0.5 ? -1 : 1);
            k.vy = Math.sin(a) * sp;
            award(BOSS_PTS * 2, cx, cy);
            maybeDropCapsule(cx, cy);
            // the big one roars as it comes free, and he turns to stone behind it
            if (k.big) {
                const hh = GL_HEAD_W * glSize(k) * (BALL_RY / BALL_RX) / 2;
                labShout(k.x, k.y, 'BRANDON!', 2.4, () => ({ x: k.x, y: k.y + hh + 10 }));
            }
            return;
        }
        if (k.hp > 0) { award(BOSS_PTS * n, cx, cy); return; }
        award(BOSS_PTS * (k.big ? 5 : 3), cx, cy);
        if (!k.big) { glPop(k); return; }
        // the big one finished: thrown into his body, and that is the end of both
        gl.finale = { k, t: 0, x0: k.x, y0: k.y };
    }

    // The open body hurt. With the big head out, that is the pool (glWound),
    // and the head flashes with it; the last hit throws it into the body and
    // the two blow up together, whichever of them took it. Without one -- the
    // lab's jumps -- emptied, he is done.
    function glBodyWound(n, cx, cy) {
        gl.bodyFlash = 1;
        gl.bodyIF = BOSS_IF;
        const big = gl.heads.find(k => k.alive && k.big);
        if (big) { glWound(big, n, cx, cy); return; }
        gl.body = Math.max(0, gl.body - n);
        award(BOSS_PTS * (gl.body <= 0 ? 5 : n), cx, cy);
        if (gl.body > 0) return;
        for (const k of gl.heads) if (k.alive && k.big) glBoom(k);
        glDie(bricks[0]);
    }

    // The big head flying into his body, and the two of them going up together
    // when it gets there.
    function glFinaleStep(b, dt) {
        const f = gl.finale, k = f.k;
        f.t += dt;
        const e = Math.min(1, f.t / GL_FINALE), q = e * e;
        const to = glBodyAim();
        k.x = f.x0 + (to.x - f.x0) * q;
        k.y = f.y0 + (to.y - f.y0) * q;
        k.rot += dt * 14;
        if (e < 1) return;
        gl.finale = null;
        glBoom(k);
        glDie(b);
    }

    // A head going up: it swells and burns off where it was, once, over
    // GL_BOOM_SECS, drawn with his fall after he is gone.
    const GL_BOOM_SECS = 0.7;
    function glBoom(k) {
        const w = GL_HEAD_W * glSize(k) * (k.loose ? GL_LOOSE_SIZE : 1) * (k.grow >= 0 ? 0.25 + 0.75 * glGrown(k) : 1);
        gl.booms.push({ x: k.x, y: k.y, w, rot: k.rot || 0, t0: clock });
    }
    function glDrawBooms() {
        if (!gl || !gl.booms.length) return;
        gl.booms = gl.booms.filter(o => clock - o.t0 < GL_BOOM_SECS);
        for (const o of gl.booms) {
            const k = (clock - o.t0) / GL_BOOM_SECS, w = o.w * (1 + 0.9 * k), h = w * (BALL_RY / BALL_RX);
            // the light of it: rising once to a peak and gone, never pulsing
            const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, w * 1.4);
            g.addColorStop(0, '#fff1d6');
            g.addColorStop(0.4, '#e2683a');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.8 * Math.sin(Math.min(1, k * 1.4) * Math.PI);
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(o.x, o.y, w * 1.4, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            ctx.save();
            ctx.translate(o.x, o.y);
            ctx.rotate(o.rot);
            ctx.globalAlpha = 1 - k;
            ctx.drawImage(ballImg, -w / 2, -h / 2, w, h);
            ctx.restore();
        }
    }

    // every small head gone and the body empty: where the lab's jumps and
    // finish start from
    function glStrip() {
        for (const k of gl.heads) { k.alive = false; k.lg = null; }
        gl.yelled = true;                 // and past the entrance's shout
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
    // From here on the body and the big head are one pool, kept as the big
    // head's hp: what the body had, its own hits, and its loose ones.
    function glGrowBig() {
        gl.bigUsed = true;
        const k = glHead(0, true);
        k.hp = gl.body + glBigHp() + GL_BIG_LOOSE_HP;
        k.poolFrom = k.hp;
        k.grow = 0;
        k.x = k.bx = gl.cx; k.y = k.by = gl.cy;
        gl.heads.push(k);
        return k;
    }
    // how far the pool has gone down to the big head's last hits, 0 fresh to
    // 1 there: its mane grows with it, so it looks worse the more it is hurt
    const glRage = k => !k.poolFrom ? 1 :
        Math.max(0, Math.min(1, 1 - (k.hp - GL_BIG_LOOSE_HP) / Math.max(1, k.poolFrom - GL_BIG_LOOSE_HP)));

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
                // only heads that are there to shout: the lab's jumps start him
                // with the small ones gone and the big one still coming
                for (const h of gl.heads) {
                    if (!h.alive || h.grow >= 0) continue;
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

    // Whether a ball in play would meet the head on its bite, were it to go
    // now: the two played forward together over GL_LUNGE_BITE, the head down
    // its curve (glLunge) and the ball on its line, back up off your line as
    // though you meet it, since under the bite is where you are. One on the
    // paddle waiting to be served is going nowhere yet.
    function glInPath(k, L) {
        const rx = GL_HEAD_W * glSize(k) / 2, ry = rx * (BALL_RY / BALL_RX);
        const floor = padY() - padH() / 2 - ry;
        const N = 12;
        return balls.some(q => {
            if (q.stuck) return false;
            const ax = rx + extX(q), ay = ry + extY(q), line = padY() - padH() / 2 - extY(q);
            for (let i = 0; i <= N; i++) {
                const t = i / N * GL_LUNGE_BITE, e = (i / N) * (i / N);
                const hx = k.x + (L.tx - k.x) * e, hy = k.y + (floor - k.y) * e;
                let y = q.y + q.vy * t;
                if (y > line) y = 2 * line - y;
                const dx = (q.x + q.vx * t - hx) / ax, dy = (y - hy) / ay;
                if (dx * dx + dy * dy < 1) return true;
            }
            return false;
        });
    }

    // A ball the head meets on its bite -- it held as long as GL_LUNGE_HOLD
    // lets it, and went anyway -- is put out at its side at the ball's own
    // height, clear of it, heading away and GL_LUNGE_DODGE up, rather than
    // bounced and then overtaken and pushed out under it, straight down at
    // you. Toward the side with room for the head's whole width.
    function glDodge(ball, k) {
        const rx = GL_HEAD_W * glSize(k) / 2, ry = rx * (BALL_RY / BALL_RX), ex = extX(ball);
        const dy = Math.max(-ry, Math.min(ry, ball.y - k.y));
        const out = rx * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry))) + ex + 2;
        let side = Math.sign(ball.x - k.x) || (Math.random() < 0.5 ? -1 : 1);
        const room = sd => sd < 0 ? k.x - rx - 2 * ex - 2 >= 0 : k.x + rx + 2 * ex + 2 <= LW;
        if (!room(side) && room(-side)) side = -side;
        ball.x = k.x + side * out;
        const sp = effSpeed() * (ball.boost || 1);
        ball.vx = side * Math.cos(GL_LUNGE_DODGE) * sp;
        ball.vy = -Math.sin(GL_LUNGE_DODGE) * sp;
    }

    // how long a head draws back before it bites
    const glRear = k => k.big ? GL_BIG_REAR : GL_LUNGE_REAR;

    // A lunge, a stage at a time: it draws back up its neck and shakes, its
    // eye on you -- the mark on your line follows you until it goes -- then
    // snaps down to where you were, springs back up to GL_LUNGE_GAP over your
    // line, hangs there dazed, and goes back up its neck. The spring is what
    // says it is not a wall like the IDOL's: there is room to go under it.
    function glLunge(k, dt) {
        const L = k.lg, hw = GL_HEAD_W * glSize(k), hh = hw * (BALL_RY / BALL_RX);
        const floor = padY() - padH() / 2 - hh / 2, low = floor - GL_LUNGE_GAP, rear = glRear(k);
        L.t += dt;
        if (L.st === 'rear') {
            const e = Math.min(1, L.t / rear);
            L.tx = Math.max(hw / 2, Math.min(LW - hw / 2, glNearSeg(k.bx).cx));
            k.x = k.ax + (k.bx - k.ax) * (1 - 0.25 * e) + Math.sin(clock * 52) * 4 * e;
            k.y = k.ay + (k.by - k.ay) * (1 - 0.25 * e);
            if (L.t < rear) return;
            // not while a ball is in its way: bitten down on, it came straight
            // back down at you, and the big one's bite has you STUNNED for it
            if (glInPath(k, L) && (L.hold = (L.hold || 0) + dt) < GL_LUNGE_HOLD) return;
            L.st = 'bite'; L.t = 0; L.x0 = k.x; L.y0 = k.y;
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
            const s = 1 - Math.exp(-L.t * GL_LUNGE_DAMP) * Math.cos(L.t * GL_LUNGE_SPRING * Math.PI * 2);
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
        if (glOpen()) { const p = glBodyAim(); out.push({ ref: 'body', x: p.x, y: p.y }); }
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
        const t = S.tgt === 'body' ? (glOpen() ? glBodyAim() : null)
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
                                life: PH_LIFE * PH_SPEED / GL_BURST_SPEED, look: glPhLook(k) });
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
                                    life: PH_LIFE * PH_SPEED / GL_BURST_SPEED, look: glPhLook(k) });
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

    // The box the physics looks for him in: his body and wherever his heads
    // are, each by its own size and turned any way, since a loose one spins.
    // One flat size for every head left the big one's chin out of it, and a
    // ball was only found once it was deep in the head, where glEject put it
    // back out without a hit.
    function glBox(b) {
        const h = GL_W / SHAPE_ASPECT;
        const a = glSpine(0), boot = glSpine(1), e = glPair() ? glBodyEll() : null;
        let x0 = e ? e.x - e.rx - 60 : Math.min(gl.cx, a.x, boot.x) - h / 2, x1 = e ? e.x + e.rx + 60 : Math.max(gl.cx, a.x, boot.x) + h / 2;
        let y0 = e ? e.y - e.ry : Math.min(gl.cy, a.y, boot.y) - h / 2, y1 = e ? gl.cy + 10 : Math.max(gl.cy, a.y, boot.y) + h / 2;
        for (const k of gl.heads) {
            if (!k.alive) continue;
            const r = GL_HEAD_W * glSize(k) * (k.loose ? GL_LOOSE_SIZE : 1) / 2 * (BALL_RY / BALL_RX) + 4;
            x0 = Math.min(x0, k.x - r); x1 = Math.max(x1, k.x + r);
            y0 = Math.min(y0, k.y - r); y1 = Math.max(y1, k.y + r);
        }
        b.x = x0; b.y = y0; bw = x1 - x0; bh = y1 - y0;
        // everything left to hit, the big head from the start, so it only goes down
        b.hp = gl.finale ? 0 : gl.heads.reduce((s, k) => s + (k.alive ? glLeft(k) : 0), 0) +
               (gl.bigUsed ? 0 : gl.body + glBigHp() + GL_BIG_LOOSE_HP);
    }

    // ---- looks being tried out (the GL_LOOK_ switches) ---------------------------
    const GL_FIRE = '#e2683a', GL_FIRE_RIM = '#ffb072', GL_FIRE_CORE = '#fff1d6';
    // each head's light in its own colour (glElement), or all in fire
    const glInk = k => GL_LOOK_HYDRA ? glElement(k) : GL_FIRE;

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
        if (GL_LOOK_GLOW) glLight(gl.cx, gl.cy, 280, GL_FIRE, 0.28 + 0.06 * Math.sin(clock * 1.2));
    }

    // Two little wings on his shoulders, Dragonite's and about as much use:
    // each a fan of his own lying body, four small washed copies with the
    // longest in front, each on a dark copy of itself, see-through, fluttering
    // about the shoulder. Drawn over his body and under his heads.
    let GL_WING_SIZE  = 70;      // px, the longest body in a wing
    let GL_WING_ALPHA = 0.6;     // how solid a wing is
    LAB_KNOBS.push('GL_WING_SIZE', 'GL_WING_ALPHA');
    const GL_WING_FAN = [[-0.25, 1], [-0.62, 0.9], [-0.98, 0.76], [-1.32, 0.6]];   // angle up from level, share of GL_WING_SIZE
    function glLookWings() {
        // red against his greens and the heads' element colours; gold on the crimson wyvern
        const ink = GL_STYLE === 1 ? HER_GOLD : '#d8303a';
        const wing = shapeSprite('glWing' + ink, ink, 200, 200 / SHAPE_ASPECT, false);
        const lead = shapeSprite('glWingLead', GL_STYLE === 1 ? HER_DARK : GLASS_LEAD, 200, 200 / SHAPE_ASPECT, true);
        if (!wing || !lead) return;
        const flap = Math.sin(clock * GL_WING_HZ * Math.PI * 2) * 0.28;
        for (const side of [-1, 1]) {
            ctx.save();
            ctx.translate(gl.cx + side * GL_HEAD_W * 0.55, gl.cy - GL_HEAD_W * 0.3);
            ctx.scale(side, 1);
            ctx.rotate(-flap);
            // back to front, so the longest lies over the rest
            for (let i = GL_WING_FAN.length - 1; i >= 0; i--) {
                const [a, k] = GL_WING_FAN[i], L = GL_WING_SIZE * k, T = L / SHAPE_ASPECT;
                ctx.save();
                ctx.rotate(a);
                ctx.translate(L / 2, 0);
                ctx.globalAlpha = GL_WING_ALPHA;
                ctx.drawImage(lead, -L * 0.54, -T * 0.62, L * 1.08, T * 1.24);
                ctx.drawImage(wing, -L / 2, -T / 2, L, T);
                ctx.restore();
            }
            ctx.restore();
        }
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

    // ---- the two whole looks (GL_STYLE) ----------------------------------------------
    // Both made of nothing but the two photographs, as every character is:
    // his own body and heads, washed in a colour (the WINDMILL's gold), laid
    // in pieces with a darker copy of each behind as its setting (the IDOL's
    // mortar), and strung and ringed. The one thing that is not him is the
    // light behind the glass, as the LAMPS' glow is not.
    const HER_RED = '#b3202a', HER_GOLD = '#e2b43e', HER_DARK = '#2a0a0e', HER_IRON = '#5a5860';
    const GLASS = ['#c8283a', '#2a5bc8', '#2f9a58', '#e0a22a', '#7a3ab8', '#d8602a', '#3aa8b8'];
    const GLASS_LEAD = '#141318';
    // Each head's own colour, left to right, and the big one's: the colour of
    // what it throws, its tell and its mane. None of them near the real
    // ball's skin, for the reason PH_LOOK gives -- no red, no orange, no pink.
    const GL_ELEMENT = ['#6faf3a', '#3fc4ff', '#a060ff'];
    const GL_ELEMENT_BIG = '#dfe8ff';
    const glElement = k => k.big ? GL_ELEMENT_BIG : GL_ELEMENT[Math.round(k.fan) + 1] || GL_ELEMENT[0];
    // ...and as a look for what it throws, one per colour
    const glLooks = {};
    const glPhLook = k => {
        if (k.fan === undefined) return null;             // the stump throws the usual green
        const ink = glElement(k);
        return glLooks[ink] || (glLooks[ink] = { color: ink, wash: PH_LOOK.wash, glow: PH_LOOK.glow });
    };
    // each element's darker glass, for the back of a mane
    const GL_MANE_DEEP = { '#6faf3a': '#3d6e1c', '#3fc4ff': '#1d6e9a', '#a060ff': '#5a2aa8', '#dfe8ff': '#8a94b8' };
    const GL_MANE_OPEN = 0.55;   // rad either side of straight down a mane leaves open, under the chin
    // A mane is only glass round a head: nothing meets the ball there, so it
    // is see-through (GL_MANE_ALPHA) to say so, and kept small, the big head's
    // bigger than the rest.
    let GL_MANE     = 0.4;       // a small head's mane, as a share of its locks at full length
    let GL_MANE_BIG = 0.56;      // ...and the big head's
    let GL_MANE_ALPHA = 0.55;    // ...and how solid either is
    let GL_MANE_FRESH = 0.35;    // ...the big head's while the pool is full, as a share of it at the last
    LAB_KNOBS.push('GL_MANE', 'GL_MANE_BIG', 'GL_MANE_ALPHA', 'GL_MANE_FRESH');

    // a canvas of `src` recoloured, cached under `key`: 'wash' lifts him to
    // near-white and washes `ink` over only his own pixels, so his shading
    // shows through the colour (shapeSprite's own wash); 'flat' fills him
    function glTint(key, src, ink, kind) {
        const k = 'gl-' + key + kind + ink;
        if (spriteCache.has(k)) return spriteCache.get(k);
        if (!src) return null;
        const c = document.createElement('canvas');
        c.width = src.width; c.height = src.height;
        const g = c.getContext('2d');
        if (kind === 'wash') g.filter = 'grayscale(1) contrast(1.1) brightness(1.95)';
        g.drawImage(src, 0, 0);
        g.filter = 'none';
        g.globalCompositeOperation = 'source-atop';
        g.globalAlpha = kind === 'wash' ? 0.8 : 1;
        g.fillStyle = ink;
        g.fillRect(0, 0, c.width, c.height);
        spriteCache.set(k, c);
        return c;
    }

    // His body in glass: scales, each one his head in glass on a dark copy of
    // itself for its lead, in rows that overlap like a dragon's -- the IDOL's
    // coat, made of light instead of stone. Deep greens with the odd ruby and
    // gold, so it reads as one window rather than as confetti. Baked once.
    const GL_SCALES = ['#16553b', '#1d6b4a', '#237a52', '#2c8a5d'];
    function glGlassBody(body) {
        const k = 'gl-glassbody2';
        if (spriteCache.has(k)) return spriteCache.get(k);
        const lead = headSprite2('flat', GLASS_LEAD);
        if (!lead) return null;
        const c = document.createElement('canvas');
        c.width = body.width; c.height = body.height;
        const g = c.getContext('2d');
        const W = c.width, H = c.height, sw = W / 11, sh = sw * (BALL_RY / BALL_RX);
        let seed = 17, n = 0;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        const rows = Math.ceil(H / (sh * 0.5)) + 2;
        for (let row = 0; row < rows; row++) {
            const y = -sh * 0.3 + row * sh * 0.5;
            // lighter along the middle of him, darker to his edges
            const mid = 1 - Math.abs(y / H - 0.5) * 2;
            for (let x = (row % 2 ? sw * 0.45 : 0) - sw * 0.2; x < W + sw; x += sw * 0.9, n++) {
                let ink = GL_SCALES[Math.min(GL_SCALES.length - 1, Math.max(0, Math.round(mid * 3 + (rnd() - 0.5))))];
                if (n % 17 === 5) ink = '#9a1f2c';
                else if (n % 23 === 11) ink = '#c8962a';
                const face = headSprite2('wash', ink);
                if (!face) return null;
                g.drawImage(lead, x - sw * 0.6, y - sh * 0.6, sw * 1.2, sh * 1.2);
                g.drawImage(face, x - sw / 2, y - sh / 2, sw, sh);
            }
        }
        g.globalCompositeOperation = 'destination-in';
        g.drawImage(body, 0, 0);
        spriteCache.set(k, c);
        return c;
    }

    // His body in the chosen look, and the dark copy of it that sets it
    function glStyledBodySprites(body) {
        if (GL_STYLE === 1) return { lead: glTint('body', body, HER_DARK, 'flat'), face: glTint('body', body, HER_RED, 'wash') };
        return { lead: glTint('body', body, GLASS_LEAD, 'flat'), face: glGlassBody(body) };
    }

    // His body, as solid as `a`: his own, turned about the collar as he always
    // is, or two of him head to head either side of it (GL_STYLE_BODY).
    function glStyleBody(a) {
        if (a <= 0.002) return;
        const body = hlSprite('raw');
        if (!body) return;
        const sp = glStyledBodySprites(body);
        if (!sp.lead || !sp.face) return;
        const shut = gl.stone;
        const lay = (w, h, x, y) => {
            ctx.globalAlpha = a;
            ctx.drawImage(sp.lead, x - w * 0.02, y - h * 0.04, w * 1.04, h * 1.08);
            ctx.globalAlpha = a * (GL_STYLE === 2 ? 0.55 + 0.35 * (1 - shut) : 1);
            ctx.drawImage(sp.face, x, y, w, h);
            // shut: tarnished toward iron on the wyvern, the glass dulled grey on the window
            if (shut > 0.01) {
                const dull = glTint('body', body, GL_STYLE === 1 ? HER_IRON : '#8c8c96', 'wash');
                ctx.globalAlpha = a * shut * (GL_STYLE === 1 ? 0.55 : 0.45);
                if (dull) ctx.drawImage(dull, x, y, w, h);
            }
            if (gl.bodyFlash > 0) {
                const hot = glTint('body', body, GL_STYLE === 1 ? HER_GOLD : '#fff4dc', 'flat');
                ctx.globalAlpha = a * Math.min(1, gl.bodyFlash) * 0.5;
                if (hot) ctx.drawImage(hot, x, y, w, h);
            }
            ctx.globalAlpha = 1;
        };
        // the window's light, behind the glass, breathing slowly
        if (GL_STYLE === 2) {
            const m = glMiddle();
            glLight(m.x, m.y, GL_STYLE_BODY ? GL_BODY_RX * 1.2 : GL_W * 0.45, '#ffe8b8', a * 0.3 * (1 - 0.7 * shut) * (0.9 + 0.1 * Math.sin(clock * 1.1)));
        }
        ctx.save();
        if (GL_STYLE_BODY) {
            // two of him, head to head, the holes their heads left meeting at the collar
            const e = glBodyEll(), w = e.rx * 1.1, h = w / SHAPE_ASPECT;
            ctx.translate(gl.cx, gl.cy);
            ctx.rotate(e.rot);
            for (const side of [-1, 1]) {
                ctx.save();
                ctx.scale(side, 1);
                lay(w, h, -HL_HEAD_U * w, -HL_HEAD_V * h);
                ctx.restore();
            }
        } else {
            const o = glOrigin(), h = GL_W / SHAPE_ASPECT;
            ctx.translate(gl.cx, gl.cy);
            ctx.rotate(gl.tilt);
            lay(GL_W, h, o.x, o.y);
        }
        ctx.restore();
    }

    // A styled neck: still a string of heads, as his necks are, only in the
    // look -- crimson and gold by turns on the wyvern; on the window the
    // head's element, each set on a dark copy of itself.
    function glStyleNeck(k, gs) {
        const hw = GL_HEAD_W * GL_STYLE_HEAD;
        const beads = Math.max(GL_BEADS, Math.round(Math.hypot(k.x - k.ax, k.y - k.ay) / (hw * 0.3)));
        const dark = headSprite2('flat', GL_STYLE === 1 ? HER_DARK : GLASS_LEAD);
        for (let i = 0; i < beads; i++) {
            const t = i / beads, w = hw * (0.45 + 0.35 * t) * gs, h = w * (BALL_RY / BALL_RX);
            const x = k.ax + (k.x - k.ax) * t, y = k.ay + (k.y - k.ay) * t;
            const face = GL_STYLE === 1 ? headSprite2('wash', i % 2 ? HER_GOLD : HER_RED) : headSprite2('wash', glElement(k));
            if (dark) ctx.drawImage(dark, x - w * 0.56, y - h * 0.56, w * 1.12, h * 1.12);
            if (face) {
                ctx.globalAlpha = GL_STYLE === 2 ? 0.85 : 1;
                ctx.drawImage(face, x - w / 2, y - h / 2, w, h);
                ctx.globalAlpha = 1;
            }
        }
    }

    // What a styled head is set in, behind it: on the wyvern a gold copy of
    // the head as its rim and a crown of three little gold heads; on the
    // window a wreath of little heads in its element's glass.
    function glStyleFrame(k, w, h, rot) {
        if (!GL_STYLE || k.grow >= 0) return;
        ctx.save();
        ctx.translate(k.x, k.y);
        ctx.rotate(rot);
        const small = (ink, x, y, s, a) => {
            const dark = headSprite2('flat', GL_STYLE === 1 ? HER_DARK : GLASS_LEAD), face = headSprite2('wash', ink);
            const sw = w * s, sh = sw * (BALL_RY / BALL_RX);
            ctx.save(); ctx.translate(x, y); ctx.rotate(a);
            if (dark) ctx.drawImage(dark, -sw * 0.58, -sh * 0.58, sw * 1.16, sh * 1.16);
            if (face) ctx.drawImage(face, -sw / 2, -sh / 2, sw, sh);
            ctx.restore();
        };
        if (GL_STYLE === 1) {
            for (const [x, s] of [[-0.22, 0.22], [0, 0.27], [0.22, 0.22]]) small(HER_GOLD, x * w, -h * 0.5 - w * s * 0.35, s, x * 0.8);
            const dark = headSprite2('flat', HER_DARK), gold = headSprite2('flat', HER_GOLD);
            if (dark) ctx.drawImage(dark, -w * 0.6, -h * 0.6, w * 1.2, h * 1.2);
            if (gold) ctx.drawImage(gold, -w * 0.56, -h * 0.56, w * 1.12, h * 1.12);
        } else {
            // a mane: locks of him in the head's glass, fanned out from
            // behind the head so it hides their roots -- thick over the top
            // and down the sides, open under the chin, a darker layer behind a
            // brighter one
            const ink = glElement(k), deep = GL_MANE_DEEP[glElement(k)] || ink;
            const lead = shapeSprite('glManeLead', GLASS_LEAD, 200, 200 / SHAPE_ASPECT, true);
            let seed = 7 + Math.round(k.fan * 3) + (k.big ? 50 : 0);
            const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
            for (const [layer, n, len, tone] of [[0, 10, 1.2, deep], [1, 8, 0.9, ink]]) {
                const lock = shapeSprite('glMane' + tone, tone, 200, 200 / SHAPE_ASPECT, false);
                if (!lock || !lead) continue;
                for (let i = 0; i < n; i++) {
                    // round from under one side of the chin, over the top, to the other
                    const a = Math.PI * 0.5 + GL_MANE_OPEN + (i + (layer ? 0.5 : 0) + (rnd() - 0.5) * 0.5) / n * (Math.PI * 2 - GL_MANE_OPEN * 2);
                    // the big head's mane grows as the pool goes, from GL_MANE_FRESH of its size
                    const grow = k.big ? GL_MANE_FRESH + (1 - GL_MANE_FRESH) * glRage(k) : 1;
                    const L = w * len * (k.big ? GL_MANE_BIG : GL_MANE) * grow * (0.8 + rnd() * 0.35), T = L / SHAPE_ASPECT;
                    const r0 = w * 0.22, cx = Math.cos(a) * (r0 + L / 2), cy = Math.sin(a) * (r0 + L / 2) * 1.1;
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(a);
                    if (i % 2) ctx.scale(1, -1);
                    ctx.globalAlpha = GL_MANE_ALPHA;
                    ctx.drawImage(lead, -L * 0.54, -T * 0.62, L * 1.08, T * 1.24);
                    ctx.globalAlpha = GL_MANE_ALPHA * (layer ? 0.95 : 0.85);
                    ctx.drawImage(lock, -L / 2, -T / 2, L, T);
                    ctx.restore();
                }
            }
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
            const e = k.lg.st === 'rear' ? Math.min(1, k.lg.t / glRear(k)) : 1;
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
            if (GL_STYLE) { glStyleNeck(k, gs); continue; }
            const beads = Math.max(GL_BEADS, Math.round(Math.hypot(k.x - k.ax, k.y - k.ay) / (hw * 0.3)));
            for (let i = 0; i < beads; i++) {
                const t = i / beads;
                const w = hw * (0.45 + 0.35 * t) * gs, hgt = w * (BALL_RY / BALL_RX);
                ctx.drawImage(ballImg, k.ax + (k.x - k.ax) * t - w / 2,
                              k.ay + (k.y - k.ay) * t - hgt / 2, w, hgt);
            }
        }
        // turned about the collar and seated on it, so his shoulders are
        // where his necks come out however he is turned
        const o = glOrigin();
        if (GL_STYLE) glStyleBody(1);
        ctx.save();
        ctx.translate(gl.cx, gl.cy);
        ctx.rotate(gl.tilt);
        if (GL_STYLE) ctx.globalAlpha = 0;     // the styled body is drawn above instead
        ctx.drawImage(body, o.x, o.y, GL_W, h);
        // shut, he is stone: a coat of it swelling slowly in and out over him
        const stone = gl.stone > 0.002 && !GL_STYLE ? glStoneBody(body) : null;
        if (stone) {
            const breath = GL_STONE_A0 + (GL_STONE_A1 - GL_STONE_A0) * (0.5 + 0.5 * Math.sin(clock * GL_STONE_HZ * Math.PI * 2));
            ctx.globalAlpha = gl.stone * breath;
            ctx.drawImage(stone, o.x, o.y, GL_W, h);
            ctx.globalAlpha = 1;
        }
        ctx.globalAlpha = 1;
        // struck while open: the same body again, added over itself
        if (gl.bodyFlash > 0 && !GL_STYLE) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = Math.min(1, gl.bodyFlash) * 0.6;
            ctx.drawImage(body, o.x, o.y, GL_W, h);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
        }
        ctx.restore();
        if (GL_LOOK_WINGS) glLookWings();
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
        // what each head is set in, all of them before any head, so none
        // lies over a neighbour
        if (GL_STYLE) {
            for (const k of gl.heads) {
                if (!k.alive) continue;
                const w = GL_HEAD_W * glSize(k) * (k.loose ? GL_LOOSE_SIZE : 1), h = w * (BALL_RY / BALL_RX);
                glStyleFrame(k, w, h, k.loose ? k.rot : k.roll || 0);
            }
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
            const tell = glPhLook(k) || PH_LOOK;
            if (sw > 0) {
                const r = hw * 0.95;
                const g = ctx.createRadialGradient(k.x, k.y, hw * 0.2, k.x, k.y, r);
                g.addColorStop(0, tell.color);
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
                ctx.drawImage(ballImg, -lw / 2, -lh / 2, lw, lh);
                if (k.flash > 0) {
                    ctx.globalAlpha = Math.min(1, k.flash) * 0.7;
                    ctx.drawImage(headSprite2('flat', '#f2efe9'), -lw / 2, -lh / 2, lw, lh);
                }
                ctx.restore();
                continue;
            }
            ctx.save();
            ctx.translate(k.x, k.y);
            if (k.roll) ctx.rotate(k.roll);
            ctx.drawImage(ballImg, -hw / 2, -hh / 2, hw, hh);
            const green = sw > 0 ? phantomSprite(tell) : null;
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
            // not the big head's: its pool is the bar along the top
            const full = k.loose ? GL_LOOSE_HP : GL_HEAD_HP;
            if (!k.big && k.hp < full) labBar(k.x - hw * 0.35, k.y - hh / 2 - 7, hw * 0.7, k.hp / full, 3);
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