// The PAINT tab's controls: the modes (the brushes and the nuke) and the Radius slider. ui.js
// builds the tab's window and its rows, and hands these on as ui.mode, ui.setMode, ui.nuke,
// ui.setNuke, ui.setRadiusDefaults, ui.setRadius and ui.radiusOf.
//
// AS.PaintTab(modesRow, sizeRow, { onNuke, onMode, onRadius, isLocked, bannerParent }) → paint
//   paint.mode, paint.setMode(name), paint.setNuke(on)
//   paint.radiusOf(name), paint.setRadius(name, r), paint.setRadiusDefaults(brush)
//     one Radius for every mode: the name is accepted and ignored; the slider starts at the brush's
//   While a mode is armed a banner in bannerParent names it, with a Stop button (Paul, 12 Oct
//   2026: it was too easy to forget a mode was on); the colored edge around the map is CSS
//   on the body's `paint-armed` / `nuke-armed`.
//   paint.lock(on)       disables the controls while the benchmark runs
//   paint.setIcons(icon) icon(key) → a canvas with that sprite, for each mode's button
(function (AS) {
  'use strict';

  // One mode at a time: 'nuke', or a brush ('grass', 'bunny', 'wolf', 'human', 'water', 'fire'), or ''
  // for none. Armed until toggled off, so repeated nukes and strokes work; main.js turns a tap
  // (or a drag, for a brush) on the world into that mode's action while it is on. Each button
  // shows its name until setIcons gives it its icon (Paul, 12 Oct 2026); the name stays its
  // label for screen readers and leads its tooltip.
  // [name, label, class, icon key, tooltip]
  const MODES = [
    ['nuke', 'NUKE MODE', 'hud-nuke', 'nuke', 'Tapping the world drops a nuke there'],
    ['grass', 'GRASS MODE', 'hud-brush', 'blades', 'Tap or drag to plant grass of random ages on empty ground'],
    ['bunny', 'RABBIT MODE', 'hud-brush', 'bunnies', 'Tap or drag to add rabbits of random ages on empty ground'],
    ['wolf', 'WOLF MODE', 'hud-brush', 'wolves', 'Tap or drag to add wolves of random ages on empty ground'],
    ['human', 'HUMAN MODE', 'hud-brush', 'humans', 'Tap or drag to add adult humans on empty ground'],
    ['water', 'WATER MODE', 'hud-brush', 'water', 'Tap or drag to pour water (1 m deep); it flows from there'],
    ['fire', 'FIRE MODE', 'hud-brush', 'fires', 'Tap or drag to set grass and bodies alight; it spreads from there by itself'],
  ];
  // Paul's cap: a round 75, whose circle (~17,700 tiles) stays under the crowd limit.
  const RADIUS_MAX = 75;
  const RADIUS_KEY = 'life-radius';   // one value for every mode (Paul, 12 Oct 2026)

  AS.PaintTab = function (modesRow, sizeRow, { onNuke, onMode, onRadius, isLocked, bannerParent }) {
    const { el } = AS.uiParts;
    let mode = '';
    const modeBtns = {};
    for (const [name, label, cls, , tip] of MODES) {
      const b = el('button', 'hud-control ' + cls, label);
      b.type = 'button';
      b.title = label + ': ' + tip.charAt(0).toLowerCase() + tip.slice(1);
      b.setAttribute('aria-label', label);
      b.addEventListener('click', () => { if (!isLocked()) setMode(mode === name ? '' : name); b.blur(); });
      modesRow.appendChild(b);
      modeBtns[name] = b;
    }

    // The Radius slider sets the size of whichever mode is on (0 = one tile): one value for
    // them all, remembered in localStorage. Its default is the brush's, from settings.csv once
    // the tables load (setRadiusDefaults), so until then it reads 0.
    let radius = null, radiusDefault = 0;
    const radiusBox = el('span', 'hud-radius');
    radiusBox.title = 'Size of the armed mode, in tiles (0 = one tile)';
    const radiusLabel = el('span', 'hud-radius-label', 'Radius –');
    const radiusInput = el('input', 'hud-radius-input');
    radiusInput.type = 'range';
    radiusInput.min = '0';
    radiusInput.max = String(RADIUS_MAX);
    radiusInput.step = '1';
    radiusInput.value = '0';
    radiusInput.disabled = true;
    radiusInput.setAttribute('aria-label', 'Radius in tiles');
    radiusBox.append(radiusLabel, radiusInput);
    sizeRow.appendChild(radiusBox);
    const clampRadius = v => Math.max(0, Math.min(RADIUS_MAX, Math.round(Number(v) || 0)));
    const radiusOf = () => radius !== null ? radius : clampRadius(radiusDefault);
    function showRadius() {
      radiusInput.disabled = isLocked() || mode === '';
      if (mode === '') { radiusLabel.textContent = 'Radius –'; return; }
      const r = radiusOf();
      radiusLabel.textContent = 'Radius ' + r;
      if (radiusInput.value !== String(r)) radiusInput.value = String(r);
    }
    function setRadius(name, r) {
      radius = clampRadius(r);
      try { localStorage.setItem(RADIUS_KEY, String(radius)); } catch (e) { /* the choice just isn't kept */ }
      showRadius();
    }
    radiusInput.addEventListener('input', () => {
      if (isLocked() || mode === '') return;
      setRadius(mode, radiusInput.value);
      if (onRadius) onRadius(mode, radiusOf());   // main.js shows a fading preview of the size
    });
    function setRadiusDefaults(brush) {
      radiusDefault = brush;
      radius = null;
      try {
        const v = localStorage.getItem(RADIUS_KEY);
        if (v !== null && v !== '' && Number.isFinite(Number(v))) radius = clampRadius(v);
      } catch (e) { /* default */ }
      showRadius();
    }

    // The armed banner: the mode's icon and name, and Stop. It is built hidden and shown only
    // while a mode is on, so a disarmed page carries no trace of it.
    const banner = el('div', 'paint-banner');
    banner.hidden = true;
    banner.setAttribute('role', 'status');
    const bannerIcon = el('span', 'paint-banner-icon');
    const bannerText = el('span', 'paint-banner-text', '');
    const stopBtn = el('button', 'hud-control paint-stop', 'Stop');
    stopBtn.type = 'button';
    stopBtn.title = 'Stop painting';
    stopBtn.addEventListener('click', () => { if (!isLocked()) setMode(''); stopBtn.blur(); });
    banner.append(bannerIcon, bannerText, stopBtn);
    // Taps on the banner belong to it, not to the map under it.
    for (const t of ['pointerdown', 'pointerup', 'wheel']) banner.addEventListener(t, e => e.stopPropagation());
    if (bannerParent) bannerParent.appendChild(banner);
    let iconOf = null;
    function showBanner() {
      banner.hidden = mode === '';
      if (mode === '') return;
      const m = MODES.find(x => x[0] === mode);
      // "FIRE MODE" reads as "PAINTING: FIRE"; the nuke is armed, not painting.
      const word = m[1].replace(/ MODE$/, '');
      bannerText.textContent = mode === 'nuke' ? word + ' ARMED' : 'PAINTING: ' + word;
      bannerIcon.textContent = '';
      if (iconOf) bannerIcon.appendChild(iconOf(m[3]));
    }

    function setMode(next) {
      next = modeBtns[next] ? next : '';
      if (next === mode) return;
      const prev = mode;
      mode = next;
      for (const [name, b] of Object.entries(modeBtns)) b.classList.toggle('on', name === mode);
      if (document.body) {
        document.body.classList.toggle('nuke-armed', mode === 'nuke');
        document.body.classList.toggle('paint-armed', mode !== '' && mode !== 'nuke');
      }
      showRadius();
      showBanner();
      if (onNuke && (prev === 'nuke' || mode === 'nuke')) onNuke(mode === 'nuke');
      if (onMode) onMode(mode);
    }
    const setNuke = on => setMode(on ? 'nuke' : (mode === 'nuke' ? '' : mode));

    function lock(on) {
      for (const b of Object.values(modeBtns)) b.disabled = !!on;
      showRadius();
    }

    function setIcons(icon) {
      iconOf = icon;
      showBanner();
      for (const [name, , , key] of MODES) {
        const b = modeBtns[name];
        b.textContent = '';
        b.appendChild(icon(key));
        b.classList.toggle('hud-mode-icon', true);
      }
    }

    return {
      setMode, setNuke, radiusOf, setRadius, setRadiusDefaults, lock, setIcons,
      get mode() { return mode; },
    };
  };
})(globalThis.AS);
