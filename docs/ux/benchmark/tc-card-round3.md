# 연결 테스트 카드 3차 — 상태 구동 CTA 슬롯 (시안 A 채택)

- **일자**: 2026-08-16 (리서치) / 2026-08-17 (구현)
- **대상 화면**: Step 5 연결 테스트 카드 — 클라우드 `ConnectionTestCard` + IDC `IdcStep5ConnectionTest` (공유 표면 `TcSummaryCard`)
- **아티팩트**: https://claude.ai/code/artifact/369df04a-d767-419b-800e-7e7623213e0c
- **구현 PR**: #714

## 문제 요약 (진단 C1~C5)

| # | 진단 | 등급 |
|---|---|---|
| C1 | 상태 한 곳·행동 두 곳 — 스트립은 본문, Run Test는 헤더 우상단(soft), 완료 승인 요청은 하단 액션바. 재실행 필요 칩이 시키는 일과 그 버튼이 화면 반대편 | UX 원칙 (근접성) |
| C2 | completion-status enum 4값 중 2개만 소비 — `useTcCompletionStatus`가 CONFIRMED를 읽고 버림, 시각 2필드 미사용 | 수치 위반 (계약 대비) |
| C3 | runDisabled 사유 침묵 — opacity-45만, 고정 hint 문장 | UX 원칙 (상태 언어화) |
| C4 | latest-results 산출물이 승인 모달 안에만 — 결정하는 카드 표면에 없음 | 제안 |
| C5 | "지금 할 일" 미지목 — 어떤 상태에서도 카드가 다음 행동을 지목하지 않음 | UX 원칙 |

## 실제 차용한 레퍼런스 (시안 A 기준)

| 레퍼런스 | URL | 차용 요소 |
|---|---|---|
| AWS DMS — Test connections 탭 | https://docs.aws.amazon.com/dms/latest/userguide/CHAP_Endpoints.Creating.html | Run 버튼이 결과 표면 안에 산다 (값싼 반복 실행은 결과와 동거) |
| Fivetran — 실행 버튼 비용 분리 | https://fivetran.com/docs/getting-started/faq/manual-sync-affects-scheduled | 값싼 Sync는 overview 우상단, 파괴적 Resync만 카드 밖 — Run Test는 전자 |
| GitHub — PR 머지박스 | https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/merging-a-pull-request | 상태 상자가 상태별 대체 CTA를 치환해 든다 (잠긴 primary 대신) |
| HCP Terraform — Confirm & Apply | https://developer.hashicorp.com/terraform/cloud-docs/run/ui | 전이 CTA가 상태 패널 안에서 열린다 (Needs Confirmation) |
| GitLab — MR 위젯 변형 규칙 | https://docs.gitlab.com/user/project/merge_requests/widgets/ | 불가능=비활성 / 위험=활성+변형 — 상태별 버튼 문법 |

## 채택안: 시안 A — 상태 구동 CTA 슬롯

요약 스트립 counts 줄 우측이 **상태의 정답 행동 1개**를 든다. `foldTcCardState(run phase × completion 판정)` → 6상태:

| 카드 상태 | 표면 | 슬롯 |
|---|---|---|
| 미실행 | idle | Run Test (primarySm) |
| 진행 중 | running | 진행 중… (softSm 잠김) |
| 실패 정착 | fail | 다시 실행 |
| 성공 정착 | success | 다시 실행(링크) + 완료 승인 요청 |
| 정책 변경 | pending (첫 사용) | 다시 실행 |
| 확인 완료 | success | 없음 — 봉인, 이력만 |

헤더 Run Test와 하단 CardActionBar는 제거. **C-1 기각판례와의 화해**: "반복 액션 강등, primary는 승인 하나"의 전제는 두 CTA가 동시에 보이던 화면 — 시점당 primary 1개가 되면 전제가 소멸한다 (재개봉 아님, 사유째 기록).

### 비교표 근거 (아티팩트 §6)

시안 A는 C1·C5를 정면으로 닫고, C2를 부분(판정 상태 편입) 해소. 추천은 "B 토대 → A, C·D 동회차"였으나 오너가 A 단독 채택 — A에 필요한 토대(판정 접기·시각 노출)만 훅 확장으로 동반하고, fetch 게이트 해제(시안 B 고유 비용)와 latest-results 집계(시안 C)·게이트 문장 전면 언어화(시안 D)는 미채택.

### 수치 출처

- 슬롯 버튼 32px/rounded-10/13px = `triggerBtn.ghostSm` 골격에 primary/soft 면 (`primarySm`/`softSm` 토큰 신설)
- 표면 5종 = `connProgress.state` 실측 (pending은 선언만 되고 미사용이던 것을 정책 변경 상태가 처음 사용)
- 정책 변경 meta·안내 줄 = `connProgress.countsWarn` (orange-800) — #6B7684 on #FFF8EC 4.37:1 AA 미달 실측으로 교체

### 의도적 목업 이탈 (PR 설명 동일)

- 슬롯 위치는 전 상태 counts 줄 우측 고정 (목업의 idle만 헤더 우측이던 것 통일)
- 실행 이력 링크는 실행이 있는 모든 상태에서 meta 옆 유지
- 성공 counts의 논리 DB 집계 줄은 시안 C 소관 — 미포함
- CONFIRMED 확인 시각은 history API 소관(시안 B 비용) — "실행 #N 결과 기준"만 표기

## 확장 (2026-08-17, 오너 피드백): PENDING(시작 대기) 분리

오너 지적: 실행 라이프사이클은 PENDING → RUNNING → SUCCESS/FAIL 인데 top-level PENDING 이
표현되지 않았고, PENDING→RUNNING 전이와 PENDING→FAIL(무보고 실패) 경로도 화면에 없었다.
기존 구현은 `computeUIState` 가 wire PENDING/RUNNING 을 UI 상태 하나로 접어서, 접수만 된
실행이 "진행 중 — 0/6 보고됨" + 빈 0% 바로 그려졌다(멈춘 인상). 목은 살아있는 job 을 무조건
RUNNING 으로 투사해 top-level PENDING 프레임이 아예 나오지 않았다.

### 결정

- **uiState 5값 분리**: `IDLE | QUEUED | RUNNING | SUCCESS | FAIL`. 게이트는 `isInFlightUi`
  (QUEUED+RUNNING) 한 사실로 답한다 — 호출부 조립 금지 규칙 유지.
- **`TcRunPhase` 에 `queued` 추가**. 카드 표면은 running 과 공유(경고가 아니라 정상 단계) —
  세 채널이 단계를 가른다: 아이콘 스핀 없음 / 진행 트랙 없음 / 문장 "연결 테스트 요청됨 —
  시작을 기다리고 있어요". 슬롯은 "시작 대기…" 잠김. counts 줄은 idle 과 같은 "대상 리소스
  N개" — 보고 0건을 카운트로 그리면 전부 "미보고"(정착 실행의 이상 신호 어휘)가 된다.
- **전이가 곧 연출**: PENDING→RUNNING 순간 스핀 시작·트랙 등장·문장 교체가 동시에 일어난다.
  별도 애니메이션 없음(GitHub Actions·Vercel 의 Queued→In progress 문법).
- **PENDING→FAIL**: fail 문장 분기 추가 — `fail===0 && reported===0` 이면 "결과가 보고되기
  전에 실패로 끝났어요 — 다시 실행해 주세요". 원인(에이전트 미응답 등)은 계약에 없으므로
  단정하지 않는다.
- **어휘 분리**: counts 줄의 "대기 N"은 유닛 단위 PENDING — top-level 은 "시작 대기"로
  가른다. TcHeaderTag 도 PENDING 을 "테스트 시작 대기"로 분리(기존엔 "테스트 진행 중").

### 목 지원

- 라이브: `DISPATCH_MS` 4초 — 트리거 직후 top-level PENDING + 전 agent PENDING, 창이 지나면
  RUNNING (첫 리소스 정착 5초보다 짧게).
- 고정 fixture: **2107** 시작 대기(결과 0건 + 스케줄 전부 2099, fixture id 로 창 고정),
  **2108** 무보고 실패(FAIL 정착 + agent 목록 빈 배열). TC_CARD_FIXTURE 2101~2108.
