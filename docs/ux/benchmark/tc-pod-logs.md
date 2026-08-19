# Admin TC 탭 — fail_reason·Pod 로그 (ResourceTable 구조 전환)

- 날짜: 2026-08-19
- 대상 화면: Admin · Target Source 운영 · Test Connection 탭
- 구현 PR: #729 (feat/tc-latest-pod)
- 디자인 아티팩트:
  - 최신 TC 결과 설계 (밴드 + ResourceTable + 로그 뷰어): https://claude.ai/code/artifact/8eb466c0-ba9b-4722-8381-ce14c5590735
  - TC 실패 사유 카탈로그 (12종 + fallback): https://claude.ai/code/artifact/181e31eb-28bf-476b-8c08-447b1a80f84e

## 문제 진단

1. **같은 리소스 명단이 화면에 두 번** (`UX 원칙` — 중복 표면): 최근 연결 테스트 카드의
   Agent별 결과 목록과 확정 정보 표가 같은 명단을 각자 그리고, 필터·페이저도 두 벌.
2. **내부 식별자 노출** (`제안` → 오너 확정): agent_id 열은 운영자의 질문("어느 리소스가
   왜 안 붙고 로그는 어디서 보나")에 등장하지 않는다.
3. **실패의 원인이 지면에 없다** (`UX 원칙` — 실패는 빈 결과가 아니다): 계약 예고 필드
   fail_reason(리소스·TargetSource 2단위)과 pod_id 를 실을 자리가 없었다.

## 채택안 — "집계는 밴드로, 사실은 표로"

- 최근 연결 테스트 카드 → **종합 상태 밴드**: 제목행(#N + pill) · 요약 한 줄
  (n건 성공·m건 실패 / 진행 n/m + PipelineProgressBar / "리소스별 결과 없음") ·
  **TargetSource 사유 줄**("사유 · 라벨 · 원문 enum", FAIL+값 있을 때만).
- Agent별 결과 목록 **제거**. 리소스별 사실은 전부 확정 정보 표의 열로:
  연결 상태(기존 ConnCell) 옆에 **실패 사유**(라벨+원문 2단) · **Pod 로그**(로그 조회
  countLink — pod_id 는 열이 아니라 이 액션의 열쇠, hover title 과 뷰어 헤더가 짊어진다).
- **로그 뷰어**: JobViewer 셸 재사용(ModalShell 720×572 · 드래그 그립 · 어두운 패널),
  본문은 severity+content 리스트, severity 필터는 클라이언트 칩(0건 숨김), 헤더에
  캡처 도장 — 새로고침 없음(완료 시점 캡처, StackDriver 쿼터 60/min 근거).
- **fail_reason 12종 허용목록 접기 맵** 한 벌을 두 단위가 공유. 밖의 값은 원문+중립.
  SECRET_NOT_FOUND 라벨 "Credential(Secret) 없음" / 설명 "Credential 설정 안 된 리소스
  존재"는 오너 지정 문안(2026-08-19).
- 오너 결정: 상태 태그는 **flat tag(점 없음)** — TcPill 의 6px 점 제거, 판정 라벨
  '미확인'으로 3곳 통일. 리소스 접기는 Step 5 와 같은 foldAgentStatuses
  (FAIL → UNKNOWN → RUNNING → PENDING → SUCCESS) 한 벌.
- 전면 실패(TERRAFORM_NOT_APPLIED 등): 표는 전행 무보고(—), 밴드 사유 줄이 유일한
  설명 — 요약문은 "리소스별 결과 없음"(0건 성공으로 세지 않는다).

## 레퍼런스 (아티팩트 §벤치마크 참조)

수치는 전부 기존 화면에서 재사용: 표 프레임 = 확정 정보 표 HEAD_CELL/CELL(12px/500 ·
18/16 · hairline), 로그 조회 = opsStyles.countLink, 진행 바 = PipelineProgressBar,
뷰어 = detailJobStyles(jobStyles), IDC 식별 = IdcEndpointCell(PR #724 규칙).

## 계약 상태 (DRAFT)

swagger 미랜딩 — 목(mock-test-connection.ts)이 DRAFT CONTRACT 로 시딩하고 읽기는
passthrough. 열린 결정: 부분 실패에서 run fail_reason 의 의미(값이 없으면 UI 는 줄
자체를 그리지 않으므로 어느 쪽으로 랜딩해도 안전), pod-logs 엔드포인트 경로 확정.
