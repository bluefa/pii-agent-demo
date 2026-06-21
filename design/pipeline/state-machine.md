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
 ┌─────────┐   [중단] (입구 가드: prior=RUNNING일 때만)   ┌────────────┐
 │ RUNNING │ ─────────────────────────────────────► │ CANCELLING │
 └────┬────┘                                         └─────┬──────┘
      │ 매 tick 파생 (¬CANCELLING일 때만)                    │ 파생 ① (최우선)
      │   ② status=FAILED task 존재  → FAILED              │ 전 in-flight drain 완료
      │   ③ TTL EXPIRED task 존재    → FAILED              │ (CANCELLING 중 task가
      │   ④ 전 task DONE             → DONE                │  FAILED/EXPIRED여도 pipeline
      ▼                                                   ▼  FAILED 승격 안 함)
  FAILED / DONE                                       CANCELLED
```

**파생은 병렬 비교가 아니라 매 tick 우선순위 순서로 평가**한다(결정 1.1) — **① CANCELLING이면 최우선**
(다른 모든 파생을 누른다) > ② status=FAILED task 존재 → FAILED(**재시도 소진 fail_count==maxFailCount 또는 HANDLER_NOT_FOUND 등 fail_count 미소모 영구 실패 포함**) > ③ TTL EXPIRED FAILED > ④ 전 task DONE.
①이 ②③을 누르므로 "취소 중 task가 실패해도 pipeline은 CANCELLED로 단일 수렴"이 보장된다. 판정 기준은
*실패 시각*이 아니라 *파생 시점의 pipeline.status*다(상태 기준, 결정 1.1).

| From | → To | 트리거 / Guard | 근거 |
|---|---|---|---|
| (생성) | RUNNING | pipeline 생성 즉시 | 1.3 |
| RUNNING | CANCELLING | **[중단] API → 공통 전이 함수(CAS+event)**, 즉시 전이. **CAS prior=RUNNING** (terminal·CANCELLING이면 0행=no-op → 중복 중단·terminal 부활 자동 차단) | 4c, 5 |
| RUNNING | FAILED | tick 파생 ②: ¬CANCELLING ∧ status=FAILED task 존재(재시도 소진 fail_count==maxFailCount **또는** HANDLER_NOT_FOUND 등 영구 실패 — fail_count 미소모 포함) | 1.1 |
| RUNNING | FAILED | tick 파생 ③: ¬CANCELLING ∧ TTL EXPIRED task 존재 | 1.1, 4a |
| RUNNING | DONE | tick 파생 ④: ¬CANCELLING ∧ 전 task DONE | 1.1 |
| CANCELLING | CANCELLED | tick 파생 ①(최우선): **모든 task가 terminal 도달** — 미dispatch(BLOCKED/READY)·CONDITION_CHECK·**DISPATCHING(handle 적재 여부 무관)**은 즉시 CANCELLED, **drain 대상은 RUNNING TERRAFORM_JOB뿐**(job_id 폴링 확립됨)으로 자연 terminal까지 폴링(아래 취소 표) | 1.1, 4c |

terminal(DONE·FAILED·CANCELLED)에서 나가는 전이는 없다 — 입구 가드가 terminal에서의 [중단]을 거부하고
terminal 부활도 없다(결정 5 "terminal은 terminal"). retry는 새 pipeline 생성이지 전이가 아니다(결정 5).

---

## Task 전이도 (9종)

상태 전진 경로는 kind가 정한다(결정 2). happy path만 lane으로, 분기(실패·timeout·취소·재시도)는 아래 표.

```
공통 진입:  (생성) → [BLOCKED] ──직전 seq task DONE (tick 승격)──► [READY] ──┐ kind로 분기
                                                                          │
 TERRAFORM_JOB   │ [READY] ──admit: COUNT(DISP|RUN)<slotCap──► [DISPATCHING] → [RUNNING] → [DONE]
 (slot 소비)      │   (READY = slot 큐, 미admit)          dispatch       job 폴링
 CONDITION_CHECK │ [READY] ──────────────────────────────► [WAITING_EXTERNAL] → [DONE]
 (dispatch 없음)  │                                       조건 폴링 (MET까지, dispatch/attempt 없음)
```

비terminal 5종(BLOCKED·READY·DISPATCHING·RUNNING·WAITING_EXTERNAL) · terminal 4종
(DONE·FAILED·EXPIRED·CANCELLED). **slot 큐 대기는 별도 상태가 아니라 `READY ∧ kind=TERRAFORM_JOB`로 표현**
한다(WAITING_SLOT 제거 — decision-history S26). 보드 라벨 매핑은 [orchestrator-design.md](./orchestrator-design.md) §1.2 표.

> **task_check RLE scope/key(아래 모든 표 공통, 결정 1.3·후속17).** **`kind=DISPATCH`는 호출당 1행**(RLE 안 함·`poll_count=1`); **`kind=CHECK`는 관측 run으로 collapse** — TERRAFORM_JOB의 job poll·CONDITION_CHECK의 condition check **둘 다 `kind=CHECK`라 동일 RLE 대상**이다. collapse는 **단일 task 내에서만**(partition = `task_id` + `kind` + `name` + `external_handle`) **인접 최신 run에 한해** 적용된다 — 서로 다른 task·다른 호출 operation·다른 handle은 절대 한 run으로 섞이지 않는다. 그 partition 안에서 collapse key = `(api_result, observed, error_code)` 동일이면 기존 run UPDATE(`checked_at`=now·`poll_count++`·`latency_ms`=**이번 폴 값으로 overwrite**(누적/평균 아님 — 정렬·latestCheck는 열린 run의 마지막 폴 기준, §1.2)), 바뀌면 새 run INSERT(전이·error_code별 ERROR·backpressure run·MET는 각각 별 run). 따라서 아래 표의 "task_check 기록"은 CHECK이면 run UPDATE-or-INSERT, DISPATCH이면 새 1행을 뜻한다. **RLE는 task_check *행* 표현일 뿐 fail_count 회계와 무관하다** — fail_count 가산 여부는 RLE가 아니라 kind/state별 전이표가 정본이다(collapse로 poll_count가 묶여도 회계는 호출 단위). 요약: **CONDITION_CHECK의 비-backpressure CHECK ERROR/CALL_TIMEOUT = 호출 1회당 +1**(종결 표·재시도 표의 WAITING_EXTERNAL 행); **TERRAFORM_JOB poll ERROR/CALL_TIMEOUT = 미가산**(잡 못 읽음, 재시도 표 RUNNING self-loop 행); **TERRAFORM_JOB dispatch 오류 = attempt가 `error_code≠null`로 마감될 때만 +1**(재시도 표 DISPATCHING in-place 행). backpressure는 모두 미가산.

**task 단위 tick 평가 순서(같은 tick에 여러 트리거가 동시 성립할 때의 단일 판정 순서).** reconciler는 한 task를 전진시킬 때 아래 순서로 *처음 성립하는* 규칙 하나만 적용한다(병렬 비교 아님):

1. **pipeline=CANCELLING이면 취소 규칙 우선**(취소 표) — **일반 forward·일반 재시도 평가를 누른다**(결정 1.1 ①). 단 **RUNNING TERRAFORM_JOB은 drain이라 취소 표 RUNNING 행에 따라 terminal 관측(DONE/FAILED·timeout)을 그대로 평가**한다(drain edge는 gate 안 함) — "관측 무시"가 아니라 "재dispatch/재큐만 gate".
2. **handler_key resolve**(READY 이상 task만; BLOCKED 제외) — resolve 실패면 **즉시 FAILED**(forward·admit·poll보다 먼저; 존재하지 않는 handler로는 dispatch/poll할 수 없다, 종결표 HANDLER_NOT_FOUND 행).
3. **완료 관측 우선(timeout보다 앞)** — 최신 poll observed=SUCCEEDED(TERRAFORM_JOB)·최신 check observed=MET(CONDITION_CHECK)이 있으면 **DONE**으로 마감한다. **execution timeout·TTL 초과 판정보다 우선** — "만료는 fresh 상태 재독 후 판정"(결정 4a)이라 이미 완료된 작업을 timeout으로 실패시키지 않는다.
4. **timeout 판정** — (3)에서 DONE이 아니면: TERRAFORM_JOB execution timeout → attempt 실패(fail++ < maxFailCount면 RUNNING→READY, ==maxFailCount면 FAILED) · CONDITION_CHECK TTL 초과 → EXPIRED.
5. **그 외 일반 전이** — 아래 전진·종결·재시도 표.

**tick의 바깥 순서(task pass → pipeline 파생 pass).** due task 선별 조건·정렬(CANCELLING·predecessor 승격 후보·next_check_at 도래·timeout/TTL 후보·미소비 관측)은 [orchestrator-design.md](./orchestrator-design.md) 결정 1.1이 정본이다(`next_check_at ASC, last_checked_at ASC NULLS FIRST, created_at ASC, seq ASC`). 한 tick은 **due task를 그 정렬(파이프라인 내 seq ASC) 순서로 각각 위 1~5 평가에 따라 최대 1회 전진**시킨 뒤(각 전이는 독립 commit, 결정 3.3), 그 tick에 **커밋된 task 상태를 기준으로 pipeline 파생을 1회 평가**한다(파생 표 ①~④). 따라서 마지막 task가 terminal이 된 그 tick에 pipeline도 같은 tick에 수렴한다(별도 tick 지연 없음). **`BLOCKED → READY` predecessor 판정은 같은 tick에 먼저 처리된 seq-1 task의 커밋된 DONE을 본다**(seq ASC 처리라 predecessor가 먼저 commit됨) — 순차 chain이 한 tick에 한 칸씩 전진할 수 있다.

**전진 전이**

| From | → To | 트리거 / Guard | kind |
|---|---|---|---|
| (생성) | BLOCKED | pipeline 생성 시 task 행 생성 | 전체 |
| BLOCKED | READY | tick: 직전 task(seq-1) DONE → 승격 (순차 chain — seq 순서로 파생). **최저 seq task는 predecessor가 없어 첫 tick에 무조건 READY 승격**(아니면 첫 task가 BLOCKED에 stuck) | 전체 |
| READY | DISPATCHING | tick: handler resolve 성공(평가 순서 2) 후 **admit** — COUNT(DISPATCHING\|RUNNING) < slotCap일 때(READY TF = slot 큐); CAS + task_attempt 생성 + next_check_at | TERRAFORM_JOB |
| READY | WAITING_EXTERNAL | tick: handler resolve 성공(평가 순서 2) 후 dispatch 없이 조건 폴링 개시 — **이 전이 tick은 상태 전환 + next_check_at 세팅만 하고 task_check를 남기지 않는다**(상태=tick, 관측=호출 스레드, 결정 6 D-T4). **실제 첫 CHECK 호출·MET/ERROR 판정은 이후 WAITING_EXTERNAL self-loop(재시도 표)에서 수행** | CONDITION_CHECK |
| DISPATCHING | RUNNING | (다음) tick: attempt.response 적재(dispatch 응답 OK) 관측 → CAS (결정 3.1 5단계) | TERRAFORM_JOB |
| RUNNING | DONE | tick: 최신 poll observed=SUCCEEDED → 현재 attempt 성공 마감(result=OK·finished_at=tick·error_code=null) + **slot 반납**. **execution timeout보다 우선**(평가 순서 3·4) | TERRAFORM_JOB |
| WAITING_EXTERNAL | DONE | tick: 최신 check observed=MET (CONDITION_CHECK은 attempt·slot 없음 — 마감/반납 대상 없음). **TTL 초과 판정보다 우선**(평가 순서 3·4) | CONDITION_CHECK |

**종결(실패·timeout) 전이** — `fail_count`는 "성공하지 못한 시도 횟수"(결정 3.1), maxFailCount=max_fail_count.
(kind별 "시도" 단위: **TERRAFORM_JOB = `error_code≠null`로 마감된 실패 attempt 수** — dispatch가 IM_REJECTED/recovery timeout/crash(DISPATCH_NO_RESPONSE)로 마감, job poll이 `observed=FAILED`(JOB_FAILED) 관측, execution timeout(EXECUTION_TIMEOUT). **poll API 호출 오류(api_result=ERROR·CALL_TIMEOUT)는 attempt를 마감하지 않으므로 미가산** — 잡 상태를 못 읽은 것이지 잡 실패가 아니다(재시도 표 RUNNING self-loop 행). **CONDITION_CHECK = 실패한 CHECK 호출 수**(attempt 없음 — check api_result=ERROR 비-backpressure만 가산, RLE collapse 여부와 무관). 둘 다 backpressure·NOT_MET은 미가산. **`error_code=null`로 마감한 attempt는 fail_count 미증가** — 즉 ① **HANDLER_NOT_FOUND**(원인은 task_check가 보유, attempt error_code=null·fail_count 미소모, 종결 표 handler 행)와 ② **취소 정리**(pipeline=CANCELLING, 취소 표) attempt는 카운트되지 않는다(영구 실패·취소는 "성공 못 한 *재시도 가능* 시도"가 아니다).)

| From | → To | 트리거 / Guard | kind |
|---|---|---|---|
| RUNNING | FAILED | tick: poll FAILED / execution timeout으로 fail_count++ == **maxFailCount** → slot 반납 (DB: attempt result=FAIL + error_code=`JOB_FAILED`(poll observed=FAILED) \| `EXECUTION_TIMEOUT`(timeout); JOB_FAILED 관측 자체는 task_check.observed=FAILED가 보유 — api §0) | TERRAFORM_JOB |
| DISPATCHING | FAILED | tick: dispatch가 끝내 response 없이(또는 `IM_REJECTED` 비-backpressure)로 fail_count++ == **maxFailCount** → slot 반납 (DB: attempt result=FAIL + error_code=`DISPATCH_NO_RESPONSE`\|`IM_REJECTED`) | TERRAFORM_JOB |
| WAITING_EXTERNAL | FAILED | tick: check api_result=ERROR(**비-backpressure**)로 fail_count++ == **maxFailCount** (NOT_MET·429/503 backpressure는 미가산 — "아직"·"나중에"는 실패 아님). 사유 `CHECK_ERROR`(또는 `CALL_TIMEOUT`)는 **그 호출의 `task_check.error_code`**가 보유(②task_check 귀속, api §0) | CONDITION_CHECK |
| WAITING_EXTERNAL | EXPIRED | tick: WAIT_EXTERNAL TTL(총 체류) 초과 → EXPIRED (→ pipeline FAILED 파생). 사유 `TTL_EXPIRED`는 status=EXPIRED가 유일 원인이라 status에서 파생(별도 error_code 행 없음) | CONDITION_CHECK |
| READY·DISPATCHING·RUNNING·WAITING_EXTERNAL | FAILED | tick: **`handler_key` resolve 실패**(registry에 없음 — 핸들러 은퇴/규율 위반) → **즉시 FAILED**(`error_code=HANDLER_NOT_FOUND`, fail_count 미소모 — 영구 조건이라 재시도 무의미). 사유는 **synthetic `task_check` 1행**(O25 관측 장부): `kind=CHECK·name="orchestrator.handler.resolve"·api_result=ERROR·observed=null·external_handle=null·started_at=checked_at=tick 시각·poll_count=1·latency_ms=null(외부 호출 없음)·error_code=HANDLER_NOT_FOUND`. (BLOCKED는 from-state에서 제외 — handler resolve는 task가 serviceable(READY 이상)일 때 평가하므로, BLOCKED는 READY 승격 후에야 평가된다.) **DISPATCHING/RUNNING이라 active attempt가 있으면** 그 attempt를 `result=FAIL·finished_at=tick 시각·error_code=null`로 마감(원인은 task_check가 보유). 보유 slot 반납. **RUNNING TERRAFORM_JOB의 in-flight job은 죽일 수 없어 orphan으로 남는다** — 멱등이라 무해하고, **BFF가 추적을 끊으므로 BFF execution timeout이 아니라 worker의 terraform apply 자연 종료(유한)가 그 bound**다 | 전체 |

> EXPIRED는 **WAIT_EXTERNAL TTL 전용**이다. RUNNING의 execution timeout은 EXPIRED가 아니라 *attempt
> 실패*(fail_count++, slot 해제 — 결정 4a; **DB 기록 = result=FAIL + error_code=EXECUTION_TIMEOUT**, 별도 result enum 아님)이며, **비-CANCELLING 일반 경로에서는 재시도 소진(==maxFailCount) 시에만 FAILED**가 된다(미소진이면 RUNNING→READY 재큐). **CANCELLING drain 중에는 fail_count 잔여와 무관하게 직접 종결** — 취소 표 RUNNING 행 참조. (결정 4a timeout 표의
> "EXECUTE task"·"WAIT_EXTERNAL"은 각각 dispatch-poll kind(TERRAFORM_JOB)·CONDITION_CHECK의
> 구 라벨이다.)

**재시도 전이 (fail_count++ < maxFailCount)** — 같은 종결 트리거지만 한도 미소진이라 재dispatch한다.

| From | → To | 트리거 / Guard | kind |
|---|---|---|---|
| DISPATCHING | DISPATCHING (in-place) | dispatch 복구 timeout(response 미영속인 채 dispatch_recovery_timeout 경과 — crash 또는 `CALL_TIMEOUT` 1회 호출 timeout이 누적된 결과) 또는 dispatch api_result=ERROR(`IM_REJECTED` 비-backpressure) → 현재 attempt FAIL 마감(error_code=DISPATCH_NO_RESPONSE\|IM_REJECTED) fail++ → **새 attempt(attempt_no+1) 생성 + next_check_at 갱신**; **slot 보유한 채** 재dispatch. (단발 `CALL_TIMEOUT`은 호출 1회 실패이지 attempt 마감이 아니다 — task_check(kind=DISPATCH, error_code=CALL_TIMEOUT) 남기고 DISPATCHING 유지, recovery_timeout까지 response null이면 그때 위 DISPATCH_NO_RESPONSE 마감, api §0) | TERRAFORM_JOB |
| DISPATCHING | DISPATCHING (in-place, **backpressure**) | dispatch가 IM **429/503**(backpressure) → **fail_count 미소모**(실패 아님), task_check(kind=DISPATCH, **api_result=ERROR, error_code=null**) **새 1행** 기록(DISPATCH는 호출당 1행·RLE 안 함), **attempt 미마감(`finished_at=null` 유지) → 동일 attempt 재사용**(새 attempt 생성 안 함·`attempt_no` 불변; fail_count 미소모와 정합), **slot 보유**, next_check_at=`Retry-After`(없으면 다음 tick — **dispatch는 반복 폴이 아니라 cadence 하한이 없다**, orchestrator §3.1; poll/check만 cadence 하한 적용)로 미뤄 재dispatch (IM_REJECTED 하드 거부와 구분 — 그건 위 행 attempt 마감 fail++·새 attempt). **429/503이 반복돼 response가 계속 null이어도 dispatch_recovery_timeout의 DISPATCH_NO_RESPONSE 마감은 적용하지 않는다 — "마지막 task_check 관측이 backpressure면 복구 fail++ 마감을 적용 안 함"(결정 3.1)이라 backpressure 동안 attempt는 마감되지 않고 backoff 재dispatch만 반복한다. recovery_timeout 판정 기준은 *마지막 관측*이라 매 backpressure 관측이 사실상 마감 시점을 미룬다(별도 deadline 컬럼 없이 "마지막 관측 = backpressure이면 마감 보류"로 평가). backpressure가 풀린 뒤 다음 호출이 일반 오류(`CALL_TIMEOUT`·response 없음)이고 그 마지막 비-backpressure 관측 이후 recovery_timeout이 경과해야 비로소 위 행의 DISPATCH_NO_RESPONSE 마감으로 간다** | TERRAFORM_JOB |
| RUNNING | READY | poll **observed=FAILED**(잡 자체 실패)/execution timeout → 현재 attempt FAIL 마감(result=FAIL·finished_at=tick·error_code=`JOB_FAILED`\|`EXECUTION_TIMEOUT`) fail++; **slot 반납 후 READY로 재큐**(=slot 큐 재진입; 결정 5: 재dispatch도 admission 통과 — 재dispatch 시 새 attempt) | TERRAFORM_JOB |
| RUNNING | RUNNING (in-place) | poll observed=RUNNING(잡 진행 중) **또는 poll 호출 오류**(api_result=ERROR 비-backpressure error_code=`CHECK_ERROR`, 또는 `CALL_TIMEOUT` 1회 호출 timeout — 잡 상태를 *못 읽음*이지 잡 실패 아님 → **fail 미소모**(잡 실패가 아니라 관측 실패라 TERRAFORM_JOB poll은 미가산, 결정 6), task_check(kind=CHECK)의 그 호출 error_code에 기록, 재-poll) **또는 429/503 backpressure**(fail 미소모, task_check `api_result=ERROR, error_code=null`, next_check_at=`max(Retry-After, poll cadence)` 후 재-poll) → slot 보유한 채 계속 폴링 | TERRAFORM_JOB |
| WAITING_EXTERNAL | WAITING_EXTERNAL (in-place) | NOT_MET(미가산) 또는 check ERROR(**비-backpressure**: api_result=ERROR error_code=`CHECK_ERROR`, 또는 `CALL_TIMEOUT` 1회 호출 timeout → fail++) 또는 429/503 backpressure(fail 미소모; task_check `api_result=ERROR, error_code=null`, 다음 check = `next_check_at=max(Retry-After, ≥10분 polling guard cadence)`) → 계속 폴링 | CONDITION_CHECK |

**취소 전이 (pipeline = CANCELLING)** — forward edge만 gate, drain edge는 gate 안 함(결정 4c). drain은
**죽일 수 없는 in-flight side-effect job**(TERRAFORM_JOB)에만 적용된다 — read-only 폴링엔 drain할
대상이 없다.

| From | → To | 규칙 |
|---|---|---|
| BLOCKED · READY (전체 kind) | CANCELLED | **미dispatch task → 즉시 CANCELLED**(forward edge가 gate되어 전진 불가; slot 큐 대기 중인 READY TF 포함) |
| WAITING_EXTERNAL (CONDITION_CHECK) | CANCELLED | **read-only 폴링이라 drain할 in-flight job이 없다 → 폴링 중이어도 즉시 CANCELLED**(결정 4c) |
| DISPATCHING (TERRAFORM_JOB) | CANCELLED | **drain 대상이 아니다 → 즉시 CANCELLED**(slot 반납). drain은 *RUNNING으로 승격된* task에만 적용되고, DISPATCHING은 그 승격 전이라 drain 경로를 타지 않는다. **handle 적재 여부와 무관하다** — 보통은 response 미적재(handle 없음)지만, **호출 스레드가 cancel과 다음 tick 사이에 response를 막 적재한 경우라도(결정 3.1 5단계: 채택될 수 있음) DISPATCHING 취소는 drain하지 않고 CANCELLED로 종결**한다 — 적재됐던 job_id는 폴링되지 않고 버려진다. 원 dispatch가 IM에 accepted돼 실제 실행됐더라도 멱등이라 무해하고, **BFF가 추적을 끊으므로 그 orphan은 BFF execution timeout이 아니라 worker의 terraform apply 자연 종료(유한)가 bound**한다 — drain은 *handle을 가진 RUNNING*에만 적용된다(결정 4c). 재dispatch(forward edge)도 gate되므로 좀비가 되지 않는다. **진행 중이던 `task_attempt`(1단계에서 생성됨)는 `result=FAIL·finished_at=tick 시각·error_code=null`로 마감**(action 미완 → `outcome=FAILED` 파생; task status=CANCELLED가 권위라 별도 CANCELLED outcome 불요); **늦게 도착하는 dispatch response는 task가 terminal(CANCELLED)이라 단일 writer CAS가 write를 차단해 무시**(결정 6 단일 writer·3.1 5단계) |
| RUNNING (TERRAFORM_JOB) | (drain) 자연 terminal | **죽일 수 없는 in-flight job(job_id 영속됨) → drain** — terminal까지 폴링은 drain edge라 gate 안 함; 재dispatch/재시도(READY 재큐)만 gate(새 attempt 없음); slot은 terminal까지 보유. **drain 중 비terminal poll 결과(observed=RUNNING·poll ERROR/CALL_TIMEOUT·429/503 backpressure)는 일반 RUNNING self-loop(재시도 표 RUNNING 행)를 그대로 적용** — 폴링은 gate 대상이 아니므로 RUNNING 유지·slot 보유·계속 폴링(poll 오류·backpressure는 fail 미소모, backpressure는 next_check_at=max(Retry-After, poll cadence)). **drain 중 poll FAILED·execution timeout이 나면 일반 경로의 RUNNING→READY 재큐(forward edge)는 gate되므로 fail_count 잔여와 무관하게 RUNNING→FAILED로 직접 종결**(drain 완료; 결정 4c "execution timeout까지 돌고 terminal 도달 시 CANCELLED 확정"). drain 성공(observed=SUCCEEDED)이면 RUNNING→DONE(attempt result=OK·error_code=null)·실패면 RUNNING→FAILED — 어느 쪽이든 slot 반납. **drain 중 실제 job 실패/timeout은 사실대로 마감**한다: attempt `result=FAIL·error_code=JOB_FAILED|EXECUTION_TIMEOUT`(취소 정리 마감의 `error_code=null`과 달리 실제 실패라 사유를 남김), **fail_count는 증가**(실제 실패 사건이라 카운트하되 CANCELLING이라 재큐 없이 종결 — pipeline은 결정 1.1 ①로 CANCELLED 수렴이므로 fail_count 증가가 pipeline FAILED를 유발하지 않음). task의 실제 terminal(DONE/FAILED)은 히스토리에 사실대로 남고, pipeline만 CANCELLED로 수렴(결정 1.1 ① — FAILED 승격 금지) |

> **task CANCELLED ≠ pipeline CANCELLED.** task의 CANCELLED는 *폴링할 handle이 없는* task에 붙는다 —
> ① 미dispatch TERRAFORM_JOB(BLOCKED/READY) · ② **DISPATCHING** TERRAFORM_JOB(RUNNING 승격 전이라 handle 적재 여부와 무관하게 drain 안 함) · ③ 모든
> CONDITION_CHECK(애초에 dispatch·handle 없음). **RUNNING으로 승격돼 job_id 폴링이 확립된 in-flight job만** 자기 자연
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
                       ≥10분 cadence 재폴링 │   │  NOT_MET(미가산) · api_result=ERROR(fail++ <maxFailCount)
                                          └───┘
                                          ├─ check ERROR 누적 → fail++ == maxFailCount ──► [FAILED]
                                          ├─ WAIT_EXTERNAL TTL(기본 7일) 초과 ──► [EXPIRED] → pipeline FAILED
                                          └─ [중단](CANCELLING) ──────────────► [CANCELLED]
```

1. **(생성) → BLOCKED** — pipeline 생성 시 task 행만 생성.
2. **BLOCKED → READY** — predecessor 전부 DONE → tick 승격.
3. **READY → WAITING_EXTERNAL** — tick이 조건 폴링 개시. dispatch 없음 → **task_attempt 행을 만들지 않는다**. **이 전이 tick은 상태 전환 + next_check_at 세팅만 하고 task_check도 남기지 않는다**(첫 CHECK 호출은 아래 4의 WAITING_EXTERNAL self-loop에서; 상태=tick, 관측=호출 스레드).
4. **WAITING_EXTERNAL 자기루프(폴링)** — ≥10분 cadence(WAIT_EXTERNAL polling guard, 관리자 조정)마다 tick이
   check 발사. **폴링은 `task_check(kind=CHECK)` 관측 run에 접힌다**(연속 동일 관측 collapse·poll_count++; 관측이
   바뀌면 새 run — O24→RLE 후속17). observed=NOT_MET이면 계속(같은 NOT_MET run poll_count++; fail_count 무변동 —
   "아직"은 실패 아님); api_result=ERROR(비-backpressure 호출 실패)면 fail_count++, < maxFailCount면 계속(429/503 backpressure는 미가산).
5. **→ DONE** — observed=MET.
6. **→ FAILED** — check ERROR 누적으로 fail_count++ == maxFailCount(NOT_MET은 미가산).
7. **→ EXPIRED** — WAIT_EXTERNAL TTL(기본 7일) 초과 → pipeline FAILED 파생. (무한 대기 없음.)
8. **→ CANCELLED** — [중단] 시. in-flight side-effect job이 없어 drain 대상이 없으므로 폴링 중
   (WAITING_EXTERNAL)이어도 즉시 CANCELLED(결정 4c — drain은 TERRAFORM_JOB의 죽일 수 없는 job에만).

attempt가 0개여도 **모든 폴링 관측이 CHECK 관측 run(+poll_count)으로 남아 조사 타임라인은 완전**하다(동일 관측 반복은
run에 접힘 — RLE 후속17). DISPATCH-kind task_check는 없다(dispatch 없음).
