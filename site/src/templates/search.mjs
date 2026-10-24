// search.mjs — /search/: real (core). A GET form (q) and the results region; src/scripts/pages/search.js reads
// /search-index.json (the build writes it: every page's title, h1, description, kind) and lists the matches. Without
// scripts the form still submits and the page points to the site map.
import { crumbs, hero, pageLd } from './_shell.mjs';

export const meta = { name: 'search', owner: 'pages', stub: false };

export function render(page, ctx) {
  const c = crumbs(page, ctx), e = ctx.h.esc, ui = ctx.ui;
  const form = `<form class="search search--page" role="search" action="${e(ctx.h.href('/search/'))}" method="get">
      <label class="search__label" for="search-page">${e(ui.searchLabel)}</label>
      <div class="search__row">
        <input class="search__input" id="search-page" name="q" type="search" placeholder="${e(ui.searchPlaceholder)}" autocomplete="off" enterkeyhint="search">
        <button class="btn btn--primary btn--lg search__submit" type="submit">${ctx.h.icon('search', { size: 18 })}${e(ui.searchSubmit)}</button>
      </div>
    </form>`;
  return {
    main: `${hero(page, ctx, { crumbsHtml: c.html, cls: 'page-hero--compact' })}
<div class="page__body" data-template="search">
<section class="block block--search theme-white" aria-label="${e(ui.searchResults)}">
  <div class="block__inner">
    ${form}
    <p class="search__status" data-search-status role="status"></p>
    <ol class="search__results" data-search-results data-index="${e(ctx.h.asset('search-index.json'))}" data-root="${e(ctx.h.root)}" data-none="${e(ui.searchNone)}" data-count="${e(ui.searchCount)}"></ol>
    <p class="search__fallback" data-search-fallback>${e(ui.searchNeedsJs)} <a href="${e(ctx.h.href('/site-map/'))}">${e(ui.siteMapLink)}</a></p>
  </div>
</section>
</div>`,
    mainClass: 'page page--search',
    jsonld: pageLd(page, ctx, c.items),
  };
}
