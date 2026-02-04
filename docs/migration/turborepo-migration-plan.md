# Turborepo Migration Plan

## 개요

단일 Next.js 프로젝트를 Turborepo 기반 Monorepo로 전환하여 BFF 서버를 분리합니다.

## 현재 구조

```
pii-agent-demo/
├── app/
│   ├── api/              # API Routes (48개 디렉토리)
│   ├── components/
│   ├── projects/
│   └── ...
├── lib/
│   ├── mock-*.ts         # BFF로 이동 대상 (8개)
│   ├── types.ts          # 공유 타입
│   ├── process/
│   ├── constants/
│   └── ...
├── docs/
├── public/
└── package.json
```

## 목표 구조

```
pii-agent-demo/
├── apps/
│   ├── web/                      # Next.js 앱
│   │   ├── app/
│   │   │   ├── api/              # BFF 프록시 (fetch 호출)
│   │   │   ├── components/
│   │   │   ├── projects/
│   │   │   └── ...
│   │   ├── lib/
│   │   │   ├── api-client.ts     # BFF 클라이언트
│   │   │   ├── process/
│   │   │   ├── theme.ts
│   │   │   └── utils/
│   │   ├── public/
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── bff/                      # BFF 서버
│       ├── src/
│       │   ├── index.ts          # 엔트리포인트
│       │   ├── routes/           # API 라우트
│       │   │   ├── projects.ts
│       │   │   ├── services.ts
│       │   │   ├── aws/
│       │   │   ├── azure/
│       │   │   └── idc/
│       │   ├── services/         # 비즈니스 로직 (mock-*.ts)
│       │   │   ├── project-service.ts
│       │   │   ├── scan-service.ts
│       │   │   ├── installation-service.ts
│       │   │   └── ...
│       │   └── store/            # 데이터 저장소
│       │       ├── index.ts
│       │       └── initial-data.ts
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── shared/                   # 공유 패키지
│       ├── src/
│       │   ├── types/            # 공유 타입
│       │   │   ├── index.ts
│       │   │   ├── project.ts
│       │   │   ├── resource.ts
│       │   │   └── ...
│       │   └── constants/        # 공유 상수
│       │       └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── docs/                         # 문서 (루트 유지)
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.json                 # 루트 tsconfig (base)
```

---

## 마이그레이션 단계

### Phase 1: Turborepo 초기화

#### 1.1 패키지 매니저 변경 (npm → pnpm)
```bash
# pnpm 설치 (없는 경우)
npm install -g pnpm

# node_modules 삭제
rm -rf node_modules package-lock.json

# pnpm으로 재설치
pnpm install
```

#### 1.2 Turborepo 설치 및 설정
```bash
pnpm add -D turbo -w
```

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "persistent": true,
      "cache": false
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

```json
// 루트 package.json
{
  "name": "pii-agent-demo",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

#### 1.3 폴더 구조 생성
```bash
mkdir -p apps/web apps/bff packages/shared/src
```

---

### Phase 2: 공유 패키지 생성 (packages/shared)

#### 2.1 패키지 초기화
```json
// packages/shared/package.json
{
  "name": "@pii-agent/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint src/"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

```json
// packages/shared/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

#### 2.2 타입 이동
```
lib/types.ts → packages/shared/src/types/index.ts
lib/types/*.ts → packages/shared/src/types/
lib/constants/ → packages/shared/src/constants/
```

#### 2.3 export 설정
```typescript
// packages/shared/src/index.ts
export * from './types';
export * from './constants';
```

---

### Phase 3: Next.js 앱 이동 (apps/web)

#### 3.1 파일 이동
```bash
# 기존 파일 이동
mv app apps/web/
mv public apps/web/
mv next.config.ts apps/web/
mv next-env.d.ts apps/web/
mv postcss.config.mjs apps/web/
mv tailwind.config.* apps/web/  # 있는 경우

# lib 중 web 전용 파일만 이동
mkdir -p apps/web/lib
mv lib/theme.ts apps/web/lib/
mv lib/process apps/web/lib/
mv lib/utils apps/web/lib/
mv lib/policies apps/web/lib/
```

#### 3.2 패키지 설정
```json
// apps/web/package.json
{
  "name": "@pii-agent/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@pii-agent/shared": "workspace:*",
    "next": "16.1.4",
    "react": "19.2.3",
    "react-dom": "19.2.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.1.4",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

#### 3.3 import 경로 수정
```typescript
// Before
import { Project } from '@/lib/types';

// After
import { Project } from '@pii-agent/shared';
```

#### 3.4 tsconfig 설정
```json
// apps/web/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"],
      "@pii-agent/shared": ["../../packages/shared/src"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

### Phase 4: BFF 서버 생성 (apps/bff)

#### 4.1 Hono 기반 서버 초기화
```json
// apps/bff/package.json
{
  "name": "@pii-agent/bff",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@pii-agent/shared": "workspace:*",
    "@hono/node-server": "^1.8.0",
    "hono": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "tsx": "^4.0.0",
    "typescript": "^5"
  }
}
```

#### 4.2 서버 엔트리포인트
```typescript
// apps/bff/src/index.ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { projectRoutes } from './routes/projects';
import { serviceRoutes } from './routes/services';
// ... 기타 routes

const app = new Hono();

app.use('/*', cors({
  origin: 'http://localhost:3000',
}));

app.route('/projects', projectRoutes);
app.route('/services', serviceRoutes);
// ... 기타 routes

serve({
  fetch: app.fetch,
  port: 4000,
}, (info) => {
  console.log(`BFF server running at http://localhost:${info.port}`);
});
```

#### 4.3 Mock 파일 이동 및 변환
```
lib/mock-store.ts      → apps/bff/src/store/index.ts
lib/mock-data.ts       → apps/bff/src/services/data-service.ts
lib/mock-scan.ts       → apps/bff/src/services/scan-service.ts
lib/mock-installation.ts → apps/bff/src/services/installation-service.ts
lib/mock-azure.ts      → apps/bff/src/services/azure-service.ts
lib/mock-idc.ts        → apps/bff/src/services/idc-service.ts
lib/mock-history.ts    → apps/bff/src/services/history-service.ts
lib/mock-service-settings.ts → apps/bff/src/services/settings-service.ts
```

#### 4.4 라우트 구현 예시
```typescript
// apps/bff/src/routes/projects.ts
import { Hono } from 'hono';
import { getProjectById, getProjects } from '../services/data-service';

export const projectRoutes = new Hono();

projectRoutes.get('/', (c) => {
  const projects = getProjects();
  return c.json(projects);
});

projectRoutes.get('/:id', (c) => {
  const project = getProjectById(c.req.param('id'));
  if (!project) {
    return c.json({ error: 'NOT_FOUND' }, 404);
  }
  return c.json(project);
});

// ... 기타 엔드포인트
```

---

### Phase 5: API Routes 전환 (apps/web/app/api)

#### 5.1 BFF 클라이언트 생성
```typescript
// apps/web/lib/api-client.ts
const BFF_URL = process.env.BFF_URL || 'http://localhost:4000';

export const bffClient = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BFF_URL}${path}`);
    if (!res.ok) throw new Error(`BFF Error: ${res.status}`);
    return res.json();
  },

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BFF_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`BFF Error: ${res.status}`);
    return res.json();
  },

  // PUT, DELETE 등
};
```

#### 5.2 API Route 전환 예시
```typescript
// Before: apps/web/app/api/projects/[projectId]/route.ts
import { getProjectById } from '@/lib/mock-data';

export const GET = async (req, { params }) => {
  const { projectId } = await params;
  const project = getProjectById(projectId);
  return NextResponse.json(project);
};

// After: apps/web/app/api/projects/[projectId]/route.ts
import { bffClient } from '@/lib/api-client';

export const GET = async (req, { params }) => {
  const { projectId } = await params;
  const project = await bffClient.get(`/projects/${projectId}`);
  return NextResponse.json(project);
};
```

#### 5.3 전환 대상 (48개 → 그룹별 정리)

| 그룹 | 파일 수 | BFF 엔드포인트 |
|------|---------|----------------|
| projects | 15 | `/projects/*` |
| services | 8 | `/services/*` |
| aws | 6 | `/aws/*` |
| azure | 8 | `/azure/*` |
| idc | 6 | `/idc/*` |
| v2/scan | 4 | `/v2/projects/*/scan/*` |
| user | 3 | `/user/*` |

---

### Phase 6: 환경 변수 및 설정

#### 6.1 환경 변수
```bash
# apps/web/.env.local
BFF_URL=http://localhost:4000

# apps/bff/.env.local
PORT=4000
```

#### 6.2 개발 서버 동시 실행
```bash
# 루트에서 실행
pnpm dev

# 또는 개별 실행
pnpm --filter @pii-agent/web dev
pnpm --filter @pii-agent/bff dev
```

---

## 체크리스트

### Phase 1: Turborepo 초기화
- [ ] pnpm 설치 및 전환
- [ ] turbo.json 생성
- [ ] pnpm-workspace.yaml 생성
- [ ] 루트 package.json 수정
- [ ] 폴더 구조 생성 (apps/, packages/)

### Phase 2: 공유 패키지 (packages/shared)
- [ ] package.json 생성
- [ ] tsconfig.json 생성
- [ ] lib/types.ts 이동
- [ ] lib/constants/ 이동
- [ ] export 설정

### Phase 3: Next.js 앱 (apps/web)
- [ ] 파일 이동 (app/, public/, config 파일들)
- [ ] lib/ 중 web 전용 파일 이동
- [ ] package.json 생성
- [ ] tsconfig.json 수정
- [ ] import 경로 수정 (@pii-agent/shared)
- [ ] 빌드 확인

### Phase 4: BFF 서버 (apps/bff)
- [ ] Hono 서버 초기화
- [ ] lib/mock-*.ts 이동 및 서비스로 변환
- [ ] 라우트 구현 (7개 그룹)
- [ ] CORS 설정
- [ ] 서버 실행 확인

### Phase 5: API Routes 전환
- [ ] bffClient 생성
- [ ] projects 그룹 전환 (15개)
- [ ] services 그룹 전환 (8개)
- [ ] aws 그룹 전환 (6개)
- [ ] azure 그룹 전환 (8개)
- [ ] idc 그룹 전환 (6개)
- [ ] v2/scan 그룹 전환 (4개)
- [ ] user 그룹 전환 (3개)

### Phase 6: 마무리
- [ ] 환경 변수 설정
- [ ] `pnpm dev` 동시 실행 확인
- [ ] 전체 기능 테스트
- [ ] 기존 lib/mock-*.ts 삭제
- [ ] 문서 업데이트

---

## 예상 일정

| Phase | 작업 | 예상 공수 |
|-------|------|----------|
| 1 | Turborepo 초기화 | 2시간 |
| 2 | 공유 패키지 생성 | 2시간 |
| 3 | Next.js 앱 이동 | 3시간 |
| 4 | BFF 서버 생성 | 4시간 |
| 5 | API Routes 전환 (48개) | 6~8시간 |
| 6 | 마무리 및 테스트 | 2시간 |
| **합계** | | **2~3일** |

---

## 롤백 계획

각 Phase 완료 후 커밋하여, 문제 발생 시 해당 커밋으로 롤백 가능하도록 합니다.

```bash
# Phase별 브랜치 전략
feat/turborepo-phase-1  # Turborepo 초기화
feat/turborepo-phase-2  # 공유 패키지
feat/turborepo-phase-3  # Next.js 앱 이동
feat/turborepo-phase-4  # BFF 서버
feat/turborepo-phase-5  # API Routes 전환
feat/turborepo-phase-6  # 마무리
```

---

## 참고 자료

- [Turborepo 공식 문서](https://turbo.build/repo/docs)
- [Hono 공식 문서](https://hono.dev/)
- [pnpm Workspaces](https://pnpm.io/workspaces)
