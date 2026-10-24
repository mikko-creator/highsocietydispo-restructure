/* pages/blog-index.js — the blog listings' category chips (the editorial lane; src/templates/blog-index.mjs [data-chips]).
   On phones the chips are one row that swipes: the current category is brought into view when the page opens, so a
   category page never hides its own chip off-screen, and a chip that takes keyboard focus is brought wholly into view
   (the browser leaves a half-visible one where it is, under the row's edge). Nothing moves when the row fits. Runs
   only on blog listings. */
(function () {
  'use strict';
  var nav = document.querySelector('[data-chips]');
  if (!nav) return;
  var row = nav.querySelector('.catchips__list');
  if (!row) return;
  var scrolls = function () { return row.scrollWidth > row.clientWidth + 1; };
  var on = nav.querySelector('[aria-current="page"]');
  if (on && scrolls()) {
    var item = on.parentElement || on;
    var left = item.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft;
    row.scrollLeft = Math.max(0, left - (row.clientWidth - item.offsetWidth) / 2);
  }
  row.addEventListener('focusin', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('.catchip') : null;
    if (!a || !scrolls()) return;
    var li = a.parentElement || a, cs = window.getComputedStyle(row);
    var padL = parseFloat(cs.scrollPaddingLeft) || 0, padR = parseFloat(cs.scrollPaddingRight) || 0;
    var rr = row.getBoundingClientRect(), r = li.getBoundingClientRect();
    if (r.left < rr.left + padL) row.scrollLeft -= rr.left + padL - r.left;
    else if (r.right > rr.right - padR) row.scrollLeft += r.right - (rr.right - padR);
  });
})();
