// location.mjs — a store page (stores lane; contract §6). The structure map's location order, filled with High Society's own words
// (docs/structure-map.json): breadcrumb, the gallery hero (the store's race-day scene, its type line, the h1, "Shop
// Cannabis Products" + order / directions, the open-now line, address and phone), then the page's blocks in order with
// the directions tabs ("visiting") between them (src/templates/_storepage.mjs). JSON-LD: Store (a LocalBusiness: name,
// address, phone, hours from site.json; geo from the page when High Society's own map link gives coordinates),
// WebPage, BreadcrumbList; the FAQ block adds FAQPage.
import { renderStorePage } from './_storepage.mjs';

export const meta = { name: 'location', owner: 'stores', stub: false };

export function render(page, ctx) {
  if (!page.store) throw new Error(page.path + ': a location page names its store ("store": "<slug>")');
  const s = ctx.site.stores.find((x) => x.slug === page.store);
  if (!s) throw new Error(page.path + ': unknown store ' + page.store);
  if (s.locationPath !== page.path) throw new Error(page.path + ': store ' + s.slug + ' lives at ' + s.locationPath);
  const geo = page.geo ? { lat: page.geo.lat, lng: page.geo.lng } : undefined;
  const store = ctx.ld.store({ ...s, geo, imageFile: ctx.h.imgFile(s.image.src, 1200).replace(/^(\.\.\/)+/, '') }, ctx.site);
  if (page.storeSameAs && page.storeSameAs.length) store.sameAs = page.storeSameAs;
  if (page.hero && page.hero.mapsUrl) store.hasMap = page.hero.mapsUrl;
  return renderStorePage(page, ctx, meta, { heroCls: 'page-hero--store', extraLd: [store] });
}
