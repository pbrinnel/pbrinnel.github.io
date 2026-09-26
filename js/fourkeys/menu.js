'use strict';

    // ---- THE MENU ------------------------------------------------------------------
    // brandon2's whole shape on one screen, and the only way round it is the
    // game itself. You are the paddle: slide him along the bottom, hold to walk
    // him up the town, and walk into a building to go into that level. Nothing
    // here is clicked at, and there is no ball -- he carries his head with him.
    //
    //   four levels, in any order, and each one you finish gives a key
    //   four keys open the CASTLE
    //   finish a level without using a continue and you keep the paddle it guarded
    //   win any level at all and CLASSIC, the first game's paddle, is yours
    //   the first win on each level plays its memory, kept in MEMORIES to watch again
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
        { n: 1, name: 'FARM', ink: '#7fa85a', cap: 'gable', pad: 'gilt', mem: 'exhortation' },
        { n: 2, name: 'RUINS', ink: '#b0a894', cap: 'broken', pad: 'statue', mem: 'salvation' },
        { n: 3, name: 'CITY', ink: '#6f9bc4', cap: 'skyline', pad: 'frost', mem: 'consolidation' },
        { n: 4, name: 'VOLCANO', ink: '#d2622f', cap: 'cone', pad: 'ember' }
    ];
    const MENU_LAST = { n: 5, name: 'CASTLE', ink: '#9a7fc9', cap: 'crown', pad: 'pair', mem: 'fall' };
    // `mem` is the memory a level's first win plays (MENU_MEMS); a level
    // without one plays none.
    //
    // Every memory, by the year it is set in: the game starts in year 0. Each
    // is named on the timeline by its year and its title, in its own colour.
    // Year 0 itself -- the town, which is where it takes you back to
    // (menuReturn) -- is always there; the rest belong to a level, or to
    // nothing yet.
    const MENU_MEMS = [
        { id: 'exhortation', year: -2784, title: 'Exhortation', ink: '#7fa85a' },
        { id: 'salvation', year: -1701, title: 'Salvation', ink: '#b0a894' },
        { id: 'cycle', year: -1342, title: 'Cycle', ink: '#d2622f' },
        { id: 'counsel', year: -126, title: 'Counsel', ink: '#c9a94e' },
        { id: 'fall', year: -99, title: 'Fall', ink: '#9a7fc9' },
        { id: 'consolidation', year: -92, title: 'Consolidation', ink: '#6f9bc4' },
        { id: 'now', year: 0, title: 'Reprisal', ink: '#f2efe9', always: true },
    ];
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
                for (const l of MENU_ALL) menu.seen[l.n] = true;
                for (const m of MENU_MEMS) menu.mems[m.id] = true;
                menuSave();
                menuSay('EVERYTHING OPEN');
                return true;
            },
            wipe() {
                menuLoad();
                menu.keys = {}; menu.pads = { standard: true }; menu.best = {}; menu.seen = {}; menu.mems = {};
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
                 best: (saved && saved.best) || {}, seen: (saved && saved.seen) || {},
                 mems: (saved && saved.mems) || {},
                 dusting: null, sel: 1, say: null, sayT: 0,
                 cards: [], run: null, side: 0, hold: 0, sw: null,
                 march: false, lift: 0, into: null, walk: 0, gait: 0, arriveT: -1,
                 going: null, screen: null, press: null,
                 shows: [], showT: 0 };
        return menu;
    }

    function menuSave() {
        try {
            localStorage.setItem(MENU_KEY, JSON.stringify({ keys: menu.keys, pads: menu.pads, best: menu.best,
                                                            seen: menu.seen, mems: menu.mems }));
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
    // file's. These five are the whole of the way in, so nothing else has to
    // know how progress is stored or that it is saved at all.
    function menuLevels() { menuLoad(); return MENU_ALL; }
    function menuMemories() { menuLoad(); return MENU_MEMS; }
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
    // all the way up the middle to the CASTLE, and the right is the mirror --
    // except hard against either wall, which is the lane of a corner (M_SIDES).
    //
    // The five stand 26px apart all the way across, between the two gates at
    // 0-24 and 776-800. Evenly spaced is the whole of the arrangement: the
    // CASTLE used to sit in a 6px slot between its neighbours, which read as
    // the middle of the town being crowded rather than as the far end of it.
    // Buying that room cost every building some width, and the far pair lost
    // most -- which is what being further away should look like anyway.
    //
    // Top to bottom the town has the whole field: the CASTLE's crenellations
    // and the corners sit a margin under the top edge, the far pair halfway
    // down, the near pair just above the gates. The near pair are the same
    // 0.6 s walk they always were; the far pair and the CASTLE are a little
    // further off than they were under the old title band, 2.0 s and 3.2 s.
    // the one line of patter goes in the gap between the far row and the near
    // one -- the floor is the gates' now, and the near pair reach down to 452
    const M_SAY_Y = 306;
    const M_TOWN = {
        1: { x: 93, y: 392, w: 136, h: 120 },
        2: { x: 246, y: 228, w: 118, h: 112 },
        3: { x: 554, y: 228, w: 118, h: 112 },
        4: { x: 707, y: 392, w: 136, h: 120 },
        5: { x: 400, y: 92, w: 138, h: 110 }
    };

    // More that are not levels. MEMORIES and the boards take the top corners,
    // and a corner's lane is the wall itself: walk up hard against the left or
    // right edge and that is where you arrive, past the FARM or the VOLCANO
    // rather than into it. MEMORIES is always there: the opening is in it from
    // the start. RESET is the least of them, a small sign up and to the
    // right of MEMORIES, and its lane is the gap between the FARM and the
    // RUINS -- narrower than the sign, so nobody wanders into it. Going in
    // only asks the question (menuShow); erasing is a button in there.
    const M_SIDES = [
        { key: 'memories', side: -1, lines: ['MEMORIES'], ink: '#d9a5b3',
          at: { x: 70, y: 80, w: 116, h: 90 } },
        { key: 'reset', lines: ['RESET'], ink: '#c0594a', small: true,
          at: { x: 174, y: 44, w: 60, h: 28, lane: [162, 186] } },
        { key: 'board', side: 1, lines: ['LEADER', 'BOARD'], ink: '#c9a94e',
          at: { x: 730, y: 80, w: 116, h: 90 } }
    ];
    const M_WALL = 3;                // px off his clamp that still counts as against the wall

    function menuBuild() {
        menuLoad();
        menu.sw = null;
        menu.side = 0;
        menu.hold = 0;
        menu.march = false;
        menu.lift = 0;
        menu.into = null;
        menu.going = null;
        menu.screen = null;
        menu.gait = 0;
        menu.cards = MENU_ALL.map(l => Object.assign({ level: l }, M_TOWN[l.n]))
            .concat(M_SIDES.map(s => Object.assign({ level: s }, s.at)));
    }

    // which wall he is walking up against, if either
    function menuWall() {
        const hs = halfSpan();
        return paddle.x <= hs + M_WALL ? -1 : paddle.x >= LW - hs - M_WALL ? 1 : 0;
    }

    // whether he is lined up with this one: a corner's lane is its wall, and
    // against a wall only the corner is lined up. A lane is the width of what
    // is drawn unless the card says otherwise.
    function menuLane(c) {
        const wall = menuWall();
        if (c.level.side) return wall === c.level.side;
        const [l, r] = c.lane || [c.x - c.w / 2, c.x + c.w / 2];
        return !wall && paddle.x >= l && paddle.x <= r;
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
    const MARCH_MAX = 470;           // past the last door, RESET's, for the empty lanes
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
        if (c && c.level.n && !menu.seen[c.level.n]) menuDust(c.level.n);
        if (c) {
            // stopped on the step, however fast he was walking at it: padY()
            // reads menu.lift, so backing the overshoot out of it puts his
            // leading edge exactly on the door
            const over = (c.y + c.h / 2) - (padY() - padH() / 2);
            if (over > 0) menu.lift -= over;
            if (menu.into && menu.into.card !== c) menu.into = null;
            if (!menu.into) menu.into = { card: c, t: 0 };
            if (menu.march && (menu.into.t += dt) >= DOOR_HOLD) {
                menu.into = null;
                menuGo(c);
                return;
            }
            if (!menu.march) menu.into = null;
        } else menu.into = null;
        // the walk itself: a pace only runs while he is covering ground
        const moving = Math.abs(menu.lift - was) > 0.01 || (menu.march && menu.into);
        menu.gait = moving ? Math.min(1, menu.gait + dt * 5) : Math.max(0, menu.gait - dt * 5);
        if (menu.gait > 0) menu.walk += dt;
    }

    // the building his middle has reached, if any
    function menuAt() {
        const y = padY() - padH() / 2;
        for (const c of menu.cards) {
            if (!menuLane(c)) continue;
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

    // ---- going in ------------------------------------------------------------------------
    // The door hold is done: a doorway opens at the foot of the building and
    // he goes through it, drifting to its middle and shrinking to its width,
    // fading as he goes. The wall hides whatever of him is not in the doorway
    // yet. Only then does the level, or the room, take over. A door that
    // will not open (the boards, a shut CASTLE) just says why, and he stays out.
    const GO_SECS = 0.7;
    const GO_FADE = 0.45;            // the share of the way in he starts fading at
    const DOOR_W = 0.3;              // the doorway, as shares of the building
    const DOOR_H = 0.36;             // ...short enough to clear a corner's name

    function menuCanEnter(l) {
        if (l.key) return l.key !== 'board';
        if (l.n === 5 && !menuOpened()) return false;
        return !!menuBossFor(l.n);
    }

    function menuGo(c) {
        menu.march = false;
        if (!menuCanEnter(c.level)) { menuEnter(c.level); return; }
        menu.going = { card: c, t: 0, x: paddle.x, y: padY() };
    }

    function menuGoStep(dt) {
        const g = menu.going;
        if ((g.t += dt) < GO_SECS) return;
        menu.going = null;
        const l = g.card.level;
        if (l.key === 'reset' || l.key === 'memories') { menuShow(l.key); menu.screen.from = g.x; }
        else menuEnter(l);
    }

    // engine.js asks, and leaves him undrawn while menuDrawGoing draws him
    function menuPadHidden() { return !!(menu && menu.going && menuUp()); }

    function menuDoor(c) {
        const w = c.w * DOOR_W, h = c.h * DOOR_H;
        return { x: c.x - w / 2, y: c.y + c.h / 2 - h, w, h };
    }

    function menuDrawGoing() {
        const g = menu.going;
        if (!g) return;
        const c = g.card, d = menuDoor(c);
        const k = Math.min(1, g.t / GO_SECS), e = k * k * (3 - 2 * k);
        const x = c.x - c.w / 2, y = c.y - c.h / 2;
        // the doorway, opening from the floor up over the first part of it
        const o = Math.min(1, k * 3);
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = c.level.ink;
        ctx.fillRect(d.x, d.y + d.h * (1 - o), d.w, d.h * o);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = c.level.ink;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(d.x, d.y + d.h * (1 - o), d.w, d.h * o);
        // him, cut to everything but the wall: outside the building, or in
        // the doorway
        const w0 = padW();
        const s = 1 + (d.w / w0 - 1) * e;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, LW, LH);
        ctx.rect(x, y, c.w, c.h);
        ctx.rect(d.x, d.y, d.w, d.h);
        ctx.clip('evenodd');
        labPadIcon(LAB.pad, g.x + (c.x - g.x) * e, g.y + (d.y + d.h / 2 - g.y) * e, w0 * s, false,
                   1 - Math.max(0, (k - GO_FADE) / (1 - GO_FADE)));
        ctx.restore();
    }

    // Into a level. There are no levels yet, so the prototype hands you that
    // level's boss and remembers which one, and menuWatch keeps an eye on
    // whether you had to buy it back.
    function menuEnter(level) {
        menuLoad();
        if (level.key === 'board') {
            menuSay('LEADERBOARD · COMING SOON');
            menu.march = false;
            return;
        }
        if (level.n === 5 && !menuOpened()) {
            const short = MENU_LEVELS.length - menuProgress().keys.length;
            menuSay('THE CASTLE WANTS ' + short + (short === 1 ? ' MORE KEY' : ' MORE KEYS'));
            menu.march = false;             // the door is shut: he stops there
            return;
        }
        const boss = menuBossFor(level.n);
        if (!boss) { menuSay(level.name + ' · no boss is set to this level'); return; }
        menu.arriveT = -1;          // walked in before the town finished arriving
        menu.run = { n: level.n, over: false, cont: false, out: 0 };
        menu.sel = level.n;
        menu.march = false;
        LAB.mini = null;
        setHint(HINT_PLAY);
        LAB.fight(boss);
    }

    // A head went off the bottom. True means it cost nothing: there is nothing
    // to lose in the hub.
    function menuLost() { return menuUp(); }

    // END RUN in a level, or the CONTINUE clock running out: back to the town
    // with nothing, rather than on to the initials. True means the town took it.
    function menuQuit() {
        if (!menu || !menu.run) return false;
        const n = menu.run.n;
        menuOpen();
        menuSay(menuName(n) + ' · NOT THIS TIME');
        return true;
    }

    // Runs every frame, hub or no hub -- it is what brings you back out of a
    // level and hands you what you earned. The wait is the takeover: he comes
    // apart and your brandon rises, and only then does the hub come back.
    const M_OUT = 2.6;
    function menuWatch(dt) {
        if (!menu || !menu.run) return;
        const run = menu.run;
        // The heads running out is the CONTINUE screen, and the level waits on
        // it. Coming off it straight back into play is a continue. Coming off
        // it anywhere else is END RUN on an engine that does not ask menuQuit
        // first (the lab's), and it goes the same way.
        if (phase === 'over') { run.over = true; return; }
        if (run.over) {
            run.over = false;
            if (phase === 'ready' || phase === 'play') run.cont = true;
            else { menuQuit(); return; }
        }
        if (phase !== 'ascend' && phase !== 'cleared') return;
        if ((run.out += dt) < M_OUT) return;
        menu.run = null;
        menuBeat(!run.cont, run.n);
        menuOpen();
    }

    // a level finished: the key always, the paddle only if you never continued
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
        // its memory plays the first time only, before any paddle is shown:
        // after that it is in MEMORIES
        if (level.mem && !menu.mems[level.mem]) {
            menu.mems[level.mem] = true;
            menu.shows.push({ mem: level.mem });
        }
        if (clean && !menu.pads[level.pad]) {
            menu.pads[level.pad] = true;
            menu.shows.push({ pad: level.pad });
            got += ' AND ' + (LAB_PAD[level.pad] ? LAB_PAD[level.pad].name : level.pad.toUpperCase());
        } else if (!clean && !menu.pads[level.pad]) {
            got += ' · the paddle stays locked';
        }
        if (!menu.pads[MENU_SOUVENIR]) {
            menu.pads[MENU_SOUVENIR] = true;
            menu.shows.push({ pad: MENU_SOUVENIR });
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
        // a memory that has finished goes on by itself (see memoryDone)
        const over = (n, t) => typeof memoryDone === 'function' && memoryDone(n, t);
        if (menuUnlockUp()) {
            menu.showT += dt;
            menu.march = false;
            const m = menu.shows[0].mem;
            if (m && over(m, menu.showT)) { menu.shows.shift(); menu.showT = 0; }
            return;
        }
        if (menuScreenUp()) {
            menu.screen.t += dt;
            menu.march = false;
            if (menu.screen.kind === 'memory' && over(menu.screen.n, menu.screen.t)) menuShow('memories');
            return;
        }
        if (menu.going) { menuGoStep(dt); return; }
        menuDustStep(dt);
        if (menu.sayT > 0) menu.sayT = Math.max(0, menu.sayT - dt);
        menuSwapStep(dt);
        menuMarch(dt);
        if (menuArriving()) menuArriveStep(dt);
    }

    // ---- arriving -----------------------------------------------------------------------
    // Out of the opening cards, the town comes into view as if he were walking
    // into it: he paces on the spot, and every building grows out of a point
    // on the horizon (ARRIVE_AT) into its place. The near ones start smaller
    // and travel further than the far ones, which is what makes it read as
    // coming closer rather than as the picture zooming. He is yours from the
    // first frame of it: the town is where it will be, only not drawn there
    // yet, so a walk started now arrives at the building it is aimed at.
    const ARRIVE_SECS = 3;
    const ARRIVE_AT = { x: 400, y: 60 };
    const ARRIVE_FAR = 0.55;         // the size the CASTLE's row starts at...
    const ARRIVE_NEAR = 0.2;         // ...and the FARM's
    const ARRIVE_SETTLE = 0.4;       // the last of it, where his pace slows to a stop

    function menuArrive() { menuLoad(); menu.arriveT = 0; }
    // Year 0, from MEMORIES: back to the town the way the game first brings
    // you to it -- the buildings growing in from the horizon while he stands
    // at home in the middle of the bottom, not up the town where the walk to
    // MEMORIES left him. The town is as you left it, dust and all.
    function menuReturn() {
        menu.screen = null;
        setHint(M_HINT);
        paddle.x = paddle.tx = LW / 2;
        menu.lift = 0;
        menu.march = false;
        menu.into = null;
        menu.arriveT = 0;
    }
    function menuArriving() { return menu.arriveT >= 0; }

    // his pace on the spot, on top of whatever walking you have him doing
    function menuArriveStep(dt) {
        menu.arriveT += dt;
        const left = ARRIVE_SECS - menu.arriveT;
        const pace = Math.max(0, Math.min(1, left / ARRIVE_SETTLE));
        if (pace > menu.gait) {
            if (menu.gait <= 0) menu.walk += dt;     // menuMarch only paces a moving walk
            menu.gait = pace;
        }
        if (left <= 0) menu.arriveT = -1;
    }

    // how far along the arrival is, eased so it slows into place; 1 once it is over
    function menuArriveK() {
        if (!menuArriving()) return 1;
        const t = Math.min(1, menu.arriveT / ARRIVE_SECS);
        return 1 - Math.pow(1 - t, 3);
    }

    // draw one building as it would be `k` of the way in
    function menuArriveCard(c, k, draw) {
        if (k >= 1) { draw(); return; }
        const near = Math.max(0, Math.min(1, (c.y - M_TOWN[5].y) / (M_TOWN[1].y - M_TOWN[5].y)));
        const z = ARRIVE_FAR + (ARRIVE_NEAR - ARRIVE_FAR) * near;
        const s = z + (1 - z) * k;
        ctx.save();
        ctx.globalAlpha = Math.min(1, k * 2.5);
        ctx.translate(ARRIVE_AT.x, ARRIVE_AT.y);
        ctx.scale(s, s);
        ctx.translate(-ARRIVE_AT.x, -ARRIVE_AT.y);
        draw();
        ctx.restore();
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
        ctx.fillStyle = ink;
        ctx.beginPath();
        menuCapPath(c);
        ctx.fill();
    }

    // the roofline, added to whatever path is open -- menuCap fills it, and
    // the dust cuts itself to it together with the building under it
    function menuCapPath(c) {
        const x = c.x - c.w / 2, y = c.y - c.h / 2, w = c.w;
        const top = y - ROOF_H;
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
    }

    // Drawn last of all, over the READY band. The town says nothing about
    // itself -- no title, no rules, no instructions; the buildings and the
    // gates are the whole of it.
    function labDrawTop() {
        if (!menuUp()) return;
        if (menuUnlockDraw()) return;
        if (menuScreenDraw()) return;

        const k = menuArriveK();
        // the far ones first, so a near one growing past them is drawn over them
        for (const c of menu.cards.slice().sort((a, b) => a.y - b.y)) {
            menuArriveCard(c, k, () => menuDrawLevel(c));
        }
        menuDrawGoing();
        // the gates are at his feet, so they are simply there once the town is
        ctx.globalAlpha = k;
        menuDrawGate(-1);
        menuDrawGate(1);
        ctx.globalAlpha = 1;
        if (k < 1) return;
        menuPadPeek();
        menuDrawGateNote(-1);
        menuDrawGateNote(1);
        menuDrawLine();
    }

    // Not a level: no roof and no key, just a sign.
    function menuDrawSide(c) {
        const s = c.level;
        const x = c.x - c.w / 2, y = c.y - c.h / 2;
        const aimed = menuLane(c);
        menuPanel(x, y, c.w, c.h, aimed, s.ink);
        if (menu.into && menu.into.card === c) {
            const k = Math.min(1, menu.into.t / DOOR_HOLD);
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = s.ink;
            ctx.fillRect(x + 1, y + c.h * (1 - k) - 1, c.w - 2, c.h * k);
            ctx.globalAlpha = 1;
        }
        const ink = aimed ? s.ink : '#8d877d';
        if (s.small) { text(s.lines[0], c.x, c.y + 4, 11, ink, 'center'); return; }
        if (s.lines.length === 1) { text(s.lines[0], c.x, c.y + 6, 17, ink, 'center'); return; }
        text(s.lines[0], c.x, y + c.h * 0.44, 17, ink, 'center');
        text(s.lines[1], c.x, y + c.h * 0.72, 13, ink, 'center');
    }

    // ---- the dust -------------------------------------------------------------------
    // The five start out as old buildings nobody has been near: grey, soft at
    // the edges and flecked with dust. Walk up and touch one and the dust
    // dissolves off it, a fleck at a time over DUST_WIPE, and it stays clean
    // for good -- `seen` is saved with the keys and the paddles, and
    // forgotten with them. The softness is the building drawn several times
    // slightly out of place, not a canvas filter: Safari ignores ctx.filter,
    // and this is a phone game. The film and the flecks are cut to the
    // building's own outline, roof and all, so the dust is ON it.
    const DUST_WIPE = 0.8;           // seconds the dissolve takes
    const DUST_INK = '#5b564e';      // what every colour on it is under the dust
    const DUST_BLUR = 3.2;           // px each soft copy sits off true
    const DUST_SPECKS = 46;          // flecks on each
    const DUST_CELL = 5;             // px, the grain the dissolve goes in

    function menuDust(n) {
        menu.seen[n] = true;
        menuSave();
        menu.dusting = { n, t: 0 };
    }

    function menuDustStep(dt) {
        if (menu.dusting && (menu.dusting.t += dt) >= DUST_WIPE) menu.dusting = null;
    }

    function menuDrawLevel(c) {
        const l = c.level;
        if (l.key) { menuDrawSide(c); return; }
        const w = menu.dusting && menu.dusting.n === l.n ? menu.dusting : null;
        if (menu.seen[l.n] && !w) { menuDrawClean(c, false); return; }
        if (!w) { menuDrawDusty(c); return; }
        // Dissolving: the clean building under it, and the dust only in the
        // grains whose own moment has not come yet. Each grain's moment is a
        // hash of where it is, so the pattern holds still from frame to frame.
        const k = Math.min(1, w.t / DUST_WIPE);
        const pad = DUST_BLUR * 2 + 2;
        const x0 = c.x - c.w / 2 - pad, x1 = c.x + c.w / 2 + pad;
        const y0 = c.y - c.h / 2 - ROOF_H - pad, y1 = c.y + c.h / 2 + pad;
        menuDrawClean(c, false);
        ctx.save();
        ctx.beginPath();
        for (let gy = y0, j = 0; gy < y1; gy += DUST_CELL, j++) {
            for (let gx = x0, i = 0; gx < x1; gx += DUST_CELL, i++) {
                const h = Math.sin(i * 12.9898 + j * 78.233 + c.level.n * 37.719) * 43758.5453;
                if (h - Math.floor(h) > k) ctx.rect(gx, gy, DUST_CELL, DUST_CELL);
            }
        }
        ctx.clip();
        menuDrawDusty(c);
        ctx.restore();
    }

    function menuDrawDusty(c) {
        const a0 = ctx.globalAlpha;
        // eight soft copies round a circle, which is what makes it fuzzy
        // rather than doubled
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4;
            ctx.save();
            ctx.globalAlpha = a0 * 0.2;
            ctx.translate(Math.cos(a) * DUST_BLUR, Math.sin(a) * DUST_BLUR);
            menuDrawClean(c, true);
            ctx.restore();
        }
        // a film over it and the flecks, the same ones every frame, both cut
        // to the building's outline
        const x = c.x - c.w / 2, y = c.y - c.h / 2;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, c.w, c.h, 8);
        menuCapPath(c);
        ctx.clip();
        ctx.globalAlpha = a0 * 0.22;
        ctx.fillStyle = '#8a8378';
        ctx.fillRect(x, y - ROOF_H, c.w, c.h + ROOF_H);
        ctx.globalAlpha = a0 * 0.45;
        ctx.fillStyle = '#a39c90';
        let seed = c.level.n * 9301 + 49297;
        const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
        for (let i = 0; i < DUST_SPECKS; i++) {
            const s = 1 + rnd() * 2;
            ctx.fillRect(x + rnd() * c.w, y - ROOF_H + rnd() * (c.h + ROOF_H), s, s);
        }
        ctx.restore();
        ctx.globalAlpha = a0;
    }

    function menuDrawClean(c, dusty) {
        const l = c.level;
        const shut = l.n === 5 && !menuOpened();
        const x = c.x - c.w / 2, y = c.y - c.h / 2;
        // lit while he is standing in its lane, walking or not, so a walk is
        // aimed before it is started
        const aimed = menuLane(c);
        const ink = dusty ? DUST_INK : shut ? '#4a453d' : l.ink;
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
        const lit = dusty ? DUST_INK : menu.keys[l.n] ? ink : shut ? '#4a453d' : '#8d877d';
        const big = l.n === 5;
        text(l.name, c.x, y + c.h * 0.4, big ? 19 : 20, lit, 'center');
        // the last one keeps the four slots on it: what it is waiting for is the
        // only thing about it worth saying
        const keyInk = o => dusty ? DUST_INK : o.ink;
        if (big) MENU_LEVELS.forEach((o, i) => menuKey(c.x - 42 + i * 28, y + c.h * 0.72, 8, !!menu.keys[o.n], keyInk(o)));
        else menuKey(c.x, y + c.h * 0.72, 12, !!menu.keys[l.n], keyInk(l));
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
        // a space is a gap down the post, the height of half a letter, so a
        // name of two words still reads as two
        let y = M_GATE.y + 34;
        for (const ch of p.name) {
            if (ch === ' ') { y += 6; continue; }
            text(ch, x + M_GATE.w / 2, y, 10, on ? '#f2efe9' : '#6d685f', 'center');
            y += 11;
        }
    }

    // Beside each gate, what the paddle through it would change: his name and
    // the unlock screen's blurb, a bullet to each ' · ' part. It comes up as he
    // walks toward that wall, so the far gate never says anything and the
    // floor is empty while he is out in the middle.
    const GATE_NEAR = 240;           // px from the wall where it starts to show
    function menuDrawGateNote(side) {
        if (menu.sw || menu.lift > 1) return;
        const to = menuNextPad(side);
        const p = to && LAB_PAD[to];
        if (!p) return;
        const hs = halfSpan();
        const d = side < 0 ? paddle.x - hs : LW - hs - paddle.x;
        const a = Math.max(0, Math.min(1, 1 - d / GATE_NEAR));
        if (a <= 0) return;
        const x = side < 0 ? M_GATE.w + 10 : LW - M_GATE.w - 10;
        const align = side < 0 ? 'left' : 'right';
        ctx.globalAlpha = a * a;
        // packed into the strip between the near building and his head, which
        // at the wall is right under it
        text(p.name, x, M_GATE.y + 2, 13, p.ink || p.rim || '#f2efe9', align);
        (p.blurb ? p.blurb.split(' · ') : []).forEach((b, i) =>
            text('• ' + b, x, M_GATE.y + 17 + i * 13, 11, '#b8b2a8', align));
        ctx.globalAlpha = 1;
    }

    // one line under the town, and only when there is something to say: the
    // gate you are leaning on, or what just happened
    function menuDrawLine() {
        if (menu.sw || menu.going) return;
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
    }

    // ---- PADDLE UNLOCKED, and a memory ------------------------------------------------
    // What a win hands you gets the whole screen on the way back into the
    // town, one at a time, each held until you tap: the level's memory first,
    // the first time it is beaten, then every paddle earned -- his name, and
    // him, big, on a field of his own colour. Only a win shows them (menuBeat,
    // which the lab's "count it beaten" buttons also call); the debug menu's
    // toggles and "unlock everything" do not.
    const UNLOCK_WAIT = 0.6;         // seconds up before a tap takes it away
    const UNLOCK_IN = 0.45;          // him rising into place
    const UNLOCK_W = 500;            // how long he is drawn
    const UNLOCK_BACK = 0.22;        // his colour, this much of it over black, behind him

    function menuUnlockUp() { return !!(menu && menu.shows.length && menuUp()); }

    // a tap: true if it was the unlock screen's to take
    function menuUnlockNext() {
        if (!menuUnlockUp()) return false;
        const t = menu.shows[0].mem ? menuMemoryTap(menu.shows[0].mem, menu.showT)
                                    : menu.showT >= UNLOCK_WAIT ? -1 : menu.showT;
        if (t < 0) { menu.shows.shift(); menu.showT = 0; } else menu.showT = t;
        return true;
    }

    function menuUnlockDraw() {
        if (!menuUnlockUp()) return false;
        const show = menu.shows[0];
        if (show.mem) { menuMemoryCard(show.mem, menu.showT); return true; }
        const key = show.pad, p = LAB_PAD[key];
        const ink = (p && (p.ink || p.rim)) || '#8d877d';
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, LW, LH);
        ctx.globalAlpha = UNLOCK_BACK;
        ctx.fillStyle = ink;
        ctx.fillRect(0, 0, LW, LH);
        ctx.globalAlpha = 1;
        const k = Math.min(1, menu.showT / UNLOCK_IN), e = 1 - Math.pow(1 - k, 3);
        text('PADDLE UNLOCKED', LW / 2, 130, 34, '#f2efe9', 'center');
        labPadIcon(key, LW / 2, LH / 2 + 10 + (1 - e) * 40, UNLOCK_W, false, e);
        ctx.globalAlpha = e;
        text(p ? p.name : key.toUpperCase(), LW / 2, 440, 40, ink, 'center');
        if (p && p.blurb) text(p.blurb, LW / 2, 475, 15, '#c9c4ba', 'center');
        ctx.globalAlpha = 1;
        return true;
    }

    // A memory, which memory.js draws. The boss lab builds this file without
    // it, and gets the bare year instead.
    function menuMemoryCard(n, t) {
        if (typeof memoryDraw === 'function') { memoryDraw(n, t); return; }
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, LW, LH);
        ctx.globalAlpha = Math.min(1, t / UNLOCK_IN);
        text('YEAR ' + menuYear(menuTimeline().find(m => m.id === n).year), LW / 2, LH / 2 + 14, 44,
             '#f2efe9', 'center');
        ctx.globalAlpha = 1;
    }

    // Every memory, oldest first. Until how they are earned is decided,
    // every one is open (MENU_MEMS_OPEN); a win still plays its level's the
    // first time and records it.
    const MENU_MEMS_OPEN = true;
    function menuTimeline() {
        return MENU_MEMS.map(m => Object.assign({}, m, { got: m.always || MENU_MEMS_OPEN || !!menu.mems[m.id] }))
            .sort((a, b) => a.year - b.year);
    }
    const menuYear = y => (y < 0 ? '\u2212' + -y : '' + y);

    // What a tap does to a memory that has been up t seconds: the time to put
    // it at, or -1 to close it. A tap on its title card skips to what comes
    // after, and that then has to be up as long as anything else before a tap
    // takes it away, so the tap that skipped cannot close it too.
    function menuMemoryTap(n, t) {
        const card = typeof memoryCardSecs === 'function' ? memoryCardSecs(n) : 0;
        if (t < UNLOCK_WAIT) return t;
        if (t < card) return card;
        if (t < card + UNLOCK_WAIT) return t;
        return -1;
    }

    // ---- inside: RESET's question and the MEMORIES room ------------------------------
    // The two buildings you go into without leaving the town. Their choices
    // are picked the way the game-over screen's are: he is down at the bottom
    // with them in a row over him, the one he is under is lit, and a press
    // takes it -- a click, a tap or Space. That is the one way that works
    // everywhere: a mouse is locked to him in the town, so there is no cursor
    // to aim with, and a finger that taps a choice puts him under it anyway.
    // Erasing is its own deliberate press on a word that says so, never the
    // end of a hold that ran on a moment too long, and it is on the right,
    // away from the gap he walks up to get there, so he always arrives under
    // KEEP.
    const M_CHOICE_Y = 330;          // the row of choices
    const M_CHOICE_H = 84;

    function menuScreenUp() { return !!(menu && menu.screen && menuUp()); }
    function menuShow(kind, n) {
        // where he went in, kept from the room to a memory and back
        const from = menu.screen ? menu.screen.from : undefined;
        menu.screen = { kind, n, t: 0, from };
        menu.press = null;
        setHint(kind === 'memory' ? 'click/tap or space to go back'
                                  : 'move to choose · click/tap or space to pick');
    }
    // out the way he went in: the choosing moved him, and letting him walk
    // home down some other lane would drag him through whatever is in it
    function menuLeave() {
        if (menu.screen.from !== undefined) paddle.x = paddle.tx = menu.screen.from;
        menu.screen = null;
        setHint(M_HINT);
    }

    function menuErase() {
        LAB_MINI.menu.acts.wipe();
        clearBest();                        // everything means the best as well
        menuLeave();
        menuSay('SAVE DATA ERASED');
    }

    // What there is to pick on this screen, left to right. Spread over the
    // whole of where his middle can go, so every one of them is somewhere he
    // can stand.
    function menuChoices() {
        const sc = menu.screen;
        if (sc.kind === 'reset') {
            return [{ id: 'keep', label: 'KEEP', cx: 250, w: 200, ink: '#f2efe9', act: menuLeave },
                    { id: 'erase', label: 'ERASE', cx: 550, w: 200, ink: '#c0594a', act: menuErase }];
        }
        // the room: the timeline, oldest on the left, across the whole of
        // where he can stand. Its stops are evenly spaced, not to scale --
        // there are no years on it but the memories' own -- and a memory you
        // have not earned is a stop with no name. Under each is its title,
        // every other one a row lower so neighbours never share a line.
        // There is no way out but forward: year 0 is the town, so it is also
        // the way back to it, and says so under its title.
        const tl = menuTimeline();
        const hs = halfSpan(), step = (LW - hs * 2) / (tl.length - 1);
        return tl.map((m, i) => ({ id: 'mem' + m.id, stop: true, cx: hs + step * i, ink: m.ink,
                                   drop: i % 2 ? M_UNDER_DROP : 0,
                                   label: m.got ? menuYear(m.year) : '?',
                                   under: !m.got ? [] : m.id === 'now' ? [m.title, 'BACK'] : [m.title],
                                   act: !m.got ? null : m.id === 'now' ? menuReturn
                                                      : () => menuShow('memory', m.id) }));
    }

    // the one nearest him
    function menuChoiceAt(x) {
        let best = null;
        for (const c of menuChoices()) if (!best || Math.abs(c.cx - x) < Math.abs(best.cx - x)) best = c;
        return best;
    }

    // The timeline: one line, oldest at the left, running on past the last
    // stop to an arrowhead so it reads as time going somewhere. Each stop is
    // a dot with its year over it, and anything more it has to say under it;
    // the lit one is bigger and ringed.
    const M_TL_Y = 350;              // the line
    const M_STOP_R = 7;              // a stop's dot
    const M_UNDER = 32;              // baseline of what a stop says under itself, off the line
    const M_UNDER_STEP = 17;         // ...and each line after the first, further down
    const M_UNDER_DROP = 22;         // how much lower every other stop's lines start

    function menuDrawTimeline(stops) {
        const x0 = stops[0].cx - 30, x1 = stops[stops.length - 1].cx + 30;
        ctx.strokeStyle = '#4a453d';
        ctx.fillStyle = '#4a453d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0, M_TL_Y);
        ctx.lineTo(x1, M_TL_Y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x1 + 12, M_TL_Y);
        ctx.lineTo(x1, M_TL_Y - 6);
        ctx.lineTo(x1, M_TL_Y + 6);
        ctx.closePath();
        ctx.fill();
    }

    function menuDrawStop(c, on) {
        const r = on ? M_STOP_R * 1.6 : M_STOP_R;
        ctx.beginPath();
        ctx.arc(c.cx, M_TL_Y, r, 0, 2 * Math.PI);
        if (c.act) {
            ctx.fillStyle = c.ink;
            ctx.globalAlpha = on && menu.press === c.id ? 0.6 : 1;
            ctx.fill();
            ctx.globalAlpha = 1;
        } else {
            ctx.fillStyle = '#000';
            ctx.fill();
            ctx.strokeStyle = on ? '#6d685f' : '#4a453d';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        if (on) {
            ctx.beginPath();
            ctx.arc(c.cx, M_TL_Y, r + 5, 0, 2 * Math.PI);
            ctx.strokeStyle = c.act ? c.ink : '#6d685f';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        const ink = on ? (c.act ? '#f2efe9' : '#6d685f') : (c.act ? c.ink : '#4a453d');
        if (c.act) text('YEAR', c.cx, M_TL_Y - 44, 11, ink, 'center');
        text(c.label, c.cx, M_TL_Y - 24, on ? 19 : 16, ink, 'center');
        c.under.forEach((line, i) => text(line, c.cx, M_TL_Y + M_UNDER + c.drop + i * M_UNDER_STEP, 13, ink,
                                          'center'));
    }

    function menuScreenDraw() {
        if (!menuScreenUp()) return false;
        const sc = menu.screen;
        if (sc.kind === 'memory') { menuMemoryCard(sc.n, sc.t); return true; }
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, LW, LH);
        if (sc.kind === 'reset') {
            text('ERASE SAVE DATA?', LW / 2, 150, 34, '#f2efe9', 'center');
            text('every key, paddle and memory, gone for good', LW / 2, 195, 15, '#9a958c', 'center');
        } else text('MEMORIES', LW / 2, 150, 34, '#d9a5b3', 'center');
        const lit = menuChoiceAt(paddle.x);
        const choices = menuChoices();
        const stops = choices.filter(c => c.stop);
        if (stops.length) menuDrawTimeline(stops);
        for (const c of choices) {
            const on = c === lit || c.id === lit.id;
            if (c.stop) { menuDrawStop(c, on); continue; }
            const x = c.cx - c.w / 2, y = M_CHOICE_Y - M_CHOICE_H / 2;
            menuPanel(x, y, c.w, M_CHOICE_H, on, c.ink);
            if (on) {
                ctx.globalAlpha = menu.press === c.id ? 0.4 : 0.18;
                ctx.fillStyle = c.ink;
                ctx.fillRect(x + 1, y + 1, c.w - 2, M_CHOICE_H - 2);
                ctx.globalAlpha = 1;
            }
            text(c.label, c.cx, M_CHOICE_Y + 6, 17, on ? (c.act ? '#f2efe9' : '#6d685f') : (c.act ? c.ink : '#4a453d'),
                 'center');
        }
        // a line from him up to what he is under, so it is plain he is the pointer
        ctx.strokeStyle = lit.ink;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(paddle.x, PADDLE_Y - padH() / 2 - 8);
        ctx.lineTo(lit.cx, !lit.stop ? M_CHOICE_Y + M_CHOICE_H / 2 + 8
                         : lit.under.length ? M_TL_Y + M_UNDER + lit.drop + (lit.under.length - 1) * M_UNDER_STEP + 8
                         : M_TL_Y + M_STOP_R * 1.6 + 8);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        text('move under one · click, tap or space to pick it', LW / 2, 245, 17, '#6d685f', 'center');
        labPadIcon(LAB.pad, paddle.x, PADDLE_Y, padW(), false, 1);
        return true;
    }

    // Where a press is aiming. A free pointer (a finger, or a mouse the
    // browser would not lock) aims where it is; a locked mouse, or a key,
    // aims where he is -- the hand, not where he has got to yet.
    function menuAimOf(e) {
        const free = e && e.clientX !== undefined && !(typeof locked === 'function' && locked());
        if (!free) return paddle.tx;
        const r = canvas.getBoundingClientRect();
        return (e.clientX - r.left) / r.width * LW;
    }

    // A press while one is up is the screen's, never his. It arms the choice
    // it is aimed at and letting go on the same one takes it, so the finger
    // or key still down from the door hold cannot pick anything by lifting,
    // and sliding off before letting go takes it back.
    function menuScreenPress(e, down) {
        if (!menuScreenUp()) return false;
        if (menu.screen.kind === 'memory') {
            if (!down) return true;
            const t = menuMemoryTap(menu.screen.n, menu.screen.t);
            if (t < 0) menuShow('memories'); else menu.screen.t = t;
            return true;
        }
        const c = menuChoiceAt(menuAimOf(e));
        if (down) menu.press = c.act ? c.id : null;
        else {
            if (menu.press && c.id === menu.press) c.act();
            menu.press = null;
        }
        return true;
    }

    // ---- holding, which is the whole of the input ------------------------------------
    // The game's own tap serves a ball; there is no ball here, so the hub takes
    // the press for itself (see the action() hook) and only watches whether it
    // is still down.
    // A press that turns over one of the opening cards is the card's, not his.
    // Asked as typeof since the boss lab builds this file without the opening.
    const introHas = () => typeof introUp === 'function' && introUp();
    const menuHeld = (down, e) => {
        if (down && introHas()) return;
        if (down && menuUnlockNext()) return;
        if (menuScreenPress(e, down)) { menu.march = false; return; }
        if (menu && (!down || menuUp())) menu.march = down;
    };
    addEventListener('pointerdown', e => {
        if (e.target && e.target.closest && e.target.closest('#lab')) return;
        menuHeld(true, e);
    }, true);
    addEventListener('pointerup', e => menuHeld(false, e), true);
    addEventListener('pointercancel', () => { if (menu) menu.press = null; menuHeld(false); }, true);
    addEventListener('blur', () => { if (menu) menu.press = null; menuHeld(false); });
    addEventListener('keydown', e => {
        if (e.code !== 'Space' || !menuUp()) return;
        e.preventDefault();
        if (e.repeat) return;               // a key held on from the door is not a press
        menuHeld(true);
    }, true);
    addEventListener('keyup', e => { if (e.code === 'Space') menuHeld(false); }, true);
