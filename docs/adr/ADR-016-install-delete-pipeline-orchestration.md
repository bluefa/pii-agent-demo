# ADR-016: Install/Delete Pipeline Orchestration in BFF

## Status

Proposed (개정 4판, 2026-06-14)

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
  5. 동시 실행 TerraformJob은 N 미만이어야 한다(IM 용량 보호). 현재 자동화 caller는 BFF뿐이다.
  6. 실행 시간·전체 히스토리(target별 run · task별 attempt/check · 모든 외부 호출 결과)와 알림이
     일급 요구사항이다.
  7. (descoped) AI 운영은 범위 외 — 단, 모든 admin 액션이 BFF admin API라는 계층 규칙을 유지하므로
     향후 AI 운영자는 또 하나의 API principal로 표면 변경 없이 추가될 수 있다.

## Decision

**BFF 내부 durable state machine + reconciler tick을 둔다.** DB가 유일한 상태이고, 30초 주기 tick이
각 task를 전진시키며 pipeline 상태는 task에서 파생된다. 다중 replica는 advisory lock 리더 + 모든
전이 CAS로 안전하다.

- **TaskKind는 3종으로 제한**한다 — `TERRAFORM_JOB` · `GENERAL_JOB` · `CONDITION_CHECK`(개정 4판:
  훅의 임의 조합·범용 실행 컨텍스트 일반화를 제거). 새 task = 새 TaskKind 코드 클래스.
- **Retry는 재개가 아니라 새 run 생성**이다 — terminal 부활 없음, 완료분은 terraform 수렴으로 사실상 no-op.
- **정합성은 exactly-once 기계가 아니라 idempotency-by-construction**으로 확보한다 — 모든 dispatch는
  멱등이어야 하고, at-least-once dispatch의 안전성은 그 멱등성에 의존한다.
- **N-cap은 BFF 측 soft target**으로 적용해 BFF 발 동시 terraform job을 **N·K로 bound**한다(무분별 방지;
  IM backpressure(429) 신뢰성에 의존하지 않음). poll burst는 `max_external_calls_per_tick`으로 완화하고
  정밀 강제는 IM 429에 위임한다.
- **무한 대기를 막는다** — execution timeout + WAIT_EXTERNAL TTL. 죽일 수 없거나 systemic한 실패는
  corruption이 아니라 delay로 다룬다(circuit breaker 없음 — timeout + retry + 알림 롤업).
- **중단(cancel)은 죽이지 않고 전진만 멈춘다** — forward edge만 gate, in-flight job은 drain,
  CANCELLING → CANCELLED로 수렴(CANCELLING이 최우선 precedence).

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
| F. Infra Manager 측 동시성 제한 (지금) | 보류 (사용자 결정) | 현재 자동화 caller는 BFF뿐; 다른 caller 등장 시 IM 429 재검토(결정 4b) |

별도 워커 분리도 같은 이유로 배제한다 — 무거운 워크로드(실제 Terraform 실행)는 이미 TerraformWorker로
분리돼 있고 reconciler는 호출·폴링·기록만 한다. 부하가 강제하면 답은 워커 분리가 아니라 Option B다.

## Consequences

### Positive

- 수동·사람 순차 Terraform 운영이 가시적 큐와 강제된 동시성을 갖춘 **restart-safe 자동화**가 된다.
- 일시 장애·BFF crash/재배포·worker outage·외부 호출 실행 주체 죽음이 **자가 회복**한다(fail-count
  재시도, timeout + retry, 관측/상태 분리).
- 모든 grain의 실행 히스토리(run → task → attempt → 개별 poll/check)·"호출 시도 vs 미시도" 구분·
  감사·알림이 **하나의 append-only 기록 규율**에서 파생된다(2차 장부·로그 고고학 없음).
- 장시간 외부 호출(200초+)을 tick 모델·불변식을 깨지 않고 수용한다(async 발사·task별 deadline·
  관측/상태 분리).
- 재시도 의미론이 "새 run"으로 확정돼 terminal 단순함이 보존되고, 모델이 TaskKind 3종으로 단순하다.

### Negative / 감수

- BFF가 DB·백그라운드 루프를 갖는다 — 더 이상 stateless proxy가 아니다(다중 replica엔 리더 선출 필요).
  **본 ADR에서 가장 비싼 한 줄**이지만 restart-safety·히스토리·조회성이 같은 뿌리에서 나오므로 감수한다.
- at-least-once dispatch는 간헐적 중복/고아 job을 남길 수 있다 — 멱등 apply가 이중 실행을 무해하게 하고,
  재dispatch 헤드룸(N·K ≤ IM 수용량)과 execution timeout이 점유를 bound한다.
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
- **FR-5** Terraform 동시 실행 제한 — N-cap admission
- **NFR-1** 재시작 안전 — DB state + tick 재도출
- **NFR-2** at-least-once dispatch 안전 — idempotency contract
- **NFR-3** 다중 replica 안전 — advisory lock + CAS

## Links

| 문서 | 내용 |
|---|---|
| [orchestrator-design.md](../../design/pipeline/orchestrator-design.md) | 상태기계·DB 모델·tick 흐름·dispatch 5단계·crash recovery·N-cap admission·CANCELLING |
| [task-model.md](../../design/pipeline/task-model.md) | TaskKind 3종·작성 규칙·멱등성 계약 |
| [api.md](../../design/pipeline/api.md) | Admin·History·cancel/retry API |
| [operations.md](../../design/pipeline/operations.md) | 설정·알림·장애 대응·튜닝 |
| [requirements.md](../../design/pipeline/requirements.md) | 기능/비기능/성능 요구사항 |
| [migrations.md](../../design/pipeline/migrations.md) | DB migration·인덱스·retention |
| [open-questions.md](../../design/pipeline/open-questions.md) | 미해결 질문(O10·O19·O20) |
| [decision-history.md](../../design/pipeline/decision-history.md) | 긴 변경 이력(재구성 내역·Resolved) |

관련: ADR-006(3-object confirmation model), ADR-009(process status model) — 파이프라인은 CONFIRMED와
INSTALLED 사이에서 동작한다.

## Revision History

- **2026-06-11** Proposed
- **2026-06-12** timeout / retry / cancel 의미론 명확화
- **2026-06-13** async 실행 모델(결정 6) · N-cap soft target · poll budget
- **2026-06-14** v4 단순화(TaskKind 3종 · circuit breaker·C-budget·force-check 제거 · postCheck 0..1) ·
  N-cap 목표 명시 · 설계 문서 분리

전체 사고 이력(재구성 내역·Resolved)은 [decision-history.md](../../design/pipeline/decision-history.md).
