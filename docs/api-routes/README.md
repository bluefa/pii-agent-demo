# API Routes (Next.js)

Next.js App Router의 API Route Handlers 문서.

> **참고**: 이 API는 BFF API 명세(`docs/api/`)를 기반으로 구현되었습니다.

## 엔드포인트 목록

### 프로젝트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/projects` | 프로젝트 목록 조회 |
| GET | `/api/projects/[projectId]` | 프로젝트 상세 조회 |
| POST | `/api/projects/[projectId]/confirm-targets` | 연동 대상 확정 |
| POST | `/api/projects/[projectId]/approve` | 승인 |
| POST | `/api/projects/[projectId]/reject` | 반려 |
| POST | `/api/projects/[projectId]/complete-installation` | 설치 완료 |
| POST | `/api/projects/[projectId]/test-connection` | 연결 테스트 |
| POST | `/api/projects/[projectId]/confirm-completion` | 완료 확정 |

### 리소스

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/projects/[projectId]/resources` | 리소스 목록 조회 |
| PATCH | `/api/projects/[projectId]/resources` | 리소스 선택/해제 |
| POST | `/api/projects/[projectId]/resources/credential` | 리소스 인증정보 등록 |
| GET | `/api/projects/[projectId]/resources/exclusions` | 연동 제외 리소스 조회 |

### History

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/projects/[projectId]/history` | 프로젝트 변경 이력 조회 |

### 스캔 (v2)

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/v2/projects/[projectId]/scan` | 스캔 시작 |
| GET | `/api/v2/projects/[projectId]/scan/status` | 스캔 상태 조회 |
| GET | `/api/v2/projects/[projectId]/scan/[scanId]` | 특정 스캔 결과 조회 |
| GET | `/api/v2/projects/[projectId]/scan/history` | 스캔 이력 조회 |

### AWS

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/aws/verify-tf-role` | TF Role 검증 |
| POST | `/api/aws/projects/[projectId]/installation-mode` | 설치 모드 선택 (AUTO/MANUAL) |
| GET | `/api/aws/projects/[projectId]/installation-status` | 설치 상태 조회 |
| POST | `/api/aws/projects/[projectId]/check-installation` | 설치 상태 확인 (Refresh) |
| GET | `/api/aws/projects/[projectId]/terraform-script` | TF Script 다운로드 URL |
| GET | `/api/services/[serviceCode]/settings/aws` | 서비스 AWS 설정 조회 |
| PUT | `/api/services/[serviceCode]/settings/aws` | 서비스 AWS 설정 수정 |
| POST | `/api/services/[serviceCode]/settings/aws/verify-scan-role` | Scan Role 재검증 |

### 서비스/권한

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/services/[serviceCode]/projects` | 서비스별 프로젝트 목록 |
| GET | `/api/services/[serviceCode]/permissions` | 서비스 권한 목록 |
| POST | `/api/services/[serviceCode]/permissions` | 권한 추가 |
| DELETE | `/api/services/[serviceCode]/permissions/[userId]` | 권한 삭제 |

### 사용자

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/user/me` | 현재 사용자 정보 |
| GET | `/api/user/services` | 사용자 서비스 목록 |
| GET | `/api/users/search` | 사용자 검색 |

### Azure

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/azure/projects/[projectId]/installation-status` | DB 설치 상태 조회 |
| POST | `/api/azure/projects/[projectId]/check-installation` | DB 설치 상태 새로고침 |
| GET | `/api/azure/projects/[projectId]/vm-installation-status` | VM 설치 상태 조회 |
| POST | `/api/azure/projects/[projectId]/vm-check-installation` | VM 설치 상태 새로고침 |
| GET | `/api/azure/projects/[projectId]/vm-terraform-script` | VM TF Script 다운로드 정보 |
| GET | `/api/azure/projects/[projectId]/subnet-guide` | Subnet 가이드 조회 |
| GET | `/api/services/[serviceCode]/settings/azure` | Azure 서비스 설정 조회 |

### 개발용

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/dev/switch-user` | 사용자 전환 (개발 전용) |

## 사용법

```typescript
// lib/api.ts에서 래핑된 함수 사용
import { fetchProjects, startScan } from '@/lib/api';

const projects = await fetchProjects();
const scanResult = await startScan(projectId);
```

## 환경별 동작

| 환경 | API 호출 대상 |
|-----|-------------|
| 개발 (dev) | Next.js API Routes (`/api/*`) |
| 운영 (prod) | BFF API (실제 백엔드) |

환경 전환은 `lib/api.ts`의 base URL 설정으로 관리.
