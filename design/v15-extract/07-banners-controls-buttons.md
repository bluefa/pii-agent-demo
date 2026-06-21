# v15 Extract — Banners / Toolbar / Buttons (target-source screens)

> Pixel-exact transcription from `design/SIT Prototype Athena v15.html`.
> Every value is the **declared literal** in the stylesheet — no rounding, no
> inference. `var(--x)` columns resolved against `00-tokens.md` + the 2nd
> `<style>` block `:root` (lines 546–567). v15 line numbers cited per rule.
>
> Scope note: the prompt names `.step-banner`, `.toolbar-search*`,
> `.toolbar-filter`, and the buttons used in the target-source screens
> (lines 5565–7254). The **filter tabs (전체/대상/비대상 + count badges + dropdowns)**
> in those screens are NOT `.toolbar-filter` — they use `.filter-seg` / `.cnt`
> / `.tt-select`. Both the named toolbar classes AND the actually-rendered
> filter classes are transcribed below.

---

## Token resolution table (used throughout)

| var | resolved literal | v15 line |
|---|---|---|
| `--color-primary` | `#0064FF` | 264 |
| `--color-primary-hover` | `#0050D6` | 265 |
| `--color-primary-light` | `#E8F1FF` | 266 |
| `--color-primary-50` | `#EFF6FF` | 267 |
| `--color-success` | `#45CB85` | 273 |
| `--color-error` | `#EF4444` | 276 |
| `--color-error-dark` | `#991B1B` | 277 |
| `--color-info-dark` | `#1E40AF` | 283 |
| `--gray-200` | `#E5E7EB` | 300 |
| `--gray-400` | `#9CA3AF` | 302 |
| `--fg-1` | `var(--gray-900)` → `#111827` | 312 |
| `--fg-3` | `var(--gray-500)` → `#6B7280` | 314 |
| `--fg-4` | `var(--gray-400)` → `#9CA3AF` | 315 |
| `--border-default` | `var(--gray-200)` → `#E5E7EB` | 328 |
| `--bg-muted` | `var(--gray-50)` → `#F9FAFB` | 322 |
| `--toss-divider` | `#EBEEF2` | 551 |
| `--toss-strong-text` | `#191F28` | 552 |
| `--toss-medium-text` | `#4E5968` | 553 |
| `--toss-weak-text` | `#8B95A1` | 554 |
| `--toss-inner-bg` | `#F7F8FA` | 550 |
| `--toss-radius-inner` | `12px` | 565 |

---

# 1. BANNERS — `.step-banner`

Base rule + 3 colour variants (`warn` / `success` / `error`) + `svg`, `strong`,
`.ml-auto` children. Default (no variant) = info/blue. Rule block: lines 1956–1972.

## 1.1 `.step-banner` (base / default info variant)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `flex` | flex | 1957 |
| `align-items` | `center` | center | 1957 |
| `gap` | `14px` | 14px | 1957 |
| `padding` | `18px 22px` | 18px 22px | 1958 |
| `border-radius` | `var(--toss-radius-inner)` | `12px` | 1959 |
| `background` | `var(--color-primary-50)` | `#EFF6FF` | 1960 |
| `border` | `0` | 0 | 1961 |
| `margin-bottom` | `20px` | 20px | 1962 |
| `font-size` | `14px` | 14px | 1963 |
| `color` | `var(--color-info-dark)` | `#1E40AF` | 1964 |
| `font-weight` | `500` | 500 | 1965 |
| `letter-spacing` | not declared | inherited | — |
| `line-height` | not declared | inherited | — |
| `height` | not declared (auto from padding) | auto | — |

## 1.2 `.step-banner.warn` (line 1967)

Only overrides 3 properties; everything else inherits from base `.step-banner`.

| property | literal | resolved | v15 line |
|---|---|---|---|
| `background` | `#FFFBEB` | `#FFFBEB` (literal hex) | 1967 |
| `border` | `0` | 0 | 1967 |
| `color` | `#78350F` | `#78350F` (literal hex) | 1967 |
| `padding` | (inherited) `18px 22px` | 18px 22px | 1958 |
| `border-radius` | (inherited) `var(--toss-radius-inner)` | `12px` | 1959 |
| `gap` | (inherited) `14px` | 14px | 1957 |
| `font-size` | (inherited) `14px` | 14px | 1963 |
| `font-weight` | (inherited) `500` | 500 | 1965 |

## 1.3 `.step-banner.success` (line 1968)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `background` | `#ECFDF5` | `#ECFDF5` (literal hex) | 1968 |
| `border` | `0` | 0 | 1968 |
| `color` | `#065F46` | `#065F46` (literal hex) | 1968 |
| (all other props inherited from base — see §1.1) | | | 1956–1965 |

## 1.4 `.step-banner.error` (line 1969)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `background` | `#FEF2F2` | `#FEF2F2` (literal hex) | 1969 |
| `border` | `0` | 0 | 1969 |
| `color` | `#7F1D1D` | `#7F1D1D` (literal hex) | 1969 |
| (all other props inherited from base — see §1.1) | | | 1956–1965 |

## 1.5 `.step-banner` children

| selector | property | literal | resolved | v15 line |
|---|---|---|---|---|
| `.step-banner svg` (icon) | `flex-shrink` | `0` | 0 | 1970 |
| `.step-banner strong` (emphasis text) | `font-weight` | `700` | 700 | 1971 |
| `.step-banner .ml-auto` | `margin-left` | `auto` | auto | 1972 |
| `.step-banner .ml-auto` | `display` | `flex` | flex | 1972 |
| `.step-banner .ml-auto` | `gap` | `8px` | 8px | 1972 |

> Icon size/colour: the SVG inherits `color` from the variant (`currentColor`),
> and its width/height come from inline `width`/`height` attributes on each
> `<svg>` in markup — NOT from CSS. Per-instance, ambiguous from CSS alone.

---

# 2. TOOLBAR — search input + filter button (named classes)

> ⚠️ **Reference only — NOT used by the target-source screens.** `.list-toolbar`
> and `.toolbar-search`/`.toolbar-search-wrap`/`.toolbar-filter` have **0
> occurrences** in the 5565–7254 band. Those screens render the
> `.table-toolbar` / `.tt-*` cluster instead (see the "Table toolbar" section
> below). This §2 is retained as reference for the screen-3 infra list only.

`.list-toolbar` container (lines 3308–3323) holds `.left` (count text) and
`.right` (search + filter). The named `.toolbar-search` / `.toolbar-search-wrap`
/ `.toolbar-filter` are rendered at lines 5329–5336 (screen-3 infra list).

## 2.1 `.list-toolbar` (container, lines 3308–3323)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `flex` | flex | 3309 |
| `align-items` | `center` | center | 3309 |
| `justify-content` | `space-between` | space-between | 3309 |
| `margin-bottom` | `14px` | 14px | 3310 |

| child | property | literal | resolved | v15 line |
|---|---|---|---|---|
| `.list-toolbar .left` | `display` | `flex` | flex | 3313 |
| `.list-toolbar .left` | `align-items` | `center` | center | 3313 |
| `.list-toolbar .left` | `gap` | `12px` | 12px | 3313 |
| `.list-toolbar .count-text` | `font-size` | `14px` | 14px | 3316 |
| `.list-toolbar .count-text` | `color` | `var(--toss-medium-text)` | `#4E5968` | 3316 |
| `.list-toolbar .count-text` | `font-weight` | `600` | 600 | 3316 |
| `.list-toolbar .count-text strong` | `color` | `var(--toss-strong-text)` | `#191F28` | 3319 |
| `.list-toolbar .count-text strong` | `font-weight` | `800` | 800 | 3319 |
| `.list-toolbar .right` | `display` | `flex` | flex | 3322 |
| `.list-toolbar .right` | `align-items` | `center` | center | 3322 |
| `.list-toolbar .right` | `gap` | `8px` | 8px | 3322 |

## 2.2 `.toolbar-search` (search input, lines 3324–3333)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `height` | `40px` | 40px | 3325 |
| `padding` | `0 14px 0 36px` | 0 14px 0 36px | 3326 |
| `background` | `var(--bg-muted)` | `#F9FAFB` | 3327 |
| `border` | `0` | 0 | 3328 |
| `border-radius` | `10px` | 10px | 3329 |
| `font-size` | `13px` | 13px | 3330 |
| `width` | `280px` | 280px | 3331 |
| `color` | `var(--toss-strong-text)` | `#191F28` | 3332 |
| `font-weight` | not declared | inherited | — |
| `letter-spacing` | not declared | inherited | — |
| `line-height` | not declared | inherited | — |
| `gap` | n/a (not a flex container) | — | — |

### `.toolbar-search:focus` (line 3334)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `background` | `#fff` | `#FFFFFF` | 3334 |
| `box-shadow` | `0 0 0 2px rgba(0,100,255,0.15)` | (literal) | 3334 |
| `outline` | `none` | none | 3334 |

## 2.3 `.toolbar-search-wrap` (positioning wrapper, lines 3335–3337)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `position` | `relative` | relative | 3336 |
| `display` | `inline-block` | inline-block | 3336 |

### `.toolbar-search-wrap svg` (search icon, lines 3338–3341)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `position` | `absolute` | absolute | 3339 |
| `left` | `12px` | 12px | 3339 |
| `top` | `50%` | 50% | 3339 |
| `transform` | `translateY(-50%)` | translateY(-50%) | 3339 |
| `color` | `var(--toss-weak-text)` | `#8B95A1` | 3340 |

> Icon dimensions (`width="14" height="14"`) are inline attributes on the
> `<svg>` at line 5330 — not CSS.

## 2.4 `.toolbar-filter` (filter button, lines 3342–3352)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `height` | `40px` | 40px | 3343 |
| `padding` | `0 14px` | 0 14px | 3344 |
| `background` | `var(--bg-muted)` | `#F9FAFB` | 3345 |
| `border` | `0` | 0 | 3346 |
| `border-radius` | `10px` | 10px | 3347 |
| `font-size` | `13px` | 13px | 3348 |
| `color` | `var(--toss-strong-text)` | `#191F28` | 3349 |
| `font-weight` | `600` | 600 | 3350 |
| `cursor` | `pointer` | pointer | 3351 |
| `letter-spacing` | not declared | inherited | — |
| `line-height` | not declared | inherited | — |
| `gap` | not declared | n/a | — |

> No `:hover` rule defined for `.toolbar-filter`. Inline icon (`width="13"
> height="13"`, `margin-right:4px`, `vertical-align:-2px`) at line 5334 is
> markup-level, not CSS.

---

# 3. FILTER TABS — `.filter-seg` 전체/대상/비대상 + count badge + dropdown

Rendered in target-source screens at lines 5930–5936 (Step 2 approval list).
This is what the prompt describes as "filter tabs 전체/대상/비대상 with count
badges + dropdowns". Rule block: `.filter-seg` 2623–2658, `.tt-select` 2659–2677.

## 3.1 `.filter-seg` (segmented container, lines 2623–2630)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `inline-flex` | inline-flex | 2624 |
| `background` | `#fff` | `#FFFFFF` | 2625 |
| `border` | `0` | 0 | 2626 |
| `border-radius` | `10px` | 10px | 2627 |
| `padding` | `3px` | 3px | 2628 |
| `gap` | `0` | 0 | 2629 |
| `box-shadow` | `0 1px 2px rgba(17,24,39,0.04)` | (literal) | 2630 |

## 3.2 `.filter-seg button` (tab — 전체/대상/비대상, lines 2632–2640)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `height` | `30px` | 30px | 2633 |
| `padding` | `0 14px` | 0 14px | 2633 |
| `font-size` | `13px` | 13px | 2634 |
| `font-weight` | `600` | 600 | 2634 |
| `color` | `var(--toss-weak-text)` | `#8B95A1` | 2635 |
| `border-radius` | `8px` | 8px | 2636 |
| `display` | `inline-flex` | inline-flex | 2637 |
| `align-items` | `center` | center | 2637 |
| `gap` | `6px` | 6px | 2637 |
| `white-space` | `nowrap` | nowrap | 2638 |
| `transition` | `background 0.15s, color 0.15s` | (literal) | 2639 |
| `letter-spacing` | not declared | inherited | — |
| `line-height` | not declared | inherited | — |
| `background` | not declared on `.filter-seg button` → global reset | `none` | 579 |

> `.filter-seg button` declares no `background` of its own. As a rendered
> `<button>`, it inherits the global reset `button { background: none; border:
> none; color: inherit }` (line 579) — so its effective background is `none`
> and border `none` until `.active` (line 2643) sets a fill. Stated, not
> guessed.

### `.filter-seg button:hover` (line 2641)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `color` | `var(--toss-strong-text)` | `#191F28` | 2641 |

### `.filter-seg button.active` (selected tab, lines 2642–2646)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `background` | `var(--toss-strong-text)` | `#191F28` | 2643 |
| `color` | `#fff` | `#FFFFFF` | 2644 |
| `font-weight` | `700` | 700 | 2645 |

## 3.3 `.filter-seg button .cnt` (count badge, lines 2647–2655)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `font-size` | `11.5px` | 11.5px | 2648 |
| `background` | `var(--toss-inner-bg)` | `#F7F8FA` | 2649 |
| `color` | `var(--toss-weak-text)` | `#8B95A1` | 2650 |
| `padding` | `1px 7px` | 1px 7px | 2651 |
| `border-radius` | `999px` | 999px | 2652 |
| `font-variant-numeric` | `tabular-nums` | tabular-nums | 2653 |
| `font-weight` | `700` | 700 | 2654 |

### `.filter-seg button.active .cnt` (badge on active tab, lines 2656–2657)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `background` | `rgba(255,255,255,0.20)` | (literal) | 2657 |
| `color` | `#fff` | `#FFFFFF` | 2657 |

## 3.4 `.tt-select` (dropdown — DB Type/Region, lines 2659–2670)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `height` | `30px` | 30px | 2660 |
| `border` | `1px solid var(--border-default)` | `1px solid #E5E7EB` | 2661 |
| `border-radius` | `7px` | 7px | 2662 |
| `padding` | `0 28px 0 10px` | 0 28px 0 10px | 2663 |
| `font-size` | `12px` | 12px | 2664 |
| `background` | `#fff url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>") right 8px center no-repeat` | (literal, see note) | 2665 |
| `-webkit-appearance` | `none` | none | 2666 |
| `appearance` | `none` | none | 2666 |
| `color` | `var(--fg-1)` | `#111827` | 2667 |
| `cursor` | `pointer` | pointer | 2668 |
| `min-width` | `130px` | 130px | 2669 |
| `font-weight` | not declared | inherited | — |
| `letter-spacing` | not declared | inherited | — |
| `gap` | n/a | — | — |

> `.tt-select` background image (line 2665): inline data-URI SVG chevron,
> stroke `%239CA3AF` (= `#9CA3AF`), positioned `right 8px center`, no-repeat.

### `.tt-select:focus` (line 2671)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `outline` | `none` | none | 2671 |
| `border-color` | `var(--color-primary)` | `#0064FF` | 2671 |

---

## Table toolbar — `.table-toolbar` / `.tt-*` (ACTUAL screen toolbar)

> This is the toolbar the target-source screens (lines 5565–7254) actually
> render — NOT `.list-toolbar`/`.toolbar-search` (§2, which has **0
> occurrences** in those screens and is reference-only). Rule block: lines
> 2583–2621 + 2672–2677. Sits directly above `.approval-table-wrap`
> (top corners share `var(--toss-radius-inner)` so toolbar + table read as one
> rounded card). `.filter-seg`/`.cnt`/`.tt-select` (§3) are the chips/dropdowns
> that live inside this same toolbar.

### `.table-toolbar` (container, lines 2583–2591)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `flex` | flex | 2584 |
| `align-items` | `center` | center | 2584 |
| `gap` | `10px` | 10px | 2584 |
| `padding` | `14px 16px` | 14px 16px | 2585 |
| `border` | `0` | 0 | 2586 |
| `border-bottom` | `none` | none | 2587 |
| `border-radius` | `var(--toss-radius-inner) var(--toss-radius-inner) 0 0` | `12px 12px 0 0` | 2588 |
| `background` | `var(--toss-inner-bg)` | `#F7F8FA` | 2589 |
| `flex-wrap` | `wrap` | wrap | 2590 |

### `.table-toolbar .tt-search` (search wrapper, lines 2592–2597)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `position` | `relative` | relative | 2593 |
| `flex` | `1 1 260px` | 1 1 260px | 2594 |
| `min-width` | `220px` | 220px | 2595 |
| `max-width` | `360px` | 360px | 2596 |

### `.table-toolbar .tt-search svg` (search icon, lines 2598–2601)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `position` | `absolute` | absolute | 2599 |
| `left` | `10px` | 10px | 2599 |
| `top` | `50%` | 50% | 2599 |
| `transform` | `translateY(-50%)` | translateY(-50%) | 2599 |
| `color` | `var(--fg-4)` | `#9CA3AF` | 2600 |
| `pointer-events` | `none` | none | 2600 |

> Icon width/height are inline `<svg>` attributes in markup, not CSS (per-instance, ambiguous from CSS alone).

### `.table-toolbar .tt-search input` (search input, lines 2602–2611)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `width` | `100%` | 100% | 2603 |
| `height` | `32px` | 32px | 2603 |
| `border` | `1px solid var(--border-default)` | `1px solid #E5E7EB` | 2604 |
| `border-radius` | `8px` | 8px | 2605 |
| `padding` | `0 12px 0 32px` | 0 12px 0 32px | 2606 |
| `font-size` | `12.5px` | 12.5px | 2607 |
| `background` | `#fff` | `#FFFFFF` | 2608 |
| `outline` | `none` | none | 2609 |
| `color` | `var(--fg-1)` | `#111827` | 2610 |
| `font-weight` | not declared | inherited | — |
| `letter-spacing` | not declared | inherited (`-0.018em`) | — |
| `line-height` | not declared | inherited | — |

> `font-family: inherit` is pinned on `input` globally (line 580); inherited font = `Geist` (inline body 5168; the line-572 stack is the fallback chain).

### `.table-toolbar .tt-search input:focus` (line 2612–2615)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `border-color` | `var(--color-primary)` | `#0064FF` | 2613 |
| `box-shadow` | `0 0 0 3px rgba(0,100,255,0.08)` | (literal) | 2614 |

### `.table-toolbar .tt-divider` (line 2616–2618)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `width` | `1px` | 1px | 2617 |
| `height` | `18px` | 18px | 2617 |
| `background` | `var(--border-default)` | `#E5E7EB` | 2617 |

### `.table-toolbar .tt-label` (line 2619–2621)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `font-size` | `11.5px` | 11.5px | 2620 |
| `color` | `var(--fg-3)` | `#6B7280` | 2620 |
| `font-weight` | `500` | 500 | 2620 |

### `.tt-spacer` (line 2672)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `flex` | `1` | 1 | 2672 |

> Note: `.tt-spacer` is declared **un-nested** (not under `.table-toolbar`) at line 2672 — selector is bare `.tt-spacer`.

### `.tt-count` (count text, lines 2673–2676)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `font-size` | `12px` | 12px | 2674 |
| `color` | `var(--fg-3)` | `#6B7280` | 2674 |
| `font-variant-numeric` | `tabular-nums` | tabular-nums | 2675 |

> Note: `.tt-count` is declared **un-nested** (bare selector, line 2673), like `.tt-spacer`.

### `.tt-count strong` (emphasis, line 2677)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `color` | `var(--fg-1)` | `#111827` | 2677 |
| `font-weight` | `600` | 600 | 2677 |

---

## `.error-banner`

> Scan-error banner used in the target-source screens. Rule block: lines
> 1736–1745. Distinct from `.step-banner` (§1) — narrower, centered, with a
> 1px error border, and a 2-line icon+title+body layout (`flex-start`).

### `.error-banner` (container, lines 1736–1742)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `margin` | `0 auto 20px` | 0 auto 20px | 1737 |
| `max-width` | `480px` | 480px | 1737 |
| `background` | `#FEF2F2` | `#FEF2F2` (literal hex) | 1738 |
| `border` | `1px solid #FECACA` | `1px solid #FECACA` (literal hex) | 1738 |
| `border-radius` | `10px` | 10px | 1738 |
| `padding` | `14px 18px` | 14px 18px | 1739 |
| `display` | `flex` | flex | 1740 |
| `align-items` | `flex-start` | flex-start | 1740 |
| `gap` | `12px` | 12px | 1740 |
| `text-align` | `left` | left | 1741 |

### `.error-banner .icon` (line 1743)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `color` | `var(--color-error)` | `#EF4444` | 1743 |
| `margin-top` | `2px` | 2px | 1743 |
| `flex-shrink` | `0` | 0 | 1743 |

> Icon SVG width/height are inline markup attributes, not CSS.

### `.error-banner h4` (title, line 1744)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `margin` | `0 0 4px` | 0 0 4px | 1744 |
| `font-size` | `13.5px` | 13.5px | 1744 |
| `color` | `var(--color-error-dark)` | `#991B1B` | 1744 |
| `font-weight` | `600` | 600 | 1744 |

### `.error-banner p` (body, line 1745)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `margin` | `0` | 0 | 1745 |
| `font-size` | `12.5px` | 12.5px | 1745 |
| `color` | `#7F1D1D` | `#7F1D1D` (literal hex) | 1745 |

---

# 4. BUTTONS — base `.btn` + variants used in target-source screens

Base rule: lines 932–940. Variants actually rendered in lines 5565–7254
(per grep): `primary` ×10, `warn-outline` ×7, `danger-outline` ×3,
`sm ghost` ×2, `outline` ×2, `soft` ×1, `collab-chip` ×1.

## 4.1 `.btn` (base, lines 932–939)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `inline-flex` | inline-flex | 933 |
| `align-items` | `center` | center | 933 |
| `gap` | `6px` | 6px | 933 |
| `height` | `40px` | 40px | 934 |
| `padding` | `0 18px` | 0 18px | 934 |
| `border-radius` | `12px` | 12px | 935 |
| `font-size` | `14px` | 14px | 936 |
| `font-weight` | `700` | 700 | 936 |
| `letter-spacing` | `-0.01em` | -0.01em | 937 |
| `transition` | `background 0.15s, border-color 0.15s, transform 0.08s, box-shadow 0.15s` | (literal) | 938 |
| `white-space` | `nowrap` | nowrap | 939 |
| `line-height` | not declared | inherited | — |
| `color` | not declared (set per variant) | global reset `inherit` (579) | — |
| `background` | not declared (set per variant) | global reset `none` (579) | — |
| `border` | not declared (variants set `0`) | global reset `none` (579) | — |

> `.btn` is rendered on `<button>` elements, so before any variant the global
> reset `button { background: none; border: none; color: inherit }` (line 579)
> applies: a `.btn` with no variant resolves to `background:none`,
> `border:none`, `color:inherit`. Each variant (`primary`, `outline`, etc.)
> then sets its own fill/text/border. Stated, not guessed.

### `.btn:active` (line 941)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `transform` | `scale(0.97)` | scale(0.97) | 941 |

## 4.2 `.btn.primary` (lines 942–943)

Overrides only background + color; inherits all geometry/type from `.btn`.

| property | literal | resolved | v15 line |
|---|---|---|---|
| `background` | `var(--color-primary)` | `#0064FF` | 942 |
| `color` | `#fff` | `#FFFFFF` | 942 |
| `:hover` `background` | `var(--color-primary-hover)` | `#0050D6` | 943 |
| (geometry/type) | inherit `.btn` | h40 / pad `0 18px` / r12 / 14px/700 / ls -0.01em | 932–939 |

### `.btn.primary[disabled]`, `.btn.primary.is-disabled` (lines 2465–2470)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `background` | `var(--gray-200)` | `#E5E7EB` | 2467 |
| `color` | `var(--fg-4)` | `#9CA3AF` | 2467 |
| `cursor` | `not-allowed` | not-allowed | 2468 |
| `box-shadow` | `none` | none | 2469 |

## 4.3 `.btn.warn-outline` (lines 950–951)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `border` | `0` | 0 | 950 |
| `color` | `#92400E` | `#92400E` (literal hex) | 950 |
| `background` | `#FEF3C7` | `#FEF3C7` (literal hex) | 950 |
| `font-weight` | `600` | 600 (overrides base 700) | 950 |
| `:hover` `background` | `#FDE68A` | `#FDE68A` | 951 |
| (geometry) | inherit `.btn` | h40 / pad `0 18px` / r12 / 14px / ls -0.01em | 932–939 |

## 4.4 `.btn.danger-outline` (lines 1009–1010)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `border` | `0` | 0 | 1009 |
| `color` | `var(--color-error-dark)` | `#991B1B` | 1009 |
| `background` | `#FEF2F2` | `#FEF2F2` (literal hex) | 1009 |
| `font-weight` | `600` | 600 (overrides base 700) | 1009 |
| `:hover` `background` | `#FEE2E2` | `#FEE2E2` | 1010 |
| (geometry) | inherit `.btn` | h40 / pad `0 18px` / r12 / 14px / ls -0.01em | 932–939 |

## 4.5 `.btn.outline` (lines 946–947)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `border` | `0` | 0 | 946 |
| `color` | `var(--toss-strong-text)` | `#191F28` | 946 |
| `background` | `var(--toss-inner-bg)` | `#F7F8FA` | 946 |
| `:hover` `background` | `#ECEEF1` | `#ECEEF1` | 947 |
| `font-weight` | inherit `.btn` | 700 | 936 |
| (geometry) | inherit `.btn` | h40 / pad `0 18px` / r12 / 14px / ls -0.01em | 932–939 |

## 4.6 `.btn.soft` (lines 4857–4864 — base 4857–4862, `:hover` 4863, `:active` 4864)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `background` | `var(--color-primary-light)` | `#E8F1FF` | 4858 |
| `color` | `var(--color-primary)` | `#0064FF` | 4859 |
| `font-weight` | `700` | 700 | 4860 |
| `border` | `0` | 0 | 4861 |
| `:hover` `background` | `#D6E7FF` | `#D6E7FF` | 4863 |
| `:active` `background` | `#C3DCFF` | `#C3DCFF` | 4864 |
| (geometry) | inherit `.btn` | h40 / pad `0 18px` / r12 / 14px / ls -0.01em | 932–939 |

## 4.7 `.btn.ghost` + `.btn.sm` (rendered together as `class="btn sm ghost"`)

### `.btn.ghost` (lines 944–945)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `color` | `var(--color-primary)` | `#0064FF` | 944 |
| `font-weight` | `700` | 700 | 944 |
| `background` | `transparent` | transparent | 944 |
| `:hover` `background` | `var(--color-primary-50)` | `#EFF6FF` | 945 |
| `border` | not declared | none | — |

### `.btn.sm` size modifier (line 1011) — overrides base geometry

| property | literal | resolved | v15 line |
|---|---|---|---|
| `height` | `32px` | 32px (overrides base 40px) | 1011 |
| `padding` | `0 12px` | 0 12px (overrides base `0 18px`) | 1011 |
| `font-size` | `13px` | 13px (overrides base 14px) | 1011 |
| `border-radius` | `10px` | 10px (overrides base 12px) | 1011 |

> Resolved `class="btn sm ghost"`: height 32px, padding `0 12px`, font-size
> 13px, border-radius 10px, font-weight 700, color `#0064FF`, background
> transparent, gap 6px, letter-spacing -0.01em.

## 4.8 `.btn.collab-chip` (Jira chip — header action, lines 858–872)

Self-contained — redefines its own geometry rather than inheriting `.btn`.

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `inline-flex` | inline-flex | 859 |
| `align-items` | `center` | center | 859 |
| `gap` | `8px` | 8px | 859 |
| `background` | `var(--toss-inner-bg)` | `#F7F8FA` | 860 |
| `color` | `var(--toss-strong-text)` | `#191F28` | 861 |
| `border` | `0` | 0 | 862 |
| `height` | `36px` | 36px (overrides base 40px) | 863 |
| `padding` | `0 14px` | 0 14px | 864 |
| `border-radius` | `10px` | 10px | 865 |
| `font-weight` | `600` | 600 (overrides base 700) | 866 |
| `font-size` | `13px` | 13px (overrides base 14px) | 867 |
| `letter-spacing` | `-0.005em` | -0.005em | 868 |
| `cursor` | `pointer` | pointer | 869 |
| `text-decoration` | `none` | none | 870 |
| `transition` | `background 0.12s` | (literal) | 871 |
| `:hover` `background` | `#ECEEF1` | `#ECEEF1` | 873 |

### `.btn.collab-chip` children

| selector | property | literal | resolved | v15 line |
|---|---|---|---|---|
| `.cc-icon` | `color` | `var(--toss-medium-text)` | `#4E5968` | 874 |
| `.cc-icon` | `flex-shrink` | `0` | 0 | 874 |
| `.cc-k` | `color` | `var(--toss-weak-text)` | `#8B95A1` | 876 |
| `.cc-k` | `font-size` | `12px` | 12px | 877 |
| `.cc-k` | `font-weight` | `600` | 600 | 878 |
| `.cc-k` | `letter-spacing` | `0` | 0 | 879 |
| `.cc-v` | `font-family` | `'Geist Mono', monospace` | (literal) | 882 |
| `.cc-v` | `font-size` | `12.5px` | 12.5px | 883 |
| `.cc-v` | `font-weight` | `600` | 600 | 884 |
| `.cc-arrow` | `opacity` | `0.5` | 0.5 | 886 |
| `.cc-arrow` | `flex-shrink` | `0` | 0 | 886 |

---

# 5. Ambiguities / inherited / not-declared

- **`.step-banner` icon SVG size**: width/height come from per-`<svg>` inline
  attributes in markup, not CSS. Only `flex-shrink: 0` (1970) + inherited
  `currentColor` are CSS-controlled.
- **`.toolbar-search` / `.toolbar-filter` / `.tt-select` font-weight &
  letter-spacing**: not declared on the input/select where omitted above →
  inherit from body. Per `00-tokens.md`, the effective inherited `font-family` is
  `Geist` (inline body 5168) — the body stack declared at line 572
  (`'Geist', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard',
  sans-serif`, which overrides `--font-sans`) is the fallback chain (input/select also
  pin `font-family: inherit` at line 580). Stated, not guessed.
- **`.toolbar-filter` has no `:hover`** rule. The inline filter icon styling
  (`margin-right:4px; vertical-align:-2px`, `width="13"`) is markup, not CSS.
- **Base `.btn` declares no `color`/`background`/`border`** — these are set by
  each variant. A `.btn` with no variant would have no fill/text colour from
  these rules.
- **`.btn.warn-outline` / `.danger-outline` / `.collab-chip` set `font-weight:
  600`**, overriding base `.btn` 700. Noted per-variant above.
- **`line-height` is never declared** on any `.btn` variant or banner →
  inherited from body. Not assumed.
- **Disabled primary** (`[disabled]` / `.is-disabled`) is the only disabled
  state defined for buttons in this set; no disabled rule for the other
  variants.
- The named `.toolbar-search`/`.toolbar-filter` render at lines 5329–5336
  (screen-3, just above the 5565 target-source band). The filter-tab cluster
  inside the 5565–7254 band uses `.filter-seg`/`.cnt`/`.tt-select` (§3),
  rendered at 5930–5936. Both transcribed to avoid an approximation gap.
