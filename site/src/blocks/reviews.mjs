// reviews block (stores lane): customer reviews quoted whole, with the name as shown (VOICE rule 12), in the v2
// reviews language: the Headlight band, white hairline cards with a red top rule, the name in Changa One, red stars
// where High Society shows them.
//
//   { type: "reviews", heading?, lead?, ground? (default headlight),
//     source?: "home"         the v2 home's own 8 Google reviews (home.json reviews.items: brand-wide, never presented
//                             as reviews of one store: the page's lead says so)
//     items?: [{ text, author, stars? }]   High Society's own review lines (e.g. its New Buffalo pages) }
// The cards sit in a row that scrolls inside itself on phones (the page never scrolls sideways), a grid from 768px.
import { section } from './_kit.mjs';

export function render(b, ctx) {
  const e = ctx.h.esc;
  const items = b.source === 'home' ? ctx.home.reviews.items.map((r) => ({ text: r.text, author: r.name, stars: r.stars })) : (b.items || []);
  if (!items.length) throw new Error('reviews block: no reviews');
  const stars = (n) => (n ? `<p class="rev__stars"><span class="visually-hidden">${e(String(n))} / 5</span>${Array.from({ length: n }, () => ctx.h.icon('star-solid', { size: 18 })).join('')}</p>` : '');
  const listId = ctx.uid('rev-list');
  return section({ ground: 'headlight', ...b }, ctx, `<div class="rev__scroll" role="region" tabindex="0" aria-labelledby="${listId}-label">
      <span class="visually-hidden" id="${listId}-label">${e(b.heading || ctx.ui.carouselReviews)}</span>
      <ul class="rev" id="${listId}">
      ${items.map((r) => `<li class="rev__item"><figure class="rev__card card">
          ${stars(r.stars)}
          <blockquote class="rev__text"><p>${e(r.text)}</p></blockquote>
          <figcaption class="rev__by">${e(r.author)}</figcaption>
        </figure></li>`).join('\n      ')}
      </ul>
    </div>`);
}
