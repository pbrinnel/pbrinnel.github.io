/* Day counter.
 *
 * One number and the word "days". Each digit sits on its own 0-9 drum, and only the digits
 * that actually change turn. The turn runs the whole day, so the wheel is never at rest.
 */
(function () {
  'use strict';

  var box = document.querySelector('[data-countdown]');
  if (!box) { return; }

  // Midnight Eastern on 7 May 2027. Daylight time is in effect, hence -04:00.
  var TARGET  = new Date('2027-05-07T00:00:00-04:00').getTime();
  var DAY     = 86400000;
  var WINDOW  = 24 * 60 * 60 * 1000;   // a full day, so the wheel is always mid turn
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 0 at midnight, 1 at the drop. Soft at both ends, steady through the middle, so the
  // wheel is always somewhere mid turn and sits half and half around midday.
  function ease(rest) {
    var t = 1 - (rest / WINDOW);
    if (t <= 0) { return 0; }
    if (t >= 1) { return 1; }
    if (REDUCED) { return t < 0.999 ? 0 : 1; }
    return t * t * (3 - 2 * t);
  }

  function makeCell() {
    var cell = document.createElement('span');
    cell.className = 'cd-cell';
    cell.innerHTML =
      '<span class="cd-drum"><span class="cd-col">' +
        '<span class="cd-f cd-up">0</span>' +
        '<span class="cd-f cd-now">0</span>' +
        '<span class="cd-f cd-dn">0</span>' +
      '</span></span>';
    return cell;
  }

  function paint() {
    var ms   = Math.max(0, TARGET - Date.now());
    var days = Math.floor(ms / DAY);
    var rest = ms % DAY;
    var e    = ease(rest);

    var cur = String(days);
    var nxt = String(Math.max(0, days - 1)).padStart(cur.length, '0');

    while (box.children.length > cur.length) { box.removeChild(box.lastChild); }
    while (box.children.length < cur.length) { box.appendChild(makeCell()); }

    for (var i = 0; i < cur.length; i++) {
      var drum = box.children[i].firstChild;
      var d    = Number(cur.charAt(i));

      // this digit holds still unless it is different in the next number
      drum.style.setProperty('--e', (cur.charAt(i) === nxt.charAt(i) ? 0 : e).toFixed(4));

      drum.querySelector('.cd-up').textContent  = String((d + 1) % 10);
      drum.querySelector('.cd-now').textContent = String(d);
      drum.querySelector('.cd-dn').textContent  = String((d + 9) % 10);   // counts down
    }

    box.setAttribute('aria-label', cur + ' days');
  }

  paint();
  setInterval(paint, 30000);   // the number only moves slowly; twice a minute is plenty
}());
