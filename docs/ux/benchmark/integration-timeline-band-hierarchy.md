# 연동 시점 필터 밴드 — 벤치 3차: 축·기간 계층과 Excel 버튼 (2026-09-15)

- 대상: admin › Task Queue › 연동 시점 `/admin/pipelines/queue/integration-timeline` 표 머리의 필터 밴드
- 요청: 오너 "해당 필터가 너무 완성도가 떨어져" — ① 축(연동 시작 날짜 / 최초 연동 완료확인 날짜)과 기간(7·14·21·30·직접 선택·날짜)의 계층 구분 ② 「연동 시작 날짜 기준 · N건」 캡션 삭제 ③ CSV → Excel 내려받기(초록·엑셀 아이콘) ④ 필터·헤더 크기 과소
- 아티팩트: https://claude.ai/artifact/NBqs62p4HeecdmbmKQKvWf
- 구현 PR: #907 (feat/timeline-csp-column — Cloud 열과 같은 브랜치)

## 진단 (실측 1710×891, 6918 목 서버, main a9687aa5)

| # | 문제 | 근거 | 등급 |
|---|---|---|---|
| 1 | 축 seg 와 기간 컴파운드가 동형 — h32 · r8 · gray-50 바닥 · 항목 26px 14/500, 간격 16 | 두 컨테이너 computed style 동일 | 오너 지적 · 수치 위반(인접 계층 레버 0개) |
| 2 | 캡션 「… 기준 · 3건」이 눌린 seg 와 푸터 「3건 · 전체 3건 중」을 반복 | caption x997 · foot 12px | 오너 지적 · UX 원칙(중복) |
| 3 | 「CSV 내려받기」 회색 secondary — 형식을 말하고 도구를 안 말함 | PlButton secondary · `Accept: text/csv` | 오너 지적 · 제안 |
| 4 | 표 본문 16/500 56px 행 > 필터 항목 14/500 26px — 위계 역전. h1 24 는 앱 표준 | td/th/seg 실측 | 오너 지적 · UX 원칙 |
| 5 | 밴드 우측 421px 빈 띠 | band w1428 · 콘텐츠 867 | 수치 위반(여백 ⑦) |
| 6 | 날짜 필드가 seg 의 6번째 항목처럼 읽힘 | 1px 선 · 같은 14px | UX 원칙 |
| 7 | 2차에서 지운 「기준」「기간」 라벨이 그룹 경계 역할도 같이 지웠음 | 2차 진단 #7 | 제안 |

## 사용한 레퍼런스 (12 확인함 · 1 기억 기반)

| 제품 | URL | 빌린 것 |
|---|---|---|
| Amplitude dashboard filter | https://amplitude.com/docs/analytics/dashboard-filter | 기간 프리셋과 단위(Interval)는 인접하되 다른 부류의 컨트롤 |
| Stripe reports options | https://docs.stripe.com/reports/options | Date range 와 Time zone 을 두 개의 이름 붙은 설정으로 분리 · 건수 캡션 없음 |
| Google Analytics 4 | https://support.google.com/analytics/answer/13412290?hl=en | 기간 → 비교, 두 결정을 순서로 분리 |
| Grafana time picker | https://grafana.com/docs/grafana/latest/dashboards/use-dashboards/ | 기간(전역)과 group by(패널)를 스코프로 분리 |
| Datadog Compare Time | https://docs.datadoghq.com/dashboards/widgets/timeseries/ | 선택지 5개까지 라디오/세그먼트 |
| Cloudscape date-range-picker | https://cloudscape.design/components/date-range-picker/ | 상대/절대는 한 컨트롤의 모드 — 컴파운드 유지 근거 |
| GitHub issues qualifiers | https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests | 축 이름 = 열 이름 |
| GitHub Primer SegmentedControl | https://primer.style/product/components/segmented-control/ | 값 선택=세그먼트 · 좁으면 dropdown variant |
| shadcn/ui Data Table | https://ui.shadcn.com/docs/components/data-table | h-8 한 높이 · 좌/우 두 덩이 |
| Cloudscape property filter | https://cloudscape.design/components/property-filter/ | 표 머리는 조립식 |
| Power BI Export data | https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-export-data | 라벨은 기능명 · xlsx/csv 분기와 상한 고지 |
| Metabase exporting results | https://www.metabase.com/docs/latest/questions/exporting-results | 포맷 중립 「Download」 — 초록은 보편 관례가 아님 |
| Cafe24 엑셀 다운로드 (기억 기반, 403) | https://support.cafe24.com/hc/ko/articles/8466588105241 | 국내 관례 라벨 「엑셀 다운로드」 · 색/아이콘 미확인 |

## 시안과 선택

| 시안 | #1 계층(레버) | #2 | #3 | #4 크기 | #5 | #6 | 구현 | 일관성 | 판례 |
|---|---|---|---|---|---|---|---|---|---|
| **1 라벨 + 구분선** | △ 1.5 | ✓ | ✓ | ✗ | ✗ | ✗ | 0.5일 | 높음 | 없음 |
| 2 축=탭 (추천안) | ✓ 3 | ✓ | ✓ | △ | ✓ | ✓ | 1일 | 높음 | 2차 보류(전제 만료) |
| 3 축=셀렉트 | ✓ 1 | ✓ | ✓ | ✗ | △ | △ | 0.5~1일 | 높음 | 축 2클릭 |
| 4 두 행 밴드 | ✓ 2 | ✓ | ✓ | ✓ | ✓ | ✗ | 1일 | 낮음(36 새 높이) | 세트 밖 값 |
| 5 기간=헤더 | ✓ 1 | ✓ | ✓ | ✗ | ✓ | △ | 1일 | 중간 | 2차 「컨트롤은 데이터 옆」 역행 |

비교표 추천은 시안 2 였으나 **오너가 시안 1 을 채택** ("시안1 로 가보자. 구분선만 찐하게 구현해", 09-15). 컨트롤 형태·크기는 그대로 두고 라벨과 구분선으로 경계만 세운다. 시안 2(탭)는 축이 셋 이상 되거나 크기 지적이 다시 나오면 꺼낸다.

## 구현 (PR #907)

- 라벨 「날짜 기준」「기간」 12/700 `--pl-text-medium` (표 머리 th 크기·무게, 색은 gray-100 밴드 대비를 위해 medium)
- 구분선 2×24 `--pl-border-strong` — 시안 그림(1×20 gray-300)보다 굵고 진하게, 오너 지시
- 캡션 삭제 (`aria-live` 도 함께) — 건수는 푸터 한 곳
- `PlButton variant="ok"` 신설: `--pl-ok-border / --pl-ok-bg / --pl-ok-text`, hover 는 테두리만 `--pl-ok` · 14px 범용 시트 글리프 · 라벨 「Excel 내려받기」 · 실패 문구 「Excel 파일을 내려받지 못했습니다.」
- 세그먼트 aria-label 「기간 기준」→「날짜 기준」 (보이는 라벨과 일치)
- 파일 형식은 그대로 `text/csv`, 파일명 `.csv`

## 미결 — Excel 라벨의 전제

- ⚠️ 서버 CSV 에 **UTF-8 BOM** 이 있어야 Excel 에서 한글 서비스명이 안 깨진다. 목 CSV(`lib/bff/mock/task-queue.ts` `timelineCsv`)는 BOM 을 안 붙이고, 실 BE 는 미확인. FE 는 바이트를 다시 만들지 않는다(기존 규칙) — BE 확인 1건.
- xlsx 전환은 BE 응답 샘플을 받은 뒤 (swagger 미수록 API, G8).
