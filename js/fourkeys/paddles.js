'use strict';

    // ---- the paddles ---------------------------------------------------------------
    // What you hold for a whole run, so a variant has to read at a glance and
    // has to give up as much as it gains. Every one is the same photograph with
    // something done to it -- a wash, a rim, a light, some specks -- over a
    // handful of factors on the paddle the game already has:
    //
    //   len    how long he is            angle  how far his ends throw a head
    //   edge   spin off his ends         swipe  spin from his own travel
    //   dip    how far he leans for one going past
    //   deck   how wide his flat middle is, so how much of him is a curve
    //   caps   how long a capsule lasts him
    //   split  two of him, with a hole down the middle
    //   favour a capsule he is partial to     portal  PORTAL on for as long as he is
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
    let labP = null;
    let padBits = [];               // specks of whatever he sheds
    let deckAtPad = -1;             // the deck cache holds per width AND per paddle
    const PAD_BAKE = 320;           // tints are baked this long and scaled

    let GILT_LEN   = 0.85;   // gilt: shorter...
    let GILT_CAPS  = 1.6;    // ...and every capsule lasts him longer, by this much
    let GILT_SHINE = 3;      // seconds a sweep of light takes to cross him
    let STAT_LEN   = 1.2;    // statue: longer...
    let STAT_ANGLE = 0.65;   // ...flatter off his ends...
    let STAT_SPIN  = 0.35;   // ...and stone hardly grips, so he puts little spin on
    let STAT_DIP   = 1.3;    // ...but he leans further after one going past
    let FROST_LEN  = 0.95;   // frost: a touch shorter...
    let FROST_EDGE = 1.5;    // ...spin off his ends...
    let FROST_SWIPE = 2.2;   // ...and off his travel, both far easier
    let FROST_DECK = 0.6;    // ...on a narrower flat, so more of him is a curve
    let FROST_FLAKES = 10;   // snowflakes a second coming off him...
    let FROST_BIG  = 0.25;   // ...this share of them a big one, six of him heads out
    let ICE_SECS   = 1;      // an icy brick struck sends the head off at full speed this long...
    let ICE_RAMP   = 0.15;   // ...getting there over this, and coming back down over twice it
    let ICE_TURN   = 0.35;   // ...turned this far (rad) the way it is spinning, at the most spin
    let EMB_LEN    = 0.7;    // ember: much shorter...
    let EMB_CATCH  = 0.3;    // ...but a brick a head of his breaks has this chance of going up in embers
    let EMB_SPREAD = 0.45;   // ...a burning brick this chance of catching each one beside it
    let EMB_SPREAD_AT = 1;   // ...seconds into burning that it does
    let EMB_GLOW   = 0.45;   // how much light he gives off
    let EMB_SPARKS = 17;     // sparks a second rising off him
    let EMB_ASH    = 6;      // wisps of smoke a second: ambiance, never something to look at...
    let EMB_ASH_S  = 2.5;    // ...so each only about this many px either side of its middle...
    let EMB_ASH_A  = 0.3;    // ...and at most this solid
    let PAIR_LEN   = 0.62;   // the pair: two of him, each this much of one
    let PAIR_QUAD  = 0.7;    // ...and under DOUBLE, four, each this much of one of the two
    let PAD_MARK   = 3;      // seconds a head FROST or EMBER hits wears his frost or fire
    let V2_GLOSS   = 0.22;   // MODERN: how bright the gloss along his top is...
    let V2_GLINT   = 5;      // ...seconds between one glint and the next...
    let V2_SWEEP   = 0.9;    // ...and how long a glint takes to cross him
    let PAD_FAVOUR = 0.5;    // MULTI, PRINCE: this share of capsules is his, before the usual roll
    let MULTI_POP  = 2.5;    // MULTI: seconds between one pair of heads flying off him and the next
    let MULTI_SLIP = 4;      // MULTI: px each of his two misprints is out of register, at the game's size...
    let MULTI_PRINT = 0.45;  // ...and how strongly each shows
    let TEF_LEN    = 0.5;    // TEFLON: nothing sticks to him, and this is all the length he has
    let TEF_GLINT  = 1.2;    // ...seconds between one glint sliding along him and the next
    let BLUR_SPIN  = 2;      // BLUE BLUR: turns a second he spins through, all the way round
    let BLUR_TRAIL = 3;      // ...afterimages of him following round behind
    let BLUR_GAP   = 0.3;    // ...and seconds a head he has hit is left alone to get away
    LAB_KNOBS.push('PAD_FAVOUR', 'MULTI_POP', 'MULTI_SLIP', 'MULTI_PRINT', 'TEF_LEN', 'TEF_GLINT',
                   'BLUR_SPIN', 'BLUR_TRAIL', 'BLUR_GAP');
    LAB_KNOBS.push('GILT_LEN', 'GILT_CAPS', 'GILT_SHINE', 'STAT_LEN', 'STAT_ANGLE', 'STAT_SPIN',
                   'STAT_DIP', 'FROST_LEN', 'FROST_EDGE', 'FROST_SWIPE', 'FROST_DECK', 'FROST_FLAKES', 'FROST_BIG', 'ICE_SECS', 'ICE_RAMP', 'ICE_TURN',
                   'EMB_LEN', 'EMB_CATCH', 'EMB_SPREAD', 'EMB_SPREAD_AT', 'EMB_GLOW', 'EMB_SPARKS', 'PAIR_LEN', 'PAIR_QUAD', 'PAD_MARK', 'V2_GLOSS', 'V2_GLINT', 'V2_SWEEP');
    LAB_KNOBS.push('EMB_ASH', 'EMB_ASH_S', 'EMB_ASH_A');

    const V2_RIM    = '#e6edf5';
    const GILT_INK  = '#efb920', GILT_RIM = '#ffe9a3';
    const FROST_INK = '#8fe3f2', FROST_RIM = '#dff6ff';
    const EMB_INK   = '#e2683a', EMB_RIM = '#ffb072';
    const PAIR_INK  = '#8f7fc4';      // DOUBLE's own colour, since he is two of him
    // MULTI's own colour, as PAIR has DOUBLE's, and a blue to print against it
    const MULTI_INK = '#e0c060', MULTI_BLUE = '#5b8cc4';
    // PRINCE and CHELL are dressed rather than washed (padDress): a colour
    // for his shirt and one for his jeans, after who each is named for
    const PRINCE_TOP = '#a8c64e', PRINCE_LEGS = '#8a4fb0', PRINCE_RIM = '#d7ee8c';
    const CHELL_TOP = '#f4f1ea', CHELL_LEGS = '#e0692c', CHELL_RIM = '#ff9a3c';
    const TEF_INK = '#a3a9b2', TEF_RIM = '#e9edf2';     // the grey of a pan, and the shine on it
    const BLUR_INK = '#3a6fe0', BLUR_RIM = '#a9c8ff';

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
    const labPadTeflon = () => !!(labP && labP.teflon);
    const labPadBlur = () => !!(labP && labP.blur);
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
        if (labPadTeflon()) say.push('nothing sticks');
        if (labPadBlur()) say.push('spinning ' + BLUR_SPIN + '/s');
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
        for (const x of embBlasts) x.t += dt;
        embBlasts = embBlasts.filter(x => x.t < EMB_BLAST);
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
        for (const x of embBlasts) {
            const k = x.t / EMB_BLAST, r = x.r * (0.3 + 0.7 * Math.sqrt(k));
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = (1 - k) * 0.8;
            ctx.drawImage(padGlow(EMB_INK), x.x - r * 1.2, x.y - r * 1.2, r * 2.4, r * 2.4);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1 - k;
            ctx.strokeStyle = EMB_RIM;
            ctx.lineWidth = 4 * (1 - k) + 1;
            ctx.beginPath();
            ctx.arc(x.x, x.y, r, 0, 7);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        for (const b of padBits) {
            const a = Math.max(0, 1 - b.t / b.life) * b.a * (b.fadeIn ? Math.min(1, b.t / b.fadeIn) : 1);
            const baked = b.kind === 'bigflake' ? padFlakeSprite(b.ink) : b.kind === 'head' ? padHeadSprite(b.ink)
                        : b.kind === 'face' ? padFaceSprite(b.ink) : null;
            if (baked) {
                // s is half its width, as a flake's is
                const w = b.s * 2, h = w * baked.height / baked.width;
                ctx.save();
                ctx.globalAlpha = a;
                ctx.translate(b.x, b.y);
                ctx.rotate(b.ph + b.t * (b.turn !== undefined ? b.turn : b.kind === 'head' ? 0.6 : 0.8));
                ctx.drawImage(baked, -w / 2, -h / 2, w, h);
                ctx.restore();
                continue;
            }
            if (b.kind === 'head' || b.kind === 'face') continue;     // his art is not in yet
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

    // A spark's light, baked once per colour, so each spark in a frame is a
    // drawImage rather than a gradient of its own: EMBER keeps dozens alive.
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
    // his head gone grey and soft as smoke, with `ink` through it. The blur
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

    // his head as it is, with only a little of `ink` over it: MULTI's heads
    // are the heads in play, and have to look like them
    function padFaceSprite(ink) {
        const w = PAD_SPECK_BAKE, h = Math.round(w * BALL_RY / BALL_RX);
        return padBakeSpeck('face' + ink, w, h, ink, 0.3, g => {
            if (!ready(ballImg)) return false;
            g.drawImage(ballImg, 0, 0, w, h);
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

    // ---- the mark he leaves on a head ----------------------------------------------
    // A head FROST or EMBER sends back carries a little of him away with it:
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

    // ---- EMBER's wildfire -------------------------------------------------------
    // A brick broken by a head that EMBER has marked has EMB_CATCH of going
    // up: it bursts in embers and every brick next to it (corners too)
    // catches. A burning brick wears the head's mark -- his tint, his sparks
    // -- and burns up when PAD_MARK is out, scoring as if you had hit it. Each
    // has one roll of EMB_SPREAD for each brick beside it, EMB_SPREAD_AT into
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
    function padIgnite(o) { o.burn = { t: PAD_MARK, spread: EMB_SPREAD_AT, rolled: false }; }

    // a brick has just been broken, by whatever labHitBy says
    // Going up is a blast you cannot miss -- a flash, a ring of heat thrown
    // out over the bricks it lights, and a spray of embers -- and a brick
    // burning out goes with a smaller one, so each link of a vein shows.
    let embBlasts = [];
    const EMB_BLAST = 0.4;           // seconds a blast takes to spread and fade
    function embBlast(x, y, big) { embBlasts.push({ x, y, t: 0, r: (bw + GAP) * (big ? 1.5 : 0.8) }); }

    function labBrickGone(b) {
        const ball = labHitBy;
        if (!ball || !ball.mark || ball.mark.key !== 'ember' || Math.random() >= EMB_CATCH) return;
        embBlast(b.x + bw / 2, b.y + bh / 2, true);
        for (let n = 0; n < 40; n++) {
            const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 160;
            padBit(b.x + bw / 2, b.y + bh / 2, Math.random() < 0.4 ? EMB_RIM : EMB_INK, 0.5 + Math.random() * 0.6,
                   Math.cos(a) * v, Math.sin(a) * v - 40, 60, 2 + Math.random() * 2.5, 0.95, 'glow');
        }
        for (const o of padBeside(b)) if (padBurnable(o)) padIgnite(o);
    }

    function padBurnStep(dt) {
        if (phase !== 'play' || !bricks) return;
        const shed = LAB_PAD.ember.shed;
        for (const b of bricks) {
            const f = b.burn;
            if (!f) continue;
            if (!b.alive) { b.burn = null; continue; }
            f.t -= dt;
            if (!f.rolled && PAD_MARK - f.t >= f.spread) {
                f.rolled = true;
                for (const o of padBeside(b)) if (padBurnable(o) && Math.random() < EMB_SPREAD) padIgnite(o);
            }
            const k = Math.max(0, f.t / PAD_MARK);
            if (Math.random() < dt * 45) shed(b.x + Math.random() * bw, b.y + Math.random() * bh, Math.max(0.6, k));
            if (f.t <= 0) {
                b.burn = null;
                if (b.alive) {
                    embBlast(b.x + bw / 2, b.y + bh / 2, false);
                    hitBrick(b, b.x + bw / 2, b.y + bh / 2);
                }
            }
        }
    }

    // ---- FROST's ice -----------------------------------------------------------------
    // A head FROST has marked that strikes a silver or gold and leaves it
    // standing leaves it icy. The next head to strike an icy brick, whoever
    // sent it, goes off it at MAX_SPEED for ICE_SECS, turned a little the way
    // it is spinning -- and the ice is spent, unless that head is FROST's
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
                padBit(b.x + Math.random() * bw, b.y + Math.random() * bh, Math.random() < 0.5 ? FROST_RIM : FROST_INK,
                       0.6 + Math.random() * 0.4, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, 60,
                       2 + Math.random() * 2, 0.9, 'flake');
            }
        }
    }
    // ...and one that it did not break
    function labBrickHeld(b) {
        const ball = labHitBy;
        if (ball && ball.mark && ball.mark.key === 'frost' && b.hp >= 1 && !b.lab) b.icy = true;
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
            else if (Math.random() < dt * 40) padBit(b.x, b.y, FROST_RIM, 0.5, 0, 0, 0, 2, 0.8, 'flake');
        }
    }

    // a burning or icy brick's tint, over it where drawBrick has it
    function labPadBurn(b) {
        if (b.icy) {
            const sp = shapeSprite('iceFrost', FROST_INK, bw, bh, true);
            if (sp) {
                ctx.globalAlpha = 0.45 + 0.08 * Math.sin(clock * 2 + b.x);
                ctx.drawImage(sp, -bw / 2, -bh / 2, bw, bh);
                ctx.globalAlpha = 1;
            }
        }
        const f = b.burn;
        if (!f) return;
        const sp = shapeSprite('burnEmber', EMB_INK, bw, bh, true);
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

    // his outline, in one colour, a little proud of him all round
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

    // one of them at any size: his look without his behaviour. `locked` draws
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
        // the game's own colours are asked for here rather than held on the
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
                if (p.dress) lay(p.dress(), p.dressA, dx, ww);
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
        blurb: 'the paddle you start with, polished',
        lore: 'Two thousand years after the last Brandon won, someone had to pick up where he left off. ' +
              'Freshly polished, a little too clean, and very much yours.',
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
                        lore: 'The one who won, the first time. Worn smooth by the old game, ' +
                              'and still the only Brandon who remembers what the world was like before.' };

    // GILT: gold leaf over the photograph, with a sweep of light crossing him
    // every few seconds. Shorter than standard, and everything he catches
    // lasts him longer.
    LAB_PAD.gilt = {
        name: 'GILT',
        ink: GILT_INK, rim: GILT_RIM,
        blurb: 'shorter · power-ups last longer',
        lore: 'Leafed in the gold of the harvest {odin} blessed when he walked these fields. ' +
              'The farmers kept him polished for two thousand years, waiting for hands worth the shine.',
        len: () => GILT_LEN,
        caps: () => GILT_CAPS,
        under() { padRim('padRimG', GILT_RIM, 3, 0.5); },
        skin(sg, o) {
            padLay(sg, o, padTint('padGilt', GILT_INK), 0.8);
            const sp = padFlat('padShine', '#fff6d8');
            if (!sp) return;
            const tw = sg.w, th = tw / SHAPE_ASPECT;
            const t = (clock % GILT_SHINE) / GILT_SHINE;
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
    LAB_PAD.statue = {
        name: 'STATUE',
        stone: true,
        blurb: 'longest, leans furthest · flat returns, next to no spin',
        lore: 'Carved from the ruins\' own stone in the likeness of {angel}, back when he shone. ' +
              'He will not bend and he will not spin, but he will lean a long way to catch you.',
        len: () => STAT_LEN,
        angle: () => STAT_ANGLE,
        edge: () => STAT_SPIN,
        swipe: () => STAT_SPIN,
        dip: () => STAT_DIP,
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

    // FROST: cold and bright, throwing sparks as he travels. Spin goes on him
    // far more easily, both off his ends and off his own travel -- and spin is
    // the multiplier -- but his flat middle is narrow, so most of him is the
    // curve of his own outline and a return is less of a sure thing.
    LAB_PAD.frost = {
        name: 'FROST',
        ink: FROST_INK, rim: FROST_RIM,
        blurb: 'easier to add spin · smaller sweet spot · ices what it cannot break',
        lore: 'Cut from the ice that sealed the city the winter {odin}\'s light went out. ' +
              'Still cold to hold, and a head slides off him any way you like.',
        len: () => FROST_LEN,
        edge: () => FROST_EDGE,
        swipe: () => FROST_SWIPE,
        deck: () => FROST_DECK,
        under() { padRim('padRimF', FROST_RIM, 2.5, 0.55); },
        skin(sg, o) { padLay(sg, o, padTint('padFrost', FROST_INK), 0.82); },
        mark: 'frost',
        shedRate: 21,
        // one of his flakes, off a head he has hit
        shed(x, y, k) {
            padBit(x, y, Math.random() < 0.5 ? FROST_RIM : FROST_INK, 0.9 + Math.random() * 0.6,
                   (Math.random() - 0.5) * 16, 8 + Math.random() * 12, 8, 1.8 + Math.random() * 1.8,
                   0.85 * k + 0.15, 'flake', 16);
        },
        step(dt) {
            // flakes coming off him all the time, drifting down and wandering
            // as they go, the big ones slower and longer, so there is time to
            // see what they are made of...
            if (Math.random() < dt * FROST_FLAKES) {
                const p = padSomewhere(0.95), big = Math.random() < FROST_BIG;
                padBit(p.x, padY() + (Math.random() - 0.5) * padH() * 0.6,
                       Math.random() < 0.5 ? FROST_RIM : FROST_INK, (big ? 2.2 : 1.4) + Math.random() * 1.2,
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
                       FROST_RIM, 0.5 + Math.random() * 0.4, -paddle.vx * 0.12 + (Math.random() - 0.5) * 40,
                       -30 - Math.random() * 40, 40, 1.5 + Math.random() * 2);
            }
        }
    };

    // EMBER: lit from underneath, throwing sparks that rise. Much shorter than
    // standard, but a head off him carries his fire into the wall, and now
    // and then a brick it breaks goes up and the fire runs on from there
    // (EMBER's wildfire, above).
    LAB_PAD.ember = {
        name: 'EMBER',
        ink: EMB_INK, rim: EMB_RIM,
        blurb: 'much shorter · sets the wall alight',
        lore: 'Forged in the fire of {surtr}\'s footsteps, where the mountain still remembers the ' +
              'weight of him. He has never quite stopped burning.',
        len: () => EMB_LEN,
        under() {
            const r = padW() * 0.95;
            const g = ctx.createRadialGradient(paddle.x, padY(), 8, paddle.x, padY(), r);
            g.addColorStop(0, EMB_INK);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            // a steady light with a slow breath in it: nothing here flashes
            ctx.globalAlpha = padK * (EMB_GLOW * (0.85 + 0.15 * Math.sin(clock * 1.7)));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(paddle.x, padY(), r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = padK;
            padRim('padRimE', EMB_RIM, 2.5, 0.5);
        },
        skin(sg, o) { padLay(sg, o, padTint('padEmber', EMB_INK), 0.72); },
        mark: 'ember',
        shedRate: 20,
        // one of his sparks, off a head he has hit
        shed(x, y, k) {
            padBit(x, y, Math.random() < 0.4 ? EMB_RIM : EMB_INK, 0.5 + Math.random() * 0.5,
                   (Math.random() - 0.5) * 30, -30 - Math.random() * 40, -20, 1.8 + Math.random() * 2,
                   0.95 * k + 0.05, 'glow', 20);
        },
        step(dt) {
            // sparks lifting off him with light round them, weaving as they
            // climb, and left behind when he moves
            let n = EMB_SPARKS * dt;
            while (n > 0) {
                if (Math.random() < n) {
                    const p = padSomewhere(0.9);
                    padBit(p.x, padY() - padH() * (0.1 + Math.random() * 0.3),
                           Math.random() < 0.4 ? EMB_RIM : EMB_INK, 0.8 + Math.random() * 0.9,
                           (Math.random() - 0.5) * 30 - paddle.vx * 0.08, -40 - Math.random() * 70, -30,
                           2 + Math.random() * 2.5, 0.95, 'glow', 20 + Math.random() * 30);
                }
                n -= 1;
            }
            // a thin smoke of his heads, drifting up slower and greyer,
            // turning over as it goes
            if (Math.random() < dt * EMB_ASH) {
                const p = padSomewhere(0.8);
                padBit(p.x, padY() - padH() * 0.2, '#8a7f76', 1.8 + Math.random(),
                       (Math.random() - 0.5) * 20, -18 - Math.random() * 20, -4, EMB_ASH_S * (0.8 + 0.4 * Math.random()), EMB_ASH_A, 'head');
            }
        }
    };

    // THE PAIR: two of him, always, in DOUBLE's own colour, each one shorter
    // than standard. Wider reach than anybody and a hole down the middle of
    // it -- and DOUBLE, when it drops, makes four of him, smaller again.
    LAB_PAD.pair = {
        name: 'THE PAIR',
        ink: PAIR_INK, twin: true,
        blurb: 'two of him · a hole down the middle',
        lore: 'Two Brandons who swore to hold the castle gate together, and in all the years since ' +
              'have never once agreed on which of them is on the left.',
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
    // These three, and TEFLON and BLUE BLUR below, come with bosses beaten, counted over
    // every run (MENU_SLAIN_PADS in menu.js), or each with a flawless win of
    // its own stage (MENU_FLAWLESS_PADS). These three play as MODERN does
    // and leans on the capsules instead: MULTI and PRINCE get PAD_FAVOUR of
    // capsules as their own before the usual roll (the falling capsule in
    // engine.js), and CHELL has PORTAL on all the time (ptOn in powers.js).

    // Him in two colours, cut where the photograph is: his shirt and head
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
    // GILT). Every MULTI_POP two heads fly up off him on the fan MULTI sends
    // new heads out on, so he says what he is for. `ink` is only for his card.
    LAB_PAD.multi = {
        name: 'MULTI',
        ink: MULTI_INK,
        prints: [[MULTI_INK, -1, -0.5], [MULTI_BLUE, 1, 0.5]],     // colour, and which way it slips
        favour: 'M',
        blurb: 'half of power-ups are MULTI',
        lore: 'Nobody agrees on how many of him there were. ' +
              'Everybody agrees it was more than one.',
        popT: 0,
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
        },
        step(dt) {
            if ((this.popT += dt) < MULTI_POP) return;
            this.popT = 0;
            const p = padSomewhere(0.3);
            for (const side of [-1, 1]) {
                const a = -Math.PI / 2 + side * 0.42, v = 150;
                const b = padBit(p.x, padY() - padH() * 0.3, MULTI_INK, 1.1, Math.cos(a) * v, Math.sin(a) * v,
                                 110, 9, 0.9, 'face');
                if (b) { b.turn = side * 2; b.fadeIn = 0.12; }
            }
        }
    };

    // PRINCE: green over purple, and nothing more.
    LAB_PAD.prince = {
        name: 'PRINCE',
        ink: PRINCE_TOP, rim: PRINCE_RIM,
        favour: 'K',
        dress: () => padDress('padPrince', PRINCE_TOP, PRINCE_LEGS, false),
        dressA: 0.85,
        blurb: 'half of power-ups are KATAMARI, where they can be',
        lore: 'The smallest Brandon there ever was, sent down by an enormous father ' +
              'to roll up whatever had been left lying around. He is rolling still.',
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
        blurb: 'PORTAL, always',
        lore: 'Woke in a room with no way out but through the walls, and has never taken ' +
              'a wall seriously since. Has never said a word about it, either.',
        under() { padRim('padRimC', CHELL_RIM, 2.5, 0.5); },
        skin(sg, o) { padLay(sg, o, this.dress(), this.dressA); }
    };

    // ---- TEFLON: nothing sticks -------------------------------------------------------
    // SLUGGISH, STUNNED and the siphon's shrink all slide off him. They are
    // put on from all over (a boss file each, some writing dragT straight),
    // so rather than guard every one of them, whatever has landed on him is
    // wiped before he moves and again before he is drawn (engine.js calls
    // padShrug in both): it never takes hold, and never reaches the screen.
    // He says so, and it slides off his ends in SLUGGISH's colour.
    let tefSaid = -9;
    function padShrug() {
        if (!labPadTeflon() || !(dragT > 0 || stunT > 0 || shrinkT > 0)) return;
        dragT = 0; stunT = 0; shrinkT = 0;
        if (clock - tefSaid < 1) return;
        tefSaid = clock;
        popups.push({ x: paddle.x, y: padY() - 40, text: 'NON-STICK', color: TEF_RIM, life: 1 });
        for (const sg of segs()) for (let n = 0; n < 10; n++) {
            const dir = n % 2 ? 1 : -1;
            padBit(sg.cx + dir * sg.w * (0.2 + Math.random() * 0.3), padY() - padH() * 0.2, DRAG_TINT,
                   0.6 + Math.random() * 0.4, dir * (90 + Math.random() * 80), -20 - Math.random() * 30, 220,
                   2 + Math.random() * 2, 0.9);
        }
    }

    // TEFLON: the grey of a pan with its shine running along him, and tiny
    // (TEF_LEN). Nothing a boss puts on him sticks (padShrug).
    LAB_PAD.teflon = {
        name: 'TEFLON',
        ink: TEF_INK, rim: TEF_RIM,
        teflon: true,
        blurb: 'tiny · nothing slows, stuns or shrinks him',
        lore: 'Nobody has ever made anything stick to this Brandon: not blame, not a nickname, ' +
              'and not one thing a boss has thrown at him.',
        len: () => TEF_LEN,
        under() { padRim('padRimT', TEF_RIM, 2.5, 0.6); },
        skin(sg, o) {
            padLay(sg, o, padTint('padTeflon', TEF_INK), 0.7);
            // a quick glint sliding along him, often: he is slick, not polished
            const sp = padFlat('padTefShine', '#ffffff');
            if (!sp) return;
            const tw = sg.w, th = tw / SHAPE_ASPECT, t = (clock % TEF_GLINT) / (TEF_GLINT * 0.4);
            if (t >= 1) return;
            ctx.save();
            ctx.translate(sg.cx, padY() + o * JIG_PADDLE);
            ctx.rotate(segWig(sg.i) + paddle.dip[sg.i]);
            ctx.beginPath();
            ctx.rect(-tw / 2 + (t * 1.3 - 0.15) * tw, -th, tw * 0.12, th * 2);
            ctx.clip();
            ctx.globalAlpha = padK * 0.4;
            ctx.drawImage(sp, -tw / 2, -th / 2, tw, th);
            ctx.globalAlpha = padK;
            ctx.restore();
        }
    };

    // ---- BLUE BLUR: spinning ---------------------------------------------------------
    // Every head in play spins flat out (engine.js holds it at SPIN_MAX), and
    // so does he: all the way round, BLUR_SPIN turns a second, never
    // stopping. His turn is paddle.dip, which everything that draws him
    // already turns him by. It is set once a frame (padBlurTurn) and spread
    // across the substeps (padBlurAt), with his ends' sweep counted toward
    // how many there are, so an end cannot jump a head between two looks.
    let blurA = 0, blurFrom = 0, blurD = 0;
    function padBlurTurn(dt) {
        if (!labPadBlur()) { blurD = 0; return; }
        blurFrom = blurA;
        blurD = BLUR_SPIN * Math.PI * 2 * dt;
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
    // is in or nearest, and bounced off that surface as it is moving -- his
    // travel and his spin both -- so a whirling end whacks it, any way at
    // all, down past him included: that is his cost. Then it goes at the
    // game's speed, never flatter than the engine allows a bounce off a brick.
    // His ends sweep far faster than a head flies, so one he has just hit is
    // left alone for BLUR_GAP: without that the next sweep caught it again,
    // and the next, and it churned round him and never left.
    function padBlurHit(b, s) {
        if (b.blurT && clock < b.blurT) return;
        const r = (bRX() + bRY()) / 2;          // turning this fast, a head is round enough
        const w = BLUR_SPIN * Math.PI * 2, py = padY();
        for (const sg of segs()) {
            const hw = sg.w / 2, a = paddle.dip[sg.i], ca = Math.cos(a), sa = Math.sin(a);
            const dx = b.x - sg.cx, dy = b.y - py;
            const lx = dx * ca + dy * sa, ly = dy * ca - dx * sa;
            if (Math.abs(lx) > hw + r || Math.abs(ly) > hw + r) continue;
            // the nearest of him to the head's middle, in his own frame
            let best = null;
            for (let x = lx - r; x <= lx + r; x += 1.5) {
                const e = outlineAt(x, hw);
                if (!e) continue;
                const inside = ly > e.top && ly < e.bot;
                const y = inside ? (ly - e.top < e.bot - ly ? e.top : e.bot) : Math.max(e.top, Math.min(e.bot, ly));
                const d = Math.hypot(lx - x, ly - y) * (inside ? -1 : 1);
                if (!best || d < best.d) best = { x, y, d, up: y === e.top };
            }
            if (!best || best.d >= r) continue;
            // out of him along the way to his surface; from inside, straight off it
            let nx, ny;
            if (best.d > 1e-3) { nx = (lx - best.x) / best.d; ny = (ly - best.y) / best.d; }
            else { nx = 0; ny = best.up ? -1 : 1; }
            const ox = best.x + nx * r, oy = best.y + ny * r;
            b.x = sg.cx + ox * ca - oy * sa;
            b.y = py + ox * sa + oy * ca;
            const wx = nx * ca - ny * sa, wy = nx * sa + ny * ca;
            // the surface where it struck, moving with him and with his turn
            const px = best.x * ca - best.y * sa, pyy = best.x * sa + best.y * ca;
            const sx = paddle.vx - w * pyy, sy = w * px;
            let rx = b.vx - sx, ry = b.vy - sy;
            const dot = rx * wx + ry * wy;
            if (dot >= 0) continue;                   // already leaving him
            rx -= 2 * dot * wx; ry -= 2 * dot * wy;
            let vx = rx + sx, vy = ry + sy;
            const sp = s * (b.boost || 1), len = Math.hypot(vx, vy) || 1;
            vx = vx / len * sp; vy = vy / len * sp;
            if (Math.abs(vy) < sp * 0.16) {
                vy = (vy < 0 ? -1 : 1) * sp * 0.16;
                vx = Math.sign(vx || 1) * Math.sqrt(sp * sp - vy * vy);
            }
            b.vx = vx; b.vy = vy;
            b.blurT = clock + BLUR_GAP;
            // coming home, as off any paddle
            paddle.jt[sg.i] = 1;
            labPadHit(b);
            combo = 0;
            b.pierced.clear();
            b.boost = 1;
            if (++hits === 4 || hits === 12) bumpSpeed(1.12);
            return;
        }
    }

    // BLUE BLUR: blue, with afterimages of himself following round behind.
    LAB_PAD.blur = {
        name: 'BLUE BLUR',
        ink: BLUR_INK, rim: BLUR_RIM,
        blur: true,
        blurb: 'heads always spin flat out · he never stops spinning',
        lore: 'The fastest Brandon there ever was, or so he says, and nobody has ever ' +
              'managed to get him to stand still long enough to argue.',
        under() {
            const sp = padTint('padBlurTrail', BLUR_INK);
            if (!sp) return;
            for (const sg of segs()) {
                const o = paddle.jt[sg.i] > 0 ? wobble(paddle.jt[sg.i]) : 0;
                const tw = sg.w, th = tw / SHAPE_ASPECT;
                for (let k = BLUR_TRAIL; k >= 1; k--) {
                    ctx.save();
                    ctx.translate(sg.cx, padY() + o * JIG_PADDLE);
                    ctx.rotate(segWig(sg.i) + paddle.dip[sg.i] - k * 0.22 * Math.sign(BLUR_SPIN));
                    ctx.globalAlpha = padK * 0.32 * (1 - k / (BLUR_TRAIL + 1));
                    ctx.drawImage(sp, -tw / 2, -th / 2, tw, th);
                    ctx.restore();
                }
            }
            ctx.globalAlpha = padK;
            padRim('padRimB', BLUR_RIM, 2.5, 0.5);
        },
        skin(sg, o) { padLay(sg, o, padTint('padBlur', BLUR_INK), 0.7); }
    };
