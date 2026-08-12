# 공지사항 · FAQ 화면 벤치마크

- **날짜**: 2026-08-12
- **대상**: `/pass/notices` (2카드 + 전체보기) · `/pass/admin/posts` (관리 · 등록/수정)
- **아티팩트**: 벤치마크 <https://claude.ai/code/artifact/e956b625-e9a3-45d9-ad2f-70bb6c4e12eb>
- **원본 설계**: `design/notice-faq/notice-faq-screens.html` (사본 보관)
- **벤치마크 사본**: `design/notice-faq/notice-faq-benchmark.html`

## 1. 왜 다시 했나

1차 구현이 Tag 가이드(스펙 문서)만 보고 진행되어, 합의된 화면 설계
(`notice-faq-screens.html`)에서 **9개 항목이 빠졌다**. 캐럿, 2줄 행, 건수 필,
Pass 배너, 필터, 숨김 스트라이프, Category 레일, 에디터 라벨 열, `yy-mm-dd` 표기.

## 2. 진단 (근거 등급)

| # | 문제 | 등급 |
|---|---|---|
| 1 | 한 줄에 역할 5개, 크기 2종·무게 1종 — 인접 계층 레버 1개 차 | UX 원칙 |
| 2 | 펼침 어포던스(캐럿) 없음 | UX 원칙 · 요청 이탈 |
| 3 | 펼친 뒤에만 "접기"가 생겨 토글이 비대칭 | UX 원칙 |
| 4 | 카드 좌우 패딩 20px (세트는 좌우 24) | **수치 위반** |
| 5 | 아코디언 하단 26px (4/8 배수 밖) | **수치 위반** |
| 6 | 카드 간 24 vs 행 내부 16 = 1.5배 (2배 이상 요구) | **수치 위반** |
| 7 | 펼친 본문에 면 구분 없음 | 제안 · 요청 이탈 |
| 8 | 카드 헤더에 건수 없음 | 요청 이탈 |
| 9 | Pass 배너 미구현 | 요청 이탈 |
| 10 | 전체보기가 상한 없는 평평한 목록 | UX 원칙 · 구조 결함 |
| 11 | Admin 숨김 표시가 배지 하나 | 제안 · 요청 이탈 |
| 12 | Admin 필터 없음 | 요청 이탈 |
| 13 | 에디터가 placeholder만, 라벨 없음 | UX 원칙 |

## 3. 실제로 쓴 레퍼런스

| 레퍼런스 | URL | 가져온 것 |
|---|---|---|
| Carbon — Accordion | <https://carbondesignsystem.com/components/accordion/usage/> | 캐럿을 헤더 **끝쪽**에, 헤더 전체가 클릭 영역 |
| W3C ARIA APG — Accordion | <https://www.w3.org/WAI/ARIA/apg/patterns/accordion/> | `aria-controls` + 패널 `id` (구현에 없던 것) |
| NN/g — Accordions | <https://www.nngroup.com/articles/accordions-complex-content/> | 접힌 헤더가 펼칠 값어치를 스스로 말해야 한다 |
| GitHub Primer — ActionList | <https://primer.style/product/components/action-list/> | 설명을 inline이 아니라 **block**으로 → 2줄 행 |
| WordPress — Posts Screen | <https://wordpress.org/documentation/article/posts-screen/> | 상태를 제목 옆에, 상태별 건수를 목록 위에 |
| GitHub Changelog | <https://github.blog/changelog/> | 필터의 **활성 개수**를 노출 |
| Google Cloud — Release notes | <https://docs.cloud.google.com/release-notes> | 그룹 헤더 + 구조 반복으로 스캔 |
| Notion — Help Center | <https://www.notion.com/help> | Category 레일. 반례로 "긴 글엔 아코디언 대신 링크" |
| Strapi — Content Manager | <https://docs.strapi.io/cms/features/content-manager> | 상태 필터를 누적 조건으로 |
| Linear — Changelog | <https://linear.app/changelog> | 항목 사이 공백이 계층을 만든다 |
| Vercel — Changelog | <https://vercel.com/changelog> | 날짜를 그룹 헤더로 올려 행을 가볍게 |
| shadcn/ui — Accordion | <https://ui.shadcn.com/docs/components/accordion> | `border-b last:border-b-0` (이미 맞게 하던 것) |
| Tiptap — Simple Editor | <https://tiptap.dev/docs/ui-components/templates/simple-editor> | 툴바 구역 구분자, 이미지 버튼 분리 |

## 4. 채택안과 근거

**시안 A(아티팩트 복원) + 시안 D(Admin 상태 우선)**를 함께 구현했다.

비교표에서 A가 **진단 13건 중 9건을 계약 변경 없이** 덮었고, 새로 디자인하는 안이
아니라 이미 합의한 설계를 실행하는 것이라 일관성 축에서 다툴 여지가 없었다.
D는 대상이 Admin으로 겹치지 않고 건수를 클라이언트에서 셀 수 있어 비용이 낮았다.

전체보기의 Category 레일(시안 C의 일부)도 함께 넣었다 — 진단 10번이 취향이 아니라
구조 결함이고, 레일은 받아 온 목록에서 직접 세면 계약 추가 없이 그릴 수 있었기 때문이다.
**기간 컷(`?since=`)은 계약 추가가 필요해 넣지 않았다.**

미채택:

- **시안 B(본문 발췌 한 줄)** — `PostSummary.excerpt` 필드가 필요하다. 효과는 크지만
  글이 쌓인 뒤 판단하는 편이 안전하다고 봤다.
- **시안 E(단일 타임라인)** — "FAQ와 공지를 각 카드로 양옆 배치"라는 확정 요구와 충돌.

## 5. 구현하면서 목업에서 벗어난 곳

목업을 그대로 옮기지 않은 지점이 하나 있고, 이유는 접근성이다.

- 목업의 `#8B95A1`(날짜 · 건수 · 레일 카운트)은 흰 바탕에서 **3.04:1** 로
  가이드의 텍스트 4.5:1 을 만족하지 못한다. `#6B7280`(4.83:1)로 내렸다.
- 같은 이유로 캐럿 선도 `#6B7280`. 비텍스트 최소선 3:1 에 겨우 걸치던 값인데,
  "펼칠 수 있다"를 혼자 말하는 유일한 표시라 여유를 뒀다.
- 목업의 카드 간 여백 24px 은 행 내부 16px 의 1.5배로 가이드의 "2배 이상"에
  미달한다. 목업을 따랐다 — 두 카드는 형제 배치라 섹션 경계로 보기 어렵고,
  값을 바꾸면 4개 화면의 리듬이 함께 흔들린다. **미해결로 남긴다.**

## 6. 답하지 않은 것

본문이 길고 이미지가 여러 장인 글도 아코디언이 맞는지(레퍼런스 08의 반례).
게시글당 이미지 10개 · 10MB를 허용했으므로 그런 글은 펼치면 목록을 화면 밖으로 민다.
별도 상세 페이지로 보낼 임계값은 실제 콘텐츠를 보고 정해야 한다.
