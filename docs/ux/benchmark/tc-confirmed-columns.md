# 확정 정보 표 — 열 10개를 6개로

- **날짜**: 2026-08-21
- **대상**: `admin/pipelines/ops/target-sources/[id]?tab=tc` → 확정 정보 카드의 리소스 표
- **아티팩트**: https://claude.ai/code/artifact/8fa6ef35-3b16-4a3c-b16a-814064a5ba8a (진단 10 · 레퍼런스 13 · 시안 5)
- **PR**: #729 (`feat/tc-latest-pod`)

## 1. 문제 (2026-08-20 실측, target-source 2103, 창 1333px)

| # | 등급 | 문제 | 근거 |
|---|------|------|------|
| D1 | 수치 | 표 1522px 가 프레임 1370px 를 **152px 초과** — Credential 열(226px)이 접힌 채 화면이 열린다 | `getBoundingClientRect()` |
| D2 | 원칙 | 열 10개 = Cloudscape 의 "중요 열 5개 이하" 의 2배 | 레퍼런스 1 |
| D3 | 수치 | 논리 DB 두 열(240px)이 12칸 전부 `—`. 건수는 **최신 실행이 SUCCESS 일 때만** 생성되므로(`toLatestResultSummaries`), 실패를 조사하러 온 화면에서 두 열은 **언제나** 빈칸 | 코드 + DOM 카운트 |
| D4 | 수치 | 본문 60칸 중 22칸(37%)이 `—` | DOM 카운트 |
| D5 | 원칙 | 한 질문(붙었나)에 세 열이 답하는데 채워지는 밀도가 제각각(6/6 · 2/6 · 5/6) | 실측 |
| D6 | 원칙 | 읽는 열과 만지는 열이 섞임 — Credential 은 쓰기 진입점인데 판정 열과 같은 등급 | PatternFly |
| D7 | 수치 | Resource ID 가 Name 과 같은 236px 를 쓰고도 ARN 이 잘린다 | 실측 |
| D8 | 원칙 | chevron 은 Athena 리전 접기 전용 — 상세 확장에 재사용하면 한 글리프가 두 뜻 | 코드 |
| D9 | 의견 | 행 76px × 6행 = 550px, 표 하나가 첫 화면을 먹는다 | 실측 |
| D10 | 의견 | 이 개편으로 **API 호출은 줄지 않는다** — 논리 DB 건수(`latest-results`)는 관리자 승인 탭 게이트(`tcResultStats`)와 같은 응답 | 코드 |

## 2. Lazy 의 세 갈래 (조사 결론)

1. **시선 lazy** — progressive disclosure(Nielsen 1995): 부차적인 것은 다음 단으로. 단, **두 단까지**.
2. **시각 lazy** — details-on-demand(Shneiderman 1996): overview → zoom/filter → 상세.
3. **요청 lazy** — 열 때 부르기. **이 탭은 이미 하고 있다**(Pod 로그·논리 DB 모달). D10 때문에 이번 작업의 이득은 ①②지 ③이 아니다.

도출 규칙 중 실제로 코드를 정한 것:

- **R1** 행이 답하는 질문은 하나 — "이게 무엇이고, 지금 붙는가".
- **R3** 상태에 종속된 값은 열이 아니다(논리 DB).
- **R4** 정체는 강등 대상이 아니다 — 접되 숨기지 않는다(Resource ID → 이름 아래).
- **R7** 빈칸은 "없음"이 아니라 "모름"일 수 있다 — pod 부재는 실행이 열려 있으면 "아직", 끝났으면 "영영"이다.

## 3. 레퍼런스 (실제로 가져온 것만)

| 제품 | URL | 가져온 것 |
|------|-----|-----------|
| AWS Cloudscape — Split view | https://cloudscape.design/patterns/resource-management/view/split-view/ | "중요 열 5개 이하" 상한 (D2 의 기준) |
| AWS Cloudscape — Secondary panels | https://cloudscape.design/patterns/general/secondary-panels/ | 표면 최대 3~4개 — 이 탭엔 이미 모달이 셋이라 **새 표면 추가가 그 자체로 비용** |
| PatternFly — Table guidelines | https://www.patternfly.org/components/table/design-guidelines | 액션은 마지막 열 / 확장은 "행에 안 들어가는 정보"용 |
| NN/g — Progressive Disclosure | https://www.nngroup.com/articles/progressive-disclosure/ | 2단 상한 → 상세 모달 안에서 로그 모달을 여는 시안 D 탈락 |
| Google Cloud Logging — Logs Explorer | https://docs.cloud.google.com/logging/docs/view/logs-explorer-interface | 리소스는 **이름 크게 · ID 작게 한 칸** (D7 의 해법) |
| Datadog — Log side panel | https://docs.datadoghq.com/logs/explorer/side_panel/ | 맥락(위) / 내용(아래) 2단 |
| Sentry — Issue stream | https://docs.sentry.io/product/issues/ | 행은 세 가지만, 나머지는 상세 |

## 4. 채택 — 시안 A 가 아니라 "열 겹치기"

아티팩트의 추천은 **A(행 확장)** 였다. 오너 결정(2026-08-21)은 다르다:

> "databaseType, Region을 같은 행으로 표현해볼까? credential 설정, pod 로그 보기는 행으로 노출되어야 할듯 …
> 우선은 리소스 행 확장 없이 이대로 구현해보자"

- ⛔ **행 확장(시안 A) 기각** — chevron 은 Athena 리전 접기 그대로 둔다(D8 은 회피가 아니라 유지로 풀렸다).
- ⛔ **상세 모달(시안 D)·열 선택기(시안 E) 미채택.**
- Credential 과 Pod 로그는 **행에 남는다** — 강등 대상이 아니다.

**대신 열을 지우지 않고 겹쳤다.** 같은 질문에 답하는 값끼리 한 칸 두 단으로:

| 열 | 위 | 아래 |
|----|-----|------|
| Resource Name (IDC: 접속 주소) | 종류 태그 + 이름 | Resource ID |
| Database Type · Region | 타입 | 리전 (IDC 는 없음) |
| 연결 상태 | 판정 알약 | 실패 사유 한국어 + 원문 enum |
| Pod 로그 | 로그 조회 / 수집 중 … / Pod 생성 전 / Pod 없음 | pod_id |
| 연동 논리 DB | 대상 건수(링크) | 제외 건수 |
| Credential | 값 + 수정 | — |

10열 → **6열**, 표 1522 → **1216px**(프레임 안), 사라진 사실 0개.

## 5. 구현 메모

- **pod_id 노출**(오너 요청) — 액션 아래 mono 12px. pod 가 없을 때 하는 말은 **두 가지**다: 실행이 열려 있으면(PENDING/RUNNING) `Pod 생성 전`, 끝났는데 없으면(POD_CREATION_FAILED) `Pod 없음`. 한 문장으로 합치면 이미 끝난 실패에게 기다리라고 말하게 된다. 보고 자체가 없는 행은 `—`(무보고 ≠ pod 부재).
- **논리 DB 두 열 → 한 칸** — 두 값은 같은 응답의 같은 게이트에서 오므로 한쪽만 채워지는 행이 없다. 건수 링크가 **관리 모달의 유일한 진입점**이라 열을 통째로 없앨 수는 없었다.
- **`stackedIdentityLift`(PR #663) 제거** — 그 보정은 한 줄짜리 이웃과 이름을 맞추려던 장치인데, 이제 모든 칸이 스택이라 `align-middle` 이 알아서 중심선을 만든다. 한쪽만 끌어올리면 오히려 어긋난다.
- **보조 줄 색은 `--pl-text-weak`** — `--pl-text-faint`(#98A2B3)는 흰 면에서 2.5:1 로 AA 미달이라 새 줄에 쓰지 않는다(design guard 가 막는다).
- 라이브 확인(mock 2103): 실행을 돌려 **대기 → 진행 중 → 성공/실패** 전이를 관측하고 네 가지 pod 문구와 `12개 / 제외 3개`, 관리 모달 진입까지 왕복.
- ⚠️ 관찰(범위 밖): 행의 건수(`latest-results` 의 결정적 placeholder)와 논리 DB 관리 모달의 목록 건수가 목에서 서로 다르다. 실데이터에서는 같은 도메인에서 오지만, 목을 근거로 화면을 판단할 때 주의.

## 6. 교차 리뷰 반영 (2026-08-21, Codex gpt-5.6-terra + Opus)

두 리뷰가 각각 잡은 결함 — 둘 다 **화면이 계약보다 많이 말한** 자리였다.

- **진행률 분모가 결과 단위가 아니라 확정 행이었다**(Codex). Athena 리전 하나에 데이터베이스가
  셋이면 결과는 한 건인데 분모는 셋을 세어, 밴드가 `5/7` 에서 멈춘다. 같은 밴드의 요약문은
  이미 단위로 세고 있었으니 한 카드가 두 어휘를 쓰고 있던 셈. `toConfirmedUnits(...).length`
  로 교체 — 사용자 화면 Step 5(`ConnectionTestCard`)가 같은 오산을 먼저 겪고 고쳐 둔 자리다.
- **pod_id 부재를 "Pod 없음"으로 읽었다**(Opus). `pod_id` 는 DRAFT 라 실계약 응답에는 없다.
  값이 없다는 것만 보고 문구를 찍으면 **정상적으로 끝난 모든 행**이 "pod 가 안 떴다"고 말하고,
  각주가 그 문구를 POD_CREATION_FAILED 에 묶어 두었으니 운영자는 그대로 읽는다. 영영 없다는
  말은 사유가 POD_CREATION_FAILED 일 때만 — 나머지는 `—`(모름). 판정은 `podLogState` 한 곳.
- **합친 칸이 제외 건수를 삼켰다**(Opus). 두 필드 다 계약에서 optional 인데 `included == null`
  이면 통째로 `—` 였다. 게이트가 같다고 두 값이 늘 함께 오는 것은 아니다.
- 접힌 리전 행이 **첫 데이터베이스의 이름표**로 모달을 열던 것, 그 행의 리전 id 를 **검색이
  못 찾던 것**(`…:region/catalog` 는 자식 id 의 부분 문자열이 아니다)도 같이.

**기각한 지적**: contract-check FAIL(이미 머지된 #739·#734 도 같은 이유로 실패 — swagger 미편집을
PR 본문에 적는 것이 이 스크립트의 처리 방식) · `useModal()` 미사용(이 디렉터리 관례는 `useState`)
· 한국어 주석(main 995개 중 202개, 이 디렉터리 관례).

**남긴 것**: `ConfirmedInfoCard` 835줄(AP-B1 위반이나 main 에 더 큰 파일 5개, 분할은 별건) ·
JobViewer 와 리사이즈 그립 SVG 중복 · `connection_status` 가 빈 문자열인 agent 가 UNKNOWN 이
아니라 무보고로 떨어지는 것(`foldAgentStatuses` 는 사용자 화면 3곳이 함께 쓴다).
