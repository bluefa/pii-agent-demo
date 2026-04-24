# Wave 16-01 - IDC/SDU Removal

## Intent

Remove IDC/SDU as active providers before resource-model separation. This is one Opus MAX session because the work is mostly mechanical cross-file deletion and type-surface cleanup.

Source: `docs/reports/resource-model-separation-plan.md` sections 6-7.

## Required Outcome

After this PR, active code supports only AWS, Azure, and GCP. IDC/SDU may remain only in historical docs or this Wave 16 planning pack.

## Scope

Delete or update all active IDC/SDU surfaces:

| Area | Required action |
|---|---|
| Entry/routing | Remove IDC/SDU cases from `ProjectDetail`, project creation/provider mapping, provider icons, labels, and theme maps. |
| UI | Delete `app/components/features/{idc,sdu}/` and `app/integration/target-sources/[targetSourceId]/_components/{idc,sdu}/`. |
| Runtime APIs | Delete `app/lib/api/{idc,sdu}.ts`, `app/integration/api/v1/{idc,sdu}/`, and IDC/SDU service-settings routes. |
| API clients | Remove `client.idc`, `client.sdu`, and service-settings IDC/SDU members from API client types, BFF client, and mock client composition. |
| Mock data | Delete `lib/mock-{idc,sdu}.ts`, mock client modules, IDC/SDU tests, and IDC/SDU seed projects/resources. |
| Types/constants/process | Delete `lib/types/{idc,sdu}.ts`, `lib/constants/{idc,sdu}.ts`, `lib/process/sdu-guide-bridge.ts`, and shrink active provider/process unions to AWS/Azure/GCP. |
| Docs | Delete active IDC/SDU API/swagger/process docs and update current-state docs so they no longer describe IDC/SDU as supported. |

## Execution Notes

- Before deleting, ensure `archive/idc-sdu-pre-removal` exists on `origin`. Create it from `origin/main` if missing.
- Prefer direct deletion over fallback shims. Old IDC/SDU mock records should be removed, not routed to generic pages.
- Do not touch Candidate/Approved/Confirmed resource modeling in this PR.
- Historical ADR references may remain if they clearly read as history. Current-state docs must not claim IDC/SDU support.

## Acceptance Criteria

- `CloudProvider` active union is AWS/Azure/GCP only.
- No active route, API client, component, mock seed, process calculator, provider icon, or provider label supports IDC/SDU.
- `ProjectDetail` has no IDC/SDU page import or case.
- `npm run test:run`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass.

## Verification

```bash
rg -n "'IDC'|'SDU'|\\bIdc\\b|\\bSdu\\b|\\bidc\\b|\\bsdu\\b" app lib
rg -n "IDC|SDU|idc|sdu" docs
npm run test:run
npx tsc --noEmit
npm run lint
npm run build
```

Expected:

- `app lib` grep returns no active-code hits.
- `docs` grep returns only historical ADR/archive references or Wave 16 planning references.

## Return

Report PR URL, deleted top-level areas, archive tag status, verification results, and any remaining IDC/SDU references with rationale.
