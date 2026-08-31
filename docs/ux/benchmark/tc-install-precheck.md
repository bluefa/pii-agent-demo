# 연결 테스트 — 설치 미완료 사전 고지

- 날짜: 2026-08-31
- 대상: 운영 콘솔 `연결 테스트` 탭 — `tabs/TcTab.tsx` · `tabs/tc/TcLatestRunCard.tsx`
  (사용자 화면 Step 5 는 **이번 PR 범위가 아니다**. 같은 결함이 그쪽에도 있지만, 판정과
  문법을 관리자 화면에서 먼저 굳힌 뒤 옮긴다.)
- 리서치 아티팩트: https://claude.ai/code/artifact/a2d4e305-73d9-4708-8a8e-08db9bc2c3c2
- PR: TBD

## 문제 (증거 등급)

| # | 진단 | 등급 |
|---|------|------|
| P1 | Step 5 / 연결 테스트 화면이 **설치 사실을 아예 모른다** — 설치가 안 끝난 리소스가 있어도 화면은 그것을 조회하지 않고, 운영자는 실패를 한 번 만들고 나서야 안다 | UX 원칙 |
| P2 | 경고와 동작의 거리 — 설치 상태를 알려 주는 자리(4단계·인프라 작업 탭)와 실행을 누르는 자리(5단계 카드)가 다른 화면이라, 아는 사실이 누르는 순간에 도달하지 않는다 | UX 원칙 |
| P3 | amber 상자의 계급 — 카드에 이미 서는 경고(Credential 미설정)와 새 경고가 같은 문법이면 우선순위가 소멸한다. 둘은 무게가 다르다(잠금 vs 예보) | UX 원칙 |
| P5 | fix 경로 없음 — 「실패할 것이다」만 말하고 **어느 리소스인지**로 데려가지 않으면 다음 행동이 없는 경고가 된다 | UX 원칙 |
| P6 | CSP 비대칭 — 설치 상태 계약은 네 프로바이더 모두에 있는데, 기존 판정(`serviceWorkGate`)은 AWS 수동·GCP 둘만 읽는다. 연결 테스트의 질문은 「누가 설치했나」가 아니라 「설치가 끝났나」라 그 비대칭이 근거가 없다 | UX 원칙 |

## 채택 — 시안 D "예보 + 실행 직전 확인"

세 부품이 한 판정(`installPendingGate`)을 나눠 쓴다:

1. **예보 상자** (`InstallPendingNotice`) — Credential 알림 **아래**, 밴드 위.
   `설치가 끝나지 않아 연결 테스트가 실패합니다` + 리소스 건수 + `미완료 리소스 보기` 링크.
   순서가 곧 무게다(P3): 미설정은 실행 자체를 잠그는 **사유**이고, 이것은 실행은 되지만
   결과가 정해진다는 **예보**다.
2. **목록 모달** (`InstallResourceListModal`) — 인프라 작업 탭의 그 표를 일반화해
   `설치 단계` 열 하나를 더한다. 셀 하나에 행 하나이므로 한 리소스가 두 단계에서 걸리면
   행도 둘이다. P5 의 답: 「무엇이 걸렸는가」로 데려간다.
3. **확인 모달** (`InstallPendingConfirmModal`) — `연결 테스트 실행` 을 누른 그 순간 한 겹.
   primary 라벨이 결과를 서술한다 — `실패를 감수하고 실행`. P2 의 답: 경고가 읽는 자리에
   한 번, 누르는 자리에 한 번 선다.

판정은 CSP 를 가리지 않는다(P6): 리소스의 셀이 하나라도 `COMPLETED`/`SKIP` 이 아니면
그 리소스는 이번 회차에서 실패할 리소스다. AWS·Azure·GCP·IDC 넷 다 읽고, SDU 만 읽지 않는다
(그 대상은 이 콘솔에서 설치 상태를 갖지 않는다).

⛔ **막지 않는다.** 실행 버튼을 잠그는 것은 Credential 미설정 하나뿐이고, 그 잠금이 이
예보를 이긴다 — 미설정이면 버튼이 `blocked` 라 확인 모달까지 오지 않는다(의도된 순서).
나머지 리소스를 확인하려는 실행은 정당하므로 화면이 대신 결정하지 않는다.

⛔ **`unknown` 은 아무 말도 하지 않는다.** 조회 실패 · `installation_status_unavailable` ·
`FAILED` last_check · 리소스 0건은 전부 「읽지 못했다」이지 「끝났다」도 「안 끝났다」도
아니다. `done` 도 침묵한다 — 끝난 일은 소식이 아니다.

비교표 근거: 다섯 시안 중 **P1·P2·P5 와 재확인(설치가 끝난 뒤 다시 읽기)을 모두 채우면서
선례와 충돌하지 않는 유일한 안**이다. 시안 A 는 D 에서 확인 모달만 뺀 것(P2 미해결 —
경고가 읽는 자리에만 서고 누르는 자리에는 없다), 나머지 셋은 실행을 잠그거나(⛔ 「주의이지
게이트가 아니다」 판례와 충돌) 새 표면을 만든다.

## 실제 차용한 레퍼런스

| 레퍼런스 | 빌린 요소 | URL |
|----------|----------|-----|
| GitHub merge queue | 우회 CTA 라벨이 **결과를 서술한다** — `실패를 감수하고 실행` 의 문법 | https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/merging-a-pull-request-with-a-merge-queue |
| HCP Terraform policy results | 실패 목록 + 계속 버튼이 **한 표면**에 — 확인 모달이 이름 줄을 데리고 서는 근거 | https://developer.hashicorp.com/terraform/cloud-docs/policy-enforcement/view-results |
| AWS Cloudscape error messages | 영향받는 요소 **근처**에 Alert, 3단 문장(무엇이·왜·다음에 무엇을) | https://cloudscape.design/patterns/general/errors/error-messages/ |
| GitLab Pajamas Alert | 닫기 없음 · 액션 ≤2 · **다음 행동 없는 오류 금지** | https://design.gitlab.com/components/alert |
| Azure Private Endpoint 문서 | 규칙형 인과 문장(「승인 전에는 연결이 실패한다」)의 어조 | https://learn.microsoft.com/en-us/azure/data-factory/managed-virtual-network-private-endpoint |

시안 A~E 비교와 전체 카탈로그는 아티팩트 참조.

## 구현 노트

- 조회는 **폴링하지 않는다**. 이 탭은 설치를 지켜보는 화면이 아니라 실행 전에 한 번 확인하는
  화면이라, 다시 읽는 계기는 마운트와 실행이 정착하는 순간(TcTab 의 settle edge)뿐이다.
- Azure 어댑터가 `installation_status_unavailable` 을 떨어뜨리고 있었다(GCP 는 옮기고
  있었다). 그 한 칸이 없으면 「못 읽었다」가 조용히 「읽었다」가 되므로, 이 티켓의 판정보다
  먼저 고치고 트립와이어를 박았다 — 사용자 화면 Step 4 도 같이 덕을 본다.
- IDC 는 어댑터 자체가 없어 새로 썼다(`process-status/idc/install-detail-adapter.ts`).
  셀 키는 IDC Step 4 가 세우는 그 셋(`cx`·`bdp`·`firewall`), 이름도 그 화면의 낱말
  (`BDC CX 영역`·`BDC BDP 영역`·`접근 허용`)을 그대로 쓴다.
- 단계 이름은 셀의 `label` 에서 오지 않는다 — `InstallStepCell.label` 은 **상태** 라벨의
  덮어쓰기이지(Azure PE 의 「Azure Portal에서 승인 필요」) 단계 이름이 아니다. 키 → 이름
  매핑을 쓰고, 매핑에 없는 키는 원문 그대로 남긴다.
- 경고를 색만으로 말하지 않는다(WCAG 1.4.1) — 세 상자 전부 `StatusWarningIcon` 을 진다.
