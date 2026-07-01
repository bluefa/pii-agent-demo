# Admin Pipeline Dashboard — 페이지별 기능 · API 매핑

ADR-016(도메인 모델) · ADR-021(실행 모델) 기준. 각 페이지의 **조회/액션/이동**을 나열하고,
그 정보를 제공하는 **API**를 매핑한다.

## 범례 · 전제

- ✅ **존재** — `docs/swagger/install-v1.yaml` 에 이미 정의됨(operationId 표기). 계약 정본이며
  `scripts/gen-api.mjs` → `lib/generated/install-v1.ts` 로 zod 스키마 생성(loose). route는 `.parse()`,
  client는 `z.infer`. 새 필드/엔드포인트는 **반드시 swagger 먼저** 수정 후 `npm run gen:api`.
- 🆕 **신규 필요** — pipeline 관련 API는 **현재 install-v1.yaml에 태그/경로가 전혀 없음**(확인 완료).
  아래 제안 경로는 초안이며, 확정 시 swagger에 먼저 반영해야 한다.
- 도메인 필드는 ADR-016 §Schema, 실행 필드는 ADR-021 Decision 2를 그대로 인용한다.

> **선확인 결론**: 사용자가 "빠졌을 것"이라 한 **서비스 상세 / target source 상세 / installation status**는
> 대부분 **이미 존재**한다(아래 ✅). 실제로 없는 것은 **pipeline/task 계열 전부**다.

### 도메인 데이터 원천 (ADR-016 / ADR-021)

| 테이블 | 컬럼(발췌) |
|---|---|
| `pipeline` | id, type(INSTALL/DELETE), target(=target_source_id), status(RUNNING/DONE/FAILED/CANCELLED), created_at, last_activity_at, **next_due_at, claimed_by, claimed_until, cancel_requested** |
| `task` | id, pipeline_id, seq, kind(TERRAFORM_JOB/CONDITION_CHECK), operation, status(BLOCKED/READY/IN_PROGRESS/DONE/FAILED/CANCELLED), fail_count, max_fail_count, error_code, started_at, ready_at, finished_at, next_check_at, ttl, polling_interval, execution_timeout |
| `task_attempt` | id, task_id, attempt_no, job_ids[], status, error_code, dispatch_response_code, dispatch_response_summary, started_at, finished_at |
| `task_check` | id, task_attempt_id, call_count, not_met_count, api_error_count, call_timeout_count, last_external_status, last_response_code, last_response_summary, last_checked_at |

---

## 1. 대시보드 — `admin/pipeline/dashboard`

### 조회 — 실시간 현황 (필터 무관, 순간값)

| 기능 | 데이터 | API |
|---|---|---|
| 동작 중 파이프라인 개수 | `count(pipeline WHERE status='RUNNING')` | 🆕 `GET /install/v1/pipelines/stats/live` |
| 전체 Worker 개수 | ADR-021 metric: `total worker count = activePodCount × workerPerPod` | 🆕 위와 동일 (⚠️ 아래 주의 1) |
| 동작 중 Terraform task 개수 | ADR-021 metric: concurrent TF-job / active TF tasks | 🆕 위와 동일 (⚠️ 주의 1) |

> **⚠️ 주의 1 — worker/TF 수치는 도메인 DB에 없다.** "Worker 개수", "동작 중 TF task 수"는 오케스트레이터
> 런타임 지표(ADR-021 *Key metrics*: active workers, total worker count, concurrent API calls)다. `pipeline`/`task`
> 테이블 count로 근사할 수는 있으나(`task WHERE kind='TERRAFORM_JOB' AND status='IN_PROGRESS'`), Worker 총수는
> **actuator/metrics 또는 오케스트레이터 전용 엔드포인트**에서 와야 한다. → **원천 결정 필요**: (a) BFF가
> orchestrator metrics를 프록시할지, (b) `IN_PROGRESS` task count로 근사할지.

### 조회 — 기간 통계 (기간 필터 연동)

| 기능 | 데이터 | API |
|---|---|---|
| Running 파이프라인 개수 | 기간 내 status별 집계 | 🆕 `GET /install/v1/pipelines/stats?period=1h\|1d\|7d` |
| 실패 파이프라인 개수 | 〃 (FAILED) | 〃 |
| 성공 파이프라인 개수 | 〃 (DONE) | 〃 |

> **⚠️ 주의 2 — "기간 내 Running" 의미 모호.** RUNNING은 순간 상태다. 기간 필터와 결합하면 "해당 기간에
> `created_at`이 속하고 아직 RUNNING인 것"으로 정의해야 한다. 집계 기준 컬럼(`created_at` vs `last_activity_at`)
> 을 명시할 것. → **정의 확정 필요.**

### 조회 — 파이프라인 목록 (행당)

| 컬럼 | 데이터 | 원천 |
|---|---|---|
| target | `pipeline.target`(=target_source_id) + **표시명** | 🆕 목록 API + ⚠️ 주의 3 |
| Cloud Provider | target source의 `cloud_provider` | ⚠️ 주의 3 |
| 파이프라인 상태 | `pipeline.status` | 목록 API |
| 진행 현황 N/M (task 기준) | `count(task DONE) / count(task)` per pipeline | 목록 API (서버 집계 권장) |
| 상세보기 | link → 4번 페이지 | — |

- 🆕 `GET /install/v1/pipelines?period=&status=&provider=&page=&size=` → `Page<PipelineSummary>`
  - `PipelineSummary`: `{ pipeline_id, type, target_source_id, target_name, cloud_provider, status, done_task_count, total_task_count, created_at, last_activity_at }`

> **⚠️ 주의 3 — pipeline 테이블엔 target 이름/CSP가 없다.** 도메인상 `pipeline.target`은 **target_source_id 하나뿐**이다.
> `target_name`·`cloud_provider`는 target-source에서 조인해야 한다. 서버가 조인해 `PipelineSummary`에 실어주는 것을
> 권장(행마다 `getTargetSourceDetail` N+1 호출 회피).

### 액션

| 액션 | 처리 |
|---|---|
| 기간 필터 (1시간/1일/7일) | 목록·통계 API `period` 쿼리 |
| 목록 필터 적용 | 목록 API `status`, `provider` 쿼리 |
| 페이지 이동 | 목록 API `page`, `size` (Spring Page 컨벤션, `PageServiceItem`과 동형) |

### 이동
- 행 상세보기 → 4. 파이프라인 상세 (`pipeline_id`)

---

## 2. 서비스·대상 검색 — `admin/pipeline/services`

| 기능 | API | 상태 |
|---|---|---|
| 서비스 코드 검색 결과 | `GET /install/v1/user/services/page?query=&page=&size=` — `getUserServices` → `PageServiceItem{content: ServiceItem{service_code, service_name}}` | ✅ |
| 선택 서비스의 target source id 목록 | `GET /install/v1/target-sources/services/{serviceCode}` — `getTargetSourcesByServiceCode` → `TargetSourceDetail[]` | ✅ |
| (참고) 서비스 권한 사용자 | `GET /install/v1/services/{serviceCode}/authorized-users` — `getServiceAuthorizedUsers` | ✅ |

> **서비스 "상세"**: 현재 `ServiceItem`은 `{service_code, service_name}`뿐이다. 그 이상(설명·소유팀 등)이
> 필요하면 신규 필드/엔드포인트를 정의해야 한다. 단순 목록 UX면 지금 스키마로 충분.

### 액션 / 이동
- 서비스 코드 검색 → `getUserServices`
- target source 선택 → 3. 대상 이력 (`target/{targetSourceId}`)

---

## 3. 대상 이력 페이지 — `admin/pipeline/target/{targetSourceId}`

### 조회 — TargetSource 메타데이터 (헤더) — ✅ 대부분 존재

`GET /install/v1/target-sources/{targetSourceId}` — `getTargetSourceDetail` → `TargetSourceDetail`

| 헤더 항목 | 필드 |
|---|---|
| CSP | `cloud_provider` (AWS/GCP/AZURE/IDC/UNKNOWN) |
| CSP 계정 정보 | `metadata.aws_account_id` / `subscription_id` / `gcp_project_id` / `tenant_id` |
| 서비스 이름 / 코드 | `service_name` / `service_code` |
| 설치 상태 (현재 설치 여부) | `process_status` (IDLE→…→INSTALLED→CONNECTED→COMPLETED) — ⚠️ 주의 4 |

> **⚠️ 주의 4 — "설치 상태"가 두 종류다.**
> - **라이프사이클 상태** = `process_status` (target이 설치 완료됐는지). 헤더의 "현재 설치 여부"는 이 값이 적합.
>   별도 조회는 `GET .../process-status` — `getProcessStatus` → `{process_status, healthy, evaluated_at}` (✅).
> - **리소스/검증 상태** = CSP별 installation-status (리소스 단위 설치·검증 상세):
>   `getAwsInstallationStatus` / `getInstallationStatus`(Azure) / `getGcpInstallationStatus` / `getIdcInstallationStatus` (모두 ✅).
> → 헤더엔 `process_status` 사용, 리소스 상세가 필요할 때만 CSP별 API 호출. **어느 것을 "설치 상태"로 볼지 확정.**

### 조회 — 최근 파이프라인 (상단 카드, 1건)

| 기능 | API |
|---|---|
| 최신 파이프라인 1건 (상태 무관) + 상태 표시 | 🆕 `GET /install/v1/target-sources/{targetSourceId}/pipelines/latest` → `PipelineSummary`(없으면 204/null) |

### 조회 — 이력 목록 (최근 1건 제외 과거)

| 기능 | API |
|---|---|
| 대상의 파이프라인 수행 이력 + 페이지네이션 | 🆕 `GET /install/v1/target-sources/{targetSourceId}/pipelines?page=&size=` → `Page<PipelineSummary>` |

> latest/history를 한 번에 주려면 `pipelines?page=0&size=N` 첫 행을 latest로 쓰고 목록에서 제외해도 된다.
> 별도 `latest` 엔드포인트는 카드 단독 갱신이 필요할 때만.

### 액션

| 액션 | API | 규칙 |
|---|---|---|
| 설치(INSTALL) 실행 — 항상 활성 | 🆕 `POST /install/v1/target-sources/{targetSourceId}/pipelines` `{type:"INSTALL"}` | **ADR-016 §4 유일성**: 이미 비-종료 파이프라인이 있으면 **에러 아님 — 기존 run 반환(200)**. |
| ↳ 실행 전 Pipeline 정보 확인 | 🆕 `GET /install/v1/target-sources/{targetSourceId}/pipelines/preview?type=INSTALL` → 실행될 recipe(순서 task 목록) | ADR-016 §2: recipe는 `(type, provider)` 코드 기본값. |
| 삭제(DELETE) 실행 — 항상 활성 | 🆕 `POST .../pipelines` `{type:"DELETE"}` | 위와 동일(유일성). |
| ↳ 실행 전 확인 | 🆕 `GET .../pipelines/preview?type=DELETE` | — |
| 최근 파이프라인 취소 — 동작 중일 때만 활성 | 🆕 `POST /install/v1/pipelines/{pipelineId}/cancel` | ADR-021 §6: idle→즉시 취소, live→cooperative. **서버 거절 시 사유(409/reason) 표시.** |

> **취소 활성 조건**은 `status='RUNNING'`. 취소 결과가 즉시 반영되지 않을 수 있음(cooperative cancel latency,
> ADR-021 §6) → UI는 낙관적 표시보다 재조회 권장.

### 이동
- 이력 행 클릭 → 4. 파이프라인 상세
- 헤더 대상명 → Target Source 관리 상세 (기존 target-source 페이지, 양방향 링크)

---

## 4. 파이프라인 상세 페이지

진입: 대시보드 목록 / 대상 이력 목록에서 `pipeline_id` 공유.

### 조회 — Pipeline 메타데이터

🆕 `GET /install/v1/pipelines/{pipelineId}` → `PipelineDetail`

| 항목 | 필드 (원천) |
|---|---|
| ID, 타입, target, 상태 | `id, type, target(+ 조인 target_name/cloud_provider), status` |
| 생성/마지막 활동 시각 | `created_at, last_activity_at` |
| 현재/최종 task | 현재 task = 최저 seq READY/IN_PROGRESS (ADR-016 §2 파생), 최종 task = max seq |
| 다음 예정 시각 | `next_due_at` |
| lease 점유 여부 | `claimed_until > now()` → boolean `leased` (⚠️ `claimed_by` 토큰 원본 노출 금지) |
| 취소 요청 여부 | `cancel_requested` |
| 실패 횟수/한계치 | 현재 task `fail_count / max_fail_count` |
| 지연 lag | `now() - next_due_at` (due-pipeline lag, ADR-021 metric) |

### 조회 — Task 흐름 시각화 (n8n 스타일, 읽기 전용)

| 항목 | 필드 | API |
|---|---|---|
| task 노드 그래프 (seq 순 선형) | `task[]`: `seq, kind, operation, status, fail_count, error_code, started_at, finished_at` | `PipelineDetail.tasks` 에 포함 or 🆕 `GET /install/v1/pipelines/{pipelineId}/tasks` |

> 흐름은 ADR-016상 선형 체인(2~4 task). 그래프라기보다 순차 스텝. n8n 스타일은 표현일 뿐 분기 없음.

### 조회 — Task 상세 패널 (노드 클릭 시)

🆕 `GET /install/v1/pipelines/{pipelineId}/tasks/{taskId}` → `TaskDetail`

| 항목 | 필드 (원천) |
|---|---|
| Task 상세 정보 | `task` 전체 컬럼 (kind, operation, ttl, polling_interval, execution_timeout, next_check_at 등) |
| 실행 내역 (attempt) | `task_attempt[]`: `attempt_no, job_ids, status, error_code, dispatch_response_code/summary, started_at, finished_at` |
| 폴링 요약 | `task_check` (attempt별 1건): `call_count, not_met_count, api_error_count, call_timeout_count, last_external_status, last_response_*, last_checked_at` |

> ADR-016 §3 관측 테이블: **최신 attempt만** 완료 판정에 쓰이지만, 상세 패널은 진단용으로 전체 attempt/그 요약을 노출.

### 액션

| 액션 | 처리 |
|---|---|
| task 노드 클릭 → 상세 패널 | 위 `TaskDetail` 조회 |
| 파이프라인 취소 — 동작 중일 때만 | 🆕 `POST /install/v1/pipelines/{pipelineId}/cancel` (3번과 동일 엔드포인트) |

---

## 신규 API 요약 (pipeline 계열 — 전부 🆕)

| # | Method | Path | 용도 |
|---|---|---|---|
| P1 | GET | `/install/v1/pipelines/stats/live` | 실시간 현황(running count, worker/TF — ⚠️주의1) |
| P2 | GET | `/install/v1/pipelines/stats?period=` | 기간 통계(running/failed/success) |
| P3 | GET | `/install/v1/pipelines?period=&status=&provider=&page=&size=` | 대시보드 목록 |
| P4 | GET | `/install/v1/pipelines/{pipelineId}` | 파이프라인 상세(메타+실행메타+tasks) |
| P5 | GET | `/install/v1/pipelines/{pipelineId}/tasks/{taskId}` | Task 상세(attempt/check) |
| P6 | POST | `/install/v1/pipelines/{pipelineId}/cancel` | 취소 (idle 즉시 / live cooperative) |
| P7 | GET | `/install/v1/target-sources/{targetSourceId}/pipelines` | 대상 이력 목록 |
| P8 | GET | `/install/v1/target-sources/{targetSourceId}/pipelines/latest` | 최근 1건 카드 |
| P9 | GET | `/install/v1/target-sources/{targetSourceId}/pipelines/preview?type=` | 실행 전 recipe 미리보기 |
| P10 | POST | `/install/v1/target-sources/{targetSourceId}/pipelines` | INSTALL/DELETE 실행(유일성: 기존 run 반환) |

**착수 순서**: swagger(install-v1.yaml)에 위 태그(`Pipelines`)·스키마(`PipelineSummary`, `PipelineDetail`,
`TaskDetail`, `PipelineStatsLive`, `PipelineStats`) 정의 → `npm run gen:api` → route `.parse()` / client `z.infer`.

## 이미 존재해 재사용하는 API (✅)

| 페이지 | 기능 | operationId |
|---|---|---|
| 2 | 서비스 검색 | `getUserServices` |
| 2 | 서비스별 target source 목록 | `getTargetSourcesByServiceCode` |
| 3 | target source 헤더 메타 | `getTargetSourceDetail` |
| 3 | 라이프사이클 설치 상태 | `getProcessStatus` |
| 3 | CSP별 리소스 설치/검증 상세 | `getAwsInstallationStatus` / `getInstallationStatus`(Azure) / `getGcpInstallationStatus` / `getIdcInstallationStatus` |

## 확정 필요 (open questions)

1. **worker/TF task 수치 원천** — orchestrator metrics 프록시 vs `IN_PROGRESS` task count 근사 (주의 1).
2. **"기간 내 Running" 정의** — 집계 컬럼(`created_at` vs `last_activity_at`) (주의 2).
3. **목록 target 조인** — 서버가 `target_name`/`cloud_provider`를 `PipelineSummary`에 실을지 (주의 3).
4. **"설치 상태" 정의** — `process_status`(라이프사이클) vs CSP installation-status(리소스) (주의 4).
5. **진행 N/M 계산** — CANCELLED/BLOCKED task를 분모/분자에 어떻게 셀지.
