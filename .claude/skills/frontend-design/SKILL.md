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

## Status Copy

Owner rules (2026-09-11) for status text on admin screens.

- One sentence carries one fact. Never join two clauses with an em dash (—) or a hyphen in UI text. A second fact is a second sentence.
- No implied-context phrasing such as "~을 기준으로 등록됩니다" or "처리 결과를 기준으로 확정합니다". Assume the admin reading it cannot infer the rest from context. Name the current state, then say what has to happen next and who does it.
- A disabled control always carries its reason in the same plain form, as a tooltip or adjacent text. A greyed-out button with no stated reason is not an acceptable state.
- State is text, not colour. Do not express a state with a coloured dot or marker alone beside a headline or label. Use a text tag whose words name the state exactly ("미등록", "등록됨", "다시 입력 필요"). Colour may accompany the words, never replace them.

Rejected example: "아직 승인 요청이 없습니다 — 승인된 리소스를 기준으로 등록됩니다."
Write instead: "연동 요청이 없습니다. 서비스가 연동 요청을 보내고 관리자가 승인하면 확정 정보를 입력할 수 있습니다."

## Review Checklist

- `DESIGN.md` was read and the implementation follows its component/tokens direction.
- Existing UI primitives were reused where appropriate.
- No new raw color class was introduced in feature code.
- Text fits its container at the expected desktop sizes.
- States are covered: loading, empty, error, disabled, selected, hover/focus, and submitted/success where relevant.
- Any deliberate divergence from `DESIGN.md` or a mockup is explained in the PR or final report.
