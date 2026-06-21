# v15 Tables — literal CSS extract

> Transcribed verbatim from `design/SIT Prototype Athena v15.html` (2nd `<style>`
> block). Every `var(--x)` resolved against `00-tokens.md` + the Toss overrides
> at lines 545–565 and the Athena spine vars at lines 3613–3619. LITERAL only —
> no rounding/inference. Cite v15 line per rule. Ambiguities flagged explicitly.

## Resolver appendix (vars used below)

| var | literal | v15 line |
|---|---|---|
| `--toss-card-bg` | `#FFFFFF` | 549 |
| `--toss-inner-bg` | `#F7F8FA` | 550 |
| `--toss-divider` | `#EBEEF2` | 551 |
| `--toss-strong-text` | `#191F28` | 552 |
| `--toss-medium-text` | `#4E5968` | 553 |
| `--toss-weak-text` | `#8B95A1` | 554 |
| `--toss-radius-inner` | `12px` | 565 |
| `--color-primary` | `#0064FF` | 264 |
| `--color-success` | `#45CB85` | 273 |
| `--bg-muted` | `var(--gray-50)` → `#F9FAFB` | 322 |
| `--border-default` | `var(--gray-200)` → `#E5E7EB` | 328 |
| `--fg-1` | `var(--gray-900)` → `#111827` | 312 |
| `--fg-2` | `var(--gray-700)` → `#374151` | 313 |
| `--fg-3` | `var(--gray-500)` → `#6B7280` | 314 |
| `--fg-4` | `var(--gray-400)` → `#9CA3AF` | 315 |
| `--athena-spine` | `#C2410C` | 3613 |
| `--athena-sub-bg` | `#FFFAF3` | 3618 |
| `--athena-sub-edge` | `#F0E1CB` | 3619 |

---

## 1. `.db-list-table` (Step 1 / Step 4+ scan-status sub-table)

### 1a. Container `.db-list-table` (line 1850)

| property | literal | resolved | v15 line |
|---|---|---|---|
| margin-top | `12px` | `12px` | 1851 |
| border | `1px solid var(--toss-divider)` | `1px solid #EBEEF2` | 1852 |
| border-radius | `12px` | `12px` | 1853 |
| overflow | `hidden` | `hidden` | 1854 |
| background | `var(--toss-card-bg)` | `#FFFFFF` | 1855 |
| box-shadow | `0 1px 2px rgba(17, 24, 39, 0.04), 0 6px 16px -8px rgba(17, 24, 39, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)` | (same, no vars) | 1856–1859 |

### 1b. `.db-list-table table` (line 1861)

| property | literal | resolved | v15 line |
|---|---|---|---|
| width | `100%` | `100%` | 1861 |
| border-collapse | `collapse` | `collapse` | 1861 |
| font-size | `13px` | `13px` | 1861 |

### 1c. `.db-list-table thead` (line 1862)

| property | literal | resolved | v15 line |
|---|---|---|---|
| background | `#FAFBFC` | `#FAFBFC` (literal hex, NOT a var) | 1862 |

### 1d. `.db-list-table th` — header cell (line 1863)

| property | literal | resolved | v15 line |
|---|---|---|---|
| text-align | `left` | `left` | 1863 |
| padding | `14px 16px` | `14px 16px` | 1863 |
| background | `transparent` | `transparent` | 1863 |
| font-size | `13px` | `13px` | 1863 |
| font-weight | `700` | `700` | 1863 |
| color | `var(--toss-medium-text)` | `#4E5968` | 1863 |
| text-transform | `none` | `none` | 1863 |
| letter-spacing | `-0.01em` | `-0.01em` | 1863 |
| border-bottom | `1px solid var(--toss-divider)` | `1px solid #EBEEF2` | 1863 |

### 1e. `.db-list-table td` — body cell (line 1864)

| property | literal | resolved | v15 line |
|---|---|---|---|
| padding | `14px 16px` | `14px 16px` | 1864 |
| border-top | `1px solid var(--toss-divider)` | `1px solid #EBEEF2` | 1864 |
| (first row) border-top | `0` — `tbody tr:first-child td` | `0` | 1865 |
| color | not declared → inherited | inherits body `color: var(--toss-strong-text)` = `#191F28` (line 574), NOT `--fg-1`/`#111827` | 574 |
| height | not declared → computed from padding + content | (AMBIGUOUS) | — |
| text-align | not declared → default `left` (inherits th? No) | default `start`/`left` | — |

### 1f. `.db-list-table` body rows — states

| selector | property | literal | resolved | v15 line |
|---|---|---|---|---|
| `tbody tr` | transition | `background 0.12s` | `background 0.12s` | 1866 |
| `tbody tr:hover td` | background | `var(--toss-inner-bg)` | `#F7F8FA` | 1867 |
| `tbody tr.non-target td` | background | `#F2F4F6` | `#F2F4F6` (literal) | 1868 |
| `tbody tr.non-target td` | color | `var(--toss-weak-text)` | `#8B95A1` | 1868 |
| `tbody tr.non-target:hover td` | background | `#E5E8EB` | `#E5E8EB` (literal) | 1869 |
| `tbody tr.non-target input[type="checkbox"]` | cursor | `not-allowed` | `not-allowed` | 1870 |
| `tbody tr.non-target input[type="checkbox"]` | opacity | `0.5` | `0.5` | 1870 |

### 1g. Monospace cells inside `.db-list-table` — ⚠ AMBIGUITY

Markup uses `<td class="mono" style="font-size:12px;">` (e.g. lines 5750–5751).
The only `.mono` typography rule is **`.db-table .mono`** (line 1106):
`font-family: 'Geist Mono', monospace; font-size: 13px; color: var(--toss-medium-text); font-weight: 500;`
— scoped to ancestor **`.db-table`**, a DIFFERENT class (used at line 5516).
The `.db-list-table` wrapper is NOT `.db-table`, so this rule **does NOT match**
these cells. Therefore inside `.db-list-table`, a `.mono` cell resolves to:

| property | literal | resolved | source |
|---|---|---|---|
| font-size | `12px` | `12px` | inline `style` (lines 5750–5751) |
| font-family | not matched by any rule → **inherited** | `Geist` (inline body 5168; the line-572 stack `'Geist', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', sans-serif` is the fallback chain) — Geist **sans**, NOT monospace, NOT `--font-sans` (line 572 overrides the token) | 5168/572 |
| color | not matched → inherited from `td` chain | body `color: var(--toss-strong-text)` = `#191F28` (line 574), NOT `#111827`/`--fg-1` | 574 |
| font-weight | not matched → inherited | normal (AMBIGUOUS) | inheritance |

> This is a likely prototype bug: mono cells in `.db-list-table` are NOT actually
> rendered in monospace because the rule is `.db-table .mono`, not
> `.db-list-table .mono`. Do not assume monospace here. (For comparison, the
> `.res-id-text` span DOES set `font-family: 'Geist Mono', monospace` explicitly,
> line 2725, so Resource ID cells are genuinely mono.)

---

## 2. `.approval-table-wrap` (line 2680)

| property | literal | resolved | v15 line |
|---|---|---|---|
| border | `0` | `0` | 2681 |
| border-top | `0` | `0` | 2682 |
| border-radius | `0 0 var(--toss-radius-inner) var(--toss-radius-inner)` | `0 0 12px 12px` | 2683 |
| overflow | `hidden` | `hidden` | 2684 |
| background | `#fff` | `#fff` (literal) | 2685 |

Admin override: `#admDetailBody .approval-table-wrap { max-height: 320px; overflow-y: auto; }` (line 5078).

---

## 3. `.approval-table`

### 3a. `.approval-table` table (line 2687)

| property | literal | resolved | v15 line |
|---|---|---|---|
| width | `100%` | `100%` | 2687 |
| border-collapse | `collapse` | `collapse` | 2687 |
| font-size | `14px` | `14px` | 2687 |

### 3b. `.approval-table thead th` — header cell (line 2688)

| property | literal | resolved | v15 line |
|---|---|---|---|
| text-align | `left` | `left` | 2689 |
| font-size | `12px` | `12px` | 2690 |
| font-weight | `600` | `600` | 2691 |
| color | `var(--toss-weak-text)` | `#8B95A1` | 2692 |
| text-transform | `none` | `none` | 2693 |
| letter-spacing | `0` | `0` | 2694 |
| padding | `12px 18px` | `12px 18px` | 2695 |
| background | `var(--toss-inner-bg)` | `#F7F8FA` | 2696 |
| border-bottom | `1px solid var(--toss-divider)` | `1px solid #EBEEF2` | 2697 |
| white-space | `nowrap` | `nowrap` | 2698 |

### 3c. `.approval-table tbody td` — body cell (line 2700)

| property | literal | resolved | v15 line |
|---|---|---|---|
| padding | `16px 18px` | `16px 18px` | 2701 |
| border-bottom | `1px solid var(--toss-divider)` | `1px solid #EBEEF2` | 2702 |
| color | `var(--toss-strong-text)` | `#191F28` | 2703 |
| vertical-align | `middle` | `middle` | 2704 |
| font-weight | `500` | `500` | 2705 |
| (last row) border-bottom | `none` — `tbody tr:last-child td` | `none` | 2707 |
| height | not declared → computed | (AMBIGUOUS) | — |

### 3d. `.approval-table` body rows — states

| selector | property | literal | resolved | v15 line |
|---|---|---|---|---|
| `tbody tr` | transition | `background 0.12s` | `background 0.12s` | 2708 |
| `tbody tr:hover td` | background | `var(--toss-inner-bg)` | `#F7F8FA` | 2709 |
| `tbody tr.selected td` | background | `rgba(0,100,255,0.05)` | `rgba(0,100,255,0.05)` (literal) | 2710 |

### 3e. `.approval-table` checkboxes (line 2711)

`.approval-table th input[type="checkbox"], .approval-table td input[type="checkbox"]`:

| property | literal | resolved | v15 line |
|---|---|---|---|
| width | `14px` | `14px` | 2713 |
| height | `14px` | `14px` | 2713 |
| accent-color | `var(--color-primary)` | `#0064FF` | 2714 |
| cursor | `pointer` | `pointer` | 2715 |

### 3f. Admin column override (lines 5019–5020)

| selector | property | literal | resolved | v15 line |
|---|---|---|---|---|
| `.approval-table td.adm-col, .approval-table th.adm-col` | background | `#F8FAFD` | `#F8FAFD` (literal) | 5019 |
| `.approval-table th.adm-col` | color | `#1747B5` | `#1747B5` (literal) | 5020 |

---

## 4. `.row-excluded` (dimmed rows) — scoped to `.approval-table`

### 4a. Base dim (line 2762)

`.approval-table tr.row-excluded > td`:

| property | literal | resolved | v15 line |
|---|---|---|---|
| background | `#F2F4F6` | `#F2F4F6` (literal) | 2763 |
| color | `var(--fg-3)` | `#6B7280` | 2764 |

### 4b. Hover (line 2766)

`.approval-table tr.row-excluded:hover > td`:

| property | literal | resolved | v15 line |
|---|---|---|---|
| background | `#ECEFF3` | `#ECEFF3` (literal) | 2767 |

### 4c. Inner text overrides (lines 2769–2772)

| selector | property | literal | resolved | v15 line |
|---|---|---|---|---|
| `tr.row-excluded .res-id-text, tr.row-excluded .mono` | color | `var(--fg-3) !important` | `#6B7280 !important` | 2769–2770 |
| `tr.row-excluded .tag.blue` | background | `#E5E7EB` | `#E5E7EB` (literal) | 2772 |
| `tr.row-excluded .tag.blue` | color | `var(--fg-3)` | `#6B7280` | 2772 |

> Note: `.row-excluded` styling above is defined ONLY under `.approval-table`.
> The db-list table has a parallel-but-different mechanism, `.non-target` (§1f),
> not `.row-excluded`. A separate `.idc-row-excluded` exists for IDC tables
> (lines 4877–4878): `td:not(.idc-excl-cell){opacity:0.5}` and
> `background: var(--toss-inner-bg)` = `#F7F8FA`. Athena-grouped row-excluded
> variants live at lines 3907–3932 (out of this class's core scope).

---

## 5. `.copy-btn` in cells (`.res-id-cell .copy-btn`)

> ⚠ There is NO standalone/base `.copy-btn` rule in v15. The ONLY class rules are
> scoped under `.res-id-cell`. But `<button class="copy-btn">` is NOT on browser
> UA defaults: the global `button` reset at **line 579** applies —
> `button { font-family: inherit; cursor: pointer; border: none; background: none; padding: 0; color: inherit; }`.
> So border/background/padding are zeroed by that reset (not UA defaults), and
> font-family/color inherit (font = `Geist` from inline body 5168, the body 572 stack being the fallback; color overridden by the
> `.res-id-cell .copy-btn` `color: var(--fg-4)` below). `cursor: pointer` also comes from 579.

### 5a. `.res-id-cell .copy-btn` (line 2734)

| property | literal | resolved | v15 line |
|---|---|---|---|
| width | `22px` | `22px` | 2735 |
| height | `22px` | `22px` | 2735 |
| border-radius | `5px` | `5px` | 2736 |
| display | `inline-grid` | `inline-grid` | 2737 |
| place-items | `center` | `center` | 2737 |
| color | `var(--fg-4)` | `#9CA3AF` | 2738 |
| flex-shrink | `0` | `0` | 2739 |
| opacity | `0` | `0` (hidden until row hover) | 2740 |
| transition | `opacity 0.12s, background 0.12s, color 0.12s` | (same) | 2740 |
| border | not declared here → global `button` reset | `none` (line 579, `border: none`) — NOT UA default | 579 |
| background | not declared here → global `button` reset | `none` (line 579, `background: none`) — NOT UA default | 579 |
| padding | not declared here → global `button` reset | `0` (line 579) | 579 |
| cursor | not declared here → global `button` reset | `pointer` (line 579) | 579 |

### 5b. States

| selector | property | literal | resolved | v15 line |
|---|---|---|---|---|
| `tr:hover .res-id-cell .copy-btn` | opacity | `1` | `1` | 2742 |
| `.res-id-cell .copy-btn:hover` | background | `var(--bg-muted)` | `#F9FAFB` | 2743 |
| `.res-id-cell .copy-btn:hover` | color | `var(--fg-1)` | `#111827` | 2743 |
| `.res-id-cell .copy-btn.copied` | color | `var(--color-success)` | `#45CB85` | 2744 |
| `.res-id-cell .copy-btn.copied` | opacity | `1` | `1` | 2744 |

### 5c. Embedded SVG (inline markup, e.g. line 5746/5973)

`width="12" height="12"` (db-list-table & approval-table cells),
`fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`.
(IDC variant `ADM_COPY_SVG` / `idc` copy SVGs may differ — out of scope.)

### 5d. `.res-id-text` companion span (line 2724) — the genuine mono cell

| property | literal | resolved | v15 line |
|---|---|---|---|
| font-family | `'Geist Mono', monospace` | (literal) | 2725 |
| font-size | `12px` | `12px` | 2726 |
| color | `var(--fg-2)` | `#374151` | 2727 |
| overflow | `hidden` | `hidden` | 2728 |
| text-overflow | `ellipsis` | `ellipsis` | 2729 |
| white-space | `nowrap` | `nowrap` | 2730 |
| direction | `rtl` | `rtl` | 2731 |
| text-align | `left` | `left` | 2732 |

`.res-id-cell` wrapper (line 2719): `display: inline-flex; align-items: center; gap: 6px; max-width: 280px; position: relative;`.

---

## 6. Pagination footer in tables — `.athena-pager`

> ⚠ **NOT used by the target-source screens.** `.athena-pager` has **0 occurrences**
> in lines 5565–7254; those screens use `.pagination-row` / `.pg-*` (§7) as their
> actual pagination control. This `.athena-pager` section is kept for reference only.

> The in-table pager is rendered inside an `.athena-pager-row > td` and contains
> an `.athena-pager` flex bar. Both the row-cell chrome and the pager itself
> follow.

### 6a. Pager-row cell — `.db-list-table .athena-pager-row > td` (line 3852)

| property | literal | resolved | v15 line |
|---|---|---|---|
| background | `var(--athena-sub-bg)` | `#FFFAF3` | 3853 |
| border-top | `1px solid var(--athena-sub-edge)` | `1px solid #F0E1CB` | 3854 |
| padding | `8px 16px 8px 22px` | `8px 16px 8px 22px` | 3855 |
| position | `relative` | `relative` | 3856 |

Spine pseudo-element — `.athena-pager-row > td::before` (line 3858; note this
selector is NOT `.db-list-table`-prefixed — it is bare `.athena-pager-row > td::before`,
so it applies to BOTH db-list and any unscoped pager-row, but approval-table
re-declares its own at 3939):

| property | literal | resolved | v15 line |
|---|---|---|---|
| content | `""` | `""` | 3859 |
| position | `absolute` | `absolute` | 3859 |
| left | `0` | `0` | 3860 |
| top | `0` | `0` | 3860 |
| bottom | `0` | `0` | 3860 |
| width | `4px` | `4px` | 3860 |
| background | `var(--athena-spine)` | `#C2410C` | 3861 |

Pager margin override — `.athena-pager-row .athena-pager { margin-top: 0; }` (line 3864).

approval-table has its OWN explicitly-declared rules (not just a mirror); see §6a-bis.

### 6a-bis. approval-table pager-row — SEPARATE declared rules (lines 3932–3944)

NOT inherited from db-list — `.approval-table` re-declares the full set. Comment
at line 3932 reads "mirror db-list-table" but the CSS is its own block.

Cell — `.approval-table .athena-pager-row > td` (line 3933):

| property | literal | resolved | v15 line |
|---|---|---|---|
| background | `var(--athena-sub-bg)` | `#FFFAF3` | 3934 |
| border-top | `1px solid var(--athena-sub-edge)` | `1px solid #F0E1CB` | 3935 |
| padding | `8px 16px 8px 22px` | `8px 16px 8px 22px` | 3936 |
| position | `relative` | `relative` | 3937 |

Spine pseudo-element — `.approval-table .athena-pager-row > td::before` (line 3939):

| property | literal | resolved | v15 line |
|---|---|---|---|
| content | `""` | `""` | 3940 |
| position | `absolute` | `absolute` | 3940 |
| left | `0` | `0` | 3941 |
| top | `0` | `0` | 3941 |
| bottom | `0` | `0` | 3941 |
| width | `4px` | `4px` | 3941 |
| background | `var(--athena-spine)` | `#C2410C` | 3942 |

Pager margin override — `.approval-table .athena-pager-row .athena-pager { margin-top: 0; }` (line 3944).

### 6b. `.athena-pager` bar (line 4530)

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `flex` | `flex` | 4531 |
| align-items | `center` | `center` | 4531 |
| gap | `4px` | `4px` | 4531 |
| margin-top | `10px` | `10px` (overridden to `0` inside pager-row, lines 3864/3944) | 4532 |
| font-size | `12px` | `12px` | 4533 |

### 6c. `.athena-pager .pg-info` (line 4535)

| property | literal | resolved | v15 line |
|---|---|---|---|
| color | `var(--fg-3)` | `#6B7280` | 4536 |
| margin-right | `auto` | `auto` | 4536 |
| font-variant-numeric | `tabular-nums` | `tabular-nums` | 4537 |
| `.pg-info strong` color | `var(--fg-1)` | `#111827` | 4539 |
| `.pg-info strong` font-weight | `600` | `600` | 4539 |

### 6d. `.athena-pager button` (line 4540)

| property | literal | resolved | v15 line |
|---|---|---|---|
| min-width | `26px` | `26px` | 4541 |
| height | `26px` | `26px` | 4541 |
| padding | `0 8px` | `0 8px` | 4542 |
| border | `1px solid transparent` | `1px solid transparent` | 4543 |
| background | `transparent` | `transparent` | 4544 |
| border-radius | `5px` | `5px` | 4545 |
| color | `var(--fg-2)` | `#374151` | 4546 |
| font-size | `12px` | `12px` | 4546 |
| cursor | `pointer` | `pointer` | 4547 |
| display | `inline-grid` | `inline-grid` | 4548 |
| place-items | `center` | `center` | 4548 |

States:

| selector | property | literal | resolved | v15 line |
|---|---|---|---|---|
| `button:hover` | background | `var(--bg-muted)` | `#F9FAFB` | 4550 |
| `button:hover` | color | `var(--fg-1)` | `#111827` | 4550 |
| `button.current` | background | `var(--color-primary)` | `#0064FF` | 4552 |
| `button.current` | color | `#fff` | `#fff` | 4552 |
| `button.current` | font-weight | `600` | `600` | 4552 |
| `button:disabled` | opacity | `0.35` | `0.35` | 4554 |
| `button:disabled` | cursor | `not-allowed` | `not-allowed` | 4554 |
| `button:disabled` | background | `transparent` | `transparent` | 4554 |

---

## 7. Pagination — `.pagination-row` / `.pg-*` (ACTUAL screen pagination)

> This is the pagination control the **target-source screens (lines 5565–7254)
> actually use** — `.pagination-row` + `.pg-*` (13 occurrences in that range).
> NOT `.athena-pager` (§6), which has 0 occurrences there. Transcribed verbatim
> from the "Pagination" block, v15 lines 2932–2996. Every `var(--x)` resolved
> against §Resolver appendix + `00-tokens.md`. LITERAL only.

### 7a. `.pagination-row` container (line 2933)

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `flex` | `flex` | 2934 |
| align-items | `center` | `center` | 2934 |
| padding | `10px 14px` | `10px 14px` | 2935 |
| border | `1px solid var(--border-default)` | `1px solid #E5E7EB` | 2936 |
| border-top | `none` | `none` | 2937 |
| border-radius | `0 0 10px 10px` | `0 0 10px 10px` | 2938 |
| background | `#FCFCFD` | `#FCFCFD` (literal hex, NOT a var) | 2939 |
| font-size | `12px` | `12px` | 2940 |
| color | `var(--fg-3)` | `#6B7280` | 2941 |

### 7b. `.pagination-row .pg-perpage` — per-page wrapper (line 2943)

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `inline-flex` | `inline-flex` | 2944 |
| align-items | `center` | `center` | 2944 |
| gap | `6px` | `6px` | 2944 |

### 7c. `.pagination-row .pg-perpage select` — per-page dropdown (line 2946)

| property | literal | resolved | v15 line |
|---|---|---|---|
| height | `26px` | `26px` | 2947 |
| border | `1px solid var(--border-default)` | `1px solid #E5E7EB` | 2948 |
| border-radius | `6px` | `6px` | 2949 |
| padding | `0 22px 0 8px` | `0 22px 0 8px` | 2950 |
| font-size | `12px` | `12px` | 2951 |
| background | `#fff url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='9' height='9' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>") right 7px center no-repeat` | (verbatim; bg color `#fff`, data-URI chevron, positioned `right 7px center no-repeat`. The SVG `stroke='%239CA3AF'` = `#9CA3AF` URL-encoded) | 2952 |
| -webkit-appearance | `none` | `none` | 2953 |
| appearance | `none` | `none` | 2953 |
| color | `var(--fg-1)` | `#111827` | 2954 |
| cursor | `pointer` | `pointer` | 2955 |

### 7d. `.pagination-row .pg-info` — info text (line 2957)

| property | literal | resolved | v15 line |
|---|---|---|---|
| margin-left | `16px` | `16px` | 2958 |
| color | `var(--fg-2)` | `#374151` | 2959 |
| font-variant-numeric | `tabular-nums` | `tabular-nums` | 2960 |

`.pagination-row .pg-info strong` (line 2962):

| property | literal | resolved | v15 line |
|---|---|---|---|
| color | `var(--fg-1)` | `#111827` | 2962 |
| font-weight | `600` | `600` | 2962 |

### 7e. `.pagination-row .pg-spacer` — flex spacer (line 2963)

| property | literal | resolved | v15 line |
|---|---|---|---|
| flex | `1` | `1` | 2963 |

### 7f. `.pagination-row .pg-pages` — page-button group (line 2964)

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `inline-flex` | `inline-flex` | 2965 |
| gap | `2px` | `2px` | 2965 |

### 7g. `.pagination-row .pg-pages button` — page button (line 2967)

| property | literal | resolved | v15 line |
|---|---|---|---|
| min-width | `28px` | `28px` | 2968 |
| height | `28px` | `28px` | 2968 |
| padding | `0 8px` | `0 8px` | 2969 |
| border-radius | `6px` | `6px` | 2970 |
| border | `1px solid transparent` | `1px solid transparent` | 2971 |
| background | `transparent` | `transparent` | 2972 |
| color | `var(--fg-2)` | `#374151` | 2973 |
| font-size | `12px` | `12px` | 2974 |
| font-variant-numeric | `tabular-nums` | `tabular-nums` | 2975 |
| display | `inline-grid` | `inline-grid` | 2976 |
| place-items | `center` | `center` | 2976 |
| cursor | not declared here → global `button` reset | `pointer` (line 579, `cursor: pointer`) — NOT UA default | 579 |
| font-family | not declared here → global `button` reset | `inherit` (line 579) → `Geist` (inline body 5168; the body 572 stack is the fallback) | 579/5168 |

> Note: `.pg-pages button` declares its own `border`/`background`/`color`, but
> does **not** declare `cursor` or `font-family`; those come from the global
> `button` reset at line 579 (see §5 preamble).

### 7h. `.pagination-row .pg-pages button` — states

| selector | property | literal | resolved | v15 line |
|---|---|---|---|---|
| `button:hover` | background | `var(--bg-muted)` | `#F9FAFB` | 2979 |
| `button:hover` | color | `var(--fg-1)` | `#111827` | 2980 |
| `button.current` | background | `var(--color-primary)` | `#0064FF` | 2983 |
| `button.current` | color | `#fff` | `#fff` | 2984 |
| `button.current` | font-weight | `600` | `600` | 2985 |
| `button:disabled` | opacity | `0.35` | `0.35` | 2988 |
| `button:disabled` | cursor | `not-allowed` | `not-allowed` | 2988 |
| `button:disabled` | background | `transparent !important` | `transparent !important` | 2989 |

### 7i. `.pagination-row .pg-ellipsis` — ellipsis gap (line 2991)

| property | literal | resolved | v15 line |
|---|---|---|---|
| min-width | `20px` | `20px` | 2992 |
| text-align | `center` | `center` | 2992 |
| color | `var(--fg-4)` | `#9CA3AF` | 2993 |
| align-self | `center` | `center` | 2994 |
| font-size | `12px` | `12px` | 2995 |

> **Contrast with §6 `.athena-pager`** (reference-only): `.pg-pages button` is
> `28×28px` / `border-radius: 6px` (vs athena `26×26px` / `5px`); `pg-pages` gap
> `2px` (athena bar gap `4px`); disabled bg uses `!important` here (athena does
> not); `.pagination-row` is a standalone footer bar (`#FCFCFD`, own border +
> `0 0 10px 10px` radius), not an in-`<td>` athena-spine row.

---

## Ambiguities / gaps (read before implementing)

1. **`.db-list-table` mono cells are NOT monospace** (§1g). Rule is `.db-table .mono`
   (line 1106), not `.db-list-table .mono`; the wrapper class doesn't match, so
   those `td.mono` cells inherit the sans body font. Likely prototype bug. Only
   `.res-id-text` (§5d) is reliably monospace.
2. **Body-cell `color` / row `height` not declared.** `.db-list-table td` (§1e)
   declares no `color` and no fixed `height`; both come from inheritance/box
   computation. `.approval-table tbody td` DOES declare color (`#191F28`) but no
   height. Heights are content+padding driven — do not assume a fixed px height.
3. **`.copy-btn` has no base CLASS rule** (§5), but is NOT on UA defaults. The
   global `button` reset (line 579) zeroes `border`/`background`/`padding` and sets
   `cursor: pointer`, `font-family: inherit`, `color: inherit`. All class styling is
   via `.res-id-cell .copy-btn`. Net button chrome = 579 reset + the `.res-id-cell`
   sizing/color rules — no UA borders/background appear.
4. **Two distinct dim mechanisms.** approval-table uses `.row-excluded`
   (`#F2F4F6` bg, §4); db-list-table uses `.non-target` (`#F2F4F6` bg, §1f);
   IDC uses `.idc-row-excluded` (opacity 0.5 + `#F7F8FA`, lines 4877–4878). Same
   visual family, different selectors — pick by table type.
5. **Athena-grouped overrides excluded from core tables.** Many
   `.athena-*` row variants (db-tr, region-row, group-header/footer,
   region-resource/detail, pager mirrors) at lines 3623–4387 re-skin these tables
   for the Athena spine UI. Captured here only: the pager-row cell chrome (§6a).
   If implementing Athena grouping, those blocks need a separate pass.
6. **`thead` background literals.** `.db-list-table thead` = `#FAFBFC` (line 1862,
   literal hex, distinct from any token); `.approval-table thead th` =
   `#F7F8FA` (`--toss-inner-bg`). They differ by 1–2 levels of off-white — not
   the same value.
