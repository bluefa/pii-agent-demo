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
    newFound: number,
    updated: number,
    removed: number,
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
      newFound: number,
      updated: number,
      removed: number,
      byResourceType: Array<{
        resourceType: ResourceType,
        count: number,
        newCount: number
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

## TODO

- [ ] 스캔 권한 확인 API 상세 정의 (Provider별)
- [ ] 스캔 진행률 표시 가능 여부 확인
- [ ] 스캔 취소 API 필요 여부
- [ ] 웹훅 방식 지원 여부 (폴링 대체)
- [ ] 스캔 실패 시 재시도 정책

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-30 | 스캔 결과에 리소스 타입별 카운트(byResourceType) 추가 |
| 2026-01-29 | 초안 작성 |
