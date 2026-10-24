// 09-footer.mjs — the page footer (contentinfo), in the reskin's own footer language (RESKIN-STYLE row 9).
// Top edge: the reskin's red rolling store-name band (the kit's .ticker--band: the eight store names from the header's
// Locations menu with the white trophy mark between them, decoration, aria-hidden). Below, on ink: the keyline lockup
// (the reskin's footer logo, at least its 190px web minimum; the reskin's red mark-and-rule under it is not drawn, owner
// 2026-10-22), "Quick Links",
// "Locations", "Your Store" (the CMS writes the chosen store into the empty slot ieb8f) as columns under small red labels
// on hairlines; then the reskin's checkered strip (its empty spacer slot i2vvf stays just before it) above the bottom
// row: the copyright and the two legal lines as text (they have no destinations on the page). Behind it all, the
// reskin's own trophy mark, huge and faint (4.5%), in the background layer.
// Every word comes from home.json (c.footer, the store names from c.header.nav); no words are added.

export const meta = { id: 'footer', order: 9, label: 'Footer' };

export function render(c, h) {
  const F = c.footer;
  const names = c.header.nav.find((n) => n.sub).sub.map((s) => s.text);
  // one run carries the eight names twice, so a run is wider than any screen and the loop never shows a gap; the track
  // holds the run twice and slides by half its width (the kit's .ticker)
  const run = [...names, ...names].map((n) => `<span class="ticker__name">${h.esc(n)}</span><i class="ticker__mark"></i>`).join('');
  const links = (list) => list.map((l) => `<li><a href="${h.esc(h.href(l.href))}">${h.esc(l.text)}</a></li>`).join('\n        ');
  // the bottom row's lines wrap only between their own parts (after a "|" separator, or after the copyright's first
  // sentence), never inside one: each part is a span (CSS: nowrap); the parts rejoin with the spaces they were split
  // at, so the text is the content's string unchanged
  const runs = (s) => s.split(/(?<=[.|]) /).map((p) => `<span>${h.esc(p)}</span>`).join(' ');
  return `
<footer class="slide slide--natural theme-black footer" id="${meta.id}" data-slide="${meta.order}">
  <div class="slide__bg footer__bg" aria-hidden="true"></div>
  <div class="ticker ticker--band footer__band" aria-hidden="true" data-edge-band><div class="ticker__track"><div class="ticker__run">${run}</div><div class="ticker__run">${run}</div></div></div>
  <div class="slide__inner footer__inner">
    <div class="footer__brand reveal">
      <a class="footer__logo" href="${h.esc(h.href(F.logo.href))}">${h.img(F.logo.src, { alt: F.logo.alt, cls: 'footer__lockup' })}</a>
    </div>
    <nav class="footer__group footer__quick reveal" style="--i:1" aria-labelledby="footer-quick-h">
      <h2 class="footer__title" id="footer-quick-h">${h.esc(F.quick.title)}</h2>
      <ul class="footer__links footer__links--quick">
        ${links(F.quick.links)}
      </ul>
    </nav>
    <nav class="footer__group footer__locs reveal" style="--i:2" aria-labelledby="footer-locs-h">
      <h2 class="footer__title" id="footer-locs-h">${h.esc(F.locations.title)}</h2>
      <ul class="footer__links footer__links--locs">
        ${links(F.locations.links)}
      </ul>
    </nav>
    <div class="footer__group footer__store reveal" style="--i:3">
      <h2 class="footer__title" id="footer-store-h">${h.esc(F.store.title)}</h2>
      ${h.slot('ieb8f')}
    </div>
    <div class="footer__base">
      ${h.slot('i2vvf')}
      <div class="checker footer__checker" aria-hidden="true"></div>
      <div class="footer__legal">
        <p class="footer__copy">${runs(F.copyright)}</p>
        <div class="footer__terms">
          <p class="footer__line">${runs(F.legal)}</p>
          <p class="footer__line">${runs(F.company)}</p>
        </div>
      </div>
    </div>
  </div>
</footer>`;
}
