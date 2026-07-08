# ADR-022: Install/Delete 파이프라인 — 종단 상태 알림(state-derived notification)

## 상태

제안됨 — 2026-07-01 (개정 2026-07-07: postCheck 분리 — `CONDITION_CHECK`로 확정·구현됨.
이 ADR은 **종단 상태 알림**만 다룬다).

[ADR-016](016-install-delete-pipeline-domain-model.md)(도메인 모델)·
[ADR-021](021-pipeline-execution-model.md)(실행 모델)의 **후속**으로, 파이프라인이 종단
(`DONE`/`FAILED`/`CANCELLED`)에 도달했음을 오퍼레이터·다운스트림에 **신뢰성 있게 알리는
경로**를 정한다. ADR-016이 유보한 사항이다(ADR-021은 관련 지표만 정의).

> **postCheck는 이 ADR 범위 밖이다.** 자기 보고 완료 판정과 별개로 end-state를 검증하는
> postCheck는 ADR-016/021의 `CONDITION_CHECK`(retry-count로 바운드되는 빠른 probe)로
> **확정·구현**되었다. recipe의 마지막 task로 `CONDITION_CHECK`를 두는 것은 ADR-016의
> **recipe 작성 규약**이지 새 메커니즘이 아니므로 별도 결정 문서가 필요 없다. 이 ADR은
> 남은 후속인 **종단 알림**에 집중한다.

**핵심 설계 방향**: 종단 전이는 **이미 `pipeline.status`에 durable하게 저장**되므로
별도 이벤트 저장소(트랜잭션 아웃박스)를 두지 않는다. 대신 `pipeline.notified_at` 마커
하나를 두고 **상태에서 알림을 파생(derive-from-state)**하며, 전달은 ADR-021의
claim/lease **메커니즘**을 재사용한다(claim 쿼리·lease 컬럼은 별개 — §2). 이는 ADR-016이 초기 최대 모델에서 event
outbox를 잘라낸 취지("logs/metrics + domain rows로 충분")와 일치한다.

ADR-016/021의 불변식(“DB row가 곧 상태”, at-least-once + 멱등성, 종단 상태 부활 금지,
개념 최소화)을 그대로 상속한다. 이 ADR은 `pipeline`에 **알림 메타데이터 컬럼**
`notified_at`을 더한다 — 이는 ADR-021이 `pipeline`에 실행 메타데이터(`next_due_at`,
`claimed_by` 등)를 더한 것과 **같은 범주**이며(ADR-021 §2 「Execution schema note」),
도메인 상태(`status`·enum)는 바꾸지 않는다. 알림 정책 변경은 이 ADR만 대체한다;
claim-pull 실행 모델 변경은 ADR-021 소관이다.

## 맥락

### 종단 알림 — 신뢰성 있게 “끝났다”를 전달하기

파이프라인이 `DONE`/`FAILED`/`CANCELLED`에 도달해도 오퍼레이터·다운스트림에 **신뢰성
있게 알릴 경로가 없다.** 순진한 두 가지 방법은 모두 틀렸다.

- **전이 트랜잭션 안에서 알림 호출**: 상태 전이(DB write)와 외부 알림 호출을 하나로 묶는
  **dual-write**. 알림이 성공했는데 트랜잭션이 롤백되면(또는 반대) 상태와 알림이 갈라지고,
  느린 알림 서버가 상태 전이를 막는다 — 상태 정합성이 알림 서버 가용성에 종속된다.
- **커밋 후 best-effort 알림**: 커밋과 알림 호출 사이에 크래시가 나면 알림이 **조용히
  유실**된다(복구 경로 없음).

관건은 “전이는 커밋됐는데 알림은 아직”이라는 상태를 **durable하게 기억**하고 나중에
전달하는 것이다. 그런데 그 상태는 **이미 도메인 행에 있다** — `pipeline.status`가 종단이면
“알림 대상”이라는 뜻이다. 필요한 것은 “이미 알렸는가”를 나타내는 마커 하나뿐이다.

### 규모(ADR-016/021과 동일)

대상 ~2,000개, 분 단위 job, 단일 조직 내부 도구. 이 규모는 별도 이벤트 저장소·relay·
CDC/브로커 같은 이벤트 인프라를 정당화하지 않는다.

## 결정

### 1. 종단 알림은 상태에서 파생한다(derive-from-state) — 별도 이벤트 저장소 없음

`pipeline`에 nullable 컬럼 `notified_at` 하나를 둔다. 알림 대상은 **쿼리로 파생**된다:

```
status IN ('DONE','FAILED','CANCELLED') AND notified_at IS NULL
```

“전이는 커밋됐는데 알림은 아직”은 이 술어로 완전히 표현된다 — 별도 이벤트 행을 INSERT할
필요가 없다. 종단 전이 자체가 durable하므로 **dual-write가 원천적으로 없다**(전이가
커밋돼야만 알림 대상이 되고, 커밋됐다면 반드시 대상이 된다). `notified_at`은 알림
메타데이터이지 도메인 상태가 아니다 — claim·스케줄링·전이 로직은 이를 읽지 않는다.
(위는 개념 술어이고, lease·backoff 게이트를 포함한 **완전한 claim 술어는 §2**에 있다.)

알림 payload는 **이미 커밋된 `pipeline`/`task` 행에서 구성**한다(종단 종류, 실패 시
실패 task와 `error_code` 포함). 따라서 `TASK_FAILED`를 별도 이벤트로 둘 필요가 없다 —
`FAILED` 종단 알림이 실패 task 상세를 실어 나른다.

### 2. 알림 전달은 ADR-021의 claim/lease **메커니즘**을 재사용한다(쿼리는 별개)

알림 전달은 외부 호출이다. 재사용하는 것은 ADR-021의 **메커니즘**(`SKIP LOCKED` + lease +
fencing 토큰 + two-tx guarded write-back)이지 `RUNNING` 스캔 쿼리 자체가 아니다. 종단 알림은
**별도 work-kind**로, 자체 술어·인덱스·워커 분기를 가진다.

**lease는 notify 전용 컬럼쌍(`notify_claimed_by`/`notify_claimed_until`)을 쓴다 — ADR-021의
`claimed_by`/`claimed_until`을 재사용하지 않는다.** 재사용하면, ADR-021 실행의 admission
soft-cap이 활성 lease를 **상태 무관하게** 세기 때문에(구현: `countByClaimedUntilAfter`) 종단
행에 찍힌 notify lease가 그 카운트를 부풀려 **실행 처리량을 깎는다.** 전용 쌍으로 이 오염을
원천 차단한다(메커니즘은 동일, 컬럼만 분리). 종단 행은 실행 claim 술어(RUNNING/PENDING 한정)에
절대 안 걸리므로 두 lease가 같은 행에서 경합할 일도 없다.

```sql
-- tx1: 종단-미알림 파이프라인 claim (RUNNING 스캔과 별개 술어; 개념 표현)
SELECT id FROM pipeline
 WHERE status IN ('DONE','FAILED','CANCELLED')
   AND notified_at IS NULL
   AND (notify_next_at IS NULL OR notify_next_at <= now())
   AND (notify_claimed_until IS NULL OR notify_claimed_until < now())
 ORDER BY notify_next_at ASC, id ASC   -- NULL 선두(신규 종단), id로 deterministic tie-break
 LIMIT 1
 FOR UPDATE SKIP LOCKED;            -- MySQL8; 구현은 @Lock + lock-timeout -2
UPDATE pipeline SET notify_claimed_by = :fresh_uuid,     -- per-claim fencing
       notify_claimed_until = now() + :lease
 WHERE id = :id;                   -- tx1 SELECT가 집은 그 행만(전체 테이블 아님)
```

- **외부 호출** — 알림 sink에 전달(트랜잭션 밖, per-call 타임아웃).
- **tx2(guarded write-back)** — 성공 시
  `SET notified_at = now(), notify_claimed_by = NULL, notify_claimed_until = NULL WHERE id = :id AND notify_claimed_by = :token`
  (ADR-021 §4 fencing과 동형). 실패 시 아래 실패 경로.

이로써 ADR-021 §3의 **two-transaction split**(락을 외부 호출에 물리지 않는다)과 fencing이
그대로 적용된다 — **standalone relay가 재발명해야 했던 lease 문제가 애초에 발생하지 않는다.**
종단 알림은 위의 **자체 claim 쿼리**(별도 술어)를 쓰며, 전용 loop로 돌리거나 공유 워커에
claim 쿼리를 하나 더 두는 식으로 구현한다(둘 다 안전 — guarded write-back 동일, lease
비경합). 어느 쪽이든 종단 행에는 READY task도, 의미 있는 `cancel_requested`도, slot-gate도
없으므로 ADR-021의 RUNNING 전용 분기(cancel 체크→slot gate→execute_step)를 타지 않는다.

**실패 경로(backoff + give-up).** 전달 실패 시 tx2는 `notify_attempts += 1`,
`notify_next_at = now() + backoff(notify_attempts)`(상한 있는 지수 backoff, ADR-021의
429/503→next_due_at 밀기와 동형), 클레임 해제. `notify_attempts`가 상한(`maxAttempts`)에
도달하면 **give-up**: `notify_next_at`을 far-future로 밀어 자동 재시도를 멈추고 **운영
알림으로 승격**(§3, 사람이 개입). give-up 행은 여전히 `notified_at IS NULL`이므로 파생
쿼리상 “미알림”으로 남지만, 건전성 지표 **“가장 오래된 미알림 행 age”는 give-up을
제외**(`notify_attempts < maxAttempts`)해 정의하고 give-up 행은 **별도 카운트**(§4)로
감시한다 — give-up이 pending age를 무한히 오염시키지 않게 한다. 별도 dead-letter 테이블은
두지 않는다(파생 술어 + `notify_attempts`로 충분). **재시도 재개**는 sink를 고친 뒤 운영자가
`notify_attempts`를 리셋하고 `notify_next_at`을 `now()`로 되돌리면 된다(구현 문서 §5) —
give-up은 영구 폐기가 아니라 “자동 재시도 중단 + 사람 개입 요청”이다.

**채널 gate — 미설정/비활성 sink는 전달 시도가 아니다.** 활성 채널이 없으면(미설정 또는
`enabled=false`) notifier는 **claim 자체를 하지 않고 idle**한다. 즉 `notify_attempts`를 올리지
않고 backoff/give-up도 타지 않는다 — 종단 행은 `notified_at IS NULL`로 **보존**되고, 채널이
(재)활성화되면 그대로 소급 발화한다(§4). “전달 실패”(→attempts++)는 **활성 채널에 실제로
호출했으나 실패**한 경우로 한정한다. 채널 down 기간은 “전달 대기 age”가 아니라 별도 지표
(채널 활성 여부 + 비활성 지속시간)로 감시한다.

**실행 워커풀과 격리.** 느린/죽은 sink가 파이프라인 실행을 굶기지 않도록, 종단 알림은
**전용 스레드풀(또는 별도 워커 loop)**에서 처리하거나 notify 클레임에 작은 동시성 상한을
둔다. 종단 알림 클레임은 ADR-021의 `runningPipelineCap`/`slotCap`에 **계상하지 않는다**
(그 캡은 `status='RUNNING'`만 센다).

**보장:**
- **at-least-once 전달.** `notified_at`은 **한 번만 찍히는 상태 마커**(파이프라인당 종단
  알림 *상태* 1개)이지만 **외부 전달은 at-least-once** — 전달 성공 후 `notified_at` 기록
  전 크래시/타임아웃/lease 만료로 **중복 전달이 가능**하다. 따라서 **소비자는 멱등해야
  한다**(`pipeline_id`로 dedupe — 파이프라인당 종단은 하나이므로 `pipeline_id`만으로 충분).
  순서: 파이프라인당 알림 상태가 1개라 파이프라인 내부 순서 문제는 없고, 같은 target의
  이전/이후 파이프라인 알림은 `pipeline_id` 키로 소비자가 구분한다.
- **stale straggler 안전.** lease 만료 뒤 되살아난 워커의 tx2는 `claimed_by` 가드에서
  no-op(ADR-021 §4) — 이중 스탬프·클로버 없음.
- **`notified_at`의 의미**: “sink가 durable하게 수신(ack)”이지 “모든 다운스트림이 봤다”가
  아니다. sink가 내부적으로 fan-out하면 그 신뢰성은 sink 책임이다.

**V1은 단일 논리 sink**(오퍼레이터 알림 서비스/웹훅 하나)를 가정한다. 서로 독립적으로
재시도돼야 하는 다중 sink가 실제로 필요해지면 per-sink 전달 상태(또는 그때 비로소 작은
outbox)를 도입한다 — 지금은 만들지 않는다.

### 3. 운영 알림(worker-outage/queue-wait)은 이 메커니즘 밖 — 기존 metrics/alerting

`WORKER_OUTAGE`/`QUEUE_WAIT`는 상태 전이가 아니라 **지표 임계**에서 나오며(도메인 행이
없다), 원자성을 물릴 상태 전이도 없다. ADR-021이 이미 정의한 지표(lease-expired reclaim
count, due-pipeline lag)에 대한 **임계 알림으로, 조직이 이미 운영하는 metrics/alerting
스택**에서 처리한다. 이 ADR의 상태-파생 알림 경로에 억지로 태우지 않는다(그렇게 하면
도메인 행 없는 이벤트를 위해 범용 이벤트 저장소를 되살려야 한다). 알림 flapping 방지를
위한 dedupe 키/윈도우·open/resolve는 그 스택의 규약을 따른다.

### 4. 보장과 한계(수용)

- **exactly-once 없음.** at-least-once + 멱등 소비자로 충분하다(ADR-016 §5와 같은 이유).
  2PC/분산 트랜잭션은 도입하지 않는다.
- **소비자 계약**: (a) 멱등 dedupe 키(`pipeline_id`, 파이프라인당 종단 1개)를 충분히 오래 보관,
  (b) payload에 `schema_version` 포함, (c) **PII 최소화** — 이 시스템은 PII-인접 인프라를
  다루므로 payload는 **허용 필드만**: `pipeline_id`, `type`(INSTALL/DELETE),
  `terminal_status`, `target`(**opaque 식별자 원칙** — hostname/account/DB명 같은 민감
  식별자는 지양), 실패 시 `failed_task`/`error_code`, `schema_version`. 그 외 민감 상세는
  싣지 않는다.
- **알림 지연 = 스캔 주기.** 저지연 wake-up은 필요해지면 durable 파생 위에 힌트로 얹을 수
  있으나(아래 대안) 지금은 불필요. (타깃 MySQL8은 Postgres `LISTEN/NOTIFY`가 없으므로, 필요 시
  in-process 신호나 메시지 브로커를 검토 — V1 범위 밖.)
- **미설정/비활성 sink → 적체 후 소급 발화.** 채널이 없거나 비활성이면 종단 행은
  `notified_at IS NULL`로 **적체**되고(발화 자체가 유실되진 않음 — 파생 모델의 이점),
  채널을 (재)활성화하면 backlog가 한꺼번에 발화한다. 짧은 sink 다운타임 뒤엔 “그동안 뭐가
  끝났나”를 받는 이점이지만, 오래 꺼져 있었으면 **알림 폭주**가 될 수 있다. 내부 도구
  규모에서 폭주는 수용 가능하되, 문제가 되면 **활성화 시점에 기존 종단 행을 ack 처리
  (backfill `notified_at`)하는 정책**을 구현에서 택한다(구현 문서 소관, V1 기본은 소급 발화).
- **알림 전용 지표**: 미알림(전달 대기, give-up 제외 = `notify_attempts < maxAttempts`) 종단
  행 최고 age, notify 재시도/실패 수, give-up 승격 수(사람 개입 필요 신호). ADR-021 워커
  지표만으로는 알림 정체를 볼 수 없으므로 별도로 둔다.

## 고려한 대안

| 대안 | 판정 | 이유 |
|---|---|---|
| **A. 상태 파생 + `notified_at`(claim/lease 재사용)** | **채택** | 이벤트가 이미 도메인 행에 있어 dual-write 없음; ADR-021 claim/lease/two-tx를 그대로 재사용해 relay-lease 문제 없음; 새 테이블·relay·pruner 0. |
| B. 트랜잭션 아웃박스(별도 `event_outbox` + relay) | 기각 | 이벤트가 이미 `pipeline.status`에 있어 별도 저장소가 불필요; relay는 외부 전달에 lease가 필요한데 "SKIP LOCKED만"으로는 락을 외부 호출에 물리거나(ADR-021 §3 위반) 이중 전달이 남음; 다중 sink·poison·pruner를 새로 떠안음; ADR-016이 이미 잘라낸 메커니즘. |
| C. 전이 트랜잭션 내 동기 알림 호출 | 기각 | dual-write; 느린/실패 알림이 상태 전이를 롤백·차단; 상태 정합성이 알림 서버에 종속. |
| D. 커밋 후 best-effort 알림 | 기각 | 커밋~알림 사이 크래시로 조용히 유실; 재시도·복구 없음. |
| E. CDC/브로커(Debezium/Kafka) | 기각 | 규모 대비 운영 비용 과다. 이미 DB를 소유하므로 “상태 스캔 파생”이 같은 아이디어의 경량판이고 그것으로 충분. |
| F. 저지연 wake-up 힌트(브로커/in-process 신호) | 유보(선택) | 상태-파생을 대체하진 못하나, 스캔 폴링 대신 저지연 wake-up 힌트로 얹을 수 있다. 타깃 MySQL8엔 Postgres `LISTEN/NOTIFY`가 없어 in-process 신호나 브로커가 후보. 지연이 문제될 때 도입, V1 불필요. |
| G. 알림 상태를 `pipeline` 컬럼이 아닌 1:1 사이드카 테이블(`pipeline_notification`)로 분리 | 기각 | “핵심 aggregate 오염 회피”가 동기지만, 파이프라인당 정확히 1행이라 실질은 컬럼과 동형이고 claim마다 join·수명주기(고아 행 정리) 부담만 는다. 알림 메타데이터는 ADR-021이 실행 메타데이터(`claimed_by` 등)를 `pipeline`에 둔 것과 **같은 범주**이며(도메인 상태 컬럼 아님), 종단 파생 claim이 같은 행을 이미 잠그므로 별 테이블의 이득이 없다. 다중 sink가 실제로 필요해지면 그때 per-sink 상태 테이블로 분리(§2 말미)—그 전엔 불필요. |

## 결과

### 좋은 점

- **신뢰성 있는 종단 알림**을 dual-write·별도 저장소 없이 얻는다 — 이벤트가 이미 도메인
  행에 있고, 전달은 ADR-021의 검증된 claim/lease **메커니즘**(two-tx·fencing)을 탄다.
- **relay-lease 딜레마가 원천 소멸.** 알림이 `pipeline` 행 작업이라 ADR-021의 two-tx
  split·fencing이 그대로 적용된다(별도 relay가 lease를 재발명할 필요 없음).
- **움직이는 부품 최소.** 알림 전달용 새 테이블·relay·pruner·이벤트 taxonomy 없음
  (`pipeline`에 알림 메타데이터 컬럼 + 스캔 술어/분기 하나). **V1 sink는 Slack** 하나이며,
  채널 설정만 단일 행 테이블 하나로 admin이 관리한다(구현 문서).
- **ADR-016 취지와 일치.** 잘라냈던 outbox를 되살리지 않고, “도메인 행 + logs/metrics”
  원칙을 지킨다. 도메인 상태(`status`·enum)는 불변.

### 수용하는 비용

- **`pipeline`에 알림 메타데이터 컬럼 5개 추가**(`notified_at`/`notify_next_at`/
  `notify_attempts` + notify 전용 lease 쌍 `notify_claimed_by`/`notify_claimed_until`, ADR-021
  실행 컬럼과 동일 범주). 종단-미알림 파이프라인을 집는 claim 술어·인덱스·워커 분기가
  하나씩 늘어난다.
- **at-least-once → 멱등 소비자 필수**(`pipeline_id`만으로 dedupe — 파이프라인당 종단 1개;
  `terminal_status`는 payload 정보이지 dedupe 키가 아니다).
- **알림 지연 = 스캔 주기.** 저지연이 필요하면 §4의 wake-up 힌트를 나중에 도입.
- **다중 독립 sink는 V1 범위 밖** — 필요해질 때 per-sink 상태를 도입.
- **알림 전달을 실행 워커풀에서 격리**해야 한다(전용 풀/loop 또는 notify 클레임 상한) —
  느린 sink가 파이프라인 실행을 굶기지 않도록. relay를 없앤 대가로 이 격리를 명시적으로
  져야 한다(§2).
- **회귀(수용): per-event 감사 추적 상실.** outbox는 이벤트당 durable 행을 남겼지만 이제
  파이프라인당 `notified_at` 1개뿐 — “무엇을 언제 몇 번 보냈나”는 로그/지표로만 재구성.
  내부 도구 수준에서 수용하며, 규제/감사 요건이 생기면 재검토.
- **회귀(수용): 종단만·1회성.** 상태 파생은 durable 종단에서만 발화하므로 중간 이벤트
  (“시작됨”·“step N 완료”·“task 재시도”)나 성공한 파이프라인 내 **transient task 실패**는
  이 경로로 나가지 않는다 — 그런 신호는 metrics/logs 소관. 진행 알림이 제품 요구가 되면
  이 모델로는 부족하다(그때 per-event 마커=outbox 재도입 필요).

## 스키마

**종단 알림** — 모두 ADR-022 소유 알림 메타데이터 컬럼으로, ADR-021의 실행
컬럼(`next_due_at`/`claimed_by`/`claimed_until`/`cancel_requested`)과 같은 범주다.
도메인 상태 컬럼이 아니다. lease 토큰은 ADR-021 것을 **공유하지 않고 notify 전용 쌍을 둔다**
(§2 근거 — 실행 admission 카운트 오염 방지).

- `pipeline.notified_at`(nullable) — 종단 알림 전달 완료(sink ack) 마커.
- `pipeline.notify_next_at`(nullable) — 실패 backoff 게이트(다음 재시도 시각).
- `pipeline.notify_attempts`(int, default 0) — backoff 지수·give-up 임계 계산용.
- `pipeline.notify_claimed_by`(nullable) / `pipeline.notify_claimed_until`(nullable) — notify 전용
  fencing 토큰 + lease.
- 새 테이블 없음(알림 전달용). claim 술어는 §2(종단 + `notified_at IS NULL` + backoff 게이트 +
  notify lease 가용).
- **인덱스**: MySQL8은 부분(filtered) 인덱스가 없으므로 복합 인덱스
  `(notified_at, notify_next_at)`로 미알림 종단 행 스캔/정렬을 덮는다(status 필터는 옵티마이저에
  맡김; `active_target` 유일 제약이 부분 인덱스를 컬럼으로 대체하는 것과 같은 제약). ~2,000행
  규모에 충분하며, 대규모로 커지면 재검토.
- **Slack 채널 설정용 `notification_channel` 테이블**(단일 행)이 별도로 추가된다 — 구현 세부는
  아래 링크의 구현 문서 참조.

**불변식**

1. `notified_at`(및 `notify_next_at`/`notify_attempts`)은 알림/진단 메타데이터 — reconciler·
   claim·스케줄링·전이의 **의미**에 관여하지 않는다(claim 술어가 이 컬럼을 읽는 것은
   “알림 대상 선별”이지 도메인 전이가 아니다).
2. 종단 알림 대상은 **커밋된 종단 상태에서 파생**된다 — 전이가 durable해야만 알림 대상이
   되고, durable하면 반드시 대상이 된다(dual-write 없음, 유실 없음).
3. 알림 메타데이터 손상/롤백은 pipeline/task **도메인 상태**를 오염시키지 않는다.
   최악의 경우는 재전달(멱등 소비자가 흡수) 또는 재클레임(delay)일 뿐 부정확이 아니다.
4. **파이프라인당 종단 알림은 정확히 1회**라는 성질은 ADR-016의 **종단 상태 불변성**
   (종단 도달 후 부활 금지)에 의존한다 — 종단 행이 다시 `RUNNING`으로 되돌아가 재종단할 수
   없으므로, 한 번 찍힌 `notified_at`이 “두 번째 종단”을 잘못 억제할 여지가 없다. (파생 읽기
   모델인 ADR-023 ProcessStatus의 회귀는 `pipeline.status` 도메인 상태와 무관하다.)

## 알림/신호 분류

**현재 범위** — 종단 상태에서 파생, ADR-021 claim/lease로 전달:

| 신호 | 파생 조건 | payload 요지 |
|---|---|---|
| 파이프라인 완료 | `status = DONE` & `notified_at IS NULL` | pipeline id, type, target |
| 파이프라인 실패 | `status = FAILED` & 〃 | 위 + 실패 task와 `error_code` |
| 파이프라인 취소 | `status = CANCELLED` & 〃 | pipeline id, type, target |

- **운영 알림**(worker-outage/queue-wait) — 이 경로가 아니라 기존 metrics/alerting(§3).

## 링크

- [ADR-016](016-install-delete-pipeline-domain-model.md) — 이 ADR이 얹는 도메인 모델
  (event outbox를 “Costs we accept”로 잘라낸 원출처 — 이 ADR은 그 취지를 이어 상태 파생을
  택한다). `notified_at` 등 알림 메타데이터 컬럼은 ADR-022 소유.
- [ADR-021](021-pipeline-execution-model.md) — 알림 전달이 재사용하는 claim/lease **메커니즘**
  (claim 쿼리·lease 컬럼은 별개; §2 claim, §3 two-tx split, §4 guarded write-back, §2 「Execution schema note」).
  postCheck로 확정된 `CONDITION_CHECK`의 실행 의미(retry-count 바운드 poll)도 여기 있다.
- [022-notifier-implementation.md](../../design/pipeline/022-notifier-implementation.md) —
  이 결정의 **구현 세부 명세**(Slack sink, MySQL8/Spring, 엔티티·설정·claim/전달/write-back·
  admin 채널 관리). 그 문서만 보고 구현 가능하도록 작성.
- [adr-016-history.md](../../design/pipeline/adr-016-history.md) — event outbox 등 최대
  모델 요소가 재범위 축소로 정리된 경위.

## 용어

- **derive-from-state(상태 파생)** — 별도 이벤트 저장소 없이, 도메인 행의 상태
  (`status` 종단 + `notified_at IS NULL`)에서 알림 대상을 쿼리로 파생하는 방식. 이벤트가
  이미 상태에 있으므로 dual-write가 없다.
- **notified_at** — 파이프라인당 종단 알림 전달 완료 마커(알림 메타데이터, 도메인 상태
  아님). 한 번 찍히면 그 파이프라인은 알림 대상에서 빠진다.
- **dual-write** — DB write와 외부 부작용(알림 호출)을 한 트랜잭션 경계 안에서 함께
  시도해 부분 실패 시 갈라지는 안티패턴. 상태 파생이 이를 제거한다.

## 개정 이력

- 2026-07-01: 생성. ADR-016(Costs we accept)이 유보한 종단 알림과, 당시 함께 다루던
  postCheck 간극을 얹는 후속 결정으로 작성.
- 2026-07-01: 문서 리뷰 반영(codex/sonnet) — 인용 정확도, 범위 스코핑, 이벤트 집합 분리,
  용어 정리.
- 2026-07-01: **설계 리뷰 반영(codex xhigh 77 / opus 72 / 복잡성 over-engineered)**.
  트랜잭션 아웃박스(별도 `event_outbox` + relay + pruner)를 **상태 파생 + `notified_at`
  으로 대체** — 세 리뷰가 독립적으로 같은 대안(상태에서 파생)에 수렴했고, relay가 외부
  전달에 lease가 필요한 모순·다중 sink·poison·pruner를 한 번에 제거하며 ADR-016이 outbox를
  잘라낸 취지와 일치. 운영 알림은 기존 metrics/alerting으로 분리. `TASK_FAILED` 별도
  이벤트 제거(실패 종단 알림에 포함). 소비자 계약(schema_version·PII 최소화) 명시.
- 2026-07-01: **재설계 재리뷰 반영(codex xhigh 86 / opus 85)**. 알림 경로를 ADR-021 수준
  으로 완전 명세: 전체 claim SQL(종단 + `notified_at IS NULL` + backoff/lease 게이트),
  실패 backoff+give-up 경로(`notify_next_at`/`notify_attempts`), 실행 워커풀과의 격리,
  종단 알림을 별도 work-kind로(RUNNING 분기 앞에서 분기), “verbatim 재사용”→“메커니즘 재사용”
  으로 정정, at-least-once(중복 가능) vs `notified_at` 1회 마커 구분. 회귀를 명시적 비용
  으로 기록(per-event 감사 상실·종단만·transient task 실패 신호 상실). payload 허용 필드·
  알림 전용 지표 추가.
- 2026-07-07: **postCheck 분리 — ADR 범위를 종단 알림으로 축소.** postCheck는 ADR-016/021의
  `CONDITION_CHECK`(retry-count 바운드 probe)로 확정·구현되어 별도 결정이 불필요해졌고,
  recipe 마지막 task 배치는 ADR-016 recipe 규약에 속한다. 이에 postCheck 결정·대안·스키마·
  용어 항목을 이 ADR에서 제거하고(도메인 상태 부활 금지 등 관련 불변식은 ADR-016 §7이 계속
  보유) 파일명을 `022-terminal-state-notification.md`로 변경. origin/main(#532 PENDING 포함)
  위로 rebase.
- 2026-07-07: **구현 명세 추가 + notify lease 전용 쌍으로 정정.** buildable 구현 문서
  ([022-notifier-implementation.md](../../design/pipeline/022-notifier-implementation.md))
  작성(Slack sink, 인터페이스 없이, admin 채널 관리, MySQL8/Spring 실코드 정합). 실코드 확인
  중 발견: 실행 admission soft-cap(`countByClaimedUntilAfter`)이 상태 무관하게 활성 lease를
  세므로 ADR-021 `claimed_by`/`claimed_until` 재사용은 종단 행 notify lease로 실행 캡을 오염시킨다
  → notify 전용 lease 쌍(`notify_claimed_by`/`notify_claimed_until`)으로 분리(컬럼 3→5).
  MySQL8 부분 인덱스 부재 반영(복합 인덱스), `LISTEN/NOTIFY`는 Postgres 전용이라 저지연 옵션은
  구현 문서에서 제외.
- 2026-07-07: **정합·운영 반영(리뷰 후속).** (1) give-up 행이 “미알림 age” 지표를 무한 오염
  하던 문제 수정 — pending age를 `notify_attempts < maxAttempts`로 정의, give-up은 별도 카운트.
  (2) 미설정/비활성 sink 시 적체·소급 발화(및 backfill 대안) 명시. (3) CANCELLED payload의
  “취소 계기”가 구현 payload에 없어 overclaim → 허용 필드(id/type/target)로 정정.
  (4) 종단 알림 1회 성질이 ADR-016 종단 불변성에 의존함을 불변식 4로 명시(ADR-023 회귀와
  무관). (5) 대안 G(1:1 사이드카 테이블) 추가·기각.
- 2026-07-08: **90점 게이트 리뷰 반영(codex 86 / opus 86 수렴).** (1) **채널 gate 명시** —
  미설정/비활성 sink는 claim 자체를 안 하고 idle하므로 attempts/give-up을 소진하지 않는다
  (backlog 소급 발화 보장과 give-up 로직의 충돌 해소; “전달 실패”를 활성 채널 실호출 실패로
  한정). (2) **소비자 dedup 계약 통일** — `pipeline_id`만(§2·§4 불일치 제거; `terminal_status`는
  payload 정보이지 키 아님). (3) claim `UPDATE`에 `WHERE id = :id` 명시(전체 테이블 오독 방지),
  `ORDER BY notify_next_at ASC, id ASC` tie-break. (4) **ADR↔구현 정합** — 구현 문서
  `oldestUnnotifiedAt`에 `notifyAttempts < maxAttempts` 필터 + `countGivenUp` 추가(§4 give-up
  지표 정의를 실제 쿼리로 구현). (5) give-up 재개 경로(admin 리셋) 명시, payload `target`
  opaque 원칙, V1 sink=Slack 명시, “그대로 재사용”→“메커니즘 재사용”으로 잔여 표현 정정.
