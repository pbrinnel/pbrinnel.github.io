// Runs one seed of the sim headless, with no drawing, using the sim's own files, so a
// result here is exactly what the page would do with the same tables and seed.
//
// In:  { type: 'init', v }                       load the sim files (?v=v)
//      { type: 'run', id, texts, seed, days, bunnyCap, progressEvery }
//      { type: 'cancel', id }
// Out: { type: 'ready' }
//      { type: 'progress', id, day, grass, bunnies, wolves }   every progressEvery days
//      { type: 'done', id, result }                            see finish() below
'use strict';

const SIM_FILES = ['tables', 'rng', 'world', 'grass', 'corpse', 'sim', 'sight', 'animals',
  'breed', 'bunny', 'wolf', 'glyphs'];

let canceled = null;

self.onmessage = async e => {
  const m = e.data;
  if (m.type === 'init') {
    self.AS = { V: m.v };
    importScripts(...SIM_FILES.map(f => `/Life/js/${f}.js?v=${m.v}`));
    self.postMessage({ type: 'ready' });
  } else if (m.type === 'cancel') {
    canceled = m.id;
  } else if (m.type === 'run') {
    try {
      self.postMessage({ type: 'done', id: m.id, result: await run(m) });
    } catch (err) {
      self.postMessage({ type: 'done', id: m.id, result: { endReason: 'error', error: String(err && err.message || err) } });
    }
  }
};

// Lets a cancel message in between days.
const yieldToMessages = () => new Promise(r => setTimeout(r, 0));

async function run(m) {
  const AS = self.AS;
  const { T, errors } = AS.parseTables(m.texts);
  if (!T) return { endReason: 'error', error: errors.join(' ') };
  const states = AS.checkStates(T);
  if (states.errors.length) return { endReason: 'error', error: states.errors.join(' ') };

  const t0 = performance.now();
  const sim = AS.Sim(T, m.seed >>> 0);
  const W = sim.W, perDay = AS.TICK_HZ * AS.DAY_SECONDS;
  const first = { grass: null, bunnies: null, wolves: null };
  const peak = { grass: 0, bunnies: 0, wolves: 0 };
  let endReason = 'survived', day = 0;

  const note = d => {
    const now = { grass: W.gCount, bunnies: W.bunnies, wolves: W.wolves };
    for (const k in now) {
      if (now[k] > peak[k]) peak[k] = now[k];
      if (now[k] === 0 && first[k] === null) first[k] = d;
    }
  };
  note(0);

  for (day = 1; day <= m.days; day++) {
    for (let i = 0; i < perDay; i++) sim.tick();
    note(day);
    if (m.progressEvery && day % m.progressEvery === 0) {
      self.postMessage({ type: 'progress', id: m.id, day, grass: W.gCount, bunnies: W.bunnies, wolves: W.wolves });
    }
    // Stop as soon as the outcome is settled: a species gone, or bunnies past the cap
    // (a boom that size has no predator control left and only costs time to simulate).
    if (W.wolves === 0) { endReason = 'wolves extinct'; break; }
    if (W.bunnies === 0) { endReason = 'bunnies extinct'; break; }
    if (W.gCount === 0) { endReason = 'grass extinct'; break; }
    if (m.bunnyCap && W.bunnies > m.bunnyCap) { endReason = 'bunny boom'; break; }
    await yieldToMessages();
    if (canceled === m.id) { endReason = 'canceled'; break; }
  }

  const h = sim.history, n = h.length;
  const history = { grass: h.grass.slice(0, n), bunnies: h.bunnies.slice(0, n), wolves: h.wolves.slice(0, n) };
  return {
    seed: m.seed >>> 0,
    daysRun: Math.min(day, m.days),   // whole days simulated (the day it stopped on counts)
    daysAsked: m.days,
    endReason,                        // 'survived' | '<species> extinct' | 'bunny boom' | 'canceled' | 'error'
    firstExtinct: first,              // day each species first hit 0, or null
    peak,
    final: { grass: W.gCount, bunnies: W.bunnies, wolves: W.wolves },
    history,                          // hourly samples, as sim.history (see sim.js)
    ms: performance.now() - t0,
  };
}
