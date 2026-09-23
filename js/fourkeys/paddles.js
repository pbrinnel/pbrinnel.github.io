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
    let GILT_CAPS  = 1.6;    // ...and every capsule lasts him half again as long
    let GILT_SHINE = 3;      // seconds a sweep of light takes to cross him
    let STAT_LEN   = 1.2;    // statue: longer...
    let STAT_ANGLE = 0.65;   // ...flatter off his ends...
    let STAT_SPIN  = 0.35;   // ...and stone hardly grips, so he puts little spin on
    let STAT_DIP   = 1.3;    // ...but he leans further after one going past
    let FROST_LEN  = 0.95;   // frost: a touch shorter...
    let FROST_EDGE = 1.5;    // ...spin off his ends...
    let FROST_SWIPE = 2.2;   // ...and off his travel, both far easier
    let FROST_DECK = 0.6;    // ...on a narrower flat, so more of him is a curve
    let EMB_LEN    = 0.88;   // ember: shorter...
    let EMB_ANGLE  = 1.35;   // ...and his ends throw a head much harder
    let EMB_GLOW   = 0.45;   // how much light he gives off
    let PAIR_LEN   = 0.62;   // the pair: two of him, each this much of one
    LAB_KNOBS.push('GILT_LEN', 'GILT_CAPS', 'GILT_SHINE', 'STAT_LEN', 'STAT_ANGLE', 'STAT_SPIN',
                   'STAT_DIP', 'FROST_LEN', 'FROST_EDGE', 'FROST_SWIPE', 'FROST_DECK',
                   'EMB_LEN', 'EMB_ANGLE', 'EMB_GLOW', 'PAIR_LEN');

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
        return { name: (labP && labP.name) || 'STANDARD', line: say.join(' · ') || 'as the game has him' };
    }

    function labPadUpdate(dt) {
        if (labP && labP.step && phase === 'play') labP.step(dt);
        for (const b of padBits) {
            b.t += dt;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.vy += b.g * dt;
        }
        padBits = padBits.filter(b => b.t < b.life);
    }

    function labPadUnder() { if (labP && labP.under) labP.under(); }
    function labPadSkin(sg, o) { if (labP && labP.skin) labP.skin(sg, o); }
    function labPadOver() {
        if (labP && labP.over) labP.over();
        for (const b of padBits) {
            ctx.globalAlpha = Math.max(0, 1 - b.t / b.life) * b.a;
            ctx.fillStyle = b.ink;
            ctx.fillRect(b.x - b.s / 2, b.y - b.s / 2, b.s, b.s);
        }
        ctx.globalAlpha = 1;
    }

    // one speck of whatever he is shedding
    function padBit(x, y, ink, life, vx, vy, g, s, a) {
        if (padBits.length > 160) return;
        padBits.push({ x, y, ink, t: 0, life, vx: vx || 0, vy: vy || 0, g: g === undefined ? 90 : g,
                       s: s || 2 + Math.random() * 2, a: a === undefined ? 0.9 : a });
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
    LAB_PAD.standard = { name: 'STANDARD', blurb: 'him, as the game has always had him' };

    // GILT: gold leaf over the photograph, with a sweep of light crossing him
    // every few seconds. Shorter than standard, and everything he catches
    // lasts him longer.
    LAB_PAD.gilt = {
        name: 'GILT',
        ink: GILT_INK, rim: GILT_RIM,
        blurb: 'shorter · capsules last half again as long',
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
        blurb: 'spin goes on easily · a narrow flat to land on',
        len: () => FROST_LEN,
        edge: () => FROST_EDGE,
        swipe: () => FROST_SWIPE,
        deck: () => FROST_DECK,
        under() { padRim('padRimF', FROST_RIM, 2.5, 0.55); },
        skin(sg, o) { padLay(sg, o, padTint('padFrost', FROST_INK), 0.82); },
        step(dt) {
            const fast = Math.min(1, Math.abs(paddle.vx) / 500);
            if (Math.random() > fast * 0.8) return;
            const segsNow = segs();
            const sg = segsNow[(Math.random() * segsNow.length) | 0];
            padBit(sg.cx + (Math.random() - 0.5) * sg.w, padY() + (Math.random() - 0.5) * padH(),
                   FROST_RIM, 0.5 + Math.random() * 0.4, -paddle.vx * 0.12 + (Math.random() - 0.5) * 40,
                   -30 - Math.random() * 40, 40, 1.5 + Math.random() * 2);
        }
    };

    // EMBER: lit from underneath, throwing sparks that rise. Shorter than
    // standard, and his ends throw a head much harder than anyone else's --
    // the whole field is reachable off him, and so is the wall beside you.
    LAB_PAD.ember = {
        name: 'EMBER',
        ink: EMB_INK, rim: EMB_RIM,
        blurb: 'his ends throw hardest · shorter than standard',
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
        step(dt) {
            if (Math.random() > dt * 22) return;
            const segsNow = segs();
            const sg = segsNow[(Math.random() * segsNow.length) | 0];
            padBit(sg.cx + (Math.random() - 0.5) * sg.w * 0.9, padY() - padH() * 0.2,
                   Math.random() < 0.4 ? EMB_RIM : EMB_INK, 0.8 + Math.random() * 0.7,
                   (Math.random() - 0.5) * 30, -40 - Math.random() * 60, -30, 1.5 + Math.random() * 2.5);
        }
    };

    // THE PAIR: two of him, always, in DOUBLE's own colour, each one shorter
    // than standard. Wider reach than anybody and a hole down the middle of
    // it -- and DOUBLE, when it drops, only widens the gap.
    LAB_PAD.pair = {
        name: 'THE PAIR',
        ink: PAIR_INK, twin: true,
        blurb: 'two of him · a hole down the middle',
        len: () => PAIR_LEN,
        split: () => true,
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