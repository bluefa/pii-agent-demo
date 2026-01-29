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
  processStatus: ProcessStatus,
  vmIntegrationEnabled: boolean,
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
    processStatus: ProcessStatus,
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
  vmIntegrationEnabled?: boolean
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

## 프로세스 진행

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
| 2026-01-29 | 초안 작성 |
