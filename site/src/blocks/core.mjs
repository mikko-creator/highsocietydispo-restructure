// core.mjs — the core-owned blocks of contract §3.1, for real: prose, split, cards, link-grid, steps, list, faq,
// callout, table, cta, media. Styles: src/styles/blocks/<type>.css. Every word comes from the block's own fields.
import { section, buttons, picture } from './_kit.mjs';

export const prose = (b, ctx) => section(b, ctx, `<div class="md">${ctx.md(b.md)}</div>`);

export const split = (b, ctx) => section({ ...b, heading: null }, ctx, `<div class="split${b.reverse ? ' split--reverse' : ''}">
      <div class="split__media media">${picture(b.image, b.imageAlt, ctx, { sizes: '(min-width: 1024px) 560px, 100vw' })}</div>
      <div class="split__copy">
        ${b.eyebrow ? `<p class="eyebrow">${ctx.h.esc(b.eyebrow)}</p>` : ''}
        ${b.heading ? `<h2 class="block__title" id="${ctx.uid('blk-' + ctx.h.slug(b.heading))}">${ctx.inline(b.heading)}</h2>` : ''}
        <div class="md">${ctx.md(b.md)}</div>
        ${buttons(b.ctas, ctx)}
      </div>
    </div>`);

export function cards(b, ctx) {
  const cols = [2, 3, 4, 5].includes(Number(b.columns)) ? Number(b.columns) : 3;   // 5: compact icon tiles (an extension of §3.1)
  const card = (it, i) => {
    const titleId = ctx.uid('card-' + ctx.h.slug(it.title));
    const title = it.href ? `<a class="cover-link" href="${ctx.h.esc(ctx.h.href(it.href))}"${it.locator ? ' data-locator-open aria-haspopup="dialog"' : ''}>${ctx.inline(it.title)}</a>` : ctx.inline(it.title);
    return `<li class="cards__item">
        <article class="cards__card card${it.href ? ' card--lift' : ''}" aria-labelledby="${titleId}">
          ${it.image ? `<div class="cards__media media">${picture(it.image, it.imageAlt, ctx, { sizes: `(min-width: 1024px) ${Math.round(1200 / cols)}px, (min-width: 640px) 50vw, 100vw` })}</div>` : ''}
          <div class="cards__body">
            ${it.icon ? `<span class="cards__icon" aria-hidden="true">${ctx.h.icon(it.icon, { size: 26 })}</span>` : ''}
            ${it.tag ? `<span class="tag cards__tag">${ctx.h.esc(it.tag)}</span>` : ''}
            <h3 class="cards__title" id="${titleId}">${title}</h3>
            ${it.md ? `<div class="cards__text md">${ctx.md(it.md)}</div>` : ''}
            ${it.href ? `<span class="cards__go" aria-hidden="true">${ctx.h.icon('arrow', { size: 18 })}</span>` : ''}
          </div>
        </article>
      </li>`;
  };
  return section(b, ctx, `<ul class="cards cards--${cols}">
      ${b.items.map(card).join('\n      ')}
    </ul>`);
}

export const linkGrid = (b, ctx) => section(b, ctx, `<div class="linkgrid">
      ${b.groups.map((g) => {
        const gid = ctx.uid('lg-' + ctx.h.slug(g.title));
        return `<nav class="linkgrid__group" aria-labelledby="${gid}">
        <h3 class="linkgrid__title" id="${gid}">${ctx.inline(g.title)}</h3>
        <ul class="linkgrid__links">${g.links.map((l) => `<li><a href="${ctx.h.esc(ctx.h.href(l.href))}">${ctx.h.esc(l.text)}</a></li>`).join('')}</ul>
      </nav>`;
      }).join('\n      ')}
    </div>`);

export const steps = (b, ctx) => section(b, ctx, `<ol class="steps">
      ${b.items.map((it) => `<li class="steps__item"><h3 class="steps__title">${ctx.inline(it.title)}</h3><div class="steps__text md">${ctx.md(it.md)}</div></li>`).join('\n      ')}
    </ol>`);

export function list(b, ctx) {
  const style = ['check', 'dot', 'number'].includes(b.style) ? b.style : 'dot';
  const tag = style === 'number' ? 'ol' : 'ul';
  return section(b, ctx, `<${tag} class="blist blist--${style}">
      ${b.items.map((it) => `<li>${style === 'check' ? `<span class="blist__icon" aria-hidden="true">${ctx.h.icon('check', { size: 20 })}</span>` : ''}<div class="blist__text">${ctx.md(it)}</div></li>`).join('\n      ')}
    </${tag}>`);
}

// details/summary (v2's accordion kit: one open at a time, data-accordion) + FAQPage JSON-LD
export function faq(b, ctx) {
  ctx.jsonld(ctx.ld.faq(b.items));
  return section(b, ctx, `<div class="acc faq" data-accordion>
      ${b.items.map((it) => `<details class="acc__item faq__item">
        <summary class="acc__q faq__q"><span class="faq__qtext">${ctx.inline(it.q)}</span><span class="acc__icon" aria-hidden="true">${ctx.h.icon('plus', { size: 22 })}</span></summary>
        <div class="acc__a faq__a md">${ctx.md(it.a)}</div>
      </details>`).join('\n      ')}
    </div>`);
}

export function callout(b, ctx) {
  const tone = ['info', 'warn', 'legal'].includes(b.tone) ? b.tone : 'info';
  const icon = { info: 'spark', warn: 'bolt', legal: 'check' }[tone];
  return section({ ...b, heading: null }, ctx, `<aside class="callout callout--${tone} callout--block" role="note">
      <span class="callout__icon" aria-hidden="true">${ctx.h.icon(icon, { size: 22 })}</span>
      <div class="callout__body">${b.heading ? `<p class="callout__title">${ctx.inline(b.heading)}</p>` : ''}<div class="md">${ctx.md(b.md)}</div></div>
    </aside>`);
}

export function table(b, ctx) {
  const cap = b.caption ? `<caption>${ctx.inline(b.caption)}</caption>` : '';
  return section(b, ctx, `<div class="md-table" role="region" tabindex="0" aria-label="${ctx.h.esc(b.caption || b.heading || ctx.ui.tableLabel)}"><table>${cap}
      <thead><tr>${b.columns.map((c) => `<th scope="col">${ctx.inline(c)}</th>`).join('')}</tr></thead>
      <tbody>${b.rows.map((r) => `<tr>${b.columns.map((_, k) => `<td>${ctx.inline(r[k] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`);
}

export function cta(b, ctx) {
  const ground = b.ground === 'black' ? 'black' : 'red';
  const id = ctx.uid('cta-' + ctx.h.slug(b.heading));
  return `<section class="block block--cta theme-${ground}" aria-labelledby="${id}">
  <div class="checker block__checker" aria-hidden="true"></div>
  <div class="block__inner cta">
    <h2 class="cta__title" id="${id}">${ctx.inline(b.heading)}</h2>
    ${b.md ? `<div class="cta__text md">${ctx.md(b.md)}</div>` : ''}
    ${buttons(b.ctas, ctx)}
  </div>
</section>`;
}

// one picture with its caption, or a row of pictures ("images": [{ image, alt }], e.g. a service-area page's photos)
export const media = (b, ctx) => section(b, ctx, Array.isArray(b.images) && b.images.length ? `<ul class="bmedia__grid" role="list"${b.label ? ` aria-label="${ctx.h.esc(b.label)}"` : ''}>
      ${b.images.map((im) => `<li class="bmedia__item"><div class="bmedia__frame bmedia__frame--tile media">${picture(im.image, im.alt, ctx, { sizes: '(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw' })}</div></li>`).join('\n      ')}
    </ul>` : `<figure class="bmedia">
      <div class="bmedia__frame media">${picture(b.image, b.imageAlt, ctx, { sizes: '(min-width: 1280px) 1200px, 100vw' })}</div>
      ${b.caption ? `<figcaption class="bmedia__cap">${ctx.inline(b.caption)}</figcaption>` : ''}
    </figure>`);
