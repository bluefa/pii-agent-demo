# 최초 연동 도장 — 완료를 표식으로 말하기

- **날짜**: 2026-08-18 (문구·출처 정정 2026-08-19)
- **대상**: 서비스 운영 상세의 Target Source 카드(`/pass/admin/pipelines/ops/services/{code}`) ·
  Target Source 운영 상세 헤더(`/pass/admin/pipelines/ops/target-sources/{id}`)
- **아티팩트**: 1R(정보구조) <https://claude.ai/code/artifact/f2212ea7-642d-461a-b8d0-cf589b8fc962> ·
  2R(표현 요소) <https://claude.ai/code/artifact/2711f1c1-4c71-4174-836e-04853a70a02a>
- **구현 PR**: #728

## 1. 왜 했나

"이 계정은 연동이 완료된 계정"임을 운영 화면에서 눈에 띄게 보여 달라는 요청.
1R 은 정보구조(태그·알약)로 답했는데 오너가 두 번 되돌렸다 —
"태그 말고 조금 더 과장되게", 그다음 "여전히 완료된 느낌이 안 든다. 깃발 같은 표현도 좋다.
너무 simple 하다. **완료에 집중하라**".

## 2. 어느 값이 "연동 완료"인가 — 두 번 뒤집힌 자리

요청은 `piiAgentFirstInstalledAt` 을 노출해 달라는 것이었다. 처음에는 그 필드를 **기각**했다.
"그건 최초 설치이지 연동이 끝난 시각이 아니다"라는 이유였다. 그 판단은 **틀렸고, 뒤집혔다.**

무엇이 바뀌었나 — 오너가 물은 질문이 바꿨다. **"초기화(`resetTargetSource`)로 1단계까지
되돌아갈 수 있는데, '연동 완료'라고만 쓰면 헷갈리지 않겠나?"**

그 질문이 두 사실을 갈라 놓는다.

| 값 | 말하는 것 | 초기화하면 | 출처 |
|---|---|---|---|
| `status_changed_at` (@ `COMPLETED`) | **지금** 완료 상태다 | 사라진다 (IDLE 로 감) | `GET /process-statuses` (`getCurrentStatuses`) |
| `piiAgentFirstInstalledAt` | **최초 1회** 연동을 마친 적 있다 | 남는다 (움직이지 않음) | `TargetSourceInfo` · `TargetSourceDetail` 등 |

화면이 답해야 하는 질문은 "이 계정은 연동이 완료된 계정인가"였고, 그건 **두 번째** 줄이다.
초기화되어 다시 3단계를 밟는 대상도 "연동을 마친 적 있는 계정"이다. 그래서 도장은
`piiAgentFirstInstalledAt` 을 쓰고, 문구도 그 사실에 맞춰 **"최초 1회 연동 완료"** 라고 적는다.

첫 판단이 틀린 이유는 두 가지였다.

1. **계약이 그 필드에 설명을 안 달았다.** swagger 는 `type: string / format: date-time` 뿐이다.
   "최초 설치라 완료와 다르다"는 것은 필드 이름에서 읽은 추론이었고, 추론을 사실처럼 적었다.
   불변성은 오너가 도메인 지식으로 확인해 줬다.
2. **`piiAgentFirstInstalledAt` 을 grep 으로 못 찾았다.** `firstInstalledAt` 으로 뒤져서
   대문자 F 인 `piiAgentFirstInstalledAt` 이 0건으로 나왔고, "상세에만 있는 필드"라고 단정했다.
   실제로는 `TargetSourceInfo`(목록)·`TargetSourceResponse`·`TargetSourceMetadataResponse`·
   `TargetSourceDetail` 네 곳에 있다 — **두 화면이 이미 부르는 응답에 다 실려 있었다.**

부수적으로 확인한 함정 하나는 그대로 유효하다: `GET /target-sources/{id}/process-status`
(`getProcessStatus`) 는 계약 설명이 "AWS, SDU, IDC TargetSource는 IDLE 상태를 반환합니다"라고
적어 두었다. 어떤 완료 판정도 그 응답으로 가르면 안 된다.

## 3. 진단

| # | 문제 | 등급 |
|---|---|---|
| 1 | 완료 시각이 어느 화면에도 없다 — 계약에 있는데 코드에 소비처가 0곳 | 사실 |
| 2 | "끝났다"를 말하는 **형태**가 앱에 없다 — `StepPill` 은 7단계를 같은 알약으로 그리고 색만 다르다 | UX 원칙 |
| 3 | 서비스 운영 목록에는 단계 표시 자체가 없다(오너 결정) — 완료 여부를 알 방법이 없다 | 사실 |
| 4 | 서체 대비 채널이 없다 — `--pl-font-mono: var(--pl-font-sans)` (PR #641) | 수치 위반 아님 / 제약 |
| 5 | 카드 높이가 120px 로 못 박혀 있어(LIN-92) 세로 예산이 0 | 제약 |
| 6 | 카드 hover 가 보라 `#F3EEFF` — 색 면을 쓰는 표식은 그 상태에서 부딪힌다 | UX 원칙 |
| 7 | 완료가 "축하"로 읽히면 장애 쫓아 들어온 운영자 화면에 상패가 늘어선다 | 제안 |

## 4. 실제로 쓴 레퍼런스 (21종 중 채택안에 실제로 반영된 것)

| # | 레퍼런스 | URL | 가져온 것 | 확인 |
|---|---|---|---|---|
| 14 | 영수증·인보이스 "PAID" 도장 | <https://stampmypdfs.com/blog/how-to-mark-invoices-paid> | **날짜가 들어가면 도장은 선언이 아니라 기록이 된다** — 완료 문구와 완료 시각을 한 덩어리로 | 스니펫 |
| 15 | GitHub — Verified 커밋 배지 | <https://docs.github.com/en/authentication/managing-commit-signature-verification/about-commit-signature-verification> | Unverified 가 있어야 Verified 가 의미를 갖는다 → **기록이 있는 대상에만 찍는다** | 스니펫 |
| 01 | Ant Design — Statistic | <https://ant.design/components/statistic/> | 강조 숫자의 기본은 24px — 46px 급 활자를 기각한 근거 | 확인함 |
| 10 | Material 3 — Display 타입 스케일 | <https://m3.material.io/styles/typography/type-scale-tokens> | 목록 20px / 상세 24px 의 두 단 | 기억 기반 |
| 17 | shields.io — 상태 배지 | <https://shields.io/badges> | 라벨+값 2단이 12px 한 줄로는 "simple" 을 못 벗어난다(반증 레퍼런스) | 확인함 |
| 20 | Material 3 · MUI — Badge 가이드 | <https://m3.material.io/components/badges/guidelines> | 배지는 주의를 끄는 물건이지 성취를 말하는 물건이 아니다 → J·F 기각 근거 | 스니펫 |
| 03 | Atlassian Statuspage — 90일 가동 이력 | <https://support.atlassian.com/statuspage/docs/display-historical-uptime-of-components/> | 상태와 이력은 다른 축이라는 확인 | 확인함 |
| 13 | GitHub Primer — RelativeTime | <https://primer.style/components/relative-time> | 절대 시각은 `title` 로 남기고 표면에는 짧게 | 이전 세션 확인 |

전체 21종(확인함 6·스니펫 11·기억 기반 3·이전 세션 확인 1, 반증 2)은 아티팩트에 있다.

## 5. 채택 — 시안 G 도장

흰 면 + 2px 초록 획(`--pl-ok-text` `#027A48`) + 옅은 안쪽 링(`--pl-ok-border`) + **회전 −4°**.
문구 12px/700 `최초 1회 연동 완료`, 날짜 20px/700(상세 24px), `tabular-nums`.

비교표의 네 축(완료 인상 · 날짜 포함 · hover 안전 · 정직성)을 동시에 만족하는 유일한 안이었다.

- **날짜를 품는다** — 레퍼런스 14. 선언과 시각이 두 요소로 흩어지지 않는다.
- **흰 면 + 색 획** — 카드 hover 가 보라라 색 면은 부딪힌다. 이 저장소가 이미 검증한 조합이다.
- **회전은 `transform`** — 레이아웃 박스를 안 건드리므로 120px 예산을 한 픽셀도 안 쓴다.
- **값이 있을 때만** — `piiAgentFirstInstalledAt` 이 없으면 아무것도 안 그린다. 도장은
  긍정 표식이고, "아직 안 됐다"는 단계 알약이 말한다.

### 도장과 단계 알약은 겹치지 않는다

상세 헤더에는 둘이 같이 선다. 같은 말을 두 번 하는 것처럼 보이지만 축이 다르다 —
알약은 "지금 어디", 도장은 "마친 적 있다 · 언제". 초기화된 대상에서 그 차이가 눈에 보인다:
**알약은 1단계로 내려가고 도장은 남는다.** 그 조합(다시 연동 중이지만 처음은 아니다)이
이 화면이 말해야 하는 사실이고, 문구의 "1회"가 그것을 읽는 법을 알려 준다.

### 기각

| 시안 | 사유 |
|---|---|
| J 월계관 · F 인장 | 축하·자랑의 어휘. 운영 콘솔 톤과 어긋난다 (레퍼런스 20 반증) |
| K 2톤 배지 | 12px 한 줄이라 "너무 simple" 피드백이 그대로 재발 + 색 면 hover 충돌 |
| H 깃발 | 1층으로 돌아가 다섯 번째 칩이 된다 (1층은 이미 4칩으로 포화) |
| L 완료 링 | **7단계는 선형이 아니다** — 반려·정리 곁가지가 있어 원주 균등분할은 없는 진행률을 그린다 |
| D 시작 눈금 | 날짜별 상태 데이터가 계약에 없다 |
| 46px 급 활자 | Statistic 기본 24px, 이 앱 `pageTitle` 도 24px |

### 실측으로 뒤집힌 것

- **45° 위의 한국어는 안 읽힌다.** 코너 리본(I)은 가로·세로 예산을 0px 쓰지만 라틴 대문자와
  달리 한글은 글자마다 축이 달라진다. 쓰려면 글자를 빼고 색만 쓰거나 0°로 눕혀야 한다.
  우상단은 `운영 화면 ↗` 임자이기도 하다. → 선택 강화안으로만 남기고 구현하지 않았다.
- **도장 폭은 어림하면 안 된다.** 20px/700 tabular 로 `YYYY-MM-DD` 는 121.8px,
  도장 전체 151.6px, −4° 회전이 가로로 4.3px 더 번져 155.9px. 어림값 144px 로 잡았더니
  날짜가 두 줄로 접혔다. 슬롯은 160px. 문구 `최초 1회 연동 완료` 는 12px 에서 95.4px 이라
  폭을 정하지 않는다 — 도장 폭은 언제나 날짜가 정한다(실측 후 152.0 × 66.0 유지).

## 6. 구현

- 컴포넌트: `app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/CompletedStamp.tsx`
  (`CompletedStamp` = 표식, `CompletedStampSlot` = 폭을 예약하는 자리). 둘 다 순수 컴포넌트다 —
  스스로 조회하지 않는다.
- 값은 **두 화면이 이미 부르는 응답에 실려 온다.** 새 라우트도, 추가 왕복도 없다.
  - 목록: `/target-sources/page?serviceCode` → `TargetSourceInfo.piiAgentFirstInstalledAt` 를
    `admin/ops/services/{code}` 라우트가 `pii_agent_first_installed_at` 으로 실어 보낸다.
  - 상세: `GET /target-sources/{id}` → `TargetSourceDetail.pii_agent_first_installed_at`.
    헤더는 이미 이 응답(`detail`)을 prop 으로 받고 있었다.
- 계약이 같은 값을 응답마다 다른 철자로 싣는다(목록 camel · 상세 snake). `supportRawData` 와
  같은 자리의 함정이고, 두 홉을 각각 테스트가 잡는다.
- 목: 시드가 `piiAgentFirstInstalledAt` 을 주지 않으면 키를 **아예 안 싣는다**. null 로 채우면
  목이 "한 번도 마친 적 없다"를 단정하게 된다.

### 남은 것

- **도장이 없는 것은 "미완료"가 아니다.** 기록이 없는 것과 아직 안 끝난 것이 같은 그림이다.
  목록에는 단계 표시가 없으므로(진단 3) 이 표식은 **긍정 표식**으로만 읽어야 한다.
- 필드 이름은 `first **Installed** At` 이다. 그것이 4단계(설치)를 처음 지난 때인지 7단계
  (연동 완료)인지는 계약이 적어 두지 않았다 — 오너가 "재설치해도 안 움직인다"를 확인해 줬고
  화면 문구는 그 어휘를 따랐다. 두 단계가 갈리는 것이 중요해지면 BFF 에 한 줄 물어야 한다.
- 목록 카드 2층의 가로 여유가 694 → 520px 로 줄어 Azure 의 36자 GUID 두 개가 더 짧게 잘린다
  (전문은 `title`).
- 완료 비율 실측이 필요하다 — 대상 대부분이 이미 완료면 도장이 벽지가 된다.
