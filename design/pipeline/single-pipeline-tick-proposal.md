# Single Pipeline Tick — 실행 모델 개정 제안

> 상태: **제안 (논의 산물, 미채택)** · 대상: ADR-016 설치/삭제 파이프라인 오케스트레이션의 **실행 모델**
> 관련: `design/pipeline/orchestrator-design.md`, `design/pipeline/minimal-redesign.md` (PR #494, 미머지)

## 0. TL;DR

기존 실행 모델은 **30초 단일 tick**이 RUNNING 파이프라인 N개를 훑어 **N개의 외부 API를 비동기 스레드로 발사**하고(D-T2), 결과는 호출 스레드가 관측 원장(`task_check`)에 적재, 상태 전이는 **다음 tick**이 수행한다(D-T4 단일-writer 분리).

이 제안은 그 부분을 다음으로 교체한다:

> **워커 스레드 N개가 각자 `파이프라인 1개 claim → 현재 task 1개 → API 1건 동기 호출 → 보고` 루프를 돈다. 한 워커가 한 파이프라인을 처음부터 끝까지 동기로 소유한다.**

- 단일 writer는 **claim(lock)이 구조적으로 보장** → D-T4의 "관측↔상태" 두-writer 분리가 **통째로 불필요**.
- 삭제: D-T2 async fire · D-T4 two-writer 분리 · `task_check` 관측 원장 · RLE · `task_attempt`.
- API call **동시성** 상한 = `min(총 워커 수, RUNNING pipeline 수)`. **QPS hard limit은 V1 밖**(429/503 backoff). TF 잡 = `slotCap` **soft admission target**.
- **멀티-pod 네이티브**(claim=SKIP LOCKED) → **leader election·replicas=1 제약 불필요**. 대가 = soft cap의 bounded overshoot(최악 `M+N−1`).

---

## 1. 배경 — 기존 모델과 그 문제

### 1.1 기존 모델 (D-T2 / D-T4)

```
[30s tick]  RUNNING 파이프라인 전수 조회
   └ 각 파이프라인의 현재 task가 due면 → 비동기 스레드로 API 발사 (N개)
        호출 스레드: 결과를 task_check 관측 원장에 기록 (status는 안 건드림)
   [다음 tick]  적재된 관측을 읽어 task.status를 CAS 전이
```

### 1.2 왜 이렇게 됐나 — 그리고 그 대가

- **문제의 출발점: API 응답시간이 예측 불가다 (200ms ~ 60s+).** 동기 단일 tick으로 N개를 직렬 호출하면 가장 느린 호출이 tick wall-time을 잡아먹고 전체 cadence를 인질로 잡는다. 그래서 기존은 **비동기 발사**를 택했다.
- **비동기라서 D-T4가 필요해졌다.** 호출 결과가 별도 스레드·임의 시각·다른 pod에서 돌아오므로, 그 스레드가 `status`를 직접 바꾸면 (a) 멀티-writer 경쟁, (b) 리더 아닌 pod의 상태 쓰기, (c) "전이 도중 죽음" 중간 상태가 생긴다. 이를 막으려 **"호출 스레드는 관측만, tick은 상태만"** 으로 쓰기 책임을 분리했다.
- **그 분리 + 관측 원장이 복잡도 1·2위다.** 한 논리적 동작("발사하고 결과 처리")이 **3개 레인(tick → 호출 스레드 → 다음 tick) · 2개 트랜잭션 · 시간차**로 흩어진다. "어느 컬럼은 누가 쓴다"는 규약을 머리에 들고 있어야 하고, crash 지점마다 일관성을 따로 추론해야 한다.

**핵심 관찰:** 비동기가 필요한 이유는 "tick이 느린 호출에 막히면 안 된다" 하나뿐이다. 관측 원장이 필요해서가 아니다. → **블로킹을 동시성(워커 N개)으로 풀면, 비동기 handoff 자체가 사라지고 D-T4도 사라진다.**

---

## 2. 제안 모델 — Claim-Pull Worker

### 2.1 워커 루프

```
while (running) {
  pipeline = claimOnePipeline();                  // ① dequeue (FOR UPDATE SKIP LOCKED)
  if (pipeline == null) { sleep(짧게); continue; } // 지금 due한 게 없음 → 잠깐 쉼

  task = currentTask(pipeline);                    // 현재 task = 최소 seq non-terminal 1개
  if (task.kind == TERRAFORM_JOB && task.status == READY) {
      if (!tryAcquireSlot()) {                     // ② TF slot soft 게이트 (count-read; §4.3)
          reschedule(pipeline, now + slotRetry);   //    만석 → next_due_at 미루고
          releaseClaim(pipeline);                  //    claim 놓고 다음으로
          continue;
      }
  }
  result = callImApi(task);                        // ③ 동기 호출 (트랜잭션 밖)
  report(pipeline, task, result);                  // ④ tx2: 전이 + slot 반납 + claim 릴리스
}
```

### 2.2 왜 단순해지나

- **단일 writer가 lock으로 보장된다.** claim하는 동안 그 파이프라인(과 현재 task)은 한 워커 독점 — 아무도 못 건드린다. 같은 워커가 호출하고, 결과 받고, 전이까지 한 흐름에 한다. → **"관측만 쓰는 호출 스레드"라는 개념 자체가 없다.**
- **동기지만 블로킹은 워커 1개만 묶는다.** 느린 호출(60s)은 자기 스레드만 점유하고, 나머지 워커 N-1개는 계속 일한다. 동시성 = N.
- **per-pipeline은 여전히 순차, cross-pipeline은 병렬.** 한 파이프라인엔 현재 task가 하나뿐이라 step 순서가 보장되고(claim이 직렬화), 서로 다른 파이프라인은 동시 진행.

---

## 3. 주요 컴포넌트

| # | 컴포넌트 | 역할 | 기존 대비 |
|---|---|---|---|
| 1 | **Worker Pool (N)** | 연속 루프 스레드 N개. tick을 대체. **API 동시성 상한 = min(N, RUNNING pipeline 수)** (§4.1) | 30s tick + async fire 삭제 |
| 2 | **Pipeline Claim** | `FOR UPDATE SKIP LOCKED`로 due 파이프라인 1개 점유 + lease 마킹. **dequeue 역할** | 신규 (lease 3컬럼) |
| 3 | **TaskMachine.advance** | 현재 task가 dispatch냐 poll이냐 판정 → 호출 → 전이 계산 | minimal과 거의 동일 |
| 4 | **TF Slot Gate** | `slotCap` **soft admission target** (TF 실행 압력 완화; hard cap이면 counter-CAS, §4.3) | slot 회계가 단일-tick → soft admit으로 이동 |
| 5 | **Report (tx2)** | 전이 + slot 반납 + claim 릴리스. **ownership CAS 가드** | task_check 적재 → 직접 전이로 대체 |
| 6 | **Backpressure** | 429/503 → `next_due_at` backoff + 릴리스 (reactive rate limit) | D-T7 유지, claim 모델에 정합 |
| 7 | **DB 스키마** | `pipeline`(+3컬럼) · `task` · `tf_slot_counter`(1행) | `task_check`·`task_attempt`·outbox 삭제 |

### 3.2 스키마 변경 (pipeline 테이블)

```
pipeline += next_due_at      timestamptz   -- 다음에 이 파이프라인을 처리할 시각 (현재 task의 cadence에서 파생)
        += claimed_by        text NULL     -- 점유 워커 토큰 (report 시 ownership CAS 가드)
        += claimed_until     timestamptz   -- lease 만료 시각 (= 인라인 reaper; 만료되면 재claim 대상)
tf_slot_counter (used int, cap int)        -- 1행. TF in-flight 세마포어
```

> `next_due_at`은 파이프라인에 둔다(claim 단위). 어차피 파이프라인당 현재 task는 하나라 task별 `next_check_at`은 여기로 접힌다 — 단일 테이블 claim 쿼리가 가능해짐.

---

## 4. 동시성 한계 관리

세 개의 서로 다른 상한이 있다. **혼동 금지: concurrency ≠ QPS, soft target ≠ hard cap.**

### 4.1 API call concurrency (≠ QPS)

- **워커 수는 API call concurrency 상한이지 QPS 상한이 아니다.** V1은 별도 hard QPS limiter를 제공하지 않는다.
- 한 워커는 한 번에 호출 1건, 한 RUNNING pipeline은 현재 task 1개 = 동시 호출 ≤1건. 따라서:

  ```
  maxConcurrentApiCalls ≤ min(totalWorkerCount, runningPipelineCount)
  totalWorkerCount       = activePodCount × workerPerPod          (워커가 pod-local이면)
  ```

- **QPS는 보장되지 않는다** — 실제 QPS는 API latency와 워커 loop cycle time에 좌우된다(빠른 호출이면 워커 1개가 초당 수 건). 그래서 *"초당 API call ≤ 워커 수"*, *"워커 수로 global QPS 보장"* 같은 표현은 **틀리다.**
- rate 협조는 **reactive**다: 429/503 → 호출 스레드가 `next_due_at`을 `Retry-After`만큼 미루고 릴리스(§6). 명시적 QPS 제한이 필요하면 **endpoint별 pod-local token bucket 또는 distributed rate limiter를 후속 결정**으로 추가(§6, V1 밖).

### 4.2 runningPipelineCap — soft admission target (hard cap 아님)

RUNNING pipeline 수 자체를 제한하려면 `runningPipelineCap = M`(선택적)을 둔다. **V1에서 이는 hard invariant가 아니라 soft admission target이다** — count-read 기반 admission이라 multi-pod race에서 bounded overshoot를 허용한다.

- 현재 RUNNING이 `M−1`일 때 pod `N`개가 동시에 신규 pipeline을 RUNNING으로 올리면 최악 RUNNING 수 = **`M + N − 1`** (각 pod가 같은 race window에서 최대 1개 승격 가정).
- 따라서 pipeline 수 관점 상한: `maxConcurrentApiCalls ≤ min(totalWorkerCount, M + N − 1)`.
- ⚠️ *"RUNNING 수는 항상 M 이하"는 틀리다.* 정확히는 **soft target M + bounded overshoot ≤ N−1**.
- **hard cap이 필요하면** count-read를 `pipeline_admission_counter` CAS 또는 DB constraint 기반 admission으로 승격한다.

### 4.3 TF slot (`slotCap`) — 역시 soft admission target

TF dispatch/poll/check는 **API call**(§4.1 포함)이지만, **TF slot은 API 동시성이 아니라 Terraform job 실행 압력을 누르는 별개 개념**이다:

| 개념 | 정체 | 점유 기간 |
|---|---|---|
| TF dispatch API call | IM에 job 생성을 요청하는 HTTP call | ms~수초 |
| TF poll/check API call | TF job 상태 조회 HTTP call | ms~수초 |
| **TF slot** | dispatch 이후 terminal 전까지 **실제 TF job 실행 중인 기간** | 수 분 |

- **`slotCap`은 V1에서 BFF-side soft admission target이다.** count-read admission이라 multi-pod에서 bounded overshoot 허용 — 정확한 hard cap이 아니다.
- 만석이면 TF task는 READY 유지 + `next_due_at` 미뤄 재큐(§6).
- **hard cap이 필요하면** `tf_slot_counter` CAS를 필수화하거나 **Infra Manager-side admission limit으로 승격**한다(ADR도 IM-side 제한은 보류 — BFF가 유일 caller·다운스트림 멱등이라 V1은 soft로 충분).

```sql
-- V1 soft admit (count-read; bounded overshoot 허용)
-- hard cap이 필요할 때만 단일 statement CAS로 승격:
UPDATE tf_slot_counter SET used = used + 1 WHERE used < cap;   -- rows=1 획득 / rows=0 만석
-- TF 잡 terminal 시:  used = used - 1;  (drift는 주기적 used = 실제 in-flight count로 reconcile)
```

---

## 5. 큐 — 구조 없이 ORDER BY로 파생

**명시적 Queue 테이블/브로커는 만들지 않는다.** "TF JOB 큐"는 데이터 구조가 아니라 **대기 중인 항목을 정렬해 뽑는 파생 뷰**다.

- **dequeue** = claim 쿼리. due 파이프라인을 `ORDER BY next_due_at`으로 정렬해 head를 SKIP LOCKED로 집음.
- **slot admission 순번** = 파이프라인이 재claim되는 순서(`next_due_at`)로 파생. 가장 오래 기다린 게 먼저 올라와 빈 slot 차지.

```sql
SELECT id FROM pipeline
 WHERE status = 'RUNNING'
   AND next_due_at <= now()                              -- due한 것만
   AND (claimed_until IS NULL OR claimed_until < now())  -- 비었거나 lease 만료
 ORDER BY next_due_at                                    -- ← "큐 순번"
 LIMIT 1
 FOR UPDATE SKIP LOCKED;                                 -- 동시 claimer는 잠긴 행 건너뜀
-- 잡힌 행: UPDATE claimed_by=:token, claimed_until=now()+:lease;  COMMIT (tx1)
```

- **근사 FIFO다.** SKIP LOCKED는 잠긴 옛 행을 건너뛸 수 있어 엄격 FIFO가 아니다. 그러나 admission 순서는 **정확성이 아니라 공정성(starvation 방지)** 문제 — 잡 간 독립이라 누가 먼저 들어가든 결과 동일. `ORDER BY next_due_at`이면 공정성 충분.
- **엄격 FIFO가 정확성 요구인 경우**(예: 같은 target에 TF 잡이 제출 순서대로 외부 실행돼야 함)에만 진짜 큐/직렬화가 정당. 현 설계는 per-target 유일 active run이라 같은 target 동시 TF가 1개뿐 → 불필요.

---

## 6. 스케줄링 / 깨우기

- **별도 Scheduler가 task를 "재활성화"하지 않는다.** 워커 스레드가 직접 claim/CAS/호출/보고 SQL을 돌린다. 워커 N개가 DB를 셀프 폴링하는 것이 곧 스케줄링 — **`@Scheduled` 불필요**(연속 워커 루프).
- **slot이 비면 누가 깨우나 → 아무도 안 깨운다.** slot 막힌 task는 READY로 DB에 남아 있고, `next_due_at`마다 재claim되다가 **빈 slot과 우연히 만난다**(poll). event/signal 없음.
  - `slotRetry`(예: 2~5s)로 살짝 미뤄 hot-loop 방지. 빈 slot이 채워지는 지연 = `slotRetry` — TF는 분 단위라 무의미.
- **push(빈 slot 즉시 채우기) 안 만든다.** lower-latency지만 coordination 필요. TF timescale에서 poll의 수초 지연은 공짜나 다름없음.

---

## 7. Crash 복구

- **워커가 claim 후 죽음** → `claimed_until` 만료 → 다음 워커가 재claim. read 멱등이라 재폴 무해.
- **보고(tx2) ownership 가드:** lease 길이 < 호출 시간이면 lease가 만료돼 다른 워커가 재claim·새 호출을 시작할 수 있다. 그래서 보고 전 소유권 재확인:

```sql
BEGIN;  -- tx2
  SELECT claimed_by FROM pipeline WHERE id=:pid FOR UPDATE;
  -- claimed_by != :token  →  lease 뺏김. ROLLBACK, 결과 폐기.
  UPDATE task SET status=?, fail_count=?, ... WHERE id=:taskId;            -- 전이
  UPDATE pipeline SET next_due_at=?, claimed_by=NULL, claimed_until=NULL
   WHERE id=:pid;                                                         -- 릴리스
COMMIT;
```

> 이는 기존 `@Version`이 막던 "mid-call cancel/stale write" 레이스를 **lease 토큰 CAS**로 막는 것 — 같은 위험, 큐 패턴식 해법.

- **dispatch만** 외부 side-effect라 "시도했음" 이력이 필요하면 그때만 D-T5식 선기록(호출 직전 마킹). CHECK/poll은 read 멱등이라 불요.

### 7.1 claim/lease가 보장하는 것 / 보장하지 않는 것 (과장 금지)

**claim/lease는 stale write를 막는 single-writer 장치이지, duplicate external call을 절대적으로 제거하는 장치가 아니다.**

- ✅ 같은 pipeline에 대한 **single writer** 보장 (claim).
- ✅ report()의 **ownership CAS**가 stale write(뺏긴 lease의 늦은 보고)를 막음.
- ❌ **lease가 API 호출 중 만료되면 duplicate external call이 발생할 수 있다** — 워커A 호출 중 lease 만료 → 워커B 재claim·재호출.

따라서 **duplicate side effect 방지는 별도 제약**으로 관리한다:

1. **`leaseDuration > maxApiCallTimeout + safetyMargin`** (필수 불변식) — lease가 호출보다 먼저 만료되지 않게.
2. **모든 외부 호출에 timeout**(`maxApiCallTimeout` 유한)이 있어야 한다.
3. **dispatch 계열**: idempotency key 또는 dispatch-before marker(D-T5식 선기록)로 중복 제출을 무해화 (다운스트림 멱등이 1차 방어선, key/marker가 2차).
4. **poll/check 계열**: read-idempotent라 중복 호출 무해.

---

## 8. 기존 대비 trade-off 정리

**삭제 (D-T4 대비)**
- D-T2 async fire 메커니즘
- D-T4 two-writer 분리 ("관측은 스레드, 상태는 tick")
- `task_check` 관측 원장 + RLE 압축 + retention pruner
- `task_attempt` 테이블
- outbox / 이벤트
- **leader election** (claim=SKIP LOCKED이 멀티-pod 조정을 대신; §8.1) — **replicas=1 제약도 소멸**

**추가**
- Pipeline claim (lease 3컬럼) + `FOR UPDATE SKIP LOCKED`
- TF slot counter-CAS (1행 테이블)
- slot-fill poll 지연 (분 단위 timescale이라 무관)

**순효과:** 머릿속에 드는 개념 수 급감 · latency에 견고 · 단일 writer는 lock이 보장 · API 동시성은 `min(워커 수, RUNNING pipeline 수)`로 상한.

### 8.1 Single Leader / replicas=1 제약이 사라진다

기존 30s tick은 **단일 리더**(advisory lock 또는 replicas=1)가 필수였다 — N개 pod가 동시에 tick을 돌리면 같은 task를 중복 전진시키니까. Claim-Pull은 **claim(`FOR UPDATE SKIP LOCKED`)이 멀티-pod에서 네이티브로 안전**하다: 여러 pod의 워커가 동시에 claim해도 한 pipeline은 한 워커만 잡는다.

- → **leader election 불필요** (claim이 대체).
- → **replicas=1 제약 불필요** (멀티-pod 네이티브; 수평 확장 = 워커/pod 추가).
- **대가**: soft cap(`runningPipelineCap`·`slotCap`)에 multi-pod admission overshoot(≤ `N−1`, §4.2/4.3). hard cap이 필요하면 counter-CAS/DB constraint로 승격.

---

## 9. 미해결 / 후속

- **튜닝 노브:** 워커 수 N(API 동시성), `slotCap`(TF 동시성), `slotRetry`(빈 slot 채우는 지연), lease 길이(호출 최대시간보다 충분히 길게).
- **연속 워커 vs `@Scheduled` 위임:** 연속 워커 추천. `@Scheduled`가 claim 돌려 풀에 위임하는 형태도 가능하나 이점 없음.
- **배포 토폴로지:** 멀티-pod 네이티브(§8.1)라 leader election·replicas=1 **둘 다 불필요**. soft cap의 hard화가 필요할 때만 counter-CAS/DB constraint로 승격.
- **채택 시:** 이 제안은 ADR-016 / `minimal-redesign.md`의 **실행 모델 교체**다. 채택되면 `minimal-redesign.md §3`(reconciler tick)을 claim-pull로 갱신하거나, 후속 ADR로 승격.

---

## 10. V1 보장 범위 (정확성 계약)

- **실행 모델** = Claim-Pull Worker (워커가 pipeline 1개를 동기로 소유).
- **API call concurrency** = `min(총 워커 수, RUNNING pipeline 수)`로 제한.
- **API QPS hard limit** = **V1 범위 밖** (429/503 backoff; 필요 시 token bucket/distributed limiter 후속).
- **runningPipelineCap** = soft admission target. multi-pod race에서 최대 `N−1` overshoot (최악 RUNNING = `M+N−1`).
- **slotCap** = TF 실행 압력을 누르는 soft admission target (역시 bounded overshoot).
- **hard cap이 필요한 경우** = counter-CAS 또는 downstream-side(IM) admission limit으로 승격.
- **claim/lease** = single writer + stale write 방지 장치. **duplicate external call을 절대 제거하지는 않음.**
- **duplicate external call 방지** = `leaseDuration > maxApiCallTimeout + safetyMargin` + 모든 호출 timeout + dispatch idempotency key/marker (poll/check는 read-idempotent).
- **멀티-pod 네이티브** = leader election·replicas=1 제약 불필요 (claim=SKIP LOCKED).
