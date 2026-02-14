# API Routes (Next.js)

Next.js App Router의 API Route Handlers 문서.

> **참고**: 이 API는 BFF API 명세(`docs/api/`)를 기반으로 구현되었습니다.

## 아키텍처 (ADR-007)

route.ts는 thin dispatcher로, `client.method()` 호출만 수행합니다.
`client`는 환경변수에 따라 mockClient 또는 bffClient를 선택합니다.

```
route.ts → client.projects.get(projectId)
                    ↓ (USE_MOCK_DATA)
              mockClient          bffClient
           (mock 로직)          (BFF 프록시)
```

```typescript
// app/api/projects/[projectId]/route.ts
import { client } from '@/lib/api-client';

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) => {
  const { projectId } = await params;
  return client.projects.get(projectId);
};
```

## 엔드포인트 목록

### 프로젝트

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/projects` | 프로젝트 생성 |
| GET | `/api/projects/[projectId]` | 프로젝트 상세 조회 |
| DELETE | `/api/projects/[projectId]` | 프로젝트 삭제 |
| POST | `/api/projects/[projectId]/approve` | 승인 |
| POST | `/api/projects/[projectId]/reject` | 반려 |
| POST | `/api/projects/[projectId]/confirm-targets` | 연동 대상 확정 |
| POST | `/api/projects/[projectId]/complete-installation` | 설치 완료 |
| POST | `/api/projects/[projectId]/test-connection` | 연결 테스트 |
| POST | `/api/projects/[projectId]/confirm-completion` | 완료 확정 |
| POST | `/api/projects/[projectId]/confirm-pii-agent` | PII Agent 확인 |
| GET | `/api/projects/[projectId]/credentials` | 인증정보 목록 |
| GET | `/api/projects/[projectId]/history` | 프로젝트 변경 이력 |
| GET | `/api/projects/[projectId]/terraform-status` | Terraform 상태 |
| POST | `/api/projects/[projectId]/scan` | 리소스 스캔 (v1) |

### 리소스

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/projects/[projectId]/resources` | 리소스 목록 조회 |
| PATCH | `/api/projects/[projectId]/resources/credential` | 리소스 인증정보 변경 |
| GET | `/api/projects/[projectId]/resources/exclusions` | 연동 제외 리소스 조회 |

### 스캔 (v2)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/v2/projects/[projectId]/scan` | 스캔 시작 |
| GET | `/api/v2/projects/[projectId]/scan/status` | 스캔 상태 조회 |
| GET | `/api/v2/projects/[projectId]/scan/[scanId]` | 특정 스캔 결과 조회 |
| GET | `/api/v2/projects/[projectId]/scan/history` | 스캔 이력 조회 |

#### 스캔 상태 응답 (`/scan/status`)

```typescript
{
  isScanning: boolean;        // 스캔 진행 중 여부
  canScan: boolean;           // 스캔 가능 여부
  canScanReason?: string;     // 스캔 불가 사유
  cooldownUntil?: string;     // 쿨다운 종료 시간 (ISO 8601)
  currentScan: {              // 진행 중인 스캔 (없으면 null)
    scanId: string;
    status: 'PENDING' | 'IN_PROGRESS';
    startedAt: string;
    progress: number;         // 0-100
  } | null;
  lastCompletedScan: {        // 마지막 완료된 스캔 (없으면 null)
    scanId: string;
    completedAt: string;
    result: ScanResult | null;
  } | null;
}
```

#### 스캔 정책
- **쿨다운**: 스캔 완료 후 5분간 재스캔 불가
- **최대 리소스**: 프로젝트당 10개 제한
- **지원 Provider**: AWS, Azure, GCP (IDC, SDU 미지원)

### AWS

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/aws/verify-tf-role` | TF Role 검증 |
| POST | `/api/aws/projects/[projectId]/installation-mode` | 설치 모드 선택 (AUTO/MANUAL) |
| GET | `/api/aws/projects/[projectId]/installation-status` | 설치 상태 조회 |
| POST | `/api/aws/projects/[projectId]/check-installation` | 설치 상태 새로고침 |
| GET | `/api/aws/projects/[projectId]/terraform-script` | TF Script 다운로드 URL |

### Azure

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/azure/projects/[projectId]/installation-status` | DB 설치 상태 조회 |
| POST | `/api/azure/projects/[projectId]/check-installation` | DB 설치 상태 새로고침 |
| GET | `/api/azure/projects/[projectId]/subnet-guide` | Subnet 가이드 조회 |
| GET | `/api/azure/projects/[projectId]/vm-installation-status` | VM 설치 상태 조회 |
| POST | `/api/azure/projects/[projectId]/vm-check-installation` | VM 설치 상태 새로고침 |
| GET | `/api/azure/projects/[projectId]/vm-terraform-script` | VM TF Script 다운로드 정보 |

### GCP

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/gcp/projects/[projectId]/installation-status` | 설치 상태 조회 |
| POST | `/api/gcp/projects/[projectId]/check-installation` | 설치 상태 새로고침 |
| GET | `/api/gcp/projects/[projectId]/regional-managed-proxy` | Regional Managed Proxy 조회 |
| POST | `/api/gcp/projects/[projectId]/regional-managed-proxy` | Proxy Subnet 생성 |
| GET | `/api/gcp/projects/[projectId]/service-tf-resources` | Service TF 리소스 조회 |

### SDU

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/sdu/projects/[projectId]/check-installation` | 설치 상태 새로고침 |
| GET | `/api/sdu/projects/[projectId]/installation-status` | 설치 상태 조회 |
| GET | `/api/sdu/projects/[projectId]/athena-tables` | Athena 테이블 조회 |
| GET | `/api/sdu/projects/[projectId]/connection-test` | Connection Test 결과 조회 |
| POST | `/api/sdu/projects/[projectId]/connection-test/execute` | Connection Test 실행 |
| GET | `/api/sdu/projects/[projectId]/iam-user` | IAM User 조회 |
| POST | `/api/sdu/projects/[projectId]/iam-user/issue-aksk` | AK/SK 발급 |
| GET | `/api/sdu/projects/[projectId]/s3-upload` | S3 Upload 상태 조회 |
| POST | `/api/sdu/projects/[projectId]/s3-upload/check` | S3 Upload 확인 |
| GET | `/api/sdu/projects/[projectId]/source-ip` | Source IP 목록 조회 |
| POST | `/api/sdu/projects/[projectId]/source-ip/confirm` | Source IP 확인 |
| POST | `/api/sdu/projects/[projectId]/source-ip/register` | Source IP 등록 |

### IDC

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/idc/firewall/source-ip-recommendation` | Source IP 추천 조회 |
| GET | `/api/idc/projects/[projectId]/installation-status` | 설치 상태 조회 |
| POST | `/api/idc/projects/[projectId]/check-installation` | 설치 상태 새로고침 |
| POST | `/api/idc/projects/[projectId]/confirm-firewall` | 방화벽 오픈 확인 |
| POST | `/api/idc/projects/[projectId]/confirm-targets` | 연동 대상 확정 |
| GET | `/api/idc/projects/[projectId]/resources` | 리소스 목록 조회 |
| PUT | `/api/idc/projects/[projectId]/resources` | 리소스 수정 |
| POST | `/api/idc/projects/[projectId]/update-resources` | 리소스 목록 갱신 |

### 서비스/권한

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/services/[serviceCode]/projects` | 서비스별 프로젝트 목록 |
| GET | `/api/services/[serviceCode]/permissions` | 서비스 권한 목록 |
| POST | `/api/services/[serviceCode]/permissions` | 권한 추가 |
| DELETE | `/api/services/[serviceCode]/permissions/[userId]` | 권한 삭제 |

### 서비스 설정

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/services/[serviceCode]/settings/aws` | AWS 설정 조회 |
| PUT | `/api/services/[serviceCode]/settings/aws` | AWS 설정 수정 |
| POST | `/api/services/[serviceCode]/settings/aws/verify-scan-role` | Scan Role 재검증 |
| GET | `/api/services/[serviceCode]/settings/azure` | Azure 설정 조회 |
| GET | `/api/services/[serviceCode]/settings/gcp` | GCP 설정 조회 |
| GET | `/api/services/[serviceCode]/settings/idc` | IDC 설정 조회 |
| PUT | `/api/services/[serviceCode]/settings/idc` | IDC 설정 수정 |

### 사용자

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/user/me` | 현재 사용자 정보 |
| GET | `/api/user/services` | 사용자 서비스 목록 |
| GET | `/api/users/search` | 사용자 검색 |

### 개발용

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/dev/switch-user` | 전체 사용자 목록 |
| POST | `/api/dev/switch-user` | 사용자 전환 |

## 환경별 동작

| 환경 | `USE_MOCK_DATA` | API Client | 설명 |
|-----|----------------|------------|------|
| 개발 (dev) | `true` (기본) | `mockClient` | Mock 데이터 사용 |
| 운영 (prod) | `false` | `bffClient` | BFF API 프록시 |

```typescript
// lib/api-client/index.ts
const IS_MOCK = process.env.USE_MOCK_DATA !== 'false';
export const client: ApiClient = IS_MOCK ? mockClient : bffClient;
```

## 파일 구조

```
lib/api-client/
  index.ts              # client export (환경변수로 선택)
  types.ts              # ApiClient 인터페이스
  bff-client.ts         # BFF 프록시 (production)
  mock/
    index.ts            # mockClient 조립
    projects.ts         # 프로젝트 mock 로직
    users.ts            # 사용자 mock 로직
    sdu.ts              # SDU mock 로직
    aws.ts              # AWS mock 로직
    azure.ts            # Azure mock 로직
    gcp.ts              # GCP mock 로직
    idc.ts              # IDC mock 로직
    services.ts         # 서비스/설정 mock 로직
    dev.ts              # 개발용 mock 로직
    scan.ts             # 스캔 mock 로직
```
