# 연동 시점 화면 · 빠른 기간 선택 (최근 7·14·21일)

- 날짜: 2026-09-15
- 대상 화면: admin › Task Queue › 연동 시점 (`/admin/pipelines/queue/integration-timeline`) 의 기간 필터
- 아티팩트: https://claude.ai/code/artifact/62a67651-84bd-4d22-8fbb-549994853007
- 구현 PR: feat/quick-range (번호는 PR 생성 후 본문에 기재)

## 문제 (증거 등급)

| # | 등급 | 문제 |
|---|---|---|
| 01 | 오너 지적 | 최근 7·14·21일이 프리셋에 없고, 프리셋 자체가 팝오버 안에만 있어 3클릭 |
| 02 | UX 원칙 | 기본 창(최근 90일)의 이름이 화면 어디에도 없다 — 트리거는 날짜 둘뿐 |
| 03 | UX 원칙 | 팝오버 안 프리셋도 적용 버튼을 요구한다 (상대=즉시 / 절대=Apply 가 통례) |
| 04 | 수치 위반 | 「기간」 라벨을 팝오버 컴포넌트가 그려 「기준」 라벨과 소유자가 다르다 |
| 05 | 제안 | 선택한 기간이 URL 에 없어 새로고침·공유에 안 남는다 (범위 밖) |

## 사용한 레퍼런스

| 제품 | URL | 빌린 요소 |
|---|---|---|
| Sentry 페이지 필터 (기억 기반) | https://docs.sentry.io/product/stats/ | 상대=즉시 적용 / 절대=Apply · 커스텀 뒤 프리셋 해제 |
| Mixpanel 리포트 날짜 (확인함) | https://docs.mixpanel.com/docs/reports | 트리거/프리셋의 「7D」식 짧은 이름 |
| Amplitude datepicker (확인함) | https://amplitude.com/docs/faq/the-datepicker | 프리셋 칩 행, 프리셋 즉시 적용 |
| Google Analytics 4 (확인함) | https://support.google.com/analytics/answer/13412290?hl=en | 좌 프리셋 · 우 달력 2단 팝오버 (기존 구조 유지 근거) |
| Shopify Analytics (확인함) | https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/custom-reports/time-ranges | 프리셋이 늘면 섹션으로 접는다 (후속 규칙) |
| GitHub Actions usage metrics (확인함) | https://docs.github.com/en/organizations/collaborating-with-groups-in-organizations/viewing-github-actions-metrics-for-your-organization | Period 드롭다운 (시안 3 의 원형) |

## 채택: 시안 2 「빠른 기간 세그먼트 + 달력」

필터 행 「기간」 = `[7일 | 14일 | 21일 | 30일]` 세그먼트(클릭 즉시 적용) + 달력 버튼(적용 필요).
팝오버 프리셋 레일에도 최근 14일·21일 추가. 기본 창 = 최근 7일.

눌림 규칙: 적용된 구간이 오늘−(N−1) … 오늘과 정확히 같을 때만 N 이 눌린다. 달력으로 고른 구간이면 아무것도 안 눌리고, 날짜는 옆 버튼이 말한다.

비교표 근거: 다섯 시안 중 1클릭을 기존 부품(`segmentedControlStyles`)만으로 달성하는 유일한 안.
시안 3(드롭다운)은 2클릭, 시안 4(자유 입력)·5(이동 화살표)는 같은 문제를 풀면서 컨트롤·규칙을 하나씩 더 얹는다.

레퍼런스 6곳 중 5곳이 프리셋을 팝오버 안에 두는 것과 다른 선택이다. 근거는 둘: 오너가 세 창을 콕 집었고, 이 필터 행에는 컨트롤이 둘뿐이라 자리가 있다. **세그먼트가 5개를 넘게 되면 시안 3 으로 접는다.**

## 실측 (mock dev server, 2026-09-15)

- 세그먼트 그룹 32px · 항목 26px · 달력 버튼 32px — 같은 행 높이 동일
- 기본 7일 눌림, 구간 = 오늘−6 … 오늘
- 「21일」 클릭 → 즉시 재조회, 21일 눌림, 7일 해제
- 달력에서 「올해」 적용 → 눌림 0, 버튼은 `2026-01-01 – 2026-09-15`

## 후속 후보

- 05: 기간·기준을 URL 쿼리에 실어 보존 (Sentry `statsPeriod=14d` 방식). 별도 PR.
