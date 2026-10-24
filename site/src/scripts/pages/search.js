/* pages/search.js — /search/ (core): reads ?q=, fetches the build's search index (search-index.json: every page's
   path, title, h1, description, template, category) and lists the pages that contain every word of the query, best
   first (a word in the title or h1 counts double). Results are built with textContent (no HTML from the index). When
   nothing matches, or the index cannot load, the page's own pointer to the site map stays. Runs only on the search page. */
(function () {
  'use strict';
  var list = document.querySelector('[data-search-results]');
  if (!list) return;
  var status = document.querySelector('[data-search-status]');
  var fallback = document.querySelector('[data-search-fallback]');
  var input = document.getElementById('search-page');
  var q = '';
  try { q = (new URLSearchParams(window.location.search).get('q') || '').trim(); } catch (e) { q = ''; }
  if (input && q) input.value = q;
  if (!q) return;
  if (fallback) fallback.setAttribute('data-ready', '');
  var root = list.getAttribute('data-root') || '';
  var show = function () { if (fallback) fallback.removeAttribute('data-ready'); };
  var el = function (tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  fetch(list.getAttribute('data-index'), { credentials: 'same-origin' }).then(function (r) {
    if (!r.ok) throw new Error('search index ' + r.status);
    return r.json();
  }).then(function (index) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    var hits = [];
    index.forEach(function (p) {
      var head = (p.t + ' ' + p.h).toLowerCase();
      var all = (head + ' ' + p.d + ' ' + (p.c || '')).toLowerCase();
      var score = 0;
      for (var i = 0; i < terms.length; i++) {
        if (all.indexOf(terms[i]) < 0) return;
        score += head.indexOf(terms[i]) >= 0 ? 2 : 1;
      }
      hits.push({ p: p, s: score });
    });
    hits.sort(function (a, b) { return b.s - a.s || (a.p.p < b.p.p ? -1 : a.p.p > b.p.p ? 1 : 0); });
    list.textContent = '';
    hits.slice(0, 60).forEach(function (x) {
      var li = el('li', 'result');
      if (x.p.c) li.appendChild(el('p', 'result__kind', x.p.c));
      var h = el('h2', 'result__title');
      var a = el('a', '', x.p.h || x.p.t);
      a.href = root + x.p.p.replace(/^\//, '');
      h.appendChild(a);
      li.appendChild(h);
      if (x.p.d) li.appendChild(el('p', 'result__desc', x.p.d));
      list.appendChild(li);
    });
    if (status) status.textContent = hits.length ? hits.length + ' ' + list.getAttribute('data-count') : list.getAttribute('data-none');
    if (!hits.length) show();
  }).catch(function () { show(); });
})();
