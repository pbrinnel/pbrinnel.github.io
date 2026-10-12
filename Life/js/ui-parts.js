// Small DOM helpers the page's windows share: ui.js, cards.js, properties.js, paint-tab.js.
(function (AS) {
  'use strict';

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // A text node whose content is only rewritten when it changes: hud() and the properties
  // window run every frame, and most values stay put.
  function cachedText(node) {
    let last = node.textContent;
    return s => { if (s !== last) { last = s; node.textContent = s; } };
  }

  const fmtInt = n => Math.round(n).toLocaleString('en-US');

  AS.uiParts = { el, cachedText, fmtInt };
})(globalThis.AS);
