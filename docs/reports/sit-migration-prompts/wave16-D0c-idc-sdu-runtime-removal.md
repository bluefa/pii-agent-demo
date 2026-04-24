# Wave 16-D0c - IDC/SDU Runtime Removal

## Context

D0b removed UI consumers. This PR removes IDC/SDU runtime API surfaces, mock clients, and mock seed records. Keep core provider type cleanup for D0d so this PR stays focused on runtime removal.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
test ! -d app/components/features/idc
test ! -d app/components/features/sdu
```

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic wave16-d0c-idc-sdu-runtime-removal --prefix refactor
cd /Users/study/pii-agent-demo-wave16-d0c-idc-sdu-runtime-removal
```

## Step 2: Required Reading

- `app/lib/api/idc.ts`
- `app/lib/api/sdu.ts`
- `app/integration/api/v1/idc/`
- `app/integration/api/v1/sdu/`
- `app/integration/api/v1/services/[serviceCode]/settings/idc/`
- `app/integration/api/v1/services/[serviceCode]/settings/sdu/` if present
- `lib/api-client/types.ts`
- `lib/api-client/bff-client.ts`
- `lib/api-client/mock/idc.ts`
- `lib/api-client/mock/sdu.ts`
- `lib/mock-idc.ts`
- `lib/mock-sdu.ts`
- `lib/mock-data.ts`

## Scope

Delete runtime-only IDC/SDU modules and remove mock seed records that create IDC/SDU projects.

Expected deletes:

| Path | Notes |
|---|---|
| `app/lib/api/idc.ts` | No UI consumer after D0b. |
| `app/lib/api/sdu.ts` | No UI consumer after D0b. |
| `app/integration/api/v1/idc/` | IDC route handlers. |
| `app/integration/api/v1/sdu/` | SDU route handlers. |
| `app/integration/api/v1/services/[serviceCode]/settings/idc/` | IDC settings route. |
| `app/integration/api/v1/services/[serviceCode]/settings/sdu/` | SDU settings route, if present. |
| `lib/api-client/mock/idc.ts` | Mock business logic. |
| `lib/api-client/mock/sdu.ts` | Mock business logic. |
| `lib/mock-idc.ts` | Legacy mock module. |
| `lib/mock-sdu.ts` | Legacy mock module. |
| `lib/__tests__/mock-idc.test.ts` | Runtime tests. |
| `lib/__tests__/mock-sdu.test.ts` | Runtime tests. |

Expected updates:

| File | Change |
|---|---|
| `lib/api-client/types.ts` | Remove `idc`, `sdu`, and service-settings `idc`/`sdu` client members. |
| `lib/api-client/bff-client.ts` | Remove proxy methods for IDC/SDU. |
| `lib/api-client/mock/index.ts` or client composition files | Remove IDC/SDU client wiring. |
| `lib/mock-data.ts` | Remove IDC/SDU target-source/project seed records. |

## Out Of Scope

- `CloudProvider` union shrink
- `lib/types/idc.ts`, `lib/types/sdu.ts`
- process calculator cleanup
- docs cleanup
- dashboard sample text cleanup unless it imports removed runtime modules

## Acceptance Criteria

- No API route imports `client.idc` or `client.sdu`.
- No mock client exposes `idc` or `sdu` methods.
- Mock target-source/project data no longer includes IDC/SDU instances.
- Build remains green before provider type cleanup.

## Verification

```bash
npx tsc --noEmit
npm run lint -- app/lib lib/api-client lib/mock-data.ts app/integration/api/v1
npm run test:run
test ! -d app/integration/api/v1/idc
test ! -d app/integration/api/v1/sdu
rg -n "client\\.(idc|sdu)|mock-(idc|sdu)|cloudProvider: '(IDC|SDU)'" app lib
```

The final `rg` command must return no hits, except in files explicitly deferred to D0d because they describe provider types or historical constants.

## Commit

```bash
git commit -m "refactor(provider): remove IDC SDU runtime APIs (wave16-D0c)"
```

## Return

Report PR URL, deleted runtime paths, `tsc`, lint, test result, and any remaining IDC/SDU references deferred to D0d.
