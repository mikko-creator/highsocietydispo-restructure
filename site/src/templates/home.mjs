// home.mjs — the home (core, real). v2's sections 01-08 exactly as v2 renders them (src/sections/*.mjs, their words
// from home.json, their CMS slots ikjs2 and is209 opening <main>), then the additions in src/content/pages/home.json
// blocks, drawn as v2 sections: natural-height slides with the numbered race head, continuing v2's count.
// The chrome and the footer are src/chrome (00-chrome.mjs and 09-footer.mjs are no longer built).
import { blocks } from './_shell.mjs';

export const meta = { name: 'home', owner: 'core', stub: false };

export function render(page, ctx) {
  const body = ctx.sections.map((s) => `\n<!-- ${s.name} -->\n` + s.render(ctx.home, ctx.h, ctx.sectionCtx)).join('\n');
  const more = blocks(page.blocks, { ...ctx, homeSlides: true });
  const mainStart = ctx.h.slot('ikjs2') + ctx.h.slot('is209');
  return {
    // v2's <main> body byte for byte (its slots, a line break, its sections), then the additions
    main: `${mainStart}\n${body}${more ? '\n\n<!-- additions (src/content/pages/home.json) -->\n' + more : ''}`,
    mainClass: 'slides',
    jsonld: [ctx.ld.organization(ctx.site), ctx.ld.website(ctx.site)],
  };
}
