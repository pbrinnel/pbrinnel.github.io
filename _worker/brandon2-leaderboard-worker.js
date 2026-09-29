// Leaderboards for brandon2 (fourkeys.html until it launches under that name).
// Deploy as its own Cloudflare Worker, `brandon2-board`, with its own KV
// namespace bound as SCORES -- never brandon.html's, whose table this must not
// touch. Kept in the repo so the deployed source is not only living in the
// Cloudflare dashboard.
//
//   GET  /  -> { boards: { FARM: [...], ... }, total: [...] }
//   POST /  -> { stage: "FARM", ini: "ABC", score: 1234, pad: "ember" }, returns the same
//
// A stage's row keeps the paddle the run was played with, when it is one of
// PADS, and the page shows it beside the score. TOTAL adds up runs that may
// have been played with different paddles, so its rows have none.
//
// Every stage in STAGES is a table of its own, exactly like brandon.html's:
// the best TOP_N runs, the same initials as often as they earn it. TOTAL is
// each set of initials' best on every stage in IN_TOTAL, added up. Two players
// with the same initials are one player to it, which is accepted.
//
// TOTAL needs everyone's best on every stage, not only the rows that made a
// table, so every score posted is also kept as a best per initials in BESTS.
// That is what lets IN_TOTAL change later and still add up right: the next
// posted score recomputes it from BESTS.
//
// Two keys, so a page load reads only the small one: VIEW is what GET returns,
// BESTS is only read on a POST. A POST is at most two KV writes, which puts the
// free plan's 1,000 writes a day at 500 scores a day.
//
// No attempt is made to stop a determined cheat -- the game is client side, so
// anyone can POST whatever they like. The clamps only keep the tables from
// being broken outright by junk.

const TOP_N = 10;
const MAX_SCORE = 10000000;
const VIEW = 'view';
const BESTS = 'bests';

// The ids are the save file's stage tokens (_ref/BRANDON-SAVE.md), and they are
// pinned the same way: renaming one orphans its table. A new stage is a new id
// here and in the page's BOARD_IDS.
const STAGES = ['FARM', 'RUINS', 'CITY', 'VOLCANO', 'CASTLE', 'VOID', 'BOSS RUSH'];
const IN_TOTAL = ['FARM', 'RUINS', 'CITY', 'VOLCANO', 'CASTLE', 'VOID'];
// The paddles' keys, as the save file pins them (_ref/BRANDON-SAVE.md). One the
// page sends that is not here is left off the row rather than refused.
const PADS = ['standard', 'classic', 'gilt', 'statue', 'frost', 'ember', 'pair', 'multi', 'prince', 'chell'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

// highest first; a tie goes to whoever got there first
const byScore = (a, b) => b.score - a.score || (a.at || 0) - (b.at || 0);

// every stage present, so the page never has to tell "empty" from "missing"
function shape(view) {
  const boards = {};
  for (const s of STAGES) boards[s] = (view && view.boards && view.boards[s]) || [];
  return { boards, total: (view && view.total) || [] };
}

function totals(bests) {
  const sum = {};
  for (const s of IN_TOTAL) {
    for (const [ini, n] of Object.entries(bests[s] || {})) sum[ini] = (sum[ini] || 0) + n;
  }
  return Object.entries(sum)
    .map(([ini, score]) => ({ ini, score }))
    .sort((a, b) => b.score - a.score || (a.ini < b.ini ? -1 : 1))
    .slice(0, TOP_N);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (request.method === 'GET') {
      return json(shape(await env.SCORES.get(VIEW, 'json')));
    }

    if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'bad json' }, 400);
      }

      const stage = String(body?.stage ?? '');
      const ini = String(body?.ini ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
      const score = Math.floor(Number(body?.score));
      const pad = PADS.includes(body?.pad) ? body.pad : null;

      if (!STAGES.includes(stage)) return json({ error: 'no such stage' }, 400);
      if (ini.length !== 3) return json({ error: 'need three letters' }, 400);
      if (!Number.isFinite(score) || score <= 0 || score > MAX_SCORE) {
        return json({ error: 'bad score' }, 400);
      }

      // read-modify-write. it can race under real load; on an unlinked page it
      // never will, and losing one entry would not matter.
      const [stored, bests] = await Promise.all([
        env.SCORES.get(VIEW, 'json'),
        env.SCORES.get(BESTS, 'json').then(b => b || {}),
      ]);
      const view = shape(stored);

      const mine = bests[stage] || (bests[stage] = {});
      const raised = score > (mine[ini] || 0);
      if (raised) mine[ini] = score;

      const list = view.boards[stage];
      const onBoard = list.length < TOP_N || score > list[list.length - 1].score;
      if (onBoard) {
        list.push(pad ? { ini, score, at: Date.now(), pad } : { ini, score, at: Date.now() });
        list.sort(byScore);
        view.boards[stage] = list.slice(0, TOP_N);
      }
      if (raised) view.total = totals(bests);

      await Promise.all([
        raised && env.SCORES.put(BESTS, JSON.stringify(bests)),
        (raised || onBoard) && env.SCORES.put(VIEW, JSON.stringify(view)),
      ]);
      return json(view);
    }

    return json({ error: 'method not allowed' }, 405);
  },
};
