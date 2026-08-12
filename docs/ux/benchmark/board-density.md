# 빈 카드 — 공지사항·FAQ 밀도 벤치마크

- **날짜**: 2026-08-13
- **대상**: `/pass/notices` (Pass 배너 + 공지·FAQ 2카드)
- **아티팩트**: <https://claude.ai/code/artifact/799c36da-5d0b-4043-ba35-59a16119c952>
- **사본**: `design/notice-faq/board-density-benchmark.html`
- **선행 벤치마크**: `docs/ux/benchmark/notice-faq.md`

## 1. 왜 했나

"공지사항이 너무 빈약해 보인다. 아래 끝까지 이어지게 해볼까?" 라는 요청으로
카드를 뷰포트 끝까지 늘려 봤더니 **더 비어 보였다**. 면적은 늘리기 전이나 후나
345px 로 같은데, 그 여백이 캔버스에서 테두리 안쪽으로 옮겨 온 것뿐이었다.

좌우 마진도 32 → 40 → 70 으로 옮겨 다녔는데, 마진은 애초에 이 문제의 레버가
아니었다.

## 2. 진단

| # | 문제 | 등급 |
|---|---|---|
| 1 | 카드 안 하단 345px 공백 — 테두리가 빈 곳을 강조한다 | UX 원칙 |
| 2 | 좌우 마진을 화면 폭에 따라 키우면 글 길이가 화면마다 달라진다 | UX 원칙 |
| 3 | `min-h` + `flex-1` 이 내용과 무관하게 높이를 정한다 | 구조 결함 |
| 4 | 전체보기가 카드 헤더에만 있다 — 목록이 끊긴 자리에는 없다 | UX 원칙 |
| 5 | 글이 5건뿐 — 근본 원인은 레이아웃이 아니라 콘텐츠 양이다 | 사실 |
| 6 | `CARD_ROWS=5` 라 글이 쌓여도 카드는 안 찬다 | 제안 |

## 3. 실제로 쓴 레퍼런스

| # | 레퍼런스 | URL | 가져온 것 | 확인 |
|---|---|---|---|---|
| 01 | Cloudscape — Dashboard items | <https://cloudscape.design/patterns/general/service-dashboard/dashboard-items/> | **"the height of dashboard items are defined by its content"** · 목록 끝의 "View all" | 확인함 |
| 02 | Cloudscape — Empty states | <https://cloudscape.design/patterns/general/empty-states/> | 빈 상태는 상태 알림 + 다음 할 일을 함께 | 확인함 |
| 03 | AWS Console Home — 위젯 | <https://docs.aws.amazon.com/awsconsolehelpdocs/latest/gsg/work-with-widgets.html> | 남는 자리는 **위젯을 더 놓아** 채운다. 크기 조절은 사용자 몫 | 확인함 |
| 04 | Carbon — 2x Grid | <https://v10.carbondesignsystem.com/guidelines/2x-grid/implementation/> | 거터 32 고정 · **1584px 상한**. 마진이 아니라 폭 상한 | 확인함 |
| 05 | Primer — Blankslate | <https://primer.style/product/components/blankslate/> | Visual·Heading·Description·Action 4부 구조, `bordered` 변형 | 확인함 |
| 06 | GitHub Changelog | <https://github.blog/changelog/> | 카드 없이 구분선 + 날짜 헤더 — 테두리가 없으면 빌 카드도 없다 | 확인함 |
| 07 | Vercel Changelog | <https://vercel.com/changelog> | 섹션 높이를 내용에 맡긴다 | 확인함 |
| 08 | Linear Changelog | <https://linear.app/changelog> | 항목 사이 공백만으로 계층 | 확인함 |
| 09 | Baymard — Cards & dashboard layout | <https://baymard.com/blog/cards-dashboard-layout> | 장식 그래픽이 사용자 시선을 목표에서 뺏는다 | 확인함 |
| 10 | NN/g — Empty state design | <https://www.nngroup.com/articles/empty-state-interface-design/> | 빈 영역도 말을 해야 한다 — 빠져나갈 길 없으면 혼란 | 확인함 |
| 11 | Polaris — Empty state | <https://polaris-react.shopify.com/patterns/empty-states> | 빈 상태에도 액션 하나 | 확인함 |
| 12 | Material 3 — Applying layout | <https://m3.material.io/foundations/layout/applying-layout/large-extra-large> | 넓어지면 여백이 아니라 pane 이 늘어난다 | 확인함 |
| 13 | Atlassian — Empty state | <https://atlassian.design/components/empty-state/examples> | 이미지 없는 변형이 기본 | 기억 기반 |

## 4. 채택안과 근거

**시안 A — 카드 높이는 내용이 정하고, 페이지는 폭으로 잡는다.**

비교표에서 A 가 진단 1·2·3 을 **CSS 2줄**로 덮었고 계약 변경도, 합의된
"공지·FAQ 를 각 카드로 양옆" 설계와의 충돌도 없었다. 레퍼런스 지지도 5/13 로
가장 넓었다.

레퍼런스 01 의 **목록 끝 전체보기**를 함께 가져왔다(진단 4). 링크를 헤더에서
목록 끝으로 옮기는 일이라 비용이 없고, 더 보고 싶어지는 시점이 목록이 끊긴
자리라는 근거가 명확했다. 건수 필은 헤더에 남긴다 — 누를 이유를 주는 값이다.

구현:

- `postStyles.page` — `min-h-[calc(100vh-64px)]` 제거, `max-w-[1664px] mx-auto px-10` 유지
- `postStyles.dual` — `items-stretch flex-1` → `items-start`
- `postStyles.cardMore` — 헤더의 `ml-auto` 링크에서 카드 바닥 행으로
- `PostBoardCard` — 링크를 `<header>` 밖 목록 뒤로

미채택:

- **시안 B(위젯 추가)** — 「내 연동 요청 현황」 계약이 필요하고, 이 화면을
  게시판에서 홈 대시보드로 바꾸는 별도 결정이다. **버리지 않고 남긴다** —
  화면 아래 빈 캔버스의 정답은 계약이 생기면 B다.
- **시안 C(카드 제거)** — 진단을 한 건 더 덮지만 "각 카드로 양옆" 확정 요구와 충돌.
- **시안 D(Blankslate)** — 2건이 있는데 "없다"고 말해야 한다. 증상만 덮는다.
- **시안 E(`CARD_ROWS` 상향)** — 글이 5건인 오늘은 한 픽셀도 안 바뀐다.

## 5. 답하지 않은 것

**진단 5(콘텐츠 양)는 레이아웃으로 못 푼다.** 글이 5건이라 비어 보이는 것이고,
쌓이면 저절로 해소된다. 시안 E 를 그때 다시 본다.

배너 강화(그림자·안쪽 실선·점 격자)는 이 벤치마크가 아니라 사용자 요청으로
같은 PR 에 들어갔다 — 레퍼런스 09 를 근거로 일러스트는 넣지 않았다.
