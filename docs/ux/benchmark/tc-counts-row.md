# Step 5 연결 테스트 카드 — 카운트 줄과 진행 중 글리프

- 날짜: 2026-08-21
- 대상: `TcSummaryCard.tsx`(클라우드·IDC 공용) · `lib/theme.ts` `idcStyles.connProgress`
- 리서치 아티팩트: https://claude.ai/code/artifact/1abb4294-89b8-4a7c-8cc7-feec27c4b8a8
- 구현 PR: #746 (1라운드 "표면 정리"와 같은 브랜치. 1라운드 기록은 `tc-card-surface.md`)

## 문제 (증거 등급)

시작점: `성공 2 · 실패 0 · 진행 중 1 · 대기 3 · 보고됨 2/6`

| # | 진단 | 등급 |
|---|------|------|
| Q1 | 한 줄에 축 두 개 — 성공·실패·진행 중·대기는 총계를 나눠 갖는 **분할** 축, 보고됨 2/6은 그 합을 다시 세는 **집계** 축. 같은 숫자 2가 한 줄에 두 번 나오고 "2 = 성공+실패"를 독자가 암산한다 | UX 원칙 |
| Q2 | 단어+숫자 쌍이 최대 6개. 한국어 라벨이 값보다 길어 줄의 대부분이 라벨이다 | UX 원칙 (Carbon: 5~6개를 넘으면 집중이 어려워진다) |
| Q3 | 0값 정책 비일관 — 성공·실패는 0이어도 그리고 나머지는 숨긴다. 진행 중의 "실패 0"이 "실패 없음 확정"으로 읽힌다 | UX 원칙 (부분집합에서 '없음'은 '모름'이다) |
| Q4 | 세그먼트 바에 범례가 없어 숫자 줄이 범례를 겸한다 | 제안 |
| Q5 | 진행 중 독자의 질문은 "얼마나 됐나"와 "실패가 나왔나" 둘뿐인데, 대기 3·진행 중 1이 같은 등급으로 나열된다 | 제안 |
| G1 | 진행 중 글리프가 **도는 시계** — 원은 회전 대칭이라 15px에서 실제로 움직이는 건 1px 바늘 둘뿐 | 수치 위반 (기하) |
| G2 | `queued`도 같은 `ClockIcon`을 써서, `motion-reduce`에서 두 상태 글리프가 동일해진다 | UX 원칙 (WCAG 1.4.1 / Primer: 정보를 애니메이션으로 전달하지 말 것) |

## 채택 — 시안 C (시안 B 포함)

**B(진행 중 어휘 축소).** 진행 중엔 `진행 중·대기·미보고`가 독자에게 한 사실(아직 답이 없다)이라 `남음`으로 접는다.
그러면 `성공 + 실패 + 남음 = 총계`인 한 축이 되고, 집계 `보고됨 N/M`은 **옮기는 게 아니라 불필요해져 사라진다**.
Q3도 함께 닫힌다 — 남은 몫이 보이면 "실패 0"은 부분값으로 읽힌다.

- 접기는 표현 변경이 아니라 **순위 결정**이다. RUNNING·PENDING·미보고 세 개념은 모델에도 표의 행 상태 칸에도 그대로 남는다.
- 정착한 실행에서는 접지 않는다 — 그때 미보고는 실제 이상신호다. `미확인`(계약 밖 값)은 어느 국면에서도 접지 않는다.

**C(점 범례).** 각 버킷 앞에 트랙 `fillColor`와 **같은 색의 8px 점**. 가운뎃점 구분자가 사라지고 줄이 바의 범례를 겸한다(Q4).
미보고·미확인은 채운 점이 아니라 **파선 링** — "값이 없다"는 사실은 색이 아니라 형태가 말한다. 단어는 모든 점 옆에 남긴다(WCAG 1.4.1).

**값 14px.** 라벨 12px 대비 두 단계 위 — 줄에서 먼저 잡혀야 하는 건 숫자다(오너 결정).

**진행 중 글리프 = 활동 파형(`ActivityIcon`).** 도는 시계를 대신한다. 시계는 바깥 원이 회전 대칭이라 15px에서 실제로 움직이는 건
1px 바늘 둘뿐이었고, `queued`가 같은 글리프를 써서 `motion-reduce`면 두 상태가 동일해졌다. 획 2.4 — 15px로 줄면서 얇아지므로
작은 크기에서 획을 두껍게 가져가는 Carbon Loading small 변형과 같은 방향.

파형은 **두 겹**이다. 아래는 25% 불투명도의 트랙, 위는 밝은 마디 하나가 `stroke-dashoffset`을 타고 왼→오로 지나간다
(`tc-activity-march` 1400ms linear, `motion-safe`). ⛔ 파형을 회전시키면 안 된다 — 도는 대신 흐른다.
모션이 꺼지면 마디가 제자리에 멈추고 트랙이 형태를 유지하므로, 애니메이션이 상태의 유일한 채널이 되지 않는다.

**문장은 판정만, 수는 카운트 줄이.** `리소스 4개 중 3개 연결 성공 — 실패 1건을 점검해 주세요`는 한 계층 위에서 Q1을 반복하고
있었다 — 아래 줄이 이미 `● 성공 3 ● 실패 1`을 그리는데 문장이 같은 숫자를 다시 셌다. "A — B"로 이어 붙이는 구조도 함께 걷었다.

| 상태 | 이전 | 지금 |
|------|------|------|
| queued | 연결 테스트 요청됨 — 시작을 기다리고 있어요 | 연결 테스트 시작을 기다리고 있어요 |
| success (ok=total) | 리소스 N개 모두 연결에 성공했어요 | 모든 리소스가 연결에 성공했어요 |
| success (0<ok<total) | 리소스 N개 중 M개 연결 성공 — 나머지 K건은 결과가 확인되지 않았어요 | 일부 리소스는 연결 결과가 확인되지 않았어요 |
| success (ok=0) | (위와 같은 문장 — "0개 성공") | 연결 결과가 확인된 리소스가 없어요 |
| fail (fail>0) | 리소스 N개 중 M개 연결 성공 — 실패 K건을 점검해 주세요 | 연결에 실패한 리소스가 있어요 |
| fail (fail=0) | 연결 테스트가 실패했어요 — 다시 수행해 주세요 | 연결 테스트가 실패했어요 |

`ok === 0` 분기를 새로 갈랐다 — 하나도 확인되지 않은 정착을 "일부"라고 부르면 실제보다 나아 보인다.
행동 지시("점검해 주세요", "다시 수행해 주세요")는 슬롯 CTA가 이미 든다.

비교표 근거: 다섯 시안 중 **Q1~Q5를 모두 채우면서 비용이 S대에 머무는 유일한 칸**. 새 부품은 점 하나와 아이콘 하나뿐이고
색은 전부 기존 `fillColor` 재사용이다.

## 실제 차용한 레퍼런스

| 레퍼런스 | 빌린 요소 | URL |
|----------|----------|-----|
| Argo CD ApplicationSet UI | 심각도 아이콘 + 개수 쌍을 한 바에. 집계와 개별 노드가 **같은 아이콘 어휘** | https://argo-cd.readthedocs.io/en/latest/user-guide/application-set-ui/ |
| IBM Carbon Status indicator | 주의 3계급 + "5~6개를 넘으면 집중이 어려워진다" 상한, 중요하지 않으면 일반 텍스트로 강등 | https://v10.carbondesignsystem.com/patterns/status-indicator-pattern/ |
| AWS Cloudscape Status indicator | 아이콘+색+텍스트 삼중, 중립 상태는 전부 회색 / `in-progress`는 **정적 아이콘**(글리프를 돌리지 않는 근거) | https://cloudscape.design/components/status-indicator/ |
| Linear Project graph | 정확한 n/m은 상시 노출 등급이 아니다(hover) — `보고됨 N/M` 삭제의 근거 | https://linear.app/docs/project-graph |
| NN/g Icon usability | 아이콘 옆엔 항상 텍스트 라벨 — 점만 남기려는 유혹의 차단선 | https://www.nngroup.com/articles/icon-usability/ |
| GitHub Primer — Motion & animation | "Avoid using animation to convey information" — 얼려도 읽혀야 한다 | https://primer.style/accessibility/design-guidance/motion-and-animation/ |
| IBM Carbon Loading | small 변형에서 획을 **두껍게**(16 vs 10) — 15px 글리프의 획 2.4 근거 | https://carbondesignsystem.com/components/loading/usage/ |

전체 카탈로그(제품 7 + 디자인 시스템 8 + 글리프 8)와 시안 A·D·E 비교는 아티팩트 참조.

## 기각

- **시안 D(유닛 도트 스트립).** 리소스 수에 상한이 없어 큰 N에서 반드시 폴백 표현이 하나 더 생긴다 — 한 화면에 문법 두 벌은
  1라운드가 없애려던 문제 그 자체. Datadog Host Map이 그 형태가 **전용 화면**에서만 성립함을 보인다.
- **시안 E(진행 중엔 한 개념만).** 진행 중의 `실패 0`이 사라져 "실패 없음"과 "아직 모름"이 같은 침묵이 된다.
  CircleCI의 0값 침묵은 *정착한* 결과에서의 이야기다.
- **시안 A(집계를 바 옆으로).** Q1만 닫고 Q2·Q3·Q5가 남는다. B가 같은 비용으로 넷을 닫는다.

## 구현 노트

- 새 토큰: `connProgress.countList/countSeg/countValue/countDot/countDotColor/countDotMissing`. 점 색은 `fillColor`와 같은 값이라
  줄과 바가 항상 같이 움직인다 — 한쪽만 바꾸면 범례가 거짓말이 된다.
- `ActivityIcon`의 모션은 `@keyframes tc-activity-march`(globals.css) + `tcActivityMarch` 토큰. dasharray `9 26`은 path 길이 ≈35 기준이라,
  파형 `d`를 바꾸면 dasharray와 keyframe의 35도 같이 재야 한다.
- `ConnectionTestCard.test.tsx`의 FAIL 케이스는 `실패` 조회를 표 안으로 좁혔다. 카운트 줄 범례가 그 단어를 제 텍스트 노드로 갖게 됐기 때문.
- 후속(범위 밖): admin `StatusPill`의 `loader`는 **트랙 없는 270° 아크**다. 트랙과 270°를 짝지은 디자인 시스템은 한 곳도 없고,
  이 앱에서 정지 가독성이 가장 나쁜 글리프로 남는다.
