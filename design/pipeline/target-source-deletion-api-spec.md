# TargetSource 삭제 — FE 가 필요로 하는 BFF API

> 초안 2026-09-18. 요구사항 = 아티팩트 [TargetSource 삭제 요구사항 v5](https://claude.ai/artifact/5MXhH7BzDaatH5B78XYtEn).
> 삭제 상태 모델은 오너 결정(09-18): TargetSource 의 삭제 상태는 **정상 · 승인 대기 · 삭제 중** 셋뿐.
> 실패·취소됨은 pipeline 의 상태라서 저장하지 않고 그때 읽는다. 반려·철회·취소·삭제 완료는 요청의 결과라서 이력에만 남는다.
>
> 아래 API 는 전부 `docs/swagger/install-v1.yaml` 미수록이다 (계약 갭 **G9**). 필드 이름은 제안이다. 값의 수와 뜻만 고정한다.
> ⛔ FE 착수는 BE 의 요청·응답 샘플을 받은 뒤. swagger 손선언 금지. 호출 구조는 앱 표준 3-hop: CSR → `app/api/v1/**` route → `bff` client.

## 어디에 구현이 필요한가

| 층 | 할 일 | 지금 있는 것 |
|---|---|---|
| Orchestrator | 새 `PipelineType`(제안 `TARGET_SOURCE_DELETE`) + CSP 별 Recipe. 기존 destroy Task 재사용 → 기존 `DELETE_CONFIRMED_RESOURCES_V1` → 새 HTTP Task 「삭제 확정」(BFF 호출). `enabled-operations` 등록. 일반 생성·CUSTOM·task catalog 에서 새 type 제외 | `*_DELETE_V1`(destroy 만) · `DELETE_CONFIRMED_RESOURCES_V1` · `pipelines/latest?type=` · restart · cancel |
| BFF | 삭제 요청 도메인(요청 · 이력 · 승인 시점 스냅샷). 승인 = 검증 + 스냅샷 + 잠금 + Orchestrator `POST /pipelines` 한 동작. 취소 = 요청 닫기(+ 실행 중이면 Orchestrator cancel). 재시작 = 사유 기록 + Orchestrator restart. 목록 · 상세 · Excel. TargetSource 응답에 삭제 필드. 409 코드 3종. 권한 검사. 「삭제 확정」 수신 endpoint | 연동 승인 요청 API(`approval-requests/*`) 가 형태의 전례 |
| FE | 아래 API 소비. 화면 4곳(큐 「삭제 요청」 · 삭제 요청 상세 · ops TargetSource 상세 · 서비스 화면) | RunLine · 승인/반려 모달 · 사유 textarea(초기화) · ID 타이핑 확인 모달 |

이벤트 · 워커 · 주기 폴링은 필요 없다.

- 가는 길: 승인 핸들러가 Orchestrator `POST /target-sources/{id}/pipelines {type}` 를 직접 부른다. 승인 트랜잭션 안이다. 생성이 실패하면 승인도 실패다.
- 오는 길: Recipe 의 마지막 Task 「삭제 확정」이 HTTP_REQUEST 로 BFF 를 부른다. BFF 는 TargetSource 를 제거하고 요청을 「삭제 완료」로 닫는다. Slack 종단 알림은 업무 콜백으로 쓰지 않는다(ADR-023).
- 실패 · 취소됨: 저장하지 않는다. BFF 가 응답을 만들 때 Orchestrator `pipelines/latest?type=TARGET_SOURCE_DELETE` 를 읽어 `run` 에 실어 준다.

## 공통

| 항목 | 값 |
|---|---|
| 경로 prefix | `/install/v1` |
| 권한 | 서버가 검사한다. FE 는 버튼만 숨긴다 |
| 에러 | `ErrorMessage` 를 상태코드 그대로 중계(ADR-008). 구분은 `code` 로 한다 |
| 날짜 | date-time, 오프셋 포함. FE 는 UTC 보정하지 않는다 |
| 페이지 | `page` 0-index · `size` 기본 20, 최대 100 · 건수는 `totalElements` |
| 행위자 | `Actor = { user_id, display_name }`. `display_name` 은 당시 이름의 스냅샷. 기존 `ActorDto` 는 `user_id` 뿐이라 확장이 필요하다 |
| 메시지 길이 | 요청 · 반려 · 취소 · 재시작 사유 필수, 최대 1000자(연동 초기화와 같은 규격). 승인 메시지 선택, 최대 1024자 ← 결정 3 |

### enum

| 이름 | 값 | 어디에 |
|---|---|---|
| `deletion_status` | `NONE` 정상 · `PENDING_APPROVAL` 승인 대기 · `DELETING` 삭제 중 | TargetSource 응답 (별도 필드. ⛔ `process_status` 에 값을 더하지 않는다 — FE 가 모르는 값을 1단계로 그린다) |
| `DeletionRequest.status` | `PENDING` 승인 대기 · `DELETING` 삭제 중 · `REJECTED` 반려 · `WITHDRAWN` 철회 · `CANCELLED` 취소 · `DELETED` 삭제 완료 | 삭제 요청 |
| `run.status` | Orchestrator 의 `PENDING` `RUNNING` `DONE` `FAILED` `CANCELLED` 그대로 | 요청 응답의 `run` (요청이 `DELETING` 일 때만) |
| `event.type` | `REQUESTED` `WITHDRAWN` `APPROVED` `REJECTED` `RESTARTED` `CANCELLED` `DELETED` | 이력. 사람의 행위와 삭제 확정만 저장한다. 실행의 시작 · 실패 · 중단은 `run` 으로 본다 |

## API 목록

| # | 메서드 · 경로 | 누가 | 화면 |
|---|---|---|---|
| 1 | `POST /target-sources/{targetSourceId}/deletion-requests` | 서비스 사용자(자기 서비스) · 관리자 | ④ 행 메뉴 「Target Source 삭제」 · ③ 「연동 초기화」 탭 카드 |
| 2 | `POST /target-sources/{targetSourceId}/deletion-requests/{requestId}/withdraw` | 요청자 본인 | ④ 알림 상자 · ② 상세 |
| 3 | `POST /target-sources/{targetSourceId}/deletion-requests/{requestId}/approve` | 관리자(요청자 제외 ← 결정 2) | ② 상세 |
| 4 | `POST /target-sources/{targetSourceId}/deletion-requests/{requestId}/reject` | 관리자 | ② 상세 |
| 5 | `POST /target-sources/{targetSourceId}/deletion-requests/{requestId}/cancel` | 관리자 | ② 상세 |
| 6 | `POST /target-sources/{targetSourceId}/deletion-requests/{requestId}/restart` | 관리자 | ② 상세 |
| 7 | `GET /admin/target-sources/deletion-requests` (+ `Accept: text/csv`) | 관리자 | ① 목록 세 뷰 · Excel · nav 배지 |
| 8 | `GET /admin/target-sources/deletion-requests/{requestId}` | 관리자 ← 결정 7 | ② 상세 |
| 9 | 기존 TargetSource 응답 확장: 목록 행 `deletion_status` · 상세 `latest_deletion_request` | 기존 권한 | ③ 헤더 태그 · 알림 상자 · ④ 목록 태그 · 알림 상자 · 반려 사유 |

nav 배지(승인 대기 건수)는 #7 `status=PENDING&size=1` 의 `totalElements` 로 센다. 건수 API 를 따로 두지 않는다.

### 1. 요청 생성

`POST /target-sources/{targetSourceId}/deletion-requests`

```json
{ "message": "서비스를 9월 말에 종료합니다. AWS 계정도 해지할 예정입니다." }
```

- 201 → `DeletionRequestDetail`(아래 #8). `status = PENDING`, `snapshot = null`.
- 요청을 만들 때 정체 항목(서비스 코드 · 서비스 이름 · Cloud · 계정 식별자)을 요청 행에 함께 적는다. TargetSource 가 없어진 뒤에도 목록을 그리기 위해서다.
- 승인 대기 중에는 TargetSource 를 잠그지 않는다. `deletion_status = PENDING_APPROVAL` 표시만 한다.

| 코드 | 상태 | 뜻 |
|---|---|---|
| `DELETION_REQUEST_ALREADY_OPEN` | 409 | 열린 요청이 이미 있다. TargetSource 마다 하나 |
| `DELETION_NOT_SUPPORTED` | 400 | v1 범위 밖(SDU · 수동 설치 ← 결정 4). `message` 가 사유. FE 는 버튼을 잠그고 사유를 보여준다 |

### 2. 철회 · 4. 반려 · 5. 취소 · 6. 재시작

본문은 넷 다 같다. 철회만 본문이 없다.

```json
{ "reason": "…" }
```

| # | 전제 상태 | 결과 | 비고 |
|---|---|---|---|
| 2 철회 | `PENDING` | `WITHDRAWN` · TargetSource `NONE` | 요청자 본인만. 관리자도 남의 요청은 철회가 아니라 반려로 처리한다 |
| 4 반려 | `PENDING` | `REJECTED` · TargetSource `NONE` | `reason` 필수 |
| 5 취소 | `DELETING` | `CANCELLED` · TargetSource `NONE` | `reason` 필수. `run.status` 가 `PENDING`·`RUNNING` 이면 Orchestrator cancel 도 부른다. 철거된 인프라는 돌아오지 않는다. 다시 지우려면 새 요청 ← 결정 1 |
| 6 재시작 | `DELETING` 이고 `run.status ∈ {FAILED, CANCELLED}` | `DELETING` 유지 · 새 `pipeline_id` 가 `pipeline_ids` 에 더해진다 | `reason` 필수. Orchestrator restart 를 부른다. 응답에 새 `pipeline_id` |

- 200 → `DeletionRequestDetail`.
- 409 `DELETION_REQUEST_ALREADY_PROCESSED`: 전제 상태가 아니다(두 관리자가 동시에 처리). FE 는 다시 조회한다.
- 409 `ORCHESTRATION_PIPELINE_ALREADY_ACTIVE`(재시작): 실행이 아직 돌고 있다.

### 3. 승인

`POST /target-sources/{targetSourceId}/deletion-requests/{requestId}/approve`

```json
{ "comment": "서비스 종료 공지를 확인했습니다." }
```

- `comment` 는 선택 ← 결정 3. 비어 있으면 화면은 「메시지 없음」.
- 서버 동작 하나로 끝낸다: 검증 → 대상 스냅샷 저장 → 잠금 → Orchestrator `POST /target-sources/{id}/pipelines { "type": "TARGET_SOURCE_DELETE" }`. 파이프라인 생성이 실패하면 승인도 성립하지 않는다.
- 200 → `DeletionRequestDetail`. `status = DELETING`, `snapshot` 채워짐, `pipeline_ids = [새 id]`, `run.status = PENDING`(시작 대기 15초).
- FE 확인은 TargetSource ID 타이핑(확정 정보 삭제 모달과 같은 방식). 승인 화면은 요청 시점이 아니라 **현재** 상태를 보여준다(단계 · 설치 방식 · 확정 리소스 건수 · 진행 중인 작업) — 기존 TargetSource 상세로 충분하다.

| 코드 | 상태 | 뜻 |
|---|---|---|
| `SELF_APPROVAL_FORBIDDEN` | 403 | 요청자와 승인자가 같다 ← 결정 2 |
| `DELETION_REQUEST_ALREADY_PROCESSED` | 409 | 이미 처리된 요청 |
| `ORCHESTRATION_PIPELINE_ALREADY_ACTIVE` | 409 | 다른 파이프라인이 돌고 있다. 자동 취소하지 않는다 ← 결정 8. 문구는 「진행 중인 작업이 끝나야 실행할 수 있습니다」 |
| `OPERATION_UNAVAILABLE` | 400 | Orchestrator `enabled-operations` 미등록(중계) |

### 7. 목록 · Excel

`GET /admin/target-sources/deletion-requests`

| Query | 타입 | 기본 | 뜻 |
|---|---|---|---|
| `status` | `DeletionRequest.status`, 콤마 구분 | 전체 | 뷰: 승인 대기 `PENDING` · 삭제 중 `DELETING` · 전체 이력 생략 |
| `from` · `to` | `YYYY-MM-DD` 포함 | 최근 7일 | 요청 일시 기준. `from > to` 는 400. 「연동 시점」과 같은 빠른 기간(7 · 14 · 21 · 30) |
| `q` | string | – | 서비스 코드 · 계정 · TargetSource ID · 요청 ID 를 한 칸으로 검색 |
| `page` · `size` | int | `0` · `20` | 정렬은 없다. 순서는 요청 일시 최신순 고정 |

200 → `PageDeletionRequestRow`

```json
{
  "content": [{
    "request_id": 45,
    "status": "DELETING",
    "target_source_id": 1042,
    "service_code": "REC-014",
    "service_name": "추천 엔진",
    "cloud_provider": "GCP",
    "account_id": "rec-prod-317",
    "requested_by": { "user_id": "park.jihun", "display_name": "박지훈" },
    "requested_at": "2026-09-15T10:20:00+09:00",
    "run": { "pipeline_id": 318, "status": "FAILED" }
  }],
  "totalElements": 4, "totalPages": 1, "number": 0, "size": 20, "first": true, "last": true
}
```

| 필드 | 규칙 |
|---|---|
| `service_code` · `service_name` · `cloud_provider` · `account_id` | 요청 시점에 요청 행에 적은 값. TargetSource 가 없어진 뒤에도 그대로 나온다 |
| `account_id` | Cloud 별 계정 식별자 하나를 BE 가 고른다. AWS account · GCP project · Azure subscription. IDC · SDU 는 `null` → 화면 「계정 없음」 |
| `run` | `status = DELETING` 인 행에만. BFF 가 Orchestrator 에서 그때 읽는다. 저장하지 않는다. 화면은 「삭제 중」 옆 둘째 태그(진행 중 · 실패 · 취소됨) |

Excel: 같은 경로, `Accept: text/csv`. `page` · `size` 무시. 열 순서 `request_id, status, target_source_id, service_code, service_name, cloud_provider, account_id, requested_by, requested_at, processed_by, processed_at, deleted_at`. 「연동 시점」 CSV 와 같은 방식.

### 8. 상세

`GET /admin/target-sources/deletion-requests/{requestId}` → `DeletionRequestDetail`

```json
{
  "request_id": 42,
  "status": "DELETED",
  "target_source_id": 1042,
  "service_code": "PAY-001",
  "service_name": "결제 플랫폼",
  "cloud_provider": "AWS",
  "account_id": "123456789012",
  "events": [
    { "type": "REQUESTED", "at": "2026-09-10T14:02:00+09:00", "actor": { "user_id": "kim.minsu", "display_name": "김민수" }, "message": "서비스를 9월 말에 종료합니다. AWS 계정도 해지할 예정입니다." },
    { "type": "APPROVED",  "at": "2026-09-10T14:40:00+09:00", "actor": { "user_id": "lee.seoyeon", "display_name": "이서연" }, "message": "서비스 종료 공지를 확인했습니다.", "pipeline_id": 318 },
    { "type": "DELETED",   "at": "2026-09-10T15:31:00+09:00", "actor": null, "message": null, "pipeline_id": 318 }
  ],
  "snapshot": {
    "taken_at": "2026-09-10T14:40:00+09:00",
    "description": "결제 정산 배치 DB",
    "aws_account_id": "123456789012", "gcp_project_id": null, "azure_tenant_id": null, "azure_subscription_id": null,
    "is_sdu_type": false, "is_china_region": false,
    "process_status": "COMPLETED", "install_method": "AUTO",
    "created_at": "2026-03-02T09:00:00+09:00", "pii_agent_first_installed_at": "2026-03-19T16:40:00+09:00",
    "service_side": { "scan_role_arn": "arn:aws:iam::123456789012:role/pii-scan", "terraform_execution_role_arn": "arn:aws:iam::123456789012:role/pii-tf" },
    "confirmed_resources": [
      { "resource_name": "pay-main-db", "resource_id": "db-7f2a91", "database_type": "Aurora MySQL", "host": null, "port": null }
    ]
  },
  "pipeline_ids": [318],
  "run": null
}
```

| 필드 | 규칙 |
|---|---|
| `events` | 시간순. 더할 수만 있다. `message` 는 행위마다 제 칸(요청 · 승인 · 반려 · 취소 · 재시작). `DELETED` 는 「삭제 확정」 Task 가 만든다 |
| `snapshot` | 승인 시점 한 벌. 승인 전 · 반려 · 철회는 `null`. 저장 뒤 바뀌지 않는다. 항목은 요구사항 「무엇을 어디에 담나」 표 ← 결정 5 |
| `snapshot.confirmed_resources` | 클라우드 = `resource_name` · `resource_id` · `database_type`. IDC = `host` · `port`. 변경 이력이 아니라 승인 당시 목록 |
| `snapshot.service_side` | 삭제 뒤 서비스가 직접 지울 것. Cloud 별로 키가 다르다(Azure PE · GCP PSC subnet · IDC 방화벽은 식별자 없이 안내만) |
| `pipeline_ids` | 실행 전부. 재시작마다 하나 더. 로그는 Orchestrator 에 있고 FE 는 `/admin/pipelines/{id}` 로 링크만 건다 |
| `run` | `status = DELETING` 일 때만 마지막 `pipeline_id` 의 현재 상태: `{ pipeline_id, status, done_task_count, total_task_count, failed_task_name, error_code }`. 그때 읽는다 |

실행 줄(RunLine)은 `run` 으로 그린다. 상태별 버튼:

| 상태 | 버튼 |
|---|---|
| `PENDING` | 관리자 「승인」 「반려」 · 요청자 「요청 철회」 |
| `DELETING` + `run.status` `PENDING`·`RUNNING` | 「삭제 취소」 |
| `DELETING` + `run.status` `FAILED`·`CANCELLED` | 「재시작」 「삭제 취소」 |
| 그 밖 | 없음 |

### 9. 기존 TargetSource 응답 확장

TargetSource 를 돌려주는 목록 행(서비스 목록 · ops 목록 · 큐 행)에 `deletion_status` 를 더한다. 상세에는 `latest_deletion_request` 를 더한다.

```json
{
  "deletion_status": "PENDING_APPROVAL",
  "latest_deletion_request": {
    "request_id": 46, "status": "PENDING",
    "requested_by": { "user_id": "choi.yujin", "display_name": "최유진" }, "requested_at": "2026-09-17T17:45:00+09:00",
    "message": "…",
    "processed_by": null, "processed_at": null, "reason": null
  }
}
```

- `latest_deletion_request` 는 마지막 요청 하나. 상태를 가리지 않는다. FE 규칙: `PENDING`·`DELETING` 이면 알림 상자(누가 · 언제 · 무슨 말로), `REJECTED` 면 반려 사유 상자(같은 자리), 나머지는 안 그린다.
- 삭제된 TargetSource 는 모든 일반 목록 · 조회 · 알림 · 큐 · 「연동 시점」에서 빠진다 ← 결정 6. 직접 URL 로 오면 404. 파이프라인 상세의 대상 링크는 삭제 요청 상세를 가리켜야 한다.
- 「삭제 중」에는 변경 동작(스캔 · 연동 요청 · 확정 편집 · 설치 · 재확정 · 연결 테스트 · 초기화)이 409 다. FE 는 `deletion_status = DELETING` 이면 버튼을 잠그고 사유를 보여준다.

## FE 가 부르지 않지만 있어야 하는 것

- `POST /internal/target-sources/{targetSourceId}/deletion-requests/{requestId}/confirm` — Orchestrator 「삭제 확정」 Task 가 부른다. 멱등이어야 한다(재시도 · 재시작). TargetSource 제거 + `DELETED` 이벤트 + 요청 `DELETED`. 경로 · 인증은 ADR-023 결정 8 의 HTTP Task 규칙을 따른다.
- Orchestrator 새 type · Recipe · `enabled-operations` · Slack payload `type` 값 추가.
- 설치 전 TargetSource(인프라 없음)에서 destroy 가 성공으로 끝나는지 InfraManager 확인. 안 되면 destroy 없는 경로가 따로 필요하다.

## FE 3-hop 배선(착수 시)

| 항목 | 값 |
|---|---|
| route | `app/api/v1/target-sources/[id]/deletion-requests/**` (1~6) · `app/api/v1/admin/queue/deletion-requests/**` (7~8) |
| bff | `BffClient` 에 `deletion` 그룹. mock `lib/bff/mock/deletion.ts` |
| wire | `lib/types/deletion.ts` 가 단일 교정점(G8 과 같은 방식). BE 드롭이 오면 generated 타입으로 교체 |
| 에러 | `lib/errors.ts` 가 409 를 `CONFLICT` 하나로 접는다. 위 `code` 3종을 구분해 문구를 고르려면 여기부터 넓혀야 한다 |

## 결정 대기 (착수 전)

| 결정 | 이 문서에서 걸린 곳 |
|---|---|
| 1 취소 뒤 정상 복귀 · 유예 없음 | #5 · `deletion_status` 셋 |
| 2 자기 승인 금지 | #3 `SELF_APPROVAL_FORBIDDEN` |
| 3 승인 메시지 선택 | #3 `comment` |
| 4 수동 설치 · SDU 범위 | #1 `DELETION_NOT_SUPPORTED` |
| 5 확정 리소스 식별 목록 보관 | #8 `snapshot.confirmed_resources` |
| 6 「연동 시점」에서 제외 | #9 |
| 7 무기한 보존 · 관리자만 열람 | #7 · #8 권한 |
| 8 충돌 시 승인 차단 | #3 `ORCHESTRATION_PIPELINE_ALREADY_ACTIVE` |
