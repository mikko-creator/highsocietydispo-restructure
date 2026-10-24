// _shell.mjs — the inner-page shell every template builds on (core). One brand with the v2 home:
//   the page hero band: the ink ground (or the page's photo under v2's black scrim), the trophy mark huge and faint,
//   the breadcrumb, the eyebrow, the h1 in the display face, the lead, the actions, v2's checkered strip at its foot
//   the body: the blocks as bands on white / headlight grounds (reading measure ~70ch for prose), CTAs on red or ink
//
//   crumbs(page, ctx)        -> { html, items }   (page.breadcrumbs, else derived from the path and the built pages)
//   hero(page, ctx, opts)    -> html
//   blocks(list, ctx, opts)  -> html              (each block through src/blocks/<type>.mjs)
//   stubPage(page, ctx, meta)-> { main, jsonld }  (the generic STUB template: breadcrumb + h1 + lead + every block)

export function crumbs(page, ctx) {
  const items = page.breadcrumbs ? page.breadcrumbs.map((b) => ({ name: b.name, path: b.path })) : derive(page, ctx);
  const e = ctx.h.esc;
  const html = `<nav class="crumbs" aria-label="${e(ctx.ui.breadcrumb)}"><ol class="crumbs__list">${items.map((it, i) => {
    const last = i === items.length - 1;
    return `<li class="crumbs__item">${!last && it.path ? `<a href="${e(ctx.h.href(it.path))}">${e(it.name)}</a>` : `<span${last ? ' aria-current="page"' : ''}>${e(it.name)}</span>`}</li>`;
  }).join('')}</ol></nav>`;
  return { html, items };
}
function derive(page, ctx) {
  const out = [{ name: ctx.ui.home, path: '/' }];
  const segs = page.path.split('/').filter(Boolean);
  for (let i = 1; i < segs.length; i++) {
    const p = '/' + segs.slice(0, i).join('/') + '/';
    const hit = ctx.pages.get(p);
    if (hit) out.push({ name: hit.crumb || hit.h1, path: p });
  }
  out.push({ name: page.crumb || page.h1 });
  return out;
}

export function hero(page, ctx, { crumbsHtml = '', after = '', cls = '' } = {}) {
  const H = page.hero || {}, e = ctx.h.esc;
  const photo = H.image ? ctx.h.img(H.image, { alt: H.imageAlt || '', cls: 'page-hero__photo', sizes: '100vw', eager: true, priority: true, extra: { 'data-lcp': true } }) : '';
  const ctas = (H.ctas || []).map((c, i) => `<a class="btn ${c.style ? 'btn--' + c.style : i ? 'btn--ghost' : 'btn--primary'} btn--lg" href="${e(ctx.h.href(c.href))}"${c.locator ? ' data-locator-open aria-haspopup="dialog"' : ''}>${e(c.text)}</a>`).join('');
  return `<section class="page-hero theme-black${photo ? ' page-hero--photo' : ''}${cls ? ' ' + cls : ''}" aria-labelledby="page-title">
  <div class="page-hero__bg" aria-hidden="true">${photo}${photo ? '<div class="page-hero__scrim"></div>' : ''}<span class="page-hero__mark"></span></div>
  <div class="page-hero__inner">
    ${crumbsHtml}
    ${H.eyebrow ? `<p class="eyebrow page-hero__eyebrow">${e(H.eyebrow)}</p>` : ''}
    <h1 class="page-hero__title" id="page-title">${e(page.h1)}</h1>
    ${H.lead ? `<div class="page-hero__lead">${ctx.md(H.lead)}</div>` : ''}
    ${ctas ? `<div class="page-hero__ctas">${ctas}</div>` : ''}
    ${after}
  </div>
  <div class="checker page-hero__checker" aria-hidden="true"></div>
</section>`;
}

export function blocks(list, ctx, { grounds = ['white', 'headlight'] } = {}) {
  return (list || []).map((b, i) => {
    const r = ctx.blockRenderers[b.type];
    if (!r) throw new Error('unknown block type "' + b.type + '" on ' + ctx.page.path);
    return r({ ...b }, { ...ctx, ground: b.ground || grounds[i % grounds.length] });
  }).join('\n');
}

// the standard JSON-LD of an inner page: WebPage + BreadcrumbList
export function pageLd(page, ctx, items) {
  return [ctx.ld.webPage({ name: page.h1, path: page.path, description: page.metaDescription }), ctx.ld.breadcrumbs(items)];
}

// THE GENERIC STUB: breadcrumb + h1 + hero lead + every block. The owning lane replaces the template that calls it.
export function stubPage(page, ctx, meta) {
  const c = crumbs(page, ctx);
  const main = `${hero(page, ctx, { crumbsHtml: c.html })}
<div class="page__body" data-template="${ctx.h.esc(meta.name)}" data-stub="${ctx.h.esc(meta.owner)}">
${blocks(page.blocks, ctx)}
</div>`;
  return { main, mainClass: `page page--${meta.name}`, jsonld: pageLd(page, ctx, c.items) };
}
