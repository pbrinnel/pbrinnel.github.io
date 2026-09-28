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
    //   each stage gives the next memory the first time you win it with one left to give
    //   win the CASTLE and the VOID stands in the way to it: its memory comes
    //   halfway through the fight, and its end is the credits
    //   win the VOID and BOSS RUSH opens: every boss back to back, for a best of its own
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
    // The finale, which is not there at all until the CASTLE has been won
    // (`after`). It stands in the middle of the CASTLE's own lane, so once it
    // is up the CASTLE is only reached by walking round it. It guards no
    // paddle and has no slot on the CASTLE; its key opens BOSS RUSH. Being new it is never dusty, and it
    // is no building at all but a hole turning in the town (menuDrawVoid).
    const MENU_VOID = { n: 6, name: 'VOID', ink: '#dcd6ee', after: 5 };
    // Every memory, by the year it is set in: the game starts in year 0. Each
    // is named on the timeline by its year and its title, in its own colour.
    // Year 0 itself -- the town, which is where it takes you back to
    // (menuReturn) -- is always there; the rest are earned in MENU_MEM_ORDER.
    const MENU_MEMS = [
        { id: 'exhortation', year: -2784, title: 'Exhortation', ink: '#7fa85a' },
        { id: 'salvation', year: -1701, title: 'Salvation', ink: '#b0a894' },
        { id: 'cycle', year: -1342, title: 'Cycle', ink: '#d2622f' },
        { id: 'counsel', year: -126, title: 'Counsel', ink: '#c9a94e' },
        { id: 'fall', year: -99, title: 'Fall', ink: '#9a7fc9' },
        { id: 'consolidation', year: -92, title: 'Consolidation', ink: '#6f9bc4' },
        { id: 'now', year: 0, title: 'Reprisal', ink: '#f2efe9', always: true },
    ];
    // The order memories are earned in, one from each stage won (see
    // menuNextMemory), whichever stage it is. Not the timeline's order: the story is
    // told out of sequence, and the gaps it leaves are where the rest go.
    const MENU_MEM_ORDER = ['exhortation', 'consolidation', 'cycle', 'salvation', 'counsel', 'fall'];
    // The first win anywhere, clean or not, also hands over CLASSIC. He plays
    // exactly as the paddle you started with, so there is nothing in him to
    // earn -- he is a souvenir, and the first one a player picks up.
    const MENU_SOUVENIR = 'classic';
    // Who a level hands you is whoever the level sliders say, so moving a boss
    // in his own tab moves him in the town too. No second copy of the roster to
    // fall out of step with the first.
    const MENU_BOSSES = { windmill: 'WM_LVL', idol: 'IDOL_LVL', twins: 'TW_LVL',
                          lamps: 'LAMP_LVL', gleeok: 'GL_LVL', headless: 'HL_LVL',
                          agahnim: 'AG_LVL', dodongo: 'DOD_LVL', lucifer: 'LU_LVL' };
    const MENU_ALL = MENU_LEVELS.concat([MENU_LAST, MENU_VOID]);
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
                menu.memFrom = {};
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
                 mems: (saved && saved.mems) || {}, memFrom: (saved && saved.memFrom) || {},
                 dusting: null, sel: 1, say: null, sayT: 0,
                 cards: [], run: null, side: 0, hold: 0, sw: null,
                 march: false, lift: 0, lastX: 0, into: null, walk: 0, gait: 0, arriveT: -1,
                 going: null, screen: null, press: null,
                 shows: [], showT: 0 };
        return menu;
    }

    function menuSave() {
        try {
            localStorage.setItem(MENU_KEY, JSON.stringify({ keys: menu.keys, pads: menu.pads, best: menu.best,
                                                            seen: menu.seen, mems: menu.mems,
                                                            memFrom: menu.memFrom }));
        } catch (e) { /* a private window just will not remember */ }
    }

    function menuProgress() {
        menuLoad();
        return { keys: Object.keys(menu.keys).filter(k => menu.keys[k]),
                 pads: Object.keys(menu.pads).filter(k => menu.pads[k]) };
    }

    // the four levels' own keys: the CASTLE's and the VOID's open nothing more
    function menuOpened() { menuLoad(); return MENU_LEVELS.every(l => menu.keys[l.n]); }

    // whether a building is standing yet: most always are, the VOID waits on a
    // win, MEMORIES on its first memory and BOSS RUSH on the VOID
    function menuStands(c) {
        if (c.level.key === 'memories') return MENU_MEMS.some(m => !m.always && menu.mems[m.id]);
        if (c.level.key === 'rush') return !!menu.keys[MENU_VOID.n];
        return !c.level.after || !!menu.keys[c.level.after];
    }

    // ---- what the debug menu reaches in through ---------------------------------------
    // Everything the town knows about you is in `menu`, and `menu` is this
    // file's. These five, and menuSkip/menuSkipName for the level you are in,
    // are the whole of the way in, so nothing else has to know how progress
    // is stored or that it is saved at all.
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

    // ---- the high scores --------------------------------------------------------------
    // Each of the six levels has a best of its own, kept with the rest of
    // your progress and wiped with it; TOTAL HIGH SCORE is all six added up.
    // The engine's `best` is the level you are in, set as you go in, and it
    // hands every new best back here as it happens -- so a run that is lost,
    // or that bought a continue, still keeps what it reached.
    function menuBestIs(v) {
        if (!menu || !menu.run) return;
        const n = menu.run.n;
        if (v <= (menu.best[n] || 0)) return;
        menu.best[n] = v;
        menuSave();
    }
    function menuBestTotal() {
        menuLoad();
        return MENU_ALL.reduce((s, l) => s + (menu.best[l.n] || 0), 0);
    }
    // what the HUD calls the best it is showing. A player calls each of the
    // six a STAGE -- never a level, so the walls inside one are not mistaken
    // for more of them. BOSS RUSH keeps its own, and it is not one of the six.
    function menuBestLabel() { return menu && menu.run && menu.run.n === M_RUSH ? 'RUSH BEST' : 'STAGE BEST'; }

    function menuName(n) { if (n === M_RUSH) return 'BOSS RUSH'; const l = MENU_ALL.find(o => o.n === n); return l ? l.name : 'STAGE ' + n; }

    // the first boss whose level slider points at this one, if any
    function menuBossFor(n) {
        for (const k of Object.keys(MENU_BOSSES)) if (LAB.ev(MENU_BOSSES[k]) === n) return k;
        return null;
    }

    // ---- the town -------------------------------------------------------------------
    // He walks up from y 542, so the near pair is a short walk and the far one
    // is a long one. Their x spans never overlap and each is a lane straight up
    // to one building: 25-161 is the FARM's, 187-305 the RUINS', 306-494 goes
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
    //
    // The VOID, once it stands, is small and in the middle of the way up to
    // the CASTLE, halfway between the near row and the far one, so walking
    // straight up from home arrives at it. The CASTLE's lane takes in the
    // empty gaps either side of it, which leaves a strip each side of the
    // VOID to walk up past it.
    //
    // The one line of patter goes under the VOID, between the near pair --
    // the floor is the gates', and the near pair reach down to 452.
    const M_SAY_Y = 372;
    const M_TOWN = {
        1: { x: 93, y: 392, w: 136, h: 120 },
        2: { x: 246, y: 228, w: 118, h: 112 },
        3: { x: 554, y: 228, w: 118, h: 112 },
        4: { x: 707, y: 392, w: 136, h: 120 },
        5: { x: 400, y: 92, w: 138, h: 110, lane: [306, 494] },
        6: { x: 400, y: 310, w: 84, h: 64 }
    };
    // Coming at a building's side rather than its door -- up the strip beside
    // it and then across -- is a wall, not a door: he is stopped at the edge
    // of its lane. More overlap than a frame of walking up can make is how a
    // side is told from the door.
    const M_SIDE_IN = 10;

    // More that are not levels. MEMORIES and the boards take the top corners,
    // and a corner's lane is the wall itself: walk up hard against the left or
    // right edge and that is where you arrive, past the FARM or the VOLCANO
    // rather than into it. MEMORIES is not built until there is a memory to
    // keep in it (menuStands). SETTINGS is the least of them, a small sign up and to the
    // right of MEMORIES, and its lane is the gap between the FARM and the
    // RUINS -- narrower than the sign, so nobody wanders into it. Going in
    // is only a screen of choices (menuShow); erasing is two presses deeper.
    // BOSS RUSH is its mirror, up and to the left of the boards over the
    // gap between the CITY and the VOLCANO, and it is not there until the
    // VOID has been won.
    const M_SIDES = [
        { key: 'memories', side: -1, lines: ['MEMORIES'], ink: '#d9a5b3',
          at: { x: 70, y: 80, w: 116, h: 90 } },
        { key: 'settings', lines: ['SETTINGS'], ink: '#a9a39a', small: true,
          at: { x: 174, y: 44, w: 80, h: 28, lane: [162, 186] } },
        { key: 'board', side: 1, lines: ['LEADER', 'BOARD'], ink: '#c9a94e',
          at: { x: 730, y: 80, w: 116, h: 90 } },
        { key: 'rush', lines: ['BOSS RUSH'], ink: '#e0a040', small: true,
          at: { x: 626, y: 44, w: 80, h: 28, lane: [614, 638] } }
    ];
    const M_RUSH = 'rush';           // BOSS RUSH's name in menu.run and menu.best
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
        const [l, r] = menuLaneOf(c);
        return !wall && paddle.x >= l && paddle.x <= r;
    }
    function menuLaneOf(c) { return c.lane || [c.x - c.w / 2, c.x + c.w / 2]; }

    // lined up with it and nothing nearer in the way, which is what lights it:
    // straight up from under the VOID, the CASTLE is not where he would get to
    function menuAimed(c) {
        return menuLane(c) && !menu.cards.some(o => o !== c && o.y > c.y && menuStands(o) && menuLane(o));
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
    const MARCH_MAX = 470;           // past the last door, SETTINGS', for the empty lanes
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
        // Only a walk up arrives anywhere. Coming home he passes back through
        // whatever he walked round on the way up.
        let c = menu.lift > 0 && menu.march ? menuAt() : null;
        const over = c ? (c.y + c.h / 2) - (padY() - padH() / 2) : 0;
        // back out the side he came in by, which is where he was last frame: a
        // hand can carry him most of the way across in one
        if (c && !c.level.side && over > M_SIDE_IN) {
            const [l, r] = menuLaneOf(c);
            paddle.x = menu.lastX < (l + r) / 2 ? l - 0.5 : r + 0.5;
            c = null;
        }
        menu.lastX = paddle.x;
        if (c && c.level.n && !c.level.after && !menu.seen[c.level.n]) menuDust(c.level.n);
        if (c) {
            // stopped on the step, however fast he was walking at it: padY()
            // reads menu.lift, so backing the overshoot out of it puts his
            // leading edge exactly on the door
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
            if (!menuStands(c) || !menuLane(c)) continue;
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
        if (l.key === 'settings' || l.key === 'memories') { menuShow(l.key); menu.screen.from = g.x; }
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

    // Into a level: its screens, the boss last (levels.js), or where there
    // are none -- the VOID, or the boss lab, which has no levels.js -- just
    // the boss. menuWatch keeps an eye on whether you had to buy it back.
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
        if (level.key === 'rush') { menuRush(); return; }
        const boss = menuBossFor(level.n);
        if (!boss) { menuSay(level.name + ' · no boss is set to this stage'); return; }
        menu.arriveT = -1;          // walked in before the town finished arriving
        menu.run = { n: level.n, over: false, cont: false, out: 0 };
        best = menu.best[level.n] || 0;
        menu.sel = level.n;
        menu.march = false;
        LAB.mini = null;
        setHint(HINT_PLAY);
        if (typeof levelsUse === 'function' && levelsUse(level.n)) {
            LAB.boss = boss;
            LAB.stageAt(0, false);
        } else LAB.fight(boss);
    }

    // BOSS RUSH: every level's boss in order, one screen each, the takeover
    // between them and the next arriving straight after (menuWatch). No
    // memories, no keys, no paddles -- just a score, kept as a best of its
    // own. The boss lab has no levels.js, so no rush.
    function menuRush() {
        const whos = MENU_ALL.map(l => menuBossFor(l.n)).filter(Boolean);
        if (typeof levelsRush !== 'function' || !whos.length) { menuSay('BOSS RUSH · not in here'); return; }
        menu.arriveT = -1;
        menu.run = { n: M_RUSH, over: false, cont: false, out: 0 };
        best = menu.best[M_RUSH] || 0;
        menu.march = false;
        LAB.mini = null;
        setHint(HINT_PLAY);
        levelsRush(whos);
        LAB.boss = whos[0];
        LAB.stageAt(0, false);
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
        // any screen but a level's last is cleared on the way to the next --
        // except a boss in BOSS RUSH, whose takeover leads straight into the
        // next one's entrance
        if (stage < LEVELS.length - 1) {
            if (phase !== 'ascend' || (run.out += dt) < M_OUT) return;
            run.out = 0;
            impact = null;
            bossFall = null;
            stage++;
            buildStage(stage);
            banner = '';
            return;
        }
        if ((run.out += dt) < M_OUT) return;
        menu.run = null;
        menuBeat(!run.cont, run.n);
        menuOpen();
    }

    // Stage n's memory, if it has not given one yet: the first in
    // MENU_MEM_ORDER not yet earned, earned and queued to play behind its
    // MEMORY UNLOCKED card. Each stage gives one (`memFrom`), on whichever
    // win of it comes first while there is one left to give -- not only the
    // first win, so a stage whose key came from the debug menu, or that was
    // won with every memory already open, still gives its own later. The
    // debug menu can hand memories over out of order, so it is the first
    // missing one, not the next after a count. True if one was earned.
    function menuNextMemory(n) {
        if (menu.memFrom[n]) return false;
        const id = MENU_MEM_ORDER.find(k => !menu.mems[k]);
        if (!id) return false;
        menu.mems[id] = true;
        menu.memFrom[n] = true;
        menu.shows.push({ memCard: id }, { mem: id });
        return true;
    }

    // A boss that ends his level himself, rather than through the takeover (the
    // VOID's): what you earned, and back to the town. The VOID's end is the
    // end of the game, so the credits roll on the way.
    function menuWon() {
        const run = menu && menu.run;
        const rush = !!(menu && menu.keys[MENU_VOID.n]);
        if (run) menuBeat(!run.cont, run.n);
        if (run && run.n === MENU_VOID.n) {
            menu.shows.push({ credits: true });
            if (!rush) menu.shows.push({ rushCard: true });
        }
        menuOpen();
    }

    // The VOID's memory, earned between its second part and its third and
    // played over the fight (lucifer.js steps it and draws it). True if
    // there was one still to earn.
    function menuVoidMemory() {
        menuLoad();
        if (!menu.run || menu.run.n !== MENU_VOID.n) return false;
        if (!menuNextMemory(MENU_VOID.n)) return false;
        menuSave();
        menu.fightShow = true;
        menu.showT = 0;
        return true;
    }
    // ...one frame of it: true while it is still up
    function menuFightShowStep(dt) {
        if (!menu.fightShow) return false;
        menuShowStep(dt);
        if (!menu.shows.length) menu.fightShow = false;
        return menu.fightShow;
    }

    // the unlock screens' clock, which a memory and the credits end by themselves
    function menuShowStep(dt) {
        menu.showT += dt;
        const s = menu.shows[0];
        const done = s.mem ? typeof memoryDone === 'function' && memoryDone(s.mem, menu.showT)
                   : s.credits ? menu.showT >= menuCreditsSecs() : false;
        if (done) { menu.shows.shift(); menu.showT = 0; }
    }

    // The debug menu's win button. The screen you are on counts as beaten: a
    // level's last is won outright, as though the takeover had played out,
    // and any other goes straight on to the next with no STAGE CLEAR.
    // Coming off the CONTINUE screen this way is not a continue.
    function menuSkip() {
        if (!menu || !menu.run) return false;
        menu.run.over = false;
        showCursor(false);
        if (stage >= LEVELS.length - 1) { menuWon(); return true; }
        stage++;
        buildStage(stage);
        banner = '';
        return true;
    }

    // what that button would beat, or null outside a level
    function menuSkipName() {
        if (!menu || !menu.run) return null;
        const l = LEVELS[stage];
        return l.who && menu.run.n === M_RUSH ? l.dbg : l.boss ? menuName(menu.run.n) + ' BOSS' : l.dbg;
    }

    // a level finished: the key always, the paddle only if you never continued
    function menuBeat(clean, n) {
        menuLoad();
        if (n === M_RUSH) { menuSay('BOSS RUSH · ' + score); return true; }
        const which = n || menu.sel || 1;
        const level = MENU_ALL.find(l => l.n === which);
        if (!level) return false;
        // its memory is earned halfway through the fight (menuVoidMemory)
        // and its end is the credits; all a win keeps is its key, which
        // opens BOSS RUSH
        if (level === MENU_VOID) { menu.keys[level.n] = true; menuSave(); return true; }
        const first = !menu.keys[level.n];
        menu.keys[level.n] = true;
        // the run keeps its best as it goes (menuBestIs); this is for the
        // lab's buttons, which win a level without one
        menu.best[level.n] = Math.max(menu.best[level.n] || 0, score || 0);
        let got = level.name + (first ? ' · A KEY' : ' · DONE AGAIN');
        // the stage's memory plays before any paddle is shown: after that
        // it is in MEMORIES
        menuNextMemory(level.n);
        // A paddle just won is in your hands when the town comes back: the
        // level's own if there is one, since it is the one you played for,
        // or else the souvenir. A paddle kept back says nothing.
        let take = null;
        if (clean && !menu.pads[level.pad]) {
            menu.pads[level.pad] = true;
            menu.shows.push({ pad: level.pad });
            got += ' AND ' + (LAB_PAD[level.pad] ? LAB_PAD[level.pad].name : level.pad.toUpperCase());
            take = level.pad;
        }
        if (!menu.pads[MENU_SOUVENIR]) {
            menu.pads[MENU_SOUVENIR] = true;
            menu.shows.push({ pad: MENU_SOUVENIR });
            got += ' · AND ' + LAB_PAD[MENU_SOUVENIR].name;
            take = take || MENU_SOUVENIR;
        }
        if (take && LAB_PAD[take]) LAB.usePad(take);
        menuSave();
        menuSay(got);
        return true;
    }

    // back to the hub: an empty field with the town on it
    function menuOpen() {
        menuLoad();
        menu.run = null;
        if (typeof levelsUse === 'function') levelsUse();    // the town stands on the engine's own
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
            menu.march = false;
            menuShowStep(dt);
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
    // gates are the whole of it, with your bests on them and their total
    // along the floor.
    function labDrawTop() {
        if (labB && labB.drawTop) labB.drawTop();     // a boss's own end, over everything
        if (!menuUp()) return;
        if (menuUnlockDraw()) return;
        if (menuScreenDraw()) return;

        const k = menuArriveK();
        // the far ones first, so a near one growing past them is drawn over them
        for (const c of menu.cards.filter(menuStands).sort((a, b) => a.y - b.y)) {
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
        // every level's best added up, along the floor under him, once there is one
        const total = menuBestTotal();
        if (total > 0) text('TOTAL HIGH SCORE ' + total, LW / 2, M_TOTAL_Y, 12, '#8d877d', 'center');
    }
    const M_TOTAL_Y = 592;

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
        // BOSS RUSH's best hangs under its sign, once it has one
        if (s.key === 'rush' && menu.best[M_RUSH] > 0) {
            text('BEST ' + menu.best[M_RUSH], c.x, y + c.h + 13, 10, ink, 'center');
        }
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
        if (l === MENU_VOID) { menuDrawVoid(c); return; }
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
        const aimed = menuAimed(c);
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
        // ...and under it your best there, once there is one, which lifts
        // the key a little to make room
        const keyInk = o => dusty ? DUST_INK : o.ink;
        const got = !dusty && menu.best[l.n] > 0;
        const ky = y + c.h * (got ? (big ? 0.66 : 0.63) : 0.72);
        if (big) MENU_LEVELS.forEach((o, i) => menuKey(c.x - 42 + i * 28, ky, 8, !!menu.keys[o.n], keyInk(o)));
        else menuKey(c.x, ky, 12, !!menu.keys[l.n], keyInk(l));
        if (got) text('BEST ' + menu.best[l.n], c.x, y + c.h * 0.9, 11, aimed ? '#f2efe9' : '#8d877d', 'center');
    }

    // The VOID is not a building but a hole in the town: an oval of black with
    // arms of light wound into it and turning, slowly, inward to a still black
    // eye with its name in it, and a rim that will not hold its shape. Slow on purpose -- it is the one thing in the
    // town that moves on its own, and it only has to look wrong, not busy.
    // Nothing in it flashes. Stood in its doorway, the hole fills from the
    // floor up like any other door.
    const VOID_ARMS = 5;
    const VOID_TWIST = 7.5;          // radians an arm winds through, rim to middle
    const VOID_SPIN = 0.9;           // radians a second the arms turn
    const VOID_WOBBLE = 0.07;        // how far the rim strays, as a share of it
    const VOID_WOBBLE_HZ = 0.35;
    const VOID_EYE = 0.45;           // the still black middle its name is in, as a share of it

    function menuDrawVoid(c) {
        const l = c.level, aimed = menuAimed(c);
        const t = performance.now() / 1000;
        const rx = c.w / 2, ry = c.h / 2;
        // the rim, three lobes drifting round it
        const rim = () => {
            ctx.beginPath();
            for (let i = 0; i <= 48; i++) {
                const a = i / 48 * Math.PI * 2;
                const k = 1 + VOID_WOBBLE * Math.sin(a * 3 + t * VOID_WOBBLE_HZ * Math.PI * 2);
                const x = c.x + Math.cos(a) * rx * k, y = c.y + Math.sin(a) * ry * k;
                if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
            }
            ctx.closePath();
        };
        const a0 = ctx.globalAlpha;
        ctx.save();
        rim();
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = l.ink;
        ctx.lineCap = 'round';
        for (let i = 0; i < VOID_ARMS; i++) {
            ctx.beginPath();
            for (let s = 0; s <= 1.001; s += 0.04) {
                const a = -t * VOID_SPIN + i * Math.PI * 2 / VOID_ARMS + s * VOID_TWIST;
                const r = 1.1 - s * (1.1 - VOID_EYE);
                const x = c.x + Math.cos(a) * rx * r, y = c.y + Math.sin(a) * ry * r;
                if (s) ctx.lineTo(x, y); else ctx.moveTo(x, y);
            }
            ctx.globalAlpha = a0 * (aimed ? 0.55 : 0.25);
            ctx.lineWidth = 2.2;
            ctx.stroke();
        }
        if (menu.into && menu.into.card === c) {
            const k = Math.min(1, menu.into.t / DOOR_HOLD);
            ctx.globalAlpha = a0 * 0.5;
            ctx.fillStyle = l.ink;
            ctx.fillRect(c.x - rx * 1.2, c.y + ry * 1.2 - c.h * 1.2 * k, rx * 2.4, c.h * 1.2 * k);
        }
        ctx.restore();
        ctx.globalAlpha = a0 * (aimed ? 1 : 0.45);
        rim();
        ctx.strokeStyle = l.ink;
        ctx.lineWidth = aimed ? 2 : 1.5;
        ctx.stroke();
        ctx.globalAlpha = a0;
        text(l.name, c.x, c.y + 6, 17, aimed ? '#f2efe9' : '#8d877d', 'center');
        if (menu.best[l.n] > 0) text('BEST ' + menu.best[l.n], c.x, c.y + 21, 10, aimed ? '#f2efe9' : '#8d877d', 'center');
    }

    // A gate on each wall, standing where he stands, naming the paddle it leads
    // to. The name is stacked a letter at a time: a 24px post is too narrow to
    // write across and turning the canvas to write up it is more machinery than
    // six letters are worth. With only the one paddle there is nowhere for a
    // gate to lead, so there are no gates until a second is won.
    const M_GATE = { w: 24, y: 470, h: 118 };
    function menuDrawGate(side) {
        const x = side < 0 ? 0 : LW - M_GATE.w;
        const to = menuNextPad(side);
        const p = to && LAB_PAD[to];
        if (!p) return;
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

    // one line under the town, and only when something has just happened.
    // Leaning on a gate says nothing here: the gate and the note beside it
    // already name the paddle.
    function menuDrawLine() {
        if (menu.sw || menu.going || menu.sayT <= 0) return;
        ctx.globalAlpha = Math.min(1, menu.sayT / 0.4);
        text(menu.say, LW / 2, M_SAY_Y, 16, '#c9a94e', 'center');
        ctx.globalAlpha = 1;
    }

    // ---- PADDLE UNLOCKED, and a memory ------------------------------------------------
    // What a win hands you gets the whole screen on the way back into the
    // town, one at a time, each held until you tap: the level's memory first,
    // the first time it is beaten, named on a MEMORY UNLOCKED card before it
    // plays, then every paddle earned -- his name, and him, big, on a field
    // of his own colour, with what he does and a few lines of where he is from. Only a win shows them (menuBeat,
    // which the lab's "count it beaten" buttons also call); the debug menu's
    // toggles and "unlock everything" do not.
    const UNLOCK_WAIT = 0.6;         // seconds up before a tap takes it away
    const UNLOCK_IN = 0.45;          // him rising into place
    const UNLOCK_W = 500;            // how long he is drawn
    const UNLOCK_BACK = 0.22;        // his colour, this much of it over black, behind him

    // up in the town, or over the VOID's fight while its memory plays
    function menuUnlockUp() { return !!(menu && menu.shows.length && (menuUp() || menu.fightShow)); }

    // a tap: true if it was the unlock screen's to take
    function menuUnlockNext() {
        if (!menuUnlockUp()) return false;
        const s = menu.shows[0];
        const t = s.mem ? menuMemoryTap(s.mem, menu.showT)
                : s.credits ? menuCreditsTap(menu.showT)
                : menu.showT >= UNLOCK_WAIT ? -1 : menu.showT;
        if (t < 0) { menu.shows.shift(); menu.showT = 0; } else menu.showT = t;
        if (!menu.shows.length) menu.fightShow = false;
        return true;
    }

    function menuUnlockDraw() {
        if (!menuUnlockUp()) return false;
        const show = menu.shows[0];
        if (show.mem) { menuMemoryCard(show.mem, menu.showT); return true; }
        if (show.memCard) { menuMemoryUnlocked(show.memCard, menu.showT); return true; }
        if (show.credits) { menuCreditsDraw(menu.showT); return true; }
        if (show.rushCard) { menuRushUnlocked(menu.showT); return true; }
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
        if (p && p.blurb) text(p.blurb, LW / 2, 470, 15, '#c9c4ba', 'center');
        if (p && p.lore) menuLore(p.lore, LW / 2, 500, UNLOCK_LORE_PX, UNLOCK_LORE_W);
        ctx.globalAlpha = 1;
        return true;
    }

    // A paddle's lore, wrapped to w and centred on x: {odin}, {surtr} and
    // {angel} print as "Brandon" in that Brandon's face, the rest in the
    // plain voice, all of it in the plain voice's colour (see LAB_PAD). The
    // faces are memory.js's; the boss lab has them too, but asks first.
    const UNLOCK_LORE_W = 560;
    const UNLOCK_LORE_PX = 13;
    function menuLore(str, x, y, px, w) {
        const voices = typeof MEM_VOICE === 'object' ? MEM_VOICE : null;
        if (voices && typeof memFontsLoad === 'function') memFontsLoad();
        const face = v => voices && voices[v] ? voices[v].font.replace('{px}', px)
                                              : px + 'px "Fira Sans", "Trebuchet MS", sans-serif';
        // words, each keeping the space after it, and whose face it is in
        const words = [];
        str.split(/(\{\w+\})/).forEach(bit => {
            const named = bit.match(/^\{(\w+)\}$/);
            if (named) { words.push({ w: 'Brandon', v: named[1] }); return; }
            for (const piece of bit.split(/(?<=\s)/)) if (piece) words.push({ w: piece, v: 'you' });
        });
        for (const wd of words) {
            ctx.font = face(wd.v);
            wd.width = ctx.measureText(wd.w).width;
            wd.bare = ctx.measureText(wd.w.trimEnd()).width;
        }
        const rows = [[]];
        let run = 0;
        for (const wd of words) {
            const glued = wd.w[0] === "'";      // a name and the 's after it stay together
            if (!glued && run + wd.bare > w && rows[rows.length - 1].length) {
                rows.push([]);
                run = 0;
            }
            rows[rows.length - 1].push(wd);
            run += wd.width;
        }
        const ink = voices ? voices.you.ink : '#f2efe9';
        const a0 = ctx.globalAlpha;
        ctx.globalAlpha = a0 * 0.72;
        ctx.textAlign = 'left';
        ctx.fillStyle = ink;
        rows.forEach((row, r) => {
            const total = row.reduce((s, wd) => s + wd.width, 0);
            let cx = x - total / 2;
            for (const wd of row) {
                ctx.font = face(wd.v);
                ctx.fillText(wd.w, cx, y + r * px * 1.35);
                cx += wd.width;
            }
        });
        ctx.globalAlpha = a0;
    }

    // MEMORY UNLOCKED, the paddle card's twin: the memory's title big in its
    // own colour, then a tap and it plays. The title comes the way something
    // half-remembered does -- out of a haze, soft copies of it drifting in
    // round where it will be and settling into one over MEM_HAZE, wavering a
    // little as it does. Copies laid round it rather than a blur filter,
    // which Safari ignores.
    const MEM_HAZE = 2.2;            // seconds the title takes to come clear
    const MEM_HAZE_PX = 16;          // how far out the soft copies start
    const MEM_HAZE_COPIES = 10;
    function menuMemoryUnlocked(id, t) {
        const m = MENU_MEMS.find(o => o.id === id);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, LW, LH);
        ctx.globalAlpha = UNLOCK_BACK;
        ctx.fillStyle = m.ink;
        ctx.fillRect(0, 0, LW, LH);
        ctx.globalAlpha = 1;
        text('MEMORY UNLOCKED', LW / 2, 200, 34, '#f2efe9', 'center');
        const k = Math.min(1, t / MEM_HAZE), e = k * k * (3 - 2 * k);
        const spread = MEM_HAZE_PX * Math.pow(1 - e, 1.5);
        const sway = (1 - e) * 6 * Math.sin(t * 2.3);
        for (let i = 0; i < MEM_HAZE_COPIES; i++) {
            const a = i / MEM_HAZE_COPIES * Math.PI * 2 + t * 0.7;
            ctx.globalAlpha = 0.16 * Math.min(1, k * 3) * (1 - e * 0.85);
            text(m.title, LW / 2 + sway + Math.cos(a) * spread, 330 + Math.sin(a) * spread * 0.6, 54, m.ink, 'center');
        }
        ctx.globalAlpha = e * e;
        text(m.title, LW / 2 + sway, 330, 54, m.ink, 'center');
        ctx.globalAlpha = 1;
    }

    // BOSS RUSH UNLOCKED, after the credits, the paddle card's twin again
    function menuRushUnlocked(t) {
        const ink = M_SIDES.find(s => s.key === 'rush').ink;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, LW, LH);
        ctx.globalAlpha = UNLOCK_BACK;
        ctx.fillStyle = ink;
        ctx.fillRect(0, 0, LW, LH);
        const e = 1 - Math.pow(1 - Math.min(1, t / UNLOCK_IN), 3);
        ctx.globalAlpha = 1;
        text('UNLOCKED', LW / 2, 200, 34, '#f2efe9', 'center');
        ctx.globalAlpha = e;
        text('BOSS RUSH', LW / 2, 320 + (1 - e) * 30, 54, ink, 'center');
        text('every boss, back to back, for a best of its own', LW / 2, 368 + (1 - e) * 30, 15, '#c9c4ba', 'center');
        ctx.globalAlpha = 1;
    }

    // The credits, after the VOID: one card at a time out of the black and
    // back into it. Placeholders, all three.
    const CREDITS = [['STARRING', 'BRANDON'], ['BY', 'PAUL'], ['STORY HELP BY', 'DAVE']];
    const CREDITS_LEAD = 1;          // black before the first
    const CREDITS_IN = 0.8, CREDITS_HOLD = 2.2, CREDITS_OUT = 0.8;
    const creditsCard = () => CREDITS_IN + CREDITS_HOLD + CREDITS_OUT;
    function menuCreditsSecs() { return CREDITS_LEAD + CREDITS.length * creditsCard() + 0.6; }
    // a tap moves on to the next card, and past the last one closes them
    function menuCreditsTap(t) {
        const i = Math.floor((t - CREDITS_LEAD) / creditsCard()) + 1;
        return i >= CREDITS.length ? -1 : CREDITS_LEAD + i * creditsCard();
    }
    function menuCreditsDraw(t) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, LW, LH);
        const u = t - CREDITS_LEAD, i = Math.floor(u / creditsCard());
        if (u < 0 || i >= CREDITS.length) return;
        const k = u - i * creditsCard();
        ctx.globalAlpha = Math.max(0, Math.min(1, k / CREDITS_IN, (creditsCard() - k) / CREDITS_OUT));
        text(CREDITS[i][0], LW / 2, LH / 2 - 30, 17, '#8d877d', 'center');
        text(CREDITS[i][1], LW / 2, LH / 2 + 24, 46, '#f2efe9', 'center');
        ctx.globalAlpha = 1;
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

    // Every memory, oldest first, and whether it has been earned
    function menuTimeline() {
        return MENU_MEMS.map(m => Object.assign({}, m, { got: m.always || !!menu.mems[m.id] }))
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

    // ---- inside: SETTINGS and the MEMORIES room --------------------------------------
    // The two buildings you go into without leaving the town. Their choices
    // are picked the way the game-over screen's are: he is down at the bottom
    // with them in a row over him, the one he is under is lit, and a press
    // takes it -- a click, a tap or Space. That is the one way that works
    // everywhere: a mouse is locked to him in the town, so there is no cursor
    // to aim with, and a finger that taps a choice puts him under it anyway.
    //
    // Every screen but the room is a title, a line under it and a row of
    // choices (M_SCREENS), and each puts him under its `home` choice as it
    // comes up -- the one that changes nothing. So whatever he pressed to
    // get there, the next press cannot be the one that erases or overwrites:
    // that is always its own deliberate move and press on a word that says so.
    const M_CHOICE_Y = 330;          // the row of choices
    const M_CHOICE_H = 84;
    const M_CHOICE_W = 200;          // widest a choice gets...
    const M_CHOICE_GAP = 24;         // ...and the least room between two
    const M_SAFE = '#f2efe9';        // a choice that changes nothing
    const M_RISK = '#c0594a';        // a choice that throws progress away

    const M_SCREENS = {
        settings: { title: 'SETTINGS', ink: '#a9a39a', line: 'your progress lives in this browser', home: 'back',
                    choices: () => [
                        { id: 'back', label: 'BACK', ink: M_SAFE, act: menuLeave },
                        { id: 'export', label: 'EXPORT SAVE', ink: '#6f9bc4', act: menuExport },
                        { id: 'import', label: 'IMPORT SAVE', ink: '#7fa85a', act: menuPickSave },
                        { id: 'reset', label: 'RESET', ink: M_RISK, act: () => menuShow('reset') }] },
        reset: { title: 'ERASE SAVE DATA?', line: 'every key, paddle and memory, gone for good', home: 'keep',
                 choices: () => [
                     { id: 'keep', label: 'KEEP', ink: M_SAFE, act: () => menuShow('settings') },
                     { id: 'erase', label: 'ERASE', ink: M_RISK, act: menuErase }] },
        // `n` is the save that was read, not yet loaded
        import: { title: 'LOAD THIS SAVE?', line: sc => menuSaveSummary(sc.n) + ' · replaces what is here',
                  home: 'keep',
                  choices: sc => [
                      { id: 'keep', label: 'KEEP MINE', ink: M_SAFE, act: () => menuShow('settings') },
                      { id: 'load', label: 'LOAD IT', ink: M_RISK, act: () => menuLoadSave(sc.n) }] }
    };

    // Any number of choices, left to right, each the middle of an equal share
    // of the width: he picks by whichever middle is nearest, so a choice he
    // cannot quite stand under is still his from as near as he can get.
    function menuRow(list) {
        const share = LW / list.length, w = Math.min(M_CHOICE_W, share - M_CHOICE_GAP);
        return list.map((c, i) => Object.assign({ cx: share * (i + 0.5), w }, c));
    }

    function menuScreenUp() { return !!(menu && menu.screen && menuUp()); }
    function menuShow(kind, n) {
        // where he went in, kept from the room to a memory and back
        const from = menu.screen ? menu.screen.from : undefined;
        menu.screen = { kind, n, t: 0, from, note: null };
        menu.press = null;
        const s = M_SCREENS[kind];
        if (s) paddle.x = paddle.tx = menuChoices().find(c => c.id === s.home).cx;
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

    // Everything gone, and the game starts over the way it did the first
    // time: the title, the two opening cards, then the town arriving, dusty.
    // The boss lab has no opening, and just goes back to its town.
    function menuErase() {
        LAB_MINI.menu.acts.wipe();
        clearBest();                        // everything means the best as well
        if (typeof introRestart !== 'function') { menuLeave(); menuSay('SAVE DATA ERASED'); return; }
        menu.screen = null;
        menuOpen();
        paddle.x = paddle.tx = LW / 2;
        introRestart();
        freeMouse();
        splash.hidden = false;
    }

    // ---- the save file ------------------------------------------------------------------
    // EXPORT SAVE hands over everything `menu` keeps as a .brandon file, and
    // IMPORT SAVE reads one back over it. The format is specified in
    // _ref/BRANDON-SAVE.md: change what this section writes or reads and
    // change that doc in the same commit.
    //
    // It is plain text, one line for each thing you have -- nothing you have
    // not got is named in it, so it is no list of what there is to switch on
    // -- and its last line is a seal over the rest. A file edited by hand no
    // longer matches its seal and will not load. That only keeps honest
    // people honest (the seal is worked out in this file, for anyone to
    // read), which is all it has to: the bests in it are this browser's own,
    // and the boards will keep their own scores.
    //
    // Saves have to outlive the game that wrote them, both ways. Anything a
    // file does not mention is not had, so an old file lacking something
    // added since just starts it locked. Any line the reader does not know
    // is skipped, so a file from a newer game still loads what it can.
    // Every .brandon file opens with the game it is for, so one game's saves
    // can never be loaded into another's.
    const M_SAVE_GAME = 'BRANDON2';
    const M_SAVE_VER = 1;            // only for a change an older reader would get wrong
    const M_SAVE_NAME = 'save.brandon';
    const M_SAVE_SALT = '2000 YEARS LATER';
    const M_SAVE_MAX = 65536;        // bytes: a real save is a few hundred
    // What each thing is called in the file. Pinned here, never taken from a
    // display name or an id, so renaming either cannot orphan a save: a
    // token, once shipped, is forever. Something new needs a new token here
    // (menuSaveText warns about anything had that has none).
    const M_SAVE_STAGES = { 1: 'FARM', 2: 'RUINS', 3: 'CITY', 4: 'VOLCANO', 5: 'CASTLE', 6: 'VOID',
                            rush: 'BOSS RUSH' };
    const M_SAVE_PADS = { gilt: 'GILT', statue: 'STATUE', frost: 'FROST', ember: 'EMBER', pair: 'PAIR',
                          classic: 'CLASSIC' };
    const M_SAVE_MEMS = { exhortation: 'EXHORTATION', salvation: 'SALVATION', cycle: 'CYCLE',
                          counsel: 'COUNSEL', fall: 'FALL', consolidation: 'CONSOLIDATION' };
    // each kind of line, and which of `menu`'s tables it fills from which tokens
    const M_SAVE_SETS = [['KEY', 'keys', M_SAVE_STAGES], ['PADDLE', 'pads', M_SAVE_PADS],
                         ['MEMORY', 'mems', M_SAVE_MEMS], ['GAVE', 'memFrom', M_SAVE_STAGES],
                         ['VISITED', 'seen', M_SAVE_STAGES]];

    // FNV-1a over the salt and the lines, as eight hex digits
    function menuSeal(body) {
        let h = 0x811c9dc5;
        const s = M_SAVE_SALT + '\n' + body;
        for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
        return (h >>> 0).toString(16).padStart(8, '0');
    }

    const menuTokenOf = (table, tok) => Object.keys(table).find(k => table[k] === tok);

    function menuSaveText() {
        menuLoad();
        const lines = [M_SAVE_GAME + ' SAVE ' + M_SAVE_VER];
        const had = (what, k, table) => {
            if (table[k]) return true;
            // `standard` is everyone's, so it is never written
            if (!(what === 'pads' && k === 'standard')) console.warn('no save token for', what, k);
            return false;
        };
        for (const [word, what, table] of M_SAVE_SETS) {
            for (const k of Object.keys(menu[what])) {
                if (menu[what][k] && had(what, k, table)) lines.push(word + ' ' + table[k]);
            }
        }
        for (const k of Object.keys(menu.best)) {
            if (menu.best[k] > 0 && had('best', k, M_SAVE_STAGES)) lines.push('BEST ' + M_SAVE_STAGES[k] + ' ' + menu.best[k]);
        }
        const body = lines.join('\n');
        return body + '\nSEAL ' + menuSeal(body) + '\n';
    }

    // what the file says, as `menu` keeps it, or a string saying why not
    function menuParseSave(text) {
        const lines = String(text).replace(/\r/g, '').split('\n').map(s => s.trim()).filter(Boolean);
        const head = /^(\S+) SAVE (\d+)$/.exec(lines[0] || '');
        if (!head) return 'THAT IS NOT A BRANDON SAVE';
        if (head[1] !== M_SAVE_GAME) return 'THAT SAVE IS FOR ANOTHER GAME';
        const last = lines.pop();
        if (last !== 'SEAL ' + menuSeal(lines.join('\n'))) return 'THAT SAVE WILL NOT LOAD';
        if (Number(head[2]) > M_SAVE_VER) return 'THAT SAVE IS FROM A NEWER GAME';
        const got = { keys: {}, pads: { standard: true }, mems: {}, memFrom: {}, seen: {}, best: {} };
        for (const line of lines.slice(1)) {
            const sp = line.indexOf(' '), word = line.slice(0, sp), rest = line.slice(sp + 1);
            const set = M_SAVE_SETS.find(s => s[0] === word);
            if (set) {
                const k = menuTokenOf(set[2], rest);
                if (k !== undefined) got[set[1]][k] = true;
            } else if (word === 'BEST') {
                const at = rest.lastIndexOf(' '), k = menuTokenOf(M_SAVE_STAGES, rest.slice(0, at));
                const v = Number(rest.slice(at + 1));
                if (k !== undefined && Number.isInteger(v) && v > 0) got.best[k] = Math.max(got.best[k] || 0, v);
            }
        }
        return got;
    }

    function menuSaveSummary(s) {
        const count = (o, one, many) => {
            const k = Object.keys(o).filter(x => o[x]).length;
            return k + ' ' + (k === 1 ? one : many);
        };
        return count(s.keys, 'key', 'keys') + ', ' + count(s.pads, 'paddle', 'paddles') + ' and ' +
               count(s.mems, 'memory', 'memories');
    }

    // Written straight to a download. octet-stream, so no browser decides it
    // is text and puts .txt on the end of the name.
    function menuExport() {
        const url = URL.createObjectURL(new Blob([menuSaveText()], { type: 'application/octet-stream' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = M_SAVE_NAME;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        // not the name: a browser that already has one calls it (1), (2)...
        menu.screen.note = 'SAVE DOWNLOADED';
    }

    // The browser's own file picker, which only opens from inside a press --
    // and a choice is taken as the press lets go, so it still is one. The
    // mouse is let go first: the picker would take it anyway, and the town
    // takes it back on the next click. There is no `accept` filter, since a
    // phone that has never heard of .brandon greys every file out rather than
    // showing it; what is in the file is what decides.
    function menuPickSave() {
        freeMouse();
        const f = document.createElement('input');
        f.type = 'file';
        f.addEventListener('change', () => {
            const file = f.files && f.files[0];
            if (!file) return;
            const said = t => { if (menuScreenUp() && menu.screen.kind === 'settings') menu.screen.note = t; };
            if (file.size > M_SAVE_MAX) { said('THAT IS NOT A BRANDON SAVE'); return; }
            const r = new FileReader();
            r.onload = () => {
                const got = menuParseSave(r.result);
                if (typeof got === 'string') { said(got); return; }
                // only over the screen it was asked from: anything else has moved on
                if (menuScreenUp() && menu.screen.kind === 'settings') menuShow('import', got);
            };
            r.onerror = () => said('THAT FILE WOULD NOT OPEN');
            r.readAsText(file);
        });
        f.click();
    }

    // everything replaced by the file's, and home to the town to see it
    function menuLoadSave(s) {
        menuLoad();
        Object.assign(menu, s);
        menu.dusting = null;
        menuSave();
        if (!menu.pads[LAB.pad]) LAB.usePad('standard');
        clearBest();
        menuLeave();
        menuSay('SAVE LOADED');
    }

    // What there is to pick on this screen, left to right. Spread over the
    // whole of where his middle can go, so every one of them is somewhere he
    // can stand.
    function menuChoices() {
        const sc = menu.screen;
        if (M_SCREENS[sc.kind]) return menuRow(M_SCREENS[sc.kind].choices(sc));
        // the room: the timeline, oldest on the left, across the whole of
        // where he can stand. Its stops are evenly spaced, not to scale --
        // there are no years on it but the memories' own. A memory you have
        // not earned is not on it at all, but its place is kept empty, so
        // the gaps hint at what is still to come. Under each is its title.
        // There is no way out but forward: year 0 is the town, so it is also
        // the way back to it, and says so under its title.
        const tl = menuTimeline();
        const hs = halfSpan(), step = (LW - hs * 2) / (tl.length - 1);
        return tl.map((m, i) => ({ id: 'mem' + m.id, stop: true, cx: hs + step * i, ink: m.ink, got: m.got,
                                   label: menuYear(m.year),
                                   under: m.id === 'now' ? [m.title, 'BACK'] : [m.title],
                                   act: m.id === 'now' ? menuReturn : () => menuShow('memory', m.id) }))
            .filter(c => c.got);
    }

    // the one nearest him
    function menuChoiceAt(x) {
        let best = null;
        for (const c of menuChoices()) if (!best || Math.abs(c.cx - x) < Math.abs(best.cx - x)) best = c;
        return best;
    }

    // The timeline: one line, oldest at the left, running on past the last
    // stop to an arrowhead so it reads as time going somewhere. It spans
    // every stop's place, earned or not, so it never grows. Each stop is
    // a dot with its year over it, and anything more it has to say under it;
    // the lit one is bigger and ringed.
    const M_TL_Y = 350;              // the line
    const M_STOP_R = 7;              // a stop's dot
    const M_UNDER = 32;              // baseline of what a stop says under itself, off the line
    const M_UNDER_STEP = 14;         // ...and each line after the first, further down
    const M_UNDER_PX = 11;           // the size of what a stop says under itself

    function menuDrawTimeline() {
        const x0 = halfSpan() - 30, x1 = LW - halfSpan() + 30;
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
        ctx.fillStyle = c.ink;
        ctx.globalAlpha = on && menu.press === c.id ? 0.6 : 1;
        ctx.fill();
        ctx.globalAlpha = 1;
        if (on) {
            ctx.beginPath();
            ctx.arc(c.cx, M_TL_Y, r + 5, 0, 2 * Math.PI);
            ctx.strokeStyle = c.ink;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        const ink = on ? '#f2efe9' : c.ink;
        text('YEAR', c.cx, M_TL_Y - 44, 11, ink, 'center');
        text(c.label, c.cx, M_TL_Y - 24, on ? 19 : 16, ink, 'center');
        c.under.forEach((line, i) => text(line, c.cx, M_TL_Y + M_UNDER + i * M_UNDER_STEP, M_UNDER_PX, ink,
                                          'center'));
    }

    function menuScreenDraw() {
        if (!menuScreenUp()) return false;
        const sc = menu.screen;
        if (sc.kind === 'memory') { menuMemoryCard(sc.n, sc.t); return true; }
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, LW, LH);
        const s = M_SCREENS[sc.kind];
        if (s) {
            text(s.title, LW / 2, 150, 34, s.ink || M_SAFE, 'center');
            // a note is what the last choice did, and it stands in for the line
            const line = sc.note || (typeof s.line === 'function' ? s.line(sc) : s.line);
            text(line, LW / 2, 195, 15, sc.note ? M_SAFE : '#9a958c', 'center');
        } else text('MEMORIES', LW / 2, 150, 34, '#d9a5b3', 'center');
        const lit = menuChoiceAt(paddle.x);
        const choices = menuChoices();
        const stops = choices.filter(c => c.stop);
        if (stops.length) menuDrawTimeline();
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
                         : lit.under.length ? M_TL_Y + M_UNDER + (lit.under.length - 1) * M_UNDER_STEP + 8
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
        if (e.code !== 'Space' || !(menuUp() || menuUnlockUp())) return;
        e.preventDefault();
        if (e.repeat) return;               // a key held on from the door is not a press
        menuHeld(true);
    }, true);
    addEventListener('keyup', e => { if (e.code === 'Space') menuHeld(false); }, true);
