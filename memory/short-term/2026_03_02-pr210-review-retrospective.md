# PR #210 pr-context-review 회고 및 수정 내역

## 0. 리뷰 기준
- PR: https://github.com/bluefa/pii-agent-demo/pull/210
- Head SHA: `ea1599e` (리뷰 시작 시점)
- 리뷰 방식: `pr-context-review` 기준 (메타/설명/코드/테스트/기존 코멘트 교차 검증)

## 1. 20개 점검 항목 결과
1. PR title/body와 실제 변경 범위 일치성 확인
2. base/head/최신 SHA 동기화 확인
3. commit 히스토리 순서/의도 확인
4. files changed 전체 목록 확인
5. ADR/Swagger 계약 파일 변경 확인
6. v1 타입(`app/api/_lib/v1-types.ts`) 일치성 확인
7. AWS v1 transform 로직 확인
8. `installation-status` route 계약/transform 적용 확인
9. `check-installation` route 계약/transform 적용 확인
10. `AwsInstallationInline` 상태 표시 로직 확인
11. `ProcessStatusCard` polling/effect 동작 확인
12. 재확정(createApprovalRequest) 후 상태 초기화 경로 확인
13. `mock-installation` store 갱신 경로 확인
14. `mock-data.updateProject` side effect 확인
15. 승인/반려/취소 경로 상태 전이 확인
16. AWS script naming/grouping 로직 회귀 확인
17. transform 단위 테스트 확인
18. mock-installation 단위 테스트 확인
19. confirm process status 단위 테스트 확인
20. 타입체크(`tsc --noEmit`) 확인

결론: **1개 기능 결함 발견, 수정 완료.**

## 2. 발견 결함 및 수정

### [수정 완료] Cloud 리소스 재확정 시 AWS 설치 상태가 초기화되지 않음
- 영향:
  - 기존 완료된 설치 상태(`store.awsInstallations`)가 유지되어,
  - 재확정 이후에도 설치 진행 UI가 이전 상태를 그대로 보여줄 수 있음.
- 원인:
  - `createApprovalRequest`가 `project.status`만 갱신하고 AWS 설치 store를 재생성하지 않음.
- 수정:
  - `createApprovalRequest`에서 `terraformState`를 재요청 시작 상태(`PENDING`)로 재설정.
  - AWS인 경우 `mockInstallation.initializeInstallation()`을 호출해 설치 상태 store 초기화.
- 수정 파일:
  - `lib/api-client/mock/confirm.ts`
- 회귀 테스트:
  - `lib/__tests__/mock-confirm-process-status.test.ts`에
    `Cloud 리소스 재확정 시 AWS 설치 상태를 초기화한다` 케이스 추가.

## 3. 왜 잘못 구현되었는가 (원인 분석)

### 원인 A: 상태 저장소 이중화 인지 누락
- 화면/프로세스 상태는 `project.status`를 사용하지만,
- AWS 설치 진행 상세는 별도의 `store.awsInstallations`를 사용.
- 재확정 경로에서 `project.status`만 리셋되어도 UI 일부는 정상처럼 보이므로, 누락이 늦게 드러남.

### 원인 B: 요구사항 변경이 UI 중심으로 빠르게 반복
- 상태 표현(완료/미완료 ↔ COMPLETED/INSTALLING/FAILED/PENDING), 표시 단위(리소스/스크립트), 모달 구조가 여러 차례 변경됨.
- 이 과정에서 “재확정 시 내부 store 재초기화” 같은 라이프사이클 규칙이 명시적으로 고정되지 못함.

## 4. 구현 시간이 길어진 이유 (요청/지시 관점)

### 4-1. 기능 목표가 단계적으로 진화함
- 같은 세션에서 아래가 순차적으로 바뀜:
  - 상태 모델
  - UI 레이아웃
  - 상세 정보 범위
  - 스크립트 네이밍 규칙
- 결과적으로 이미 구현한 부분을 여러 번 재정렬해야 했음.

### 4-2. “필수/선택” 경계가 초기에 고정되지 않음
- 예: `autoMode` 활용 여부, BDC 상세 노출 범위, 상태 enum granularity.
- 구현 후반에 기준이 정리되면서 회귀성 수정이 반복됨.

### 4-3. PR 설명과 실제 구현 범위의 괴리
- PR body는 docs-only 성격인데 실제는 코드 변경이 대규모로 포함됨.
- 리뷰 시 문서/코드 괴리 해소 비용이 추가됨.

## 5. 다음 세션에서 사용자 확인 체크리스트 (권장)

1. **상태 모델 고정**
   - 최종 enum, 단계 전이 규칙, “재확정 시 초기화 대상”을 먼저 고정.
2. **표시 단위 고정**
   - 리소스 단위 vs 스크립트 단위 vs 단계(progress) 단위를 먼저 확정.
3. **모드별 차이 정책 고정**
   - AUTO/MANUAL 차이를 숨길지/노출할지 명확히 합의.
4. **계약 우선순위 지정**
   - Swagger/Mock/UI 중 무엇을 source of truth로 볼지 먼저 선언.
5. **완료 조건(DoD) 사전 합의**
   - 예: “재확정 후 installation-status 첫 조회는 반드시 PENDING 시작” 같은 검증 조건 포함.
6. **PR 스코프 명시**
   - PR 제목/본문과 실제 변경 범위를 반드시 일치시키기.
