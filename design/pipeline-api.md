# 설치/삭제 파이프라인 — Admin API 정의 (개략 스키마)

> 상태: **Draft** (2026-06-12)
> 관련 문서: `docs/adr/016-install-pipeline-orchestration.md`, `design/pipeline-interfaces.md` (구현 인터페이스 — §6의 API 목록은 본 문서가 canonical), `design/admin-page-requirements.md` §5
> 목적: 파이프라인 Admin API의 **전체 목록**과 **개략적 요청/응답 스키마**를 정의한다.
> 추후 `docs/swagger/admin-pipelines.yaml` 작성의 원본이 된다. 필드 수준의 엄밀한 계약은 swagger 단계에서 확정.

---

## 0. 공통 규약

| 항목 | 규약 |
|------|------|
| Base path | `/admin` (관리자 콘솔 전용 — RBAC: admin role) |
| Actor | 모든 쓰기 요청은 인증 주체에서 actor(`HUMAN`/`AI`)를 도출해 이벤트에 기록 (R-AI3). 별도 요청 필드 없음 |
| 시각 | ISO-8601 UTC (`2026-06-12T04:31:00Z`). 표시 변환은 클라이언트 책임 |
| 기간/주기 | ISO-8601 Duration (`PT10M`, `PT30S`, `P7D`) |
| Pagination | cursor 방식: 요청 `?cursor=&limit=`(기본 20, 최대 100) → 응답 `{ "items": [...], "nextCursor": "..." \| null }` |
| 쓰기 의미론 | 제어 API는 **의도 기록 후 202** — 실제 실행은 reconciler tick (≤30초 내). 응답은 "수락 여부"지 "완료 여부"가 아님 |
| 멱등성 | cancel·read 등 상태 전이 요청은 멱등 — 재호출 시 현재 결과를 그대로 반환 |
| 에러 envelope | `{ "error": { "code": "...", "message": "사용자 표시용 한국어", "details": { } } }` — code 일람은 §6 |

### Enum 사전

```
PipelineType    INSTALL | DELETE
PipelineStatus  QUEUED | RUNNING | CANCELLING | DONE | FAILED | CANCELLED
TaskKind        EXECUTE | WAIT_EXTERNAL
TaskStatus      BLOCKED | READY | WAITING_SLOT | DISPATCHING | RUNNING
                | WAITING_EXTERNAL | DONE | FAILED | EXPIRED | CANCELLED
  └ uiStatus 매핑: BLOCKED/READY/WAITING_SLOT→"대기", DISPATCHING/RUNNING→"실행 중",
                   WAITING_EXTERNAL→"외부 대기", DONE→"완료", FAILED→"실패",
                   EXPIRED→"타임아웃", CANCELLED→"중단"
CheckKind       JOB_POLL | CONDITION_CHECK | POST_CHECK
ApiResult       OK | ERROR
Observed        RUNNING | SUCCEEDED | FAILED | MET | NOT_MET
ErrorCode       TRANSIENT_INFRA | AUTH | QUOTA | TF_ERROR | CALL_TIMEOUT
                | EXECUTION_TIMEOUT | WORKER_OUTAGE | EXTERNAL_NOT_READY | UNKNOWN
BreakerState    CLOSED | OPEN | HALF_OPEN
CancelOutcome   CANCELLED_IMMEDIATE | CANCELLING_DRAINING | ALREADY_TERMINAL
EventSeverity   INFO | WARNING | CRITICAL
```

---

## 1. API 한눈에 보기

| # | 그룹 | Method | Path | 한 줄 설명 |
|---|------|--------|------|-----------|
| 1 | 실행/제어 | POST | `/admin/target-sources/{targetSourceId}/pipelines` | 설치/삭제 Pipeline 생성 |
| 2 | 실행/제어 | POST | `/admin/pipelines/{pipelineId}/cancel` | 취소 요청 (비동기 드레인) |
| 3 | 실행/제어 | POST | `/admin/pipelines/{pipelineId}/retry` | FAILED Pipeline 재시도 |
| 4 | 실행/제어 | PATCH | `/admin/pipelines/{pipelineId}/tasks/{taskId}` | Task 정책 수정 (확인주기/TTL/max_fail_count) |
| 5 | 실행/제어 | POST | `/admin/pipelines/{pipelineId}/tasks/{taskId}/force-check` | [지금 확인] 즉시 관측 |
| 6 | 조회 | GET | `/admin/pipelines` | 보드 + 이력 통합 검색 (기간 overlap) |
| 7 | 조회 | GET | `/admin/pipelines/{pipelineId}` | Pipeline 상세 (task 목록 포함) |
| 8 | 조회 | GET | `/admin/pipelines/{pipelineId}/tasks/{taskId}/history` | Task attempt+check 병합 타임라인 |
| 9 | 조회 | GET | `/admin/pipelines/{pipelineId}/tasks/{taskId}/terraform-job` | TerraformJob 내부 task 미러 |
| 10 | 조회 | GET | `/admin/target-sources/{targetSourceId}/pipelines` | Target 1개의 실행 이력 + 최근 실행 요약 |
| 11 | 시스템 | GET | `/admin/pipeline-system/queue` | TF 슬롯/대기열/드레인/브레이커 현황 |
| 12 | 시스템 | POST | `/admin/pipeline-system/dispatch/pause` · `/resume` | 디스패치 수동 중지/재개 (escape hatch) |
| 13 | 시스템 | GET | `/admin/pipeline-system/settings` | 런타임 설정 조회 |
| 14 | 시스템 | PUT | `/admin/pipeline-system/settings` | 런타임 설정 수정 (감사 이벤트) |
| 15 | 알림 | GET | `/admin/notifications` | 알림센터 목록 |
| 16 | 알림 | POST | `/admin/notifications/read` | 읽음 처리 (일괄) |

---

## 2. 공통 리소스 스키마

### 2.1 PipelineSummary — 목록 행 (#6, #10 응답 item)

```jsonc
{
  "pipelineId": 311,
  "targetSourceId": "ts-aws-001",
  "serviceCode": "svc-alpha",
  "provider": "AWS",                      // AWS | AZURE | GCP | IDC | SDU
  "type": "INSTALL",
  "status": "RUNNING",                    // PipelineStatus
  "progress": { "done": 2, "total": 4 },
  "currentTask": {                        // 진행 중일 때만, 종결 상태면 null
    "taskId": 9123,
    "seq": 3,
    "name": "BDC Common TF",
    "status": "RUNNING",
    "uiStatus": "실행 중",
    "queuePosition": null,                // WAITING_SLOT일 때만 1-base 순번
    "nextCheckAt": null                   // WAITING_EXTERNAL/RUNNING일 때 다음 관측 시각
  },
  "triggeredBy": { "actor": "HUMAN", "id": "admin-kim" },
  "createdAt": "2026-06-12T04:10:00Z",
  "startedAt": "2026-06-12T04:10:30Z",
  "finishedAt": null,
  "failReason": null                      // FAILED일 때 { "errorCode": "...", "taskName": "...", "message": "..." }
}
```

### 2.2 TaskDetail — Pipeline 상세의 task 항목 (#7 응답)

```jsonc
{
  "taskId": 9123,
  "seq": 3,
  "name": "BDC Common TF",
  "kind": "EXECUTE",                      // TaskKind
  "status": "RUNNING",                    // TaskStatus (내부 상태 그대로 노출)
  "uiStatus": "실행 중",
  "policy": {                             // PATCH(#4)로 수정 가능한 값들
    "pollingInterval": "PT10M",           // WAIT_EXTERNAL 확인주기 (≥PT10M)
    "ttl": "P7D",                         // WAIT_EXTERNAL 최대 체류시간
    "maxFailCount": 1,                    // null = ∞ (확인성 task)
    "executionTimeout": "PT30M"           // EXECUTE 한정 (시스템 기본값, 참조용)
  },
  "failCount": 0,
  "externalJobId": "tfj-7f2",             // 없으면 null
  "queuePosition": null,
  "nextCheckAt": "2026-06-12T04:32:00Z",
  "deadlineAt": "2026-06-12T04:42:40Z",   // execution_timeout 또는 TTL 만료 시각
  "startedAt": "2026-06-12T04:12:40Z",
  "finishedAt": null,
  "postChecks": [                          // 정의된 post-check와 실행 결과 요약 (D3)
    { "name": "terraform-log", "ran": false, "apiResult": null, "detailRef": null }
  ]
}
```

### 2.3 TaskHistoryEntry — 병합 타임라인 항목 (#8 응답 item)

attempt(실행 시도)·check(관측 1회)·event(상태 전이)를 시간순 단일 스트림으로 내린다.
**이슈 조사 표면** — "execution이 성공했는지"와 "확인 API 호출 자체가 성공했는지"가 분리되어 보인다.

```jsonc
// entryType별로 셋 중 한 필드만 채워진다
{ "at": "2026-06-12T04:12:40Z", "entryType": "ATTEMPT",
  "attempt": { "attemptNo": 1, "result": "FAIL",            // OK | FAIL
               "errorCode": "EXECUTION_TIMEOUT", "errorDetail": "no terminal status in PT30M",
               "externalJobId": "tfj-7f2",
               "startedAt": "...", "finishedAt": "..." } }

{ "at": "2026-06-12T04:13:10Z", "entryType": "CHECK",
  "check": { "kind": "JOB_POLL",                            // CheckKind
             "name": null,                                  // POST_CHECK일 때 post-check 이름
             "apiResult": "OK",                             // 호출 자체의 성공 여부
             "observed": "RUNNING",                         // 호출이 보고한 내용
             "errorCode": null, "latencyMs": 182,
             "detail": null } }                             // POST_CHECK 성공 시 발췌/참조

{ "at": "2026-06-12T04:42:40Z", "entryType": "EVENT",
  "event": { "type": "TASK_FAILED", "severity": "CRITICAL",
             "actor": "SYSTEM", "reason": "max_fail_count exceeded" } }
```

---

## 3. 실행/제어 API

### #1 Pipeline 생성 — `POST /admin/target-sources/{targetSourceId}/pipelines`

```jsonc
// 요청
{ "type": "INSTALL" }                     // INSTALL | DELETE

// 201
{ "pipelineId": 311, "status": "QUEUED",
  "definitionVersion": "aws-auto-install@3",
  "tasks": [ { "taskId": 9121, "seq": 1, "name": "TF 권한 확인" }, ... ] }
```

| 에러 | 조건 |
|------|------|
| 409 `PIPELINE_ALREADY_ACTIVE` | 동일 target에 QUEUED/RUNNING/CANCELLING Pipeline 존재 (§4.4.4 중복 방지) |
| 409 `INSTALL_IN_PROGRESS` | 설치 진행 중 삭제 요청 (중단 후 삭제만 허용) |
| 422 `INVALID_PROCESS_STATUS` | process-status가 설치/삭제를 허용하지 않는 단계 |

### #2 취소 — `POST /admin/pipelines/{pipelineId}/cancel`

비동기·멱등. 의미론은 `design/pipeline-interfaces.md` §5 (forward 엣지 차단 + 드레인).

```jsonc
// 요청
{ "reason": "잘못된 대상으로 시작함" }      // 선택

// 202
{ "outcome": "CANCELLING_DRAINING",       // CancelOutcome
  "status": "CANCELLING",
  "drainingTask": {                       // CANCELLING_DRAINING일 때만
    "taskId": 9123, "name": "BDC Common TF",
    "terraformJobId": "tfj-7f2",
    "slotHeld": true,
    "executionDeadlineAt": "2026-06-12T04:42:40Z"   // 늦어도 이 시각엔 종결
  } }
```

### #3 재시도 — `POST /admin/pipelines/{pipelineId}/retry`

실패 task의 fail_count·타이머를 리셋하고 그 task부터 재개 (§4.4.4).

```jsonc
// 요청: body 없음
// 202
{ "status": "RUNNING", "resumedTask": { "taskId": 9123, "name": "BDC Common TF" } }
```

| 에러 | 조건 |
|------|------|
| 409 `PIPELINE_NOT_FAILED` | FAILED 상태가 아님 |

### #4 Task 정책 수정 — `PATCH /admin/pipelines/{pipelineId}/tasks/{taskId}`

```jsonc
// 요청 — 보내는 필드만 수정 (partial)
{ "pollingInterval": "PT30M", "ttl": "P14D", "maxFailCount": null }   // null = ∞

// 200 → 수정된 TaskDetail(§2.2) 반환
```

| 에러 | 조건 |
|------|------|
| 422 `POLLING_INTERVAL_TOO_SHORT` | PT10M 미만 (결정 #6 가드) |
| 409 `TASK_NOT_EDITABLE` | DONE/RUNNING/DISPATCHING task |

### #5 지금 확인 — `POST /admin/pipelines/{pipelineId}/tasks/{taskId}/force-check`

next_check_at을 now로 당긴다. 다음 tick(≤30초)에 1회 관측. rate-limit + 감사 기록 (D8).

```jsonc
// 요청: body 없음
// 202
{ "nextCheckAt": "2026-06-12T04:31:00Z" }
```

| 에러 | 조건 |
|------|------|
| 429 `FORCE_CHECK_RATE_LIMITED` | task당 1분 1회 초과 |
| 409 `TASK_NOT_CHECKABLE` | 관측 대기 상태(RUNNING/WAITING_EXTERNAL)가 아님 |

---

## 4. 조회 API

### #6 통합 검색 — `GET /admin/pipelines`

보드(진행 중)와 이력(기간 검색)을 하나의 endpoint로 처리한다 (D6).

| Query | 타입 | 설명 |
|-------|------|------|
| `targetSourceId` | string | target 필터 |
| `provider` | enum | AWS/AZURE/GCP/IDC/SDU |
| `type` | enum | INSTALL/DELETE |
| `status` | enum, 복수 | 예: `status=RUNNING&status=CANCELLING` |
| `from`, `to` | ISO-8601 | **overlap 의미론** — 기간 중 한 순간이라도 활성이었으면 매칭 |
| `cursor`, `limit` | — | 공통 규약 |

```jsonc
// 200
{ "items": [ PipelineSummary, ... ],      // §2.1
  "nextCursor": "eyJv...",
  "counts": { "running": 3, "waitingExternal": 2, "failed": 1, "doneLast7d": 12 } }  // 보드 요약 카드용
```

### #7 Pipeline 상세 — `GET /admin/pipelines/{pipelineId}`

```jsonc
// 200
{ ...PipelineSummary,                     // §2.1 전체 포함
  "definitionVersion": "aws-auto-install@3",
  "cancelRequest": null,                  // 있으면 { "requestedAt", "by", "reason" }
  "tasks": [ TaskDetail, ... ] }          // §2.2, seq 순
```

### #8 Task 타임라인 — `GET /admin/pipelines/{pipelineId}/tasks/{taskId}/history`

| Query | 설명 |
|-------|------|
| `entryType` | 필터 (복수): ATTEMPT/CHECK/EVENT |
| `cursor`, `limit` | 공통 규약 (기본 최신순) |

```jsonc
// 200
{ "items": [ TaskHistoryEntry, ... ], "nextCursor": null }   // §2.3
```

### #9 TerraformJob 미러 — `GET /admin/pipelines/{pipelineId}/tasks/{taskId}/terraform-job`

read-only 드릴다운 (D3). job이 없는 task면 404.

```jsonc
// 200
{ "terraformJobId": "tfj-7f2",
  "phase": "RUNNING",                     // QUEUED | RUNNING | SUCCEEDED | FAILED — QUEUED 구분은 O7
  "pickedUpAt": "2026-06-12T04:13:02Z",   // worker가 집어간 시각, 미지원 시 null (O7)
  "jobTasks": [                           // job 내부 task (명칭: O5 — UI 라벨 "Terraform Job 상세 단계")
    { "name": "plan",  "status": "SUCCEEDED", "startedAt": "...", "finishedAt": "..." },
    { "name": "apply", "status": "RUNNING",   "startedAt": "...", "finishedAt": null }
  ],
  "logRef": "tflog://jobs/tfj-7f2"        // post-check가 수집한 로그 참조, 없으면 null
}
```

### #10 Target 이력 — `GET /admin/target-sources/{targetSourceId}/pipelines`

TargetSource 상세 · 설치 관리 탭의 데이터 소스 (D8).

```jsonc
// 200
{ "summary": {                            // 비정규화 요약 (D6)
    "lastInstall": { "pipelineId": 311, "status": "DONE",   "finishedAt": "..." },
    "lastDelete":  null,
    "activePipelineId": null },
  "items": [ PipelineSummary, ... ],      // 전체 이력, 최신순
  "nextCursor": null }
```

---

## 5. 시스템 API

### #11 큐/시스템 현황 — `GET /admin/pipeline-system/queue`

슬롯 게이지·FIFO 대기열·취소 드레인·브레이커를 한 응답으로 (보드 헤더 + "TF Worker 요청 큐 조회").

```jsonc
// 200
{ "slots": { "used": 7, "limit": 10 },    // used에는 draining 포함 (interfaces §5.3)
  "breaker": {
    "state": "OPEN",                      // BreakerState
    "since": "2026-06-12T04:31:00Z",
    "signal": "PICKUP_TIMEOUT",           // PICKUP_TIMEOUT | CONSECUTIVE_EXECUTION_TIMEOUT | MANUAL
    "nextProbeAt": "2026-06-12T04:36:00Z",
    "waitingCount": 12 },
  "waiting": [                            // WAITING_SLOT, FIFO 순
    { "position": 1, "taskId": 9130, "pipelineId": 315,
      "targetSourceId": "ts-gcp-002", "taskName": "SVC TF",
      "waitingSince": "2026-06-12T04:25:11Z" } ],
  "draining": [                           // CANCELLING인데 job 실행 중 (취소 드레인)
    { "taskId": 9101, "pipelineId": 308, "terraformJobId": "tfj-6a1",
      "runningSince": "2026-06-12T04:12:40Z", "slotHeld": true,
      "executionDeadlineAt": "2026-06-12T04:42:40Z" } ] }
```

### #12 디스패치 수동 중지/재개 — `POST /admin/pipeline-system/dispatch/{pause|resume}`

브레이커 수동 개입 (escape hatch, D13). 기본 운영은 자동 — 감사 이벤트 필수.

```jsonc
// 요청
{ "reason": "Infra Manager 정기 점검" }
// 202
{ "breaker": { "state": "OPEN", "signal": "MANUAL", ... } }
```

### #13/#14 런타임 설정 — `GET | PUT /admin/pipeline-system/settings`

```jsonc
// GET 200 / PUT 요청 동일 형태 (PUT은 전체 교체, 검증 실패 시 422)
{ "maxConcurrentTerraformJobs": 10,       // ≥1
  "jobPollInterval": "PT30S",             // PT10S ~ PT5M (R3 — ≥10분 가드 비적용)
  "defaultExecutionTimeout": "PT30M",
  "httpCallDeadline": "PT30S",
  "postCheckDeadline": "PT60S",
  "dispatchRecoveryAge": "PT5M",
  "breakerPickupWindow": "PT5M",
  "breakerProbeInterval": "PT5M",
  "queueWaitAlertThreshold": "PT30M",
  "taskCheckRetention": "P90D" }
```

| 에러 | 조건 |
|------|------|
| 422 `SETTING_OUT_OF_RANGE` | 필드별 허용 범위 위반 — `details`에 필드명·허용 범위 |

### #15/#16 알림 — `GET /admin/notifications` · `POST /admin/notifications/read`

```jsonc
// GET ?unreadOnly=true&severity=CRITICAL&cursor=
{ "items": [
    { "notificationId": 5012,
      "type": "WORKER_OUTAGE_SUSPECTED",  // pipeline_event.type
      "severity": "CRITICAL",
      "message": "TF Worker 응답 없음 추정 — 신규 실행을 일시 중지했어요 (대기 12건)",
      "pipelineId": null,                 // 시스템 알림이면 null
      "taskId": null,
      "occurredAt": "2026-06-12T04:31:00Z",
      "read": false } ],
  "nextCursor": null,
  "unreadCount": 3 }                      // 벨 뱃지용

// POST /admin/notifications/read — 멱등
{ "ids": [5012, 5013] }                   // 202 { "unreadCount": 1 }
```

---

## 6. 에러 코드 일람

| HTTP | code | 발생 지점 |
|------|------|----------|
| 404 | `PIPELINE_NOT_FOUND` / `TASK_NOT_FOUND` / `JOB_NOT_FOUND` | 모든 경로 변수 |
| 409 | `PIPELINE_ALREADY_ACTIVE` | #1 — 동일 target 진행 중 |
| 409 | `INSTALL_IN_PROGRESS` | #1 — 설치 중 삭제 시도 |
| 409 | `PIPELINE_NOT_FAILED` | #3 |
| 409 | `TASK_NOT_EDITABLE` / `TASK_NOT_CHECKABLE` | #4 / #5 |
| 422 | `INVALID_PROCESS_STATUS` | #1 |
| 422 | `POLLING_INTERVAL_TOO_SHORT` | #4 — PT10M 가드 |
| 422 | `SETTING_OUT_OF_RANGE` | #14 |
| 429 | `FORCE_CHECK_RATE_LIMITED` | #5 |

> 5xx는 공통 인프라 규약을 따른다 (BFF 표준 에러 처리 — ADR-008 계열).
> cancel(#2)은 충돌 상황이 없다 — 어떤 상태에서 호출해도 `outcome`으로 결과를 알려주는 멱등 API다.

---

## 7. 화면 ↔ API 매핑 (참고)

| 화면 요소 (admin-page-requirements §4.4.5 / ADR D8) | API |
|---|---|
| 파이프라인 보드 요약 카드 + 목록 | #6 (`counts` + items) |
| 보드 이력 모드 (기간 + 필터) | #6 (`from`/`to`) |
| 행 클릭 → Task DAG 패널 | #7 |
| Task 패널 — attempt/check 로그, [지금 확인], 정책 ✎ | #8, #5, #4 |
| TerraformJob 드릴다운 | #9 |
| 슬롯 게이지 + 대기열 카드 + 브레이커 배너 | #11 |
| TargetSource 상세 · 설치 관리 탭 ([설치/삭제 시작], 이력) | #1, #10 |
| 알림센터 벨 | #15, #16 |
| 설정 페이지 | #13, #14 |
