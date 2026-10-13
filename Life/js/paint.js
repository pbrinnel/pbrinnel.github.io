// PAINT's powers: things done to the world from outside the sim's own rules. Sim side, so
// the Node harness and the lab's workers load it; the page's buttons and the blast's drawing
// are paint-tab.js, main.js and render.js.
//
// AS.nuke(sim, tile, radius) → { tiles, animals, blades, corpses, holes }
//   Destroys everything within `radius` tiles (a circle; the PAINT tab's Radius slider, whose
//   default is NukeRadius in settings.csv; 0 = just that tile) of `tile`: animals
//   vanish with no corpse and no DEATH event (nothing is left to act out), blades, corpses
//   and warren holes go, and the ground is scorched (W.scorch, days left): ScorchDays at the
//   center, shorter toward the rim, so the crater greens from its edges inward. Water is left
//   alone: it stays, and wet ground (an animal wading included) is not scorched.
//
// AS.paintCircle(sim, kind, cx, cy, r, cap) → number placed       kind: 'grass' | 'bunny' | 'wolf' | 'human' | 'water' | 'fire'
//   The paint modes' brush: one new thing of that kind on every eligible tile within r tiles
//   (a circle) of (cx, cy), each of a random age. Eligible = bare (nothing on it and no water, so nothing is
//   ever displaced); grass also skips holes and scorch, wolves and humans skip holes (bunnies may stand
//   on one). Tiles are visited in a fixed order and dice come from sim.rng. r = 0 is the
//   single tile (cx, cy). cap is optional, { room }: animals (not grass) stop going down at
//   room, which counts down as they are placed, and cap.hit becomes true if an eligible tile
//   was left empty for want of room (main.js's soft limit on the animal total).
//   'water' pours water instead (placed = tiles poured on), and 'fire' sets alight every tile
//   in the circle that will burn (placed = tiles that caught), through AS.ignite alone, so
//   fire's own rules decide: grass, corpses and animals (not in a hole), and bare ground (a
//   brief ember, unless scorched); water and warren holes are skipped. Neither takes a cap.
(function (AS) {
  'use strict';

  // How much of ScorchDays the rim keeps: the center gets all of it, the rim 1 - this share.
  const RIM_COOL_SHARE = 0.6;

  AS.nuke = function (sim, tile, radius) {
    const { W, T } = sim, R = radius === undefined ? T.world.NukeRadius : radius, days = T.world.ScorchDays;
    const cx = W.tx(tile), cy = W.ty(tile), R2 = R * R, reach = Math.floor(R);
    const out = { tiles: 0, animals: 0, blades: 0, corpses: 0, holes: 0 };
    const y0 = Math.max(0, cy - reach), y1 = Math.min(W.h - 1, cy + reach);
    const x0 = Math.max(0, cx - reach), x1 = Math.min(W.w - 1, cx + reach);
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, d2 = dx * dx + dy * dy;
        if (d2 > R2) continue;
        const t = y * W.w + x;
        out.tiles++;
        const k = W.kind[t];
        if (k >= AS.KIND.BUNNY) { W.removeAnimal(W.aSlot[t]); out.animals++; }
        if (W.wDepth[t] > 0) continue;   // water is not the nuke's to touch, and it can't scorch
        if (W.sunk[t]) { W.dropSunk(t); out.blades++; }   // a blade under the shore is vaporized too
        if (W.flow[t] === AS.FLOW.FIRE && k === AS.KIND.EMPTY) W.removeFire(t);   // an ember has nothing left to burn on
        else if (k === AS.KIND.GRASS) { W.removeGrass(t); out.blades++; }
        else if (k === AS.KIND.CORPSE) { AS.corpseRemove(sim, t); out.corpses++; }
        if (W.hole[t]) { W.removeHole(t); out.holes++; }
        const left = days * (1 - (R > 0 ? RIM_COOL_SHARE * Math.sqrt(d2) / R : 0));
        if (left > W.scorch[t]) W.scorch[t] = left;
        W.roots[t] = 0; W.rootAge[t] = 0;   // and the roots under it
        W.ash[t] = 0;   // a nuke vaporizes: it leaves no ash, and takes any that was there
      }
    }
    return out;
  };

  // Painted animals span babies to elders, but stop short of the Lifespan so none dies on
  // its first tick; start.js only places adults.
  const PAINT_MAX_AGE = 0.95;

  AS.paintCircle = function (sim, kind, cx, cy, r, cap) {
    const { W, T, rng } = sim, K = AS.KIND;
    const reach = Math.floor(r), r2 = r * r;
    if (kind === 'water') return pourWater(sim, cx, cy, r);
    if (kind === 'fire') return lightFires(sim, cx, cy, r);
    const species = AS.SPECIES_KEY.indexOf(kind);   // -1 for 'grass'
    const S = kind === 'grass' ? T.grass : T[kind];
    let placed = 0;
    for (let y = Math.max(0, cy - reach); y <= Math.min(W.h - 1, cy + reach); y++) {
      for (let x = Math.max(0, cx - reach); x <= Math.min(W.w - 1, cx + reach); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > r2) continue;
        const t = y * W.w + x;
        if (!W.isBare(t)) continue;
        if (kind === 'grass') {
          if (W.hole[t] || W.scorch[t] > 0 || W.beach[t]) continue;   // the beach stays bare for drinking
          const age = rng.next() * S.Lifespan;
          W.addGrass(t, Math.min(1, S.SproutSize + age * S.GrowthRate), age);
        } else {
          if (W.hole[t] && !AS.canEnterHole(species)) continue;
          if (cap && !(cap.room > 0)) { cap.hit = true; continue; }
          // spawnStarting rolls the sex, fills the body and staggers the decision timer.
          const s = AS.spawnStarting(sim, species, t);
          // A species that never breeds (humans) stays within adulthood, which spawnStarting
          // already rolled: it has no babies to paint.
          if (S.LitterSize != null) W.aAge[s] = rng.next() * S.Lifespan * PAINT_MAX_AGE;
          if (cap) cap.room--;
        }
        placed++;
      }
    }
    return placed;
  };

  // FIRE MODE: every tile within r of (cx, cy) that AS.ignite accepts catches. ignite is the
  // only judge of what burns, so the brush can never light something fire's rules forbid.
  function lightFires(sim, cx, cy, r) {
    const W = sim.W, reach = Math.floor(r), r2 = r * r;
    let lit = 0;
    for (let y = Math.max(0, cy - reach); y <= Math.min(W.h - 1, cy + reach); y++) {
      for (let x = Math.max(0, cx - reach); x <= Math.min(W.w - 1, cx + reach); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > r2) continue;
        if (AS.ignite(sim, y * W.w + x)) lit++;
      }
    }
    return lit;
  }

  // WATER MODE (Paul, 11-12 Oct 2026: it should flow): POUR_DEPTH meters more water on every
  // tile within r of (cx, cy), into the world's water rules (water.js), which take it from
  // there: downhill, into the soil, out at the river mouths. What it reaches it treats as any
  // water would (drowned grass and holes, corpses washed away, animals wading or stepping
  // out). A world made without water gets the rules here, dry, with no river mouths.
  const POUR_DEPTH = 1;
  function pourWater(sim, cx, cy, r) {
    const W = sim.W, reach = Math.floor(r), r2 = r * r;
    if (!W.water) W.water = AS.Water(W, sim.terrain, W.outlet || new Uint8Array(W.n));
    const H = W.water.H;
    let placed = 0;
    for (let y = Math.max(0, cy - reach); y <= Math.min(W.h - 1, cy + reach); y++) {
      for (let x = Math.max(0, cx - reach); x <= Math.min(W.w - 1, cx + reach); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > r2) continue;
        H[y * W.w + x] += POUR_DEPTH;
        placed++;
      }
    }
    W.water.listWet();
    AS.syncWater(sim);
    return placed;
  }
})(globalThis.AS);
