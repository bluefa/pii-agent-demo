# 파이프라인 오케스트레이션 — BFF API (러프 초안)

> [ADR-016 설치/삭제 파이프라인 오케스트레이션 아키텍처](../docs/adr/016-installation-pipeline-architecture.md)가
> 요구하는 admin/operator API 표면. **swagger가 아니라** 대략적인 path + response 정리다 —
> 최종 정본·스키마는 추후 `docs/swagger/admin-pipelines.yaml`로 옮긴다.
>
> **Path 포맷**은 기존 BFF 관례를 그대로 따른다:
> - admin = `/admin/...` (기존 `/admin/dashboard/...`, `/admin/guides/{name}` 와 동일 계열)
> - 고객/시스템 트리거 = `/integration/api/v1/...` (기존 통합 API)
> - 목록은 Spring Pageable(`page`·`size`·`sort`), 필드·키는 **camelCase**, 인증·공통 에러는 기존 규약 따름(생략).

---

## 0. 데이터 모델 요약 (응답 빌딩블록)

ADR-016 결정 1.2 모델을 camelCase로. (DB는 snake_case, API는 camelCase 변환.)

- **PipelineSummary** — `{ id, type(INSTALL|DELETE), provider(AWS|AZURE|GCP|IDC|SDU), targetSourceId, status(RUNNING|CANCELLING|DONE|FAILED|CANCELLED), progress{ done, total }, startedAt, lastActivityAt, triggeredBy }`
- **Pipeline** — `PipelineSummary` + `{ parameters{}, createdAt, finishedAt, failReason, tasks:[Task] }`
- **Task** — `{ id, seq, name, type(EXECUTE|WAIT_EXTERNAL), status(BLOCKED|READY|WAITING_SLOT|DISPATCHING|RUNNING|WAITING_EXTERNAL|DONE|FAILED|EXPIRED|CANCELLED), dependsOn:[taskId], failCount, maxFailCount, latestCheck:Check? }`
- **Attempt** — `{ id, taskId, response{}, startedAt, finishedAt, outcome(SUCCEEDED|FAILED|EXECUTION_TIMEOUT|WORKER_OUTAGE) }`  ← `response`는 dispatch 원응답(handle 1/N/0개 흡수)
- **Check** — `{ id, taskId, kind(DISPATCH|CHECK|POST_CHECK|FORCE_CHECK), apiResult(PENDING|OK|ERROR), observed(RUNNING|SUCCEEDED|FAILED|MET|NOT_MET), externalHandle, checkedAt, latencyMs }`
- **PipelineEvent** — `{ id, pipelineId, taskId?, type, severity(INFO|CRITICAL), message, actor, createdAt }`

---

## 1. 보드 / 조회 (read-only)

### `GET /admin/pipelines` — 보드 목록
- query: `status`, `type`, `provider`, `targetSourceId`, `page`, `size`, `sort`(기본 `lastActivityAt,desc`)
- `200` → `{ content: [PipelineSummary], totalElements, totalPages, number, size }`

### `GET /admin/pipelines/{pipelineId}` — 파이프라인 상세 (보드 → 드릴다운)
- `200` → `Pipeline` (`tasks[]` 포함)

### `GET /admin/pipelines/{pipelineId}/tasks/{taskId}` — task 타임라인
- 한 task의 attempt·check 머지 타임라인 (O5 "Terraform Job 상세 단계" 드릴다운).
- `200` → `{ task: Task, attempts: [Attempt], checks: [Check] }`

### `GET /admin/pipelines/{pipelineId}/events` — 이벤트 / 감사 로그
- query: `severity`, `page`, `size`
- `200` → `{ content: [PipelineEvent], totalElements, ... }`

> 고객 상세 화면 연동: `GET /integration/api/v1/target-sources/{targetSourceId}/pipelines/latest`
> — §4.3.2 "파이프라인 보드에서 보기" 링크용 최신 파이프라인 1건 (`200` → `PipelineSummary`).

---

## 2. 제어 (control)

### `POST /admin/pipelines/{pipelineId}/cancel` — 취소
- 파이프라인을 `CANCELLING`으로. forward edge만 gate, in-flight job은 drain(결정 4c).
- `200` → `{ id, status: "CANCELLING" }`

### `POST /admin/pipelines/{pipelineId}/retry` — 재시도 = **새 run 생성**
- 재개가 아니라 새 run 생성(결정 5). 완료분은 terraform 수렴으로 사실상 no-op.
- `200` → `{ newPipelineId }`

### `POST /admin/pipelines/{pipelineId}/tasks/{taskId}/force-check` — 수동 강제 확인
- `FORCE_CHECK` 1회 발사(관측 전용, 상태 무영향). trigger actor 기록.
- `202` → `{ checkId, apiResult: "PENDING" }`

### `POST /admin/pipelines/{pipelineId}/pause` · `POST .../resume` — 수동 강제 중지/재개 (감사 비상구)
- dispatch admission만 gate; 파이프라인 상태는 `RUNNING` 유지(결정 4d). 감사 이벤트 기록.
- `200` → `{ id, dispatchPaused: true | false }`

---

## 3. 트리거 (생성)

생성은 **고객/시스템 흐름이 트리거**하고 admin은 관측·제어만 한다(`triggeredBy` 기록). 신규 admin 생성 API는 두지 않는다.

- **설치 트리거** — 기존 `POST /integration/api/v1/target-sources/{targetSourceId}/pii-agent-installation/confirm` 가 내부적으로 `INSTALL` 파이프라인을 시작(CONFIRMED → 파이프라인).
- **삭제 트리거** — `POST /integration/api/v1/target-sources/{targetSourceId}/pii-agent-installation/delete` (또는 동등) → `DELETE` 파이프라인 생성. *기존 삭제 흐름과 path 합의 필요.*

---

## 4. 설정 (R5 — "설정은 데이터다", ADR Part II)

### `GET /admin/pipelines/settings`
- `200` → 런타임 config 단일 객체:
```
{
  tickIntervalSec, perCallDeadlineSec, postCheckDeadlineSec,
  dispatchRecoveryTimeoutMin, executionTimeoutMin,
  waitExternalTtlDays, waitExternalPollingGuardMin, jobPollCadenceSec,
  slotCap,        // N — 동시 slot 보유 task soft target
  callBudget,     // C — 동시 in-flight 외부 호출 상한
  maxFailCount,
  breakerProbeIntervalMin, taskCheckRetentionDays, queueWaitAlertMin,
  notificationRouting: [ { event, channel } ]
}
```

### `PUT /admin/pipelines/settings`
- body: 위 객체(부분 갱신 허용). 변경은 `pipeline_event`로 감사, 재배포 불필요(R5).
- `200` → 갱신된 settings.

---

## 5. (선택) worker / breaker 현황

### `GET /admin/pipelines/breaker` — circuit breaker 상태 + 동시성 사용량
- `200` → `{ state(CLOSED|OPEN|HALF_OPEN), since, lastOutageAt, slotsInUse, slotCap, inFlightCalls, callBudget }`
- 용도: 보드의 "worker outage" 배지, N(slot)·C(call) 사용량 게이지.

---

## 메모 / 미확정

- **생성(트리거) path**는 기존 install/delete 흐름과 합의 필요 — 본 문서는 admin **관측·제어** 표면에 집중.
- force-check의 actor 표현은 ADR Open **O18**, `observed` 어휘 통일은 **O19**, DISPATCH 행 vs attempt 노출은 **O20** 에 종속(확정 후 응답 필드 조정).
- 본 초안 확정 후 `docs/swagger/admin-pipelines.yaml` 로 스키마화한다.
