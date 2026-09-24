'use strict';

    // ---- THE MENU ------------------------------------------------------------------
    // brandon2's whole shape on one screen, and the only way round it is the
    // game itself. You are the paddle: slide him along the bottom, hold to walk
    // him up the town, and walk into a building to go into that level. Nothing
    // here is clicked at, and there is no ball -- he carries his head with him.
    //
    //   four levels, in any order, and each one you finish gives a key
    //   four keys open the CASTLE
    //   finish a level without losing a head and you keep the paddle it guarded
    //   win any level at all and CLASSIC, the first game's paddle, is yours
    //
    // The five are laid out as a town: the FARM and the RUINS out on the left,
    // the CITY and the VOLCANO on the right, and the CASTLE far off in the
    // middle, high and small. Nearer is lower and bigger, so the FARM is a step
    // away and the CASTLE is a walk. No two of them share any part of a lane,
    // so there is always a straight walk up to the one you want.
    // Each one owns a colour, and its key is a head in that colour -- five keys
    // that can be told apart at a glance, and a town where every building reads
    // as its own place.
    const MENU_LEVELS = [
        { n: 1, name: 'FARM', ink: '#7fa85a', cap: 'gable', pad: 'gilt' },
        { n: 2, name: 'RUINS', ink: '#b0a894', cap: 'broken', pad: 'statue' },
        { n: 3, name: 'CITY', ink: '#6f9bc4', cap: 'skyline', pad: 'frost' },
        { n: 4, name: 'VOLCANO', ink: '#d2622f', cap: 'cone', pad: 'ember' }
    ];
    const MENU_LAST = { n: 5, name: 'CASTLE', ink: '#9a7fc9', cap: 'crown', pad: 'pair' };
    // The first win anywhere, clean or not, also hands over CLASSIC. He plays
    // exactly as the paddle you started with, so there is nothing in him to
    // earn -- he is a souvenir, and the first one a player picks up.
    const MENU_SOUVENIR = 'classic';
    // Who a level hands you is whoever the level sliders say, so moving a boss
    // in his own tab moves him in the town too. No second copy of the roster to
    // fall out of step with the first.
    const MENU_BOSSES = { windmill: 'WM_LVL', idol: 'IDOL_LVL', twins: 'TW_LVL',
                          lamps: 'LAMP_LVL', gleeok: 'GL_LVL', headless: 'HL_LVL',
                          agahnim: 'AG_LVL', dodongo: 'DOD_LVL' };
    const MENU_ALL = MENU_LEVELS.concat([MENU_LAST]);
    const MENU_KEY = 'brandon-metalab.progress';
    // the line under the field: in the town there is nothing to serve
    const M_HINT = 'move to slide brandon · hold to walk him';
    // the rack, in the order the gates walk through it: the one you start with,
    // then the one each level is guarding, then the souvenir
    const MENU_PADS = ['standard'].concat(MENU_LEVELS.map(l => l.pad), MENU_LAST.pad, MENU_SOUVENIR);

    let menu = null;                 // the hub outlives a stage: see menuWatch

    LAB_MINI.menu = {
        // whatever stage it was standing up, the hub takes the field to itself
        start() { bricks = []; menuBuild(); return true; },
        reset() { },
        busy() { return false; },
        update: menuUpdate,
        state() {
            const p = menuProgress();
            return { name: 'THE MENU',
                     line: p.keys.length + ' of 4 keys · ' +
                           (menu.lift ? Math.round(menu.lift) + 'px up the town' : 'at home') +
                           ' · paddles ' + p.pads.length + ' of ' + MENU_PADS.length };
        },
        acts: {
            clean() { return menuBeat(true); },
            dirty() { return menuBeat(false); },
            all() {
                menuLoad();
                for (const l of MENU_ALL) menu.keys[l.n] = true;
                for (const k of MENU_PADS) menu.pads[k] = true;
                menuSave();
                menuSay('EVERYTHING OPEN');
                return true;
            },
            wipe() {
                menuLoad();
                menu.keys = {}; menu.pads = { standard: true }; menu.best = {};
                menuSave();
                LAB.usePad('standard');
                return true;
            }
        }
    };

    function menuLoad() {
        if (menu) return menu;
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(MENU_KEY) || 'null'); } catch (e) { saved = null; }
        menu = { keys: (saved && saved.keys) || {}, pads: (saved && saved.pads) || { standard: true },
                 best: (saved && saved.best) || {}, sel: 1, say: null, sayT: 0,
                 cards: [], run: null, side: 0, hold: 0, sw: null,
                 march: false, lift: 0, into: null, walk: 0, gait: 0 };
        return menu;
    }

    function menuSave() {
        try {
            localStorage.setItem(MENU_KEY, JSON.stringify({ keys: menu.keys, pads: menu.pads, best: menu.best }));
        } catch (e) { /* a private window just will not remember */ }
    }

    function menuProgress() {
        menuLoad();
        return { keys: Object.keys(menu.keys).filter(k => menu.keys[k]),
                 pads: Object.keys(menu.pads).filter(k => menu.pads[k]) };
    }

    function menuOpened() { return menuProgress().keys.length >= MENU_LEVELS.length; }

    // ---- what the debug menu reaches in through ---------------------------------------
    // Everything the town knows about you is in `menu`, and `menu` is this
    // file's. These four are the whole of the way in, so nothing else has to
    // know how progress is stored or that it is saved at all.
    function menuLevels() { menuLoad(); return MENU_ALL; }
    function menuPads() { menuLoad(); return MENU_PADS; }
    function menuHas(what, k) { menuLoad(); return !!menu[what][k]; }
    function menuSet(what, k, on) {
        menuLoad();
        if (on) menu[what][k] = true; else delete menu[what][k];
        // a paddle taken back out from under you leaves you holding nothing
        if (what === 'pads' && !on && LAB.pad === k) LAB.usePad('standard');
        menuSave();
    }

    function menuName(n) { const l = MENU_ALL.find(o => o.n === n); return l ? l.name : 'LEVEL ' + n; }

    // the first boss whose level slider points at this one, if any
    function menuBossFor(n) {
        for (const k of Object.keys(MENU_BOSSES)) if (LAB.ev(MENU_BOSSES[k]) === n) return k;
        return null;
    }

    // ---- the town -------------------------------------------------------------------
    // He walks up from y 542, so the near pair is a short walk and the far one
    // is a long one. Their x spans never overlap and each is a lane straight up
    // to one building: 25-161 is the FARM's, 187-305 the RUINS', 331-469 goes
    // all the way up the middle to the CASTLE, and the right is the mirror.
    //
    // The five stand 26px apart all the way across, between the two gates at
    // 0-24 and 776-800. Evenly spaced is the whole of the arrangement: the
    // CASTLE used to sit in a 6px slot between its neighbours, which read as
    // the middle of the town being crowded rather than as the far end of it.
    // Buying that room cost every building some width, and the far pair lost
    // most -- which is what being further away should look like anyway.
    const M_TOP = 78;                        // the band the objective sits in
    // the one line of patter goes in the gap between the far row and the near
    // one -- the floor is the gates' now, and the near pair reach down to 454
    const M_SAY_Y = 334;
    const M_TOWN = {
        1: { x: 93, y: 400, w: 136, h: 108 },
        2: { x: 246, y: 254, w: 118, h: 100 },
        3: { x: 554, y: 254, w: 118, h: 100 },
        4: { x: 707, y: 400, w: 136, h: 108 },
        5: { x: 400, y: 160, w: 138, h: 94 }
    };

    function menuBuild() {
        menuLoad();
        menu.sw = null;
        menu.side = 0;
        menu.hold = 0;
        menu.march = false;
        menu.lift = 0;
        menu.into = null;
        menu.gait = 0;
        menu.cards = MENU_ALL.map(l => Object.assign({ level: l }, M_TOWN[l.n]));
    }

    function menuSay(t) { menu.say = t; menu.sayT = 2.6; }

    // is the hub the thing on screen?
    function menuUp() { return !!(menu && LAB.mini === 'menu' && menu.cards.length); }

    // how far up the town he has walked. padY() asks, so his box, his art, the
    // head he is carrying and everything measured off him all move together.
    function menuLift() { return menuUp() ? menu.lift : 0; }

    // ---- walking ---------------------------------------------------------------------
    // Hold and he walks forward; let go and he comes back down, quicker than he
    // went. The same gesture on a phone: a finger down walks him, and sliding it
    // still steers, so one finger does the whole hub.
    //
    // He stops at the door rather than walking through it, and going in wants
    // DOOR_HOLD more seconds of holding -- a level is a long way to be sent by
    // a walk you had not finished thinking about. Letting go anywhere in that
    // second takes it all back.
    const MARCH_UP = 118;            // px/s forward
    const MARCH_BACK = 300;          // px/s back home
    const MARCH_MAX = 340;           // past the last door, for the empty lanes
    const DOOR_HOLD = 0.8;           // stood in the doorway before it opens
    const WALK_HZ = 2.3;             // paces a second, which is what the bob is
    const WALK_BOB = 0.8;            // how much he rises and falls, in jig units
    const WALK_ROCK = 0.055;         // ...and rolls, in radians

    function menuMarch(dt) {
        if (menu.sw) { menu.gait = Math.max(0, menu.gait - dt * 4); return; }
        const was = menu.lift;
        menu.lift = menu.march ? Math.min(MARCH_MAX, menu.lift + MARCH_UP * dt)
                               : Math.max(0, menu.lift - MARCH_BACK * dt);
        // He is wider than the gaps between the buildings, so what counts as
        // reaching one is his middle arriving, not his shoulder brushing it.
        const c = menu.lift > 0 ? menuAt() : null;
        if (c) {
            // stopped on the step, however fast he was walking at it: padY()
            // reads menu.lift, so backing the overshoot out of it puts his
            // leading edge exactly on the door
            const over = (c.y + c.h / 2) - (padY() - padH() / 2);
            if (over > 0) menu.lift -= over;
            if (menu.into && menu.into.card !== c) menu.into = null;
            if (!menu.into) menu.into = { card: c, t: 0 };
            if (menu.march && (menu.into.t += dt) >= DOOR_HOLD) { menu.into = null; menuEnter(c.level); return; }
            if (!menu.march) menu.into = null;
        } else menu.into = null;
        // the walk itself: a pace only runs while he is covering ground
        const moving = Math.abs(menu.lift - was) > 0.01 || (menu.march && menu.into);
        menu.gait = moving ? Math.min(1, menu.gait + dt * 5) : Math.max(0, menu.gait - dt * 5);
        if (menu.gait > 0) menu.walk += dt;
    }

    // the building his middle has reached, if any
    function menuAt() {
        const x = paddle.x, y = padY() - padH() / 2;
        for (const c of menu.cards) {
            if (x < c.x - c.w / 2 || x > c.x + c.w / 2) continue;
            if (y > c.y + c.h / 2 || y < c.y - c.h / 2) continue;
            return c;
        }
        return null;
    }

    // his walk, read by drawPaddle: a bob in jig units and a roll in radians.
    // The two halves of THE PAIR are half a pace apart, so they take turns.
    function menuStep(i) {
        if (!menuUp() || menu.gait <= 0) return 0;
        return Math.sin(menu.walk * WALK_HZ * Math.PI * 2 + i * Math.PI) * WALK_BOB * menu.gait;
    }
    function menuRock(i) {
        if (!menuUp() || menu.gait <= 0) return 0;
        return Math.cos(menu.walk * WALK_HZ * Math.PI * 2 + i * Math.PI) * WALK_ROCK * menu.gait;
    }

    // Into a level. There are no levels yet, so the prototype hands you that
    // level's boss and remembers what you went in with, which is enough for the
    // hub to tell a clean run from a costly one.
    function menuEnter(level) {
        menuLoad();
        if (level.n === 5 && !menuOpened()) {
            const short = MENU_LEVELS.length - menuProgress().keys.length;
            menuSay('THE CASTLE WANTS ' + short + (short === 1 ? ' MORE KEY' : ' MORE KEYS'));
            menu.march = false;             // the door is shut: he stops there
            return;
        }
        const boss = menuBossFor(level.n);
        if (!boss) { menuSay(level.name + ' · no boss is set to this level'); return; }
        menu.run = { n: level.n, lost: 0, out: 0 };
        menu.sel = level.n;
        menu.march = false;
        LAB.mini = null;
        setHint(HINT_PLAY);
        LAB.fight(boss);
    }

    // A head went off the bottom. True means it cost nothing: there is nothing
    // to lose in the hub. In a level it is counted here rather than read off
    // `lives`, since the lab's endless lives would make every run a clean one.
    function menuLost() {
        if (menuUp()) return true;
        if (menu && menu.run) menu.run.lost++;
        return false;
    }

    // Runs every frame, hub or no hub -- it is what brings you back out of a
    // level and hands you what you earned. The wait is the takeover: he comes
    // apart and your brandon rises, and only then does the hub come back.
    const M_OUT = 2.6;
    function menuWatch(dt) {
        if (!menu || !menu.run) return;
        const won = phase === 'ascend' || phase === 'cleared';
        // and the other way it can end: the heads ran out, and the hub takes
        // you back with nothing. Whether a lost level costs you the whole run
        // is a question for the game, not for this.
        if (!won && phase !== 'over') return;
        if ((menu.run.out += dt) < M_OUT) return;
        const run = menu.run;
        menu.run = null;
        if (won) menuBeat(run.lost === 0, run.n);
        menuOpen();
        if (!won) menuSay(menuName(run.n) + ' · NOT THIS TIME');
    }

    // a level finished: the key always, the paddle only if it cost you nothing
    function menuBeat(clean, n) {
        menuLoad();
        const which = n || menu.sel || 1;
        const level = MENU_ALL.find(l => l.n === which);
        if (!level) return false;
        const first = !menu.keys[level.n];
        menu.keys[level.n] = true;
        // still kept, though the hub no longer shows it: the boards live
        // somewhere else
        menu.best[level.n] = Math.max(menu.best[level.n] || 0, score || 0);
        let got = level.name + (first ? ' · A KEY' : ' · DONE AGAIN');
        if (clean && !menu.pads[level.pad]) {
            menu.pads[level.pad] = true;
            got += ' AND ' + (LAB_PAD[level.pad] ? LAB_PAD[level.pad].name : level.pad.toUpperCase());
        } else if (!clean && !menu.pads[level.pad]) {
            got += ' · the paddle stays locked';
        }
        if (!menu.pads[MENU_SOUVENIR]) {
            menu.pads[MENU_SOUVENIR] = true;
            got += ' · AND ' + LAB_PAD[MENU_SOUVENIR].name;
        }
        menuSave();
        menuSay(got);
        return true;
    }

    // back to the hub: an empty field with the town on it
    function menuOpen() {
        menuLoad();
        menu.run = null;
        LAB.boss = null;
        LAB.mini = 'menu';
        LAB.stageAt(0, true);
        setHint(M_HINT);
    }

    function menuUpdate(dt) {
        if (!menu) return;
        if (menu.sayT > 0) menu.sayT = Math.max(0, menu.sayT - dt);
        menuSwapStep(dt);
        menuMarch(dt);
    }

    // ---- the gates: changing paddle by leaning on a wall ------------------------------
    // No rack and nothing to click: lean him on a gate and after SWAP_HOLD he
    // walks off through it, and the next one you own walks back on. The left
    // gate goes down the rack, the right goes up it, and both wrap, so
    // everything you own is reachable from either wall. Only what you have
    // earned is in the walk, and the gate says whose it is whether you are
    // standing on it or not.
    //
    // The hold is what keeps it from firing every time a walk ends in a corner.
    // Leaning while walking up the town does nothing: the gates are at home.
    const SWAP_HOLD = 0.85;          // pinned against the wall before he goes
    const SWAP_OUT = 0.26;           // him walking off
    const SWAP_IN = 0.34;            // the next one arriving
    const SWAP_PEEK = 52;            // how far in the next one noses while you hold
    const SWAP_CLEAR = 12;           // and how far past the wall they go

    function menuNextPad(side) {
        const owned = MENU_PADS.filter(k => menu.pads[k]);
        if (owned.length < 2) return null;
        const i = owned.indexOf(LAB.pad);
        return owned[((i < 0 ? 0 : i) + side + owned.length) % owned.length];
    }

    function menuSwapStep(dt) {
        const hs = halfSpan();
        if (menu.sw) {
            const s = menu.sw;
            s.t += dt;
            const off = s.side < 0 ? -hs - SWAP_CLEAR : LW + hs + SWAP_CLEAR;
            if (s.out) {
                const k = Math.min(1, s.t / SWAP_OUT);
                paddle.x = s.from + (off - s.from) * k * k;
                if (k >= 1) { LAB.usePad(s.to); s.out = false; s.t = 0; }
            } else {
                const k = Math.min(1, s.t / SWAP_IN);
                // he arrives where your hand is, not where the last one left:
                // the paddle is never allowed to end up somewhere you did not
                // put it
                const to = Math.max(halfSpan(), Math.min(LW - halfSpan(), paddle.tx));
                paddle.x = off + (to - off) * (1 - (1 - k) * (1 - k));
                if (k >= 1) { menu.sw = null; menu.hold = 0; }
            }
            return;
        }
        // paddle.tx is the hand; paddle.x is where he got to. The hand is what
        // decides you are leaning on the wall.
        const side = paddle.tx <= hs + 1 ? -1 : paddle.tx >= LW - hs - 1 ? 1 : 0;
        if (side !== menu.side) { menu.side = side; menu.hold = 0; }
        if (!side || menu.lift > 1 || !menuNextPad(side)) { menu.hold = 0; return; }
        if ((menu.hold += dt) < SWAP_HOLD) return;
        menu.sw = { side, to: menuNextPad(side), from: paddle.x, t: 0, out: true };
        menu.hold = 0;
    }

    // The next one, nosing in off the wall while you lean. Drawn over the one
    // you are holding rather than under it -- under it is exactly where the
    // paddle already is, so nothing of him would show -- and faded, because he
    // has not arrived yet.
    function menuPadPeek() {
        if (!menu.side || menu.sw || menu.lift > 1) return;
        const to = menuNextPad(menu.side);
        if (!to) return;
        const k = Math.min(1, menu.hold / SWAP_HOLD);
        const w = padW();
        labPadIcon(to, menu.side < 0 ? -w / 2 + SWAP_PEEK * k : LW + w / 2 - SWAP_PEEK * k,
                   padY(), w, false, 0.25 + 0.45 * k);
    }

    // ---- the picture ----------------------------------------------------------------
    function menuPanel(x, y, w, h, on, ink) {
        ctx.fillStyle = 'rgba(0,0,0,0.82)';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 8);
        ctx.fill();
        ctx.strokeStyle = on ? (ink || '#c9a94e') : '#2e2a24';
        ctx.lineWidth = on ? 2 : 1;
        ctx.stroke();
    }

    // A key, drawn as the only thing this game has: his head, flat, in the
    // colour of the level that gives it -- or the space one has not filled yet.
    function menuKey(x, y, r, got, ink) {
        const rx = r, ry = r * (BALL_RY / BALL_RX);
        if (got) {
            const sp = headSprite2('flat', ink);
            if (sp) ctx.drawImage(sp, x - rx, y - ry, rx * 2, ry * 2);
            return;
        }
        ctx.strokeStyle = '#4a453d';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
    }

    // What makes a building that level's: a roofline over the box it is drawn
    // on. All five are a few straight lines -- the town is meant to read at a
    // glance from the other end of the field, not to be looked at closely.
    const ROOF_H = 22;
    function menuCap(c, ink) {
        const x = c.x - c.w / 2, y = c.y - c.h / 2, w = c.w;
        const top = y - ROOF_H;
        ctx.fillStyle = ink;
        ctx.beginPath();
        switch (c.level.cap) {
            case 'gable':           // a barn
                ctx.moveTo(x, y);
                ctx.lineTo(c.x, top);
                ctx.lineTo(x + w, y);
                break;
            case 'broken':          // what is left standing
                ctx.moveTo(x, y);
                ctx.lineTo(x, top + 4);
                ctx.lineTo(x + w * 0.22, top + 10);
                ctx.lineTo(x + w * 0.34, y - 4);
                ctx.lineTo(x + w * 0.56, top + 14);
                ctx.lineTo(x + w * 0.72, y - 2);
                ctx.lineTo(x + w * 0.84, top + 7);
                ctx.lineTo(x + w, top + 16);
                ctx.lineTo(x + w, y);
                break;
            case 'skyline':         // three roofs, none of them the same
                ctx.moveTo(x, y);
                ctx.lineTo(x, y - 10);
                ctx.lineTo(x + w * 0.3, y - 10);
                ctx.lineTo(x + w * 0.3, top);
                ctx.lineTo(x + w * 0.58, top);
                ctx.lineTo(x + w * 0.58, y - 14);
                ctx.lineTo(x + w * 0.78, y - 14);
                ctx.lineTo(x + w * 0.78, top + 6);
                ctx.lineTo(x + w, top + 6);
                ctx.lineTo(x + w, y);
                break;
            case 'cone':            // a cone with the vent open at the top
                ctx.moveTo(x + w * 0.06, y);
                ctx.lineTo(x + w * 0.36, top);
                ctx.lineTo(x + w * 0.44, top + 5);
                ctx.lineTo(x + w * 0.56, top + 5);
                ctx.lineTo(x + w * 0.64, top);
                ctx.lineTo(x + w * 0.94, y);
                break;
            default:                // crenellations
                for (let i = 0; i < 5; i++) {
                    const bw = w / 9;
                    ctx.rect(x + w * 0.06 + i * bw * 1.75, top + 6, bw, ROOF_H - 6);
                }
                ctx.rect(x, y - 8, w, 8);
        }
        ctx.fill();
    }

    // drawn last of all, so it covers the score and the READY band: in the hub
    // there is no score and nothing to be ready for
    function labDrawTop() {
        if (!menuUp()) return;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, LW, M_TOP);
        text('FOUR KEYS OPEN THE CASTLE', LW / 2, 34, 24, '#f2efe9', 'center');
        text('one · two · three · four, in any order — and finish one without losing a head to keep its paddle',
             LW / 2, 58, 12, '#9a958c', 'center');

        for (const c of menu.cards) menuDrawLevel(c);
        menuDrawGate(-1);
        menuDrawGate(1);
        menuPadPeek();
        menuDrawLine();
    }

    function menuDrawLevel(c) {
        const l = c.level;
        const shut = l.n === 5 && !menuOpened();
        const x = c.x - c.w / 2, y = c.y - c.h / 2;
        // lit while he is standing in its lane, walking or not, so a walk is
        // aimed before it is started
        const aimed = paddle.x >= x && paddle.x <= x + c.w;
        const ink = shut ? '#4a453d' : l.ink;
        menuCap(c, aimed ? ink : shut ? '#241f1b' : '#2e2a24');
        menuPanel(x, y, c.w, c.h, aimed, ink);
        // stood in the doorway: the level fills up under him, and going in is
        // what happens when it is full
        if (menu.into && menu.into.card === c) {
            const k = Math.min(1, menu.into.t / DOOR_HOLD);
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = ink;
            ctx.fillRect(x + 1, y + c.h * (1 - k) - 1, c.w - 2, c.h * k);
            ctx.globalAlpha = 1;
        }
        // Its name and what it has given you, and no number on it: the town is
        // walked in whatever order you like, so numbering the buildings only
        // suggested an order that is not there. Laid out in shares of the card
        // rather than in pixels, since the five are not the same size.
        const lit = menu.keys[l.n] ? ink : shut ? '#4a453d' : '#8d877d';
        const big = l.n === 5;
        text(l.name, c.x, y + c.h * 0.4, big ? 19 : 20, lit, 'center');
        // the last one keeps the four slots on it: what it is waiting for is the
        // only thing about it worth saying
        if (big) MENU_LEVELS.forEach((o, i) => menuKey(c.x - 42 + i * 28, y + c.h * 0.72, 8, !!menu.keys[o.n], o.ink));
        else menuKey(c.x, y + c.h * 0.72, 12, !!menu.keys[l.n], l.ink);
    }

    // A gate on each wall, standing where he stands, naming the paddle it leads
    // to. The name is stacked a letter at a time: a 24px post is too narrow to
    // write across and turning the canvas to write up it is more machinery than
    // six letters are worth.
    const M_GATE = { w: 24, y: 470, h: 118 };
    function menuDrawGate(side) {
        const x = side < 0 ? 0 : LW - M_GATE.w;
        const to = menuNextPad(side);
        const p = to && LAB_PAD[to];
        const on = menu.side === side && !menu.sw && menu.lift <= 1 && !!p;
        const ink = (p && (p.ink || p.rim)) || '#4a453d';
        ctx.fillStyle = 'rgba(0,0,0,0.86)';
        ctx.fillRect(x, M_GATE.y, M_GATE.w, M_GATE.h);
        // the lean, filling the post from the floor up
        const k = on ? Math.min(1, menu.hold / SWAP_HOLD) : 0;
        if (k > 0) {
            ctx.globalAlpha = 0.45;
            ctx.fillStyle = ink;
            ctx.fillRect(x, M_GATE.y + M_GATE.h * (1 - k), M_GATE.w, M_GATE.h * k);
            ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = on ? ink : '#2e2a24';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, M_GATE.y + 0.5, M_GATE.w - 1, M_GATE.h - 1);
        text(side < 0 ? '◀' : '▶', x + M_GATE.w / 2, M_GATE.y + 16, 12,
             on ? '#f2efe9' : '#6d685f', 'center');
        if (!p) return;
        const name = p.name.replace(/ /g, '');
        for (let i = 0; i < name.length; i++) {
            text(name[i], x + M_GATE.w / 2, M_GATE.y + 34 + i * 11, 10,
                 on ? '#f2efe9' : '#6d685f', 'center');
        }
    }

    // one line under the town, and the gate you are leaning on gets it first
    function menuDrawLine() {
        if (menu.sw) return;
        if (menu.side && menu.lift <= 1) {
            const to = menuNextPad(menu.side);
            text(to && LAB_PAD[to] ? 'lean to take ' + LAB_PAD[to].name : 'nothing else to lean for',
                 LW / 2, M_SAY_Y, 12, '#6d685f', 'center');
            return;
        }
        if (menu.sayT > 0) {
            ctx.globalAlpha = Math.min(1, menu.sayT / 0.4);
            text(menu.say, LW / 2, M_SAY_Y, 16, '#c9a94e', 'center');
            ctx.globalAlpha = 1;
            return;
        }
        // and it goes as he sets off: it is what to do, not what is happening,
        // and he walks straight through where it sits
        ctx.globalAlpha = Math.max(0, 1 - menu.lift / 70);
        text('hold to walk him forward · into a building to go in · lean on a gate to change paddle',
             LW / 2, M_SAY_Y, 12, '#6d685f', 'center');
        ctx.globalAlpha = 1;
    }

    // ---- holding, which is the whole of the input ------------------------------------
    // The game's own tap serves a ball; there is no ball here, so the hub takes
    // the press for itself (see the action() hook) and only watches whether it
    // is still down.
    const menuHeld = down => { if (menu && (!down || menuUp())) menu.march = down; };
    addEventListener('pointerdown', e => {
        if (e.target && e.target.closest && e.target.closest('#lab')) return;
        menuHeld(true);
    }, true);
    addEventListener('pointerup', () => menuHeld(false), true);
    addEventListener('pointercancel', () => menuHeld(false), true);
    addEventListener('blur', () => menuHeld(false));
    addEventListener('keydown', e => {
        if (e.code !== 'Space' || !menuUp()) return;
        e.preventDefault();
        menuHeld(true);
    }, true);
    addEventListener('keyup', e => { if (e.code === 'Space') menuHeld(false); }, true);