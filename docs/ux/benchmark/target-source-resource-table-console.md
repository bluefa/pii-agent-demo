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

## 라운드 4 (2026-08-21, 발주 3건)

> "Azure Web Console 처럼 리소스 행에서 각 컬럼 별로 왼쪽 부분이 오른쪽에 덮인 느낌" ·
> "각 컬럼의 최대/최소 경계선을 정하고, 해당 경계선은 Stroke" · "행이 좁혀져도 헤더
> 행간의 overwrite는 안 되게 (현재는 겹침)"

| # | 결정 | 메커니즘 |
|---|------|---------|
| R4-1 | **덮임 클립**: 말줄임표(…) 폐지, 글자 중간 하드컷 | …는 "여기서 줄였다"고 말하고, 컷은 "밑으로 계속된다"고 말한다. 셀(td)이 `overflow-hidden`으로 직접 클립 — overflow는 패딩 박스에서 잘리므로 텍스트가 우측 패딩 18px를 뚫고 흐르다 **경계선 위에서** 잘린다. 셀 내부의 자기-truncate는 컷을 콘텐트 박스(경계선 18px 앞)로 옮기므로 전부 제거. 툴팁은 `position:fixed` 포털이라 클립 무관 |
| R4-2 | **경계 스트로크**: 전 열 경계에 상시 세로선 `#D1D5DB` (`consoleGrid`) | 컷이 일어나는 바로 그 선이므로 행 구분선과 같은 border-strong — 더 옅은 단계는 라운드 3의 "아예 보지도 못 한다" 판정 재적용. 모달 리사이즈 표 2곳은 기존 무선(無線) 문법 유지 |
| R4-3 | **헤더 하한 = 라벨 폭**: 드래그·키보드가 라벨이 잘리기 시작하는 폭에서 정지 (`headerFloor`), 상한도 `max(값 최장폭, 라벨 폭)`으로 합성 | 라벨 span(`data-resize-label`, shrink-to-fit inline-block)의 scrollWidth + 셀 패딩 + 1. 라벨 자체도 self-truncate라 구버전 저장 폭이 하한보다 좁아도 옆 헤더를 덮지 못한다 |
| R4-4 | **표 폭 = Σ열폭** (w-full 폐지) | `w-full` + 전열 고정폭에서는 Σ열폭 < 컨테이너가 되는 순간 fixed 알고리즘이 남는 공간을 비례 배분 — 선언 폭과 실제 폭이 어긋나 16px 키보드 스텝이 화면상 ~3px로 뭉개졌다. 프로토타입(승인본)과 같은 폭 동기화로 교정: 남으면 표가 짧아지고(우측은 플랫 표면의 여백), 넘치면 가로 스크롤 |

실측(목 1012·1011): Region 드래그 하한 74px = 라벨 37 + 패딩 36 + 1 정확 정지 ·
ArrowRight 한 번에 74→90(정확 16) · ID 상한 589 정지 · 헤더 겹침 0 (60px 강제 축소
상태 포함) · 폴드 멤버 행 7칸 정렬 + 스트로크 유지 · 클립된 셀 위 툴팁 정상 부양.

라운드 4의 이탈: Resource ID 열의 컷은 경계선이 아니라 복사 버튼 앞(~46px 리저브)에서
일어난다 — hover 복사 어포던스의 자리이고, 컷 문법(글자 중간 절단)은 동일하다.

- 시안 E의 1280 폭 상한은 이 PR에 넣지 않음 — 별도 결정 지점(레이아웃 전역), 후속.
- IDC 7단계는 별도 컴포넌트 트리(`IdcConfirmedResourcesPanel`) — 후속.
- 드래그 중 표 전체 높이 가이드선은 생략 — 기존 `resizeHandle` 토큰의 경계선 점등을 재사용
  (앱 내 리사이즈 2곳과 문법 통일). 프로토타입의 px 칩은 데모 전용으로 명세에 기록.
- 카운트 열 우측 정렬(프로토타입 표기)은 기존 `LogicalDbCountCell` 좌측 정렬 유지 — 링크
  컴포넌트 재사용 우선.

## 라운드 5 (2026-08-21, 발주 2건)

> "미묘하게 구분선과 hover가 일치하지 않네요" · "Azure나 AWS는 조금 자연스럽던데..
> 너무 선이 진한거 아닌가요? benchmark 하면서 실측한 값과 디자인이 있을텐데 해당
> 부분을 참조해주세요."

| # | 결정 | 메커니즘 |
|---|------|---------|
| R5-1 | **가이드=경계선**: 리사이즈 hover/focus 가이드가 경계선 위에 정확히 얹힌다 (`resizeHandleOnGrid`) | 불일치의 실체는 가이드의 3px 인셋(`after:right-[3px]`) — 라운드 4가 상시 스트로크를 그리자 파란 가이드가 그 **옆에**(경계−4..−3px) 점등해 평행선 두 줄로 읽혔다. 콘솔 표(=`clampToContent` 소비처)만 flush·2px로 전환: 실측 가이드 우변 626 == th 경계 626. 프로토타입의 straddling 가이드와 같은 문법. 모달 2곳은 스트로크가 없어 기존 토큰 유지 |
| R5-2 | **세로 레일 한 단 강등**: `consoleGrid` #D1D5DB → **#E5E7EB**(DESIGN.md border-default) | 벤치마크 실측이 근거: R14 AWS 라이브 데모 행 선 0.8px #EBEBF0(**1.19:1**) · R15 Fluent `colorNeutralStroke2` #E0E0E0(**1.32:1**) — "AWS는 선을 진하게 긋지 않는다"(R14 결론). border-default(1.25:1)가 실측 밴드 안의 시스템 램프 단계. **행 구분선은 #D1D5DB 유지** — 라운드 3 발주("아예 보지도 못 한다")는 행에 대한 판정이고, 강한 행 리듬 + 조용한 열 레일이 콘솔 자체의 위계다 |
| R5-3 | **confirmed hover를 프로토타입 값으로**: #EAEEF7 → **#F7F9FB** (`tableRowLift.console`) | R5-2의 파생 필수: #E5E7EB 레일은 #EAEEF7 밑에서 **1.08:1**로 소멸(워시가 램프 한 칸을 먹는다), #F7F9FB 밑에서는 **1.19:1** — AWS 실측 선의 흰 바탕 대비와 같은 값. #F7F9FB는 승인된 동작 프로토타입의 hover 그대로. 텍스트 리프트(`cellText`·NAME_LIFT)는 더 밝은 틴트에서 대비가 오히려 오른다. 승인 표(2·3단계)와 제외 행 hover는 불변 |

실측(목 1012): 레일 rgb(229,231,235) th·td 적용 · hover 행 배경 rgb(247,249,251) ·
hover 행 위에서도 레일 잔존 · 가이드 우변==경계(626==626), #0064FF, 2px · 컷 문법(글자
중간 절단)과 폴드·툴팁 동작 불변 · 전체 vitest 2632/2632.
