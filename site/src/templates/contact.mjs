// contact.mjs — /contact/ (pages lane, real). High Society's Contact page, every visible word: the compact hero (the
// h1 "Contact Us"), then its form beside a short facts card (the email address from the store pages; the hours every
// store shares, from site.json), then the page's blocks: the stores (store-grid, stores lane), the FAQ pointer and the
// app band (split variant "app": the v2 home's app section in short — the title on its two lines, the text, the App
// Store button, the phone).
// The form keeps High Society's labels, field names and CMS form id and posts where the live form posts
// (page JSON form.action, https only): the CMS wires it when it serves the page.
// JSON-LD: ContactPage + BreadcrumbList.
import { crumbs, hero } from './_shell.mjs';
import { renderBlocks, formHtml } from './_pages.mjs';
import { buttons, picture } from '../blocks/_kit.mjs';

export const meta = { name: 'contact', owner: 'pages', stub: false };

export function appBand(b, ctx) {
  const e = ctx.h.esc, id = ctx.uid('app-' + ctx.h.slug([].concat(b.title).join(' ')));
  const ground = ['black', 'charcoal', 'red'].includes(b.ground) ? b.ground : 'black';
  return `<section class="block block--app theme-${ground}" aria-labelledby="${id}">
  <div class="checker block__checker" aria-hidden="true"></div>
  <div class="block__inner appband">
    <div class="appband__copy">
      <h2 class="appband__title" id="${id}">${[].concat(b.title).map(e).join('<br>')}</h2>
      <div class="appband__text md">${ctx.md(b.md)}</div>
      ${buttons(b.ctas, ctx)}
    </div>
    <div class="appband__art">${picture(b.image, b.imageAlt, ctx, { sizes: '(min-width: 1024px) 420px, 70vw', cls: 'appband__phone' })}</div>
  </div>
</section>`;
}

function factsCard(aside, ctx) {
  if (!aside || !(aside.items || []).length) return '';
  const e = ctx.h.esc;
  const hoursOf = () => {
    const S = ctx.site.stores, h0 = S[0] && S[0].hours;
    return h0 && S.every((s) => s.hours.days === h0.days && s.hours.text === h0.text) ? `${h0.days}: ${h0.text}` : '';
  };
  const rows = aside.items.map((it) => {
    const value = it.auto === 'hours' ? e(hoursOf()) : ctx.inline(it.md || '');
    if (!value) return '';
    return `<div class="factcard__row"><dt>${e(it.label)}</dt><dd>${value}</dd></div>`;
  }).join('');
  return `<aside class="factcard card"${aside.label ? ` aria-label="${e(aside.label)}"` : ''}>
        <dl class="factcard__list">${rows}</dl>
        ${aside.md ? `<div class="factcard__note md">${ctx.md(aside.md)}</div>` : ''}
      </aside>`;
}

export function render(page, ctx) {
  const c = crumbs(page, ctx);
  const heroHtml = hero(page, ctx, { crumbsHtml: c.html, cls: 'page-hero--compact page-hero--contact' });
  const form = page.form ? `<section class="block block--contact theme-white" aria-labelledby="page-title">
  <div class="block__inner">
    <div class="contact">
      <div class="contact__form card">${formHtml(page.form, ctx, { labelledby: 'page-title' })}</div>
      ${factsCard(page.aside, ctx)}
    </div>
  </div>
</section>` : '';
  const body = renderBlocks(page.blocks, ctx, { grounds: ['headlight', 'white'], variants: { app: appBand } });
  return {
    main: `${heroHtml}
<div class="page__body page__body--contact" data-template="contact">
${form}
${body}
</div>`,
    mainClass: 'page page--contact',
    jsonld: [{ ...ctx.ld.webPage({ name: page.h1, path: page.path, description: page.metaDescription }), '@type': 'ContactPage' }, ctx.ld.breadcrumbs(c.items)],
  };
}
