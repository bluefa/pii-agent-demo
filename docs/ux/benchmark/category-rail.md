# Category 레일 — 전체보기 마스터-디테일

- **날짜**: 2026-08-13
- **대상**: `/pass/notices?type=NOTICE|FAQ` 의 Category 레일 (`NoticeBoardView` · `postStyles.catNav`)
- **아티팩트**: <https://claude.ai/code/artifact/43a69d24-969b-478d-8171-4a65603a8e2e>
- **사본**: `design/notice-faq/category-rail-benchmark.html`
- **선행**: `docs/ux/benchmark/board-density.md` (같은 화면의 2카드 뷰)

## 1. 왜 했나

"왼쪽 패널 디자인이 형편없다. **패널이 아니라 카드 같다.** 스크롤이 가능해야 하고,
개수에 상관없이 아래까지 뻗어야 한다."

## 2. 진단 (실측 · 뷰포트 1710×947)

| # | 문제 | 측정값 | 등급 |
|---|---|---|---|
| 1 | 레일이 카드로 읽힘 | 회색 면이 254px 에서 끝남 — 카드 바닥까지 안 감 | UX 원칙 |
| 2 | 스크롤 없음 | `overflow-y: visible` | 구조 결함 |
| 3 | 화면을 안 씀 | 마스터-디테일 256px = 뷰포트의 27%, 아래 508px 죽은 캔버스 | UX 원칙 |
| 4 | 항목 높이 그리드 밖 | `py-[9px]` → 39px | 수치 위반 |
| 5 | 폭이 좁음 | 224px (벤치마크 최저 239) | 제안 |
| 6 | 레일에 머리 없음 | "Category" 가 `aria-label` 안에만 존재 | UX 원칙 |
| 7 | 건수와 이름이 같은 색 | 둘 다 `#4E5968` | 제안 |

## 3. 실제로 쓴 레퍼런스

| # | 레퍼런스 | URL | 가져온 것 | 확인 |
|---|---|---|---|---|
| 01 | Cloudscape Side navigation | <https://cloudscape.design/components/side-navigation/> | **실측 280w · h 882 = 뷰포트 잔여 전부 · `overflow-y:auto`** | 실측 |
| 02 | GitHub Issues 앱 사이드바 | <https://github.com/vercel/next.js/issues> | **실측 256w · sticky · 스크롤은 안쪽 body(666) · 항목 32/r6/p6·8** | 실측 |
| 03 | GitHub Issues 필터 목록 | 〃 | **실측 239w · 배경 완전 투명 · 내용 높이** (대조군) | 실측 |
| 04 | shadcn/ui Sidebar | <https://ui.shadcn.com/docs/components/sidebar> | 16rem=256 · Header/Content/Footer · Content 만 스크롤 | 문서 |
| 05 | shadcn sidebar.tsx | <https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/sidebar.tsx> | variant `sidebar`/`floating`/`inset` — 떠 보이는 건 별도 변형 | 문서 |
| 06 | Primer NavList | <https://primer.style/components/nav-list> | 건수 = `TrailingVisual` · 선택 = `aria-current` | 문서 |
| 07 | Cloudscape styles.scss | <https://github.com/cloudscape-design/components/blob/main/src/side-navigation/styles.scss> | 배경은 **항목에만**, 구역은 선으로 | 문서 |
| 08 | NN/g Vertical Navigation | <https://www.nngroup.com/articles/vertical-nav/> | 배경+테두리로 구분 · 스크롤 허용 · 중요한 것 위로 | 문서 |
| 09 | Elastic EUI Collapsible nav | <https://eui.elastic.co/docs/components/navigation/collapsible-nav/> | 320 기본 · dock 하면 본문을 밀어냄 | 문서 |
| 10 | GitLab Pajamas | <https://design.gitlab.com/patterns/navigation-sidebar/> | 2단계 상한 · ≥1200px 상시 | 문서 |
| 11 | Carbon UI Shell SideNav | <https://github.com/carbon-design-system/carbon/blob/main/packages/react/src/components/UIShell/SideNav.tsx> | expanded/collapsed/rail/hidden 4상태 | 문서 |
| 12 | Baymard Filter UI | <https://baymard.com/learn/ecommerce-filter-ui> | 건수 = 클릭 전 결과 예고 | 문서 |
| 13 | Atlassian Side navigation | <https://atlassian.design/components/side-navigation/examples> | 폐기 → 내비게이션 시스템으로. 높이는 바깥이 준다 | 문서 |

**13곳을 관통하는 규칙**: 면을 칠할 거면 바닥까지 칠하고, 바닥까지 못 갈 거면 칠하지 마라.
둘을 섞은 곳은 한 군데도 없었다 — 우리 화면만 그랬다.

## 4. 채택안

**시안 A — 뷰포트 고정 높이 + 양쪽 독립 스크롤** (레퍼런스 01·04·13).

비교표에서 A 가 사용자가 말한 셋(진단 1·2·3)을 **계약 변경 없이, 기존 합의를 하나도
건드리지 않고** 덮는 유일한 안이었다. B(sticky)는 `rounded-xl overflow-hidden` 이
안쪽 `sticky` 를 무력화해서 **"레일과 목록을 테두리 하나로 묶어라"는 오너 지시를 풀어야**
하고, C(셸 승격)는 `/pass/services` 의 296px 사이드바와 같은 자리를 다른 뜻으로 쓰게 된다.

구현:

- `postStyles.pageFill` 신설 — `h-[calc(100vh-64px)] overflow-hidden`
- `postStyles.grouped` — `flex-1` 추가, 폭 `224` → `240`
- `postStyles.catNav` — `overflow-y-auto`
- `postStyles.listPane` 신설 — `overflow-y-auto`
- `catNavItem` — `py-[9px]` → `py-1.5 leading-5` (39 → 32px, 레퍼런스 02 실측)
- `aria-current` (레퍼런스 06)

미채택:

- **시안 E 의 발(Footer)** — 놓을 액션이 "선택 해제" 뿐인데 레일 첫 항목 "전체" 가 이미 한다.
- **시안 E 의 머리** — 사용자가 A 를 골랐다. **진단 6 은 미해결로 남는다.**
- **시안 D(면 제거)** — "아래까지 뻗어야 한다"를 거부하는 안. 다만 A 를 넣고도 회색이
  무거우면 면만 바꾸면 되는 **독립 손잡이**로 남긴다.
- **진단 7(건수 색)** — 회색 면 위에서 한 칸 낮추면 `#6B7280` 이 되는데 4.39:1 로 AA 미달이다.
  대비를 깨느니 그대로 둔다.

## 5. 주석에 적었다가 측정으로 철회한 것

처음에 `min-h-0` 이 스크롤의 핵심이라고 주석에 적었다(shadcn `SidebarContent` 근거).
**클래스를 실제로 떼어 보니 거짓이었다.**

| 클래스 | 떼었을 때 | 판정 |
|---|---|---|
| `h-[calc(100vh-64px)]` | 751 → **256** | 필수 |
| `flex-1` (grouped) | 751 → **256** | 필수 |
| `overflow-y-auto` ×2 | 스크롤 사라짐 | 필수 |
| `min-h-0` ×3 | 변화 없음 | **제거함** |
| `flex-none` (항목) | 변화 없음 | **제거함** |

이유: grid 자식의 자동 최소 크기는 보통 `auto` 지만 **스크롤 컨테이너면 0** 이라,
`overflow-y-auto` 자신이 `min-h-0` 의 일을 이미 한다. shadcn 이 `min-h-0` 을 함께 쓰는 건
스크롤이 없는 경우까지 감당하는 컴포넌트라서다.

첫 측정에서 `flex-1` 도 무의미해 보였는데, **항목 33개를 주입한 뒤에 뗐기 때문**이었다 —
그 상태에선 `flex-shrink: 1` 이 대신 일해서 가려졌다. 빈 상태로 다시 재서 확인했다.

## 6. 검증

Category 33개 · 게시글 41행을 주입해서 확인:
레일 바닥 933 고정, 그리드 높이 751 유지, 양쪽 끝까지 스크롤, 마지막 행 도달,
페이지 자체는 스크롤 없음.

## 7. 답하지 않은 것

- **고정 높이 ↔ `board-density.md` 의 결정.** 2카드 뷰는 대시보드라 높이를 내용이 정하고,
  전체보기는 목록 브라우저라 화면이 정한다. 같은 파일에 반대로 보이는 주석 두 개가 남아
  각각 왜 그런지 적어 두었다.
- **빈 Category 노출** — 지금은 받아 온 목록에서 세므로 0건 Category 는 나타나지 않는다.
  Admin 이 만든 빈 Category 를 보여줄지는 `PostCategory` 계약을 봐야 한다.
- **Material 3 · Fluent** — 문서 본문이 JS 로 그려져 수치를 못 읽었고 기억으로 채우지 않았다.
