# v15 STATUS / TAG / PILL — literal CSS extract

> Transcribed verbatim from `design/SIT Prototype Athena v15.html`.
> Values are EXACT — no rounding, no inference. `var(--x)` is resolved against
> `design/v15-extract/00-tokens.md` (the canonical resolver). Each row cites the
> v15 line number.
>
> Resolver chain notes: `--fg-1 → --gray-900 → #111827`; `--fg-2 → --gray-700 →
> #374151`; `--fg-3 → --gray-500 → #6B7280`; `--border-default → --gray-200 →
> #E5E7EB`; `--bg-muted → --gray-50 → #F9FAFB`. The toss palette and athena
> palette are defined locally in the 2nd `<style>` block (lines 548–566,
> 3612–3619).

---

## 1. `.tag` — DB-type / generic tag (lines 1109–1120)

Base rule (line 1109–1115):

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `inline-flex` | — | 1110 |
| align-items | `center` | — | 1110 |
| gap | `4px` | `4px` | 1110 |
| padding | `4px 10px` | `4px 10px` | 1111 |
| border-radius | `8px` | `8px` | 1111 |
| font-size | `12px` | `12px` | 1112 |
| font-weight | `600` | `600` | 1112 |
| letter-spacing | `-0.01em` | `-0.01em` | 1113 |
| white-space | `nowrap` | — | 1114 |
| color | (none on base — set per variant) | — | — |
| background | (none on base — set per variant) | — | — |

### `.tag` color variants

| variant | background literal | background resolved | text color literal | text color resolved | v15 line |
|---|---|---|---|---|---|
| `.tag.blue` | `#E8F1FF` | `#E8F1FF` | `#1747B5` | `#1747B5` | 1116 |
| `.tag.gray` | `var(--toss-inner-bg)` | `#F7F8FA` | `var(--toss-medium-text)` | `#4E5968` | 1117 |
| `.tag.green` | `#E5F8EE` | `#E5F8EE` | `#197A3F` | `#197A3F` | 1118 |
| `.tag.red` | `#FEECEC` | `#FEECEC` | `#B42318` | `#B42318` | 1119 |
| `.tag.orange` | `#FEF0E1` | `#FEF0E1` | `#7A3F0E` | `#7A3F0E` | 1120 |

### `.tag.athena` — Athena-resource tag (lines 4231–4244)

Overrides base `.tag` with its own bg/text/border + a leading dot pseudo-element.

| property | literal | resolved | v15 line |
|---|---|---|---|
| background | `rgba(194, 65, 12, 0.1)` | `rgba(194, 65, 12, 0.1)` | 4232 |
| color | `var(--athena-deep)` | `#7A2E05` | 4233 |
| font-weight | `700` | `700` | 4234 |
| border | `1px solid rgba(194, 65, 12, 0.18)` | `1px solid rgba(194, 65, 12, 0.18)` | 4235 |
| display | `inline-flex` | — | 4236 |
| align-items | `center` | — | 4236 |
| gap | `5px` | `5px` | 4236 |

`.tag.athena::before` (leading dot, lines 4238–4244):

| property | literal | resolved | v15 line |
|---|---|---|---|
| content | `""` | — | 4239 |
| width | `5px` | `5px` | 4240 |
| height | `5px` | `5px` | 4240 |
| border-radius | `50%` | `50%` | 4241 |
| background | `var(--athena-spine)` | `#C2410C` | 4242 |
| flex-shrink | `0` | — | 4243 |

### Contextual `.tag` overrides (scoped — DO NOT confuse with base)

| selector | overridden props (literal → resolved) | v15 line |
|---|---|---|
| `.dbtype-selected .tag` | padding `4px 8px`; font-size `12px`; gap `6px` | 1541–1545 |
| `.dbtype-selected .tag button` | color `currentColor`; opacity `0.6`; line-height `1`; font-size `14px`; margin-left `2px` | 1546–1549 |
| `.dbtype-selected .tag button:hover` | opacity `1` | 1550 |
| `.approval-table tr.row-excluded .tag.blue` | background `#E5E7EB`; color `var(--fg-3)` → `#6B7280` | 2771–2773 |
| `.approval-table tr.athena-db-tr.row-excluded .tag.blue` | background `#E5E7EB`; color `var(--fg-3)` → `#6B7280` | 3928–3930 |
| `.infra-row .row-dbs .tag` | font-size `11px`; padding `2px 7px` | 3255–3257 |
| `.preview-card .pc-db .tag` | font-size `11.5px` | 3585 |
| `.athena-row .tag.athena` | background `#FFF1E6`; color `#B5500B` (overrides the rgba/var bg+color of the base `.tag.athena`) | 4420 |
| `.athena-row .tag.target-count` | background `var(--toss-inner-bg)` → `#F7F8FA`; color `var(--fg-2)` → `#374151`; font-weight `600`; border `1px solid var(--border-default)` → `1px solid #E5E7EB` | 4421–4424 |

> `.tag.target-count` has NO standalone base rule — it inherits the base `.tag`
> geometry and is only ever styled via the `.athena-row` scope above (4421).

---

## 2. `.status` — inline dot + label (lines 1122–1134)

Base rule (lines 1122–1125):

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `inline-flex` | — | 1123 |
| align-items | `center` | — | 1123 |
| gap | `6px` | `6px` | 1123 |
| font-size | `12.5px` | `12.5px` | 1124 |
| font-weight | `500` | `500` | 1124 |
| color | (none on base — set per variant) | — | — |

`.status .dot` (base dot, lines 1126–1128):

| property | literal | resolved | v15 line |
|---|---|---|---|
| width | `8px` | `8px` | 1127 |
| height | `8px` | `8px` | 1127 |
| border-radius | `50%` | `50%` | 1127 |
| background | (none on base — set per variant) | — | — |

### `.status` variants (text color + dot background)

| variant | text color literal | text color resolved | v15 line | dot bg literal | dot bg resolved | v15 line |
|---|---|---|---|---|---|---|
| `.status.healthy` | `var(--color-success-dark)` | `#2A7D52` | 1129 | `var(--color-success)` | `#45CB85` | 1130 |
| `.status.unhealthy` | `var(--color-error-dark)` | `#991B1B` | 1131 | `var(--color-error)` | `#EF4444` | 1132 |
| `.status.partial` | `var(--color-warning-dark)` | `#9A3412` | 1133 | `var(--color-warning)` | `#F97316` | 1134 |

> AMBIGUITY / MISSING — The task asked for `.status.success`, `.status.error`,
> and `.status.healthy`. **`.status.success` and `.status.error` DO NOT EXIST in
> v15.** The v15 status modifiers are exactly three: `.healthy`, `.unhealthy`,
> `.partial`. The semantic equivalents are `.healthy` (success, `#2A7D52` /
> `#45CB85` dot) and `.unhealthy` (error, `#991B1B` / `#EF4444` dot). No
> animation is declared on `.status` or its dot.

---

## 3. `.status-pill-v2` — filled status pill (lines 3259–3287)

Base rule (lines 3259–3265):

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `inline-flex` | — | 3260 |
| align-items | `center` | — | 3260 |
| gap | `6px` | `6px` | 3260 |
| padding | `5px 10px` | `5px 10px` | 3261 |
| font-size | `12px` | `12px` | 3262 |
| font-weight | `600` | `600` | 3262 |
| border-radius | `999px` | `999px` | 3263 |
| letter-spacing | `-0.01em` | `-0.01em` | 3264 |
| width | `fit-content` | — | 3265 |

`.status-pill-v2 .dot` (lines 3267–3271):

| property | literal | resolved | v15 line |
|---|---|---|---|
| width | `6px` | `6px` | 3268 |
| height | `6px` | `6px` | 3268 |
| border-radius | `999px` | `999px` | 3269 |
| background | `currentColor` | (= the variant's `color`) | 3270 |

### `.status-pill-v2` variants (background + text color; dot inherits text color)

| variant | background literal | background resolved | text color literal | text color resolved | v15 line |
|---|---|---|---|---|---|
| `.status-pill-v2.healthy` | `rgba(22, 163, 74, 0.08)` | `rgba(22, 163, 74, 0.08)` | `#15803D` | `#15803D` | 3272–3274 |
| `.status-pill-v2.partial` | `rgba(202, 138, 4, 0.10)` | `rgba(202, 138, 4, 0.10)` | `#A16207` | `#A16207` | 3276–3278 |
| `.status-pill-v2.unhealthy` | `rgba(220, 38, 38, 0.07)` | `rgba(220, 38, 38, 0.07)` | `#B91C1C` | `#B91C1C` | 3280–3282 |
| `.status-pill-v2.pending` | `var(--bg-muted)` | `#F9FAFB` | `var(--toss-weak-text)` | `#8B95A1` | 3284–3286 |

> No animation declared. The dot color always tracks `currentColor`, so each
> variant's dot bg = its text color above.

---

## 4. `.install-task .status-pill` — install step pill (lines 2082–2093)

Scoped under `.install-task`. Base rule (lines 2082–2090):

| property | literal | resolved | v15 line |
|---|---|---|---|
| font-size | `12px` | `12px` | 2083 |
| font-weight | `700` | `700` | 2083 |
| padding | `5px 12px` | `5px 12px` | 2084 |
| border-radius | `999px` | `999px` | 2085 |
| background | `#fff` | `#FFFFFF` | 2086 |
| color | `var(--toss-weak-text)` | `#8B95A1` | 2087 |
| margin-top | `4px` | `4px` | 2088 |
| letter-spacing | `-0.01em` | `-0.01em` | 2089 |

### state variants (parent state modifier)

| variant | background literal | background resolved | text color literal | text color resolved | v15 line |
|---|---|---|---|---|---|
| `.install-task.done .status-pill` | `#fff` | `#FFFFFF` | `var(--color-success-dark)` | `#2A7D52` | 2091 |
| `.install-task.running .status-pill` | `var(--color-primary)` | `#0064FF` | `#fff` | `#FFFFFF` | 2092 |
| `.install-task.failed .status-pill` | `#fff` | `#FFFFFF` | `#991B1B` | `#991B1B` | 2093 |

> Default/idle (no parent state) uses the base rule: white bg, `#8B95A1` text.
> No animation declared.

---

## 5. `.target-pill` — target yes/no pill with dot (lines 2747–2760)

Base rule (lines 2747–2752):

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `inline-flex` | — | 2748 |
| align-items | `center` | — | 2748 |
| gap | `6px` | `6px` | 2748 |
| padding | `3px 9px` | `3px 9px` | 2749 |
| border-radius | `999px` | `999px` | 2750 |
| font-size | `11.5px` | `11.5px` | 2751 |
| font-weight | `600` | `600` | 2751 |
| white-space | `nowrap` | — | 2752 |

`.target-pill .dot` (base dot, lines 2756–2758):

| property | literal | resolved | v15 line |
|---|---|---|---|
| width | `6px` | `6px` | 2757 |
| height | `6px` | `6px` | 2757 |
| border-radius | `50%` | `50%` | 2757 |
| background | (none on base — set per variant) | — | — |

### `.target-pill` variants

| variant | background literal | bg resolved | text color literal | text resolved | border literal | border resolved | v15 line |
|---|---|---|---|---|---|---|---|
| `.target-pill.yes` | `#F0FDF4` | `#F0FDF4` | `#15803D` | `#15803D` | `1px solid #BBF7D0` | `1px solid #BBF7D0` | 2754 |
| `.target-pill.no` | `#fff` | `#FFFFFF` | `var(--fg-3)` | `#6B7280` | `1px solid var(--border-default)` | `1px solid #E5E7EB` | 2755 |

### `.target-pill .dot` variants

| variant | dot bg literal | dot bg resolved | v15 line |
|---|---|---|---|
| `.target-pill.yes .dot` | `#10B981` | `#10B981` | 2759 |
| `.target-pill.no .dot` | `#9CA3AF` | `#9CA3AF` | 2760 |

> `.region-group-head .rg-status .target-pill` (line 4617) is a comment-only
> block — "reuse existing target-pill style" — it adds NO properties.
> No animation declared.

---

## 6. `.reason-chip-inline` — exclusion reason chip + info icon + tooltip (lines 2778–2847)

Base chip rule (lines 2778–2790):

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `inline-flex` | — | 2779 |
| align-items | `center` | — | 2779 |
| gap | `5px` | `5px` | 2779 |
| max-width | `100%` | `100%` | 2780 |
| padding | `3px 9px` | `3px 9px` | 2781 |
| border-radius | `6px` | `6px` | 2782 |
| background | `#FFF7ED` | `#FFF7ED` | 2783 |
| color | `#9A3412` | `#9A3412` | 2784 |
| border | `1px solid #FED7AA` | `1px solid #FED7AA` | 2785 |
| font-size | `11.5px` | `11.5px` | 2786 |
| font-weight | `500` | `500` | 2787 |
| cursor | `help` | — | 2788 |
| transition | `background 0.12s, border-color 0.12s` | — | 2789 |

`.reason-chip-inline:hover` (lines 2791–2794):

| property | literal | resolved | v15 line |
|---|---|---|---|
| background | `#FFEDD5` | `#FFEDD5` | 2792 |
| border-color | `#FDBA74` | `#FDBA74` | 2793 |

`.reason-chip-inline .rc-text` (truncating label, lines 2795–2800):

| property | literal | resolved | v15 line |
|---|---|---|---|
| overflow | `hidden` | — | 2796 |
| text-overflow | `ellipsis` | — | 2797 |
| max-width | `180px` | `180px` | 2798 |
| white-space | `nowrap` | — | 2799 |

`.reason-chip-inline svg` (info icon, line 2801):

| property | literal | resolved | v15 line |
|---|---|---|---|
| color | `#C2410C` | `#C2410C` | 2801 |
| flex-shrink | `0` | — | 2801 |
| opacity | `0.8` | `0.8` | 2801 |

### Scoped `.rc-text` overrides

| selector | overridden prop | v15 line |
|---|---|---|
| `.idc-load-list .reason-chip-inline .rc-text` | max-width `80px` | 4849 |
| `.idc-excl-cell .reason-chip-inline` | cursor `pointer` | 4897 |

### Associated floating tooltip — `.reason-floating-tip` (lines 2804–2847)

JS-positioned portal that escapes table overflow. Triggered by the chip.

| property | literal | resolved | v15 line |
|---|---|---|---|
| position | `fixed` | — | 2805 |
| z-index | `9999` | — | 2806 |
| display | `none` (→ `block` when `.visible`) | — | 2807 |
| width | `340px` | `340px` | 2808 |
| background | `#fff` | `#FFFFFF` | 2809 |
| color | `var(--fg-1)` | `#111827` | 2810 |
| padding | `14px 16px 14px` | `14px 16px 14px` | 2811 |
| border-radius | `12px` | `12px` | 2812 |
| font-size | `12.5px` | `12.5px` | 2813 |
| font-weight | `400` | `400` | 2814 |
| line-height | `1.65` | `1.65` | 2815 |
| border | `1px solid var(--border-default)` | `1px solid #E5E7EB` | 2816 |
| box-shadow | `0 16px 40px rgba(15, 23, 42, 0.14), 0 4px 12px rgba(15, 23, 42, 0.08)` | same | 2817 |
| pointer-events | `none` | — | 2818 |
| opacity | `0` (→ `1` when `.visible`) | — | 2819 |
| transform | `translateY(-4px)` (→ `translateY(0)` when `.visible`) | — | 2820 |
| transition | `opacity 0.14s ease, transform 0.14s ease` | — | 2821 |

`.reason-floating-tip.visible` (lines 2823–2827): display `block`; opacity `1`; transform `translateY(0)`.

`.reason-floating-tip .rft-label` (lines 2828–2834):

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `flex` | — | 2829 |
| align-items | `center` | — | 2829 |
| gap | `6px` | `6px` | 2829 |
| font-size | `10.5px` | `10.5px` | 2830 |
| font-weight | `700` | `700` | 2830 |
| text-transform | `uppercase` | — | 2831 |
| letter-spacing | `0.08em` | `0.08em` | 2831 |
| color | `#C2410C` | `#C2410C` | 2832 |
| margin-bottom | `8px` | `8px` | 2833 |

`.reason-floating-tip .rft-label::before` (label dot, lines 2835–2839): content `''`; width `4px`; height `4px`; border-radius `50%`; background `#C2410C`.

`.reason-floating-tip .rft-meta` (lines 2840–2847): display `block`; margin-top `10px`; padding-top `10px`; border-top `1px solid var(--border-default)` → `1px solid #E5E7EB`; font-size `11.5px`; color `var(--fg-3)` → `#6B7280`.

`.reason-floating-tip::before` (tooltip arrow, lines 2848–2857):

| property | literal | resolved | v15 line |
|---|---|---|---|
| content | `''` | — | 2849 |
| position | `absolute` | — | 2850 |
| top | `-6px` | `-6px` | 2851 |
| left | `22px` | `22px` | 2851 |
| width | `11px` | `11px` | 2852 |
| height | `11px` | `11px` | 2852 |
| background | `#fff` | `#FFFFFF` | 2853 |
| border-top | `1px solid var(--border-default)` | `1px solid #E5E7EB` | 2854 |
| border-left | `1px solid var(--border-default)` | `1px solid #E5E7EB` | 2855 |
| transform | `rotate(45deg)` | `rotate(45deg)` | 2856 |

`.reason-floating-tip.flip-up::before` (flipped arrow, lines 2858–2863):

| property | literal | resolved | v15 line |
|---|---|---|---|
| top | `auto` | — | 2859 |
| bottom | `-6px` | `-6px` | 2859 |
| border-top | `none` | — | 2860 |
| border-left | `none` | — | 2860 |
| border-bottom | `1px solid var(--border-default)` | `1px solid #E5E7EB` | 2861 |
| border-right | `1px solid var(--border-default)` | `1px solid #E5E7EB` | 2862 |

---

## 7. `.scan-pill` (Step-1 scan status pill) — lines 2918–2930

Used in the Step-1 scan-results table (target-source screens). 4 static
occurrences in markup (lines 6254, 6269, 6292, 6315) plus 2 JS-template usages
(lines 11083–11084). Header comment: `/* Scan history pill */` (line 2917).

Base rule (lines 2918–2924):

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `inline-flex` | — | 2919 |
| align-items | `center` | — | 2919 |
| gap | `5px` | `5px` | 2919 |
| padding | `2px 8px` | `2px 8px` | 2920 |
| border-radius | `4px` | `4px` | 2921 |
| font-size | `11px` | `11px` | 2922 |
| font-weight | `600` | `600` | 2922 |
| letter-spacing | `0.01em` | `0.01em` | 2923 |
| color | (none on base — set per variant) | — | — |
| background | (none on base — set per variant) | — | — |

`.scan-pill svg` (line 2925):

| property | literal | resolved | v15 line |
|---|---|---|---|
| flex-shrink | `0` | — | 2925 |

### `.scan-pill` variants (background + text color)

| variant | background literal | background resolved | text color literal | text color resolved | v15 line |
|---|---|---|---|---|---|
| `.scan-pill.new` | `#DBEAFE` | `#DBEAFE` | `#1E40AF` | `#1E40AF` | 2926 |
| `.scan-pill.changed` | `#FEF3C7` | `#FEF3C7` | `#92400E` | `#92400E` | 2927 |
| `.scan-pill.kept` | `var(--gray-100)` | `#F3F4F6` | `var(--gray-700)` | `#374151` | 2928 |
| `.scan-pill.integrated` | `#D1FAE5` | `#D1FAE5` | `#065F46` | `#065F46` | 2929 |
| `.scan-pill.none` | `transparent` | `transparent` | `var(--fg-4)` | `#9CA3AF` | 2930 |

> **`.scan-pill.none` also overrides `padding: 0`** (line 2930), replacing the
> base `2px 8px`. The other four variants keep the base padding.
> **`letter-spacing` is declared (`0.01em`, line 2923)** — the global inherited
> `-0.018em` does NOT apply to this component.
> `--gray-700 → #374151` (NOT `#4B5563`, which is `--gray-600`); `--fg-4 →
> --gray-400 → #9CA3AF` (verified v15 lines 305, 315, 302). No border, no
> animation declared.

---

## Ambiguities & notes

1. **`.status.success` / `.status.error` do not exist.** v15 ships only
   `.status.healthy`, `.status.unhealthy`, `.status.partial` (lines 1129–1134).
   Map success→healthy, error→unhealthy.
2. **Two distinct status-pill families exist.** `.install-task .status-pill`
   (lines 2082–2093, white/primary/red, font-weight 700, radius 999px) is
   SEPARATE from `.status-pill-v2` (lines 3259–3287, tinted-rgba fills,
   font-weight 600, has a `.dot`). They are not the same component — keep them
   distinct.
3. **No animations** are declared on any of these classes (`.tag`, `.status`,
   `.status-pill-v2`, `.install-task .status-pill`, `.target-pill`). Only
   `.reason-chip-inline` (transition on bg/border) and `.reason-floating-tip`
   (transition on opacity/transform) animate — both are CSS transitions, no
   `@keyframes`.
4. **`currentColor` couplings** — `.status-pill-v2 .dot` background is
   `currentColor`, so the dot color is whatever the variant's `color` resolves
   to (3270). `.dbtype-selected .tag button` color is also `currentColor` (1547).
5. **rgba() values are kept literal, NOT resolved to hex** — e.g.
   `.tag.athena` bg `rgba(194, 65, 12, 0.1)` and the `.status-pill-v2` variant
   fills are alpha-channel rgba; resolving to opaque hex would be inference, so
   they are left as declared.
6. **Resolver assumptions verified against `00-tokens.md` + 1st `<style>`:**
   `--color-success #45CB85`, `--color-success-dark #2A7D52`, `--color-error
   #EF4444`, `--color-error-dark #991B1B`, `--color-warning #F97316`,
   `--color-warning-dark #9A3412`, `--color-primary #0064FF`. Toss/athena vars
   from the 2nd `<style>` block: `--toss-inner-bg #F7F8FA`, `--toss-medium-text
   #4E5968`, `--toss-weak-text #8B95A1`, `--athena-deep #7A2E05`, `--athena-spine
   #C2410C`.
