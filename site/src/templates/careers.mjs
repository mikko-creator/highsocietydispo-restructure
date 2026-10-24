// careers.mjs — /careers/ (pages lane, real). High Society's Careers page, every visible word: the photo hero ("Careers
// at High Society", the line "Join the High Society Team"), then the Employment Application band: its heading, High
// Society's invitation, and the application form (Personal Information, the address, availability, employment type,
// the resume upload, previous work experience, role and preferred location: the store names come from site.json).
// The form keeps High Society's labels, field names and CMS form id and posts where the live form posts (page JSON
// form.action, https only). Any further blocks follow. JSON-LD: WebPage + BreadcrumbList.
import { crumbs, hero, pageLd } from './_shell.mjs';
import { renderBlocks, formHtml } from './_pages.mjs';

export const meta = { name: 'careers', owner: 'pages', stub: false };

export function render(page, ctx) {
  const c = crumbs(page, ctx), e = ctx.h.esc;
  const A = page.application || {};
  const hid = ctx.uid('blk-' + ctx.h.slug(A.heading || 'application'));
  const apply = page.form ? `<section class="block block--apply theme-white" aria-labelledby="${hid}">
  <div class="block__inner apply">
    <header class="block__head apply__head">
      <h2 class="block__title" id="${hid}">${e(A.heading)}</h2>
      ${A.md ? `<div class="block__lead apply__intro md">${ctx.md(A.md)}</div>` : ''}
    </header>
    <div class="apply__form card">${formHtml(page.form, ctx, { labelledby: hid })}</div>
  </div>
</section>` : '';
  return {
    main: `${hero(page, ctx, { crumbsHtml: c.html, cls: 'page-hero--careers' })}
<div class="page__body page__body--careers" data-template="careers">
${apply}
${renderBlocks(page.blocks, ctx, { grounds: ['headlight', 'white'] })}
</div>`,
    mainClass: 'page page--careers',
    jsonld: pageLd(page, ctx, c.items),
  };
}
