// menu-placeholder block (stores lane): where the store's live menu loads on highsocietydispo.com (the CMS menu widget
// serves it there); on this static site, a notice in the v2 ink panel with the store's own ways to order: the menu
// (the CMS token {{location_shop_url}}, which the store chooser answers here) and a call to the store.
//
//   { type: "menu-placeholder", store: "<slug>", heading?, lead?, ground?,
//     title, md            the notice (page JSON words)
//     order: { text }      the "Order Now" button (-> {{location_shop_url}})
//     call?: { text }      a ghost button that calls the store
//     slotId?              the id of the empty element the CMS menu widget fills (kept empty here) }
import { section } from './_kit.mjs';
import { storeOf, telHref } from './_stores.mjs';

export function render(b, ctx) {
  const s = b.store ? storeOf(b.store, ctx) : null, e = ctx.h.esc;
  const tid = ctx.uid('menu-' + (s ? s.slug : 'all'));
  const btns = `<div class="sbtns">
          <a class="btn btn--primary btn--lg" href="{{location_shop_url}}" aria-describedby="${tid}">${ctx.h.icon('cart', { size: 18 })}${e(b.order.text)}</a>
          ${s && b.call ? `<a class="btn btn--ghost btn--lg" href="${e(ctx.h.href(telHref(s)))}">${ctx.h.icon('phone', { size: 18 })}${e(b.call.text)} ${e(s.phone.text)}</a>` : ''}
        </div>`;
  return section(b, ctx, `<div class="menuph theme-black">
      <div class="menuph__mark" aria-hidden="true"></div>
      <div class="menuph__copy">
        <p class="menuph__title" id="${tid}">${e(b.title)}</p>
        <div class="md">${ctx.md(b.md)}</div>
        ${btns}
      </div>
      ${b.slotId ? `<div class="cms-slot menuph__slot" id="${e(b.slotId)}" data-cms-slot${s ? ` data-store="${e(s.slug)}"` : ''}></div>` : ''}
    </div>`);
}
