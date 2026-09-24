// ---- FOUR KEYS: where it begins -------------------------------------------------
// Last of the scripts, after the engine has built itself a stage and started
// its loop. brandon.html opens on its first wall; this opens on the town, under
// the opening cards (intro.js), and every level is walked into from there.
//
// Everything above this file only describes the game. This is what starts it,
// which is why it gets a file of its own.
'use strict';

menuOpen();

// A phone has no keys to enter the konami code with, so the address can ask
// for the debug menu instead: fourkeys.html?debug opens it as the page loads.
// It has to come after the town, because standing a stage up closes the menu.
// The splash is cleared first and the wake lock taken, as a tap on it would:
// a tap that clears the splash can lose its click (see splash), and the first
// tap here is meant for the menu. The opening cards are skipped with it.
if (new URLSearchParams(location.search).has('debug')) {
    splash.hidden = true;
    introSkip();
    keepAwake();
    openMenu();
}
