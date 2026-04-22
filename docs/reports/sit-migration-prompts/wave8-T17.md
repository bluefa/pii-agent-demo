# Task T17 — Phase 1 Cleanup + Regression Sweep

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
Wave 8 single task (final). Runs after A4, B5, B8 are all merged.
T17 removes dead files and orphan state accumulated during the Phase 1 migration, consolidates lint warnings, and produces a regression snapshot.

## Precondition — verify all Phase 1 milestones merged
```
cd /Users/study/pii-agent-demo
git fetch origin main
git log origin/main --oneline -30 | tee /tmp/t17-log.txt
grep -q "(A4)" /tmp/t17-log.txt && echo "✓ A4 merged" || { echo "✗ A4 not merged"; exit 1; }
grep -q "(B5)" /tmp/t17-log.txt && echo "✓ B5 merged" || { echo "✗ B5 not merged"; exit 1; }
grep -q "(B8)" /tmp/t17-log.txt && echo "✓ B8 merged" || { echo "✗ B8 not merged"; exit 1; }
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic sit-t17-cleanup --prefix chore
cd /Users/study/pii-agent-demo-sit-t17-cleanup
```

## Step 2: Required reading (in order)
1. `docs/reports/sit-migration-todo-phase1.md` §T17
2. Merged Phase 1 PR descriptions — note `Dead code retained for T17` sections across #282 (A2), #283 (A4), #284 (B4), and B5
3. `docs/reports/sit-prototype-migration-plan.md` §4-3

## Step 3: Cleanup targets

### 3-1. Delete dead files
```
git rm app/components/features/admin/AdminHeader.tsx
git rm app/components/ui/UserSearchInput.tsx              # only if grep confirms zero importers
git rm app/components/layout/ProjectSidebar.tsx           # only if grep confirms zero importers
git rm app/components/features/ProjectInfoCard.tsx
git rm app/components/features/AwsInfoCard.tsx
git rm app/components/features/AzureInfoCard.tsx
git rm app/components/features/GcpInfoCard.tsx
git rm app/projects/[projectId]/common/ProjectHeader.tsx
```
Plus: any `*InfoCard` variants referenced only by the 5 `*ProjectPage.tsx` files (already stopped rendering since B4).

**⚠️ Grep-confirm BEFORE each deletion**:
```
grep -rn "from.*AdminHeader" app/ lib/
grep -rn "from.*UserSearchInput" app/ lib/
grep -rn "from.*ProjectSidebar" app/ lib/
grep -rn "from.*AwsInfoCard" app/ lib/
grep -rn "from.*AzureInfoCard" app/ lib/
grep -rn "from.*GcpInfoCard" app/ lib/
grep -rn "from.*ProjectInfoCard" app/ lib/
grep -rn "from.*ProjectHeader" app/ lib/
```
If any file still imports one of these, **do not delete** — investigate, possibly open a blocker issue.

### 3-2. Prune orphan state / imports in 5 ProjectPage files

PR #284 Vercel review flagged (see #issuecomment-4300423724 on PR #284):

| file | orphans to remove |
|---|---|
| `app/projects/[projectId]/aws/AwsProjectPage.tsx` | `handleOpenGuide`, `handleManageCredentials`, `resourceSectionRef` if only referenced by deleted InfoCards |
| `app/projects/[projectId]/azure/AzureProjectPage.tsx` | `scanApp`, `scanAppError` state + their useState + any useEffect fetching them |
| `app/projects/[projectId]/gcp/GcpProjectPage.tsx` | `scanSA`, `tfSA`, `latestApprovalRequest`, `approvedIntegration`, `confirmedIntegration`, `ConfirmResourceItem` import (grep-confirm each is truly orphan) |
| `app/projects/[projectId]/idc/IdcProjectPage.tsx` | `effectiveEditMode`, `setSelectedIds` (confirm they're truly unused after B5/B8) |
| `app/projects/[projectId]/sdu/SduProjectPage.tsx` | `SduProjectInfoCard` import |

**Vercel rule alignment**: this pass resolves the P2 `bundle-conditional` concerns from PR #284 — no more wasted fetches for UI that was removed.

**⚠️ Verify with `npm run lint` BEFORE and AFTER** to confirm warning count drops to expected level.

### 3-3. Delete orphan permissions plumbing (I-01 follow-up, optional)
Phase 0 I-01 resolved as `PermissionsPanel 삭제` but API preserved as dead code. **If user confirms full retirement**, delete:
```
git rm app/lib/api/index.ts   # only the getPermissions / addPermission / deletePermission functions, not the whole file
git rm -r app/api/v1/services/[serviceCode]/permissions   # route.ts + mocks
```
**Default: leave as-is**. Mention in PR body as optional follow-up.

### 3-4. Clean up `app/components/features/admin/index.ts` and `app/projects/[projectId]/common/index.ts`
Remove export lines for any deleted files.

### 3-5. MEMORY.md refresh
Append Phase 1 session summary (auto-memory policy compliant):
```
| 04-23 | #272-#284 | SIT Phase 1 완료 — 서비스 목록 + 타겟소스 상세 + 생성 모달 14 PR 통합. TopNav, InfraCard lazy fetch, 7-step Stepper, GuideCard warm variant, 840px 누적형 Modal, Detail shell 5-provider, DbSelectionTable 8-column |
```
Don't duplicate existing entries.

## Step 4: Verify
```
npx tsc --noEmit
npm run lint
npm run build
```
All three must pass. Lint warnings should drop by **≥15** compared to Phase 1 baseline.

Additionally:
```
# No references to deleted files
for f in AdminHeader AwsInfoCard AzureInfoCard GcpInfoCard ProjectInfoCard ProjectSidebar ProjectHeader; do
  echo "=== $f ==="
  grep -rn "$f" app/ lib/ --include='*.ts' --include='*.tsx' || echo "✓ no references"
done

# No raw hex surfaces introduced
grep -rn '#[0-9A-Fa-f]\{6\}' app/ lib/ --include='*.ts' --include='*.tsx' | grep -v 'theme.ts' | grep -v '/\*' | head
# Manually inspect remaining matches; most should be design tokens already in theme.ts.
```

## Step 5: Regression snapshot
In the PR description, include:

1. `git diff --stat origin/main~14..HEAD` — total Phase 1 volume
2. Screenshots / manual smoke results for:
   - `/integration/admin` — services list + InfraCard expand/collapse
   - `/integration/admin` + 타겟 소스 등록 — 840px modal chip matrix
   - `/integration/projects/{id}` — 5 providers (one screenshot each if feasible, or note 'mock scenarios exercised')

If visual verification isn't possible in the session, list which scenarios were **not** verified — do not fabricate.

## Step 6: Commit + push + PR
```
git add -A
git commit -m "chore(sit): Phase 1 cleanup + regression sweep (T17)

Delete dead files left over from A2/A4/B4/B5:
- AdminHeader.tsx (TopNav replaced it)
- ProjectSidebar.tsx, *InfoCard.tsx × 4, ProjectHeader.tsx (B4/B5 dropped them)
- UserSearchInput.tsx (orphaned after PermissionsPanel deletion)

Prune orphan state / imports in 5 *ProjectPage.tsx files — resolves Vercel
rule bundle-conditional flags from PR #284 Vercel review
(#issuecomment-4300423724).

Refresh MEMORY.md with Phase 1 session entry.

Lint warnings drop from NN to MM.

Spec: docs/reports/sit-migration-todo-phase1.md §T17"
git push -u origin chore/sit-t17-cleanup
```

PR body (write to `/tmp/pr-t17-body.md`):
```
## Summary
Wave 8 — final cleanup of Phase 1 SIT migration.

## Deletions (8 files)
- app/components/features/admin/AdminHeader.tsx
- app/components/features/AwsInfoCard.tsx
- app/components/features/AzureInfoCard.tsx
- app/components/features/GcpInfoCard.tsx
- app/components/features/ProjectInfoCard.tsx
- app/components/layout/ProjectSidebar.tsx
- app/components/ui/UserSearchInput.tsx
- app/projects/[projectId]/common/ProjectHeader.tsx

## Orphan state pruning
- AwsProjectPage.tsx — handleOpenGuide, handleManageCredentials (unused after B4)
- AzureProjectPage.tsx — scanApp, scanAppError state + fetch effect
- GcpProjectPage.tsx — scanSA, tfSA, latest/approved/confirmed state trio
- IdcProjectPage.tsx — effectiveEditMode, setSelectedIds
- SduProjectPage.tsx — SduProjectInfoCard import

Resolves Vercel rule bundle-conditional P2 flags from PR #284 Vercel review.

## MEMORY.md
Phase 1 session summary appended.

## Verification
- [x] npx tsc --noEmit
- [x] npm run lint (warnings: NN → MM)
- [x] npm run build
- [x] grep confirms 0 references to deleted modules
- [x] Visual smoke: <list pages confirmed or state 'not run'>

## Optional follow-ups (NOT in this PR)
- Permissions API retirement (I-01) — decide if the preserved dead API is retired
- resource.scanHistoryStatus (I-06) — BFF field landing unlocks stub swap

## Ref
- docs/reports/sit-migration-todo-phase1.md §T17
- PR #284 Vercel review: #issuecomment-4300423724
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report URL.

## Return (under 250 words)
1. PR URL
2. tsc / lint / build pass confirmation
3. Files actually deleted (some may have survived if imports still exist — report gap)
4. Lint warning count before/after
5. Smoke test results for admin + 5 detail pages (or which ones skipped + why)
6. Any `git rm` intentionally deferred + rationale

## Parallel coordination
Single task, no parallel sessions. T17 is the final Phase 1 PR.
