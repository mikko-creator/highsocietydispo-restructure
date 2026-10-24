// footer.mjs — the page footer of EVERY page (core lane; replaces v2's src/sections/09-footer.mjs in the build).
// v2's footer, its design and every one of its words (home.json footer): the red rolling store-name band, the keyline
// lockup, "Quick Links", "Locations", "Your Store" (the empty CMS slot ieb8f), the checkered strip (slot i2vvf just
// before it), the copyright and the two legal lines. Added for the multi-page site (site.json.ia.footer): the link groups in
// ia.footer.groups (Resources, Company), Quick Links' links from ia.footer.quick (each link appears once in the footer:
// v2's About Us, Contact Us and Careers moved to Company) and "All Locations" under Locations; in the legal line
// "Privacy Statement" and "Terms of Service" link to their pages (the other parts stay text, as in v2). v2's
// 09-footer.css styles it; chrome.css lays out the added columns.
//
//   renderFooter({ site, home, h, takenIds }) -> html    takenIds: ids already used on the page (the header's)

export function renderFooter({ site, home: c, h, takenIds = new Set() }) {
  const F = c.footer, IA = site.ia.footer, esc = h.esc;
  const names = c.header.nav.find((n) => n.sub).sub.map((s) => s.text);
  // one run carries the eight names twice, so a run is wider than any screen and the loop never shows a gap (v2)
  const run = [...names, ...names].map((n) => `<span class="ticker__name">${esc(n)}</span><i class="ticker__mark"></i>`).join('');
  // v2's header words that left the bar (About Us, Contact Us) keep their v2 ids on their footer links, so the craft
  // section's aria-describedby still names them
  const v2Ids = new Map(c.header.nav.filter((n) => !n.sub).map((n) => [n.text, 'nav-link-' + h.slug(n.text)]));
  const used = new Set(takenIds);
  const idFor = (text) => { const id = v2Ids.get(text); if (!id || used.has(id)) return false; used.add(id); return id; };
  const links = (list, cls = '') => list.map((l) => `<li><a${h.attrs({ class: cls || false, id: idFor(l.text), href: h.href(l.href) })}>${esc(l.text)}</a></li>`).join('\n        ');

  // the bottom row's lines wrap only between their own parts (v2); a part named in legalLinks is a link
  const runs = (s, linked = {}) => s.split(/(?<=[.|]) /).map((p) => {
    const m = /^(.*?)( \|)?$/.exec(p), label = m[1], sep = m[2] || '';
    const inner = linked[label] ? `<a href="${esc(h.href(linked[label]))}">${esc(label)}</a>` : esc(label);
    return `<span>${inner}${esc(sep)}</span>`;
  }).join(' ');

  const group = (id, title, list, extraCls = '') => `<nav class="footer__group footer__${id}${extraCls} reveal" aria-labelledby="footer-${id}-h">
      <h2 class="footer__title" id="footer-${id}-h">${esc(title)}</h2>
      <ul class="footer__links footer__links--${id}">
        ${links(list)}
      </ul>
    </nav>`;
  // Quick Links keeps v2's title; its links come from site.json ia.footer.quick when set, so that no link repeats in
  // the added groups (CORE-VERIFY L6)
  const quickLinks = (IA.quick && IA.quick.links) || F.quick.links;

  return `
<footer class="slide slide--natural theme-black footer footer--ia" id="footer" data-slide="9">
  <div class="slide__bg footer__bg" aria-hidden="true"></div>
  <div class="ticker ticker--band footer__band" aria-hidden="true" data-edge-band><div class="ticker__track"><div class="ticker__run">${run}</div><div class="ticker__run">${run}</div></div></div>
  <div class="slide__inner footer__inner">
    <div class="footer__brand reveal">
      <a class="footer__logo" href="${esc(h.href(F.logo.href))}">${h.img(F.logo.src, { alt: F.logo.alt, cls: 'footer__lockup' })}</a>
      <div class="footer__group footer__store">
        <h2 class="footer__title" id="footer-store-h">${esc(F.store.title)}</h2>
        ${h.slot('ieb8f')}
      </div>
    </div>
    ${group('quick', F.quick.title, quickLinks)}
    ${IA.groups.map((g) => group(g.id, g.title, g.links, ' footer__ia')).join('\n    ')}
    ${group('locs', F.locations.title, [...F.locations.links, ...IA.locationsExtra])}
    <div class="footer__base">
      ${h.slot('i2vvf')}
      <div class="checker footer__checker" aria-hidden="true"></div>
      <div class="footer__legal">
        <p class="footer__copy">${runs(F.copyright)}</p>
        <div class="footer__terms">
          <p class="footer__line">${runs(F.legal, IA.legalLinks)}</p>
          <p class="footer__line">${runs(F.company)}</p>
        </div>
      </div>
    </div>
  </div>
</footer>`;
}
