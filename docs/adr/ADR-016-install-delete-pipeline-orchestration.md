# ADR-016: Install/Delete Pipeline Orchestration in BFF

## Status

Proposed (개정 6판, 2026-06-20)

> 이 ADR은 **결정**(선택지·결정·근거·결과)만 담는다. 상세 설계·DB 모델·tick 흐름·운영·요구사항·
> 긴 이력은 [`design/pipeline/`](../../design/pipeline/)로 분리했다 — 아래 **Links** 참조.

## Context

시스템 계층: Frontend(Admin console) → **BFF**(파이프라인 오케스트레이션이 여기 산다) → Backend
Manager(연동·승인·target source) / Infra Manager(Terraform job API; 실행은 TerraformWorker k8s pod).

- **현재 문제** — 모든 Infra Manager Terraform 호출이 사람 수동이다. target source 설치/삭제를
  브라우저 세션 없이 자동·복구가능하게 하고, **실행 히스토리를 일급으로** 조회·알림할 수 있어야 한다.
- **규모** — target source 약 2000개, provider × install/delete 파이프라인 정의 약 12종.
- **확정 제약**:
  1. 오케스트레이션 주체는 BFF(사용자 결정). 파이프라인은 Admin 콘솔에서 생성되고 브라우저 없이 전진한다.
  2. IM run API는 비동기 — job_id를 반환하고 pubsub로 TerraformWorker가 실행한다. 일부 호출은 job_id
     없이 조건으로 판정한다.
  3. terraform_job_id는 요청별 서버 측 발급. **TerraformWorker에 dedup이 없다** — 중복 제출은 각각
     실행되나 모든 execution API가 멱등이라 인프라 결과는 손상되지 않는다.
  4. 결과 유실 가능(드문 worker 결함) — "실행 중"과 "유실"을 구분하지 않고 execution timeout으로 흡수한다.
  5. 동시 실행 TerraformJob은 **고정 worker 풀 크기 M으로 hard-cap**된다(IM 용량 보호) — BFF N-cap(N≈M)은
     그 위의 제출 throttle. 현재 자동화 caller는 BFF뿐이다.
  6. 실행 시간·전체 히스토리(target별 run · task별 attempt/check · 모든 외부 호출 결과)와 알림이
     일급 요구사항이다. **단 보존은 2단: run/task/attempt/event spine은 무기한, 고빈도 관측(task_check)은
     retention 창(기본 90일) 내** — "전체 외부호출 결과"의 일급성은 retention 창 안에서의 일급 조회를 뜻하고,
     장기로는 spine + attempt 결과가 남는다(migrations Retention).
  7. (descoped) AI 운영은 범위 외 — 단, 모든 admin 액션이 BFF admin API라는 계층 규칙을 유지하므로
     향후 AI 운영자는 또 하나의 API principal로 표면 변경 없이 추가될 수 있다.

## Decision

**BFF 내부 durable state machine + reconciler tick을 둔다.** DB가 유일한 상태이고, 30초 주기 tick이
각 task를 전진시키며 pipeline 상태는 task에서 파생된다. 다중 replica는 advisory lock 리더 + 모든
전이 CAS로 안전하다.

- **TaskKind는 2종으로 제한**한다 — `TERRAFORM_JOB` · `CONDITION_CHECK`(개정 4판: 훅의 임의 조합·범용
  실행 컨텍스트 일반화를 제거). 새 task = 새 코드 class(대개 기존 kind 재사용; 새 흐름 shape일 때만 새 kind).
  (비-terraform 비동기 job kind는 v2 defer.)
- **Retry는 재개가 아니라 새 run 생성**이다 — terminal 부활 없음, 완료분은 terraform 수렴으로 사실상 no-op.
- **정합성은 exactly-once 기계가 아니라 idempotency-by-construction**으로 확보한다 — 모든 dispatch는
  멱등이어야 하고, at-least-once dispatch의 안전성은 그 멱등성에 의존한다.
- **동시성은 고정 TerraformWorker 풀이 hard-cap(≤ M)**하고, BFF N-cap은 pubsub 큐를 얕게 유지하는 제출
  throttle다(N ≈ M). `N·K`는 동시 실행 상한이 아니라 worst-case 제출량 sizing 값. poll burst는
  `max_external_calls_per_tick`으로 완화한다.
- **무한 대기를 막는다** — execution timeout + WAIT_EXTERNAL TTL. 죽일 수 없거나 systemic한 실패는
  corruption이 아니라 delay로 다룬다(circuit breaker 없음 — timeout + retry + 알림 롤업).
- **중단(cancel)은 죽이지 않고 전진만 멈춘다** — forward edge만 gate, in-flight job은 drain,
  CANCELLING → CANCELLED로 수렴(CANCELLING이 최우선 precedence).
- **Pipeline 구성(Definition)은 코드 default + 실행 시 불변 snapshot으로 정의**한다(결정 7) — recipe는
  `(type,provider)`당 코드 default 1개이고, 실행 구성은 snapshot으로 박제해 재현한다(default release를
  올려도 in-flight·과거 run의 **recipe/config는 절연** — 단 task class 코드 동작은 절연 대상이 아니라 현재
  배포본을 탄다; 코드=실행 권위, 결정 7.3). **snapshot(`pipeline_def_snapshot`, 1 pipeline:1행·생성 시 write-once)에
  `{pipeline_id, definition_key, definition_version, type, provider, spec(jsonb)}`를 저장하며, `spec`은
  resolve된 전체 recipe(이름 + 순서 있는 task 목록, 각 task = `{seq, handler_key, name(표시), kind, ttl?,
  polling_interval?, execution_timeout?, max_fail_count}`; 내부 jsonb이라 snake_case·정본 = orchestrator §1.2; 호출별 HTTP deadline은 task별 아닌 전역+TaskKind 설정이라 spec에 없음)다 —
  task row가 그 run의 실행 상태라면 snapshot은 definition 원본(이력·재현 권위;
  코드=실행 권위).** 무게가 per-target cardinality에 있으므로 default=코드가 그것을 제거한다.
  (TargetSource별 데이터 custom override는 v2 defer.)
- **동일 target 중복 pipeline은 unique 제약으로 1건만 허용한다(결정 5).** 부분 unique 제약
  `unique(target_source_id) WHERE status NOT IN (DONE,FAILED,CANCELLED)`으로 target당 non-terminal pipeline을
  1건으로 강제한다. **생성 계약(트리거 endpoint는 외부지만 이 계약은 ADR 불변식):** 어느 경로로 생성되든
  ① recipe resolve → ② task row + snapshot **원자적** 생성 → ③ **unique 위반(Postgres 23505) 시 에러가 아니라
  기존 non-terminal pipeline을 반환**해야 한다([재시도]도 동일). ③을 누락하면 "target당 실행자 1" 전제
  (단일 writer·N-cap·멱등 추론)가 깨지므로, endpoint 구현이 *반드시* 충족할 계약으로 못박는다. 토대 불변식이
  외부(ADR 밖) endpoint 코드에 의존하므로, **트리거 endpoint는 ③(23505→기존 non-terminal 반환) 계약의 통합
  테스트를 반드시 갖춘다**(계약 회귀 방지).

> 상세 메커니즘(상태기계·DB 스키마·tick·dispatch 5단계 writer 분리·crash recovery·CANCELLING
> precedence·N-cap admission)은 [orchestrator-design.md](../../design/pipeline/orchestrator-design.md),
> TaskKind·멱등성 계약은 [task-model.md](../../design/pipeline/task-model.md) 참조.

## Considered Options

| 옵션 | 결정 | 이유 |
|---|---|---|
| A. BFF 내부 durable reconciler (DB row + tick) | **채택** | 실제 워크로드에 부합; 재시작 안전; 관리자 조정형 폴링이 next_check_at에 자연 대응; 최소 운영 footprint |
| B. 별도 오케스트레이터 마이크로서비스 | 보류 | 모듈 분량 로직에 서비스 분량 오버헤드. 모듈 경계가 추출 비용을 낮게 유지 |
| C. 워크플로 엔진 (Temporal/Airflow/브로커) | 거부 | ≥10분 폴링의 2–4 step 선형 체인은 그 비용을 정당화 못 함 |
| D. BFF 인메모리 async 체인 | 거부 | 재시작/배포에 run 유실; durable 큐·히스토리·수일 WAIT_EXTERNAL 표현 불가 |
| E. Backend Manager에 파이프라인 상태 | 거부 (사용자 결정) | 로직·상태 분산; 원격 API 경유 원자적 slot 회계는 racy |
| F. Infra Manager 측 동시성 제한 (지금) | 보류 (사용자 결정) | 현재 자동화 caller는 BFF뿐; 다른 caller 등장 시 IM 429/503 재검토(결정 4b) |

별도 워커 분리도 같은 이유로 배제한다 — 무거운 워크로드(실제 Terraform 실행)는 이미 TerraformWorker로
분리돼 있고 reconciler는 호출·폴링·기록만 한다. 부하가 강제하면 답은 워커 분리가 아니라 Option B다.

## Consequences

### Positive

- 수동·사람 순차 Terraform 운영이 가시적 큐와 강제된 동시성을 갖춘 **restart-safe 자동화**가 된다.
- 일시 장애·BFF crash/재배포·worker outage·외부 호출 실행 주체 죽음이 **자가 회복**한다(fail-count
  재시도, timeout + retry, 관측/상태 분리).
- 모든 grain의 실행 히스토리(run → task → attempt → 개별 poll/check)·"호출 시도 vs 미시도" 구분·
  감사·알림이 **하나의 기록 규율**(현재 상태=CAS 갱신 · 이력=행 추가)에서 파생된다(2차 장부·로그 고고학 없음).
- 장시간 외부 호출(200초+)을 tick 모델·불변식을 깨지 않고 수용한다(async 발사·TaskKind별 호출 deadline·
  관측/상태 분리).
- 재시도 의미론이 "새 run"으로 확정돼 terminal 단순함이 보존되고, 모델이 TaskKind 2종으로 단순하다.

### Negative / 감수

- BFF가 DB·백그라운드 루프를 갖는다 — 더 이상 stateless proxy가 아니다(다중 replica엔 리더 선출 필요).
  **본 ADR에서 가장 비싼 한 줄**이지만 restart-safety·히스토리·조회성이 같은 뿌리에서 나오므로 감수한다.
- at-least-once dispatch는 간헐적 중복/고아 job을 남길 수 있다 — 멱등 apply가 이중 실행을 무해하게 하고,
  N·K 기준의 retry/orphan headroom 산정과 execution timeout이 BFF 발 제출 폭주를 운영상 bound한다.
  실제 worker global hard cap은 BFF가 보장하지 않는다.
- worker outage 감지가 execution timeout에 의존해 둔하다(~30분+, 구조적 상수) — circuit breaker 없이
  timeout + retry + 알림 롤업으로 처리.
- 재개 비지원으로 실패한 긴 run의 재시도는 전체 재실행 시간을 지불한다(terraform 수렴으로 완료분은 no-op).
- 관측 로그(task_check)가 poll/check마다 행을 쓴다 — cadence로 bounded·retention으로 prune되지만 DB 트래픽.

## Requirements Satisfied

This decision satisfies (전체 표 → [requirements.md](../../design/pipeline/requirements.md)):

- **FR-1** 브라우저 세션 없는 durable 설치/삭제 — DB durable state machine
- **FR-2** target별 run history — `pipeline.target_source_id` + history API
- **FR-3** task별 attempt/check audit trail — `task_attempt` · `task_check`
- **FR-4** 무한 대기 방지 — execution timeout + WAIT_EXTERNAL TTL
- **FR-5** BFF-visible active Terraform task 제한 — N-cap admission
- **NFR-1** 재시작 안전 — DB state + tick 재도출
- **NFR-2** at-least-once dispatch 안전 — idempotency contract
- **NFR-3** 다중 replica 안전 — advisory lock + CAS

## Links

| 문서 | 내용 |
|---|---|
| [orchestrator-design.md](../../design/pipeline/orchestrator-design.md) | 상태기계 설계(CAS·파생·단일 writer)·DB 모델·tick 흐름·dispatch 5단계·crash recovery·N-cap admission·CANCELLING |
| [state-machine.md](../../design/pipeline/state-machine.md) | Pipeline·Task 전이도 (상태·트리거·guard 일람) |
| [task-model.md](../../design/pipeline/task-model.md) | TaskKind 2종·작성 규칙·멱등성 계약 |
| [api.md](../../design/pipeline/api.md) | Admin·History·cancel/retry API |
| [operations.md](../../design/pipeline/operations.md) | 설정·알림·장애 대응·튜닝 |
| [requirements.md](../../design/pipeline/requirements.md) | 기능/비기능/성능 요구사항 |
| [migrations.md](../../design/pipeline/migrations.md) | DB migration·인덱스·retention |
| [implementation-notes.md](../../design/pipeline/implementation-notes.md) | 구현 런북(Virtual Thread·pinning — 아키텍처 불변식 아님) |
| [v2-deferred.md](../../design/pipeline/v2-deferred.md) | v2로 미룬 표면(scheduling·직렬화 큐·custom recipe·postCheck/O29·알림 라우팅·skip-completed·GENERAL_JOB) |
| [decision-history.md](../../design/pipeline/decision-history.md) | 긴 변경 이력(재구성 내역·Resolved) |

관련: ADR-006(3-object confirmation model), ADR-009(process status model) — 파이프라인은 CONFIRMED와
INSTALLED 사이에서 동작한다.

## Revision History

- **2026-06-11** Proposed
- **2026-06-12** timeout / retry / cancel 의미론 명확화
- **2026-06-13** async 실행 모델(결정 6) · N-cap soft target · poll budget
- **2026-06-14** v4 단순화(TaskKind 3종 · circuit breaker·C-budget·force-check 제거 · postCheck 0..1) ·
  N-cap 목표 명시 · 설계 문서 분리
- **2026-06-20** v5 Pipeline Definition 모델(코드 default + 데이터 custom override + run snapshot) ·
  Custom Pipeline 도입(결정 7) · O10 해소 · postCheck/O29 v1 defer · 다중 pipeline 실행 직렬화(결정 8)
- **2026-06-20** v6 v1/v2 분리 — scheduling·per-target 직렬화 큐(구 결정 8)·custom recipe 데이터 layer
  (구 결정 7 일부)·postCheck/O29·알림 라우팅·skip-completed·GENERAL_JOB을 v2로 이관(v2-deferred.md);
  v1은 결정 8 큐 대신 unique 제약으로 중복 pipeline 1건 강제; TaskKind 2종; 결정 7=코드 default+snapshot
- **2026-06-20** v6 후속 — v1 스키마 정리(detail 제거 · depends_on→seq predecessor+unique(pipeline_id,seq) ·
  /concurrency·open-questions 제거 · 비정규화 요약 제거); `pipeline_def_snapshot` spec(jsonb) 내용 정밀
  명시; `task_attempt.response`는 유지
- **2026-06-21** v6 후속3 — 정밀도 정정(codex·opus 재리뷰 86~87/100): `pipeline.definition_version` 제거
  (snapshot 단일)·`last_activity_at` 정의(보드 정렬)·outbox at-least-once 정정·settings N 모순 해소·
  task name=표시라벨 명확화·충돌반환 actor 감사·K crash headroom 주석; 부록 A → implementation-notes.md 분리

전체 사고 이력(재구성 내역·Resolved)은 [decision-history.md](../../design/pipeline/decision-history.md).
