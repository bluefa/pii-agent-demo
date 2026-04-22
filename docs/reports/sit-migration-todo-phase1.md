# SIT Migration — Phase 1 Todo List (서비스 목록 + TargetSource 상세)

**작성일**: 2026-04-22
**범위**: 서비스 목록 조회 화면(`/integration/admin`) + TargetSource 상세 화면(`/integration/projects/[projectId]`)
**제외**: 연동 대상 생성 모달(Screen 2 / ProjectCreateModal) — Phase 2로 이연
**상위 계획 문서**: [`docs/reports/sit-prototype-migration-plan.md`](./sit-prototype-migration-plan.md)
**디자인 원본**: [`design/SIT Prototype.html`](../../design/SIT%20Prototype.html)

---

## 0. 이 문서 읽는 법 (여러 세션 동시 작업 안내)

이 문서는 **Ground Truth**다. 각 세션은 아래 규칙을 지킨다:

1. **시작 전**: 본 문서를 전체 읽고, 상위 계획 문서(`sit-prototype-migration-plan.md`)를 해당 섹션까지 읽는다.
2. **작업 청구**: 집어들 Todo의 `담당 세션` 칸을 본인 식별자로 채우는 커밋을 먼저 올린다 (또는 PR에 `[WIP-T#]` 라벨).
3. **파일 충돌 회피**: §3 파일 충돌 매트릭스에서 자기 Todo가 건드릴 파일을 확인하고, 동시에 건드리는 다른 Todo가 진행 중이면 **대기**한다.
4. **의존성 준수**: 각 Todo의 `선행 조건(Blocks)`이 완료(=main merge)되기 전까지는 시작하지 않는다.
5. **완료 처리**: 각 Todo 상단 체크박스 + `상태` 필드를 `Done (PR #xxx)` 으로 갱신하는 커밋.
6. **Phase 0 오픈 이슈**: §4에 정리된 8개 결정 사항은 해당 Todo 시작 전 사용자에게 확인. 미확정 이슈가 있으면 Todo 시작 금지.

### 공통 컨텍스트 (모든 세션 필독)

- **프로젝트**: Next.js 14 App Router · TypeScript · TailwindCSS · Desktop only · 한국어 UI
- **디자인 시스템**: `lib/theme.ts` 토큰만 사용. raw 색상 클래스 금지 (CLAUDE.md ⛔ 4번).
- **상태 기계**: `ProcessStatus` enum (7개 상태). `lib/types.ts` 참조. 이번 범위에서 **enum 값은 건드리지 않는다** (T9 참조).
- **Cloud Provider 분기**: AWS/Azure/GCP/IDC/SDU 5종. `app/projects/[projectId]/{aws,azure,gcp,idc,sdu}/*ProjectPage.tsx` 모두 동등하게 지원.
- **ADR 준수**: ADR-007 (BFF 2-hop), ADR-006 (승인→반영→설치 병합). route.ts에서 response.json() 파싱 금지.
- **⛔ 금칙**: main 직접 수정 / `any` 타입 / 상대 경로 import / raw 색상 클래스.
- **Git 규칙**: `bash scripts/create-worktree.sh --topic {name} --prefix feat/`. Push/PR 전 `git fetch origin main && git rebase origin/main` 필수.

---

## 1. Todo 목록 (한눈에)

### Foundation 트랙 (모든 작업의 전제)

- [ ] **T1** — 디자인 토큰 확장 (`lib/theme.ts`) — P1, 독립, ~80 LOC
- [ ] **T2** — 공통 UI 컴포넌트 (Breadcrumb / PageHeader / PageMeta) — P1, T1 의존, ~160 LOC
- [ ] **T3** — TopNav 컴포넌트 + admin segment layout — P1, T1·T2 의존, ~180 LOC

### 서비스 목록 트랙 (Track A)

- [ ] **A1 (T4)** — ServiceSidebar 개편 (280px, 새 아이템 스타일, 하단 푸터 링크) — P2, T1 의존, ~120 LOC
- [ ] **A2 (T5)** — AdminDashboard Shell 재구성 (Breadcrumb/PageHeader/PageMeta 통합) — P2, T2·T3·A1 의존, ~150 LOC
- [ ] **A3 (T6)** — InfraCard 서브컴포넌트 6개 설계/구현 — P2, T1 의존, ~500 LOC
- [ ] **A4 (T7)** — AdminDashboard에 InfrastructureList 통합 + ProjectsTable 제거 — P2, A2·A3 의존, ~200 LOC
- [ ] **A5 (T8)** — PermissionsPanel 위치 재배치 (드로어 전환) — P3, A2 의존, ~250 LOC

### TargetSource 상세 트랙 (Track B)

- [ ] **B1 (T9)** — StepProgressBar 7-step 확장 — P2, T1 의존, ~100 LOC
- [ ] **B2 (T10)** — GuideCard (warm variant) 컴포넌트 + 콘텐츠 매핑 — P2, T1 의존, ~200 LOC
- [ ] **B3 (T11)** — `app/integration/projects/[projectId]/layout.tsx` 생성 (TopNav 없음) — P1, T3 의존, ~30 LOC
- [ ] **B4 (T12)** — ProjectDetail Shell 재구성 (5 provider pages) — P2, T2·B1·B2·B3 의존, ~600 LOC
- [ ] **B5 (T13)** — ProjectHeader → PageMeta 전환 — P2, T2·B4 의존, ~80 LOC
- [ ] **B6 (T14)** — ScanPanel Headless 전환 (렌더-props) — P2, B4 의존, ~300 LOC
- [ ] **B7 (T15)** — Scan State UI 3종 (Empty/Running/Error) — P2, B6 의존, ~250 LOC
- [ ] **B8 (T16)** — ResourceTable → DbSelectionTable 컬럼 재구성 — P3, B6·B7 의존, ~400 LOC

### 마무리 트랙

- [ ] **T17** — Phase 1 E2E regression + 토큰 정리 PR — P3, 전체 Track A·B 완료 후

---

## 2. 의존성 그래프

```
T1 (theme)
 ├─→ T2 (shared UI)          ───┬──→ A2, B4, B5
 ├─→ T3 (TopNav + admin layout)─┴──→ A2, B3
 ├─→ A1 (ServiceSidebar)     ─────→ A2
 ├─→ A3 (InfraCard)          ─────→ A4
 ├─→ B1 (StepProgressBar)    ─────→ B4
 └─→ B2 (GuideCard)          ─────→ B4

A2 (Admin Shell) ─→ A4 (Integrate InfraList) ─→ A5 (Permissions drawer)
B3 (Detail layout) ─→ B4 (Detail Shell) ─→ B5 (PageMeta)
                                          ─→ B6 (ScanPanel headless) ─→ B7, B8

T17 (정리) ← 모든 것
```

**병렬 실행 가능한 조합** (권장):
- `T1` 단독 실행 (첫 단계) → merge 후:
  - `T2` + `T3` + `A1` + `A3` + `B1` + `B2` 을 **동시 6개 세션 병렬** 가능 (서로 다른 파일).
- 위가 모두 merge되면:
  - `A2` 와 `B3` 병렬 가능 → 각각 merge 후 → `A4`와 `B4` 병렬 가능.
- `B4` merge 후 `B5` + `B6` 병렬 → `B6` merge 후 `B7` → `B8`.
- 마지막 `T17` 단독.

---

## 3. 파일 충돌 매트릭스

같은 파일을 동시에 수정하는 Todo는 **시간차 실행 필수**. 색상: 🟢 독립 / 🟡 주의 (같은 파일) / 🔴 금지 (강한 충돌).

| Todo | 주 수정 파일 | 다른 Todo와 충돌 |
|---|---|---|
| T1 | `lib/theme.ts` | 🟢 단독 |
| T2 | `app/components/ui/{Breadcrumb,PageHeader,PageMeta}.tsx` (신규) | 🟢 신규만 |
| T3 | `app/components/layout/TopNav.tsx` (신규), `app/integration/admin/layout.tsx` (신규), `lib/routes.ts` | 🟡 `lib/routes.ts` B3와 경합 가능 — B3가 먼저/나중 명확히 |
| A1 | `app/components/features/admin/ServiceSidebar.tsx` | 🟢 단독 |
| A2 | `app/components/features/AdminDashboard.tsx` | 🔴 A4, A5와 동일 파일. **순차 필수** |
| A3 | `app/components/features/admin/infrastructure/*` (신규 디렉토리) | 🟢 신규 |
| A4 | `app/components/features/AdminDashboard.tsx`, `app/components/features/admin/ProjectsTable.tsx` (삭제) | 🔴 A2 후. A5 전 |
| A5 | `app/components/features/AdminDashboard.tsx`, `app/components/features/admin/PermissionsPanel.tsx` | 🔴 A4 후 |
| B1 | `app/components/features/process-status/StepProgressBar.tsx` | 🟢 단독 |
| B2 | `app/components/features/process-status/GuideCard.tsx` (신규), `lib/constants/process-guides.ts` | 🟢 신규+단독 |
| B3 | `app/integration/projects/[projectId]/layout.tsx` (신규), `lib/routes.ts` | 🟡 T3와 `lib/routes.ts` 경합 |
| B4 | `app/projects/[projectId]/{aws,azure,gcp,idc,sdu}/*ProjectPage.tsx` (5개) | 🔴 B5, B6과 파일 겹침. B5는 `ProjectHeader`만 건드리면 분리 가능. **같은 5개 파일을 B4/B5/B6이 모두 수정하므로 엄격 순차** |
| B5 | `app/projects/[projectId]/common/ProjectHeader.tsx` (→PageMeta 전환) | 🟡 B4 이후 |
| B6 | `app/components/features/scan/ScanPanel.tsx` (headless 전환) | 🟢 (B4 이후) 단독 |
| B7 | `app/components/features/scan/Scan{Empty,Running,Error}State.tsx` (신규) | 🟢 신규 |
| B8 | `app/components/features/ResourceTable.tsx`, `app/components/features/resource-table/*` | 🟡 B7 이후 |
| T17 | 여러 파일 정리 | 🔴 전체 이후 |

**팁**: 같은 파일을 건드리는 Todo는 "다른 브랜치에서 하되 merge 순서를 준수"하는 것만으로는 부족. **이전 Todo의 PR이 main에 merge된 후** 다음 Todo를 시작하는 게 원칙.

---

## 4. Phase 0 선결 이슈 (이번 범위 한정 — 작업 시작 전 결정 필수)

| # | 이슈 | 영향 Todo | 현재 제안 | 사용자 결정 |
|---|---|---|---|---|
| I-01 | PermissionsPanel 위치 (드로어 vs 상단 축소 vs 제거) | A2, A5 | 우측 슬라이드 드로어 + admin header 우측에 "권한 관리" 버튼 | ⏳ 미정 |
| I-02 | InfraCard 헤더 액션 배치 (관리 버튼과 ProcessStatus CTA 공존 방식) | A3, A4 | 헤더 우측: [ProcessStatus 배지/CTA] + [관리 split 버튼] 두 영역 | ⏳ 미정 |
| I-03 | TargetSource 상세에서 `AwsInfoCard/ProjectInfoCard` 표시 방법 | B4 | 상단 PageMeta 4kv로 핵심만, "상세 정보 보기" 링크 → 우측 드로어 | ⏳ 미정 |
| I-04 | Step 06 "관리자 승인 대기" 구현 방식 | B1 | 신규 ProcessStatus 추가 없이 라벨만. `CONNECTION_VERIFIED`를 이 단계로 표시 | ⏳ 미정 |
| I-05 | ScanHistoryList / CooldownTimer 처리 | B6 | 카드 우상단 "스캔 이력" 링크 → 모달 분리하여 보존 | ⏳ 미정 |
| I-06 | "스캔 이력" 컬럼 (NEW/CHANGED) 백엔드 지원 여부 | B8 | BFF 지원 확인 전까지 컬럼 숨김 처리 (feature flag) | ⏳ 미정 |
| I-07 | 상세 페이지 복귀 UX 보강 (TopNav 없으므로) | B4 | Breadcrumb + PageHeader 좌측 `← 목록으로` ghost 버튼 | ⏳ 미정 |
| I-08 | 미구현 상단 메뉴 (Credentials/PII Tag/PII Map) nav 표시 | T3 | 표시하되 클릭 시 "Coming soon" 토스트 | ⏳ 미정 |

**⚠️ 원칙**: 해당 이슈 미확정 상태로 Todo를 시작하지 말 것. 진행 후 되돌리는 비용이 훨씬 크다.

---

## 5. Todo 상세 스펙

각 Todo는 **자가 완결 브리프** 형식이다. 다른 세션이 이 문서만 보고도 작업 착수 가능하도록 작성.

---

### T1 — 디자인 토큰 확장 (`lib/theme.ts`)

- **상태**: ⏳ Pending
- **담당 세션**: _미할당_
- **우선순위**: P1 (모든 작업의 전제)
- **선행 조건**: 없음
- **후행 Todo**: T2, T3, A1, A3, B1, B2
- **예상 LOC**: ~80 추가

**Goal**
모든 후속 Todo가 raw hex 없이 사용할 수 있도록 `lib/theme.ts`에 신규 토큰 섹션을 추가한다.

**전체 맥락**
프로토타입 `design/SIT Prototype.html`은 CSS 변수(`--bg-muted`, `--color-primary-50` 등)와 직접 색상(`#0F172A`, `#FFFDF5`)을 혼용한다. 우리 코드는 `lib/theme.ts` 토큰만 사용해야 하므로(⛔ 4번), 필요한 색상·스타일을 **먼저 상수화**해야 이후 Todo가 일관되게 작업할 수 있다.

**추가할 토큰** (상위 계획 §4-1 참조)
```ts
// navStyles: TopNav 전용
export const navStyles = {
  bg: 'bg-slate-900',
  brandGradient: 'bg-gradient-to-br from-[#0064FF] to-[#4F46E5]',  // 예외적 허용 — brand
  link: {
    inactive: 'text-slate-300 hover:bg-white/5 hover:text-white',
    active: 'text-white bg-white/10',
  },
  user: {
    avatar: 'bg-slate-600 text-white',
    email: 'text-slate-300',
  },
};

// cardStyles.warmVariant: GuideCard 전용
cardStyles.warmVariant = {
  container: 'bg-amber-50/40 border-amber-200',
  header: 'bg-gradient-to-b from-amber-100/50 to-amber-50/30 border-b border-amber-200',
  icon: 'bg-amber-500 text-white',
  titleText: 'text-amber-900',
};

// tagStyles: 인라인 색상 태그 (DB Type, 연동 대상/비대상 등)
export const tagStyles = {
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-700',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  orange: 'bg-orange-100 text-orange-800',
  amber: 'bg-amber-100 text-amber-800',
};

// mgmtGroupStyles: Screen 3의 "관리" split 버튼
export const mgmtGroupStyles = {
  primary: 'bg-[var(--color-primary)] text-white rounded-l-md',  // primary token 경유
  more: 'bg-[var(--color-primary)] text-white rounded-r-md border-l border-white/20',
  menu: 'absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[160px]',
};
```

**관련 파일**
- 수정: `lib/theme.ts`

**검증**
- `npm run type-check` 통과
- `npm run lint` 통과
- **사용하는 Todo 없이는 시각 검증 불가** — 다음 Todo가 이 토큰을 실제로 쓰는 시점에 확인.

**주의**
- 기존 토큰 이름과 충돌 없는지 grep으로 사전 확인.
- `brandGradient`의 raw hex는 브랜드 색으로 예외 허용. 단, 단일 상수로만 정의하고 UI 측에서 문자열로 중복 사용 금지.

---

### T2 — 공통 UI 컴포넌트 (Breadcrumb / PageHeader / PageMeta)

- **상태**: ⏳ Pending
- **담당 세션**: _미할당_
- **우선순위**: P1
- **선행 조건**: T1
- **후행 Todo**: A2, B4, B5
- **예상 LOC**: ~160

**Goal**
서비스 목록·TargetSource 상세 양쪽에서 재사용할 **Breadcrumb · PageHeader · PageMeta** 3종 primitive 컴포넌트를 `app/components/ui/`에 추가한다.

**전체 맥락**
시안의 모든 메인 화면은 `Breadcrumb → PageTitle → Page Meta(kv 4개 인라인) → 카드 영역` 구조를 공유한다 (시안 L157-171, L820-825, L990-995). 현재 코드는 `ProjectHeader`가 Header+Breadcrumb을 뭉쳐서 들고 있고, AdminDashboard에는 Breadcrumb이 없다. 이걸 공통화해야 이후 Todo(A2, B4)가 같은 컴포넌트를 주입하는 식으로 단순화된다.

**스펙**

#### `Breadcrumb.tsx`
```tsx
interface BreadcrumbProps {
  crumbs: Array<{ label: string; href?: string }>;  // 마지막 항목은 href 없음(=current)
}
// 스타일: text-xs text-gray-500, '›' 구분자 (mx-1.5), current는 text-gray-700
// href가 있으면 <Link>, 없으면 <span>
// 시안 참고: L157-163
```

#### `PageHeader.tsx`
```tsx
interface PageHeaderProps {
  title: React.ReactNode;    // 예: "Big Data Platform (999)"
  subtitle?: string;
  action?: React.ReactNode;  // 예: 우측 "인프라 삭제" 버튼
  backHref?: string;         // 좌측 "← 목록으로" ghost 버튼 (I-07 결정에 따라 사용)
}
// 스타일: title 24px font-bold tracking-tight, flex justify-between items-start
// 시안 참고: L166-168
```

#### `PageMeta.tsx`
```tsx
interface PageMetaProps {
  items: Array<{ label: string; value: React.ReactNode }>;
}
// 스타일: flex flex-wrap gap-7, 각 항목은 column (label 11px uppercase tracking-wide text-gray-500 / value 13px font-medium)
// 시안 참고: L168-172
```

**관련 파일**
- 신규: `app/components/ui/Breadcrumb.tsx`
- 신규: `app/components/ui/PageHeader.tsx`
- 신규: `app/components/ui/PageMeta.tsx`

**검증**
- Storybook 없음 — 간이 확인을 위해 `/integration/admin`에 임시 렌더링하여 시각 대조. 완료 후 임시 코드는 되돌림.
- a11y: Breadcrumb은 `<nav aria-label="breadcrumb">`로 감싸고 current 항목은 `aria-current="page"`.

**주의**
- `cn`, `textColors`, `borderColors` 등 기존 theme helper 적극 사용.
- 반응형 불필요 (Desktop only).

---

### T3 — TopNav + admin segment layout

- **상태**: ⏳ Pending
- **담당 세션**: _미할당_
- **우선순위**: P1
- **선행 조건**: T1, T2 (권장)
- **후행 Todo**: A2, B3
- **예상 LOC**: ~180
- **Phase 0 의존**: I-08

**Goal**
`TopNav` 컴포넌트를 신규 작성하고, `app/integration/admin/layout.tsx`(신규)에만 주입한다. 루트 `app/layout.tsx`에는 넣지 않는다 (TargetSource 상세 페이지는 TopNav 없음 요건 — 사용자 확정).

**전체 맥락**
시안 L28-75에 정의된 slate-900 색상의 상단 바. 로고(브랜드 그라디언트 배지 "SIT"), 메뉴 4개(Service List 활성 / Credentials, PII Tag mgmt., PII Map — 미구현), 우측 사용자 영역(이메일 + 이니셜 avatar). **관리자/서비스 목록 섹션에서만 노출**하고 상세 페이지에서는 숨긴다 (사용자 결정).

**스펙**
```tsx
// app/components/layout/TopNav.tsx
export const TopNav = () => {
  // height 56px, bg navStyles.bg
  // Brand: 그라디언트 배지 8x8 rounded w/ dot + "SIT" + small "Self Installation Tool"
  // Nav links (icons + label):
  //   - Service List (active on /integration/admin*)
  //   - Credentials (disabled → I-08 결정에 따라)
  //   - PII Tag mgmt.
  //   - PII Map
  // Right: user email + 2-char avatar
};

// app/integration/admin/layout.tsx
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      {children}
    </>
  );
}
```

**라우팅 상수**
`lib/routes.ts`에 스텁 추가:
```ts
integrationRoutes.credentials = '/integration/credentials';  // 미구현 — disabled 표시
integrationRoutes.piiTag = '/integration/pii-tag';
integrationRoutes.piiMap = '/integration/pii-map';
```

**관련 파일**
- 신규: `app/components/layout/TopNav.tsx`
- 신규: `app/integration/admin/layout.tsx`
- 수정: `lib/routes.ts`

**검증**
- `/integration/admin` 접속 → TopNav 렌더, Service List 활성 표시.
- `/integration/projects/123` 접속 → **TopNav 보이지 않아야 함** (B3 Todo에서 별도 레이아웃으로 차단되기 전까지는 상위 루트 레이아웃으로 fallback되어 현행 상태 유지 — 루트에는 TopNav를 넣지 않으므로 OK).
- 미구현 메뉴 클릭 시 동작 = I-08 결정대로.

**주의**
- `lib/routes.ts`를 B3도 건드리므로, B3 착수 세션과 순서 조율. 먼저 착수하는 쪽이 상수 3개를 같이 추가해도 무방.
- `active` 판정은 `pathname.startsWith('/integration/admin')`로 느슨하게.

---

### A1 (T4) — ServiceSidebar 개편

- **상태**: ⏳ Pending
- **담당 세션**: _미할당_
- **우선순위**: P2
- **선행 조건**: T1
- **후행 Todo**: A2
- **예상 LOC**: ~120

**Goal**
`ServiceSidebar.tsx` 의 폭·타이포·선택 스타일·하단 푸터를 시안(L80-147)에 맞게 개편한다.

**전체 맥락**
현행 폭 `w-64` (256px), 좌측 4px 세로바로 선택 표시, projectCount 배지 포함. 시안은 280px·전체 테두리 박스 선택·하단 Notice/Guide/FAQ 링크 3개.

**변경 매트릭스** (상위 계획 §3-2)
| 항목 | 현행 | 신규 |
|---|---|---|
| 너비 | `w-64` | `w-[280px]` |
| 타이틀 | "서비스 코드" | "Service List" (15px font-semibold) |
| 검색 placeholder | "서비스 검색..." | "Service name or Service Code" |
| 선택 스타일 | 좌측 4px blue bar + bgLight | `primary-50` 배경 + 1px primary 테두리 (box) |
| 아이템 구조 | code + name + projectCount 배지 | code(13px 600) + name(12px) — 배지 제거 |
| 하단 | pager만 | pager + 구분선 + Notice/Guide/FAQ 링크 |

**관련 파일**
- 수정: `app/components/features/admin/ServiceSidebar.tsx`

**검증**
- `/integration/admin` 에서 서비스 선택/검색/페이지네이션 회귀 없음.
- 푸터 링크 3개는 클릭 시 `#`로 둔다 (미구현 페이지). 실제 라우팅은 T3에서 처리된 상수 참조.

**주의**
- `projectCount` 배지 제거해도 AdminDashboard에서 프로퍼티를 `projectCount={0}`으로라도 유지 (A2에서 제거되므로 당장은 prop 유지).

---

### A2 (T5) — AdminDashboard Shell 재구성

- **상태**: ⏳ Pending
- **담당 세션**: _미할당_
- **우선순위**: P2
- **선행 조건**: T2, T3, A1
- **후행 Todo**: A4, A5
- **예상 LOC**: ~150

**Goal**
`AdminDashboard.tsx`의 상단 Shell을 `<Breadcrumb>` + `<PageHeader>` + `<PageMeta>` 조합으로 교체한다. 기존 `AdminHeader` 제거 (TopNav가 그 역할 수행).

**전체 맥락**
현재 구조:
```
AdminHeader (로고+nav+user) → ServiceSidebar → main에서 Service header + 2-col grid(PermissionsPanel + ProjectsTable)
```

신규 구조:
```
<TopNav> (admin layout에서) → ServiceSidebar 280px → main: Breadcrumb + PageHeader + PageMeta + InfrastructureList
```

**주의**: 이 Todo에서는 `ProjectsTable`을 건드리지 않는다. 일단 기존 `ProjectsTable`을 그대로 렌더링하고, A4에서 교체한다. 이렇게 해야 PR이 작게 유지되고 회귀 체크가 단순해진다.

**변경 사항**
1. `<AdminHeader />` 제거 (TopNav로 대체됨).
2. `<Breadcrumb crumbs={[{label:'SIT Home', href:'/'}, {label:'Service List'}]} />` 추가.
3. `selectedService` 이후 표시되는 service header를 `<PageHeader>` + `<PageMeta>`로 전환.
   - PageMeta 항목(4개): "부문/총괄", "사업부/법인", "연관 시스템 코드", "담당자" — 현재 `ServiceCode` 타입에 해당 필드가 있는지 확인하고 없으면 placeholder `-`.
4. `grid grid-cols-[320px_1fr]` 2-column은 일단 유지 (PermissionsPanel + ProjectsTable). **A5에서 드로어로 전환 예정**. 이번 Todo에서는 프로토타입 카드 상단만 구현.

**관련 파일**
- 수정: `app/components/features/AdminDashboard.tsx`
- 제거 예정: `app/components/features/admin/AdminHeader.tsx` (삭제 OR export 남겨두고 사용처 0 처리 후 T17에서 제거)

**검증**
- 서비스 선택/검색/페이지 이동 회귀 없음.
- PermissionsPanel 여전히 동작.
- ProjectsTable에서 승인 요청 확인/설치 완료 확정 액션 모두 정상.

**주의**
- `ServicePageInfo`, debounce search 등 기존 hook/state는 모두 유지.
- `ServiceCode` 타입이 총괄/법인 등을 반환하지 않는다면 PageMeta는 `code`/`name` 등 가용 필드만 노출 (빈 것은 `-`).

---

### A3 (T6) — InfraCard 서브컴포넌트 6개 신규 구현

- **상태**: ⏳ Pending
- **담당 세션**: _미할당_
- **우선순위**: P2
- **선행 조건**: T1
- **후행 Todo**: A4
- **예상 LOC**: ~500 (신규)
- **Phase 0 의존**: I-02

**Goal**
시안 Screen 3의 아코디언 카드 구조를 담당할 컴포넌트 세트를 신규 디렉토리에 구현한다. **이 Todo에서는 AdminDashboard와의 통합은 하지 않는다** (A4 담당).

**전체 맥락**
시안 L223-330, L873-968의 `.infra-card` UI. Provider 세로 컬러바 + 요약 kv 인라인 + split 버튼 + (expanded 시) DB 테이블. 각 `Project`(=TargetSource)를 1개 카드로 본다.

**파일 구조**
```
app/components/features/admin/infrastructure/
├── index.ts
├── InfrastructureList.tsx        # 컨테이너
├── InfraCard.tsx                 # 아코디언 1개
├── InfraCardHeader.tsx           # 헤더 row
├── InfraCardBody.tsx             # 펼침 영역 (DB 테이블 래퍼)
├── InfraDbTable.tsx              # DB 목록 테이블
├── InfrastructureEmptyState.tsx  # empty
└── ManagementSplitButton.tsx     # "관리" + 케밥 메뉴
```

**스펙 (InfrastructureList)**
```tsx
interface InfrastructureListProps {
  projects: ProjectSummary[];
  loading: boolean;
  onAddInfra: () => void;
  onOpenDetail: (targetSourceId: number) => void;
  onManageAction: (action: 'view' | 'delete', targetSourceId: number) => void;
  // ProcessStatus별 CTA (기존 ProjectsTable에서 가져옴) - I-02 결정에 따라 확장
  actionLoading: string | null;
  onConfirmCompletion: (targetSourceId: number, e: React.MouseEvent) => void;
  onViewApproval?: (project: ProjectSummary, e: React.MouseEvent) => void;
}
```

**스펙 (InfraCard)**
```tsx
interface InfraCardProps {
  project: ProjectSummary;
  expanded: boolean;
  onToggle: () => void;
  // ... (이하 dashboard가 전달하는 액션들)
}
// 헤더 클릭 → onToggle
// Expanded 시 InfraCardBody 렌더
```

**시각 스펙**
- Provider 세로 컬러바: `providerColors[provider].bar` 또는 기존 `border-l-4`. 토큰 없으면 T1에서 추가 누락. 체크.
- Collapsed: padding 16px 20px
- Expanded: `border-color: slate-300` 약간 진한 테두리
- chevron: 접힘 시 `›`, 펼침 시 `⌄` (rotate 90deg)

**관련 파일**
- 신규: 위 7개 파일 (+ index.ts)

**검증**
- Storybook 없음 — A4에서 실제 데이터 연결 후 시각 확인.
- 이 Todo 단독으로는 `ProjectSummary` mock을 써서 로컬에서 렌더 확인 권장.

**주의**
- **I-02 결정 전에는 ProcessStatus CTA 배치 확정 불가** — 헤더 우측에 플레이스홀더(`<ProcessStatusAction />` 등)만 두고, 실제 버튼은 A4에서 결선.
- `Resource` 타입의 어떤 필드가 DB 이름/유형/리전/연동 상태로 매핑되는지 미리 확인. 매핑 표를 이 Todo PR description에 첨부.

---

### A4 (T7) — AdminDashboard에 InfrastructureList 통합 + ProjectsTable 제거

- **상태**: ⏳ Pending
- **담당 세션**: _미할당_
- **우선순위**: P2
- **선행 조건**: A2, A3
- **후행 Todo**: A5, T17
- **예상 LOC**: ~200 (수정 + 삭제)
- **Phase 0 의존**: I-02

**Goal**
A2에서 Shell만 바꾼 `AdminDashboard`에 A3의 `InfrastructureList`를 연결하고, 기존 `ProjectsTable`을 제거한다.

**변경 사항**
1. `AdminDashboard.tsx`에서 기존 `<ProjectsTable>` 부분을 `<InfrastructureList>`로 교체.
2. Props 리매핑 (actionLoading, onConfirmCompletion, onViewApproval 등).
3. `app/components/features/admin/ProjectsTable.tsx` 파일 **삭제**.
4. `app/components/features/admin/index.ts`에서 `ProjectsTable` export 제거.
5. ProcessStatus별 CTA가 모든 상태(WAITING_APPROVAL, APPLYING_APPROVED, INSTALLING, WAITING_CONNECTION_TEST, CONNECTION_VERIFIED, INSTALLATION_COMPLETE)에서 정상 동작하는지 검증.

**관련 파일**
- 수정: `app/components/features/AdminDashboard.tsx`
- 수정: `app/components/features/admin/index.ts`
- 제거: `app/components/features/admin/ProjectsTable.tsx`

**검증 (필수)**
- 5개 ProcessStatus 케이스를 mock에서 직접 트리거 → 액션 버튼 트리거 가능 확인:
  - WAITING_APPROVAL → "승인 요청 확인" 버튼 → ApprovalDetailModal 정상 오픈
  - APPLYING_APPROVED → "연동대상 반영 중" 표시
  - INSTALLING → "설치 진행 중" 표시
  - WAITING_CONNECTION_TEST → "연결 테스트 대기" 표시
  - CONNECTION_VERIFIED → "설치 완료 확정" 버튼 → `confirmInstallation` 호출
- 카드 펼침/접힘 동작.
- 빈 상태(`projects.length === 0`) InfrastructureEmptyState 렌더.

**주의**
- `CloudProviderIcon`은 기존 것 재사용.
- 빈 상태 CTA("상단의 타겟 소스 등록 버튼으로 새 대상을 추가하세요")는 프로토타입 문구로 통일: "+ Add Infra 를 통해 사용 중인 인프라 정보를 추가할 수 있어요."

---

### A5 (T8) — PermissionsPanel 드로어 전환 (I-01 결정에 따라)

- **상태**: ⏳ Pending
- **담당 세션**: _미할당_
- **우선순위**: P3
- **선행 조건**: A2, A4, **I-01 확정**
- **후행 Todo**: T17
- **예상 LOC**: ~250

**Goal**
프로토타입에 없는 `PermissionsPanel`의 노출 방식을 결정(I-01)된 대로 이관. 현재 제안: 우측 슬라이드 드로어 + PageHeader 우측에 "권한 관리" 버튼.

**변경 사항**
1. 신규 `PermissionsDrawer` 컴포넌트 (우측 슬라이드).
2. `AdminDashboard`의 `grid-cols-[320px_1fr]` 레이아웃 → 단일 컬럼.
3. 기존 `PermissionsPanel` 컴포넌트는 `PermissionsDrawer` 내부로 흡수 or 재사용.
4. `<PageHeader action={...}>` 에 "권한 관리" 버튼 추가.

**관련 파일**
- 신규: `app/components/features/admin/PermissionsDrawer.tsx`
- 수정: `app/components/features/admin/PermissionsPanel.tsx` (내용 분리 또는 드로어에 포함)
- 수정: `app/components/features/AdminDashboard.tsx`

**검증**
- 사용자 추가/삭제 회귀 없음.
- ESC 키로 드로어 닫기, 외부 클릭으로 닫기.

**주의**
- 드로어 방향, 너비(360px?), a11y (focus trap) 확인.

---

### B1 (T9) — StepProgressBar 7-step 확장

- **상태**: ⏳ Pending
- **담당 세션**: _미할당_
- **우선순위**: P2
- **선행 조건**: T1, **I-04 확정**
- **후행 Todo**: B4
- **예상 LOC**: ~100

**Goal**
6-step을 7-step으로 확장. 신규 Step 06 "관리자 승인 대기"는 I-04 결정에 따라 구현 (권장: enum 불변, 라벨만 추가, `CONNECTION_VERIFIED` 상태를 06로 표시).

**전체 맥락**
현행 `steps` 배열 (L6-14):
```ts
[ WAITING_TARGET_CONFIRMATION, WAITING_APPROVAL, APPLYING_APPROVED,
  INSTALLING, WAITING_CONNECTION_TEST, CONNECTION_VERIFIED, INSTALLATION_COMPLETE ]
```

7단계 라벨 (시안 L1004-1030):
1. 연동 대상 DB 선택 ← WAITING_TARGET_CONFIRMATION
2. 연동 대상 승인 대기 ← WAITING_APPROVAL
3. 연동 대상 반영중 ← APPLYING_APPROVED
4. Agent 설치 ← INSTALLING
5. 연결 테스트 (N-IRP 연동) ← WAITING_CONNECTION_TEST
6. 관리자 승인 대기 ← CONNECTION_VERIFIED (I-04 권장안)
7. 완료 ← INSTALLATION_COMPLETE

**스타일 변경**
- 원 40x40 (현행 32x32)
- current: `box-shadow: 0 0 0 4px rgba(0,100,255,0.15)` halo
- 숫자: zero-padded `01, 02, …, 07`
- connector 높이 2px (현행 0.5px)
- step clickable + hover 시 border-primary + text-primary

**관련 파일**
- 수정: `app/components/features/process-status/StepProgressBar.tsx`
- 가능: `lib/process.ts`의 `getProjectCurrentStep` 반환값 매핑 재확인.

**검증**
- 각 `ProcessStatus`에 대해 stepper 렌더 결과 시각 확인.
- `onGuideClick` prop 유지.

**주의**
- 7-step 중 어떤 step이 "current"인지 맵핑 로직 재검토. 특히 6-7단계 분기.
- 기존 호출자(`ProcessStatusCard`, `StepGuide` 등)의 시그니처 유지.

---

### B2 (T10) — GuideCard (warm variant)

- **상태**: ⏳ Pending
- **담당 세션**: _미할당_
- **우선순위**: P2
- **선행 조건**: T1
- **후행 Todo**: B4
- **예상 LOC**: ~200

**Goal**
시안 L576-640의 "warm guide tone" 카드를 `GuideCard`로 신규 구현. 7-step 각각에 대한 콘텐츠 매핑.

**스펙**
```tsx
interface GuideCardProps {
  currentStep: ProcessStatus;
  provider: CloudProvider;
  installationMode?: 'AUTO' | 'MANUAL';
}
```

**내용**
- 시안 L1453-1518의 `GUIDES` 객체를 참고하여 7-step HTML 콘텐츠 정의.
- 기존 `lib/constants/process-guides.ts`와 **병합** 또는 **치환 여부 확인**. 중복된 내용은 통합.

**시각 스펙**
- 카드 배경 `cardStyles.warmVariant.container`
- 헤더 그라디언트 `cardStyles.warmVariant.header` + 노란 원형 아이콘(💡) `cardStyles.warmVariant.icon`
- 본문 타이포: h4 14px 700, p 13px, ul marker 파랑 (`text-primary`)

**관련 파일**
- 신규: `app/components/features/process-status/GuideCard.tsx`
- 수정: `lib/constants/process-guides.ts` (7-step 콘텐츠 반영)

**검증**
- 각 step별로 콘텐츠 스위칭 시각 확인.
- B4에서 실제 페이지에 주입되는 시점에 최종 통합 테스트.

**주의**
- 기존 `ProcessGuideStepCard`/`StepGuide` 컴포넌트와 충돌 여부 확인. B2 시점에서는 병존하고, B4에서 둘 중 어느 것을 사용할지 결정.

---

### B3 (T11) — 타겟소스 상세 segment layout (TopNav 없음)

- **상태**: ⏳ Pending
- **담당 세션**: _미할당_
- **우선순위**: P1
- **선행 조건**: T3
- **후행 Todo**: B4
- **예상 LOC**: ~30

**Goal**
`app/integration/projects/[projectId]/layout.tsx`를 신규 생성하여 **TopNav 없음** 상태를 고정한다 (사용자 확정).

**전체 맥락**
T3에서 `/integration/admin/layout.tsx`에만 TopNav를 넣으면 `/integration/projects/[id]`는 루트 레이아웃으로 떨어진다. 루트에 TopNav 안 넣었으므로 자동으로 없음. 하지만 향후 누군가가 루트에 TopNav를 추가하면 상세 페이지까지 딸려오므로, **명시적으로 segment layout을 만들어 둬서 안전장치**를 건다.

**스펙**
```tsx
// app/integration/projects/[projectId]/layout.tsx
export default function ProjectDetailLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
```

**관련 파일**
- 신규: `app/integration/projects/[projectId]/layout.tsx`

**검증**
- `/integration/projects/123`에서 TopNav 없음, 페이지만 렌더.
- `/integration/admin`은 TopNav 정상 (T3 범위).

**주의**
- `bg-slate-50` 토큰은 theme에 있는지 확인. 없으면 `bg-[var(--bg-muted)]` 등으로.
- 현행 `ProjectDetail`이 이미 자체 배경/레이아웃을 들고 있으므로 중복 스타일 지양.

---

### B4 (T12) — ProjectDetail Shell 재구성 (5 provider pages)

- **상태**: ⏳ Pending
- **담당 세션**: _미할당_
- **우선순위**: P2
- **선행 조건**: T2, B1, B2, B3, **I-03, I-07 확정**
- **후행 Todo**: B5, B6
- **예상 LOC**: ~600
- **⚠️ 파일 충돌**: 5개 provider page 동시 수정. B5와 같은 파일 건드리므로 **B5는 B4 완료 후**.

**Goal**
5개 `*ProjectPage.tsx`의 Shell을 시안 Screen 4 기준으로 재구성. `ProjectSidebar`(320px) 제거 → 상단 `PageMeta`로 흡수.

**전체 맥락**
현행 구조 (AwsProjectPage L207-314):
```
ProjectHeader → flex[ ProjectSidebar(320px) w/ AwsInfoCard + ProjectInfoCard || main w/ ProcessStatusCard + ScanPanel + ResourceTable ]
```

신규 구조:
```
Breadcrumb → PageHeader(action=인프라삭제) → PageMeta(4kv) →
StepperCard → GuideCard → TargetDbSelectionCard(ScanController + DbSelectionTable)
```

**변경 사항**
1. `<ProjectSidebar>` 래퍼 삭제. `AwsInfoCard`/`ProjectInfoCard`의 핵심 정보를 `<PageMeta>`로 4kv 흡수.
2. I-03 결정에 따라 "상세 정보 보기" 링크 추가 여부 결정.
3. `<Breadcrumb>`, `<PageHeader>`, `<PageMeta>` 주입.
4. `<StepProgressBar>` 단독 카드로 감싸기 (시안 L998-1034 기준).
5. `<GuideCard>` 별도 카드로 삽입 (기존 `ProcessGuideStepCard` 치환).
6. `<ScanPanel>`, `<ResourceTable>`은 **B6, B8에서 재작업**하므로 **이번에는 원형 유지**. 단, 상위 카드 구조(TargetDbSelectionCard)로 감싸기.
7. I-07 결정: PageHeader 좌측 "← 목록으로" 버튼 추가 여부.

**관련 파일**
- 수정: `app/projects/[projectId]/aws/AwsProjectPage.tsx`
- 수정: `app/projects/[projectId]/azure/AzureProjectPage.tsx`
- 수정: `app/projects/[projectId]/gcp/GcpProjectPage.tsx`
- 수정: `app/projects/[projectId]/idc/IdcProjectPage.tsx`
- 수정: `app/projects/[projectId]/sdu/SduProjectPage.tsx`
- 수정: `app/projects/[projectId]/ProjectDetail.tsx` (전환 영향)

**검증**
- 5개 provider 각각에 대해 mock 시나리오로 페이지 로드 → 렌더 정상.
- `ProcessStatusCard` 내부의 모달/토글 동작 회귀 없음.
- 스캔, 리소스 선택, 승인 요청 플로우 모두 유지.

**주의**
- 공통화 유혹 조심. 5개 파일에서 **동일한 Shell 조각**을 반복해 쓰는 게 불가피. 공통 helper를 만들 경우 `app/projects/[projectId]/common/ProjectShell.tsx` 등에 명시적 이름.
- ⛔ 한꺼번에 5개를 다 바꾸지 말고, 하나(AWS)를 먼저 완성한 뒤 나머지 4개를 같은 패턴으로 복제.
- `AwsInfoCard`/`AzureInfoCard`/`GcpInfoCard`는 **컴포넌트 자체 삭제 금지** (I-03 결정에 따라 드로어/링크에서 재사용).

---

### B5 (T13) — ProjectHeader → PageMeta 전환 (컴포넌트 축소)

- **상태**: ⏳ Pending
- **담당 세션**: _미할당_
- **우선순위**: P2
- **선행 조건**: T2, B4
- **후행 Todo**: T17
- **예상 LOC**: ~80

**Goal**
현행 `app/projects/[projectId]/common/ProjectHeader.tsx`는 **자체 Header(로고+user) + Breadcrumb** 역할. TopNav/공통 Breadcrumb로 이관되었으므로, 이 파일을 정리한다.

**옵션**
- **옵션 A**: 파일 삭제 (B4에서 이미 `<Breadcrumb>`과 `<PageHeader>`를 직접 사용 중이라면).
- **옵션 B**: `ProjectPageMeta`로 개명 + meta-only 컴포넌트로 축소 (5 provider page에서 공통 사용).

**권장**: 옵션 B — `ProjectPageMeta.tsx`로 개명하여 "Breadcrumb + PageHeader + PageMeta" 3종을 공통으로 묶어 제공. 각 ProjectPage가 provider별 meta items만 전달.

**관련 파일**
- 수정/개명: `app/projects/[projectId]/common/ProjectHeader.tsx` → `ProjectPageMeta.tsx`
- 수정: 5개 `*ProjectPage.tsx` (import 교체)
- 수정: `app/projects/[projectId]/common/index.ts`

**검증**
- 5개 provider 페이지 상단 영역 회귀 없음.

**주의**
- B4 완료 후 (main merge 후) 시작. B4에서 직접 쓴 `<Breadcrumb>` 등을 `<ProjectPageMeta>`로 일관화하는 리팩터링.

---

### B6 (T14) — ScanPanel Headless 전환

- **상태**: ⏳ Pending
- **담당 세션**: _미할당_
- **우선순위**: P2
- **선행 조건**: B4, **I-05 확정**
- **후행 Todo**: B7, B8
- **예상 LOC**: ~300

**Goal**
`ScanPanel.tsx`를 상태 제공 전용(headless)으로 전환. UI 렌더는 호출자가 상태에 따라 결정할 수 있도록 렌더-props 패턴.

**현행**
`ScanPanel`이 자체적으로 Collapse/Expand + ScanProgressBar + ScanResultSummary + ScanHistoryList를 렌더.

**신규**
```tsx
export const ScanController = ({ targetSourceId, onScanComplete, children }) => {
  const { uiState, latestJob, progress, ... } = useScanPolling(targetSourceId);
  return children({ state, progress, result, startScan, lastScanAt });
};
```

**사용처 예 (B7 범위)**
```tsx
<ScanController targetSourceId={...}>
  {({ state, progress, lastScanAt, startScan }) => (
    <TargetDbSelectionCard lastScanAt={lastScanAt} onRunScan={startScan}>
      {state === 'EMPTY' && <ScanEmptyState />}
      {state === 'RUNNING' && <ScanRunningState progress={progress} />}
      {state === 'ERROR' && <ScanErrorState onRetry={startScan} />}
      {state === 'COMPLETE' && <DbSelectionTable ... />}
    </TargetDbSelectionCard>
  )}
</ScanController>
```

**I-05 반영**: ScanHistoryList / CooldownTimer는 "스캔 이력 보기" 링크 → 모달로 분리. 본 Todo에서 링크 + 모달 컴포넌트 신규 생성 or 다음 Todo 위임.

**관련 파일**
- 수정: `app/components/features/scan/ScanPanel.tsx` (headless 전환)
- 가능: 신규 `app/components/features/scan/ScanController.tsx` (naming 선호 시)
- 수정: `app/components/features/scan/index.ts`
- 수정: 5개 `*ProjectPage.tsx` (ScanPanel 호출 방식 변경)

**검증**
- 기존 훅 `useScanPolling`, `useApiAction` 동작 유지.
- 5개 provider에서 스캔 시작/진행/완료/에러 시나리오 테스트.

**주의**
- 기존 `ScanProgressBar`, `ScanResultSummary`, `ScanStatusBadge` 컴포넌트 재사용.
- B7에서 State UI를 구현하므로, 본 Todo는 **인터페이스 설계 + 기존 UI의 임시 호환성 유지**에 집중.

---

### B7 (T15) — Scan State UI 3종

- **상태**: ⏳ Pending
- **담당 세션**: _미할당_
- **우선순위**: P2
- **선행 조건**: B6
- **후행 Todo**: B8
- **예상 LOC**: ~250

**Goal**
시안 L1075-1115 기준 Empty/Running/Error 3개 state 컴포넌트를 신규 작성.

**스펙**
- `ScanEmptyState`: illus(업로드 아이콘 svg) + "인프라 스캔을 진행해주세요" + "'Run Infra Scan'을 통해 부위 DB를 조회할 수 있어요"
- `ScanRunningState`: primary-light 원형 회전 아이콘 + "인프라 스캔 진행중입니다" + "약 5분 이내…" + progress bar(linear-gradient primary→indigo) + "N%" 라벨(Geist Mono)
- `ScanErrorState`: red error-banner (아이콘 + h4 + p w/ 가이드 링크) + "다시 시도" outline button

**관련 파일**
- 신규: `app/components/features/scan/ScanEmptyState.tsx`
- 신규: `app/components/features/scan/ScanRunningState.tsx`
- 신규: `app/components/features/scan/ScanErrorState.tsx`
- 수정: `app/components/features/scan/index.ts`
- 수정: 5개 `*ProjectPage.tsx` (B6의 render-props 패턴에 연결)

**검증**
- 각 state 독립 렌더 시각 확인.
- mock에서 scan 시작 → 진행 → 성공/실패 시나리오 E2E.

**주의**
- `Complete` state는 B8에서 `DbSelectionTable` 교체와 함께 처리.
- 아이콘 svg는 시안 원문을 그대로 사용.

---

### B8 (T16) — ResourceTable → DbSelectionTable 컬럼 재구성

- **상태**: ⏳ Pending
- **담당 세션**: _미할당_
- **우선순위**: P3
- **선행 조건**: B6, B7, **I-06 확정**
- **후행 Todo**: T17
- **예상 LOC**: ~400

**Goal**
시안 L1117-1165의 컬럼(`checkbox / 연동대상여부 / DB Type / Resource ID / Region / DB Name / 연동완료여부 / 스캔이력`)에 맞춰 `ResourceTable.tsx` 및 provider별 body 컴포넌트의 컬럼을 재구성.

**매핑 표**
| 시안 컬럼 | 현행 필드 (Resource) | 변환 |
|---|---|---|
| checkbox | `selectedIds` | 기존 |
| 연동 대상 여부 | `isSelected` | `대상`(green) / `비대상`(gray) |
| DB Type | `databaseType` | tag blue |
| Resource ID | `resourceId` | mono font |
| Region | `region` | mono font |
| DB Name | `resourceName` | mono font |
| 연동 완료 여부 | ProcessStatus 파생 | "연동 완료"/"연동 진행중"/"—" |
| 스캔 이력 | `scanHistoryStatus` (신규) | "신규"/"변경"/"—" (I-06 미확정 시 컬럼 hidden) |

**관련 파일**
- 수정: `app/components/features/ResourceTable.tsx`
- 수정: `app/components/features/resource-table/AwsResourceTableBody.tsx`
- 수정: `app/components/features/resource-table/GroupedResourceTableBody.tsx`
- 수정: `app/components/features/resource-table/FlatResourceTableBody.tsx`
- 수정: `app/components/features/resource-table/ResourceRow.tsx`
- 가능: `lib/types.ts`에 `scanHistoryStatus` 필드 추가 (I-06 결정에 따라)

**검증**
- 5개 provider별로 테이블 컬럼 + 체크박스 + VM config 모달 회귀.
- 선택 요약 라인: "총 N건 · M건 선택됨" + "연동 대상 승인 요청" 버튼.

**주의**
- I-06 확정 전에는 "스캔 이력" 컬럼을 feature flag로 hidden. 이후 백엔드 필드 확정 시 활성화.
- VmDatabaseConfigPanel, InstancePanel, RegionGroup, ClusterRow 등의 자식 컴포넌트 호환성 유지.
- "연동 완료 여부" 파생 로직은 별도 helper (`getResourceIntegrationStatus(resource, processStatus)`)로 추출.

---

### T17 — Phase 1 정리 + E2E regression

- **상태**: ⏳ Pending
- **담당 세션**: _미할당_
- **우선순위**: P3
- **선행 조건**: A4 + A5 + B5 + B8 (전부)
- **예상 LOC**: ~100 (삭제 위주)

**Goal**
Phase 1 완료 후 잔여 dead code, 미사용 export, 잔존 raw hex를 정리하고 스크린샷 Before/After를 PR 설명에 첨부.

**작업**
- `AdminHeader.tsx` 완전 삭제 (T3에서 대체 완료 후).
- 미사용 imports 일괄 제거.
- `grep -rn '#[0-9A-Fa-f]\{6\}'`로 raw hex 잔존 확인.
- 각 provider page 및 admin에서 시각 스크린샷 (AWS/Azure/GCP/IDC/SDU 각 최소 1컷).
- MEMORY.md 갱신 (완료된 PR 목록 추가).

**검증**
- `npm run lint`, `npm run type-check`, `npm run build` 모두 통과.
- `git diff origin/main --stat`으로 변경 볼륨 확인.

---

## 6. 전체 맥락 요약 (세션 최상단 요약본)

> **어떤 작업 중이냐**: `design/SIT Prototype.html` 시안을 기준으로 **서비스 목록 화면(`/integration/admin`)** 과 **TargetSource 상세 화면(`/integration/projects/[projectId]`)** 을 전면 재설계 중.
>
> **왜 하느냐**: 기존 UI는 헤더/사이드바 구조가 달라 시안과 괴리가 크고, PermissionsPanel·ProjectSidebar 등 시안에 없는 요소가 공존 중. 7-step 프로세스, 상단 PageMeta, InfraCard 아코디언 등 시안 고유의 정보 구조를 채택하여 "관리자 몰입형 대시보드"로 전환.
>
> **무엇을 안 건드리냐**: API 계약, `ProcessStatus` enum, 승인/폴링 흐름, provider별 설치 모드 로직(AwsInstallationModeSelector 등), BFF 경로는 **그대로**.
>
> **제외 범위**: Phase 2로 이연한 `ProjectCreateModal`(연동 대상 생성) 재작성 — 프로토타입 Screen 2. Phase 1 완료 후 별도 Epic으로 진입.
>
> **어디 충돌 주의**: `AdminDashboard.tsx`(A2→A4→A5 순차), 5개 `*ProjectPage.tsx`(B4→B5→B6→B7 순차), `lib/routes.ts`(T3·B3 경합).
>
> **원칙 3가지**:
> 1. 기능 파손 없이 UI만 교체.
> 2. 테마 토큰 경유, raw 색상 금지.
> 3. Phase 0 이슈(§4) 미결정 시 해당 Todo 시작 금지.

---

## 7. 진행 상황 대시보드 (이 섹션을 주기적으로 업데이트)

| Todo | 담당 | 상태 | PR | Merge 일자 |
|---|---|---|---|---|
| T1 | - | Pending | - | - |
| T2 | - | Pending | - | - |
| T3 | - | Pending | - | - |
| A1 (T4) | - | Pending | - | - |
| A2 (T5) | - | Pending | - | - |
| A3 (T6) | - | Pending | - | - |
| A4 (T7) | - | Pending | - | - |
| A5 (T8) | - | Pending | - | - |
| B1 (T9) | - | Pending | - | - |
| B2 (T10) | - | Pending | - | - |
| B3 (T11) | - | Pending | - | - |
| B4 (T12) | - | Pending | - | - |
| B5 (T13) | - | Pending | - | - |
| B6 (T14) | - | Pending | - | - |
| B7 (T15) | - | Pending | - | - |
| B8 (T16) | - | Pending | - | - |
| T17 | - | Pending | - | - |

---

**끝.** Phase 0 이슈 8개 결정 → T1 시작 → Foundation(T1~T3) 완료 → Track A/B 병렬 진행.
