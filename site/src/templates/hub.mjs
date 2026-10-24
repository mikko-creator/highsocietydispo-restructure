// hub.mjs — the Resources hubs (pages lane, real): /dispensary-guides/ and /cannabis-laws-by-state/. The hero (the
// page's photo under v2's scrim, or the ink ground), then the page's blocks as bands, then the sources when the page
// cites any (the law hub).
// The store-guides band (cards variant "store-guides") is drawn from site.json "stores" (one value per store, D-nap):
// each store's scene, its name (the link to its store page), its address and hours, links straight to the store
// page's own sections (block "sections": [{ text, hash }], e.g. #first-visit, #order-pickup, #faq: structure map
// store-guides), and a link to its menu page for ordering ahead; the block JSON gives the heading, the lead and every
// link label.
// JSON-LD: CollectionPage (every guide the hub's cards link to) + BreadcrumbList.
import { crumbs, hero } from './_shell.mjs';
import { renderBlocks, sourcesSection } from './_pages.mjs';
import { section } from '../blocks/_kit.mjs';

export const meta = { name: 'hub', owner: 'pages', stub: false };

function storeGuides(b, ctx) {
  const e = ctx.h.esc;
  const sections = b.sections || [];
  for (const x of sections) {
    if (!x || !x.text || !/^[a-z0-9-]+$/.test(x.hash || '')) throw new Error(`${ctx.page.path}: a store-guides section link needs "text" and a plain id in "hash": ${JSON.stringify(x)}`);
  }
  const items = ctx.site.stores.map((s) => {
    const tid = ctx.uid('guide-' + s.slug);
    const jumps = sections.map((x) => `<li><a class="sguide__jump" href="${e(ctx.h.href(s.locationPath + '#' + x.hash))}" aria-describedby="${tid}">${e(x.text)}</a></li>`).join('');
    return `<li class="cards__item">
        <article class="cards__card card card--lift sguide" aria-labelledby="${tid}">
          <div class="cards__media media sguide__media">${ctx.h.img(s.image.src, { alt: s.image.alt || '', sizes: '(min-width: 1024px) 300px, (min-width: 640px) 50vw, 100vw' })}</div>
          <div class="cards__body">
            <h3 class="cards__title" id="${tid}"><a class="cover-link" href="${e(ctx.h.href(s.locationPath))}">${e(s.name)}</a></h3>
            <p class="sguide__addr">${s.address.lines.map(e).join('<br>')}</p>
            <p class="sguide__hours"><span>${e(s.hours.days)}</span> <span>${e(s.hours.text)}</span></p>
            ${jumps ? `<ul class="sguide__jumps">${jumps}</ul>` : ''}
            <p class="sguide__links"><span class="sguide__go">${e(b.linkText)}${ctx.h.icon('arrow', { size: 16 })}</span><a class="sguide__shop" href="${e(ctx.h.href(s.shopPath))}" aria-describedby="${tid}">${e(b.shopText)}</a></p>
          </div>
        </article>
      </li>`;
  }).join('\n      ');
  return section(b, ctx, `<ul class="cards cards--4 sguides">
      ${items}
    </ul>`);
}

export function render(page, ctx) {
  const c = crumbs(page, ctx);
  const body = renderBlocks(page.blocks, ctx, { variants: { 'store-guides': storeGuides } });
  const src = sourcesSection(page, ctx);
  // the hub's list of guides: every internal page its cards link to, in order, once
  const seen = new Set(), items = [];
  const add = (path, name) => { if (path && path.startsWith('/') && !seen.has(path)) { seen.add(path); items.push({ path, name }); } };
  for (const b of page.blocks || []) {
    if (b.variant === 'store-guides') for (const s of ctx.site.stores) add(s.locationPath, s.name);
    else if (b.type === 'cards') for (const it of b.items || []) add(it.href, it.title);
  }
  return {
    main: `${hero(page, ctx, { crumbsHtml: c.html, cls: 'page-hero--hub' })}
<div class="page__body page__body--hub" data-template="hub">
${body}
${src ? `<section class="block block--sources theme-white"><div class="block__inner">${src}</div></section>` : ''}
</div>`,
    mainClass: 'page page--hub',
    jsonld: [ctx.ld.collection({ name: page.h1, path: page.path, description: page.metaDescription, items }), ctx.ld.breadcrumbs(c.items)],
  };
}
