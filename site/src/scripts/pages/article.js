/* pages/article.js — an article's contents (the editorial lane; src/templates/article.mjs [data-toc]). Without a script
   the contents box is simply open. With one: on phones and tablets it starts folded and folds again after a jump; from
   1100px (where it is a column that stays in view) it stays open. The link of the section being read is marked
   (aria-current="true"), and a thin bar under the list shows how far through the article the reader is (--read, 0..1).
   Runs only on article pages. */
(function () {
  'use strict';
  var toc = document.querySelector('[data-toc]');
  if (!toc) return;
  var box = toc.querySelector('details');
  var sum = box ? box.querySelector('summary') : null;
  var wide = window.matchMedia ? window.matchMedia('(min-width: 1100px)') : null;
  var isWide = function () { return !!(wide && wide.matches); };
  // from 1100px the contents is a column that stays open: its label is a heading there (no chevron, no pointer), so it
  // leaves the tab order and a click on it does nothing; below 1100px it is the switch of the folding box again
  var fold = function () {
    if (!box) return;
    var w = isWide();
    box.open = w;
    if (sum) {
      if (w) { sum.setAttribute('tabindex', '-1'); sum.setAttribute('aria-disabled', 'true'); }
      else { sum.removeAttribute('tabindex'); sum.removeAttribute('aria-disabled'); }
    }
  };
  fold();
  if (wide) { if (wide.addEventListener) wide.addEventListener('change', fold); else if (wide.addListener) wide.addListener(fold); }
  if (sum) sum.addEventListener('click', function (e) { if (isWide()) e.preventDefault(); });
  toc.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (a && box && !isWide()) box.open = false;
  });

  var links = Array.prototype.slice.call(toc.querySelectorAll('.toc__link'));
  var targets = links.map(function (a) { return document.getElementById(decodeURIComponent((a.getAttribute('href') || '').slice(1))); });
  var main = document.querySelector('.article__main');
  var current = -1, ticking = false;
  var offset = function () { return (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')) || 64) + 40; };
  var update = function () {
    ticking = false;
    var y = offset(), k = -1;
    for (var i = 0; i < targets.length; i++) { if (targets[i] && targets[i].getBoundingClientRect().top - y <= 1) k = i; }
    if (k !== current) {
      if (current >= 0) links[current].removeAttribute('aria-current');
      if (k >= 0) links[k].setAttribute('aria-current', 'true');
      current = k;
    }
    if (main) {
      var r = main.getBoundingClientRect(), h = r.height - window.innerHeight + y;
      var p = h > 0 ? Math.min(1, Math.max(0, (y - r.top) / h)) : 1;
      toc.style.setProperty('--read', p.toFixed(3));
    }
  };
  var request = function () { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();
})();
