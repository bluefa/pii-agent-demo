# Task A6 — ProjectCreateModal rewrite

## Context
Wave 2 parallel task. You rewrite `app/components/features/ProjectCreateModal.tsx` based on prototype Screen 2. Transform single-provider / single-create into multi-provider staging list with parallel `Promise.allSettled` submission.

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
grep -q 'export const navStyles' lib/theme.ts || { echo "✗ T1 missing"; exit 1; }
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic sit-a6-create-modal --prefix feat
cd /Users/study/pii-agent-demo-sit-a6-create-modal
```

## Step 2: Required reading
1. `docs/reports/sit-migration-todo-phase1.md` §A6 — **full spec incl. state shape + mapping constants**
2. `docs/reports/sit-prototype-migration-plan.md` §3-4
3. `design/SIT Prototype.html` L1181-1332
4. `app/components/features/ProjectCreateModal.tsx` (current, to be rewritten)
5. `app/lib/api/index.ts` `createProject` signature — **audit for `linkedAccountId` / `dbTypes` field support**

## Step 3: Files

### Rewrite: `app/components/features/ProjectCreateModal.tsx`
- Width 840px (from 560px)
- Keep outer prop signature: `selectedServiceCode`, `serviceName`, `onClose`, `onCreated`

### New: `app/components/features/project-create/`
- `ProviderChipGrid.tsx` — 7-chip grid (4 enabled + 3 disabled)
- `ProviderCredentialForm.tsx` — chip-driven field rendering
- `DbTypeMultiSelect.tsx` — select + chip multi UI
- `StagedInfraTable.tsx` — staged list mini-table
- `index.ts`

### New constants
`lib/constants/db-types.ts`:
```ts
export type DbType = 'mysql' | 'mssql' | 'postgresql' | 'athena' | 'redshift' | 'bigquery';

export const DB_TYPES: Array<{ value: DbType; label: string }> = [
  { value: 'mysql', label: 'MySQL' },
  { value: 'mssql', label: 'MSSQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'athena', label: 'Athena' },
  { value: 'redshift', label: 'Redshift' },
  { value: 'bigquery', label: 'BigQuery' },
];
```

`lib/constants/provider-mapping.ts`: define `PROVIDER_CHIPS` (7 entries with `enabled` flag) — full shape in Todo doc §A6.

## Step 4: Chip enable matrix
| Chip | enabled | cloudProvider | awsRegionType | commModule |
|---|---|---|---|---|
| AWS Global | ✅ | AWS | global | AWS Agent |
| AWS China | ✅ | AWS | china | AWS Agent |
| Azure | ✅ | Azure | — | Azure Agent |
| GCP | ✅ | GCP | — | GCP Agent |
| IDC / On-prem | ❌ | — | — | — |
| Other Cloud / IDC | ❌ | — | — | — |
| SaaS | ❌ | — | — | — |

Disabled chips: `opacity-50 cursor-not-allowed` + `준비중` badge + tooltip `추후 지원 예정`. No onClick handler.

## Step 5: Core logic
- State: `staged: StagedInfra[]` plus current input fields (chip, credentials, dbTypes)
- **Add to List** — push to staged if validation passes. Reuse existing `validateAwsAccountId`, `validateGuid` for AWS/Azure.
- **Save**:
  ```ts
  const results = await Promise.allSettled(staged.map(i => createProject(toCreateDto(i))));
  // fulfilled items: remove from staged
  // rejected items: keep + show per-row error message
  ```
  When staged is empty after save → `onCreated()` then `onClose()`.

## Step 6: API compatibility audit (do this FIRST)
```
grep -n 'interface CreateProject\|export const createProject' app/lib/api/index.ts
```
Verify whether `createProject` accepts `linkedAccountId` and `dbTypes`. If not supported:
- `toCreateDto` must drop those fields gracefully
- Record unsupported fields in the PR description under "BFF follow-ups"

## Step 7: Constraints
- Outer prop signature preserved (no breaking change to AdminDashboard call site)
- No raw hex; use `tagStyles` (T1)
- `CloudProvider` enum is unchanged (only `'AWS' | 'Azure' | 'GCP'` flow through to backend)
- Keep existing validation helpers
- Keep Korean UI labels as-is (준비중, 추후 지원 예정, etc.)

## Step 8: Verification
```
npm run type-check
npm run lint
```
Manual:
- Switch among 4 enabled chips → fields swap correctly
- Add to List → row appears → × removes row
- Save with 2 valid + 1 invalid → DevTools shows 3 parallel `createProject` calls, 2 succeed and 1 fails with inline error
- Disabled chip click → no-op + tooltip

## Step 9: Commit, push, PR
```
git add app/components/features/ProjectCreateModal.tsx app/components/features/project-create/ lib/constants/db-types.ts lib/constants/provider-mapping.ts
git fetch origin main && git rebase origin/main
git commit -m "feat(admin): ProjectCreateModal 840px staged rewrite (A6)

Based on prototype Screen 2. Implements Phase 0 C-01~C-06.

- 7-chip provider grid (AWS Global/China/Azure/GCP enabled, IDC/Other/SaaS disabled)
- Accumulating staged list with Promise.allSettled parallel submission
- Static DB Type constants (6: mysql/mssql/postgresql/athena/redshift/bigquery)
- PROVIDER_CHIPS mapping constant extracted

Outer prop signature preserved for AdminDashboard compatibility.

Spec: docs/reports/sit-migration-todo-phase1.md §A6"
git push -u origin feat/sit-a6-create-modal
gh pr create --title "feat(admin): ProjectCreateModal 840px staged rewrite (A6)" --body "$(cat <<'EOF'
## Summary
Wave 2 — ProjectCreateModal rewrite. Promoted from Phase 2.

## Changes
- 560 → 840px
- 7 chips (4 enabled, 3 disabled with '준비중' badge)
- Staged list + Promise.allSettled parallel submit
- db-types.ts, provider-mapping.ts extracted

## Phase 0
- C-01 enum extension skipped (disabled chips resolve it)
- C-02 staged list, C-03/04 AWS/Azure/GCP only, C-05 6 types, C-06 840px

## BFF compatibility
<record linkedAccountId / dbTypes audit result here>

## Test plan
- [x] chip switching
- [x] add/remove staged rows
- [x] Promise.allSettled partial success/failure
- [x] disabled chip tooltip

## Ref
- docs/reports/sit-migration-todo-phase1.md §A6
EOF
)"
```

## Step 10: Stop. Report URL.

## Parallel coordination
- AdminDashboard.tsx is touched by A2 (Wave 3) — you do NOT modify it here; prop signature preservation keeps them compatible.
- No other Wave 2 collision.
