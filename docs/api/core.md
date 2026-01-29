# Core API

> Provider 공통 API를 정의합니다.

---

## 사용자/인증

### 현재 사용자 정보

```
GET /api/user/me
```

**응답**:
```typescript
{
  id: string,
  name: string,
  email: string,
  role: Role,
  serviceCodePermissions: string[]
}
```

### 접근 가능 서비스 목록

```
GET /api/user/services
```

**응답**:
```typescript
{
  services: Array<{
    serviceCode: string,
    serviceName: string
  }>
}
```

---

## 프로젝트

### 프로젝트 기본 정보 조회

```
GET /api/projects/{projectId}
```

**응답**:
```typescript
{
  id: string,
  projectCode: string,
  name: string,
  description?: string,
  serviceCode: string,
  cloudProvider: CloudProvider,
  isIntegrated: boolean,  // 연동 완료 여부
  tfPermissionGranted?: boolean,  // AWS 전용, 프로젝트 생성 시 선택, immutable
  createdAt: string,
  updatedAt: string
}
```

### 서비스별 프로젝트 목록

```
GET /api/services/{serviceCode}/projects
```

**응답**:
```typescript
{
  projects: Array<{
    id: string,
    projectCode: string,
    name: string,
    cloudProvider: CloudProvider,
    isIntegrated: boolean,  // 연동 완료 여부
    createdAt: string
  }>
}
```

### 프로젝트 등록

```
POST /api/projects
```

**권한**: ADMIN

**요청**:
```typescript
{
  projectCode: string,
  name: string,
  description?: string,
  serviceCode: string,
  cloudProvider: CloudProvider,
  tfPermissionGranted?: boolean  // AWS 전용, 필수 (cloudProvider=AWS인 경우)
}
```

### 프로젝트 삭제

```
DELETE /api/projects/{projectId}
```

**권한**: ADMIN

---

## 리소스

### 리소스 목록 조회

```
GET /api/projects/{projectId}/resources
```

**응답**:
```typescript
{
  resources: Resource[],
  totalCount: number,
  selectedCount: number
}
```

**Resource 타입**:
```typescript
interface Resource {
  id: string,
  resourceType: ResourceType,
  resourceId: string,
  name: string,
  host?: string,
  port?: number,
  connectionStatus: ConnectionStatus,
  lifecycleStatus: LifecycleStatus,
  isSelected: boolean,
  selectedCredentialId?: string,
  metadata: ResourceMetadata
}
```

### ResourceMetadata (Provider별)

```typescript
interface AwsMetadata {
  provider: 'AWS',
  region: string,
  arn: string
}

interface AzureMetadata {
  provider: 'Azure',
  region: string,
  subscriptionId: string,
  resourceGroup: string
}

interface GcpMetadata {
  provider: 'GCP',
  region: string,
  projectId: string
}

interface IdcMetadata {
  provider: 'IDC'
}

interface SduMetadata {
  provider: 'SDU',
  s3Bucket: string,
  athenaDatabase: string
}

type ResourceMetadata =
  | AwsMetadata
  | AzureMetadata
  | GcpMetadata
  | IdcMetadata
  | SduMetadata;
```

---

## 프로젝트 상태

> **설계 원칙**: Backend는 비즈니스 상태 데이터만 제공하고, Frontend가 이를 해석하여 Process UI를 구성합니다.
> 상세 내용은 [ADR-001: Process 상태 관리 아키텍처](../adr/001-process-state-architecture.md) 참조.

### 프로젝트 상태 조회

```
GET /api/projects/{projectId}/status
```

**응답**:
```typescript
{
  // 스캔 상태 (AWS/Azure/GCP)
  scan?: {
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED',
    lastScanAt?: string,
    totalResourceCount?: number,
    newResourceCount?: number
  },

  // 리소스 확정 상태
  targets: {
    confirmed: boolean,
    confirmedAt?: string,
    selectedCount: number
  },

  // 승인 상태 (AWS/Azure/GCP만 해당, IDC/SDU는 null)
  approval: {
    required: boolean,
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | null,
    approvedAt?: string,
    lastRejection?: {
      reason: string,
      rejectedAt: string,
      rejectedBy: { id: string, name: string }
    }
  },

  // 설치 상태
  installation: {
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
    // Provider별 상세는 별도 API 참조
  },

  // 연결 테스트 상태
  connectionTest: {
    status: 'NOT_TESTED' | 'PASSED' | 'FAILED',
    lastTestedAt?: string,
    passedCount?: number,
    failedCount?: number
  }
}
```

**Frontend 해석 예시**:
```typescript
// Frontend에서 현재 단계 계산
function getCurrentStep(status: ProjectStatus): Step {
  if (status.scan?.status !== 'COMPLETED') return 'SCAN';
  if (!status.targets.confirmed) return 'CONFIRM_TARGETS';
  if (status.approval.required && status.approval.status === 'PENDING') return 'WAITING_APPROVAL';
  if (status.installation.status !== 'COMPLETED') return 'INSTALLING';
  if (status.connectionTest.status !== 'PASSED') return 'CONNECTION_TEST';
  return 'COMPLETED';
}
```

---

## 상태 전이 API

### 연동 대상 확정

```
POST /api/projects/{projectId}/confirm-targets
```

**프로세스 전이**: 1 → 2

**요청**:
```typescript
{
  resourceIds: string[]
}
```

### 승인

```
POST /api/projects/{projectId}/approve
```

**권한**: ADMIN
**프로세스 전이**: 2 → 3

### 반려

```
POST /api/projects/{projectId}/reject
```

**권한**: ADMIN
**프로세스 전이**: 2 → 1

**요청**:
```typescript
{
  reason: string  // 필수, 3000자 이하
}
```

### 연결 테스트

```
POST /api/projects/{projectId}/test-connection
```

**프로세스 전이**: 4 → 5

**요청**:
```typescript
{
  resourceIds?: string[]  // 생략 시 전체
}
```

**응답**:
```typescript
{
  results: Array<{
    resourceId: string,
    success: boolean,
    error?: string
  }>
}
```

---

## Credential

### 서비스별 Credential 목록

```
GET /api/services/{serviceCode}/credentials
```

**응답**:
```typescript
{
  credentials: Array<{
    id: string,
    name: string,
    dbType: string,
    username: string,
    createdAt: string
  }>,
  hasCredentials: boolean
}
```

### Credential 등록

```
POST /api/services/{serviceCode}/credentials
```

**요청**:
```typescript
{
  name: string,
  dbType: string,
  username: string,
  password: string
}
```

### Credential 수정

```
PUT /api/services/{serviceCode}/credentials/{credentialId}
```

### Credential 삭제

```
DELETE /api/services/{serviceCode}/credentials/{credentialId}
```

### 리소스에 Credential 연결

```
PATCH /api/projects/{projectId}/resources/{resourceId}/credential
```

**요청**:
```typescript
{
  credentialId: string | null
}
```

---

## History

### 프로젝트 History 조회

```
GET /api/projects/{projectId}/history
```

**Query Params**:
```
?type=all|approval|resource
&limit=50
&offset=0
```

**응답**:
```typescript
{
  history: Array<{
    id: string,
    type: 'APPROVAL' | 'REJECTION' | 'RESOURCE_ADD' | 'RESOURCE_EXCLUDE',
    actor: { id: string, name: string },
    timestamp: string,
    details: {
      reason?: string,
      resourceId?: string,
      resourceName?: string
    }
  }>,
  total: number
}
```

---

## 권한 관리

### 권한 사용자 목록

```
GET /api/services/{serviceCode}/permissions
```

**권한**: ADMIN

### 권한 추가

```
POST /api/services/{serviceCode}/permissions
```

**권한**: ADMIN

**요청**:
```typescript
{
  userId: string
}
```

### 권한 제거

```
DELETE /api/services/{serviceCode}/permissions/{userId}
```

**권한**: ADMIN

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-30 | 프로젝트 상태 API를 Data-Driven 방식으로 변경 (ADR-001) |
| 2026-01-30 | AWS tfPermissionGranted 추가 (프로젝트 레벨, immutable) |
| 2026-01-29 | 초안 작성 |
