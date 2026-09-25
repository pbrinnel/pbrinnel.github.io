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
    let FROST_FLAKES = 14;   // snowflakes a second coming off him
    let EMB_LEN    = 0.88;   // ember: shorter...
    let EMB_ANGLE  = 1.35;   // ...and his ends send a head off at a much sharper angle
    let EMB_GLOW   = 0.45;   // how much light he gives off
    let EMB_SPARKS = 34;     // sparks a second rising off him
    let PAIR_LEN   = 0.62;   // the pair: two of him, each this much of one
    let PAIR_QUAD  = 0.7;    // ...and under DOUBLE, four, each this much of one of the two
    let PAD_MARK   = 3;      // seconds a head FROST or EMBER hits wears his frost or fire
    let V2_GLOSS   = 0.22;   // MODERN: how bright the gloss along his top is...
    let V2_GLINT   = 5;      // ...seconds between one glint and the next...
    let V2_SWEEP   = 0.9;    // ...and how long a glint takes to cross him
    LAB_KNOBS.push('GILT_LEN', 'GILT_CAPS', 'GILT_SHINE', 'STAT_LEN', 'STAT_ANGLE', 'STAT_SPIN',
                   'STAT_DIP', 'FROST_LEN', 'FROST_EDGE', 'FROST_SWIPE', 'FROST_DECK', 'FROST_FLAKES',
                   'EMB_LEN', 'EMB_ANGLE', 'EMB_GLOW', 'EMB_SPARKS', 'PAIR_LEN', 'PAIR_QUAD', 'PAD_MARK', 'V2_GLOSS', 'V2_GLINT', 'V2_SWEEP');

    const V2_RIM    = '#e6edf5';
    const GILT_INK  = '#efb920', GILT_RIM = '#ffe9a3';
    const FROST_INK = '#8fe3f2', FROST_RIM = '#dff6ff';
    const EMB_INK   = '#e2683a', EMB_RIM = '#ffb072';
    const PAIR_INK  = '#8f7fc4';      // DOUBLE's own colour, since he is two of him

    // ---- what the game asks -------------------------------------------------------
    function labPadUse(key) {
        labP = LAB_PAD[key] || LAB_PAD.standard;
        deckAtW = -1;                 // his flat may be a different width now
        padBits = [];
    }
    const labPadW     = () => labP && labP.len ? labP.len() : 1;
    const labPadAngle = () => labP && labP.angle ? labP.angle() : 1;
    const labPadEdge  = () => labP && labP.edge ? labP.edge() : 1;
    const labPadSwipe = () => labP && labP.swipe ? labP.swipe() : 1;
    const labPadDip   = () => labP && labP.dip ? labP.dip() : 1;
    const labPadDeck  = () => labP && labP.deck ? labP.deck() : 1;
    const labPadCaps  = () => labP && labP.caps ? labP.caps() : 1;
    const labPadSplit = () => !!(labP && labP.split);
    const labPadQuad  = () => labP && labP.quad ? labP.quad() : 1;

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
        if (labP && labP.step && !(king && phase === 'fall')) labP.step(dt);
        padMarkStep(dt);
        for (const b of padBits) {
            b.t += dt;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.vy += b.g * dt;
            if (b.sway) b.x += Math.sin(b.t * 3 + b.ph) * b.sway * dt;
        }
        padBits = padBits.filter(b => b.t < b.life);
    }

    function labPadUnder() { if (labP && labP.under) labP.under(); }
    function labPadSkin(sg, o) { if (labP && labP.skin) labP.skin(sg, o); }
    function labPadOver() {
        if (labP && labP.over) labP.over();
        for (const b of padBits) {
            const a = Math.max(0, 1 - b.t / b.life) * b.a;
            if (b.kind === 'flake') {
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
                const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.s * 2.4);
                g.addColorStop(0, b.ink);
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.globalAlpha = a * 0.55;
                ctx.fillStyle = g;
                ctx.fillRect(b.x - b.s * 2.4, b.y - b.s * 2.4, b.s * 4.8, b.s * 4.8);
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
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, -tw / 2, -th / 2, tw, th);
        ctx.globalAlpha = 1;
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
            ctx.globalAlpha = alpha;
            ctx.drawImage(sp, -tw / 2, -th / 2, tw, th);
            ctx.globalAlpha = 1;
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
        under() { padRim('padRimV', V2_RIM, 2, 0.45); },
        skin(sg, o) {
            const sp = padFlat('padGloss', '#ffffff');
            const gl = padGloss(sp);
            if (!sp) return;
            const tw = sg.w, th = tw / SHAPE_ASPECT;
            ctx.save();
            ctx.translate(sg.cx, padY() + o * JIG_PADDLE);
            ctx.rotate(segWig(sg.i) + paddle.dip[sg.i]);
            ctx.globalAlpha = V2_GLOSS;
            ctx.drawImage(gl, -tw / 2, -th / 2, tw, th);
            // the glint: a narrow band crossing him, then nothing until the next
            const t = (clock % V2_GLINT) / V2_SWEEP;
            if (t < 1) {
                ctx.beginPath();
                ctx.rect(-tw / 2 + (t * 1.2 - 0.1) * tw, -th, tw * 0.08, th * 2);
                ctx.clip();
                ctx.globalAlpha = 0.3;
                ctx.drawImage(sp, -tw / 2, -th / 2, tw, th);
            }
            ctx.globalAlpha = 1;
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
    LAB_PAD.classic = { name: 'CLASSIC', blurb: 'the original · plays the same as MODERN' };

    // GILT: gold leaf over the photograph, with a sweep of light crossing him
    // every few seconds. Shorter than standard, and everything he catches
    // lasts him longer.
    LAB_PAD.gilt = {
        name: 'GILT',
        ink: GILT_INK, rim: GILT_RIM,
        blurb: 'shorter · power-ups last longer',
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
            ctx.globalAlpha = 0.34;
            ctx.drawImage(sp, -tw / 2, -th / 2, tw, th);
            ctx.globalAlpha = 1;
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
        blurb: 'easier to add spin · smaller sweet spot',
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
            // as they go...
            if (Math.random() < dt * FROST_FLAKES) {
                const p = padSomewhere(0.95);
                padBit(p.x, padY() + (Math.random() - 0.5) * padH() * 0.6,
                       Math.random() < 0.5 ? FROST_RIM : FROST_INK, 1.4 + Math.random() * 1.2,
                       (Math.random() - 0.5) * 14, 6 + Math.random() * 14, 8,
                       2 + Math.random() * 2.2, 0.85, 'flake', 18 + Math.random() * 16);
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

    // EMBER: lit from underneath, throwing sparks that rise. Shorter than
    // standard, and his ends send a head off sharper than anyone else's --
    // the whole field is reachable off him, and so is the wall beside you.
    LAB_PAD.ember = {
        name: 'EMBER',
        ink: EMB_INK, rim: EMB_RIM,
        blurb: 'sharper angles off his ends · shorter',
        len: () => EMB_LEN,
        angle: () => EMB_ANGLE,
        under() {
            const r = padW() * 0.95;
            const g = ctx.createRadialGradient(paddle.x, padY(), 8, paddle.x, padY(), r);
            g.addColorStop(0, EMB_INK);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            // a steady light with a slow breath in it: nothing here flashes
            ctx.globalAlpha = EMB_GLOW * (0.85 + 0.15 * Math.sin(clock * 1.7));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(paddle.x, padY(), r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
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
            // now and then a flake of ash, drifting up slower and greyer
            if (Math.random() < dt * 3) {
                const p = padSomewhere(0.8);
                padBit(p.x, padY() - padH() * 0.2, '#8a7f76', 1.8 + Math.random(),
                       (Math.random() - 0.5) * 20, -18 - Math.random() * 20, -4, 2 + Math.random() * 1.5, 0.6);
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
                    ctx.globalAlpha = e.a;
                    ctx.drawImage(sp, -tw / 2, -th / 2, tw, th);
                    ctx.globalAlpha = 1;
                    ctx.restore();
                }
            }
        },
        skin(sg, o) { padLay(sg, o, padTint('padPair', PAIR_INK), 0.62); }
    };