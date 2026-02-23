# AWS 연동 워크플로우 — State별 UI-API 매핑

> **Base Path**: `/api/v1`
> **Path Param**: `{id}` = `targetSourceId` (integer)
> **대상 Provider**: AWS

---

## 프로세스 바 범례

```
[연동대상확정] → [승인대기] → [반영중] → [설치] → [테스트] → [확인] → [완료]
```

---

## User Story 인덱스

| US | 이름 | 주요 State |
|----|------|-----------|
| US-001 | Scan 수행 | 1, 7 |
| US-002 | 연동 대상 리소스 목록 조회 | 1 |
| US-003 | 연동 대상 선택 및 입력값 설정 | 1 |
| US-004 | 연동 대상 승인 요청 | 1 |
| US-005 | 승인 요청 내역/상태 조회 | 2, 3 |
| US-006 | 승인 요청 취소 | 2 |
| US-007 | 연동 확정 후 재요청 | 7 |
| US-008 | 연동 확정 변경 내역 비교 | 3 |
| US-009 | 설치 상태 조회 (AWS) | 4 |
| US-010 | TF Script 다운로드 (AWS) | 4 |
| US-011 | 연결 테스트 수행 | 5 |
| US-012 | 연결 완료 리소스 상태 조회 | 7 |
| Admin-001 | 승인 요청 목록 조회 | 2 |
| Admin-002 | 승인 요청 승인/반려 | 2 |

---

## State 0 → State 1 전이: 사전 조치

────────────────────────────────────────

```
[연동 관리 메인 화면] - State 0: AWS 사전 조치
  관련 US: (없음 — Provider 설정 단계)

  ## 화면 진입 시 API
    ├─ GET  /api/v1/target-sources/{id}/process-status                  (프로세스 상태)
    └─ GET  /api/v1/aws/target-sources/{id}/settings                    (AWS Role 설정)

  ## 프로세스 바
    [사전조치(🔵)] → [연동대상확정] → [승인대기] → [반영중] → [설치] → [테스트] → [확인] → [완료]

  ## AWS 설치 모드 선택 컴포넌트
    └─ [설치 모드 선택] 버튼 (AUTO / MANUAL)
        └─ 클릭
            └─ API: POST /api/v1/aws/target-sources/{id}/installation-mode
                    Body: { "mode": "AUTO" | "MANUAL" }
                    ⚠️ 1회만 설정 가능 (immutable), 409 시 이미 설정됨

  ## Scan Role 검증 컴포넌트
    ├─ 현재 상태 표시 (settings.scanRole.status)
    └─ [검증] 버튼
        └─ 클릭
            └─ API: POST /api/v1/aws/target-sources/{id}/verify-scan-role
                    동기 (1s~30s), 200 응답 내 status: VALID | INVALID

  ## Execution Role 검증 컴포넌트 (AUTO 모드 전용)
    ├─ 현재 상태 표시 (settings.executionRole.status)
    └─ [검증] 버튼
        └─ 클릭
            └─ API: POST /api/v1/aws/target-sources/{id}/verify-execution-role
                    동기 (1s~30s), 200 응답 내 status: VALID | INVALID
                    failReason: ROLE_NOT_CONFIGURED | ROLE_INSUFFICIENT_PERMISSIONS | SCAN_ROLE_UNAVAILABLE
```

---

## State 1: 연동 대상 확정

────────────────────────────────────────

```
[연동 관리 메인 화면] - State 1: 연동 대상 확정
  관련 US: US-001, US-002, US-003, US-004

  ## 화면 진입 시 API
    ├─ GET  /api/v1/target-sources/{id}/process-status                  (프로세스 상태)
    ├─ GET  /api/v1/aws/target-sources/{id}/settings                    (AWS Role 설정)
    ├─ GET  /api/v1/target-sources/{id}/scanJob/latest                  [US-001] (최신 스캔 상태)
    ├─ GET  /api/v1/target-sources/{id}/scan/history?page=0&size=10     [US-001] (스캔 이력)
    ├─ GET  /api/v1/target-sources/{id}/resources                       [US-002] (리소스 목록)
    └─ GET  /api/v1/target-sources/{id}/secrets                         (DB Credential 목록)

  ## 프로세스 바
    [연동대상확정(🔵)] → [승인대기] → [반영중] → [설치] → [테스트] → [확인] → [완료]

  ## 스캔 수행 컴포넌트 [US-001]
    ├─ 최신 스캔 상태 표시 (scanJob/latest)
    ├─ 스캔 이력 목록 (scan/history)
    └─ [스캔 실행] 버튼
        └─ 클릭
            ├─ API: POST /api/v1/target-sources/{id}/scan
            │       202 Accepted (비동기)
            ├─ Polling 시작 (5s 간격)
            │   └─ API: GET /api/v1/target-sources/{id}/scanJob/latest
            │           완료 조건: scanStatus !== "SCANNING"
            ├─ 스캔 완료 시
            │   └─ API: GET /api/v1/target-sources/{id}/resources   [US-002] (리소스 목록 갱신)
            └─ 에러
                └─ 409 CONFLICT_IN_PROGRESS: "현재 스캔이 진행 중입니다"

  ## 리소스 목록 컴포넌트 [US-002]
    ├─ 리소스 목록 표시 (resources)
    │   └─ integrationCategory별 구분:
    │       ├─ TARGET: 연동 대상 (제외 시 사유 필수)
    │       ├─ NO_INSTALL_NEEDED: EC2 등 설치 불필요
    │       └─ INSTALL_INELIGIBLE: 연동 불가
    └─ DB Credential 선택 드롭다운
        └─ 데이터: GET /api/v1/target-sources/{id}/secrets 응답

  ## 연동 대상 선택 컴포넌트 [US-003]
    └─ API 호출 없음 — 프론트엔드 로컬 상태 관리
        ├─ 리소스별 선택/제외 토글
        ├─ 제외 시 사유 입력 (integrationCategory=TARGET인 경우 필수)
        ├─ EC2 선택 시 endpoint_config 입력 (db_type, port, host)
        └─ RDS 선택 시 credential_id 선택

  ## [승인 요청] 버튼 [US-004]
    └─ 클릭
        ├─ API: POST /api/v1/target-sources/{id}/approval-requests
        │       Body: { "input_data": { "resource_inputs": [...] } }
        │       201 Created
        ├─ 성공 시 → State 2 전이
        └─ 에러
            ├─ 409 CONFLICT_REQUEST_PENDING: "이미 승인 요청이 진행 중입니다"
            └─ 409 CONFLICT_APPLYING_IN_PROGRESS: "승인된 내용이 반영 중입니다"
```

---

## State 1 → State 2 전이

────────────────────────────────────────

```
[연동 관리 메인 화면] - State 2: 승인 대기
  관련 US: US-005, US-006, Admin-001, Admin-002

  ## 화면 진입 시 API
    ├─ GET  /api/v1/target-sources/{id}/process-status                  [US-005] (프로세스 상태)
    └─ GET  /api/v1/target-sources/{id}/approval-history?page=0&size=1  [US-005] (최신 승인 요청)

  ## 프로세스 바
    [연동대상확정] → [승인대기(🔵)] → [반영중] → [설치] → [테스트] → [확인] → [완료]

  ## 스캔 수행 컴포넌트 → 미노출

  ## 승인 요청 내역 컴포넌트 [US-005]
    ├─ 프로세스 상태 표시 (process-status.process_status = WAITING_APPROVAL)
    ├─ 최근 승인 요청 정보 (approval-history)
    │   └─ 요청자, 요청 일시, 선택된 리소스 요약
    └─ 반려 이력 표시 (process-status.status_inputs.last_rejection_reason)

  ## [승인 요청 취소] 버튼 [US-006] (서비스 담당자)
    └─ 클릭
        ├─ API: POST /api/v1/target-sources/{id}/approval-requests/cancel
        │       200 OK, result: "CANCELLED"
        ├─ 성공 시 → State 1 복귀 (REQUEST_REQUIRED 또는 TARGET_CONFIRMED)
        └─ 에러
            ├─ 400 VALIDATION_FAILED: "취소할 수 있는 승인 요청이 없습니다"
            └─ 409 CONFLICT_APPLYING_IN_PROGRESS: "반영 중에는 취소 불가"

  ## 관리자 전용: 승인 요청 목록 [Admin-001]
    └─ 승인 이력 페이지네이션
        └─ API: GET /api/v1/target-sources/{id}/approval-history?page={page}&size={size}

  ## 관리자 전용: [승인] / [반려] 버튼 [Admin-002]
    ├─ [승인] 클릭
    │   ├─ API: POST /api/v1/target-sources/{id}/approval-requests/approve
    │   │       Body: { "comment": "..." }  (선택)
    │   └─ 성공 시 → State 3 전이 (APPLYING_APPROVED)
    └─ [반려] 클릭
        ├─ API: POST /api/v1/target-sources/{id}/approval-requests/reject
        │       Body: { "reason": "..." }  (필수, minLength: 1)
        ├─ 성공 시 → State 1 복귀 (REQUEST_REQUIRED)
        └─ 에러
            └─ 400 VALIDATION_FAILED: "승인 대기 상태가 아닙니다" / "반려 사유를 입력해주세요"
```

---

## State 2 → State 3 전이

────────────────────────────────────────

```
[연동 관리 메인 화면] - State 3: 연동대상반영중
  관련 US: US-005, US-008

  ## 화면 진입 시 API
    ├─ GET  /api/v1/target-sources/{id}/process-status                  [US-005] (프로세스 상태)
    ├─ GET  /api/v1/target-sources/{id}/confirmed-integration           [US-008] (변경 전: 현재 확정)
    └─ GET  /api/v1/target-sources/{id}/approved-integration            [US-008] (변경 후: 승인 반영 중)

  ## 프로세스 바
    [연동대상확정] → [승인대기] → [반영중(🔵)] → [설치] → [테스트] → [확인] → [완료]

  ## 스캔 수행 컴포넌트 → 미노출

  ## 변경 내역 비교 컴포넌트 [US-008]
    ├─ confirmed-integration (nullable: 최초 연동 시 null)
    ├─ approved-integration (반영 중 스냅샷)
    └─ 두 응답의 resource_infos[] 비교 (프론트엔드 로직)
        ├─ approved에만 존재 → 🟢 생성
        ├─ confirmed에만 존재 → 🔴 삭제
        ├─ 양쪽 모두 존재 → ⚪ 유지
        └─ confirmed가 null (신규) → 모두 🟢 생성

  ## 안내 텍스트
    └─ "승인된 연동 대상이 인프라에 반영되고 있습니다. 완료 시 자동으로 다음 단계로 이동합니다."
        (반영 완료 시 시스템이 자동으로 State 4로 전이)
```

---

## State 3 → State 4 전이

────────────────────────────────────────

```
[연동 관리 메인 화면] - State 4: 설치 진행
  관련 US: US-005, US-009, US-010

  ## 화면 진입 시 API
    ├─ GET  /api/v1/target-sources/{id}/process-status                  [US-005] (프로세스 상태)
    ├─ GET  /api/v1/target-sources/{id}/confirmed-integration           (확정 리소스 목록)
    └─ GET  /api/v1/aws/target-sources/{id}/installation-status         [US-009] (설치 상태)

  ## 프로세스 바
    [연동대상확정] → [승인대기] → [반영중] → [설치(🔵)] → [테스트] → [확인] → [완료]

  ## 스캔 수행 컴포넌트 → 미노출

  ## 설치 상태 컴포넌트 [US-009]
    ├─ 확정 리소스 목록 (confirmed-integration)
    ├─ ServiceScript별 설치 상태 표시
    │   └─ 각 스크립트: scriptName, status (PENDING | COMPLETED | FAILED), region
    ├─ BDC 상태 (bdcStatus.status)
    ├─ lastCheck 정보 (checkedAt, status)
    └─ [설치 상태 새로고침] 버튼
        └─ 클릭
            └─ API: POST /api/v1/aws/target-sources/{id}/check-installation
                    동기 (30s~5m), 강제 동기화 후 최신 상태 반환

  ## TF Script 다운로드 컴포넌트 [US-010] (MANUAL 모드 전용)
    └─ [TF Script 다운로드] 버튼
        └─ 클릭
            ├─ API: GET /api/v1/aws/target-sources/{id}/terraform-script
            │       Response: { downloadUrl, fileName, expiresAt }
            └─ 에러
                └─ 400: AUTO 모드에서는 스크립트 불필요

  ## AUTO 모드 안내
    └─ "TerraformExecutionRole을 통해 자동으로 설치가 진행됩니다."
        └─ ExecutionRole 미등록 시 경고 배너 표시
            └─ "TerraformExecutionRole이 등록되지 않았습니다."

  ## MANUAL 모드 안내
    └─ "TF Script를 다운로드 받아서 담당자와 함께 설치 일정을 조율하세요."
```

---

## State 4 → State 5 전이

────────────────────────────────────────

```
[연동 관리 메인 화면] - State 5: 연결 테스트
  관련 US: US-005, US-011

  ## 화면 진입 시 API
    ├─ GET  /api/v1/target-sources/{id}/process-status                  [US-005] (프로세스 상태)
    ├─ GET  /api/v1/target-sources/{id}/confirmed-integration           (확정 리소스 목록)
    ├─ GET  /api/v1/target-sources/{id}/test-connection/results?page=0&size=10  [US-011] (테스트 내역)
    └─ GET  /api/v1/target-sources/{id}/test-connection/latest          [US-011] (마지막 테스트 상태)

  ## 프로세스 바
    [연동대상확정] → [승인대기] → [반영중] → [설치] → [테스트(🔵)] → [확인] → [완료]

  ## 스캔 수행 컴포넌트 → 미노출

  ## 연결 테스트 컴포넌트 [US-011]
    ├─ 확정 리소스 목록 (confirmed-integration)
    ├─ 연결 테스트 내역 (test-connection/results)
    ├─ 마지막 연결 테스트 상태 (test-connection/latest)
    │   └─ 리소스별 개별 결과: resource_results[]
    │       ├─ status: PENDING | SUCCESS | FAIL
    │       └─ error_status (FAIL 시): AUTH_FAIL | CONNECTION_FAIL | PERMISSION_DENIED
    └─ [연결 테스트] 버튼 [US-011]
        └─ 클릭
            ├─ DB Credential 미설정 리소스 존재
            │   → 팝업: "DB Credential을 설정해주세요"
            │   → API: GET  /api/v1/target-sources/{id}/secrets                  [US-011] (Credential 목록)
            │   → 사용자가 Credential 선택
            │   → API: PATCH /api/v1/target-sources/{id}/resources/credential    [US-011] (Credential 설정)
            │          Body: { "resourceId": "...", "credentialId": "..." }
            │   → 설정 완료 후 재시도
            │
            ├─ 테스트 실행
            │   ├─ API: POST /api/v1/target-sources/{id}/test-connection
            │   │       202 Accepted (비동기, 1m~10m)
            │   ├─ Polling 시작 (10s 간격)
            │   │   └─ API: GET /api/v1/target-sources/{id}/test-connection/latest
            │   │           완료 조건: status !== "PENDING"
            │   ├─ 전체 SUCCESS 시 → State 6 전이
            │   └─ FAIL 시 → 리소스별 error_status + guide 표시
            │       ├─ AUTH_FAIL → "Credential 재확인 필요"
            │       │   → API: GET  /api/v1/target-sources/{id}/secrets
            │       │   → API: PATCH /api/v1/target-sources/{id}/resources/credential
            │       ├─ CONNECTION_FAIL → "네트워크/호스트 접근 불가"
            │       └─ PERMISSION_DENIED → "접근 권한 부족"
            │
            └─ 에러
                └─ 409 CONFLICT_IN_PROGRESS: "현재 연결 테스트가 진행 중입니다"
```

---

## State 5 → State 6 전이

────────────────────────────────────────

```
[연동 관리 메인 화면] - State 6: 연결 확인
  관련 US: US-005

  ## 화면 진입 시 API
    ├─ GET  /api/v1/target-sources/{id}/process-status                  [US-005] (프로세스 상태)
    └─ GET  /api/v1/target-sources/{id}/confirmed-integration           (확정 리소스 목록)

  ## 프로세스 바
    [연동대상확정] → [승인대기] → [반영중] → [설치] → [테스트] → [확인(🔵)] → [완료]

  ## 스캔 수행 컴포넌트 → 미노출

  ## 연결 확인 컴포넌트
    ├─ 확정 리소스 목록 및 연결 상태 요약
    └─ 관리자 전용: [설치 확정] 버튼
        └─ 클릭
            ├─ API: POST /api/v1/target-sources/{id}/pii-agent-installation/confirm
            │       200 OK, { success: true, confirmedAt: "..." }
            ├─ 성공 시 → State 7 전이 (INSTALLATION_COMPLETE)
            └─ 에러
                └─ 400 VALIDATION_FAILED: "설치 확정 가능한 상태가 아닙니다"
```

---

## State 6 → State 7 전이

────────────────────────────────────────

```
[연동 관리 메인 화면] - State 7: 완료
  관련 US: US-001, US-005, US-007, US-011, US-012

  ## 화면 진입 시 API
    ├─ GET  /api/v1/target-sources/{id}/process-status                  [US-005] (프로세스 상태)
    ├─ GET  /api/v1/target-sources/{id}/confirmed-integration           (확정 리소스 목록)
    ├─ GET  /api/v1/target-sources/{id}/scanJob/latest                  [US-001] (최신 스캔 상태)
    ├─ GET  /api/v1/target-sources/{id}/scan/history?page=0&size=10     [US-001] (스캔 이력)
    ├─ GET  /api/v1/target-sources/{id}/logical-db-status               [US-012] (논리 DB 연결 상태)
    ├─ GET  /api/v1/target-sources/{id}/test-connection/results?page=0&size=10  [US-011] (테스트 내역)
    └─ GET  /api/v1/target-sources/{id}/test-connection/latest          [US-011] (마지막 테스트 상태)

  ## 프로세스 바
    [연동대상확정] → [승인대기] → [반영중] → [설치] → [테스트] → [확인] → [완료(🔵)]

  ## 스캔 수행 컴포넌트 [US-001]
    ├─ 최신 스캔 상태 표시
    ├─ 스캔 이력 목록
    └─ [스캔 실행] 버튼 (신규 리소스 발견 시)
        └─ State 1과 동일한 스캔 플로우

  ## 논리 DB 연결 상태 컴포넌트 [US-012]
    └─ 리소스별 연결 현황
        ├─ total_database_count: 전체 논리 DB 수
        ├─ success_database_count: 연결 성공 수
        ├─ fail_count: 연결 실패 수
        ├─ pending_count: 대기 수
        ├─ agent_running: PII Agent 정상 동작 여부
        └─ query_period_days: 조회 기간 (7일)

  ## 연결 테스트 내역 컴포넌트 [US-011]
    ├─ 최근 테스트 결과 (test-connection/latest)
    └─ 테스트 이력 목록 (test-connection/results)

  ## [확정 대상 수정] 버튼 [US-007]
    └─ 클릭
        ├─ 현재 확정 정보 로드
        │   └─ API: GET /api/v1/target-sources/{id}/confirmed-integration
        ├─ 리소스 목록 재조회
        │   └─ API: GET /api/v1/target-sources/{id}/resources
        └─ State 1 (연동 대상 확정) 플로우 재시작
            └─ 신규 승인 요청
                └─ API: POST /api/v1/target-sources/{id}/approval-requests
```

---

## 비동기 작업 Polling 가이드

| 작업 | Trigger | Polling Endpoint | 간격 | 완료 조건 |
|------|---------|-----------------|------|----------|
| 스캔 | `POST /api/v1/target-sources/{id}/scan` | `GET /api/v1/target-sources/{id}/scanJob/latest` | 5s | `scanStatus !== "SCANNING"` |
| 연결 테스트 | `POST /api/v1/target-sources/{id}/test-connection` | `GET /api/v1/target-sources/{id}/test-connection/latest` | 10s | `status !== "PENDING"` |

---

## Swagger 소스 파일 참조

| 파일 | 주요 도메인 |
|------|-----------|
| `docs/swagger/scan.yaml` | 스캔 실행, 상태 조회, 이력 |
| `docs/swagger/confirm.yaml` | 리소스, 승인 요청, 확정/승인 정보, 프로세스 상태 |
| `docs/swagger/aws.yaml` | AWS 설치 상태, Role 검증, TF Script, 설치 모드 |
| `docs/swagger/test-connection.yaml` | 연결 테스트 실행, 결과 조회 |
| `docs/swagger/credential.yaml` | DB Credential(Secret) 목록 조회 |
| `docs/swagger/logical-db-status.yaml` | 논리 DB 연결 상태 조회 |
