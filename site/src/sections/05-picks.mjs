// 05-picks — Staff Picks: the four brand logo tiles, each linking to its brand search on the shop (the CMS fills
// {{location_shop_url}} with the chosen store's shop). The reskin's band: a white ground, the numbered head, four
// white hairline tiles with the logos at the reskin's own size (padded 12% 14% inside a 16:10 box); a lift and a soft
// shadow on hover, nothing else. The owner's layout D (2026-10-22, "Red title panel"): the head is a brand-red panel
// with the title in white; desktop: the panel on the left and the tiles as a 2x2 on the right, sharing top and bottom
// edges; tablets and phones: the panel as a red band over the 2x2 (05-picks.css).

export const meta = { id: 'picks', order: 5, label: 'Staff Picks' };

export function render(c, h) {
  const P = c.picks;
  const tile = (it, i) => `<li class="picks__item reveal" style="--i:${i}">
          <a class="pick card card--lift" href="${h.esc(h.href(it.href))}">
            ${h.img(it.img.src, { alt: it.img.alt, cls: 'pick__logo', sizes: '(min-width: 1180px) 310px, (min-width: 768px) 320px, 120px' })}
          </a>
        </li>`;
  return `
<section class="slide theme-white picks" id="${meta.id}" aria-labelledby="picks-h" data-slide="${meta.order}">
  <div class="slide__inner">
    <header class="slide__head">
      <div class="head__copy">
        <span class="secnum" aria-hidden="true"></span>
        <h2 class="title" id="picks-h">${h.esc(P.title)}</h2>
      </div>
    </header>
    <div class="slide__body picks__body">
      <ul class="picks__grid">
        ${P.items.map(tile).join('\n        ')}
      </ul>
      ${h.slot('ihvb9')}
    </div>
  </div>
</section>`;
}
