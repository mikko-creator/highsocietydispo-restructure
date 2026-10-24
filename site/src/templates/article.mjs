// article.mjs — one blog article (/blog/<slug>/). Owner: the editorial lane. Contract §4, in reading order:
//   the hero (ink): breadcrumb (Home / Blog / category / title), the category chip (+ "jump to recipe"), h1, dek
//     (excerpt), byline, date, read time; at the right on wide screens (below on phones) the typographic cover
//   the reading area (white): the contents (from the body's ## headings, then the recipe and the FAQ; a column at the
//     left that stays in view on wide screens, a folding box above the reading column on phones: pages/article.js),
//     then the reading column: key takeaways (a pit board), the body, the recipe card (Recipe JSON-LD), the FAQ
//     (FAQPage JSON-LD), the sources, the responsible-use note (21+, Michigan)
//   related articles (0 to 4; none, no band), then the closing call to action: the shop / locations CTA, EXCEPT on an
//     article whose brief riskLevel is "medical": that one ends with the education CTA (medical card + patient guide)
//     and never a shop link, so a health topic is not tied to a purchase (Michigan R 420.507; facts/law-facts.json
//     mi-advertising). The build marks such pages <body data-risk="medical"> and chrome.css hides the ORDER NOW dock.
// Headings: h1 > h2 (takeaways, body sections, recipe, FAQ, sources, related, CTA) > h3: no level is skipped.
// JSON-LD: Article, BreadcrumbList (+ Recipe, FAQPage). Words: the article JSON, site.json (ui, blog) and the blog page's
// own JSON (labels, the education CTA); never this file.
import { crumbs } from './_shell.mjs';
import { cover, postList, label } from '../blocks/article-list.mjs';

export const meta = { name: 'article', owner: 'editorial', stub: false };

const isMedical = (a) => !!(a.brief && a.brief.riskLevel === 'medical');
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

// The links in rendered HTML that lead to a purchase: a CMS token (the store menu), the shop, the deals, the rewards
// pages or a store's category menu (/<store>/<category>/). Every href is resolved first (page-relative, a site path or
// an absolute URL on the site's own origin), so "/shop", "../../deals/#x" and "https://<origin>/shop/" all count, and
// Markdown links in the copy count as much as buttons. Used on health articles (Michigan R 420.507).
function purchaseLinks(html, pagePath, ctx) {
  const origin = new URL(ctx.site.origin);
  const host = origin.hostname.replace(/^www\./, '');
  const stores = new Set((ctx.site.stores || []).map((s) => String(s.shopPath || '').split('/').filter(Boolean).pop()).filter(Boolean));
  const out = [];
  for (const m of html.matchAll(/\shref="([^"]*)"/g)) {
    const href = m[1].replace(/&amp;/g, '&');
    if (href.includes('{{')) { out.push(href); continue; }
    let u;
    try { u = new URL(href, origin.origin + pagePath); } catch { out.push(href); continue; }
    if (u.hostname.replace(/^www\./, '') !== host) continue;
    const p = u.pathname.replace(/\/?$/, '/'), seg = p.split('/').filter(Boolean);
    if (/^\/(shop|deals|loyalty|club-member-program)\//.test(p) || (seg.length === 2 && stores.has(seg[0]))) out.push(href);
  }
  return out;
}

// The <title>: the article's SEO title + the brand suffix, unless that runs past 65 characters (a search result shows
// about 60): then the title alone (contract §4 keeps an article title within 60). The build reads page.titleFull after
// render, so setting it here is how a template chooses the full title.
const TITLE_MAX = 65;

export function render(page, ctx) {
  const a = page, e = ctx.h.esc, ui = ctx.ui, B = ctx.site.blog;
  if (!a.titleFull && a.title && (a.title + ctx.site.brand.titleSuffix).length > TITLE_MAX && a.title.length <= TITLE_MAX) a.titleFull = a.title;
  const blogPage = ctx.pages.get(B.path) || {};
  const catPath = B.path + a.category + '/';
  const c = crumbs({ ...page, breadcrumbs: [{ name: ui.home, path: '/' }, { name: blogPage.crumb || B.name, path: B.path }, { name: a.categoryName, path: catPath }, { name: a.h1 }] }, ctx);
  const jsonld = [ctx.ld.article(a, ctx.site), ctx.ld.breadcrumbs(c.items)];

  // ids first, so a body heading with the same words gets the -2 (md.mjs shares the page's id set)
  const ids = { toc: ctx.uid('toc'), takeaways: ctx.uid('takeaways'), recipe: a.recipe ? ctx.uid('recipe') : null, recipeH: a.recipe ? ctx.uid('recipe-title') : null, faq: (a.faq || []).length ? ctx.uid('faq') : null, faqH: (a.faq || []).length ? ctx.uid('faq-title') : null, sources: (a.sources || []).length ? ctx.uid('sources') : null };
  const doc = ctx.mdDoc(a.body);
  const sections = doc.toc.filter((t) => t.level === 2);

  // ---- the hero
  const recipeJump = ids.recipe ? `<a class="article__jump" href="#${e(ids.recipe)}">${e(label(ctx, 'jumpToRecipe'))}${ctx.h.icon('arrow-down', { size: 16 })}</a>` : '';
  const hero = `<header class="page-hero page-hero--compact article__hero theme-black">
  <div class="page-hero__bg" aria-hidden="true"><span class="page-hero__mark"></span></div>
  <div class="page-hero__inner article__heroin">
    <div class="article__lede">
      ${c.html}
      <p class="article__kicker"><a class="article__chip" href="${e(ctx.h.href(catPath))}"><span class="tag">${e(a.categoryName)}</span></a>${recipeJump}</p>
      <h1 class="page-hero__title article__title" id="page-title">${e(a.h1)}</h1>
      <p class="article__dek">${e(a.excerpt)}</p>
      <p class="article__byline"><span class="article__by"><span class="article__avatar" aria-hidden="true"></span>${e(ui.byline)}</span><span class="article__facts"><span class="article__when"><span class="visually-hidden">${e(ui.published)} </span><time datetime="${e(a.published)}">${e(a.dateText)}</time></span><span class="article__read">${ctx.h.icon('clock', { size: 16 })}${e(a.readMinutes + ' ' + ui.minRead)}</span></span></p>
    </div>
    <div class="article__cover">${cover(a, ctx, { size: 'hero' })}</div>
  </div>
  <div class="checker page-hero__checker" aria-hidden="true"></div>
</header>`;

  // ---- key takeaways: a pit board (ink panel, checkered top)
  const takeaways = (a.keyTakeaways || []).length ? `<aside class="article__takeaways theme-black" aria-labelledby="${ids.takeaways}">
        <h2 class="article__boxtitle" id="${ids.takeaways}">${e(ui.keyTakeaways)}</h2>
        <ul class="takeaways">${a.keyTakeaways.map((t) => `<li><span class="takeaways__icon" aria-hidden="true">${ctx.h.icon('check', { size: 20 })}</span><span class="takeaways__text">${ctx.inline(t)}</span></li>`).join('')}</ul>
      </aside>` : '';

  // ---- the contents: the body's ## sections, then the recipe and the FAQ
  const extra = [ids.recipe && { id: ids.recipe, text: ui.recipe }, ids.faq && { id: ids.faq, text: ui.faq }].filter(Boolean);
  const tocHtml = sections.length > 1 ? `<nav class="article__toc toc" aria-labelledby="${ids.toc}" data-toc>
        <details class="toc__box" open>
          <summary class="toc__sum"><span class="toc__title" id="${ids.toc}">${e(ui.toc)}</span><span class="toc__icon" aria-hidden="true">${ctx.h.icon('chevron', { size: 18 })}</span></summary>
          <ol class="toc__list">${sections.map((t) => `<li class="toc__item"><a class="toc__link" href="#${e(t.id)}">${e(t.text)}</a></li>`).join('')}${extra.map((t) => `<li class="toc__item toc__item--extra"><a class="toc__link" href="#${e(t.id)}">${e(t.text)}</a></li>`).join('')}</ol>
        </details>
        <span class="toc__progress" aria-hidden="true"><span class="toc__bar"></span></span>
      </nav>` : '';

  // ---- the recipe card
  let recipe = '';
  if (a.recipe) {
    const R = a.recipe;
    jsonld.push(ctx.ld.recipe(R, a, ctx.site));
    const fact = (k, v, icon) => (v ? `<div class="recipe__fact"><dt>${ctx.h.icon(icon, { size: 18 })}${e(ui[k])}</dt><dd>${e(v)}</dd></div>` : '');
    const facts = fact('recipeYield', R.yield, 'leaf') + fact('prepTime', R.prepTime, 'clock') + fact('cookTime', R.cookTime, 'clock');
    recipe = `<section class="recipe" id="${ids.recipe}" aria-labelledby="${ids.recipeH}">
        <header class="recipe__head theme-black">
          <h2 class="recipe__title" id="${ids.recipeH}">${e(ui.recipe)}</h2>
          ${facts ? `<dl class="recipe__facts">${facts}</dl>` : ''}
        </header>
        <div class="recipe__body">
          <div class="recipe__part">
            <h3 class="recipe__sub">${e(ui.ingredients)}</h3>
            <ul class="recipe__ing">${(R.ingredients || []).map((x) => `<li>${ctx.inline(x)}</li>`).join('')}</ul>
          </div>
          <div class="recipe__part">
            <h3 class="recipe__sub">${e(ui.steps)}</h3>
            <ol class="recipe__steps">${(R.steps || []).map((x) => `<li><div class="md">${ctx.md(x)}</div></li>`).join('')}</ol>
          </div>
          ${R.dosingNote ? `<aside class="callout callout--warn recipe__note" role="note"><span class="callout__icon" aria-hidden="true">${ctx.h.icon('bolt', { size: 22 })}</span><div class="callout__body"><p class="callout__title">${e(ui.dosingNote)}</p><div class="md">${ctx.md(R.dosingNote)}</div></div></aside>` : ''}
        </div>
      </section>`;
  }

  // ---- the FAQ (v2's accordion: one open at a time)
  let faq = '';
  if (ids.faq) {
    jsonld.push(ctx.ld.faq(a.faq));
    faq = `<section class="article__faq" id="${ids.faq}" aria-labelledby="${ids.faqH}">
        <h2 class="article__sectitle" id="${ids.faqH}">${e(ui.faq)}</h2>
        <div class="acc faq" data-accordion>${a.faq.map((it) => `<details class="acc__item faq__item"><summary class="acc__q faq__q"><span class="faq__qtext">${ctx.inline(it.q)}</span><span class="acc__icon" aria-hidden="true">${ctx.h.icon('plus', { size: 22 })}</span></summary><div class="acc__a faq__a md">${ctx.md(it.a)}</div></details>`).join('')}</div>
      </section>`;
  }

  // ---- the sources (a cited work's title in <cite>; the link's host beside it)
  const sources = ids.sources ? `<section class="article__sources" aria-labelledby="${ids.sources}">
        <h2 class="article__sectitle article__sectitle--sm" id="${ids.sources}">${e(ui.sources)}</h2>
        <ol class="sources">${a.sources.map((s) => {
          const linked = /^https?:\/\//i.test(String(s.url || ''));
          const host = linked ? hostOf(s.url) : '';
          return `<li class="sources__item">${linked ? `<a class="sources__link" href="${e(ctx.h.href(s.url))}" rel="noopener"><cite class="sources__label">${e(s.label)}</cite>${host ? `<span class="sources__host">${e(host)}${ctx.h.icon('arrow-up-right', { size: 14 })}</span>` : ''}</a>` : `<cite class="sources__label">${e(s.label)}</cite>`}</li>`;
        }).join('')}</ol>
      </section>` : '';

  // ---- the responsible-use note (site.json blog.responsibleUse)
  const note = `<aside class="article__note" role="note"><span class="article__badge" aria-hidden="true">${e(label(ctx, 'ageBadge'))}</span><div class="md">${ctx.md(B.responsibleUse)}</div></aside>`;

  // ---- related (unwritten slugs were left out by the build) and the closing CTA
  const related = (a.related || []).map((slug) => ctx.articles.find((x) => x.slug === slug)).filter(Boolean).slice(0, 4);
  const relId = related.length ? ctx.uid('blk-related') : null;
  const relatedHtml = related.length ? `<section class="block block--article-list posts-band posts-band--related theme-headlight" aria-labelledby="${relId}">
  <div class="block__inner">
    <header class="block__head"><h2 class="block__title" id="${relId}">${e(ui.related)}</h2></header>
    ${postList(related, ctx, { layout: 'related', level: 3 })}
  </div>
</section>` : '';
  const medical = isMedical(a);
  const ctaData = medical ? blogPage.ctaMedical : B.cta;
  if (!ctaData) throw new Error(`no closing CTA for ${a.path}: ${medical ? B.path + ' ctaMedical' : 'site.json blog.cta'} is missing`);
  const cta = ctx.blockRenderers.cta({ type: 'cta', ...ctaData, ground: medical ? 'black' : ctaData.ground }, { ...ctx });
  // a health article ties no purchase to its topic: the template's own parts of it (the education CTA, the 21+ note)
  // carry no shop, deal, menu or rewards link, checked on what is rendered (buttons and Markdown links alike)
  if (medical) {
    const bad = purchaseLinks(cta + note, a.path, ctx);
    if (bad.length) throw new Error(`the education CTA (${B.path} ctaMedical) or the 21+ note (site.json blog.responsibleUse) links to a shop, deal, menu or rewards page: never on a health article (${[...new Set(bad)].join(', ')})`);
  }

  const main = `<article class="article${medical ? ' article--medical' : ''}" aria-labelledby="page-title">
${hero}
<div class="article__wrap theme-white">
  <div class="article__layout${tocHtml ? '' : ' article__layout--notoc'}">
    ${tocHtml}
    <div class="article__main">
      ${takeaways}
      <div class="article__body md">
${doc.html}
      </div>
      ${recipe}
      ${faq}
      ${sources}
      ${note}
    </div>
  </div>
</div>
${relatedHtml}
<div class="article__end${medical ? ' article__end--learn' : ''}">
${cta}
</div>
</article>`;
  return { main, mainClass: 'page page--article', jsonld };
}
