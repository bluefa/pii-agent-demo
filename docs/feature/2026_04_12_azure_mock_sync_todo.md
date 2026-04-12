# Azure Mock API 동기화 — 작업 Todo

> 작성일: 2026-04-12
> 기준: `docs/feature/2026_04_12_azure_bff_mock_sync_checklist.md`
> 원칙: **mock 파일만 수정한다. 컴포넌트, route handler, API response shape 변경 금지.**

---

## 변경 대상 파일 (3개)

| 파일 | 변경 유형 |
|------|----------|
| `lib/api-client/mock/azure.ts` | 메서드 추가 |
| `lib/api-client/mock/scan.ts` | 응답 shape 교체 |
| `lib/mock-azure.ts` | getScanApp 지원을 위한 반환 shape 보강 (필요 시) |

---

## Task 1: `mockAzure.getScanApp` 메서드 추가

### 배경
- `lib/api-client/types.ts`에 `azure.getScanApp(targetSourceId)` 선언됨 (#249)
- `lib/api-client/mock/azure.ts`에 구현 없음 → 런타임 에러

### 계약 조건 (route handler 기준)
- Route: `app/integration/api/v1/target-sources/[targetSourceId]/azure/scan-app/route.ts`
- route가 mock 응답을 **그대로 passthrough** (`NextResponse.json(data)`)
- FE가 기대하는 최종 shape:

```json
{
  "app_id": "string | null",
  "status": "HEALTHY | UNHEALTHY | UNREGISTERED",
  "fail_reason": "string | null",
  "fail_message": "string | null",
  "last_verified_at": "string (ISO) | null"
}
```

### 구현 가이드
- `lib/mock-azure.ts`의 `getAzureServiceSettings(serviceCode)`를 활용
- mock project에서 serviceCode를 꺼내 settings 조회 → scanApp 정보 매핑
- 기존 `authorize(projectId)` 패턴 그대로 사용

### 검증
- [ ] `GET /integration/api/v1/target-sources/{targetSourceId}/azure/scan-app` 호출 시 200 + 위 shape 반환
- [ ] Azure 미등록 project → status `UNREGISTERED` 반환
- [ ] Azure 등록 project → status `HEALTHY` + `app_id` 반환

---

## Task 2: `mockScan.getHistory` 응답 shape 교체

### 배경
- Route handler가 `{ content: ScanJob[], totalElements }` camelCase를 기대
- 현재 mock: `{ history: [{ scanId, status, ... }], total }` legacy shape

### 계약 조건
- Route: `app/integration/api/v1/target-sources/[targetSourceId]/scan/history/route.ts`
- route가 파싱하는 mock 응답 shape (라인 36-50):

```typescript
{
  content: {
    id: number;
    scanStatus: string;          // SCANNING | COMPLETED | FAILED
    targetSourceId: number;
    createdAt: string;           // ISO
    updatedAt: string;           // ISO
    scanVersion: number | null;
    scanProgress: number | null;
    durationSeconds: number;
    resourceCountByResourceType: Record<string, number> | null;
    scanError: string | null;
  }[];
  totalElements: number;
}
```

### 구현 가이드
- `lib/api-client/mock/scan.ts` `getHistory` 메서드 (라인 52-89)
- `history` → `content`, `total` → `totalElements`
- 각 item: `scanId` → `id` (number), `status` → `scanStatus`, `startedAt` → `createdAt`, `completedAt` → `updatedAt`, `duration` → `durationSeconds`
- 새 필드 추가: `targetSourceId`, `scanVersion`, `scanProgress`, `resourceCountByResourceType`, `scanError`

### 검증
- [ ] `GET /integration/api/v1/target-sources/{targetSourceId}/scan/history?page=0&size=10` → 200 + 위 shape
- [ ] `content` 배열의 각 item이 camelCase
- [ ] `totalElements`가 총 건수와 일치

---

## Task 3: `mockScan.create` 응답 shape 교체

### 배경
- Route handler가 **snake_case** 응답을 기대 (POST이므로 `proxyPost` 경유, 자동 변환 없음)
- 현재 mock: `{ scanId, status, startedAt, estimatedDuration }` legacy shape

### 계약 조건
- Route: `app/integration/api/v1/target-sources/[targetSourceId]/scan/route.ts`
- route가 파싱하는 mock 응답 shape (라인 18-29):

```typescript
{
  id: number;
  scan_status: string;           // SCANNING
  target_source_id: number;
  created_at: string;            // ISO
  updated_at: string;            // ISO
  scan_version: number | null;
  scan_progress: number | null;
  duration_seconds: number;
  resource_count_by_resource_type: Record<string, number> | null;
  scan_error: string | null;
}
```

### 구현 가이드
- `lib/api-client/mock/scan.ts` `create` 메서드 (라인 92-146)
- 반환부 (라인 137-144) shape 교체
- `scanId` → `id` (number), `status` → `scan_status`, `startedAt` → `created_at`/`updated_at`
- 새 필드: `target_source_id`, `scan_version`, `scan_progress`, `resource_count_by_resource_type`, `scan_error`
- HTTP status 202 유지

### 검증
- [ ] `POST /integration/api/v1/target-sources/{targetSourceId}/scan` → 202 + 위 shape
- [ ] 응답 필드가 **snake_case**

---

## Task 4: `mockScan.getStatus` 응답 shape 교체

### 배경
- Route handler (`scanJob/latest`)가 **camelCase** 기대 (GET이므로 `proxyGet` 경유, `camelCaseKeys` 자동 변환)
- 현재 mock: `{ isScanning, canScan, currentScan, lastCompletedScan, ... }` legacy shape

### 계약 조건
- Route: `app/integration/api/v1/target-sources/[targetSourceId]/scanJob/latest/route.ts`
- route가 파싱하는 mock 응답 shape (라인 29-40):

```typescript
{
  id: number;
  scanStatus: string;            // SCANNING | COMPLETED | FAILED | NO_SCAN
  targetSourceId: number;
  createdAt: string;             // ISO
  updatedAt: string;             // ISO
  scanVersion: number | null;
  scanProgress: number | null;
  durationSeconds: number;
  resourceCountByResourceType: Record<string, number> | null;
  scanError: string | null;
}
```

### 구현 가이드
- `lib/api-client/mock/scan.ts` `getStatus` 메서드 (라인 148-208)
- 기존 로직의 `activeScan`/`lastCompletedScan` 판별은 유지하되, 최종 반환 shape만 교체
- scan이 없는 경우: `{ id: 0, scanStatus: 'NO_SCAN', targetSourceId, createdAt: now, ... }` 같은 빈 응답 고려

### 검증
- [ ] `GET /integration/api/v1/target-sources/{targetSourceId}/scanJob/latest` → 200 + 위 shape
- [ ] 스캔 진행 중일 때 `scanStatus: 'SCANNING'`, `scanProgress` 값 존재
- [ ] 스캔 완료 시 `scanStatus: 'COMPLETED'`, `durationSeconds` 값 존재
- [ ] 스캔 이력 없는 project → 적절한 빈 응답 또는 404

---

## 최종 검증 (모든 Task 완료 후)

### 계약 검증

- [ ] Task 1: scan-app 응답이 snake_case (`app_id`, `status`, `fail_reason`, `fail_message`, `last_verified_at`)
- [ ] Task 2: getHistory 응답이 camelCase (`content[].scanStatus`, `totalElements`)
- [ ] Task 3: create 응답이 snake_case (`scan_status`, `target_source_id`, `created_at`)
- [ ] Task 4: getStatus 응답이 camelCase (`scanStatus`, `targetSourceId`, `createdAt`)

### 서버 동작 검증

```bash
# dev 서버 기동 (USE_MOCK_DATA=true 기본)
bash scripts/dev.sh /Users/study/pii-agent-demo-azure-mock-sync-audit

# 아래 엔드포인트 curl 확인
# 1. Scan App
curl http://localhost:3000/integration/api/v1/target-sources/1/azure/scan-app

# 2. Scan History
curl http://localhost:3000/integration/api/v1/target-sources/1/scan/history?page=0&size=5

# 3. Scan Create
curl -X POST http://localhost:3000/integration/api/v1/target-sources/1/scan \
  -H 'Content-Type: application/json' -d '{}'

# 4. ScanJob Latest
curl http://localhost:3000/integration/api/v1/target-sources/1/scanJob/latest
```

### TypeScript 빌드 검증

```bash
npx tsc --noEmit
```
