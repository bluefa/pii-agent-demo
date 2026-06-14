# Pipeline — State Machine (Pipeline · Task 전이도)

> [ADR-016](../../docs/adr/ADR-016-install-delete-pipeline-orchestration.md)의 상태 전이 문서.
> **새 규칙이 아니라** [orchestrator-design.md](./orchestrator-design.md) 결정 1.1(파생 우선순위)·1.2(상태 집합)·
> 3.1(dispatch 5단계)·4(timeout·취소)·6(단일 writer)과 [task-model.md](./task-model.md) 결정 2(TaskKind)에
> 흩어진 전이 규칙을 한 곳에 합성한 전이도다. **충돌 시 각 결정 본문이 정본**이며, 결정 번호는 두 문서와
> 공유한다(아래 표 "근거" 열).

모든 전이의 writer는 reconciler tick이다 — **상태 전이는 tick에서만**(결정 6 D-T4), 관측(task_check)·산출
(attempt.response)은 호출 스레드. 이 문서는 현재 **TaskKind 3종(TERRAFORM_JOB · GENERAL_JOB · CONDITION_CHECK)**
기준이다.

---

## Pipeline 전이도 (5종)

```
   (생성)
     │ 즉시
     ▼
 ┌─────────┐   [중단] (입구 가드: 비terminal일 때만)   ┌────────────┐
 │ RUNNING │ ─────────────────────────────────────► │ CANCELLING │
 └────┬────┘                                         └─────┬──────┘
      │ 매 tick 파생 (¬CANCELLING일 때만)                    │ 파생 ① (최우선)
      │   ② fail_count==K task 존재  → FAILED              │ 전 in-flight drain 완료
      │   ③ TTL EXPIRED task 존재    → FAILED              │ (CANCELLING 중 task가
      │   ④ 전 task DONE             → DONE                │  FAILED/EXPIRED여도 pipeline
      ▼                                                   ▼  FAILED 승격 안 함)
  FAILED / DONE                                       CANCELLED
```

**파생은 병렬 비교가 아니라 매 tick 우선순위 순서로 평가**한다(결정 1.1) — **① CANCELLING이면 최우선**
(다른 모든 파생을 누른다) > ② 재시도 소진(fail_count==K) FAILED > ③ TTL EXPIRED FAILED > ④ 전 task DONE.
①이 ②③을 누르므로 "취소 중 task가 실패해도 pipeline은 CANCELLED로 단일 수렴"이 보장된다. 판정 기준은
*실패 시각*이 아니라 *파생 시점의 pipeline.status*다(상태 기준, 결정 1.1).

| From | → To | 트리거 / Guard | 근거 |
|---|---|---|---|
| (생성) | RUNNING | pipeline 생성 즉시 | 1.3 |
| RUNNING | CANCELLING | [중단] intent → tick. **입구 가드: pipeline이 비terminal일 때만** | 4c, 5 |
| RUNNING | FAILED | tick 파생 ②: ¬CANCELLING ∧ fail_count==K task 존재 | 1.1 |
| RUNNING | FAILED | tick 파생 ③: ¬CANCELLING ∧ TTL EXPIRED task 존재 | 1.1, 4a |
| RUNNING | DONE | tick 파생 ④: ¬CANCELLING ∧ 전 task DONE | 1.1 |
| CANCELLING | CANCELLED | tick 파생 ①(최우선): 전 in-flight task가 terminal로 drain 완료 | 1.1, 4c |

terminal(DONE·FAILED·CANCELLED)에서 나가는 전이는 없다 — 입구 가드가 terminal에서의 [중단]을 거부하고
terminal 부활도 없다(결정 5 "terminal은 terminal"). retry는 새 pipeline 생성이지 전이가 아니다(결정 5).

---

## Task 전이도 (10종)

상태 전진 경로는 kind가 정한다(결정 2). happy path만 lane으로, 분기(실패·timeout·취소·재시도)는 아래 표.

```
공통 진입:  (생성) → [BLOCKED] ──depends_on 전부 DONE (tick 승격)──► [READY] ──┐ kind로 분기
                                                                          │
 TERRAFORM_JOB   │ [READY] → [WAITING_SLOT] → [DISPATCHING] → [RUNNING] → [DONE]
 (slot 소비)      │            COUNT<N admit    dispatch       job 폴링
 GENERAL_JOB     │ [READY] ───────────────────► [DISPATCHING] → [RUNNING] → [DONE]
 (slot 불요)      │                             dispatch       handle 폴링
 CONDITION_CHECK │ [READY] ─────────────────────► [WAITING_EXTERNAL] → [DONE]
 (dispatch 없음)  │                              조건 폴링 (MET까지, dispatch/attempt 없음)
```

비terminal 6종(BLOCKED·READY·WAITING_SLOT·DISPATCHING·RUNNING·WAITING_EXTERNAL) · terminal 4종
(DONE·FAILED·EXPIRED·CANCELLED). 보드 라벨 매핑은 [orchestrator-design.md](./orchestrator-design.md) §1.2 표.

**전진 전이**

| From | → To | 트리거 / Guard | kind |
|---|---|---|---|
| (생성) | BLOCKED | pipeline 생성 시 task 행 생성 | 전체 |
| BLOCKED | READY | tick: depends_on(순차 chain=predecessor) 전부 DONE → 승격 | 전체 |
| READY | WAITING_SLOT | tick: slot 소비 kind → admission 큐 진입 | TERRAFORM_JOB |
| WAITING_SLOT | DISPATCHING | tick: COUNT(DISPATCHING\|RUNNING) < N → admit (CAS) + task_attempt 생성 + next_check_at | TERRAFORM_JOB |
| READY | DISPATCHING | tick: slot 불요 → 즉시 dispatch (CAS) + task_attempt 생성 + next_check_at | GENERAL_JOB |
| READY | WAITING_EXTERNAL | tick: dispatch 없이 조건 폴링 개시 | CONDITION_CHECK |
| DISPATCHING | RUNNING | (다음) tick: attempt.response 적재(dispatch 응답 OK) 관측 → CAS (결정 3.1 5단계) | TERRAFORM_JOB·GENERAL_JOB |
| RUNNING | DONE | tick: 최신 poll observed=SUCCEEDED | TERRAFORM_JOB·GENERAL_JOB |
| WAITING_EXTERNAL | DONE | tick: 최신 check observed=MET | CONDITION_CHECK |

**종결(실패·timeout) 전이** — `fail_count`는 "성공하지 못한 시도 횟수"(결정 3.1), K=max_fail_count.

| From | → To | 트리거 / Guard | kind |
|---|---|---|---|
| RUNNING | FAILED | tick: poll FAILED / execution timeout / IM 거부로 fail_count++ == **K** | TERRAFORM_JOB·GENERAL_JOB |
| WAITING_EXTERNAL | FAILED | tick: check api_result=ERROR로 fail_count++ == **K** (NOT_MET은 미가산 — "아직"은 실패 아님) | CONDITION_CHECK |
| WAITING_EXTERNAL | EXPIRED | tick: WAIT_EXTERNAL TTL(총 체류) 초과 → EXPIRED (→ pipeline FAILED 파생) | CONDITION_CHECK |

> EXPIRED는 **WAIT_EXTERNAL TTL 전용**이다. RUNNING의 execution timeout은 EXPIRED가 아니라 *attempt
> 실패*(fail_count++, slot 해제 — 결정 4a)이며, 재시도 소진 시에만 FAILED가 된다. (결정 4a timeout 표의
> "EXECUTE task"·"WAIT_EXTERNAL"은 각각 dispatch-poll kind(TERRAFORM_JOB·GENERAL_JOB)·CONDITION_CHECK의
> 구 라벨이다.)

**재시도 전이 (fail_count++ < K)** — 같은 종결 트리거지만 한도 미소진이라 재dispatch한다.

| From | → To | 트리거 / Guard | kind |
|---|---|---|---|
| DISPATCHING | DISPATCHING (in-place) | dispatch 복구 timeout(response 없음) → attempt 실패 마감 fail++; **slot 보유한 채** 재dispatch | TERRAFORM_JOB·GENERAL_JOB |
| RUNNING | WAITING_SLOT | poll FAILED/execution timeout → fail++; **slot 반납 후 재큐**(결정 5: 재dispatch도 admission 통과) | TERRAFORM_JOB |
| RUNNING | DISPATCHING | poll FAILED → fail++; slot 무관이라 바로 재dispatch | GENERAL_JOB |
| WAITING_EXTERNAL | WAITING_EXTERNAL (in-place) | NOT_MET(미가산) 또는 check ERROR(fail++) → 계속 폴링 | CONDITION_CHECK |

**취소 전이 (pipeline = CANCELLING)** — forward edge만 gate, drain edge는 gate 안 함(결정 4c).

| From | → To | 규칙 |
|---|---|---|
| BLOCKED · READY · WAITING_SLOT | CANCELLED | **미dispatch task → 즉시 CANCELLED**(forward edge가 gate되어 전진 불가) |
| DISPATCHING · RUNNING · WAITING_EXTERNAL | (drain) 자연 terminal | **in-flight task는 drain** — job_id 기록·terminal까지 폴링은 drain edge라 gate 안 함; 재dispatch/재시도만 gate(새 attempt 없음); slot은 terminal까지 보유. task의 실제 terminal(DONE/FAILED/EXPIRED)은 히스토리에 사실대로 남고, pipeline만 CANCELLED로 수렴 |

> **task CANCELLED ≠ pipeline CANCELLED.** task의 CANCELLED는 *한 번도 dispatch되지 않은* task에만 붙는다.
> in-flight task는 자기 자연 terminal(DONE/FAILED/EXPIRED)로 가고, 그 사실은 보존되며, pipeline 파생만
> 결정 1.1 ①에 의해 CANCELLED로 수렴한다(CANCELLING 중에는 FAILED 승격 금지).

terminal 4종(DONE·FAILED·EXPIRED·CANCELLED)에서 나가는 전이는 없다(결정 5 "terminal은 terminal").

---

> **미반영 (열린 항목):** 동기 작업(dispatch 응답이 즉시 terminal을 주어 `DISPATCHING→DONE` 전이가 필요한
> kind)은 현재 3종에 없어 이 전이도에 없다. 실재로 확정되면 전진/종결 표에 `DISPATCHING→DONE/FAILED`
> 행을 추가한다([task-model.md](./task-model.md) 참조).
