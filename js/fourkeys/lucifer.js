'use strict';

    // ---- LUCIFER (boss) ---------------------------------------------------------------
    // The VOID's end, and the game's. The Fallen, as the memories draw him: a
    // body with a ball for a head, and arms of bone that are each nine little
    // brandons. Those eighteen pieces are the fight. Each arm leaves his
    // shoulder whenever it likes, flies apart and puts itself back together as
    // something else, and always comes home to being an arm:
    //
    //   CLAW   an open hand that follows the head and catches it: a moment
    //          held, SLUGGISH on you, and thrown where you are not
    //   PALM   laid flat into a paddle of his own, meeting shots from below
    //   FIST   balled up over you, following you, then down: under it and
    //          you are SLUGGISH
    //   CAGE   a ring of bone turning round his head
    //   CLAP   both hands, open either side of the head's way up, shut on
    //          it as it arrives. They reach through it, so they are no wall
    //   WINGS  both arms fanned out beside him, a feather at a time
    //
    // Hits on him hurt him. Hits on a hand put that hand back together as an
    // arm after LU_FORM_HP of them; a feather, or a piece of his halo, is
    // knocked clean off and grows back.
    //
    // What a hit can do is on the picture: anything it would do nothing to
    // is stone -- his body while he is out of reach, an arm at rest, the
    // halo before the last part -- and the clap, which a head goes straight
    // through, is only half there. Flesh and clay are worth hitting.
    //
    // He never heals. His bar fills twice, once at the start of each part
    // after the first, and never otherwise; every hit on him or on the hand
    // in the drain is for good, so no part of this can go on forever.
    //
    //   one    the Fallen, one hand at a time
    //   two    both hands at once, and the two-handed shapes
    //   drain  a hand reaches out over the field and a stream of your light
    //          runs up it into him: the way he took from HIM, only this time
    //          you can fight it. The hand is the bar at the top now, and he
    //          is stone. Your light is a bar under you, running out: empty and
    //          it costs you a head and fills again, and the hand keeps every
    //          hit it has taken. Break the hand and the stream turns round,
    //          and it is him running out into you
    //   three  the Angel again, in a black aura that swells: while it is
    //          swollen nothing reaches him. His head is red; his body is
    //          grey, and withers up into his head as he is
    //          hurt while the head and halo grow on what it gives up, until, with
    //          LU_SHED_AT of him left, it drops off and falls away, eyes open
    //          all over his face, and only the head is left to hit. The pieces ride a halo over his head
    //          and come down from it faster. Knock them out of the halo and
    //          whatever he makes next is made without them.
    //
    // He dies saying so. What happens to you after is the VOID's, not his.
    let LU_LVL        = 6;
    let LU_HP1        = 8;      // hits to end the first part
    let LU_HP2        = 10;     // ...the second
    let LU_HP3        = 12;     // ...and the last
    let LU_L          = 230;    // how tall he stands
    let LU_Y          = 210;    // where his middle hangs
    let LU_DRIFT      = 110;    // px he drifts either side
    let LU_DRIFT_RATE = 0.3;    // rad/s of that
    let LU_HOME       = 150;    // px out from him a hand waits, between shapes
    let LU_FORM_HP    = 3;      // hits that put a hand back together as an arm
    let LU_FORM_SECS  = 9;      // how long he holds a shape, unbroken
    let LU_REST       = 1.6;    // seconds between one shape and the next
    let LU_REFORM     = 0.5;    // seconds a piece takes to fly to a new place
    let LU_STAGGER    = 0.25;   // ...the shoulder first and the fingertip this much later
    let LU_PACE2      = 1.2;    // how much quicker everything is in the second part
    let LU_PACE3      = 1.45;   // ...and the last
    let LU_CLAW_Y     = 300;    // the line the claw hunts along
    let LU_CLAW_SPEED = 170;    // px/s it follows the head
    let LU_CLAW_HOLD  = 0.9;    // seconds it holds one
    let LU_CLAW_DRAG  = 2.5;    // SLUGGISH a catch leaves on you
    let LU_PALM_Y     = 340;    // the line his own paddle lies on
    let LU_PALM_SPEED = 260;    // px/s it moves to meet a head
    let LU_FIST_Y     = 250;    // where the fist hangs while it follows you
    let LU_FIST_TRACK = 220;    // px/s it follows you
    let LU_FIST_AIM   = 1.6;    // seconds it follows before it drops
    let LU_FIST_G     = 2600;   // px/s² it falls at
    let LU_FIST_REST  = 0.7;    // seconds it lies on the floor
    let LU_FIST_RISE  = 380;    // px/s it goes back up
    let LU_FIST_SLAMS = 2;      // drops in one shape
    let LU_FIST_DRAG  = 3;      // SLUGGISH it leaves on you
    let LU_FIST_R     = 34;     // how far either side of its middle it lands on you
    let LU_CAGE_R     = 80;     // px round his head the cage turns
    let LU_CAGE_SPIN  = 1.1;    // rad/s of that
    let LU_CAGE_SECS  = 10;     // how long it stays up, unbroken
    let LU_CLAP_Y     = 310;    // the line the clap waits on
    let LU_CLAP_GAP   = 150;    // px either side of the middle the hands wait open
    let LU_CLAP_SHUT  = 0.22;   // seconds to shut
    let LU_CLAP_REACH = 150;    // px below them a head can set them off from
    let LU_WING_SECS  = 10;     // how long the wings stay out
    let LU_REGROW     = 6;      // seconds a knocked-off piece takes to grow back
    let LU_DRAIN_HP   = 6;      // hits on the hand holding the stream to turn it
    let LU_DRAIN_SECS = 14;     // seconds your light lasts, full to empty
    let LU_DRAIN_Y    = 270;    // the line the hand holding the stream sweeps along
    let LU_DRAIN_SWEEP = 260;   // px either side of him it sweeps
    let LU_DRAIN_RATE_X = 0.5;  // rad/s of that
    let LU_TURN       = 4.2;    // seconds the stream runs back into you
    let LU_BREAK      = 1.4;    // seconds between the first part and the second
    let LU_PULSE_EVERY = 5.5;   // seconds from one swell of the aura to the next
    let LU_PULSE_SECS = 1.8;    // ...and how long each keeps him out of reach
    let LU_AURA       = 150;    // px the aura reaches, calm
    let LU_AURA_SWELL = 1.6;    // ...and how much further, swollen
    let LU_DIE_TYPE   = 16;     // letters a second, his last words
    let LU_DIE_HOLD   = 1.8;    // seconds on them before he goes
    let LU_ODIN_GLOW  = 0.55;   // how bright HIS light is under you
    let LU_WITHER     = 0.6;    // his body's size, as a share of him, by the time it drops off
    let LU_SHED_AT    = 0.5;    // share of the last part's health left when it does
    let LU_SLUMP      = 12;     // degrees his body sags off his head, withered all the way
    let LU_HEAD_GROW  = 0.8;    // how much bigger his head is, withered all the way
    let LU_HALO_GROW  = 0.4;    // ...and his halo
    let LU_SHED_FALL  = 1.6;    // seconds it takes to fall away
    LAB_KNOBS.push('LU_LVL', 'LU_HP1', 'LU_HP2', 'LU_HP3', 'LU_L', 'LU_Y', 'LU_DRIFT', 'LU_DRIFT_RATE',
                   'LU_HOME', 'LU_FORM_HP', 'LU_FORM_SECS', 'LU_REST', 'LU_REFORM', 'LU_STAGGER',
                   'LU_PACE2', 'LU_PACE3', 'LU_CLAW_Y', 'LU_CLAW_SPEED', 'LU_CLAW_HOLD', 'LU_CLAW_DRAG',
                   'LU_PALM_Y', 'LU_PALM_SPEED', 'LU_FIST_Y', 'LU_FIST_TRACK', 'LU_FIST_AIM', 'LU_FIST_G',
                   'LU_FIST_REST', 'LU_FIST_RISE', 'LU_FIST_SLAMS', 'LU_FIST_DRAG', 'LU_FIST_R',
                   'LU_CAGE_R', 'LU_CAGE_SPIN', 'LU_CAGE_SECS', 'LU_CLAP_Y', 'LU_CLAP_GAP', 'LU_CLAP_SHUT',
                   'LU_CLAP_REACH', 'LU_WING_SECS', 'LU_REGROW', 'LU_DRAIN_HP', 'LU_DRAIN_SECS',
                   'LU_DRAIN_Y', 'LU_DRAIN_SWEEP', 'LU_DRAIN_RATE_X', 'LU_TURN', 'LU_BREAK',
                   'LU_PULSE_EVERY', 'LU_PULSE_SECS', 'LU_AURA', 'LU_AURA_SWELL', 'LU_DIE_TYPE',
                   'LU_DIE_HOLD', 'LU_ODIN_GLOW', 'LU_WITHER', 'LU_SHED_AT', 'LU_SLUMP', 'LU_HEAD_GROW', 'LU_HALO_GROW', 'LU_SHED_FALL');

    // The shapes, in the order he makes them, one list for each part. A move
    // is what each hand does (L, R) or what both do together (B); the next
    // one starts once every hand in the last has come home.
    const LU_MOVES = {
        1: [{ L: 'claw' }, { R: 'palm' }, { L: 'fist' }, { R: 'claw' }, { L: 'palm' }, { R: 'fist' }],
        2: [{ L: 'claw', R: 'fist' }, { L: 'cage', R: 'palm' }, { B: 'clap' }, { L: 'fist', R: 'claw' },
            { B: 'wings' }, { L: 'palm', R: 'cage' }, { L: 'fist', R: 'fist' }],
        3: [{ L: 'fist' }, { R: 'claw' }, { B: 'clap' }, { L: 'palm', R: 'fist' }, { B: 'wings' },
            { L: 'claw', R: 'fist' }, { L: 'cage', R: 'palm' }]
    };
    const LU_LAST = 'It is finished. My world is...';

    // His rig, as the memories draw him (memory.js), at LU_RIG tall: the
    // numbers are the same so the two stay one person. A pose is a lean in
    // degrees and where the ball sits on his shoulders; bones are [length,
    // degrees, thickness], 0 pointing right and -90 up, the left the mirror.
    const LU_RIG = 360;
    const LU_FALLEN = { lean: 14, headDx: 10, headDy: -12, headTurn: -15.5, headSway: 9.5, headSize: 1.3 };
    const LU_ANGEL  = { lean: 3,  headDx: 3,  headDy: -22, headTurn: 0,     headSway: 2.5, headSize: 1.3 };
    const LU_SHOULDER = [0.80, 0.42];
    const LU_BONES = {
        arm0: [95, 30, 40], arm1: [110, -75, 36], palm: [42, -100, 38],
        f10: [52, -112, 27], f11: [42, -152, 23], f12: [32, -192, 19],
        f20: [46, -80, 25], f21: [38, -122, 21], f22: [28, -166, 17]
    };
    // each piece of an arm: the ring of the halo it rides, and when in a
    // re-forming it sets off (0 the shoulder, 1 the fingertips)
    const LU_PIECES = [['arm0', 0, 0], ['arm1', 0, 0.2], ['palm', 0, 0.4],
                       ['f10', 1, 0.6], ['f11', 1, 0.8], ['f12', 2, 1],
                       ['f20', 1, 0.6], ['f21', 2, 0.8], ['f22', 2, 1]];
    const LU_HALO = [
        { rx: 70,  ry: 22, lift: 10, tilt: -6, speed: 1,     bob: 4 },
        { rx: 104, ry: 31, lift: 36, tilt: 7,  speed: -0.72, bob: 6 },
        { rx: 136, ry: 40, lift: 62, tilt: -4, speed: 0.52,  bob: 8 }
    ];
    const LU_HALO_PERIOD = 7;        // seconds for the inner ring to go round
    // bigger than the memories draw them: here they are something to aim at
    const LU_HALO_SIZE = 0.66, LU_HALO_NEAR = 0.14;
    const LU_CLAY = '#c48a6c';       // the Fallen's bones, the memories' clay
    const LU_REDS = ['#c21f32', '#8f1424', '#d8402c'];
    const LU_RED_BODY = '#c4182c';   // his head, once he is the Angel again
    const LU_GREY_BODY = '#4f4a45';  // ...and his body, withering under it
    const LU_EYES = [[0.29, 0.52], [0.63, 0.51]];   // his eyes in ball.webp, as shares of it
    // ...and where more open once his body has gone: brow, temples, beside his
    // nose, cheeks, jaw, chin
    const LU_MORE_EYES = [[0.40, 0.30], [0.60, 0.28], [0.24, 0.37], [0.76, 0.36], [0.14, 0.52], [0.85, 0.50],
                          [0.46, 0.43], [0.35, 0.65], [0.69, 0.63], [0.52, 0.86], [0.22, 0.73], [0.80, 0.72]];
    const LU_GOLD = '#e8b64c';       // HIS, which you take back
    const LU_REST_FORMS = ['arm', 'halo'];
    const LU_BREAKS = ['claw', 'palm', 'fist', 'cage'];

    let lu = null;

    LAB_BOSS.lucifer = {
        start: luStart,
        reset() { lu = null; },
        update: luUpdate,
        contact: luContact,
        touch: luTouch,
        glances: luGlances,
        hit: luHit,
        draw: luDraw,
        drawFall: luDrawFall,
        holds(ball) { return !!lu && (lu.frozen.has(ball) || lu.hands.some(h => h.held === ball)); },
        climb() { return 0; },
        // the lab's jumps, straight to the start of each part
        acts: {
            one(b) { luJump(b, 1); return true; },
            two(b) { luJump(b, 2); return true; },
            drain(b) { luJump(b, 2); b.hp = 0; luNext(b); return true; },
            three(b) { luJump(b, 3); return true; },
            // one hit from his last words: withered, and his body already gone
            last(b) { luJump(b, 3); b.hp = 1; lu.wither = LU_WITHER; luPose(); luShed(); lu.shed.t = LU_SHED_FALL; return true; }
        },
        finish(b) {
            if (lu.stage === 'drain') lu.handHp = Math.min(lu.handHp, 1);
            else b.hp = Math.min(b.hp, 1);
            return true;
        },
        state(b) {
            const what = h => h.form + (h.form === 'fist' ? ' ' + h.st : '') + (h.hits ? ' ×' + h.hits : '');
            return { name: 'LUCIFER', hp: b.hp, max: b.maxHp,
                     line: 'part ' + lu.stage + (lu.stage === 'drain' ? ' · hand ' + lu.handHp + ' · your light ' + Math.round(lu.light * 100) + '%' : '') +
                           ' · L ' + what(lu.hands[0]) + ' · R ' + what(lu.hands[1]) +
                           (luArmoured() ? ' · out of reach' : '') };
        }
    };

    function luStart(b) {
        b.hp = b.maxHp = LU_HP1;
        bossServed = true;              // he says nothing until the end
        lu = { t: 0, x: LW / 2, y: -LU_L, stage: 1, stT: 0, mi: 0, restT: LU_REST, handHp: 0, light: 1, stone: 0,
               wither: 1, shed: null,
               pulseT: 0, frozen: new Map(), motes: [], moteAcc: 0, slams: [], clap: null, pend: null,
               bd: null, pieces: [], hands: [-1, 1].map(side => ({ side, form: 'arm', t: 0, hits: 0,
                   done: false, st: '', stT: 0, x: LW / 2 + side * LU_HOME, y: LU_Y, vy: 0, open: 0,
                   held: null, holdT: 0, slams: 0 })) };
        for (const side of [-1, 1]) {
            LU_PIECES.forEach(([bone, ring, order], i) => lu.pieces.push({
                side, i, bone, ring, order, len: LU_BONES[bone][0], thick: LU_BONES[bone][2],
                x: 0, y: 0, a: 0, s: 1, from: null, k: 1, delay: 0, flash: 0, gone: 0, stone: 1,
                fvx: 0, fvy: 0, fva: 0, back: false, slot: 0 }));
        }
        // where each piece sits on its ring of the halo: evenly round it,
        // both arms' pieces together
        LU_HALO.forEach((r, ri) => {
            const on = lu.pieces.filter(p => p.ring === ri);
            on.forEach((p, j) => { p.slot = j / on.length * 2 * Math.PI + ri * 1.3; });
        });
        luBox(b);
        luPose();
        for (const p of lu.pieces) Object.assign(p, luSlot(p));
    }

    // the box the physics looks in: the whole field above the floor, since
    // his hands go anywhere in it
    function luBox(b) {
        b.x = 0; bw = LW;
        b.y = 0; bh = Math.max(100, padY() - padH() - 30);
    }

    const luEase = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    const luLerp = (a, b, k) => a + (b - a) * k;
    const luAng = (a, b, k) => a + (((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) * k;
    const luToward = (x, to, step) => x + Math.max(-step, Math.min(step, to - x));
    function luHand(side) { return lu.hands[side < 0 ? 0 : 1]; }
    function luPace() { return lu.stage === 3 || lu.stage === 'dying' ? LU_PACE3 : lu.stage === 1 ? 1 : LU_PACE2; }
    function luRestForm() { return lu.stage === 3 || lu.stage === 'turn' || lu.stage === 'dying' ? 'halo' : 'arm'; }
    function luActive(h) { return !LU_REST_FORMS.includes(h.form); }

    // how far into being the Angel again he is: 0 the Fallen, 1 red
    function luRed() {
        if (lu.stage === 3 || lu.stage === 'dying') return 1;
        if (lu.stage === 'turn') return luEase(lu.stT / LU_TURN);
        return 0;
    }

    // Nothing reaches him while the aura is swollen, or in the breath between
    // parts, or while the stream runs: then the hand holding it is the only
    // thing worth hitting.
    function luPulse() {
        if (lu.stage !== 3) return 0;
        const c = lu.pulseT % LU_PULSE_EVERY;
        return c < LU_PULSE_SECS ? Math.sin(Math.PI * c / LU_PULSE_SECS) : 0;
    }
    function luArmoured() {
        if (['break', 'drain', 'turn', 'dying'].includes(lu.stage)) return true;
        return lu.stage === 3 && lu.pulseT % LU_PULSE_EVERY < LU_PULSE_SECS;
    }

    // ---- his body --------------------------------------------------------------------
    // a point on a body stood up on his boot with his middle at (x, y), L tall
    function luOnBody(x, y, L, lean, u, v) {
        const A = -Math.PI / 2 + lean, T = L / SHAPE_ASPECT;
        const lx = (u - 0.5) * L, ly = (v - 0.5) * T;
        return [x + lx * Math.cos(A) - ly * Math.sin(A), y + lx * Math.sin(A) + ly * Math.cos(A)];
    }

    // where everything of him is this frame, worked out once: the Fallen's
    // hunch easing up into the Angel's float as he turns
    //
    // His body withers (lu.wither), shrinking up into his head: the head
    // never moves, and the body hangs from where his neck meets it, sagging
    // off it as it goes and shrunk toward it, so it is his feet that come up.
    // What the body gives up goes into the head and the halo round it, which
    // grow by LU_HEAD_GROW and LU_HALO_GROW. Once shed there is no body at all. L, T and
    // sc are his rig's, which the hands are measured by; bx, by, bL, bT and
    // bLean are the body's own.
    function luPose() {
        const k = luRed(), L = LU_L, sc = L / LU_RIG, T = L / SHAPE_ASPECT;
        const pose = {};
        for (const key of Object.keys(LU_FALLEN)) pose[key] = luLerp(LU_FALLEN[key], LU_ANGEL[key], k);
        const lean = pose.lean * Math.PI / 180;
        const x = lu.x, y = lu.y + k * 5 * sc * Math.sin(clock * Math.PI / 2);
        const w = lu.wither, into = Math.min(1, (1 - w) / Math.max(0.01, 1 - LU_WITHER));
        const grow = 1 + LU_HEAD_GROW * into, haloGrow = 1 + LU_HALO_GROW * into;
        const [ax, ay] = luOnBody(x, y, L, lean, HL_HEAD_U, HL_HEAD_V);
        const tilt = LU_SLUMP * into * Math.PI / 180;
        const bx = ax + w * ((x - ax) * Math.cos(tilt) - (y - ay) * Math.sin(tilt));
        const by = ay + w * ((x - ax) * Math.sin(tilt) + (y - ay) * Math.cos(tilt));
        const period = luLerp(1.8, 5, k);
        const hw = HL_HEAD_W * L * pose.headSize * grow;
        lu.bd = { x, y, L, T, sc, lean, pose, haloGrow, bx, by, bL: L * w, bT: L * w / SHAPE_ASPECT,
                  bLean: lean + tilt, shed: !!lu.shed,
                  hx: ax + pose.headDx * sc, hy: ay + pose.headDy * sc, hw, hh: hw * BALL_RY / BALL_RX,
                  ha: lean + (pose.headTurn + pose.headSway * Math.sin(clock * 2 * Math.PI / period)) * Math.PI / 180 };
    }

    // how withered his body should be by now: whole until the last part, then
    // shrinking with his health down to LU_WITHER as it comes loose
    function luWitherFor(b) {
        if (lu.stage !== 3 && lu.stage !== 'dying') return 1;
        const hurt = 1 - b.hp / Math.max(1, b.maxHp);
        return 1 - (1 - LU_WITHER) * Math.min(1, hurt / Math.max(0.01, 1 - LU_SHED_AT));
    }

    // it lets go, and falls
    function luShed() {
        const d = lu.bd;
        lu.shed = { t: 0, x: d.bx, y: d.by, L: d.bL, T: d.bT, lean: d.bLean };
    }

    // a shoulder, in the field
    function luShoulder(side) {
        const d = lu.bd;
        // with no body left, the arms reach back to the head instead
        if (d.shed) return [d.hx + side * d.hw * 0.6, d.hy + d.hh * 0.4];
        const [sx, sy] = luOnBody(d.bx, d.by, d.bL, d.bLean, LU_SHOULDER[0], LU_SHOULDER[1]);
        return [sx + side * d.bT * 0.3, sy];
    }

    // ---- where a piece belongs -------------------------------------------------------
    // A chain of bones from (x, y): each [bone, degrees] turns to its own
    // angle, and each starts where the last ended. Degrees are for the right
    // hand; the left is the mirror. Hands back each piece's place by name.
    function luChain(side, x, y, links, scale, out) {
        const sc = lu.bd.sc * scale;
        for (const [bone, deg] of links) {
            const d = deg * Math.PI / 180, a = side > 0 ? d : Math.PI - d;
            const len = LU_BONES[bone][0] * sc;
            out[bone] = { x: x + Math.cos(a) * len / 2, y: y + Math.sin(a) * len / 2, a, s: scale };
            x += Math.cos(a) * len; y += Math.sin(a) * len;
        }
        return [x, y];
    }

    // The arm, hanging off his shoulder and moving the way the memories move
    // it: the shoulder swings, the elbow gives half of it back, the wrist
    // follows late and the fingers curl in a wave out to the tips.
    function luArm(side) {
        const t = clock, ph = side > 0 ? 0 : 0.37;
        const wave = (period, off) => Math.sin(2 * Math.PI * (t / period + off));
        const arm = wave(2.6, ph);
        const out = {};
        const [sx, sy] = luShoulder(side);
        const B = LU_BONES;
        let [x, y] = luChain(side, sx, sy, [['arm0', B.arm0[1] + 14 * arm]], 1, out);
        [x, y] = luChain(side, x, y, [['arm1', B.arm1[1] + 7 * arm]], 1, out);
        const wrist = B.palm[1] + 7 * arm + 5.6 * wave(2.6, ph - 0.15);
        [x, y] = luChain(side, x, y, [['palm', wrist]], 1, out);
        const curl = (f, k) => -15 * wave(1.4, ph - f * 0.2 - k * 0.12);
        let acc = wrist - B.palm[1];
        for (const [f, names] of [[0, ['f10', 'f11', 'f12']], [1, ['f20', 'f21', 'f22']]]) {
            let fx = x, fy = y, a = acc;
            names.forEach((n, k) => {
                a += curl(f, k);
                [fx, fy] = luChain(side, fx, fy, [[n, B[n][1] + a]], 1, out);
            });
        }
        out.arm0.back = true;            // the upper arm comes out of his back
        return out;
    }

    // Over his head, three tilted rings turning against each other. Pieces on
    // the far side of a ring are behind him.
    function luHaloSlot(p) {
        const d = lu.bd, r = LU_HALO[p.ring], sc = d.sc * d.haloGrow;
        const spin = clock * 2 * Math.PI / LU_HALO_PERIOD;
        const breathe = 1 + 0.06 * Math.sin(clock * 0.7 + p.ring * 2);
        const th = p.slot + spin * r.speed;
        const rx = r.rx * sc * breathe, ry = r.ry * sc * breathe, tilt = r.tilt * Math.PI / 180;
        const ox = Math.cos(th) * rx, oy = Math.sin(th) * ry;
        const cy = d.hy - (40 + r.lift) * sc + Math.sin(clock * 0.9 + p.ring * 1.7) * r.bob * sc;
        const depth = Math.sin(th);
        return { x: d.hx + ox * Math.cos(tilt) - oy * Math.sin(tilt), y: cy + ox * Math.sin(tilt) + oy * Math.cos(tilt),
                 a: Math.atan2(ry * Math.cos(th), -rx * Math.sin(th)) + tilt,
                 s: (LU_HALO_SIZE + LU_HALO_NEAR * depth) * d.haloGrow, back: depth < 0 };
    }

    // An open hand hanging palm down, the two fingers either side of where a
    // head would go, the forearm reaching back up toward his shoulder. `open`
    // 0 is shut on something.
    function luClawShape(h) {
        const out = {}, sc = lu.bd.sc, o = h.open;
        const pl = LU_BONES.palm[0] * sc;
        out.palm = { x: h.x, y: h.y, a: 0, s: 1 };
        luForearm(h, h.x, h.y - LU_BONES.palm[2] * sc * 0.4, 1, out);
        luChain(1, h.x - pl / 2, h.y, [['f10', 100 + 30 * o], ['f11', 86 + 12 * o], ['f12', 58]], 1, out);
        luChain(1, h.x + pl / 2, h.y, [['f20', 80 - 30 * o], ['f21', 94 - 12 * o], ['f22', 122]], 1, out);
        return out;
    }
    // the hollow of the claw, where a head is caught
    function luPocket(h) {
        const sc = lu.bd.sc;
        return { x: h.x, y: h.y + 44 * sc, r: 30 * sc };
    }

    // flat, end to end, the fingertips at either end: a paddle
    const LU_BAR = ['f12', 'f11', 'f10', 'arm0', 'palm', 'arm1', 'f20', 'f21', 'f22'];
    function luPalmShape(h) {
        const out = {}, sc = lu.bd.sc;
        const step = n => LU_BONES[n][0] * sc * 0.72;
        let x = h.x - LU_BAR.reduce((s, n) => s + step(n), 0) / 2;
        LU_BAR.forEach((n, i) => {
            out[n] = { x: x + step(n) / 2, y: h.y + (i % 2 ? 2 : -2), a: 0, s: 1, flip: i % 2 === 1 };
            x += step(n);
        });
        return out;
    }
    // a knot of all nine, churning
    function luFistShape(h) {
        const out = {};
        LU_PIECES.forEach(([n], i) => {
            const th = i / 9 * 2 * Math.PI + clock * 1.3 * h.side;
            const r = (i % 3 === 0 ? 12 : 26) * lu.bd.sc * 1.5;
            out[n] = { x: h.x + Math.cos(th) * r, y: h.y + Math.sin(th) * r, a: th + Math.PI / 2, s: 1.25 };
        });
        return out;
    }
    // round his head, lying along the ring, turning the way the hand's side says
    function luCageShape(h) {
        const out = {}, d = lu.bd;
        LU_PIECES.forEach(([n], i) => {
            const th = i / 9 * 2 * Math.PI + clock * LU_CAGE_SPIN * h.side + (h.side < 0 ? Math.PI / 9 : 0);
            out[n] = { x: d.hx + Math.cos(th) * LU_CAGE_R, y: d.hy + Math.sin(th) * LU_CAGE_R * 0.95,
                       a: th + Math.PI / 2, s: 0.95 };
        });
        return out;
    }
    // stood on its edge facing the other hand, fingers reaching across
    function luClapShape(h) {
        const out = {}, sc = lu.bd.sc, s = h.side;
        const pl = LU_BONES.palm[0] * sc;
        out.palm = { x: h.x, y: h.y, a: Math.PI / 2, s: 1 };
        luForearm(h, h.x + s * LU_BONES.palm[2] * sc * 0.4, h.y, 1, out);
        luChain(-s, h.x, h.y - pl / 2, [['f10', -12], ['f11', 2], ['f12', 18]], 1, out);
        luChain(-s, h.x, h.y + pl / 2, [['f20', 12], ['f21', -2], ['f22', -18]], 1, out);
        return out;
    }
    // spread from behind his shoulders, up and out, each feather further out
    // than the one above it, beating slowly
    function luWingShape(h) {
        const out = {}, s = h.side;
        const [sx, sy] = luShoulder(s);
        const beat = 6 * Math.sin(clock * 1.4);
        LU_PIECES.forEach(([n], i) => {
            const deg = -80 + i * 14 + beat * (1 - i / 9) + 3 * Math.sin(clock * 1.6 + i * 0.7);
            const a = s > 0 ? deg * Math.PI / 180 : Math.PI - deg * Math.PI / 180;
            const r = 40 + i * 9;
            out[n] = { x: sx + Math.cos(a) * r, y: sy + Math.sin(a) * r, a, s: 1.5, back: true };
        });
        return out;
    }
    // Reaching for you: the palm on its edge, fingers pointing down at you,
    // the forearm reaching back up toward him.
    function luReachShape(h) {
        const out = {}, sc = lu.bd.sc;
        const pl = LU_BONES.palm[0] * sc;
        out.palm = { x: h.x, y: h.y, a: Math.PI / 2, s: 1 };
        luForearm(h, h.x, h.y - pl / 2, 1.5, out);
        luChain(1, h.x - 5, h.y + pl / 2, [['f10', 96], ['f11', 90], ['f12', 84]], 1, out);
        luChain(1, h.x + 5, h.y + pl / 2, [['f20', 84], ['f21', 90], ['f22', 96]], 1, out);
        return out;
    }
    const LU_SHAPES = { claw: luClawShape, palm: luPalmShape, fist: luFistShape, cage: luCageShape,
                        clap: luClapShape, wings: luWingShape, reach: luReachShape };

    // the two arm bones from (x, y) back up toward his shoulder, so a hand
    // that has flown out still reads as his
    function luForearm(h, x, y, scale, out) {
        const [sx, sy] = luShoulder(h.side);
        const deg = Math.atan2(sy - y, sx - x) * 180 / Math.PI;
        luChain(1, x, y, [['arm1', deg], ['arm0', deg]], scale, out);
    }

    // where a piece is going this frame, whatever its hand is doing
    function luSlot(p) {
        const h = luHand(p.side);
        if (h.form === 'halo') return luHaloSlot(p);
        if (h.form === 'arm') return luArmCache(p.side)[p.bone];
        if (!h.shape || h.shapeT !== clock) { h.shape = LU_SHAPES[h.form](h); h.shapeT = clock; }
        return h.shape[p.bone];
    }
    function luArmCache(side) {
        const h = luHand(side);
        if (!h.arm || h.armT !== clock) { h.arm = luArm(side); h.armT = clock; }
        return h.arm;
    }

    // A hand takes a new shape: every piece of it sets off from wherever it
    // is now, the shoulder first and the fingertips last.
    function luForm(h, form) {
        const palm = lu.pieces.find(p => p.side === h.side && p.bone === 'palm');
        Object.assign(h, { form, t: 0, hits: 0, done: false, st: 'aim', stT: form === 'fist' ? -Math.random() * 0.8 : 0,
                           slams: 0, open: 0, vy: 0, x: palm.x, y: palm.y, shape: null });
        if (h.held) { luThrow(h.held); h.held = null; }
        for (const p of lu.pieces) {
            if (p.side !== h.side || p.gone) continue;
            p.from = { x: p.x, y: p.y, a: p.a, s: p.s };
            p.k = 0;
            p.delay = p.order * LU_STAGGER;
        }
    }

    // A bone a hit would do nothing to: an arm at rest, or the halo before the
    // last part. It is stone, and a hit on it glances.
    function luInert(p) {
        const f = luHand(p.side).form;
        return f === 'arm' || (f === 'halo' && lu.stage !== 3);
    }
    const LU_STONE_SECS = 0.2;       // stone coming over a bone, or going

    function luPieceStep(p, dt) {
        p.flash = Math.max(0, p.flash - dt * 4);
        p.stone = luToward(p.stone, luInert(p) ? 1 : 0, dt / LU_STONE_SECS);
        if (p.gone) {
            // knocked off: it falls, and fades, and after LU_REGROW it flies
            // back from wherever it fell to wherever it belongs by then
            p.gone += dt;
            p.x += p.fvx * dt; p.y += p.fvy * dt; p.a += p.fva * dt;
            p.fvy += 900 * dt;
            if (p.gone >= LU_REGROW) {
                p.gone = 0;
                p.from = { x: p.x, y: Math.min(p.y, LH + 30), a: p.a, s: 0.2 };
                p.k = 0; p.delay = 0;
            }
            return;
        }
        const to = luSlot(p);
        p.back = !!to.back;
        p.flip = to.flip !== undefined ? to.flip : p.i % 2 === 1;
        if (p.k >= 1 || !p.from) { p.x = to.x; p.y = to.y; p.a = to.a; p.s = to.s; return; }
        if ((p.delay -= dt) > 0) return;
        p.k = Math.min(1, p.k + dt / LU_REFORM);
        const e = luEase(p.k), f = p.from;
        // a bow on the way, so they fly rather than slide
        const bow = Math.sin(e * Math.PI) * 30 * (p.i % 2 ? 1 : -1);
        p.x = luLerp(f.x, to.x, e) + bow; p.y = luLerp(f.y, to.y, e);
        p.a = luAng(f.a, to.a, e); p.s = luLerp(f.s, to.s, e);
    }

    function luKnock(p, nx, ny) {
        p.gone = 1e-6;
        p.fvx = -nx * 160 + (Math.random() - 0.5) * 80;
        p.fvy = -ny * 160 - 60;
        p.fva = (Math.random() - 0.5) * 8;
    }

    // ---- what he does ----------------------------------------------------------------
    function luUpdate(b, dt) {
        luBox(b);
        const live = phase === 'play';
        if (phase === 'entrance') {
            const e = luEase(enterK());
            lu.x = LW / 2;
            lu.y = -LU_L + (LU_Y + LU_L) * e;
        } else {
            if (live && lu.stage !== 'turn' && lu.stage !== 'dying') lu.t += dt;
            lu.x = LW / 2 + Math.sin(lu.t * LU_DRIFT_RATE) * LU_DRIFT;
            lu.y = LU_Y;
        }
        lu.wither = luToward(lu.wither, luWitherFor(b), dt * 0.5);
        if (lu.shed) lu.shed.t += dt;
        luPose();
        lu.stone = luToward(lu.stone, luArmoured() ? 1 : 0, dt / LU_STONE_SECS);
        if (live) luStage(b, dt);
        // a head lost from under him is not his to hold any more
        for (const h of lu.hands) if (h.held && !balls.includes(h.held)) h.held = null;
        for (const [ball] of lu.frozen) if (!balls.includes(ball)) lu.frozen.delete(ball);
        for (const ball of balls) if (ball.luPass && ball.vy < 0) ball.luPass = false;
        for (const p of lu.pieces) luPieceStep(p, dt);
        luHeld();
        luMoteStep(dt);
        lu.slams = lu.slams.filter(s => (s.t += dt) < 0.6);
    }

    function luStage(b, dt) {
        const pace = luPace();
        lu.stT += dt;
        if (lu.stage === 'break') {
            if (lu.stT >= LU_BREAK) {
                lu.stage = 2; lu.stT = 0; lu.mi = 0; lu.restT = LU_REST / pace;
                b.hp = b.maxHp = LU_HP2;
            }
            return;
        }
        if (lu.stage === 'turn') {
            if (lu.stT >= LU_TURN) {
                lu.stage = 3; lu.stT = 0; lu.mi = 0; lu.restT = LU_REST / pace;
                b.hp = b.maxHp = LU_HP3;
                luThaw();
            }
            return;
        }
        if (lu.stage === 'dying') {
            if (lu.stT >= LU_LAST.length / LU_DIE_TYPE + LU_DIE_HOLD) luPerish(b);
            return;
        }
        if (lu.stage === 3) lu.pulseT += dt;
        if (lu.stage === 'drain') luDrain(dt);
        for (const h of lu.hands) luHandStep(h, dt, pace);
        luDirect(dt, pace);
    }

    // the next shape, once every hand has come home and had its rest
    function luDirect(dt, pace) {
        if (lu.stage === 'drain') {
            // one hand holds the stream; the other keeps coming down on you
            const r = lu.hands.find(h => h.form !== 'reach');
            if (!luActive(r) && (lu.restT -= dt) <= 0) { luForm(r, 'fist'); lu.restT = LU_REST / pace; }
            return;
        }
        if (lu.hands.some(luActive)) return;
        if ((lu.restT -= dt) > 0) return;
        const list = LU_MOVES[lu.stage];
        const m = list[lu.mi++ % list.length];
        if (m.B) {
            for (const h of lu.hands) luForm(h, m.B);
            if (m.B === 'clap') lu.clap = { x: lu.x, y: LU_CLAP_Y, gap: LU_CLAP_GAP, st: 'open', t: 0 };
        } else {
            if (m.L) luForm(lu.hands[0], m.L);
            if (m.R) luForm(lu.hands[1], m.R);
        }
        lu.restT = LU_REST / pace;
    }

    // the head he is after: one on its way up, the nearest below him first
    function luQuarry() {
        let best = null;
        for (const ball of balls) {
            if (lu.frozen.has(ball) || lu.hands.some(h => h.held === ball)) continue;
            if (!best || (ball.vy < 0) > (best.vy < 0) || ((ball.vy < 0) === (best.vy < 0) && ball.y > best.y)) best = ball;
        }
        return best;
    }

    function luHandStep(h, dt, pace) {
        if (!luActive(h)) return;
        h.t += dt;
        const secs = LU_FORM_SECS / pace;
        const home = lu.x + h.side * LU_HOME;
        const q = luQuarry();
        switch (h.form) {
            case 'claw': {
                if (h.held) {
                    h.open = Math.max(0, h.open - dt * 6);
                    if ((h.holdT -= dt) <= 0) { luThrow(h.held); h.held = null; h.done = true; }
                } else {
                    h.open = Math.min(1, h.open + dt * 3);
                    h.x = luToward(h.x, q ? q.x : home, LU_CLAW_SPEED * pace * dt);
                    if (h.t > secs) h.done = true;
                }
                h.y = luToward(h.y, LU_CLAW_Y + Math.sin(h.t * 1.7) * 12, 300 * dt);
                break;
            }
            case 'palm': {
                // where a head coming up will cross his line, walls and all
                let to = home;
                if (q && q.vy < 0 && q.y > LU_PALM_Y) to = labFold(q.x + q.vx / q.vy * (LU_PALM_Y - q.y));
                h.x = luToward(h.x, to, LU_PALM_SPEED * pace * dt);
                h.y = luToward(h.y, LU_PALM_Y, 300 * dt);
                if (h.t > secs) h.done = true;
                break;
            }
            case 'fist': luFistStep(h, dt, pace); break;
            case 'cage':
                h.x = lu.bd.hx; h.y = lu.bd.hy;
                if (h.t > LU_CAGE_SECS / pace) h.done = true;
                break;
            case 'clap': if (h.side > 0) luClapStep(dt, pace, secs); break;
            case 'wings':
                if (h.t > LU_WING_SECS / pace ||
                    lu.pieces.every(p => p.side !== h.side || p.gone)) h.done = true;
                break;
            case 'reach':
                // up out of easy reach, sweeping slowly across: the stream
                // runs the whole way from you up to it
                h.x = luToward(h.x, labFold(lu.x + Math.sin(h.t * LU_DRAIN_RATE_X) * LU_DRAIN_SWEEP), 400 * dt);
                h.y = luToward(h.y, LU_DRAIN_Y, 300 * dt);
                break;
        }
        if (h.done) { luForm(h, luRestForm()); }
    }

    // Over you, following you; then down, fast. Under it when it lands and
    // you are SLUGGISH. It lies there a moment, and goes back up for another.
    function luFistStep(h, dt, pace) {
        h.stT += dt;
        const floor = padY() - padH() / 2 - 14;
        if (h.st === 'aim') {
            h.x = luToward(h.x, paddle.x, LU_FIST_TRACK * pace * dt);
            h.y = luToward(h.y, LU_FIST_Y, 400 * dt);
            if (h.stT >= LU_FIST_AIM / pace) { h.st = 'drop'; h.stT = 0; h.vy = 0; }
        } else if (h.st === 'drop') {
            h.vy += LU_FIST_G * dt;
            h.y += h.vy * dt;
            if (h.y >= floor) {
                h.y = floor; h.st = 'down'; h.stT = 0; h.slams++;
                lu.slams.push({ x: h.x, y: floor + 10, t: 0 });
                if (Math.abs(paddle.x - h.x) < halfSpan() + LU_FIST_R) {
                    dragT = Math.min(DRAG_CAP, dragT + LU_FIST_DRAG);
                    for (const sg of segs()) { paddle.jt[sg.i] = 1; paddle.tilt[sg.i] = (h.x - sg.cx) / Math.max(1, sg.w / 2); }
                }
            }
        } else if (h.st === 'down') {
            if (h.stT >= LU_FIST_REST) { h.st = 'rise'; h.stT = 0; }
        } else if (h.st === 'rise') {
            h.y = luToward(h.y, LU_FIST_Y, LU_FIST_RISE * pace * dt);
            if (h.y <= LU_FIST_Y + 1) {
                if (h.slams >= LU_FIST_SLAMS) h.done = true;
                else { h.st = 'aim'; h.stT = 0; }
            }
        }
    }

    // The two hands wait open either side of the head's way up and shut on it.
    // The right hand runs it for both.
    function luClapStep(dt, pace, secs) {
        const c = lu.clap, L = lu.hands[0], R = lu.hands[1];
        if (!c) return;
        c.t += dt;
        const q = luQuarry();
        if (c.st === 'open') {
            // both hands stay on the field, however near a wall the head is
            const edge = LU_CLAP_GAP + 30;
            c.x = luToward(c.x, Math.max(edge, Math.min(LW - edge, q ? q.x : lu.x)), LU_CLAW_SPEED * pace * dt);
            c.gap = luToward(c.gap, LU_CLAP_GAP, 400 * dt);
            // shut so as to meet as it gets there
            const shut = LU_CLAP_SHUT / pace;
            if (q && q.vy < 0 && q.y > c.y && q.y - c.y < LU_CLAP_REACH && Math.abs(q.x - c.x) < c.gap &&
                (q.y - c.y) / -q.vy <= shut) {
                c.st = 'shut'; c.st0 = c.gap; c.stT = 0;
            } else if (R.t > secs) { L.done = R.done = true; }
        } else if (c.st === 'shut') {
            // closing on where it is, not where it was
            if (q) c.x = luToward(c.x, q.x, LU_CLAW_SPEED * 3 * pace * dt);
            c.stT += dt;
            const k = Math.min(1, c.stT / (LU_CLAP_SHUT / pace));
            const meet = LU_BONES.palm[2] * lu.bd.sc * 0.6;
            c.gap = luLerp(c.st0, meet, k * k);
            if (k >= 1) {
                const got = balls.find(ball => !lu.frozen.has(ball) && Math.abs(ball.x - c.x) < meet + bRX() * 1.4 &&
                                               Math.abs(ball.y - c.y) < 50);
                if (got) { luCatch(R, got); c.st = 'hold'; }
                else { c.st = 'miss'; c.stT = 0; }
            }
        } else if (c.st === 'miss') {
            if ((c.stT += dt) > 0.5) c.st = 'open';
        } else if (c.st === 'hold') {
            if ((R.holdT -= dt) <= 0) {
                if (R.held) { luThrow(R.held); R.held = null; }
                L.done = R.done = true;
            }
        }
        L.x = c.x - c.gap; R.x = c.x + c.gap;
        L.y = R.y = c.y;
    }

    // a caught head sits in the hand that has it
    function luHeld() {
        for (const h of lu.hands) {
            const ball = h.held;
            if (!ball) continue;
            if (h.form === 'clap' && lu.clap) { ball.x = lu.clap.x; ball.y = lu.clap.y; }
            else { const pk = luPocket(h); ball.x = pk.x; ball.y = pk.y; }
            ball.vx = 0; ball.vy = 0; ball.spin = 0; ball.eng = 0;
        }
    }

    function luCatch(h, ball) {
        h.held = ball; h.holdT = LU_CLAW_HOLD;
        ball.vx = 0; ball.vy = 0; ball.spin = 0; ball.eng = 0; ball.boost = 1;
        dragT = Math.min(DRAG_CAP, dragT + LU_CLAW_DRAG);
        for (const sg of segs()) paddle.jt[sg.i] = 1;
    }

    // Thrown back at the rally's speed, at whichever of the original's angles
    // lands furthest from you, and out through his own hands.
    function luThrow(ball) {
        const s = effSpeed();
        let pick = 0, far = -1;
        for (const a of SLAM_ANGLES) {
            const d = Math.abs(labFold(ball.x - Math.tan(a) * Math.max(0, padY() - ball.y)) - paddle.x);
            if (d > far) { far = d; pick = a; }
        }
        ball.vx = -Math.sin(pick) * s;
        ball.vy = Math.cos(pick) * s;
        ball.luPass = true;
    }

    // Holding the world still while something is said or taken: every head
    // stops where it is and goes on as it was after.
    function luFreeze() {
        for (const h of lu.hands) if (h.held) { luThrow(h.held); h.held = null; }
        for (const ball of balls) {
            if (!lu.frozen.has(ball)) lu.frozen.set(ball, { vx: ball.vx, vy: ball.vy, x: ball.x, y: ball.y });
        }
        lu.clap = null;
    }
    function luThaw() {
        for (const [ball, v] of lu.frozen) { ball.vx = v.vx; ball.vy = v.vy; }
        lu.frozen.clear();
    }
    function luFrozenStep() {
        for (const [ball, v] of lu.frozen) { ball.x = v.x; ball.y = v.y; ball.vx = 0; ball.vy = 0; }
    }

    // ---- the drain -------------------------------------------------------------------
    // Two things running at once and neither ever goes back up: the hand's
    // hits, which you take off it, and your light, which he takes off you.
    // Your light running out costs a head and fills again; the hand keeps
    // every hit, so each one is a step nearer the stream turning round.
    function luDrain(dt) {
        if (lu.handHp <= 0) {
            lu.stage = 'turn'; lu.stT = 0;
            luFreeze();
            for (const h of lu.hands) luForm(h, 'halo');
            return;
        }
        lu.light -= dt / LU_DRAIN_SECS;
        if (lu.light <= 0) {
            lu.light = 1;
            loseLife();
        }
    }

    // specks of whoever is losing, running along the stream to whoever is not
    function luMoteStep(dt) {
        const on = lu.stage === 'drain' || lu.stage === 'turn';
        if (on) {
            for (lu.moteAcc += dt * 45; lu.moteAcc >= 1; lu.moteAcc--) {
                lu.motes.push({ t: 0, sway: (Math.random() - 0.5) * 70, life: 0.9 + Math.random() * 0.3,
                                gold: lu.stage === 'turn' });
            }
        }
        lu.motes = lu.motes.filter(m => (m.t += dt) < m.life);
        if (lu.stage === 'turn' || lu.stage === 'dying') luFrozenStep();
    }

    // ---- being hit -------------------------------------------------------------------
    function luContact(br, ball) {
        lu.pend = null;
        if (phase === 'entrance' || lu.frozen.has(ball)) return null;
        // the hollow of an open claw is a catch, not a bounce off its fingers
        for (const h of lu.hands) {
            if (h.form !== 'claw' || h.held || ball.luPass || ball.vy >= 0 || h.open < 0.6) continue;
            const pk = luPocket(h);
            if (Math.hypot(ball.x - pk.x, ball.y - pk.y) < pk.r) {
                lu.pend = { pocket: h };
                return { cx: ball.x, cy: ball.y - bRY() };
            }
        }
        if (!ball.luPass) {
            const floor = padY() - padH() - 60;
            for (const p of lu.pieces) {
                if (p.gone || p.k < 0.5) continue;
                const h = luHand(p.side);
                if (h.form === 'fist' && p.y > floor) continue;     // on the floor it is no wall
                if (h.form === 'clap') continue;                     // reaching for it, not in its way
                const len = p.len * lu.bd.sc * p.s / 2, r = p.thick * lu.bd.sc * p.s * 0.42;
                const dx = Math.cos(p.a) * len, dy = Math.sin(p.a) * len;
                const hit = capsuleContact(ball, p.x - dx, p.y - dy, p.x + dx, p.y + dy, r);
                if (hit) { lu.pend = { piece: p, ball }; return hit; }
            }
        }
        const d = lu.bd;
        let hit = ellipseContact(ball, d.hx, d.hy, d.hw / 2, d.hh / 2);
        if (!hit && !d.shed) hit = maskContact(ball, d.bx, d.by, -Math.PI / 2 + d.bLean, d.bL, d.bT, hlMask(), false);
        if (hit) lu.pend = { body: true };
        return hit;
    }

    function luTouch(br, ball, hit) {
        if (!lu.pend || !lu.pend.pocket) return false;
        luCatch(lu.pend.pocket, ball);
        lu.pend = null;
        return true;
    }

    // A ring where it struck, for the hits that do nothing: everything drawn
    // in stone (luInert, luArmoured).
    function luGlances() {
        const pd = lu.pend;
        if (!pd) return false;
        if (pd.piece) return luInert(pd.piece);
        return luArmoured() || bossIF > 0;
    }

    function luHit(b, cx, cy) {
        const pd = lu.pend;
        lu.pend = null;
        if (!pd) return;
        if (pd.piece) {
            const p = pd.piece, h = luHand(p.side);
            p.flash = 1;
            if (h.form === 'reach') {
                if (lu.handHp > 0) {
                    lu.handHp--;
                    // the whole hand flinches, not only the bone struck
                    for (const q of lu.pieces) if (q.side === p.side) q.flash = 1;
                    award(BOSS_PTS, cx, cy);
                }
            } else if (h.form === 'wings' || (h.form === 'halo' && lu.stage === 3)) {
                // away from the head that struck it
                const dx = pd.ball.x - cx, dy = pd.ball.y - cy, n = Math.hypot(dx, dy) || 1;
                luKnock(p, dx / n, dy / n);
                award(BOSS_PTS / 3, cx, cy);
            } else if (LU_BREAKS.includes(h.form)) {
                if (++h.hits >= LU_FORM_HP) {
                    award(BOSS_PTS, cx, cy);
                    luForm(h, luRestForm());
                } else award(BOSS_PTS / 3, cx, cy);
            }
            return;
        }
        if (luArmoured() || bossIF > 0) return;
        b.flash = 1;
        bossIF = BOSS_IF;
        b.hp = Math.max(0, b.hp - 1);
        bossHits++;
        award(BOSS_PTS, cx, cy);
        if (b.hp <= 1e-6) { luNext(b); return; }
        if (lu.stage === 3 && !lu.shed && b.hp / b.maxHp <= LU_SHED_AT) luShed();
        if (bossHits % BOSS_CAP === 0 && !capsule) {
            const pool = capsulePool();
            capsule = { x: lu.bd.x, y: lu.bd.y, kind: pool[(Math.random() * pool.length) | 0] };
        }
        if (++hits === 4 || hits === 12) bumpSpeed(1.12);
    }

    // Straight to the start of a part, from wherever the fight is: whatever
    // is held is let go, and both hands come home first.
    function luJump(b, stage) {
        luThaw();
        lu.clap = null; lu.motes = []; lu.slams = [];
        lu.stage = stage; lu.stT = 0; lu.mi = 0; lu.restT = LU_REST; lu.pulseT = 0;
        lu.wither = 1; lu.shed = null;
        b.hp = b.maxHp = stage === 1 ? LU_HP1 : stage === 2 ? LU_HP2 : LU_HP3;
        for (const h of lu.hands) luForm(h, luRestForm());
    }

    // one part over, and on to the next
    function luNext(b) {
        lu.stT = 0;
        if (lu.stage === 1) {
            lu.stage = 'break';
            for (const h of lu.hands) if (luActive(h)) luForm(h, 'arm');
            lu.clap = null;
        } else if (lu.stage === 2) {
            lu.stage = 'drain';
            lu.handHp = LU_DRAIN_HP;
            lu.light = 1;
            lu.clap = null;
            const near = paddle.x < lu.x ? lu.hands[0] : lu.hands[1];
            for (const h of lu.hands) luForm(h, h === near ? 'reach' : 'arm');
            lu.restT = LU_REST;
        } else if (lu.stage === 3) {
            lu.stage = 'dying';
            luFreeze();
            for (const h of lu.hands) luForm(h, 'halo');
        }
    }

    // His last words are said: he goes, and the takeover has the stage.
    function luPerish(b) {
        luThaw();
        const d = lu.bd;
        lu.fall = { pieces: lu.pieces.map(p => ({ x: p.x, y: p.y, a: p.a, s: p.s, i: p.i, side: p.side,
                                                    len: p.len, thick: p.thick, flip: p.flip, gone: !!p.gone,
                                                    vx: (Math.random() - 0.5) * 120, vy: -40 - Math.random() * 80,
                                                    va: (Math.random() - 0.5) * 5 })),
                    bd: Object.assign({}, d) };
        b.alive = false;
        clearStage();
        bossFall = { x: d.x, y: d.y, w: d.L, t: 0, pieces: [] };
        if (impact) impact.w = 0;
    }

    // ---- the picture -----------------------------------------------------------------
    // His body with his head cut away, and colour laid over any sprite, both
    // baked once
    function luTinted(key, src, color, a) {
        const k = 'lu-' + key;
        if (spriteCache.has(k)) return spriteCache.get(k);
        if (!src || (src.naturalWidth === 0)) return null;
        const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        g.drawImage(src, 0, 0, w, h);
        g.globalCompositeOperation = 'source-atop';
        g.globalAlpha = a;
        g.fillStyle = color;
        g.fillRect(0, 0, w, h);
        spriteCache.set(k, c);
        return c;
    }
    // a bone: the whole of him in clay with his creases through it, as the
    // memories have it -- or, red, a brick's own wash
    function luBone(color) {
        const k = 'lu-bone' + color;
        if (spriteCache.has(k)) return spriteCache.get(k);
        if (!ready(paddleImg)) return null;
        const w = 300, h = Math.round(w / SHAPE_ASPECT);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        placeShape(g, w, h, false);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = color;
        g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = 'multiply';
        g.filter = 'grayscale(1) contrast(0.55) brightness(2.6) contrast(1.6)';
        placeShape(g, w, h, false);
        g.filter = 'none';
        g.globalCompositeOperation = 'destination-in';
        placeShape(g, w, h, false);
        spriteCache.set(k, c);
        return c;
    }

    function luDrawPiece(p, red, alpha) {
        const sc = lu.bd.sc;
        const w = (p.len + p.thick * 0.3) * sc, h = p.thick * sc;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.a);
        ctx.scale(p.s * (p.flip ? -1 : 1), p.s);
        const clay = red < 1 && luBone(LU_CLAY);
        if (clay) ctx.drawImage(clay, -w / 2, -h / 2, w, h);
        if (red > 0) {
            const sp = shapeSprite('luRed' + p.i % 3, LU_REDS[p.i % 3], 300, 300 / SHAPE_ASPECT, false);
            ctx.globalAlpha = alpha * red;
            if (sp) ctx.drawImage(sp, -w / 2, -h / 2, w, h);
        }
        // stone over it while a hit would do nothing to it
        if (p.stone > 0.01) {
            const st = shapeSprite('luStone', STONE, 300, 300 / SHAPE_ASPECT, 'statue');
            ctx.globalAlpha = alpha * p.stone;
            if (st) ctx.drawImage(st, -w / 2, -h / 2, w, h);
        }
        if (p.flash > 0) {
            ctx.globalAlpha = alpha * p.flash * 0.8;
            const fl = shapeSprite('luFlash', '#f2efe9', 300, 300 / SHAPE_ASPECT, true);
            if (fl) ctx.drawImage(fl, -w / 2, -h / 2, w, h);
        }
        ctx.restore();
    }

    // Him: the body stood on end and the ball on his shoulders. As he turns
    // the body greys and the head reddens; stone over both while nothing can
    // reach him. Once shed there is no body, only the head.
    function luDrawBody(d, red, flash, stone) {
        const sp = hlSprite('raw');
        if (!sp || !ready(ballImg)) return;
        if (!d.shed) {
            ctx.save();
            ctx.translate(d.bx, d.by);
            ctx.rotate(-Math.PI / 2 + d.bLean);
            const w = d.bL, h = d.bT;
            ctx.drawImage(sp, -w / 2, -h / 2, w, h);
            if (red > 0) {
                ctx.globalAlpha = red;
                ctx.drawImage(luTinted('bodyGrey', sp, LU_GREY_BODY, 0.72), -w / 2, -h / 2, w, h);
                ctx.globalAlpha = 1;
            }
            if (stone > 0.01) {
                ctx.globalAlpha = stone;
                ctx.drawImage(luTinted('bodyStone', sp, STONE, 0.85), -w / 2, -h / 2, w, h);
                ctx.globalAlpha = 1;
            }
            if (flash > 0) {
                ctx.globalAlpha = Math.min(1, flash) * 0.7;
                ctx.drawImage(hlSprite('flash'), -w / 2, -h / 2, w, h);
                ctx.globalAlpha = 1;
            }
            ctx.restore();
        }
        ctx.save();
        ctx.translate(d.hx, d.hy);
        ctx.rotate(d.ha);
        ctx.drawImage(ballImg, -d.hw / 2, -d.hh / 2, d.hw, d.hh);
        if (red > 0) {
            ctx.globalAlpha = red;
            const tint = luTinted('head', ballImg, LU_RED_BODY, 0.5);
            if (tint) ctx.drawImage(tint, -d.hw / 2, -d.hh / 2, d.hw, d.hh);
        }
        if (stone > 0.01) {
            ctx.globalAlpha = stone;
            const st = headSprite2('stone');
            if (st) ctx.drawImage(st, -d.hw / 2, -d.hh / 2, d.hw, d.hh);
        }
        if (flash > 0) {
            ctx.globalAlpha = Math.min(1, flash) * 0.7;
            ctx.drawImage(headSprite2('flat', '#f2efe9'), -d.hw / 2, -d.hh / 2, d.hw, d.hh);
        }
        ctx.globalAlpha = 1;
        if (red > 0) luDrawEyes(d, red * (1 - stone));
        ctx.restore();
    }

    // His eyes, lit from inside: a hot red point in each and a glow round it
    // that breathes slowly. None are lit until his body lets go; then his
    // own two open, and more all over his face (LU_MORE_EYES), one after
    // another while it falls, and they stay open. Every eye is the same, and
    // each blinks on its own clock. Drawn in the head's own frame.
    function luDrawEyes(d, k) {
        if (k <= 0.01) return;
        const opened = lu && lu.shed ? Math.min(1, lu.shed.t / LU_SHED_FALL) : 0;
        const all = LU_EYES.concat(LU_MORE_EYES), eyes = [];
        all.forEach(([u, v], i) => {
            const o = Math.max(0, Math.min(1, opened * all.length - i));
            if (o > 0) eyes.push([u, v, o]);
        });
        if (!eyes.length) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        eyes.forEach(([u, v, o], i) => {
            const breathe = 0.8 + 0.2 * Math.sin(clock * 2 * Math.PI / 2.2 + i * 1.7);
            const ex = (u - 0.5) * d.hw, ey = (v - 0.5) * d.hh, r = d.hw * 0.2;
            const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, r);
            g.addColorStop(0, 'rgba(255,210,190,1)');
            g.addColorStop(0.18, 'rgba(255,40,30,0.9)');
            g.addColorStop(1, 'rgba(255,40,30,0)');
            ctx.globalAlpha = k * breathe * luBlink(i) * o;
            ctx.fillStyle = g;
            ctx.fillRect(ex - r, ey - r, r * 2, r * 2);
        });
        ctx.restore();
    }

    // how open an eye is: now and then it shuts, each on its own clock
    function luBlink(i) {
        const h = x => { const s = Math.sin(x * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
        const period = 3 + 4 * h(i + 7), at = (clock + h(i) * period) % period;
        return at < 0.16 ? Math.abs(at - 0.08) / 0.08 : 1;
    }

    // the body he has let go of, falling, turning over and fading
    function luDrawShed() {
        const f = lu.shed && lu.shed.t;
        if (!lu.shed || f >= LU_SHED_FALL) return;
        const s = lu.shed, sp = hlSprite('raw');
        if (!sp) return;
        ctx.save();
        ctx.globalAlpha = 1 - f / LU_SHED_FALL;
        ctx.translate(s.x, s.y + 0.5 * 1500 * f * f);
        ctx.rotate(-Math.PI / 2 + s.lean + f * 1.1);
        ctx.drawImage(sp, -s.L / 2, -s.T / 2, s.L, s.T);
        ctx.drawImage(luTinted('bodyGrey', sp, LU_GREY_BODY, 0.72), -s.L / 2, -s.T / 2, s.L, s.T);
        ctx.restore();
    }

    // The Corrupted's aura: black, swelling, with a red edge so it reads on a
    // black field. A swell is slow -- well under a breath a second -- and
    // nothing in it flashes.
    function luDrawAura(d, k) {
        if (k <= 0.002) return;
        const u = luPulse();
        const r = LU_AURA * (1 + (LU_AURA_SWELL - 1) * u) * (0.85 + 0.15 * Math.sin(clock * 1.2)) * k;
        if (!(r > 1)) return;
        const cy = d.y - d.L * 0.1;
        const g = ctx.createRadialGradient(d.x, cy, r * 0.1, d.x, cy, r);
        g.addColorStop(0, 'rgba(0,0,0,0.92)');
        g.addColorStop(0.62, 'rgba(0,0,0,0.8)');
        g.addColorStop(0.86, 'rgba(160,20,40,' + (0.28 + 0.3 * u).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(d.x, cy, r, r * 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // HIS light, back where it belongs: under you, whichever paddle you are.
    // Laid under him rather than over, so every paddle keeps its own colour.
    function luDrawOdin(k) {
        if (k <= 0.002) return;
        const y = padY();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const sg of segs()) {
            const w = sg.w * 0.75 + 30;
            const g = ctx.createRadialGradient(sg.cx, y, 4, sg.cx, y, w);
            g.addColorStop(0, 'rgba(232,182,76,0.9)');
            g.addColorStop(1, 'rgba(232,182,76,0)');
            ctx.globalAlpha = LU_ODIN_GLOW * k * (0.82 + 0.18 * Math.sin(clock * 2));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(sg.cx, y, w, w * 0.42, 0, 0, Math.PI * 2);
            ctx.fill();
            // rays, turning slowly
            ctx.globalAlpha = 0.22 * k;
            ctx.strokeStyle = LU_GOLD;
            ctx.lineWidth = 2;
            for (let i = 0; i < 12; i++) {
                const a = i / 12 * Math.PI * 2 + clock * 0.3;
                ctx.beginPath();
                ctx.moveTo(sg.cx + Math.cos(a) * w * 0.55, y + Math.sin(a) * w * 0.22);
                ctx.lineTo(sg.cx + Math.cos(a) * w * 0.95, y + Math.sin(a) * w * 0.4);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    // the stream: from you up the hand into him, or back down out of him
    function luDrawStream() {
        if (!lu.motes.length) return;
        const d = lu.bd;
        const you = [paddle.x, padY() - padH() / 2];
        const reach = lu.hands.find(h => h.form === 'reach');
        const him = [d.hx, d.hy];
        const mid = reach ? [reach.x, reach.y + 30] : [(you[0] + him[0]) / 2, (you[1] + him[1]) / 2];
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const m of lu.motes) {
            const p = m.t / m.life, e = p * p * (3 - 2 * p);
            const [a, c] = m.gold ? [him, you] : [you, him];
            const x = (1 - e) * (1 - e) * a[0] + 2 * (1 - e) * e * mid[0] + e * e * c[0] + Math.sin(p * Math.PI) * m.sway;
            const y = (1 - e) * (1 - e) * a[1] + 2 * (1 - e) * e * mid[1] + e * e * c[1];
            const al = Math.sin(p * Math.PI);
            ctx.globalAlpha = 0.9 * al;
            ctx.fillStyle = m.gold ? LU_GOLD : '#f2efe9';
            ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
            ctx.globalAlpha = 0.3 * al;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // where a fist is going to land, on the floor under it
    function luDrawShadows(red) {
        const floor = padY() + padH() / 2 + 2;
        const ink = red > 0.5 ? '192,31,50' : '196,138,108';
        for (const h of lu.hands) {
            if (h.form !== 'fist' || (h.st !== 'aim' && h.st !== 'drop')) continue;
            const near = Math.max(0, Math.min(1, (h.y - LU_FIST_Y) / Math.max(1, floor - LU_FIST_Y)));
            const warm = h.st === 'aim' ? Math.min(1, h.stT / 0.4) * 0.5 : 0.5 + near * 0.5;
            ctx.fillStyle = 'rgba(' + ink + ',' + (0.22 * warm).toFixed(3) + ')';
            ctx.beginPath();
            ctx.ellipse(h.x, floor, LU_FIST_R + 20 + near * 20, 8 + near * 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(' + ink + ',' + (0.5 * warm).toFixed(3) + ')';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        for (const s of lu.slams) {
            const k = s.t / 0.6;
            ctx.strokeStyle = 'rgba(' + ink + ',' + (0.6 * (1 - k)).toFixed(3) + ')';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(s.x, s.y, 40 + k * 90, 8 + k * 14, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // his voice: the Corrupted's, from the memories when they are loaded
    function luVoice(px) {
        const v = typeof MEM_VOICE !== 'undefined' && MEM_VOICE.corrupted;
        return { font: (v ? v.font : '700 {px}px "Cinzel Decorative", serif').replace('{px}', px),
                 ink: v ? v.ink : '#e0283c' };
    }

    function luDraw(b) {
        const d = lu.bd;
        if (!d) return;
        const red = luRed();
        luDrawOdin(red);
        luDrawAura(d, red);
        luDrawShadows(red);
        luDrawStream();
        // a clap's hands are only half there: a head goes straight through them
        const solid = p => p.gone ? Math.max(0, 1 - p.gone / 0.8) : luHand(p.side).form === 'clap' ? 0.5 : 1;
        for (const p of lu.pieces) if (p.back && !p.gone) luDrawPiece(p, red, solid(p));
        luDrawShed();
        luDrawBody(d, red, b.flash, lu.stone);
        for (const p of lu.pieces) if (!p.back) luDrawPiece(p, red, solid(p));
        if (luArmoured() && lu.stage === 3) {
            const u = luPulse();
            ctx.strokeStyle = 'rgba(224,40,60,' + (0.35 * u).toFixed(3) + ')';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(d.x, d.y - d.L * 0.1, d.T * 1.2, d.L * 0.62, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
        luDrawBars(b);
        if (lu.stage === 'dying') luDrawLast();
    }

    // His health, and which part of him it is: a mark for each part left.
    // In the drain the bar is the hand's, since the hand is what there is to
    // hit, and your light is a bar of its own under you, running out.
    function luDrawBars(b) {
        const grow = phase === 'entrance' ? enterK() : 1;
        if (grow <= 0.001 || lu.stage === 'dying') return;
        const w = 300 * grow, x = LW / 2 - w / 2, y = 12;
        if (lu.stage === 'drain') {
            labBar(x, y, w, lu.handHp / LU_DRAIN_HP);
            luDrawLight();
        } else labBar(x, y, w, lu.stage === 'break' || lu.stage === 'turn' ? 0 : b.hp / b.maxHp);
        const left = lu.stage === 1 ? 3 : lu.stage === 'break' || lu.stage === 2 || lu.stage === 'drain' ? 2 : 1;
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = i < left ? '#c4703c' : 'rgba(242,239,233,0.14)';
            ctx.beginPath();
            ctx.arc(x - 14 - i * 11, y + 2.5, 3.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // your light, under you, in your own cream: what the stream is taking
    function luDrawLight() {
        const w = Math.max(80, padW() * 0.8), x = paddle.x - w / 2, y = padY() + padH() / 2 + 10;
        ctx.fillStyle = 'rgba(242,239,233,0.14)';
        ctx.fillRect(x, y, w, 4);
        // the last quarter of it turns the Fallen's clay: nearly gone
        ctx.fillStyle = lu.light < 0.25 ? LU_CLAY : '#f2efe9';
        ctx.fillRect(x, y, w * lu.light, 4);
    }

    // "It is finished. My world is..." -- a letter at a time, under him
    function luDrawLast() {
        const n = Math.min(LU_LAST.length, Math.floor(lu.stT * LU_DIE_TYPE));
        if (n <= 0) return;
        const v = luVoice(30);
        ctx.save();
        ctx.font = v.font;
        ctx.fillStyle = v.ink;
        // laid out where the whole line will sit, so it grows rightward
        // rather than every letter nudging the rest along
        ctx.textAlign = 'left';
        ctx.fillText(LU_LAST.slice(0, n), LW / 2 - ctx.measureText(LU_LAST).width / 2,
                     Math.min(LH - 160, lu.bd.y + lu.bd.L / 2 + 90));
        ctx.restore();
    }

    // The takeover's first beat, his way: the colour goes out of him, then he
    // comes apart from the boot up, a grain at a time, while his bones fall.
    function luDrawFall() {
        const f = lu && lu.fall;
        if (!f) return;
        const d = f.bd, t = ascendT;
        const grey = luEase(t / A_DIE);
        const gone = Math.max(0, Math.min(1, (t - A_DIE) / (A_DIE_T * 0.7)));
        if (gone >= 1) return;
        const prev = lu.bd;
        lu.bd = d;
        if (grey > 0.001) ctx.filter = 'grayscale(' + grey.toFixed(3) + ')';
        const tt = Math.max(0, t - A_DIE * 0.6);
        for (const p of f.pieces) {
            if (p.gone) continue;
            const q = { x: p.x + p.vx * tt, y: p.y + p.vy * tt + 450 * tt * tt, a: p.a + p.va * tt, s: p.s,
                        len: p.len, thick: p.thick, flip: p.flip, i: p.i, flash: 0 };
            luDrawPiece(q, 1, Math.max(0, 1 - tt / 1.6));
        }
        // the body, cut to the grains that have not gone yet, boot first
        ctx.save();
        if (gone > 0) {
            const top = d.hy - d.hh, bot = d.y + d.L / 2 + 10, cell = 6;
            ctx.beginPath();
            for (let gy = top, j = 0; gy < bot; gy += cell, j++) {
                const up = 1 - (gy - top) / (bot - top);        // 1 at his head
                for (let gx = d.x - d.L * 0.35, i = 0; gx < d.x + d.L * 0.35; gx += cell, i++) {
                    const hsh = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
                    if (up * 0.75 + (hsh - Math.floor(hsh)) * 0.25 > gone) ctx.rect(gx, gy, cell, cell);
                }
            }
            ctx.clip();
        }
        luDrawBody(d, 1, 0, 0);
        ctx.restore();
        ctx.filter = 'none';
        lu.bd = prev;
    }
