# ADR-016 V1 — 구현 Todo (test-spring)

> [SCOPE.md](./SCOPE.md)(codex 100 / opus 99, 결함 0 확정)에서 도출한 구현 Todo. 이 Todo 목록을 ADR과
> 대조 리뷰(codex+opus)한 뒤 **Todo별 Agent**가 구현하고 각 Todo를 opus/codex로 리뷰한다.
> 구현·리뷰 표준 = [`.claude/skills/spring-java21`](../.claude/skills/spring-java21/SKILL.md)
> (생성자 주입·sealed/record·**명시 guarded-CAS(@Version 아님)**·테스트에 @Transactional 금지·Clean Code 13규칙).
>
> 이미 작성(✅): enum 12·엔티티 6·repo 6·handler(+example·Feign im)·recipe·settings·Leader/SingleNodeLeader.
>
> 개정: v1(codex 86 / opus 92) → **v2**: pipeline_event 발화 소유권(T1 EventRecorder 기록측·T2/T4 inline 발화·T6 소비측만), task_check prune→T4, T2(null knob→전역기본 freeze·생성 이벤트·portable unique 스키마 소유), T3(per-call deadline→CALL_TIMEOUT·§6 #8/#9 쓰기측 테스트), T4(fragile 2·synthetic만 tick task_check), T6(Notifier crash-safe 재소비·QUEUE_WAIT 출처/테스트), T5 의존 완화 반영.

## 의존 DAG (실행 순서)

```
T1(foundation) ─┬─► T2(recipe+생성) ─┐
                └─► T3(call-thread) ─┴─► T4(Reconciler 코어) ─┬─► T5(control+query)
                                                              └─► T6(settings+notifier+leader+alert)
                                                                          └─► T7(config+통합 빌드/테스트 green)
```
T2·T3 병렬, T5·T6 병렬. 각 Todo는 **완료 시 codex+opus 리뷰 → 결함 0까지 수정** 후 다음으로.

---

## T1 — Guarded-CAS 전이 메서드 + handler class 인덱스 + EventRecorder
**무엇**: 상태 쓰기의 토대. `@Modifying` prior-state 가드 업데이트(@Version 아님).
- repo CAS: Pipeline status CAS(예 cancel `prior=RUNNING`), Task status CAS(`WHERE status=:expected`), attempt **response 채택 CAS**(`response IS NULL AND finished_at IS NULL AND status=DISPATCHING`), fail_count++/마감, `last_activity_at` touch(매 전이), `last_checked_at`+(일반)`next_check_at` 세팅. 0행=no-op 처리.
- `HandlerRegistry` class→handler 인덱스 + `keyOf(Class)`; `TaskDefinition`을 handler **class 참조**로 전환(필수).
- **`EventRecorder`(outbox 기록측)**: `pipeline_event` append-only insert(type·severity·payload·actor·created_at·notified_at=null) — **T2(생성)·T4(전이)가 같은 tx에서 사용**. 소비(Notifier loop)는 T6.
**ADR**: orchestrator §3.1(b)·§3.2·1.3, state-machine 42/90/94-95/128, orchestrator 123-125, task-model 56, impl-notes 64.
**수락**: 모든 상태 전이가 명시 가드 업데이트; 0행 경로 존재; class 참조 컴파일 안전; 이벤트 기록 helper 존재.
**테스트**: wrong-prior CAS 0행; response 채택 가드(미채택/늦은 response 차단).
**의존**: 없음(엔티티/repo 완료).

## T2 — Recipe 해석 + 생성 서비스 (생성 계약)
**무엇**: `RecipeRegistry` class-ref 해석·boot assert; `DefaultRecipes`(example 핸들러 참조); `PipelineCreationService`:
①(type,provider) resolve ②task row + `pipeline_def_snapshot` **원자 생성**(spec jsonb·write-once·task별 knobs frozen — **null knob은 freeze 시 전역 기본값(PipelineSettings)으로 해석**, api §4) + **생성 `pipeline_event`(triggeredBy actor) 발화**(EventRecorder) ③**`DataIntegrityViolationException`(23505) catch → 기존 non-terminal 반환**. **portable 유도컬럼 unique DDL/H2 테스트 스키마를 T2가 소유**(non-terminal만 target 보유 → 충돌 시 위반).
**ADR**: 결정 5/7, ADR 64-71, api §3·§4(117), migrations 32/46.
**수락**: 생성 원자성; null knob→전역 기본값 freeze; 생성 이벤트; 23505→기존 반환; snapshot write-once.
**테스트**: 생성 + 생성 이벤트; 동일 target 2회→**실 DataIntegrityViolation→기존 1건**; snapshot 내용; frozen(null→기본값).
**의존**: T1(class 인덱스·EventRecorder).

## T3 — ExternalCalls (call-thread) + Executor
**무엇**: `ExternalCallExecutor`(프로덕션 VT async / 테스트 동기); `ExternalCalls`(@Service, **REQUIRES_NEW**): 핸들러로 dispatch/poll/check 호출 → **task_check 관측 기록(RLE: DISPATCH 호출당 1행·CHECK run collapse·latency overwrite)** + **response 채택 CAS** + backpressure 시 `next_check_at`. **per-call deadline(D-T1·D-T3 전역+TaskKind) 만료 = `CALL_TIMEOUT` 관측**(호출 1회 실패이지 task/attempt 직접 실패 아님). **쓰기 한정: task_check·attempt.response·backpressure next_check_at만**(상태·fail_count·일반 next_check_at은 tick 소유).
**ADR**: 결정 3.1/3.2/6(D-T1,2,3,4,5,7), api §0(29), state-machine 70/115, orchestrator 178-208/286/388/521.
**수락**: 단일 writer 분리(별도 빈·REQUIRES_NEW); RLE 정확; DISPATCH PENDING 선기록; CALL_TIMEOUT 관측 매핑.
**테스트**: RLE collapse(NOT_MET×N=1행 poll_count) + **latency_ms overwrite(§6 #8)**; DISPATCH 1행; **errorCode 저장위치(task_check: CHECK_ERROR/CALL_TIMEOUT — §6 #9 쓰기측)**; response 채택; backpressure next_check_at; CALL_TIMEOUT 관측.
**의존**: T1(CAS), 핸들러(완료).

## T4 — Reconciler (tick 코어) ★ 단일 writer, 분할 금지
**무엇**: tick 상태기계. due 선별·정렬(`next_check_at, last_checked_at NULLS FIRST, created_at, seq`); **task 평가 순서**(①CANCELLING ②handler resolve[READY+ serviceable]→미해결 즉시 FAILED+**synthetic task_check 1행(tick이 쓰는 유일한 task_check)**) ③완료관측>timeout ④timeout ⑤일반); 전이(BLOCKED→READY 같은 tick predecessor·admit slotCap·→RUNNING·→WAITING_EXTERNAL[task_check 미기록]·→DONE·fail/재시도·EXPIRED·cancel/drain); **fail_count 가산 매트릭스**; **전이마다 `pipeline_event` inline 발화(EventRecorder·같은 tick tx)**; **pipeline 파생(CANCELLING precedence 상태기준·fail_reason 출처별)**; same-tick 수렴; `last_activity_at`/`last_checked_at`/(일반)`next_check_at`/`deadline_at`; **task_check retention prune(기본 90d)**. maxExternalCallsPerTick(poll/check만).
**ADR**: 결정 1.1/4/6/1.3, state-machine 전체, orchestrator §1.1/1.3(281,313)/4a/4b/4c.
**수락**: §SCOPE 3 상태기계 규칙 전부; 평가순서; CANCELLING precedence; 가산 매트릭스; 전이 이벤트 발화; prune.
**테스트**: backbone + fragile 1·**2**·3·4·5·6·7·9·11(§6) + 전이 이벤트 발화 검증. (#8 latency/RLE·#9 task_check 쓰기측 = T3 공동소유.)
**의존**: T1, T3.

## T5 — Control + Query 서비스
**무엇**: `PipelineControlService`(cancel = 공통 전이 함수 CAS `prior=RUNNING`·멱등 no-op; retry = 새 run 또는 기존 반환 `created` + 충돌 시 `RETRY_ATTEMPTED` 감사); `PipelineQueryService`(list/detail/task-timeline/events/latest; **Pageable**·허용 sort키(lastActivityAt·startedAt)·**`[from,to)` overlap**·**latest**(non-terminal 우선); 파생 `progress{done,total}`·`latestCheck`·`Attempt.outcome`·`failReason`(camel)).
**ADR**: 결정 4c/5, api §1/§2/§0, state-machine 9-12.
**수락**: cancel CAS 멱등; retry created true/false + 감사(created=true는 생성 이벤트(T2)·created=false는 RETRY_ATTEMPTED); query 파생·의미 정확.
**테스트**: cancel 멱등(terminal no-op); retry created(true/false) + RETRY_ATTEMPTED(§6 #10 충돌측); fragile 14(progress·outcome·overlap·latest).
**의존**: T1(cancel)·T2(retry)·T4(통합) — query 파생은 repo fixture로 선행 가능(최종 통합은 T4 후).

## T6 — Settings(R5) + Notifier + Postgres Leader + Alert
**무엇**: `SettingsService`(런타임 DB 설정 get/put + pipeline_event 감사 + 전역 즉시/task별 frozen 구분); **`Notifier`(소비측만: `notified_at IS NULL`을 FOR UPDATE SKIP LOCKED claim→스탬프 — at-least-once·crash-safe 재소비; 기록측 EventRecorder는 T1)**; `PostgresAdvisoryLockLeader`(pg_try_advisory_lock 예시); **alert 트리거**: execution timeout 짧은 창 연속→**단일** WORKER_OUTAGE_SUSPECTED(pipeline_event 스캔 파생); slot 대기 임계 초과→QUEUE_WAIT_EXCEEDED(**live READY∧TF dwell 질의 파생**).
**ADR**: R5/결정 1.3/4d, operations 8-37/43-45, orchestrator 318-321/606.
**수락**: 설정 즉시/frozen; Notifier claim→stamp·crash(미스탬프) 재소비; **단일** 롤업 + queue-wait alert.
**테스트**: 설정 apply-timing(즉시/이후 run); Notifier claim→stamp + crash 재소비(단일소비자); fragile 13(**단일** WORKER_OUTAGE_SUSPECTED **+ QUEUE_WAIT_EXCEEDED**).
**의존**: T1, T4.

## T7 — Config + 통합 (빌드/테스트 green)
**무엇**: `application.yml`(im.base-url·pipeline.* 설정), `schema.sql`(**Postgres 정본** DDL: 부분 unique `WHERE non-terminal`·jsonb·인덱스 6종·retention) — H2 portable 유도컬럼 unique 테스트 스키마는 **T2 소유**. `DefaultRecipes` 와이어링. `mvn test` **전부 green**. (task_check prune 동작=T4.)
**ADR**: migrations 40-48, 결정 1.2.
**수락**: 전 모듈 컴파일·전 테스트 통과; H2 테스트 DB 동작.
**의존**: T1~T6.
