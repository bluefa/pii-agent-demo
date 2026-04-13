# GCP BFF API 검증 계획

> Issue: [#251](https://github.com/bluefa/pii-agent-demo/issues/251) — GCP 설치 상태 조회 API
> Reference PR: [#256](https://github.com/bluefa/pii-agent-demo/pull/256) — GCP Page Rendering 이슈 수정
> Branch: `docs/gcp-api-verification`
> Date: 2026-04-13

---

## 1. 배경

Issue #251에서 GCP 설치 상태 조회 API swagger가 선언되었다. 기존 구현(`docs/swagger/gcp.yaml`)과 비교하여 BFF API가 실제로 동작 가능한지 검증하고, PR #256에서 발견된 것과 유사한 GCP 페이지 렌더링/API 이슈를 Azure와 비교하여 식별한다.

## 2. 검증 범위

### A. 설치 상태 API (Installation Status) — 스키마 정합성

| 항목 | 기존 구현 (`swagger/gcp.yaml`) | Issue #251 선언 |
|------|-------------------------------|-----------------|
| Step 모델 | 2필드: `service_tf_status`, `bdc_tf_status` | 3-Step: `serviceSideSubnetCreation`, `serviceSideTerraformApply`, `bdcSideTerraformApply` |
| Step 값 | `GcpTfStatus` enum 직접 사용 | `StepStatus` 객체 (`status` + `guide`) |
| LastCheck 상태 | `SUCCESS`, `IN_PROGRESS`, `FAILED` | `NEVER_CHECKED`, `IN_PROGRESS`, `COMPLETED`, `FAILED` |
| Summary | 없음 | `totalCount`, `completedCount`, `allCompleted` |
| Resource 서브타입 | 없음 (connectionType은 legacy) | `resourceSubType`: `PRIVATE_IP_MODE`, `BDC_PRIVATE_HOST_MODE`, `PSC_MODE` |
| pending_action | `GcpActionType` enum | 없음 (Step SKIP으로 대체) |

**검증 포인트:**
1. 기존 BFF route가 swagger/gcp.yaml 스키마와 일치하는지 확인
2. Issue #251 스키마와의 차이가 향후 마이그레이션 필요한지 판단
3. route transform 함수가 legacy → v1 변환 시 필드 누락 없는지 검증

### B. 설치 상태 API — 동작 검증

**Route 파일:** `app/api/v1/gcp/target-sources/[targetSourceId]/installation-status/route.ts`

| # | 검증 항목 | 상태 | 상세 |
|---|----------|------|------|
| B1 | `client.gcp.getInstallationStatus()` 호출 체인 | 확인 필요 | route → api-client → mock → mock-gcp.ts |
| B2 | `resolveProjectId` → mock에서 GCP 프로젝트 정상 매핑 | 확인 필요 | targetSourceId → projectId 변환 후 GCP 프로젝트인지 검증 |
| B3 | mock `getGcpInstallationStatus` 리소스 생성 | **이슈 가능** | `project.resources`에서 `isSelected` 리소스만 사용 → GCP mock 프로젝트에 resources가 있는지? |
| B4 | `transformResource` 필드 매핑 | **이슈 발견** | `regionalManagedProxy.cloudSqlRegion` 이 route transform에서 **누락됨** (swagger에는 포함) |
| B5 | `buildLastCheck` 반환값 | 확인 필요 | `SUCCESS` 반환하지만 `NEVER_CHECKED` 케이스 미처리 |
| B6 | check-installation POST 체인 | 확인 필요 | 동일 transform 로직 사용, 상태 전이 동작 검증 |

### C. Settings API — 동작 검증

**Route 파일:** `app/api/v1/gcp/target-sources/[targetSourceId]/settings/route.ts`

| # | 검증 항목 | 상태 | 상세 |
|---|----------|------|------|
| C1 | API client 함수 존재 여부 | **미구현** | `app/lib/api/gcp.ts`에 `getGcpSettings` 함수 없음 (Azure는 있음) |
| C2 | GcpProjectPage에서 settings 로딩 | **미구현** | Azure는 `useEffect`로 `getAzureSettings()` 호출, GCP는 미호출 |
| C3 | settings route → mock 데이터 | 부분 동작 | `resolveProject` 사용 (Mock 전용) → BFF 모드 미지원 |
| C4 | GcpInfoCard에서 settings 표시 | **미구현** | service account 정보 미표시 (Azure는 scanApp 표시) |

### D. 연동정보(리소스) 조회 — PR #256 관련

**PR #256에서 발견된 이슈와 동일 패턴 검증:**

| # | 검증 항목 | 상태 | 상세 |
|---|----------|------|------|
| D1 | `getConfirmResources()` 호출 | **미구현 (main)** | GcpProjectPage가 `project.resources` 직접 사용 → PR #256에서 수정 진행 중 |
| D2 | ConfirmResource → Resource 변환 | PR #256에서 구현 | `AZURE_VM` 하드코딩 → GCP에는 VM이 없으므로 불필요하나, 타입 변환 로직 검증 필요 |
| D3 | `getApprovalHistory` 호출 | **미구현** | Azure는 4개 API 병렬 호출 (catalog, approval history, approved/confirmed integration), GCP는 catalog만 |
| D4 | Resource ownership 병합 | **미구현** | Azure는 `buildAzureOwnedResources()`로 4소스 병합, GCP는 해당 로직 없음 |
| D5 | services/page 페이징 응답 구조 | PR #256에서 수정 | `raw.page.totalElements` → `raw.totalElements` (GCP/Azure 공통) |

### E. Azure 대비 GCP 누락 기능

| # | Azure 패턴 | GCP 현황 | 우선순위 |
|---|-----------|---------|---------|
| E1 | `getAzureSettings()` → `AzureInfoCard`로 전달 | settings 미로딩 | HIGH |
| E2 | `loadAzureResources()` — 4개 API 병렬 | `getConfirmResources()` 단독 (PR #256) | HIGH |
| E3 | `buildAzureOwnedResources()` 병합 | 미구현 | MEDIUM |
| E4 | resourceLoading/resourceError 상태 관리 | PR #256에서 추가 | HIGH |
| E5 | `isMissingSnapshotError` graceful fallback | 미구현 | MEDIUM |

## 3. 결론 — 검증 결과 요약

### 동작 가능 여부

| API | 동작 가능? | 비고 |
|-----|-----------|------|
| `GET /installation-status` | **조건부 가능** | mock 데이터 경로는 동작하나, transform에서 `cloudSqlRegion` 누락. GCP 프로젝트의 resources 존재 여부에 의존 |
| `POST /check-installation` | **조건부 가능** | 동일 transform 이슈. 상태 전이 시뮬레이션은 동작 |
| `GET /settings` | **route만 동작** | API client 함수 미구현 → 페이지에서 호출 불가 |
| `GET /resources` (공통) | **route 동작** | 페이지에서 미호출 (PR #256에서 수정 중) |

### 수정 필요 항목 (우선순위순)

1. **[HIGH] `getGcpSettings` API client 추가** — `app/lib/api/gcp.ts`
2. **[HIGH] GcpProjectPage 리소스 로딩** — PR #256 패턴 적용 (main 병합 후 또는 별도 작업)
3. **[HIGH] GcpProjectPage settings 로딩** — Azure 패턴 참고 (`useEffect` + `getGcpSettings`)
4. **[MEDIUM] `transformResource`에서 `cloudSqlRegion` 포함** — swagger 정합성
5. **[MEDIUM] GcpInfoCard에 service account 표시** — settings 데이터 활용
6. **[LOW] Issue #251 3-Step 모델 마이그레이션 판단** — 기존 2필드 모델과 3-Step 모델 간 전략 결정 필요

## 4. 향후 작업 제안

### Phase 1: 즉시 수정 (이번 세션 가능)
- `getGcpSettings` API client 함수 추가
- `installation-status` route transform 정합성 수정 (`cloudSqlRegion` 포함)
- GcpProjectPage에 settings 로딩 추가

### Phase 2: PR #256 병합 후
- PR #256의 리소스 로딩 패턴이 main에 병합되면, 추가적인 연동정보 API 호출 보강
- `getApprovalHistory`, `getApprovedIntegration`, `getConfirmedIntegration` 병렬 호출 추가
- `buildGcpOwnedResources()` 리소스 병합 로직 구현

### Phase 3: Issue #251 스키마 마이그레이션
- 3-Step 모델 전환 여부 결정
- 전환 시 route transform, mock data, UI 컴포넌트 일괄 수정 필요

---

## 참조 파일

| 파일 | 역할 |
|------|------|
| `app/api/v1/gcp/target-sources/[targetSourceId]/installation-status/route.ts` | 설치 상태 조회 BFF route |
| `app/api/v1/gcp/target-sources/[targetSourceId]/check-installation/route.ts` | 설치 상태 새로고침 BFF route |
| `app/api/v1/gcp/target-sources/[targetSourceId]/settings/route.ts` | GCP 설정 조회 BFF route |
| `app/lib/api/gcp.ts` | GCP API client 함수 |
| `app/projects/[projectId]/gcp/GcpProjectPage.tsx` | GCP 페이지 컴포넌트 |
| `app/components/features/GcpInfoCard.tsx` | GCP 정보 카드 |
| `lib/mock-gcp.ts` | GCP mock 데이터 생성 |
| `lib/api-client/mock/gcp.ts` | GCP mock API wrapper |
| `docs/swagger/gcp.yaml` | 기존 GCP API swagger |
| `app/projects/[projectId]/azure/AzureProjectPage.tsx` | Azure 페이지 (참조 패턴) |
| `app/lib/api/azure.ts` | Azure API client (참조 패턴) |
