# v15 Screen Content Blocks — LITERAL extract from `SIT Prototype Athena v15.html`

> Completeness-audit fill-in. These classes are USED by the target-source screens
> but were undocumented in 01–07. Transcribed **byte-exact** from the 2nd `<style>`
> block — every declared property, exact value, `var(--x)` resolved per
> `00-tokens.md`, with the v15 source line cited. LITERAL ONLY: no rounding, no
> inference. Inherited / ambiguous values are flagged inline.
>
> **Resolver:** `design/v15-extract/00-tokens.md`. Effective inherited defaults
> (per 00-tokens §"Body base"): font-family `Geist` (inline body 5168; the 572
> stack is fallback), color `#191F28` (`--toss-strong-text`), letter-spacing
> `-0.018em` (global, 576), font-size `15px`.

---

## 1. SCAN STATE block — Step 1 (lines 1700–1734)

The scan empty / running / error UI plus the progress bar. Comment at 1700:
`/* ---------- scan states ---------- */`.

### `.scan-state` (1701–1703)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `padding` | `60px 20px` | `60px 20px` | 1702 |
| `text-align` | `center` | `center` | 1702 |

### `.scan-state h3` (1704)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `font-size` | `16px` | `16px` | 1704 |
| `font-weight` | `600` | `600` | 1704 |
| `margin` | `0 0 6px` | `0 0 6px` | 1704 |
| `color` | `var(--fg-1)` | `#111827` | 1704 |

### `.scan-state p` (1705)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `font-size` | `13px` | `13px` | 1705 |
| `color` | `var(--fg-3)` | `#6B7280` | 1705 |
| `margin` | `0` | `0` | 1705 |

### `.scan-state .illus` (1706–1713)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `width` | `64px` | `64px` | 1707 |
| `height` | `64px` | `64px` | 1707 |
| `margin` | `0 auto 20px` | `0 auto 20px` | 1708 |
| `border-radius` | `16px` | `16px` | 1709 |
| `background` | `var(--bg-muted)` | `#F9FAFB` (`--gray-50`) | 1710 |
| `display` | `grid` | `grid` | 1711 |
| `place-items` | `center` | `center` | 1711 |
| `color` | `var(--fg-4)` | `#9CA3AF` | 1712 |

### `.scan-progress` (1714–1721)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `max-width` | `520px` | `520px` | 1715 |
| `margin` | `24px auto 0` | `24px auto 0` | 1715 |
| `background` | `#F1F5F9` | `#F1F5F9` | 1716 |
| `border-radius` | `999px` | `999px` | 1717 |
| `height` | `10px` | `10px` | 1718 |
| `overflow` | `hidden` | `hidden` | 1719 |
| `position` | `relative` | `relative` | 1720 |

### `.scan-progress .bar` (1722–1727)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `height` | `100%` | `100%` | 1723 |
| `background` | `linear-gradient(90deg, var(--color-primary) 0%, #4F46E5 100%)` | `linear-gradient(90deg, #0064FF 0%, #4F46E5 100%)` | 1724 |
| `border-radius` | `999px` | `999px` | 1725 |
| `transition` | `width 0.4s` | `width 0.4s` | 1726 |

### `.scan-progress-label` (1728–1734)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `margin-top` | `8px` | `8px` | 1729 |
| `font-size` | `12px` | `12px` | 1730 |
| `color` | `var(--fg-2)` | `#374151` | 1731 |
| `font-variant-numeric` | `tabular-nums` | `tabular-nums` | 1732 |
| `font-family` | `'Geist Mono', monospace` | `'Geist Mono', monospace` | 1733 |

> **Note** — `.scan-progress-label` declares its own short mono stack
> `'Geist Mono', monospace` (1733), NOT the full `--font-mono` token
> (`'Geist Mono', ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace`).
> Literal transcription keeps the short form.

---

## 2. APPROVAL STATS grid — Step 2 (lines 2542–2580)

The "전체 요청 47 / 연동 대상 38 / 비대상 9" tinted-pill stat cards. Comment at
2542: `/* Approval mini stat — Toss style: tinted pill cards */`.

### `.approval-stats` (2543–2548)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `grid` | `grid` | 2544 |
| `grid-template-columns` | `repeat(4, minmax(0, 1fr))` | `repeat(4, minmax(0, 1fr))` | 2545 |
| `gap` | `12px` | `12px` | 2546 |
| `margin-bottom` | `18px` | `18px` | 2547 |

### `.approval-stat` (2549–2556)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `border` | `0` | `0` | 2550 |
| `border-radius` | `var(--toss-radius-inner)` | `12px` | 2551 |
| `padding` | `18px 20px` | `18px 20px` | 2552 |
| `background` | `var(--toss-inner-bg)` | `#F7F8FA` | 2553 |
| `display` | `flex` | `flex` | 2554 |
| `flex-direction` | `column` | `column` | 2554 |
| `gap` | `6px` | `6px` | 2554 |
| `transition` | `background 0.15s` | `background 0.15s` | 2555 |

### `.approval-stat:hover` (2557)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `background` | `#ECEEF1` | `#ECEEF1` | 2557 |

### `.approval-stat .lbl` (2558–2562)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `font-size` | `13px` | `13px` | 2559 |
| `color` | `var(--toss-weak-text)` | `#8B95A1` | 2559 |
| `font-weight` | `600` | `600` | 2560 |
| `display` | `flex` | `flex` | 2561 |
| `align-items` | `center` | `center` | 2561 |
| `gap` | `6px` | `6px` | 2561 |

### `.approval-stat .lbl .swatch` (2563–2566) — base

| property | literal | resolved | v15 line |
|---|---|---|---|
| `width` | `8px` | `8px` | 2564 |
| `height` | `8px` | `8px` | 2564 |
| `border-radius` | `2px` | `2px` | 2564 |
| `background` | `var(--fg-3)` | `#6B7280` | 2565 |

### Swatch color variants (2567–2569) — `background` override only

| selector | literal | resolved | v15 line |
|---|---|---|---|
| `.approval-stat .lbl .swatch.target` | `background: #10B981` | `#10B981` | 2567 |
| `.approval-stat .lbl .swatch.exclude` | `background: var(--gray-300)` | `#D1D5DB` | 2568 |
| `.approval-stat .lbl .swatch.scan-new` | `background: #3B82F6` | `#3B82F6` | 2569 |

> **⚠️ Scope addition** — the audit named only `.swatch.target` and
> `.swatch.exclude`. The source defines a THIRD variant `.swatch.scan-new`
> (`#3B82F6`, 2569) directly between them. Included for completeness; flag if not
> part of the intended target-source scope.

### `.approval-stat .num` (2570–2576)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `font-size` | `26px` | `26px` | 2571 |
| `font-weight` | `800` | `800` | 2571 |
| `letter-spacing` | `-0.03em` | `-0.03em` | 2572 |
| `font-variant-numeric` | `tabular-nums` | `tabular-nums` | 2573 |
| `color` | `var(--toss-strong-text)` | `#191F28` | 2574 |
| `line-height` | `1.1` | `1.1` | 2575 |

### `.approval-stat .num .pct` (2577–2580)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `font-size` | `13px` | `13px` | 2578 |
| `color` | `var(--toss-weak-text)` | `#8B95A1` | 2578 |
| `font-weight` | `600` | `600` | 2579 |
| `margin-left` | `8px` | `8px` | 2579 |

---

## 3. `.target-cell` (lines 2774–2777)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `inline-flex` | `inline-flex` | 2775 |
| `align-items` | `center` | `center` | 2775 |
| `gap` | `6px` | `6px` | 2775 |
| `flex-wrap` | `nowrap` | `nowrap` | 2776 |

---

## 4. Utilities

### `.hidden` (line 1778) — comment `/* hidden helpers */` (1777)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `none !important` | `none !important` | 1778 |

### `.step-content` / `.step-content.active` (1952–1953) — comment `/* ---------- Step-content sections ---------- */` (1951)

| selector | property | literal | resolved | v15 line |
|---|---|---|---|---|
| `.step-content` | `display` | `none` | `none` | 1952 |
| `.step-content.active` | `display` | `block` | `block` | 1953 |

### `.body` (global layout helper, line 644) — comment `/* ---------- BODY ---------- */` (643)

The global `.body` class (a flex content column), distinct from the scoped
`.install-task .body` documented in 06. Applies wherever `class="body"` appears.

| selector | property | literal | resolved | v15 line |
|---|---|---|---|---|
| `.body` | `flex` | `1` | `1` | 644 |
| `.body` | `display` | `flex` | `flex` | 644 |

---

## Ambiguities / inherited notes

- **No element here re-declares `font-family` except `.scan-progress-label`**
  (1733, short `'Geist Mono', monospace`). Every other text node in these blocks
  inherits the effective default **`Geist`** (inline body 5168 per 00-tokens).
- **`letter-spacing`** — only `.approval-stat .num` declares its own
  (`-0.03em`, 2572). All other nodes inherit the GLOBAL `-0.018em` (576), NOT
  `normal`. This is a documented divergence from the repo `DESIGN.md`.
- **`color` inheritance** — nodes without an explicit `color` inherit
  `#191F28` (`--toss-strong-text`), not `--fg-1` `#111827`. Note the mix in this
  block: `.scan-state` family uses the FIRST-`:root` `--fg-*` greys
  (`#111827` / `#6B7280` / `#9CA3AF`), while `.approval-stat` family uses the
  Toss `--toss-*-text` tokens (`#191F28` / `#8B95A1`). Both are explicit; no
  inference applied — values transcribed as declared.
- **`--bg-muted`** (`.scan-state .illus`, 1710) resolves to `var(--gray-50)` =
  `#F9FAFB` per 00-tokens §Colors (`--bg-page/muted/surface/tinted`).
- **`999px` vs `9999px`** — `.scan-progress` / `.bar` use the literal `999px`
  (1717, 1725), NOT the `--radius-pill` `9999px` token. Kept literal.
- **Gradient stop `#4F46E5`** (`.scan-progress .bar`, 1724) is a raw hex, not a
  token; transcribed as-is.
- **`.approval-stat:hover` `#ECEEF1`** (2557) and **`.swatch.target` `#10B981`**
  (2567), **`.swatch.scan-new` `#3B82F6`** (2569) are raw hex literals with no
  token equivalent in 00-tokens; transcribed as-is.
- **Scope flag** — `.swatch.scan-new` (2569) was NOT in the audit list but is
  source-present between the two named variants; documented above and here.
