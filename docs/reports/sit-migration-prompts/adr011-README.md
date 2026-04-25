# ADR-011 Implementation Plan — Typed BFF Client Consolidation

> ADR: [docs/adr/011-typed-bff-client-consolidation.md](../../adr/011-typed-bff-client-consolidation.md)
> Analysis: [docs/reports/api-client-pattern-review.md](../api-client-pattern-review.md)
> Strategy: Option B-1 (typed legacy upstream shape)

## Spec inventory

| Key | Phase | Title | Effort | Depends on | Parallelizable with |
|---|---|---|---|---|---|
| `adr011-01` | 0 + 1 | Inventory + boundary rule update | M | — | — |
| `adr011-02` | 2 | BffClient types expanded for all domains | L | 01 | — |
| `adr011-03` | 3 + 4 + 5 | Group A: targetSources + projects + users | XL | 02 | 04, 05, 06 |
| `adr011-04` | 3 + 4 + 5 | Group B: aws + azure + gcp (composite-route heavy) | XL | 02 | 03, 05, 06 |
| `adr011-05` | 3 + 4 + 5 | Group C: services + dashboard + dev + scan + taskAdmin | L | 02 | 03, 04, 06 |
| `adr011-06` | 3 + 4 + 5 | Group D: confirm (Issue #222 surface) | XL | 02 | 03, 04, 05 |
| `adr011-07` | 6 | Final cleanup + naming + ESLint lock | L | 03, 04, 05, 06 | — |

## Dependency graph

```
                   ┌────────────────────────────┐
                   │ adr011-01: Inventory+Rules │
                   │   (Phase 0+1)              │
                   └──────────────┬─────────────┘
                                  │
                   ┌──────────────▼─────────────┐
                   │ adr011-02: BffClient types │
                   │   (Phase 2)                │
                   └──────────────┬─────────────┘
                                  │
        ┌─────────────┬───────────┼───────────┬─────────────┐
        ▼             ▼           ▼           ▼             ▼
  ┌──────────┐  ┌──────────┐ ┌─────────┐ ┌──────────┐
  │ adr011-03│  │ adr011-04│ │adr011-05│ │ adr011-06│   (parallel — 4 sessions)
  │ Group A  │  │ Group B  │ │ Group C │ │ Group D  │
  │          │  │ +composite│ │         │ │ +Issue#222│
  └──────────┘  └──────────┘ └─────────┘ └──────────┘
        └─────────────┴───────────┬───────────┴─────────────┘
                                  ▼
                   ┌────────────────────────────┐
                   │ adr011-07: Cleanup +       │
                   │ naming + ESLint lock       │
                   │   (Phase 6)                │
                   └────────────────────────────┘
```

## Wave plan (suggested session distribution)

| Wave | Specs | Sessions | Notes |
|---|---|---|---|
| **W1 — Foundation** | 01, 02 | 1 sequential session for each | 01 produces the inventory the Wave 3 implementers need |
| **W2 — Implementation** | 03, 04, 05, 06 | 4 parallel sessions | One session per group; do NOT serialize |
| **W3 — Cleanup** | 07 | 1 session | Runs only after all four W2 PRs merge |

Total: 6 sessions across 3 waves. W2 wall-clock = max of the 4 group sessions, not their sum.

## Conventions for all specs

- Every spec follows the [`/wave-task`](../../../.claude/skills/wave-task/SKILL.md) pipeline. Invoke as `/wave-task adr011-NN`.
- Worktree branch prefix: `refactor/adr011-NN-<short-name>`. ADR-011 work is refactor across the board.
- Each PR description must reference ADR-011 + the specific spec.
- `/codex-review` is **mandatory** for specs 02, 04, 06, 07 (the highest-risk ones). Optional but recommended elsewhere.
- All work happens after the boundary rule update in spec 01 ships — otherwise the first route migration would violate the documented import rules.

## Cross-cutting decisions (locked at spec 01 time)

These are decided once in spec 01 and re-applied identically in all later specs. Do not relitigate:

1. **Canonical contract**: B-1 (typed legacy upstream shape). `BffClient` methods return the same shape that `_lib/transform.ts` and `extractConfirmedIntegration` currently consume. v1 transform stays in route handlers.
2. **mockBff vs mockClient coexistence**: Old `mockClient` stays operational until spec 07 deletes it. Per-group specs add `mockBff.<domain>` *alongside* the existing mock, then point routes to `bff.x.y()`. The old mock entries become dead but compile-clean code.
3. **mock-only auth/permission logic**: `lib/api-client/mock/*.ts`'s `authorize()` helpers (current user check, role check, project ownership) do **not** move into `mockBff`. The BFF doesn't do auth; mockBff matches that contract. If a test scenario relied on mock-side auth, it must use a separate test helper. This is captured per group in each spec's "Open decisions" section so each group resolves it for its own domains.
4. **Naming**: keep `Issue222*` prefix in `lib/bff/types.ts` initially (re-export from `lib/issue-222-approval.ts` if convenient). The rename to clean domain names happens in spec 07.
5. **Composite routes**: under B-1, composite routes (e.g. Azure check-installation calling DB + VM) keep their composition in `route.ts`. Do NOT push composition into `httpBff` — that's B-2, deferred.

## Audit gates

Each spec must pass before merge:

- `npx tsc --noEmit`
- `npm run lint`
- `npm run test:run` (existing tests must continue to pass; new tests added per spec)
- `npm run build`
- `bash scripts/contract-check.sh --mode diff --base origin/main --head HEAD`
- `/codex-review` (mandatory for 02/04/06/07)

## How to start

```
/wave-task adr011-01
```

After 01 merges:
```
/wave-task adr011-02
```

After 02 merges, distribute 03-06 across 4 sessions (can be sequential if only one developer/agent available; can be parallel if multiple). After all four merge:
```
/wave-task adr011-07
```
