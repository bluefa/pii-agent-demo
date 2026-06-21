# Pipeline — State Machine (Pipeline · Task 전이도)

> [ADR-016](../../docs/adr/ADR-016-install-delete-pipeline-orchestration.md)의 상태 전이 문서.
> **새 규칙이 아니라** [orchestrator-design.md](./orchestrator-design.md) 결정 1.1(파생 우선순위)·1.2(상태 집합)·
> 3.1(dispatch 5단계)·4(timeout·취소)·6(단일 writer)과 [task-model.md](./task-model.md) 결정 2(TaskKind)에
> 흩어진 전이 규칙을 한 곳에 합성한 전이도다. **충돌 시 각 결정 본문이 정본**이며, 결정 번호는 두 문서와
> 공유한다(아래 표 "근거" 열).

**task 전이의 writer는 reconciler tick이다 — task 상태 전이·외부 호출·slot 회계는 tick에서만**(결정 6
D-T4); 관측(task_check)·산출(attempt.response)은 호출 스레드. **예외는 pipeline-level 사용자 전이 하나** —
[중단] `RUNNING → CANCELLING`은 Admin API가 공통 전이 함수(CAS + pipeline_event)로 수행한다(외부 효과·
task 변경 없음, 결정 4c). 그 외 모든 pipeline 파생(DONE/FAILED/CANCELLED)은 tick이 task에서 파생한다.
이 문서는 현재 **TaskKind 2종(TERRAFORM_JOB · CONDITION_CHECK)** 기준이다.

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
| RUNNING | CANCELLING | **[중단] API → 공통 전이 함수(CAS+event)**, 즉시 전이. **CAS prior=RUNNING** (terminal·CANCELLING이면 0행=no-op → 중복 중단·terminal 부활 자동 차단) | 4c, 5 |
| RUNNING | FAILED | tick 파생 ②: ¬CANCELLING ∧ fail_count==K task 존재 | 1.1 |
| RUNNING | FAILED | tick 파생 ③: ¬CANCELLING ∧ TTL EXPIRED task 존재 | 1.1, 4a |
| RUNNING | DONE | tick 파생 ④: ¬CANCELLING ∧ 전 task DONE | 1.1 |
| CANCELLING | CANCELLED | tick 파생 ①(최우선): 전 in-flight task가 terminal로 drain 완료 | 1.1, 4c |

terminal(DONE·FAILED·CANCELLED)에서 나가는 전이는 없다 — 입구 가드가 terminal에서의 [중단]을 거부하고
terminal 부활도 없다(결정 5 "terminal은 terminal"). retry는 새 pipeline 생성이지 전이가 아니다(결정 5).

---

## Task 전이도 (9종)

상태 전진 경로는 kind가 정한다(결정 2). happy path만 lane으로, 분기(실패·timeout·취소·재시도)는 아래 표.

```
공통 진입:  (생성) → [BLOCKED] ──직전 seq task DONE (tick 승격)──► [READY] ──┐ kind로 분기
                                                                          │
 TERRAFORM_JOB   │ [READY] ──admit: COUNT(DISP|RUN)<N──► [DISPATCHING] → [RUNNING] → [DONE]
 (slot 소비)      │   (READY = slot 큐, 미admit)          dispatch       job 폴링
 CONDITION_CHECK │ [READY] ──────────────────────────────► [WAITING_EXTERNAL] → [DONE]
 (dispatch 없음)  │                                       조건 폴링 (MET까지, dispatch/attempt 없음)
```

비terminal 5종(BLOCKED·READY·DISPATCHING·RUNNING·WAITING_EXTERNAL) · terminal 4종
(DONE·FAILED·EXPIRED·CANCELLED). **slot 큐 대기는 별도 상태가 아니라 `READY ∧ kind=TERRAFORM_JOB`로 표현**
한다(WAITING_SLOT 제거 — decision-history S26). 보드 라벨 매핑은 [orchestrator-design.md](./orchestrator-design.md) §1.2 표.

**전진 전이**

| From | → To | 트리거 / Guard | kind |
|---|---|---|---|
| (생성) | BLOCKED | pipeline 생성 시 task 행 생성 | 전체 |
| BLOCKED | READY | tick: 직전 task(seq-1) DONE → 승격 (순차 chain — seq 순서로 파생) | 전체 |
| READY | DISPATCHING | tick: **admit** — COUNT(DISPATCHING\|RUNNING) < N일 때(READY TF = slot 큐); CAS + task_attempt 생성 + next_check_at | TERRAFORM_JOB |
| READY | WAITING_EXTERNAL | tick: dispatch 없이 조건 폴링 개시 | CONDITION_CHECK |
| DISPATCHING | RUNNING | (다음) tick: attempt.response 적재(dispatch 응답 OK) 관측 → CAS (결정 3.1 5단계) | TERRAFORM_JOB |
| RUNNING | DONE | tick: 최신 poll observed=SUCCEEDED | TERRAFORM_JOB |
| WAITING_EXTERNAL | DONE | tick: 최신 check observed=MET | CONDITION_CHECK |

**종결(실패·timeout) 전이** — `fail_count`는 "성공하지 못한 시도 횟수"(결정 3.1), K=max_fail_count.

| From | → To | 트리거 / Guard | kind |
|---|---|---|---|
| RUNNING | FAILED | tick: poll FAILED / execution timeout / IM 거부로 fail_count++ == **K** | TERRAFORM_JOB |
| WAITING_EXTERNAL | FAILED | tick: check api_result=ERROR로 fail_count++ == **K** (NOT_MET은 미가산 — "아직"은 실패 아님) | CONDITION_CHECK |
| WAITING_EXTERNAL | EXPIRED | tick: WAIT_EXTERNAL TTL(총 체류) 초과 → EXPIRED (→ pipeline FAILED 파생) | CONDITION_CHECK |
| READY·DISPATCHING·RUNNING·WAITING_EXTERNAL | FAILED | tick: **`handler_key` 미해결**(registry에 없음 — 핸들러 은퇴/규율 위반) → **즉시 FAILED**(`error_code=HANDLER_NOT_FOUND`, fail_count 미소모 — 영구 조건이라 재시도 무의미), 보유 slot 반납. **RUNNING TERRAFORM_JOB의 in-flight job은 죽일 수 없어 orphan으로 남는다** — 멱등이라 무해하고, **BFF가 추적을 끊으므로 BFF execution timeout이 아니라 worker의 terraform apply 자연 종료(유한)가 그 bound**다 | 전체 |

> EXPIRED는 **WAIT_EXTERNAL TTL 전용**이다. RUNNING의 execution timeout은 EXPIRED가 아니라 *attempt
> 실패*(fail_count++, slot 해제 — 결정 4a; **DB 기록 = result=FAIL + error_code=EXECUTION_TIMEOUT**, 별도 result enum 아님)이며, 재시도 소진 시에만 FAILED가 된다. (결정 4a timeout 표의
> "EXECUTE task"·"WAIT_EXTERNAL"은 각각 dispatch-poll kind(TERRAFORM_JOB)·CONDITION_CHECK의
> 구 라벨이다.)

**재시도 전이 (fail_count++ < K)** — 같은 종결 트리거지만 한도 미소진이라 재dispatch한다.

| From | → To | 트리거 / Guard | kind |
|---|---|---|---|
| DISPATCHING | DISPATCHING (in-place) | dispatch 복구 timeout(response 없음) → attempt 실패 마감 fail++; **slot 보유한 채** 재dispatch | TERRAFORM_JOB |
| RUNNING | READY | poll FAILED/execution timeout → fail++; **slot 반납 후 READY로 재큐**(=slot 큐 재진입; 결정 5: 재dispatch도 admission 통과) | TERRAFORM_JOB |
| WAITING_EXTERNAL | WAITING_EXTERNAL (in-place) | NOT_MET(미가산) 또는 check ERROR(fail++) → 계속 폴링 | CONDITION_CHECK |

**취소 전이 (pipeline = CANCELLING)** — forward edge만 gate, drain edge는 gate 안 함(결정 4c). drain은
**죽일 수 없는 in-flight side-effect job**(TERRAFORM_JOB)에만 적용된다 — read-only 폴링엔 drain할
대상이 없다.

| From | → To | 규칙 |
|---|---|---|
| BLOCKED · READY (전체 kind) | CANCELLED | **미dispatch task → 즉시 CANCELLED**(forward edge가 gate되어 전진 불가; slot 큐 대기 중인 READY TF 포함) |
| WAITING_EXTERNAL (CONDITION_CHECK) | CANCELLED | **read-only 폴링이라 drain할 in-flight job이 없다 → 폴링 중이어도 즉시 CANCELLED**(결정 4c) |
| DISPATCHING (TERRAFORM_JOB) | CANCELLED | **job_id 미영속이라 폴링할 handle이 없다 → drain 불가 → 즉시 CANCELLED**(slot 반납). 원 dispatch가 IM에 accepted돼 실제 실행됐더라도 멱등이라 무해하고, **BFF가 추적을 끊으므로 그 orphan은 BFF execution timeout이 아니라 worker의 terraform apply 자연 종료(유한)가 bound**한다 — drain은 *handle을 가진 RUNNING*에만 적용된다(결정 4c). 재dispatch(forward edge)도 gate되므로 좀비가 되지 않는다 |
| RUNNING (TERRAFORM_JOB) | (drain) 자연 terminal | **죽일 수 없는 in-flight job(job_id 영속됨) → drain** — terminal까지 폴링은 drain edge라 gate 안 함; 재dispatch/재시도만 gate(새 attempt 없음); slot은 terminal까지 보유. task의 실제 terminal(DONE/FAILED)은 히스토리에 사실대로 남고, pipeline만 CANCELLED로 수렴 |

> **task CANCELLED ≠ pipeline CANCELLED.** task의 CANCELLED는 *폴링할 handle이 없는* task에 붙는다 —
> ① 미dispatch TERRAFORM_JOB(BLOCKED/READY) · ② **DISPATCHING 중 job_id 미영속** TERRAFORM_JOB · ③ 모든
> CONDITION_CHECK(애초에 dispatch·handle 없음). **job_id가 영속된(RUNNING) in-flight job만** 자기 자연
> terminal(DONE/FAILED)로 drain되고, 그 사실은 보존되며, pipeline 파생만 결정 1.1 ①에 의해 CANCELLED로
> 수렴한다(CANCELLING 중에는 FAILED 승격 금지).

terminal 4종(DONE·FAILED·EXPIRED·CANCELLED)에서 나가는 전이는 없다(결정 5 "terminal은 terminal").

---

## CONDITION_CHECK 전이 (단순 확인 task)

side effect 없이 **외부 조건이 충족(MET)됐는지만 반복해 읽는** task다(예: 권한 부여 완료, terraform 외
사전 조치 완료). 시킬 게 없어 dispatch가 없고, **dispatch가 없으니 attempt도 없다**(결정 1.2: attempt =
action의 생애주기 — 추적할 action 자체가 없다). 모든 관측은 `task_check(kind=CHECK)`로만 남는다 — 2×2로
attempt 0 + 폴링 ≥1. ADR이 attempt와 task_check를 중첩이 아니라 **형제**로 둔 표준 사례다(예외·빈칸 아님).

```
            deps DONE          조건 폴링 개시 (dispatch·attempt 없음)
 [BLOCKED] ─(tick)─► [READY] ─(tick)─► [WAITING_EXTERNAL] ─── observed=MET ───► [DONE]
                                          │   ▲
                       ≥10분 cadence 재폴링 │   │  NOT_MET(미가산) · api_result=ERROR(fail++ <K)
                                          └───┘
                                          ├─ check ERROR 누적 → fail++ == K ──► [FAILED]
                                          ├─ WAIT_EXTERNAL TTL(기본 7일) 초과 ──► [EXPIRED] → pipeline FAILED
                                          └─ [중단](CANCELLING) ──────────────► [CANCELLED]
```

1. **(생성) → BLOCKED** — pipeline 생성 시 task 행만 생성.
2. **BLOCKED → READY** — predecessor 전부 DONE → tick 승격.
3. **READY → WAITING_EXTERNAL** — tick이 조건 폴링 개시. dispatch 없음 → **task_attempt 행을 만들지 않는다**.
4. **WAITING_EXTERNAL 자기루프(폴링)** — ≥10분 cadence(WAIT_EXTERNAL polling guard, 관리자 조정)마다 tick이
   check 발사. **폴링 1회 = `task_check(kind=CHECK)` 1행**(1 call = 1 row). observed=NOT_MET이면 계속
   (fail_count 무변동 — "아직"은 실패 아님); api_result=ERROR(호출 자체 실패)면 fail_count++, < K면 계속.
5. **→ DONE** — observed=MET.
6. **→ FAILED** — check ERROR 누적으로 fail_count++ == K(NOT_MET은 미가산).
7. **→ EXPIRED** — WAIT_EXTERNAL TTL(기본 7일) 초과 → pipeline FAILED 파생. (무한 대기 없음.)
8. **→ CANCELLED** — [중단] 시. in-flight side-effect job이 없어 drain 대상이 없으므로 폴링 중
   (WAITING_EXTERNAL)이어도 즉시 CANCELLED(결정 4c — drain은 TERRAFORM_JOB의 죽일 수 없는 job에만).

attempt가 0개여도 **모든 폴링이 task_check에 남아 조사 타임라인은 완전**하다. DISPATCH-kind task_check는 없다
(dispatch 없음).
