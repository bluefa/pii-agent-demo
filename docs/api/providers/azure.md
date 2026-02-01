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

## Scan App 확인

> Scan App 등록은 가이드만 제공, 생성 여부만 확인

### Scan App 상태 조회

```
GET /api/projects/{projectId}/azure/scan-app-status
```

**응답**:
```typescript
{
  registered: boolean,
  scanAppId?: string,
  // 미등록 시 가이드
  guide?: {
    title: string,
    steps: string[],
    documentUrl?: string
  }
}
```

---

## 스캔

> 스캔 API는 [scan.md](../scan.md) 참조

---

## 설치 상태 [ASYNC]

> Backend는 상태 데이터만 제공, Frontend가 해석 (ADR-001)
> TF 설치 트리거는 Front에서 불가, 상태 조회만 가능

### DB 설치 상태 조회

```
GET /api/projects/{projectId}/installation-status
```

**응답**:
```typescript
{
  provider: 'Azure',

  // 리소스별 TF + PE 상태
  resources: Array<{
    resourceId: string,
    resourceName: string,
    resourceType: string,

    // TF 설치 상태
    tfStatus: TfStatus,

    // Private Endpoint 상태
    privateEndpoint?: {
      name: string,
      status: PeStatus,
      requestedAt?: string,
      approvedAt?: string,
      rejectedAt?: string
    }
  }>
}
```

**PeStatus 정의**:
```typescript
type PeStatus =
  | 'NOT_REQUESTED'      // BDC측 확인 필요 (PE 생성 요청 전)
  | 'PENDING_APPROVAL'   // 승인 대기 (서비스 담당자가 Azure Portal에서 승인 필요)
  | 'APPROVED'           // 승인 완료
  | 'REJECTED'           // 거부됨 (BDC측 재신청 필요)
```

**Frontend 해석 예시**:
```typescript
// PE 상태별 UI 표시
function getPeStatusMessage(status: PeStatus) {
  switch (status) {
    case 'NOT_REQUESTED': return 'BDC측 확인 필요';
    case 'PENDING_APPROVAL': return 'Azure Portal에서 승인 필요';
    case 'APPROVED': return '승인 완료';
    case 'REJECTED': return 'BDC측 재신청 필요';
  }
}

// 전체 PE 승인 완료 여부
const allPeApproved = resources.every(r =>
  r.privateEndpoint?.status === 'APPROVED'
);
```

---

## VM 설치 상태 [ASYNC]

> VM TF 설치는 서비스 담당자가 수동 실행, 시스템이 자동 감지
> Subnet 존재 여부 + TF 설치 여부를 VM별로 확인

### VM 설치 상태 조회

```
GET /api/projects/{projectId}/azure/vm-installation-status
```

**응답**:
```typescript
{
  vms: Array<{
    vmId: string,
    vmName: string,
    subnetExists: boolean,      // PLS용 Subnet 존재 여부
    terraformInstalled: boolean // VM TF 설치 완료 여부
  }>
}
```

**Frontend 해석 예시**:
```typescript
// 모든 VM의 Subnet 준비 완료 여부
const allSubnetsReady = vms.every(vm => vm.subnetExists);

// 모든 VM의 TF 설치 완료 여부
const allVmTfInstalled = vms.every(vm => vm.terraformInstalled);

// Subnet 미준비 시 가이드 표시
if (!allSubnetsReady) {
  showSubnetGuide();
}
```

---

## VM TF Script

> Subnet 준비 완료 후 다운로드 가능

### TF Script 다운로드

```
GET /api/projects/{projectId}/azure/vm-terraform-script
```

**응답**:
```typescript
{
  downloadUrl: string,
  fileName: string,
  expiresAt: string
}
```

---

## Subnet 가이드

> Azure는 Subnet 생성 권한 없음 - 가이드만 제공
> VM LoadBalancer + Private Link Service를 위해 PLS용 Subnet 필요

### Subnet 가이드 조회

```
GET /api/projects/{projectId}/azure/subnet-guide
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

### 설정 조회

```
GET /api/services/{serviceCode}/settings/azure
```

**응답**:
```typescript
{
  scanAppRegistered: boolean
}
```

---

## TODO

- [x] 스캔 API 비동기 처리 방식 정의 → scan.md 참조
- [x] PE 승인 확인 방식 → 서비스 담당자가 Azure Portal에서 직접 승인, 상태 조회만
- [x] VM 설치 상태 확인 → 시스템 자동 감지, 상태 조회만
- [ ] Subnet 가이드 상세 내용 정의

> 예외 처리는 [common.md](../common.md)의 "예외 처리 규칙" 참조

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-01 | API 전면 재설계: Scan App 확인 API 추가, PE 상태 리소스별 관리, VM 설치 상태 API 분리 |
| 2026-02-01 | PE 상태값 정의 (NOT_REQUESTED, PENDING_APPROVAL, APPROVED, REJECTED) |
| 2026-02-01 | ADR-001 반영: Backend는 상태 데이터만 제공, TF 트리거 API 제거 |
| 2026-01-29 | 초안 작성 |
