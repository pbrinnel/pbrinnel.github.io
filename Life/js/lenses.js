// Lenses (Paul, 13 Oct 2026): the map seen through one set of things at a time. This file is the
// definitions (which lenses there are and which items each shows, with names, colors and tips),
// what makes a tile or an animal a member of an item, and the counts the Info legend shows.
// render.js draws them (Renderer.setLens); ui.js builds the buttons and legend from AS.LENSES.
// Read-only on the sim, no DOM.
(function (AS) {
  'use strict';

  // A tile set with more members than this tints; a smaller one gets rings (animals always ring).
  const RING_MAX = AS.LENS_RING_MAX = 30;
  // A tinted set goes back to rings only below this share of RING_MAX, so a count hovering around
  // RING_MAX doesn't swap its look back and forth.
  const RING_HYSTERESIS = 0.8;

  // `icon` is the inside of a 16x16 svg whose wrapper sets fill none, stroke currentColor, width 1.5
  // and round caps (AS.lensIconSvg builds the whole thing); an element that is filled says so itself.
  const LENSES = [
    { id: 'fire', name: 'Fire', accent: '#ff6a3d', blurb: 'What is burning, what burned, and where lightning struck.',
      icon: '<path d="M8 1.6c.5 2.5 4.2 3.9 4.2 7.5a4.2 4.2 0 0 1-8.4 0c0-1.7.8-2.8 1.7-3.6.1 1.1.6 1.7 1.3 1.9C7 5.3 7.2 3.3 8 1.6z"/>',
      items: ['burn', 'alight', 'ash', 'roots', 'scorched', 'strikes'] },
    { id: 'water', name: 'Water', accent: '#2de2e6', blurb: 'Where the water is, and how wet the ground around it.',
      icon: '<path d="M1.5 5.5c1.4-1.5 2.8-1.5 4.2 0s2.8 1.5 4.2 0 2.8-1.5 4.6 0"/><path d="M1.5 9.5c1.4-1.5 2.8-1.5 4.2 0s2.8 1.5 4.2 0 2.8-1.5 4.6 0"/><path d="M1.5 13.5c1.4-1.5 2.8-1.5 4.2 0s2.8 1.5 4.2 0 2.8-1.5 4.6 0"/>',
      items: ['water', 'beach', 'sunk', 'wet', 'dry'] },
    { id: 'weather', name: 'Weather', accent: '#8aa8ff', blurb: 'Rain on the map, where storms strike, and the soil it leaves.',
      icon: '<path d="M4.6 10.2a2.9 2.9 0 0 1 .3-5.8 3.9 3.9 0 0 1 7.3 1.2 2.3 2.3 0 0 1-.5 4.6z"/><path d="M5.6 12.4l-.7 1.8M8.6 12.4l-.7 1.8M11.6 12.4l-.7 1.8"/>',
      items: ['showers', 'strikes', 'wet', 'dry'] },
    { id: 'ground', name: 'Ground', accent: '#c8a064', blurb: 'The land itself: warrens, burnt ground and the shore.',
      icon: '<path d="M1.5 12.5h13"/><path d="M2.4 12.5C3.6 7.4 6 5.2 8 5.2s4.4 2.2 5.6 7.3"/><path d="M6.2 12.5a1.8 1.8 0 0 1 3.6 0" fill="currentColor"/>',
      items: ['holes', 'scorched', 'ash', 'roots', 'beach'] },
    { id: 'condition', name: 'Condition', accent: '#ff8fd0', blurb: 'How each animal is doing: needs, injuries, and life stage.',
      icon: '<path d="M8 13.6S1.8 9.9 1.8 5.9A3.1 3.1 0 0 1 8 4.6a3.1 3.1 0 0 1 6.2 1.3c0 4-6.2 7.7-6.2 7.7z"/>',
      items: ['hungry', 'thirsty', 'hurt', 'exhausted', 'pregnant', 'babies', 'elders', 'alight'] },
    { id: 'activity', name: 'Activity', accent: '#c6ff3d', blurb: 'What every animal is doing right now. The legend is the key.',
      icon: '<path fill="currentColor" stroke="none" d="M8 8.4c-2 0-3.8 1.9-3.8 3.3 0 1.2 1 1.6 2.1 1.4.6-.1 1-.3 1.7-.3s1.1.2 1.7.3c1.1.2 2.1-.2 2.1-1.4 0-1.4-1.8-3.3-3.8-3.3z"/><circle fill="currentColor" stroke="none" cx="3.2" cy="6.6" r="1.4"/><circle fill="currentColor" stroke="none" cx="6" cy="3.9" r="1.4"/><circle fill="currentColor" stroke="none" cx="10" cy="3.9" r="1.4"/><circle fill="currentColor" stroke="none" cx="12.8" cy="6.6" r="1.4"/>',
      items: ['fleeFire', 'hiding', 'fleeing', 'drinking', 'eating', 'hunting', 'mating', 'digging', 'playing', 'resting', 'wandering', 'leaving'] },
  ];
  AS.LENSES = LENSES;
  AS.lensIconSvg = l => `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${l.icon}</svg>`;

  // kind: 'tiles' (a list of tiles), 'showers' (circles), 'animals'. `draw` is what the map does with
  // it now: tile sets move between 'tint' and 'ring' as their counts do (lensCounts keeps it), so
  // the legend swatch can read it after each call.
  const ITEMS = {
    burn:      { name: 'burning tiles', color: '#ff3b3b', kind: 'tiles', tip: 'Tiles on fire right now' },
    ash:       { name: 'ash', color: '#e2e2f0', kind: 'tiles', tip: 'Ground a fire left ash on; it feeds new grass until it weathers away' },
    roots:     { name: 'roots', color: '#c6ff3d', kind: 'tiles', tip: 'Burnt plants whose roots survived and may sprout again (not drawn in the world)' },
    scorched:  { name: 'scorched', color: '#b57cff', kind: 'tiles', tip: 'Scorched ground: nothing grows or digs here until it cools' },
    strikes:   { name: 'recent strikes', color: '#ffffff', kind: 'tiles', tip: 'Lightning strikes from the last while' },
    water:     { name: 'water', color: '#2de2e6', kind: 'tiles', tip: 'Water, shallow to deep' },
    beach:     { name: 'beach', color: '#fff2c2', kind: 'tiles', tip: 'Beach: wet sand at the water\'s edge (not drawn in the world)' },
    sunk:      { name: 'sunk grass', color: '#6dffc8', kind: 'tiles', tip: 'Grass the water or beach has taken; it returns if the ground dries in time (not drawn in the world)' },
    wet:       { name: 'wet soil', color: '#8aa8ff', kind: 'tiles', tip: 'Soil wet from rain or water nearby; grass grows faster and fire spreads slower' },
    dry:       { name: 'dry soil', color: '#d9922e', kind: 'tiles', tip: 'Soil that has gone dry; fire spreads faster here' },
    holes:     { name: 'warren holes', color: '#ff8fd0', kind: 'tiles', tip: 'Warren holes' },
    showers:   { name: 'showers, storms marked', color: '#2de2e6', kind: 'showers', tip: 'Showers raining on the map; a storm is outlined and marked with a bolt' },
    alight:    { name: 'burning animals', color: '#ffe14a', kind: 'animals', tip: 'Animals that are on fire' },
    hungry:    { name: 'hungry', color: '#c6ff3d', kind: 'animals', tip: 'Hungry animals' },
    thirsty:   { name: 'thirsty', color: '#2de2e6', kind: 'animals', tip: 'Thirsty animals' },
    hurt:      { name: 'hurt', color: '#ff3b3b', kind: 'animals', tip: 'Hurt animals' },
    exhausted: { name: 'exhausted', color: '#b57cff', kind: 'animals', tip: 'Animals out of stamina' },
    pregnant:  { name: 'pregnant', color: '#ff8fd0', kind: 'animals', tip: 'Pregnant females' },
    babies:    { name: 'babies', color: '#ffffff', kind: 'animals', tip: 'Babies' },
    elders:    { name: 'elders', color: '#8aa8ff', kind: 'animals', tip: 'Elders' },
    fleeFire:  { name: 'fleeing fire', color: '#ff3b3b', kind: 'animals', tip: 'Running from fire' },
    hiding:    { name: 'hiding', color: '#b57cff', kind: 'animals', tip: 'Hiding in a hole' },
    fleeing:   { name: 'fleeing', color: '#ff8fd0', kind: 'animals', tip: 'Running from a hunter' },
    drinking:  { name: 'drinking', color: '#2de2e6', kind: 'animals', tip: 'Drinking' },
    eating:    { name: 'eating', color: '#c6ff3d', kind: 'animals', tip: 'Eating, or on its way to food' },
    hunting:   { name: 'hunting', color: '#ffffff', kind: 'animals', tip: 'Hunting' },
    mating:    { name: 'mating', color: '#ffe14a', kind: 'animals', tip: 'Mating' },
    digging:   { name: 'digging', color: '#c98a4b', kind: 'animals', tip: 'Digging a hole' },
    playing:   { name: 'playing', color: '#ff9a2e', kind: 'animals', tip: 'Playing: a binky, a chase or a wrestle' },
    resting:   { name: 'resting', color: '#8aa8ff', kind: 'animals', tip: 'Resting' },
    wandering: { name: 'wandering', color: '#8d9096', kind: 'animals', tip: 'Wandering' },
    leaving:   { name: 'leaving home', color: '#6dffc8', kind: 'animals', tip: 'Leaving home' },
  };
  const IDS = AS.LENS_ITEM_IDS = Object.keys(ITEMS);
  const IDX = AS.LENS_ITEM_INDEX = {};
  IDS.forEach((id, i) => {
    const it = ITEMS[id];
    it.id = id; it.index = i; it.decided = false;
    it.rgb = [1, 3, 5].map(k => parseInt(it.color.slice(k, k + 2), 16));
    it.draw = it.kind === 'animals' ? 'ring' : 'tint';
    IDX[id] = i;
  });
  AS.LENS_ITEMS = ITEMS;

  // ---- animals ------------------------------------------------------------------------------
  // The animal items, one bit each in animalBits' answer.
  const ANIMAL_IDS = IDS.filter(id => ITEMS[id].kind === 'animals');
  const BIT = {};
  ANIMAL_IDS.forEach((id, i) => { BIT[id] = 1 << i; });
  AS.LENS_ANIMAL_IDS = ANIMAL_IDS;

  // The Activity item a state shows under, by the state's name in states.csv. A state with no entry
  // (a new one) is in no Activity item until it is added here.
  const ACTIVITY_OF = {
    ESCAPE: 'fleeFire', HIDE: 'hiding', FLEE: 'fleeing', DRINK: 'drinking',
    EAT: 'eating', FEED: 'eating', SEEK_FOOD: 'eating', FORAGE: 'eating',
    HUNT: 'hunting', MATE: 'mating', DIG: 'digging', PLAY: 'playing', REST: 'resting', GIVE_UP: 'resting',
    WANDER: 'wandering', PROWL: 'wandering',
  };
  const WANDER_STATE = 'WANDER';

  // Per set of tables: each species' stats, and its states' activity bits (and which one is WANDER).
  let cacheT = null, statsBy = null, stateBits = null, wanderIdx = null;
  function cacheFor(T) {
    if (cacheT === T) return;
    cacheT = T;
    statsBy = AS.SPECIES_KEY.map(k => T[k]);
    wanderIdx = AS.SPECIES_KEY.map(() => -1);
    stateBits = AS.SPECIES_KEY.map((k, sp) => (T.states[k] || []).map((st, i) => {
      if (st.name === WANDER_STATE) wanderIdx[sp] = i;
      return ACTIVITY_OF[st.name] ? BIT[ACTIVITY_OF[st.name]] : 0;
    }));
  }

  // Which animal items slot s is in, as a bitmask (BIT). Needs and conditions are the species'
  // own thresholds (HungryAt and ThirstyAt are shares of the meters, HPMax is full health).
  function animalBits(sim, s) {
    const W = sim.W, sp = W.aSpecies[s], S = statsBy[sp];
    let b = 0;
    if (W.aAlight[s] > 0) b |= BIT.alight;
    if (W.aFullness[s] < S.HungryAt * S.FullnessMax) b |= BIT.hungry;
    if (W.aWater[s] < S.ThirstyAt * S.WaterMax) b |= BIT.thirsty;
    if (W.aHP[s] < S.HPMax) b |= BIT.hurt;
    if (W.aStamina[s] <= 0) b |= BIT.exhausted;
    if (W.aPregnant[s] > 0) b |= BIT.pregnant;
    const stage = AS.stageOf(S, W.aAge[s]);
    if (stage === AS.STAGE.BABY) b |= BIT.babies; else if (stage === AS.STAGE.ELDER) b |= BIT.elders;
    const st = W.aState[s], act = stateBits[sp][st] || 0;
    // A bunny that is wandering off a crowd is leaving home; only a wanderer asks (it costs a lookup).
    if (act === BIT.wandering && st === wanderIdx[sp] && sp === AS.SPECIES.BUNNY && AS.wellbeingInfo(sim, s).leavingHome) b |= BIT.leaving;
    else b |= act;
    return b;
  }

  // Calls fn(slot, bits) for every live animal that is in some item of `mask` (a bitmask of BIT).
  AS.lensEachAnimal = function (sim, mask, fn) {
    cacheFor(sim.T);
    const W = sim.W;
    for (let s = 0, hi = W.aHigh; s < hi; s++) {
      if (!W.aAlive[s]) continue;
      const b = animalBits(sim, s) & mask;
      if (b) fn(s, b);
    }
  };
  AS.LENS_ANIMAL_BIT = BIT;

  // ---- tiles --------------------------------------------------------------------------------
  // Strikes still recent: the ones whose scorch mark would still be on the ground (render.js drawScars).
  // Calls fn(tile) for each.
  function eachRecentStrike(sim, fn) {
    const st = sim.weather && sim.weather.strikes;
    if (!st) return;
    const days = sim.T.world.FireScorchDays, now = sim.simSeconds, cap = st.tile.length;
    for (let k = Math.max(0, st.n - cap); k < st.n; k++) {
      if ((now - st.atSec[k % cap]) / AS.DAY_SECONDS < days) fn(st.tile[k % cap]);
    }
  }

  const pushTo = (list, t) => {
    if (list.n === list.a.length) { const a = new Int32Array(Math.max(64, list.a.length * 2)); a.set(list.a); list.a = a; }
    list.a[list.n++] = t;
  };
  AS.lensNewList = () => ({ a: new Int32Array(64), n: 0 });

  // Fills lists[item index] (a {a, n} from lensNewList, n reset first) with the tiles inside
  // rect {x0, y0, x1, y1} (inclusive) that belong to each tile item `need` asks for (a Uint8Array
  // by item index). soil: the renderer's drawn soil levels, or null (no rain, no soil look).
  // One pass over the rect; the burning tiles, holes and strikes come from their own short lists.
  AS.lensScanTiles = function (sim, soil, r, need, lists) {
    const W = sim.W, w = W.w;
    for (const id of IDS) if (need[IDX[id]] && ITEMS[id].kind === 'tiles') lists[IDX[id]].n = 0;
    const inRect = t => { const x = t % w, y = (t / w) | 0; return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1; };
    if (need[IDX.burn]) for (let i = 0; i < W.fCount; i++) { const t = W.fList[i]; if (inRect(t)) pushTo(lists[IDX.burn], t); }
    if (need[IDX.holes]) for (let i = 0; i < W.hCount; i++) { const t = W.hList[i]; if (inRect(t)) pushTo(lists[IDX.holes], t); }
    if (need[IDX.strikes]) eachRecentStrike(sim, t => { if (inRect(t)) pushTo(lists[IDX.strikes], t); });
    const nAsh = need[IDX.ash], nRoots = need[IDX.roots], nScorch = need[IDX.scorched], nWater = need[IDX.water],
      nBeach = need[IDX.beach], nSunk = need[IDX.sunk], nWet = soil && need[IDX.wet], nDry = soil && need[IDX.dry];
    if (!(nAsh || nRoots || nScorch || nWater || nBeach || nSunk || nWet || nDry)) return;
    const ash = W.ash, roots = W.roots, scorch = W.scorch, depth = W.wDepth, beach = W.beach, sunk = W.sunk;
    for (let y = r.y0; y <= r.y1; y++) {
      const row = y * w;
      for (let t = row + r.x0, end = row + r.x1; t <= end; t++) {
        if (nAsh && ash[t] > 0) pushTo(lists[IDX.ash], t);
        if (nRoots && roots[t]) pushTo(lists[IDX.roots], t);
        if (nScorch && scorch[t] > 0) pushTo(lists[IDX.scorched], t);
        if (nSunk && sunk[t]) pushTo(lists[IDX.sunk], t);
        if (depth[t] > 0) { if (nWater) pushTo(lists[IDX.water], t); continue; }
        if (nBeach && beach[t]) pushTo(lists[IDX.beach], t);
        if (soil) { const l = soil[t]; if (l > 0) { if (nWet) pushTo(lists[IDX.wet], t); } else if (l < 0 && nDry) pushTo(lists[IDX.dry], t); }
      }
    }
  };

  // Fills lists[item index] with (slot, serial) pairs of the live animals in each animal item
  // `need` asks for. n counts ints, two to an animal.
  AS.lensScanAnimals = function (sim, need, lists) {
    let mask = 0;
    for (const id of ANIMAL_IDS) {
      if (need[IDX[id]]) { mask |= BIT[id]; lists[IDX[id]].n = 0; }
    }
    if (!mask) return;
    const W = sim.W;
    AS.lensEachAnimal(sim, mask, (s, bits) => {
      for (const id of ANIMAL_IDS) if (bits & BIT[id]) { const l = lists[IDX[id]]; pushTo(l, s); pushTo(l, W.aSerial[s]); }
    });
  };

  // ---- counts -------------------------------------------------------------------------------
  // How many members each item has on the whole map: { itemId: count }. One pass over the tiles
  // and one over the animals, so it suits twice a second but not every frame. renderer (or null)
  // gives the soil levels as drawn; it is also told it has fresh counts. Keeps each tile item's
  // `draw` (tint or ring) in step with its count.
  AS.lensCounts = function (sim, renderer) {
    cacheFor(sim.T);
    const W = sim.W, n = W.n, c = {};
    for (const id of IDS) c[id] = 0;
    const soil = renderer && renderer.soilLevels, ash = W.ash, roots = W.roots, scorch = W.scorch, depth = W.wDepth, beach = W.beach, sunk = W.sunk;
    let nAsh = 0, nRoots = 0, nScorch = 0, nWater = 0, nBeach = 0, nSunk = 0, nWet = 0, nDry = 0;
    for (let t = 0; t < n; t++) {
      if (ash[t] > 0) nAsh++;
      if (roots[t]) nRoots++;
      if (scorch[t] > 0) nScorch++;
      if (sunk[t]) nSunk++;
      if (depth[t] > 0) { nWater++; continue; }
      if (beach[t]) nBeach++;
      if (soil) { const l = soil[t]; if (l > 0) nWet++; else if (l < 0) nDry++; }
    }
    c.ash = nAsh; c.roots = nRoots; c.scorched = nScorch; c.water = nWater; c.beach = nBeach; c.sunk = nSunk; c.wet = nWet; c.dry = nDry;
    c.burn = W.fCount; c.holes = W.hCount;
    eachRecentStrike(sim, () => { c.strikes++; });
    c.showers = sim.weather && sim.weather.showers ? sim.weather.showers.n : 0;
    AS.lensEachAnimal(sim, -1, (s, bits) => {
      for (const id of ANIMAL_IDS) if (bits & BIT[id]) c[id]++;
    });
    for (const id of IDS) {
      const it = ITEMS[id];
      if (it.kind !== 'tiles') continue;
      if (!it.decided) it.draw = c[id] <= RING_MAX ? 'ring' : 'tint';
      else if (it.draw === 'ring') { if (c[id] > RING_MAX) it.draw = 'tint'; }
      else if (c[id] <= RING_MAX * RING_HYSTERESIS) it.draw = 'ring';
      it.decided = true;
    }
    if (renderer && renderer.lensCountsFresh) renderer.lensCountsFresh();
    return c;
  };
})(globalThis.AS);
