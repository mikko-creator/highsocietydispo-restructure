// locations-hub.mjs — /dispensary-locations/ (stores lane; contract §6): the structure map's dispensaries hub for High Society's one
// state: the hero, the eight stores (store-grid), the New Buffalo area pages, the deals teaser, quick links, the
// Michigan FAQ, the app (blocks from the page JSON). JSON-LD: CollectionPage with the stores as an ItemList, plus
// WebPage and BreadcrumbList.
import { renderStorePage } from './_storepage.mjs';

export const meta = { name: 'locations-hub', owner: 'stores', stub: false };

export function render(page, ctx) {
  const items = ctx.site.stores.map((s) => ({ path: s.locationPath, name: `${ctx.site.brand.name} ${s.name}` }));
  const coll = ctx.ld.collection({ name: page.h1, path: page.path, description: page.metaDescription, items });
  return renderStorePage(page, ctx, meta, { extraLd: [coll] });
}
