# ADR-007: API Client 패턴 도입

## 상태
제안됨

## 맥락

### 현재 구조 (ADR-005 이후)

```
Client Component
    ↓ app/lib/api/index.ts (fetch('/api/...'))
app/api/route.ts
    ↓ dataAdapter (mock or bff)
lib/adapters/mock-adapter.ts  |  lib/adapters/bff-adapter.ts
```

ADR-005에서 `dataAdapter` 추상화를 도입했지만, `app/api/` route.ts 파일들은 여전히 mock 전용 비즈니스 로직(인증 확인, 프로젝트 조회, 권한 검증 등)을 직접 포함하고 있다.

### 문제점

1. **route.ts = mock 전용 코드**: route.ts 내부의 `getCurrentUser()`, `getProjectById()`, 권한 체크 등은 모두 mock 환경에서만 의미 있는 로직이다. Production에서는 BFF가 인증/인가/비즈니스 로직을 모두 처리한다.

2. **개발자 혼란**: 다른 개발자가 route.ts를 보면 이 코드가 production에서도 실행되는 것으로 오해할 수 있다.

3. **이중 추상화**: `dataAdapter`는 데이터 레벨 추상화이고, `bff-adapter.ts`에 183개 스텁 메서드를 구현해야 한다. Production에서는 단순 프록시만 하면 되는데 메서드별 구현이 불필요하다.

## 결정

### API Client 패턴

route.ts에서 mock 로직을 제거하고, `client.method()` 호출만 남긴다. `client`는 환경변수에 따라 mockClient 또는 bffClient를 선택한다.

### 목표 구조

```
Client Component
    ↓ app/lib/api/index.ts (fetch('/api/...'))
app/api/route.ts
    ↓ client.projects.get(projectId)
lib/api-client/index.ts (환경변수로 선택)
    ↓                           ↓
mockClient                   bffClient
(기존 route 로직 이동)        (BFF 프록시)
```

### route.ts Before / After

**Before:**
```typescript
export async function GET(request: Request, { params }) {
  const user = await dataAdapter.getCurrentUser();
  const { projectId } = await params;
  if (!user) { return NextResponse.json({...}, {status: 401}); }
  const project = await dataAdapter.getProjectById(projectId);
  if (!project) { return NextResponse.json({...}, {status: 404}); }
  // ... permission check ...
  return NextResponse.json({ project });
}
```

**After:**
```typescript
import { client } from '@/lib/api-client';

export const GET = async (_request: Request, { params }) => {
  const { projectId } = await params;
  return client.projects.get(projectId);
};
```

### 파일 구조

```
lib/api-client/
  index.ts              # client export (환경변수로 선택)
  types.ts              # ApiClient 인터페이스
  bff-client.ts         # BFF 프록시 (production)
  mock/
    index.ts            # mockClient 조립
    projects.ts         # project mock 로직
    users.ts            # user mock 로직
    sdu.ts              # sdu mock 로직
    ...                 # 도메인별 확장
```

### ADR-005와의 관계

- ADR-005 (`lib/adapters/`)는 ADR-007 도입 후 완전 제거됨 (Superseded).
- mockClient가 `lib/mock-*.ts`를 직접 import하여 이중 추상화 해소.
- `bff-adapter.ts`의 스텁 메서드들은 `bffClient`의 HTTP 프록시로 대체.

## 결과

### 장점
- route.ts가 깔끔해져 production 코드와 혼동 없음
- BFF 전환 시 route.ts 변경 불필요 (환경변수만 변경)
- mock 로직이 `lib/api-client/mock/`에 집중되어 관리 용이

### 단점
- mock 로직 이동에 따른 초기 마이그레이션 작업
- ApiClient 인터페이스에 모든 메서드 정의 필요

### 마이그레이션 계획
- Phase 1: 인프라 + 파일럿 4개 route (이 PR)
- Phase 2: 나머지 ~61개 route 전환 (후속 PR)
- Phase 3: mock 보일러플레이트 정리 + bff-adapter.ts 스텁 제거 (선택)

## 관련 파일
- `lib/api-client/` — 신규 디렉토리
- `lib/adapters/` — 기존 (mockClient 내부에서 계속 사용)
- `app/api/` — route.ts 파일들 (client 호출로 전환)
