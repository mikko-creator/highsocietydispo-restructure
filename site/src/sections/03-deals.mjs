// 03-deals.mjs — DEALS, in the reskin's own band: the cream (Headlight) ground, the giant DEALS title and the
// checkered strip along the foot. The reskin's trophy roundel is the section's BACKGROUND (owner, 2026-10-22: "in the
// background, increase size … peeking from the right … in fading black color … retain the focal point to the deals"):
// large, tilted -8deg, a fading black silhouette (the mark's own outline as a mask) half off the right edge, behind the
// cards. The deals are the reskin's hairline cards, white on cream:
//   - the two offers (710Labs, M.I.JANE): the brand logo on a plate of its own colour across the card's top (the 710Labs
//     art is a black square; the M.I.JANE lettering is black on transparent, so it gets a white plate with a hairline
//     seam), "Free" as the reskin's small red card label in the plate's corner (neon on the black plate), a short red
//     rule, the offer word in Changa One ink, the rest of the offer in Changa;
//   - the two flower banners: black cards (the colour of their own artwork), each card the banner's link, the art
//     shown whole, never cropped; one <picture> each (the wide desktop art on desktop and landscape tablets, the
//     portrait phone art on phones and portrait tablets).
// Desktop and landscape tablets: the owner's layout E (2026-10-22, "Bento"): the title in its own tile, the $10 OZ
// banner the biggest tile beside it, then the two offers and the $5 OZ banner under them (03-deals.css). Portrait
// tablets: a 2x2 grid. Phones: a 1-up swipe carousel of the four deals (arrows + counter 1/4, the next card peeking 20px).
// DECLARED (CONTRACT §8): the M.I.JANE card's source link is href "#" (no destination): it renders without a link.

export const meta = { id: 'deals', order: 3, label: 'DEALS' };

// The opaque panel of each banner file (its alpha > 20 bounding box, measured on assets/optimized/*): hot_deals.webp
// (1130x397) keeps 55 transparent rows above its black panel and 76 below; the phone files keep a few transparent rows
// or columns. A banner's box takes its PANEL's shape and the picture fills it with object-fit: cover at the panel's
// position, so only those transparent rows/columns fall outside the box: the black panel and every printed word show
// whole, and the box edge IS the panel edge. A file not listed is opaque to its edges.
const PANEL = {
  'assets/in-pages/hot_deals.webp': { w: 1130, h: 266, pos: '50% 42%' },          // rows 55-321 of 397 (55 / 76 transparent)
  'assets/in-pages/mobile_hot_deals.webp': { w: 338, h: 366, pos: '50% 0%' },     // rows 0-366 of 402 (36 transparent below)
  'assets/in-pages/hot_deals___mobile2.webp': { w: 325, h: 367, pos: '89% 50%' }, // columns 16-341 of 343 (16 / 2 transparent)
};
// the wide desktop art from here up; the portrait phone art below it and on portrait tablets (the CSS uses the same
// condition for the banner box's shape)
const WIDE = '(min-width: 1024px), (min-width: 768px) and (orientation: landscape)';

export function render(c, h, ctx) {
  const D = c.deals;
  const [pod, jane] = D.cards;
  const free = (card) => `<span class="deals__free">${h.esc(card.free)}</span>`;
  // the reskin's caption: "GET A" "FREE" (its emphasis) then a line break, then "Battery"
  const caption = (parts) => parts.map((p) => (p.em ? `<em>${h.esc(p.text)}</em><br>` : h.esc(p.text))).join(' ').replace(/<br> /g, '<br>');
  // "Free" sits in the plate (after the logo, so the words keep their order), drawn on the plate's own colour
  const plate = (card, tone) => `<div class="deals__plate deals__plate--${tone}">${h.img(card.img.src, { alt: card.img.alt, cls: 'deals__logo', sizes: '264px' })}${free(card)}</div>`;

  // 710Labs: the whole card links to the shop (the CMS fills the token; until then it asks for the store)
  const podCard = `<article class="deals__card deals__offer card card--lift" aria-labelledby="deals-pod-h">
          ${plate(pod, 'black')}
          <div class="deals__body">
            <h3 class="deals__word" id="deals-pod-h"><a class="cover-link" href="${h.esc(h.href(pod.href))}">${h.esc(pod.heading)}</a></h3>
            <p class="deals__meta">${caption(pod.caption)}</p>
          </div>
        </article>`;

  // M.I.JANE: no destination on the reskin (href "#"), so no link and no hover lift
  const janeCard = `<article class="deals__card deals__offer card" aria-labelledby="deals-jane-h">
          ${plate(jane, 'white')}
          <div class="deals__body">
            <h3 class="deals__word" id="deals-jane-h">${h.esc(jane.heading)}</h3>
            <div class="deals__meta"><p class="deals__brand">${h.esc(jane.brand)}</p><p class="deals__weight">${h.esc(jane.weight)}</p></div>
          </div>
        </article>`;

  // a flower banner: the black card is the link; the banner's box has its panel's shape (desktop or phone file, see
  // the CSS) and is as large as the card allows, whole
  const shape = (src, key) => {
    const r = ctx.images[src], p = PANEL[src] || { w: r.width, h: r.height, pos: '50% 50%' };
    return `--deals-ar-${key}:${p.w} / ${p.h};--deals-arn-${key}:${(p.w / p.h).toFixed(4)};--deals-pos-${key}:${p.pos}`;
  };
  // the upper banner paints up to 67vw (capped at 952px), the lower up to 48vw (688px) on desktop
  const BANNER_SIZES = ['(min-width: 1024px) min(67vw, 952px), 90vw', '(min-width: 1024px) min(48vw, 688px), 90vw'];
  const flower = (b, k) => `<a class="deals__card deals__flower card card--lift" href="${h.esc(h.href(b.href))}">
          <span class="deals__stage"><span class="deals__banner" style="${shape(b.img.src, 'd')};${shape(b.mobile.img.src, 'm')}">${h.picture(b.img.src, b.mobile.img.src, { media: WIDE, alt: b.img.alt, cls: 'deals__art', sizes: BANNER_SIZES[k], mobileSizes: '(min-width: 768px) 44vw, 90vw' })}</span></span>
        </a>`;

  const items = [
    { cls: 'deals__item--offer', html: podCard, i: 0 },
    { cls: 'deals__item--offer', html: janeCard, i: 1 },
    ...D.banners.map((b, k) => ({ cls: `deals__item--flower deals__item--${k ? 'lower' : 'upper'}`, html: flower(b, k), i: 2 + k })),
  ].map((it) => `<li class="deals__item ${it.cls} reveal" style="--i:${it.i}">
        ${it.html}
      </li>`).join('\n      ');

  return `
<section class="slide theme-headlight deals" id="${meta.id}" aria-labelledby="deals-h" data-slide="${meta.order}">
  <div class="slide__bg deals__bg" aria-hidden="true"><span class="deals__roundel"></span></div>
  <div class="slide__inner">
    <header class="slide__head deals__head">
      <div class="head__copy">
        <span class="secnum" aria-hidden="true"></span>
        <h2 class="title deals__title" id="deals-h">${h.esc(D.title)}</h2>
      </div>
    </header>
    <div class="slide__body">
      <div class="carousel deals__carousel" data-carousel aria-labelledby="deals-h">
        <div class="carousel__viewport deals__viewport">
          <ul class="carousel__track deals__track">
      ${items}
          </ul>
        </div>
        <div class="carousel__ui deals__ui">
          <button class="carousel__btn" type="button" data-prev aria-label="${h.esc(c.ui.prev)}">${h.icon('left', { size: 20 })}</button>
          <p class="carousel__count" data-count></p>
          <button class="carousel__btn" type="button" data-next aria-label="${h.esc(c.ui.next)}">${h.icon('right', { size: 20 })}</button>
        </div>
      </div>
      ${h.slot('itbrm')}
    </div>
  </div>
  <div class="checker deals__checker" aria-hidden="true" data-edge-band></div>
</section>`;
}
