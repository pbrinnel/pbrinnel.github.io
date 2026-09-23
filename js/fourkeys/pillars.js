'use strict';

    // ---- THE PILLARS (mini-boss) -------------------------------------------------
    // Two columns of stone brandons standing on end against the side walls,
    // stepping inward on a clock. The upper field narrows with them: your
    // angles and the room a head has both go. Only the bottom man of a column
    // can be knocked off, and knocking him off steps that side back out.
    // Clear a column and that side is done. Let them meet in the middle and it
    // costs you a life, and they go back to the walls to start again.
    let PIL_LVL   = 2;
    let PIL_N     = 5;       // men in a column
    let PIL_MAN   = 120;     // how long a man is, standing on end
    let PIL_STEP  = 34;      // px a column steps in
    let PIL_EVERY = 5;       // seconds between steps
    let PIL_TOP   = 20;      // where the top of a column sits
    let PIL_PTS   = 120;     // one knocked off
    LAB_KNOBS.push('PIL_LVL', 'PIL_N', 'PIL_MAN', 'PIL_STEP', 'PIL_EVERY', 'PIL_TOP', 'PIL_PTS');

    let pil = null;

    LAB_MINI.pillars = {
        start() {
            const n = Math.max(1, Math.round(PIL_N));
            const make = side => ({ side, men: n, x: side < 0 ? 0 : LW, in: 0, flash: 0, hitT: 0 });
            pil = { cols: [make(-1), make(1)], t: 0, off: 0, crushes: 0 };
            return true;
        },
        reset() { pil = null; },
        busy() { return !!pil && pil.cols.some(c => c.men > 0); },
        update(dt) {
            if (!pil) return;
            for (const c of pil.cols) if (c.flash > 0) c.flash = Math.max(0, c.flash - dt * 6);
            if (phase !== 'play') return;
            pil.t += dt;
            if (pil.t >= PIL_EVERY) {
                pil.t -= PIL_EVERY;
                for (const c of pil.cols) if (c.men > 0) c.in += PIL_STEP;
            }
            // met in the middle: it costs you, and they go back to the walls
            const gap = LW - pil.cols.reduce((s, c) => s + (c.men > 0 ? c.in + pilThick() : 0), 0);
            if (gap <= 0) {
                pil.crushes++;
                for (const c of pil.cols) c.in = 0;
                pil.t = 0;
                loseLife();
            }
        },
        ballStep(b) {
            if (!pil) return;
            for (const c of pil.cols) {
                if (c.men <= 0) continue;
                const [x0, x1] = pilSpan(c);
                const top = PIL_TOP, bot = PIL_TOP + c.men * pilStep();
                const hit = boxContact(b, x0, top, x1, bot);
                if (!hit) continue;
                labBounce(b, hit);
                // the bottom man is the only one who can be knocked off
                if (hit.cy < bot - pilStep()) {
                    rings.push({ x: hit.cx, y: hit.cy, t: 1 });
                    return;
                }
                c.flash = 1;
                c.men--;
                c.in = Math.max(0, c.in - PIL_STEP);
                pil.off++;
                award(PIL_PTS, hit.cx, hit.cy);
                if (!pil.cols.some(k => k.men > 0)) labClearIfDone();
                return;
            }
        },
        draw: pilDraw,
        finish() {
            if (!pil) return false;
            for (const c of pil.cols) c.men = Math.min(c.men, 1);
            return true;
        },
        state() {
            const [a, b] = pil.cols;
            const gap = Math.round(LW - a.in - b.in - (a.men > 0 ? pilThick() : 0) - (b.men > 0 ? pilThick() : 0));
            return { name: 'THE PILLARS',
                     line: a.men + ' left / ' + b.men + ' left · ' + Math.max(0, gap) +
                           ' px between them · ' + pil.crushes + ' times they met' };
        }
    };

    // a man on end: as wide as he is thick, and as tall as he is long
    function pilThick() { return PIL_MAN / SHAPE_ASPECT; }
    function pilStep() { return PIL_MAN; }
    function pilSpan(c) {
        return c.side < 0 ? [c.in, c.in + pilThick()] : [LW - c.in - pilThick(), LW - c.in];
    }

    function pilDraw() {
        if (!pil) return;
        const sp = statueSprite();
        const w = PIL_MAN, h = pilThick();
        for (const c of pil.cols) {
            const [x0] = pilSpan(c);
            for (let i = 0; i < c.men; i++) {
                const cx = x0 + h / 2, cy = PIL_TOP + (i + 0.5) * pilStep();
                ctx.save();
                ctx.translate(cx, cy);
                // on end, head up, turned to face into the field
                ctx.rotate(-Math.PI / 2);
                if (c.side > 0) ctx.scale(1, -1);
                if (sp) {
                    const m = STONE_RIM_PAD * (w / bw);
                    ctx.drawImage(sp, -w / 2 - m, -h / 2 - m, w + 2 * m, h + 2 * m);
                }
                if (c.flash > 0 && i === c.men - 1) {
                    ctx.globalAlpha = Math.min(1, c.flash) * 0.6;
                    ctx.drawImage(shapeSprite('flash', '#f2efe9', w, h, true), -w / 2, -h / 2, w, h);
                    ctx.globalAlpha = 1;
                }
                ctx.restore();
            }
        }
    }