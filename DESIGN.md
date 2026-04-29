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
  provider-aws:          "#FF9900"
  provider-azure:        "#0078D4"
  provider-gcp:          "#4285F4"
  provider-idc:          "#374151"
  provider-sdu:          "#9333EA"
typography:
  page-title:
    fontFamily: system-ui
    fontSize: 24px
    fontWeight: 600
    letterSpacing: -0.02em
  page-subtitle:
    fontFamily: system-ui
    fontSize: 13.5px
    fontWeight: 400
  page-breadcrumb:
    fontFamily: system-ui
    fontSize: 12.5px
    fontWeight: 400
  card-title:
    fontFamily: system-ui
    fontSize: 14px
    fontWeight: 600
    letterSpacing: 0.05em
rounded:
  sm:   6px
  md:   8px
  lg:   12px
  xl:   12px
  full: 9999px
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
- **`{colors.primary-light}`** (`#E8F1FF`) — used for selected-row backgrounds and information-blue tinted surfaces. Keep the foreground at `{colors.text-primary}`.
- **`{colors.primary-accent}`** (`#4F46E5`) — appears only as the right-hand stop of the brand gradient on the top navigation. Do not use it as a standalone fill.

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

### Provider

Each cloud provider has a single brand colour used in icons, the left border of provider-scoped cards, and pill backgrounds at low opacity. Do not introduce gradients or alternative shades per provider here — those belong in `lib/theme.ts`'s `providerColors[*].gradient` if the prototype needs them.

## Typography

Typography is intentionally minimal:

- The page-chrome scale (`page-title`, `page-subtitle`, `page-breadcrumb`, `card-title`) is the only set of named display tokens.
- Body text rides on Tailwind's default `text-{xs|sm|base|lg|xl}` scale via the system font stack declared in `app/globals.css`. **Do not introduce a custom font face per component**; if a screen needs a new typographic role, add a token here first.
- Numerals in tables use `tabular-nums` (see `numericFeatures` in `lib/theme.ts`) to keep step numbers and counts aligned.

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
- **Don't** introduce a new colour by adding a Tailwind utility class somewhere in `app/`. Add the hex to `colors:` in this file first; the runtime layer derives from it.
- **Don't** pick a font face per component. Body text uses the system stack declared in `app/globals.css`; a deviation requires a typography token here.
- **Don't** mix raw colour Tailwind classes (`bg-blue-600`, `text-red-500`) with these tokens. The hard rule lives in `CLAUDE.md` ⛔ #4 and is enforced at edit time by `.claude/hooks/post-edit-grep.sh`.
- **Don't** invent token names ad hoc in TSX. If the runtime needs a colour and no token here matches, stop, propose the addition to this file, then add the corresponding entry to `lib/theme.ts`.
