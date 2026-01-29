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

### ResourceMetadata (ResourceType별 Discriminated Union)

> Provider + ResourceType으로 discriminate하여 타입 안전성 확보

#### AWS

```typescript
interface DynamoDbMetadata {
  provider: 'AWS',
  resourceType: 'DYNAMODB',
  region: string
}

interface RdsMetadata {
  provider: 'AWS',
  resourceType: 'RDS',
  region: string,
  arn: string,
  host: string,
  port: number,
  databaseName?: string,
  vpcId: string
}

interface RdsClusterMetadata {
  provider: 'AWS',
  resourceType: 'RDS_CLUSTER',
  region: string,
  arn: string,
  host: string,
  port: number,
  databaseName?: string,
  vpcId: string
}

interface AthenaMetadata {
  provider: 'AWS',
  resourceType: 'ATHENA',
  region: string,
  databaseName: string,
  catalog: string
}

interface RedshiftMetadata {
  provider: 'AWS',
  resourceType: 'REDSHIFT',
  region: string,
  arn: string,
  host: string,
  port: number,
  databaseName: string,
  vpcId: string
}

interface Ec2Metadata {
  provider: 'AWS',
  resourceType: 'EC2',
  region: string,
  instanceId: string,
  hostName?: string,       // VPC 설정에 따라 존재
  privateIp: string,       // 항상 존재
  vpcId: string
}

type AwsResourceMetadata =
  | DynamoDbMetadata
  | RdsMetadata
  | RdsClusterMetadata
  | AthenaMetadata
  | RedshiftMetadata
  | Ec2Metadata;
```

#### Azure

```typescript
// Azure Database 공통 필드
interface AzureDbBase {
  provider: 'Azure',
  region: string,
  subscriptionId: string,
  resourceGroup: string,
  serverName: string,
  host: string,
  port: number
}

interface AzureMssqlMetadata extends AzureDbBase {
  resourceType: 'AZURE_MSSQL'
}

interface AzurePostgresqlMetadata extends AzureDbBase {
  resourceType: 'AZURE_POSTGRESQL'
}

interface AzureMysqlMetadata extends AzureDbBase {
  resourceType: 'AZURE_MYSQL'
}

interface AzureMariadbMetadata extends AzureDbBase {
  resourceType: 'AZURE_MARIADB'
}

interface AzureCosmosMetadata {
  provider: 'Azure',
  resourceType: 'AZURE_COSMOS_NOSQL',
  region: string,
  subscriptionId: string,
  resourceGroup: string,
  accountName: string,
  endpoint: string
}

interface AzureSynapseMetadata {
  provider: 'Azure',
  resourceType: 'AZURE_SYNAPSE',
  region: string,
  subscriptionId: string,
  resourceGroup: string,
  workspaceName: string,
  host: string,
  port: number
}

interface AzureVmMetadata {
  provider: 'Azure',
  resourceType: 'AZURE_VM',
  region: string,
  subscriptionId: string,
  resourceGroup: string,
  vmName: string,
  hostName?: string,       // 설정에 따라 존재
  privateIp: string        // 항상 존재
}

type AzureResourceMetadata =
  | AzureMssqlMetadata
  | AzurePostgresqlMetadata
  | AzureMysqlMetadata
  | AzureMariadbMetadata
  | AzureCosmosMetadata
  | AzureSynapseMetadata
  | AzureVmMetadata;
```

#### GCP

```typescript
interface CloudSqlMetadata {
  provider: 'GCP',
  resourceType: 'CLOUD_SQL',
  region: string,
  projectId: string,
  instanceName: string,
  ip: string,
  serviceAttachment?: string
}

interface BigQueryMetadata {
  provider: 'GCP',
  resourceType: 'BIGQUERY',
  region: string,
  projectId: string
}

interface SpannerMetadata {
  provider: 'GCP',
  resourceType: 'SPANNER',
  region: string,
  projectId: string,
  instanceId: string
}

type GcpResourceMetadata =
  | CloudSqlMetadata
  | BigQueryMetadata
  | SpannerMetadata;
```

#### IDC / SDU

```typescript
interface IdcMetadata {
  provider: 'IDC',
  resourceType: 'IDC'
  // 수동 입력이므로 추가 메타데이터 없음
}

interface SduMetadata {
  provider: 'SDU',
  resourceType: 'ATHENA_TABLE',
  s3Bucket: string,
  athenaDatabase: string,
  tableName: string
}

type OtherResourceMetadata = IdcMetadata | SduMetadata;
```

#### Union Type

```typescript
type ResourceMetadata =
  | AwsResourceMetadata
  | AzureResourceMetadata
  | GcpResourceMetadata
  | OtherResourceMetadata;
```

#### Frontend 타입 가드 예시

```typescript
function getConnectionInfo(metadata: ResourceMetadata) {
  if (metadata.provider === 'AWS' && metadata.resourceType === 'RDS') {
    // TypeScript가 RdsMetadata로 타입 좁히기
    return `${metadata.host}:${metadata.port}`;
  }
  if (metadata.provider === 'AWS' && metadata.resourceType === 'EC2') {
    // Ec2Metadata로 타입 좁히기
    return metadata.hostName ?? metadata.privateIp;
  }
  // ...
}
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
  resources: Array<{
    resourceId: string,
    // VM 타입 (EC2, AZURE_VM) 전용 - 필수 입력
    port?: number
  }>
}
```

**VM (EC2, AZURE_VM) 연동 규칙**:
| 항목 | 설명 |
|------|------|
| `port` 필수 | VM 타입은 port 입력 필수 |
| Backend 검증 | port 미입력 시 400 Bad Request |
| **Frontend 검증** | VM 리소스 선택 시 port 미입력이면 Submit 버튼 비활성화 |

**Frontend Validation 예시**:
```typescript
const canSubmit = selectedResources.every(r => {
  if (r.resourceType === 'EC2' || r.resourceType === 'AZURE_VM') {
    return r.port != null && r.port > 0;
  }
  return true;
});
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
| 2026-01-30 | Azure DB 타입 세분화 (MSSQL, PostgreSQL, MySQL, MariaDB, CosmosDB NoSQL) |
| 2026-01-30 | VM (EC2, AZURE_VM) 연동 시 port 필수 + Frontend validation 규칙 추가 |
| 2026-01-30 | GCP Cloud SQL에 ip, serviceAttachment 추가, BigQuery 단순화 |
| 2026-01-30 | ResourceMetadata를 ResourceType별 Discriminated Union으로 확장 |
| 2026-01-30 | 프로젝트 상태 API를 Data-Driven 방식으로 변경 (ADR-001) |
| 2026-01-30 | AWS tfPermissionGranted 추가 (프로젝트 레벨, immutable) |
| 2026-01-29 | 초안 작성 |
