# ADR-022: Install/Delete 파이프라인 — 완료 검증(postCheck)과 트랜잭션 이벤트 아웃박스(eventOutbox)

## 상태

제안됨 — 2026-07-01.

[ADR-016](016-install-delete-pipeline-domain-model.md)(도메인 모델)·
[ADR-021](021-pipeline-execution-model.md)(실행 모델)의 **후속 두 가지**를 다룬다 —
**eventOutbox는 ADR-016이 유보하고(ADR-021은 관련 지표만 정의) 아직 방출 경로가 없는
사항**이고, **postCheck는 그 위에서 새로 식별한 간극**이다.

- ADR-016 「Costs we accept」(원문 축약 인용):
  *"No full per-call audit ledger or event outbox. … Worker-outage and queue-wait
  alerts are deferred."*
- ADR-021은 worker-outage/queue-wait를 감지할 **지표**(lease-expired reclaim count,
  due-pipeline lag)를 정의하지만, 그것을 알림으로 **방출하는 경로는 없다.**
- ADR-016 초기 최대 모델(Option B)에 있던 `event outbox`는 재범위 축소 때 제거되었고
  (design/pipeline/adr-016-history.md 참조), `postCheck`(자기 보고와 무관한 end-state
  검증)는 아직 어느 ADR에서도 다루지 않은 후속 과제였다.

이 ADR은 그 두 개념을 얹되, **현재 결정(게이팅 postCheck + eventOutbox)은 ADR-016의
도메인 테이블을 바꾸지 않는다**(유보된 자문 postCheck를 실제 도입할 때만 `pipeline`에
컬럼 하나가 추가된다 — 「수용하는 비용」·「스키마」 참조). ADR-016/021의 불변식(“DB row가
곧 상태”, at-least-once + 멱등성, 종단 상태 부활 금지, 개념 최소화)을 그대로 상속하고,
실행 substrate는 ADR-021의 `SKIP LOCKED` 선점 기법을 재사용한다(relay는 batch claim,
자문 postCheck는 도입 시 claim/lease까지 — 아래 참조).
**postCheck·eventOutbox 정책은 이 ADR 소관**이며 그 변경은 이 ADR만 대체한다. 단
유보된 자문 postCheck를 도입해 `pipeline`에 컬럼을 더할 때는 그 스키마 확장이 ADR-016
소유이므로 ADR-016의 Schema·Links도 함께 갱신한다. claim-pull 실행 모델 변경은 ADR-021 소관.

## 맥락

### postCheck — “작업이 끝났다”와 “인프라가 실제로 원하는 상태다”의 간극

ADR-016 §5의 완료 판정 `check(attempt, task) → done?`은 **InfraManager가 자기 보고한
job 결과**(최신 attempt 행)를 읽어 “job이 성공적으로 끝났는가”를 답한다. 이는
“대상 인프라가 지금 의도한 상태인가”와 다르다. 둘이 어긋나는 경우:

- INSTALL: job은 성공 보고했지만 리소스가 **eventual-consistency**로 아직 조회 불가.
- 부분 적용: apply가 절반만 반영됐는데 job 호출 응답에는 드러나지 않음(silent partial).
- DELETE: job은 성공 보고했으나 의존 리소스(PII 저장소 등)가 남아 있음.

즉 **자기 보고를 신뢰하는 완료 판정**만으로는 종단 상태의 실제 정합성을 보장하지 못한다.
end-state를 **독립적으로 재확인**하는 수단이 필요하다.

### eventOutbox — 상태 전이에 반응하는 신뢰성 있는 이벤트 방출

파이프라인이 `DONE`/`FAILED`/`CANCELLED`에 도달해도 오퍼레이터·다운스트림에 **신뢰성
있게 알릴 경로가 없다.** 순진한 두 가지 방법은 모두 틀렸다.

- **tx2 안에서 알림 호출**: 상태 전이(DB write)와 외부 알림 호출을 하나로 묶는
  **dual-write**. 알림이 성공했는데 tx2가 롤백되면(또는 반대) 상태와 알림이 갈라지고,
  느린 알림 서버가 상태 전이를 막는다 — 상태 정합성이 알림 서버 가용성에 종속된다.
- **커밋 후 best-effort 알림**: 커밋과 알림 호출 사이에 크래시가 나면 이벤트가 **조용히
  유실**된다(ADR-021 §3 two-transaction split의 커밋/외부호출 경계와 유사한 창 —
  다만 방향이 반대다: §4 window (b)는 외부호출 후 크래시라 멱등 재실행으로 복구되지만,
  여기서는 커밋 후 유실이라 복구 불가 — 그래서 아웃박스가 필요하다).

두 개념은 자연스럽게 짝을 이룬다: **postCheck의 자문 결과도 이벤트가 되고, eventOutbox는
이를 포함한 상태 전이·운영 알림 이벤트를 하나의 신뢰성 있는 경로로 전달한다.**

### 규모(ADR-016/021과 동일)

대상 ~2,000개, 분 단위 job. 이 규모는 CDC/브로커 같은 무거운 이벤트 인프라를 정당화하지
않는다 — 아웃박스 테이블 하나 + 단순 relay로 충분하다.

## 결정

### 1. postCheck는 “게이팅”이 기본, “종단 후 자문(advisory)”은 필요 시에만

completion check(자기 보고 신뢰)와 별개로 **end-state를 독립 검증**하는 것이 postCheck다.
검증이 **파이프라인 성공 자체를 게이팅해야 하는지**로 배치가 갈린다(여기서 “게이팅”은
파이프라인 성공 판정을 막는다는 뜻으로, ADR-021 §7의 admission/slot “게이트”와는 다른
층위다).

**(A) 게이팅 postCheck — 기본. 기존 `CONDITION_CHECK`를 재사용.**
recipe의 **마지막 task**로 `CONDITION_CHECK`를 둔다. 새 task kind도, 새 상태도, 새
실패 의미도 없다(ADR-016의 개념 최소화 원칙). end-state 계약을 단언한다. 실패 시 여느
CONDITION_CHECK처럼 `maxFailCount`에서 task가 `FAILED`가 되고(ADR-016 §6), 파이프라인
상태는 그 task 전이의 projection이므로 파이프라인도 `FAILED`로 귀결된다(ADR-016 §2의
상태 머신·projection 규칙). 예: INSTALL의 “리소스 조회 가능”, DELETE의 “리소스 소멸 확인”.
**이 경우 새 메커니즘은 전혀
필요 없다 — recipe 작성 규약일 뿐이다.**

**(B) 종단 후 자문 postCheck — 파이프라인이 `DONE`을 커밋한 *뒤* 검증해야 할 때만.**
드리프트 감지, 파이프라인이 기다릴 의사가 없는 장기 eventual-consistency,
크로스 시스템 재조정처럼 **종단 이후**에 확인해야 하는 경우다. 규칙:

- **종단 상태를 절대 부활시키지 않는다**(ADR-016 §7). 이미 `DONE`인 파이프라인을
  검증 실패로 `FAILED`로 되돌리지 않는다 — 그것이 자문(advisory)인 이유다.
- 파이프라인/task **도메인 상태에 대해 read-only**. claim·스케줄링·전이는 이를 읽지 않는다.
- 결과를 진단용 행(`post_check`의 최신 1행 — ADR-016 관측 테이블과는 별개)에
  기록하고, **이벤트를 방출**한다
  (`POST_CHECK_OK` / `POST_CHECK_MISMATCH`) — eventOutbox를 통해.
- 별도 스케줄러를 만들지 않는다. 필요해지면 ADR-021의 `SKIP LOCKED` 기반 claim/lease
  패턴을 재사용한다(스캔 대상·predicate는 별도 — RUNNING 파이프라인이 아니라
  `post_check_due_at`이 도래한 행): 파이프라인이 `DONE`에 도달하는 tx2에서
  `post_check_due_at`을 seed하고, worker가 그 행을 집어 검증 호출을 돌린 뒤 결과 기록·
  이벤트 방출·`post_check_due_at` 클리어를 한다.

(B)는 **구체적 드리프트 감지 요구가 생기기 전까지 유보한다**(테이블·컬럼·scan 확장은
그때 도입). 스펙만 못박고 코드는 만들지 않는다 — ADR-016/021이 견지한 “필요할 때까지
만들지 않는다”는 자세를 따른다.

### 2. eventOutbox는 트랜잭션 아웃박스 — 상태 전이와 같은 트랜잭션에서 이벤트를 쓴다

상태 전이가 일어나는 **바로 그 트랜잭션 안에서** 이벤트 행을 INSERT한다. dual-write를
없애는 핵심이다.

- **상태 전이 이벤트**는 **그 전이를 커밋하는 트랜잭션**에 편승한다. 보통은 tx2(ADR-021
  §4의 report 트랜잭션)이지만, **유휴 파이프라인 즉시 취소(ADR-021 §6 Case A)는 API
  cancel 트랜잭션**이 `CANCELLED`를 커밋하므로 그 트랜잭션이 `event_outbox` 행을 INSERT한다.
  어느 경우든 `status`를 전이시키는 동일 트랜잭션이 이벤트를 함께 INSERT한다 — 이벤트는
  **상태 전이가 커밋된 경우에만, 그때 정확히** 존재한다(원자적).
- **운영 알림**(상태 전이에서 나오지 않는 것: worker-outage, queue-wait)은 편승할 tx2가
  없다. 이는 **모니터/스캔 관측에서 파생**되며, 모니터가 자신의 트랜잭션에서 같은
  `event_outbox`에 쓴다. 이렇게 **모든 이벤트가 하나의 신뢰성 있는 전달 경로**를 공유한다.

### 3. relay가 아웃박스를 out-of-band, at-least-once로 전달한다

별도 relay 루프가 미전송(`sent_at IS NULL`) 행을 `id` 순으로 읽어 각 sink(알림 서비스,
알림 채널, 다운스트림 sync)에 전달하고 `sent_at`을 찍는다.

- **at-least-once.** 전달 성공 후 `sent_at` 기록 전에 크래시하면 재전달된다 — ADR-016의
  at-least-once 철학과 동일. 따라서 **소비자는 멱등해야 한다**(`event_id`로 dedupe).
- **동시 relay 안전.** relay가 여럿이어도 ADR-021의 `FOR UPDATE SKIP LOCKED`로 행을
  집으면 **동시에 같은 행을 처리하지 않는다**(락 창 안에서). 다만 전달 성공 후 `sent_at`
  기록 전 크래시는 위 at-least-once대로 재전달될 수 있다 — 배타는 동시성 한정이다.
  여기서 재사용하는 것은 ADR-021의 `SKIP LOCKED` **batch claim**뿐이다(lease/fencing
  토큰은 불필요 — outbox 행에는 `claimed_by`/`claimed_until` 컬럼이 없다; 스캔 대상도
  `event_outbox` 미전송 행으로 별도).
- **`attempt_count`/`last_error`**로 재시도·poison 가시성을 남긴다. 상한 초과 행은
  전달을 멈추고 **지표/모니터링으로 노출**한다(아웃박스 이벤트가 아니라 운영 지표) —
  파이프라인 상태에는 영향 없음.

### 4. 아웃박스는 방출 전용 — 도메인 상태가 아니다

`event_outbox`/`post_check` 유실·재생은 pipeline/task 상태를 **절대** 오염시키지 않는다
(ADR-016 관측 테이블과 동일한 입장). reconciler·claim·스케줄링·전이는 이를 읽지 않는다.
전송 완료 행은 보존 기간(N일) 후 **단순 주기적 delete로 정리**한다 — 관측 테이블(attempt
수로 상한)과 달리 아웃박스는 무한 증가하므로 pruner가 정당하다.

### 5. 이벤트 순서와 전달 보장의 한계(수용)

- **전역 순서 보장 없음.** relay가 `id` 순으로 읽어도 다중 relay/재시도로 전역 순서는
  보장하지 않는다. 소비자는 순서 비의존적이거나 `aggregate_id` 단위로만 순서를 가정한다.
- **정확히-한-번(exactly-once) 없음.** at-least-once + 멱등 소비자 조합으로 충분하다
  (ADR-016 §5와 같은 이유). 분산 트랜잭션/2PC는 도입하지 않는다.

## 고려한 대안

### postCheck

| 대안 | 판정 | 이유 |
|---|---|---|
| **A. 게이팅=트레일링 CONDITION_CHECK(기본) + 종단 후 자문(필요 시)** | **채택** | 흔한 경우는 기존 task kind 재사용(새 개념 0); 자문 모드는 드리프트 감지 필요 시에만. |
| B. 새 `POST_CHECK` task kind 도입 | 기각 | CONDITION_CHECK와 동작이 같은데 enum 값만 늘림 — ADR-016의 개념 최소화 원칙 위반. |
| C. 종단 후 mismatch 시 파이프라인을 `FAILED`로 되돌림 | 기각 | ADR-016 §7 “종단 상태 부활 금지” 위반. 올바른 신호는 자문 이벤트다. |

### eventOutbox

| 대안 | 판정 | 이유 |
|---|---|---|
| **A. 트랜잭션 아웃박스(tx2에서 이벤트 write, relay가 전달)** | **채택** | dual-write 없음; 상태와 원자적; at-least-once가 멱등 소비자 모델에 부합; claim-pull 재사용. |
| B. tx2 안에서 동기 알림 호출 | 기각 | 트랜잭션+외부호출 dual-write; 실패/지연 알림이 상태 전이를 롤백·차단; 상태 정합성이 알림 서버 가용성에 종속. |
| C. 커밋 후 best-effort 알림(아웃박스 없음) | 기각 | 커밋~알림 사이 크래시로 이벤트 조용히 유실; 재시도·감사 없음. |
| D. 풀 CDC/브로커(Debezium/Kafka) | 기각 | ~2,000 대상·분 단위 규모에 운영 비용 과다; 아웃박스 테이블+단순 relay로 충분. |

## 결과

### 좋은 점

- **신뢰성 있는 알림/이벤트**를 dual-write 없이 얻는다 — 상태 전이와 원자적.
- **현재 결정은 ADR-016의 `pipeline`/`task` 도메인 상태 테이블을 변경하지 않는다.**
  게이팅 postCheck는 순수 recipe 규약(enum·상태 그대로), eventOutbox는 tx2에 INSERT 한 줄과
  **별개의 신규** 방출 전용 테이블 `event_outbox`만 추가한다(도메인 테이블은 손대지 않음).
  (유보된 자문 postCheck는 예외 — 아래 비용 참조.)
- **실행 substrate 재사용.** relay는 ADR-021의 `SKIP LOCKED` batch claim을, 자문 postCheck는
  claim/lease까지 재사용 — 새 스케줄러·리더·저널 없음.
- **자기 보고와 실제 상태의 간극을 검증**할 수단(postCheck)이 명시된다.

### 수용하는 비용

- **새 테이블 `event_outbox` + relay 루프**(+ 전송 완료 행 pruner)의 운영 무게를 수용한다.
  dual-write 없이 신뢰성 있는 알림을 하려면 불가피하다.
- **at-least-once → 멱등 소비자 필수.** 소비자가 `event_id`로 dedupe해야 한다.
- **전역 순서·exactly-once 미보장**(위 §5). 규모상 수용.
- **종단 후 자문 postCheck 메커니즘은 유보** — 드리프트 감지 요구가 생기면 그때 도입.
  구현 시에는 **ADR-016의 `pipeline` 테이블에 컬럼 하나(`post_check_due_at`)와 `post_check`
  테이블이 추가**된다 — 즉 그 시점에는 도메인 테이블이 한 번 확장된다(현재 결정 범위 밖).

## 스키마

**이벤트 아웃박스**

- `event_outbox(id, event_type, aggregate_type, aggregate_id, payload,
  created_at, sent_at, attempt_count, last_error)`
  - `sent_at IS NULL` = 미전송. relay가 `FOR UPDATE SKIP LOCKED`로 집어 전달 후 `sent_at` 기록.
  - `aggregate_type`/`aggregate_id`: 이벤트의 출처(예: `PIPELINE`/pipeline.id).
  - `payload`: 소비자가 필요로 하는 최소 바디(멱등 dedupe용 `event_id`는 `id`로 충분).
  - `attempt_count`/`last_error`: 재시도·poison 가시성.

**종단 후 자문 postCheck — 미래 확장 스키마(현재 미구현, 현재 결정 범위 밖)**

> 아래는 자문 모드를 실제로 도입할 때의 스키마이며, **지금은 만들지 않는다.** 이 블록만
> 유일하게 ADR-016의 도메인 테이블(`pipeline`)을 건드린다.

- `post_check(id, pipeline_id, status, checked_at, detail)` — 자문 검증 1회 결과.
  `status ∈ {OK, MISMATCH}`. 도메인 상태 아님(read-only 방출용). **신규 테이블.**
- `pipeline.post_check_due_at` — 파이프라인 tx2에서 `DONE` 전이 시 seed(자문 모드일 때만).
  **ADR-016 `pipeline` 테이블에 추가되는 컬럼.**

`post_check`는 파이프라인당 **최신 결과 1행만 UPDATE-in-place로 유지**한다(반복 이력
없음; ADR-016 `task_check`와 동일 방식).

**관계**: `event_outbox`는 `aggregate_type`/`aggregate_id`로 출처를 가리키며,
pipeline 관련 이벤트(`TASK_FAILED` 포함)는 pipeline에 논리적으로 귀속된다.
`pipeline 1:0..1 post_check`는 위 유보 스키마 도입 시에만 성립.

**불변식**

1. `event_outbox`/`post_check`는 방출 전용 — reconciler·claim·스케줄링·전이가 읽지 않는다.
2. 상태 전이 이벤트는 **그 전이를 커밋하는 동일 트랜잭션**(tx2, 또는 즉시 취소 시 API
   cancel tx)에서만 INSERT된다(원자성).
3. 아웃박스 행은 상태와 함께 커밋되어 durable하며, 전송 완료 후에만 pruning된다. 설령
   행이 유실/재생되더라도 pipeline/task **상태**는 오염되지 않는다(ADR-016 관측 테이블과
   동일한 상태-무결성 보장). 전달 신뢰성 자체는 relay 재시도 + at-least-once가 담당한다.

## 이벤트 분류(초기 event_type 집합)

현재 결정에 속하는 이벤트와, 유보된 자문 postCheck를 도입할 때 추가되는 이벤트를 구분한다.

**현재 범위**

| event_type | 출처 | 계기 |
|---|---|---|
| `PIPELINE_DONE` | tx2 | 파이프라인 `RUNNING → DONE` |
| `PIPELINE_FAILED` | tx2 | 파이프라인 `RUNNING → FAILED` |
| `PIPELINE_CANCELLED` | tx2 / API cancel tx | 파이프라인 `RUNNING → CANCELLED`(협력 취소는 tx2, 즉시 취소는 API tx — ADR-021 §6) |
| `TASK_FAILED` | tx2 | task가 `maxFailCount`에서 `FAILED`(ADR-016 §6) |
| `WORKER_OUTAGE` | 모니터 | lease-expired reclaim 급증(ADR-021 지표) |
| `QUEUE_WAIT_EXCEEDED` | 모니터 | due-pipeline lag 임계 초과(ADR-021 지표) |

**유보 모드 전용**(자문 postCheck 도입 시 추가)

| event_type | 출처 | 계기 |
|---|---|---|
| `POST_CHECK_OK` | 자문 postCheck | 종단 후 end-state 확인 |
| `POST_CHECK_MISMATCH` | 자문 postCheck | 종단 후 end-state 불일치 |

## 링크

- [ADR-016](016-install-delete-pipeline-domain-model.md) — 이 ADR이 얹는 도메인 모델
  (event outbox·worker/queue 알림을 “Costs we accept”로 유보한 원출처).
- [ADR-021](021-pipeline-execution-model.md) — relay·자문 postCheck가 재사용하는
  claim-pull 실행 모델.
- [adr-016-history.md](../../design/pipeline/adr-016-history.md) — event outbox 등 최대
  모델 요소가 재범위 축소로 정리된 경위.

## 용어

- **completion check** — ADR-016 §5의 `check(attempt, task)`. InfraManager 자기 보고
  결과를 읽어 task 완료를 판정. **postCheck와 다르다**(자기 보고 vs 독립 end-state 검증).
- **postCheck** — end-state를 독립 검증. 게이팅(트레일링 CONDITION_CHECK) 또는 종단 후
  자문(read-only, 부활 금지, 이벤트 방출) 두 가지 배치 방식.
- **트랜잭션 아웃박스** — 상태 전이와 같은 트랜잭션에서 이벤트 행을 기록해 dual-write를
  없애고, 별도 relay가 out-of-band·at-least-once로 전달하는 패턴.
- **relay** — `event_outbox`의 미전송 행을 집어 sink에 전달하고 `sent_at`을 찍는 루프.
  ADR-021의 `SKIP LOCKED` batch claim만 재사용해(lease/fencing 없이) 동시 relay 이중
  전달을 막는다.
- **dual-write** — DB write와 외부 부작용(알림 호출)을 한 트랜잭션 경계 안에서 함께
  시도해 부분 실패 시 갈라지는 안티패턴. 아웃박스가 이를 제거한다.

## 개정 이력

- 2026-07-01: 생성. ADR-016(Costs we accept)이 유보한 event outbox와 아직 어느 ADR에서도
  다루지 않았던 postCheck를, 현재 결정 범위에서는 도메인 상태 테이블 변경 없이 얹는 후속
  결정으로 작성.
- 2026-07-01: 리뷰 반영(codex/sonnet). 인용 정확도(§6/§7→§2 projection), 범위 스코핑
  (도메인 테이블 불변 = 현재 결정 한정, 유보 자문 postCheck 컬럼은 미래 비용), 이벤트
  집합 현재/유보 분리, `post_check` cardinality 고정, relay는 claim/lease가 아닌
  `SKIP LOCKED` batch claim으로 용어 정정, 제목 “완료 후 검증”→“완료 검증”.
