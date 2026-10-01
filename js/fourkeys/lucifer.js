'use strict';

    // ---- LUCIFER (boss) ---------------------------------------------------------------
    // The VOID's end, and the game's. The Fallen, as the memories draw him: a
    // body with a ball for a head, arms of bone that are each nine little
    // brandons, and in each hand three small ones going round a ball of
    // energy nobody can see. The arms' eighteen pieces are the first two
    // parts. Each arm leaves his shoulder whenever it likes, flies apart and
    // puts itself back together as something else, and always comes home to
    // being an arm:
    //
    //   CLAW   an open hand that follows the head and catches it: a moment
    //          held, SLUGGISH on you, and thrown where you are not
    //   PALM   laid flat into a paddle of his own, meeting shots from below
    //   FIST   balled up over you, following you, then down: under it and
    //          you are SLUGGISH
    //   BEAM   the hand hangs over you, the little ones in it close in and
    //          spin up, and it fires straight down, one shot: under it
    //          as it fires and you are STUNNED, then SLUGGISH; what is left
    //          of it after is only light. Knock all three of its little ones
    //          away first and it never fires
    //   TREE   HIS tree, stolen and gone bad: it grows down out of the hand,
    //          a wall of branches, and birds sit in it that come down at you
    //   CAGE   a ring of bone turning round his head
    //   CLAP   both hands, open either side of the head's way up, shut on
    //          it as it arrives. They reach through it, so they are no wall
    //   WINGS  a wing out of each shoulder, built as the Corrupted's six are:
    //          each arm's pieces are its long feathers, a feather at a time.
    //          With them out he swoops: up to one side, then down across the
    //          field in an arc toward you and up the far side. Anything of his
    //          that meets a head on the way down spikes it back at you
    //
    // Hits on him hurt him, and he shakes with each. Hits on a hand put that
    // hand back together as an arm after LU_FORM_HP of them; a feather is
    // knocked clean off and grows back. A branch hit snaps, with everything
    // below it, and stays gone.
    //
    // The first part ends when its bar is empty. He staggers (LU_REEL), the
    // world held; the first time, the game's last memory plays over the
    // fight here -- how he fell, which nothing of the change can yet give
    // away -- and then his bar visibly grows back (LU_REFILL12) to the
    // second part's LU_HP2 + LU_DRAIN_LEFT, and you serve again. The drain
    // starts once LU_DRAIN_LEFT is left of that -- a sliver.
    //
    // What a hit can do is on the picture: anything it would do nothing to
    // is stone -- his body while he is out of reach, an arm at rest -- and the
    // clap, which a head goes straight through, is only half there.
    //
    // Beating the second part is a scene, not a fight: the world holds still
    // and your head is put away, then a hand reaches down and your light runs up
    // it into him -- you go grey -- and with it he changes, his bar filling
    // as he does, the one time it ever goes up. You serve again when he is
    // done. His arms fly up into wheels round his head and turn red, the
    // black opens round him, his body withers into his head and drops off,
    // and six wings grow out of the head. That is the last part, and every
    // piece of him is a brick: a hit on a wheel takes LU_WHEEL_CHUNK of its
    // bones, a hit on a wing takes its outermost layer (the long feathers,
    // then the rest, then the bone). The crown is what shields his head:
    // any head that gets through it to him hurts him. His bar is every piece
    // of the crown and LU_HEAD_HP more, a hit on either taking one off it. Every piece of
    // health you take runs down into you as HIS light, until you have all of
    // it, and your colour comes back with it; his wings tire from LU_LIMP_AT
    // of it left, and from LU_GREY_AT he goes grey and flashes red when hit.
    // He fires his eyes at you, and grows the tree down out of his head. What
    // you knock off his crown grows back after LU_CROWN_REGROW, as armour to
    // break again, drawn as a dim husk: a piece costs him health only the
    // first time.
    //
    // He never heals: his bar goes up once, in the change, and never otherwise.
    //
    // He dies saying so, and burns away to ash just as the last hit left
    // him, glitching and all. Then you stand up where
    // you lay, plain -- no paddle of yours, no capsule -- grow to his height and
    // become the new Odin, and say his name: BRANDON WINS, and back to the town.
    let LU_LVL        = 6;
    let LU_HP1        = 8;      // hits to end the first part
    let LU_HP2        = 10;     // ...the second
    let LU_DRAIN_LEFT = 1;      // ...and the hits' worth left on his bar when he drains you
    let LU_SHAKE      = 6;      // px he shakes when a hit hurts him
    let LU_SHAKE_SECS = 0.35;   // ...dying away over this long
    let LU_HEAD_HP    = 8;      // his head's share of his last bar, on top of his crown's
    let LU_WHEEL_CHUNK = 2;     // bones of a wheel one hit takes
    let LU_L          = 230;    // how tall he stands
    let LU_Y          = 210;    // where his middle hangs
    let LU_Y3         = 300;    // ...once he has changed, lower, so his wings fit over him
    let LU_DRIFT      = 110;    // px he drifts either side
    let LU_DRIFT_RATE = 0.3;    // rad/s of that
    let LU_HOME       = 150;    // px out from him a hand waits, between shapes
    let LU_FORM_HP    = 3;      // hits that put a hand back together as an arm
    let LU_FORM_SECS  = 9;      // how long he holds a shape, unbroken
    let LU_REST       = 1.6;    // seconds between one shape and the next
    let LU_REST3      = 2.2;    // ...and between one attack and the next, in the last part
    let LU_REFORM     = 0.5;    // seconds a piece takes to fly to a new place
    let LU_STAGGER    = 0.25;   // ...the shoulder first and the fingertip this much later
    let LU_PACE2      = 1.2;    // how much quicker everything is in the second part
    let LU_PACE3      = 1.45;   // ...and the last
    let LU_CLAW_Y     = 300;    // the line the claw hunts along
    let LU_CLAW_SPEED = 170;    // px/s it follows the head
    let LU_CLAW_HOLD  = 0.9;    // seconds it holds one
    let LU_CLAW_DRAG  = 2.5;    // SLUGGISH a catch leaves on you
    let LU_PALM_Y     = 290;    // the line his own paddle lies on
    let LU_PALM_SPEED = 260;    // px/s it moves to meet a head
    let LU_FIST_Y     = 250;    // where the fist hangs while it follows you
    let LU_FIST_TRACK = 220;    // px/s it follows you
    let LU_FIST_AIM   = 1.6;    // seconds it follows before it drops
    let LU_FIST_G     = 2600;   // px/s² it falls at
    let LU_FIST_REST  = 0.7;    // seconds it lies on the floor
    let LU_FIST_RISE  = 380;    // px/s it goes back up
    let LU_FIST_SLAMS = 2;      // drops in one shape
    let LU_FIST_DRAG  = 3;      // SLUGGISH it leaves on you
    let LU_FIST_R     = 34;     // how far either side of its middle it lands on you
    let LU_CAGE_R     = 80;     // px round his head the cage turns
    let LU_CAGE_SPIN  = 1.1;    // rad/s of that
    let LU_CAGE_SECS  = 10;     // how long it stays up, unbroken
    let LU_CLAP_Y     = 310;    // the line the clap waits on
    let LU_CLAP_GAP   = 150;    // px either side of the middle the hands wait open
    let LU_CLAP_SHUT  = 0.22;   // seconds to shut
    let LU_CLAP_REACH = 150;    // px below them a head can set them off from
    let LU_WING_SECS  = 10;     // how long the wings stay out
    let LU_WING2_SPAN = 190;    // ...a wing's spine, rig px
    let LU_WING2_DEG  = -35;    // ...and where it points (right side, 0 out, -90 up)
    let LU_SWOOP_X    = 250;    // px either side of the middle a swoop runs from and to
    let LU_SWOOP_DEPTH = 170;   // ...how far below his line it comes, at the bottom of it
    let LU_SWOOP_WIND = 0.7;    // seconds going up to its start, wings raised, which is the tell
    let LU_SWOOP_SECS = 0.95;   // ...the swoop itself
    let LU_SWOOP_HOME = 0.8;    // ...and back to where he drifts
    let LU_SWOOP_REST = 1.2;    // seconds between one swoop and the next
    let LU_SWOOPS     = 2;      // swoops in one set of wings
    let LU_SPIKE      = 1.35;   // how much faster than the rally a head he spikes comes down...
    let LU_SPIKE_CAP  = 420;    // ...but never faster than this, px/s, so it can always be caught
    let LU_REGROW     = 6;      // seconds a knocked-off feather or little one takes to grow back
    let LU_BEAM_Y     = 230;    // the line a hand hangs on to fire down
    let LU_BEAM_CHARGE = 1.5;   // seconds a beam gathers, following you, before it fires
    let LU_BEAM_TRACK = 150;    // px/s it follows you while it gathers
    let LU_BEAM_SECS  = 0.8;    // seconds the shot takes to die away; it only hurts as it fires
    let LU_BEAM_W     = 26;     // px across
    let LU_BEAM_STUN  = 1.5;    // seconds it holds you still, STUNNED...
    // The last part's beam, from his head, is his strongest: it held you too
    // long, gave too little warning and stayed out too long to tell when it
    // was safe. So it stops following you LU_BEAM_LOCK3 before it fires --
    // the line goes solid where it will land -- dies away sooner, and holds
    // you for less.
    let LU_BEAM_LOCK3 = 0.45;   // seconds it stands still, marked, before it fires
    let LU_BEAM_SECS3 = 0.45;   // seconds it takes to die away
    let LU_BEAM_STUN3 = 0.9;    // seconds it holds you
    let LU_BEAM_DRAG  = 2.5;    // ...and the SLUGGISH it leaves on you after
    let LU_BEAM_LOOK12 = 0.55;  // how bright a hand's beam is next to the last part's, so that one lands
    let LU_TREE_Y     = 150;    // the line a hand hangs on to grow the tree down from
    let LU_TREE_OUT   = 170;    // px out from his middle it hangs, on its own side
    let LU_TREE_LEN   = 64;     // px long the tree's first branches are; each fork shorter
    let LU_TREE_GROW  = 0.8;    // seconds a branch takes to grow out
    let LU_TREE_SECS  = 10;     // how long a tree stands
    let LU_BIRD_WAIT  = 1.2;    // seconds a bird sits in the grown tree before it comes (the second, twice)
    let LU_BIRD_Y     = 330;    // the line it circles on while it picks you out
    let LU_BIRD_AIM   = 1;      // seconds of that
    let LU_BIRD_SPEED = 480;    // px/s it dives at
    let LU_BIRD_DRAG  = 2;      // SLUGGISH it leaves on you
    let LU_REEL       = 2.2;    // seconds he staggers once the first part's bar is empty
    let LU_REEL_SHAKE = 2.2;    // ...shaking this many times as hard as a hit shakes him
    let LU_REFILL12   = 1.6;    // seconds his bar takes to grow back for the second part
    let LU_DRAIN_SECS = 3;      // seconds he drains you before he changes
    // the change, as the character lab has it (brandon-characters.html, 2 → 3)
    let LU_CORRUPT_SECS = 10;   // its first part: arms up into the wheels, redden, wither
    let LU_WITHER     = 0.6;    // his body's size, as a share of him, by the time it drops off
    let LU_SLUMP      = 12;     // degrees his body sags off his head, withered all the way
    let LU_HEAD_SIZE  = 3;      // his head once he has changed, times the Angel's
    let LU_HEAD_GROW_SECS = 3.5;   // seconds it takes to grow, from when he starts to wither
    let LU_RING_GROW_SECS = 3.5;   // ...his wheels
    let LU_WING_GROW_SECS = 4.5;   // ...and his wings
    let LU_WING_LEAD  = 1.5;    // seconds before his body falls that the wings start
    let LU_HANG_SECS  = 1.6;    // seconds his body hangs off him, dropping, before it falls free
    let LU_THREAD     = 0.9;    // ...how far it drops, as a share of him
    let LU_HANG_SWING = 14;     // ...and swings, degrees either side
    let LU_SHED_FALL  = 1.6;    // seconds it takes to fall away
    let LU_SHADOW     = 0.75;   // how near a flat silhouette he goes while he changes
    let LU_REVEAL     = 2;      // seconds it takes to lift, ending as he finishes
    let LU_RING_R     = 154;    // how far out his wheels turn, at his rig's size
    let LU_RING_BONES = 6;      // bones round each wheel
    let LU_RING_SPEED = 1.2;    // how fast everything in the crown turns
    let LU_EYE_SIZE   = 19;     // a face on a wheel, rig px
    let LU_WING_SPAN  = 122;    // a wing's spine, rig px
    let LU_WING_BEAT  = 1;      // how far the wings beat
    let LU_LIMP_AT    = 0.5;    // share of the last part's health left when his wings start to tire
    let LU_LIMP_DROOP = 0.5;    // ...how far toward hanging straight down they have sunk at the end
    let LU_GREY_AT    = 0.25;   // share left when the grey starts coming into him
    let LU_GLITCH     = 1;      // how hard his head glitches at the end (see luGlitch)
    let LU_GLITCH_AT  = 0.5;    // ...starting from nothing at this share of his health left
    let LU_CROWN_REGROW = 30;   // seconds before a knocked-off piece of the crown starts growing back
    let LU_CROWN_GROW_IN = 7.5; // ...and how long it takes; a head goes through it until it has
    let LU_DIE_TYPE   = 16;     // letters a second, his last words
    let LU_DIE_HOLD   = 1.8;    // seconds on them before he goes
    let LU_ODIN_GLOW  = 0.55;   // how bright HIS light is under you, all of it taken
    // the end: seconds for each beat, and how tall you stand at the last
    let LU_END_CRUMBLE = 3;     // him burning away
    let LU_END_STAND  = 1.4;    // you standing up, from partway into that
    let LU_END_GROW   = 2.2;    // you growing, from partway into that
    let LU_END_ODIN_L = 330;    // ...to this tall
    let LU_END_MORPH  = 4.5;    // you becoming him, from as you start to grow
    let LU_END_SURGE  = 1.5;    // ...his light swelling this much more than his own as you do
    let LU_END_SETTLE = 2;      // ...and back to his own over this, from BRANDON!
    let LU_END_SWAP   = 1.4;    // your paddle becoming the standard one, as he starts to burn
    let LU_END_HOLD   = 2.6;    // BRANDON!, held
    let LU_END_WINS   = 4;      // BRANDON WINS, over you as Odin
    let LU_END_OUT    = 0.8;    // ...then the black, and the town
    LAB_KNOBS.push('LU_GLITCH', 'LU_GLITCH_AT', 'LU_DRAIN_LEFT', 'LU_SHAKE', 'LU_SHAKE_SECS', 'LU_WING2_SPAN', 'LU_WING2_DEG',
                   'LU_CROWN_REGROW', 'LU_CROWN_GROW_IN', 'LU_END_CRUMBLE', 'LU_END_STAND', 'LU_END_GROW',
                   'LU_END_ODIN_L', 'LU_END_MORPH', 'LU_END_SURGE', 'LU_END_SETTLE', 'LU_END_SWAP',
                   'LU_END_HOLD', 'LU_END_WINS', 'LU_END_OUT');
    LAB_KNOBS.push('LU_LVL', 'LU_HP1', 'LU_HP2', 'LU_HEAD_HP', 'LU_WHEEL_CHUNK', 'LU_L', 'LU_Y', 'LU_Y3',
                   'LU_DRIFT', 'LU_DRIFT_RATE', 'LU_HOME', 'LU_FORM_HP', 'LU_FORM_SECS', 'LU_REST', 'LU_REST3',
                   'LU_REFORM', 'LU_STAGGER', 'LU_PACE2', 'LU_PACE3', 'LU_CLAW_Y', 'LU_CLAW_SPEED', 'LU_CLAW_HOLD',
                   'LU_CLAW_DRAG', 'LU_PALM_Y', 'LU_PALM_SPEED', 'LU_FIST_Y', 'LU_FIST_TRACK', 'LU_FIST_AIM',
                   'LU_FIST_G', 'LU_FIST_REST', 'LU_FIST_RISE', 'LU_FIST_SLAMS', 'LU_FIST_DRAG', 'LU_FIST_R',
                   'LU_CAGE_R', 'LU_CAGE_SPIN', 'LU_CAGE_SECS', 'LU_CLAP_Y', 'LU_CLAP_GAP', 'LU_CLAP_SHUT',
                   'LU_CLAP_REACH', 'LU_WING_SECS', 'LU_REGROW',
                   'LU_SWOOP_X', 'LU_SWOOP_DEPTH', 'LU_SWOOP_WIND', 'LU_SWOOP_SECS', 'LU_SWOOP_HOME',
                   'LU_SWOOP_REST', 'LU_SWOOPS', 'LU_SPIKE', 'LU_SPIKE_CAP', 'LU_BEAM_Y', 'LU_BEAM_CHARGE', 'LU_BEAM_TRACK',
                   'LU_BEAM_SECS', 'LU_BEAM_W', 'LU_BEAM_STUN', 'LU_BEAM_LOCK3', 'LU_BEAM_SECS3', 'LU_BEAM_STUN3', 'LU_BEAM_DRAG', 'LU_BEAM_LOOK12', 'LU_TREE_Y', 'LU_TREE_OUT', 'LU_TREE_LEN',
                   'LU_TREE_GROW', 'LU_TREE_SECS', 'LU_BIRD_WAIT', 'LU_BIRD_Y', 'LU_BIRD_AIM', 'LU_BIRD_SPEED',
                   'LU_BIRD_DRAG', 'LU_REEL', 'LU_REEL_SHAKE', 'LU_REFILL12', 'LU_DRAIN_SECS', 'LU_CORRUPT_SECS', 'LU_WITHER', 'LU_SLUMP',
                   'LU_HEAD_SIZE', 'LU_HEAD_GROW_SECS', 'LU_RING_GROW_SECS', 'LU_WING_GROW_SECS', 'LU_WING_LEAD',
                   'LU_HANG_SECS', 'LU_THREAD', 'LU_HANG_SWING', 'LU_SHED_FALL', 'LU_SHADOW', 'LU_REVEAL',
                   'LU_RING_R', 'LU_RING_BONES', 'LU_RING_SPEED', 'LU_EYE_SIZE', 'LU_WING_SPAN', 'LU_WING_BEAT',
                   'LU_LIMP_AT', 'LU_LIMP_DROOP', 'LU_GREY_AT', 'LU_DIE_TYPE', 'LU_DIE_HOLD', 'LU_ODIN_GLOW');

    // The shapes, in the order he makes them, one list for each hand-held
    // part. A move is what each hand does (L, R) or what both do together
    // (B); the next one starts once every hand in the last has come home.
    // The last part has no hands, only what he does himself.
    const LU_MOVES = {
        1: [{ L: 'claw' }, { R: 'palm' }, { L: 'beam' }, { R: 'fist' }, { R: 'claw' }, { L: 'palm' },
            { R: 'beam' }, { L: 'fist' }],
        2: [{ L: 'claw', R: 'fist' }, { L: 'tree', R: 'palm' }, { B: 'clap' }, { L: 'beam', R: 'claw' },
            { B: 'wings' }, { L: 'cage', R: 'tree' }, { L: 'fist', R: 'beam' }],
        3: ['beam', 'tree', 'beam', 'beam', 'tree']
    };
    const LU_LAST = 'You have returned?!?';

    // His rig, as the memories and the character lab draw him, at LU_RIG
    // tall: the numbers are the same so they stay one person. A pose is a
    // lean in degrees and where the ball sits on his shoulders; bones are
    // [length, degrees, thickness], 0 pointing right and -90 up, the left the
    // mirror.
    const LU_RIG = 360;
    const LU_FALLEN = { lean: 14, headDx: 10, headDy: -12, headTurn: -15.5, headSway: 9.5, headSize: 1.69 };
    const LU_ANGEL  = { lean: 3,  headDx: 3,  headDy: -22, headTurn: 0,     headSway: 2.5, headSize: 1.3 };
    const LU_ANGEL_BOB = 5;          // rig px he floats up and down, straightened
    const LU_SHOULDER = [0.80, 0.42];
    const LU_BONES = {
        arm0: [95, 30, 40], arm1: [110, -75, 36], palm: [42, -100, 38],
        f10: [52, -112, 27], f11: [42, -152, 23], f12: [32, -192, 19],
        f20: [46, -80, 25], f21: [38, -122, 21], f22: [28, -166, 17]
    };
    // each piece of an arm, and when in a re-forming it sets off (0 the
    // shoulder, 1 the fingertips)
    const LU_PIECES = [['arm0', 0], ['arm1', 0.2], ['palm', 0.4],
                       ['f10', 0.6], ['f11', 0.8], ['f12', 1],
                       ['f20', 0.6], ['f21', 0.8], ['f22', 1]];
    const LU_TIP = 160;              // rig px below a reaching palm's middle its fingertips end
    const LU_CLAY = '#c48a6c';       // the Fallen's hands, the memories' clay
    const LU_SHIRT = '#141418';      // ...darkening up his arms into his shirt
    // how far into LU_SHIRT a bone is, by where it sits on the arm: the hand
    // clay, the forearm between, the upper arm nearly black
    const luArmDark = order => luEase((0.5 - order) / 0.5);
    // The little ones in his hands: each rides its own ring, tipped its own
    // way, round a middle measured off his wrist, in the three colours of him
    // that never drained. Rig px and degrees, as the lab has them.
    const LU_ORB_TINTS = ['#c9a94e', '#6f7f4e', '#9e4b3c'];
    const LU_ORB_TILTS = [-25, 55, 15];
    const LU_ORB_SPEEDS = [1, -0.8, 0.65];
    const LU_ORB_ALONG = 58, LU_ORB_ACROSS = -65, LU_ORB_R = 25, LU_ORB_BONE = 86;
    const LU_ORB_PERIOD = 9.9;       // seconds for one to go round, at speed 1
    const LU_REDS = ['#c21f32', '#8f1424', '#d8402c'];
    const LU_RED_BODY = '#c4182c';   // what goes over his head as he turns
    const LU_GREY_BODY = '#4f4a45';  // ...and over his body, withering
    const LU_EYES = [[0.29, 0.52], [0.63, 0.51]];   // his eyes in ball.webp, as shares of it
    // ...and where more open once his body has gone: brow, temples, beside his
    // nose, cheeks, jaw, chin
    const LU_MORE_EYES = [[0.40, 0.30], [0.60, 0.28], [0.24, 0.37], [0.76, 0.36], [0.14, 0.52], [0.85, 0.50],
                          [0.46, 0.43], [0.35, 0.65], [0.69, 0.63], [0.52, 0.86], [0.22, 0.73], [0.80, 0.72]];
    const LU_GOLD = '#e8b64c';       // HIS, which you take back
    const LU_SUN_GOLDS = ['#c9a94e', '#bd7f3f'];   // HIS wheel of Brandons, as the memories have it
    const LU_SUN_N = 20;             // ...one for every share of him you take
    const LU_BREAKS = ['claw', 'palm', 'fist', 'cage', 'beam', 'tree'];

    // The Corrupted, from the character lab. Wheels: a ring round his head
    // tipped over by `tilt`, turned to face `yaw`, swinging round its own
    // axis at `turn` while its bones run along it at `run`.
    const LU_WHEELS = [
        { tilt: 78, yaw: 0,   turn: 0.35,  run: 0.5,  r: 1 },
        { tilt: 20, yaw: 60,  turn: -0.27, run: -0.4, r: 0.92 },
        { tilt: 52, yaw: 125, turn: 0.2,   run: 0.33, r: 0.84 }
    ];
    // Six wings out of his head, up in a V, out, and down: where each spine
    // points (right side), its size, and the way its feathers sweep off it.
    const LU_SERAPH = [
        { deg: -64, len: 1,    trail: 1 },
        { deg: -4,  len: 1.1,  trail: 1 },
        { deg: 60,  len: 0.95, trail: -1 }
    ];
    // Each wing in rows: flight feathers, a row over their roots, small ones
    // along the top ([how many, where along the spine, swept how far,
    // how long, how much lighter]); then the wing's bone over them all.
    const LU_WING_ROWS = [
        { n: 10, at: [0.1, 1],     sweep: [82, 12], len: [0.34, 1.1],  lift: 0 },
        { n: 7,  at: [0.06, 0.78], sweep: [70, 34], len: [0.26, 0.46], lift: 0.1 },
        { n: 5,  at: [0.03, 0.55], sweep: [46, 28], len: [0.17, 0.25], lift: 0.18 }
    ];
    // The Fallen's two wings are the same, but their long feathers are his arm's
    // nine pieces, one to each; the rows over them and the bone only look.
    const LU_HUSK = 0.4;             // how solid a piece of the crown that has grown back is drawn
    const LU_WING2_ROWS = [Object.assign({}, LU_WING_ROWS[0], { n: LU_PIECES.length }), LU_WING_ROWS[1], LU_WING_ROWS[2]];
    const LU_WING_BONES = 4;         // joints in each wing's bone, a piece to each
    const LU_WING_SHADOW = 5;        // rig px a feather's shadow falls off it
    const LU_WING_EYES = [[0.1, 0.03, 0.07], [0.26, 0.07, 0.085], [0.42, 0.03, 0.06],
                          [0.58, 0.065, 0.075], [0.74, 0.03, 0.055], [0.9, 0.05, 0.06]];
    const LU_WING_FLAP = { period: 2.4, lag: 0.1, swing: [5, 8, 11, 14], feather: 5, featherLag: 0.08 };
    const LU_WING_INK = '#2a0508', LU_WING_LIGHT = '#8a2a33';
    const LU_RING_START = 0.77;      // the wheels' size, as a share of it finished, before they grow
    const LU_SHED_BEAT = 0.5;        // seconds withered and whole before the body lets go
    const LU_HANG_SWING_SECS = 1.1;  // one swing of it, there and back
    const LU_SHED_DROP = 1500;       // rig px/s² it falls at, once free
    const LU_WITHER_FROM = 0.5, LU_WITHER_TO = 0.85;   // his withering, as shares of LU_CORRUPT_SECS
    const LU_SHADOW_IN = 1.5;        // seconds the silhouette takes to gather
    const LU_SILHOUETTE = '#1c080b';
    // HIS tree gone bad: forks of Brandons in his reds and near-blacks, down
    // instead of up, with an eye at every tip
    const LU_TREE_DEPTH = 3, LU_TREE_SPREAD = 24, LU_TREE_SHRINK = 0.74;
    const LU_TREE_INKS = ['#2a0508', '#5a0f18', '#8f1424'];
    const LU_BIRD_INK = '#1a0a0e', LU_BIRD_S = 30;     // HIS birds, blacked, edged red

    let lu = null;

    LAB_BOSS.lucifer = {
        start: luStart,
        // cleared partway through the end, you get your own paddle back
        reset() { if (lu && lu.stage === 'end') labPadUse(LAB.pad); lu = null; },
        update: luUpdate,
        contact: luContact,
        touch: luTouch,
        glances: luGlances,
        hit: luHit,
        draw: luDraw,
        drawFall() {},                  // he never falls: the end is his own (luDrawEnd)
        holds(ball) { return !!lu && (lu.frozen.has(ball) || lu.hands.some(h => h.held === ball)); },
        climb() { return 0; },
        // your head is put away while he drains you and changes, and from his death on
        skipBall() { return !!lu && ['drain', 'turn', 'dying', 'end'].includes(lu.stage); },
        // you, drained grey; and at the end standing up, growing, and giving way to Odin
        padSkin(sg, o) { if (lu && lu.grey > 0.001) padLay(sg, o, greySprite(), lu.grey); },
        lift() { return lu && lu.stage === 'end' ? luEndPose().stand * (padW() / 2 - padH() / 2) : 0; },
        rock() { return lu && lu.stage === 'end' ? luEndPose().stand * LU_STAND_TURN : 0; },
        // to LU_END_ODIN_L from however long you are without it, which BIG and
        // your paddle's own length are still easing out of
        padGrow() {
            if (!lu || lu.stage !== 'end') return 1;
            const base = Math.max(paddle.w, PADDLE_W * (1 + CLIMB_GROW * climb)) * lifeScale() * labPadLen();
            return luLerp(1, LU_END_ODIN_L / base, luEndPose().grow);
        },
        padAlpha() { return lu && lu.stage === 'end' ? 1 - luEndPose().morph : 1; },
        fence() { if (lu && lu.stage === 'end') paddle.x = paddle.tx = luLerp(lu.end.x, LW / 2, luEndPose().stand); },
        drawTop() {
            if (lu && lu.stage === 'end') luDrawEndTop();
            if (lu && lu.mem) menuUnlockDraw();
        },
        // the lab's jumps
        acts: {
            one(b) { luJump(b, 1); return true; },
            // the first part's last hit landed: the stagger, and the memory if it is still to earn
            reel(b) { luJump(b, 1); b.hp = 0; luNext(b); return true; },
            two(b) { luJump(b, 2); return true; },
            drain(b) { luJump(b, 2); b.hp = LU_DRAIN_LEFT; luNext(b); return true; },
            turn(b) { this.drain(b); luTurnStart(); return true; },
            three(b) { luJump(b, 3); return true; },
            // his wings starting to tire, and the grey starting
            limp(b) { luJump(b, 3); luStrip(b, Math.floor(b.maxHp * LU_LIMP_AT)); return true; },
            grey(b) { luJump(b, 3); luStrip(b, Math.floor(b.maxHp * LU_GREY_AT)); return true; },
            // one hit from his last words: nothing left but his head
            last(b) { luJump(b, 3); luStrip(b, 1); return true; },
            // ...and that hit landed
            death(b) { this.last(b); b.hp = 0; luNext(b); return true; },
            // ...and his words are said: you stand up
            odin(b) { this.death(b); luEndStart(); return true; }
        },
        // the next hit ends whichever part is up
        finish(b) {
            if (lu.stage === 3) luStrip(b, 1);
            else if (lu.stage === 1) b.hp = Math.min(b.hp, 1);
            else b.hp = Math.min(b.hp, LU_DRAIN_LEFT + 1);
            return true;
        },
        state(b) {
            const what = h => h.form + (h.form === 'fist' ? ' ' + h.st : '') + (h.hits ? ' ×' + h.hits : '');
            const line = lu.stage === 3 ? 'part 3 · crown ' + luCrownLeft() + ' · head ' + (b.hp - luCrownLeft()) +
                                          (lu.attack ? ' · ' + lu.attack.kind : '')
                                        : 'part ' + lu.stage + ' · L ' + what(lu.hands[0]) + ' · R ' + what(lu.hands[1]);
            return { name: 'LUCIFER', hp: b.hp, max: b.maxHp, line: line + (luArmoured() ? ' · out of reach' : '') };
        }
    };

    // the second part's bar, which the drain ends a sliver short of
    const luHp2 = () => LU_HP2 + LU_DRAIN_LEFT;

    function luStart(b) {
        b.hp = b.maxHp = LU_HP1;
        bossServed = true;              // he says nothing until the end
        lu = { t: 0, x: LW / 2, y: -LU_L, stage: 1, stT: 0, mi: 0, restT: LU_REST, stone: 0, wither: 1, sec: 0,
               frozen: new Map(), motes: [], moteAcc: 0, slams: [], clap: null, pend: null, bd: null, cf: null,
               pieces: [], orbs: [], trees: [], birds: [], beams: [], debris: [], crown: null, now: null,
               attack: null, wingPh: 0, limp: 0, odin: 0, odinShow: 0, flash3: 0, shake: 0, grey: 0,
               refill: 0, end: null, perish: null, ash: [],
               swoop: null, sw: null, swoops: 0, swoopRest: 0,
               hands: [-1, 1].map(side => ({ side, form: 'arm', t: 0, hits: 0,
                   done: false, st: '', stT: 0, x: LW / 2 + side * LU_HOME, y: LU_Y, vy: 0, open: 0,
                   held: null, holdT: 0, slams: 0, tree: null, beam: null, charge: 0, wingK: 0, deco: [] })) };
        for (const side of [-1, 1]) {
            LU_PIECES.forEach(([bone, order], i) => lu.pieces.push({
                side, i, bone, order, dark: luArmDark(order), len: LU_BONES[bone][0], thick: LU_BONES[bone][2],
                x: 0, y: 0, a: 0, s: 1, from: null, k: 1, delay: 0, flash: 0, gone: 0, stone: 1,
                fvx: 0, fvy: 0, fva: 0, back: false, wing: 0, tone: 0, tr: 1 }));
            for (let ri = 0; ri < 3; ri++) {
                lu.orbs.push({ side, ri, tint: LU_ORB_TINTS[ri], ph: (side > 0 ? 1.3 : 0) + ri * 2.1,
                               cx: null, cy: null, x: 0, y: 0, a: 0, len: 0, z: 0, gone: 0, flash: 0,
                               fvx: 0, fvy: 0, fva: 0 });
            }
        }
        luBox(b);
        luPose();
        for (const p of lu.pieces) Object.assign(p, luSlot(p));
    }

    // the box the physics looks in: the whole field above the floor, since
    // his hands go anywhere in it
    function luBox(b) {
        b.x = 0; bw = LW;
        b.y = 0; bh = Math.max(100, padY() - padH() - 30);
    }

    const luClamp = x => Math.max(0, Math.min(1, x));
    const luEase = x => { x = luClamp(x); return x * x * (3 - 2 * x); };
    const luLerp = (a, b, k) => a + (b - a) * k;
    const luAng = (a, b, k) => a + (((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) * k;
    const luToward = (x, to, step) => x + Math.max(-step, Math.min(step, to - x));
    const luHash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
    function luHand(side) { return lu.hands[side < 0 ? 0 : 1]; }
    function luPace() { return lu.stage === 3 || lu.stage === 'dying' ? LU_PACE3 : lu.stage === 1 ? 1 : LU_PACE2; }
    function luActive(h) { return h.form !== 'arm'; }
    // the Corrupted is up: changing, or changed
    function luCorrupted() { return ['turn', 3, 'dying', 'end'].includes(lu.stage); }

    // Nothing reaches him in the breath between parts, or while he drains
    // you and changes, or while he speaks.
    function luArmoured() { return ['break', 'drain', 'turn', 'dying', 'end'].includes(lu.stage); }

    // ---- his body --------------------------------------------------------------------
    // a point on a body stood up on his boot with his middle at (x, y), L tall
    function luOnBody(x, y, L, lean, u, v) {
        const A = -Math.PI / 2 + lean, T = L / SHAPE_ASPECT;
        const lx = (u - 0.5) * L, ly = (v - 0.5) * T;
        return [x + lx * Math.cos(A) - ly * Math.sin(A), y + lx * Math.sin(A) + ly * Math.cos(A)];
    }

    // How far he has straightened out of the Fallen's hunch: only while he
    // changes, and for good after.
    function luStraight() {
        if (lu.stage === 3 || lu.stage === 'dying') return 1;
        if (lu.stage === 'turn') return luEase(lu.sec / LU_CORRUPT_SECS / 0.4);
        return 0;
    }

    // Where everything of the Fallen is this frame, worked out once. While he
    // changes his body withers (lu.wither), shrinking up into his head: the
    // head never moves, and the body hangs from where his neck meets it,
    // sagging off it as it goes, so it is his feet that come up. L, T and sc
    // are his rig's, which the hands are measured by; bx, by, bL, bT and bLean
    // are the body's own.
    function luPose() {
        const k = luStraight(), L = LU_L, sc = L / LU_RIG, T = L / SHAPE_ASPECT;
        const pose = {};
        for (const key of Object.keys(LU_FALLEN)) pose[key] = luLerp(LU_FALLEN[key], LU_ANGEL[key], k);
        const lean = pose.lean * Math.PI / 180;
        const x = lu.x, y = lu.y + k * LU_ANGEL_BOB * sc * Math.sin(clock * Math.PI / 2);
        const w = lu.wither, into = Math.min(1, (1 - w) / Math.max(0.01, 1 - LU_WITHER));
        const [ax, ay] = luOnBody(x, y, L, lean, HL_HEAD_U, HL_HEAD_V);
        const tilt = LU_SLUMP * into * Math.PI / 180;
        const bx = ax + w * ((x - ax) * Math.cos(tilt) - (y - ay) * Math.sin(tilt));
        const by = ay + w * ((x - ax) * Math.sin(tilt) + (y - ay) * Math.cos(tilt));
        const period = luLerp(1.8, 5, k);
        const hw = HL_HEAD_W * L * pose.headSize;
        lu.bd = { x, y, L, T, sc, lean, pose, bx, by, bL: L * w, bT: L * w / SHAPE_ASPECT, bLean: lean + tilt,
                  hx: ax + pose.headDx * sc, hy: ay + pose.headDy * sc, hw, hh: hw * BALL_RY / BALL_RX,
                  ha: lean + (pose.headTurn + pose.headSway * Math.sin(clock * 2 * Math.PI / period)) * Math.PI / 180 };
    }

    // a shoulder, in the field
    function luShoulder(side) {
        const d = lu.bd;
        const [sx, sy] = luOnBody(d.bx, d.by, d.bL, d.bLean, LU_SHOULDER[0], LU_SHOULDER[1]);
        return [sx + side * d.bT * 0.3, sy];
    }

    // ---- where a piece belongs -------------------------------------------------------
    // A chain of bones from (x, y): each [bone, degrees] turns to its own
    // angle, and each starts where the last ended. Degrees are for the right
    // hand; the left is the mirror. Hands back each piece's place by name.
    function luChain(side, x, y, links, scale, out) {
        const sc = lu.bd.sc * scale;
        for (const [bone, deg] of links) {
            const d = deg * Math.PI / 180, a = side > 0 ? d : Math.PI - d;
            const len = LU_BONES[bone][0] * sc;
            out[bone] = { x: x + Math.cos(a) * len / 2, y: y + Math.sin(a) * len / 2, a, s: scale };
            x += Math.cos(a) * len; y += Math.sin(a) * len;
        }
        return [x, y];
    }

    // The arm, hanging off his shoulder and moving the way the memories move
    // it: the shoulder swings, the elbow gives half of it back, the wrist
    // follows late and the fingers curl in a wave out to the tips.
    function luArm(side) {
        const t = clock, ph = side > 0 ? 0 : 0.37;
        const wave = (period, off) => Math.sin(2 * Math.PI * (t / period + off));
        const arm = wave(2.6, ph);
        const out = {};
        const [sx, sy] = luShoulder(side);
        const B = LU_BONES;
        let [x, y] = luChain(side, sx, sy, [['arm0', B.arm0[1] + 14 * arm]], 1, out);
        [x, y] = luChain(side, x, y, [['arm1', B.arm1[1] + 7 * arm]], 1, out);
        const wrist = B.palm[1] + 7 * arm + 5.6 * wave(2.6, ph - 0.15);
        [x, y] = luChain(side, x, y, [['palm', wrist]], 1, out);
        const curl = (f, k) => -15 * wave(1.4, ph - f * 0.2 - k * 0.12);
        let acc = wrist - B.palm[1];
        for (const [f, names] of [[0, ['f10', 'f11', 'f12']], [1, ['f20', 'f21', 'f22']]]) {
            let fx = x, fy = y, a = acc;
            names.forEach((n, k) => {
                a += curl(f, k);
                [fx, fy] = luChain(side, fx, fy, [[n, B[n][1] + a]], 1, out);
            });
        }
        out.arm0.back = true;            // the upper arm comes out of his back
        return out;
    }

    // An open hand hanging palm down, the two fingers either side of where a
    // head would go, the forearm reaching back up toward his shoulder. `open`
    // 0 is shut on something.
    function luClawShape(h) {
        const out = {}, sc = lu.bd.sc, o = h.open;
        const pl = LU_BONES.palm[0] * sc;
        out.palm = { x: h.x, y: h.y, a: 0, s: 1 };
        luForearm(h, h.x, h.y - LU_BONES.palm[2] * sc * 0.4, 1, out);
        luChain(1, h.x - pl / 2, h.y, [['f10', 100 + 30 * o], ['f11', 86 + 12 * o], ['f12', 58]], 1, out);
        luChain(1, h.x + pl / 2, h.y, [['f20', 80 - 30 * o], ['f21', 94 - 12 * o], ['f22', 122]], 1, out);
        return out;
    }
    // the hollow of the claw, where a head is caught
    function luPocket(h) {
        const sc = lu.bd.sc;
        return { x: h.x, y: h.y + 44 * sc, r: 30 * sc };
    }

    // flat, end to end, the fingertips at either end: a paddle
    const LU_BAR = ['f12', 'f11', 'f10', 'arm0', 'palm', 'arm1', 'f20', 'f21', 'f22'];
    function luPalmShape(h) {
        const out = {}, sc = lu.bd.sc;
        const step = n => LU_BONES[n][0] * sc * 0.72;
        let x = h.x - LU_BAR.reduce((s, n) => s + step(n), 0) / 2;
        LU_BAR.forEach((n, i) => {
            out[n] = { x: x + step(n) / 2, y: h.y + (i % 2 ? 2 : -2), a: 0, s: 1, flip: i % 2 === 1 };
            x += step(n);
        });
        return out;
    }
    // a knot of all nine, churning
    function luFistShape(h) {
        const out = {};
        LU_PIECES.forEach(([n], i) => {
            const th = i / 9 * 2 * Math.PI + clock * 1.3 * h.side;
            const r = (i % 3 === 0 ? 12 : 26) * lu.bd.sc * 1.5;
            out[n] = { x: h.x + Math.cos(th) * r, y: h.y + Math.sin(th) * r, a: th + Math.PI / 2, s: 1.25 };
        });
        return out;
    }
    // round his head, lying along the ring, turning the way the hand's side says
    function luCageShape(h) {
        const out = {}, d = lu.bd;
        LU_PIECES.forEach(([n], i) => {
            const th = i / 9 * 2 * Math.PI + clock * LU_CAGE_SPIN * h.side + (h.side < 0 ? Math.PI / 9 : 0);
            out[n] = { x: d.hx + Math.cos(th) * LU_CAGE_R, y: d.hy + Math.sin(th) * LU_CAGE_R * 0.95,
                       a: th + Math.PI / 2, s: 0.95 };
        });
        return out;
    }
    // stood on its edge facing the other hand, fingers reaching across
    function luClapShape(h) {
        const out = {}, sc = lu.bd.sc, s = h.side;
        const pl = LU_BONES.palm[0] * sc;
        out.palm = { x: h.x, y: h.y, a: Math.PI / 2, s: 1 };
        luForearm(h, h.x + s * LU_BONES.palm[2] * sc * 0.4, h.y, 1, out);
        luChain(-s, h.x, h.y - pl / 2, [['f10', -12], ['f11', 2], ['f12', 18]], 1, out);
        luChain(-s, h.x, h.y + pl / 2, [['f20', 12], ['f21', -2], ['f22', -18]], 1, out);
        return out;
    }
    // A wing out from behind his shoulder, built as the Corrupted's are (see
    // luWing): the arm's pieces are its long feathers, the first nearest his
    // shoulder, and the rows over them and its bone are kept in h.deco to be
    // drawn over them. Behind him, beating.
    function luWingShape(h) {
        const s = h.side, sc = lu.bd.sc, got = { feathers: [], eyes: [] };
        const [sx, sy] = luShoulder(s);
        const d = LU_WING2_DEG * Math.PI / 180, th = s > 0 ? d : Math.PI - d, span = LU_WING2_SPAN * sc;
        luWing(got, { x: sx, y: sy, th, tr: s, span, k: 1, ph: 0, beat: LU_WING_BEAT, wid: s, stage: 0, grow: 1,
                      cx: sx, cy: sy, reach: span * 1.25, rows: LU_WING2_ROWS, eyes: false });
        h.deco = got.feathers.filter(f => f.group > 0);
        const out = {};
        LU_PIECES.forEach(([n], i) => {
            const f = got.feathers.find(q => q.group === 0 && q.i === i);
            out[n] = { x: f.x, y: f.y, a: f.a, s: f.len / (LU_BONES[n][0] * sc), back: true, flip: !!f.flip,
                       tone: f.tone, tr: f.tr };
        });
        return out;
    }
    // Reaching down: the palm on its edge, fingers pointing down, the forearm
    // reaching back up toward him. What he drains you with, fires with, and
    // grows the tree from.
    function luReachShape(h) {
        const out = {}, sc = lu.bd.sc;
        const pl = LU_BONES.palm[0] * sc;
        out.palm = { x: h.x, y: h.y, a: Math.PI / 2, s: 1 };
        luForearm(h, h.x, h.y - pl / 2, 1.5, out);
        luChain(1, h.x - 5, h.y + pl / 2, [['f10', 96], ['f11', 90], ['f12', 84]], 1, out);
        luChain(1, h.x + 5, h.y + pl / 2, [['f20', 84], ['f21', 90], ['f22', 96]], 1, out);
        return out;
    }
    const LU_SHAPES = { claw: luClawShape, palm: luPalmShape, fist: luFistShape, cage: luCageShape,
                        clap: luClapShape, wings: luWingShape, reach: luReachShape, beam: luReachShape,
                        tree: luReachShape };
    // just past a reaching hand's fingertips
    function luTipOf(h) { return [h.x, h.y + LU_TIP * lu.bd.sc]; }

    // the two arm bones from (x, y) back up toward his shoulder, so a hand
    // that has flown out still reads as his
    function luForearm(h, x, y, scale, out) {
        const [sx, sy] = luShoulder(h.side);
        const deg = Math.atan2(sy - y, sx - x) * 180 / Math.PI;
        luChain(1, x, y, [['arm1', deg], ['arm0', deg]], scale, out);
    }

    // where a piece is going this frame, whatever its hand is doing
    function luSlot(p) {
        const h = luHand(p.side);
        if (h.form === 'arm') return luArmCache(p.side)[p.bone];
        if (!h.shape || h.shapeT !== clock) { h.shape = LU_SHAPES[h.form](h); h.shapeT = clock; }
        return h.shape[p.bone];
    }
    function luArmCache(side) {
        const h = luHand(side);
        if (!h.arm || h.armT !== clock) { h.arm = luArm(side); h.armT = clock; }
        return h.arm;
    }

    // A hand takes a new shape: every piece of it sets off from wherever it
    // is now, the shoulder first and the fingertips last. Whatever it was
    // holding up goes: its tree comes down, its beam goes out.
    function luForm(h, form) {
        const palm = lu.pieces.find(p => p.side === h.side && p.bone === 'palm');
        if (h.tree) { luFell(h.tree); h.tree = null; }
        if (h.beam) { h.beam.st = 'gone'; h.beam = null; }
        Object.assign(h, { form, t: 0, hits: 0, done: false, st: 'aim', stT: form === 'fist' ? -Math.random() * 0.8 : 0,
                           slams: 0, open: 0, vy: 0, x: palm.x, y: palm.y, shape: null, charge: 0 });
        if (h.held) { luThrow(h.held); h.held = null; }
        for (const p of lu.pieces) {
            if (p.side !== h.side || p.gone) continue;
            p.from = { x: p.x, y: p.y, a: p.a, s: p.s };
            p.k = 0;
            p.delay = p.order * LU_STAGGER;
        }
    }

    // An arm at rest is stone: a hit on it does nothing, and glances.
    function luInert(p) { return luHand(p.side).form === 'arm'; }
    const LU_STONE_SECS = 0.2;       // stone coming over a bone, or going

    function luPieceStep(p, dt) {
        p.flash = Math.max(0, p.flash - dt * 4);
        p.stone = luToward(p.stone, luInert(p) ? 1 : 0, dt / LU_STONE_SECS);
        // clay turning to feather on its way into a wing, and back on its way out
        if (!p.gone) p.wing = luToward(p.wing, luHand(p.side).form === 'wings' ? 1 : 0, dt / LU_REFORM);
        if (p.gone) {
            // knocked off: it falls, and fades, and after LU_REGROW it flies
            // back from wherever it fell to wherever it belongs by then
            p.gone += dt;
            p.x += p.fvx * dt; p.y += p.fvy * dt; p.a += p.fva * dt;
            p.fvy += 900 * dt;
            if (p.gone >= LU_REGROW) {
                p.gone = 0;
                p.from = { x: p.x, y: Math.min(p.y, LH + 30), a: p.a, s: 0.2 };
                p.k = 0; p.delay = 0;
            }
            return;
        }
        const to = luSlot(p);
        p.back = !!to.back;
        p.flip = to.flip !== undefined ? to.flip : p.i % 2 === 1;
        if (to.tone !== undefined) { p.tone = to.tone; p.tr = to.tr; }
        if (p.k >= 1 || !p.from) { p.x = to.x; p.y = to.y; p.a = to.a; p.s = to.s; return; }
        if ((p.delay -= dt) > 0) return;
        p.k = Math.min(1, p.k + dt / LU_REFORM);
        const e = luEase(p.k), f = p.from;
        // a bow on the way, so they fly rather than slide
        const bow = Math.sin(e * Math.PI) * 30 * (p.i % 2 ? 1 : -1);
        p.x = luLerp(f.x, to.x, e) + bow; p.y = luLerp(f.y, to.y, e);
        p.a = luAng(f.a, to.a, e); p.s = luLerp(f.s, to.s, e);
    }

    function luKnock(p, nx, ny) {
        p.gone = 1e-6;
        p.fvx = -nx * 160 + (Math.random() - 0.5) * 80;
        p.fvy = -ny * 160 - 60;
        p.fva = (Math.random() - 0.5) * 8;
    }

    // The little ones in each hand. They go round a middle off his wrist; a
    // hand firing a beam draws them in past its fingertips, tighter and
    // faster the nearer it is to firing. Only then can a head knock one out
    // (it falls, and grows back after LU_REGROW); knock out all three and the
    // beam never comes.
    function luOrbStep(dt) {
        const sc = lu.bd.sc;
        for (const o of lu.orbs) {
            o.flash = Math.max(0, o.flash - dt * 4);
            const h = luHand(o.side);
            if (o.gone) {
                o.gone += dt;
                o.x += o.fvx * dt; o.y += o.fvy * dt; o.a += o.fva * dt;
                o.fvy += 900 * dt;
                if (o.gone >= LU_REGROW) { o.gone = 0; o.cx = null; }
                continue;
            }
            let cx, cy;
            if (h.form === 'beam') [cx, cy] = luTipOf(h);
            else {
                const pm = lu.pieces.find(p => p.side === o.side && p.bone === 'palm');
                const ca = Math.cos(pm.a), sa = Math.sin(pm.a), half = LU_BONES.palm[0] * sc * pm.s / 2;
                const wx = pm.x - ca * half, wy = pm.y - sa * half;
                cx = wx + (ca * LU_ORB_ALONG - sa * LU_ORB_ACROSS * o.side) * sc;
                cy = wy + (sa * LU_ORB_ALONG + ca * LU_ORB_ACROSS * o.side) * sc;
            }
            // they follow their middle rather than jump to it when the hand changes
            if (o.cx === null) { o.cx = cx; o.cy = cy; }
            o.cx = luToward(o.cx, cx, 900 * dt); o.cy = luToward(o.cy, cy, 900 * dt);
            const charge = h.form === 'beam' ? h.charge : 0;
            o.ph += dt * 2 * Math.PI / LU_ORB_PERIOD * LU_ORB_SPEEDS[o.ri] * (1 + 4 * charge);
            const tilt = LU_ORB_TILTS[o.ri] * o.side * Math.PI / 180;
            const rx = LU_ORB_R * sc * (1 - 0.45 * charge), ry = rx * 0.35;
            const ox = Math.cos(o.ph) * rx, oy = Math.sin(o.ph) * ry;
            o.z = Math.sin(o.ph);
            o.x = o.cx + ox * Math.cos(tilt) - oy * Math.sin(tilt);
            o.y = o.cy + ox * Math.sin(tilt) + oy * Math.cos(tilt);
            o.a = Math.atan2(ry * Math.cos(o.ph), -rx * Math.sin(o.ph)) + tilt;
            o.len = LU_ORB_BONE * sc * (0.44 + 0.14 * o.z);
        }
    }
    function luOrbLive(o) { const h = luHand(o.side); return !o.gone && h.form === 'beam' && h.st === 'charge'; }

    // ---- what he does ----------------------------------------------------------------
    function luUpdate(b, dt) {
        luBox(b);
        const live = phase === 'play';
        if (phase === 'entrance') {
            const e = luEase(enterK());
            lu.x = LW / 2;
            lu.y = -LU_L + (LU_Y + LU_L) * e;
        } else {
            if (live && !['drain', 'turn', 'dying', 'end'].includes(lu.stage)) lu.t += dt;
            lu.x = LW / 2 + Math.sin(lu.t * LU_DRIFT_RATE) * LU_DRIFT;
            lu.y = lu.stage === 3 || lu.stage === 'dying' || lu.stage === 'end' ? LU_Y3
                 : lu.stage === 'turn' ? luLerp(LU_Y, LU_Y3, luStraight()) : LU_Y;
            // a swoop takes him off his drift, and eases him back onto it
            if (lu.sw) {
                lu.x = luLerp(lu.x, lu.sw.x, lu.sw.k);
                lu.y = luLerp(lu.y, lu.sw.y, lu.sw.k);
                // how fast he is going, for what he spikes
                if (dt > 0 && lu.sw.lx !== undefined) { lu.sw.vx = (lu.x - lu.sw.lx) / dt; lu.sw.vy = (lu.y - lu.sw.ly) / dt; }
                lu.sw.lx = lu.x; lu.sw.ly = lu.y;
            }
        }
        // a hit that hurts him shakes all of him, crown and hands with him
        lu.shake = Math.max(0, lu.shake - dt / LU_SHAKE_SECS);
        if (lu.shake > 0) {
            const k = lu.shake * lu.shake * LU_SHAKE * (lu.stage === 'break' && lu.stT < LU_REEL ? LU_REEL_SHAKE : 1);
            lu.x += k * (Math.sin(clock * 71) + Math.sin(clock * 43)) / 2;
            lu.y += k * Math.sin(clock * 59) / 2;
        }
        if (live) luStage(b, dt);
        if (!lu) return;                // the end has handed you to the town, and he is gone
        if (luCorrupted()) {
            lu.cf = luCorruptFrame();
            lu.wither = lu.cf.w;
            lu.limp = lu.stage === 'dying' || lu.stage === 'end' ? 1 : lu.stage === 3 ? luClamp((LU_LIMP_AT - b.hp / b.maxHp) / LU_LIMP_AT) : 0;
        }
        lu.wingPh += dt / (LU_WING_FLAP.period * (1 + lu.limp)) * (lu.stage === 'end' ? 1 - luEndPose().crumble : 1);
        if (lu.stage === 3) luCrownStep(dt);
        luPose();
        // a wing's rows and bone come in with its feathers and go with them
        for (const h of lu.hands) {
            h.wingK = luToward(h.wingK, h.form === 'wings' ? 1 : 0, dt / (LU_REFORM + LU_STAGGER));
            if (h.form === 'wings' && h.shapeT !== clock) { h.shape = luWingShape(h); h.shapeT = clock; }
        }
        lu.stone = luToward(lu.stone, luArmoured() ? 1 : 0, dt / LU_STONE_SECS);
        // a head lost from under him is not his to hold any more
        for (const h of lu.hands) if (h.held && !balls.includes(h.held)) h.held = null;
        for (const [ball] of lu.frozen) if (!balls.includes(ball)) lu.frozen.delete(ball);
        for (const ball of balls) if (ball.luPass && ball.vy < 0) ball.luPass = false;
        if (!luCorrupted()) {
            for (const p of lu.pieces) luPieceStep(p, dt);
            luOrbStep(dt);
        }
        if (luCorrupted()) lu.now = luCrownNow();
        luHeld();
        for (const tr of lu.trees) luTreeStep(tr, dt);
        lu.trees = lu.trees.filter(tr => !tr.down || tr.chunks.length);
        luBirdsStep(dt, live);
        luBeamsStep(dt, live);
        luMoteStep(dt);
        for (const d of lu.debris) {
            d.age += dt;
            d.vy += 900 * dt;
            d.x += d.vx * dt; d.y += d.vy * dt; d.a += d.va * dt;
        }
        lu.debris = lu.debris.filter(d => d.age < 1.4);
        lu.slams = lu.slams.filter(s => (s.t += dt) < 0.6);
        // BIG running out gently at the end, not all at once
        if (lu.stage === 'end') paddle.w = luToward(paddle.w, PADDLE_W, dt * PADDLE_W / LU_END_SWAP);
        for (const a of lu.ash) { a.t += dt; a.x += a.vx * dt; a.y += a.vy * dt; a.vy -= 20 * dt; a.vx *= 1 - 0.6 * dt; }
        lu.ash = lu.ash.filter(a => a.t < a.life);
        lu.flash3 = Math.max(0, lu.flash3 - dt * 3);
        // HIS light in you: as much of it as you have taken off him
        lu.odin = lu.stage === 3 ? 1 - b.hp / b.maxHp : lu.stage === 'dying' || lu.stage === 'end' ? 1 : 0;
        lu.odinShow = luToward(lu.odinShow, lu.odin, dt * 0.8);
        // your colour: drained out of you with your light, and back with his
        lu.grey = lu.stage === 'drain' ? luEase(lu.stT / LU_DRAIN_SECS) : lu.stage === 'turn' ? 1
                : lu.stage === 3 || lu.stage === 'dying' || lu.stage === 'end' ? 1 - lu.odinShow : 0;
    }

    function luStage(b, dt) {
        const pace = luPace();
        lu.stT += dt;
        if (lu.swoop && lu.stage !== 2) luSwoopStep(dt, pace);      // the part ended mid-swoop: home
        // Between the first part and the second: he reels, the memory plays
        // if it is still to earn, his bar grows back, and you serve again.
        if (lu.stage === 'break') {
            if (lu.stT < LU_REEL) { lu.shake = 1; return; }
            if (!lu.memAsked) {
                lu.memAsked = true;
                lu.mem = typeof menuVoidMemory === 'function' && menuVoidMemory();
            }
            if (lu.mem) {
                lu.stT = LU_REEL;
                if (menuFightShowStep(dt)) return;
                lu.mem = false;
            }
            b.maxHp = luHp2();
            b.hp = b.maxHp * luEase((lu.stT - LU_REEL) / LU_REFILL12);
            if (lu.stT < LU_REEL + LU_REFILL12) return;
            b.hp = b.maxHp;
            lu.stage = 2; lu.stT = 0; lu.mi = 0; lu.restT = LU_REST / pace;
            // a fresh head for a fresh part, as the last part gets
            lu.frozen.clear();
            resetBall();
            return;
        }
        if (lu.stage === 'drain') {
            for (const h of lu.hands) luHandStep(h, dt, pace);
            if (lu.stT >= LU_DRAIN_SECS) luTurnStart();
            return;
        }
        if (lu.stage === 'turn') {
            const end = luCorruptTimes().end;
            lu.sec = Math.min(end, lu.sec + dt);
            if (lu.sec >= end) {
                lu.stage = 3; lu.stT = 0; lu.mi = 0; lu.restT = LU_REST3 / LU_PACE3;
                b.hp = b.maxHp = luCrownLeft() + LU_HEAD_HP;
                // the head you had is gone; a fresh one waits on you to serve it
                lu.frozen.clear();
                resetBall();
            }
            return;
        }
        if (lu.stage === 'dying') {
            if (lu.stT >= LU_LAST.length / LU_DIE_TYPE + LU_DIE_HOLD) luEndStart();
            return;
        }
        if (lu.stage === 'end') {
            if (lu.stT >= luEndTimes().done) luEndDone();
            return;
        }
        if (lu.stage === 3) { luAttack3(dt, pace); return; }
        for (const h of lu.hands) luHandStep(h, dt, pace);
        luSwoopStep(dt, pace);
        luDirect(dt, pace);
    }

    // the next shape, once every hand has come home and had its rest
    function luDirect(dt, pace) {
        if (lu.hands.some(luActive)) return;
        if ((lu.restT -= dt) > 0) return;
        const list = LU_MOVES[lu.stage];
        const m = list[lu.mi++ % list.length];
        lu.swoops = 0;
        lu.swoopRest = LU_REFORM + LU_STAGGER * 2;      // the wings grow in before the first
        if (m.B) {
            for (const h of lu.hands) luForm(h, m.B);
            if (m.B === 'clap') lu.clap = { x: lu.x, y: LU_CLAP_Y, gap: LU_CLAP_GAP, st: 'open', t: 0 };
        } else {
            if (m.L) luForm(lu.hands[0], m.L);
            if (m.R) luForm(lu.hands[1], m.R);
        }
        lu.restT = LU_REST / pace;
    }

    // With his wings out: up to one side, wings raised (the tell), down across
    // the field in an arc toward you and up the far side, and back onto his
    // drift. Wings gone, or the part over, and he only goes home.
    function luSwoopStep(dt, pace) {
        const winged = lu.stage === 2 && lu.hands.some(h => h.form === 'wings');
        let s = lu.swoop;
        if (!s) {
            if (!winged || lu.swoops >= LU_SWOOPS || (lu.swoopRest -= dt) > 0) return;
            const wing = lu.hands.find(h => h.form === 'wings');
            if (wing.t > LU_WING_SECS / pace - (LU_SWOOP_WIND + LU_SWOOP_SECS + LU_SWOOP_HOME) / pace) return;
            // the first from the side he is nearer, across to the other; the
            // next back the other way
            const dir = lu.swoops ? -lu.swoopDir : lu.x < LW / 2 ? 1 : -1;
            s = lu.swoop = { st: 'wind', t: 0, dir };
            lu.swoopDir = dir;
            lu.sw = { x: lu.x, y: lu.y, k: 0, vx: 0, vy: 0 };
        }
        if (!winged && s.st !== 'home') { s.st = 'home'; s.t = 0; s.k0 = lu.sw.k; }
        s.t += dt;
        const top = LU_Y - 30, x0 = LW / 2 - s.dir * LU_SWOOP_X;
        if (s.st === 'wind') {
            const k = luClamp(s.t / (LU_SWOOP_WIND / pace));
            Object.assign(lu.sw, { x: x0, y: top, k: luEase(k) });
            if (k >= 1) { s.st = 'dive'; s.t = 0; }
        } else if (s.st === 'dive') {
            const u = luClamp(s.t / (LU_SWOOP_SECS / pace));
            Object.assign(lu.sw, { x: LW / 2 - s.dir * LU_SWOOP_X * Math.cos(Math.PI * u),
                                   y: top + (LU_SWOOP_DEPTH + 30) * Math.sin(Math.PI * u), k: 1 });
            if (u >= 1) { s.st = 'home'; s.t = 0; s.k0 = 1; }
        } else {
            const k = luClamp(s.t / (LU_SWOOP_HOME / pace));
            lu.sw.k = s.k0 * (1 - luEase(k));
            if (k >= 1) {
                lu.swoop = null; lu.sw = null;
                lu.swoops++;
                lu.swoopRest = LU_SWOOP_REST / pace;
            }
        }
    }
    function luDiving() { return !!lu.swoop && lu.swoop.st === 'dive'; }

    // The last part: one thing at a time, and a rest between.
    function luAttack3(dt, pace) {
        const a = lu.attack;
        if (a) {
            a.t += dt;
            if (a.kind === 'tree' && !a.tree.down && a.t > LU_TREE_SECS / pace) luFell(a.tree);
            if (a.kind === 'beam' ? a.beam.st === 'gone' : a.tree.down) lu.attack = null;
            return;
        }
        if ((lu.restT -= dt) > 0) return;
        const list = LU_MOVES[3], kind = list[lu.mi++ % list.length];
        if (kind === 'beam') lu.attack = { kind, t: 0, beam: luBeam(() => [lu.cf.fx, lu.cf.fy], pace) };
        else lu.attack = { kind, t: 0, tree: luTree(() => [lu.cf.fx, lu.cf.fy + lu.cf.fh * 0.42]) };
        lu.restT = LU_REST3 / pace;
    }

    // the head he is after: one on its way up, the nearest below him first
    function luQuarry() {
        let best = null;
        for (const ball of balls) {
            if (lu.frozen.has(ball) || lu.hands.some(h => h.held === ball)) continue;
            if (!best || (ball.vy < 0) > (best.vy < 0) || ((ball.vy < 0) === (best.vy < 0) && ball.y > best.y)) best = ball;
        }
        return best;
    }

    function luHandStep(h, dt, pace) {
        if (!luActive(h)) return;
        h.t += dt;
        const secs = LU_FORM_SECS / pace;
        const home = lu.x + h.side * LU_HOME;
        const q = luQuarry();
        switch (h.form) {
            case 'claw': {
                if (h.held) {
                    h.open = Math.max(0, h.open - dt * 6);
                    if ((h.holdT -= dt) <= 0) { luThrow(h.held); h.held = null; h.done = true; }
                } else {
                    h.open = Math.min(1, h.open + dt * 3);
                    h.x = luToward(h.x, q ? q.x : home, LU_CLAW_SPEED * pace * dt);
                    if (h.t > secs) h.done = true;
                }
                h.y = luToward(h.y, LU_CLAW_Y + Math.sin(h.t * 1.7) * 12, 300 * dt);
                break;
            }
            case 'palm': {
                // where a head coming up will cross his line, walls and all
                let to = home;
                if (q && q.vy < 0 && q.y > LU_PALM_Y) to = labFold(q.x + q.vx / q.vy * (LU_PALM_Y - q.y));
                h.x = luToward(h.x, to, LU_PALM_SPEED * pace * dt);
                h.y = luToward(h.y, LU_PALM_Y, 300 * dt);
                if (h.t > secs) h.done = true;
                break;
            }
            case 'fist': luFistStep(h, dt, pace); break;
            case 'beam': luBeamHand(h, dt, pace); break;
            case 'tree':
                h.x = luToward(h.x, labFold(lu.x + h.side * LU_TREE_OUT), 300 * dt);
                h.y = luToward(h.y, LU_TREE_Y, 300 * dt);
                if (!h.tree && h.t > 0.7) h.tree = luTree(() => luTipOf(h));
                if (h.t > LU_TREE_SECS / pace) h.done = true;
                break;
            case 'cage':
                h.x = lu.bd.hx; h.y = lu.bd.hy;
                if (h.t > LU_CAGE_SECS / pace) h.done = true;
                break;
            case 'clap': if (h.side > 0) luClapStep(dt, pace, secs); break;
            case 'wings':
                if (h.t > LU_WING_SECS / pace ||
                    lu.pieces.every(p => p.side !== h.side || p.gone)) h.done = true;
                break;
            case 'reach':
                // over you, the stream running up it
                h.x = luToward(h.x, labFold(paddle.x), 260 * dt);
                h.y = luToward(h.y, LU_BEAM_Y + 30, 300 * dt);
                break;
        }
        if (h.done) luForm(h, 'arm');
    }

    // Over you, following you; then down, fast. Under it when it lands and
    // you are SLUGGISH. It lies there a moment, and goes back up for another.
    function luFistStep(h, dt, pace) {
        h.stT += dt;
        const floor = padY() - padH() / 2 - 14;
        if (h.st === 'aim') {
            h.x = luToward(h.x, paddle.x, LU_FIST_TRACK * pace * dt);
            h.y = luToward(h.y, LU_FIST_Y, 400 * dt);
            if (h.stT >= LU_FIST_AIM / pace) { h.st = 'drop'; h.stT = 0; h.vy = 0; }
        } else if (h.st === 'drop') {
            h.vy += LU_FIST_G * dt;
            h.y += h.vy * dt;
            if (h.y >= floor) {
                h.y = floor; h.st = 'down'; h.stT = 0; h.slams++;
                lu.slams.push({ x: h.x, y: floor + 10, t: 0 });
                if (padNear(h.x, padY(), LU_FIST_R, padH())) {
                    dragT = Math.min(DRAG_CAP, dragT + LU_FIST_DRAG);
                    for (const sg of segs()) { paddle.jt[sg.i] = 1; paddle.tilt[sg.i] = (h.x - sg.cx) / Math.max(1, sg.w / 2); }
                }
            }
        } else if (h.st === 'down') {
            if (h.stT >= LU_FIST_REST) { h.st = 'rise'; h.stT = 0; }
        } else if (h.st === 'rise') {
            h.y = luToward(h.y, LU_FIST_Y, LU_FIST_RISE * pace * dt);
            if (h.y <= LU_FIST_Y + 1) {
                if (h.slams >= LU_FIST_SLAMS) h.done = true;
                else { h.st = 'aim'; h.stT = 0; }
            }
        }
    }

    // Out over you, then the beam gathers at the fingertips and follows you,
    // and fires. With all three little ones knocked out of it, it gives up.
    function luBeamHand(h, dt, pace) {
        h.stT += dt;
        if (h.st === 'aim') {
            h.x = luToward(h.x, labFold(paddle.x), 400 * pace * dt);
            h.y = luToward(h.y, LU_BEAM_Y, 400 * dt);
            if (h.stT >= 0.7) { h.st = 'charge'; h.stT = 0; h.beam = luBeam(() => luTipOf(h), pace); h.beam.x = h.x; }
            return;
        }
        const bm = h.beam;
        if (!bm || bm.st === 'gone') { h.done = true; return; }
        h.x = bm.x;
        h.st = bm.st === 'charge' ? 'charge' : 'fire';
        h.charge = bm.st === 'charge' ? luClamp(bm.t / (LU_BEAM_CHARGE / bm.pace)) : 1;
        if (h.st === 'charge' && lu.orbs.every(o => o.side !== h.side || o.gone)) {
            award(BOSS_PTS, h.x, h.y);
            h.done = true;
        }
    }

    // The two hands wait open either side of the head's way up and shut on it.
    // The right hand runs it for both.
    function luClapStep(dt, pace, secs) {
        const c = lu.clap, L = lu.hands[0], R = lu.hands[1];
        if (!c) return;
        c.t += dt;
        const q = luQuarry();
        if (c.st === 'open') {
            // both hands stay on the field, however near a wall the head is
            const edge = LU_CLAP_GAP + 30;
            c.x = luToward(c.x, Math.max(edge, Math.min(LW - edge, q ? q.x : lu.x)), LU_CLAW_SPEED * pace * dt);
            c.gap = luToward(c.gap, LU_CLAP_GAP, 400 * dt);
            // shut so as to meet as it gets there
            const shut = LU_CLAP_SHUT / pace;
            if (q && q.vy < 0 && q.y > c.y && q.y - c.y < LU_CLAP_REACH && Math.abs(q.x - c.x) < c.gap &&
                (q.y - c.y) / -q.vy <= shut) {
                c.st = 'shut'; c.st0 = c.gap; c.stT = 0;
            } else if (R.t > secs) { L.done = R.done = true; }
        } else if (c.st === 'shut') {
            // closing on where it is, not where it was
            if (q) c.x = luToward(c.x, q.x, LU_CLAW_SPEED * 3 * pace * dt);
            c.stT += dt;
            const k = Math.min(1, c.stT / (LU_CLAP_SHUT / pace));
            const meet = LU_BONES.palm[2] * lu.bd.sc * 0.6;
            c.gap = luLerp(c.st0, meet, k * k);
            if (k >= 1) {
                const got = balls.find(ball => !lu.frozen.has(ball) && Math.abs(ball.x - c.x) < meet + bRX() * 1.4 &&
                                               Math.abs(ball.y - c.y) < 50);
                if (got) { luCatch(R, got); c.st = 'hold'; }
                else { c.st = 'miss'; c.stT = 0; }
            }
        } else if (c.st === 'miss') {
            if ((c.stT += dt) > 0.5) c.st = 'open';
        } else if (c.st === 'hold') {
            if ((R.holdT -= dt) <= 0) {
                if (R.held) { luThrow(R.held); R.held = null; }
                L.done = R.done = true;
            }
        }
        L.x = c.x - c.gap; R.x = c.x + c.gap;
        L.y = R.y = c.y;
    }

    // a caught head sits in the hand that has it
    function luHeld() {
        for (const h of lu.hands) {
            const ball = h.held;
            if (!ball) continue;
            if (h.form === 'clap' && lu.clap) { ball.x = lu.clap.x; ball.y = lu.clap.y; }
            else { const pk = luPocket(h); ball.x = pk.x; ball.y = pk.y; }
            ball.vx = 0; ball.vy = 0; ball.spin = 0; ball.eng = 0;
        }
    }

    function luCatch(h, ball) {
        h.held = ball; h.holdT = LU_CLAW_HOLD;
        ball.vx = 0; ball.vy = 0; ball.spin = 0; ball.eng = 0; ball.boost = 1;
        dragT = Math.min(DRAG_CAP, dragT + LU_CLAW_DRAG);
        for (const sg of segs()) paddle.jt[sg.i] = 1;
    }

    // SLUGGISH on you, and you jolt
    function luSlug(secs) {
        dragT = Math.min(DRAG_CAP, dragT + secs);
        for (const sg of segs()) paddle.jt[sg.i] = 1;
    }

    // Thrown back at the rally's speed, at whichever of the original's angles
    // lands furthest from you, and out through his own hands.
    function luThrow(ball) {
        const s = effSpeed();
        let pick = 0, far = -1;
        for (const a of SLAM_ANGLES) {
            const d = Math.abs(labFold(ball.x - Math.tan(a) * Math.max(0, padY() - ball.y)) - paddle.x);
            if (d > far) { far = d; pick = a; }
        }
        ball.vx = -Math.sin(pick) * s;
        ball.vy = Math.cos(pick) * s;
        ball.luPass = true;
    }

    // Holding the world still while something is said or taken: every head
    // stops where it is and goes on as it was after.
    function luFreeze() {
        for (const h of lu.hands) if (h.held) { luThrow(h.held); h.held = null; }
        for (const ball of balls) {
            if (!lu.frozen.has(ball)) lu.frozen.set(ball, { vx: ball.vx, vy: ball.vy, x: ball.x, y: ball.y });
        }
        lu.clap = null;
    }
    function luThaw() {
        for (const [ball, v] of lu.frozen) { ball.vx = v.vx; ball.vy = v.vy; }
        lu.frozen.clear();
    }
    function luFrozenStep() {
        for (const [ball, v] of lu.frozen) { ball.x = v.x; ball.y = v.y; ball.vx = 0; ball.vy = 0; }
    }

    // Everything he has out stops: trees come down, beams go out, birds fly off.
    function luCallOff() {
        for (const tr of lu.trees) luFell(tr);
        for (const bm of lu.beams) bm.st = 'gone';
        for (const bd of lu.birds) if (bd.st !== 'hit') { bd.st = 'away'; bd.vx = (bd.x < LW / 2 ? -1 : 1) * 200; bd.vy = -260; }
        lu.attack = null;
    }

    // ---- beams -----------------------------------------------------------------------
    // From wherever `src` says down to the floor. It gathers first, a thin line
    // growing brighter where it will land and following you, then fires.
    function luBeam(src, pace) {
        const three = lu.stage === 3;
        const bm = { src, x: paddle.x, st: 'charge', t: 0, pace, look: three ? 1 : LU_BEAM_LOOK12,
                     lock: three ? LU_BEAM_LOCK3 : 0, secs: three ? LU_BEAM_SECS3 : LU_BEAM_SECS,
                     stun: three ? LU_BEAM_STUN3 : LU_BEAM_STUN };
        lu.beams.push(bm);
        return bm;
    }
    function luBeamsStep(dt, live) {
        for (const bm of lu.beams) {
            if (!live && bm.st !== 'fade') continue;
            bm.t += dt;
            if (bm.st === 'charge') {
                const charge = LU_BEAM_CHARGE / bm.pace + bm.lock;
                if (bm.t < charge - bm.lock) bm.x = luToward(bm.x, labFold(paddle.x), LU_BEAM_TRACK * bm.pace * dt);
                if (bm.t < charge) continue;
                bm.st = 'fire'; bm.t = 0;
                // one shot, a column top to bottom of the field, against him
                // as he is turned. Only the moment it fires counts: what
                // stands after is light, so moving into it is never a
                // punishment for having dodged it.
                if (padNear(luBeamAt(bm, padY()), padY(), LU_BEAM_W / 2, LH)) {
                    luSlug(LU_BEAM_DRAG);
                    // the boss lab runs brandon.html's engine, which has no stun
                    if (typeof stunPad === 'function') stunPad(bm.stun);
                }
            } else if (bm.st === 'fire') {
                if (bm.t >= bm.secs) { bm.st = 'fade'; bm.t = 0; }
            } else if (bm.st === 'fade' && bm.t >= 0.3) bm.st = 'gone';
        }
        lu.beams = lu.beams.filter(bm => bm.st !== 'gone');
    }
    // where across the field the beam is at height y
    function luBeamAt(bm, y) {
        const [sx, sy] = bm.src(), ey = padY() + padH();
        return sx + (bm.x - sx) * (y - sy) / Math.max(1, ey - sy);
    }

    // ---- trees and birds -------------------------------------------------------------
    // HIS tree, grown down from `root`: three branches, each forking in two
    // as it finishes growing, LU_TREE_DEPTH deep. A branch a head hits snaps
    // and falls with everything below it; that slot stays empty. Grown all
    // the way, two birds come out of it.
    function luTree(root) {
        const tr = { root, kids: [null, null, null], t: 0, segs: [], tips: [], chunks: [], down: false, birds: false };
        lu.trees.push(tr);
        return tr;
    }
    function luSprout(depth, i, target) {
        const first = depth === 0;
        return { depth, len: 0, seed: Math.random(), kids: [null, null],
                 rel: first ? [-30, 0, 30][i] * Math.PI / 180
                            : (i ? 1 : -1) * LU_TREE_SPREAD * (0.75 + 0.5 * Math.random()) * Math.PI / 180,
                 target: first ? LU_TREE_LEN * (i === 1 ? 1.05 : 0.95) : target * LU_TREE_SHRINK * (0.9 + 0.2 * Math.random()) };
    }
    function luTreeStep(tr, dt) {
        tr.t += dt;
        tr.segs = []; tr.tips = [];
        if (!tr.down) {
            const [rx, ry] = tr.root();
            // a slot is null until something grows in it, and false once it is cut
            const walk = (n, x, y, a0, slots, i) => {
                n.len = Math.min(n.target, n.len + dt * n.target / LU_TREE_GROW);
                const a = a0 + n.rel + Math.sin(clock * 2 * Math.PI / 5 + n.depth * 0.8 + n.seed * 6) * (1 + n.depth) * Math.PI / 180;
                const ex = x + Math.cos(a) * n.len, ey = y + Math.sin(a) * n.len;
                tr.segs.push({ n, slots, i, x0: x, y0: y, x1: ex, y1: ey, a, len: n.len });
                if (n.len < n.target) return;
                if (n.depth === LU_TREE_DEPTH - 1) { tr.tips.push({ x: ex, y: ey, a, seed: n.seed }); return; }
                n.kids.forEach((k, j) => {
                    if (k === null) k = n.kids[j] = luSprout(n.depth + 1, j, n.target);
                    if (k) walk(k, ex, ey, a, n.kids, j);
                });
            };
            tr.kids.forEach((k, i) => {
                if (k === null) k = tr.kids[i] = luSprout(0, i, 0);
                if (k) walk(k, rx, ry, Math.PI / 2, tr.kids, i);
            });
            if (!tr.birds && tr.t > LU_TREE_GROW * LU_TREE_DEPTH + 0.2 && tr.tips.length) {
                tr.birds = true;
                for (let j = 0; j < 2; j++) {
                    const tip = tr.tips[Math.floor(Math.random() * tr.tips.length)];
                    lu.birds.push({ tr, tip: tr.tips.indexOf(tip), st: 'perch', t: 0, wait: LU_BIRD_WAIT * (1 + j),
                                    x: tip.x, y: tip.y, vx: 0, vy: 0, a: j ? Math.PI : 0, fade: 1, spin: 0, k: j, tx: 0 });
                }
            }
        }
        for (const c of tr.chunks) {
            c.age += dt;
            c.vy += 900 * dt;
            c.px += c.vx * dt; c.py += c.vy * dt;
        }
        tr.chunks = tr.chunks.filter(c => c.age < 1.6);
    }
    // cut `seg` and everything below it out of the tree, as it is this frame
    function luSnap(tr, seg) {
        const under = new Set();
        const add = n => { under.add(n); n.kids.forEach(k => k && add(k)); };
        add(seg.n);
        seg.slots[seg.i] = false;
        tr.chunks.push({ out: tr.segs.filter(s => under.has(s.n)).map(s => Object.assign({}, s)),
                         x0: seg.x0, y0: seg.y0, px: seg.x0, py: seg.y0,
                         vx: (Math.random() - 0.5) * 80, vy: -30, spin: (Math.random() - 0.5) * 4, age: 0 });
    }
    // the whole of it coming down
    function luFell(tr) {
        if (tr.down) return;
        for (const s of tr.segs.filter(s => s.n.depth === 0)) luSnap(tr, s);
        tr.down = true;
        tr.segs = []; tr.tips = [];
    }

    // A bird sits in the tree, then comes off it to circle over you, picking
    // you out; then it dives where you were, and on you it leaves you
    // SLUGGISH. A head knocks it out of the air.
    function luBirdsStep(dt, live) {
        for (const bd of lu.birds) {
            bd.t += dt;
            if (bd.st === 'perch') {
                const tip = !bd.tr.down && bd.tr.tips[bd.tip];
                if (tip) { bd.x = tip.x; bd.y = tip.y - 8; }
                if (live && (!tip || bd.t >= bd.wait)) { bd.st = 'aim'; bd.t = 0; }
            } else if (bd.st === 'aim') {
                if (!live) continue;
                const tx = labFold(paddle.x + (bd.k ? 60 : -60) * Math.cos(bd.t * 3)), ty = LU_BIRD_Y;
                const dx = tx - bd.x, dy = ty - bd.y, d = Math.hypot(dx, dy) || 1, v = Math.min(d, 340 * dt);
                bd.x += dx / d * v; bd.y += dy / d * v;
                bd.a = luAng(bd.a, Math.atan2(dy, dx), Math.min(1, dt * 6));
                if (bd.t >= LU_BIRD_AIM) {
                    bd.st = 'dive'; bd.t = 0; bd.tx = paddle.x;
                    const ex = paddle.x - bd.x, ey = padY() - bd.y, e = Math.hypot(ex, ey) || 1;
                    bd.vx = ex / e * LU_BIRD_SPEED * luPace(); bd.vy = ey / e * LU_BIRD_SPEED * luPace();
                    bd.a = Math.atan2(bd.vy, bd.vx);
                }
            } else if (bd.st === 'dive') {
                if (!live) continue;
                bd.x += bd.vx * dt; bd.y += bd.vy * dt;
                if (bd.y >= padY() - padH() / 2 - 6) {
                    if (padNear(bd.x, padY() - padH() / 2, LU_BIRD_S * 0.5, padH())) luSlug(LU_BIRD_DRAG);
                    bd.st = 'away'; bd.vx = (bd.vx < 0 ? -1 : 1) * 220; bd.vy = -300;
                }
            } else if (bd.st === 'away') {
                bd.x += bd.vx * dt; bd.y += bd.vy * dt;
                bd.a = luAng(bd.a, Math.atan2(bd.vy, bd.vx), Math.min(1, dt * 6));
                bd.fade -= dt;
            } else if (bd.st === 'hit') {
                bd.vy += 900 * dt;
                bd.x += bd.vx * dt; bd.y += bd.vy * dt; bd.a += bd.spin * dt;
                bd.fade -= dt * 1.2;
            }
        }
        lu.birds = lu.birds.filter(bd => bd.fade > 0);
    }
    function luBirdLive(bd) { return bd.st === 'perch' || bd.st === 'aim' || bd.st === 'dive'; }

    // ---- the change ------------------------------------------------------------------
    // Part two beaten: everything he has out stops, the world holds still,
    // and a hand reaches down over you while your light runs up it.
    function luDrainStart() {
        lu.stage = 'drain'; lu.stT = 0;
        luCallOff();
        luFreeze();
        capsule = null;
        for (const h of lu.hands) luForm(h, 'arm');
        luReach();
    }
    function luReach() {
        const near = paddle.x < lu.x ? lu.hands[0] : lu.hands[1];
        luForm(near, 'reach');
    }
    // ...and with it, he changes
    function luTurnStart() {
        lu.stage = 'turn'; lu.stT = 0; lu.sec = 0;
        lu.refill = bricks[0].hp / bricks[0].maxHp;     // where his bar fills from
        lu.crown = luCrownFresh();
        for (const h of lu.hands) luForm(h, 'arm');
    }

    function luCorruptTimes() {
        const witherAt = LU_WITHER_FROM * LU_CORRUPT_SECS, fallAt = LU_WITHER_TO * LU_CORRUPT_SECS + LU_SHED_BEAT;
        const wingAt = fallAt - LU_WING_LEAD;
        return { witherAt, fallAt, wingAt,
                 end: Math.max(LU_CORRUPT_SECS, fallAt + LU_HANG_SECS + LU_SHED_FALL, wingAt + LU_WING_GROW_SECS + 1.2) };
    }

    // Where the change is, lu.sec seconds into it (and, in the last part,
    // where it ended), as the character lab has it, in order and overlapping:
    // his arms fly up into the wheels and redden; he straightens into the
    // Angel's float; his head reddens and his body greys as the black opens
    // round him; the wheels fill; he withers, the body shrinking up into the
    // head, which never moves and grows on what it gives up, as the wheels
    // do; the wings start out of his head; and the body drops away and
    // falls. Rig px about his middle, which is at (ox, oy) in the field, S
    // to the px; the head's place and size in the field too (fx, fy, fw, fh).
    function luCorruptFrame() {
        const T = luCorruptTimes(), sec = lu.stage === 'turn' ? lu.sec : T.end, p = luClamp(sec / LU_CORRUPT_SECS);
        const e = luEase;
        const bodyK = e(p / 0.4), redK = e((p - 0.15) / 0.45), auraK = e((p - 0.05) / 0.5), fillK = e((p - 0.35) / 0.3);
        const witherK = e((p - LU_WITHER_FROM) / (LU_WITHER_TO - LU_WITHER_FROM));
        const headK = e((sec - T.witherAt) / LU_HEAD_GROW_SECS), ringK = e((sec - T.witherAt) / LU_RING_GROW_SECS);
        const wingK = e((sec - T.wingAt) / LU_WING_GROW_SECS);
        const pose = {};
        for (const k of Object.keys(LU_FALLEN)) pose[k] = luLerp(LU_FALLEN[k], LU_ANGEL[k], bodyK);
        const lean = pose.lean * Math.PI / 180, S = LU_L / LU_RIG;
        const ox = lu.x, oy = lu.y + bodyK * LU_ANGEL_BOB * S * Math.sin(clock * Math.PI / 2);
        const w = luLerp(1, LU_WITHER, witherK);
        const into = luClamp((1 - w) / Math.max(0.01, 1 - LU_WITHER));
        const sag = (pose.lean + LU_SLUMP * into) * Math.PI / 180;
        const [ax, ay] = luOnBody(0, 0, LU_RIG, lean, HL_HEAD_U, HL_HEAD_V);
        const hx = ax + pose.headDx, hy = ay + pose.headDy - 6 * bodyK;
        const tilt = sag - lean;
        const cx = ax + w * (-ax * Math.cos(tilt) + ay * Math.sin(tilt));
        const cy = ay + w * (-ax * Math.sin(tilt) - ay * Math.cos(tilt));
        const bw = HL_HEAD_W * LU_RIG * luLerp(pose.headSize, LU_ANGEL.headSize * LU_HEAD_SIZE, headK), bh = bw * BALL_RY / BALL_RX;
        const sway = luLerp(pose.headTurn + pose.headSway * Math.sin(clock * 2 * Math.PI / 1.8),
                            pose.headSway * Math.sin(clock * 2 * Math.PI / 5), bodyK);
        const fall = sec - T.fallAt;
        return { sec, p, T, bodyK, redK, auraK, fillK, wingK, ringGrow: luLerp(LU_RING_START, 1, ringK),
                 lean, S, ox, oy, w, sag, ax, ay, hx, hy, cx, cy, bw, bh, fall,
                 root: HL_HEAD_W * LU_RIG * LU_ANGEL.headSize * LU_HEAD_SIZE * 0.45,
                 ha: lean + sway * Math.PI / 180,
                 headOpen: fall < 0 ? 0 : luClamp(fall / (LU_SHED_FALL * 0.6)),
                 wingOpen: luClamp((sec - T.wingAt - LU_WING_GROW_SECS * 0.7) / 1.2),
                 fx: ox + hx * S, fy: oy + hy * S, fw: bw * S, fh: bh * S };
    }

    // Where the body is `fall` seconds after it lets go (before that, where it
    // hangs whole): dropping away from his neck as if on a thread that
    // stretches, swinging more as it goes, then falling free with the speed
    // and swing it had. The thread is never drawn. Rig px.
    function luShedAt(cf) {
        const { fall, ax, ay, cx, cy, sag } = cf;
        const base = -Math.PI / 2 + sag, dx = cx - ax, dy = cy - ay, r = Math.hypot(dx, dy) || 1;
        const hung = f => {
            const k = luClamp(f / LU_HANG_SECS), len = LU_THREAD * LU_RIG * k * k;
            const th = LU_HANG_SWING * Math.PI / 180 * k * Math.sin(2 * Math.PI * f / LU_HANG_SWING_SECS);
            const c = Math.cos(th), s = Math.sin(th);
            const px = ax + (dx * c - dy * s) / r * len, py = ay + (dx * s + dy * c) / r * len;
            return { x: px + dx * c - dy * s, y: py + dx * s + dy * c, a: base + th, alpha: 1 };
        };
        if (fall <= 0) return { x: cx, y: cy, a: base, alpha: 1 };
        if (fall < LU_HANG_SECS) return hung(fall);
        const e = 1 / 60, h1 = hung(LU_HANG_SECS), h0 = hung(LU_HANG_SECS - e);
        const vx = (h1.x - h0.x) / e, vy = (h1.y - h0.y) / e, va = (h1.a - h0.a) / e;
        const f = fall - LU_HANG_SECS;
        return { x: h1.x + vx * f, y: h1.y + vy * f + 0.5 * LU_SHED_DROP * f * f,
                 a: h1.a + va * f + f * 1.1, alpha: 1 - f / LU_SHED_FALL };
    }

    // ---- the crown -------------------------------------------------------------------
    // What of it is left: for each wheel, which bones are gone, taken
    // `chunk` at a time; for each wing (right up, out, down, then the left),
    // how many of its three layers. Beside each, what has EVER been taken,
    // which is all his health counts: what is gone grows back (wheelT and
    // wingT count up to LU_CROWN_REGROW, and wheelIn and wingIn to 1 as it
    // grows) but only as armour, so his bar never goes back up.
    function luCrownFresh() {
        const wheels = v => LU_WHEELS.map(() => new Array(Math.max(1, Math.round(LU_RING_BONES))).fill(v));
        return { wheel: wheels(false), wheelTaken: wheels(false), wheelT: wheels(0), wheelIn: wheels(1),
                 chunk: Math.max(1, Math.round(LU_WHEEL_CHUNK)),
                 wing: [0, 0, 0, 0, 0, 0], wingTaken: [0, 0, 0, 0, 0, 0], wingT: [0, 0, 0, 0, 0, 0], wingIn: [1, 1, 1, 1, 1, 1] };
    }
    function luCrownLeft() {
        const c = lu.crown;
        if (!c) return 0;
        let n = 0;
        for (const taken of c.wheelTaken) {
            const chunks = new Set();
            taken.forEach((g, k) => { if (!g) chunks.add(Math.floor(k / c.chunk)); });
            n += chunks.size;
        }
        for (const s of c.wingTaken) n += 3 - s;
        return n;
    }
    // what is gone grows back: a wheel's run of bones together, a wing a
    // layer at a time, the bone first
    function luCrownStep(dt) {
        const c = lu.crown;
        if (!c) return;
        c.wheel.forEach((gone, wi) => gone.forEach((g, k) => {
            c.wheelIn[wi][k] = Math.min(1, c.wheelIn[wi][k] + dt / LU_CROWN_GROW_IN);
            if (!g || (c.wheelT[wi][k] += dt) < LU_CROWN_REGROW) return;
            gone[k] = false; c.wheelT[wi][k] = 0; c.wheelIn[wi][k] = 0;
        }));
        c.wing.forEach((s, w) => {
            c.wingIn[w] = Math.min(1, c.wingIn[w] + dt / LU_CROWN_GROW_IN);
            if (s <= 0 || (c.wingT[w] += dt) < LU_CROWN_REGROW) return;
            c.wing[w]--; c.wingT[w] = 0; c.wingIn[w] = 0;
        });
    }

    // a point on a unit circle, set in a wheel and turned with it: [x, y, z]
    // with +z toward you
    function luWheelPoint(w, th) {
        const tilt = w.tilt * Math.PI / 180, yaw = w.yaw * Math.PI / 180 + clock * w.turn * LU_RING_SPEED;
        const rot = ([x, y, z]) => {
            const y1 = y * Math.cos(tilt) - z * Math.sin(tilt), z1 = y * Math.sin(tilt) + z * Math.cos(tilt);
            return [x * Math.cos(yaw) + z1 * Math.sin(yaw), y1, -x * Math.sin(yaw) + z1 * Math.cos(yaw)];
        };
        return { p: rot([Math.cos(th), Math.sin(th), 0]), tan: rot([-Math.sin(th), Math.cos(th), 0]) };
    }

    // Every piece of the crown this frame, in the field: `wheel` (bones and
    // the faces set in them, each with a depth), `feathers` (in the order to
    // draw them) and `eyes` (on the wings).
    function luCrownNow() {
        const cf = lu.cf, out = { wheel: [], feathers: [], eyes: [] };
        luWheels(cf, out);
        luSeraph(cf, out);
        const S = cf.S, F = d => { d.x = cf.ox + d.x * S; d.y = cf.oy + d.y * S; if (d.len) d.len *= S; if (d.r) d.r *= S; };
        out.wheel.forEach(F); out.feathers.forEach(F); out.eyes.forEach(F);
        return out;
    }

    function luWheels(cf, out) {
        const R = LU_RING_R * cf.ringGrow;
        LU_WHEELS.forEach((w, wi) => {
            const gone = lu.crown.wheel[wi], n = gone.length, r = R * w.r;
            for (let k = 0; k < n; k++) {
                if (gone[k]) continue;
                const th = k / n * 2 * Math.PI + clock * w.run * LU_RING_SPEED;
                const { p, tan } = luWheelPoint(w, th);
                // as long as its share of the rim, and smaller where the wheel
                // turns away from you: smaller as a whole, never squashed. One
                // growing back comes in small.
                const along = Math.hypot(tan[0], tan[1]), grow = lu.crown.wheelIn[wi][k];
                const husk = lu.crown.wheelTaken[wi][k];    // grown back: it no longer counts
                out.wheel.push({ kind: 'wheel', wheel: wi, k, chunk: Math.floor(k / lu.crown.chunk),
                                 x: cf.hx + p[0] * r, y: cf.hy + p[1] * r, z: p[2], a: Math.atan2(tan[1], tan[0]),
                                 len: 2 * Math.PI * r / n * 1.12 * (0.55 + 0.45 * along) * luLerp(0.2, 1, luEase(grow)),
                                 tint: LU_REDS[(k + wi) % 3], flip: k % 2, solid: grow >= 1, husk });
                if (k % 2 === 0) out.wheel.push({ kind: 'eye', x: cf.hx + p[0] * r, y: cf.hy + p[1] * r, z: p[2] + 0.01,
                                                  face: luClamp(0.35 + p[2] * 0.65) * grow, seed: wi * 40 + k,
                                                  size: LU_EYE_SIZE * cf.ringGrow, husk });
            }
        });
    }

    // Six wings round his head, each built like a bird's: a bone of
    // LU_WING_BONES joints out from his head, rows of feathers hanging off
    // it, the bone over them along the leading edge. A beat rolls out from his
    // head to the tip. As his last health goes (lu.limp) they sink toward
    // hanging down and beat less and slower. A wing's layers go outermost
    // first: group 0 the flight feathers, 1 the rows over them, 2 the bone
    // and its eyes.
    function luSeraph(cf, out) {
        const k = cf.wingK;
        if (k <= 0.01) return;
        const deg = x => x * Math.PI / 180, limp = lu.limp, c = lu.crown;
        [1, -1].forEach(side => LU_SERAPH.forEach((wing, wi) => {
            const wid = (side > 0 ? 0 : 3) + wi, stage = c.wing[wid];
            if (stage >= 3) return;
            const d = deg(wing.deg + (90 - wing.deg) * LU_LIMP_DROOP * limp);
            const th = side > 0 ? d : Math.PI - d, span = LU_WING_SPAN * wing.len * k;
            luWing(out, { x: cf.hx + Math.cos(th) * cf.root, y: cf.hy + Math.sin(th) * cf.root, th,
                          tr: wing.trail * side, span, k, ph: wi * 0.2, beat: LU_WING_BEAT * (1 - 0.8 * limp),
                          wid, stage, grow: c.wingIn[wid], taken: c.wingTaken[wid], cx: cf.hx, cy: cf.hy,
                          reach: cf.root + span * 1.25, rows: LU_WING_ROWS, eyes: true });
        }));
    }

    // One wing, from (x, y) pointing th, its feathers sweeping round the way
    // tr says: the bone's joints bent by a beat that reaches each later, the
    // rows hung off it, the bone over them, the eyes along it. Layers below
    // `stage` are gone; the one at `stage` is growing back, `grow` of the way.
    // Layers below `taken` have been broken before, and are husks now.
    // Shading darkens toward (cx, cy). Feathers go into out.feathers in the
    // order to draw them, each with its row's `group` and its place `i` in it.
    function luWing(out, w) {
        const deg = x => x * Math.PI / 180, seg = w.span / LU_WING_BONES, tr = w.tr;
        const wave = lag => Math.sin(2 * Math.PI * (lu.wingPh - lag - w.ph)) * w.beat;
        const joints = [];
        let a = w.th, x = w.x, y = w.y;
        for (let j = 0; j < LU_WING_BONES; j++) {
            a += tr * deg(LU_WING_FLAP.swing[j] * wave(j * LU_WING_FLAP.lag));
            joints.push({ x, y, a });
            x += Math.cos(a) * seg; y += Math.sin(a) * seg;
        }
        const at = f => {
            const s2 = Math.min(w.span * f, w.span - 1e-6), jn = Math.min(LU_WING_BONES - 1, Math.floor(s2 / seg));
            const jt = joints[jn], u = s2 - jn * seg;
            return [jt.x + Math.cos(jt.a) * u, jt.y + Math.sin(jt.a) * u, jt.a];
        };
        const tone = (fx, fy, lift) => luClamp(0.03 + 0.9 * luEase((Math.hypot(fx - w.cx, fy - w.cy) / w.reach - 0.2) / 0.75) + lift);
        const grown = group => group === w.stage ? luEase(w.grow) : 1;
        w.rows.forEach((row, ri) => {
            const group = ri ? 1 : 0;
            if (group < w.stage) return;
            const g = grown(group);
            for (let i = row.n - 1; i >= 0; i--) {
                const f = i / (row.n - 1);
                const [ax, ay, sa] = at(luLerp(row.at[0], row.at[1], f));
                const len = w.span * luLerp(row.len[0], row.len[1], f) * luLerp(0.3, 1, g);
                const fa = sa + tr * deg(luLerp(row.sweep[0], row.sweep[1], f) * (0.4 + 0.6 * w.k) +
                                         LU_WING_FLAP.feather * f * wave(f * LU_WING_BONES * LU_WING_FLAP.lag + LU_WING_FLAP.featherLag));
                const fx = ax + Math.cos(fa) * len / 2, fy = ay + Math.sin(fa) * len / 2;
                out.feathers.push({ kind: 'feather', wing: w.wid, group, i, x: fx, y: fy, a: fa, len,
                                    flip: (i + ri) % 2, k: w.k * g, tone: tone(fx, fy, row.lift), tr, solid: g >= 1,
                                    husk: group < (w.taken || 0) });
            }
        });
        const bl = seg * 1.12, gb = grown(2);
        joints.forEach((jt, j) => {
            const mx = jt.x + Math.cos(jt.a) * seg / 2, my = jt.y + Math.sin(jt.a) * seg / 2;
            const off = -tr * bl / SHAPE_ASPECT * 0.3;
            const bx = mx - Math.sin(jt.a) * off, by = my + Math.cos(jt.a) * off;
            out.feathers.push({ kind: 'feather', wing: w.wid, group: 2, i: j, x: bx, y: by, a: jt.a, len: bl * luLerp(0.3, 1, gb),
                                flip: j % 2, k: w.k * gb, tone: tone(bx, by, 0.2), tr, solid: gb >= 1,
                                husk: 2 < (w.taken || 0) });
        });
        if (!w.eyes) return;
        for (const [f, inward, size] of LU_WING_EYES) {
            const [ex, ey, sa] = at(f), fa = sa + tr * Math.PI / 2;
            out.eyes.push({ x: ex + Math.cos(fa) * w.span * inward, y: ey + Math.sin(fa) * w.span * inward, r: w.span * size * gb });
        }
    }

    // A hit on the crown: on a wheel, the run of bones the struck one is in;
    // on a wing, its outermost layer, wherever on it the head struck. What
    // goes falls away from his head, and costs him health -- the first time.
    // A piece that has grown back breaks the same, but costs him nothing.
    function luBreakCrown(b, pc, cx, cy) {
        const now = lu.now, c = lu.crown;
        let gone, fresh = false;
        if (pc.kind === 'wheel') {
            gone = now.wheel.filter(d => d.kind === 'wheel' && d.wheel === pc.wheel && d.chunk === pc.chunk);
            c.wheel[pc.wheel].forEach((_, k) => {
                if (Math.floor(k / c.chunk) !== pc.chunk) return;
                if (!c.wheelTaken[pc.wheel][k]) fresh = true;
                c.wheel[pc.wheel][k] = c.wheelTaken[pc.wheel][k] = true;
                c.wheelT[pc.wheel][k] = 0;
            });
        } else {
            const layer = c.wing[pc.wing];
            gone = now.feathers.filter(d => d.wing === pc.wing && d.group === layer);
            c.wing[pc.wing]++;
            c.wingT[pc.wing] = 0;
            c.wingIn[pc.wing] = 1;
            if (c.wing[pc.wing] > c.wingTaken[pc.wing]) { c.wingTaken[pc.wing] = c.wing[pc.wing]; fresh = true; }
        }
        const hx = lu.cf.fx, hy = lu.cf.fy;
        for (const d of gone) {
            const dx = d.x - hx, dy = d.y - hy, n = Math.hypot(dx, dy) || 1;
            lu.debris.push(Object.assign({}, d, { vx: dx / n * 140 + (Math.random() - 0.5) * 80,
                                                   vy: dy / n * 140 - 80, va: (Math.random() - 0.5) * 7, age: 0 }));
        }
        if (fresh) luHurt(b, cx, cy);
        else award(BOSS_PTS / 3, cx, cy);
    }

    // Straight down to `hp`, taking the crown first, a layer of every wing and
    // a run of every wheel in turn, and then off his head. For the lab.
    function luStrip(b, hp) {
        const c = lu.crown;
        // by what has been taken, not what is gone, so each step is a piece of his health
        while (b.hp > hp && luCrownLeft() > 0) {
            const w = c.wingTaken.findIndex(t => t < 3 && t === Math.min(...c.wingTaken));
            const wi = c.wheelTaken.findIndex(g => g.some(x => !x));
            if (w >= 0 && (wi < 0 || c.wingTaken[w] <= 1)) { c.wingTaken[w]++; c.wing[w] = Math.max(c.wing[w], c.wingTaken[w]); }
            else if (wi >= 0) {
                const taken = c.wheelTaken[wi], k = taken.indexOf(false), ch = Math.floor(k / c.chunk);
                taken.forEach((_, j) => { if (Math.floor(j / c.chunk) === ch) taken[j] = c.wheel[wi][j] = true; });
            }
            b.hp--;
        }
        b.hp = Math.max(Math.min(b.hp, hp), 0);
    }

    // ---- motes -----------------------------------------------------------------------
    // specks of light: yours running up his hand into him while he drains
    // you, and HIS running down into you from wherever you hurt him
    function luMoteStep(dt) {
        if (lu.stage === 'drain') {
            for (lu.moteAcc += dt * 45; lu.moteAcc >= 1; lu.moteAcc--) {
                lu.motes.push({ t: 0, sway: (Math.random() - 0.5) * 70, life: 0.9 + Math.random() * 0.3 });
            }
        }
        lu.motes = lu.motes.filter(m => (m.t += dt) < m.life);
        if (['break', 'drain', 'turn', 'dying', 'end'].includes(lu.stage)) luFrozenStep();
    }
    function luSap(x, y) {
        for (let i = 0; i < 16; i++) {
            lu.motes.push({ t: -i * 0.02, sway: (Math.random() - 0.5) * 90, life: 0.8 + Math.random() * 0.35, from: [x, y] });
        }
    }

    // ---- being hit -------------------------------------------------------------------
    function luContact(br, ball) {
        lu.pend = null;
        if (phase === 'entrance' || lu.frozen.has(ball)) return null;
        const cap = (x, y, a, len, r) => {
            const dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2;
            return capsuleContact(ball, x - dx, y - dy, x + dx, y + dy, r);
        };
        // the hollow of an open claw is a catch, not a bounce off its fingers
        for (const h of lu.hands) {
            if (h.form !== 'claw' || h.held || ball.luPass || ball.vy >= 0 || h.open < 0.6) continue;
            const pk = luPocket(h);
            if (Math.hypot(ball.x - pk.x, ball.y - pk.y) < pk.r) {
                lu.pend = { pocket: h };
                return { cx: ball.x, cy: ball.y - bRY() };
            }
        }
        for (const o of lu.orbs) {
            if (!luOrbLive(o)) continue;
            const hit = cap(o.x, o.y, o.a, o.len, o.len / SHAPE_ASPECT * 0.5 + 2);
            if (hit) { lu.pend = { orb: o, ball }; return hit; }
        }
        for (const tr of lu.trees) {
            for (const s of tr.segs) {
                const hit = capsuleContact(ball, s.x0, s.y0, s.x1, s.y1, s.len * 1.1 / SHAPE_ASPECT * 0.42);
                if (hit) { lu.pend = { branch: s, tree: tr }; return hit; }
            }
        }
        for (const bd of lu.birds) {
            if (!luBirdLive(bd)) continue;
            const hit = ellipseContact(ball, bd.x, bd.y, LU_BIRD_S * 0.45, LU_BIRD_S * 0.45);
            if (hit) { lu.pend = { bird: bd, ball }; return hit; }
        }
        if (luCorrupted()) {
            if (lu.stage === 3 && lu.now) {
                // nearest you first: the near half of the wheels, then the wings, then the far half
                const near = lu.now.wheel.filter(d => d.kind === 'wheel' && d.z >= 0);
                const far = lu.now.wheel.filter(d => d.kind === 'wheel' && d.z < 0);
                for (const d of near.concat(lu.now.feathers, far)) {
                    if (!d.solid) continue;
                    const hit = cap(d.x, d.y, d.a, d.len, d.len / SHAPE_ASPECT * 0.42);
                    if (hit) { lu.pend = { crown: d }; return hit; }
                }
            }
            const cf = lu.cf;
            const hit = cf && ellipseContact(ball, cf.fx, cf.fy, cf.fw / 2, cf.fh / 2);
            if (hit) lu.pend = { body: true };
            return hit || null;
        }
        if (!ball.luPass) {
            const floor = padY() - padH() - 60;
            for (const p of lu.pieces) {
                if (p.gone || p.k < 0.5) continue;
                const h = luHand(p.side);
                if (h.form === 'fist' && p.y > floor) continue;     // on the floor it is no wall
                if (h.form === 'clap') continue;                     // reaching for it, not in its way
                // a feather is a whole Brandon, thinner than the bone it was
                const len = p.len * lu.bd.sc * p.s, th = h.form === 'wings' ? len / SHAPE_ASPECT : p.thick * lu.bd.sc * p.s;
                const hit = cap(p.x, p.y, p.a, len, th * 0.42);
                if (hit) { lu.pend = { piece: p, ball }; return hit; }
            }
        }
        const d = lu.bd;
        let hit = ellipseContact(ball, d.hx, d.hy, d.hw / 2, d.hh / 2);
        if (!hit) hit = maskContact(ball, d.bx, d.by, -Math.PI / 2 + d.bLean, d.bL, d.bT, hlMask(), false);
        if (hit) lu.pend = { body: true };
        return hit;
    }

    function luTouch(br, ball, hit) {
        if (!lu.pend) return false;
        if (lu.pend.pocket) {
            luCatch(lu.pend.pocket, ball);
            lu.pend = null;
            return true;
        }
        // swooping, he meets a head with all of him moving: it goes back
        // down at you, harder, carried the way he was going -- and the hit
        // still counts, on a feather or on him
        if (luDiving() && (lu.pend.body || lu.pend.piece) && !(ball.luSpikeT > clock)) {
            labBounce(ball, hit);
            const sp = Math.min(effSpeed() * LU_SPIKE, Math.max(effSpeed(), LU_SPIKE_CAP));
            const vx = ball.vx + (lu.sw.vx || 0) * 0.5, vy = Math.max(Math.abs(ball.vy), sp * 0.6);
            const n = Math.hypot(vx, vy) || 1;
            ball.vx = vx / n * sp; ball.vy = vy / n * sp;
            ball.boost = sp / effSpeed();
            ball.luSpikeT = clock + 0.3;
            luHit(bricks[0], hit.cx, hit.cy);
            return true;
        }
        return false;
    }

    // A ring where it struck, for the hits that do nothing: everything drawn
    // in stone, and his head in the moment after a hit.
    function luGlances() {
        const pd = lu.pend;
        if (!pd) return false;
        if (pd.piece) return luInert(pd.piece);
        if (pd.orb || pd.branch || pd.bird || pd.crown) return false;
        return luArmoured() || bossIF > 0;
    }

    function luHit(b, cx, cy) {
        const pd = lu.pend;
        lu.pend = null;
        if (!pd) return;
        if (pd.orb) {
            const dx = pd.ball.x - cx, dy = pd.ball.y - cy, n = Math.hypot(dx, dy) || 1;
            luKnock(pd.orb, dx / n, dy / n);
            award(BOSS_PTS / 3, cx, cy);
            return;
        }
        if (pd.branch) { luSnap(pd.tree, pd.branch); award(BOSS_PTS / 3, cx, cy); return; }
        if (pd.bird) {
            const bd = pd.bird, dx = pd.ball.x - cx, dy = pd.ball.y - cy, n = Math.hypot(dx, dy) || 1;
            Object.assign(bd, { st: 'hit', vx: -dx / n * 160, vy: -dy / n * 160 - 100, spin: (Math.random() - 0.5) * 12 });
            award(BOSS_PTS / 3, cx, cy);
            return;
        }
        if (pd.crown) { luBreakCrown(b, pd.crown, cx, cy); return; }
        if (pd.piece) {
            const p = pd.piece, h = luHand(p.side);
            p.flash = 1;
            if (h.form === 'wings') {
                // away from the head that struck it
                const dx = pd.ball.x - cx, dy = pd.ball.y - cy, n = Math.hypot(dx, dy) || 1;
                luKnock(p, dx / n, dy / n);
                award(BOSS_PTS / 3, cx, cy);
            } else if (LU_BREAKS.includes(h.form)) {
                if (++h.hits >= LU_FORM_HP) {
                    award(BOSS_PTS, cx, cy);
                    luForm(h, 'arm');
                } else award(BOSS_PTS / 3, cx, cy);
            }
            return;
        }
        if (luArmoured() || bossIF > 0) return;
        b.flash = 1;
        bossIF = BOSS_IF;
        luHurt(b, cx, cy);
    }

    // One off his bar, and he shakes: in the last part, run down into you as
    // HIS light. The first two parts end where the bar says, not at empty.
    function luHurt(b, cx, cy) {
        b.hp = Math.max(0, b.hp - 1);
        bossHits++;
        lu.shake = 1;
        award(BOSS_PTS, cx, cy);
        if (lu.stage === 3) {
            luSap(cx, cy);
            if (b.hp / b.maxHp <= LU_GREY_AT) lu.flash3 = 1;
        }
        const ends = lu.stage === 2 ? LU_DRAIN_LEFT : 0;
        if (b.hp <= ends + 1e-6) { luNext(b); return; }
        if (bossHits % BOSS_CAP === 0 && !capsule) {
            capsule = { x: cx, y: cy, kind: labCapKind() };
        }
        if (++hits === 4 || hits === 12) bumpSpeed(1.12);
    }

    // Straight to the start of a part, from wherever the fight is: whatever
    // is held is let go, everything he has out stops, and both hands come home.
    function luJump(b, stage) {
        luThaw();
        luCallOff();
        lu.trees = []; lu.birds = []; lu.beams = [];
        lu.clap = null; lu.motes = []; lu.slams = []; lu.debris = [];
        lu.stage = stage; lu.stT = 0; lu.mi = 0; lu.restT = stage === 3 ? LU_REST3 : LU_REST;
        lu.wither = 1;
        lu.crown = stage === 3 ? luCrownFresh() : null;
        lu.y = stage === 3 ? LU_Y3 : LU_Y;
        b.hp = b.maxHp = stage === 3 ? luCrownLeft() + LU_HEAD_HP : stage === 2 ? luHp2() : LU_HP1;
        lu.shake = 0; lu.grey = 0; lu.end = null; lu.perish = null; lu.ash = [];
        lu.swoop = null; lu.sw = null;
        for (const h of lu.hands) h.wingK = 0;
        for (const h of lu.hands) luForm(h, 'arm');
        for (const o of lu.orbs) o.gone = 0;
        if (stage === 3) { lu.cf = luCorruptFrame(); lu.now = luCrownNow(); }
    }

    // one part over, and on to the next
    function luNext(b) {
        lu.stT = 0;
        if (lu.stage === 1) {
            lu.stage = 'break';
            lu.mem = false; lu.memAsked = false;
            // the memory this break plays, let go out of him while he reels
            // (memory.js; the boss lab has none)
            const due = typeof menuMemoryDue === 'function' && menuMemoryDue();
            if (due && typeof memShardDrop === 'function') memShardDrop(lu.x, lu.y, due);
            for (const h of lu.hands) if (luActive(h)) luForm(h, 'arm');
            lu.clap = null;
            luCallOff();
            luFreeze();
            capsule = null;
        } else if (lu.stage === 2) {
            luDrainStart();
        } else if (lu.stage === 3) {
            labBurst();                 // every head in play goes off; skipBall hides what is held
            lu.stage = 'dying';
            luCallOff();
            luFreeze();
        }
    }

    // ---- the end ------------------------------------------------------------------
    // His words are said and he burns away. You stand up where you lay, boot
    // on the floor, walk to the middle, and as you grow to LU_END_ODIN_L you
    // slowly become Odin, HIS light swelling past his own as you do and
    // settling as you say his name. BRANDON WINS stands over you as him; only
    // then the black, and the town. The takeover never runs.
    //
    // You do it as the standard paddle with no capsule running: every paddle
    // and capsule has looks of its own that fight Odin's, and THE PAIR and
    // DOUBLE are more than one of you to stand up. Your paddle fades into the
    // standard one over LU_END_SWAP, halves sliding together and capsules
    // running out rather than stopping. The paddle you chose (LAB.pad) is
    // left alone, and is back in your hands after.
    const LU_STAND_TURN = -Math.PI / 2;  // which way up you stand: your head at the top
    function luEndStart() {
        labPadFade('standard', LU_END_SWAP);
        // every capsule off, the wiggle easing out as it always does
        for (const k of Object.keys(fx)) fx[k] = k === 'W' ? Math.min(fx.W, WIG_EASE) : 0;
        dragT = 0;
        if (typeof stunPad === 'function') stunPad(0);
        capsule = null;
        lu.end = { x: paddle.x };
        lu.stage = 'end'; lu.stT = 0;
        lu.perish = null; lu.ash = [];
    }
    function luEndTimes() {
        const stand = LU_END_CRUMBLE * 0.6, grow = stand + LU_END_STAND * 0.7, morph = grow;
        const yell = morph + LU_END_MORPH, wins = yell + LU_END_HOLD, out = wins + LU_END_WINS, done = out + LU_END_OUT;
        return { stand, grow, morph, yell, wins, out, done };
    }
    // how far into each beat the end is, eased; `surge` is how far his light
    // is swollen past his own, up through the change and down after it
    function luEndPose() {
        const T = luEndTimes(), t = lu.stT;
        return { t, T, crumble: luClamp(t / LU_END_CRUMBLE), stand: luEase((t - T.stand) / LU_END_STAND),
                 grow: luEase((t - T.grow) / LU_END_GROW),
                 morph: typeof memOdin === 'function' ? luEase((t - T.morph) / LU_END_MORPH) : 0,
                 surge: t < T.yell ? luEase((t - T.morph) / LU_END_MORPH) : 1 - luEase((t - T.yell) / LU_END_SETTLE),
                 wins: luEase((t - T.wins) / 0.6), black: luEase((t - T.out) / LU_END_OUT) };
    }
    function luEndDone() {
        labPadUse(LAB.pad);
        if (typeof menuWon === 'function') menuWon();
    }

    // ---- the picture -----------------------------------------------------------------
    // colour laid over any sprite, baked once
    function luTinted(key, src, color, a) {
        const k = 'lu-' + key;
        if (spriteCache.has(k)) return spriteCache.get(k);
        if (!src || (src.naturalWidth === 0)) return null;
        const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        g.drawImage(src, 0, 0, w, h);
        g.globalCompositeOperation = 'source-atop';
        g.globalAlpha = a;
        g.fillStyle = color;
        g.fillRect(0, 0, w, h);
        spriteCache.set(k, c);
        return c;
    }
    // a whole Brandon in one colour with his creases through it, as the
    // memories have the clay
    function luBone(color) {
        const k = 'lu-bone' + color;
        if (spriteCache.has(k)) return spriteCache.get(k);
        if (!ready(paddleImg)) return null;
        const w = 300, h = Math.round(w / SHAPE_ASPECT);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        placeShape(g, w, h, false);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = color;
        g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = 'multiply';
        g.filter = 'grayscale(1) contrast(0.55) brightness(2.6) contrast(1.6)';
        placeShape(g, w, h, false);
        g.filter = 'none';
        g.globalCompositeOperation = 'destination-in';
        placeShape(g, w, h, false);
        spriteCache.set(k, c);
        return c;
    }
    // a brick's own wash, the one the walls wear
    const luBrick = color => shapeSprite('luBrick' + color, color, 300, 300 / SHAPE_ASPECT, false);
    // a soft round blob of light
    function luBlob(color) {
        const k = 'lu-blob' + color;
        if (spriteCache.has(k)) return spriteCache.get(k);
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        gr.addColorStop(0, color);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 128, 128);
        spriteCache.set(k, c);
        return c;
    }
    // a Brandon on `g`, centred on (x, y), `len` long, his head pointing `a`
    function luPut(g, img, x, y, len, a, flip) {
        if (!img) return;
        const th = len / SHAPE_ASPECT;
        g.save();
        g.translate(x, y);
        g.rotate(a);
        if (flip) g.scale(1, -1);
        g.drawImage(img, -len / 2, -th / 2, len, th);
        g.restore();
    }

    function luDrawPiece(p, alpha) {
        const sc = lu.bd.sc;
        // in a wing it is a feather, and on its way in or out, some of each
        if (p.wing > 0.01) {
            luDrawFeather(ctx, { x: p.x, y: p.y, a: p.a, len: p.len * sc * p.s, flip: p.flip, k: 1, tone: p.tone, tr: p.tr },
                          alpha * p.wing);
            alpha *= 1 - p.wing;
            if (alpha <= 0.01 && !p.flash) return;
        }
        const w = (p.len + p.thick * 0.3) * sc, h = p.thick * sc;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.a);
        ctx.scale(p.s * (p.flip ? -1 : 1), p.s);
        const clay = luBone(LU_CLAY);
        if (clay) ctx.drawImage(clay, -w / 2, -h / 2, w, h);
        // darker the nearer his body, into the black of his shirt
        const shirt = p.dark > 0.01 && luBone(LU_SHIRT);
        if (shirt) {
            ctx.globalAlpha = alpha * p.dark;
            ctx.drawImage(shirt, -w / 2, -h / 2, w, h);
        }
        // stone over it while a hit would do nothing to it
        if (p.stone > 0.01) {
            const st = shapeSprite('luStone', STONE, 300, 300 / SHAPE_ASPECT, 'statue');
            ctx.globalAlpha = alpha * p.stone;
            if (st) ctx.drawImage(st, -w / 2, -h / 2, w, h);
        }
        if (p.flash > 0) {
            ctx.globalAlpha = alpha * p.flash * 0.8;
            const fl = shapeSprite('luFlash', '#f2efe9', 300, 300 / SHAPE_ASPECT, true);
            if (fl) ctx.drawImage(fl, -w / 2, -h / 2, w, h);
        }
        ctx.restore();
    }

    // a little one, in its own colour
    function luDrawOrb(o) {
        if (o.gone > 0.8 || !o.len) return;
        const al = o.gone ? 1 - o.gone / 0.8 : 1;
        ctx.save();
        ctx.globalAlpha = al;
        luPut(ctx, luBrick(o.tint), o.x, o.y, o.len, o.a, o.ri % 2);
        if (o.flash > 0) { ctx.globalAlpha = al * o.flash; luPut(ctx, luBone('#f2efe9'), o.x, o.y, o.len, o.a, o.ri % 2); }
        ctx.restore();
    }

    // The Fallen: the body stood on end and the ball on his shoulders, stone
    // over both while nothing can reach him.
    function luDrawBody(d, flash, stone) {
        const sp = hlSprite('raw');
        if (!sp || !ready(ballImg)) return;
        ctx.save();
        ctx.translate(d.bx, d.by);
        ctx.rotate(-Math.PI / 2 + d.bLean);
        const w = d.bL, h = d.bT;
        ctx.drawImage(sp, -w / 2, -h / 2, w, h);
        if (stone > 0.01) {
            ctx.globalAlpha = stone;
            ctx.drawImage(luTinted('bodyStone', sp, STONE, 0.85), -w / 2, -h / 2, w, h);
            ctx.globalAlpha = 1;
        }
        if (flash > 0) {
            ctx.globalAlpha = Math.min(1, flash) * 0.7;
            ctx.drawImage(hlSprite('flash'), -w / 2, -h / 2, w, h);
            ctx.globalAlpha = 1;
        }
        ctx.restore();
        ctx.save();
        ctx.translate(d.hx, d.hy);
        ctx.rotate(d.ha);
        ctx.drawImage(ballImg, -d.hw / 2, -d.hh / 2, d.hw, d.hh);
        if (stone > 0.01) {
            ctx.globalAlpha = stone;
            const st = headSprite2('stone');
            if (st) ctx.drawImage(st, -d.hw / 2, -d.hh / 2, d.hw, d.hh);
        }
        if (flash > 0) {
            ctx.globalAlpha = Math.min(1, flash) * 0.7;
            ctx.drawImage(headSprite2('flat', '#f2efe9'), -d.hw / 2, -d.hh / 2, d.hw, d.hh);
        }
        ctx.restore();
    }

    function luDrawFallen(b) {
        // a clap's hands are only half there: a head goes straight through them
        const solid = p => p.gone ? Math.max(0, 1 - p.gone / 0.8) : luHand(p.side).form === 'clap' ? 0.5 : 1;
        for (const p of lu.pieces) if (p.back && !p.gone) luDrawPiece(p, solid(p));
        // over a wing's long feathers, its rows and its bone
        for (const h of lu.hands) if (h.wingK > 0.01) for (const f of h.deco) luDrawFeather(ctx, f, h.wingK);
        luDrawBody(lu.bd, b.flash, lu.stone);
        // round each hand's middle: the far side of their rings behind the hand
        for (const o of lu.orbs) if (o.z < 0) luDrawOrb(o);
        for (const p of lu.pieces) if (!p.back) luDrawPiece(p, solid(p));
        for (const o of lu.orbs) if (o.z >= 0) luDrawOrb(o);
    }

    // One eye, wherever it is: a red glow and a hot point in it, breathing,
    // and shutting now and then on its own clock.
    function luDrawEye(g, x, y, r, k, seed) {
        const glow = (0.8 + 0.2 * Math.sin(clock * 2 * Math.PI / 2.2 + seed * 1.7)) * luBlink(seed + 500) * k;
        if (glow <= 0.005) return;
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.75 * glow;
        g.drawImage(luBlob('rgba(255,40,30,1)'), x - r, y - r, r * 2, r * 2);
        g.globalAlpha = glow;
        g.drawImage(luBlob('rgba(255,210,190,1)'), x - r * 0.3, y - r * 0.3, r * 0.6, r * 0.6);
        g.restore();
    }
    // how open an eye is: now and then it shuts, each on its own clock
    function luBlink(i) {
        const period = 3 + 4 * luHash(i + 7), at = (clock + luHash(i) * period) % period;
        return at < 0.16 ? Math.abs(at - 0.08) / 0.08 : 1;
    }

    // a piece of the crown: a wheel's bone, or a face set in it
    function luDrawWheelPiece(g, d, alpha) {
        if (d.kind === 'eye') {
            if (d.face < 0.2) return;
            const img = luTinted('head55', ballImg, LU_RED_BODY, 0.55);
            if (!img) return;
            const s = d.size * lu.cf.S * (0.55 + 0.45 * d.face);
            g.save();
            g.globalAlpha = alpha * luClamp((d.face - 0.2) / 0.3);
            g.translate(d.x, d.y);
            g.scale(1, Math.max(0.08, luBlink(d.seed)));
            g.drawImage(img, -s * BALL_RX / BALL_RY / 2, -s / 2, s * BALL_RX / BALL_RY, s);
            g.restore();
            return;
        }
        g.save();
        // the far side of a wheel is in its own shadow
        g.globalAlpha = alpha * (0.55 + 0.45 * luClamp((d.z + 1) / 2));
        luPut(g, luBrick(d.tint), d.x, d.y, d.len, d.a, d.flip);
        g.restore();
    }
    // a feather: its shadow on what it lies over, a thin red edge, the
    // feather near black, and lighter over that as far as its tone says
    function luDrawFeather(g, f, alpha) {
        const th = f.len / SHAPE_ASPECT, S = LU_L / LU_RIG;
        const ink = luBone(LU_WING_INK), light = luBone(LU_WING_LIGHT), shade = luBone('#000000');
        if (!ink) return;
        g.save();
        g.translate(f.x, f.y);
        g.rotate(f.a);
        g.globalAlpha = alpha * 0.45 * f.k;
        g.save();
        g.translate(0, f.tr * LU_WING_SHADOW * S);
        g.scale(1, f.flip ? -1 : 1);
        g.drawImage(shade, -f.len / 2, -th / 2, f.len, th);
        g.restore();
        g.scale(1, f.flip ? -1 : 1);
        g.globalAlpha = alpha * 0.6 * f.k;
        g.drawImage(luBrick(LU_REDS[0]), -f.len * 0.52, -th * 0.52, f.len * 1.04, th * 1.04);
        g.globalAlpha = alpha * f.k;
        g.drawImage(ink, -f.len / 2, -th / 2, f.len, th);
        if (f.tone > 0.01) {
            g.globalAlpha = alpha * f.k * f.tone;
            g.drawImage(light, -f.len / 2, -th / 2, f.len, th);
        }
        g.restore();
    }

    // The canvases he is drawn on while he is the Corrupted, the size of the
    // field's, so what is laid over him lands only on him.
    const luLayers = [];
    function luLayer(i) {
        const like = ctx.canvas;
        if (!luLayers[i]) luLayers[i] = document.createElement('canvas');
        const c = luLayers[i];
        if (c.width !== like.width || c.height !== like.height) { c.width = like.width; c.height = like.height; }
        const g = c.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
        g.clearRect(0, 0, c.width, c.height);
        return c;
    }

    // The black round him, swelling, with a red edge and thin red rays
    // turning in it so it reads on a black field; centred on his head,
    // sized off where his wings' tips reach.
    function luDrawAura(cf) {
        if (cf.auraK <= 0.002) return;
        const swell = 0.5 + 0.5 * Math.sin(clock * 2 * Math.PI / 5.5);
        const reach = (cf.root + LU_WING_SPAN * 1.1 * 1.25) * cf.S;
        const ar = reach * 0.9 * (1 + 0.04 * swell) * (0.4 + 0.6 * cf.auraK);
        ctx.save();
        ctx.globalAlpha *= cf.auraK;
        const gr = ctx.createRadialGradient(cf.fx, cf.fy, ar * 0.1, cf.fx, cf.fy, ar);
        gr.addColorStop(0, 'rgba(0,0,0,0.95)');
        gr.addColorStop(0.62, 'rgba(0,0,0,0.8)');
        gr.addColorStop(0.86, 'rgba(160,20,40,' + (0.25 + 0.25 * swell).toFixed(3) + ')');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(cf.fx, cf.fy, ar, 0, 2 * Math.PI);
        ctx.fill();
        ctx.translate(cf.fx, cf.fy);
        ctx.rotate(clock * 0.05);
        ctx.strokeStyle = 'rgba(224,40,60,0.18)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 36; i++) {
            const a = i / 36 * 2 * Math.PI, r0 = ar * 0.55, r1 = r0 + ar * (i % 3 ? 0.2 : 0.38) * (0.8 + 0.4 * luHash(i + 300));
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
            ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
            ctx.stroke();
        }
        ctx.restore();
    }

    // The Corrupted, and the change into him. The aura goes straight on the
    // field; he goes on a layer of his own, where the silhouette he is while
    // changing, the grey of his last quarter and the red of a hit in it can
    // be laid over him alone.
    function luDrawCorrupt(b) {
        const cf = lu.cf, now = lu.now;
        if (!cf || !now || !ready(ballImg)) return;
        const going = lu.stage === 'end' ? luEase(luEndPose().crumble) : 0;
        ctx.save();
        ctx.globalAlpha = 1 - going;
        luDrawAura(cf);
        ctx.restore();
        const layer = luLayer(0), g = layer.getContext('2d');
        g.setTransform(ctx.getTransform());
        const S = cf.S;
        // the wings, and their eyes as they open
        for (const f of now.feathers) luDrawFeather(g, f, f.husk ? LU_HUSK : 1);
        const wingEyes = lu.stage === 'turn' ? cf.wingOpen : 1;
        now.eyes.forEach((e, i) => luDrawEye(g, e.x, e.y, e.r, luClamp(wingEyes * now.eyes.length - i), i + 100));
        // while he changes: his arm bones and his little ones flying up into
        // the wheels, each to a bone of it, which it becomes; the rest of the
        // wheels fading in behind them
        let pieces = now.wheel.map(d => ({ d, alpha: d.husk ? LU_HUSK : 1 }));
        if (lu.stage === 'turn') {
            const bones = now.wheel.filter(d => d.kind === 'wheel');
            const flyers = lu.pieces.map(p => ({ p, order: p.order }))
                .concat(lu.orbs.map((o, i) => ({ o, order: 0.8 + i * 0.035 })));
            const taken = new Set();
            pieces = now.wheel.filter(d => d.kind === 'eye').map(d => ({ d, alpha: cf.fillK }));
            flyers.forEach((f, i) => {
                const fly = luEase((cf.p - 0.05 - 0.2 * f.order) / 0.3);
                const to = bones[Math.floor((i + 0.5) * bones.length / flyers.length)];
                if (!to) return;
                taken.add(to);
                const src = f.p ? { x: f.p.x, y: f.p.y, a: f.p.a, w: (f.p.len + f.p.thick * 0.3) * lu.bd.sc * f.p.s,
                                    h: f.p.thick * lu.bd.sc * f.p.s, flip: f.p.flip }
                                : { x: f.o.x, y: f.o.y, a: f.o.a, w: f.o.len, h: f.o.len / SHAPE_ASPECT, flip: f.o.ri % 2 };
                const bend = Math.sin(fly * Math.PI) * 40 * S * (i % 2 ? 1 : -1);
                pieces.push({ fly, alpha: 1, d: { kind: 'flyer', x: luLerp(src.x, to.x, fly) + bend, y: luLerp(src.y, to.y, fly),
                              z: luLerp(1, to.z, fly), a: luAng(src.a, to.a, fly),
                              w: luLerp(src.w, to.len, fly), h: luLerp(src.h, to.len / SHAPE_ASPECT, fly),
                              flip: src.flip, tint: to.tint, from: f.o ? f.o.tint : null, dark: f.p ? f.p.dark : 0,
                              back: f.p && f.p.bone === 'arm0' && fly < 0.5 } });
            });
            bones.forEach(d => { if (!taken.has(d)) pieces.push({ d, alpha: cf.fillK }); });
        }
        pieces.sort((a, b2) => a.d.z - b2.d.z);
        const drawPiece = ({ d, alpha, fly }) => d.kind === 'flyer' ? luDrawFlyer(g, d, fly) : luDrawWheelPiece(g, d, alpha);
        pieces.filter(q => q.d.z < 0 || q.d.back).forEach(drawPiece);
        // the body, greying, sagging off his head, and dropping away
        if (lu.stage === 'turn') {
            const hang = luShedAt(cf), sp = hlSprite('raw');
            if (sp && hang.alpha > 0.001) {
                const L = LU_RIG * cf.w * S, T = L / SHAPE_ASPECT;
                g.save();
                g.globalAlpha = hang.alpha;
                g.translate(cf.ox + hang.x * S, cf.oy + hang.y * S);
                g.rotate(hang.a);
                g.drawImage(sp, -L / 2, -T / 2, L, T);
                g.globalAlpha = hang.alpha * cf.redK;
                g.drawImage(luTinted('bodyGrey', sp, LU_GREY_BODY, 0.72), -L / 2, -T / 2, L, T);
                g.restore();
            }
        }
        // his head, reddening, and his eyes as they open all over it -- and,
        // in his last LU_GLITCH_AT, glitching out of the world
        g.save();
        g.translate(cf.fx, cf.fy);
        g.rotate(cf.ha);
        const glitch = luGlitch(b);
        if (glitch > 0.001) luDrawGlitchHead(g, cf, b, glitch);
        else luDrawHead(g, cf, b);
        g.restore();
        pieces.filter(q => q.d.z >= 0 && !q.d.back).forEach(drawPiece);

        // what is laid over him alone: near a silhouette while he changes;
        // the grey, from LU_GREY_AT of his health left; a hit's red in it
        g.setTransform(1, 0, 0, 1, 0, 0);
        const sil = lu.stage === 'turn' ? LU_SHADOW * luEase(cf.sec / LU_SHADOW_IN) *
                    (1 - luEase((cf.sec - (cf.T.end - LU_REVEAL)) / LU_REVEAL)) : 0;
        if (sil > 0.001) {
            g.globalCompositeOperation = 'source-atop';
            g.globalAlpha = sil;
            g.fillStyle = LU_SILHOUETTE;
            g.fillRect(0, 0, layer.width, layer.height);
        }
        const grey = lu.stage === 'dying' || lu.stage === 'end' ? 1 : lu.stage === 3 ? luClamp(1 - b.hp / b.maxHp / LU_GREY_AT) : 0;
        if (grey > 0.001) {
            // the colour out of him and nowhere else: a copy keeps his shape
            const keep = luLayer(1), kg = keep.getContext('2d');
            kg.drawImage(layer, 0, 0);
            g.globalCompositeOperation = 'saturation';
            g.globalAlpha = grey;
            g.fillStyle = '#808080';
            g.fillRect(0, 0, layer.width, layer.height);
            g.globalCompositeOperation = 'destination-in';
            g.globalAlpha = 1;
            g.drawImage(keep, 0, 0);
        }
        if (lu.flash3 > 0) {
            g.globalCompositeOperation = 'source-atop';
            g.globalAlpha = lu.flash3 * 0.65;
            g.fillStyle = '#e0283c';
            g.fillRect(0, 0, layer.width, layer.height);
        }
        if (lu.stage === 'end') luPerish(g, layer, cf, going * 1.08);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(layer, 0, 0);
        ctx.restore();
    }

    // His perishing, over his layer, just as the last hit left him: he goes
    // the colour of ash, then burns away from the outside in -- what is left
    // of his crown and wings first, his head last -- in clumps, along a red
    // edge, and every grain that goes rises off him as ash, some still lit.
    // `k` is how far through it he is, 0 to just past 1.
    //
    // The grains are laid out once, as he begins to go, over everything round
    // him (so a wing still beating out of where it was cannot outlast him),
    // and marked as him from where his pieces are -- never read back off the
    // canvas, which a page opened from disk refuses and a big screen pays
    // for. What has gone collects on a mask of its own, so a frame only adds
    // the grains that go in it.
    const LU_ASH_CELL = 3;           // field px a grain is
    const LU_ASH_ODDS = 0.45;        // share of grains that leave a speck of ash
    const LU_ASH_EDGE = 0.05;        // how deep the burning edge is, in `k`
    const LU_ASH_ORDER = 0.75;       // how much outside-in the order is, against clumps at random
    const LU_ASH_ROOM = 24;          // field px round him that burns too
    function luPerishGrains(cf) {
        const c = LU_ASH_CELL, parts = [];
        // every piece of him as a capsule along it: [x, y, angle, half its length, half its width]
        for (const d of lu.now.wheel) if (d.kind === 'wheel') parts.push([d.x, d.y, d.a, d.len / 2, d.len / SHAPE_ASPECT / 2]);
        for (const f of lu.now.feathers) parts.push([f.x, f.y, f.a, f.len / 2, f.len / SHAPE_ASPECT / 2]);
        const hr = Math.max(cf.fw, cf.fh) / 2;
        let x0 = cf.fx - hr, x1 = cf.fx + hr, y0 = cf.fy - hr, y1 = cf.fy + hr;
        for (const [x, y, , h] of parts) { x0 = Math.min(x0, x - h); x1 = Math.max(x1, x + h); y0 = Math.min(y0, y - h); y1 = Math.max(y1, y + h); }
        x0 -= LU_ASH_ROOM; y0 -= LU_ASH_ROOM; x1 += LU_ASH_ROOM; y1 += LU_ASH_ROOM;
        const nx = Math.ceil((x1 - x0) / c), ny = Math.ceil((y1 - y0) / c), him = new Uint8Array(nx * ny);
        const mark = (cx, cy, r, inside) => {
            const i0 = Math.max(0, Math.floor((cx - r - x0) / c)), i1 = Math.min(nx - 1, Math.floor((cx + r - x0) / c));
            const j0 = Math.max(0, Math.floor((cy - r - y0) / c)), j1 = Math.min(ny - 1, Math.floor((cy + r - y0) / c));
            for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
                if (inside(x0 + (i + 0.5) * c, y0 + (j + 0.5) * c)) him[j * nx + i] = 1;
            }
        };
        for (const [x, y, a, h, w] of parts) {
            const ca = Math.cos(a), sa = Math.sin(a);
            mark(x, y, h + w, (px, py) => {
                const u = Math.max(-h, Math.min(h, (px - x) * ca + (py - y) * sa));
                return Math.hypot(px - x - u * ca, py - y - u * sa) <= w + c / 2;
            });
        }
        mark(cf.fx, cf.fy, hr, (px, py) => ((px - cf.fx) / (cf.fw / 2)) ** 2 + ((py - cf.fy) / (cf.fh / 2)) ** 2 <= 1.1);
        const R = Math.max(...[[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => Math.hypot(x - cf.fx, y - cf.fy)));
        const cells = [];
        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                const x = x0 + i * c, y = y0 + j * c;
                const d = Math.hypot(x + c / 2 - cf.fx, y + c / 2 - cf.fy) / R;
                const v = LU_ASH_ORDER * (1 - d) + (1 - LU_ASH_ORDER) * (0.6 * luHash(Math.floor(i / 5) * 31.7 + Math.floor(j / 5) * 57.3)
                                                               + 0.4 * luHash(i * 12.9898 + j * 78.233));
                cells.push({ x, y, v, him: !!him[j * nx + i] });
            }
        }
        cells.sort((a, b2) => a.v - b2.v);
        return { cells, n: 0, mask: document.createElement('canvas') };
    }
    function luPerish(g, layer, cf, k) {
        const T = ctx.getTransform(), c = LU_ASH_CELL;
        const p = lu.perish || (lu.perish = luPerishGrains(cf));
        const mask = p.mask, mg = mask.getContext('2d');
        // a new size of screen starts the mask again from every grain gone so far
        let from = p.n;
        if (mask.width !== layer.width || mask.height !== layer.height) { mask.width = layer.width; mask.height = layer.height; from = 0; }
        mg.setTransform(T);
        mg.fillStyle = '#000';
        mg.beginPath();
        let n = from;
        for (; n < p.cells.length && p.cells[n].v < k; n++) {
            const q = p.cells[n];
            mg.rect(q.x, q.y, c + 0.5, c + 0.5);
            if (n < p.n || !q.him || luHash(q.x * 0.37 + q.y * 0.71) >= LU_ASH_ODDS) continue;
            lu.ash.push({ x: q.x + c / 2, y: q.y + c / 2, vx: (Math.random() - 0.5) * 50 + 15, vy: -30 - 70 * Math.random(),
                          t: 0, life: 1 + Math.random() * 1.2, s: 1.5 + 2 * Math.random(), ember: Math.random() < 0.2 });
        }
        mg.fill();
        p.n = n;
        g.save();
        g.globalCompositeOperation = 'source-atop';
        g.globalAlpha = 0.4 * luClamp(k * 3);
        g.fillStyle = '#6b6661';
        g.fillRect(0, 0, layer.width, layer.height);
        g.setTransform(T);
        g.globalAlpha = 0.85;
        g.fillStyle = '#e0503c';
        g.beginPath();
        for (let e = n; e < p.cells.length && p.cells[e].v < k + LU_ASH_EDGE; e++) {
            const q = p.cells[e];
            if (q.him) g.rect(q.x, q.y, c, c);
        }
        g.fill();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'destination-out';
        g.globalAlpha = 1;
        g.drawImage(mask, 0, 0);
        g.restore();
    }

    // the ash off him: grey specks rising and fading, then the few still
    // burning, added on
    function luDrawAsh() {
        if (!lu.ash.length) return;
        ctx.save();
        ctx.fillStyle = '#8a8580';
        for (const a of lu.ash) {
            if (a.ember) continue;
            ctx.globalAlpha = (1 - a.t / a.life) * 0.75;
            ctx.fillRect(a.x - a.s / 2, a.y - a.s / 2, a.s, a.s);
        }
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#ff6a3c';
        for (const a of lu.ash) {
            if (!a.ember) continue;
            ctx.globalAlpha = (1 - a.t / a.life) * 0.9;
            ctx.fillRect(a.x - a.s / 2, a.y - a.s / 2, a.s, a.s);
        }
        ctx.restore();
    }

    // His head on `g`, which is already at it and turned with it: in his last
    // part, white for exactly the BOSS_IF after a hit that a second one
    // cannot land in.
    function luDrawHead(g, cf, b) {
        g.drawImage(ballImg, -cf.fw / 2, -cf.fh / 2, cf.fw, cf.fh);
        g.globalAlpha = cf.redK;
        const red = luTinted('head55', ballImg, LU_RED_BODY, 0.55);
        if (red) g.drawImage(red, -cf.fw / 2, -cf.fh / 2, cf.fw, cf.fh);
        const white = lu.stage === 3 ? bossIF / BOSS_IF : b.flash;
        if (white > 0 && lu.flash3 <= 0) {
            g.globalAlpha = Math.min(1, white) * 0.7;
            g.drawImage(headSprite2('flat', '#f2efe9'), -cf.fw / 2, -cf.fh / 2, cf.fw, cf.fh);
        }
        g.globalAlpha = 1;
        const all = LU_EYES.concat(LU_MORE_EYES);
        all.forEach(([u, v], i) => luDrawEye(g, (u - 0.5) * cf.fw, (v - 0.5) * cf.fh, cf.fw * 0.2,
                                             luClamp(cf.headOpen * all.length - i), i));
    }

    // How far his head has glitched out of the world: none until LU_GLITCH_AT
    // of his last part's health is left, then more with every hit, LU_GLITCH
    // with none left and through his last words. Picked in the character lab
    // (GLITCHING OUT).
    function luGlitch(b) {
        if (lu.stage === 'dying' || lu.stage === 'end') return LU_GLITCH;
        if (lu.stage !== 3) return 0;
        return LU_GLITCH * luClamp((LU_GLITCH_AT - b.hp / b.maxHp) / Math.max(0.01, LU_GLITCH_AT));
    }
    const LU_GLITCH_PAD = 1.5;       // his head's own canvas, this many times his head, so the effects have room
    const LU_GLITCH_RES = 3;         // ...at this many px to a field px
    const LU_GLITCH_CELL = 3;        // field px a grain of him is
    // His head on a canvas of its own, then onto g through the three looks
    // Paul picked: DISSOLVE, grains going out of him ten times a second, most
    // at his edge; ECHO, three copies swelling off him and fading one after
    // another; WARP, his rows rippling sideways. Nothing here flashes.
    let luGlitchCanvas = null;
    function luDrawGlitchHead(g, cf, b, amt) {
        const PW = cf.fw * LU_GLITCH_PAD, PH = cf.fh * LU_GLITCH_PAD, R = LU_GLITCH_RES;
        const cw = Math.ceil(PW * R), ch = Math.ceil(PH * R);
        if (!luGlitchCanvas) luGlitchCanvas = document.createElement('canvas');
        const head = luGlitchCanvas;
        if (head.width !== cw || head.height !== ch) { head.width = cw; head.height = ch; }
        const hg = head.getContext('2d');
        hg.setTransform(1, 0, 0, 1, 0, 0);
        hg.globalCompositeOperation = 'source-over';
        hg.globalAlpha = 1;
        hg.clearRect(0, 0, cw, ch);
        hg.setTransform(R, 0, 0, R, cw / 2, ch / 2);
        luDrawHead(hg, cf, b);
        // DISSOLVE
        const bw = cf.fw, bh = cf.fh, cell = LU_GLITCH_CELL, tick = Math.floor(clock * 10);
        hg.globalCompositeOperation = 'destination-out';
        for (let y = -bh / 2, j = 0; y < bh / 2; y += cell, j++) {
            for (let x = -bw / 2, i = 0; x < bw / 2; x += cell, i++) {
                const r = Math.hypot(x / (bw / 2), y / (bh / 2)), edge = luClamp((r - 0.5) / 0.5);
                if (luHash(i * 13.1 + j * 7.7 + tick * 3.3) < amt * (0.12 + 0.88 * edge) * 0.9) hg.fillRect(x, y, cell, cell);
            }
        }
        hg.globalCompositeOperation = 'source-over';
        // ECHO
        const whole = s => g.drawImage(head, -PW * s / 2, -PH * s / 2, PW * s, PH * s);
        for (let n = 0; n < 3; n++) {
            const ph = (clock * 0.7 + n / 3) % 1;
            g.globalAlpha = (1 - ph) * 0.35 * amt;
            whole(1 + ph * 0.3 * amt);
        }
        // WARP: in strips two px deep, each pushed sideways on a wave
        g.globalAlpha = 1;
        const rows = Math.ceil(PH / 2), sh = PH / rows;
        for (let r = 0; r < rows; r++) {
            const y = -PH / 2 + r * sh, dx = Math.sin(y * 0.09 + clock * 3) * bw * 0.035 * amt;
            g.drawImage(head, 0, r * sh * R, cw, Math.max(1, sh * R), -PW / 2 + dx, y, PW, sh + 0.3);
        }
    }

    // a bone on its way up into a wheel: clay (dark near his body) or one of
    // the little ones' colours, going red as it arrives
    function luDrawFlyer(g, d, fly) {
        g.save();
        g.translate(d.x, d.y);
        g.rotate(d.a);
        g.scale(d.flip ? -1 : 1, 1);
        if (fly < 1) {
            g.drawImage(d.from ? luBrick(d.from) : luBone(LU_CLAY), -d.w / 2, -d.h / 2, d.w, d.h);
            // an arm bone starts as dark as it was on his arm, and loses it as it goes red
            if (d.dark > 0.01) {
                g.globalAlpha = d.dark * (1 - fly);
                g.drawImage(luBone(LU_SHIRT), -d.w / 2, -d.h / 2, d.w, d.h);
            }
        }
        if (fly > 0) {
            g.globalAlpha = fly * (0.55 + 0.45 * luClamp((d.z + 1) / 2));
            g.drawImage(luBrick(d.tint), -d.w / 2, -d.h / 2, d.w, d.h);
        }
        g.restore();
    }

    // HIS light, as HE wears it now, gathering in you as you take it off his
    // enemy: a glow that breathes, two fans of rays turning against each
    // other, a wheel of his Brandons pointing out round you -- one more for
    // every share of it you take -- and motes rising. Laid under you, so
    // every paddle keeps its own colour. `up` is how far you are stood up:
    // lying, it is flattened under you; standing, round you.
    function luDrawOdin(k, up) {
        if (k <= 0.002) return;
        const y = padY(), breathe = 0.5 + 0.5 * Math.sin(clock * 2 * Math.PI / 3.2);
        const flat = luLerp(0.5, 1, up), ring = luLerp(0.45, 1, up);
        for (const sg of segs()) {
            const w = sg.w * 0.75 + 30;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = LU_ODIN_GLOW * k * (0.75 + 0.25 * breathe);
            ctx.drawImage(luBlob('rgba(255,217,138,0.9)'), sg.cx - w * 1.2, y - w * 1.2 * flat, w * 2.4, w * 2.4 * flat);
            for (const [dir, al, sz] of [[1, 0.55, 1], [-1, 0.35, 0.8]]) {
                ctx.save();
                ctx.translate(sg.cx, y);
                ctx.scale(1, flat);
                ctx.rotate(dir * clock * 2 * Math.PI / 70);
                ctx.globalAlpha = al * k * (0.8 + 0.2 * breathe);
                const rs = w * 3 * sz;
                ctx.drawImage(luRays(), -rs / 2, -rs / 2, rs, rs);
                ctx.restore();
            }
            ctx.restore();
            // the wheel: each Brandon comes in as its share is taken, spread round
            ctx.save();
            const shown = k * LU_SUN_N;
            for (let i = 0; i < LU_SUN_N; i++) {
                const vis = luClamp(shown - i);
                if (vis <= 0) break;
                const slot = (i * 7) % LU_SUN_N;
                const th = slot / LU_SUN_N * 2 * Math.PI + clock * 2 * Math.PI / 80;
                const len = w * 0.3 * (slot % 2 ? 0.7 : 1) * (1 + 0.04 * breathe);
                const r = w * 0.62 + len / 2;
                const px = sg.cx + Math.cos(th) * r, py = y + Math.sin(th) * r * ring;
                const a = Math.atan2(Math.sin(th) * ring, Math.cos(th));
                const lit = 0.5 + 0.5 * Math.sin(th * 2 - clock * 1.4);
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = vis * 0.55 * (0.6 + 0.4 * lit);
                luPut(ctx, luBrick(LU_SUN_GOLDS[slot % 2]), px, py, len, a, slot % 2);
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = vis * 0.25 * lit;
                luPut(ctx, luBone('#ffd98a'), px, py, len, a, slot % 2);
            }
            // motes rising off you
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 10; i++) {
                const life = (clock / (2.5 + 1.5 * luHash(i)) + luHash(i + 9)) % 1;
                const mx = sg.cx + (luHash(i + 30) - 0.5) * sg.w + Math.sin(clock + i) * 6;
                const ms = 2 + 3 * luHash(i + 40);
                ctx.globalAlpha = k * Math.sin(life * Math.PI) * 0.8;
                ctx.drawImage(luBlob('rgba(255,235,180,1)'), mx - ms * 2, y - life * 90 - ms * 2, ms * 4, ms * 4);
            }
            ctx.restore();
        }
    }
    function luRays() {
        const key = 'lu-rays';
        if (spriteCache.has(key)) return spriteCache.get(key);
        const c = document.createElement('canvas');
        c.width = c.height = 512;
        const g = c.getContext('2d');
        g.translate(256, 256);
        for (let i = 0; i < 28; i++) {
            const a = i / 28 * 2 * Math.PI, len = (i % 2 ? 165 : 250) * (0.8 + 0.4 * luHash(i + 50));
            const gr = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
            gr.addColorStop(0, 'rgba(255,230,160,0.55)');
            gr.addColorStop(1, 'rgba(255,200,110,0)');
            g.fillStyle = gr;
            const wd = 0.045 + 0.03 * luHash(i + 70);
            g.beginPath();
            g.moveTo(0, 0);
            g.lineTo(Math.cos(a - wd) * len, Math.sin(a - wd) * len);
            g.lineTo(Math.cos(a + wd) * len, Math.sin(a + wd) * len);
            g.closePath();
            g.fill();
        }
        spriteCache.set(key, c);
        return c;
    }

    // the stream: your light up his hand into him, or HIS down out of him into you
    function luDrawStream() {
        if (!lu.motes.length) return;
        const you = [paddle.x, padY() - padH() / 2];
        const reach = lu.hands.find(h => h.form === 'reach');
        const him = [lu.bd.hx, lu.bd.hy];
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const m of lu.motes) {
            if (m.t < 0) continue;
            const p = m.t / m.life, e = p * p * (3 - 2 * p);
            const [a, c] = m.from ? [m.from, you] : [you, him];
            const mid = m.from ? [(a[0] + c[0]) / 2, Math.min(a[1], c[1]) + 40]
                      : reach ? [reach.x, reach.y + 30] : [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
            const x = (1 - e) * (1 - e) * a[0] + 2 * (1 - e) * e * mid[0] + e * e * c[0] + Math.sin(p * Math.PI) * m.sway;
            const y = (1 - e) * (1 - e) * a[1] + 2 * (1 - e) * e * mid[1] + e * e * c[1];
            const al = Math.sin(p * Math.PI);
            ctx.globalAlpha = 0.9 * al;
            ctx.fillStyle = m.from ? LU_GOLD : '#f2efe9';
            ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
            ctx.globalAlpha = 0.3 * al;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // where a fist or a bird is going to land, on the floor under it
    function luDrawShadows() {
        const floor = padY() + padH() / 2 + 2;
        const mark = (x, ink, warm, near, r) => {
            ctx.fillStyle = 'rgba(' + ink + ',' + (0.22 * warm).toFixed(3) + ')';
            ctx.beginPath();
            ctx.ellipse(x, floor, r + near * 20, 8 + near * 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(' + ink + ',' + (0.5 * warm).toFixed(3) + ')';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        };
        for (const h of lu.hands) {
            if (h.form !== 'fist' || (h.st !== 'aim' && h.st !== 'drop') || luCorrupted()) continue;
            const near = luClamp((h.y - LU_FIST_Y) / Math.max(1, floor - LU_FIST_Y));
            mark(h.x, '196,138,108', h.st === 'aim' ? Math.min(1, h.stT / 0.4) * 0.5 : 0.5 + near * 0.5, near, LU_FIST_R + 20);
        }
        for (const bd of lu.birds) {
            if (bd.st !== 'dive') continue;
            const near = luClamp(1 - (floor - bd.y) / Math.max(1, floor - LU_BIRD_Y));
            mark(bd.tx, '192,31,50', 0.4 + near * 0.6, near, LU_BIRD_S * 0.7);
        }
        for (const s of lu.slams) {
            const k = s.t / 0.6;
            ctx.strokeStyle = 'rgba(196,138,108,' + (0.6 * (1 - k)).toFixed(3) + ')';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(s.x, s.y, 40 + k * 90, 8 + k * 14, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    const LU_BEAM_LEFT = 0.35;       // how bright a fired beam still is as it goes out
    // A beam gathering is a thin line where it will land, brighter and
    // wider as it comes, and light gathering where it starts; fired, it is a
    // column of red with a hot core, edged in black.
    function luDrawBeams() {
        for (const bm of lu.beams) {
            const [sx, sy] = bm.src(), ey = padY() + padH();
            // a hand's beam is dimmer and thinner (look < 1); still as wide as
            // what it hits, glow and all, so it never catches you off its edge
            const lk = bm.look, wk = 0.75 + 0.25 * lk;
            ctx.save();
            ctx.lineCap = 'round';
            if (bm.st === 'charge') {
                const k = luClamp(bm.t / (LU_BEAM_CHARGE / bm.pace));
                // locked on: a solid line where it will land, and a mark on the floor
                if (bm.t >= LU_BEAM_CHARGE / bm.pace) {
                    ctx.strokeStyle = 'rgba(255,90,90,' + (0.75 * (0.5 + 0.5 * lk)).toFixed(3) + ')';
                    ctx.lineWidth = 3 * wk;
                    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(bm.x, ey); ctx.stroke();
                    ctx.fillStyle = 'rgba(255,60,60,0.35)';
                    ctx.fillRect(bm.x - LU_BEAM_W * wk, ey - 8, LU_BEAM_W * 2 * wk, 8);
                }
                ctx.setLineDash([6, 8]);
                ctx.lineDashOffset = -clock * 60;
                ctx.strokeStyle = 'rgba(224,40,60,' + ((0.15 + 0.45 * k) * (0.5 + 0.5 * lk)).toFixed(3) + ')';
                ctx.lineWidth = 1 + 2 * k * wk;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(bm.x, ey);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.globalCompositeOperation = 'lighter';
                const r = (8 + 26 * k) * wk;
                ctx.globalAlpha = (0.5 + 0.4 * k) * lk;
                ctx.drawImage(luBlob('rgba(255,40,30,1)'), sx - r, sy - r, r * 2, r * 2);
            } else {
                // brightest the moment it fires, the one moment it hurts
                const fade = bm.st === 'fade' ? LU_BEAM_LEFT * (1 - bm.t / 0.3) : 1 - (1 - LU_BEAM_LEFT) * luClamp(bm.t / bm.secs);
                const flick = 0.9 + 0.1 * Math.sin(clock * 60);
                ctx.globalAlpha = 0.6 * fade * lk;
                ctx.strokeStyle = 'rgba(20,0,4,1)';
                ctx.lineWidth = LU_BEAM_W * 1.6 * wk;
                ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(bm.x, ey); ctx.stroke();
                ctx.globalCompositeOperation = 'lighter';
                for (const [wd, col, al] of [[LU_BEAM_W * 1.3, '224,40,60', 0.45], [LU_BEAM_W, '224,40,60', 0.75],
                                             [LU_BEAM_W * 0.35, '255,210,190', 0.95]]) {
                    ctx.globalAlpha = al * fade * flick * lk;
                    ctx.strokeStyle = 'rgb(' + col + ')';
                    ctx.lineWidth = wd * wk;
                    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(bm.x, ey); ctx.stroke();
                }
                const r = LU_BEAM_W * 2 * wk;
                ctx.globalAlpha = 0.8 * fade * lk;
                ctx.drawImage(luBlob('rgba(255,40,30,1)'), bm.x - r, ey - r * 0.6, r * 2, r * 1.2);
            }
            ctx.restore();
        }
    }

    // the tree: its branches, an eye at every tip, and what is falling off it
    function luDrawTrees() {
        const branch = (s, alpha) => {
            ctx.globalAlpha = alpha;
            const len = s.len * 1.1;
            ctx.globalAlpha = alpha * 0.7;
            luPut(ctx, luBrick(LU_REDS[1]), (s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, len * 1.06, s.a, s.n.seed > 0.5);
            ctx.globalAlpha = alpha;
            luPut(ctx, luBone(LU_TREE_INKS[Math.min(s.n.depth, LU_TREE_INKS.length - 1)]),
                  (s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, len, s.a, s.n.seed > 0.5);
        };
        for (const tr of lu.trees) {
            ctx.save();
            for (const s of tr.segs) branch(s, 1);
            tr.tips.forEach((t, i) => {
                ctx.globalAlpha = 1;
                for (let j = 0; j < 2; j++) {
                    const la = t.a + (j ? 0.8 : -0.8) + Math.sin(clock * 2.2 + t.seed * 9 + j) * 0.25;
                    luPut(ctx, luBrick(LU_REDS[(i + j) % 3]), t.x + Math.cos(la) * 6, t.y + Math.sin(la) * 6, 13, la, j);
                }
                luDrawEye(ctx, t.x, t.y, 7, 1, i + 200);
            });
            for (const c of tr.chunks) {
                const r = c.spin * c.age, cr = Math.cos(r), sr = Math.sin(r);
                const al = luClamp(1 - c.age / 1.6);
                for (const s of c.out) {
                    const ox = s.x0 - c.x0, oy = s.y0 - c.y0, qx = s.x1 - c.x0, qy = s.y1 - c.y0;
                    branch({ x0: c.px + ox * cr - oy * sr, y0: c.py + ox * sr + oy * cr,
                             x1: c.px + qx * cr - qy * sr, y1: c.py + qx * sr + qy * cr,
                             len: s.len, a: s.a + r, n: s.n }, al);
                }
            }
            ctx.restore();
        }
    }

    // HIS birds, blacked and edged red, with a red eye: a body and a wing
    // each side of two joints
    function luDrawBirds() {
        const img = luBone(LU_BIRD_INK), edge = luBrick(LU_REDS[0]);
        for (const bd of lu.birds) {
            const s = LU_BIRD_S, x = bd.x, y = bd.y, a = bd.a, fade = luClamp(bd.fade);
            const flap = Math.sin(clock * 2 * Math.PI * (bd.st === 'dive' ? 0.4 : 1.6) + bd.k * 2);
            const bone = (bx, by, len, ba, flip) => {
                ctx.globalAlpha = fade * 0.8;
                luPut(ctx, edge, bx, by, len * 1.08, ba, flip);
                ctx.globalAlpha = fade;
                luPut(ctx, img, bx, by, len, ba, flip);
            };
            ctx.save();
            for (const side of [-1, 1]) {
                const w1 = a + side * (Math.PI / 2 + 0.3 - 0.45 * flap);
                const ex = x + Math.cos(w1) * s * 0.7, ey = y + Math.sin(w1) * s * 0.7;
                bone((x + ex) / 2, (y + ey) / 2, s * 0.75, w1, side > 0);
                const w2 = w1 + side * (0.4 + 0.35 * flap);
                bone(ex + Math.cos(w2) * s * 0.4, ey + Math.sin(w2) * s * 0.4, s * 0.85, w2, side < 0);
            }
            bone(x, y, s, a, bd.k);
            ctx.restore();
            if (bd.st !== 'hit') luDrawEye(ctx, x + Math.cos(a) * s * 0.36, y + Math.sin(a) * s * 0.36, s * 0.2, fade, bd.k + 300);
        }
    }

    // the crown's broken pieces, falling away and fading, white a moment first
    function luDrawDebris() {
        for (const d of lu.debris) {
            const al = luClamp(1 - d.age / 1.4);
            if (d.kind === 'feather') luDrawFeather(ctx, d, al);
            else luDrawWheelPiece(ctx, d, al);
            if (d.age < 0.15) {
                ctx.save();
                ctx.globalAlpha = (1 - d.age / 0.15) * 0.8;
                luPut(ctx, luBone('#f2efe9'), d.x, d.y, d.len, d.a, d.flip);
                ctx.restore();
            }
        }
    }

    // his voice: the Corrupted's, from the memories when they are loaded
    function luVoice(px) {
        const v = typeof MEM_VOICE !== 'undefined' && MEM_VOICE.corrupted;
        return { font: (v ? v.font : '700 {px}px "Cinzel Decorative", serif').replace('{px}', px),
                 ink: v ? v.ink : '#e0283c' };
    }

    function luDraw(b) {
        if (!lu.bd) return;
        if (lu.stage === 'end') { luDrawEnd(b); return; }
        luDrawOdin(lu.odinShow, 0);
        luDrawShadows();
        if (luCorrupted()) luDrawCorrupt(b);
        else luDrawFallen(b);
        luDrawTrees();
        luDrawBirds();
        luDrawBeams();
        luDrawDebris();
        luDrawStream();
        luDrawBars(b);
        if (lu.stage === 'dying') luDrawLast();
    }

    // His health, one bar and nothing to say how many parts are left: a
    // sliver through the drain, filling as he changes.
    function luDrawBars(b) {
        const grow = phase === 'entrance' ? enterK() : 1;
        if (grow <= 0.001 || lu.stage === 'dying' || lu.stage === 'end') return;
        const w = 300 * grow, x = LW / 2 - w / 2, y = 12;
        labBar(x, y, w, lu.stage === 'turn' ? luLerp(lu.refill, 1, luEase(lu.sec / luCorruptTimes().end)) : b.hp / b.maxHp);
    }

    // his last words (LU_LAST) -- a letter at a time, under him
    function luDrawLast() {
        const n = Math.min(LU_LAST.length, Math.floor(lu.stT * LU_DIE_TYPE));
        if (n <= 0) return;
        const v = luVoice(30);
        ctx.save();
        ctx.font = v.font;
        ctx.fillStyle = v.ink;
        // laid out where the whole line will sit, so it grows rightward
        // rather than every letter nudging the rest along
        ctx.textAlign = 'left';
        ctx.fillText(LU_LAST.slice(0, n), LW / 2 - ctx.measureText(LU_LAST).width / 2,
                     Math.min(LH - 160, lu.cf.fy + lu.cf.fh / 2 + 110));
        ctx.restore();
    }

    // The end, under you: HIS light standing up with you and growing with
    // you, swelling as you change, until his own takes over; him perishing as
    // the last hit left him (luPerish), and his ash; and Odin where you
    // stand, coming in as you go, his light swollen past his own and settling.
    const LU_ODIN_MIRROR = false;    // Odin's head on the side yours is, stood up
    function luDrawEnd(b) {
        const e = luEndPose(), swell = 1 + LU_END_SURGE * e.surge;
        luDrawOdin((1 - e.morph) * swell, e.stand);
        if (e.crumble < 1) luDrawCorrupt(b);
        luDrawAsh();
        if (e.morph > 0.001) {
            const L = padW();
            ctx.save();
            ctx.globalAlpha = e.morph;
            // memOdin stands him with his middle L/2 + 6 over `ground`; his
            // `aura` past 1 is a swell of his light
            memOdin(paddle.x, padY() + L / 2 + 6, L, LU_ODIN_MIRROR, clock, e.morph * swell, 0, true);
            ctx.restore();
        }
    }

    // ...and over everything: BRANDON!, said as Odin over your head; then
    // BRANDON WINS over the top of the field, with you as him in full view
    // under it; and only at the last, the black
    function luDrawEndTop() {
        const e = luEndPose(), T = e.T;
        if (typeof memLine === 'function' && e.t > T.yell && e.t < T.wins + 0.4) {
            memLine([['BRANDON!', 'odin']], 'odin', paddle.x, Math.max(60, padY() - padW() / 2 - 30), 44,
                    (e.t - T.yell) / (T.wins + 0.4 - T.yell), [T.yell, T.wins + 0.4], 2);
        }
        ctx.save();
        if (e.wins > 0) {
            ctx.globalAlpha = e.wins;
            ctx.font = '700 46px "Fira Sans", "Trebuchet MS", sans-serif';
            ctx.textAlign = 'center';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 6;
            ctx.strokeStyle = 'rgba(0,0,0,0.7)';
            ctx.strokeText('BRANDON WINS', LW / 2, 74);
            ctx.fillStyle = '#f2efe9';
            ctx.fillText('BRANDON WINS', LW / 2, 74);
        }
        if (e.black > 0) {
            ctx.globalAlpha = e.black;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, LW, LH);
        }
        ctx.restore();
    }
