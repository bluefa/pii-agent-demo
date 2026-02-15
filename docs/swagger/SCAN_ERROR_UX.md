# Scan API Error UX 요구사항

> **관련 Issue**: #151
> **API 명세**: `docs/swagger/scan.yaml`

## 현재 문제점

1. **커스텀 Error 클래스 부재** — 전 프로젝트에 `extends Error`가 없음. 모든 API 에러가 `new Error(message)`로 처리되어 HTTP status, error code 정보가 소실됨
2. **`alert()` 사용** — `startScan` 실패 시 `useApiMutation`에서 `alert()` 호출. 409/404/500 구분 없이 동일한 alert
3. **폴링 에러 무시** — `useScanPolling`에서 에러 발생 시 `onError` 콜백 호출하지만, `ScanPanel`이 `onError`를 제공하지 않아 화면에 표시되지 않음
4. **비즈니스 실패 메시지 부족** — `ScanJob.scanError` 코드(AUTH_PERMISSION_ERROR 등)를 활용하지 않음

## 필요 변경사항

### 1. ApiError 클래스 도입 (`lib/errors.ts`)

```typescript
class ApiError extends Error {
  status: number;
  code: string;
  retriable: boolean;
}
```

- `scan.ts`에서 HTTP status별 구조화된 에러 throw
- `useApiMutation`에서 `ApiError` 인스턴스일 때 code 기반 분기 지원

### 2. ScanPanel inline error UI

- `alert()` 제거
- 409 ALREADY_EXISTS: info banner + 폴링 자동 시작
- 404 TARGET_SOURCE_NOT_FOUND: persistent error banner + 스캔 버튼 비활성화
- 500 INTERNAL_ERROR / network: error banner + 다시 시도 버튼

### 3. 폴링 에러 표시

- `useScanPolling`에 consecutiveErrors 카운터 추가
- 3회 연속 실패 시 progress 영역에 warning 표시
- 폴링은 중단하지 않음 (일시적 장애 복구 대응)

### 4. scanError 메시지 매핑

- `ScanJob.scanError` 코드별 사용자 친화적 메시지
- FAILED 상태 UI에 구체적 에러 원인 + 해결 방법 안내

## Error Policy Table

| Error | Type | Block | UI | Action | State Transition |
|-------|------|-------|----|--------|-----------------|
| POST scan → 409 | USER_ACTION | NONE | INLINE info | "이미 진행 중" + 폴링 시작 | → IN_PROGRESS |
| POST scan → 404 | CONFIG | HARD | BANNER persistent | "대상 없음. 설정 확인" | 버튼 비활성화 |
| POST scan → 500 | SYSTEM | SOFT | INLINE error + retry | "서버 오류" + 다시 시도 | 변경 없음 |
| POST scan → network | SYSTEM | SOFT | INLINE error + retry | "네트워크 오류" | 변경 없음 |
| GET latest → polling 실패 | SYSTEM | NONE | INLINE warning (3회 연속) | "상태 조회 오류. 재시도 중" | 폴링 계속 |
| ScanJob FAIL | USER_ACTION | SOFT | INLINE error + retry | scanError별 메시지 | → FAILED |
| ScanJob TIMEOUT | SYSTEM | SOFT | INLINE warning + retry | "30분 초과 타임아웃" | → FAILED |

## 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `lib/errors.ts` (신규) | ApiError 클래스 정의 |
| `app/lib/api/scan.ts` | ApiError throw로 변경 |
| `app/hooks/useApiMutation.ts` | alert() 제거, ApiError 분기 |
| `app/hooks/useScanPolling.ts` | consecutiveErrors 카운터 |
| `app/components/features/scan/ScanPanel.tsx` | inline error UI |
