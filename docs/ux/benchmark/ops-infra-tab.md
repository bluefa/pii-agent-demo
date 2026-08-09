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
| P3 | 실행 입구가 유휴 상태에만 있었다 | `작업 시작` 이 `EmptyPipelineCard` 안에만 있어, 실행 중·실패 상태에서는 새 작업을 시작할 입구가 없다 | UX 원칙 |
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

1. **탭을 문장으로 선언한다.** 18px/600 한 줄 + 14px 보조 한 줄. 대신 12px 캡션 3개를 삭제해
   동시 노출은 오히려 줄었다.
2. **상태 스트립은 접히지 않는다.** `확정 정보 있음` · `적용 상태` pill(`overall_state`) · `최근 확정`
   · 텍스트 버튼 · `작업 시작`.
3. **Terraform 설치 현황은 모달로.** 텍스트 버튼 → `ModalShell variant="task"`. 태스크별 근거는
   조회할 때만 열리고, 열려도 아래 `현재 작업`을 밀어내지 않는다. 모달에서 `overall_state`·
   `checked_at` 을 처음으로 노출한다.
4. **`작업 시작` 은 헤드가 소유한다.** 모든 상태에서 화면에 있고, `EmptyPipelineCard` 안의 중복
   버튼은 제거했다. 확정 정보가 없을 때는 헤드가 CTA 대신 게이트 배너를 띄우므로 막힌 버튼도
   사라진다.
5. **이력은 폭으로 강등한다.** 2:1 그리드. `cardsRow`(1:1)로 두면 같은 폭 = 같은 무게가 되어
   "이력 강조를 낮추자"의 반대로 간다. 골격은 `pagedCard` 계열(`StatusHistoryCard`·
   `ApprovalHistoryCard`)을 그대로 빌리고, 제목만 20px `cardTitle` 대신 이 탭의 16px 을 쓴다.
6. **8열 → 2열.** `유형`·`상세` 삭제(중복), `진행도`는 중단된 행에서만 `n/m 단계`로 흡수,
   `실행 시각`은 2줄 정체성 스택의 아랫줄로. 실제로 잃는 것은 `완료 시각` 하나이며 작업 상세
   페이지에 그대로 있다. 시안 B의 `③ 이력` 칸에서 **총 건수**를 가져와 섹션 제목 옆에 둔다.

`전체 보기` 링크는 두지 않았다 — ops 에는 목록 라우트가 없고(`lib/routes.ts`) 독립
`/admin/pipelines/targets/{id}` 페이지도 제거돼 갈 곳이 없다. 페이저(5건)가 곧 전체 이력 UI다.

### 의도적으로 버린 것

- **L8 상태 의존 CTA(Vercel)**: 재시작·중단은 이미 `LastRunFailedCard`·`CurrentPipelineCard` 가
  갖고 있다. 헤드 라벨까지 상태를 따라가면 같은 액션이 두 곳에 생긴다. 헤드는 "새 작업 시작"만.
- **L6 마지막 성공 슬롯(Octopus)**: 헤드에 두려면 이력 조회가 한 번 더 필요하다. 값 하나를 위해
  요청을 늘리지 않았다 — 같은 사실이 오른쪽 이력 카드 첫 행에 이미 있다.
- **두 시각 한 셀 병합**: 이전에 기각된 안이다(`TargetPipelineSections` 주석). 재제안 금지.

## 구현

- 브랜치 `feat/ops-infra-tab`
- 신규 `TerraformStatusModal.tsx`, `terraformState.ts`(head·modal 공용 어휘, 순환 import 방지)
- `PipelineTab` 이 `PreviewModal` 과 provider 파생을 소유 → `TargetPipelineSections` 는 `raw`
  대신 `provider` 를 받는다
- 2:1 그리드는 두 트랙에 `min-w-0` 필수 — `fr` 트랙의 하한은 min-content 라, 실행 흐름 스트립이
  넓은 `CurrentPipelineCard` 가 왼쪽 열을 밀어내 이력이 행에서 밀려난다
