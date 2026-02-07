# ADR-005: 데이터 어댑터 패턴 도입

## 상태
채택됨 (Phase 1-2 완료)

## 맥락

### 현재 구조

```
Client Component ('use client')
    ↓ app/lib/api/index.ts (fetch('/api/...'))
app/api/route.ts
    ↓ import from '@/lib/mock-*'
lib/mock-*.ts
```

현재 CSR 구조는 잘 설계되어 있다:
- 컴포넌트는 `@/lib/mock-*`를 직접 import하지 않음
- `app/lib/api/`를 통해 `app/api/`를 호출

### 문제점

`app/api/` route 파일들이 `@/lib/mock-*`를 직접 import하고 있음:

```typescript
// app/api/projects/route.ts (현재)
import { getCurrentUser, addProject, mockServiceCodes } from '@/lib/mock-data';

export async function POST(request: Request) {
  const user = getCurrentUser();           // mock 함수 직접 호출
  // ...
  addProject(newProject);                  // mock 함수 직접 호출
}
```

**문제:**
1. 프로덕션 전환 시 모든 route 파일 수정 필요 (약 48개 파일)
2. API Route가 데이터 소스(mock)를 직접 알고 있음
3. 테스트 시 데이터 계층 모킹이 어려움
4. SSR 도입 시 별도 서비스 계층 필요

## 결정

### 어댑터 패턴 도입

데이터 소스를 추상화하여 API Route가 데이터 출처를 모르게 한다.

### 목표 구조

```
app/api/route.ts
    ↓ import from '@/lib/adapters'
lib/adapters/index.ts (환경에 따라 어댑터 선택)
    ├─ mock-adapter.ts  → lib/mock-*.ts (개발)
    └─ bff-adapter.ts   → fetch(BFF_URL) (프로덕션)
```

### 구현 상세

#### 1. 어댑터 인터페이스 정의

```typescript
// lib/adapters/types.ts
import { User, Project, ServiceCode } from '@/lib/types';

export interface DataAdapter {
  // User
  getCurrentUser: () => Promise<User | null>;

  // Project
  getProjectById: (id: string) => Promise<Project | null>;
  getProjectsByServiceCode: (serviceCode: string) => Promise<Project[]>;
  addProject: (project: Project) => Promise<Project>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<Project>;

  // ServiceCode
  getServiceCodes: () => Promise<ServiceCode[]>;
  getServiceCodeByCode: (code: string) => Promise<ServiceCode | null>;

  // ... 기타 함수들
}
```

#### 2. Mock 어댑터 (개발용)

```typescript
// lib/adapters/mock-adapter.ts
import { DataAdapter } from './types';
import * as mockData from '@/lib/mock-data';
import * as mockInstallation from '@/lib/mock-installation';

export const mockAdapter: DataAdapter = {
  getCurrentUser: async () => mockData.getCurrentUser(),

  getProjectById: async (id) => mockData.getProjectById(id),

  getProjectsByServiceCode: async (serviceCode) =>
    mockData.getProjectsByServiceCode(serviceCode),

  addProject: async (project) => {
    mockData.addProject(project);
    return project;
  },

  updateProject: async (id, updates) => {
    mockData.updateProject(id, updates);
    return mockData.getProjectById(id)!;
  },

  getServiceCodes: async () => mockData.mockServiceCodes,

  getServiceCodeByCode: async (code) =>
    mockData.mockServiceCodes.find(s => s.code === code) || null,
};
```

#### 3. BFF 어댑터 (프로덕션용)

```typescript
// lib/adapters/bff-adapter.ts
import { DataAdapter } from './types';

const BFF_URL = process.env.BFF_API_URL;

const fetchWithAuth = async (path: string, options?: RequestInit) => {
  const res = await fetch(`${BFF_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // 인증 헤더 추가
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`BFF Error: ${res.status}`);
  return res.json();
};

export const bffAdapter: DataAdapter = {
  getCurrentUser: async () => {
    const data = await fetchWithAuth('/user/me');
    return data.user;
  },

  getProjectById: async (id) => {
    const data = await fetchWithAuth(`/projects/${id}`);
    return data.project;
  },

  addProject: async (project) => {
    const data = await fetchWithAuth('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
    return data.project;
  },

  // ... 기타 구현
};
```

#### 4. 어댑터 선택 (환경 기반)

```typescript
// lib/adapters/index.ts
import { mockAdapter } from './mock-adapter';
import { bffAdapter } from './bff-adapter';
import { DataAdapter } from './types';

export const dataAdapter: DataAdapter =
  process.env.USE_MOCK_DATA === 'true'
    ? mockAdapter
    : bffAdapter;

export type { DataAdapter } from './types';
```

#### 5. API Route에서 사용

```typescript
// app/api/projects/route.ts (리팩토링 후)
import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';
import { createInitialProjectStatus } from '@/lib/process';

export async function POST(request: Request) {
  const user = await dataAdapter.getCurrentUser();  // 어댑터 사용

  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '관리자만 과제를 등록할 수 있습니다.' },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { projectCode, serviceCode, cloudProvider, description } = body;

  // 서비스 코드 검증
  const service = await dataAdapter.getServiceCodeByCode(serviceCode);
  if (!service) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: '존재하지 않는 서비스 코드입니다.' },
      { status: 400 }
    );
  }

  const newProject = { /* ... */ };
  const created = await dataAdapter.addProject(newProject);  // 어댑터 사용

  return NextResponse.json({ project: created }, { status: 201 });
}
```

### 환경 변수

```bash
# .env.development
USE_MOCK_DATA=true

# .env.production
USE_MOCK_DATA=false
BFF_API_URL=https://api.example.com
```

### 계층 구조 (최종)

```
app/
├── api/                    # API Routes (CSR용)
│   └── route.ts           # dataAdapter 사용
├── lib/
│   └── api/               # 클라이언트 fetch 함수
│       └── index.ts       # fetch('/api/...')
│
lib/
├── adapters/              # 데이터 어댑터 (신규)
│   ├── index.ts          # 어댑터 선택
│   ├── types.ts          # 인터페이스 정의
│   ├── mock-adapter.ts   # 개발용
│   └── bff-adapter.ts    # 프로덕션용
├── mock-*.ts              # Mock 데이터 (기존 유지)
└── types/                 # 타입 정의
```

## 결과

### 긍정적

| 이점 | 설명 |
|------|------|
| **프로덕션 전환 용이** | 환경변수 변경만으로 mock ↔ BFF 전환. API Route 코드 수정 없음 |
| **관심사 분리** | API Route는 "무엇을" 하는지만 알고, "어디서" 데이터를 가져오는지 모름 |
| **테스트 용이** | 테스트용 어댑터 주입 가능 |
| **일관된 인터페이스** | mock이든 BFF든 동일한 함수 시그니처 |
| **SSR 확장 가능** | Server Component에서도 동일한 어댑터 사용 가능 |

### 부정적

| 단점 | 완화 방안 |
|------|----------|
| 코드량 증가 | 초기 설정 후 유지보수 비용 낮음 |
| 추상화 비용 | 인터페이스 명확히 정의하여 복잡도 관리 |
| 마이그레이션 작업 | 점진적 마이그레이션 가능 |

### SSR 확장 시

```typescript
// app/projects/[id]/page.tsx (Server Component)
import { dataAdapter } from '@/lib/adapters';

const ProjectPage = async ({ params }) => {
  const project = await dataAdapter.getProjectById(params.id);  // 동일한 어댑터
  return <ProjectDetail project={project} />;
};
```

SSR과 CSR이 동일한 어댑터를 공유하므로 코드 중복 없음.

## 마이그레이션 계획

### Phase 1: 어댑터 인프라 구축
1. `lib/adapters/` 디렉토리 생성
2. `types.ts` - 인터페이스 정의
3. `mock-adapter.ts` - 기존 mock 함수 래핑
4. `index.ts` - 어댑터 export

### Phase 2: API Routes 점진적 마이그레이션
1. 핵심 routes 먼저 전환 (projects, user)
2. Provider별 routes 전환 (aws, azure, idc)
3. 기타 routes 전환

### Phase 3: BFF 어댑터 구현
1. BFF API 명세에 맞춰 `bff-adapter.ts` 구현
2. 통합 테스트
3. 프로덕션 배포

### ESLint 규칙 추가 (선택)

```javascript
// .eslintrc.js
rules: {
  'no-restricted-imports': ['error', {
    patterns: [{
      group: ['@/lib/mock-*'],
      importNames: ['*'],
      message: 'app/api/에서 mock 직접 import 금지. @/lib/adapters 사용',
    }],
  }],
}
```

## 관련 파일

### 신규 생성
- `lib/adapters/index.ts`
- `lib/adapters/types.ts`
- `lib/adapters/mock-adapter.ts`
- `lib/adapters/bff-adapter.ts`

### 수정 대상
- `app/api/**/*.ts` - 모든 API Routes (약 48개 파일)

### 기존 유지
- `lib/mock-*.ts` - Mock 데이터 (어댑터에서 사용)
- `app/lib/api/` - 클라이언트 fetch 함수 (변경 없음)
