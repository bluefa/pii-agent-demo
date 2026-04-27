---
name: pii-agent-design
description: Use this skill to generate well-branded interfaces and assets for PII Agent (bluefa/pii-agent-demo — a Korean, desktop-only admin console for managing Cloud Provider PII scanning integrations), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

Start with:
- `README.md` — product context, content fundamentals, visual foundations, iconography.
- `colors_and_type.css` — design tokens (CSS variables) and semantic utility classes. Load this first in any artifact.
- `assets/icons/` — cloud provider + service SVGs. Never redraw them; reference the SVGs directly.
- `preview/` — static cards showing each foundation in isolation.
- `ui_kits/admin/` — React UI kit replicating the admin console; useful as a component reference.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. Use Geist (via Google Fonts `@import`), `#0064FF` as the primary, and the `rounded-xl` / `shadow-sm` / `uppercase-small-gray-500` card pattern. All copy must be Korean with occasional English product/technical terms — professional, factual, terse. No emoji.

If working on production code (Next.js 16 + Tailwind v4 + React 19), read `lib/theme.ts` in the source repo and use its Tailwind-class tokens instead of hand-rolled CSS.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
