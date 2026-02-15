# Scan API

> AWS / Azure / GCP 공통 스캔 관련 API를 정의합니다.

---

## 대상 Provider

- [x] AWS
- [x] Azure
- [x] GCP
- [ ] IDC (스캔 없음 - 직접 입력)
- [ ] SDU (스캔 없음 - Crawler 사용)

---

## 스캔 흐름

```
스캔 권한 확인 → 스캔 실행 (비동기) → 진행 상태 폴링 → 결과 조회
```

---

## 스캔 권한 확인

### 권한 상태 조회

```
GET /api/projects/{projectId}/scan/permission
```

**응답**:
```typescript
{
  provider: 'AWS' | 'Azure' | 'GCP',
  hasPermission: boolean,

  // AWS
  scanRoleArn?: string,

  // Azure
  scanAppId?: string,

  // GCP
  projectId?: string,
  hostProjectId?: string,  // Cloud SQL용

  // 권한 없을 때
  errorCode?: string,
  errorMessage?: string
}
```

---

## 스캔 실행

### 스캔 시작 [ASYNC]

```
POST /api/projects/{projectId}/scan
```

> 비동기 작업 - 즉시 scanId 반환, 백그라운드에서 실행

**요청**:
```typescript
{
  force?: boolean  // true면 5분 제한 무시
}
```

**응답**:
```typescript
{
  scanId: string,
  status: 'STARTED',
  startedAt: string
}
```

**에러 케이스**:
| 에러 코드 | 설명 |
|-----------|------|
| SCAN_IN_PROGRESS | 이미 스캔 진행 중 |
| SCAN_TOO_RECENT | 5분 이내 스캔 완료 (force=false) |
| NO_PERMISSION | 스캔 권한 없음 |

---

## 스캔 진행 상태

### 현재 스캔 상태 조회

```
GET /api/projects/{projectId}/scan/status
```

**응답**:
```typescript
{
  isScanning: boolean,
  currentScan?: {
    scanId: string,
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED',
    startedAt: string,
    completedAt?: string,
    progress?: number,  // 0-100 (가능하면)
    error?: string
  }
}
```

### 특정 스캔 상태 조회

```
GET /api/projects/{projectId}/scan/{scanId}
```

**응답**:
```typescript
{
  scanId: string,
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED',
  startedAt: string,
  completedAt?: string,
  result?: {
    totalFound: number,
    byResourceType: Array<{
      resourceType: ResourceType,
      count: number
    }>
  },
  error?: string
}
```

---

## 스캔 결과/정보

### 스캔 정보 요약 (페이지 진입용)

```
GET /api/projects/{projectId}/scan-info
```

**응답**:
```typescript
{
  lastScannedAt: string | null,
  canScan: boolean,            // 5분 경과 여부
  hasNewResources: boolean,
  newResourceCount: number,
  isScanning: boolean          // 현재 스캔 중 여부
}
```

---

## 스캔 이력

### 스캔 이력 조회

```
GET /api/projects/{projectId}/scan/history
```

**Query Params**:
```
?limit=10&offset=0
```

**응답**:
```typescript
{
  history: Array<{
    scanId: string,
    status: 'COMPLETED' | 'FAILED',
    startedAt: string,
    completedAt: string,
    duration: number,  // seconds
    result: {
      totalFound: number,
      byResourceType: Array<{
        resourceType: ResourceType,
        count: number
      }>
    } | null,
    error?: string
  }>,
  total: number
}
```

---

## 비동기 작업 패턴

### 클라이언트 폴링 방식

```
1. POST /scan → scanId 받음
2. GET /scan/status 주기적 호출 (2~5초 간격)
3. status === 'COMPLETED' 또는 'FAILED' 시 종료
4. 리소스 목록 새로고침
```

### 타임아웃

- 스캔 최대 시간: 5분 (Provider별 상이할 수 있음)
- 클라이언트 폴링 타임아웃: 5분

---

## Provider별 특이사항

### AWS
- 스캔 Role ARN 필요
- 리전별 스캔

### Azure
- Scan App 등록 필요
- Subscription 단위 스캔

### GCP
- 프로젝트 권한 필요
- Cloud SQL: Host Project 권한 추가 필요

---

## v1 API 에러 처리 요구사항

> **관련 Issue**: #151
> **Swagger 명세**: `docs/swagger/scan.yaml` — ErrorResponse 스키마 참조

### 현재 문제점

1. **커스텀 Error 클래스 부재** — 전 프로젝트에 `extends Error`가 없음. 모든 API 에러가 `new Error(message)`로 처리되어 HTTP status, error code 정보가 소실됨
2. **`alert()` 사용** — `startScan` 실패 시 `useApiMutation`에서 `alert()` 호출. 409/404/500 구분 없이 동일한 alert
3. **폴링 에러 무시** — `useScanPolling`에서 에러 발생 시 `onError` 콜백 호출하지만, `ScanPanel`이 `onError`를 제공하지 않아 화면에 표시되지 않음
4. **비즈니스 실패 메시지 부족** — `ScanJob.scanError` 코드(AUTH_PERMISSION_ERROR 등)를 활용하지 않음

### 필요 변경사항

#### 1. ApiError 클래스 도입 (`lib/errors.ts`)

```typescript
class ApiError extends Error {
  status: number;
  code: string;
  retriable: boolean;
}
```

- `scan.ts`에서 HTTP status별 구조화된 에러 throw
- `useApiMutation`에서 `ApiError` 인스턴스일 때 code 기반 분기 지원

#### 2. ScanPanel inline error UI

- `alert()` 제거
- 409 ALREADY_EXISTS: info banner + 폴링 자동 시작
- 404 TARGET_SOURCE_NOT_FOUND: persistent error banner + 스캔 버튼 비활성화
- 500 INTERNAL_ERROR / network: error banner + 다시 시도 버튼

#### 3. 폴링 에러 표시

- `useScanPolling`에 consecutiveErrors 카운터 추가
- 3회 연속 실패 시 progress 영역에 warning 표시
- 폴링은 중단하지 않음 (일시적 장애 복구 대응)

#### 4. scanError 메시지 매핑

- `ScanJob.scanError` 코드별 사용자 친화적 메시지
- FAILED 상태 UI에 구체적 에러 원인 + 해결 방법 안내

### Error Policy Table

| Error | Type | Block | UI | Action | State Transition |
|-------|------|-------|----|--------|-----------------|
| POST scan → 409 | USER_ACTION | NONE | INLINE info | "이미 진행 중" + 폴링 시작 | → IN_PROGRESS |
| POST scan → 404 | CONFIG | HARD | BANNER persistent | "대상 없음. 설정 확인" | 버튼 비활성화 |
| POST scan → 500 | SYSTEM | SOFT | INLINE error + retry | "서버 오류" + 다시 시도 | 변경 없음 |
| POST scan → network | SYSTEM | SOFT | INLINE error + retry | "네트워크 오류" | 변경 없음 |
| GET latest → polling 실패 | SYSTEM | NONE | INLINE warning (3회 연속) | "상태 조회 오류. 재시도 중" | 폴링 계속 |
| ScanJob FAIL | USER_ACTION | SOFT | INLINE error + retry | scanError별 메시지 | → FAILED |
| ScanJob TIMEOUT | SYSTEM | SOFT | INLINE warning + retry | "30분 초과 타임아웃" | → FAILED |

### 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `lib/errors.ts` (신규) | ApiError 클래스 정의 |
| `app/lib/api/scan.ts` | ApiError throw로 변경 |
| `app/hooks/useApiMutation.ts` | alert() 제거, ApiError 분기 |
| `app/hooks/useScanPolling.ts` | consecutiveErrors 카운터 |
| `app/components/features/scan/ScanPanel.tsx` | inline error UI |

---

## TODO

- [ ] 스캔 권한 확인 API 상세 정의 (Provider별)
- [ ] 스캔 진행률 표시 가능 여부 확인
- [ ] 스캔 취소 API 필요 여부
- [ ] 웹훅 방식 지원 여부 (폴링 대체)
- [ ] 스캔 실패 시 재시도 정책
- [ ] v1 API 에러 처리 구현 (#151)

---

## 구현 상태

### API Routes (Next.js)

| 엔드포인트 | 상태 | 비고 |
|-----------|------|------|
| POST /scan | ✅ 구현 | v2 API |
| GET /scan/status | ✅ 구현 | v2 API |
| GET /scan/{scanId} | ✅ 구현 | v2 API |
| GET /scan/history | ✅ 구현 | v2 API |
| GET /scan/permission | ❌ 미구현 | |
| GET /scan-info | ❌ 미구현 | |

### 테스트

- ✅ 유닛 테스트 36개 (lib/__tests__/mock-scan.test.ts)
- Provider별 리소스 생성 검증
- 스캔 정책 검증 (IDC/SDU 제외, 5분 쿨다운, 최대 10개 리소스)

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-30 | API Routes v2 구현 완료, 유닛 테스트 추가 |
| 2026-01-30 | 스캔 결과에 리소스 타입별 카운트(byResourceType) 추가 |
| 2026-01-29 | 초안 작성 |
