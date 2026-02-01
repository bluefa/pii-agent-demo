# Scan API Routes (v2)

> Next.js API Routes의 스캔 기능 구현 상세 문서

---

## 파일 구조

```
app/api/v2/projects/[projectId]/scan/
├── route.ts           # POST: 스캔 시작
├── status/route.ts    # GET: 현재 스캔 상태
├── [scanId]/route.ts  # GET: 특정 스캔 조회
└── history/route.ts   # GET: 스캔 이력

lib/
├── mock-scan.ts       # 스캔 로직 (검증, 상태 계산, 리소스 생성)
├── mock-store.ts      # 인메모리 데이터 저장소
└── constants/scan.ts  # 상수 및 정책 정의
```

---

## 핵심 흐름

```
클라이언트                    API Routes                    lib/mock-scan.ts
    │                            │                              │
    │  POST /scan               │                              │
    ├──────────────────────────>│  validateScanRequest()      │
    │                           ├─────────────────────────────>│
    │                           │<─────────────────────────────┤
    │                           │  createScanJob()             │
    │                           ├─────────────────────────────>│
    │  202 { scanId, status }   │<─────────────────────────────┤
    │<──────────────────────────┤                              │
    │                           │                              │
    │  GET /scan/status (폴링)  │                              │
    ├──────────────────────────>│  calculateScanStatus()      │
    │                           ├─────────────────────────────>│
    │  { isScanning, progress } │  (시간 기반 상태 계산)        │
    │<──────────────────────────┤<─────────────────────────────┤
    │                           │                              │
    │  (status=COMPLETED)       │                              │
    │  리소스 목록 새로고침      │                              │
```

---

## 시간 기반 상태 계산

스캔 상태는 **실제 시간**을 기준으로 계산됩니다 (`calculateScanStatus()`).

```typescript
// lib/mock-scan.ts:195-229
export const calculateScanStatus = (scan: ScanJob): ScanJob => {
  if (scan.status === 'COMPLETED' || scan.status === 'FAILED') {
    return scan;
  }

  const now = Date.now();
  const startTime = new Date(scan.startedAt).getTime();
  const estimatedEnd = new Date(scan.estimatedEndAt).getTime();

  // 완료 시간 도달 → COMPLETED 처리
  if (now >= estimatedEnd) {
    return completeScan(scan);  // 리소스 생성 + 이력 저장
  }

  // 진행 중 → progress 계산 (0~99%)
  const progress = Math.floor((elapsed / total) * 100);
  return { ...scan, status: 'IN_PROGRESS', progress };
};
```

**상태 전이**:
- `PENDING` → 스캔 생성 직후
- `IN_PROGRESS` → 시간 경과 시 (0~99% progress)
- `COMPLETED` → estimatedEndAt 도달 시 (리소스 생성)

---

## 스캔 정책

| 정책 | 값 | 위치 |
|------|-----|------|
| 쿨다운 | 5분 | `SCAN_COOLDOWN_MS` |
| 최대 리소스 | 10개 | `MAX_RESOURCES` |
| 스캔 소요시간 | 3~10초 | `SCAN_MIN/MAX_DURATION_MS` |

**Provider별 지원**:
| Provider | 스캔 | 비고 |
|----------|------|------|
| AWS | ✅ | RDS, DynamoDB, Athena, Redshift, EC2 |
| Azure | ✅ | SQL, PostgreSQL, MySQL, CosmosDB, Synapse, VM |
| GCP | ✅ | Cloud SQL, BigQuery |
| IDC | ❌ | 직접 입력 |
| SDU | ❌ | Crawler 사용 |

---

## 에러 처리

모든 Route Handler는 동일한 패턴을 따릅니다:

```typescript
// 1. 인증 → 2. 프로젝트 존재 → 3. 권한 → 4. 비즈니스 로직
if (!user) return 401;
if (!project) return 404;
if (!hasPermission) return 403;
```

**에러 코드** (`lib/constants/scan.ts`):
| 코드 | HTTP | 상황 |
|------|------|------|
| `UNAUTHORIZED` | 401 | 미인증 |
| `FORBIDDEN` | 403 | 권한 없음 |
| `NOT_FOUND` | 404 | 프로젝트 없음 |
| `SCAN_IN_PROGRESS` | 409 | 이미 스캔 중 |
| `SCAN_TOO_RECENT` | 429 | 5분 미경과 |
| `MAX_RESOURCES_REACHED` | 400 | 10개 초과 |

---

## 주요 함수 (lib/mock-scan.ts)

| 함수 | 역할 |
|------|------|
| `validateScanRequest()` | 스캔 가능 여부 검증 |
| `createScanJob()` | ScanJob 생성 및 Store 저장 |
| `calculateScanStatus()` | 시간 기반 상태 계산 |
| `getScanJob()` | scanId로 스캔 조회 |
| `getScanHistory()` | 프로젝트별 이력 조회 |
| `canScan()` | 현재 스캔 가능 여부 반환 |
| `generateAwsResource()` | AWS 리소스 생성 |
| `generateAzureResource()` | Azure 리소스 생성 |
| `generateGcpResource()` | GCP 리소스 생성 |

---

## 테스트

```bash
npm test -- lib/__tests__/mock-scan.test.ts
```

- 36개 유닛 테스트
- Provider별 리소스 생성 검증
- 스캔 정책 검증 (쿨다운, 최대 리소스, Provider 제한)

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-30 | v2 API 구현 완료 |
| 2026-02-02 | API Routes 흐름 문서 작성 |
