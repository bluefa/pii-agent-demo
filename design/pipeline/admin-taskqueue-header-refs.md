# 연동 요청 상세 — "요청 정보 카드 → 페이지 헤더" 리디자인 레퍼런스

> 2026-07-20. 트리거: AWS 상세(#/requests/2013)의 요청 정보 카드가 어색함 —
> "차라리 상단 Header같은 느낌" (오너). ui-ux-pro-max 스킬 + 웹 리서치로 수집.

## 저장한 레퍼런스 5개

| # | 레퍼런스 | 링크 | 왜 관련 있나 |
|---|---|---|---|
| 1 | **GitHub Primer — PageHeader** | https://primer.style/product/components/page-header/ | Title Area + **Description(메타 행)** + Trailing Actions 해부가 이 케이스의 원형. PR 상세 헤더가 정확히 "제목 + 상태 + 요청자/시각 메타 + 액션" 구성 |
| 2 | **HashiCorp Helios — Page Header** | https://helios.hashicorp.design/components/page-header | 인프라 어드민 콘솔 DNA(같은 도메인). **정량 규칙 명시**: metadata kv ≤4, badge ≤3, "자주 안 바뀌는 정보는 subtitle/metadata로" |
| 3 | **Atlassian Design System — Page header** | https://atlassian.design/components/page-header | breadcrumbs + title + actions 결합 규칙. 페이지 전체에 작용하는 액션만 헤더에 |
| 4 | **Shopify Polaris — Page** | https://polaris.shopify.com/components/layout-and-structure/page | title metadata(뱃지·부가정보) + primary/secondary action 문법. primary CTA는 1개 |
| 5 | **Ant Design v4 — PageHeader** | https://4x.ant.design/components/page-header/ | kv(Descriptions)를 헤더 안에 흡수한 고전 사례 — "요청 정보 kv 카드"를 헤더로 옮긴 형태 그 자체 |

## 선택: Primer(구조) + Helios(제약) 조합

**왜 이 조합인가**

1. **문제 진단**: 기존 요청 정보 카드의 kv 4개 중 `요청 상태`는 헤더 head-sub의 상태 pill과 **중복**,
   나머지 3개(요청자·요청 시각·리소스 선택)는 페이지가 살아있는 동안 변하지 않는 **정적 메타데이터**.
   Helios 기준으로 이건 카드(콘텐츠)가 아니라 헤더 소속이다. 카드 하나가 섹션 타이틀(20px)까지
   동반하면서 본론(리소스 표)을 한 화면 아래로 밀어내는 비용 > 정보 가치.
2. **Primer Description row**: 타이틀 아래 muted 메타 행(작성자·시각·카운트)이 PR 헤더에서 검증된
   문법 — 우리 헤더에 그대로 이식 가능 (h1 → head-sub(신원) → head-meta(요청 맥락)).
3. **Helios 정량 제약 준수**: kv 3개(≤4), 배지 1개(상태 pill, ≤3) — 헤더 과적재 방지 규칙 내.
4. 나머지 후보를 안 쓴 이유: Atlassian/Polaris는 구조 일반론(이미 충족), Ant PageHeader는 kv를
   테이블형으로 넣어 **헤더가 다시 카드처럼 무거워지는** 안티패턴 위험이 있어 형태만 참고.

**결과 형태** (admin-taskqueue.html `renderDetail`):
```
breadcrumb
h1 서비스명 #id                    [반려] [승인]
● AWS  PAY  [승인 대기 pill]          ← head-sub: 신원+상태 (배지 1)
요청자 김결제 · 요청 시각 07-19 14:02 · 리소스 선택 3 / 4   ← head-meta (kv 3, 14px)
─────────────────────────────
(요청 정보 섹션·카드 삭제 — 본론인 리소스 표가 첫 섹션으로 승격)
```
