# 스텝 카드 표면 위계 — 링과 이음매

- **일자**: 2026-08-24
- **대상**: `/pass/target-sources/{id}` 설치 화면의 스텝 카드 (`cardStyles.base` / `cardStyles.header` 를 쓰는 18개 카드 전부)
- **구현 PR**: #774
- **아티팩트**: https://claude.ai/code/artifact/533ddc5d-2fe8-4a48-9395-ec26929f5b97
- **1차 라운드(정렬)**: https://claude.ai/code/artifact/77981f01-5864-4423-b725-49ebcad5d08b

## 문제

오너 지적: *"카드는 필수적인건가? 지금은 카드가 본문 역할을 하고 있는데 조금 더 힘이 있었으면 좋겠다.
카드디자인이어서 응집력은 좋은데 완성이 덜 된 느낌도 듭니다."*

`origin/main @ 424806d4`, 뷰포트 1920×958, `getBoundingClientRect()` 실측.

| # | 문제 | 근거 등급 | 실측 |
|---|---|---|---|
| P1 | 카드가 카드가 아니라 페이지 본문 전체 | 수치 | 본문 래퍼의 실질 자식 1개, 카드 1256×1311 (뷰포트의 1.4배) |
| P2 | 본문 표면이 크롬보다 약함 | 수치 | 흰 카드:캔버스 **1.095:1**, 좌측 서비스 레일:캔버스 **1.138:1** |
| P3 | 카드가 자기 상자를 그리지 않음 | 수치 | 콘텐츠 열 가로선 19개 중 카드 상자(316…1572)에 놓인 것 **1개** (sticky footer) |
| P4 | 헤어라인 5색, 포함 관계와 굵기가 역전 | 수치 | 표 `<thead>` #D1D5DB(1.474) 가 가장 굵고, 카드 프레임이 가장 옅음 |
| P5 | 머리와 몸 사이 50px 에 아무 관계 없음 | UX 원칙 | 헤더 마지막 규칙선 y272 → 카드 윗변 y322 |
| P6 | 1311px 면에 radius 20 | UX 원칙 | 위·아래 모서리가 같은 화면에 동시에 안 들어옴 |
| P7 | 발에는 이음매, 머리에는 없음 | 제안 | `CardActionBar` 는 `border-t`, `cardStyles.header` 는 border 없음 |

P2 가 「힘이 없다」, P3·P4·P7 이 「완성이 덜 됐다」의 실체다.

## 채택한 안 — A′ + E′

레퍼런스 13개를 놓고 5개 안(A′ 링 / B 바닥 침강 / C 카드 해체 / D 한 몸 / E′ 골격 완성)을
비교했다. 4개는 실제 페이지에 CSS 를 주입해 재측정했다. 비교표의 결론:

- **A′+E′** — 토큰 2줄, 세로 +5px, 가로 이동 0, 기각 판례 충돌 없음, 오너가 좋다고 한 응집력을 **강화**
- D(한 몸) — P1·P5 까지 풀지만 1차 라운드 시안 A 선행 필요 + 기각 판례 1번(개선안 ㄷ) 전제 소멸을 오너가 인정해야 함 → 후속
- C(카드 해체) — 「카드는 필수인가」의 문자 그대로의 답이지만, 주입해 보니 오너가 좋다고 한 응집력이 정확히 그만큼 사라짐 → 기각
- B(바닥 침강) — 가장 근본적이나 `--pl-bg-canvas` 가 전역이고 기각 판례 2번(제3의 배경 = 대비 짝 168개 재개봉)에 충돌 → 기록만

## 아티팩트와 달라진 점

아티팩트는 링과 이음매 둘 다 `#E1E4EB`(헤더 헤어라인)를 제안했다. 구현 중
**`borderColors.card` (`#D6DBE6`) 가 "틴트 캔버스 위 카드 윤곽선" 용도로 이미 존재**하는 것을
발견해서 링을 그쪽으로 바꿨다. 근거는 실측이다 — 캔버스 대비 `#E1E4EB` 1.163 vs `#D6DBE6` 1.267,
그리고 좌측 레일이 1.138 이므로 **`#E1E4EB` 로는 본문이 여전히 크롬을 못 넘는다.**
`design-guard.test.ts` 의 새 하한선(1.2)에 `#E1E4EB` 는 실제로 걸린다(뮤테이션 M3 으로 확인).
새 hex 를 도입하지 않은 것도 이점.

이음매는 `borderColors.default`(`#E5E7EB`, 흰 면 1.238)로 통일했다. `light`(`#F3F4F6`, 1.101)는
카드 안의 어떤 선보다도 옅어서 이음매 구실을 못 했다.

## 실제로 쓴 레퍼런스

| 출처 | URL | 가져온 것 |
|---|---|---|
| Vercel — Web Interface Guidelines | https://vercel.com/design/guidelines | *"Crisp borders. Combine borders & shadows"* — 그림자를 두고 테두리를 더한다 |
| AWS Cloudscape — Visual style | https://cloudscape.design/foundation/visual-foundation/visual-style/ | 그림자는 겹치는 요소 전용, 겹치지 않는 면은 1px 선 |
| Atlassian — Elevation | https://atlassian.design/foundations/elevation | `raised` 는 "움직일 수 있는 카드" 전용 — 스텝 카드는 안 움직인다 |
| Microsoft Fluent 2 — Elevation | https://fluent2.microsoft.design/elevation | 붙어 있는 면일수록 날카로운 가장자리 (그 극단이 1px 링) |
| Microsoft Fluent 2 — Card | https://fluent2.microsoft.design/components/web/react/core/card/usage | header/body/footer 3부 슬롯 — 이음매는 양쪽에 |
| IBM Carbon — Color usage | https://carbondesignsystem.com/elements/color/usage/ | 테두리 토큰은 자기 층 번호와 짝 → 헤어라인 개수는 층 개수를 넘을 수 없다 |
| Linear — 디자인 리프레시 | https://linear.app/now/behind-the-latest-design-refresh | 구분선이 "이유 없이 번식"한 것을 지우지 말고 합쳐서 줄인다 |
| NN/g — Cards | https://www.nngroup.com/articles/cards-component/ | 응집력은 테두리·면이 만든다. 드롭섀도는 클릭 가능함의 신호다 |
| USWDS — Card | https://designsystem.digital.gov/components/card/ | 테두리가 필요하다는 이유만으로 카드를 쓰지 않는다 (C 안 근거) |
| Material 3 | https://developer.android.com/develop/ui/compose/designsystems/material3 | 존재감은 그림자가 아니라 톤 차이 (B 안 근거) |
| GitHub Primer — PageLayout | https://primer.style/product/components/page-layout/ | 영역 사이에는 divider — 선이든 면이든 무언가 (D 안 근거) |
| AWS Cloudscape — Container | https://cloudscape.design/components/container/ | 컨테이너는 "관련 있음"을 말하는 것 — 하나뿐이면 할 말이 없다 |
| ui-ux-pro-max (로컬 스킬) | `.claude/skills/ui-ux-pro-max` | `elevation-consistent` — 척도를 정하고 그 안에서만 쓴다 |

## 남은 것

- **D(한 몸)** — 오너 확인 대기. 1차 라운드 시안 A(`blockHead` 에 `-mx-[28px] px-[28px]`) 선행 필요.
- **1차 라운드 시안 A** — 헤더 규칙선 2개가 아직 344…1544 로 카드 상자보다 28px 안쪽. 미착수.
- **P6 (radius/높이)** — 이번 범위 밖. 카드가 뷰포트보다 크다는 문제는 표면이 아니라 분량 문제다.
- **표 내부 회색** (`#EBEEF2` 행, `#D1D5DB` thead) — 카드 프레임이 아니라 표의 문제. 별건.
