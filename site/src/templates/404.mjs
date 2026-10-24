// 404.mjs — dist/404.html: real (core). Served by the host at ANY depth, so the build renders it with root-relative
// URLs ("/assets/…", "/deals/"; h is made with absolute: true) and the preview step re-prefixes them with the repo
// path. The hero says what happened and offers the way on (the page JSON's CTAs), then the site search.
import { hero } from './_shell.mjs';

export const meta = { name: '404', owner: 'pages', stub: false };

export function render(page, ctx) {
  const e = ctx.h.esc, ui = ctx.ui;
  const form = `<form class="search search--page search--404" role="search" action="${e(ctx.h.href('/search/'))}" method="get">
      <label class="search__label" for="search-404">${e(ui.searchLabel)}</label>
      <div class="search__row">
        <input class="search__input" id="search-404" name="q" type="search" placeholder="${e(ui.searchPlaceholder)}" autocomplete="off" enterkeyhint="search">
        <button class="btn btn--ghost btn--lg search__submit" type="submit">${ctx.h.icon('search', { size: 18 })}${e(ui.searchSubmit)}</button>
      </div>
    </form>`;
  return {
    main: hero(page, ctx, { cls: 'page-hero--404', after: form }),
    mainClass: 'page page--404',
    jsonld: [ctx.ld.webPage({ name: page.h1, path: '/404.html', description: page.metaDescription })],
  };
}
