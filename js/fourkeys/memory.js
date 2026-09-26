'use strict';

    // ---- a memory ---------------------------------------------------------------------
    // What MEMORIES shows, and a level's first win shows once: a card saying
    // how far back it is, then the scene. The list, years and titles are
    // menu.js's (MENU_MEMS); the scenes are here, keyed by the same ids.
    // Oldest first: HIM rallying the army that ends the first game; HIM facing
    // the one they feared; the Angel leading a host against it; the Angel
    // asking HIM whether it ever ends; how the Angel fell -- the bones that
    // swirl round his head draining the clay out of HIM and becoming arms --
    // and what he did with the world after.
    //
    // Every character is a Brandon, and so is everything they call each other.
    // Each speaks in his own voice, a face and a colour (MEM_VOICE), and a
    // Brandon named is named in the voice of the one he is -- only the name.
    // Who is who is never written down anywhere a player sees it. The Angel
    // and the Fallen have a voice each, so they read as two Brandons until
    // the memory 99 years back shows you they are one.
    //
    // The menu draws this through memoryDraw and asks memoryCardSecs how long
    // the card is up, both behind a typeof: the boss lab builds menu.js
    // without this file. Nothing here is read at load time, so it can load
    // before the engine and headless.js whose names it uses.
    const MEM_CARD_IN = 0.45;        // seconds the card takes to come up
    const MEM_CARD_HOLD = 1.6;       // ...stays up
    const MEM_CARD_OUT = 0.4;        // ...and takes to go
    const MEM_CARD_PX = 43;          // the card's size, as 2000 YEARS LATER's
    // How long the card waits on the faces, past when it would have gone,
    // before the memory goes ahead without them.
    const MEM_FONT_WAIT = 4;
    const MEM_CLAY = '#c48a6c';
    // Each Brandon's voice: his face and his colour. The faces ship with the
    // game (see fourkeys.html), and the card holds until they are in, so no
    // line is ever drawn in a stand-in. Each colour is taken from how he
    // looks: the Angel cool as his halo's light, the Fallen the clay of his
    // arms, HIM his radiance rather than his clay, so the two warm ones stay
    // apart, and the one they fear a lighter cut of his own indigo.
    const MEM_VOICE = {
        you:    { font: '{px}px "Fira Sans", "Trebuchet MS", sans-serif', ink: '#f2efe9' },
        angel:  { font: '700 {px}px "Cinzel Decorative", serif', ink: '#9fd3f0' },
        fallen: { font: '{px}px "IM Fell English SC", serif', ink: '#c97a5a' },
        odin:   { font: '{px}px "Uncial Antiqua", serif', ink: '#e8b64c' },
        surtr:  { font: '{px}px "UnifrakturMaguntia", serif', ink: '#9a86e0' },
    };

    const MEM_L = 360;               // the height his rig is drawn at, before scaling

    // ---- his rig ----
    // Drawn at MEM_L tall with his middle at (0, 0), and scaled to wherever he
    // stands. Two poses, the Angel and the Fallen, and everything between.
    // Leans are degrees off vertical, top to the right. The ball on his
    // shoulders sits off where his own head was by headDx/headDy px, turned
    // headTurn degrees and rocking headSway either side of that, headSize
    // times his own head's width.
    const MEM_FALLEN = { lean: 14, headDx: 10, headDy: -12, headTurn: -15.5, headSway: 9.5, headSize: 1.3 };
    const MEM_ANGEL  = { lean: 3,  headDx: 3,  headDy: -22, headTurn: 0,     headSway: 2.5, headSize: 1.3 };
    const MEM_HEAD_PERIOD = 1.8, MEM_ANGEL_HEAD_PERIOD = 5;
    const MEM_ANGEL_BOB = 5;         // px the Angel floats up and down
    // How the arms move. Each is a sine: a swing in degrees either side and a
    // period in seconds. A finger joint runs MEM_FINGER_LAG of a cycle behind
    // the one before it, which turns a curl into a wave out to the tip.
    const MEM_ARM_SWING = 14, MEM_ARM_PERIOD = 2.6;
    const MEM_FINGER_CURL = 15, MEM_FINGER_PERIOD = 1.4, MEM_FINGER_LAG = 0.12;
    const MEM_ARM_OFFSET = 0.37;     // the left arm, this share of a cycle behind
    const MEM_FINGER_OFFSET = 0.2;   // the second finger, behind the first
    // The right arm as bone chains, [length, degrees, thickness], 0 degrees
    // pointing right and -90 up; the left is its mirror. The shoulder is a
    // point on him (u along him from the boot, v down from his top).
    const MEM_SHOULDER = [0.80, 0.42];
    const MEM_ARM = [[95, 30, 40], [110, -75, 36]];
    const MEM_PALM = [42, -100, 38];
    const MEM_F1 = [[52, -112, 27], [42, -152, 23], [32, -192, 19]];
    const MEM_F2 = [[46, -80, 25], [38, -122, 21], [28, -166, 17]];
    // The Angel's halo: three tilted rings over his head. The arm bones ride
    // the inner one and the fingers the two outside it; each ring turns the
    // other way to the one inside it, slower the further out, which is what
    // makes it swirl. rx/ry its radii, lift how far over his head, tilt in
    // degrees, bob px.
    const MEM_HALO = [
        { rx: 70,  ry: 22, lift: 10, tilt: -6, speed: 1,     bob: 4 },
        { rx: 104, ry: 31, lift: 36, tilt: 7,  speed: -0.72, bob: 6 },
        { rx: 136, ry: 40, lift: 62, tilt: -4, speed: 0.52,  bob: 8 },
    ];
    const MEM_HALO_PERIOD = 11;      // seconds for the inner ring to go round
    const MEM_HALO_BREATHE = 0.06;   // share each ring swells and shrinks by
    // the pieces ride the halo smaller than they sit in the arms, and a touch
    // bigger on the near side of a ring than the far
    const MEM_HALO_SIZE = 0.44, MEM_HALO_NEAR = 0.14;
    const MEM_HALO_GLOW = 0.22;      // the pale light behind the halo, at full
    const MEM_HALO_SPIN = 3.5;       // how much faster it turns as he falls

    // The pieces, in the order the arms are built: which bone each is, the
    // ring it rides as the Angel, the brick colour it wears there, and when in
    // the fall it flies to its place (0 the shoulders first, 1 the fingertips).
    let memPieces = null;
    function memPieceList() {
        if (memPieces) return memPieces;
        const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
        memPieces = [];
        for (const side of [1, -1]) {
            const add = (bone, idx, ring, order) => memPieces.push({ side, bone, idx, ring, order });
            add('arm', 0, 0, 0); add('arm', 1, 0, 0.2); add('palm', 0, 0, 0.4);
            for (let k = 0; k < 3; k++) add('f1', k, k === 2 ? 2 : 1, 0.6 + k * 0.2);
            for (let k = 0; k < 3; k++) add('f2', k, k === 0 ? 1 : 2, 0.6 + k * 0.2);
        }
        memPieces.forEach((p, i) => {
            p.tint = TIERS[TIER_KEYS[Math.floor(hash(i + 3) * TIER_KEYS.length)]].fill;
        });
        MEM_HALO.forEach((r, ri) => {
            const on = memPieces.filter(p => p.ring === ri);
            on.forEach((p, j) => { p.slot = j / on.length * 2 * Math.PI + hash(ri + 20) * 6; });
        });
        return memPieces;
    }

    const memClamp = x => Math.max(0, Math.min(1, x));
    const memEase = x => { x = memClamp(x); return x * x * (3 - 2 * x); };
    const memLerp = (a, b, k) => a + (b - a) * k;
    const memLerpAng = (a, b, k) =>
        a + (((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) * k;
    const memHash = i => { const s = Math.sin(i * 91.7 + 17.3) * 43758.5453; return s - Math.floor(s); };

    // a point on a body stood up on his boot with his middle at (x, y), L tall
    function memOnBody(x, y, L, lean, u, v) {
        const A = -Math.PI / 2 + lean, T = L / SHAPE_ASPECT;
        const lx = (u - 0.5) * L, ly = (v - 0.5) * T;
        return [x + lx * Math.cos(A) - ly * Math.sin(A), y + lx * Math.sin(A) + ly * Math.cos(A)];
    }

    // ---- sprites ----
    // His body levelled, whole or with his head cut away the way HEADLESS
    // cuts it; and a colour with his creases multiplied back through it, which
    // is the clay. Both cached.
    const memSprites = new Map();
    function memSprite(key, make) {
        if (memSprites.has(key)) return memSprites.get(key);
        if (!ready(paddleImg)) return null;
        const w = 600, h = Math.round(w / SHAPE_ASPECT);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        make(c.getContext('2d'), w, h);
        memSprites.set(key, c);
        return c;
    }
    function memCut(g, w, h) {
        g.globalCompositeOperation = 'destination-out';
        g.beginPath();
        HL_CUT.forEach(([u, v], i) => i ? g.lineTo(u * w, v * h) : g.moveTo(u * w, v * h));
        g.closePath();
        g.fill();
        g.globalCompositeOperation = 'source-over';
    }
    const memWhole = () => memSprite('whole', (g, w, h) => placeShape(g, w, h, false));
    const memHeadless = () => memSprite('headless', (g, w, h) => { placeShape(g, w, h, false); memCut(g, w, h); });
    const memFlesh = color => memSprite('flesh' + color, (g, w, h) => {
        placeShape(g, w, h, false);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = color;
        g.fillRect(0, 0, w, h);
        // he is nearly all black shirt and dark denim: bring the contrast down
        // before multiplying him back through, or he goes to mud
        g.globalCompositeOperation = 'multiply';
        g.filter = 'grayscale(1) contrast(0.55) brightness(2.6) contrast(1.6)';
        placeShape(g, w, h, false);
        g.filter = 'none';
        g.globalCompositeOperation = 'destination-in';
        placeShape(g, w, h, false);
        g.globalCompositeOperation = 'source-over';
    });
    // a brick's own wash, the one the walls wear
    const memBrick = color => shapeSprite('memBrick' + color, color, 300, 300 / SHAPE_ASPECT, false);

    // a soft round blob, for light
    const memBlobs = new Map();
    function memBlob(color) {
        if (memBlobs.has(color)) return memBlobs.get(color);
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        gr.addColorStop(0, color);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 128, 128);
        memBlobs.set(color, c);
        return c;
    }

    // Where the arms put every piece at time t with their motion at `amp` of
    // full: centre, angle, length, thickness and whether it is flipped end
    // for end (every other bone is, so boot meets boot and head meets head).
    function memArmSlots(t, amp, lean) {
        const out = new Map();
        const wave = (period, ph) => Math.sin(2 * Math.PI * (t / period + ph));
        const T = MEM_L / SHAPE_ASPECT;
        for (const side of [1, -1]) {
            const [sx0, sy] = memOnBody(0, 0, MEM_L, lean, MEM_SHOULDER[0], MEM_SHOULDER[1]);
            const ph = side > 0 ? 0 : MEM_ARM_OFFSET;
            const arm = wave(MEM_ARM_PERIOD, ph) * amp;
            const finger = f => [0, 1, 2].map(k => -MEM_FINGER_CURL * amp *
                wave(MEM_FINGER_PERIOD, ph - f * MEM_FINGER_OFFSET - k * MEM_FINGER_LAG));
            // One stretch of a chain. Each link turns by its own delta, and a
            // turn carries on down the rest of it the way bending an elbow
            // carries the hand; `acc` is what it has turned by already. `i0`
            // numbers the bone for the flip, `k0` for its name.
            const run = (name, links, x, y, acc, deltas, i0, k0 = 0) => {
                links.forEach(([len, deg0, thick], n) => {
                    acc += deltas[n] || 0;
                    const d = (deg0 + acc) * Math.PI / 180;
                    const a = side > 0 ? d : Math.PI - d;
                    out.set(side + name + (k0 + n), { x: x + Math.cos(a) * len / 2, y: y + Math.sin(a) * len / 2,
                                                      a, len, thick, flip: (i0 + n) % 2 === 1 });
                    x += Math.cos(a) * len; y += Math.sin(a) * len;
                });
                return [x, y, acc];
            };
            // the shoulder raises and lowers the arm, the elbow gives back half
            // of that so the hand bobs rather than sweeping out, and the wrist
            // follows a beat late
            const [ex, ey, a0] = run('arm', [MEM_ARM[0]], sx0 + side * T * 0.30, sy, 0, [MEM_ARM_SWING * arm], 0);
            const [wx, wy, a1] = run('arm', [MEM_ARM[1]], ex, ey, a0, [-0.5 * MEM_ARM_SWING * arm], 1, 1);
            const [px, py, a2] = run('palm', [MEM_PALM], wx, wy, a1,
                                     [0.4 * MEM_ARM_SWING * wave(MEM_ARM_PERIOD, ph - 0.15) * amp], 2);
            run('f1', MEM_F1, px, py, a2, finger(0), 3);
            run('f2', MEM_F2, px, py, a2, finger(1), 4);
        }
        return out;
    }

    // Him, at (x, y) his middle, `scale` of MEM_L tall. `fall` 0 is the Angel
    // and 1 the Fallen; between them the halo spins up and drains to clay, the
    // pieces fly down into arms shoulders first, he sinks into his hunch and
    // the arms start to move. `spin` is how far round the halo has turned, in
    // radians. Hands back where his halo and his hands are, on the screen.
    function memLucifer(g, t, x, y, scale, fall, spin) {
        const bodyK = memEase((fall - 0.45) / 0.35);
        const ampK = memEase((fall - 0.82) / 0.18);
        const pose = {};
        for (const k of Object.keys(MEM_FALLEN)) pose[k] = memLerp(MEM_ANGEL[k], MEM_FALLEN[k], bodyK);
        const lean = pose.lean * Math.PI / 180;
        const bob = (1 - bodyK) * MEM_ANGEL_BOB * Math.sin(t * 2 * Math.PI / 4);

        g.save();
        g.translate(x, y + bob * scale);
        g.scale(scale, scale);

        const [hx0, hy0] = memOnBody(0, 0, MEM_L, lean, HL_HEAD_U, HL_HEAD_V);
        const hx = hx0 + pose.headDx, hy = hy0 + pose.headDy;
        const slots = memArmSlots(t, ampK, lean);

        const drawn = memPieceList().map(pc => {
            const slot = slots.get(pc.side + pc.bone + pc.idx);
            const ring = MEM_HALO[pc.ring];
            const breathe = 1 + MEM_HALO_BREATHE * Math.sin(t * 0.7 + pc.ring * 2);
            const th = pc.slot + spin * ring.speed;
            const rx = ring.rx * breathe, ry = ring.ry * breathe;
            const tilt = ring.tilt * Math.PI / 180;
            const ox = Math.cos(th) * rx, oy = Math.sin(th) * ry;
            const cy = hy - 40 - ring.lift + Math.sin(t * 0.9 + pc.ring * 1.7) * ring.bob;
            const depth = Math.sin(th);                   // +1 nearest you
            const fly = memEase((fall - 0.4 - 0.3 * pc.order) / 0.28);
            // a curve on the way down rather than a straight line
            const bend = Math.sin(fly * Math.PI) * 50 * pc.side;
            return {
                x: memLerp(hx + ox * Math.cos(tilt) - oy * Math.sin(tilt), slot.x, fly) + bend,
                y: memLerp(cy + ox * Math.sin(tilt) + oy * Math.cos(tilt), slot.y, fly),
                a: memLerpAng(Math.atan2(ry * Math.cos(th), -rx * Math.sin(th)) + tilt, slot.a, fly),
                s: memLerp(MEM_HALO_SIZE + MEM_HALO_NEAR * depth, 1, fly),
                len: slot.len, thick: slot.thick, flip: slot.flip,
                drain: memEase((fall - 0.12 - 0.25 * pc.order) / 0.25),
                depth: fly > 0.5 ? 2 : depth, tint: pc.tint,
                // on the near side of the halo, or out on his arms, he is in
                // front of them -- except for the upper arms, which come out
                // of his back
                front: (fly > 0.5 || depth > 0) && !(pc.bone === 'arm' && pc.idx === 0 && fly > 0.5),
            };
        });
        const piece = d => {
            g.save();
            g.translate(d.x, d.y);
            g.rotate(d.a);
            g.scale(d.s * (d.flip ? -1 : 1), d.s);
            const w = d.len + d.thick * 0.3, h = d.thick;
            const brick = d.drain < 1 && memBrick(d.tint);
            if (brick) g.drawImage(brick, -w / 2, -h / 2, w, h);
            if (d.drain > 0) {
                g.globalAlpha *= d.drain;
                g.drawImage(memFlesh(MEM_CLAY), -w / 2, -h / 2, w, h);
            }
            g.restore();
        };

        // the halo's own light, gone as he falls
        const glow = MEM_HALO_GLOW * (1 - memEase((fall - 0.1) / 0.4));
        if (glow > 0.001) {
            g.save();
            g.globalCompositeOperation = 'lighter';
            g.globalAlpha *= glow * (0.8 + 0.2 * Math.sin(t * 1.3));
            g.drawImage(memBlob('rgba(255,240,210,1)'), hx - 180, hy - 180, 360, 200);
            g.restore();
        }

        drawn.filter(d => !d.front).sort((a, b) => a.depth - b.depth).forEach(piece);
        const body = memHeadless();
        g.save();
        g.rotate(-Math.PI / 2 + lean);
        g.drawImage(body, -MEM_L / 2, -MEM_L / SHAPE_ASPECT / 2, MEM_L, MEM_L / SHAPE_ASPECT);
        g.restore();
        const bw = HL_HEAD_W * MEM_L * pose.headSize, bh = bw * BALL_RY / BALL_RX;
        const period = memLerp(MEM_ANGEL_HEAD_PERIOD, MEM_HEAD_PERIOD, bodyK);
        g.save();
        g.translate(hx, hy);
        g.rotate(lean + (pose.headTurn + pose.headSway * Math.sin(t * 2 * Math.PI / period)) * Math.PI / 180);
        g.drawImage(ballImg, -bw / 2, -bh / 2, bw, bh);
        g.restore();
        drawn.filter(d => d.front).sort((a, b) => a.depth - b.depth).forEach(piece);
        g.restore();

        const out = p => [x + p[0] * scale, y + bob * scale + p[1] * scale];
        const hand = side => { const s = slots.get(side + 'palm0'); return out([s.x, s.y]); };
        return { halo: out([hx, hy - 76]), head: out([hx, hy]), hands: [hand(1), hand(-1)] };
    }

    // how long a memory's card is up; the menu asks, so a tap on the card
    // can skip to the scene
    function memoryCardSecs(n) { return MEM_CARD_IN + MEM_CARD_HOLD + MEM_CARD_OUT; }

    // Each memory's scene, by its id in MENU_MEMS...
    const MEM_SCENES = {
        exhortation: s => memRally(s), salvation: s => memStand(s), cycle: s => memCycle(s),
        counsel: s => memCounsel(s), fall: s => memFall(s), consolidation: s => memCourt(s),
    };
    // ...and when each is over, in seconds into it: all of them end on black
    const MEM_ENDS = {
        exhortation: () => MR_CUT, salvation: () => MS_CUT, cycle: () => MY_CUT,
        counsel: () => MQ_CUT, fall: () => MF_BLACK[1], consolidation: () => MC_CUT,
    };
    const MEM_AFTER = 2;             // seconds on the black before it goes back by itself

    // Whether a memory up t seconds is finished, black and all, and should go
    // back without being asked.
    function memoryDone(n, t) {
        const end = MEM_ENDS[n];
        return !!end && t - memHold.by >= memoryCardSecs(n) + end() + MEM_AFTER;
    }

    // n is a memory's id in MENU_MEMS; t is seconds since it came up
    let memHold = { t: -1, by: 0 };
    function memoryDraw(n, t) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, LW, LH);
        memFontsLoad();
        // Waiting on the faces: the card stays full for as long as they are
        // not in, up to MEM_FONT_WAIT, and everything after it runs that much
        // later. A t that goes back is the memory starting over.
        if (t < memHold.t) memHold.by = 0;
        memHold.t = t;
        const full = MEM_CARD_IN + MEM_CARD_HOLD;
        if (!memFontsIn && t - memHold.by > full && t < full + MEM_FONT_WAIT) memHold.by = t - full;
        t -= memHold.by;
        const card = memoryCardSecs(n);
        if (t < card) {
            const y = -MENU_MEMS.find(m => m.id === n).year;
            ctx.globalAlpha = Math.max(0, Math.min(1, t / MEM_CARD_IN, (card - t) / MEM_CARD_OUT));
            text(y + (y === 1 ? ' YEAR' : ' YEARS') + ' EARLIER', LW / 2, LH / 2 + 14,
                 MEM_CARD_PX, '#f2efe9', 'center');
            ctx.globalAlpha = 1;
            return;
        }
        const scene = MEM_SCENES[n];
        if (scene) scene(t - card);
    }

    // Year 0 is not drawn here: it is the town, and MEMORIES takes you back
    // to it the way the game first did (menuReturn).

    // the faces are asked for the first time a memory is up, so a player who
    // never sees one never fetches them; a face that fails still lets the
    // memory go on, after MEM_FONT_WAIT
    let memFontsAsked = false, memFontsIn = false;
    function memFontsLoad() {
        if (memFontsAsked) return;
        memFontsAsked = true;
        if (!document.fonts) { memFontsIn = true; return; }
        Promise.all(Object.values(MEM_VOICE).map(v => document.fonts.load(v.font.replace('{px}', 20))))
            .then(() => { memFontsIn = true; }, () => { memFontsIn = true; });
    }

    // ---- 99 years back: how he fell ------------------------------------------------------
    // Seconds into the scene, after the card. The Brandon who stands there
    // first is clay all over and lit from inside; he is looking away, out of
    // the frame, and never turns. The Angel drifts in and speaks. Then the
    // colour runs out of the one who was there first and into the halo, and
    // the halo falls into arms, while he screams the Angel's name. He goes
    // grey, and comes apart the way every Brandon does, and his light swells
    // as he goes -- a death that size lights the room. The Fallen says the
    // dead one's name, and goes up and out of the top of the frame.
    const MF_FADE_IN = 1.0;
    const MF_ENTER = [1.5, 4.5];         // the Angel drifts in from the left
    const MF_SAY_0 = [5.0, 7.8];
    const MF_SAY_1 = [8.1, 12.1];
    const MF_DRAIN = [12.6, 18.6];       // the colour leaves the one he stood by
    const MF_FALL = [13.1, 18.1];        // ...and the halo falls into arms
    const MF_SCREAM = [14.1, 17.1];
    const MF_BREAK = 19.1;               // grey, he starts to come apart
    const MF_BREAK_SPAN = 4.5;           // first piece to last
    const MF_SWELL = [18.6, 21.6, 26.1]; // his light rises, holds, and is gone by the last
    const MF_SAY_2 = [26.6, 30.6];
    const MF_FLY = [31.1, 33.1];         // up and out of the top
    const MF_BLACK = [32.1, 34.1];
    const MF_SAY_IN = 0.4;               // seconds a line takes to come up, and to go
    const MF_GROUND = 575;
    const MF_LU_X = 250, MF_LU_FROM = -170;
    const MF_LU_H = 240;                 // the Angel's height
    const MF_ODIN_X = 590;
    const MF_ODIN_H = MF_LU_H * 1.5;     // the one he stood by is half again his height
    const MF_ODIN_GLOW = 'rgba(255,210,120,0.9)';
    const MF_ODIN_RAYS = 28;
    const MF_STREAMS = 44;               // flecks of colour in flight at once, at the height of it
    // The Angel speaks first, and it is the Angel's name the dying one
    // screams; the Fallen is who asks forgiveness.
    const MF_LINES = {
        say0: [['It was you all along.', 'angel']],
        say1: [['I do what must be done for our world to heal.', 'angel']],
        scream: [['BRANDON', 'angel'], ['!', 'odin']],
        say2: [['Forgive me, ', 'fallen'], ['BRANDON', 'odin'], ['.', 'fallen']],
    };

    let mf = null;       // the scene's own state: its halo, its crumble, its clock
    function memFall(s) {
        if (!memHeadless() || !ready(ballImg) || !greySprite()) return;
        if (!mf || s < mf.last) mf = { last: s, spin: 0, crumble: null };
        const dt = Math.min(0.1, s - mf.last);
        mf.last = s;
        const span = ([a, b]) => memClamp((s - a) / (b - a));
        const fall = span(MF_FALL);
        const drain = memEase(span(MF_DRAIN));
        mf.spin += dt * (1 + MEM_HALO_SPIN * memEase(fall / 0.35)) * 2 * Math.PI / MEM_HALO_PERIOD;

        // his light: dimming as it is drawn out of him, then the swell
        const [sw0, sw1, sw2] = MF_SWELL;
        const swell = s < sw0 ? 0 : s < sw1 ? memEase((s - sw0) / (sw1 - sw0))
                    : 1 - memEase((s - sw1) / (sw2 - sw1));
        const aura = (1 - 0.75 * drain) * (s < MF_BREAK ? 1 : 0) + 1.6 * swell;
        const scene = memEase(s / MF_FADE_IN) * (1 - memEase(span(MF_BLACK)));

        ctx.save();
        ctx.globalAlpha = scene;
        memOdin(MF_ODIN_X, MF_GROUND, MF_ODIN_H, true, s, aura, drain, s < MF_BREAK);
        if (s >= MF_BREAK) memOdinCrumble(dt);

        const enter = memEase(span(MF_ENTER));
        const fly = span(MF_FLY);
        const luX = memLerp(MF_LU_FROM, MF_LU_X, enter);
        const scale = MF_LU_H / MEM_L;
        const luY = MF_GROUND - MEM_L / 2 * scale - 8 * scale - fly * fly * (LH + MF_LU_H * 2);
        const at = memLucifer(ctx, s, luX, luY, scale, fall, mf.spin);

        memStreams(s, drain, at);

        if (s < MF_BREAK + 1) {
            memLine(MF_LINES.say0, at.head[0], 120, 24, span(MF_SAY_0), MF_SAY_0);
            memLine(MF_LINES.say1, at.head[0], 120, 24, span(MF_SAY_1), MF_SAY_1);
            memLine(MF_LINES.scream, MF_ODIN_X, 90, 44, span(MF_SCREAM), MF_SCREAM, 2);
        }
        memLine(MF_LINES.say2, at.head[0], 120, 24, span(MF_SAY_2), MF_SAY_2);
        ctx.restore();
    }

    // A line said, faded up and down across [start, end]. Each part is
    // [words, whose voice]. It wraps to fit the frame, each row centred over x
    // and kept inside it, the first row's baseline at y. `shake` px of
    // tremble, for a scream.
    const MEM_LINE_PAD = 24;         // px a row keeps clear of each side of the frame
    function memLine(parts, x, y, px, k, [a, b], shake) {
        if (k <= 0 || k >= 1) return;
        const secs = b - a, into = k * secs;
        const alpha = Math.min(1, into / MF_SAY_IN, (secs - into) / MF_SAY_IN);
        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.textAlign = 'left';
        const font = f => MEM_VOICE[f].font.replace('{px}', px);
        // words, each keeping the space after it, and whose voice it is in
        const words = [];
        for (const [w, f] of parts) {
            for (const bit of w.split(/(?<=\s)/)) {
                ctx.font = font(f);
                words.push({ w: bit, f, width: ctx.measureText(bit).width,
                             bare: ctx.measureText(bit.trimEnd()).width });
            }
        }
        const rows = [[]];
        let run = 0;
        for (const wd of words) {
            if (run + wd.bare > LW - MEM_LINE_PAD * 2 && rows[rows.length - 1].length) { rows.push([]); run = 0; }
            rows[rows.length - 1].push(wd);
            run += wd.width;
        }
        const jx = shake ? (Math.sin(into * 53) + Math.sin(into * 31)) * shake / 2 : 0;
        const jy = shake ? Math.sin(into * 47) * shake / 2 : 0;
        rows.forEach((row, r) => {
            const total = row.reduce((p, wd, i) => p + (i === row.length - 1 ? wd.bare : wd.width), 0);
            let cx = Math.max(16, Math.min(LW - 16 - total, x - total / 2));
            for (const wd of row) {
                ctx.font = font(wd.f);
                ctx.fillStyle = MEM_VOICE[wd.f].ink;
                ctx.fillText(wd.w, cx + jx, y + r * px * 1.3 + jy);
                cx += wd.width;
            }
        });
        ctx.restore();
    }

    // HIM -- the one who stood by the Angel: clay all over, his own head
    // included, and lit from inside. His light is a glow that breathes, two
    // fans of rays turning against each other, and motes rising through it;
    // `aura` is how much of it there is, 1 his own and more for a swell.
    // `drain` runs his clay to the grey every Brandon goes at the end, and
    // `body` false draws only the light (his body is coming apart). Mirrored,
    // his head is on the right.
    let mfRays = null;
    function memOdin(x, ground, L, mirror, s, aura, drain, body) {
        const cy = ground - L / 2 - 6;
        const [hx0, hy] = memOnBody(0, cy, L, 0, HL_HEAD_U, HL_HEAD_V);
        const hx = x + (mirror ? -hx0 : hx0);
        const ax = (hx + x) / 2, ay = (hy + cy) / 2 - L * 0.08;
        const breathe = 0.5 + 0.5 * Math.sin(s * 2 * Math.PI / 3.2);
        if (aura > 0.001) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha *= Math.min(1, (0.35 + 0.2 * breathe) * aura);
            const gs = L * (1.5 + 0.08 * breathe + 0.9 * Math.max(0, aura - 1));
            ctx.drawImage(memBlob(MF_ODIN_GLOW), ax - gs / 2, ay - gs / 2, gs, gs);
            ctx.restore();
            const rs = L * (1.9 + 0.5 * Math.max(0, aura - 1));
            for (const [dir, al, sc] of [[1, 0.55, 1], [-1, 0.35, 0.8]]) {
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha *= Math.min(1, al * aura * (0.8 + 0.2 * breathe));
                ctx.translate(ax, ay);
                ctx.rotate(dir * s * 2 * Math.PI / 70);
                ctx.drawImage(memOdinRays(), -rs * sc / 2, -rs * sc / 2, rs * sc, rs * sc);
                ctx.restore();
            }
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const base = ctx.globalAlpha;
            for (let i = 0; i < 26; i++) {
                const life = (s / (5 + 3 * memHash(i)) + memHash(i + 9)) % 1;
                const mx = ax + (memHash(i + 30) - 0.5) * L * 0.9 + Math.sin(s + i) * 8;
                const my = ground - life * L * 1.2;
                const ms = (3 + 4 * memHash(i + 40)) * L / 450;
                ctx.globalAlpha = base * Math.min(1, Math.sin(life * Math.PI) * 0.8 * aura);
                ctx.drawImage(memBlob('rgba(255,235,180,1)'), mx - ms * 2, my - ms * 2, ms * 4, ms * 4);
            }
            ctx.restore();
        }
        if (!body) return;
        const T = L / SHAPE_ASPECT;
        ctx.save();
        ctx.translate(x, cy);
        if (mirror) ctx.scale(-1, 1);
        ctx.rotate(-Math.PI / 2);
        if (drain < 1) ctx.drawImage(memFlesh(MEM_CLAY), -L / 2, -T / 2, L, T);
        if (drain > 0) {
            ctx.globalAlpha *= drain;
            ctx.drawImage(greySprite(), -L / 2, -T / 2, L, T);
        }
        ctx.restore();
    }

    // His grey body coming apart along the same grid, in the same order, as
    // every Brandon's does (see shatter). The pieces are laid out in his own
    // levelled frame and turned up with him, but they drift and sink down the
    // screen, the way a standing Brandon's would.
    function memOdinCrumble(dt) {
        const L = MF_ODIN_H, x = MF_ODIN_X, cy = MF_GROUND - L / 2 - 6, T = L / SHAPE_ASPECT;
        if (!mf.crumble) mf.crumble = shatter(x, cy, L, MF_BREAK_SPAN);
        stepCrumble(mf.crumble, dt, 0);
        const sp = greySprite();
        const cw = L / MCOLS, ch = T / MROWS;
        const sw = sp.width / MCOLS, sh = sp.height / MROWS;
        const base = ctx.globalAlpha;
        for (const p of mf.crumble.pieces) {
            const a = Math.max(0, 1 - p.age / F_GONE);
            if (a <= 0.002) continue;
            const lx = (p.u + 0.5) * cw - L / 2, ly = (p.v + 0.5) * ch - T / 2;
            ctx.save();
            ctx.globalAlpha = base * a;
            // turned head-up, then mirrored: (lx, ly) -> (-ly, -lx)
            ctx.translate(x - ly + p.dy * 0.3, cy - lx - p.dx * 0.3 + Math.abs(p.dy));
            ctx.scale(-1, 1);
            ctx.rotate(-Math.PI / 2 + p.rot);
            ctx.drawImage(sp, p.u * sw, p.v * sh, sw, sh, -cw / 2 - 0.5, -ch / 2 - 0.5, cw + 1, ch + 1);
            ctx.restore();
        }
    }

    function memOdinRays() {
        if (mfRays) return mfRays;
        const c = document.createElement('canvas');
        c.width = c.height = 1024;
        const g = c.getContext('2d');
        g.translate(512, 512);
        for (let i = 0; i < MF_ODIN_RAYS; i++) {
            const a = i / MF_ODIN_RAYS * 2 * Math.PI;
            const len = (i % 2 ? 330 : 500) * (0.8 + 0.4 * memHash(i + 50));
            const gr = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
            gr.addColorStop(0, 'rgba(255,230,160,0.55)');
            gr.addColorStop(1, 'rgba(255,200,110,0)');
            g.fillStyle = gr;
            const w = 0.045 + 0.03 * memHash(i + 70);
            g.beginPath();
            g.moveTo(0, 0);
            g.lineTo(Math.cos(a - w) * len, Math.sin(a - w) * len);
            g.lineTo(Math.cos(a + w) * len, Math.sin(a + w) * len);
            g.closePath();
            g.fill();
        }
        return mfRays = c;
    }

    // The colour leaving him: flecks of clay off his body, arcing over to the
    // halo and, once there are hands to take it, into the hands.
    function memStreams(s, drain, at) {
        const [a, b] = MF_DRAIN;
        if (s < a || s > b + 1) return;
        const L = MF_ODIN_H, cy = MF_GROUND - L / 2 - 6;
        const rate = Math.sin(memClamp((s - a) / (b - a)) * Math.PI);
        ctx.save();
        const base = ctx.globalAlpha;
        for (let i = 0; i < MF_STREAMS; i++) {
            const period = 1.1 + 0.6 * memHash(i + 300);
            const life = (s / period + memHash(i + 310)) % 1;
            // each fleck is let go only while the drain is running
            const born = s - life * period;
            if (born < a || born > b) continue;
            const [fx, fy] = memOnBody(0, cy, L, 0, 0.15 + 0.8 * memHash(i + 320), 0.2 + 0.6 * memHash(i + 330));
            const sx = MF_ODIN_X - fx, sy = fy;
            const to = i % 3 === 0 && drain > 0.4 ? at.hands[i % 2] : at.halo;
            const k = life * life;
            const mx = (sx + to[0]) / 2, my = Math.min(sy, to[1]) - 90 - 60 * memHash(i + 340);
            const px = (1 - k) * (1 - k) * sx + 2 * (1 - k) * k * mx + k * k * to[0];
            const py = (1 - k) * (1 - k) * sy + 2 * (1 - k) * k * my + k * k * to[1];
            const r = 2.5 + 3.5 * memHash(i + 350);
            ctx.globalAlpha = base * rate * Math.sin(life * Math.PI);
            ctx.fillStyle = MEM_CLAY;
            ctx.beginPath();
            ctx.arc(px, py, r, 0, 2 * Math.PI);
            ctx.fill();
        }
        ctx.restore();
    }

    // ---- SURTR -----------------------------------------------------------------------
    // The one everybody is afraid of: twice HIS height, cold where the clay is
    // warm, dark from the boots up and lit red from under him. His dark is a
    // red that beats under him like a heart, twice and a rest, smoke boiling
    // up through it, and embers. He sways from somewhere high over his head,
    // the way a hung thing sways. `strings` is how much of what he hangs from
    // shows, 0 to 1 -- nearly always none.
    const MS_INK = '#5b4f96';
    const MS_BEAT = 1.7;             // seconds, one heartbeat (two thumps)
    const MS_STRINGS = [[0.95, 0.2], [0.72, 0.1], [0.72, 0.9], [0.45, 0.5], [0.05, 0.4]];
    const memMenace = () => memSprite('menace', (g, w, h) => {
        g.drawImage(memFlesh(MS_INK), 0, 0);
        g.globalCompositeOperation = 'source-atop';
        // along the sprite, u runs boot to head
        const dark = g.createLinearGradient(0, 0, w, 0);
        dark.addColorStop(0, 'rgba(0,0,0,0.75)');
        dark.addColorStop(0.55, 'rgba(0,0,0,0.35)');
        dark.addColorStop(1, 'rgba(0,0,0,0.15)');
        g.fillStyle = dark;
        g.fillRect(0, 0, w, h);
        const under = g.createLinearGradient(0, 0, w * 0.6, 0);
        under.addColorStop(0, 'rgba(190,30,20,0.35)');
        under.addColorStop(1, 'rgba(190,30,20,0)');
        g.fillStyle = under;
        g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = 'source-over';
    });

    // `away` true turns him to face right, the way he leaves
    function memSurtr(x, ground, L, s, strings, away) {
        const f = (s / MS_BEAT) % 1;
        const thump = (c, w) => Math.exp(-((f - c) * (f - c)) / (2 * w * w));
        const b = Math.min(1, thump(0.1, 0.05) + 0.7 * thump(0.3, 0.05));
        const cy = ground - L / 2 - 6;
        ctx.save();
        const base = ctx.globalAlpha;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = base * (0.45 + 0.45 * b);
        const rs = L * (1.25 + 0.06 * b);
        ctx.drawImage(memBlob('rgba(150,10,25,0.95)'), x - rs / 2, cy - rs * 0.42, rs, rs);
        ctx.globalAlpha = base * (0.25 + 0.2 * b);
        const ws = L * 1.9;
        ctx.drawImage(memBlob('rgba(70,10,60,0.9)'), x - ws / 2, cy - ws / 2, ws, ws);
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 46; i++) {
            const life = (s / (6 + 4 * memHash(i + 100)) + memHash(i + 110)) % 1;
            const sx = x + (memHash(i + 120) - 0.5) * L * 0.75 + Math.sin(s * 0.6 + i) * L * 0.05 * life;
            const sy = ground - L * 0.1 - life * L * 1.05;
            const ss = L * (0.12 + 0.22 * life) * (0.7 + 0.6 * memHash(i + 130));
            ctx.globalAlpha = base * Math.sin(life * Math.PI) * 0.8;
            ctx.drawImage(memBlob('rgba(6,2,6,1)'), sx - ss / 2, sy - ss / 2, ss, ss);
        }
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 30; i++) {
            const life = (s / (3 + 3 * memHash(i + 200)) + memHash(i + 210)) % 1;
            const ex = x + (memHash(i + 220) - 0.5) * L * 0.8 + Math.sin(s * 1.3 + i) * 12;
            const ey = ground - life * L * 1.1;
            const es = L * 0.012;
            ctx.globalAlpha = base * Math.sin(life * Math.PI) * (0.5 + 0.5 * memHash(i + 230));
            ctx.drawImage(memBlob('rgba(255,90,40,1)'), ex - es * 2, ey - es * 2, es * 4, es * 4);
        }
        ctx.restore();

        const sway = Math.sin(s * 2 * Math.PI / 7) * 0.018 + Math.sin(s * 2 * Math.PI / 2.9) * 0.004;
        const pivotY = ground - L * 1.25;
        ctx.save();
        ctx.translate(x, pivotY);
        ctx.rotate(sway);
        ctx.translate(-x, -pivotY);
        if (away) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
        if (strings > 0) {
            ctx.save();
            ctx.globalAlpha *= strings;
            ctx.strokeStyle = 'rgba(230,220,210,0.7)';
            ctx.lineWidth = 1.5;
            for (const [u, v] of MS_STRINGS) {
                const [px, py] = memOnBody(x, cy, L, 0, u, v);
                ctx.beginPath();
                ctx.moveTo(px + (u - 0.5) * 30, pivotY - L);
                ctx.lineTo(px, py);
                ctx.stroke();
            }
            ctx.restore();
        }
        const T = L / SHAPE_ASPECT;
        ctx.translate(x, cy);
        ctx.rotate(-Math.PI / 2);
        ctx.drawImage(memMenace(), -L / 2, -T / 2, L, T);
        ctx.restore();
    }

    // one of the army, lying the way they all do, bobbing on his own beat
    function memShip(x, y, hp, tint) {
        const sp = shipSprite(hp, tint);
        if (sp) ctx.drawImage(sp, x - G_SHIP_W / 2, y - G_SHIP_H / 2, G_SHIP_W, G_SHIP_H);
    }

    // The Angel, standing on `ground` at x, `h` tall, his halo turning at its
    // own pace (these scenes keep no clock of their own to spin it up with).
    function memAngel(s, x, ground, h) {
        const scale = h / MEM_L;
        memLucifer(ctx, s, x, ground - MEM_L / 2 * scale - 8 * scale, scale, 0,
                   s * 2 * Math.PI / MEM_HALO_PERIOD);
    }

    // ---- 2784 years back: the rally ---------------------------------------------------
    // HIM, standing over the army that closes the first game -- the same men,
    // the same ranks (intro.js keeps them) -- telling them what is coming and
    // what it is called. They shout his name back at him, and while they do
    // he strikes the one in the middle of the front rank. That one grows, and
    // goes grey, and rises into the place over them -- the Brandon the first
    // game ends on, set exactly where the opening sets him -- and HE goes up
    // and out of the top of the frame. The grown one shouts HIS name after
    // him, and it cuts. The Angel stands at his
    // right hand the whole time, his first general, and goes when he goes.
    const MR_FADE_IN = 1.2;
    const MR_LINES = [
        [[1.5, 5.0], [['We must prepare for the day of reckoning.', 'odin']]],
        [[5.3, 10.3], [['To protect ourselves from ', 'odin'], ['BRANDON', 'surtr'],
                       [' we must sharpen ourselves with combat!', 'odin']]],
        [[10.6, 14.6], [['Fight until we are strong enough to save our future!', 'odin']]],
        [[14.9, 17.4], [['To stop ', 'odin'], ['BRANDON', 'surtr'], ['!', 'odin']]],
    ];
    const MR_CHEER = [17.6, 21.6];   // they shout his name back
    const MR_ZAP = [18.6, 19.5];     // the bolt, from him to the chosen one
    const MR_GROW = [19.2, 22.6];    // the chosen one grows into his place over them
    const MR_GO = [19.8, 24.3];      // HE rises out of the top of the frame
    const MR_SHOUT = [22.6, 24.9];   // the one he made, grown, shouts HIS name
    const MR_CUT = 25.3;             // to black, no fade
    const MR_ODIN_H = 360;
    const MR_ANGEL_H = MR_ODIN_H / 1.5;
    const MR_ANGEL_X = 225;          // at HIS right hand: HE faces you, so that is your left
    const MR_HOP = 14;               // px each of them jumps as he cheers
    const MR_SHOUTS = 14;            // how many BRANDON!s go up
    const MR_BOLT_KINK = 0.07;       // seconds each shape of the bolt holds
    const MR_BOLT_BENDS = 9;

    function memRally(s) {
        if (s >= MR_CUT || !greySprite() || typeof introFloor !== 'function') return;
        const span = ([a, b]) => memClamp((s - a) / (b - a));
        ctx.save();
        ctx.globalAlpha = memEase(s / MR_FADE_IN);
        // he stands behind the back rank, so they are all between you and him
        const ground = slotY(G_MAX - 1) + 4;
        const go = span(MR_GO);
        const up = go * go * (ground + MR_ODIN_H * 1.3);
        // behind them while he stands, and in front of the one he made once
        // he goes, so his going is seen
        const odin = () => {
            memOdin(LW / 2, ground - up, MR_ODIN_H, false, s, 1, 0, true);
            memAngel(s, MR_ANGEL_X, ground - up, MR_ANGEL_H);
        };
        if (s < MR_GO[0]) odin();
        const [c0, c1] = MR_CHEER;
        const cheer = s >= c0 && s < c1;
        const army = introFloor().slice().sort((a, b) => a.y - b.y);
        // the chosen one: the middle of the front rank, where the opening
        // stands its first arrival
        const one = army.reduce((b, m) =>
            Math.abs(m.x - LW / 2) + Math.abs(m.y - G_SHIP_Y) < Math.abs(b.x - LW / 2) + Math.abs(b.y - G_SHIP_Y) ? m : b);
        const grow = memEase(span(MR_GROW));
        for (const m of army) {
            if (m === one && s >= MR_GROW[0]) continue;
            let y = m.y + Math.sin(s * G_SHIP_HZ * 2 * Math.PI + m.ph) * G_SHIP_BOB;
            if (cheer) y -= Math.max(0, Math.sin(((s - c0) * 2.4 + m.ph) * Math.PI)) * MR_HOP;
            memShip(m.x, y, m.hp, m.tint);
        }
        if (s >= MR_GROW[0]) memRallyChosen(one, grow);
        if (s >= MR_GO[0]) odin();
        memBolt(s, MR_ZAP, LW / 2, ground - up - MR_ODIN_H * 0.55, one.x, one.y, 'rgba(255,200,110,1)');
        for (const [when, parts] of MR_LINES) {
            memLine(parts, LW / 2, 34, 22, memClamp((s - when[0]) / (when[1] - when[0])), when);
        }
        memLine([['BRANDON!', 'odin']], LW / 2, 62, 40, span(MR_SHOUT), MR_SHOUT);
        // the cheer: their shout for HIM, in his voice, going up all over the crowd
        for (let i = 0; i < MR_SHOUTS && cheer; i++) {
            const m = army[Math.floor(memHash(i + 400) * army.length)];
            if (m === one) continue;
            const t0 = c0 + (c1 - c0 - 1.2) * memHash(i + 410);
            const k = (s - t0) / 1.2;
            if (k <= 0 || k >= 1) continue;
            ctx.save();
            ctx.globalAlpha *= Math.sin(k * Math.PI);
            ctx.font = MEM_VOICE.odin.font.replace('{px}', 17);
            ctx.textAlign = 'center';
            ctx.fillStyle = MEM_VOICE.odin.ink;
            ctx.fillText('BRANDON!', m.x, m.y - 26 - k * 22);
            ctx.restore();
        }
        ctx.restore();
    }

    // The chosen one, `k` of the way from his place in the rank to the place
    // over them: HIS light round him at first, his colour going as he grows,
    // and at the end exactly the figure the opening draws (see introWins).
    function memRallyChosen(m, k) {
        const x = memLerp(m.x, LW / 2, k), y = memLerp(m.y, G_Y, k);
        const w = memLerp(G_SHIP_W, G_W0, k);
        const lit = 1 - memEase(k / 0.6);
        if (lit > 0.001) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha *= lit * 0.8;
            const gs = w * 1.4;
            ctx.drawImage(memBlob(MF_ODIN_GLOW), x - gs / 2, y - gs / 2, gs, gs);
            ctx.restore();
        }
        const into = memEase((k - 0.25) / 0.5);    // from his rank's colours to the photograph, greyed
        if (into < 1) {
            const sp = shipSprite(m.hp, m.tint);
            if (sp) {
                ctx.save();
                ctx.globalAlpha *= 1 - into;
                ctx.drawImage(sp, x - w / 2, y - w / SHAPE_ASPECT / 2, w, w / SHAPE_ASPECT);
                ctx.restore();
            }
        }
        if (into > 0) drawFigure(x, y, w, into * ctx.globalAlpha, into, 0);
    }

    // A strike: a crooked line from (x0, y0) to (x1, y1) across [a, b] that
    // changes shape as it holds, a wide soft `glow` under a thin pale core,
    // faded in and out rather than flashed.
    function memBolt(s, [a, b], x0, y0, x1, y1, glow) {
        const k = (s - a) / (b - a);
        if (k <= 0 || k >= 1) return;
        const alpha = Math.min(1, k / 0.12, (1 - k) / 0.3);
        const seed = Math.floor(s / MR_BOLT_KINK);
        const pts = [[x0, y0]];
        const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
        for (let i = 1; i < MR_BOLT_BENDS; i++) {
            const f = i / MR_BOLT_BENDS, off = (memHash(seed * 17 + i + x1) - 0.5) * 60 * Math.sin(f * Math.PI);
            pts.push([x0 + dx * f - dy / len * off, y0 + dy * f + dx / len * off]);
        }
        pts.push([x1, y1]);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineJoin = 'round';
        for (const [wd, col, al] of [[12, glow, 0.35], [3, 'rgba(255,248,230,1)', 0.95]]) {
            ctx.globalAlpha = alpha * al;
            ctx.strokeStyle = col;
            ctx.lineWidth = wd;
            ctx.beginPath();
            pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
            ctx.stroke();
        }
        ctx.restore();
    }

    // ---- 1701 years back: the stand ---------------------------------------------------
    // HIM at the head of his army, facing the one he warned them of. They
    // surge; he stops them and sends them back out of the frame, and walks up
    // to it alone. For a moment you can see what it hangs from, and then you
    // cannot. It cuts on what he says. The Angel is in the ranks, and goes
    // back with them.
    const MS_FADE_IN = 1.2;
    const MS_TAUNT = [1.5, 5.0];
    const MS_SURGE = [5.0, 6.3];     // the army lunges...
    const MS_HALT = [6.2, 9.2];
    const MS_BACK = [8.0, 10.5];     // ...and is sent back out of the frame
    const MS_STEP = [10.5, 12.5];    // he walks up to it alone
    const MS_SEEN = [12.8, 13.0, 13.3, 13.9];   // the strings: up, held, and gone by the last
    const MS_LAST = [14.8, 18.8];
    const MS_CUT = 19.2;
    const MS_GROUND = 575;
    const MS_ODIN_H = 250;
    const MS_SURTR_H = MS_ODIN_H * 2;
    const MS_ODIN_X = [210, 300];    // where he stands, and where he walks to
    const MS_SURTR_X = 590;
    const MS_SURGE_PX = 70, MS_BACK_PX = 700;
    const MS_ANGEL_H = MS_ODIN_H / 1.5;
    const MS_ANGEL_X = 120;          // among the ranks, behind the front of them
    const MS_LINES = {
        taunt: [['You will not triumph today, ', 'odin'], ['BRANDON', 'surtr'], ['!', 'odin']],
        halt: [['This moment is mine. Stand back.', 'odin']],
        last: [['You are not the ', 'odin'], ['BRANDON', 'surtr'], [' I imagined.', 'odin']],
    };
    // the army behind him: three ranks, stepping back and to the left
    let msArmy = null;
    function memStandArmy() {
        if (msArmy) return msArmy;
        msArmy = [];
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 6; c++) {
                const i = r * 6 + c, h = memHash(i + 500);
                msArmy.push({ x: 40 + c * 62 + (r % 2) * 30, y: 480 + r * 34, ph: memHash(i + 510) * 6.28,
                              hp: h < 0.08 ? 3 : h < 0.22 ? 2 : 1,
                              tint: TIER_KEYS[Math.floor(memHash(i + 520) * TIER_KEYS.length)] });
            }
        }
        return msArmy;
    }

    function memStand(s) {
        if (s >= MS_CUT || !greySprite()) return;
        const span = ([a, b]) => memClamp((s - a) / (b - a));
        ctx.save();
        ctx.globalAlpha = memEase(s / MS_FADE_IN);
        memSurtr(MS_SURTR_X, MS_GROUND, MS_SURTR_H, s, memSeen(s, MS_SEEN));
        const back = span(MS_BACK);
        const shift = MS_SURGE_PX * memEase(span(MS_SURGE)) - MS_BACK_PX * back * back;
        memAngel(s, MS_ANGEL_X + shift, MS_GROUND - 40, MS_ANGEL_H);
        for (const m of memStandArmy()) {
            memShip(m.x + shift, m.y + Math.sin(s * G_SHIP_HZ * 2 * Math.PI + m.ph) * G_SHIP_BOB, m.hp, m.tint);
        }
        const ox = memLerp(MS_ODIN_X[0], MS_ODIN_X[1], memEase(span(MS_STEP)));
        memOdin(ox, MS_GROUND, MS_ODIN_H, true, s, 1, 0, true);
        const over = MS_GROUND - MS_ODIN_H - 30;
        memLine(MS_LINES.taunt, ox, over, 22, span(MS_TAUNT), MS_TAUNT);
        memLine(MS_LINES.halt, ox, over, 22, span(MS_HALT), MS_HALT);
        memLine(MS_LINES.last, ox, over, 22, span(MS_LAST), MS_LAST);
        ctx.restore();
    }

    // ---- 92 years back: the court -----------------------------------------------------
    // All of it in silhouette, black against the ember of a hall: the Fallen
    // over it all, and five Brandons coming up to him and standing in a
    // half circle under him. He gives each a kingdom, and strikes them, and
    // each comes apart and goes back together as one of the five this game is
    // fought against -- in outline, so you know the shapes before you meet
    // them. They shout his name, and it cuts.
    const MC_FADE_IN = 1.2;
    const MC_ARRIVE = 1.0;           // the first of them starts up out of the bottom...
    const MC_WALK = 2.0;             // ...takes this long to get to his place...
    const MC_GAP = 0.45;             // ...and the next starts this much later
    const MC_SAY = [5.5, 10.8];
    const MC_ZAP = 11.2;             // the first strike; each after it MC_GAP later
    const MC_ZAP_SECS = 0.7;
    const MC_TURN = 1.6;             // seconds each takes to come apart and back as his boss
    const MC_SHOUT = [15.2, 17.6];
    const MC_CUT = 18.1;
    const MC_INK = '#080504';
    const MC_LU = [400, 150, 0.5];   // where the Fallen is, his middle, and his scale
    const MC_SMALL_H = 90;           // how tall each of the five is when he comes
    const MC_CELL = 6;               // px, the grain they come apart in
    // where the five stand, left to right, and which level's boss each becomes
    const MC_RING = [[156, 318, 1], [262, 412, 2], [400, 450, 3], [538, 412, 4], [644, 318, 5]];
    const MC_LINE = [['...and to my loyal followers I grant you your own kingdom in this new world.', 'fallen']];

    function memCourt(s) {
        if (s >= MC_CUT || !memWhole() || !memHeadless() || !ready(ballImg)) return;
        ctx.save();
        ctx.globalAlpha = memEase(s / MC_FADE_IN);
        // the hall's light, behind them all
        const gr = ctx.createRadialGradient(LW / 2, 220, 20, LW / 2, 260, 560);
        gr.addColorStop(0, 'rgba(150,72,40,0.75)');
        gr.addColorStop(0.5, 'rgba(70,28,18,0.45)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, LW, LH);

        const g = memOffscreen();
        const [lx, ly, lsc] = MC_LU;
        const at = memLucifer(g, s, lx, ly, lsc, 1, 0);
        MC_RING.forEach(([x, y, n], i) => {
            const walk = memEase((s - MC_ARRIVE - i * MC_GAP) / MC_WALK);
            const turn = memClamp((s - MC_ZAP - i * MC_GAP - MC_ZAP_SECS * 0.5) / MC_TURN);
            memCourtOne(g, s, x, memLerp(LH + MC_SMALL_H, y, walk), n, turn, i);
        });
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = MC_INK;
        g.fillRect(0, 0, LW, LH);
        g.globalCompositeOperation = 'source-over';
        ctx.drawImage(memCanvas, 0, 0, LW, LH);

        MC_RING.forEach(([x, y], i) => {
            const a = MC_ZAP + i * MC_GAP;
            const hand = at.hands[x < LW / 2 ? 1 : 0];
            memBolt(s, [a, a + MC_ZAP_SECS], hand[0], hand[1], x, y - 20, 'rgba(201,122,90,1)');
        });
        memLine(MC_LINE, LW / 2, 34, 22, memClamp((s - MC_SAY[0]) / (MC_SAY[1] - MC_SAY[0])), MC_SAY);
        MC_RING.forEach(([x, y], i) => {
            const a = MC_SHOUT[0] + i * 0.15;
            memLine([['BRANDON!', 'fallen']], x, y - 96, 18, memClamp((s - a) / (MC_SHOUT[1] - a)), [a, MC_SHOUT[1]]);
        });
        ctx.restore();
    }

    // one of the five at (x, y), `turn` of the way from a Brandon to his boss:
    // the cells of him that have gone, and the cells of it that have come
    function memCourtOne(g, s, x, y, n, turn, i) {
        const wig = (dg, hz) => Math.sin(s * hz + i * 1.9) * dg * Math.PI / 180;
        const small = () => {
            const L = MC_SMALL_H, T = L / SHAPE_ASPECT;
            g.save();
            g.translate(x, y);
            g.rotate(-Math.PI / 2 + wig(2, 1.6));
            g.drawImage(memWhole(), -L / 2, -T / 2, L, T);
            g.restore();
        };
        const boss = () => {
            g.save();
            g.translate(x, y);
            g.rotate(wig(3, 1.3));
            const sc = 1 + 0.03 * Math.sin(s * 2.1 + i);
            g.scale(sc, sc);
            MC_BOSSES[n](g, s);
            g.restore();
        };
        if (turn <= 0) { small(); return; }
        if (turn >= 1) { boss(); return; }
        const cells = (keep) => {
            g.beginPath();
            for (let cy = -130, r = 0; cy < 120; cy += MC_CELL, r++) {
                for (let cx = -100, c = 0; cx < 100; cx += MC_CELL, c++) {
                    if ((memHash(r * 131 + c * 7 + i * 1000) < turn) === keep) g.rect(x + cx, y + cy, MC_CELL, MC_CELL);
                }
            }
            g.clip();
        };
        g.save(); cells(false); small(); g.restore();
        g.save(); cells(true); boss(); g.restore();
    }

    // Each boss in outline, built from what he is built from, centred on
    // (0, 0) and fitting in about 180 across: WINDMILL a head on a stem with
    // brandons for petals, IDOL one enormous head, TWINS a big one and a
    // small one facing each other, LAMPS one hung over three stood on end,
    // and GLEEOK the headless body upended with three heads on its necks.
    const memMcBody = (g, x, y, L, a, flip) => {
        const T = L / SHAPE_ASPECT;
        g.save();
        g.translate(x, y);
        g.rotate(a);
        if (flip) g.scale(-1, 1);
        g.drawImage(memWhole(), -L / 2, -T / 2, L, T);
        g.restore();
    };
    const memMcHead = (g, x, y, w) => {
        const h = w * BALL_RY / BALL_RX;
        g.drawImage(ballImg, x - w / 2, y - h / 2, w, h);
    };
    const MC_BOSSES = {
        1: (g, s) => {                               // WINDMILL
            g.fillStyle = '#000';
            g.fillRect(-2, -400, 4, 380);
            for (let p = 0; p < 6; p++) {
                const a = s * 0.6 + p * Math.PI / 3;
                memMcBody(g, Math.cos(a) * 42, -20 + Math.sin(a) * 42, 62, a, false);
            }
            memMcHead(g, 0, -20, 38);
        },
        2: (g) => memMcHead(g, 0, -20, 118),         // IDOL
        3: (g) => {                                  // TWINS
            memMcBody(g, -38, -30, 120, 0, false);
            memMcBody(g, 52, -10, 78, 0, true);
        },
        4: (g, s) => {                               // LAMPS
            memMcBody(g, 0, -70 + Math.sin(s * 1.4) * 3, 120, 0, false);
            for (const lx of [-48, 0, 48]) memMcBody(g, lx, 10 + Math.sin(s + lx) * 3, 70, -Math.PI / 2, false);
        },
        5: (g, s) => {                               // GLEEOK
            const L = 130, T = L / SHAPE_ASPECT;
            g.save();
            g.translate(0, -70);
            g.rotate(Math.PI / 2);
            g.drawImage(memHeadless(), -L / 2, -T / 2, L, T);
            g.restore();
            g.strokeStyle = '#000';
            g.lineWidth = 7;
            for (const [hx, hy, ph] of [[-46, 40, 0], [0, 58, 2], [46, 40, 4]]) {
                const sway = Math.sin(s * 1.5 + ph) * 5;
                g.beginPath();
                g.moveTo(0, -8);
                g.quadraticCurveTo(hx * 0.3, 20, hx + sway, hy);
                g.stroke();
                memMcHead(g, hx + sway, hy + 12, 30);
            }
        },
    };

    // A silhouette is drawn whole off to one side, then filled flat over only
    // what was drawn, and laid on the screen: the field under it is already
    // lit, so it cannot be filled there.
    let memCanvas = null;
    function memOffscreen() {
        if (!memCanvas) memCanvas = document.createElement('canvas');
        const c = memCanvas;
        if (c.width !== canvas.width || c.height !== canvas.height) {
            c.width = canvas.width; c.height = canvas.height;
        }
        const g = c.getContext('2d');
        g.setTransform(c.width / LW, 0, 0, c.height / LH, 0, 0);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
        g.clearRect(0, 0, LW, LH);
        return g;
    }

    // how much of what Surtr hangs from shows at s: up across the first two
    // of [up, held, going, gone], held, and down across the last two
    function memSeen(s, [e0, e1, e2, e3]) {
        return s < e0 ? 0 : s < e1 ? (s - e0) / (e1 - e0) : s < e2 ? 1 : 1 - memClamp((s - e2) / (e3 - e2));
    }

    // an army's "BRANDON!", `count` of them going up over `where` (a list of
    // [x, y]) across [c0, c1], in `voice`
    function memShouts(s, where, count, [c0, c1], voice, seed) {
        if (s < c0 || s >= c1) return;
        for (let i = 0; i < count; i++) {
            const [x, y] = where[Math.floor(memHash(i + seed) * where.length)];
            const t0 = c0 + (c1 - c0 - 1.2) * memHash(i + seed + 50);
            const k = (s - t0) / 1.2;
            if (k <= 0 || k >= 1) continue;
            ctx.save();
            ctx.globalAlpha *= Math.sin(k * Math.PI);
            ctx.font = MEM_VOICE[voice].font.replace('{px}', 17);
            ctx.textAlign = 'center';
            ctx.fillStyle = MEM_VOICE[voice].ink;
            ctx.fillText('BRANDON!', x, y - 26 - k * 22);
            ctx.restore();
        }
    }

    // ---- 1342 years back: the cycle ---------------------------------------------------
    // The Angel at the head of a great host, facing the one they fear. They
    // shout his name at him; he says nothing, and then his own name, and for a
    // moment what he hangs from shows. Then he turns and runs, and they shout
    // HIS name after him. It cuts on the cheer.
    const MY_FADE_IN = 1.2;
    const MY_JEER = [1.8, 4.6];      // the host shouts his name at him
    const MY_NOTHING = [5.0, 7.4];
    const MY_NAME = [7.8, 10.4];
    const MY_SEEN = [10.6, 10.8, 11.1, 11.7];
    const MY_RUN = [12.0, 14.2];     // he turns and is gone off the right
    const MY_CHEER = [12.6, 15.6];   // ...and they shout HIS name
    const MY_CUT = 16.2;
    const MY_GROUND = 575;
    const MY_ANGEL = [520, 170];     // where the Angel stands, and his height
    const MY_SURTR = [660, 510];     // where it stands, and its height: three times his
    const MY_RUN_PX = 900;
    const MY_HOP = 14;
    let myArmy = null;
    function memCycleArmy() {
        if (myArmy) return myArmy;
        myArmy = [];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 8; c++) {
                const i = r * 8 + c, h = memHash(i + 600);
                myArmy.push({ x: 20 + c * 58 + (r % 2) * 28, y: 452 + r * 34, ph: memHash(i + 610) * 6.28,
                              hp: h < 0.08 ? 3 : h < 0.22 ? 2 : 1,
                              tint: TIER_KEYS[Math.floor(memHash(i + 620) * TIER_KEYS.length)] });
            }
        }
        return myArmy;
    }

    function memCycle(s) {
        if (s >= MY_CUT || !greySprite()) return;
        const span = ([a, b]) => memClamp((s - a) / (b - a));
        ctx.save();
        ctx.globalAlpha = memEase(s / MY_FADE_IN);
        const run = span(MY_RUN);
        const sx = MY_SURTR[0] + run * run * MY_RUN_PX;
        const bob = run > 0 ? Math.abs(Math.sin(s * 9)) * 10 : 0;
        memSurtr(sx, MY_GROUND - bob, MY_SURTR[1], s, memSeen(s, MY_SEEN), run > 0);
        const army = memCycleArmy();
        const hopping = [MY_JEER, MY_CHEER].find(([a, b]) => s >= a && s < b);
        for (const m of army) {
            let y = m.y + Math.sin(s * G_SHIP_HZ * 2 * Math.PI + m.ph) * G_SHIP_BOB;
            if (hopping) y -= Math.max(0, Math.sin(((s - hopping[0]) * 2.4 + m.ph) * Math.PI)) * MY_HOP;
            memShip(m.x, y, m.hp, m.tint);
        }
        memAngel(s, MY_ANGEL[0], MY_GROUND, MY_ANGEL[1]);
        const where = army.map(m => [m.x, m.y]);
        memShouts(s, where, 16, MY_JEER, 'surtr', 700);
        memShouts(s, where, 16, MY_CHEER, 'odin', 800);
        const over = MY_GROUND - MY_SURTR[1] - 20;
        memLine([['...', 'surtr']], MY_SURTR[0], over, 30, span(MY_NOTHING), MY_NOTHING);
        memLine([['BRANDON', 'surtr']], MY_SURTR[0], over, 30, span(MY_NAME), MY_NAME);
        ctx.restore();
    }

    // ---- 126 years back: counsel ------------------------------------------------------
    // The one they fear walking away out of the frame, beaten back once more,
    // what it hangs from showing for a moment as it goes. The Angel comes to
    // HIM and asks whether this ever ends. HE says it does not, unless they
    // let it. It cuts on HIS answer.
    const MQ_FADE_IN = 1.2;
    const MQ_LEAVES = [0.3, 6.5];    // it walks off the right
    const MQ_SEEN = [1.8, 2.0, 2.3, 2.9];
    const MQ_ENTER = [4.0, 7.0];     // the Angel comes in from the left
    const MQ_ASK = [7.5, 13.5];
    const MQ_ANSWER = [14.0, 22.5];
    const MQ_CUT = 23.0;
    const MQ_GROUND = 575;
    const MQ_ANGEL_H = 170;
    const MQ_ANGEL_X = [-120, 170];
    const MQ_ODIN = [360, MQ_ANGEL_H * 1.5];
    const MQ_SURTR = [640, MQ_ANGEL_H * 3];
    const MQ_WALK_PX = 700;
    const MQ_ASK_LINE = [['Are we destined to stave off annihilation forever? ' +
                          'Or is our end inevitable and we only delay it?', 'angel']];
    const MQ_ANSWER_LINE = [['There is no end unless we so choose one. We have kept ', 'odin'],
                            ['BRANDON', 'surtr'],
                            [' at bay countless times and we shall do so countless more times. ' +
                             'It is our sacred duty to protect our world.', 'odin']];

    function memCounsel(s) {
        if (s >= MQ_CUT || !greySprite()) return;
        const span = ([a, b]) => memClamp((s - a) / (b - a));
        ctx.save();
        ctx.globalAlpha = memEase(s / MQ_FADE_IN);
        const leave = memEase(span(MQ_LEAVES));
        if (leave < 1) {
            memSurtr(MQ_SURTR[0] + leave * MQ_WALK_PX, MQ_GROUND - Math.abs(Math.sin(s * 3.2)) * 6,
                     MQ_SURTR[1], s, memSeen(s, MQ_SEEN), true);
        }
        memOdin(MQ_ODIN[0], MQ_GROUND, MQ_ODIN[1], true, s, 1, 0, true);
        const ax = memLerp(MQ_ANGEL_X[0], MQ_ANGEL_X[1], memEase(span(MQ_ENTER)));
        memAngel(s, ax, MQ_GROUND, MQ_ANGEL_H);
        memLine(MQ_ASK_LINE, ax, 200, 22, span(MQ_ASK), MQ_ASK);
        memLine(MQ_ANSWER_LINE, MQ_ODIN[0], 200, 22, span(MQ_ANSWER), MQ_ANSWER);
        ctx.restore();
    }
