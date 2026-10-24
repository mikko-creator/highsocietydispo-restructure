// amenities block (stores lane): what a store offers and accepts, as High Society publishes it, in v2's language: small
// red icon plates and Changa labels, grouped under High Society's own group names ("We Offer", "Pay With").
// Only facts High Society published (contract 3.1): the words come from the page JSON.
//
//   { type: "amenities", heading?, lead?, ground?,
//     groups?: [{ title, items: [{ icon, label, md? }] }]     (or items: [...] for one untitled group)
//     note?: md                                                 one line under the groups }
import { section } from './_kit.mjs';
import { plate } from './_stores.mjs';

export function render(b, ctx) {
  const groups = b.groups || [{ title: null, items: b.items || [] }];
  const item = (it) => `<li class="amen__item">${plate(it.icon || 'check', ctx, 20)}<span class="amen__text"><span class="amen__label">${ctx.inline(it.label)}</span>${it.md ? `<span class="amen__md">${ctx.inline(it.md)}</span>` : ''}</span></li>`;
  return section(b, ctx, `<div class="amen amen--${groups.length > 2 ? 'many' : groups.length}">
      ${groups.map((g) => {
        const gid = g.title ? ctx.uid('amen-' + ctx.h.slug(g.title)) : null;
        return `<div class="amen__group"${gid ? ` role="group" aria-labelledby="${gid}"` : ''}>
        ${g.title ? `<h3 class="amen__title" id="${gid}">${ctx.inline(g.title)}</h3>` : ''}
        <ul class="amen__list">${g.items.map(item).join('')}</ul>
      </div>`;
      }).join('\n      ')}
    </div>${b.note ? `<div class="amen__note md">${ctx.md(b.note)}</div>` : ''}`);
}
