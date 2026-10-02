'use strict';

    // ---- the paddles ---------------------------------------------------------------
    // What you hold for a whole run, so a variant has to read at a glance and
    // has to give up as much as it gains. Every one is the same photograph with
    // something done to it -- a wash, a rim, a light, some specks, BLUR's
    // quills -- over a handful of factors on the paddle the game already has:
    //
    //   len    how long he is            angle  how far his ends throw a head
    //   edge   spin off his ends         swipe  spin from his own travel
    //   dip    how far he leans for one going past
    //   deck   how wide his flat middle is, so how much of him is a curve
    //   caps   how long a capsule lasts him
    //   split  two of him, with a hole down the middle
    //   favour a capsule he is partial to     portal  PORTAL on for as long as he is
    //   heavy  hits a head of his lands on silver and gold at once
    //
    // Nothing here touches how fast he answers the pointer: on a phone the
    // finger IS the paddle, and a paddle that lagged would read as the game
    // ignoring you.
    // `lore` is a few lines of where each one is from, for his PADDLE UNLOCKED
    // card. A famous Brandon in it is written {odin}, {surtr} or {angel}: it
    // prints as "Brandon" in that Brandon's own face, and the rest of the
    // line in the plain voice of nobody in particular -- the memories' rule
    // (MEM_VOICE), so you can tell which one is meant without being told.
    const LAB_PAD = {};
    // Paddles renamed after they shipped: the id each one had, and the id it
    // has now. Progress kept in this browser and leaderboard rows still
    // carry the old ids.
    const PAD_WAS = { gilt: 'gilded', frost: 'crystalline', ember: 'magma' };
    const padNow = k => Object.hasOwn(PAD_WAS, k) ? PAD_WAS[k] : k;
    function padsRenamed(pads) {
        const out = {};
        for (const k of Object.keys(pads)) out[padNow(k)] = pads[k];
        return out;
    }
    let labP = null;
    let padBits = [];               // specks of whatever he sheds
    let deckAtPad = -1;             // the deck cache holds per width AND per paddle
    const PAD_BAKE = 320;           // tints are baked this long and scaled

    let GILDED_LEN = 0.85;   // gilded: shorter...
    let GILDED_CAPS = 1.6;   // ...and every capsule lasts him longer, by this much
    let GILDED_SHINE = 3;    // seconds a sweep of light takes to cross him
    let STAT_LEN   = 1.2;    // statue: longer...
    let STAT_ANGLE = 0.65;   // ...flatter off his ends...
    let STAT_SPIN  = 0.35;   // ...and stone hardly grips, so he puts little spin on
    let STAT_DIP   = 1.3;    // ...but he leans further after one going past
    let STAT_HEAVY = 2;      // ...and a head off him lands this many hits on silver and gold at once
    let CRYST_LEN  = 0.95;   // crystalline: a touch shorter...
    let CRYST_EDGE = 1.5;    // ...spin off his ends...
    let CRYST_SWIPE = 2.2;   // ...and off his travel, both far easier
    let CRYST_DECK = 0.6;    // ...on a narrower flat, so more of him is a curve
    let CRYST_FLAKES = 10;   // snowflakes a second coming off him...
    let CRYST_BIG  = 0.25;   // ...this share of them a big one, six of him heads out
    let ICE_SECS   = 1;      // an icy brick struck sends the head off at full speed this long...
    let ICE_RAMP   = 0.15;   // ...getting there over this, and coming back down over twice it
    let ICE_TURN   = 0.35;   // ...turned this far (rad) the way it is spinning, at the most spin
    let MAGMA_LEN  = 0.7;    // magma: much shorter...
    let MAGMA_CATCH = 0.3;   // ...but a brick a head of his breaks has this chance of going up in embers
    let MAGMA_SPREAD = 0.45; // ...a burning brick this chance of catching each one beside it
    let MAGMA_SPREAD_AT = 1; // ...seconds into burning that it does
    let MAGMA_CRIT = 0.15;   // ...and a wound on a boss from a head of his this chance of counting double
    let MAGMA_GLOW = 0.45;   // how much light he gives off
    let MAGMA_SPARKS = 17;   // sparks a second rising off him
    let MAGMA_ASH  = 6;      // wisps of smoke a second: ambiance, never something to look at...
    let MAGMA_ASH_S = 2.5;   // ...so each only about this many px either side of its middle...
    let MAGMA_ASH_A = 0.3;   // ...and at most this solid
    let PAIR_LEN   = 0.62;   // the pair: two of him, each this much of one
    let PAIR_QUAD  = 0.7;    // ...and under DOUBLE, four, each this much of one of the two
    let PAD_MARK   = 3;      // seconds a head CRYSTALLINE or MAGMA hits wears his frost or fire
    let V2_GLOSS   = 0.22;   // MODERN: how bright the gloss along his top is...
    let V2_GLINT   = 5;      // ...seconds between one glint and the next...
    let V2_SWEEP   = 0.9;    // ...and how long a glint takes to cross him
    let PAD_FAVOUR = 0.5;    // MULTI, PRINCE: this share of capsules is his, before the usual roll
    let MULTI_LEN  = 0.7;    // MULTI: shorter, since every other capsule is a spare head
    let MULTI_SLIP = 4;      // MULTI: px each of his two misprints is out of register, at the game's size...
    let MULTI_PRINT = 0.45;  // ...and how strongly each shows
    let BLUR_LEN   = 0.75;   // BLUR: shorter, so there is less of him to whack with
    let BLUR_SPIN  = 4;      // ...turns a second he spins through, all the way round, at full speed
    let BLUR_SPIN_X = 3;     // ...times the spin a hit off him puts on a head, off his ends and his travel both
    let BLUR_TRAIL = 3;      // ...afterimages of him following round behind
    let BLUR_GAP   = 0.3;    // ...seconds after a whack he only keeps that head out of him
    let BLUR_KICK  = 0.5;    // ...and seconds a whacked head takes to slow back to the game's speed
    let BLUR_UP    = 0.35;   // ...the least share of a whacked head's speed that is upward
    let BLUR_RAMP  = 1.5;    // ...seconds from flat to full spin once a head is served
    let BLUR_SETTLE = 0.25;  // ...and seconds he takes to lie flat again when no head is in play
    let BLUR_BAND  = 40;     // ...px either side of the middle where he keeps the way he is turning
    let BLUR_FLIP  = 0.4;    // ...and seconds to swing from full one way to full the other
    LAB_KNOBS.push('PAD_FAVOUR', 'MULTI_LEN', 'MULTI_SLIP', 'MULTI_PRINT',
                   'BLUR_LEN', 'BLUR_SPIN', 'BLUR_SPIN_X', 'BLUR_TRAIL', 'BLUR_GAP', 'BLUR_KICK', 'BLUR_UP', 'BLUR_RAMP', 'BLUR_SETTLE', 'BLUR_BAND', 'BLUR_FLIP');
    LAB_KNOBS.push('GILDED_LEN', 'GILDED_CAPS', 'GILDED_SHINE', 'STAT_LEN', 'STAT_ANGLE', 'STAT_SPIN',
                   'STAT_DIP', 'STAT_HEAVY', 'CRYST_LEN', 'CRYST_EDGE', 'CRYST_SWIPE', 'CRYST_DECK', 'CRYST_FLAKES', 'CRYST_BIG', 'ICE_SECS', 'ICE_RAMP', 'ICE_TURN',
                   'MAGMA_LEN', 'MAGMA_CATCH', 'MAGMA_SPREAD', 'MAGMA_SPREAD_AT', 'MAGMA_CRIT', 'MAGMA_GLOW', 'MAGMA_SPARKS', 'PAIR_LEN', 'PAIR_QUAD', 'PAD_MARK', 'V2_GLOSS', 'V2_GLINT', 'V2_SWEEP');
    LAB_KNOBS.push('MAGMA_ASH', 'MAGMA_ASH_S', 'MAGMA_ASH_A');

    const V2_RIM    = '#e6edf5';
    const GILDED_INK = '#efb920', GILDED_RIM = '#ffe9a3';
    const CRYST_INK = '#8fe3f2', CRYST_RIM = '#dff6ff';
    const MAGMA_INK = '#e2683a', MAGMA_RIM = '#ffb072';
    const PAIR_INK  = '#8f7fc4';      // DOUBLE's own color, since he is two of him
    // MULTI's own color, as PAIR has DOUBLE's, and a blue to print against it
    const MULTI_INK = '#e0c060', MULTI_BLUE = '#5b8cc4';
    // PRINCE and CHELL are dressed rather than washed (padDress): a color
    // for his shirt and one for his jeans, after who each is named for
    const PRINCE_TOP = '#a8c64e', PRINCE_LEGS = '#8a4fb0', PRINCE_RIM = '#d7ee8c';
    const CHELL_TOP = '#f4f1ea', CHELL_LEGS = '#e0692c', CHELL_RIM = '#ff9a3c';
    const BLUR_INK = '#3a6fe0', BLUR_RIM = '#a9c8ff';
    // BLUR is dressed as Sonic (blurLook): his blue, his peach and his shoes' red
    const BLUR_BLUE = '#2b7cf5', BLUR_PEACH = '#f6c99b', BLUR_RED = '#e3242b';

    // ---- what the game asks -------------------------------------------------------
    function labPadUse(key) {
        labP = LAB_PAD[key] || LAB_PAD.standard;
        labPFrom = null;
        deckAtW = -1;                 // his flat may be a different width now
        padBits = [];
    }
    // The same, but over `secs`: the one in hand fades as the new one comes in,
    // and his length goes from one to the other. What he does is the new one's
    // at once. The VOID's end uses it to hand you the standard paddle.
    let labPFrom = null, labPFade = 0, labPFadeSecs = 1;
    function labPadFade(key, secs) {
        const was = labP;
        labPadUse(key);
        if (was !== labP && secs > 0) { labPFrom = was; labPFade = 0; labPFadeSecs = secs; }
    }
    const labPadFadeK = () => labPFrom ? Math.min(1, labPFade / labPFadeSecs) : 1;
    // how much every look is drawn at: set round each call below, 1 otherwise
    let padK = 1;
    const padLenOf = v => v && v.len ? v.len() : 1;
    const labPadLen   = () => labPFrom ? padLenOf(labPFrom) + (padLenOf(labP) - padLenOf(labPFrom)) * labPadFadeK() : padLenOf(labP);
    // a boss may grow you too: the VOID's end stands you up to Odin's height
    const labPadW     = () => labPadLen() * (labB && labB.padGrow ? labB.padGrow() : 1);
    const labPadAngle = () => labP && labP.angle ? labP.angle() : 1;
    const labPadEdge  = () => labP && labP.edge ? labP.edge() : 1;
    const labPadSwipe = () => labP && labP.swipe ? labP.swipe() : 1;
    const labPadDip   = () => labP && labP.dip ? labP.dip() : 1;
    const labPadDeck  = () => labP && labP.deck ? labP.deck() : 1;
    const labPadCaps  = () => labP && labP.caps ? labP.caps() : 1;
    const labPadSplit = () => !!(labP && labP.split);
    const labPadFavour = () => (labP && labP.favour) || null;
    const labPadPortal = () => !!(labP && labP.portal);
    const labPadBlur = () => !!(labP && labP.blur);
    const labPadHeavy = () => labP && labP.heavy ? labP.heavy() : 1;
    const padQuadOf = v => v && v.quad ? v.quad() : 1;
    const labPadQuad  = () => labPFrom ? padQuadOf(labPFrom) + (padQuadOf(labP) - padQuadOf(labPFrom)) * labPadFadeK() : padQuadOf(labP);

    // what the panel prints about whatever is in hand
    function labPadState() {
        const say = [];
        if (labPadW() !== 1) say.push(Math.round(labPadW() * 100) + '% long');
        if (labPadAngle() !== 1) say.push('angle ×' + labPadAngle().toFixed(2));
        if (labPadEdge() !== 1 || labPadSwipe() !== 1) {
            say.push('spin ×' + labPadEdge().toFixed(2) + ' / ×' + labPadSwipe().toFixed(2));
        }
        if (labPadDeck() !== 1) say.push('flat ×' + labPadDeck().toFixed(2));
        if (labPadDip() !== 1) say.push('lean ×' + labPadDip().toFixed(2));
        if (labPadCaps() !== 1) say.push('capsules ×' + labPadCaps().toFixed(2));
        if (labPadSplit()) say.push('two of him');
        if (labPadFavour()) say.push(Math.round(PAD_FAVOUR * 100) + '% ' + labPadFavour());
        if (labPadPortal()) say.push('PORTAL always');
        if (labPadBlur()) say.push('spinning ' + BLUR_SPIN + '/s');
        if (labPadHeavy() > 1) say.push('×' + labPadHeavy() + ' on silver and gold');
        return { name: (labP && labP.name) || LAB_PAD.standard.name, line: say.join(' · ') || 'as the game has him' };
    }

    // Whatever he sheds, he sheds wherever he is on screen -- the town
    // included, which is where a paddle is chosen and has to show what it is.
    function labPadUpdate(dt) {
        if (labPFrom && (labPFade += dt) >= labPFadeSecs) labPFrom = null;
        if (labP && labP.step && !(king && phase === 'fall')) labP.step(dt);
        padMarkStep(dt);
        padBurnStep(dt);
        padIceStep(dt);
        for (const b of padBits) {
            b.t += dt;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.vy += b.g * dt;
            if (b.sway) b.x += Math.sin(b.t * 3 + b.ph) * b.sway * dt;
        }
        padBits = padBits.filter(b => b.t < b.life);
        for (const x of magmaBlasts) x.t += dt;
        magmaBlasts = magmaBlasts.filter(x => x.t < MAGMA_BLAST);
    }

    // A boss may fade all of you (padAlpha, set here and put back at the end of
    // labPadOver) and lay a skin over whatever you are holding (padSkin). While
    // one paddle fades into another both are drawn, each at its share (padK).
    const padAlphaNow = () => labB && labB.padAlpha ? labB.padAlpha() : 1;
    function padBoth(part, args) {
        const a = padAlphaNow(), k = labPadFadeK();
        if (labPFrom && labPFrom[part]) { padK = a * (1 - k); labPFrom[part](...args); }
        if (labP && labP[part]) { padK = a * k; labP[part](...args); }
        padK = 1;
        ctx.globalAlpha = a;
    }
    function labPadUnder() {
        ctx.globalAlpha = padAlphaNow();
        padBoth('under', []);
    }
    function labPadSkin(sg, o) {
        padBoth('skin', [sg, o]);
        if (labB && labB.padSkin) labB.padSkin(sg, o);
    }
    function labPadOver() {
        padBoth('over', []);
        for (const x of magmaBlasts) {
            const k = x.t / MAGMA_BLAST, r = x.r * (0.3 + 0.7 * Math.sqrt(k));
            // fire glows; STATUE's thud (x.ink) is only the ring
            if (!x.ink) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = (1 - k) * 0.8;
                ctx.drawImage(padGlow(MAGMA_INK), x.x - r * 1.2, x.y - r * 1.2, r * 2.4, r * 2.4);
                ctx.globalCompositeOperation = 'source-over';
            }
            ctx.globalAlpha = 1 - k;
            ctx.strokeStyle = x.ink || MAGMA_RIM;
            ctx.lineWidth = 4 * (1 - k) + 1;
            ctx.beginPath();
            ctx.arc(x.x, x.y, r, 0, 7);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        for (const b of padBits) {
            const a = Math.max(0, 1 - b.t / b.life) * b.a;
            const baked = b.kind === 'bigflake' ? padFlakeSprite(b.ink) : b.kind === 'head' ? padHeadSprite(b.ink) : null;
            if (baked) {
                // s is half its width, as a flake's is
                const w = b.s * 2, h = w * baked.height / baked.width;
                ctx.save();
                ctx.globalAlpha = a;
                ctx.translate(b.x, b.y);
                ctx.rotate(b.ph + b.t * (b.kind === 'head' ? 0.6 : 0.8));
                ctx.drawImage(baked, -w / 2, -h / 2, w, h);
                ctx.restore();
                continue;
            }
            if (b.kind === 'head') continue;     // his art is not in yet
            // a big flake whose sprite is not ready yet is drawn as a small one
            if (b.kind === 'flake' || b.kind === 'bigflake') {
                // a six-armed speck of ice, turning as it goes
                ctx.globalAlpha = a;
                ctx.strokeStyle = b.ink;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                for (let k = 0; k < 3; k++) {
                    const r = b.ph + b.t * 1.5 + k * Math.PI / 3;
                    const dx = Math.cos(r) * b.s, dy = Math.sin(r) * b.s;
                    ctx.moveTo(b.x - dx, b.y - dy);
                    ctx.lineTo(b.x + dx, b.y + dy);
                }
                ctx.stroke();
                continue;
            }
            if (b.kind === 'glow') {
                // a spark with light round it, added to what is under it
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = a * 0.55;
                ctx.drawImage(padGlow(b.ink), b.x - b.s * 2.4, b.y - b.s * 2.4, b.s * 4.8, b.s * 4.8);
                ctx.globalAlpha = a;
                ctx.fillStyle = '#fff1d6';
                ctx.fillRect(b.x - b.s / 4, b.y - b.s / 4, b.s / 2, b.s / 2);
                ctx.globalCompositeOperation = 'source-over';
                continue;
            }
            ctx.globalAlpha = a;
            ctx.fillStyle = b.ink;
            ctx.fillRect(b.x - b.s / 2, b.y - b.s / 2, b.s, b.s);
        }
        ctx.globalAlpha = 1;
    }

    // A spark's light, baked once per color, so each spark in a frame is a
    // drawImage rather than a gradient of its own: MAGMA keeps dozens alive.
    const padGlows = new Map();
    function padGlow(ink) {
        if (padGlows.has(ink)) return padGlows.get(ink);
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, ink);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
        padGlows.set(ink, c);
        return c;
    }

    // Specks big enough to be him, baked small once so a speck is one
    // drawImage and never the whole photograph scaled down every frame. They
    // are the photograph washed, not a flat silhouette: flat, a head is a
    // potato and nobody in particular.
    const PAD_SPECK_BAKE = 96;        // px across a baked speck
    const padSpecks = new Map();
    function padBakeSpeck(key, w, h, ink, wash, draw) {
        if (padSpecks.has(key)) return padSpecks.get(key);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        if (!draw(g)) return null;     // his art is not in yet
        g.filter = 'none';
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = ink;
        g.globalAlpha = wash;
        g.fillRect(0, 0, w, h);
        padSpecks.set(key, c);
        return c;
    }
    // a snowflake of six of him, boots at the middle and heads out, lifted
    // pale so the ink over him reads as ice
    function padFlakeSprite(ink) {
        const R = PAD_SPECK_BAKE / 2;
        return padBakeSpeck('flake' + ink, R * 2, R * 2, ink, 0.7, g => {
            const body = shapeSprite('padFlakeRaw', null, PAD_BAKE, PAD_BAKE / SHAPE_ASPECT, false);
            if (!body) return false;
            const th = R / SHAPE_ASPECT;
            g.filter = 'grayscale(1) contrast(0.5) brightness(3)';
            g.translate(R, R);
            for (let k = 0; k < 6; k++) {
                g.save();
                g.rotate(k * Math.PI / 3);
                g.drawImage(body, 0, -th / 2, R, th);
                g.restore();
            }
            g.setTransform(1, 0, 0, 1, 0, 0);
            return true;
        });
    }
    // his head gone gray and soft as smoke, with `ink` through it. The blur
    // needs room round him or it is cut off square at the canvas edge.
    const PAD_ASH_BLUR = 3;           // px of blur at PAD_SPECK_BAKE: past about 6 he is no longer anyone
    function padHeadSprite(ink) {
        const w = PAD_SPECK_BAKE, h = Math.round(w * BALL_RY / BALL_RX), m = PAD_ASH_BLUR * 2;
        return padBakeSpeck('head' + ink, w + 2 * m, h + 2 * m, ink, 0.35, g => {
            if (!ready(ballImg)) return false;
            g.filter = 'blur(' + PAD_ASH_BLUR + 'px) grayscale(1) contrast(1.35) brightness(1.05)';
            g.drawImage(ballImg, m, m, w, h);
            return true;
        });
    }

    // one speck of whatever he is shedding
    // (null when there are too many already)
    function padBit(x, y, ink, life, vx, vy, g, s, a, kind, sway) {
        if (padBits.length > 400) return null;
        const b = { x, y, ink, t: 0, life, vx: vx || 0, vy: vy || 0, g: g === undefined ? 90 : g,
                    s: s || 2 + Math.random() * 2, a: a === undefined ? 0.9 : a,
                    kind: kind || 'speck', sway: sway || 0, ph: Math.random() * 6.28 };
        padBits.push(b);
        return b;
    }

    // ---- what touches him ------------------------------------------------------------
    // The part of him that something at (x, y) is touching, or null. It is
    // an ellipse rx by ry round that point, tested against his own outline
    // turned the way he is turned (paddle.dip, as heads meet him), so a
    // paddle that leans, or BLUR all the way round, is hit where he is
    // and missed where he is not. Every capsule and every boss's attack asks
    // this, each with the size it always used, so a level paddle is hit just
    // as he was when each of them tested a flat box of their own.
    function padNear(x, y, rx, ry) {
        if (ry === undefined) ry = rx;
        const py = padY();
        for (const sg of segs()) {
            const hw = sg.w / 2, a = paddle.dip[sg.i] || 0, ca = Math.cos(a), sa = Math.sin(a);
            const dx = x - sg.cx, dy = y - py;
            if (Math.abs(dx) > hw + rx + 4 || Math.abs(dy) > hw + ry + 4) continue;
            const lx = dx * ca + dy * sa, ly = dy * ca - dx * sa;
            const e = outlineAt(lx, hw);
            if (e && ly >= e.top && ly <= e.bot) return sg;          // inside him
            for (let u = -hw; u <= hw; u += 3) {
                const o = outlineAt(u, hw);
                if (!o) continue;
                for (const v of [o.top, o.bot]) {
                    const ex = (sg.cx + u * ca - v * sa - x) / rx, ey = (py + u * sa + v * ca - y) / ry;
                    if (ex * ex + ey * ey <= 1) return sg;
                }
            }
        }
        return null;
    }

    // ---- the mark he leaves on a head ----------------------------------------------
    // A head CRYSTALLINE or MAGMA sends back carries a little of him away with it:
    // his tint over it and his specks coming off it, both fading out over
    // PAD_MARK. It changes nothing about the head -- it is how you see which
    // paddle hit it, and a thing to watch as it goes.
    function labPadHit(ball) {
        if (labP && labP.mark) ball.mark = { key: labP.mark, t: PAD_MARK };
    }

    function padMarkStep(dt) {
        if (!balls) return;
        for (const b of balls) {
            const m = b.mark;
            if (!m) continue;
            if ((m.t -= dt) <= 0) { b.mark = null; continue; }
            const k = m.t / PAD_MARK;
            const p = LAB_PAD[m.key];
            if (p && p.shed && Math.random() < dt * p.shedRate * k) p.shed(b.x + (Math.random() - 0.5) * BALL_RX * 1.4,
                                                                      b.y + (Math.random() - 0.5) * BALL_RY * 1.4, k);
        }
    }

    // his tint over the head, turned with it, as strong as the mark has left
    function labPadBall(b, rx) {
        const m = b.mark;
        const p = m && LAB_PAD[m.key];
        if (!p) return;
        const sp = headSprite2('flat', p.ink);
        if (!sp) return;
        const w = rx * 2, h = w * (BALL_RY / BALL_RX);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);
        ctx.globalAlpha = 0.5 * (m.t / PAD_MARK);
        ctx.drawImage(sp, -w / 2, -h / 2, w, h);
        ctx.restore();
    }

    // ---- STATUE's weight ---------------------------------------------------------
    // A head off STATUE strikes silver and gold STAT_HEAVY hits at once
    // (hitBrick), and the blow lands with a thud of its own.
    // the heavy blow landing: a ring of the statues' paler stone and a spray
    // of grit off the brick, bigger than any plain hit's
    function labPadThud(b) {
        magmaBlasts.push({ x: b.x + bw / 2, y: b.y + bh / 2, t: 0, r: (bw + GAP) * 0.6, ink: STONE_RIM });
        for (let n = 0; n < 18; n++) {
            const a = Math.random() * Math.PI * 2, v = 50 + Math.random() * 110;
            padBit(b.x + bw / 2 + (Math.random() - 0.5) * bw * 0.6, b.y + bh / 2,
                   Math.random() < 0.5 ? STONE_RIM : STONE, 0.5 + Math.random() * 0.4,
                   Math.cos(a) * v, Math.sin(a) * v - 30, 260, 2 + Math.random() * 2.5);
        }
    }

    // ---- MAGMA's wildfire -------------------------------------------------------
    // A brick broken by a head that MAGMA has marked has MAGMA_CATCH of going
    // up: it bursts in embers and every brick next to it (corners too)
    // catches. A burning brick wears the head's mark -- his tint, his sparks
    // -- and burns up when PAD_MARK is out, scoring as if you had hit it. Each
    // has one roll of MAGMA_SPREAD for each brick beside it, MAGMA_SPREAD_AT into
    // its burning, so now and then a vein of it runs on through the wall.
    // Only the wall's own bricks down to their last hit ever burn: never a
    // boss, stone, a mini-boss, or silver or gold with more than one hit in it.
    let labHitBy = null;             // the head a hit is from, while the engine hands it over

    function padBurnable(o) {
        return o.alive && !o.lab && !o.burn && 'YGORSA'.includes(o.kind) && o.hp === 1;
    }
    function padBeside(b) {
        const px = (bw + GAP) * 1.01, py = (bh + GAP) * 1.01;
        return bricks.filter(o => o !== b && Math.abs(o.x - b.x) <= px && Math.abs(o.y - b.y) <= py);
    }
    function padIgnite(o) { o.burn = { t: PAD_MARK, spread: MAGMA_SPREAD_AT, rolled: false }; }

    // a brick has just been broken, by whatever labHitBy says
    // Going up is a blast you cannot miss -- a flash, a ring of heat thrown
    // out over the bricks it lights, and a spray of embers -- and a brick
    // burning out goes with a smaller one, so each link of a vein shows.
    let magmaBlasts = [];
    const MAGMA_BLAST = 0.4;           // seconds a blast takes to spread and fade
    function magmaBlast(x, y, big) { magmaBlasts.push({ x, y, t: 0, r: (bw + GAP) * (big ? 1.5 : 0.8) }); }

    function labBrickGone(b) {
        if (!magmaLit() || Math.random() >= MAGMA_CATCH) return;
        magmaBurst(b.x + bw / 2, b.y + bh / 2);
        for (const o of padBeside(b)) if (padBurnable(o)) padIgnite(o);
    }
    // whether the head a hit is from carries MAGMA's fire
    const magmaLit = () => !!(labHitBy && labHitBy.mark && labHitBy.mark.key === 'magma');
    // going up: the blast and a spray of embers
    function magmaBurst(x, y) {
        magmaBlast(x, y, true);
        for (let n = 0; n < 40; n++) {
            const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 160;
            padBit(x, y, Math.random() < 0.4 ? MAGMA_RIM : MAGMA_INK, 0.5 + Math.random() * 0.6,
                   Math.cos(a) * v, Math.sin(a) * v - 40, 60, 2 + Math.random() * 2.5, 0.95, 'glow');
        }
    }

    // ---- MAGMA's crit ----------------------------------------------------------------
    // A boss has no bricks to set alight, so a head carrying MAGMA's fire
    // has MAGMA_CRIT of going up on him instead: the same burst a brick
    // catching makes, and the wound counts double. Every boss asks this for
    // what a wound takes off him; anything else is n as it was.
    function labBite(n, cx, cy) {
        if (!magmaLit() || Math.random() >= MAGMA_CRIT) return n;
        if (cx !== undefined) magmaBurst(cx, cy);
        return n * 2;
    }

    function padBurnStep(dt) {
        if (phase !== 'play' || !bricks) return;
        const shed = LAB_PAD.magma.shed;
        for (const b of bricks) {
            const f = b.burn;
            if (!f) continue;
            if (!b.alive) { b.burn = null; continue; }
            f.t -= dt;
            if (!f.rolled && PAD_MARK - f.t >= f.spread) {
                f.rolled = true;
                for (const o of padBeside(b)) if (padBurnable(o) && Math.random() < MAGMA_SPREAD) padIgnite(o);
            }
            const k = Math.max(0, f.t / PAD_MARK);
            if (Math.random() < dt * 45) shed(b.x + Math.random() * bw, b.y + Math.random() * bh, Math.max(0.6, k));
            if (f.t <= 0) {
                b.burn = null;
                if (b.alive) {
                    magmaBlast(b.x + bw / 2, b.y + bh / 2, false);
                    hitBrick(b, b.x + bw / 2, b.y + bh / 2);
                }
            }
        }
    }

    // ---- CRYSTALLINE's ice -----------------------------------------------------------------
    // A head CRYSTALLINE has marked that strikes a silver or gold and leaves it
    // standing leaves it icy. The next head to strike an icy brick, whoever
    // sent it, goes off it at MAX_SPEED for ICE_SECS, turned a little the way
    // it is spinning -- and the ice is spent, unless that head is CRYSTALLINE's
    // too and the brick still stands.
    // Any strike on an icy brick shatters its ice (SHATTERED), a LASER bolt's
    // too; only a head is sent off by it.
    function labBrickStruck(b) {
        const ball = labHitBy;
        if (b.icy && !ball) { b.icy = false; if (round) round.shattered++; }
        if (!ball) return;
        if (b.icy) {
            b.icy = false;
            if (round) round.shattered++;
            const a = ICE_TURN * Math.max(-1, Math.min(1, ball.spin / SPIN_MAX));
            const c = Math.cos(a), sn = Math.sin(a);
            [ball.vx, ball.vy] = [ball.vx * c - ball.vy * sn, ball.vx * sn + ball.vy * c];
            ball.ice = { t: 0 };
            for (let n = 0; n < 12; n++) {
                padBit(b.x + Math.random() * bw, b.y + Math.random() * bh, Math.random() < 0.5 ? CRYST_RIM : CRYST_INK,
                       0.6 + Math.random() * 0.4, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, 60,
                       2 + Math.random() * 2, 0.9, 'flake');
            }
        }
    }
    // ...and one that it did not break
    function labBrickHeld(b) {
        const ball = labHitBy;
        if (ball && ball.mark && ball.mark.key === 'crystalline' && b.hp >= 1 && !b.lab) b.icy = true;
    }
    function padIceStep(dt) {
        if (!balls) return;
        for (const b of balls) {
            const ic = b.ice;
            if (!ic) continue;
            ic.t += dt;
            const full = MAX_SPEED / Math.max(1, effSpeed());
            const up = Math.min(1, ic.t / ICE_RAMP), down = Math.max(0, (ic.t - ICE_SECS) / (ICE_RAMP * 2));
            b.boost = 1 + (Math.max(1, full) - 1) * up * (1 - Math.min(1, down));
            if (down >= 1) { b.ice = null; b.boost = 1; }
            else if (Math.random() < dt * 40) padBit(b.x, b.y, CRYST_RIM, 0.5, 0, 0, 0, 2, 0.8, 'flake');
        }
    }

    // a burning or icy brick's tint, over it where drawBrick has it
    function labPadBurn(b) {
        if (b.icy) {
            const sp = shapeSprite('iceCrystal', CRYST_INK, bw, bh, true);
            if (sp) {
                ctx.globalAlpha = 0.45 + 0.08 * Math.sin(clock * 2 + b.x);
                ctx.drawImage(sp, -bw / 2, -bh / 2, bw, bh);
                ctx.globalAlpha = 1;
            }
        }
        const f = b.burn;
        if (!f) return;
        const sp = shapeSprite('burnMagma', MAGMA_INK, bw, bh, true);
        if (!sp) return;
        ctx.globalAlpha = 0.5 + 0.35 * Math.max(0, 1 - f.t / PAD_MARK) + 0.12 * Math.sin(clock * 9 + b.x);
        ctx.drawImage(sp, -bw / 2, -bh / 2, bw, bh);
        ctx.globalAlpha = 1;
    }

    // somewhere along one of him, picked at random
    function padSomewhere(spread) {
        const all = segs();
        const sg = all[(Math.random() * all.length) | 0];
        return { sg, x: sg.cx + (Math.random() - 0.5) * sg.w * spread };
    }

    // a level sprite laid over one of him, the way the sluggish tint is
    function padLay(sg, o, sprite, alpha) {
        if (!sprite) return;
        const tw = sg.w, th = tw / SHAPE_ASPECT;
        ctx.save();
        ctx.translate(sg.cx, padY() + o * JIG_PADDLE);
        ctx.rotate(segWig(sg.i) + paddle.dip[sg.i]);
        ctx.globalAlpha = padK * (alpha);
        ctx.drawImage(sprite, -tw / 2, -th / 2, tw, th);
        ctx.globalAlpha = padK;
        ctx.restore();
    }

    const padTint = (key, ink) => shapeSprite(key, ink, PAD_BAKE, PAD_BAKE / SHAPE_ASPECT, false);
    const padFlat = (key, ink) => shapeSprite(key, ink, PAD_BAKE, PAD_BAKE / SHAPE_ASPECT, true);

    // his outline, in one color, a little proud of him all round
    function padRim(key, ink, grow, alpha) {
        const sp = padFlat(key, ink);
        if (!sp) return;
        for (const sg of segs()) {
            const o = paddle.jt[sg.i] > 0 ? wobble(paddle.jt[sg.i]) : 0;
            const tw = sg.w + grow * 2, th = tw / SHAPE_ASPECT;
            ctx.save();
            ctx.translate(sg.cx, padY() + o * JIG_PADDLE);
            ctx.rotate(segWig(sg.i) + paddle.dip[sg.i]);
            ctx.globalAlpha = padK * (alpha);
            ctx.drawImage(sp, -tw / 2, -th / 2, tw, th);
            ctx.globalAlpha = padK;
            ctx.restore();
        }
    }

    // one of them at any size: his look without his behavior. `locked` draws
    // him as the stone he is until you have earned him, and `fade` is for the
    // one nosing in off the wall in the hub, which has not arrived yet.
    function labPadIcon(key, x, y, w, locked, fade) {
        const p = LAB_PAD[key];
        if (!p) return;
        const a0 = fade === undefined ? 1 : fade;
        const lay = (sprite, a, dx, ww, dy) => {
            if (!sprite) return;
            const hh = ww / SHAPE_ASPECT;
            ctx.globalAlpha = a * a0;
            ctx.drawImage(sprite, x + dx - ww / 2, y + (dy || 0) - hh / 2, ww, hh);
            ctx.globalAlpha = 1;
        };
        // the game's own colors are asked for here rather than held on the
        // variant: these files are injected at the top of the closure, where
        // every const of the game's is still in its dead zone
        const rim = p.stone ? STONE_RIM : p.rim;
        const parts = p.twin ? [[-w * 0.28, w * 0.55], [w * 0.28, w * 0.55]] : [[0, w]];
        for (const [dx, ww] of parts) {
            if (locked) {
                lay(shapeSprite('padStone', STONE, PAD_BAKE, PAD_BAKE / SHAPE_ASPECT, 'statue'), 0.8, dx, ww);
                continue;
            }
            if (rim) lay(padFlat('padRimI' + rim, rim), 0.5, dx, ww * 1.06);
            if (p.prints) {
                // out of register by as much of him as they are in play
                const slip = MULTI_SLIP * ww / PADDLE_W;
                ctx.globalCompositeOperation = 'lighter';
                for (const [ink, ux, uy] of p.prints) lay(padFlat('padPrint' + ink, ink), MULTI_PRINT, dx + ux * slip, ww, uy * slip);
                ctx.globalCompositeOperation = 'source-over';
            }
            if (p.stone) lay(shapeSprite('padStone', STONE, PAD_BAKE, PAD_BAKE / SHAPE_ASPECT, 'statue'), 1, dx, ww);
            else {
                lay(shapeSprite('padIcon', null, PAD_BAKE, PAD_BAKE / SHAPE_ASPECT, false), 1, dx, ww);
                // a dress that cannot be made yet (or at all) leaves his plain tint
                const dress = p.dress && p.dress();
                if (dress) lay(dress, p.dressA, dx, ww);
                else if (p.ink && !p.prints) lay(padTint('padTint' + p.ink, p.ink), 0.8, dx, ww);
            }
        }
    }

    // ---- the variants -------------------------------------------------------------
    // MODERN: what you start with. The first game's paddle with a coat of polish
    // -- a pale rim, a gloss along his top and a glint now and then -- and not
    // one number changed, so everything the other variants trade against is
    // still him. The key stays 'standard' so progress already saved still has
    // him in it.
    LAB_PAD.standard = {
        name: 'MODERN',
        rim: V2_RIM,
        blurb: 'starting paddle',
        lore: 'Reborn and freshly polished.',
        under() { padRim('padRimV', V2_RIM, 2, 0.45); },
        skin(sg, o) {
            const sp = padFlat('padGloss', '#ffffff');
            const gl = padGloss(sp);
            if (!sp) return;
            const tw = sg.w, th = tw / SHAPE_ASPECT;
            ctx.save();
            ctx.translate(sg.cx, padY() + o * JIG_PADDLE);
            ctx.rotate(segWig(sg.i) + paddle.dip[sg.i]);
            ctx.globalAlpha = padK * (V2_GLOSS);
            ctx.drawImage(gl, -tw / 2, -th / 2, tw, th);
            // the glint: a narrow band crossing him, then nothing until the next
            const t = (clock % V2_GLINT) / V2_SWEEP;
            if (t < 1) {
                ctx.beginPath();
                ctx.rect(-tw / 2 + (t * 1.2 - 0.1) * tw, -th, tw * 0.08, th * 2);
                ctx.clip();
                ctx.globalAlpha = padK * (0.3);
                ctx.drawImage(sp, -tw / 2, -th / 2, tw, th);
            }
            ctx.globalAlpha = padK;
            ctx.restore();
        }
    };
    // in hand from the first frame: nothing picks a paddle until a gate does,
    // and he has a look of his own to show before then
    labP = LAB_PAD.standard;

    // His outline in white, fading out down him, baked once: a hard-edged
    // band of light reads as a seam across his legs, not as a shine.
    let padGlossBake = null;
    function padGloss(sp) {
        if (padGlossBake || !sp) return padGlossBake;
        const c = document.createElement('canvas');
        c.width = sp.width; c.height = sp.height;
        const g = c.getContext('2d');
        g.drawImage(sp, 0, 0);
        g.globalCompositeOperation = 'destination-in';
        const fade = g.createLinearGradient(0, 0, 0, c.height);
        fade.addColorStop(0, 'rgba(0,0,0,1)');
        fade.addColorStop(0.6, 'rgba(0,0,0,0)');
        g.fillStyle = fade;
        g.fillRect(0, 0, c.width, c.height);
        return (padGlossBake = c);
    }

    // CLASSIC: the first game's paddle, bare. Nothing but the photograph and
    // nothing changed about how he plays -- he is MODERN without the polish,
    // there to be carried for old times' sake. The first level you win gives him.
    LAB_PAD.classic = { name: 'CLASSIC', blurb: 'the original · plays the same as MODERN',
                        lore: 'Brandon' };

    // GILDED: gold leaf over the photograph, with a sweep of light crossing him
    // every few seconds. Shorter than standard, and everything he catches
    // lasts him longer.
    LAB_PAD.gilded = {
        name: 'GILDED',
        ink: GILDED_INK, rim: GILDED_RIM,
        blurb: '15% shorter · power-ups last 60% longer',
        lore: 'Leafed in the gold of the harvest {odin} blessed when he walked these fields.',
        len: () => GILDED_LEN,
        caps: () => GILDED_CAPS,
        under() { padRim('padRimG', GILDED_RIM, 3, 0.5); },
        skin(sg, o) {
            padLay(sg, o, padTint('padGilded', GILDED_INK), 0.8);
            const sp = padFlat('padShine', '#fff6d8');
            if (!sp) return;
            const tw = sg.w, th = tw / SHAPE_ASPECT;
            const t = (clock % GILDED_SHINE) / GILDED_SHINE;
            ctx.save();
            ctx.translate(sg.cx, padY() + o * JIG_PADDLE);
            ctx.rotate(segWig(sg.i) + paddle.dip[sg.i]);
            ctx.beginPath();
            ctx.rect(-tw / 2 + (t * 1.3 - 0.15) * tw, -th, tw * 0.15, th * 2);
            ctx.clip();
            ctx.globalAlpha = padK * (0.34);
            ctx.drawImage(sp, -tw / 2, -th / 2, tw, th);
            ctx.globalAlpha = padK;
            ctx.restore();
        }
    };

    // STATUE: carved, rimmed in pale stone, and shedding dust when struck.
    // Longer than standard and he leans further after a head going past, but
    // stone hardly grips: flat returns, and next to no spin, which is money.
    // What he scores with instead is weight: his heads hit silver and gold
    // STAT_HEAVY times at once (STATUE's weight, above).
    LAB_PAD.statue = {
        name: 'STATUE',
        stone: true,
        blurb: '20% longer, leans 30% further · -65% spin, 35% flatter ends · 2x damage to silver & gold',
        lore: 'Carved larger than life from the ruins\' own stone. Imbued with the power of his likeness.',
        len: () => STAT_LEN,
        angle: () => STAT_ANGLE,
        edge: () => STAT_SPIN,
        swipe: () => STAT_SPIN,
        dip: () => STAT_DIP,
        heavy: () => STAT_HEAVY,
        under() { padRim('padRimS', STONE_RIM, 3, 0.9); },
        skin(sg, o) {
            padLay(sg, o, shapeSprite('padStone', STONE, PAD_BAKE, PAD_BAKE / SHAPE_ASPECT, 'statue'), 1);
        },
        step() {
            for (const sg of segs()) {
                if (paddle.jt[sg.i] < 0.8) continue;
                padBit(sg.cx + (Math.random() - 0.5) * sg.w, padY() + padH() / 2,
                       STONE_RIM, 0.7 + Math.random() * 0.4, (Math.random() - 0.5) * 60, -20 - Math.random() * 40);
            }
        }
    };

    // CRYSTALLINE: cold and bright, throwing sparks as he travels. Spin goes on him
    // far more easily, both off his ends and off his own travel -- and spin is
    // the multiplier -- but his flat middle is narrow, so most of him is the
    // curve of his own outline and a return is less of a sure thing.
    LAB_PAD.crystalline = {
        name: 'CRYSTALLINE',
        ink: CRYST_INK, rim: CRYST_RIM,
        blurb: '5% shorter, 40% smaller sweet spot · +50% end spin, +120% moving spin · ices what it cannot break',
        lore: 'Cut from the ice that sealed the city when {odin} vanished. Forever cold to the touch.',
        len: () => CRYST_LEN,
        edge: () => CRYST_EDGE,
        swipe: () => CRYST_SWIPE,
        deck: () => CRYST_DECK,
        under() { padRim('padRimF', CRYST_RIM, 2.5, 0.55); },
        skin(sg, o) { padLay(sg, o, padTint('padCrystal', CRYST_INK), 0.82); },
        mark: 'crystalline',
        shedRate: 21,
        // one of his flakes, off a head he has hit
        shed(x, y, k) {
            padBit(x, y, Math.random() < 0.5 ? CRYST_RIM : CRYST_INK, 0.9 + Math.random() * 0.6,
                   (Math.random() - 0.5) * 16, 8 + Math.random() * 12, 8, 1.8 + Math.random() * 1.8,
                   0.85 * k + 0.15, 'flake', 16);
        },
        step(dt) {
            // flakes coming off him all the time, drifting down and wandering
            // as they go, the big ones slower and longer, so there is time to
            // see what they are made of...
            if (Math.random() < dt * CRYST_FLAKES) {
                const p = padSomewhere(0.95), big = Math.random() < CRYST_BIG;
                padBit(p.x, padY() + (Math.random() - 0.5) * padH() * 0.6,
                       Math.random() < 0.5 ? CRYST_RIM : CRYST_INK, (big ? 2.2 : 1.4) + Math.random() * 1.2,
                       (Math.random() - 0.5) * 14, (big ? 4 : 6) + Math.random() * (big ? 8 : 14), big ? 4 : 8,
                       big ? 9 + Math.random() * 4 : 2 + Math.random() * 2.2, 0.85,
                       big ? 'bigflake' : 'flake', 18 + Math.random() * 16);
            }
            // ...and a spray of ice behind him when he travels
            const fast = Math.min(1, Math.abs(paddle.vx) / 500);
            for (let n = 0; n < 2; n++) {
                if (Math.random() > fast * 0.56) continue;
                const p = padSomewhere(1);
                padBit(p.x, padY() + (Math.random() - 0.5) * padH(),
                       CRYST_RIM, 0.5 + Math.random() * 0.4, -paddle.vx * 0.12 + (Math.random() - 0.5) * 40,
                       -30 - Math.random() * 40, 40, 1.5 + Math.random() * 2);
            }
        }
    };

    // MAGMA: lit from underneath, throwing sparks that rise. Much shorter than
    // standard, but a head off him carries his fire into the wall, and now
    // and then a brick it breaks goes up and the fire runs on from there
    // (MAGMA's wildfire, above) -- or, on a boss, the wound counts double
    // (MAGMA's crit).
    LAB_PAD.magma = {
        name: 'MAGMA',
        ink: MAGMA_INK, rim: MAGMA_RIM,
        blurb: '30% shorter · 30% of breaks ignite neighbors · 15% chance of 2x boss damage',
        lore: 'Forged in the fire of {surtr}\'s footsteps, he still remembers his name.',
        len: () => MAGMA_LEN,
        under() {
            const r = padW() * 0.95;
            const g = ctx.createRadialGradient(paddle.x, padY(), 8, paddle.x, padY(), r);
            g.addColorStop(0, MAGMA_INK);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            // a steady light with a slow breath in it: nothing here flashes
            ctx.globalAlpha = padK * (MAGMA_GLOW * (0.85 + 0.15 * Math.sin(clock * 1.7)));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(paddle.x, padY(), r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = padK;
            padRim('padRimE', MAGMA_RIM, 2.5, 0.5);
        },
        skin(sg, o) { padLay(sg, o, padTint('padMagma', MAGMA_INK), 0.72); },
        mark: 'magma',
        shedRate: 20,
        // one of his sparks, off a head he has hit
        shed(x, y, k) {
            padBit(x, y, Math.random() < 0.4 ? MAGMA_RIM : MAGMA_INK, 0.5 + Math.random() * 0.5,
                   (Math.random() - 0.5) * 30, -30 - Math.random() * 40, -20, 1.8 + Math.random() * 2,
                   0.95 * k + 0.05, 'glow', 20);
        },
        step(dt) {
            // sparks lifting off him with light round them, weaving as they
            // climb, and left behind when he moves
            let n = MAGMA_SPARKS * dt;
            while (n > 0) {
                if (Math.random() < n) {
                    const p = padSomewhere(0.9);
                    padBit(p.x, padY() - padH() * (0.1 + Math.random() * 0.3),
                           Math.random() < 0.4 ? MAGMA_RIM : MAGMA_INK, 0.8 + Math.random() * 0.9,
                           (Math.random() - 0.5) * 30 - paddle.vx * 0.08, -40 - Math.random() * 70, -30,
                           2 + Math.random() * 2.5, 0.95, 'glow', 20 + Math.random() * 30);
                }
                n -= 1;
            }
            // a thin smoke of his heads, drifting up slower and greyer,
            // turning over as it goes
            if (Math.random() < dt * MAGMA_ASH) {
                const p = padSomewhere(0.8);
                padBit(p.x, padY() - padH() * 0.2, '#8a7f76', 1.8 + Math.random(),
                       (Math.random() - 0.5) * 20, -18 - Math.random() * 20, -4, MAGMA_ASH_S * (0.8 + 0.4 * Math.random()), MAGMA_ASH_A, 'head');
            }
        }
    };

    // THE PAIR: two of him, always, in DOUBLE's own color, each one shorter
    // than standard. Wider reach than anybody and a hole down the middle of
    // it -- and DOUBLE, when it drops, makes four of him, smaller again.
    LAB_PAD.pair = {
        name: 'THE PAIR',
        ink: PAIR_INK, twin: true,
        blurb: 'two of him, each 38% shorter · a hole down the middle · four of him under DOUBLE',
        lore: 'Soldiers. Brandons. How much longer?',
        len: () => PAIR_LEN,
        split: () => true,
        quad: () => PAIR_QUAD,
        under() {
            // an echo of where each of them was, so the hole is easy to read
            const sp = padFlat('padPairGhost', PAIR_INK);
            if (!sp) return;
            for (const sg of segs()) {
                for (const e of TRAIL) {
                    const tx = trailAt(e.back);
                    if (tx === null) continue;
                    const dx = tx - paddle.x;
                    if (Math.abs(dx) < 1.5) continue;
                    const tw = sg.w, th = tw / SHAPE_ASPECT;
                    ctx.save();
                    ctx.translate(sg.cx + dx, padY());
                    ctx.rotate(segWig(sg.i) + paddle.dip[sg.i]);
                    ctx.globalAlpha = padK * (e.a);
                    ctx.drawImage(sp, -tw / 2, -th / 2, tw, th);
                    ctx.globalAlpha = padK;
                    ctx.restore();
                }
            }
        },
        skin(sg, o) { padLay(sg, o, padTint('padPair', PAIR_INK), 0.62); }
    };

    // ---- the ones bosses buy --------------------------------------------------------
    // These three, and BLUR below, come with bosses beaten, counted over
    // every run (MENU_SLAIN_PADS in menu.js), or each with a flawless win of
    // a stage (MENU_FLAWLESS_PADS). These three lean on the
    // capsules: MULTI and PRINCE get PAD_FAVOUR of capsules as their own
    // before the usual roll (the falling capsule in engine.js), and CHELL has
    // PORTAL on all the time (ptOn in powers.js). MULTI pays for his in
    // length; PRINCE and CHELL play as MODERN does.

    // Him in two colors, cut where the photograph is: his shirt and head
    // run from PAD_BELT to his right end and take `top`, his jeans take
    // `legs`, and `boots` puts his boots, left of PAD_BOOTS, back in `top`.
    const PAD_BELT  = [0.5, 0.6];     // across him, where his jeans give way to his shirt
    const PAD_BOOTS = [0.1, 0.17];    // ...and where his boots give way to his jeans
    const padDresses = new Map();
    function padDress(key, top, legs, boots) {
        if (padDresses.has(key)) return padDresses.get(key);
        const a = padTint(key + 'Top', top), b = padTint(key + 'Legs', legs);
        if (!a || !b) return null;
        const c = document.createElement('canvas');
        c.width = a.width; c.height = a.height;
        const g = c.getContext('2d');
        g.drawImage(b, 0, 0);
        g.globalCompositeOperation = 'destination-in';
        const cut = g.createLinearGradient(0, 0, c.width, 0);
        cut.addColorStop(0, boots ? 'rgba(0,0,0,0)' : '#000');
        if (boots) { cut.addColorStop(PAD_BOOTS[0], 'rgba(0,0,0,0)'); cut.addColorStop(PAD_BOOTS[1], '#000'); }
        cut.addColorStop(PAD_BELT[0], '#000');
        cut.addColorStop(PAD_BELT[1], 'rgba(0,0,0,0)');
        g.fillStyle = cut;
        g.fillRect(0, 0, c.width, c.height);
        g.globalCompositeOperation = 'destination-over';
        g.drawImage(a, 0, 0);
        padDresses.set(key, c);
        return c;
    }

    // MULTI: his photograph as it is, over two more prints of him out of
    // register, gold up and left and blue down and right, so there is more
    // than one of him without anything washed over him (a gold wash read as
    // GILDED). `ink` is only for his card.
    LAB_PAD.multi = {
        name: 'MULTI',
        ink: MULTI_INK,
        prints: [[MULTI_INK, -1, -0.5], [MULTI_BLUE, 1, 0.5]],     // color, and which way it slips
        favour: 'M',
        len: () => MULTI_LEN,
        blurb: '30% shorter · 50% of power-ups are MULTI',
        lore: 'Countless soldiers. Countless Brandons. Forever.',
        under() {
            ctx.globalCompositeOperation = 'lighter';
            for (const [ink, ux, uy] of this.prints) {
                const sp = padFlat('padPrint' + ink, ink);
                if (!sp) continue;
                for (const sg of segs()) {
                    const o = paddle.jt[sg.i] > 0 ? wobble(paddle.jt[sg.i]) : 0;
                    const tw = sg.w, th = tw / SHAPE_ASPECT;
                    ctx.save();
                    ctx.translate(sg.cx + ux * MULTI_SLIP, padY() + o * JIG_PADDLE + uy * MULTI_SLIP);
                    ctx.rotate(segWig(sg.i) + paddle.dip[sg.i]);
                    ctx.globalAlpha = padK * MULTI_PRINT;
                    ctx.drawImage(sp, -tw / 2, -th / 2, tw, th);
                    ctx.restore();
                }
            }
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = padK;
        }
    };

    // PRINCE: green over purple, and nothing more.
    LAB_PAD.prince = {
        name: 'PRINCE',
        ink: PRINCE_TOP, rim: PRINCE_RIM,
        favour: 'K',
        dress: () => padDress('padPrince', PRINCE_TOP, PRINCE_LEGS, false),
        dressA: 0.85,
        blurb: '50% of power-ups are KATAMARI, where they can be',
        lore: 'The smallest Brandon there ever was, he rolls up whatever has been left lying around.',
        under() { padRim('padRimP', PRINCE_RIM, 2.5, 0.5); },
        skin(sg, o) { padLay(sg, o, this.dress(), this.dressA); }
    };

    // CHELL: white over orange, with white boots, and PORTAL's edges lit
    // for as long as he is in hand, outside the town.
    LAB_PAD.chell = {
        name: 'CHELL',
        ink: CHELL_LEGS, rim: CHELL_RIM,
        portal: true,
        dress: () => padDress('padChell', CHELL_TOP, CHELL_LEGS, true),
        dressA: 0.8,
        blurb: 'PORTAL always on',
        lore: 'Never speaks.',
        under() { padRim('padRimC', CHELL_RIM, 2.5, 0.5); },
        skin(sg, o) { padLay(sg, o, this.dress(), this.dressA); }
    };

    // ---- BLUR: spinning ---------------------------------------------------------
    // A hit off him puts BLUR_SPIN_X times the usual spin on a head, and he
    // spins himself: all the way round, up to BLUR_SPIN turns a second. With no
    // head in play -- waiting to serve, a life just lost -- he settles flat
    // over BLUR_SETTLE, so a serve leaves a level top, and once it is in
    // play he winds up from still over BLUR_RAMP, so the head's first trip
    // home finds him at full speed or nearly. His turn is paddle.dip, which
    // everything that draws him already turns him by. It is set once a frame
    // (padBlurTurn) and spread across the substeps (padBlurAt), with his
    // ends' sweep counted toward how many there are, so an end cannot jump a
    // head between two looks.
    //
    // The top of him moves the way he turns, so a head he strikes from above
    // is mostly flicked that way. Turning one way all the time, every head
    // went right, and one out by the right wall could only be spiked into it.
    // So he turns toward the middle of the field from whichever half he is
    // in -- clockwise on the left, the other way on the right -- keeps his
    // way inside BLUR_BAND of the middle so he is not forever changing his
    // mind, and swings round over BLUR_FLIP rather than at once.
    let blurA = 0, blurFrom = 0, blurD = 0, blurRate = 0, blurDir = 1, blurFlip = false;
    function padBlurTurn(dt) {
        // a head he whacked slows back to the game's speed (padBlurHit)
        for (const b of balls || []) {
            if (!b.blurKick) continue;
            b.boost = Math.max(1, b.boost - (b.blurKick - 1) * dt / BLUR_KICK);
            if (b.boost <= 1) b.blurKick = 0;
        }
        if (!labPadBlur()) { blurD = 0; blurRate = 0; blurA = 0; return; }
        blurFrom = blurA;
        if (phase === 'play') {
            const dir = paddle.x < LW / 2 - BLUR_BAND ? 1 : paddle.x > LW / 2 + BLUR_BAND ? -1 : blurDir;
            if (dir !== blurDir && blurRate) blurFlip = true;
            blurDir = dir;
            const want = blurDir * BLUR_SPIN;
            const secs = blurFlip ? BLUR_FLIP / 2 : BLUR_RAMP;
            const step = secs > 0 ? BLUR_SPIN * dt / secs : Infinity;
            blurRate = blurRate < want ? Math.min(want, blurRate + step) : Math.max(want, blurRate - step);
            if (blurRate === want) blurFlip = false;
            blurD = blurRate * Math.PI * 2 * dt;
        } else {
            // the short way round to lying flat, his top up: at most half a
            // turn, so at this pace he is level inside BLUR_SETTLE
            blurRate = 0; blurFlip = false;
            blurDir = paddle.x > LW / 2 ? -1 : 1;
            const step = Math.PI * dt / Math.max(1e-3, BLUR_SETTLE);
            blurD = -Math.sign(blurA) * Math.min(Math.abs(blurA), step);
        }
        blurA = Math.atan2(Math.sin(blurA + blurD), Math.cos(blurA + blurD));
        for (const sg of segs()) paddle.dip[sg.i] = blurFrom + blurD;
    }
    // how far his ends travel this frame, in px
    const padBlurSweep = () => Math.abs(blurD) * padW() / 2;
    function padBlurAt(k) {
        if (!blurD) return;
        for (const sg of segs()) paddle.dip[sg.i] = blurFrom + blurD * k;
    }

    // A head against him, from any side, going any way. The usual catch
    // takes heads coming down onto his top, and turned over his top faces the
    // floor. Here the head is pushed out of whichever part of his outline it
    // is in or nearest, so it is never inside him, and bounced off that
    // surface as it is moving -- his travel and his spin both -- so a
    // whirling end whacks it off at an angle nobody can call: that is his
    // cost. But always up, with at least BLUR_UP of its speed: let it go
    // any way at all and it was spiked down past him too fast to see, which
    // only ever read as the game taking a life for nothing.
    //
    // A head is measured as the ellipse it is, along the line it is struck
    // on. As a circle of its average size, one turned long side on sank into
    // him by most of the difference.
    //
    // A head is pushed out the side of him it was on the last time it was
    // clear of him (b.blurSide), not the nearest way out: an end sweeping
    // onto a head can carry its middle past his own, and the nearest way out
    // was then straight through him and out underneath -- a head that
    // jumped through him and fell, which nobody could see happen.
    //
    // His ends sweep far faster than a head flies. Slowed to the game's speed
    // the moment it was whacked, a head was caught again by the next sweep,
    // and the next, and churned round him. So it leaves at the speed of the
    // part of him that struck it (b.boost, at most what MAX_SPEED allows) and
    // eases back down over BLUR_KICK; and for BLUR_GAP after a whack he
    // gives it no second whack. In that time one flying away from his middle
    // is let go entirely: pushed out of every end that swept onto it, it was
    // carried round and round him in jumps, and that is the teleporting.
    // One heading back in is still kept out of him.
    function padBlurHit(b, s) {
        const rmax = Math.max(bRX(), bRY());
        const w = blurRate * Math.PI * 2, py = padY();
        const calm = b.blurT && clock < b.blurT;
        if (calm && (b.x - paddle.x) * b.vx + (b.y - py) * b.vy > 0) return;      // on its way out
        for (const sg of segs()) {
            const hw = sg.w / 2, a = paddle.dip[sg.i], ca = Math.cos(a), sa = Math.sin(a);
            const dx = b.x - sg.cx, dy = b.y - py;
            const lx = dx * ca + dy * sa, ly = dy * ca - dx * sa;
            if (Math.abs(lx) > hw + rmax || Math.abs(ly) > hw + rmax) continue;
            // the nearest of him to the head's middle, in his own frame
            let best = null;
            for (let x = lx - rmax; x <= lx + rmax; x += 1.5) {
                const e = outlineAt(x, hw);
                if (!e) continue;
                const inside = ly > e.top && ly < e.bot;
                const y = inside ? (ly - e.top < e.bot - ly ? e.top : e.bot) : Math.max(e.top, Math.min(e.bot, ly));
                const d = Math.hypot(lx - x, ly - y) * (inside ? -1 : 1);
                if (!best || d < best.d) best = { x, y, d, up: y === e.top };
            }
            // which side of him it is on, while it is clear of him
            const side = () => {
                const e = outlineAt(Math.max(-hw + 1, Math.min(hw - 1, lx)), hw);
                return ly < (e ? (e.top + e.bot) / 2 : 0) ? -1 : 1;
            };
            if (!best || best.d >= rmax) { b.blurSide = { i: sg.i, s: side() }; continue; }
            // the way out of him: back out the side it came from, over him,
            // or the nearest way off an end
            const was = b.blurSide && b.blurSide.i === sg.i ? b.blurSide.s : side();
            let nx, ny;
            const ex = Math.max(-hw + 1, Math.min(hw - 1, lx)), e0 = outlineAt(ex, hw);
            const over = e0 && Math.abs(lx) < hw - 1;
            const wrong = best.d < 0 || (over && Math.sign(ly - (e0.top + e0.bot) / 2) !== was);
            if (over && wrong) {
                best = { x: ex, y: was < 0 ? e0.top : e0.bot, d: -1 };
                nx = 0; ny = was;
            } else if (best.d > 1e-3) { nx = (lx - best.x) / best.d; ny = (ly - best.y) / best.d; }
            else { nx = 0; ny = was; best = { x: best.x, y: was < 0 ? (e0 ? e0.top : best.y) : (e0 ? e0.bot : best.y), d: -1 }; }
            const wx = nx * ca - ny * sa, wy = nx * sa + ny * ca;
            // how far the head reaches that way, turned as it is
            const cb = Math.cos(b.angle), sb = Math.sin(b.angle);
            const nu = wx * cb + wy * sb, nv = wy * cb - wx * sb;
            const r = Math.hypot(bRX() * nu, bRY() * nv);
            if (best.d >= r) { b.blurSide = { i: sg.i, s: side() }; continue; }
            const ox = best.x + nx * r, oy = best.y + ny * r;
            b.x = sg.cx + ox * ca - oy * sa;
            b.y = py + ox * sa + oy * ca;
            if (calm) {
                // just whacked: kept out of him, turned back if heading in,
                // and still going up
                const dot = b.vx * wx + b.vy * wy;
                if (dot < 0) { b.vx -= 2 * dot * wx; b.vy -= 2 * dot * wy; }
                padBlurUp(b);
                return;
            }
            // the surface where it struck, moving with him and with his turn
            const px = best.x * ca - best.y * sa, pyy = best.x * sa + best.y * ca;
            const sx = paddle.vx - w * pyy, sy = w * px;
            let rx = b.vx - sx, ry = b.vy - sy;
            const dot = rx * wx + ry * wy;
            if (dot >= 0) continue;                   // already leaving him
            rx -= 2 * dot * wx; ry -= 2 * dot * wy;
            let vx = rx + sx, vy = ry + sy;
            const base = effSpeed(), len = Math.hypot(vx, vy) || 1;
            const kick = Math.max(1, Math.min(Math.max(1, MAX_SPEED / Math.max(1, base)), len / base));
            const sp = base * kick;
            b.vx = vx / len * sp; b.vy = vy / len * sp;
            padBlurUp(b);
            // the spin, as off any paddle: how far out on him it struck, left
            // or right of his middle as it looks on screen, and how fast he is
            // moving -- each times his own edge and swipe (BLUR_SPIN_X)
            const off = Math.max(-1, Math.min(1, px / hw));
            const turn = Math.max(-SPIN_KICK, Math.min(SPIN_KICK,
                                  off * SPIN_EDGE * labPadEdge() + paddle.vx * SPIN_SWIPE * labPadSwipe()));
            b.spin = Math.max(-SPIN_MAX, Math.min(SPIN_MAX, b.spin + turn / SPIN_INERTIA));
            if (turn) b.kickDir = Math.sign(turn);   // ENGLISH turns whichever way this was
            b.blurT = clock + BLUR_GAP;
            // coming home, as off any paddle
            paddle.jt[sg.i] = 1;
            labPadHit(b);
            combo = 0;
            b.pierced.clear();
            b.boost = kick;
            b.blurKick = kick;
            if (++hits === 4 || hits === 12) bumpSpeed(1.12);
            return;
        }
    }

    // A head off him goes up, with at least BLUR_UP of its speed, the rest
    // kept going the way it was across -- one under his middle too. Edge-on,
    // a head came down past his end, under his middle, and his end then
    // swept down onto it and batted it into the floor. Lying over it, he
    // holds it a moment until his turn lets it go, and it goes up.
    function padBlurUp(b) {
        const sp = Math.hypot(b.vx, b.vy) || 1, up = Math.max(0.16, BLUR_UP);
        if (b.vy <= -sp * up) return;
        b.vy = -Math.max(Math.abs(b.vy), sp * up);
        b.vx = Math.sign(b.vx || (Math.random() < 0.5 ? -1 : 1)) * Math.sqrt(Math.max(0, sp * sp - b.vy * b.vy));
    }

    // ---- BLUR's look: Sonic -------------------------------------------------------
    // Him, dressed as classic Sonic. Most of it is the photograph colored
    // where it already is something: blue all over, peach where he is skin
    // and white on his hands, his boot red with a white strap and a white
    // cuff. On his face, a white patch over both eyes and a peach muzzle,
    // each with his own features multiplied back through, and the muzzle
    // kept inside his outline so the blue of his head goes all the way round
    // it. Green eyes, Sonic's nose and a smirk were tried and dropped: at his
    // size in play they read as smudges, where the white and the peach read.
    //
    // Which part of him each pixel is comes from BLUR_PARTS, measured off the
    // photo once by .claude/blur-parts.py (on Paul's Mac, with the places it
    // measures from) and kept here: each pixel's red is its part plus one, 0
    // where he is not. The game never reads the photo's own pixels, because
    // a page opened as a file may not, and he has to look the same opened
    // from a file as online.
    //
    // The quills are the one thing drawn rather than found (blurQuills), and
    // they are only art: the ball meets his outline as it always has. So none
    // stands up past his crown, where a head comes down onto him; each base
    // is hidden behind his head and only the points show, out past his end
    // and down. The front one's top edge leaves his crown on its tangent, so
    // it reads as more of his head and squares off the round back of it.
    //
    // Baked once, the first time he is drawn with both images in. Should it
    // fail anyway, he is drawn in BLUR_INK as before rather than not at all.
    const BLUR_SHOW = 0.75, BLUR_MUZZLE_SHOW = 0.6;   // how much of his own eyes and face come back through
    const BLUR_WASH = 0.97;                           // how thickly the colors are laid over the photograph
    const BLUR_SOFT = 1.5;                            // px of feather between one color and the next
    // the quills: each one's base, from and to, then where its point is, in
    // degrees round the middle of his head (0 straight out his end, + down),
    // and how far past his outline the point reaches, in BLUR_QUILL px. Back
    // one first; the last is the front one.
    const BLUR_QUILLS = [[38, 80, 80, 1.6], [10, 52, 54, 1], [-32, 12, 26, 1]];
    const BLUR_QUILL = 38;
    const BLUR_QUILL_IN = 0.75;                       // their bases, as a share of his outline: behind his head
    const BLUR_QUILL_PAD = 0.1;                       // of his length, the room round him they are drawn in
    const BLUR_QUILL_INK = [66, 120, 201];            // the blue his head comes out as, so they are more of it
    // his outline round the middle of his head (BLUR_HEAD_MID), measured off
    // the photo: degrees as above, px of the levelled photo (SHAPE.bw wide)
    const BLUR_HEAD_MID = [0.93, 0.24];
    const BLUR_HEAD_R = [[-150, 50], [-135, 54], [-120, 59], [-105, 66], [-90, 71], [-75, 74], [-60, 75], [-45, 74],
                         [-30, 68], [-15, 61], [0, 55], [15, 50], [30, 47], [45, 47], [60, 52], [75, 62]];

    // the parts, in the order blurDress colors them
    const BL_WHITE = 4, BL_EYE = 5, BL_FACE = 6;
    const BLUR_PARTS = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAeAAAACqCAIAAAD6Agt8AAAH/ElEQVR42u3dUXOjNhQGUIkl+/9/r+1BfWq7beIEG0lcoXOmTzvTJAbp4/pKQEoA1JBTyrV/IACtcrMIaIBQuVwlqQU0QO+gLAIaIHIjuAhogMgt4CKgAcI2f59l9OJMAMS8HqwODUDMroIKGuD8dM4CGmCgFTkBDRAinbOABghbO2eLhMCJAVS+DcSis5HsgwbCJ0uZNQSLgAau9NiKi5WoRUADrVsWkTM6cvwJaGCYXCvztXeLgAZGibMy2eKbgAaGXD2bYWuEgAaG/O4/w8a14kYVoN07T6NdQrKLJaBqDlhHZ+cFkAIBYzo7NYD5HzCjx/2YetCg3ewy46MBpn33Ujo7U4AJHzCjD37ej6/+8e58AWb78YzOVaO5f0x7HjRIZ5/0tXR21gCT/AT70/necxfHqpwGWzWk826/+1xcP+fyw4kChbN03neEb6lVM/3rollkg3RmfyndKKPze20NeQ3Seeby+cvjfAtyJ6GGNUjnyZW//2vUlS5vV9CqaZDO6RLdiervAbiFCmgxDaJ5xFyu/jKtuhldM6BlNIjmEdO5bkCXSjumy5FFQhnNPHFWBPR1o7nbKb6/NeoWd44zzy0bufv/K53jp3OKt0vknwvG8mjwdA8xzQVyOf6NedJ5lHRO0R7YL6O5TC4HjOmwFb10Pl5Elz5BuupKc90qMp/XmxbN0w3v1gWvmOaqCVWk8yXK5z7n8f7in9GpFbHKaC4aSbnjJJfOaabXwXTtFet4cPkwyi032NK0+5xD7qdcT/l9YppJkuh4ZIvmzifryzdmdcjuEme3hY4H0wZQbvyeU1oMyCr19X2g7XBK6YuN4yKUXaLSlXfXNe2BlID7lfOnjYF3Y2rkEgNm64G03giUT4nqHOm1jCj3UEG33lt5f+tHrcGntxJbNMO01rHm9oekls4wmvu7lfg66MT+2HfvYjE0RDOceqP//UCfZL32rM4Xeuxv/324ohn6b61ru0gYZFY/Pr88JtVZB8jNVhXyS69aSA2XO0QzyTrh4Ul9P1wO5orldG7z+fO7AV0EDQjoMzI6f/tawtJzkTDHezzY/dt7tMqnOzi/7AMId+DVZnRu16JcQ0Zzrv2A07Lvh7sBF+Ysom+Hq+9bpQJ0vUzVXP2P//PaKJ1BpndO5/8H9OOnwM6DP+z87SgvYhpIUd9JWP0daGWcbW02U8O4bmF+XWkR0DNH8zdvIJXaIKObpvMXAf1o9l7kMmA0u4kDJknwW4wC/OcKWskMzFZE/05HFwxvDdqkS2rcvRXNQPCM/h2vufE0oO+6GQBpnF0cSmbAamHP8vlpQN9FM3D1jL7FTud0/FkcQhmYto6+nfVGlftPD8UXzYCUb5qQ6/fPhPuQywAn7YzO+18uVYa6JeRhHAGpztORbif1fnOgN8sKaCBGTN9iLM7lWG//FtDA4Er/fdAPkQeQAt+oIqMB4t5JqJQGSF0edfnmrd4yGqB1Ri8OJUDMjH4/oBXRAOmUW72B2ao59wlXP+xFQANeyZbs4ki6HCCd6XUuVNAgDrjoG1UU0RAkmrN8F9DAhQtnGX3BM9uoUfJ48uBTpT20i1R7OVKYQxq0By1eAdZaeboKZYCq30jWijXvKo4hub3CZ0kRFwkfyfPwAFsP05C3estlII35cpNT/oC1RQSvQhk6RkD1IjHby3HhCrpbKN9f3HsHMpqkP+NDwtDjXAUd4TD+cgTlOAaw6RCTgBb0GHsIaHrNzPLffyymsYwW9wIaNRdOKAIa0xsnMXncKCY2adq7MwyJcw+ggMZUBBU0oIhGQGMSgoAGFNG0OgsCGqQDKmiS/gajZrRBIqABdTQCGhMYRXT4mSWgQVKggsYEBgQ00OIarMvR+YALaBTRTjEqaAAENNCoiNblENBAst8OAY1Zp4hGQAMu5whoFFYgoJHR2BONgEZGkzQ6BDQyGhDQgCJalSOgUUQjowebPqujybNBZuJJVVf0cw+FChqzLulsypEqc6T6lPllsOILrHPqch7z86qgMfEQJa/NiOKoIqNh8rkgoJHREHQWCGhkNNLEIUVGE8PmEAwy+AU0MhqxEnTY20OFcSNDFexBKxITDUNHRovpoN8XzTIMHekspoN28/Sg0YxO1gklTszhLaCR0QidoANbQDPMba+MVURvcid53CieTUr4a4DOhgoaI5ugnejt0+9ajOFkKR5Din1l2tYgN7efqsJNOptNGFXsDOg590cXC6ok7Q7SpRod2yUe6xF5uHqjCkpp/g2p5VMEl+eLwCWlJaXt2InOrugqaGzCo1F8LM3q6KV9QhUBjZgmjdPu2N7KkSMZvXz7j8vEI9M+aPpltI7H6H3qdlm5tLwAjFs0qKBRSvM0FJZeRbRxKKAxN3htU8dLhfMQGV3c6g17ZoiOx1gxfXotuSX7oMAQnOMrS96dicsfSf1jNb01+2K+zfcFzuzAQJy3lZTbtEFbZPQ2ZXvNjSpI6jF6oLlZ9OTajyps8XTDkmZc/FC4YFxaj3rtgC/f1suNnumxTbk0bZEQC4k2qBzaqB58+W7o86LFgZraNsHXjnNOu56nkQOUz6OfLwGNvLZNu0JXurTsRJdZz6YWBxfcPbYzQRjiHWbbxNdai4TAob3SO1+e0i2di5fGAp5ytX/L849bO7YdcT9hk0oFDQyfFMVhB8S0XBbQgMiw2UZAA+MER3GcAWplRzl8M0txkAFqJYgt5wIaCJcjormuvwAba6ce4E/0qAAAAABJRU5ErkJggg==';
    const blurPartsImg = Object.assign(new Image(), { src: BLUR_PARTS });
    function blurParts(W, H) {
        const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.drawImage(blurPartsImg, 0, 0, W, H);
        const d = g.getImageData(0, 0, W, H).data, part = new Int8Array(W * H);
        for (let i = 0; i < part.length; i++) part[i] = d[i * 4] - 1;
        return part;
    }

    // Each part as its own wash, laid over the photograph. The strap and
    // cuff are over dark denim, where a wash alone came out gray, so they
    // take a solid white over it; the eyes and face take their color with
    // his own features multiplied back through.
    function blurDress() {
        const raw = shapeSprite('padBlurRaw', null, PAD_BAKE, PAD_BAKE / SHAPE_ASPECT, false);
        const W = raw.width, H = raw.height, part = blurParts(W, H);
        const ink = [BLUR_BLUE, BLUR_PEACH, '#ffffff', BLUR_RED, '#ffffff', '#ffffff', BLUR_PEACH];
        const solid = { [BL_WHITE]: 0.7 };
        const show = { [BL_EYE]: BLUR_SHOW, [BL_FACE]: BLUR_MUZZLE_SHOW };
        const canvas = () => Object.assign(document.createElement('canvas'), { width: W, height: H });
        const c = canvas(), g = c.getContext('2d');
        g.drawImage(raw, 0, 0);
        for (let k = 0; k < ink.length; k++) {
            const m = canvas(), mg = m.getContext('2d'), px = mg.createImageData(W, H);
            for (let i = 0; i < part.length; i++) if (part[i] === k) px.data[i * 4 + 3] = 255;
            mg.putImageData(px, 0, 0);
            const t = canvas(), tg = t.getContext('2d');
            tg.drawImage(padTint('padBlurPart' + ink[k], ink[k]), 0, 0, W, H);
            if (solid[k]) {
                tg.globalCompositeOperation = 'source-atop';
                tg.globalAlpha = solid[k];
                tg.drawImage(padFlat('padBlurFlat' + ink[k], ink[k]), 0, 0, W, H);
                tg.globalAlpha = 1;
            }
            if (show[k]) {
                tg.globalCompositeOperation = 'source-atop';
                tg.fillStyle = ink[k];
                tg.fillRect(0, 0, W, H);
                tg.globalCompositeOperation = 'multiply';
                tg.globalAlpha = show[k];
                tg.filter = 'grayscale(1) brightness(1.7) contrast(1.6)';
                tg.drawImage(raw, 0, 0);
                tg.filter = 'none';
                tg.globalAlpha = 1;
                tg.globalCompositeOperation = 'destination-in';
                tg.drawImage(raw, 0, 0);
            }
            tg.globalCompositeOperation = 'destination-in';
            tg.filter = 'blur(' + BLUR_SOFT + 'px)';
            tg.drawImage(m, 0, 0);
            g.globalAlpha = solid[k] || show[k] ? 1 : BLUR_WASH;
            g.drawImage(t, 0, 0);
            g.globalAlpha = 1;
        }
        return c;
    }

    // his outline round the middle of his head, at `deg`
    function blurHeadR(deg) {
        for (let i = 1; i < BLUR_HEAD_R.length; i++) {
            const [a1, r1] = BLUR_HEAD_R[i];
            if (deg <= a1) { const [a0, r0] = BLUR_HEAD_R[i - 1]; return r0 + (r1 - r0) * (deg - a0) / (a1 - a0); }
        }
        return BLUR_HEAD_R[BLUR_HEAD_R.length - 1][1];
    }
    // the quills, on a canvas BLUR_QUILL_PAD bigger than him all round
    function blurQuills(dress) {
        const W = dress.width, H = dress.height, k = W / SHAPE.bw, p = Math.round(BLUR_QUILL_PAD * W);
        const q = Object.assign(document.createElement('canvas'), { width: W + 2 * p, height: H + 2 * p });
        const g = q.getContext('2d');
        const shade = t => 'rgb(' + BLUR_QUILL_INK.map(v => Math.round(Math.min(255, v * t))).join(',') + ')';
        g.translate(p, p);
        const cx = BLUR_HEAD_MID[0] * W, cy = BLUR_HEAD_MID[1] * H;
        const at = (deg, r) => [cx + Math.cos(deg * Math.PI / 180) * r * k, cy + Math.sin(deg * Math.PI / 180) * r * k];
        g.lineJoin = 'round';
        g.lineWidth = 0.004 * W;
        g.strokeStyle = shade(0.5);
        BLUR_QUILLS.forEach(([a0, a1, tip, reach], i) => {
            const pt = at(tip, blurHeadR(tip) + BLUR_QUILL * reach);
            const m0 = (a0 + tip) / 2, m1 = (a1 + tip) / 2;
            g.beginPath();
            g.moveTo(...at(a0, blurHeadR(a0) * BLUR_QUILL_IN));
            if (i === BLUR_QUILLS.length - 1) {
                // up onto his outline at the crown, then off it along its tangent
                const on = at(a0, blurHeadR(a0) * 0.99), on2 = at(a0 + 2, blurHeadR(a0 + 2) * 0.99);
                const tx = on2[0] - on[0], ty = on2[1] - on[1], tl = Math.hypot(tx, ty);
                const run = Math.hypot(pt[0] - on[0], pt[1] - on[1]) / 2;
                g.lineTo(...on);
                g.quadraticCurveTo(on[0] + tx / tl * run, on[1] + ty / tl * run, ...pt);
            } else {
                // the top bows out and the underside in, so it sweeps back
                g.quadraticCurveTo(...at(m0 - 4, blurHeadR(m0) + BLUR_QUILL * reach * 0.55), ...pt);
            }
            g.quadraticCurveTo(...at(m1 + 2, blurHeadR(m1) * 0.98), ...at(a1, blurHeadR(a1) * BLUR_QUILL_IN));
            g.closePath();
            const fill = g.createLinearGradient(...at((a0 + a1) / 2, blurHeadR((a0 + a1) / 2)), ...pt);
            fill.addColorStop(0, shade(0.85));
            fill.addColorStop(1, shade(1.1));
            g.fillStyle = fill;
            g.fill();
            g.stroke();
        });
        q.pad = p / W;
        return q;
    }

    // null until his photo and BLUR_PARTS are in, false if he cannot be made
    let blurLook = null;
    const blurIn = img => img.complete && img.naturalWidth;
    function blurSonic() {
        if (blurLook !== null || !blurIn(paddleImg) || !blurIn(blurPartsImg)) return blurLook;
        try {
            const dress = blurDress();
            blurLook = { dress, quills: blurQuills(dress) };
        } catch (e) {
            blurLook = false;
        }
        return blurLook;
    }
    // his quills on one of him, turned `turn` further than he is
    function blurQuillsOn(sg, o, alpha, turn) {
        const q = blurLook.quills, tw = sg.w, th = tw / SHAPE_ASPECT, pw = q.pad * tw;
        ctx.save();
        ctx.translate(sg.cx, padY() + o * JIG_PADDLE);
        ctx.rotate(segWig(sg.i) + paddle.dip[sg.i] + turn);
        ctx.globalAlpha = padK * alpha;
        ctx.drawImage(q, -tw / 2 - pw, -th / 2 - pw, tw + 2 * pw, th + 2 * pw);
        ctx.restore();
    }

    // BLUR: Sonic, with afterimages of himself following round behind.
    LAB_PAD.blur = {
        name: 'BLUR',
        ink: BLUR_INK, rim: BLUR_RIM,
        blur: true,
        len: () => BLUR_LEN,
        edge: () => BLUR_SPIN_X,
        swipe: () => BLUR_SPIN_X,
        dress: () => blurSonic() ? blurLook.dress : null,
        dressA: 1,
        blurb: '25% shorter, +200% spin · never stops spinning · knocks heads upward',
        lore: 'The fastest Brandon.',
        under() {
            const look = blurSonic();
            const sp = look ? look.dress : padTint('padBlurTrail', BLUR_INK);
            if (!sp) return;
            for (const sg of segs()) {
                const o = paddle.jt[sg.i] > 0 ? wobble(paddle.jt[sg.i]) : 0;
                const tw = sg.w, th = tw / SHAPE_ASPECT;
                for (let k = BLUR_TRAIL; k >= 1; k--) {
                    const turn = -k * 0.22 * (Math.sign(blurRate) || blurDir), alpha = 0.32 * (1 - k / (BLUR_TRAIL + 1));
                    if (look) blurQuillsOn(sg, o, alpha, turn);
                    ctx.save();
                    ctx.translate(sg.cx, padY() + o * JIG_PADDLE);
                    ctx.rotate(segWig(sg.i) + paddle.dip[sg.i] + turn);
                    ctx.globalAlpha = padK * alpha;
                    ctx.drawImage(sp, -tw / 2, -th / 2, tw, th);
                    ctx.restore();
                }
            }
            ctx.globalAlpha = padK;
            padRim('padRimB', BLUR_RIM, 2.5, 0.5);
            // behind his photograph, so his head hides their bases
            if (look) for (const sg of segs()) blurQuillsOn(sg, paddle.jt[sg.i] > 0 ? wobble(paddle.jt[sg.i]) : 0, 1, 0);
            ctx.globalAlpha = padK;
        },
        skin(sg, o) {
            if (blurSonic()) padLay(sg, o, blurLook.dress, 1);
            else padLay(sg, o, padTint('padBlur', BLUR_INK), 0.7);
        }
    };
