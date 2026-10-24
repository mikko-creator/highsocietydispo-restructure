// deals block (stores lane): the deals High Society publishes (site.json "deals" = the v2 home's own DEALS cards and
// banners, every word, alt and image), in the v2 DEALS language: the Headlight ground, white hairline offer cards with
// the brand logo on its own plate, "Free" as the small red label, the offer word in Changa One; the flower banners as
// black cards showing their art whole (one <picture>: the wide art from 1024px, the portrait art below).
//
//   { type: "deals", source: "site", heading?, lead?, ground? (default headlight), banners?: false,
//     more?: { text, href }  a link under the deals (e.g. to /deals/), note?: md (small print) }
// A deal whose source link is "#" (the M.I. JANE card on v2) renders without a link, as on v2.
import { section, buttons } from './_kit.mjs';

const WIDE = '(min-width: 1024px)';

export function render(b, ctx) {
  if (b.source && b.source !== 'site') throw new Error('deals block: unknown source ' + b.source);
  const D = ctx.site.deals, e = ctx.h.esc, h = ctx.h;
  const linked = (d) => d.href && d.href !== '#';
  const caption = (parts) => (parts || []).map((p) => (p.em ? `<em>${e(p.text)}</em>` : e(p.text))).join(' ');
  const offer = (d, i) => {
    const id = ctx.uid('deal-' + h.slug(d.heading));
    const word = linked(d) ? `<a class="cover-link" href="${e(h.href(d.href))}">${e(d.heading)}</a>` : e(d.heading);
    const meta = d.caption ? caption(d.caption) : [d.brand, d.weight].filter(Boolean).map(e).join(' ');
    return `<li class="sdeal__item"><article class="sdeal sdeal--offer card${linked(d) ? ' card--lift' : ''}" aria-labelledby="${id}">
          <div class="sdeal__plate sdeal__plate--${i === 0 ? 'black' : 'white'}">${h.img(d.img.src, { alt: d.img.alt, cls: 'sdeal__logo', sizes: '264px' })}<span class="sdeal__free">${e(d.free)}</span></div>
          <div class="sdeal__body"><h3 class="sdeal__word" id="${id}">${word}</h3><p class="sdeal__meta">${meta}</p></div>
        </article></li>`;
  };
  const banner = (d) => {
    const pic = d.mobile ? h.picture(d.img.src, d.mobile.img.src, { media: WIDE, alt: d.img.alt, sizes: '(min-width: 1280px) 600px, 50vw', mobileSizes: '(min-width: 640px) 50vw, 100vw', cls: 'sdeal__art' })
      : h.img(d.img.src, { alt: d.img.alt, cls: 'sdeal__art', sizes: '(min-width: 1024px) 50vw, 100vw' });
    return `<li class="sdeal__item sdeal__item--banner"><a class="sdeal sdeal--banner card card--lift" href="${e(h.href(d.href))}" aria-label="${e(d.img.alt)}">${pic}</a></li>`;
  };
  const list = [...D.cards.map(offer), ...(b.banners === false ? [] : D.banners.map(banner))];
  return section({ ground: 'headlight', ...b }, ctx, `<ul class="sdeals">
      ${list.join('\n      ')}
    </ul>
    ${b.note ? `<div class="sdeals__note md">${ctx.md(b.note)}</div>` : ''}
    ${b.more ? buttons([{ text: b.more.text, href: b.more.href, style: 'ghost', icon: 'arrow' }], ctx, { size: 'lg' }) : ''}`, { cls: 'block--sdeals' });
}
