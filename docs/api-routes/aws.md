# AWS API Routes

> AWS Provider 전용 Next.js API Routes 문서

---

## 개요

AWS 프로젝트의 설치 상태 관리 및 서비스별 AWS 연동 설정을 위한 API.

### 참조
- BFF API 명세: `docs/api/providers/aws.md`

---

## TF Role 검증

### `POST /api/aws/verify-tf-role`

프로젝트 생성 전 TerraformExecutionRole 검증.

#### Request

```typescript
interface VerifyTfRoleRequest {
  accountId: string;      // AWS 계정 ID (12자리)
  roleArn?: string;       // 커스텀 Role ARN (생략 시 기본 Role 이름 사용)
}
```

#### Response

**성공** (200 OK):
```typescript
interface VerifyTfRoleSuccessResponse {
  valid: true;
  roleArn: string;
  permissions: {
    canCreateResources: boolean;
    canManageIam: boolean;
    canAccessS3: boolean;
  };
}
```

**실패** (200 OK):
```typescript
interface VerifyTfRoleFailureResponse {
  valid: false;
  errorCode: 'ROLE_NOT_FOUND' | 'INSUFFICIENT_PERMISSIONS' | 'ACCESS_DENIED';
  errorMessage: string;
  guide: {
    title: string;
    steps: string[];
    documentUrl?: string;
  };
}
```

#### 시뮬레이션 규칙

| accountId 끝자리 | 결과 |
|-----------------|------|
| `000` | ROLE_NOT_FOUND |
| `111` | INSUFFICIENT_PERMISSIONS |
| `222` | ACCESS_DENIED |
| 그 외 | 성공 |

#### 예시

```typescript
// lib/api.ts
export const verifyTfRole = async (accountId: string, roleArn?: string) => {
  const res = await fetch('/api/aws/verify-tf-role', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, roleArn }),
  });
  return res.json();
};
```

#### curl 테스트

```bash
# 성공
curl -X POST http://localhost:3000/api/aws/verify-tf-role \
  -H "Content-Type: application/json" \
  -d '{"accountId": "123456789012"}'

# ROLE_NOT_FOUND
curl -X POST http://localhost:3000/api/aws/verify-tf-role \
  -H "Content-Type: application/json" \
  -d '{"accountId": "123456789000"}'
```

---

## 설치 상태 조회

### `GET /api/aws/projects/[projectId]/installation-status`

AWS 프로젝트의 Terraform 설치 상태 조회.

#### Response

**성공** (200 OK):
```typescript
interface AwsInstallationStatus {
  provider: 'AWS';
  hasTfPermission: boolean;      // TF 권한 여부 (자동/수동 설치 구분)
  serviceTfCompleted: boolean;   // Service TF 완료 여부
  bdcTfCompleted: boolean;       // BDC TF 완료 여부
  completedAt?: string;          // 전체 완료 시간 (ISO 8601)
  lastCheckedAt?: string;        // 마지막 확인 시간
}
```

**에러** (404 Not Found):
```typescript
{ error: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.' }
```

**에러** (400 Bad Request):
```typescript
{ error: 'INVALID_PROVIDER', message: 'AWS 프로젝트가 아닙니다.' }
```

#### 자동 설치 시뮬레이션

`hasTfPermission: true`인 경우 시간 기반 상태 변경:

| 경과 시간 | serviceTfCompleted | bdcTfCompleted |
|----------|-------------------|----------------|
| 0~10초 | false | false |
| 10~15초 | true | false |
| 15초 이후 | true | true |

#### curl 테스트

```bash
# 설치 완료 상태 (proj-1)
curl http://localhost:3000/api/aws/projects/proj-1/installation-status

# 설치 진행 중 (proj-3)
curl http://localhost:3000/api/aws/projects/proj-3/installation-status

# 404 에러
curl http://localhost:3000/api/aws/projects/invalid-id/installation-status

# 400 에러 (IDC 프로젝트)
curl http://localhost:3000/api/aws/projects/proj-4/installation-status
```

---

## 설치 상태 확인 (Refresh)

### `POST /api/aws/projects/[projectId]/check-installation`

설치 상태를 확인하고 `lastCheckedAt` 갱신. 수동 설치 시 검증 수행.

#### Response

**성공** (200 OK):
```typescript
interface CheckInstallationResponse {
  provider: 'AWS';
  hasTfPermission: boolean;
  serviceTfCompleted: boolean;
  bdcTfCompleted: boolean;
  completedAt?: string;
  lastCheckedAt: string;         // 방금 확인한 시간
  error?: {
    code: 'VALIDATION_FAILED' | 'ACCESS_DENIED';
    message: string;
    guide?: {
      title: string;
      steps: string[];
    };
  };
}
```

#### 시뮬레이션 규칙

- `projectId`에 `'fail'` 포함 시 → `VALIDATION_FAILED` 에러
- 수동 설치 검증 성공 시 → `serviceTfCompleted: true` 설정 + BDC TF 자동 시작

#### curl 테스트

```bash
# 자동 설치 상태 확인
curl -X POST http://localhost:3000/api/aws/projects/proj-3/check-installation
```

---

## TF Script 다운로드

### `GET /api/aws/projects/[projectId]/terraform-script`

수동 설치용 Terraform Script 다운로드 URL 조회.

> TF 권한이 없는 (`hasTfPermission: false`) 프로젝트에서만 사용 가능

#### Response

**성공** (200 OK):
```typescript
interface TerraformScriptResponse {
  downloadUrl: string;    // Presigned URL
  fileName: string;       // 파일명 (예: service-tf-proj-1.zip)
  expiresAt: string;      // 만료 시간 (24시간 후)
}
```

**에러** (400 Bad Request):
```typescript
{ error: 'NOT_AVAILABLE', message: 'TF 권한이 있어 스크립트가 필요하지 않습니다.' }
```

#### curl 테스트

```bash
# TF 권한 있는 프로젝트 → 400 에러
curl http://localhost:3000/api/aws/projects/proj-1/terraform-script
```

---

## 서비스 AWS 설정 조회

### `GET /api/services/[serviceCode]/settings/aws`

서비스의 AWS 연동 설정 조회.

#### Response

**설정 완료** (200 OK):
```typescript
interface AwsServiceSettings {
  accountId: string;
  scanRole: {
    registered: true;
    roleArn: string;
    lastVerifiedAt: string;
    status: 'VALID' | 'INVALID' | 'NOT_VERIFIED';
  };
}
```

**설정 미완료** (200 OK):
```typescript
interface AwsServiceSettings {
  scanRole: {
    registered: false;
  };
  guide: {
    title: string;
    steps: string[];
    documentUrl?: string;
  };
}
```

#### curl 테스트

```bash
# 설정 완료 (SERVICE-A)
curl http://localhost:3000/api/services/SERVICE-A/settings/aws

# 설정 미완료 (SERVICE-B)
curl http://localhost:3000/api/services/SERVICE-B/settings/aws
```

---

## 서비스 AWS 설정 수정

### `PUT /api/services/[serviceCode]/settings/aws`

서비스의 AWS 연동 설정 등록/수정.

#### Request

```typescript
interface UpdateAwsSettingsRequest {
  accountId: string;       // AWS 계정 ID (12자리)
  scanRoleArn: string;     // Scan Role ARN
}
```

#### Response

**성공** (200 OK):
```typescript
interface UpdateAwsSettingsSuccessResponse {
  updated: true;
  accountId: string;
  scanRole: {
    registered: true;
    roleArn: string;
    lastVerifiedAt: string;
    status: 'VALID';
  };
}
```

**실패** (200 OK):
```typescript
interface UpdateAwsSettingsFailureResponse {
  updated: false;
  errorCode: 'ROLE_NOT_FOUND' | 'INSUFFICIENT_PERMISSIONS' | 'ACCESS_DENIED' | 'INVALID_ACCOUNT_ID';
  errorMessage: string;
  guide: {
    title: string;
    steps: string[];
    documentUrl?: string;
  };
}
```

#### 검증 규칙

| 조건 | 에러 |
|-----|------|
| accountId가 12자리 숫자 아님 | INVALID_ACCOUNT_ID |
| roleArn이 `arn:aws:iam::`로 시작 안 함 | ROLE_NOT_FOUND |
| accountId가 `000`으로 끝남 | ROLE_NOT_FOUND |
| accountId가 `111`로 끝남 | INSUFFICIENT_PERMISSIONS |
| accountId가 `222`로 끝남 | ACCESS_DENIED |

#### curl 테스트

```bash
# 설정 등록 성공
curl -X PUT http://localhost:3000/api/services/SERVICE-B/settings/aws \
  -H "Content-Type: application/json" \
  -d '{"accountId": "555555555555", "scanRoleArn": "arn:aws:iam::555555555555:role/ScanRole"}'

# INVALID_ACCOUNT_ID
curl -X PUT http://localhost:3000/api/services/SERVICE-B/settings/aws \
  -H "Content-Type: application/json" \
  -d '{"accountId": "12345", "scanRoleArn": "arn:aws:iam::12345:role/ScanRole"}'
```

---

## Scan Role 재검증

### `POST /api/services/[serviceCode]/settings/aws/verify-scan-role`

등록된 Scan Role 재검증.

#### Response

**성공** (200 OK):
```typescript
interface VerifyScanRoleSuccessResponse {
  valid: true;
  roleArn: string;
  verifiedAt: string;
}
```

**실패** (200 OK):
```typescript
interface VerifyScanRoleFailureResponse {
  valid: false;
  errorCode: 'ROLE_NOT_FOUND' | 'INSUFFICIENT_PERMISSIONS' | 'ACCESS_DENIED';
  errorMessage: string;
  guide: {
    title: string;
    steps: string[];
    documentUrl?: string;
  };
}
```

#### 시뮬레이션 규칙

| accountId 끝자리 | 결과 |
|-----------------|------|
| `333` | ROLE_NOT_FOUND (삭제됨) |
| `444` | INSUFFICIENT_PERMISSIONS (권한 변경됨) |
| 그 외 | 성공 |

#### curl 테스트

```bash
# 검증 성공 (SERVICE-A)
curl -X POST http://localhost:3000/api/services/SERVICE-A/settings/aws/verify-scan-role

# 미등록 상태 (SERVICE-B)
curl -X POST http://localhost:3000/api/services/SERVICE-B/settings/aws/verify-scan-role
```

---

## E2E 시나리오

### 시나리오 1: AWS 프로젝트 생성 (TF 권한 있음)

```bash
# 1. TF Role 검증
curl -X POST http://localhost:3000/api/aws/verify-tf-role \
  -H "Content-Type: application/json" \
  -d '{"accountId": "123456789012"}'
# → valid: true

# 2. 프로젝트 생성 후 설치 상태 조회
curl http://localhost:3000/api/aws/projects/{projectId}/installation-status
# → serviceTfCompleted: false

# 3. 10초 후 다시 조회
# → serviceTfCompleted: true, bdcTfCompleted: false

# 4. 15초 후 완료 확인
# → bdcTfCompleted: true, completedAt: "..."
```

### 시나리오 2: 서비스 AWS 설정 흐름

```bash
# 1. 설정 조회 (미등록)
curl http://localhost:3000/api/services/SERVICE-B/settings/aws
# → scanRole.registered: false, guide 포함

# 2. 설정 등록
curl -X PUT http://localhost:3000/api/services/SERVICE-B/settings/aws \
  -H "Content-Type: application/json" \
  -d '{"accountId": "555555555555", "scanRoleArn": "arn:aws:iam::555555555555:role/ScanRole"}'
# → updated: true

# 3. Scan Role 재검증
curl -X POST http://localhost:3000/api/services/SERVICE-B/settings/aws/verify-scan-role
# → valid: true
```

---

## 초기 데이터

### AWS 설치 상태

| 프로젝트 | hasTfPermission | serviceTf | bdcTf | 상태 |
|---------|----------------|-----------|-------|------|
| proj-1 | true | ✅ | ✅ | 완료 |
| proj-3 | true | ✅ | ❌ | 진행중 |
| proj-5 | true | ✅ | ✅ | 완료 |

### AWS 서비스 설정

| 서비스 | accountId | Scan Role | status |
|-------|-----------|-----------|--------|
| SERVICE-A | 123456789012 | PIIAgentScanRole | VALID |
| SERVICE-B | - | (미등록) | - |
| SERVICE-C | 987654321098 | PIIAgentScanRole | NOT_VERIFIED |

---

## 파일 구조

```
app/api/
├── aws/
│   ├── verify-tf-role/
│   │   └── route.ts
│   └── projects/
│       └── [projectId]/
│           ├── installation-status/
│           │   └── route.ts
│           ├── check-installation/
│           │   └── route.ts
│           └── terraform-script/
│               └── route.ts
└── services/
    └── [serviceCode]/
        └── settings/
            └── aws/
                ├── route.ts
                └── verify-scan-role/
                    └── route.ts

lib/
├── mock-installation.ts       # 설치 상태 비즈니스 로직
├── mock-service-settings.ts   # 서비스 설정 비즈니스 로직
├── mock-data.ts               # 초기 데이터
└── types.ts                   # AWS 타입 정의
```

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-02 | 문서 작성, 검증 내용 통합 |
