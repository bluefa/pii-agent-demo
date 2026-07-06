# 파이프라인 어드민 — 페이지별 API 호출 흐름 (유저 시나리오)

> 4개 페이지가 언제, 왜, 어떤 API를 호출하는지를 운영자 시나리오 순서로 설명한다.
> 경로·에러 계약의 단일 권위는 [pipeline-orchestrator-bff.md](pipeline-orchestrator-bff.md)
> (§1 12경로 표, §3 의도적 편차 ①~⑧) — 이 문서는 그 계약이 화면에서 어떻게
> 소비되는지의 관점이다. 코드 기준: `app/lib/api/pipeline.ts`(CSR 헬퍼 12종)와
> 각 페이지 컴포넌트의 실제 호출부에서 확인한 내용.

## 0. 호출 구조와 CRUD 요약

모든 호출은 2-hop이다:

```
브라우저(CSR)
  → app/lib/api/pipeline.ts 헬퍼
  → /integration/api/v1/orchestrator/** (Next.js BFF 라우트, same-origin)
  → BFF_API_URL /infra-install/v1/** (verbatim proxy — 응답 body·status 그대로)
```

CRUD 관점으로 보면 이 도메인은 **읽기 9 + 생성 2 + 취소 1**이다:

| CRUD | 호출 | 비고 |
|---|---|---|
| **C**reate | `POST …/target-sources/{id}/pipelines` (설치·삭제 생성), `POST …/pipelines/custom` | "삭제 시작"도 HTTP DELETE가 아니라 **type=DELETE 파이프라인 생성**이다 |
| **R**ead | 통계 2종·목록·상세·task 상세·타겟 이력·latest·preview·task 카탈로그 | 아래 페이지별 상세 |
| **U**pdate | `POST …/pipelines/{id}/cancel` | 유일한 상태 변이. 2단계 시맨틱(§3-⑤): 대기 중이면 즉시 CANCELLED, 실행(leased) 중이면 `cancel_requested=true`만 |
| **D**elete | 없음 | 파이프라인 레코드를 지우는 API는 존재하지 않는다 |

에러는 전부 `OrchestratorApiError { status, code, message, body }`로 던져진다
(업스트림 에러 body passthrough). 오케스트레이터가 죽어 있으면 BFF가
`502 ORCHESTRATOR_UNREACHABLE`을 만든다.

---

## 1. 대시보드 — `/integration/admin/pipelines`

> **시나리오**: 운영자가 아침에 접속해 "지난 24시간 동안 실패한 파이프라인이
> 있나?"를 확인하고, 실패 건을 찾아 상세로 들어간다.

### 진입 시 (병렬 2묶음)

| 호출 | BFF 경로 | 화면 |
|---|---|---|
| `getLiveStatistics()` | `GET /orchestrator/pipelines/statistics` | "동작 중" stat 타일 (실시간 — "· 현재" 라벨) |
| `getPipelineStatistics(period)` | `GET /orchestrator/pipelines/statistics/period?period=1d` | "실패 / 성공" stat 타일 (선택 기간 기준) |
| `listPipelines({period, page:0, size:200, sort:['createdAt,desc','id,desc']})` | `GET /orchestrator/pipelines?…` | 파이프라인 목록 (Spring Page) |

### 조작별 재조회 규칙

- **기간 seg(1h/1d/7d) 변경** → 통계 2종 + 목록 **모두** 재조회 (기간은 페이지 전역 컨트롤).
- **상태·CSP 필터 변경** → **목록만** 재조회 (서버 필터).
- **검색어 입력 / 페이지네이션(5건씩)** → **재조회 없음.** 최신 200건 창(`DASH_FETCH_SIZE`)
  안에서 순수 클라이언트 필터·정렬이다(§3-②). 200건 초과분이 잘리면 화면이 근사임을 밝힌다.
- **행 클릭** → `/pipelines/{pipelineId}` 상세로 이동 (API 호출 없음 — 목록 데이터로 라우팅만).
- 통계 호출이 실패하면 타일은 `—`로 조용히 강등되고, 에러 표면은 목록 영역이 담당한다.

---

## 2. 서비스·대상 검색 — `/integration/admin/pipelines/services`

> **시나리오**: 운영자가 "결제 서비스의 어떤 타겟이 지금 파이프라인을 돌리고
> 있지?"를 찾는다. 서비스를 고르면 그 서비스의 타겟 목록과 각 타겟의 최신 실행
> 상태가 한눈에 보인다.

### 진입 시

| 호출 | 출처 | 화면 |
|---|---|---|
| `getServicesPage(0, 200)` | **기존 앱 API** (orchestrator 아님) | 좌측 서비스 목록 (검색은 클라이언트 필터) |

### 서비스 선택 시

| 호출 | 출처 | 화면 |
|---|---|---|
| `getProjects(serviceCode)` | **기존 앱 API** `/services/{code}/target-sources` | 우측 타겟 테이블 |
| `getLatestPipelineByTarget(targetSourceId)` × 타겟 수 | `GET /orchestrator/target-sources/{id}/pipelines/latest` | 행별 "최신 실행" 셀 |

- latest 배치는 `runWithConcurrency(…, 6)`으로 **동시 6개 제한** 팬아웃.
  서비스를 바꾸면 `shouldContinue` 가드로 이전 배치의 남은 호출을 중단한다.
- latest가 **204**면 `null` → 셀에 "없음" (파이프라인 이력이 없는 타겟).
- **타겟 행 클릭** → `/pipelines/targets/{targetSourceId}?svc={code}&svcName={이름}`
  으로 이동 — svc 쿼리파람이 breadcrumb 컨텍스트를 운반한다(navState).

---

## 3. 타겟 상세 — `/integration/admin/pipelines/targets/[targetSourceId]`

> **시나리오 A (조회)**: 특정 타겟의 현재 상태와 과거 실행 이력을 본다.
> **시나리오 B (설치/삭제 실행)**: 이 타겟에 설치(또는 삭제) 파이프라인을 시작한다.
> **시나리오 C (취소)**: 진행 중인 실행을 멈춘다.

### 진입 시 (병렬 4묶음)

| 호출 | BFF 경로 | 화면 |
|---|---|---|
| `getRawTargetSourceDetail(id)` | **기존 라우트 재사용** `GET /integration/api/v1/target-sources/{id}` | IdentityBar (CSP 연결 정보 — aws_account_id, China/Global 등, §3-⑦ 실스키마 매핑) |
| `getTaskDefinitions()` | `GET /orchestrator/task-definitions` | task enum → 한글 표시명 카탈로그 (상태바의 현재 task명) |
| `getLatestPipelineByTarget(id)` → 있으면 `getPipeline(latest.pipeline_id)` | `…/pipelines/latest` → `…/pipelines/{id}` | "파이프라인 상태" 바 (RUNNING/PENDING이면 취소 버튼·진행도) |
| `listPipelinesByTarget(id, {page, size:5})` | `GET /orchestrator/target-sources/{id}/pipelines?page=…` | "파이프라인 이력" 테이블 (서버 페이지네이션 5건) |

latest가 204(이력 없음)면 상태바는 빈 상태를 보여준다. [설치 시작]·[삭제 시작]은
**항상 활성**(R18 오너 결정 — 게이팅 제거)이며, 중복 실행 충돌은 서버의 409
`ALREADY_ACTIVE` → latest 재조회·이동 플로우(§3-③)가 전담한다.

### 시나리오 B — 설치(삭제) 시작 → 미리보기 → 실행

1. **[설치 시작] 클릭** → PreviewModal 열림 →
   `previewRecipe(id, 'INSTALL')` = `GET …/pipelines/preview?pipeline_type=INSTALL`
   → 레시피 단계 목록(0-base sequence)을 실행 **전에** 보여준다.
2. **[실행] 클릭** → `createPipeline(id, {type})` = `POST …/target-sources/{id}/pipelines`
   - **성공(201)** → 모달 닫고 토스트 "…파이프라인이 실행됐어요" → 생성된
     파이프라인 상세로 이동.
   - **409 `ORCHESTRATION_PIPELINE_ALREADY_ACTIVE`** (다른 운영자가 먼저 실행한
     레이스) → `getLatestPipelineByTarget` **재조회** 후 그 활성 run 상세로 이동
     + 토스트 "이미 진행 중인 파이프라인으로 이동합니다"(§3-③). 재조회마저
     실패/204면 "확인에 실패했습니다 — 새로고침 후 다시 시도하세요".
3. 삭제도 동일 흐름, `type: 'DELETE'`만 다르다.

### 시나리오 C — 취소

1. 상태바 **[취소] 클릭** → CancelModal ("대기 중이면 즉시 취소되고, 실행 중이면
   다음 실행 사이클에 반영됩니다").
2. **확인** → `cancelPipeline(pipelineId)` = `POST /orchestrator/pipelines/{id}/cancel`
3. 응답 detail의 status로 **토스트 분기**(§3-⑤ 2단계 취소):
   - `CANCELLED` → "#N 취소됨" (idle/PENDING이었던 경우 — task 캐스케이드 취소 완료)
   - 그 외(RUNNING 유지 + `cancel_requested=true`) → "#N 취소 요청됨"
4. 성공 시 페이지 데이터 리로드(reloadKey) — 상태바·이력이 새 상태를 반영.

> custom 파이프라인 생성(`createCustomPipeline` = `POST …/pipelines/custom`)은
> 헬퍼·BFF 경로가 준비돼 있지만 **UI 미구현**(B2/LIN-22 레시피 빌더에서 사용 예정).

---

## 4. 파이프라인 상세 — `/integration/admin/pipelines/[pipelineId]`

> **시나리오**: 대시보드에서 FAILED 행을 클릭해 들어와 "몇 번째 task가 왜
> 실패했나"를 파악하고, 필요하면 남은 실행을 취소한다.

### 진입 시 (순차 → 팬아웃)

1. `getPipeline(pipelineId)` = `GET /orchestrator/pipelines/{id}`
   → IdentityBar + 상태바 + Task 흐름(좌우 스크롤 노드) 렌더.
   **404**면 notfound 화면 (잘못된 URL·삭제된 리소스).
2. 상세 도착 후 병렬:
   - `getTaskDefinitions(detail.cloud_provider)` — task 한글 표시명 카탈로그.
   - **task 전체 프리페치**: task마다 `getTaskDetail(pipelineId, taskId)` =
     `GET …/pipelines/{id}/tasks/{taskId}` 를 `mapPool` **동시 6개** 제한으로
     팬아웃. 라우트 이탈 시 `shouldContinue`로 남은 launch를 중단하고,
     개별 실패는 `null` 슬롯으로 남긴다(모달에서 재시도).

### Task 노드 클릭 → Task 상세 모달

- 프리페치된 detail이 있으면 **API 호출 없이** 즉시 모달 렌더
  (effective 재시도 한도·TTL, attempts 시도 이력 테이블, error_code, raw response).
- 프리페치가 실패했던 task면 모달이 "일부 정보를 불러오지 못했습니다" +
  **[다시 시도]** → 해당 task만 `getTaskDetail` 1건 재호출.

### 취소

타겟 상세와 동일한 CancelModal/`cancelPipeline` 흐름(§3 시나리오 C). 취소 응답의
detail로 화면 상태를 즉시 갱신한다.

---

## 5. 페이지 × BFF 경로 매트릭스

| # | 메서드·경로 (`/integration/api/v1/orchestrator` 이하) | 대시보드 | 서비스 검색 | 타겟 상세 | 파이프라인 상세 |
|---|---|:-:|:-:|:-:|:-:|
| 1 | `GET /pipelines/statistics` | ● | | | |
| 2 | `GET /pipelines/statistics/period` | ● | | | |
| 3 | `GET /pipelines` | ● | | | |
| 4 | `GET /pipelines/{id}` | | | ●(latest 상세) | ● |
| 5 | `GET /pipelines/{id}/tasks/{taskId}` | | | | ●(프리페치·재시도) |
| 6 | `POST /pipelines/{id}/cancel` | | | ● | ● |
| 7 | `GET /target-sources/{id}/pipelines` | | | ●(이력) | |
| 8 | `GET /target-sources/{id}/pipelines/latest` | | ●(행별 배치) | ● | |
| 9 | `GET /target-sources/{id}/pipelines/preview` | | | ●(모달) | |
| 10 | `POST /target-sources/{id}/pipelines` | | | ●(설치·삭제 생성) | |
| 11 | `POST /target-sources/{id}/pipelines/custom` | | | (UI 미구현 — LIN-22) | |
| 12 | `GET /task-definitions` | | | ●(카탈로그) | ●(카탈로그) |

orchestrator 외 호출: 서비스 검색의 `getServicesPage`/`getProjects`, 타겟 상세의
`getRawTargetSourceDetail`(기존 `/integration/api/v1/target-sources/{id}` 재사용).
