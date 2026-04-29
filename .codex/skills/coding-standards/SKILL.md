---
name: coding-standards
description: Repository orientation for PII Agent implementation work. Use before coding or reviewing to understand the current directory layout, import boundaries, core reference documents, and which specialized skill owns detailed coding, UI, API, or performance rules.
---

# PII Agent Repository Orientation

This skill is a repo map, not the source of detailed rules. Use it to decide which path, document, or specialized skill to read next. If this file disagrees with `AGENTS.md`, `CLAUDE.md`, `DESIGN.md`, ADRs, or `docs/api/boundaries.md`, the more specific document wins and this skill should be updated.

## Current Layout

```text
app/                                      Next.js App Router entrypoints
app/components/ui/                       Shared UI primitives
app/components/features/                 Reusable domain UI components
app/hooks/                               Client hooks such as useModal and useApiMutation
app/lib/api/                             CSR data helpers that call internal Next routes
app/integration/                         Mounted integration app pages and v1 route tree
app/integration/api/v1/**/route.ts       Next route handlers for the integration API
app/api/_lib/                            Shared route helpers, ProblemDetails, withV1
lib/bff/                                 Server-only typed BFF client, HTTP adapter, mock adapter
lib/bff/mock/                            Mock BFF domain implementations
lib/constants/                           Shared constants and labels
lib/types/                               Shared TypeScript types
lib/utils/                               Shared utilities
lib/theme.ts                             Theme tokens and class helpers
DESIGN.md                                Design system contract and component inventory
docs/api/boundaries.md                   CSR, SSR, and route import boundaries
docs/adr/                                Architecture decisions
```

## Import Boundaries

- Use `@/` absolute imports for new cross-directory imports.
- Existing sibling imports and local barrel exports may still use relative paths; match the local pattern only when keeping edits tightly scoped.
- CSR components under `app/components/**` and `app/integration/**/_components/**` use `@/app/lib/api/*` and never import `@/lib/bff/*`.
- Server Components and `app/integration/api/v1/**/route.ts` handlers use `@/lib/bff/client`.
- Do not import `@/lib/api-client/*`; it was removed by ADR-011 and is blocked by ESLint.

Read `docs/api/boundaries.md` before touching data fetching, route handlers, or BFF access.

## UI Work

- Read `DESIGN.md` before implementing or reviewing UI. Treat it as the design system contract.
- Use `frontend-design` for visual or layout work.
- Use `lib/theme.ts` tokens and existing `app/components/ui` primitives. Raw Tailwind color classes are blocked for new edits; do not copy legacy raw-color patterns.
- If `DESIGN.md`, `frontend-design`, and `lib/theme.ts` disagree, prefer `DESIGN.md` for product/design intent and update the stale skill or token source in the same PR when in scope.

## API And Errors

- ADR-011 is the current BFF architecture: route handlers and Server Components call the typed `bff` client from `@/lib/bff/client`.
- ADR-008 is the current CSR error handling model: browser code should go through `fetchJson` or helpers built on it, and UI branches on normalized `AppError.code`.
- API timestamp fields stay JSON strings in DTOs. Convert to local display formats only at the rendering boundary.

## State And Hooks

- Prefer existing hooks before adding local state machinery: `useModal`, `useApiMutation`, `useApiAction`, polling hooks, and `useAbortableEffect`.
- Direct `try/catch` is valid inside low-level utilities, route adapters, and shared hooks that normalize errors. In UI event flows, prefer the existing mutation and fetch helpers.
- When modal state carries data or has multiple variants, prefer a discriminated union or the existing modal hook pattern.

## Rule Sources

- Hard repo rules: `AGENTS.md` and `CLAUDE.md`
- UI system: `DESIGN.md`, `lib/theme.ts`, and `frontend-design`
- Frontend anti-patterns: `anti-patterns`
- React and Next.js performance: `vercel-react-best-practices`
- API boundaries: `docs/api/boundaries.md` and ADR-011
- CSR errors: ADR-008, `lib/fetch-json.ts`, and `lib/errors.ts`
- Contract validation: `.claude/skills/shared/CONTRACT_VALIDATION.md`
