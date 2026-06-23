# v15 Extract — STEP-4 Install Components

> Verbatim CSS transcription from `design/SIT Prototype Athena v15.html`.
> Every `var(--x)` resolved against `design/v15-extract/00-tokens.md` (the canonical
> resolver) and the `:root` / `--toss-*` block (lines 548–567). Values are LITERAL —
> no rounding, no inference. v15 line numbers cited per rule.
>
> Renders: Azure Private Link / AWS Terraform (auto+manual) / GCP VPC / IDC firewall
> install screens (markup at lines 6431–6650+).

## Token resolution map (used below)

| var | literal | v15 line |
|---|---|---|
| `--toss-inner-bg` | `#F7F8FA` | 550 |
| `--toss-strong-text` | `#191F28` | 552 |
| `--toss-medium-text` | `#4E5968` | 553 |
| `--toss-weak-text` | `#8B95A1` | 554 |
| `--toss-faint-text` | `#B0B8C1` | 555 |
| `--toss-radius-inner` | `12px` | 565 |
| `--toss-shadow-md` | `0 2px 4px rgba(17, 24, 39, 0.04), 0 12px 32px -12px rgba(17, 24, 39, 0.10)` | 559 |
| `--color-primary` | `#0064FF` | 264 |
| `--color-primary-hover` | `#0050D6` | 265 |
| `--color-primary-50` | `#EFF6FF` | 267 |
| `--color-success` | `#45CB85` | 273 |
| `--color-success-dark` | `#2A7D52` | 274 |

---

## 1. `.install-tasks` (grid container) — v15 1975–1981

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `grid` | grid | 1976 |
| grid-template-columns | `repeat(3, 1fr)` | repeat(3, 1fr) | 1977 |
| gap | `12px` | 12px | 1978 |
| margin-bottom | `20px` | 20px | 1979 |

### `.install-tasks.cols-2` — v15 1981

| property | literal | resolved | v15 line |
|---|---|---|---|
| grid-template-columns | `repeat(2, 1fr)` | repeat(2, 1fr) | 1981 |

> Default is 3 columns; `.cols-2` modifier switches to 2 columns (used by AWS
> manual-mode task pair, markup line 6528).

---

## 2. `.install-task` (base card) — v15 2037–2048

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `flex` | flex | 2038 |
| flex-direction | `column` | column | 2038 |
| align-items | `flex-start` | flex-start | 2038 |
| text-align | `left` | left | 2038 |
| gap | `12px` | 12px | 2039 |
| padding | `24px 22px` | 24px 22px | 2040 |
| border | `0` | none | 2041 |
| border-radius | `var(--toss-radius-inner)` | `12px` | 2042 |
| background | `var(--toss-inner-bg)` | `#F7F8FA` | 2043 |
| position | `relative` | relative | 2044 |
| transition | `background 0.15s, transform 0.08s, box-shadow 0.18s` | (literal) | 2045 |

`.install-task:first-child` / `:last-child` — both set `border-radius: var(--toss-radius-inner)` (`12px`), v15 2047 / 2048. (No-op vs base; same value.)

### Connector chevron `.install-task:not(:last-child)::after` — v15 2050–2065

| property | literal | resolved | v15 line |
|---|---|---|---|
| content | `'›'` | › (U+203A) | 2051 |
| position | `absolute` | absolute | 2052 |
| top | `50%` | 50% | 2053 |
| right | `-14px` | -14px | 2053 |
| width | `16px` | 16px | 2054 |
| height | `16px` | 16px | 2055 |
| background | `transparent` | transparent | 2056 |
| border | `0` | none | 2057 |
| transform | `translateY(-50%)` | translateY(-50%) | 2058 |
| color | `var(--toss-faint-text)` | `#B0B8C1` | 2059 |
| font-size | `22px` | 22px | 2060 |
| font-weight | `700` | 700 | 2061 |
| line-height | `1` | 1 | 2062 |
| z-index | `2` | 2 | 2063 |
| display | `flex` | flex | 2064 |
| align-items | `center` | center | 2064 |
| justify-content | `center` | center | 2064 |

---

## 3. `.install-task .num` (step number badge) — v15 2066–2074

| property | literal | resolved | v15 line |
|---|---|---|---|
| width | `32px` | 32px | 2067 |
| height | `32px` | 32px | 2067 |
| border-radius | `50%` | 50% | 2067 |
| display | `grid` | grid | 2068 |
| place-items | `center` | center | 2068 |
| font-size | `14px` | 14px | 2069 |
| font-weight | `800` | 800 | 2069 |
| background | `#fff` | #fff | 2070 |
| color | `var(--toss-weak-text)` | `#8B95A1` | 2071 |
| flex-shrink | `0` | 0 | 2072 |
| box-shadow | `0 1px 2px rgba(17,24,39,0.04)` | (literal) | 2073 |

State overrides:
- `.install-task.done .num` — `background: var(--color-success)` → `#45CB85`; `color: #fff` (v15 2076)
- `.install-task.running .num` — `background: var(--color-primary)` → `#0064FF`; `color: #fff`; `box-shadow: 0 0 0 4px rgba(0, 100, 255, 0.15)` (v15 2078)

---

## 4. `.install-task .body` / `.title` / `.sub` — v15 2079–2081

### `.body` (v15 2079)
| property | literal | resolved | v15 line |
|---|---|---|---|
| width | `100%` | 100% | 2079 |
| min-width | `0` | 0 | 2079 |
| display | `flex` | flex | 2079 |
| flex-direction | `column` | column | 2079 |
| align-items | `flex-start` | flex-start | 2079 |
| gap | `6px` | 6px | 2079 |

### `.title` (v15 2080)
| property | literal | resolved | v15 line |
|---|---|---|---|
| font-size | `16px` | 16px | 2080 |
| font-weight | `700` | 700 | 2080 |
| color | `var(--toss-strong-text)` | `#191F28` | 2080 |
| line-height | `1.35` | 1.35 | 2080 |
| letter-spacing | `-0.02em` | -0.02em | 2080 |

### `.sub` (v15 2081)
| property | literal | resolved | v15 line |
|---|---|---|---|
| font-size | `13px` | 13px | 2081 |
| color | `var(--toss-medium-text)` | `#4E5968` | 2081 |
| line-height | `1.55` | 1.55 | 2081 |
| font-weight | `500` | 500 | 2081 |

---

## 5. `.install-task .status-pill` (state pill) — v15 2082–2093

Base `.status-pill` (v15 2082–2090):

| property | literal | resolved | v15 line |
|---|---|---|---|
| font-size | `12px` | 12px | 2083 |
| font-weight | `700` | 700 | 2083 |
| padding | `5px 12px` | 5px 12px | 2084 |
| border-radius | `999px` | 999px | 2085 |
| background | `#fff` | #fff | 2086 |
| color | `var(--toss-weak-text)` | `#8B95A1` | 2087 |
| margin-top | `4px` | 4px | 2088 |
| letter-spacing | `-0.01em` | -0.01em | 2089 |

### State-pill colors (label → background / color)

| state | label (markup) | background | color (literal) | color (resolved) | v15 line |
|---|---|---|---|---|---|
| **대기 (base / pending)** | 대기 | `#fff` | `var(--toss-weak-text)` | `#8B95A1` | 2086–2087 |
| **완료 (done)** | 완료 | `#fff` | `var(--color-success-dark)` | `#2A7D52` | 2091 |
| **진행중 (running)** | 진행중 | `var(--color-primary)` | `#fff` | `#fff` (text on `#0064FF` bg) | 2092 |
| **실패 (failed)** | (실패) | `#fff` | `#991B1B` | `#991B1B` | 2093 |

> NOTE — "대기" pill: there is no dedicated `.install-task.pending .status-pill`
> rule. A task with no state class (or one whose pill text is "대기") falls through
> to the **base** `.status-pill` (white bg, `#8B95A1` text). Treat base = 대기.
> The "failed" pill color `#991B1B` is a literal hex (NOT `var(--color-error-dark)`,
> though that token also = `#991B1B`).

Card-level state backgrounds (the whole `.install-task`, not the pill):
- `.install-task.done` → `background: #ECFDF5` (v15 2075)
- `.install-task.running` → `background: #EFF6FF`; `box-shadow: inset 0 0 0 1.5px rgba(0,100,255,0.12)` (v15 2077, source unspaced)

### Clickable variant `.install-task[onclick]` — v15 2094–2096

| selector | property | literal | resolved | v15 line |
|---|---|---|---|---|
| `[onclick]` | cursor | `pointer` | pointer | 2094 |
| `[onclick]:hover` | background | `#fff` | #fff | 2095 |
| `[onclick]:hover` | box-shadow | `var(--toss-shadow-md)` | `0 2px 4px rgba(17, 24, 39, 0.04), 0 12px 32px -12px rgba(17, 24, 39, 0.10)` | 2095 |
| `[onclick]:hover` | transform | `translateY(-2px)` | translateY(-2px) | 2095 |
| `[onclick]:active` | transform | `translateY(0) scale(0.99)` | translateY(0) scale(0.99) | 2096 |

> Markup also sets inline `style="cursor:pointer;"` on clickable cards (e.g. line
> 6432), redundant with the `[onclick]` rule.

---

## 6. `.seg-toggle` + `.seg-toggle .seg-btn` (AWS auto/manual mode toggle) — v15 1925–1949

Used for both Provider toggle (markup 5586) and AWS install-mode toggle
(`#awsModeToggle`, markup 6466: `자동 설치` / `수동 설치`).

### `.seg-toggle` (track) — v15 1925–1932

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `inline-flex` | inline-flex | 1926 |
| background | `var(--toss-inner-bg)` | `#F7F8FA` | 1927 |
| border | `0` | none | 1928 |
| border-radius | `12px` | 12px | 1929 |
| padding | `4px` | 4px | 1930 |
| gap | `2px` | 2px | 1931 |

### `.seg-toggle .seg-btn` (inactive) — v15 1933–1941

| property | literal | resolved | v15 line |
|---|---|---|---|
| padding | `8px 16px` | 8px 16px | 1934 |
| border-radius | `8px` | 8px | 1935 |
| font-size | `14px` | 14px | 1936 |
| font-weight | `600` | 600 | 1937 |
| color | `var(--toss-weak-text)` | `#8B95A1` | 1938 |
| transition | `background 0.15s, color 0.15s, transform 0.08s` | (literal) | 1939 |
| letter-spacing | `-0.01em` | -0.01em | 1940 |

### `.seg-toggle .seg-btn` states

| selector | property | literal | resolved | v15 line |
|---|---|---|---|---|
| `:hover` | color | `var(--toss-strong-text)` | `#191F28` | 1942 |
| `:active` | transform | `scale(0.96)` | scale(0.96) | 1943 |

### `.seg-toggle .seg-btn.active` — v15 1944–1949

| property | literal | resolved | v15 line |
|---|---|---|---|
| background | `#fff` | #fff | 1945 |
| color | `var(--toss-strong-text)` | `#191F28` | 1946 |
| font-weight | `700` | 700 | 1947 |
| box-shadow | `0 1px 3px rgba(17,24,39,0.08), 0 1px 2px rgba(17,24,39,0.04)` | (literal) | 1948 |

### `.aws-mode-bar` (row wrapping the toggle) — v15 1984–1998

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `flex` | flex | 1985 |
| align-items | `center` | center | 1985 |
| justify-content | `space-between` | space-between | 1985 |
| gap | `16px` | 16px | 1986 |
| margin-bottom | `16px` | 16px | 1987 |
| `.ambar-label` font-size | `13px` | 13px | 1990 |
| `.ambar-label` font-weight | `600` | 600 | 1990 |
| `.ambar-label` color | `var(--toss-medium-text)` | `#4E5968` | 1991 |
| `.ambar-label` letter-spacing | `-0.01em` | -0.01em | 1992 |
| `.ambar-label strong` color | `var(--toss-strong-text)` | `#191F28` | 1995 |
| `.ambar-label strong` font-weight | `700` | 700 | 1996 |
| `.ambar-label strong` margin-left | `4px` | 4px | 1997 |

---

## 7. Terraform script download card `.tf-download-card` — v15 2000–2036

### Container `.tf-download-card` — v15 2001–2008

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `flex` | flex | 2002 |
| align-items | `center` | center | 2002 |
| gap | `16px` | 16px | 2002 |
| padding | `18px 22px` | 18px 22px | 2003 |
| border-radius | `var(--toss-radius-inner)` | `12px` | 2004 |
| background | `linear-gradient(135deg, #F0F6FF 0%, #F7FAFF 100%)` | (literal gradient) | 2005 |
| box-shadow | `inset 0 0 0 1.5px rgba(0, 100, 255, 0.12)` | (literal) | 2006 |
| margin-bottom | `16px` | 16px | 2007 |

### Icon `.tf-icon` — v15 2009–2016

| property | literal | resolved | v15 line |
|---|---|---|---|
| width | `48px` | 48px | 2010 |
| height | `48px` | 48px | 2010 |
| flex-shrink | `0` | 0 | 2010 |
| border-radius | `12px` | 12px | 2011 |
| background | `#fff` | #fff | 2012 |
| display | `grid` | grid | 2013 |
| place-items | `center` | center | 2013 |
| color | `var(--color-primary)` | `#0064FF` | 2014 |
| box-shadow | `0 1px 2px rgba(17,24,39,0.05)` | (literal) | 2015 |

> SVG inside is `22×22` (file-download icon, markup line 6507).

### Body `.tf-body` — v15 2017

| property | literal | resolved | v15 line |
|---|---|---|---|
| flex | `1` | 1 | 2017 |
| min-width | `0` | 0 | 2017 |
| display | `flex` | flex | 2017 |
| flex-direction | `column` | column | 2017 |
| gap | `4px` | 4px | 2017 |

### Title `.tf-title` — v15 2018–2023

| property | literal | resolved | v15 line |
|---|---|---|---|
| font-size | `15px` | 15px | 2019 |
| font-weight | `700` | 700 | 2019 |
| color | `var(--toss-strong-text)` | `#191F28` | 2020 |
| letter-spacing | `-0.02em` | -0.02em | 2021 |
| display | `flex` | flex | 2022 |
| align-items | `center` | center | 2022 |
| gap | `8px` | 8px | 2022 |

### `.tf` size pill `.tf-meta-pill` — v15 2024–2031

| property | literal | resolved | v15 line |
|---|---|---|---|
| font-size | `10.5px` | 10.5px | 2025 |
| font-weight | `700` | 700 | 2025 |
| padding | `3px 8px` | 3px 8px | 2026 |
| border-radius | `999px` | 999px | 2026 |
| background | `rgba(0,100,255,0.10)` | (literal) | 2027 |
| color | `var(--color-primary)` | `#0064FF` | 2028 |
| letter-spacing | `0.02em` | 0.02em | 2029 |
| font-family | `'Geist Mono', ui-monospace, monospace` | (literal) | 2030 |

> Pill text (markup 6512): `.tf · 12.4 KB`.

### Sub text `.tf-sub` — v15 2032–2034

| property | literal | resolved | v15 line |
|---|---|---|---|
| font-size | `12.5px` | 12.5px | 2033 |
| color | `var(--toss-medium-text)` | `#4E5968` | 2033 |
| line-height | `1.5` | 1.5 | 2033 |

### Actions `.tf-actions` — v15 2035–2036

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `flex` | flex | 2035 |
| gap | `8px` | 8px | 2035 |
| flex-shrink | `0` | 0 | 2035 |
| `.btn` height (override) | `40px` | 40px | 2036 |

### Buttons inside the card (markup 6517 / 6521)

Card uses two `.btn` instances — `.btn.outline` ("가이드 보기") and `.btn.primary`
("Script 다운로드"). Base `.btn` (v15 932–940) + variants:

| selector | property | literal | resolved | v15 line |
|---|---|---|---|---|
| `.btn` | display | `inline-flex` | inline-flex | 933 |
| `.btn` | align-items | `center` | center | 933 |
| `.btn` | gap | `6px` | 6px | 933 |
| `.btn` | height | `40px` | 40px | 934 |
| `.btn` | padding | `0 18px` | 0 18px | 934 |
| `.btn` | border-radius | `12px` | 12px | 935 |
| `.btn` | font-size | `14px` | 14px | 936 |
| `.btn` | font-weight | `700` | 700 | 936 |
| `.btn` | letter-spacing | `-0.01em` | -0.01em | 937 |
| `.btn` | transition | `background 0.15s, border-color 0.15s, transform 0.08s, box-shadow 0.15s` | (literal) | 938 |
| `.btn` | white-space | `nowrap` | nowrap | 939 |
| `.btn:active` | transform | `scale(0.97)` | scale(0.97) | 941 |
| `.btn.primary` | background | `var(--color-primary)` | `#0064FF` | 942 |
| `.btn.primary` | color | `#fff` | #fff | 942 |
| `.btn.primary:hover` | background | `var(--color-primary-hover)` | `#0050D6` | 943 |
| `.btn.outline` | border | `0` | none | 946 |
| `.btn.outline` | color | `var(--toss-strong-text)` | `#191F28` | 946 |
| `.btn.outline` | background | `var(--toss-inner-bg)` | `#F7F8FA` | 946 |
| `.btn.outline:hover` | background | `#ECEEF1` | #ECEEF1 | 947 |

> `.btn.secondary` (`background: var(--toss-strong-text)` = `#191F28`, color `#fff`,
> hover `#0F1419`; v15 948–949) is NOT used by this card but documented since the
> prompt asked for "buttons". Action SVGs are `13×13` (markup 6518 / 6522).

---

## Ambiguities / inheritance notes

1. **`.install-task` font-family / base text color** — not declared on the card;
   inherited: `font-family: Geist` (the inline `<body style="font-family: Geist">`
   at line 5168 wins the cascade; the 572 stack is only the fallback); `color: #191F28`;
   `font-size: 15px`; `letter-spacing: -0.018em` (v15 570–577 + inline 5168). Child `.title` /
   `.sub` / `.num` / `.status-pill` each redeclare their own font-size & color,
   so the inherited body values only affect any unstyled text (none here).

2. **"대기" pill has no explicit class.** There is NO `.install-task.pending` or
   `.status-pill` "대기" rule. The 대기 appearance = the **base** `.status-pill`
   (white bg `#fff`, text `var(--toss-weak-text)` = `#8B95A1`). Stated explicitly,
   not guessed: confirmed by absence of any pending pill selector in 2082–2093.

3. **`.install-task.failed` background** — only the *pill* has a `.failed` rule
   (`#991B1B` text, v15 2093). There is NO card-level `.install-task.failed`
   background rule (unlike `.done`=#ECFDF5 / `.running`=#EFF6FF). A failed card
   therefore keeps the base `#F7F8FA` background — flagged as an asymmetry, not
   inferred.

4. **`status-pill` on a `.running` card** — `.install-task.running .status-pill`
   (line 2092) overrides bg→`#0064FF`, color→`#fff`. This BEATS the base white-bg
   pill for running tasks. (Specificity: both 2 classes + element; later rule wins.)

5. **`.tf-meta-pill` border-radius `999px`** and **`.status-pill` `999px`** are
   literal pixel pills, NOT the `--radius-pill: 9999px` token. Transcribed as-is.

6. **No `:focus` / `:focus-visible` states** declared for `.install-task`,
   `.seg-btn`, or the card buttons in this block. Stated, not invented.
