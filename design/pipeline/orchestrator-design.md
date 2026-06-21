# Pipeline Orchestrator — 상세 설계

> [ADR-016: Install/Delete Pipeline Orchestration](../../docs/adr/ADR-016-install-delete-pipeline-orchestration.md)의 상세 설계 문서.
> ADR은 "왜"를, 이 문서는 "어떻게"(상태기계·DB 모델·tick 흐름·dispatch 5단계·crash recovery·slotCap admission·CANCELLING precedence)를 다룬다.
> 결정 번호(결정 1/3/4/5/6/7 · D-T1~D-T7 · 4a~4d)는 [decision-history](./decision-history.md)와 공유한다.

---

## 아키텍처 개요

```
┌────────────────────────── Admin Console ──────────────────────────┐
│  파이프라인 보드 · Run 히스토리 · TargetSource 설치 탭 · 알림 · 설정    │
└───────────────┬────────────────────────────────────────────────────┘
                │  Admin API — UI = API 동일 표면 (계층 규칙)
┌───────────────▼────────────────────────────────────────────────────┐
│ BFF (Java 21+)                                                      │
│                                                                     │
│  API 핸들러 ──전이를 기록──┐            History / Query API          │
│  (생성·재시도·중단)         │            (target별·기간별,             │
│                            ▼             run→task→attempt→check)   │
│                  ┌──────────────────┐               ▲               │
│                  │     BFF DB       │───────────────┘               │
│                  │ pipeline · task  │      ┌────────────────────┐   │
│                  │ task_attempt     │◄─────│ Reconciler 30s tick│   │
│                  │ task_check       │─────►│ (advisory lock 리더)│   │
│                  │ pipeline_event   │      │ · slot 스케줄 (slotCap (N))   │   │
│                  │   (= outbox)     │      │ · READY dispatch   │   │
│                  │ def_snapshot     │      │ · 외부호출 async 발사│   │
│                  └────────┬─────────┘      │ · 관측 보고 상태전이  │   │
│  Notifier ◄──미통지 이벤트──┘                └─────┬─────────┬─────┘   │
│      │                                          │         │         │
│      ▼                       async: run/poll/check 호출  │         │
│  인앱 알림 센터                                │              │         │
│                                    ┌─────────▼───┐  ┌───────▼────────┐
│                                    │ Infra       │  │ Backend Manager │
└────────────────────────────────── │ Manager     │  │ / provider 상태  │
                                     └───┬────▲────┘  └────────────────┘
                              pubsub │    │ 결과 보고 — 누락 가능(드묾)
                                     ▼    │ (execution timeout이 흡수)
                                 ┌────────┴─────────┐
                                 │ TerraformWorker  │
                                 │ k8s pod·dedup없음 │
                                 └──────────────────┘
```

DB로 들어가는 모든 화살표는 동시에 히스토리 레코드다: 상태 테이블, attempt 로그, 관측
로그(task_check), 이벤트 outbox가 같은 DB에 누적된다 — 단 **하나의 tx가 아니라 두 writer로 갈린다**(D-T4):
**상태 전이 tx**(tick)는 `pipeline`·`task` 상태 + `pipeline_event` + attempt 생애주기 경계(dispatch 시 attempt 생성·terminal 시 마감)를 한 tx로 쓰고, **호출 스레드 tx**는 관측(`task_check`)·산출(`task_attempt.response`)을 별도로 쓴다. 다음 tick이 그 관측을 소비해 상태를 전진시킨다.

> 다이어그램의 'async 발사'·'Java 21+'에서 — 아키텍처 불변식은 *비블로킹 async 발사*이며,
> 그 구현(Virtual Thread·pinning·HTTP client)은 **implementation-notes.md §A**.

---

## 결정 1 — 오케스트레이션: BFF 내부 durable state machine + reconciler tick, DB가 유일한 상태

> 흡수: 구 D1, D2, D6, D7, D8, R4, Options A–F

### 1.1 구조

BFF 안의 pipeline-orchestrator 모듈. 워크플로 엔진도, 메시지 브로커도, 별도 서비스도 없다.

- 모든 Pipeline/Task 상태는 BFF 소유 DB에 산다(사용자 결정). Backend Manager는 도메인 상태만,
  Infra Manager는 Terraform 상태만 가진다.
- 단일 논리 스케줄러(reconciler)가 고정 tick(주기는 Part II)으로 깨어나 due task를 선별한다 —
  직전 seq task가 DONE이라 READY로 승격됐으나 아직 dispatch 안 된 task(순차 chain에선 파이프라인별 최저
  seq), 상태 확인이 도래한 RUNNING/WAITING_EXTERNAL, 시간 초과 task —
  `next_check_at ASC, last_checked_at ASC NULLS FIRST, created_at ASC, seq ASC` 순서
  (가장 밀린 것 우선; 기아 방지)로 각 task의 다음 전이를 수행하고, 상태와 이벤트를 같은
  트랜잭션으로 기록한다.
- BFF가 다중 replica로 뜨면 DB advisory lock(`pg_try_advisory_lock`)을 잡은 한 pod만 tick을
  돌리고 나머지는 건너뛴다. 메모리 상태에 의존하지 않으므로 실행 중 재시작/재배포는 구조적으로
  안전하다(검증: 결정 3.3).
- **UI 액션은 외부 호출도 task 전진도 하지 않는다.** API는 Infra Manager/Backend Manager를
  직접 호출하지 않고, task dispatch/poll/retry/drain·slot 회계도 수행하지 않는다 — 전적으로
  reconciler tick의 몫이다(결정 3.2). API가 하는 것은 **pipeline-level 전이뿐**이다: **[중단]은
  공통 전이 함수로 `RUNNING → CANCELLING`을 즉시 수행**한다(CAS prior=RUNNING + pipeline_event,
  외부 호출 없음) — 그 결과의 task cancel/drain은 다음 tick이 처리한다(결정 4c). **[재시도]는
  기존 run 조작이 아니라 (생성 시점 현재) recipe의 새 pipeline 생성**이다(결정 5; 버전 resolution은 결정 7.3). 별도 intent row나
  `cancel_requested_at` 컬럼은 두지 않는다 — 중단 의사는 CANCELLING 상태 자체가 표현하고, 누가
  언제 했는지는 그 전이가 남긴 pipeline_event(actor)로 감사된다.
- **Pipeline 상태는 Task 상태에서 파생된다.** reconciler는 개별 Task를 전진시키고(READY →
  dispatch, RUNNING → check, 시간 초과 → expire) Pipeline 상태 갱신은 부산물이다: 전 task
  DONE이면 DONE, 재시도 소진 task가 나오면 FAILED, [중단] 후 in-flight task가 모두 drain되면
  CANCELLED. reconciler는 "파이프라인을 돌리지" 않는다 — task를 전진시킨다.
- **이 파생 규칙은 병렬이 아니라 순서대로 평가된다 — CANCELLING이 최우선이다.** 위 세 파생
  (DONE/FAILED/CANCELLED)은 동시 비교가 아니라 다음 우선순위로 판정한다. **① pipeline.status가
  CANCELLING이면 그것이 최우선:** forward edge(readying·dispatching·retrying)는
  결정 4c에 따라 gate되고, 아직 dispatch 안 된 task는 즉시 CANCELLED, in-flight task는 terminal
  (또는 execution timeout)까지 drain한다. **이 동안 어떤 task가 어떤 terminal(FAILED·EXPIRED 포함)에
  도달하든 pipeline을 FAILED로 승격하지 않는다.** 판정 기준은 *failure가 발생한 시각*이 아니라
  *파생을 수행하는 시점에 pipeline.status가 CANCELLING인지*다 — 상태 기준이지 시간 기준이 아니다
  (시간 기준이면 CANCELLING 직전 확정된 fail_count 소진분이 새고 CAS 전이와 어긋난다). 모든
  in-flight가 drain되면 pipeline = **CANCELLED**. task의 실제 terminal(FAILED는 FAILED)은 attempt·
  task 히스토리에 사실대로 보존되고 pipeline 상태엔 무영향이다 — CANCELLED는 *폴링할 durable handle이 없는*
  task(미dispatch BLOCKED/READY · job_id 미영속 DISPATCHING · 모든 CONDITION_CHECK)에 붙고 pipeline만
  CANCELLED로 수렴한다(job_id 영속된 RUNNING은 drain — state-machine.md cancel 표). **② CANCELLING이 아니고** status=FAILED
  task가 있으면(재시도 소진 fail_count==maxFailCount 또는 HANDLER_NOT_FOUND 등 fail_count 미소모 영구 실패) FAILED, **③ CANCELLING이 아니고** TTL EXPIRED task가 있으면
  FAILED, **④ 전 task가 DONE이면** DONE. 근거: 결정 4c가 "취소는 실패·leak할 수 없고 늦을 수만
  있다"를 보장하므로 CANCELLING 이후 종착지는 CANCELLED로 단일 수렴해야 한다 — FAILED 승격을
  허용하면 같은 상태가 두 종착지를 갖게 되어 그 보장이 깨진다.

### 1.2 데이터 모델 (BFF DB)

```
pipeline        id, target_source_id, type(INSTALL|DELETE), provider,
                status(RUNNING|CANCELLING|DONE|FAILED|CANCELLED),
                triggered_by(actor: human|system|ai — pipeline_event.actor와 동일 도메인), created_at, started_at, finished_at,
                last_activity_at, fail_reason
                -- fail_reason = pipeline FAILED 수렴 원인 요약(저장 컬럼) — tick이 FAILED 파생 시 기록:
                --   `{task_id: FAILED/EXPIRED 유발 task, error_code: 그 task의 canonical errorCode}`
                --   (저장 jsonb이라 키는 snake_case = snapshot.spec과 동일 계층 — ADR-019; API DTO failReason의 camelCase `{taskId, errorCode}`와 별개, api §0).
                --   (EXPIRED→TTL_EXPIRED · poll 잡 실패→JOB_FAILED · check 누적 실패→CHECK_ERROR · handler 미해결→HANDLER_NOT_FOUND 등).
                --   CANCELLING precedence로 CANCELLED 수렴 시엔 미설정(null) — 취소는 실패 아님(결정 1.1). api failReason은 이 컬럼.
                -- 실행 단위 = target_source_id (1 pipeline : 1 target), 생성 시 고정.
                --   실행 입력 일반화(parameters jsonb)는 도입하지 않는다(개정 4판) — 실행 단위는
                --   target source로 고정. 조회는 target_source_id 인덱스(아래).
                -- definition_version 컬럼 없음 — 그 run의 버전·구성은 pipeline_def_snapshot이 단일 보유
                --   (1:1·write-once 재현 권위; 중복 비정규화 안 함, 결정 7).
                -- started_at = RUNNING 진입 시각 = 생성 시각(생성 즉시 RUNNING이라 created_at과 동일, 결정 1.3).
                --   기간(overlap) 필터의 기준 컬럼(§1.3). finished_at = terminal 도달 시각.
                -- last_activity_at = 마지막 상태 전이(task·pipeline) 시각. 매 전이 tx에서 갱신(2~4 task·
                --   ≥10분 cadence라 저빈도). 보드 기본 정렬 키. (§1.3 "비정규화 target 요약 컬럼 안 둠"과
                --   무관 — pipeline 자신의 활동 시각이지 target 롤업이 아니다.)

task            id, pipeline_id, seq, name, handler_key,
                kind(TERRAFORM_JOB|CONDITION_CHECK),
                status(BLOCKED|READY|DISPATCHING|RUNNING|
                       WAITING_EXTERNAL|DONE|FAILED|EXPIRED|CANCELLED),
                polling_interval(≥10m guard), ttl, execution_timeout,
                deadline_at, max_fail_count, fail_count,
                next_check_at, last_checked_at, started_at, finished_at
                -- kind = TaskKind 2종(결정 2); dispatch/poll 흐름과 slot 소비 여부가 kind에서 정해진다
                --   (TERRAFORM_JOB이 공유 IM slot을 소비, 결정 4b). slot 큐 대기는 별도 상태가 아니라
                --   READY ∧ kind=TERRAFORM_JOB로 표현(WAITING_SLOT 제거, S26).
                -- handler_key = 안정적 코드 class 식별자(예 "aws.tf.network"). reconciler가
                --   handler_key→handler class 레지스트리로 dispatch/check를 라우팅한다 — recipe(코드)가
                --   task 생성 시 박는다. 같은 kind 안의 여러 task(예 ApplyNetwork vs ApplyIntegration)는
                --   handler_key로 구분된다(kind는 너무 거칠고 name·seq는 식별자 아님). kind는 handler class가
                --   선언하는 값을 row에 비정규화(slot COUNT 등 쿼리용). name = 표시 라벨(UX)일 뿐.
                --   미해결(registry에 없음 — 핸들러 은퇴/규율 위반) 시 task 즉시 status=FAILED·fail_count 미소모.
                --   원인 errorCode=HANDLER_NOT_FOUND는 task에 error_code 컬럼이 없으므로 synthetic task_check 1행에 기록
                --   (kind=CHECK·name="orchestrator.handler.resolve"·api_result=ERROR·observed=null·external_handle=null·error_code=HANDLER_NOT_FOUND·poll_count=1·latency_ms=null; 외부 호출 없는 내부 평가라 kind 고정 — state-machine 종결표·§1.2 task_check ③·api §0).
                --   active attempt(DISPATCHING/RUNNING) 있으면 result=FAIL·finished_at=tick·attempt.error_code=null로 마감(원인은 위 task_check가 보유);
                --   RUNNING TF의 in-flight job은 orphan — BFF 추적 중단이라 BFF execution timeout 아닌 worker terraform 자연 종료가 bound — state-machine 종결표.
                -- last_checked_at = tick이 이 task를 마지막으로 서비스(발사)한 시각 — due 선별의 기아 방지
                --   정렬 키(§1.1 last_checked_at ASC NULLS FIRST). 일반 발사 시 tick이 last_checked_at·next_check_at을
                --   함께 기록한다. 단 next_check_at은 상태 전이가 아니라 *스케줄 힌트*라 429/503 backpressure 응답의
                --   next_check_at 재설정은 호출 스레드가 직접 수행한다(D-T7; task.status만 tick 전용). task_check.checked_at(관측 시각)과 다르다.
                -- timeout 필드 규약: polling_interval·ttl·execution_timeout = recipe(snapshot.spec)가 박는
                --   task별 duration(생성 시 frozen). deadline_at = 현재 적용 timeout의 절대 만료 시각
                --   (TERRAFORM_JOB: dispatch + execution_timeout; CONDITION_CHECK: 최초 WAITING_EXTERNAL 진입 + ttl)을
                --   reconciler가 계산·갱신하는 파생값 — `*_at`=절대 timestamp, 위 셋=duration. 호출별 HTTP deadline은
                --   task별이 아니라 전역+TaskKind 오버라이드(operations D-T3)라 row/snapshot에 task별로 저장하지 않는다.
                -- task.started_at = 이 task가 BLOCKED를 벗어나 실행을 개시한 시각(READY→DISPATCHING(TERRAFORM_JOB)
                --   ·READY→WAITING_EXTERNAL(CONDITION_CHECK) 전이; 두 kind 공통 = 첫 실행 활동). finished_at =
                --   terminal(DONE|FAILED|EXPIRED|CANCELLED) 도달 시각. (task_attempt.started_at=dispatch별 시작,
                --   task_check.started_at=호출 발사 시각과 구분 — task 단위 vs attempt/호출 단위.)
                -- 단수 external_handle 컬럼 없음: dispatch 산출(handle)의 home은
                --   attempt.response(jsonb); 폴링 대상 handle은 거기서 추출(결정 3.1).

task_attempt    id, task_id, attempt_no, started_at, finished_at,
                result(OK|FAIL), error_code, error_detail, response(jsonb)
                -- dispatch당 1행; dispatch → terminal 생애주기를 추적(action의 생애주기).
                -- attempt는 dispatch 시(READY→DISPATCHING 1단계) 생성돼 RUNNING 동안 **미완료로 존재** →
                --   `result·finished_at·error_code`는 **terminal 전까지 null**, `response`는 dispatch 응답 후 set(그전 null).
                -- result(OK|FAIL) = attempt 전체의 **terminal result**(dispatch API 호출 accepted 여부 아님).
                --   dispatch 호출 자체의 성공/실패 관측은 task_check(kind=DISPATCH)에, dispatch 산출은 response에 남는다.
                --   EXECUTION_TIMEOUT은 별도 result 값이 아니라 result=FAIL + error_code=EXECUTION_TIMEOUT으로 기록.
                --   API Attempt.outcome은 이 result+error_code에서 파생되는 표현(저장값 아님 — api.md 매핑).
                -- response = dispatch 원응답(write-once·불변; 재시도=새 attempt=새 response).
                --   handle의 home — TaskKind별 응답 형태를 컬럼 ALTER 없이 같은 컬럼에 담는
                --   그릇(TERRAFORM_JOB {job_id} · CONDITION_CHECK 없음).
                --   terraform_job_id 전용 컬럼은 만들지 않는다 — poller가 response에서
                --   필요한 값을 추출한다(결정 2/3.1). 모든 dispatch는 단수 handle(attempt:handle = 1:1).

task_check      id, task_id, checked_at, started_at, poll_count,
                kind(DISPATCH|CHECK), name,
                api_result(PENDING|OK|ERROR), observed(RUNNING|SUCCEEDED|FAILED|MET|NOT_MET),
                error_code, latency_ms, external_handle
                -- 관측의 장부(호출의 장부 아님); Task 소속. **행 단위 = kind별로 다르다(O24 → RLE 개정, 후속17):**
                --   • DISPATCH: 1행 = 1 dispatch 호출. 저빈도(attempt당 1회)·side-effect라 crash "발사했나" 구분이 필요 →
                --     D-T5 PENDING 선기록 유지(호출 직전 PENDING, 응답 후 채움); poll_count=1, collapse 안 함.
                --   • CHECK: 1행 = **관측 run**(연속 동일 관측 collapse; partition = `task_id+kind+name+external_handle` 내에서,
                --     state-machine). 같은 `(api_result, observed, error_code)`가 반복되면
                --     **기존 run UPDATE**(checked_at=now, poll_count++, latency_ms=이번 폴), 관측이 바뀌면(전이·ERROR·
                --     backpressure 변화·MET) **새 run INSERT**(poll_count=1, started_at=checked_at=now). → NOT_MET 1000폴 =
                --     run 1행(poll_count=1000). 모든 *구별되는* 관측(전이·error_code별 ERROR run·backpressure run)은 보존,
                --     **동일 반복만 count로 접힘**(조사 타임라인 = run 시퀀스; 반복은 정보 아님 — 사용자 통찰). 외부 호출 없는
                --     평가도 동일하게 run으로 남긴다. CHECK은 read 멱등이라 per-poll PENDING 선기록 불요(crash=재-poll로 무해).
                -- external_handle = 그 행이 확인한 id의 *참조*(handle 저장소 아님 — home은 attempt.response).
                -- started_at = run 첫 발사 시각(CHECK)·호출 발사 시각(DISPATCH). checked_at = run 마지막 관측 시각·관측 시각
                --   (DISPATCH PENDING이면 null). poll_count = run에 접힌 폴 수(DISPATCH=1). 정렬·latestCheck = **started_at 기준
                --   현재 열린 run**(CHECK이면 그 run의 checked_at·poll_count가 "최근 N회 확인" 표현).
                -- kind는 표현(UX/조사) 라벨이지 control flow 분기 신호가 아니다(D-T6 인근 원칙).
                --   JOB_POLL+CONDITION_CHECK→CHECK 통합; 핸들폴링 vs 조건평가는 external_handle 유무로 파생.
                --   강제 확인(force-check)은 제거(개정 4판) — 모든 확인은 polling 정책으로 수행한다.
                --   observed = 원시 kind별 값이 canonical(O19 해소): 폴링 RUNNING/SUCCEEDED/FAILED ·
                --     조건 MET/NOT_MET; reconciler 판정(DONE/PENDING/FAILED)은 (kind, observed)에서 파생.
                -- name = 호출 operation 식별자(어떤 API/동작; 예 im.terraformApply·im.jobStatus).
                -- error_code 카탈로그·저장위치 3분류 정본=api.md §0. **task_check.error_code에 실리는 건 ② 관측분
                --   (CHECK_ERROR·CALL_TIMEOUT)과 ③ HANDLER_NOT_FOUND(synthetic 1행)뿐**; ① attempt 귀속
                --   (EXECUTION_TIMEOUT·DISPATCH_NO_RESPONSE·IM_REJECTED·JOB_FAILED)은 task_attempt.error_code에,
                --   TTL_EXPIRED는 status=EXPIRED 파생(별도 행 없음). (JOB_FAILED 관측은 task_check.observed=FAILED가 보유.)
                -- (detail 컬럼 없음 — terminal 스냅샷 캡처/구 postCheck는 v2 defer; 도입 시 additive 추가, v2-deferred.md.)
                -- attempt_id 컬럼 미도입(O26 해소): job_id가 요청별 고유 발급(재dispatch=새 job_id)이라
                --   external_handle∈attempt.response soft-link가 무모호 — 명시 링크 컬럼 불요.

pipeline_event  id, pipeline_id?, task_id?, type, severity, payload(jsonb),
                actor(human|system|ai), created_at, notified_at
                -- append-only; 감사 로그이자 알림 outbox. pipeline_id는 nullable —
                --   비-pipeline 감사 이벤트(settings 변경, api.md §4)는 pipeline_id=null.

pipeline_def_snapshot   pipeline_id, definition_key, definition_version,
                        type, provider, spec(jsonb)
                        -- 실행 기록(결정 7). 생성 시 1회 박제(write-once)·1 pipeline:1행. 그 run이 resolve한
                        --   definition 원본을 고정한다. spec(jsonb) = resolve된 전체 recipe:
                        --   { name, tasks:[{ seq, handler_key, name(표시), kind, ttl?,
                        --     polling_interval?, execution_timeout?, max_fail_count }] }
                        --   (각 task config = task row에 freeze되는 duration과 동일; 호출별 HTTP deadline은
                        --    task별 아닌 전역+TaskKind 설정이라 spec에 없음 — operations D-T3).
                        -- task row = 그 run의 실행 상태(가변; reconciler가 전진). snapshot.spec = 그 run의
                        --   definition 원본(불변·재현 권위; 실행 때 재읽지 않음). 코드=실행 권위·snapshot=이력 권위.
                        --   절연 범위 = recipe/config(task 목록·순서·ttl·polling·execution_timeout·max_fail_count) — default
                        --   release를 올려도 in-flight·과거 run의 *구성*은 불변. 단 task class 코드(핸들러 동작)는
                        --   절연 안 됨 — reconciler는 현재 배포 코드로 실행하므로 같은 task 구현을 바꾸면 in-flight도
                        --   새 코드를 탄다(코드=실행 권위; task class는 배포 간 동작 호환 전제). 물리 삭제 금지.
```

**task_attempt와 task_check는 task 아래 형제다(attempt → check 중첩이 아님).** 역할이 다르다:
`task_attempt` = **action(side effect)의 생애주기**(dispatch당 1행, dispatch→terminal, 재시도
회계 attempt_no — 단 **429/503 backpressure 재호출은 동일 logical attempt 재사용**으로 새 행을 만들지 않고 그 호출 이력은
task_check에만 누적) — 관측값 저장 테이블이 아니다. `task_check` = **외부 호출의 관측**(DISPATCH 호출당 1행·CHECK
관측 run당 1행, RLE 후속17). 근거:
① 조건 전용 task(dispatch 없음)는 **attempt가 0개인데 check는 존재**한다(dispatch 0..1) — 중첩
구조면 부모 없는 check를 표현할 수 없다. 훅 단순화 모델에서 이 케이스가 더 일급이 되어 형제 구조의
정당성이 오히려 강화된다. ② crash 복구 순간에는 check의
attempt 소속이 본질적으로 모호하며, 관측은 사실이고 사실은 해석보다 먼저 기록되어야 한다.
③ 사고 조사 surface가 task 단위 merged timeline이다. attempt와의 상관관계가 필요하면
task_check.external_handle(확인한 id)이 attempt.response의 handle과 일치하는지로 soft link가
복원된다(attempt_id 컬럼은 미도입 — O26 해소: job_id 요청별 고유 발급이라 handle이 attempt 간 비중복).
모호한 경우 link가 없는 것이 정확한 표현이다.

내부 task 상태가 UI 어휘보다 풍부한 것은 의도다. 매핑:

| 내부 | 보드 라벨 |
|---|---|
| BLOCKED / READY | 대기 (BLOCKED=의존 미해소, READY=전진 가능; READY ∧ kind=TF = slot 큐 — 순번은 admission 순서로 파생) |
| DISPATCHING / RUNNING | 실행 중 |
| WAITING_EXTERNAL | 외부 대기 |
| DONE / FAILED / EXPIRED / CANCELLED | 완료 / 실패 / 타임아웃 / 중단 |

(장시간 check 진행 중을 위한 별도 상태는 두지 않는다 — 결정 6, D-T6. "확인 중" 노출이
필요하면 DISPATCH는 api_result=PENDING, **CHECK은 RLE라 PENDING 행이 없으므로 nextCheckAt**(다음 폴 예정)으로
파생한다 — api §0.)

(의존성 대기는 **BLOCKED** 상태로 표현한다 — task는 BLOCKED로 시작하고, 직전 task(seq-1)가
DONE이면 reconciler가 READY로 승격시킨다(순차 chain — 별도 `depends_on` 배열 없이 seq 순서로 파생).
**최저 seq task는 predecessor가 없으므로 predecessor 조건이 공집합=충족 → 첫 tick에 무조건 READY로 승격된다**(특례 아님 — "predecessor 전부 DONE"의 자연 귀결; 빠뜨리면 첫 task가 BLOCKED에 갇힌다). **READY는 "의존이 풀려 전진 가능한
후보"임을 보장**하고 BLOCKED는 "아직 후보가 아니라 reconciler가 쳐다볼 필요도 없는" 상태다 — 둘을
합치면 READY가 그 보장을 잃으므로 분리한다. 따라서 task 상태는 9종이다 — slot 큐 대기는 WAITING_SLOT
상태 없이 READY ∧ kind=TERRAFORM_JOB로 파생한다(S26).)

### 1.3 기록·조회·알림 — current-state 갱신 + 이력 추가의 단일 규율

상태와 이력을 나눠 기록한다 — **현재 상태**는 `pipeline`·`task` 행에 CAS로 **갱신**하고(current-state,
과거 버전 미보관), **일어난 일의 이력**은 행을 **추가**해 남긴다(`task_attempt` 시도당 · `task_check`
**DISPATCH 호출당·CHECK 관측 run당**(RLE 후속17) · `pipeline_event` 이벤트당). 추가된 이력 행은 결과만 사후 채울 뿐(PENDING→결과 · notified_at)
**과거 행을 다시 쓰지 않는다**(예외: CHECK의 *현재* 관측 run은 동일 관측 반복 시 checked_at·poll_count를 aggregate UPDATE — RLE 후속17; closed run·DISPATCH 행은 불변) — 2차 장부도 로그 고고학도 없다. 아래는 run→task→attempt→check 4개 grain:

| Grain | 테이블 | 1행의 의미 |
|---|---|---|
| Run | pipeline | target source당 설치/삭제 실행 1회 |
| Step | task | run 내 task (현재 상태 + 타이밍) |
| Attempt | task_attempt | 실행 시도 생애주기 (dispatch → terminal), dispatch당 1행 |
| Observation | task_check | Task에 대한 외부 호출 관측 — **DISPATCH 호출당 1행 · CHECK(핸들 폴링·조건 평가) 관측 run당 1행**(RLE; 동일 관측 반복은 poll_count로 접힘) |

기록 시점:

| 생애주기 순간 | 기록 |
|---|---|
| Pipeline 생성(→ 즉시 RUNNING) / 종료 | pipeline 타임스탬프 + pipeline_event; 생성 시 pipeline_def_snapshot |
| Task 상태 전이 | task 갱신 + pipeline_event |
| Dispatch 호출 | **(tick)** DISPATCHING 전이 · task_attempt 행 생성 · next_check_at 갱신 → **(호출 스레드)** task_check kind=DISPATCH 선기록(PENDING) → 호출 → response·task_check 채움 → **(다음 tick)** RUNNING 전이 (결정 3.1 5단계) |
| 각 완료 확인(check) | **(호출 스레드)** 호출 → 결과로 task_check kind=CHECK **관측 run UPDATE(현재 run과 동일 관측)-or-INSERT(관측 변화)** (RLE 후속17 — per-poll PENDING 선기록 없음; observed 핸들폴링 RUNNING/SUCCEEDED/FAILED·조건평가 MET/NOT_MET). **호출 스레드는 관측(task_check)만 기록** — 전이·`fail_count++`는 **다음 tick**(D-T4 단일 writer: 상태는 tick). **kind별 fail 회계 차등**: CONDITION_CHECK은 `api_result=ERROR`(비-backpressure)면 fail_count++(check 호출이 task의 일이라 못 읽음=진전 없음); **TERRAFORM_JOB poll**은 `api_result=ERROR`(비-backpressure)여도 **잡 상태를 못 읽었을 뿐 잡 실패가 아니라 fail 미소모·RUNNING 유지·재-poll**(attempt 마감은 `observed=FAILED`(JOB_FAILED)/execution timeout만). 429/503 backpressure는 둘 다 미가산 |
| 알림 발송 | pipeline_event.notified_at |

**DISPATCH 호출**은 **호출 직전에 task_check 행을 PENDING으로 선기록**하고 응답 후 채운다(결정 6, D-T5)
— side-effect라 "호출을 시도했으나 결과 미상"(행 존재 + PENDING)과 "호출 자체를 안 함"(행 없음)을 구분해야
하므로. **CHECK 호출**은 read 멱등이라 그 구분이 비임계(crash=재-poll 무해)이고, 또 RLE(후속17)로 관측 run에
접히므로 **per-poll PENDING 선기록을 하지 않고** 결과 후 run을 UPDATE-or-INSERT한다. 어느 쪽이든 "실행이
성공했는가", "확인이 무엇을 관측했는가"가 로그 고고학이 아니라 일급 조회 가능한 사실로 남는다.

조회 표면 — 리스트 엔드포인트 하나 + 드릴다운, 보드와 히스토리 뷰가 공유:

- **횡단 조회 + 드릴다운** — run 목록 / run 상세(+task) / task 타임라인(attempt+check 병합). 정확한 endpoint·
  쿼리 파라미터 정본은 [api.md §1](./api.md)이며, 여기선 **조회 *능력*과 그 기반만** 규정한다(중복 방지).
  - **기간 필터는 overlap 의미론**(half-open `[from, to)` — api §1과 동일): `started_at < to AND (finished_at IS NULL OR finished_at > from)`.
  - task 타임라인은 **사고 조사 surface**: 모든 외부 상호작용을 시간순 한 줄로, timeout 시 어느 층이 발화했는지
    (CALL_TIMEOUT vs EXECUTION_TIMEOUT vs TTL EXPIRED)까지.

인덱스: `pipeline(target_source_id, started_at DESC)`, `pipeline(started_at)`,
`pipeline(last_activity_at DESC)`(보드 기본 정렬 — api §1 `lastActivityAt,desc`),
`task_check(task_id, started_at)`, `task(pipeline_id, seq)` **unique**(순차 chain·중복 seq 방지),
`pipeline_event(pipeline_id, created_at)`,
`unique(target_source_id) WHERE status NOT IN (DONE,FAILED,CANCELLED)`(결정 5 — target당 non-terminal pipeline 1건 강제·중복 생성 차단).

`next_check_at`도 노출한다 — 운영자가 "다음 확인 14:32"를 본다(api Task `nextCheckAt`). 보드 기본 정렬(최근
활동순)은 `pipeline(last_activity_at DESC)`로, target 이력 조회는 `pipeline(target_source_id, started_at DESC)`로
충분하다(2000건 규모는 작다) — 별도 비정규화 요약 컬럼은 두지 않는다.

보존: pipeline / task / task_attempt / pipeline_event는 무기한. task_check는 **RLE(O24→후속17)로 행 수가
폴 수가 아니라 *구별되는 관측 run* 수에 비례** — 7일 WAIT_EXTERNAL이 계속 NOT_MET이어도 **run 1행(poll_count로 1000폴 흡수)**,
전이·ERROR run을 더해도 task당 수개 행(구 모델 ≤1,008행 → ~수행). 그래도 보존 기간(Part II 기본 90일)은 관리자 조정, reconciler가 prune. **terminal run의
pipeline/task/attempt 데이터를 정리하지 않는 것은 결정 5의 확장 경로 전제이기도 하다.**

알림은 이벤트에서만 나간다: 상태 변경과 같은 트랜잭션에 쓰인 pipeline_event 행이 알림의 단일
원천(transactional outbox)이다 — **유실이 없고**(상태 변경과 같은 tx에 쓰이므로) 감사 로그와 같은 데이터다.
Notifier 루프가 `notified_at IS NULL` 이벤트를 `FOR UPDATE SKIP LOCKED`로 점유 소비하므로 N pod가 리더 없이
일을 나눈다. **전달 의미는 at-least-once다** — notified_at 갱신 전후 crash면 같은 event가 재발송될 수 있다.
v1 인앱 센터는 알림이 event row 자체(=조회)라 read 시 event id로 자연 dedup되어 effectively-once다. v1은
인앱 알림만이며, 라우팅 설정·외부 채널(Slack/Email)은 v2 defer(v2-deferred.md).

### 1.4 관리 콘솔 (v14 delta)

운영 원칙: 보드는 read-mostly다 — 일상 운영, 일시 장애, BFF 재시작, worker 장애는 관리자 개입
없이 자가 회복한다(결정 3.3, 4d). 버튼은 의무가 아니라 비상구다.

1. 보드 헤더: TF slot 게이지(실행 중 n / slotCap) + 대기 큐 카드(건수, 최장 대기).
2. 행/task 패널: 다음 확인 카운트다운; slot 큐 순번(미admit READY TF의 admission 순서로 파생). (강제 확인 버튼은 제거 — 모든
   확인은 polling 정책으로 수행한다, 개정 4판.)
3. Task 패널: attempt 히스토리, 호출별 check 로그(페이지네이션),
   읽기 전용 TerraformJob 내부 task 드릴다운.
4. TargetSource 상세 · 설치 관리 탭: 최근 설치/삭제 run 요약 + 전체 run 히스토리.
5. 알림 센터(벨)와 설정 페이지(Part II Config 표의 항목 편집).
6. 변경 이력 탭에 pipeline 이벤트 병합.
7. Run 히스토리 모드: 기간 선택(overlap), provider/type/status/target 필터, 페이지네이션.

> **상태 전이도(Pipeline · Task)** 는 [state-machine.md](./state-machine.md)로 분리했다 — §1.1 파생 우선순위·
> §1.2 상태 집합·결정 2·3.1·4·6의 전이 규칙을 상태·트리거·guard 표로 합성한 전이도다(새 규칙 아님, 각
> 결정 본문이 정본).

### 거부한 대안

| 옵션 | 결정 | 이유 |
|---|---|---|
| A. BFF 내부 durable reconciler (DB row + tick) | **채택** | 실제 워크로드에 부합; 재시작 안전; 관리자 조정형 폴링이 next_check_at에 자연 대응; 최소 운영 footprint |
| B. 별도 오케스트레이터 마이크로서비스 | 보류 | 모듈 분량 로직에 서비스 분량 오버헤드. 모듈 경계가 추출 비용을 낮게 유지 |
| C. 워크플로 엔진 (Temporal/Airflow/브로커) | 거부 | ≥10분 폴링의 2–4 step 선형 체인은 그 비용을 정당화 못 함 |
| D. BFF 인메모리 async 체인 | 거부 | 재시작/배포에 run 유실; durable 큐·히스토리·수일 WAIT_EXTERNAL 표현 불가 |
| E. Backend Manager에 파이프라인 상태 | 거부 (사용자 결정) | 로직·상태 분산; 원격 API 경유 원자적 slot 회계는 racy |
| F. Infra Manager 측 동시성 제한 (지금) | 보류 (사용자 결정) | 현재 자동화 caller는 BFF뿐; 결정 4b 재검토 트리거 참조 |

**별도 워커 분리도 같은 이유로 배제한다.** 무거운 워크로드(실제 Terraform 실행)는 이미
TerraformWorker로 분리돼 있고, BFF reconciler가 하는 것은 호출·폴링·상태 기록뿐이다. 조율
로직을 추가로 떼면 분산 dual-write와 racy한 slot 회계를 새로 들이고 단일 writer의 단순함을
잃는다. 부하가 강제할 때의 답은 워커 분리가 아니라 Option B(모듈 통째 추출)다.

### 감수 비용

BFF가 더 이상 stateless proxy가 아니다 — DB, 백그라운드 루프, 다중 replica 시 리더 선출이
생긴다. 본 ADR에서 가장 비싼 한 줄이지만, restart-safety·히스토리·조회성이 같은 뿌리에서
나오므로 감수한다.

---


> **작업 모델(결정 2)** 은 [task-model.md](./task-model.md)로 분리됐다 — 아래는 결정 3 이후.

## 결정 3 — 정합성: exactly-once 기계 없이 idempotency-by-construction

> 흡수: 구 D5, R1, R2, R6 · 근거: 구 D12

### 3.1 원칙: at-least-once dispatch + 다운스트림 멱등성

crash window — reconciler가 dispatch API를 호출한 뒤 attempt.response 영속화(dispatch 응답 기록) 전에 죽는 것 —
는 고전적 dual-write 갭이다. 다운스트림 작업이 멱등이라 동시/중복 제출이 무해하므로 BFF는
exactly-once 기계를 만들지 않는다:

writer를 명확히 가른다 — **상태 전이는 tick, 관측(task_check)·산출(response)은 호출 스레드**(결정 6
D-T4/D-T5). dispatch도 이 규율을 예외 없이 따른다:

1. **(tick tx)** task를 DISPATCHING으로 CAS 전이 + task_attempt 행 생성 + next_check_at 갱신.
2. **(호출 스레드 tx)** 호출 직전 task_check kind=DISPATCH 행을 PENDING으로 선기록.
3. **(호출 스레드)** dispatch API 호출.
4. **(호출 스레드 tx)** 두 쓰기를 **분리**한다:
   **(a) task_check 관측 기록** — 선기록한 PENDING 행에 호출 결과를 채운다(성공이면 응답 수신, 429/503·오류면 그 관측). **시도 사실은 항상 기록**(아래 CAS 결과와 무관). **429/503 backpressure면 여기서 호출 스레드가 `next_check_at`을 `Retry-After`만큼(없으면 다음 tick 주기 후로) 직접 미룬다**(상태 전이 아닌 스케줄 힌트라 호출 스레드 소관 — D-T7 균일 규칙; dispatch는 반복 폴이 아니라 cadence 하한이 없고 그 시각 도래 시 dispatch 복구 경로가 재dispatch한다; attempt는 미마감·fail 미소모, 복구 규칙 backpressure 예외와 정합).
   **(b) task_attempt.response 채택** — **`response IS NULL AND task_attempt.finished_at IS NULL AND task.status=DISPATCHING` guard(CAS)**일 때만 write. **write-once**(중복 dispatch 응답이 기존 `response`를 덮어쓰지 못함) + **늦은-response 차단**(그 사이 **task가 terminal로 마감됐으면** 0행 → `{jobId}` 무시). **주의:** Admin cancel은 pipeline만 즉시 CANCELLING으로 바꾸고 **task는 다음 tick에야 CANCELLED**가 된다 — 그 사이 task가 아직 DISPATCHING이면 response는 **채택될 수 있고**, 다음 tick의 DISPATCHING→CANCELLED가 그 attempt를 `result=FAIL`로 마감한다(state-machine 4c). **CAS 0행이어도 (a) 관측 행은 채워진 채 남는다**(시도+결과 이력).
5. **(다음 tick)** 적재된 관측을 보고 RUNNING으로 CAS 전이.

tick은 dispatch 발사 시점에 status(DISPATCHING)와 next_check_at만 쓰고, 상태 전이(→ RUNNING)는 다음
tick이 한다 — 상태를 호출 스레드에 넣으면 slot 회계와 crash 복구 추론이 흔들린다(결정 3.2/6 단일 writer).

복구 규칙: response 없이(dispatch 응답 미영속) dispatch timeout(Part II)보다 늙은 DISPATCHING
   행은 **그 attempt를 실패로 마감(fail_count++)한 뒤** 재dispatch한다. **crash로 결과를 받지 못한
   것도 "성공하지 못한 시도"이므로 IM이 명시적으로 실패를 반환한 경우와 동일하게 센다**(원인은
   error_code로 구분하되 카운트는 동일). 중복 제출은 각각 실행되나 모든 dispatch가 멱등이라 인프라는 안전하다.
   **예외 — backpressure:** 마지막 task_check 관측이 **429/503(backpressure)** 이면 이 복구 규칙의 fail++ 마감을 적용하지 않는다 —
   응답이 *없는* 게 아니라 *나중에 오라*는 명시 신호이므로, **동일 attempt 미마감 + backoff 재dispatch**(backoff next_check_at은 위 4단계 (a)에서 호출 스레드가 `Retry-After`만큼(없으면 다음 tick 주기 후로) 이미 세팅 — 그 시각 도래 시 이 복구 경로가 재dispatch하되 backpressure라 fail++만 건너뛴다; state-machine 102행).

**멱등성 불변식 (at-least-once dispatch의 성립 조건).** 모든 dispatch 작업은 멱등이어야 한다 — 중복
실행되어도 인프라 결과가 손상되지 않고, "이미 원하는 상태"를 성공으로 반환해야 한다(INSTALL: 이미
존재=성공, DELETE: 이미 부재=성공). worker dedup이 없으므로 at-least-once dispatch의 안전성은 전적으로
이 멱등성에 의존한다. **비멱등 작업(중복 실행 시 손상되거나, 이미-원하는-상태를 에러로 반환하는 작업)을
dispatch에 추가하려면 자체 idempotency 메커니즘을 동반하거나 리뷰에서 거부되어야 한다** — 결정 3.2의
"반복 불안전 변경은 거부" 룰의 직접 연장이다. (DELETE의 not-found 처리가 대표적 함정: destroy가
"리소스 없음"을 에러로 던지면 crash 재dispatch가 멀쩡히 끝난 삭제를 FAILED로 종결시키므로, "이미
부재=성공"이 멱등 정의에 포함되어야 한다.) 이 멱등성은 **BFF가 런타임에 검증하는 사실이 아니라
task에 요구하는 계약**이다 — dispatch는 외부 API 호출이고 BFF는 그 멱등성을 스스로 알 수 없으므로,
**job_id를 발급받아 폴링하는 모든 dispatch 작업이 멱등을 보장하도록 task 등록 계약으로 요구하고
리뷰에서 강제**한다(비멱등 작업은 거부 — 위 결정 3.2 룰의 연장). 따라서 "각 task가 실제로 멱등인가"는
BFF가 채우는 감사 항목이 아니라 task 등록 시 충족해야 하는 전제이며, 실제 충족 검증 책임은 task
구현·IM 쪽에 있다(O28 해소).

**fail_count = "성공하지 못한 시도 횟수"**(논리적 실패 횟수가 아니라). IM 거부·check 에러·crash로 인한
결과 미수신을 구분 없이 모두 센다 — 모두 "한 번의 시도가 성과 없이 끝났다"는 동일 사건이다(429/503
backpressure는 미가산 — 실패 아님). **max_fail_count = maxFailCount (K) = 비성공 시도 상한이며, fail_count가 maxFailCount에 도달하면 task FAILED.**
어떤 사건이 fail_count를 올리는지는 kind에 따라 다르다:
- **TERRAFORM_JOB:** maxFailCount = **초기 dispatch를 포함한 최대 attempt 횟수**(재dispatch 상한이 아니라 *최대 attempt 수*).
  매 비성공 attempt(IM 거부·crash 재dispatch·execution timeout)가 fail_count를 올려, maxFailCount번째 attempt가 성과 없으면
  FAILED. 따라서 **총 attempt ≤ maxFailCount, 그중 재dispatch ≤ maxFailCount − 1회**다(job poll 호출 오류는 fail 미소모라 attempt를 안 늘림 — §1.2).
- **CONDITION_CHECK:** dispatch·attempt가 없다(attempt 0개). maxFailCount = **비-backpressure CHECK ERROR 허용 횟수**로,
  누적 CHECK ERROR가 maxFailCount에 도달하면 FAILED(NOT_MET·backpressure는 미가산 — state-machine 88행). "총 attempt ≤ maxFailCount"는 CONDITION_CHECK엔 비적용.

retry/orphan headroom 산정값 slotCap × maxFailCount의 maxFailCount는 TERRAFORM_JOB 해석(최대 attempt 수)이다. BFF가 작업을 완료시키지
못한 것 자체가 실패이며 멱등으로 안전해도 사람이 봐야 한다. **별도의 dispatch 발사 카운터는 두지 않는다** —
시도-실패를 fail_count 하나로 세는 것이 의미상 단순하고 maxFailCount 강제와 알림을 동시에 만족한다.

> **maxFailCount는 crash-recovery headroom을 포함해 잡는다.** crash가 dispatch accepted~response 영속 *직전* 좁은 창에
> 떨어지면 BFF는 그 attempt를 비성공으로 세고(fail_count++) 재dispatch하며, 원 job은 orphan으로 execution
> timeout(>dispatch 복구창)까지 남는다 — 정상 동작 job인데 fail_count 1을 소비한다. 같은 task가 이 좁은 창에
> *maxFailCount번* 연속으로 crash해야 FAILED이므로 확률은 무시 수준이나(좁은 창의 maxFailCount제곱), maxFailCount를 IM 스펙 최소가 아니라
> 약간의 여유를 두고 잡으면 이 경로가 정상 run을 종결시키지 않는다. (재설계 불요 — fail_count 의미론은 그대로.)

terraform_job_id는 요청별 서버 측 발급이므로 재dispatch는 항상 새 job_id를 낳는다. BFF는
최신 attempt.response의 handle만 폴링하고, 이전 고아 제출은 방치된다 — 고아 job도 실제 실행되나 멱등 apply라 인프라에 무해하고,
고아 job이 결과를 영영 안 보고해도 아무도 폴링하지 않는다. execution timeout(결정 4)이 결과
유실 job 포함 모든 대기 경로를 bound한다.

**attempt는 action 단수이고, dispatch 산출은 `attempt.response(jsonb)`에 보존한다** — 단수
external_handle 컬럼을 두지 않고, v1 dispatch 응답 형태(TERRAFORM_JOB {job_id} ·
CONDITION_CHECK은 dispatch·handle 없음)를 컬럼 ALTER 없이 같은 컬럼에 담는 그릇이다(v2 GENERAL_JOB의 동기 {result}도 같은 컬럼 흡수). 모든 dispatch는 단수 handle을
반환하므로(fan-out 없음) **attempt : handle = 1:1**이다 — 그 handle은 terminal까지 N번 폴링되므로 attempt : task_check는 1:N. 재dispatch = 통째로 새 attempt = 새 response이므로 멱등성·복구 추론("action 1회")이
그대로 성립한다. `task_check.external_handle`은 *어느 id를 확인했는지의 참조*일 뿐 handle 저장소가
아니다(1차안 "handle을 task_check로 단일화"는 산출물과 관측을 섞은 오류라 철회). **CHECK 행 = 관측 run**(연속 동일 관측 collapse·poll_count; O24→RLE 개정 후속17), **DISPATCH 행 = 호출 1회당 1행**(저빈도·crash 구분). attempt↔check 명시 링크용 `attempt_id` 컬럼은 미도입(O26 해소: job_id 고유 발급이라
soft-link 무모호).

### 3.2 룰

- **단일 전이 함수.** 모든 상태 변경은 하나의 전이 함수를 거친다: (a) 전이 테이블 검증,
  (b) 새 상태와 pipeline_event를 한 트랜잭션에 기록, (c) WHERE 절에 기대 prior 상태를 실음
  (compare-and-set) — 낡거나 중복된 writer는 0행 갱신. status를 직접 쓰는 코드 경로는 없다.
- **reconciler가 유일한 외부 호출자이자 task 전진의 단일 writer.** API/UI 액션은 외부 호출을
  하지 않고 task를 전진시키지 않는다. TaskKind별 dispatch/poll의 모든 외부 호출과
  task 상태 전이·slot 회계는 reconciler tick에서만 발원한다(async로 발사하되 발원 주체는
  tick — 결정 6). 외부 호출과 slot 회계가 단일 writer(tick)로 유지되는 것이 slotCap과
  at-least-once dispatch 추론의 성립 조건이다. **단, 외부 효과도 slot도 task도 건드리지 않는
  pipeline-level 사용자 전이([중단]: `RUNNING → CANCELLING`)는 Admin API가 공통 전이 함수
  (CAS + pipeline_event)로 수행할 수 있다** — 그 전이가 함의하는 task cancel/drain은 다음 tick이
  수행하므로 단일 writer 불변식(외부 호출·slot·task 전진 = tick)과 충돌하지 않는다.
- **상태기계 정확성은 leader lock에 의존하지 않는다.** 모든 전이는 CAS이고 모든 side effect는 반복
  안전이므로, advisory lock은 효율 장치일 뿐이다. misfire해도 중복 호출과 no-op 쓰기를 낭비할
  뿐 task 상태는 일관된다. **전이나 side effect를 반복 불안전하게 만드는 모든 변경은 자체 idempotency
  메커니즘을 동반하거나 리뷰에서 거부되어야 한다.** (이 무관성은 *상태기계* 정확성에 한한다.
  slot capacity(slotCap)는 단일 행 CAS가 아니라 COUNT→admit read-then-act라 leader 단일성에
  의존하므로 불변식이 아니라 soft target으로 둔다 — 결정 4b.)

### 3.3 근거 — crash & N-pod walkthrough

두 불변식 — ① DB가 유일한 상태이고 모든 전이는 guarded write(CAS), ② 모든 외부 side effect는
반복 안전(run API 재호출은 멱등성으로 수렴, poll/조건 확인은 읽기) —
이 성립함을 최악의 순간으로 검증한다.

| Crash 지점 | 복구 동작 |
|---|---|
| tick 도중, task 사이 | 전이는 독립 commit; 완료분 유지, 나머지는 다음 tick 재도출. 부분 배치 없음 |
| dispatch 호출 후, attempt.response 영속화 전 | DISPATCHING 잔류 → dispatch 복구가 재dispatch(fail_count++); 멱등성이 중복 흡수 |
| poll/check 응답 후, 기록 전 | 관측 1회 유실; 다음 cadence 재독. 읽기는 idempotent (결정 6, D-T4) |
| 외부 호출 발사 후, 실행 주체가 결과 기록 전 죽음 | status 불변(실행 주체는 status 안 건드림) → 다음 tick이 재호출. **DISPATCH**는 PENDING 행으로 "시도 이력" 보존(D-T5); **CHECK**은 PENDING 선기록이 없어 행 없이 다음 cadence에 재독(read 멱등이라 무해 — RLE 후속17) (결정 6, D-T4/D-T5) |
| 상태 기록 후, 알림 발송 전 | outbox 행 notified_at IS NULL → Notifier 재시도 |
| advisory lock 보유 중 | session-scoped lock 자동 해제, 다음 tick에 다른 pod 획득 |
| 장시간 outage (수 시간) | 복귀 첫 tick들에 밀린 작업 일괄 발화 — **dispatch burst는 slotCap이, poll burst는 tick당 발사 상한 `max_external_calls_per_tick`(결정 6 D-T7)이 흡수**(상한 개수씩 wave로 배수; poll은 slot 무관이라 slotCap이 안 막음). timeout은 fresh 상태 재독 후 판정(결정 4)하므로 완료 작업은 SUCCEEDED로 기록되지 오판 timeout되지 않는다 |

| N-pod 우려 | 답 |
|---|---|
| tick은 누가 도는가 | 매 tick 모든 pod가 advisory lock 시도; 1 pod 승리. failover 자동, ≤30초 |
| split brain | lock 세션 유실로만 가능하고 무해: CAS + 반복 안전 side effect |
| Admin API on N pods | stateless — 어느 pod든 읽기 + pipeline-level 전이(공통 CAS); task 전진·외부 호출은 리더 tick |
| Notifier on N pods | 리더 불요: FOR UPDATE SKIP LOCKED로 분담 |
| rolling deploy | split brain과 동일 + in-flight run의 task rows·snapshot이 이미 구성을 박제(코드 동작은 현재 배포본; recipe/config는 snapshot이 시작 시점에 고정) |

### 3.4 감수 비용

DB outage / scale-to-zero 시 오케스트레이터는 멈춘다. 이미 도는 TerraformJob은 영향 없이
계속되고 복구 후 폴링이 따라잡는다 — 열화는 항상 지연이지 손상이 아니다. **BFF DB가
availability anchor가 되는 것은 감수한다** (admin 콘솔에 대해서는 이미 그렇다).

---

## 결정 4 — Liveness: 무한 대기 없음, 죽일 수 없거나 systemic한 실패는 corruption이 아니라 delay

> 흡수: 구 D11, D4, D10, D13

공통 명제: **이 시스템은 외부 작업을 강제 종료하거나 정확히 한 번 끝낼 능력이 없다. 그러므로
모든 실패를 시간으로 bound된 지연으로 환원하고, corruption은 구조적으로 불가능하게 만든다.**
(a)가 토대이고 (b)(c)(d)는 그 위의 적용이다.

### 4a. 통합 timeout budget

hang할 수 있는 모든 층에 명시적 deadline을 둔다(기본값은 Part II Config 표):

| 층 | 범위 | 만료 시 |
|---|---|---|
| tick 주기 | reconciler 깨어나는 간격 (빈도) | 다음 tick 처리 — **호출 deadline과 무관(결정 6, D-T1)** |
| 호출별 HTTP deadline | 외부 호출 1회 (run/poll/check); **전역 + TaskKind별 오버라이드**(task별 아님 — operations D-T3) | 그 호출을 CALL_TIMEOUT으로 끊음 |
| Dispatch 복구 | response 없는 DISPATCHING 경과 | 재dispatch |
| Execution timeout | TERRAFORM_JOB: dispatch → job terminal | attempt 실패 EXECUTION_TIMEOUT·slot 반납·RUNNING→READY 재큐(fail++); **maxFailCount 소진 시에만 task FAILED**(1회 만료=재시도) |
| TTL (CONDITION_CHECK) | task당 총 체류 시간 (WAITING_EXTERNAL) | task EXPIRED → pipeline FAILED |

**호출 deadline ≠ tick 주기(결정 6, D-T1).** tick 주기는 "호출이 그 안에 끝나야 한다"가
아니다. 호출의 성패는 그 호출 자신의 deadline으로만 판정된다. CALL_TIMEOUT은 **호출 1회의 실패**
이지 task 실패가 아니다: check면 fail_count++ 후 재시도(누적이 max 넘으면 FAILED), job poll이면
다음 주기 재시도(execution timeout만이 attempt 운명 결정), dispatch면 DISPATCHING 유지 후 복구.
**deadline < 정상 응답 시간이면 그 호출은 구조적으로 영원히 실패**하므로, 느린 check는
TaskKind별 per-call deadline 오버라이드로 deadline을 정상 응답 시간 이상으로 올린다(결정 6, D-T3).

reconciler는 모든 외부 호출을 호출별 deadline + 비블로킹 async 발사(결정 6)로 실행한다 — 느린
upstream 하나가 tick을 정지시키지 못하고, Infra Manager가 hang해도 리더 루프의 worst-case는
예측 가능하다.

정련: **만료는 fresh 상태 재독 후 판정한다**(timeout보다 긴 outage가 완료 작업을 실패시킬 수
없음). systemic timeout(worker outage 의심)은 **알림 롤업만** 수행하고 상태기계 동작은 바꾸지
않는다 — timeout 발화 task는 정상 경로대로 fail_count 정책을 따른다(4d).

**execution timeout의 역할(2026-06-12 재정의):** 결과 누락 빈도가 매우 낮음이 확인되었으므로
(제약 #4), 이 timeout은 일상적 흡수가 아니라 **드문 worker 버그의 안전망**이다. 발화 시 severity를
critical로 격상한다. 기본값은 유지하되 정상 실행이 그를 넘는 사례가 실재하므로, 운영 통계
(task_check 분포)로 분포 확인 후 조정한다 — 단일 상향 또는 TaskKind별 차등. R5에
따라 무중단 조정.

### 4b. 동시성: 고정 worker 풀이 hard cap, slotCap은 제출 throttle

**실제 동시 terraform 실행 수는 고정 크기 TerraformWorker 풀이 hard-cap한다(≤ workerPoolSize (M)).** worker가 pubsub를
소비하는 고정 풀이므로 BFF가 얼마를 제출하든 동시 실행은 풀 용량 workerPoolSize를 넘지 못하고 초과분은 큐에 쌓인다 —
crash 재dispatch·orphan이 생겨도 동시 실행은 ≤ workerPoolSize(큐 깊이만 증가). **동시성 안전은 풀이 보장하므로 BFF는
그것을 강제하지 않는다.**

**slotCap은 동시성 안전장치가 아니라 pubsub 큐를 얕게 유지하는 제출 throttle다.** BFF는 active
TERRAFORM_JOB task(DISPATCHING|RUNNING)를 COUNT해 slotCap 미만일 때만 READY TF task를 admit한다 — **slotCap ≈ workerPoolSize**로
잡아 큐가 깊어지지 않게 한다(큐가 깊으면 대기가 길어져 execution timeout이 오발하고 불필요한 재시도를 부른다).

- **TERRAFORM_JOB task가 slot을 소비한다(결정 2).** slot 큐 = 미admit READY TF task다(별도 WAITING_SLOT
  상태 없음 — S26). 매 tick 스케줄러가 slot 보유 task(DISPATCHING|RUNNING)를 COUNT해 slotCap 미만일 동안
  큐(READY TF)에서 admit(→ DISPATCHING)한다. **별도 카운터 없이 상태 COUNT로 센다** — 카운터 증가와
  상태 변경이 둘로 갈리는 dual-write를 피한다. admission은 전역 task 순서를 따른다 — 파이프라인 내
  FIFO, 파이프라인 간 공정. 우선순위 클래스 없음.
- **단일 풀.** slot 소비 kind는 TERRAFORM_JOB뿐; 다중/named 풀은 두 번째 한도 backend 실재 시 additive(YAGNI).
- **slotCap × maxFailCount = worst-case 제출량**(동시 실행 수가 *아니라* 큐로 흘러드는 총량). maxFailCount(=max_fail_count)는 task당 최대
  시도 횟수. 풀이 동시 실행을 workerPoolSize로 막으므로 slotCap × maxFailCount는 "동시 job 상한"이 아니라 "큐·IM이 흡수해야 할 제출 폭"의
  sizing 참고값이다.
- **soft여도 무해 → CAS 안 함.** slotCap은 제출 throttle이라 정확할 필요가 없다 — split-brain(≤30초)에 일시
  slotCap 초과 제출이 나도 **풀이 동시성을 workerPoolSize로 막아 무해**하고 다음 tick이 수렴한다. admission에 CAS/lease를 넣지
  않는다(dual-write만 늘 뿐, 결정 3.2와 정합).
- **(풀이 autoscale일 때만 해당)** 자연 hard cap이 사라져 slotCap이 유일 throttle이 되고, 전역 hard cap이
  필요하면 모든 caller를 보는 IM이 429/503으로 backpressure(BFF는 requeue, fail_count 미소모). **고정 풀
  전제에선 불요.**
- slotCap (≈ workerPoolSize)은 런타임 설정(Part II), 변경은 이벤트로 감사.

### 4c. 중단: 죽이지 않고 전진만 멈춤

Infra Manager에 cancel API가 없고 pubsub 회수가 비현실적이다(확정). 파이프라인 [중단]의 의미:

- 파이프라인은 CANCELLING으로 전이한다. 취소는 **forward edge만** gate한다(readying,
  dispatching, retrying) — **drain edge는 절대 gate하지 않는다**(반환된 job_id
  기록, 실행 중 job의 terminal까지 폴링). 아직 dispatch 안 된 task는 즉시 CANCELLED. **CONDITION_CHECK은
  dispatch도 in-flight side-effect job도 없는 read-only 폴링이라 drain할 대상이 없다 — WAITING_EXTERNAL로
  폴링 중이어도 [중단] 시 즉시 CANCELLED된다(drain은 죽일 수 없는 in-flight job을 가진 TERRAFORM_JOB에만
  적용).** **DISPATCHING 중 job_id 미영속 TERRAFORM_JOB도 폴링할 handle이 없어 drain 대상이 아니다 → 즉시
  CANCELLED**(slot 반납; 원 dispatch가 accepted됐어도 멱등이라 무해 — BFF 추적 중단이라 BFF execution timeout이
  아니라 worker terraform 자연 종료가 그 orphan의 bound).
  **drain은 job_id가 영속된 RUNNING task에만 적용된다.**
- in-flight TerraformJob은 자연 종료(또는 execution timeout)까지 돌고 **그때까지 slot을 보유**
  한다. terminal 도달 시 파이프라인이 CANCELLED로 확정된다.
- 보드는 "중단 중 · 실행 중 job 종료 대기"를 표시. 최종 상태는 attempt에 히스토리로 기록되지만
  파이프라인 상태엔 영향 없다.
- 결론: 취소는 실패하거나 leak할 수 없다(이중 전이·slot leak·고아 job 없음) — **늦을 수만 있으며**
  execution timeout이 bound한다.
- **pipeline 최종 상태 파생의 precedence(CANCELLING 최우선)는 결정 1.1이 정본이다.** 4c는 task/job
  레벨 drain·slot 보유를 규정하고, "CANCELLING 중 task가 FAILED로 끝나도 pipeline은 FAILED 아닌
  CANCELLED로 수렴"이라는 파이프라인 파생 우선순위는 1.1에서 확정한다.
- **입구 가드:** 이미 terminal인 pipeline(DONE/FAILED/CANCELLED)에 들어온 [중단](CANCELLING) 전이는
  **CAS 0행 no-op으로 차단**되고 API는 에러가 아니라 **현재 status를 200으로 반환**한다(api §2·state-machine 표와 동일) —
  결정 5 "terminal은 terminal"의 직접 귀결이라 별도 전이 규칙이 불필요하며, terminal 부활은 없다.

### 4d. Systemic 실패: timeout + retry로 처리, 알림은 롤업만

단일 job 실패는 task 레벨 사건이다. worker outage는 dispatch된 모든 job이 동시에 보고를 멈춘다.
**circuit breaker / canary / dispatch gate는 두지 않는다(개정 4판).** worker 장애는 일반 경로 그대로
— execution timeout(결정 4a) + retry(fail_count 정책, 결정 3.1) — 로 처리하고 **상태기계 동작은
바꾸지 않는다.** breaker open/half-open/close, canary dispatch, outage 동안 dispatch gate, timeout
requeue special path, WORKER_RECOVERED는 모두 제거한다.

남는 것은 **systemic timeout 감지 → 알림 롤업**뿐이다:

- **알림 롤업.** **EXECUTION_TIMEOUT이 짧은 창에 연속(예: 15분 내 서로 다른 target 3건)** 발생하면
  N건의 개별 critical 알림 대신 단일 critical `WORKER_OUTAGE_SUSPECTED`로 롤업한다. 이는 **알림
  표현만** 바꿀 뿐 — 상태 전이·fail_count·dispatch admission 어디에도 영향이 없다.
- **상태기계 무변경.** 파이프라인은 RUNNING 유지, task는 정상 timeout+retry 경로를 따른다. outage
  중에도 dispatch를 gate하지 않는다 — worker가 없으면 어차피 timeout이 흡수하고, dispatch가
  멱등이라(결정 3.1) 재시도가 안전하다. 회복도 자동: worker가 돌아오면 다음 폴링/재dispatch가
  따라잡는다.

**execution timeout이 드문 worker 버그의 안전망(제약 #4)이고, retry가 그 위의 회복 수단이며, 알림
롤업이 운영자에게 systemic 신호를 준다 — 이 셋으로 충분하다.** queued vs running 구분이 불가능
하므로(아래) 더 빠른 감지 경로가 없고, 그래서 별도 breaker 상태기계를 두는 복잡성이 정당화되지 않는다.

### 부속 결정: k8s pod 직접 조회 비채택

TerraformWorker가 k8s pod이므로 pod 조회로 "실행 중 worker 수"를 얻을 수 있으나, BFF 직접 조회는
채택하지 않는다. 근거: ① BFF가 worker 배포 방식에 묶여 계층 추상화가 깨짐. ② "queued vs running"
구분(O7)을 풀지 못함 — queued는 pod 부재일 수 있어 구분 불가. ③ pod↔job 매핑이 보장되지 않으면
집계 숫자만 남아 실효 없음. **이 구분은 Infra Manager API로도 노출 불가능하다(O7 해소)** — 그러므로
worker 장애 감지는 execution timeout에 종속되며, 그 latency(~30분+)는 구조적 상수로 감수한다.

---

## 결정 5 — 수동 개입: 재시도 = 새 run 생성, 재개·task 레벨 수동 재실행 비지원

> 구 D8/R2의 [재시도] 동작에 비어 있던 의미론을 확정한다.

**원칙 두 줄:**

1. **Terminal은 terminal이다.** EXPIRED/FAILED/CANCELLED/DONE에서 나가는 전이는 없다. task도
   pipeline도 부활하지 않는다.
2. **수동 개입의 단위는 run, 자동 회복의 단위는 attempt다.** task 안의 재시도는 fail_count
   한도까지 reconciler가 자동 수행(attempt_no 증가)하며, 운영자에게 task 레벨 재시작 수단을
   제공하지 않는다.

**[재시도]의 의미 = (생성 시점 현재) recipe로 새 pipeline 생성의 단축(결정 7.3 — 원 run 버전에 고정하지 않음).** 죽은 run을 되살리지 않고
동일 target에 새 run을 만든다. 새 run은 별개 pipeline 행이며 target별 히스토리에 별개 run으로
쌓인다.

**동일 target 중복 pipeline은 unique 제약으로 1건만 허용한다.** 같은 `target_source_id`에 non-terminal
pipeline이 둘이면 두 tick 경로가 같은 target에 terraform을 몰아 "target당 실행자 1" 전제(단일 writer·
slotCap·멱등 추론)가 깨진다. 이를 부분 unique 제약 `unique(target_source_id) WHERE status NOT IN
(DONE,FAILED,CANCELLED)`으로 막는다 — 중복 생성([재시도] 포함)은 새 행을 만들지 못하고 **기존
non-terminal pipeline을 반환**한다(생성 path가 충돌을 잡아 그 1건을 돌려준다, api.md §3).

**안전 근거 — 재개 없이도 전체 재실행이 안전하다:** terraform apply는 수렴형이어서 이미 완료된
리소스 재apply는 변경 없음으로 빠르게 통과하고, WAIT_EXTERNAL check는 읽기여서 이미 충족된
조건은 첫 확인에서 MET이다. 결정 3("모든 side effect는 반복 안전")의 직접 귀결 — 중간부터
재개라는 최적화 없이도 정확성 손실이 없으며 잃는 것은 시간뿐이다.

**배제한 대안 — terminal 부활:** EXPIRED→READY, FAILED→RUNNING 전이 합법화는 거부한다. 전이
테이블 한 곳 수정으로 가능하나 "terminal은 terminal"의 단순함이 깨지고 fail_count 리셋·알림
의미·히스토리 해석을 전부 재정의해야 한다. slotCap은 근거가 아님을 명시 — task 재실행을 만들어도
dispatch는 admission(READY TF → DISPATCHING)을 통과하므로 cap은 스스로를 지킨다. 배제 근거는 slot이 아니라
의미론 비용 대비 실익 부재다.

**v1 재시도 = 전체 재실행.** 완료분을 건너뛰는 부분 재실행은 v1에서 만들지 않는다 — 위 안전 근거대로
terraform 수렴·읽기 멱등으로 전체 재실행이 안전하기 때문이다. skip-completed(완료 task 시드) 확장은
v2 defer(v2-deferred.md). terminal run 데이터의 무기한 보존은 결정 1.3이 보장한다.

---

## 결정 6 — tick의 외부 호출 실행 모델

> 신규 (2026-06-13). "tick이 외부 API 호출을 어떻게 실행하고, 장시간 호출과 실행 주체의 죽음을
> 어떻게 처리하는가"를 확정한다. WAIT_EXTERNAL의 일부 check가 200초+ 걸리는 문제가 출발점이다.
> 본 결정은 **구현 무관 불변식**이다 — async 실행의 구현(Virtual Thread)·운영 제약은 **implementation-notes.md §A**.

### D-T1. tick 주기와 호출 deadline은 별개의 시계다

- **tick 주기** = reconciler가 깨어나는 빈도. **호출 deadline** = 호출 하나가 매달릴 수 있는
  지속 시간. 둘은 무관하다(값은 Part II).
- tick 주기는 "호출이 그 안에 끝나야 한다"를 의미하지 않는다. 호출 성패는 그 호출 자신의
  deadline으로만 판정된다.
- 따라서 어떤 호출의 deadline을 90초/240초로 바꿔도 tick 주기 규칙과 어긋나지 않는다.

### D-T2. tick은 외부 호출을 비블로킹 async로 발사한다

- tick이 호출을 순차로 기다리면 200초 호출 하나가 같은 tick의 다른 task 전부를 200초씩 민다.
  이를 막기 위해 tick은 외부 호출을 **비블로킹 async로 발사**하고 루프 자신은 블로킹되지 않는다.
  진행 중 호출은 백그라운드에서 자기 deadline만큼 진행되고, tick은 다음 주기에 다시 깨어난다.
- 구현은 Java 21 Virtual Thread이며, 자원·carrier pinning·HTTP backing client 제약은 **implementation-notes.md §A**.

### D-T3. per-call HTTP deadline은 TaskKind별로 오버라이드 가능하다

- **deadline < 정상 응답 시간 → 그 호출은 구조적으로 영원히 실패**(매번 잘려 fail_count만 쌓임).
- **전역 상향 금지** — 빠르게 실패해야 할 호출까지 느려지고 tick worst-case가 늘어난다.
- **per-call deadline은 TaskKind별로 오버라이드한다**(기본값 Part II; 일반화 `timeoutPolicy` 슬롯은
  두지 않는다 — 개정 4판). 느린 provider check는 정상 응답 시간 + 여유(예: 최대 50초면 90초, 최대
  200초면 240초).

### D-T4. 관측은 실행 주체가, 상태는 tick이 쓴다 (쓰기 책임 분리)

- **실행 주체가 쓰는 것 = 관측(task_check).** 호출하고 응답이 오면 결과를 task_check 행에
  기록한다. **실행 주체는 task.status를 절대 바꾸지 않는다.**
- **tick이 쓰는 것 = 상태(task.status).** 다음 tick이 적재된 관측을 보고 상태 전이를 CAS로
  수행한다.
- 지키는 것: ① **단일 writer 불변식** — 상태 전이는 tick에서만. 실행 주체가 status를 직접 바꾸면
  slot 회계·crash 복구 추론이 흔들린다. ② **crash 안전성의 단순함** — 실행 주체가 status를 안
  건드리므로 "전이 도중 죽음" 같은 중간 상태가 없다. status는 항상 일관되게 직전 값을 유지하고
  복구는 재호출로 끝난다(check는 읽기라 반복 안전). 이 분리 덕에 결과 기록은 **leader와 무관**
  하다 — 어느 pod에서 발사된 호출이든 관측만 적재하고, 상태 전이는 다음 리더 tick이 CAS로 한다.

```
tick: due 선별 → next_check_at 미래로 밀기 → async 발사 → (tick 종료)
                                                  │
   호출 스레드(DISPATCH): ① task_check PENDING 선기록(tx) → ② API Call(deadline) → ③ 같은 행 UPDATE
   (CHECK은 ①선기록 없이 ②호출 → ③관측 run UPDATE-or-INSERT — RLE)
               (api_result·observed·latency; status는 절대 안 건드림)
                                                  │
              (다음) tick: 그 관측을 보고 task.status를 CAS 전이
```

- **선기록·관측 쓰기는 호출 스레드 안에서 일어난다(tick lane 아님).** **일반 check/poll 발사에선** tick이
  발사 시점에 하는 것은 next_check_at을 미래로 미는 것뿐이다(**dispatch만 예외 — tick이 DISPATCHING 전이·task_attempt
  생성도 수행, 결정 3.1 1단계**). 이래야 D-T5의 "(A) tick이 발사 전 죽음 = task_check 행
  없음"이 성립한다(행 생성이 발사 *이후* = 스레드 안). 쓰기 책임 분리 유지: 관측=스레드, 상태=tick.
- **중복 발사 방지:** tick은 **호출 발사 시점에 next_check_at을 미래로 민다.** 실행 주체가 죽어도
  next_check_at은 밀려 있으므로 복구 재호출은 그 시각 도래 후에 일어난다(폴링 주기만큼 지연되나
  결국 복구). WAIT_EXTERNAL은 ≥10분 주기 + 수일 TTL이라 무해. (대안 "응답 후 밀기"는 빠른
  복구를 주지만 정상 케이스 중복 발사 위험이 있어 미채택.)

### D-T5. DISPATCH task_check는 호출 직전에 선기록한다 ("시도"와 "미시도"의 구분; CHECK은 RLE — 아래 단서)

실행 주체가 결과 기록 전에 죽는 경우, 두 상황을 구분할 수 있어야 한다:

- **(A) 호출 안 함** — tick이 발사 전 죽음. External API 미접촉.
- **(B) 호출했으나 결과 기록 전 죽음** — External API에 요청이 갔고 provider가 처리했을 수 있음.

이 둘은 incident 조사·감사에서 완전히 다르다("외부 호출 이력" 자체가 사실이며 보존되어야 함).
**2단계 쓰기**로 구분한다:

```
1. (호출 스레드, 호출 직전, tx) task_check 행 생성: kind, name, external_handle, started_at;
                   api_result = PENDING
2. External API Call (async)
3. (응답 후, tx) 같은 행 UPDATE: api_result = OK|ERROR, observed, latency_ms
```

→ **(A) = task_check 행 없음, (B) = api_result=PENDING 행 존재.** "외부 호출 시도 이력"이
(B)에서 보존된다.

**RLE-CHECK 단서(후속17).** 이 2단계 PENDING 선기록은 **DISPATCH에만** 적용된다(side-effect라 (A)/(B) 구분이
임계). **CHECK은 read 멱등**이라 (A)/(B)를 구분 못 해도 재-poll로 무해하고, 원래 이 구분을 쓰던 C-budget도 제거됐다
(개정 4판). 그래서 CHECK은 per-poll PENDING 선기록 없이 결과 후 **관측 run을 UPDATE(동일)-or-INSERT(변화)**한다 —
1폴마다 행을 만들지 않아 NOT_MET 반복이 poll_count로 접힌다(§1.2 task_check).

- 일관성 근거: dispatch가 이미 따르는 규율(결정 3.1) 중 **일반화되는 것은 "관측=호출 스레드, 상태=tick"
  책임 분리**(모든 외부 호출 — check 포함 — 에 적용)이다. **PENDING 선기록 자체는 일반화되지 않고 DISPATCH에만**
  적용된다(side-effect라 (A)/(B) 구분이 임계; CHECK은 read 멱등이라 불요 — 위 RLE-CHECK 단서).
- tick의 PENDING 행 처리: **정리하지 않고** "이 시각에 호출 시도, 결과 미상"이라는 영구 관측으로
  보존(조사 자산). 재호출은 새 task_check 행으로. started_at이 deadline을 훨씬 지난 PENDING은
  조사 대상 플래그 가능.
- 스키마: `task_check.api_result`에 **PENDING 추가**(`PENDING|OK|ERROR`). 기존 `OK|ERROR`로는
  (B)를 표현 불가.

### D-T6. 장시간 check를 위한 별도 task 상태는 두지 않는다

200초 check 진행 중 task를 별도 상태(CHECKING/ExecutingAPI)로 두는 안은 채택하지 않는다.

- **제어·안정성 목적으로는 불필요.** crash 안전성은 상태 입자가 아니라 CAS + 반복 안전성에서
  나온다. 별도 상태를 두어도 그 상태에서 죽으면 "다음 tick 재확인"으로 복구되어 현행
  (WAITING_EXTERNAL 유지)과 동일하다. 오히려 좀비 가능성과 별도 복구 타임아웃을 새로 만들어
  복잡성만 증가.
- **async 실행이 자원 문제를 제거했으므로 추적할 이유가 없다(implementation-notes.md §A).** 진행 중 호출이 자원을
  고갈시킨다면 "호출 중 개수"를 상태로 추적해 admission으로 제한해야 했겠으나, 고갈이 없으니
  추적할 상태도 불필요하다.
- **노출 목적이라면 상태가 아니라 task_check/nextCheckAt에서 파생.** "확인 중 vs 다음 확인 대기"는
  DISPATCH면 api_result=PENDING, **CHECK이면 RLE라 PENDING 행이 없으므로 nextCheckAt + 현재 CHECK run**(poll_count·
  마지막 checked_at)으로 파생한다(api §0). status 집합을 키우지 않는다.

→ WAIT_EXTERNAL 하나로 충분. **task 상태는 9종**(의존성 대기는 BLOCKED로 표현 — READY가 "의존
풀림·전진 가능"을 보장하려면 "아직 후보 아님(의존 미해소)"을 BLOCKED로 분리해야 하므로 유지, 1.2
참조; slot 큐 대기는 WAITING_SLOT 상태 없이 READY ∧ kind=TF로 파생 — S26). 나머지 상태는 각각 고유
전이/복구(특히 DISPATCHING의 re-dispatch)를 가져, 더 줄이면 동작 차이가 kind-조건문으로 이전될 뿐이다(순손실).

**부속 원칙 — kind는 표현 라벨이지 control flow 신호가 아니다.** `task_check.kind`는 UX·조사용
라벨이며, **상태 전이 입력 여부는 행의 kind가 아니라 reconciler가 실행한 단계가 결정한다.** 그래서
JOB_POLL과 CONDITION_CHECK를 `CHECK`로 통합한다 — reconciler는 완료 판정(DONE|PENDING|FAILED)만 보고
"핸들 폴링이냐 조건 평가냐"로 분기하지 않으며, 그 구분이 필요하면 `external_handle` 유무로 파생한다.
(FORCE_CHECK kind는 제거 — 강제 확인 개념 자체를 두지 않는다, 개정 4판.)

### D-T7. 외부 호출 발사 상한 — tick당 `max_external_calls_per_tick`

부하에는 세 축이 있는데 지금까지 둘만 막혀 있었다: (가) 느린 IM이 reconciler를 멈추지 못하게
(async 발사 + per-call deadline, D-T1/D-T2), (나) dispatch 폭주로부터 worker 큐 보호(slotCap,
결정 4b). 빠진 **(다)가 poll/check 호출량이 IM API 서버를 과부하**시키는 축이다. **poll은 slot과
무관**해서 slotCap으로 안 묶인다 — in-flight + WAIT_EXTERNAL task 수(수천 가능)에 비례한다.

**메커니즘은 단순화한다(개정 4판): tick당 발사 호출 수 상한 `max_external_calls_per_tick`.** 매
tick 리더는 due **poll/check 호출**을 `next_check_at ASC` 순으로 최대 `max_external_calls_per_tick`개만 발사하고
나머지는 다음 tick으로 미룬다(**dispatch는 이 상한에 안 묶이고 slotCap admission으로만 제한** — 표 4a/4b·operations). 그게 전부다.

- **의미: tick당 최대 발사 호출 수 (burst 완화).** 복귀 catch-up·동시 due 폭주를 tick 경계로 잘라
  IM에 한 번에 쏟아지는 호출 수를 제한한다. **정확한 global concurrency 보장은 하지 않는다** —
  in-flight 동시 호출 수를 세거나 admit하지 않는다.
- **제거한 것(개정 4판):** in-flight call 계산, `api_result=PENDING` 기반 동시성 budget,
  `task_check.call_deadline_at` 컬럼, `admit = C − in_flight` 공식. 이들은 정확한 동시성 상한을
  노렸으나, poll이 idempotent read라 일시 초과가 무해하므로 그만한 정밀도가 필요 없다 — burst만
  완화하면 된다. (**DISPATCH의** PENDING 선기록 자체는 "호출 시도 vs 미시도" 구분용으로 유지된다 — CHECK/POLL은 PENDING 행 없이 RLE 관측 run만 남긴다, D-T5.)
- **기본값 50 (`max_external_calls_per_tick = 50`).** 대부분의 호출은 sub-second로 끝나므로 이
  상한은 드문 느린 호출 집중과 catch-up burst만 잘라낸다. R5 런타임 설정(Part II); 50은 출발점일
  뿐 IM 용량 실측 기반 튜닝 영역이다.
- **정밀 강제가 필요하면 IM 측에서.** 더 엄밀한 보호가 필요하면 IM이 자기 부하로 **429/503
  (+Retry-After)** 를 던지고 BFF는 **requeue**(next_check_at 미루기)로 순응하되 **fail_count는 소모하지 않는다**(backpressure ≠ 실패).
  **이 backpressure 규칙은 어느 IM 호출이든 (dispatch·job poll·condition check) 동일하다**: 429/503은
  `task_check(api_result=ERROR, observed=null, error_code=null)` 관측으로만 남기고
  (**dispatch=DISPATCH 1행 · poll/check=CHECK 관측 run** — RLE key `(api_result=ERROR, observed=null, error_code=null)`로
  현재 열린 run과 같으면 `poll_count++`, 다르면 새 run INSERT; 429/503 간 구분은 v1에서 보존 안 함)
  **CHECK_ERROR·DISPATCH_NO_RESPONSE·fail_count 어느 것으로도 세지 않는다**(dispatch면 attempt 미마감 **동일 logical attempt
  재사용**; poll/check면 task 상태 유지·재시도). 재시도 시각은 **Retry-After 없으면 `now + 그 kind cadence`, 있으면
  `now + max(retry_after_delay, 그 kind cadence)`** 로 미루는데(Retry-After가 cadence보다 짧아도 cadence 밑으로 내려가지
  않게 max — IM 과부하 시 cadence가 하한; **단 dispatch는 반복 폴이 아니라 cadence 하한이 없어 `now + retry_after_delay`,
  Retry-After 없으면 다음 tick 주기 후 — §3.1 5단계 (a)**), **next_check_at은 상태 전이가 아니라 스케줄 힌트라 호출 스레드가 직접 세팅**
  (task.status는 여전히 tick 전용). 아래 kind별 **실패 회계는 비-backpressure 호출 오류에만** 적용된다.
- ⚠️ **per-call deadline(D-T3)은 (다)를 막지 못한다.** deadline은 느린 호출을 *끊을* 뿐 호출은 이미
  IM에 도달했다(부하 발생 후). IM을 보호하려면 *호출을 안 보내야* 하고(발사 상한/backoff), 이것이
  발사 상한이 deadline과 별개로 필요한 이유다.

---

## 결정 7 — Pipeline Definition: 코드 default + run snapshot

> 신규 (2026-06-20). "파이프라인 구성(어떤 task를 어떤 순서로)을 무엇이 정의하고, 실행된 구성을 어떻게
> 재현하는가"를 확정한다. recipe는 `(type,provider)`당 코드 default 1개이며, 실행 구성은 불변 snapshot으로
> 박제한다. (TargetSource별 데이터 custom override는 v2 defer — v2-deferred.md.)

핵심: **task도 recipe(구성)도 코드, 실행 기록은 불변 snapshot.** 둘은 서로 다른 layer이며 "코드가 정의한
것 ≠ 실행된 것"을 snapshot이 보장한다(default release를 올려도 in-flight·과거 run의 *구성*은 절연 — 단 task
class 코드 동작은 현재 배포본을 탄다, 7.3).

### 7.1 layer

- **Task catalog (코드).** 각 task는 코드 class다 — TaskKind 2종(결정 2) 위에서 dispatch/check 바인딩을
  가진 실행 단위. **데이터로 동작을 정의하지 않는다**(새 task = 새 class = 배포). stable key를 가진다.
- **Default recipe (코드).** `(type, provider)`당 코드에 선언 — release version·metadata(이름 등)를 코드에
  명시. **단일 출처**라 default 변경이 전 target에 자동 반영된다(per-target 복제 = drift가 없다).
- **Snapshot (불변 실행 기록).** = `pipeline_def_snapshot`(1 pipeline:1행, 생성 시 write-once). 컬럼
  `{pipeline_id, definition_key, definition_version, type, provider, spec(jsonb)}`; `spec`은 resolve된
  전체 recipe = `{ name, tasks:[{ seq, handler_key, name(표시), kind, ttl?, polling_interval?,
  execution_timeout?, max_fail_count }] }` (내부 jsonb이라 snake_case = task row 컬럼과 동일; API DTO의 camelCase와 별개 계층 — ADR-019. 호출별 HTTP deadline은 task별 아닌 전역+TaskKind 설정이라 spec에 없음 — operations D-T3). **task row = 실행 상태(가변), snapshot.spec = definition 원본
  (불변·재현 권위; 실행 때 재읽지 않음 — 코드=실행 권위·snapshot=이력 권위).** default release를 올려도
  in-flight·과거 run의 **recipe/config는 절연**된다(task class 코드 동작은 절연 대상 아님 — 7.3).

### 7.2 생성 시 resolution

`(type, provider)` 코드 default를 resolve하고, 확정 구성으로 **task row 생성 + snapshot 기록을 한
트랜잭션**으로 수행한다(원자성 — snapshot == 실제 생성된 구성). type 집합은 현재 INSTALL·DELETE이며
**type-keyed라 재연동(RECONNECT) 등 확장은 enum 추가로 흡수**한다(recipe 모델 무변경). **RECONNECT은 v2 — GENERAL_JOB과 함께 도입**(v2-deferred.md).

### 7.3 정합성·재현

- **절연 범위 (과장 금지).** snapshot·task row가 freeze하는 것은 **recipe/config**(task 목록·순서·ttl·
  polling·execution_timeout·max_fail_count; 호출별 HTTP deadline은 task별 아닌 전역+TaskKind 설정이라 비포함)다 —
  default release를 올려도 in-flight·과거 run의 *구성*은 불변이다. **그러나
  task class 코드(dispatch/check 핸들러의 실제 동작)는 freeze 대상이 아니다** — reconciler는 현재 배포 코드로
  실행하므로 같은 task key의 구현을 바꾸면 in-flight run도 새 코드를 탄다(코드=실행 권위). 따라서 task class는
  배포 간 동작 호환을 전제하며, 비호환 변경은 기존 task를 고치지 말고 **새 task class(=새 `handler_key`; kind는 기존 TaskKind 재사용, 새 흐름 shape일 때만 새 kind)로 도입**한다.
- **재현** = snapshot이 단일 권위("이 run의 *구성*이 무엇이었나" — 코드 동작은 release에 따름).
- **재시도**(결정 5) = 새 run **생성 시점의 현재 default recipe**를 resolve(원 run 버전에 고정하지 않음 —
  **O10 해소**). v1 재시도는 full re-run이며, 완료분 skip(content-hash 비교)은 v2 defer(v2-deferred.md).

### 7.4 근거 — 무게는 cardinality에 있고 default=코드가 그것을 제거한다

per-target recipe 복제는 구성을 target 수(≈2000)만큼 복제해 drift·catalog 결합·validation blast radius를
target 규모로 키운다. **default를 코드 단일 출처로** 두면 표준 경로는 per-target 데이터가 0이라 그 무게가
사라진다. 다중 버전 공존 lifecycle(ACTIVE/DEPRECATED/RETIRED)도 불요하다 — default는 release 1개, 이력은
snapshot이 보유한다.

---


## A. 구현 노트

결정 6의 "비블로킹 async 발사"(D-T2)와 "실행 주체는 관측만 쓴다"(D-T4)는 **구현 무관 불변식**이다.
그 불변식을 충족하는 구체 런타임(Java 21 Virtual Thread)의 운영 제약·carrier pinning·HTTP client·배포
체크리스트는 아키텍처 결정이 아니므로 [implementation-notes.md](./implementation-notes.md)로 분리했다.
