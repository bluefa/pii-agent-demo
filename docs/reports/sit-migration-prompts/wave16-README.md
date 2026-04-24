# Wave 16 - Post PR358 Resource Model Separation

Baseline: `main@508b966` after PR358 merge.

Source plan: `docs/reports/resource-model-separation-plan.md`

This is the Opus MAX execution pack for Claude Code `/wave-task`.

The original PR358 plan has many small D0-D4 steps. That is useful for low-risk incremental PRs, but it is too fragmented for a high-effort single-agent session. This pack compresses the work into three coherent specs. Each spec is still build-green and reviewable, but avoids unnecessary handoff overhead and transitional states.

## Execution Order

Run sequentially. Do not parallelize these specs because each one depends on the previous spec's type and file-removal surface.

| Key | Spec | Goal |
|---|---|---|
| `wave16-01` | `wave16-01-idc-sdu-removal.md` | Remove IDC/SDU code, routes, mocks, types, and active docs in one coherent cleanup PR |
| `wave16-02` | `wave16-02-candidate-resource-section.md` | Add separated resource types and move Step1 candidate select/API/approval to `CandidateResourceSection` |
| `wave16-03` | `wave16-03-approved-confirmed-cleanup.md` | Move approved/confirmed sections to component level, add shared `ResourceSection`, and delete legacy `Resource` remnants |

## Invocation

```bash
/wave-task docs/reports/sit-migration-prompts/wave16-01-idc-sdu-removal.md
/wave-task docs/reports/sit-migration-prompts/wave16-02-candidate-resource-section.md
/wave-task docs/reports/sit-migration-prompts/wave16-03-approved-confirmed-cleanup.md
```

## Global Rules

- Every PR must keep `npx tsc --noEmit` green.
- Do not implement speculative provider abstractions. The remaining provider set after D0 is AWS/Azure/GCP.
- Do not reintroduce a shared resource mega type. Temporary legacy adapters are allowed only until D4 and must be named as transitional.
- ProjectPage components must not import `isVmResource`, `CandidateResource`, `ApprovedResource`, `ConfirmedResource`, `configKind`, or `behaviorKey` after D4.
- Resource-type special behavior must go through candidate behavior registry. VM endpoint setup is the first behavior implementation, not a page-level branch.
- Component-level sections own API calls, loading, error, retry, and cancellation. ProjectPage should only choose which section is visible.

## Why Only Three Specs

Opus MAX can hold the cross-file context needed for each coherent migration. Smaller specs would create extra PRs without reducing conceptual difficulty.

- `wave16-01` is a deletion/ref-surface cleanup. Splitting it into entry/UI/runtime/types/docs creates temporary states that are harder to review.
- `wave16-02` must combine type scaffold and Step1 migration. Adding types without migrating consumers leaves noise; migrating Step1 without types repeats the current `Resource` problem.
- `wave16-03` must combine approved/confirmed migration and legacy cleanup. Otherwise the codebase keeps both the old and new resource paths.

If a session cannot finish a spec while keeping `tsc` green, it should stop and report the exact blocker instead of inventing a fourth wave.

## Expected End State

- IDC/SDU code and active docs are removed.
- Candidate, Approved, and Confirmed resources are separate types and never share one array.
- Step1 DB select/API call is owned by `CandidateResourceSection`, not ProjectPage.
- Approved and confirmed data are fetched only by their own sections.
- Existing `let cancelled = false` resource-fetch patterns are replaced by `AbortController`.
- `isVmResource` no longer leaks into ProjectPage. Type-specific behavior is declared in a candidate behavior registry.
