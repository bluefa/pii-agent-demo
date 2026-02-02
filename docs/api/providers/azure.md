# Azure API

> Azure Provider 전용 API를 정의합니다.

---

## 케이스 분류

| 케이스 | VM | 특이사항 |
|--------|-----|----------|
| Case 1 | X | DB TF 자동 + PE 승인 필요 |
| Case 2 | O | DB TF 자동 + VM TF 수동 + Subnet 필요 |

> **VM 포함 여부 판단**
> - `confirm-targets` API 응답의 리소스 타입으로 판단
> - AZURE_VM 타입 리소스가 포함되었는지 Frontend에서 확인

---

## 스캔

> 스캔 API는 [scan.md](../scan.md) 참조

---

## 설치 상태

> TF 설치는 Backend에서 자동 처리되며, Frontend는 완료 여부만 확인합니다.
> PE 상태는 리소스별로 관리됩니다.

### 설치 상태 조회

```
GET /api/azure/projects/{projectId}/installation-status
```

**응답**:
```typescript
{
  provider: 'azure',

  // 전체 설치 완료 여부 (모든 리소스가 APPROVED일 때 true)
  installed: boolean,

  // 리소스별 Private Endpoint 상태 (DB 확정 리소스)
  resources: Array<{
    resourceId: string,
    resourceName: string,
    resourceType: string,

    // Private Endpoint 상태
    // - NOT_REQUESTED: TF 미완료 (BDC측 확인 필요)
    // - PENDING_APPROVAL 이상: TF 완료
    privateEndpoint: {
      id: string,
      name: string,
      status: PrivateEndpointStatus,
      requestedAt?: string,
      approvedAt?: string,
      rejectedAt?: string
    }
  }>,

  // 마지막 확인 시간
  lastCheckedAt?: string
}
```

**PrivateEndpointStatus 정의**:
```typescript
type PrivateEndpointStatus =
  | 'NOT_REQUESTED'      // TF 미완료, BDC측 확인 필요
  | 'PENDING_APPROVAL'   // TF 완료, 승인 대기 (서비스 담당자가 Azure Portal에서 승인 필요)
  | 'APPROVED'           // TF 완료, 승인 완료
  | 'REJECTED'           // TF 완료, 거부됨 (BDC측 재신청 필요)
```

**Frontend 해석 예시**:
```typescript
// 전체 설치 완료 여부 (Backend에서 계산된 값 사용)
if (installed) {
  // 프로세스 다음 단계로 진행 가능
}

// 전체 TF 설치 완료 여부 (NOT_REQUESTED가 아니면 TF 완료)
const allTfCompleted = resources.every(r =>
  r.privateEndpoint.status !== 'NOT_REQUESTED'
);

// Private Endpoint 상태별 UI 표시
function getStatusMessage(status: PrivateEndpointStatus) {
  switch (status) {
    case 'NOT_REQUESTED': return 'TF 설치 대기 (BDC측 확인 필요)';
    case 'PENDING_APPROVAL': return 'Azure Portal에서 승인 필요';
    case 'APPROVED': return '승인 완료';
    case 'REJECTED': return 'BDC측 재신청 필요';
  }
}
```

### 설치 상태 확인 (Refresh)

```
POST /api/azure/projects/{projectId}/check-installation
```

> Backend가 Azure API를 통해 TF 리소스 및 PE 상태를 자동 탐지합니다.
> Frontend는 "새로고침" 버튼으로 이 API를 호출하여 최신 상태를 확인합니다.

**응답** (installation-status와 동일 + error):
```typescript
{
  provider: 'azure',

  // 전체 설치 완료 여부 (모든 리소스가 APPROVED일 때 true)
  installed: boolean,

  // 리소스별 Private Endpoint 상태 (DB 확정 리소스)
  resources: Array<{
    resourceId: string,
    resourceName: string,
    resourceType: string,
    privateEndpoint: {
      id: string,
      name: string,
      status: PrivateEndpointStatus,
      requestedAt?: string,
      approvedAt?: string,
      rejectedAt?: string
    }
  }>,

  lastCheckedAt: string,  // 방금 확인한 시간

  // 에러 시에만 포함
  error?: {
    code: 'VALIDATION_FAILED' | 'ACCESS_DENIED',
    message: string
  }
}
```

---

## VM 설치 상태

> VM 설치는 3단계로 진행됩니다:
> 1. **Subnet 설정** - 서비스 담당자가 PLS용 Subnet 생성 (수동)
> 2. **VM TF 설치** - 서비스 담당자가 TF Script 실행 (수동)
> 3. **Private Endpoint 승인** - 서비스 담당자가 Azure Portal에서 승인 (수동)

### VM 설치 상태 조회

```
GET /api/azure/projects/{projectId}/vm-installation-status
```

**응답**:
```typescript
{
  vms: Array<{
    vmId: string,
    vmName: string,

    // 설치 단계: 1. Subnet → 2. Terraform → 3. Private Endpoint
    subnetExists: boolean,        // PLS용 Subnet 존재 여부
    terraformInstalled: boolean,  // VM TF 설치 완료 여부

    // Subnet + TF 완료 후에만 PE 상태 존재
    privateEndpoint?: {
      id: string,
      name: string,
      status: PrivateEndpointStatus,
      requestedAt?: string,
      approvedAt?: string,
      rejectedAt?: string
    }
  }>,

  lastCheckedAt?: string
}
```

**Frontend 설치 단계 판단**:
```typescript
function getVmInstallStep(vm: VmStatus): InstallStep {
  // 1. Subnet 확인
  if (!vm.subnetExists) return 'SUBNET_REQUIRED';
  // 2. TF 설치 확인
  if (!vm.terraformInstalled) return 'VM_TF_REQUIRED';
  // 3. PE 상태 확인
  const peStatus = vm.privateEndpoint?.status;
  if (!peStatus || peStatus === 'NOT_REQUESTED') return 'PE_NOT_REQUESTED';
  if (peStatus === 'PENDING_APPROVAL') return 'PE_PENDING';
  if (peStatus === 'REJECTED') return 'PE_REJECTED';
  return 'COMPLETED';
}
```

### VM 설치 상태 확인 (Refresh)

```
POST /api/azure/projects/{projectId}/vm-check-installation
```

> Backend가 Azure API를 통해 VM 설치 상태를 자동 탐지합니다.

**응답** (vm-installation-status와 동일 + error):
```typescript
{
  vms: Array<{
    vmId: string,
    vmName: string,
    subnetExists: boolean,
    terraformInstalled: boolean,
    privateEndpoint?: {
      id: string,
      name: string,
      status: PrivateEndpointStatus,
      requestedAt?: string,
      approvedAt?: string,
      rejectedAt?: string
    }
  }>,

  lastCheckedAt: string,

  error?: {
    code: 'VALIDATION_FAILED' | 'ACCESS_DENIED',
    message: string
  }
}
```

---

## VM TF Script

> Subnet 준비 완료 후 다운로드 가능

### TF Script 다운로드

```
GET /api/azure/projects/{projectId}/vm-terraform-script
```

**응답**:
```typescript
{
  downloadUrl: string,
  fileName: string
}
```

---

## Subnet 가이드

> Azure는 Subnet 생성 권한 없음 - 가이드만 제공
> VM LoadBalancer + Private Link Service를 위해 PLS용 Subnet 필요

### Subnet 가이드 조회

```
GET /api/azure/projects/{projectId}/subnet-guide
```

**응답**:
```typescript
{
  description: string,
  documentUrl?: string
}
```

---

## 서비스 설정

> 서비스 단위로 Azure 연동에 필요한 설정을 관리합니다.

### 설정 조회

```
GET /api/services/{serviceCode}/settings/azure
```

**응답**:
```typescript
{
  // Scan App 설정
  scanApp: {
    registered: boolean,
    appId?: string,
    lastVerifiedAt?: string,
    status?: 'VALID' | 'INVALID' | 'NOT_VERIFIED'
  },

  // 안내 정보 (미등록 시)
  guide?: {
    description: string,
    documentUrl?: string
  }
}
```

---

## 구현 상태

### BFF API

| 엔드포인트 | 상태 | 비고 |
|-----------|------|------|
| GET /api/azure/projects/{projectId}/installation-status | ✅ 구현 완료 | 리소스별 TF + Private Endpoint 상태 |
| POST /api/azure/projects/{projectId}/check-installation | ✅ 구현 완료 | 상태 새로고침 (캐시 갱신) |
| GET /api/azure/projects/{projectId}/vm-installation-status | ✅ 구현 완료 | VM별 Subnet + TF 상태 |
| POST /api/azure/projects/{projectId}/vm-check-installation | ✅ 구현 완료 | VM 상태 새로고침 |
| GET /api/azure/projects/{projectId}/vm-terraform-script | ✅ 구현 완료 | TF Script 다운로드 정보 |
| GET /api/azure/projects/{projectId}/subnet-guide | ✅ 구현 완료 | 가이드 문서 URL |
| GET /api/services/{serviceCode}/settings/azure | ✅ 구현 완료 | Scan App 상태 |

### 관련 파일

| 파일 | 설명 |
|------|------|
| `lib/types/azure.ts` | Azure 전용 타입 정의 |
| `lib/constants/azure.ts` | Private Endpoint 상태, 에러 코드 상수 |
| `lib/mock-azure.ts` | Azure Mock 헬퍼 함수 |
| `lib/__tests__/mock-azure.test.ts` | 유닛 테스트 (25개 케이스) |

---

## TODO

- [x] 스캔 API 비동기 처리 방식 정의 → scan.md 참조
- [x] PE 승인 확인 방식 → 서비스 담당자가 Azure Portal에서 직접 승인, 상태 조회만
- [x] VM 설치 상태 확인 → 시스템 자동 감지, 상태 조회만
- [x] API 경로에 /azure/ prefix 추가 (AWS와 통일)
- [x] TfStatus → boolean 단순화 (완료/미완료만 표시)
- [x] check-installation API 추가 (자동 탐지 방식)
- [ ] Subnet 가이드 상세 내용 정의

> 예외 처리는 [common.md](../common.md)의 "예외 처리 규칙" 참조

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-02 | VM 설치 상태에 Private Endpoint 정보 추가 (Subnet → TF → PE 3단계) |
| 2026-02-01 | API 경로에 /azure/ prefix 추가 (AWS와 통일) |
| 2026-02-02 | installed 필드 추가 (모든 리소스 APPROVED일 때 true) |
| 2026-02-02 | tfCompleted 제거 (privateEndpoint.status로 TF 완료 여부 판단) |
| 2026-02-01 | tfStatus → tfCompleted boolean 단순화 |
| 2026-02-01 | check-installation, vm-check-installation API 추가 (자동 탐지) |
| 2026-02-01 | 서비스 설정 API 상세 정의 (AWS와 패턴 통일) |
| 2026-02-01 | Scan App 확인 API 제거 → 서비스 설정으로 통합 |
| 2026-02-01 | API 전면 재설계: PE 상태 리소스별 관리, VM 설치 상태 API 분리 |
| 2026-02-01 | PE 상태값 정의 (NOT_REQUESTED, PENDING_APPROVAL, APPROVED, REJECTED) |
| 2026-02-01 | ADR-001 반영: Backend는 상태 데이터만 제공, TF 트리거 API 제거 |
| 2026-01-29 | 초안 작성 |
