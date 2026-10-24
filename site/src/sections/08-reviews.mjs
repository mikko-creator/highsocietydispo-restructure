// 08-reviews.mjs — What Our Customers Say About Us. The owner's layout E (2026-10-22, "Ink band", 08-reviews.css): the
// band dark, ink cards, the badge on a white plate, the card growing slightly under a hovering pointer. Before it, the
// reskin's own band: the cream (Headlight) ground, the numbered
// head with the giant title, the "Google Rating" badge bare on the cream and centred under the title (the reskin's soft
// 324x95 raster redrawn as a sharp vector, same words and canvas: src/tools/build-google-badge.py; owner 2026-10-22; its artwork is
// grey type made for a light ground), then the eight reviews, verbatim, as the reskin's white hairline cards with a 3px
// red top rule: the name first in Changa One drawn heavy (the <figcaption>), five red stars (decoration, aria-hidden),
// then the quote in Work Sans ink-grey (a <blockquote> inside the kit's read-more: a fixed card height; "Read more"
// opens the rest inside the same card as a scroll area). A lift and a soft shadow on hover (the kit's light-ground card).
// One carousel at every width: 3 cards a page from 1024px, 2 on tablets, 1 on phones with the next card's peek. The
// arrows + counter sit at the right end of the badge's row from 768px; phones get one thumb row under the card: the
// dots on the left (the position indicator), the 44px arrows + counter on the right (eight 44px dots need 352px, more
// than a phone row holds, so the dots are drawn, not tapped). Short phones lift the badge into the race-number row.
// Every word comes from home.json (c.reviews; NOT titlePhone, a declared duplicate); the only added words are c.ui labels
// and the counter site.js writes.

export const meta = { id: 'reviews', order: 8, label: 'What Our Customers Say About Us' };

export function render(c, h) {
  const R = c.reviews;
  const stars = (n) => `<div class="reviews__stars" aria-hidden="true">${Array.from({ length: n }, () => h.icon('star-solid', { size: 18 })).join('')}</div>`;
  const card = (r, i) => {
    const n = i + 1, nid = `reviews-name-${n}`, tid = `reviews-text-${n}`;
    return `<li class="reviews__item reveal" style="--i:${Math.min(i, 3)}">
          <figure class="reviews__card card card--lift">
            <figcaption class="reviews__name" id="${nid}">${h.esc(r.name)}</figcaption>
            ${stars(r.stars)}
            <div class="readmore reviews__more" data-readmore data-collapsed="true">
              <div class="readmore__text reviews__text" id="${tid}">
                <blockquote class="reviews__quote"><p>${h.esc(r.text)}</p></blockquote>
              </div>
              <button class="readmore__btn reviews__btn" type="button" aria-expanded="false" aria-controls="${tid}" aria-describedby="${nid}" data-more="${h.esc(c.ui.readMore)}" data-less="${h.esc(c.ui.readLess)}"><span class="readmore__label">${h.esc(c.ui.readMore)}</span>${h.icon('chevron', { size: 16 })}</button>
            </div>
          </figure>
        </li>`;
  };
  return `
<section class="slide theme-cream reviews" id="${meta.id}" aria-labelledby="reviews-h" data-slide="${meta.order}">
  <div class="slide__inner">
    <div class="carousel reviews__rail" data-carousel aria-labelledby="reviews-h" data-dot-label="${h.esc(c.ui.goTo)}">
      <header class="slide__head reviews__head">
        <div class="head__copy">
          <span class="secnum" aria-hidden="true"></span>
          <h2 class="title reviews__title" id="reviews-h">${h.esc(R.title)}</h2>
        </div>
      </header>
      <div class="reviews__badge">${h.img('derived:google-rating.svg', { alt: R.badge.alt, cls: 'reviews__rating' })}</div>
      <div class="carousel__ui reviews__ui">
        <button class="carousel__btn" type="button" data-prev aria-label="${h.esc(c.ui.prev)}">${h.icon('left', { size: 20 })}</button>
        <p class="carousel__count" data-count></p>
        <button class="carousel__btn" type="button" data-next aria-label="${h.esc(c.ui.next)}">${h.icon('right', { size: 20 })}</button>
      </div>
      <div class="carousel__viewport reviews__viewport">
        <ul class="carousel__track reviews__track">
        ${R.items.map(card).join('\n        ')}
        </ul>
      </div>
      <div class="dots reviews__dots" data-dots></div>
    </div>
  </div>
</section>`;
}
