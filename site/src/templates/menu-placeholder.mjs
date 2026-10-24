// menu-placeholder.mjs — /shop/ and /shop/<store>/ (stores lane; contract §6). On highsocietydispo.com the CMS menu
// widget serves each store's live menu at these URLs; this static page is the chooser (/shop/) or the store's menu
// notice with its ways to order, its category menus and its details (/shop/<store>/). WebPage + BreadcrumbList.
import { renderStorePage } from './_storepage.mjs';

export const meta = { name: 'menu-placeholder', owner: 'stores', stub: false };

export const render = (page, ctx) => renderStorePage(page, ctx, meta, { heroCls: 'page-hero--compact' });
