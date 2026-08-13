# 공지사항·FAQ 목록 — 게시판을 벗어나기

- **날짜**: 2026-08-13
- **대상**: `/pass/notices` · `/pass/notices?type=` 의 게시글 행 (`PostAccordionRow`)
- **아티팩트**: <https://claude.ai/code/artifact/24187d60-eb6e-4242-98cc-d338322a0afa>
- **사본**: `design/notice-faq/post-list-benchmark.html`
- **선행**: `board-density.md`(2카드 밀도) · `category-rail.md`(레일)

## 1. 왜 했나

"공지사항 게시판 자체 디자인이 별로다. 세련된 느낌을 주는 게 없다.
효과가 전혀 없어서 그런 것 같다."

## 2. 진단 (실측)

| # | 문제 | 측정값 · 대조 | 등급 |
|---|---|---|---|
| 1 | 제목이 본문 크기 | 제목 `14px`. Linear 실측 항목 제목 `24~32px`. **12곳 중 14px 인 곳 없음** | UX 원칙 |
| 2 | 읽기 폭이 없음 | 행 폭 `1630px`, 제목 좌단 · 날짜 `1400px` 건너편. Linear 본문 컬럼 실측 `624px` | UX 원칙 |
| 3 | 배지가 그룹을 반복 | "서비스 점검" 그룹 안 모든 행에 "서비스 점검" 배지 | 중복 |
| 4 | 읽을 것이 없음 | 제목뿐. **12곳 중 9곳이 한 줄 요약** 제공 | UX 원칙 |
| 5 | 날짜가 기계 포맷 | `26-08-10`. 12곳 전부 사람 포맷 | 제안 |
| 6 | 변화의 종류 축 없음 | Shopify 5종 · GitHub 3종 배지. 우리는 Category 하나 | 제안 |
| 7 | 시간축 없음 | Category 로만 그룹. **12곳 중 6곳이 월·날짜 그룹** | UX 원칙 |
| 8 | FAQ와 공지가 같은 행 | 질문과 발표는 다른 물건 | UX 원칙 |
| 9 | 고정과 분류가 같은 무게 | 둘 다 `12px` 알약 | 제안 |
| 10 | 긴 글도 아코디언 | 이미지 10장·10MB 허용. Figma 는 페이지로 보냄 | UX 원칙 |

## 3. 레퍼런스 12

| # | 레퍼런스 | URL | 가져온 것 | 확인 |
|---|---|---|---|---|
| 01 | Linear Changelog | <https://linear.app/changelog> | **실측 48/32/24 · 본문 17px/27.2 · 컬럼 624** · 배지 없이 타이포로만 위계 | 실측 |
| 02 | GitHub Changelog | <https://github.blog/changelog/> | 월(그룹)·종류(Release/Improvement/Retired)·주제(태그) **세 축 분리**, 태그 `…+n` | 문서 |
| 03 | Vercel Changelog | <https://vercel.com/changelog> | **날짜를 왼쪽 단으로**, 아바타 32px, 썸네일 없음 | 문서 |
| 04 | Stripe Changelog | <https://docs.stripe.com/changelog> | Breaking / Non-breaking 고정 열 — "나에게 영향이 있나" | 문서 |
| 05 | Sentry Changelog | <https://sentry.io/changelog/> | 목록엔 한 문장 + "Read On →", 인라인 확장 없음, 월 점프 | 문서 |
| 06 | Shopify Changelog | <https://changelog.shopify.com/> | 상태 5종 + 영역 배지, 40+ 다중선택 필터 | 문서 |
| 07 | Raycast Changelog | <https://www.raycast.com/changelog> | 큰 기능만 히어로 이미지 — **항목마다 대접을 달리함** | 문서 |
| 08 | Notion Releases | <https://www.notion.com/releases> | 이미지/영상 인라인 → 페이지네이션 필수 | 문서 |
| 09 | Slack Release Notes | <https://slack.com/release-notes> | 고정 섹션 이름 반복(What's New/Bug Fixes) | 문서 |
| 10 | Intercom Help Center | <https://www.intercom.com/help> | 주제 카드 + 글 수. FAQ 가 커지면 목록이 아니라 지도 | 문서 |
| 11 | Figma Help Center | <https://help.figma.com/hc/en-us/articles/360039825114-Figma-release-notes> | 인라인 확장 없음, 머리에 "적용 대상" 메타 | 문서 |
| 12 | NN/g FAQ 설계 | <https://www.nngroup.com/articles/faqs-deliver-value/> | 독자 어휘로 질문, 10개 미만이면 현 구조가 최선 | 문서 |

**관통하는 규칙**: 축을 나눈다. 시간·종류·주제가 각각 다른 자리를 쓴다.
우리는 셋을 `categoryName` 하나로 눌러 놓고 그것을 그룹 머리와 행 배지에 두 번 그렸다.

## 4. 채택안 — 시안 A + 이펙트 층

A 가 "게시판 같다"를 직접 만드는 네 가지(진단 1·2·3·9)를 **계약도 합의도 안 건드리고** 덮는다.

**구조**

- 날짜를 오른쪽 끝 → **왼쪽 단 `76px`** (레퍼런스 03)
- 제목 `14` → **`18px`**, `max-w-[62ch]` 읽기 폭 (레퍼런스 01)
- 그룹 안에서는 Category 배지 제거 (`showCategory` prop)
- 고정 배지는 남기되 왼쪽 획으로 층을 가름

**이펙트** — 전부 `motion-reduce` 가드

| 효과 | 무엇 | 왜 |
|---|---|---|
| `entryRail` | 왼쪽 3px 획이 `scale-y 0→1`, 200ms ease-out | 틴트는 흰 바탕과 1.05:1 이라 안 보인다. 면 대신 획을 움직인다 |
| `entryRailPinned` | 고정 글은 상시 옅은 획, hover 에 진해짐 | 상태와 상호작용을 같은 자리에서 구분 |
| `entryTitle` · `entryDate` | 색이 함께 전환 | 행이 한 덩어리로 반응 |
| `entryCaretSlot` | hover 에 옅은 원판 | 누르는 곳이 커서보다 먼저 보인다 |
| `panelFade` | 열린 뒤 `90ms` 지연 후 fade + 4px 상승 | 칸과 글이 같이 늘어나면 글이 늘어나 보인다 |
| `panelEdge` | 본문 왼쪽 3px 획 | 펼친 칸이 어느 행 소속인지 잇는다 |
| `groupHead` | **sticky + 반투명 + `backdrop-blur-[6px]`** | 페이지네이션이 없어 그룹 머리는 반드시 화면 밖으로 나간다 |

**Admin 은 안 건드린다.** `row*` 토큰을 그대로 두고 읽는 쪽만 `entry*` 로 갈랐다 —
Admin 은 관리 표라 날짜가 열로 있는 게 맞다.

## 5. 채택하지 않은 것

- **시안 B(한 줄 요약)** — 진단 4 를 덮는 유일한 안이고 12곳 중 9곳이 하지만,
  `PostSummary.excerpt` 가 필요하다. **"목록 응답이 글 수 × 2개 언어로 커지는 것을 피하려
  본문을 뺐다"(tag guide §5)와 정면으로 만난다.** 120자 상한이면 협상 여지가 있으나
  **스펙 작성자와 정할 일**이라 단독 진행하지 않았다.
- **시안 C(월 그룹)** — 계약은 필요 없지만 **고정 글이 시간축을 깬다**.
  8월 5일 고정 글이 8월 그룹 맨 위인지 목록 맨 위인지 레퍼런스에 답이 없다(고정 개념이 없다).
  고정 구역을 월 그룹 위에 따로 두는 안을 제시했으나 미검증.
- **시안 D(FAQ에서 날짜 제거)** — A 다음 순서. 이번엔 안 넣었다.
- **시안 E(긴 글은 페이지로)** — 합의된 아코디언(§5)을 되돌리는 제안.
  게다가 **임계값을 목록 시점에 알 수 없다** — `PostSummary` 에 본문도 길이도 없다.
- **진단 5(날짜 포맷)** — `yy-mm-dd` 는 tag guide 의 `publishedAt` 설명이 고정한 값이다.
  디자인 결정이 아니라 스펙 결정이라 그대로 뒀다.

## 6. 계약이 막고 있는 것

| 필요한 것 | 왜 | 지금 |
|---|---|---|
| `excerpt` (ko/en) | 12곳 중 9곳이 목록에 요약을 준다 | 없음 (§5) |
| 소식 종류 | 주제와 종류는 다른 축 | `categoryName` 만 |
| 본문 규모 | 시안 E 의 임계값 판단용 | 없음 |

## 7. 답하지 않은 것

- **한국어 제품 레퍼런스가 0곳이다.** 12곳 전부 영어권. 한국어는 같은 글자 수에 더 넓은 폭을
  쓰고 조사 때문에 말줄임 위치가 달라지는데, 그 차이를 볼 레퍼런스를 못 넣었다.
- **히어로는 전체보기에 넣지 않았다.** 실측으로 마스터-디테일 `751` → `471px`,
  레일 가시 Category `20` → `12` 개. 목록 자리를 40% 내주는 거래다. 2카드 뷰에는 그대로 둔다.
- **AWS What's New** 는 목록이 JS 로 그려져 행 구조를 못 읽어 12곳에서 뺐다.
- **글이 5건인 지금은 어떤 안도 극적으로 보이지 않는다.** 밀도 문제는 콘텐츠가 쌓여야 풀린다.
