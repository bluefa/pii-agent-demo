---
name: pii-agent-demo
description: Visual identity for the PII Agent Demo enterprise admin console. Refined and information-dense; a single primary blue drives interaction; status colours map directly to operational states.
colors:
  primary:               "#0064FF"
  primary-hover:         "#0050D6"
  primary-light:         "#E8F1FF"
  primary-accent:        "#4F46E5"
  success:               "#45CB85"
  success-dark:          "#2A7D52"
  error:                 "#EF4444"
  error-dark:            "#991B1B"
  warning:               "#F97316"
  warning-dark:          "#9A3412"
  pending:               "#9CA3AF"
  info:                  "#3B82F6"
  text-primary:          "#111827"
  text-secondary:        "#374151"
  text-tertiary:         "#6B7280"
  text-quaternary:       "#9CA3AF"
  text-inverse:          "#FFFFFF"
  surface-primary:       "#FFFFFF"
  surface-secondary:     "#F9FAFB"
  surface-tertiary:      "#F3F4F6"
  border-light:           "#F3F4F6"
  border-default:        "#E5E7EB"
  border-strong:         "#D1D5DB"
  border-emphasis:       "#6B7280"
  provider-aws:          "#FF9900"
  provider-azure:        "#0078D4"
  provider-gcp:          "#4285F4"
  provider-idc:          "#374151"
  provider-sdu:          "#9333EA"
  surface-page:          "#F2F4F6"
  row-hover:             "#F6F3FF"
  type-install:          "#027A48"
  type-delete:           "#B42318"
  type-custom:           "#6941C6"
  text-strong-toss:      "#191F28"
  text-medium-toss:      "#4E5968"
  text-weak-toss:        "#8B95A1"
  text-faint-toss:       "#B0B8C1"
typography:
  page-title:
    fontFamily: Geist
    fontSize: 30px
    fontWeight: 800
    letterSpacing: -0.03em
    lineHeight: 1.2
  page-subtitle:
    fontFamily: Geist
    fontSize: 13.5px
    fontWeight: 400
  page-breadcrumb:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: 500
  card-title:
    deprecated: true
    migrate-to: card-eyebrow
    fontFamily: Geist
    fontSize: 14px
    fontWeight: 600
    letterSpacing: 0.05em
  card-eyebrow:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: 700
    letterSpacing: 0.02em
    role: small uppercase header above a card display title
  card-display-title:
    fontFamily: Geist
    fontSize: 26px
    fontWeight: 800
    letterSpacing: -0.045em
    lineHeight: 1.2
  card-subtitle:
    fontFamily: Geist
    fontSize: 13.5px
    fontWeight: 500
    lineHeight: 1.55
    color: text-tertiary
  page-meta-key:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: 500
    color: text-tertiary
  page-meta-value:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: 600
    letterSpacing: -0.01em
    color: text-primary
  type-display:    28px
  type-h1:         22px
  type-h2:         20px
  type-h3:         18px
  type-body:       15px
  type-body-sm:    14px
  type-caption:    13px
  type-label:      12px
  type-micro:      11px
rounded:
  sm:           6px
  md:           8px
  lg:           12px
  xl:           12px
  card-display: 20px
  full:         9999px
spacing:
  card-padding: 24px
  section-gap:  24px
  form-gap:     20px
  button-gap:   12px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor:       "{colors.text-inverse}"
    rounded:         "{rounded.md}"
    padding:         12px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-tertiary}"
    textColor:       "{colors.text-secondary}"
    rounded:         "{rounded.md}"
    padding:         12px
  card-default:
    backgroundColor: "{colors.surface-primary}"
    rounded:         "{rounded.xl}"
    padding:         24px
---

## Overview

PII Agent Demo is an internal admin console for managing PII detection across cloud providers (AWS, Azure, GCP, IDC, SDU). The visual identity is intentionally **refined and utilitarian** — neutral surfaces, a single primary blue (`#0064FF`) for interaction, and status colours that map directly to operational states (running, warning, error, idle, info).

This is not a marketing surface. Information density and clarity outweigh decorative motion. Operators use this product for hours at a time, often while diagnosing live infrastructure; the design must let them scan dense tables, read long status traces, and act on the result without friction.

The token surface is the canonical source of truth. The Tailwind class strings in `lib/theme.ts` and the CSS variables in `app/globals.css` are derived runtime expressions — when this file and those files disagree, this file is right.

## Colors

The palette has four roles: brand, status, neutral (text/surface/border), and provider.

### Brand

- **`{colors.primary}`** (`#0064FF`) — the only colour authorised to drive primary actions, focus rings, and active states. Every "do this" affordance reads in this blue.
- **`{colors.primary-hover}`** (`#0050D6`) — the hover/pressed shade. The contrast step is intentionally small; the affordance is the elevation/cursor change, not the colour shift.
- **`{colors.primary-light}`** (`#E8F1FF`) — selected/hovered rows, badge fills, and information-blue tinted surfaces. It carries two roles, and the foreground rule differs by role:
  - **As a badge or chip fill** — step tags, numbered markers, a row under hover or focus — the label is `#0050D6` (`primaryColors.textOnLight`). `{colors.primary}` is not available here: `#0064FF` measures 4.33:1 on the tint, under AA for the small text these badges carry, where `#0050D6` gives 5.92:1.
  - **As a panel surface** — help cards, callouts — the text is neutral, but only down to `{colors.text-secondary}` (9.06:1). `{colors.text-tertiary}` is calibrated against white: it drops from 4.83:1 to 4.25:1 on the tint and fails AA there.
- **`{colors.primary-accent}`** (`#4F46E5`) — appears only as the right-hand stop of the brand gradient on the top navigation. Do not use it as a standalone fill.
- **`{colors.row-hover}`** (`#F6F3FF`) — the hovered-row tint on dense operational tables. It is deliberately not `{colors.primary-light}`: a row that tints toward the interaction blue reads as *selected*, and these rows are not selectable — the hover only says "this is the row under your cursor". The value is two steps lighter than the app's own `#F3EEFF` card hover for a measured reason: the quiet text tier those tables use (`#667085`) reads 4.379:1 on `#F3EEFF` — under AA, on three separate runs of text — and 4.544:1 here. Anything placed on this tint is re-measured against it, never against white.

### Status

Status colours pair a base value with a darker readable variant. Use the dark variant whenever the colour drives a text label.

| Token | Value | Use |
|-------|-------|-----|
| `{colors.success}` | `#45CB85` | Backgrounds and large display only. **Fails WCAG AA on white (2.07:1)** for body text. |
| `{colors.success-dark}` | `#2A7D52` | Body text and small status labels (5.06:1 on white, AA pass). |
| `{colors.error}` | `#EF4444` | Error backgrounds, dot indicators. |
| `{colors.error-dark}` | `#991B1B` | Error body text. |
| `{colors.warning}` | `#F97316` | Warning indicators (in-progress states are intentionally orange in this product). |
| `{colors.warning-dark}` | `#9A3412` | Warning body text. |
| `{colors.pending}` | `#9CA3AF` | Pending / waiting state — neutral grey, not red. |
| `{colors.info}` | `#3B82F6` | Informational dots and chips. |

### Neutral

Surfaces, borders, and text together carry most of the page. The progression follows Tailwind's slate ramp at `gray-50 / 100 / 200 / 300 / 400 / 500 / 700 / 900` — don't reach for in-between shades. Five surface levels (white, `surface-secondary`, `surface-tertiary`) and three border weights (`light`, `default`, `strong`) cover every layout pattern this product needs.

The four text tiers are not four ranks of text. `{colors.text-quaternary}` (`#9CA3AF`) measures 2.54:1 on white — under AA's 4.5:1 for text, and under WCAG 1.4.11's 3:1 for a meaningful graphic — so it is reserved for decoration: empty-state glyphs, the icon inside a labelled input, a `·` between meta groups. Anything a reader would miss if it vanished belongs on `{colors.text-tertiary}` (`#6B7280`, 4.83:1 on white, 4.63:1 on gray-50), which is the quietest tier text may use. That includes `—` placeholders in table cells, timestamps, counters, and the unselected half of a toggle — an unselected option is still an operable control, not an inactive one.

`border-emphasis` (`#6B7280`) is the exception, and it is not a fourth layout weight: it exists because `light` / `default` / `strong` all fail WCAG 1.4.11 on light grounds (`strong` manages 1.4:1), so none of them may carry meaning on their own. Use it only where the border *is* the state indicator — the selected page in a paginator, for instance — never to separate.

### Provider

Each cloud provider has a single brand colour used in icons, the left border of provider-scoped cards, and pill backgrounds at low opacity. Do not introduce gradients or alternative shades per provider here — those belong in `lib/theme.ts`'s `providerColors[*].gradient` if the prototype needs them.

One exception, and it is narrow: a provider's **actual logotype** may carry its vendor's own multi-colour mark (owner, 2026-08-14) — AWS's two-tone wordmark, Azure's three blues, Google's four. That is reproduction of someone else's trademark, not a palette choice, which is also why it is exempt from contrast rules (WCAG 1.4.11 excludes logotypes). It is opt-in per consumer via `ProviderGlyph`'s `tone="brand"`; every other consumer stays monochrome and inherits its column's colour. The single-colour rule above still governs everything that is *ours* — borders, pill fills, tints — and IDC and SDU have no brand, so they have no branded form at all.

### Pipeline type

Three colours name what an infra job *does to* infrastructure. Like `jobKindTag`'s red DESTROY, they deliberately reuse a status hue for a non-status meaning; unlike it, they sit in a dense list directly beside the status word, which is what the rest of this section is about.

| Token | Value | Type |
|-------|-------|------|
| `{colors.type-install}` | `#027A48` | INSTALL — adds |
| `{colors.type-delete}` | `#B42318` | DELETE — removes |
| `{colors.type-custom}` | `#6941C6` | CUSTOM — operator-composed |

These live in the pipeline console's isolated `--pl-*` palette (`app/globals.css`), and inside it install-green and delete-red are byte-identical to that palette's own `--pl-ok-text` and `--pl-err-text` — the greens and reds the 완료 and 실패 status words wear one column over. That is a collision by construction, and the rule that makes it safe is a **channel split**: type owns the *glyph*, status owns the *word*. A 20px shape and a 12px label do not compete for the same reading even in the same hue, and the pairing operators actually need to distinguish — a delete job that failed — reads as a red trash glyph beside the red word 실패, which is two facts rather than one said twice.

The split is the whole licence, so it is also the limit **wherever a type sits next to a status**. Colouring the type *label* there was tried and pulled (owner, 2026-08-14): with glyph and word both tinted, type spoke on three channels — shape, word, colour — and a screen where red means two things had no second channel left to separate them. On those surfaces, colour goes on the mark, not the text.

One surface is deliberately outside that rule: the run-detail header's combined `AWS 삭제` tag (`detailImprovedStyles.header.typeTagDelete`) tints the **text** red and carries no glyph, because a destructive run must not read neutral in the one place an operator confirms what they are about to stop. It gets away with it for the reason the dashboard could not — the header is not a row in a list, so there is no adjacent status word for the red to be confused with. If that header ever gains a type glyph, the tint moves to it and this exception ends.

Custom's violet sits outside the status ramp on purpose: there is no status hue for "an operator built this by hand", so borrowing one would assert a meaning the value does not have.

## Typography

Typography spans page chrome, card surfaces, page-meta strips, and a global 9-stop type scale (`type-display`, `type-h1`, `type-h2`, `type-h3`, `type-body`, `type-body-sm`, `type-caption`, `type-label`, `type-micro`).

- The page-chrome scale (`page-title`, `page-subtitle`, `page-breadcrumb`) and the card-surface scale (`card-eyebrow`, `card-display-title`, `card-subtitle`) are the named display tokens. `card-title` remains as a deprecated alias for `card-eyebrow` for one wave.
- The page-meta strip (`page-meta-key`, `page-meta-value`) is the horizontal kv pair used in page headers.
- `fontFamily` is `Geist`, loaded via `next/font/google` in `app/layout.tsx` and aliased to `--font-geist-sans`. The system stack (`-apple-system`, `BlinkMacSystemFont`, `'Apple SD Gothic Neo'`, `'Pretendard'`, `'Malgun Gothic'`, `system-ui`, `sans-serif`) is the fallback.
- Body text consumes the type scale via `lib/theme.ts` class-string exports (`pageMetaStyles.value`, `cardStyles.subtitle`, …) when the page uses Toss-flavored surfaces. Tailwind's default `text-{xs|sm|base|lg|xl}` scale remains valid for non-Toss pages.
- `letter-spacing: -0.018em` is **not** a global body default in this phase — it appears only in `pageMetaStyles.value` (-0.01em) and display headings (`page-title` -0.03em, `card-display-title` -0.045em).
- Numerals in tables use `tabular-nums` (see `numericFeatures` in `lib/theme.ts`) to keep step numbers and counts aligned.

The stepper component (`app/components/features/process-status/ProcessProgressBar.tsx` and the `motion/` directory beside it) is intentionally excluded from this token set. Its current visual is preferred over the prototype's static stepper.

## Layout

Spacing comes in four canonical steps:

- `{spacing.card-padding}` (24px) — content padding inside any card or panel.
- `{spacing.section-gap}` (24px) — vertical rhythm between sibling sections on a page.
- `{spacing.form-gap}` (20px) — vertical rhythm between fields in a form.
- `{spacing.button-gap}` (12px) — horizontal gap between buttons in a button row.

Don't introduce a new spacing value to compose pages. If a screen needs more breathing room, choose between these four; if none fit, add a fifth here first.

## Shapes

Five rounded values cover the entire surface:

- `{rounded.sm}` (6px) — toolbar buttons and other tight inline controls.
- `{rounded.md}` (8px) — primary, secondary, and danger buttons.
- `{rounded.lg}` (12px) — alternate button shape used in compact toolbars.
- `{rounded.xl}` (12px in Tailwind v4 via `--radius-xl`) — cards, panels, and modal containers.
- `{rounded.full}` (9999px) — pill badges only.

## Components

Phase 0 names the four components most consumers compose against. Variants are expressed as separate component entries (per the DESIGN.md spec).

- `{components.button-primary}` — the only colour authorised for the primary call to action on a page. Pair with `{components.button-primary-hover}` on hover/pressed.
- `{components.button-secondary}` — neutral grey fill for cancel and tertiary actions.
- `{components.card-default}` — the standard surface for grouped content. Keep the inside scrollable when content overflows; do not nest cards.

Status badges, modals, inputs, and tables consume the same colour tokens but are not yet declared as `components` entries. Phase 2a converts them as the migration progresses.

## Do's and Don'ts

- **Do** use `{colors.success-dark}` for success body text on light surfaces. The base `{colors.success}` (`#45CB85`, 2.07:1 on white) is reserved for backgrounds and large display, and does **not** meet WCAG AA for body text.
- **Do** reuse the components in `app/components/ui/` (`Button`, `Card`, `Badge`, `Modal`, `Table`, `LoadingSpinner`, `Tooltip`). They already consume the tokens declared here.
- **Do** keep status colour assignments stable: green = success/connected, orange = in-progress/AWS-domain, red = error, grey = pending, blue = info.
- **Do** read that assignment as being about *indicators*, not about every surface that names a state. The pipeline dashboard's status column is the standing exception (owner, 2026-08-14/15): there a run in flight is **blue**, because the word and the progress strip's live segment are two places in one row saying "right here" and they must say it in one colour; a cancelled run is **amber**; grey is left to "not started yet" alone. Orange still means in-progress everywhere an indicator carries it. Extending this exception to another screen needs the same argument — two channels in one row that would otherwise disagree — not a preference.
- **Don't** introduce a new colour by adding a Tailwind utility class somewhere in `app/`. Add the hex to `colors:` in this file first; the runtime layer derives from it.
- **Don't** pick a font face per component. Body text uses the system stack declared in `app/globals.css`; a deviation requires a typography token here.
- **Don't** mix raw colour Tailwind classes (`bg-blue-600`, `text-red-500`) with these tokens. The hard rule lives in `CLAUDE.md` ⛔ #4 and is enforced at edit time by `.claude/hooks/post-edit-grep.sh`.
- **Don't** invent token names ad hoc in TSX. If the runtime needs a colour and no token here matches, stop, propose the addition to this file, then add the corresponding entry to `lib/theme.ts`.
