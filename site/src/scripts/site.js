/* site.js — Pit Stop by High Society homepage behaviour. Vanilla, no dependencies.
   Everything is progressive: with scripts off the page still shows all of its content and never blocks it.
   Nothing here moves the page's own scroll on its own: no snapping, no hijack, no auto-advance (brief: NATURAL SCROLLING). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var wide = window.matchMedia('(min-width: 1024px)');   // the switch to the full bar (chrome.css, measured)
  var raf = function (fn) { var t = 0; return function () { if (t) return; t = requestAnimationFrame(function () { t = 0; fn(); }); }; };
  // one frame batch for the whole page: every queued job MEASURES first, then every job WRITES (one layout per frame)
  var batch = (function () {
    var q = new Map(), pending = 0;
    var flush = function () {
      pending = 0; var jobs = Array.from(q.values()); q.clear();
      var states = jobs.map(function (j) { try { return j.read(); } catch (e) { return null; } });
      jobs.forEach(function (j, k) { if (states[k]) try { j.write(states[k]); } catch (e) { if (window.console) console.error('[pitstop] batch', e); } });
    };
    return function (key, read, write) { q.set(key, { read: read, write: write }); if (!pending) pending = requestAnimationFrame(flush); };
  })();
  var nameLike = function (el, from) {
    if (!from) return;
    if (from.getAttribute('aria-labelledby')) el.setAttribute('aria-labelledby', from.getAttribute('aria-labelledby'));
    else if (from.getAttribute('aria-label')) el.setAttribute('aria-label', from.getAttribute('aria-label'));
  };
  var tabbables = function (root) {
    return $$('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), [tabindex="0"]', root).filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
  };
  var trap = function (root, e) {
    if (e.key !== 'Tab') return;
    var f = tabbables(root); if (!f.length) return;
    var first = f[0], last = f[f.length - 1], i = Array.prototype.indexOf.call(f, document.activeElement);
    // focus on the dialog itself (not one of its controls) wraps too, so Shift+Tab from it never leaves the dialog
    if (e.shiftKey && i <= 0) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); first.focus(); }
  };
  // a link styled as a button answers Space like a button (a real <button> already does, so it is left alone)
  var spaceClick = function (el, fn) { if (el.tagName === 'BUTTON') return; el.addEventListener('keydown', function (e) { if (e.key === ' ') { e.preventDefault(); fn(e); } }); };
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { try { return window.sessionStorage.getItem(k); } catch (e2) { return null; } } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { try { window.sessionStorage.setItem(k, v); } catch (e2) { /* no storage: the gate asks again next visit */ } } }
  };
  var locks = 0;
  var lock = function (on) { locks = Math.max(0, locks + (on ? 1 : -1)); document.body.classList.toggle('is-locked', locks > 0); };

  /* ------------------------------------------------ header: the red progress line under the bar (the reskin's own) */
  function initHeader() {
    var bar = $('.site-header .progress span'), head = $('.site-header'), hero = $('#home'), dock = $('[data-dock]');
    var row = head && $('.bar__inner', head), util = head && $('.util', head);
    // the cinematic bar: clear while the hero photo is behind it, solid once the hero has scrolled past. The ORDER NOW /
    // CONTACT US pair stands aside over the hero (owner, 2026-10-22: its own ORDER NOW is right there) and slides in with
    // the solid bar. (Multi-page, core 2026-10-24: measured against the v2 bar row itself, the header now has more rows.)
    var clear = function () {
      if (!head || !hero) return;
      var over = window.scrollY < hero.offsetTop + hero.offsetHeight - (row ? row.offsetHeight : head.offsetHeight) - 8;
      head.classList.toggle('is-clear', over);
      if (dock) dock.classList.toggle('is-off', over);
    };
    // the header condenses to the v2 bar once the page has scrolled past the promo strip (chrome.css .is-condensed:
    // the strip slides up, the category bar folds), so the visible header is --bar-h, as v2's sections expect
    var condense = function () {
      if (!head) return;
      head.classList.toggle('is-condensed', window.scrollY > (util ? util.offsetHeight : 0));
    };
    var set = raf(function () {
      clear();
      condense();
      if (!bar) return;
      var max = (document.documentElement.scrollHeight - window.innerHeight) || 1;
      bar.style.setProperty('--p', Math.min(1, Math.max(0, window.scrollY / max)).toFixed(4));
    });
    window.addEventListener('scroll', set, { passive: true });
    window.addEventListener('resize', set);
    requestAnimationFrame(set);
  }

  /* ------------------------------------------------- desktop dropdowns: the mega panels (Explore, Resources, Locations)
     Every panel is opened by a real button (aria-expanded, aria-controls): a click or Enter/Space toggles it, ArrowDown
     opens it and moves into it, Escape closes it and returns focus to its button, focus leaving it closes it. A mouse
     opens it with hover intent (core, 2026-10-24): after the pointer rests 90ms, and closes it 200ms after the pointer
     leaves (a pointer that comes back in time keeps it open); v2's guard stays, so a click that lands just after a
     hover-open does not shut it again. */
  function initNav() {
    var items = $$('.nav__item--sub');
    var close = function (except) { items.forEach(function (it) { if (it !== except) { it.classList.remove('is-open'); var b = $('[aria-controls]', it); if (b) b.setAttribute('aria-expanded', 'false'); } }); };
    items.forEach(function (it) {
      var btn = $('button[aria-controls]', it); if (!btn) return;
      var set = function (on) { it.classList.toggle('is-open', on); btn.setAttribute('aria-expanded', String(on)); };
      var hoverOpen = 0, tIn = 0, tOut = 0;
      btn.addEventListener('click', function () {
        clearTimeout(tIn); clearTimeout(tOut);
        if (hoverOpen && Date.now() - hoverOpen < 900 && it.classList.contains('is-open')) { hoverOpen = 0; return; }
        hoverOpen = 0; var on = !it.classList.contains('is-open'); close(it); set(on);
      });
      it.addEventListener('pointerenter', function (e) {
        if (e.pointerType !== 'mouse') return;
        clearTimeout(tOut);
        if (it.classList.contains('is-open')) return;
        clearTimeout(tIn);
        tIn = setTimeout(function () { close(it); hoverOpen = Date.now(); set(true); }, 90);
      });
      it.addEventListener('pointerleave', function (e) {
        if (e.pointerType !== 'mouse') return;
        clearTimeout(tIn);
        if (it.contains(document.activeElement)) return;
        clearTimeout(tOut);
        tOut = setTimeout(function () { hoverOpen = 0; set(false); }, 200);
      });
      it.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { set(false); btn.focus(); }
        if (e.key === 'ArrowDown' && document.activeElement === btn) { e.preventDefault(); set(true); var first = $('.nav__sub a, .mega a', it); if (first) first.focus(); }
      });
      it.addEventListener('focusout', function (e) { if (!it.contains(e.relatedTarget)) set(false); });
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.nav__item--sub')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  /* ------------------------------------------------- phone + tablet menu overlay (Locations as an accordion) */
  function initMenu() {
    var menu = $('#mmenu'); if (!menu) return;
    menu.hidden = true;   // the markup leaves it unhidden so the no-script :target fallback can show it
    var openers = $$('[data-menu-open]'); var last = null;
    function open() {
      last = document.activeElement;
      menu.hidden = false; lock(true);
      requestAnimationFrame(function () { menu.classList.add('is-open'); });
      openers.forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
      setTimeout(function () { var c = $('[data-menu-close]', menu); if (c) c.focus(); }, 60);
    }
    function close(silent) {
      if (menu.hidden) return;
      menu.classList.remove('is-open'); lock(false);
      openers.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      setTimeout(function () { if (!menu.classList.contains('is-open')) menu.hidden = true; }, reduce.matches ? 0 : 220);
      if (!silent && last && last.focus) last.focus();
    }
    initMenu.close = close;
    openers.forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); open(); }); spaceClick(b, open); });
    $$('[data-menu-close]', menu).forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); close(); }); spaceClick(b, function () { close(); }); });
    menu.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); close(); return; } trap(menu, e); });
    // an in-page link (Deals -> #deals) closes the menu on its way
    $$('a[href^="#"]:not([data-menu-close]):not([data-locator-open])', menu).forEach(function (a) { a.addEventListener('click', function () { close(true); }); });
    wide.addEventListener('change', function (e) { if (e.matches && menu.classList.contains('is-open')) close(true); });
    // v2's caret toggles and the whole-row group buttons (Explore, Resources: groups without a page of their own)
    var toggles = $$('.mmenu__toggle, [data-mmenu-acc]', menu);
    toggles.forEach(function (t) {
      var sub = document.getElementById(t.getAttribute('aria-controls')); if (!sub) return;
      sub.hidden = true;
      t.addEventListener('click', function () {
        var on = t.getAttribute('aria-expanded') !== 'true';
        toggles.forEach(function (o) { if (o !== t) { o.setAttribute('aria-expanded', 'false'); var s = document.getElementById(o.getAttribute('aria-controls')); if (s) s.hidden = true; } });
        t.setAttribute('aria-expanded', String(on)); sub.hidden = !on;
      });
    });
  }

  /* ------------------------------------------------- dialogs: the store chooser, the age gate */
  var Dialog = function (el, opt) {
    opt = opt || {};
    var last = null, self = this;
    this.el = el;
    this.isOpen = function () { return el.classList.contains('is-open'); };
    this.open = function (from) {
      if (self.isOpen()) return;
      last = from || document.activeElement;
      el.hidden = false; lock(true);
      void el.offsetWidth;                 // one layout with the closed styles, so the opening still transitions
      el.classList.add('is-open');
      var f = opt.focus ? $(opt.focus, el) : tabbables(el)[0]; if (f) f.focus({ preventScroll: true });
    };
    this.close = function () {
      if (!self.isOpen()) return;
      el.classList.remove('is-open'); lock(false);
      setTimeout(function () { if (!el.classList.contains('is-open')) el.hidden = true; }, reduce.matches ? 0 : 220);
      if (last && last.focus && document.contains(last)) last.focus();
    };
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !opt.modalOnly) { e.preventDefault(); self.close(); return; }
      trap(el, e);
    });
    if (!opt.modalOnly) el.addEventListener('click', function (e) { if (e.target === el) self.close(); });
    $$('[data-dialog-close]', el).forEach(function (b) { b.addEventListener('click', function () { self.close(); }); });
  };

  function initLocator() {
    var el = $('#dispenzaLocationPopup-open'); if (!el) return;
    el.hidden = true;   // the markup leaves it unhidden so the no-script :target fallback can show it
    var d = new Dialog(el, { focus: '[data-dialog-close]' });
    initLocator.dialog = d;
    var shown = function (x) { return !!x && x.getClientRects().length > 0; };
    // focus comes back to where the visitor was: the opener, or the menu button when the opener was in the menu (the
    // menu closes on the way, and the header's own "Select a Location" is not shown below 1180px)
    var open = function (e) {
      if (e) e.preventDefault();
      var from = e && e.currentTarget, inMenu = !!(from && from.closest && from.closest('#mmenu'));
      if (initMenu.close && inMenu) initMenu.close(true);
      d.open(inMenu ? $('[data-menu-open]') : shown(from) ? from : $$('[data-locator-open]').filter(shown)[0]);
    };
    $$('[data-locator-open]').forEach(function (a) { a.addEventListener('click', open); spaceClick(a, open); });
    // A link whose destination is still the CMS token {{location_shop_url}} (the CMS writes the chosen store's shop
    // address there when it serves the page) cannot go anywhere on a static copy: it asks for the store instead.
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href*="{{"]');
      if (!a) return;
      e.preventDefault(); d.open(a);
    });
  }

  // the CMS's AJAX popups (#sgp_N): while one is empty (always, on a static copy) its trigger stays put
  function initPopups() {
    $$('a[href^="#sgp_"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var p = document.getElementById(a.getAttribute('href').slice(1));
        if (!p || !p.children.length && !p.textContent.trim()) { e.preventDefault(); return; }
        e.preventDefault(); p.hidden = false;
      });
    });
  }

  function initAgeGate() {
    var el = $('#agegate'); if (!el) return;
    var KEY = 'pitstop-age-ok';
    if (store.get(KEY) === '1') return;
    // focus lands on the gate itself (its name and question are read out); the first Tab reaches the controls, and no
    // focus ring sits on "Yes" before the visitor has used the keyboard
    var d = new Dialog(el, { focus: '.agegate__inner', modalOnly: true });
    // once answered, the next Tab starts at the top of the page (the skip link), not after the gate's place at the end
    var toTop = function () { var b = document.body; b.setAttribute('tabindex', '-1'); b.focus({ preventScroll: true }); b.removeAttribute('tabindex'); };
    $$('[data-age-yes]', el).forEach(function (b) { var yes = function (e) { e.preventDefault(); store.set(KEY, '1'); d.close(); toTop(); }; b.addEventListener('click', yes); spaceClick(b, yes); });
    $$('[data-age-no]', el).forEach(function (b) { var no = function (e) { e.preventDefault(); var u = b.getAttribute('data-redirect'); if (u) window.location.href = u; }; b.addEventListener('click', no); spaceClick(b, no); });
    d.open(document.body);
  }

  /* -------------------------------------------------------------- carousel
     no scroll snapping: a row swipes freely; the arrows, the dots and the arrow keys bring the next card to the
     row's start edge exactly */
  function initCarousels() {
    $$('[data-carousel]').forEach(function (root) {
      var vp = $('.carousel__viewport', root), track = $('.carousel__track', root);
      if (!vp || !track) return;
      var items = function () { return Array.prototype.slice.call(track.children); };
      var prev = $('[data-prev]', root), next = $('[data-next]', root), count = $('[data-count]', root), dotsWrap = $('[data-dots]', root);
      var dots = [];
      // a picker (the Locations store list): one button per card, in the cards' order; a click brings that card in, and
      // the button of the card in view is marked current (a picker row that scrolls keeps it in sight, the page never moves)
      var picks = $$('[data-pick]', root);
      picks.forEach(function (b, k) { b.addEventListener('click', function () { go(k); }); });
      if (!root.hasAttribute('role')) root.setAttribute('role', 'group');
      function buildDots() {
        if (!dotsWrap) return;
        var list = items();
        if (dots.length === list.length) return;
        dotsWrap.textContent = ''; dots = [];
        list.forEach(function (it, i) {
          var b = document.createElement('button'); b.type = 'button';
          b.setAttribute('aria-label', (root.getAttribute('data-dot-label') || 'Go to') + ' ' + (i + 1));
          b.addEventListener('click', function () { go(i); });
          dotsWrap.appendChild(b); dots.push(b);
        });
      }
      var startOf = function (it) { return it.offsetLeft - track.offsetLeft; };
      function go(i) {
        var list = items(); i = Math.max(0, Math.min(list.length - 1, i));
        vp.scrollTo({ left: Math.min(startOf(list[i]), vp.scrollWidth - vp.clientWidth), behavior: reduce.matches ? 'auto' : 'smooth' });
      }
      function read() {
        if (!vp.offsetParent && getComputedStyle(vp).position !== 'fixed') return { hidden: true };
        var list = items(), vb = vp.getBoundingClientRect();
        var best = 0, bd = Infinity, seen = [], vis = [];
        list.forEach(function (it, k) {
          var b = it.getBoundingClientRect(), d = Math.abs(b.left - vb.left);
          if (d < bd - .5) { bd = d; best = k; }
          if (b.left >= vb.left - 2 && b.right <= vb.right + 2) seen.push(k);
          vis.push(b.right > vb.left + 4 && b.left < vb.right - 4);
        });
        return { max: vp.scrollWidth - vp.clientWidth, sl: vp.scrollLeft, i: best, seen: seen, vis: vis, n: list.length };
      }
      var state = null;
      function write(st) {
        if (st.hidden) return;
        state = st;
        var still = st.max <= 1;
        root.classList.toggle('is-static', still);
        if (still) { vp.removeAttribute('tabindex'); vp.removeAttribute('role'); vp.removeAttribute('aria-label'); vp.removeAttribute('aria-labelledby'); }
        else if (!vp.hasAttribute('tabindex')) { vp.tabIndex = 0; vp.setAttribute('role', 'group'); nameLike(vp, root); }
        if (prev) prev.setAttribute('aria-disabled', String(st.sl <= 1));
        if (next) next.setAttribute('aria-disabled', String(st.sl >= st.max - 1));
        buildDots();
        if (count) {
          var a = st.seen.length ? st.seen[0] : st.i, z = st.seen.length ? st.seen[st.seen.length - 1] : st.i;
          if (st.sl >= st.max - 1 && st.seen.length) z = st.seen[st.seen.length - 1];
          var txt = (a === z ? (a + 1) : (a + 1) + '–' + (z + 1)) + '/' + st.n;
          if (count.textContent !== txt) count.textContent = txt;
        }
        dots.forEach(function (d, k) { var on = st.seen.length ? (st.sl >= st.max - 1 ? k === st.seen[st.seen.length - 1] : k === st.seen[0]) : k === st.i; d.setAttribute('aria-current', String(on)); });
        var lead = st.seen.length ? st.seen[0] : st.i;
        picks.forEach(function (b, k) {
          var on = String(k === lead); if (b.getAttribute('aria-current') === on) return;
          b.setAttribute('aria-current', on);
          var row = b.parentElement;
          if (on === 'true' && row.scrollWidth > row.clientWidth + 1) row.scrollTo({ left: Math.max(0, b.offsetLeft - (row.clientWidth - b.offsetWidth) / 2), behavior: reduce.matches ? 'auto' : 'smooth' });
        });
        // only the links and buttons of the cards in view are reachable by Tab: the others leave the tab order until they
        // arrive. data-ci marks what this row changed, so a tabindex another script owns (data-rm-off: a Read more with
        // nothing to read) is never undone here. An opened review's scroll area stays focusable wherever it is (a
        // scrollable region must be: WCAG 2.1.1); focusing it brings its card into view.
        items().forEach(function (it, k) { $$('a, button', it).forEach(function (el) {
          var ci = el.getAttribute('data-ci');
          if (st.vis[k]) { if (ci === '1') { el.removeAttribute('data-ci'); if (!el.hasAttribute('data-rm-off')) el.removeAttribute('tabindex'); } }
          else if (ci === null && !el.hasAttribute('tabindex')) { el.tabIndex = -1; el.setAttribute('data-ci', '1'); }
        }); });
      }
      var update = function () { batch(root, read, write); };
      // the counter is announced once the row settles after the visitor moves it (not at load, not on every frame)
      var live = null, said = '', settle = 0;
      if (count) { live = document.createElement('p'); live.className = 'visually-hidden'; live.setAttribute('role', 'status'); root.appendChild(live); said = count.textContent; }
      var announce = function () { clearTimeout(settle); settle = setTimeout(function () { if (live && count.textContent !== said) { said = count.textContent; live.textContent = said; } }, 300); };
      var page = function (dir) {
        var st = state || read(); var per = Math.max(1, st.seen.length || 1);
        var lead = st.seen.length ? st.seen[0] : st.i;
        go(dir > 0 ? lead + per : lead - per);
      };
      if (prev) prev.addEventListener('click', function () { if (prev.getAttribute('aria-disabled') !== 'true') page(-1); });
      if (next) next.addEventListener('click', function () { if (next.getAttribute('aria-disabled') !== 'true') page(1); });
      vp.addEventListener('keydown', function (e) {
        if (e.target !== vp) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); var st = state || read(); go((st.seen.length ? st.seen[0] : st.i) + (e.key === 'ArrowRight' ? 1 : -1)); }
        else if (e.key === 'Home') { e.preventDefault(); go(0); } else if (e.key === 'End') { e.preventDefault(); go(items().length - 1); }
      });
      vp.addEventListener('scroll', function () { update(); announce(); }, { passive: true });
      if ('ResizeObserver' in window) new ResizeObserver(update).observe(vp);
      window.addEventListener('load', update);
      document.addEventListener('readmore:change', update);
      update();
      requestAnimationFrame(function () { requestAnimationFrame(function () { if (count) said = count.textContent; }); });
    });
  }

  /* ------------------------------------------- read more: a fixed card height, the rest opens inside the card */
  function initReadMore() {
    $$('[data-readmore]').forEach(function (root) {
      var text = $('.readmore__text', root), btn = $('.readmore__btn', root), label = btn && $('.readmore__label', btn);
      if (!text || !btn) return;
      var more = btn.getAttribute('data-more'), less = btn.getAttribute('data-less');
      var check = function () {
        batch(root, function () {
          var collapsed = root.getAttribute('data-collapsed') !== 'false';
          return { long: collapsed ? text.scrollHeight > text.clientHeight + 2 : true, collapsed: collapsed };
        }, function (st) {
          var was = root.getAttribute('data-long');
          if (st.collapsed) root.setAttribute('data-long', String(st.long));
          btn.hidden = false;
          // a Read more with nothing more to read leaves the tab order (data-rm-off marks that this script did it)
          if (!st.long && st.collapsed) { btn.setAttribute('aria-hidden', 'true'); btn.tabIndex = -1; btn.setAttribute('data-rm-off', ''); }
          else { btn.removeAttribute('aria-hidden'); if (btn.hasAttribute('data-rm-off')) { btn.removeAttribute('data-rm-off'); if (btn.getAttribute('data-ci') !== '1') btn.removeAttribute('tabindex'); } }
          if (was !== root.getAttribute('data-long')) document.dispatchEvent(new CustomEvent('readmore:change'));
        });
      };
      btn.addEventListener('click', function () {
        var open = root.getAttribute('data-collapsed') !== 'false';
        root.setAttribute('data-collapsed', String(!open));
        btn.setAttribute('aria-expanded', String(open));
        if (label) label.textContent = open ? less : more;
        if (!open) text.scrollTop = 0;
        if (open) { text.setAttribute('tabindex', '0'); text.setAttribute('role', 'region'); text.setAttribute('aria-labelledby', btn.getAttribute('aria-describedby') || ''); } else { text.removeAttribute('tabindex'); text.removeAttribute('role'); text.removeAttribute('aria-labelledby'); }
        document.dispatchEvent(new CustomEvent('readmore:change'));
      });
      if ('ResizeObserver' in window) new ResizeObserver(check).observe(text);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(check);
      window.addEventListener('load', check);
      check();
    });
  }

  /* -------------------- internal scroll areas announce that they overflow */
  function initScrollHints() {
    var areas = $$('[data-scrolly]');
    var check = function (el) {
      batch(el, function () { return { over: el.scrollHeight > el.clientHeight + 1, end: el.scrollTop + el.clientHeight >= el.scrollHeight - 2 }; }, function (st) {
        el.setAttribute('data-overflow', String(st.over));
        el.setAttribute('data-at-end', String(st.end));
        if (st.over) { if (!el.hasAttribute('tabindex')) { el.tabIndex = 0; el.setAttribute('role', 'region'); nameLike(el, el.closest('[aria-labelledby], [aria-label]')); } }
        else if (el.getAttribute('tabindex') === '0' && !el.hasAttribute('data-keep-tab')) { el.removeAttribute('tabindex'); el.removeAttribute('role'); el.removeAttribute('aria-labelledby'); el.removeAttribute('aria-label'); }
      });
    };
    var all = function () { areas.forEach(check); };
    areas.forEach(function (el) { el.addEventListener('scroll', function () { check(el); }, { passive: true }); if ('ResizeObserver' in window) new ResizeObserver(all).observe(el); });
    document.addEventListener('toggle', function () { setTimeout(all, 30); }, true);
    window.addEventListener('load', all); window.addEventListener('resize', all);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(all);
    all();
  }

  /* ----------------------------------------- accordion: one open at a time */
  function initAccordions() {
    document.addEventListener('toggle', function (e) {
      var d = e.target;
      if (!d || d.tagName !== 'DETAILS' || !d.open) return;
      var scope = d.closest('[data-accordion]'); if (!scope) return;
      $$('details[open]', scope).forEach(function (o) { if (o !== d) o.open = false; });
    }, true);
  }

  /* ------------------------- sections: entrance once in view; a section whose content outgrows its screen (a visitor's
     own text size or spacing) grows to fit instead of cutting anything off */
  var guard = function (s) {
    var inner = $('.slide__inner', s) || s;
    batch(s, function () { var mh = parseFloat(getComputedStyle(s).minHeight) || 0; return { over: inner.scrollHeight > Math.max(mh, inner.clientHeight) + 2 || (s.classList.contains('is-overflowing') && inner.scrollHeight > mh + 2) }; },
      function (st) { s.classList.toggle('is-overflowing', st.over); });
  };
  function initSlides() {
    var slides = $$('.slide'), onScreen = new Set();
    var recheck = function () { onScreen.forEach(guard); };
    if (!('IntersectionObserver' in window)) { slides.forEach(function (s) { s.classList.add('is-seen'); onScreen.add(s); }); setTimeout(recheck, 900); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-seen'); onScreen.add(e.target); setTimeout(function () { guard(e.target); }, reduce.matches ? 60 : 900); }
        else onScreen.delete(e.target);
      });
    }, { threshold: .08 });
    slides.forEach(function (s) { io.observe(s); });
    window.addEventListener('resize', raf(recheck));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(recheck);
  }

  /* the tickers' pause toggle (WCAG 2.2.2), remembered in this browser. The control is the hero's ticker band itself
     (owner: no pause/play button): this script makes it a toggle button (role, tab stop, its label, aria-pressed) that a
     tap, a click, Enter or Space flips. Where motion is reduced nothing moves, so the band stays plain decoration (and
     follows the setting if it changes); without scripts it is plain decoration too */
  function initMotion() {
    var bands = $$('[data-motion-toggle]'); if (!bands.length) return;
    var KEY = 'pitstop-motion';
    var still = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var set = function (paused) { document.documentElement.setAttribute('data-motion', paused ? 'paused' : 'on'); bands.forEach(function (b) { if (b.hasAttribute('role')) b.setAttribute('aria-pressed', String(paused)); }); };
    var arm = function () {
      var live = !(still && still.matches);
      bands.forEach(function (b) {
        if (live) { b.setAttribute('role', 'button'); b.tabIndex = 0; b.setAttribute('aria-label', b.getAttribute('data-label')); }
        else ['role', 'tabindex', 'aria-label', 'aria-pressed'].forEach(function (a) { b.removeAttribute(a); });
      });
      set(store.get(KEY) === 'paused');
    };
    bands.forEach(function (b) {
      var flip = function () { if (!b.hasAttribute('role')) return; var p = b.getAttribute('aria-pressed') !== 'true'; set(p); store.set(KEY, p ? 'paused' : 'on'); };
      b.addEventListener('click', flip);
      b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
    });
    arm();
    if (still) { if (still.addEventListener) still.addEventListener('change', arm); else if (still.addListener) still.addListener(arm); }
  }

  /* focus never rests under the sticky header or the phone's ORDER NOW / CONTACT US dock (WCAG 2.4.11). The scroll
     margins in base.css apply when the browser scrolls a focused element in, but it does not scroll for one it counts as
     in view, and its scroll for a text field ignores the margins (the field lands on the bottom edge). So, one frame after
     focus: an element on screen that sits partly under the dock or the header is brought clear (the margins decide how
     far); one still off screen is being scrolled in by the browser, and is checked once that scroll ends. One correction
     per focus, so a reader's own scrolling is never fought. An open dialog (the page locked), the header's and the dock's
     own controls, and anything taller than the gap are left alone */
  function initFocusClear() {
    var head = $('.site-header'), dock = $('[data-dock]'), pending = null;
    var clear = function (el) {
      if (!el || el !== document.activeElement || document.body.classList.contains('is-locked')) return;
      var r = el.getBoundingClientRect();
      var top = head ? Math.max(0, head.getBoundingClientRect().bottom) : 0;
      var shown = dock && !dock.classList.contains('is-off') && window.getComputedStyle(dock).display !== 'none';
      var bottom = shown ? dock.getBoundingClientRect().top : window.innerHeight;
      if (r.height > bottom - top) return;
      if (r.top < top || r.bottom > bottom) el.scrollIntoView({ block: 'nearest' });
    };
    var later = function () { var el = pending; pending = null; if (el) clear(el); };
    document.addEventListener('focusin', function (e) {
      var el = e.target;
      pending = null;
      if (!el || el === document.body || !el.getBoundingClientRect) return;
      if ((head && head.contains(el)) || (dock && dock.contains(el))) return;
      requestAnimationFrame(function () {
        var r = el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < window.innerHeight) { clear(el); return; }
        pending = el;
        setTimeout(function () { if (pending === el) later(); }, 900);
      });
    });
    window.addEventListener('scrollend', later);
  }

  var boot = function () {
    // (a hero painted before this runs carries .hero-shown: the head script marks the first painted frame when it comes
    // before reveal-on, and 01-hero.css then skips the entrance, so a seen hero never blanks and replays)
    document.documentElement.classList.add('reveal-on');
    [initHeader, initNav, initMenu, initLocator, initPopups, initCarousels, initReadMore, initScrollHints, initAccordions, initSlides, initMotion, initFocusClear, initAgeGate]
      .forEach(function (fn) { var t0 = performance.now(); try { fn(); } catch (err) { if (window.console) console.error('[pitstop] ' + fn.name + ' failed', err); } boot.ms[fn.name] = Math.round(performance.now() - t0); });
    document.documentElement.classList.add('is-ready');
  };
  boot.ms = {};
  window.__pitstopBoot = boot.ms;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
