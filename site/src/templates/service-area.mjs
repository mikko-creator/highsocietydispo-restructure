// service-area.mjs — one service-area page (stores lane; contract §6): High Society's own page for travellers from a
// nearby area to its store: the hero, the store at a glance, directions and parking, fast pickup, what people buy,
// trip notes, the state-law pointer, reviews, the FAQ, the store card. WebPage + BreadcrumbList; FAQPage from the FAQ.
import { renderStorePage } from './_storepage.mjs';

export const meta = { name: 'service-area', owner: 'stores', stub: false };

export const render = (page, ctx) => renderStorePage(page, ctx, meta, { heroCls: 'page-hero--area' });
