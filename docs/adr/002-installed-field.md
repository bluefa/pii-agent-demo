# ADR-002: installed 필드 추가

## 상태
승인됨 (2026-02-02)

## 맥락
Azure 설치 상태 응답에서 "전체 설치 완료 여부"를 판단하는 로직이 필요했다.

**선택지:**
1. Frontend에서 모든 리소스 상태를 순회하며 계산
2. Backend에서 계산하여 `installed` 필드로 제공

## 결정
Backend에서 `installed` 필드를 계산하여 제공한다.

```typescript
interface AzureInstallationStatus {
  provider: 'Azure';
  installed: boolean;  // Backend 계산
  resources: AzureResourceStatus[];
}
```

**계산 로직:**
```typescript
const installed = resources.length > 0 &&
  resources.every(r => r.privateEndpoint.status === 'APPROVED');
```

## 결과
- Frontend 로직 단순화 (boolean 확인만 필요)
- 설치 완료 조건이 변경되어도 Backend만 수정
- 프로세스 상태 판단에 직접 활용 가능

## 관련 파일
- `lib/types/azure.ts` - `installed` 필드 추가
- `lib/mock-azure.ts` - 계산 로직 구현
- `lib/__tests__/mock-azure.test.ts` - 테스트 케이스
