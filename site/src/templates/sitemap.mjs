// sitemap.mjs — /site-map/: real (core). Every built page, grouped by site.json ia.sitemap (by path prefix), in the
// link-grid language: groups under small red labels, links with the red trophy bullet. The build passes the groups
// (ctx.sitemapGroups: [{ title, links: [{ text, path }] }]); pagination pages are left out (they are in sitemap.xml).
// The short groups come first, side by side; a long group (more than LONG links: the Society Pages article index) follows
// across the full width with its links in columns (templates/sitemap.css). In the grid's own order the 200-link article
// column pushed the Company and Legal groups below it, some 12,000px down at 1280px (pages verifier, 2026-10-24).
import { crumbs, hero, blocks, pageLd } from './_shell.mjs';

export const meta = { name: 'sitemap', owner: 'pages', stub: false };

const LONG = 30;

export function render(page, ctx) {
  const c = crumbs(page, ctx), e = ctx.h.esc;
  const all = ctx.sitemapGroups;
  const ordered = [...all.filter((g) => g.links.length <= LONG), ...all.filter((g) => g.links.length > LONG)];
  const groups = ordered.map((g) => {
    const gid = ctx.uid('sm-' + ctx.h.slug(g.title));
    return `<nav class="linkgrid__group sitemap__group${g.links.length > LONG ? ' sitemap__group--long' : ''}" aria-labelledby="${gid}">
        <h2 class="linkgrid__title" id="${gid}">${e(g.title)}</h2>
        <ul class="linkgrid__links">${g.links.map((l) => `<li><a href="${e(ctx.h.href(l.path))}">${e(l.text)}</a></li>`).join('')}</ul>
      </nav>`;
  }).join('\n      ');
  return {
    main: `${hero(page, ctx, { crumbsHtml: c.html, cls: 'page-hero--compact' })}
<div class="page__body" data-template="sitemap">
${blocks(page.blocks, ctx)}
<section class="block block--sitemap theme-white">
  <div class="block__inner">
    <div class="linkgrid sitemap">
      ${groups}
    </div>
  </div>
</section>
</div>`,
    mainClass: 'page page--sitemap',
    jsonld: pageLd(page, ctx, c.items),
  };
}
