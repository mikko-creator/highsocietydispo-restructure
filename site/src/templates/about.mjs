// about.mjs — /about/ (pages lane, real). High Society's own About page, every visible word, in the v2 home's language:
// the photo hero (eyebrow "Welcome To", the h1), then the page's blocks: Our Story beside a store scene, Mission and
// Vision beside another (with the app link), the values band, the closing call to action.
// The values band (cards variant "values"): the ink ground, the brand's race numbers, each value's name as an h2 (as on
// High Society's page, where HOSPITALITY, QUALITY and Community are headings of their own), the text, the band's link.
// JSON-LD: AboutPage + BreadcrumbList + the Organization with its founding year when the page JSON gives one.
import { crumbs, hero } from './_shell.mjs';
import { renderBlocks } from './_pages.mjs';
import { buttons } from '../blocks/_kit.mjs';

export const meta = { name: 'about', owner: 'pages', stub: false };

function values(b, ctx) {
  const e = ctx.h.esc;
  const items = b.items.map((it, i) => {
    const id = ctx.uid('value-' + ctx.h.slug(it.title));
    return `<li class="values__item">
        <span class="values__num" aria-hidden="true"><span class="values__plate">${String(i + 1).padStart(2, '0')}</span></span>
        <h2 class="values__title" id="${id}">${ctx.inline(it.title)}</h2>
        <div class="values__text md">${ctx.md(it.md)}</div>
      </li>`;
  }).join('\n      ');
  const ground = ['black', 'charcoal', 'red'].includes(b.ground) ? b.ground : 'black';   // a dark band by design
  return `<section class="block block--values theme-${ground}"${b.label ? ` aria-label="${e(b.label)}"` : ''}>
  <div class="values__mark" aria-hidden="true"></div>
  <div class="block__inner">
    <ul class="values">
      ${items}
    </ul>
    ${buttons(b.ctas, ctx)}
  </div>
</section>`;
}

export function render(page, ctx) {
  const c = crumbs(page, ctx);
  const body = renderBlocks(page.blocks, ctx, { variants: { values } });
  const org = ctx.ld.organization(ctx.site);
  if (page.foundingDate) org.foundingDate = page.foundingDate;
  return {
    main: `${hero(page, ctx, { crumbsHtml: c.html, cls: 'page-hero--about' })}
<div class="page__body page__body--about" data-template="about">
${body}
</div>`,
    mainClass: 'page page--about',
    jsonld: [{ ...ctx.ld.webPage({ name: page.h1, path: page.path, description: page.metaDescription }), '@type': 'AboutPage' }, ctx.ld.breadcrumbs(c.items), org],
  };
}
