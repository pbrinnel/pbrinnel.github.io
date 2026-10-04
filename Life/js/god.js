// God powers: things done to the world from outside the sim's own rules. Sim side, so the
// Node harness and the lab's workers load it; the page's buttons and the blast's drawing are
// ui.js, main.js and render.js.
//
// AS.nuke(sim, tile) → { tiles, animals, blades, corpses, holes }
//   Destroys everything within NukeRadius tiles (a circle, settings.csv) of `tile`: animals
//   vanish with no corpse and no DEATH event (nothing is left to act out), blades, corpses
//   and warren holes go, and the ground is scorched (W.scorch, days left): ScorchDays at the
//   center, shorter toward the rim, so the crater greens from its edges inward.
(function (AS) {
  'use strict';

  // How much of ScorchDays the rim keeps: the center gets all of it, the rim 1 - this share.
  const RIM_COOL_SHARE = 0.6;

  AS.nuke = function (sim, tile) {
    const { W, T } = sim, R = T.world.NukeRadius, days = T.world.ScorchDays;
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
        if (k === AS.KIND.BUNNY || k === AS.KIND.WOLF) { W.removeAnimal(W.aSlot[t]); out.animals++; }
        else if (k === AS.KIND.GRASS) { W.removeGrass(t); out.blades++; }
        else if (k === AS.KIND.CORPSE) { AS.corpseRemove(sim, t); out.corpses++; }
        if (W.hole[t]) { W.removeHole(t); out.holes++; }
        const left = days * (1 - RIM_COOL_SHARE * Math.sqrt(d2) / R);
        if (left > W.scorch[t]) W.scorch[t] = left;
      }
    }
    return out;
  };
})(globalThis.AS);
