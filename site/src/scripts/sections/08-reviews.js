/* 08-reviews.js: what the shared read-more (site.js) does not do for the reviews. site.js opens the text INSIDE the
   card as a scroll area of the same height, so on its own the opened card shows the same lines it showed closed. Here:
   - on "Read more", the hidden lines slide into view: the box scrolls by whole lines so that the last line that was
     read in full stays at the top as context (instant under prefers-reduced-motion). The visitor asked for it; nothing
     scrolls on its own, and the page's own scroll is never touched (scrollBy on the text box only)
   - while an opened review overflows its box, its root carries data-rv-scroll="true" and the thumb's place and length
     (--rv-tt / --rv-th) for the CSS scroll hint beside the text; data-rv-more="true" while lines are still below
   site.js puts the box back at the top when it closes. IIFE, no globals, behaviour only. */
(function () {
  'use strict';
  var section = document.getElementById('reviews');
  if (!section) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  Array.prototype.forEach.call(section.querySelectorAll('.reviews__more[data-readmore]'), function (root) {
    var text = root.querySelector('.readmore__text'), btn = root.querySelector('.readmore__btn'), p = root.querySelector('.reviews__quote p');
    if (!text || !btn || !p) return;
    var lineH = function () { return parseFloat(getComputedStyle(p).lineHeight) || 26; };
    // the opened quote ends with the box's leftover part-line (plus a line when that is under a third of one), so the
    // end of the scroll range is a whole number of lines: the top line is never cut in half, wherever the scroll stops,
    // and the last line ends a little clear of "Read less" (the fade is off once the end is reached)
    var endPad = function () {
      var lh = lineH(), hgt = text.getBoundingClientRect().height, left = hgt - Math.floor(hgt / lh + 1e-3) * lh;
      return left < lh * .35 ? left + lh : left;
    };
    var fit = function () {
      var v = endPad().toFixed(2) + 'px';
      if (root.style.getPropertyValue('--rv-end') !== v) root.style.setProperty('--rv-end', v);
    };
    var set = function (k, v) { if (root.getAttribute(k) !== v) root.setAttribute(k, v); };
    var prop = function (k, v) { if (root.style.getPropertyValue(k) !== v) root.style.setProperty(k, v); };
    // the scroll hint: data-rv-scroll while an opened review overflows its box, the thumb's offset and length along
    // the box (--rv-tt / --rv-th), and data-rv-more while text is still below (beyond the empty end)
    var mark = function () {
      var open = root.getAttribute('data-collapsed') === 'false';
      var hgt = text.clientHeight, all = text.scrollHeight, top = text.scrollTop;
      var over = open && all > hgt + 1;
      set('data-rv-scroll', String(over));
      set('data-rv-more', String(over && top + hgt < all - endPad() - 2));
      if (over) { prop('--rv-th', (hgt * hgt / all).toFixed(2) + 'px'); prop('--rv-tt', (top * hgt / all).toFixed(2) + 'px'); }
    };
    btn.addEventListener('click', function () {
      // site.js flips data-collapsed in its own click handler; read the new state once it has run and laid out
      requestAnimationFrame(function () {
        if (root.getAttribute('data-collapsed') === 'false') {
          var lh = lineH(), shown = Math.floor(text.clientHeight / lh);
          var step = Math.max(1, shown - 2) * lh;
          text.scrollBy({ top: step, behavior: reduce.matches ? 'auto' : 'smooth' });
        }
        mark();
      });
    });
    text.addEventListener('scroll', mark, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(function () { fit(); mark(); }).observe(text);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fit(); mark(); });
    fit(); mark();
  });
})();
