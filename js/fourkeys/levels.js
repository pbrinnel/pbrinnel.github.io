'use strict';

    // ---- FOUR KEYS: the levels ---------------------------------------------------------
    // Each of the five buildings in the town is three screens, walked in order:
    // a wall, a second wall that a mini-boss makes his entrance on partway
    // through (see labMiniStart), then the level's boss. The VOID is not here -- it is one fight and nothing else,
    // and it keeps the engine's own stages.
    //
    // The rows are the engine's (see `stages` in engine.js): . empty, Y G O R
    // one hit each, S silver (silverHp hits), A gold (GOLD_HP), X stone. A row
    // starting with '>' sits half a brick to the right, which is how the RUINS
    // get their bond; it has room for one brick fewer than the rows either
    // side of it.
    //
    // `pace` is how fast the head is served, in the engine's old stage
    // numbers. The bosses were all tuned as the fifth of brandon.html's five
    // stages, so they keep 4 whichever screen of a level they fall on.
    //
    // Only fourkeys.html loads this. The boss lab does not, so menu.js asks
    // for it with typeof, and falls back to going straight to the boss.
    const LV_BOSS = { dbg: 'BOSS', boss: true, pace: 4 };

    // How these are laid out, borrowed from the breakout games that got it
    // right, the way brandon.html's five stages were:
    //
    //   - brandon.html's bricks, exactly: seven across, every screen. The
    //     size is part of how the game feels to aim at, and a screen that
    //     wants to differ from it had better have a reason of its own.
    //   - one idea a screen: a staircase, a shaft, a bottle, a crater, a
    //     gate. The picture is the level's; the idea is what the screen is for.
    //   - every screen has a lane to the back of the wall -- a track, a
    //     street, a breach, open sides -- because a head loose behind the
    //     wall, rattling along the top, is the best moment breakout has.
    //     Better still is a chamber a head gets into and rattles round.
    //   - stone is architecture that holds something worth reaching (a
    //     crater, a gate), never a wall between you and the rest: no more
    //     than four a screen, none in the outside columns where it would shut
    //     a side lane, and no one-brick gap with stone on both sides of it.
    //   - short: about 20-30 hits a screen, as brandon.html's were, and room
    //     left on a second screen for the mini-boss who comes onto it.
    const LV_SETS = {
        // a barn: the roof a staircase, so nothing comes off it square, and
        // the door open all the way up into it
        1: [
            { dbg: 'FARM 1', pace: 0, silverHp: 2,
              rows: ['..RRR..',
                     '.ROOOR.',
                     'OOGGGOO',
                     'GG...GG',
                     'YY...YY'] },
            // two fields and the track between them, open from the bottom to
            // a gold bell at the top; a furrow across both for a head to run
            // along, and the MOLE comes up in whatever the fields have lost
            { dbg: 'FARM 2', pace: 1, silverHp: 2, mini: 'mole',
              rows: ['SYYAYYS',
                     'GGG.GGG',
                     '.......',
                     'OOO.OOO'] },
            LV_BOSS
        ],
        // an old wall in running bond with a breach knocked into it, the
        // shape of a bottle: a narrow neck at the foot, a wide belly, and a
        // gold keystone at the top. A head through the neck rattles round
        // the belly, chewing the old courses from inside
        2: [
            { dbg: 'RUINS 1', pace: 0, silverHp: 2,
              rows: ['SOYAYOS',
                     '>OY..YO',
                     'OY...YO',
                     '>O....O',
                     'YO...OY'] },
            // a colonnade: pillars with lanes between them under a cracked
            // silver lintel, two of the lanes running up through the cracks
            // to the back of it. The CONGA walks the floor under it, turning
            // at the one block that has fallen there. The pillars are two
            // high, with silver at their feet, so that block lies where the
            // line walks rather than down where it would crowd the paddle
            { dbg: 'RUINS 2', pace: 1, silverHp: 2, mini: 'conga',
              rows: ['S.SSS.S',
                     'Y.O.O.Y',
                     'O.S.S.O',
                     '.......',
                     '...X...'] },
            LV_BOSS
        ],
        // towers of every height with streets between them running all the
        // way up, one of them shut at the foot by a low house, and a silver
        // spire on the tallest
        3: [
            { dbg: 'CITY 1', pace: 0, silverHp: 2,
              rows: ['.....S.',
                     '.R...G.',
                     '.R.O.G.',
                     '.R.O.G.',
                     'YR.O.GY',
                     'YRYO.GY'] },
            // glass skybridges between the towers, each street a chamber
            // under one, and a gold plug in the middle tower; the BOOT comes
            // down on it all
            { dbg: 'CITY 2', pace: 1, silverHp: 2, mini: 'boot',
              rows: ['...S...',
                     '.R.S.G.',
                     '.RSOSG.',
                     'YR.A.GY',
                     'YR.O.GY'] },
            LV_BOSS
        ],
        // the mountain: a staircase on both sides and a shaft of lava up the
        // middle of it, and not a stone in it
        4: [
            { dbg: 'VOLCANO 1', pace: 0, silverHp: 2,
              rows: ['...R...',
                     '..ROR..',
                     '.OY.YO.',
                     'OYY.YYO',
                     'SYY.YYS'] },
            // up inside it: the crater, walled in stone and open at the top,
            // three bricks wide with a gold vent in it -- in through the shaft
            // or over the rim, and a head in there rattles; the SPLITTER
            // hangs over it all
            { dbg: 'VOLCANO 2', pace: 1, silverHp: 2, mini: 'splitter',
              rows: ['.X.A.X.',
                     '.XRORX.',
                     'OSY.YSO',
                     'OYY.YYO'] },
            LV_BOSS
        ],
        // silver battlements and towers, a gold keep, arrow slits, the
        // curtain wall, and a gate between two stone posts
        5: [
            { dbg: 'CASTLE 1', pace: 2, silverHp: 2,
              rows: ['S.S.S.S',
                     'SSSASSS',
                     'R.R.R.R',
                     'ROOOOOR',
                     'RX...XR'] },
            // the court behind the battlements is PONG's: an empty row under
            // the ceiling where he drops in on the first head to get up
            // there, and every head past him is one of his. Two sally lanes
            // run straight up either side of the keep to it, and what he
            // sends back comes down on the battlements from above. No stone:
            // nothing may keep a head from reaching him, or him from
            // sending it back down
            { dbg: 'CASTLE 2', pace: 3, silverHp: 2, mini: 'pong',
              rows: ['.......',
                     'S.SAS.S',
                     'R.OOO.R',
                     'R.O.O.R',
                     'Y.YYY.Y'] },
            LV_BOSS
        ]
    };

    // BOSS RUSH: nothing but bosses, one screen each, in the order given
    // (menu.js hands over each level's), the takeover between them
    function levelsRush(whos) {
        if (!lvBase) lvBase = LEVELS.slice();
        LEVELS.splice(0, LEVELS.length, ...whos.map(who =>
            Object.assign({}, LV_BOSS, { who, dbg: 'RUSH ' + who.toUpperCase() })));
    }

    // the engine's own stages, kept the first time a level replaces them
    let lvBase = null;

    // Stand level n's screens in the engine's LEVELS, or put its own back
    // with no n (the town, the VOID). LEVELS is a const, so it is refilled
    // rather than reassigned. False if n has no screens of its own.
    function levelsUse(n) {
        if (!lvBase) lvBase = LEVELS.slice();
        const set = n ? LV_SETS[n] : lvBase;
        if (!set) return false;
        LEVELS.splice(0, LEVELS.length, ...set);
        return true;
    }
