// _stubs.mjs — STUB renderers for the blocks other lanes own (contract §6). They render their data PLAINLY so every
// page builds end to end; the owning lane replaces src/blocks/<type>.mjs with the real design.
//   stores lane:    store-details, store-grid, amenities, deals, rewards, reviews, nearby, menu-placeholder
//   editorial lane: article-list (a working version: the home and the blog indexes use it)
import { section, buttons } from './_kit.mjs';

const storeOf = (slug, ctx) => {
  const s = ctx.site.stores.find((x) => x.slug === slug);
  if (!s) throw new Error('unknown store "' + slug + '" (site.json stores)');
  return s;
};
const facts = (s, ctx) => {
  const e = ctx.h.esc;
  return `<dl class="stub-facts">
        <div><dt>${e(s.labels.address)}</dt><dd>${s.address.lines.map(e).join('<br>')}</dd></div>
        <div><dt>${e(s.labels.phone)}</dt><dd><a href="${e(s.phone.href)}">${e(s.phone.text)}</a></dd></div>
        <div><dt>${e(s.hours.days)}</dt><dd>${e(s.hours.text)}</dd></div>
      </dl>`;
};

// STUB (stores lane)
export const storeDetails = (b, ctx) => {
  const s = storeOf(b.store, ctx);
  return section(b, ctx, `<div class="stub stub--store-details">${facts(s, ctx)}
      ${buttons([{ text: s.labels.order, href: s.shopPath }, { text: ctx.ui.call, href: s.phone.href }], ctx, { size: 'sm' })}</div>`);
};

// STUB (stores lane)
export const storeGrid = (b, ctx) => {
  const list = b.stores === 'all' || !b.stores ? ctx.site.stores : b.stores.map((x) => storeOf(x, ctx));
  return section(b, ctx, `<ul class="stub stub--store-grid">
      ${list.map((s) => `<li class="stub-card"><h3 class="stub-card__title"><a href="${ctx.h.esc(ctx.h.href(s.locationPath))}">${ctx.h.esc(s.name)}</a></h3>${facts(s, ctx)}</li>`).join('\n      ')}
    </ul>`);
};

// STUB (stores lane)
export const amenities = (b, ctx) => section(b, ctx, `<ul class="stub stub--amenities">${(b.items || []).map((it) => `<li><strong>${ctx.inline(it.label)}</strong>${it.md ? ' ' + ctx.inline(it.md) : ''}</li>`).join('')}</ul>`);

// STUB (stores lane): the deals of site.json (home.json's own)
export const deals = (b, ctx) => {
  const D = ctx.site.deals, e = ctx.h.esc;
  const offer = (d) => `<li class="stub-card"><h3 class="stub-card__title">${d.href && d.href !== '#' ? `<a href="${e(ctx.h.href(d.href))}">${e(d.heading)}</a>` : e(d.heading)}</h3><p>${e([d.free, d.brand, d.weight, ...(d.caption || []).map((p) => p.text)].filter(Boolean).join(' · '))}</p></li>`;
  const banner = (d) => `<li class="stub-card"><a href="${e(ctx.h.href(d.href))}">${ctx.h.img(d.img.src, { alt: d.img.alt, sizes: '(min-width: 768px) 560px, 100vw' })}</a></li>`;
  return section(b, ctx, `<ul class="stub stub--deals">${D.cards.map(offer).join('')}${D.banners.map(banner).join('')}</ul>`);
};

// STUB (stores lane)
export const rewards = (b, ctx) => section(b, ctx, `<div class="stub stub--rewards md">${b.md ? ctx.md(b.md) : ''}${(b.items || []).length ? `<ul>${b.items.map((x) => `<li>${ctx.inline(x)}</li>`).join('')}</ul>` : ''}</div>`);

// STUB (stores lane): verbatim reviews
export const reviews = (b, ctx) => section(b, ctx, `<ul class="stub stub--reviews">${(b.items || []).map((r) => `<li class="stub-card"><blockquote><p>${ctx.h.esc(r.text)}</p></blockquote>${r.author ? `<p class="stub-card__by">${ctx.h.esc(r.author)}</p>` : ''}</li>`).join('')}</ul>`);

// STUB (stores lane): the other stores, by name
export const nearby = (b, ctx) => {
  const here = storeOf(b.store, ctx);
  const others = ctx.site.stores.filter((s) => s.slug !== here.slug);
  return section(b, ctx, `<ul class="stub stub--nearby">${others.map((s) => `<li><a href="${ctx.h.esc(ctx.h.href(s.locationPath))}">${ctx.h.esc(s.name)}</a></li>`).join('')}</ul>`);
};

// STUB (stores lane): the live menu notice
export const menuPlaceholder = (b, ctx) => {
  const s = b.store ? storeOf(b.store, ctx) : null;
  return section(b, ctx, `<div class="stub stub--menu md">${b.md ? ctx.md(b.md) : ''}${buttons([{ text: s ? s.labels.order : ctx.home.hero.order.text, href: '{{location_shop_url}}' }], ctx, { size: 'lg' })}</div>`);
};

// editorial lane owns this block; core ships a working version (the home and the blog indexes need it).
// posts: [slugs] | { category, limit } | { limit } (newest first). Each card: the typographic cover (the category's
// name on its ground, the trophy watermark), the title, the excerpt, the date.
export function articleList(b, ctx) {
  const all = ctx.articles;
  let list;
  if (Array.isArray(b.posts)) list = b.posts.map((slug) => { const a = all.find((x) => x.slug === slug); if (!a) throw new Error('article-list: unknown post ' + slug); return a; });
  else { const q = b.posts || {}; list = all.filter((a) => !q.category || a.category === q.category).slice(0, q.limit || 3); }
  const items = b.items || list;
  const e = ctx.h.esc;
  const inner = items.length ? `<ul class="posts">
      ${items.map((a) => {
        const tid = ctx.uid('post-' + a.slug);
        return `<li class="posts__item">
        <article class="post card card--lift" aria-labelledby="${tid}">
          <div class="post__cover cover cover--${e(a.category)}" aria-hidden="true"><span class="cover__cat">${e(a.categoryName)}</span><span class="cover__mark"></span></div>
          <div class="post__body">
            <p class="post__meta"><span class="tag">${e(a.categoryName)}</span><time datetime="${e(a.published)}">${e(a.dateText)}</time></p>
            <h3 class="post__title" id="${tid}"><a class="cover-link" href="${e(ctx.h.href(a.path))}">${e(a.h1)}</a></h3>
            <p class="post__excerpt">${e(a.excerpt)}</p>
          </div>
        </article>
      </li>`;
      }).join('\n      ')}
    </ul>` : `<p class="posts__none">${e(ctx.ui.noArticles)}</p>`;
  return section(b, ctx, inner + (b.more ? buttons([{ text: b.more.text, href: b.more.href, style: 'ghost' }], ctx, { size: 'lg' }) : '') + (b.afterHtml || ''));
}
