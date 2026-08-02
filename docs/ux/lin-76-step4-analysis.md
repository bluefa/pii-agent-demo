# LIN-76 — Step4(Agent 설치) 현황 분석 · 레퍼런스 · 해소 방향

- 작성일: 2026-08-02
- 분석 기준: `origin/main` (bff2533)
- 분석 대상: Step4 진입 경로 전체 — `InstallingStep` → `CloudInstallingStep` → `InstallationStatusSlot` → `{Aws,Azure,Gcp}InstallationInline` + 공용 `InstallStatusDetail`, IDC는 `IdcStep4Installing`
- 선행 사실: LIN-76 본문의 "PR 대기" 브랜치 `feat/step4-aws-install-detail`은 **이미 main에 반영됨** (마스터-디테일, 요약 패널, 상단 조치 배너, `docs/redesign/typography-and-spacing.md` 모두 main에 존재. 브랜치만 미삭제 상태)

---

## 1. 문제 정의

사용자 제기 문제 — "계층이 안 보인다. 서비스 측 담당자가 **뭘 해야 할지**와 **진행 경과**가 안 보인다" — 를 코드로 검증한 결과, 다음 5가지로 구체화된다.

### P1. Step4만 스텝 카드 문법에서 빠져 있다 (계층 레벨 1 실종)

Step 1·2·3·6·7 카드는 모두 `N번째 단계` 태그 + 제목 옆 상태 배지 + 상태·행동 guidance 문장 구조다
(`ConnectionVerifiedStep.tsx:99-148`, `WaitingApprovalCard.tsx:227`, `ApplyingApprovedCard.tsx:131`,
`CandidateResourceSection.tsx:423`). Step4 헤더는 4사 모두:

```
Agent 설치                                    Provider: AWS
승인된 인프라에 PII Agent를 배포하기 위한 설치 작업을 진행합니다.
```

- 단계 태그 없음 → 7단계 플로우에서 지금 어디인지 카드가 말하지 않는다.
- 상태 배지 없음 → 설치가 진행중인지·실패했는지·서비스 조치 대기인지 제목 레벨에서 안 보인다.
- guidance가 상태 불변의 고정 문장 → "지금 뭘 해야 하는지 / 안 해도 되는지"를 답하지 않는다.
- 헤더 우측은 다른 스텝에서 보조 액션 자리(C-3)인데 Step4만 Provider 표시(비컨트롤)가 차지.
  Provider는 바로 위 identity bar(`ProjectPageMeta`)와 중복 정보다.

근거: `AwsInstallationInline.tsx:84-95`, `AzureInstallationInline.tsx:105`, `GcpInstallationInline.tsx:100`, `IdcStep4Installing.tsx:173-184`.

### P2. 진행 경과가 두 겹 아래에 묻혀 있다

리소스 롤업(`리소스 N개 · 완료 n · 진행중 n · 실패 n`)은 요약 패널을 열었을 때만 보인다
(`InstallStatusDetail.tsx:343-348`). 마지막 확인 시각(`lastCheck.checkedAt`)도 우측 패널 내부 캡션이다
(`InstallStatusDetail.tsx:617-623`). 카드 첫 화면에서 "전체적으로 얼마나 왔나"를 읽을 수 있는 요소가 없다.

### P3. 조치 없음 상태에서는 아무 신호가 없다

상단 조치 배너(`ActionBanner`)는 actionable 스텝이 있을 때만 뜬다(`InstallStatusDetail.tsx:543-545`).
없을 때 — Step4 대부분의 시간, BDC 자동 설치 진행 중 — 카드는 "당신은 기다리면 된다"를 어디에도 말하지 않는다.
서비스 담당자 입장에서 '조치 필요 없음'은 빈 화면이 아니라 명시적 상태여야 한다.

### P4. 첫 시선 위치에 보조 요소가 온다 (카드 내부 계층 역전)

- AWS: 카드 body 첫 블록이 Terraform Script 다운로드 박스(`AwsInstallationInline.tsx:99-115`) —
  리뷰용 보조 기능이 '지금 상태/할 일'보다 위에 있다.
- IDC: `InstallStatusDetail`(리소스별 상태 테이블 포함) 아래에 **또** 읽기 전용 `IdcResourceTable`(src·fw 컬럼)이
  붙는다(`IdcStep4Installing.tsx:198-208`) — 같은 리소스 목록이 한 카드에 두 번, 관계 설명 없이 나열된다.
- 에러 스트립 3종(다운로드 실패·상태 확인 실패·리소스 로드 실패)이 카드 상단에 개별 div로 쌓인다
  (`AwsInstallationInline.tsx:116-157`) — 문법 없이 누적되는 구조.

### P5. 번호 체계 충돌 (계층 레벨 1 vs 레벨 2)

페이지 상단 스테퍼는 7단계 번호를 쓰고, Step4 카드 내부 좌측 내비는 설치 서브스텝을 다시 원형 숫자 1·2·3…으로
번호 매긴다(`InstallStatusDetail.tsx:564-574`). 카드에 단계 태그가 없는 상태에서 숫자 원이 또 나오므로,
"이 1·2·3이 그 1·2·3인가?"라는 혼선이 생긴다. 사용자가 말한 "계층이 안 보인다"의 구조적 원인.

---

## 2. 내부 레퍼런스 10개

| # | 레퍼런스 | 왜 보는가 |
|---|---|---|
| 1 | Linear LIN-74 (Step7 카드 문법 정렬) | 이번 작업의 방향 원본. 문법 정의: 단계 태그 + 상태 배지 + guidance 2줄 + CardActionBar. 확인 URL 패턴(`/pass/target-sources/…`)도 여기서 재사용 |
| 2 | `docs/ux/step-flow-ux-improvement-report.md` | Step 1~7 전수 진단. C-2(하단 액션 바)·C-3(헤더 우측 보조 액션)·C-4(disabled 사유) 문법의 출처. Step 3·4 "주 액션 없음(자동 진행)" 분류 근거 |
| 3 | `ConnectionVerifiedStep.tsx:97-148` | 문법의 최신 구현 레퍼런스 — 단계 태그, 제목+상태 배지, 상태절 색 강조 guidance 2문장, C-3 보조 액션(연결 재확인) 배치까지 전부 있음 |
| 4 | `WaitingApprovalCard.tsx` + PR #598 | Step2 문법 + "카드 속 카드 제거·계층 역전 해소" 선례 — IDC 이중 테이블(P4) 정리 방식의 참고(접기 기록화) |
| 5 | `CandidateResourceSection.tsx:63,423` | Step1 `STEP_TAG` 스타일 원본. 주석에 "WaitingApprovalCard의 2번째 단계 태그와 동일 클래스 유지" 계약이 명시됨 |
| 6 | `CardActionBar.tsx` | 스텝 전환 액션존 컴포넌트(C-2/C-4 계약). Step4는 자동 전이라 미사용이 맞는지 판단할 때 기준 |
| 7 | `InstallStatusDetail.tsx` | 현재 Step4 본체. ActionBanner·InstallSummaryPanel·hotStepId 로직이 이미 "뭘 해야 하나"의 절반을 해결 — 개선은 이 위에 얹는다 (재작성 아님) |
| 8 | `AwsInstallationInline.tsx` (+Azure/Gcp Inline) | 정렬 대상 헤더 4사 공통 원본. Provider 표시 위치·TF Script 박스 위치·에러 스트립 누적 구조가 여기 있음 |
| 9 | `IdcStep4Installing.tsx` | IDC 변형 — 이중 리소스 테이블, 방화벽 확인 모달, ADR-019 데이터 계약 주석. IDC만의 제약(Region 없음 등) 확인용 |
| 10 | `docs/redesign/typography-and-spacing.md` + `design/SIT Prototype Athena v16.html` (L6579~6634) | 텍스트 계층·간격 기준(feat/step4-aws-install-detail에서 수립, main 반영됨)과 Step4 목업 원본. Provider 표시는 v16 명세였음 — 제거/이동 시 목업 대비 의사결정 필요 |

---

## 3. 외부 레퍼런스 10개

Step4의 본질 = "내가 시작시킨 자동 프로비저닝 파이프라인을 지켜보다가, 내 차례가 오면 조치한다".
같은 문제를 푸는 외부 제품·가이드라인 10개와, 각각 어느 문제(P)·방향(D)에 대응되는지.

| # | 레퍼런스 | 무엇을 빌리는가 | 대응 |
|---|---|---|---|
| 1 | [HCP Terraform — Run states](https://developer.hashicorp.com/terraform/cloud-docs/run/states) | 도메인이 동일(TF plan/apply). 파이프라인 상태를 `Pending → Planning → **Needs Confirmation** → Applying → Applied`처럼 "사용자 차례"를 별도 상태명으로 분리해 부른다. 우리 상태 배지 어휘(진행중/서비스 확인 필요/완료 대기) 설계의 직접 참고 | P1·P3 / D1 |
| 2 | [AWS CloudFormation — 스택 리소스/이벤트 뷰](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-console-view-stack-data-resources.html) | 리소스별 상태 테이블(CREATE_IN_PROGRESS…) + **Status reason 컬럼**으로 실패 사유를 행 단위 노출. 우리 마스터-디테일 테이블의 상태/안내 컬럼과 같은 구조 — 이벤트 타임스탬프 병기 방식 참고 | P2 / D2 |
| 3 | [GitHub — PR status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks) | 자동 체크 목록의 worst-wins 롤업 한 줄("All checks have passed / 1 failing") + 항목별 펼침. 헤더 한 줄에서 전체 판정 → 상세는 아래, 라는 계층 문법 | P2·P5 / D2 |
| 4 | [Vercel — Deployments](https://vercel.com/docs/deployments) | 완전 자동 파이프라인(Queued → Building → Ready)의 상태 표시. 사용자 조치가 없는 구간에서도 현재 단계·로그를 상시 노출해 "기다리면 된다"를 화면이 말한다 | P3 / D1·D5 |
| 5 | [GOV.UK Design System — Task list pattern](https://design-system.service.gov.uk/patterns/task-list-pages/) | "해야 할 일 목록 + 태스크별 상태 태그(Completed / In progress / **Cannot start yet**)" 패턴. 우리 요약 패널의 세 묶음(조치 필요/진행 중/완료)과 동형 — 상태 태그 문구·순서 검증에 사용 | P1·P3 / D1 |
| 6 | [Stripe 등 SaaS 온보딩 체크리스트 사례](https://www.appcues.com/blog/saas-user-onboarding) | 셋업 체크리스트는 진행률을 외재화하고, 이탈 후 복귀해도 위치가 유지된다. "가치가 나오는 스텝을 먼저" — TF Script 박스보다 상태/할 일이 먼저라는 D3 순서 근거 | P4 / D3 |
| 7 | [NN/g — Wizards: Definition and Design Recommendations](https://www.nngroup.com/articles/wizards/) | 위저드 스텝 표기 원칙: 현재 위치·전체 단계 수·각 스텝 라벨을 항상 노출. `4번째 단계` 태그가 왜 카드 레벨에 있어야 하는지의 원론 | P1 / D1 |
| 8 | [NN/g — Progress Indicators](https://www.nngroup.com/articles/progress-indicators/) ([복잡 앱의 대기 설계](https://www.nngroup.com/articles/designing-for-waits-and-interruptions/)) | 10초 이상 대기에는 루프 애니메이션이 아니라 "몇 개 완료/몇 개 남음" 단위의 정량 피드백이 필요. 롤업 카운트를 헤더로 승격하는 D2의 근거 | P2 / D2 |
| 9 | [Carbon Design System — Progress indicator](https://carbondesignsystem.com/components/progress-indicator/usage/) | 세로 스테퍼 권장 조건, 스텝 라벨 작성법, error/disabled 상태 표기. 좌측 내비(설치 서브스텝)의 마커·상태 표기 정비 기준 | P5 / D4 |
| 10 | [Material UI — Stepper](https://mui.com/material-ui/react-stepper/) | 숫자 원형 마커는 "순서가 의미 있는 단계"에만 쓰는 문법. 서브스텝 번호가 페이지 7단계 번호와 충돌할 때 비번호 마커/소제목으로 바꾸는 판단 기준 | P5 / D4 |

---

## 4. 해소 방향 (제안)

우선순위 순. 상세 범위는 이슈 본문대로 착수 시 라이브 리뷰로 확정.

### D1. 헤더를 스텝 카드 문법으로 정렬 (P1) — 핵심

4사 공통으로:

- `4번째 단계` 태그 (STEP_TAG 스타일 재사용)
- 제목 "Agent 설치" + **상태 배지** — 설치 롤업에서 도출: `설치 진행중`(info) / `서비스 확인 필요`(warning) / `실패`(error) / `완료 대기`(success)
- guidance 2줄 문법: 상태절 색 강조 1문장 + 행동 안내 1문장. 상태별 예:
  - 자동 진행 중: "**BDC가 Agent를 자동 설치하고 있어요.** 서비스 측 조치는 필요 없으며, 완료되면 다음 단계로 자동 이동합니다."
  - 조치 필요: "**서비스 측 확인이 필요한 작업이 있어요.** 아래 요약에서 방화벽 오픈(또는 Terraform 적용)을 진행해 주세요."
- Provider 표시는 identity bar와 중복이므로 제거 후보 — v16 명세였으므로 라이브 리뷰에서 확정

이것만으로 "지금 어디인가 / 뭘 해야 하나 / 안 해도 되나"가 헤더 3줄에서 답해진다. P3도 guidance 상태 문장으로 함께 해소.

### D2. 진행 경과를 헤더 레벨로 승격 (P2)

요약 패널 내부의 롤업 카운트(`리소스 N개 · 완료 n · 진행중 n · 실패 n`)와 `마지막 확인 HH:mm`을
카드 상단(guidance 아래 한 줄 또는 상태 배지 옆)에 상시 노출. 데이터는 이미 `InstallStatusDetail`이
계산하고 있으므로 표출 위치만 올린다.

### D3. 카드 내부 계층 정리 (P4)

- AWS TF Script 박스 → C-3 문법(헤더 우측 보조 액션 "TF 스크립트 다운로드") 또는 상태 디테일 아래로 강등.
  단, manual install 모드에서는 주 작업이므로 actionable 카드(요약 패널) 쪽 동선 유지
- IDC 연동 대상 목록(src·fw) → Step2 #598 선례처럼 접기 처리하거나, src·fw 정보를 마스터-디테일 meta로 흡수해 단일 목록화
- 에러 스트립 3종 → 스타일·위치 문법 통일 (한 자리, 한 스타일)

### D4. 번호 체계 충돌 해소 (P5)

D1의 단계 태그로 레벨 1이 명시되면, 좌측 내비의 원형 숫자는 "설치 작업 1·2·3"으로 읽히도록
내비 상단에 소제목(예: "설치 작업") 또는 숫자 대신 비번호 마커 검토. 최소 변경은 소제목 추가.

### D5. 스텝 전환 CTA — 의도적 미적용 확인

Step4는 자동 전이(설치 완료 감지 → `onInstallComplete` → refresh)이므로 CardActionBar는 두지 않는다
(Step3과 동일 분류, UX report P1 표). 대신 D1 guidance에 "완료 시 자동 이동"을 명시해 CTA 부재가
의도임을 화면이 설명하게 한다.

### 확인 URL (mock 시드)

- AWS: `/target-sources/1008` (UX report 캡처 시드) · manual install 변형 별도 확인 필요
- Azure/GCP/IDC: 착수 시 mock 시드 확인 (IDC는 1020 계열)
