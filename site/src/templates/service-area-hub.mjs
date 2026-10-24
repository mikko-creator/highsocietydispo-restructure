// service-area-hub.mjs — a store's "Areas We Serve" page (stores lane; contract §6): the hero (High Society's own
// promise and actions), the area route cards (template part "routes"), what to expect, the FAQ, the store card,
// reviews, the state-law pointer. WebPage + BreadcrumbList; FAQPage from the FAQ block.
import { renderStorePage } from './_storepage.mjs';

export const meta = { name: 'service-area-hub', owner: 'stores', stub: false };

export const render = (page, ctx) => renderStorePage(page, ctx, meta, { heroCls: 'page-hero--area' });
