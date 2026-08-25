# 설치 레일의 그룹 — 이름은 있었고 묶음은 없었다

- **일자**: 2026-08-25
- **대상**: `/pass/target-sources/{id}` 4단계 설치 카드의 그룹 레일(`InstallStatusDetail`, AWS·Azure·GCP·IDC 공용)
- **구현 PR**: #778
- **아티팩트**: https://claude.ai/code/artifact/29d3998a-0d11-4b8c-a051-5a38a61cb265
- **선행 라운드**: [트레이 표면](step4-tray-surface.md) · [스텝 카드 프레임](step-card-frame.md)

## 문제

오너 지적: *"우선 그룹화가 잘 안 되어보이네. 내가 할 일, BDC측 진행 필요, 이게 그룹화가 되었으면 좋겠는데.."*

`feat/step4-liveness-and-role @ aba07843`, 뷰포트 1920×902, `getBoundingClientRect()` · `getComputedStyle()` 실측.

| # | 문제 | 근거 등급 | 실측 |
|---|---|---|---|
| P1 | 그룹 사이 간격과 그룹 안 간격이 **같은 값** | 수치 | 레일 자식 8개의 인접 간격이 **전부 8.0px**. 「Terraform 권한 부여 확인 → BDC 진행」(그룹 경계)과 「BDC 공통 영역 → BDC 서비스 영역」(그룹 내부)이 구분되지 않음 |
| P2 | 그룹이 아무것도 **담고 있지 않다** | UX 원칙 | 라벨은 칠·테두리 0의 글자 한 줄, 항목은 각자 완결된 흰 카드. 화면에 있는 것은 그룹 3개가 아니라 같은 바닥의 형제 8개 |
| P3 | **부모가 자식보다 약한 신호**를 갖는다 | 수치 | 항목 = 흰 칠 + 1px 윤곽 + 58px / 라벨 = 칠 없음 + 0px + 40px. 카드 윤곽이 라벨의 위아래를 똑같이 막아 「위를 닫는 줄」인지 「아래를 여는 줄」인지 형태로 말하지 못함 |
| P4 | 그룹 색이 **라벨 글자에서 끝난다** | UX 원칙 | 라벨 `#0050D6` / indigo-800 / orange-800 이 서로 다른데, 항목 카드 5개는 전부 같은 흰 칠 + 같은 `#D6DBE6` 윤곽 |
| P5 | 헤더가 레일의 **26%**를 쓰는데 그룹당 항목은 평균 1.7개 | 수치 | 라벨 3 × 40px = 120px / 레일 462px. AWS todo 1·auto 3·참고 1 · Azure 3/1 · GCP 1/2 · IDC 1/2 — 항목 4개 이상인 그룹이 하나도 없음 |
| P6 | 들여쓰기가 사실상 없다 | 수치 | 라벨 `pl 10px`, 항목 `pl 12px + 1px` = 13px → 차이 **3px**. 비교값 Ant `inlineIndent 24` · Mantine `childrenOffset 28` |

P1이 결정적이다. 근접성은 색·모양 같은 다른 신호를 **덮어쓰기** 때문에(NN/g Law of Proximity), 8px 하나로 두 관계를 다 표현하는 한 P2~P4를 고쳐도 절반만 듣는다.

## 채택한 안 — A + C

리서치는 5안을 비교했고 표의 결론은 「A를 먼저 깔고 그 위에 C」였다. 오너가 그대로 채택했다.

### A — 간격을 두 값으로 가른다

`<nav>` 의 `gap-2` 하나를 걷어내고 그룹 래퍼 3개를 세웠다. 바깥 `gap-6`(24px) / 안쪽 `gap-1.5`(6px) — **1:1 이던 비가 4:1**. 항목은 스파인 안쪽 8px 에 놓여 글자 기준 13px 들여쓰기(P6).

Wave(Volue) 가 이걸 컴포넌트 기본값으로 못 박아 둔다: 섹션 사이 `spacingS`, 섹션 안 항목 `spacingXs`.

### C — 밴드와 스파인

- **밴드**: 라벨이 24px 틴트 면을 갖는다(P3). 활자는 16/600 → **12/600 + 자간 0.04em** — 담는 면이 생긴 이상 크기로 이길 필요가 없고, 패널 머리는 내용이 아니라 크롬이다(Ant `groupTitleColor` 문법). 라벨이 40 → 24px 로 내려가면서 **레일 전체는 오히려 짧아진다**(462 → 436px, P5).
- **스파인**: 밴드의 왼쪽 모서리에서 2px 세로선이 그룹 마지막 항목까지 내려간다(P4). 상자를 닫지 않고 ㄴ 자로 담는다. 근거는 EUI `emphasize` — 강조는 "that section **and its nested items**".

`installRailGroupStyles`(theme.ts) 신설. 색은 전부 이 화면이 이미 쓰던 것이다:

| 그룹 | 밴드 | 글자 | 스파인 | 출처 |
|---|---|---|---|---|
| 내가 할 일 | `#E8F1FF` | `#0050D6` | blue-300 | `primaryColors.bgLight`/`textOnLight` (design-guard 등록 쌍) |
| 내가 할 일 (완료) | gray-100 | secondary | gray-300 | `bgColors.panel` |
| BDC 진행 | indigo-100 | indigo-800 | indigo-300 | `tagStyles.indigo` · `sideTextColors.bdc` |
| 설치 스크립트 | orange-100 | orange-800 | orange-300 | `statusColors.warning` |

세 그룹의 색 출처가 다른 것은 의도다 — 「내가 할 일」은 **조치**의 묶음이라 브랜드 짝을, 나머지 둘은 정보의 묶음이라 팔레트 짝을 쓴다.

### 실측 (구현 후, 1920×902, /1008)

| | 값 |
|---|---|
| 그룹 사이 / 그룹 안 | **24px / 6px** (이전 8 / 8) |
| 밴드 높이 · 스파인 굵기 | 24px · 2px |
| 스파인 대 흰 바닥 | **1.81 / 2.01 / 1.71** |
| 항목 카드 윤곽 · 열 경계선 | 1.39 · 1.47 (비교값) |
| 라벨 대 밴드 | **5.92 / 8.16 / 6.43** (전부 AA 통과) |
| 레일 높이 | 462 → **436px** |
| 제목 상자 · 최장 제목 잉크 | 187px · 169.3px, 4 CSP 전부 한 줄 |

스파인은 **항목 카드 윤곽(1.39)과 열 경계선(1.47)보다 진해야** 한다 — 그 둘 사이를 지나가는 선이 그 둘보다 흐리면 묶는 선으로 읽히지 않는다. 지난 라운드에 열 경계선을 `default`(1.24) 에서 `strong`(1.47) 으로 올린 것과 같은 논리다.

## 레일 폭 224 → 240px (이 라운드에서 결정)

들여쓰기는 고정 레일에서 공짜가 아니다. 스파인 2px + 안쪽 여백 8px = **10px 이 그대로 제목 상자에서 빠진다.** 224 를 유지하면 제목 상자가 181 → 171px 인데, 이 레일에서 가장 긴 「서비스 측 Terraform 자동 적용」의 실측 잉크 폭이 **169.3px** — 여유 1.7px.

그 라벨이 감기지 않게 하려고 두 라운드를 썼으므로(47px 잘림 → 두 줄 → 순번 제거), 16px 은 오른쪽 셀에서 가져왔다. 그쪽은 열 폭이 저장되는 리사이즈 표라 여유분에서 빠진다. 착지 187px.

## 레퍼런스 (13종 · 확인함 12 / 기억 기반 1)

| # | 출처 | 빌려온 것 | URL |
|---|---|---|---|
| 01 | AWS Cloudscape — Side navigation | 구분선은 "fundamentally not related" 묶음에만 · "Avoid sections with only two links"(P5 근거) · 섹션과 확장그룹 혼용 금지 | https://cloudscape.design/patterns/general/service-navigation/side-navigation/ |
| 02 | NN/g — Law of Proximity | "Proximity … can overpower competing visual cues such as similarity of color or shape" — A가 전제인 이유 | https://www.nngroup.com/articles/gestalt-proximity/ |
| 03 | Wave (Volue) — Sidebar Navigation | 섹션 사이 `spacingS` vs 항목 사이 `spacingXs` — 간격 분화를 토큰으로 | https://wave.volue.com/components/sidebar-navigation |
| 04 | GitHub Primer — NavList | 제목(의미 묶음) ↔ 구분선(시각 분리) 분리 → 이름이 정보인 우리 그룹은 제목을 버릴 수 없음(시안 E 탈락 근거) | https://primer.style/components/nav-list |
| 05 | Elastic EUI — `EuiSideNav` `emphasize` | 강조가 "that section and its nested items" 까지 — 스파인의 직접 근거 | https://eui.elastic.co/docs/components/navigation/side-nav/ |
| 06 | shadcn/ui — Sidebar | `SidebarGroup ⊃ GroupLabel + GroupContent` — 그룹이 실제 컨테이너여야 간격·들여쓰기가 한 곳에서 나온다 | https://ui.shadcn.com/docs/components/sidebar |
| 07 | Ant Design — Menu ItemGroup | `groupTitleColor` 로 제목을 항목과 가르고 **작게** 간다 — 라벨 16 → 12 의 근거 | https://ant.design/components/menu |
| 08 | Mantine — NavLink | `childrenOffset` 28 · 세로 스파인으로 소속 표현 | https://mantine.dev/core/nav-link/ |
| 09 | GitLab Pajamas — Navigation | 하위 항목이 하나뿐이어도 상위 이름·위치 유지 → 1항목 그룹을 없애지 않고 헤더 비용만 낮춘 근거 | https://design.gitlab.com/patterns/navigation/ |
| 10 | NN/g — Accordions | 내용 대부분이 필요할 때 아코디언은 해가 됨 — 시안 D 반증 | https://www.nngroup.com/articles/accordions-complex-content/ |
| 11 | NN/g — Progressive Disclosure | 접기가 성립하는 조건 → 우리 레일에선 「설치 스크립트」 하나뿐 | https://www.nngroup.com/articles/progressive-disclosure/ |
| 12 | AWS Cloudscape — Expandable section | 레일 안에서 접기와 섹션 헤더는 양자택일 | https://cloudscape.design/components/expandable-section/ |
| 13 | Linear — 그룹 헤더(이름 + 카운트 + 접기) | 헤더가 **행동을 소유**해 소속을 증명 — 우리는 카운트만 있고 행동이 없다 (기억 기반, 이 세션에서 미검증) | — |

## 채택하지 않은 안

- **B — 그룹이 곧 패널** (테두리를 항목에서 그룹으로 이관, 표면 5 → 3). 구조적으로는 가장 옳고 P2 를 정면으로 고치지만, 지난 라운드 오너 지시(「각 요소를 카드 디자인으로 감싸기」)를 반전시킨다. **오너가 「항목 카드」보다 「그룹이 진짜 상자」를 택하면 되살릴 안.**
- **D — 접히는 그룹**. 소속을 행동으로 증명하는 가장 강한 안이지만, BDC 그룹은 폴링으로 갱신되는 진행 상태를 보러 오는 곳이라 접으면 그 상태가 안 보인다. 카운트만으로 「진행중 3」과 「실패 1 + 진행중 2」가 구분되지 않는다.
- **E — 구분선 문법**(라벨을 회색 크롬으로 내리고 전폭 구분선). 가장 조용하지만 그룹 색 코딩을 잃는다 — 라벨의 파랑/남색은 리소스 표 `SideTag`(서비스측/BDC측)와 같은 색이라 레일과 표가 같은 어휘를 말하고 있었다.

## ⛔ 이번 라운드에서 제외한 것 (과거 판례)

1. **레일 컬럼 전체 채색** — #686 시안 E 로 기각(4-CSP 일관성). C 의 밴드는 라벨 24px 에만 닿으므로 다른 안이다.
2. **full-bleed 회색 트레이 / `bgColors.tray #DFE3EC`** — 재도입 금지.
3. **그룹 라벨 삭제 + 항목별 주체 칩** — 그룹을 없애는 방향이라 요구와 정반대.

## 트립와이어 (3건, 뮤테이션 4종 확인)

`InstallStatusDetail.na-blocked.test.tsx` 의 「그룹이 항목을 담는다」 스위트. 셋 다 **픽셀에서만 보이고 다른 단언은 하나도 깨뜨리지 않는다** — 그룹 래퍼를 걷어내 라벨과 항목을 다시 `nav` 형제로 늘어놓아도 기존 제목·순번·카드 단언은 전부 통과한다. 8px-everywhere 상태가 두 라운드를 버틴 이유가 정확히 그것이다.

| 뮤테이션 | 깨진 단언 |
|---|---|
| `gap-6` → `gap-1.5` (간격 통일) | 그룹 사이 간격이 그룹 안 간격보다 넓다 |
| `border-l-2` 제거 (스파인) | 그룹 색이 항목 옆까지 내려온다 |
| `tone.band` 제거 (밴드 칠) | 그룹 색이 항목 옆까지 내려온다 |
| 그룹 래퍼 → `<Fragment>` (해체) | nav 의 직계 자식은 그룹뿐이다 |

jsdom 에 레이아웃이 없어 간격은 클래스로 잰다 — 두 값이 다르다는 사실만 여기서 지키고, 정확한 수치는 브라우저 실측으로 확인했다.

## 남은 것

- **스켈레톤의 밴드·스파인은 중립(gray-100/gray-300)**이다. 스켈레톤은 아직 어느 그룹이 어떤 상태인지 모르고, 미리 칠하면 도착하며 색이 바뀌는 깜빡임이 생긴다. 그룹 문법(간격·밴드 높이·스파인)은 실물 그대로라 프레임은 튀지 않는다.
- 레일이 그리드 행 높이만큼 늘어나는 것(오른쪽 셀이 더 길 때 레일 아래가 비는 것)은 이 라운드 이전부터의 동작이고 건드리지 않았다.
