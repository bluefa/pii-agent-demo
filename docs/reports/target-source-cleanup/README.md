# target-source-cleanup — wave17

Two-spec cleanup of `lib/target-source-response.ts` and the external `TargetSource` contract.

## Background

### The bug

`lib/target-source-response.ts:67-74` `isTargetSource` type guard was tightened from
`Array.isArray(value.resources)` → `typeof value.cloudProvider === 'string'` in PR #356
(`d5989ba`, 2026-04-24). The new check is too loose: **any string passes**, including Issue222
enum strings like `'AZURE'` that are not valid `CloudProvider` literals (`'Azure'`).

Effect chain:

```
mock GET /target-sources/1003
  → toIssue222TargetSourceInfo({ cloudProvider: 'Azure' })
  → cloudProvider: 'AZURE' (Issue222 enum)
  ↓
extractTargetSource(data)
  → isTargetSource(x) === true   ← loose guard
  → normalization SKIPPED, raw returned
  ↓
ProjectDetail.tsx switch (project.cloudProvider)
  → case 'Azure': no match ('AZURE' !== 'Azure')
  → default: <ErrorState "지원하지 않는 클라우드 프로바이더입니다." />
```

AWS/GCP/IDC coincidentally survive (Issue222 enum == `CloudProvider` literal); only Azure
breaks visibly.

### The deeper issue

`target-source-response.ts` is 254 LOC. Investigation shows the majority is **dead defensive
code** for shapes that never reach the normalizer in production:

1. **`{ target_source }` snake envelope** — unreachable. Both mock and BFF responses flow
   through `camelCaseKeys` before hitting `extractTargetSource` (`bff-client.ts:59`). Snake
   top-level keys are converted to camel.
2. **`{ project }` legacy envelope** — unreachable for external `target-sources` path. Only
   used by mock-internal `/projects/*` routes.
3. **Dual-key fallbacks** `readValue(x, 'targetSourceId', 'target_source_id')` everywhere —
   snake variant never arrives (same reason as #1).
4. **`buildDerivedStatus`** — fabricates `ProjectStatus` from `processStatus`. But **no UI
   component reads `project.status.*`**; only mock business logic does, and mock works on its
   internal `Project` type. Round-trip: UI reads `getProjectCurrentStep(project)` which
   recomputes `processStatus` from the fabricated `status`.

BFF contract (`docs/swagger/user.yaml` `TargetSourceDetail`) has no `status` field. The
frontend `TargetSource` type declares it as required. The `client-side` swagger at
`docs/swagger/issue-222-client.yaml` documents the post-normalizer shape — not a BFF
contract.

`terraformState` has the same shape bloat (BFF doesn't send it, frontend defaults to
`PENDING`, real terraform data comes from a separate installation-status API). After
wave16 (PR #362, merged 2026-04-24) narrowed `CloudProvider` to `AWS | Azure | GCP`,
the sole remaining caller of `TerraformStatusModal` — the IDC/SDU fallback button in
`ProcessStatusCard.tsx:225-238` — is **statically unreachable**. wave17-B now includes
`terraformState` removal in scope.

## Waves

| Spec | Scope | Files | Net LOC | Risk |
|---|---|---|---|---|
| [wave17-A](./wave17-A-guard-fix.md) | Tighten `isTargetSource` cloudProvider check + missing test | 2 | +~20 | Very low |
| [wave17-B](./wave17-B-contract-slim.md) | Remove `status` + `terraformState` from external `TargetSource`, delete `TerraformStatusModal` + dead IDC/SDU fallback branch, drop dead normalizer paths | ~10 | -~300 | Medium |

## Execution order

Strictly sequential. Both touch `lib/target-source-response.ts`.

1. **wave17-A** merges first — immediately stops the visible AZURE bug.
2. **wave17-B** rebases on `A`, proceeds with contract slim.

## Out of scope (future waves)

- Real-BFF installation status wiring — a separate `/aws/target-sources/{id}/installation-status`
  endpoint already provides live terraform data for AWS. If Azure/GCP need similar live
  state surfaces, route them through those endpoints — not through the target-source
  detail contract.
- Mock `toIssue222TargetSourceInfo` further slim to match `docs/swagger/user.yaml` exactly
  (drop `name`, `isRejected`, internal mock fields). Requires consumer audit.
