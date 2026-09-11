// Leaderboard for brandon.html. Deploy as a Cloudflare Worker with a KV
// namespace bound as SCORES. Kept in the repo so the deployed source is not
// only living in the Cloudflare dashboard.
//
//   GET  /   -> the top ten, highest first
//   POST /   -> { ini: "ABC", score: 1234 }, returns the new top ten
//
// Free plan covers this comfortably: 100k requests/day, 100k KV reads/day,
// 1,000 KV writes/day. The whole table lives under ONE key, so a page load is
// a single read and a submitted score is a single write.
//
// No attempt is made to stop a determined cheat -- the game is client side, so
// anyone can POST whatever they like. The clamps below only keep the table from
// being broken outright by junk: initials are forced to three letters, and a
// score has to be a positive integer under the cap.

const TOP_N = 10;
const KEY = 'top';
const MAX_SCORE = 10000000;

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

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (request.method === 'GET') {
      return json((await env.SCORES.get(KEY, 'json')) || []);
    }

    if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'bad json' }, 400);
      }

      const ini = String(body?.ini ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
      const score = Math.floor(Number(body?.score));

      if (ini.length !== 3) return json({ error: 'need three letters' }, 400);
      if (!Number.isFinite(score) || score <= 0 || score > MAX_SCORE) {
        return json({ error: 'bad score' }, 400);
      }

      // read-modify-write. it can race under real load; at ten rows on an
      // unlinked page it never will, and losing one entry would not matter.
      const list = (await env.SCORES.get(KEY, 'json')) || [];
      list.push({ ini, score, at: Date.now() });
      list.sort((a, b) => b.score - a.score);
      const top = list.slice(0, TOP_N);

      await env.SCORES.put(KEY, JSON.stringify(top));
      return json(top);
    }

    return json({ error: 'method not allowed' }, 405);
  },
};
