# admin 크롬 이음매 — 헤더와 사이드바 사이에 선이 없다

- **일자**: 2026-08-29
- **대상 화면**: `/admin/**` 전역 크롬 — 상단 `TopNav` ↔ 좌측 파이프라인 사이드바
- **아티팩트**: https://claude.ai/code/artifact/3edaa82a-a60f-4306-b418-aec5a5f9058e
- **채택**: 시안 B (두 면 색 통일 + 이음매 헤어라인)

## 문제

오너 지적: "상단 navigation과 좌측 패널의 색상이 명시적으로 구분되지 않아 디자인이 미완성으로 느껴진다."

| | 진단 | 근거 등급 |
|---|---|---|
| P1 | 헤더 `#0F172A` ↔ 사이드바 `#101828` = **명도비 1.006:1**, 양쪽 다 border·box-shadow 0 | **수치 위반** — 오너 가이드 §3 「인접 계층은 레버 2개 이상 차이 — 1px 차이는 계층이 아니라 오차」에 레버 0개 |
| P2 | 사이드바는 `--pl-gray-900` 토큰, 헤더는 Tailwind 원시 클래스 `bg-slate-900` — **서로 다른 계열**. 두 값의 근접은 설계가 아니라 우연 | **수치 위반** — 앱 크롬에서 `--pl-*` 램프 밖에 있던 유일한 면 |
| P3 | 사이드바 활성 알약(`--pl-gray-800`, 바닥 대비 1.23:1)이 화면 구조 전체보다 또렷하다 — **디테일이 뼈대를 이긴다** | UX 원칙 (계층) |
| P4 | SSOT 프로토타입 `design/pipeline/admin-pipeline.html` 은 topnav·sidebar 를 **둘 다 `#101828`** 로 칠하고, `align-items:stretch` 탭 바의 활성 밑줄(`border-bottom:2px`)이 이음매 선 위에 앉아 **경계를 색이 아니라 인디케이터가 그렸다**. 실앱이 전역 TopNav(알약형)로 갈아타며 **조건은 남고 장치만 사라졌다** | 제안 (원인 해석) |

실측: origin/main, mock dev, 뷰포트 1710×947, `getComputedStyle` 직접 판독.

## 레퍼런스 (12종 중 실제로 인용한 것)

핵심 발견은 **선의 필요를 정하는 것이 색이 아니라 배치**라는 것이다.

| 제품 / 시스템 | URL | 배치 | 빌려온 것 |
|---|---|---|---|
| AWS Cloudscape | https://github.com/cloudscape-design/components/discussions/3058 | 겹침형 | **우리와 동형 버그.** TopNavigation+AppLayout 접점에 기본 보더가 없어 리포트 → "it's decided to add the border to the component directly" → `borderBlockEnd` 하드코딩, v3.0.944 릴리스. **선은 polish 가 아니라 결함 수정**이라는 판정 |
| GitHub Primer | https://primer.style/product/getting-started/foundations/color-usage/ | 겹침형 | 헤더·사이드바·본문 전부 순수 검정 + 헤더에만 `border-bottom 1px #3D444D`(2.15:1). 그 한 줄이 사이드바 상단까지 함께 끊는다 |
| Sentry | https://docs.sentry.io/product/issues/ | 겹침형 | 같은 문법의 독립 사례 — 헤더 `#111110` + 거의 흰색 7.2% 알파 1px(1.19:1) |
| Grafana | https://play.grafana.org | **기하형** | 헤더 = 사이드바 = `#181B1F`(**1.000:1**). 사이드바가 `y:0` 부터 좌상단 코너를 먹어 **접점 자체가 없다** → 선도 없다. 시안 C 의 근거 |
| Stripe | https://docs.stripe.com/api | **기하형** | 헤더 `#14171D` 가 바닥 `#1B1E25` 보다 어둡지만 1.08:1 로 안 보인다. 실제 경계는 선 |
| Atlassian | https://atlassian.design/foundations/elevation | — | "To create flat cards, pair with a border." `surface` ↔ `surface-sunken` = 1.06:1 |
| Radix Colors | https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale | — | 다크 step1↔2 = **1.07:1**, 그리고 그 둘을 "interchangeably" 써도 된다고 명시 — 색만으로는 신호가 안 만들어진다는 자백 |
| GitLab · Google Cloud | https://docs.gitlab.com/user/profile/preferences/ · https://docs.cloud.google.com/docs/get-started/console-appearance | 반증 | 하나는 사이드바만 다크, 하나는 다크 헤더 자체를 안 씀 — **현재 상태를 정당화하는 사례는 어디에도 없다** |

미검증(근거로 쓰지 않음): IBM Carbon 원문 재인용 실패 · Azure Portal · Linear(로그인 세션이라 조사 중단).

## 왜 시안 B 인가

측정된 인접 크롬 면의 명도비는 **1.00 ~ 1.08** 로 어느 제품도 색으로 가르지 않는다. 색을 벌려 도달할 수 있는 최대치가 이미 안 보이는 값이므로 "명도비를 더 벌리자"는 답이 될 수 없다. 열린 길은 둘 뿐이다 — **접점에 선을 긋거나(A·B), 접점을 없애거나(C)**.

- **C (기하 분리)** 는 Grafana·Stripe 가 실제로 쓰는 길이지만, `TopNav` 는 앱 전역 컴포넌트라 admin 에서만 기하를 바꿀 수 없다. 이미 제거된 로고 240px 고정 컬럼 결정과 충돌하고, `64px` 를 하드코딩한 6개 지점이 함께 움직인다.
- **D (사이드바를 밝은 레일로)** 는 효과가 가장 크지만 사이드바 위 잉크 전수 재측정 + `design-guard` 대비쌍 갱신이 따르고, **admin 의 인상을 바꾸는 오너 결정**이라 별도 안건으로 남긴다.
- **E (원안 복원)** 는 지금의 바 높이·항목 비율이 GitHub·Google Cloud·Vercel 실측 근거로 정해진 것이라 그 결정을 뒤집는다. 되돌릴 이유가 이음매 하나뿐이면 A 가 같은 일을 한 줄로 한다.
- **B** 는 A 가 고치는 것을 전부 고치면서 **P2 를 추가로 닫는** 유일한 안이고 변경은 두 곳뿐이다.

## 적용

```
lib/theme.ts · navStyles
- bg: 'bg-slate-900',
+ bg: 'bg-[var(--pl-gray-900)]',
+ seam: 'border-b border-white/15',

app/components/layout/TopNav.tsx   ← sticky header 의 cn() 에 navStyles.seam (토스트에는 넣지 않음)
```

`border-white/15` 는 컴포넌트가 아니라 `navStyles` 에 둔다 — CLAUDE.md ⛔4 「Raw 색상 클래스 직접 사용 금지」. 값 자체도 새것이 아니다: `navStyles.divider` 가 내비 클러스터 사이 세로선을 같은 알파로 긋고 있어, 이제 크롬을 구성하는 가로선과 세로선의 세기가 같다.

### 실측 (브라우저, 계산값 아님)

| | before | after |
|---|---|---|
| 헤더 ↔ 사이드바 | 1.006:1 | **1.000:1** (둘 다 `#101828`) |
| 이음매 합성색 / 대비 | 없음 | **`#343B48` · 1.58:1** |
| 헤더 위 잉크 | — | `slate-300` 11.94 · 흰 워드마크 17.75 · `#4D94FF` **5.91** (전부 AA 통과) |

1.58 은 측정된 레퍼런스 대역(Sentry 1.19 ~ Stripe 1.36)보다 한 단 위, Primer 2.15 보다 아래다. 처음 `white/10`(1.33:1)로 넣었다가 오너 지시로 한 단 올렸다 — 이 선이 유일하게 마주하는 것이 216px 다크 사이드바뿐이라 그 구간에서 놓치기 쉬웠다.

⚠️ 기존 주석에 적혀 있던 워드마크 액센트 대비 `5.41:1` 은 틀린 값이었다 → 실측 `5.91:1` 로 갱신.

### 밝은 화면 확인

헤더는 앱 전역이라 `/services`(레일 `#E2E7EA` + 본문 `#F4F4FB`)와 `/notices` 에서도 확인했다. 이 선은 헤더 `border-box` **안쪽** 마지막 픽셀 행이라 밝은 면 위에 뜨지 않고, 오히려 헤더 아래끝을 10% 밝게 만들어 기존 16:1 하드컷을 완화한다. 헤더 총 높이는 **64px 유지**(border-box) 라 `top-[64px]` 를 하드코딩한 6개 지점은 손대지 않았고, 아래 요소와 틈·겹침도 0이다.

## 남은 것

- 시안 **D(사이드바를 밝은 레일로)** 는 별도 안건 — 이번 수정에 필요하지 않고 오너 판단이 먼저다.
- `/admin` 밖 `--pl-*` 램프를 조정하면 이제 헤더가 함께 움직인다.
