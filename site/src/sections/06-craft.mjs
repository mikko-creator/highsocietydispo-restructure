// 06-craft.mjs — Where Cannabis Meets Craftmanship, in the reskin's own two bands folded into one screen (owner,
// 2026-10-21: restyle every section in the reskin's visual language). The reskin's ink split: the HS logo art huge in
// white on the bare ink ground, the race number and the giant title, the paragraph (soft white, line-height 1.6) and
// the red "learn more" (About). Then its product panel, in its white/cream language: the checkered strip along the top,
// the product photo alone on white, then the cream foot (the reskin's #iz3lr) that holds the red trophy roundel and the
// second "learn more" (the Menu) under the reskin's short red rule (the roundel is drawn by CSS: decoration).
// The owner's layout E (2026-10-22, "Bento", 06-craft.css): every part in its own rounded tile of one grid. Desktop
// (landscape from 768px): the title tile across the top left, the HS art tile and the copy tile (paragraph, About)
// under it, the product panel the tallest tile down the right; both links on one bottom line. Phones and portrait
// tablets: the title tile, the paragraph tile, the art and the product photo side by side, the two links side by side
// at the bottom (thumb half). The copy block and the panel are display: contents there, so their parts take the phone
// grid's own rows; one markup.
// DECLARED: the reskin shows the product photo twice (same file, alt ""): shown once. Slot i4epo stays where the
// reskin had it: in the panel's cream cell, just before the Menu link.
// The two links share one visible label, the reskin's "learn more" (the wording is open owner decision 4). Contract §2:
// each gets aria-describedby pointing at the element that names it, adding no words: the header's own nav link with
// the same destination ("About Us" for about/index.html, "Menu" for {{location_shop_url}}), id nav-link-<slug of its
// text> (00-chrome.mjs). Sighted visitors get a second cue besides fill: the arrow on About, the shopping bag on the
// Menu (the shop).

export const meta = { id: 'craft', order: 6, label: 'Where Cannabis Meets Craftmanship' };

export function render(c, h) {
  const C = c.craft;
  const photo = C.photos[0];
  const navId = (href) => {
    const n = c.header.nav.find((x) => !x.sub && x.href === href);
    return n ? `nav-link-${h.slug(n.text)}` : false;
  };
  return `
<section class="slide theme-black craft" id="${meta.id}" aria-labelledby="craft-h" data-slide="${meta.order}">
  <div class="slide__inner craft__inner">
    <header class="slide__head craft__head reveal">
      <div class="head__copy">
        <span class="secnum" aria-hidden="true"></span>
        ${h.title(C.title, { id: 'craft-h', cls: 'craft__title' })}
      </div>
    </header>
    <div class="craft__copy">
      <p class="craft__text reveal" style="--i:1">${h.esc(C.text)}</p>
      <a class="btn btn--primary btn--lg craft__about reveal" style="--i:2" href="${h.esc(h.href(C.about.href))}"${h.attrs({ 'aria-describedby': navId(C.about.href) })}>${h.esc(C.about.text)}${h.icon('arrow', { size: 18 })}</a>
    </div>
    <div class="craft__art reveal" style="--i:1">
      ${h.picture(C.logo.src, C.logoMobile.src, { alt: C.logo.alt, cls: 'craft__logo', sizes: '(min-width: 1024px) 260px, 34vw', mobileSizes: '45vw' })}
    </div>
    <div class="craft__panel">
      <div class="craft__shot reveal" style="--i:2">
        ${h.img(photo.src, { alt: photo.alt, cls: 'craft__photo', sizes: '(min-width: 1180px) 360px, (min-width: 768px) 30vw, 50vw' })}
      </div>
      <div class="craft__side reveal" style="--i:3">
        ${h.slot('i4epo')}
        <a class="btn btn--ghost btn--lg craft__menu" href="${h.esc(h.href(C.menu.href))}"${h.attrs({ 'aria-describedby': navId(C.menu.href) })}>${h.esc(C.menu.text)}${h.icon('bag', { size: 18 })}</a>
      </div>
    </div>
  </div>
</section>`;
}
