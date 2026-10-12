// The cards over the world (the end of a run, too many animals) and the page that replaces
// the sim when it can't start. ui.js hands them on as ui.ended, ui.crowd and ui.errors.
//
// AS.Cards({ hudEl, errorsEl }) → { errors(errs, warns, opts), ended(info), crowd(info) }
(function (AS) {
  'use strict';

  AS.Cards = function ({ hudEl, errorsEl }) {
    const { el, fmtInt } = AS.uiParts;

    // opts { title, intro, foot } replace the table-problem wording, for failures that
    // aren't about the CSVs' contents (e.g. the page opened from disk).
    function errors(errs, warns, opts) {
      const o = opts || {};
      const loading = document.getElementById('loading');   // the error page replaces the loading card
      if (loading) loading.hidden = true;
      hudEl.hidden = true;
      errorsEl.textContent = '';
      const page = el('div', 'err-page');
      page.appendChild(el('h1', '', o.title || 'The tables have problems'));
      page.appendChild(el('p', '', o.intro || 'The sim did not start. Each line names the file, row and column.'));
      const ul = el('ul', 'err-list');
      for (const m of errs) ul.appendChild(el('li', '', m));
      page.appendChild(ul);
      if (warns && warns.length) {
        page.appendChild(el('h2', '', 'Warnings'));
        const wl = el('ul', 'err-list err-warns');
        for (const m of warns) wl.appendChild(el('li', '', m));
        page.appendChild(wl);
      }
      page.appendChild(el('p', 'err-foot', o.foot || 'Fix the CSVs in tables/ and reload the page.'));
      errorsEl.appendChild(page);
      errorsEl.hidden = false;
    }

    // End of a run: a card over the world naming what died out, with a way to start a new
    // world or keep watching what's left.
    let endEl = null;
    function ended(info) {
      if (endEl) { endEl.remove(); endEl = null; }
      if (!info) return;
      endEl = el('div', 'end-card');
      endEl.setAttribute('role', 'dialog');
      for (const t of info.titles) endEl.appendChild(el('div', 'end-title', t));
      endEl.appendChild(el('div', 'end-day', `Day ${info.day.toFixed(1)}`));
      const row = el('div', 'end-buttons');
      const again = el('button', 'hud-control', 'New world');
      again.type = 'button';
      again.addEventListener('click', () => info.onNew());
      const watch = el('button', 'hud-control', 'Keep watching');
      watch.type = 'button';
      watch.addEventListener('click', () => info.onContinue());
      row.appendChild(again);
      row.appendChild(watch);
      endEl.appendChild(row);
      document.body.appendChild(endEl);
    }

    // The painting limit's card (an end-card, since the same kind of question): the sim keeps
    // running behind it. Keep adding and Stop here both close it; main.js decides what they mean.
    let crowdEl = null;
    function crowd(info) {
      if (crowdEl) { crowdEl.remove(); crowdEl = null; }
      if (!info) return;
      crowdEl = el('div', 'end-card crowd-card');
      crowdEl.setAttribute('role', 'dialog');
      crowdEl.appendChild(el('div', 'end-title', 'That\'s a crowd'));
      crowdEl.appendChild(el('div', 'crowd-text',
        `Over ${fmtInt(info.limit)} animals can make the sim slow down or stutter, especially on phones. Add more anyway?`));
      const row = el('div', 'end-buttons');
      const keep = el('button', 'hud-control crowd-keep', 'Keep adding');
      keep.type = 'button';
      keep.addEventListener('click', () => info.onKeep());
      const stop = el('button', 'hud-control crowd-stop', 'Stop here');
      stop.type = 'button';
      stop.addEventListener('click', () => info.onStop());
      row.append(keep, stop);
      crowdEl.appendChild(row);
      document.body.appendChild(crowdEl);
    }

    return { errors, ended, crowd };
  };
})(globalThis.AS);
