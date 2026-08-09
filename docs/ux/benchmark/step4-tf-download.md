# Step4 · Terraform Script 다운로드 — 벤치마킹 → 레일 '리뷰요청' 항목 채택 기록

> 작성 2026-08-09 (design-benchmark §6 decision record)
> 대상 화면: `/pass/target-sources/{id}` 4단계 "Agent 설치" (AWS)
> 구현 PR: **#666** · 선행 결정: `docs/ux/benchmark/step4-grouped-rail.md` (PR #659 그룹 레일)

## 아티팩트

| 단계 | 아티팩트 |
|---|---|
| 리서치 (진단 · 레퍼런스 13 · 개선안 5안 · 비교표) | https://claude.ai/code/artifact/5e4a96da-b711-42cd-b53f-ca6f15619543 |

## 문제 요약 (근거 등급)

오너 지적에서 출발: "Terraform Script 다운로드는 자동/수동과 무관하게 항상 제공해야 하는
기능인데, 카드로 보이니 무게가 과하다. 중요한 게 아니라 원하면 확인할 수 있게 열어두는 쪽에 가깝다."

측정 환경 — 로컬 mock, `/pass/target-sources/1008`, 뷰포트 1600px,
`getComputedStyle` / `getBoundingClientRect` 실측. 기준 커밋 `2743f505`.

1. **보조 기능이 본론과 같은 글자 크기를 쓴다** — `수치 위반`
   TF 상자 제목 `16px/700` = 패널 제목("설치 진행 상황") = 우측 단계 제목.
   셋 다 `textStyles.cardTitle` (`AwsInstallationInline.tsx:93`, `InstallStatusDetail.tsx:660`).
2. **카드 문법 세 겹** — `수치 위반`
   흰 카드(`cardStyles.base`) ⊃ 회색 상자(`1160×82px`, radius 14, `bgColors.muted` #F9FAFB)
   + 그 아래 다른 회색 판(`bgColors.panel` #F2F4F6). 서로 다른 두 회색이 나란히 서서
   "같은 종류의 블록 둘"로 읽히지만 위상은 전혀 다르다.
3. **카드에서 유일하게 채워진 버튼이 가장 덜 중요한 액션에 붙어 있다** — `UX 원칙`
   `buttons.soft` h40. 헤더는 파랑을 "사용자가 직접 할 일"에만 쓰기로 이미 규정
   (`InstallCardHeader.tsx:8-9`).
4. **읽는 순서가 뒤집혔다** — `UX 원칙`
   헤더가 "아래 설치 현황에서 …처리해 주세요"라고 말한 뒤 98px(82+16)를 건너뛰어야 그 현황이 나온다.
5. **400px 안에서 같은 명사 두 번** — `제안` (제목 "Terraform Script" + 버튼 "Terraform Script 다운로드")
6. **같은 컨트롤인데 모드에 따라 무게가 다르다** — `UX 원칙`
   수동 설치에서는 할 일 단계가 "다운로드한 Terraform 스크립트를 …직접 적용해 주세요"라고
   지시하므로(`AwsInstallStatusDetail.tsx:65-75`) 다운로드가 그 단계의 첫 동작이다.
   현재 UI는 두 모드를 구분하지 않는다. → **미해결, 아래 참조**

## 실제로 차용한 레퍼런스

| 레퍼런스 | URL | 차용 요소 | 검증 |
|---|---|---|---|
| AWS CloudFormation 콘솔 | https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-console-view-stack-data-resources.html | Template 이 Events·Resources 와 나란한 탭 하나 → IaC 산출물은 **상태와 동급의 별도 뷰**. `InstallReferenceStep` 의 직접 근거 | `확인함` |
| Azure Portal Export template | https://learn.microsoft.com/en-us/azure/azure-resource-manager/templates/export-template-portal | 좌측 Automation 메뉴 항목 → 다운로드를 **목적지로 강등**해도 "항상 제공"은 유지된다 | `확인함` |
| GCP Console Equivalent code | https://docs.cloud.google.com/compute/docs/instances/create-start-instance | 버튼 → 패널(Terraform 탭). 설명문을 상주시키지 않고 **라벨이 곧 설명** | `확인함` |
| GitHub Actions Artifacts | https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts | 산출물은 요약 **아래**. 순서만으로 계층이 생긴다 | `확인함` |
| GitHub Primer Button | https://primer.style/product/components/button/ | "rarely use more than one [primary] per page" → `buttons.outline` (fill 없이 stroke+글자) | `확인함` |
| GOV.UK Details | https://design-system.service.gov.uk/components/details/ | 강등의 **금지선**: 다수가 필요로 하는 것은 숨기지 않는다 → 문제 6을 미해결로 남긴 근거 | `확인함` |

리서치 카탈로그 전체(13종: 위 6종 + HCP Terraform run 하단 액션, Grafana panel inspector,
Vercel ⋯ 메뉴, NN/g progressive disclosure, Cloudscape Header actions, Carbon overflow menu,
Shopify Polaris Page)와 각각의 목업은 리서치 아티팩트에 있다 — 위 표는 **출시 코드에 실제로 남은 것**만.
Carbon·Polaris 2건은 페이지가 열리지 않아 `기억 기반`으로 표시했고, 채택 코드에는 쓰이지 않았다.

## 채택안과 이유

5안(A 카드 헤더 우측 / B 메타바 우측 / C 레일 푸터 / D 레일 참고 항목 / E 접기) 중
비교표의 권장은 **A**(구현 최소 + 일관성 최상)였으나, **오너가 D를 선택**했다.
D는 CloudFormation·Azure·GCP 세 벤치마크를 가장 충실히 옮기고 설명·보조 정보를 담을 자리가 생기는 대신,
레일 그룹 모델을 건드리는 비용이 있다.

그 비용을 실제로는 이렇게 피했다 — **참고 항목을 `group` 의 세 번째 값으로 만들지 않고,
`navSteps` 배열 **밖**의 별도 prop(`reference`)으로 두었다.** 그래서 집계·진행률·기본 선택·
`openTodoCount` 어디에도 끼지 않고, PR #659 가 정리한 "내가 할 일 / BDC 자동 진행" 2그룹 결정도
그대로 남는다. 레일에서 상태 글자를 갖지 않는 유일한 항목이라는 점이 "단계가 아니다"를 시각적으로도 말한다.

CTA 는 오너 지시대로 **fill 없이 stroke + 글자만** — `buttons.outline` 토큰 신설
(`#0064FF` 테두리/글자, 흰 바닥, hover `#EFF6FF`). 관리자 콘솔이 이미 `pl.button.outline` 로
같은 역할("primary 보다 조용하고 secondary 보다 실행적")을 정의해 둔 것을 서비스 팔레트로 옮긴 것이다.

## 강등 이후의 되돌림 — 라벨과 타이포 (오너 2차 지시)

강등이 지나쳐서 "처음 들어온 담당자가 찾아야 보인다"가 되었다는 지적. 세 가지를 되올렸다.

- **`참고` → `리뷰요청`** — 수동태 명사를 요청으로 바꿨다. 색은 `statusColors.warning.textDark`
  (orange-800) + 항목 앞 `warning.dot`(orange-500). 파랑(내가 할 일)과 겹치지 않는 유일한
  강조색이고, 점 문법은 할 일 항목과 같으므로 새 어휘를 만들지 않는다.
  vivid orange-500 을 글자에 쓰지 않은 이유는 레일 표면(gray-100)에서 2.8:1 로 AA 미달이기 때문.
- **그룹 라벨 12/700 → 16/500** — 레일을 훑을 때 먼저 걸리는 것이 개별 단계가 아니라
  "무엇의 묶음인가"여야 한다는 판단. 항목(14/600)보다 한 단 크다.
- **메타바 제목 16/700 → 20/600** — 패널 제목 20 > 그룹 라벨 16 > 항목 14 의 3단 계층.

## 남은 것

- **문제 6 (모드별 무게)** — 수동 설치에서 다운로드를 해당 할 일 단계의 조치 블록(`ActionItem`)에도
  둘지는 오너 결정 대기. GOV.UK 금지선에 걸리는 사안이라 임의로 정하지 않았다.
- 타 CSP(Azure/GCP/IDC)는 그룹 레일 미적용이라 `reference` 를 넘겨도 렌더되지 않는다.
  그룹 레일 이관 시 함께 검토.
