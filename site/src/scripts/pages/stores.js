/* pages/stores.js — the stores lane's pages (store pages, the service areas, the store menus):
   1. the directions tabs ([data-tabs]): one panel shown at a time; the tab row follows the ARIA tabs pattern (arrow
      keys, Home and End move between tabs and show their panel; the selected tab is the one tab stop). Without
      scripts the tab row is not drawn and every panel shows.
   2. the store's open-now line ([data-store-status]): open or closed by the store's hours in Michigan time
      (America/Detroit), whatever the visitor's own clock zone; its words come from the page (data-open-text,
      data-closed-text). Without scripts (or without Intl time zones) it stays hidden.
   Runs only where its hooks are present. */
(function () {
  'use strict';
  var tabsRoots = document.querySelectorAll('[data-tabs]');
  var statuses = document.querySelectorAll('[data-store-status]');
  if (!tabsRoots.length && !statuses.length) return;

  Array.prototype.forEach.call(tabsRoots, function (root) {
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;
    var panelOf = function (t) { return document.getElementById(t.getAttribute('aria-controls')); };
    var select = function (t, focus) {
      tabs.forEach(function (o) {
        var on = o === t;
        o.setAttribute('aria-selected', on ? 'true' : 'false');
        o.setAttribute('tabindex', on ? '0' : '-1');
        var p = panelOf(o); if (p) p.hidden = !on;
      });
      if (focus) t.focus();
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t, false); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, n = tabs.length, to = -1;
        if (k === 'ArrowRight' || k === 'ArrowDown') to = (i + 1) % n;
        else if (k === 'ArrowLeft' || k === 'ArrowUp') to = (i - 1 + n) % n;
        else if (k === 'Home') to = 0;
        else if (k === 'End') to = n - 1;
        if (to < 0) return;
        e.preventDefault(); select(tabs[to], true);
      });
    });
    var first = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0];
    select(first, false);
  });

  if (!statuses.length) return;
  var minutesNow = function () {
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Detroit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
      var h = 0, m = 0;
      parts.forEach(function (p) { if (p.type === 'hour') h = Number(p.value); if (p.type === 'minute') m = Number(p.value); });
      return h * 60 + m;
    } catch (e) { return null; }
  };
  var toMin = function (s) { var x = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return x ? Number(x[1]) * 60 + Number(x[2]) : null; };
  var now = minutesNow();
  if (now === null) return;
  Array.prototype.forEach.call(statuses, function (el) {
    var o = toMin(el.getAttribute('data-opens')), c = toMin(el.getAttribute('data-closes'));
    if (o === null || c === null) return;
    var open = o <= c ? now >= o && now < c : now >= o || now < c;
    el.textContent = el.getAttribute(open ? 'data-open-text' : 'data-closed-text') || '';
    el.setAttribute('data-state', open ? 'open' : 'closed');
    if (el.textContent) el.hidden = false;
  });
})();
