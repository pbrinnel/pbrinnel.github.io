// The properties window (#inspector): what the selection is and how it is doing, live. ui.js
// hands it on as ui.inspector.
//
// AS.PropertiesWindow(inspEl, { below, onClose }) → { show(desc) }
//   below     the element it starts under (the bar and its windows), whose height changes
//   onClose   the × was pressed
//   show(null) hides it; show({ title, rows: [{ name, value, range, tip, heading }] }) shows it
(function (AS) {
  'use strict';

  const PHONE_PX = 600;   // the CSS breakpoint where this window becomes a bottom sheet

  AS.PropertiesWindow = function (inspEl, { below, onClose }) {
    const { el, cachedText } = AS.uiParts;

    // Built once; live calls only rewrite the values that changed. The rows are rebuilt
    // only when the set of names changes (a different kind of thing was selected).
    const inspHead = el('div', 'insp-head');
    const inspTitle = el('span', 'insp-title', '');
    const inspClose = el('button', 'win-close insp-close', '×');
    inspClose.type = 'button';
    inspClose.title = 'Close';
    inspClose.addEventListener('click', () => { show(null); if (onClose) onClose(); });
    inspHead.append(inspTitle, inspClose);
    const inspList = el('div', 'insp-list');
    inspEl.append(inspHead, inspList);
    for (const t of ['pointerdown', 'pointerup', 'wheel']) inspEl.addEventListener(t, e => e.stopPropagation());
    // It drags by its title bar, like the graph.
    const drag = AS.Draggable ? AS.Draggable(inspEl, inspHead, 'life-insp-pos') : null;
    if (drag) inspHead.title = 'Drag to move; double-click to put it back';
    // The corner grip, on a computer only: on a phone it is a bottom sheet with CSS's own size.
    if (AS.uiParts.Resizable) {
      AS.uiParts.Resizable(inspEl, {
        key: 'life-insp-wh', minW: 200, minH: 90,
        enabled: () => (globalThis.innerWidth || 0) > PHONE_PX,
        pin: () => { if (drag) { const b = inspEl.getBoundingClientRect(); drag.place(b.left, b.top); } },
      });
    }

    const setInspTitle = cachedText(inspTitle);
    let rowKey = '';
    let rowEls = [];   // { row, value, range, setValue, setRange, tip }
    let panelTop = -1;

    // The window starts under the bar and tab windows, whose height changes as contents wrap.
    function place() {
      const h = below.offsetHeight;
      if (h !== undefined && h !== panelTop) { panelTop = h; inspEl.style.setProperty('--hud-bottom', h + 'px'); }
    }
    if (typeof ResizeObserver === 'function') new ResizeObserver(place).observe(below);

    function show(desc) {
      if (!desc) { if (!inspEl.hidden) inspEl.hidden = true; return; }
      if (inspEl.hidden) inspEl.hidden = false;
      place();
      setInspTitle(desc.title);
      const rows = desc.rows;
      const key = rows.map(r => r.name).join('\n');
      if (key !== rowKey) {
        rowKey = key;
        inspList.textContent = '';
        rowEls = rows.map(r => {
          // A heading starts a section (the Tile under the selection): its name, no value.
          if (r.heading) {
            const head = el('div', 'insp-sub', r.name);
            inspList.appendChild(head);
            return { row: head, setValue() {}, setRange() {}, tip: '' };
          }
          const row = el('div', 'insp-row');
          const val = el('span', 'insp-value', '');
          const range = el('span', 'insp-range', '');
          const cell = el('span', 'insp-cell');
          cell.append(val, range);
          row.append(el('span', 'insp-name', r.name), cell);
          inspList.appendChild(row);
          return { row, setValue: cachedText(val), setRange: cachedText(range), tip: row.title };
        });
      }
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i], e = rowEls[i], tip = r.tip || '';
        e.setValue(String(r.value));
        e.setRange(r.range ? String(r.range) : '');
        if (tip !== e.tip) { e.tip = tip; e.row.title = tip; }
      }
    }

    return { show };
  };
})(globalThis.AS);
