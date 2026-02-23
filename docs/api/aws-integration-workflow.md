# AWS 연동 워크플로우 API 매핑

> **Base URL**: `/api/v1`
> **Path Parameter**: `{targetSourceId}` — 타겟소스 고유 식별자 (integer)
> **대상 Provider**: AWS

---

## 1. 유저 스토리별 API 매핑

### US-001: Scan 수행

| 용도 | Method | Endpoint | Swagger | 비고 |
|------|--------|----------|---------|------|
| 최신 스캔 내역 | GET | `/target-sources/{targetSourceId}/scanJob/latest` | scan.yaml | Polling용 (5s 간격) |
| 스캔 이력 | GET | `/target-sources/{targetSourceId}/scan/history?page={page}&size={size}` | scan.yaml | 페이지네이션 |
| 스캔 시작 | POST | `/target-sources/{targetSourceId}/scan` | scan.yaml | 202 Accepted, 비동기 |

**상태 모델**: `SCANNING` → `SUCCESS` / `FAIL` / `CANCELED` / `TIMEOUT`

**에러 처리**:
- 409 `CONFLICT_IN_PROGRESS`: 이미 진행 중인 스캔 존재
- 404 `TARGET_SOURCE_NOT_FOUND`: 타겟소스 없음

---

### US-002: 연동 대상 리소스 목록 조회

| 용도 | Method | Endpoint | Swagger | 비고 |
|------|--------|----------|---------|------|
| 리소스 목록 | GET | `/target-sources/{targetSourceId}/resources` | confirm.yaml | 최신 스캔 기반 |

**Response**:
```json
{
  "resources": [
    {
      "id": "...",
      "resourceId": "...",
      "name": "...",
      "resourceType": "RDS",
      "integrationCategory": "TARGET",
      "selectedCredentialId": null,
      "metadata": {
        "provider": "AWS",
        "resourceType": "RDS",
        "region": "ap-northeast-2",
        "arn": "...",
        "host": "...",
        "port": 3306,
        "databaseName": "...",
        "vpcId": "..."
      }
    }
  ],
  "totalCount": 5
}
```

**`integrationCategory`**:
- `TARGET`: 연동 대상 (제외 시 사유 필수)
- `NO_INSTALL_NEEDED`: EC2 등 설치 불필요 리소스
- `INSTALL_INELIGIBLE`: 연동 불가 리소스

**AWS 리소스 타입**: `DYNAMODB`, `RDS`, `RDS_CLUSTER`, `ATHENA`, `REDSHIFT`, `EC2`

---

### US-003: 연동 대상 선택 및 입력값 설정

**API 호출 없음** — 프론트엔드 로컬 상태 관리

참고 API (Credential 목록 조회):

| 용도 | Method | Endpoint | Swagger |
|------|--------|----------|---------|
| DB Credential 목록 | GET | `/target-sources/{targetSourceId}/secrets` | credential.yaml |

---

### US-004: 연동 대상 승인 요청

| 용도 | Method | Endpoint | Swagger | 비고 |
|------|--------|----------|---------|------|
| 승인 요청 생성 | POST | `/target-sources/{targetSourceId}/approval-requests` | confirm.yaml | 201 Created |

**Request Body**:
```json
{
  "input_data": {
    "resource_inputs": [
      {
        "resource_id": "aws-rds-123",
        "selected": true,
        "resource_input": {
          "credential_id": "cred-456"
        }
      },
      {
        "resource_id": "aws-ec2-789",
        "selected": true,
        "resource_input": {
          "endpoint_config": {
            "db_type": "MYSQL",
            "port": 3306,
            "host": "10.0.0.5"
          }
        }
      },
      {
        "resource_id": "aws-dynamo-111",
        "selected": false,
        "exclusion_reason": "Phase 2에서 처리 예정"
      }
    ],
    "exclusion_reason_default": "이번 단계에서 제외"
  }
}
```

**에러 처리**:
- 409 `CONFLICT_REQUEST_PENDING`: 이미 승인 요청 진행 중
- 409 `CONFLICT_APPLYING_IN_PROGRESS`: 승인 반영 중 신규 요청 차단

---

### US-005: 승인 요청 내역 조회

| 용도 | Method | Endpoint | Swagger | 비고 |
|------|--------|----------|---------|------|
| 프로세스 상태 | GET | `/target-sources/{targetSourceId}/process-status` | confirm.yaml | |
| 승인 이력 | GET | `/target-sources/{targetSourceId}/approval-history?page=0&size=1` | confirm.yaml | 최신 1건 |
| 확정 정보 | GET | `/target-sources/{targetSourceId}/confirmed-integration` | confirm.yaml | nullable |
| 승인 반영 중 정보 | GET | `/target-sources/{targetSourceId}/approved-integration` | confirm.yaml | nullable |

**ProcessStatus 상태 (ADR-009)**:
- `REQUEST_REQUIRED`: 요청 필요
- `WAITING_APPROVAL`: 승인 대기
- `APPLYING_APPROVED`: 승인 반영 중
- `TARGET_CONFIRMED`: 연동 확정 완료

**process-status 응답에 포함되는 추가 정보**:
- `status_inputs.last_rejection_reason`: 최근 반려/시스템 에러 사유

---

### US-006: 승인 요청 취소

| 용도 | Method | Endpoint | Swagger | 비고 |
|------|--------|----------|---------|------|
| 승인 요청 취소 | POST | `/target-sources/{targetSourceId}/approval-requests/cancel` | confirm.yaml | |

**에러 처리**:
- 400 `VALIDATION_FAILED`: 취소 가능한 승인 요청 없음
- 409 `CONFLICT_APPLYING_IN_PROGRESS`: 반영 중 취소 불가

---

### US-007: 연동 확정 후 재요청

| 용도 | Method | Endpoint | Swagger | 비고 |
|------|--------|----------|---------|------|
| 현재 확정 목록 조회 | GET | `/target-sources/{targetSourceId}/confirmed-integration` | confirm.yaml | |
| 리소스 목록 재조회 | GET | `/target-sources/{targetSourceId}/resources` | confirm.yaml | |
| 신규 승인 요청 | POST | `/target-sources/{targetSourceId}/approval-requests` | confirm.yaml | |

"확정 대상 수정" 클릭 시 State 1(연동 대상 확정)부터 동일한 플로우 재시작

---

### US-008: 연동 확정 변경 내역 비교 조회

| 용도 | Method | Endpoint | Swagger | 비고 |
|------|--------|----------|---------|------|
| 변경 전 (현재 확정) | GET | `/target-sources/{targetSourceId}/confirmed-integration` | confirm.yaml | nullable |
| 변경 후 (승인 반영 중) | GET | `/target-sources/{targetSourceId}/approved-integration` | confirm.yaml | nullable |

두 응답의 `resource_infos[]`를 비교하여 생성/삭제/유지 판별 (프론트엔드 로직):
- `approved`에만 존재 → **생성**
- `confirmed`에만 존재 → **삭제**
- 양쪽 모두 존재 → **유지**
- 이전 확정 없는 경우 (신규) → 모두 **생성**

---

### Admin-001: 승인 요청 목록 조회

| 용도 | Method | Endpoint | Swagger | 비고 |
|------|--------|----------|---------|------|
| 승인 이력 목록 | GET | `/target-sources/{targetSourceId}/approval-history?page={page}&size={size}` | confirm.yaml | 페이지네이션 |
| 프로세스 상태 | GET | `/target-sources/{targetSourceId}/process-status` | confirm.yaml | |

---

### Admin-002: 승인 요청 승인/반려

| 용도 | Method | Endpoint | Swagger | 비고 |
|------|--------|----------|---------|------|
| 승인 | POST | `/target-sources/{targetSourceId}/approval-requests/approve` | confirm.yaml | |
| 반려 | POST | `/target-sources/{targetSourceId}/approval-requests/reject` | confirm.yaml | |

**승인 Request**: `{ "comment": "..." }` (선택)
**반려 Request**: `{ "reason": "..." }` (필수, minLength: 1)

**에러 처리**:
- 400 `VALIDATION_FAILED`: 승인 대기 상태가 아님 / 반려 사유 누락

---

### US-009: 설치 상태 조회 (AWS 전용)

| 용도 | Method | Endpoint | Swagger | 비고 |
|------|--------|----------|---------|------|
| 설치 상태 조회 | GET | `/aws/target-sources/{targetSourceId}/installation-status` | aws.yaml | 캐시 5분 |
| 설치 상태 새로고침 | POST | `/aws/target-sources/{targetSourceId}/check-installation` | aws.yaml | 강제 동기화 |

**Response (`AwsInstallationStatus`)**:
```json
{
  "lastCheck": {
    "status": "SUCCESS",
    "checkedAt": "2026-02-15T10:30:00Z"
  },
  "hasExecutionPermission": true,
  "executionRoleArn": "arn:aws:iam::123456789012:role/PiiExecutionRole",
  "serviceScripts": [
    {
      "scriptName": "VPC Endpoint (vpc-0123abcd / ap-northeast-2)",
      "status": "COMPLETED",
      "region": "ap-northeast-2",
      "resources": [
        { "resourceId": "...", "type": "RDS", "name": "my-db" }
      ]
    }
  ],
  "bdcStatus": { "status": "COMPLETED" }
}
```

**ServiceScript 상태**: `PENDING` / `COMPLETED` / `FAILED`

---

### US-010: Terraform Script 다운로드 (AWS 전용)

| 용도 | Method | Endpoint | Swagger | 비고 |
|------|--------|----------|---------|------|
| TF Script 다운로드 | GET | `/aws/target-sources/{targetSourceId}/terraform-script` | aws.yaml | 수동설치 모드 전용 |

**Response**:
```json
{
  "downloadUrl": "https://...",
  "fileName": "terraform-script.zip",
  "expiresAt": "2026-02-15T11:30:00Z"
}
```

**에러 처리**: AUTO 모드에서 호출 시 400 에러

---

### US-011: 연결 테스트 수행

| 용도 | Method | Endpoint | Swagger | 비고 |
|------|--------|----------|---------|------|
| 테스트 내역 | GET | `/target-sources/{targetSourceId}/test-connection/results?page={page}&size={size}` | test-connection.yaml | 페이지네이션 |
| 최신 테스트 결과 | GET | `/target-sources/{targetSourceId}/test-connection/latest` | test-connection.yaml | Polling용 (10s) |
| 마지막 성공 결과 | GET | `/target-sources/{targetSourceId}/test-connection/last-success` | test-connection.yaml | |
| 테스트 시작 | POST | `/target-sources/{targetSourceId}/test-connection` | test-connection.yaml | 202 Accepted |
| DB Credential 목록 | GET | `/target-sources/{targetSourceId}/secrets` | credential.yaml | |
| DB Credential 설정 | PATCH | `/target-sources/{targetSourceId}/resources/credential` | confirm.yaml | |

**Credential 갱신 Request**:
```json
{
  "resourceId": "aws-rds-123",
  "credentialId": "cred-456"
}
```

**테스트 상태**: `PENDING` → `SUCCESS` / `FAIL`

**리소스별 에러 유형** (`error_status`):
- `AUTH_FAIL`: 인증 실패 (credential 오류)
- `CONNECTION_FAIL`: 연결 실패 (네트워크/호스트)
- `PERMISSION_DENIED`: 권한 부족

**에러 처리**: 409 `CONFLICT_IN_PROGRESS`: 이미 진행 중

---

### US-012: 연결 완료 리소스 상태 조회

| 용도 | Method | Endpoint | Swagger | 비고 |
|------|--------|----------|---------|------|
| 논리 DB 연결 상태 | GET | `/target-sources/{targetSourceId}/logical-db-status` | logical-db-status.yaml | 7일 기준 |

**Response**:
```json
{
  "resources": [
    {
      "resource_id": "aws-rds-123",
      "total_database_count": 5,
      "success_database_count": 4,
      "fail_count": 1,
      "pending_count": 0
    }
  ],
  "checked_at": "2026-02-23T10:00:00Z",
  "query_period_days": 7,
  "agent_running": true
}
```

---

## 2. 공통 / 사전 조치 API (AWS 전용)

| 용도 | Method | Endpoint | Swagger | 비고 |
|------|--------|----------|---------|------|
| AWS 설정 조회 | GET | `/aws/target-sources/{targetSourceId}/settings` | aws.yaml | ScanRole + ExecutionRole 상태 |
| ScanRole 검증 | POST | `/aws/target-sources/{targetSourceId}/verify-scan-role` | aws.yaml | 동기, 1~30s |
| ExecutionRole 검증 | POST | `/aws/target-sources/{targetSourceId}/verify-execution-role` | aws.yaml | 동기, 1~30s |
| 설치 모드 설정 | POST | `/aws/target-sources/{targetSourceId}/installation-mode` | aws.yaml | 1회만 설정 가능 |
| 관리자 설치 확정 | POST | `/target-sources/{targetSourceId}/pii-agent-installation/confirm` | confirm.yaml | State 6→7 전이 |

**AWS 설정 Response (`AwsSettings`)**:
```json
{
  "executionRole": {
    "roleArn": "arn:aws:iam::...:role/PiiExecutionRole",
    "status": "VALID",
    "lastVerifiedAt": "2026-02-15T10:30:00Z"
  },
  "scanRole": {
    "roleArn": "arn:aws:iam::...:role/PiiScanRole",
    "status": "VALID",
    "lastVerifiedAt": "2026-02-15T10:30:00Z"
  }
}
```

**Role 상태**: `VALID` / `INVALID` / `UNVERIFIED`

**Role 실패 사유** (`failReason`):
- `ROLE_NOT_CONFIGURED`: Role ARN 미설정
- `ROLE_INSUFFICIENT_PERMISSIONS`: 권한 부족
- `SCAN_ROLE_UNAVAILABLE`: Scan Role 사용 불가

---

## 3. State별 화면 진입 시 API 호출 목록

### State 1: 연동 대상 확정

```
GET /target-sources/{targetSourceId}/process-status
GET /aws/target-sources/{targetSourceId}/settings
GET /target-sources/{targetSourceId}/scanJob/latest
GET /target-sources/{targetSourceId}/scan/history
GET /target-sources/{targetSourceId}/resources
GET /target-sources/{targetSourceId}/secrets
```

### State 2: 승인 대기

```
GET /target-sources/{targetSourceId}/process-status
GET /target-sources/{targetSourceId}/approval-history?page=0&size=1
```

### State 3: 연동대상반영중

```
GET /target-sources/{targetSourceId}/process-status
GET /target-sources/{targetSourceId}/confirmed-integration
GET /target-sources/{targetSourceId}/approved-integration
```

### State 4: 설치 진행

```
GET /target-sources/{targetSourceId}/process-status
GET /target-sources/{targetSourceId}/confirmed-integration
GET /aws/target-sources/{targetSourceId}/installation-status
```

### State 5: 연결 테스트

```
GET /target-sources/{targetSourceId}/process-status
GET /target-sources/{targetSourceId}/confirmed-integration
GET /target-sources/{targetSourceId}/test-connection/results
GET /target-sources/{targetSourceId}/test-connection/latest
```

### State 6: 연결 확인

```
GET /target-sources/{targetSourceId}/process-status
GET /target-sources/{targetSourceId}/confirmed-integration
```

### State 7: 완료

```
GET /target-sources/{targetSourceId}/process-status
GET /target-sources/{targetSourceId}/confirmed-integration
GET /target-sources/{targetSourceId}/scanJob/latest
GET /target-sources/{targetSourceId}/scan/history
GET /target-sources/{targetSourceId}/logical-db-status
GET /target-sources/{targetSourceId}/test-connection/results
GET /target-sources/{targetSourceId}/test-connection/latest
```

---

## 4. 비동기 작업 Polling 가이드

| 작업 | Trigger | Polling Endpoint | 간격 | 완료 조건 |
|------|---------|-----------------|------|----------|
| 스캔 | `POST .../scan` | `GET .../scanJob/latest` | 5s | `status !== "SCANNING"` |
| 연결 테스트 | `POST .../test-connection` | `GET .../test-connection/latest` | 10s | `status !== "PENDING"` |

---

## 5. Swagger 소스 파일 참조

| 파일 | 주요 도메인 |
|------|-----------|
| `docs/swagger/scan.yaml` | 스캔 실행, 상태 조회, 이력 |
| `docs/swagger/confirm.yaml` | 리소스, 승인 요청, 확정/승인 정보, 프로세스 상태 |
| `docs/swagger/aws.yaml` | AWS 설치 상태, Role 검증, TF Script, 설치 모드 |
| `docs/swagger/test-connection.yaml` | 연결 테스트 실행, 결과 조회 |
| `docs/swagger/credential.yaml` | DB Credential(Secret) 목록 조회 |
| `docs/swagger/logical-db-status.yaml` | 논리 DB 연결 상태 조회 |
