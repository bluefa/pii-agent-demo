# 인프라 작업 탭 「설치 상태」 — 누구 차례인지 한 줄

- 날짜: 2026-09-13
- 대상: `/pass/admin/pipelines/ops/target-sources/{id}?tab=infra` 의 머리 카드(구 「Terraform 적용 상태」) ·
  `?tab=tc` 의 설치 미완료 예보 상자
- 시안 아티팩트: https://claude.ai/code/artifact/4a83a5da-2a1d-4ea6-b43e-99b67967e2a3 (CSP 별 21면 + 변형 5)
- 구현 PR: #898
- 선행: [`ops-infra-head.md`](./ops-infra-head.md) · [`ops-infra-gate.md`](./ops-infra-gate.md)

## 문제

오너(2026-09-13): "「Terraform 적용 상태」가 너무 헷갈린다. 관리자들이 똑똑한 사람들이 아니야.
installationStatus 를 이용해서 누가 뭘 할 차례다 / 니가 뭘 할 차례다 / 완료되었다를 명확하게."

| # | 진단 | 등급 |
|---|---|---|
| P1 | 카드 행이 `terraform-status`, 즉 InfraManager 의 **제 작업 기록**이었다. "우리가 뭘 돌렸나"에는 답하지만 "누가 뭘 해야 하나"에는 답하지 않는다. 미적용이 서비스가 안 해서인지 관리자가 안 눌러서인지 카드가 말하지 않는다. | UX 원칙 |
| P2 | 행 이름이 와이어 enum(`AWS_BDC_SERVICE_COMMON`)이었다. | UX 원칙 |
| P3 | 연결 테스트 탭의 예보는 「안 끝난 리소스 N건」과 리소스 목록 모달. 무엇이 남았는지는 말하지만 누가 해야 하는지는 말하지 않았다. | UX 원칙 |
| P4 | AWS 자동 설치는 `installation-status` 를 아예 조회하지 않았다(4R 진단 P3). | 수치 위반(조회 누락) |

## 오너 결정 (판정 규칙)

1. **출처 하나.** `installation-status` 만 읽는다. 자동·수동 구분만 대상 상세
   `metadata.grant_service_terraform_execution_permission`(이미 읽는 값).
2. **안 끝남 = 조치 필요.** COMPLETED·SKIP 이 아닌 셀은 전부 그 단계 주체의 「조치 필요」.
   IN_PROGRESS 를 "돌아가는 중"으로 읽지 않는다 — 07-30 BE 캡처(1008)는 아무것도 안 돌린
   셀도 IN_PROGRESS 로 보낸다. 실행 중인지는 아래 「현재 작업」 카드가 보여준다.
   (`terraform-status` 의 APPLYING 을 섞자는 제안은 기각: "ㄴㄴ 조치 필요라고 하면 되잖아".)
3. **지금 차례 하나.** 리소스마다 실행 순서상 첫 미정착 단계를 찾고, 대상은 그중 가장 앞
   단계를 말한다. 뒤 단계는 「대기」로 순서에서 파생한다.
4. **전부 SKIP 이면 안 그린다.** 모든 리소스에서 SKIP 인 단계는 행도 상태도 없다.
5. **실패는 상태가 아니다.** FAIL 은 같은 「조치 필요」에 행 태그 「실패」와 `guide` 한 줄.
6. **확인 불가는 「할 일 없음」이 아니다.** `installation_status_unavailable`·조회 실패·
   리소스 0건은 행 없이 한 문장.

## CSP 별 순서와 상태 수

| CSP | 첫 조치 → | 상태 |
|---|---|---|
| AWS 자동 | 서비스 권한 부여(`terraform_execution_role_verify`) → 관리자 작업 시작 | 4 |
| AWS 수동 | 서비스 Terraform 직접 적용(`service_terraform`) → 관리자 | 4 |
| GCP | 서비스 PSC용 Subnet(`service_side_subnet_creation`) → 관리자(서비스 프로젝트 TF 포함) | 4 |
| Azure | 서비스 VM Subnet·VM TF → 관리자 → **서비스 Private Endpoint 승인**(오너 정리에 빠져 있던 둘째 서비스 차례) | 5 |
| IDC | 관리자 BDC CX·BDP TF → 서비스 접근 허용(`firewall_check`). 선후는 계약에 없고 Source IP 논리로 BDC 먼저 | 4 |

상태 = 서비스 조치 n · 관리자 조치 필요 · 완료 · 확인 불가. 합 21.

⚠️ `cloud-provider-states.md` 는 GCP Subnet 을 "시스템이 생성" 이라 적지만 코드와 08-31 오너
결정은 서비스가 만든다. 코드를 따랐다.

## 채택한 화면

카드 「설치 상태」 (`InfraStatusHead`):

- 머리: 제목 16/700 · `확인 {last_check.checked_at}` (이 카드의 유일한 시계).
- 연동 정보 줄: 그대로(확정됨 + 확정 정보 링크 / 미확정 + 단계).
- 판정 행 (`InstallStateRow`): 마크 · 한 문장 · 태그(서비스 조치 필요 / 관리자 조치 필요 / 완료 /
  확인 불가) · 관리자 차례엔 「현재 작업으로 이동」 링크. #895 의 5단계 행과 같은 문법.
- 단계 행: 이름(240px) · 주체 태그 「서비스」/「관리자」(관리자는 주황 테두리) · 상태 태그
  완료 / 조치 필요 / 대기 / 해당 없음 / 실패 · 일부만 남았으면 `N건 중 M건 남음` · 실패 행
  아래 guide.
- `terraform-status` 행은 카드에서 빠진다. 그 응답은 연동 정보 줄과 삭제 게이트만 읽는다.

연결 테스트 탭 (`InstallPendingNotice`): 제목 「설치가 끝나지 않아 연결 테스트가 실패합니다」는
그대로 두고, 본문을 같은 `InstallStateRow` 로 바꿨다. 리소스 목록 모달 대신 「인프라 작업 탭에서
설치 상태 보기」 링크 하나. 판정 fold 는 두 탭이 하나(`installStateView`)를 쓴다.

## 남은 결정

- 관리자 차례 행에 「작업 시작」 버튼을 둘 것인가. 08-30 「실행은 현재 작업 카드 한 곳」 결정을
  지켜 링크만 뒀다. 버튼을 올리려면 그 결정을 뒤집어야 한다.
- 주체 낱말 「관리자」 vs 기존 「BDC」. 오너 문장 "니가 뭘 할 차례"를 그대로 옮겨 「관리자」.
- 4R 매트릭스 A(리소스×단계 표)와는 직교. 그 결정 4건은 그대로 열려 있다.
