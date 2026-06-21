# ADR-016 V1 — 구현 Todo (test-spring)

> [SCOPE.md](./SCOPE.md)(codex 100 / opus 99, 결함 0 확정)에서 도출한 구현 Todo. 이 Todo 목록을 ADR과
> 대조 리뷰(codex+opus)한 뒤 **Todo별 Agent**가 구현하고 각 Todo를 opus/codex로 리뷰한다.
> 구현·리뷰 표준 = [`.claude/skills/spring-java21`](../.claude/skills/spring-java21/SKILL.md)
> (생성자 주입·sealed/record·**명시 guarded-CAS(@Version 아님)**·테스트에 @Transactional 금지·Clean Code 13규칙).
>
> 이미 작성(✅): enum 12·엔티티 6·repo 6·handler(+example·Feign im)·recipe·settings·Leader/SingleNodeLeader.

## 의존 DAG (실행 순서)

```
T1(foundation) ─┬─► T2(recipe+생성) ─┐
                └─► T3(call-thread) ─┴─► T4(Reconciler 코어) ─┬─► T5(control+query)
                                                              └─► T6(settings+notifier+leader+alert)
                                                                          └─► T7(config+통합 빌드/테스트 green)
```
T2·T3 병렬, T5·T6 병렬. 각 Todo는 **완료 시 codex+opus 리뷰 → 결함 0까지 수정** 후 다음으로.

---

## T1 — Guarded-CAS 전이 메서드 + handler class 인덱스
**무엇**: 상태 쓰기의 토대. `@Modifying` prior-state 가드 업데이트(@Version 아님).
- repo CAS: Pipeline status CAS(예 cancel `prior=RUNNING`), Task status CAS(`WHERE status=:expected`), attempt **response 채택 CAS**(`response IS NULL AND finished_at IS NULL AND status=DISPATCHING`), fail_count++/마감, `last_activity_at` touch, `last_checked_at`+`next_check_at` 세팅. 0행=no-op 처리.
- `HandlerRegistry` class→handler 인덱스 + `keyOf(Class)`; `TaskDefinition`을 handler **class 참조**로 전환(필수).
**ADR**: orchestrator §3.1(b)·§3.2·1.3, state-machine 42/90/128, task-model 56, impl-notes 64.
**수락**: 모든 상태 전이가 명시 가드 업데이트; 0행 경로 존재; class 참조 컴파일 안전.
**테스트**: wrong-prior CAS 0행; response 채택 가드(미채택/늦은 response 차단).
**의존**: 없음(엔티티/repo 완료).

## T2 — Recipe 해석 + 생성 서비스 (생성 계약)
**무엇**: `RecipeRegistry` class-ref 해석·boot assert; `DefaultRecipes`(example 핸들러 참조); `PipelineCreationService`:
①(type,provider) resolve ②task row + `pipeline_def_snapshot` **원자 생성**(spec jsonb·write-once·task별 knobs frozen) ③**`DataIntegrityViolationException`(23505) catch → 기존 non-terminal 반환**. portable 유도컬럼 unique(non-terminal만 target 보유).
**ADR**: 결정 5/7, ADR 64-71, api §3, migrations 32/46.
**수락**: 생성 원자성; 23505→기존 반환; snapshot write-once; frozen knobs.
**테스트**: 생성; 동일 target 2회→기존 1건(`created=false`); snapshot 내용; frozen.
**의존**: T1(class 인덱스).

## T3 — ExternalCalls (call-thread) + Executor
**무엇**: `ExternalCallExecutor`(프로덕션 VT async / 테스트 동기); `ExternalCalls`(@Service, **REQUIRES_NEW**): 핸들러로 dispatch/poll/check 호출 → **task_check 관측 기록(RLE: DISPATCH 호출당 1행·CHECK run collapse·latency overwrite)** + **response 채택 CAS** + backpressure 시 `next_check_at`. **쓰기 한정: task_check·attempt.response·next_check_at만**(상태·fail_count는 tick 소유).
**ADR**: 결정 3.1/3.2/6(D-T2,4,5,7), state-machine 70/115, orchestrator 178-208/286/388.
**수락**: 단일 writer 분리(별도 빈·REQUIRES_NEW); RLE 정확; DISPATCH PENDING 선기록.
**테스트**: RLE collapse(NOT_MET×N=1행 poll_count); DISPATCH 1행; 관측 기록; response 채택; backpressure next_check_at.
**의존**: T1(CAS), 핸들러(완료).

## T4 — Reconciler (tick 코어) ★ 단일 writer, 분할 금지
**무엇**: tick 상태기계. due 선별·정렬(`next_check_at, last_checked_at NULLS FIRST, created_at, seq`); **task 평가 순서**(①CANCELLING ②handler resolve[READY+ serviceable]→미해결 즉시 FAILED+synthetic ③완료관측>timeout ④timeout ⑤일반); 전이(BLOCKED→READY 같은 tick predecessor·admit slotCap·→RUNNING·→WAITING_EXTERNAL[task_check 미기록]·→DONE·fail/재시도·EXPIRED·cancel/drain); **fail_count 가산 매트릭스**; **pipeline 파생(CANCELLING precedence 상태기준·fail_reason 출처별)**; same-tick 수렴; `last_activity_at`/`last_checked_at`/`deadline_at`. maxExternalCallsPerTick(poll/check만).
**ADR**: 결정 1.1/4/6, state-machine 전체, orchestrator §1.1/4a/4b/4c.
**수락**: §SCOPE 3 상태기계 규칙 전부; 평가순서; CANCELLING precedence; 가산 매트릭스.
**테스트**: backbone + fragile 1·3·4·5·6·7·8·9·11(SCOPE §6).
**의존**: T1, T3.

## T5 — Control + Query 서비스
**무엇**: `PipelineControlService`(cancel = 공통 전이 함수 CAS `prior=RUNNING`·멱등 no-op; retry = 새 run 또는 기존 반환 `created` + 충돌 시 `RETRY_ATTEMPTED` 감사); `PipelineQueryService`(list/detail/task-timeline/events/latest; **Pageable**·허용 sort키(lastActivityAt·startedAt)·**`[from,to)` overlap**·**latest**(non-terminal 우선); 파생 `progress{done,total}`·`latestCheck`·`Attempt.outcome`·`failReason`(camel)).
**ADR**: 결정 4c/5, api §1/§2/§0, state-machine 9-12.
**수락**: cancel CAS 멱등; retry created true/false + 감사; query 파생·의미 정확.
**테스트**: cancel 멱등(terminal no-op); retry created; fragile 14(progress·outcome·overlap·latest).
**의존**: T1, T2, T4.

## T6 — Settings(R5) + Notifier + Postgres Leader + Alert
**무엇**: `SettingsService`(런타임 DB 설정 get/put + pipeline_event 감사 + 전역 즉시/task별 frozen 구분); `NotificationOutbox`(이벤트 기록 helper) + `Notifier`(`notified_at IS NULL`을 **FOR UPDATE SKIP LOCKED** claim→스탬프·at-least-once); `PostgresAdvisoryLockLeader`(pg_try_advisory_lock 예시); alert 트리거(execution timeout 짧은 창 연속→**단일** WORKER_OUTAGE_SUSPECTED; slot 대기 임계 초과→QUEUE_WAIT_EXCEEDED).
**ADR**: R5/결정 1.3/4d, operations 8-37/43-45, orchestrator 320/606.
**수락**: 설정 즉시/frozen; outbox claim→stamp; 단일 롤업 alert.
**테스트**: 설정 apply-timing; Notifier claim(단일소비자); fragile 13(단일 WORKER_OUTAGE).
**의존**: T1, T4.

## T7 — Config + 통합 (빌드/테스트 green)
**무엇**: `application.yml`(im.base-url·pipeline.* 설정), `schema.sql`(Postgres 정본 DDL: 부분 unique `WHERE non-terminal`·jsonb·인덱스 6종) + H2 테스트 스키마(portable 유도컬럼 unique), `DefaultRecipes` 와이어링. `mvn test` **전부 green**.
**ADR**: migrations 40-48, 결정 1.2.
**수락**: 전 모듈 컴파일·전 테스트 통과; H2 테스트 DB 동작.
**의존**: T1~T6.
