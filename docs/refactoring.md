# PII Agent 관리 시스템 - 코드 흐름 및 Mock API 분리 방안

## 1. 현재 전체 코드 흐름

### 1.1 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ AdminDash   │  │ ProjectDe-  │  │ Components              │ │
│  │ board.tsx   │  │ tail.tsx    │  │ (ProcessStatusCard 등)  │ │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘ │
│         │                │                      │               │
│         └────────────────┼──────────────────────┘               │
│                          │                                      │
│                          ▼                                      │
│              ┌───────────────────────┐                          │
│              │   app/lib/api.ts      │  ← API 클라이언트        │
│              │   (fetch 함수들)      │                          │
│              └───────────┬───────────┘                          │
└──────────────────────────┼──────────────────────────────────────┘
                           │ HTTP Request
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                 Next.js API Routes (Server)                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  app/api/projects/[projectId]/route.ts                     │ │
│  │  app/api/projects/[projectId]/approve/route.ts             │ │
│  │  app/api/projects/[projectId]/test-connection/route.ts     │ │
│  │  ... (총 17개 엔드포인트)                                   │ │
│  └─────────────────────────┬──────────────────────────────────┘ │
│                            │ import                              │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  lib/mock-data.ts                                          │ │
│  │  - getCurrentUser(), getProjectById(), updateProject()     │ │
│  │  - simulateConnectionTest() 등 비즈니스 로직               │ │
│  └─────────────────────────┬──────────────────────────────────┘ │
│                            │ import                              │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  lib/mock-store.ts                                         │ │
│  │  - globalThis.__piiAgentMockStore (글로벌 메모리 저장소)   │ │
│  │  - users, serviceCodes, projects, credentials, currentUser │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 데이터 흐름 예시

#### 프로젝트 상세 조회
```
1. Frontend: getProject(projectId) 호출
2. app/lib/api.ts: fetch('/api/projects/{id}')
3. app/api/projects/[projectId]/route.ts: GET 핸들러 실행
4. lib/mock-data.ts: getProjectById(id) → getStore().projects.find()
5. lib/mock-store.ts: globalThis.__piiAgentMockStore에서 조회
6. Response: NextResponse.json({ project })
7. Frontend: 상태 업데이트 → UI 렌더링
```

#### 연결 테스트 실행 (상태 변경)
```
1. Frontend: runConnectionTest(projectId, resourceCredentials)
2. API Route: test-connection/route.ts
3. Mock: simulateConnectionTest() (80% 성공률 시뮬레이션)
4. Mock: updateProject() → Store 데이터 수정
5. Response: { success, project, history }
6. Frontend: setProject(updated) → UI 업데이트
```

### 1.3 주요 파일 역할

| 파일 | 역할 |
|------|------|
| `app/lib/api.ts` | Frontend API 클라이언트 (fetch 래퍼) |
| `app/api/**/*.ts` | Next.js API Route 핸들러 (17개) |
| `lib/mock-data.ts` | Mock 비즈니스 로직 + 초기 데이터 |
| `lib/mock-store.ts` | 글로벌 메모리 저장소 |
| `lib/types.ts` | 공용 타입 정의 |

---

## 2. 현재 문제점

### 2.1 Mock 데이터가 Next.js 내부에 결합됨

```typescript
// app/api/projects/[projectId]/route.ts
import { getCurrentUser, getProjectById } from '@/lib/mock-data';  // 직접 import

export async function GET(request, { params }) {
  const project = getProjectById(id);  // 서버 내부에서 직접 호출
  return NextResponse.json({ project });
}
```

**문제:**
- 실제 API 서버로 교체할 때 모든 Route 파일 수정 필요
- API 테스트 시 Next.js 서버 전체를 띄워야 함
- Mock 로직과 API 라우팅이 혼재

### 2.2 글로벌 상태의 불안정성

```typescript
// lib/mock-store.ts
declare global {
  var __piiAgentMockStore: Store | undefined;
}
```

**문제:**
- Next.js 서버 재시작 시 데이터 초기화
- Hot reload 시 데이터 유실 가능
- 여러 탭/클라이언트 간 상태 동기화 불가

### 2.3 테스트 어려움

- API 엔드포인트만 독립적으로 테스트 불가
- Mock 데이터 상태를 외부에서 제어 불가
- E2E 테스트 시 데이터 초기화 어려움

---

## 3. Mock API 서버 분리 방안

### 3.1 목표 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│              ┌───────────────────────┐                          │
│              │   app/lib/api.ts      │                          │
│              │   BASE_URL 변경만     │                          │
│              └───────────┬───────────┘                          │
└──────────────────────────┼──────────────────────────────────────┘
                           │ HTTP Request
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│              Mock API Server (별도 프로세스)                      │
│              - Express.js 또는 json-server                       │
│              - Port: 4000                                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  mock-server/                                              │ │
│  │  ├── index.ts          (서버 엔트리)                       │ │
│  │  ├── routes/           (API 라우트)                        │ │
│  │  │   ├── projects.ts                                       │ │
│  │  │   ├── users.ts                                          │ │
│  │  │   └── services.ts                                       │ │
│  │  ├── store.ts          (메모리 저장소)                     │ │
│  │  ├── data.ts           (초기 데이터)                       │ │
│  │  └── handlers/         (비즈니스 로직)                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 구현 방안 A: Express.js 기반 분리

#### 폴더 구조

```
pii-agent-demo/
├── app/                    # Next.js Frontend (변경 최소화)
├── lib/
│   └── types.ts           # 공용 타입 (공유)
├── mock-server/           # 새로 생성
│   ├── package.json
│   ├── tsconfig.json
│   ├── index.ts           # Express 서버 엔트리
│   ├── store.ts           # 메모리 저장소 (기존 mock-store.ts 이동)
│   ├── data.ts            # 초기 데이터 (기존 mock-data.ts에서 분리)
│   ├── handlers/          # 비즈니스 로직
│   │   ├── projects.ts
│   │   ├── users.ts
│   │   ├── services.ts
│   │   └── connection-test.ts
│   └── routes/            # API 라우트 정의
│       ├── index.ts
│       ├── projects.ts
│       ├── users.ts
│       └── services.ts
└── package.json           # scripts 추가
```

#### 서버 엔트리 (mock-server/index.ts)

```typescript
import express from 'express';
import cors from 'cors';
import { projectsRouter } from './routes/projects';
import { usersRouter } from './routes/users';
import { servicesRouter } from './routes/services';
import { initializeStore } from './store';

const app = express();
const PORT = process.env.MOCK_PORT || 4000;

// 미들웨어
app.use(cors());
app.use(express.json());

// 데이터 초기화
initializeStore();

// 라우트
app.use('/api/projects', projectsRouter);
app.use('/api/user', usersRouter);
app.use('/api/users', usersRouter);
app.use('/api/services', servicesRouter);

// 개발 도구: 데이터 리셋
app.post('/api/dev/reset', (req, res) => {
  initializeStore();
  res.json({ success: true, message: 'Store reset' });
});

app.listen(PORT, () => {
  console.log(`Mock API Server running on http://localhost:${PORT}`);
});
```

#### 저장소 (mock-server/store.ts)

```typescript
import { User, ServiceCode, Project, DBCredential } from '../lib/types';
import { initialUsers, initialServiceCodes, initialProjects, initialCredentials } from './data';

interface Store {
  users: User[];
  serviceCodes: ServiceCode[];
  projects: Project[];
  credentials: DBCredential[];
  currentUserId: string;
}

let store: Store;

export const initializeStore = () => {
  store = {
    users: JSON.parse(JSON.stringify(initialUsers)),
    serviceCodes: JSON.parse(JSON.stringify(initialServiceCodes)),
    projects: JSON.parse(JSON.stringify(initialProjects)),
    credentials: JSON.parse(JSON.stringify(initialCredentials)),
    currentUserId: 'admin-1',
  };
};

export const getStore = () => store;

// CRUD 헬퍼
export const getProjectById = (id: string) =>
  store.projects.find(p => p.id === id);

export const updateProject = (id: string, updates: Partial<Project>) => {
  const index = store.projects.findIndex(p => p.id === id);
  if (index === -1) return null;

  store.projects[index] = {
    ...store.projects[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  return store.projects[index];
};

// ... 기타 헬퍼 함수
```

#### Frontend 변경 (app/lib/api.ts)

```typescript
// 환경변수로 API 서버 URL 설정
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// 나머지 코드는 동일
export const getProject = async (id: string): Promise<Project> => {
  const res = await fetch(`${BASE_URL}/projects/${id}`);
  // ...
};
```

#### package.json scripts 추가

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:mock": "ts-node mock-server/index.ts",
    "dev:all": "concurrently \"npm run dev\" \"npm run dev:mock\"",
    "test:api": "jest mock-server/__tests__"
  }
}
```

### 3.3 구현 방안 B: json-server 활용 (간단한 경우)

비즈니스 로직이 복잡하지 않은 경우 json-server 활용 가능:

```bash
npm install -D json-server
```

```json
// mock-server/db.json
{
  "users": [...],
  "projects": [...],
  "serviceCodes": [...],
  "credentials": [...]
}
```

```javascript
// mock-server/server.js
const jsonServer = require('json-server');
const server = jsonServer.create();
const router = jsonServer.router('mock-server/db.json');
const middlewares = jsonServer.defaults();

// 커스텀 라우트
server.use((req, res, next) => {
  // 비즈니스 로직 추가
  next();
});

server.use(middlewares);
server.use('/api', router);
server.listen(4000);
```

**한계:** 복잡한 비즈니스 로직(연결 테스트 시뮬레이션 등)은 커스텀 미들웨어로 구현 필요

### 3.4 구현 방안 C: MSW (Mock Service Worker) 활용

브라우저/Node.js 환경에서 네트워크 레벨 모킹:

```typescript
// mocks/handlers.ts
import { http, HttpResponse } from 'msw';
import { getStore, updateProject } from './store';

export const handlers = [
  http.get('/api/projects/:id', ({ params }) => {
    const project = getStore().projects.find(p => p.id === params.id);
    return HttpResponse.json({ project });
  }),

  http.post('/api/projects/:id/approve', async ({ params }) => {
    const updated = updateProject(params.id as string, {
      processStatus: ProcessStatus.INSTALLING,
      approvedAt: new Date().toISOString(),
    });
    return HttpResponse.json({ project: updated });
  }),
];
```

```typescript
// mocks/browser.ts (브라우저용)
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
export const worker = setupWorker(...handlers);

// mocks/server.ts (Node.js/테스트용)
import { setupServer } from 'msw/node';
import { handlers } from './handlers';
export const server = setupServer(...handlers);
```

**장점:**
- Next.js API Routes 완전 제거 가능
- 테스트 환경에서 동일 핸들러 재사용
- 네트워크 탭에서 요청/응답 확인 가능

---

## 4. 마이그레이션 단계

### Phase 1: 준비 (현재 코드 정리)

1. `lib/mock-data.ts`에서 초기 데이터와 비즈니스 로직 분리
2. `lib/types.ts`를 독립 패키지로 분리 가능하도록 정리
3. 각 API Route의 비즈니스 로직을 함수로 추출

### Phase 2: Mock 서버 구축

1. `mock-server/` 폴더 생성
2. Express 서버 설정
3. 기존 비즈니스 로직을 handlers/로 이동
4. 라우트 정의

### Phase 3: Frontend 연동

1. `.env.local`에 `NEXT_PUBLIC_API_URL=http://localhost:4000` 설정
2. 기존 `app/api/` 폴더는 프록시 또는 삭제
3. 동작 테스트

### Phase 4: 정리

1. 기존 `app/api/` 라우트 제거
2. `lib/mock-data.ts`, `lib/mock-store.ts` 제거
3. 문서 업데이트

---

## 5. 환경별 설정

### 개발 환경 (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 테스트 환경 (.env.test)

```env
NEXT_PUBLIC_API_URL=http://localhost:4001
```

### 프로덕션 환경 (.env.production)

```env
NEXT_PUBLIC_API_URL=https://api.production.com
```

---

## 6. 권장 방안

프로젝트 특성상 **방안 A (Express.js 기반 분리)**를 권장합니다.

**이유:**
1. 연결 테스트 시뮬레이션 등 복잡한 비즈니스 로직 존재
2. 상태 머신(ProcessStatus) 관리가 필요
3. 개발 도구(사용자 전환, 데이터 리셋)가 필요
4. 향후 실제 API 서버 개발 시 동일 구조 재사용 가능

**구현 우선순위:**
1. `mock-server/store.ts` - 저장소 분리
2. `mock-server/handlers/` - 비즈니스 로직 이동
3. `mock-server/routes/` - Express 라우트 정의
4. Frontend `BASE_URL` 환경변수 적용
5. 기존 `app/api/` 제거

---

## 7. 예상 작업량

| 작업 | 예상 파일 수 |
|------|-------------|
| mock-server 기본 구조 | 5개 |
| 핸들러 이동 | 8개 |
| 라우트 정의 | 4개 |
| Frontend 수정 | 1개 |
| 기존 API Route 삭제 | 17개 |

---

## 8. 추가 고려사항

### 8.1 데이터 영속성

현재 메모리 저장소는 서버 재시작 시 초기화됩니다. 필요시:

```typescript
// mock-server/store.ts
import fs from 'fs';

const SNAPSHOT_PATH = './mock-server/snapshot.json';

export const saveSnapshot = () => {
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(store, null, 2));
};

export const loadSnapshot = () => {
  if (fs.existsSync(SNAPSHOT_PATH)) {
    store = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf-8'));
  }
};
```

### 8.2 테스트 데이터 시나리오

```typescript
// mock-server/scenarios/
export const scenarioAllSteps = () => {
  // 각 단계별 프로젝트 1개씩
};

export const scenarioConnectionFail = () => {
  // 연결 실패 케이스
};

export const scenarioEmptyData = () => {
  // 빈 데이터
};
```

### 8.3 API 응답 지연 시뮬레이션

```typescript
// mock-server/middleware/delay.ts
export const delayMiddleware = (ms: number) => {
  return (req, res, next) => {
    setTimeout(next, ms);
  };
};

// 사용
app.use('/api/projects/:id/test-connection', delayMiddleware(2000));
```
