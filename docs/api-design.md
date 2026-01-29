# API 설계 문서

> 현재 구현된 API와 Cloud Provider 확장을 위해 필요한 API를 정리합니다.

---

# 설계 원칙

## Cloud Provider 확장성

1. **공통 API**: Provider 무관하게 동일한 인터페이스
2. **Provider 분기**: 하나의 API에서 `cloudProvider` 필드로 내부 분기
3. **Provider 특수 API**: 특정 Provider에서만 필요한 기능은 별도 API로 분리

## 응답 형식

```typescript
// 성공
{ success: true, data: T }

// 에러
{ error: string, message: string }
```

---

# 현재 구현된 API

## 인증/사용자

| 메서드 | 경로 | 설명 | 구현 |
|--------|------|------|------|
| GET | `/api/user/me` | 현재 사용자 정보 | ✅ |
| GET | `/api/user/services` | 접근 가능 서비스 목록 | ✅ |
| GET | `/api/users/search` | 사용자 검색 | ✅ |
| POST | `/api/dev/switch-user` | 사용자 전환 (개발용) | ✅ |

## 서비스

| 메서드 | 경로 | 설명 | 권한 | 구현 |
|--------|------|------|------|------|
| GET | `/api/services/{serviceCode}/projects` | 서비스별 과제 목록 | 본인 권한 | ✅ |
| GET | `/api/services/{serviceCode}/permissions` | 권한 사용자 목록 | ADMIN | ✅ |
| POST | `/api/services/{serviceCode}/permissions` | 권한 추가 | ADMIN | ✅ |
| DELETE | `/api/services/{serviceCode}/permissions/{userId}` | 권한 제거 | ADMIN | ✅ |

## 과제 (Project)

| 메서드 | 경로 | 설명 | 권한 | 구현 |
|--------|------|------|------|------|
| GET | `/api/projects/{projectId}` | 과제 상세 | 본인 권한 | ✅ |
| POST | `/api/projects` | 과제 등록 | ADMIN | ✅ |
| DELETE | `/api/projects/{projectId}` | 과제 삭제 | ADMIN | ❌ |

## 프로세스 진행

| 메서드 | 경로 | 설명 | 전이 | 구현 |
|--------|------|------|------|------|
| POST | `/api/projects/{projectId}/confirm-targets` | 연동 대상 확정 | 1→2 | ✅ |
| POST | `/api/projects/{projectId}/approve` | 승인 | 2→3 | ✅ |
| POST | `/api/projects/{projectId}/reject` | 반려 | 2→1 | ✅ |
| POST | `/api/projects/{projectId}/complete-installation` | 설치 완료 | 3→4 | ✅ |
| POST | `/api/projects/{projectId}/test-connection` | 연결 테스트 | 4→5 | ✅ |
| POST | `/api/projects/{projectId}/confirm-pii-agent` | PII Agent 확정 | 4→5 | ✅ |
| POST | `/api/projects/{projectId}/confirm-completion` | 완료 확정 | - | ✅ |

## 리소스/TF

| 메서드 | 경로 | 설명 | Provider | 구현 |
|--------|------|------|----------|------|
| GET | `/api/projects/{projectId}/resources` | 리소스 목록 | 공통 | ✅ |
| GET | `/api/projects/{projectId}/terraform-status` | TF 상태 | 공통 | ✅ |
| POST | `/api/projects/{projectId}/scan` | 스캔 실행 | AWS만 | ✅ |
| GET | `/api/projects/{projectId}/credentials` | Credential 목록 | 공통 | ✅ |
| PATCH | `/api/projects/{projectId}/resources/credential` | 리소스 Credential 연결 | 공통 | ✅ |

---

# 수정/확장 필요 API

## 1. 스캔 API 확장

**현재**: AWS만 지원
**필요**: AWS / Azure / GCP 지원

```
POST /api/projects/{projectId}/scan
```

**요청**:
```typescript
{
  // 없음 - cloudProvider는 project에서 자동 판단
}
```

**응답**:
```typescript
{
  success: true,
  scannedAt: string,           // 스캔 시간
  newResourcesFound: number,   // 신규 발견 수
  resources: Resource[]
}
```

**Provider별 동작**:
| Provider | 동작 |
|----------|------|
| AWS | 스캔 Role 사용 |
| Azure | Scan App 사용 |
| GCP | 프로젝트 권한 사용 (+ Host Project) |
| IDC | NOT_SUPPORTED |
| SDU | NOT_SUPPORTED |

---

## 2. 반려 API 수정

**현재**: reason 선택
**필요**: reason 필수 (3000자 이하)

```
POST /api/projects/{projectId}/reject
```

**요청**:
```typescript
{
  reason: string  // 필수, 3000자 이하
}
```

---

# 신규 API

## 스캔 이력

스캔 중복 방지 (5분 이내 스킵) 및 이력 조회용

```
GET /api/projects/{projectId}/scan-history
```

**응답**:
```typescript
{
  lastScannedAt: string | null,  // 최근 스캔 시간
  canScan: boolean,              // 스캔 가능 여부 (5분 경과)
  history: Array<{
    scannedAt: string,
    resourcesFound: number,
    newResourcesFound: number
  }>
}
```

---

## 사전 조치 / 설정

### 서비스 설정 조회

```
GET /api/services/{serviceCode}/settings
```

**응답** (Provider별로 다름):
```typescript
// AWS
{
  cloudProvider: 'AWS',
  scanRoleRegistered: boolean,
  tfPermissionGranted: boolean  // 프로젝트 레벨, immutable (VM은 UI 필터)
}

// Azure
{
  cloudProvider: 'Azure',
  scanAppRegistered: boolean,
  vmIntegrationEnabled: boolean,
  subnetInfo: { id: string, name: string } | null
}

// GCP
{
  cloudProvider: 'GCP',
  projectScanPermission: boolean,
  hostProjectPermission: boolean,
  subnetCreationRequired: boolean
}

// IDC
{
  cloudProvider: 'IDC',
  firewallPrepared: boolean
}

// SDU
{
  cloudProvider: 'SDU',
  firewallPaymentCompleted: boolean,
  dataUploaded: boolean
}
```

### 서비스 설정 수정

```
PUT /api/services/{serviceCode}/settings
```

**요청**: 위 응답과 동일 구조 (부분 업데이트)

---

## DB Credential

### 목록 조회 (서비스 단위)

```
GET /api/services/{serviceCode}/credentials
```

**응답**:
```typescript
{
  credentials: Array<{
    id: string,
    name: string,
    dbType: 'RDS' | 'DYNAMODB' | 'ORACLE' | 'MYSQL' | ...,
    username: string,
    createdAt: string,
    lastUsedAt: string | null
  }>,
  hasCredentials: boolean  // 1개 이상 등록 여부
}
```

### 등록

```
POST /api/services/{serviceCode}/credentials
```

**요청**:
```typescript
{
  name: string,
  dbType: string,
  username: string,
  password: string,
  // Provider별 추가 필드
  host?: string,      // IDC
  port?: number,      // IDC
  serviceId?: string  // Oracle
}
```

### 수정

```
PUT /api/services/{serviceCode}/credentials/{credentialId}
```

### 삭제

```
DELETE /api/services/{serviceCode}/credentials/{credentialId}
```

---

## TF Script 다운로드

AWS (TF 권한 없음): Service TF만 다운로드
Azure VM: VM TF 다운로드

```
GET /api/projects/{projectId}/terraform-script
```

**Query Params**:
```
?type=service|vm  // AWS는 service만, Azure VM은 vm
```

**응답**:
```typescript
{
  downloadUrl: string,  // 다운로드 URL
  fileName: string,
  expiresAt: string     // URL 만료 시간
}
```

---

## Azure 전용 API

### Private Endpoint 상태 조회

```
GET /api/projects/{projectId}/private-endpoints
```

**응답**:
```typescript
{
  endpoints: Array<{
    resourceId: string,
    resourceName: string,
    status: 'PENDING' | 'APPROVED' | 'REJECTED',
    requestedAt: string,
    approvedAt: string | null
  }>
}
```

### Private Endpoint 승인 완료 처리

서비스 담당자가 Azure Portal에서 승인 후 호출

```
POST /api/projects/{projectId}/private-endpoints/{resourceId}/confirm
```

**응답**:
```typescript
{
  success: true,
  status: 'APPROVED'
}
```

### VM TF 설치 상태 확인

시스템이 주기적으로 호출

```
GET /api/projects/{projectId}/vm-installation-status
```

**응답**:
```typescript
{
  installed: boolean,
  lastCheckedAt: string,
  vmResources: Array<{
    resourceId: string,
    installed: boolean
  }>
}
```

---

## GCP 전용 API

### Subnet 목록 조회

```
GET /api/projects/{projectId}/subnets
```

**Query Params**:
```
?vpcId=xxx&region=xxx
```

**응답**:
```typescript
{
  subnets: Array<{
    id: string,
    name: string,
    cidr: string,
    region: string,
    vpcId: string
  }>,
  canCreate: boolean  // 생성 권한 있음
}
```

### Subnet 생성

```
POST /api/projects/{projectId}/subnets
```

**요청**:
```typescript
{
  vpcId: string,
  region: string,
  name: string,
  cidr: string,
  purpose: 'REGIONAL_MANAGED_SUBNET'
}
```

---

## IDC 전용 API

### 리소스 직접 등록

```
POST /api/projects/{projectId}/resources
```

**요청**:
```typescript
{
  ip: string,
  port: number,
  databaseType: 'ORACLE' | 'MYSQL' | 'POSTGRESQL' | ...,
  serviceId?: string,  // Oracle 필수
  name?: string
}
```

### 리소스 수정

```
PUT /api/projects/{projectId}/resources/{resourceId}
```

### 리소스 삭제

```
DELETE /api/projects/{projectId}/resources/{resourceId}
```

### 방화벽 Source IP 추천

```
GET /api/firewall/source-ip-recommendation
```

**Query Params**:
```
?ipType=public|private|vpc
```

**응답**:
```typescript
{
  sourceIps: string[],
  port: number,
  description: string
}
```

---

## SDU 전용 API

### Crawler 설정

```
POST /api/projects/{projectId}/crawler
```

**요청**:
```typescript
{
  s3Bucket: string,
  s3Prefix?: string,
  schedule?: string  // cron expression
}
```

### Athena Table 목록 조회

```
GET /api/projects/{projectId}/athena-tables
```

**응답**:
```typescript
{
  tables: Array<{
    name: string,
    database: string,
    columns: number,
    lastUpdated: string
  }>
}
```

---

## History API

### 전체 History 조회

```
GET /api/projects/{projectId}/history
```

**Query Params**:
```
?type=all|approval|resource&limit=50&offset=0
```

**응답**:
```typescript
{
  history: Array<{
    id: string,
    type: 'APPROVAL' | 'REJECTION' | 'RESOURCE_ADD' | 'RESOURCE_EXCLUDE' | 'RESOURCE_INCLUDE',
    actor: { id: string, name: string },
    timestamp: string,
    details: {
      // APPROVAL/REJECTION
      reason?: string,

      // RESOURCE_*
      resourceId?: string,
      resourceName?: string,
      excludeReason?: string
    }
  }>,
  total: number
}
```

---

## 신규 리소스 현황

```
GET /api/services/{serviceCode}/new-resources-summary
```

**응답**:
```typescript
{
  hasNewResources: boolean,
  count: number,
  projects: Array<{
    projectId: string,
    projectName: string,
    newResourceCount: number
  }>
}
```

---

# API 요약 (Provider별)

## 공통 API

| 카테고리 | API 수 |
|----------|--------|
| 인증/사용자 | 4 |
| 서비스 | 4 |
| 과제 | 3 |
| 프로세스 | 7 |
| 리소스 | 5 |
| Credential | 4 |
| History | 1 |
| **소계** | **28** |

## Provider 특수 API

| Provider | API | 수 |
|----------|-----|---|
| AWS | TF Script 다운로드 | 1 |
| Azure | PE 상태, PE 확인, VM 상태, TF Script | 4 |
| GCP | Subnet 목록, Subnet 생성 | 2 |
| IDC | 리소스 CRUD, Source IP 추천 | 4 |
| SDU | Crawler, Athena Tables | 2 |
| **소계** | | **13** |

**총 API 수: 41개**

---

# 데이터 모델

> Production 수준 설계. 용도별 API 분리.

---

## 공통 타입

```typescript
type CloudProvider = 'AWS' | 'Azure' | 'GCP' | 'IDC' | 'SDU';

type ProcessStatus =
  | 'WAITING_TARGET_CONFIRMATION'  // 1. 연동 대상 확정 대기
  | 'WAITING_APPROVAL'             // 2. 승인 대기
  | 'INSTALLING'                   // 3. 설치 진행 중
  | 'WAITING_CONNECTION_TEST'      // 4. 연결 테스트 대기
  | 'COMPLETED';                   // 5. 완료

type ResourceType =
  // AWS
  | 'RDS' | 'RDS_CLUSTER' | 'DYNAMODB' | 'ATHENA' | 'REDSHIFT' | 'EC2'
  // Azure
  | 'SQL_DATABASE' | 'COSMOS_DB' | 'SYNAPSE' | 'AZURE_VM'
  // GCP
  | 'CLOUD_SQL' | 'BIGQUERY' | 'SPANNER'
  // IDC
  | 'IDC'
  // SDU
  | 'ATHENA_TABLE'
  ;
```

---

## Project (핵심 정보만)

```typescript
// GET /api/projects/{projectId}

interface Project {
  id: string;
  projectCode: string;
  name: string;
  description?: string;
  serviceCode: string;
  cloudProvider: CloudProvider;
  processStatus: ProcessStatus;
  tfPermissionGranted?: boolean;  // AWS 전용, immutable
  createdAt: string;
  updatedAt: string;
}
```

---

## Resource

```typescript
// GET /api/projects/{projectId}/resources

interface Resource {
  id: string;
  resourceType: ResourceType;
  resourceId: string;  // ARN, Azure Resource ID 등
  name: string;

  // 연결 정보 (서버리스/SDU는 없음)
  host?: string;
  port?: number;

  // 상태
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'NEW';
  lifecycleStatus: LifecycleStatus;
  isSelected: boolean;
  selectedCredentialId?: string;

  // Provider별 메타데이터
  metadata: ResourceMetadata;
}

interface ResourcesResponse {
  resources: Resource[];
  totalCount: number;
  selectedCount: number;
}
```

### ResourceMetadata (Discriminated Union)

```typescript
interface AwsMetadata {
  provider: 'AWS';
  region: string;
  arn: string;
}

interface AzureMetadata {
  provider: 'Azure';
  region: string;
  subscriptionId: string;
  resourceGroup: string;
}

interface GcpMetadata {
  provider: 'GCP';
  region: string;
  projectId: string;
}

interface IdcMetadata {
  provider: 'IDC';
}

interface SduMetadata {
  provider: 'SDU';
  s3Bucket: string;
  athenaDatabase: string;
}

type ResourceMetadata =
  | AwsMetadata
  | AzureMetadata
  | GcpMetadata
  | IdcMetadata
  | SduMetadata;
```

---

## ScanInfo (스캔 정보)

```typescript
// GET /api/projects/{projectId}/scan-info
// 대상: AWS, Azure, GCP만

interface ScanInfo {
  lastScannedAt: string | null;
  canScan: boolean;            // 5분 경과 여부
  hasNewResources: boolean;    // 신규 리소스 존재
  newResourceCount: number;
}
```

---

## InstallationStatus (설치 상태 - Union Type)

```typescript
// GET /api/projects/{projectId}/installation-status

interface AwsInstallationStatus {
  provider: 'AWS';
  hasTfPermission: boolean;
  // TF 권한 O
  serviceTf?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  bdcTf?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  // TF 권한 X
  tfScriptDownloaded?: boolean;
  installationConfirmed?: boolean;
}

interface AzureInstallationStatus {
  provider: 'Azure';
  serviceTf: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  privateEndpointsPending: number;
  vmTfScriptDownloaded?: boolean;
  vmInstalled?: boolean;
}

interface GcpInstallationStatus {
  provider: 'GCP';
  subnetRequired: boolean;
  subnetCreated?: boolean;
  serviceTf: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

interface IdcInstallationStatus {
  provider: 'IDC';
  bdcTf: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  firewallOpened: boolean;
}

interface SduInstallationStatus {
  provider: 'SDU';
  crawlerConfigured: boolean;
  athenaTablesReady: boolean;
}

type InstallationStatus =
  | AwsInstallationStatus
  | AzureInstallationStatus
  | GcpInstallationStatus
  | IdcInstallationStatus
  | SduInstallationStatus;
```

---

## API 호출 전략 (페이지별)

### Project Detail 페이지

```
페이지 진입
    │
    ├─▶ GET /projects/{id}              ← 기본 정보
    ├─▶ GET /projects/{id}/resources    ← 리소스 목록
    └─▶ GET /projects/{id}/scan-info    ← 스캔 정보 (AWS/Azure/GCP)
    │
    ▼ (processStatus에 따라)
    ├─▶ GET /installation-status        ← 설치 상태 (3단계)
    ├─▶ GET /private-endpoints          ← Azure PE 상태
    └─▶ GET /history                    ← 이력 (탭 클릭시)
```

### Admin 목록 페이지

```
페이지 진입
    │
    └─▶ GET /services/{code}/projects   ← 과제 목록 (요약 정보)
```

### 서비스 설정 페이지

```
페이지 진입
    │
    ├─▶ GET /services/{code}/settings      ← 사전조치 상태
    └─▶ GET /services/{code}/credentials   ← Credential 목록
```

---

## 별도 API 정리

| API | 설명 | 조회 시점 |
|-----|------|----------|
| `GET /projects/{id}` | 프로젝트 기본 정보 | 페이지 진입 |
| `GET /projects/{id}/resources` | 리소스 목록 | 페이지 진입 |
| `GET /projects/{id}/scan-info` | 스캔 정보 | 페이지 진입 (AWS/Azure/GCP) |
| `GET /projects/{id}/installation-status` | 설치 상태 상세 | 3단계 (설치 중) |
| `GET /projects/{id}/private-endpoints` | PE 상태 | Azure + 3단계 |
| `GET /projects/{id}/history` | 이력 | 탭 클릭 |
| `GET /services/{code}/settings` | 서비스 설정 | 설정 페이지 |
| `GET /services/{code}/credentials` | Credential 목록 | 설정 페이지 |

---

# 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-28 | 초안 작성 - 전체 API 설계 |
