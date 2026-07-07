# ADR-022 구현 세부: 종단 상태 알림 (Slack) — buildable spec

> 이 문서 하나만 보고 구현할 수 있게 쓴 **구현 명세**다. 결정의 *근거*는
> [ADR-022](../../docs/adr/022-terminal-state-notification.md)에, 그 위 도메인/실행 모델은
> [ADR-016](../../docs/adr/016-install-delete-pipeline-domain-model.md)·
> [ADR-021](../../docs/adr/021-pipeline-execution-model.md)에 있다. 타깃 스택은
> **MySQL 8 + Spring Boot(JPA/Hibernate `ddl-auto: update`) + OpenFeign/RestClient**,
> 코드베이스는 `pipeline-orchestrator`(패키지 `com.bff.pipeline`).

## 0. 범위와 원칙 (작게 시작)

- **sink = Slack 하나**(V1 단일 논리 sink). Slack Incoming Webhook URL로 POST.
- **인터페이스 추상화 없음** — `NotificationSink` 같은 인터페이스를 두지 않고 `SlackNotifier`
  구체 클래스로 직접 구현한다. 다중 sink가 실제로 필요해지면 그때 추출한다(YAGNI).
- **Slack 채널은 Admin Page에서 관리** — webhook URL/활성여부를 admin UI에서 등록·수정.
- **관측 전용, 게이팅 아님** — 알림은 pipeline/task 도메인 상태에 영향을 주지 않는다(ADR-022 불변식).
- **실행과 격리** — notify는 실행 워커풀·admission cap과 자원/회계를 공유하지 않는다.

## 1. 큰 그림

```
NotifyScheduler (단일 데몬 loop, 실행 스케줄러와 별개)
   └─ 채널 미설정/비활성이면 idle (아무 것도 claim 안 함)
   └─ 있으면:
        tx1  NotifyClaimer.claimOne()        — 종단·미알림 행 1개 SKIP LOCKED claim (notify 전용 lease)
        ──   SlackNotifier.deliver(payload)  — 트랜잭션 밖, RestClient read-timeout 으로 bounded
        tx2  NotifyWriteBack.record(...)      — 성공: notified_at 스탬프 / 실패: backoff / 소진: give-up
```

- **claim 단위 = 종단 pipeline 행 1개.** 발화 조건 = `종단 상태로 커밋됨 ∧ 미알림`(ADR-022 §1).
- notify 루프는 **단일 스레드로 충분**하다 — 파이프라인당 1회, 대상 ~2,000, 종단 이벤트는
  드문드문 발생. 느린 Slack 호출은 `call-timeout`으로 상한을 두므로 단일 스레드가 막히지 않는다.
- 멀티 파드에서도 안전: `FOR UPDATE SKIP LOCKED` + notify lease가 파드 간 이중 전달을 막는다.
- **Slack은 dedupe하지 않는다.** at-least-once라 드물게(전달 성공 후 tx2 커밋 전 크래시/lease 만료)
  **같은 종단 메시지가 채널에 두 번 보일 수 있다.** V1은 이 드문 중복을 **수용**한다(Slack Incoming
  Webhook에는 idempotency 키가 없다). 각 메시지에 `pipeline_id`를 실어 사람이 눈으로 구분하게 하고,
  자동 dedupe가 실제로 필요해지면 Slack 앞에 멱등 브리지 sink를 두는 건 후속(V1 비범위).

## 2. DB 변경 (JPA 엔티티, 손으로 쓰는 SQL 없음)

`ddl-auto: update`가 엔티티 애노테이션에서 스키마를 만든다. **`Pipeline` 엔티티에 필드 5개 + 인덱스 1개**를 더하고,
**설정 엔티티 `NotificationChannel` 1개**를 새로 만든다.

### 2.1 `Pipeline` 에 추가

```java
// ── ADR-022 종단 알림 메타데이터 (도메인 상태 아님; reconciler/claim/전이가 읽지 않는다) ──
@Column(name = "notified_at")
private Instant notifiedAt;              // 전달 완료(sink ack) 마커. non-null 이면 알림 대상에서 빠짐

@Column(name = "notify_next_at")
private Instant notifyNextAt;            // 실패 backoff 게이트(다음 재시도 시각). give-up 시 far-future

@Column(name = "notify_attempts", nullable = false)
@Builder.Default
private int notifyAttempts = 0;          // backoff 지수·give-up 임계 계산

// notify 전용 lease — ADR-021 claimed_by/until 을 재사용하지 **않는다**(§8 근거).
@Column(name = "notify_claimed_by", length = 36)
private String notifyClaimedBy;

@Column(name = "notify_claimed_until")
private Instant notifyClaimedUntil;
```

`@Table(indexes = { ... })` 에 한 줄 추가:

```java
// ponytail: ~2,000행 규모엔 (notified_at, notify_next_at) 복합이면 충분. MySQL8은 부분(filtered)
// 인덱스가 없으므로 status 필터는 옵티마이저에 맡긴다. 대규모로 커지면 재검토.
@Index(name = "idx_pipeline_notify", columnList = "notified_at, notify_next_at")
```

> **`active_target` 유일 제약과 무관** — notify 컬럼은 알림 메타데이터일 뿐 도메인 불변식과 얽히지 않는다.

### 2.2 새 엔티티 `NotificationChannel` (단일 행 설정)

V1은 **단일 논리 sink**이므로 이 테이블은 사실상 1행이다(`id=1` 고정). admin이 이 1행을 수정한다.

```java
@Entity
@Table(name = "notification_channel")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor(access = AccessLevel.PRIVATE) @Builder
public class NotificationChannel {

    // 단일 sink 이므로 고정 PK. upsert 는 항상 이 id 를 쓴다.
    public static final long SINGLETON_ID = 1L;

    @Id
    private Long id;                        // 항상 SINGLETON_ID

    /** Slack Incoming Webhook URL. secret — GET 응답에서 마스킹한다(§6). */
    @Column(name = "slack_webhook_url", length = 512)
    private String slackWebhookUrl;

    /** admin 표시용 별칭(예: "#infra-alerts"). 전송 라우팅엔 쓰지 않음(webhook 이 채널을 결정). */
    @Column(name = "channel_label", length = 128)
    private String channelLabel;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private boolean enabled = false;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
```

## 3. 설정 (`pipeline.notify.*`)

`ExecutionSettings` 와 같은 방식으로 `@ConfigurationProperties` record + fail-fast 검증.

```java
@Builder
@ConfigurationProperties(prefix = "pipeline.notify")
public record NotifySettings(
        boolean enabled,
        Duration pollInterval,
        Duration maxIdleSleep,
        Duration backoffBase,
        Duration backoffMax,
        double jitterRatio,
        Duration leaseDuration,
        Duration callTimeout,
        int maxAttempts,
        Duration schedulerInitialDelay) {

    public NotifySettings {
        requirePositive(pollInterval, "pipeline.notify.poll-interval");
        requirePositive(maxIdleSleep, "pipeline.notify.max-idle-sleep");
        requirePositive(backoffBase, "pipeline.notify.backoff-base");
        requirePositive(backoffMax, "pipeline.notify.backoff-max");
        requirePositive(leaseDuration, "pipeline.notify.lease-duration");
        requirePositive(callTimeout, "pipeline.notify.call-timeout");
        requirePositive(schedulerInitialDelay, "pipeline.notify.scheduler-initial-delay");
        if (maxAttempts < 1) throw new IllegalArgumentException("pipeline.notify.max-attempts must be >= 1");
        if (jitterRatio < 0.0 || jitterRatio > 1.0)
            throw new IllegalArgumentException("pipeline.notify.jitter-ratio must be within [0,1]");
        // 같은 이유(ADR-021 Decision 5): lease 가 호출 타임아웃보다 짧으면 정상 운영 중에도
        // write-back(tx2)이 만료된 lease 로 no-op 되는 병리가 생긴다.
        if (leaseDuration.compareTo(callTimeout) <= 0)
            throw new IllegalArgumentException("pipeline.notify.lease-duration must exceed call-timeout");
    }
    // requirePositive: ExecutionSettings 와 동일 구현
}
```

`PipelineConfig` 에 `@EnableConfigurationProperties` 로 `NotifySettings.class` 추가.

`application.yml`:

```yaml
pipeline:
  notify:
    enabled: true
    poll-interval: PT2S            # 일감 있을 때 loop 케이던스
    max-idle-sleep: PT10S          # 빈 sweep backoff 상한
    backoff-base: PT5S             # 전달 실패 backoff 기준(지수)
    backoff-max: PT10M
    jitter-ratio: 0.2
    lease-duration: PT1M           # notify claim lease (> call-timeout 강제)
    call-timeout: PT10S            # Slack HTTP read timeout
    max-attempts: 8                # 이 횟수 실패하면 자동 재시도 중단 → 운영 에스컬레이션
    scheduler-initial-delay: PT10S
```

> **maxNotifyCount = `max-attempts`(기본 8).** 넘으면 `notify_next_at` 을 far-future 로 밀어 자동
> 재시도를 멈추고 ERROR 로그 + 지표로 사람이 개입하게 한다(§5).

## 4. Claim / 전달 / write-back

### 4.1 `NotifyRepository` (Spring Data JPA)

`PipelineRepository` 의 claim 패턴을 그대로 따른다(`@Lock(PESSIMISTIC_WRITE)` + `@QueryHints`
lock-timeout `-2` → MySQL8에서 `FOR UPDATE SKIP LOCKED` 렌더, H2에선 무시).

```java
public interface NotifyRepository extends JpaRepository<Pipeline, Long> {

    /** tx1 진입 질의 — 알림 가능한 종단·미알림 행 하나를 SKIP LOCKED 로 잠가 가져온다. */
    default Optional<Pipeline> findNextNotifiable(Instant now) {
        return lockNotifiable(now, Limit.of(1)).stream().findFirst();
    }

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "-2")) // SKIP LOCKED
    @Query("select p from Pipeline p "
         + "where p.status in (com.bff.pipeline.enums.PipelineStatus.DONE, "
         + "                   com.bff.pipeline.enums.PipelineStatus.FAILED, "
         + "                   com.bff.pipeline.enums.PipelineStatus.CANCELLED) "
         + "and p.notifiedAt is null "
         + "and (p.notifyNextAt is null or p.notifyNextAt <= :now) "
         + "and (p.notifyClaimedUntil is null or p.notifyClaimedUntil < :now) "
         + "order by p.notifyNextAt asc, p.id asc")   // NULL first + 결정적 tie-break
    List<Pipeline> lockNotifiable(@Param("now") Instant now, Limit limit);

    /** tx2 용 행 잠금. PipelineRepository.findByIdForUpdate 와 동일 역할(중복 두지 말고 재사용 가능). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Pipeline p where p.id = :id")
    Optional<Pipeline> findByIdForUpdate(@Param("id") Long id);

    /** 지표: 가장 오래된 미알림 종단 행의 종단 시각(=오래됨 age 계산용). */
    @Query("select min(p.lastActivityAt) from Pipeline p "
         + "where p.status in (com.bff.pipeline.enums.PipelineStatus.DONE, "
         + "                   com.bff.pipeline.enums.PipelineStatus.FAILED, "
         + "                   com.bff.pipeline.enums.PipelineStatus.CANCELLED) "
         + "and p.notifiedAt is null")
    Optional<Instant> oldestUnnotifiedAt();
}
```

### 4.2 `NotifyClaimer` (tx1)

```java
@Component
public class NotifyClaimer {
    private final NotifyRepository repo;
    private final TaskRepository taskRepo;   // 실패 task 조회용(failedTask/errorCode 는 Task 에 있다)
    private final NotifySettings settings;
    private final Clock clock;
    // 생성자 주입

    @Transactional
    public Optional<NotifyClaim> claimOne() {
        Instant now = clock.instant();
        return repo.findNextNotifiable(now).map(p -> {
            String token = UUID.randomUUID().toString();
            p.setNotifyClaimedBy(token);
            p.setNotifyClaimedUntil(now.plus(settings.leaseDuration()));
            // payload 는 행이 로드된 tx1 안에서 구성한다(이미 커밋된 pipeline/task 행에서).
            return new NotifyClaim(p.getId(), token, buildPayload(p));
        });
    }

    private NotifyPayload buildPayload(Pipeline p) {
        String failedTask = null, errorCode = null;
        if (p.getStatus() == PipelineStatus.FAILED) {
            // 실패 task = sequence 최소의 FAILED task. TaskRepository.findByPipelineIdOrderBySequenceAsc 재사용.
            Task failed = taskRepo.findByPipelineIdOrderBySequenceAsc(p.getId()).stream()
                    .filter(t -> t.getStatus() == TaskStatus.FAILED).findFirst().orElse(null);
            if (failed != null) {
                failedTask = failed.getTaskName();
                errorCode = failed.getErrorCode() == null ? null : failed.getErrorCode().name();
            }
        }
        return new NotifyPayload(p.getId(), p.getType().name(), p.getStatus().name(),
                p.getTarget(), failedTask, errorCode, "1");
    }
}
```

`NotifyClaim(long pipelineId, String token, NotifyPayload payload)`. `buildPayload` 는 tx1 안에서
호출돼 이미 커밋된 pipeline/task 행만 읽는다(도메인 상태 변경 없음).

> **실행과의 격리(중요):** notify 는 `notify_claimed_by/until` 을 쓰고 실행의 `claimed_by/until` 은
> 건드리지 않는다. 실행의 admission soft-cap 은 `countByClaimedUntilAfter` 로 세는데, 만약 notify 가
> `claimed_until` 을 공유하면 종단 행의 notify lease 가 그 카운트를 부풀려 실행 처리량을 깎는다.
> 전용 컬럼쌍으로 이 오염을 원천 차단한다(§8).
> 종단 행은 실행 claim 술어(RUNNING/PENDING 한정)에 절대 안 걸리므로, 두 lease 가 같은 행에서
> 경합할 일도 없다.

### 4.3 `NotifyPayload` + `SlackNotifier` (외부 호출)

**PII 최소화 — 허용 필드만**(ADR-022 §4). 그 외 민감 상세는 싣지 않는다.

```java
public record NotifyPayload(
        long pipelineId,
        String type,            // INSTALL | DELETE
        String terminalStatus,  // DONE | FAILED | CANCELLED
        String target,          // 식별자
        String failedTask,      // FAILED 일 때만, 아니면 null
        String errorCode,       // FAILED 일 때만, 아니면 null
        String schemaVersion) { // 상수 "1"
}
```

`SlackNotifier` — 인터페이스 없이 구체 클래스. Spring `RestClient` 로 webhook 에 POST,
`call-timeout` 을 connect/read timeout 으로 건다(별도 스레드풀 불필요 — HTTP 클라이언트가 상한을 소유).

**RestClient 빈은 `PipelineConfig` 에 명시적으로 둔다**(Boot는 `RestClient.Builder` 만 자동구성하므로
타임아웃이 걸린 빈을 직접 만든다):

```java
// PipelineConfig
@Bean
public RestClient notifyRestClient(NotifySettings settings) {
    var f = new SimpleClientHttpRequestFactory();
    int ms = (int) settings.callTimeout().toMillis();
    f.setConnectTimeout(ms);
    f.setReadTimeout(ms);
    return RestClient.builder().requestFactory(f).build();
}
```

```java
@Component
public class SlackNotifier {
    private final RestClient notifyRestClient;   // @Qualifier("notifyRestClient")

    /** 실패(비2xx/타임아웃/IO)면 예외 → 호출자(NotifyScheduler)가 잡아 tx2 backoff. */
    public void deliver(String webhookUrl, NotifyPayload p) { post(webhookUrl, toSlackMessage(p)); }

    /** admin 테스트 전송 — 실제 pipeline 없이 고정 메시지. */
    public void deliverTest(String webhookUrl) {
        post(webhookUrl, Map.of("text", ":bell: PII 파이프라인 알림 채널 테스트 메시지"));
    }

    private void post(String webhookUrl, Object message) {   // core
        notifyRestClient.post().uri(webhookUrl)
              .contentType(MediaType.APPLICATION_JSON)
              .body(message)
              .retrieve().toBodilessEntity();     // 비2xx → RestClientException
    }
    // toSlackMessage(NotifyPayload): 아래 형식의 Map 을 만든다.
}
```

Slack 메시지 형식(간단·읽기 쉬운 텍스트; blocks 는 나중에):

```json
{
  "text": ":white_check_mark: *Pipeline DONE* — INSTALL `target-abc` (id 1234)",
  "attachments": [{
    "color": "good",
    "fields": [
      {"title": "type",   "value": "INSTALL", "short": true},
      {"title": "status", "value": "DONE",    "short": true},
      {"title": "target", "value": "target-abc", "short": false}
    ]
  }]
}
```

- `DONE` → `:white_check_mark:`/`good`, `FAILED` → `:x:`/`danger`(+`failed_task`/`error_code` 필드),
  `CANCELLED` → `:no_entry:`/`warning`. `pipeline_id` 는 항상 포함(소비자 dedupe 키).

### 4.4 `NotifyWriteBack` (tx2, guarded)

```java
@Component
public class NotifyWriteBack {
    private final NotifyRepository repo;
    private final NotifySettings settings;
    private final Clock clock;

    @Transactional
    public void onSuccess(long pipelineId, String token) {
        guarded(pipelineId, token, p -> {
            p.setNotifiedAt(clock.instant());
            p.setNotifyClaimedBy(null);
            p.setNotifyClaimedUntil(null);
        });
    }

    @Transactional
    public void onFailure(long pipelineId, String token) {
        guarded(pipelineId, token, p -> {
            int attempts = p.getNotifyAttempts() + 1;
            p.setNotifyAttempts(attempts);
            if (attempts >= settings.maxAttempts()) {
                p.setNotifyNextAt(clock.instant().plus(Duration.ofDays(3650))); // give-up: far-future
                log.error("notify give-up pipeline={} after {} attempts", pipelineId, attempts);
            } else {
                p.setNotifyNextAt(clock.instant().plus(backoff(attempts)));
            }
            p.setNotifyClaimedBy(null);
            p.setNotifyClaimedUntil(null);
        });
    }

    /** findByIdForUpdate 로 잠그고 notify_claimed_by == token 일 때만 apply (stale-straggler fencing). */
    private void guarded(long id, String token, Consumer<Pipeline> mutate) {
        repo.findByIdForUpdate(id).ifPresent(p -> {
            if (token.equals(p.getNotifyClaimedBy())) mutate.accept(p);
            // 토큰 불일치 = lease 만료 후 재claim 됨 → no-op (ADR-021 §4 와 동형)
        });
    }

    private Duration backoff(int attempts) {   // 지수 + jitter, backoffMax 상한
        long base = settings.backoffBase().toMillis() * (1L << Math.min(attempts - 1, 20));
        long capped = Math.min(base, settings.backoffMax().toMillis());
        double f = ThreadLocalRandom.current().nextDouble(-1, 1) * settings.jitterRatio();
        return Duration.ofMillis(Math.max(1L, Math.round(capped * (1 + f))));
    }
}
```

### 4.5 `NotifyScheduler` (단일 데몬 loop)

`PipelineScheduler` 를 축소 모델링 — 워커 풀 fan-out 없이 **단일 스레드**. 채널 미설정/비활성이면 claim 안 함.

```java
@Component
public class NotifyScheduler {
    private final NotifyClaimer claimer;
    private final SlackNotifier slack;
    private final NotifyWriteBack writeBack;
    private final NotificationChannelService channels;
    private final NotifySettings settings;

    private final ScheduledExecutorService loop = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "notify-scheduler"); t.setDaemon(true); return t;
    });
    private Duration idleBackoff;

    @PostConstruct void start() {
        if (!settings.enabled()) return;   // master switch off → 아예 안 돈다
        idleBackoff = settings.backoffBase();
        loop.schedule(this::runSweep, settings.schedulerInitialDelay().toMillis(), MILLISECONDS);
    }
    @PreDestroy void stop() { loop.shutdownNow(); }

    void runSweep() {
        boolean worked = false;
        try { worked = deliverOne(); }
        catch (RuntimeException e) { log.warn("notify sweep failed", e); }
        finally {
            Duration delay;
            if (worked) { idleBackoff = settings.backoffBase(); delay = settings.pollInterval(); }
            else        { delay = nextIdle(); }              // idleBackoff 리셋 후 pollInterval (PipelineScheduler 동형)
            loop.schedule(this::runSweep, delay.toMillis(), MILLISECONDS);
        }
    }

    /** 채널 있으면 한 건 claim→전달→기록. 반환: 일감이 있었나. */
    boolean deliverOne() {
        Optional<NotificationChannel> ch = channels.activeChannel();
        if (ch.isEmpty()) { return false; }                 // 미설정/비활성 → idle (backlog age 지표가 드러냄)
        Optional<NotifyClaim> claim = claimer.claimOne();
        if (claim.isEmpty()) return false;
        NotifyClaim c = claim.get();
        try {
            slack.deliver(ch.get().getSlackWebhookUrl(), c.payload());
            writeBack.onSuccess(c.pipelineId(), c.token());
        } catch (RuntimeException deliveryFailed) {
            log.warn("notify delivery failed pipeline={}", c.pipelineId(), deliveryFailed);
            writeBack.onFailure(c.pipelineId(), c.token());
        }
        return true;
    }

    private Duration nextIdle() {   // 빈 sweep geometric backoff (PipelineScheduler 와 동형, 단순화)
        idleBackoff = min(idleBackoff.multipliedBy(2), settings.maxIdleSleep());
        return idleBackoff;
    }
}
```

> **단일 스레드 근거(ponytail):** notify 는 파이프라인당 1회, 저빈도. 한 번에 한 건 직렬 처리로 충분하고
> Slack 호출은 `call-timeout` 으로 상한. 처리량이 실제로 부족해지면 그때 워커 풀 fan-out(PipelineScheduler
> 처럼)으로 올린다.

## 5. 실패·재시도·give-up 규칙

| 상황 | tx2 처리 | 재시도 |
|---|---|---|
| 전달 성공 | `notified_at = now`, notify lease 해제 | 대상에서 영구 제외 |
| 전달 실패(비2xx/타임아웃/IO), `attempts < max` | `attempts++`, `notify_next_at = now + backoff` | backoff 후 재claim |
| 전달 실패, `attempts >= max` | `attempts++`, `notify_next_at = now + 3650d`, **ERROR 로그** | 자동 중단(사람 개입) |
| lease 만료 후 지연 도착 tx2 | 토큰 불일치 → **no-op** | 다른 워커가 이미 처리/재시도 |

- **at-least-once**: 전달 성공 후 tx2 커밋 전 크래시/타임아웃/lease 만료 → 중복 전달 가능 →
  **소비자(Slack)는 `pipeline_id` 로 dedupe**(파이프라인당 종단 1개). exactly-once 보장 안 함.
- **give-up 복구**: admin 이 수동으로 `notify_next_at`/`notify_attempts` 를 리셋하면 재시도된다
  (전용 admin 액션은 V1 비범위 — DB 수정 또는 후속). 

## 6. Admin: Slack 채널 관리

### 6.1 Orchestrator REST (신규 `NotificationChannelController`)

기존 컨트롤러 패턴(`@RestController`, 인바운드 접두어 **`/api/v1`**, `GlobalAdvice` 예외 처리) 따른다.
단일 sink 이므로 단수 리소스.

```
GET  /api/v1/admin/notification-channel   → ChannelView { channelLabel, enabled, webhookConfigured, webhookMasked, updatedAt }
PUT  /api/v1/admin/notification-channel   ChannelUpsert { channelLabel, enabled, slackWebhookUrl? } → ChannelView (upsert, 항상 id=1)
POST /api/v1/admin/notification-channel/test → TestResult { delivered: bool, error?: string }  (항상 200)
```

DTO(전부 record, `dto` 패키지):

```java
public record ChannelUpsert(String channelLabel, boolean enabled, String slackWebhookUrl) {}
public record ChannelView(String channelLabel, boolean enabled, boolean webhookConfigured,
                          String webhookMasked, Instant updatedAt) {}
public record TestResult(boolean delivered, String error) {}
```

- **webhook 은 secret**: `GET` 은 **절대 원문을 반환하지 않는다** — `webhookConfigured` +
  `webhookMasked`(예: `https://hooks.slack.com/…/xxxx` 뒤 4자만). `PUT` 에서 `slackWebhookUrl` 이
  비어 있으면(생략/blank) 기존 값 유지, 값이 오면 교체(`updatedAt` 갱신).
- **SSRF 방어(보안, 필수)**: `upsert` 는 webhook URL 을 검증한다 — `https` 스킴 + 호스트가
  `hooks.slack.com` 이어야 한다. 위반 시 typed 예외(아래). "admin 이 넣는 값이라 안전"에 기대지 않는다
  (서버가 임의 URL 로 POST 하게 두면 SSRF).
- **에러 매핑(`GlobalAdvice` 정합)**: 검증 실패는 이 repo 의 typed `OrchestrationException`
  (신규 `OrchestrationErrorCode.INVALID_NOTIFICATION_WEBHOOK` 등)으로 던져 `GlobalAdvice` 가 4xx 로 매핑.
  **`test` 는 예외로 실패를 알리지 않는다** — `SlackNotifier.deliverTest` 의 `RestClientException` 을
  잡아 `TestResult{delivered:false, error:message}` 로 **200** 반환(probe 결과지 서버 오류가 아님).
  채널 미설정 상태의 `test` 는 `{delivered:false, error:"channel not configured"}`.
- `NotificationChannelService.activeChannel()` = `enabled && slackWebhookUrl != null` 인 행 반환
  (없으면 empty → scheduler idle).

### 6.2 Frontend Admin Page (`pii-agent-demo`, Next.js) — **별도 repo, 백엔드 빌드 비차단**

> 이 절은 **다른 저장소**(`pii-agent-demo`) 작업이다. §2~§6.1(orchestrator 백엔드)은 이 절 없이도
> 독립적으로 빌드·배포 가능하다. 프론트는 §6.1 계약(REST shape)만 소비한다.

기존 admin 파이프라인 영역(LIN-20/25)에 **"알림 채널" 설정 카드** 1개 추가. BFF/orchestrator 프록시
경로 규약(admin orchestrator proxy)에 맞춰 Next route → orchestrator(`/api/v1/admin/notification-channel`)로 프록시.

- 필드: **Slack Webhook URL**(입력; 저장 후엔 마스킹 표시, 재입력 시 교체), **채널 라벨**(표시용),
  **활성 토글**, **[테스트 전송] 버튼**(→ `POST …/test`, 결과 토스트).
- 계약 shape 는 §6.1 그대로. casing 경계는 ADR-019 규약(route 에서 검증/변환).
- webhook URL 은 UI 에도 원문을 다시 내려주지 않는다(마스킹). 최초 1회 입력만 평문.

## 7. 관측(지표/로그)

`spring-boot-starter-actuator`/Micrometer 는 현재 pom 에 없다. V1 은 **구조화 로그**로 시작:

- `notify delivered pipeline={} attempts={}` (INFO), `notify delivery failed …`(WARN), `notify give-up …`(ERROR).
- 정체 감시: `NotifyRepository.oldestUnnotifiedAt()` 를 주기 로그 또는 (actuator 도입 시) gauge 로.
- actuator 를 추가하면 gauge 3개 노출: `notify.unnotified.oldest.age.seconds`,
  `notify.attempts.total`(counter), `notify.giveup.total`(counter). **도입은 후속**(YAGNI).

## 8. 설계 판단 기록 (구현 중 갈린 지점)

- **notify 전용 lease 컬럼쌍 분리(≠ ADR-021 재사용).** ADR-022 §2/스키마는 "claimed_by/until 재사용"
  으로 서술하나, 실제 코드의 admission soft-cap `PipelineRepository.countByClaimedUntilAfter(now)` 가
  **상태 무관**하게 활성 lease 를 센다. 재사용하면 종단 행의 notify lease 가 이 카운트를 부풀려 **실행
  처리량을 깎는다.** 전용 `notify_claimed_by/until` 로 격리하는 게 정확하고 실행 코드를 안 건드린다
  (대안: `countByClaimedUntilAfter` 에 `status in (RUNNING,PENDING)` 필터 추가로 재사용 — 실행 회계
  질의를 건드리므로 기각). → **ADR-022 스키마/§2 문구를 이 결정에 맞게 갱신 필요**(컬럼 3 → 5, "재사용" → "전용 쌍").
- **인터페이스 없음** — `SlackNotifier` 구체 클래스. 다중 sink 필요 시 추출(현재 비범위).
- **단일 sink** — `notification_channel` 1행. 다중·독립 재시도 sink 는 ADR-022 가 유보(per-sink 상태).
- **부분 인덱스 없음(MySQL8)** — `active_target` 유일 제약과 같은 제약. 복합 인덱스 + 소규모로 흡수.

## 9. 패키지 배치 (레이어 규칙 준수)

기존 레이어 규칙에 맞춰 배치한다(record/DTO 가 `service` 로 새지 않게):

| 클래스 | 패키지 |
|---|---|
| `NotifySettings` | `config` (+ `PipelineConfig` 에 `@EnableConfigurationProperties`·RestClient 빈) |
| `NotificationChannel`(엔티티), `Pipeline`(필드 추가) | `entity` |
| `NotifyRepository`, (재사용) `TaskRepository` | `repository` |
| `NotifyClaim`, `NotifyPayload` | `dto` (또는 `model`) |
| `NotifyClaimer`, `NotifyWriteBack`, `NotifyScheduler`, `SlackNotifier`, `NotificationChannelService` | `service`(실행 하위 패턴 따르면 `service.notify`) |
| `NotificationChannelController` | `controller` |
| `ChannelUpsert`/`ChannelView`/`TestResult` | `dto` |
| `OrchestrationErrorCode.INVALID_NOTIFICATION_WEBHOOK` 등 | 기존 error enum |

## 10. 구현 순서 (슬라이스)

1. `Pipeline` 5필드 + `idx_pipeline_notify` 추가 → 앱 부팅(`ddl-auto: update`)으로 컬럼 생성 확인.
2. `NotifySettings` + yml 키 + `PipelineConfig` 등록 → 잘못된 값에 fail-fast 되는지 확인.
3. `NotificationChannel` 엔티티 + `NotificationChannelService`(activeChannel/upsert/mask) + 컨트롤러.
4. `NotifyRepository`(claim/guard/oldest) + `NotifyClaimer`(tx1) + `NotifyWriteBack`(tx2).
5. `SlackNotifier`(RestClient, 타임아웃) + payload 빌더(PII 허용 필드만).
6. `NotifyScheduler`(단일 loop, 채널 가드).
7. Frontend admin 카드 + Next 프록시 route.
8. 테스트(§11).

## 11. 테스트 체크리스트 (H2 MySQL-mode, `@DataJpaTest`/단위)

- **claim 술어**: 종단·미알림·due 행만 잡고, `notified_at != null`/미도래 `notify_next_at`/유효 lease 행은 스킵.
- **tx2 fencing**: 토큰 불일치 write-back 은 no-op(재claim 시나리오).
- **backoff/give-up**: `attempts` 증가·`notify_next_at` 전진, `max-attempts` 도달 시 far-future + ERROR.
- **격리**: notify lease 스탬프가 `countByClaimedUntilAfter`(실행 캡)에 **안 잡힘**(전용 컬럼 검증).
- **채널 가드**: 미설정/비활성이면 claim 0건(scheduler idle).
- **payload PII**: 허용 필드만 직렬화(민감 필드 누락 확인). `FAILED` 는 `buildPayload` 가
  sequence 최소 FAILED task 에서 `failed_task`/`error_code` 를 채운다(비-FAILED 는 null).
- **webhook 마스킹**: `GET` 응답에 원문 webhook 이 없다(마스킹만).
- **SSRF 검증**: 비-https·비-`hooks.slack.com` webhook `PUT` 은 typed 4xx 로 거절.
- **test 엔드포인트**: 전달 실패해도 200 + `{delivered:false, error}`; 미설정이면 `channel not configured`.
- **at-least-once**: 성공 후 tx2 전 크래시 모사 → 재전달(중복 Slack 메시지 수용, `pipeline_id` 로 식별).

## 12. 링크

- [ADR-022](../../docs/adr/022-terminal-state-notification.md) — 결정/근거(상태 파생 알림).
- [ADR-021](../../docs/adr/021-pipeline-execution-model.md) — claim/lease/two-tx 원본 패턴.
- [ADR-016](../../docs/adr/016-install-delete-pipeline-domain-model.md) — 도메인 상태·종단·관측.
