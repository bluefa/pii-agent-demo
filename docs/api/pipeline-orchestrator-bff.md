# Pipeline Orchestrator BFF 계약 (LIN-25 D1)

admin 파이프라인 4페이지가 사용하는 **신규 BFF API 경로 전체 명세**와 페이지↔API 매핑.

- 업스트림: `pipeline-orchestrator` (Spring Boot). BFF 서버 뒤에서 서빙되므로 별도 env 없이
  **`BFF_API_URL` + `/install/v1`** 로 호출한다.
- 원칙: **응답 passthrough** — 업스트림의 응답 body(snake_case)·HTTP status를 그대로 브라우저에
  전달한다. camelCase 변환·필드 가공 금지. 에러 body(`{timestamp,status,code,message,path}`)도
  status 그대로 전파한다.
- CORS: 업스트림에 CORS 설정이 없으나, 브라우저는 same-origin인 BFF만 호출하므로 문제 없음
  (LIN-19의 CORS 갭은 이 구조로 우회 해소).
- mock: `USE_MOCK_DATA=true`일 때 `lib/bff/mock/pipeline*.ts`가 응답한다(코드 기본값은 real
  HTTP — 이 저장소의 로컬 `.env.local`(gitignore 대상)이 관례적으로 true를 설정할 뿐, 클린
  체크아웃은 env 미설정 시 `BFF_API_URL`로 프록시한다). mock 픽스처는
  `design/pipeline/admin-pipeline.html`의 mock 데이터(#123~#129)를 와이어 포맷
  (snake_case, ISO-8601)으로 이식한 것이다.

## 1. 신규 BFF 경로 (12개)

모든 경로는 **`withOrchestratorProxy` 래핑** Next.js route handler(`withV1` 사용 금지 — 아래 참조).
ESLint 경계에 따라 `@/lib/bff/client` 경유.

> **에러 passthrough가 ProblemDetails 변환보다 우선한다.** 이 도메인은 "업스트림 응답 그대로"가
> 요구사항이다. 기존 스택으로는 불가능하므로(`withV1`이 비-2xx body를 재작성하고, `httpBff`가
> 비-2xx에서 `BffError`를 던지며, `lib/fetch-json.ts`가 미등록 code의 message를 유실) 이 도메인은
> **전용 경로**를 쓴다:
> 1. `lib/bff/types.ts`의 pipeline 도메인 메서드는 비-2xx에서 던지지 않고
>    `{ status: number, body: unknown }` 형태(원문)를 반환한다 (`getRaw` 계열 기반 구현).
>    204는 `{ status: 204, body: null }`.
> 2. route는 `withV1` 대신 전용 래퍼 **`withOrchestratorProxy`**(`app/api/_lib/orchestrator.ts`
>    신설)를 쓴다 — async params 해소 + `x-request-id`만 담당하고, 업스트림 status·body를
>    verbatim으로 `NextResponse`에 싣는다. body 재작성 없음. 업스트림 연결 실패/타임아웃만
>    502 `{code:"ORCHESTRATOR_UNREACHABLE"}`로 응답.
> 3. CSR 헬퍼는 `app/lib/api/pipeline.ts` 전용 fetch 함수를 쓴다 — 비-2xx에서 업스트림 에러
>    body의 `{code, message}`·status·body를 보존한 **`Error` 서브클래스**(예:
>    `OrchestratorApiError extends Error`)를 던진다(`fetch-json.ts`의 generic 매핑을 타지 않음).
>    plain 객체 throw 금지 — `useApiMutation`이 비-Error throw를 `Error(String(err))`로 뭉개
>    구조화 필드가 유실된다. 409의 `ORCHESTRATION_PIPELINE_ALREADY_ACTIVE` 분기가 이 경로로
>    식별 가능해야 한다.

| # | BFF 경로 (브라우저 기준) | 업스트림 경로 (`BFF_API_URL` 기준) | 용도 |
|---|---|---|---|
| 1 | `GET /integration/api/v1/orchestrator/pipelines/statistics/live` | `GET /install/v1/pipelines/statistics/live` | 대시보드 "동작 중 · 현재" |
| 2 | `GET /integration/api/v1/orchestrator/pipelines/statistics?period={1h\|1d\|7d}` | `GET /install/v1/pipelines/statistics?period=` | 대시보드 기간 실패/성공 |
| 3 | `GET /integration/api/v1/orchestrator/pipelines?status&provider&period&page&size&sort` | `GET /install/v1/pipelines?…` | 대시보드 목록 |
| 4 | `GET /integration/api/v1/orchestrator/pipelines/{pipelineId}` | `GET /install/v1/pipelines/{pipelineId}` | 파이프라인 상세 |
| 5 | `GET /integration/api/v1/orchestrator/pipelines/{pipelineId}/tasks/{taskId}` | `GET /install/v1/pipelines/{pipelineId}/tasks/{taskId}` | Task 상세 모달·노드 meta |
| 6 | `POST /integration/api/v1/orchestrator/pipelines/{pipelineId}/cancel` | `POST /install/v1/pipelines/{pipelineId}/cancel` | 파이프라인 취소 |
| 7 | `GET /integration/api/v1/orchestrator/target-sources/{targetSourceId}/pipelines?page&size&sort` | `GET /install/v1/target-sources/{id}/pipelines?…` | 타겟 이력 (5건/페이지) |
| 8 | `GET /integration/api/v1/orchestrator/target-sources/{targetSourceId}/pipelines/latest` | `GET /install/v1/target-sources/{id}/pipelines/latest` | 타겟 최신 실행 (없으면 204) |
| 9 | `GET /integration/api/v1/orchestrator/target-sources/{targetSourceId}/pipelines/preview?type={INSTALL\|DELETE}` | `GET /install/v1/target-sources/{id}/pipelines/preview?type=` | 실행 미리보기 모달 |
| 10 | `POST /integration/api/v1/orchestrator/target-sources/{targetSourceId}/pipelines` body `{"type":"INSTALL"\|"DELETE"}` | `POST /install/v1/target-sources/{id}/pipelines` | 설치/삭제 시작 |
| 11 | `POST /integration/api/v1/orchestrator/target-sources/{targetSourceId}/pipelines/custom` body `{"tasks":[{"name","description?"}]}` | `POST /install/v1/target-sources/{id}/pipelines/custom` | custom recipe 실행 (빌더는 후속 이슈, 경로는 선제 제공) |
| 12 | `GET /integration/api/v1/orchestrator/task-definitions?provider` | `GET /install/v1/task-definitions?provider` | task 카탈로그 — operation 표시명 매핑 |

응답 shape·enum·에러 코드 전체는 업스트림 계약을 그대로 따른다(이 문서 §4 요약,
원계약은 pipeline-orchestrator 저장소 controller/dto).

## 2. 페이지 ↔ API 매핑

앱 라우트(App Router, `app/integration/admin/pipelines/**`, admin layout 상속):

| 디자인 라우트 | 앱 라우트 |
|---|---|
| `#/dashboard` | `/integration/admin/pipelines` |
| `#/services` | `/integration/admin/pipelines/services` |
| `#/target/:id` | `/integration/admin/pipelines/targets/[targetSourceId]` |
| `#/pipeline/:id` | `/integration/admin/pipelines/[pipelineId]` |

GNB: `lib/routes.ts`에 경로 상수 추가 + `TopNav.tsx` `NAV_ITEMS`에 "파이프라인" 항목 추가.

### 2.1 대시보드
- 카드1 "동작 중 파이프라인 · 현재" ← #1 `running_pipeline_count` (+`pending_pipeline_count`는 미표시)
- 카드2/3 "실패·{기간}" / "성공·{기간}" ← #2 `failed_count` / `done_count` (기간 seg 1h/1d/7d 동기화)
- 목록 ← #3 `period`(기간 seg 동기)·`status`·`provider` 필터는 서버로, `size=200&sort=createdAt,desc&sort=id,desc`
  1페이지를 받아 **클라이언트에서** TargetSourceId 부분 검색 + 우선순위 정렬(FAILED→RUNNING→PENDING→나머지, id desc)
  + 5건/페이지 페이지네이션. (업스트림에 검색·커스텀 정렬 없음 — §3-②·⑥ 근사 한계 명시)

### 2.2 서비스·대상 검색
- 좌측 서비스 목록/검색 ← **기존** `app/lib/api/index.ts`의 `getServicesPage` (신규 경로 아님)
- 우측 타겟 목록 ← **기존** `/integration/api/v1/services/[serviceCode]/target-sources` (배열 반환)
  + 행별 "파이프라인" 셀은 #8 latest를 **동시성 캡(≤6)** 으로 병렬 호출해
  `status ∈ {RUNNING, PENDING}`이면 pill+`#id`, 아니면 `—`. 타겟 수가 많으면 화면에 보이는
  행(현재 목록) 기준으로만 조회.
- 행 클릭 → 타겟 상세로 서비스 컨텍스트를 **쿼리 파라미터 `?svc={code}&svcName={name}`** 로만
  전달한다(프로토타입의 in-memory navState{serviceCode, serviceName, targetId, provider}를
  URL로 축약 — targetId·provider는 경로/응답에서 복원 가능해 생략. 이에 따라 파이프라인
  breadcrumb의 targetId 일치 가드는 드롭됨: `pipelineBreadcrumb.ts` 주석 참조, 의도적 편차)

### 2.3 타겟 상세
- IdentityBar CSP 메타(논리 그룹: CSP 연결 정보/실행 권한) ← 기존 앱 BFF target-sources **raw 상세**
  기반 신규 어댑터(기존 `getProject` 어댑터는 필요한 필드를 유실하므로 사용 불가).
  실스키마 매핑: `AWS Account`←`aws_account_id` · `Region Type`←`is_china_region`(true→"China",
  false→"Global") · `TF 실행 권한`←`grant_service_terraform_execution_permission`.
  디자인의 `Linked Account`는 실스키마에 없음 → **행 생략**(디자인의 null-필터 규칙 적용, §3-⑥).
  Azure(tenant/subscription)·GCP(project) 필드는 실스키마(`lib/generated/install-v1.ts`)에 있는
  것만 렌더 — 없으면 "이 CSP 유형은 연결 metadata가 없습니다" 폴백.
- 최신 실행 상태 바 ← #8 (200이면 이어서 #4로 상세 재조회 — 현재 task·error·cancel_requested·
  next_due_at은 summary에 없음; 204면 "실행 이력 없음" empty state)
- 시작 CTA는 게이팅 없이 상시 활성(R21 단일 CTA — 유형 선택은 모달 몫). 유일성은 #10의 409 `ORCHESTRATION_PIPELINE_ALREADY_ACTIVE`가 전담. process_status 게이팅은 제거됨(#542 — 페이로드가 더 이상 싣지 않음)
- 미리보기 모달 ← #9 `steps[]`(sequence/display_name/kind)
- 실행 ← #10. **409 `ORCHESTRATION_PIPELINE_ALREADY_ACTIVE`** 수신 시 #8 재조회 후 기존 run으로
  이동 + 토스트 "이미 진행 중인 파이프라인으로 이동합니다" (§3-③)
- 이력 테이블 ← #7 `size=5` (sort 미지정 — 업스트림 기본 `createdAt desc, id desc` 사용) (서버 페이지네이션이 디자인 PAGE_SIZE=5와 일치)
- 취소 ← #6 (게이팅: `RUNNING∪PENDING && !cancel_requested`)

### 2.4 파이프라인 상세
- IdentityBar·상태 바·Task 흐름 ← #4 (`tasks[]` = TaskSummary)
- 노드 meta line·Task 상세 모달 ← #5를 **페이지 로드 시 task 전체 병렬 조회(동시성 캡 ≤6)**
  — effective 값(주기/타임아웃/재시도 예산)·attempts·check는 TaskDetail에만 있고, meta line은
  READY/BLOCKED(effective)·DONE(시도/폴 수)·FAILED(maxFail) 전부에서 detail 필드를 요구하므로
  lazy로는 디자인 충실도를 만족할 수 없다(의도적 결정). 체인은 짧고(≤10) 로컬 서비스라 비용
  미미. detail 로딩 전에는 summary 기반 축약 meta 표시, 모달은 로드된 detail 재사용(재조회 없음).
- 노드/모달 제목의 task 표시명 ← #12 카탈로그를 1회 조회해 `task_definition → display_name` 매핑
  (fallback: operation enum 원문)
- 레시피 표시명/설명 ← 클라이언트 상수 맵(8개 RecipeDefinition; PROVIDERS 라벨 맵과 같은 성격).
  `type=CUSTOM`은 코드 원문 fallback
- 취소 ← #6

## 3. 디자인 ↔ 실제 API 갭 (오너 확인 필요)

1. **TTL 없음**: 디자인의 CONDITION_CHECK meta `주기 X · TTL Y · 한도 N회`에서 TTL에 해당하는
   필드가 업스트림에 없다(재시도 예산으로만 경계 — ADR-016). → **TTL 세그먼트 생략**하고
   `주기 X · 한도 N회`로 표기. 모달 실행 계약의 `polling / ttl` 행도 `polling [effective]`만 표기.
2. **검색·우선순위 정렬 없음**: #3은 `status/provider/period` 필터와 프로퍼티 정렬(`createdAt`)만
   지원. → 대시보드 검색·"실패→진행 중→최신순" 정렬·5건 페이지네이션은 클라이언트 처리
   (size=200 상한 — 초과분은 서버 totalElements로 안내).
3. **유일성 충돌 시 409**: 디자인 문구 "진행 중 run이 있으면 기존 run을 반환합니다"와 달리
   업스트림은 409 에러를 반환. → 409 핸들링으로 디자인 의도(기존 run 이동)를 재현
   (#8 latest 재조회 후 해당 run으로 이동 + 토스트).
4. **시각·기간 포맷**: 업스트림 Instant(ISO-8601 UTC) → 화면 `YYYY-MM-DD HH:mm`(Asia/Seoul),
   Duration(`PT10M`) → `10분`/`1시간 30분` 포맷터로 변환(표기만 변환, 데이터는 원본 유지).
5. **취소는 2단계**: 디자인 취소 모달 문구 "취소는 즉시 반영됩니다(idle/cooperative 구분 없음)"와
   달리 업스트림은 idle/PENDING이면 즉시 CANCELLED, 라이브 lease 중이면 `cancel_requested=true`만
   기록하고 워커가 다음 안전 지점에 반영한다(응답이 RUNNING+cancel_requested일 수 있음).
   → 모달 문구를 "대기 중이면 즉시 취소되고, 실행 중이면 다음 실행 사이클에 반영됩니다"로 교정,
   응답 상태 그대로 렌더(디자인의 "취소 요청됨" ftag·"취소 처리 대기 중" meta가 이 상태를 담당).
   성공 토스트도 상태에 따라 `#{id} 취소됨` / `#{id} 취소 요청됨`으로 분기.
6. **대시보드 정렬은 근사**: 클라이언트 정렬은 가져온 창(최신 200건) 안에서만 "실패 우선"이
   성립한다. 창 밖의 오래된 실패는 뒤 페이지로 밀리는 대신 노출되지 않음 — totalElements와
   창 크기가 다르면 목록 하단에 "최신 200건 기준" 안내를 붙인다.
7. **Identity 필드 축소**: 디자인의 `Linked Account`·`Region Type(문자열)`은 실스키마에 없음 —
   §2.3의 매핑대로 존재 필드만 렌더(디자인의 null-필터 규칙이 이를 자연 흡수).
8. **레시피 표시 문구는 백엔드 원문**: 프로토타입의 RECIPES 설명은 mock 문구였고, 실제 시스템의
   레시피 displayName/description은 업스트림 `RecipeDefinition` 카탈로그(P9 preview에도 동일
   문구 노출)가 원천이다. → `RECIPE_LABELS`는 프로토타입 문구가 아닌 **백엔드 원문**을 사용
   (의도적 편차 — 화면 문구와 API preview 문구의 일치가 우선).

## 4. 업스트림 계약 요약 (구현 참조용)

- 페이지네이션: Spring `Page<T>` envelope (`content[]`, `totalElements`, `totalPages`, `number`,
  `size`, `first`, `last`, …). `sort` 파라미터는 자바 프로퍼티명(`createdAt,desc`) — 응답 필드명
  (`created_at`)과 다름에 주의.
- enum: `PipelineStatus` PENDING/RUNNING/DONE/FAILED/CANCELLED ·
  `TaskStatus` BLOCKED/READY/IN_PROGRESS/DONE/FAILED/CANCELLED ·
  `PipelineType` INSTALL/DELETE/CUSTOM · `CloudProvider` AWS/GCP/AZURE/IDC ·
  `ErrorCode` JOB_FAILED/EXECUTION_TIMEOUT/CONDITION_NOT_MET/CHECK_ERROR/CALL_TIMEOUT/UNKNOWN_TASK ·
  기간 토큰 `1h|1d|7d`
- 에러 body: `{timestamp, status:"404 NOT_FOUND", code:"ORCHESTRATION_*", message, path}` —
  주요 코드: 400 INVALID_PARAMETER/UNSUPPORTED_RECIPE/UNKNOWN_TASK/TASK_PROVIDER_MISMATCH/
  TASK_DESCRIPTION_TOO_LONG, 404 PIPELINE_NOT_FOUND/TASK_NOT_FOUND, 409 PIPELINE_ALREADY_ACTIVE,
  503 PROVIDER_LOOKUP_FAILED
- `latest`(#8)는 실행 이력이 없으면 **204 No Content** — BFF도 204 그대로 전달, 클라이언트는
  204를 "이력 없음"으로 처리.
- `TaskDetail.definition`은 nullable, CONDITION_CHECK 카탈로그 항목은 `dispatch_api`/`result_api`
  **키 자체가 생략**(NON_NULL). `effective_execution_timeout`은 CONDITION_CHECK에서 null.
