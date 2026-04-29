# Project Structure Checker

> In `/team-dev`, the `code-reviewer` agent includes this lens.

Review file placement, naming, and import-boundary consistency against the
current repository layout. Use `coding-standards` as the source of truth if
this file drifts.

## Current Layout

```text
app/                                      Next.js App Router entrypoints
app/components/ui/                       Shared UI primitives
app/components/features/                 Reusable domain UI components
app/hooks/                               Client hooks
app/lib/api/                             CSR data helpers
app/integration/                         Mounted integration app pages
app/integration/api/v1/**/route.ts       Next route handlers
app/api/_lib/                            Shared route helpers
lib/bff/                                 Server-only typed BFF client and adapters
lib/constants/                           Shared constants and labels
lib/types/                               Shared TypeScript types
lib/utils/                               Shared utilities
lib/theme.ts                             Theme tokens and class helpers
```

## Review Items

1. File placement
   - Shared UI primitives live under `app/components/ui/`.
   - Reusable domain components live under `app/components/features/`.
   - Route-local UI may live near the route in an established `_components`
     folder.
   - Shared types live under `lib/types/`, unless an existing nearby domain
     type location is more specific.

2. Naming
   - Components use PascalCase file names.
   - Hooks and utilities use camelCase file names.

3. Boundary consistency
   - CSR components use `@/app/lib/api/*` for data helpers.
   - Server Components and route handlers use `@/lib/bff/client`.
   - Do not introduce imports that violate `docs/api/boundaries.md`.

## Output

Report only concrete risks with file paths and evidence. Do not flag unrelated
legacy structure unless the current diff depends on it unsafely or makes it
worse.
