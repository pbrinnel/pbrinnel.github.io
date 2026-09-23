'use strict';

    // ---- THE CHAIN (mini-boss) ---------------------------------------------------
    // One brandon with a head swinging round him on a chain of smaller heads,
    // and he keeps it between himself and whatever is coming. The head knocks
    // your shot away; only the man is worth hitting. Every so often he flings
    // it down at you instead -- a helping of SLUGGISH if it lands on you -- and
    // while it is out there his guard is down.
    let CH_LVL    = 5;
    let CH_HP     = 4;      // hits to see him off
    let CH_W      = 150;    // how long he is
    let CH_Y      = 250;    // the line he patrols
    let CH_SPEED  = 70;     // px/s he walks at
    let CH_R      = 115;    // px the head swings out at
    let CH_HEAD   = 64;     // how wide that head is
    let CH_SPIN   = 1.5;    // rad/s it goes round at when nothing is coming
    let CH_TURN   = 3.2;    // rad/s he can bring it round to guard with
    let CH_STRIKE = 4.5;    // seconds between the times he flings it at you
    let CH_REACH  = 300;    // px the chain runs out to when he does
    let CH_PTS    = 150;    // a hit on the man
    LAB_KNOBS.push('CH_LVL', 'CH_HP', 'CH_W', 'CH_Y', 'CH_SPEED', 'CH_R', 'CH_HEAD', 'CH_SPIN',
                   'CH_TURN', 'CH_STRIKE', 'CH_REACH', 'CH_PTS');

    const CH_BEADS = 6;     // the chain, in heads

    let chain = null;

    LAB_MINI.chain = {
        start() {
            chain = { x: LW / 2, dir: 1, a: Math.PI / 2, r: CH_R, hp: CH_HP, maxHp: CH_HP,
                      flash: 0, jt: 0, jnx: 0, jny: 0, strike: CH_STRIKE, out: 0, spent: false,
                      blocks: 0, landed: 0, fall: null };
            return true;
        },
        reset() { chain = null; },
        busy() { return !!chain && chain.hp > 0; },
        update(dt) {
            if (!chain) return;
            if (chain.fall) stepCrumble(chain.fall, dt, 0.2);
            if (chain.hp <= 0) return;
            if (chain.flash > 0) chain.flash = Math.max(0, chain.flash - dt * 6);
            if (chain.jt > 0) chain.jt = Math.max(0, chain.jt - dt * JIG_DECAY);
            if (phase !== 'play') return;
            chain.x += chain.dir * CH_SPEED * dt;
            if (chain.x < CH_W / 2) { chain.x = CH_W / 2; chain.dir = 1; }
            if (chain.x > LW - CH_W / 2) { chain.x = LW - CH_W / 2; chain.dir = -1; }

            if (chain.out > 0) {
                // flung out at you, and reeled back in
                chain.out -= dt;
                const k = Math.max(0, Math.min(1, chain.out / 0.9));
                chain.r = CH_R + (CH_REACH - CH_R) * Math.sin(Math.PI * (1 - k));
                const h = chHead();
                if (!chain.spent && Math.abs(h.y - padY()) < padH() / 2 + CH_HEAD / 2) {
                    const sg = segs().find(s => Math.abs(h.x - s.cx) < s.w / 2 + CH_HEAD / 2);
                    if (sg) { addDrag(sg, h.x); chain.spent = true; chain.landed++; }
                }
                if (chain.out <= 0) { chain.r = CH_R; chain.strike = CH_STRIKE; }
                return;
            }
            // the guard: he brings it round toward whatever is nearest, and it
            // keeps turning when nothing is
            let near = null, gap = Infinity;
            for (const b of balls) {
                if (b.stuck || caught(b)) continue;
                const d = Math.hypot(b.x - chain.x, b.y - CH_Y);
                if (d < gap) { gap = d; near = b; }
            }
            if (near) {
                const want = Math.atan2(near.y - CH_Y, near.x - chain.x);
                const d = Math.atan2(Math.sin(want - chain.a), Math.cos(want - chain.a));
                chain.a += Math.max(-CH_TURN * dt, Math.min(CH_TURN * dt, d));
            } else {
                chain.a += CH_SPIN * dt;
            }
            if ((chain.strike -= dt) <= 0) {
                chain.out = 0.9;
                chain.spent = false;
                chain.a = Math.atan2(padY() - CH_Y, paddle.x - chain.x);
            }
        },
        ballStep(b) {
            if (!chain || chain.hp <= 0) return;
            // the head first: it is what he is hiding behind
            const h = chHead(), r = CH_HEAD / 2;
            const onHead = ellipseContact(b, h.x, h.y, r, r * (BALL_RY / BALL_RX));
            if (onHead) {
                labBounce(b, onHead);
                chain.blocks++;
                rings.push({ x: onHead.cx, y: onHead.cy, t: 1 });
                return;
            }
            const w = CH_W, hh = w / SHAPE_ASPECT;
            const hit = maskContact(b, chain.x, CH_Y, 0, w, hh, MASK, chain.dir < 0);
            if (!hit) return;
            labBounce(b, hit);
            chain.flash = 1;
            chain.jt = 1;
            chain.jnx = Math.sign(chain.x - hit.cx) || 1;
            award(CH_PTS, hit.cx, hit.cy);
            if (--chain.hp > 0) return;
            chain.fall = shatter(chain.x, CH_Y, CH_W, 1.2);
            maybeDropCapsule(chain.x, CH_Y);
            labClearIfDone();
        },
        draw: chDraw,
        finish() { if (!chain || chain.hp <= 0) return false; chain.hp = 1; return true; },
        state() {
            return { name: 'THE CHAIN', hp: Math.max(0, chain.hp), max: chain.maxHp,
                     line: chain.hp > 0 ? (chain.out > 0 ? 'flung out at you' : 'guarding') +
                           ' · knocked away ' + chain.blocks + ' · landed on you ' + chain.landed : 'seen off' };
        }
    };

    function chHead() {
        return { x: chain.x + Math.cos(chain.a) * chain.r, y: CH_Y + Math.sin(chain.a) * chain.r };
    }

    function chDraw() {
        if (!chain) return;
        if (chain.fall) drawCrumble(chain.fall, 0, 0, true);
        if (chain.hp <= 0) return;
        const w = CH_W, hh = w / SHAPE_ASPECT;
        const h = chHead();
        // the chain: heads shrinking out to the big one
        if (ready(ballImg)) {
            for (let i = 1; i <= CH_BEADS; i++) {
                const t = i / (CH_BEADS + 1);
                const bw2 = CH_HEAD * (0.25 + 0.4 * t), bh2 = bw2 * (BALL_RY / BALL_RX);
                ctx.drawImage(ballImg, chain.x + (h.x - chain.x) * t - bw2 / 2,
                              CH_Y + (h.y - CH_Y) * t - bh2 / 2, bw2, bh2);
            }
        }
        const sp = shapeSprite('chain', null, w, hh, false);
        if (sp) {
            const o = chain.jt > 0 ? wobble(chain.jt) * JIG_BRICK : 0;
            ctx.save();
            ctx.translate(chain.x + chain.jnx * o, CH_Y);
            if (chain.dir < 0) ctx.scale(-1, 1);
            ctx.drawImage(sp, -w / 2, -hh / 2, w, hh);
            if (chain.flash > 0) {
                ctx.globalAlpha = Math.min(1, chain.flash) * 0.75;
                ctx.drawImage(shapeSprite('flash', '#f2efe9', w, hh, true), -w / 2, -hh / 2, w, hh);
                ctx.globalAlpha = 1;
            }
            ctx.restore();
        }
        if (ready(ballImg)) {
            const hw = CH_HEAD, hgt = hw * (BALL_RY / BALL_RX);
            ctx.drawImage(ballImg, h.x - hw / 2, h.y - hgt / 2, hw, hgt);
        }
        labBar(chain.x - 40, CH_Y + hh / 2 + 6, 80, chain.hp / chain.maxHp, 3);
    }