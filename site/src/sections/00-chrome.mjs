// 00-chrome.mjs — the page chrome: skip link, the sticky header (logo, desktop nav with the Locations dropdown,
// "Select a Location" + "Join The Society"; phones and tablets: the lockup, "Select Location" (on phones its pin, the
// words its name), the menu button),
// the phone/tablet menu overlay (Locations as an accordion), the store chooser ("Select Location": a modal on desktop,
// a bottom sheet on phones), the age gate, the ORDER NOW / CONTACT US action bar, the empty CMS slots and popups.
// Every word comes from home.json (the reskin page); the only added words are c.ui labels.

export const meta = { id: 'chrome', order: 0, label: 'Header and navigation' };

export function render(c, h) {
  const H = c.header;
  const logoAlt = H.logo.alt;
  // the horizontal web lockup at every width (owner, 2026-10-22: on mobile the lockup instead of the round trophy mark):
  // 190px from 1180px, below that as large as the 64px bar holds it with its clear space (base.css)
  const logo = (cls = '') => `<a class="logo ${cls}" href="${h.href(H.logo.href)}">${h.img('assets/pit-stop/logo/b-horizontal-web-keyline.svg', { alt: logoAlt, eager: true })}</a>`;
  const locNav = H.nav.find((n) => n.sub);
  // the desktop links carry ids (the overlay's copies do not, so ids stay unique): the craft section's two "learn more"
  // links are described by the About Us and Menu items
  const navLink = (n, id) => {
    // the reskin's "Deals" item points at "#": here it takes the visitor to the page's own DEALS section
    const href = n.text === 'Deals' && n.href === '#' ? '#deals' : n.href;
    return `<a class="nav__link"${id ? ` id="${id}"` : ''} href="${h.esc(h.href(href))}">${h.esc(n.text)}</a>`;
  };
  const navId = (n) => 'nav-link-' + h.slug(n.text);
  const navItems = H.nav.map((n) => n.sub
    ? `<li class="nav__item nav__item--sub">${navLink(n, navId(n))}<button class="nav__caret" type="button" aria-expanded="false" aria-controls="nav-sub-locations" aria-label="${h.esc(c.ui.toggleLocations)}">${h.icon('chevron', { size: 18 })}</button>
        <ul class="nav__sub" id="nav-sub-locations">${n.sub.map((s) => `<li><a href="${h.esc(h.href(s.href))}">${h.esc(s.text)}</a></li>`).join('')}</ul></li>`
    : `<li class="nav__item">${navLink(n, navId(n))}</li>`).join('\n        ');

  const header = `<a class="skip" href="${h.esc(c.skip.href)}">${h.esc(c.skip.text)}</a>
<header class="site-header theme-black" id="masterhead">
  <div class="bar__inner">
    ${logo()}
    <nav class="nav">
      <ul class="nav__list">
        ${navItems}
      </ul>
    </nav>
    <div class="bar__actions">
      <a class="btn btn--ghost btn--sm" href="${h.esc(H.selectA.href)}" data-locator-open aria-haspopup="dialog">${h.icon('pin', { size: 18 })}${h.esc(H.selectA.text)}</a>
      <a class="btn btn--primary btn--sm" href="${h.esc(h.href(H.join.href))}">${h.esc(H.join.text)}</a>
    </div>
    <div class="bar__tools">
      <a class="btn btn--ghost btn--sm bar__locate" href="${h.esc(H.selectShort.href)}" data-locator-open aria-haspopup="dialog">${h.icon('pin', { size: 18 })}<span class="bar__locate-label">${h.esc(H.selectShort.text)}</span></a>
      <a class="iconbtn" href="#mmenu" role="button" data-menu-open aria-controls="mmenu" aria-expanded="false" aria-label="${h.esc(H.burgerAria)}">${h.icon('menu', { size: 22 })}</a>
    </div>
  </div>
  <div class="progress" aria-hidden="true"><span></span></div>
</header>`;

  // phone + tablet menu: the same items, Locations as an accordion, the two header actions at the foot
  const mItems = H.nav.map((n) => n.sub
    ? `<li class="mmenu__item"><div class="mmenu__row">${navLink(n).replace('nav__link', 'mmenu__link')}<button class="mmenu__toggle" type="button" aria-expanded="false" aria-controls="mmenu-sub-locations" aria-label="${h.esc(c.ui.toggleLocations)}">${h.icon('chevron', { size: 20 })}</button></div>
        <ul class="mmenu__sub" id="mmenu-sub-locations">${n.sub.map((s) => `<li><a href="${h.esc(h.href(s.href))}">${h.esc(s.text)}</a></li>`).join('')}</ul></li>`
    : `<li class="mmenu__item">${navLink(n).replace('nav__link', 'mmenu__link')}</li>`).join('\n      ');
  // the close control is a link so the overlay (a :target without scripts) can still be left: it leads to the page's
  // main content, a real anchor (site.js closes the overlay in place)
  const mmenu = `<div class="mmenu theme-black" id="mmenu" role="dialog" aria-modal="true" aria-label="${h.esc(H.mobileNavAria)}">
  <div class="mmenu__top">${logo('logo--menu')}<a class="dialog__close" href="#main-inner" role="button" data-menu-close>${h.icon('close', { size: 18 })}${h.esc(c.ui.close)}</a></div>
  <div class="mmenu__body">
    <ul class="mmenu__list">
      ${mItems}
    </ul>
    <div class="mmenu__actions">
      <a class="btn btn--ghost btn--block" href="${h.esc(H.selectA.href)}" data-locator-open aria-haspopup="dialog">${h.icon('pin', { size: 18 })}${h.esc(H.selectA.text)}</a>
      <a class="btn btn--primary btn--block" href="${h.esc(h.href(H.join.href))}">${h.esc(H.join.text)}</a>
    </div>
  </div>
</div>`;

  // the store chooser: the eight stores exactly as the reskin's popup states them (its own addresses and phones)
  const L = c.locator;
  const store = (s, i) => `<li class="store">
        <h3 class="store__name" id="store-${i}">${h.esc(s.name)}</h3>
        <p class="store__addr">${s.address.map(h.esc).join('<br>')}</p>
        <a class="store__phone" href="${h.esc(s.phone.href)}">${h.icon('phone', { size: 18 })}${h.esc(s.phone.text)}</a>
        <div class="store__ctas">
          ${['select', 'shop', 'view'].filter((k) => s[k]).map((k, n) => `<a class="btn ${n ? 'btn--ghost' : 'btn--primary'} btn--sm" href="${h.esc(h.href(s[k].href))}" aria-describedby="store-${i}">${h.esc(s[k].text)}</a>`).join('\n          ')}
        </div>
      </li>`;
  const locator = `<div class="dialog dialog--sheet" id="dispenzaLocationPopup-open" role="dialog" aria-modal="true" aria-label="${h.esc(L.aria)}">
  <div class="dialog__panel theme-black">
    <div class="dialog__head"><h2 class="dialog__title" id="locator-title">${h.esc(L.title)}</h2><button class="dialog__close" type="button" data-dialog-close aria-label="${h.esc(L.closeAria)}">${h.icon('close', { size: 18 })}${h.esc(c.ui.close)}</button></div>
    <div class="dialog__body" data-dialog-scroll>
      <ul class="stores">
      ${L.stores.map(store).join('\n      ')}
      </ul>
    </div>
  </div>
</div>`;

  // the age gate (shown by site.js until the visitor answers; without scripts the page is never blocked)
  const A = c.ageGate;
  // the reskin's gate: its race-day cover behind (the hero's own <picture>, same sources and sizes, so the browser reuses
  // the file the hero loads), the reskin's scrim, the ink panel in front
  const agegatePhoto = h.picture('assets/pit-stop/img/hero-pit-wall.jpg', 'derived:owner-hero-mobile', { media: '(min-width: 768px), (orientation: landscape)', alt: '', cls: 'agegate__photo', sizes: 'max(100vw, calc(100vh * 2.34))', mobileSizes: '100vw', eager: true });
  const agegate = `<div class="dialog agegate" id="agegate" role="dialog" aria-modal="true" aria-label="${h.esc(A.aria)}" aria-describedby="agegate-title" hidden>
  <div class="agegate__bg" aria-hidden="true">${agegatePhoto}<div class="agegate__scrim"></div></div>
  <div class="dialog__panel theme-black">
    <div class="agegate__inner" tabindex="-1">
      <a class="agegate__logo" href="${h.esc(A.logo.href)}" aria-label="${h.esc(A.logo.aria)}">${h.img('assets/pit-stop/logo/b-horizontal-web-keyline.svg', { alt: A.logo.alt, eager: true })}</a>
      <h2 class="agegate__title" id="agegate-title">${h.esc(A.title)}</h2>
      ${A.lines.map((l) => `<p class="agegate__text">${h.esc(l)}</p>`).join('\n      ')}
      <div class="agegate__actions">
        <a class="btn btn--primary btn--lg" href="${h.esc(A.yes.href)}" role="button" data-age-yes>${h.esc(A.yes.text)}</a>
        <a class="btn btn--ghost btn--lg" href="${h.esc(A.no.href)}" role="button" data-age-no data-redirect="${h.esc(A.no.redirect)}">${h.esc(A.no.text)}</a>
      </div>
    </div>
  </div>
</div>`;

  const dock = `<div class="dock theme-black" data-dock>
  ${c.sticky.map((b, i) => `<a class="btn ${i ? 'btn--ghost' : 'btn--primary'}" href="${h.esc(h.href(b.href))}">${h.esc(b.text)}</a>`).join('\n  ')}
</div>`;

  // the CMS's AJAX popups (empty in the page as served): kept for the CMS, never drawn while empty
  const popups = c.popups.map((p) => `<div class="sgpopup cms-popup ${p.cls.join(' ')}" id="${h.esc(p.id)}" role="dialog" aria-label="${h.esc(p.aria)}" hidden>${p.title ? `<h4 class="sgpopup-title">${h.esc(p.title)}</h4>` : ''}</div>`).join('\n');

  return { header, mainStart: h.slot('ikjs2') + h.slot('is209'), after: [mmenu, locator, agegate, dock, popups].join('\n') };
}
