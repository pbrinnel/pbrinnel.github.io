'use strict';

    // ---- NUZLOCKE ------------------------------------------------------------------
    // The extra mode behind the BOSS RUSH of paddles: one life for every
    // BRANDON, and a town of its own. It stands once every paddle is owned.
    //
    //   a run starts with one random BRANDON, no keys and no other paddle
    //   a lost ball is a lost BRANDON: he explodes and the next in the queue
    //     takes over. No CONTINUE. The last one lost ends the run
    //   every stage won finds one more BRANDON, at random, never one already
    //     held this run, and he joins the back of the queue
    //   the BRANDONS rack puts whoever you pick at the front of the queue
    //   a stage scores as it does anywhere: its best, its board row and TOTAL
    //     all count, and the engine pays no more than a normal run's spares
    //     (SPARE_PAY_MAX) however many BRANDONS are in the queue
    //   the run's own score is its stages' added up. It has a board of its own,
    //     outside TOTAL, whose rows show every BRANDON the run played as. Only
    //     there does the VOID won add NUZ_SPARE_PTS for each spare BRANDON and
    //     NUZ_CLEAR_PTS for the clear; the stage scores never see them
    //   no memories, no paddles handed over, and nothing the run does touches
    //     the town's own progress: `menu` is given the run's tables (nuzBegin)
    //     and the real ones are kept in menu.main until it ends (nuzLeave)
    //
    // Saving is meant to be fair but not a way to undo a mistake. The only
    // save is the one SAVE AND QUIT makes after a stage won, kept in this
    // browser and never in a .brandon file, and resuming it deletes it. So a
    // run that is closed mid-stage is gone, and one that is loaded cannot be
    // loaded again.
    //
    // The state is menu.nuz: { queue, got, used, score, ask, finish }.
    //   queue  the BRANDONS left, the one in hand first
    //   got    every one the run has ever held, so none comes round twice
    //   used   every one that actually played, in order, for the board
    //   score  the stages finished, added up (nuzBeat); the stage in play
    //          starts from 0 (nuzCarry) and is the engine's own `score`
    // The boss lab builds menu.js without this file, so menu.js asks for
    // everything here with typeof, or only once menu.nuz exists.
    const NUZ_KEY = 'brandon2.nuzlocke';
    const NUZ_SPARE_PTS = 15000;     // each BRANDON still in the queue when the VOID falls (the run's board only)
    const NUZ_CLEAR_PTS = 100000;    // and for finishing at all
    // the sign (nuzDrawSign). Nothing in it pulses faster than the bob.
    const NUZ_HEAD_W = 40;           // the outermost head, as wide as he is when he is upright
    const NUZ_HOVER = 32;            // how high over the foundation's middle his middle floats
    const NUZ_BOB_PX = 2.5;          // how far he rises and sinks
    const NUZ_BOB_SECS = 5;          // a slow breath of it
    const NUZ_TURN_SECS = 24;        // one slow turn of the outermost head
    const NUZ_LAYERS = 12;           // heads inside the head, each cropped to the one outside it
    const NUZ_LAYER_SHRINK = 0.88;   // each head's own size, as a share of the one outside it: its shape, before it is cropped to that one
    const NUZ_LAYER_ZOOM = 1.5;      // how much bigger than its own shape the photo in it is drawn (1 = the whole head just fits)
    const NUZ_ZOOM_COMPOUND = 0;     // 1: each zooms again on the one outside it, so the photo in it gets ever closer; 0: all at NUZ_LAYER_ZOOM
    const NUZ_PAN = 0.12;            // how far off its middle each is drawn, as a share of the head's width, so a
                                     // different part of the face shows in each; it alternates up and down
    const NUZ_LAYER_SPEED = 1.12;    // each turns this many times faster than the one outside, the other way round
    const NUZ_LAYER_ALPHA = 0.9;     // a layer's cover, so the one under shows through a little
    const NUZ_BUF_PX = 3;            // pixels of the tunnel's own canvas to every pixel of the sign
    const NUZ_TINT_DARK = 0.6;       // how far toward black the dark layers go...
    const NUZ_TINT_LIGHT = 0.5;      // ...and toward white the light ones; layers go ink, dark, light, round
    const NUZ_ALPHA_BOLD = 0.95;     // the outermost head's rim
    const NUZ_RING_N = 9;            // little heads orbiting him
    const NUZ_RING_W = 5;            // one's width at the middle of its orbit
    const NUZ_RING_RX = 26;          // the orbit's half width
    const NUZ_RING_RY = 6;           // and half height: a ring seen from just above
    const NUZ_RING_DY = 12;          // how far below his middle it sits
    const NUZ_RING_SECS = 40;        // one lap of it
    const NUZ_RING_ALPHA = 0.7;
    const NUZ_BASE_ARMS = 2;         // the foundation: the VOID's hole, small, its arms of little heads winding in
    const NUZ_BASE_SPIN = 0.5;       // radians a second they turn
    const NUZ_BASE_TWIST = 5;        // radians an arm winds through, rim to middle
    const NUZ_BASE_LINK = 6;         // px, a head at the rim of an arm
    const NUZ_BASE_STEP = 0.11;      // an arm's links, as shares of its length
    const NUZ_TEXT_PX = 7;           // the name across him
    const NUZ_BOOM_SECS = 0.9;       // a lost paddle coming apart
    const NUZ_SHARDS = 22;

    const nuzInk = () => M_SIDES.find(s => s.key === 'nuzlocke').ink;
    const nuzOn = () => !!(menu && menu.nuz);

    // ---- the saved run -----------------------------------------------------------------
    // read back defensively: it is a plain object in localStorage, and anything
    // that does not look right is no save at all
    function nuzSaved() {
        let o = null;
        try { o = JSON.parse(localStorage.getItem(NUZ_KEY) || 'null'); } catch (e) { return null; }
        const ids = a => Array.isArray(a) ? a.filter((k, i) => MENU_PADS.includes(k) && a.indexOf(k) === i) : [];
        if (!o) return null;
        const queue = ids(o.queue);
        if (!queue.length) return null;
        const got = ids(o.got);
        for (const k of queue) if (!got.includes(k)) got.push(k);
        const used = ids(o.used);
        const keys = Array.isArray(o.keys) ? o.keys.filter(n => MENU_ALL.some(l => l.n === n)) : [];
        const seen = Array.isArray(o.seen) ? o.seen.filter(n => MENU_ALL.some(l => l.n === n)) : [];
        return { queue, got, used, keys, seen, score: Math.max(0, Math.min(SCORE_CAP, Math.floor(Number(o.score)) || 0)) };
    }

    // ---- a run's town, and back --------------------------------------------------------
    // The town's own tables are set aside and the run's put in their place, so
    // every building, the gates and the rack work on them unchanged. menuSave
    // writes the set-aside ones, so nothing in here can reach the real save.
    function nuzBegin(saved) {
        menuLoad();
        if (menu.nuz) return;       // already in one: its tables are not the town's, so none may be set aside twice
        menu.main = { keys: menu.keys, pads: menu.pads, seen: menu.seen, mems: menu.mems,
                      memFrom: menu.memFrom, slain: menu.slain, hand: LAB.pad };
        menu.keys = {}; menu.pads = {}; menu.mems = {}; menu.memFrom = {}; menu.slain = 0;
        // a fresh town: every building under its cover, as on the first
        // visit ever, and uncovered by the run's own visits (a saved run
        // keeps which). The real town's covers are the real `seen`, set aside.
        menu.seen = {};
        menu.shows = []; menu.padNext = null;
        if (saved) {
            menu.nuz = { queue: saved.queue, got: saved.got, used: saved.used, score: saved.score, ask: false, finish: null };
            for (const n of saved.keys) menu.keys[n] = true;
            for (const n of saved.seen) menu.seen[n] = true;
        } else {
            try { localStorage.removeItem(NUZ_KEY); } catch (e) { /* private window */ }
            const first = MENU_PADS[Math.floor(Math.random() * MENU_PADS.length)];
            menu.nuz = { queue: [first], got: [first], used: [], score: 0, ask: false, finish: null };
        }
        for (const k of menu.nuz.queue) menu.pads[k] = true;
        LAB.usePad(menu.nuz.queue[0]);
        nuzTown();
    }

    // the town the run is played in, arriving the way the first one does
    function nuzTown() {
        menu.screen = null;
        menu.cameFrom = null;
        menu.leaving = null;
        menu.stood = null;      // what the other town had standing is no measure of this one: no "went up" cards
        menuOpen();
        paddle.x = paddle.tx = LW / 2;
        menu.lift = 0; menu.march = false; menu.into = null;
        menu.arriveT = 0;
    }

    // out of the run, to the town as it was. Anything the run owes the board
    // is already in menu.post / menu.postQ, which outlive it: the town asks.
    function nuzLeave(say) {
        const m = menu.main;
        menu.keys = m.keys; menu.pads = m.pads; menu.seen = m.seen; menu.mems = m.mems;
        menu.memFrom = m.memFrom; menu.slain = m.slain;
        menu.nuz = null; menu.main = null;
        menu.shows = []; menu.padNext = null;
        LAB.usePad(m.hand && menu.pads[m.hand] ? m.hand : 'standard');
        nuzTown();
        menuSave();
        if (say) menuSay(say);
    }

    function nuzSaveQuit() {
        const n = menu.nuz;
        try {
            localStorage.setItem(NUZ_KEY, JSON.stringify({ queue: n.queue, got: n.got, used: n.used, score: n.score,
                                                           keys: Object.keys(menu.keys).filter(k => menu.keys[k]).map(Number),
                                                           seen: Object.keys(menu.seen).filter(k => menu.seen[k]).map(Number) }));
        } catch (e) { menuSay('NUZLOCKE · COULD NOT SAVE'); menu.screen = null; return; }
        nuzLeave('RUN SAVED');
    }
    // loading it is deleting it: there is no going back to a save, only on
    function nuzResume() {
        const s = nuzSaved();
        try { localStorage.removeItem(NUZ_KEY); } catch (e) { /* private window */ }
        if (!s) { menuShow('nuzlocke'); return; }
        nuzBegin(s);
    }
    function nuzAbandon() { nuzLeave('RUN ABANDONED'); }

    // ---- the queue ---------------------------------------------------------------------
    // who is in hand is who is at the front: picking one anywhere, on the rack
    // or against a gate, puts him there (menuPadKept)
    function nuzFront(k) {
        const q = menu.nuz.queue, i = q.indexOf(k);
        if (i > 0) { q.splice(i, 1); q.unshift(k); }
    }
    // a BRANDON counts as used from the first stage he plays
    function nuzUsed(k) { if (!menu.nuz.used.includes(k)) menu.nuz.used.push(k); }

    // the BRANDON a stage won finds: random, never one the run has held, at
    // the back of the queue. Drawn here and kept in the run, so SAVE AND QUIT
    // cannot be used to draw again.
    function nuzGive() {
        const n = menu.nuz, pool = MENU_PADS.filter(k => !n.got.includes(k));
        if (!pool.length) return null;
        const k = pool[Math.floor(Math.random() * pool.length)];
        n.got.push(k); n.queue.push(k); menu.pads[k] = true;
        menu.shows.push({ pad: k });
        return k;
    }

    // ---- what the engine and the town ask -------------------------------------------------
    // a stage of a run starting: one life for every BRANDON, and a score of
    // its own like any stage (the run's is menu.nuz.score, the stages done)
    function nuzCarry() {
        if (!menu || !menu.nuz || !menu.run) return false;
        score = 0;
        lives = menu.nuz.queue.length;
        menu.run.lives0 = lives;
        nuzUsed(menu.nuz.queue[0]);
        return true;
    }
    // the lives this stage began with, for the READY screen (engine.js livesAtStart)
    function nuzLivesAtStart() { return menu && menu.nuz && menu.run ? menu.run.lives0 : 0; }
    // a ball lost in a stage: the BRANDON in hand goes, and the next takes over
    function nuzLost() {
        const n = menu.nuz;
        if (!n || !menu.run) return;
        const dead = n.queue.shift();
        delete menu.pads[dead];
        nuzBoomStart(dead);
        if (n.queue.length) { LAB.usePad(n.queue[0]); nuzUsed(n.queue[0]); }
        lives = n.queue.length;
    }
    // a stage won: its score into the run's, its key, its BRANDON, and the
    // chance to stop there. (Its own row on the stage's board is the caller's.)
    function nuzBeat(run) {
        const n = menu.nuz;
        n.score += score;
        menu.keys[run.n] = true;
        nuzGive();
        n.ask = true;
        menuOpen();
    }
    // the VOID won: its score is in the run's by now. The card, then the
    // board, wait for the stage's own initials to be done with (nuzTick).
    function nuzWon(run) {
        const n = menu.nuz, spares = Math.max(0, n.queue.length - 1);
        n.score += score;
        const rows = [['RUN SCORE', n.score], ['SPARE BRANDONS  ×' + spares, spares * NUZ_SPARE_PTS],
                      ['CLEAR BONUS', NUZ_CLEAR_PTS]];
        const total = n.score + spares * NUZ_SPARE_PTS + NUZ_CLEAR_PTS;
        n.finish = { run, total, card: { rows, total, pads: n.used.slice() }, carded: false };
        menu.run = null;
        menuOpen();
    }
    // the last BRANDON lost, and END RUN pressed: the stage it ended on is
    // posted as any END RUN is, then the run, all the stages done and this one
    function nuzOver() {
        const run = menu.run, n = menu.nuz;
        menuBoardPost(run);
        nuzPost(run.pads = n.used.slice(), n.score + score);
        menu.run = null;
        nuzLeave('NUZLOCKE · RUN OVER');
    }
    function nuzFinish() {
        const n = menu.nuz, f = n.finish;
        n.finish = null;
        nuzPost(n.used.slice(), f.total);
        nuzLeave('NUZLOCKE CLEARED · ' + fmtScore(f.total));
    }
    // The run's score on its own board, asked for once back in the town and
    // behind any stage score still owed. Its best is kept either way.
    function nuzPost(pads, points) {
        const was = menu.best[M_NUZ] || 0;
        if (points > was) { menu.best[M_NUZ] = points; menuSave(); }
        if (!menuBoardOn() || !(points > 0)) return;
        const p = { n: M_NUZ, score: points, was, pad: null, pads, ready: false };
        if (menu.post) menu.postQ.push(p); else menu.post = p;
        fetchBoard().then(() => { p.ready = true; });
    }

    // what the town does between the cards: the run's end, and the question
    // after a stage. True when it took the frame.
    function nuzTick() {
        const n = menu.nuz;
        if (menu.shows.length || menu.screen || menu.post || menu.postQ.length) return false;
        if (n.finish && !n.finish.carded) {
            n.finish.carded = true;
            menu.shows.push({ nuzWin: n.finish.card });
            return true;
        }
        if (n.finish) { nuzFinish(); return true; }
        if (n.ask && !menu.leaving && !menu.going && !menuArriving()) {
            n.ask = false;
            menuShow('nuzsave');
            return true;
        }
        return false;
    }

    // ---- the screens -----------------------------------------------------------------
    const nuzStay = () => { menu.screen = null; setHint(M_HINT); };
    Object.assign(M_SCREENS, {
        nuzlocke: { title: 'NUZLOCKE', ink: '#d0584c', home: 'back',
                    line: () => 'one life for every BRANDON' + (menu.best[M_NUZ] > 0 ? ' · best ' + fmtScore(menu.best[M_NUZ]) : ''),
                    choices: () => [
                        { id: 'back', label: 'BACK', ink: M_SAFE, act: menuLeave },
                        { id: 'new', label: 'NEW RUN', ink: '#d0584c', act: () => nuzSaved() ? menuShow('nuznew') : nuzBegin(null) },
                        { id: 'resume', label: 'RESUME', ink: '#7fa85a', act: nuzSaved() ? () => menuShow('nuzresume') : null }] },
        nuznew: { title: 'START A NEW RUN?', line: 'your saved run is replaced', home: 'keep',
                  choices: () => [
                      { id: 'keep', label: 'KEEP SAVE', ink: M_SAFE, act: () => menuShow('nuzlocke') },
                      { id: 'go', label: 'NEW RUN', ink: M_RISK, act: () => nuzBegin(null) }] },
        nuzresume: { title: 'RESUME YOUR RUN?', home: 'back',
                     line: 'WARNING! resuming deletes the save, to stop it being reloaded',
                     choices: () => [
                         { id: 'back', label: 'BACK', ink: M_SAFE, act: () => menuShow('nuzlocke') },
                         { id: 'go', label: 'RESUME', ink: M_RISK, act: nuzResume }] },
        nuzsave: { title: 'SAVE AND QUIT?', home: 'on',
                   line: 'resuming deletes the save · a run closed mid-stage is lost',
                   choices: () => [
                       { id: 'on', label: 'PLAY ON', ink: M_SAFE, act: nuzStay },
                       { id: 'quit', label: 'SAVE AND QUIT', ink: '#d0584c', act: nuzSaveQuit }] },
        nuzleave: { title: 'LEAVE NUZLOCKE?', home: 'stay',
                    line: 'resuming deletes the save · a run closed mid-stage is lost',
                    choices: () => [
                        { id: 'stay', label: 'STAY', ink: M_SAFE, act: menuLeave },
                        { id: 'quit', label: 'SAVE AND QUIT', ink: '#d0584c', act: nuzSaveQuit },
                        { id: 'drop', label: 'ABANDON', ink: M_RISK, act: () => menuShow('nuzabandon') }] },
        nuzabandon: { title: 'ABANDON THE RUN?', line: 'it is gone for good, and posts no score', home: 'keep',
                      choices: () => [
                          { id: 'keep', label: 'KEEP PLAYING', ink: M_SAFE, act: () => menuShow('nuzleave') },
                          { id: 'go', label: 'ABANDON', ink: M_RISK, act: nuzAbandon }] }
    });

    // ---- the tunnel ---------------------------------------------------------------------
    // The heads inside the head, made on three small canvases (this one's layer, the one outside it as
    // a mask, and the sum) that are made once and reused, so no frame allocates. Each layer is the head
    // photo drawn bigger and turned, cropped to the shape of the layer outside it (destination-in on the
    // mask), laid over the sum: what shows is the face zoomed deeper and deeper, in the one shape.
    let nuzTun = null;
    const nuzCanvas = n => { const c = document.createElement('canvas'); c.width = c.height = n; return { c, g: c.getContext('2d') }; };
    function nuzTunnel(set, base, now, hw, hh, side) {
        const m = set.main.g, t = set.tmp.g, k = set.mask.g, D = NUZ_BUF_PX, mid = side / 2;
        m.clearRect(0, 0, side, side);
        for (let i = 0; i < NUZ_LAYERS; i++) {
            const tone = i % 3 === 1 ? menuMix(base, '#000000', NUZ_TINT_DARK) : i % 3 === 2 ? menuMix(base, '#ffffff', NUZ_TINT_LIGHT) : base;
            const img = menuHead(tone, i % 2 ? 'flat' : 'wash');
            const shape = menuHead(M_SLATE, 'flat');
            if (!img || !shape) continue;
            const cw = hw * Math.pow(NUZ_LAYER_SHRINK, i) * D;                          // its shape's width
            const z = i ? (NUZ_ZOOM_COMPOUND ? Math.pow(NUZ_LAYER_ZOOM, i) : NUZ_LAYER_ZOOM) : 1;
            const w = cw * z, h = w * (BALL_RY / BALL_RX);                              // the photo in it
            const turn = -Math.PI / 2 + (i % 2 ? -1 : 1) * now * Math.PI * 2 / NUZ_TURN_SECS * Math.pow(NUZ_LAYER_SPEED, i) + i * 0.9;
            t.clearRect(0, 0, side, side);
            t.save(); t.translate(mid, mid); t.rotate(turn);
            t.drawImage(shape, -cw / 2, -cw * (BALL_RY / BALL_RX) / 2, cw, cw * (BALL_RY / BALL_RX));     // its shape...
            t.restore();
            t.globalCompositeOperation = i ? 'destination-in' : 'source-over';
            if (i) t.drawImage(set.mask.c, 0, 0);                                        // ...cropped to the one outside it
            t.globalCompositeOperation = 'source-atop';                                  // and the photo, only where it is
            t.save(); t.translate(mid, mid); t.rotate(turn); t.translate(0, (i % 2 ? 1 : -1) * NUZ_PAN * hw * D * (i ? 1 : 0));
            t.drawImage(img, -w / 2, -h / 2, w, h);
            t.restore();
            t.globalCompositeOperation = 'source-over';
            m.globalAlpha = i ? NUZ_LAYER_ALPHA : 1; m.drawImage(set.tmp.c, 0, 0); m.globalAlpha = 1;
            k.clearRect(0, 0, side, side); k.drawImage(set.tmp.c, 0, 0);
        }
    }

    // ---- the sign ----------------------------------------------------------------------
    // The VOID's foundation, small: a black oval in the ground, a rim that will
    // not hold its shape and arms of little heads winding into it. Over it his
    // head hovers, rising and sinking slowly: the head with heads inside it, each the photo zoomed in and cropped to the one
    // outside it, quicker than the last and turning the other way, in ink, dark and light by turns (nuzTunnel), with a ring of little ones circling the
    // lot and the name held level across the middle. All of it is the one head
    // photo. Every sprite is cached in one color, slate or the sign's own (or a fixed
    // tint of one), and the lit one is laid over the other by the alpha, so no frame makes a color.
    function nuzDrawSign(c, st) {
        const now = menuNow(), line = menuSignLine(st), aimed = menuAimed(c);
        const rx = c.w / 2, ry = c.h / 2, hw = NUZ_HEAD_W, hh = hw * (BALL_RY / BALL_RX);
        const cx = c.x, cy = c.y - NUZ_HOVER + Math.sin(now * Math.PI * 2 / NUZ_BOB_SECS) * NUZ_BOB_PX;
        // one sprite in both its colors, the lit one over the resting one by `a`
        const both = (mode, a, put) => {
            const rest = menuHead(M_SLATE, mode), lit = menuHead(st.ink, mode);
            if (rest) { menuAlpha(a * 0.9); put(rest); }
            if (lit && st.rise > 0) { menuAlpha(a * st.rise); put(lit); }
            menuAlpha(1);
        };
        const rim = () => {
            ctx.beginPath();
            for (let i = 0; i <= 36; i++) {
                const a = i / 36 * Math.PI * 2, k = 1 + VOID_WOBBLE * Math.sin(a * 3 + now * VOID_WOBBLE_HZ * Math.PI * 2);
                if (i) ctx.lineTo(c.x + Math.cos(a) * rx * k, c.y + Math.sin(a) * ry * k); else ctx.moveTo(c.x + Math.cos(a) * rx * k, c.y + Math.sin(a) * ry * k);
            }
            ctx.closePath();
        };
        // the foundation
        ctx.save();
        rim(); ctx.fillStyle = '#000'; ctx.fill(); ctx.clip();
        for (let i = 0; i < NUZ_BASE_ARMS; i++) {
            for (let s = 0; s < 1; s += NUZ_BASE_STEP) {
                const a = -now * NUZ_BASE_SPIN + i * Math.PI * 2 / NUZ_BASE_ARMS + s * NUZ_BASE_TWIST, r = 1.1 - s * 0.65;
                both('flat', aimed ? 0.8 : 0.45, img => {
                    ctx.save(); ctx.translate(c.x + Math.cos(a) * rx * r, c.y + Math.sin(a) * ry * r);
                    ctx.rotate(a + Math.PI / 2); menuPutHead(img, 0, 0, NUZ_BASE_LINK * r); ctx.restore();
                });
            }
        }
        // stood in the doorway, it fills from the floor up
        const k = menuDoorK(c);
        if (k) { menuAlpha(0.5); ctx.fillStyle = st.ink; ctx.fillRect(c.x - rx * 1.2, c.y + ry * 1.2 - c.h * 1.2 * k, rx * 2.4, c.h * 1.2 * k); menuAlpha(1); }
        ctx.restore();
        menuAlpha(0.6 + 0.4 * st.rise); rim(); ctx.strokeStyle = line; ctx.lineWidth = 1 + 0.5 * st.rise; ctx.stroke(); menuAlpha(1);
        // the ring of little ones: the far half behind him, the near half in front
        const ring = front => {
            for (let j = 0; j < NUZ_RING_N; j++) {
                const a = now * Math.PI * 2 / NUZ_RING_SECS + j * Math.PI * 2 / NUZ_RING_N, d = Math.sin(a);
                if ((d >= 0) !== front) continue;
                const w = NUZ_RING_W * (1 + 0.3 * d);
                both('flat', NUZ_RING_ALPHA * (0.65 + 0.35 * d), img => menuPutHead(img, cx + Math.cos(a) * NUZ_RING_RX, cy + NUZ_RING_DY + d * NUZ_RING_RY, w));
            }
        };
        ring(false);
        // the heads: the tunnel, drawn once from its canvases, in slate and over it in the sign's own color
        {
            const side = Math.ceil(Math.hypot(hw, hh) * NUZ_BUF_PX) + 2;
            if (!nuzTun || nuzTun.side !== side) nuzTun = { side, rest: { main: nuzCanvas(side), tmp: nuzCanvas(side), mask: nuzCanvas(side) },
                                                           lit: { main: nuzCanvas(side), tmp: nuzCanvas(side), mask: nuzCanvas(side) } };
            const sz = side / NUZ_BUF_PX;
            if (st.rise < 0.999) { nuzTunnel(nuzTun.rest, M_SLATE, now, hw, hh, side); menuAlpha(0.9); ctx.drawImage(nuzTun.rest.main.c, cx - sz / 2, cy - sz / 2, sz, sz); }
            if (st.rise > 0) { nuzTunnel(nuzTun.lit, st.ink, now, hw, hh, side); menuAlpha(st.rise); ctx.drawImage(nuzTun.lit.main.c, cx - sz / 2, cy - sz / 2, sz, sz); }
            menuAlpha(1);
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(-Math.PI / 2 + now * Math.PI * 2 / NUZ_TURN_SECS);
            both('outline', NUZ_ALPHA_BOLD, img => menuPutHead(img, 0, 0, hw));     // the outermost one's rim, bold
            ctx.restore();
        }
        // stood in the doorway, the outermost fills from the floor up too
        {
            const f = k && menuHead(st.ink, 'flat');
            if (f) {
                ctx.save(); ctx.translate(cx, cy); ctx.beginPath(); ctx.rect(-hh, hh - 2 * hh * k, hh * 2, 2 * hh * k); ctx.clip();
                ctx.rotate(-Math.PI / 2 + now * Math.PI * 2 / NUZ_TURN_SECS); menuAlpha(0.45); menuPutHead(f, 0, 0, hw); menuAlpha(1); ctx.restore();
            }
        }
        ring(true);
        // the name, on a dark halo so the heads behind it do not cut it up
        ctx.save(); ctx.globalAlpha = 0.6;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) text('NUZLOCKE', cx + dx, cy + 2.5 + dy, NUZ_TEXT_PX, '#000', 'center');
        ctx.restore();
        text('NUZLOCKE', cx, cy + 2.5, NUZ_TEXT_PX, menuSignInk(st), 'center');
        if (menu.best[M_NUZ] > 0) text('BEST ' + fmtScore(menu.best[M_NUZ]), c.x, c.y + ry + 12, 10, menuSignInk(st), 'center');
    }

    // ---- the corner: the BRANDONS still to play ---------------------------------------
    // The HUD's spares, with paddles where the heads were: the one next in line
    // nearest the corner. The queue behind the one in hand, nothing more.
    function nuzSpares(u) {
        if (!menu || !menu.nuz || !menu.run) return false;
        const q = menu.nuz.queue;
        for (let i = 1; i < q.length; i++) labPadIcon(q[i], LW - (34 + (i - 1) * 50) * u, 25 * u, 42 * u, false, 1);
        return true;
    }
    // ...and the same on the rack, where the whole queue shows, the one in hand
    // at the corner, labeled
    function nuzDrawQueue(xr, y, a) {
        const q = menu.nuz.queue;
        q.forEach((k, i) => {
            const x = xr - 30 - i * 56;
            labPadIcon(k, x, y, 46, false, a);
            if (i === 0) text('IN HAND', x, y + 22, 9, '#9a958c', 'center');
            else if (i === 1) text('NEXT', x, y + 22, 9, '#6d685f', 'center');
        });
    }

    // ---- a paddle lost -------------------------------------------------------------------
    // He comes apart in his own colors: shards flung out and falling, and a
    // ring spreading from where he was. No flash over the field.
    let nuzBoom = null;
    function nuzBoomStart(pad) {
        const p = LAB_PAD[pad] || {}, ink = p.ink || p.rim || '#d0584c';
        const shards = [];
        for (let i = 0; i < NUZ_SHARDS; i++) {
            const a = Math.random() * Math.PI * 2, v = 90 + Math.random() * 230;
            shards.push({ dx: (Math.random() - 0.5) * padW() * 0.9, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 140,
                          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, s: 3 + Math.random() * 6 });
        }
        nuzBoom = { x: paddle.x, y: padY(), ink, shards, t0: performance.now(), w: padW() };
    }
    function nuzBoomDraw() {
        if (!nuzBoom) return;
        const t = (performance.now() - nuzBoom.t0) / 1000;
        if (t >= NUZ_BOOM_SECS) { nuzBoom = null; return; }
        const k = t / NUZ_BOOM_SECS;
        ctx.save();
        ctx.strokeStyle = nuzBoom.ink; ctx.lineWidth = 3 * (1 - k);
        ctx.globalAlpha = Math.max(0, 1 - t / 0.45);
        ctx.beginPath(); ctx.ellipse(nuzBoom.x, nuzBoom.y, nuzBoom.w * 0.4 + t * 260, 8 + t * 90, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = nuzBoom.ink;
        ctx.globalAlpha = 1 - k;
        for (const s of nuzBoom.shards) {
            ctx.save();
            ctx.translate(nuzBoom.x + s.dx + s.vx * t, nuzBoom.y + s.vy * t + 520 * t * t);
            ctx.rotate(s.rot + s.vr * t);
            ctx.fillRect(-s.s / 2, -s.s / 3, s.s, s.s * 0.66);
            ctx.restore();
        }
        ctx.restore();
    }

    // ---- NUZLOCKE CLEARED -------------------------------------------------------------------
    // the VOID's end in a run: the score, what the spares and the clear add, and
    // every BRANDON the run played as, before the board
    function nuzWinDraw(win, t) {
        const ink = nuzInk();
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, LW, LH);
        ctx.globalAlpha = UNLOCK_BACK;
        ctx.fillStyle = ink;
        ctx.fillRect(0, 0, LW, LH);
        ctx.globalAlpha = 1;
        text('NUZLOCKE CLEARED', LW / 2, 110, 38, '#f2efe9', 'center');
        const row = (label, pts, y, size, col, at) => {
            const a = Math.max(0, Math.min(1, (t - at) / 0.4));
            if (a <= 0) return;
            ctx.globalAlpha = a;
            text(label, LW / 2 - 190, y, size, col);
            text(fmtScore(pts), LW / 2 + 190, y, size, col, 'right');
            ctx.globalAlpha = 1;
        };
        win.rows.forEach((r, i) => row(r[0], r[1], 200 + i * 40, 22, i === 0 ? '#c9c4ba' : '#e8c66a', 0.4 + i * 0.5));
        const at = 0.4 + win.rows.length * 0.5;
        if (t > at) {
            ctx.globalAlpha = Math.max(0, Math.min(1, (t - at) / 0.4));
            ctx.fillStyle = 'rgba(242,239,233,0.35)';
            ctx.fillRect(LW / 2 - 190, 200 + win.rows.length * 40 - 20, 380, 1);
            ctx.globalAlpha = 1;
        }
        row('TOTAL', win.total, 200 + win.rows.length * 40 + 24, 30, '#f2efe9', at);
        // who played
        const a = Math.max(0, Math.min(1, (t - at - 0.6) / 0.6));
        if (a > 0 && win.pads.length) {
            ctx.globalAlpha = a;
            text('PLAYED AS', LW / 2, 430, 13, '#9a958c', 'center');
            const step = Math.min(70, 620 / win.pads.length);
            win.pads.forEach((k, i) => labPadIcon(k, LW / 2 + (i - (win.pads.length - 1) / 2) * step, 470, step * 0.9, false, 1));
            ctx.globalAlpha = 1;
        }
    }
