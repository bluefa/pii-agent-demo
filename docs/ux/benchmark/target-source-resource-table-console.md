# Target Source 상세 리소스 테이블 — 콘솔 문법 전환 (시안 F + 열 너비 가변)

- 날짜: 2026-08-21
- 대상 화면: `app/target-sources/[targetSourceId]` 7단계(연동 완료) 리소스 테이블
  (`InstallationCompleteStep` → `ConfirmedIntegrationTable` → `WaitingApprovalTable variant="confirmed"`)
- 벤치마크 아티팩트: https://claude.ai/code/artifact/a134c751-bf2c-40c0-be0e-ad8e8f6708fd (레퍼런스 15 · 시안 7)
- 동작 프로토타입: https://claude.ai/code/artifact/7451957c-6636-4638-a9cc-f230281c0192 (열 너비 드래그 리사이즈)
- 구현 PR: #749

## 문제 (라운드 1 진단 + 라운드 3 판정)

| # | 문제 | 등급 |
|---|------|------|
| D1 | 카드 3겹 표면 안의 표 — 답답함 | UX 원칙 (표면 중첩) |
| D2 | 1건일 때도 검색·페이지네이션 크롬 전부 노출 | UX 원칙 (NN/g 과업 렌즈) |
| D3 | 행 구분 안 됨 — 라운드 2에서 재진단: 선(1.16:1)이 아니라 **77px 거구 행 + 색 앵커 0개** → 라운드 3에서 소유자 판정으로 선도 승격 대상 | 수치 위반(대비 실측) + 소유자 판정 |
| D4 | 화면이 넓을수록 힘없음 — 균등 팽창, 잘린 값은 그대로 | 수치 위반 (2493px 실측: ID 열 549px, 값은 260px 클램프에 잘림) |
| R3 | (라운드 3 추가) 열 폭을 사용자가 조절할 수 없음 — "left\|right 사이 선을 잡고 늘리면 덮인 값이 걷히는 구조"가 F 채택의 전제 조건 | 발주 요구 |

## 실제 차용한 레퍼런스

| 레퍼런스 | URL | 차용 요소 |
|---|---|---|
| AWS Cloudscape Table (라이브 데모 DOM 실측 + 문서) | https://cloudscape.design/components/table/ | 카드 0겹 full-page 문법 · 행 밀도 · "resize the column width by **dragging the divider on the right of a column header**" · `resizableColumns` · 최소폭 클램프(기본 120px) · `onColumnWidthsChange`(폭 저장) · ">5 items" 크롬 규칙 |
| Azure Portal Manage view 문서 | https://learn.microsoft.com/azure/azure-portal/manage-filter-resource-views | 「Reset to defaults」 → 「열 너비 초기화」 버튼 · 뷰(열 구성)는 사용자 소유물 |
| Fluent 2 react-table 소스 | https://github.com/microsoft/fluentui | 행높이 눈금(24/34/44) — 밀도 근거 |
| A List Apart zebra 실험 ①② | https://alistapart.com/article/zebrastripingdoesithelp/ | zebra 배제 근거(컴팩트 표에서 무효과) |
| NN/g 데이터 테이블 4과업 | https://www.nngroup.com/articles/data-tables/ | 1건 화면 크롬 제거(시안 D)의 과업 논거 |
| repo 선례 | `idcStyles.table.approvalCell` · `useColumnResize`(CredentialPickModal) · ops pane "리소스 N건"(#718) | 행 52px 산식 · 리사이즈 훅 재사용 · 카운터 문법 |

## 채택안과 이유

**시안 F(완료 화면은 콘솔이다) + 라운드 3 리사이즈.** 비교표 근거: F는 답답함의 3원인(3겹
표면 · 거구 행 · 앵커 0개)을 한 화면에서 동시에 제거하는 유일한 안이고, 사용자의 "가장
중요한 요소가 리소스 테이블"이라는 발언이 Cloudscape full-page 문법의 전제(표가 곧 화면)를
그대로 충족한다. 열 너비 가변은 라운드 3에서 채택 전제 조건으로 추가됐고, 두 가지 소유자
결정이 함께 내려졌다:

1. **확장 상한 = 그 열 값 중 최장폭** — 빈 여백만 만드는 확장을 막는다(더블클릭 맞춤과 동일 값).
2. **행 구분선 강화** — "안 그러면 사람들은 아예 보지도 못 할듯". #EBEEF2 헤어라인(1.16:1) →
   `#D1D5DB`(DESIGN.md border-strong). emphasis(#6B7280)는 DESIGN.md가 분리용으로 금지하므로
   strong이 규정상 최고 단계다.

## 구현 내용 (이 PR)

- `useColumnResize` 확장: `clampToContent`(상한=열 값 최장폭 + 더블클릭 맞춤) ·
  `storageKey`(localStorage 지속, `pii:colw:v1:confirmed-resources`) · `reset()`.
  기존 소비처(모달 2곳)는 무옵션 호출이라 동작 불변.
- `WaitingApprovalTable` confirmed variant: 종류 칩 열 승격(행 77→52px, 칩 있는 행이 있을
  때만 열 생성) · `table-fixed` + 열별 기본폭(기존 실측 162·312·142·156·118·96 재사용) ·
  전 열 리사이즈 핸들 · 행 구분선 `bodyStrong` · 플랫 헤더(`approvalHeaderFlat`).
- `ConfirmedIntegrationTable`: 회색 툴바 셸 → "연동 리소스 · N건" 카운터 밴드 +
  검색·필터(5건 초과 시) + 「열 너비 초기화」 + 페이지네이션(페이지 크기 초과 시) — 시안 D 내장.
- `InstallationCompleteStep`: 카드 → 풀블리드 플랫 흰 표면(콘솔 문법). 스텝 1~6 카드는 유지 —
  완료 시점의 장르 전환은 의도.

## 의도적 이탈 · 후속

- 시안 E의 1280 폭 상한은 이 PR에 넣지 않음 — 별도 결정 지점(레이아웃 전역), 후속.
- IDC 7단계는 별도 컴포넌트 트리(`IdcConfirmedResourcesPanel`) — 후속.
- 드래그 중 표 전체 높이 가이드선은 생략 — 기존 `resizeHandle` 토큰의 경계선 점등을 재사용
  (앱 내 리사이즈 2곳과 문법 통일). 프로토타입의 px 칩은 데모 전용으로 명세에 기록.
- 카운트 열 우측 정렬(프로토타입 표기)은 기존 `LogicalDbCountCell` 좌측 정렬 유지 — 링크
  컴포넌트 재사용 우선.
