# Admin refresh flicker fix

> 사용자 버그 2 수정 — `/integration/admin` 에서 갱신 시 전체 InfrastructureList 가 unmount → remount 되면서 펼쳐진 카드 state 와 sibling 카드까지 깜빡이는 현상.

## Context

- 상위 감사 문서: `docs/reports/resource-data-source-audit-2026-04-23.md` §2.9
- 사용자 최초 버그 리포트 2: *"갱신 버튼을 누르는 경우에 깜빡이면서 다른 컴포넌트도 갱신이 되는 것처럼 보여져요."*
- 사용자 버그 1 ("확정 정보를 불러올 수 없어요") 은 PR #335 의 admin InfraCard 404 폴백 + PR #334 의 mock confirmed-integration 채움 으로 이미 해결됨.

## Root cause

`app/components/features/AdminDashboard.tsx:97-103`:

```ts
const refreshProjects = async () => {
  if (!selectedService) return;
  setLoading(true);           // ← 여기서 전체 리스트 unmount 트리거
  const data = await getProjects(selectedService);
  setProjects(data);
  setLoading(false);
};
```

`app/components/features/admin/infrastructure/InfrastructureList.tsx:29-41`:

```tsx
if (loading) {
  return (
    <div className="p-12 text-center">
      ...로딩 중...
    </div>
  );
}
```

**증상**:
- `refreshProjects` 는 `handleApprove` (L126), `handleReject` (L140), `handleConfirmCompletion` (L153) 에서 호출됨.
- 호출되면 `loading === true` 한 순간 `InfrastructureList` 가 **로딩 spinner 로 early-return** → 모든 `InfraCard` children 가 unmount.
- Unmount 된 카드의 `expanded` / `confirmedResources` local state 유실.
- 응답 도착 후 (`setProjects` + `setLoading(false)`) 다시 모든 카드가 remount 되는 **깜빡임 현상**.
- 사용자가 "다른 컴포넌트도 갱신되는 것처럼 보인다" 라고 느끼는 이유 — 실제로는 sibling 카드도 DOM 에서 사라졌다 다시 붙는 것.

## Goal

갱신 시:
- 펼쳐진 카드의 local state (`expanded` / `confirmedResources`) 유지
- Sibling 카드 깜빡임 없음
- 갱신 진행 중임을 **상단 inline 인디케이터** 로만 표시 (전체 리스트는 계속 렌더)

## Scope (in-scope files)

- `app/components/features/AdminDashboard.tsx` — inline 인디케이터 추가 (PageHeader action slot 또는 상단 영역)
- `app/components/features/admin/infrastructure/InfrastructureList.tsx` — loading early-return 제거, 리스트 계속 렌더

## Out of scope (do NOT touch)

- `InfraCard` / `InfraCardHeader` / `InfraCardBody` 내부 로직
- `ApprovalDetailModal` / `ProjectCreateModal` 등 모달
- `ServiceSidebar` loading 패턴 (별개 이슈)
- `refreshProjects` 함수 시그니처 자체 (내부 구현만 유지, 호출부 변경 X)

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f app/components/features/AdminDashboard.tsx ] || { echo "✗ source missing"; exit 1; }
[ -f app/components/features/admin/infrastructure/InfrastructureList.tsx ] || { echo "✗ source missing"; exit 1; }
```

## Step 1 — Worktree

```bash
bash scripts/create-worktree.sh --topic admin-refresh-flicker --prefix fix
cd /Users/study/pii-agent-demo-admin-refresh-flicker
cp /Users/study/pii-agent-demo/.env.local .env.local
npm install
```

## Step 2 — Required reading

1. `docs/reports/resource-data-source-audit-2026-04-23.md` §2.9 (현재 구조 분석)
2. `app/components/features/AdminDashboard.tsx:29-103, 230-239` (refreshProjects + InfrastructureList 사용처)
3. `app/components/features/admin/infrastructure/InfrastructureList.tsx` 전체 (29 LOC)
4. `app/components/features/admin/infrastructure/InfraCard.tsx:29-33` (local state: `expanded`, `confirmedResources`)
5. `app/components/ui/PageHeader.tsx` (action slot prop 구조 확인)

## Step 3 — Implementation

### 3-1. `InfrastructureList` — loading early-return 제거

`app/components/features/admin/infrastructure/InfrastructureList.tsx`:

변경 전 (`:29-45`):
```tsx
if (loading) {
  return (
    <div className="p-12 text-center">
      <div className={cn('w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3', statusColors.info.border)} />
      <p className="text-gray-500 text-sm">로딩 중...</p>
    </div>
  );
}

if (projects.length === 0) {
  return <InfrastructureEmptyState onAddInfra={onAddInfra} />;
}

return (
  <div>
    {projects.map((project) => (...))}
  </div>
);
```

변경 후:
```tsx
// 첫 진입 전용 skeleton — 이미 projects 가 있으면 재갱신이므로 unmount 금지
if (loading && projects.length === 0) {
  return (
    <div className="p-12 text-center">
      <div className={cn('w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3', statusColors.info.border)} />
      <p className="text-gray-500 text-sm">로딩 중...</p>
    </div>
  );
}

if (projects.length === 0) {
  return <InfrastructureEmptyState onAddInfra={onAddInfra} />;
}

return (
  <div aria-busy={loading}>
    {projects.map((project) => (...))}
  </div>
);
```

핵심:
- `loading && projects.length === 0` (첫 진입) 에서만 skeleton 렌더 → 초기 UX 유지
- 재갱신 (`loading && projects.length > 0`) 에서는 **리스트 계속 렌더** → unmount 없음 → 카드 state 유지
- `aria-busy` 속성으로 접근성 통지

### 3-2. `AdminDashboard` — inline 인디케이터 추가

`app/components/features/AdminDashboard.tsx`:

갱신 진행 중임을 사용자가 알 수 있게 `PageHeader` 의 `action` slot 또는 근처에 작은 spinner 표시. 기존 `"타겟 소스 등록"` 버튼 옆에 조건부 렌더.

변경 예시 (`:209-219` 참고):
```tsx
<PageHeader
  title={`${selectedService} ${selectedServiceObj?.name ?? ''}`.trim()}
  action={
    <div className="flex items-center gap-3">
      {loading && projects.length > 0 && (
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          갱신 중
        </span>
      )}
      <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
        ...
        타겟 소스 등록
      </Button>
    </div>
  }
/>
```

- `loading && projects.length > 0` 조건 — 재갱신 상황에서만 표시.
- `<PageHeader>` 의 `action` prop 이 `ReactNode` 를 받는지 검증 후 구조 조정. 만약 단일 버튼만 받도록 제약되어 있으면 별도 영역 (`<PageMeta>` 위 등) 에 배치.

### 3-3. 접근성 검증

- `<div aria-busy={loading}>` 로 screen reader 사용자에게 갱신 진행 상태 전달.
- `aria-live="polite"` 는 추가하지 않음 (inline 인디케이터가 이미 시각적 feedback 제공).

## Step 4 — Do NOT touch

- `InfraCard` 내부 `expanded` / `confirmedResources` state 관리 — 이미 정상 동작 (unmount 만 방지하면 해결)
- `refreshProjects` 함수 — 호출부 3곳 (approve/reject/confirm) 모두 그대로 유지
- `getProjects` API 호출 빈도
- `ApprovalDetailModal` / `ProjectCreateModal`

## Step 5 — Verify

```bash
npx tsc --noEmit
npm run lint -- app/components/features/AdminDashboard.tsx app/components/features/admin/infrastructure/InfrastructureList.tsx
npm run build
```

수동 검증:
1. `bash scripts/dev.sh /Users/study/pii-agent-demo-admin-refresh-flicker`
2. `/integration/admin` 진입 → 서비스 선택 → 리스트 정상 렌더 확인
3. step 4 (INSTALLING) / step 6 (CONNECTION_VERIFIED) TargetSource 카드 펼치기
4. 같은 서비스의 **다른 TargetSource** 에서 "설치 완료 확정" 클릭 (step 6 → 7 transition)
5. 확인:
   - 펼쳐진 카드: unmount 되지 않음, `expanded` / `confirmedResources` state 유지
   - Sibling 카드: 깜빡임 없음
   - PageHeader 근처 "갱신 중" 인디케이터 잠깐 표시 후 사라짐
6. 초기 진입 (서비스 전환) 시: 기존 skeleton 유지 확인

### 회귀 체크

- `ServiceSidebar` 의 서비스 선택 → 다른 서비스로 전환 시: `projects` 가 `setLoading(true)` + `getProjects` 호출로 교체됨. 이 케이스는 "첫 진입" 과 같은 skeleton 상태가 되어야 하는데, 구현에 따라 `projects` 가 잠시 이전 서비스 데이터를 보여줄 수 있음. → 필요 시 `selectedService` 변경 시 `setProjects([])` 호출하는 라인을 `fetchServiceData` 앞에 추가.

## Step 6 — Commit + push + PR

```
fix(admin): refreshProjects 시 InfrastructureList unmount 방지 (admin-refresh-flicker)

근거: docs/reports/resource-data-source-audit-2026-04-23.md §2.9.

사용자 버그 2 수정: /integration/admin 에서 승인/반려/설치완료 확정 후 refreshProjects 실행 시 전체 InfrastructureList 가 unmount → remount 되면서 펼쳐진 InfraCard 의 local state 와 sibling 카드까지 깜빡임.

- InfrastructureList: loading === true 에서 전체 리스트를 spinner 로 early-return 하던 로직을 "첫 진입(projects.length === 0)" 에서만 유지하도록 좁힘. 재갱신에서는 리스트 계속 렌더하고 aria-busy 만 표시.
- AdminDashboard: PageHeader action slot 에 inline "갱신 중" 인디케이터 추가 (loading && projects.length > 0 조건).

영향 없음:
- refreshProjects 함수 시그니처 / 호출부 3곳 (approve/reject/confirm)
- InfraCard 내부 state 관리
- 초기 진입 skeleton UX

Out of scope: ServiceSidebar 의 서비스 전환 loading 패턴 (별개 이슈).
```

## Step 7 — Self-review

`/sit-recurring-checks` → `/simplify` → `/vercel-react-best-practices` 순차. React 컴포넌트 2 개만 건드리므로 vercel skill 포함 필수 (초기 진입 guard / dependency array / aria-busy 사용 검증).

## Return (under 200 words)

1. PR URL
2. `tsc` / `lint` / `build` 결과
3. 수동 검증 결과 (펼친 카드 state 유지 확인 — PASS/FAIL)
4. 초기 진입 skeleton UX 유지 여부
5. `/pr-context-review` 적용 / defer 내역
6. Spec deviation 있으면 명시
