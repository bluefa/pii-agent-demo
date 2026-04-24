# Wave 16-D0b - IDC/SDU UI Removal

## Context

D0a detached `ProjectDetail` from IDC/SDU page imports. This PR deletes the now-unreachable IDC/SDU UI trees while keeping provider types and runtime APIs in place for one more PR.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
rg -n "IdcProjectPage|SduProjectPage" app/integration/target-sources/[targetSourceId]/_components/ProjectDetail.tsx && exit 1 || true
```

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic wave16-d0b-idc-sdu-ui-removal --prefix refactor
cd /Users/study/pii-agent-demo-wave16-d0b-idc-sdu-ui-removal
```

## Step 2: Required Reading

- D0a PR diff
- `app/components/features/idc/`
- `app/components/features/sdu/`
- `app/integration/target-sources/[targetSourceId]/_components/idc/`
- `app/integration/target-sources/[targetSourceId]/_components/sdu/`

## Scope

Delete only IDC/SDU UI and page-level component trees.

Delete:

| Path | Notes |
|---|---|
| `app/components/features/idc/` | IDC feature UI. |
| `app/components/features/sdu/` | SDU feature UI. |
| `app/integration/target-sources/[targetSourceId]/_components/idc/` | IDC target-source page components. |
| `app/integration/target-sources/[targetSourceId]/_components/sdu/` | SDU target-source page components. |

Update barrel exports or imports only when deletion creates a compile error.

## Out Of Scope

- API routes under `app/integration/api/v1/idc` and `app/integration/api/v1/sdu`
- `app/lib/api/idc.ts` and `app/lib/api/sdu.ts`
- `lib/types/idc.ts`, `lib/types/sdu.ts`
- `CloudProvider` union
- docs/swagger/docs cleanup

## Acceptance Criteria

- No UI import references deleted IDC/SDU component files.
- `ProjectDetail` continues to compile and still handles old IDC/SDU records through the D0a fallback.
- No provider type shrink yet.

## Verification

```bash
npx tsc --noEmit
npm run lint -- app/components/features app/integration/target-sources/[targetSourceId]/_components
test ! -d app/components/features/idc
test ! -d app/components/features/sdu
test ! -d app/integration/target-sources/[targetSourceId]/_components/idc
test ! -d app/integration/target-sources/[targetSourceId]/_components/sdu
rg -n "@/app/components/features/(idc|sdu)|_components/(idc|sdu)" app lib
```

The final `rg` command must return no hits.

## Commit

```bash
git commit -m "refactor(provider): remove IDC SDU UI trees (wave16-D0b)"
```

## Return

Report PR URL, deleted directories, `tsc` result, lint result, and any UI references that were intentionally kept with rationale.
