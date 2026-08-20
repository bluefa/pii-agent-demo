# 논리 DB 주간 보드 표면 이동 — 벤치마크 결정 기록

- 날짜: 2026-08-20 (리서치 2026-08-19)
- 대상 화면: `/admin/pipelines/ops/target-sources/{id}?tab=approval` — DbWeeklyBoard 의 표면
- 아티팩트: https://claude.ai/code/artifact/1b9f3837-61b8-47fd-9742-5840a87368e8
- 구현 PR: #737 (2차 PR 에 커밋 추가 — 인라인 보드가 머지 전에 패널로 재배치됨)
- 선행 기록: `dag-health-approval-gate.md` (1차 게이트 + 2차 관측층)

## 문제 요약 (증거 등급)

| # | 문제 | 등급 |
|---|------|------|
| P1 | 1,500행 관측층이 인라인 상주 — 1801 에서 보드 혼자 ~1,300px 를 차지 | 사용자 지적 |
| P2 | 스트립 색의 의미가 hover 툴팁에만 있고 범례가 없음 | 사용자 지적 |
| P3 | 착지가 원거리 스크롤 점프 — 닫기(원위치 복귀) 경로가 없음 | UX 원칙 (탈출 경로) |
| P4 | 문서 스크롤 + 보드 pager 의 이중 내비게이션 | UX 원칙 (스크롤 충돌) |
| P5 | 4열이 1,286px 폭 대비 저밀도 (논리 DB 열 max-w 420px) | 제안 |

## 실제 차용한 레퍼런스

표면 (시안 A):

- Azure Portal — context pane("컨텍스트를 잃지 않는" 우측 오버레이) + blade 최대화 문법:
  https://learn.microsoft.com/en-us/azure/azure-portal/azure-portal-overview
  (portaldocs 원 저장소는 404 — context pane 조항은 기억 기반으로 배지 표기)
- Datadog Log Explorer side panel — 대량 목록 행 상세의 업계 표준:
  https://docs.datadoghq.com/logs/explorer/side_panel/
- GitHub Projects side panel — 표를 유지한 채 반복 왕복: https://docs.github.com/en/issues/planning-and-tracking-with-projects/managing-items-in-your-project/editing-items-in-your-project
- M3 side sheets — 집중 조작이므로 scrim 있는 modal side sheet 쪽: https://m3.material.io/components/side-sheets/overview
- TaskDrawer (앱 내부) — 닫기·Esc 레이어링·언마운트 리셋 문법
- ModalShell 'wide' (앱 내부) — 폭 720px 의 수치 출처

반증 (시안 B 기각 근거):

- Shopify Polaris — "모달에 대량 정보 금지": https://shopify.dev/docs/api/app-home/using-polaris-components/modal
- Atlassian Drawer 폐기 예고(→Modal 회귀) — 패널의 전역 레이아웃 세금: https://atlassian.design/components/drawer/usage

범례 (§2):

- Grafana Status history — 색 격자에는 상시 범례가 기본 장비, 범례=의미·툴팁=상세:
  https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/status-history/
- GitHub contribution graph "Less…More" — 모서리 범례, 실물 스와치 + 최소 단어 (기억 기반)

## 채택안과 이유

시안 5개 비교표에서 P1(상주)·P3(복귀)·P4(이중 스크롤)를 동시에 해소하는 안은
**A(우측 오버레이 패널 720px)** 뿐. 모달(B)은 Polaris 반증에 직격하고 뒤(밴드·게이트)를
가리며, 스플릿(C)은 P1 미해소 + IDC Step5 "표 폭 986px 포화" 판례 리스크,
접힘 카드(D)는 P4 를 남긴다. 범례(P2)는 어느 시안과도 직교라 선행 — 현행 CELL_FILL
토큰과 1:1 이고 새 색이 없다.

핵심 구현 결정:

- **패널 셸 = ModalShell `variant='panel'`** — 신규 셸 대신 기존 계약(scrim·press-start
  overlay 판정·포커스 트랩·Esc·route-close)에 정렬만 우측 도킹으로 추가. 도킹면이라
  radius 없이 border-l (TaskDrawer 문법). 폭은 처음 720(`dialogWide` 등급)이었으나
  행이 Database/Schema 2줄 정체성 + DAG 열까지 지면서 5열 최소 폭이 747px 로
  측정돼(콘텐츠 664 초과) 다음 등급인 `dialogXWide` 960 으로 올렸다 — 등급 밖의
  중간 수치를 새로 만들지 않는다.
- **본문 잔류물 = 요약 라인 한 줄** (버킷 kv + "현황 보기") — 보드의 문패. 착지
  스크롤 코드(key 리마운트 + 커밋 후 instant 스크롤)는 소멸.
- **진입 3곳이 프리셋과 함께 연다**: 밴드 실패 숫자(실패 필터) · 에이전트 표 "DB
  보기"(에이전트 스코프 + 전체) · 요약 라인 버튼(전체). ModalShell 이 닫힐 때
  자식을 언마운트하므로 매 오픈이 새 마운트 — 리마운트용 seq/key 가 필요 없다.
- **범례는 툴바 우측 끝** — 실물 스와치(스트립과 같은 16px 셀) + 한 단어: 성공(초록)
  · 실패(빨강) · 실행 시작(주황) · 스케줄 없음(회색) · 판정 불가(흰 면+획) · 오늘(링).
  RUNNING 을 "진행 중"으로 부르지 않는다(2026-08-20 오너) — 지난 날짜 칸에도 서는
  값이라 지금 돌고 있다는 뜻이 되어 버린다. 응답이 아는 건 그날 실행이 시작됐고
  결과가 없다는 것까지다. 연결 상태(TestConnection)의 RUNNING 은 진짜 실행 중이라 유지.
  wire enum 은 라벨에 싣지 않는다(셀 툴팁 채널 유지).
- **열 재배치**: 논리 DB 열 max-w 420→280px(라벨 트랙 + 값 트랙 grid), DAG 열
  max-w 200px. 셀 16px·간격 3px 는 현행 유지. pager 는 고정 푸터로 내려가 행
  영역 floor 를 대체했다.
- **DAG 셀은 가운데를 접고, 빈 값은 말로 한다** — DAG id 는 300자까지 오고 한 타깃의
  DAG 들은 접두사를 공유하므로, CSS ellipsis(머리만 남김)로는 여러 행이 같은 문자열로
  보인다. `abbrevDagName` 이 머리 12 + … + 꼬리 10(=23자, 열 176px ÷ 12px mono)으로
  접고 전체 이름은 title 이 진다. dagName 이 null 인 행은 대시 대신 "실행 기록 없음" —
  대시는 칸이 비었다까지만 말하고 왜 비었는지를 말하지 않는다(목에서 null 은 7일 전부
  NOT_SCHEDULED 인 행에만 온다). 툴팁에 응답 사실("실행한 DAG 가 응답에 없어요").
  **이름이 없는 행도 눌러서 열린다** — 주소 조회의 키는 dagName 이 아니라 databaseUri
  라서, 이름이 없어도 물어볼 것(주소·상태)이 남아 있다.
- **행 정체성 = Database / Schema 라벨 2줄**, 주소(databaseUri)는 툴팁으로 내림 —
  MySQL 은 스키마와 데이터베이스가 같은 객체라 두 줄이 같은 값이 되는 경우가
  있어 라벨 없이 쌓으면 중복으로 읽힌다. 스키마가 없는 행은 대시가 아니라 라벨째
  접는다(없는 값이 행마다 한 줄을 차지하지 않도록). 이름 없는 행의 "주소가 1급 +
  이름 미확인" 경로는 제거 — 오너 판단으로 Database 는 항상 있다고 가정한다
  (2026-08-20).
- 시안 A→B 는 배타가 아니라 승격 관계(Azure blade 최대화 문법) — 패널이 좁다는
  피드백이 오면 최대화 버튼으로 확장 가능, 이번 구현엔 넣지 않음.
