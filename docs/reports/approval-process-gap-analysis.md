# 연동 승인/확정 프로세스 — 현황 조사 + 갭 분석 + 실행 계획

> 작성일: 2026-02-17
> 참조: ADR-006, ADR-009, confirm.yaml

## A. Executive Summary

1. **API 라우트/Swagger 계약은 완료**, 그러나 내부 로직(calculator, mock, types)은 ADR-006 3객체 모델로 미전환
2. **calculator.ts**: ADR-009 우선순위(request→approved→confirmed) 미적용 — 단일 `ProjectStatus` 기반 계산 유지 중
3. **types.ts**: `ApprovalRequest`, `ApprovedIntegration`, `ConfirmedIntegration` 등 ADR-006 핵심 타입 누락
4. **mock confirm.ts**: 409 conflict 처리는 구현됨, 그러나 `approveApprovalRequest()`에서 ApprovedIntegration 스냅샷 생성 누락
5. **Admin UX**: 최신 승인 요청 1건만 조회, 리소스 타입/connection status/integrationCategory 미표시, 변경 전/후 Diff 없음
6. **ID 체계**: URL `projectId`(string) → `targetSourceId`(number) 변환은 작동하나, IDC legacy API는 여전히 string ID 사용
7. **IDC/History API**: v1 마이그레이션 미완료 (`/api/idc/projects/*`, `/api/projects/{id}/history`)
8. **P0 조치**: calculator 3객체 로직 전환 + 누락 타입 추가 + approve 스냅샷 생성

---

## B. As-Is 인벤토리 표

### B-1. 상태 변경 API (POST/PATCH/PUT/DELETE)

| 영역 | 파일 | API | Method | 상태변경 | 근거 |
|------|------|-----|--------|---------|------|
| 승인요청 | AwsProjectPage.tsx | `/v1/target-sources/{id}/approval-requests` | POST | Y | :210 |
| 승인요청 | AzureProjectPage.tsx | 동일 | POST | Y | :171 |
| 승인요청 | GcpProjectPage.tsx | 동일 | POST | Y | :156 |
| 승인처리 | AdminDashboard.tsx | `/v1/target-sources/{id}/approval-requests/approve` | POST | Y | :124-136 |
| 반려처리 | AdminDashboard.tsx | `/v1/target-sources/{id}/approval-requests/reject` | POST | Y | :138-150 |
| Credential | Aws/Azure/Gcp/IdcProjectPage | `/v1/target-sources/{id}/resources/credential` | PATCH | Y | 각 :111/:70/:57/:75 |
| 연결테스트 | Aws/Azure/Gcp/IdcProjectPage | `/v1/target-sources/{id}/test-connection` | POST | Y | 각 :136/:95/:82/:100 |
| 스캔 | ScanPanel | `/v1/target-sources/{id}/scan` | POST | Y | scan.ts:18 |
| 설치확정 | (Admin) | `/v1/target-sources/{id}/pii-agent-installation/confirm` | POST | Y | confirm/route.ts:6 |
| IDC 리소스수정 | IdcProjectPage | `/api/idc/projects/{id}/update-resources` | POST | Y | :153 |
| IDC 방화벽확인 | IdcProjectPage | `/api/idc/projects/{id}/confirm-firewall` | POST | Y | :200 |
| IDC 설치재시도 | IdcProjectPage | `/api/idc/projects/{id}/check-installation` | POST | Y | :225 |
| IDC 대상확정 | IdcProjectPage | `/api/idc/projects/{id}/confirm-targets` | POST | Y | :253 |

### B-2. 조회 API (GET)

| 영역 | 파일 | API | Method | 근거 |
|------|------|-----|--------|------|
| 프로젝트상세 | ProjectDetail.tsx | `/v1/target-sources/{id}` | GET | :34 |
| 사용자 | ProjectDetail.tsx | `/v1/user/me` | GET | :35 |
| Credential목록 | ProjectDetail.tsx | `/v1/target-sources/{id}/secrets` | GET | :42 |
| 프로세스상태 | ProcessStatusCard.tsx | `/v1/target-sources/{id}/process-status` | GET | :106 (10초 폴링) |
| 승인이력 | AdminDashboard.tsx | `/v1/target-sources/{id}/approval-history` | GET | :112 (size=1) |
| 승인완료정보 | (route만 존재) | `/v1/target-sources/{id}/approved-integration` | GET | route.ts:6 |
| 확정정보 | (route만 존재) | `/v1/target-sources/{id}/confirmed-integration` | GET | (swagger만) |
| AWS설치상태 | AwsProjectPage | `/v1/aws/target-sources/{id}/installation-status` | GET | :69 |
| AWS설정 | AwsProjectPage | `/v1/aws/target-sources/{id}/settings` | GET | :70 |
| Azure설정 | AzureProjectPage | `/v1/azure/target-sources/{id}/settings` | GET | :50 |
| 스캔작업 | ScanPanel | `/v1/target-sources/{id}/scanJob/latest` | GET | scan.ts:25 (2초 폴링) |
| 스캔이력 | ScanPanel | `/v1/target-sources/{id}/scan/history` | GET | scan.ts:29 |
| 프로젝트이력 | ProjectHistoryPanel | `/api/projects/{id}/history` | GET | :52 (legacy) |
| IDC설치상태 | IdcProjectPage | `/api/idc/projects/{id}/installation-status` | GET | :53 (legacy) |

---

## C. ADR/Swagger 대비 갭 분석 표

| # | 요구사항 | 현재 구현 | 갭 | 영향도 | 권장 조치 |
|---|---------|----------|-----|-------|----------|
| 1 | **3객체 분리** (ADR-006 D-001): Confirmed/Approved/Request 분리 | `ProjectStatus` 단일 객체 기반 계산 | 계산 로직이 3객체 존재 여부를 확인하지 않음 | **P0** | calculator.ts 3객체 우선순위 로직으로 전환 |
| 2 | **BFF 4상태 enum** (ADR-009 D-004): REQUEST_REQUIRED / WAITING_APPROVAL / APPLYING_APPROVED / TARGET_CONFIRMED | FE `ProcessStatus` 6단계 enum (1~6) + `computeProcessStatus()` 변환 | 변환 함수가 3객체가 아닌 FE enum 매핑만 수행 | **P0** | computeProcessStatus()를 3객체 존재 기반으로 재작성 |
| 3 | **누락 타입** (ADR-006 D-009): ApprovalRequest, ApprovalResult, ApprovedIntegration, ConfirmedIntegration | types.ts에 미정의 | Swagger 스키마와 FE 타입 불일치 | **P0** | types.ts에 4개 타입 추가 |
| 4 | **approve 시 스냅샷** (ADR-006 D-008): 승인 → ApprovedIntegration 생성 | confirm.ts `approveApprovalRequest()`에서 Project.status만 수정 | 스냅샷(resource_infos, excluded_resource_ids) 미생성 | **P0** | approve 함수에 ApprovedIntegration 생성 로직 추가 |
| 5 | **Admin UX 정보밀도** (ADR-006 D-010): 변경 전/후 비교, 영향 범위 | 리소스 ID + endpoint + credential_id만 표시 | 리소스 타입, connection status, integrationCategory 미표시 | **P1** | ApprovalDetailModal에 컬럼 추가 |
| 6 | **승인 이력 전체 조회**: approval-history 페이징 | Admin에서 size=1 최신 1건만 조회 | 과거 반려 사유, 재요청 횟수 확인 불가 | **P1** | 승인 이력 뷰 추가 또는 링크 제공 |
| 7 | **IDC v1 마이그레이션**: `/api/idc/projects/*` → v1 | 5개 IDC endpoint가 legacy 경로 유지 | 2개 ID 체계 병존 (string vs number) | **P2** | IDC API v1 마이그레이션 계획 수립 |
| 8 | **History API 마이그레이션**: `/api/projects/{id}/history` → v1 | legacy 경로 유지 | v1 라우트 미정의 | **P2** | History v1 라우트 추가 |
| 9 | **confirmed-integration GET**: Swagger 정의 존재 | route 존재하나 FE에서 미호출 | 확정 정보를 별도 조회하지 않음 | **P2** | processStatus 확인 후 필요 시 호출 추가 |
| 10 | **Diff 표시** (변경 전/후): 관리자 의사결정 근거 | 미구현 | 기존 연동 vs 신규 요청 비교 불가 | **P1** | confirmed-integration과 request 비교 로직 추가 |

---

## D. mock-data 변경 설계

### D-1. 즉시 수정 필요

| 파일 | 변경 | 마이그레이션 방식 | 테스트 포인트 |
|------|------|-----------------|-------------|
| **types.ts** | `ApprovalRequest`, `ApprovalResult`, `ApprovedIntegration`, `ConfirmedIntegration`, `TargetSourceProcessStatus` 타입 추가 | Swagger confirm.yaml 스키마 기반 신규 정의 | 타입 컴파일 통과 |
| **confirm.ts `computeProcessStatus()`** | 3객체 존재 여부 기반으로 재작성 (ADR-009 우선순위) | `has_pending_request` → `has_approved` → `has_confirmed` → `REQUEST_REQUIRED` | 6가지 유효 상태 조합 각각 테스트 |
| **confirm.ts `approveApprovalRequest()`** | ApprovedIntegration 객체 생성 + mock store에 저장 | 기존 `Project.status.approval` 수정은 유지, ApprovedIntegration 병행 생성 | 승인 후 `getApprovedIntegration()` 조회 시 스냅샷 반환 확인 |

### D-2. 점진 전환 가능

| 파일 | 변경 | 마이그레이션 방식 | 테스트 포인트 |
|------|------|-----------------|-------------|
| **calculator.ts** | 3객체 기반 계산 로직 추가 | BFF processStatus API를 우선 사용하도록 전환, calculator는 fallback | ProcessStatusCard 폴링 정상 동작 |
| **mock-data.ts `createStatusForProcessStatus()`** | 3객체 존재 조합 기반 생성 | 기존 함수 시그니처 유지, 내부에서 3객체 조합 결정 | 모든 프로젝트 목록 정상 렌더링 |
| **confirm.ts `createApprovalRequest()`** | ApprovalRequest 객체를 별도 store에 저장 | 기존 Project.status.approval 수정과 병행 | 요청 생성 → approval-history 조회 시 일관성 |
| **mock-data.ts `Resource.exclusion`** | ADR-006에서 제거 예정이나 당장 유지 | ApprovalRequest 수준으로 이동 시 점진 제거 | 기존 제외 리소스 UI 정상 동작 |

### D-3. 유지 가능

| 파일 | 항목 | 사유 |
|------|------|------|
| **mock-history.ts** | ProjectHistory 타입, inputData 스냅샷 | ADR-006 이력 요구사항 충족 |
| **types.ts** | IntegrationCategory enum | ADR-006 D-009과 일치 |
| **confirm.ts** | 409 conflict 처리 (CONFLICT_APPLYING_IN_PROGRESS, CONFLICT_REQUEST_PENDING) | ADR-009 D-006 구현 완료 |

---

## E. Admin 승인 UX 개선안

### E-1. 승인 프로세스 현황

```
[사용자] 리소스 선택 → POST /approval-requests → 상태: WAITING_APPROVAL
    ↓
[관리자] 대시보드에서 "승인 요청 확인" 클릭 → GET /approval-history?size=1
    ↓
[관리자] ApprovalDetailModal에서 내용 확인
    ├─ 승인 → POST /approval-requests/approve → INSTALLING
    └─ 반려 → POST /approval-requests/reject → WAITING_TARGET_CONFIRMATION
```

### E-2. 현재 문제점

| 문제 | 영향 | 근거 |
|------|------|------|
| **리소스 타입 미표시** | 관리자가 어떤 종류의 리소스인지 모름 | ApprovalDetailModal.tsx:169-206 |
| **connection status 미표시** | 연결 상태 확인 없이 승인 | ApprovalDetailModal에 해당 컬럼 없음 |
| **integrationCategory 미표시** | 설치 불가/불필요 리소스 구분 불가 | ApprovalDetailModal에 해당 컬럼 없음 |
| **승인 이력 1건만** | 과거 반려 사유 확인 불가 | AdminDashboard.tsx:112 size=1 |
| **변경 Diff 없음** | 기존 대비 무엇이 바뀌는지 알 수 없음 | confirmed-integration 미조회 |
| **credential 이름 미표시** | credential_id(숫자)만 보임 | ApprovalDetailModal.tsx:193 |

### E-3. Quick Win (오늘 적용 가능)

| # | 개선 | 변경 대상 | 예상 작업량 |
|---|------|----------|-----------|
| QW-1 | 포함/제외 리소스 개수 요약 카드 (모달 상단) | ApprovalDetailModal.tsx | ~20줄 |
| QW-2 | 리소스 타입 컬럼 추가 (아이콘 + 텍스트) | ApprovalDetailModal.tsx | ~15줄 (데이터 보강 필요) |
| QW-3 | "승인 이력 보기" 링크 (모달 푸터 → 프로젝트 상세) | ApprovalDetailModal.tsx | ~10줄 |
| QW-4 | ProjectsTable에 리소스 개수 컬럼 | ProjectsTable.tsx | ~10줄 |

### E-4. 필수 개선 (구조 변경)

| # | 개선 | 변경 범위 | 의존성 |
|---|------|----------|--------|
| NE-1 | **변경 Diff 표시**: confirmed-integration 조회 → request와 비교 → 신규/제거/변경 하이라이트 | ApprovalDetailModal + confirmed-integration API 호출 추가 | confirmed-integration GET 구현 필요 |
| NE-2 | **승인 이력 전용 뷰**: AdminDashboard에 탭 추가 또는 모달 내 이력 섹션 | AdminDashboard + 새 컴포넌트 | approval-history API 페이징 활용 |
| NE-3 | **ApprovedIntegration 진행 표시**: 반영 중 상태에서 Terraform 진행률 표시 | AdminDashboard + ProcessStatusCard 패턴 재사용 | approve 시 스냅샷 생성 (D-1) |
| NE-4 | **승인 체크리스트**: 관리자 가이드 (제외 사유 합당성, credential 변경 확인 등) | ApprovalDetailModal | 없음 (순수 UX) |

### E-5. 정보 밀도 비교 — 승인 UX vs 연동 대상 목록 UX

| 정보 항목 | 승인 요청 (Admin) | 승인 이력 | 연동 대상 목록 (User) | 갭 |
|----------|:-:|:-:|:-:|------|
| 리소스 ID | O | O | O | - |
| 리소스 타입 | **X** | X | O | Admin 미표시 |
| Endpoint 설정 | O (읽기) | O | O (편집) | - |
| Credential | ID만 | O | 이름+드롭다운 | Admin은 ID만 |
| Connection Status | **X** | X | O | Admin 미표시 |
| integrationCategory | **X** | X | O | Admin 미표시 |
| 제외 사유 | O | O | O | - |
| 변경 전/후 Diff | **X** | X | 편집모드 비교 | Admin 없음 |
| 승인 히스토리 | 1건만 | 페이징 지원 | 진행내역 탭 | Admin 미활용 |
| 총 개수 요약 | **X** | X | 뱃지 표시 | Admin 없음 |

---

## F. 실행 계획

### Phase 1: P0 구현

| 작업 | 파일 | DoD |
|------|------|-----|
| types.ts BFF 타입 추가 | lib/types.ts | tsc 통과, Swagger 스키마와 필드 일치 |
| computeProcessStatus 재작성 | lib/api-client/mock/confirm.ts | 3객체 존재 기반 상태 반환 |
| approveApprovalRequest 스냅샷 생성 | lib/api-client/mock/confirm.ts | 승인→getApprovedIntegration 조회 시 스냅샷 존재 |
| calculator.ts 3객체 로직 | lib/process/calculator.ts | ProcessStatusCard 정상 렌더링 |

### Phase 2: Quick Win UX

| 작업 | 파일 | DoD |
|------|------|-----|
| ApprovalDetailModal 개수 요약 | app/components/features/admin/ApprovalDetailModal.tsx | 포함/제외 개수 모달 상단에 표시 |
| "승인 이력 보기" 링크 | app/components/features/admin/ApprovalDetailModal.tsx | 클릭 시 프로젝트 상세로 이동 |

### Phase 3: P1 구현 (후속 PR)

| 작업 | 파일 | 의존성 |
|------|------|--------|
| 변경 Diff 표시 | ApprovalDetailModal | confirmed-integration GET 호출 추가 |
| 승인 이력 전용 뷰 | AdminDashboard | approval-history 페이징 활용 |
| ApprovedIntegration 진행 표시 | AdminDashboard | approve 스냅샷 (Phase 1) |

### 리스크

| 리스크 | 완화 |
|--------|------|
| calculator 변경 시 기존 UI 사이드이펙트 | BFF processStatus API 우선 사용, calculator는 mock fallback으로 유지 |
| 타입 추가 시 기존 코드 컴파일 에러 | 신규 타입은 optional import, 기존 ProjectStatus 타입 유지 |
| ApprovedIntegration store 추가 시 mock 데이터 초기화 | store 초기값에 빈 Map 추가, 기존 프로젝트에 영향 없음 |

---

## G. 승인 후 설치 반영 소요시간

### G-1. 실제 환경

승인(`APPROVED` / `AUTO_APPROVED`) 후 설치가 완료되어 `TARGET_CONFIRMED`에 도달하기까지의 소요시간:

| 구간 | 소요시간 | 설명 |
|------|---------|------|
| 승인 → Terraform 적용 시작 | 즉시~수분 | BFF가 Terraform plan/apply를 큐에 등록 |
| Terraform 적용 | 1분~수시간 | 리소스 수, Provider 응답 시간에 따라 다름 |
| 연결 테스트 | 수초~수분 | 네트워크 설정, 방화벽 적용 대기 포함 |
| 전체 (승인 → 확정) | **빠르면 1분, 최대 하루 이상** | Provider별/리소스 규모별 편차 큼 |

### G-2. Mock 환경

- Mock에서는 승인 후 **10초 지연**을 시뮬레이션합니다.
- `confirmInstallation()`은 승인 시각으로부터 10초 미경과 시 `409 INSTALLATION_IN_PROGRESS`를 반환합니다.
- 응답에 `estimated_remaining_seconds` 필드로 남은 대기 시간을 제공합니다.

### G-3. 사용자 고지 필수 (UX 요구사항)

**`APPLYING_APPROVED` 상태에서 사용자에게 반드시 다음을 고지해야 합니다:**

1. **현재 상태**: 승인된 연동 설정이 반영 중임을 명시
2. **예상 소요시간**: "빠르면 수분, 최대 하루 이상 소요될 수 있습니다"
3. **진행 상황**: 가능한 경우 Terraform 적용 단계를 표시 (service TF / bdc TF)
4. **재요청 불가 안내**: 반영 완료 전 연동 대상 변경이 불가함을 안내 (409 conflict)
5. **완료 알림**: 반영 완료 시 별도 알림 또는 폴링 결과로 상태 전환을 표시

> **구현 참고**: ProcessStatusCard가 10초 간격으로 폴링 중이므로, `APPLYING_APPROVED` 상태에서 위 메시지를 표시하는 UI 컴포넌트를 추가해야 합니다.

---

## H. Open Questions (제품 오너 확인 필요)

| # | 질문 | 영향 범위 | 기본 제안 |
|---|------|----------|----------|
| 1 | **IDC v1 마이그레이션 시점**: IDC legacy API 5개를 v1으로 전환하는 일정은? | IdcProjectPage 전체 | P2로 분류, 별도 PR |
| 2 | **confirmed-integration FE 호출 필요 여부**: 현재 미호출 — Admin Diff용으로 호출 추가해도 되는가? | ApprovalDetailModal | 승인 Diff 표시에 필수 |
| 3 | **자동 승인 정책**: 어떤 조건에서 자동 승인이 발동하는가? ADR-006에 명시 안 됨 | 승인 로직 전체 | BFF 서버 측 정책으로 분리 (FE 관여 불필요) |
| 4 | **승인 이력 전용 탭 vs 모달 내 섹션**: Admin에서 이력을 별도 탭으로 제공할지, 모달 내 확장으로 제공할지 | AdminDashboard 구조 | 모달 내 확장 (scope 최소화) |
| 5 | **Resource.exclusion 필드 제거 시점**: ADR-006에서 제거 예정이나, 기존 mock/UI 의존 | types.ts, ResourceTable | ApprovalRequest 모델 안정화 후 제거 |
