# Pipeline — Decision History (긴 변경 이력)

> [ADR-016](../../docs/adr/ADR-016-install-delete-pipeline-orchestration.md)의 긴 변경 이력 — 재구성 내역 + Resolved 질문.
> ADR 본문에는 짧은 Revision History만 두고, 사고 과정의 전체 이력은 여기 둔다.
> O-번호·S-번호·결정 번호는 본문 cross-reference와 공유한다.

---

## 재구성 내역

개정 6판 (2026-06-20 v1/v2 split — YAGNI 트리밍):

- **목표 = v1 범위로 축소.** deferred·speculative 표면을 문서에서 **삭제**(relabel 아님)하고 별도
  `v2-deferred.md`로 한 줄씩 이관한다. 동작 변경이 아니라 v1이 실제로 만드는 것만 남기는 문서 정리다.
- **v2로 이관(삭제):** ① **scheduling**(`scheduled_at`·not-yet-due 큐 파생) · ② **per-target 실행
  직렬화 큐(구 결정 8)**(active 게이트·`maxNonTerminalPipelinesPerTarget`) · ③ **custom per-target recipe
  데이터 layer(구 결정 7 일부)**(`custom_pipeline_recipe` 테이블·override·편집 version·catalog validation·
  api.md §6) · ④ **postCheck + O29**(detail 스키마·로그 조회·redaction) · ⑤ **알림 라우팅 + Slack/Email
  채널** · ⑥ **skip-completed(content-hash)** · ⑦ **GENERAL_JOB**(구체적 v1 사용처 없는 speculative
  3번째 kind). → 전부 v2-deferred.md.
- **v1 중복 pipeline 방지 = unique 제약(결정 8 큐 아님).** "동일 target 다중 pipeline 실행 직렬화"(구
  결정 8)를 삭제하고, 부분 unique 제약 `unique(target_source_id) WHERE status NOT IN (DONE,FAILED,
  CANCELLED)`으로 대체 — target당 non-terminal pipeline 1건 강제, 중복 생성은 기존 1건 반환. 제약을 결정
  5(retry=새 run)에 fold. **결정 8 standalone 섹션 제거**(내용은 v2-deferred + 이 제약으로 흡수).
- **결정 7 = 코드 default + snapshot으로 축소.** 세 layer(catalog/default/custom override/snapshot)에서
  custom override 데이터 layer를 빼 **코드 default recipe + run snapshot 2개**만 남긴다. v1 Definition =
  코드 default + snapshot. 결정 7은 유지하되 trim(번호 보존).
- **TaskKind 3종 → 2종.** GENERAL_JOB을 v2로 — v1은 `TERRAFORM_JOB` + `CONDITION_CHECK`. doc-set 전반
  (task-model 결정 2·state-machine lanes/표·ADR·api·migrations)에서 GENERAL_JOB 표현 제거.
- **결정 번호 미변경.** 결정 7은 trim, 결정 8 섹션만 제거(번호 결번·decision-history는 보존). O29는
  open-questions에서 v2로 이관(활성 0건 유지).
- **개정 6판 후속 — v1 스키마 정리 (codex v1 재리뷰 반영).** TaskKind 2종화로 죽은 일반화 제거:
  ① `task_check.detail(jsonb)` 제거(구 postCheck 결과 그릇 — v2 도입 시 additive 추가) · ② `task.depends_on`
  배열 제거 → 순차 chain은 **seq predecessor**(seq-1 DONE→승격) + `unique(task.pipeline_id, seq)` 제약 ·
  ③ `/admin/pipelines/concurrency` endpoint 제거(slot 게이지는 `COUNT(DISPATCHING|RUNNING)`로 파생) ·
  ④ `open-questions.md` 삭제(활성 0·O29는 v2-deferred.md) · ⑤ target 비정규화 요약 컬럼 제거(인덱스 조회로
  충분). **유지 결정:** `task_attempt.response(jsonb)`는 컷 검토 후 **보류**(유지); `pipeline_def_snapshot`도
  유지(spec(jsonb) 내용을 결정 7.1·§1.2·ADR에 정밀 명시 — `{name, tasks:[{seq, name(operation), kind,
  deadline, ttl?, pollingInterval?, executionTimeout?, maxFailCount}]}`). 동작 무변경(스키마·문서 정리).
- **개정 6판 후속2 — codex v1 리뷰 문구 정밀화(설계 무변경).** ① snapshot "절연" 과장 교정 — 절연 범위 =
  recipe/config이며 **task class 코드 동작은 절연 대상 아님**(현재 배포본 실행, 코드=실행 권위; 비호환 변경은
  새 task class로). 결정 7.1/7.3·§1.2·ADR 반영. ② retry 응답 모순 해소 — `{newPipelineId}` → `{pipelineId,
  created}`(non-terminal 충돌 시 기존 반환=created:false, unique 제약과 정합). ③ api §3 생성 계약을
  3-point(resolution·원자성·중복차단; retry 동일)로 집약. codex 점수 85/100의 감점 사유(생성/retry 계약·
  snapshot 의미) 대응.
- **개정 6판 후속3 — 문서 위생 (codex v1 재리뷰 86/100 대응; 설계 무변경).** v1 트리밍의 follow-through 누락
  정리: ① operations.md에서 v2 residue 제거(post-check 60초·알림 라우팅 행·라우팅 참조) + 동시성 설명을
  고정 풀 framing으로 정렬(M=hard cap·N≈M throttle·N·K는 제출량 산정값; M 행 추가) · ② `task_check.detail`
  = "v1 컬럼 없음"으로 전 문서 통일(task-model·decision-history 잔재 "예약 컨테이너" 문구 교정) · ③
  migrations.md affected-files의 stale 경로(`design/pipeline-interfaces.md`·`pipeline-api.md`)를 실재
  `design/pipeline/*.md`로 수정 · ④ "Task 추가 = 새 TaskKind 추가" 문구를 "새 task = 새 코드 class(대개
  기존 kind 재사용; 새 흐름 shape일 때만 새 kind)"로 정정(operation/kind 혼동 해소 — task-model·requirements·
  ADR). **반려:** codex의 TaskOperation/TaskHandler catalog 레이어 도입은 v1에 새 추상 추가라 거부(YAGNI) —
  문구만 정정.

- **Pipeline Definition 모델 확정 + Custom Pipeline 도입 (결정 7 신설).** 파이프라인 구성을 세 layer로
  가른다: **Task catalog=코드 class**(content-hash version), **Default recipe=코드**((type,provider)당,
  release version·metadata 코드 명시), **Custom recipe=데이터**(TargetSource별 편집 가능 override, 편집마다
  version +1, sparse, full 교체), **Snapshot=불변 실행 기록**(생성 시 {metadata·확정 task목록·출처
  recipe+version} 박제). 개정 4판의 "recipe는 (type,provider)당 고정" 암묵 전제를 Custom Pipeline 능력으로
  **확장**하되 default 경로는 코드 유지(무게=per-target cardinality, default=코드가 제거 — 결정 7.4).
  resolution = (target,type) override 있으면 그것·없으면 (type,provider) default; task row 생성 + snapshot
  박제는 원자적. 신규 테이블 `custom_pipeline_recipe`(unique(target_source_id, type)). **→ v2 (개정 6판):**
  custom recipe 데이터 layer(`custom_pipeline_recipe` 테이블·override·편집 version·catalog validation·api.md §6)를
  doc-set에서 삭제하고 v2-deferred.md로 이관 — v1 결정 7 = 코드 default recipe + run snapshot 2개 layer.
- **O10 해소.** retry는 새 run 생성 시점의 현재 recipe를 resolve(원 run 버전 미고정) → O10(retry definition
  버전: 원 run vs 생성 시점 ACTIVE) 확정. skip-completed는 v1 미지원(full re-run), 도입 시 task content-hash
  비교로 판정(결정 5 확장 경로). 미해결 2→1건(O29만).
- **version 배치 정정.** recipe-level 명시 version은 두지 않는다 — 재현은 snapshot, skip은 task content-hash,
  편집 이력은 custom override +1 version + audit가 담당. (대화 중 "version은 task에서만" 논의 → 편집 가능
  custom은 audit·동시편집용 +1 version만 별도로 가진다; 구성 재배열은 어느 task의 version도 아니므로 snapshot이
  run별 구성 이력을 책임진다.)
- **lifecycle 단순화.** default=코드(release 1개) + custom=데이터(target별 현재 version 1개) + snapshot
  이력 구조라, ACTIVE/DEPRECATED/RETIRED 다중 버전 공존 lifecycle은 불요해진다(결정 7.4).
- **postCheck v1 defer + O29 dormant.** postCheck(terminal 스냅샷 관측)는 v1 범위에서 제외 — 규칙
  (S29·결정 2/1.3/3.3/4a/4c)·스키마 컨테이너(`kind=POST_CHECK`·`detail` jsonb)는 후속 additive 도입용으로
  **보존**(off-critical-path라 상태기계·마이그레이션 무변경으로 켬). 미해결 **O29**(detail 스키마·full 로그
  조회·redaction)도 함께 **defer**(활성 미해결 0건). 근거: write-once 캡처는 안전한 캡처법
  (redaction-before-store + IM 로그 API 사실)이 확정된 뒤 켜는 것이 옳다. **forensic 결과:** 도입 이전 run은
  terminal 스냅샷 없음·backfill 불가(완료 여부·시각은 CHECK 관측에 보존). **→ v2 (개정 6판):** postCheck/O29
  규칙·`POST_CHECK` enum 표현을 doc-set에서 삭제하고 v2-deferred.md로 이관(`detail` 컬럼은 개정 6판 후속2에서 제거 — v2 도입 시 additive).
- **결정 8 신설 — 동일 target 다중 pipeline 생성 허용 + 실행 직렬화 (중복 pipeline 방지 해소).** unique 제약
  (생성 거부)이 아니라 **최古 `start_at` active 1개만 전진**으로 상호배제를 실행 시점에 둔다 — 생성 intent 보존·
  scheduling substrate. target당 non-terminal ≤ `maxNonTerminalPipelinesPerTarget`(default 3, Part II)로 spam
  bound(초과만 거부; *target당 pipeline* 상한이라 *전역 TF task* N-cap과 별개 축). "대기(큐)"는 `RUNNING ∧
  active 아님`으로 파생(S26 철학, pipeline states 5 유지; behind/not-yet-due 두 사유). 순서 = `start_at`
  (v1=created_at) 최소 — **FIFO 아님**(예약이 도착 순을 깨므로); type supersede 없음. 컬럼 추가 없음
  (`scheduled_at`은 scheduling 확장 예약), 인덱스 `pipeline(target_source_id, created_at) WHERE non-terminal`
  → 결정 8, 4b/1.1 cross-ref. **남은 활성 결정: 트리거 생성 path · RECONNECT 스코프.** **→ v2 (개정 6판):**
  결정 8 standalone 섹션·per-target active 게이트·scheduling·`maxNonTerminalPipelinesPerTarget`을 doc-set에서
  삭제하고 v2-deferred.md로 이관 — v1은 부분 unique 제약(`unique(target_source_id) WHERE non-terminal`)으로
  중복 pipeline 1건만 허용(결정 5에 fold), 결정 8 큐 없음.
- **트리거(생성) path = ADR 범위 외, 구현 시 확정.** 파이프라인 생성 endpoint·트리거 주체(설치 시작 버튼 vs
  CONFIRMED 전이)는 기존 integration install/delete 흐름(ADR-006/009)이 소유하므로 본 ADR이 고정하지 않는다
  — 실제 구현에서 기존 흐름과 배선하며 확정. ADR-016이 못 박는 생성 계약은 **결정 7·8**(resolution → cap →
  원자적 task row + snapshot)뿐. 이로써 **ADR-016 아키텍처 결정(결정 1~8)은 닫힘** — 남은 항목은 배선(트리거
  path)·요구사항(RECONNECT)·구현(default recipe 시퀀스·catalog 검증)·보류(postCheck/O29·scheduling·skip)로,
  모두 본 ADR이 내려야 할 아키텍처 결정이 아니다 → api.md §3 (2026-06-20).
- **고정 worker 풀 채택 → 결정 4b 단순화.** TerraformWorker를 **고정 크기 풀(M)**로 두기로 결정 — 동시
  terraform 실행이 풀에서 **hard-cap(≤ M)**된다. 이로써 N-cap이 지던 "전역 동시성 보장" 부담이 풀로
  이전되어 N-cap은 *동시성 안전장치 → pubsub 큐 throttle(N≈M)*로 강등. 결정 4b의 soft-target·N·K-not-a-cap·
  IM-429-위임 단서 더미를 crisp 버전으로 축약(autoscale 시나리오용 escape만 잔존). **codex가 반복 지적한
  'N·K 복잡성'은 설계 복잡이 아니라 무한-풀 전제의 방어 문서였고, 고정 풀로 그 전제가 사라져 해소**(문서
  축약일 뿐 동작 무변경) → 결정 4b, ADR 제약#5 (2026-06-20).

> 개정 5판은 개정 4판의 "recipe 고정" 가정을 확장(supersede)한다 — default=코드 경로는 4판 그대로이고,
> custom override 데이터 layer만 additive로 더해진다. 런타임 상태기계·멱등성·N-cap·snapshot 메커니즘은 무변경.

---

개정 4판 (2026-06-14 단순화 리팩토링):

목표는 기능 제거가 아니라 **workflow engine 일반화를 제거하고 실제 요구사항(target source 설치/삭제
자동화) 중심 구조로 수렴**시키는 것이다. 개정 3판에서 도달한 일반화 결정 중 현재 요구사항을 초과하는
것을 축소한다. 아래 변경은 개정 3판의 해당 결정·Resolved 행(괄호 안)을 supersede한다.

- **Circuit breaker / canary 제거 (결정 4d 전면 재작성; supersede S11/S12/O7의 breaker 부분).**
  breaker open/half-open/close, canary dispatch, outage 동안 dispatch gate, timeout requeue special
  path, WORKER_RECOVERED 제거. worker 장애는 **execution timeout + retry**로 처리하고 systemic
  timeout은 **알림 롤업만** 수행한다(단일 critical WORKER_OUTAGE_SUSPECTED). 상태기계 동작은 바꾸지
  않는다. 유지: execution timeout · fail_count · retry · idempotent dispatch.
- **Global C-budget 제거 → `max_external_calls_per_tick` (결정 6 D-T7 재작성; supersede S12/S16/O24/
  O25의 C 부분).** in-flight call 계산, `api_result=PENDING` 기반 동시성 budget, `call_deadline_at`
  컬럼, `admit = C − in_flight` 공식 제거. 대신 **tick당 발사 호출 수 상한** 하나
  (`max_external_calls_per_tick = 50`) — burst 완화 목적이며 정확한 global concurrency 보장은 하지
  않는다. (PENDING 선기록은 "시도 vs 미시도" 구분용으로 D-T5에 유지.)
- **Force check 제거 (결정 1.2/1.3/1.4·6 D-T6; Open O18 소멸).** FORCE_CHECK kind, [지금 확인] 버튼,
  force-check actor, rate limit 제거. 모든 상태 확인은 polling 정책으로만 수행하며 상태기계에
  force-check 개념을 두지 않는다.
- **PostCheck 축소 0..N → 0..1 (결정 2; supersede S14/O9).** `postChecks[]`(0..N) → `postCheck?`(0..1).
  일반 후처리 훅이 아니라 **task terminal 직전의 terminal snapshot 조회**로 재정의 — 휘발성 로그·결과
  보존(Terraform 마지막 로그·Backend Manager 최종 상태). 규칙: task당 ≤1, `pipeline.status != CANCELLING`
  일 때만, 실패해도 상태 전이 무영향, retry 없음, 상태 판정 기능 아님.
- **`pipeline.parameters` 제거 → `target_source_id` (결정 1.2/2; supersede S19/O21/O22).** 실행 입력
  일반화(jsonb parameters)를 제거하고 `pipeline.target_source_id` 컬럼으로 고정. 실행 단위 = target
  source(1:1). 조회는 식 인덱스 → `target_source_id` 컬럼 인덱스.
- **TaskDefinition 훅 일반화 제거 → TaskKind 3종 (결정 2; supersede S14/S15/S17).** dispatch?/check?/
  postCheck?/requiresSlot?/completionRule?/timeoutPolicy? 임의 조합 제거. Task는 **TERRAFORM_JOB·
  GENERAL_JOB·CONDITION_CHECK** 3종만 지원하며 각 kind가 고정된 dispatch/poll 흐름과 slot 소비 여부를
  가진다. Task 추가 = 새 TaskKind 추가. slot은 TERRAFORM_JOB이 소비.
- **`TaskExecutionContext` 제거 (결정 2; supersede S20/S24).** 범용 실행 컨텍스트(`{input, attempt?}`)
  폐기. task는 `pipeline.target_source_id`와 `task_attempt.response`만 사용한다.
- **유지(축소 아님):** `task_attempt.response(jsonb)`(dispatch 원응답 보존; terraform_job_id·
  general_handle 전용 컬럼 없음, poller가 추출), `DISPATCHING` 상태(READY→DISPATCHING→RUNNING,
  crash recovery window), 그리고 durable DB state machine·reconciler tick·task_attempt·task_check·
  execution timeout·WAIT_EXTERNAL TTL·retry=새 run·N-cap·idempotency contract·CANCELLING drain.
- **트래커 정리:** Open O8(breaker canary)·O18(force-check actor)은 breaker·force-check 제거로 소멸 —
  open-questions 트래커에서 제거.
- **N-cap 목표 재정의.** N-cap이 직접 보장하는 것은 **BFF-visible active Terraform task count ≤ N**이다.
  `N·K`는 actual global worker job hard cap이 아니라 retry/orphan headroom 산정값이다. 모든 caller·수동
  job·orphan job까지 포함한 global hard cap은 BFF가 아니라 Infra Manager 429/503의 책임이다. 결정 4b 주
  대상, 결정 2 cross-ref, Part II N/K 행.
- **[중단] 트리거 명확화 — intent 표현 제거, API 즉시 전이 (결정 1.1/3.2/4c · state-machine).**
  "UI 액션은 intent를 기록하고 다음 tick이 실행한다"를 제거. [중단]은 외부 side effect가 아니라
  pipeline 내부 상태 전이이므로 Admin API가 공통 전이 함수로 `RUNNING → CANCELLING`을 즉시 수행
  (CAS prior=RUNNING + pipeline_event; intent row·`cancel_requested_at`·`pipeline_command` 미도입).
  reconciler tick의 task cancel/drain은 종전과 동일(4c/state-machine 무변경). 단일 writer 불변식은
  그 적용 범위(외부 호출·slot 회계·task 전진 = tick-only)로 정밀화하고 pipeline-level 사용자 전이를
  그 예외로 명시. 감사는 전이가 남긴 pipeline_event.actor. 메커니즘 무변경, 표현 정밀화.

> 개정 4판은 개정 3판의 일반화 결정 일부를 의도적으로 되돌린다. 아래 개정 3판~Resolved 기록은 그
> 일반화에 도달한 사고 이력으로 보존하되, 위 항목과 충돌하는 부분은 본 개정 4판 항목이 정본이다.

---

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
  상한 겸용, N·K headroom으로 retry/orphan 제출 여유를 산정한다. 제약 #3·결정 3.1/4b·Part II 반영, 본문
  "dedup" 표현 전수 교체. 신규 검증 항목 O28(task별 멱등성). 미해결 6→7건.
- **P0-4 CANCELLING precedence (2026-06-14):** 결정 1.1 파생 규칙에 CANCELLING 최우선 순서 박음 —
  CANCELLING 중 task terminal(FAILED 포함)은 pipeline FAILED로 승격 안 하고 drain 후 CANCELLED 수렴;
  판정 상태 기준(시각 아님 — 직전 확정분 누수·CAS race 방지); task 사실 보존·pipeline만 수렴(4c 정합);
  terminal→CANCELLING 입구 가드는 결정 5 귀결로 자동 차단(4c 명시). 설계 변경 아닌 1.1 명문화.
- **O28 해소 — 멱등성은 계약이지 감사 아님 (2026-06-14):** dispatch는 외부 API 호출이라 BFF가
  멱등성을 스스로 검증 못 함 → 리뷰가 제안한 "task별 예/아니오 감사 표"는 BFF에서 작성 불가.
  결정 3.1 불변식을 "job_id 발급·폴링하는 dispatch 작업은 멱등 보장"이라는 **task 등록 계약**으로
  못박고 리뷰에서 강제(결정 3.2 연장), 비멱등은 거부; 충족 검증 책임은 task 구현·IM 쪽. 미해결 7→6건.
- **fan-out 제거 — attempt:handle 1:1 확정 (check는 1:N 폴링) (2026-06-14):** 모든 dispatch가 단수 handle을 반환함이
  확정(terraform=요청당 1 job_id)되어 한 dispatch가 원자적 N id를 내는 fan-out 케이스는 실재하지
  않음. 앞서 O23(fan-out=①)·O24로 정리했던 id 집합 집계·미완 id 재폴링·handle별 1행 설계를 무효화 —
  task success = 단일 handle의 completionRule(DONE|PENDING|FAILED) 평가로 단순화. attempt.response(jsonb)는
  유지하되 근거를 "handle 1/N/0개 흡수"에서 "dispatch 종류별 응답 형태를 컬럼 ALTER 없이 담는 그릇"으로
  수정. Resolved O23 제거·O24는 "1 call=1 row"만 유지·S21/S23 fan-out 문구 정리; O27(완료 id 보존)은
  질문 자체가 소멸. 미해결 6→5건(O8·O10·O18–O20).
- **C 초기값 50 (2026-06-14):** Part II에서 유일하게 비어 있던 C(외부 호출 동시성 budget)에 운영
  시작용 초기값 50 부여(D-T7 본문에도 명시). 정밀 산정은 IM 용량 실측 기반 운영 튜닝 영역으로 본
  ADR 범위 밖이며, 50은 최종값이 아니라 출발점 → 결정 6 D-T7, Part II.
- **dispatch 선기록 흐름 정합화 / P0-2 (2026-06-14):** 결정 3.1의 dispatch 순서가 task_check 선기록을
  tick tx에 묶고 RUNNING 전이를 호출 스레드 tx에 두어 결정 6(상태=tick·관측=호출 스레드)과 충돌.
  **5단계 writer 분리**로 명문화 — tick: DISPATCHING·task_attempt·next_check_at; 호출 스레드: task_check
  선기록·dispatch 호출·response/task_check 기록; 다음 tick: RUNNING 전이. 결정 2 dispatch 표의
  "task_attempt 호출 스레드 개시"도 tick으로 정정 → 결정 3.1/2/6.
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
| S11 | N-cap = soft target(잘 설계된 worker 큐가 실질 backpressure); 상태기계 정확성만 leader 무관, capacity는 leader-serialized soft; split-brain·잔존 job·외부 caller 일시 초과 감수; 하드 글로벌 상한은 BFF lease 아닌 Infra Manager 429/503 → 결정 3.2, 4b (2026-06-13) |
| S12 | poll 부하(축 다)는 in-flight 동시성 budget C로 제어 — PENDING task_check로 count(새 상태·WAIT_EXTERNAL 계수 아님), C 넉넉히, soft·leader-serialized, IM 429/503→requeue(fail_count 미소모); 3.3 catch-up은 dispatch=N-cap·poll=C → 결정 6 D-T7 (2026-06-13) |
| S13 | task 상태 BLOCKED: 06-13 제거(seq 파생) → **06-14 복구**(10종; 06-15 WAITING_SLOT 제거로 **9종** — S26) — READY는 "의존 풀림·전진 가능 후보"를 보장해야 하므로 "의존 미해소(아직 후보 아님)"를 BLOCKED로 분리; task는 BLOCKED로 시작, depends_on 충족 시 reconciler가 READY로 승격 → 결정 1.1/1.2, 6 D-T6 (2026-06-13 제거, 06-14 복구) |
| S14 | Task 모델 = 훅 조합(dispatch?/check?/postChecks[]/requiresSlot); 종류는 훅 유무가 결정(타입 enum 아님), TERRAFORM/GENERAL_API는 훅 안 코드 차이일 뿐 terraform은 구현 사례; reconciler는 훅으로 분기; task.type은 표현 라벨; connector/strategy/pool 미도입(YAGNI) → 결정 2 (2026-06-14) |
| S15 | requiresSlot = "공유 IM 동시성 자원 소비"(타입 아님); 타입별 slot 분배 비채택; 단일 풀(infra_manager, cap=N), named pool은 YAGNI → 결정 4b (2026-06-14) |
| S16 | 동시성 = 직교 두 축: N(terraform job 수, requiresSlot task) · C(in-flight 호출 수, 모든 외부 호출); 일반 API도 C 소비(N만 면제); C는 단일 전역, M은 보호 대상이지 한도 아님 → 결정 4b, 6 D-T7 (2026-06-14) |
| S17 | task_check.kind: JOB_POLL+CONDITION_CHECK→CHECK 통합; kind는 control flow 신호 아닌 표현 라벨(분기는 발원 훅 check/postChecks); CHECK/POST_CHECK는 UX용 구분 유지; 핸들폴링 vs 조건평가는 external_handle 유무로 파생 → 결정 1.2/1.3, 6 D-T6 (2026-06-14) |
| S18 | PENDING 선기록은 tick이 아니라 호출 스레드 안(호출 직전); tick은 발사 시 next_check_at만 밈; 관측=스레드·상태=tick 유지 → 결정 6 D-T4/D-T5 (2026-06-14) |
| S19 | pipeline.parameters(jsonb) 신설 — 실행 입력을 고정 컬럼 아닌 데이터로; target_source_id는 parameters 키(+조회용 비정규화 복제); 생성 시 박제(append-only); 현재 실행 단위 = target_source_id(1:1), 1:N은 의도 아님 → 결정 1.2/2, O22 (2026-06-14) **(target_source_id 비정규화 복제는 O21 해소 행이 supersede — 컬럼 제거, 식 인덱스 대체)** |
| S20 | task 간 값 전달: handle 참조는 모델 내재(A, attempt.response↔task_check.external_handle); handle 외 산출(B)의 append-only 전파는 **입력 계약에서 제외**(2차) — 현재 chain은 BFF 레벨 값 전달 안 함(terraform state로 해결), 값 전달 task 실재 시 TaskExecutionContext에 additive → 결정 2 (2026-06-14, 2차 개정) |
| S21 | attempt는 action 단수 유지(배열 컬럼 금지) → 결정 1.2/2/3.1 (2026-06-14) **(external_handle 복수·fan-out ①/② 논의는 fan-out 제거로 소멸 — 모든 dispatch 단수 handle, attempt:handle 1:1(check는 1:N 폴링); 일부 S22가 supersede; attempt_id는 O26 해소로 드롭)** |
| S22 | (S21·1차 §1.8 일부 supersede) dispatch 산출 = task_attempt.response(jsonb)에 보존(단수 external_handle 컬럼 제거); handle 1/N/0개를 JSON으로 흡수, write-once; handle home은 attempt이지 task_check 아님 — task_check.external_handle은 "확인한 id 참조"(1차 "handle을 task_check로"는 산출/관측 혼동 오류라 철회) → 결정 1.2/2/3.1 (2026-06-14) **("handle 1/N/0개 흡수" 근거는 fan-out 제거로 "단수 handle · dispatch 종류별 응답 형태 흡수"로 정련 — jsonb 유지, 본문 결정 1.2/3.1)** |
| S23 | **fan-out 제거로 소멸 (2026-06-14)** — "attempt 1 : check N" 설계는 모든 dispatch가 단수 handle을 반환함이 확정되어 무효; **attempt:handle은 1:1**(handle은 N번 폴링 → attempt:task_check는 1:N), task success = 단일 handle의 completionRule 평가(결정 2/3.1 본문). id 집합 집계·미완 id 재폴링은 폐기 |
| S24 | check/postCheck 입력 계약 = **단일 객체 `TaskExecutionContext{input, attempt?}`**(2차) — 개별 인자 아닌 객체라 필드 추가에 시그니처 불변; external_id 직접 안 받음(handle은 attempt.response); attempt?는 nullable(조건 task=null → input만 평가, "attempt 항상 존재" 오류 정정); 동기/비동기 비분기(response 형태로 흡수); 차이는 결과의 쓰임뿐(check=전이 입력, postCheck=관측) → 결정 2/1.4/1.5 (2026-06-14, 2차 개정) |
| S25 | task_check = 관측 장부; external_handle은 "확인한 id 참조"(저장소 아님); id마다 자기 행 — 행 단위(N행 vs 1행)는 O24, attempt_id는 O26, 동기 check 행은 O25, 완료 id 보존은 O27 (2026-06-14) **(행 단위는 O24, attempt_id는 O26, 동기 check 행은 O25 해소 행이 supersede; 완료 id 보존 O27은 fan-out 제거로 소멸 — 단수 handle이라 보존할 id 집합 없음)** |
| O24 | task_check 행 생성 단위 = **check 호출 1회**(1 call = 1 row); external_handle 단수(확인한 단일 id 참조); C(D-T7) = PENDING task_check = in-flight 호출 수 — **S25의 "행 단위 미정" 문구 supersede** (fan-out handle별 1행·배치 check 수식은 fan-out 제거로 함께 삭제 — attempt:handle 1:1, 단 handle은 N번 폴링되어 attempt:task_check는 1:N) → 결정 1.2/2/3.1 (2026-06-14) |
| O26 | task_check.attempt_id **드롭** — terraform_job_id 요청별 서버 측 고유 발급(재dispatch=새 job_id, 결정 3.1)이라 handle id가 attempt 간 비중복 → external_handle∈attempt.response soft-link 무모호, 명시 링크 컬럼 불요; 스키마·migration에서 제거 — **S21의 "attempt_id 기록"·S25의 "attempt_id는 O26" 문구 supersede** → 결정 1.2/3.1 (2026-06-14) |
| O21 | pipeline.target_source_id 비정규화 복제 컬럼 **제거** — parameters['target_source_id']가 단일 출처; 조회용 인덱스 pipeline(target_source_id, started_at)는 식 인덱스 pipeline((parameters->>'target_source_id'), started_at DESC)로 대체(컬럼 없이 동일 조회 보존) — **S19의 "비정규화 복제" 문구 supersede** → 결정 1.2/2, migration (2026-06-14) |
| O22 | 실행 단위 확장 — **고민 불요, 결정 2에 흡수.** 실행 단위 = target_source_id(1 pipeline:1 target); target 묶기(1:N)는 비채택(N target=N pipeline — 재시도 run 단위·히스토리 target별인 결정 5 기조와 정합); 단위 확장 입력은 parameters(jsonb) 키 추가로 흡수(실행 단위=데이터), 어떤 확장도 task엔 target_source_id 안 넣어 추상 입력 계약 유지 → 모델 변경 불요 → 결정 2/5 (2026-06-14) |
| O7 | TerraformJob "queued vs running" 구분 = **불가능**(IM API가 노출 못 함, worker health endpoint 없음) → terminal까지 **무한정 폴링·성공 대기**(stuck vs 느림 조기 구분 불가). breaker 빠른 primary 감지(pickup-window) 폐기 — **EXECUTION_TIMEOUT 3연속 + canary가 유일 감지/probe**; 감지 latency ~30분+는 구조적 상수로 감수; timeout job은 재시도하고 breaker open 중이면 fail_count 소모 없이 requeue. pickup-window config 제거, k8s 직접 조회 비채택 유지 → 결정 4d (2026-06-14) |
| O9 | CANCELLING/drain에서 terminal 도달 job의 postChecks 실행 = **안 함.** postChecks는 task가 **성공(DONE)일 때만** 실행(취소·실패·drain은 비성공 경로) — forward/drain edge에 별도 분기 불필요, "성공 시에만"이 단일 기준 → 결정 2/4c (2026-06-14) |
| O25 | 외부 호출 없는 check(동기·조건)의 행 기록 = **남긴다.** task_check는 관측의 장부(호출 장부 아님)라 1평가 1행 — 안 남기면 조사 타임라인에서 사라짐. 거부되는 건 행이 아니라 "호출 없는 평가용 별도 카운팅 규칙/플래그"(신규 메커니즘); 행은 남기고 새 규칙은 안 만든다. C는 **외부 호출이 실제 발사된 행(PENDING)만** 카운트(D-T5 선기록이 자동 판별) — 대부분의 check(조건 평가·핸들 폴링)는 외부 호출이라 C 소비, 네트워크 안 타는 평가만 미소비 → 결정 6 D-T5/D-T7 (2026-06-14) |
| P0-1 | downstream dedup 계약: **worker dedup 없음 + execution API 멱등 보장**으로 해소 — 중복 job 각각 실행되나 멱등이라 안전, B도 정상 수렴해 timeout 시나리오 불가; idempotency key/상태조회 불요; crash 재dispatch는 **fail_count++**로 세어 K(=max_fail_count) 상한 겸용, **N·K headroom**으로 retry/orphan 제출 여유 산정 → 제약 #3, 결정 3.1/4b, Part II (2026-06-14) |
| P0-2 | dispatch 선기록 흐름의 결정 3.1 ↔ 결정 6 충돌 해소 — **5단계 writer 분리**로 명문화: **(1 tick tx)** DISPATCHING CAS·task_attempt 생성·next_check_at, **(2 호출 스레드 tx)** task_check DISPATCH/PENDING 선기록, **(3 호출 스레드)** dispatch 호출, **(4 호출 스레드 tx)** response·task_check UPDATE, **(5 다음 tick)** RUNNING 전이. 상태 전이(DISPATCHING·RUNNING)는 tick, 관측(task_check)·산출(response)은 호출 스레드 — dispatch도 결정 6 단일 writer 규율을 예외 없이 따름(기존 "tx1에 task_check 선기록"·"tx2에서 RUNNING 전이"·결정 2 표의 "task_attempt 호출 스레드 개시" 정정) → 결정 3.1/2/6 (2026-06-14) |
| P0-4 | CANCELLING 중 task FAILED/EXPIRED의 pipeline 최종 = **CANCELLED 확정**; 결정 1.1에 "CANCELLING 최우선" precedence 명문화(4c 입장의 정합 — 동작 권위는 4c, 본 행은 1.1로의 명문화이지 설계 변경 아님); 판정은 **상태 기준**(파생 시 pipeline.status가 CANCELLING인가)이지 시각 기준 아님 — 직전 확정분 누수·CAS race 방지; task 상태는 사실대로 보존(FAILED는 FAILED, CANCELLED는 미발사 task만), pipeline만 수렴; 입구 가드(terminal→CANCELLING 거부)는 결정 5 "terminal은 terminal"의 귀결로 자동 차단(4c에 명시) → 결정 1.1/4c, 5 (2026-06-14) |
| O28 | dispatch 멱등성 = **BFF가 검증하는 사실이 아니라 task에 요구하는 계약**으로 해소(task별 감사 표 아님 — dispatch는 외부 API라 BFF가 멱등성을 런타임에 알 수 없어 표를 채울 수 없음). job_id를 발급받아 폴링하는 모든 dispatch 작업이 멱등(이미-원하는-상태=성공, DELETE not-found=성공)을 보장하도록 task 등록 계약으로 요구·리뷰에서 강제(결정 3.2 연장), 비멱등은 거부; 실제 충족 검증 책임은 task 구현·IM 쪽 → 결정 3.1/3.2 (2026-06-14) |
| S26 | **WAITING_SLOT 상태 제거 (10→9종)** — slot 큐 대기 = `READY ∧ kind=TERRAFORM_JOB`로 표현(별도 상태 불요). admission 게이트가 `WAITING_SLOT→DISPATCHING`에서 `READY→DISPATCHING`(TF, COUNT(DISP\|RUN)<N)로 이동; retry 재큐는 `RUNNING→READY`; cancel은 `{BLOCKED,READY}→CANCELLED`. 근거: WAITING_SLOT은 READY와 **동작 동일**(둘 다 수동 대기·고유 복구 없음·취소 즉시 CANCELLED, slot 카운트는 `DISPATCHING\|RUNNING`만 세어 WAITING_SLOT 미포함) — 9개 상태 중 **유일하게 동작 차이를 kind-조건문으로 이전하지 않는 −1**(RUNNING↔WAITING_EXTERNAL 병합은 timeout=재시도/EXPIRED·cancel=drain/CANCEL 차이를 조건문으로 relocate하므로 비채택; DISPATCHING은 re-dispatch 복구라 유지). slot 큐 관측(깊이·순번)은 `COUNT(READY∧TF)`·admission 순서로 파생 — **S13의 "10종" supersede** → 결정 1.2/4b, state-machine.md (2026-06-15) |
| S27 | task 상세 조회 — task_check.detail = **kind 코드가 정의하는 타입 결과 그릇**(attempt.response 패턴; jsonb 유지, 컬럼 ALTER 없음), `type` 판별자로 인지(TERRAFORM_JOB postCheck = `{type:"TERRAFORM_LOG", logPointer, excerpt}`, GENERAL_JOB = `{type:"API_RESPONSE", …}`) — "타입 없는 json 봉투" 우려 해소, "terraform 로그"가 kind+type으로 인지됨. full terraform 로그는 BFF 미보존(`logPointer`로 IM 조회, detail엔 발췌만). API 표면 정정: `Check` 모델에 `name`·`detail`·`errorCode` 노출, `Attempt`에 `errorCode` 추가 — **DB(task_check/task_attempt)엔 이미 존재했고 api.md만 누락**이었음(스키마 추가 아님) → 결정 1.2/2, api.md (2026-06-15) |
| O19 | `task_check.observed` 어휘 = **원시 kind별 값 canonical**(폴링 RUNNING/SUCCEEDED/FAILED · 조건 MET/NOT_MET); 통합 verdict(DONE/PENDING/FAILED)는 `(kind, observed)`에서 파생 — 별도 통합 enum·detail 저장 안 함. 낮은 중요도 기본값(되돌리기 쉬움 — 소비자가 단일 enum 원하면 versioning으로 통합) → api.md, 결정 1.2 (2026-06-15) |
| O20 | `DISPATCH` task_check 행 = **attempts[] + checks[](kind=DISPATCH) 양쪽 노출**(attempt=액션 생애주기, DISPATCH check=그 호출 관측 — 서로 다른 grain이라 중복 아님; 머지 타임라인서 구분) → api.md, 결정 1.2 (2026-06-15) |
| S28 | task 상세 API 기본값 확정(낮은 중요도, 되돌리기 쉬움) — **name** = 호출 operation 식별자(어떤 API/동작; 요구 "각 phase가 어떤 API" 충족), **errorCode** enum = {CALL_TIMEOUT, EXECUTION_TIMEOUT, TTL_EXPIRED, IM_REJECTED, CHECK_ERROR, DISPATCH_NO_RESPONSE}(확장 가능; backpressure≠실패), **엔드포인트** = `GET …/tasks/{taskId}` 단일(머지 타임라인; §1.3 `/history` 표기 정정), **checks 페이지네이션** = Spring Pageable. **별도 결정으로 남김(중요·write-once): task_check.detail의 kind별 정확한 스키마 + full terraform 로그 조회 경로(logPointer·IM 로그 API 존재 여부·포인터 위임 vs BFF 프록시)** — 타입 그릇 패턴은 S27로 확정됨; **추적은 O29** → api.md, 결정 1.2/2, O29 (2026-06-15) |
| S29 | postCheck 의미 확정 — "terminal *직전*" + "상태 무영향"의 모순 해소. postCheck = **성공(DONE) 관측 시 발사되는, DONE 전이와 분리된(off critical path) best-effort 관측**(임계 경로 위 단계 아님). timeout/실패해도 task는 DONE 유지(전이 함수 미호출·append-only 관측 → status·fail_count·gate에 **구조적** 무영향); "RUNNING→postCheck→DONE" 중간 상태 없음. **1회성·fire-and-forget(A안)**: async 1발 → `task_check(POST_CHECK)` 1행 → 끝; 재시도 없음, **크래시로 DONE 확정 후 미기록이면 재발사 안 함**(reconciler는 terminal task 재방문 안 함 — 드문 유실 감수, 폴링 아님). 경계: **완료를 가르면 CHECK, 기록만 하면 postCheck**. §3.3 "복구 시 재실행 가능"을 A안(재발사 없음)으로 확정 → 결정 2/1.3, §3.3, state-machine.md (2026-06-15) |
| S30 | task_attempt.result vs API Attempt.outcome 표현 정리(**옵션 B, DB 무변경**) — `result(OK\|FAIL)`은 dispatch accepted 여부가 아니라 **attempt 전체의 terminal result**; dispatch 호출 성공/실패 관측은 `task_check(kind=DISPATCH)`·`response` 기록 여부로 판단. **EXECUTION_TIMEOUT은 별도 result enum이 아니라 `result=FAIL + error_code=EXECUTION_TIMEOUT`**. API `outcome`은 저장값 아닌 파생값(result=OK→SUCCEEDED · FAIL∧EXECUTION_TIMEOUT→EXECUTION_TIMEOUT · FAIL∧그외→FAILED). result enum(OK\|FAIL) 유지 → migration 변경 없음 → 결정 1.2, api.md/migrations (2026-06-15) |
| S31 | **Pipeline Definition 모델 = 3 layer** (Task catalog=코드 class / Default recipe=코드((type,provider)당, release version·metadata) / Custom recipe=데이터 override / Snapshot=불변 실행기록); **Custom Pipeline** = TargetSource별 편집 가능 override(편집마다 version +1, sparse, **full 교체**, 편집·생성 시 catalog 검증), 표준 target은 코드 default; resolution = (target,type) override 있으면 그것·없으면 (type,provider) default, **task row + snapshot 원자적 박제**; version 배치 = recipe-level 명시 version 없음(재현=snapshot·skip=task content-hash·편집감사=override +1); 무게=per-target cardinality라 default=코드가 제거; 신규 테이블 `custom_pipeline_recipe`(unique(target_source_id, type)) → 결정 7, orchestrator-design 1.2, migrations (2026-06-20) **→ v2 (개정 6판): Custom recipe 데이터 layer를 v2로 이관 — v1 = Default recipe(코드) + Snapshot 2 layer(v2-deferred.md)** |
| O10 | retry 새 run의 definition 버전 = **생성 시점의 현재 recipe**(default 현재 release·custom 현재 version) — 원 run 버전에 고정 안 함; 완료분 skip은 v1 미지원(full re-run, terraform 수렴), 도입 시 **task content-hash 비교**로 판정(결정 5 확장 경로 — content-hash가 stable key 역할) → 결정 7.3, 5 (2026-06-20) **→ v2 (개정 6판): skip-completed(content-hash)를 v2로 이관 — v1 재시도 = full re-run(v2-deferred.md)** |

---
