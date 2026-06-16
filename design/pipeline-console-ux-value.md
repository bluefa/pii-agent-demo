# UX Value Catalog — Pipeline Admin Console (ADR-016)

> 최신 ADR-016 API(`b57126a`, `design/pipeline/api.md` + `state-machine.md` + `orchestrator-design.md` §1.2)가
> 파이프라인 관리 콘솔에 **추가로 가능하게 하는 UX**를 정리한다. 각 항목은 **구체적인 API 필드**에 묶었다.
> 목표: "어떤 필드가 어떤 화면 가치를 푸는가"를 한눈에 보고, 무엇이 아직 read-side에서 막혀 있는지 분리한다.
>
> 모델 출처(요약): `Task{ name, kind, status, dependsOn, failCount/maxFailCount, latestCheck }`,
> `Attempt{ response, errorCode, outcome }`, `Check{ kind, name, apiResult, observed, errorCode, checkedAt, detail }`,
> `errorCode ∈ {CALL_TIMEOUT, EXECUTION_TIMEOUT, TTL_EXPIRED, IM_REJECTED, CHECK_ERROR, DISPATCH_NO_RESPONSE}`.

---

## A. 새로 가능해진 UX (각 항목 = API 필드 ↔ 화면 가치)

### 1. 노드별 동작(operation) 라벨 — `Check.name` / `Attempt`가 가리키는 operation
- **필드**: `Check.name` (= 호출 operation 식별자, 예 `im.terraformApply`, `im.jobStatus`). dispatch attempt도 같은 operation 그릇을 공유.
- **가치**: 각 노드/단계가 "**어떤 API/동작**"인지 이름으로 표기 → 기존 "단계 1·2·3" 무의미 라벨 대체. 노드 헤더 = TaskKind 배지 + operation 이름.
- **근거**: 결정 S28("name = 호출 operation 식별자; 요구 '각 phase가 어떤 API' 충족").

### 2. 타입드(typed) 결과 렌더링 — `Check.detail{ type, … }`
- **필드**: `Check.detail` = kind 코드가 정의하는 **타입 결과 그릇**, `type` 판별자로 분기.
  - `TERRAFORM_JOB` postCheck → `{ type: "TERRAFORM_LOG", logPointer, excerpt }`
  - `GENERAL_JOB` → `{ type: "API_RESPONSE", … }`
- **가치**: "타입 없는 json 봉투" 대신 type별 전용 렌더러. Terraform 노드 인스펙터는 **`excerpt`(로그 발췌)를 코드블록으로** 보여주고, `logPointer`는 "**IM 전체 로그 열기**" 링크로 (BFF는 full 로그 미보존 → 포인터 위임). API_RESPONSE는 JSON viewer.
- **근거**: 결정 S27("kind+type으로 인지; full 로그는 logPointer로 IM 조회, detail엔 발췌만").

### 3. errorCode 진단 칩 — `Attempt.errorCode` / `Check.errorCode`
- **필드**: `errorCode` enum 6종.
- **가치**: 실패를 "빨강 X"가 아니라 **원인별 진단 칩**으로. 칩별 카피/조치를 1:1 매핑:
  - `CALL_TIMEOUT` → "호출 응답 없음(재시도 대상)" · `EXECUTION_TIMEOUT` → "작업이 실행 한도 초과(재dispatch)"
  - `TTL_EXPIRED` → "외부 대기 TTL 초과(파이프라인 실패)" · `IM_REJECTED` → "IM이 거부(입력/권한 확인)"
  - `CHECK_ERROR` → "상태 확인 자체 오류" · `DISPATCH_NO_RESPONSE` → "dispatch 무응답(복구 timeout)"
- **가치 추가**: backpressure(429/503)는 `errorCode` 미해당 → "실패 아님 / requeue"로 **칩을 안 띄움**(오탐 방지).
- **근거**: 결정 S28(errorCode enum 확정) + api.md("429/503은 실패 아님").

### 4. attempt+check 머지 타임라인 — O20: dispatch가 양쪽에 노출
- **필드**: `GET …/tasks/{taskId}` → `{ attempts[], checks{content[]} }`. dispatch는 `attempts[]`(액션 생애주기)와 `checks[](kind=DISPATCH)`(그 호출 관측) **양쪽**에 등장.
- **가치**: 한 노드를 열면 **dispatch→poll→post-check가 시간순으로 머지된 단일 타임라인**. dispatch 두 grain을 "발사(attempt)"와 "관측(DISPATCH check)"으로 **구분 표시**해 중복처럼 보이지 않게 한다.
- **근거**: O20 해소("서로 다른 grain이라 중복 아님; 머지 타임라인서 구분").

### 5. check = aggregate(집계) 기본 표시 — `Task.latestCheck` + checks summary
- **필드**: `Task.latestCheck{ checkedAt, observed, apiResult }`; 상세에서 `checks` summary(count + last `checkedAt` + last `observed`).
- **가치**: WAIT_EXTERNAL은 행이 수백 개 → 기본은 **"확인 N회 · 마지막 14:31 · observed=NOT_MET" 한 줄 집계**. 개별 폴링은 접어두고 notable(ERROR/PENDING/전이)만 펼침. 노드 카드는 `latestCheck`만으로 라이브 상태 표시.
- **근거**: 프롬프트 "check is shown as AGGREGATE by default" + api.md(checks 페이지네이션, notable only).

### 6. 9-상태 → 보드 라벨 매핑 — `Task.status`
- **필드**: `Task.status ∈ {BLOCKED, READY, DISPATCHING, RUNNING, WAITING_EXTERNAL, DONE, FAILED, EXPIRED, CANCELLED}`.
- **가치**: 9개 내부 상태를 운영자용 6 라벨로 축약(orchestrator-design §1.2):

  | 내부 status | 보드 라벨 | 노드 색 |
  |---|---|---|
  | `BLOCKED` / `READY` | 대기 | amber / dashed |
  | `DISPATCHING` / `RUNNING` | 실행 중 | blue(pulse) |
  | `WAITING_EXTERNAL` | 외부 대기 | amber |
  | `DONE` | 완료 | green |
  | `FAILED` | 실패 | red |
  | `EXPIRED` | 타임아웃 | red |
  | `CANCELLED` | 중단 | grey |

- **핵심**: **`WAITING_SLOT`은 제거**됨 → "slot 큐 대기"는 별도 상태가 아니라 **`status=READY ∧ kind=TERRAFORM_JOB`**로 파생 표시(작은 "slot 대기" 보조 배지).
- **근거**: state-machine §1.2 표, S26(WAITING_SLOT 제거).

### 7. slot 게이지 — `GET /admin/pipelines/concurrency` → `{ slotsInUse, slotCap }`
- **필드**: `slotsInUse / slotCap`.
- **가치**: 보드 헤더에 **`slotsInUse/slotCap` 게이지**(예 3/5). TERRAFORM_JOB이 왜 `READY`에 멈춰 있는지("slot 만석") 즉시 설명 → 6번의 "slot 대기" 배지와 연결.
- **근거**: api.md §5(concurrency), settings.`slotCap`.

### 8. 다음 확인 카운트다운 — (현재는 파생) `Task.latestCheck.checkedAt` + settings.`jobPollCadenceSec`
- **필드**: `latestCheck.checkedAt` + settings(`jobPollCadenceSec` / `waitExternalPollingGuardMin`).
- **가치**: "다음 확인 14:32 (약 N분 후)" 카운트다운으로 **외부 대기가 멈춘 게 아니라 폴링 주기 안에 있음**을 보여줘 불안한 수동 새로고침을 줄임.
- **주의**: 정확한 값(`nextCheckAt`)은 **아직 API에 없음** → §B-1 gap. 현재는 cadence로 근사만 가능(주의 표기 필요).

### 9. retry = 새 run 계보(lineage) — `POST …/retry` → `{ newPipelineId }`
- **필드**: 응답 `newPipelineId` (재개가 아니라 **새 run** 생성, 결정 5).
- **가치**: 재시도 시 화면이 자동으로 **새 파이프라인으로 네비게이트**하고 "이 run은 #{old}의 재시도"라는 계보 배너 표시. 완료분은 terraform 수렴으로 no-op임을 안내.
- **주의**: 새 run에서 **거꾸로** 원본을 가리키는 `retryOf` 백링크가 없음 → §B-4 gap(현재는 forward `newPipelineId`만).
- **근거**: api.md §2(retry = 새 run), 결정 5.

### 10. systemic health 조기 경보 — `GET /admin/pipelines/events` `severity=CRITICAL`
- **필드**: `PipelineEvent{ type, severity(INFO|CRITICAL), message }`, 특히 `WORKER_OUTAGE_SUSPECTED`.
- **가치**: 개별 timeout을 노드별로 흩뿌리는 대신, **EXECUTION_TIMEOUT 연속 발생을 단일 critical 알림으로 롤업**해 보드 상단 배너("워커 장애 의심")로 조기 경보. circuit breaker 제거 후 유일한 systemic 신호.
- **근거**: decision-history(연속 timeout → 단일 critical `WORKER_OUTAGE_SUSPECTED` 롤업), O7/결정 4d.

---

## B. 아직 막혀 있는 read-side gap (UX는 원하나 API 필드 없음)

> DB(`task` row)에는 있으나 **API `Task` 모델(api.md)에 노출 안 된** 필드, 또는 **엔드포인트 자체가 없는** 것들.
> 이 항목들은 위 UX를 "정확하게" 만들려면 read 표면 추가가 선행돼야 한다.

1. **Task 타이밍 필드 미노출 — `nextCheckAt` / `deadlineAt` / `checkCount`**
   - DB `task`에 `next_check_at`, `deadline_at`, `last_checked_at`가 **존재**(orchestrator-design §1.2)하고, §3은 "운영자가 '다음 확인 14:32'를 본다"고 명시하지만 **api.md의 `Task` 모델은 이 중 어느 것도 노출하지 않음**(`latestCheck`만 있음).
   - 막히는 UX: §A-8 정확한 카운트다운, 외부 대기 **deadline 바**(TTL까지 남은 시간), 노드 헤더의 누적 **확인 횟수(`checkCount`)**.

2. **task definition 조회 엔드포인트 없음**
   - DAG의 **정적 형태**(노드 set, `dependsOn` 그래프, 각 task의 기대 kind/operation)를 run **시작 전**에 그리거나, 빈 캔버스를 미리 보여줄 방법이 없음. 현재 그래프는 `GET /pipelines/{id}`의 **인스턴스 tasks[]**에서만 역산.
   - 막히는 UX: run 생성 전 미리보기, "정의 vs 실제 run" diff, 정의 버전 라벨(`definition_version`은 DB엔 있으나 API 미노출).

3. **health aggregate 엔드포인트 없음**
   - `concurrency`(slot)와 `events`(롤업 알림)는 있으나, **systemic 상태를 한 번에 주는 집계**(최근 timeout율, 실패 task 수, 큐 적체, 워커 의심도)가 없음.
   - 막히는 UX: §A-10을 배너가 아니라 **상시 health 위젯/신호등**으로 만들려면 events 클라이언트 집계에 의존해야 함(부정확).

4. **`retryOf` 역참조 없음**
   - `retry`는 `newPipelineId`(forward)만 반환. 새 run에서 **"무엇의 재시도인지"** 거꾸로 가리키는 `retryOf`가 `PipelineSummary`/`Pipeline`에 없음.
   - 막히는 UX: §A-9 계보 배너를 새 run 단독 조회로 못 그림(직전 화면 컨텍스트에 의존). 보드 목록에서 재시도 체인 묶음 표시 불가.

---

## C. 우선순위 메모

- **즉시 가능(필드 이미 있음)**: A-1, A-2, A-3, A-4, A-5, A-6, A-7, A-9(forward), A-10 — 추가 API 없이 인스펙터/노드/보드 헤더 구현 가능.
- **부분 가능(근사)**: A-8(cadence 근사) — 정확화는 B-1 선행.
- **read 표면 추가 선행**: B-1(타이밍 3필드)가 ROI 최고 — 외부 대기 UX(카운트다운·deadline·확인 횟수)를 한꺼번에 정확화. 그다음 B-4(`retryOf`, 작은 추가, 계보 UX 완성).
