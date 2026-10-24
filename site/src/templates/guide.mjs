// guide.mjs — the long Resources guides (pages lane, real): /getting-a-medical-card/, /patient-guide/ and the state law
// pages /cannabis-laws-by-state/<state>/. The hero (eyebrow, h1, lead, the "last reviewed" date), then one white
// reading column beside a sticky "on this page" list (phones: a folded list above the text): the summary box, the
// page's blocks in order (prose, callouts, lists, tables, the FAQ; a call to action draws as a card in the column), the
// sources (every law or health statement on these pages is cited) and the page's closing note.
// The contents list is read from the rendered column (every h2 with an id), so it always matches the page.
// JSON-LD: WebPage (lastReviewed) + BreadcrumbList + one FAQPage for all of the page's questions.
import { crumbs, hero } from './_shell.mjs';
import { renderBlocks, oneFaqPage, headingsOf, jumpNav, sourcesSection } from './_pages.mjs';

export const meta = { name: 'guide', owner: 'pages', stub: false };

function summary(S, ctx) {
  if (!S || !(S.items || []).length) return '';
  const id = ctx.uid('blk-' + ctx.h.slug(S.heading));
  return `<section class="keyfacts" aria-labelledby="${id}">
      <h2 class="keyfacts__title" id="${id}">${ctx.inline(S.heading)}</h2>
      <ul class="blist blist--check">${S.items.map((t) => `<li><span class="blist__icon" aria-hidden="true">${ctx.h.icon('check', { size: 20 })}</span><div class="blist__text">${ctx.md(t)}</div></li>`).join('')}</ul>
    </section>`;
}

export function render(page, ctx) {
  const c = crumbs(page, ctx), e = ctx.h.esc;
  const faq = oneFaqPage(ctx);
  const R = page.reviewed;
  const reviewed = R ? `<p class="guide__reviewed"><span>${e(R.label)}</span> <time datetime="${e(R.date)}">${e(R.text)}</time></p>` : '';
  const heroHtml = hero(page, ctx, { crumbsHtml: c.html, cls: 'page-hero--guide', after: reviewed });
  const column = [
    summary(page.summary, faq.ctx),
    renderBlocks(page.blocks, faq.ctx, { grounds: ['white'] }),
    sourcesSection(page, ctx),
    page.note ? `<aside class="callout callout--legal guide__note" role="note"><span class="callout__icon" aria-hidden="true">${ctx.h.icon('check', { size: 22 })}</span><div class="callout__body"><div class="md">${ctx.md(page.note)}</div></div></aside>` : '',
  ].filter(Boolean).join('\n');
  const toc = headingsOf(column);
  const label = page.tocLabel || ctx.ui.toc;
  const items = toc.map((t) => `<li><a href="#${e(t.id)}">${e(t.text)}</a></li>`).join('');
  const folded = toc.length > 2 ? `<details class="guide__tocm"><summary class="guide__tocm-sum">${e(label)}${ctx.h.icon('chevron', { size: 18 })}</summary><ol class="jumpnav__list">${items}</ol></details>` : '';
  const node = faq.node();
  const lastReviewed = R && /^\d{4}-\d{2}-\d{2}$/.test(R.date) ? { lastReviewed: R.date } : {};
  return {
    main: `${heroHtml}
<div class="page__body page__body--guide" data-template="guide">
  <div class="guide theme-white">
    <div class="guide__grid">
      <div class="guide__aside">${toc.length > 2 ? jumpNav(toc, ctx, { label, cls: 'guide__toc' }) : ''}</div>
      <div class="guide__main">
        ${folded}
${column}
      </div>
    </div>
  </div>
</div>`,
    mainClass: 'page page--guide',
    jsonld: [{ ...ctx.ld.webPage({ name: page.h1, path: page.path, description: page.metaDescription }), ...lastReviewed }, ctx.ld.breadcrumbs(c.items), ...(node ? [node] : [])],
  };
}
