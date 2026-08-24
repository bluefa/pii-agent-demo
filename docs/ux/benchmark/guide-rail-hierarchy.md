# 가이드 레일의 색·계층·활자 — 두 개의 회색과 네 개의 활자

- **일자**: 2026-08-25
- **대상**: `/pass/target-sources/{id}` 설치 화면의 우측 가이드 패널(`GuidePanel`) — 펼친 320px 전체
- **구현 PR**: #780
- **아티팩트**: https://claude.ai/code/artifact/4a019e8d-9f76-4c3a-89d4-4db8cb00fe70
- **선행 라운드**: [레일 표면(시안 A)](guide-rail-surface.md) · [접힘 스트립](guide-rail-collapsed.md)

## 문제

오너 지적: *"색감이 그렇게 가이드라고 느껴지지 않고 좀 탁한 느낌도 들어. 정보를 전달하는 부분에서도 계층 정리가 잘 안 된 느낌이야. 픽셀은 12,14,16 이렇게 3개 계층으로 구분해줘. 행간 거리도 각 그룹마다 어떻게 보여줄지 고민해봐. 접기/펴기 버튼이 접었을때 펼쳤을때 위치가 달라. 뭔가 우측으로 접기 버튼이 협업채널의 일부처럼 보여."*

`origin/main @ 6bdef298`, 뷰포트 1710×947, `getBoundingClientRect()` · `getComputedStyle()` 실측.

| # | 문제 | 근거 등급 | 실측 |
|---|---|---|---|
| P1 | 레일의 회색이 **페이지의 중립 가족 밖**에 있다 | 수치 | 레일 `#E2E7EA` L\*91.4 / C 2.3 / **H 241°** · 캔버스 `#F4F4FB` H 290° · 브랜드 `#0050D6` H 295°. 안내박스 `#F2F4F6`는 또 H 256° — 중립이 세 가족 |
| P2 | 그 회색은 레일 면적의 **12%**만 보인다 | 수치 | 레일 264,640px² 중 카드가 233,345px². 바닥면은 사방 12px 액자 테두리로만 남음 |
| P3 | 한 카드 안에 칠 4개, 모서리 4종 | 수치 | 카드 12 · 안내박스 8(`#F2F4F6`) · 참고바 9(`#E8F1FF`) ×2 · 인라인 알약 5(`#E8F1FF`). **클릭되는 참고바와 안 되는 `<mark>` 알약이 같은 칠·같은 잉크**, 구분은 10px ▶ 하나 |
| P4 | 활자가 4단(12 · **13** · 14 · 16)이고 주력이 13 | 수치 | 가이드 본문 전체가 13px. `theme.ts` 전체 빈도는 12px 94회 · 14px 58회 · 16px 16회 · 13px 11회 |
| P5 | 본문의 `<h4>`가 **자기 섹션 제목보다 무겁다** | UX 원칙 | 존 제목 16/600/`#4E5968` 줄상자 **24.00** vs h4 14/**700**/`#111827` 줄상자 **24.08**. 크기 2px 빼고 무게·잉크·줄상자 전부 h4 승 |
| P6 | 행간이 두 개고, 둘 다 역할과 무관 | UX 원칙 | 레일 소유 텍스트 전부 1.5(12→18, 14→21, 16→24) · 가이드 본문 전부 1.72(13→22.36, 14→24.08). 비율 고정이라 **클수록 벌어진다** |
| P7 | 자간의 방향이 거꾸로 | 수치 | `body`가 −0.288px를 **절대 길이**로 상속 → 12px에서 −0.024em(최협), 14px −0.021em. 유일하게 재정의된 16px 존 라벨만 **+0.02em** |
| P8 | 접기 버튼이 두 상태에서 다른 자리, 다른 주인 | 수치 · UX 원칙 | 글리프 중심(레일 오른쪽 기준) 접힘 (28, 24) / 펼침 (32, 40) = **아래 16 · 왼쪽 4.5**. DOM 주인은 펼치면 `.rounded-xl`(협업 채널) → `.justify-between` 의 자식 |

P6의 결정적 사실: **앱이 이미 규칙을 갖고 있었다.** `theme.ts` 행간 사용 빈도는 1.2가 15회(전부 제목), 1.4가 13회(본문). 가이드 레일만 그 둘 대신 1.5와 1.72를 썼다.

P8은 착시가 아니다 — 펼친 상태의 토글은 실제로 협업 채널 카드의 자식 노드였다.

## 채택한 안 — 시안 C (A + B 포함)

레퍼런스 13개를 놓고 5개 안을 비교했다. 비교표의 결론: **C는 P2를 뺀 일곱 문제를 다 닫으면서 읽는 폭을 한 픽셀도 잃지 않고, 기존 지시와 충돌하지 않으며, 추가 비용이 `GuidePanel` 10줄이다.**

### A — 온도 정렬

| 토큰 | 전 | 후 | 근거 |
|---|---|---|---|
| `railStyles.surface` | `#E2E7EA` L\*91.4 H 241° | `#E5E5EF` L\*91.2 H 291° | 밝기 단 유지, 색상만 캔버스 가족으로 |
| `serviceSidebarStyles.surface` | 〃 | 〃 | ⛔ 두 레일은 한 면 — 같이 움직인다 |
| `guideStyles.note` | `#F2F4F6` H 256° | `#F3F3F9` H 290° | 레일의 중립을 하나로 |

**대비 비용 ≤ 0.05.** `#191F28` 13.29→13.24 · `#374151` 8.27→8.24 · `#4E5968` 5.71→5.68 · `#0050D6` 5.40→5.38. `#0064FF`(3.93)와 gray-500(3.86)은 전과 같은 이유로 여전히 사용 불가.

### B — 3단 활자, 역할이 정하는 행간

| tier | 크기 / 행간 | 자간 | 무게 · 잉크 | 앱 안의 출처 |
|---|---|---|---|---|
| **T1** 존 제목 | 16 / 20 (1.25) | −0.02em | 700 · `#333D4B` | `text-[16px] leading-[1.2]` ×3 → 19.2를 4px 그리드로 |
| **T2** 본문 | 14 / 20 (1.43) | −0.01em | 400 · `--fg-2` | `text-[14px] leading-[1.4]` ×4 → 19.6 |
| **T2b** 강조 | 14 / 20 | −0.01em | 600 · `#191F28` | 같은 tier, 무게로만 오른다 |
| **T3** 라벨·메타 | 12 / 16 (1.33) | normal | 500 | `text-[12px] leading-[1.4]` = 16.8 |

행간은 크기가 아니라 **역할**이 정한다 — 읽는 것 ~1.43, 부르는 것 1.25~1.33. Carbon·Atlassian·Material 3·Cloudscape 넷이 같은 규칙이고, Cloudscape는 같은 14px에 본문 20 / 제목 18을 준다.

자간은 tier가 직접 선언한다. `letter-spacing`은 **계산된 길이**로 상속되므로 `body`의 단일 −0.288px가 작은 글자일수록 좁게 내려왔다. 이제 T3 normal → T2 −0.01em → T1 −0.02em 로 단조 감소.

실측 결과: **본문을 13→14px로 키웠는데 4단계 프로즈 높이가 358 → 320px (−11%).** 1.72→1.43이 돌려주는 몫이 크기 증가분보다 크다.

곁들여 정리한 것:
- `<mark>` 인라인 알약이 `refBar`의 칠(`#E8F1FF` + `#0050D6`)을 벗었다 → **이 패널에서 파란 칠은 "갈 곳이 있다"는 뜻**이 됐다. `bg-transparent`는 필수 — `<mark>`의 UA 노란 배경을 Preflight가 안 지운다.
- `break-keep` — 자간을 푸니 문장이 296px를 넘겨 「요.」가 혼자 다음 줄로 떨어졌다. 가이드 본문에도 같이 넣었다(271px에서 「인프라 스 / 캔을」이 갈리고 있었다).

### C — 접기 컨트롤을 레일이 소유

토글을 협업 채널 카드 밖, 레일 자신의 머리 행으로. `pt-2` + 32px 박스 → 중심 y=24, `p-3`의 12px 우측 여백 → 레일 오른쪽에서 28px. 접힌 스트립(`px-1 py-2`, 56px 레일: 4+8+16=28)과 같은 숫자다.

**이동 후 실측 Δ (0.5px, 0)** — 0.5는 레일의 `border-l` 1px.

## ⛔ 기각·보류

1. **시안 D — 고정 트리거 스트립(Cloudscape)**: 버튼 이동이 완전히 0이 되지만 패널 본문이 296 → 240px(−19%). 총폭 320 상한은 확정 테이블의 988px 바닥(#754) 때문에 못 넘긴다. 320px 문서 패널에서 읽는 폭 19%는 비싸다.
2. **시안 E — 카드를 풀고 한 장의 면으로**: P1·P2를 원인에서 없애고, 레퍼런스 13곳 중 320px 보조 패널에 **중첩 카드를 쓰는 곳은 하나도 없다.** 다만 2026-08-23 「가이드를 카드 그룹으로 묶을 것」 지시를 되돌리는 안이라 **오너 결정 사항**. 전제("흰 카드를 흰 레일 위에 못 올린다")는 헤어라인으로 풀리지만 지시는 별개다.
3. **`refBar` 강등**: 참고바가 여전히 패널에서 제일 눈에 띈다. 다만 이 모양은 PR #770 전사본이 오너의 원본 화면에서 그대로 옮겨온 것이라 손대지 않았다.
4. **P2(바닥면 12%)는 C에서 부분 해결로 남는다.** 존 카드를 레일 가로폭 끝까지 붙이고 세로 이음매만 바닥면으로 남기는 안이 후보로 열려 있다.

## 레퍼런스 (13, 전부 이번 세션에 직접 열람)

| # | 출처 | URL | 가져온 것 |
|---|---|---|---|
| R01 | AWS Cloudscape — Secondary panels | https://cloudscape.design/patterns/general/secondary-panels/ | 트리거 바는 오른쪽 가장자리 고정, help 아이콘이 항상 맨 위, 패널 3~4개 상한 |
| R02 | Atlassian — Elevation | https://atlassian.design/foundations/elevation | sunken = "다른 콘텐츠가 앉는 우물(칸반 컬럼)" · "Only use sunken surfaces on the default surface level" |
| R03 | IBM Carbon — Type styles | https://github.com/carbon-design-system/carbon/blob/main/packages/type/scss/_styles.scss | 행간·자간이 토큰에 붙는다 · 자간이 12→16으로 갈수록 +0.32→+0.16→0 |
| R04 | AWS Cloudscape — Typography | https://cloudscape.design/foundation/visual-foundation/typography/ | 같은 14px에 본문 20 / 제목 18 — 행간을 정하는 건 역할 · "don't use font size smaller than 12px" |
| R05 | Atlassian — Typography | https://atlassian.design/foundations/typography | body 3단(12/16, 14/20, 16/24) · heading.small은 같은 16px에 20 |
| R06 | Material Design 3 — Typescale | https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-typescale.scss | label/body/title 역할이 크기와 직교 · 자간 +0.5→+0.25→+0.15px |
| R07 | IBM Carbon — Type scale | https://github.com/carbon-design-system/carbon/blob/main/packages/type/scss/_scale.scss | 스텝 1·2·3 = 12·14·16, 짝수만 — 13은 "작은 14"가 아니라 스케일 밖 |
| R08 | GitHub Primer — Typography primitives | https://primer.style/foundations/primitives/typography | shorthand 토큰이 size+line-height+weight를 한 덩어리로 |
| R09 | JetBrains — Tool windows | https://www.jetbrains.com/help/idea/tool-windows.html | Hide 버튼은 **툴 윈도 헤더**가 갖는다 · 스트라이프가 이름을 보여준다 |
| R10 | VS Code — Sidebars | https://code.visualstudio.com/api/ux-guidelines/sidebars | 뷰가 하나면 툴바가 그 뷰의 액션으로 접힌다 · 뷰 3~5개 상한 |
| R11 | Stripe Apps — Design (ContextView) | https://docs.stripe.com/stripe-apps/design | "Header houses your app name … and a few top level actions" — 본문 첫 블록이 아니다 |
| R12 | W3C ARIA APG — Disclosure | https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/ | 한 버튼이 제자리에서 `aria-expanded`를 뒤집는다 — 두 반쪽에 각각 버튼을 둔 구조가 위치 불일치의 근원 |
| R13 | NN/g — Accordions on Desktop | https://www.nngroup.com/articles/accordions-complex-content/ | 접힌 것의 값은 머리글이 판다 · 열림/닫힘 상태는 사용자가 바꿀 때까지 유지 |

## 검증

1710×947, `/pass/target-sources/1002`(GCP 1단계) · `/1003`(Azure 4단계):

- 두 레일 모두 `#E5E5EF`
- 레일 안 폰트 크기 집합 = **{12, 14, 16}** (13 없음)
- 모든 줄상자 16 또는 20
- 존 제목 16/20/−0.32px/700/`#333D4B` · h4 14/20/−0.14px/**600**
- 접기 버튼 두 상태 Δ **(0.5px, 0)**
- 4단계 프로즈 358 → 320px

`tsc` clean · eslint 0 errors · **299 files / 3041 tests pass** · pre-commit 5종 green.
