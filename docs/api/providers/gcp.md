> **DEPRECATED**: 이 문서는 더 이상 유지보수되지 않습니다. `docs/swagger/gcp.yaml`을 참조하세요.
>
> **주의 (2026-04-24)**: 본 문서의 `/api/gcp/projects/{projectId}/...` URL 에서의 `{projectId}`는 내부 과제 식별자(=레거시, 현 `targetSourceId`)를 의미하며, projid-removal W1-W4 merge 로 `/integration/api/v1/gcp/target-sources/{targetSourceId}/...` 형태로 이관되었습니다. 본 문서 하단에 등장하는 GCP Cloud SQL / BigQuery / Spanner 설명 등의 `projectId`는 **GCP Cloud Project ID**(외부 식별자)로 내부 개념과 무관합니다 — 혼동 금지.

# GCP API

> GCP Provider 전용 API를 정의합니다.

---

## 케이스 분류

| 케이스 | 연결 유형 | 특이사항 |
|--------|-----------|----------|
| Case 1 | Private IP (Cloud SQL) | Regional Managed Proxy Subnet 필요 여부 확인 |
| Case 2 | PSC (Cloud SQL) | PSC Connection 승인 필요 |
| Case 3 | BigQuery | IAM Binding만 필요 (네트워크 설정 없음) |

> GCP는 VM 연동 미지원
> Cloud SQL 사용 시 Host Project 스캔 권한 필요

**연결 유형 결정 기준**:
- `CLOUD_SQL` 리소스 → Private IP 또는 PSC (네트워크 구성에 따라 결정)
- `BIGQUERY` 리소스 → BigQuery 전용 프로세스

---

## 스캔

> 스캔 API는 [scan.md](../scan.md) 참조
> GCP 특이사항: Cloud SQL 사용 시 Host Project 권한 필요

---

## 설치 상태

> TF 설치는 Backend에서 자동 처리되며, Frontend는 완료 여부만 확인합니다.
> 리소스별로 연결 유형에 따른 설치 상태를 관리합니다.

### 설치 상태 조회

```
GET /api/gcp/projects/{projectId}/installation-status
```

**응답**:
```typescript
{
  provider: 'GCP',

  // 리소스별 설치 상태
  resources: Array<{
    id: string,
    name: string,
    resourceType: 'CLOUD_SQL' | 'BIGQUERY',
    connectionType: GcpConnectionType,  // 'PRIVATE_IP' | 'PSC' | 'BIGQUERY'
    databaseType: string,

    // TF 설치 상태
    serviceTfStatus: GcpTfStatus,  // 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
    bdcTfStatus: GcpTfStatus,

    // Private IP 전용: Regional Managed Proxy Subnet 상태
    regionalManagedProxy?: {
      exists: boolean,
      networkProjectId: string,
      vpcName: string,
      cloudSqlRegion: string,
      subnetName?: string,
      subnetCidr?: string
    },

    // PSC 전용: PSC Connection 상태
    pscConnection?: {
      status: GcpPscStatus,  // 'NOT_REQUESTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
      connectionId?: string,
      serviceAttachmentUri?: string,
      requestedAt?: string,
      approvedAt?: string,
      rejectedAt?: string
    },

    // 해당 리소스의 전체 설치 완료 여부
    isCompleted: boolean
  }>,

  lastCheckedAt?: string
}
```

**GcpConnectionType 정의**:
```typescript
type GcpConnectionType = 'PRIVATE_IP' | 'PSC' | 'BIGQUERY';
```

**GcpTfStatus 정의**:
```typescript
type GcpTfStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
```

**GcpPscStatus 정의**:
```typescript
type GcpPscStatus =
  | 'NOT_REQUESTED'      // BDC측 확인 필요
  | 'PENDING_APPROVAL'   // PSC 승인 대기
  | 'APPROVED'           // 승인 완료
  | 'REJECTED'           // BDC측 재신청 필요
```

**Frontend 설치 완료 판단**:
```typescript
// 전체 설치 완료 여부
const allCompleted = resources.every(r => r.isCompleted);

// 연결 유형별 완료 판단
function isResourceCompleted(resource: GcpInstallResource): boolean {
  switch (resource.connectionType) {
    case 'PRIVATE_IP':
      // Regional Managed Proxy 확인 + Service TF + BDC TF
      return resource.serviceTfStatus === 'COMPLETED'
        && resource.bdcTfStatus === 'COMPLETED';
    case 'PSC':
      // 서비스 측 TF 없음 (serviceTfStatus=COMPLETED) + BDC TF + PSC 승인
      return resource.bdcTfStatus === 'COMPLETED'
        && resource.pscConnection?.status === 'APPROVED';
    case 'BIGQUERY':
      // Service TF + BDC TF (네트워크 불필요)
      return resource.serviceTfStatus === 'COMPLETED'
        && resource.bdcTfStatus === 'COMPLETED';
  }
}
```

### 설치 상태 확인 (Refresh)

```
POST /api/gcp/projects/{projectId}/check-installation
```

> Backend가 GCP API를 통해 TF 리소스 및 Subnet/PSC 상태를 자동 탐지합니다.
> Frontend는 "새로고침" 버튼으로 이 API를 호출하여 최신 상태를 확인합니다.

**응답** (installation-status와 동일 + error):
```typescript
{
  provider: 'GCP',
  resources: Array<GcpInstallResource>,
  lastCheckedAt: string,  // 방금 확인한 시간

  // 에러 시에만 포함
  error?: {
    code: 'VALIDATION_FAILED' | 'ACCESS_DENIED',
    message: string
  }
}
```

---

## Regional Managed Proxy Subnet (Private IP)

> Cloud SQL Private IP 연결 시 Regional Managed Proxy Subnet 필요 여부 확인
> GCP는 시스템이 직접 생성 권한 있음 (Azure와 다른 점)

### Subnet 상태 조회

```
GET /api/gcp/projects/{projectId}/regional-managed-proxy
```

**Query Params**:
```
?resourceId=xxx
```

**응답**:
```typescript
{
  exists: boolean,
  networkProjectId: string,
  vpcName: string,
  cloudSqlRegion: string,
  subnetName?: string,  // exists=true일 때만
  subnetCidr?: string   // exists=true일 때만
}
```

### Proxy Subnet 생성 요청

```
POST /api/gcp/projects/{projectId}/regional-managed-proxy
```

> 시스템이 직접 Subnet을 생성합니다

**요청**:
```typescript
{
  resourceId: string
}
```

**응답**:
```typescript
{
  created: boolean
}
```

---

## Service TF 리소스 목록

> 각 연결 유형별로 Service TF가 설치하는 GCP 리소스 목록 조회

### 리소스 목록 조회

```
GET /api/gcp/projects/{projectId}/service-tf-resources
```

**Query Params**:
```
?connectionType=PRIVATE_IP|PSC|BIGQUERY
```

**응답**:
```typescript
{
  connectionType: GcpConnectionType,
  resources: Array<{
    name: string,      // e.g. 'google_compute_network_endpoint_group'
    type: string,      // e.g. 'psc_neg'
    description: string
  }>,
  totalCount: number
}
```

---

## 서비스 설정

### 설정 조회

```
GET /api/services/{serviceCode}/settings/gcp
```

**응답**:
```typescript
{
  projectScanPermission: boolean,
  hostProjectPermission: boolean,  // Cloud SQL용
  subnetCreationRequired: boolean,
  guide?: {
    description: string,
    documentUrl?: string
  }
}
```

### 설정 수정

```
PUT /api/services/{serviceCode}/settings/gcp
```

**요청**:
```typescript
{
  projectScanPermission?: boolean,
  hostProjectPermission?: boolean,
  subnetCreationRequired?: boolean
}
```

---

## 구현 상태

### BFF API

| 엔드포인트 | 상태 | 비고 |
|-----------|------|------|
| GET /api/gcp/projects/{projectId}/installation-status | 🚧 미구현 | 리소스별 설치 상태 |
| POST /api/gcp/projects/{projectId}/check-installation | 🚧 미구현 | 상태 새로고침 |
| GET /api/gcp/projects/{projectId}/regional-managed-proxy | 🚧 미구현 | Proxy Subnet 상태 |
| POST /api/gcp/projects/{projectId}/create-proxy-subnet | 🚧 미구현 | Subnet 자동 생성 |
| GET /api/gcp/projects/{projectId}/service-tf-resources | 🚧 미구현 | TF 리소스 목록 |
| GET /api/services/{serviceCode}/settings/gcp | 🚧 미구현 | 서비스 설정 |
| PUT /api/services/{serviceCode}/settings/gcp | 🚧 미구현 | 설정 수정 |

### 관련 파일

| 파일 | 설명 |
|------|------|
| `lib/types/gcp.ts` | GCP 전용 타입 정의 |
| `lib/constants/gcp.ts` | 연결 유형, TF 상태, PSC 상태 라벨, 에러 코드 상수 |

---

## TODO

- [ ] Host Project 권한 에러 처리 상세화
- [ ] Proxy Subnet 생성 비동기 처리 (폴링 vs 웹소켓)
- [ ] PSC Connection 승인 가이드 상세 내용
- [ ] 각 연결 유형별 필수 사전 조건 검증 API

> 예외 처리는 [common.md](../common.md)의 "예외 처리 규칙" 참조

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-07 | 3가지 연결 유형(Private IP/PSC/BigQuery)별 상세 API 정의 |
| 2026-02-07 | GcpInstallResource 리소스별 설치 상태 구조 정의 |
| 2026-02-07 | Regional Managed Proxy Subnet API 추가 |
| 2026-02-07 | PSC Connection 상태 관리 추가 |
| 2026-02-07 | Service TF 리소스 목록 API 추가 |
| 2026-01-29 | 초안 작성 |
