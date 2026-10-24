# High Society: decisions and fixes for the client

Living list, started 2026-10-24. Each item was checked against High Society's own pages (the v1 clone of
highsocietydispo.com, captured 2026-09-16) unless it says otherwise. "Rebuild default" is what the new site does until
High Society answers.

## 1. Confirm before launch

| # | Question | What the pages say | Rebuild default |
|---|---|---|---|
| 1 | New Buffalo phone number | (269) 231-5213 on the store's own page, its 4 service-area pages and the store chooser; (269) 231-5123 on the home and locations-hub cards. No third-party listing found. | (269) 231-5213 everywhere |
| 2 | Charlotte street | "515 Lansing St" on the store page, chooser and maps link (and in local news and directories); "515 Lansing Rd" on the home and hub cards | 515 Lansing St everywhere |
| 3 | Lenox town | "Lenox, MI 48048" on the store page and chooser; "New Haven, MI 48048" (the ZIP's postal town) on the cards | Lenox everywhere |
| 4 | Payment methods | First-time guides: "cash, credit, or debit"; store FAQs: cash and debit; Mount Pleasant FAQ: no credit cards; New Buffalo: Cash, ATM in-store | Store pages keep High Society's own words; new pages and articles say only that cash works and options vary by store |
| 5 | Medical patients 18-20 | Every store page says patients 18+ with a card can buy | Kept on store pages; new copy does not promise it per store. Which stores hold a medical license? |
| 6 | "Vertically integrated ... from cultivation to retail" (4 store pages) | The About page says High Society works with vendors | Kept on those pages as High Society's words; never repeated in new copy |
| 7 | Loyalty tiers | Published only inside an image (Member, Silver $1,000, Gold $2,500, Diamond $5,000; raffles, random lottery, penny products) | Shown as on the live site plus a text table; Michigan's advertising rules on giveaways and raffles should be checked before launch |
| 8 | Current deals | The deals on the home page and store banners are from the capture date | /deals/ shows the home page's deals with "deals vary by store"; please send current deals |
| 9 | Legal pages | The footer names Privacy Statement, Terms of Service and EULA; no text exists | Holding pages (noindex) until High Society supplies the text |
| 10 | License numbers | The service-area hub prints a placeholder ("License: 0123456789") | No license lines until real numbers are supplied |
| 11 | Home hero's second button | The v2 home shows a button labelled "CALL TO ACTION" that opens the CMS's form popup (#sgp_4), which has no content yet | Kept as the CMS hook; please give it a label and a form (or say to remove it) |
| 12 | iPhone app | Your pages link the App Store page id6503314334; on 2026-10-24 that page returned 404 and Apple's lookup found no app | Every page that carries your own app wording keeps it until you confirm: the home, About, Contact, the FAQ ("Do you have an app? Yes."), the 8 store pages, the locations hub, Deals and the two loyalty pages. Articles never mention the app. Is the app still available? If not, those bands and the FAQ answer come out. |
| 13 | Contact and employment forms | The live pages post to the CMS (`/do_actions/do_form_submit`, forms 2 and 4) with a per-session security token that a static page cannot carry. Whether the CMS accepts a post from the new pages was not tested on purpose: a test would reach your inbox and hiring queue | The new pages keep every field and post where the live forms post. On the public preview both forms are switched off (no submit, a note says so). Should the CMS serve these two forms, or should the new pages post somewhere else? |

## 1b. Compliance calls (Michigan rule R 420.507 on marijuana marketing)

R 420.507 bars licensee marketing aimed at people under 21, and claims "related to health or health benefits" unless an
FDA-qualified health claim applies (facts/law-facts.json `mi-advertising`). A dispensary's own blog may count as
marketing, so:

- **Held, not written:** "Cannabis Near Campus: A Guide for Michigan College Towns" (the competitor runs this topic).
  Its readers would be largely under 21. Write it only if High Society's compliance advisor approves.
- **Back-to-school article:** written for parents only; it names no campus and no college-town store.
- **Health-topic articles (93 of the 276 are marked medical):** written as research summaries with sources and their
  limits, never as product claims, and they tell readers to talk to a clinician. The closest to the rule's line:
  cannabis-benefits, cbd-benefits, cbd-cannabis-skincare-benefits, cannabis-for-pain, cannabis-for-depression,
  marijuana-for-sleep, indica-strains-for-sleep, cannabis-products-for-sleep, what-is-thc-benefits-effects,
  what-is-cbn-benefits-effects, cannabis-holiday-de-stress-toolkit. Have an advisor read these before they go live.
- **"Find your vibe" tiles** (home page and the Explore menu): Sleep, Focus, Energy, Creativity, Unwinding. They link to
  articles, not to products, and there is no Pain tile. Whether effect-based navigation is acceptable at all is for the
  advisor.
- **No ORDER NOW button on health articles:** the floating ORDER NOW / CONTACT US pair is hidden on the articles marked
  medical, so no purchase prompt sits beside health content.
- **Required warnings:** R 420.507 points to the R 420.504(1)(j) warning statements for ads. The rebuild shows the
  21+ age gate and a responsible-use note on every article; whether the site footer must also carry the warning
  statements is for the advisor.
- **Calls the fact-checkers flagged in health articles (each passes the no-shop-link rule; an advisor may read them
  more strictly):**
  - cannabis-for-pain links the RSO buying guide (a blog article, not a shop page).
  - strains-to-help-you-unwind-after-work keeps the heading "Low-THC and CBD-forward options for calm without a strong
    high".
  - cannabis-pharmacist-vs-budtender walks through the in-store order steps in a section on how staff help patients.
  - cannabis-valentines-day-gift-guide is rated medical but has a gift-ideas-by-product-type section.
  - cannabis-summer-fun names Michigan's licensed consumption exception, stated neutrally.

## 2. Errors on the live site today (worth fixing now, whatever happens to the rebuild)

1. **All 8 store pages** carry another dispensary's pickup steps in a hidden block: "To place a pickup order from The
   Sweet Spot Weed Dispensary, ... Santa Rosa ... 707-843-5148". Visitors don't see it, but it is in the page source
   that search engines read.
2. **Charlotte page** lists four Big Rapids landmarks (Top Taggart Field, Big Rapids Roller Rink, R.L. Ewigleben
   Sports Complex, Roben-Hood Airport), each with turn-by-turn directions to the Big Rapids store (804 Clark St).
3. **New Buffalo page**: the FAQ answers sit under the wrong questions; "Can I consume cannabis products on-site?" has
   no answer; the pickup steps give Charlotte's number and the defective-product answer gives Big Rapids'; the call
   buttons dial Charlotte; "order now" opens the Big Rapids menu.
4. **Lenox page**: the menu line gives East Lansing's number (517) 708-8043, and the menu link opens East Lansing's menu.
5. **Locations hub**: its canonical tag points at a staging host (highsocietydisposgen.seogstage.com), which tells
   search engines the real page is elsewhere. It also still labels New Buffalo "comming soon".
6. **CMS placeholder text** ("Please add a content...", "CALL TO ACTION") in the page text of the home, careers, contact,
   loyalty and New Buffalo service-area pages (not hidden by the markup; whether a style hides it on screen was not
   checked); the home page's store slider gives the Big Rapids address (804 Clark St) on all 7 cards; "Big Rapdis" in
   the Big Rapids H1.

The rebuild fixes all of these (declared in `docs/hs-source-defects.json`; a gate fails any page that still shows "Please
add a content"), except the home hero's "CALL TO ACTION" button, which the v2 home keeps as a CMS hook (section 1, item 11).

## 3. Naming and content choices

- **Blog name:** working name "Society Pages". Keep, rename, or plain "Blog"?
- **/loyalty/ and /club-member-program/** are near-duplicates with the same title. The rebuild gives /loyalty/ its own
  title; should one point (canonical) to the other?
- **Neighbour-state law guides:** Indiana and Illinois (New Buffalo's Michiana and Chicago traffic). Add Ohio for
  Saline and Lenox shoppers?
- **Store reviews:** only New Buffalo has its own reviews; other store pages show brand reviews, labelled as such.
- **Android app:** only an App Store link is published.
- **Copyright line** reads 2025.
- **Careers page:** the upload line reads "Browse and chose the files you want to upload" ("choose"), and the dropdowns
  open preselected on "Full-time", "Inventory Specialist" and "New Buffalo". Both are kept as your page has them; say
  if the typo should be fixed and whether the dropdowns should start on a neutral "Select..." option.
- **Home page heading "Where Cannabis Meets Craftmanship"** ("Craftsmanship"): your live home and the reskin both
  spell it this way, and the rebuild keeps your words as published. Say if it should be corrected.
- **"Your store" card on /dispensary-guides/:** it needs the store a visitor picked in the store chooser, which only the
  CMS knows. The static pages leave the card out, and the hero's "Select a Location" button opens the chooser.
- **Article statements that rest on what your pages leave out:** cannabis-delivery-michigan says High Society doesn't
  deliver (your pages list in-store, pickup and curbside only), and what-is-a-budtender answers "Do I need an
  appointment?" with "No" (from your walk-in flow). Say if either is wrong.
- **Words your voice guide avoids, kept on purpose:** the glossary defines "420" because the term is searched; the
  coffee recipe's title uses "Bulletproof" as the style name (a Bulletproof 360 trademark; no company or product is
  named in the text).
- **Menu images (added 2026-10-24):** the photos in the Explore, Resources and Locations menus are AI-generated with
  Higgsfield:
  - a pit-garage counter of jars and vape carts;
  - a bud under a magnifier;
  - a storefront at dusk with a trophy-and-flags sign.

  They show no real store, product or person, and no readable text. Higgsfield's help center says the account owns its
  outputs and that its terms limit commercial use on no plan (Terms of Use §4.4, page checked 2026-10-24). The files
  carry no watermark. Images made only by AI generally get no US copyright, so others could reuse them. Keep them, or
  send photos of your own stores to use instead?
- **Food safety in the recipes:** every homemade infused oil and butter is told "fridge for 4 days, or freeze", the
  CDC's limit for homemade oils made with herbs, applied to butter too. That is stricter than many cannabis sites.

## 4. Publishing the new pages (SEO)

- **Serve the new pages through your CMS, or replace the shop links first.** About 42 links on every page (Menu,
  Order Now, Shop Deals, the staff picks, the Explore menu's "Shop the menu" card) point at `{{location_shop_url}}`,
  which your CMS fills with the chosen store's menu when it serves a page.
  - On the static preview these links open the store chooser instead (checked by clicking them at 390 and 1280
    pixels).
  - Served as plain files, they would send crawlers, and visitors without JavaScript, to a missing page. The preview
    has 1,835 such addresses, but its nofollow tag keeps crawlers off them.
  - If the pages go live outside the CMS, point these links at /shop/.
- **Stagger the articles.** About 280 new articles appearing on one day can look like scaled content to Google. Publish
  the location, guide and law pages first, then the articles in weekly waves (for example 20 to 30 a week), each
  dated the day it goes live.
- **Review dates on law content.** The law and medical-card pages say "as of October 2026". Items still moving: the
  Michigan 24% wholesale-tax lawsuit, federal rescheduling (the DEA hearing's recommended decision is pending), the
  federal hemp redefinition (effective November 12, 2026, partly paused to December 11, 2026 by a stopgap law). Review
  every quarter.
- **Articles with a date to re-check:**
  - cannabis-rescheduling: after the November 5, 2026 reply deadline in the DEA hearing.
  - hemp-ban-2025: after November 12 and December 11, 2026.
  - cannabis-and-elections: its "As of October 2026" box with the November 3, 2026 ballot; update or remove after the
    election.
  - cannabis-summer-olympics: after WADA's 2027 list takes effect on January 1, 2027.
  - cannabis-tourism-destinations: Illinois visitor limits, "as of October 2026".
- **Gaps in the law research that kept articles general.** facts/law-facts.json has no claim for:
  - Michigan's social equity program and expungement rules. cannabis-social-equity keeps program figures its
    fact-checker verified against two Senate Fiscal Agency PDFs; the other articles link to it.
  - delivery rules and the testing panel;
  - online ordering;
  - the June 2026 Hemani firearms ruling;
  - the MRTMA veteran research funding;
  - license types such as microbusiness.

  Home extraction was added on 2026-10-24. Add claims for the others if the articles should state them.
- **Nothing was copied from the competitor.** The new structure mirrors its sections, page types and topics; every
  sentence is High Society's own (existing pages) or newly written, and an overlap check against the competitor's text
  gates every page.
