# Admin 운영 콘솔 (Task Queue) — 스토리보드 & API Set

> 출처: 사용자 요구(Dashboard / 연동 요청 확인 / PII Agent 승인 조회) + `docs/api-docs.yaml` 실계약 대조.
> 기존 `app/admin/pipelines/**` 자산(공유 컴포넌트·레이아웃) 재사용을 전제로 한다.
> 확정 사항(사용자 승인): **① Task Queue = 별도 그룹**, **② 승인/반려 = `install/v1` 계약 채택**.

> **이후 변경(2026-07-28)**: P4 `연결 테스트 목록` / P5 `연결 테스트 상세` 페이지는 삭제되고 운영 콘솔로
> 흡수됐다. P5 상세의 기능은 `운영 콘솔 > Target Source 운영`의 **Test Connection 탭**이 이미 상위집합으로
>제공하고 있었고, P4 목록의 `재실행 요청` 건은 **운영 알림**의 알림 종류로 합쳐졌다(`완료` 건은 기존
> `연결 테스트 검토` 카드가 이미 담당). 사이드바 `Task Queue > 연결 테스트` 항목도 함께 제거됐다.
> 아래 P4/P5 절은 당시 설계 기록으로 남긴다.

---

## 0. IA / 네비게이션 변경

### 0.1 상단 네비게이션
- `TopNav.tsx`의 **`파이프라인`** 항목명을 **`관리자`** 로 변경 (라벨만; href·활성 판정은 `/admin/pipelines` 유지).
- "관리자" 진입 = 기존 파이프라인 오케스트레이션 영역, 그 안에서 sub-menu로 분기.

### 0.2 사이드바(sub-menu) 재구성 — `app/admin/pipelines/layout.tsx`
현재 `SIDEBAR_ITEMS`는 평평한 2개. 그룹 헤더 2개로 재편:

```
파이프라인 오케스트레이션        ← 기존 (그대로)
  · 대시보드              /admin/pipelines
  · 서비스·대상 검색       /admin/pipelines/services

Task Queue (연동 운영)          ← 신규 그룹 (별도 데이터 소스: install/v1 BFF)
  · 운영 대시보드          /admin/pipelines/queue
  · 연동 요청             /admin/pipelines/queue/requests
  · 연결 테스트           /admin/pipelines/queue/test-connections
```

- 신규 Task Queue는 `install/v1/*` BFF 기반으로, 기존 오케스트레이터 대시보드(별도 Spring, `statistics/live`)와 **데이터 소스가 다르다** → 같은 "관리자" 탭 아래 **별도 그룹**.
- 라우트 베이스 `/admin/pipelines/queue` 는 조정 가능. 상세는 drill-down(사이드바 비활성).
- `lib/routes.ts` `integrationRoutes.pipelines` 에 `queue` 서브트리 추가.

---

## 1. 공통 개념 — ProcessStatus ↔ Step1~7 (재사용 핵심)

`install/v1/process-statuses`의 `process_status` enum이 기존 연동 마법사 Step1~7과 1:1 대응한다. 이 매핑 테이블 **하나**를 만들어 대시보드·요청·상세 어디서나 재사용한다.

| ProcessStatus | Step | 표기(한글) |
|---|---|---|
| `IDLE`      | 1 | 연동 대상 DB 선택 |
| `PENDING`   | 2 | 연동 대상 승인 대기 |
| `CONFIRMING`| 3 | 연동 대상 반영중 |
| `CONFIRMED` | 4 | Agent 설치 |
| `INSTALLED` | 5 | 연결 테스트 |
| `CONNECTED` | 6 | 관리자 승인 대기 |
| `COMPLETED` | 7 | 완료 |

- 구현: `stepModel.ts` — `PROCESS_STATUS_STEP: Record<ProcessStatus, {step:number; label:string}>` + `StepPill`(step 번호 + 라벨) 컴포넌트.
- 기존 `_components/StatusPill.tsx`·`PipelineProgressBar.tsx` 톤 재사용, 라벨 소스만 이 테이블로.

> **주의(축 분리)**: `target-sources/page`의 **`confirmStatus`** enum은 위 ProcessStatus와 **다른 축**이다.
> - 쿼리 필터 값: `NO_REQUEST · PENDING · CONFIRM_INFO_UPDATE_REQUIRED · CONFIRMED · REJECTED`
> - 응답(`TargetSourceInfo.confirmStatus`) 값: `IDLE · PENDING · UNAVAILABLE · CONFIRMING · RESOURCE_CLEANING · RESOURCE_CLEAN_FAILED · CONFIRMED`
> - `REJECTED`는 **쿼리로만** 걸 수 있고 응답 enum엔 없음. 연동 요청 화면(§3)의 "프로세스 상태" 컬럼은 이 `confirmStatus`를 쓰고, 대시보드 모니터(§2)는 `process_status`(Step 축)를 쓴다 — **두 축을 섞지 말 것**.

---

## 2. 페이지 목록 (총 4 페이지)

| # | 페이지 | 라우트 | 성격 |
|---|---|---|---|
| P1 | 운영 대시보드 | `/admin/pipelines/queue` | KPI 4-up + Process Status 모니터 테이블 |
| P2 | 연동 요청 | `/admin/pipelines/queue/requests` | confirmStatus 필터 테이블(반려사유 포함) |
| P3 | 연동 요청 상세 | `/admin/pipelines/queue/requests/[targetSourceId]` | 승인/반려 + IDC NLB + NLB index 수정 |
| P4 | 연결 테스트 | `/admin/pipelines/queue/test-connections` | COMPLETED / REJECTED 필터 테이블 |

기존 공유 컴포넌트 재사용: `PlTable · PlPagination · SearchBox · PlSelect · SegControl · StatusPill · Card · SectionHeader · PlEmptyState · ModalShell · PlToast · ProvTag`.

---

## 3. 페이지별 스토리보드 + API Set

### P1 — 운영 대시보드 `/admin/pipelines/queue`

**레이아웃**
```
[ KPI Row: 4 tiles ]
  연동 요청 대기 | 연동 요청 반려 | 연결 테스트 완료 | 연결 테스트 반려
[ Section: Process Status 모니터 ]
  [필터: 프로세스 상태(7) · targetSourceId] [갱신됨 hh:mm:ss · 자동 30s]
  ┌ 서비스이름 · 서비스코드 · Target Source(ID) · Cloud · 프로세스 상태(Step n·라벨) · 지연 ┐
  │ …rows (page/size 페이지네이션)                                                        │
  └ (지연 highlight: 임계 초과 시 강조)                                                    ┘
```

**KPI — API**
- `GET /install/v1/dashboard/summary` → `DashboardSummaryResponse`
  - `pending_approval_count` → 연동 요청 대기
  - `rejected_approval_count` → 연동 요청 반려
  - `test_connection_completed_count` → 연결 테스트 완료
  - `test_connection_rejection_count` → 연결 테스트 반려
  - `evaluated_at` → "기준 시각" 캡션

**Process Status 모니터 — API**
- `GET /install/v1/process-statuses?processStatus={enum}&targetSourceId={id}&page&size(≤100,def20)` → `PageProcessStatusCurrentResponse`
- row = `ProcessStatusCurrentResponse`:
  | 컬럼 | 필드 |
  |---|---|
  | 서비스 이름 | `target_source.service_info.serviceName` |
  | 서비스 코드 | `target_source.service_info.code` |
  | Target Source (ID) | `target_source_id` |
  | Cloud | `target_source.cloudProvider` |
  | 프로세스 상태 | `process_status` → §1 Step 매핑 |
  | 지연(초) | `delay_seconds` |
  | (부가) 변경시각 | `status_changed_at` / `last_calculated_at` |

> **지연 시간은 이미 서버가 계산해 `delay_seconds`(Long, 초)로 준다.** 사용자가 말한 "BFF 주기 조회 후 변경 시 현재시각 업데이트 → now-마지막의 차"는 **백엔드 책임이며 이미 반영**됨(`status_changed_at`/`last_calculated_at`/`delay_seconds`). 프론트는 계산하지 않고, 폴링 주기(예: 30s)로 재조회만 한다.

---

### P2 — 연동 요청 `/admin/pipelines/queue/requests`

**레이아웃**
```
[ SegControl: 대기(PENDING) · 반려(REJECTED) · 전체 ]  [건수 배지]
[ 테이블 ]
  서비스이름 · 서비스코드 · Target Source(ID) · Cloud · 연동 프로세스 상태 · [반려사유]
  · REJECTED 탭에서만 맨 오른쪽 "반려 사유" 셀(hover 툴팁 or "보기" → Modal)
  · 행 클릭 → P3 상세 (대기/전체 탭). 반려·전체 탭은 조회 위주(Interaction 미제공)
[ PlPagination ]
```

**목록 — API**
- `GET /install/v1/target-sources/page?confirmStatus={PENDING|REJECTED|생략}&page&size(def10)` → `PageTargetSourceInfo`
- row = `TargetSourceInfo`:
  | 컬럼 | 필드 |
  |---|---|
  | 서비스 이름 | `serviceName` |
  | 서비스 코드 | `serviceCode` |
  | Target Source (ID) | `targetSourceId` |
  | Cloud | `cloudProvider` |
  | 연동 프로세스 상태 | `confirmStatus` (§1 축 분리 주의) |
  | 건수 | `PageTargetSourceInfo.totalElements` |

**반려 사유(REJECTED 행 우측)** — hover/Modal
- `GET /install/v1/target-sources/{targetSourceId}/approval-requests/latest` → `ApprovalRequestLatestDto`
  - `result.reason` (`ApprovalActionResponseDto.reason`) → 반려 사유
  - `result.status` = `REJECTED`, `result.processed_at` → 반려 일자
- 지연 로딩: 행 hover/클릭 시점에만 호출(목록 프리페치 금지).

> **탭별 건수**는 각 confirmStatus 호출의 `totalElements` 사용 권장(정합성↑). KPI(`dashboard/summary`)는 상단 요약 전용.

---

### P3 — 연동 요청 상세 `/admin/pipelines/queue/requests/[targetSourceId]`

**레이아웃**
```
[ 헤더: 서비스명 · 코드 · Target#ID · Cloud · Step 상태 ]        [승인] [반려]
[ 요청 정보 카드 ]  요청자 · 요청시각 · 리소스 선택/전체 (n/m)
[ 리소스 테이블 ] (resources[]: resourceId · db · port · ip … )
[ IDC 전용 ▼ ]
  · NLB 현황 테이블 (occupiedListenerCount 경보: ≥30 주의 / ≥50 Hard Limit)
  · 리소스별 NLB index 인라인 수정 (resourceId + nlb_index → 저장)
```

**요청 정보 — API**
- `GET /install/v1/target-sources/{targetSourceId}/approval-requests/latest` → `ApprovalRequestLatestDto`
  - `request` (`ApprovalRequestSummaryDto`): `id`(requestId) · `status` · `requested_by.user_id` · `requested_at` · `resource_selected_count` / `resource_total_count`
  - `resources[]` (`TargetSourceResourceItemDto`) → 리소스 테이블

**승인 / 반려 — API** (확정: install/v1, requestId path 없음 → 최신 PENDING 대상)
- `POST /install/v1/target-sources/{targetSourceId}/approval-requests/approve` (body `ApprovalApproveRequestDto{comment?}`)
- `POST /install/v1/target-sources/{targetSourceId}/approval-requests/reject` (body: 반려 사유)
- 성공 시 PlToast + 목록/상태 무효화.

**IDC — NLB 현황**
- `GET /install/v1/idc/nlb/table` → `NlbTableResponse[]`
  - `nlbIndex` · `nlbIpList[]` · `occupiedListenerCount`
  - 경보 규칙: `>=30` 주의(경고색), `>=50` Hard Limit(위험색·수정 차단 안내)
- (선택) `GET /install/v1/idc/nlb/{nlbIndex}/resources` → `NlbOccupiedResourceResponse[]` 로 index별 점유 상세.

**IDC — NLB index 수정**
- `PUT /install/v1/target-sources/{targetSourceId}/approval-requests/nlb-indices`
  - body `NlbIndexAssignmentDto{ resource_id: string, nlb_index: int }` (**단건**)
  - 제약: IDC + 최신 **PENDING** 승인요청에만. 400=IDC 아님/잘못된 index, 409=PENDING 아님, 404=요청 없음 → 각 에러 UI 문구 매핑.
  - 다건 일괄 수정 UX면 N회 호출(리소스별) 또는 계약 확장 필요.

---

### P4 — 연결 테스트 `/admin/pipelines/queue/test-connections`

**레이아웃**
```
[ SegControl: 완료(TEST_CONNECTION_COMPLETED) · 재실행 요청(TEST_CONNECTION_REJECTED) ]
[ 테이블 ]
  완료 탭:  서비스이름 · 코드 · Target#ID · Cloud · 완료일자 · [상세이동]
  반려 탭:  서비스이름 · 코드 · Target#ID · Cloud · 반려사유(hover) · 반려일자
[ PlPagination ]
```

**API**
- `GET /install/v1/target-sources/test-connection/status?status={TEST_CONNECTION_COMPLETED|TEST_CONNECTION_REJECTED}&page&size(def10)` → `PageTestConnectionRejectStatusResponse`
- row = `TestConnectionRejectStatusResponse` (완료·반려 공용 스키마):
  | 컬럼 | 필드 |
  |---|---|
  | 서비스 이름 | `service_name` |
  | 서비스 코드 | `service_code` |
  | Target Source (ID) | `target_source_id` |
  | Cloud | `cloud_provider` |
  | 완료 일자(완료 탭) | `completed_at` |
  | 반려 사유(반려 탭, hover) | `reject_reason` |
  | 반려 일자(반려 탭) | `rejected_at` |
- 상세 이동: 완료 탭 "상세 페이지 이동" → 기존 `pipelines.target(targetSourceId)`(R24 상세) 재사용 가능.
- enum에 `TEST_CONNECTION_RESET`(재실행 초기화)도 있음. SegControl 2탭으로 시작, RESET 노출 필요 여부는 후속 확인.

---

## 4. 계약 갭 / 확인 필요 (contract-first)

- **A. 상태 축 2개 혼동 금지**: `process_status`(Step1~7, 모니터용) vs `confirmStatus`(요청목록 필터/표시용). §1 참조.
- **B. approve/reject 경로**: **확정 — `install/v1/.../approval-requests/approve|reject`** (requestId 없음, 최신 PENDING). 스펙의 `infra/.../{requestId}/…`는 상위(업스트림) 표기로 미채택.
- **C. approval-requests/latest 경로**: `install/v1` 단일 사용.
- **D. 지연 계산**: 프론트 계산 아님. 서버 `delay_seconds` 표시 + 폴링(30s)만.
- **E. NLB index 수정은 단건**(`NlbIndexAssignmentDto` 1개). 다건 일괄 수정 UI면 N회 호출 or 계약 확장 필요.

---

## 5. Step1~7 재사용 매핑

| 신규 화면 요소 | 재사용 원본 |
|---|---|
| Step 라벨/번호 pill | §1 `PROCESS_STATUS_STEP` + `_components/StatusPill` 톤 |
| 진행도 시각화 | `_components/PipelineProgressBar` |
| 승인/반려 액션·모달 | 기존 Step2 승인 카드 UX + `ModalShell` |
| IDC NLB/리소스 테이블 | Step5(연결테스트)·IDC 상세의 리소스 표 패턴 |
| 연결 테스트 결과 표기 | Step5 테스트 결과 컴포넌트 |
| Target 상세 진입 | 기존 R24 `pipelines.target()` 상세 재사용 |

---

## 6. 다음 단계(구현 착수 시)
1. `lib/routes.ts` `queue` 서브트리 + `TopNav` 라벨(관리자) + `layout.tsx` 그룹 사이드바.
2. `app/lib/api/` 에 install/v1 wire↔domain 어댑터(dashboard-summary · process-statuses · target-sources/page · approval latest · nlb table · test-connection status).
3. `stepModel.ts`(§1) → P1~P4 순으로 mock-first 구현.
