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
    let FROST_FLAKES = 14;   // snowflakes a second coming off him...
    let FROST_BIG  = 0.25;   // ...this share of them a big one, six of him heads out
    let ICE_SECS   = 1;      // an icy brick struck sends the head off at full speed this long...
    let ICE_RAMP   = 0.15;   // ...getting there over this, and coming back down over twice it
    let ICE_TURN   = 0.35;   // ...turned this far (rad) the way it is spinning, at the most spin
    let EMB_LEN    = 0.7;    // ember: much shorter...
    let EMB_CATCH  = 0.1;    // ...but a brick a head of his breaks has this chance of going up in embers
    let EMB_SPREAD = 0.25;   // ...a burning brick this chance of catching each one beside it
    let EMB_SPREAD_AT = 1;   // ...seconds into burning that it does
    let EMB_GLOW   = 0.45;   // how much light he gives off
    let EMB_SPARKS = 34;     // sparks a second rising off him
    let EMB_ASH    = 12;     // wisps of smoke a second: ambiance, never something to look at...
    let EMB_ASH_S  = 2.5;    // ...so each only about this many px either side of its middle...
    let EMB_ASH_A  = 0.3;    // ...and at most this solid
    let PAIR_LEN   = 0.62;   // the pair: two of him, each this much of one
    let PAIR_QUAD  = 0.7;    // ...and under DOUBLE, four, each this much of one of the two
    let PAD_MARK   = 3;      // seconds a head FROST or EMBER hits wears his frost or fire
    let V2_GLOSS   = 0.22;   // MODERN: how bright the gloss along his top is...
    let V2_GLINT   = 5;      // ...seconds between one glint and the next...
    let V2_SWEEP   = 0.9;    // ...and how long a glint takes to cross him
    LAB_KNOBS.push('GILT_LEN', 'GILT_CAPS', 'GILT_SHINE', 'STAT_LEN', 'STAT_ANGLE', 'STAT_SPIN',
                   'STAT_DIP', 'FROST_LEN', 'FROST_EDGE', 'FROST_SWIPE', 'FROST_DECK', 'FROST_FLAKES', 'FROST_BIG', 'ICE_SECS', 'ICE_RAMP', 'ICE_TURN',
                   'EMB_LEN', 'EMB_CATCH', 'EMB_SPREAD', 'EMB_SPREAD_AT', 'EMB_GLOW', 'EMB_SPARKS', 'PAIR_LEN', 'PAIR_QUAD', 'PAD_MARK', 'V2_GLOSS', 'V2_GLINT', 'V2_SWEEP');
    LAB_KNOBS.push('EMB_ASH', 'EMB_ASH_S', 'EMB_ASH_A');

    const V2_RIM    = '#e6edf5';
    const GILT_INK  = '#efb920', GILT_RIM = '#ffe9a3';
    const FROST_INK = '#8fe3f2', FROST_RIM = '#dff6ff';
    const EMB_INK   = '#e2683a', EMB_RIM = '#ffb072';
    const PAIR_INK  = '#8f7fc4';      // DOUBLE's own colour, since he is two of him

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
            if (b.kind === 'head') continue;          // his art is not in yet
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

    // one speck of whatever he is shedding
    function padBit(x, y, ink, life, vx, vy, g, s, a, kind, sway) {
        if (padBits.length > 220) return;
        padBits.push({ x, y, ink, t: 0, life, vx: vx || 0, vy: vy || 0, g: g === undefined ? 90 : g,
                       s: s || 2 + Math.random() * 2, a: a === undefined ? 0.9 : a,
                       kind: kind || 'speck', sway: sway || 0, ph: Math.random() * 6.28 });
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
    function labBrickGone(b) {
        const ball = labHitBy;
        if (!ball || !ball.mark || ball.mark.key !== 'ember' || Math.random() >= EMB_CATCH) return;
        for (let n = 0; n < 26; n++) {
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
            if (Math.random() < dt * 30 * (0.4 + 0.6 * k)) shed(b.x + Math.random() * bw, b.y + Math.random() * bh, k);
            if (f.t <= 0) {
                b.burn = null;
                if (b.alive) hitBrick(b, b.x + bw / 2, b.y + bh / 2);
            }
        }
    }

    // ---- FROST's ice -----------------------------------------------------------------
    // A head FROST has marked that strikes a silver or gold and leaves it
    // standing leaves it icy. The next head to strike an icy brick, whoever
    // sent it, goes off it at MAX_SPEED for ICE_SECS, turned a little the way
    // it is spinning -- and the ice is spent, unless that head is FROST's
    // too and the brick still stands.
    function labBrickStruck(b) {
        const ball = labHitBy;
        if (!ball) return;
        if (b.icy) {
            b.icy = false;
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
        ctx.globalAlpha = 0.25 + 0.4 * Math.max(0, 1 - f.t / PAD_MARK) + 0.08 * Math.sin(clock * 9 + b.x);
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
        const lay = (sprite, a, dx, ww) => {
            if (!sprite) return;
            const hh = ww / SHAPE_ASPECT;
            ctx.globalAlpha = a * a0;
            ctx.drawImage(sprite, x + dx - ww / 2, y - hh / 2, ww, hh);
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
            if (p.stone) lay(shapeSprite('padStone', STONE, PAD_BAKE, PAD_BAKE / SHAPE_ASPECT, 'statue'), 1, dx, ww);
            else {
                lay(shapeSprite('padIcon', null, PAD_BAKE, PAD_BAKE / SHAPE_ASPECT, false), 1, dx, ww);
                if (p.ink) lay(padTint('padTint' + p.ink, p.ink), 0.8, dx, ww);
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
        shedRate: 30,
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
                if (Math.random() > fast * 0.8) continue;
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
        shedRate: 40,
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