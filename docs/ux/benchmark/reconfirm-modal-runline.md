# 확정 정보 탭 — 재확정 문은 모달을 열고, 작업 줄이 진행을 말한다

- **날짜** 2026-09-12
- **대상 화면** `/pass/admin/pipelines/ops/target-sources/{id}?tab=confirm` — 확정 정보 카드 머리(`ReconcilePane`)와 판정 헤드라인(`ConfirmTab`)
- **아티팩트** https://claude.ai/code/artifact/e7ace4eb-b24a-4531-a11d-c7cb45b6671f 「재확정 문과 작업 줄」
- **앞 라운드** 09-11 「실행 정보의 자리」 https://claude.ai/code/artifact/4a14e9e3-7cf6-4c1f-9bc6-8e085c3ebeac (시안 C 작업 줄 추천) · 후속 「작업 줄이 서는 세 탭」 https://claude.ai/code/artifact/e914a04f-e9c9-4de9-8ef2-f6a5a643e4e1
- **채택안** 시안 B — 문(`initialType`) + 작업 줄(`RunLine`). 오너 2026-09-12 "너가 말한대로 구현해도 될 것 같아" + "재확정이 아닌 다른 작업에 의해서도 재확정은 막혀야 된다"
- **구현 PR** #891 (PR #890 위에 쌓음 — 모달 진입에 RECONFIRM 유형이 필요하다)

## 발단

오너: "재확정을 누르면 바로 재확정 수행 모달이 뜨게 바꿔보자. 인프라 작업 내역을 조회할 수 있는 API로 현재 작업 진행중인지와 어떤 작업이 진행중인지 간략하게 보여주고 이동할 수도 있게."
09-11 의 전제 「재확정의 이동은 인프라 작업 탭」은 오너가 스스로 뒤집었다.

## 문제 진단 (등급)

| # | 문제 | 근거 | 등급 |
|---|---|---|---|
| D1 | 「재확정」이 탭 전환만 하고, 유형은 인프라 탭 모달에서 다시 고른다 | `ConfirmTab.tsx` `onReconfirm={onOpenInfra}` · `PreviewModal` 은 항상 `choose` 스텝 | UX 원칙 (약속–결과 불일치) |
| D2 | 모달에 「유형을 정해서 열기」 입구가 없다 | `PreviewModalProps` 에 초기 유형 없음 | 제안 (구현 사실) |
| D3 | 확정 탭이 파이프라인을 모른다 — 실행 중에도 문이 열려 409 뒤 토스트 | 진입 3콜에 파이프라인 없음 · `PreviewModal` 409 처리 | UX 원칙 (상태 가시성·오류 예방) |
| D4 | 필요한 API는 있다 — `#8 pipelines/latest` (200 `PipelineSummary` · 204) | `orchestrator-v1.yaml` · `lib/pipeline/types.ts` | 계약 사실 |
| D5 | latest 는 종료 실행도 준다 · 유형을 가리지 않는다 | `mock/pipeline.ts latestByTarget` · `isLivePipeline` | 계약 사실 |
| D6 | 끝나도 확정 탭은 모른다(`reloadKey` 만) | `ConfirmTab.tsx` 로더 | UX 원칙 (상태 동기화) |
| D7 | 확정 탭에서 작업 상세로 가는 길이 없다 | `CurrentPipelineCard` 링크는 인프라 탭 | UX 원칙 (탐색) |
| D8 | ①만 하면 시작 직후 볼 곳이 없다 | `PreviewModal TYPE_NOTES` | UX 원칙 (착지) |

## 사용한 레퍼런스

| 레퍼런스 | URL | 가져온 것 |
|---|---|---|
| HCP Terraform — Start a new run · Run states | https://developer.hashicorp.com/terraform/cloud-docs/run/ui · https://developer.hashicorp.com/terraform/cloud-docs/run/states | 유형 재선택 없는 실행 다이얼로그 · 「현재 run 없으면 마지막 run」 |
| Argo CD — issue #12141 | https://github.com/argoproj/argo-cd/issues/12141 | 잠금 사유는 사용자가 누른 낱말로 |
| GitHub Actions — Re-run jobs · PR checks | https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/re-running-workflows-and-jobs | 최소 확인 모달 · 상태 줄 + Details |
| AWS CloudFormation — Update stack | https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-updating-stacks-direct.html | 상태 텍스트 태그 · 완료로 자동 전이 |
| AWS RDS — Modifying | https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.DBInstance.Modifying.html | 상태 정의가 곧 잠금 사유 |
| Render — Deploys | https://render.com/docs/deploys | 겹침 정책(잠금·대기열·덮어쓰기)을 명시 |
| Cloudscape — Loading & refreshing | https://cloudscape.design/patterns/general/loading-and-refreshing/ | 갱신은 데이터 유지 + 교체 |

## 채택안 — 시안 B

비교표(아티팩트 §4)에서 B 만 D1~D8 전부를 덮는다. A(문만)는 시작 뒤 갈 곳이 없고, C(헤드라인)는 완료·실패 결과를 말할 자리가 없고, D(전역 띠)는 B 다음 확장, E(모달 진행)는 실행 카드 복제 판례(09-11)에 걸린다.

- **문** — `PreviewModal` 에 `initialType` 하나. 확정 탭의 「재확정」은 그 모달을 RECONFIRM 미리보기 스텝으로 연다(폭 760 · 「이전」 대신 「취소」). 승인 게이트는 그대로 문을 잠근다.
- **줄** — `useLatestRun`(latest 1콜 · 진행 중이면 8초 재조회 · 진행→종료 틱에 `retry`) + `RunLine`(알림 상자 계열 12px 라운드 · `FlowStatusPill` · 14/600 「레시피 #id」 · 12px Task n/m · 시작/종료 시각 · `RequesterTag` · `detailLink` 「상세 보기 ↗」 → `/admin/pipelines/{id}`). 실행 이력 없음(204)이면 줄이 서지 않는다. 종료 줄은 다음 실행까지 남는다.
- **잠금** — 진행 중이면 **유형을 가리지 않고** 재확정·확정 정보 삭제·확정 정보 입력 세 문이 「진행 중인 작업이 끝나야 실행할 수 있습니다」로 잠긴다(오너: 다른 작업도 재확정을 막아야 한다). 승인 게이트보다 앞선다.
- **판정** — RECONFIRM 이 도는 동안 헤드라인은 「재확정이 진행 중입니다 / 끝나면 확정 정보가 승인 내용으로 다시 등록됩니다. 아래 표는 실행 전 확정 정보입니다.」 설치 끝만 이것을 이긴다.

### 실측 (미리보기 서버 5608, 2026-09-12)

- 1388(#135 PENDING): 줄 「PENDING · AWS 재확정 #135 · Task 0/5 · 19:58:12 시작 · admin-1 · 상세 보기」 646×47px · 12px 라운드 · 세 문 `aria-disabled=true` · 헤드라인 「재확정이 진행 중입니다」.
- 1861: 「재확정」 → 다이얼로그 760px · h3 「재확정 작업 시작」 · 유형 선택 문구 없음 · 발 「취소 / 재확정 시작」 · Task 5 노드. 「재확정 시작」 → 토스트 · 줄 「PENDING AWS 재확정 #136」 · 세 문 잠김. 「상세 보기」 → `/pass/admin/pipelines/136`.
- 1002(#129 PENDING · 요청자 없음): 요청자 태그 생략 · 확정 없음이라 문은 「확정 정보 입력」 하나, 잠김.

## 미결 (BE 확인 4, 09-11 그대로)

latest 가 종료 실행도 주는가(목은 준다) · 레시피 중간 confirmed-integration 404 구간 길이 · DONE→CONFIRMED 전이 시점 · n/m 이 latest 에 있는가(`PipelineSummary` 엔 있다).
