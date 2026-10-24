# High Society site: source, build and checks

The High Society (Pit Stop by High Society) website as a multi-page static site: the Pit Stop homepage reskin (v2)
plus every inner page and the blog. Plain HTML, CSS and a small script, with no framework and no runtime dependencies.
The repository README (one folder up) describes the whole project.

## What is here

| Path | What it is |
|---|---|
| `dist/` | The built site. Serve this folder. |
| `src/content/` | Every word: `site.json` (stores, navigation, footer, UI labels), `home.json` (the v2 homepage), `pages/` (one JSON per page), `blog/` (one JSON per article), `images.json` |
| `src/templates/` | One module per page type (location, guide, article, blog index, ...) |
| `src/blocks/` | Content blocks the templates and pages share (store details, deals, FAQ, steps, tables, ...) |
| `src/chrome/` | The header, menus, store chooser and footer every page shares |
| `src/sections/` | The v2 homepage's sections |
| `src/styles/`, `src/scripts/` | Tokens, base, components, one stylesheet per section, template and block; the page scripts |
| `src/lib/` | Routing, escaping, Markdown, SEO helpers |
| `assets/optimized/` | The web-ready images and fonts the build ships |
| `src/tools/` | The build, the preview step and the image tools |
| `qa/` | The checks |

## Build

```
node src/tools/build.mjs --strict
```

This writes `dist/` from `src/` and `assets/optimized/`, using Node only: every page in `src/content/pages/` and every
article in `src/content/blog/`, the blog indexes, `sitemap.xml`, `robots.txt` and `search-index.json`. Each page is
the shared header and footer (`src/chrome/`) around its template (`src/templates/`) and blocks (`src/blocks/`). The
site script is minified at build time, and the build stops if the minified script differs in meaning from the source
or if a page links to a page that does not exist (`--strict`). The output is deterministic: `node qa/hashdir.mjs dist
dist2` proves two builds byte-identical.

```
node src/tools/make-preview.mjs --out <dir> --prefix /<repo>/    # the noindex preview copy
```

## For the CMS

- The empty CMS slots are kept in the markup (for example `#ieb8f`, the footer's "Your Store") and take no space while
  empty.
- `{{location_shop_url}}` links are kept as written for the CMS to fill. On this static preview they open the store
  chooser instead.
- The contact and employment forms post where High Society's live forms post (`form.action` in their page JSON); the
  preview copy switches them off.

## Checks

`node qa/run-gates.mjs --browser` runs them all, each with a positive control: build twice (byte-identical), links,
SEO, residue, originality, parity with High Society's current pages, the article gate, a placeholder scan, and in one
headless Chrome script errors and horizontal overflow at 390 and 1280 pixels.
