# 운영 콘솔 · 인프라 작업 탭 재설계

- **일자**: 2026-08-09
- **대상 화면**: `/pass/admin/pipelines/ops/target-sources/{id}?tab=infra`
  (`PipelineTab` + `InfraStatusHead` + `TargetPipelineSections`)
- **아티팩트**: https://claude.ai/code/artifact/c60cd185-308e-4056-95c7-97cd8f782317
  (라운드 1 https://claude.ai/code/artifact/6e0b1f64-97c0-4200-8df8-798586120998 ·
  라운드 2 https://claude.ai/code/artifact/9c43ce52-df96-480f-bc23-6601a72917d2)

## 문제 진단

오너 지적을 이 탭이 실제로 맡는 세 가지 일 — **설치·삭제 실행 / 이력 확인 / 현재 Terraform 적용
상태 확인** — 기준으로 다시 정리한 결과.

| # | 문제 | 근거 | 등급 |
|---|------|------|------|
| P1 | 탭이 무엇을 하는 곳인지 어디에도 적혀 있지 않다 | 첫 제목이 `Terraform 설치 현황`(16px)이고 아래 두 섹션 제목도 16px — 탭 층위의 문장이 없다. 설명은 12px `text-faint` 캡션 3개로 흩어져 있었다 | UX 원칙 (계층) |
| P2 | 적용 상태가 접혀 있었다 | `InfraStatusHead` 의 `useState(false)` 로 기본 접힘. 계약 필드 `overall_state`·`checked_at` 은 어디에서도 렌더되지 않았다 | 수치 위반 (계약 미사용) |
| P3 | 상태 스트립이 한 줄 회색 덩어리로 읽혔다 | 태그·pill·날짜·링크가 모두 12px 한 줄에 붙어 있어 세 사실이 구분되지 않는다 | UX 원칙 (스캔) |
| P4 | 이력이 과하게 강조돼 있었다 | 8열 `min-w-[920px]` 가로 스크롤 표 — 그중 `유형`은 `작업` 셀과 **같은 `p.type`을 두 번** 렌더, `상세` 셰브론은 이미 `role="button"` 인 행과 중복, `진행도`는 성공 행에서 항상 꽉 참 | 수치 위반 + UX 원칙 |

라운드 1(카드 재배치) 은 오너 기각 — "정보가 많은데 카드만 옮기면 동시 노출량이 줄지 않는다".
채택안은 **설명의 총량을 늘리지 않고 위치만 올리는** 방향으로 다시 설계했다.

## 사용한 레퍼런스

| 레퍼런스 | URL | 가져온 요소 |
|---|---|---|
| AWS Cloudscape — details page with tabs | https://cloudscape.design/patterns/resource-management/details/details-page-with-tabs/ | 탭을 바꿔도 남는 **상시 요약 컨테이너** → 접히지 않는 상태 스트립 |
| Linear — project overview | https://linear.app/docs/project-overview | **고정 순서**(요약문 → 속성 → 마일스톤) → 문장 → 상태 → 섹션 |
| AWS CloudFormation — stack data | https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-console-view-stack-data-resources.html | 정체성과 상태를 **한 블록**에 → 확정 태그 + 적용 상태 pill 동거 |
| HCP Terraform — workspaces | https://developer.hashicorp.com/terraform/cloud-docs/workspaces | 헤더가 **카운트를 들고 있음** → `Terraform 설치 현황 (작업 N개)` |
| Argo CD — getting started | https://argo-cd.readthedocs.io/en/stable/getting_started/ | Sync/Health **직교 2배지** → 확정 여부와 적용 상태를 분리해 표기 |
| Octopus Deploy — project dashboard | https://octopus.com/docs/projects/project-dashboard | 최신 실행과 마지막 성공의 공존 (이번 릴리스에서는 미채택, 아래 참고) |
| Spacelift — stack | https://docs.spacelift.io/concepts/stack | "Runs is the main screen" → 개요=액션 표면, 이력=아카이브 |
| Vercel — instant rollback | https://vercel.com/docs/instant-rollback | 상태 의존 CTA (**의도적으로 버림**, 아래 참고) |

## 채택안 — 시안 A "진술형 헤드 + 현재 작업 2 : 이력 1"

1. **탭이 하는 일은 info 카드로 (오너 지시).** 처음엔 18px/600 + 14px 맨 텍스트였는데, 아래는
   전부 컨테이너가 있고 이것만 없어서 층으로 읽히지 않았다. info 톤 카드 안에 12px 아이브로우
   (`이 탭에서 하는 일`) + 14px 한 문장으로 넣고, 세 가지 일은 목록이 아니라 문장 안의 **굵기**로
   구분한다 — 아래 슬롯 스트립과 두 카드가 이미 그 셋을 구조로 갖고 있다. 소개는 섹션보다
   **조용해야** 맞다(참고 자료이지 화면의 주인공이 아니다).
2. **상태는 3구획 카드로 (시안 B 문법, 오너 지시).** `적용 상태`(`overall_state` pill) ·
   `연동 정보`(확정됨 + 최근 확정) · `Terraform 작업`(N개 + 설치 현황 보기). 칸마다
   12px 이름 / 16px 값 / 12px 보조 — 한 줄 12px 나열로는 세 사실이 한 덩어리로 읽혔다.
   접히지 않는다.
3. **Terraform 설치 현황은 모달로 (오너 지시).** 세 번째 칸의 텍스트 버튼 →
   `ModalShell variant="task"`. 태스크별 근거는 조회할 때만 열리고, 열려도 아래 `현재 작업`을
   밀어내지 않는다. 모달에서 `overall_state`·`checked_at` 을 처음으로 노출한다.
4. **`작업 시작` 은 `현재 작업` 카드가 소유한다 (오너 지시).** 헤드에 두는 안을 한 번 만들었다가
   되돌렸다 — 실행은 카드의 일이고, 헤드는 상태만 말한다. `EmptyPipelineCard` 의 CTA와
   `blockedReason` 게이트는 원래대로 유지된다.
5. **이력은 폭으로 강등한다.** 2:1 그리드. `cardsRow`(1:1)로 두면 같은 폭 = 같은 무게가 되어
   "이력 강조를 낮추자"의 반대로 간다. 골격은 `pagedCard` 계열(`StatusHistoryCard`·
   `ApprovalHistoryCard`)을 그대로 빌리고, 제목만 20px `cardTitle` 대신 이 탭의 16px 을 쓴다.
6. **섹션 제목은 카드 안, 높이는 항상 동일 (오너 지시).** `현재 작업`·`작업 이력` 이 각 카드의
   첫 줄이다. 구분선은 **없다**(오너) — 대신 제목이 카드 안 유일한 primary 파랑이고 아이콘
   (`flow`/`clock`)을 달아, 바로 아래 16px 작업 이름과 층이 갈린다. 그 아래 12px 캡션이 카드가
   무엇을 위한 것인지 말한다. 행은 stretch, 카드는 `h-full flex-col`, 이력 본문은 `flex-1` 이라
   어느 쪽이 크든 두 카드가 같은 줄에서 끝난다(`detailStyles.sectionCard`).
7. **8열 → 2열.** `유형`·`상세` 삭제(중복), `진행도`는 중단된 행에서만 `n/m 단계`로 흡수,
   `실행 시각`은 2줄 정체성 스택의 아랫줄로. 실제로 잃는 것은 `완료 시각` 하나이며 작업 상세
   페이지에 그대로 있다. 시안 B의 `③ 이력` 칸에서 **총 건수**를 가져와 카드 제목 옆에 둔다.

`전체 보기` 링크는 두지 않았다 — ops 에는 목록 라우트가 없고(`lib/routes.ts`) 독립
`/admin/pipelines/targets/{id}` 페이지도 제거돼 갈 곳이 없다. 페이저(5건)가 곧 전체 이력 UI다.

### 의도적으로 버린 것

- **L8 상태 의존 CTA(Vercel)**: 재시작·중단은 이미 `LastRunFailedCard`·`CurrentPipelineCard` 가
  갖고 있다. 헤드에는 CTA 자체를 두지 않으므로 상태를 따라갈 라벨도 없다.
- **헤드가 `작업 시작` 을 갖는 안**: 한 번 구현했다가 오너 지시로 되돌렸다. 재제안 금지.
- **L6 마지막 성공 슬롯(Octopus)**: 헤드에 두려면 이력 조회가 한 번 더 필요하다. 값 하나를 위해
  요청을 늘리지 않았다 — 같은 사실이 오른쪽 이력 카드 첫 행에 이미 있다.
- **두 시각 한 셀 병합**: 이전에 기각된 안이다(`TargetPipelineSections` 주석). 재제안 금지.

## 구현

- 브랜치 `feat/ops-infra-tab`
- 신규 `TerraformStatusModal.tsx`, `terraformState.ts`(head·modal 공용 어휘, 순환 import 방지)
- 신규 `detailStyles.sectionCard` — 카드 안 제목 + 동일 높이 골격, 세 run 카드와 이력 카드가 공유
- `PipelineTab` 이 `PreviewModal` 과 provider 파생을 소유 → `TargetPipelineSections` 는 `raw`
  대신 `provider`/`onStart` 를 받는다
- 2:1 그리드는 두 트랙에 `min-w-0` 필수 — `fr` 트랙의 하한은 min-content 라, 실행 흐름 스트립이
  넓은 `CurrentPipelineCard` 가 왼쪽 열을 밀어내 이력이 행에서 밀려난다
