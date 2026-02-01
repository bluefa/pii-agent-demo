# Azure BFF API 구현 계획

> Azure Provider 전용 API Routes 구현 계획 및 검증 방안

---

## 1. 개요

### 1.1 배경
- BFF API 명세: `docs/api/providers/azure.md`
- 현재 상태: Azure 전용 API Routes 미구현
- 목표: BFF API 명세에 따른 Next.js API Routes 구현

### 1.2 Azure 케이스 분류

| 케이스 | VM 포함 | 특이사항 |
|--------|---------|----------|
| Case 1 | X | TF 자동 설치 + PE 승인 필요 |
| Case 2 | O | DB 자동 + VM 수동 TF + Subnet 필요 |

---

## 2. 구현 대상 API

### 2.1 설치 상태 API

| API | Method | Endpoint | 우선순위 |
|-----|--------|----------|----------|
| 설치 상태 조회 | GET | `/api/projects/{projectId}/installation-status` | P0 |

**응답 타입**:
```typescript
interface AzureInstallationStatus {
  provider: 'Azure';
  serviceTfCompleted: boolean;  // TfStatus → boolean 변경됨
  privateEndpointsPending: number;

  // VM 통합 활성화 시
  vmTfScriptDownloaded?: boolean;
  vmInstalled?: boolean;
}
```

### 2.2 Private Endpoint API

| API | Method | Endpoint | 우선순위 |
|-----|--------|----------|----------|
| PE 상태 목록 조회 | GET | `/api/projects/{projectId}/private-endpoints` | P0 |
| PE 승인 완료 확인 | POST | `/api/projects/{projectId}/private-endpoints/{resourceId}/confirm` | P1 |

**PE 상태 타입**:
```typescript
interface PrivateEndpoint {
  resourceId: string;
  resourceName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  approvedAt?: string;
}
```

### 2.3 VM Terraform API

| API | Method | Endpoint | 우선순위 |
|-----|--------|----------|----------|
| TF Script 다운로드 | GET | `/api/projects/{projectId}/vm-terraform-script` | P1 |
| VM 설치 상태 확인 | GET | `/api/projects/{projectId}/vm-installation-status` | P1 |

### 2.4 Subnet API

| API | Method | Endpoint | 우선순위 |
|-----|--------|----------|----------|
| Subnet 가이드 조회 | GET | `/api/projects/{projectId}/subnet-guide` | P2 |

### 2.5 서비스 설정 API

| API | Method | Endpoint | 우선순위 |
|-----|--------|----------|----------|
| Azure 설정 조회 | GET | `/api/services/{serviceCode}/settings/azure` | P1 |
| Azure 설정 수정 | PUT | `/api/services/{serviceCode}/settings/azure` | P2 |

---

## 3. 구현 순서 (Phase)

### Phase 1: 핵심 설치 상태 (P0)

**목표**: 프로젝트 상세 페이지에서 Azure 설치 상태 표시

1. **설치 상태 조회 API**
   - 파일: `app/api/projects/[projectId]/installation-status/route.ts`
   - Provider별 분기 처리 (Azure 우선)
   - TfStatus를 boolean으로 단순화 (common.md 참조)

2. **PE 상태 목록 조회 API**
   - 파일: `app/api/projects/[projectId]/private-endpoints/route.ts`
   - 리소스별 PE 승인 상태 반환

**검증 항목**:
- [ ] Azure 프로젝트에서 설치 상태 조회 정상 동작
- [ ] PE 상태 목록 정확히 반환
- [ ] 비-Azure 프로젝트 요청 시 적절한 에러 응답

### Phase 2: PE 승인 및 VM (P1)

**목표**: PE 승인 워크플로우 및 VM 설치 지원

3. **PE 승인 완료 확인 API**
   - 파일: `app/api/projects/[projectId]/private-endpoints/[resourceId]/confirm/route.ts`
   - Azure Portal에서 승인 후 호출
   - 상태 PENDING → APPROVED 전이

4. **VM TF Script 다운로드 API**
   - 파일: `app/api/projects/[projectId]/vm-terraform-script/route.ts`
   - 다운로드 URL + 만료시간 반환

5. **VM 설치 상태 확인 API**
   - 파일: `app/api/projects/[projectId]/vm-installation-status/route.ts`
   - 시스템 폴링용

6. **Azure 설정 조회 API**
   - 파일: `app/api/services/[serviceCode]/settings/azure/route.ts`
   - scanAppRegistered, vmIntegrationEnabled, subnetInfo

**검증 항목**:
- [ ] PE 승인 확인 후 상태 변경 확인
- [ ] VM TF 스크립트 다운로드 URL 유효성
- [ ] VM 설치 상태 정확성
- [ ] 서비스 설정 조회 정상 동작

### Phase 3: 부가 기능 (P2)

**목표**: Subnet 가이드 및 설정 관리

7. **Subnet 가이드 조회 API**
   - 파일: `app/api/projects/[projectId]/subnet-guide/route.ts`
   - VNet, 리전, 주소 범위 정보

8. **Azure 설정 수정 API**
   - 파일: `app/api/services/[serviceCode]/settings/azure/route.ts` (PUT)
   - 설정 변경 + 검증

**검증 항목**:
- [ ] Subnet 가이드 정보 정확성
- [ ] 설정 수정 후 조회 결과 일치

---

## 4. 파일 구조

```
app/api/
├── projects/[projectId]/
│   ├── installation-status/
│   │   └── route.ts              # GET - 설치 상태 조회
│   ├── private-endpoints/
│   │   ├── route.ts              # GET - PE 목록 조회
│   │   └── [resourceId]/
│   │       └── confirm/
│   │           └── route.ts      # POST - PE 승인 확인
│   ├── vm-terraform-script/
│   │   └── route.ts              # GET - VM TF 스크립트 다운로드
│   ├── vm-installation-status/
│   │   └── route.ts              # GET - VM 설치 상태
│   └── subnet-guide/
│       └── route.ts              # GET - Subnet 가이드
└── services/[serviceCode]/
    └── settings/
        └── azure/
            └── route.ts          # GET, PUT - Azure 설정
```

---

## 5. 데이터 모델 (lib 계층)

### 5.1 신규 파일

```
lib/
├── azure/
│   ├── types.ts                  # Azure 전용 타입
│   ├── installation-status.ts    # 설치 상태 헬퍼
│   ├── private-endpoints.ts      # PE 상태 관리
│   └── vm-terraform.ts           # VM TF 관련
├── data/
│   └── azure-settings.ts         # Azure 설정 저장소
```

### 5.2 타입 정의 (`lib/azure/types.ts`)

```typescript
// Azure 설치 상태
export interface AzureInstallationStatus {
  provider: 'Azure';
  serviceTfCompleted: boolean;
  privateEndpointsPending: number;
  vmTfScriptDownloaded?: boolean;
  vmInstalled?: boolean;
}

// Private Endpoint
export interface PrivateEndpoint {
  resourceId: string;
  resourceName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  approvedAt?: string;
}

// VM TF Script
export interface VmTerraformScript {
  downloadUrl: string;
  fileName: string;
  expiresAt: string;
}

// VM 설치 상태
export interface VmInstallationStatus {
  installed: boolean;
  lastCheckedAt: string;
  vmResources: Array<{
    resourceId: string;
    installed: boolean;
  }>;
}

// Subnet 가이드
export interface SubnetGuide {
  instructions: string;
  requirements: {
    vnetId: string;
    region: string;
    addressPrefix: string;
  };
}

// Azure 서비스 설정
export interface AzureServiceSettings {
  scanAppRegistered: boolean;
  vmIntegrationEnabled: boolean;
  subnetInfo?: {
    id: string;
    name: string;
  };
}
```

---

## 6. 검증 계획

### 6.1 단위 테스트

| 테스트 파일 | 대상 | 테스트 항목 |
|-------------|------|-------------|
| `lib/__tests__/azure-installation.test.ts` | 설치 상태 | 상태 계산 로직, Provider 분기 |
| `lib/__tests__/azure-private-endpoints.test.ts` | PE 관리 | CRUD, 상태 전이 |
| `lib/__tests__/azure-vm-terraform.test.ts` | VM TF | URL 생성, 만료 처리 |

### 6.2 API 테스트 (수동/자동)

#### Phase 1 검증

```bash
# 설치 상태 조회
curl -X GET http://localhost:3000/api/projects/{azureProjectId}/installation-status

# 예상 응답
{
  "provider": "Azure",
  "serviceTfCompleted": false,
  "privateEndpointsPending": 3
}

# PE 목록 조회
curl -X GET http://localhost:3000/api/projects/{azureProjectId}/private-endpoints

# 예상 응답
{
  "endpoints": [
    {
      "resourceId": "res-001",
      "resourceName": "sql-server-prod",
      "status": "PENDING",
      "requestedAt": "2026-01-30T10:00:00Z"
    }
  ]
}
```

#### Phase 2 검증

```bash
# PE 승인 확인
curl -X POST http://localhost:3000/api/projects/{projectId}/private-endpoints/{resourceId}/confirm

# VM TF 스크립트 다운로드
curl -X GET http://localhost:3000/api/projects/{projectId}/vm-terraform-script

# VM 설치 상태
curl -X GET http://localhost:3000/api/projects/{projectId}/vm-installation-status

# Azure 설정 조회
curl -X GET http://localhost:3000/api/services/{serviceCode}/settings/azure
```

### 6.3 통합 테스트 시나리오

#### 시나리오 1: Case 1 (VM 없음)

```
1. Azure 프로젝트 생성 → 스캔 완료
2. 리소스 확정 → 승인
3. GET /installation-status → serviceTfCompleted: false, privateEndpointsPending: N
4. (시스템) TF 설치 완료
5. GET /installation-status → serviceTfCompleted: true, privateEndpointsPending: N
6. GET /private-endpoints → 각 리소스 PENDING
7. (사용자) Azure Portal에서 PE 승인
8. POST /private-endpoints/{id}/confirm
9. GET /private-endpoints → 해당 리소스 APPROVED
10. 모든 PE 승인 완료 → 연결 테스트 가능
```

#### 시나리오 2: Case 2 (VM 포함)

```
1~3. Case 1과 동일
4. GET /vm-terraform-script → 스크립트 다운로드 URL
5. (사용자) 스크립트 실행
6. GET /vm-installation-status → installed: false
7. (시스템) 주기적 폴링
8. GET /vm-installation-status → installed: true
9. GET /subnet-guide → Subnet 구성 정보
10. 모든 설치 완료 → 연결 테스트 가능
```

### 6.4 에러 케이스 검증

| 케이스 | 요청 | 예상 응답 |
|--------|------|-----------|
| 비-Azure 프로젝트 | GET /installation-status | 400: Provider별 API 분기 또는 다른 Provider 응답 |
| 존재하지 않는 프로젝트 | GET /installation-status | 404: NOT_FOUND |
| 존재하지 않는 PE | POST /private-endpoints/{id}/confirm | 404: NOT_FOUND |
| 이미 승인된 PE | POST /private-endpoints/{id}/confirm | 400: ALREADY_APPROVED |
| 권한 없는 서비스 | GET /services/{code}/settings/azure | 403: FORBIDDEN |

---

## 7. 의존성

### 7.1 기존 코드 활용

| 모듈 | 용도 |
|------|------|
| `lib/mock-data.ts` | 프로젝트/리소스 데이터 |
| `lib/api.ts` | API 호출 함수 (프론트엔드) |
| `types/` | 공통 타입 정의 |

### 7.2 신규 추가 필요

| 모듈 | 용도 |
|------|------|
| `lib/azure/` | Azure 전용 로직 |
| `lib/data/azure-*.ts` | Azure 상태 저장소 |

---

## 8. 일정 추정

| Phase | 작업 | 예상 일수 |
|-------|------|-----------|
| Phase 1 | 설치 상태 + PE 목록 | 1일 |
| Phase 2 | PE 확인 + VM + 설정 | 2일 |
| Phase 3 | Subnet + 설정 수정 | 1일 |
| 검증 | 테스트 + 버그 수정 | 1일 |
| **총계** | | **5일** |

---

## 9. 리스크 및 고려사항

### 9.1 비동기 작업

- PE 승인: Azure Portal에서 수동 승인 → 확인 API 호출 방식
- VM 설치: 시스템 폴링으로 상태 확인
- 폴링 주기/타임아웃 정책 필요

### 9.2 Provider 분기

- `/installation-status` API는 Provider 공통이지만 응답 구조가 다름
- 타입 안전성을 위해 Discriminated Union 활용

### 9.3 상태 일관성

- PE 상태와 리소스 상태 동기화 필요
- 트랜잭션 처리 또는 Eventually Consistent 허용

---

## 10. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-01 | 초안 작성 |
