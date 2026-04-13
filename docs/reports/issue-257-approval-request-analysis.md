# Issue #257: 연동 승인 요청 조회 문제 분석

## 개요

실제 BFF를 연동한 환경에서 승인 내역 조회가 제대로 동작하지 않는 문제.
두 가지 근본 원인이 확인됨: **API 엔드포인트 미연결**과 **응답 인터페이스 불일치**.

---

## 이슈 1: 승인 조회 시 BFF API를 호출하지 않음

### 현상

"승인 내역 확인" 또는 "요청 내용 확인" 버튼을 누를 때 실제 BFF의 **최신 승인 요청 조회 API**를 호출하지 않음.

### 원인

현재 `ApprovalWaitingCard`와 `ApprovalApplyingBanner`는 최신 승인 요청을 가져오기 위해 **`getApprovalHistory(targetSourceId, 0, 1)`** 을 호출하고, 응답의 첫 번째 항목(`content[0].request`)을 사용함.

```typescript
// ApprovalWaitingCard.tsx:31-35, ApprovalApplyingBanner.tsx:28-32
getApprovalHistory(targetSourceId, 0, 1)
  .then((history) => {
    if (!cancelled && history.content.length > 0) {
      setLatestRequest(history.content[0].request);
    }
  })
```

그러나 실제 BFF에는 **최신 승인 요청을 직접 조회하는 전용 엔드포인트**가 존재함:

```
GET /install/v1/target-sources/{targetSourceId}/approval-requests/latest
```

현재 코드베이스에는 이 `/latest` 엔드포인트에 대한 구현이 **전혀 없음**:
- `app/lib/api/index.ts`: `getApprovalRequestLatest` 같은 클라이언트 함수 없음
- `lib/api-client/bff-client.ts`: `confirm` 네임스페이스에 `getApprovalRequestLatest` 없음
- `lib/api-client/types.ts`: `ApiClient.confirm`에 해당 메서드 정의 없음
- `app/api/v1/target-sources/[targetSourceId]/approval-requests/latest/route.ts`: 라우트 파일 없음

### 개선 방안

1. **Next.js API 라우트 추가**: `app/api/v1/target-sources/[targetSourceId]/approval-requests/latest/route.ts`
2. **BFF Client에 메서드 추가**: `confirm.getApprovalRequestLatest(projectId)`
3. **클라이언트 API 함수 추가**: `getApprovalRequestLatest(targetSourceId)`
4. **컴포넌트 호출 변경**: `ApprovalWaitingCard`와 `ApprovalApplyingBanner`에서 `getApprovalHistory(id, 0, 1)` 대신 `getApprovalRequestLatest(id)` 호출

---

## 이슈 2: BFF 실제 응답과 프론트엔드 인터페이스 불일치

### 현상

BFF가 반환하는 실제 응답 구조와 프론트엔드의 `ApprovalHistoryResponse` 타입이 다름.

### 실제 BFF 응답 (이슈 #257에서 확인)

```json
{
  "request": {
    "id": 100,
    "target_source_id": 29,
    "status": "PENDING",
    "requested_by": {
      "user_id": "admin"
    },
    "requested_at": "2026-04-13T10:12:31.67072",
    "resource_total_count": 10,
    "resource_selected_count": 3
  },
  "result": {
    "request_id": null,
    "status": "PENDING",
    "processed_by": {
      "user_id": "admin"
    },
    "processed_at": "2026-04-13T10:12:31.67072",
    "reason": null
  }
}
```

### 프론트엔드 현재 인터페이스

```typescript
// app/lib/api/index.ts:211-230
interface ApprovalHistoryResponse {
  content: Array<{
    request: {
      id: string;
      requested_at: string;
      requested_by: string;           // BFF: { user_id: string }
      input_data: {                    // BFF: 없음 (대신 resource_total_count, resource_selected_count)
        resource_inputs: ApprovalResourceInput[];
        exclusion_reason_default?: string;
      };
    };
    result?: {
      id: string;
      request_id: string;
      result: string;                  // BFF 필드명: status
      processed_at: string;
      process_info: {                  // BFF: processed_by + reason 분리 구조
        user_id: string | null;
        reason: string | null;
      };
    };
  }>;
  page: { ... };
}
```

### 필드별 차이 상세

| 구분 | 프론트엔드 현재 | BFF 실제 응답 | 차이 |
|------|---------------|-------------|------|
| **request.id** | `string` | `number (100)` | 타입 불일치 |
| **request.target_source_id** | 없음 | `number` | 누락 |
| **request.status** | 없음 | `"PENDING"` | 누락 |
| **request.requested_by** | `string` | `{ user_id: string }` | 구조 불일치 (flat string vs object) |
| **request.input_data** | `{ resource_inputs, exclusion_reason_default }` | 없음 | 존재하지 않는 필드 |
| **request.resource_total_count** | 없음 | `number` | 누락 |
| **request.resource_selected_count** | 없음 | `number` | 누락 |
| **result.result** | `string` (APPROVED/REJECTED 등) | 없음 | 필드명 차이 → `status` |
| **result.status** | 없음 | `"PENDING"` | 프론트엔드에서는 `result` 필드명 사용 |
| **result.id** | `string` | 없음 | 누락 (BFF에 없음) |
| **result.request_id** | `string` | `null` | nullable 미처리 |
| **result.process_info** | `{ user_id, reason }` | 없음 | 구조 불일치 → `processed_by` + `reason` 분리 |
| **result.processed_by** | 없음 | `{ user_id: string }` | 신규 필드 |
| **result.reason** | `process_info.reason` | 최상위 필드 | 위치 차이 |

### 개선 방안

1. **`/latest` 전용 응답 타입 신규 정의**

```typescript
interface ApprovalRequestLatestResponse {
  request: {
    id: number;
    target_source_id: number;
    status: string;
    requested_by: { user_id: string };
    requested_at: string;
    resource_total_count: number;
    resource_selected_count: number;
  };
  result: {
    request_id: number | null;
    status: string;
    processed_by: { user_id: string };
    processed_at: string;
    reason: string | null;
  };
}
```

2. **기존 `ApprovalHistoryResponse` 타입도 BFF 실제 응답에 맞게 검증 필요**
   - `approval-history` 엔드포인트의 실제 BFF 응답 구조도 `/latest`와 동일한 차이가 있을 가능성 높음
   - Swagger의 `ApprovalRequest` 스키마와 BFF 실제 응답이 다름 (swagger에는 `input_data`가 있으나 BFF 실제 응답에는 없음)
   - Swagger 기준인지 BFF 실제 응답 기준인지 확인 후 통일 필요

3. **`ApprovalRequestDetailModal` 의존성 변경**
   - 현재 `request.input_data.resource_inputs`에 의존하여 포함/제외 리소스를 표시
   - BFF 실제 응답에 `input_data`가 없으므로, `resource_total_count`/`resource_selected_count`만으로 요약 표시하거나, 별도 API로 상세 데이터를 조회하는 방식으로 변경 필요

---

## 구현 우선순위

| 순서 | 작업 | 영향 범위 |
|------|------|----------|
| 1 | `/latest` API 라우트 + BFF client + 클라이언트 함수 추가 | 신규 파일 3개 |
| 2 | `ApprovalRequestLatestResponse` 타입 정의 | `app/lib/api/index.ts` |
| 3 | `ApprovalWaitingCard`, `ApprovalApplyingBanner`에서 `/latest` API 호출로 전환 | 컴포넌트 2개 |
| 4 | `ApprovalRequestDetailModal` 응답 구조 대응 (input_data 부재) | 컴포넌트 1개 |
| 5 | 기존 `ApprovalHistoryResponse` 타입과 실제 BFF 응답 교차 검증 | 타입 + 관련 컴포넌트 |

---

## 참고

- BFF API 경로: `install/v1/target-sources/{targetSourceId}/approval-requests/latest`
- Swagger 명세: `docs/swagger/confirm.yaml` (현재 `/latest` 엔드포인트 미정의)
- 관련 GitHub Issue: #257
