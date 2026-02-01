# Azure BFF API 구현 계획

> Azure Provider API의 Next.js API Routes 구현 계획 및 검증 전략

---

## 1. 개요

### 구현 대상

| # | 엔드포인트 | 메서드 | 설명 | 우선순위 |
|---|-----------|--------|------|----------|
| 1 | `/api/services/{serviceCode}/settings/azure` | GET | Scan App 등록 상태 | P1 |
| 2 | `/api/azure/projects/{projectId}/installation-status` | GET | 리소스별 TF + Private Endpoint 상태 | P1 |
| 3 | `/api/azure/projects/{projectId}/check-installation` | POST | 설치 상태 새로고침 | P1 |
| 4 | `/api/azure/projects/{projectId}/vm-installation-status` | GET | VM별 Subnet + TF 상태 | P2 |
| 5 | `/api/azure/projects/{projectId}/vm-check-installation` | POST | VM 설치 상태 새로고침 | P2 |
| 6 | `/api/azure/projects/{projectId}/vm-terraform-script` | GET | TF Script 다운로드 | P3 |
| 7 | `/api/azure/projects/{projectId}/subnet-guide` | GET | Subnet 가이드 조회 | P3 |

### 구현 원칙

1. **기존 패턴 준수**: `app/api/v2/projects/[projectId]/scan/` 구현 패턴 따름
2. **Mock 데이터 분리**: `lib/mock-azure.ts`에 헬퍼 함수 구현
3. **타입 안전성**: 모든 API 응답은 `docs/api/providers/azure.md` 명세 준수
4. **테스트 필수**: 각 API별 유닛 테스트 작성

---

## 2. 파일 구조

```
app/api/
├── v2/
│   └── projects/[projectId]/scan/  # 기존 (참고용)
├── azure/
│   └── projects/[projectId]/
│       ├── installation-status/route.ts
│       ├── check-installation/route.ts
│       ├── vm-installation-status/route.ts
│       ├── vm-check-installation/route.ts
│       ├── vm-terraform-script/route.ts
│       └── subnet-guide/route.ts
└── services/[serviceCode]/settings/
    └── azure/route.ts

lib/
├── mock-azure.ts              # Azure 전용 헬퍼 함수
├── constants/azure.ts         # Azure 상수 (PrivateEndpointStatus 등)
├── types/azure.ts             # Azure 전용 타입
└── __tests__/
    └── mock-azure.test.ts     # 유닛 테스트
```

---

## 3. 단계별 구현 계획

### Phase 1: 기반 작업 (타입 + 상수 + Mock 데이터)

#### 3.1.1 타입 정의 (`lib/types/azure.ts`)

```typescript
// Private Endpoint 상태
export type PrivateEndpointStatus =
  | 'NOT_REQUESTED'      // BDC측 확인 필요
  | 'PENDING_APPROVAL'   // 승인 대기
  | 'APPROVED'           // 승인 완료
  | 'REJECTED';          // 거부됨

// 설치 상태 응답
export interface AzureInstallationStatus {
  provider: 'azure';
  resources: AzureResourceStatus[];
  lastCheckedAt?: string;
  error?: { code: string; message: string };
}

export interface AzureResourceStatus {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  tfCompleted: boolean;
  privateEndpoint?: {
    id: string;
    name: string;
    status: PrivateEndpointStatus;
    requestedAt?: string;
    approvedAt?: string;
    rejectedAt?: string;
  };
}

// VM 설치 상태
export interface AzureVmInstallationStatus {
  vms: AzureVmStatus[];
  lastCheckedAt?: string;
  error?: { code: string; message: string };
}

export interface AzureVmStatus {
  vmId: string;
  vmName: string;
  subnetExists: boolean;
  terraformInstalled: boolean;
}

// 서비스 설정
export interface AzureServiceSettings {
  scanApp: {
    registered: boolean;
    appId?: string;
    lastVerifiedAt?: string;
    status?: 'VALID' | 'INVALID' | 'NOT_VERIFIED';
  };
  guide?: {
    description: string;
    documentUrl?: string;
  };
}
```

#### 3.1.2 상수 정의 (`lib/constants/azure.ts`)

```typescript
export const PRIVATE_ENDPOINT_STATUS_LABELS = {
  NOT_REQUESTED: 'BDC측 확인 필요',
  PENDING_APPROVAL: 'Azure Portal에서 승인 필요',
  APPROVED: '승인 완료',
  REJECTED: 'BDC측 재신청 필요',
} as const;

export const AZURE_ERROR_CODES = {
  VALIDATION_FAILED: { message: '검증에 실패했습니다.', status: 400 },
  ACCESS_DENIED: { message: '접근 권한이 없습니다.', status: 403 },
  NOT_AZURE_PROJECT: { message: 'Azure 프로젝트가 아닙니다.', status: 400 },
} as const;
```

#### 3.1.3 Mock 헬퍼 (`lib/mock-azure.ts`)

```typescript
// 구현 항목:
// - getAzureInstallationStatus(projectId): AzureInstallationStatus
// - checkAzureInstallation(projectId): AzureInstallationStatus
// - getAzureVmInstallationStatus(projectId): AzureVmInstallationStatus
// - checkAzureVmInstallation(projectId): AzureVmInstallationStatus
// - getVmTerraformScript(projectId): { downloadUrl, fileName }
// - getSubnetGuide(projectId): { description, documentUrl }
// - getAzureServiceSettings(serviceCode): AzureServiceSettings
```

---

### Phase 2: P1 API 구현 (서비스 설정 + 설치 상태)

#### 3.2.1 서비스 설정 API

**파일**: `app/api/services/[serviceCode]/settings/azure/route.ts`

```typescript
// GET /api/services/{serviceCode}/settings/azure
// 인증 → 서비스 존재 확인 → 설정 조회
```

**검증 케이스**:
- [ ] 정상: Scan App 등록됨, VALID 상태
- [ ] 정상: Scan App 미등록, 가이드 포함
- [ ] 에러: 서비스 없음 (404)
- [ ] 에러: 권한 없음 (403)

#### 3.2.2 설치 상태 조회 API

**파일**: `app/api/azure/projects/[projectId]/installation-status/route.ts`

```typescript
// GET /api/azure/projects/{projectId}/installation-status
// 인증 → 프로젝트 확인 → Azure 여부 확인 → 상태 조회
```

**검증 케이스**:
- [ ] 정상: 리소스 목록 + Private Endpoint 상태 반환
- [ ] 정상: Private Endpoint 없는 리소스 (AZURE_VM 등)
- [ ] 에러: Azure 프로젝트 아님 (400)
- [ ] 에러: 프로젝트 없음 (404)

#### 3.2.3 설치 상태 새로고침 API

**파일**: `app/api/azure/projects/[projectId]/check-installation/route.ts`

```typescript
// POST /api/azure/projects/{projectId}/check-installation
// 인증 → 프로젝트 확인 → Azure 여부 확인 → 상태 갱신 → 반환
```

**검증 케이스**:
- [ ] 정상: 상태 갱신 + lastCheckedAt 갱신
- [ ] 에러: 접근 권한 없음 (403)

---

### Phase 3: P2 API 구현 (VM 설치 상태)

#### 3.3.1 VM 설치 상태 조회

**파일**: `app/api/azure/projects/[projectId]/vm-installation-status/route.ts`

**검증 케이스**:
- [ ] 정상: VM 없는 프로젝트 (빈 배열)
- [ ] 정상: VM 있음, Subnet/TF 상태 다양
- [ ] 에러: Azure 프로젝트 아님

#### 3.3.2 VM 설치 상태 새로고침

**파일**: `app/api/azure/projects/[projectId]/vm-check-installation/route.ts`

**검증 케이스**:
- [ ] 정상: 상태 갱신 성공
- [ ] 에러: 검증 실패 (외부 API 에러 시뮬레이션)

---

### Phase 4: P3 API 구현 (TF Script + 가이드)

#### 3.4.1 VM TF Script 다운로드

**파일**: `app/api/azure/projects/[projectId]/vm-terraform-script/route.ts`

**검증 케이스**:
- [ ] 정상: downloadUrl + fileName 반환
- [ ] 에러: VM 없는 프로젝트

#### 3.4.2 Subnet 가이드 조회

**파일**: `app/api/azure/projects/[projectId]/subnet-guide/route.ts`

**검증 케이스**:
- [ ] 정상: description + documentUrl 반환

---

## 4. 검증 계획

### 4.1 유닛 테스트 (`lib/__tests__/mock-azure.test.ts`)

| 테스트 그룹 | 테스트 케이스 | 예상 개수 |
|------------|--------------|----------|
| 설치 상태 조회 | Azure 프로젝트 여부, 리소스 상태, Private Endpoint 상태 | 8개 |
| 설치 상태 갱신 | 상태 변경, 시간 갱신, 에러 처리 | 5개 |
| VM 설치 상태 | VM 포함/미포함, Subnet/TF 상태 조합 | 6개 |
| 서비스 설정 | 등록/미등록, 상태값 검증 | 4개 |
| TF Script/가이드 | 다운로드 URL, 가이드 내용 | 3개 |
| **총계** | | **~26개** |

### 4.2 API 통합 테스트 (수동)

```bash
# 1. 서비스 설정 조회
curl http://localhost:3000/api/services/SVC001/settings/azure

# 2. 설치 상태 조회
curl http://localhost:3000/api/azure/projects/PRJ001/installation-status

# 3. 설치 상태 새로고침
curl -X POST http://localhost:3000/api/azure/projects/PRJ001/check-installation

# 4. VM 설치 상태
curl http://localhost:3000/api/azure/projects/PRJ002/vm-installation-status

# 5. TF Script 다운로드
curl http://localhost:3000/api/azure/projects/PRJ002/vm-terraform-script

# 6. Subnet 가이드
curl http://localhost:3000/api/azure/projects/PRJ002/subnet-guide
```

### 4.3 검증 체크리스트

**공통 검증**:
- [ ] 모든 API가 `docs/api/providers/azure.md` 명세와 일치
- [ ] 인증/권한 검사 정상 동작
- [ ] 에러 응답 형식이 `docs/api/common.md` 준수
- [ ] TypeScript 타입 에러 없음

**기능 검증**:
- [ ] Private Endpoint 상태 전이 로직 (NOT_REQUESTED → PENDING → APPROVED/REJECTED)
- [ ] TF 완료 상태 표시 (boolean)
- [ ] VM 포함 케이스 분기 (Case 1 vs Case 2)
- [ ] lastCheckedAt 갱신 정상

**에러 케이스**:
- [ ] Azure 외 Provider 접근 시 400 응답
- [ ] 권한 없는 서비스 접근 시 403 응답
- [ ] 존재하지 않는 프로젝트 404 응답

---

## 5. 일정 (예상)

| 단계 | 작업 내용 | 예상 산출물 |
|------|----------|------------|
| Phase 1 | 타입/상수/Mock 기반 | 3개 파일 |
| Phase 2 | P1 API 3개 | 3개 route.ts |
| Phase 3 | P2 API 2개 | 2개 route.ts |
| Phase 4 | P3 API 2개 | 2개 route.ts |
| 테스트 | 유닛 테스트 | 1개 test.ts (~26개 케이스) |

---

## 6. 의존성

### 기존 코드 활용

- `lib/mock-data.ts`: `getProjectById`, `getCurrentUser`
- `lib/mock-store.ts`: 상태 저장소 (필요시)
- `lib/constants/scan.ts`: 에러 코드 패턴 참고

### 신규 생성

- `lib/types/azure.ts`: Azure 전용 타입
- `lib/constants/azure.ts`: Azure 상수
- `lib/mock-azure.ts`: Azure Mock 헬퍼

---

## 7. 위험 요소 및 대응

| 위험 | 영향 | 대응 |
|------|-----|------|
| Private Endpoint 상태 전이 로직 복잡 | 버그 발생 | 상태 머신 테스트 강화 |
| VM 포함 여부 판단 오류 | 잘못된 UI 표시 | 리소스 타입 검사 명확화 |
| Mock 데이터 불일치 | API 응답 오류 | BFF 명세 기준 검증 |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-01 | 초안 작성 |
