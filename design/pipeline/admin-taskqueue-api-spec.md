# Admin Task Queue — 페이지별 API 호출 명세

> Phase 1 산출물. 계약 SSOT = `docs/swagger/install-v1.yaml`(= 최신 `docs/api-docs.yaml`, Phase 0에서 교체).
> 모든 wire 타입은 `lib/generated/install-v1.ts`(ADR-019 loose codegen: 전 필드 nullable+partial,
> enum→string, format 제거). 프로토타입 = `design/pipeline/admin-taskqueue.html`,
> 스토리보드 = `admin-taskqueue-storyboard.md`.
>
> 호출 구조는 앱 표준 3-hop: **CSR → `app/api/v1/**` route(`schemas.X.parse`) → `bff` client(mock|http)**.
> CSR은 route 응답(camel 도메인)만 소비한다. casing 경계는 route가 소유한다 (ADR-019).

## 공통

| 항목 | 값 |
|---|---|
| BFF client 확장 | `lib/bff/types.ts` `BffClient`에 `taskQueue` 그룹 신설 |
| mock | `lib/bff/mock/task-queue.ts` (seed는 `lib/mock-data` 재사용 + 신규 fixture) |
| http | `lib/bff/http.ts`에 upstream 경로 매핑 추가 |
| 페이지네이션 | 계약 기본값 그대로: `page`(0-index), `size` (page API def 10 · process-statuses def 20 max 100) |
| 에러 | 기존 CSR 에러 전략(ADR-008) — route가 ErrorMessage를 상태코드 그대로 중계 |

## P1 운영 대시보드 `/admin/pipelines/queue`

### KPI 4종
- `GET /install/v1/dashboard/summary` → `DashboardSummaryResponse`
  - `pending_approval_count` → 연동 요청 대기
  - `rejected_approval_count` → 연동 요청 반려
  - `test_connection_completed_count` → 연결 테스트 완료
  - `test_connection_rejection_count` → 연결 테스트 반려
- 호출: 페이지 진입 시 1회 + 모니터와 같은 30s 폴링 주기로 재조회.

### Process Status 모니터
- `GET /install/v1/process-statuses?processStatus=&targetSourceId=&page=&size=` → `PageProcessStatusCurrentResponse`
  - row = `ProcessStatusCurrentResponse`:
    `target_source_id` · `process_status`(IDLE|PENDING|CONFIRMING|CONFIRMED|INSTALLED|CONNECTED|COMPLETED)
    · `status_changed_at` · **`delay_seconds`(서버 계산 — 프론트 계산 금지)** · `target_source`(= `TargetSourceMetadataResponse`, `service_info`로 서비스 이름/코드)
  - Step 매핑(스토리보드 §1): IDLE=1 연동 대상 DB 선택 … COMPLETED=7 완료.
- 필터: `processStatus`는 **서버 쿼리로 전달**. 지연 필터(1시간↑/1일↑/7일↑)는 계약에 없음 → **클라 필터**(현재 페이지 데이터 기준) — 계약 갭으로 명세에 표기.
- 폴링: 30s `setInterval` 재조회 (`delay_seconds`가 서버 계산이므로 재조회만 하면 됨).

## P2 연동 요청 목록 `/admin/pipelines/queue/requests`

- `GET /install/v1/target-sources/page?confirmStatus=&page=&size=10` → `PageTargetSourceInfo`
  - 탭: 승인 대기=`confirmStatus=PENDING` · 반려=`confirmStatus=REJECTED` · 전체=파라미터 생략.
  - row = `TargetSourceInfo` (⚠️ **camel 섬**: `targetSourceId`/`serviceName`/`serviceCode`/`cloudProvider`/`confirmStatus` camel + `latest_approval_request` snake 혼재 — route에서 정규화)
  - 반려 사유/일자: `latest_approval_request`(`LatestApprovalRequestSummaryDto`)의 `reason` / `processed_at`.

## P3 연동 요청 상세 `/admin/pipelines/queue/requests/[targetSourceId]`

### 요청 정보 + 리소스 목록
- `GET /install/v1/target-sources/{id}/approval-requests/latest` → `ApprovalRequestLatestDto`
  - `request` = `ApprovalRequestSummaryDto`(id·status·requested_by·requested_at·resource_total_count·resource_selected_count)
  - `resources[]` = `TargetSourceResourceItemDto` — `selected`·`exclusion_reason`·`metadata`
    (`database_type`·`port`·`oracle_service_id`·`idc_host`·`idc_ips`·`idc_source_ips`·`nlb_index`·`host`…)
  - **resourceId는 UI 비노출** — NLB 저장 호출용으로만 내부 보존.
- 서비스 이름/Cloud 헤더: `GET /install/v1/target-sources/page?targetSourceId={id}` 단건 필터 조회(`TargetSourceInfo` 1행) — 목록과 같은 wire를 재사용해 mock/실 서버 모두 일관.

### IDC 전용 — NLB 현황/배정
- `GET /install/v1/idc/nlb/table` → `NlbTableResponse[]` (⚠️ wire가 **camelCase**: `nlbIndex`·`nlbIpList`·`occupiedListenerCount`)
  - 점유 기준: ≥30 주의, ≥50 Hard Limit (UI 규칙 — 계약엔 없음).
- `PUT /install/v1/target-sources/{id}/approval-requests/nlb-indices`
  - body = `NlbIndexAssignmentDto` **단건** `{resource_id, nlb_index}` — 행별 저장 버튼 1회 호출 = 계약 1회.
  - PENDING 요청에만 허용(계약 설명). 승인 전 미저장 변경 경고는 UI 로컬 상태.

### 승인 / 반려
- `POST /install/v1/target-sources/{id}/approval-requests/approve` body=`ApprovalApproveRequestDto{comment}` (UI 1,024자 제한)
- `POST /install/v1/target-sources/{id}/approval-requests/reject` body=`ApprovalRejectRequestDto{reason}` (계약 maxLength 1,000자)
- 성공 시 P2로 복귀 + 목록 재조회.

## P4 연결 테스트 목록 `/admin/pipelines/queue/test-connections`

- `GET /install/v1/target-sources/test-connection/status?status=&page=&size=10` → `PageTestConnectionRejectStatusResponse`
  - 탭: 완료=`TEST_CONNECTION_COMPLETED` · 재실행 요청=`TEST_CONNECTION_REJECTED` (계약이 이 2값만 허용)
  - row = `TestConnectionRejectStatusResponse`: `target_source_id`·`service_name`·`service_code`·`cloud_provider`·`completed_at`·`reject_reason`·`rejected_at`

## P5 연결 테스트 상세 `/admin/pipelines/queue/test-connections/[targetSourceId]`

### 헤더/상태
- `GET /install/v1/target-sources/{id}/test-connection/status` (단건) → `TestConnectionRejectStatusResponse`

### 리소스별 연결 결과 표
- `GET /install/v1/target-sources/{id}/test-connection/latest-results` → 리소스별 성공/실패 + resource 식별 정보.
  (기존 Step5 어댑터 `lib/bff/logical-db.ts`·`app/api/v1/target-sources/[id]` 경로에 이미 유사 소비가 있으면 재사용.)

### 논리 DB 모달 — **by-resource-id 확정**
- 연동 대상: `GET /install/v1/target-sources/{id}/tested-logical-databases/by-resource-id?resourceId=` → `TestedLogicalDatabasesResponse{logical_database_list[]}` (`database_name`·`schema_name`·`type`(DATABASE|SCHEMA))
- 연동 제외: `GET /install/v1/target-sources/{id}/excluded-databases/by-resource-id?resourceId=` → `SkipLogicalDatabaseResponse{skip_logical_database_list[]}` (+`skip_reason`(STG|DEV|TEMP))
- 호출 시점: 모달 열 때 lazy — 리소스당 2회. 탭 전환은 캐시 재사용.

### 액션
- 재실행 요청: `POST /install/v1/target-sources/{id}/test-connection/reject` body=`TestConnectionRejectRequest{reason}` — **maxLength 512(계약)**.
- 연동 승인: `POST /install/v1/target-sources/{id}/pii-agent-installation/confirm` body=`PiiAgentInstallationConfirmRequest{confirm:true}`.

## 계약 갭 (구현 시 표기 유지)

| # | 갭 | 처리 |
|---|---|---|
| G1 | 지연 필터(1h/1d/7d) 쿼리 없음 | 클라 필터 + 주석 |
| G2 | NLB 30/50 임계값 계약 부재 | UI 상수로 정의 |
| G3 | `TargetSourceInfo` camel 섬 + `latest_approval_request` snake 혼재 | route에서 도메인 camel로 정규화 |
| G4 | `NlbTableResponse` camel wire | route 정규화 (sanctioned) |
| G5 | nlb-indices 단건 계약 | 행별 저장 UX로 흡수 (일괄 저장 없음) |
