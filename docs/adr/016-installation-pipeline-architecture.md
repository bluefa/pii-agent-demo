# ADR — 설치/삭제 파이프라인 오케스트레이션 아키텍처 (개정 3판)

## Status

Proposed (2026-06-11) · 살아있는 문서 — 토의로 발전 중.

- 규범적 설계는 **Part I**, 설정 기본값은 **Part II**, 결정 변경 이력·해소된 질문은 **Part III**,
  구현 노트·영향 파일은 **Part IV**에 둔다. 미해결 질문은 별도 트래커 파일로 분리한다
  (`016-installation-pipeline-architecture-open-questions.md`).

---

# Part I — Architecture (규범)

## Context

시스템 계층:

```
Frontend (Admin console)
    → BFF                      ← 파이프라인 오케스트레이션이 여기 산다 (확정)
        → Backend Manager      ← 도메인: 연동, 승인, target source
        → Infra Manager        ← Terraform job API; 실행은 TerraformWorker (k8s pod)
```

파이프라인이 하는 일은 의도적으로 단순하다: API를 호출하고, (a) 응답에 job_id가 있으면
그 TerraformJob이 terminal에 도달할 때까지 폴링하거나, (b) job_id가 없으면 provider별
조건(예: 설치 상태 확인)이 충족될 때까지 평가한다.

확정된 사실과 제약:

1. 파이프라인 관리의 주체는 BFF다(사용자 결정). 파이프라인은 Admin 콘솔([설치 시작]/
   [삭제 시작])에서 생성되고 브라우저 세션 없이 전진한다.
2. Infra Manager의 run API는 비동기다: job_id를 반환하며, 하나의 TerraformJob은 내부에
   여러 task를 가진다. 일부 호출은 job_id를 반환하지 않으며 조건으로 판정한다.
3. job 생애주기는 pubsub 비동기다: Infra Manager가 요청 시점에 terraform_job_id를
   서버 측에서 발급하고 pubsub 메시지를 발행하면, 별도 TerraformWorker(k8s pod)가 소비해
   Terraform을 실행하고 결과를 보고한다. TerraformWorker에는 dedup 로직이 없어 중복 제출된 job은
   각각 실행된다. 그러나 모든 execution API는 멱등성을 보장하는 작업만 수행하므로(결정 3.1·3.2 참조),
   중복 실행되어도 인프라 결과는 손상되지 않는다.
4. 결과는 유실될 수 있다: 간혹 worker가 결과를 보고하지 않아 job이 영구 non-terminal로
   남는다. BFF는 "아직 실행 중"과 "결과 유실"을 의도적으로 구분하지 않으며 둘 다 execution
   timeout으로 흡수한다(사용자 결정).
   **[2026-06-12 주석]** 누락은 worker 구현 결함으로만 간혹 발생하며 빈도가 매우 낮음(구두 확인).
   따라서 execution timeout은 일상적 흡수 장치가 아니라 드문 버그에 대한 안전망이며, 발화 시
   버그 의심 신호로 취급한다(결정 4). 단 "거의 없음 ≠ 없음"이므로 timeout 구조는 유지한다.
5. 동시성 상한: 동시 실행 TerraformJob 수는 N 미만이어야 한다(Infra Manager 용량 보호).
6. 현재 모든 Infra Manager TF 호출은 사람이 수동으로 한다. 파이프라인이 최초이자 유일한
   자동화 caller가 된다.
7. 실행 시간과 전체 실행 히스토리는 일급 요구사항이다: target별 run 히스토리, task별 상세,
   모든 외부 호출의 결과 — "실행이 성공했는가"와 "상태 확인 폴링 호출 자체가 성공했는가" 모두 —
   를 target source별·기간별로 조회할 수 있어야 한다. 알림 또한 일급이다.
8. (descoped) AI 에이전트 운영은 본 ADR의 결정 범위에서 제외한다. 단, 모든 admin 액션이
   공개 BFF admin API라는 계층 규칙을 유지하므로, 향후 AI 운영자는 권한 범위를 가진 또 하나의
   API principal로 표면 변경 없이 추가될 수 있다.
9. **BFF는 외부 호출을 비블로킹 async로 실행한다(결정 6의 전제).** 구현은 Java 21 Virtual
   Thread이며, 그 운영 제약은 **부록 A**.

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
│  API 핸들러 ──intent 기록──┐            History / Query API          │
│  (생성·재시도·중단·강제확인) │            (target별·기간별,             │
│                            ▼             run→task→attempt→check)   │
│                  ┌──────────────────┐               ▲               │
│                  │     BFF DB       │───────────────┘               │
│                  │ pipeline · task  │      ┌────────────────────┐   │
│                  │ task_attempt     │◄─────│ Reconciler 30s tick│   │
│                  │ task_check       │─────►│ (advisory lock 리더)│   │
│                  │ pipeline_event   │      │ · slot 스케줄 (N)   │   │
│                  │   (= outbox)     │      │ · READY dispatch   │   │
│                  │ def_snapshot     │      │ · 외부호출 async 발사│   │
│                  └────────┬─────────┘      │ · 관측 보고 상태전이  │   │
│  Notifier ◄──미통지 이벤트──┘                └─────┬─────────┬─────┘   │
│      │                                          │         │         │
│      ▼                       async: run/poll/check 호출  │         │
│  인앱 알림 센터 (v1)                          │              │         │
│  Slack / Email (후속)              ┌─────────▼───┐  ┌───────▼────────┐
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
로그(task_check), 이벤트 outbox가 상태기계를 전진시키는 트랜잭션 안에서 함께 쓰인다.

> 다이어그램의 'async 발사'·'Java 21+'에서 — 아키텍처 불변식은 *비블로킹 async 발사*이며,
> 그 구현(Virtual Thread·pinning·HTTP client)은 **부록 A**.

---

## 결정 1 — 오케스트레이션: BFF 내부 durable state machine + reconciler tick, DB가 유일한 상태

> 흡수: 구 D1, D2, D6, D7, D8, R4, Options A–F

### 1.1 구조

BFF 안의 pipeline-orchestrator 모듈. 워크플로 엔진도, 메시지 브로커도, 별도 서비스도 없다.

- 모든 Pipeline/Task 상태는 BFF 소유 DB에 산다(사용자 결정). Backend Manager는 도메인 상태만,
  Infra Manager는 Terraform 상태만 가진다.
- 단일 논리 스케줄러(reconciler)가 고정 tick(주기는 Part II)으로 깨어나 due task를 선별한다 —
  depends_on이 풀려 READY로 승격됐으나 아직 dispatch 안 된 task(순차 chain에선 파이프라인별 최저
  seq), 상태 확인이 도래한 RUNNING/WAITING_EXTERNAL, 시간 초과 task —
  `next_check_at ASC, last_checked_at ASC NULLS FIRST, created_at ASC, seq ASC` 순서
  (가장 밀린 것 우선; 기아 방지)로 각 task의 다음 전이를 수행하고, 상태와 이벤트를 같은
  트랜잭션으로 기록한다.
- BFF가 다중 replica로 뜨면 DB advisory lock(`pg_try_advisory_lock`)을 잡은 한 pod만 tick을
  돌리고 나머지는 건너뛴다. 메모리 상태에 의존하지 않으므로 실행 중 재시작/재배포는 구조적으로
  안전하다(검증: 결정 3.3).
- UI 액션(재시도/중단/강제확인)은 Infra Manager를 직접 호출하지 않는다. row에 intent를
  기록하면 다음 tick이 실행한다. 외부 호출과 slot 회계가 단일 writer로 유지된다(결정 3.2).
- **Pipeline 상태는 Task 상태에서 파생된다.** reconciler는 개별 Task를 전진시키고(READY →
  dispatch, RUNNING → check, 시간 초과 → expire) Pipeline 상태 갱신은 부산물이다: 전 task
  DONE이면 DONE, 재시도 소진 task가 나오면 FAILED, [중단] 후 in-flight task가 모두 drain되면
  CANCELLED. reconciler는 "파이프라인을 돌리지" 않는다 — task를 전진시킨다.
- **이 파생 규칙은 병렬이 아니라 순서대로 평가된다 — CANCELLING이 최우선이다.** 위 세 파생
  (DONE/FAILED/CANCELLED)은 동시 비교가 아니라 다음 우선순위로 판정한다. **① pipeline.status가
  CANCELLING이면 그것이 최우선:** forward edge(readying·dispatching·retrying·breaker requeue)는
  결정 4c에 따라 gate되고, 아직 dispatch 안 된 task는 즉시 CANCELLED, in-flight task는 terminal
  (또는 execution timeout)까지 drain한다. **이 동안 어떤 task가 어떤 terminal(FAILED·EXPIRED 포함)에
  도달하든 pipeline을 FAILED로 승격하지 않는다.** 판정 기준은 *failure가 발생한 시각*이 아니라
  *파생을 수행하는 시점에 pipeline.status가 CANCELLING인지*다 — 상태 기준이지 시간 기준이 아니다
  (시간 기준이면 CANCELLING 직전 확정된 fail_count 소진분이 새고 CAS 전이와 어긋난다). 모든
  in-flight가 drain되면 pipeline = **CANCELLED**. task의 실제 terminal(FAILED는 FAILED)은 attempt·
  task 히스토리에 사실대로 보존되고 pipeline 상태엔 무영향이다 — CANCELLED는 *한 번도 dispatch되지
  않은* task에만 붙고 pipeline만 CANCELLED로 수렴한다. **② CANCELLING이 아니고** 재시도 소진
  (fail_count 한도) task가 있으면 FAILED, **③ CANCELLING이 아니고** TTL EXPIRED task가 있으면
  FAILED, **④ 전 task가 DONE이면** DONE. 근거: 결정 4c가 "취소는 실패·leak할 수 없고 늦을 수만
  있다"를 보장하므로 CANCELLING 이후 종착지는 CANCELLED로 단일 수렴해야 한다 — FAILED 승격을
  허용하면 같은 상태가 두 종착지를 갖게 되어 그 보장이 깨진다.

### 1.2 데이터 모델 (BFF DB)

```
pipeline        id, parameters(jsonb), type(INSTALL|DELETE), provider,
                definition_version,
                status(RUNNING|CANCELLING|DONE|FAILED|CANCELLED),
                triggered_by(actor), created_at, started_at, finished_at, fail_reason
                -- parameters = 실행 입력(현재 {target_source_id}). 생성 시 박제(불변);
                --   실행 단위/입력이 바뀌어도 컬럼 ALTER 없이 키만 추가. dispatch/check가 값을 꺼내 씀.
                -- target_source_id 비정규화 복제 컬럼은 제거(O21 해소) — 진실의 출처는 parameters뿐;
                --   조회는 parameters->>'target_source_id' 식(expression) 인덱스로 (아래 인덱스).

task            id, pipeline_id, seq, name, type(EXECUTE|WAIT_EXTERNAL),
                status(BLOCKED|READY|WAITING_SLOT|DISPATCHING|RUNNING|
                       WAITING_EXTERNAL|DONE|FAILED|EXPIRED|CANCELLED),
                depends_on, polling_interval(≥10m guard), ttl, execution_timeout,
                deadline_at, max_fail_count, fail_count,
                next_check_at, last_checked_at, started_at, finished_at
                -- 단수 external_handle 컬럼 없음: dispatch 산출(handle)의 home은
                --   attempt.response(jsonb); 폴링 대상 handle은 거기서 추출(결정 3.1).

task_attempt    id, task_id, attempt_no, started_at, finished_at,
                result(OK|FAIL), error_code, error_detail, response(jsonb)
                -- dispatch당 1행; dispatch → terminal 생애주기를 추적(action의 생애주기).
                -- response = dispatch 원응답(write-once·불변; 재시도=새 attempt=새 response).
                --   handle의 home — dispatch 종류별 응답 형태를 컬럼 ALTER 없이 같은 컬럼에 담는
                --   그릇(terraform {job_id} · 동기 {result} · 조건 task handle 없음); 모든 dispatch는
                --   단수 handle(fan-out 없음). 보존용이지 매 tick control 입력이 아니다 — handle
                --   추출(normalize)은 dispatch 시점 코드의 일(결정 2/3.1).

task_check      id, task_id, checked_at, started_at, call_deadline_at,
                kind(DISPATCH|CHECK|POST_CHECK|FORCE_CHECK), name,
                api_result(PENDING|OK|ERROR), observed(RUNNING|SUCCEEDED|FAILED|MET|NOT_MET),
                error_code, latency_ms, external_handle, detail(jsonb)
                -- 평가당 1행(관측의 장부 — 호출의 장부가 아님); Task 소속. id마다 자기 행 — 한 행이
                --   여러 id를 묶지 않음. 행 = check 호출 1회(1 call = 1 row, O24); 한 행은 단일
                --   handle을 참조한다. 외부 호출 없는 평가(동기 즉시결과·로컬 조건)도 행을 남긴다(안 남기면
                --   조사 타임라인에서 사라짐); C는 외부 호출 발사 행(PENDING)만 세 호출 없는 평가는 부하 0(O25).
                -- external_handle = 그 행이 확인한 id의 *참조*(handle 저장소 아님 — home은 attempt.response).
                -- 호출 스레드에서 호출 직전 PENDING으로 선기록, 응답 후 채움(결정 6, D-T5).
                -- call_deadline_at = 이 *호출*의 deadline 절대시각 — 호출 생성 시 timeoutPolicy(D-T3)
                --   해소값으로 박제(= started_at + resolved_timeout). C-budget이 task별 deadline override를
                --   정확히 반영하게 한다. task.deadline_at(task/TTL 단위)과 grain이 다르다(이건 호출 단위).
                -- kind는 표현(UX/조사) 라벨이지 control flow 분기 신호가 아니다(D-T6 인근 원칙).
                --   JOB_POLL+CONDITION_CHECK→CHECK 통합; 핸들폴링 vs 조건평가는 external_handle 유무로 파생.
                --   observed 어휘 통일은 미정(Open O19); FORCE_CHECK→actor 흡수도 미정(Open O18).
                -- detail은 발췌/참조만 (예: Terraform 로그 포인터).
                -- attempt_id 컬럼 미도입(O26 해소): job_id가 요청별 고유 발급(재dispatch=새 job_id)이라
                --   external_handle∈attempt.response soft-link가 무모호 — 명시 링크 컬럼 불요.

pipeline_event  id, pipeline_id, task_id?, type, severity, payload(jsonb),
                actor(human|system|ai), created_at, notified_at
                -- append-only; 감사 로그이자 알림 outbox

pipeline_def_snapshot   pipeline_id, definition_key, definition_version,
                        type, provider, spec(jsonb)
                        -- 생성 시 1회 기록(write-once); 전체 PipelineDefinition을 박제.
                        -- 물리 삭제 금지.
```

**task_attempt와 task_check는 task 아래 형제다(attempt → check 중첩이 아님).** 역할이 다르다:
`task_attempt` = **action(side effect)의 생애주기**(dispatch당 1행, dispatch→terminal, 재시도
회계 attempt_no) — 관측값 저장 테이블이 아니다. `task_check` = **모든 외부 호출의 관측**(호출당
1행). 근거:
① 조건 전용 task(dispatch 없음)는 **attempt가 0개인데 check는 존재**한다(dispatch 0..1) — 중첩
구조면 부모 없는 check를 표현할 수 없다. 훅 단순화 모델에서 이 케이스가 더 일급이 되어 형제 구조의
정당성이 오히려 강화된다. force-check도 attempt 경계와 무관하다. ② crash 복구 순간에는 check의
attempt 소속이 본질적으로 모호하며, 관측은 사실이고 사실은 해석보다 먼저 기록되어야 한다.
③ 사고 조사 surface가 task 단위 merged timeline이다. attempt와의 상관관계가 필요하면
task_check.external_handle(확인한 id)이 attempt.response의 handle과 일치하는지로 soft link가
복원된다(attempt_id 컬럼은 미도입 — O26 해소: job_id 요청별 고유 발급이라 handle이 attempt 간 비중복).
모호한 경우 link가 없는 것이 정확한 표현이다.

내부 task 상태가 UI 어휘보다 풍부한 것은 의도다. 매핑:

| 내부 | 보드 라벨 |
|---|---|
| BLOCKED / READY / WAITING_SLOT | 대기 (BLOCKED=의존 미해소, READY=전진 가능, WAITING_SLOT은 큐 순번 추가 표시) |
| DISPATCHING / RUNNING | 실행 중 |
| WAITING_EXTERNAL | 외부 대기 |
| DONE / FAILED / EXPIRED / CANCELLED | 완료 / 실패 / 타임아웃 / 중단 |

(장시간 check 진행 중을 위한 별도 상태는 두지 않는다 — 결정 6, D-T6. "확인 중" 노출이
필요하면 최신 task_check의 api_result=PENDING 여부로 파생한다.)

(의존성 대기는 **BLOCKED** 상태로 표현한다 — task는 BLOCKED로 시작하고, `depends_on`(순차 chain에선
predecessor)이 모두 DONE이면 reconciler가 READY로 승격시킨다. **READY는 "의존이 풀려 전진 가능한
후보"임을 보장**하고 BLOCKED는 "아직 후보가 아니라 reconciler가 쳐다볼 필요도 없는" 상태다 — 둘을
합치면 READY가 그 보장을 잃으므로 분리한다. 따라서 task 상태는 10종이다.)

### 1.3 기록·조회·알림 — 하나의 append-only 규율

히스토리는 4개 grain으로, 모두 append-only로 기록된다(덮어쓰기 없음):

| Grain | 테이블 | 1행의 의미 |
|---|---|---|
| Run | pipeline | target source당 설치/삭제 실행 1회 |
| Step | task | run 내 task (현재 상태 + 타이밍) |
| Attempt | task_attempt | 실행 시도 생애주기 (dispatch → terminal), dispatch당 1행 |
| Observation | task_check | Task에 대한 모든 외부 호출 — dispatch, check(핸들 폴링·조건 평가), post-check, force-check |

기록 시점:

| 생애주기 순간 | 기록 |
|---|---|
| Pipeline 생성(→ 즉시 RUNNING) / 종료 | pipeline 타임스탬프 + pipeline_event; 생성 시 pipeline_def_snapshot |
| Task 상태 전이 | task 갱신 + pipeline_event |
| Dispatch 호출 | **호출 직전(호출 스레드)** task_check kind=DISPATCH 선기록(PENDING) → 호출 → 결과 채움; task_attempt 행 개시 |
| 각 완료 확인(check) | **호출 직전(호출 스레드)** task_check kind=CHECK 선기록 → 호출 → observed 채움 (핸들 폴링이면 RUNNING/SUCCEEDED/FAILED, 조건 평가면 MET/NOT_MET; api_result=ERROR면 fail_count++) |
| 각 post-check | **호출 직전(호출 스레드)** task_check kind=POST_CHECK 선기록 → 호출(deadline 60초) → 채움 (상태·fail_count 무영향); 실행 경로는 다른 호출과 동일(async 발사·C budget 소비) |
| 강제 확인(수동) | task_check kind=FORCE_CHECK; actor=human; rate-limited |
| 알림 발송 | pipeline_event.notified_at |

모든 외부 호출은 **호출 직전에 task_check 행을 PENDING으로 선기록**하고 응답 후 채운다
(결정 6, D-T5). 이로써 "호출을 시도했으나 결과 미상"(행 존재 + PENDING)과 "호출 자체를 안 함"
(행 없음)이 구분되고, "실행이 성공했는가", "확인 폴링 호출 자체가 성공했는가", "모든 확인이
무엇을 관측했는가"가 로그 파일 고고학이 아니라 일급 조회 가능한 사실이 된다.

조회 표면 — 리스트 엔드포인트 하나 + 드릴다운, 보드와 히스토리 뷰가 공유:

- `GET /admin/pipelines?targetSourceId=&provider=&type=&status=&from=&to=&cursor=` —
  횡단 조회. 기간 필터는 overlap 의미론:
  `started_at <= to AND (finished_at IS NULL OR finished_at >= from)`.
- `GET /admin/pipelines/{id}` — run 상세 + task 상태.
- `GET /admin/pipelines/{id}/tasks/{taskId}/history` — task 하나의 attempt + check 병합
  타임라인, 페이지네이션. **사고 조사 surface**: 모든 외부 상호작용을 시간순 한 줄로, timeout 시
  어느 층이 발화했는지(CALL_TIMEOUT vs EXECUTION_TIMEOUT vs TTL EXPIRED)까지.

인덱스: `pipeline((parameters->>'target_source_id'), started_at DESC)` (식 인덱스, O21 해소), `pipeline(started_at)`,
`task_check(task_id, checked_at)`, `pipeline_event(pipeline_id, created_at)`.

`next_check_at`도 노출한다 — 운영자가 "다음 확인 14:32"를 본다. target별 비정규화 요약
(last_install_run_at, last_delete_run_at, 마지막 결과, 실행 중 pipeline id)이 리스트 뷰를
히스토리 스캔 없이 떠받친다.

보존: pipeline / task / task_attempt / pipeline_event는 무기한. task_check만 폴링 cadence에
비례해 증가 — bounded(7일 WAIT_EXTERNAL 10분 cadence ≈ ≤1,008행; 30분 job 30–60초 poll ≈
≤60행) — 보존 기간(Part II)은 관리자 조정, reconciler가 prune. **terminal run의
pipeline/task/attempt 데이터를 정리하지 않는 것은 결정 5의 확장 경로 전제이기도 하다.**

알림은 이벤트에서만 나간다: 상태 변경과 같은 트랜잭션에 쓰인 pipeline_event 행이 알림의 단일
원천(transactional outbox)이다 — 유실도 중복도 없고 감사 로그와 같은 데이터다. Notifier 루프가
`notified_at IS NULL` 이벤트를 `FOR UPDATE SKIP LOCKED`로 점유 소비하므로 N pod가 리더 없이
일을 나눈다. push 채널은 at-least-once, 인앱 센터는 구조상 exactly-once. v1은 인앱 센터만;
Slack/email은 후속 채널 어댑터(설정만 추가, 오케스트레이터 무변경).

기본 라우팅(Part II에서 관리자 편집):

| 이벤트 | Severity | v1 채널 |
|---|---|---|
| TASK_FAILED (max_fail_count 초과) | critical | 인앱 |
| TASK_EXPIRED (TTL) → PIPELINE_FAILED | critical | 인앱 |
| PIPELINE_DONE | info | 인앱 |
| QUEUE_WAIT_EXCEEDED (slot 대기 > 임계) | warning | 인앱 |
| WORKER_OUTAGE_SUSPECTED / WORKER_RECOVERED — 롤업 1건 | critical / info | 인앱 |
| EXECUTION_TIMEOUT 발화 | critical (제약 #4: 드문 버그 의심 신호) | 인앱 |
| SETTINGS_CHANGED | info | 인앱 |

### 1.4 관리 콘솔 (v14 delta)

운영 원칙: 보드는 read-mostly다 — 일상 운영, 일시 장애, BFF 재시작, worker 장애는 관리자 개입
없이 자가 회복한다(결정 3.3, 4d). 버튼은 의무가 아니라 비상구다.

1. 보드 헤더: TF slot 게이지(실행 중 n / N) + 대기 큐 카드(건수, 최장 대기).
2. 행/task 패널: 다음 확인 카운트다운; WAITING_SLOT 큐 순번; [지금 확인] 강제 확인 버튼.
3. Task 패널: attempt 히스토리, 호출별 check 로그(페이지네이션), post-check 결과,
   읽기 전용 TerraformJob 내부 task 드릴다운.
4. TargetSource 상세 · 설치 관리 탭: 최근 설치/삭제 run 요약 + 전체 run 히스토리.
5. 알림 센터(벨)와 설정 페이지(Part II Config 표의 항목 편집).
6. 변경 이력 탭에 pipeline 이벤트 병합.
7. Run 히스토리 모드: 기간 선택(overlap), provider/type/status/target 필터, 페이지네이션.

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

## 결정 2 — 작업 모델: 불변·버전 고정 Definition, 순차 task chain

> 흡수: 구 D3, D2의 snapshot/lifecycle, R3

PipelineDefinition은 파이프라인 type·provider별 **순차 task 시퀀스**를 기술하는 코드 정의
객체다. 병렬 분기 없는 versioned task sequence다.

PipelineDefinition: `key`(예: AWS_INSTALL), `version`(불변; v3과 v4는 별개 객체),
`type`(INSTALL|DELETE), `provider`, `taskDefinitions[]`.

```
AWS_INSTALL v3
 ├ TerraformApplyNetwork
 ├ TerraformApplyIntegration
 ├ InstallationReadyCheck
 └ FinalValidation
```

TaskDefinition의 본질은 **훅 슬롯의 조합**이다 — task 종류는 *타입 enum*이 아니라 **어떤 훅이
있느냐**로 결정된다:

- **dispatch (0..1)** — `dispatch(parameters)`: 실행(side effect) API 호출. **원응답을 통째로
  `attempt.response(jsonb)`에 보존**(dispatch 종류별 응답 형태를 컬럼 ALTER 없이 흡수 — 단수
  handle, 단수 컬럼 없음). 복수 dispatch가 필요하면 별도 task로 분리.
- **check (0..1)** — `check(TaskExecutionContext)`: 완료 확인 호출(결과는 **상태 전이 입력**).
  task당 최대 하나의 check 경로. 입력은 단일 객체 `{input, attempt?}` — external_id를 직접 받지 않고
  attempt를 통째로 받는다(조건 task는 `attempt=null`이고 `input`만으로 평가; 결정 1.4).
- **postChecks (0..N)** — `postCheck(TaskExecutionContext)`: 완료 후 best-effort 결과 조회.
  **task가 성공(DONE) 도달 시에만 실행** — 취소·실패·drain 경로에선 실행하지 않는다(O9 해소).
  **관측 전용** — 후속 task를 gate하지 않고, 상태를 바꾸지 않고, fail_count에 영향 없다. 결과는
  히스토리로만. (check와 입력·실행 경로 동일, 차이는 결과의 쓰임뿐 — 결정 1.5.)
- **requiresSlot**: **공유 IM 동시성 자원(제약 #5)을 소비하는가** (= "terraform이냐"가 아님 —
  결정 4b).
- **pollingPolicy**: check 실행 시점.
- **timeoutPolicy**: per-call HTTP deadline, execution timeout, TTL. **per-call deadline은
  task별 오버라이드 가능**(결정 6, D-T3; 기본값 Part II): 느린 provider check는 정상 응답
  시간 + 여유(예: 90초/240초).
- **completionRule**: 외부 응답(단일 handle의 check 결과)을 task 완료로 매핑하는 규칙
  (DONE|PENDING|FAILED). 결정 1.6.

훅 조합이 곧 task 종류다(타입 enum 불요):

| 종류 | dispatch | check | requiresSlot |
|---|---|---|---|
| terraform apply | apply 호출 → handle | handle 폴링 | true |
| 비동기 일반 API | API 호출 → handle | 상태 폴링 | 대상이 IM이면 true |
| 동기 일반 API | 결과 즉시 | 없음 | false |
| 조건 대기 | 없음 | 외부 상태 평가 | false |

- **`TERRAFORM` vs `GENERAL_API`는 타입(서브enum)이 아니다.** 차이는 dispatch()/check() 훅
  *안의 코드*뿐이며, IM 호출 코드는 공유 헬퍼로 재사용한다(평범한 코드 재사용이지 전략
  프레임워크가 아님). **terraform은 한 구현 사례일 뿐 — 어휘가 타입을 만들지 않는다.**
- **reconciler는 타입으로 분기하지 않는다 — 훅 유무만 본다**(dispatch 있고 미발사면 dispatch,
  check 있으면 poll …). 새 종류 = **코드 클래스 1개 추가**, 스키마·전이 무변경. (스키마의
  `task.type(EXECUTE|WAIT_EXTERNAL)`도 훅에서 파생되는 표현 라벨이며 control flow에 쓰지 않는다 —
  실제 task 식별자는 `definition_key`.)
- **connector / callStrategy / resourcePool 추상화 레이어는 도입하지 않는다(YAGNI)** — 두 번째
  capacity-limited backend가 실재할 때 additive로 확장한다.

조건 전용 task에서 **"아직"은 실패가 아니다** — check API 에러만 fail_count를 올린다.

**입력 계약 — `check(TaskExecutionContext)` · `postCheck(TaskExecutionContext)`, 단일 객체.**
`TaskExecutionContext = { input, attempt? }`: `input`=생성 시 박제된 `pipeline.parameters`(불변),
`attempt?`=현재 attempt(`response(jsonb)` 포함, **nullable**). 개별 인자가 아니라 객체로 감싸 미래
필드가 늘어도 시그니처가 불변(확장은 코드로)이고, attempt를 통째로 줘 산출물(response) 접근과 향후
attempt 필드(attempt_no 등)를 시그니처 변경 없이 연다. **external_id를 직접 받지 않는다** — handle(들)은
`attempt.response` 안이고 check가 거기서 꺼낸다. 입력 *형태*가 늘 `{input, attempt?}`로 동일하므로
external_id 유무·동기/비동기가 특수 케이스를 만들지 않는다: **dispatch가 있는 task는 현재 attempt를
`context.attempt`로 받고, dispatch가 없는 조건 대기 task는 `context.attempt = null`이며 check는 `input`
만으로 조건을 평가한다.** 동기는 response의 결과 필드를, 비동기는 response의 단일 handle을 평가 — 분기
없이 response 형태로 흡수한다. 객체엔 *데이터*만 담는다(동작·자기 정의·중복 세대값·append-only context는
제외 — 아래).

**attempt 1 : check 1.** 모든 dispatch는 단수 handle을 반환한다(terraform = 요청당 1 job_id).
attempt는 단수(action 1회)이고 그 handle의 확인도 단수이므로 attempt와 check는 1:1이다. **task
success = reconciler가 그 단일 handle의 check 결과를 completionRule(DONE|PENDING|FAILED)로 평가**:
DONE이면 task DONE, FAILED면 fail_count 정책, PENDING이면 계속 폴링. 한 dispatch가 분리 불가한 N개
id를 원자적으로 내는 fan-out 케이스는 실재하지 않으며, 독립적인 여러 작업이 필요하면 task를 나눠
표현한다(결정 5 기조).

불변성과 박제: 모든 행동·정책 변경은 새 버전을 만든다. Pipeline은 생성 시 버전에 고정되고 전체
정의가 pipeline_def_snapshot으로 직렬화된다. **코드 정의가 실행 권위, 스냅샷이 히스토리 권위.**
정의는 참조되는 동안 물리 삭제되지 않고 lifecycle을 따른다: ACTIVE → DEPRECATED → RETIRED.
히스토리 조회는 전 단계에서 유지.

**실행 입력은 데이터다 — `pipeline.parameters(jsonb)`.** 실행에 필요한 입력(현재 유일값
`target_source_id`)을 고정 컬럼이 아니라 parameters의 키로 둔다: `parameters = {"target_source_id":
"..."}`. 실행 단위·입력이 늘어도(provider·environment 등) pipeline 테이블 ALTER 없이 키만
추가된다 — 실행 단위가 *컬럼*이 아니라 *데이터*가 된다. **생성 시 박제**(정의 버전 박제와 같은
정신) — run 중 입력이 바뀌지 않아야 재시도/재실행이 결정적이다. dispatch/check는 호출 시
parameters에서 필요한 값을 꺼내 쓴다(무엇을 읽을지는 task 코드가 결정).

> **실행 단위 = `target_source_id`(1 pipeline : 1 target)** 이며, target 묶기(1:N)는 의도가 아니다
> (N개 target이면 N개 pipeline — 재시도가 run 단위, 히스토리가 target별이라는 결정 5 기조와 정합).
> 단위 확장 시 필요한 입력은 `parameters`(jsonb)에 키를 추가해 흡수하므로(실행 단위 = 컬럼이 아니라
> 데이터) 별도 모델 변경이 필요 없다 — 어떤 확장도 task엔 `target_source_id`를 넣지 않아 추상 입력
> 계약(`TaskExecutionContext`)이 유지된다. **(O22 해소 — 결정 2에 흡수.)**

**task 간 값 전달 — 현재 입력 계약에서 제외.** 두 경우다. (A) **handle 참조**는 이미 모델에 내재한다
— dispatch가 낸 handle은 `attempt.response`에 보존되고, check가 그걸 폴링하며
`task_check.external_handle`(확인한 id)이 response의 id와 매칭되어 연결된다(신규 없음). (B) **handle 외
산출(생성 리소스 ID·응답값)의 task→task append-only 전파는 입력에 넣지 않는다** — 현재 task chain은 그런
BFF 레벨 값 전달을 하지 않는다(terraform이 자체 state로 리소스 간 의존을 해결). 무엇이 쌓이는지 구체
사례가 없으므로 `TaskExecutionContext`에서 빼고, **값 전달 task가 실재하면 그때 필드를 추가**한다
(additive — 객체로 감쌌으므로 시그니처 무변경). attempt 산출 접근은 `attempt.response`로 충분하다.

폴링 cadence는 두 개, guard는 하나: ≥10분 관리자 조정형 guard는 **WAIT_EXTERNAL 조건 확인에만**
적용된다. TerraformJob 상태 폴링은 시스템 설정(Part II)이며 task별 노출하지 않는다.

---

## 결정 3 — 정합성: exactly-once 기계 없이 idempotency-by-construction

> 흡수: 구 D5, R1, R2, R6 · 근거: 구 D12

### 3.1 원칙: at-least-once dispatch + 다운스트림 멱등성

crash window — reconciler가 dispatch API를 호출한 뒤 attempt.response 영속화(dispatch 응답 기록) 전에 죽는 것 —
는 고전적 dual-write 갭이다. 다운스트림 작업이 멱등이라 동시/중복 제출이 무해하므로 BFF는
exactly-once 기계를 만들지 않는다:

1. DISPATCHING 마킹 + task_attempt 행 + task_check kind=DISPATCH 선기록 (tx 1)
2. dispatch API 호출
3. attempt.response 영속화(dispatch 응답), RUNNING 전이 (tx 2)
4. 복구 규칙: response 없이(dispatch 응답 미영속) dispatch timeout(Part II)보다 늙은 DISPATCHING
   행은 **그 attempt를 실패로 마감(fail_count++)한 뒤** 재dispatch한다. **crash로 결과를 받지 못한
   것도 "성공하지 못한 시도"이므로 IM이 명시적으로 실패를 반환한 경우와 동일하게 센다**(원인은
   error_code로 구분하되 카운트는 동일). 중복 제출은 각각 실행되나 모든 dispatch가 멱등이라 인프라는 안전하다.

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
결과 미수신을 구분 없이 모두 센다 — 모두 "한 번의 시도가 성과 없이 끝났다"는 동일 사건이다. 따라서
**max_fail_count가 재dispatch 상한(K)을 겸한다**: crash 재dispatch도 fail_count를 올리므로 K번에서
자동으로 멈추고, K번 시도가 모두 성과 없으면 — 원인이 crash든 IM 거부든 — task는 정당하게 FAILED로
종결된다(BFF가 그 작업을 완료시키지 못한다는 사실 자체가 실패이며, 인프라가 멱등으로 안전하더라도
사람이 봐야 하는 상황이다). **별도의 dispatch 발사 카운터는 두지 않는다** — 시도-실패를 fail_count
하나로 세는 것이 의미상 단순하고 K 강제와 알림을 동시에 만족한다.

terraform_job_id는 요청별 서버 측 발급이므로 재dispatch는 항상 새 job_id를 낳는다. BFF는
최신 attempt.response의 handle만 폴링하고, 이전 고아 제출은 방치된다 — 고아 job도 실제 실행되나 멱등 apply라 인프라에 무해하고,
고아 job이 결과를 영영 안 보고해도 아무도 폴링하지 않는다. execution timeout(결정 4)이 결과
유실 job 포함 모든 대기 경로를 bound한다.

**attempt는 action 단수이고, dispatch 산출은 `attempt.response(jsonb)`에 보존한다** — 단수
external_handle 컬럼을 두지 않고, dispatch 종류별 응답 형태(terraform {job_id} · 동기 {result} ·
조건 task는 handle 없음)를 컬럼 ALTER 없이 같은 컬럼에 담는 그릇이다. 모든 dispatch는 단수 handle을
반환하므로(fan-out 없음) attempt와 check는 1:1이다. 재dispatch = 통째로 새 attempt = 새 response이므로 멱등성·복구 추론("action 1회")이
그대로 성립한다. `task_check.external_handle`은 *어느 id를 확인했는지의 참조*일 뿐 handle 저장소가
아니다(1차안 "handle을 task_check로 단일화"는 산출물과 관측을 섞은 오류라 철회). check 행은 **호출 1회당 1행**(1 call = 1 row, O24). attempt↔check 명시 링크용 `attempt_id` 컬럼은 미도입(O26 해소: job_id 고유 발급이라
soft-link 무모호).

### 3.2 룰

- **단일 전이 함수.** 모든 상태 변경은 하나의 전이 함수를 거친다: (a) 전이 테이블 검증,
  (b) 새 상태와 pipeline_event를 한 트랜잭션에 기록, (c) WHERE 절에 기대 prior 상태를 실음
  (compare-and-set) — 낡거나 중복된 writer는 0행 갱신. status를 직접 쓰는 코드 경로는 없다.
- **reconciler가 유일한 외부 호출자.** UI/API 액션은 intent만 기록하고 tick이 실행한다.
  TaskDefinition.dispatch/.check/.postChecks의 모든 외부 호출은 reconciler tick에서만
  발원한다(async로 발사하되 발원 주체는 tick — 결정 6). 외부 호출과 slot 회계가 단일 writer로
  유지되는 것이 N-cap과 at-least-once dispatch 추론의 성립 조건이다.
- **상태기계 정확성은 leader lock에 의존하지 않는다.** 모든 전이는 CAS이고 모든 side effect는 반복
  안전이므로, advisory lock은 효율 장치일 뿐이다. misfire해도 중복 호출과 no-op 쓰기를 낭비할
  뿐 task 상태는 일관된다. **전이나 side effect를 반복 불안전하게 만드는 모든 변경은 자체 idempotency
  메커니즘을 동반하거나 리뷰에서 거부되어야 한다.** (이 무관성은 *상태기계* 정확성에 한한다.
  slot capacity(N-cap)는 단일 행 CAS가 아니라 COUNT→admit read-then-act라 leader 단일성에
  의존하므로 불변식이 아니라 soft target으로 둔다 — 결정 4b.)

### 3.3 근거 — crash & N-pod walkthrough

두 불변식 — ① DB가 유일한 상태이고 모든 전이는 guarded write(CAS), ② 모든 외부 side effect는
반복 안전(run API 재호출은 멱등성으로 수렴, poll/조건 확인은 읽기, post-check는 read-only) —
이 성립함을 최악의 순간으로 검증한다.

| Crash 지점 | 복구 동작 |
|---|---|
| tick 도중, task 사이 | 전이는 독립 commit; 완료분 유지, 나머지는 다음 tick 재도출. 부분 배치 없음 |
| dispatch 호출 후, attempt.response 영속화 전 | DISPATCHING 잔류 → dispatch 복구가 재dispatch(fail_count++); 멱등성이 중복 흡수 |
| poll/check 응답 후, 기록 전 | 관측 1회 유실; 다음 cadence 재독. 읽기는 idempotent (결정 6, D-T4) |
| 외부 호출 발사 후, 실행 주체가 결과 기록 전 죽음 | status 불변(실행 주체는 status 안 건드림) → 다음 tick이 재호출. task_check는 PENDING 행으로 "시도 이력" 보존 (결정 6, D-T4/D-T5) |
| 상태 기록 후, 알림 발송 전 | outbox 행 notified_at IS NULL → Notifier 재시도 |
| advisory lock 보유 중 | session-scoped lock 자동 해제, 다음 tick에 다른 pod 획득 |
| post-check 도중 | 복구 시 재실행 가능(read-only); 최악은 task_check 중복 1행 |
| 장시간 outage (수 시간) | 복귀 첫 tick들에 밀린 작업 일괄 발화 — **dispatch burst는 N-cap이, poll burst는 outbound budget C(결정 6 D-T7)가 흡수**(C개씩 wave로 배수; poll은 slot 무관이라 N-cap이 안 막음). timeout은 fresh 상태 재독 후 판정(결정 4)하므로 완료 작업은 SUCCEEDED로 기록되지 오판 timeout되지 않는다 |

| N-pod 우려 | 답 |
|---|---|
| tick은 누가 도는가 | 매 tick 모든 pod가 advisory lock 시도; 1 pod 승리. failover 자동, ≤30초 |
| split brain | lock 세션 유실로만 가능하고 무해: CAS + 반복 안전 side effect |
| Admin API on N pods | stateless — 어느 pod든 읽기·intent 쓰기; 리더 tick이 실행 |
| Notifier on N pods | 리더 불요: FOR UPDATE SKIP LOCKED로 분담 |
| rolling deploy | split brain과 동일 + definition_version이 in-flight run을 시작 버전에 고정 |

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
| 호출별 HTTP deadline | 외부 호출 1회 (run/poll/check); **task별 오버라이드 가능** | 그 호출을 CALL_TIMEOUT으로 끊음 |
| Dispatch 복구 | response 없는 DISPATCHING 경과 | 재dispatch |
| Execution timeout | EXECUTE task: dispatch → job terminal | attempt 실패 EXECUTION_TIMEOUT; slot 해제 |
| WAIT_EXTERNAL TTL | task당 총 체류 시간 | task EXPIRED → pipeline FAILED |
| Post-check 호출 | 각 post-check (1회) | 사유만 기록; 상태 무영향 |

**호출 deadline ≠ tick 주기(결정 6, D-T1).** tick 주기는 "호출이 그 안에 끝나야 한다"가
아니다. 호출의 성패는 그 호출 자신의 deadline으로만 판정된다. CALL_TIMEOUT은 **호출 1회의 실패**
이지 task 실패가 아니다: check면 fail_count++ 후 재시도(누적이 max 넘으면 FAILED), job poll이면
다음 주기 재시도(execution timeout만이 attempt 운명 결정), dispatch면 DISPATCHING 유지 후 복구.
**deadline < 정상 응답 시간이면 그 호출은 구조적으로 영원히 실패**하므로, 느린 check는
timeoutPolicy로 그 task만 deadline을 정상 응답 시간 이상으로 올린다(결정 6, D-T3).

reconciler는 모든 외부 호출을 호출별 deadline + 비블로킹 async 발사(결정 6)로 실행한다 — 느린
upstream 하나가 tick을 정지시키지 못하고, Infra Manager가 hang해도 리더 루프의 worst-case는
예측 가능하다.

두 정련: **만료는 fresh 상태 재독 후 판정한다**(timeout보다 긴 outage가 완료 작업을 실패시킬 수
없음). worker-outage breaker가 열린 동안 발화한 timeout은 fail_count 소모 없이 WORKER_OUTAGE로
재분류된다(4d).

**execution timeout의 역할(2026-06-12 재정의):** 결과 누락 빈도가 매우 낮음이 확인되었으므로
(제약 #4), 이 timeout은 일상적 흡수가 아니라 **드문 worker 버그의 안전망**이다. 발화 시 severity를
critical로 격상한다. 기본값은 유지하되 정상 실행이 그를 넘는 사례가 실재하므로, 운영 통계
(task_check 분포)로 분포 확인 후 조정한다 — 단일 상향 또는 timeoutPolicy의 task별 차등. R5에
따라 무중단 조정. 단일 상향 시 4d fallback 감지 둔화를 함께 검토한다.

### 4b. 동시성 상한: BFF 측 admission control

- requiresSlot=true인 task는 WAITING_SLOT로 진입한다. 매 tick 스케줄러가 slot 보유
  task(DISPATCHING|RUNNING)를 COUNT해 N 미만일 동안 큐에서 admit한다. **별도 카운터 없이 상태
  COUNT로 센다** — 카운터 증가와 상태 변경이 둘로 갈리는 dual-write를 피한다. admission은
  전역 task 순서를 따른다 — 파이프라인 내 FIFO, 파이프라인 간 공정. 우선순위 클래스 없음.
- **`requiresSlot` = "공유 IM 동시성 자원(제약 #5)을 소비하는가" — "terraform이냐"가 아니다.**
  slot이 보호하는 것은 타입이 아니라 공유 자원이다. 따라서 **타입별 slot 분배(예: TERRAFORM/일반
  API를 서로 다른 slot에)는 채택하지 않는다** — 타입과 자원을 결합시켜 확장성을 깬다. 일반 API가
  미래에 *다른* rate-limited backend를 때리면 그건 "타입이라서"가 아니라 "그 backend가 한도를
  가져서"다. 현재 자원 풀은 하나(`infra_manager`, cap=N); 다중 풀(named resource pool)은 두 번째
  한도 backend가 실재할 때 `requiresSlot: boolean` → `ResourceClaim[]`로 additive 확장하며 지금은
  만들지 않는다(YAGNI). (개념상 slot의 소유자는 task가 아니라 call→backend지만, 현재 task당
  capacity-limited 호출이 ≤1이라 task-level 불리언이 정확한 근사다.)
- **N-cap은 best-effort soft target이다 (불변식 아님).** terraform run 요청은 사실상 잘 설계된
  TerraformWorker 큐로의 enqueue이고 **실질 backpressure는 그 큐가 한다.** N-cap은 평소 큐를
  과보호하는 목표치이지 절대 불변식이 아니다.
- **단일 리더가 N-cap을 *엄밀히* 지키지만, 깨져도 손상이 아니다.** 두 pod가 동시에 COUNT→admit하면
  서로 다른 task라 행 CAS가 못 막아(read-then-act, 3.2 참조) N을 넘긴다. 단일 리더는 happy path
  에서 이를 직렬화한다. 그러나 ≤30초 failover split-brain, 그리고 아래 두 경로(slot 해제 후 잔존
  job·BFF 밖 caller)로 인한 일시 초과는 큐가 흡수하므로 감수한다 — 잠깐의 초과이지 손상이 아니다.
  ("상태기계 정확성은 leader 무관"(3.2)과 모순되지 않는다: N-cap은 정확성 불변식이 아니라 용량
  목표치다.)
- N은 런타임 설정(Part II; 초안 N=3에서 상향), 변경은 이벤트로 감사.
- execution timeout으로 slot이 해제된 task의 기저 job은 계속 돌 수 있다 — 실효 동시성이 일시적
  N 초과 가능(감수).
- enforcement는 BFF에만(사용자 결정). **기록된 blind spot:** Infra Manager에서 사람이 직접 띄운
  job은 BFF 카운터에 보이지 않으므로 실효 총량이 수동 job 수만큼 N을 초과할 수 있다.
- **하드 글로벌 상한이 정말 필요해지면 그 자리는 BFF가 아니라 Infra Manager(429)다** — 모든
  caller를 보는 유일한 계층이라서다. BFF slot lease는 BFF 발 동시성만 묶고 위 blind spot을 못
  막아 글로벌 하드캡이 못 된다. 재검토 트리거: 다른 자동화 caller 등장 또는 수동 실행 빈발 시
  Infra Manager 측 제한(429)을 2선 방어로 추가; BFF는 429를 일시 requeue로 처리.
- **재dispatch 헤드룸.** worker dedup이 없어 crash 재dispatch가 낳은 고아 job과 최신 job이 각각
  실제로 slot을 소비하므로, BFF가 task 상태로 세는 slot 카운트가 실제 IM 부하보다 적게 잡힐 수
  있다(고아 job은 BFF가 추적하지 않음). 이를 hard ceiling(IM 실제 수용량) 침범 없이 흡수하기 위해
  **재dispatch 상한 K(= max_fail_count, 결정 3.1)와 slot limit N을 `N ≤ IM 수용량 / K`로 설정**한다.
  최악의 경우에도 동시 실행 job이 `K·N ≤ 수용량`을 넘지 않는다. K는 IM 스펙에 따라 정하는 런타임
  설정(Part II)이며, 고아 job은 멱등 apply라 "변경 없음"으로 빠르게 terminal에 도달하고 execution
  timeout(결정 4a)이 점유를 bound하므로 실제 동시 중복은 보통 1~2개에 그친다 — 헤드룸은 드문 연쇄
  crash burst에 대한 안전 마진이다.

### 4c. 중단: 죽이지 않고 전진만 멈춤

Infra Manager에 cancel API가 없고 pubsub 회수가 비현실적이다(확정). 파이프라인 [중단]의 의미:

- 파이프라인은 CANCELLING으로 전이한다. 취소는 **forward edge만** gate한다(readying,
  dispatching, retrying, breaker requeue) — **drain edge는 절대 gate하지 않는다**(반환된 job_id
  기록, 실행 중 job의 terminal까지 폴링). 아직 dispatch 안 된 task는 즉시 CANCELLED.
- in-flight TerraformJob은 자연 종료(또는 execution timeout)까지 돌고 **그때까지 slot을 보유**
  한다. terminal 도달 시 파이프라인이 CANCELLED로 확정된다. **drain된 job이 terminal에 도달해도
  postChecks는 실행하지 않는다**(task 성공 경로가 아니므로 — O9 해소).
- 보드는 "중단 중 · 실행 중 job 종료 대기"를 표시. 최종 상태는 attempt에 히스토리로 기록되지만
  파이프라인 상태엔 영향 없다.
- 결론: 취소는 실패하거나 leak할 수 없다(이중 전이·slot leak·고아 job 없음) — **늦을 수만 있으며**
  execution timeout이 bound한다.
- **pipeline 최종 상태 파생의 precedence(CANCELLING 최우선)는 결정 1.1이 정본이다.** 4c는 task/job
  레벨 drain·slot 보유를 규정하고, "CANCELLING 중 task가 FAILED로 끝나도 pipeline은 FAILED 아닌
  CANCELLED로 수렴"이라는 파이프라인 파생 우선순위는 1.1에서 확정한다.
- **입구 가드:** 이미 terminal인 pipeline(DONE/FAILED/CANCELLED)에 들어온 [중단](CANCELLING) 전이는
  거부된다 — 결정 5 "terminal은 terminal"의 직접 귀결이라 별도 전이 규칙이 불필요하며, terminal
  부활은 없다.

### 4d. Systemic 실패: TerraformWorker outage circuit breaker

단일 job 실패는 task 레벨 사건이다. worker outage는 dispatch된 모든 job이 동시에 보고를 멈춘다.
systemic 관점이 없으면 N개의 독립적 timeout, N번 fail-count 재시도, N건 critical 알림으로
열화한다. 운영 원칙(최소 개입)에 따라 dispatcher가 circuit breaker를 가진다:

- **감지 (open).** **EXECUTION_TIMEOUT 3연속**(15분 내 서로 다른 target). job 상태의 "queued vs
  running" 구분은 **불가능**하므로(O7 해소 — IM API가 노출 못 함) pickup-window 기반 빠른 감지는
  성립하지 않고, timeout 기반 감지가 유일하다. **한계(구조적 상수로 감수): 감지가 execution timeout에
  종속되어 worker 사망 후 breaker open까지 ~30분+, 회복 확인도 둔화 — O7이 불가로 닫혀 단축 경로가 없다.**
- **Pause, don't fail.** open 동안: 신규 dispatch 없음 — task는 FIFO 위치 유지한 채
  WAITING_SLOT 잔류; timeout 발화 task는 fail_count 소모 없이 WORKER_OUTAGE로 기록 후 requeue.
- **Probe (half-open).** probe 간격(Part II)마다 canary dispatch 1건; 수령/보고되면 닫히고
  큐가 FIFO 자동 배수. (worker health endpoint는 없다 — O7 불가; canary가 유일한 probe.)
- **알림 1건 롤업.** open 시 단일 critical WORKER_OUTAGE_SUSPECTED; close 시 WORKER_RECOVERED.
- **새 파이프라인 상태 없음.** 파이프라인 RUNNING 유지; dispatch admission만 gate. 수동 강제
  재개/중지는 감사 비상구.

회복은 완전 자동: worker 복귀 → canary 성공 → 큐 배수 → 알림 1건.

### 부속 결정: k8s pod 직접 조회 비채택

TerraformWorker가 k8s pod이므로 pod 조회로 "실행 중 worker 수"를 얻을 수 있으나, BFF 직접 조회는
채택하지 않는다. 근거: ① BFF가 worker 배포 방식에 묶여 계층 추상화가 깨짐. ② breaker 핵심
질문(O7: queued vs running)을 풀지 못함 — queued는 pod 부재일 수 있어 구분 불가. ③ pod↔job
매핑이 보장되지 않으면 집계 숫자만 남아 실효 없음. **이 구분은 Infra Manager API로도 노출 불가능
하다(O7 해소)** — queued/running을 알려주는 경로가 없으므로 "IM이 노출하면 breaker primary signal과
execution timeout 단축을 얻는다"는 경로도 닫혔다. breaker는 timeout 기반 감지로 확정한다.

---

## 결정 5 — 수동 개입: 재시도 = 새 run 생성, 재개·task 레벨 수동 재실행 비지원

> 구 D8/R2의 [재시도] intent에 비어 있던 의미론을 확정한다.

**원칙 두 줄:**

1. **Terminal은 terminal이다.** EXPIRED/FAILED/CANCELLED/DONE에서 나가는 전이는 없다. task도
   pipeline도 부활하지 않는다.
2. **수동 개입의 단위는 run, 자동 회복의 단위는 attempt다.** task 안의 재시도는 fail_count
   한도까지 reconciler가 자동 수행(attempt_no 증가)하며, 운영자에게 task 레벨 재시작 수단을
   제공하지 않는다.

**[재시도]의 의미 = 같은 definition으로 새 pipeline 생성의 단축.** 죽은 run을 되살리지 않고
동일 target에 새 run을 만든다. 새 run은 별개 pipeline 행이며 target별 히스토리에 별개 run으로
쌓인다.

**안전 근거 — 재개 없이도 전체 재실행이 안전하다:** terraform apply는 수렴형이어서 이미 완료된
리소스 재apply는 변경 없음으로 빠르게 통과하고, WAIT_EXTERNAL check는 읽기여서 이미 충족된
조건은 첫 확인에서 MET이다. 결정 3("모든 side effect는 반복 안전")의 직접 귀결 — 중간부터
재개라는 최적화 없이도 정확성 손실이 없으며 잃는 것은 시간뿐이다.

**배제한 대안 — terminal 부활:** EXPIRED→READY, FAILED→RUNNING 전이 합법화는 거부한다. 전이
테이블 한 곳 수정으로 가능하나 "terminal은 terminal"의 단순함이 깨지고 fail_count 리셋·알림
의미·히스토리 해석을 전부 재정의해야 한다. N-cap은 근거가 아님을 명시 — task 재실행을 만들어도
dispatch는 WAITING_SLOT admission을 통과하므로 cap은 스스로를 지킨다. 배제 근거는 slot이 아니라
의미론 비용 대비 실익 부재다.

**확장 경로 (지금 만들지 않음):** 전체 재실행 시간이 실제 문제가 되면 "이전 run의 완료 task를
알고 시작하는 새 run"(예: retry API에 skipCompleted 옵션)으로 additive하게 확장한다 — snapshot과
task별 히스토리가 무엇이 완료였는지 이미 알고 있으므로 일부 task를 DONE/SKIPPED로 시드하면 되고
새 상태도 새 전이도 필요 없다. 전제는 terminal run 데이터의 무기한 보존이며 결정 1.3이 보장한다.

---

## 결정 6 — tick의 외부 호출 실행 모델

> 신규 (2026-06-13). "tick이 외부 API 호출을 어떻게 실행하고, 장시간 호출과 실행 주체의 죽음을
> 어떻게 처리하는가"를 확정한다. WAIT_EXTERNAL의 일부 check가 200초+ 걸리는 문제가 출발점이다.
> 본 결정은 **구현 무관 불변식**이다 — async 실행의 구현(Virtual Thread)·운영 제약은 **부록 A**.

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
- 구현은 Java 21 Virtual Thread이며, 자원·carrier pinning·HTTP backing client 제약은 **부록 A**.

### D-T3. per-call HTTP deadline은 task별로 오버라이드 가능하다

- **deadline < 정상 응답 시간 → 그 호출은 구조적으로 영원히 실패**(매번 잘려 fail_count만 쌓임).
- **전역 상향 금지** — 빠르게 실패해야 할 호출까지 느려지고 tick worst-case가 늘어난다.
- **`TaskDefinition.timeoutPolicy`가 per-call deadline을 task별 오버라이드한다**(기본값 Part II).
  느린 provider check는 정상 응답 시간 + 여유(예: 최대 50초면 90초, 최대 200초면 240초).
  post-check가 이미 전역값을 벗어나 있으며 같은 패턴의 명시화일 뿐이다.

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
   호출 스레드: ① task_check PENDING 선기록(tx) → ② API Call(deadline) → ③ 같은 행 UPDATE
               (api_result·observed·latency; status는 절대 안 건드림)
                                                  │
              (다음) tick: 그 관측을 보고 task.status를 CAS 전이
```

- **선기록·관측 쓰기는 호출 스레드 안에서 일어난다(tick lane 아님).** tick이 발사 시점에 하는 것은
  next_check_at을 미래로 미는 것뿐이다. 이래야 D-T5의 "(A) tick이 발사 전 죽음 = task_check 행
  없음"이 성립한다(행 생성이 발사 *이후* = 스레드 안). 쓰기 책임 분리 유지: 관측=스레드, 상태=tick.
- **중복 발사 방지:** tick은 **호출 발사 시점에 next_check_at을 미래로 민다.** 실행 주체가 죽어도
  next_check_at은 밀려 있으므로 복구 재호출은 그 시각 도래 후에 일어난다(폴링 주기만큼 지연되나
  결국 복구). WAIT_EXTERNAL은 ≥10분 주기 + 수일 TTL이라 무해. (대안 "응답 후 밀기"는 빠른
  복구를 주지만 정상 케이스 중복 발사 위험이 있어 미채택.)

### D-T5. task_check는 호출 직전에 선기록한다 ("시도"와 "미시도"의 구분)

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

- 일관성 근거: dispatch가 이미 따르는 규율(결정 3.1)을 **모든 외부 호출(check 포함)로 일반화**한
  것이다.
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
- **async 실행이 자원 문제를 제거했으므로 추적할 이유가 없다(부록 A).** 진행 중 호출이 자원을
  고갈시킨다면 "호출 중 개수"를 상태로 추적해 admission으로 제한해야 했겠으나, 고갈이 없으니
  추적할 상태도 불필요하다.
- **노출 목적이라면 상태가 아니라 task_check에서 파생.** "확인 중 vs 다음 확인 대기"는 최신
  task_check의 api_result=PENDING 여부로 파생한다. status 집합을 키우지 않는다.

→ WAIT_EXTERNAL 하나로 충분. **task 상태는 10종**(의존성 대기는 BLOCKED로 표현 — READY가 "의존
풀림·전진 가능"을 보장하려면 "아직 후보 아님(의존 미해소)"을 BLOCKED로 분리해야 하므로 유지, 1.2
참조). 그 외 상태는 각각 고유 전이/복구를 가져 더 줄이면 다른 구분자가 늘어 순손실이다.

**부속 원칙 — kind는 표현 라벨이지 control flow 신호가 아니다.** `task_check.kind`는 UX·조사용
라벨이며, **상태 전이 입력 여부는 행의 kind가 아니라 reconciler가 실행한 훅(`check()` vs
`postChecks[]`)이 결정한다.** 그래서 JOB_POLL과 CONDITION_CHECK를 `CHECK`로 통합한다 — reconciler는
완료 판정(DONE|PENDING|FAILED)만 보고 "핸들 폴링이냐 조건 평가냐"로 분기하지 않으며, 그 구분이
필요하면 `external_handle` 유무로 파생한다. `CHECK`와 `POST_CHECK`는 **UX 목적**으로만 구분을
유지한다("완료를 판정한 확인" vs "관측 전용"). `if kind == POST_CHECK`로 상태 판정을 회피하는
코드를 만들지 말 것 — 상태 무영향은 *훅이* 보장한다. (FORCE_CHECK를 actor 축으로 흡수하는 안은
미정 — Open O18.)

### D-T7. 외부 호출 동시성 budget — Infra Manager API 서버(M pod) 보호

부하에는 세 축이 있는데 지금까지 둘만 막혀 있었다: (가) 느린 IM이 reconciler를 멈추지 못하게
(async 발사 + per-call deadline, D-T1/D-T2), (나) dispatch 폭주로부터 worker 큐 보호(N-cap,
결정 4b). 빠진 **(다)가 poll/check 호출량이 IM API 서버(M개 pod)를 과부하**시키는 축이다.
**poll은 slot과 무관**해서 N-cap으로 안 묶인다 — in-flight + WAIT_EXTERNAL task 수(수천 가능)에
비례한다.

**N과 C는 직교하는 두 축이다 — 서로 다른 것을 보호하는 독립 카운터다:**

| | N — slot (결정 4b / 제약 #5) | C — call budget (여기) |
|---|---|---|
| 세는 단위 | 동시 실행 TerraformJob 수 | in-flight 외부 API 호출 수 |
| 카운트 | `DISPATCHING\|RUNNING` task COUNT | `api_result=PENDING` task_check COUNT |
| 대상 | `requiresSlot=true` task만 | **모든 외부 호출**(terraform·일반 무관) |
| 보호 대상 | TerraformWorker 큐(실행 용량) | **IM API 서버(M pod)** 요청 처리 용량 |
| 성격 | soft target, leader-serialized | soft target, leader-serialized |

**일반 API 호출도 C로 묶인다.** slot(N)은 면제(terraform job을 안 만듦)지만, 외부 호출인 한
PENDING task_check를 남기고 C를 소비한다 — `requiresSlot=false`는 "terraform slot 안 잡음"이지
"무제약"이 아니다. **C는 단일 전역 budget**으로 IM·Backend Manager·provider가 같은 C에서
차감한다 — fast/slow lane이나 backend별로 쪼개지 않는다. ("M"은 *보호 대상*(IM API pod 수)이지
*제약값*이 아니다 — 실제 한도는 C다.)

- **메커니즘: tick당 in-flight 동시성 budget C.** 매 tick 리더가
  `in_flight = COUNT(task_check WHERE api_result=PENDING AND call_deadline_at > now())`,
  `admit = max(0, C − in_flight)`를 구해 due 호출을 `next_check_at ASC`로 admit 개만큼만 발사하고
  나머지는 다음 tick으로 미룬다. IM에 동시에 매달리는 호출 수가 C로 묶인다.
- **in-flight를 새 상태가 아니라 PENDING task_check로 센다.** D-T5가 모든 호출을 직전에 PENDING으로
  선기록하므로 PENDING 행 수 = 발사됐으나 미완 호출 수다. ① 별도 `WAITING_API_CALL` 상태를 만들지
  않는다(D-T6 유지). ② **WAIT_EXTERNAL task 수를 세는 것도 아니다** — 그건 "폴링 대상 모집단"이지
  "활성 호출"이 아니다(2000개 대기 ≠ 5개 호출 중). ③ budget은 *호출* 단위인데 외부 호출 행이
  호출당 1행(PENDING)이라 granularity가 맞다(한 task가 dispatch+check+post-check로 여러 호출). 외부
  호출 없는 평가는 PENDING을 안 거쳐 C에서 자동 제외된다(행은 남되 C는 실제 호출 행만 — O25 해소).
  call_deadline_at이 지난(≤ now()) PENDING은 in-flight가 아니라 좀비이므로 count에서 제외하고 조사
  플래그(D-T5).
- **스키마 추가 최소 — `call_deadline_at` 1개.** `api_result=PENDING`·`started_at`은 D-T5가 이미
  추가하고, 여기에 호출 deadline 박제용 `call_deadline_at`만 더한다. 이게 없으면 호출별로 다른
  deadline(30/60/90/240초)을 단일 상수로 뭉뚱그려 in-flight를 오계수한다(P0).
- **C는 넉넉히 잡는다.** 대부분의 호출은 sub-second로 끝나 budget을 즉시 비우므로, C는 드문 느린
  호출(200초+) 집중과 burst만 묶으면 된다. R5 런타임 설정(Part II).
- **soft + leader-serialized — N-cap 결론을 그대로 상속.** COUNT→admit 구조가 N-cap admission과
  동일하다(결정 4b). 일시 초과는 무해하다 — poll은 idempotent read라 미뤄도 정확성 무손상이고
  최악은 관측 지연(시스템의 정상 열화). 정밀 강제가 필요하면 IM이 자기 M-pod 부하로 **429/503
  (+Retry-After)** 를 던지고 BFF는 **requeue**(next_check_at 미루기)로 순응하되 **fail_count는
  소모하지 않는다**(backpressure ≠ 실패; 4d worker-outage 재분류와 같은 패턴).
- ⚠️ **per-call deadline(D-T3)은 (다)를 막지 못한다.** deadline은 느린 호출을 *끊을* 뿐 호출은 이미
  IM에 도달했다(부하 발생 후). IM을 보호하려면 *호출을 안 보내야* 하고(budget/backoff), 이것이
  budget C가 deadline과 별개로 필요한 이유다.

---

## Consequences

### Positive

- 오늘의 수동·사람 순차 Terraform 운영이 가시적 큐와 강제된 동시성을 갖춘 restart-safe 자동화가
  된다.
- 일시 장애, BFF crash/재배포, worker outage, 외부 호출 실행 주체 죽음이 자가 회복한다
  (fail-count 재시도, 결정 3.3 불변식, 4d breaker, 결정 6 관측/상태 분리).
- 모든 grain의 실행 히스토리(run → task → attempt → 개별 poll/check), "호출 시도 vs 미시도"
  구분(PENDING 선기록), 최근 실행 시각, 감사 추적, 알림이 동일한 append-only 기록 규율에서
  파생된다 — 2차 장부도 로그 파일 고고학도 없다.
- 장시간 외부 호출(200초+)을 tick 모델과 불변식을 깨지 않고 수용한다 — async 발사로 tick 비블로킹,
  task별 deadline로 false failure 방지, 관측/상태 쓰기 분리로 단일 writer 보존.
- poll/check 호출량이 Infra Manager API 서버(M pod)를 과부하시키지 않도록 in-flight 동시성
  budget(C)으로 묶인다 — terraform·일반 API 무관 **모든 외부 호출**이 C 대상이고(N은 terraform
  job만), 새 상태·스키마 없이 기존 PENDING 장부(D-T5)를 재사용하며 IM 429에는 requeue로 순응한다
  (결정 6 D-T7).
- 재시도 의미론이 "새 run"으로 확정되어 terminal 단순함이 보존되고, 완료분 스킵 확장이 additive로
  열려 있다.
- 실행 입력이 `pipeline.parameters`(데이터)가 되어 실행 단위·입력 변경이 스키마 ALTER를 강제하지
  않고, Execution/Check가 특정 차원이 아닌 추상 입력 객체(`TaskExecutionContext`)에만 의존한다
  (결정 2; 1:N 등 단위 확장은 parameters 키 추가로 흡수, target 묶기는 비채택 — O22 해소).
- dispatch 산출을 `attempt.response(jsonb)`로 보존해 dispatch 종류별 응답 형태를 정형 컬럼 없이
  흡수하고, check 입력을 단일 객체 `TaskExecutionContext{input, attempt?}`로 통일해 id 없는 조건
  task가 특수 케이스가 되지 않는다(결정 1.4); 모든 dispatch가 단수 handle이라 attempt:check는 1:1이다.
- Slack/email 채널과 (descope된) AI 운영은 어댑터/API principal 추가이지 아키텍처 변경이 아니다.

### Negative / 감수한 비용

- BFF가 DB와 백그라운드 루프를 갖는다 — 더 이상 stateless proxy가 아니다. 다중 replica엔 리더
  선출이 필요하다.
- N-cap은 Infra Manager의 사람 직접 실행 job에 눈멀어 있다(감수; 4b 재검토 트리거 기록).
- at-least-once dispatch는 간헐적 중복/고아 job을 남길 수 있고, timeout 해제 slot은 실효 동시성을
  일시 N 너머로 민다(감수; 멱등 apply가 이중 실행을 무해하게 만든다).
- worker dedup 부재로 crash 재dispatch가 낳은 고아 job이 별도 slot을 소비해 실효 동시성이 일시 N을
  초과할 수 있다 — 재dispatch 헤드룸(N ≤ 수용량/K, 결정 4b)이 hard ceiling 침범을 막고, 멱등 apply의
  빠른 수렴과 execution timeout이 점유를 bound한다(감수).
- 관측 로그(task_check)는 poll/check마다 행을 쓰고, 이제 호출 전 선기록까지 더해진다. cadence로
  bounded되고 retention으로 prune되지만 로그 파일 방식엔 없는 DB 트래픽이다(감수 — 조회성과
  "시도 이력" 구분이 요구사항).
- queued vs running 구분이 불가능하므로(O7 해소) breaker는 EXECUTION_TIMEOUT 기반 감지에만 의존하며
  감지·회복이 execution timeout 분만큼 둔화된다(~30분+) — 구조적 상수로 감수. 단일 job은 terminal까지
  폴링하며, execution timeout(드문 안전망)에 걸리면 재시도하고 — breaker open 중이면 fail_count 소모
  없이 requeue된다.
- 재개 비지원으로 실패한 긴 run의 재시도는 전체 재실행 시간을 지불한다(감수; terraform 수렴으로
  완료분은 사실상 no-op).
- 외부 호출을 비블로킹 async로 실행해야 하는 런타임 제약이 있다 — 구현(VT)·검증 세부는 **부록 A**
  (감수; async의 자원 이점에 대한 대가).

---

# Part II — Configuration (설정은 데이터다)

**R5 — 설정은 데이터다.** 아래는 모두 DB 기반 런타임 설정으로, 관리자 설정 페이지(결정 1.4-5)에서
변경하며 변경은 pipeline_event로 감사된다. 운영 튜닝에 재배포가 필요 없다. **결정 본문은 메커니즘만
기술하고, 구체 기본값은 이 표를 단일 출처로 참조한다.**

| 설정 | 기본값 | 범위 | 비고 / 출처 |
|---|---|---|---|
| tick 주기 | 30초 | 전역 | reconciler 깨어나는 빈도; 호출 deadline과 무관 (D-T1) |
| per-call HTTP deadline | 30초 (post-check 60초) | 전역 + task별 오버라이드 | 느린 check는 정상 응답시간+여유(예 90/240초) (D-T3) |
| Dispatch 복구 timeout | 5분 | 전역 | response 없는 DISPATCHING 재dispatch (3.1) |
| Execution timeout | 30분 | 전역 (task별 차등 가능) | dispatch→terminal; 드문 worker 버그 안전망 (4a) |
| WAIT_EXTERNAL TTL | 7일 (예) | task별 | 초과 시 EXPIRED → pipeline FAILED (4a) |
| WAIT_EXTERNAL polling guard | ≥10분 | task별, 관리자 조정 | 조건 확인 cadence (결정 2) |
| job-poll cadence | 30–60초 | 전역(시스템) | TerraformJob 상태 폴링; task별 비노출 (결정 2) |
| N (slot cap) | 10 (초안 3) | 전역 | 동시 slot 보유 task soft target; **N ≤ IM 수용량/K** (4b) |
| C (외부 호출 동시성 budget) | 넉넉히 (런타임 조정) | 전역 | 동시 in-flight 외부 호출 상한; poll 부하 보호 (D-T7) |
| max_fail_count | task별 | task별 | 자동 재시도 한도; **K(재dispatch 상한) 겸함** (1.2, 3.1) |
| K (재dispatch 상한 = max_fail_count) | IM 스펙 기반 (예 2~3) | task별 또는 전역 | crash 재dispatch 포함 시도 상한; N ≤ 수용량/K 헤드룸 근거 (3.1, 4b) |
| breaker probe 간격 | 5분 | 전역 | half-open canary 주기 (4d) |
| task_check 보존 | 90일 | 전역 | reconciler prune (1.3) |
| queue-wait 알림 임계 | 30분 (제안) | 전역 | QUEUE_WAIT_EXCEEDED (1.3) |
| 알림 라우팅 | 기본 표 (1.3) | 이벤트별 | 관리자 편집 |

(구 아키텍처 룰 R1·R2·R6은 결정 3.2로, R3은 결정 2로, R4는 결정 1.3으로 흡수되었고, 독립 룰로
남는 것은 R5뿐이다.)

---

# Part III — History / 이력

## 재구성 내역

개정 3판 (2026-06-12 전면 재구성 · 2026-06-13 결정 6/N-cap/poll budget):

- 결정 13개(구 D1–D13) → **6개로 통합.** 판별 기준: *"다르게 결정했다면 시스템의 형태나
  불변식이 바뀌었을 결정"* 만 headline 결정으로 두고, 나머지(elaboration·증명·적용)는
  해당 결정에 흡수.
- **D9(AI-ready management plane) 제거.** UI = API parity는 BFF 계층 규칙으로 흡수.
- **D12(crash & N-pod walkthrough)는 결정에서 근거로 강등.** 새로 정한 것이 없는 검증이므로
  결정 3의 근거 절로 이동. "BFF DB = availability anchor"만 감수 비용으로 분리.
- **결정 5 신설:** 수동 재시도 = 새 run 생성, 재개·task 레벨 수동 재실행 비지원.
- **결정 6 신설 (2026-06-13):** tick의 외부 호출 실행 모델 — 비블로킹 async 발사,
  관측/상태 쓰기 분리, 호출 전 선기록, per-call deadline의 task별 오버라이드.
- **N-cap soft target 확정 / P0 해소 (2026-06-13):** 상태기계 정확성만 leader 무관, capacity는
  leader-serialized soft target(결정 3.2/4b).
- **poll 동시성 budget D-T7 (2026-06-13):** poll 부하를 PENDING 기반 in-flight budget C로 제어.
- **D-T7 C-budget 정밀화 / P0 (2026-06-14):** in-flight 계수에 `task_check.call_deadline_at`(호출 생성
  시 박제) 추가 — 공식을 `started_at > now()-deadline`(단일 deadline 모호)에서 `call_deadline_at > now()`로.
  task별 deadline override(30/60/90/240초)를 단일 상수로 오계수하던 스펙 버그 해소.
- **P0-1 해소 — 멱등성이 at-least-once를 보장 (2026-06-14):** "worker dedup으로 실행 1회" 전제가
  틀림(worker엔 dedup 없음) → 정정. 실행 dedup이 아니라 **작업 멱등성**이 안전성 보장(INSTALL
  이미존재=성공, DELETE 이미부재=성공); crash 재dispatch는 fail_count++로 세어 K(=max_fail_count)
  상한 겸용, N ≤ 수용량/K 헤드룸으로 hard ceiling 보호. 제약 #3·결정 3.1/4b·Part II 반영, 본문
  "dedup" 표현 전수 교체. 신규 검증 항목 O28(task별 멱등성). 미해결 6→7건.
- **P0-4 CANCELLING precedence (2026-06-14):** 결정 1.1 파생 규칙에 CANCELLING 최우선 순서 박음 —
  CANCELLING 중 task terminal(FAILED 포함)은 pipeline FAILED로 승격 안 하고 drain 후 CANCELLED 수렴;
  판정 상태 기준(시각 아님 — 직전 확정분 누수·CAS race 방지); task 사실 보존·pipeline만 수렴(4c 정합);
  terminal→CANCELLING 입구 가드는 결정 5 귀결로 자동 차단(4c 명시). 설계 변경 아닌 1.1 명문화.
- **O28 해소 — 멱등성은 계약이지 감사 아님 (2026-06-14):** dispatch는 외부 API 호출이라 BFF가
  멱등성을 스스로 검증 못 함 → 리뷰가 제안한 "task별 예/아니오 감사 표"는 BFF에서 작성 불가.
  결정 3.1 불변식을 "job_id 발급·폴링하는 dispatch 작업은 멱등 보장"이라는 **task 등록 계약**으로
  못박고 리뷰에서 강제(결정 3.2 연장), 비멱등은 거부; 충족 검증 책임은 task 구현·IM 쪽. 미해결 7→6건.
- **fan-out 제거 — attempt:check 1:1 확정 (2026-06-14):** 모든 dispatch가 단수 handle을 반환함이
  확정(terraform=요청당 1 job_id)되어 한 dispatch가 원자적 N id를 내는 fan-out 케이스는 실재하지
  않음. 앞서 O23(fan-out=①)·O24로 정리했던 id 집합 집계·미완 id 재폴링·handle별 1행 설계를 무효화 —
  task success = 단일 handle의 completionRule(DONE|PENDING|FAILED) 평가로 단순화. attempt.response(jsonb)는
  유지하되 근거를 "handle 1/N/0개 흡수"에서 "dispatch 종류별 응답 형태를 컬럼 ALTER 없이 담는 그릇"으로
  수정. Resolved O23 제거·O24는 "1 call=1 row"만 유지·S21/S23 fan-out 문구 정리; O27(완료 id 보존)은
  질문 자체가 소멸. 미해결 6→5건(O8·O10·O18–O20).
- **BLOCKED 제거 → 복구 (2026-06-13 → 06-14):** 06-13 제거(의존성 대기는 seq에서 파생되므로
  불필요)했으나 06-14 복구 — **READY 불변식**("의존 풀림·전진 가능 후보")을 지키려면 "아직 후보
  아님(의존 미해소)"을 BLOCKED로 분리해야 하기 때문. 합치면 READY가 그 보장을 잃는다. 9→10종.
- **결정 모델 정련 (2026-06-13~14):** Task=훅 조합·slot=공유 자원·N/C 두 축·kind=CHECK 통합·
  선기록 위치·pipeline.parameters·context 전파·dispatch 산출=attempt.response·
  입력 계약(TaskExecutionContext) (Resolved S14–S25).
- **Attempt/Check 2차 정련 (2026-06-14):** 입력 계약을 단일 객체 `TaskExecutionContext{input,
  attempt?}`로 확정(개별 인자 폐기, 필드 추가에 시그니처 불변); handle 외 append-only context 전파를
  입력에서 제외(terraform state로 해결, 값 전달 task 실재 시 additive); "조건 task엔 attempt 없음
  (attempt?=null)"으로 정정(이전 "attempt 항상 존재" 오류) (Resolved S20/S24 개정).
- execution timeout 기본 30분 유지, 운영 통계 기반 조정.
- worker 결과 보고 누락 빈도 확인(구두): 거의 없음 → 제약 #4 주석, timeout 역할 재정의.
- k8s pod 직접 조회 비채택 — worker 현황은 IM API 경유(단 queued/running 구분은 불가, O7 해소).
- **문서 재구성 (2026-06-13):** 규범(Part I)·설정(Part II)·이력(Part III)·부록(Part IV)으로 분리;
  Virtual Thread 구현 세부를 부록 A로 이관, 본문은 "async 실행 주체" 불변식으로 일반화.
- **Open questions 정리 (2026-06-14):** 23→14건. 답이 난 것(O4 범위 외·O11 결정 1 포함·O15 lane
  불필요[S16 잔존]·O16 별도 과제), 런타임 config 값(O13 간격·O17 C 값[Part II 잔존]), 운영 도구(O14),
  doc 형식화(O12), 방향 확정 UX 라벨(O5)을 제거 — 결정·근거는 본문/Resolved/Part II에 잔존.
  미해결 14건(O7–O10·O18–O27)만 유지.
- **Open questions 분리 (2026-06-14):** 미해결 질문을 별도 트래커 파일
  `016-installation-pipeline-architecture-open-questions.md`로 이관(O-번호 보존, 본문 cross-ref
  유지); ADR 본문엔 포인터만 남겼다.
- **O24·O26 해소 (2026-06-14):** O24(task_check 행 = check 호출 1회, 1 call=1 row)·O26(attempt_id
  드롭 — job_id 고유 발급이라 soft-link 무모호) 확정. S25의 "행 단위
  미정"·S21/S25의 attempt_id 문구를 새 Resolved 행(O24/O26)이 supersede. 미해결 14→12건
  (O7–O10·O18–O23·O25·O27).
- **O21 해소 (2026-06-14):** pipeline.target_source_id 비정규화 복제 컬럼 제거 —
  parameters['target_source_id']가 단일 출처, 조회 인덱스는 parameters->>'target_source_id' 식
  인덱스로 대체(S19의 "비정규화 복제" supersede). 미해결 12→11건(O7–O10·O18–O20·O22·O23·O25·O27).
- **O22 해소 (2026-06-14):** 실행 단위 확장은 결정 2에 흡수 — 단위 = target_source_id(1:1), target
  묶기 비채택(N target=N pipeline, 결정 5 기조), 확장 입력은 parameters 키 추가로 흡수(단위=데이터)라
  모델 변경 불요. 미해결 10→9건(O7–O10·O18–O20·O25·O27).
- **O7 해소 (2026-06-14):** TerraformJob queued vs running 구분 불가(IM API가 노출 못 함) → terminal
  까지 무한정 폴링·성공 대기; breaker 빠른 primary 감지 폐기, EXECUTION_TIMEOUT 3연속+canary가 유일
  감지(latency ~30분+ 구조적 상수), timeout job은 재시도(breaker open 시 requeue). pickup-window config 제거.
  미해결 9→8건(O8–O10·O18–O20·O25·O27).
- **O9 해소 (2026-06-14):** postChecks는 task 성공(DONE) 시에만 실행 — CANCELLING/drain·실패 경로에선
  실행 안 함. "성공 시에만"이 단일 기준이라 forward/drain edge에 별도 분기 불필요. 미해결 8→7건
  (O8·O10·O18–O20·O25·O27).
- **O25 해소 (2026-06-14):** 외부 호출 없는 평가도 task_check 행을 남긴다(관측의 장부 — 1평가 1행);
  거부되는 건 행이 아니라 "호출 없는 평가용 별도 카운팅 규칙"(신규 메커니즘). C는 외부 호출 발사
  행(PENDING)만 카운트라 호출 없는 평가는 자동 제외(부하 0). 미해결 7→6건(O8·O10·O18–O20·O27).

## Resolved

| # | 해소 내용 |
|---|---|
| O1 | terraform_job_id는 요청별 서버 측 발급, pubsub 인계; 중복 1회 실행; 유실은 execution timeout 흡수 → 결정 3.1, 4 (2026-06-12) **("중복 1회 실행"은 P0-1이 정정 — worker dedup 아님; 중복 각각 실행되나 멱등이라 안전)** |
| O2 | cancel API 없음 → 결정 4c (2026-06-12) |
| O3 | slot 큐 전역 FIFO, 우선순위 없음 → 결정 4b (2026-06-12) |
| O6 | N=10, execution timeout 30분, 큐 대기 알림 30분, dispatch timeout 5분 — 런타임 조정형 → 결정 4, Part II (2026-06-12) |
| A1 | ≥10분 guard는 WAIT_EXTERNAL만; job poll은 시스템 30–60초 → 결정 2 (2026-06-12) |
| S1 | worker 결과 누락 거의 없음 → 제약 #4 주석, execution timeout 역할 재정의 → 결정 4 (2026-06-12) |
| S2 | execution timeout 30분 유지, 통계 기반 조정; 정상 30분 초과 실재 → 단일 상향 vs task별 차등 → 결정 4 (2026-06-12) |
| S3 | k8s pod 직접 조회 비채택; worker 현황은 Infra Manager API 경유 → 결정 4 부속 (2026-06-12) |
| S4 | 수동 재시도 = 새 run 생성; 재개·task 레벨 수동 재실행·terminal 부활 비지원; 확장은 완료분 스킵 → 결정 5 (2026-06-12) |
| S5 | 호출 deadline ≠ tick 주기; 호출은 async로 발사하여 tick 비블로킹 → 결정 6 D-T1, D-T2 (2026-06-13) |
| S6 | per-call deadline은 timeoutPolicy로 task별 오버라이드(느린 check 90~240초); 전역 상향 금지 → 결정 6 D-T3 (2026-06-13) |
| S7 | 관측(task_check)은 실행 주체, 상태(task.status)는 tick — 단일 writer 보존, crash 단순화 → 결정 6 D-T4 (2026-06-13) |
| S8 | task_check 호출 전 선기록(PENDING) → "호출 시도 vs 미시도" 구분; dispatch 규율을 모든 외부 호출로 일반화; api_result에 PENDING 추가 → 결정 6 D-T5 (2026-06-13) |
| S9 | 장시간 check용 별도 task 상태 미도입(상태 집합 불확대); "확인 중" 노출은 task_check 파생 → 결정 6 D-T6 (2026-06-13) |
| S10 | async 구현(Virtual Thread): 개수는 비문제, carrier pinning이 실제 제약; HTTP backing client는 VT-friendly여야(Feign 기본 HttpURLConnection은 pinning) → 부록 A (2026-06-13) |
| S11 | N-cap = soft target(잘 설계된 worker 큐가 실질 backpressure); 상태기계 정확성만 leader 무관, capacity는 leader-serialized soft; split-brain·잔존 job·외부 caller 일시 초과 감수; 하드 글로벌 상한은 BFF lease 아닌 Infra Manager 429 → 결정 3.2, 4b (2026-06-13) |
| S12 | poll 부하(축 다)는 in-flight 동시성 budget C로 제어 — PENDING task_check로 count(새 상태·WAIT_EXTERNAL 계수 아님), C 넉넉히, soft·leader-serialized, IM 429→requeue(fail_count 미소모); 3.3 catch-up은 dispatch=N-cap·poll=C → 결정 6 D-T7 (2026-06-13) |
| S13 | task 상태 BLOCKED: 06-13 제거(seq 파생) → **06-14 복구**(10종) — READY는 "의존 풀림·전진 가능 후보"를 보장해야 하므로 "의존 미해소(아직 후보 아님)"를 BLOCKED로 분리; task는 BLOCKED로 시작, depends_on 충족 시 reconciler가 READY로 승격 → 결정 1.1/1.2, 6 D-T6 (2026-06-13 제거, 06-14 복구) |
| S14 | Task 모델 = 훅 조합(dispatch?/check?/postChecks[]/requiresSlot); 종류는 훅 유무가 결정(타입 enum 아님), TERRAFORM/GENERAL_API는 훅 안 코드 차이일 뿐 terraform은 구현 사례; reconciler는 훅으로 분기; task.type은 표현 라벨; connector/strategy/pool 미도입(YAGNI) → 결정 2 (2026-06-14) |
| S15 | requiresSlot = "공유 IM 동시성 자원 소비"(타입 아님); 타입별 slot 분배 비채택; 단일 풀(infra_manager, cap=N), named pool은 YAGNI → 결정 4b (2026-06-14) |
| S16 | 동시성 = 직교 두 축: N(terraform job 수, requiresSlot task) · C(in-flight 호출 수, 모든 외부 호출); 일반 API도 C 소비(N만 면제); C는 단일 전역, M은 보호 대상이지 한도 아님 → 결정 4b, 6 D-T7 (2026-06-14) |
| S17 | task_check.kind: JOB_POLL+CONDITION_CHECK→CHECK 통합; kind는 control flow 신호 아닌 표현 라벨(분기는 발원 훅 check/postChecks); CHECK/POST_CHECK는 UX용 구분 유지; 핸들폴링 vs 조건평가는 external_handle 유무로 파생 → 결정 1.2/1.3, 6 D-T6 (2026-06-14) |
| S18 | PENDING 선기록은 tick이 아니라 호출 스레드 안(호출 직전); tick은 발사 시 next_check_at만 밈; 관측=스레드·상태=tick 유지 → 결정 6 D-T4/D-T5 (2026-06-14) |
| S19 | pipeline.parameters(jsonb) 신설 — 실행 입력을 고정 컬럼 아닌 데이터로; target_source_id는 parameters 키(+조회용 비정규화 복제); 생성 시 박제(append-only); 현재 실행 단위 = target_source_id(1:1), 1:N은 의도 아님 → 결정 1.2/2, O22 (2026-06-14) **(target_source_id 비정규화 복제는 O21 해소 행이 supersede — 컬럼 제거, 식 인덱스 대체)** |
| S20 | task 간 값 전달: handle 참조는 모델 내재(A, attempt.response↔task_check.external_handle); handle 외 산출(B)의 append-only 전파는 **입력 계약에서 제외**(2차) — 현재 chain은 BFF 레벨 값 전달 안 함(terraform state로 해결), 값 전달 task 실재 시 TaskExecutionContext에 additive → 결정 2 (2026-06-14, 2차 개정) |
| S21 | attempt는 action 단수 유지(배열 컬럼 금지) → 결정 1.2/2/3.1 (2026-06-14) **(external_handle 복수·fan-out ①/② 논의는 fan-out 제거로 소멸 — 모든 dispatch 단수 handle, attempt:check 1:1; 일부 S22가 supersede; attempt_id는 O26 해소로 드롭)** |
| S22 | (S21·1차 §1.8 일부 supersede) dispatch 산출 = task_attempt.response(jsonb)에 보존(단수 external_handle 컬럼 제거); handle 1/N/0개를 JSON으로 흡수, write-once; handle home은 attempt이지 task_check 아님 — task_check.external_handle은 "확인한 id 참조"(1차 "handle을 task_check로"는 산출/관측 혼동 오류라 철회) → 결정 1.2/2/3.1 (2026-06-14) **("handle 1/N/0개 흡수" 근거는 fan-out 제거로 "단수 handle · dispatch 종류별 응답 형태 흡수"로 정련 — jsonb 유지, 본문 결정 1.2/3.1)** |
| S23 | **fan-out 제거로 소멸 (2026-06-14)** — "attempt 1 : check N" 설계는 모든 dispatch가 단수 handle을 반환함이 확정되어 무효; attempt:check는 **1:1**, task success = 단일 handle의 completionRule 평가(결정 2/3.1 본문). id 집합 집계·미완 id 재폴링은 폐기 |
| S24 | check/postCheck 입력 계약 = **단일 객체 `TaskExecutionContext{input, attempt?}`**(2차) — 개별 인자 아닌 객체라 필드 추가에 시그니처 불변; external_id 직접 안 받음(handle은 attempt.response); attempt?는 nullable(조건 task=null → input만 평가, "attempt 항상 존재" 오류 정정); 동기/비동기 비분기(response 형태로 흡수); 차이는 결과의 쓰임뿐(check=전이 입력, postCheck=관측) → 결정 2/1.4/1.5 (2026-06-14, 2차 개정) |
| S25 | task_check = 관측 장부; external_handle은 "확인한 id 참조"(저장소 아님); id마다 자기 행 — 행 단위(N행 vs 1행)는 O24, attempt_id는 O26, 동기 check 행은 O25, 완료 id 보존은 O27 (2026-06-14) **(행 단위는 O24, attempt_id는 O26, 동기 check 행은 O25 해소 행이 supersede; 완료 id 보존 O27은 fan-out 제거로 소멸 — 단수 handle이라 보존할 id 집합 없음)** |
| O24 | task_check 행 생성 단위 = **check 호출 1회**(1 call = 1 row); external_handle 단수(확인한 단일 id 참조); C(D-T7) = PENDING task_check = in-flight 호출 수 — **S25의 "행 단위 미정" 문구 supersede** (fan-out handle별 1행·배치 check 수식은 fan-out 제거로 함께 삭제 — attempt:check 1:1) → 결정 1.2/2/3.1 (2026-06-14) |
| O26 | task_check.attempt_id **드롭** — terraform_job_id 요청별 서버 측 고유 발급(재dispatch=새 job_id, 결정 3.1)이라 handle id가 attempt 간 비중복 → external_handle∈attempt.response soft-link 무모호, 명시 링크 컬럼 불요; 스키마·migration에서 제거 — **S21의 "attempt_id 기록"·S25의 "attempt_id는 O26" 문구 supersede** → 결정 1.2/3.1 (2026-06-14) |
| O21 | pipeline.target_source_id 비정규화 복제 컬럼 **제거** — parameters['target_source_id']가 단일 출처; 조회용 인덱스 pipeline(target_source_id, started_at)는 식 인덱스 pipeline((parameters->>'target_source_id'), started_at DESC)로 대체(컬럼 없이 동일 조회 보존) — **S19의 "비정규화 복제" 문구 supersede** → 결정 1.2/2, migration (2026-06-14) |
| O22 | 실행 단위 확장 — **고민 불요, 결정 2에 흡수.** 실행 단위 = target_source_id(1 pipeline:1 target); target 묶기(1:N)는 비채택(N target=N pipeline — 재시도 run 단위·히스토리 target별인 결정 5 기조와 정합); 단위 확장 입력은 parameters(jsonb) 키 추가로 흡수(실행 단위=데이터), 어떤 확장도 task엔 target_source_id 안 넣어 추상 입력 계약 유지 → 모델 변경 불요 → 결정 2/5 (2026-06-14) |
| O7 | TerraformJob "queued vs running" 구분 = **불가능**(IM API가 노출 못 함, worker health endpoint 없음) → terminal까지 **무한정 폴링·성공 대기**(stuck vs 느림 조기 구분 불가). breaker 빠른 primary 감지(pickup-window) 폐기 — **EXECUTION_TIMEOUT 3연속 + canary가 유일 감지/probe**; 감지 latency ~30분+는 구조적 상수로 감수; timeout job은 재시도하고 breaker open 중이면 fail_count 소모 없이 requeue. pickup-window config 제거, k8s 직접 조회 비채택 유지 → 결정 4d (2026-06-14) |
| O9 | CANCELLING/drain에서 terminal 도달 job의 postChecks 실행 = **안 함.** postChecks는 task가 **성공(DONE)일 때만** 실행(취소·실패·drain은 비성공 경로) — forward/drain edge에 별도 분기 불필요, "성공 시에만"이 단일 기준 → 결정 2/4c (2026-06-14) |
| O25 | 외부 호출 없는 check(동기·조건)의 행 기록 = **남긴다.** task_check는 관측의 장부(호출 장부 아님)라 1평가 1행 — 안 남기면 조사 타임라인에서 사라짐. 거부되는 건 행이 아니라 "호출 없는 평가용 별도 카운팅 규칙/플래그"(신규 메커니즘); 행은 남기고 새 규칙은 안 만든다. C는 **외부 호출이 실제 발사된 행(PENDING)만** 카운트(D-T5 선기록이 자동 판별) — 대부분의 check(조건 평가·핸들 폴링)는 외부 호출이라 C 소비, 네트워크 안 타는 평가만 미소비 → 결정 6 D-T5/D-T7 (2026-06-14) |
| P0-1 | downstream dedup 계약: **worker dedup 없음 + execution API 멱등 보장**으로 해소 — 중복 job 각각 실행되나 멱등이라 안전, B도 정상 수렴해 timeout 시나리오 불가; idempotency key/상태조회 불요; crash 재dispatch는 **fail_count++**로 세어 K(=max_fail_count) 상한 겸용, **N ≤ 수용량/K** 헤드룸으로 hard ceiling 보호 → 제약 #3, 결정 3.1/4b, Part II (2026-06-14) |
| P0-4 | CANCELLING 중 task FAILED/EXPIRED의 pipeline 최종 = **CANCELLED 확정**; 결정 1.1에 "CANCELLING 최우선" precedence 명문화(4c 입장의 정합 — 동작 권위는 4c, 본 행은 1.1로의 명문화이지 설계 변경 아님); 판정은 **상태 기준**(파생 시 pipeline.status가 CANCELLING인가)이지 시각 기준 아님 — 직전 확정분 누수·CAS race 방지; task 상태는 사실대로 보존(FAILED는 FAILED, CANCELLED는 미발사 task만), pipeline만 수렴; 입구 가드(terminal→CANCELLING 거부)는 결정 5 "terminal은 terminal"의 귀결로 자동 차단(4c에 명시) → 결정 1.1/4c, 5 (2026-06-14) |
| O28 | dispatch 멱등성 = **BFF가 검증하는 사실이 아니라 task에 요구하는 계약**으로 해소(task별 감사 표 아님 — dispatch는 외부 API라 BFF가 멱등성을 런타임에 알 수 없어 표를 채울 수 없음). job_id를 발급받아 폴링하는 모든 dispatch 작업이 멱등(이미-원하는-상태=성공, DELETE not-found=성공)을 보장하도록 task 등록 계약으로 요구·리뷰에서 강제(결정 3.2 연장), 비멱등은 거부; 실제 충족 검증 책임은 task 구현·IM 쪽 → 결정 3.1/3.2 (2026-06-14) |

---

# Part IV — Appendix / 부록

## A. 구현 노트 — Virtual Thread 런타임

결정 6의 "비블로킹 async 발사"(D-T2)와 "실행 주체는 관측만 쓴다"(D-T4)는 **구현 무관 불변식**이다.
BFF의 구현 선택은 Java 21+ Virtual Thread다. 아래는 그 구현의 운영 제약이며 아키텍처 불변식이
아니다(미충족 시 다른 async 구현으로 대체 가능, 불변식은 불변).

- **자원: 개수는 비문제, pinning이 실제 제약.** target ≈ 2000개라도 동시 진행 호출은 일부다
  (WAIT_EXTERNAL은 ≥10분 분산, EXECUTE는 slot N 제한). VT는 힙 객체라 수천 개도 메모리
  무시 수준 — "스레드 개수 초과"는 VT를 쓰는 한 사실상 없다. **진짜 제약은 carrier thread
  pinning**: VT park 시 carrier를 놓지 않으면 코어 수만큼만 동시 실행되어 굶는다. 유발 지점은
  `synchronized` 내 블로킹 I/O(Java 21; JEP 491/Java 24+는 대부분 해소), 네이티브 호출, 일부
  레거시 HTTP 클라이언트.
- **HTTP backing client가 VT-friendly해야 한다.** Feign 등 추상화를 써도 carrier를 잡느냐는
  backing이 정한다: **위험** = Feign 기본 `Client.Default`(→ `HttpURLConnection`, 내부
  synchronized → pinning); **안전** = `feign-java11`(→ `java.net.http.HttpClient`) 또는
  `feign-hc5`(Apache HttpClient 5.x). Spring Cloud OpenFeign은 classpath 의존성으로 backing을
  auto-select하므로 VT-friendly client를 명시해 기본값에 떨어지지 않게 한다.
- **검증은 실측.** `-Djdk.tracePinnedThreads=full`(Java 21)로 느린 호출을 돌리며 pinning을
  확인한다. 개수 계산이 아니라 이 로그가 근거다. **배포 체크리스트 항목.**

## B. Affected files

- `design/pipeline-interfaces.md` — 동반 구현 스펙. **결정 5(retry=새 run)·결정 6(async 호출
  모델, 관측/상태 분리, 선기록)·dispatch 멱등성 불변식·crash 복구 fail_count++ 규칙(3.1, P0-1) 반영 필요.**
- `design/pipeline-api.md` — admin API 정본; swagger 원천. **retry 엔드포인트 의미론, O10 확정,
  per-call deadline 설정 표면, IM run API 멱등 계약(DELETE의 not-found=성공) 반영 필요(P0-1).**
- `design/admin-page-requirements.md` — §4.4 모델 원천; §5 admin API 가정 목록.
- `design/SIT Prototype Athena v14.html` — 파이프라인 보드; 결정 1.4 delta 대상.
- `docs/swagger/` — 향후 admin-pipelines.yaml.
- `docs/cloud-provider-states.md` — task 시퀀스 정의가 인코딩하는 provider별 순서.
- **DB migration** — task_check.api_result에 PENDING 추가, task_check.started_at 추가,
  **task_check.call_deadline_at 추가**(호출 deadline 박제, D-T7), task.last_checked_at 추가 (결정 6). task_check.kind: JOB_POLL+CONDITION_CHECK → CHECK 통합
  (`DISPATCH|CHECK|POST_CHECK|FORCE_CHECK`). pipeline.parameters(jsonb) 추가; target_source_id는
  parameters 키만(비정규화 복제 컬럼 제거, O21 해소) — 조회는 parameters->>'target_source_id' 식 인덱스.
  **task_attempt.external_handle 제거 →
  response(jsonb)**(dispatch 원응답, write-once); **task.external_handle(단수) 제거**
  (handle home=attempt.response). task_check 행 = check 호출 1회(O24 해소); **attempt_id 컬럼 미도입**
  (O26 해소 — job_id 고유 발급이라 soft-link로 충분). **crash 복구가 fail_count를 증가시키는 경로
  추가**(K=max_fail_count 겸용이라 신규 컬럼 불요 — P0-1).

## C. Open questions

미해결 질문은 별도 트래커로 분리했다 →
[`016-installation-pipeline-architecture-open-questions.md`](./016-installation-pipeline-architecture-open-questions.md).
O-번호는 본문 cross-reference와 **공유**하며(O8·O10·O18–O20), 해소되면 Part III **Resolved**로 옮긴다.

## D. Relates to

- `design/admin-page-requirements.md` §4.4 — 파이프라인 모델 확정(결정 #5–#14).
- ADR-006(3-object confirmation model), ADR-009(process status model) — 파이프라인은
  CONFIRMED와 INSTALLED 사이에서 동작한다.
