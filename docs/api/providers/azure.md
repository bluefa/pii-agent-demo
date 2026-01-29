# Azure API

> Azure Provider 전용 API를 정의합니다.

---

## 케이스 분류

| 케이스 | VM | 특이사항 |
|--------|-----|----------|
| Case 1 | X | TF 자동 + PE 승인 필요 |
| Case 2 | O | DB 자동 + VM 수동 TF + Subnet 필요 |

---

## 스캔

> 스캔 API는 [scan.md](../scan.md) 참조

---

## 설치 상태 [ASYNC]

> TF 설치는 비동기 작업 - TfStatus로 상태 추적

### 설치 상태 조회

```
GET /api/projects/{projectId}/installation-status
```

**응답**:
```typescript
{
  provider: 'Azure',
  serviceTf: TfStatus,
  privateEndpointsPending: number,

  // VM (vmIntegrationEnabled인 경우)
  vmTfScriptDownloaded?: boolean,
  vmInstalled?: boolean
}
```

---

## Private Endpoint [ASYNC]

> PE 승인은 서비스 담당자가 Azure Portal에서 수동 승인 - 비동기 확인 필요

### PE 상태 목록 조회

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
    approvedAt?: string
  }>
}
```

### PE 승인 완료 확인

```
POST /api/projects/{projectId}/private-endpoints/{resourceId}/confirm
```

> 서비스 담당자가 Azure Portal에서 승인 후 호출

---

## VM TF Script [ASYNC]

> VM 설치 상태는 시스템이 주기적으로 폴링하여 확인

### TF Script 다운로드

```
GET /api/projects/{projectId}/vm-terraform-script
```

**응답**:
```typescript
{
  downloadUrl: string,
  fileName: string,
  expiresAt: string
}
```

### VM 설치 상태 확인

```
GET /api/projects/{projectId}/vm-installation-status
```

> 시스템이 주기적으로 호출하여 확인

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

## Subnet

### Subnet 가이드 조회

```
GET /api/projects/{projectId}/subnet-guide
```

> Azure는 권한 없음 - 가이드만 제공

**응답**:
```typescript
{
  instructions: string,
  requirements: {
    vnetId: string,
    region: string,
    addressPrefix: string
  }
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
  scanAppRegistered: boolean,
  vmIntegrationEnabled: boolean,
  subnetInfo?: {
    id: string,
    name: string
  }
}
```

### 설정 수정

```
PUT /api/services/{serviceCode}/settings/azure
```

---

## TODO

- [ ] 스캔 API 비동기 처리 방식 정의
- [ ] PE 승인 확인 방식 (폴링 vs 수동)
- [ ] VM 설치 상태 폴링 주기
- [ ] Subnet 가이드 내용 정의

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-29 | 초안 작성 |
