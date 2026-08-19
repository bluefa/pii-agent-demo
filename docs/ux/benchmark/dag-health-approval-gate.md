# 관리자 승인 헬스 게이트 — 벤치마크 결정 기록

- 날짜: 2026-08-19
- 대상 화면: `/admin/pipelines/ops/target-sources/{id}?tab=approval` (ApprovalTab)
- 아티팩트: https://claude.ai/code/artifact/f88c8f93-df0c-4253-9af6-9123a8914609
- 구현 PR: #734 (1차 — 시안 A+B)

## 문제 요약 (증거 등급)

| # | 문제 | 등급 |
|---|------|------|
| P1 | 게이트 조건이 2개(TC 완료 ∧ HEALTHY)가 되면 현행 "문장 한 줄 + 버튼 언마운트" 문법이 부분 충족을 표현하지 못함 | UX 원칙 (상태 가시성) |
| P2 | 승인 근거가 집계 타일 5개뿐 — 개체 수준 근거 없음 | UX 원칙 (결정 근거) |
| P3 | 새 API의 DAG 주간 상태가 화면 어디에도 없음 | 제안 (요구 3번) |
| P4 | databaseUri 1,500+ 행을 기존 목록 문법(TcAgentResultList, "30건 규모 전제")이 감당 못 함 | 수치 위반 (컴포넌트 전제 초과) |
| P5 | 로딩·조회 실패·미지 enum 상태의 잠금이 미정의 | UX 원칙 (실패는 빈 결과가 아니다 판례) |
| P6 | databaseName null 가능(Infra Manager 재배포 전) — URI가 1급 정체성이어야 함 | 제안 (계약 사실) |

## 실제 차용한 레퍼런스

시안 A (승인 조건 체크리스트):
- GitHub protected branches / required status checks — 조건 행 + 완료형 서술문: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches
- GitLab merge checks — 부분 충족의 행별 표현: https://docs.gitlab.com/user/project/merge_requests/status_checks/
- Vercel Checks — 재실행(다시 확인) CTA를 조건 행에 부착: https://vercel.com/docs/checks
- Terraform Cloud run states — Confirm/Discard 쌍(재실행 요청 상시 마운트): https://developer.hashicorp.com/terraform/cloud-docs/run/states

시안 B (헬스 요약 밴드):
- Atlassian Statuspage — 판정 한 문장 헤드(솔리드 배너는 "상태색은 점으로" 판례에 따라 점+문장으로 번역): https://www.githubstatus.com/
- Cloud Composer 모니터링 대시보드 — 집계 kv + 스코프 캡션: https://docs.cloud.google.com/composer/docs/composer-3/use-monitoring-dashboard
- Argo CD health — 롤업 판정과 하위 사실의 분리: https://argo-cd.readthedocs.io/en/stable/operator-manual/health/

## 채택안과 이유

비교표에서 P1·P5(게이트 정확성)를 자기 메커니즘으로 해소하는 시안은 A뿐, P4(1,500행)는 D뿐.
따라서 2단계 PR — **1차 = A+B**(게이트 완결 + 요약 판정, 이 PR), **2차 = C+D+E**(리소스 테이블 +
논리 DB 주간 보드 + 툴팁·필터 착지). 순서는 게이트(기능)가 현황판(관측)보다 먼저.

핵심 구현 결정:
- 활성화는 허용 목록으로만: `healthStatus === 'HEALTHY'`. 로딩·실패·미지 enum 전부 잠금 (진리표 7상태, `approvalGate.ts` + 테스트 11개).
- 재실행 요청은 TC 완료 이후 상시 마운트 — UNHEALTHY의 유일한 탈출 CTA. 단 "재실행이 헬스를 고친다"고 말하지 않음(계약이 말하지 않는 인과).
- 계약은 swagger 미랜딩 → mock-first, `docs/api/ops-assumed-contracts.md` §10 (camelCase wire, `/install/monitoring` base).

## 2차 PR — 시안 C+D+E 구현 (2026-08-19)

관측층 세 개가 요약 밴드 아래에 선다: L2 리소스(에이전트)별 주간 DAG 표(C) →
L3 논리 DB 주간 보드(D) + 셀 툴팁·필터 착지(E). 파생 로직은 `dagBoard.ts` 한 파일
(전부 allowlist — 계약 밖 enum 은 'unknown'/'other'/'미확인'으로 떨어지고 아는
상태로 위장하지 않는다).

원안에서 수정된 결정:

- **확정 리소스 조인 보류 (C).** 원안은 agents[] 를 확정 리소스와 resourceId 로
  조인해 CSP별 열을 상속하는 것이었으나, 조인이 더할 identity 필드가 전부 미결
  계약 질문이다 — resource_name 은 확정 스냅샷(§06-5 의 이중 출처 문제), region 은
  비-GCP 필드명 미확정(§06-4). 이 응답이 스스로 보증하는 정체성은 resourceId 뿐이라
  이름줄은 표시용 꼬리(`agentDisplayName` — 경로는 '/', ARN 은 ':' 마지막 조각),
  Region 열은 계약의 gcpRegion 이 있을 때만 값이 선다. BE 가 §06-4·5 에 답하면
  조인 어댑터가 후속.
- **행 선택 대신 one-shot 착지 (C→D).** 원안의 "행 선택 = 보드의 에이전트 필터"는
  두 컴포넌트의 선택 상태 동기화를 만든다. "DB 보기" 는 착지(보드 리마운트 + 스코프
  칩)로 바꿨다 — 보드가 스코프를 칩으로 보여 주고 스스로 해제하므로 표에는 상태가
  없다. "DB 보기"의 착지 필터는 전체다(그 에이전트의 DB 전부를 약속하는 문구).
- **floor 는 pageSize 가 아니라 스코프 상한.** pageSize(20) 그대로 깔면 3행짜리
  대상에 20행의 빈 벽이 선다. floor = `min(pageSize, scoped.length)` — 어떤 칩을
  눌러도 pager 가 움직이지 않는 최소값.
- **착지 스크롤은 커밋 이후 + instant.** 클릭 시점의 smooth 스크롤은 보드
  리마운트로 문서 높이가 바뀌는 것과 경합해 중간에 끊긴다(실측). effect(seq 변화)
  에서 instant 로 — smooth 는 rAF 기반이라 비포커스 탭에서 진행되지 않고,
  reduced-motion 사용자에게 착지는 이동이지 연출이 아니다.
- **셀 툴팁은 native title (E).** 같은 정보(이번 주·마지막 성공)가 행 열에 이미
  있어 hover 는 보조 채널 — 스타일드 툴팁은 도입하지 않았다. 미지의 day status 의
  raw 는 툴팁 채널이므로 실을 수 있다(문장·라벨 금지 규칙과 일관).
- **UNHEALTHY 진입의 실패 선적용은 실패>0 일 때만.** 전부 미스케줄인 UNHEALTHY 에서
  실패 필터를 걸면 빈 보드가 첫 화면이 된다.

## 구현 중 수정된 결정 (2026-08-19, 오너 반려)

진리표 7행(미지 enum)의 최초 문구 "미확인 — healthStatus: DEGRADED"(enum 원문 노출)는 반려됨.
wire 어휘(enum raw·필드명)는 문장층에 싣지 않는다 — 문구는 "판정할 수 없어요"까지만, raw 값은
title 툴팁 채널로 강등. 근거: 기존 판례 "업스트림 message는 UI 문구가 아니다"의 일반화 +
TcStatusTag 선례(UNKNOWN → '미확인', raw 없음). 테스트가 부재를 고정한다
(`expect(desc).not.toContain(raw)`). 목 시드도 계약이 선언한 enum 안에서만 만든다 —
방어 경로(7행)는 유닛 테스트로만 덮는다. 아티팩트 진리표도 같은 내용으로 수정 배포됨.
