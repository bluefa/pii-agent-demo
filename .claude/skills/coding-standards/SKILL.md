---
name: coding-standards
description: 코드 작성 시 따르는 코딩 규칙과 패턴. 컴포넌트, 훅, API, 타입 작성 시 자동 적용.
---

# PII Agent 코딩 규칙

## 0. 프로젝트 구조

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

## 1. 파일 및 명명

- 컴포넌트: **PascalCase** (`StepIndicator.tsx`)
- 훅/유틸: **camelCase** (`useModal.ts`)
- 함수: **arrow function**, Props: **interface**, 상수: **UPPER_SNAKE_CASE**

## 2. Import

- `@/` 절대 경로만 (상대 경로 금지)
- 순서: React/Next → 외부 → 내부(`@/`) → Types(`import type`)

### 프로젝트 경로 매핑 (⛔ 반드시 준수)
```
@/app/components/ui/          → UI 컴포넌트 (Button, Badge, Modal, Card, Table, LoadingSpinner)
@/app/components/features/    → 도메인 컴포넌트 (process-status/, resource-table/, admin/)
@/hooks/                      → 커스텀 훅 (useModal, useApiMutation, useAsync)
@/lib/                        → theme.ts, api.ts, types/, constants/, adapters/
@/utils/                      → 유틸리티 (date.ts, credentials.ts)
```
> `@/components/ui/` ❌ → `@/app/components/ui/` ✅ (app 디렉토리 내 위치)

## 3. 타입 안전성

- `any` 금지 — 구체적 타입 또는 `unknown` + 타입 가드
- Provider별 분기: Discriminated Union 활용

## 4. 커스텀 훅

- Modal → `useModal()` (useState 직접 관리 금지)
- API mutation → `useApiMutation()` (try-catch 직접 작성 금지)

## 5. 스타일링 — Design System (⛔ 핵심 규칙)

### 색상 사용 원칙
- **색상 클래스 직접 사용 금지** (`bg-blue-600`, `text-red-500` 등)
- 반드시 `theme.ts` 토큰 경유:
  - 상태 색상 → `statusColors.{success|error|info|warning|pending}`
  - 버튼 → `getButtonClass(variant, size)` 또는 `<Button>` 컴포넌트
  - 카드 → `cardStyles` 토큰
  - 입력 → `getInputClass(state)`

### 허용/금지
```
✅ 레이아웃 직접 사용: flex, grid, gap-*, p-*, m-*, w-*, h-*, text-{sm|base|lg}
✅ theme.ts 헬퍼: cn(), getButtonClass(), getInputClass()
✅ 구조 클래스: rounded-*, border, shadow-*, overflow-*

❌ 색상 직접 사용: bg-{color}-*, text-{color}-*, border-{color}-*
❌ 컴포넌트 스타일 하드코딩: 버튼/카드/모달/뱃지/테이블
```

### 예시
```tsx
// ❌ Bad
<button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">

// ✅ Good
<button className={getButtonClass('primary', 'md')}>

// ❌ Bad
<span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">완료</span>

// ✅ Good
<span className={cn(statusColors.success.bg, statusColors.success.textDark, 'px-2 py-1 rounded-full')}>완료</span>
```

## 6. Code Style — Compact 원칙

- 자명한 코드에 주석 금지
- Early return 사용
- 조건부 렌더링: `&&` 또는 삼항연산자 (if/else 블록 지양)
- 불필요한 중간 변수 금지
- 한 줄로 가능하면 한 줄로
- JSDoc은 exported function에만
- 설명적 함수명으로 주석 대체

```tsx
// ❌ Verbose
const items = data.filter(item => item.active);
const sortedItems = items.sort((a, b) => a.name.localeCompare(b.name));
return (
  <div>
    {sortedItems.map(item => (
      <Item key={item.id} data={item} />
    ))}
  </div>
);

// ✅ Compact
return (
  <div>
    {data
      .filter(item => item.active)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(item => <Item key={item.id} data={item} />)}
  </div>
);
```

## 7. 컴포넌트 구조

- 300줄 초과 시 폴더 분리 (`ComponentName/index.ts`)
- CSS 파일 생성 금지, 반응형 불필요
- Tooltip: portal 사용 (overflow 이슈 방지)
- UI 컴포넌트는 theme.ts 토큰 필수

## 8. API Routes

- API Spec 단일 소스: Swagger(`docs/swagger/*.yaml`) 준수
- "mock" 용어 금지 (`lib/mock-*.ts` 예외)
- `app/api/route.ts`는 `client.method()` 디스패치만 수행 (ADR-007)
- Mock 비즈니스 로직은 `lib/api-client/mock/*.ts`에 위치
- `lib/adapters/`는 삭제됨 (ADR-005 → Superseded by ADR-007)
- Swagger 신규/수정 시 사용자 확인 전 확정 반영 금지
- 각 endpoint는 Error 코드/에러 응답 스키마를 반드시 선언
- 각 endpoint는 실행시간 메타데이터(`x-expected-duration`)를 반드시 선언
- Error 코드 또는 `x-expected-duration` 누락 발견 시 즉시 경고 후 보완

```typescript
// ❌ Bad — mock 직접 import
import { getProjectById } from '@/lib/mock-data';
const project = getProjectById(id);

// ✅ Good — client 디스패치
import { client } from '@/lib/api-client';
const project = await client.projects.get(id);
```

## 9. CSR 에러 처리 (ADR-008)

- CSR API 호출은 반드시 `fetchJson` 사용 (`lib/fetch-json.ts`)
- 에러는 `AppError`로 정규화됨 — `err.code`로 분기 (`lib/errors.ts`)
- `if (!res.ok) throw new Error(...)` 패턴 금지 — `fetchJson`이 대체
- 에러 UI는 `app/components/errors/` 경로에서 관리

## 10. 금지 패턴

- CSS 파일 생성, 반응형 스타일, 불필요한 추상화
- try-catch 직접 작성, 상대 경로 import, any 타입
- Raw 색상 클래스 직접 사용
