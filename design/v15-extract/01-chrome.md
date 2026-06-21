# v15 Page-Chrome Components — literal CSS spec

> Pixel-exact transcription from `SIT Prototype Athena v15.html`. Every property
> below is copied verbatim from the declared CSS rule; nothing rounded, inferred,
> or approximated. Every `var(--x)` is resolved to its literal token value with the
> var name preserved.
>
> **Token resolution sources (this file):**
> - `--toss-*` variables: `:root` override block, lines 546–555 (2nd `<style>`)
> - `--color-provider-azure`: line 290
>
> | var | literal |
> |---|---|
> | `--toss-strong-text` | `#191F28` (line 552) |
> | `--toss-medium-text` | `#4E5968` (line 553) |
> | `--toss-weak-text` | `#8B95A1` (line 554) |
> | `--toss-faint-text` | `#B0B8C1` (line 555) |
> | `--toss-card-bg` | `#FFFFFF` (line 549) |
> | `--toss-inner-bg` | `#F7F8FA` (line 550) |
> | `--toss-divider` | `#EBEEF2` (line 551) |
> | `--color-provider-azure` | `#0078D4` (line 290) |

---

## `.breadcrumb` (lines 729–736)

### `.breadcrumb` (729–734)

| property | literal | resolved | v15 line |
|---|---|---|---|
| font-size | `13px` | `13px` | 730 |
| color | `var(--toss-weak-text)` | `#8B95A1` | 731 |
| margin-bottom | `16px` | `16px` | 732 |
| font-weight | `500` | `500` | 733 |

### `.breadcrumb .sep` (735)

| property | literal | resolved | v15 line |
|---|---|---|---|
| margin | `0 8px` | `0 8px` | 735 |
| color | `var(--toss-faint-text)` | `#B0B8C1` | 735 |

### `.breadcrumb .current` (736)

| property | literal | resolved | v15 line |
|---|---|---|---|
| color | `var(--toss-medium-text)` | `#4E5968` | 736 |

---

## `.page-header` / `.page-title` (lines 739–741)

### `.page-header` (739)

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `flex` | `flex` | 739 |
| justify-content | `space-between` | `space-between` | 739 |
| align-items | `flex-start` | `flex-start` | 739 |
| margin-bottom | `8px` | `8px` | 739 |
| gap | `16px` | `16px` | 739 |

### `.page-header .actions` (740)

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `flex` | `flex` | 740 |
| gap | `8px` | `8px` | 740 |
| align-items | `center` | `center` | 740 |
| flex-wrap | `wrap` | `wrap` | 740 |
| justify-content | `flex-end` | `flex-end` | 740 |

### `.page-title` (741) — header title

| property | literal | resolved | v15 line |
|---|---|---|---|
| font-size | `30px` | `30px` | 741 |
| font-weight | `800` | `800` | 741 |
| margin | `0` | `0` | 741 |
| letter-spacing | `-0.03em` | `-0.03em` | 741 |
| line-height | `1.2` | `1.2` | 741 |
| color | `var(--toss-strong-text)` | `#191F28` | 741 |

---

## `.identity-bar` + descendants (lines 752–855)

### `.identity-bar` (752–765)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `--ib-accent` (local var) | `var(--color-provider-azure)` | `#0078D4` | 753 |
| position | `relative` | `relative` | 754 |
| display | `flex` | `flex` | 755 |
| align-items | `center` | `center` | 756 |
| gap | `32px` | `32px` | 757 |
| background | `var(--toss-card-bg)` | `#FFFFFF` | 758 |
| border-radius | `14px` | `14px` | 759 |
| padding | `16px 22px 16px 28px` | `16px 22px 16px 28px` | 760 |
| margin | `16px 0 20px` | `16px 0 20px` | 761 |
| box-shadow | `0 1px 2px rgba(17,24,39,0.04), 0 1px 3px rgba(17,24,39,0.04)` | (literal — no var) | 762 |
| overflow | `hidden` | `hidden` | 763 |
| flex-wrap | `wrap` | `wrap` | 764 |

> Context overrides (where `.identity-bar` margin-bottom is changed by ancestor):
> - `.admin-main .identity-bar { margin-bottom: 18px; }` — line 5076
> - `#admDetailBody .identity-bar { margin-bottom: 14px; }` — line 5077

### `.identity-bar::before` — brand accent stripe (766–772)

| property | literal | resolved | v15 line |
|---|---|---|---|
| content | `''` | `''` | 767 |
| position | `absolute` | `absolute` | 768 |
| inset | `0 auto 0 0` | `0 auto 0 0` | 769 |
| width | `4px` | `4px` | 770 |
| background | `var(--ib-accent)` | `#0078D4` (via `--color-provider-azure`) | 771 |

### `.identity-bar .ib-provider` (773–776)

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `flex` | `flex` | 774 |
| align-items | `center` | `center` | 774 |
| gap | `12px` | `12px` | 774 |
| flex-shrink | `0` | `0` | 775 |

### `.identity-bar .ib-provider-icon` (777–784)

| property | literal | resolved | v15 line |
|---|---|---|---|
| width | `38px` | `38px` | 778 |
| height | `38px` | `38px` | 778 |
| border-radius | `10px` | `10px` | 779 |
| display | `grid` | `grid` | 780 |
| place-items | `center` | `center` | 780 |
| background | `color-mix(in srgb, var(--ib-accent) 12%, transparent)` | `color-mix(in srgb, #0078D4 12%, transparent)` | 781 |
| color | `var(--ib-accent)` | `#0078D4` | 782 |
| flex-shrink | `0` | `0` | 783 |

### `.identity-bar .ib-provider-name` — provider name (785–790)

| property | literal | resolved | v15 line |
|---|---|---|---|
| font-size | `17px` | `17px` | 786 |
| font-weight | `700` | `700` | 786 |
| letter-spacing | `-0.025em` | `-0.025em` | 787 |
| color | `var(--toss-strong-text)` | `#191F28` | 788 |
| line-height | `1.2` | `1.2` | 789 |

### `.identity-bar .ib-provider-sub` — sub-label (791–797)

| property | literal | resolved | v15 line |
|---|---|---|---|
| font-size | `12px` | `12px` | 792 |
| font-weight | `600` | `600` | 793 |
| color | `var(--toss-weak-text)` | `#8B95A1` | 794 |
| letter-spacing | `0` | `0` | 795 |
| margin-top | `3px` | `3px` | 796 |

### `.identity-bar .ib-divider` — divider (798–804)

| property | literal | resolved | v15 line |
|---|---|---|---|
| width | `1px` | `1px` | 799 |
| align-self | `stretch` | `stretch` | 800 |
| background | `var(--toss-divider)` | `#EBEEF2` | 801 |
| margin | `4px 0` | `4px 0` | 802 |
| flex-shrink | `0` | `0` | 803 |

### `.identity-bar .ib-field` — ID field wrapper (805–808)

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `flex` | `flex` | 806 |
| flex-direction | `column` | `column` | 806 |
| gap | `4px` | `4px` | 806 |
| min-width | `0` | `0` | 807 |

### `.identity-bar .ib-k` — field key/label (809–814)

| property | literal | resolved | v15 line |
|---|---|---|---|
| font-size | `12px` | `12px` | 810 |
| font-weight | `600` | `600` | 811 |
| color | `var(--toss-weak-text)` | `#8B95A1` | 812 |
| letter-spacing | `0` | `0` | 813 |

### `.identity-bar .ib-id-row` — ID value + copy row (815–819)

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `inline-flex` | `inline-flex` | 816 |
| align-items | `center` | `center` | 817 |
| gap | `6px` | `6px` | 818 |

### `.identity-bar .ib-mono` — ID value (mono) (820–827)

| property | literal | resolved | v15 line |
|---|---|---|---|
| font-family | `'Geist Mono', monospace` | `'Geist Mono', monospace` | 821 |
| font-size | `13px` | `13px` | 822 |
| font-weight | `600` | `600` | 823 |
| color | `var(--toss-strong-text)` | `#191F28` | 824 |
| letter-spacing | `0` | `0` | 825 |
| line-height | `1.3` | `1.3` | 826 |

### `.identity-bar .ib-copy` — copy button (828–837)

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `inline-grid` | `inline-grid` | 829 |
| place-items | `center` | `center` | 829 |
| width | `24px` | `24px` | 830 |
| height | `24px` | `24px` | 830 |
| border-radius | `6px` | `6px` | 831 |
| background | `transparent` | `transparent` | 832 |
| border | `0` | `0` | 833 |
| color | `var(--toss-weak-text)` | `#8B95A1` | 834 |
| cursor | `pointer` | `pointer` | 835 |
| transition | `background 0.12s, color 0.12s` | `background 0.12s, color 0.12s` | 836 |

### `.identity-bar .ib-copy:hover` (838)

| property | literal | resolved | v15 line |
|---|---|---|---|
| background | `var(--toss-inner-bg)` | `#F7F8FA` | 838 |
| color | `var(--toss-strong-text)` | `#191F28` | 838 |

### `.identity-bar .ib-copy.copied` (839)

| property | literal | resolved | v15 line |
|---|---|---|---|
| color | `#14B96E` | `#14B96E` (literal — no var) | 839 |

### `.identity-bar .ib-spacer` (840)

| property | literal | resolved | v15 line |
|---|---|---|---|
| flex | `1` | `1` | 840 |

### `.identity-bar .ib-agent` — agent badge (841–854)

| property | literal | resolved | v15 line |
|---|---|---|---|
| display | `inline-flex` | `inline-flex` | 842 |
| align-items | `center` | `center` | 843 |
| gap | `7px` | `7px` | 844 |
| padding | `7px 13px` | `7px 13px` | 845 |
| border-radius | `999px` | `999px` | 846 |
| background | `color-mix(in srgb, var(--ib-accent) 10%, transparent)` | `color-mix(in srgb, #0078D4 10%, transparent)` | 847 |
| color | `var(--ib-accent)` | `#0078D4` | 848 |
| font-weight | `700` | `700` | 849 |
| font-size | `13px` | `13px` | 850 |
| letter-spacing | `-0.005em` | `-0.005em` | 851 |
| line-height | `1` | `1` | 852 |
| flex-shrink | `0` | `0` | 853 |

### `.identity-bar .ib-agent svg` — agent badge icon (855)

| property | literal | resolved | v15 line |
|---|---|---|---|
| width | `13px` | `13px` | 855 |
| height | `13px` | `13px` | 855 |

---

## Ambiguities / inherited / computed

- **`--ib-accent` is a per-instance accent.** Its base value is set on `.identity-bar`
  to `var(--color-provider-azure)` → `#0078D4` (line 753). The mockup comment
  (lines 748–751) states this stripe is brand-recolored per provider (Azure / AWS /
  GCP). Any provider variant that overrides `--ib-accent` (e.g. an `[data-provider]`
  or modifier class) would change every resolved `#0078D4` above. The default
  transcribed here is the literal Azure value; treat it as the default, not a fixed
  constant. (No such override was found within the `.identity-bar` block 752–855.)
- **`color-mix(...)` not pre-computed.** `.ib-provider-icon` background (line 781,
  12%) and `.ib-agent` background (line 847, 10%) use CSS `color-mix`. Resolving only
  the `var(--ib-accent)` → `#0078D4` substitution; the final mixed RGBA is a
  browser-computed value and is intentionally NOT hand-calculated here (would be a
  guess). Implement with `color-mix` verbatim or compute at build time.
- **`.ib-copy.copied` color `#14B96E`** (line 839) is a hard-coded literal — it does
  NOT map to any `--toss-*` or `--color-success` token; transcribed as-is.
- **Inherited typography not redeclared:** `.breadcrumb` and `.page-header` declare no
  `font-family`; they inherit from ancestors. The effective inherited stack is the
  `html, body` rule at **line 572**:
  `'Geist', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', sans-serif`
  — this OVERRIDES `--font-sans` (line 364) by cascade order and does NOT include
  `'Malgun Gothic'` or `system-ui`. But the inline body style at **line 5168**
  (`font-family: Geist`) wins the cascade, so the EFFECTIVE inherited family is just
  `Geist` — the line-572 stack is the fallback chain. `.ib-mono` is the only chrome
  rule that sets its own `font-family`. No `font-family` is declared on `.page-title`,
  `.ib-provider-name`, `.ib-provider-sub`, `.ib-k`, or `.ib-agent` — all inherit
  `Geist` (inline body 5168; the line-572 stack is the fallback).
- **No `border`** is declared on `.identity-bar` (only the `::before` 4px accent
  stripe + box-shadow at line 762). The card edge is shadow-only, not a border.
- **Context margin override:** `.identity-bar`'s `margin: 16px 0 20px` (line 761) is
  overridden to `margin-bottom: 18px` under `.admin-main` (line 5076) and `14px`
  under `#admDetailBody` (line 5077). Outside those ancestors the literal line-761
  value applies.
