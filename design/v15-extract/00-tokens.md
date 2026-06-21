# v15 Design Tokens — literal `:root` from `SIT Prototype Athena v15.html`

> Ground truth, transcribed verbatim from the first `<style>` block (`:root`,
> lines 263–382) and the `.ds-*` semantic classes (lines 388–503). This file is
> the canonical resolver for every `var(--x)` referenced by the component specs.
> Values are EXACT — no rounding, no inference. Cite v15 line numbers.

## Colors (lines 264–329)

| Token | Value |
|---|---|
| `--color-primary` | `#0064FF` |
| `--color-primary-hover` | `#0050D6` |
| `--color-primary-light` | `#E8F1FF` |
| `--color-primary-50` | `#EFF6FF` |
| `--color-primary-100` | `#DBEAFE` |
| `--color-success` | `#45CB85` |
| `--color-success-dark` | `#2A7D52` |
| `--color-success-hover` | `#3AB574` |
| `--color-error` | `#EF4444` |
| `--color-error-dark` | `#991B1B` |
| `--color-warning` | `#F97316` |
| `--color-warning-dark` | `#9A3412` |
| `--color-pending` | `#9CA3AF` |
| `--color-pending-dark` | `#4B5563` |
| `--color-info` | `#3B82F6` |
| `--color-info-dark` | `#1E40AF` |
| `--color-provider-aws` | `#FF9900` |
| `--color-provider-azure` | `#0078D4` |
| `--color-provider-gcp` | `#4285F4` |
| `--color-provider-idc` | `#374151` |
| `--color-provider-sdu` | `#9333EA` |
| `--gray-50` | `#F9FAFB` |
| `--gray-100` | `#F3F4F6` |
| `--gray-200` | `#E5E7EB` |
| `--gray-300` | `#D1D5DB` |
| `--gray-400` | `#9CA3AF` |
| `--gray-500` | `#6B7280` |
| `--gray-600` | `#4B5563` |
| `--gray-700` | `#374151` |
| `--gray-800` | `#1F2937` |
| `--gray-900` | `#111827` |
| `--fg-1` | `var(--gray-900)` = `#111827` |
| `--fg-2` | `var(--gray-700)` = `#374151` |
| `--fg-3` | `var(--gray-500)` = `#6B7280` |
| `--fg-4` | `var(--gray-400)` = `#9CA3AF` |
| `--fg-inverse` | `#FFFFFF` |
| `--bg-page` | `#FFFFFF` |
| `--bg-muted` | `var(--gray-50)` = `#F9FAFB` |
| `--bg-surface` | `#FFFFFF` |
| `--bg-tinted` | `var(--gray-100)` = `#F3F4F6` |
| `--border-light` | `var(--gray-100)` = `#F3F4F6` |
| `--border-default` | `var(--gray-200)` = `#E5E7EB` |
| `--border-strong` | `var(--gray-300)` = `#D1D5DB` |

## Athena group tokens — 3rd `:root` (lines 3612–3619)

Orange "Athena group" theme used by the Athena-grouped table rows / pager / tags
(referenced in 03 and 05). Transcribed verbatim.

| Token | Value |
|---|---|
| `--athena-spine` | `#C2410C` (continuous left rail) |
| `--athena-spine-soft` | `#E8A063` (dimmed, excluded rows) |
| `--athena-deep` | `#7A2E05` |
| `--athena-band-bg` | `#FFE6CF` |
| `--athena-band-edge` | `#D9A86A` |
| `--athena-sub-bg` | `#FFFAF3` |
| `--athena-sub-edge` | `#F0E1CB` |

## Component-local custom property — `--ib-accent` (identity-bar accent)

Not a `:root` token — declared on `.identity-bar` (line 753) and re-set per provider
by JS (`PROV_ACCENT`, line ~9088). Listed here because the specs reference it.

| context | value |
|---|---|
| default (CSS 753) | `var(--color-provider-azure)` = `#0078D4` |
| aws | `#FF9900` (`--color-provider-aws`) |
| azure | `#0078D4` (`--color-provider-azure`) |
| gcp | `#4285F4` (`--color-provider-gcp`) |
| idc | `#374151` (`--color-provider-idc`) |

## Radii (334–338)

`--radius-sm` 6px · `--radius-button` 8px · `--radius-card` 12px · `--radius-card-lg` 16px · `--radius-pill` 9999px

## Shadows (343–346)

- `--shadow-card`: `0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)`
- `--shadow-card-hover`: `0 4px 12px -2px rgb(0 0 0 / 0.10), 0 2px 4px -2px rgb(0 0 0 / 0.06)`
- `--shadow-modal`: `0 20px 25px -5px rgb(0 0 0 / 0.10), 0 8px 10px -6px rgb(0 0 0 / 0.10)`
- `--shadow-button`: `0 1px 2px 0 rgb(0 0 0 / 0.05)`

## Spacing — 4px base (351–359)

`--space-1/2/3/4/5/6/8/10/12` = 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 (px) — note: there is **no** `--space-7/9/11`

## Typography (364–376)

- `--font-sans`: `'Geist', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', 'Malgun Gothic', system-ui, sans-serif`
- `--font-mono`: `'Geist Mono', ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace`
- Type scale (px): display 28 · h1 22 · h2 20 · h3 18 · body 15 · body-sm 14 · caption 13 · label 12 · micro 11
- Gradients (379–381): `--gradient-brand` `linear-gradient(135deg, #0064FF 0%, #6366f1 100%)` · `--gradient-success` `linear-gradient(135deg, #10b981 0%, #059669 100%)` · `--gradient-indigo` `linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)` (not used by the target-source screens)

## ⭐ Toss surface tokens — 2nd `:root` (lines 546–567) — THE TOKENS THE SCREENS ACTUALLY USE

The target-source screens are "Toss-flavored" and consume THESE, not the first
`:root`'s `--radius-card`/`--bg-*`. Easy to miss — they live in the 2nd `<style>`.

| Token | Value |
|---|---|
| `--toss-page-bg` | `#F2F4F6` (page sits on light grey) |
| `--toss-card-bg` | `#FFFFFF` |
| `--toss-inner-bg` | `#F7F8FA` (nested surface inside cards) |
| `--toss-divider` | `#EBEEF2` |
| `--toss-strong-text` | `#191F28` (Toss black) |
| `--toss-medium-text` | `#4E5968` |
| `--toss-weak-text` | `#8B95A1` |
| `--toss-faint-text` | `#B0B8C1` |
| `--toss-shadow-sm` | `0 1px 2px rgba(17, 24, 39, 0.04), 0 4px 16px -8px rgba(17, 24, 39, 0.06)` |
| `--toss-shadow-md` | `0 2px 4px rgba(17, 24, 39, 0.04), 0 12px 32px -12px rgba(17, 24, 39, 0.10)` |
| `--toss-shadow-lg` | `0 8px 16px rgba(17, 24, 39, 0.04), 0 24px 48px -16px rgba(17, 24, 39, 0.14)` |
| `--toss-radius-card` | **20px** (big surfaces — NOT the 12px `--radius-card`) |
| `--toss-radius-card-sm` | `16px` |
| `--toss-radius-inner` | `12px` |
| `--toss-radius-pill` | `10px` |

## ⭐ Body base — GLOBAL defaults (lines 570–578) — applies to EVERYTHING

```
html, body {
  font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', sans-serif;
  background: var(--toss-page-bg);   /* #F2F4F6 */
  color: var(--toss-strong-text);    /* #191F28 */
  font-size: 15px;
  letter-spacing: -0.018em;          /* ← GLOBAL — every text node inherits this */
  -webkit-font-smoothing: antialiased;
}
```

> **‼️ INLINE BODY OVERRIDE wins the cascade — line 5168:**
> `<body style="background-color: rgb(244, 244, 251); font-family: Geist">`. Inline
> styles beat the stylesheet `html, body` rule (570–578). So the TRUE rendered defaults are:
> - **page background = `rgb(244, 244, 251)` = `#F4F4FB`** (inline 5168) — this OVERRIDES the
>   stylesheet `background: var(--toss-page-bg)` `#F2F4F6` (573). The app page/shell bg the
>   cards sit on is **`#F4F4FB`**, not `#F2F4F6`.
> - **inherited font-family = `Geist`** (inline 5168) — overrides even the 572 stack. When
>   Geist loads (it does, via the web font) every text node renders **Geist**. The 572 stack
>   / `--font-sans` only matter as fallbacks if Geist is unavailable.
>
> **⚠️ EFFECTIVE inherited defaults — use THESE for any "inherited" value in the specs:**
> - **font-family** = `Geist` (inline 5168). The stylesheet 572 stack
>   `'Geist', -apple-system, …, 'Pretendard', sans-serif` is the fallback chain (it overrides
>   `--font-sans` at 364, which adds `'Malgun Gothic'`/`system-ui`). For implementation: use
>   Geist (e.g. next/font). Do not cite `--font-sans`.
> - **color** = `#191F28` (`--toss-strong-text`, 574) — NOT `--fg-1` `#111827`.
> - **letter-spacing** = `-0.018em` (576) — a global inherited default. (The repo's current
>   `DESIGN.md` line 179 claims it is *not* global — a confirmed divergence, a likely cause
>   of "자간이 틀렸다".) Any element without its own `letter-spacing` inherits `-0.018em`,
>   not `normal`.
> - **font-size** = `15px` (575) is the inherited base; `margin: 0; padding: 0` on body (571).
>
> `* { box-sizing: border-box }` (569). Decorative `@font-face 'Caveat'` (508–541) exists
> but is unused by these screens.

## `.ds-*` reference classes (388–503) — REFERENCE ONLY (not a screen contract)

> ⚠️ SCOPE: the `.ds-*` block is a **design-system reference** in the first
> `<style>`. The target-source screens (5565–7254) do **not** consume any `.ds-*`
> class — they use `.card` / `.status` / `.pbar` / `.db-list-table` / `.install-task`
> / etc. (extracted byte-exact in 01–07). It is kept here only as a token-mapping
> aid; the screen pixel-contract is 01–07, not this block. The transcription below
> is **complete and byte-exact**: every rule in 388–503, every declared property,
> its DECLARED LITERAL value (the `var(--x)` kept verbatim) and its RESOLVED value.

### `body, .ds-body` base (388–394)

| property | declared literal | resolved |
|---|---|---|
| `font-family` | `var(--font-sans)` | `'Geist', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', 'Malgun Gothic', system-ui, sans-serif` |
| `color` | `var(--fg-1)` | `#111827` |
| `background` | `var(--bg-page)` | `#FFFFFF` |
| `-webkit-font-smoothing` | `antialiased` | `antialiased` |
| `-moz-osx-font-smoothing` | `grayscale` | `grayscale` |

### Typographic classes (396–448)

`font-size` is declared as a `var(--type-*)` token; both the literal and resolved
px are given. Dashes mean the property is not declared on that rule.

| class | line | `font-size` literal | →px | `font-weight` | `letter-spacing` | `line-height` | `color` (literal → resolved) | `text-transform` |
|---|---|---|---|---|---|---|---|---|
| `.ds-h1` | 396–402 | `var(--type-display)` | 28px | `700` | `-0.02em` | `1.15` | `var(--fg-1)` → `#111827` | — |
| `.ds-h2` | 403–409 | `var(--type-h1)` | 22px | `700` | `-0.01em` | `1.25` | `var(--fg-1)` → `#111827` | — |
| `.ds-h3` | 410–415 | `var(--type-h3)` | 18px | `600` | — | `1.3` | `var(--fg-1)` → `#111827` | — |
| `.ds-body` | 416–420 | `var(--type-body)` | 15px | — | — | `1.55` | `var(--fg-2)` → `#374151` | — |
| `.ds-body-sm` | 421–425 | `var(--type-body-sm)` | 14px | — | — | `1.5` | `var(--fg-2)` → `#374151` | — |
| `.ds-caption` | 426–430 | `var(--type-caption)` | 13px | — | — | `1.4` | `var(--fg-3)` → `#6B7280` | — |
| `.ds-label` | 431–435 | `var(--type-label)` | 12px | — | — | `1.3` | `var(--fg-3)` → `#6B7280` | — |
| `.ds-micro` | 436–440 | `var(--type-micro)` | 11px | — | `0.01em` | — | `var(--fg-4)` → `#9CA3AF` | — |
| `.ds-card-title` | 441–448 | `var(--type-body-sm)` | 14px | `600` | `0.05em` | — | `var(--fg-3)` → `#6B7280` | `uppercase` |

> `.ds-h2` is the **only** class whose `font-size` token name diverges from its
> class number: `.ds-h2` declares `var(--type-h1)` (=22px), not `--type-h2`.
> `.ds-card-title` carries the inline comment `/* The distinctive section header
> style from Card.tsx */` (442).

### `.ds-mono` (449–451)

| property | declared literal | resolved |
|---|---|---|
| `font-family` | `var(--font-mono)` | `'Geist Mono', ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace` |

### Card recipes (453–463)

`.ds-card` (454–459):

| property | declared literal | resolved |
|---|---|---|
| `background` | `var(--bg-surface)` | `#FFFFFF` |
| `border-radius` | `var(--radius-card)` | `12px` |
| `box-shadow` | `var(--shadow-card)` | `0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)` |
| `padding` | `var(--space-6)` | `24px` |

`.ds-card--flat` (460–463) — overrides only:

| property | declared literal | resolved |
|---|---|---|
| `box-shadow` | `none` | `none` |
| `border` | `1px solid var(--border-default)` | `1px solid #E5E7EB` |

### Button recipes (465–485)

`.ds-btn` base (466–477):

| property | declared literal | resolved |
|---|---|---|
| `display` | `inline-flex` | `inline-flex` |
| `align-items` | `center` | `center` |
| `gap` | `var(--space-2)` | `8px` |
| `padding` | `8px 16px` | `8px 16px` |
| `border-radius` | `var(--radius-button)` | `8px` |
| `font-weight` | `500` | `500` |
| `font-size` | `var(--type-body-sm)` | `14px` |
| `transition` | `all 150ms ease` | `all 150ms ease` |
| `cursor` | `pointer` | `pointer` |
| `border` | `0` | `0` |

`.ds-btn--*` variants + hover rules (478–485):

| rule | line | declared literal | resolved |
|---|---|---|---|
| `.ds-btn--primary` | 478 | `background: var(--color-primary); color: #fff; box-shadow: var(--shadow-button);` | `background: #0064FF; color: #fff; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);` |
| `.ds-btn--primary:hover` | 479 | `background: var(--color-primary-hover);` | `background: #0050D6;` |
| `.ds-btn--secondary` | 480 | `background: #fff; color: var(--fg-2); border: 1px solid var(--border-strong);` | `background: #fff; color: #374151; border: 1px solid #D1D5DB;` |
| `.ds-btn--secondary:hover` | 481 | `background: var(--gray-50);` | `background: #F9FAFB;` |
| `.ds-btn--ghost` | 482 | `background: transparent; color: var(--fg-3);` | `background: transparent; color: #6B7280;` |
| `.ds-btn--ghost:hover` | 483 | `background: var(--gray-100);` | `background: #F3F4F6;` |
| `.ds-btn--danger` | 484 | `background: #DC2626; color: #fff;` | `background: #DC2626; color: #fff;` |
| `.ds-btn--success` | 485 | `background: var(--color-success); color: #fff;` | `background: #45CB85; color: #fff;` |

### Badge recipe (488–497)

`.ds-badge` (488–496):

| property | declared literal | resolved |
|---|---|---|
| `display` | `inline-flex` | `inline-flex` |
| `align-items` | `center` | `center` |
| `gap` | `6px` | `6px` |
| `border-radius` | `var(--radius-pill)` | `9999px` |
| `font-weight` | `500` | `500` |
| `font-size` | `var(--type-label)` | `12px` |
| `padding` | `2px 10px` | `2px 10px` |

`.ds-badge__dot` (497):

| property | declared literal | resolved |
|---|---|---|
| `width` | `6px` | `6px` |
| `height` | `6px` | `6px` |
| `border-radius` | `50%` | `50%` |

### Focus ring (499–503) — comment `/* Focus ring — matches globals.css */`

`.ds-focus:focus-visible`:

| property | declared literal | resolved |
|---|---|---|
| `outline` | `2px solid var(--color-primary)` | `2px solid #0064FF` |
| `outline-offset` | `2px` | `2px` |

> NOTE — the target-source screens (lines 5565–7254) use their OWN component
> classes (`.card`, `.status`, `.pbar`, `.db-list-table`, `.install-task`, …)
> defined in the 2nd `<style>` block (506–4909), NOT these `.ds-*` reference
> classes. Those literal values are extracted per-component in the sibling specs.
