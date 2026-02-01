# Scan API Routes (v2)

> Next.js API Routes의 스캔 기능 구현 상세 문서

---

## 개요

이 API Routes는 **BFF API 명세**(`docs/api/scan.md`)를 기반으로 구현되었습니다.

| 환경 | API 호출 대상 | Base Path |
|-----|-------------|-----------|
| 개발 | Next.js API Routes | `/api/v2/projects/{projectId}/scan/*` |
| 운영 | BFF API (백엔드 서버) | `/api/projects/{projectId}/scan/*` |

> **Note**: API Routes는 `/api/v2/` prefix를 사용하고, BFF API는 `/api/`를 사용합니다.

---

## 엔드포인트

| Method | API Routes (개발) | BFF API (운영) | 설명 |
|--------|-------------------|----------------|------|
| POST | `/api/v2/projects/{id}/scan` | `/api/projects/{id}/scan` | 스캔 시작 |
| GET | `/api/v2/projects/{id}/scan/status` | `/api/projects/{id}/scan/status` | 현재 상태 |
| GET | `/api/v2/projects/{id}/scan/{scanId}` | `/api/projects/{id}/scan/{scanId}` | 특정 스캔 조회 |
| GET | `/api/v2/projects/{id}/scan/history` | `/api/projects/{id}/scan/history` | 스캔 이력 |

### 파일 구조

```
app/api/v2/projects/[projectId]/scan/
├── route.ts           # POST: 스캔 시작
├── status/route.ts    # GET: 현재 스캔 상태
├── [scanId]/route.ts  # GET: 특정 스캔 조회
└── history/route.ts   # GET: 스캔 이력
```

---

## 핵심 흐름

### 개발 환경
```
클라이언트                         API Routes (/api/v2/...)
    │                                   │
    │  POST /api/v2/.../scan           │
    ├─────────────────────────────────>│  (내부 시뮬레이션)
    │  202 { scanId, status }          │
    │<─────────────────────────────────┤
    │                                   │
    │  GET /api/v2/.../scan/status     │
    ├─────────────────────────────────>│
    │  { isScanning, progress }        │
    │<─────────────────────────────────┤
```

### 운영 환경
```
클라이언트                         BFF API (/api/...)
    │                                   │
    │  POST /api/.../scan              │
    ├─────────────────────────────────>│  (백엔드 서버)
    │  202 { scanId, status }          │
    │<─────────────────────────────────┤
    │                                   │
    │  GET /api/.../scan/status        │
    ├─────────────────────────────────>│
    │  { isScanning, progress }        │
    │<─────────────────────────────────┤
```

---

## 스캔 상태 전이

```
PENDING → IN_PROGRESS → COMPLETED
                     └→ FAILED
```

- `PENDING`: 스캔 요청 접수
- `IN_PROGRESS`: 스캔 진행 중 (progress 0~99%)
- `COMPLETED`: 스캔 완료, 리소스 갱신됨
- `FAILED`: 스캔 실패

---

## 스캔 정책

| 정책 | 값 | 설명 |
|------|-----|------|
| 쿨다운 | 5분 | 동일 프로젝트 연속 스캔 방지 |
| 최대 리소스 | 10개 | 프로젝트당 리소스 제한 |

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

모든 Route Handler는 동일한 패턴:

```
1. 인증 확인 → 2. 프로젝트 존재 → 3. 권한 확인 → 4. 비즈니스 로직
```

**에러 코드**:
| 코드 | HTTP | 상황 |
|------|------|------|
| `UNAUTHORIZED` | 401 | 미인증 |
| `FORBIDDEN` | 403 | 권한 없음 |
| `NOT_FOUND` | 404 | 프로젝트 없음 |
| `SCAN_IN_PROGRESS` | 409 | 이미 스캔 중 |
| `SCAN_TOO_RECENT` | 429 | 5분 미경과 |
| `MAX_RESOURCES_REACHED` | 400 | 리소스 초과 |

---

## BFF API 명세

운영 환경에서 호출하는 BFF API의 상세 스펙은 `docs/api/scan.md` 참조.

- 요청/응답 타입 정의
- Provider별 특이사항
- 비동기 작업 패턴

---

## 테스트

```bash
npm test -- lib/__tests__/scan.test.ts
```

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-30 | v2 API 구현 완료 |
| 2026-02-02 | API Routes 흐름 문서 작성 |
