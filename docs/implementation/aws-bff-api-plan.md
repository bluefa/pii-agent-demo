# AWS BFF API 구현 계획

> AWS Provider 전용 API Routes 구현 계획 및 검증 전략

---

## 개요

### 참조 문서
- BFF API 명세: `docs/api/providers/aws.md`
- 공통 타입/에러: `docs/api/common.md`
- Core API: `docs/api/core.md`
- Scan API: `docs/api/scan.md`

### 현재 상태
- ✅ Scan API v2 구현 완료 (`app/api/v2/projects/[projectId]/scan/`)
- ❌ AWS 전용 API 미구현

---

## 구현 대상 API 목록

### 1. TerraformExecutionRole 검증 API

| 항목 | 내용 |
|------|------|
| 엔드포인트 | `POST /api/aws/verify-tf-role` |
| 우선순위 | 높음 (프로젝트 생성 전 필수) |
| 의존성 | 없음 |

**요청/응답**:
```typescript
// 요청
{ accountId: string, roleArn?: string }

// 성공 응답
{ valid: true, roleArn: string, permissions: {...} }

// 실패 응답
{ valid: false, errorCode: string, errorMessage: string, guide: {...} }
```

**구현 작업**:
- [ ] Route Handler 생성: `app/api/aws/verify-tf-role/route.ts`
- [ ] 비즈니스 로직: Role 검증 시뮬레이션
- [ ] 에러 케이스별 응답 구현 (ROLE_NOT_FOUND, INSUFFICIENT_PERMISSIONS, ACCESS_DENIED)

---

### 2. 설치 상태 API

| 항목 | 내용 |
|------|------|
| 엔드포인트 | `GET /api/aws/projects/{projectId}/installation-status` |
| 우선순위 | 높음 |
| 의존성 | 프로젝트 존재 |

**응답**:
```typescript
{
  provider: 'AWS',
  hasTfPermission: boolean,
  serviceTfCompleted: boolean,
  bdcTfCompleted: boolean,
  completedAt?: string,
  lastCheckedAt?: string
}
```

**구현 작업**:
- [ ] Route Handler 생성: `app/api/aws/projects/[projectId]/installation-status/route.ts`
- [ ] 프로젝트별 설치 상태 관리 로직 (lib/mock-installation.ts)
- [ ] 시간 기반 자동 완료 시뮬레이션

---

### 3. TF Script 다운로드 API

| 항목 | 내용 |
|------|------|
| 엔드포인트 | `GET /api/aws/projects/{projectId}/terraform-script` |
| 우선순위 | 중간 (TF 권한 없는 케이스) |
| 의존성 | 프로젝트의 hasTfPermission = false |

**응답**:
```typescript
{
  downloadUrl: string,
  fileName: string,
  expiresAt: string
}
```

**구현 작업**:
- [ ] Route Handler 생성: `app/api/aws/projects/[projectId]/terraform-script/route.ts`
- [ ] 다운로드 URL 생성 로직 (presigned URL 시뮬레이션)

---

### 4. 설치 상태 확인 (Refresh) API

| 항목 | 내용 |
|------|------|
| 엔드포인트 | `POST /api/aws/projects/{projectId}/check-installation` |
| 우선순위 | 높음 |
| 의존성 | 설치 상태 API |

**응답**:
```typescript
{
  provider: 'AWS',
  hasTfPermission: boolean,
  serviceTfCompleted: boolean,
  bdcTfCompleted: boolean,
  completedAt?: string,
  lastCheckedAt: string,  // 방금 확인한 시간
  error?: { code: string, message: string, guide?: {...} }
}
```

**구현 작업**:
- [ ] Route Handler 생성: `app/api/aws/projects/[projectId]/check-installation/route.ts`
- [ ] 설치 상태 업데이트 로직
- [ ] Service TF 완료 시 → BDC TF 자동 시작 시뮬레이션
- [ ] 에러 케이스 응답 (VALIDATION_FAILED, ACCESS_DENIED)

---

### 5. 서비스 AWS 설정 API

| 항목 | 내용 |
|------|------|
| 엔드포인트 | `GET/PUT /api/services/{serviceCode}/settings/aws` |
| 우선순위 | 중간 |
| 의존성 | 서비스 코드 존재 |

**GET 응답**:
```typescript
{
  accountId?: string,
  scanRole: { registered: boolean, roleArn?: string, status?: string },
  guide?: { title: string, steps: string[], documentUrl?: string }
}
```

**PUT 요청/응답**:
```typescript
// 요청
{ accountId: string, scanRoleArn: string }

// 성공
{ updated: true, accountId: string, scanRole: {...} }

// 실패
{ updated: false, errorCode: string, errorMessage: string, guide: {...} }
```

**구현 작업**:
- [ ] Route Handler 생성: `app/api/services/[serviceCode]/settings/aws/route.ts`
- [ ] 서비스별 AWS 설정 관리 로직 (lib/mock-service-settings.ts)
- [ ] 설정 검증 로직

---

### 6. Scan Role 검증 API

| 항목 | 내용 |
|------|------|
| 엔드포인트 | `POST /api/services/{serviceCode}/settings/aws/verify-scan-role` |
| 우선순위 | 중간 |
| 의존성 | 서비스 AWS 설정 |

**응답**:
```typescript
// 성공
{ valid: true, roleArn: string, verifiedAt: string }

// 실패
{ valid: false, errorCode: string, errorMessage: string, guide: {...} }
```

**구현 작업**:
- [ ] Route Handler 생성: `app/api/services/[serviceCode]/settings/aws/verify-scan-role/route.ts`
- [ ] 기존 등록된 Role 재검증 로직

---

## 구현 순서 (의존성 기반)

```
Phase 1: 기반 로직
├── lib/mock-installation.ts (설치 상태 관리)
└── lib/mock-service-settings.ts (서비스 설정 관리)

Phase 2: TF Role 검증 (프로젝트 생성 전)
└── POST /api/aws/verify-tf-role

Phase 3: 설치 상태 API (프로젝트 생성 후)
├── GET  /api/aws/projects/{projectId}/installation-status
├── POST /api/aws/projects/{projectId}/check-installation
└── GET  /api/aws/projects/{projectId}/terraform-script

Phase 4: 서비스 설정 API
├── GET/PUT /api/services/{serviceCode}/settings/aws
└── POST    /api/services/{serviceCode}/settings/aws/verify-scan-role
```

---

## 검증 계획

### 유닛 테스트

| 테스트 파일 | 범위 |
|------------|------|
| `lib/__tests__/mock-installation.test.ts` | 설치 상태 관리 로직 |
| `lib/__tests__/mock-service-settings.test.ts` | 서비스 설정 관리 로직 |

**테스트 케이스**:

#### 1. TF Role 검증
```typescript
describe('verify-tf-role', () => {
  it('유효한 Role ARN으로 검증 성공');
  it('존재하지 않는 Role → ROLE_NOT_FOUND');
  it('권한 부족 → INSUFFICIENT_PERMISSIONS');
  it('접근 거부 → ACCESS_DENIED');
  it('roleArn 생략 시 기본 Role 이름으로 검색');
});
```

#### 2. 설치 상태
```typescript
describe('installation-status', () => {
  it('초기 상태: serviceTfCompleted=false, bdcTfCompleted=false');
  it('TF 권한 있음 → 자동 설치 진행');
  it('TF 권한 없음 → 수동 설치 대기');
  it('Service TF 완료 후 BDC TF 자동 시작');
  it('모든 TF 완료 → completedAt 설정');
});
```

#### 3. check-installation
```typescript
describe('check-installation', () => {
  it('Service TF 리소스 검증 성공 → serviceTfCompleted=true');
  it('검증 실패 → error 응답 + 가이드');
  it('Service TF 완료 확인 시 BDC TF 자동 실행 트리거');
  it('lastCheckedAt 업데이트');
});
```

#### 4. 서비스 설정
```typescript
describe('service-settings-aws', () => {
  it('설정 미등록 시 guide 포함');
  it('설정 조회');
  it('설정 수정 + 자동 검증');
  it('잘못된 accountId → INVALID_ACCOUNT_ID');
  it('Role 검증 실패 → 에러 + 가이드');
});
```

#### 5. Scan Role 검증
```typescript
describe('verify-scan-role', () => {
  it('등록된 Role 재검증 성공');
  it('Role 삭제됨 → ROLE_NOT_FOUND');
  it('권한 변경됨 → INSUFFICIENT_PERMISSIONS');
});
```

---

### 통합 테스트 (E2E 시나리오)

#### 시나리오 1: AWS 프로젝트 생성 (TF 권한 있음)
```
1. POST /api/aws/verify-tf-role → 검증 성공
2. POST /api/projects (tfPermissionGranted: true)
3. GET /api/aws/projects/{id}/installation-status → 자동 설치 진행 중
4. (시간 경과)
5. GET /api/aws/projects/{id}/installation-status → 완료
```

#### 시나리오 2: AWS 프로젝트 생성 (TF 권한 없음)
```
1. POST /api/aws/verify-tf-role → 검증 실패 (ROLE_NOT_FOUND)
2. POST /api/projects (tfPermissionGranted: false)
3. GET /api/aws/projects/{id}/installation-status → 수동 설치 대기
4. GET /api/aws/projects/{id}/terraform-script → 다운로드
5. (사용자가 수동 설치)
6. POST /api/aws/projects/{id}/check-installation → 검증
7. GET /api/aws/projects/{id}/installation-status → 완료
```

#### 시나리오 3: 서비스 AWS 설정
```
1. GET /api/services/{code}/settings/aws → 미등록 (guide 포함)
2. PUT /api/services/{code}/settings/aws → 설정 등록
3. POST /api/services/{code}/settings/aws/verify-scan-role → 검증
4. GET /api/services/{code}/settings/aws → 등록됨
```

---

### API 응답 검증 체크리스트

| 검증 항목 | 설명 |
|----------|------|
| ✅ 응답 형식 | BFF API 명세와 일치 |
| ✅ 에러 코드 | 명세에 정의된 에러 코드 사용 |
| ✅ HTTP 상태 | 비즈니스 실패 200, 예외 4xx/5xx |
| ✅ guide 포함 | 에러 시 가이드 정보 포함 |
| ✅ 타입 안전성 | TypeScript 타입 정의 일치 |

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
├── mock-installation.ts       # 설치 상태 관리
├── mock-service-settings.ts   # 서비스 설정 관리
└── __tests__/
    ├── mock-installation.test.ts
    └── mock-service-settings.test.ts

types/
└── aws.ts  # AWS 전용 타입 정의
```

---

## 타입 정의 (types/aws.ts)

```typescript
// TF Role 검증
export interface VerifyTfRoleRequest {
  accountId: string;
  roleArn?: string;
}

export interface VerifyTfRoleSuccessResponse {
  valid: true;
  roleArn: string;
  permissions: {
    canCreateResources: boolean;
    canManageIam: boolean;
    canAccessS3: boolean;
  };
}

export interface VerifyTfRoleFailureResponse {
  valid: false;
  errorCode: 'ROLE_NOT_FOUND' | 'INSUFFICIENT_PERMISSIONS' | 'ACCESS_DENIED';
  errorMessage: string;
  guide: {
    title: string;
    steps: string[];
    documentUrl?: string;
  };
}

// 설치 상태
export interface AwsInstallationStatus {
  provider: 'AWS';
  hasTfPermission: boolean;
  serviceTfCompleted: boolean;
  bdcTfCompleted: boolean;
  completedAt?: string;
  lastCheckedAt?: string;
}

// check-installation 에러
export interface CheckInstallationError {
  code: 'VALIDATION_FAILED' | 'ACCESS_DENIED';
  message: string;
  guide?: {
    title: string;
    steps: string[];
  };
}

// TF Script
export interface TerraformScriptResponse {
  downloadUrl: string;
  fileName: string;
  expiresAt: string;
}

// 서비스 AWS 설정
export interface AwsServiceSettings {
  accountId?: string;
  scanRole: {
    registered: boolean;
    roleArn?: string;
    lastVerifiedAt?: string;
    status?: 'VALID' | 'INVALID' | 'NOT_VERIFIED';
  };
  guide?: {
    title: string;
    steps: string[];
    documentUrl?: string;
  };
}
```

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-01 | 초안 작성 |
