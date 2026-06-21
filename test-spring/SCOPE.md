# ADR-016 V1 — 구현 Scope (test-spring)

> ADR-016 V1을 **Spring Boot 3 / Java 21**로 충실히 구현하는 범위 정의. 이 문서를 ADR과 대조 리뷰
> (codex+opus)해 **결함 0**까지 다듬은 뒤 Todo를 도출한다. 정본:
> [ADR-016](../docs/adr/ADR-016-install-delete-pipeline-orchestration.md) + `design/pipeline/*`.
> **정확성이 목표** — 임의 설계 금지, ADR 명시 내용만.
>
> 개정 이력: v1(codex 84 / opus 88) → **v2**: @Version→명시적 guarded CAS, read/settings/outbox 서비스 V1 승격,
> due 정렬·last_activity_at·fail_reason·CONDITION_CHECK 라이프사이클·backpressure recovery·TF-poll 오류코드·
> maxExternalCalls(poll/check만)·latency overwrite·fragile 테스트 보강, v2 번들 확장.

---

## 0. 목표·경계

- **목표**: ADR-016 V1의 BFF 내부 durable state machine + reconciler tick + 그 서비스(생성·제어·조회·설정·알림)를 **충실히** 구현. 단위 테스트 포함.
- **명시적 제외 (사용자 지시 + v2-deferred)**:
  - **Task 상세 내역** = `task_check.detail` / postCheck(O29) **+ 그 번들 전체**: terminal 스냅샷 관측·full terraform 로그 조회(logPointer)·redaction — 전부 v2(v2-deferred.md:13, task-model:84). 관측 spine(DISPATCH 호출당·CHECK run·RLE)은 **V1 유지**.
  - **Admin REST Controller** — HTTP 표면 미구현. 단 그 컨트롤러가 호출할 **서비스 전부**(생성·취소·재시도·**조회/query·설정·이벤트**)는 V1 구현 대상.
  - **v2 기능**: GENERAL_JOB·RECONNECT·custom recipe(데이터 override)·scheduling/직렬화 큐(구 결정 8)·skip-completed(content-hash)·외부 알림 라우팅(Slack/Email).
- **경계 추상화** (실물 외부 의존 = 인터페이스):
  - **Infra Manager 호출** = `PipelineHandler`(stable `key()`·`kind()`·멱등 계약·dispatch/poll/check 별 outcome) — 테스트 fake. **outcome 타입이 Accepted/Rejected(IM_REJECTED)/Backpressure(Retry-After)/CallTimeout을 구분 전달**해야 backpressure 비가산 경로가 성립(reconciler가 추론하지 않음).
  - **Leader** 인터페이스 + `SingleNodeLeader`(항상 리더). 프로덕션 = Postgres advisory lock(pg_try_advisory_lock) — 구현 범위 밖. **단 상태기계 정확성은 리더에 의존하지 않게 CAS·멱등으로 구현**(split-brain 가정, 결정 3.2).
  - **외부 호출 발사** = `ExternalCallExecutor`. **프로덕션 불변식 = 비블로킹 async 발사**(D-T2); 테스트는 동기 executor로 결정성 확보(테스트 전용 단순화).
  - **Clock** 주입(deadline_at·TTL·next_check_at 결정성).
  - **DB**: 프로덕션 Postgres / 테스트 H2. **23505→기존 non-terminal 반환은 V1 생성 계약**(부분 unique). H2가 partial-unique를 못 증명하므로 → 앱 레벨 락/시뮬레이션 + (가능 시) Postgres 계약 테스트. jsonb(response·spec·payload·fail_reason)는 참조 컬럼/JSON-String.

## 1. 기술 스택

- Spring Boot 3.3.x · Java 21(`--release 21`) · Spring Data JPA · Lombok(@Getter/@Setter) · Jackson(jsonb 직렬화).
- 빌드 Maven · 테스트 JUnit5 + AssertJ + Mockito + H2.
- **구현·리뷰 표준 = `.claude/skills/spring-java21`** (Spring Boot 3/Java 21 idiom · 생성자 주입 · sealed/record · 명시 guarded-CAS(@Version 아님) · **테스트에 @Transactional 금지** · Clean Code 강제 규칙 13 + 리뷰 체크리스트). 모든 구현·리뷰가 이 harness를 적용한다.

---

## 2. ADR 결정 → Spring 실현 (In-Scope)

| ADR | 내용 | Spring 실현 |
|---|---|---|
| **결정 1** | durable state machine + reconciler tick, DB=유일 상태 | `Reconciler`(@Scheduled tick, @Transactional 상태 writer) · 엔티티가 유일 상태 · `Leader` 게이트 |
| 1.1 | **due 선별·전이·파생** | due = (predecessor DONE인 BLOCKED·미dispatch READY·next_check_at 도래한 RUNNING/WAITING_EXTERNAL·timeout/TTL 후보·미소비 관측), **정렬 `next_check_at ASC, last_checked_at ASC NULLS FIRST, created_at ASC, seq ASC`**. 한 tick = due task 각 ≤1 전이(독립 commit) → **그 tick 커밋 상태로 pipeline 파생 1회**(같은 tick 수렴, seq ASC라 chain 1tick 1칸·최저 seq 첫 tick 무조건 READY) |
| 1.2 | **데이터 모델 6 + 불변식** | 엔티티 6 + repo. 컬럼 불변식 V1: `fail_reason`(FAILED 파생 기록·CANCELLED null), `last_activity_at`(**매 전이 tx 갱신**·보드 정렬), `last_checked_at`(due 기아 정렬), **unique(pipeline_id, seq)**, **부분 unique(target non-terminal 1건)**, `attempt_id` 미도입, RLE·retention 인덱스 |
| 1.3 | **기록·조회·알림 (outbox)** | 상태=**명시 guarded CAS**(아래) / 이력=insert / `PipelineEvent` outbox **같은 tx 기록**(유실 없음). Notifier loop = `notified_at IS NULL` 소비(at-least-once; 멀티-pod SKIP LOCKED은 Postgres·범위 밖, 단일 소비자 V1) |
| **결정 2** | TaskKind 2종 · handler 자동 레지스트리 | `HandlerRegistry`(자동수집·**stable key**·중복키 부팅실패·미등록 UnknownHandler→HANDLER_NOT_FOUND). recipe는 handler를 **class 참조**(컴파일 안전)·부팅 시 default recipe handler 등록 assert. 비호환 변경 `_V1/_V2` append-only(문서화). pre-deploy CI 게이트(non-terminal handler_key)는 CI 영역·범위 밖(문서화) |
| **결정 3** | idempotency-by-construction · dispatch 5단계 · crash recovery | 멱등=핸들러 계약(O28). dispatch 5단계 writer 분리. recovery_timeout 재dispatch + **backpressure 예외** |
| 3.1 | dispatch 5단계 | **(1 tick tx)** DISPATCHING **guarded CAS** + attempt 생성 + next_check_at. **(2 call tx)** DISPATCH PENDING 선기록. **(3 call)** 호출. **(4a call tx)** task_check 관측 always(backpressure면 호출스레드가 next_check_at=Retry-After/없으면 다음 tick). **(4b call tx)** response 채택 = **`response IS NULL AND finished_at IS NULL AND status=DISPATCHING` WHERE-predicate CAS**(write-once·늦은 response 차단). **(5 다음 tick)** RUNNING guarded CAS |
| 3.2 | **단일 전이 함수·단일 writer** | 상태·fail_count·attempt 생애주기 경계·pipeline_event = **tick tx**만. 관측(task_check)·산출(attempt.response)·backpressure next_check_at = **call-thread tx(REQUIRES_NEW)**. 모든 상태 전이는 **expected-prior guarded update**(전이 테이블 검증 + WHERE prior; 0행=stale no-op) |
| **결정 4a** | 통합 timeout budget | per-call deadline(설정·TaskKind 오버라이드) · dispatch recovery timeout · execution timeout(TF) · TTL(CONDITION_CHECK) · `deadline_at` 파생(TF=dispatch+exec / CC=WAITING 진입+ttl) |
| **결정 4b** | 동시성: slotCap admission | READY TF를 **`COUNT(kind=TF AND status IN(DISPATCHING,RUNNING)) < slotCap`(전역·non-CAS soft)** 일 때만 DISPATCHING. workerPoolSize=M은 IM 배포설정·범위 밖 |
| **결정 4c** | cancel = drain | [중단] RUNNING→CANCELLING(**CAS prior=RUNNING**·terminal/CANCELLING이면 0행 멱등) · forward edge gate · RUNNING TF만 drain · 나머지 즉시 CANCELLED(매트릭스 §3) |
| **결정 4d** | systemic 실패 = 알림 롤업 | `WORKER_OUTAGE_SUSPECTED`(execution timeout **짧은 창 연속**) 단일 롤업 + `QUEUE_WAIT_EXCEEDED`(slot 대기 임계 초과). 인앱 outbox만(라우팅 v2) |
| **결정 5** | retry=새 run · unique · 생성 계약 | `PipelineCreationService`/`RetryService`. **생성 계약 3단계**(§3). retry 충돌(`created=false`) 시 **`RETRY_ATTEMPTED`(actor) 감사 1행**(감사 일급성) |
| **결정 6** | tick 외부 호출 모델 D-T1~D-T7 | D-T1 deadline≠tick · D-T2 async 발사(prod) · D-T3 per-call deadline TaskKind 오버라이드 · D-T4 관측=call/상태=tick · D-T5 DISPATCH PENDING 선기록 · D-T6 장시간 상태 없음("확인 중"=DISPATCH PENDING/CHECK은 nextCheckAt) · **D-T7 `maxExternalCallsPerTick`(poll/check만 — dispatch 제외)** |
| **결정 7** | Definition: 코드 default recipe + snapshot | `RecipeRegistry`((type,provider)당 default·boot assert) · 생성 시 snapshot 박제(write-once·spec jsonb) · task별 frozen knobs(생성 시 row 고정) · 코드=실행권위/snapshot=이력권위 |
| **R5** | 설정은 데이터 | 운영 파라미터 = **런타임 DB 설정**(재배포 불요·`PUT` 변경 즉시·pipeline_event 감사). 단 task별(ttl·polling·execution_timeout·max_fail_count)은 **생성 시 frozen → 이후 run만**. `SettingsService`(get/put + 감사). workerPoolSize는 배포설정(비편집) |

## 3. 상태기계·서비스 규칙 (정확 구현 대상)

- **Pipeline 5 / Task 9 상태**. slot 큐 = READY∧TF.
- **파생 ①CANCELLING > ②FAILED task(fail==K 또는 HANDLER_NOT_FOUND) > ③TTL EXPIRED > ④전 task DONE**. **CANCELLING precedence = 상태 기준**(파생 시점 pipeline.status; 시간 아님). FAILED 파생 시 `fail_reason={task_id,error_code}` 기록, **CANCELLED 수렴 시 fail_reason=null**.
- **tick 평가 순서(task 1개)**: ①CANCELLING 취소규칙 ②**handler resolve(READY 이상 serviceable만 — BLOCKED 제외)** 미해결→즉시 FAILED ③**완료관측 > timeout**(최신 poll=SUCCEEDED/check=MET면 DONE; "만료는 fresh 재독 후") ④timeout 판정(exec→attempt 실패·TTL→EXPIRED) ⑤일반 전이.
- **fail_count 가산**: TF dispatch 실패(IM_REJECTED·DISPATCH_NO_RESPONSE)·TF job 실패(JOB_FAILED·EXECUTION_TIMEOUT)=가산 · **TF poll 호출 오류(task_check error_code=CHECK_ERROR 또는 CALL_TIMEOUT)=미가산**(잡 못 읽음) · CONDITION_CHECK 비-backpressure CHECK ERROR/CALL_TIMEOUT=가산 · NOT_MET·backpressure=미가산 · HANDLER_NOT_FOUND·취소정리(error_code=null)=미소모 · **drain 중 실제 실패(JOB_FAILED·EXECUTION_TIMEOUT)=가산하되 pipeline CANCELLED 수렴**. K=maxFailCount(TF=초기 dispatch 포함 최대 attempt).
- **재시도**: TF RUNNING 실패 fail<K→READY 재큐(새 attempt)·==K→FAILED · TF DISPATCHING 실패 fail<K→in-place 재dispatch(새 attempt·slot 보유)·==K→FAILED · CONDITION_CHECK CHECK ERROR 누적==K→FAILED.
- **backpressure(429/503)**: fail 미소모. dispatch=Retry-After 있으면 그만큼/없으면 다음 tick(cadence 하한 없음·**동일 logical attempt 재사용**·새 attempt 없음). poll·check=`max(Retry-After, kind cadence)`. **recovery 예외: 마지막 task_check 관측이 backpressure면 dispatch recovery_timeout의 DISPATCH_NO_RESPONSE fail++ 마감을 보류**(state-machine:115).
- **cancel/drain 매트릭스**: BLOCKED/READY(전 kind)→즉시 CANCELLED · CONDITION_CHECK WAITING_EXTERNAL→즉시 CANCELLED · **DISPATCHING TF→즉시 CANCELLED(handle 적재 무관·drain 안 함; 진행 attempt result=FAIL·error_code=null 마감)** · **RUNNING TF→drain(자연 terminal까지·실제 실패 사실대로 마감·fail++·pipeline CANCELLED 수렴)** · **늦은 response=task terminal이라 4b CAS가 차단**.
- **HANDLER_NOT_FOUND synthetic task_check 1행**: kind=CHECK·name="orchestrator.handler.resolve"·api_result=ERROR·observed=null·external_handle=null·started_at=checked_at=tick·poll_count=1·latency_ms=null·error_code=HANDLER_NOT_FOUND. active attempt(DISPATCHING/RUNNING) 있으면 result=FAIL·finished_at=tick·error_code=null 마감. fail_count 미소모.
- **RLE**: DISPATCH=호출당 1행(poll_count=1). CHECK=관측 run — partition `task_id+kind+name+external_handle`, key `(api_result,observed,error_code)` 동일→기존 run UPDATE(checked_at·poll_count++·**latency_ms=이번 폴 값 overwrite**(누적/평균 아님)), 변화→새 run INSERT. RLE는 행 표현일 뿐 fail_count 회계와 무관.
- **errorCode 저장 3분류**: ①attempt(EXECUTION_TIMEOUT·DISPATCH_NO_RESPONSE·IM_REJECTED·JOB_FAILED) ②task_check(CHECK_ERROR·**CALL_TIMEOUT=dispatch/poll/check 공통**) ③tick(TTL_EXPIRED=status 파생·행 없음 / HANDLER_NOT_FOUND=synthetic 행).
- **CONDITION_CHECK 라이프사이클**: attempt **0행**. READY→WAITING_EXTERNAL 전이 tick은 **상태+next_check_at만**(task_check 안 남김); 첫 CHECK는 WAITING_EXTERNAL self-loop에서. 모든 관측 task_check(kind=CHECK).
- **생성 계약**: ①(type,provider) recipe resolve ②task row + `pipeline_def_snapshot` **원자 생성**(한 tx) ③**23505(부분 unique 위반) catch → 기존 non-terminal 반환**(에러 아님). retry도 동일(`created=false`→RETRY_ATTEMPTED 감사).
- **조회 파생**(query 서비스): `progress{done,total}`(total=생성 시 task 행 수 고정·CANCELLED도 분모 / done=COUNT(DONE)만·분수는 RUNNING 지표·terminal은 status 권위), `latestCheck`(started_at 최대 run), `Attempt.outcome`(result+error_code 파생: OK→SUCCEEDED / FAIL∧EXECUTION_TIMEOUT→EXECUTION_TIMEOUT / FAIL∧그외(null 포함)→FAILED), `failReason`(camel DTO).

## 4. 컴포넌트 맵 (✅작성 / ☐남음)

```
domain/        ✅ enum 12 (PipelineType·PipelineStatus·TaskKind·TaskStatus·CheckKind·ApiResult·Observed·AttemptResult·ErrorCode·Severity·Actor + Outcome는 query에서)
               ✅ 엔티티 6 (Pipeline·Task·TaskAttempt·TaskCheck·PipelineEvent·PipelineDefSnapshot)
repo/          ✅ 6 repository — ☐ guarded-CAS @Modifying 전이 메서드 추가(prior-status WHERE; response 채택 가드)
handler/       ✅ PipelineHandler·TerraformJob/ConditionCheck·contexts·HandlerRegistry·UnknownHandler · DispatchOutcome/PollOutcome/CheckOutcome(Backpressure(Retry-After)/Rejected/CallTimeout 구분)
recipe/        ✅ TaskDefinition·PipelineDefinition·RecipeRegistry(boot assert)  — ☐ handler class 참조로 강화(선택)
config/        ✅ PipelineSettings(전역 기본값)·PipelineConfig(Clock)  — ☐ 런타임 DB 설정 모델
reconciler/    ✅ Leader·SingleNodeLeader
               ☐ ExternalCallExecutor (prod async / 테스트 동기)
               ☐ ExternalCalls (call-thread REQUIRES_NEW: dispatch/poll/check + 관측 RLE + response 채택 CAS + backpressure next_check_at) — 쓰기 한정: task_check·attempt.response·next_check_at만
               ☐ Reconciler (tick 핵심: due 선별·정렬·평가순서·전이(guarded)·파생·CANCELLING precedence·timeout·last_activity_at)
service/       ☐ PipelineCreationService (생성 계약 23505 원자)
               ☐ PipelineControlService (cancel CAS prior=RUNNING / retry created flag + RETRY_ATTEMPTED)
               ☐ PipelineQueryService (list/detail/task-timeline/events/latest + progress·latestCheck·outcome·failReason 파생)
               ☐ SettingsService (R5: get/put 런타임 + 감사 + frozen-vs-immediate)
               ☐ NotificationOutbox (이벤트 기록 helper) + Notifier (notified_at IS NULL 소비, at-least-once)
config/        ☐ DefaultRecipes(예시 빈)·application.yml·schema.sql(Postgres 참조 DDL: 부분 unique·jsonb·인덱스)
test/          ☐ 단위 테스트 (§6)
```

## 5. 명시적 제외 (v2 / 범위 밖)

`task_check.detail` + postCheck(O29) **+ terminal 스냅샷 관측·full terraform 로그 조회(logPointer)·redaction** · GENERAL_JOB · RECONNECT · custom recipe · scheduling/직렬화 큐 · skip-completed · 알림 라우팅 · Admin REST Controller · 실제 Postgres advisory-lock/멀티-pod `SKIP LOCKED` Notifier 분담 · 실제 IM HTTP client · pre-deploy CI 게이트(CI 영역).

## 6. 테스트 전략 (단위)

**Backbone**: TF happy(dispatch→running→done) · CONDITION_CHECK happy(→met→done) · 재시도 fail<K/==K · slot admission(slotCap) · execution timeout · TTL→EXPIRED→pipeline FAILED · backpressure 미가산.

**Fragile 상호작용 (필수 — §7 체크포인트의 테스트화)**:
1. **늦은 response CAS 가드** — task terminal 후 도착한 response는 4b CAS(0행)로 **미채택**; cancel-중-DISPATCHING은 다음 tick CANCELLED + attempt result=FAIL·error_code=null.
2. **dispatch recovery_timeout × backpressure** — null response가 recovery 초과 시 fail++ 재dispatch; 단 마지막 관측이 429/503이면 fail++ 마감 **보류**(동일 attempt).
3. **완료관측 > timeout** — 최신 poll=SUCCEEDED이면서 execution_timeout 초과여도 **DONE**(FAILED 아님).
4. **drain 실패 가산 but CANCELLED** — drain 중 JOB_FAILED → attempt error_code=JOB_FAILED·fail++ 인데 pipeline은 **CANCELLED** 수렴.
5. **same-tick 수렴** — predecessor DONE 같은 tick에 seq+1 READY 승격; 마지막 task terminal 같은 tick에 pipeline 수렴(별도 tick 지연 없음).
6. **CONDITION_CHECK 전이 tick은 task_check 미기록** — READY→WAITING_EXTERNAL은 상태+next_check_at만.
7. **HANDLER_NOT_FOUND** synthetic 행 필드 + fail_count 미소모.
8. **RLE collapse** — NOT_MET ×N=run 1행 poll_count=N; 관측 변화=새 run; latency_ms overwrite.
9. **errorCode 저장 3분류** — 각 코드가 올바른 위치(attempt/task_check/파생).
10. **생성 계약 23505→기존 반환** + retry RETRY_ATTEMPTED 감사(앱 레벨 시뮬 또는 Postgres).
11. **maxExternalCallsPerTick** — poll/check만 상한; dispatch 미적용(admission만).
12. **R5** — global 설정 즉시 / task별 frozen은 이후 run만.

## 7. 위험·정합성 체크포인트 (리뷰 집중)

1. **명시 guarded CAS ≠ @Version** — response 채택·cancel prior=RUNNING은 WHERE-predicate update. (최고 위험)
2. 단일 writer 분리(상태/fail_count=tick / 관측·response·backpressure next_check_at=call-thread REQUIRES_NEW).
3. 평가 ③완료관측 > ④timeout(fresh 재독).
4. CANCELLING precedence = 상태 기준.
5. fail_count 가산 매트릭스(TF poll 미가산 / drain 실패 가산 / HANDLER 미소모).
6. RLE partition/key + DISPATCH 호출당 1행 + latency overwrite.
7. 생성 계약 23505 원자성(부분 unique = V1).
8. due 정렬·same-tick 수렴·CONDITION_CHECK no-attempt/no-check-on-transition.
