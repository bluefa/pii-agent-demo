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

3계층 구성(2026-07-21 개편 — 탭 세그 제거):

1. **연동 요청 확인** — `GET /install/v1/target-sources/page?confirmStatus=PENDING&page=&size=10`
2. **연동 요청 반려 확인** — `GET /install/v1/target-sources/page?confirmStatus=REJECTED&page=&size=10`
   - 보조 텍스트: "반려했으나 서비스 측 담당자가 아직 확인하지 않았어요".
3. **전체 History 확인** — `GET /install/v1/approval-history?toStatuses=&page=&size=10` → generic `Page`
   - `toStatuses` 생략 = 전체. enum 7종: PENDING·APPROVED·AUTO_APPROVED·REJECTED·CANCELLED·UNAVAILABLE·UNAVAILABLE_ACKNOWLEDGED.
   - ⚠️ 계약 갭 **G6**: 200이 generic `Page`(content: object[]) — 항목 필드는 사용자 지정 가정
     (`request_id`·`target_source_id`·`status`·`created_at`·`service_name`·`service_code`, `lib/types/task-queue.ts` 단일 교정점).

- `target-sources/page` row = `TargetSourceInfo` (⚠️ **camel 섬**: `targetSourceId`/`serviceName`/`serviceCode`/`cloudProvider`/`confirmStatus` camel + `latest_approval_request` snake 혼재 — route에서 정규화)
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
- `GET /install/v1/target-sources/{id}/approval-requests/latest/nlb-index-mappings`
  - ⚠️ 계약 갭 **G7**: swagger 미수록 — 사용자 제공 wire(2026-07-21):
    `[{ resource_id, nlb_index_mapping_list: [{ service_code, nlb_index }] }]`.
  - 리소스별 현재 배정된 NLB 리스너(소비 서비스별 1건). 행별 "NLB 정보" 모달의 데이터 소스.
  - 라우트는 raw passthrough, camel 경계는 CSR 어댑터(`getNlbIndexMappings`).

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

## P6 연동 시점 `/admin/pipelines/queue/integration-timeline` (2026-09-15 추가)

목적: TargetSource 가 **언제 만들어졌고 언제 처음 연동을 마쳤는지**를 기간으로 잘라 본다.
통계(중앙값·평균·백분위·기간 비교)는 이 화면의 일이 아니다 — CSV 를 받은 쪽 도구의 몫(오너 결정 09-14).
목업 = `design/admin/target-source-timeline.html`.

### 목록 — ⚠️ 계약 갭 **G8**: swagger 미수록, 신규 BE API 요청 (명세는 아래가 SSOT)

`GET /install/v1/admin/target-sources/integration-timeline`

| Query | 타입 | 필수 | 기본 | 뜻 |
|---|---|---|---|---|
| `axis` | `CREATED` \| `FIRST_INSTALLED` | – | `CREATED` | 기간을 자르는 축. 화면 낱말: `CREATED`=연동 시작 날짜(`created_at`) / `FIRST_INSTALLED`=최초 연동 완료확인 날짜(`pii_agent_first_installed_at`) |
| `from` | `date` (YYYY-MM-DD) | ✅ | – | 구간 시작(포함). Asia/Seoul 자정 기준 |
| `to` | `date` (YYYY-MM-DD) | ✅ | – | 구간 끝(포함). `from ≤ to` 아니면 400 |
| `installed` | `ALL` \| `YES` \| `NO` | – | `ALL` | 최초 연동 완료 여부. `pii_agent_first_installed_at` 유무. ⚠️ 화면 필터는 09-15 제외 — FE 는 보내지 않는다, BE 는 유지해도 무방 |
| `serviceCode` | string | – | – | 기존 목록 API 와 같은 뜻 |
| `confirmStatus` | 기존 enum | – | – | `NO_REQUEST`·`PENDING`·`CONFIRM_INFO_UPDATE_REQUIRED`·`CONFIRMED`·`REJECTED` |
| `page` / `size` | int | – | `0` / `20` | 0-index. `size` 최대 100 |
| `sort` | `prop,dir` | – | `createdAt,desc` | ⚠️ 09-15 화면에서 정렬 제외 — FE 는 `sort` 를 보내지 않는다, 기본 `createdAt,desc` 만 쓴다. BE 는 파라미터를 생략해도 무방(남긴다면 허용 prop `createdAt`·`piiAgentFirstInstalledAt`·`targetSourceId`) |

- `axis=FIRST_INSTALLED` 이면 `installed=NO` 는 정의상 빈 페이지(200, `totalElements: 0`). 400 아님.
- `pii_agent_first_installed_at` 은 초기화로 단계가 되돌아가도 바뀌지 않는 값이다(기존 `TargetSourceResponse` 와 같은 컬럼).

200 → `PageTargetSourceIntegrationTimelineResponse`

```json
{
  "content": [{
    "target_source_id": 4130,
    "service_code": "SVC-PAY",
    "service_name": "결제 정산",
    "cloud_provider": "AWS",
    "confirm_status": "CONFIRMED",
    "created_at": "2026-07-02T10:12:00+09:00",
    "pii_agent_first_installed_at": "2026-07-11T16:40:00+09:00",
    "lead_time_seconds": 800880
  }],
  "totalElements": 41, "totalPages": 3, "number": 0, "size": 20, "first": true, "last": false
}
```

| 필드 | 타입 | 규칙 |
|---|---|---|
| `lead_time_seconds` | int64 \| null | `pii_agent_first_installed_at − created_at` (초). 최초 연동 완료 행만, 아니면 `null`. **BE 가 계산**해 정렬 가능하게 한다 |
| `created_at` · `pii_agent_first_installed_at` | date-time(오프셋 포함) | FE 는 UTC 보정하지 않는다 — BFF 가 오프셋을 보낸다 |
| 나머지 | 기존 `TargetSourceResponse` 부분집합 | `cloud_provider`·`confirm_status` 는 표에 안 그리지만 CSV 열로 쓴다 |

4xx: `ErrorMessage` 그대로 중계(ADR-008). 400 = `from > to`, 잘못된 enum, `size > 100`.

### CSV

같은 경로, `Accept: text/csv`. `page`·`size` 무시, 나머지 필터·정렬 동일.
열 순서 고정: `target_source_id, service_code, service_name, cloud_provider, confirm_status, created_at, pii_agent_first_installed_at, lead_time_seconds`.
행 상한은 BE 재량(제안 10,000 · 초과 시 400). 클라이언트에서 페이지를 모아 만들지 않는다.

### FE 표시 규칙
- 리드타임 = `lead_time_seconds` → `N일 N시간`. 1일 미만 `N시간`, 1시간 미만 `1시간 미만`. `null` 은 `–`.
- 최초 연동 태그 = `완료` / `미완료` 한 사실. 경과일·경고 톤 없음.
- 3-hop: CSR → `app/api/v1/admin/queue/integration-timeline/route.ts` → `bff.taskQueue.getIntegrationTimeline`. wire 타입은 `lib/types/task-queue.ts` 의 `IntegrationTimelineWire` 가 단일 교정점(G7 과 같은 방식). swagger 는 BE 드롭 뒤에만 반영.

## 계약 갭 (구현 시 표기 유지)

| # | 갭 | 처리 |
|---|---|---|
| G1 | 지연 필터(1h/1d/7d) 쿼리 없음 | **우리 route가 필터 소유**(2026-07-21): `?delay=d1\|d2\|d3` → 업스트림 페이지 집계(size 100 × 최대 10페이지) 후 필터·재페이지네이션. UI 세그는 카운트 없이 API 재호출 |
| G2 | NLB 30/50 임계값 계약 부재 | UI 상수로 정의 |
| G3 | `TargetSourceInfo` camel 섬 + `latest_approval_request` snake 혼재 | route에서 도메인 camel로 정규화 |
| G4 | `NlbTableResponse` camel wire | route 정규화 (sanctioned) |
| G5 | nlb-indices 단건 계약 | 행별 저장 UX로 흡수 (일괄 저장 없음) |
| G6 | `/approval-history` 200이 generic `Page` — 항목 스키마 부재 | 사용자 지정 가정 shape로 구현, `ApprovalHistoryItemWire` 단일 교정점 |
| G7 | `nlb-index-mappings` swagger 미수록 | 사용자 제공 wire로 구현, raw passthrough + 어댑터 경계 |
| G8 | `integration-timeline` swagger 미수록 (신규 BE API, P6) | 위 P6 명세를 SSOT 로 `IntegrationTimelineWire` 손선언 + 어댑터 경계. BE 드롭이 오면 generated 타입으로 교체 |
