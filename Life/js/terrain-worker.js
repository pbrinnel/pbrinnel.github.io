// Grows a world's ground and settles its water off the page's main thread, so the page
// doesn't freeze while a world is made (main.js makeWorld). The same files, tables and seed
// make the same numbers as growing it on the page would (terrain.js growTerrain); the page
// then lays the result into its world.
//
//   message in:  { base (Life/ as a full URL), v (AS.V), T (the tables), seed, water }
//   message out: growTerrain's result, its arrays transferred
self.onmessage = function (e) {
  const { base, v, T, seed, water } = e.data;
  if (!self.AS) {
    self.AS = { V: v, BASE: base };
    // terrain.js needs the generator, the world's stores, the clock and the water rules.
    importScripts(...['rng', 'world', 'sim', 'water', 'terrain'].map(f => base + 'js/' + f + '.js?v=' + v));
  }
  const r = self.AS.growTerrain({ T, seed, W: self.AS.World(T) }, water);
  const transfer = [r.elev.buffer];
  for (const a of [r.outlet, r.H, r.G]) if (a) transfer.push(a.buffer);
  self.postMessage(r, transfer);
};
