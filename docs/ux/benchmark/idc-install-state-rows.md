# 인프라 작업 탭 「설치 상태」 — 어느 DB가 남았는지 한 행씩

- 날짜: 2026-09-14
- 대상: `/pass/admin/pipelines/ops/target-sources/{id}?tab=infra` 의 「설치 상태」 카드 단계 행
  (`InfraStatusHead` StepRow). 다섯 CSP 모두 같은 행이지만 발단은 IDC.
- 시안 아티팩트: https://claude.ai/code/artifact/46bf714c-0193-4dea-bc24-a3ef44a4c696
  (진단 7 · 레퍼런스 13 · 개선안 5 · 비교표)
- 구현 PR: #902
- 선행: [`infra-install-state.md`](./infra-install-state.md) — 판정 fold 와 판정 행은 그대로.

## 문제

오너(2026-09-14): "BDC 측 리소스 생성은 모든 리소스에 대해서 모두 허용돼야 한다. 방화벽 부분은
어떤 리소스가 연결이 안 되는지도 확인할 수 있으면 좋겠다."

| # | 진단 | 등급 |
|---|---|---|
| P1 | 한 행에 조각 넷(이름 240px · 주체 태그 · 상태 태그 · 건수). 태그가 둘이면 어느 것이 상태인지 먼저 골라야 한다. | UX 원칙 |
| P2 | 「5건 중 1건 남음」이 세 행에 같은 값으로 반복. 리소스 하나가 세 단계 모두 미완이면 그렇게 된다. 「대기」 행에 건수가 붙어 모순처럼 읽힌다. | UX 원칙 |
| P3 | 접근 허용 행이 어느 DB인지 말하지 않는다. `installation-status` 는 `resource_id` 만 준다(IDC 는 `resource_name` 없음). | UX 원칙 |
| P4 | "BDC 는 전건 적용돼야 끝난다"는 규칙이 화면에 없다. | UX 원칙 |
| P5 | 같은 주황이 주체 태그·상태 태그·판정 태그 세 자리에서 겹친다. | UX 원칙 |
| P6 | 판정문 · 판정 태그 · 행 태그 둘이 같은 사실을 세 번 말한다. | UX 원칙 |
| P7 | 한 행에서 주체 태그 23px, 상태 필 20px — 컨트롤 높이 불일치. | 수치 위반 |

## 쓴 레퍼런스

| 출처 | 빌린 요소 |
|---|---|
| [Cloudscape Steps](https://cloudscape.design/components/steps/) · [Carbon progress indicator](https://carbondesignsystem.com/components/progress-indicator/usage/) | 행 = 제목 + 상태 하나, 세부는 아래 슬롯. 행동 없는 자리(대기·완료)는 태그 대신 평문. |
| [GitHub merge box](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) | 판정은 위에서 한 번. 아래 행은 게이트별 사실만. |
| [Kubernetes rollout status](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) | 수는 미완일 때만 `x/N`. 완료는 「N건 모두 완료」 로 전건 규칙을 말한다. |
| [Azure connection troubleshoot](https://learn.microsoft.com/en-us/azure/network-watcher/connection-troubleshoot-overview) · [AWS Reachability Analyzer](https://docs.aws.amazon.com/vpc/latest/reachability/what-is-reachability-analyzer.html) | 리소스 정체는 행 제목의 `ip:port`, 그 뒤 판정어. |
| [Statuspage component groups](https://support.atlassian.com/statuspage/docs/show-service-status-with-components/) | 하나라도 미완이면 하위 목록을 편다. |
| [Systems Manager compliance](https://docs.aws.amazon.com/systems-manager/latest/userguide/compliance-about.html) | 건수가 같은 표면의 정체 목록으로 이어진다. |

## 채택: D 안 (A 행 정리 + 지금 차례 행만 리소스 펼침)

비교표에서 P1~P7 을 전부 닫는 안은 C(리소스×단계 표)와 D 둘. C 는 4R 매트릭스 A 의 열린 결정
4건이 선행돼야 하고, 흔한 상태(두 단계 전건 완료)에서 표의 2/3 가 「완료」로 채워진다. D 는 판례
충돌이 없고, 오너 규칙 "지금 차례 하나"를 화면 구조로 옮긴다.

단계 행:
- 이름(240px) 뒤 주체를 약한 텍스트 「· 관리자」/「· 서비스」 로. 주체 태그 삭제.
- 상태는 한 조각: 지금 차례 행만 태그 「조치 필요」(+ `N건 중 M건 남음`), FAIL 이면 태그
  「조회 실패」(+ `N건 중 M건 조회 실패`). 완료 행은 `N건 모두 완료`(ok 색 텍스트), 뒤 행은 「대기」.
- 지금 차례 행 아래 열린 리소스 **아코디언 표**(`open`, 오너 2026-09-15 "아코디언 테이블로"): 네이티브
  `<details open>` 접기(GCP Subnet 안내와 같은 접기, 머리 「남은 리소스 N건」) 안에 확정 정보 표의 셀로
  접속 주소 · **BDC측 출발지**(오너 09-15 "bdc측 접속주소도 보여줘야지" — 확정 정보의 `idc_source_ips`, 한 줄에
  하나, 출발지가 있는 표에만 열이 선다) · DB 종류 · 상태. 상태는 「조회 도중 실패」 또는 단계 낱말 — 접근 허용은 「서비스측 방화벽
  확인 요청 필요」(오너 낱말), 그 외는 「조치 필요」. guide 는 상태 셀 둘째 줄. 정착된 리소스는 표에
  없다(건수가 이미 말한다).
- 예외(오너 2026-09-15): 리소스 행이 서는 곳은 **IDC 접근 허용과 Azure** 뿐이다. IDC BDC 측(CX·BDP)은
  "됐다 / 안 됐다"만 — DB IP 를 노출하지 않는다. AWS 와 GCP 는 어느 단계에도 리소스 행이 없다. 건수와
  guide·개발자 문구는 그대로(`listResources: false`).

정체 조인(`installIdentity.ts`): 확정 정보 응답을 `resource_id` 로 붙인다. CSP 이름이 있으면 이름,
IDC 는 확정 IDC 표와 같은 규칙으로 `host:port`(IP 모드 ips · HOST 모드 host · 없으면 `host`),
그것도 없으면 wire id. 조회 실패는 조용히 id 로 떨어진다 — 판정과 건수는 조인에 기대지 않는다.

낱말(오너 2026-09-14): FAIL 은 **조회 실패**다. 단계 태그 「조회 실패」 · 건수 `N건 중 M건 조회 실패` ·
리소스 행 「조회 도중 실패」 · guide 가 있으면 그 아래. "포트가 열려 있지 않습니다" 같은 원인 문장은
쓰지 않는다 — 계약은 무엇이 실패했는지 말하지 않는다. 실패가 하나라도 있으면 목록 끝에 한 줄:
「조회 실패가 여러 번 이어지면 개발자에게 연락하세요.」(오너: 반복되는 조회 실패는 관리자가 아니라
개발자의 몫).

수치 출처: 행 30px·이름 240px·필 20px 는 현행 StepRow. 하위 행 26px·좌측 2px 선·들여쓰기 12 는
GCP Subnet 안내 블록과 같은 children 자리. 주소 mono 12px 는 `tc/LdbViewModal`. 정체 폭 200 은
확정 정보 IDC 표 주소 열(220)에서 셀 패딩을 뺀 값.

## 안 한 것

- 「모두 보기」(정착된 리소스까지 펼치기)와 하위 행 넷째 칸(출발지 IP)은 두지 않았다. 오너 미결.
- 리소스 × 단계 표(C)는 4R 매트릭스 A 결정 뒤.
- B(주체별 묶음)는 Azure 순서(서비스→서비스→관리자→서비스)를 깨서 기각. E(타임라인)는 「상태는
  텍스트 태그」 판례와 #895 판정 행 문법에 어긋나 기각.
