# v15 Tooltips — literal extraction from `SIT Prototype Athena v15.html`

> Two tooltip systems used by the target-source screens but previously
> undocumented (flagged by a completeness audit). Transcribed VERBATIM from the
> 2nd `<style>` block. Every declared property, its exact literal value, and its
> resolved value (`var(--x)` → token from `00-tokens.md`). No rounding, no
> inference. Cite v15 line numbers.
>
> Resolver = `design/v15-extract/00-tokens.md`. Inherited defaults used below
> (per `00-tokens.md`): font-family `Geist` (inline body 5168; the 572 stack is
> fallback), color `#191F28`, letter-spacing `-0.018em`. Tokens referenced:
> `--fg-4` = `#9CA3AF` (gray-400), `--fg-2` = `#374151` (gray-700),
> `--color-primary` = `#0064FF`.

---

## 1. STATUS header tooltip — `.tooltip-trigger` / `.tooltip-content` / `.tt-row` / `.tt-desc`

CSS: lines 953–1008 (comment `/* Tooltip (header column hint) */` at 953).
Rendered: Step 7 health-status table header `<th>Status</th>`, markup at lines
7089–7101 (`.tooltip-trigger` at 7092, `.tooltip-content` at 7094).

### `.tooltip-trigger` (954–960)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `position` | `relative` | `relative` | 955 |
| `display` | `inline-flex` | `inline-flex` | 956 |
| `align-items` | `center` | `center` | 956 |
| `color` | `var(--fg-4)` | `#9CA3AF` | 957 |
| `cursor` | `help` | `help` | 958 |
| `line-height` | `0` | `0` | 959 |

### `.tooltip-trigger:hover, .tooltip-trigger:focus` (961)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `color` | `var(--color-primary)` | `#0064FF` | 961 |
| `outline` | `none` | `none` | 961 |

### `.tooltip-content` (962–980) — the popover box

| property | literal | resolved | v15 line |
|---|---|---|---|
| `position` | `absolute` | `absolute` | 963 |
| `top` | `calc(100% + 8px)` | `calc(100% + 8px)` | 964 |
| `right` | `0` | `0` | 965 |
| `z-index` | `50` | `50` | 966 |
| `width` | `280px` | `280px` | 967 |
| `background` | `#111827` | `#111827` | 968 |
| `color` | `#fff` | `#FFFFFF` | 969 |
| `border-radius` | `8px` | `8px` | 970 |
| `padding` | `12px 14px` | `12px 14px` | 971 |
| `box-shadow` | `0 8px 24px rgba(0,0,0,0.18)` | `0 8px 24px rgba(0,0,0,0.18)` | 972 |
| `font-size` | `11.5px` | `11.5px` | 973 |
| `font-weight` | `400` | `400` | 974 |
| `text-transform` | `none` | `none` | 975 |
| `letter-spacing` | `0` | `0` (overrides inherited `-0.018em`) | 976 |
| `line-height` | `1.5` | `1.5` | 977 |
| `display` | `none` | `none` (hidden until hover/focus) | 978 |
| `white-space` | `normal` | `normal` | 979 |

### `.tooltip-content::before` (981–988) — arrow (rotated square)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `content` | `''` | `''` | 982 |
| `position` | `absolute` | `absolute` | 983 |
| `top` | `-6px` | `-6px` | 984 |
| `right` | `14px` | `14px` | 984 |
| `width` | `10px` | `10px` | 985 |
| `height` | `10px` | `10px` | 985 |
| `background` | `#111827` | `#111827` (matches box bg) | 986 |
| `transform` | `rotate(45deg)` | `rotate(45deg)` | 987 |

### Visible state (989–990)

`.tooltip-trigger:hover .tooltip-content, .tooltip-trigger:focus .tooltip-content`

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `block` | `block` | 990 |

### `.tooltip-content strong` (991–997) — the title row

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `block` | `block` | 992 |
| `color` | `#fff` | `#FFFFFF` | 993 |
| `font-size` | `12px` | `12px` | 994 |
| `margin-bottom` | `8px` | `8px` | 995 |
| `font-weight` | `700` | `700` | 996 |

### `.tooltip-content .tt-row` (998–1001)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `block` | `block` | 999 |
| `margin-bottom` | `8px` | `8px` | 1000 |

### `.tooltip-content .tt-row:last-child` (1002)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `margin-bottom` | `0` | `0` | 1002 |

### `.tooltip-content .tt-desc` (1003–1008)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `block` | `block` | 1004 |
| `margin-top` | `4px` | `4px` | 1005 |
| `color` | `#D1D5DB` | `#D1D5DB` (= `--gray-300`, but declared as literal hex) | 1006 |
| `font-size` | `11px` | `11px` | 1007 |

### Rendered markup (7092–7099) — structure & inline content

- `<span class="tooltip-trigger" tabindex="0">` (7092) — `tabindex="0"` makes the
  trigger keyboard-focusable, activating the `:focus` show path (990).
- Icon: inline SVG (7093) info-circle, `width="13" height="13"`,
  `stroke="currentColor"` (inherits the trigger `color`: `#9CA3AF` rest →
  `#0064FF` hover/focus), `stroke-width="2"`.
- `<span class="tooltip-content">` (7094) containing:
  - `<strong>Status 안내</strong>` (7095).
  - `.tt-row` (7096): a `.status healthy` chip (inline `font-size: 10.5px`) +
    `.tt-desc` `모든 DB가 정상이에요.`
  - `.tt-row` (7097): a `.status` chip (inline `font-size: 10.5px;
    background: #FEE2E2; color: #991B1B;`, dot `background:#991B1B`) Unhealthy +
    `.tt-desc` `DB가 비정상이에요. Agent 또는 Credential 상태를 확인해주세요.`

> Inline overrides on the rendered chips (`font-size: 10.5px`, the Unhealthy
> `background`/`color`) are NOT part of the tooltip CSS (953–1008); they live on
> the `.status` instances in markup. `.status` chip styling is owned by
> `03-status-tag-pill.md`.

---

## 2. SOURCE-IP table-header tooltip — `.th-tip` / `.tip-i` / `.tip-pop`

CSS: lines 4775–4792 (comment `/* th tooltip (Source IP ⓘ) */` at 4775).
Rendered: IDC connection tables, `<th>` "Source IP" — markup repeated at lines
6145–6146, 6379–6380, 6610–6611, 6845–6846, 7015–7016, 7228–7229 (all identical).

### `.th-tip` (4776) — the trigger wrapper

| property | literal | resolved | v15 line |
|---|---|---|---|
| `position` | `relative` | `relative` | 4776 |
| `display` | `inline-flex` | `inline-flex` | 4776 |
| `align-items` | `center` | `center` | 4776 |
| `gap` | `4px` | `4px` | 4776 |
| `cursor` | `help` | `help` | 4776 |

### `.th-tip .tip-i` (4777) — the info-icon (rest state)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `color` | `var(--fg-4)` | `#9CA3AF` | 4777 |
| `flex-shrink` | `0` | `0` | 4777 |

### `.th-tip:hover .tip-i` (4778) — info-icon hover

| property | literal | resolved | v15 line |
|---|---|---|---|
| `color` | `var(--fg-2)` | `#374151` | 4778 |

### `.th-tip .tip-pop` (4779–4786) — the popover box

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `none` | `none` (hidden until hover/focus-within) | 4780 |
| `position` | `absolute` | `absolute` | 4780 |
| `top` | `calc(100% + 8px)` | `calc(100% + 8px)` | 4780 |
| `right` | `-8px` | `-8px` | 4780 |
| `left` | `auto` | `auto` | 4780 |
| `width` | `280px` | `280px` | 4781 |
| `background` | `#1F2937` | `#1F2937` (= `--gray-800`, declared as literal hex) | 4781 |
| `color` | `#F9FAFB` | `#F9FAFB` (= `--gray-50`, declared as literal hex) | 4781 |
| `border-radius` | `10px` | `10px` | 4782 |
| `padding` | `12px 14px` | `12px 14px` | 4782 |
| `z-index` | `80` | `80` | 4782 |
| `font-size` | `12px` | `12px` | 4783 |
| `font-weight` | `400` | `400` | 4783 |
| `line-height` | `1.6` | `1.6` | 4783 |
| `text-transform` | `none` | `none` | 4783 |
| `letter-spacing` | `0` | `0` (overrides inherited `-0.018em`) | 4784 |
| `white-space` | `normal` | `normal` | 4784 |
| `box-shadow` | `0 8px 24px rgba(0,0,0,0.22)` | `0 8px 24px rgba(0,0,0,0.22)` | 4785 |

### `.th-tip .tip-pop strong` (4787) — the title row

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `block` | `block` | 4787 |
| `font-size` | `12px` | `12px` | 4787 |
| `font-weight` | `700` | `700` | 4787 |
| `margin-bottom` | `4px` | `4px` | 4787 |
| `color` | `#fff` | `#FFFFFF` | 4787 |

### `.th-tip .tip-pop::before` (4788–4791) — arrow (rotated square)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `content` | `''` | `''` | 4789 |
| `position` | `absolute` | `absolute` | 4789 |
| `top` | `-5px` | `-5px` | 4789 |
| `right` | `14px` | `14px` | 4789 |
| `width` | `10px` | `10px` | 4790 |
| `height` | `10px` | `10px` | 4790 |
| `background` | `#1F2937` | `#1F2937` (matches box bg) | 4790 |
| `transform` | `rotate(45deg)` | `rotate(45deg)` | 4790 |

### Visible state (4792)

`.th-tip:hover .tip-pop, .th-tip:focus-within .tip-pop`

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `block` | `block` | 4792 |

### Rendered markup (6145–6146, and 5 identical repeats) — structure & inline content

- `<span class="th-tip" tabindex="0">Source IP` (6145) — `tabindex="0"` makes the
  wrapper focusable, activating the `:focus-within` show path (4792).
- Icon: inline `<svg class="tip-i" width="13" height="13" ...
  stroke="currentColor" stroke-width="2" aria-label="안내">` info-circle (6145).
  `stroke="currentColor"` → inherits `.tip-i` `color`: `#9CA3AF` rest (4777) →
  `#374151` on `.th-tip:hover` (4778).
- `<span class="tip-pop">` (6146) containing:
  - `<strong>방화벽 등록 필요</strong>`
  - body text: `BDC Agent가 DB에 접근할 때 사용하는 출발지 IP예요. 서비스 측
    방화벽에서 Source IP → 연동 대상(IP:Port) 허용 규칙을 등록해야 연결 테스트를
    통과할 수 있어요.`

---

## Ambiguities / inherited / divergence notes

1. **Inherited font-family / letter-spacing.** Neither tooltip rule declares
   `font-family`, so both inherit `Geist` (inline body 5168). Both popovers
   DECLARE `letter-spacing: 0` (976 / 4784), overriding the global inherited
   `-0.018em` — so popover text is NOT spaced like the rest of the app. The
   trigger wrappers (`.tooltip-trigger` 954, `.th-tip` 4776) declare no
   `letter-spacing`, so they inherit `-0.018em`.

2. **Literal hexes vs. tokens.** Several colors are written as raw hex even
   though a matching token exists: `.tt-desc` `#D1D5DB` = `--gray-300`;
   `.tip-pop` `#1F2937` = `--gray-800` and `#F9FAFB` = `--gray-50`. Transcribed
   as the literal hex (the source does not use `var()` here). `.tooltip-content`
   box `#111827` equals `--gray-900` / `--fg-1` but is, again, a raw hex literal.

3. **Two different box backgrounds.** STATUS tooltip box = `#111827` (968);
   SOURCE-IP tooltip box = `#1F2937` (4781). Arrows match their own box
   (`#111827` at 986; `#1F2937` at 4790). Not a typo — they are deliberately
   different dark greys.

4. **`color: #fff` resolution.** Written `#fff` (shorthand) at 969, 993, 4787;
   resolved to full `#FFFFFF`. Same color, just notation.

5. **Show trigger differs.** STATUS uses `:hover`/`:focus` on the trigger itself
   (989–990). SOURCE-IP uses `:hover`/`:focus-within` on the wrapper (4792) —
   `:focus-within` because the focusable `tabindex` span wraps both icon and
   popover.

6. **Positioning anchor.** Both popovers are right-anchored: STATUS `right: 0`
   (965); SOURCE-IP `right: -8px; left: auto` (4780). Both arrows sit at
   `right: 14px` (984 / 4789). STATUS arrow `top: -6px` (984) vs SOURCE-IP arrow
   `top: -5px` (4789) — a 1px difference, transcribed literally.

7. **Icon size from markup, not CSS.** The `13×13` SVG size and `stroke-width=2`
   are inline HTML attributes (7093 / 6145), NOT in the tooltip CSS. The CSS only
   sets icon `color` (via `currentColor` inheritance). `.tooltip-trigger` sets
   `line-height: 0` (959) to prevent the inline SVG from adding line-box height;
   `.th-tip .tip-i` instead uses `flex-shrink: 0` (4777) within the flex wrapper.
