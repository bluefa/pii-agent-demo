---
name: anti-patterns
description: Frontend Clean Code anti-pattern catalog. Auto-applied during code writing and review.
---

# PII Agent Frontend Anti-Pattern Catalog

50 anti-patterns across 9 categories. Each item has a detail file at `rules/<ID>-<slug>.md` — this file is the index.

## When to invoke

- Automatic: before writing, modifying, or reviewing code
- Manual: when prioritizing refactor work

## Category summary

| # | Category | Count |
|---|----------|-------|
| A | Type Safety | 5 |
| B | Component Structure | 6 |
| C | State Management | 9 |
| D | Effects & Hooks | 6 |
| E | Rendering | 5 |
| F | Error Handling | 5 |
| G | Naming & Constants | 10 |
| H | UI Composition (Icons/Assets) | 3 |
| T | Testing | 1 |

Severity: 🔴 critical (block merge) · 🟡 important · 🟢 nice-to-have

Concrete evidence (file:line) from the current codebase → `docs/reports/frontend-anti-patterns-audit-2026-04-23.md`.

## Rule index

### A. Type Safety
- **A1** 🔴 Non-null assertion (`!`) — crashes when the type-system guess is wrong
- **A2** 🔴 Type assertion (`as`) — runtime validation belongs at the boundary
- **A3** 🟡 Destructuring API responses without a type guard
- **A4** 🟡 `@ts-ignore` / `@ts-expect-error` — prefer the latter with a reason
- **A5** 🔴 `any` — use `unknown` + guard, or a concrete type

### B. Component Structure
- **B1** 🔴 God component (300+ LOC)
- **B2** 🟡 10+ props
- **B3** 🟡 Per-provider component duplication (AWS/GCP/Azure/IDC)
- **B4** 🟢 Boolean prop flag explosion
- **B5** 🟢 Functions with 4+ parameters
- **B6** 🟡 Function doing get + validate + save

### C. State Management
- **C1** 🔴 Scattered form state (10+ `useState`) → `useReducer`
- **C2** 🔴 Server state in `useState` → React Query / SWR
- **C3** 🟡 Scattered modal state → discriminated union
- **C4** 🟡 Separate booleans for loading & error → state machine
- **C5** 🟡 Derived state stored as state
- **C6** 🟢 3+ consecutive `setState` in one handler
- **C7** 🟢 Missing functional updates when prior state matters
- **C8** 🟢 Missing lazy initializer in `useState`
- **C9** 🟡 Discriminated-union variants with inconsistent payload field names

### D. Effects & Hooks
- **D1** 🟡 Objects/arrays as direct `useEffect` deps
- **D2** 🟡 `mountedRef.current` overuse
- **D3** 🟡 `useEffect` replacing an event handler
- **D4** 🟡 Duplicated polling logic
- **D5** 🟢 Overuse of `useMemo` / `useCallback`
- **D6** 🟡 Oversized `useCallback` dep arrays

### E. Rendering
- **E1** 🟡 Array index as `key`
- **E2** 🟡 Inline style objects
- **E3** 🟡 Nested ternaries (3+ levels)
- **E4** 🟡 Long `&&` chains in conditional rendering
- **E5** 🟢 Building `className` with template literals (use `cn()`)

### F. Error Handling
- **F1** 🔴 Native `alert()`
- **F2** 🟡 `try/catch` silent swallow
- **F3** 🟡 Returning `null` instead of throwing
- **F4** 🟡 Manual `try/catch` (use `useApiMutation` / `fetchJson`)
- **F5** 🔴 Abort detection via `instanceof DOMException` — use `signal.aborted`

### G. Naming & Constants
- **G1** 🟡 Magic numbers
- **G2** 🟡 Duplicated constants
- **G3** 🟡 String-literal status comparisons (Primitive Obsession)
- **G4** 🟢 Non-verb or vague function names
- **G5** 🟢 Booleans without `is/has/should/can` prefix
- **G6** 🟢 Hardcoded error messages
- **G7** 🟡 Vague parameter names (`fn`, `cb`, `data`, `val`)
- **G8** 🟡 Inconsistent naming within a sibling cluster
- **G9** 🟢 Comments narrating past bugs or refactor history
- **G10** 🟡 Spec / wave / phase coordinates as identifier names (`Step4Row`, `Wave3Hook`)

### H. UI Composition
- **H1** 🔴 Inline SVG markup in feature components
- **H2** 🟡 Visual-based icon names
- **H3** 🟡 No shared icon barrel

### T. Testing
- **T1** 🔴 Exception-handling tests must cover atypical reject values

## How to use

### Read a rule in detail

Each entry above has a detail file containing severity, rationale, `❌ Bad` / `✅ Good` code examples, and related rules:

```
rules/A1-non-null-assertion.md
rules/C9-discriminated-union-payload-names.md
rules/G8-inconsistent-sibling-naming.md
```

### When writing code
- Scan this index; open the rule file for anything non-obvious.
- Lint-enforced rules block automatically.

### When reviewing code
- Cite items by number: "AP-A1 — non-null assertion".
- 🔴 items block merge.

### When prioritizing refactors
1. Start with 🔴 (critical) items.
2. When the same AP appears N places, fix them in one PR (avoid Shotgun Surgery).

## Auto-enforceable via lint

| AP | ESLint rule |
|----|-------------|
| A1 `!` | `@typescript-eslint/no-non-null-assertion` |
| A2 `as` | `@typescript-eslint/consistent-type-assertions` |
| A4 `@ts-ignore` | `@typescript-eslint/ban-ts-comment` |
| A5 `any` | `@typescript-eslint/no-explicit-any` |
| F1 `alert` | `no-alert` |
| E1 index key | `react/no-array-index-key` |
| relative import | `no-restricted-imports` |
| H1 inline svg | custom `no-restricted-syntax` matching `JSXElement[openingElement.name.name='svg']` outside `app/components/ui/icons/**` |

## API boundary anti-patterns (separate)

Confusion about BFF / CSR / SSR API boundaries is covered in `docs/api/boundaries.md`.

Core rules (post ADR-011, single pipeline):
1. **CSR components** import only from `@/app/lib/api/*` (never `@/lib/bff/*`)
2. **Server Components** import only from `@/lib/bff/client`
3. **Next.js Route Handlers** dispatch to `bff.method()` from `@/lib/bff/client`
4. **Never** import `@/lib/api-client/*` — that path was deleted in ADR-011 (`eslint.config.mjs` enforces this)
5. Never mix two boundaries in a single file

## Classic anti-pattern mapping

| Classic name | This catalog |
|--------------|--------------|
| God Object | B1, C1 |
| Primitive Obsession | G3 |
| Shotgun Surgery | B3, G1, G2 |
| Long Parameter List | B2, B5 |
| Data Clumps | C1, C3 |
| Feature Envy | (API boundary) |
| Duplicate Code | D4, B3, G2, G6, H1 |
| Vague Abstraction | G4, G7, G8, G10, H2 |
