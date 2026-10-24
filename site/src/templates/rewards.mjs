// rewards.mjs — /loyalty/ and /club-member-program/ (stores lane; contract §6): The Society, High Society's loyalty
// program, in High Society's own words: the hero, the member perks, the tier table (the live site's tier image as text),
// how it works, the CMS login / sign-up slot (template part "form"), the FAQ, the app. WebPage + BreadcrumbList;
// FAQPage from the FAQ block.
import { renderStorePage } from './_storepage.mjs';

export const meta = { name: 'rewards', owner: 'stores', stub: false };

export const render = (page, ctx) => renderStorePage(page, ctx, meta);
