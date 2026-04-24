# Wave 14-C1 — AdminDashboard useReducer Migration

## Context
Audit §C1 🔴 (10+ useState in one file). `AdminDashboard.tsx` = **267 LOC / 12 useState**. wave11-B1 (IdcResourceInputPanel) useReducer 패턴 재적용.

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
target="app/components/features/AdminDashboard.tsx"
loc=$(wc -l < "$target")
states=$(grep -c useState "$target")
echo "LOC=$loc useState=$states (baselines 267/12)"
[ "$states" = "12" ] || echo "⚠️ useState count drifted"
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave14-c1-admin-reducer --prefix refactor
cd /Users/study/pii-agent-demo-wave14-c1-admin-reducer
```

## Step 2: Required reading
1. 전체 `AdminDashboard.tsx` 267 LOC (useState 분포 + handler 의존성)
2. `.claude/skills/anti-patterns/SKILL.md` §C1, §C3, §D6
3. wave11-B1 spec + PR #311 (IdcResourceInputPanel useReducer 선례)
4. wave11-B2 spec + PR #302 (QueueBoard modal discriminated union) — modal 압축 패턴

## Step 3: State cluster 분석

Grep 기준 12 useState (line 32–60):

| Cluster | States | 패턴 |
|---------|--------|------|
| **A. 서비스 목록** | `services`, `selectedService`, `serviceQuery`, `servicePageNum`, `servicePageInfo` (5) | pagination + 검색 — useReducer |
| **B. 프로젝트 목록** | `projects`, `loading` (2) | 단순 fetch — 그대로 유지 가능 |
| **C. Approval 모달** | `showCreateModal`, `approvalDetail`, `approvalLoading` (3) | wave11-B2 discriminated union |
| **D. Action state** | `actionLoading` (1) | 액션 중 로딩 — 단순 유지 |

### 3-1. Cluster A → useReducer

```ts
interface ServiceListState {
  services: ServiceCode[];
  selectedService: string | null;
  query: string;
  pageNum: number;
  pageInfo: ServicePageResponse['page'];
}

type ServiceListAction =
  | { type: 'SET_SERVICES'; services: ServiceCode[]; pageInfo: ServicePageResponse['page'] }
  | { type: 'SELECT'; serviceCode: string | null }
  | { type: 'SET_QUERY'; query: string }
  | { type: 'SET_PAGE'; pageNum: number }
  | { type: 'RESET' };

const serviceListReducer = (state: ServiceListState, action: ServiceListAction): ServiceListState => { ... };
```

Lazy initializer 로 초기값 구성 (wave11-B1 패턴).

### 3-2. Cluster C → discriminated union (wave11-B2 패턴)

```ts
type ApprovalModalState =
  | { status: 'closed' }
  | { status: 'create' }                                  // showCreateModal=true
  | { status: 'loading'; projectId: string }              // approvalLoading=true
  | { status: 'open'; detail: ApprovalDetail }            // approvalDetail set
  | { status: 'error'; message: string };

const [approvalModal, setApprovalModal] = useState<ApprovalModalState>({ status: 'closed' });
```

3 useState → 1.

### 3-3. Cluster B + D → 유지

`loading`, `actionLoading`, `projects` 는 그대로 `useState`. 2-3 개는 C1 기준 (10+) 위반 아님.

### 3-4. 최종 예상 state 카운트

- useReducer (A): 1 reducer
- useState (C): 1 discriminated union
- useState (B, D): 3 (loading, projects, actionLoading)
- **합계: 5 (useReducer 1 + useState 4)**, C1 threshold 하회

### 3-5. 파일 구조

useReducer 구현 + action union + reducer 함수가 크지 않으면 **같은 파일 유지**. 만약 합쳐서 380+ LOC 가 되면 `admin-dashboard/service-list-reducer.ts` 로 분리.

구현 후 예상: ~240 LOC 정도 — 분리 불요.

### 3-6. Handler 의존성 감소

현재 handler 들 (`handleServiceSelect`, `handlePageChange`, `handleApprove`, `handleReject`) 가 많은 useState setter 를 dep 로 가짐. reducer 도입 후:
- `dispatch` 는 stable (deps 없음)
- Handler deps 평균 3–4 개 → 2 이하 (state + dispatch)

## Step 4: Do NOT touch
- Component 의 prop 계약 (AdminDashboard 는 대부분 prop 없는 페이지 레벨)
- JSX 렌더 / styling
- API 호출 로직 (getServices, approveProject 등)
- 소비처 `app/integration/admin/dashboard/page.tsx`
- alert() (이미 wave13-F1b 로 toast 이전됨)
- Sibling admin 컴포넌트

## Step 5: Verify
```
npx tsc --noEmit
npm run lint -- app/components/features/AdminDashboard.tsx
npm run build
```

목표:
```
grep -c useState app/components/features/AdminDashboard.tsx  # ≤ 4
```

수동 검증:
- 관리자 대시보드 페이지 로드
- 서비스 검색/선택/페이지 이동
- 프로젝트 승인 모달 열기/승인/반려/에러/닫기
- 승인 요청 생성 모달
- Action loading 상태 표시 (승인 중 disabled)

## Step 6: Commit + push + PR

```
git add app/components/features/AdminDashboard.tsx
git commit -m "refactor(admin): AdminDashboard useReducer + modal discriminated union (wave14-C1)

Audit §C1 — 12 useState → 4 useState + 1 useReducer (serviceListReducer).

- Cluster A (서비스 목록 5 states) → useReducer(serviceListReducer)
- Cluster C (approval 모달 3 states) → 1 discriminated union (wave11-B2 pattern)
- Cluster B/D (loading, projects, actionLoading) → 유지
- Handler useCallback deps 평균 3-4 → ≤ 2

No prop contract change, no consumer modification, no JSX/styling change."
git push -u origin refactor/wave14-c1-admin-reducer
```

PR body (`/tmp/pr-wave14-c1-body.md`):
```
## Summary
Apply wave11-B1 useReducer + wave11-B2 discriminated-union patterns to `AdminDashboard.tsx` (12 useState → 4).

## Changes
- `serviceListReducer` + `ServiceListAction` discriminated union (Cluster A)
- `ApprovalModalState` discriminated union (Cluster C)
- Handler deps reduction

## Why
- Audit §C1 — 12 useState 는 single page 기준 과함
- Pagination + search + modal 결합이 setState 순서 의존성 버그 생성 가능

## Deliberately excluded
- JSX / styling
- API calls
- alert()/toast (already handled in wave13-F1b)

## Verify
- [x] tsc, lint, build
- [x] Full admin 흐름 수동 검증
- [x] final useState count ≤ 4

## Parallel coordination
- Safe with B1a/B1b/B1c/E1b (different files)
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report the URL.

## Return (under 200 words)
1. PR URL
2. tsc / lint / build
3. useState count before/after
4. Reducer action 종류 수 + 각 action 의 필요성
5. Modal discriminated-union 상태 수 (closed/create/loading/open/error)
6. Handler deps 감소 증거 (before/after sample)
7. Deviations with rationale

## Parallel coordination
- **파일 overlap 없음**:
  - wave14-B1a (`dashboard/SystemsTable`)
  - wave14-B1b (`_components/idc/IdcProcessStatusCard`)
  - wave14-B1c (`_components/azure/AzureProjectPage`)
  - wave14-E1b (`features/idc/IdcResourceInputPanel`)
- 전 병렬 안전
