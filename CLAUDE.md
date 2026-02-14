# PII Agent — Claude Code Rules

## Shared Rules (Codex + Claude)

- This repository also maintains shared agent rules at `AGENTS.md`.
- In Claude Code sessions, apply `AGENTS.md` together with this file.
- Before code edits, run `scripts/guard-worktree.sh`.
- If the guard blocks, create a worktree and continue work there.

## ⛔ CRITICAL (위반 시 즉시 중단)

1. **main 브랜치 수정 금지** — 개발 시작 전 worktree 생성 필수
   ```
   git worktree add ../pii-agent-demo-{name} -b {prefix}/{name}
   ```
2. **any 타입 금지**
3. **상대 경로 import 금지** — `@/` 절대 경로만
4. **Raw 색상 클래스 직접 사용 금지** — theme.ts 토큰 또는 UI 컴포넌트를 통해서만 적용

## Tech Stack

Next.js 14 (App Router) · TypeScript · TailwindCSS · Desktop only · 한국어 UI

## Folder Structure

```
app/              Pages (App Router), API Routes
components/
  ui/             Button, Badge, Modal, Card, Table, LoadingSpinner
  features/       Domain components (process-status/, resource-table/, admin/)
hooks/            useModal, useApiMutation, useAsync
lib/
  theme.ts        Design tokens (colors, component styles, helpers)
  api.ts          API call functions
  types/          Shared types
constants/        labels.ts
utils/            date.ts, credentials.ts
```

## Coding Rules

### Naming
- Component files: **PascalCase** (`StepIndicator.tsx`)
- Hooks/utils: **camelCase** (`useModal.ts`)
- Functions: **arrow function** only
- Props: **interface** (not type)

### Imports (order)
1. React / Next.js
2. External libraries
3. Internal (`@/components`, `@/hooks`, `@/lib`)
4. Types (`import type`)

### Hooks
- Modal → `useModal()` (not manual useState)
- API mutation → `useApiMutation()` (not manual try-catch)

### Components
- 300줄 초과 시 폴더 분리 (`ComponentName/index.ts`)
- CSS 파일 생성 금지 (Tailwind only)
- 반응형 불필요 (Desktop only)

## Code Style — Compact 원칙

- 자명한 코드에 주석 금지
- Early return 사용
- 조건부 렌더링: `&&` 또는 삼항연산자 (if/else 블록 지양)
- 불필요한 중간 변수 할당 금지
- 한 줄로 가능하면 한 줄로
- JSDoc은 exported function에만

```tsx
// ❌ Verbose
const isValid = checkValidity(input);
if (isValid) {
  return <Success />;
} else {
  return <Error />;
}

// ✅ Compact
if (!checkValidity(input)) return <Error />;
return <Success />;
```

## Styling — Design System

### 색상: 반드시 theme.ts 경유
| 상태 | 토큰 | 색상 |
|------|------|------|
| 완료/연결 | `statusColors.success` | green-500 |
| 에러/끊김 | `statusColors.error` | red-500 |
| 신규 | `statusColors.info` | blue-500 |
| 진행중 | `statusColors.warning` | orange-500 |
| 대기 | `statusColors.pending` | gray-400 |

### 허용/금지
- ✅ 레이아웃 클래스 직접 사용: `flex`, `grid`, `gap-*`, `p-*`, `m-*`, `w-*`, `h-*`
- ✅ theme.ts 헬퍼: `cn()`, `getButtonClass()`, `getInputClass()`
- ❌ 색상 클래스 직접 사용: `bg-blue-600`, `text-red-500` 등
- ❌ 컴포넌트 스타일 하드코딩: 버튼/카드/모달/뱃지/테이블에 직접 클래스 나열

## Git Workflow

- main 직접 push 금지
- `bash scripts/create-worktree.sh --topic {name} --prefix {prefix}`
- Prefix: `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`, `test/`
- **⛔ push/PR 전**: `git fetch origin main && git rebase origin/main` 필수
- **개발 완료 즉시 commit & rebase & push** — 사용자 확인 대기 없이 바로 수행
- PR Merge 이전 문서화 필수

### Token Saving
- 전체 파일 재출력 금지 → diff/patch로만
- 설명 10줄 이내, 코드 출력 파일 1개(150줄 이내)

## API Rules

- BFF API (`docs/api/`): 백엔드 명세 (production)
- API Routes (`app/api/`): 개발 환경 시뮬레이션
- API Routes는 BFF 명세 준수
- 새 API: BFF 명세 먼저 → API Routes 구현
- API Routes에 "mock" 용어 금지 (`lib/mock-*.ts` 예외)

### API Client 패턴 (ADR-007)
- `app/api/route.ts` → `client.method()` 디스패치 (thin layer)
- Mock 비즈니스 로직은 `lib/api-client/mock/*.ts`에 위치
- BFF 구현은 `lib/api-client/bff-client.ts`에 HTTP 프록시

## Reference Docs

| 문서 | 위치 |
|------|------|
| 비즈니스 도메인 | `docs/domain/README.md` |
| Cloud Provider 프로세스 | `docs/cloud-provider-states.md` |
| BFF API 명세 | `docs/api/{common,core,scan}.md`, `docs/api/providers/*.md` |
| API Routes | `docs/api-routes/README.md` |
| ADR | `docs/adr/README.md` |
| Skills | `.claude/skills/README.md` |
