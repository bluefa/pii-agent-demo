# Single Pipeline Tick — 단일 서버 실행 모델 (V1)

> 상태: **제안 (논의 산물, 미채택)** · 대상: ADR-016 설치/삭제 파이프라인 오케스트레이션의 **실행 모델**
> 결정: V1 = **단일 전용 서버**(replicas=1). 수평확장/HA가 필요해지면 §8.1의 active-active로 승격.
> 관련: ADR-016 + `minimal-redesign.md` (PR #494, 미머지) — 본 모델은 그 §3 reconciler의 작은 델타다.

## 0. TL;DR

기존 실행 모델은 **30초 단일 tick**이 RUNNING 파이프라인을 훑어 **N개의 외부 API를 비동기 스레드로 발사**하고(D-T2), 결과는 호출 스레드가 관측 원장(`task_check`)에 적재, 상태 전이는 **다음 tick**이 수행한다(D-T4 단일-writer 분리).

이 제안은 그 부분을 다음으로 교체한다:

> **단일 전용 서버가 due 파이프라인을 스캔해 각각을 bounded executor(워커 N개)에 분배한다. 한 워커가 한 파이프라인의 현재 task 1개를 동기 호출하고, 응답이 오면 한 트랜잭션으로 상태를 전이한다.**

- **단일 writer가 자명하다** — 서버가 하나뿐(+ in-memory in-flight 가드)이라 같은 파이프라인을 두 워커가 잡지 않는다. → D-T4 두-writer 분리, lease, ownership-CAS, `SKIP LOCKED` claim, leader 선출 **전부 불필요**.
- API call **동시성** ≤ `min(N, due 파이프라인 수)`. **QPS hard limit은 V1 밖**(429/503 backoff).
- **신규 스키마 ≈ 0** — `minimal-redesign.md`의 `pipeline`/`task` 2테이블 그대로. in-flight 추적은 in-memory.

## 1. 배경 — 기존 모델과 그 문제

### 1.1 기존 모델 (D-T2 / D-T4)
```
[30s tick]  RUNNING 파이프라인 전수 조회
   └ 각 파이프라인의 현재 task가 due면 → 비동기 스레드로 API 발사 (N개)
        호출 스레드: 결과를 task_check 관측 원장에 기록 (status는 안 건드림)
   [다음 tick]  적재된 관측을 읽어 task.status를 CAS 전이
```

### 1.2 왜 이렇게 됐나 — 그리고 그 대가
- **출발점: API 응답시간이 예측 불가다 (200ms ~ 60s+).** 동기 단일 tick으로 직렬 호출하면 가장 느린 호출이 전체 cadence를 인질로 잡는다. 그래서 기존은 **비동기 발사**를 택했다.
- **비동기라서 D-T4가 필요해졌다** — 결과가 별도 스레드·임의 시각에 돌아오니, status를 직접 바꾸면 멀티-writer 경쟁·"전이 도중 죽음"이 생긴다. 그래서 "호출 스레드는 관측만, tick은 상태만"으로 쪼갰다.
- **그 분리 + 관측 원장이 복잡도 1·2위다.** 한 동작이 3 레인·2 tx·시간차로 흩어진다.

**핵심 관찰:** 비동기가 필요한 이유는 "느린 호출이 tick을 막으면 안 된다" 하나뿐이다. 그건 **동시성(워커 N개)** 으로 풀린다 — 비동기 handoff도, 관측 원장도, 멀티-pod 조정 기구도 필요 없다.

## 2. 결정 — 단일 서버 + in-memory 워커 풀

### 2.1 왜 단일 서버인가
- 규모: target ~2000, 파이프라인 정의 ~12종, TF 잡은 **분 단위**, 폴링 cadence는 ≥수초~분. throughput이 낮아 **한 서버로 충분**하다.
- 서버가 하나면 "여러 pod가 같은 일을 집지 않게" 조정할 게 없다 → lease·`SKIP LOCKED`·ownership-CAS·leader가 통째로 사라진다.
- **이미 구현된 `test-spring-min`(minimal-redesign §3)의 작은 델타**다: 그 reconciler는 이미 RUNNING 파이프라인을 스캔하고 현재 task를 찾고 due를 판정한다. 바뀌는 건 "동기 직렬 호출" → "bounded executor 분배 + in-flight 가드"뿐.

### 2.2 런타임 루프
```
scan loop (단일 서버):
  for pipeline in 조회(RUNNING ∧ 현재 task due ∧ NOT in-flight):
     inFlight.add(pipeline.id)                  // in-memory 중복 발사 가드
     executor.submit(() -> {                     // bounded pool, 크기 N
         try {
            result = callImApi(currentTask)      // 동기 호출 (어떤 tx도 안 잡음)
            transition(pipeline, currentTask, result)   // 1 tx: status/next_check_at
         } finally { inFlight.remove(pipeline.id) }
     })
```
- **단일 writer**: in-flight 가드 + 서버 1개라 한 파이프라인은 한 번에 한 워커. DB lease 불요.
- **동기지만 블로킹은 워커 1개만 묶는다** — 느린 호출(60s)은 자기 스레드만 점유, 나머지 N−1은 계속.
- **per-pipeline 순차, cross-pipeline 병렬** — 현재 task가 하나뿐이라 step 순서 보장.

## 3. 주요 컴포넌트

| # | 컴포넌트 | 역할 | 기존 대비 |
|---|---|---|---|
| 1 | **Runner Server (replicas=1)** | 스캔 루프 + 워커 풀 호스트 | BFF 분리 / leader 삭제 |
| 2 | **Scanner** | RUNNING ∧ due ∧ ¬in-flight 파이프라인 조회 | minimal §3 tick 재사용 |
| 3 | **Bounded Executor (N)** | 동기 호출을 N개까지 동시 실행. **N = API 동시성 상한** | 30s tick 직렬 → 병렬 |
| 4 | **In-flight Set (in-memory)** | 발사 중 파이프라인 중복 발사 차단 | DB lease 대체 (휘발성) |
| 5 | **TaskMachine.advance** | dispatch/poll 판정 → 호출 → 전이 | minimal과 동일 |
| 6 | **Transition (1 tx)** | 응답 후 status·next_check_at 1 트랜잭션 전이 | task_check 적재 → 직접 전이 |
| 7 | **Backpressure** | 429/503 → `next_check_at` backoff(Retry-After) | D-T7 유지 |
| 8 | **DB 스키마** | `pipeline` · `task` (2테이블). **신규 컬럼 없음** | lease/slot 테이블 불요 |

> FR-3(감사) 대비 선택 컬럼: dispatch 직전 `task.last_requested_at` 1개를 두면 "시도했으나 미응답"(타임아웃) 흔적이 남는다(§7). 그 외 전체 호출 이력은 Runner Server의 **logs/metrics**로 — OLTP write 증폭·retention 프루너 없이 더 나은 도구로.

## 4. 동시성 한계 (concurrency ≠ QPS)

- **워커 풀 크기 N = API call concurrency 상한**이지 **QPS 상한이 아니다.** V1은 hard QPS limiter를 두지 않는다.
- 한 워커 = 동시 호출 1건, 한 due 파이프라인 = 호출 ≤1건 → `maxConcurrentApiCalls ≤ min(N, duePipelineCount)`.
- **QPS는 보장 안 됨** — 실제 QPS는 호출 latency·루프 cycle에 좌우(빠른 호출이면 워커 1개가 초당 수 건). *"초당 호출 ≤ 워커 수"* 같은 표현은 틀리다.
- rate 협조는 reactive: 429/503 → `next_check_at`을 `Retry-After`만큼 미룸(§7). 명시적 QPS 제한이 필요하면 **endpoint별 token bucket / distributed limiter를 후속**으로(V1 밖).

### TF slot은 V1에서 두지 않는다 (defer)
TF 잡 동시 실행 상한(`slotCap`)은 V1 범위 밖이다 — **워커 수가 이미 동시 dispatch를 `min(N, due)`로 묶고**, InfraManager의 고정 워커 풀이 실제 hard cap이며, IM 호출이 멱등·비동기라 과제출은 pubsub 큐만 깊게 할 뿐 손상이 없다(ADR의 deferred Option F). 정확한 client-side 상한이 필요해지면 그때 **IM-side admission limit** 또는 단일행 counter-CAS로 도입한다. 이건 **안정성 노브이지 핵심 결정이 아니다.**

## 5. 큐 — 구조 없이 ORDER BY로 파생
**명시적 Queue 테이블/브로커는 만들지 않는다.** 스캐너가 due 파이프라인을 `ORDER BY next_check_at`으로 정렬해 오래 기다린 것부터 executor에 제출 — 그게 큐다. enqueue/dequeue 연산 없음. (잡 간 독립이라 admission 순서는 정확성이 아니라 공정성 문제 → 근사 FIFO로 충분.)

## 6. 스케줄링 / 깨우기
- 스캔 루프가 곧 스케줄러다. 주기 스캔(예: 1~2s) 또는 연속 루프로 due를 executor에 흘린다.
- **막힌 task는 누가 깨우지 않는다** — `next_check_at`이 도래하면 다음 스캔이 자연히 집는다(poll). event/signal 없음.
- in-flight 가드가 "발사 중인 걸 또 발사" 막는다. 호출 응답 시 `next_check_at`을 다음 cadence로 밀어 재발사 시점을 정한다.

## 7. Crash 복구 (단일 프로세스라 단순)
- **in-memory in-flight set은 crash에 소실** → 재시작 시 스캐너가 `next_check_at` 도래분을 다시 집어 **재dispatch**. DB durable 상태가 전부.
- **중복 외부 호출 방지** (lease invariant 불필요 — 단일 프로세스):
  1. **모든 외부 호출에 timeout** (`perCallTimeout` 유한).
  2. **dispatch는 멱등** — idempotency key 또는 다운스트림 멱등(IM 계약)이 1차 방어선. crash 후 재dispatch가 무해.
  3. (선택) dispatch 직전 `last_requested_at` 선기록 → "시도 vs 미시도" 감사 흔적.
  4. poll/check는 read-idempotent라 재호출 무해.
- **단일 writer**가 in-process라 "mid-call 경쟁/stale write"가 애초에 없다(claim-pull의 ownership-CAS가 풀던 문제 자체가 소멸).

## 8. 기존 대비 trade-off

**삭제 (D-T4 / claim-pull 대비)**
- D-T2 async fire · D-T4 two-writer 분리 · `task_check` 관측 원장 · RLE · `task_attempt` · outbox
- **lease 3컬럼 · ownership-CAS · 2-tx claim/report split · `FOR UPDATE SKIP LOCKED` · leader 선출 · slot-gate(`slotCap`/`tf_slot_counter`/`slotRetry`)**

**추가**
- in-memory in-flight set · bounded executor · (선택) `last_requested_at` 1컬럼

**대가**: 단일 서버라 **HA 없음·수평확장 없음**. 크래시/배포 중엔 진행이 잠시 멈춘다(DB durable + 멱등 재dispatch라 유실은 없음). 2000 target·분 단위 잡엔 충분.

### 8.1 미래 업그레이드 경로: active-active (claim-pull)
수평확장/HA가 V1 이후 필요해지면 멀티 pod로 가되, 그때 **claim(`FOR UPDATE SKIP LOCKED`) + lease + ownership-CAS + 2-tx split**을 도입한다(멀티 pod 조정의 대가를 그때 치름). 이전 제안서 버전이 정확히 그 설계다 — V1엔 과하다고 판단해 보류.

## 9. 미해결 / 후속
- **튜닝 노브**: 워커 수 N(API 동시성), 스캔 주기, `perCallTimeout`, `next_check_at` 정책. — 전부 안정성/용량 노브이지 아키텍처 결정 아님.
- **FR-3 감사**: Runner Server logs/metrics + `last_requested_at`(시도 흔적). ledger 미복원.
- **채택 시**: `minimal-redesign.md §3`을 "bounded executor + in-flight 가드"로 갱신(작은 델타). 별도 실행-모델 ADR로 승격 가능(one-decision-per-ADR).

## 10. V1 보장 범위 (정확성 계약)
- **실행 모델** = 단일 서버 + in-memory 워커 풀(워커가 pipeline 1개를 동기로 처리).
- **API call concurrency** ≤ `min(N, due 파이프라인 수)`.
- **API QPS hard limit** = V1 밖 (429/503 backoff; 필요 시 token bucket/distributed limiter 후속).
- **단일 writer** = 단일 프로세스 + in-flight 가드로 자명 (DB lease·CAS 불필요).
- **중복 외부 호출 방지** = 모든 호출 timeout + dispatch 멱등 (+ 선택 `last_requested_at` 마커). poll/check는 read-idempotent.
- **TF slot / runningPipelineCap** = V1 미도입(안정성 노브). 필요 시 IM-side 또는 counter로 후속.
- **확장** = 필요해지면 §8.1 active-active(claim-pull)로 승격.
