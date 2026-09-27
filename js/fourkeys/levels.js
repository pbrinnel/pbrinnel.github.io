'use strict';

    // ---- FOUR KEYS: the levels ---------------------------------------------------------
    // Each of the five buildings in the town is three screens, walked in order:
    // a wall, the same wall grown bigger with a mini-boss riding it, then the
    // level's boss. The VOID is not here -- it is one fight and nothing else,
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

    const LV_SETS = {
        // two fields either side of a track, sown in rows with a furrow between
        1: [
            { dbg: 'FARM 1', pace: 0, silverHp: 2,
              rows: ['YYYY.YYYY',
                     '.........',
                     'GGGG.GGGG',
                     '....S....',
                     'OOOO.OOOO'] },
            // two rows sown to a furrow now, and a gold barn in the track
            { dbg: 'FARM 2', pace: 1, silverHp: 2, mini: 'mole',
              rows: ['SYYY.YYYS',
                     'YYYY.YYYY',
                     '.........',
                     'GGGGAGGGG',
                     'OOOO.OOOO'] },
            LV_BOSS
        ],
        // a wall in running bond, fallen in along the top and holed through,
        // standing between stone
        2: [
            { dbg: 'RUINS 1', pace: 0, silverHp: 2,
              rows: ['Y...O..Y.',
                     '>YO..OY.O',
                     'OYOY.YOYO',
                     '>YO.OY.YO',
                     'X.OYOYO.X'] },
            // taller, weathered to silver in places, and more stone in it
            { dbg: 'RUINS 2', pace: 1, silverHp: 2, mini: 'conga',
              rows: ['X.S...S.X',
                     '>.SO.OS.Y',
                     'XOYOSOYOX',
                     '>YOYOYOYO',
                     'XOYO.OYOX'] },
            LV_BOSS
        ],
        // towers with streets between, the tallest wearing a silver spire
        3: [
            { dbg: 'CITY 1', pace: 0, silverHp: 2,
              rows: ['....S....',
                     '.R..O..G.',
                     '.R..O..G.',
                     '.RY.O.YG.',
                     'YRY.O.YGY',
                     'YRY.O.YGY'] },
            // more of it glass, and every tower topped out
            { dbg: 'CITY 2', pace: 1, silverHp: 2, mini: 'boot',
              rows: ['....S....',
                     '.R..S..G.',
                     '.RS.O.SG.',
                     'YRS.O.SGY',
                     'YRO.A.OGY',
                     'YRO.O.OGY'] },
            LV_BOSS
        ],
        // three peaks with lava at the vents and rock in the valleys
        4: [
            { dbg: 'VOLCANO 1', pace: 0, silverHp: 2,
              rows: ['....R....',
                     '.R.ROR.R.',
                     'RORXOXROR',
                     'OSOYYYOSO'] },
            // higher, the middle vent gone to gold, and rock round the foot
            { dbg: 'VOLCANO 2', pace: 1, silverHp: 2, mini: 'splitter',
              rows: ['....A....',
                     '.R..R..R.',
                     '.O.ROR.O.',
                     'ROROSOROR',
                     'OSOXYXOSO',
                     'XYYYYYYYX'] },
            LV_BOSS
        ],
        // two towers and a keep, a wall between them and a gate through it
        5: [
            { dbg: 'CASTLE 1', pace: 2, silverHp: 2,
              rows: ['S.S...S.S',
                     'SSS.A.SSS',
                     'RXR.R.RXR',
                     'ROR.O.ROR',
                     'ROOOOOOOR',
                     'RYYX.XYYR',
                     'XYY...YYX'] },
            // the battlements gilded and the wall reinforced, with PONG lying
            // along the ceiling behind it
            { dbg: 'CASTLE 2', pace: 3, silverHp: 2, mini: 'pong',
              rows: ['S.S.A.S.S',
                     'SSS.A.SSS',
                     'AXR.R.RXA',
                     'ROR.O.ROR',
                     'ROSOSOSOR',
                     'RYYX.XYYR'] },
            LV_BOSS
        ]
    };

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
