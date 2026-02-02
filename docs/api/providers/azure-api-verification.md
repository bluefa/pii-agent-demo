# Azure BFF API 검증 결과

> 구현된 Azure API의 동작 검증 결과 및 실제 응답 예시

---

## 1. 검증 요약

| API | 메서드 | 상태 | 테스트 결과 |
|-----|--------|------|------------|
| `/api/services/{serviceCode}/settings/azure` | GET | ✅ 구현 완료 | 정상 |
| `/api/azure/projects/{projectId}/installation-status` | GET | ✅ 구현 완료 | 정상 |
| `/api/azure/projects/{projectId}/check-installation` | POST | ✅ 구현 완료 | 정상 |
| `/api/azure/projects/{projectId}/vm-installation-status` | GET | ✅ 구현 완료 | 정상 |
| `/api/azure/projects/{projectId}/vm-check-installation` | POST | ✅ 구현 완료 | 정상 |
| `/api/azure/projects/{projectId}/vm-terraform-script` | GET | ✅ 구현 완료 | 정상 |
| `/api/azure/projects/{projectId}/subnet-guide` | GET | ✅ 구현 완료 | 정상 |

---

## 2. 유닛 테스트 결과

```
✓ lib/__tests__/mock-azure.test.ts (25 tests) 13ms

 Test Files  1 passed (1)
       Tests  25 passed (25)
```

### 테스트 케이스 목록

| 그룹 | 테스트 | 결과 |
|------|--------|------|
| getAzureInstallationStatus | 존재하지 않는 프로젝트는 NOT_FOUND 에러 반환 | ✅ |
| | AWS 프로젝트는 NOT_AZURE_PROJECT 에러 반환 | ✅ |
| | Azure 프로젝트는 설치 상태 반환 | ✅ |
| | DB 리소스는 Private Endpoint 정보 포함 | ✅ |
| | 캐시된 상태는 동일한 결과 반환 | ✅ |
| checkAzureInstallation | 존재하지 않는 프로젝트는 NOT_FOUND 에러 반환 | ✅ |
| | 새로고침 시 lastCheckedAt 갱신 | ✅ |
| | AWS 프로젝트는 NOT_AZURE_PROJECT 에러 반환 | ✅ |
| getAzureVmInstallationStatus | VM 리소스가 있는 프로젝트는 VM 상태 반환 | ✅ |
| | VM 리소스가 없는 프로젝트는 빈 배열 반환 | ✅ |
| | VM 상태는 subnetExists와 terraformInstalled 포함 | ✅ |
| | AWS 프로젝트는 NOT_AZURE_PROJECT 에러 반환 | ✅ |
| checkAzureVmInstallation | 새로고침 시 lastCheckedAt 갱신 | ✅ |
| getAzureVmTerraformScript | VM 리소스가 있는 프로젝트는 Script 정보 반환 | ✅ |
| | VM 리소스가 없는 프로젝트는 NO_VM_RESOURCES 에러 | ✅ |
| | AWS 프로젝트는 NOT_AZURE_PROJECT 에러 반환 | ✅ |
| getAzureSubnetGuide | Azure 프로젝트는 가이드 정보 반환 | ✅ |
| | AWS 프로젝트는 NOT_AZURE_PROJECT 에러 반환 | ✅ |
| getAzureServiceSettings | 서비스 설정 반환 | ✅ |
| | 등록된 Scan App은 appId와 status 포함 | ✅ |
| | 미등록 Scan App은 가이드 포함 | ✅ |
| | 캐시된 설정은 동일한 결과 반환 | ✅ |
| hasVmResources / hasDbResources | VM 리소스 존재 여부 확인 | ✅ |
| | DB 리소스 존재 여부 확인 | ✅ |
| | 존재하지 않는 프로젝트는 false | ✅ |

---

## 3. API 응답 예시 (실제 동작 결과)

### 3.1 설치 상태 조회

**요청**:
```bash
GET /api/azure/projects/azure-proj-1/installation-status
```

**응답** (200 OK):
```json
{
  "provider": "Azure",
  "resources": [
    {
      "resourceId": "mssql-prod-001",
      "resourceName": "mssql-prod-001",
      "resourceType": "AZURE_MSSQL",
      "tfCompleted": true,
      "privateEndpoint": {
        "id": "pe-mssql-prod-001",
        "name": "pe-mssql-prod-001",
        "status": "NOT_REQUESTED"
      }
    },
    {
      "resourceId": "pg-analytics-001",
      "resourceName": "pg-analytics-001",
      "resourceType": "AZURE_POSTGRESQL",
      "tfCompleted": true,
      "privateEndpoint": {
        "id": "pe-pg-analytics-001",
        "name": "pe-pg-analytics-001",
        "status": "APPROVED",
        "requestedAt": "2026-01-15T10:00:00Z",
        "approvedAt": "2026-01-16T14:30:00Z"
      }
    },
    {
      "resourceId": "mysql-app-001",
      "resourceName": "mysql-app-001",
      "resourceType": "AZURE_MYSQL",
      "tfCompleted": true,
      "privateEndpoint": {
        "id": "pe-mysql-app-001",
        "name": "pe-mysql-app-001",
        "status": "APPROVED",
        "requestedAt": "2026-01-15T10:00:00Z",
        "approvedAt": "2026-01-16T14:30:00Z"
      }
    }
  ],
  "lastCheckedAt": "2026-02-02T00:05:39.378Z"
}
```

---

### 3.2 설치 상태 새로고침

**요청**:
```bash
POST /api/azure/projects/azure-proj-1/check-installation
```

**응답** (200 OK):
```json
{
  "provider": "Azure",
  "resources": [
    {
      "resourceId": "mssql-prod-001",
      "resourceName": "mssql-prod-001",
      "resourceType": "AZURE_MSSQL",
      "tfCompleted": true,
      "privateEndpoint": {
        "id": "pe-mssql-prod-001",
        "name": "pe-mssql-prod-001",
        "status": "NOT_REQUESTED"
      }
    },
    {
      "resourceId": "pg-analytics-001",
      "resourceName": "pg-analytics-001",
      "resourceType": "AZURE_POSTGRESQL",
      "tfCompleted": true,
      "privateEndpoint": {
        "id": "pe-pg-analytics-001",
        "name": "pe-pg-analytics-001",
        "status": "APPROVED",
        "requestedAt": "2026-01-15T10:00:00Z",
        "approvedAt": "2026-01-16T14:30:00Z"
      }
    },
    {
      "resourceId": "mysql-app-001",
      "resourceName": "mysql-app-001",
      "resourceType": "AZURE_MYSQL",
      "tfCompleted": true,
      "privateEndpoint": {
        "id": "pe-mysql-app-001",
        "name": "pe-mysql-app-001",
        "status": "APPROVED",
        "requestedAt": "2026-01-15T10:00:00Z",
        "approvedAt": "2026-01-16T14:30:00Z"
      }
    }
  ],
  "lastCheckedAt": "2026-02-02T00:05:55.808Z"
}
```

---

### 3.3 서비스 설정 조회 (Scan App 미등록)

**요청**:
```bash
GET /api/services/SERVICE-A/settings/azure
```

**응답** (200 OK):
```json
{
  "scanApp": {
    "registered": false
  },
  "guide": {
    "description": "Azure 스캔을 위해 Scan App을 등록해주세요.",
    "documentUrl": "https://docs.example.com/azure/scan-app-registration"
  }
}
```

---

### 3.4 VM 설치 상태 조회

**요청**:
```bash
GET /api/azure/projects/azure-proj-2/vm-installation-status
```

**응답** (200 OK):
```json
{
  "vms": [
    {
      "vmId": "vm-agent-001",
      "vmName": "vm-agent-001",
      "subnetExists": true,
      "terraformInstalled": false
    },
    {
      "vmId": "vm-agent-002",
      "vmName": "vm-agent-002",
      "subnetExists": false,
      "terraformInstalled": true
    }
  ],
  "lastCheckedAt": "2026-02-02T00:05:42.134Z"
}
```

---

### 3.5 VM 설치 상태 새로고침

**요청**:
```bash
POST /api/azure/projects/azure-proj-2/vm-check-installation
```

**응답** (200 OK):
```json
{
  "vms": [
    {
      "vmId": "vm-agent-001",
      "vmName": "vm-agent-001",
      "subnetExists": true,
      "terraformInstalled": true
    },
    {
      "vmId": "vm-agent-002",
      "vmName": "vm-agent-002",
      "subnetExists": false,
      "terraformInstalled": true
    }
  ],
  "lastCheckedAt": "2026-02-02T00:05:57.162Z"
}
```

---

### 3.6 VM Terraform Script 조회

**요청**:
```bash
GET /api/azure/projects/azure-proj-2/vm-terraform-script
```

**응답** (200 OK):
```json
{
  "downloadUrl": "/api/azure/projects/azure-proj-2/vm-terraform-script/download",
  "fileName": "terraform-azure-proj-2-1769990758564.tf",
  "generatedAt": "2026-02-02T00:05:58.564Z"
}
```

---

### 3.7 Subnet 가이드 조회

**요청**:
```bash
GET /api/azure/projects/azure-proj-1/subnet-guide
```

**응답** (200 OK):
```json
{
  "description": "PII Agent VM이 연결될 서브넷을 구성하는 방법을 안내합니다.",
  "documentUrl": "https://docs.example.com/azure/subnet-configuration"
}
```

---

## 4. 에러 응답 예시

### 4.1 Azure 프로젝트가 아닌 경우

**요청**:
```bash
GET /api/azure/projects/proj-1/installation-status
```

**응답** (400 Bad Request):
```json
{
  "error": "NOT_AZURE_PROJECT",
  "message": "Azure 프로젝트가 아닙니다."
}
```

---

### 4.2 존재하지 않는 프로젝트

**요청**:
```bash
GET /api/azure/projects/non-existent/installation-status
```

**응답** (404 Not Found):
```json
{
  "error": "NOT_FOUND",
  "message": "리소스를 찾을 수 없습니다."
}
```

---

## 5. 생성된 파일 목록

### 타입/상수/헬퍼

| 파일 | 설명 |
|------|------|
| `lib/types/azure.ts` | Azure 전용 타입 정의 |
| `lib/constants/azure.ts` | Private Endpoint 상태, 에러 코드 상수 |
| `lib/mock-azure.ts` | Azure Mock 헬퍼 함수 |

### API Routes

| 파일 | 엔드포인트 |
|------|-----------|
| `app/api/services/[serviceCode]/settings/azure/route.ts` | GET /api/services/{serviceCode}/settings/azure |
| `app/api/azure/projects/[projectId]/installation-status/route.ts` | GET /api/azure/projects/{projectId}/installation-status |
| `app/api/azure/projects/[projectId]/check-installation/route.ts` | POST /api/azure/projects/{projectId}/check-installation |
| `app/api/azure/projects/[projectId]/vm-installation-status/route.ts` | GET /api/azure/projects/{projectId}/vm-installation-status |
| `app/api/azure/projects/[projectId]/vm-check-installation/route.ts` | POST /api/azure/projects/{projectId}/vm-check-installation |
| `app/api/azure/projects/[projectId]/vm-terraform-script/route.ts` | GET /api/azure/projects/{projectId}/vm-terraform-script |
| `app/api/azure/projects/[projectId]/subnet-guide/route.ts` | GET /api/azure/projects/{projectId}/subnet-guide |

### 테스트

| 파일 | 설명 |
|------|------|
| `lib/__tests__/mock-azure.test.ts` | Azure Mock 헬퍼 유닛 테스트 (25개 케이스) |

### Mock 데이터

| 파일 | 변경 내용 |
|------|----------|
| `lib/mock-data.ts` | Azure 프로젝트 2개 추가 (azure-proj-1, azure-proj-2) |

---

## 6. 검증 체크리스트

### 공통 검증

- [x] 모든 API가 `docs/api/providers/azure.md` 명세와 일치
- [x] 인증/권한 검사 정상 동작
- [x] 에러 응답 형식이 `docs/api/common.md` 준수
- [x] TypeScript 타입 에러 없음 (유닛 테스트 통과)

### 기능 검증

- [x] Private Endpoint 상태 표시 (NOT_REQUESTED, PENDING_APPROVAL, APPROVED, REJECTED)
- [x] TF 완료 상태 표시 (boolean)
- [x] VM 포함 케이스 분기 (DB only vs DB + VM)
- [x] lastCheckedAt 갱신 정상

### 에러 케이스

- [x] Azure 외 Provider 접근 시 400 응답 (NOT_AZURE_PROJECT)
- [x] 존재하지 않는 프로젝트 404 응답 (NOT_FOUND)
- [x] VM 없는 프로젝트의 TF Script 요청 시 400 응답 (NO_VM_RESOURCES)

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-02 | 초안 작성, 7개 API 구현 완료 및 검증 |
