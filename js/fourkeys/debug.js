'use strict';

    // ---- FOUR KEYS: the debug menu ---------------------------------------------------
    // What the konami code opens, and fourkeys.html?debug on a phone. The town
    // is the whole of the game's progress, so this is the whole of the cheat
    // menu: hand yourself a key, a paddle or a memory, or put it all back --
    // and, inside a level, skip the screen you are on or go straight to its boss.
    //
    // It reaches the town through menuLevels/menuPads/menuMemories/menuHas/
    // menuSet/menuSkip/menuSkipName/menuSkipBoss/menuCanSkipBoss and nothing
    // else, so it never has to know
    // where any of it is kept.
    //
    // engine.js owns the panel itself -- the konami code, the escape key, the
    // ?debug in the address -- and calls debugBuild() once at setup and
    // debugSync() every time the panel opens, and debugKey() with every key
    // pressed while it is up, for the code it asks for first.

    // The code that opens it. Players find the konami code, so the menu asks
    // for this first, on a keypad drawn like the initials screen's. Once per
    // page load: a reload asks again. It is in the page's source, so it only
    // keeps the menu from being stumbled into, not from being looked up.
    const DBG_PIN = '223';

    // held down rather than clicked, since it cannot be undone. The same length
    // the game's own reset asked for.
    const DBG_WIPE_HOLD = 1.2;

    const DBG_HEADS = { keys: 'keys — four open the CASTLE, the CASTLE raises the VOID, the VOID opens BOSS RUSH',
                        pads: 'paddles',
                        mems: 'memories — year 0 is always yours' };

    let dbgSync = [];                 // one per row: bring its look up to date
    let dbgPin = '';                  // the digits typed so far
    let dbgOpen = false;              // the right code has been entered
    let dbgPinKey = null;             // a key typed on the keypad (debugPinBuild)

    function debugBuild() {
        const el = document.getElementById('debug');
        if (!el) return;
        el.querySelector('h2').textContent = 'FOUR KEYS';
        debugPinBuild(el);

        // everything past the code, hidden until it has been entered
        const body = document.createElement('div');
        body.className = 'body';
        el.appendChild(body);
        dbgSync.push(() => { body.hidden = !dbgOpen; });

        // Inside a level, a way past the screen you are on, to get at the
        // next without playing this one. It says which screen it would beat,
        // and is not there in the town.
        const win = document.createElement('button');
        win.addEventListener('click', () => {
            if (menuSkip()) debugEl.hidden = true;
        });
        body.appendChild(win);
        dbgSync.push(() => {
            const name = menuSkipName();
            win.hidden = !name;
            win.textContent = 'win ' + (name || '');
        });

        // and past both walls at once, on a level with a boss at the end
        const boss = document.createElement('button');
        boss.textContent = 'skip to boss';
        boss.addEventListener('click', () => {
            if (menuSkipBoss()) debugEl.hidden = true;
        });
        body.appendChild(boss);
        dbgSync.push(() => { boss.hidden = !menuCanSkipBoss(); });

        // a column each, side by side: stacked they stood taller than a screen
        const cols = document.createElement('div');
        cols.className = 'cols';
        body.appendChild(cols);
        debugRow(cols, 'keys', menuLevels());
        debugRow(cols, 'pads', menuPads().map(k => ({ k, name: (LAB_PAD[k] || {}).name || k.toUpperCase() })));
        debugRow(cols, 'mems', menuMemories().filter(m => !m.always)
            .map(m => ({ n: m.id, name: 'YEAR \u2212' + -m.year + ' ' + m.title.toUpperCase(), ink: m.ink })));

        // and the way back out of all of it
        const wipe = document.createElement('button');
        wipe.className = 'wipe';
        wipe.textContent = 'hold to forget everything';
        debugHold(wipe, () => {
            LAB_MINI.menu.acts.wipe();
            clearBest();                  // everything means the best as well
            debugSync();                  // ...and then say so, since the sync
            wipe.textContent = 'forgotten';   // is what puts the label back
        });
        body.appendChild(wipe);
        body.appendChild(Object.assign(document.createElement('p'),
            { textContent: 'esc to go back' }));
        dbgSync.push(() => { wipe.textContent = 'hold to forget everything'; });
    }

    // one column of buttons, each one a thing you either have or do not
    function debugRow(cols, what, items) {
        const el = document.createElement('div');
        el.className = 'col';
        cols.appendChild(el);
        const head = document.createElement('p');
        head.textContent = DBG_HEADS[what];
        el.appendChild(head);
        for (const it of items) {
            const key = what === 'pads' ? it.k : it.n;
            const btn = document.createElement('button');
            btn.addEventListener('click', () => {
                menuSet(what, key, !menuHas(what, key));
                debugSync();
            });
            el.appendChild(btn);
            dbgSync.push(() => {
                const on = menuHas(what, key);
                btn.textContent = (on ? '✓  ' : '·  ') + it.name;
                btn.style.color = on ? (it.ink || '#f2efe9') : '#6d685f';
            });
        }
    }

    // A press that has to be held. It is its own thing rather than the game's,
    // which is wired to one button and one job; the class it wears is the
    // game's, so the fill animation is the same one.
    function debugHold(btn, done) {
        let t = null;
        const stop = () => { clearTimeout(t); t = null; btn.classList.remove('holding'); };
        btn.addEventListener('pointerdown', e => {
            if (e.button !== 0) return;
            // the underline fills over exactly as long as the hold takes, which
            // is why the css leaves the duration to be set here
            btn.style.transitionDuration = DBG_WIPE_HOLD + 's';
            btn.classList.add('holding');
            t = setTimeout(() => { stop(); done(); }, DBG_WIPE_HOLD * 1000);
        });
        for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
        btn.addEventListener('contextmenu', e => e.preventDefault());
    }

    // The code's keypad: three slots and the digits under them, the initials
    // screen's layout with numbers for letters. Typeable as well, through
    // debugKey, which engine.js hands every key pressed while the panel is up.
    function debugPinBuild(el) {
        const pin = document.createElement('div');
        pin.className = 'pin';
        el.appendChild(pin);
        const slots = document.createElement('div');
        slots.className = 'slots';
        pin.appendChild(slots);
        const slot = [0, 1, 2].map(() => slots.appendChild(document.createElement('span')));
        const grid = document.createElement('div');
        grid.className = 'grid';
        pin.appendChild(grid);
        const hint = document.createElement('p');
        pin.appendChild(hint);

        const look = () => {
            pin.hidden = dbgOpen;
            const full = dbgPin.length === DBG_PIN.length;
            slot.forEach((s, i) => {
                s.textContent = dbgPin[i] || (i === dbgPin.length ? '_' : '-');
                s.className = i === dbgPin.length ? 'on' : '';
            });
            ok.className = full ? 'ok live' : 'ok';
            hint.textContent = 'type the code, then press RETURN';
            hint.className = full ? 'live' : '';
        };
        const press = k => {
            if (k === 'DEL') dbgPin = dbgPin.slice(0, -1);
            else if (k === 'OK') {
                if (dbgPin.length !== DBG_PIN.length) return;
                dbgOpen = dbgPin === DBG_PIN;
                dbgPin = '';
                if (dbgOpen) { debugSync(); return; }
            } else if (dbgPin.length < DBG_PIN.length) dbgPin += k;
            look();
        };
        let ok = null;
        for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'OK']) {
            const b = document.createElement('button');
            b.textContent = k;
            if (k.length > 1) b.className = 'word';
            if (k === 'OK') ok = b;
            b.addEventListener('click', () => press(k));
            grid.appendChild(b);
        }
        dbgPinKey = press;
        dbgSync.push(() => { dbgPin = ''; look(); });
    }

    function debugKey(e) {
        if (dbgOpen || !dbgPinKey) return;
        if (/^[0-9]$/.test(e.key)) dbgPinKey(e.key);
        else if (e.code === 'Backspace') { e.preventDefault(); dbgPinKey('DEL'); }
        else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); dbgPinKey('OK'); }
    }

    function debugSync() { for (const f of dbgSync) f(); }
