# ADR-005: API Routes 데이터 접근 계층 분리

## 상태
제안됨

## 맥락

현재 API Routes(`app/api/`)에서 `@/lib/mock-*` 모듈을 직접 import하여 데이터를 조작하고 있다.

```typescript
// 현재 (잘못된 패턴)
import { getProjectById } from '@/lib/mock-data';
import { getInstallationStatus } from '@/lib/mock-installation';

export const GET = async () => {
  const project = getProjectById(projectId);  // lib 직접 호출
};
```

**문제점:**
1. API Routes는 BFF(Backend for Frontend) 역할 - 실제 백엔드 API를 호출해야 함
2. `lib/mock-*`은 개발용 시뮬레이션 데이터 - 프로덕션에서 교체되어야 함
3. 데이터 계층과 API 계층이 강결합되어 있음
4. 테스트 시 데이터 계층 모킹이 어려움

## 결정

### 1. API Routes에서 `@/lib/mock-*` 직접 import 금지

API Routes는 다음 중 하나의 방식으로 데이터에 접근해야 한다:

**Option A: 서비스 계층 도입 (권장)**
```typescript
// lib/services/project-service.ts
export const projectService = {
  getById: async (id: string) => {
    // 개발: mock-data 사용
    // 프로덕션: 실제 API 호출
    if (process.env.USE_MOCK_DATA) {
      return mockGetProjectById(id);
    }
    return fetch(`${API_URL}/projects/${id}`);
  }
};

// app/api/projects/[id]/route.ts
import { projectService } from '@/lib/services/project-service';
export const GET = async () => {
  const project = await projectService.getById(projectId);
};
```

**Option B: 환경별 어댑터 패턴**
```typescript
// lib/adapters/index.ts
export const dataAdapter = process.env.USE_MOCK_DATA
  ? mockAdapter
  : apiAdapter;
```

### 2. 계층 구조

```
app/api/          → API Routes (BFF)
  ↓
lib/services/     → 서비스 계층 (비즈니스 로직)
  ↓
lib/adapters/     → 데이터 어댑터 (mock 또는 실제 API)
  ↓
lib/mock-*        → Mock 데이터 (개발 전용)
```

### 3. import 규칙

| 위치 | 허용 import | 금지 import |
|------|-------------|-------------|
| `app/api/` | `@/lib/services/*` | `@/lib/mock-*` |
| `lib/services/` | `@/lib/adapters/*` | - |
| `lib/adapters/` | `@/lib/mock-*` (조건부) | - |

## 결과

### 긍정적
- 프로덕션 전환 시 API Routes 수정 불필요
- 데이터 계층 테스트/모킹 용이
- 명확한 책임 분리

### 부정적
- 추가 추상화 레이어로 코드량 증가
- 초기 개발 속도 저하

### 마이그레이션
1. `lib/services/` 디렉토리 생성
2. 서비스 함수 정의 (mock 래핑)
3. API Routes에서 서비스 import로 변경
4. ESLint 규칙 추가하여 직접 import 방지

## 관련 파일
- `app/api/**/*.ts` - 모든 API Routes
- `lib/mock-*.ts` - Mock 데이터 모듈
- `lib/services/` - 신규 생성 필요
