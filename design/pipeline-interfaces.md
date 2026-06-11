# 설치/삭제 파이프라인 — 구현 Interface 명세 (ADR-016 부속)

> 상태: **Draft** (2026-06-12)
> 관련 문서: `docs/adr/016-install-pipeline-orchestration.md` (런타임 아키텍처), `design/admin-page-requirements.md` §4.4 (모델)
> 목적: ADR-016의 결정(D1~D13)을 **코드에서 구현해야 하는 Java Interface**와 **Admin REST API**로 구체화한다.
> 각 인터페이스마다 "왜 이렇게 정의했는지 / 어떤 부분에서 좋은지"를 함께 기록한다.
> §5는 Pipeline 취소의 상세 동시성 분석이다.

---

## 1. 인터페이스가 지켜야 할 4가지 불변식

모든 인터페이스 시그니처는 아래 불변식을 코드 레벨에서 강제하기 위한 형태로 설계됐다.
구현자가 이 불변식을 깨면 ADR-016의 장애 안전성(D12)이 무너진다.

| # | 불변식 | 근거 (ADR) |
|---|--------|-----------|
| I1 | **모든 상태 전이는 CAS** — 기대 상태를 함께 전달하고, 불일치면 0행 갱신(false)으로 끝난다. 예외가 아니다 | R1, D12 |
| I2 | **1 호출 = 1 관측** — 어댑터 메서드는 절대 내부에서 sleep/polling 루프를 돌지 않는다. 기다림은 reconciler의 다음 tick이 담당한다 | D3, D11 |
| I3 | **모든 외부 부수효과는 반복 안전** — dispatch 재호출은 TerraformWorker dedup으로 수렴, 관측은 읽기, post-check는 read-only | D5, R6 |
| I4 | **쓰기 의도(intent)와 실행의 분리** — API 핸들러는 DB에 의도만 기록하고, 외부 호출은 오직 reconciler가 수행한다 | R2 |

---

## 2. 도메인 타입

```java
/** Pipeline 1회 실행의 상태. CANCELLING은 §5에서 도입하는 드레인(drain) 상태다. */
public enum PipelineStatus {
    QUEUED,      // 생성됨, 아직 첫 task 시작 전
    RUNNING,     // 진행 중
    CANCELLING,  // 취소 요청 수락됨 — 새 작업은 막혔고, 진행 중 TF job의 종료만 대기 (§5)
    DONE, FAILED, CANCELLED  // 종결 상태
}

/** Task 내부 상태. UI 표시는 ADR-016 D2의 매핑표를 따른다 (BLOCKED/READY/WAITING_SLOT → "대기" 등) */
public enum TaskStatus {
    BLOCKED,           // 선행 task 미완
    READY,             // 실행 가능
    WAITING_SLOT,      // TF 슬롯 대기 (FIFO 순번 보유)
    DISPATCHING,       // 실행 API 호출 중 또는 호출 직후 job_id 미기록 (D5 복구 구간)
    RUNNING,           // job_id 보유, 종결 관측 대기
    WAITING_EXTERNAL,  // 외부 액션 대기 (확인주기마다 관측)
    DONE, FAILED, EXPIRED, CANCELLED  // 종결 상태
}

public enum TaskKind { EXECUTE, WAIT_EXTERNAL }

/** task_check.kind — 관측 1회의 종류 */
public enum CheckKind { JOB_POLL, CONDITION_CHECK, POST_CHECK }

/** 실패 분류 체계 (R-AI2). 알림 라우팅·자동 재시도 판단·AI 진단의 공통 어휘 */
public enum ErrorCode {
    TRANSIENT_INFRA, AUTH, QUOTA, TF_ERROR,
    CALL_TIMEOUT,       // API 호출 자체가 deadline 초과 (D11)
    EXECUTION_TIMEOUT,  // job이 execution_timeout 내 종결되지 않음 (D11)
    WORKER_OUTAGE,      // 브레이커 OPEN 중 발생한 시스템성 실패 — fail_count 미소모 (D13)
    EXTERNAL_NOT_READY, UNKNOWN
}

public enum Actor { HUMAN, SYSTEM, AI }   // 모든 이벤트·트리거에 기록 (R-AI3)
```

> **왜 enum을 이렇게 쪼갰나**: `CALL_TIMEOUT`/`EXECUTION_TIMEOUT`/`WORKER_OUTAGE`를 한 덩어리
> `TIMEOUT`으로 두면 "이슈 조회" 시 어떤 계층이 터졌는지 로그를 뒤져야 한다. 코드(enum)로 분리해두면
> 이력 화면·알림 라우팅·향후 AI 진단이 같은 어휘로 동작한다.

### 2.1 파이프라인 정의 (코드 소유, 버전 스냅샷)

```java
/**
 * Provider×유형별 Task DAG 정의. DB가 아니라 코드에 존재한다 (리뷰 가능, 버전 관리).
 * Pipeline 생성 시 definitionVersion이 스냅샷되어, 정의가 바뀌어도 진행 중 run은 영향받지 않는다 (D2).
 */
public interface PipelineDefinitionRegistry {
    PipelineDefinition resolve(Provider provider, PipelineType type);   // 최신 버전
    PipelineDefinition byVersion(String definitionVersion);             // 과거 run 렌더링용
}

public record PipelineDefinition(
    String version,
    Provider provider,
    PipelineType type,                  // INSTALL | DELETE
    List<TaskDefinition> tasks          // 엄격 순차 (결정 #14) — 순서가 곧 실행 순서
) {}

public record TaskDefinition(
    String name,                        // 예: "BDC Common TF"
    TaskKind kind,
    Duration defaultPollingInterval,    // WAIT_EXTERNAL 확인주기 (≥10분 가드)
    Duration defaultTtl,                // WAIT_EXTERNAL 최대 체류시간
    int defaultMaxFailCount,            // EXECUTE TF=1, 확인성=무한 (결정 #12)
    Duration executionTimeout,          // EXECUTE 한정, 기본 30분 (D11)
    List<PostCheckDefinition> postChecks // 0..N개 best-effort 확인 호출 (D3)
) {}

public record PostCheckDefinition(
    String name,                        // 예: "terraform-log"
    Duration callTimeout                // 기본 60초, 1회 실행, 재시도 없음
) {}
```

---

## 3. 핵심 인터페이스

### 3.1 `TransitionService` — 모든 상태 변경의 단일 관문 (R1)

```java
/**
 * 상태 전이의 유일한 통로. 이 인터페이스를 우회한 status 직접 UPDATE는 금지다 (R1).
 *
 * 계약:
 *  - expected(기대 상태)와 현재 DB 상태가 다르면 아무것도 바꾸지 않고 false를 반환한다.
 *    동시성 경쟁에서 "지는 것"은 정상 경로이므로 예외를 던지지 않는다 (D12).
 *  - 전이 성공 시 같은 트랜잭션 안에서 pipeline_event를 함께 INSERT한다 (outbox, D7).
 *  - 전이표(유효한 전이 목록)에 없는 조합은 IllegalTransitionException — 이것은 버그다.
 */
public interface TransitionService {

    boolean transitionTask(TaskId taskId,
                           TaskStatus expected,
                           TaskStatus next,
                           TransitionDetail detail);

    boolean transitionPipeline(PipelineId pipelineId,
                               PipelineStatus expected,
                               PipelineStatus next,
                               TransitionDetail detail);
}

/** 전이에 따라 함께 기록할 정보 — 이벤트 payload와 감사 필드의 원천 */
public record TransitionDetail(
    Actor actor,
    ErrorCode errorCode,        // 실패 전이일 때만
    String reason,              // 사람이 읽는 한 줄
    Map<String, Object> payload // 이벤트에 실릴 추가 데이터 (job_id 등)
) {}
```

> **왜 boolean 반환인가**: CAS 실패(=다른 writer가 먼저 전이시킴)는 멀티 Pod·중복 리더 상황의
> **정상 동작**이다(D12). 예외로 모델링하면 호출부마다 try-catch 노이즈가 생기고, "전이 경쟁에서
> 졌으면 그냥 다음 tick에 다시 본다"는 reconciler의 기본 동작과 어긋난다.
> **좋은 점**: 이 인터페이스 하나만 리뷰하면 ADR의 R1(전이표 검증·이벤트 동시 기록·CAS)이 전부
> 지켜지는지 확인할 수 있다. 정확성의 anchor가 코드 한 곳에 모인다.

### 3.2 `TaskExecution` — Task 1종의 외부 실행 어댑터 (D3)

```java
/**
 * Provider×Task 1종의 외부 실행을 추상화한다. 구현체 예: AwsSvcTfExecution, AzurePeApprovalWait.
 *
 * 계약 (불변식 I2):
 *  - dispatch()와 observe()는 절대 블로킹 대기하지 않는다. 1 호출 = 1 외부 API 호출.
 *  - 모든 외부 호출은 per-call deadline을 갖는다 (D11). 초과 시 ExternalCallException(CALL_TIMEOUT).
 *  - observe()는 멱등한 읽기여야 한다 — 같은 상태에서 두 번 불려도 부작용이 없다 (I3).
 */
public interface TaskExecution {

    /** 이 구현체가 담당하는 (provider, taskName) — reconciler가 registry에서 찾는 키 */
    TaskKey supports();

    /**
     * 실행 시작. EXECUTE task에서만 의미가 있다.
     * - Terraform 계열: Infra Manager 실행 API를 호출하고 JobIssued(job_id)를 반환
     * - job_id가 없는 실행(동기 API 등): NoJob을 반환 → 이후 완료는 observe()의 조건 판정
     */
    DispatchResult dispatch(TaskContext ctx) throws ExternalCallException;

    /**
     * 완료 관측 1회.
     * - RUNNING(job_id 보유): job 상태 폴링 결과를 변환해 반환
     * - WAIT_EXTERNAL / NoJob: 조건 확인 API를 호출해 충족 여부 반환
     * 반환값은 reconciler가 task_check 1행으로 기록한다 (D6).
     */
    Observation observe(TaskContext ctx) throws ExternalCallException;

    /** task 완료 후 실행할 best-effort 확인 호출 (D3). 기본은 없음 */
    default List<PostCheckCall> postChecks() { return List.of(); }
}

/** dispatch 결과 — sealed라 분기 누락을 컴파일러가 잡는다 */
public sealed interface DispatchResult {
    record JobIssued(String terraformJobId) implements DispatchResult {}
    record NoJob() implements DispatchResult {}
}

/** 관측 1회의 결과 — "API 호출 성공 여부"와 "관측 내용"을 분리해서 표현한다 */
public sealed interface Observation {
    record StillRunning(Optional<Instant> pickedUpAt) implements Observation {} // pickedUpAt: O7 (브레이커 신호)
    record Succeeded(Map<String, Object> output)      implements Observation {}
    record Failed(ErrorCode code, String detail)      implements Observation {}
    record ConditionMet()                             implements Observation {}
    record ConditionNotYet()                          implements Observation {} // 실패 아님 — fail_count 미소모 (§4.4.3)
}

/** post-check 1건 — read-only 계약. 실패해도 사유만 남기고 끝 (D3) */
public interface PostCheckCall {
    String name();
    /** 반환값은 task_check.detail(jsonb)에 발췌/참조로 저장된다. 예: Terraform log 포인터 */
    PostCheckResult run(TaskContext ctx) throws ExternalCallException;
}
```

> **왜 sealed interface인가**: `Observation`의 다섯 케이스는 각각 reconciler의 전이가 다르다
> (Succeeded→DONE, NotYet→next_check_at 갱신, Failed→fail_count++ ...). sealed + switch
> pattern matching이면 새 케이스 추가 시 모든 분기 누락을 컴파일 타임에 잡는다.
> **왜 dispatch/observe 분리인가**: "실행시키고, 결과의 job_id를 폴링하고, 없으면 조건으로 판단"
> 이라는 파이프라인의 실제 동작(ADR Context)을 그대로 두 메서드로 옮긴 것이다. 구현체는 HTTP 호출
> 변환만 책임지고, 상태 기계·재시도·타임아웃 판단은 전부 reconciler 한 곳에 남는다 — 새 provider
> task 추가가 "어댑터 1개 구현"으로 끝난다.

### 3.3 `InfraManagerPort` — 외부 시스템 경계 (Hexagonal Port)

```java
/**
 * Infra Manager와의 유일한 통신 창구. TaskExecution 구현체는 이 Port만 사용한다.
 *
 * 계약:
 *  - 모든 메서드는 per-call deadline을 내장한다 (D11). 초과 시 ExternalCallException(CALL_TIMEOUT).
 *  - runTerraformJob은 at-least-once로 불릴 수 있다 — 같은 작업의 재호출은
 *    TerraformWorker가 단일 실행으로 수렴시킨다는 플랫폼 보장에 기댄다 (D5, I3).
 */
public interface InfraManagerPort {

    /** Terraform job 실행 요청. 응답의 job_id는 서버 발급 — 재호출 시 새 id가 나올 수 있다 (D5) */
    TerraformJobHandle runTerraformJob(TerraformJobRequest request) throws ExternalCallException;

    /** job 현재 상태 + 내부 task 목록 (드릴다운 UI용 미러) */
    TerraformJobSnapshot getJob(String terraformJobId) throws ExternalCallException;

    /** post-check용 — Terraform 실행 로그 조회 (지원하지 않으면 empty) */
    Optional<TerraformLogRef> fetchJobLog(String terraformJobId) throws ExternalCallException;

    /** O7 — worker 헬스 엔드포인트가 생기면 canary 대신 사용 (D13). 미지원이면 empty */
    Optional<WorkerHealth> workerHealth();
}

public record TerraformJobSnapshot(
    String jobId,
    JobPhase phase,                     // QUEUED | RUNNING | SUCCEEDED | FAILED — QUEUED 구분은 O7
    Optional<Instant> pickedUpAt,       // worker가 pubsub에서 집어간 시각 (브레이커 1차 신호)
    List<JobTaskSnapshot> tasks,        // job 내부 task들 (read-only 미러)
    Optional<JobError> error
) {}
```

> **왜 Port로 분리하나**: ① 단위 테스트에서 Infra Manager를 Fake로 갈아끼우고 크래시·타임아웃
> 시나리오(D12 표의 7가지)를 재현할 수 있다. ② pubsub·인증 같은 통신 세부가 어댑터 뒤로 숨는다.
> ③ `workerHealth()`/`pickedUpAt`을 Optional로 선언해 **O7이 미해결이어도 컴파일되는 코드**를
> 만든다 — 플랫폼이 기능을 추가하면 구현체만 바뀐다.

### 3.4 `SlotScheduler` + `TerraformWorkerCircuitBreaker` — N 제약과 전면 장애 (D4, D13)

```java
/**
 * TF 동시 실행 N 제약의 집행자.
 *
 * 계약:
 *  - runningTerraformCount()는 반드시 DB 파생값(count where status in DISPATCHING,RUNNING)이다.
 *    저장형 카운터 금지 — 크래시 시 누수가 없어야 한다 (D12).
 *  - admit()은 브레이커가 허용할 때만, FIFO(ready 시각순)로, (N - 점유) 건을 DISPATCHING으로
 *    전이시킨다. 전이는 TransitionService CAS 경유 — 같은 트랜잭션에서 pipeline이
 *    RUNNING(취소 아님)인지 재확인한다 (§5 Race-3).
 */
public interface SlotScheduler {
    int runningTerraformCount();                  // 취소 드레인 중인 task도 포함된다 (§5.3)
    List<TaskId> admit(Instant now, int limit);   // 이번 tick에 dispatch할 task 선정
}

/**
 * TerraformWorker 전면 장애 대비 서킷 브레이커 (D13).
 * 목표: 관리자 무개입 — 감지·중지·복구가 모두 자동이다.
 */
public interface TerraformWorkerCircuitBreaker {
    BreakerState state();                          // CLOSED | OPEN | HALF_OPEN

    /** 이번 tick에 dispatch 허용 여부. OPEN이면 false, HALF_OPEN이면 canary 1건만 true */
    boolean allowDispatch();

    /** 관측 신호 유입 — pickup 확인(1차 신호) 또는 EXECUTION_TIMEOUT(fallback 신호) */
    void onJobPickedUp(String jobId, Instant pickedUpAt);
    void onSystemicTimeout(TaskId taskId, Instant at);

    /** OPEN 중 타임아웃이 난 task의 처리 방침 — WORKER_OUTAGE로 기록하고 fail_count 미소모 재큐 */
    boolean reclassifyAsOutage(TaskId taskId);
}
```

> **왜 카운터가 아니라 파생값인가**: 세마포어를 메모리나 별도 카운터 행으로 들고 있으면 "획득 후
> 크래시"가 곧 슬롯 누수다. `count(status)`는 상태 그 자체에서 파생되므로 **누수가 원리적으로
> 불가능**하다. 취소 드레인 중인 task가 자동으로 N에 포함되는 것도(§5.3) 이 설계의 공짜 이점이다.
> **왜 브레이커를 별도 인터페이스로 두나**: 감지 신호(pickup vs timeout-연쇄)가 O7 답변에 따라
> 바뀐다. SlotScheduler는 `allowDispatch()`만 알면 되므로, 신호 전략 교체가 브레이커 구현체
> 교체로 끝난다.

### 3.5 `Reconciler` + `LeaderElector` — 단일 작성자 루프 (D1, D12)

```java
/**
 * 30초 tick의 본체. 외부 호출(R2)과 슬롯 회계의 유일한 수행자다.
 *
 * 계약:
 *  - tick()은 due 작업만 처리한다 (next_check_at <= now, deadline 경과, 미처리 intent).
 *  - 모든 외부 호출은 per-call deadline + 제한된 병렬도로 수행 — 한 번의 tick의 최악
 *    소요시간이 유한해야 한다 (D11).
 *  - 각 task의 전이는 독립 트랜잭션 — tick 중간 크래시는 "일부만 커밋"으로 끝나고
 *    다음 tick이 이어받는다 (D12).
 */
public interface Reconciler {
    TickReport tick(Instant now);
}

/** 관측용 — tick 1회가 무엇을 했는지. 메트릭/로그의 원천 (R-AI5) */
public record TickReport(
    int dispatched, int polled, int conditionChecked, int postChecked,
    int timedOut, int requeuedByBreaker, int eventsEmitted, Duration elapsed
) {}

/**
 * 멀티 Pod에서 tick 실행권 조정 (D12).
 * 계약: advisory lock을 "획득 → tick 실행 → 해제"가 한 세션에서 일어나야 한다.
 * 락 획득 실패는 정상(다른 Pod가 리더) — 조용히 skip한다.
 * 정확성은 락에 의존하지 않는다(R6) — 락은 중복 작업 방지용 효율 장치다.
 */
public interface LeaderElector {
    boolean tryRunAsLeader(Runnable tickBody);
}
```

> **왜 tick이 due-driven인가**: "다음에 볼 시각"(next_check_at, deadline_at)을 전부 DB 컬럼으로
> 두면 tick은 단순 조회+처리가 되고, **BFF가 몇 시간 죽어도 재기동 첫 tick이 밀린 일을 자연스럽게
> 흡수**한다(D12 장시간 다운 행). 인메모리 타이머·스케줄 큐가 없으므로 잃어버릴 것도 없다.

### 3.6 `PipelineCommandService` — UI/API가 호출하는 쓰기 의도 (R2, I4)

```java
/**
 * Admin API 핸들러가 호출하는 유일한 쓰기 진입점. 모든 메서드는 DB에 의도/전이만 기록하고
 * 외부 시스템을 호출하지 않는다 — 실행은 다음 tick의 reconciler가 담당한다 (R2).
 * 어느 Pod에서 처리돼도 동일하다 (무상태, D12).
 */
public interface PipelineCommandService {

    /** 설치/삭제 시작. 동일 target에 진행 중 pipeline이 있으면 거부 (§4.4.4 중복 방지) */
    PipelineId start(TargetSourceId target, PipelineType type, Actor actor)
        throws DuplicateActivePipelineException;

    /**
     * 취소 요청 — 비동기 의미론 (§5).
     * 반환값으로 호출자가 "즉시 끝났는지 / 드레인 대기인지"를 안다. 멱등: 재호출해도 같은 결과.
     */
    CancelOutcome requestCancel(PipelineId id, Actor actor, String reason);

    /** FAILED pipeline 재시도 — 실패 task의 fail_count/타이머 리셋 후 재개 (§4.4.4) */
    void retry(PipelineId id, Actor actor);

    /** [지금 확인] — 해당 task의 next_check_at을 now로 당긴다. rate-limit + 감사 기록 (D8) */
    void forceCheck(TaskId id, Actor actor);

    /** 브레이커 수동 개입 (escape hatch, 감사 기록) — 기본 운영은 자동 (D13) */
    void forceDispatchPause(Actor actor);
    void forceDispatchResume(Actor actor);
}

/** 취소 요청의 3가지 결과 — API 응답에 그대로 매핑된다 (§6 cancel API) */
public enum CancelOutcome {
    CANCELLED_IMMEDIATE,   // 실행 중 TF job 없음 → 즉시 CANCELLED
    CANCELLING_DRAINING,   // 실행 중 TF job 있음 → CANCELLING, 종료 대기 (slot 점유 유지)
    ALREADY_TERMINAL       // 이미 DONE/FAILED/CANCELLED — 아무 일도 안 함
}
```

> **왜 CancelOutcome을 enum으로 노출하나**: 취소가 비동기(드레인)일 수 있다는 사실을 **타입으로
> 강제 전달**한다. UI는 이 값으로 "중단됨" vs "중단 중 — 실행 중 job 종료 대기"를 즉시 구분해
> 그릴 수 있고, 호출자가 "취소했는데 왜 아직 RUNNING이냐"는 혼란을 갖지 않는다.

### 3.7 `EventOutboxRepository` + `NotificationChannel` — 알림 (D7)

```java
/**
 * 알림의 유일한 원천 = pipeline_event (전이와 같은 트랜잭션에서 INSERT됨).
 * 계약: claim은 FOR UPDATE SKIP LOCKED — N개 Pod의 notifier가 리더 없이 작업을 나눠 가진다 (D12).
 */
public interface EventOutboxRepository {
    List<PipelineEvent> claimUnnotified(int limit);   // SKIP LOCKED
    void markNotified(Collection<EventId> ids);
}

/**
 * 채널 어댑터 — v1은 InAppChannel 하나. Slack/Email은 이 인터페이스 구현체 추가로 끝난다 (D7).
 * 계약: send는 at-least-once로 불릴 수 있다 — 푸시 채널은 드문 중복을 감수하고,
 * 인앱은 event 행 자체를 렌더링하므로 중복이 원리적으로 없다.
 */
public interface NotificationChannel {
    ChannelType type();
    boolean accepts(PipelineEvent event);             // 라우팅 규칙 (severity/유형)
    void send(PipelineEvent event) throws NotificationDeliveryException;
}
```

### 3.8 `PipelineQueryService` — 이력/조회 (D6) · `RuntimeSettings` (R5)

```java
/** 읽기 전용 조회 — Admin API GET 핸들러와 1:1 대응. 어느 Pod에서나 처리 가능 */
public interface PipelineQueryService {

    /** 보드+이력 통합 조회. 기간 필터는 overlap 의미론 (D6) */
    Page<PipelineSummary> search(PipelineSearchCriteria c, Cursor cursor);

    PipelineDetail get(PipelineId id);                       // run 상세 + task 상태

    /** task 1개의 attempt + check 병합 타임라인 — 이슈 조사 표면 (D6) */
    Page<TaskHistoryEntry> taskHistory(PipelineId p, TaskId t, Cursor cursor);

    /** TF 요청 큐 현황 — 슬롯 게이지·대기열·드레인·브레이커 (§6 queue API) */
    QueueSnapshot queueSnapshot();

    /** target 1개의 실행 이력 요약 (마지막 설치/삭제 + run 목록) */
    TargetPipelineHistory targetHistory(TargetSourceId id, Cursor cursor);
}

/** DB 보관 런타임 설정 (R5) — env var 금지, 변경은 감사 이벤트를 남긴다 */
public interface RuntimeSettings {
    int maxConcurrentTerraformJobs();      // N, 기본 10
    Duration jobPollInterval();            // 30~60초 (R3 — ≥10분 가드 비적용)
    Duration defaultExecutionTimeout();    // 30분
    Duration httpCallDeadline();           // 30초
    Duration postCheckDeadline();          // 60초
    Duration dispatchRecoveryAge();        // 5분 (D5)
    Duration breakerPickupWindow();        // 5분 (D13)
    Duration breakerProbeInterval();       // 5분 (D13)
    Duration taskCheckRetention();         // 90일 (D6)
}
```

---

## 4. Reconciler tick 의사코드 — 인터페이스 조립 순서

```
tick(now):
  leaderElector.tryRunAsLeader(() -> {
    1. 취소 intent 처리        — CANCELLING 전파, pre-dispatch task들 CANCELLED (§5)
    2. due 관측                — RUNNING(jobPollInterval 경과) → execution.observe()
                                 WAITING_EXTERNAL(next_check_at 경과) → execution.observe()
                                 결과를 task_check 기록 + CAS 전이
    3. 타임아웃 판정            — fresh read 이후에만 (D12). 브레이커 OPEN이면 WORKER_OUTAGE 재큐
    4. 선행 완료 전파           — BLOCKED → READY (pipeline RUNNING일 때만)
    5. 슬롯 admit               — breaker.allowDispatch() && slotScheduler.admit() → dispatch
    6. dispatch 복구            — DISPATCHING 5분 초과 + job_id 없음 → 재호출 (D5)
    7. post-check 실행          — DONE인데 미실행 post-check가 있는 task (best-effort)
    8. 보존 정리                — task_check retention 초과분 삭제
  })
  // notifier는 리더와 무관하게 모든 Pod에서: outbox.claimUnnotified() → channels
```

---

## 5. Pipeline 취소 — 구현 가능성과 동시성 분석

질문: *"TF Job은 즉각 취소가 안 되고 task 종료를 기다려야 하는데, 동시성 문제가 있어도 취소가
잘 되는가? 취소된 task라도 N 제약은 유효하고 TerraformWorker는 취소를 못 하는데?"*

**답: 구현 가능하다.** 단, "취소 = 즉시 정지"가 아니라 **"취소 = 전진 차단 + 드레인"**으로
정의해야 하고, 그 경계를 상태 기계에 명시해야 한다. 아래가 그 정의다.

### 5.1 핵심 규칙 — 취소는 forward 엣지만 차단한다

```
forward 엣지 (CANCELLING이 차단)            drain 엣지 (취소와 무관하게 항상 허용)
──────────────────────────────             ──────────────────────────────────────
BLOCKED → READY                            DISPATCHING → RUNNING   (job_id 기록 — 현실의 관측)
READY → WAITING_SLOT / WAITING_EXTERNAL    RUNNING → DONE/FAILED   (job 종결 관측)
WAITING_SLOT → DISPATCHING (admit)         RUNNING → FAILED(EXECUTION_TIMEOUT)
FAILED → 재시도 dispatch                    post-check 실행 (read-only)
```

- 취소 요청은 `pipeline RUNNING → CANCELLING` CAS 전이 하나로 수락된다 (intent, I4).
- **pre-dispatch 상태**(BLOCKED/READY/WAITING_SLOT/WAITING_EXTERNAL)의 task: 외부에 아무것도
  나가지 않았으므로 즉시 `CANCELLED`. WAITING_SLOT이면 큐에서 빠진다.
- **DISPATCHING/RUNNING** task: TerraformWorker가 취소를 못 하므로 건드리지 않는다.
  reconciler는 평소처럼 관측을 계속하고(드레인), job이 종결(또는 execution_timeout)되면
  그 결과를 attempt에 기록한 뒤 — **후행 task로 전진하는 대신** — pipeline을 `CANCELLED`로
  종결한다.

### 5.2 상태 흐름

```
                          취소 요청 (CAS: RUNNING→CANCELLING)
                                        │
 QUEUED ──→ RUNNING ────────────────────▼────────────────────┐
              │                    CANCELLING                 │
              │                    │        │                 │
              │      실행 중 TF job 없음   실행 중 TF job 있음  │
              │              │                  │ (드레인:     │
              ▼              ▼                  ▼  슬롯 점유)   │
        DONE / FAILED    CANCELLED   job 종결/timeout → CANCELLED
```

UI 매핑: `CANCELLING` = "중단 중 · 실행 중 job 종료 대기", `CANCELLED` = "중단됨".

### 5.3 N 제약과의 상호작용 — 드레인 task는 슬롯을 계속 점유한다

슬롯 수가 **저장 카운터가 아니라 파생값**(`count(status in DISPATCHING,RUNNING)`)이므로,
취소돼서 드레인 중인 task는 **자동으로 N에 계속 포함**된다. 별도 처리가 필요 없다.

- 의미상으로도 옳다: 그 TerraformJob은 실제로 worker 용량을 쓰고 있다 (사용자 확인 사항).
- 최대 점유 시간 = execution_timeout(기본 30분). 그 후 슬롯은 자연 반납된다.
- 보드의 슬롯 게이지·큐 API(§6)는 드레인 건을 `draining`으로 별도 표기해 "취소했는데 왜
  슬롯이 안 비지?"라는 혼란을 차단한다.

### 5.4 Race 분석 — 취소가 경쟁에서 어떻게 이기거나 안전하게 지는가

| # | 경쟁 시나리오 | 동작 | 결과 |
|---|-------------|------|------|
| R1 | 취소 vs `BLOCKED→READY` 전파 | 전파(전진)는 pipeline이 RUNNING일 때만 같은 tx에서 확인 후 수행 | 취소가 먼저면 전파 안 됨. 전파가 먼저여도 다음 tick에 READY→CANCELLED |
| R2 | 취소 vs WAITING_SLOT admit 직전 | admit tx가 pipeline 상태를 재확인 (3.4 계약) | 취소가 commit됐으면 admit 0건 |
| R3 | 취소 commit이 admit tx와 **정확히 교차** (split-brain 포함) | task CAS(WAITING_SLOT→DISPATCHING)는 성공할 수 있음 → job 1건이 나감 | **누출 1건은 드레인 규칙으로 수렴** — job_id 기록(드레인 엣지), 종결 대기, finalize CANCELLED. 슬롯 회계는 파생값이라 정확. 고아 없음 |
| R4 | 취소 vs DISPATCHING (HTTP 비행 중) | DISPATCHING은 건드리지 않음. 호출 결과의 job_id 기록은 드레인 엣지라 허용 | RUNNING 드레인 → 종결 후 CANCELLED |
| R5 | 취소 vs job 정상 완료 동시 | task DONE 기록(드레인). 후행 전파는 forward 엣지 → 차단 | 완료된 task까지 보존된 채 CANCELLED |
| R6 | 취소 vs FAILED 자동 재시도 | 재시도 dispatch는 forward 엣지 | 재시도 안 함, finalize |
| R7 | 취소 vs 브레이커 WORKER_OUTAGE 재큐 | 재큐도 forward 엣지 — CANCELLING이면 재큐 대신 CANCELLED | 충돌 없음 |
| R8 | 중복 취소 / 종결 후 취소 | `RUNNING→CANCELLING` CAS 실패 → ALREADY_TERMINAL 반환 | 멱등 |
| R9 | 취소 직후 BFF 크래시 | CANCELLING은 DB에 commit된 상태 — 어떤 Pod가 리더가 되든 드레인 재개 | 유실 없음 (D12) |

**결론: 취소는 실패하지 않는다 — 다만 늦을 수 있다 (최대 드레인 30분).**
어떤 race에서도 ① 이중 전이 없음(CAS), ② 슬롯 누수 없음(파생 카운트), ③ 고아 job 없음
(드레인 엣지가 항상 관측을 완주), ④ N 제약 위반 없음(드레인 건 포함 집계)이 보장된다.
유일하게 받아들이는 비용은 R3의 "취소 직후 1건이 더 나갈 수 있음"인데, 이것도 즉시 드레인으로
수렴하며, TerraformWorker dedup·terraform 수렴성 때문에 인프라 상태를 해치지 않는다.

---

## 6. Admin REST API 정의

> BFF가 노출하는 관리자 API. **UI = API parity** (R-AI1) — 화면의 모든 동작이 이 API와 1:1이다.
> 쓰기 API는 전부 intent 기록(202)이고 실행은 reconciler가 한다 (I4).
> **전체 목록·개략 요청/응답 스키마·에러 코드의 canonical 정의는 `design/pipeline-api.md`** —
> 본 §6은 인터페이스 매핑 관점의 요약이다.

### 6.1 Pipeline 실행/제어

| Method | Path | 설명 | 응답 |
|--------|------|------|------|
| POST | `/admin/target-sources/{id}/pipelines` | 설치/삭제 시작. body `{ "type": "INSTALL\|DELETE" }` | `201 { pipelineId }` / `409` 진행 중 존재 |
| POST | `/admin/pipelines/{id}/cancel` | 취소 요청 (비동기, 멱등 — §5) | `202 { outcome: "CANCELLED_IMMEDIATE" \| "CANCELLING_DRAINING" \| "ALREADY_TERMINAL", drainingTask?: {...} }` |
| POST | `/admin/pipelines/{id}/retry` | FAILED 재시도 (카운트·타이머 리셋) | `202` / `409` FAILED 아님 |
| PATCH | `/admin/pipelines/{id}/tasks/{taskId}` | 확인주기(≥10분)·TTL·max_fail_count 수정. DONE/RUNNING 불가 | `200` / `422` 가드 위반 |
| POST | `/admin/pipelines/{id}/tasks/{taskId}/force-check` | [지금 확인] — next_check_at을 now로 (rate-limit) | `202` |

### 6.2 조회 (보드·이력·이슈 조사)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/admin/pipelines?targetSourceId=&provider=&type=&status=&from=&to=&cursor=` | 보드+이력 통합. 기간은 overlap 의미론 (D6) |
| GET | `/admin/pipelines/{id}` | run 상세 — task 상태, 타임스탬프, definition_version |
| GET | `/admin/pipelines/{id}/tasks/{taskId}/history?cursor=` | attempt + check 병합 타임라인 (이슈 조사 표면) |
| GET | `/admin/pipelines/{id}/tasks/{taskId}/terraform-job` | TerraformJob 내부 task 미러 (read-only 드릴다운) |
| GET | `/admin/target-sources/{id}/pipelines?cursor=` | target 1개의 실행 이력 (마지막 설치/삭제 요약 포함) |

### 6.3 TF 요청 큐 / 시스템 현황 — *"Terraform Worker 요청 Queue 조회"*

큐의 소유자는 BFF이므로(D4 — Infra Manager에는 가시적 큐가 없음) 큐 조회 API도 BFF가 제공한다.

```
GET /admin/pipeline-system/queue

200 {
  "slots":   { "used": 7, "limit": 10 },          // used에는 draining 포함 (§5.3)
  "breaker": { "state": "OPEN",                    // CLOSED | OPEN | HALF_OPEN
               "since": "2026-06-12T04:31:00Z",
               "signal": "PICKUP_TIMEOUT",         // 또는 "CONSECUTIVE_EXECUTION_TIMEOUT"
               "nextProbeAt": "2026-06-12T04:36:00Z" },
  "waiting": [                                     // WAITING_SLOT — FIFO 순
    { "position": 1, "taskId": 9123, "pipelineId": 311,
      "targetSourceId": "ts-aws-001", "taskName": "SVC TF",
      "waitingSince": "2026-06-12T04:25:11Z" }
  ],
  "draining": [                                    // CANCELLING인데 job이 아직 실행 중 (§5)
    { "taskId": 9101, "pipelineId": 308, "terraformJobId": "tfj-7f2",
      "runningSince": "2026-06-12T04:12:40Z", "slotHeld": true,
      "executionDeadlineAt": "2026-06-12T04:42:40Z" }
  ]
}
```

| Method | Path | 설명 |
|--------|------|------|
| GET | `/admin/pipeline-system/queue` | 위 스냅샷 |
| POST | `/admin/pipeline-system/dispatch/{pause,resume}` | 브레이커 수동 개입 (escape hatch, 감사 기록) |
| GET / PUT | `/admin/pipeline-system/settings` | R5 런타임 설정 조회/수정 (수정은 감사 이벤트) |

### 6.4 알림

| Method | Path | 설명 |
|--------|------|------|
| GET | `/admin/notifications?unreadOnly=&severity=&cursor=` | 알림센터 목록 (pipeline_event 기반) |
| POST | `/admin/notifications/read` | body `{ ids: [...] }` 읽음 처리 |

---

## 7. ADR-016 결정 ↔ 인터페이스 매핑

| ADR | 구현 지점 |
|-----|----------|
| D1 reconciler/leader | `Reconciler`, `LeaderElector` |
| D2 데이터 모델 | `PipelineStatus`/`TaskStatus` enum, repository 계층 (별도 명세 불요 — 테이블 = ADR D2) |
| D3 어댑터 2종 + post-check | `TaskExecution`, `DispatchResult`, `Observation`, `PostCheckCall` |
| D4 N 슬롯 / D13 브레이커 | `SlotScheduler`, `TerraformWorkerCircuitBreaker` |
| D5 at-least-once dispatch | `InfraManagerPort.runTerraformJob` 계약 (I3) + tick 6단계 |
| D6 이력/조회 | `PipelineQueryService`, `task_check` 기록은 reconciler 책임 |
| D7 알림 | `EventOutboxRepository`(SKIP LOCKED), `NotificationChannel` |
| D10/§5 취소 | `PipelineCommandService.requestCancel`, `CancelOutcome`, forward/drain 엣지 규칙 |
| D11 타임아웃 | `RuntimeSettings`의 deadline 군 + `ExternalCallException(CALL_TIMEOUT)` |
| D12 CAS/멱등 | `TransitionService`(boolean CAS), 파생 슬롯 카운트, due-driven tick |
| R1/R2/R6 | `TransitionService` 단일 관문, `PipelineCommandService` intent 전용, 락 비의존 |

## 8. 미결 사항 (인터페이스에 미치는 영향)

| # | 항목 | 현재 인터페이스의 대비 |
|---|------|--------------------|
| O7 | job `QUEUED/RUNNING` 구분·worker health | `TerraformJobSnapshot.pickedUpAt`·`workerHealth()`를 Optional로 선언 — 미지원이어도 동작 |
| O5 | Job 내부 task UI 라벨 | `GET .../terraform-job` 응답 필드명은 `jobTasks`로 중립화 |
| — | duplicate 제출 시 job_id 의미론 (O1 후속) | `runTerraformJob` 재호출이 새 id를 반환해도 BFF는 최신 id만 추적 (D5) — 인터페이스 변경 불요 |
