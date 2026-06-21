# v15 Card Components — literal CSS spec

> Transcribed verbatim from `SIT Prototype Athena v15.html` (2nd `<style>` block).
> Every value is EXACT — no rounding, no inference. `var(--x)` resolved to its
> literal value AND the var name kept. v15 line numbers cited per row.
>
> **Resolver note:** the `.card` rules do NOT use the `--color-*`/`--radius-*`/
> `--shadow-*` tokens documented in `00-tokens.md`. They use a *second* token
> layer — the `--toss-*` overrides defined in a separate `:root` block at lines
> 545–567. Those resolved values are listed below and used throughout this spec.
> Only `--color-primary` (`#0064FF`, line 264) comes from the first token layer.

## `--toss-*` resolver (lines 545–567)

| Token | Literal | v15 line |
|---|---|---|
| `--toss-card-bg` | `#FFFFFF` | 549 |
| `--toss-strong-text` | `#191F28` | 552 |
| `--toss-weak-text` | `#8B95A1` | 554 |
| `--toss-shadow-sm` | `0 1px 2px rgba(17, 24, 39, 0.04), 0 4px 16px -8px rgba(17, 24, 39, 0.06)` | 558 |
| `--toss-radius-card` | `20px` | 563 |
| `--color-primary` | `#0064FF` | 264 |

---

## `.card` (lines 889–894)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `background` | `var(--toss-card-bg)` | `#FFFFFF` | 890 |
| `border` | `0` | `0` | 891 |
| `border-radius` | `var(--toss-radius-card)` | `20px` | 892 |
| `box-shadow` | `var(--toss-shadow-sm)` | `0 1px 2px rgba(17, 24, 39, 0.04), 0 4px 16px -8px rgba(17, 24, 39, 0.06)` | 893 |

Notes: no `padding`, `margin`, `display`, `gap`, `color`, `font-*` declared on
`.card` itself. Padding is supplied by `.card-header` + `.card-body`. In markup
the `margin-bottom`/`margin-top` is set via inline `style="..."` attributes
(e.g. `margin-bottom: 20px;`, `margin-top: 0;`), NOT in the `.card` rule.

---

## `.card-header` (lines 895–900)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `flex` | `flex` | 896 |
| `justify-content` | `space-between` | `space-between` | 896 |
| `align-items` | `flex-start` | `flex-start` | 896 |
| `padding` | `28px 28px 12px` | `28px 28px 12px` | 897 |
| `border-bottom` | `0` | `0` | 898 |
| `gap` | `16px` | `16px` | 899 |

Notes: no `background`, `border-radius`, `color`, `font-*` on the base
`.card-header`. (Both `background` and `border-bottom` are overridden by the
`.guide-variant` modifier — see below.)

---

## `.card-header > div:first-child` (line 901)

The left/title column inside the header (wraps eyebrow + h2 + p).

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `flex` | `flex` | 901 |
| `flex-direction` | `column` | `column` | 901 |
| `gap` | `6px` | `6px` | 901 |
| `min-width` | `0` | `0` | 901 |

---

## `.card-header .eyebrow` (lines 902–907) — card eyebrow / kicker

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `inline-flex` | `inline-flex` | 903 |
| `align-items` | `center` | `center` | 903 |
| `gap` | `6px` | `6px` | 903 |
| `font-size` | `12px` | `12px` | 904 |
| `font-weight` | `700` | `700` | 904 |
| `color` | `var(--color-primary)` | `#0064FF` | 905 |
| `letter-spacing` | `0.02em` | `0.02em` | 906 |

Notes: no `line-height`, `font-family`, `text-transform`, `margin` declared
(inherited / browser default).

---

## `.card-header h2` (lines 908–914) — card title typography

| property | literal | resolved | v15 line |
|---|---|---|---|
| `margin` | `0` | `0` | 909 |
| `font-size` | `26px` | `26px` | 909 |
| `font-weight` | `800` | `800` | 909 |
| `letter-spacing` | `-0.045em` | `-0.045em` | 910 |
| `line-height` | `1.2` | `1.2` | 911 |
| `color` | `var(--toss-strong-text)` | `#191F28` | 912 |
| `white-space` | `nowrap` | `nowrap` | 913 |

Notes: `font-family` NOT declared here → inherited as `Geist` (inline body 5168;
the line-572 stack is the fallback chain). The line-572 rule OVERRIDES `--font-sans`
with the literal stack `'Geist', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic
Neo', 'Pretendard', sans-serif` (NO `'Malgun Gothic'`, NO `system-ui`), but the inline
body style at 5168 narrows the effective family to `Geist`. The `.guide-variant` modifier overrides
`color` and adds `display: inline-flex; align-items: center; gap: 9px;` (see
below).

---

## `.card-header h2 .accent` (line 915)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `color` | `var(--color-primary)` | `#0064FF` | 915 |

---

## `.card-header h2 .h2-icon` (lines 916–922)

Inline icon slot rendered before/within the h2 title.

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `inline-flex` | `inline-flex` | 917 |
| `align-items` | `center` | `center` | 917 |
| `justify-content` | `center` | `center` | 917 |
| `width` | `24px` | `24px` | 918 |
| `height` | `24px` | `24px` | 918 |
| `margin-right` | `4px` | `4px` | 919 |
| `color` | `var(--color-primary)` | `#0064FF` | 920 |
| `vertical-align` | `-5px` | `-5px` | 921 |

---

## `.card-header p` (lines 923–928) — card subtitle / description typography

There is NO `.card-subtitle` / `.card-sub` class. The card subtitle is the
`<p>` directly inside `.card-header`.

| property | literal | resolved | v15 line |
|---|---|---|---|
| `font-size` | `13.5px !important` | `13.5px !important` | 924 |
| `color` | `var(--toss-weak-text) !important` | `#8B95A1 !important` | 925 |
| `line-height` | `1.55` | `1.55` | 926 |
| `font-weight` | `500` | `500` | 927 |

Notes: `font-size` and `color` carry `!important`. No `margin`, `letter-spacing`,
or `font-family` declared (margin = browser default for `<p>`; family inherited
as `Geist` — inline body 5168 narrows the effective family; the line-572 stack
`'Geist', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard',
sans-serif` (which OVERRIDES `--font-sans`) is the fallback chain).

---

## `.card-body` (line 929)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `padding` | `16px 28px 28px` | `16px 28px 28px` | 929 |

Notes: nothing else declared on `.card-body` — only padding.

---

## Modifier: `.card.guide-variant` (lines 1782–1786)

Yellow "guide" card variant. Used in the target-source screens (e.g. line ~5642,
`<div class="card guide-variant" …>`). Overrides the base `.card`.

| property | literal | resolved | v15 line |
|---|---|---|---|
| `background` | `#FFFDF5` | `#FFFDF5` (literal, no var) | 1783 |
| `border-color` | `#F3E8B8` | `#F3E8B8` (literal, no var) | 1784 |
| `box-shadow` | `0 1px 2px rgba(140,110,0,0.04), 0 6px 18px -10px rgba(140,110,0,0.12)` | same (literal) | 1785 |

Notes: `border-color` is set but base `.card` has `border: 0` (no border-style /
width), so the border-color has no visible effect unless a border-style/width is
also present. **Ambiguity flagged** — see Ambiguities.

### `.card.guide-variant > .card-header` (lines 1787–1790)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `background` | `linear-gradient(180deg, #FFF8E1 0%, #FFFCEE 100%)` | same (literal) | 1788 |
| `border-bottom` | `1px solid #F3E8B8` | same (literal) | 1789 |

Overrides base `.card-header` (`border-bottom: 0`, no background).

### `.card.guide-variant > .card-header h2` (lines 1791–1796)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `inline-flex` | `inline-flex` | 1792 |
| `align-items` | `center` | `center` | 1793 |
| `gap` | `9px` | `9px` | 1794 |
| `color` | `#78350F` | `#78350F` (literal, no var) | 1795 |

Overrides base `.card-header h2` `color` (`#191F28` → `#78350F`) and adds
flex/gap.

---

## Guide card content — `.guide-head-icon` / `.guide-content`

The collapsible guide body rendered per step inside the target-source screens.
`.guide-head-icon` is the round amber badge in the guide header; `.guide-content`
is the typographic container for the guide body (headings, paragraphs, lists,
links, inline code).

> Resolver: `var(--fg-1)` = `--gray-900` = `#111827`; `var(--fg-2)` = `--gray-700`
> = `#374151`; `var(--color-primary)` = `#0064FF` (line 264). Per `00-tokens.md`
> lines 33–34.

### `.guide-head-icon` (lines 1797–1805)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `width` | `26px` | `26px` | 1798 |
| `height` | `26px` | `26px` | 1798 |
| `background` | `#F59E0B` | `#F59E0B` (literal, no var) | 1799 |
| `color` | `#fff` | `#fff` (= `#FFFFFF`) | 1800 |
| `border-radius` | `50%` | `50%` | 1801 |
| `display` | `inline-grid` | `inline-grid` | 1802 |
| `place-items` | `center` | `center` | 1802 |
| `box-shadow` | `0 2px 5px -1px rgba(245,158,11,0.45)` | same (literal) | 1803 |
| `flex-shrink` | `0` | `0` | 1804 |

Notes: no `font-*` declared (font-family inherits `Geist` — inline body 5168; the line-572 stack is the fallback).

### `.guide-content` (lines 1807–1811)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `font-size` | `13px` | `13px` | 1808 |
| `color` | `var(--fg-2)` | `#374151` (`--gray-700`) | 1809 |
| `line-height` | `1.72` | `1.72` | 1810 |

Notes: no `font-family` declared → inherits `Geist` (inline body 5168; the line-572
stack is the fallback chain). No `letter-spacing` declared → inherits global `-0.018em` (line 576).

### `.guide-content h1, h2, h3, h4` (lines 1812–1819)

Applies to all four heading levels (selector list `h1, h2, h3, h4`).

| property | literal | resolved | v15 line |
|---|---|---|---|
| `color` | `var(--fg-1)` | `#111827` (`--gray-900`) | 1816 |
| `font-weight` | `700` | `700` | 1817 |
| `margin` | `14px 0 6px` | `14px 0 6px` | 1818 |

### `.guide-content h1:first-child, h2:first-child, h3:first-child, h4:first-child` (lines 1820–1823)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `margin-top` | `0` | `0` | 1823 |

Notes: overrides the `14px` top margin from the base heading rule when the
heading is the first child.

### `.guide-content h3` (line 1824)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `font-size` | `14px` | `14px` | 1824 |

### `.guide-content h4` (line 1825)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `font-size` | `13.5px` | `13.5px` | 1825 |

Notes: `h1`/`h2` font-size is NOT declared in `.guide-content` (inherits the
`color`/`weight`/`margin` from the grouped rule above, but font-size falls to the
browser default for the tag — flagged ambiguous). Only `h3` (14px) and `h4`
(13.5px) set an explicit font-size.

### `.guide-content p` (line 1826)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `margin` | `0 0 8px` | `0 0 8px` | 1826 |

### `.guide-content ul, .guide-content ol` (lines 1827–1829)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `margin` | `0 0 10px` | `0 0 10px` | 1828 |
| `padding-left` | `20px` | `20px` | 1828 |

### `.guide-content ul li, .guide-content ol li` (lines 1830–1831)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `margin-bottom` | `3px` | `3px` | 1831 |

### `.guide-content ul li::marker` (line 1832)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `color` | `var(--color-primary)` | `#0064FF` | 1832 |

Notes: applies the primary color to `ul` list markers only (`ol li::marker` is
NOT styled).

### `.guide-content a` (line 1833)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `color` | `var(--color-primary)` | `#0064FF` | 1833 |
| `font-weight` | `500` | `500` | 1833 |

### `.guide-content a:hover` (line 1834)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `text-decoration` | `underline` | `underline` | 1834 |

### `.guide-content strong` (line 1835)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `color` | `var(--fg-1)` | `#111827` (`--gray-900`) | 1835 |
| `font-weight` | `600` | `600` | 1835 |

### `.guide-content code` (lines 1836–1843)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `font-family` | `'Geist Mono', monospace` | `'Geist Mono', monospace` | 1837 |
| `font-size` | `12px` | `12px` | 1838 |
| `background` | `#F1F5F9` | `#F1F5F9` (literal, no var) | 1839 |
| `padding` | `1.5px 6px` | `1.5px 6px` | 1840 |
| `border-radius` | `4px` | `4px` | 1841 |
| `color` | `#0F172A` | `#0F172A` (literal, no var) | 1842 |

Notes: `code` declares its own `font-family` (the only `.guide-content`
descendant to do so) — NOT the body stack. `4px` border-radius is a literal, not
the `--radius-sm` (6px) token.

---

## Ambiguities / inherited / flagged

1. **No `.card-title`, `.card-sub`, `.card-subtitle` classes exist.** Searched
   the whole file (`grep`). The card title is `.card-header h2` (lines 908–914);
   the card subtitle is `.card-header p` (lines 923–928); the kicker is
   `.card-header .eyebrow` (lines 902–907). The `.ds-card-title` class (line 441)
   is a separate `.ds-*` reference class NOT used by these card components — do
   not confuse it with these.

2. **`font-family` is never declared** on any `.card*` rule. All card text
   inherits `Geist` (inline body 5168; the line-572 stack is the fallback chain).
   The line-572 rule OVERRIDES `--font-sans` with the literal stack `'Geist',
   -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard',
   sans-serif` (NO `'Malgun Gothic'`, NO `system-ui`), but the inline body style at
   5168 narrows the effective family to `Geist`. Marked inherited, not guessed.

3. **`.card` has no padding/margin of its own.** Outer margin comes from inline
   `style="margin-bottom: 20px;"` / `margin-top: 0;` on individual card elements
   in the markup (not in CSS). Inner padding comes entirely from `.card-header`
   (`28px 28px 12px`) and `.card-body` (`16px 28px 28px`).

4. **`.card-header p` uses `!important`** on `font-size` (`13.5px`) and `color`
   (`#8B95A1`). Preserved exactly — these win over any cascade.

5. **`.card.guide-variant` `border-color: #F3E8B8`** has no effect with base
   `border: 0` unless a border width/style is applied elsewhere. Transcribed
   literally; visual effect is ambiguous from CSS alone.

6. **`--toss-*` token layer:** these card rules deliberately use the `--toss-*`
   token layer (lines 546–567), a Toss-flavored override block now documented in
   `00-tokens.md` (the "Toss surface tokens" section). The resolved literals above
   come from that block. Only `--color-primary` overlaps with the first token layer.

7. **`.guide-content h1`/`h2` font-size is not declared.** The grouped
   `h1,h2,h3,h4` rule (lines 1812–1819) sets only `color`/`font-weight`/`margin`;
   explicit `font-size` is given for `h3` (14px, line 1824) and `h4` (13.5px,
   line 1825) only. `h1`/`h2` therefore fall to the UA default for the tag —
   **ambiguous**, flagged. (In practice the guide bodies use `h3`/`h4`.)

8. **`.guide-content` uses the FIRST token layer**, not `--toss-*`:
   `var(--fg-1)` = `#111827`, `var(--fg-2)` = `#374151`, `var(--color-primary)`
   = `#0064FF` (`00-tokens.md` lines 33–34, 264). Unlike `.card`, it does not
   reference `--toss-*` tokens.

9. **`.guide-content code` overrides the inherited font-family** with
   `'Geist Mono', monospace` (line 1837) — the only guide descendant to do so.
   Its `4px` border-radius (1841) is a literal, NOT the `--radius-sm` (6px) token.
   Its `#F1F5F9` background and `#0F172A` color are literals, no var.

10. **`.guide-head-icon` `background: #F59E0B`** and its shadow rgba
    `rgba(245,158,11,0.45)` are literal amber values, no var — distinct from the
    `.guide-variant` card palette (`#FFFDF5`/`#F3E8B8`/`#78350F`).
