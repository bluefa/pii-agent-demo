---
name: frontend-design
description: Create or review PII Agent frontend UI. Use for React components, pages, dashboards, styling, layout, mockup implementation, or visual polish. Always read DESIGN.md first and follow the repo design system before writing UI code.
license: Complete terms in LICENSE.txt
---

# Frontend Design

Use this skill for UI implementation and UI review in this repository.

## Before Coding

1. Read `DESIGN.md`. Treat it as the design system contract for product surfaces, component inventory, token expectations, and design decisions.
2. Read the nearest existing component in the target directory to match local structure and import style.
3. Check `lib/theme.ts` and `app/components/ui/` for existing tokens and primitives before adding new styling.

If `DESIGN.md`, this skill, and `lib/theme.ts` disagree, prefer `DESIGN.md` for product/design intent. If the code tokens are stale, update them or call out the gap instead of silently inventing a local style.

## Project Direction

- The app is an enterprise operations UI. Prefer a refined, utilitarian interface with clear hierarchy, dense but scannable information, predictable controls, and restrained decoration.
- Do not build marketing-style heroes, oversized editorial sections, decorative card stacks, or generic AI-looking gradients for app workflows.
- Desktop is the default target unless the user explicitly asks for responsive/mobile behavior.
- Preserve mockup patterns when implementing from a reference: tabs vs segmented controls, underline vs pill, dot vs filled circle, card boundaries, status placement, and copy density all matter.

## Design System Rules

- Use `DESIGN.md` and `lib/theme.ts` for colors, surfaces, and component styling.
- Use existing `app/components/ui` primitives before creating a new primitive.
- Raw Tailwind color classes are forbidden for new feature code. Use tokens such as `statusColors`, `textColors`, `bgColors`, `borderColors`, `buttonStyles`, `cardStyles`, `modalStyles`, `getButtonClass()`, and `getInputClass()`.
- Layout classes such as `flex`, `grid`, `gap-*`, `p-*`, `m-*`, sizing, overflow, and typography scale classes are allowed when they do not encode color decisions.
- Light surfaces such as cards, panels, editors, and modals should declare background and text tokens at the root. Do not rely on global inheritance for visible surface colors.
- Do not add standalone CSS files. Use Tailwind and existing tokens.

## Interaction And State

- Use familiar UI controls: icon buttons for tool actions, segmented controls for mutually exclusive modes, toggles or checkboxes for boolean settings, menus for option sets, tabs for views, and explicit buttons for commands.
- Use stable dimensions for fixed-format controls, tables, board columns, counters, tiles, toolbars, and icon buttons so hover states and dynamic labels do not shift layout.
- For editor or contenteditable surfaces, do not infer dirty state from raw HTML string comparison. Track whether the user actually typed as a separate signal.
- Block click-navigation on inline editor links and surface the URL so users can inspect it.

## Review Checklist

- `DESIGN.md` was read and the implementation follows its component/tokens direction.
- Existing UI primitives were reused where appropriate.
- No new raw color class was introduced in feature code.
- Text fits its container at the expected desktop sizes.
- States are covered: loading, empty, error, disabled, selected, hover/focus, and submitted/success where relevant.
- Any deliberate divergence from `DESIGN.md` or a mockup is explained in the PR or final report.
