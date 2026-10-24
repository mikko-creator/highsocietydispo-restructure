// _kit.mjs — what every block renderer shares (core). A block renders INSIDE the page body as one band:
//   <section class="block block--<type> theme-<ground>" aria-labelledby="<id>"><div class="block__inner">…</div></section>
// Grounds: the block's own "ground" (white | headlight | black | charcoal | red), else the template's rhythm (ctx.ground).
// Headings: a block heading is an h2 (the page's h1 is the hero's); Markdown inside a block uses ## / ### as written.
//
// ctx (built per page by src/tools/build.mjs): { h, md(src) -> html, inline(src) -> html, uid(base) -> unique id,
//   ui, site, images, articles, pages, ld (seo builders), jsonld(node) (adds a JSON-LD node to the page), ground }

// On the home (ctx.homeSlides) a block is drawn as one of v2's sections: a natural-height .slide with v2's numbered
// race head (.secnum, counted by CSS after v2's own) and v2's display title.
export function section(block, ctx, inner, { cls = '', title = block.heading, lead = block.lead } = {}) {
  const ground = block.ground || ctx.ground || 'white';
  const id = title ? ctx.uid('blk-' + ctx.h.slug(title)) : null;
  const slide = !!ctx.homeSlides;
  const head = title ? `<header class="block__head${slide ? ' slide__head' : ''}">${slide ? '<div class="head__copy"><span class="secnum" aria-hidden="true"></span>' : ''}<h2 class="${slide ? 'title ' : ''}block__title" id="${id}">${ctx.inline(title)}</h2>${slide ? '</div>' : ''}${lead ? `<div class="block__lead">${ctx.md(lead)}</div>` : ''}</header>` : '';
  return `<section class="${slide ? 'slide slide--natural ' : ''}block block--${block.type} theme-${ground}${cls ? ' ' + cls : ''}"${id ? ` aria-labelledby="${id}"` : ''}>
  <div class="block__inner${slide ? ' slide__inner' : ''}">
    ${head}
    ${inner}
  </div>
</section>`;
}

// a CTA list: [{ text, href, style? }] -> buttons (the first primary unless styled)
export function buttons(ctas, ctx, { size = 'lg' } = {}) {
  if (!ctas || !ctas.length) return '';
  return `<div class="block__ctas">${ctas.map((c, i) => {
    const style = c.style || (i ? 'ghost' : 'primary');
    return `<a class="btn btn--${style} btn--${size}" href="${ctx.h.esc(ctx.h.href(c.href))}"${c.locator ? ' data-locator-open aria-haspopup="dialog"' : ''}>${ctx.h.esc(c.text)}${c.icon ? ctx.h.icon(c.icon, { size: 18 }) : ''}</a>`;
  }).join('')}</div>`;
}

// an image from images.json (the key), or nothing
export function picture(key, alt, ctx, opts = {}) {
  if (!key) return '';
  return ctx.h.img(key, { alt: alt || '', sizes: opts.sizes || '(min-width: 1024px) 50vw, 100vw', cls: opts.cls || '', eager: !!opts.eager, priority: !!opts.priority, extra: opts.extra || {} });
}
