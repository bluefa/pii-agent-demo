# 디자인/UX 개선 백로그 — 2026-07-28

기준: `main@44b9c462` (#581 머지 직후). 사용자 화면 · Admin 콘솔 · API 계약 3방향 병렬 분석 후 핵심 주장(버그 3건)은 코드로 재검증했다.

세 가지 렌즈로 조사했다:

- **시나리오 렌즈**: 실제 여정(스캔→승인→설치→논리DB→연동확인 / 장애파악→진단→재시작)에서 막히는 지점
- **스케일 렌즈**: 목록이 10배로 늘면 무너지는 지점
- **API 렌즈**: 계약에 필드/엔드포인트가 추가되어야 풀리는 지점

---

## 우선순위 요약

| 순위 | 항목 | 분류 | API 필요 |
|---|---|---|---|
| P0-1 | 서비스 인프라 목록에 진행 상태·반려 여부가 전무 (전부 하드코딩) | 사용자 | ✅ |
| P0-2 | 대기 단계(승인 대기·설치 중)에 auto-poll이 없어 "새로고침하세요"가 공식 안내 | 사용자 | 권장 |
| P0-3 | ~~Admin 큐 목록 범위 라벨 계산 버그 ("21–40"부터 시작)~~ → 2026-08-12 해결 | Admin·버그 | ❌ |
| P0-4 | 진행 내역 탭이 전 사용자 공통 가짜 데이터 (MOCK_HISTORY) | 사용자 | ✅ |
| P0-5 | `scan_status`/`integration_status` 계약 부재 — 실 BFF 전환 시 Step1 태그·Step3 카운트 즉시 파손 (LIN-51) | API | ✅ |
| P1 | 죽은 컨트롤 정리(필터·삭제×2)·200건 하드캡 3곳·Step1 테이블 도구 부재·에러의 빈상태 위장·error_code 조치 안내·로그뷰어 | 혼합 | 일부 |
| P2 | 접근성·표기 일관성·미구현 메뉴 노출 등 | 혼합 | ❌ |

---

## A. 사용자 화면 (서비스 목록 · Step 1~7 · 가이드 레일)

### A-1. [P0] 인프라 목록에 상태가 없다 — 여정의 출발점이 장님

- **현상**: `app/lib/api/index.ts:92-97`의 `toProjectSummary`가 `resourceCount: 0 / hasDisconnected: false / hasNew: false / isRejected: false`를 전부 하드코딩(코드로 재검증 완료). `InfraRow`는 Provider/TS-id/설명/모니터링만 렌더.
- **시나리오**: 인프라 5개만 있어도 "어느 게 반려됐고 어느 게 내 액션을 기다리는지" 알려면 하나씩 클릭해 들어가야 한다. 승인 반려조차 상세의 `RejectionAlert`에서만 보인다.
- **제안**: 행에 상태 배지 + "내 액션 필요" 강조 필터.
  **필요 API**: `GET /services/{code}/target-sources` 응답에 `process_status`, `is_rejected`, `rejection_reason`, `resource_count`, `updated_at`.

### A-2. [P0] 대기 단계 auto-poll 부재 — "새로고침해 주세요"를 4번 반복하는 가이드

- **현상**: `useInstallationStatus` / `useIdcInstallationStatus`에 폴링이 없다. `usePollingBase`(`app/hooks/usePollingBase.ts`)는 이미 존재하지만 스캔(2s)·연결테스트(4s)만 사용. `app/target-sources/` 트리 전체에 `setInterval` 0건. 가이드 문구(`lib/constants/step-guide-content.ts:71,84,94,104,112,124`)가 "자동 갱신되지 않아요 → 새로고침" 안내에 의존.
- **시나리오**: 여정에서 가장 긴 구간(승인 대기, 설치 중)만 수동 새로고침. 사용자는 F5를 반복하거나 화면을 떠난다.
- **제안**: `usePollingBase`를 process-status/설치 상태에 적용(백오프 포함) + 가이드의 "새로고침" 카피 제거.
  **필요 API(권장)**: `ProcessStatusResponseDto`에 `recommended_poll_interval_seconds` 또는 ETag.

### A-3. [P0] 대기 시간을 전혀 예측할 수 없다

- **현상**: `layout/WaitingApprovalCard.tsx:175-178` "평균 1영업일 내 검토되며"가 리터럴 하드코딩. 요청일시는 표시하지만 경과 시간·예상 완료가 없다. "약 5분/최대 10분" 류 문자열 상수가 8곳+인데, mock 주석(`lib/bff/mock/confirm.ts:38`)은 "실제로는 최대 하루 이상"이라고 자백 — UI 카피와 모순.
- **시나리오**: 어제 요청한 건과 5분 전 요청한 건이 동일 화면. 가이드는 "하루 이상 머물면 문의"라며 사용자에게 눈대중을 시킨다.
- **제안**: `requested_at` 기반 경과 시간("3시간째 대기 중") 즉시 표시 + 임계 초과 시 협업 채널 에스컬레이션 유도.
  **필요 API**: `ProcessStatusResponseDto`에 `status_changed_at`(어드민 목록용 `ProcessStatusCurrentResponse`에는 이미 있음 — 개별 조회에만 없음), 가능하면 `estimated_completion_at`.

### A-4. [P0] 진행 내역 탭 = 전 사용자 공통 가짜 타임라인

- **현상**: `common/GuidePanel.tsx:111-131` `MOCK_HISTORY` 12건 하드코딩(승인자 "김보안", 날짜 2024-01 고정). 페이저까지 붙어 있어 진짜처럼 보인다.
- **시나리오**: 반려 사유·재요청 맥락을 여기서 찾으려는 사용자를 적극적으로 오도한다. 우측 레일 2탭 중 1탭이 거짓.
- **제안**: 단기 — API 없는 동안 탭 숨김 또는 "준비 중" 빈 상태. 근본 — 활동 이력 API.
  **필요 API**: `GET /target-sources/{id}/activity-history?page&size` → `Page<{event_type, title, detail, actor, occurred_at, severity}>` (스캔 실행/실패, credential 등록, 승인 요청/승인/반려, TF 권한 검증 포함).

### A-5. [P1] 죽은 컨트롤 3종 — 클릭해도 아무 일이 없다

- **필터 버튼**: `v7/InfraListToolbar.tsx:65-88`의 필터 버튼은 `onFilterClick`이 optional인데 `InfraRowList`가 안 넘긴다(코드로 재검증) → 무반응. 구현 전까지 제거, 구현 시 A-1의 상태 필드와 묶어 Provider/상태 필터로.
- **인프라 삭제 ×2**: 가이드 레일 푸터(`기능 준비중입니다.`)와 목록 케밥(`삭제 미구현`)이 문구까지 서로 다른 placeholder. danger-zone 시각 강조까지 되어 있어 기대만 만든다. API 착지 전 숨김/disabled+툴팁 통일. **필요 API**: `DELETE /target-sources/{id}` + `can_delete`/`blocked_reason` (설치 진행 중 차단).
- **최근 업데이트 "—"**: `ServiceManagementView.tsx:248`이 `lastUpdatedAt={null}` 고정 전달 — `formatRelativeTime`은 완비된 데드 코드. **필요 API**: 서비스 단위 `last_updated_at`(또는 목록 응답 `updated_at`의 max 파생).

### A-6. [P1] Step1 후보 리소스 테이블만 스케일 도구가 없다

- **현상**: `candidate/CandidateResourceTable.tsx:45-60` 전량 렌더. 같은 제품의 Step2/3은 `useApprovalTableState`(검색+DB타입+Region+상태 필터+10건 페이징), Step5는 `usePagination`을 쓴다.
- **시나리오**: 스캔 직후 후보 300건 — 가장 행이 많은 단계에 도구가 가장 없고, 행마다 확장형(엔드포인트 설정)이라 DOM 비용도 크다.
- **제안**: `useApprovalTableState` 재사용(순수 파생 훅이라 이식 용이). API 불필요.

### A-7. [P1] 검증 실패를 사라지는 toast로 통보

- **현상**: `candidate/CandidateResourceSection.tsx:162-173` — 제외 사유/설정 누락 시 `toast.warning('...: ID1, ID2, …')`로 resourceId 나열.
- **시나리오**: 50건 중 12건 누락이면 ID 12개가 한 줄로 떴다 사라지고, 해당 행으로 갈 방법이 없다. 개수에 비례해 악화.
- **제안**: 행 인라인 에러 + "미입력 N건만 보기" 필터 + 첫 오류 행 자동 스크롤.

### A-8. [P1] 인프라 목록 무페이징 + 검색 대상 불일치

- `getProjects`가 전량 fetch(page 파라미터 없음), `InfraRowList` 전량 map — 행 ~66px × 200건 = 13,000px 스크롤. **필요 API**: `/services/{code}/target-sources`에 `page/size/query/status`.
- 검색 placeholder는 "Provider, 계정, DB 이름으로 검색"인데 실제 haystack은 provider/projectCode/description/TS-id뿐 — 계정 ID·DB 이름은 검색 안 됨(`v7/InfraRowList.tsx:18-29`). 단기: placeholder 정정. 근본: metadata의 `aws_account_id`/`subscription_id`/`gcp_project_id`를 haystack에 포함(어댑터가 이미 metadata를 읽음).

### A-9. [P1] 현재 위치 인지성 — 상세 화면에서 서비스 맥락이 사라진다

- **현상**: `_components/ServiceListPanel.tsx:222` `selectedService={null}` 고정 → 사이드바 선택 하이라이트가 절대 켜지지 않고, 상세 페이지엔 breadcrumb도 없다.
- **제안**: `projectCode`를 `selectedService`로 전달 + "서비스명 > TS-{id}" breadcrumb. API 불필요.

### A-10. [P1] 1360px 미만에서 가이드 레일 통째 소실

- **현상**: `GuidePanel.tsx:215` `hidden … min-[1360px]:flex`. 가이드·진행 내역·협업 채널·인프라 삭제·모니터링 표기가 대체 진입점 없이 사라진다.
- **시나리오**: 1366px 노트북에서 겨우 걸치고, devtools를 열면 즉시 소실 — 도움말이 사라지는 시점이 하필 "화면이 좁아 헤맬 때". (#581 리뷰에서 수용한 알려진 제약이나, 삭제 실 API 이전에 접이식 드로어 폴백 권장.)

### A-11. [P2] 소소하지만 노출 빈도 높은 것들

- 스플릿 버튼 "관리"와 메뉴 "상세 보기"와 행 클릭이 전부 같은 목적지 — 같은 곳으로 가는 경로 3개. 케밥 단독(삭제만)으로 축소 권장.
- TopNav 8항목 중 동작 2개(6개는 disabled 또는 "준비 중" toast) — 릴리스 전 미구현 항목 숨김 권장.
- Step1 서브타이틀 오타: "Infra Scan을 통해 **부위** DB 조회 후"(`CandidateResourceSection.tsx:248`).
- 목록의 모니터링 라벨이 Provider 상수 매핑이라 SDU 계정도 "AWS Agent"로 표기(`v7/InfraRow.tsx:13-18`) — 상세 화면은 SDU로 올바르게 분기하므로 목록·상세 불일치. `isSduType`은 이미 내려온다.
- `ServiceSidebar` 항목이 `<li onClick>`로만 동작 — role/tabIndex/키보드 핸들러 없음(키보드·스크린리더로 서비스 선택 불가).

---

## B. Admin 콘솔 (파이프라인 · 큐 · 운영)

### B-1. [P0·버그] 큐 목록 범위 라벨 off-by-one-page — **해결 (2026-08-12)**

- **현상**: `app/admin/pipelines/queue/page.tsx:333-336` — `currentPage`가 이미 1-based인데 `currentPage * size + 1`–`(currentPage + 1) * size`로 계산(코드로 재검증). 첫 페이지에서 실제 1–20행을 보여주며 라벨은 "21–40 / 전체 N건".
- **제안**: 0-based 원본(`procPage.number`)으로 `page * size + 1`–`min(total, (page+1) * size)`. API 불필요, 즉시 수정 가능.
- **해결**: 제안대로. 첫 페이지만이 아니라 모든 페이지가 한 페이지(`size`)씩 밀려 있었고, 마지막 페이지에서는 끝값이 `totalElements`에 잘려 "41–23" 같은 뒤집힌 범위까지 나왔다. 인덱스 규약을 이름으로 갈라 두고(`pageIndex` 0-based / `currentPage` 1-based) 계산은 `_p1/logic.ts`의 순수 함수 `pageRange`로 빼서 테스트를 걸었다.

### B-2. [P1] 에러가 빈 상태로 위장한다 — 정직성 3곳

- **작업 이력**: `_detail/TargetPipelineSections.tsx:113/236/336` — `.catch(() => setHistory(null))` 후 "작업 이력이 없어요" 빈 상태와 동일 화면. "이 대상은 아무것도 안 돌았다"는 잘못된 결론 유도. → error 분기 + 다시 시도(같은 파일의 에러 카드 패턴 재사용).
- **대시보드 KPI**: `page.tsx:130-132` — 집계 실패 시 조용히 "—" 강등. "실패 0건"과 "집계 실패"가 구분 안 됨. → 경고 아이콘 + 툴팁 + 카드 단위 재시도.
- **상세 폴링**: `PipelineDetailView.tsx:159-201` — 10초 폴링이 실패해도 무음, "마지막 갱신 시각" 표시 없음. 큐 대시보드는 "30초마다 자동 갱신돼요"를 명시하고 있어 화면 간 불일치. → "마지막 갱신 hh:mm:ss · 자동 갱신 중" + 연속 실패 배너.

### B-3. [P1] error_code → "그래서 뭘 해야 하나"가 없다

- **현상**: `execTabs.tsx:45`, `AttemptDetail.tsx:53` — 실패가 `실패 N회 — {error_code}` 원시 문자열로 끝. error_code→설명/조치 매핑이 코드 어디에도 없음.
- **시나리오**: 진단→개입 여정의 마지막 구간이 끊겨, 운영자가 코드값을 외우거나 로그를 직접 읽어야 다음 행동이 결정된다.
- **제안**: 단기 — 프론트 `lib/pipeline/errorCatalog.ts`(error_code → {제목, 원인, 권장 조치, 재시작 가능}) + 드로어 "권장 조치" 블록. 장기 — **필요 API**: 태스크/시도 응답 `error_guide{title, cause, remediation, retryable}` 또는 `GET /task-definitions/{provider}/error-codes` 카탈로그.

### B-4. [P1] 실행 중 로그가 갱신되지 않는 로그뷰어

- **현상**: `_detail/JobViewer.tsx:26-47` — 1회 fetch, 폴링·수동 새로고침 없음. 부모의 10초 폴링은 job 로그를 갱신하지 않는다.
- **시나리오**: 진행 중 장애를 따라가는 게 로그뷰어의 핵심 용도인데 조용히 정지된 스냅샷 — "멈춘 것처럼 보임" 오판 유발.
- **제안**: live/IN_PROGRESS일 때 5–10초 폴링 + "자동 갱신 중" 표시 + 수동 새로고침. **필요 API(권장)**: `?since_offset=` 증분 조회(16MB 로그 재전송 방지).
- **부가**: 툴바가 복사 버튼 하나(성공 토스트도 없음), 검색·에러 라인 점프·다운로드 없음 — 원인 진단에 가장 오래 머무는 화면에 탐색 도구 0개.

### B-5. [P1] 200건 하드캡 3곳 — 무성 데이터 손실

- **대시보드**: `page.tsx:150` `DASH_FETCH_SIZE = 200` 한 창을 받아 클라이언트에서 5건씩 페이징 + 클라 검색. 201번째 run은 검색해도 없는 것처럼 보이고 총 건수 미표기. → 서버 페이지네이션 + `q` 파라미터(service_code/name/TS-id). 임시로 "최근 200건 내 검색" 고지.
- ~~**운영 알림**: `ops/alerts/_components/AlertsView.tsx:26` `FETCH_CAP = 200` + 전량 클라 정렬/집계. **상단 KPI 타일 숫자 자체가 조용히 틀려지는 것**이 가장 위험.~~ → **해소 (PR #733)**. `AlertsView` 는 SSR 워크리스트로 대체되어 `FETCH_CAP` 과 클라 집계가 사라졌다. 타일 건수는 서버 요약이 주고, 요약이 없거나 불완전하면 숫자를 지어내는 대신 '—' 로 떨어진다. 남은 갭은 **정렬** 하나 — 지연 내림차순은 `delay_seconds` 계약 랜딩 후다(`docs/ux/benchmark/ops-alerts-worklist.md`).
- **지연 필터**: 업스트림에 쿼리 파라미터가 없어 우리 라우트가 여러 페이지를 긁어모아 클라 필터링(계약 갭 G1). → `process-statuses`에 `min_delay_seconds`.

### B-6. [P1] Process Status 모니터에서 대상으로 진입할 수 없다

- **현상**: `queue/page.tsx:254-306` — 필터는 상태+지연 2종뿐, 행에 상세 링크 컬럼 없음.
- **시나리오**: "1일↑ 지연 대상을 찾았다 → 왜 막혔는지 본다"의 두 번째 단계가 끊겨 사이드바로 되돌아가야 한다.
- **제안**: 행 전체 stretched-link(운영 알림 워크리스트 `AlertWorklist` 의 `DashRow` 패턴 재사용 — 구 `AlertsView` 는 PR #733 에서 대체됐다) + 서비스코드/TS-id 검색. **필요 API**: `q` 파라미터.

### B-7. [P1] TaskFlow 가로 트랙 — 노드 30개면 1만px 스크롤

- **현상**: `_detail/TaskFlow.tsx:36,105` — 노드 288px+커넥터 56px 단일 가로 트랙. 최초 로드 시 현재/실패 노드로 auto-scroll하지 않음(같은 기능이 `CurrentPipelineCard.tsx:72-83`엔 있음 — 화면 간 불일치). 노드마다 `tabIndex={0}`이라 키보드는 수십 번 Tab.
- **제안**: 마운트 시 현재/실패 노드 auto-reveal(기존 로직 재사용) + "실패 지점으로 이동" 버튼 + ←/→ 노드 이동. API 불필요.

### B-8. [P2] 나머지 권장 개선

- **사이드바 배지 일반화**: `layout.tsx:20-44` — 알림 배지가 '연동 요청' 하나 하드코딩. 실패 파이프라인/운영 알림/연결 테스트엔 배지 없음 → 메뉴별 카운트 맵. **필요 API(권장)**: `GET /ops/badge-counts` 단일 집계. ~~이미 30초 폴링 중이라 폴링 비용상 유리~~ → 2026-08-12 (PR #695) 30초 폴링 제거. 뱃지는 화면 이동과 화면 내 새로고침 신호로만 다시 읽으므로, 이 제안의 근거는 폴링 비용이 아니라 메뉴별 카운트 일반화다.
- **재시작 재개 지점 조정 불가**: `RestartModal.tsx:19-23` — `from_sequence` 선택이 의도적으로 미배선(백엔드 미배포 optional 필드). 프리뷰 dim 노드 클릭으로 재개 지점을 앞당기는 인터랙션 + 서버 검증 파라미터화는 백엔드 배포와 함께.
- **Task 카탈로그 검색/그룹핑 없음**: `CustomBuildStep.tsx:419-448` — task 수십 종이면 스크롤 탐색뿐. kind/terraform_action별 그룹 + 검색(응답에 필드 이미 있음, API 불필요).
- **작업 이력 5건 고정 + 총 건수 없음**: `TargetPipelineSections.tsx:50` — 재시작 반복 대상은 이력 수십 건. 페이지 크기 선택 + totalElements 표기 + 상태 필터.
- **TaskFlow 상태의 접근성**: 배지 전부 `aria-hidden`, aria-label에 상태 미포함, FAILED/CANCELLED는 색만 구분 → `${name} · ${상태} · 상세 열기` + sr-only 텍스트.
- **미조치 실패 개념**: `restarted_by_pipeline_id`가 이미 있으므로 "재시작 안 된 실패"를 필터로 승격.

---

## C. API 계약 보강 (횡단 — 우선순위 순)

> `install-v1.yaml`은 구 덤프의 스냅샷 + jira-ticket 1개. 최신 덤프(`docs/api-docs.yaml (2).txt`)에는 **미이식 엔드포인트 7개·스키마 13개·필드 9곳**이 있고, 역으로 install-v1에만 있는 경로는 0개(순수 미이식 관계).

### C-1. `scan_status` / `integration_status` 정식 선언 (LIN-51 — 최우선)

`TargetSourceResourceItemDto`에 두 필드가 없는데 UI는 둘 다 쓴다(수기 타입 + mock만 생성). **실 BFF 전환 시 Step1 신규/변경 태그 소실, Step3 "N건 중 0건 완료" 고정, 연동 상태 필터 무의미화.** → `scan_status: UNCHANGED|NEW_SCAN`, `integration_status: INTEGRATED|NOT_INTEGRATED` 선언.

### C-2. 코드가 계약보다 앞서 있는 역전 3건 (덤프에서 이식)

- `restart` / `restart-preview` — UI·라우트 완비, install-v1에 없음(자체 orchestrator-v1.yaml이 임시 근거).
- `nlb-index-mappings` — 라우트 주석에 "OFF-CONTRACT … raw snake passthrough" 자백. zod 검증 없이 도는 유일한 화면.
- `services/{code}/jira-tickets` GET/POST/DELETE — 이식하면 ops 가정 계약 §6 폐기 가능(`JiraUserModal`이 mock 전용인 원인). 알림 수신자 목록 필드는 덤프에도 없어 `notification_user_ids` 추가 제안.

### C-3. 활동 이력 엔드포인트 (신규)

A-4의 근본 해결. `GET /target-sources/{id}/activity-history` — 거절/취소 이력도 여기로 수렴(현행 계약은 `latest` 1건만 조회 가능, "이전에 왜 반려됐는지"의 계약 경로가 없음).

### C-4. ProcessStatus 개별 조회 보강

`ProcessStatusResponseDto`에 `status_changed_at`(목록용엔 이미 있음), `delay_seconds`, `recommended_poll_interval_seconds`, 가능하면 `estimated_completion_at`/`stalled`. A-2/A-3의 기반. 장기적으로 SSE(`/target-sources/{id}/events`) 또는 ETag.

### C-5. 승인/확정 데이터 완결성

- `ActorDto{user_id}`에 `display_name`/`department` — 현재 승인자를 사번으로만 표시.
- `ApprovedIntegrationResponseDto`에 `excluded_resources[]` — 제외 리소스/사유가 현재 프론트 유령 필드(빈 값 생성).
- `ConfirmedIntegrationResponseDto`에 `confirmed_at`/`confirmed_by` — ops 확정 정보 카드가 범위 축소된 원인.
- `approval-history` 200의 제네릭 `Page` 해소 — item 필드 전체(수행자 컬럼 포함)가 실측 기반 off-contract.
- Step3 진행률 서버 집계: `approved-integration`에 `integrated_count`/`total_count`(현재 클라이언트에서 셈).

### C-6. 미이식 필드·기타

- 공통 스키마: `origin_pipeline_id`/`origin`/`restarted_by_pipeline_id`/`origin_task_id`/`terraform_action`(재시작 계보·TF 액션 구분을 수기 optional로 유지 중), `SecretResponse.last_updated_time`(credential 갱신 시각), `TargetSourceResponse.isSduType`(가정 필드로 대체 중), `UserMeResponse.source`.
- `test-connection/execution-history`(덤프) 이식 — 요청→완료 소요시간·version이 처음으로 표시 가능.
- `POST /target-sources/{id}/reset`(덤프) 이식 + ops 상세 "연동 상태 초기화" 액션.
- `jira-ticket`에 `browse_url` — 현재 base URL이 env 상수 + `jira.example.com` 폴백(env 미설정 배포에서 escape hatch가 404로 감).
- 미연결을 404로 표현하지 않기 — `issueKey: null` 허용(현재 mock이 시드 ID 하드코딩으로 미연결을 연출).
- 삭제 API 부재 — install-v1 전체에 `delete:` 오퍼레이션 0개(A-5 인프라 삭제의 근본 원인).
- 알림 API 부재 — 운영 알림 화면 전체가 가정 계약 위. `GET /alerts` + `POST /alerts/{id}/ack` 제안. `ops-assumed-contracts.md` 6종의 실계약화가 없으면 **ops 콘솔은 실 BFF 연결 시 통째로 빈 화면**.
- TC `latest-results`의 `database_type`/`connection_target`/`connection_status` 3필드 미선언 — `.passthrough()`로 흘려받는 중, 실 업스트림에서 빈 컬럼 가능.

---

## 착수 제안 (묶음 단위)

1. **즉시(버그·API 불필요)**: B-1 범위 라벨, A-5 죽은 필터 버튼, A-11 오타·SDU 표기, B-2 에러 정직성 3곳
2. **1스프린트(프론트 단독)**: A-2 폴링(기존 훅 재사용), A-6 Step1 테이블 도구, A-7 인라인 검증, A-9 위치 인지성, B-7 TaskFlow auto-reveal, B-4 로그뷰어 도구
3. **계약 협의 선행**: C-1(LIN-51) → C-2 역전 해소 → C-3 활동 이력 → C-4 ProcessStatus 보강 순으로 백엔드와 협의. A-1(목록 상태)은 C와 별개로 `/services/{code}/target-sources` 응답 보강만으로 착수 가능
4. **스케일 대비(백엔드 파라미터 필요)**: B-5 하드캡 3곳, A-8 목록 페이징, B-6 검색·진입
