# 협업 채널 카드 — 「강약의 개념이 없어」

- 날짜: 2026-08-28
- 대상: `GuidePanel.tsx` › `CollabChannelCard` + 존 머리 · `lib/theme.ts` `railStyles.bubbleTail`
- 리서치 아티팩트: https://claude.ai/code/artifact/99e825b8-d78d-4a59-804a-1c1864ab18a4 (3차, 「레버 원장」)
- 1차 `guide-rail-surface.md`(레일 표면) · 2차 https://claude.ai/code/artifact/8c03df87-8c3d-4a4a-9d5e-c9a6e0e0a1d1 및
  https://claude.ai/code/artifact/70b2e76b-3f87-4737-80ec-432ff5849809 (카드 내부 표현·머리 활자, 채택 없이 시안 E만 부분 반영)

시작점: 시안 A 4커밋으로 125 → 98px 까지 줄인 뒤에도 「디자인이 너무 너무 조잡해 보인다」,
이후 3차에서 「강약의 개념이 없어. 좌측에 너무 쏠려있어서 그런가」(오너).

## 문제 (증거 등급)

핵심은 **「강약 없음」과 「조잡함」이 원인이 다르다**는 것이었다. 한 레버로 둘 다 못 고친다.

| # | 진단 | 등급 |
|---|------|------|
| P1 | 강조 정점이 payload 가 아니라 **label** 에 있다. 「협업 채널」 3레버(16+700+최짙은 잉크) vs `BDCDIP-1002` 1.5레버(14+400+파랑) — 누르는 대상이 카드에서 가장 약한 잉크 | UX 원칙 |
| P2 | 크기 폭 16→12 = **1.33×**, 그 폭의 정점이 크롬에 있다. 14px 키는 16 과 12 사이라 순위가 아니라 중간값 | UX 원칙 (`/design-guide` §3 인접 계층 레버 2개 이상) |
| P3 | `font-mono` 가 **픽셀을 하나도 안 바꾼다**. 브라우저 실측 resolved family = `pretendard` (`globals.css` 가 `--font-mono` 를 sans 로 접어둠) — 소스에만 있고 화면엔 없는 레버 | 수치 위반 |
| P4 | 카드 패딩 **12px = 라운드 12px**. `/design-guide` §1 카드 패딩(상20·좌우24·하24) 과 여백 7원칙 #4(라운드가 클수록 안쪽으로) 위반 — 내용이 곡률을 타고 있다 | 수치 위반 |
| P5 | 오른쪽 필드가 죽었고 유일한 점유물인 8px 점이 라벨에서 **206px** 떠 있다. 잉크 채움 21% / 64% / 37% — 칼럼의 59% 가 비었고 전부 오른쪽 | UX 원칙 (실측) |
| P6 | 레일의 시각 장치를 **아래 가이드 카드가 독점**한다 (전구 글리프 · 번호 붙은 파란 원형 배지 3개 · 채운 파란 버튼). 협업 채널 카드는 글리프·배지·칠·구조가 전부 없어 「약함」이 두 번 읽힌다 | 제안 |

실측 환경: dev 서버 `feat/collab-bubble` b40cff30 · 뷰포트 1900×1052 · 레일 319px(펼침 확인) ·
잉크 폭은 `Range.getClientRects()` (block 박스 폭이 아니라 글자 폭).

## 레퍼런스

| # | 출처 | 검증 | 빌린 것 |
|---|------|------|---------|
| 1 | IBM Carbon `@carbon/type` 토큰 소스 — [styles.ts](https://github.com/carbon-design-system/carbon/blob/main/packages/type/src/styles.ts) · [scale.ts](https://github.com/carbon-design-system/carbon/blob/main/packages/type/src/scale.ts) | 확인함 | `heading01` = **14/600**, `bodyCompact01` = 14/400, `label01` = 12/400. 밀도형 UI 는 머리와 본문이 같은 14px 이고 **무게만으로** 갈린다 → 시안 A 의 값 |
| 2 | Carbon [Typography overview](https://carbondesignsystem.com/elements/typography/overview/) | 확인함 | «a bold weight will always have more emphasis than a lighter weight font of the same size» · 가벼운 글자가 위로 올라오려면 «significantly larger» — **16/14 = 1.14× 는 못 채운다**. P1 의 산수를 문서가 직접 명명 |
| 3 | Atlassian [Applying typography](https://atlassian.design/foundations/typography/applying-typography) | 확인함 | «don't use heading text in components, instead use body text with a heavier font weight» → 시안 A 를 정면 지지. `font.metric.small`(16 Bold)·`font.heading.xxsmall`(12 Bold) 은 시안 D 의 근거 |
| 4 | AWS Cloudscape [Help system](https://cloudscape.design/patterns/general/help-system/) · [Secondary panels](https://cloudscape.design/patterns/general/secondary-panels/) | 확인함 | 외부 링크는 content ramp 의 **마지막 칸**, 패널 바닥의 평문 링크. «secondary panels are meant to be secondary» → **자리는 1등, 소리는 3등**. 버튼 승격을 막은 근거 |
| 5 | GOV.UK [Contact a department](https://design-system.service.gov.uk/patterns/contact-a-department-or-service-team/) · [Inset text](https://design-system.service.gov.uk/components/inset-text/) | 확인함 | «avoid using inset text as a way of highlighting very important information» → **칠(tint)로 강조하는 안을 죽인 근거** |
| 6 | GitHub [Primer Banner](https://primer.style/components/banner) | 확인함 | tint 는 **상태 의미가 있을 때만**. Primer 는 중립 tint 를 팔레트에 두지 않는다 |
| 7 | Cloudscape KeyValuePairs · Ant Descriptions · Primer ActionList | 확인함 | **3/3 예외 없이**: 라벨을 수식하는 표시자는 라벨에 붙는다(0px 아래 / 8px 오른쪽 / 왼쪽 열). 우측 far edge 는 **액션 전용**이거나 비어 있다 → 시안 C 의 근거 |
| — | 사내 선례 `cardStyles.stepTag` · `serviceRailStyles.rowCode` · `plStyles.typeTag` | 확인함 | 파란 `#E8F1FF` 판은 「N단계」가 **점유** — 한 판이 한 사실을 두 톤으로 나르면 두 의미로 읽힌다. `typeTag` 는 같은 이유로 mono 선언을 이미 삭제 |

⚠️ Linear · Figma · Notion 은 실측 실패로 **기억 기반**이라 시안 근거로 인용하지 않았다.
Cloudscape `key-value-pairs` / `help-panel` 컴포넌트 페이지는 SPA 셸이라 본문 미인출 — 타입 수치는 인용하지 않았다.

## 채택 — A + C + E (B·D·F 보류)

셋이 각각 다른 진단을 맡는다. 겹치지 않으므로 하나를 빼면 그 진단이 그대로 남는다.

### A — 이슈 키 `14/400` → `14/600` (P1·P2)

`channelKey` 에 `font-semibold` 하나. **무게이지 크기가 아니다** — 16 이면 머리의 16 과 부딪히고
레일의 12/14/16 사다리가 무너진다. 400 은 Carbon `bodyCompact01`(컴포넌트 안의 값)이었고,
600 은 `heading01`(밀도형 섹션 머리)이다. 레퍼런스 1·2·3 이 같은 값을 가리켰다.

### C — 상태 점을 far edge → 라벨 옆 `gap-1.5`(6px) (P5)

⛔ `justify-between` 은 「양 끝에 서로 무관한 두 가지」의 문법인데 점은 「협업 채널」과 무관하지 않다.
206px 은 레퍼런스 7 의 관용 거리(0~8px)의 **26배**.
**오너 지시 2026-08-28 「우측 끝에 상태표시 원」의 반전**이며, 반전 근거가 3/3 일치라 요청해 승인받았다.

⛔ 머리 오른쪽 209px 은 **의도적으로 비운다**. Cloudscape 가 flush-left + 빈 우측 필드를 공식 권장하고,
고아가 사라지면 같은 공백이 여백으로 읽힌다. 「좌측 쏠림」을 수평으로 채워 푸는 안이 아니다.

### E — 카드 패딩 `p-3` → `p-4` (P4)

`rounded-xl` 카드의 패딩이 코너 라운드와 **같아서** 내용이 곡률을 타고 있었다.
⛔ `railStyles.bubbleTail` 이 `after:left-3` → `after:left-4` 로 **함께** 움직인다 —
두 값은 두 파일에 나뉘어 적힌 하나의 측정이고, 한쪽만 바꾸면 꼬리가 내용 가장자리에서 떨어진다.
부수 효과로 머리의 위/아래 여백 마진이 1.5 → 3.5px.

⛔ 가이드 카드는 `p-3` 유지 — 두 존의 패딩 짝이 깨진 것은 의도이며, 올릴지는 오너 미결.
레일 세로 예산 8px 과 가이드 스크롤러 길이가 대가.

### 실측 (적용 후)

| | 전 | 후 |
|---|---|---|
| 키 무게 | 400 | 600 |
| 카드 패딩 / 꼬리 | 12 / `left-3` | 16 / `left-4` |
| 점 ↔ 라벨 | 206px | 6px |
| 머리 위 잉크 | 14 | 16 |
| 잉크 비율(내부/섹션) | 12.5 / 28 (2.24×) | 12.5 / 28 (2.24×) |
| 카드 높이 | 110 | 118 |

## 보류 — 다음에 쓸 카드

- **B (값 줄을 행 전체 타깃 + 우측 ↗)** — 히트 영역 100×17 → 263×27, 여백 7원칙 #3 이 지지.
  ⛔ 「anchor 가 행 폭을 갖지 말 것」 판례와 충돌하는데, 그 판례의 전제(anchor 가 회색 라벨을 감쌈)는
  라벨 삭제로 **이미 소멸**했다. 판례 만료는 오너 몫이라 분리해 두었다.
- **D (정점 역전 — 머리 12/600, 키 16/700)** — 가장 강한 강약. Atlassian `font.metric.small` 이 전용 토큰.
  ⛔ 머리 통일 결정(좁은 레일 레퍼런스 5건)을 파기하고 `zoneLabel` 을 다시 쪼갠다.
- **F (수직 묶기 — 머리↔설명 12.5 → 4.5, 비율 6.2×)** — Cloudscape 가 죽은 우측을 공식 권장하며,
  견디는 장치가 수직 간격 대비라는 반증에서 나온 대안 경로.
  ⛔ 오너 지시 2026-08-28 「행간 거리 띄우자」의 반전이라 그 지시를 뒤집을 의사가 있어야 유효.

## 기각

- **표면을 칠한다(tint)** — 레퍼런스 5 가 명시 금지, 4·6 이 같은 방향. 흰 카드 유지가 맞다.
- **CTA 를 버튼 크롬으로 승격** — 레퍼런스 4. 최상단 + 상시 노출이면 이미 소리를 한 단 받은 상태다.
- **제목을 줄여 강약을 만든다** — 레퍼런스 4 는 헬프 헤딩을 대응 섹션 이름과 일치시키라고까지 못박는다. 헤딩은 강조가 아니라 **좌표**다.
- **키를 파란 `#E8F1FF` 칩에 담는다** — `cardStyles.stepTag`(「N단계」)가 같은 화면에서 그 판을 점유.
- **점과 ↗ 를 한 x 에 세워 우측 열을 만든다** — 이 문서 초판의 추천이었고 레퍼런스 7 이 반증했다.
  성격이 다른 둘(수식어 / 액션)을 같은 열에 넣는 오류.

## 남은 부채

- 죽은 `font-mono` 선언 — 픽셀을 안 바꾸므로 디자인 결정이 아니다. `plStyles.typeTag` 가 같은 이유로
  이미 삭제한 선례가 있으나, A·C·E 지시에 없어 이번 커밋에 넣지 않았다.
- 미연결 상태의 문구 충돌 — 「막히는 부분을 바로 문의할 수 있어요」 바로 아래 「아직 연결된 협업 채널이 없어요」.
  레퍼런스 5 가 이 빈 상태에 **표준이 없다**고 명시(미해결 리서치 질문)해 우리가 정해야 한다.
- 세 상태(연결됨·미연결·오류)가 같은 골격을 쓰는지 — 하나만 링크고 둘은 문장이면 카드가 상태마다 다른 물건이 된다.

## 검증

- `npx tsc --noEmit` clean · `npx vitest run` **3200/3200** · `npm run design:check` errors 0
- pre-commit(lint · type-check · test-run · build) 통과
- **뮤테이션 테스트**: A·E 는 최초 적용 시 트립와이어가 **없었다**(`font-semibold` 제거·`p-4`→`p-3` 모두 35개 초록).
  네 개를 박고 각각 독립적으로 빨강 확인 — `gap-1.5`→`justify-between`, `font-semibold` 제거,
  `p-4`→`p-3`, `after:left-4`→`after:left-3`(커플 절반만) — 복원 후 35 초록.
