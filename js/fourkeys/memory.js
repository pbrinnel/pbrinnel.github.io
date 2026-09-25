'use strict';

    // ---- a memory ---------------------------------------------------------------------
    // What the first win on a level shows, and MEMORIES shows again: a card
    // saying how far back it is, the fifth level the nearest, then HIM, only
    // just visible against the black. He is brandon stood up on his boot,
    // leaning a little, with the ball where his head should be, and two long
    // arms whose every bone is a small copy of the paddle, ending in two
    // jointed fingers each. The head rocks, the arms rise and fall, and the
    // fingers wave, and under him it says only "...".
    //
    // The menu draws this through memoryDraw and asks memoryCardSecs how long
    // the card is up, both behind a typeof: the boss lab builds menu.js
    // without this file. Nothing here is read at load time, so it can load
    // before the engine and headless.js whose names it uses.
    const MEM_CARD_IN = 0.45;        // seconds the card takes to come up
    const MEM_CARD_HOLD = 1.6;       // ...stays up
    const MEM_CARD_OUT = 0.4;        // ...and takes to go
    const MEM_SCENE_IN = 1.2;        // seconds he takes to come out of the dark
    const MEM_CARD_PX = 43;          // the card's size, as 2000 YEARS LATER's
    const MEM_SAY = '...';
    const MEM_SAY_Y = 560;
    // One colour for all of him: the clay of a hand taken nearly to black, so
    // he is a shape you only just make out.
    const MEM_INK = '#080504';

    // where he stands: his middle, and how tall he is stood up
    const MEM_X = 400, MEM_Y = 320, MEM_L = 360;
    const MEM_LEAN = 14 * Math.PI / 180;    // off vertical, top to the right
    // the ball on his shoulders: off where his own head was in px, its turn
    // on top of his lean, and its width as a share of his own head's
    const MEM_HEAD_DX = 10, MEM_HEAD_DY = -12;
    const MEM_HEAD_TURN = -15.5;            // degrees, the middle of its rock
    const MEM_HEAD_SIZE = 1.3;
    // How he moves. Each is a sine: a swing in degrees either side and a
    // period in seconds. A finger joint runs MEM_FINGER_LAG of a cycle behind
    // the one before it, which turns a curl into a wave out to the tip.
    const MEM_HEAD_SWAY = 9.5, MEM_HEAD_PERIOD = 1.8;
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

    function memoryCardSecs() { return MEM_CARD_IN + MEM_CARD_HOLD + MEM_CARD_OUT; }

    // n is the level, 1 to 5; t is seconds since it came up
    function memoryDraw(n, t) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, LW, LH);
        const card = memoryCardSecs();
        if (t < card) {
            ctx.globalAlpha = Math.max(0, Math.min(1, t / MEM_CARD_IN, (card - t) / MEM_CARD_OUT));
            text((6 - n) + (n === 5 ? ' YEAR' : ' YEARS') + ' EARLIER', LW / 2, LH / 2 + 14,
                 MEM_CARD_PX, '#f2efe9', 'center');
            ctx.globalAlpha = 1;
            return;
        }
        const s = t - card;
        ctx.globalAlpha = Math.min(1, s / MEM_SCENE_IN);
        memoryFigure(s);
        text(MEM_SAY, LW / 2, MEM_SAY_Y, 28, '#f2efe9', 'center');
        ctx.globalAlpha = 1;
    }

    // His body levelled, cut once with and once without his head.
    let memBodies = null;
    function memBody(headless) {
        if (!memBodies) {
            if (!ready(paddleImg)) return null;
            const w = 600, h = Math.round(w / SHAPE_ASPECT);
            const bake = cut => {
                const c = document.createElement('canvas');
                c.width = w; c.height = h;
                const g = c.getContext('2d');
                placeShape(g, w, h, false);
                if (cut) {
                    g.globalCompositeOperation = 'destination-out';
                    g.beginPath();
                    HL_CUT.forEach(([u, v], i) => i ? g.lineTo(u * w, v * h) : g.moveTo(u * w, v * h));
                    g.closePath();
                    g.fill();
                }
                return c;
            };
            memBodies = { whole: bake(false), cut: bake(true) };
        }
        return headless ? memBodies.cut : memBodies.whole;
    }

    // He is drawn whole off to one side, then filled flat in one colour over
    // only what was drawn, and laid on the screen: the field under him is
    // black already, so he cannot be filled there.
    let memCanvas = null;
    function memoryFigure(t) {
        const whole = memBody(false), cut = memBody(true);
        if (!whole || !ready(ballImg)) return;
        if (!memCanvas) memCanvas = document.createElement('canvas');
        const c = memCanvas;
        if (c.width !== canvas.width || c.height !== canvas.height) {
            c.width = canvas.width; c.height = canvas.height;
        }
        const g = c.getContext('2d');
        g.setTransform(c.width / LW, 0, 0, c.height / LH, 0, 0);
        g.globalCompositeOperation = 'source-over';
        g.clearRect(0, 0, LW, LH);

        const L = MEM_L, T = L / SHAPE_ASPECT;
        const A = -Math.PI / 2 + MEM_LEAN;
        const at = (u, v) => {
            const lx = (u - 0.5) * L, ly = (v - 0.5) * T;
            return [MEM_X + lx * Math.cos(A) - ly * Math.sin(A),
                    MEM_Y + lx * Math.sin(A) + ly * Math.cos(A)];
        };
        const wave = (period, phase) => Math.sin(2 * Math.PI * (t / period + phase));

        // The shoulder raises and lowers the arm, the elbow gives back half of
        // that so the hand bobs rather than sweeping out, and the wrist
        // follows a beat late.
        const arms = [1, -1].map(side => {
            const [sx, sy] = at(MEM_SHOULDER[0], MEM_SHOULDER[1]);
            const ph = side > 0 ? 0 : MEM_ARM_OFFSET;
            const arm = wave(MEM_ARM_PERIOD, ph);
            const finger = f => [0, 1, 2].map(k => -MEM_FINGER_CURL *
                wave(MEM_FINGER_PERIOD, ph - f * MEM_FINGER_OFFSET - k * MEM_FINGER_LAG));
            return { x: sx + side * T * 0.30, y: sy, side,
                     shoulder: MEM_ARM_SWING * arm, elbow: -0.5 * MEM_ARM_SWING * arm,
                     wrist: 0.4 * MEM_ARM_SWING * wave(MEM_ARM_PERIOD, ph - 0.15),
                     f1: finger(0), f2: finger(1) };
        });

        const elbows = arms.map(a => memChain(g, whole, a.x, a.y, [MEM_ARM[0]], a.side, 0, 0, [a.shoulder]));

        g.save();
        g.translate(MEM_X, MEM_Y);
        g.rotate(A);
        g.drawImage(cut, -L / 2, -T / 2, L, T);
        g.restore();

        const [hx, hy] = at(HL_HEAD_U, HL_HEAD_V);
        const bw = HL_HEAD_W * L * MEM_HEAD_SIZE, bh = bw * BALL_RY / BALL_RX;
        g.save();
        g.translate(hx + MEM_HEAD_DX, hy + MEM_HEAD_DY);
        g.rotate(MEM_LEAN + (MEM_HEAD_TURN + MEM_HEAD_SWAY * wave(MEM_HEAD_PERIOD, 0)) * Math.PI / 180);
        g.drawImage(ballImg, -bw / 2, -bh / 2, bw, bh);
        g.restore();

        arms.forEach((a, i) => {
            const [ex, ey, acc0] = elbows[i];
            const [wx, wy, acc1] = memChain(g, whole, ex, ey, [MEM_ARM[1]], a.side, 1, acc0, [a.elbow]);
            const [px, py, acc2] = memChain(g, whole, wx, wy, [MEM_PALM], a.side, 2, acc1, [a.wrist]);
            memChain(g, whole, px, py, MEM_F1, a.side, 3, acc2, a.f1);
            memChain(g, whole, px, py, MEM_F2, a.side, 4, acc2, a.f2);
        });

        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = MEM_INK;
        g.fillRect(0, 0, LW, LH);
        g.globalCompositeOperation = 'source-over';
        ctx.drawImage(c, 0, 0, LW, LH);
    }

    // Walk a chain of bones out from (x, y). Each link turns by its own delta
    // in degrees, and a turn carries on down the rest of the chain the way
    // bending an elbow carries the hand; `acc` is what the chain has turned
    // by already, and comes back out for the next piece. Every other bone is
    // flipped end for end, so boot meets boot and head meets head.
    function memChain(g, img, x, y, links, side, i, acc, deltas) {
        links.forEach(([len, deg0, thick], n) => {
            acc += deltas[n] || 0;
            const deg = (deg0 + acc) * Math.PI / 180;
            const a = side > 0 ? deg : Math.PI - deg;
            g.save();
            g.translate(x, y);
            g.rotate(a);
            if ((i + n) % 2) { g.translate(len, 0); g.scale(-1, 1); }
            // a hair of overlap at each end so the joints close up
            g.drawImage(img, -thick * 0.15, -thick / 2, len + thick * 0.3, thick);
            g.restore();
            x += Math.cos(a) * len;
            y += Math.sin(a) * len;
        });
        return [x, y, acc];
    }
