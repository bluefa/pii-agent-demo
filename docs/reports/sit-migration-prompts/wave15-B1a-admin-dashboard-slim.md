# Wave 15-B1a — AdminDashboard Slim-Down

## Context
wave14-C1 (#346) 에서 AdminDashboard 를 useReducer + modal union 으로 변환 후 **267 → 347 LOC 로 증가** (reducer boilerplate). 이제 B1 (300+) 위반. 내부 reducer/action/modal type 을 sibling 파일로 추출해 main 축소 + 잔여 E5 2건 inline fix.

## Audit baseline (main @ `a1c42fa`)

- `AdminDashboard.tsx`: **347 LOC** (B1 위반)
- E5 template className: **2 사이트 (line 286, 287)**
- useState (reducer 제외): 4 (C1 OK)

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
target="app/components/features/AdminDashboard.tsx"
loc=$(wc -l < "$target")
e5=$(grep -cE 'className=\{`[^`]*\$\{' "$target")
echo "LOC=$loc E5=$e5 (baselines 347/2)"
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave15-b1a-admin-slim --prefix refactor
cd /Users/study/pii-agent-demo-wave15-b1a-admin-slim
```

## Step 2: Required reading
1. `AdminDashboard.tsx` 전체
2. wave14-C1 spec + PR #346 (현 구조 이해)
3. 소비처: `app/integration/admin/dashboard/page.tsx`
4. `.claude/skills/anti-patterns/SKILL.md` §B1, §E5

## Step 3: Target structure

```
app/components/features/admin-dashboard/
├── serviceListReducer.ts        (ServiceListState + Action + reducer, ~50 LOC)
├── approvalModalState.ts        (ApprovalModalState union + helpers, ~30 LOC)
├── types.ts                      (ApprovalDetail etc.)
└── index.ts

app/components/features/AdminDashboard.tsx  (main, target ≤ 240 LOC)
```

### 3-1. 분할 매핑

| 현 위치 | 이동처 |
|--------|--------|
| L30–37 `ServiceListState` | `admin-dashboard/serviceListReducer.ts` |
| L38–43 `ServiceListAction` | 동일 |
| L44–51 `buildInitialServiceListState` | 동일 |
| L52–67 `serviceListReducer` | 동일 |
| L68–80 `ApprovalDetail` type | `admin-dashboard/types.ts` |
| L81–86 `ApprovalModalState` | `admin-dashboard/approvalModalState.ts` |
| L87–end `AdminDashboard` component | `AdminDashboard.tsx` 유지 |

### 3-2. E5 inline fix (2 사이트)

Line 286, 287 template-literal className → `cn()` helper:

```tsx
// Before
<span className={`inline-flex items-center gap-1.5 text-xs ${textColors.tertiary}`}>
<span className={`w-3 h-3 border-2 ${statusColors.pending.border} border-t-transparent rounded-full animate-spin`} />

// After
<span className={cn('inline-flex items-center gap-1.5 text-xs', textColors.tertiary)}>
<span className={cn('w-3 h-3 border-2 border-t-transparent rounded-full animate-spin', statusColors.pending.border)} />
```

`cn` 이 이미 import 되어 있는지 확인, 없으면 추가.

### 3-3. index.ts

```ts
export { serviceListReducer, buildInitialServiceListState } from './serviceListReducer';
export type { ServiceListState, ServiceListAction } from './serviceListReducer';
export type { ApprovalModalState } from './approvalModalState';
export type { ApprovalDetail } from './types';
```

## Step 4: Do NOT touch
- `AdminDashboard` prop 계약 (현재 prop 없는 page-level)
- 소비처 `app/integration/admin/dashboard/page.tsx`
- Handler 로직 (API calls, approval flow)
- 다른 admin 컴포넌트
- alert → toast migration (이미 wave13-F1b)

## Step 5: Verify
```
npx tsc --noEmit
npm run lint -- app/components/features/AdminDashboard.tsx app/components/features/admin-dashboard/
npm run build
```

최종:
```
wc -l app/components/features/AdminDashboard.tsx  # ≤ 240
grep -cE 'className=\{`[^`]*\$\{' app/components/features/AdminDashboard.tsx  # 0
```

수동:
- 관리자 대시보드 전체 흐름 (서비스 검색 / 프로젝트 로드 / approval 모달 full loop)
- 로딩 spinner 시각 회귀 없음 (E5 교체 결과)

## Step 6: Commit + push + PR
```
git add app/components/features/AdminDashboard.tsx \
        app/components/features/admin-dashboard/
git commit -m "refactor(admin): slim down AdminDashboard + fix 2 E5 (wave15-B1a)

- Move serviceListReducer / ApprovalModalState / ApprovalDetail to sibling files
- Main 347 → ≤ 240 LOC
- 2 template-literal className → cn() (L286, L287)
- No behavior change"
git push -u origin refactor/wave15-b1a-admin-slim
```

PR body (`/tmp/pr-wave15-b1a-body.md`):
```
## Summary
wave14-C1 후 증가한 AdminDashboard 347 LOC → ≤ 240 LOC. Reducer / union / types 를 `admin-dashboard/` 로 추출. 잔여 E5 2건 동시 fix.

## Changes
- `admin-dashboard/{serviceListReducer,approvalModalState,types,index}.ts` (new)
- `AdminDashboard.tsx` 347 → ≤ 240
- Line 286, 287 template className → cn()

## Deliberately excluded
- Handler 로직, API, JSX 구조

## Parallel coordination
- Safe with wave15-C1, B1b, B1c, H1 (disjoint files)
```

## ⛔ Do NOT auto-merge
Stop at PR create. Report URL.

## Return (under 200 words)
1. PR URL
2. tsc / lint / build
3. LOC before/after + E5 grep count before/after
4. 새 파일별 LOC
5. Deviations with rationale
