// nearby block (stores lane): the other High Society stores as compact v2 location cards (photo, name, address,
// telephone, the store's "Order Now" and a link to its page), in the order the page gives (nearest first where High
// Society's own map links give coordinates; see the page JSON), every fact from site.json "stores".
//
//   { type: "nearby", store: "<slug>", order?: [slugs] (default: the other stores by name), heading?, lead?, ground?,
//     view: { text }   the second button (to the store's page) }
import { section } from './_kit.mjs';
import { storeOf } from './_stores.mjs';
import { storeCard } from './store-grid.mjs';

export function render(b, ctx) {
  const here = storeOf(b.store, ctx);
  const others = b.order ? b.order.map((x) => storeOf(x, ctx)) : ctx.site.stores.filter((s) => s.slug !== here.slug);
  if (others.some((s) => s.slug === here.slug)) throw new Error('nearby block: the order lists the page\'s own store ' + here.slug);
  const missing = ctx.site.stores.filter((s) => s.slug !== here.slug && !others.includes(s));
  if (missing.length) throw new Error('nearby block on ' + ctx.page.path + ': order leaves out ' + missing.map((s) => s.slug).join(', '));
  const titleTag = b.heading ? 'h3' : 'h2';
  return section({ ground: 'black', ...b }, ctx, `<ul class="sg sg--nearby">
      ${others.map((s) => storeCard(s, ctx, { to: 'location', secondary: b.view ? { text: b.view.text, to: 'location' } : null, titleTag, cls: 'sg__item--compact' })).join('\n      ')}
    </ul>`);
}
