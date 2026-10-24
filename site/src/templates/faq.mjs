// faq.mjs — /faq/ (pages lane, real). The hero (eyebrow, h1, the one-line intro) with the topic chips (one per FAQ
// block, read from the rendered page so they always match), then the page's blocks as bands: the FAQ topics (v2's
// accordion; High Society's own answers first), the per-store FAQ links, the contact prompt, then the sources of the
// page's law and safety answers (page.sources).
// JSON-LD: WebPage + BreadcrumbList + ONE FAQPage holding every question on the page.
import { crumbs, hero } from './_shell.mjs';
import { renderBlocks, oneFaqPage, headingsOf, plain, sourcesSection } from './_pages.mjs';

export const meta = { name: 'faq', owner: 'pages', stub: false };

export function render(page, ctx) {
  const c = crumbs(page, ctx), e = ctx.h.esc;
  const faq = oneFaqPage(ctx);
  // the closing call-to-action band(s) stay last, after the sources
  const list = page.blocks || [];
  let cut = list.length;
  while (cut > 0 && list[cut - 1].type === 'cta') cut--;
  const body = renderBlocks(list.slice(0, cut), faq.ctx);
  const tail = renderBlocks(list.slice(cut), faq.ctx);
  const topics = new Set((page.blocks || []).filter((b) => b.type === 'faq' && b.heading).map((b) => plain(ctx.inline(b.heading))));
  const chips = headingsOf(body).filter((h) => topics.has(h.text));
  const cid = ctx.uid('topics');
  const chipsHtml = chips.length > 1 ? `<nav class="chips" aria-labelledby="${cid}">
      <p class="chips__label" id="${cid}">${e(page.topicsLabel || '')}</p>
      <ul class="chips__list">${chips.map((t) => `<li><a class="chips__link" href="#${e(t.id)}">${e(t.text)}</a></li>`).join('')}</ul>
    </nav>` : '';
  const node = faq.node();
  const src = sourcesSection(page, ctx);
  return {
    main: `${hero(page, ctx, { crumbsHtml: c.html, cls: 'page-hero--compact page-hero--faq', after: chipsHtml })}
<div class="page__body page__body--faq" data-template="faq">
${body}
${src ? `<section class="block block--sources theme-white"><div class="block__inner">${src}</div></section>` : ''}
${tail}
</div>`,
    mainClass: 'page page--faq',
    jsonld: [ctx.ld.webPage({ name: page.h1, path: page.path, description: page.metaDescription }), ctx.ld.breadcrumbs(c.items), ...(node ? [node] : [])],
  };
}
