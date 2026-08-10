# 인프라 작업 대시보드 리디자인 — 벤치마크 결정 기록

- **날짜**: 2026-08-10
- **대상 화면**: `/pass/admin/pipelines` (`app/admin/pipelines/page.tsx`)
- **진단 기준**: main `cb3cd3f9` 코드 정독 + mock dev 실행 화면 1600×1100
- **아티팩트**: https://claude.ai/code/artifact/a7ec5fff-6e5e-4479-b775-e0a8aec0eec7
  (진단 12건 · 레퍼런스 13종 · 개선안 5안 전문. claude.ai 에 있어 저장소 이력 밖이라 이 문서를 남긴다)

## 1. 문제 진단

근본 원인은 **이 화면만 혼자 쓰는 문법**이다. 같은 admin 섹션의 형제 화면들이 이미 정해 둔
값(타일 크기, 표 헤더, Provider 마크, 선택 상태)을 쓰지 않고 대시보드 전용 토큰을 따로 두면서,
화면은 넓은데 한 번에 읽히는 정보가 적어졌다.

| # | 문제 | 근거 | 등급 |
|---|------|------|------|
| P1 | KPI 값 48/700 + 폭 무제한 — 숫자 4개에 세로 142px | `theme.ts` `text.statValue` / `dashboard.kpiGrid` ↔ `tqStyles.ts` stat (32/600, max 260px) | 수치 위반 |
| P2 | `DASH_PAGE_SIZE = 5` — 1600×1100 에서 목록 아래 약 400px 공백, 200건 창이 최대 40페이지 | `_dashboard/logic.ts` | UX 원칙 |
| P3 | 페이저가 `1 / 2` 만 표시 — 총 건수 없음, `size=200` 창 잘림이 무고지 | `page.tsx` pager | UX 원칙 |
| P4 | StatTile 에 `onClick` 없음 — 요약과 목록이 한 화면에 있으나 연결되지 않음 | `page.tsx` StatTile | UX 원칙 |
| P5 | FAILED 행의 유일한 빨강이 68px 필 하나 — 행·진행바·시간 모두 중립 | `_dashboard/cells.tsx` | UX 원칙 |
| P6 | 진행바 트랙 `h-1`(1px), FAILED 에서도 회색 채움 | `theme.ts` `dashboard.progressTrack/Fill` | 수치 위반 |
| P7 | 정체성이 이름/코드/#Target 3개 열로 분산 — 1600px 에서 300px 이상 벌어짐 | `page.tsx` 표 헤더 | UX 원칙 |
| P8 | Cloud 가 평문 텍스트 — 같은 섹션 다른 표는 전부 공용 `ProvTag` | `cells.tsx` `CloudText` ↔ `_components/ProvTag.tsx` | 수치 위반 |
| P9 | 한 섹션에 표 헤더 문법 2종 | `pipelineStyles.table.th` ↔ `pipelineStyles.dashboard.th` | 수치 위반 |
| P10 | "최근 24시간" 이 한 화면에 3~4회 반복 | seg + 카드 스탬프 + KPI 배지 2장 | UX 원칙 |
| P11 | h1 이 영문 "Dashboard" 인데 사이드바는 "대시보드" | `page.tsx` / `layout.tsx` | 수치 위반 |
| P12 | 항상 켜져 있는 select 3개(h36) + 같은 내용 칩 반복 | `page.tsx` 필터 바 | 제안 |

## 2. 실제로 차용한 레퍼런스

아티팩트에는 13종이 있고, 그중 개선안이 실제로 가져온 것은 아래 8종이다.
(GitHub Actions·Argo 2종은 문서가 UI 세부를 서술하지 않아 **부분 확인**으로만 남았고, 차용하지 않았다.)

| 레퍼런스 | URL | 차용한 요소 |
|---|---|---|
| Sentry — Issues 스트림 | https://docs.sentry.io/product/issues/ | 요약이 곧 필터, 기본 랜딩을 "봐야 하는 것"으로 |
| Temporal — Web UI | https://docs.temporal.io/web-ui | 저장된 뷰 / 총 건수를 늘 말하기 |
| Apache Airflow — UI | https://airflow.apache.org/docs/apache-airflow/stable/ui.html | 행 안의 단계 스트립 |
| Dagster — Runs | https://docs.dagster.io/guides/operate/webserver | 실행 계보·재실행 동선 |
| Cloudscape — content density | https://cloudscape.design/foundation/visual-foundation/content-density/ | 밀도 규칙(한 화면에 더 많은 행) |
| Datadog — CI 검색 | https://docs.datadoghq.com/continuous_integration/search/ | 잘린 결과를 잘렸다고 말하기 |
| Google Cloud Build | https://cloud.google.com/build/docs/view-build-results | 상태색 단계 표시 |
| Vercel — Deployments | https://vercel.com/docs/deployments | 경과 시간을 행의 1급 값으로 |

## 3. 채택안: 시안 E (A + B + C)

비교표에서 E 가 이긴 이유는 "가장 많이 바꾸기 때문"이 아니라 **세 안이 겹치지 않는 층을
건드리기 때문**이다 — A 는 페이지 골격, B 는 진입 동선, C 는 행 내부. 순서대로 넣으면 각 PR 이
그 자체로 완결된다. 진단 12건 중 11건 커버, 남는 것은 P12(필터 문법)뿐이고 시안 D 로 백로그에 둔다.

| PR | 내용 | 해결 |
|----|------|------|
| 1 | 밀도 정렬 + 기간 기본 7일 + 총 건수/창 고지 | P1 일부·P2·P3·P9·P11 |
| 2 | KPI 카드 = 필터 (탭 줄 없음) | P4·P5·P10·P12 일부 |
| 3 | 행 문법 재설계 (2줄 스택·`ProvTag`·세그먼트 진행·경과) | P5·P6·P7·P8 |

### 오너 결정 이력

1. **트리아지 탭 줄 삭제** — 처음 시안은 카드 아래에 탭 줄을 따로 뒀으나, 같은 4개 버킷을 두 줄에
   두 번 그리는 중복이라 **카드가 탭을 겸한다**. 대신 목록 위에 "지금 무엇으로 걸러져 있는지 + 해제"
   한 줄이 필수가 된다 — 탭이 하던 일의 나머지다.
2. **기간 기본값 7일** — 24시간은 "오늘 무슨 일이 있었나"에 답하지만, 이 화면을 여는 이유는
   아직 안 끝난 일을 찾는 것이다. 어제부터 멈춰 있는 작업이 24시간 창 밖으로 빠졌다.
3. **버킷 이름 "확인 필요"** (← "조치 필요") — 사이드바 운영 알림 배지가 이미
   `"조치가 필요한 대상"`(`layout.tsx`)이다. 같은 이름을 쓰면 서로 다른 두 집합이 한 이름을 갖고,
   두 숫자가 다를 때 어느 쪽이 맞느냐는 질문이 반복된다.
4. **카드 마크는 그릇 없이 글리프만** — 운영 알림 카드가 마크를 쓰는 방식 그대로
   (`AlertStageCard.tsx` `<Icon size={20} />`). 배경 타일을 씌우면 마크가 눌리는 것처럼 보이는데,
   실제로 눌리는 건 카드 전체다.

### 수치의 출처

새로 정한 값은 없다. 모두 같은 역할을 하는 형제 화면에서 가져왔다.

| 값 | 출처 |
|---|---|
| 타일 선택 문법(테두리 상시 1px → active 브랜드) | 운영 알림 요약 타일 `AlertsView.tsx` — 이 앱에서 "타일 = 필터"인 유일한 선례 |
| 타일 값 32/600 · 그리드 max 260px | Task Queue 운영 대시보드 `tqStyles.ts` stat |
| 표 헤더 h34 · 12/600 · tracking .03em · gray-50 밴드 | `pipelineStyles.table.th` (가로 패딩만 px-5 — 이 표의 셀이 px-5) |
| Provider 마크 글리프 14px + 라벨 12/500 | 공용 `ProvTag` — `pipelineStyles.provTag` |
| 카드 마크 글리프 20px | 운영 알림 카드 `AlertStageCard.tsx` |
| 마크 4종 | `_components/icons.tsx` — `warn-tri` / `loader`(StatusPill 의 RUNNING) / `check-circle` / `table`(목록 마커) |

## 4. 미결 사항

**취소(CANCELLED)가 갈 카드가 없다.** 상태는 5종(`PENDING`/`RUNNING`/`DONE`/`FAILED`/`CANCELLED`)인데
카드는 4장이라, 확인 필요 + 진행 중 + 완료의 합이 전체보다 취소 건수만큼 적다. 선택지는 셋:

- **(a)** "완료" 카드를 **"종료"** 로 바꿔 `DONE + CANCELLED` 를 함께 담는다 — 합이 맞고 라벨도 정직하다. **← 제안**
- (b) 지금처럼 두고 "전체" 카드만 점선으로 "필터 없음"이라 구분한다 — 변경은 0이지만 "왜 합이 안 맞냐"가 반복된다.
- (c) 카드를 5장으로 — 취소는 드물어 4장 중 한 자리를 주기엔 비싸다.

또한 "확인 필요"에 정체된 `PENDING`/`RUNNING` 을 포함할지, 포함한다면 임계값을 얼마로 할지가
PR 2 의 선행 결정이다(제안: PENDING 1시간, RUNNING 진행 0으로 30분). **포함할 경우 그 건들은
"진행 중" 카드에서 빼야** 두 카드에 이중으로 세어지지 않는다.

## 5. 구현

| PR | 브랜치 | 상태 |
|----|--------|------|
| 1 | `feat/pipelines-dash-density` | [#684](https://github.com/bluefa/pii-agent-demo/pull/684) |
| 2 | 미착수 | 취소 버킷 결정(§4) 선행 |
| 3 | 미착수 | — |
