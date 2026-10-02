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
    //   every boss beaten counts, and the count buys MULTI, PRINCE, CHELL and
    //   BLUR -- or finish the FARM, the RUINS, the CITY or the VOLCANO
    //   without losing a head or a continue and it hands over its one of them
    //   own enough paddles and the BRANDONS sign goes up: every one on a rack, to pick from
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
    // Each one owns a color, and its key is a head in that color -- five keys
    // that can be told apart at a glance, and a town where every building reads
    // as its own place.
    const MENU_LEVELS = [
        { n: 1, name: 'FARM', ink: '#7fa85a', cap: 'gable', pad: 'gilded' },
        { n: 2, name: 'RUINS', ink: '#b0a894', cap: 'broken', pad: 'statue' },
        { n: 3, name: 'CITY', ink: '#6f9bc4', cap: 'skyline', pad: 'crystalline' },
        { n: 4, name: 'VOLCANO', ink: '#d2622f', cap: 'cone', pad: 'magma' }
    ];
    const MENU_LAST = { n: 5, name: 'CASTLE', ink: '#9a7fc9', cap: 'crown', pad: 'pair' };
    // The finale, which is not there at all until the CASTLE has been won
    // (`after`). It stands in the middle of the CASTLE's own lane, so once it
    // is up the CASTLE is only reached by walking round it. It guards no
    // paddle and has no slot on the CASTLE; its key opens BOSS RUSH. Being new it is never dusty, and it
    // is no building at all but a hole turning in the town (menuDrawVoid).
    const MENU_VOID = { n: 6, name: 'VOID', ink: '#dcd6ee', after: 5 };
    // Every memory, by the year it is set in: the game starts in year 0. Each
    // is named on the timeline by its year and its title, in its own color.
    // Year 0 itself -- the town, which is where it takes you back to
    // (menuReturn) -- is always there; the rest are earned in MENU_MEM_ORDER.
    const MENU_MEMS = [
        { id: 'exhortation', year: -2701, title: 'Exhortation', ink: '#7fa85a' },
        { id: 'reckoning', year: -1701, title: 'Reckoning', ink: '#b0a894' },
        { id: 'cycle', year: -1342, title: 'Cycle', ink: '#d2622f' },
        { id: 'counsel', year: -126, title: 'Counsel', ink: '#c9a94e' },
        { id: 'fall', year: -99, title: 'Fall', ink: '#9a7fc9' },
        { id: 'consolidation', year: -92, title: 'Consolidation', ink: '#6f9bc4' },
        { id: 'now', year: 0, title: 'Reprisal', ink: '#f2efe9', always: true },
    ];
    // The order memories are earned in, one from each stage won (see
    // menuNextMemory), whichever stage it is. Not the timeline's order: the story is
    // told out of sequence, and the gaps it leaves are where the rest go.
    const MENU_MEM_ORDER = ['exhortation', 'consolidation', 'cycle', 'reckoning', 'counsel', 'fall'];
    // The first win anywhere, clean or not, also hands over CLASSIC. He plays
    // exactly as the paddle you started with, so there is nothing in him to
    // earn -- he is a souvenir, and the first one a player picks up.
    const MENU_SOUVENIR = 'classic';
    // Paddles bought with bosses beaten: every one counts, in any stage or
    // BOSS RUSH, clean or not, over every run (menuSlew). The two easiest to
    // live with, MULTI and STATUE, come early this way, so a player who
    // needs the help is not made to win cleanly first; STATUE is still the
    // RUINS' own for a run without a continue...
    const MENU_SLAIN_PADS = [[3, 'statue'], [5, 'multi'], [10, 'prince'], [15, 'chell'], [20, 'blur']];
    // ...and the rest, sooner, each with a flawless win of a level: not a
    // head lost and no continue (menuBeatSlew)
    const MENU_FLAWLESS_PADS = { 1: 'multi', 2: 'prince', 3: 'chell', 4: 'blur' };
    // paddles owned before the BRANDONS sign goes up (menuStands)
    const MENU_RACK_AT = 5;
    // Who a level hands you is whoever the level sliders say, so moving a boss
    // in his own tab moves him in the town too. No second copy of the roster to
    // fall out of step with the first.
    const MENU_BOSSES = { windmill: 'WM_LVL', idol: 'IDOL_LVL', twins: 'TW_LVL',
                          lamps: 'LAMP_LVL', gleeok: 'GL_LVL', headless: 'HL_LVL',
                          agahnim: 'AG_LVL', dodongo: 'DOD_LVL', lucifer: 'LU_LVL' };
    const MENU_ALL = MENU_LEVELS.concat([MENU_LAST, MENU_VOID]);
    // fourkeys.html's ?reset names this key and MENU_PAD_KEY itself, since it
    // runs before this file: rename either and change it there too.
    const MENU_KEY = 'brandon-metalab.progress';
    // The paddle last in your hands, so the next visit starts with it. Kept in
    // this browser beside your progress, not in it: it is a preference, not
    // something won, so a .brandon save neither carries it nor needs to.
    const MENU_PAD_KEY = 'brandon2.paddle';
    // the line under the field: in the town there is nothing to serve
    const M_HINT = 'move to slide brandon · hold to walk him';
    // the rack, in the order the gates walk through it: the original, the one
    // you start with, then the one each level is guarding (a level's paddle the
    // count also buys keeps its level's place). The souvenir leads even though
    // it is earned later; the order is only how they are laid out, not when
    // they unlock.
    const MENU_PADS = [...new Set([MENU_SOUVENIR, 'standard'].concat(MENU_LEVELS.map(l => l.pad), MENU_LAST.pad,
                                                      MENU_SLAIN_PADS.map(s => s[1])))];

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
                menu.memFrom = {}; menu.slain = 0; menu.padNext = null;
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
        menu = { keys: (saved && saved.keys) || {}, pads: padsRenamed((saved && saved.pads) || { standard: true }),
                 best: (saved && saved.best) || {}, seen: (saved && saved.seen) || {},
                 mems: (saved && saved.mems) || {}, memFrom: (saved && saved.memFrom) || {},
                 slain: (saved && saved.slain) || 0,
                 dusting: null, sel: 1, say: null, sayT: 0,
                 cards: [], run: null, side: 0, hold: 0, spent: 0, gate: { '-1': 1, '1': 1 }, gateTo: {}, gateQuick: {}, sw: null,
                 march: false, lift: 0, lastX: 0, into: null, walk: 0, gait: 0, arriveT: -1,
                 going: null, screen: null, press: null,
                 shows: [], showT: 0, a0: 1, padNext: null };
        let kept = null;
        try { kept = localStorage.getItem(MENU_PAD_KEY); } catch (e) { /* a private window */ }
        kept = padNow(kept);
        // The first load is engine.js's own setup (debugBuild), before its
        // lets exist, and putting a paddle in hand writes some of them: so
        // it waits for the script under way to finish.
        if (kept && kept !== LAB.pad && menu.pads[kept] && LAB_PAD[kept]) {
            LAB.pad = kept;
            queueMicrotask(() => { if (LAB.pad === kept) labPadUse(kept); });
        }
        return menu;
    }
    // LAB.usePad tells us each time the paddle in hand is changed
    function menuPadKept(key) {
        try { localStorage.setItem(MENU_PAD_KEY, key); } catch (e) { /* a private window just will not remember */ }
    }

    function menuSave() {
        try {
            localStorage.setItem(MENU_KEY, JSON.stringify({ keys: menu.keys, pads: menu.pads, best: menu.best,
                                                            seen: menu.seen, mems: menu.mems,
                                                            memFrom: menu.memFrom, slain: menu.slain }));
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
    // win, MEMORIES on its first memory, the LEADERBOARD on a score above
    // nothing on any stage, BOSS RUSH on the VOID, and BRANDONS on enough of them
    function menuStands(c) {
        if (c.level.key === 'memories') return MENU_MEMS.some(m => !m.always && menu.mems[m.id]);
        if (c.level.key === 'board') return MENU_ALL.some(l => menu.best[l.n] > 0);
        if (c.level.key === 'rush') return !!menu.keys[MENU_VOID.n];
        if (c.level.key === 'paddles') return menuOwned().length >= MENU_RACK_AT;
        return !c.level.after || !!menu.keys[c.level.after];
    }
    // what of the town stands now, for telling what a run put up (menuOpen)
    function menuStanding() { return (menu.cards || []).filter(menuStands).map(c => c.level); }
    // the ones whose going up has a card of its own already
    const M_OWN_CARD = ['rush', 'paddles'];
    // ...and what the rest's card says under the name
    const M_BUILD_LINES = {
        memories: 'every memory you have won, to watch again',
        board: 'the best runs on every stage, and yours among them',
        6: 'where it ends'
    };

    // the paddles you have, in the gates' order
    function menuOwned() { return MENU_PADS.filter(k => menu.pads[k]); }
    // Every paddle comes in through here, so the one that makes MENU_RACK_AT
    // puts up the BRANDONS sign with its BRANDONS UNLOCKED card. That card
    // is kept last in the queue, after every paddle it counted, however many
    // more one win hands over after it. `show` is his own PADDLE UNLOCKED card,
    // and a paddle shown is the one put in your hands once the cards are
    // done (menuShowNext): the last shown, so the last one you were told of.
    function menuAddPad(pad, show) {
        const had = menuOwned().length;
        menu.pads[pad] = true;
        if (show) { menu.shows.push({ pad }); menu.padNext = pad; }
        const i = menu.shows.findIndex(s => s.rackCard);
        if (i >= 0) menu.shows.push(...menu.shows.splice(i, 1));
        else if (had < MENU_RACK_AT && menuOwned().length >= MENU_RACK_AT) menu.shows.push({ rackCard: true });
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
        // a paddle handed over here gets no card of its own, but it can still
        // be the one that puts up the BRANDONS sign, and that card it gets
        if (what === 'pads' && on) menuAddPad(k, false);
        else if (on) menu[what][k] = true; else delete menu[what][k];
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
    // ...and nothing at all until every one of the six has a best: a total
    // with a stage missing from it is not the number it says it is
    function menuBestTotal() {
        menuLoad();
        if (!MENU_ALL.every(l => menu.best[l.n] > 0)) return 0;
        return MENU_ALL.reduce((s, l) => s + menu.best[l.n], 0);
    }
    // what the HUD calls the best it is showing. A player calls each of the
    // six a STAGE -- never a level, so the walls inside one are not mistaken
    // for more of them. BOSS RUSH keeps its own, and it is not one of the six.
    function menuBestLabel() { return menu && menu.run && menu.run.n === M_RUSH ? 'RUSH BEST' : 'STAGE BEST'; }

    // ---- the leaderboards -------------------------------------------------------------
    // The shared tables are the engine's (its `the leaderboard`); the town says
    // when they come up. Once a run is over and everything it earned has been
    // shown, the town asks for your initials if the score makes the stage's
    // table -- or beats your own best there, because TOTAL adds up everyone's
    // best on each stage, and a run that only raises yours still counts in it.
    // The boss lab runs brandon.html's engine, which has none of this, so
    // everything here asks first.
    function menuBoardOn() { return typeof boardPick === 'function' && BOARD_ON; }

    // a run has begun: the table it could end on, and the best it has to beat
    function menuBoardRun() {
        if (!menuBoardOn()) return;
        menu.post = null;                // one left from a run the town never got to ask about
        menu.run.was = best;
        menu.run.pad = LAB.pad;          // what the row will say it was played with
        boardPick(menu.run.n);           // the one the game-over screen shows
    }
    // ...and ended, on its way back to the town. It is decided against the
    // tables as they are once they have been fetched again (menuUpdate waits).
    function menuBoardPost(run) {
        if (!menuBoardOn() || !(score > 0)) return;
        const p = menu.post = { n: run.n, score, was: run.was || 0, pad: run.pad, ready: false };
        fetchBoard().then(() => { p.ready = true; });
    }
    function menuBoardAsk() {
        const p = menu.post;
        menu.post = null;
        boardPick(p.n);
        if (qualifies(p.score) || (boardLive && p.score > p.was)) boardAsk(p.n, p.score, () => {}, p.pad);
    }

    // The LEADERBOARD building: a tab for every stage that is standing in the
    // town, so it names nothing you have not found yet, and one for TOTAL once
    // you have a best on all six -- the worker counts nobody with fewer, so
    // it is the table you are not on yet until then.
    // The table up is whichever tab he is under; a press on one fetches it
    // again, and BACK is the way out.
    function menuBoardTabs() {
        const tab = (id, label, ink, view) => ({ id, label, ink, view, act: fetchBoard });
        const side = k => M_SIDES.find(s => s.key === k);
        return [{ id: 'back', label: 'BACK', ink: M_SAFE, act: menuLeave }]
            .concat(menuBestTotal() > 0 ? [tab('total', 'TOTAL', side('board').ink, BOARD_TOTAL)] : [])
            .concat(MENU_ALL.filter(l => !l.after || menu.keys[l.after]).map(l => tab('s' + l.n, l.name, l.ink, l.n)))
            .concat(menu.keys[MENU_VOID.n] ? [tab('rush', 'BOSS RUSH', side('rush').ink, M_RUSH)] : []);
    }

    function menuName(n) { if (n === M_RUSH) return 'BOSS RUSH'; const l = MENU_ALL.find(o => o.n === n); return l ? l.name : 'STAGE ' + n; }

    // the first boss whose level slider points at this one, if any
    function menuBossFor(n) {
        for (const k of Object.keys(MENU_BOSSES)) if (LAB.ev(MENU_BOSSES[k]) === n) return k;
        return null;
    }

    // the color of the level a boss is fought in, for his entrance (drawShade)
    function menuInkOf(who) {
        const n = MENU_BOSSES[who] ? LAB.ev(MENU_BOSSES[who]) : null;
        const l = MENU_ALL.find(o => o.n === n);
        return l ? l.ink : null;
    }

    // ---- the town -------------------------------------------------------------------
    // He walks up from y 542, so the near pair is a short walk and the far one
    // is a long one. Where he goes is whatever his middle is under, nearest
    // first, walls and all: 25-161 is the FARM's, 187-305 the RUINS', 306-494
    // goes all the way up the middle to the CASTLE, and the right is the
    // mirror. Anything with something nearer across its whole lane -- the
    // corners behind the FARM and the VOLCANO -- is walked round to.
    //
    // The five stand 26px apart all the way across, between the two gates at
    // 0-24 and 776-800. Evenly spaced is the whole of the arrangement: the
    // CASTLE used to sit in a 6px slot between its neighbors, which read as
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
    // behind the FARM and the VOLCANO: walk up the gap beside one, and once
    // you are above its roof, across and on up. MEMORIES is not built until there is a memory to
    // keep in it, nor the boards until you have a score to put on one
    // (menuStands). SETTINGS is the least of them, a small sign up and to the
    // right of MEMORIES, and its lane is the gap between the FARM and the
    // RUINS -- narrower than the sign, so nobody wanders into it. Going in
    // is only a screen of choices (menuShow); erasing is two presses deeper.
    // BOSS RUSH is its mirror, up and to the left of the boards over the
    // gap between the CITY and the VOLCANO, and it is not there until the
    // VOID has been won. BRANDONS hangs beside SETTINGS, lower, over the
    // RUINS' roof: up SETTINGS' gap until he is above the roof, then across.
    // Its lane is the RUINS', so it stops where the CASTLE's starts. It goes
    // up once you own MENU_RACK_AT paddles.
    const M_SIDES = [
        { key: 'memories', side: -1, lines: ['MEMORIES'], ink: '#d9a5b3',
          at: { x: 70, y: 80, w: 116, h: 90 } },
        { key: 'settings', lines: ['SETTINGS'], ink: '#a9a39a', small: true,
          at: { x: 174, y: 44, w: 80, h: 28, lane: [162, 186] } },
        { key: 'board', side: 1, lines: ['LEADERBOARD'], ink: '#c9a94e',
          at: { x: 730, y: 80, w: 116, h: 90 } },
        { key: 'rush', lines: ['BOSS RUSH'], ink: '#e0a040', small: true,
          at: { x: 626, y: 44, w: 80, h: 28, lane: [614, 638] } },
        { key: 'paddles', lines: ['BRANDONS'], ink: '#6cb8a8', small: true,
          at: { x: 270, y: 76, w: 92, h: 26, lane: [187, 305] } }
    ];
    const M_RUSH = 'rush';           // BOSS RUSH's name in menu.run and menu.best

    function menuBuild() {
        menuLoad();
        menu.sw = null;
        menu.side = 0;
        menu.hold = 0;
        menu.spent = 0;
        menu.gate = { '-1': 1, '1': 1 };
        menu.gateTo = {};
        menu.gateQuick = {};
        menu.march = false;
        menu.lift = 0;
        menu.into = null;
        menu.going = null;
        menu.leaving = null;
        menu.screen = null;
        menu.gait = 0;
        menu.cards = MENU_ALL.map(l => Object.assign({ level: l }, M_TOWN[l.n]))
            .concat(M_SIDES.map(s => Object.assign({ level: s }, s.at)));
    }

    // whether he is lined up with this one: his middle under it. A lane is
    // the width of what is drawn unless the card says otherwise.
    function menuLane(c) {
        const [l, r] = menuLaneOf(c);
        return paddle.x >= l && paddle.x <= r;
    }
    function menuLaneOf(c) { return c.lane || [c.x - c.w / 2, c.x + c.w / 2]; }

    // lined up with it and nothing nearer still ahead of him, which is what
    // lights it: straight up from under the VOID, the CASTLE is not where he
    // would get to, but past the FARM's roof MEMORIES is
    function menuAimed(c) {
        const top = padY() - padH() / 2;
        return menuLane(c) && !menu.cards.some(o => o !== c && o.y > c.y && menuStands(o) && menuLane(o)
                                                   && top > o.y - o.h / 2);
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
    // How far up he can walk: until his top edge is MARCH_PAST beyond the
    // bottom of the highest doors (SETTINGS' and BOSS RUSH's), which is where
    // an empty lane ends. Worked out from the paddle he is holding, since a
    // shorter one is less tall and needs further to go: a fixed limit sized
    // for MODERN left THE PAIR's top short of those two doors.
    const MARCH_PAST = 4;
    function menuMarchMax() {
        const doors = Math.min(...M_SIDES.map(s => s.at.y + s.at.h / 2));
        return padY() + menu.lift - padH() / 2 - (doors - MARCH_PAST);
    }
    const DOOR_HOLD = 0.8;           // stood in the doorway before it opens
    const WALK_HZ = 2.3;             // paces a second, which is what the bob is
    const WALK_BOB = 0.8;            // how much he rises and falls, in jig units
    const WALK_ROCK = 0.055;         // ...and rolls, in radians

    function menuMarch(dt) {
        if (menu.sw) { menu.gait = Math.max(0, menu.gait - dt * 4); return; }
        const was = menu.lift;
        menu.lift = menu.march ? Math.min(menuMarchMax(), menu.lift + MARCH_UP * dt)
                               : Math.max(0, menu.lift - MARCH_BACK * dt);
        // He is wider than the gaps between the buildings, so what counts as
        // reaching one is his middle arriving, not his shoulder brushing it.
        // Only a walk up arrives anywhere. Coming home he passes back through
        // whatever he walked round on the way up.
        let c = menu.lift > 0 && menu.march ? menuAt() : null;
        const over = c ? (c.y + c.h / 2) - (padY() - padH() / 2) : 0;
        // back out the side he came in by, which is where he was last frame: a
        // hand can carry him most of the way across in one
        if (c && over > M_SIDE_IN) {
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
    // PUSH IN. The door hold is done: a doorway of the building's own opens
    // at its foot (menuDoorOf) and he walks up into it. Then the whole town
    // rushes past into that doorway, nearer things faster than far ones,
    // the doorway drifting to the middle of the screen, until only its inside
    // is left -- and the level's first wall is already there in it, firming
    // up as it comes, drawn exactly where the level will lay it, so the level
    // takes over without a cut. Coming back, the town pulls back out of the
    // same door and he walks out of it (menuOpen, menu.leaving). A door that
    // will not open (the boards, a shut CASTLE) just says why, and he stays out.
    const M_PUSH_SECS = 1.3;         // going in
    const M_PUSH_BACK = 1.2;         // coming back out
    const M_PUSH_WALK = 0.5;         // the share of going in by which he is through the door
    const M_PUSH_ZOOM_FROM = 0.4;    // ...and at which the town starts to rush past
    const M_PUSH_DEPTH = 45;         // how many times over it grows, enough for a doorway to fill the screen
    const M_PUSH_PARALLAX = 1.2;     // how much faster near things rush past than the door, far things slower
    const M_PUSH_LEVEL_FROM = 0.55;  // the share of going in at which the level starts to show through
    const M_NEAR_GROUND = 1.3, M_NEAR_SKY = -0.3;   // the gates and the sky, on menuNear's scale
    // A sign has no door, so PUSH TO BOARD: the same push, into its board's
    // own face, which drifts to the middle and fills the screen with the
    // screen it opens. He fades where he stands before the push gets going.
    const M_SIGN_SECS = 1.2, M_SIGN_BACK = 1.1;
    const M_SIGN_ZOOM_FROM = 0.1;    // the push starts almost at once: there is no walk first
    const M_SIGN_PARALLAX = 0.6;     // half a building's: the signs are all at the back of the town
    const M_SIGN_FADE = 0.2;         // the share of the way in he takes to fade
    const M_SIGN_DARK_FROM = 0.6;    // ...and from which the board goes to the screen's dark
    const M_FIELD = '#000';          // the level's own background, what the doorway opens onto

    function menuCanEnter(l) {
        if (l.key) return l.key !== 'board' || menuBoardOn();
        if (l.n === 5 && !menuOpened()) return false;
        return !!menuBossFor(l.n);
    }

    function menuGo(c) {
        menu.march = false;
        if (!menuCanEnter(c.level)) { menuEnter(c.level); return; }
        menu.going = { card: c, t: 0, x: paddle.x, y: padY() };
    }

    const menuPushSecs = c => c.level.key ? M_SIGN_SECS : M_PUSH_SECS;
    const menuPushBack = c => c.level.key ? M_SIGN_BACK : M_PUSH_BACK;

    function menuGoStep(dt) {
        const g = menu.going;
        if ((g.t += dt) < menuPushSecs(g.card)) return;
        menu.going = null;
        const l = g.card.level;
        if (l.key === 'settings' || l.key === 'memories' || l.key === 'board' || l.key === 'paddles') {
            if (l.key === 'board') fetchBoard();        // the tables as they are now, not as the game found them
            menuShow(l.key);
            menu.screen.from = g.x;
        }
        else menuEnter(l);
    }

    // back out of a level, the way it went in: the town pulling back out of
    // the door, and him walking out of it to stand at home under it
    function menuLeaveStep(dt) {
        const lv = menu.leaving;
        if ((lv.t += dt) < menuPushBack(lv.card)) return;
        paddle.x = paddle.tx = lv.x;
        menu.lift = 0;
        menu.leaving = null;
    }

    // engine.js asks, and leaves him undrawn while the town draws him: going
    // in or coming out (menuDrawPush), and in among the buildings the rest of
    // the time (menuDrawHim). Being asked is how the town knows it may.
    function menuPadHidden() {
        if (!menu || !menuUp() || menu.drawingHim) return false;
        if (menu.going || menu.leaving) return true;
        if (menu.screen || menuUnlockUp()) return false;
        menu.asked = true;
        return true;
    }

    // going in or coming back out, as one: the card, how far in (0 at the
    // door to 1 through it), and where he walks from or to
    function menuMotion() {
        if (menu.going) return { card: menu.going.card, k: menuClamp(menu.going.t / menuPushSecs(menu.going.card)), x: menu.going.x, y: menu.going.y, going: true };
        if (menu.leaving) return { card: menu.leaving.card, k: 1 - menuClamp(menu.leaving.t / menuPushBack(menu.leaving.card)), x: menu.leaving.x, y: padY() };
        return null;
    }
    // how near a thing in the town is: 0 on the CASTLE's row, 1 on the FARM's
    function menuNear(c) { return (c.y - M_TOWN[5].y) / (M_TOWN[1].y - M_TOWN[5].y); }

    // the camera, for something `near` deep, while he is going in or coming out
    function menuCamera(near) {
        const m = menuMotion();
        if (!m) return;
        if (m.card.level.key) {
            // into a sign's board, far enough for it, wide and short, to fill the screen both ways
            const G = menuHang(m.card), fx = m.card.x, fy = G.top + G.bh / 2;
            const S = 1 + Math.pow(menuBand(m.k, M_SIGN_ZOOM_FROM, 1), 3) * (Math.max(LW / G.bw, LH / G.bh) + 1);
            const s = Math.pow(S, Math.max(0.15, 1 + M_SIGN_PARALLAX * (near - menuNear(m.card))));
            const centre = menuEase(menuBand(m.k, M_SIGN_ZOOM_FROM - 0.05, 0.9));
            ctx.translate(menuLerp(fx, LW / 2, centre), menuLerp(fy, LH / 2, centre));
            ctx.scale(s, s);
            ctx.translate(-fx, -fy);
            return;
        }
        const d = menuDoorOf(m.card), fx = d.cx, fy = d.bot - d.h * 0.45;
        const S = 1 + Math.pow(menuBand(m.k, M_PUSH_ZOOM_FROM, 1), 3) * M_PUSH_DEPTH;
        // nearer than the door rushes past faster, further slower -- but it still comes
        const s = Math.pow(S, Math.max(0.15, 1 + M_PUSH_PARALLAX * (near - menuNear(m.card))));
        // the doorway drifts to the middle of the screen as it comes at you
        const centre = menuEase(menuBand(m.k, M_PUSH_ZOOM_FROM - 0.1, 0.9));
        ctx.translate(menuLerp(fx, LW / 2, centre), menuLerp(fy, LH / 2, centre));
        ctx.scale(s, s);
        ctx.translate(-fx, -fy);
    }

    // Each building's doorway is its own, like its cover: the FARM's barn doors,
    // the RUINS' cave of stalactites, the CITY's glass doors, the VOLCANO's cave mouth,
    // the CASTLE's pointed gate, a portal in the VOID's eye; the signs keep a
    // plain arch. A doorway that `grows` opens out of the floor (or, the VOID's,
    // out of its middle); the rest are there at once and something in them
    // opens (menuDoorLeaves).
    function menuDoorOf(c) {
        if (c.level === MENU_VOID) {
            const w = c.w * 0.56, h = c.h * 0.5;
            return { cx: c.x, bot: c.y + 3 + h / 2, w, h, cap: 'void', grows: true };
        }
        const h = c.level.small ? c.h * 0.8 : c.h * 0.42, cap = c.level.cap || 'arch';
        return { cx: c.x, bot: c.y + c.h / 2, w: Math.max(18, c.w * 0.26), h, cap,
                 grows: cap !== 'gable' && cap !== 'skyline' && cap !== 'crown' };
    }
    // The RUINS' cave mouth, across its top and back along its floor: each
    // [across, reach] -- how far across the doorway, and how far down from
    // the top (stalactites) or up from the floor (stalagmites), as shares of it.
    const M_RUIN_DRIPS = [[0.28, 0.22], [0.35, 0.03], [0.46, 0.32], [0.55, 0.04], [0.63, 0.18], [0.71, 0.02], [0.8, 0]];
    const M_RUIN_MITES = [[0.92, 0], [0.84, 0.2], [0.76, 0], [0.26, 0], [0.18, 0.26], [0.1, 0]];
    // the doorway's outline at `s` of its size, added to the path open (a new one if `fresh`)
    function menuDoorPath(d, s = 1, fresh = true) {
        const w = d.w * s, h = d.h * s, x0 = d.cx - w / 2, x1 = d.cx + w / 2, b = d.bot, cx = d.cx;
        if (fresh) ctx.beginPath();
        switch (d.cap) {
            case 'void':        // an eye, opening from its middle
                ctx.ellipse(cx, d.bot - d.h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
                break;
            case 'gable':       // barn doors: square
            case 'skyline':     // glass doors: tall and sharp
                ctx.moveTo(x0, b); ctx.lineTo(x0, b - h); ctx.lineTo(x1, b - h); ctx.lineTo(x1, b);
                break;
            case 'broken': {    // a cave in the old stone: stalactites down from the top, stalagmites up from the floor
                ctx.moveTo(x0, b); ctx.lineTo(x0, b - h * 0.6);
                ctx.quadraticCurveTo(x0, b - h * 0.97, x0 + w * 0.2, b - h);
                for (const [u, d] of M_RUIN_DRIPS) ctx.lineTo(x0 + w * u, b - h + h * d);
                ctx.quadraticCurveTo(x1, b - h * 0.97, x1, b - h * 0.6); ctx.lineTo(x1, b);
                for (const [u, d] of M_RUIN_MITES) ctx.lineTo(x0 + w * u, b - h * d);
                break;
            }
            case 'cone':        // a cave mouth
                ctx.moveTo(x0 + w * 0.02, b);
                ctx.bezierCurveTo(x0 - w * 0.12, b - h * 0.7, cx - w * 0.36, b - h * 1.04, cx - w * 0.04, b - h);
                ctx.bezierCurveTo(cx + w * 0.3, b - h * 1.06, x1 + w * 0.14, b - h * 0.55, x1 - w * 0.02, b);
                break;
            case 'crown':       // a pointed gate
                ctx.moveTo(x0, b); ctx.lineTo(x0, b - h * 0.55);
                ctx.quadraticCurveTo(x0 + w * 0.08, b - h * 0.8, cx, b - h);
                ctx.quadraticCurveTo(x1 - w * 0.08, b - h * 0.8, x1, b - h * 0.55); ctx.lineTo(x1, b);
                break;
            default: {          // a plain arch
                const r = Math.min(w / 2, h * 0.5);
                ctx.moveTo(x0, b); ctx.lineTo(x0, b - h + r); ctx.arc(cx, b - h + r, r, Math.PI, 0); ctx.lineTo(x1, b);
            }
        }
        ctx.closePath();
    }
    // what opens in a doorway that does not grow: barn doors swinging out,
    // glass panes sliding apart, a portcullis going up. `open` 0 shut, 1 open.
    function menuDoorLeaves(d, open, ink) {
        if (d.grows || open >= 1) return;
        const w = d.w, h = d.h, x0 = d.cx - w / 2, top = d.bot - h;
        ctx.save(); menuDoorPath(d); ctx.clip();
        if (d.cap === 'gable') {
            const lw = w / 2 * (1 - open);   // each leaf, foreshortened as it swings
            ctx.lineWidth = 1.2;
            for (const [lx, dir] of [[x0, 1], [x0 + w, -1]]) {
                const a = Math.min(lx, lx + dir * lw), b = Math.max(lx, lx + dir * lw);
                ctx.fillStyle = menuMix('#7a5a3a', ink, 0.25); ctx.fillRect(a, top, b - a, h);
                ctx.strokeStyle = '#4a3522'; ctx.strokeRect(a, top, b - a, h);
                ctx.beginPath(); ctx.moveTo(a, top); ctx.lineTo(b, d.bot); ctx.moveTo(b, top); ctx.lineTo(a, d.bot); ctx.stroke();
            }
        } else if (d.cap === 'skyline') {
            const slide = open * w / 2;
            for (const [px, dir] of [[x0, -1], [x0 + w / 2, 1]]) {
                const x = px + dir * slide;
                menuAlpha(0.4); ctx.fillStyle = ink; ctx.fillRect(x, top, w / 2, h);
                menuAlpha(0.8); ctx.strokeStyle = menuMix(ink, '#ffffff', 0.4); ctx.lineWidth = 1;
                ctx.strokeRect(x + 0.5, top + 0.5, w / 2 - 1, h - 1);
                ctx.beginPath(); ctx.moveTo(x + w * 0.1, top + h * 0.3); ctx.lineTo(x + w * 0.3, top + h * 0.1); ctx.stroke();
                menuAlpha(1);
            }
        } else if (d.cap === 'crown') {
            const up = open * h;
            ctx.strokeStyle = '#6d685f'; ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 1; i < 5; i++) { const x = x0 + w * i / 5; ctx.moveTo(x, top - up); ctx.lineTo(x, d.bot - up + 4); }
            for (let j = 1; j < 4; j++) { const y = top + h * j / 4 - up; ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); }
            ctx.stroke();
        }
        ctx.restore();
    }
    // The VOID's portal: two rings of him turning opposite ways round the edge
    // of the opening eye, glowing in its pale ink, with its light just inside
    // the rim. The rings thin out as you pass through them (`fade`).
    const M_PORTAL_RINGS = [{ n: 18, r: 1.06, spin: 1.2, len: 1.5, a: 0.9 }, { n: 12, r: 0.8, spin: -1.9, len: 1.3, a: 0.55 }];
    function menuPortal(d, size, fade) {
        if (size <= 0.02 || fade <= 0) return;
        const cy = d.bot - d.h / 2, rx = d.w / 2 * size, ry = d.h / 2 * size, T = menuNow(), ink = MENU_VOID.ink;
        const g = ctx.createRadialGradient(d.cx, cy, Math.min(rx, ry) * 0.4, d.cx, cy, Math.max(rx, ry) * 1.25);
        g.addColorStop(0, ink + '00'); g.addColorStop(0.75, ink + '55'); g.addColorStop(1, ink + '00');
        menuAlpha(fade);
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(d.cx, cy, rx * 1.3, ry * 1.3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        for (const ring of M_PORTAL_RINGS) for (let i = 0; i < ring.n; i++) {
            const a = T * ring.spin + i * 2 * Math.PI / ring.n;
            menuAlpha(ring.a * fade);
            menuLay(menuBody(ink, 'flat'), d.cx + Math.cos(a) * rx * ring.r, cy + Math.sin(a) * ry * ring.r,
                    2 * Math.PI * rx * ring.r / ring.n * ring.len, Math.atan2(Math.cos(a) * ry, -Math.sin(a) * rx), false, i % 2);
        }
        ctx.globalCompositeOperation = 'source-over';
        menuAlpha(1);
    }

    // The first screen of level n as the level will lay it (engine.js's
    // buildStage): its bricks, where they will be. Only levels.js has the
    // screens, so the boss lab, and a level that opens on its boss, show
    // the dark alone.
    function menuPreview(n) {
        const set = typeof LV_SETS !== 'undefined' && LV_SETS[n];
        const lvl = set && set[0];
        if (!lvl || lvl.boss) return;
        const cols = Math.max(...lvl.rows.filter(row => row[0] !== '>').map(row => row.length));
        const w = (LW - MARGIN * 2 - GAP * (cols - 1)) / cols, h = w / SHAPE_ASPECT;
        lvl.rows.forEach((row, r) => {
            const half = row[0] === '>';
            if (half) row = row.slice(1);
            for (let c = 0; c < cols; c++) {
                const ch = row[c];
                if (!ch || ch === '.') continue;
                const sp = ch === 'X' ? shapeSprite('X', STONE, w, h, 'statue') : shapeSprite(ch, brickColor(ch), w, h, false);
                if (sp) ctx.drawImage(sp, MARGIN + (c + (half ? 0.5 : 0)) * (w + GAP), TOP + r * (h + GAP), w, h);
            }
        });
    }

    // the doorway, what is through it, and him, going in or coming back out
    function menuDrawPush() {
        const m = menuMotion();
        if (!m) return;
        if (m.card.level.key) { menuDrawPushSign(m); return; }
        const c = m.card, d = menuDoorOf(c), k = m.k, ink = c.level.ink;
        const open = menuEase(menuBand(k, 0, 0.2)), walk = menuEase(menuBand(k, 0.05, M_PUSH_WALK));
        const size = d.grows ? open : 1;
        ctx.save();
        menuCamera(menuNear(c));
        menuDoorPath(d, size); ctx.fillStyle = M_FIELD; ctx.fill();
        // the level, already in there, drawn in the screen's own terms so it lands where it will be
        const lk = m.going ? menuEase(menuBand(k, M_PUSH_LEVEL_FROM, 1)) : 0;
        if (lk > 0 && size > 0) {
            ctx.save();
            menuDoorPath(d, size); ctx.clip();
            ctx.setTransform(menu.baseT);
            menuAlpha(lk);
            const sc = menuLerp(0.7, 1, lk);
            ctx.translate(LW / 2, LH / 2); ctx.scale(sc, sc); ctx.translate(-LW / 2, -LH / 2);
            menuPreview(c.level.n);
            ctx.restore();
            menuAlpha(1);
        }
        menuDoorLeaves(d, open, ink);
        if (d.cap === 'void') menuPortal(d, size, 1 - menuBand(k, 0.7, 0.95));
        menuDoorPath(d, size);
        if (d.cap === 'cone') { ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 3; menuAlpha(0.5); ctx.stroke(); menuAlpha(1); }
        ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.stroke();
        // him, cut to everything but the wall: outside the building, or in the doorway
        ctx.save();
        ctx.beginPath();
        ctx.rect(-LW, -LH, LW * 3, LH * 3);
        ctx.roundRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 6);
        menuDoorPath(d, 1, false);
        ctx.clip('evenodd');
        const w0 = padW() * menuShrinkAt(m.y);
        labPadIcon(LAB.pad, menuLerp(m.x, d.cx, walk), menuLerp(m.y, d.bot - d.h * 0.3, walk),
                   menuLerp(w0, d.w * 0.8, walk), false, 1 - menuBand(walk, 0.85, 1));
        ctx.restore();
        ctx.restore();
    }

    // into a sign: he fades where he stands, and the board he is pushed into
    // goes to the dark of the screen it opens as it fills it
    function menuDrawPushSign(m) {
        const c = m.card, G = menuHang(c), k = m.k;
        ctx.save();
        menuCamera(menuNear(c));
        const a = 1 - menuEase(menuBand(k, 0, M_SIGN_FADE));
        if (a > 0) labPadIcon(LAB.pad, m.x, m.y, padW() * menuShrinkAt(m.y), false, a);
        const dark = menuBand(k, M_SIGN_DARK_FROM, 1);
        if (dark > 0) { menuAlpha(dark); menuBoardPath(c, G.left, G.top, G.bw, G.bh); ctx.fillStyle = M_FIELD; ctx.fill(); menuAlpha(1); }
        ctx.restore();
    }

    // Into a level: its screens, the boss last (levels.js), or where there
    // are none -- the VOID, or the boss lab, which has no levels.js -- just
    // the boss. menuWatch keeps an eye on whether you had to buy it back.
    function menuEnter(level) {
        menuLoad();
        if (level.key === 'board') {
            menuSay('LEADERBOARD · COMING SOON');       // no worker to ask yet (menuBoardOn)
            menu.march = false;
            return;
        }
        if (level.n === 5 && !menuOpened()) {
            const short = MENU_LEVELS.length - menuProgress().keys.length;
            menuSay('THE CASTLE WANTS ' + short + (short === 1 ? ' MORE KEY' : ' MORE KEYS'));
            menu.march = false;             // the door is shut: he stops there
            return;
        }
        if (level.key === 'rush') { menu.cameFrom = level; menuRush(); return; }
        const boss = menuBossFor(level.n);
        if (!boss) { menuSay(level.name + ' · no boss is set to this stage'); return; }
        menu.cameFrom = level;      // the door he comes back out of (menuOpen)
        menu.arriveT = -1;          // walked in before the town finished arriving
        menu.run = { n: level.n, over: false, cont: false, out: 0 };
        menu.stood = menuStanding();
        best = menu.best[level.n] || 0;
        menuBoardRun();
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
    //
    // Each boss's END OF ROUND BONUS, in the order they come; the last is
    // a step bigger than the rest. Past the end of the list, the last again.
    const M_RUSH_PAYS = [1000, 2000, 3000, 4000, 5000, 7000];
    // ...or 0 outside BOSS RUSH, and the engine pays by the screen number
    function menuRoundBase() {
        if (!menu || !menu.run || menu.run.n !== M_RUSH) return 0;
        return M_RUSH_PAYS[Math.min(stage, M_RUSH_PAYS.length - 1)];
    }
    function menuRush() {
        const whos = MENU_ALL.map(l => menuBossFor(l.n)).filter(Boolean);
        if (typeof levelsRush !== 'function' || !whos.length) { menuSay('BOSS RUSH · not in here'); return; }
        menu.arriveT = -1;
        menu.run = { n: M_RUSH, over: false, cont: false, out: 0 };
        menu.stood = menuStanding();
        best = menu.best[M_RUSH] || 0;
        menuBoardRun();
        menu.march = false;
        LAB.mini = null;
        setHint(HINT_PLAY);
        levelsRush(whos);
        LAB.boss = whos[0];
        LAB.stageAt(0, false);
    }

    // A head went off the bottom. True means it cost nothing: there is nothing
    // to lose in the hub.
    // A run that loses one is no longer flawless (MENU_FLAWLESS_PADS).
    function menuLost() {
        if (menu && menu.run) menu.run.lost = true;
        return menuUp();
    }

    // END RUN in a level, or the CONTINUE clock running out: back to the town
    // with nothing but the score, which the town may ask your initials for
    // (menuBoardPost). True means the town took it.
    function menuQuit() {
        if (!menu || !menu.run) return false;
        const n = menu.run.n;
        menuBoardPost(menu.run);
        menuOpen();
        menuSay(menuName(n) + ' · NOT THIS TIME');
        return true;
    }

    // Runs every frame, hub or no hub -- it is what brings you back out of a
    // level and hands you what you earned. After a wall it is M_OUT on STAGE
    // CLEAR. After a boss it is his whole perish, to the last piece of him
    // faded (menuPerished), then M_BEAT -- so MEMORY UNLOCKED, or BOSS RUSH's
    // next boss, never cuts across him coming apart.
    const M_OUT = 2.6;
    const M_BEAT = 0.7;
    const M_PERISH_MAX = 12;         // seconds at most, whatever a boss has left falling
    function menuPerished(run, dt) {
        run.perish = (run.perish || 0) + dt;
        const c = bossFall;
        // a boss who does not come apart in pieces says when he is gone himself
        const own = labB && labB.perished ? labB.perished() : undefined;
        const gone = own !== undefined ? own : !c || !c.pieces || c.pieces.every(p => p.age >= F_GONE);
        if (!gone && run.perish < M_PERISH_MAX) return false;
        if ((run.out += dt) < M_BEAT) return false;
        run.perish = 0;
        return true;
    }
    // the first game's takeover -- you rising into his place -- is not this
    // game's: in a level, the fight's end holds on him coming apart
    function menuHoldsTakeover() { return !!(menu && menu.run); }

    // A boss down: his perish, then his end of round bonus (fourkeys' engine
    // only, eorHold), read and tapped away. True once all of that is done.
    // The boss lab's engine has no such screen, so it goes on at once.
    function menuBossPaid(run, dt) {
        if (run.bonus === 'read') return true;
        if (run.bonus) return false;
        if (!menuPerished(run, dt)) return false;
        if (typeof eorHold !== 'function') return true;
        run.bonus = 'up';
        eorHold();
        return false;
    }
    // ...the tap that takes it away
    function menuBonusRead() { if (menu && menu.run) menu.run.bonus = 'read'; }

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
        if (phase === 'ascend' && !menuBossPaid(run, dt)) return;
        // any screen but a level's last is cleared on the way to the next --
        // except a boss in BOSS RUSH, whose takeover leads straight into the
        // next one's entrance
        if (stage < LEVELS.length - 1) {
            if (phase !== 'ascend') return;
            menuSlew();
            run.out = 0;
            run.bonus = null;
            impact = null;
            bossFall = null;
            stage++;
            buildStage(stage);
            banner = '';
            return;
        }
        if (phase !== 'ascend' && (run.out += dt) < M_OUT) return;
        menu.run = null;
        menuBoardPost(run);
        menuBeatSlew(run, phase === 'ascend');
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
    // The memory winning this run's level would earn, by its id, or null:
    // asked at the killing blow, before menuBeat (or menuVoidMemory) hands it
    // over, so the boss can be seen letting it go (memShardDrop).
    function menuMemoryDue() {
        const run = menu && menu.run;
        if (!run || run.n === M_RUSH || menu.memFrom[run.n]) return null;
        return MENU_MEM_ORDER.find(k => !menu.mems[k]) || null;
    }

    // A boss that ends his level himself, rather than through the takeover (the
    // VOID's): what you earned, and back to the town. The VOID's end is the
    // end of the game, so the credits roll on the way.
    function menuWon() {
        const run = menu && menu.run;
        const rush = !!(menu && menu.keys[MENU_VOID.n]);
        const end = run && run.n === MENU_VOID.n ? [{ credits: true }].concat(rush ? [] : [{ rushCard: true }]) : [];
        if (run) { menuBoardPost(run); menuBeatSlew(run, true, end); }
        menuOpen();
    }

    // The VOID's memory, earned between its first part and its second and
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
        if (done) menuShowNext();
        else if (menuCutUp()) menuCutStep(dt);
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
        if (LEVELS[stage].boss) menuSlew();
        stage++;
        buildStage(stage);
        banner = '';
        return true;
    }

    // The debug menu's skip to boss: straight to a level's last screen from
    // either wall before it. Only the five town levels, whose last screen is
    // always their boss; the walls passed over are not beaten, so nothing is
    // counted for them.
    function menuSkipBoss() {
        if (!menuCanSkipBoss()) return false;
        menu.run.over = false;
        showCursor(false);
        stage = LEVELS.length - 1;
        buildStage(stage);
        banner = '';
        return true;
    }
    function menuCanSkipBoss() {
        return !!(menu && menu.run && menu.run.n >= 1 && menu.run.n <= MENU_LAST.n
                  && stage < LEVELS.length - 1);
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
        if (n === M_RUSH) { menuSay('BOSS RUSH · ' + fmtScore(score)); return true; }
        const which = n || menu.sel || 1;
        const level = MENU_ALL.find(l => l.n === which);
        if (!level) return false;
        // its memory is earned halfway through the fight (menuVoidMemory)
        // and its end is the credits; all a win keeps is its key, which
        // opens BOSS RUSH
        if (level === MENU_VOID) { menu.keys[level.n] = true; menuSave(); return true; }
        // nothing is said about it: the unlock screens that follow say it all
        menu.keys[level.n] = true;
        // the run keeps its best as it goes (menuBestIs); this is for the
        // lab's buttons, which win a level without one
        menu.best[level.n] = Math.max(menu.best[level.n] || 0, score || 0);
        // the stage's memory plays before any paddle is shown: after that
        // it is in MEMORIES
        menuNextMemory(level.n);
        // A paddle kept back says nothing
        if (clean && !menu.pads[level.pad]) menuAddPad(level.pad, true);
        if (!menu.pads[MENU_SOUVENIR]) menuAddPad(MENU_SOUVENIR, true);
        menuSave();
        return true;
    }

    // A boss beaten, anywhere: counted, and any paddle the count has come to
    // handed over. Progress from before bosses were counted had at least a
    // boss for each key, so the count starts from there. Returns the last
    // paddle it handed over, or null.
    function menuSlew() {
        const keys = MENU_ALL.filter(l => menu.keys[l.n]).length;
        menu.slain = Math.max(menu.slain || 0, keys) + 1;
        let got = null;
        for (const [at, pad] of MENU_SLAIN_PADS) if (menu.slain >= at && menuGive(pad)) got = pad;
        menuSave();
        return got;
    }
    // a paddle handed over with its PADDLE UNLOCKED card, or false if already had
    function menuGive(pad) {
        if (menu.pads[pad]) return false;
        menuAddPad(pad, true);
        return true;
    }
    // A run's end, won. A flawless win's paddle and whatever its last boss
    // buys come after menuBeat and after `end` (the VOID's credits), so they
    // are shown last.
    function menuBeatSlew(run, boss, end) {
        menuBeat(!run.cont, run.n);
        if (end) menu.shows.push(...end);
        const flawless = MENU_FLAWLESS_PADS[run.n];
        if (flawless && !run.cont && !run.lost && menuGive(flawless)) menuSave();
        if (boss) menuSlew();
    }

    // back to the hub: an empty field with the town on it
    function menuOpen() {
        menuLoad();
        menu.run = null;
        // whatever the run put up in the town gets its card, last of all
        if (menu.stood) {
            for (const c of menu.cards || []) {
                if (M_OWN_CARD.includes(c.level.key) || menu.stood.includes(c.level) || !menuStands(c)) continue;
                menu.shows.push({ buildCard: c.level });
            }
            menu.stood = null;
        }
        if (typeof levelsUse === 'function') levelsUse();    // the town stands on the engine's own
        LAB.boss = null;
        LAB.mini = 'menu';
        LAB.stageAt(0, true);
        setHint(M_HINT);
        // out of the door he went in by, if the building is still standing
        const c = menu.cameFrom && menu.cards.find(o => o.level === menu.cameFrom && menuStands(o));
        menu.cameFrom = null;
        if (c) {
            const hs = halfSpan();
            menu.leaving = { card: c, t: 0, x: Math.max(hs, Math.min(LW - hs, c.x)) };
            menu.lift = 0;
        }
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
            menuDashStep(dt);
            // the pick may have been BACK, and the screen gone with it
            if (!menu.screen) return;
            if (menu.screen.kind === 'memory') menuCutStep(dt);
            if (menu.screen && menu.screen.kind === 'memory' && over(menu.screen.n, menu.screen.t)) menuShow('memories');
            return;
        }
        // the initials and the table after them are the engine's, over the town
        if (phase === 'initials' || phase === 'scores') { menu.march = false; return; }
        if (menu.post && menu.post.ready) { menuBoardAsk(); return; }
        if (menu.leaving) { menu.march = false; menuLeaveStep(dt); return; }
        if (menu.going) { menuGoStep(dt); return; }
        menuDustStep(dt);
        if (menu.sayT > 0) menu.sayT = Math.max(0, menu.sayT - dt);
        menuSwapStep(dt);
        menuMarch(dt);
        if (menuArriving()) menuArriveStep(dt);
    }

    // ---- arriving -----------------------------------------------------------------------
    // Out of the opening cards, the town comes into view as if he were walking
    // into it, pacing on the spot: WALK IN. The horizon, the sky and the army
    // on it are infinitely far and are there from the first frame. Everything
    // on the ground is seen from M_ARRIVE_BACK further back and comes to where
    // it belongs, each at the rate its distance says -- one projection for the
    // ground's bands and the buildings alike, so the ground streams toward him
    // and they ride in on it: near ones sweep in, the far row hardly moves.
    // The ground he crosses to reach the town is the town's own, carried on.
    // He is yours from the first frame of it: the town is where it will be,
    // only not drawn there yet, so a walk started now arrives at the building
    // it is aimed at.
    const ARRIVE_SECS = 1.5;
    const M_ARRIVE_BACK = 6;         // how far back he starts, in lengths of the nearest ground (the gates' foot)
    const M_SIGN_FEET = 80 + 45 + 4; // the four signs ride at the depth of the big two's posts, together
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

    // A point on the ground's depth, from where it is on the screen once he has
    // arrived; and how much further back he still is, `k` of the way in. A
    // thing at depth z is drawn z / (z + d) of its size, out of the horizon's middle.
    const menuDepth = y => 1 / Math.max(1, y - M_HORIZON);
    const menuArriveBack = k => M_ARRIVE_BACK * menuDepth(M_GATE.y + M_GATE.h) * (1 - k);

    // draw one building as it would be `k` of the way in
    function menuArriveCard(c, k, draw) {
        if (k >= 1) { draw(); return; }
        const z = menuDepth(c.level.key ? M_SIGN_FEET : c.y + c.h / 2), s = z / (z + menuArriveBack(k));
        ctx.save();
        ctx.globalAlpha = Math.min(1, k * 4);
        ctx.translate(LW / 2, M_HORIZON);
        ctx.scale(s, s);
        ctx.translate(-LW / 2, -M_HORIZON);
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
    // A gate goes through once a lean: to go again you step back off the
    // wall by SWAP_BACKOFF and lean again. Holding still would otherwise flip through
    // the rack, or stall on the first shorter paddle, whose end no longer
    // reaches where the hand is. The spent gate slides back out through its
    // wall, and slides in again once it can be leaned on. A gate whose paddle
    // changes does the same, quicker, and comes back with the new name.
    // Leaning while walking up the town does nothing: the gates are at home.
    const SWAP_HOLD = 0.85;          // pinned against the wall before he goes
    const SWAP_OUT = 0.26;           // him walking off
    const SWAP_IN = 0.34;            // the next one arriving
    const SWAP_PEEK = 52;            // how far in the next one noses while you hold
    const SWAP_CLEAR = 12;           // and how far past the wall they go
    const SWAP_BACKOFF = 24;         // px the hand comes back off where it leaned before that gate opens again
    const GATE_SLIDE = 0.32;         // a spent gate going, or coming back
    const GATE_QUICK = 0.14;         // each way, for a gate trading one name for the next

    function menuNextPad(side) {
        const owned = MENU_PADS.filter(k => menu.pads[k]);
        if (owned.length < 2) return null;
        const i = owned.indexOf(LAB.pad);
        return owned[((i < 0 ? 0 : i) + side + owned.length) % owned.length];
    }

    function menuSwapStep(dt) {
        for (const side of [-1, 1]) {
            const next = menuNextPad(side);
            if (!(side in menu.gateTo)) menu.gateTo[side] = next;
            const changing = next !== menu.gateTo[side];
            if (changing) menu.gateQuick[side] = true;
            const to = menu.spent === side || changing ? 0 : 1, v = menu.gate[side];
            const step = dt / (menu.gateQuick[side] ? GATE_QUICK : GATE_SLIDE);
            menu.gate[side] = to ? Math.min(1, v + step) : Math.max(0, v - step);
            if (menu.gate[side] === 0 && changing) menu.gateTo[side] = next;
            // a spent gate comes back at its own pace, whatever it went out at
            if (menu.gate[side] === 1 || (menu.gate[side] === 0 && menu.spent === side)) menu.gateQuick[side] = false;
        }
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
        if (menu.spent) {
            // measured from where the hand was as well as from the wall: a
            // shorter paddle moves the wall's reach out from under a hand held
            // still, and a longer one pushes a hand pressed on the wall inward
            menu.spentX = menu.spent < 0 ? Math.min(menu.spentX, paddle.tx) : Math.max(menu.spentX, paddle.tx);
            const off = (paddle.tx - menu.spentX) * -menu.spent;
            if (off >= SWAP_BACKOFF && side !== menu.spent) menu.spent = 0;
            else { menu.side = 0; menu.hold = 0; return; }
        }
        if (side !== menu.side) { menu.side = side; menu.hold = 0; }
        if (!side || menu.lift > 1 || !menuNextPad(side)) { menu.hold = 0; return; }
        if ((menu.hold += dt) < SWAP_HOLD) return;
        menu.sw = { side, to: menuNextPad(side), from: paddle.x, t: 0, out: true };
        menu.hold = 0;
        menu.spent = side;
        menu.spentX = paddle.tx;
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
    // The town is drawn the way the characters are: in the game's two pictures,
    // his body and his head, and little else. Every building is a plain dark
    // shape with a rim of its color and ONE thing made of him that is its own
    // (M_HERALDS), big enough to read as him. Nothing is ever darkened toward
    // black to say it is asleep: it goes toward slate (M_SLATE) instead.
    function menuPanel(x, y, w, h, on, ink) {
        ctx.fillStyle = 'rgba(0,0,0,0.82)';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 8);
        ctx.fill();
        ctx.strokeStyle = on ? (ink || '#c9a94e') : '#2e2a24';
        ctx.lineWidth = on ? 2 : 1;
        ctx.stroke();
    }

    // The town's contrast (CRISP): its shapes a deep dark on a dark ground, so
    // they stand on it rather than sinking into a haze; a rim at rest only
    // M_RIM_REST of the way to the dark, and words at rest bright enough to read.
    const M_DARK = '#14110e';        // what a color dims toward
    const M_FILL = '#090806';        // every building's, sign's and gate's own shape
    const M_RIM_REST = 0.3;          // how far a rim is toward the dark while he is elsewhere
    const M_WORD_REST = '#c3bfb8';   // a name or a best while he is elsewhere
    const M_SLATE = '#6b665d';       // where a color goes while he is elsewhere
    const M_EMPTY = '#3a362f';       // a key not won yet
    const M_RISE_IN = 3, M_RISE_OUT = 2;   // per second a building lights as he lines up, and goes back
    // Each building keeps a clock of its own (c.stir) that everything moving
    // on it runs by, and it runs up to 1 + M_STIR times as fast while lit: a
    // stir, not a spin-up. Times of day multiplied by a speed that changes
    // would lurch everything a long way forward the moment he lined up.
    const M_STIR = 0.6;
    const M_KEY_TURN = 0.8;          // radians a second a lit key's flower turns
    const menuClamp = x => Math.max(0, Math.min(1, x));
    const menuEase = x => { x = menuClamp(x); return x * x * (3 - 2 * x); };
    const menuLerp = (a, b, k) => a + (b - a) * k;
    const menuNow = () => performance.now() / 1000;
    function menuHash(n) { const h = Math.sin(n * 12.9898) * 43758.5453; return h - Math.floor(h); }
    function menuMix(a, b, t) {
        const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
        const A = p(a), B = p(b);
        return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
    }
    // a fixed random number for card c, the same every frame
    function menuSeeded(c, i) { return menuHash(c.x * 13.1 + c.y * 7.7 + i * 1.618); }

    // Alpha is multiplied into whatever the card is being drawn at, so the
    // town's arrival (menuArriveCard) still fades everything in together.
    function menuAlpha(a) { ctx.globalAlpha = menu.a0 * a; }

    // him lying down, baked once: 'wash' is the bricks' own (lifted gray with
    // the color over it, so his shape still shows), 'flat' one solid color
    function menuBody(color, mode) {
        const k = 'mBody' + mode + color;
        if (spriteCache.has(k)) return spriteCache.get(k);
        if (!ready(paddleImg)) return null;
        const w = 240, h = Math.round(240 / SHAPE_ASPECT);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        placeShape(g, w, h, mode === 'wash');
        g.globalCompositeOperation = 'source-atop';
        g.globalAlpha = mode === 'wash' ? 0.8 : 1;
        g.fillStyle = color;
        g.fillRect(0, 0, w, h);
        spriteCache.set(k, c);
        return c;
    }
    // his head, baked once: 'flat', 'wash' as above, 'stone' flat with a pale
    // whisper of his face, 'rock' with his face multiplied in as shading, and
    // 'raw', the photograph
    function menuHead(color, mode) {
        const k = 'mHead' + mode + color;
        if (spriteCache.has(k)) return spriteCache.get(k);
        if (!ready(ballImg)) return null;
        const w = ballImg.naturalWidth, h = ballImg.naturalHeight;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        if (mode === 'wash') g.filter = 'grayscale(1) contrast(1.1) brightness(1.95)';
        g.drawImage(ballImg, 0, 0, w, h);
        g.filter = 'none';
        if (mode !== 'raw') {
            g.globalCompositeOperation = mode === 'wash' ? 'source-atop' : 'source-in';
            g.globalAlpha = mode === 'wash' ? 0.8 : 1;
            g.fillStyle = color;
            g.fillRect(0, 0, w, h);
            g.globalAlpha = 1;
        }
        if (mode === 'rock') {
            g.globalCompositeOperation = 'multiply';
            g.filter = 'grayscale(1) contrast(1.4) brightness(1.25)';
            g.drawImage(ballImg, 0, 0, w, h);
            g.filter = 'none';
            g.globalCompositeOperation = 'destination-in';
            g.drawImage(ballImg, 0, 0, w, h);
        }
        if (mode === 'stone') {
            g.globalCompositeOperation = 'source-atop';
            g.globalAlpha = 0.5;
            g.filter = 'grayscale(1) contrast(1.2) brightness(1.5)';
            g.drawImage(ballImg, 0, 0, w, h);
            g.filter = 'none';
        }
        spriteCache.set(k, c);
        return c;
    }
    // him at (x, y), `len` long, turned `a`; stood on end, and mirrored, on request
    function menuLay(img, x, y, len, a, standing, flip) {
        if (!img) return;
        const th = len / SHAPE_ASPECT;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a + (standing ? -Math.PI / 2 : 0));
        if (flip) ctx.scale(1, -1);
        ctx.drawImage(img, -len / 2, -th / 2, len, th);
        ctx.restore();
    }
    function menuPutHead(img, x, y, w) {
        if (img) ctx.drawImage(img, x - w / 2, y - w * (BALL_RY / BALL_RX) / 2, w, w * (BALL_RY / BALL_RX));
    }

    // What makes a building that level's: a roofline over the box it is drawn
    // on. All five are a few straight lines -- the town is meant to read at a
    // glance from the other end of the field, not to be looked at closely.
    const ROOF_H = 22;

    // the roofline, added to whatever path is open
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
            case 'crown':           // crenellations
                for (let i = 0; i < 5; i++) {
                    const bw = w / 9;
                    ctx.rect(x + w * 0.06 + i * bw * 1.75, top + 6, bw, ROOF_H - 6);
                }
                ctx.rect(x, y - 8, w, 8);
        }
    }
    // the whole building, roof and all, as one path
    function menuOutline(c, r = 6) {
        ctx.beginPath();
        ctx.roundRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, r);
        ctx.closePath();
        if (c.level.cap) menuCapPath(c);
    }
    const menuTopOf = c => c.y - c.h / 2 - (c.level.cap ? ROOF_H : 0);
    // slate while he is elsewhere, its own color as he lines up
    const menuAround = st => st.covered ? M_EMPTY : menuMix(st.ink, M_SLATE, 0.45 * (1 - st.rise));
    // stood in the doorway: how full it is, 0..1
    function menuDoorK(c) { return menu.into && menu.into.card === c ? Math.min(1, menu.into.t / DOOR_HOLD) : 0; }

    // The building itself: its shape, dark, a rim of its color that lights
    // as he lines up, and the doorway filling from the floor while he stands
    // in it. `shape` is a smaller card to draw in its place (the boards' plate).
    function menuSilhouette(c, st, shape = c) {
        menuOutline(shape);
        ctx.fillStyle = M_FILL; ctx.fill();
        ctx.strokeStyle = menuMix(st.ink, M_DARK, M_RIM_REST * (1 - st.rise));
        ctx.lineWidth = 1 + st.rise;
        ctx.stroke();
        const k = menuDoorK(c);
        if (k) {
            ctx.save(); menuOutline(shape); ctx.clip();
            menuAlpha(0.45); ctx.fillStyle = st.ink;
            ctx.fillRect(shape.x - shape.w / 2, shape.y + shape.h / 2 - (shape.h + ROOF_H) * k, shape.w, (shape.h + ROOF_H) * k);
            ctx.restore();
            menuAlpha(1);
        }
    }

    // a building lights over a moment as he lines up with it, and goes back as he leaves
    function menuRiseStep() {
        const t = menuNow(), dt = Math.min(0.1, t - (menu.drawT || t));
        menu.drawT = t;
        for (const c of menu.cards) {
            c.rise = menuClamp((c.rise || 0) + (menuAimed(c) ? dt * M_RISE_IN : -dt * M_RISE_OUT));
            c.stir = (c.stir || 0) + dt * (1 + M_STIR * c.rise);
            c.turn = (c.turn || 0) + dt * M_KEY_TURN * c.rise;
        }
    }
    function menuState(c) {
        const l = c.level, shut = l.n === 5 && !menuOpened();
        return { aimed: menuAimed(c), rise: c.rise || 0, shut, covered: false,
                 ink: shut ? '#6a655c' : l.ink, best: menu.best[l.n] || 0 };
    }

    // ---- the keys: a sigil for each boss ----------------------------------------------
    // Each level's key is its boss, drawn in a few of him and a head, in shades
    // of the level's own color. Not won yet it is the same sigil in slate, so
    // a door says what is behind it from the start. On the CASTLE the four sit
    // smaller, in a row.
    const M_FIRE = '#e0702f';
    const M_ASHLAR = ['#a39a86', '#968c78', '#aaa18c', '#8e8674', '#9d9483', '#8a8470'];   // idol.js's stone
    // the IDOL's chunk, shares of the picture, running off the right of it:
    // the fight wears him down from the outside in
    const M_IDOL_BITE = [[1.05, 0.4], [0.86, 0.42], [0.74, 0.5], [0.7, 0.58], [0.74, 0.64],
                         [0.68, 0.72], [0.8, 0.8], [1.05, 0.82]];
    // The IDOL as the fight has him: his head under a coat of him laid in
    // courses like stone, coarser than the fight's so it reads at a key's
    // size, with one chunk knocked off the edge and his face gray under it.
    function menuIdolHead() {
        const k = 'mIdol';
        if (spriteCache.has(k)) return spriteCache.get(k);
        if (!ready(ballImg) || !ready(paddleImg)) return null;
        const W = 282, H = 418;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const g = c.getContext('2d');
        g.drawImage(ballImg, 0, 0, W, H);
        g.globalCompositeOperation = 'source-atop';
        const bite = new Path2D();
        M_IDOL_BITE.forEach(([u, v], i) => i ? bite.lineTo(u * W, v * H) : bite.moveTo(u * W, v * H));
        bite.closePath();
        const rest = new Path2D();
        rest.rect(0, 0, W, H);
        rest.addPath(bite);
        g.fillStyle = '#6f685b';
        g.fill(rest, 'evenodd');
        let seed = 7 * 7919 + 13;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        const ch = H * 0.13, cw = ch * SHAPE_ASPECT;
        for (let row = 0, y = ch / 2; y < H + ch; row++, y += ch * 0.6) {
            for (let bx = (row % 2 ? -cw / 2 : 0) - rnd() * cw * 0.2; bx < W + cw; bx += cw * 0.8) {
                const px = bx + cw / 2, py = y + (rnd() - 0.5) * ch * 0.15, tone = M_ASHLAR[(rnd() * 6) | 0], a = (rnd() - 0.5) * 0.12;
                if (g.isPointInPath(bite, px, py)) continue;
                g.save(); g.translate(px, py); g.rotate(a); g.drawImage(menuBody(tone, 'wash'), -cw / 2, -ch / 2, cw, ch); g.restore();
            }
        }
        g.save(); g.clip(bite);
        g.filter = 'grayscale(1) brightness(1.05)'; g.drawImage(ballImg, 0, 0, W, H); g.filter = 'none';
        g.restore();
        spriteCache.set(k, c);
        return c;
    }
    // A torch's flame: three tongues, one inside the next, leaning and
    // stretching on slow beats of their own. Its brightness holds, so it never flashes.
    function menuFlame(x, y, w, h, t) {
        const tongue = (k, ink, a) => {
            const hh = h * k * (0.9 + 0.08 * Math.sin(t * 5.3) + 0.05 * Math.sin(t * 8.1 + 1));
            const ww = w * k, sway = Math.sin(t * 3.1) * w * 0.35 * k;
            menuAlpha(a); ctx.fillStyle = ink;
            ctx.beginPath(); ctx.moveTo(x, y + ww * 0.35);
            ctx.bezierCurveTo(x - ww, y + ww * 0.2, x - ww * 0.7, y - hh * 0.5, x + sway, y - hh);
            ctx.bezierCurveTo(x + ww * 0.7, y - hh * 0.5, x + ww, y + ww * 0.2, x, y + ww * 0.35);
            ctx.fill();
        };
        ctx.globalCompositeOperation = 'lighter';
        tongue(1, M_FIRE, 0.75); tongue(0.66, '#f2a93e', 0.8); tongue(0.36, '#fff1d6', 0.7);
        ctx.globalCompositeOperation = 'source-over'; menuAlpha(1);
    }
    // LAMPS's key: his two campfires side by side, walls outward, as his
    // fight has them -- each three stone brandons, one stood against the
    // wall, one leaned in on it, one across their feet.
    const M_CAMP_FOOT = 0.19;        // a fire's feet either side of its middle, of a log
    const M_CAMP_LEAN = 0.45;        // rad the leaning log leans in by
    const M_CAMP_BASE = [0.56, 0.52];   // the log across their feet: of a log, and rad its inner end is raised
    // one fire, its feet on `foot`, `wall` the side its upright log is on
    function menuCampfire(fx, foot, L, wall, b, mode, t) {
        const F = L * M_CAMP_FOOT;
        const logs = [{ x: fx + wall * F, y: foot - L / 2, a: -Math.PI / 2 },
                      { x: fx - wall * (F - L / 2 * Math.sin(M_CAMP_LEAN)), y: foot - L / 2 * Math.cos(M_CAMP_LEAN),
                        a: -Math.PI / 2 + wall * M_CAMP_LEAN }];
        if (mode !== 'flat') menuFlame(fx, foot - L * 0.05, L * 0.16, L * 0.62, t);
        for (const g of logs) menuLay(b, g.x, g.y, L, g.a, false, false);
        const [bl, tilt] = M_CAMP_BASE;
        menuLay(b, fx, foot - L * 0.04, L * bl, wall * tilt * 0.35, false, false);
        if (mode !== 'flat') menuFlame(fx - wall * F * 0.3, foot - L * 0.08, L * 0.1, L * 0.4, t + 0.8);
    }
    function menuVolcanoKey(x, y, s, b, mode) {
        const t = menuNow(), foot = y + s * 0.46;
        for (const side of [-1, 1]) menuCampfire(x + side * s * 0.25, foot, s * 0.56, side, b, mode, t + side * 1.7);
    }

    // level n's sigil, `s` px across, in `ink` (M_EMPTY for one not won); `turn` spins the flower
    function menuSigil(n, x, y, s, ink, turn) {
        const mode = ink === M_EMPTY ? 'flat' : 'wash';
        const b = menuBody(ink, mode), h = menuHead(ink, mode);
        switch (n) {
            case 1: {   // WINDMILL: one of its flowers, his head on five petals, on a stem, a head for its leaf
                const hw = s * 0.3, R0 = hw * 0.45, L = s * 0.4;
                const stem = mode === 'flat' ? ink : menuMix(ink, '#1c2a14', 0.35);
                ctx.strokeStyle = stem;
                ctx.lineWidth = Math.max(1.2, s * 0.045);
                ctx.beginPath(); ctx.moveTo(x + s * 0.2, y - s * 0.62); ctx.quadraticCurveTo(x + s * 0.36, y - s * 0.25, x, y); ctx.stroke();
                // the leaf, its crown pointing up and away off the stem
                ctx.save(); ctx.translate(x + s * 0.34, y - s * 0.38); ctx.rotate(-0.5 + Math.PI / 2);
                menuPutHead(menuHead(stem, mode), 0, 0, s * 0.11);
                ctx.restore();
                for (let i = 0; i < 5; i++) {
                    const a = turn + i * 2 * Math.PI / 5 - Math.PI / 2;
                    menuLay(b, x + Math.cos(a) * (R0 + L / 2), y + Math.sin(a) * (R0 + L / 2), L, a, false, i % 2);
                }
                menuPutHead(mode === 'flat' ? h : menuHead(menuMix(ink, '#ffffff', 0.2), 'wash'), x, y, hw);
                break;
            }
            case 2:     // IDOL: his head in its coat of stone, the statues' pale rim round it
                if (mode === 'flat') { menuPutHead(h, x, y, s * 0.52); break; }
                menuPutHead(menuHead(STONE_RIM, 'flat'), x, y, s * 0.52 + Math.max(2, s * 0.05));
                menuPutHead(menuIdolHead(), x, y, s * 0.52);
                break;
            case 3:     // TWINS: a big one and a small one, feet level
                menuPutHead(h, x - s * 0.17, y - s * 0.03, s * 0.4);
                menuPutHead(h, x + s * 0.23, y + s * 0.09, s * 0.28);
                break;
            case 4:     // LAMPS: his two campfires
                menuVolcanoKey(x, y, s, b, mode);
                break;
            case 5: {   // GLEEOK: three heads on three short necks out of one collar
                const cy = y + s * 0.46;
                [-0.75, 0, 0.75].forEach((d, i) => {
                    const a = -Math.PI / 2 + d, L = s * (i === 1 ? 0.4 : 0.34), r = L + s * 0.16;
                    menuLay(b, x + Math.cos(a) * L / 2, cy + Math.sin(a) * L / 2, L, a, false, i % 2);
                    menuPutHead(h, x + Math.cos(a) * r, cy + Math.sin(a) * r, s * 0.26);
                });
                break;
            }
            case 6:     // LUCIFER: a head between two wings, two of him each
                for (const side of [-1, 1]) [[0.45, 0.5], [0.05, 0.4]].forEach(([d, l]) => {
                    const a = side < 0 ? Math.PI + d : -d, L = s * l;
                    const sx = x + side * s * 0.1, sy = y + s * 0.02;
                    menuLay(b, sx + Math.cos(a) * L / 2, sy + Math.sin(a) * L / 2, L, a, false, side < 0);
                });
                menuPutHead(h, x, y + s * 0.04, s * 0.24);
                break;
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
        menuRiseStep();
        const asked = menu.asked;          // the engine left him to us this frame
        menu.asked = false;
        // the field's own transform, for anything drawn in the screen's terms under the camera
        menu.baseT = ctx.getTransform();
        menuDrawGround(k);
        ctx.globalAlpha = 1;
        // the gates are at the front of the town, under anything that passes them
        ctx.save(); menuCamera(M_NEAR_GROUND);
        ctx.globalAlpha = k;
        menu.a0 = k;
        for (const side of [-1, 1]) {
            // in from off the wall with a little overshoot, and out the same way backwards
            const v = menu.gate[side];
            if (v <= 0) continue;
            const c1 = 1.70158, e = 1 + (c1 + 1) * Math.pow(v - 1, 3) + c1 * Math.pow(v - 1, 2);
            ctx.save();
            ctx.translate(side * (M_GATE.w + 6) * (1 - e), 0);
            menu.a0 = k * Math.min(1, v * 2); ctx.globalAlpha = menu.a0;
            menuDrawGate(side);
            ctx.restore();
        }
        menu.a0 = k; ctx.globalAlpha = k;
        ctx.restore();
        ctx.globalAlpha = 1;
        menu.a0 = 1;
        // Back to front by where each stands on the ground, and him among them
        // by where his feet are: a building whose foot is nearer than his is
        // drawn over him, so walking up past the FARM puts him behind its windmill.
        const feet = padY() + padH() * menuShrinkAt(padY()) / 2;
        let him = !asked || !!menuMotion();
        for (const c of menu.cards.filter(menuStands).sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2))) {
            if (!him && c.y + c.h / 2 > feet) { menuDrawHim(); him = true; }
            menuArriveCard(c, k, () => {
                ctx.save(); menuCamera(menuNear(c));
                menu.a0 = ctx.globalAlpha; menuDrawLevel(c); ctx.globalAlpha = menu.a0;
                ctx.restore();
            });
        }
        if (!him) menuDrawHim();
        menuDrawPush();
        if (k < 1 || menuMotion()) return;
        menuPadPeek();
        menuDrawLine();
        // every level's best added up, along the floor under him, once there is one
        const total = menuBestTotal();
        if (total > 0) text('TOTAL HIGH SCORE ' + total, LW / 2, M_TOTAL_Y, 12, '#8d877d', 'center');
    }
    const M_TOTAL_Y = 592;

    // ---- the ground and the sky --------------------------------------------------------
    // What the town stands on, under the town's own rules: flat, thin, dark,
    // sparse, slow, nothing that flashes. Each part sits at its own depth, so
    // PUSH IN rushes it past like everything else.
    //
    // Depth is one idea throughout: he shrinks as he walks up the town, to
    // M_FAR_SIZE of himself at the far row, drawn smaller only (his box is
    // his box), and a building whose foot is nearer than his feet is drawn
    // over him.
    const M_HORIZON = 60;            // the far edge of the town, where it arrives from
    const M_SKY_LINE = '#211d19';    // the horizon's line, the faintest there is
    const M_GROUND = '#0a0807';      // the ground under it, a shade off the black sky
    const M_BAND_NEAR = 40;          // px, the ground's band at his feet...
    const M_BAND_FAR = 6;            // ...and at the horizon, easing between
    const M_BAND_TONE = 0.14;        // the lighter bands, this far from the ground toward slate
    const M_WARM = 0.22;             // the warm light's strength, in the sky only
    const M_FAR_SIZE = 0.62;         // his size at the far row
    const M_ARMY = 40, M_ARMY_PACE = 9, M_ARMY_STEP = 5.5;   // the distant army: how many, px a second, steps a second
    const M_ARMY_INK = '#29241f';

    // The bands' edges as depths, bottom band first: M_BAND_NEAR px thick at
    // the bottom of the screen easing to M_BAND_FAR at the horizon, carried on
    // nearer than the screen, at the nearest spacing, for as far back as an
    // arrival starts -- the ground he crosses to reach the town.
    let menuBandZ = null;
    function menuBandDepths() {
        if (menuBandZ) return menuBandZ;
        const zs = [];
        for (let y = LH + 40; y > M_HORIZON && zs.length < 400;) {
            zs.push(menuDepth(y));
            y -= Math.max(1, menuLerp(M_BAND_NEAR, M_BAND_FAR, menuClamp((LH - y) / (LH - M_HORIZON))));
        }
        const dz = zs[1] - zs[0], nearer = [];
        for (let z = zs[0] - dz; z > zs[0] - menuArriveBack(0) - dz * 2; z -= dz) nearer.unshift(z);
        if (nearer.length % 2) nearer.shift();           // whole bands only, so the stripes keep their order
        return (menuBandZ = nearer.concat(zs));
    }

    // how big he is drawn with his middle at y: 1 at home, M_FAR_SIZE at the far row's feet
    function menuShrinkAt(y) {
        const far = M_TOWN[5].y + M_TOWN[5].h / 2;
        return Math.max(0.2, 1 - (1 - M_FAR_SIZE) * (PADDLE_Y - y) / (PADDLE_Y - far));
    }

    function menuDrawGround(k) {
        const T = menuNow();
        const layer = (near, fn) => { ctx.save(); menuCamera(near); fn(); ctx.restore(); };
        // a warm light low over the far end of the town, the DAYBREAK the town was built from
        layer(M_NEAR_SKY, () => {
            const g = ctx.createRadialGradient(LW / 2, 60, 10, LW / 2, 60, 420);
            g.addColorStop(0, 'rgba(74,50,34,' + M_WARM + ')'); g.addColorStop(1, 'rgba(74,50,34,0)');
            // the sky only: on the ground it lifts the dark to the buildings' own and they sink into it
            ctx.fillStyle = g; ctx.fillRect(-LW, -LH, LW * 3, LH + M_HORIZON);
        });
        // the ground, and the line where it meets the sky
        layer(M_NEAR_SKY, () => {
            ctx.fillStyle = M_GROUND; ctx.fillRect(-LW, M_HORIZON, LW * 3, LH * 2);
            ctx.strokeStyle = M_SKY_LINE; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-LW, M_HORIZON); ctx.lineTo(LW * 2, M_HORIZON); ctx.stroke();
        });
        // the ground in bands, every other one a shade lighter, thinner further
        // back, streaming toward him while he arrives
        layer(0.2, () => {
            const zs = menuBandDepths(), d = menuArriveBack(k);
            const yOf = z => z + d <= 0 ? LH + 100 : Math.min(LH + 100, M_HORIZON + 1 / (z + d));
            ctx.fillStyle = menuMix(M_GROUND, '#4a433a', M_BAND_TONE);
            for (let i = 0; i + 1 < zs.length; i += 2) {
                const bot = yOf(zs[i]), top = Math.max(M_HORIZON, yOf(zs[i + 1]));
                if (bot > M_HORIZON && top < LH) ctx.fillRect(-LW, top, LW * 3, bot - top);
            }
        });
        // the army that ends the first game, marching past on the horizon, in
        // step, showing in the gaps between the far buildings
        layer(M_NEAR_SKY - 0.2, () => {
            const gap = (LW + 60) / M_ARMY, img = menuBody(M_ARMY_INK, 'flat');
            for (let i = 0; i < M_ARMY; i++) {
                const x = ((i * gap + T * M_ARMY_PACE) % (LW + 60)) - 30, step = Math.sin(T * M_ARMY_STEP + i * 0.4);
                const len = 13 + menuHash(i + 99) * 2;
                menuLay(img, x, M_HORIZON - len / 2 - Math.abs(step) * 1.2, len, step * 0.06, true, i % 2);
            }
        });
        // each level's foundation: a circle on the ground, flatter further back,
        // lit in its color as he lines up with it
        for (const c of menu.cards) {
            if (c.level.key || !menuStands(c)) continue;
            const near = menuNear(c);
            menuArriveCard(c, k, () => {
                ctx.save(); menuCamera(near);
                const r = c.rise || 0, feet = c.level === MENU_VOID ? c.y + c.h * 0.35 : c.y + c.h / 2;
                const rx = c.w * (c.level === MENU_VOID ? 0.75 : 0.62), ry = rx * menuLerp(0.16, 0.3, menuClamp(near));
                ctx.beginPath(); ctx.ellipse(c.x, feet, rx, ry, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#12100e'; ctx.fill();
                ctx.strokeStyle = r > 0.01 ? menuMix('#2a2520', c.level.ink, r * 0.6) : '#2a2520';
                ctx.lineWidth = 1; ctx.stroke();
                ctx.restore();
            });
        }
    }

    // Him, drawn by the town in among its buildings, smaller the further up
    // he is. The engine only draws him here if it asked (menuPadHidden) this
    // frame; the boss lab's engine never asks, and draws him itself.
    function menuDrawHim() {
        if (typeof drawPaddle !== 'function') return;
        const s = menuShrinkAt(padY());
        menu.drawingHim = true;
        ctx.save();
        ctx.translate(paddle.x, padY()); ctx.scale(s, s); ctx.translate(-paddle.x, -padY());
        drawPaddle();
        ctx.restore();
        menu.drawingHim = false;
    }

    // What a level says: its name, its key (the CASTLE's four), and its best
    // there once it has one, which lifts the key a little to make room. No
    // number on it: the town is walked in whatever order you like. Laid out in
    // shares of the card, since the five are not the same size.
    function menuLevelWords(c, st) {
        const l = c.level, y = c.y - c.h / 2, big = l.n === 5;
        const got = st.best > 0;
        const nameY = y + c.h * 0.4, ky = y + c.h * (got ? (big ? 0.66 : 0.64) : 0.72);
        const lit = menu.keys[l.n] ? (st.aimed ? '#fff' : menuMix(st.ink, '#f2efe9', 0.35))
                  : st.shut ? '#6a655c' : st.aimed ? '#f2efe9' : M_WORD_REST;
        text(l.name, c.x, nameY, big ? 19 : 20, lit, 'center');
        const ink = o => menu.keys[o.n] ? (st.aimed ? menuMix(o.ink, '#ffffff', 0.2) : o.ink) : M_EMPTY;
        const turn = c.turn || 0;
        if (big) MENU_LEVELS.forEach((o, i) => menuSigil(o.n, c.x - 45 + i * 30, ky, M_KEY_SMALL, ink(o), turn));
        else menuSigil(l.n, c.x, ky, M_KEY, ink(l), turn);
        if (got) text('BEST ' + fmtScore(st.best), c.x, y + c.h * 0.9, 11, st.aimed ? '#f2efe9' : M_WORD_REST, 'center');
    }
    const M_KEY = 40, M_KEY_SMALL = 24;   // a sigil's size on its own level, and in the CASTLE's row

    // ---- the heraldry: one thing of its own on every building -----------------------
    // Each is behind the building, in front of it, or both, and stirs as he
    // lines up (st.rise, c.stir): the sails turn faster, the fallen lintel teeters, the
    // windows light floor by floor, the plume thickens. The signs' crow and
    // wings are drawn with them (menuDrawSide), but live here with the rest.
    const M_CROW = '#4b4652';        // a crow's slate, never black
    const M_CROW_ROUND = 6;          // seconds round MEMORIES, on its own clock
    const M_SAIL_TURN = 0.2;         // radians a second the FARM's sails turn, on its own clock
    const M_PLUME_RATE = 0.08;       // the VOLCANO's plume, rising puffs a second, on its own clock
    const M_WING_ROWS = [            // lucifer.js's LU_WING_ROWS
        { n: 10, at: [0.1, 1],     sweep: [82, 12], len: [0.34, 1.1],  lift: 0 },
        { n: 7,  at: [0.06, 0.78], sweep: [70, 34], len: [0.26, 0.46], lift: 0.1 },
        { n: 5,  at: [0.03, 0.55], sweep: [46, 28], len: [0.17, 0.25], lift: 0.18 }
    ];
    const M_WING_FLAP = { period: 2.4, lag: 0.1, swing: [5, 8, 11, 14], feather: 5, featherLag: 0.08 };   // ...and LU_WING_FLAP
    // The board's wings are the Corrupted's, and the fight is where they
    // should be seen whole: still until the board is lit, then a small, slow beat.
    const M_WING_BEAT_LIT = 0.2;     // share of the Corrupted's beat, when lit
    const M_WING_SLOW = 2;           // times slower than his
    const M_WING_FEATHER = 0.72;     // feathers this much of his length, to fit the corner
    const M_WING_RISE = 48 * Math.PI / 180;   // how far above level the spines point, out of the LEADERBOARD's crest

    const M_HERALDS = {
        // FARM: a windmill behind the barn, a dark tapering tower like the
        // CITY's, a head for its window, and four of him for sails
        1: {
            behind(c, st) {
                const tx = c.x + c.w * 0.24, hubY = menuTopOf(c) - 44, foot = menuTopOf(c) + 24;
                ctx.beginPath();
                ctx.moveTo(tx - 15, foot); ctx.lineTo(tx - 9, hubY + 4); ctx.lineTo(tx + 9, hubY + 4); ctx.lineTo(tx + 15, foot);
                ctx.closePath();
                ctx.fillStyle = M_FILL; ctx.fill();
                ctx.strokeStyle = menuMix(st.ink, M_DARK, M_RIM_REST * (1 - st.rise)); ctx.lineWidth = 1; ctx.stroke();
                menuPutHead(menuHead(st.rise > 0.5 ? st.ink : menuMix(st.ink, M_DARK, 0.6), 'wash'), tx, hubY + 22, 7);
            },
            front(c, st) {
                const ink = menuAround(st), tx = c.x + c.w * 0.24, hubY = menuTopOf(c) - 44, L = 54;
                const a0 = c.stir * M_SAIL_TURN;
                for (let i = 0; i < 4; i++) {
                    const a = a0 + i * Math.PI / 2;
                    menuLay(menuBody(ink, 'wash'), tx + Math.cos(a) * (6 + L / 2), hubY + Math.sin(a) * (6 + L / 2), L, a, false, i % 2);
                }
                menuPutHead(menuHead(ink, 'wash'), tx, hubY, 12);
            }
        },
        // RUINS: a henge standing up out of the broken roof, three trilithons of
        // him, the last one fallen in, its lintel teetering as you line up
        2: {
            behind(c, st) {
                const img = menuBody(menuAround(st), 'wash'), base = menuTopOf(c) + 14, post = 34, th = post / SHAPE_ASPECT, gap = 11;
                const teeter = 0.05 * Math.sin(menuNow() * 2.2) * st.rise;
                [[-0.3, false], [0.03, false], [0.33, true]].forEach(([u, fallen]) => {
                    const cx = c.x + u * c.w;
                    [-1, 1].forEach(sd => {
                        const L = fallen && sd > 0 ? post * 0.7 : post;
                        menuLay(img, cx + sd * gap, base - L / 2, L, fallen && sd > 0 ? 0.12 : 0, true);
                    });
                    const span = gap * 2 + th + 6;
                    if (fallen) menuLay(img, cx - 1, base - post * 0.8, span, 0.42 + teeter, false);
                    else menuLay(img, cx, base - post - th * 0.35, span, 0, false);
                });
            }
        },
        // CITY: three towers behind its skyline, dark like the buildings, their
        // windows heads. Lined up with, the windows light a floor at a time from
        // the bottom; the tallest has one of him stood on it for a mast.
        3: {
            behind(c, st) {
                const x0 = c.x - c.w / 2, base = c.y - c.h / 2 + 4;
                [[0.15, 24, 50], [0.45, 30, 88], [0.85, 24, 64]].forEach(([u, w, h], ti) => {
                    const tx = x0 + u * c.w, top = base - h;
                    ctx.beginPath(); ctx.rect(tx - w / 2, top, w, h);
                    ctx.fillStyle = M_FILL; ctx.fill();
                    ctx.strokeStyle = menuMix(st.ink, M_DARK, M_RIM_REST * (1 - st.rise)); ctx.lineWidth = 1; ctx.stroke();
                    const cols = Math.floor(w / 9), rows = Math.floor((h - 6) / 12);
                    for (let r = 0; r < rows; r++) {
                        const ink = (r + 1) / rows <= st.rise ? st.ink : menuMix(st.ink, M_DARK, 0.6);
                        for (let q = 0; q < cols; q++) menuPutHead(menuHead(ink, 'wash'), tx - (cols - 1) * 4.5 + q * 9, base - 10 - r * 12, 6);
                    }
                    if (ti === 1) menuLay(menuBody(menuAround(st), 'wash'), tx, top - 11, 22, 0, true);
                });
            }
        },
        // VOLCANO: a plume of him out of the vent, hot at the bottom, cooling as it rises
        4: {
            front(c, st) {
                const vx = c.x, vy = menuTopOf(c) + 5, N = 8;
                const inks = [menuMix(st.ink, '#f2c14e', 0.5), st.ink, menuMix(st.ink, M_SLATE, 0.55)];
                for (let k = 0; k < N; k++) {
                    const p = (c.stir * M_PLUME_RATE + k / N) % 1;
                    menuAlpha(Math.min(1, p * 5) * (1 - p) * (0.55 + 0.45 * st.rise));
                    menuLay(menuBody(inks[Math.min(2, Math.floor(p * 3))], 'wash'),
                            vx + Math.sin(p * 3 + k) * 8 * p + (menuHash(k) - 0.5) * 16 * p, vy - p * 85,
                            10 + 20 * p, menuHash(k) * 6 + p * 2 * (k % 2 ? 1 : -1), k % 2);
                }
                menuAlpha(1);
            }
        },
        // CASTLE: a pennant flying off each end of the crown
        5: {
            front(c, st) {
                const x = c.x - c.w / 2, w = c.w, top = c.y - c.h / 2 - ROOF_H, bw = w / 9, ink = menuAround(st), T = menuNow();
                [x + w * 0.06 + bw / 2, x + w * 0.06 + 4 * bw * 1.75 + bw / 2].forEach((px, i) => {
                    const side = i ? 1 : -1, py = top + 6, tip = Math.max(3, py - 18);
                    ctx.strokeStyle = ink; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, tip); ctx.stroke();
                    const wave = (0.06 + 0.08 * st.rise) * Math.sin(c.stir * 1.2 + i);
                    const a = side > 0 ? 0.1 + wave : Math.PI - 0.1 - wave;
                    menuLay(menuBody(ink, 'wash'), px + Math.cos(a) * 18, tip + 5 + Math.sin(a) * 18, 36, a, false, side < 0);
                });
            }
        }
    };

    // built the way Odin's birds are (memory.js): a body and a head, and two
    // of him to each wing, in a crow's slate edged in MEMORIES' pink
    function menuCrow(c, st, near) {
        const T = menuNow(), ph = c.stir * 2 * Math.PI / M_CROW_ROUND, depth = Math.cos(ph);
        if ((depth >= 0) !== near) return;
        const R = c.w / 2 + 8, ry = 16;
        const x = c.x + Math.sin(ph) * R, y = c.y + 4 + depth * ry;
        const a = Math.atan2(-Math.sin(ph) * ry, Math.cos(ph) * R);
        const sz = 24 * (0.85 + 0.2 * depth), flap = Math.sin(T * 2 * Math.PI * 1.1);
        const img = menuBody(M_CROW, 'flat'), edge = menuBody(menuAround(st), 'wash');
        const A = 0.75 + 0.25 * st.rise;
        const bone = (bx, by, len, ang, flip) => {
            menuAlpha(A * 0.8); menuLay(edge, bx, by, len * 1.1, ang, false, flip);
            menuAlpha(A); menuLay(img, bx, by, len, ang, false, flip);
        };
        for (const side of [-1, 1]) {
            const w1 = a + side * (Math.PI / 2 + 0.3 - 0.45 * flap);
            const ex = x + Math.cos(w1) * sz * 0.7, ey = y + Math.sin(w1) * sz * 0.7;
            bone((x + ex) / 2, (y + ey) / 2, sz * 0.75, w1, side > 0);
            const w2 = w1 + side * (0.4 + 0.35 * flap);
            bone(ex + Math.cos(w2) * sz * 0.4, ey + Math.sin(w2) * sz * 0.4, sz * 0.85, w2, side < 0);
        }
        bone(x, y, sz, a, false);
        menuAlpha(A);
        menuPutHead(menuHead(M_CROW, 'flat'), x + Math.cos(a) * sz * 0.58, y + Math.sin(a) * sz * 0.58, sz * 0.32);
        menuAlpha(1);
    }

    // lucifer.js's luWing, drawn straight to the field: a spine of four bones
    // and three rows of feathers flapping down it joint by joint, dark gold at
    // the shoulder and lighter to the tips, each feather over a gold edge
    function menuWing(x0, y0, th, tr, span, beat, ph, st) {
        const deg = d => d * Math.PI / 180, seg = span / 4;
        const wave = lag => Math.sin(2 * Math.PI * (ph - lag)) * beat;
        const joints = [];
        let a = th, x = x0, y = y0;
        for (let j = 0; j < 4; j++) {
            a += tr * deg(M_WING_FLAP.swing[j] * wave(j * M_WING_FLAP.lag));
            joints.push({ x, y, a });
            x += Math.cos(a) * seg; y += Math.sin(a) * seg;
        }
        const at = f => {
            const s2 = Math.min(span * f, span - 1e-6), jn = Math.min(3, Math.floor(s2 / seg)), jt = joints[jn], u = s2 - jn * seg;
            return [jt.x + Math.cos(jt.a) * u, jt.y + Math.sin(jt.a) * u, jt.a];
        };
        const reach = span * 1.25;
        const tone = (fx, fy, lift) => menuClamp(0.03 + 0.9 * menuEase((Math.hypot(fx - x0, fy - y0) / reach - 0.2) / 0.75) + lift);
        const out = [];
        M_WING_ROWS.forEach((row, ri) => {
            for (let i = row.n - 1; i >= 0; i--) {
                const f = i / (row.n - 1), [ax, ay, sa] = at(menuLerp(row.at[0], row.at[1], f));
                const len = span * menuLerp(row.len[0], row.len[1], f) * M_WING_FEATHER;
                const fa = sa + tr * deg(menuLerp(row.sweep[0], row.sweep[1], f) + M_WING_FLAP.feather * f * wave(f * 4 * M_WING_FLAP.lag + M_WING_FLAP.featherLag));
                const fx = ax + Math.cos(fa) * len / 2, fy = ay + Math.sin(fa) * len / 2;
                out.push({ x: fx, y: fy, a: fa, len, flip: (i + ri) % 2, tone: tone(fx, fy, row.lift) });
            }
        });
        joints.forEach((jt, j) => {
            const bl = seg * 1.12, off = -tr * bl / SHAPE_ASPECT * 0.3;
            const mx = jt.x + Math.cos(jt.a) * seg / 2 - Math.sin(jt.a) * off, my = jt.y + Math.sin(jt.a) * seg / 2 + Math.cos(jt.a) * off;
            out.push({ x: mx, y: my, a: jt.a, len: bl, flip: j % 2, tone: tone(mx, my, 0.2) });
        });
        const dim = k => menuMix(k, M_SLATE, 0.45 * (1 - st.rise));
        const ink = menuBody(dim('#5a4312'), 'flat'), light = menuBody(dim('#ecd27a'), 'flat'), edge = menuBody(dim('#c9a94e'), 'wash');
        for (const f of out) {
            menuAlpha(0.6); menuLay(edge, f.x, f.y, f.len * 1.04, f.a, false, f.flip);
            menuAlpha(1);   menuLay(ink, f.x, f.y, f.len, f.a, false, f.flip);
            if (f.tone > 0.01) { menuAlpha(f.tone); menuLay(light, f.x, f.y, f.len, f.a, false, f.flip); }
        }
        menuAlpha(1);
    }

    // ---- the signs: MEMORIES, SETTINGS, BOSS RUSH, BRANDONS, the LEADERBOARD -------
    // A tier under the levels: they matter, but they should not compete. So
    // they are signs rather than buildings -- a board hung on two short chains
    // of little heads, from a post and arm on the big two and a bracket on the
    // small two -- drawn in thin lines that sit in slate while he is elsewhere
    // and take their color as he lines up, swaying a little more when lit.
    // Each board is cut to what it is for: MEMORIES a scroll, the LEADERBOARD
    // a plaque with a crest its wings rise out of, SETTINGS a tag, BOSS RUSH an
    // arrow pointing into the town, BRANDONS a plain board with every paddle you
    // own hung under it in miniature. The crow circles MEMORIES.
    const M_SIGN_WING = 22;          // the board's wings, smaller than a level's things would be
    const M_SIGN_PAD = 12;           // longest a paddle hung under BRANDONS gets
    const M_SIGN_SWAY = 0.01, M_SIGN_SWAY_LIT = 0.035;   // radians a board swings, and the more it swings lit
    const menuSignLine = st => menuMix(st.ink, M_SLATE, M_RIM_REST * (1 - st.rise));
    const menuSignInk = st => st.aimed ? menuMix(st.ink, '#ffffff', 0.25) : M_WORD_REST;

    // where a sign's board hangs
    function menuHang(c) {
        const small = c.level.small, x0 = c.x - c.w / 2, y0 = c.y - c.h / 2;
        const armY = small ? y0 - 5 : y0 + 6, drop = small ? 5 : 12;
        const bw = small ? c.w : c.w * 0.84, bh = small ? c.h : c.h * 0.46;
        return { small, x0, y0, armY, bw, bh, top: armY + drop, left: c.x - bw / 2 };
    }
    function menuBoardPath(c, x, y, w, h) {
        ctx.beginPath();
        switch (c.level.key) {
            case 'memories':        // a scroll: a sheet with a roll at each end
                ctx.rect(x + 5, y + 2, w - 10, h - 4);
                ctx.roundRect(x, y - 1, 7, h + 2, 3.5);
                ctx.roundRect(x + w - 7, y - 1, 7, h + 2, 3.5);
                break;
            case 'board':           // a plaque with a crest
                ctx.moveTo(x, y + 7); ctx.lineTo(x + w / 2 - 12, y + 7); ctx.lineTo(x + w / 2, y - 5); ctx.lineTo(x + w / 2 + 12, y + 7);
                ctx.lineTo(x + w, y + 7); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath();
                break;
            case 'paddles':         // a plain board: what hangs off it is the point
                ctx.rect(x, y, w, h);
                break;
            case 'settings':        // a tag, clipped at one end
                ctx.moveTo(x + 9, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x + 9, y + h); ctx.lineTo(x, y + h / 2); ctx.closePath();
                break;
            default: {              // an arrow, pointing toward the middle of the town
                const inward = c.x > LW / 2 ? -1 : 1;
                if (inward < 0) { ctx.moveTo(x, y + h / 2); ctx.lineTo(x + 10, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x + 10, y + h); }
                else { ctx.moveTo(x, y); ctx.lineTo(x + w - 10, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w - 10, y + h); ctx.lineTo(x, y + h); }
                ctx.closePath();
            }
        }
    }

    function menuDrawSide(c) {
        const st = menuState(c), G = menuHang(c), line = menuSignLine(st), key = c.level.key;
        ctx.strokeStyle = line; ctx.lineWidth = 1.5;
        if (!G.small) {
            // the post on the side toward the wall, its arm, and a brace
            const postX = c.level.side < 0 ? G.x0 + 3 : G.x0 + c.w - 3, armTo = c.level.side < 0 ? G.x0 + c.w - 8 : G.x0 + 8;
            ctx.beginPath();
            ctx.moveTo(postX, G.y0 + c.h + 4); ctx.lineTo(postX, G.armY - 3);
            ctx.moveTo(postX, G.armY); ctx.lineTo(armTo, G.armY);
            ctx.moveTo(postX, G.armY + 14); ctx.lineTo(postX + (armTo - postX) * 0.18, G.armY);
            ctx.stroke();
        } else {
            ctx.beginPath(); ctx.moveTo(c.x - G.bw * 0.35, G.armY); ctx.lineTo(c.x + G.bw * 0.35, G.armY); ctx.stroke();
        }
        if (key === 'memories') menuCrow(c, st, false);
        if (key === 'board') {
            const beat = M_WING_BEAT_LIT * st.rise, ph = menuNow() / (M_WING_FLAP.period * M_WING_SLOW);
            for (const tr of [-1, 1]) menuWing(c.x + tr * 6, G.top - 3, tr > 0 ? -M_WING_RISE : Math.PI + M_WING_RISE, tr, M_SIGN_WING, beat, ph, st);
        }
        ctx.save();
        ctx.translate(c.x, G.armY);
        ctx.rotate(Math.sin(menuNow() * 1.3 + c.x) * (M_SIGN_SWAY + M_SIGN_SWAY_LIT * st.rise));
        ctx.translate(-c.x, -G.armY);
        // the chains: a few little heads each
        const link = menuHead(line, 'flat');
        for (const cx of [c.x - G.bw * 0.35, c.x + G.bw * 0.35]) for (let i = 0; i < (G.small ? 1 : 3); i++) menuPutHead(link, cx, G.armY + 2 + i * 4, 3);
        const shape = () => menuBoardPath(c, G.left, G.top, G.bw, G.bh);
        shape(); ctx.fillStyle = M_FILL; ctx.fill();
        // stood in the doorway, the board fills from the floor up
        const k = menuDoorK(c);
        if (k) {
            ctx.save(); shape(); ctx.clip();
            menuAlpha(0.45); ctx.fillStyle = st.ink;
            ctx.fillRect(G.left - 12, G.top + G.bh - (G.bh + 12) * k, G.bw + 24, (G.bh + 12) * k);
            ctx.restore(); menuAlpha(1);
        }
        shape(); ctx.strokeStyle = line; ctx.lineWidth = 1 + 0.6 * st.rise; ctx.stroke();
        if (key === 'settings') { ctx.beginPath(); ctx.arc(G.left + 7, G.top + G.bh / 2, 2, 0, Math.PI * 2); ctx.stroke(); }
        if (key === 'paddles') {
            // each on a head of the chain's, faint until he lines up with it
            const own = menuOwned(), step = G.bw / own.length;
            own.forEach((k, i) => {
                const x = G.left + step * (i + 0.5);
                menuPutHead(link, x, G.top + G.bh + 2, 3);
                labPadIcon(k, x, G.top + G.bh + 8, Math.min(M_SIGN_PAD, step - 1), false, 0.3 + 0.7 * st.rise);
            });
        }
        // the name, shrunk to fit, a little off the middle where the shape asks for it
        const name = c.level.lines.join(''), size = G.small ? 11 : 14, room = G.bw - 22;
        ctx.font = size + 'px "Fira Sans", "Trebuchet MS", sans-serif';   // as text() sets it
        const fit = Math.min(size, Math.floor(size * room / ctx.measureText(name).width));
        const nudge = key === 'settings' ? 4 : key === 'rush' ? (c.x > LW / 2 ? 4 : -4) : 0;
        text(name, c.x + nudge, G.top + G.bh / 2 + (G.small ? 4 : key === 'board' ? 8 : 5), fit, menuSignInk(st), 'center');
        ctx.restore();
        if (key === 'memories') menuCrow(c, st, true);
        // BOSS RUSH's best hangs under its sign, once it has one
        if (key === 'rush' && menu.best[M_RUSH] > 0) text('BEST ' + fmtScore(menu.best[M_RUSH]), c.x, G.y0 + c.h + 13, 10, menuSignInk(st), 'center');
    }

    function menuDrawClean(c) {
        const st = menuState(c), h = M_HERALDS[c.level.n] || {};
        if (h.behind) h.behind(c, st);
        menuSilhouette(c, st);
        if (h.front) h.front(c, st);
        menuLevelWords(c, st);
    }

    // ---- the covers -----------------------------------------------------------------
    // The five start out hidden under something of their own place -- the FARM
    // grown over, the RUINS under a rockfall, the CITY fenced off, the VOLCANO
    // under a lava flow, the CASTLE barricaded -- over the plain dark shape,
    // with no name, key or best showing. Walk up and touch one and it is
    // cleared over M_COVER_WIPE, and it stays clear for good: `seen` is saved
    // with the keys and the paddles, and forgotten with them. Lined up with,
    // a cover stirs. Each cover takes k, 0 covered to 1 cleared.
    const M_COVER_WIPE = 1;          // seconds a cover takes to clear

    function menuDust(n) {
        menu.seen[n] = true;
        menuSave();
        menu.dusting = { n, t: 0 };
    }

    function menuDustStep(dt) {
        if (menu.dusting && (menu.dusting.t += dt) >= M_COVER_WIPE) menu.dusting = null;
    }

    function menuDrawLevel(c) {
        const l = c.level;
        if (l.key) { menuDrawSide(c); return; }
        if (l === MENU_VOID) { menuDrawVoid(c); return; }
        const w = menu.dusting && menu.dusting.n === l.n ? menu.dusting : null;
        if (menu.seen[l.n] && !w) { menuDrawClean(c); return; }
        const st = Object.assign(menuState(c), { covered: true });
        if (!w) { menuCovered(c); M_COVERS[l.n](c, st, 0); return; }
        menuDrawClean(c);
        M_COVERS[l.n](c, st, Math.min(1, w.t / M_COVER_WIPE));
    }

    // the building under its cover: its shape, dark, a faint rim of its color
    function menuCovered(c) {
        menuOutline(c);
        ctx.fillStyle = M_FILL; ctx.fill();
        ctx.strokeStyle = menuMix(c.level.ink, M_DARK, 0.75); ctx.lineWidth = 1; ctx.stroke();
    }
    const menuBand = (k, from, to) => menuClamp((k - from) / (to - from));

    // FARM: long grass grown up over it, the roof's peak still above it, some
    // blades gone to seed and the seed his head. Cleared, it is mown left to right.
    const M_GRASS = ['#5d7f45', '#7fa85a', '#6f9150', '#9aa35a', '#b3a765'];
    function menuCoverGrass(c, st, k) {
        const T = menuNow(), y1 = c.y + c.h / 2 + 3, H = c.h + ROOF_H + 6, x0 = c.x - c.w / 2 - 6, W = c.w + 12;
        const cut = x0 - 20 + (W + 40) * menuEase(k);
        ctx.lineCap = 'round';
        for (let i = 0; i < 110; i++) {
            const bx = x0 + menuSeeded(c, i) * W, tall = (0.4 + 0.45 * menuSeeded(c, i + 200)) * H;
            const left = k ? menuClamp((bx - cut) / 30) : 1;   // 0 once mown
            const h = Math.max(3, tall * left);
            const sway = Math.sin(T * 1.3 + bx * 0.05) * (3 + 7 * st.rise) * h / 100;
            const lean = (menuSeeded(c, i + 400) - 0.5) * 14 * h / 100;
            const tx = bx + lean + sway, ty = y1 - h;
            ctx.strokeStyle = M_GRASS[Math.floor(menuSeeded(c, i + 600) * M_GRASS.length)];
            ctx.lineWidth = 2 + menuSeeded(c, i + 800) * 1.6;
            ctx.beginPath(); ctx.moveTo(bx, y1); ctx.quadraticCurveTo(bx + lean * 0.3, y1 - h * 0.5, tx, ty); ctx.stroke();
            if (i % 4 === 0 && left > 0.6) menuPutHead(menuHead('#c9b46a', 'wash'), tx, ty - 3, 6);
        }
        ctx.lineCap = 'butt';
    }

    // RUINS: a rockfall heaped over it, the boulders his head in stone,
    // tumbled every which way. Cleared, it rolls off both sides, the top first.
    const M_ROCK = ['#8e8674', '#9d9483', '#7d776b', '#a39a86'];
    function menuRocks(c) {
        if (c.rocks) return c.rocks;
        const out = [], y1 = c.y + c.h / 2 + 4, H = c.h + ROOF_H + 4;
        for (let row = 0, y = y1; y > y1 - H; row++) {
            const w = 34 - row * 3.2, hh = w * (BALL_RY / BALL_RX);
            for (let x = c.x - c.w / 2 - 4 + (row % 2) * w * 0.45; x < c.x + c.w / 2 + 6; x += w * 0.82)
                out.push({ x: x + (menuSeeded(c, out.length) - 0.5) * 6, y: y - hh * 0.4, w: w * (0.85 + 0.3 * menuSeeded(c, out.length + 50)),
                           rot: (menuSeeded(c, out.length + 90) - 0.5) * 2.4, tone: M_ROCK[Math.floor(menuSeeded(c, out.length + 130) * 4)] });
            y -= hh * 0.62;
        }
        return (c.rocks = out);
    }
    function menuCoverBoulders(c, st, k) {
        const y1 = c.y + c.h / 2, H = c.h + ROOF_H, ar = BALL_RY / BALL_RX;
        const rim = menuHead('#3f3a33', 'flat');
        for (const r of menuRocks(c)) {
            const kk = k ? menuBand(k, 0.45 * (1 - (y1 - r.y) / H), 1) : 0;   // the top of the heap goes first
            const dir = r.x < c.x ? -1 : 1, img = menuHead(r.tone, 'rock');
            ctx.save();
            menuAlpha(1 - kk * kk);
            ctx.translate(r.x + dir * kk * 90, r.y + kk * kk * 60 - Math.sin(kk * Math.PI) * 14);
            ctx.rotate(r.rot + dir * kk * 4);
            // a darker rim under each, so the heap reads as separate stones
            if (rim) ctx.drawImage(rim, -r.w / 2 - 1.5, -r.w * ar / 2 - 1.5, r.w + 3, r.w * ar + 3);
            if (img) ctx.drawImage(img, -r.w / 2, -r.w * ar / 2, r.w, r.w * ar);
            ctx.restore();
        }
        menuAlpha(1);
    }

    // CITY: closed off. Hazard tape crossed over it, striped barriers along the
    // front with a lamp on each, and a cone at each corner -- the tape and the
    // planks him lying down in hazard colors, the cones him stood up.
    // Cleared, it all drops away.
    const M_HAZARD = ['#e0702f', '#efe9dd'];
    function menuCoverBarriers(c, st, k) {
        const T = menuNow(), x0 = c.x - c.w / 2, y0 = c.y - c.h / 2 - ROOF_H + 6, y1 = c.y + c.h / 2;
        ctx.save();
        menuAlpha(1 - k);
        ctx.translate(0, k * k * 90);
        for (const [ax, ay, bx, by] of [[x0 - 4, y0, x0 + c.w + 4, y1 - 22], [x0 + c.w + 4, y0 + 10, x0 - 4, y1 - 30]]) {
            const n = 12, len = Math.hypot(bx - ax, by - ay) / n, a = Math.atan2(by - ay, bx - ax);
            for (let i = 0; i < n; i++) {
                const f = (i + 0.5) / n, sag = Math.sin(f * Math.PI) * (6 + 3 * Math.sin(T * 1.6 + ax) * (0.3 + st.rise));
                menuLay(menuBody(i % 2 ? '#e8c547' : '#efe9dd', 'wash'), ax + (bx - ax) * f, ay + (by - ay) * f + sag, len * 1.05, a, false, i % 2);
            }
        }
        for (let b = 0; b < 3; b++) {
            const bx = x0 + c.w * (b + 0.5) / 3, py = y1 - 16, pw = c.w / 3 - 6;
            ctx.strokeStyle = '#6d6a64'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(bx - pw * 0.35, py); ctx.lineTo(bx - pw * 0.45, y1 + 4); ctx.moveTo(bx + pw * 0.35, py); ctx.lineTo(bx + pw * 0.45, y1 + 4); ctx.stroke();
            for (let s = 0; s < 3; s++) menuLay(menuBody(M_HAZARD[(s + b) % 2], 'wash'), bx - pw / 3 + s * pw / 3, py, pw / 3 + 1, 0, false, s % 2);
            menuAlpha((1 - k) * (0.45 + 0.35 * Math.sin(T * 2 * Math.PI / 1.4 + b)));   // a slow swell, not a blink
            menuPutHead(menuHead('#ffb347', 'flat'), bx, py - 9, 5);
            menuAlpha(1 - k);
        }
        for (const cx of [x0 - 2, x0 + c.w + 2]) {
            menuLay(menuBody(M_HAZARD[0], 'wash'), cx, y1 - 9, 22, 0, true);
            ctx.save(); ctx.beginPath(); ctx.rect(cx - 8, y1 - 13, 16, 4); ctx.clip();
            menuLay(menuBody(M_HAZARD[1], 'flat'), cx, y1 - 9, 22, 0, true); ctx.restore();
        }
        ctx.restore();
        menuAlpha(1);
    }

    // VOLCANO: a lava flow out of its vent and down over it, pooling along the
    // front; bright ones of him carried down in it quickly, crust drifting
    // slower. Cleared, it cools to crust and falls away.
    function menuCoverLava(c, st, k) {
        const T = c.stir, vx = c.x, vy = c.y - c.h / 2 - ROOF_H + 5, y1 = c.y + c.h / 2 + 4;
        const cool = menuBand(k, 0, 0.5), fall = menuBand(k, 0.4, 1);
        const hot = menuMix('#d2622f', '#6b5a50', cool), core = menuMix('#ffb347', '#8a7a70', cool);
        ctx.save();
        menuAlpha(1 - fall);
        ctx.translate(0, fall * fall * 40);
        const streams = [-0.5, 0, 0.55].map(d => y => vx + d * (y - vy) * 0.55 + Math.sin(y * 0.08 + d * 3) * 3);
        const path = new Path2D();
        for (const sx of streams) {
            for (let y = vy; y <= y1; y += 6) { const w = 4 + (y - vy) * 0.12; y === vy ? path.moveTo(sx(y) - w, y) : path.lineTo(sx(y) - w, y); }
            for (let y = y1; y >= vy; y -= 6) { const w = 4 + (y - vy) * 0.12; path.lineTo(sx(y) + w, y); }
            path.closePath();
        }
        // the pool, wound the same way round as the streams, or where they cross it would cut holes in it
        path.moveTo(c.x + c.w / 2 + 6, y1); path.bezierCurveTo(c.x + c.w / 2, y1 - 44, c.x - c.w / 2, y1 - 40, c.x - c.w / 2 - 6, y1); path.closePath();
        ctx.fillStyle = hot; ctx.fill(path);
        ctx.save(); ctx.clip(path);
        const g = ctx.createLinearGradient(0, vy, 0, y1);
        g.addColorStop(0, core); g.addColorStop(1, hot);
        menuAlpha((1 - fall) * 0.6); ctx.fillStyle = g; ctx.fillRect(c.x - c.w, vy, c.w * 2, y1 - vy);
        for (let i = 0; i < 14; i++) {
            const crust = i % 3 === 0, sx = streams[i % 3], p = (T * (crust ? 0.06 : 0.14) + menuSeeded(c, i)) % 1, y = vy + p * (y1 - vy);
            menuAlpha((1 - fall) * (crust ? 0.85 : 0.5 + 0.3 * (1 - cool)));
            menuLay(menuBody(crust ? menuMix('#5a3326', '#6b6258', cool) : core, crust ? 'wash' : 'flat'),
                    sx(y) + (menuSeeded(c, i + 30) - 0.5) * 10, y, crust ? 16 : 11, menuSeeded(c, i + 60) * 6, false, i % 2);
        }
        ctx.restore();
        ctx.restore();
        menuAlpha(1);
    }

    // CASTLE: barricaded. Boards nailed across its face, a great cross of him
    // over them with a head for every nail, stakes along the front. Cleared,
    // the cross comes down first, then the stakes and the boards.
    const M_WOOD = ['#7a5a3a', '#8b6a45', '#6b4c30'];
    function menuCoverBarricade(c, st, k) {
        const T = menuNow(), x0 = c.x - c.w / 2, y0 = c.y - c.h / 2, y1 = c.y + c.h / 2;
        const creak = 0.015 * Math.sin(T * 1.7) * st.rise;
        [[y0 + 22, -0.05], [c.y + 4, 0.04], [y1 - 22, -0.03]].forEach(([by, a], i) => {
            const kk = menuBand(k, 0.55 + i * 0.1, 1);
            ctx.save();
            menuAlpha(1 - kk);
            ctx.translate(c.x, by + kk * kk * 80); ctx.rotate(a + creak + kk * 0.6 * (i % 2 ? 1 : -1));
            ctx.fillStyle = M_WOOD[(i + 1) % 3]; ctx.fillRect(-c.w / 2 - 6, -7, c.w + 12, 14);
            ctx.strokeStyle = '#4a3522'; ctx.lineWidth = 1; ctx.strokeRect(-c.w / 2 - 6, -7, c.w + 12, 14);
            ctx.beginPath(); ctx.moveTo(-c.w / 2, -1); ctx.lineTo(c.w / 2, 1); ctx.stroke();
            ctx.restore();
        });
        [[c.x, c.y + 4, 118, 0.62], [c.x, c.y + 4, 118, -0.62]].forEach(([bx, by, len, a], i) => {
            const kk = menuBand(k, i * 0.12, i * 0.12 + 0.5);
            menuAlpha(1 - kk * kk);
            menuLay(menuBody(M_WOOD[i % 3], 'wash'), bx + kk * 20 * (i % 2 ? 1 : -1), by + kk * kk * 90, len, a + creak + kk * (i % 2 ? 1.2 : -1.2), false, i % 2);
            if (kk < 0.1) menuPutHead(menuHead('#8d877d', 'flat'), bx, by, 5);
        });
        for (let s = 0; s < 7; s++) {
            const kk = menuBand(k, 0.5, 1), sx = x0 + c.w * (s + 0.5) / 7;
            menuAlpha(1 - kk);
            menuLay(menuBody(M_WOOD[(s + 1) % 3], 'wash'), sx, y1 - 10 + kk * 30, 30, (s % 2 ? 0.5 : -0.5), true, s % 2);
        }
        menuAlpha(1);
    }

    const M_COVERS = { 1: menuCoverGrass, 2: menuCoverBoulders, 3: menuCoverBarriers, 4: menuCoverLava, 5: menuCoverBarricade };

    // The VOID is not a building but a hole in the town: an oval of black with
    // arms wound into it and turning, slowly, inward to a still black eye with
    // its name in it, and a rim that will not hold its shape. Each arm is a
    // chain of him, smaller as it goes in. Slow on purpose -- it only has to
    // look wrong, not busy. Nothing in it flashes. Stood in its doorway, the
    // hole fills from the floor up like any other door.
    const VOID_ARMS = 5;
    const VOID_TWIST = 7.5;          // radians an arm winds through, rim to middle
    const VOID_SPIN = 0.9;           // radians a second the arms turn
    const VOID_WOBBLE = 0.07;        // how far the rim strays, as a share of it
    const VOID_WOBBLE_HZ = 0.35;
    const VOID_EYE = 0.45;           // how far in the arms reach, as a share of it
    const VOID_LINK = 15;            // px, one of him at the rim of an arm
    const VOID_STEP = 0.075;         // an arm's links, as shares of its length

    function menuDrawVoid(c) {
        const l = c.level, aimed = menuAimed(c);
        const t = menuNow();
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
        ctx.save();
        rim();
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.clip();
        const img = menuBody(l.ink, 'flat');
        menuAlpha(aimed ? 0.8 : 0.4);
        for (let i = 0; i < VOID_ARMS; i++) {
            for (let s = 0; s < 1; s += VOID_STEP) {
                const a = -t * VOID_SPIN + i * Math.PI * 2 / VOID_ARMS + s * VOID_TWIST;
                const r = 1.1 - s * (1.1 - VOID_EYE);
                const x = c.x + Math.cos(a) * rx * r, y = c.y + Math.sin(a) * ry * r;
                menuLay(img, x, y, VOID_LINK * r, Math.atan2(Math.cos(a) * ry, -Math.sin(a) * rx) + Math.PI, false);
            }
        }
        const k = menuDoorK(c);
        if (k) {
            menuAlpha(0.5);
            ctx.fillStyle = l.ink;
            ctx.fillRect(c.x - rx * 1.2, c.y + ry * 1.2 - c.h * 1.2 * k, rx * 2.4, c.h * 1.2 * k);
        }
        ctx.restore();
        menuAlpha(aimed ? 1 : 0.5);
        rim();
        ctx.strokeStyle = l.ink;
        ctx.lineWidth = aimed ? 2 : 1.5;
        ctx.stroke();
        menuAlpha(1);
        // the still black eye its name is in
        ctx.beginPath(); ctx.ellipse(c.x, c.y + 3, rx * 0.56, ry * 0.5, 0, 0, Math.PI * 2); ctx.fillStyle = '#000'; ctx.fill();
        text(l.name, c.x, c.y + 6, 17, aimed ? '#f2efe9' : '#8d877d', 'center');
        if (menu.best[l.n] > 0) text('BEST ' + fmtScore(menu.best[l.n]), c.x, c.y + 21, 10, aimed ? '#f2efe9' : '#8d877d', 'center');
    }

    // A gate on each wall, standing where he stands, naming the paddle it
    // leads to: a tab pulled in from off the screen, rounded on the side facing
    // the town and running off the edge on the other, drawn like the buildings
    // -- a flat dark shape with a rim of that paddle's color, slate while he is
    // out in the town and lighting as he walks toward the wall. The name reads
    // along it under a chevron that points the way out. Only the name: what a
    // paddle does is the unlock screen's to tell, and BRANDONS's. With only the
    // one paddle there is nowhere for a gate to lead, so there are no gates
    // until a second is won.
    const M_GATE = { w: 24, y: 470, h: 118 };
    const M_GATE_TALL = 86;                  // its foot on the floor, and no taller: the space over it belongs to the FARM and the VOLCANO
    const M_GATE_TOP = M_GATE.y + M_GATE.h - M_GATE_TALL;
    const M_GATE_CHEV_Y = M_GATE_TOP + 13;
    const M_GATE_NAME_Y = (M_GATE_CHEV_Y + 9 + M_GATE.y + M_GATE.h - 5) / 2;   // between the chevron and the foot
    const M_GATE_NAME_ROOM = M_GATE.y + M_GATE.h - 5 - (M_GATE_CHEV_Y + 9);    // a longer name shrinks to it
    const GATE_NEAR = 240;           // px from the wall where a gate starts to light
    const M_GATE_ROUND = 12;
    function menuTabPath(side, y0, y1) {
        const w = M_GATE.w, r = M_GATE_ROUND;
        ctx.beginPath();
        if (side < 0) {
            ctx.moveTo(-30, y0); ctx.lineTo(w - r, y0); ctx.arcTo(w, y0, w, y0 + r, r);
            ctx.lineTo(w, y1 - r); ctx.arcTo(w, y1, w - r, y1, r); ctx.lineTo(-30, y1);
        } else {
            const x = LW - w;
            ctx.moveTo(LW + 30, y0); ctx.lineTo(x + r, y0); ctx.arcTo(x, y0, x, y0 + r, r);
            ctx.lineTo(x, y1 - r); ctx.arcTo(x, y1, x + r, y1, r); ctx.lineTo(LW + 30, y1);
        }
        ctx.closePath();
    }
    function menuDrawGate(side) {
        // the name it is showing, which trails the real one by a slide out
        const to = side in menu.gateTo ? menu.gateTo[side] : menuNextPad(side);
        const p = to && LAB_PAD[to];
        if (!p) return;
        const on = menu.side === side && !menu.sw && menu.lift <= 1;
        const ink = p.ink || p.rim || '#4a453d';
        const hs = halfSpan(), far = side < 0 ? paddle.x - hs : LW - hs - paddle.x;
        const near = menuClamp(1 - far / GATE_NEAR);
        const col = on ? ink : menuMix(ink, M_DARK, 0.55 * (1 - near));
        const y0 = M_GATE_TOP, y1 = M_GATE.y + M_GATE.h, cx = side < 0 ? M_GATE.w / 2 : LW - M_GATE.w / 2;
        menuTabPath(side, y0, y1);
        ctx.fillStyle = M_FILL; ctx.fill();
        // the lean, filling the tab from the floor up
        const k = on ? Math.min(1, menu.hold / SWAP_HOLD) : 0;
        if (k > 0) {
            ctx.save(); menuTabPath(side, y0, y1); ctx.clip();
            menuAlpha(0.45);
            ctx.fillStyle = ink;
            ctx.fillRect(side < 0 ? 0 : LW - M_GATE.w, y1 - (y1 - y0) * k, M_GATE.w, (y1 - y0) * k);
            ctx.restore();
            menuAlpha(1);
        }
        menuTabPath(side, y0, y1);
        ctx.strokeStyle = col; ctx.lineWidth = on ? 2 : 1 + near * 0.5; ctx.stroke();
        // the chevron, pointing out through the wall
        const cy = M_GATE_CHEV_Y;
        ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx - side * 2, cy - 5); ctx.lineTo(cx + side * 3, cy); ctx.lineTo(cx - side * 2, cy + 5); ctx.stroke();
        ctx.lineCap = 'butt';
        // the name, reading up the left wall and down the right
        ctx.save();
        ctx.translate(cx, M_GATE_NAME_Y);
        ctx.rotate(side < 0 ? -Math.PI / 2 : Math.PI / 2);
        ctx.textBaseline = 'middle';
        ctx.font = '11px "Fira Sans", "Trebuchet MS", sans-serif';   // as text() sets it
        const fit = Math.min(11, 11 * M_GATE_NAME_ROOM / ctx.measureText(p.name).width);
        text(p.name, 0, 0, fit, on ? '#f2efe9' : M_WORD_REST, 'center');
        ctx.restore();
        ctx.textBaseline = 'alphabetic';
    }

    // one line under the town, and only when something has just happened.
    // Leaning on a gate says nothing here: the gate already names the paddle.
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
    // of his own color, with what he does and a few lines of where he is from. Only a win shows them (menuBeat,
    // which the lab's "count it beaten" buttons also call); the debug menu's
    // toggles and "unlock everything" do not -- except BRANDONS UNLOCKED,
    // which a debug toggle that puts the sign up shows too (menuAddPad).
    const UNLOCK_WAIT = 0.6;         // seconds up before a tap takes it away
    const UNLOCK_IN = 0.45;          // him rising into place
    const UNLOCK_W = 500;            // how long he is drawn
    const UNLOCK_BACK = 0.22;        // his color, this much of it over black, behind him

    // up in the town, or over the VOID's fight while its memory plays
    function menuUnlockUp() { return !!(menu && menu.shows.length && (menuUp() || menu.fightShow)); }

    // a tap: true if it was the unlock screen's to take. A memory or the
    // credits are not tapped away but held (menuCutPress).
    function menuUnlockNext() {
        if (!menuUnlockUp()) return false;
        if (menu.showT >= UNLOCK_WAIT) menuShowNext();
        return true;
    }
    // The paddle you won with stays in your hands through BRANDON WINS and
    // every card after it, and only once the last is gone, back in the town,
    // are you handed the last paddle those cards showed you (menuAddPad).
    function menuShowNext() {
        menu.shows.shift();
        menu.showT = 0;
        menu.skipT = -1;
        if (!menu.shows.length) menu.fightShow = false;
        if (!menuCutUp()) menuCutHintOff(true);
        const next = menu.padNext;
        if (!menu.shows.length && menuUp() && next) {
            menu.padNext = null;
            if (menu.pads[next] && LAB_PAD[next]) LAB.usePad(next);
        }
    }

    function menuUnlockDraw() {
        if (!menuUnlockUp()) return false;
        const show = menu.shows[0];
        if (show.mem) { menuMemoryCard(show.mem, menu.showT); menuSkipDraw(); return true; }
        if (show.credits) { menuCreditsDraw(menu.showT); menuSkipDraw(); return true; }
        if (show.memCard) { menuMemoryUnlocked(show.memCard, menu.showT); menuTapPrompt(menu.showT - UNLOCK_WAIT); return true; }
        if (show.rushCard) { menuRushUnlocked(menu.showT); menuTapPrompt(menu.showT - UNLOCK_WAIT); return true; }
        if (show.rackCard) { menuRackUnlocked(menu.showT); menuTapPrompt(menu.showT - UNLOCK_WAIT); return true; }
        if (show.buildCard) { menuBuildUnlocked(show.buildCard, menu.showT); menuTapPrompt(menu.showT - UNLOCK_WAIT); return true; }
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
        menuTapPrompt(menu.showT - UNLOCK_WAIT);
        return true;
    }

    // A paddle's lore, wrapped to w and centerd on x: {odin}, {surtr} and
    // {angel} print as "Brandon" in that Brandon's face, the rest in the
    // plain voice, all of it in the plain voice's color (see LAB_PAD). The
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
    // own color, then a tap and it plays. The title comes the way something
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

    // MEMORIES, the LEADERBOARD and the VOID UNLOCKED: the BOSS RUSH card
    // again, for any building a run puts up that has no card of its own
    function menuBuildUnlocked(level, t) {
        const ink = level.ink || '#f2efe9';
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, LW, LH);
        ctx.globalAlpha = UNLOCK_BACK;
        ctx.fillStyle = ink;
        ctx.fillRect(0, 0, LW, LH);
        const e = 1 - Math.pow(1 - Math.min(1, t / UNLOCK_IN), 3);
        ctx.globalAlpha = 1;
        text('UNLOCKED', LW / 2, 200, 34, '#f2efe9', 'center');
        ctx.globalAlpha = e;
        text(level.lines ? level.lines.join(' ') : level.name, LW / 2, 320 + (1 - e) * 30, 54, ink, 'center');
        const line = M_BUILD_LINES[level.key || level.n];
        if (line) text(line, LW / 2, 368 + (1 - e) * 30, 15, '#c9c4ba', 'center');
        ctx.globalAlpha = 1;
    }

    // BRANDONS UNLOCKED, the BOSS RUSH card's twin, with every paddle you own
    // rising in a row under it: what the sign has on its rack
    const M_RACK_CARD_Y = 450;       // the row's middle
    const M_RACK_CARD_W = 110;       // longest one of them gets
    function menuRackUnlocked(t) {
        const ink = M_SIDES.find(s => s.key === 'paddles').ink;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, LW, LH);
        ctx.globalAlpha = UNLOCK_BACK;
        ctx.fillStyle = ink;
        ctx.fillRect(0, 0, LW, LH);
        const e = 1 - Math.pow(1 - Math.min(1, t / UNLOCK_IN), 3);
        ctx.globalAlpha = 1;
        text('UNLOCKED', LW / 2, 160, 34, '#f2efe9', 'center');
        ctx.globalAlpha = e;
        text('BRANDONS', LW / 2, 280 + (1 - e) * 30, 54, ink, 'center');
        text('every paddle you own, on one rack, to pick from', LW / 2, 328 + (1 - e) * 30, 15, '#c9c4ba', 'center');
        ctx.globalAlpha = 1;
        const own = menuOwned(), step = Math.min(M_RACK_CARD_W * 1.1, (LW - 80) / own.length);
        own.forEach((k, i) => labPadIcon(k, LW / 2 + (i - (own.length - 1) / 2) * step, M_RACK_CARD_Y + (1 - e) * 40,
                                         Math.min(M_RACK_CARD_W, step * 0.9), false, e));
    }

    // The credits, after the VOID: one card at a time out of the black and
    // back into it. Placeholders, all three.
    const CREDITS = [['STARRING', 'BRANDON'], ['BY', 'PAUL'], ['STORY HELP BY', 'DAVE']];
    const CREDITS_LEAD = 1;          // black before the first
    const CREDITS_IN = 0.8, CREDITS_HOLD = 2.2, CREDITS_OUT = 0.8;
    const creditsCard = () => CREDITS_IN + CREDITS_HOLD + CREDITS_OUT;
    function menuCreditsSecs() { return CREDITS_LEAD + CREDITS.length * creditsCard() + 0.6; }
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

    // ---- held to skip, and tapped to go on -----------------------------------------
    // A memory and the credits play by themselves, and a tap does not end
    // them: one landing by accident, or meant for the card before, would
    // throw away a scene there is no getting back to straight away. Held
    // SKIP_HOLD it skips. HOLD TO SKIP is the line under the field for as
    // long as the scene is up, and a press turns it into the seconds left
    // over a bar filling under the words, so it is plain the press has been
    // felt and how long is left -- all of it off the scene. A phone held
    // upright has no such line, so there, and only there, it is a panel at
    // the foot of the field.
    // Whatever instead waits on a tap says so at the foot of the field
    // (menuTapPrompt).
    const SKIP_HOLD = 1.5;           // seconds held to skip
    const SKIP_LINGER = 1.6;         // seconds the words stay up after a press lets go
    const SKIP_FADE = 0.3;           // ...and take to come and go
    const PROMPT_UP = 26;            // px up off the field's foot for the line
    const PROMPT_INK = '#9a958c';

    // a memory or the credits, the things that are held rather than tapped
    function menuCutUp() {
        if (menuUnlockUp()) return !!(menu.shows[0].mem || menu.shows[0].credits);
        return menuScreenUp() && menu.screen.kind === 'memory';
    }
    // a press going down or letting go: true if a cutscene took it
    function menuCutPress(down) {
        if (!menuCutUp()) return false;
        if (down) menu.skipT = 0;
        else if (menu.skipT >= 0) { menu.skipT = -1; menu.skipShow = SKIP_LINGER; }
        return true;
    }
    function menuCutStep(dt) {
        if (!(menu.skipT >= 0)) { menu.skipShow = Math.max(0, (menu.skipShow || 0) - dt); return; }
        menu.skipShow = SKIP_LINGER;
        if ((menu.skipT += dt) < SKIP_HOLD) return;
        menu.skipT = -1;
        menu.skipShow = 0;
        if (menuUnlockUp()) menuShowNext(); else menuShow('memories');
    }
    const SKIP_INK0 = '#6d685f';     // the line under the field, as fourkeys.html has it...
    const SKIP_INK1 = '#f2efe9';     // ...and held all the way
    const SKIP_BAR_W = 240;          // the bar, px at full size
    const SKIP_BAR_H = 10;
    const SKIP_LINE_BAR = 2;         // px, the bar under the words on the line under the field
    function menuSkipDraw() {
        const held = menu.skipT >= 0, k = held ? Math.min(1, menu.skipT / SKIP_HOLD) : 0;
        const line = held ? 'skipping in ' + Math.max(0, SKIP_HOLD - menu.skipT).toFixed(1) + 's' : 'hold to skip';
        const el = document.querySelector('.hint');
        if (el && el.offsetParent) {
            if (menu.hintWas === undefined) menu.hintWas = el.textContent;
            el.textContent = line;
            el.style.color = menuMix(SKIP_INK0, SKIP_INK1, k);
            el.style.background = k > 0
                ? 'linear-gradient(' + SKIP_INK1 + ',' + SKIP_INK1 + ') left bottom / ' + (k * 100) + '% ' +
                  SKIP_LINE_BAR + 'px no-repeat'
                : '';
            return;
        }
        const a = held ? 1 : Math.min(1, (menu.skipShow || 0) / SKIP_FADE);
        if (a <= 0) return;
        const u = uiScale, w = SKIP_BAR_W * u, h = SKIP_BAR_H * u;
        const x = LW / 2 - w / 2, y = LH - PROMPT_UP - h / 2;
        ctx.save();
        ctx.globalAlpha = a;
        // a dark panel under it all, so it reads over any scene
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath(); ctx.roundRect(x - 16 * u, y - 30 * u, w + 32 * u, h + 42 * u, 8 * u); ctx.fill();
        text(line, LW / 2, y - 10 * u, 15 * u, held ? SKIP_INK1 : PROMPT_INK, 'center');
        ctx.fillStyle = 'rgba(242,239,233,0.18)';
        ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
        if (k > 0) {
            ctx.fillStyle = SKIP_INK1;
            ctx.beginPath(); ctx.roundRect(x, y, Math.max(h, w * k), h, h / 2); ctx.fill();
        }
        ctx.restore();
    }
    // the line under the field back to what it said before the scene, or
    // only let go of when whatever comes next says something of its own
    function menuCutHintOff(restore) {
        if (menu.hintWas === undefined) return;
        const el = document.querySelector('.hint');
        if (el) {
            el.style.color = '';
            el.style.background = '';
            if (restore) el.textContent = menu.hintWas;
        }
        menu.hintWas = undefined;
    }
    // "click/tap to continue", coming up `since` seconds after a tap would
    // take the screen (nothing while it is still negative), at the foot of
    // the field unless `y` says where. intro.js's cards use it too.
    function menuTapPrompt(since, y) {
        if (since < 0) return;
        ctx.globalAlpha = Math.min(1, since / SKIP_FADE);
        text('click/tap to continue', LW / 2, y === undefined ? LH - PROMPT_UP : y, 15 * uiScale, PROMPT_INK, 'center');
        ctx.globalAlpha = 1;
    }

    // ---- inside: SETTINGS, the MEMORIES room and the rack -----------------------------
    // The buildings you go into without leaving the town. Their choices
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
                        { id: 'import', label: 'IMPORT SAVE', ink: '#7fa85a', act: menuPickSave, now: true },
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
                      { id: 'load', label: 'LOAD IT', ink: M_RISK, act: () => menuLoadSave(sc.n) }] },
        // a table, not a question: the title and line go up out of its way and
        // the choices are the smaller tabs along the bottom (menuBoardTabs)
        // home is TOTAL once there is a TOTAL tab, and FARM's until then
        board: { title: 'LEADERBOARD', ink: '#c9a94e', home: () => menuBestTotal() > 0 ? 'total' : 's1', table: true,
                 line: sc => sc.view === BOARD_TOTAL ? 'best on all six stages (excluding BOSS RUSH), added up'
                                                     : 'the ten best runs',
                 choices: menuBoardTabs }
    };
    const M_TAB_Y = 470;             // a table screen's row of tabs...
    const M_TAB_H = 48;
    const M_TAB_GAP = 8;             // ...and the least room between two

    // Any number of choices, left to right, each the middle of an equal share
    // of the width: he picks by whichever middle is nearest, so a choice he
    // cannot quite stand under is still his from as near as he can get.
    function menuRow(list) {
        const share = LW / list.length, w = Math.min(M_CHOICE_W, share - M_CHOICE_GAP);
        return list.map((c, i) => Object.assign({ cx: share * (i + 0.5), w }, c));
    }
    // A table screen has more tabs than a row has room for at his reach, so
    // they run from one end of where his middle can go to the other instead,
    // the way the timeline does: however wide the paddle, every one is his.
    function menuTabs(list) {
        const hs = halfSpan(), step = (LW - hs * 2) / Math.max(1, list.length - 1);
        const w = Math.min(M_CHOICE_W, step - M_TAB_GAP);
        return list.map((c, i) => Object.assign({ cx: hs + step * i, w }, c));
    }

    function menuScreenUp() { return !!(menu && menu.screen && menuUp()); }
    function menuShow(kind, n) {
        // where he went in, kept from the room to a memory and back
        const from = menu.screen ? menu.screen.from : undefined;
        menu.screen = { kind, n, t: 0, from, note: null };
        menu.press = null;
        menuCutHintOff(false);
        const s = M_SCREENS[kind];
        if (s) {
            const home = typeof s.home === 'function' ? s.home() : s.home;
            paddle.x = paddle.tx = menuChoices().find(c => c.id === home).cx;
        }
        // the rack's home is the peg of the one in his hands
        if (kind === 'paddles') paddle.x = paddle.tx = menuRack().find(c => c.id === LAB.pad).cx;
        setHint(kind === 'memory' ? 'hold to skip'
                                  : 'move to choose · click/tap or space to pick');
    }
    // out the way he went in: the choosing moved him, and letting him walk
    // home down some other lane would drag him through whatever is in it
    function menuLeave() {
        if (menu.screen.from !== undefined) paddle.x = paddle.tx = menu.screen.from;
        // back out of the sign the screen was opened from, the way it was gone into
        const c = menu.cards.find(o => o.level.key === menu.screen.kind && menuStands(o));
        if (c) { menu.leaving = { card: c, t: 0, x: paddle.x }; menu.lift = 0; }
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
    // Some keep the token of the name they had when they shipped.
    const M_SAVE_PADS = { gilded: 'GILT', statue: 'STATUE', crystalline: 'FROST', magma: 'EMBER', pair: 'PAIR',
                          classic: 'CLASSIC', multi: 'MULTI', prince: 'PRINCE', chell: 'CHELL',
                          blur: 'BLUE BLUR' };
    const M_SAVE_MEMS = { exhortation: 'EXHORTATION', reckoning: 'RECKONING', cycle: 'CYCLE',
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
        if (menu.slain > 0) lines.push('BOSSES ' + menu.slain);
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
        const got = { keys: {}, pads: { standard: true }, mems: {}, memFrom: {}, seen: {}, best: {}, slain: 0 };
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
            } else if (word === 'BOSSES') {
                const v = Number(rest);
                if (Number.isInteger(v) && v > 0) got.slain = Math.max(got.slain, v);
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
        menu.padNext = null;
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
        const s = M_SCREENS[sc.kind];
        if (s) return (s.table ? menuTabs : menuRow)(s.choices(sc));
        if (sc.kind === 'paddles') return menuRack();
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
        if (sc.kind === 'memory') { menuMemoryCard(sc.n, sc.t); menuSkipDraw(); return true; }
        if (sc.kind === 'paddles') { menuRackDraw(); return true; }
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, LW, LH);
        const s = M_SCREENS[sc.kind];
        const tab = !!(s && s.table);
        const dash = sc.dash;
        const lit = dash ? dash.c : menuChoiceAt(paddle.x);
        // BACK has no table of its own, so the last one stays up under it
        if (tab && lit.view !== undefined) sc.view = lit.view;
        if (s) {
            text(s.title, LW / 2, tab ? 52 : 150, tab ? 30 : 34, s.ink || M_SAFE, 'center');
            // a note is what the last choice did, and it stands in for the line
            const line = sc.note || (typeof s.line === 'function' ? s.line(sc) : s.line);
            text(line, LW / 2, tab ? 80 : 195, tab ? 14 : 15, sc.note ? M_SAFE : '#9a958c', 'center');
        } else text('MEMORIES', LW / 2, 150, 34, '#d9a5b3', 'center');
        if (tab) { boardPick(sc.view); drawBoard(118, M_TAB_Y - M_TAB_H / 2 - 30, 1); }
        const rowY = tab ? M_TAB_Y : M_CHOICE_Y, rowH = tab ? M_TAB_H : M_CHOICE_H;
        const pose = dash && menuDashPose(dash, rowY, rowH);
        const choices = menuChoices();
        const stops = choices.filter(c => c.stop);
        if (stops.length) menuDrawTimeline();
        for (const c of choices) {
            const on = c === lit || c.id === lit.id;
            if (c.stop) { menuDrawStop(c, on); continue; }
            const x = c.cx - c.w / 2, y = rowY - rowH / 2;
            menuPanel(x, y, c.w, rowH, on, c.ink);
            if (on) {
                ctx.globalAlpha = pose && pose.bumped ? DASH_HIT : menu.press === c.id || pose ? 0.4 : 0.18;
                ctx.fillStyle = c.ink;
                ctx.fillRect(x + 1, y + 1, c.w - 2, rowH - 2);
                ctx.globalAlpha = 1;
            }
            text(c.label, c.cx, rowY + (tab ? 5 : 6), tab ? fitSize(c.label, 15, c.w - 8) : 17,
                 on ? (c.act ? '#f2efe9' : '#6d685f') : (c.act ? c.ink : '#4a453d'), 'center');
        }
        // a line from him up to what he is under, so it is plain he is the
        // pointer -- not while he is running the length of it
        if (!pose) {
            ctx.strokeStyle = lit.ink;
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 6]);
            ctx.beginPath();
            ctx.moveTo(paddle.x, PADDLE_Y - padH() / 2 - 8);
            ctx.lineTo(lit.cx, !lit.stop ? rowY + rowH / 2 + 8
                             : lit.under.length ? M_TL_Y + M_UNDER + (lit.under.length - 1) * M_UNDER_STEP + 8
                             : M_TL_Y + M_STOP_R * 1.6 + 8);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }
        if (!tab) text('move under one · click, tap or space to pick it', LW / 2, 245, 17, '#6d685f', 'center');
        if (!pose) { labPadIcon(LAB.pad, paddle.x, PADDLE_Y, padW(), false, 1); return true; }
        ctx.save();
        ctx.translate(pose.x, pose.y + pose.bob);
        ctx.rotate(pose.rock);
        labPadIcon(LAB.pad, 0, 0, padW(), false, 1);
        ctx.restore();
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
        if (menu.screen.kind === 'memory') return true;     // held, not tapped: menuCutPress
        if (menu.screen.dash) return true;  // he is already on his way to one
        const c = menuChoiceAt(menuAimOf(e));
        if (down) menu.press = c.act ? c.id : null;
        else {
            if (menu.press && c.id === menu.press) { if (c.stop) c.act(); else menuDash(c); }
            menu.press = null;
        }
        return true;
    }

    // ---- the rack: every paddle at once ---------------------------------------------
    // Behind the BRANDONS sign, the other way to change paddle than leaning on
    // a wall. All of them hang from one rail in the gates' order, earned or
    // not, with BACK at the left end, spread across his reach the way the
    // timeline is. The one he is under is shown off big above the rail, as
    // on his PADDLE UNLOCKED card; a press dashes him up and swaps him for
    // it. The one in his hands is down there being him, so only a ghost of
    // it is left on its peg. One not yet earned is his shape in flat dark --
    // not stone, which is STATUE -- with no name, and what it takes to earn.
    const M_RACK_Y = 452;            // the rail
    const M_RACK_PAD = 58;           // a paddle on it...
    const M_RACK_BIG = 400;          // ...and the lit one, shown off above
    const M_RACK_BEAD = 7;           // the rail is a row of little slate heads this wide
    const M_RACK_DARK = '#1c1a17';   // one not yet earned
    const M_RACK_EDGE = '#2e2a25', M_RACK_EDGE_LIT = '#4a453d';   // ...and the rim that keeps it off the black
    const M_RACK_GHOST = 0.15;       // what is left on the peg of the one in his hands
    const M_RACK_REST = 0.7;         // an earned one he is not under

    function menuRack() {
        const list = [{ id: 'back', back: true, ink: M_SAFE, act: menuLeave }]
            .concat(MENU_PADS.map(k => ({ id: k, pad: k, got: !!menu.pads[k],
                                         ink: LAB_PAD[k].ink || LAB_PAD[k].rim || M_WORD_REST,
                                         act: menu.pads[k] && k !== LAB.pad ? () => menuRackTake(k) : null })));
        const hs = halfSpan(), step = (LW - hs * 2) / (list.length - 1);
        return list.map((c, i) => Object.assign(c, { cx: hs + step * i }));
    }

    // his reach changes with him, so the rack moves: he is put back under
    // the one he took, and so is the rest of his dash
    function menuRackTake(k) {
        LAB.usePad(k);
        const x = menuRack().find(c => c.id === k).cx;
        paddle.x = paddle.tx = x;
        if (menu.screen.dash) menu.screen.dash.x = x;
    }

    // what it takes to earn one, from the same lists that hand them over
    function menuRackHow(k) {
        const lv = MENU_LEVELS.concat(MENU_LAST).find(l => l.pad === k);
        const slain = MENU_SLAIN_PADS.find(s => s[1] === k);
        if (lv) return 'win the ' + lv.name + ' without a continue' + (slain ? ', or beat ' + slain[0] + ' bosses' : '');
        if (k === MENU_SOUVENIR) return 'win any level';
        if (!slain) return '';
        const n = Object.keys(MENU_FLAWLESS_PADS).find(n => MENU_FLAWLESS_PADS[n] === k);
        const clean = n && MENU_ALL.find(l => l.n === +n);
        return 'beat ' + slain[0] + ' bosses' + (clean ? ', or win the ' + clean.name + ' without losing a head' : '');
    }

    function menuRackIcon(k, x, y, w, got, a, lit) {
        if (got) { labPadIcon(k, x, y, w, false, a); return; }
        const parts = LAB_PAD[k].twin ? [[-w * 0.28, w * 0.55], [w * 0.28, w * 0.55]] : [[0, w]];
        const edge = lit ? M_RACK_EDGE_LIT : M_RACK_EDGE;
        ctx.globalAlpha = a;
        for (const [dx, ww] of parts) {
            const hh = ww / SHAPE_ASPECT;
            ctx.drawImage(padFlat('mRackEdge' + edge, edge), x + dx - ww * 0.53, y - hh * 0.53, ww * 1.06, hh * 1.06);
            ctx.drawImage(padFlat('mRackDark', M_RACK_DARK), x + dx - ww / 2, y - hh / 2, ww, hh);
        }
        ctx.globalAlpha = 1;
    }

    // A leaderboard row's paddle, dark as on the rack until it is yours, so
    // the table cannot show you one you have not earned yet
    function menuBoardPadIcon(k, x, y, w, a) {
        menuRackIcon(k, x, y, w, !menu || !MENU_PADS.includes(k) || !!menu.pads[k], a, false);
    }

    function menuRackDraw() {
        const sc = menu.screen, dash = sc.dash, rack = menuRack();
        const lit = dash ? rack.find(c => c.id === dash.c.id) : menuChoiceAt(paddle.x);
        const ink = M_SIDES.find(s => s.key === 'paddles').ink;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, LW, LH);
        text('BRANDONS', LW / 2, 56, 30, ink, 'center');
        text(menuOwned().length + ' of ' + MENU_PADS.length, LW / 2, 82, 14, '#9a958c', 'center');

        if (lit.back) {
            text('BACK', LW / 2, 220, 40, M_SAFE, 'center');
            text('to the town, holding ' + LAB_PAD[LAB.pad].name, LW / 2, 252, 15, '#9a958c', 'center');
        } else {
            const p = LAB_PAD[lit.pad];
            menuRackIcon(lit.pad, LW / 2, 196, M_RACK_BIG, lit.got, 1, true);
            if (lit.got) {
                text(p.name + (lit.id === LAB.pad ? '  ·  IN HAND' : ''), LW / 2, 300, 36, lit.ink, 'center');
                text(p.blurb, LW / 2, 326, 15, '#c9c4ba', 'center');
                if (p.lore) menuLore(p.lore, LW / 2, 356, UNLOCK_LORE_PX, UNLOCK_LORE_W);
            } else {
                text('? ? ?', LW / 2, 300, 36, '#6d685f', 'center');
                text(menuRackHow(lit.pad), LW / 2, 326, 15, '#9a958c', 'center');
            }
        }

        const bead = menuHead(M_SLATE, 'flat');
        for (let x = rack[0].cx - 30; x <= rack[rack.length - 1].cx + 30; x += M_RACK_BEAD * 0.8)
            menuPutHead(bead, x, M_RACK_Y, M_RACK_BEAD);
        for (const c of rack) {
            const on = c.id === lit.id;
            menuPutHead(menuHead(on ? c.ink : '#6d685f', 'flat'), c.cx, M_RACK_Y, on ? 13 : 10);
            if (c.back) { text('BACK', c.cx, M_RACK_Y + 28, on ? 15 : 13, on ? M_SAFE : '#6d685f', 'center'); continue; }
            const w = on ? M_RACK_PAD * 1.15 : M_RACK_PAD;
            menuRackIcon(c.pad, c.cx, M_RACK_Y + 10 + w / SHAPE_ASPECT / 2, w, c.got,
                         c.id === LAB.pad ? M_RACK_GHOST : on || !c.got ? 1 : M_RACK_REST, on);
        }

        const pose = dash && menuDashPose(dash, M_RACK_Y + 14, 28);
        if (!pose) {
            // a line up from him to what he is under, as every room has
            ctx.strokeStyle = lit.ink; ctx.globalAlpha = 0.5; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
            ctx.beginPath(); ctx.moveTo(paddle.x, PADDLE_Y - padH() / 2 - 8); ctx.lineTo(lit.cx, M_RACK_Y + 40); ctx.stroke();
            ctx.setLineDash([]); ctx.globalAlpha = 1;
            labPadIcon(LAB.pad, paddle.x, PADDLE_Y, padW(), false, 1);
            return;
        }
        ctx.save();
        ctx.translate(pose.x, pose.y + pose.bob); ctx.rotate(pose.rock);
        labPadIcon(LAB.pad, 0, 0, padW(), false, 1);
        ctx.restore();
    }

    // ---- picking: he dashes up into it ----------------------------------------------
    // A pick is not taken where he stands. He sprints up the screen into the
    // choice, and it is taken when he bumps it. A screen still up afterwards
    // (a note, a tab) has him drop straight back to where the hand has him.
    // The whole of it is well under half a second: it is a flourish on a
    // choice already made, never a wait. The dash lives on the screen it
    // began on, so a pick that brings up another screen ends it there.
    // A choice marked `now` is taken as the press lets go and he dashes
    // after it: a file picker only opens from inside a press.
    const DASH_UP = 0.14;            // s from the floor to the choice, speeding up
    const DASH_HOLD = 0.07;          // s up against it, which is when it is taken
    const DASH_BACK = 0.12;          // s back down, slowing
    const DASH_HZ = 11;              // paces a second: a sprint, not the town's walk
    const DASH_BOB = 3;              // px he rises and falls a pace
    const DASH_ROCK = 0.1;           // radians he rolls a pace
    const DASH_HIT = 0.55;           // how bright the choice lights as he bumps it

    function menuDash(c) {
        menu.screen.dash = { c, t: 0, x: paddle.x, hit: false };
        if (c.now) c.act();
    }

    function menuDashStep(dt) {
        const sc = menu.screen, d = sc.dash;
        if (!d) return;
        d.t += dt;
        if (!d.hit && d.t >= DASH_UP + DASH_HOLD) {
            d.hit = true;
            if (!d.c.now) d.c.act();
        }
        if (d.t >= DASH_UP + DASH_HOLD + DASH_BACK) sc.dash = null;
    }

    // Where he is on the way. `k` is how far up, 0 on the floor and 1 with
    // his head against the choice's bottom edge; he paces only while moving.
    function menuDashPose(d, rowY, rowH) {
        const up = d.t < DASH_UP, back = d.t > DASH_UP + DASH_HOLD;
        const u = up ? d.t / DASH_UP : Math.min(1, (d.t - DASH_UP - DASH_HOLD) / DASH_BACK);
        const k = up ? u * u : back ? (1 - u) * (1 - u) : 1;
        // his art, not his box: the box is shorter, and his head would go in
        const top = rowY + rowH / 2 + padW() / SHAPE_ASPECT / 2;
        const ph = d.t * DASH_HZ * Math.PI * 2, pace = up || back ? 1 : 0;
        return { x: d.x + (d.c.cx - d.x) * k, y: PADDLE_Y + (top - PADDLE_Y) * k,
                 bob: Math.sin(ph) * DASH_BOB * pace, rock: Math.cos(ph) * DASH_ROCK * pace,
                 bumped: !up };
    }

    // ---- holding, which is the whole of the input ------------------------------------
    // The game's own tap serves a ball; there is no ball here, so the hub takes
    // the press for itself (see the action() hook) and only watches whether it
    // is still down.
    // A press that turns over one of the opening cards is the card's, not his.
    // Asked as typeof since the boss lab builds this file without the opening.
    const introHas = () => typeof introUp === 'function' && introUp();
    const menuHeld = (down, e) => {
        if (phase === 'initials' || phase === 'scores') return;     // the engine's screens (menuBoardAsk)
        if (down && introHas()) return;
        if (menu && menuCutPress(down)) return;
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
