# Wave 14-B1a — SystemsTable God-Component Split

## Context
Audit §B1 🔴 (god-component > 300 LOC). `SystemsTable.tsx` 는 **491 LOC** 로 현 코드베이스에서 가장 큰 단일 컴포넌트 파일. wave12-B1 (ConnectionTestPanel split) 과 동일 접근.

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
expected=491
actual=$(wc -l < app/components/features/dashboard/SystemsTable.tsx)
[ "$actual" = "$expected" ] || { echo "✗ SystemsTable LOC drifted: $actual (expected $expected)"; exit 1; }
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave14-b1a-systems-table --prefix refactor
cd /Users/study/pii-agent-demo-wave14-b1a-systems-table
```

## Step 2: Required reading
1. `app/components/features/dashboard/SystemsTable.tsx` (전체 491 LOC)
2. `.claude/skills/anti-patterns/SKILL.md` §B1, §B6
3. wave12-B1 결과 (`ConnectionTestPanel.tsx` + `connection-test/` 폴더) — 동일 패턴
4. 소비처: `grep -rln "SystemsTable" app --include="*.tsx"` — prop 계약 확인

## Step 3: Target structure

메인 파일은 동일 경로 유지 (소비처 불변). 하위 폴더에 child 컴포넌트 배치:

```
app/components/features/dashboard/
├── SystemsTable.tsx              (main, target ≤ 220 LOC)
└── systems-table/
    ├── columns.tsx                (ColumnDef[] + 관련 cell renderer, ~120 LOC)
    ├── SortIcon.tsx               (23–41, ~25 LOC)
    ├── PillTag.tsx                (43–77, ~35 LOC + INTEGRATION_COLORS)
    ├── StatusBadge.tsx            (78–106, ~30 LOC)
    ├── SkeletonRow.tsx            (224–236, ~15 LOC)
    ├── Pagination.tsx             (237–351, ~115 LOC)
    ├── types.ts                   (ColumnDef interface, SortDirection type)
    └── index.ts                   (re-exports)
```

### 3-1. 분할 매핑 (라인 기준)

| 현 위치 (line) | 이동처 | 비고 |
|--------------|--------|------|
| L5–10 `SystemsTableProps` | `SystemsTable.tsx` 유지 | main 전용 |
| L12 `SortDirection` | `systems-table/types.ts` | 공유 |
| L14–21 `ColumnDef` interface | `systems-table/types.ts` | 공유 |
| L23–41 `SortIcon` | `systems-table/SortIcon.tsx` | |
| L43–50 `INTEGRATION_COLORS` | `systems-table/PillTag.tsx` 내부 상수 | PillTag 만 사용 |
| L52–77 `PillTag` | `systems-table/PillTag.tsx` | |
| L78–106 `StatusBadge` | `systems-table/StatusBadge.tsx` | |
| L107–223 `columns` array | `systems-table/columns.tsx` | 가장 큰 분할 |
| L224–236 `SkeletonRow` | `systems-table/SkeletonRow.tsx` | |
| L237–351 `Pagination` | `systems-table/Pagination.tsx` | |
| L352–490 `SystemsTable` + `export default` | `SystemsTable.tsx` 유지 | main |

### 3-2. columns.tsx 특수성

`columns` 는 ColumnDef[] 배열이지만 각 cell renderer 에서 `PillTag`, `StatusBadge` 등을 호출. 이들 import 해야 함. 또한 `filters`/`onFiltersChange` 같은 인자가 main 에서 바인딩될 수 있음. **현 구조 검증**:

```
sed -n '107,223p' app/components/features/dashboard/SystemsTable.tsx
```

만약 `columns` 가 closure 로 main 의 state 에 의존하면 **factory 함수로 변환**:

```ts
// systems-table/columns.tsx
export const createColumns = (filters: Filters, onFiltersChange: ...): ColumnDef[] => [...]
```

closure 의존 없으면 상수 export 그대로.

### 3-3. SortIcon 유의

SortIcon 은 JSX inline `<svg>` 포함 (audit §H1). 이 spec 은 **split 만**, SVG migration 은 wave15+. 주석 TODO 추가:
```tsx
// TODO(wave15-H1): migrate inline SVG to icons module
```

### 3-4. index.ts

```ts
export { SortIcon } from './SortIcon';
export { PillTag } from './PillTag';
export { StatusBadge } from './StatusBadge';
export { SkeletonRow } from './SkeletonRow';
export { Pagination } from './Pagination';
export { createColumns } from './columns';  // factory 일 경우
export type { ColumnDef, SortDirection } from './types';
```

## Step 4: Do NOT touch
- Main `SystemsTable` 의 prop 계약 (`SystemsTableProps`)
- 소비처 파일
- Column rendering 로직 내부 변경 (SVG, className 등)
- Sort / pagination 알고리즘
- 다른 대시보드 컴포넌트

## Step 5: Verify
```
npx tsc --noEmit
npm run lint -- app/components/features/dashboard/SystemsTable.tsx app/components/features/dashboard/systems-table/
npm run build
```

LOC 목표:
```
wc -l app/components/features/dashboard/SystemsTable.tsx
# 220 이하
```

수동 검증:
- Dashboard 페이지 렌더 → sort 방향 토글, pagination 이동, filter 변경 동작 확인
- Skeleton row (loading) 표시
- 2-3 화면 시각 회귀 없음

## Step 6: Commit + push + PR

```
git add app/components/features/dashboard/SystemsTable.tsx \
        app/components/features/dashboard/systems-table/
git commit -m "refactor(dashboard): split SystemsTable into 6 children (wave14-B1a)

Audit §B1 — 491 LOC god-component 분할.

- SystemsTable.tsx: 491 → ≤ 220 LOC (main only)
- systems-table/{SortIcon,PillTag,StatusBadge,SkeletonRow,Pagination,columns,types,index}.tsx
- No prop contract change, no consumer modification
- Inline SVG (SortIcon) 은 wave15-H1 으로 deferred"
git push -u origin refactor/wave14-b1a-systems-table
```

PR body (`/tmp/pr-wave14-b1a-body.md`):
```
## Summary
Splits `SystemsTable.tsx` (491 LOC god-component) into a lean main + 6 co-located children under `systems-table/`. No prop contract change.

## Why
- Audit §B1 threshold: 300 LOC → 현재 491
- 5 inline subcomponents + large `columns` array in one file → scope review 부담

## Changes
- `SystemsTable.tsx` 491 → ≤ 220 LOC
- `systems-table/{SortIcon,PillTag,StatusBadge,SkeletonRow,Pagination,columns,types,index}.tsx` (new)

## Deliberately excluded
- Prop contract, consumer files
- SVG migration (SortIcon has inline svg; deferred to wave15-H1)
- Sort/pagination logic
- Any className / styling change

## Verify
- [x] tsc, lint, build
- [x] Dashboard 페이지: sort, paginate, filter, skeleton

## Parallel coordination
- Safe with wave14-B1b/B1c/C1/E1b (disjoint files)

## Ref
- wave12-B1 (ConnectionTestPanel split) 패턴 재사용
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report the URL.

## Return (under 200 words)
1. PR URL
2. tsc / lint / build results
3. Main file LOC before/after + 각 children LOC
4. `columns` 가 factory vs 상수 인지 + 선택 근거
5. Closure 의존성 발견 여부
6. Deviations with rationale

## Parallel coordination
- **파일 overlap 없음** 으로 아래와 병렬 안전:
  - wave14-B1b (IdcProcessStatusCard)
  - wave14-B1c (AzureProjectPage)
  - wave14-C1 (AdminDashboard)
  - wave14-E1b (IdcResourceInputPanel)
