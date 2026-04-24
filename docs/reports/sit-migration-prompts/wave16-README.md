# Wave 16 - Post PR358 Resource Model Separation

Baseline: `main@508b966` after PR358 merge.

Source plan: `docs/reports/resource-model-separation-plan.md`

This wave converts the PR358 plan into `/wave-task`-ready specs. Each spec must end with a build-green PR. Because `/wave-task` requires `tsc` and lint to pass per PR, this plan intentionally avoids the PR358 D0-b boundary that would delete runtime files before UI/type consumers are removed.

## Execution Order

Run sequentially unless a spec explicitly says otherwise.

| Key | Spec | Goal |
|---|---|---|
| `wave16-D0a` | `wave16-D0a-idc-sdu-entry-cutoff.md` | Block IDC/SDU entry and detach ProjectDetail from IDC/SDU UI |
| `wave16-D0b` | `wave16-D0b-idc-sdu-ui-removal.md` | Delete IDC/SDU UI trees after ProjectDetail no longer imports them |
| `wave16-D0c` | `wave16-D0c-idc-sdu-runtime-removal.md` | Delete IDC/SDU API routes, API wrappers, mock clients, and mock seeds |
| `wave16-D0d` | `wave16-D0d-idc-sdu-type-process-cleanup.md` | Shrink provider types/process/constants to AWS/Azure/GCP |
| `wave16-D0e` | `wave16-D0e-idc-sdu-docs-cleanup.md` | Remove active IDC/SDU docs and update current-state docs |
| `wave16-D1` | `wave16-D1-resource-types-behavior-scaffold.md` | Add Candidate/Approved/Confirmed types and behavior scaffold without breaking legacy consumers |
| `wave16-D2` | `wave16-D2-candidate-section-migration.md` | Move Step1 candidate fetch/selection/approval into component-level section |
| `wave16-D3` | `wave16-D3-approved-confirmed-section-migration.md` | Move approved/confirmed fetch and presentation into component-level sections |
| `wave16-D4` | `wave16-D4-resource-section-cleanup.md` | Introduce shared ResourceSection switch and delete legacy Resource remnants |

## Invocation

```bash
/wave-task docs/reports/sit-migration-prompts/wave16-D0a-idc-sdu-entry-cutoff.md
/wave-task docs/reports/sit-migration-prompts/wave16-D0b-idc-sdu-ui-removal.md
/wave-task docs/reports/sit-migration-prompts/wave16-D0c-idc-sdu-runtime-removal.md
/wave-task docs/reports/sit-migration-prompts/wave16-D0d-idc-sdu-type-process-cleanup.md
/wave-task docs/reports/sit-migration-prompts/wave16-D0e-idc-sdu-docs-cleanup.md
/wave-task docs/reports/sit-migration-prompts/wave16-D1-resource-types-behavior-scaffold.md
/wave-task docs/reports/sit-migration-prompts/wave16-D2-candidate-section-migration.md
/wave-task docs/reports/sit-migration-prompts/wave16-D3-approved-confirmed-section-migration.md
/wave-task docs/reports/sit-migration-prompts/wave16-D4-resource-section-cleanup.md
```

## Global Rules

- Every PR must keep `npx tsc --noEmit` green.
- Do not implement speculative provider abstractions. The remaining provider set after D0 is AWS/Azure/GCP.
- Do not reintroduce a shared resource mega type. Temporary legacy adapters are allowed only until D4 and must be named as transitional.
- ProjectPage components must not import `isVmResource`, `CandidateResource`, `ApprovedResource`, `ConfirmedResource`, `configKind`, or `behaviorKey` after D4.
- Resource-type special behavior must go through candidate behavior registry. VM endpoint setup is the first behavior implementation, not a page-level branch.
- Component-level sections own API calls, loading, error, retry, and cancellation. ProjectPage should only choose which section is visible.

## Build-Green Decomposition Notes

PR358 D1 originally says deleting `Resource` in D1 can break existing consumers until D2. That is not suitable for `/wave-task`. In this wave plan:

- D1 is additive: new types, transformers, and behavior contracts are introduced while legacy `Resource` exports remain.
- D2 migrates candidate/Step1 behavior to the new model.
- D3 migrates approved/confirmed behavior to the new model.
- D4 removes transitional legacy types, converters, and switch duplication.

## Expected End State

- IDC/SDU code and active docs are removed.
- Candidate, Approved, and Confirmed resources are separate types and never share one array.
- Step1 DB select/API call is owned by `CandidateResourceSection`, not ProjectPage.
- Approved and confirmed data are fetched only by their own sections.
- Existing `let cancelled = false` resource-fetch patterns are replaced by `AbortController`.
- `isVmResource` no longer leaks into ProjectPage. Type-specific behavior is declared in a candidate behavior registry.
