# Step 4 설치 현황 — 전부 SKIP / 전부 BDC 대기 벤치마크 결정 기록

- **일자**: 2026-08-10
- **대상 화면**: Step 4 설치 현황 (`InstallStatusDetail` — Azure / GCP / IDC 레거시 레일 + AWS 그룹 레일)
- **아티팩트**: https://claude.ai/code/artifact/5cfff3c7-5860-4095-99d3-29ad5847ed23
  (진단 · 레퍼런스 10 · 시안 A/B/C)
- **채택**: 시안 A (집계 확장 + actionable 게이트 + 패널 빈 상태). 시안 B(요약 문장)·C(그룹 레일 이관)는 미채택.

## 문제 진단

오너 지적 두 건은 서로 다른 증상이지만 발원지가 하나다 — `aggregateCells` / `kindOfValue` 가
계약의 6값(`InstallStepValue`)을 UI 4값(`AggregateKind`)으로 접는 지점.

| 계약값 | 접힌 곳 | 결과 |
|---|---|---|
| `COMPLETED` | `done` | 정상 |
| `FAIL` | `failed` | 정상 |
| `IN_PROGRESS` | `running` | 정상 |
| `UNKNOWN` | `waiting` | 정상 |
| **`SKIP`** | **`done`** | 전부-SKIP 단계가 레일에서 `완료 12/12` 로 읽힌다. "다 했다"와 "할 게 없었다"가 같은 문장이 된다. 패널을 열면 `해당 없음` 12행 표에 검색·필터·페이지네이션까지 붙어, 훑을 것이 있다고 말한다. |
| **`BDC_INSTALL_REQUIRED`** | **`waiting`** | `InstallTableStep.serviceAction` 은 **정적 선언**이라 셀이 무엇이든 항상 참이다. `actionable` 이 그 정적 값과 `kind !== 'done'` 만 보므로, 전부-BDC-대기인 서비스측 단계가 요약에서 `지금 서비스 측에서 확인이 필요합니다` 로 올라오고 조치 문구가 18px — 그 패널에서 가장 큰 글자 — 로 찍힌다. 지금 할 수 있는 일이 없는데도. |

두 증상 모두 화면이 멀쩡해 보인다(에러도, 빈 화면도 아니다). 그래서 테스트로만 잡힌다.

## 사용한 레퍼런스

| 축 | 레퍼런스 | 가져온 요소 |
|---|---|---|
| 해당 없음 ≠ 완료 | GitHub Actions (skipped ≠ success 아이콘·색 분리) | 상태 어휘를 성공과 분리 |
| | GitLab CI (`skipped` 파이프라인 상태) | 진행률 표기에서 개수를 떼는 처리 |
| | Terraform plan (`No changes. Infrastructure is up-to-date.`) | 표 대신 **문장 한 줄**로 닫는다 |
| | Datadog monitor `No Data` | "값이 없다"를 별도 상태로 승격 |
| 남의 차례 ≠ 내 차례 | GitHub PR checks (`Waiting for status to be reported`) | 대기 사유를 주체와 함께 |
| | Stripe (`Pending — action required by Stripe`) | 주체가 문장의 주어 |
| | AWS ACM (`Pending validation`) | 조치 문구를 조치 가능할 때만 |
| | Vercel (`Queued` vs `Building`) | 큐 대기와 실행 중을 다른 단어로 |
| 사내 선례 | AWS 그룹 레일 `내가 할 일 (0) · 모두 완료` (PR #682) | 0 을 "비었다"가 아니라 "닫혔다"로 |
| | Step 2 반려 사유 3px 룰 | 조치 블록의 크기 계층 (12px 태그 / 18px payload) |

## 채택안 — 시안 A

1. **`AggregateKind` 를 4 → 6 으로 넓힌다.** `na`(셀 전부 SKIP) · `blocked`(미완료 셀 전부
   `BDC_INSTALL_REQUIRED`). 표현을 새로 만든 게 아니라 계약이 이미 구분하던 개념을 되살린 것이다.
   판정 순서는 `failed → running → na → done → blocked → waiting` — `na` 가 `done` **앞**이어야
   한다. `SKIP` 은 `isSettledInstallStatus` 가 settled 로 세므로, 뒤에 두면 전부-SKIP 이 `완료` 로 샌다.
2. **라벨은 계약 라벨을 그대로 쓴다.** `INSTALL_STATUS_LABEL.SKIP`(`해당 없음`) ·
   `INSTALL_STATUS_LABEL.BDC_INSTALL_REQUIRED`(`BDC 설치 대기`). 단계 라벨을 새로 지으면
   같은 상태를 행에서는 A, 레일에서는 B로 부르게 된다.
3. **`na` 에는 개수를 달지 않는다** (`count: null`). 세는 대상이 없는데 `해당 없음 12/12` 는
   진척으로 읽힌다. `blocked` 는 개수를 남긴다 — 기다리는 건수는 실제 사실이다.
4. **색·굵기는 그대로 조용하다.** `na`·`blocked` 모두 `textColors.secondary` + `font-normal`.
   레일 표면이 `bgColors.panel`(gray-100) 이라 `tertiary`(gray-500)는 4.37:1 로 AA 미달 —
   기존 `done`/`waiting` 과 같은 톤을 쓴다. 굵기 판정은 `NAV_STATUS_WEIGHT` 맵으로 옮겼다
   (`kind === 'done' || kind === 'waiting'` 부정형은 새 kind 를 조용히 굵게 만들었다).
5. **`actionable` 게이트를 허용 목록으로.** `OPEN_KINDS = ['failed','running','waiting']`.
   `kind !== 'done'` 부정형이던 자리 — 새로 생긴 kind 가 자동으로 "할 일"에 편입되는 형태였다.
   같은 이유로 그룹 레일의 `openTodoCount` 와 기본 선택(`hotStepId`)도 `isOpenKind` 로 바꿨다.
6. **패널: `na` 단계는 표 대신 `EmptyState variant="card"` — 단, 사유가 없을 때만.**
   `이 단계에 해당하는 리소스가 없어요` / `연동 대상 N건 모두 이 단계에 해당하지 않아, 수행할
   작업이 없습니다.` 표를 지우는 근거는 "같은 한 단어를 N행으로 반복한다"는 것이므로, 계약이
   `SKIP` 셀에 `guide` 를 실어 보내면 그 표는 반복이 아니라 내용이다 — 남긴다.
   AWS 가 그렇게 말한다(`설치 대상이 아닌 리소스입니다 (Read Replica).`, `lib/bff/mock/aws.ts`),
   Azure 의 VM 없는 SKIP 만 `guide: null` 이다. 그 사유가 사는 곳은 이 표뿐이다 —
   `views` 의 `reasons` 는 settled 셀을 건너뛰므로 요약으로도 새지 않는다.
   `blocked` 단계는 언제나 표를 유지한다: 행마다 계약이 준 `guide` 가 실제 내용이다.
7. **그룹 레일의 `모두 완료` 배지는 `openTodoCount === 0` 이 아니라 전부 `done` 일 때만.**
   `na`·`blocked` 도 카운트를 0 으로 만드는데, 그것까지 완료로 부르면 초록 배지 바로 아래
   행이 `BDC 설치 대기`라 적힌다 — 이 변경이 없애려던 거짓 문장이 행에서 그룹 헤더로
   자리만 옮긴 꼴이다. `(0)` 자체는 사실이므로 라벨과 색은 그대로 둔다.

## 미채택

- **시안 B (요약 문장).** "2개 단계는 해당하지 않고, 2개 단계는 BDC 진행을 기다립니다" 식으로
  *왜* 할 일이 없는지 말하는 안. A 만으로 거짓 문장은 사라지고, 기존 요약 문구
  (`지금 서비스 측에서 확인할 항목은 없어요…`)가 그 자리를 이미 메운다. 필요해지면 A 위에 얹는다.
- **시안 C (Azure/GCP/IDC 를 AWS 그룹 레일로 이관).** A 가 C 의 선행 조건이고, C 는 회귀 면적을
  3개 CSP 로 넓힌다. 별도 릴리스.

## 부작용 (의도된 것)

- **AWS `내가 할 일 (N)`** — 전부-BDC-대기인 todo 단계가 더 이상 열린 항목으로 세지 않는다
  (`manualInstall` 의 `service` 단계). 서비스 측이 자기 몫을 끝내 BDC 로 넘어간 상태이므로
  "내가 할 일"에서 빠지는 게 맞다. 그룹 레일 기본 선택도 같은 규칙을 따른다.
- **`kindOfValue` 는 손대지 않았다.** 단일 값 매핑이라 요약 지표(`전체/완료/진행중/실패`)와
  패널 단계 상태에 쓰인다. 여기서 `SKIP → na` 로 바꾸면 요약의 `완료` 숫자가 움직인다 —
  이번 변경은 **단계 표기 문제**이지 리소스 롤업 집계 문제가 아니므로 범위 밖으로 뒀다.

## 남은 결정 (오너)

`areInstallResourcesSettled` 는 여전히 `COMPLETED | SKIP` 을 settled 로 세므로, **모든 셀이
SKIP 인 대상**도 설치 완료로 판정되어 Step 5 로 자동 진행한다. 설치할 것이 하나도 없는 대상이
설치 완료인가 — 도메인 판단이라 이번 변경에서 건드리지 않았다.

## 가드

`InstallStatusDetail.na-blocked.test.tsx` (8 케이스: 레거시 레일 5 + 그룹 레일 3).
다섯 트립와이어를 각각 뮤테이션으로 확인했다 — 베이스라인 12/12 green 에서 아래 하나를
되돌릴 때마다 정확히 1건이 깨진다:

| 되돌리는 것 | 무너지는 문장 |
|---|---|
| `actionable` → `kind !== 'done'` | 전부-BDC 단계가 다시 "확인이 필요합니다"로 올라온다 |
| `naWithoutGuides` → `kind === 'na'` | SKIP 사유(Read Replica)를 빈 상태가 덮는다 |
| `todoAllDone` → `openTodoCount === 0` | `BDC 설치 대기` 행 위에 초록 `모두 완료` |
| `openTodoCount` → `kind !== 'done'` | 손댈 수 없는 단계가 `내가 할 일 (N)` 에 편입 |
| `hotStepId` → `kind !== 'done'` | 기본 선택이 손댈 수 없는 단계로 열린다 |

레거시 레일만으로는 뒤 세 줄에 닿지 못한다(그룹이 없으면 `todoSteps` 가 비어 inert). 그래서
그룹을 선언한 별도 픽스처를 둔다. 경계 케이스도 함께 잡는다 — 일부만 SKIP 이면 여전히
`완료 2/2`, 미완료 셀에 `UNKNOWN` 이 섞이면 `blocked` 가 아니라 기존 `대기`.

## 남긴 것 (리뷰에서 확인, 이번 범위 밖)

- **`blocked` 알약 색**: 단계 알약은 `tagStyles.neutral`(회색)인데 그 아래 행은 같은 단어를
  앰버로 쓴다(`WaitingApprovalTable` 의 선존 규칙). 레일에서 `blocked` 를 조용히 두는 것이
  이번 결정이므로 회색을 유지했다 — 행 색을 바꾸는 것은 별개 판단이다.
- **패널 단계(`perm`)**: `kindOfValue` 를 그대로 쓰므로 `BDC_INSTALL_REQUIRED` 가 오면
  여전히 `waiting`·`actionable` 이다. role 검증 단계에 그 값이 올 계약상 이유는 없지만
  타입으로는 도달 가능하다.
