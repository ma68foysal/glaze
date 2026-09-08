# Allure Theme Manual

> **Provenance:** design foundations captured from the Allure theme manual at
> <https://utdweb.team/shopify-themes/allure/manual/>, kept as a structural
> reference for building the Skinova manual. The tokens below describe *UTD's*
> site, not Skinova — see "Adapting this for Skinova" at the end before use.
>
> Not part of the theme. `shopify theme package` only bundles `assets/`,
> `blocks/`, `config/`, `layout/`, `locales/`, `sections/`, `snippets/` and
> `templates/`, so nothing in `docs/` ships to merchants.

## Mission
Create implementation-ready, token-driven UI guidance for Allure Theme Manual that is optimized for consistency, accessibility, and fast delivery across e-commerce storefront.

## Brand
- Product/brand: Allure Theme Manual
- URL: https://utdweb.team/shopify-themes/allure/manual/
- Audience: online shoppers and consumers
- Product surface: e-commerce storefront

## Style Foundations
- Visual style: clean, functional, implementation-oriented
- Main font style: `font.family.primary=ProximaNova`, `font.family.stack=ProximaNova, sans-serif`, `font.size.base=16px`, `font.weight.base=400`, `font.lineHeight.base=22.4px`
- Typography scale: `font.size.xs=12px`, `font.size.sm=14px`, `font.size.md=16px`, `font.size.lg=18px`, `font.size.xl=20.8px`, `font.size.2xl=22px`, `font.size.3xl=28px`, `font.size.4xl=34px`
- Color palette: `color.surface.base=#000000`, `color.text.secondary=#525252`, `color.text.tertiary=#0000ee`, `color.text.inverse=#21981f`, `color.surface.muted=#ffffff`, `color.surface.raised=#f3d329`
- Spacing scale: `space.1=1px`, `space.2=4px`, `space.3=8px`, `space.4=10px`, `space.5=12px`, `space.6=14px`, `space.7=16px`, `space.8=24px`
- Radius/shadow/motion tokens: `radius.xs=4px`, `radius.sm=8px`, `radius.md=12px`, `radius.lg=60px` | `shadow.1=rgba(0, 0, 0, 0.15) 0px 0px 0px 1px` | `motion.duration.instant=300ms`, `motion.duration.fast=400ms`, `motion.duration.normal=3000ms`

## Accessibility
- Target: WCAG 2.2 AA
- Keyboard-first interactions required.
- Focus-visible rules required.
- Contrast constraints required.

## Writing Tone
Concise, confident, implementation-focused.

## Rules: Do
- Use semantic tokens, not raw hex values, in component guidance.
- Every component must define states for default, hover, focus-visible, active, disabled, loading, and error.
- Component behavior should specify responsive and edge-case handling.
- Interactive components must document keyboard, pointer, and touch behavior.
- Accessibility acceptance criteria must be testable in implementation.

## Rules: Don't
- Do not allow low-contrast text or hidden focus indicators.
- Do not introduce one-off spacing or typography exceptions.
- Do not use ambiguous labels or non-descriptive actions.
- Do not ship component guidance without explicit state rules.

## Guideline Authoring Workflow
1. Restate design intent in one sentence.
2. Define foundations and semantic tokens.
3. Define component anatomy, variants, interactions, and state behavior.
4. Add accessibility acceptance criteria with pass/fail checks.
5. Add anti-patterns, migration notes, and edge-case handling.
6. End with a QA checklist.

## Required Output Structure
- Context and goals.
- Design tokens and foundations.
- Component-level rules (anatomy, variants, states, responsive behavior).
- Accessibility requirements and testable acceptance criteria.
- Content and tone standards with examples.
- Anti-patterns and prohibited implementations.
- QA checklist.

## Component Rule Expectations
- Include keyboard, pointer, and touch behavior.
- Include spacing and typography token requirements.
- Include long-content, overflow, and empty-state handling.
- Include known page component density: links (94), buttons (21), inputs (6), lists (5), navigation (3).

## Quality Gates
- Every non-negotiable rule must use "must".
- Every recommendation should use "should".
- Every accessibility rule must be testable in implementation.
- Teams should prefer system consistency over local visual exceptions.

---

## Page Template (observed on the Allure manual)

Each manual page follows the same shape:

1. **Eyebrow** — the parent group (e.g. `General`)
2. **H1** — the page name (e.g. `Typography`)
3. **Purpose line** — one sentence: "This settings block is intended for …"
4. **Customizer path** — in code style: `Customizer → Theme Settings → Typography`
5. **Screenshot** of the Customizer panel, with a red arrow to the entry point
6. **H2 "Settings"** — then, per settings group:
   - an H3 with the group name
   - a screenshot of that group's controls
   - a numbered list, one item per setting:
     `` `Setting name` `` — plain-English explanation; semicolons between, period on the last
7. **"Next →" card** linking to the following page

**Sidebar:** collapsible groups with a flat page list under each —
`General` · `Pages` · `Sections & Snippets`, plus standalone
`Paid Services` and `Latest Updates` entries.

---

## Adapting this for Skinova

The tokens above were machine-extracted from UTD's site and carry their
branding. Replace before use:

- `color.surface.raised=#f3d329` is UTD's brand yellow (their "Let's Talk"
  button), not a surface colour.
- `color.surface.base=#000000` reads as a text colour, not a surface.
- `color.text.inverse=#21981f` (green) and `color.text.tertiary=#0000ee`
  (default link blue) look like scrape artefacts rather than deliberate choices.
- `motion.duration.normal=3000ms` is almost certainly a carousel interval that
  got captured as a motion token.

Skinova's real palette lives in [`snippets/css-variables.liquid`](../snippets/css-variables.liquid)
as the `--g-*` tokens, driven by `config/settings_schema.json`:

| Token | Value | Role |
| --- | --- | --- |
| `--g-bg` | `#FFFFFF` | Page background |
| `--g-fg` | `#1A1A1A` | Foreground text |
| `--g-cream` | `#FBE9E8` | Secondary background |
| `--g-accent` | `#111111` | Accent background |
| `--g-accent-fg` | `#FFFFFF` | Accent foreground |
| `--g-rose` | `#E8A5A0` | Brand accent / focus ring |
| `--g-radius-sm/md/lg/pill` | `8 / 12 / 24 / 100px` | Corner radii |
| `--g-touch` | `44px` | Minimum touch target |

Fonts come from the merchant's `type_heading_font` (default `assistant_n7`) and
`type_primary_font` (default `dm_sans_n4`), so the manual should show those
rather than ProximaNova.

## Scope note

Skinova has **42 sections / 1,012 settings** (814 section + 198 block) plus 18
theme settings in 7 groups. Allure's manual covers ~16 sections. The per-setting
numbered lists can be generated from the section schemas rather than written by
hand — every setting already has a `label`, `type`, `default` and often an
`info` string.
