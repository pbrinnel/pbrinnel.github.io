'use strict';

    // ---- BOOT (mini-boss) ---------------------------------------------------------------
    // His boot, cut off the photograph with his shin still in it, comes down
    // on you from above the screen. It follows you across as it sinks. A hit
    // on the sole knocks it back up and hurts it; anything else just bounces.
    // If it gets all the way down it stamps -- on you, if you are under it,
    // which costs a life -- then lifts back up and comes again.
    let BOOT_HP    = 6;       // hits on the sole to see it off
    let BOOT_W     = 180;     // px along the sole
    let BOOT_SINK  = 26;      // px/s it comes down
    let BOOT_KNOCK = 70;      // px a hit on the sole puts it back up
    let BOOT_TRACK = 60;      // px/s it follows you across
    let BOOT_TOP   = 150;     // where its sole starts, down from the top, and goes back to
    let BOOT_LIFT  = 1.2;     // seconds it takes to lift again after a stamp
    let BOOT_PTS   = 120;     // a hit on the sole
    // The act a run draws it from, 1 easy to 3 hard. It is the only one of
    // them that takes a life off you outright, and it asks for a hit on the
    // sole every few seconds while you are keeping a head alive.
    let BOOT_LVL   = 4;
    LAB_KNOBS.push('BOOT_LVL', 'BOOT_HP', 'BOOT_W', 'BOOT_SINK', 'BOOT_KNOCK', 'BOOT_TRACK',
                   'BOOT_TOP', 'BOOT_LIFT', 'BOOT_PTS');

    // Read off the levelled art: the toe and heel of his sole in his own box
    // (u along him from the boot, v down), and what is kept of him -- the boot
    // and his shin -- as u0, v0, u1, v1. The sole runs 61.5 degrees off level
    // there, and turning it flat puts it facing straight down.
    const BOOT_TOE = [0.005, 0.22], BOOT_HEEL = [0.07, 0.56];
    const BOOT_CROP = [0, 0.12, 0.62, 0.62];
    // his shape as the physics sees it, in sole lengths from the sole's middle:
    // the boot as a box that high, and his shin as a bar that thick either side
    const BOOT_TALL = 0.55, BOOT_SHIN = 0.2;

    let boot = null;
    let bootGeomAt = -1, bootGeomCache = null;

    LAB_MINI.boot = {
        start() {
            boot = { x: LW / 2, sole: -BOOT_W * 2, hp: BOOT_HP, maxHp: BOOT_HP, flash: 0, iframes: 0,
                     lift: 0, stamps: 0, caught: 0, arriving: true };
            return true;
        },
        reset() { boot = null; },
        busy() { return !!boot && boot.hp > 0; },
        update: bootUpdate,
        ballStep: bootBallStep,
        draw: bootDraw,
        finish() { if (!boot || boot.hp <= 0) return false; boot.hp = 1; return true; },
        state() {
            return { name: 'BOOT', hp: boot.hp, max: boot.maxHp,
                     line: boot.hp > 0 ? 'sole at ' + Math.round(boot.sole) + ' px · stamped ' + boot.stamps +
                                         '× · on you ' + boot.caught + '×' : 'seen off' };
        }
    };

    // everything that follows from BOOT_W: how big to lay his whole body out
    // for the sole to be that long, how far to turn it, and where the sole's
    // middle sits in the turned sprite
    function bootGeom() {
        if (bootGeomAt === BOOT_W) return bootGeomCache;
        const du = BOOT_HEEL[0] - BOOT_TOE[0], dv = (BOOT_HEEL[1] - BOOT_TOE[1]) / SHAPE_ASPECT;
        const W = BOOT_W / Math.hypot(du, dv), H = W / SHAPE_ASPECT;
        const turn = -Math.atan2(dv, du);
        const c = Math.cos(turn), s = Math.sin(turn);
        const mx = (BOOT_TOE[0] + BOOT_HEEL[0]) / 2 * W, my = (BOOT_TOE[1] + BOOT_HEEL[1]) / 2 * H;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        const [u0, v0, u1, v1] = BOOT_CROP;
        for (const [u, v] of [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]) {
            const dx = u * W - mx, dy = v * H - my;
            const rx = dx * c - dy * s, ry = dx * s + dy * c;
            x0 = Math.min(x0, rx); x1 = Math.max(x1, rx);
            y0 = Math.min(y0, ry); y1 = Math.max(y1, ry);
        }
        bootGeomAt = BOOT_W;
        bootGeomCache = { W, H, turn, c, s, mx, my, ax: -x0, ay: -y0, sw: x1 - x0, sh: y1 - y0 };
        return bootGeomCache;
    }

    // the boot and shin, turned sole-down: 'raw', or 'flash' in the hit colour
    function bootSprite(kind) {
        const k = 'boot-' + kind + '@' + Math.round(BOOT_W);
        if (spriteCache.has(k)) return spriteCache.get(k);
        if (!ready(paddleImg)) return null;
        const g0 = bootGeom(), [u0, v0, u1, v1] = BOOT_CROP;
        const a = document.createElement('canvas');
        a.width = Math.ceil(g0.W * 2); a.height = Math.ceil(g0.H * 2);
        const ga = a.getContext('2d');
        ga.scale(2, 2);
        placeShape(ga, g0.W, g0.H, false);
        ga.globalCompositeOperation = 'destination-in';
        ga.fillRect(u0 * g0.W, v0 * g0.H, (u1 - u0) * g0.W, (v1 - v0) * g0.H);
        if (kind === 'flash') {
            ga.globalCompositeOperation = 'source-in';
            ga.fillStyle = '#f2efe9';
            ga.fillRect(0, 0, g0.W, g0.H);
        }
        const c = document.createElement('canvas');
        c.width = Math.ceil(g0.sw * 2); c.height = Math.ceil(g0.sh * 2);
        const g = c.getContext('2d');
        g.scale(2, 2);
        g.translate(g0.ax, g0.ay);
        g.rotate(g0.turn);
        g.translate(-g0.mx, -g0.my);
        g.drawImage(a, 0, 0, g0.W, g0.H);
        spriteCache.set(k, c);
        return c;
    }

    // the shin's bar, in the field: from just above the boot, up his leg
    function bootShin() {
        const g = bootGeom(), W = BOOT_W;
        const ax = boot.x + W * 0.1, ay = boot.sole - W * (BOOT_TALL + 0.05);
        return [ax, ay, ax + g.c * W * 3, ay + g.s * W * 3];
    }

    function bootUpdate(dt) {
        if (!boot) return;
        if (boot.flash > 0) boot.flash = Math.max(0, boot.flash - dt * 5);
        if (boot.iframes > 0) boot.iframes = Math.max(0, boot.iframes - dt);
        if (boot.hp <= 0) { boot.sole -= 700 * dt; return; }     // off it goes, back where it came from
        // down into view at the start, whatever the phase
        if (boot.arriving) {
            boot.sole += (BOOT_TOP - boot.sole) * (1 - Math.exp(-dt / 0.35));
            if (Math.abs(boot.sole - BOOT_TOP) < 1) boot.arriving = false;
            return;
        }
        if (phase !== 'play') return;
        if (boot.lift > 0) {
            boot.lift = Math.max(0, boot.lift - dt);
            boot.sole += (BOOT_TOP - boot.sole) * (1 - Math.exp(-dt / 0.3));
            return;
        }
        boot.sole += BOOT_SINK * dt;
        boot.x += Math.max(-BOOT_TRACK * dt, Math.min(BOOT_TRACK * dt, paddle.x - boot.x));
        boot.x = Math.max(BOOT_W / 2, Math.min(LW - BOOT_W / 2, boot.x));
        // all the way down: the stamp
        const floor = padY() - padH() / 2;
        if (boot.sole >= floor) {
            boot.sole = floor;
            boot.lift = BOOT_LIFT;
            boot.stamps++;
            const sg = segs().find(sg => Math.abs(sg.cx - boot.x) < sg.w / 2 + BOOT_W / 2 - 10);
            if (sg) {
                paddle.jt[sg.i] = 1;
                boot.caught++;
                loseLife();
            }
        }
    }

    function bootBallStep(b) {
        if (!boot || boot.hp <= 0 || boot.arriving) return;
        const W = BOOT_W, up = b.vy < 0;
        let hit = boxContact(b, boot.x - W / 2, boot.sole - W * BOOT_TALL, boot.x + W / 2, boot.sole);
        const sole = !!hit && hit.cy >= boot.sole - 0.5 && b.y > boot.sole;
        if (!hit) {
            const [ax, ay, bx, by] = bootShin();
            hit = capsuleContact(b, ax, ay, bx, by, W * BOOT_SHIN);
        }
        if (!hit) return;
        labBounce(b, hit);
        if (!sole || !up || boot.iframes > 0) return;
        // a hit on the sole: back up it goes, and it hurts
        boot.hp--;
        boot.flash = 1;
        boot.iframes = 0.2;
        boot.sole = Math.max(BOOT_TOP, boot.sole - BOOT_KNOCK);
        award(BOOT_PTS, hit.cx, hit.cy);
        if (boot.hp <= 0) labClearIfDone();
    }

    function bootDraw() {
        if (!boot || boot.sole < -BOOT_W * 4) return;
        const g = bootGeom(), sp = bootSprite('raw');
        if (!sp) return;
        const x = boot.x - g.ax, y = boot.sole - g.ay;
        ctx.drawImage(sp, x, y, g.sw, g.sh);
        if (boot.flash > 0) {
            ctx.globalAlpha = Math.min(1, boot.flash) * 0.7;
            ctx.drawImage(bootSprite('flash'), x, y, g.sw, g.sh);
            ctx.globalAlpha = 1;
        }
        if (boot.hp > 0) labBar(boot.x - 40, boot.sole + 6, 80, boot.hp / boot.maxHp, 3);
        if (LAB.zone) {
            // lab only: what the physics meets, and the sole that counts
            const W = BOOT_W, [ax, ay, bx, by] = bootShin();
            ctx.strokeStyle = 'rgba(111,175,58,0.7)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(boot.x - W / 2, boot.sole - W * BOOT_TALL, W, W * BOOT_TALL);
            ctx.lineWidth = W * BOOT_SHIN * 2;
            ctx.globalAlpha = 0.18;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#cf6b4e';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(boot.x - W / 2, boot.sole); ctx.lineTo(boot.x + W / 2, boot.sole); ctx.stroke();
        }
    }