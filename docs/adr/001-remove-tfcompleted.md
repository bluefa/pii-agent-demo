# ADR-001: tfCompleted 필드 제거

## 상태
승인됨 (2026-02-02)

## 맥락
Azure 리소스 상태 모델에서 `tfCompleted` (boolean)와 `privateEndpoint.status` (enum)가 중복 정보를 표현하고 있었다.

```typescript
// 변경 전
interface AzureResourceStatus {
  tfCompleted: boolean;  // TF 설치 완료 여부
  privateEndpoint: {
    status: 'NOT_REQUESTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  };
}
```

문제점:
- `tfCompleted: true`이면서 `status: NOT_REQUESTED`인 경우가 논리적으로 불가능
- 두 필드 간 동기화 관리 필요
- Frontend에서 두 필드를 모두 확인해야 함

## 결정
`tfCompleted` 필드를 제거하고, `privateEndpoint.status`로 TF 완료 여부를 판단한다.

**TF 완료 판단 로직:**
| status | TF 완료 여부 |
|--------|-------------|
| `NOT_REQUESTED` | 미완료 |
| `PENDING_APPROVAL` | 완료 |
| `APPROVED` | 완료 |
| `REJECTED` | 완료 |

## 결과
- 데이터 모델 단순화
- Frontend 해석 로직 단순화
- 상태 동기화 문제 제거

## 관련 파일
- `lib/types/azure.ts` - 타입 정의
- `lib/mock-azure.ts` - Mock 헬퍼
- `docs/api/providers/azure.md` - API 명세
