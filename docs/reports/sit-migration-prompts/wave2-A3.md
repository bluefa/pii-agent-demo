# Task A3 — InfraCard component set

## Context
Wave 2 parallel task. You create a brand-new directory `app/components/features/admin/infrastructure/` with 7 files + index.
AdminDashboard integration is NOT in scope (A4 handles it).
You MUST implement the I-02 expand rules precisely.

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
grep -q 'export const mgmtGroupStyles' lib/theme.ts || { echo "✗ T1 missing"; exit 1; }
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic sit-a3-infracard --prefix feat
cd /Users/study/pii-agent-demo-sit-a3-infracard
```

## Step 2: Required reading (in order)
1. `docs/reports/sit-migration-todo-phase1.md` §A3 — **full spec including I-02 expand rules**
2. `docs/reports/sit-prototype-migration-plan.md` §3-3-d
3. `design/SIT Prototype.html` L223-330, L873-968
4. `app/components/features/process-status/ConfirmedIntegrationCollapse.tsx` — **lazy-fetch pattern reference only; do NOT copy**
5. `app/components/features/admin/ProjectsTable.tsx` — migrate ProcessStatus CTA logic from here
6. `app/lib/api/index.ts` `getConfirmedIntegration` signature

## Step 3: Files to create

```
app/components/features/admin/infrastructure/
├── index.ts
├── InfrastructureList.tsx           # container (projects → card list + empty)
├── InfraCard.tsx                    # single accordion card with local state
├── InfraCardHeader.tsx              # header row
├── InfraCardBody.tsx                # expanded region (lazy-fetched content)
├── InfraDbTable.tsx                 # 6-column DB table
├── InfrastructureEmptyState.tsx     # empty state
└── ManagementSplitButton.tsx        # 관리 button + kebab menu
```

## Step 4: Expand rules (I-02, STRICT)

```tsx
// Rule 1: chevron activation
const canExpand =
  project.cloudProvider !== 'IDC' &&
  project.cloudProvider !== 'SDU' &&
  project.processStatus >= ProcessStatus.INSTALLING;
// If false, do NOT render the chevron DOM at all (not hidden, absent)

// Rule 2: IDC/SDU cards are non-interactive headers
//   - header row cursor: default (not pointer)
//   - no body ever renders

// Rule 3: lazy fetch + in-component cache
const [expanded, setExpanded] = useState(false);
const [confirmedResources, setConfirmedResources] = useState<ConfirmedIntegrationResourceItem[] | null>(null);
const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'error'>('idle');

const handleToggle = async () => {
  if (!expanded && confirmedResources === null) {
    setFetchState('loading');
    try {
      const res = await getConfirmedIntegration(project.targetSourceId);
      setConfirmedResources(res.resource_infos);
      setFetchState('idle');
    } catch {
      setConfirmedResources([]);
      setFetchState('error');
    }
  }
  setExpanded(prev => !prev);
};
// Once fetched, subsequent expand/collapse toggles do NOT refetch.
// No preemptive fetch on mount. No prefetch from InfrastructureList.
```

## Step 5: Header right-side layout (I-02 Option A)
```
... [provider-badge] [kv-inline × 3] ... [status-aware CTA] [관리 ▾ split button]
```
Copy status-aware CTA logic verbatim from `ProjectsTable`:
- `WAITING_APPROVAL` → `승인 요청 확인` button
- `APPLYING_APPROVED` → `연동대상 반영 중` badge
- `INSTALLING` → `설치 진행 중` badge
- `WAITING_CONNECTION_TEST` → `연결 테스트 대기` badge
- `CONNECTION_VERIFIED` → `설치 완료 확정` button

Management split button is always rendered regardless of status.

## Step 6: InfraCardBody rendering (expanded)
- `fetchState === 'loading'` → 3 skeleton rows
- `fetchState === 'error'` → message + retry link (re-invokes `handleToggle`)
- `confirmedResources.length > 0` → `<InfraDbTable resources={confirmedResources} />`
- `confirmedResources.length === 0` → `연동 확정된 DB가 없어요` empty

## Step 7: InfraDbTable columns
Database name / DB Type / Region / 연동 대상 여부 / 연동 완료 여부 / 연동 상태

Map from `ConfirmedIntegrationResourceItem` fields (include the mapping table in the PR description).

## Step 8: Constraints
- Do NOT import/duplicate `ConfirmedIntegrationCollapse`. Reference the pattern only.
- Do NOT call `getConfirmedIntegration` from `InfrastructureList` or any parent.
- Use `ConfirmedIntegrationResourceItem` type only — NOT `Resource`.
- Use `mgmtGroupStyles`, `tagStyles` from T1.

## Step 9: Verification
```
npm run type-check
npm run lint
```
Unit check via mock `ProjectSummary` fixtures:
- AWS / `INSTALLATION_COMPLETE` → chevron visible
- Azure / `WAITING_APPROVAL` → chevron absent
- IDC / any status → chevron absent
- On repeated expand/collapse, verify only ONE network call in DevTools.

## Step 10: Commit, push, PR
```
git add app/components/features/admin/infrastructure/
git fetch origin main && git rebase origin/main
git commit -m "feat(admin): InfraCard component set (A3)

New accordion card UI for Screen 3. Implements I-02 decisions:
- Expand activates only when ProcessStatus >= INSTALLING and provider is not IDC/SDU
- IDC/SDU: no expand affordance (chevron DOM absent)
- Lazy fetch of getConfirmedIntegration on expand; cached in local state

AdminDashboard integration is A4's scope.

Spec: docs/reports/sit-migration-todo-phase1.md §A3"
git push -u origin feat/sit-a3-infracard
gh pr create --title "feat(admin): InfraCard component set (A3)" --body "$(cat <<'EOF'
## Summary
Wave 2 — Screen 3 accordion card UI (7 new files). AdminDashboard wiring deferred to A4.

## I-02 rules
- chevron: `status >= INSTALLING && !IDC && !SDU`
- IDC/SDU: no expand DOM
- Lazy fetch + in-component cache

## Mapping
<attach ConfirmedIntegrationResourceItem → 6-column table mapping here>

## Test plan
- [x] chevron matrix (3 mock fixtures)
- [x] single fetch on repeated expand/collapse

## Ref
- docs/reports/sit-migration-todo-phase1.md §A3
EOF
)"
```

## Step 11: Stop. Report URL.

## Parallel coordination
New directory — no collision with other Wave 2 sessions.
