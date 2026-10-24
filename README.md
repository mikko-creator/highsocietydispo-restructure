# High Society: the full multi-page site (preview build)

The High Society (Pit Stop by High Society) website rebuilt as a complete multi-page static site: the Pit Stop homepage
reskin plus store pages, store menus, deals and loyalty, guides, a medical card guide, Michigan and neighbouring-state
law pages, an FAQ, and the "Society Pages" blog. Plain HTML, CSS and a small script; no framework and no runtime
dependencies.

**Preview:** https://mikko-creator.github.io/highsocietydispo-restructure/ (public link; every page carries noindex, so
search engines leave it out)

## What is here

| Path | What it is |
|---|---|
| `site/dist/` | The built site. Serve this folder. |
| `site/src/content/` | Every word: `site.json` (stores, navigation, labels), `pages/` (one file per page), `blog/` (one file per article, with its sources and fact-check record), `images.json` |
| `site/src/templates/`, `site/src/blocks/`, `site/src/chrome/` | Page templates, content blocks, header and footer |
| `site/src/styles/`, `site/src/scripts/` | The brand styles and the page scripts |
| `site/assets/optimized/` | The web-ready images and fonts the build ships |
| `site/qa/` | The checks (below) |
| `facts/` | `hs-facts.json`: what the site may say about High Society, each fact with its source on High Society's own pages. `law-facts.json`: the cannabis-law claims the pages use, each with its official sources and a second, independent check |
| `docs/OPEN-DECISIONS.md` | Questions for High Society and the defaults the site uses until they are answered |
| `docs/VOICE.md` | How High Society's copy sounds |
| `docs/hs-source-defects.json` | Errors on the live site that the rebuild does not carry over |

## Build

```
cd site
node src/tools/build.mjs --strict
```

Writes `site/dist/` from `site/src/` and `site/assets/optimized/` with Node only. `--strict` is publish mode: the build
stops on any link to a page that does not exist. The output is deterministic (`node qa/hashdir.mjs dist <second build>`
proves two builds byte-identical).

```
node src/tools/make-preview.mjs --out <dir> --prefix /<repo>/
```

writes the noindex preview copy (every page `noindex`, the contact and employment forms switched off).

## Checks

`node qa/run-gates.mjs --browser` runs every check, each with a planted-defect control that must fire: two builds
compared byte for byte, links, SEO (titles, descriptions, canonicals, structured data, sitemap, heading order),
placeholder text, the article gate (schema, sources, Michigan advertising rules on health topics), and in a headless
browser script errors and horizontal overflow at 390 and 1280 pixels.

Four checks read material that is not in this repository and run in the working project only:

- the originality check: every page's text is compared with the reference site whose page structure this one follows,
  and no run of 8 or more words may be shared;
- the residue check: no name of the reference site's business, brands or events may appear on any page;
- the article gate: it also reads the article briefs and the two lists above;
- the parity check: every sentence of High Society's current pages must still be on the rebuilt pages.

## Content

- High Society's own pages keep every visible word, corrected where the live pages are wrong (`docs/hs-source-defects.json`).
- Every article and new page is newly written for High Society, fact-checked by a second writer against its sources,
  and lists those sources.
- Health topics are written as research summaries with their limits; they never say a product helps a condition and
  carry no shop links or order buttons (Michigan rule R 420.507).
- Publishing advice (stagger the articles, review dates on law content): `docs/OPEN-DECISIONS.md` section 4.
