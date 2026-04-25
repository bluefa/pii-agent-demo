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

## ⛔ Observable Behavior Invariants (DO NOT change during ADR-011 migration)

These four invariants are **non-negotiable** across specs 01-07. Every spec's acceptance criteria reference them. If the implementer cannot satisfy an invariant, the work stops and the spec is revised — *not* the invariant.

### I-1 — Upstream BFF call paths are unchanged

`${BFF_URL}/install/v1/...` URL strings, HTTP methods, query parameters, and request body shapes remain identical to what `lib/api-client/bff-client.ts` produces today. `httpBff.<domain>.<method>` is a **typed wrapper around the same wire request**.

Verification: `git diff` of removed `lib/api-client/bff-client.ts` lines vs added `lib/bff/http.ts` lines must show 1:1 path equivalence. Codex review (mandatory for specs 03-06) explicitly checks this.

### I-2 — Next.js public route URLs are unchanged

`/integration/api/v1/...` URLs, file locations of route handlers (`app/integration/api/v1/**/route.ts`), HTTP methods, and route handler exports (`GET`, `POST`, etc.) remain identical. **No route file is moved, renamed, deleted, or has its exported method names changed**.

Verification: `find app/integration/api/v1 -name "route.ts" | sort` produces identical output before and after each spec.

### I-3 — Route response wire shapes are unchanged (preserve GET/POST casing asymmetry)

The exact JSON body returned by each Next.js route handler — field names (snake_case vs camelCase), field presence, nested structure, array order — is preserved byte-for-byte.

This **explicitly preserves the current asymmetry**: `proxyGet` runs `camelCaseKeys`, `proxyPost/Put` is raw passthrough. CSR helpers in `app/lib/api/index.ts` depend on this asymmetry (e.g. `normalizeIssue222ApprovalRequestSummary` reads `target_source_id` from POST responses). Specs 03-06 MUST preserve it.

Resolving the asymmetry is a separate, post-migration concern. Do NOT attempt it here.

Verification: each group spec runs smoke tests that diff `curl` output pre-PR vs post-PR for representative endpoints. A field shift in any direction (snake↔camel, missing/extra field, value change) blocks merge.

### I-4 — HTTP status codes and error response shapes are unchanged

- 2xx responses: status code preserved.
- 4xx/5xx responses: status code AND ProblemDetails body shape preserved.
- The `withV1` middleware currently transforms legacy errors via `transformLegacyError`. Under ADR-011, `BffError` thrown from `bff.x.y()` is caught and transformed by an **equivalent** path that produces the same ProblemDetails fields (`type`, `title`, `status`, `detail`, `instance`, `requestId`, etc.).

Verification: error-path smoke tests using deliberately-failing requests (e.g. invalid targetSourceId, 404 path) produce identical ProblemDetails bodies pre/post-PR.

### Smoke test framework (shared across specs 03-06)

Each group spec's "Smoke tests" step uses the same baseline-comparison pattern:

```bash
# Capture baseline from origin/main in a separate worktree
git worktree add /tmp/baseline-main origin/main
(cd /tmp/baseline-main && USE_MOCK_DATA=true PORT=3091 npm run dev) &
BASELINE_PID=$!
sleep 5
for endpoint in <group endpoints>; do
  curl -s "http://localhost:3091${endpoint}" | jq -S . > "/tmp/baseline_$(echo $endpoint | tr '/' '_').json"
done
kill $BASELINE_PID

# Capture current branch on a different port
USE_MOCK_DATA=true PORT=3092 npm run dev &
CURRENT_PID=$!
sleep 5
for endpoint in <group endpoints>; do
  curl -s "http://localhost:3092${endpoint}" | jq -S . > "/tmp/current_$(echo $endpoint | tr '/' '_').json"
  diff "/tmp/baseline_$(echo $endpoint | tr '/' '_').json" \
       "/tmp/current_$(echo $endpoint | tr '/' '_').json" \
    || { echo "✗ shape drift on ${endpoint}"; exit 1; }
done
kill $CURRENT_PID
git worktree remove /tmp/baseline-main
```

`jq -S` sorts keys for stable diff output. **Any non-empty diff blocks merge.**

---

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
