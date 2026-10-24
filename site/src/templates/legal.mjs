// legal.mjs — legal pages (/privacy-policy/, /terms-and-conditions/): real (core ships it; the pages lane owns the
// words). The page hero, then the text in one reading column on white. No legal text is ever written here: the page
// JSON holds it (today High Society's holding lines; the client supplies the policies).
import { crumbs, hero, blocks, pageLd } from './_shell.mjs';

export const meta = { name: 'legal', owner: 'pages', stub: false };

export function render(page, ctx) {
  const c = crumbs(page, ctx);
  return {
    main: `${hero(page, ctx, { crumbsHtml: c.html, cls: 'page-hero--compact' })}
<div class="page__body page__body--reading" data-template="legal">
${blocks(page.blocks, ctx, { grounds: ['white'] })}
</div>`,
    mainClass: 'page page--legal',
    jsonld: pageLd(page, ctx, c.items),
  };
}
