# integration/admin → integration/services 복원 + URL 기반 서비스 선택

> 작업 브랜치: `feat/integration-services` (base: `origin/main`)
> 범위 결정: **Full** (조회 + 생성 + 승인 모두, 신 ADR-019 API로 재작성)

## 1. 배경 (왜 삭제됐나)

- **삭제 커밋: PR #508** (`d294005e` / `dac671e9`, "refactor(adr019): swagger-driven zod codegen — install-v1 as sole contract", main 머지됨)
- ADR-019에서 `docs/swagger/admin_dashboard.yaml`(531줄)을 "install-v1.yaml 단일 계약" 정리로 제거 → 그 계약에 의존하던 **서비스 관리 UI 전체가 orphan으로 함께 삭제** (~30파일 / 2,000줄+):
  - `AdminDashboard.tsx`, `app/integration/admin/page.tsx`, `admin/dashboard/page.tsx`, `task_admin/page.tsx`
  - `admin/v7/*`, `admin/infrastructure/*`, `AdminHeader`, `ApprovalDetailModal`, `ProjectCreateModal`
  - admin/dashboard·task-admin API 라우트, `admin_dashboard.yaml`
- **main 현재 깨짐**: `app/page.tsx`가 `/integration/admin`(page 없음)로 redirect → **404**. TopNav "Service List", breadcrumb, ServiceListPanel "서비스 이동"도 죽은 경로.
- **생존**: `admin/guides`(가이드 CMS), `admin/layout.tsx`, `ServiceSidebar`, `admin-dashboard/{serviceListReducer, pendingAdminNavigation}`, target-source의 `ServiceListPanel`/`ServiceMoveConfirmModal`, `getServicesPage`/`getProjects` API.

## 2. 목표

삭제된 서비스 관리 화면을 **`/integration/services`** 로 복원하고, 서비스 선택을 **URL `?service_code=` 쿼리 파라미터**로 구동한다.

### 사용자 요구사항
1. `/integration/services` 페이지 신설 (admin 서비스 관리 화면 복원)
2. 진입 시 **아무 서비스도 선택되지 않음** (기존 "첫 서비스 자동 선택" 제거)
3. 페이지 이동 시 `?service_code=<code>` 쿼리로 서비스 선택 이동
4. target-source 상세의 **"서비스 이동"** 클릭 → `/integration/services?service_code=<code>` 이동

## 3. 핵심 설계 결정

| 결정 | 내용 |
|------|------|
| 선택 상태 단일 출처 | URL `?service_code=` 만. 모듈 변수 `pendingAdminNavigation` 제거 |
| 기본 미선택 | mount 시 첫 서비스 자동선택(`SET_SELECTED data.content[0]`) **제거** → "서비스를 선택하세요" placeholder |
| 단건 조회 API 부재 | service 단건(이름 포함) 조회 API 없음 → 사이드바 목록에 없으면 `getServicesPage(0,size,query=code)` 정확일치 검색으로 이름 보강, 그래도 없으면 헤더에 코드만 |
| 대소문자 | 검색은 무시(`toLowerCase` 부분일치) / `/services/{code}/target-sources`는 **정확일치(틀리면 404)** → URL엔 **원본 코드** 전달 (ServiceListPanel은 `svc.code` 원본 사용) |
| 사이드바 search/page | URL에 넣지 않음 (요구사항은 service_code만) — 로컬 상태 유지 |

## 4. 구현 항목

### A. 라우트 / 페이지
- `app/integration/services/page.tsx` — 서버 컴포넌트, 클라이언트 뷰 렌더
- `app/integration/services/layout.tsx` — `<TopNav />` + children (admin/layout.tsx 패턴)
- `app/integration/services/_components/ServiceManagementView.tsx` — 복원·각색한 메인 뷰 (구 `AdminDashboard`)
  - `useSearchParams()`로 `service_code` 읽어 `selectedService` 도출
  - 사이드바 선택 → `router.push('/integration/services?service_code=' + encodeURIComponent(code))`
  - 미선택 placeholder, 자동선택 제거

### B. 컴포넌트 복원 (6e3812f5에서 복원, 신 API에 맞게 보정)
- `admin/v7/*` (InfraRowList, InfraRow, ServiceHeaderV7, StatusPillV2, ProviderLogo, InfraListToolbar, InstallModeToggle, AwsRegionToggle, RegistrationPreviewCardList, RegistrationProgressList, index)
- `admin/infrastructure/{ManagementSplitButton, InfrastructureEmptyState}` (목록이 사용하는 2개만)
- `admin/ApprovalDetailModal.tsx`
- `admin-dashboard/{approvalModalState.ts, types.ts}`
- `ProjectCreateModal.tsx`
- barrel: `admin/index.ts` 재생성(ServiceSidebar + ApprovalDetailModal), `admin-dashboard/index.ts`에 ApprovalModalState 추가

### C. 신 ADR-019 API 재작성 (드리프트 보정)
| 영역 | old (6e3812f5) | new (main) |
|------|----------------|------------|
| 생성 후보 | `previewTargetSourceRegistration(req: RegistrationPreviewRequest): RegistrationPreviewItem[]` | `getCreationCandidates(serviceCode, input: CreationCandidatesInput): TargetSourceCreationCandidateResponse[]` |
| 생성 | `createProject(payload)` | `createTargetSource(serviceCode, candidate)` |
| 승인 조회 | `getApprovalHistory(.., 0, 1).content[0].request` | `getApprovalRequestLatest(targetSourceId): ApprovalRequestLatestDto` |
| 승인/반려 | `approveApprovalRequestV1`/`rejectApprovalRequestV1` (유지) | 동일 (반환 `ApprovalActionResponseDto`) |
| 권한자 | `getPermissions(): UserSearchResult[]` | `getPermissions(): AuthorizedUsersResponse` |
| 유저 검색 | `searchUsers(): UserSearchResult[]` | `searchUsers(): UserSearchResponse` |
| 서비스 목록 | typed `.content/.page` | loose `PageServiceItem`(nullable) → fallback 처리 |

- `ApprovalDetail`/`ApprovalDetailModal`: `ApprovalResourceInput` 제거됨 → `ApprovalRequestLatestDto` 스키마 기준으로 재정의·렌더
- `ProjectCreateModal`: input → candidates(preview) → progress 흐름을 신 API 데이터 모델로 재작성

### D. 네비게이션 재배선
- `lib/routes.ts`: `services: '/integration/services'` 추가, 미사용 `admin`/`adminDashboard` 정리(참조 확인 후)
- `app/page.tsx`: redirect → services
- `app/components/layout/TopNav.tsx`: "Service List" href + isActive → services
- `target-sources/.../common/ProjectPageMeta.tsx`: breadcrumb href → services
- `target-sources/.../ServiceListPanel.tsx`: `handleConfirm` → `router.push(services?service_code=)` (pendingAdminNavigation 사용 제거)

### E. 정리 (오펀 제거)
- `admin-dashboard/pendingAdminNavigation.ts` + `pendingAdminNavigation.test.ts` 삭제 (URL로 대체되어 미사용 시)
- 내 변경으로 미사용된 import/심볼 제거

## 5. 비범위 (이번에 복원 안 함)
- KPI 대시보드(`/integration/admin/dashboard`), `task_admin`, `admin_dashboard.yaml` swagger, admin/dashboard API 라우트 — ADR-019 단일계약 방향 유지

## 6. Definition of Done

### 기능
- [ ] `/integration/services` 렌더, 사이드바 서비스 목록 표시, **기본 미선택**("서비스를 선택하세요")
- [ ] `?service_code=XXX` 진입 → 해당 서비스 선택 + 타겟소스 목록/헤더 표시
- [ ] service_code 없음/빈값 → 미선택 placeholder
- [ ] 사이드바에서 서비스 선택 → URL `?service_code=` 갱신 (뒤로가기/공유 동작)
- [ ] target-source 상세 "서비스 이동" → `/integration/services?service_code=<code>` 이동
- [ ] `app/page.tsx` redirect → `/integration/services` (404 해소)
- [ ] TopNav "Service List" + breadcrumb → `/integration/services`
- [ ] 생성 모달: `getCreationCandidates` → `createTargetSource` 흐름 동작
- [ ] 승인 모달: `getApprovalRequestLatest` 기반 조회 + approve/reject 동작

### 품질
- [ ] `npx tsc --noEmit`: 내 변경으로 인한 **신규 에러 0** (사전존재 `scan/ScanPanel`·`lib/generated/install-v1` 제외)
- [ ] `npm run lint` 통과
- [ ] `npx vitest run` 관련 테스트 통과 (삭제한 pendingAdminNavigation 테스트 제외)
- [ ] `npm run build` 통과
- [ ] 오펀 파일/심볼 없음 (pendingAdminNavigation 등)
- [ ] **codex 리뷰** 반영 (체크포인트별)
- [ ] 자체 코드리뷰 반영
- [ ] CLAUDE.md 규칙 준수 (no any / `@/` 절대경로 / theme 토큰 / 영어 경로 영어작성)
