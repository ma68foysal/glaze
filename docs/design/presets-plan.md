# Oblique presets plan

Status: plan for discussion, nothing built. Written 2026-10-15.

Oblique ships one preset today. Rivals in the fashion category show five on
their listing (Halftone, Stiletto, Release). This plan adds three, for four in
total: **Oblique**, **Club**, **Hush** and **Ochre**.

## What the Theme Store requires

Quoted from the requirements page
(<https://shopify.dev/docs/storefronts/themes/store/requirements>):

- "One theme preset must take the name of the parent theme." Oblique already does.
- "Theme and preset names must be 1-2 words", "less than 30 characters", and
  "unique and distinct from existing themes in the Shopify Theme Store".
- "If you have more than one preset, you need to include a unique set of
  templates showcasing each preset." They go "in a `/listings` folder in your
  theme zip", optionally with "preset-specific section groups".
- "If multiple presets are offered, then each preset's install state should
  mirror its demo." "Layout and color/typography settings must match the demo."
- "All theme presets must include at least one demo store." "Each demo store
  must match the primary industry and catalog size that the theme preset is
  tagged to."

There's no stated maximum number of presets and no explicit rule that presets
must differ, but a preset that only swaps colours adds little to the listing.
Each one below changes colour, type, shape, photo treatment and homepage
composition together.

## Name check

Checked against the Theme Store on 2026-10-15 (theme pages and search, which
also returns presets):

| Name | Result |
| --- | --- |
| Club | No theme or preset with this name |
| Hush | No theme or preset with this name |
| Ochre | No results at all |
| Atelier, Paper, Mono, Tide, Kiln | Taken (existing themes) |
| Grain | Taken (a preset of Flow) |
| Linen | Taken (a preset of Stiletto) |

Still needed before submission: a trademark and company-name check for the
three names. The requirements also rule out names of "Shopify products",
"company names" and "industries and collections in the Theme Store".

## The three presets

Every value below is an existing theme setting, so presets need no new code.
Fonts come from Shopify's font library; confirm the exact handles in the theme
editor.

### Club: after dark

For streetwear, evening and drop-led brands. Dark first, louder type, square
corners.

| Setting | Oblique today | Club |
| --- | --- | --- |
| Scheme 1 (base) | #F2F1EC / #0E0E0E / accent #2B2BFF | #0E0E0E / #F2F1EC / accent #8F8FFF |
| Scheme 2 (contrast) | #0E0E0E / #F2F1EC | #F2F1EC / #0E0E0E |
| Scheme 3 (accent) | #2B2BFF / #FFFFFF | #8F8FFF / #0E0E0E |
| Heading font | Archivo 800 | Archivo 900 |
| Heading scale | 100 | 110 |
| Button shape | Pill | Rounded |
| Card radius | 24 | 4 |
| Photo treatment | None | Monochrome, film grain on |
| Motion level | Full | Full |
| After adding to cart | Drawer | Fly to bag |

Homepage: kinetic hero, Next drop countdown second, scrolling tapes, edit tabs,
lookbook, journal. Drops up front.

### Hush: quiet luxury

For considered, slower brands and knitwear. Soft white, warm brown, rust
accent, more air.

| Setting | Hush |
| --- | --- |
| Scheme 1 | #FFFFFF / #2A2522 / accent #C2410C |
| Scheme 2 | #2A2522 / #F7F3EE / accent #E8A27C |
| Scheme 3 | #F3E6DA / #2A2522 / accent #C2410C |
| Heading font | Archivo 600 (lighter weight) |
| Heading scale | 90 |
| Section spacing | 150 |
| Button shape | Pill |
| Card radius | 28 |
| Photo treatment | None |
| Motion level | Subtle (no looping motion) |
| Stretch headings | Off |

Homepage: a gentler hero (single image, no rotator), story with steps,
stacked cards, collection index, pull quote, newsletter. Fewer, larger images.

### Ochre: workshop and craft

For heritage, workwear and made-to-last brands. Stone, forest green, serif-led
headings.

| Setting | Ochre |
| --- | --- |
| Scheme 1 | #DAD6CC / #14231B / accent #1F7A4D |
| Scheme 2 | #14231B / #EDEAE2 / accent #8FBF9F |
| Scheme 3 | #1F7A4D / #FFFFFF / accent #FFFFFF |
| Heading font | Instrument Serif italic (the accent face becomes the heading) |
| Accent font | Archivo 700 (roles swap) |
| Heading scale | 105 |
| Button shape | Square edges (card radius 0) |
| Photo treatment | Duotone (forest green) |
| Motion level | Full |

Homepage: product details with hotspots near the top, feature explorer
(materials), story with steps (how it's made), store information, journal.

## What each preset needs

1. **Settings:** a named entry in `config/settings_data.json` under `presets`.
2. **Listing templates:** `/listings/<preset>/templates/index.json` plus any
   template whose composition differs. Optionally preset-specific header and
   footer groups.
3. **A demo store per preset:** a development store tagged to the same industry
   (clothing and fashion) and catalogue size as the listing, with the Bogus
   Gateway or Shopify Payments test mode on and all other checkout options off.
   The current catalogue (10 collections, 12 products) can be recreated per
   store; photography should suit each mood (night and street for Club, soft
   studio for Hush, workshop and texture for Ochre).
4. **Install parity:** installing a preset on an empty store must look like its
   demo, minus images. Check each one on a fresh store.
5. **Listing assets:** desktop and mobile screenshots per preset.

## Effort and order

| Step | Size |
| --- | --- |
| Settings for the three presets | Small (an afternoon) |
| Listing templates for each homepage | Medium |
| Three development stores with catalogue and photos | Large (setup, not code) |
| Install-parity check on empty stores | Medium |
| Screenshots | Small |

Suggested order: build the settings and listing templates for all three first,
review them side by side in the theme editor, then commit to the demo stores
only for the presets you keep.

## Decisions needed

1. Keep all three, or start with one (Club is the most different from Oblique)?
2. Are Club, Hush and Ochre the names, after a trademark check?
3. Who creates the development stores? Creating stores and accounts is
   something you need to do in the Partner dashboard.
