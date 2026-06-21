# ADR-016 Explainer HTML — 구성 스펙 (리뷰용)

> **목적.** ADR-016(Install/Delete Pipeline Orchestration)을 **HTML 하나만 읽고도 완전히 이해**할 수
> 있도록 재구성하기 위한 설계 스펙. 이 md를 codex+opus로 여러 차례 리뷰해 섹션 구성·용어 사전·사용성
> 규약을 확정한 뒤 HTML을 생성한다. **이 문서는 HTML이 아니라 HTML의 설계도다.**
>
> 정본 출처: [ADR 본문](../../docs/adr/ADR-016-install-delete-pipeline-orchestration.md) +
> `design/pipeline/{orchestrator-design,state-machine,task-model,api,operations,requirements,migrations,implementation-notes,v2-deferred}.md`.
> HTML은 이 문서들의 **파생 설명**이며 새 결정을 만들지 않는다(충돌 시 정본이 우선).
>
> **리뷰 이력.** v1 → codex 70 / opus(섹션) 86 / opus(용어) 78. v2는 세 리뷰의 합의 수정 전부 반영
> (사실오류 9건·섹션누락 11건·용어 대량 추가·사용성 명확화). 정본 cross-check 후 단일 writer가 통합.

---

## 0. 산출물 요구사항 (사용자 지시 원문 기준)

1. **HTML 단독 완결성** — ADR을 HTML만 읽고 충분히 이해할 수 있을 만큼 상세히 설명한다.
2. **용어 사전(Glossary) 전수 수집** — ADR/설계에서 쓰는 축약어·도메인 용어(BFF·CSR·reconciler·CAS…)를
   **지나치는 것 하나 없이** 모두 사전에 등재한다(§7이 마스터 인벤토리). 원시 컬럼명·enum 값·DTO 필드·결정
   라벨·open-question ID·제거된 용어까지 포함한다("passed over" 토큰도 전부).
3. **용어 밑줄 + hover 상세** — 본문에서 용어는 **점선 밑줄**로 표시하고, 마우스를 올리면(hover) 그 용어의
   상세 설명을 툴팁으로 보여준다. (`__용어__`는 *저작 표기*이지 화면에 밑줄 문자가 보이는 게 아니다 — §4.1.)
4. **디자인 + 사용성** — 읽기 흐름·네비게이션·반응형·접근성을 갖춘 시각 디자인까지 처리한다.
5. **리뷰 반복** — codex+opus 리뷰를 여러 차례 받아 정확성·완결성을 끌어올린다.

> **범위 가드.** 기존 `adr-016-explainer.html`은 **건드리지 않는다**(사용자 별도 지시). 새 파일
> `design/pipeline/adr-016-guide.html`로 생성한다.

---

## 1. 정보 설계 — 독자·읽기 경로

### 1.1 독자 모델 (2-track)

| 독자 | 목표 | 진입 경로 |
|---|---|---|
| **의사결정자/리뷰어** | "왜 이 결정인가"를 5분에 파악 | TL;DR → 문제 → 결정 → 대안 → 결과 (상단 절반) |
| **구현자** | 정확한 메커니즘·스키마·전이·엣지케이스 | 데이터 모델 → 상태기계 → 동시성 → tick → dispatch → errorCode → API (하단 절반) |

상단은 산문 위주(서사), 하단은 표·다이어그램·매트릭스 위주(레퍼런스). 두 트랙 모두 같은 페이지이고,
용어는 어느 위치에서든 hover로 즉시 해소돼 위아래를 오가지 않아도 된다.

### 1.2 페이지 구조 (단일 페이지 + 좌측 고정 네비)
- **단일 HTML 파일**, 외부 의존성 0(인라인 CSS/JS만). 오프라인·사내망에서 더블클릭으로 열림.
- **좌측 고정 사이드바**(데스크톱) — 섹션 목차 + scroll-spy. 모바일은 상단 햄버거.
- **본문 우측**, 최대폭 ~820px 가독 컬럼.
- **우상단 고정 유틸바** — `용어 사전`(글로서리 점프) · `다크/라이트 토글` · `다이어그램 펼치기/접기`.

---

## 2. 섹션 구성 (HTML 순서)

각 섹션 = `<section id="...">`. 사이드바 목차와 1:1.

| # | id | 제목 | 내용 핵심 | 정본 |
|---|---|---|---|---|
| S0 | `tldr` | **한눈에 (TL;DR)** | 문제 1줄·결정 1줄·가장 비싼 트레이드오프 1줄·"무엇이 아닌가" | ADR Decision/Consequences |
| S1 | `problem` | **문제와 맥락** | 수동 terraform·규모(target 2000·정의 12종)·계층도·확정 제약 7 | ADR Context |
| S2 | `decision` | **핵심 결정** | BFF durable state machine + 30s tick; DB=유일 상태; 정본 결정 1~7 매핑; **단일 writer·deadline≠tick axiom 선행** | ADR Decision / orch §1.1 |
| S2c | `creation-contract` | **생성 계약** | 동일 target 동시 트리거 → `23505` catch → 기존 non-terminal 반환; 통합 테스트 필수 | 결정 5 / api §3 |
| S3 | `options` | **검토한 대안** | A 채택·B 보류·C 워크플로엔진 거부·D 인메모리·E BM상태·F IM동시성 | ADR Considered Options |
| S4 | `data-model` | **데이터 모델** | 6 테이블·attempt⊥check 형제·내부↔보드 라벨·**RLE 파티션/키 매트릭스**·스키마 delta·인덱스·retention | orch §1.2 / migrations |
| S5 | `state-machine` | **상태 기계** | pipeline 5·task 9 전이도·**tick 평가 순서(안)+바깥 순서(task-pass→파생 pass·same-tick 수렴)**·완료관측>timeout·**cancel/drain 매트릭스**·CANCELLING precedence | state-machine.md |
| S6 | `concurrency` | **동시성 모델** | workerPoolSize(hard cap)·slotCap(throttle)·slotCap×maxFailCount(sizing)·max_external_calls·maxFailCount/fail_count·**fail-count 가산 매트릭스** | orch §4b / operations |
| S7 | `tick-model` | **tick 실행 모델** | 단일 writer(상태=tick·관측=호출스레드)·async 발사·per-call deadline·RLE·D-T1~T7 | orch §6 |
| S8 | `resilience` | **dispatch·멱등성·복구 (crash & N-pod)** | 5단계 writer 분리·at-least-once·idempotency-by-construction·**crash-point 매트릭스·N-pod Q&A(split-brain·rolling deploy·Notifier)**·backpressure | orch §3 |
| S9 | `errorcodes` | **errorCode 분류** | 8종 카탈로그·**저장위치 3분류 매트릭스**·fail_reason·outcome 파생 | api §0 |
| S10 | `definition` | **Definition·Snapshot** | 코드 default recipe + snapshot 박제·handler 자동 레지스트리·CI 게이트 authoritative·코드=실행권위 | orch §7 / task-model |
| S11 | `api` | **API 표면** | **DTO 빌딩블록 표**(progress·latestCheck·outcome 파생)·엔드포인트·cancel/retry(created)·settings | api.md |
| S12 | `operations` | **운영·알림** | 설정표(R5·workerPoolSize는 배포설정)·알림 2종·outbox·장애 신호 해석·없는 버튼·운영자 대시보드 멘탈모델 | operations.md |
| S13 | `requirements` | **요구사항 충족** | FR/NFR/PR 매핑 | requirements.md |
| S14 | `glossary` | **용어 사전** | 전 용어 마스터 정의(§7) — 모든 hover의 단일 출처 | 전체 |

> **섹션 간 일관성 규칙(리뷰 체크포인트).** 같은 개념은 한 곳을 "정본 설명"으로 하고 나머지는 1줄 + hover.
> 특히 **RLE·CANCELLING precedence·단일 writer·slotCap/workerPoolSize/maxFailCount** 4개념은 cross-doc 모순이 잦았으므로 "정본 섹션
> 1곳 + 나머지는 hover" 규율을 강제한다.

---

## 3. 섹션별 상세 설계

### S0 — TL;DR
- 3문장 + 1박스. 문장1: 무엇을(브라우저 없는 자동 설치/삭제 + 일급 히스토리). 문장2: 어떻게(BFF DB
  durable state machine + 30초 reconciler tick, DB가 유일 상태). 문장3: 대가(**다중 replica에선** BFF가
  stateless proxy가 아니라 리더 선출이 필요 — single replica면 리더 선출 무조건은 아님).
- 박스 "이건 ___ 가 아니다": 워크플로 엔진 아님·exactly-once 기계 아님·in-memory 체인 아님.

### S1 — 문제와 맥락
- **계층 다이어그램**: Frontend(Admin) → __BFF__ → __Backend Manager__ / __Infra Manager__ →
  __TerraformWorker__(k8s pod, dedup 없음). pubsub 경유.
- **확정 제약 7개** 카드. 특히 #3(dedup 없음→멱등으로 무해)·#5(workerPoolSize hard cap + slotCap)·#6(2단 보존: spine
  무기한 / task_check retention 90일)는 결정 근거라 강조.

### S2 — 핵심 결정
- 결정 1줄 헤드라인. 그 아래 **axiom 박스 2개를 먼저** 둔다(S5·S8이 이걸 전제로 함):
  - __단일 writer__: 상태 전이 = tick만 / 관측(task_check)·산출(attempt.response) = 호출 스레드. "다음
    tick이 관측을 소비해 전진."
  - __호출 deadline ≠ tick 주기__(D-T1): 한 외부 호출이 tick 안에 끝날 필요 없음(async 발사).
- 그 다음 **정본 결정 카드**(ADR/orch 번호를 그대로 사용; v1처럼 임의 ①~⑨ 금지):
  - **결정 1** — BFF durable state machine + reconciler tick, DB=유일 상태(다중 replica = advisory lock 리더 + CAS).
  - **결정 2** — TaskKind 2종(TERRAFORM_JOB·CONDITION_CHECK); 새 task=새 코드 class(대개 기존 kind 재사용).
  - **결정 3** — idempotency-by-construction(at-least-once dispatch + 멱등).
  - **결정 4** — Liveness: 무한대기 없음 — **4a** timeout budget · **4b** workerPoolSize hard cap + slotCap · **4c** cancel=drain · **4d** systemic 실패는 알림 롤업.
  - **결정 5** — retry=새 run(재개 없음) + 동일 target unique 제약(→ 생성 계약은 S2c).
  - **결정 6** — tick 외부 호출 모델(**D-T1~D-T7**).
  - **결정 7** — Definition: 코드 default recipe + run snapshot(**7.1~7.4**).
- 각 카드 "결정 / 왜 / 결과" 3줄. cancel 카드는 **"RUNNING TERRAFORM_JOB(job_id 영속)만 drain"**으로
  정확히(과압축 금지 — 상세는 S5 매트릭스).

### S2c — 생성 계약 (별도 강조 박스/미니섹션)
- ADR이 가장 강하게 못 박은 **외부 불변식**(api §3·결정 5): "target당 실행자 1." 누락하면 단일
  writer·slotCap·멱등 추론이 깨진다 → 별도 강조.
- 3단계: ① recipe resolve → ② task row + `pipeline_def_snapshot` **원자적** 생성 → ③ **`23505`(Postgres
  unique 위반) catch → 에러 대신 기존 non-terminal pipeline 반환**([재시도]도 동일, `created=false`).
- **이 계약의 통합 테스트는 필수**(토대 불변식이 ADR 밖 endpoint 코드에 의존하므로 회귀 방지).

### S3 — 검토한 대안
- 6행 표(A~F) + 각주(별도 워커 분리도 배제 — 무거운 워크로드는 이미 TerraformWorker로 분리; 부하가
  강제하면 답은 워커 분리가 아니라 Option B).
- **C(워크플로 엔진 거부)** 보강: "≥10분 폴링의 2~4 step 선형 체인은 Temporal/Airflow 도입 비용을 정당화
  못 함; 큐·재현·수일 WAIT는 DB row+tick으로 충분."

### S4 — 데이터 모델
- 6 테이블 카드 그리드: `pipeline` `task` `task_attempt` `task_check` `pipeline_event`
  `pipeline_def_snapshot`. 각 카드 = 컬럼 목록(모든 컬럼 hover 가능) + 1줄 역할.
- **시각화 1 — attempt ⊥ check 형제 구조**: task 아래 형제(중첩 아님). CONDITION_CHECK(attempt 0 + check
  존재)가 정당화 사례.
- **시각화 2 — 내부 상태 ↔ 보드 라벨 매핑 표**.
- **RLE 매트릭스**(정본 위치): kind별 행 단위 — DISPATCH=호출당 1행(poll_count=1, collapse 안 함) /
  CHECK=관측 run(partition=`task_id+kind+name+external_handle`, collapse key=`(api_result,observed,error_code)`,
  poll_count++). "NOT_MET 1000폴=1행(poll_count=1000)" 예시. RLE는 *행 표현*일 뿐 fail_count 회계와 무관.
- **스키마 delta·인덱스·retention**(migrations 홈): 추가(handler_key·poll_count·last_activity_at·unique
  제약) / 제거(definition_version·external_handle·detail·call_deadline_at·attempt_id·parameters) / 인덱스 6종 /
  retention(spine 무기한, task_check 90일 prune).

### S5 — 상태 기계
- **Pipeline 전이도**(5상태) + **Task 전이도**(9상태) — CSS 박스+화살표(텍스트 병기).
- **tick 평가 순서(task 1개 안에서)** 1~5: ①CANCELLING 우선 → ②handler_key resolve(미해결=즉시 FAILED) →
  ③**완료 관측 우선(timeout보다 앞 — "만료는 fresh 상태 재독 후 판정")** → ④timeout 판정 → ⑤일반 전이.
- **tick 바깥 순서**(추가): 한 tick = due task를 `next_check_at ASC, last_checked_at ASC NULLS FIRST,
  created_at ASC, seq ASC` 정렬로 각 ≤1회 전진(독립 commit) → 그 tick에 커밋된 task 상태로 **pipeline 파생
  1회**. 따라서 마지막 task terminal과 pipeline 수렴이 **같은 tick**(별도 지연 없음); `BLOCKED→READY`는
  같은 tick 먼저 처리된 seq-1의 커밋 DONE을 봄(순차 chain 1 tick에 1칸). **최저 seq는 predecessor 공집합 →
  첫 tick 무조건 READY**.
- **pipeline 파생 ①~④**: ①CANCELLING(최우선) > ②FAILED task 존재 > ③TTL EXPIRED > ④전 task DONE.
  **CANCELLING precedence**(정본): 취소 중 task가 FAILED여도 pipeline은 CANCELLED 단일 수렴 — *상태* 기준
  (파생 시점 pipeline.status)이지 *시간* 기준 아님.
- **cancel/drain 매트릭스**(정본): BLOCKED/READY(전 kind)→즉시 CANCELLED · CONDITION_CHECK
  WAITING_EXTERNAL→즉시 CANCELLED(drain 대상 없음) · **DISPATCHING TF→즉시 CANCELLED(handle 적재 여부
  무관 — RUNNING 승격 전이라 drain 안 함; 늦게 적재된 job_id는 버려져 orphan)** · **RUNNING TF→drain(job_id
  영속, 자연 terminal까지 폴링; forward edge만 gate)**. drain 중 실제 실패는 사실대로 마감(fail_count++)하되
  pipeline은 CANCELLED 수렴.

### S6 — 동시성 모델
- **4값 구분 시각화**(가장 혼동되는 부분):
  - __workerPoolSize (M)__ = 고정 worker 풀 크기 = **동시성 hard cap**(IM 보호; 배포 설정, settings API 비편집·비노출).
  - __slotCap (N)__ = BFF 제출 throttle(slotCap ≈ workerPoolSize; pubsub 큐 얕게; **soft target** — COUNT→admit
    read-then-act라 leader 단일성 의존, CAS 불변식 아님).
  - __slotCap × maxFailCount__ = retry/orphan worst-case **제출량 sizing 값**(큐로 흘러드는 총량; 동시 실행 상한 아님).
  - __max_external_calls_per_tick__ = tick당 poll/check 발사 상한(**dispatch 제외** — slotCap admission으로 제한).
- **fail-count 가산 매트릭스**(정본; codex 요청): TERRAFORM_JOB poll 호출 오류=**미가산**(잡 못 읽음≠잡 실패) ·
  TERRAFORM_JOB dispatch 실패(IM_REJECTED/recovery/EXECUTION_TIMEOUT/JOB_FAILED)=가산 · CONDITION_CHECK
  CHECK ERROR/CALL_TIMEOUT(비-backpressure)=가산 · NOT_MET=미가산 · backpressure(전부)=미가산 ·
  HANDLER_NOT_FOUND=fail-count 미소모(영구 실패) · 취소 정리=미가산.
- __maxFailCount (K)__ 정의: TERRAFORM_JOB=초기 dispatch 포함 최대 attempt 수(총 attempt ≤ maxFailCount, 재dispatch ≤ maxFailCount − 1) /
  CONDITION_CHECK=비-backpressure CHECK ERROR **또는 CALL_TIMEOUT** 허용 횟수.
- **slotCap↔execution-timeout 결합** 경고(slotCap ≫ workerPoolSize이면 큐 대기가 timeout 경과에 포함돼 오발).

### S7 — tick 실행 모델 (결정 6)
- **단일 writer 도식**(S2 axiom의 deep dive): 상태 전이 tx(tick) = pipeline/task 상태 + pipeline_event +
  attempt 생애주기 경계(dispatch 시 생성·terminal 시 마감) / 호출 스레드 tx = task_check 관측 + attempt.response.
- D-T1~T7 카드: T1 tick주기≠호출deadline · T2 비블로킹 async 발사 · T3 per-call deadline **전역+TaskKind
  오버라이드**(task별 아님·row/snapshot 비저장) · T4 관측=실행주체/상태=tick · T5 DISPATCH PENDING 선기록
  ("시도 vs 미시도"; CHECK은 RLE라 PENDING 없음) · T6 장시간 check 별도 상태 없음("확인 중"=DISPATCH
  api_result=PENDING / CHECK은 nextCheckAt 파생) · T7 max_external_calls_per_tick.
- __next_check_at__ writer 규칙: **일반 발사=tick**이 last_checked_at·next_check_at 함께 기록 / **backpressure
  재설정=호출 스레드**(상태 전이 아닌 스케줄 힌트).

### S8 — dispatch·멱등성·복구 (crash & N-pod)
- **dispatch 5단계 writer 분리**: 1 (tick) DISPATCHING CAS + attempt 생성 / 2 (호출스레드) DISPATCH PENDING
  선기록 / 3 호출 / 4 (a)task_check 관측 always 기록 (b)response 채택 CAS(`response IS NULL AND finished_at
  IS NULL AND status=DISPATCHING`) / 5 (다음 tick) RUNNING CAS.
- **at-least-once + idempotency-by-construction**: worker dedup 없음 → 중복 무해(멱등 apply). "이미 원하는
  상태=성공"(INSTALL 존재=성공/DELETE 부재=성공; **DELETE not-found 함정** — destroy가 "없음"을 에러로
  던지면 crash 재dispatch가 멀쩡한 삭제를 FAILED로 종결). 멱등은 BFF가 검증하는 *사실*이 아니라 task 등록
  *계약*(O28).
- **crash-point 매트릭스**(승격; orch §3.3): tick 도중·dispatch 후 response 전·poll/check 응답 후 기록 전·
  실행주체 사망·알림 전·advisory lock 보유 중·장시간 outage(catch-up burst를 slotCap·max_external_calls가 wave로 흡수).
- **N-pod Q&A**(승격): tick 리더(advisory lock, failover ≤30초) · split-brain(lock 세션 유실로만·무해: CAS+반복
  안전) · Admin API(stateless, 어느 pod든) · **Notifier(리더 불요 — `FOR UPDATE SKIP LOCKED` 분담)** ·
  rolling deploy(snapshot이 구성 박제).
- **crash-recovery & maxFailCount headroom**: response 미영속 DISPATCHING → recovery_timeout 후 재dispatch(좁은
  pre-persist crash 창이 정상 job fail_count 1 소비 → maxFailCount를 IM 최소+여유로).
- **backpressure(429/503)**: fail_count 미소모; **dispatch=Retry-After 있으면 그만큼, 없으면 다음 tick**
  (cadence 하한 없음·동일 logical attempt 재사용) / **poll·check=max(Retry-After, kind cadence)**.

### S9 — errorCode 분류
- 8종 카탈로그 표 + **저장위치 3분류 매트릭스**:
  - ① attempt 귀속 → `task_attempt.error_code`: EXECUTION_TIMEOUT·DISPATCH_NO_RESPONSE·IM_REJECTED·JOB_FAILED.
  - ② task_check 관측 → `task_check.error_code`: CHECK_ERROR · **CALL_TIMEOUT(dispatch/poll/check 공통 — 호출
    1회 실패이지 attempt 직접 실패 아님)**.
  - ③ tick 파생: TTL_EXPIRED(status=EXPIRED 파생, 행 없음) · HANDLER_NOT_FOUND(synthetic task_check 1행:
    kind=CHECK·name="orchestrator.handler.resolve"·api_result=ERROR·observed=null·started_at=checked_at=tick·
    poll_count=1·latency_ms=null).
- __fail_reason__: pipeline FAILED 수렴 원인 `{task_id, error_code}`(snake; CANCELLED/DONE/RUNNING=null).
  API DTO는 camel `{taskId, errorCode}`(ADR-019 경계).
- __outcome__ 파생 미니표: result=OK→SUCCEEDED / result=FAIL ∧ EXECUTION_TIMEOUT→EXECUTION_TIMEOUT /
  result=FAIL ∧ (null 또는 ≠EXECUTION_TIMEOUT)→FAILED(취소정리·HANDLER_NOT_FOUND의 error_code=null도 FAILED).

### S10 — Definition·Snapshot (결정 7)
- **2-layer 도식**: 코드 default recipe(`(type,provider)`당 1개) → 생성 시 `pipeline_def_snapshot` 박제
  (write-once, 1:1, spec jsonb) → 재현 권위. "코드=실행 권위 / snapshot=이력 권위."
- **절연 범위**: default release를 올려도 in-flight·과거 run의 *구성*(task 목록·순서·ttl·polling·
  execution_timeout·max_fail_count)은 불변; 단 task class 코드 동작은 현재 배포본을 탄다(절연 대상 아님).
- **handler 자동 레지스트리**: 안정 key() 선언·자동 수집(중복 키=부팅 실패)·class 참조(컴파일 안전)·**2단계
  검증 — pre-deploy CI 게이트가 authoritative**(배포 *전* prod DB non-terminal handler_key 검사; 부팅 assert는
  defense-in-depth — 배포를 막으려면 배포 후인 부팅이 아니라 배포 전이어야 함)·런타임 미해결 시
  HANDLER_NOT_FOUND. 비호환 변경만 `_V1/_V2` append-only(호환 bugfix는 현재 코드).

### S11 — API 표면
- **DTO 빌딩블록 표**(api §0): PipelineSummary·Pipeline·Task·Attempt·Check·PipelineEvent 필드. **파생 강조**:
  - __progress{done,total}__: `total`=task 행 수(snapshot 길이·고정), `done`=COUNT(DONE). **분수는 RUNNING
    진행 지표일 뿐 — terminal 판정은 `status`가 권위**(CANCELLED/FAILED는 done<total로 남는 게 정상).
  - __latestCheck__: started_at 최대 task_check(현재 열린 run; pollCount·마지막 checkedAt 포함).
  - __outcome__: 저장값 아닌 result+error_code 파생(S9).
- **엔드포인트**: 보드 GET·상세 GET·task 타임라인 GET·이벤트 GET / cancel POST(멱등 no-op)·retry POST
  (`{created:true|false}` — 기존 non-terminal 반환) / settings GET·PUT. 경로 포맷(admin=`/admin/...`·트리거=
  `/integration/api/v1/...`), Spring Pageable(page·size·sort), camelCase.

### S12 — 운영·알림
- **설정표(R5 "설정은 데이터다")** — 대부분 런타임 DB 설정(재배포 불요) / **workerPoolSize는 배포 설정(settings API
  비편집·비노출)**. 기본값은 예시임을 명시(workerPoolSize 예 4~8, slotCap 초안 3, max_external 50, retention 90일).
- **적용 시점**: 전역 노브=즉시 / task별(ttl·polling·execution_timeout·max_fail_count)=생성 시 frozen이라
  이후 run만 / workerPoolSize=재배포.
- 알림 2종(WORKER_OUTAGE_SUSPECTED critical·QUEUE_WAIT_EXCEEDED) + **transactional outbox**(상태 변경과 같은
  tx → 유실 없음; at-least-once, 인앱 effectively-once).
- **장애 신호 해석 표** + **운영자 대시보드 멘탈모델**(workerPoolSize·slotCap≈workerPoolSize·큐 깊이·timeout rate만 보면 됨).
- **없는 버튼**: force-check 없음·task 재시작 없음·pause/resume 없음(circuit breaker 제거). 제어=cancel·retry뿐.

### S13 — 요구사항 충족
- FR-1~8 / NFR-1~8 / PR-1~7 매핑 표 3개.

### S14 — 용어 사전
- §7 인벤토리를 카테고리 정렬로 등재. 각 항목: 용어 · 1줄 정의 · (필요시) 상세 2~3줄 · 관련 용어 링크.
- 본문 hover 툴팁 = 이 사전 "1줄 정의", 클릭 시 사전 항목으로 점프.

---

## 4. 사용성·인터랙션 규약 (핵심 요구사항)

### 4.1 용어 표시 — 점선 밑줄 + hover 툴팁
- **저작 표기 vs 렌더**: 스펙/소스에서 `__term__`는 *저작 표기*(이 토큰을 용어로 마킹하라는 뜻)다. HTML은
  밑줄 문자가 아니라 `<span class="term" data-term="key">용어</span>` + CSS **점선 밑줄**(dotted underline)
  + `cursor: help`로 렌더한다. 화면에 `_`가 보이면 안 된다.
- **hover 툴팁**: 마우스 오버 시 그 용어의 **1줄 정의**를 작은 카드로. 순수 CSS+소량 JS. 위치는 뷰포트 경계
  회피, 폭 제한, 최대 3~4줄. 내용 = 정의 1줄 + "자세히 →"(글로서리 점프).
- **접근성(codex 지적 반영)**: 키보드 포커스(`tabindex=0`)에서도 노출 · `role="tooltip"` +
  `aria-describedby` · **Escape로 닫기** · `prefers-reduced-motion` 존중 · **터치/모바일**: hover가 없으므로
  tap=툴팁 토글(다시 tap 또는 바깥 tap으로 닫기) · **no-JS 폴백**: JS 없으면 term은 글로서리로 가는 일반
  앵커 링크로 동작(밑줄 유지, 클릭 시 정의로 점프).
- **단일 출처 원칙**: 툴팁 텍스트와 글로서리 정의는 **같은 JS `GLOSSARY` 객체**에서 렌더. 본문엔 `data-term`
  키만. → 정의 1곳 수정이 모든 hover에 일관 반영(cross-doc 모순 재발 방지).

### 4.2 동음이의어 namespace (codex 지적)
같은 표시어가 문맥에 따라 다른 뜻이면 **글로서리 키를 namespace**한다(표시 텍스트는 동일하되 `data-term`이
구분):
- `state.running.task` (task RUNNING — job 폴링 중) vs `state.running.pipeline` (pipeline RUNNING — 진행 중).
- `state.failed.task` vs `state.failed.pipeline`(파생 terminal).
- `check.kind` (task_check.kind=CHECK — TF job poll + condition 둘 다) vs `check.verb`(조건 확인 호출 행위).
- `pending.apiresult` (api_result=PENDING — DISPATCH 선기록) — 상태 아님.
- `col.status`/`col.type`/`col.name`/`col.response` (DB 컬럼) — 각 테이블별 의미 주석.
본문 저작 시 올바른 namespace 키를 고른다(리뷰 체크 항목).

### 4.3 alias 해소
snake_case·camelCase·한국어 라벨·enum 값이 **같은 개념**이면 한 정의로 모은다: 글로서리 항목에 `aliases:
[poll_count, pollCount, 폴 수]` 식으로 별칭을 달고, 어느 별칭의 `data-term`이든 같은 항목을 가리킨다. 의미가
*다르면*(예 last_activity_at vs started_at) 별도 항목으로 분리.

### 4.4 네비게이션·디자인 시스템
- 좌측 목차 scroll-spy(현재 섹션 하이라이트), 클릭 시 smooth scroll + URL 해시. "맨 위로" 부유 버튼.
  글로서리에서 "본문으로".
- **타이포**: 시스템 폰트 스택(웹폰트 0). 본문 16px/1.7, 코드 `ui-monospace`.
- **컬러**: 라이트 기본 + 다크 토글(`prefers-color-scheme` + 수동 토글, localStorage 기억). 상태 의미색
  토큰(RUNNING 파랑·DONE 초록·FAILED 빨강·CANCELLED 회색·WAITING 노랑·EXPIRED 주황) 일관.
- **다이어그램**: 외부 이미지 0 — CSS 박스/화살표 또는 `<pre>` ASCII(병기). 인라인 SVG만.
- **반응형**: 데스크톱(사이드바 고정) / 모바일(상단 접이식). **펼치기/접기 대상 명시**(codex): 대형
  다이어그램·매트릭스·crash 매트릭스는 `<details>`로 접힘 기본, "다이어그램 펼치기/접기"가 일괄 토글.
- **접근성**: 대비 AA·키보드 내비·`aria-*`·skip-link.
- **인쇄**: `@media print`로 사이드바 숨김·`<details>` 강제 펼침·툴팁 정의를 각주화(인쇄본도 용어 이해 가능).

### 4.5 비범위(YAGNI)
- 검색창·다국어·서버·빌드·프레임워크. 단일 정적 HTML로 끝낸다.

---

## 5. HTML 단독 완결성 — 커버리지 체크리스트

HTML만 읽고 답할 수 있어야 하는 질문(리뷰에서 본문 존재 검증):

1. 왜 워크플로 엔진(Temporal 등)을 안 쓰나? → S3
2. BFF가 죽었다 살아나면 진행 중 run은? **리더 pod가 tick 도중 죽으면 누가·얼마 만에 리더가 되나?** → S8(crash 매트릭스·failover ≤30초·split-brain)
3. 같은 dispatch가 두 번 나가면 인프라가 망가지나? → S8(멱등)
4. 동시에 terraform 몇 개까지 도나? 그 상한은 무엇이 보장하나? → S6(workerPoolSize hard cap; slotCap은 throttle)
5. 폴링을 1000번 했는데 task_check 행이 1000개인가? → S4(RLE, poll_count)
6. 취소했는데 in-flight job은? DISPATCHING이면? RUNNING이면? → S5(cancel/drain 매트릭스)
7. handler 코드가 사라진 채 배포되면? → S10(CI 게이트 authoritative + 런타임 HANDLER_NOT_FOUND)
8. 실패 사유는 어디에 저장되나? → S9(3분류)
9. 재시도하면 처음부터 다시 도나? → S2/S11(새 run; 완료분은 terraform 수렴 no-op)
10. 설정을 바꾸면 진행 중 run에 적용되나? → S12(전역 노브 즉시 / task별 frozen은 이후 run만 / workerPoolSize는 재배포)
11. **같은 target에 두 사람이 동시에 [설치 시작]을 누르면?** → S2c(23505 → 기존 non-terminal 반환; 가장 중요한 외부 계약)
12. **보드에 DONE 3/5 인데 status=CANCELLED면 고장인가?** → S11(progress 분수는 RUNNING 지표·status가 권위)
13. **한 외부 호출이 얼마나 오래 걸려도 되나? tick 주기와 같은가?** → S7(per-call deadline ≠ tick, D-T1)
14. **운영자는 평소 무엇을 보면 되나?** → S12(workerPoolSize·slotCap≈workerPoolSize·큐 깊이·timeout rate)
15. **취소 중인데 task가 실패하면 pipeline은 FAILED인가 CANCELLED인가?** → S5(CANCELLING precedence — CANCELLED 단일 수렴)

---

## 6. 작업 순서

1. **이 스펙 md를 codex+opus 병렬 리뷰** → 섹션·용어 누락·정확성·모호성 수집 → 수정 → 재리뷰(안정까지 반복).
2. 스펙 안정 후 **글로서리 데이터(`GLOSSARY` JS 객체) 확정**(모든 정의의 단일 출처; namespace·alias 포함).
3. **HTML 생성**(단일 파일, 인라인 CSS/JS).
4. HTML을 codex+opus 리뷰(정확성·완결성·사용성·a11y) → 수정 반복.

---

## 7. 용어 사전 — 마스터 인벤토리 (전수)

> HTML S14 + 모든 hover의 원천. `[키] 용어 — 1줄 정의`. **누락 0이 목표**(사용자: "지나치더라도 모두").
> namespace가 필요한 동음이의어는 키에 표기. enum *값*·원시 컬럼·DTO 필드·결정 라벨·open-question·제거 용어
> 까지 전부 등재.

### 7.1 시스템·계층
- `bff` **BFF** (Backend-for-Frontend) — Admin 콘솔 전용 백엔드; 파이프라인 오케스트레이션이 사는 계층. 이제 DB+백그라운드 루프 보유(stateless proxy 아님).
- `csr` **CSR** (Client-Side Rendering) — 브라우저 클라이언트 렌더. "브라우저 세션"의 주체.
- `ssr` **SSR** (Server-Side Rendering) — 서버 렌더링(대비 용어).
- `im` **Infra Manager (IM)** — Terraform run API 제공자(비동기, job_id 반환). pubsub로 worker 실행.
- `backend-manager` **Backend Manager** — 연동·승인·target source 도메인 상태 소유.
- `terraform-worker` **TerraformWorker** — 실제 terraform 실행 k8s pod. **dedup 없음**.
- `admin-console` **Admin 콘솔** — 파이프라인 생성·관측·제어 UI. UI=API 동일 표면(계층 규칙).
- `terraform` **Terraform** — IaC 실행 엔진. apply 멱등이 idempotency 계약의 토대.
- `iac` **IaC** (Infrastructure as Code) — 코드로 인프라 관리. terraform이 그 도구.
- `job-id` **job_id (terraform_job_id)** — IM이 요청별 서버측 발급하는 식별자. 재dispatch=새 job_id.
- `pubsub` **pubsub** — IM→worker 디스패치 큐. 초과 제출 흡수.
- `k8s-pod` **k8s pod** — worker 실행 단위(쿠버네티스 파드).
- `op.im-apply` **im.terraformApply** — dispatch가 호출하는 IM run operation(task_check.name 예).
- `op.im-jobstatus` **im.jobStatus** — poll이 호출하는 IM 상태 operation(task_check.name 예).

### 7.2 코어 아키텍처
- `reconciler` **reconciler** — 30초 tick으로 due task를 전진시키는 단일 논리 스케줄러. task를 전진시키지 "파이프라인을 돌리"지 않음.
- `pipeline-orchestrator-module` **pipeline-orchestrator 모듈** — 상태기계가 사는 BFF 모듈(엔진/브로커/별도 서비스 없음).
- `tick` **tick** — reconciler 깨어나는 고정 주기(기본 30초). 호출 deadline과 별개 시계(D-T1).
- `durable-state-machine` **durable state machine** — DB row로 영속되는 상태기계. 메모리 의존 0 → 재시작 안전.
- `advisory-lock` **advisory lock** — 다중 replica 중 한 pod만 tick 돌리는 리더 선출 장치.
- `pg-advisory` **pg_try_advisory_lock** — advisory lock의 Postgres 함수(session-scoped — 세션 끊기면 자동 해제).
- `leader-election` **리더 선출** — advisory lock 보유 pod가 리더. failover 자동 ≤30초.
- `cas` **CAS** (Compare-And-Swap) — 조건부 갱신(WHERE에 기대 prior 상태). 낡은/중복 writer는 0행. 다중 replica 안전.
- `cas-zero-row` **CAS 0행** — 기대 prior와 불일치라 갱신 안 됨 = no-op(멱등 중단·terminal 부활 자동 차단).
- `replica` **replica** — BFF 다중 인스턴스(pod). 상태는 DB에만.
- `single-writer` **단일 writer** — 상태 전이=tick만, 관측(task_check)·산출(attempt.response)=호출 스레드(D-T4).
- `derived-state` **상태 파생** — pipeline 상태는 task에서 파생(우선순위 순서 평가).
- `notifier` **Notifier** — `notified_at IS NULL` 이벤트를 소비해 인앱 알림 발송하는 BFF 루프. **리더 불요**(SKIP LOCKED 분담).
- `for-update-skip-locked` **FOR UPDATE SKIP LOCKED** — N pod가 리더 없이 outbox 행을 나눠 처리하는 행 잠금절.
- `architecture-invariant` **아키텍처 불변식** — 구현(VT·HTTP client)과 무관하게 지켜야 하는 설계 속성(예 비블로킹 async 발사).

### 7.3 작업 모델
- `pipeline` **pipeline (run)** — 한 target의 설치/삭제 실행 1건. type×provider. 실행 단위=target_source_id.
- `task` **task** — pipeline 내 순차 chain 단계. seq 순서·9상태.
- `task-kind` **TaskKind** — task 흐름 shape. v1 2종(TERRAFORM_JOB·CONDITION_CHECK).
- `flow-shape` **흐름 shape** — kind가 정하는 dispatch/poll 패턴(slot 소비 여부 포함). task마다 늘리지 않음.
- `terraform-job` **TERRAFORM_JOB** — dispatch→job_id→poll→terminal. IM slot 소비. attempt 있음.
- `condition-check` **CONDITION_CHECK** — dispatch 없이 조건 MET까지 폴링. attempt 없음. slot 비소비.
- `general-job` **GENERAL_JOB** — 비-terraform 비동기 job kind. **v2 defer**.
- `reconnect-type` **RECONNECT** — v2 3번째 pipeline type(GENERAL_JOB와 함께 도입). v1 아님.
- `handler-key` **handler_key** — 안정 코드 class 식별자(예 `aws.tf.network`). reconciler 라우팅 키. 미해결=HANDLER_NOT_FOUND.
- `handler` **handler (PipelineHandler)** — task 흐름 구현 코드 class. 안정 key() 선언.
- `registry` **레지스트리(HandlerRegistry, 자동)** — 모든 handler 빈을 주입받아 key()→handler 맵 부팅 시 파생(수동 목록 없음·중복 키=부팅 실패).
- `stable-key` **stable key / key()** — handler가 선언하는 클래스명 무관 안정 키(rename해도 불변; 키 문자열 단일 출처).
- `kind-method` **kind()** — handler가 선언하는 흐름 shape 값(row에 비정규화 — slot COUNT 쿼리용).
- `task-definition` **TaskDefinition** — recipe 내 한 task 정의(TaskKind 중 하나).
- `task-catalog` **Task catalog (결정 7.1 layer)** — task=코드 class 레이어(stable key 보유). recipe와 구분.
- `seq` **seq** — task 순서 번호. predecessor(seq-1) DONE이면 승격. `unique(pipeline_id, seq)`.
- `predecessor` **predecessor** — 직전 seq task. DONE이어야 BLOCKED→READY.
- `recipe` **recipe (default recipe)** — `(type,provider)`당 코드 default 정의(release version 1개). 생성 시 snapshot 박제.
- `pipeline-definition` **PipelineDefinition** — recipe 코드 객체. key·version·type·provider·taskDefinitions[].
- `target-source` **target source** — 설치/삭제 대상. 약 2000개. 1 pipeline : 1 target.
- `attempt` **task_attempt (attempt)** — dispatch action 생애주기 1행. dispatch당 1개. side-effect 추적.
- `logical-attempt` **logical attempt** — 동일 attempt 단위. 429/503 재호출은 같은 logical attempt 재사용(새 행 없음).
- `task-check` **task_check (check)** — 외부 호출 관측 장부. DISPATCH=호출당 1행 / CHECK=관측 run당 1행.
- `dispatch` **dispatch** — IM run API 호출로 job_id 획득(side-effect). TERRAFORM_JOB만.
- `poll` **poll** — dispatch한 job 상태를 cadence마다 반복 확인(read-only, kind=CHECK).
- `check.verb` **check(행위)** — CONDITION_CHECK 조건 확인 호출(read-only, kind=CHECK).
- `observation-run` **관측 run** — RLE 단위. 연속 동일 (api_result,observed,error_code) 폴을 1행으로 접고 poll_count++.
- `external-handle` **external_handle** — task_check가 확인한 id의 참조(home은 attempt.response).
- `handle` **handle** — dispatch 산출 식별자(terraform=job_id). attempt:handle = 1:1.
- `fan-out` **fan-out** — 한 dispatch가 handle 여러 개 반환. **금지**(독립 작업이면 task 분리).

### 7.4 동시성
- `workerpoolsize` **workerPoolSize (M)** — 고정 worker 풀 크기 = **동시성 hard cap**. 배포 설정(settings API 비편집·비노출). 예 4~8.
- `slotcap` **slotCap (N, 구 N-cap)** — BFF 제출 throttle(slotCap ≈ workerPoolSize). pubsub 큐 얕게. soft target(동시성 안전장치 아님). 초안 3.
- `slot` **slot** — TERRAFORM_JOB이 DISPATCHING/RUNNING 동안 점유하는 admission 단위. slotCap개 한도.
- `slot-queue` **slot 큐** — admit 못 받은 READY TERRAFORM_JOB(별도 상태 없이 READY∧kind=TF로 표현; 순번=admission 순서 파생).
- `admission` **admission** — READY TF를 COUNT(DISPATCHING|RUNNING) < slotCap일 때만 DISPATCHING 승격.
- `read-then-act` **read-then-act** — COUNT 읽고 admit하는 비원자 패턴이라 slotCap이 soft(leader 단일성 의존).
- `soft-target` **soft target** — CAS 불변식이 아니라 근사 목표(slotCap). split-brain 일시 초과는 풀이 흡수.
- `nk` **slotCap × maxFailCount (구 N·K)** — retry/orphan worst-case 제출량 sizing 값(큐로 흘러드는 총량; 동시 실행 상한 아님).
- `maxfailcount` **maxFailCount (K, = max_fail_count 컬럼)** — 최대 실패 허용. TF=초기 dispatch 포함 최대 attempt 수 / CONDITION_CHECK=비-backpressure CHECK ERROR·CALL_TIMEOUT 허용 횟수.
- `fail-count` **fail_count** — "성공하지 못한 시도 횟수". maxFailCount 도달 시 FAILED. backpressure·NOT_MET·poll 오류 미가산.
- `max-external-calls` **max_external_calls_per_tick** — tick당 poll/check 발사 상한(기본 50). **dispatch 제외**. burst 완화.
- `split-brain` **split-brain** — lock 세션 유실로 두 pod가 잠시 둘 다 리더. 무해(workerPoolSize가 cap·CAS 수렴).
- `catch-up-burst` **catch-up burst / wave** — outage 복귀 첫 tick들의 밀린 작업 일괄 발화. slotCap·max_external_calls가 wave로 배수.

### 7.5 정합성·신뢰성
- `idempotency` **멱등성** — 중복 실행이 결과를 손상 안 함. 모든 dispatch task 필수 계약.
- `idempotency-by-construction` **idempotency-by-construction** — exactly-once 기계 대신 모든 dispatch를 멱등으로 만들어 at-least-once 안전화.
- `at-least-once` **at-least-once** — 최소 1회(중복 가능). dispatch·알림 전달 모델.
- `exactly-once` **exactly-once** — 정확히 1회(채택 안 함 — 멱등으로 대체).
- `dual-write-gap` **dual-write 갭 / crash window** — dispatch 호출 후 response 영속 전 죽는 좁은 창. 멱등이 흡수.
- `pre-persist-crash` **pre-persist crash** — response 영속 *직전* crash. 정상 job fail_count 1 소비 → maxFailCount headroom 근거.
- `write-once` **write-once** — attempt.response·snapshot은 1회 기록 후 불변(재시도=새 attempt=새 response).
- `late-response` **늦은 response** — cancel/terminal 후 도착한 dispatch 응답. CAS guard로 무시.
- `guarded-write` **guarded write** — prior 상태를 WHERE에 실은 CAS write.
- `backpressure` **backpressure** — IM 429/503. 실패 아님 → requeue, fail_count·errorCode 미소모.
- `retry-after` **Retry-After** — 429/503 재시도 지연 힌트. dispatch는 cadence 하한 없이 이걸로(없으면 다음 tick) 미룸.
- `cadence` **cadence** — 폴링 주기(job-poll 30~60초 / condition ≥10분 guard).
- `transactional-outbox` **transactional outbox** — 상태 변경과 같은 tx에 이벤트 기록 → 유실 없음(pipeline_event).
- `effectively-once` **effectively-once** — at-least-once 전달 + read-dedup(event id)로 인앱 중복 제거.
- `crash-recovery` **crash recovery** — response 미영속 DISPATCHING을 recovery_timeout 후 재dispatch.
- `fresh-read` **fresh 상태 재독** — timeout 판정 전 최신 상태를 읽어 이미 완료된 작업을 timeout으로 실패시키지 않음(완료관측 > timeout).
- `orphan` **orphan job** — BFF가 추적 끊은 in-flight job(crash 재dispatch·취소·HANDLER_NOT_FOUND). 멱등이라 무해; worker terraform 자연 종료가 bound.

### 7.6 시간·생명주기
- `execution-timeout` **execution timeout** — dispatch→terminal 경과 상한(기본 30분). 초과 시 attempt 실패(흡수).
- `ttl` **TTL (WAIT_EXTERNAL)** — CONDITION_CHECK 총 체류 상한(기본 7일). 초과 시 EXPIRED→pipeline FAILED.
- `per-call-deadline` **per-call HTTP deadline** — 단일 호출 타임아웃(전역 30초 + TaskKind 오버라이드). tick 주기와 별개.
- `dispatch-recovery-timeout` **dispatch 복구 timeout** — response 없는 DISPATCHING 재dispatch 기준(기본 5분).
- `polling-guard` **polling guard (polling_interval)** — CONDITION_CHECK 최소 cadence(≥10분, 관리자 조정). TF는 비움.
- `next-check-at` **next_check_at** — 다음 폴 예정 시각(스케줄 힌트, 상태 전이 아님). **일반=tick / backpressure 재설정=호출 스레드**.
- `last-checked-at` **last_checked_at** — tick이 task를 마지막 서비스(발사)한 시각. 기아 방지 정렬 키(ASC NULLS FIRST).
- `deadline-at` **deadline_at** — 현재 적용 timeout 절대 만료 시각(reconciler 파생값, 내부 비노출).
- `last-activity-at` **last_activity_at** — 마지막 상태 전이 시각. 보드 기본 정렬 키. (started_at과 다름.)
- `col.started-at` **started_at** — (pipeline)RUNNING 진입=생성 시각·overlap 필터 기준 / (task)BLOCKED 벗어난 시각 / (attempt)dispatch 시작 / (task_check)run 첫 발사.
- `col.finished-at` **finished_at** — terminal 도달 시각(pipeline/task/attempt 각 grain).
- `col.created-at` **created_at** — pipeline 생성 시각(생성 즉시 RUNNING이라 started_at과 동일).
- `col.checked-at` **checked_at** — task_check run 마지막 관측 시각(DISPATCH PENDING이면 null).

### 7.7 상태 enum (task)
- `state.blocked` **BLOCKED** — 의존 미해소(predecessor 미완). reconciler가 안 봄.
- `state.ready` **READY** — 전진 가능. READY∧TF=slot 큐(WAITING_SLOT 없음).
- `state.dispatching` **DISPATCHING** — dispatch 발사~response 적재. slot 점유.
- `state.running.task` **RUNNING (task)** — job_id 폴링 중. slot 점유.
- `state.waiting-external` **WAITING_EXTERNAL** — CONDITION_CHECK 조건 폴링 중.
- `state.done` **DONE** — 성공 terminal.
- `state.failed.task` **FAILED (task)** — 실패 terminal(maxFailCount 소진/HANDLER_NOT_FOUND 등).
- `state.expired` **EXPIRED** — WAIT_EXTERNAL TTL 초과(task). → pipeline FAILED 파생.
- `state.cancelled.task` **CANCELLED (task)** — 폴링할 handle 없는 task 중단 terminal.
- `task-terminal` **task terminal(4종)** — DONE·FAILED·EXPIRED·CANCELLED.

### 7.8 상태 enum (pipeline) + cancel
- `state.running.pipeline` **RUNNING (pipeline)** — 진행 중.
- `state.cancelling` **CANCELLING** — 중단 진행. 파생 최우선. forward edge gate, in-flight drain.
- `state.done.pipeline` **DONE (pipeline)** — 전 task DONE.
- `state.failed.pipeline` **FAILED (pipeline)** — FAILED/EXPIRED task 파생.
- `state.cancelled.pipeline` **CANCELLED (pipeline)** — 모든 in-flight drain 완료.
- `pipeline-terminal` **pipeline terminal(3종)** — DONE·FAILED·CANCELLED(EXPIRED 없음 — task 전용).
- `cancelling-precedence` **CANCELLING precedence** — 파생 ① 최우선. 취소 중 FAILED여도 CANCELLED 단일 수렴(상태 기준).
- `forward-edge` **forward edge** — readying·dispatching·retrying 전진 전이. CANCELLING에서 gate됨.
- `drain-edge` **drain edge** — RUNNING TF의 terminal까지 폴링. gate 안 함.
- `drain` **drain** — 죽일 수 없는 in-flight job(RUNNING TERRAFORM_JOB, job_id 영속)을 자연 terminal까지 폴링.
- `gate` **gate** — CANCELLING이 forward edge를 막음(전진 불가).
- `terminal` **terminal(일반)** — 나가는 전이 없는 상태("terminal은 terminal"). task 4종/pipeline 3종.

### 7.9 관측·결과 enum
- `api-result` **api_result** — 호출 결과(PENDING|OK|ERROR).
- `apiresult.pending` **PENDING** — DISPATCH 선기록("시도했으나 결과 미정"). 상태 아님.
- `apiresult.ok` **OK** — 호출 성공.
- `apiresult.error` **ERROR** — 호출 실패/관측(backpressure도 ERROR·error_code=null).
- `observed` **observed** — 원시 관측값. canonical(통합 enum 저장 안 함).
- `observed.running` **RUNNING (observed)** — poll: 잡 진행 중.
- `observed.succeeded` **SUCCEEDED (observed)** — poll: 잡 성공.
- `observed.failed` **FAILED (observed)** — poll: 잡 자체 실패(→JOB_FAILED).
- `observed.met` **MET** — condition 충족.
- `observed.not-met` **NOT_MET** — condition 미충족("아직"·미가산).
- `result-okfail` **result (OK|FAIL)** — attempt terminal 결과. EXECUTION_TIMEOUT은 별도 값 아닌 error_code.
- `outcome` **outcome** — API 파생 표현(SUCCEEDED|FAILED|EXECUTION_TIMEOUT). result+error_code 파생(저장값 아님).
- `poll-count` **poll_count (pollCount)** — 관측 run에 접힌 폴 수(RLE). NOT_MET 1000폴=1000.
- `rle` **RLE** (Run-Length Encoding) — 연속 동일 관측을 1행+count로 접기. CHECK에만(DISPATCH는 호출당 1행).
- `latency-ms` **latency_ms (latencyMs)** — 마지막 폴 지연(overwrite, 누적/평균 아님). DISPATCH PENDING·synthetic은 null.

### 7.10 errorCode 카탈로그
- `ec-call-timeout` **CALL_TIMEOUT** — 어느 호출이든 1회 timeout(dispatch/poll/check 공통). task_check 귀속. attempt 직접 실패 아님.
- `ec-execution-timeout` **EXECUTION_TIMEOUT** — dispatch→terminal 미도달(30분+). attempt 귀속.
- `ec-ttl-expired` **TTL_EXPIRED** — WAIT_EXTERNAL TTL 초과. status=EXPIRED 파생(행 없음).
- `ec-im-rejected` **IM_REJECTED** — dispatch 하드 거부(비-backpressure). attempt 귀속.
- `ec-check-error` **CHECK_ERROR** — check 관측 실패(비-backpressure). task_check 귀속.
- `ec-dispatch-no-response` **DISPATCH_NO_RESPONSE** — recovery_timeout까지 응답 미영속. attempt 귀속(대응 DISPATCH PENDING 잔류).
- `ec-handler-not-found` **HANDLER_NOT_FOUND** — handler_key 미해결. 즉시 FAILED·fail_count 미소모. synthetic task_check 1행.
- `ec-job-failed` **JOB_FAILED** — TF poll이 job 자체 FAILED 관측. errorCode는 attempt 귀속(관측은 task_check.observed=FAILED).

### 7.11 Definition·Snapshot
- `snapshot` **pipeline_def_snapshot** — 생성 시 박제한 실행 구성(write-once, 1:1). 재현 권위.
- `definition-key` **definition_key** — recipe 식별자(예 AWS_INSTALL).
- `definition-version` **definition_version** — recipe 버전(불변; snapshot에만; **pipeline.definition_version 컬럼 제거**).
- `spec-jsonb` **spec (jsonb)** — snapshot의 resolve된 전체 recipe(name + 순서 있는 task 목록). snake_case.
- `frozen` **frozen(박제)** — task별 config(ttl·polling·execution_timeout·max_fail_count)를 생성 시 row에 고정.
- `code-is-authority` **코드=실행 권위** — 실행은 현재 배포 코드. snapshot=이력 권위.
- `release-version` **release version** — default recipe의 코드 릴리스 1개(다중 버전 공존 lifecycle 불요 — 7.4).
- `version-policy` **버전 정책(_V1/_V2)** — 비호환 동작 변경만 append-only `_V1/_V2`. 호환 bugfix는 현재 코드.
- `boot-assert` **부팅 assert** — 부팅 시 default recipe handler 등록 검증(defense-in-depth).
- `ci-gate` **pre-deploy CI 게이트** — 배포 *전* prod DB non-terminal handler_key 검증(authoritative — 배포 차단).
- `promotion` **promotion** — 배포 승격. CI 게이트는 promotion 전 실행.
- `defense-in-depth` **defense-in-depth** — 부팅 assert가 CI 게이트 뒤의 2차 방어.

### 7.12 알림·이벤트
- `pipeline-event` **pipeline_event** — 감사 로그 + 알림 outbox(append-only).
- `col.payload` **payload (jsonb)** — 이벤트 본문 저장. API `message`는 type별로 여기서 렌더(message는 저장 컬럼 아님).
- `col.notified-at` **notified_at** — Notifier가 찍는 발송 시각. `IS NULL`=미발송(outbox 커서).
- `event.type` **type (pipeline_event)** — 이벤트 종류 판별자(message 렌더 구동).
- `worker-outage` **WORKER_OUTAGE_SUSPECTED** — execution timeout 연속 시 systemic worker 장애 의심 롤업(critical).
- `queue-wait` **QUEUE_WAIT_EXCEEDED** — slot 대기 임계(기본 30분) 초과 알림.
- `retry-attempted` **RETRY_ATTEMPTED** — 충돌 반환(created=false) 경로에서 시도 사실 기록 이벤트.
- `severity` **severity (INFO|CRITICAL)** — pipeline_event 심각도.
- `actor` **actor (triggered_by)** — 행위 주체(human|system|ai). 감사·triggeredBy.
- `actor.human` **human** / `actor.system` **system** / `actor.ai` **ai** — actor 값 3종(ai는 향후 API principal).

### 7.13 데이터/계약 + 컬럼
- `jsonb` **jsonb** — Postgres JSON 컬럼(response·spec·payload·fail_reason).
- `snake-case` **snake_case** — DB 저장 표기. ↔ API DTO camelCase(ADR-019 경계).
- `camel-case` **camelCase** — API DTO 표기.
- `unique-constraint` **부분 unique 제약** — `unique(target_source_id) WHERE status NOT IN (DONE,FAILED,CANCELLED)`. target당 non-terminal 1건.
- `sqlstate-23505` **23505** — Postgres unique 위반 SQLSTATE. 계약: 에러 대신 기존 non-terminal 반환.
- `creation-contract` **생성 계약** — ①recipe resolve ②task row+snapshot 원자 ③23505→기존 반환. 통합 테스트 필수.
- `fail-reason` **fail_reason** — pipeline FAILED 수렴 원인 `{task_id, error_code}`(snake). CANCELLED/DONE/RUNNING=null.
- `col.error-detail` **error_detail** — task_attempt의 추가 실패 상세(error_code 옆).
- `col.error-code` **error_code** — 실패 사유 코드 컬럼(task_attempt·task_check 각각).
- `col.response` **response (jsonb)** — dispatch 원응답·handle home(TF {job_id}). write-once.
- `col.attempt-no` **attempt_no (attemptNo)** — attempt 재시도 순번("n번째 시도").
- `col.name` **name** — (task)표시 라벨(UX) / (task_check)호출 operation 식별자.
- `col.status` **status** — pipeline/task 현재 상태 컬럼(CAS 갱신).
- `col.type` **type (INSTALL|DELETE)** — pipeline 종류.
- `col.provider` **provider** — pipeline 대상 클라우드(enum 미고정 — CloudProvider 도메인).
- `col.target-source-id` **target_source_id** — 실행 단위 컬럼(1 pipeline:1 target, 생성 시 고정).
- `id-cols` **id / pipeline_id / task_id** — PK 및 부모 FK. pipeline_event.pipeline_id는 nullable(global 이벤트).
- `depends-on-removed` **depends_on(제거)** — 의존 배열 대신 seq predecessor + unique(pipeline_id,seq)로 대체.

### 7.14 API 표면
- `dto.pipeline-summary` **PipelineSummary** — 보드 행 DTO(id·type·provider·targetSourceId·status·progress·startedAt·lastActivityAt·triggeredBy).
- `dto.pipeline` **Pipeline** — Summary + createdAt·finishedAt·failReason·tasks[].
- `dto.task` **Task (DTO)** — id·seq·name·handlerKey·kind·status·failCount·maxFailCount·nextCheckAt·latestCheck.
- `dto.attempt` **Attempt (DTO)** — id·taskId·attemptNo·response·errorCode·startedAt·finishedAt·outcome.
- `dto.check` **Check (DTO)** — id·taskId·kind·name·apiResult·observed·errorCode·externalHandle·startedAt·checkedAt·pollCount·latencyMs.
- `dto.pipeline-event` **PipelineEvent (DTO)** — id·pipelineId·taskId·type·severity·message·actor·createdAt.
- `progress` **progress{done,total}** — RUNNING 진행 지표. total=task 행 수, done=COUNT(DONE). 분수는 진행이지 결과 아님(status가 권위).
- `latest-check` **latestCheck** — started_at 최대 task_check(현재 열린 run). "확인 중" 구동.
- `created-flag` **created (retry)** — `POST /retry` 응답. true=새 run / false=기존 non-terminal 반환.
- `slot-cap-field` **slotCap** — slot cap(N) settings 노출 필드. 보드 게이지 분모(COUNT(DISP|RUN TF)/slotCap).
- `triggered-by-field` **triggeredBy** — actor의 API DTO 표현.
- `latest-check-running` **"확인 중" 파생** — DISPATCH는 api_result=PENDING / CHECK은 RLE라 PENDING 행 없어 nextCheckAt로 파생.
- `page.envelope` **Page envelope** — Spring Page 응답(content·totalElements·totalPages·number·size).
- `spring-pageable` **Spring Pageable** — 목록 페이지네이션(page·size·sort).
- `path.admin` **/admin/pipelines…** — 보드·상세·tasks·events·cancel·retry·settings 경로.
- `path.integration` **/integration/api/v1/…** — 고객/시스템 트리거·latest 조회 경로.
- `query.overlap` **overlap (from/to)** — run `[started_at, finished_at)`가 `[from,to)`와 겹치는 기간 조회.
- `sort-keys` **정렬 키(lastActivityAt·startedAt)** — 보드 허용 sort(인덱스 보유 컬럼만).
- `settings-knobs` **settings 객체 필드** — tickIntervalSec·perCallDeadlineSec·dispatchRecoveryTimeoutMin·executionTimeoutMin·waitExternalTtlDays·waitExternalPollingGuardMin·jobPollCadenceSec·slotCap·maxExternalCallsPerTick·maxFailCount·taskCheckRetentionDays·queueWaitAlertMin(workerPoolSize 비포함).

### 7.15 구현 런타임 (implementation-notes — 아키텍처 불변식 아님)
- `vt` **Virtual Thread (VT)** — Java 21+ 경량 스레드. 비블로킹 async 발사 구현 수단(힙 객체라 개수 비문제).
- `pinning` **carrier pinning** — park된 VT가 carrier를 안 놓아 core 수로 동시성이 떨어지는 현상(진짜 제약).
- `java21` **Java 21 / JEP 491** — VT 런타임. JEP 491(Java 24+)이 대부분 pinning 해소.
- `http-client` **HTTP backing client (Feign 등)** — VT 친화성이 pinning 좌우(feign-hc5 등).
- `trace-pinned` **-Djdk.tracePinnedThreads=full** — pinning 검증 플래그(배포 체크리스트).
- `impl-notes` **implementation-notes.md** — VT·pinning·registry 구현 런북(불변식 아님).

### 7.16 미해결 질문·개정 라벨
- `oq` **O5/O7/O10/O19/O20/O22/O24/O25/O26/O28/O29** — open-question ID. 예: O24→RLE·O25→HANDLER synthetic 행·O26→attempt_id 미도입·O28→멱등은 계약·O29→postCheck v2.
- `s-labels` **S26 / S30** — S26=WAITING_SLOT 제거(READY∧TF) · S30=outcome 파생.
- `p0-1` **P0-1** — crash-recovery가 fail_count 재사용(신규 컬럼 불요).
- `revision17` **후속17** — RLE 개정(collapse 의미론). 다수 인용.
- `rev4` **개정 4판** — TaskKind 3→2·circuit breaker/C-budget/force-check 제거·postCheck v1 defer.
- `rev6` **개정 6판** — v1/v2 분리(scheduling·custom recipe·GENERAL_JOB 등 v2 이관·unique 제약 도입).
- `decision-labels` **결정 1~7 / 4a~4d / 7.1~7.4 / D-T1~D-T7** — orchestrator 결정·하위결정 라벨(본문 인용 단위).
- `req-labels` **FR-1~8 / NFR-1~8 / PR-1~7** — 요구사항 ID.
- `option-labels` **Option A~F** — 검토한 대안 라벨.
- `part-ii` **Part II / Config 표** — operations 설정표(기본값 단일 출처) 별칭.
- `r5` **R5 ("설정은 데이터다")** — 유일 생존 아키텍처 룰(R1·R2·R6→결정 3.2, R3→결정 2, R4→결정 1.3 흡수).

### 7.17 제거·연기된 용어 (소스에 흔적 남음 — 혼동 방지용)
- `removed.circuit-breaker` **circuit breaker(제거)** — 장애 차단기. 개정 4판 제거(timeout+retry+알림 롤업 대체).
- `removed.force-check` **force-check(제거)** — 수동 강제 확인. 모든 확인은 polling만.
- `removed.pause-resume` **pause/resume(제거)** — dispatch admission gate. circuit breaker와 함께 제거.
- `removed.waiting-slot` **WAITING_SLOT(제거)** — slot 큐 별도 상태. READY∧kind=TF로 대체(S26).
- `removed.job-poll-forcecheck` **JOB_POLL/FORCE_CHECK(제거)** — 구 task_check.kind. CHECK로 통합·FORCE_CHECK 삭제.
- `removed.execute-wait` **EXECUTE/WAIT_EXTERNAL(구 task.type)** — TERRAFORM_JOB/CONDITION_CHECK kind로 대체.
- `removed.c-budget` **C-budget / call_deadline_at(제거)** — 호출 예산. 개정 4판 제거.
- `removed.attempt-id` **attempt_id(미도입)** — job_id 고유라 soft-link 충분(O26).
- `removed.parameters` **pipeline.parameters(미도입)** — 실행 입력 일반화 거부. 단위=target_source_id 고정.
- `removed.exec-context` **TaskExecutionContext(제거)** — 범용 실행 컨텍스트. task는 target_source_id·response만.
- `removed.generalization-slots` **requiresSlot/completionRule/timeoutPolicy(미도입)** — 일반화 슬롯. kind가 흡수(YAGNI).
- `removed.abstraction-layers` **connector/callStrategy/resourcePool(미도입)** — 추상화 레이어. 2번째 backend 실재 시 additive.
- `removed.task-detail` **task_check.detail(미도입)** — terminal 스냅샷 컨테이너. postCheck와 함께 v2.
- `removed.lifecycle` **ACTIVE/DEPRECATED/RETIRED(제거)** — definition lifecycle. 결정 7.4로 불요(release 1개+snapshot 이력).
- `deferred.v1-v2` **v1 / v2 / v2 defer** — v1 범위 vs v2 연기. 연기 표면은 v2-deferred.md.
- `deferred.postcheck` **postCheck / O29** — terminal 스냅샷 캡처. v2.
- `deferred.skip-completed` **skip-completed** — content-hash 부분 재실행 최적화. v2.
- `deferred.custom-recipe` **custom recipe / Custom Pipeline** — TargetSource별 데이터 override. v2.
- `deferred.scheduling` **scheduling / per-target serial queue(구 결정 8)** — 예약·직렬화 큐. v2(v1은 unique 제약).

### 7.18 비교/대안
- `workflow-engine` **워크플로 엔진** — Temporal/Airflow 등. Option C 거부(비용 미정당화).
- `temporal` **Temporal** — durable workflow 엔진(거부 대안 예).
- `airflow` **Airflow** — DAG 스케줄러(거부 대안 예).
- `saga` **Saga / compensation** — 분산 트랜잭션 롤백 패턴(v1 비채택 — terraform 수렴이 흡수).

### 7.19 도메인·연관 ADR
- `cloud-provider` **CloudProvider (AWS·AZURE·GCP·IDC·SDU)** — provider enum 도메인 표준값(§1.2 컬럼은 enum 미고정, 정본=도메인).
- `type-install` **INSTALL** / `type-delete` **DELETE** — pipeline.type 2종(v1).
- `adr` **ADR** — Architecture Decision Record. 이 문서=ADR-016.
- `adr-006` **ADR-006** — 3-object confirmation model(파이프라인은 CONFIRMED~INSTALLED 사이 동작).
- `adr-009` **ADR-009** — process status model.
- `adr-019` **ADR-019** — casing 경계(snake DB / camel API).
- `confirmed` **CONFIRMED** — 프로세스 상태(파이프라인 시작점).
- `installed` **INSTALLED** — 설치 완료 프로세스 상태(종착).

> **리뷰 작업.** §7은 codex/opus가 잡은 누락을 전부 흡수했다. 다음 리뷰는 (a) 남은 누락 용어, (b) 정의
> 정확성(특히 namespace 항목), (c) §3 섹션 노트와 §7 정의의 일관성을 본다.
