# Oblique — Shopify theme (formerly Skinova)

A fashion theme for the Shopify Theme Store, by Themestudio. Built on Shopify's
[Skeleton theme](https://github.com/Shopify/skeleton-theme), which is the only
codebase Shopify approves for new Theme Store submissions.

**Read this before changing anything.** The theme was submitted once as
Skinova (a skincare theme) and rejected. The current job is a redesign, not a
bug-fix pass. The sections below describe that history; "Redesign progress"
says where the rebuild stands.

---

## Redesign progress (October 2026)

- **Name:** Oblique, chosen 2026-10-15. It's clear on the Theme Store (themes
  and presets), with no Shopify app of that name. "Kinetic" was rejected
  because two Shopify animation apps already use it. The design is still called
  "Kinetic Editorial" in code comments and the canvas.
- **Design source:** the Kinetic Editorial canvas,
  https://claude.ai/artifact/NcLUbanME64GNT7VTDznJ8 (V1 homepage and product
  page).
- **Branch:** `redesign/kinetic`, cut from `f9c21f2`. Done: design system
  (colour schemes, type, motion), header, footer, cart drawer, the V1 homepage
  sections, the product page and related products. Every remaining page uses
  colour schemes.
- **New code conventions:** `assets/theme.css` and `assets/theme.js` hold the
  design system; new classes use the `k-` prefix. Old `skinova-*` classes and
  `window.Skinova` stay until their sections are rebuilt or deleted.
- **Still to rebuild:** collection, cart page, blog/article, search, 404,
  contact. Delete the unused old sections (`highlight-statement`,
  `sticky-collections` and others), which still trip `ExcessiveSettingsCount`.
- **Demo store:** primary address `oblique-theme.myshopify.com`, changed on
  2026-10-15; that was 1 of 2 allowed changes, so 1 is left. The technical
  address stays `skinova-hveyg6a1.myshopify.com`: use it for `--store` in CLI
  commands (the CLI's store auth is stored under it) and for admin login. It
  holds the fashion catalogue (10
  collections, 12 products, vendor "Oblique"); the skincare products are Draft.
  The unpublished **"Oblique demo"** theme (ID 167169687792) carries the store
  image references. It's built from a copy of the repo outside the repo, so
  `shopify://shop_images` references never get committed. Photo sources are in
  `docs/demo-images.md`.
- **Never run `shopify auth logout`.** The CLI holds several Partner logins;
  switch accounts with the login command only. Run `shopify.cmd` in the
  Terminal panel, because PowerShell's script policy blocks `shopify.ps1`.
- **Store name:** "Oblique", changed 2026-10-15 in Settings → General; it
  drives the header and footer wordmark. The business entity name in
  Organization settings still says skinova, which is billing and tax only.
- **Open:** the manual still lives at `skinova-manual.vercel.app`;
  trademark and handle checks for "Oblique"; store currency is BDT.

---

## Where the project stands

Submitted September 2026 (ticket 70120845) and **rejected before full review**
on design quality.

The review team never assessed performance, accessibility, install behaviour,
documentation or support. They screened the demo store, judged the design below
the standard of the current catalogue, and stopped. The letter contains no
theme-specific criticism — that is normal for this gate.

The three load-bearing sentences:

> "We are seeking themes that not only compete with, but also surpass the
> offerings of our current theme store catalog, **including the free themes**."

> "...a higher degree of intentionality and sophistication in **design choices,
> layout, consistency, accessibility, and both customer and merchant user
> experience**."

> "At this point, we **won't be proceeding with a full review** of Skinova."

**One rejection of three used.** A third triggers a 90-day submission
suspension, so the next attempt must be a genuine redesign.

### What this means in practice

- The theme **passed** every written requirement and had zero theme-check
  offences at submission. Compliance was never the problem.
- The bar is comparative and subjective: better than Dawn, Horizon and Sense,
  which merchants get free.
- Fixing bugs or polishing spacing will not change the outcome. The work is
  design work.

---

## The goal

Redesign Skinova around a real design system, then rebuild the theme against
that design, and resubmit.

Agreed approach: **Figma first, code second.** Every problem below traces to the
theme being built section by section in code, with design decisions made as they
came up. Reversing that order is the fix.

---

## What the audit found

All measured from the theme's own schemas.

| Finding | Measurement |
| --- | --- |
| No shared colour system | **297** individual colour settings across 37 of 40 sections |
| No type or spacing scale | 87 font-size sliders, 84 padding/gap, 25 radius, 21 weight |
| Design decisions as settings | **514 of 992** settings (52%) are tokens that belong in a central system |
| Overlapping sections | 6 pairs doing the same job |
| Oversized sections | header **104** settings, highlight-statement 74, sticky-collections 64, main-product 63 |

The overlapping pairs:

```
faq-grid            ·  faq
feature-rich        ·  features
featured-press      ·  press-logos
collection-list     ·  categories  ·  collections
sticky-collections  ·  shoppable-tabs
highlight-statement ·  quote
```

### Shopify's tooling now agrees

`theme-check` was clean at submission. It has since gained new rules, and the
theme now fails five of them — all of them the same finding:

```
ExcessiveSettingsCount   footer, highlight-statement, main-product, sticky-collections
                         (45, 43, 61, 61 settings — max is 40)
LiquidComplexity         header.liquid — complexity 132, max is 120
```

Treat these as confirmation, not as the problem to fix. Raising the section
count below 40 by shuffling settings would miss the point.

### One correction worth carrying

An earlier version of the audit claimed Shopify requires `color_scheme` /
`color_scheme_group` settings. **It does not.** The requirements only say:

> "A minimum of 4 colors are required. All background color settings must
> include a corresponding foreground color setting. Color settings must use a
> `type` of `color`."

Skinova satisfies that. What it fails is the *outcome* requirements — "simple,
complementary color palette", "consistent visual and interaction design", and
"settings clearly organized". Colour schemes are a well-proven way to achieve
those, not a rule. Don't state them as mandatory.

---

## The redesign plan

1. **Design system in Figma.** Colour combinations (4–5 named sets defining
   background, text, heading, border, button and button text together), one type
   scale of 6–8 steps, one spacing ramp, 2–3 radius values, and all component
   states (default, hover, focus, active, disabled, loading).
2. **Find a point of view.** Dawn is competent and deliberately neutral, so
   beating it means being *specific*, not more polished. Put the demo store
   beside paid themes at $180–$320, same screen, same products.
3. **Draw templates, not sections.** Design complete pages at desktop and
   mobile; let the section list fall out of what the pages need. Target 14–18
   addable sections, down from 28.
4. **Rebuild against the design.** Move colour, type, spacing and radius into
   theme settings; delete the per-section equivalents. Expect settings to land
   nearer 300 than 1,000.
5. **Test as a merchant.** Install on an empty store, set it up with real
   products, run Lighthouse (60 performance / 90 accessibility minimum),
   rebuild the demo store, regenerate the manual.

---

## Repository layout

```
d:\cracktab\glaze\
├── assets/            base.css, critical.css, global.js, cart.js, quick-view.js
├── blocks/ config/ layout/ locales/ sections/ snippets/ templates/
├── docs/              notes, not shipped — manual design spec, demo blog posts
└── ultimate-doc/      the documentation site (separate git repo, gitignored here)
```

Two git repos:

| Repo | Remote |
| --- | --- |
| Theme | `github.com/ma68foysal/glaze` |
| Manual | `github.com/RasedulRasel21/skinova-manual` |

`ultimate-doc/` is listed in the theme's `.gitignore` so the two don't collide.
Both are clean and pushed as of commit `f9c21f2 theme submited`.

**Branch off `f9c21f2` for the redesign.** That commit is the submitted,
working reference copy — you will want to lift Liquid out of it.

---

## Architecture notes

- **CSS and JS are consolidated.** All styles live in `assets/base.css` (plus
  `critical.css` inlined in `<head>`), all behaviour in `global.js`, `cart.js`
  and `quick-view.js`, loaded once from `layout/theme.liquid`. Sections add
  scoped rules via `{% stylesheet %}` or an inline `<style>` keyed to the
  section id. Don't introduce new asset files without a reason.
- **Design tokens** come from `snippets/css-variables.liquid` as `--g-*` custom
  properties, driven by `config/settings_schema.json`. This is the beginning of
  a system — the redesign should extend it and remove the per-section settings
  that bypass it.
- **Cart** supports both drawer and page modes (`settings.cart_type`). The
  drawer only renders when the type is `drawer`, so `cart.js` has to work in
  both. Multi-item adds use `/cart/add.js` with an `items` array.
- **Placeholders**: every image slot and product grid falls back to
  `placeholder_svg_tag` or placeholder cards, so a fresh install shows layout
  rather than blank panels. Keep this.

---

## Working rules

**Verify, don't assume.** Several bugs in this project were found only because
output was checked after an edit rather than trusted. Run `shopify theme check`,
check Liquid tag balance, and read the rendered HTML when a change is
structural.

**Check the docs before asserting a Shopify requirement.** The requirements page
is the source of truth, and this project has already produced one confidently
wrong claim (colour schemes). Quote it rather than paraphrasing from memory.

**Never `shopify theme pull`.** It overwrites local `.liquid` files with
whatever is on the store and has already destroyed work twice here. Push, don't
pull. If settings must come back from a store, take the JSON only and strip
demo-store resources before packaging.

**Keep demo-store resources out of the package.** `shopify://shop_images/...`
references and dev-store collection handles must not ship — they break on a
merchant's install and are an explicit rejection reason. Collection settings
store a bare handle, not a `shopify://` URL, so a search for `shopify://` alone
will miss them.

**No dead links.** Nothing should render `href="#"`. A CTA needs both a label
and a URL before it renders; cards and tiles without a destination render a
`<div>` or `<span>`, not an anchor.

**Line endings vary** across files in this repo. When patching with a script,
detect CRLF, normalise to `\n`, edit, then restore — otherwise matches fail
silently.

**The manual regenerates itself.** `cd ultimate-doc && npm run extract` reads
the theme's schemas and rewrites `data/theme-schema.json`; `npm run screenshots`
reports screenshot coverage. After any schema change, re-run extract and commit
the JSON — Vercel builds from it and never sees the theme repo.

---

## Commands

```bash
shopify theme dev             # local preview
shopify theme check           # lint — treat warnings as real
shopify theme package         # builds Skinova-<version>.zip for submission

cd ultimate-doc
npm run dev                   # manual at localhost:3000
npm run extract               # regenerate docs data from theme schemas
npm run screenshots           # screenshot coverage report
npm run build                 # 52 static pages
```

---

## Reference

- Theme Store requirements — <https://shopify.dev/docs/storefronts/themes/store/requirements>
- Listing guidelines — <https://shopify.dev/docs/storefronts/themes/store/review-process/listings>
- Live manual — <https://skinova-manual.vercel.app>
- Demo store — `oblique-theme.myshopify.com` (password protected; technical
  address `skinova-hveyg6a1.myshopify.com`)

### Still open from the first submission

These were never reviewed and remain outstanding whichever design ships:

- Support form at `themestudio.store/pages/contact` is missing five required
  fields: store URL (with example), problem description textarea, file upload,
  theme name, auto-populated subject — plus an auto-responder.
- `<shopify-account>` is not in the header. The requirements say it must be
  visible in both the desktop and mobile header. It was deliberately reverted
  because the account sheet was not the wanted behaviour; that trade-off needs
  revisiting.
