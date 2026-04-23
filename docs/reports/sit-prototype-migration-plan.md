# SIT Prototype Migration Plan

**작성일**: 2026-04-22
**대상 커밋**: `7915a83 feat: SIT prototype design mockups`
**신규 디자인 위치**: `design/SIT Prototype.html`, `design/components/**`

---

## 0. 목적과 범위

`design/` 디렉토리의 SIT (Self Installation Tool) 프로토타입 시안을 기준으로 **3개 핵심 화면**을 재설계한다.

| # | 화면 | 현행 경로 | 신규 디자인 Screen |
|---|---|---|---|
| A | **서비스 목록 조회 & 인프라 목록** | `/integration/admin` | Screen 1 (Empty), Screen 3 (Filled) |
| B | **연동 대상(인프라) 생성 모달** | `ProjectCreateModal` (같은 경로에서 띄움) | Screen 2 (Modal) |
| C | **타겟소스 상세 — 연동 대상 선택 및 스캔** | `/integration/projects/[projectId]` | Screen 4 (Infra Detail) |

### 설계 원칙

1. **기능 파손 없이 UI만 교체** — API 호출, 상태 기계(`ProcessStatus`), 승인/폴링 흐름은 현행 유지.
2. **`lib/theme.ts` 토큰만 사용** — HTML 프로토타입의 raw hex는 토큰으로 반드시 변환한다 (CLAUDE.md ⛔ 4번).
3. **단계적 적용** — 컴포넌트 단위 PR로 쪼개어 회귀 위험을 분산한다 (§7 참조).
4. **현행 다용도(AWS/Azure/GCP/IDC/SDU) 분기 구조 유지** — 프로토타입은 Azure만 그려져 있지만, 실제는 `AwsProjectPage`/`AzureProjectPage`/`GcpProjectPage`/`IdcProjectPage`/`SduProjectPage` 5개 디스패처 분기를 모두 지원해야 한다.
5. **TopNav 적용 범위 제한** — **타겟소스 상세 페이지(`/integration/projects/[projectId]`)에는 TopNav를 표시하지 않는다** (사용자 결정). 상세 진입 시 컨텍스트 몰입을 최우선으로 하며, 목록으로의 복귀 동선은 Breadcrumb을 통해 제공한다.

---

## 1. 신규 디자인 개괄

### 1-1. 전역 Shell (Screen 1/3/4 공통)

프로토타입 `design/SIT Prototype.html` 기준:

```
┌──────────────────────────────────────────────────────────────┐
│ TopNav  [SIT 로고] Service List · Credentials · PII Tag · PII Map    [user] │  height 56px, bg #0F172A (slate-900)
├──────────────────────────────────────────────────────────────┤
│ Sidebar (280px)    │ Main (breadcrumb + title + meta + card)          │
│ - Service List     │                                                    │
│ - search input     │                                                    │
│ - 서비스 리스트     │                                                    │
│ - pager            │                                                    │
│ - Notice/Guide/FAQ │                                                    │
└──────────────────────────────────────────────────────────────┘
```

**핵심 변화 포인트**:
- 상단에 **검정(slate-900) TopNav**가 추가된다 (현행 없음). 브랜드 그라디언트 배지 `linear-gradient(135deg, #0064FF 0%, #4F46E5 100%)`.
- 전역 좌측 Sidebar가 **280px로 확장**되고(현행 256px), 하단에 Notice/Guide/FAQ 링크가 추가된다.
- Sidebar 아이템은 "코드 + 이름 2줄" 구조로 고정되어, `projectCount` 뱃지가 빠진다.
- Main 영역에 **Breadcrumb + Page Title + Page Meta(kv 4개 인라인)**가 기본 구조로 들어온다.

### 1-2. Screen 3 — 인프라 목록 (Filled)

```
┌─ Card: "Infrastructure & Databases List"  [+ Add Infra]   ────┐
│ ┌─ Infra Card (AWS, collapsed) ────────────────────────────┐  │
│ │ › AWS (Global) · Payer · Linked · 모니터링 방식 · [관리▾]│  │
│ └──────────────────────────────────────────────────────────┘  │
│ ┌─ Infra Card (Azure, expanded) ───────────────────────────┐  │
│ │ ▾ Azure · Subscription · Tenant · 모니터링방식 · [관리▾] │  │
│ │ ─ DB Table: Database name / DB Type / Region /            │  │
│ │   연동 대상 여부 / 연동 완료 여부 / 연동 상태            │  │
│ │   (tags: MySQL blue, Healthy/Partial/Unhealthy dots)     │  │
│ └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

- 각 인프라는 **아코디언 카드** (collapsed/expanded).
- 헤더는 provider 컬러 세로바 + 요약 필드(Account/Subscription/Tenant 등) + 우측 **Split 버튼(관리 + more 메뉴)**.
- Expanded 시 DB 테이블이 카드 내부에 렌더된다 (현행은 ResourceTable이 별도 카드).
- `+ Add Infra` ghost 버튼이 Card 헤더 우측에 붙는다.

### 1-3. Screen 2 — 인프라 등록 모달

```
Modal 840px
┌───────────────────────────────────────────────────────────┐
│ Title: 인프라 등록                                         │
│ Sub: PII 모니터링 모듈 연동이 필요한 운영계 인프라 정보… │
├───────────────────────────────────────────────────────────┤
│ 1. 인프라 Provider 유형 선택 (7-chip grid)                │
│    AWS(Global) · AWS(China) · Azure · GCP ·               │
│    IDC/On-prem · Other Cloud/IDC · SaaS                   │
│                                                            │
│ 2. 인프라 정보          │ 3. DB Type 선택                 │
│  - Payer Account       │  - select + 태그 multi-chip     │
│  - Linked Account      │                                  │
│                                     [+ Add to List]       │
│ 4. 인프라 등록 List (mini table) — 누적 등록 대상        │
│    인프라유형 / 인프라정보 / DBType / 커뮤니케이션모듈 / × │
├───────────────────────────────────────────────────────────┤
│                              [Cancel]  [Save]             │
└───────────────────────────────────────────────────────────┘
```

**핵심 변화**:
- 현행은 단일 Provider 선택 → 단일 생성이지만, **프로토타입은 한 모달에서 여러 Provider 묶음을 등록 가능** (mini-table에 누적).
- **Provider 7종**으로 확장: 기존 AWS/Azure/GCP/IDC 4종 → `AWS Global`, `AWS China`, `Azure`, `GCP`, `IDC/On-prem`, `Other Cloud/IDC`, `SaaS`.
- DB Type **멀티 선택**이 UI 레벨에서 도입된다 (select → tag chip).
- 커뮤니케이션 모듈(`Agent`/`SDU`)이 Provider 선택만으로 자동 할당되어 mini-table에 표시.

### 1-4. Screen 4 — 인프라 상세 (타겟소스 상세)

```
Breadcrumb: SIT Home › Service List › Big Data Platform (999) › Azure Infrastructure
[Page Title: Big Data Platform (999)]           [인프라 삭제] (danger-outline)
[Meta: Cloud Provider / Subscription ID / Jira Link / 모니터링 방식]

┌─ Card: 프로세스 진행 상태 ───────────────────────────┐
│ Stepper (7-step)                                       │
│ 01 대상 DB 선택 → 02 승인 대기 → 03 반영중 →          │
│ 04 Agent 설치 → 05 연결테스트(N-IRP) →               │
│ 06 관리자 승인 대기 → 07 완료                        │
└────────────────────────────────────────────────────┘

┌─ Guide Card (warm yellow variant) ─────────────────┐
│ 💡 가이드                                          │
│ (현재 Step에 맞는 HTML 가이드 동적 렌더)          │
└────────────────────────────────────────────────────┘

┌─ Card: 연동 대상 DB 선택 ──────────────────────────┐
│ Last Scan: … · [▶ Run Infra Scan]                 │
│ [스캔 상태별 UI: Empty / Running / Error / Complete] │
│   Complete 시 → DB 테이블 (체크박스 선택 / 대상 여부) │
│ "총 N건 · M건 선택됨"  [연동 대상 승인 요청]       │
└────────────────────────────────────────────────────┘
```

**핵심 변화**:
- **Stepper 6-step → 7-step**. "관리자 승인 대기"가 신규 추가(현행은 `WAITING_APPROVAL` 1회뿐).
- **Guide Card**가 warm yellow variant (`#FFFDF5` 배경, `#F3E8B8` 테두리)로 별도 카드화 — Step별 HTML 동적 렌더.
- 스캔 상태가 **Empty / Running(progress bar + %) / Error(error-banner + 재시도) / Complete(테이블)** 4단계로 명시적.
- 테이블 컬럼이 "연동 대상 여부 / DB Type / Resource ID / Region / DB Name / 연동 완료 여부 / 스캔 이력"로 재구성 (현행 ResourceTable과 컬럼명·폭 상이).
- Page Meta 가 kv 4개 인라인으로 상단 고정 (현행은 `ProjectSidebar` 좌측 320px 카드).
- 우측 사이드바(`ProjectSidebar`) **제거** → 정보는 상단 meta 라인으로 흡수.

---

## 2. 현행 구조 매핑

### 2-1. 서비스 목록 관련

| 신규 요소 | 현행 파일 | 경로 |
|---|---|---|
| TopNav | (없음, 신규) | `app/components/layout/TopNav.tsx` **신규 생성** |
| ServiceSidebar (280px) | `ServiceSidebar` | `app/components/features/admin/ServiceSidebar.tsx` |
| 페이지 Shell | `AdminDashboard` | `app/components/features/AdminDashboard.tsx` |
| 기존 Header | `AdminHeader` | `app/components/features/admin/AdminHeader.tsx` → **제거 or TopNav로 통합** |
| PermissionsPanel 320px | `PermissionsPanel` | `app/components/features/admin/PermissionsPanel.tsx` → **현행 2컬럼 레이아웃 해체** |
| ProjectsTable | `ProjectsTable` | `app/components/features/admin/ProjectsTable.tsx` → **InfraCard 구조로 교체** |

### 2-2. 연동 대상 생성 모달

| 신규 요소 | 현행 파일 | 경로 |
|---|---|---|
| 모달 본체 | `ProjectCreateModal` | `app/components/features/ProjectCreateModal.tsx` → **전면 재작성** |
| API 호출 | `createProject` | `app/lib/api/index.ts` → **멀티 생성 지원을 위한 변경 검토** |
| CloudProvider 타입 | `CloudProvider` enum | `lib/types.ts` → **확장 필요: `AWS_GLOBAL`/`AWS_CHINA`/`OTHER_CLOUD`/`SAAS`** (§4-2 참조) |

### 2-3. 타겟소스 상세 & 스캔

| 신규 요소 | 현행 파일 | 경로 |
|---|---|---|
| 페이지 컨테이너 | `AwsProjectPage`/`AzureProjectPage`/… | `app/projects/[projectId]/{aws,azure,gcp,idc,sdu}/*ProjectPage.tsx` |
| 공통 Layout | `ProjectDetail` (dispatcher) | `app/projects/[projectId]/ProjectDetail.tsx` |
| Breadcrumb + Meta 영역 | `ProjectHeader` | `app/projects/[projectId]/common/ProjectHeader.tsx` → **확장** |
| Stepper (6→7 step) | `StepProgressBar` | `app/components/features/process-status/StepProgressBar.tsx` |
| Guide Card | `ProcessGuideStepCard` + `StepGuide` | `app/components/features/process-status/*.tsx` → **warm-variant 스타일 추가** |
| 스캔 UI | `ScanPanel` | `app/components/features/scan/ScanPanel.tsx` → **상태별 UI 재배치** |
| DB 선택 테이블 | `ResourceTable` | `app/components/features/ResourceTable.tsx` → **컬럼 재구성** |
| Process Status Card | `ProcessStatusCard` | `app/components/features/ProcessStatusCard.tsx` → **레이아웃 재편** |

---

## 3. 세부 변경 계획

### 3-1. 전역 TopNav (신규)

**파일**: `app/components/layout/TopNav.tsx` *(신규 생성)*

```tsx
// 스펙 요약
- Height: 56px, bg: slate-900 (#0F172A)
- 좌측: 브랜드 배지 (그라디언트 #0064FF→#4F46E5, 흰 dot + "SIT" + small "Self Installation Tool")
- 네비: Service List / Credentials / PII Tag mgmt. / PII Map (아이콘 + 라벨)
  - 현재 라우팅된 메뉴는 .active (bg rgba(255,255,255,0.08))
- 우측: 사용자 이메일 + 이니셜 원형 avatar (#334155)
```

**Theme 확장 필요**:
- `lib/theme.ts`에 `navStyles` 섹션 추가:
  - `navStyles.bg = 'bg-slate-900'`
  - `navStyles.brandGradient = 'bg-gradient-to-br from-[#0064FF] to-[#4F46E5]'`
  - `navStyles.linkInactive`, `navStyles.linkActive`, `navStyles.linkHover`

**라우팅 추가 필요**:
- `lib/routes.ts`에 다음 신규 경로 스텁을 정의 (미구현 메뉴여도 nav 표시용).
  - `integrationRoutes.credentials = '/integration/credentials'` (미구현 → `/integration/admin`으로 폴백 OR `aria-disabled` 처리)
  - `integrationRoutes.piiTag = '/integration/pii-tag'` (동일)
  - `integrationRoutes.piiMap = '/integration/pii-map'` (동일)

⚠️ **주의**: 미구현 메뉴는 *표시만 하고 클릭 비활성* 또는 `Coming soon` 토스트로 처리. 허위 링크 금지.

**적용 위치** ⚠️ **중요 — TopNav는 목록 화면에만 표시**:

| 화면 | TopNav 표시 여부 | 이유 |
|---|---|---|
| 서비스 목록 (`/integration/admin`) | ✅ 표시 | Screen 1/3 시안 그대로 |
| **타겟소스 상세 (`/integration/projects/[projectId]`)** | ❌ **표시하지 않음** | **사용자 결정** — 상세 화면에서는 컨텍스트 몰입을 위해 TopNav 제거 |
| 기타 통합 페이지 (Credentials/PII Tag/PII Map 등 미구현) | ✅ 표시 | 메뉴 전환 필요 |

**구현 방안**:
- **Route Group 분리 권장** — Next.js App Router의 route group으로 레이아웃 분기:
  - `app/(with-nav)/layout.tsx` — TopNav 포함 (admin 등)
  - `app/(bare)/layout.tsx` — TopNav 없음 (target source detail)
  - 단, 실제 디렉토리 이동은 라우팅 영향을 주므로 폴더 이동 대신 **조건부 렌더링**도 가능.
- **대안 (권장)**: 루트 `app/layout.tsx`에 TopNav를 넣지 않고, 각 섹션 레이아웃에서 선택적 삽입.
  - `app/integration/admin/layout.tsx` → `<TopNav /> + children`
  - `app/integration/projects/[projectId]/layout.tsx` → `children` only (TopNav 없음)
- 타겟소스 상세 페이지는 좌측 `ServiceSidebar`도 표시하지 않는다 (시안 Screen 4 기준). 즉, 상세 화면은 **breadcrumb + page header + meta + cards**만으로 구성된 flat 레이아웃.

### 3-2. ServiceSidebar 변경

**파일**: `app/components/features/admin/ServiceSidebar.tsx`

| 항목 | 현행 | 신규 |
|---|---|---|
| 너비 | `w-64` (256px) | `w-[280px]` |
| 타이틀 | "서비스 코드" uppercase | "Service List" (15px font-semibold) |
| 검색 placeholder | "서비스 검색..." | "Service name or Service Code" |
| 항목 hover | gray-50 | `bg-muted` (동일 토큰) |
| 선택 항목 | 좌측 4px blue bar + `info.bgLight` | **`primary-50` 배경 + 1px primary 전체 테두리** |
| 항목 구조 | code + name + projectCount 배지 | code(13px 600) + name(12px 3색) — **projectCount 뱃지 제거** |
| 하단 pager | 유지 | 컴팩트하게 재디자인 (numbers only, < / >) |
| **하단 Footer 링크** | 없음 | **신규**: Notice / Guide / FAQ 링크 (border-top 분리) |

**작업 분량**: `ServiceSidebar.tsx` 내부 클래스 교체 + 하단 섹션 추가. ~80줄 수정.

**테마 의존성**: 신규 변수 없음. `primaryColors.bgLight`, `primaryColors.border`, `textColors.tertiary`, `borderColors.light` 기존 토큰 사용.

### 3-3. AdminDashboard Shell 변경

**파일**: `app/components/features/AdminDashboard.tsx`

**변경 전** (현행, L187-258):
```tsx
<div className="min-h-screen bg-gray-50">
  <AdminHeader />
  <div className="flex h-[calc(100vh-73px)]">
    <ServiceSidebar ... />
    <main className="flex-1 p-6 overflow-auto bg-gray-50/50">
      {/* Service Header + PermissionsPanel + ProjectsTable (320px_1fr 그리드) */}
    </main>
  </div>
</div>
```

**변경 후** (신규):
```tsx
<>
  <TopNav />  {/* or 상위 layout.tsx로 이동 */}
  <div className="flex h-[calc(100vh-56px)]">
    <ServiceSidebar ... />
    <main className="flex-1 overflow-auto bg-[var(--bg-muted)]">
      <Breadcrumb crumbs={[...]} />
      <PageHeader title={`${serviceName} (${serviceCode})`} />
      <PageMeta kvs={[
        { label: '부문 / 총괄', value: ... },
        { label: '사업부 / 법인', value: ... },
        { label: '연관 시스템 코드', value: ... },
        { label: '담당자', value: ... },
      ]} />
      <InfrastructureList
        projects={projects}
        onAddInfra={() => setShowCreateModal(true)}
        onOpenDetail={...}
      />
    </main>
  </div>
  {/* PermissionsPanel은 별도 영역으로 이전 (§3-3-c) */}
</>
```

**하위 변경 세부**:

#### 3-3-a. Breadcrumb 컴포넌트 (신규)

**파일**: `app/components/ui/Breadcrumb.tsx` *(신규)*

```tsx
interface BreadcrumbProps { crumbs: Array<{ label: string; href?: string }>; }
// fg-3 색상 · 6px sep · 마지막 항목 fg-2 (current)
```

#### 3-3-b. PageHeader / PageMeta 컴포넌트 (신규)

**파일**: `app/components/ui/PageHeader.tsx` *(신규)*

```tsx
interface PageHeaderProps { title: React.ReactNode; subtitle?: string; action?: React.ReactNode; }
// 24px 700 title + optional action 우측
```

**파일**: `app/components/ui/PageMeta.tsx` *(신규)*

```tsx
interface PageMetaProps { items: Array<{ label: string; value: React.ReactNode }>; }
// flex flex-wrap gap-7 · 각 항목 label 11px uppercase + value 13px 500
```

#### 3-3-c. PermissionsPanel 위치 재배치

**기존**: `[320px_1fr]` 그리드의 좌측에 항상 표시.
**신규**: *프로토타입에 없음*. 현재 기능은 필요하므로 다음 중 택1:
  - **(권장)** 페이지 우상단 `Manage Access` 액션 버튼 → 드로어/모달로 분리.
  - Service Detail의 상단 메타 우측에 `담당자 N명` + 관리 링크로 축소.

**결정 사항 필요**: UX 팀과 **Phase 0에서 확정**. (아래 §6 오픈 이슈 참조)

#### 3-3-d. InfrastructureList 컴포넌트 (신규)

**파일**: `app/components/features/admin/InfrastructureList.tsx` *(신규, `ProjectsTable` 교체)*

```tsx
interface InfrastructureListProps {
  projects: ProjectSummary[];  // = 인프라 = 타겟소스
  loading: boolean;
  onAddInfra: () => void;
  onOpenDetail: (targetSourceId: number) => void;
  onManageAction: (targetSourceId: number, action: 'view' | 'delete') => void;
}
```

- 아코디언 카드 형태. 각 카드:
  - Header: chevron + provider 세로 컬러바 + `provider-badge` + kv-inline(3개) + spacer + split 버튼(`관리` + `…`)
  - Body (expanded): `db-table` (컬럼: Database name / DB Type / Region / 연동 대상 여부 / 연동 완료 여부 / 연동 상태)
- Empty state: 별도 `EmptyInfrastructure` 블록 (illus + h3 + p) → 현재의 `ProjectsTable` empty state 로직과 동일하게 `projects.length === 0`이면 보여줌.

**기존 `ProjectsTable` 삭제**. 해당 파일에서 export되던 `ProjectsTable`을 imports하는 곳: `admin/index.ts`, `AdminDashboard.tsx` — 모두 정리.

⚠️ **중요**: 현행 `ProjectsTable`의 액션 버튼(승인 요청 확인, 연동대상 반영 중, 설치 완료 확정 등 `ProcessStatus`별 CTA)은 신규 InfrastructureList에서도 **유지 필수**. 아코디언 헤더의 split 버튼과 별개로, **확장 시 테이블 하단** 또는 **행별 action 셀**에 배치한다. → §6 오픈 이슈 2.

#### 3-3-e. InfraCard 하위 컴포넌트 트리

```
InfrastructureList
├── InfrastructureEmptyState (projects.length === 0)
└── InfraCard (per-project)
    ├── InfraCardHeader
    │   ├── ChevronIcon
    │   ├── ProviderBadge (provider 세로바 + 라벨)
    │   ├── InfraKvInline × 3
    │   └── ManagementSplitButton
    │       ├── "관리" 버튼 (→ onOpenDetail)
    │       └── KebabMenu (상세 보기 / 인프라 삭제)
    └── InfraCardBody (expanded 시)
        └── InfraDbTable (컬럼 6개)
```

각각 별도 파일로 쪼개는 것을 권장 (`app/components/features/admin/infrastructure/*`).

### 3-4. ProjectCreateModal 전면 재작성 (Screen 2)

**파일**: `app/components/features/ProjectCreateModal.tsx`

**변경 전**: 560px modal, 단일 Provider 선택(4종), 단일 생성 → `createProject` 1회.
**변경 후**: 840px modal, **리스트 누적형**, Provider 7종.

#### 3-4-a. 새 Provider 7종 vs 현행 타입

| 시안 chip | 현행 `CloudProvider` 매핑 | API 필드 |
|---|---|---|
| AWS (Global) | `'AWS'` + `awsRegionType: 'global'` | 기존 `awsRegionType` 재사용 |
| AWS (China) | `'AWS'` + `awsRegionType: 'china'` | 기존 `awsRegionType` 재사용 |
| Azure | `'Azure'` | 기존 |
| GCP | `'GCP'` | 기존 |
| IDC / On-prem | `'IDC'` | 기존 |
| Other Cloud / IDC | ❌ **신규** → `OTHER` 추가 필요? | BFF와 합의 필요 |
| SaaS | ❌ **신규** → `SAAS` 추가 필요? | BFF와 합의 필요 |

⚠️ **BFF/API 사전 확인 필수**: 현행 Swagger(`docs/swagger/*.yaml`)에 `OTHER`/`SAAS`가 정의되어 있지 않다면, **현 단계에서는 UI만 내고 chip을 disabled 처리** 후 백엔드 확정 시점에 활성화. (CLAUDE.md "Contract-First 필수" 원칙 준수)

#### 3-4-b. 모달 구조

```tsx
<ProjectCreateModal>
  <ModalHeader title="인프라 등록" sub="..." />
  <ModalBody>
    <Section no={1} label="인프라 (Provider) 유형 선택">
      <ProviderChipGrid  /* 7 chips, cols-7 */
        selected={currentProvider}
        onSelect={setCurrentProvider}
      />
    </Section>

    <div className="grid grid-cols-2 gap-[14px]">
      <Section no={2} label="인프라 정보">
        <ProviderCredentialForm provider={currentProvider} />
        {/* AWS: Payer/Linked; Azure: Tenant/Subscription; GCP: Project ID; IDC: (없음); Other: Provider명; SaaS: 솔루션명 */}
      </Section>
      <Section no={3} label="DB Type 선택">
        <DbTypeMultiSelect /* select + chip multi */ />
      </Section>
    </div>

    <div className="flex justify-end">
      <GhostButton onClick={addToList}>+ Add to List</GhostButton>
    </div>

    <Section label="인프라 등록 List">
      <MiniTable data={stagedInfras} />
      {/* 컬럼: 인프라 유형 / 인프라 정보 / DB Type / 커뮤니케이션 모듈 / Action(×) */}
    </Section>
  </ModalBody>
  <ModalFooter>
    <Button variant="outline" onClick={onClose}>Cancel</Button>
    <Button variant="primary" onClick={saveAll}>Save</Button>
  </ModalFooter>
</ProjectCreateModal>
```

#### 3-4-c. State 설계

```ts
// 모달 내부 스테이징 상태
interface StagedInfra {
  tempId: string;
  provider: ProviderChipKey;  // 'aws-global' | 'aws-china' | 'azure' | …
  credentials: Record<string, string>;  // provider별 필드
  dbTypes: DbType[];
  communicationModule: 'AWS Agent' | 'Azure Agent' | 'GCP Agent' | 'SDU';
}

const [staged, setStaged] = useState<StagedInfra[]>([]);
```

#### 3-4-d. `커뮤니케이션 모듈` 자동 할당 규칙

| Provider chip | 할당 모듈 |
|---|---|
| AWS Global / AWS China | `AWS Agent` |
| Azure | `Azure Agent` |
| GCP | `GCP Agent` |
| IDC / On-prem | `SDU` |
| Other Cloud / IDC | `SDU` |
| SaaS | `SDU` |

이 규칙은 `lib/constants/provider-mapping.ts`에 정의.

#### 3-4-e. Save 시 API 처리

**옵션 1 (현행 API 최소 확장)**: staged 배열을 Promise.all로 `createProject` 여러 번 호출.
```ts
await Promise.all(staged.map(infra => createProject(toCreateDto(infra))));
```

**옵션 2 (BFF bulk endpoint 도입)**: BFF에 `POST /v1/target-sources/bulk` 신규. → 백엔드 합의 필요.

**권장**: 1단계 PR에서는 **옵션 1**로 가되, UI는 단일 등록 케이스도 자연스럽게 동작하도록 설계 (staged.length === 1이어도 동일 흐름).

#### 3-4-f. 검증 로직 이전

현행 `validateAwsAccountId`, `validateGuid`는 그대로 유지. `ProviderCredentialForm`에서 재사용.

### 3-5. 타겟소스 상세 페이지 (Screen 4) 재편

**영향 파일**:
- `app/projects/[projectId]/aws/AwsProjectPage.tsx`
- `app/projects/[projectId]/azure/AzureProjectPage.tsx`
- `app/projects/[projectId]/gcp/GcpProjectPage.tsx`
- `app/projects/[projectId]/idc/IdcProjectPage.tsx`
- `app/projects/[projectId]/sdu/SduProjectPage.tsx`
- `app/projects/[projectId]/common/ProjectHeader.tsx`
- `app/components/features/ProcessStatusCard.tsx`
- `app/components/features/process-status/StepProgressBar.tsx`
- `app/components/features/process-status/ProcessGuideStepCard.tsx` (or 신규 `GuideCard`)
- `app/components/features/scan/ScanPanel.tsx`
- `app/components/features/ResourceTable.tsx`

#### 3-5-a. 페이지 Shell 재구성

**현행 구조** (`AwsProjectPage` L207-314):
```
<ProjectHeader /> (자체 Header + Breadcrumb)
<div className="flex flex-1">
  <ProjectSidebar 320px>
    <AwsInfoCard />
    <ProjectInfoCard />
  </ProjectSidebar>
  <main>
    <ProcessStatusCard />
    <ScanPanel />
    <ResourceTable />
    <RejectionAlert />
    <확정/수정 Buttons />
  </main>
</div>
```

**신규 구조** — ⚠️ **TopNav/ServiceSidebar 모두 제외, 단일 flat 레이아웃**:
```
{/* TopNav 없음 (사용자 결정) */}
{/* ServiceSidebar 없음 — 상세 페이지는 단일 컬럼 */}
<div className="min-h-screen bg-[var(--bg-muted)]">
  <main className="max-w-[1200px] mx-auto p-7 overflow-auto">
    <Breadcrumb crumbs={[
      { label: 'SIT Home', href: '/' },
      { label: 'Service List', href: '/integration/admin' },
      { label: `${serviceName} (${serviceCode})`, href: `/integration/admin?service=${serviceCode}` },
      { label: `${cloudProvider} Infrastructure` },  // current
    ]} />
    <PageHeader
      title={`${serviceName} (${serviceCode})`}
      action={<DangerOutlineButton>인프라 삭제</DangerOutlineButton>}
    />
    <PageMeta items={[
      { label: 'Cloud Provider', value: cloudProvider },
      { label: 'Subscription ID / Account ID', value: ... },
      { label: 'Jira Link', value: ... },
      { label: '모니터링 방식', value: ... },
    ]} />

    <StepperCard /* 7-step */ />

    <GuideCard /* warm variant */ stepGuideHtml={...} />

    <TargetDbSelectionCard>
      {/* Header: "연동 대상 DB 선택" + Sub + Last Scan timestamp + Run Infra Scan */}
      <ScanStateContainer>
        {scanState === 'EMPTY' && <ScanEmptyState />}
        {scanState === 'RUNNING' && <ScanRunningState progress={pct} />}
        {scanState === 'ERROR' && <ScanErrorBanner />}
        {scanState === 'COMPLETE' && (
          <>
            <DbSelectionTable />
            <SelectionSummary />
            <Button>연동 대상 승인 요청</Button>
          </>
        )}
      </ScanStateContainer>
    </TargetDbSelectionCard>
  </main>
</div>
```

**핵심 제거 사항**:
- **TopNav 제거** — 상세 페이지에서는 컨텍스트 몰입을 위해 전역 내비게이션을 띄우지 않는다. 목록으로 이동은 **Breadcrumb**만으로 제공.
- **ServiceSidebar 제거** — 상세 진입 후 서비스 전환이 필요하면 Breadcrumb의 `Service List` 링크로 복귀.
- **`ProjectSidebar` 우측 320px 컬럼 제거** — `AwsInfoCard` / `AzureInfoCard` / `GcpInfoCard` / `ProjectInfoCard`의 내용은 상단 `PageMeta`로 4개 kv로 축약 흡수.
  - 정보 전부는 담지 못하므로, **부가정보는 Stepper 카드 내부 좌측** 또는 **Guide 카드 위의 "상세 정보 토글" 아코디언**으로 표시 → §6 오픈 이슈 3.

**돌아가기 UX 보강**:
- TopNav가 없으므로, Breadcrumb의 `Service List` 항목은 반드시 클릭 가능한 링크여야 한다 (`href={integrationRoutes.admin}`).
- 페이지 헤더 좌측에 "← 목록으로" ghost 버튼을 추가하는 안도 고려 (시안에는 없지만 UX 보완 관점). → §6 오픈 이슈 9 신설.

#### 3-5-b. ProjectHeader 변경

`app/projects/[projectId]/common/ProjectHeader.tsx` 의 현행 역할(자체 Header + Breadcrumb)은:
- Header 부분 (로고 + "PII Agent" + user avatar) → **제거** (상세 페이지는 TopNav도 Header도 없음)
- Breadcrumb 부분 → 신규 `<Breadcrumb>` 컴포넌트로 흡수 (제거)

즉 파일 자체를 제거하거나, `ProjectPageMeta`로 개명 후 meta-only 컴포넌트로 축소.

#### 3-5-c. StepProgressBar: 6-step → 7-step

**현행** (`StepProgressBar.tsx` L6-14):
```ts
export const steps = [
  { step: ProcessStatus.WAITING_TARGET_CONFIRMATION, label: '연동 대상 확정' },
  { step: ProcessStatus.WAITING_APPROVAL, label: '승인 대기' },
  { step: ProcessStatus.APPLYING_APPROVED, label: '연동대상반영중' },
  { step: ProcessStatus.INSTALLING, label: '설치 진행' },
  { step: ProcessStatus.WAITING_CONNECTION_TEST, label: '연결 테스트' },
  { step: ProcessStatus.CONNECTION_VERIFIED, label: '연결 확인' },
  { step: ProcessStatus.INSTALLATION_COMPLETE, label: '완료' },
];
```

**신규 매핑**:
| # | 라벨 | 대응 ProcessStatus |
|---|---|---|
| 01 | 연동 대상 DB 선택 | `WAITING_TARGET_CONFIRMATION` |
| 02 | 연동 대상 승인 대기 | `WAITING_APPROVAL` |
| 03 | 연동 대상 반영중 | `APPLYING_APPROVED` |
| 04 | Agent 설치 | `INSTALLING` |
| 05 | 연결 테스트 (N-IRP 연동) | `WAITING_CONNECTION_TEST` + `CONNECTION_VERIFIED` |
| 06 | 관리자 승인 대기 | ⚠️ **신규 상태**. 현행 없음 |
| 07 | 완료 | `INSTALLATION_COMPLETE` |

⚠️ **Step 06 "관리자 승인 대기"는 현재 ProcessStatus enum에 없음.** 두 가지 접근:
- **(권장 A)** Step 06을 **UI 라벨만 추가**하고, `CONNECTION_VERIFIED`에 매핑하여 "설치 완료 확정 대기"의 의미로 쓴다 (admin이 `confirmInstallation` 호출 전 상태).
- **(B)** 백엔드에 `PENDING_ADMIN_APPROVAL` 같은 신규 상태를 신설 요청. → 대형 작업.

→ §6 오픈 이슈 4. **Phase 0에서 반드시 확정** 후 구현 진입.

**스타일 변경**:
- 현행: 원형 32px `statusColors.info.dot`
- 신규: 원형 40px, current step는 `box-shadow: 0 0 0 4px rgba(0,100,255,0.15)` 확대된 halo.
- 숫자 포맷: `01`, `02`, …, `07` (zero-padded).
- connector line height: 2px (현행 0.5px → 2px로 강화).
- clickable step: hover 시 border-primary + text-primary 변경 (시안 L643-645 구현).

#### 3-5-d. Guide Card (warm variant) 신규

**파일**: `app/components/features/process-status/GuideCard.tsx` *(신규, 기존 `ProcessGuideStepCard`와 병존 or 대체)*

```tsx
interface GuideCardProps {
  currentStep: ProcessStatus;
  provider: CloudProvider;
  installationMode?: 'AUTO' | 'MANUAL';  // AWS용
}

// Inside: reads from getProcessGuide(provider, variant)[currentStep]
// Renders: warm-variant Card (background #FFFDF5, border #F3E8B8)
//          + guide-head-icon (노란 원형 배경의 💡)
//          + guide-content (typography: h4 14px, p 13px, ul li primary bullet)
```

**테마 확장 필요**:
- `lib/theme.ts`의 `cardStyles`에 `warmVariant` 추가:
  - bg: `#FFFDF5`
  - border: `#F3E8B8`
  - header bg: `linear-gradient(180deg, #FFF8E1 0%, #FFFCEE 100%)`
  - 텍스트: `#78350F`
  - icon bg: `#F59E0B`

**콘텐츠 원본**: 프로토타입 L1453-1518의 `GUIDES` 객체는 현재 `lib/constants/process-guides.ts`와 병합 필요. 7-step 기준으로 각 step 당 콘텐츠(HTML) 확인.

#### 3-5-e. ScanPanel 상태별 UI 재구성

**파일**: `app/components/features/scan/ScanPanel.tsx`

**현행**: 접이식 단일 패널. 확장 시 `ScanProgressBar`, `ScanResultSummary`, `ScanHistoryList` 순서로 렌더.

**신규**: 타겟소스 상세 페이지의 "연동 대상 DB 선택" 카드 **내부에서** 4-state UI로 분기:
- `EMPTY`: illus + "인프라 스캔을 진행해주세요" + "'Run Infra Scan'을 통해 부위 DB를 조회할 수 있어요"
- `RUNNING`: primary-light 원형 회전 아이콘 + "인프라 스캔 진행중입니다" + "약 5분 이내 소요…" + `scan-progress` bar + "N%" label (Geist Mono)
- `ERROR`: `error-banner` (red tone) + "다시 시도" outline button
- `COMPLETE`: `DbSelectionTable` + `SelectionSummary` + "연동 대상 승인 요청" primary button

**상태 source**:
- `useScanPolling(targetSourceId)` 훅의 `uiState` + `latestJob` 결합:
  - `IN_PROGRESS` → `RUNNING`
  - `FAILED` → `ERROR`
  - `SUCCESS` + resources 있음 → `COMPLETE`
  - 그 외 (첫 접속, 빈 상태) → `EMPTY`

**구조 변경 영향**:
- `ScanPanel`의 출력 UI를 **콜백/컴포지션으로 부모가 배치**하도록 변경 (headless 패턴). 예:
  ```tsx
  <ScanController targetSourceId={...}>
    {({ state, progress, result, startScan, lastScanAt }) => (
      <Card header={<>연동 대상 DB 선택 + RunScanButton</>}>
        {state === 'EMPTY' && <ScanEmptyState />}
        {state === 'RUNNING' && <ScanRunningState progress={progress} />}
        {state === 'ERROR' && <ScanErrorState onRetry={...} />}
        {state === 'COMPLETE' && <DbSelectionTable resources={result} />}
      </Card>
    )}
  </ScanController>
  ```

**기존 `ScanHistoryList`, `CooldownTimer`는 디자인 시안에 없음** → 제거 vs 보존 결정 필요. 시안에서 "Last Scan: 2026-04-21 09:30"만 노출되므로, 기록 리스트는 **별도 모달로 이전** 권장.

→ §6 오픈 이슈 5.

#### 3-5-f. ResourceTable → DbSelectionTable 재구성

**파일**: `app/components/features/ResourceTable.tsx` (→ Rename 또는 분리)

**컬럼 매핑**:
| 시안 컬럼 | 현행 대응 | 데이터 원천 |
|---|---|---|
| checkbox | 기존 유지 | `selectedIds` |
| 연동 대상 여부 | 기존 `tag green/gray` | `isSelected` ? '대상' : '비대상' |
| DB Type | 기존 | `resource.databaseType` 또는 `vmDatabaseConfig.databaseType` |
| Resource ID | 신규 컬럼 | `resource.resourceId` (현재는 이름으로 표시) |
| Region | 기존 | `resource.region` |
| DB Name | 기존 | `resource.resourceName` 등 |
| 연동 완료 여부 | **신규 표시** | `ProcessStatus` 기반 파생값 ("연동 완료", "연동 진행중", "—") |
| 스캔 이력 | **신규 컬럼** | "신규" / "변경" / "—" — 스캔 간 비교 로직 필요. **백엔드 지원 여부 확인 필수** |

⚠️ "스캔 이력" 컬럼은 현행 Resource 모델에 없음. BFF에 `resource.scanHistoryStatus: 'NEW'|'CHANGED'|'UNCHANGED'` 같은 필드가 필요. → §6 오픈 이슈 6.

**분기 유지**: AWS(cluster 구조), Azure(region 그룹), GCP(flat), IDC/SDU(flat) — `AwsResourceTableBody`, `GroupedResourceTableBody`, `FlatResourceTableBody` 분기는 유지하되, 내부 컬럼 구성만 신규 스펙에 맞춰 교체.

**Selection Summary** (테이블 하단):
```tsx
<div className="flex justify-between items-center mt-4">
  <span>총 <strong>{totalCount}</strong>건 · <strong className="text-primary">{selectedCount}</strong>건 선택됨</span>
  <Button variant="primary" onClick={handleConfirm}>연동 대상 승인 요청</Button>
</div>
```

---

## 4. 공통 이슈와 선행 작업

### 4-1. Theme 확장 (`lib/theme.ts`)

다음 토큰을 추가하되, 기존 변수명과의 충돌을 피한다:

```ts
// Nav (신규)
navStyles = {
  bg: 'bg-[#0F172A]',
  brandGradient: 'bg-gradient-to-br from-[#0064FF] to-[#4F46E5]',
  link: {
    inactive: 'text-[#CBD5E1] hover:bg-white/5 hover:text-white',
    active: 'text-white bg-white/10',
  },
};

// Card warm variant (신규)
cardStyles.warmVariant = {
  container: 'bg-[#FFFDF5] border-[#F3E8B8]',
  header: 'bg-gradient-to-b from-[#FFF8E1] to-[#FFFCEE] border-b border-[#F3E8B8]',
  icon: 'bg-[#F59E0B] text-white',
  titleText: 'text-[#78350F]',
};

// Status tag (신규 variant)
tagStyles = {
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-700',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  orange: 'bg-orange-100 text-orange-800',
};

// Split mgmt button (Screen 3)
mgmtGroupStyles = {
  primary: 'bg-primary text-white rounded-l-md',
  more: 'bg-primary text-white rounded-r-md border-l border-white/20',
};
```

⚠️ **raw hex 사용 금지 원칙**: 부득이한 경우 `bg-[#0F172A]` 형태로 인라인 Tailwind arbitrary value를 쓰더라도, `theme.ts`에 상수명으로 1회 정의 후 JS 상수 참조.

### 4-2. CloudProvider 타입 확장 검토

```ts
// lib/types.ts 현행
export type CloudProvider = 'AWS' | 'Azure' | 'GCP' | 'IDC' | 'SDU';
```

**프로토타입 요구**: 신규 Chip `Other Cloud / IDC`, `SaaS`. 이 둘을 수용하려면:
- **접근 A**: `CloudProvider`에 `'OTHER' | 'SAAS'` 추가. BFF 스펙 확인 필요.
- **접근 B**: 현 `IDC`로 흡수 (SCP 관련 설명 L1220 "※ SCP와 관련, IDC/On-prem 부위 포함" 참고) + 모달 UI만 7-chip 제공, 내부 매핑 4종.

**결정 사항 필요**: BFF에 `OTHER`/`SAAS`가 있는가? Swagger 그랩 필요.
  - 있다면 접근 A, 없다면 접근 B로 진행 후 후속 PR로 확장.

### 4-3. 신규 메뉴 라우팅 스텁

| 메뉴 | 경로 | 구현 상태 |
|---|---|---|
| Service List | `/integration/admin` | ✅ 기존 |
| Credentials | `/integration/credentials` | ❌ 미구현 |
| PII Tag mgmt. | `/integration/pii-tag` | ❌ 미구현 |
| PII Map | `/integration/pii-map` | ❌ 미구현 |

**조치**:
- Phase 0에서 사용자와 합의: 메뉴 노출만 하고 링크 disabled vs 빈 페이지 생성.
- `app/integration/credentials/page.tsx` 등은 `"Coming soon"` placeholder로 선(先) 추가 가능.

---

## 5. 단계별 구현 계획 (PR 분할)

아래 PR 순서를 **엄격히** 따라야 한다. 각 PR은 main으로 merge된 후 다음 PR의 base가 된다.

### Phase 0 — 합의 (PR 없음)

**산출물**: 이 문서 + 사용자 승인. 아래 **오픈 이슈 6건**을 먼저 확정한다.

### PR #1 — 디자인 토큰 확장 (theme.ts only)

- **범위**: `lib/theme.ts`에 `navStyles`, `cardStyles.warmVariant`, `tagStyles`, `mgmtGroupStyles` 추가.
- **영향**: 없음 (순수 추가).
- **검증**: `npm run type-check`, `npm run lint`.
- **예상 라인**: ~80줄.

### PR #2 — Layout 구조 (TopNav, Breadcrumb, PageHeader, PageMeta)

- **신규 파일**:
  - `app/components/layout/TopNav.tsx`
  - `app/components/ui/Breadcrumb.tsx`
  - `app/components/ui/PageHeader.tsx`
  - `app/components/ui/PageMeta.tsx`
- **변경 파일**:
  - `app/integration/admin/layout.tsx` **신규** (또는 기존에 레이아웃 파일이 없다면 생성) — TopNav 여기에만 삽입
  - `lib/routes.ts` — 미구현 메뉴 route 상수 추가
- ⚠️ **TopNav는 루트 `app/layout.tsx`에 넣지 않는다** (타겟소스 상세에서는 TopNav 없음 요건).
  - admin 섹션의 segment layout에만 주입. 상세 페이지 (`app/integration/projects/[projectId]`)는 별도 레이아웃을 갖거나 layout 자체가 없어 루트로 fallback.
- **검증**: Storybook 없으므로 `app/integration/admin` 페이지에서 시각 확인 + 상세 페이지에 TopNav가 뜨지 않는지 반드시 확인. 기존 `AdminHeader`는 **이 PR에서 제거하지 않는다** — PR#3에서 교체.
- **예상 라인**: ~220줄.

### PR #3 — ServiceSidebar + AdminDashboard Shell 개편

- **변경 파일**:
  - `app/components/features/admin/ServiceSidebar.tsx` (폭/스타일/푸터 링크)
  - `app/components/features/AdminDashboard.tsx` (Shell 재구성, Breadcrumb/PageMeta 적용)
  - `app/components/features/admin/AdminHeader.tsx` (제거 or TopNav로 통합)
  - `app/components/features/admin/PermissionsPanel.tsx` (위치 재배치 — Phase 0 결정에 따라)
- **검증**: 브라우저 데스크톱 뷰에서 `/integration/admin` 정상 렌더, 서비스 선택/검색/페이지네이션 동작 확인.
- **예상 라인**: ~250줄 변경.

### PR #4 — InfrastructureList + InfraCard (Screen 3 핵심)

- **신규 파일** (`app/components/features/admin/infrastructure/` 디렉토리):
  - `InfrastructureList.tsx` — 컨테이너
  - `InfraCard.tsx` — 아코디언 카드
  - `InfraCardHeader.tsx` — 헤더 (chevron, badge, kv-inline, split button)
  - `InfraCardBody.tsx` — 펼침 영역 (DB 테이블)
  - `InfraDbTable.tsx` — DB 목록
  - `InfrastructureEmptyState.tsx` — empty
  - `ManagementSplitButton.tsx` — 관리+kebab
  - `index.ts`
- **제거 파일**:
  - `app/components/features/admin/ProjectsTable.tsx` (기능 이관 후 삭제)
- **변경 파일**:
  - `app/components/features/AdminDashboard.tsx` — `ProjectsTable` → `InfrastructureList` 치환, 상태 관리(actionLoading, handleConfirmCompletion, handleViewApproval) 이관
- **회귀 체크 필수**: `ProcessStatus`별 액션(승인 요청 확인, 확정 대기, 완료 확정 등)이 신규 레이아웃에서도 **반드시 트리거 가능해야 한다**.
- **예상 라인**: ~450줄 (신규) + ~100줄 (dashboard 변경).

### PR #5 — ProjectCreateModal 재작성 (Screen 2)

- **변경 파일**: `app/components/features/ProjectCreateModal.tsx` (전면 교체).
- **신규 파일**:
  - `app/components/features/project-create/ProviderChipGrid.tsx`
  - `app/components/features/project-create/ProviderCredentialForm.tsx`
  - `app/components/features/project-create/DbTypeMultiSelect.tsx`
  - `app/components/features/project-create/StagedInfraTable.tsx`
  - `lib/constants/provider-mapping.ts` — Provider chip ↔ 내부 타입/커뮤니케이션 모듈 매핑
- **API**: `createProject`을 `Promise.all`로 여러 번 호출 (옵션 1). 단일 등록 케이스도 동일 코드로 동작.
- **CloudProvider 확장**: Phase 0 합의 결과에 따라 접근 A 또는 B.
- **예상 라인**: ~600줄.

### PR #6 — Stepper 7-step + GuideCard (warm variant)

- **변경 파일**:
  - `app/components/features/process-status/StepProgressBar.tsx` — 7-step, zero-padded label, 원 크기 확대, halo ring, clickable hover.
  - `lib/constants/process-guides.ts` — 7-step 콘텐츠 병합.
- **신규 파일**:
  - `app/components/features/process-status/GuideCard.tsx` — warm variant 카드 + 타이포
- **`ProcessStatus` enum**: Phase 0 결정에 따라 (A) 라벨만 추가 or (B) 신규 상태 추가.
- **검증**: 각 ProcessStatus에 대해 Stepper 렌더 확인, Guide Card 내 콘텐츠 스위칭.
- **예상 라인**: ~400줄.

### PR #7 — ProjectDetail Shell 재구성 (TopNav/ServiceSidebar/ProjectSidebar 모두 제거)

- **변경 파일**:
  - `app/projects/[projectId]/aws/AwsProjectPage.tsx`
  - `app/projects/[projectId]/azure/AzureProjectPage.tsx`
  - `app/projects/[projectId]/gcp/GcpProjectPage.tsx`
  - `app/projects/[projectId]/idc/IdcProjectPage.tsx`
  - `app/projects/[projectId]/sdu/SduProjectPage.tsx`
  - `app/projects/[projectId]/common/ProjectHeader.tsx` (→ ProjectPageMeta로 축소/Rename)
- **제거 대상**:
  - `app/components/layout/ProjectSidebar.tsx` (기능 PageMeta로 이전)
  - `ProjectInfoCard`, `AwsInfoCard`, `AzureInfoCard`, `GcpInfoCard`의 **표시 방식** 변경 (별도 카드 → meta 라인. 컴포넌트 자체는 "상세 정보 펼치기" 모달/드로어용으로 보존).
- ⚠️ **레이아웃 분리 확인**: 상세 페이지는 PR #2에서 설정한 admin 전용 layout(`app/integration/admin/layout.tsx`)의 영향을 받지 않아야 한다. `app/integration/projects/[projectId]/layout.tsx`를 **명시적으로 생성**하여 TopNav/ServiceSidebar 없는 shell을 고정.
  - 샘플:
    ```tsx
    // app/integration/projects/[projectId]/layout.tsx
    export default function ProjectDetailLayout({ children }: { children: React.ReactNode }) {
      return <div className="min-h-screen bg-[var(--bg-muted)]">{children}</div>;
    }
    ```
- **회귀 체크**: 각 provider별 페이지가 정상 렌더, `ProcessStatusCard`/`ScanPanel`/`ResourceTable` 정상 동작. **Breadcrumb에서 "Service List"를 클릭하면 `/integration/admin`으로 돌아가는지 직접 확인** (TopNav가 없으므로 이 동선이 유일한 복귀 경로).
- **예상 라인**: ~550줄.

### PR #8 — ScanPanel Headless 전환 + DbSelectionTable

- **변경 파일**:
  - `app/components/features/scan/ScanPanel.tsx` → `ScanController.tsx` (headless 렌더-props 패턴) + visible state 컴포넌트 분리.
  - `app/components/features/scan/ScanEmptyState.tsx` (신규)
  - `app/components/features/scan/ScanRunningState.tsx` (신규)
  - `app/components/features/scan/ScanErrorState.tsx` (신규)
  - `app/components/features/ResourceTable.tsx` → 컬럼 구성 변경 (Resource ID, 연동 완료 여부, 스캔 이력 추가).
  - Provider별 Body (`AwsResourceTableBody` 등) — 컬럼 동기화.
- **API 영향**: `Resource` 타입에 `scanHistoryStatus` 필드 추가 필요 (BFF 합의 후).
- **예상 라인**: ~600줄.

### PR #9 — 정리 및 regression 체크

- 디자인 토큰 미정리 raw hex 제거.
- 사용되지 않는 imports 제거.
- 스크린샷 첨부 PR 설명.

---

## 6. 오픈 이슈 — **전체 Resolved (2026-04-22 사용자 확정)**

| # | 이슈 | **확정 결정** |
|---|---|---|
| I-01 | PermissionsPanel 처리 | ✅ **삭제**. `PermissionsPanel.tsx` + `AdminDashboard`의 관련 상태·핸들러·`getPermissions` 호출 제거. API 함수(`addPermission`/`deletePermission`/`getPermissions`)와 route.ts·mock은 dead code로 보존 후 별도 cleanup PR에서 일괄 정리 |
| I-02 | InfraCard 내 ProcessStatus CTA | ✅ **A안** — 헤더 우측에 `[status-aware CTA][관리 ▾]` 2개 병렬 배치. 추가 규칙: ① expand chevron은 `ProcessStatus ≥ INSTALLING`에서만 활성, ② IDC·SDU는 펼침 영역 자체 없음, ③ expand 클릭 시에만 `getConfirmedIntegration(targetSourceId)` lazy fetch + 컴포넌트 state 캐시 |
| I-03 | 타겟소스 상세 사이드바 이관 | ✅ **PageMeta 4kv만**. Cloud Provider / Subscription·Account ID / Jira Link / 모니터링 방식. 드로어·"상세 정보 보기" 링크 등 추가 UI 없음. `AwsInfoCard`·`AzureInfoCard`·`GcpInfoCard`·`ProjectInfoCard` 사용 중단 (컴포넌트 파일은 T17에서 정리) |
| I-04 | Step 06 "관리자 승인 대기" | ✅ **라벨만 추가** (`ProcessStatus` enum **불변**). Step 06은 `CONNECTION_VERIFIED` 상태에 매핑하여 UI 표시 |
| I-05 | ScanHistoryList / CooldownTimer | ✅ **완전 삭제** (모달 분리 보존 X). `ScanHistoryList.tsx` 200 LOC + `CooldownTimer.tsx` 78 LOC = **-278 LOC**. `CooldownTimer`는 이미 dead code. "Last Scan: {timestamp}"은 `latestJob.updatedAt`로 헤더에 표시 유지 |
| I-06 | "스캔 이력" 컬럼 (NEW/CHANGED) | ✅ **stub 렌더**. 컬럼 헤더 유지, 모든 row 값은 `—` (null). 데이터 소스 헬퍼 `getResourceScanHistory(resource) → null` 스텁 1줄. BFF 필드 확정 시 이 헬퍼만 교체 |
| I-07 | 상세 페이지 복귀 UX | ✅ **Breadcrumb 단일 제공**. 초기 결정(Breadcrumb + `backHref` 이중 제공)은 2026-04-23 사용자 요청으로 번복 — `PageHeader backHref` 및 `← 목록으로` ghost 버튼 제거. Breadcrumb의 "Service List" 링크만 유지. 관련 PR: #294 |
| I-08 | 미구현 상단 메뉴 | ✅ **표시 + "Coming soon" 토스트**. Credentials / PII Tag mgmt. / PII Map 메뉴를 TopNav에 렌더하되 클릭 시 비활성 상태 피드백 |
| C-01 | CloudProvider 확장 (OTHER/SAAS) | ✅ **자동 해소** — C-03/C-04에서 IDC·Other·SaaS chip을 disabled 처리하므로 enum 확장 불필요. Swagger 확인 스킵 |
| C-02 | 생성 모달 누적형 vs 단일 | ✅ **누적형 유지**. Save 시 `Promise.all(createProject)` 병렬 호출. bulk endpoint 신규 X |
| C-03 | 커뮤니케이션 모듈 매핑 | ✅ **AWS / Azure / GCP만 활성**. 각각 `AWS Agent` / `Azure Agent` / `GCP Agent`. **IDC, Other Cloud/IDC, SaaS는 chip disabled ("준비중" 배지)** — 이 3종에 대한 모듈 매핑 정의 불필요 |
| C-04 | Provider별 입력 필드 | ✅ **AWS/Azure/GCP만 필드 렌더**. 시안대로 AWS(Payer+Linked) / Azure(Tenant+Subscription) / GCP(Project ID). 기존 AWS `awsRegionType` radio는 chip AWS Global/China로 분리되므로 **필드에서 제거**. 나머지 3 chip은 클릭 불가 |
| C-05 | DB Type 목록 출처 | ✅ `lib/constants/db-types.ts` 정적 상수 6종: `mysql, mssql, postgresql, athena, redshift, bigquery` |
| C-06 | 모달 폭 변경 | ✅ **560 → 840px** |

### 후속 재검토 사항 (이번 Phase 제외)
- **IDC 신규 생성 경로** — C-03/C-04에서 IDC chip이 disabled 처리되어 이 모달로는 IDC 타겟소스를 새로 만들 수 없음. 기존 IDC 프로젝트 조회/상세/스캔은 정상 동작. IDC 온보딩 경로는 후속 PR에서 재검토
- **PermissionsPanel 전면 폐기** — 현재는 UI만 제거. 권한 관리 API의 운영 지속 여부는 별도 의사결정
- **`resource.scanHistoryStatus`** — BFF 지원 시 헬퍼 교체로 스캔 이력 컬럼 활성화
- **2026-04-23: I-07 번복** — `PageHeader` `← 목록으로` ghost 버튼 제거. Breadcrumb만으로 복귀 동선 충분하다는 사용자 결정 (PR #294)

---

## 7. 리스크와 완화책

| 리스크 | 완화 |
|---|---|
| **대형 레이아웃 변경 → 회귀 위험** | PR 9개로 쪼개서 단계적 배포. 각 PR에 시각적 diff 스크린샷 첨부 |
| **ProcessStatus enum 변경은 폭발 반경 큼** | Phase 0에서 접근 A(라벨만) 선택. B 선택 시 별도 Epic으로 분리 |
| **Contract-First 원칙 위반** | 확장 필요한 필드/상태는 모두 BFF Swagger 먼저 확정 (`docs/swagger/*.yaml` 업데이트 PR 선행) |
| **다중 Provider Mock 호환성 깨짐** | `lib/api/mocks/`의 시나리오가 신규 매핑과 호환되는지 회귀 테스트. `jest.config` 확인 |
| **Tailwind hover 동적 클래스 미작동 (누적 교훈)** | `hover:${primary}` 금지, 정적 문자열 사용 |
| **raw 색상 클래스 사용 (CLAUDE.md ⛔)** | ESLint/review에서 `#0064FF` 등 하드코딩 적발. theme.ts 토큰 확장 이후 arbitrary value도 경유 |
| **ux-expert 리뷰 미반영** | PR #3, #5, #7은 ux-expert 서브에이전트로 리뷰 필수 |

---

## 8. Definition of Done (per PR)

각 PR에 대해 다음을 충족해야 merge 가능:

- [ ] `npm run lint`, `npm run type-check`, `npm run build` 모두 통과
- [ ] 시각 확인: 스크린샷을 PR description에 첨부 (Before/After)
- [ ] 관련 ProcessStatus 전이 시나리오 2개 이상 손수 테스트 (dev 서버)
- [ ] ADR-007(2-hop BFF), ADR-006(승인→반영→설치 병합) 위반 여부 체크
- [ ] 미사용 imports 정리
- [ ] CLAUDE.md ⛔ 금칙 위반 0건 (main 직접 커밋 / any / 상대 경로 / raw 색상)
- [ ] 신규 컴포넌트는 최대 ~200줄, 초과 시 하위 분리

---

## 9. 부록 — 파일 목록 요약

### 신규 생성 (20+)
- `app/components/layout/TopNav.tsx`
- `app/components/ui/Breadcrumb.tsx`
- `app/components/ui/PageHeader.tsx`
- `app/components/ui/PageMeta.tsx`
- `app/components/features/admin/infrastructure/InfrastructureList.tsx`
- `app/components/features/admin/infrastructure/InfraCard.tsx`
- `app/components/features/admin/infrastructure/InfraCardHeader.tsx`
- `app/components/features/admin/infrastructure/InfraCardBody.tsx`
- `app/components/features/admin/infrastructure/InfraDbTable.tsx`
- `app/components/features/admin/infrastructure/ManagementSplitButton.tsx`
- `app/components/features/admin/infrastructure/index.ts`
- `app/components/features/project-create/ProviderChipGrid.tsx`
- `app/components/features/project-create/ProviderCredentialForm.tsx`
- `app/components/features/project-create/DbTypeMultiSelect.tsx`
- `app/components/features/project-create/StagedInfraTable.tsx`
- `app/components/features/process-status/GuideCard.tsx`
- `app/components/features/scan/ScanEmptyState.tsx`
- `app/components/features/scan/ScanRunningState.tsx`
- `app/components/features/scan/ScanErrorState.tsx`
- `lib/constants/provider-mapping.ts`
- `app/integration/admin/layout.tsx` — **TopNav 포함 레이아웃 (admin 섹션 전용)**
- `app/integration/projects/[projectId]/layout.tsx` — **TopNav 미포함 레이아웃 (상세 전용)**

### 전면 재작성 (3)
- `app/components/features/ProjectCreateModal.tsx`
- `app/components/features/AdminDashboard.tsx` (Shell 교체)
- `app/components/features/process-status/StepProgressBar.tsx` (7-step)

### 부분 수정 (10+)
- `lib/theme.ts`
- `lib/routes.ts`
- `lib/types.ts` (CloudProvider 확장 검토)
- `lib/constants/process-guides.ts`
- `app/components/features/admin/ServiceSidebar.tsx`
- `app/components/features/scan/ScanPanel.tsx`
- `app/components/features/ResourceTable.tsx` (+ resource-table/*)
- `app/projects/[projectId]/{aws,azure,gcp,idc,sdu}/*ProjectPage.tsx` (5개)
- `app/projects/[projectId]/common/ProjectHeader.tsx`
- `app/layout.tsx` — **TopNav 넣지 않음** (상세 페이지 영향 방지). 섹션별 layout에서 분기.

### 제거 대상 (2)
- `app/components/features/admin/ProjectsTable.tsx`
- `app/components/features/admin/AdminHeader.tsx` (TopNav 통합)
- `app/components/layout/ProjectSidebar.tsx`

---

**끝.** 이 계획을 승인/수정 후 Phase 0 오픈 이슈를 해결하고 PR #1부터 순차 진입한다.
