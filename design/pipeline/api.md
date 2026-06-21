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

> **정본 = orchestrator 결정 1.2 DB 스키마.** 아래는 그 모델의 **camelCase 표현 스케치**이지 별도 정본이 아니다
> (스키마 변경 시 §1.2가 단일 출처 — 중복을 줄이려 여기엔 **API 고유 파생만** 추가 명시: `Attempt.outcome`(S30 파생)·`latestCheck`).
> 최종 스키마는 추후 `docs/swagger/admin-pipelines.yaml`로 옮긴다.

- **PipelineSummary** — `{ id, type(INSTALL|DELETE), provider(AWS|AZURE|GCP|IDC|SDU), targetSourceId, status(RUNNING|CANCELLING|DONE|FAILED|CANCELLED), progress{ done, total }, startedAt, lastActivityAt, triggeredBy }`  ← **`progress` 파생**: `total` = 그 run의 task 행 수(생성 시 고정 = snapshot.tasks 길이; CANCELLED task도 행은 남아 분모 불변), `done` = `COUNT(task WHERE status=DONE)`(다른 terminal은 미포함 — 진척이지 종료 아님). **분수는 RUNNING 진행 지표일 뿐 — terminal pipeline의 결과 판정은 `status`가 권위다**(CANCELLED/FAILED는 `done<total`로 남는 게 정상; 분수가 1이 아니라고 "미완"으로 읽지 말 것)
- **Pipeline** — `PipelineSummary` + `{ createdAt, finishedAt, failReason, tasks:[Task] }`
- **Task** — `{ id, seq, name, handlerKey, kind(TERRAFORM_JOB|CONDITION_CHECK), status(BLOCKED|READY|DISPATCHING|RUNNING|WAITING_EXTERNAL|DONE|FAILED|EXPIRED|CANCELLED), failCount, maxFailCount, nextCheckAt?, latestCheck:Check? }`  ← `nextCheckAt`=다음 tick 확인 예정 시각(`next_check_at`; terminal이면 null)  ← `handlerKey`=실행 코드 class 식별자(라우팅; `name`은 표시 라벨); 순서·의존은 `seq`(순차 chain, 별도 `dependsOn` 없음); **`latestCheck` = `started_at` 최대인 `task_check` 1건(PENDING 포함)** — `apiResult=PENDING`이면 "확인 중" 파생(D-T6)
- **Attempt** — `{ id, taskId, attemptNo, response{}, errorCode, startedAt, finishedAt, outcome(SUCCEEDED|FAILED|EXECUTION_TIMEOUT) }`  ← `attemptNo`=`task_attempt.attempt_no`(타임라인 "n번째 시도"); `response`=dispatch 원응답(TERRAFORM_JOB {jobId}, 단수); `errorCode`=attempt 실패 사유. **`outcome`은 DB 저장값이 아니라 `task_attempt.result` + `error_code`에서 파생한 API 표현**(DB는 `result(OK|FAIL)`+`error_code`만 저장; `outcome` 컬럼 없음):
    - `result=OK` → `outcome=SUCCEEDED`
    - `result=FAIL` ∧ `error_code=EXECUTION_TIMEOUT` → `outcome=EXECUTION_TIMEOUT`
    - `result=FAIL` ∧ `error_code ≠ EXECUTION_TIMEOUT` → `outcome=FAILED`
- **Check** — `{ id, taskId, kind(DISPATCH|CHECK), name, apiResult(PENDING|OK|ERROR), observed?(RUNNING|SUCCEEDED|FAILED|MET|NOT_MET), errorCode, externalHandle, startedAt, checkedAt?, latencyMs }`  ← `name`=호출 operation 식별자(어떤 API/동작 — 예 `im.terraformApply`·`im.jobStatus`); **`startedAt`=발사 시각(PENDING 포함 항상 set; 정렬·latestCheck 기준)**, `checkedAt`=관측 시각(PENDING이면 null), `observed`=관측 후에만(PENDING/미관측이면 null). (terminal 스냅샷 결과 컨테이너 `detail`은 v2 defer.)
- **PipelineEvent** — `{ id, pipelineId, taskId?, type, severity(INFO|CRITICAL), message, actor, createdAt }`  ← **`message`=DB 저장 컬럼 아님**: `pipeline_event.payload(jsonb)`에서 `type`별로 렌더링한 API 파생(저장은 `payload`만; 결정 1.2/1.3)
- **errorCode** — `CALL_TIMEOUT · EXECUTION_TIMEOUT · TTL_EXPIRED · IM_REJECTED · CHECK_ERROR · DISPATCH_NO_RESPONSE · HANDLER_NOT_FOUND`(확장 가능; backpressure 429/503은 실패 아님 → requeue, fail_count·errorCode 둘 다 미해당). **저장 위치는 사유 귀속에 따라 셋**: **① attempt 귀속**(EXECUTION_TIMEOUT·DISPATCH_NO_RESPONSE·IM_REJECTED — dispatch/run attempt 실패)은 그 `task_attempt.error_code`에; **② task_check 관측**(CHECK_ERROR·CALL_TIMEOUT — check 호출 실패; CONDITION_CHECK check·TERRAFORM_JOB poll 공통)은 그 `task_check.error_code`에; **③ tick 판정**(과거 attempt 유무와 무관): `TTL_EXPIRED`는 status=EXPIRED가 유일 원인이라 **status에서 파생**(별도 행 없음), `HANDLER_NOT_FOUND`는 즉시 FAILED 판정이라 **`task_check` 1행**(O25 관측 장부)에 errorCode로 기록(이미 RUNNING TF였다면 과거 attempt는 그대로 보존)

---

## 1. 보드 / 조회 (read-only)

### `GET /admin/pipelines` — 보드 목록
- query: `status`, `type`, `provider`, `targetSourceId`, `from?`, `to?`, `page`, `size`, `sort`(기본 `lastActivityAt,desc`)
  — `lastActivityAt` = `pipeline.last_activity_at`(매 상태 전이 tx에서 갱신되는 실 컬럼, 결정 1.2; 인덱스 보유).
  `from`/`to` = 기간 횡단 조회 — run의 `[started_at, finished_at)` 체류 구간이 `[from, to)`와 겹치는 run(overlap; `pipeline(started_at)` 인덱스, orchestrator §1.3).
- `200` → `{ content: [PipelineSummary], totalElements, totalPages, number, size }`
- 보드의 N(slot) 사용량 게이지 = `COUNT(task WHERE status IN (DISPATCHING,RUNNING))` / `slotCap`로 파생 — 별도 endpoint 불요.

### `GET /admin/pipelines/{pipelineId}` — 파이프라인 상세 (보드 → 드릴다운)
- `200` → `Pipeline` (`tasks[]` 포함)

### `GET /admin/pipelines/{pipelineId}/tasks/{taskId}` — task 타임라인
- 한 task의 attempt·check 머지 타임라인 (O5 "Terraform Job 상세 단계" 드릴다운).
- query: `page`·`size`·`sort`(기본 `startedAt,desc` — `started_at`은 PENDING 행도 항상 set; `checkedAt`은 관측 후라 PENDING이면 null) — **checks 페이지네이션**(WAIT_EXTERNAL은 행이 많음); attempts는 인라인(K로 bounded).
- `200` → `{ task: Task, attempts: [Attempt], checks: { content:[Check], totalElements, totalPages, number, size } }`

### `GET /admin/pipelines/{pipelineId}/events` — 이벤트 / 감사 로그
- query: `severity`, `page`, `size`
- `200` → `{ content: [PipelineEvent], totalElements, ... }`

> 고객 상세 화면 연동: `GET /integration/api/v1/target-sources/{targetSourceId}/pipelines/latest`
> — §4.3.2 "파이프라인 보드에서 보기" 링크용 파이프라인 1건 (`200` → `PipelineSummary`).
> **"latest" 의미:** 그 target의 non-terminal pipeline(unique 제약으로 최대 1건, 결정 5); 없으면 가장
> 최근 terminal run.

---

## 2. 제어 (control)

### `POST /admin/pipelines/{pipelineId}/cancel` — 취소
- 파이프라인을 `CANCELLING`으로. forward edge만 gate, in-flight job은 drain(결정 4c).
- CAS prior=RUNNING(state-machine). **이미 CANCELLING/terminal이면 0행 no-op = 멱등** — 에러가 아니라
  `200`으로 **현재 status를 반환**(이미-취소 재요청·terminal 부활 시도 모두 안전).
- `200` → `{ id, status }` — 신규 전이면 `"CANCELLING"`, 멱등 no-op이면 현재 status(CANCELLING/DONE/FAILED/CANCELLED).

### `POST /admin/pipelines/{pipelineId}/retry` — 재시도 = **새 run 생성(또는 기존 non-terminal 반환)**
- 재개가 아니라 새 run 생성(결정 5). 완료분은 terraform 수렴으로 사실상 no-op.
- 단 target에 이미 non-terminal pipeline이 있으면 unique 제약(결정 5)이 새 생성을 막고 **그 기존 1건을 반환**한다
  (예: 원 run이 아직 drain 중). 두 경로를 응답으로 구분:
- `200` → `{ pipelineId, created }` — `created=true`(새 run 생성) · `created=false`(기존 non-terminal 반환).
- `created=false`(충돌 반환)여도 **누가 시도했는지는 감사된다** — 그 경로도 `pipeline_event`(`RETRY_ATTEMPTED`·actor) 1행을 기존 pipeline에 남긴다(생성 전이는 없지만 시도 사실은 기록 — 감사 일급성).

> **force-check / pause / resume 제거 (개정 4판).** 수동 강제 확인(`force-check`)은 제거 — 모든 상태
> 확인은 polling 정책으로만 수행한다. dispatch admission gate(pause/resume)도 제거 — circuit breaker가
> 사라져 gate할 대상이 없다. 제어는 cancel·retry 둘만 남는다.

---

## 3. 트리거 (생성)

생성 트리거는 **Admin 콘솔의 [설치 시작]/[삭제 시작] 액션**이며(`triggeredBy` 기록), 시작 이후 admin은 관측·제어한다(ADR Context "Admin 콘솔에서 생성"과 정합). 트리거는 **기존 integration install/delete 흐름을 재사용**하고 별도의 CRUD-create admin API는 두지 않는다.

> **정확한 endpoint·트리거 주체(설치 시작 버튼 vs CONFIRMED 전이)는 ADR 결정이 아니라 실제 구현 시 기존 흐름과 배선하며 확정한다(out of ADR scope; 기존 install/delete 흐름 ADR-006/009이 path 소유).** 단 ADR-016이 못 박는 **생성 계약은 endpoint 무엇이든 공통**이며 정본은 아래 셋이다:
>
> 1. **Resolution** — `(type,provider)` 코드 default recipe를 resolve(결정 7).
> 2. **원자성** — task row 생성 + `pipeline_def_snapshot` 박제를 한 트랜잭션(snapshot == 실제 생성 구성).
> 3. **중복 차단(필수 처리)** — 동일 target에 non-terminal pipeline이 있으면 부분 unique 제약 `unique(target_source_id) WHERE non-terminal`(결정 5)이 INSERT를 막는다. **트리거 구현은 그 unique 위반(Postgres SQLSTATE 23505)을 *반드시* catch해 에러 대신 기존 non-terminal pipeline을 SELECT-반환해야 한다** — 이걸 누락하면 "target당 실행자 1" 불변식이 깨진다(ADR 핵심 계약, 결정 5). **[재시도]도 동일**(§2 retry — terminal에서 호출해도 target에 non-terminal이 있으면 그것을 반환, `created=false`). 토대 불변식이 ADR 밖 endpoint 코드에 의존하므로 **이 계약(특히 3번)의 통합 테스트를 반드시 갖춘다**(계약 회귀 방지; ADR 결정 5).
>
> 아래 endpoint 예시는 참고일 뿐 정본 아님.

- **설치 트리거** — 기존 `POST /integration/api/v1/target-sources/{targetSourceId}/pii-agent-installation/confirm` 가 내부적으로 `INSTALL` 파이프라인을 시작(CONFIRMED → 파이프라인).
- **삭제 트리거** — `POST /integration/api/v1/target-sources/{targetSourceId}/pii-agent-installation/delete` (또는 동등) → `DELETE` 파이프라인 생성. *기존 삭제 흐름과 path 합의 필요.*

---

## 4. 설정 (R5 — "설정은 데이터다", ADR Part II)

> **설정 항목·기본값 정본 = [operations.md](./operations.md) 설정표.** 아래는 그 항목의 GET/PUT API 표면일 뿐
> (knob 추가·기본값 변경은 operations 표가 단일 출처).

### `GET /admin/pipelines/settings`
- `200` → 런타임 config 단일 객체:
```
{
  tickIntervalSec, perCallDeadlineSec,
  dispatchRecoveryTimeoutMin, executionTimeoutMin,
  waitExternalTtlDays, waitExternalPollingGuardMin, jobPollCadenceSec,
  slotCap,                  // N — 동시 slot 보유 task soft target (TERRAFORM_JOB)
  maxExternalCallsPerTick,  // tick당 발사 호출 수 상한 (burst 완화, D-T7)
  maxFailCount,
  taskCheckRetentionDays, queueWaitAlertMin
}
```
> **이 객체 = 전역 기본값(평면 단일 객체)**. `perCallDeadlineSec`의 TaskKind별 오버라이드(operations D-T3)는 코드/배포 소관이라 여기서 편집하지 않는다. `executionTimeoutMin·waitExternalTtlDays·maxFailCount`는 **전역 기본값**일 뿐이며, 코드 default recipe가 task별로 override할 수 있다 — 생성 시 **(recipe per-task override 우선, 없으면 이 전역 기본값)**이 row에 frozen(결정 7.3·operations 적용 시점)이라, 이 API 변경은 *이후 생성되는 run*에만 반영된다. 즉 task별 차등의 출처는 recipe(코드)이고, 이 API는 전역 노브·기본값만 편집한다.

### `PUT /admin/pipelines/settings`
- body: 위 객체(부분 갱신 허용). 변경은 `pipeline_event`로 감사, 재배포 불필요(R5).
- `200` → 갱신된 settings.

---

## 메모 / 미확정

- **생성(트리거) path**는 기존 install/delete 흐름과 합의 필요 — 본 문서는 admin **관측·제어** 표면에 집중.
- `observed`(O19 해소): 원시 kind별 값이 canonical(폴링 RUNNING/SUCCEEDED/FAILED · 조건 MET/NOT_MET); 통합 verdict(DONE/PENDING/FAILED)는 `(kind, observed)`에서 파생 — 통합 enum/detail 저장 안 함. (낮은 중요도 기본값 — 소비자가 단일 enum 원하면 versioning으로 통합)
- `DISPATCH` 행 노출(O20 해소): dispatch는 `attempts[]`(액션 생애주기) + `checks[](kind=DISPATCH)`(그 호출 관측) **양쪽**에 노출 — 서로 다른 grain이라 중복 아님; 머지 타임라인서 구분 표시.
- 본 초안 확정 후 `docs/swagger/admin-pipelines.yaml` 로 스키마화한다.
