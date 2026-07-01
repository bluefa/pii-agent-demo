# ADR-022: Install/Delete 파이프라인 — 완료 검증(postCheck)과 종단 상태 알림(state-derived)

## 상태

제안됨 — 2026-07-01.

[ADR-016](016-install-delete-pipeline-domain-model.md)(도메인 모델)·
[ADR-021](021-pipeline-execution-model.md)(실행 모델)의 **후속 두 가지**를 다룬다.

- **종단 알림** — 파이프라인이 종단(`DONE`/`FAILED`/`CANCELLED`)에 도달했음을 오퍼레이터·
  다운스트림에 **신뢰성 있게 알리는 경로**. ADR-016이 유보한 사항이다(ADR-021은 관련
  지표만 정의).
- **postCheck** — 자기 보고 완료 판정과 별개로 end-state를 **독립 검증**하는 수단.
  그 위에서 새로 식별한 간극이다.

**핵심 설계 방향**: 종단 전이는 **이미 `pipeline.status`에 durable하게 저장**되므로
별도 이벤트 저장소(트랜잭션 아웃박스)를 두지 않는다. 대신 `pipeline.notified_at` 마커
하나를 두고 **상태에서 알림을 파생(derive-from-state)**하며, 전달은 ADR-021의
claim/lease 실행 모델을 **그대로** 재사용한다. 이는 ADR-016이 초기 최대 모델에서 event
outbox를 잘라낸 취지("logs/metrics + domain rows로 충분")와 일치한다.

ADR-016/021의 불변식(“DB row가 곧 상태”, at-least-once + 멱등성, 종단 상태 부활 금지,
개념 최소화)을 그대로 상속한다. 이 ADR은 `pipeline`에 **알림 메타데이터 컬럼**
`notified_at`을 더한다 — 이는 ADR-021이 `pipeline`에 실행 메타데이터(`next_due_at`,
`claimed_by` 등)를 더한 것과 **같은 범주**이며(ADR-021 §2 「Execution schema note」),
도메인 상태(`status`·enum)는 바꾸지 않는다. postCheck·알림 정책은 이 ADR 소관이고 그
변경은 이 ADR만 대체한다; claim-pull 실행 모델 변경은 ADR-021 소관이다.

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

### 1. postCheck는 “게이팅”이 기본, “종단 후 자문(advisory)”은 필요 시에만

completion check(자기 보고 신뢰)와 별개로 **end-state를 독립 검증**하는 것이 postCheck다.
검증이 **파이프라인 성공 자체를 게이팅해야 하는지**로 배치가 갈린다(여기서 “게이팅”은
파이프라인 성공 판정을 막는다는 뜻으로, ADR-021 §7의 admission/slot “게이트”와는 다른
층위다).

**(A) 게이팅 postCheck — 기본. 기존 `CONDITION_CHECK`를 재사용.**
recipe의 **마지막 task**로 `CONDITION_CHECK`를 둔다. 새 task kind도, 새 상태도, 새
실패 의미도 없다(ADR-016의 개념 최소화 원칙). end-state 계약을 단언한다. 실패 시 여느
`CONDITION_CHECK`처럼 `maxFailCount`에서 task가 `FAILED`가 되고(ADR-016 §6), 파이프라인
상태는 그 task 전이의 projection이므로 파이프라인도 `FAILED`로 귀결된다(ADR-016 §2의
상태 머신·projection 규칙). 예: INSTALL의 “리소스 조회 가능”, DELETE의 “리소스 소멸 확인”.
**이 경우 새 메커니즘은 전혀 필요 없다 — recipe 작성 규약일 뿐이다.** 운영 진단에서 사전
조건 검사와 구별하려면 recipe에서 operation intent(예: postcondition)로 표기한다.

**(B) 종단 후 자문 postCheck — 파이프라인이 종단을 커밋한 *뒤* 검증해야 할 때만. 유보.**
드리프트 감지, 파이프라인이 기다릴 의사가 없는 장기 eventual-consistency, 크로스 시스템
재조정처럼 **종단 이후**에 확인해야 하는 경우다. 규칙: **종단 상태를 절대 부활시키지
않는다**(ADR-016 §7) — 이미 종단인 파이프라인을 검증 실패로 되돌리지 않고 **불일치 신호만
낸다**(그것이 자문인 이유). 도메인 상태에 read-only.

**구체적 드리프트 감지 요구가 생기기 전까지 코드도 스키마도 만들지 않는다.** 도입 시에는
아래 §2의 종단 알림과 **동일한 상태-파생 claim-pull**을 재사용한다(종단 + `post_check_due_at`
도래 = 클레임 가능한 작업; verify 호출 후 불일치면 신호 방출, `post_check_due_at` 클리어).
드리프트를 반복 관측해야 하면 결과 1행을 UPDATE-in-place로 유지한다. 그 시점의
`post_check_due_at`/결과 저장 컬럼은 ADR-022 소유 메타데이터로 추가하고 ADR-016의 Links를
갱신한다. **불일치(MISMATCH)만 방출한다 — OK는 잡음이라 만들지 않는다.**

### 2. 종단 알림은 상태에서 파생한다(derive-from-state) — 별도 이벤트 저장소 없음

`pipeline`에 nullable 컬럼 `notified_at` 하나를 둔다. 알림 대상은 **쿼리로 파생**된다:

```
status IN ('DONE','FAILED','CANCELLED') AND notified_at IS NULL
```

“전이는 커밋됐는데 알림은 아직”은 이 술어로 완전히 표현된다 — 별도 이벤트 행을 INSERT할
필요가 없다. 종단 전이 자체가 durable하므로 **dual-write가 원천적으로 없다**(전이가
커밋돼야만 알림 대상이 되고, 커밋됐다면 반드시 대상이 된다). `notified_at`은 알림
메타데이터이지 도메인 상태가 아니다 — claim·스케줄링·전이 로직은 이를 읽지 않는다.

알림 payload는 **이미 커밋된 `pipeline`/`task` 행에서 구성**한다(종단 종류, 실패 시
실패 task와 `error_code` 포함). 따라서 `TASK_FAILED`를 별도 이벤트로 둘 필요가 없다 —
`FAILED` 종단 알림이 실패 task 상세를 실어 나른다.

### 3. 알림 전달은 ADR-021의 claim/lease를 그대로 재사용한다

알림 전달은 외부 호출이다. **핵심 이점**: 알림 대상은 `pipeline` **행**이고, 그 행에는
ADR-021의 claim/lease/fencing 컬럼(`claimed_by`, `claimed_until`)이 **이미 있다.** 그래서
알림은 “종단 파이프라인에 대한 또 하나의 클레임 가능한 작업”일 뿐이며, ADR-021의
검증된 실행 모델을 **문자 그대로** 재사용한다:

- **tx1(claim)** — 위 술어로 due 행을 `FOR UPDATE SKIP LOCKED` + lease 스탬프(§2, ADR-021).
- **외부 호출** — 알림 sink에 전달(트랜잭션 밖, per-call 타임아웃).
- **tx2(guarded write-back)** — `SET notified_at = now() WHERE id = :id AND claimed_by = :token`
  (ADR-021 §4). 성공 시 클레임 해제.

이로써 ADR-021 §3의 **two-transaction split**(락을 외부 호출에 물리지 않는다)과
lease/fencing이 그대로 적용된다. 즉 **standalone relay가 재발명해야 했던 lease 문제 자체가
발생하지 않는다** — 워커 스캔에 종단-미알림 파이프라인을 집는 분기가 하나 더 붙을 뿐이다.

- **at-least-once.** 전달 성공 후 `notified_at` 기록 전 크래시 → lease 만료 후 재클레임 →
  재전달. 따라서 **소비자는 멱등해야 한다**(`pipeline_id` + 종단 종류로 dedupe).
- **stale straggler 안전.** lease 만료 뒤 되살아난 워커의 tx2는 `claimed_by` 가드에서
  no-op(ADR-021 §4) — 이중 스탬프·클로버 없음.
- **파이프라인당 알림 1회.** `notified_at`이 한 번만 찍히므로 파이프라인당 종단 알림은
  최대 1건이다 — 이벤트 순서 문제가 애초에 없다.

**V1은 단일 논리 sink**(오퍼레이터 알림 서비스/웹훅 하나)를 가정한다. 서로 독립적으로
재시도돼야 하는 다중 sink가 실제로 필요해지면 per-sink 전달 상태(또는 그때 비로소 작은
outbox)를 도입한다 — 지금은 만들지 않는다.

### 4. 운영 알림(worker-outage/queue-wait)은 이 메커니즘 밖 — 기존 metrics/alerting

`WORKER_OUTAGE`/`QUEUE_WAIT`는 상태 전이가 아니라 **지표 임계**에서 나오며(도메인 행이
없다), 원자성을 물릴 상태 전이도 없다. ADR-021이 이미 정의한 지표(lease-expired reclaim
count, due-pipeline lag)에 대한 **임계 알림으로, 조직이 이미 운영하는 metrics/alerting
스택**에서 처리한다. 이 ADR의 상태-파생 알림 경로에 억지로 태우지 않는다(그렇게 하면
도메인 행 없는 이벤트를 위해 범용 이벤트 저장소를 되살려야 한다). 알림 flapping 방지를
위한 dedupe 키/윈도우·open/resolve는 그 스택의 규약을 따른다.

### 5. 보장과 한계(수용)

- **exactly-once 없음.** at-least-once + 멱등 소비자로 충분하다(ADR-016 §5와 같은 이유).
  2PC/분산 트랜잭션은 도입하지 않는다.
- **소비자 계약**: (a) 멱등 dedupe 키를 충분히 오래 보관, (b) `pipeline`/`task` 스키마
  변화에 대비해 payload에 `schema_version`을 포함, (c) **PII 최소화** — 이 시스템은
  PII-인접 인프라를 다루므로 payload에 민감 정보를 싣지 않는다(식별자 + 상태 + error_code
  수준).
- **알림 지연 = 스캔 주기.** LISTEN/NOTIFY 등 저지연 wake-up은 필요해지면 durable 파생
  위에 힌트로 얹을 수 있으나(아래 대안) 지금은 불필요.

## 고려한 대안

### 종단 알림

| 대안 | 판정 | 이유 |
|---|---|---|
| **A. 상태 파생 + `notified_at`(claim/lease 재사용)** | **채택** | 이벤트가 이미 도메인 행에 있어 dual-write 없음; ADR-021 claim/lease/two-tx를 그대로 재사용해 relay-lease 문제 없음; 새 테이블·relay·pruner 0. |
| B. 트랜잭션 아웃박스(별도 `event_outbox` + relay) | 기각 | 이벤트가 이미 `pipeline.status`에 있어 별도 저장소가 불필요; relay는 외부 전달에 lease가 필요한데 "SKIP LOCKED만"으로는 락을 외부 호출에 물리거나(ADR-021 §3 위반) 이중 전달이 남음; 다중 sink·poison·pruner를 새로 떠안음; ADR-016이 이미 잘라낸 메커니즘. |
| C. 전이 트랜잭션 내 동기 알림 호출 | 기각 | dual-write; 느린/실패 알림이 상태 전이를 롤백·차단; 상태 정합성이 알림 서버에 종속. |
| D. 커밋 후 best-effort 알림 | 기각 | 커밋~알림 사이 크래시로 조용히 유실; 재시도·복구 없음. |
| E. CDC/브로커(Debezium/Kafka) | 기각 | 규모 대비 운영 비용 과다. 이미 DB를 소유하므로 “상태 스캔 파생”이 같은 아이디어의 경량판이고 그것으로 충분. |
| F. Postgres `LISTEN/NOTIFY` | 부분 채택(선택) | 상태-파생을 대체하진 못하나(휘발성·at-most-once), 스캔 폴링 대신 저지연 wake-up 힌트로 얹을 수 있다. 지연이 문제될 때 도입, V1 불필요. |

### postCheck

| 대안 | 판정 | 이유 |
|---|---|---|
| **A. 게이팅=트레일링 CONDITION_CHECK(기본) + 종단 후 자문(유보)** | **채택** | 흔한 경우는 기존 task kind 재사용(새 개념 0); 자문 모드는 드리프트 감지 필요 시에만. |
| B. 새 `POST_CHECK` task kind 도입 | 기각 | CONDITION_CHECK와 동작이 같은데 enum 값만 늘림 — ADR-016 개념 최소화 원칙 위반. |
| C. 종단 후 mismatch 시 파이프라인을 `FAILED`로 되돌림 | 기각 | ADR-016 §7 “종단 상태 부활 금지” 위반. 올바른 신호는 자문 방출이다. |

## 결과

### 좋은 점

- **신뢰성 있는 종단 알림**을 dual-write·별도 저장소 없이 얻는다 — 이벤트가 이미 도메인
  행에 있고, 전달은 ADR-021의 검증된 claim/lease를 그대로 탄다.
- **relay-lease 딜레마가 원천 소멸.** 알림이 `pipeline` 행 작업이라 ADR-021의 two-tx
  split·fencing이 그대로 적용된다(별도 relay가 lease를 재발명할 필요 없음).
- **움직이는 부품 최소.** 새 테이블·relay·pruner·이벤트 taxonomy 없음. `pipeline`에 알림
  메타데이터 컬럼 `notified_at` 하나 + 기존 스캔에 술어/분기 하나.
- **ADR-016 취지와 일치.** 잘라냈던 outbox를 되살리지 않고, “도메인 행 + logs/metrics”
  원칙을 지킨다. 도메인 상태(`status`·enum)는 불변.
- **자기 보고와 실제 상태의 간극을 검증**할 수단(postCheck)이 명시된다.

### 수용하는 비용

- **`pipeline`에 알림 메타데이터 컬럼 `notified_at` 추가**(ADR-021 실행 컬럼과 동일 범주).
  종단-미알림 파이프라인을 집도록 claim 술어를 확장하고 스캔에 인덱스가 필요하다.
- **at-least-once → 멱등 소비자 필수**(`pipeline_id` + 종단 종류로 dedupe).
- **알림 지연 = 스캔 주기.** 저지연이 필요하면 §5의 LISTEN/NOTIFY 힌트를 나중에 도입.
- **다중 독립 sink는 V1 범위 밖** — 필요해질 때 per-sink 상태를 도입.
- **종단 후 자문 postCheck는 유보** — 도입 시 `post_check_due_at`/결과 저장 컬럼이
  ADR-022 소유 메타데이터로 추가된다(현재 범위 밖).

## 스키마

**종단 알림(현재 결정)**

- `pipeline.notified_at`(nullable) — 알림 메타데이터 컬럼. ADR-021의 실행 컬럼
  (`next_due_at`/`claimed_by`/`claimed_until`/`cancel_requested`)과 같은 범주로,
  도메인 상태 컬럼이 아니다.
- 새 테이블 없음. 알림 대상은 `status IN (종단) AND notified_at IS NULL` 파생.
- **인덱스**: `(notified_at) WHERE status IN ('DONE','FAILED','CANCELLED')` 부분 인덱스로
  파생 스캔의 핫패스를 덮는다(ADR-021 claim-predicate 인덱스와 동일 취지).

**종단 후 자문 postCheck — 유보(현재 미구현, 범위 밖)**

> 도입 시에만 추가. 지금은 만들지 않는다. §1(B)의 상태-파생 claim-pull을 그대로 재사용한다.

- `pipeline.post_check_due_at`(nullable) — 자문 검증 due 마커(ADR-022 소유 메타데이터).
- 드리프트 이력이 필요하면 결과 1행을 UPDATE-in-place로 유지(반복 이력 없음).

**불변식**

1. `notified_at`(및 유보 시 `post_check_due_at`/결과)은 알림/진단 메타데이터 — reconciler·
   claim·스케줄링·전이의 **의미**에 관여하지 않는다(claim 술어가 이 컬럼을 읽는 것은
   “알림 대상 선별”이지 도메인 전이가 아니다).
2. 종단 알림 대상은 **커밋된 종단 상태에서 파생**된다 — 전이가 durable해야만 알림 대상이
   되고, durable하면 반드시 대상이 된다(dual-write 없음, 유실 없음).
3. 알림 메타데이터 손상/롤백은 pipeline/task **도메인 상태**를 오염시키지 않는다.
   최악의 경우는 재전달(멱등 소비자가 흡수) 또는 재클레임(delay)일 뿐 부정확이 아니다.

## 알림/신호 분류

**현재 범위** — 종단 상태에서 파생, ADR-021 claim/lease로 전달:

| 신호 | 파생 조건 | payload 요지 |
|---|---|---|
| 파이프라인 완료 | `status = DONE` & `notified_at IS NULL` | pipeline id, type, target |
| 파이프라인 실패 | `status = FAILED` & 〃 | 위 + 실패 task와 `error_code` |
| 파이프라인 취소 | `status = CANCELLED` & 〃 | 위(취소 계기) |

- **운영 알림**(worker-outage/queue-wait) — 이 경로가 아니라 기존 metrics/alerting(§4).
- **유보 모드 전용**: 자문 postCheck 도입 시 종단 후 **불일치 신호** 1종만 추가(OK 없음).

## 링크

- [ADR-016](016-install-delete-pipeline-domain-model.md) — 이 ADR이 얹는 도메인 모델
  (event outbox를 “Costs we accept”로 잘라낸 원출처 — 이 ADR은 그 취지를 이어 상태 파생을
  택한다). `notified_at` 등 알림 메타데이터 컬럼은 ADR-022 소유.
- [ADR-021](021-pipeline-execution-model.md) — 알림 전달이 **그대로** 재사용하는 claim/lease
  실행 모델(§2 claim, §3 two-tx split, §4 guarded write-back, §2 「Execution schema note」).
- [adr-016-history.md](../../design/pipeline/adr-016-history.md) — event outbox 등 최대
  모델 요소가 재범위 축소로 정리된 경위.

## 용어

- **completion check** — ADR-016 §5의 `check(attempt, task)`. InfraManager 자기 보고
  결과를 읽어 task 완료를 판정. **postCheck와 다르다**(자기 보고 vs 독립 end-state 검증).
- **postCheck** — end-state를 독립 검증. 게이팅(트레일링 CONDITION_CHECK, 파이프라인 성공
  게이팅) 또는 종단 후 자문(read-only, 부활 금지, 불일치 신호만) 두 가지 배치 방식.
- **derive-from-state(상태 파생)** — 별도 이벤트 저장소 없이, 도메인 행의 상태
  (`status` 종단 + `notified_at IS NULL`)에서 알림 대상을 쿼리로 파생하는 방식. 이벤트가
  이미 상태에 있으므로 dual-write가 없다.
- **notified_at** — 파이프라인당 종단 알림 전달 완료 마커(알림 메타데이터, 도메인 상태
  아님). 한 번 찍히면 그 파이프라인은 알림 대상에서 빠진다.
- **dual-write** — DB write와 외부 부작용(알림 호출)을 한 트랜잭션 경계 안에서 함께
  시도해 부분 실패 시 갈라지는 안티패턴. 상태 파생이 이를 제거한다.

## 개정 이력

- 2026-07-01: 생성. ADR-016(Costs we accept)이 유보한 종단 알림과, 새로 식별한 postCheck
  간극을 얹는 후속 결정으로 작성.
- 2026-07-01: 문서 리뷰 반영(codex/sonnet) — 인용 정확도, 범위 스코핑, 이벤트 집합 분리,
  용어 정리.
- 2026-07-01: **설계 리뷰 반영(codex xhigh 77 / opus 72 / 복잡성 over-engineered)**.
  트랜잭션 아웃박스(별도 `event_outbox` + relay + pruner)를 **상태 파생 + `notified_at`
  으로 대체** — 세 리뷰가 독립적으로 같은 대안(상태에서 파생)에 수렴했고, relay가 외부
  전달에 lease가 필요한 모순·다중 sink·poison·pruner를 한 번에 제거하며 ADR-016이 outbox를
  잘라낸 취지와 일치. 운영 알림은 기존 metrics/alerting으로 분리. `TASK_FAILED` 별도
  이벤트 제거(실패 종단 알림에 포함). 자문 postCheck는 상태-파생 claim-pull을 재사용하도록
  통일하고 더 강하게 유보(OK 신호 제거). 소비자 계약(schema_version·PII 최소화) 명시.
