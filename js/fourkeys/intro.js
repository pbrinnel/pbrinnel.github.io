'use strict';

    // ---- the opening ------------------------------------------------------------------
    // Before the town, two cards, each held until you tap. The first is the
    // last thing the first game showed you: the new brandon at the top, in
    // black and white, the army still standing under him, and BRANDON WINS
    // laid out exactly where the end of a reign puts it, with the bonus rows
    // and the score taken away, so anyone who finished that game recognises
    // the frame. The second says how long it has been. Then the town, which
    // the game has already stood up underneath them, walks into view (see
    // menuArrive).
    //
    // The splash comes first and takes its own tap, so nothing here counts a
    // press until it is gone. The hub is live under the cards, so a press that
    // turns one over must not reach it: the menu asks introUp() before it lets
    // a press walk him, and the listener here stops the press going any
    // further.
    const INTRO_CARDS = ['wins', 'later'];
    const INTRO_WAIT = 0.35;          // seconds a card is up before a tap turns it
    const INTRO_LATER = '2000 YEARS LATER';
    const INTRO_LATER_PX = 43;        // its size at full scale

    let introAt = 0;                  // which card is up; past the end is none
    let introSince = -1;              // when it came up, on the page's clock

    function introUp() { return introAt < INTRO_CARDS.length; }
    function introSkip() { introAt = INTRO_CARDS.length; }

    function introNext(e) {
        if (!introUp() || !splash.hidden) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (introSince < 0 || performance.now() - introSince < INTRO_WAIT * 1000) return;
        introAt++;
        introSince = performance.now();
        if (!introUp()) menuArrive();
    }
    addEventListener('pointerdown', introNext, true);
    addEventListener('keydown', e => {
        if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
        introNext(e);
    }, true);

    // true while a card has the screen, and draw() then draws nothing else
    function introDraw(u) {
        if (!introUp()) return false;
        // its clock starts once there is something to see: the splash is over it
        if (introSince < 0 && splash.hidden) introSince = performance.now();
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, LW, LH);
        if (INTRO_CARDS[introAt] === 'wins') introWins(u);
        else text(INTRO_LATER, LW / 2, LH / 2 + 14, INTRO_LATER_PX * u, '#f2efe9', 'center');
        return true;
    }

    // The army a reign ends in front of: a full floor, each man in a wall's
    // colour or armoured gold or silver the way arrivals come, bobbing on his
    // own beat as they do on the floor. Built once, so it holds still between
    // frames instead of reshuffling.
    const INTRO_GOLD = 0.08, INTRO_SILVER = 0.14;   // shares of the floor in armour
    let introArmy = null;
    function introFloor() {
        if (introArmy) return introArmy;
        introArmy = [];
        for (let slot = 0; slot < G_MAX; slot++) {
            const r = Math.random();
            introArmy.push({ x: slotX(slot), y: slotY(slot), ph: Math.random() * 6.28,
                             hp: r < INTRO_GOLD ? 3 : r < INTRO_GOLD + INTRO_SILVER ? 2 : 1,
                             tint: TIER_KEYS[(Math.random() * TIER_KEYS.length) | 0] });
        }
        return introArmy;
    }

    // drawVictor's last frame, the army under him, and drawBonus's title at
    // the size and place a reign's two rows and total would give it
    function introWins(u) {
        const h = G_SHIP_W / SHAPE_ASPECT;
        // back rank first, so the ones nearer you end up on top
        for (const s of introFloor().slice().sort((a, b) => a.y - b.y)) {
            const sp = shipSprite(s.hp, s.tint);
            if (!sp) continue;
            const y = s.y + Math.sin(clock * G_SHIP_HZ * 6.283 + s.ph) * G_SHIP_BOB;
            ctx.drawImage(sp, s.x - G_SHIP_W / 2, y - h / 2, G_SHIP_W, h);
        }
        drawFigure(LW / 2, G_Y, G_W0, 1, 1, 0);
        const bot = slotY(G_MAX - 1) - G_SHIP_H / 2 - G_SHIP_BOB - EOR_ARMY_GAP;
        const rows = 2;
        const units = EOR_TITLE_U + rows + EOR_RULE_U + 1 + EOR_HINT_U;
        const pitch = Math.min(EOR_PITCH * Math.min(u, 1.25), (bot - EOR_TOP) / units);
        const top = (EOR_TOP + bot) / 2 - pitch * units / 2;
        const size = Math.min(32 * u, pitch * 1.15);
        ctx.save();
        ctx.font = size + 'px "Fira Sans", "Trebuchet MS", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = Math.max(3, size * 0.22);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText('BRANDON WINS', LW / 2, top + pitch * EOR_TITLE_U);
        ctx.fillStyle = '#f2efe9';
        ctx.fillText('BRANDON WINS', LW / 2, top + pitch * EOR_TITLE_U);
        ctx.restore();
    }
