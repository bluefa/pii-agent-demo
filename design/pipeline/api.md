# 파이프라인 오케스트레이션 — BFF API (러프 초안)

> [ADR-016 Install/Delete Pipeline Orchestration](../../docs/adr/ADR-016-install-delete-pipeline-orchestration.md)가
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
- **Pipeline** — `PipelineSummary` + `{ createdAt, finishedAt, failReason, tasks:[Task] }`
- **Task** — `{ id, seq, name, kind(TERRAFORM_JOB|GENERAL_JOB|CONDITION_CHECK), status(BLOCKED|READY|DISPATCHING|RUNNING|WAITING_EXTERNAL|DONE|FAILED|EXPIRED|CANCELLED), dependsOn:[taskId], failCount, maxFailCount, latestCheck:Check? }`
- **Attempt** — `{ id, taskId, response{}, errorCode, startedAt, finishedAt, outcome(SUCCEEDED|FAILED|EXECUTION_TIMEOUT) }`  ← `response`는 dispatch 원응답(TaskKind별 응답 형태 흡수 — TERRAFORM_JOB {jobId} · GENERAL_JOB {handle}, 단수 handle); `errorCode`는 dispatch 실패 사유
- **Check** — `{ id, taskId, kind(DISPATCH|CHECK|POST_CHECK), name, apiResult(PENDING|OK|ERROR), observed(RUNNING|SUCCEEDED|FAILED|MET|NOT_MET), errorCode, externalHandle, checkedAt, latencyMs, detail{} }`  ← `name`=호출 operation 식별자(어떤 API/동작 — 예 `im.terraformApply`·`im.jobStatus`); `detail`=kind가 정의하는 타입 결과 그릇(`type` 판별자; 패턴은 결정[S27], **각 type의 정확한 필드·logPointer·로그 조회는 별도 결정 대기** — 아래 메모)
- **PipelineEvent** — `{ id, pipelineId, taskId?, type, severity(INFO|CRITICAL), message, actor, createdAt }`
- **errorCode** (attempt·check 공통) — `CALL_TIMEOUT · EXECUTION_TIMEOUT · TTL_EXPIRED · IM_REJECTED · CHECK_ERROR · DISPATCH_NO_RESPONSE`(확장 가능; backpressure 429/503은 실패 아님 → requeue, fail_count·errorCode 둘 다 미해당)

---

## 1. 보드 / 조회 (read-only)

### `GET /admin/pipelines` — 보드 목록
- query: `status`, `type`, `provider`, `targetSourceId`, `page`, `size`, `sort`(기본 `lastActivityAt,desc`)
- `200` → `{ content: [PipelineSummary], totalElements, totalPages, number, size }`

### `GET /admin/pipelines/{pipelineId}` — 파이프라인 상세 (보드 → 드릴다운)
- `200` → `Pipeline` (`tasks[]` 포함)

### `GET /admin/pipelines/{pipelineId}/tasks/{taskId}` — task 타임라인
- 한 task의 attempt·check 머지 타임라인 (O5 "Terraform Job 상세 단계" 드릴다운).
- query: `page`·`size`·`sort`(기본 `checkedAt,desc`) — **checks 페이지네이션**(WAIT_EXTERNAL은 행이 많음); attempts는 인라인(K로 bounded).
- `200` → `{ task: Task, attempts: [Attempt], checks: { content:[Check], totalElements, totalPages, number, size } }`

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

> **force-check / pause / resume 제거 (개정 4판).** 수동 강제 확인(`force-check`)은 제거 — 모든 상태
> 확인은 polling 정책으로만 수행한다. dispatch admission gate(pause/resume)도 제거 — circuit breaker가
> 사라져 gate할 대상이 없다. 제어는 cancel·retry 둘만 남는다.

---

## 3. 트리거 (생성)

생성 트리거는 **Admin 콘솔의 [설치 시작]/[삭제 시작] 액션**이며(`triggeredBy` 기록), 시작 이후 admin은 관측·제어한다(ADR Context "Admin 콘솔에서 생성"과 정합). 트리거는 **기존 integration install/delete 흐름을 재사용**하고 별도의 CRUD-create admin API는 두지 않는다 — 정확한 endpoint는 기존 흐름과 path 합의 필요(아래).

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
  slotCap,                  // N — 동시 slot 보유 task soft target (TERRAFORM_JOB)
  maxExternalCallsPerTick,  // tick당 발사 호출 수 상한 (burst 완화, D-T7)
  maxFailCount,
  taskCheckRetentionDays, queueWaitAlertMin,
  notificationRouting: [ { event, channel } ]
}
```

### `PUT /admin/pipelines/settings`
- body: 위 객체(부분 갱신 허용). 변경은 `pipeline_event`로 감사, 재배포 불필요(R5).
- `200` → 갱신된 settings.

---

## 5. (선택) 동시성 현황

### `GET /admin/pipelines/concurrency` — slot 사용량
- `200` → `{ slotsInUse, slotCap }`
- 용도: 보드의 N(slot) 사용량 게이지. (circuit breaker는 제거 — 개정 4판; worker 장애는
  timeout+retry로 처리하고 systemic 연속 timeout은 알림 롤업(`WORKER_OUTAGE_SUSPECTED`)으로 노출한다.)

---

## 메모 / 미확정

- **생성(트리거) path**는 기존 install/delete 흐름과 합의 필요 — 본 문서는 admin **관측·제어** 표면에 집중.
- `observed`(O19 해소): 원시 kind별 값이 canonical(폴링 RUNNING/SUCCEEDED/FAILED · 조건 MET/NOT_MET); 통합 verdict(DONE/PENDING/FAILED)는 `(kind, observed)`에서 파생 — 통합 enum/detail 저장 안 함. (낮은 중요도 기본값 — 소비자가 단일 enum 원하면 versioning으로 통합)
- `DISPATCH` 행 노출(O20 해소): dispatch는 `attempts[]`(액션 생애주기) + `checks[](kind=DISPATCH)`(그 호출 관측) **양쪽**에 노출 — 서로 다른 grain이라 중복 아님; 머지 타임라인서 구분 표시.
- **미확정 (별도 결정 대기 — write-once 캡처라 중요):** `detail`의 kind별 **정확한 스키마**와 **full terraform 로그 조회 경로**(logPointer 형식 · IM 로그 API 존재 여부 · 포인터 위임 vs BFF 프록시). 타입 그릇 패턴 자체는 결정됨(S27).
- 본 초안 확정 후 `docs/swagger/admin-pipelines.yaml` 로 스키마화한다.
