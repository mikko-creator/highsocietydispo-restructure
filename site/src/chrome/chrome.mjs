// chrome.mjs — the page chrome of EVERY page (core lane; replaces v2's src/sections/00-chrome.mjs in the build).
// The header follows the multi-page information architecture in site.json.ia, drawn in the v2 Pit Stop language:
//   1. the promo strip (red): High Society's line + a link to /deals/; from the desktop switch also the store bar
//      ("Pick up at" + v2's "Select a Location" chooser trigger) and the site search (a GET form to /search/, q)
//   2. the v2 bar: the lockup, the main nav (Menu, Explore, Loyalty, Deals, Resources, Locations: three of them open
//      mega panels), "Join The Society"; phones and tablets keep v2's "Select Location" pin and the menu button
//   3. the category bar (desktop): Deals + the shop categories
// Scrolled past the top, the header condenses to the v2 bar alone (site.js: .is-condensed), so v2's section maths
// (--bar-h) holds on every page; over the home's hero the bar stays v2's clear cinematic bar.
// Kept from v2 exactly (their words come from home.json): the skip link, the phone/tablet menu overlay (each mega group
// an accordion there; v2's Contact Us and About Us live there and in the footer), the store chooser, the age gate, the
// ORDER NOW / CONTACT US dock, the CMS popups. Only UI labels come from site.json.ui.
//
//   renderChrome({ site, home, h }) -> { header, after }   (h: the page's helpers, src/lib/h.mjs)

export function renderChrome({ site, home: c, h }) {
  const IA = site.ia, ui = site.ui, H = c.header;
  const esc = h.esc;
  const logo = (cls = '') => `<a class="logo ${cls}" href="${esc(h.href('/'))}">${h.img(H.logo.src, { alt: H.logo.alt, eager: true })}</a>`;
  const link = (l, attrs = {}) => `<a${h.attrs({ href: h.href(l.href), ...attrs })}>${esc(l.text)}</a>`;
  const navId = (text) => 'nav-link-' + h.slug(text);

  // ---- the mega panels (desktop) and their accordion twins (phone menu) ------------------------------------------
  const megaGroup = (g, k) => `<div class="mega__group">
            <p class="mega__title">${esc(g.title)}</p>
            <ul class="mega__links${g.links.length > 6 ? ' mega__links--2' : ''}">${g.links.map((l) => `<li>${link(l, { 'data-shop-category': l.category || false })}</li>`).join('')}</ul>
          </div>`;
  const mega = (n) => `<div class="mega mega--${esc(n.id)}" id="mega-${esc(n.id)}">
          <div class="mega__inner mega__inner--${n.mega.length}">
          ${n.mega.map(megaGroup).join('\n          ')}
          </div>
        </div>`;
  const chev = h.icon('chevron', { size: 16, cls: 'nav__chev' });
  const navItem = (n) => {
    if (!n.mega) return `<li class="nav__item">${link(n, { class: 'nav__link', id: navId(n.text) })}</li>`;
    // a group with a landing page (Locations) keeps v2's link + caret; the others are one button
    const trigger = n.href
      ? `${link(n, { class: 'nav__link', id: navId(n.text) })}<button class="nav__caret" type="button" aria-expanded="false" aria-controls="mega-${esc(n.id)}" aria-label="${esc(n.id === 'locations' ? ui.toggleLocations : ui.showGroup + ' ' + n.text)}">${h.icon('chevron', { size: 18 })}</button>`
      : `<button class="nav__link nav__trigger" id="${navId(n.text)}" type="button" aria-expanded="false" aria-controls="mega-${esc(n.id)}">${esc(n.text)}${chev}</button>`;
    return `<li class="nav__item nav__item--sub nav__item--mega${n.href ? '' : ' nav__item--button'}">${trigger}
        ${mega(n)}</li>`;
  };

  const search = (where) => `<form class="search search--${where}" role="search" action="${esc(h.href(IA.search.action))}" method="get">
      <label class="visually-hidden" for="search-${where}">${esc(ui.searchLabel)}</label>
      <input class="search__input" id="search-${where}" name="${esc(IA.search.name)}" type="search" placeholder="${esc(ui.searchPlaceholder)}" autocomplete="off" enterkeyhint="search">
      <button class="search__go" type="submit" aria-label="${esc(ui.searchSubmit)}">${h.icon('search', { size: 18 })}</button>
    </form>`;

  const P = IA.promo, S = IA.storeBar;
  const util = `<div class="util theme-red">
    <div class="util__inner">
      <p class="util__promo"><span class="util__text">${esc(P.text)}</span> ${link(P.link, { class: 'util__link' })}</p>
      <div class="util__store"><span class="util__label">${esc(S.label)}</span><a class="util__pick" href="${esc(S.trigger.href)}" data-locator-open aria-haspopup="dialog">${h.icon('pin', { size: 16 })}<span>${esc(S.trigger.text)}</span>${h.icon('chevron', { size: 14 })}</a></div>
      ${search('bar')}
    </div>
  </div>`;

  const CB = IA.categoryBar;
  const catbar = `<nav class="catbar" aria-label="${esc(ui.categoriesNav)}">
    <div class="catbar__inner">
      <ul class="catbar__list">
        <li>${link(CB.deals, { class: 'catbar__link catbar__link--deals' })}</li>
        ${CB.items.map((l) => `<li>${link(l, { class: 'catbar__link', 'data-shop-category': l.slug })}</li>`).join('\n        ')}
      </ul>
    </div>
  </nav>`;

  const header = `<a class="skip" href="${esc(c.skip.href)}">${esc(c.skip.text)}</a>
<header class="site-header theme-black" id="masterhead">
  ${util}
  <div class="bar__inner">
    ${logo()}
    <nav class="nav" aria-label="${esc(ui.mainNav)}">
      <ul class="nav__list">
        ${IA.nav.map(navItem).join('\n        ')}
      </ul>
    </nav>
    <div class="bar__actions">
      ${link(IA.join, { class: 'btn btn--primary btn--sm' })}
    </div>
    <div class="bar__tools">
      <a class="btn btn--ghost btn--sm bar__locate" href="${esc(H.selectShort.href)}" data-locator-open aria-haspopup="dialog">${h.icon('pin', { size: 18 })}<span class="bar__locate-label">${esc(H.selectShort.text)}</span></a>
      <a class="iconbtn" href="#mmenu" role="button" data-menu-open aria-controls="mmenu" aria-expanded="false" aria-label="${esc(H.burgerAria)}">${h.icon('menu', { size: 22 })}</a>
    </div>
  </div>
  ${catbar}
  <div class="progress" aria-hidden="true"><span></span></div>
</header>`;

  // ---- phone + tablet menu: v2's overlay; every mega group an accordion; About Us and Contact Us below the groups ----
  const accItem = (n) => {
    const id = 'mmenu-sub-' + n.id;
    const groups = `<div class="mmenu__sub mmenu__groups" id="${id}">${n.mega.map((g) => `<div class="mmenu__group"><p class="mmenu__gtitle">${esc(g.title)}</p><ul class="mmenu__glinks">${g.links.map((l) => `<li>${link(l, { 'data-shop-category': l.category || false })}</li>`).join('')}</ul></div>`).join('')}</div>`;
    if (n.href) {
      return `<li class="mmenu__item"><div class="mmenu__row">${link(n, { class: 'mmenu__link' })}<button class="mmenu__toggle" type="button" aria-expanded="false" aria-controls="${id}" aria-label="${esc(n.id === 'locations' ? ui.toggleLocations : ui.showGroup + ' ' + n.text)}">${h.icon('chevron', { size: 20 })}</button></div>
        ${groups}</li>`;
    }
    return `<li class="mmenu__item"><button class="mmenu__link mmenu__acc" type="button" aria-expanded="false" aria-controls="${id}" data-mmenu-acc>${esc(n.text)}<span class="mmenu__chev">${h.icon('chevron', { size: 20 })}</span></button>
        ${groups}</li>`;
  };
  const mItems = [
    ...IA.nav.map((n) => (n.mega ? accItem(n) : `<li class="mmenu__item">${link(n, { class: 'mmenu__link' })}</li>`)),
    ...IA.phoneExtra.map((l) => `<li class="mmenu__item">${link(l, { class: 'mmenu__link' })}</li>`),
  ].join('\n      ');
  // the close control is a link so the overlay (a :target without scripts) can still be left: it leads to the page's
  // main content, a real anchor (site.js closes the overlay in place)
  const mmenu = `<div class="mmenu theme-black" id="mmenu" role="dialog" aria-modal="true" aria-label="${esc(H.mobileNavAria)}">
  <div class="mmenu__top">${logo('logo--menu')}<a class="dialog__close" href="#main-inner" role="button" data-menu-close>${h.icon('close', { size: 18 })}${esc(c.ui.close)}</a></div>
  <div class="mmenu__body">
    ${search('menu')}
    <ul class="mmenu__list">
      ${mItems}
    </ul>
    <div class="mmenu__actions">
      <a class="btn btn--ghost btn--block" href="${esc(H.selectA.href)}" data-locator-open aria-haspopup="dialog">${h.icon('pin', { size: 18 })}${esc(H.selectA.text)}</a>
      ${link(IA.join, { class: 'btn btn--primary btn--block' })}
    </div>
  </div>
</div>`;

  // ---- the store chooser: the eight stores exactly as the reskin's popup states them (v2, unchanged) ----------------
  const L = c.locator;
  const store = (s, i) => `<li class="store">
        <h3 class="store__name" id="store-${i}">${esc(s.name)}</h3>
        <p class="store__addr">${s.address.map(esc).join('<br>')}</p>
        <a class="store__phone" href="${esc(s.phone.href)}">${h.icon('phone', { size: 18 })}${esc(s.phone.text)}</a>
        <div class="store__ctas">
          ${['select', 'shop', 'view'].filter((k) => s[k]).map((k, n) => `<a class="btn ${n ? 'btn--ghost' : 'btn--primary'} btn--sm" href="${esc(h.href(s[k].href))}" aria-describedby="store-${i}">${esc(s[k].text)}</a>`).join('\n          ')}
        </div>
      </li>`;
  const locator = `<div class="dialog dialog--sheet" id="dispenzaLocationPopup-open" role="dialog" aria-modal="true" aria-label="${esc(L.aria)}">
  <div class="dialog__panel theme-black">
    <div class="dialog__head"><h2 class="dialog__title" id="locator-title">${esc(L.title)}</h2><button class="dialog__close" type="button" data-dialog-close aria-label="${esc(L.closeAria)}">${h.icon('close', { size: 18 })}${esc(c.ui.close)}</button></div>
    <div class="dialog__body" data-dialog-scroll>
      <ul class="stores">
      ${L.stores.map(store).join('\n      ')}
      </ul>
    </div>
  </div>
</div>`;

  // ---- the age gate (v2): shown by site.js until the visitor answers; without scripts the page is never blocked.
  // Its two answers are buttons (v2 drew links to "#yes" / "#no", fragments with no target: the link check's
  // dead-fragment finding); words, classes and data hooks unchanged
  const A = c.ageGate;
  const agegatePhoto = h.picture('assets/pit-stop/img/hero-pit-wall.jpg', 'derived:owner-hero-mobile', { media: '(min-width: 768px), (orientation: landscape)', alt: '', cls: 'agegate__photo', sizes: 'max(100vw, calc(100vh * 2.34))', mobileSizes: '100vw', eager: true });
  const agegate = `<div class="dialog agegate" id="agegate" role="dialog" aria-modal="true" aria-label="${esc(A.aria)}" aria-describedby="agegate-title" hidden>
  <div class="agegate__bg" aria-hidden="true">${agegatePhoto}<div class="agegate__scrim"></div></div>
  <div class="dialog__panel theme-black">
    <div class="agegate__inner" tabindex="-1">
      <a class="agegate__logo" href="${esc(h.href(A.logo.href))}" aria-label="${esc(A.logo.aria)}">${h.img('assets/pit-stop/logo/b-horizontal-web-keyline.svg', { alt: A.logo.alt, eager: true })}</a>
      <h2 class="agegate__title" id="agegate-title">${esc(A.title)}</h2>
      ${A.lines.map((l) => `<p class="agegate__text">${esc(l)}</p>`).join('\n      ')}
      <div class="agegate__actions">
        <button class="btn btn--primary btn--lg" type="button" data-age-yes>${esc(A.yes.text)}</button>
        <button class="btn btn--ghost btn--lg" type="button" data-age-no data-redirect="${esc(A.no.redirect)}">${esc(A.no.text)}</button>
      </div>
    </div>
  </div>
</div>`;

  const dock = `<div class="dock theme-black" data-dock>
  ${c.sticky.map((b, i) => `<a class="btn ${i ? 'btn--ghost' : 'btn--primary'}" href="${esc(h.href(b.href))}">${esc(b.text)}</a>`).join('\n  ')}
</div>`;

  // the CMS's AJAX popups (empty in the page as served): kept for the CMS, never drawn while empty
  const popups = c.popups.map((p) => `<div class="sgpopup cms-popup ${p.cls.join(' ')}" id="${esc(p.id)}" role="dialog" aria-label="${esc(p.aria)}" hidden>${p.title ? `<h4 class="sgpopup-title">${esc(p.title)}</h4>` : ''}</div>`).join('\n');

  return { header, after: [mmenu, locator, agegate, dock, popups].join('\n') };
}
