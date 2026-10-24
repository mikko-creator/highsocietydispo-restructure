// deals.mjs — /deals/ (stores lane; contract §6): the deals High Society publishes (the v2 home's own cards and
// banners), deals by store, member perks, order ahead, the small print, the app. WebPage + BreadcrumbList.
import { renderStorePage } from './_storepage.mjs';

export const meta = { name: 'deals', owner: 'stores', stub: false };

export const render = (page, ctx) => renderStorePage(page, ctx, meta);
