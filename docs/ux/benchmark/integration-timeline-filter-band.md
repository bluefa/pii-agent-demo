# 연동 시점 필터 행 — 벤치 2차: 표의 툴바 밴드 (2026-09-15)

- 대상: admin › Task Queue › 연동 시점 `/admin/pipelines/queue/integration-timeline` 의 필터 행(기준 seg · 기간 seg 7/14/21/30 · 달력 필드)
- 요청: 오너 "해당 필터가 조금 더 멋진 디자인으로 보여지면 좋겠네" — 1차 벤치([quick-range](integration-timeline-quick-range.md), PR #904)로 빠른 기간 위치와 gray-200 캔버스는 정했으나 필터 카드 자체가 촌스럽다는 피드백
- 아티팩트: https://claude.ai/code/artifact/ff08a9c1-60df-439c-9460-749878c13786
- 구현 PR: #904 (feat/quick-range 에 이어서)

## 진단 (실측 1920×902, 3927 목 서버)

| # | 문제 | 근거 | 등급 |
|---|---|---|---|
| 1 | 필터 카드 1640px 중 콘텐츠 784px — 우측 856px 빈 흰 띠 | 카드 x248 w1640 / 마지막 컨트롤 우단 1053 | 수치 위반 (여백 7원칙 ④) |
| 2 | 기준(축)과 기간(값) 세그먼트가 동형 — 칩 6개 한 줄로 읽힘 | 두 컨테이너 같은 bg·border·r8·32 | UX 원칙 (유사성) |
| 3 | 한 행에 테두리 색 셋 (seg gray-200 · 필드 gray-300 · 카드 border-strong) | 실측 bc 셋 | 수치 위반 (케이스 축소) |
| 4 | 7일 눌림과 날짜 필드의 인과가 안 보임 | 별개 객체, 10px 간격 | UX 원칙 |
| 5 | 스코프 캡션 없음 | admin-pipeline-style-guide §4 `.section-desc` 규칙 | 수치 위반 |
| 6 | 트리거 날짜 ISO 23자 | ui-ux-pro-max "locale-appropriate date formats" | UX 원칙 |
| 7 | 라벨 「기준」「기간」 12px 두 글자, 무게 없음 | w20 h17 | 제안 |
| 8 | CSV 가 헤더(y141), 필터는 y210 | "컨트롤은 지배하는 데이터 옆에" | 제안 |

## 사용한 레퍼런스 (전부 이 세션에서 확인, Cloudscape 만 기억 기반)

| 제품 | URL | 빌린 것 |
|---|---|---|
| Grafana 시간 컨트롤 | https://grafana.com/docs/grafana/latest/dashboards/use-dashboards/ | 한 컨트롤이 프리셋 이름과 실제 구간을 함께 말한다 |
| Cloudscape date-range-picker | https://cloudscape.design/components/date-range-picker/ | 트리거 문구 = 구간의 종류(상대/절대) → 「직접 선택」 세그먼트 |
| Datadog time frame | https://docs.datadoghq.com/dashboards/guide/custom_time_frames/ | 시간대 각주는 한 줄(팝오버 힌트) |
| Linear filters | https://linear.app/docs/filters | 적용 조건은 문장으로 읽힌다(캡션) |
| Metabase date filters | https://www.metabase.com/docs/latest/questions/query-builder/filters | 「열 이름 · 값」 어순 |
| Shopify analytics changelog | https://changelog.shopify.com/posts/analytics-last-n-days-presets-now-includes-today-s-data | "Last 7 days" 오늘 포함 — span=N−1 근거 |
| Stripe dashboard 기간 | https://support.stripe.com/questions/customizing-the-date-range-for-dashboard-home-charts | 한 줄 툴바 · 한 램프 |
| PostHog trends · issue #9727 | https://posthog.com/docs/product-analytics/trends/overview · https://github.com/PostHog/posthog/issues/9727 | 드롭다운 문구 = 상태 · 끝=오늘 기본 |
| Sentry logs | https://docs.sentry.io/product/logs/ | 상대/절대 구간을 시스템이 구분해 말한다 |
| MUI X shortcuts | https://mui.com/x/react-date-pickers/shortcuts/ | 팝오버 프리셋 표준(비교용) |
| Ant Design RangePicker | https://ant.design/components/date-picker | 프리셋 레일 폭 상수 |
| GitHub Primer SegmentedControl | https://primer.style/product/components/segmented-control/ | 값 선택=세그먼트, 뷰 전환=다른 컴포넌트 |
| Reka UI presets | https://reka-ui.com/examples/date-range-presets | 「최근 7일 · 9월 9일 – 15일」 식 사람 말 날짜 |
| 앱 내부 ResourceFilterBar | `app/admin/pipelines/queue/requests/_components/ResourceFilterBar.tsx` | 표 위 gray-100 툴바 밴드 자체 |

## 시안과 선택

| 시안 | 고치는 문제 | 구현 | 일관성 | 판례 |
|---|---|---|---|---|
| 1 정리만(램프 하나·라벨 제거·캡션·사람 말 날짜) | 3 5 6 7 | 반나절 | 높음 | — |
| 2 기간 컴파운드(seg ⊕ 날짜 필드) | 3 4 6 | 1일 | 중간 | seg 5개 경계 |
| **3 표 툴바 밴드 + 2 + 캡션 + CSV 우단** | **1 3 4 5 6 7 8** | 1.5일 | **높음** | — |
| 4 축은 탭 | 1 2 3 4 5 7 8 | 2일 | 중간 | 탭 기대치 새 문제 |
| 5 문장 칩 | 1 2 3 5 6 7 | 2일 | 높음 | ⛔ 빠른 기간 2클릭(1클릭 판례 충돌) |

채택 **시안 3** (오너 "시안3으로 구현해봐", 09-15). 가장 많은 문제를 고치면서 새 형태를 가장 적게 만든다 — 밴드·캡션 토큰·컨트롤 높이 전부 기존 것.
남는 문제 2(동형)는 눌림 스타일이 아니라 위치·결합(기간은 날짜와 한 몸)으로만 구분한다. 시안 4 는 축이 셋 이상 되거나 축마다 열 구성이 달라지면 다시 꺼낸다.

## 구현 결과 (실측)

- 필터 카드 삭제 · 표 카드 머리 밴드 gray-100 `rgb(242,244,247)` 상단 r11 h61 · 카드 r12(overflow-hidden 제거 — 팝오버가 밴드 안에서 열린다)
- 기준 seg 32 · 기간 컴파운드 32/r8/gray-300 안에 seg 30(좌 r7) 항목 26 ×5(7·14·21·30·직접 선택) + attached 트리거(우 r7) 「9월 9일 – 15일」
- 캡션 「연동 시작 날짜 기준 · N건」 14 medium · CSV 32 밴드 우단
- 테스트: 뷰 15 + 포맷 10 = 25/25 (`formatDayRange` 4 케이스 · 직접 선택 점등·달력 열기 · 캡션 축 전환)
