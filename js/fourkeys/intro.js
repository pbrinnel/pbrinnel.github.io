'use strict';

    // ---- the opening ------------------------------------------------------------------
    // Before the town, two cards, each held until you tap. The first is the
    // last thing the first game showed you: the new brandon at the top, in
    // black and white, and BRANDON WINS over him -- laid out exactly where the
    // end of a reign puts it, with the bonus rows and the score taken away, so
    // anyone who finished that game recognises the frame. The second says how
    // long it has been. Then the town, which the game has already stood up
    // underneath them.
    //
    // The splash comes first and takes its own tap, so nothing here counts a
    // press until it is gone. The hub is live under the cards, so a press that
    // turns one over must not reach it: the menu asks introUp() before it lets
    // a press walk him, and the listener here stops the press going any
    // further.
    const INTRO_CARDS = ['wins', 'later'];
    const INTRO_WAIT = 0.35;          // seconds a card is up before a tap turns it
    const INTRO_LATER = '2000 YEARS LATER';

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
        else text(INTRO_LATER, LW / 2, LH / 2 + 10, 32 * u, '#f2efe9', 'center');
        return true;
    }

    // drawVictor's last frame and drawBonus's title, at the size and place a
    // reign's two rows and total would give them
    function introWins(u) {
        drawFigure(LW / 2, G_Y, G_W0, 1, 1, 0);
        const bot = slotY(G_MAX - 1) - G_SHIP_H / 2 - G_SHIP_BOB - EOR_ARMY_GAP;
        const rows = 2;
        const units = EOR_TITLE_U + rows + EOR_RULE_U + 1 + EOR_HINT_U;
        const pitch = Math.min(EOR_PITCH * Math.min(u, 1.25), (bot - EOR_TOP) / units);
        const top = (EOR_TOP + bot) / 2 - pitch * units / 2;
        const size = Math.min(32 * u, pitch * 1.15);
        ctx.save();
        ctx.font = size + 'px "Trebuchet MS", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = Math.max(3, size * 0.22);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText('BRANDON WINS', LW / 2, top + pitch * EOR_TITLE_U);
        ctx.fillStyle = '#f2efe9';
        ctx.fillText('BRANDON WINS', LW / 2, top + pitch * EOR_TITLE_U);
        ctx.restore();
    }
