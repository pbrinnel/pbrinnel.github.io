'use strict';

    // ---- FOUR KEYS: the debug menu ---------------------------------------------------
    // What the konami code opens, and fourkeys.html?debug on a phone. The town
    // is the whole of the game's progress, so this is the whole of the cheat
    // menu: hand yourself a key, a paddle or a memory, or put it all back.
    //
    // It reaches the town through menuLevels/menuPads/menuHas/menuSet and
    // nothing else, so it never has to know where any of it is kept.
    //
    // engine.js owns the panel itself -- the konami code, the escape key, the
    // ?debug in the address -- and calls debugBuild() once at setup and
    // debugSync() every time the panel opens.

    // held down rather than clicked, since it cannot be undone. The same length
    // the game's own reset asked for.
    const DBG_WIPE_HOLD = 1.2;

    const DBG_HEADS = { keys: 'keys — four of them open the CASTLE', pads: 'paddles',
                        mems: 'memories — one after each level' };

    let dbgSync = [];                 // one per row: bring its look up to date

    function debugBuild() {
        const el = document.getElementById('debug');
        if (!el) return;
        el.querySelector('h2').textContent = 'FOUR KEYS';

        // a column each, side by side: stacked they stood taller than a screen
        const cols = document.createElement('div');
        cols.className = 'cols';
        el.appendChild(cols);
        debugRow(cols, 'keys', menuLevels().filter(l => l.n <= 4));
        debugRow(cols, 'pads', menuPads().map(k => ({ k, name: (LAB_PAD[k] || {}).name || k.toUpperCase() })));
        debugRow(cols, 'mems', menuLevels().map(l => ({ n: l.n, name: 'MEMORY ' + l.n, ink: l.ink })));

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
        el.appendChild(wipe);
        el.appendChild(Object.assign(document.createElement('p'),
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

    function debugSync() { for (const f of dbgSync) f(); }
