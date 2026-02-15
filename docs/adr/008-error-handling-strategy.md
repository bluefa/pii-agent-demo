# ADR-008: CSR 에러 처리 전략

## 상태
승인됨

## 맥락

### 문제
CSR에서 BFF API 호출 시 에러 처리가 비일관적이었다:
- 서버(V1 Route): RFC 9457 ProblemDetails로 구조화된 에러 반환
- 클라이언트(`app/lib/api/*.ts`): `if (!res.ok) throw new Error(message)` — 구조 소실
- 컴포넌트: `useState<string | null>` — message만 보유, code/status 분기 불가

2주 후 프론트엔드 전문 인력 투입 전, 일관된 에러 처리 규칙이 필요했다.

### 선택지
1. **Status code 기반 자동 매핑**: status → UI 동작 1:1 매핑
2. **2-Layer 설계**: 정규화(Layer 1) + 동작 결정(Layer 2) 분리

## 결정

### 2-Layer 에러 처리 설계 채택

```
브라우저(CSR)
    │
    ▼
fetchJson (Layer 1: 정규화)
    │  HTTP 응답 → AppError 변환
    │  "에러를 구조화한다" (기계적, 맥락 모름)
    ▼
컴포넌트/훅 (Layer 2: 동작 결정)
    │  AppError.code 기반 분기
    │  "에러를 어떻게 처리할지 결정한다" (비즈니스 맥락)
    ▼
ErrorView (UI 렌더링)
```

### API 호출 흐름

```
브라우저 → GET /api/v1/target-sources/123/scanJob/latest
                    ↓
         app/api/v1/.../route.ts
                    ↓
         client.method() → mockClient (현재) / bffClient (향후)
                    ↓
         ProblemDetails 응답: { status, code, detail, retriable, retryAfterMs, requestId }
                    ↓
         fetchJson이 파싱 → AppError { status, code, message, retriable, ... }
                    ↓
         컴포넌트에서 err.code로 분기 → 적절한 UI 표시
```

### AppErrorCode — HTTP 표준 코드만 사용

도메인 코드(TARGET_SOURCE_NOT_FOUND 등)는 서버(`problem.ts`)에서 유지하되, 클라이언트 allowlist에는 포함하지 않는다. BFF에서 도메인 코드를 보내기로 확정되면 그때 추가한다.

```typescript
// 클라이언트 AppErrorCode
type AppErrorCode =
  | 'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND'
  | 'CONFLICT' | 'RATE_LIMITED' | 'INTERNAL_ERROR'   // HTTP 표준
  | 'NETWORK' | 'TIMEOUT' | 'ABORTED' | 'PARSE_ERROR' | 'UNKNOWN';  // 클라이언트 전용
```

미정의 서버 코드는 `console.warn` + status 기반 fallback으로 처리. 기능은 유지되면서 운영 감지가 가능하다.

### HTTP Status Code 규칙

| Status | 의미 | 규칙 |
|:------:|------|------|
| 401 | 인증 실패 | **항상** SSO 토큰 만료/미인증 |
| 403 | 인가 실패 | **항상** BFF API 호출 권한 없음 |
| 4xx | 비즈니스 에러 | status + code로 구분 |
| 5xx | 서버 에러 | retriable: true (기본) |

비즈니스 로직 결과(예: AWS Role 검증 실패)는 200 + 데이터로 반환. HTTP 에러 코드를 비즈니스 결과에 사용하지 않는다.

### fetchJson 방어 로직

| 항목 | 처리 |
|------|------|
| 미정의 서버 code | `console.warn` + status fallback |
| JSON 파싱 실패 | status 기반 code + retriable fallback |
| 429/5xx retriable | 서버 값 우선, 없으면 `true` |
| Retry-After 헤더 | delta-seconds 파싱 (서버 retryAfterMs 우선) |
| Headers | `new Headers()` 안전 병합 |
| 타임아웃 | 30s 기본, AbortController |

### 에러 분류 체계

```
에러
├── 예상된 에러 (Expected)
│   ├── Expected-Flow     ← 에러지만 UI가 정상 동작으로 전환 (예: scan 409)
│   └── Expected-Block
│       ├── Soft Block    ← 다시 시도 가능 (429, 네트워크)
│       └── Hard Block    ← 사용자 조치 필요 (403, 404)
└── 예상하지 못한 에러 (Unexpected) ← 서버 버그, 파싱 실패
```

같은 status code라도 API 맥락에 따라 분류가 달라진다. Layer 2에서 `err.code` 기반으로 맥락 판단.

## 결과

### 구현된 파일
- `lib/errors.ts` — AppError 클래스, AppErrorCode, KNOWN_ERROR_CODES, isKnownErrorCode
- `lib/fetch-json.ts` — fetchJson 래퍼 (v1 ProblemDetails 전용)
- `lib/__tests__/fetch-json.test.ts` — 테스트 30개

### 미구현 (후속 작업)
- ErrorView 컴포넌트 (`app/components/errors/`)
- ErrorCatalog (에러 코드별 기본 CTA 매핑) — ErrorView 안정화 후 결정
- React Error Boundary — v2에서 도입
- 기존 API 함수 마이그레이션 — 점진적 (scan → credential → provider → 나머지)

### 관련 문서
- `docs/swagger/ERROR_HANDLING_DESIGN.md` — 설계 논의 상세
- `docs/swagger/SCAN_ERROR_UX.md` — 스캔 에러 UX 요구사항
- `app/api/_lib/problem.ts` — 서버 측 ProblemDetails 정의
- ADR-007 — API Client 패턴 (route.ts → client.method())
