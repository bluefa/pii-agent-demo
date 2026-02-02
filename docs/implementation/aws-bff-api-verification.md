# AWS BFF API 검증 시나리오

> AWS API Routes 구현 검증을 위한 상세 테스트 시나리오

---

## 검증 환경

### 초기 데이터

#### 프로젝트 (AWS)
| ID | 상태 | Service TF | BDC TF | 비고 |
|----|------|-----------|--------|------|
| proj-1 | INSTALLATION_COMPLETE | ✅ 완료 | ✅ 완료 | 설치 완료 |
| proj-3 | INSTALLING | ✅ 완료 | ⏳ 진행중 | 설치 중 |
| proj-5 | WAITING_CONNECTION_TEST | ✅ 완료 | ✅ 완료 | 연결 테스트 대기 |

#### 서비스 AWS 설정
| 서비스 | 계정 ID | Scan Role | 상태 |
|-------|---------|-----------|------|
| SERVICE-A | 123456789012 | arn:aws:iam::123456789012:role/PIIAgentScanRole | VALID |
| SERVICE-B | - | 미등록 | - |
| SERVICE-C | 987654321098 | arn:aws:iam::987654321098:role/PIIAgentScanRole | NOT_VERIFIED |

---

## API 검증 시나리오

### 1. TF Role 검증 (`POST /api/aws/verify-tf-role`)

#### 1.1 검증 성공

**요청**:
```bash
curl -X POST http://localhost:3000/api/aws/verify-tf-role \
  -H "Content-Type: application/json" \
  -d '{"accountId": "123456789012"}'
```

**기대 응답** (200 OK):
```json
{
  "valid": true,
  "roleArn": "arn:aws:iam::123456789012:role/TerraformExecutionRole",
  "permissions": {
    "canCreateResources": true,
    "canManageIam": true,
    "canAccessS3": true
  }
}
```

#### 1.2 Role 없음 (accountId가 '000'으로 끝남)

**요청**:
```bash
curl -X POST http://localhost:3000/api/aws/verify-tf-role \
  -H "Content-Type: application/json" \
  -d '{"accountId": "123456789000"}'
```

**기대 응답** (200 OK):
```json
{
  "valid": false,
  "errorCode": "ROLE_NOT_FOUND",
  "errorMessage": "Account 123456789000에서 TerraformExecutionRole을 찾을 수 없습니다.",
  "guide": {
    "title": "TerraformExecutionRole 생성 필요",
    "steps": [
      "AWS Console에서 IAM > Roles로 이동",
      "Create role 클릭",
      "Trusted entity로 AWS account 선택",
      "Role 이름을 TerraformExecutionRole로 지정",
      "필요한 정책 연결 (AdministratorAccess 또는 커스텀)"
    ],
    "documentUrl": "https://docs.example.com/aws/tf-role-setup"
  }
}
```

#### 1.3 권한 부족 (accountId가 '111'로 끝남)

**요청**:
```bash
curl -X POST http://localhost:3000/api/aws/verify-tf-role \
  -H "Content-Type: application/json" \
  -d '{"accountId": "123456789111"}'
```

**기대 응답** (200 OK):
```json
{
  "valid": false,
  "errorCode": "INSUFFICIENT_PERMISSIONS",
  "errorMessage": "TerraformExecutionRole에 필요한 권한이 부족합니다.",
  "guide": {
    "title": "권한 부족",
    "steps": ["..."],
    "documentUrl": "https://docs.example.com/aws/tf-role-permissions"
  }
}
```

#### 1.4 접근 거부 (accountId가 '222'로 끝남)

**요청**:
```bash
curl -X POST http://localhost:3000/api/aws/verify-tf-role \
  -H "Content-Type: application/json" \
  -d '{"accountId": "123456789222"}'
```

**기대 응답** (200 OK):
```json
{
  "valid": false,
  "errorCode": "ACCESS_DENIED",
  "errorMessage": "AssumeRole 권한이 설정되지 않았습니다.",
  "guide": {
    "title": "AssumeRole 설정 필요",
    "steps": ["..."],
    "documentUrl": "https://docs.example.com/aws/assume-role-setup"
  }
}
```

---

### 2. 설치 상태 조회 (`GET /api/aws/projects/{projectId}/installation-status`)

#### 2.1 설치 완료 상태 (proj-1)

**요청**:
```bash
curl http://localhost:3000/api/aws/projects/proj-1/installation-status
```

**기대 응답** (200 OK):
```json
{
  "provider": "AWS",
  "hasTfPermission": true,
  "serviceTfCompleted": true,
  "bdcTfCompleted": true,
  "completedAt": "2024-01-20T14:00:00Z",
  "lastCheckedAt": "2024-01-20T14:30:00Z"
}
```

#### 2.2 설치 진행 중 (proj-3)

**요청**:
```bash
curl http://localhost:3000/api/aws/projects/proj-3/installation-status
```

**기대 응답** (200 OK):
```json
{
  "provider": "AWS",
  "hasTfPermission": true,
  "serviceTfCompleted": true,
  "bdcTfCompleted": false,
  "lastCheckedAt": "2024-01-19T09:00:00Z"
}
```

#### 2.3 존재하지 않는 프로젝트

**요청**:
```bash
curl http://localhost:3000/api/aws/projects/invalid-id/installation-status
```

**기대 응답** (404 Not Found):
```json
{
  "error": "NOT_FOUND",
  "message": "프로젝트를 찾을 수 없습니다."
}
```

#### 2.4 AWS가 아닌 프로젝트 (proj-4는 IDC)

**요청**:
```bash
curl http://localhost:3000/api/aws/projects/proj-4/installation-status
```

**기대 응답** (400 Bad Request):
```json
{
  "error": "INVALID_PROVIDER",
  "message": "AWS 프로젝트가 아닙니다."
}
```

---

### 3. 설치 상태 확인 (`POST /api/aws/projects/{projectId}/check-installation`)

#### 3.1 검증 성공 (자동 설치 케이스)

**요청**:
```bash
curl -X POST http://localhost:3000/api/aws/projects/proj-3/check-installation
```

**기대 응답** (200 OK):
```json
{
  "provider": "AWS",
  "hasTfPermission": true,
  "serviceTfCompleted": true,
  "bdcTfCompleted": false,
  "lastCheckedAt": "2024-02-02T..."
}
```

> `lastCheckedAt`이 현재 시간으로 업데이트됨

#### 3.2 검증 실패 (projectId에 'fail' 포함)

**요청**:
```bash
# 먼저 hasTfPermission=false인 프로젝트 설치 상태 초기화 필요
curl -X POST http://localhost:3000/api/aws/projects/proj-fail-test/check-installation
```

**기대 응답** (200 OK):
```json
{
  "provider": "AWS",
  "hasTfPermission": false,
  "serviceTfCompleted": false,
  "bdcTfCompleted": false,
  "lastCheckedAt": "2024-02-02T...",
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Terraform 리소스를 찾을 수 없습니다.",
    "guide": {
      "title": "Terraform 리소스 검증 실패",
      "steps": [
        "Terraform Script를 AWS 계정에서 실행했는지 확인",
        "terraform apply 명령이 성공적으로 완료되었는지 확인",
        "생성된 리소스가 삭제되지 않았는지 확인"
      ]
    }
  }
}
```

---

### 4. TF Script 다운로드 (`GET /api/aws/projects/{projectId}/terraform-script`)

#### 4.1 다운로드 URL 조회 (수동 설치 케이스)

> TF 권한이 없는 프로젝트에서만 사용 가능

**요청**:
```bash
curl http://localhost:3000/api/aws/projects/proj-manual/terraform-script
```

**기대 응답** (200 OK):
```json
{
  "downloadUrl": "https://storage.example.com/tf-scripts/proj-manual/service-tf.zip?token=mock-token",
  "fileName": "service-tf-proj-manual.zip",
  "expiresAt": "2024-02-03T..."
}
```

#### 4.2 TF 권한 있는 프로젝트 (스크립트 불필요)

**요청**:
```bash
curl http://localhost:3000/api/aws/projects/proj-1/terraform-script
```

**기대 응답** (400 Bad Request):
```json
{
  "error": "NOT_AVAILABLE",
  "message": "TF 권한이 있어 스크립트가 필요하지 않습니다."
}
```

---

### 5. 서비스 AWS 설정 조회 (`GET /api/services/{serviceCode}/settings/aws`)

#### 5.1 설정 완료 (SERVICE-A)

**요청**:
```bash
curl http://localhost:3000/api/services/SERVICE-A/settings/aws
```

**기대 응답** (200 OK):
```json
{
  "accountId": "123456789012",
  "scanRole": {
    "registered": true,
    "roleArn": "arn:aws:iam::123456789012:role/PIIAgentScanRole",
    "lastVerifiedAt": "2024-01-15T10:00:00Z",
    "status": "VALID"
  }
}
```

#### 5.2 설정 미완료 (SERVICE-B)

**요청**:
```bash
curl http://localhost:3000/api/services/SERVICE-B/settings/aws
```

**기대 응답** (200 OK):
```json
{
  "scanRole": {
    "registered": false
  },
  "guide": {
    "title": "AWS 연동 설정 필요",
    "steps": [
      "서비스에 사용할 AWS 계정 ID를 입력하세요.",
      "Scan Role ARN을 입력하세요.",
      "Scan Role은 BDC가 AWS 리소스를 스캔할 때 사용됩니다.",
      "필요한 권한: ReadOnlyAccess 또는 커스텀 정책"
    ],
    "documentUrl": "https://docs.example.com/aws/scan-role-setup"
  }
}
```

---

### 6. 서비스 AWS 설정 수정 (`PUT /api/services/{serviceCode}/settings/aws`)

#### 6.1 설정 등록 성공

**요청**:
```bash
curl -X PUT http://localhost:3000/api/services/SERVICE-B/settings/aws \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "555555555555",
    "scanRoleArn": "arn:aws:iam::555555555555:role/PIIAgentScanRole"
  }'
```

**기대 응답** (200 OK):
```json
{
  "updated": true,
  "accountId": "555555555555",
  "scanRole": {
    "registered": true,
    "roleArn": "arn:aws:iam::555555555555:role/PIIAgentScanRole",
    "lastVerifiedAt": "2024-02-02T...",
    "status": "VALID"
  }
}
```

#### 6.2 잘못된 계정 ID (12자리 아님)

**요청**:
```bash
curl -X PUT http://localhost:3000/api/services/SERVICE-B/settings/aws \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "12345",
    "scanRoleArn": "arn:aws:iam::12345:role/ScanRole"
  }'
```

**기대 응답** (200 OK):
```json
{
  "updated": false,
  "errorCode": "INVALID_ACCOUNT_ID",
  "errorMessage": "AWS 계정 ID는 12자리 숫자여야 합니다.",
  "guide": {
    "title": "잘못된 AWS 계정 ID",
    "steps": [
      "AWS 계정 ID는 12자리 숫자입니다.",
      "AWS Console 우측 상단에서 계정 ID 확인 가능"
    ]
  }
}
```

#### 6.3 Role 검증 실패 (accountId가 '000'으로 끝남)

**요청**:
```bash
curl -X PUT http://localhost:3000/api/services/SERVICE-B/settings/aws \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "123456789000",
    "scanRoleArn": "arn:aws:iam::123456789000:role/ScanRole"
  }'
```

**기대 응답** (200 OK):
```json
{
  "updated": false,
  "errorCode": "ROLE_NOT_FOUND",
  "errorMessage": "Account 123456789000에서 Scan Role을 찾을 수 없습니다.",
  "guide": {
    "title": "Scan Role을 찾을 수 없음",
    "steps": ["..."],
    "documentUrl": "https://docs.example.com/aws/scan-role-create"
  }
}
```

---

### 7. Scan Role 재검증 (`POST /api/services/{serviceCode}/settings/aws/verify-scan-role`)

#### 7.1 검증 성공 (SERVICE-A)

**요청**:
```bash
curl -X POST http://localhost:3000/api/services/SERVICE-A/settings/aws/verify-scan-role
```

**기대 응답** (200 OK):
```json
{
  "valid": true,
  "roleArn": "arn:aws:iam::123456789012:role/PIIAgentScanRole",
  "verifiedAt": "2024-02-02T..."
}
```

#### 7.2 미등록 상태 (SERVICE-B)

**요청**:
```bash
curl -X POST http://localhost:3000/api/services/SERVICE-B/settings/aws/verify-scan-role
```

**기대 응답** (200 OK):
```json
{
  "valid": false,
  "errorCode": "ROLE_NOT_FOUND",
  "errorMessage": "등록된 Scan Role이 없습니다.",
  "guide": {
    "title": "Scan Role을 찾을 수 없음",
    "steps": ["..."]
  }
}
```

#### 7.3 Role 삭제됨 (accountId가 '333'으로 끝남)

> 설정 시 accountId를 '333'으로 끝나게 등록한 후 검증

**기대 응답** (200 OK):
```json
{
  "valid": false,
  "errorCode": "ROLE_NOT_FOUND",
  "errorMessage": "Scan Role이 삭제되었습니다.",
  "guide": {
    "title": "Scan Role을 찾을 수 없음",
    "steps": ["..."]
  }
}
```

---

## E2E 시나리오 검증

### 시나리오 1: AWS 프로젝트 생성 (TF 권한 있음)

```bash
# 1. TF Role 검증
curl -X POST http://localhost:3000/api/aws/verify-tf-role \
  -H "Content-Type: application/json" \
  -d '{"accountId": "123456789012"}'
# → valid: true

# 2. 프로젝트 생성 (기존 API)
# POST /api/projects 로 tfPermissionGranted: true 설정

# 3. 설치 상태 조회 (자동 설치 진행 중)
curl http://localhost:3000/api/aws/projects/{newProjectId}/installation-status
# → serviceTfCompleted: false, bdcTfCompleted: false

# 4. 10초 후 다시 조회
curl http://localhost:3000/api/aws/projects/{newProjectId}/installation-status
# → serviceTfCompleted: true, bdcTfCompleted: false

# 5. 15초 후 완료 확인
curl http://localhost:3000/api/aws/projects/{newProjectId}/installation-status
# → serviceTfCompleted: true, bdcTfCompleted: true, completedAt: "..."
```

### 시나리오 2: AWS 프로젝트 생성 (TF 권한 없음 → 수동 설치)

```bash
# 1. TF Role 검증 실패
curl -X POST http://localhost:3000/api/aws/verify-tf-role \
  -H "Content-Type: application/json" \
  -d '{"accountId": "123456789000"}'
# → valid: false, errorCode: "ROLE_NOT_FOUND"

# 2. 프로젝트 생성 (tfPermissionGranted: false)

# 3. TF Script 다운로드
curl http://localhost:3000/api/aws/projects/{newProjectId}/terraform-script
# → downloadUrl, fileName, expiresAt

# 4. (사용자가 수동으로 terraform apply 실행)

# 5. 설치 상태 확인
curl -X POST http://localhost:3000/api/aws/projects/{newProjectId}/check-installation
# → serviceTfCompleted: true (검증 성공 시)

# 6. BDC TF 완료 대기 후 확인
curl http://localhost:3000/api/aws/projects/{newProjectId}/installation-status
# → bdcTfCompleted: true, completedAt: "..."
```

### 시나리오 3: 서비스 AWS 설정 흐름

```bash
# 1. 설정 조회 (미등록)
curl http://localhost:3000/api/services/SERVICE-B/settings/aws
# → scanRole.registered: false, guide 포함

# 2. 설정 등록
curl -X PUT http://localhost:3000/api/services/SERVICE-B/settings/aws \
  -H "Content-Type: application/json" \
  -d '{"accountId": "555555555555", "scanRoleArn": "arn:aws:iam::555555555555:role/ScanRole"}'
# → updated: true

# 3. 설정 확인
curl http://localhost:3000/api/services/SERVICE-B/settings/aws
# → accountId: "555555555555", scanRole.registered: true

# 4. Scan Role 재검증
curl -X POST http://localhost:3000/api/services/SERVICE-B/settings/aws/verify-scan-role
# → valid: true, verifiedAt: "..."
```

---

## 체크리스트

### API 응답 검증

| 검증 항목 | 상태 |
|----------|------|
| 모든 성공 응답이 BFF API 명세와 일치 | ⬜ |
| 모든 에러 응답에 guide 포함 | ⬜ |
| HTTP 상태 코드 정확성 (비즈니스 실패=200, 시스템 오류=4xx/5xx) | ⬜ |
| lastCheckedAt 업데이트 정확성 | ⬜ |
| completedAt 설정 타이밍 정확성 | ⬜ |

### 시뮬레이션 동작 검증

| 검증 항목 | 상태 |
|----------|------|
| accountId 끝자리별 에러 시뮬레이션 동작 | ⬜ |
| 자동 설치 시간 기반 상태 변경 (10초/15초) | ⬜ |
| 수동 설치 검증 후 BDC TF 자동 시작 | ⬜ |
| projectId 'fail' 포함 시 검증 실패 | ⬜ |

### 데이터 정합성 검증

| 검증 항목 | 상태 |
|----------|------|
| 초기 데이터와 실제 프로젝트 상태 일치 | ⬜ |
| Store 업데이트 후 조회 시 반영 확인 | ⬜ |
| 서비스 설정 등록 후 persist 확인 | ⬜ |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-02 | 검증 시나리오 문서 작성 |
