# 가이드 레일 표면 위계 — 벤치마크와 채택 기록

- **날짜** 2026-08-23
- **대상** `/pass/target-sources/{id}` 설치 화면의 우측 가이드 레일 (`GuidePanel`)
- **발단(오너)** "색감이나 뭐 이런게 다 영 별로다."
- **아티팩트** https://claude.ai/code/artifact/62bd97ed-5426-4ab3-b186-a5fd9c235d57
- **구현 PR** #759 (`feat/rail-collapse`)

---

## 1. 진단

진단 시점 커밋 `88741230`. 레일은 흰 면 + 상단 `#E8F1FF` 밴드(150px) + 흰 가이드 본문 구조였다.

| # | 문제 | 근거 등급 | 실측 근거 |
|---|------|-----------|-----------|
| P1 | 레일이 화면에서 가장 밝은 면 | 수치 위반 | 좌 서비스 레일은 `#E2E7EA`(L\* 91.4)로 내려가 있고 우 레일만 흰색(L\* 100). `serviceSidebarStyles.surface` 주석이 이미 "레일은 뒷판" 이라고 판정해 둠 |
| P2 | `#E8F1FF` 가 「단계 태그」와 같은 색 | 수치 위반 | `cardStyles.stepTag` = `primaryColors.bgLight`. theme.ts 23회 · `app/**/*.tsx` 7회로 앱 최다 과적 틴트 |
| P3 | 틴트 블록 2개가 연속 | UX 원칙 | `#E8F1FF` 밴드 바로 아래 `#F2F4F6` 안내박스. GitHub alert 지침 위반 2건 |
| P4 | 위계 역전 — 상시 가구가 메모보다 시끄러움 | UX 원칙 | 밴드가 레일 높이의 17%(150/883px) |
| P5 | 텍스트 기둥 2개 | 수치 위반 | 밴드 `px-4`(16) vs 본문 `p-5`(20). 실측 x=17 / x=21 |
| P6 | 링크 행의 과녁 신호 상실 | 제안 | 흰 카드 제거(오너 지시) 후 밑줄 친 키만 남음 |

### 뒷판으로 내릴 때 재측정한 잉크 (참고용, 미채택 경로)

`#E2E7EA` 위: `#191F28` 13.29 · `#374151` 8.27 · `#4E5968` 5.71 · `#0050D6` 5.40 · **`#0064FF` 3.95 ✘** · **gray-500 3.88 ✘**

---

## 2. 사용한 레퍼런스

배지는 확인 정도 — **본문**(직접 fetch) · **검색**(검색 결과 본문) · **기억**(재확인 안 함).

| # | 레퍼런스 | URL | 빌려온 것 | 확인 |
|---|----------|-----|-----------|------|
| 1 | AWS Cloudscape — Help system | https://cloudscape.design/patterns/general/help-system/ | 도움말 3단 램프(Bites/Snack/Meal). 패널은 보조 크롬이라는 전제 | 본문 |
| 2 | IBM Carbon — Color usage | https://carbondesignsystem.com/elements/color/usage/ | `background`→`layer-01/02/03`. 판을 바꾸면 그 위 토큰을 세트로 간다 | 본문 |
| 3 | Stripe Apps — design | https://docs.stripe.com/stripe-apps/design | 브랜드색은 app indicator(색 바 + 아이콘)에만. 나머지 색은 제한 | 본문 |
| 4 | GitHub Docs — Alerts | https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax | "limit them to one or two per article", "avoid placing alerts consecutively" → **P3 의 근거** | 본문 |
| 5 | Microsoft Fluent 2 — Color | https://fluent2.microsoft.design/color | 패널 기본값은 `colorNeutralBackground2`(#FAFAFA), 브랜드색 아님 | 검색 |
| 6 | Atlassian — Elevation | https://atlassian.design/foundations/elevation | sunken/default/raised/overlay — 중요도를 색이 아니라 높이로 | 검색 |
| 7 | Shopify Polaris — Colors | https://polaris.shopify.com/design/colors | `bg-surface-secondary` = `#F7F7F7`. 보조 표면의 산업 표준값이 무채색 | 검색 |
| 8 | ServiceNow Horizon — Contextual side bar | https://horizon.servicenow.com/workspace/patterns/contextual-side-bar/contextual-side-bar-patterns | 레코드 옆 관련 콘텐츠 패턴. 섹션으로 나누되 카드화하지 않음 | 검색 |
| 9 | Material Design 3 — Color roles | https://m3.material.io/styles/color/roles | 컨테이너 계열(중립)과 강조 계열(`primary-container`)을 애초에 분리 | 기억 |
| 10 | Linear | https://linear.app/method | **전폭 헤어라인 + 소형 섹션 라벨 = 카드 없이 존 나누기 → 시안 E 의 뼈대** | 기억 |
| 11 | Notion — sidebar | https://www.notion.com/help/navigate-with-the-sidebar | 보조 진입점이 읽을거리 위를 선점하지 않게 | 기억 |
| 12 | Intercom Messenger (**반증**) | https://www.intercom.com/messenger | 브랜드색 큰 면이 도움 표면에서 통한다는 실증. 단 독립 오버레이라 본문과 위계를 겨루지 않음 | 기억 |
| 13 | Google Cloud Console (**반증**) | https://cloud.google.com/ | 파란 info 블록을 상시로 씀. 단 거기서 파랑은 뜻이 하나뿐 — 우리는 `stepTag` 와 겹침(P2) | 기억 |

레퍼런스 12·13 은 추천안을 **반증하려고** 고른 것이다. 둘 다 우리 조건과 어긋나는 지점을 함께 적었다.

---

## 3. 채택: 시안 E (무채색 + 잉크만)

아티팩트의 추천은 **시안 A(뒷판 정렬)** 였다. 오너는 **E** 를 골랐다.

### E 가 하는 일

- 레일 안에 **칠해진 면이 하나도 없다.** 두 존은 전폭 헤어라인과 존 라벨로만 나뉜다.
- 존 라벨 = `railStyles.zoneLabel`, 좌 서비스 레일의 `sectionLabel` 값 그대로(`#4E5968` 12px). 흰 면에서 7.12:1.
- **안내박스(`#F2F4F6`)가 레일의 유일한 틴트**가 되어 제 뜻을 되찾는다.
- 텍스트 기둥을 20px 하나로 통일 → **P5 동시 해결**.

### 표에서 E 를 고르는 근거

| | P1 | P2 | P3 | P4 | P5 | P6 | 비용 |
|---|---|---|---|---|---|---|---|
| A (추천) | ● | ● | ● | ● | ○ | ● | 중 |
| E (채택) | ○ | ● | ● | ● | ● | ○ | 소 |

E 는 P1 을 남기는 대신 P5 를 가져오고 비용이 훨씬 낮다. **P1(레일이 앞판) 은 열린 채로 남아 있고, 되짚으려면 시안 A 로 돌아가면 된다.** P6(링크 과녁) 도 남았다.

### 오너가 E 에 얹은 것 (2026-08-23)

1. **가이드 마크 = 전구.** 처음엔 이쪽에서 Heroicons v2 solid + `#CA8A04` 로 만들었는데, 오너가 **Figma 노드**(`slrqFgziqlHznBZ1VMPtcq`, `6:11`)를 주면서 그걸로 대체했다. 스펙은 **선(stroke) 전구 `#F59E0B` 2px round** + **28×28 `#FFF8E1` 플레이트, radius 8**.
   - ⚠️ `viewBox="0 0 14 14"` — 이 앱의 다른 아이콘(24)과 다르다. 스트로크 비율이 1:7 로 Heroicons(1:12)보다 굵고, 그 굵기가 스펙이다. 24 박스로 옮기려면 stroke 를 3.43 으로 바꿔야 해서 아무도 "Figma 스펙" 으로 못 읽는다. ⛔ 좌표 정리하지 말 것.
   - ⚠️ `#F59E0B` 는 흰 면 **2.15:1**, 자기 플레이트 위 **2.02:1** — 1.4.11 미달. 채도 높은 노랑~앰버는 이걸 못 넘는다(H 38° 에서 3:1 을 넘기려면 노랑이 아니게 될 때까지 어둡게 해야 함). 옆의 「N단계 가이드」와 스트립 `aria-label` 이 뜻을 전부 실으므로 **장식 글리프**로 판정, `design-exempt`. ⛔ 글리프가 유일한 채널인 곳에 재사용 금지.
   - ⛔ 경고색이 아니고, **`#CA8A04` 때보다 더 가까워졌다.** `connProgress` 가 앰버를 경고로 쓴다(점 `#E8A03A` H 35°, 잉크 `#B45309`). H 38° 대 H 35° — 색상으로는 안 갈린다. **실루엣과 자리**로만 갈린다: 전구는 레일 존 머리에만, 상태 점은 절대 아니다.
   - **플레이트는 열린 존 머리에만.** 28px 은 마크지 판이 아니고 흰 면 대비 1.06 이라 안내박스와 "뜻을 가진 틴트 블록" 자리를 다투지 않는다. ⛔ 밴드로 키우면 `#E8F1FF` 실수를 다른 색으로 반복하는 것. 스트립은 맨 글리프 — 접힌 레일의 문법이 "20px 글리프 + 라벨" 짝이라 한쪽만 플레이트를 달면 짝이 깨진다.
2. **같은 마크를 접힌 스트립과 열린 존 머리 양쪽에.** 접어도 가이드의 생김새는 안 바뀌고 양만 바뀐다.
3. **「N단계 가이드」.** 번호는 `GUIDE_SLOTS[slotKey].placement.step` 에서 온다. `GuidePlacement` 는 `side-panel`/`tooltip`/`faq` 를 예약해 둔 union 이므로 `kind === 'process-step'` 으로 좁힌 뒤 읽는다 — 좁히지 않으면 「undefined단계」가 찍힌다.
4. **접힌 스트립 라벨 = 14px semibold, `#0050D6`.** ⛔ 14 는 이제 바닥이 아니라 **천장**이다: 스트립 56px 에서 `px-1` 빼면 48 가용, 「가이드」 실측 잉크폭 35.4px. 한 글자만 늘어도 `whitespace-nowrap` 이라 넘친다. 파랑은 레일의 단일 파랑(`#0050D6`, Jira 키·`guideStyles.accent` 와 동일) — ⛔ `#0064FF` 아님.
5. **존 라벨 = 16px semibold.** ⚠️ 처음엔 좌 레일 `sectionLabel`(12px medium) 을 그대로 빌렸고 "두 레일이 nav 관용구를 공유해야 한다" 가 근거였는데, **16px 이 되면서 그 근거가 사라졌다** — 이건 nav 라벨이 아니라 섹션 제목이다. 잉크 `#4E5968`(흰 면 7.11:1)은 유지: 바로 아래 「도움이 필요하신가요?」(16px bold `#101828`)가 먼저 읽혀야 한다.
6. **문구**: "협업 채널에서 ~~담당자에게~~ 바로 문의할 수 있어요."

### 구현 중 추가로 잡은 것

- **헤어라인을 `borderColors.light` → `default` 로.** 칠이 전부 빠지자 이 선이 존을 가르는 두 가지 중 하나가 됐는데 gray-100 은 흰 면에서 **1.101** 이라 사실상 안 보였다. gray-200 은 1.238 로, 좌 레일 divider 가 자기 판에서 갖는 1.439 에 가깝다.
- **존 라벨을 스크롤 컨테이너 밖으로.** 스크롤에 밀려 사라지는 라벨은 라벨이 아니다 — E 에는 대신 받쳐 줄 칠이 없어서 더더욱.
- **빈 상태 잉크를 `tertiary` 로 되돌림.** `secondary` 로 올렸던 건 `#E8F1FF` 밴드 때문(거기서 gray-500 은 4.25:1)이었고, 밴드가 사라지면서 흰 면 4.83:1 로 다시 합법이 됐다. 자리 표시자는 조용한 게 맞다.
- **`railStyles.toggle` 을 다시 한 토큰으로.** 밴드가 틴트였던 동안 base + `onSurface`/`onTint` 로 갈라졌는데, 칠이 없어지면서 두 상태 모두 흰 면에 선다. ⛔ 다시 틴트를 깔면 hover 가 사라진다(gray-100 은 `#E8F1FF` 에서 1.03). 그때의 짝은 `#D6E7FF`(1.103).

### 남은 것

- **P1** — 레일이 여전히 화면에서 가장 밝은 면. 좌우 레일이 다른 판.
- **P6** — 링크 행에 과녁 신호가 없음.
- 둘 다 시안 A 가 한 번에 닫는다.
- **두 존 머리의 구조가 다르다.** 「협업 채널」은 맨 라벨(x=21), 「2단계 가이드」는 플레이트+라벨(라벨 x=57). 그래서 ① 라벨끼리 안 맞고 ② 「협업 채널」 16px semibold 가 바로 아래 「도움이 필요하신가요?」 16px bold 와 같은 크기로 붙어 두 제목이 겹쳐 읽힌다. 닫으려면 채널 머리에도 플레이트+ChatIcon 을 주고 **링크 행의 ChatIcon 은 빼야** 한다(같은 글리프가 60px 안에 두 번). 미발주.
