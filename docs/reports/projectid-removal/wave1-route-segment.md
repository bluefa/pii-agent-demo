# Wave 1 — URL 세그먼트 rename `[projectId]` → `[targetSourceId]`

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
projectId 폐기 프로젝트의 첫 번째 wave. **URL 세그먼트와 `lib/routes.ts` 파라미터명만** 바꾸는 소규모 이관. 자세한 배경은 `docs/reports/projectid-removal/00-README.md`.

Wave 1은 **routing 레이어 정합성**만 목표. Mock/타입/API 클라이언트는 W2/W4가 담당.

## Precondition
```bash
cd /Users/study/pii-agent-demo
git fetch origin main

# 대상 폴더 존재 확인
[ -d "app/integration/projects/[projectId]" ] || { echo "✗ route folder missing"; exit 1; }
[ -d "app/projects/[projectId]" ] || { echo "✗ component folder missing"; exit 1; }
[ -f lib/routes.ts ] || { echo "✗ routes.ts missing"; exit 1; }

# 다른 [projectId] 세그먼트가 없음을 확인
count=$(find app -type d -name "[projectId]" | wc -l)
[ "$count" = "2" ] || { echo "✗ unexpected [projectId] folder count: $count"; exit 1; }
```

**No foundation dependency.** W2 (mock pivot) 와 병렬 실행 가능 — 파일 영역 분리됨.

**같은 파일 충돌 주의**: W4 (api-contract-rename)도 `lib/routes.ts`를 만지므로 W4와는 **순차 실행**. 이 Wave는 파라미터명만, W4는 함수명 rename.

## Step 1: Worktree
```bash
bash scripts/create-worktree.sh --topic projid-w1-route-segment --prefix refactor
cd /Users/study/pii-agent-demo-projid-w1-route-segment
```

## Step 2: Required reading
1. `docs/reports/projectid-removal/00-README.md` — 전체 배경
2. `docs/reports/projectid-removal/inventory.md` §1, §2 — URL 세그먼트 증거
3. `app/integration/projects/[projectId]/page.tsx` — 현 구현 (28 LOC)
4. `app/integration/projects/[projectId]/error.tsx`, `layout.tsx`, `page.test.ts` — 세그먼트 내 4개 파일
5. `lib/routes.ts` — 9 LOC, `project:` 함수만 해당

## Step 3: Implementation

### 3-1. 라우트 폴더 rename (git mv)

```bash
# 실제 라우트
git mv app/integration/projects/\[projectId\] app/integration/projects/\[targetSourceId\]

# 컴포넌트 저장소 (W3에서 해체 예정이나 우선 일관성 확보)
git mv app/projects/\[projectId\] app/projects/\[targetSourceId\]
```

**중요**: `git mv`로 해야 git history 추적 가능.

### 3-2. `app/integration/projects/[targetSourceId]/page.tsx` 내부 수정

Before:
```tsx
import { ProjectDetail } from '@/app/projects/[projectId]/ProjectDetail';
import { ErrorState } from '@/app/projects/[projectId]/common';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const targetSourceId = Number((await params).projectId);

  if (!Number.isInteger(targetSourceId) || targetSourceId <= 0) {
    return <ErrorState error="유효하지 않은 과제 식별자입니다." />;
  }
  // ...
}
```

After:
```tsx
import { ProjectDetail } from '@/app/projects/[targetSourceId]/ProjectDetail';
import { ErrorState } from '@/app/projects/[targetSourceId]/common';

interface PageProps {
  params: Promise<{ targetSourceId: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const targetSourceId = Number((await params).targetSourceId);

  if (!Number.isInteger(targetSourceId) || targetSourceId <= 0) {
    return <ErrorState error="유효하지 않은 과제 식별자입니다." />;
  }
  // ...
}
```

**Simplify 체크**: `const targetSourceId = Number((await params).targetSourceId)` 는 이름 중복처럼 보이지만 `Number()` 변환이 필요하므로 그대로 유지. 더 줄이지 말 것.

### 3-3. `app/integration/projects/[targetSourceId]/error.tsx`

Before:
```tsx
import { ErrorState } from '@/app/projects/[projectId]/common';
```

After:
```tsx
import { ErrorState } from '@/app/projects/[targetSourceId]/common';
```

### 3-4. `app/integration/projects/[targetSourceId]/page.test.ts`

- L23: `vi.mock('@/app/projects/[projectId]/ProjectDetail', ...)` → `[targetSourceId]`
- L27: `vi.mock('@/app/projects/[projectId]/common', ...)` → `[targetSourceId]`
- L31: `import ProjectDetailPage from '@/app/integration/projects/[projectId]/page';` → `[targetSourceId]`
- L33: `describe('GET /integration/projects/[projectId]', ...)` → `describe('GET /integration/projects/[targetSourceId]', ...)`

**테스트 내부에서 params 오브젝트를 만드는 곳**이 있으면 `{ projectId: '...' }` → `{ targetSourceId: '...' }` 로 rename. (page.tsx의 PageProps 타입 변경에 맞춰)

### 3-5. `app/projects/[targetSourceId]/` 내부 5개 파일의 import 경로 수정

이 5개 파일은 자기 디렉토리 내부를 `@/app/projects/[projectId]/...`로 참조 중이므로, rename 후 경로 수정 필요:

- `app/projects/[targetSourceId]/ProjectDetail.tsx:5-10` — 5개 import 경로
- `app/projects/[targetSourceId]/idc/IdcProjectPage.tsx:19,22`
- `app/projects/[targetSourceId]/sdu/SduProjectPage.tsx:29-30`
- `app/projects/[targetSourceId]/azure/AzureProjectPage.tsx:30`
- `app/projects/[targetSourceId]/gcp/GcpProjectPage.tsx:19`
- `app/projects/[targetSourceId]/aws/AwsProjectPage.tsx:20`

**일괄 치환**:
```bash
# macOS (BSD sed) 기준. Linux는 -i '' 대신 -i
find app/projects -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|@/app/projects/\[projectId\]|@/app/projects/[targetSourceId]|g'
```
또는 에디터의 find-replace 사용. 수동 확인 필수.

### 3-6. `app/components/features/process-status/azure/AzureInstallationInline.tsx:10`

Before:
```ts
import { AzureSubnetGuide } from '@/app/projects/[projectId]/azure/AzureSubnetGuide';
```

After:
```ts
import { AzureSubnetGuide } from '@/app/projects/[targetSourceId]/azure/AzureSubnetGuide';
```

### 3-7. `lib/routes.ts` 파라미터명 rename (함수명은 W4에서)

Before:
```ts
project: (projectId: number | string) => `/integration/projects/${projectId}`,
```

After:
```ts
project: (targetSourceId: number | string) => `/integration/projects/${targetSourceId}`,
```

**함수명 `project:` 자체는 유지** — W4에서 `targetSource:`로 rename 예정.

### 3-8. 잔여 `[projectId]` 문자열 전수 grep

rename 후 실행:
```bash
grep -rn "\[projectId\]" --include="*.ts" --include="*.tsx" .
# 기대 결과: 0 건 (docs/, .claude/ 제외)

grep -rn "\[projectId\]" docs/ | head -20
# 기대 결과: 여러 건 (W5에서 처리) — 이 wave에서는 건드리지 않음
```

## Step 4: Do NOT touch

- `lib/types.ts` 타입 필드 — W2 담당
- `lib/mock-*.ts` — W2 담당
- `app/api/_lib/target-source.ts` — W2 담당
- `app/integration/api/v1/**/route.ts` — W2 담당
- `lib/api-client/types.ts` 파라미터명 — W4 담당
- `integrationRoutes.project` 함수명 자체 (파라미터명만 수정) — W4 담당
- `integrationRoutes.project()` call sites (AdminDashboard 등) — W4 담당
- `docs/api/**/*.md`, swagger — W5 담당
- **컴포넌트 파일명, 컴포넌트 export 이름** — 유지

## Step 5: Verify

```bash
# TypeScript
npx tsc --noEmit

# Lint
npm run lint

# 테스트 (page.test.ts 포함)
npm test -- app/integration/projects

# Build (가장 중요 — App Router 라우트 폴더 rename은 build에서 drift 노출)
npm run build
```

**빌드 실패 시 흔한 원인**:
- `.next/` 잔여물 — `rm -rf .next/types && rm -rf .next` 후 재빌드
- `[projectId]` 잔여 import 경로 — 위 grep으로 확인

## Step 5.5: Dev server 수동 확인

```bash
bash scripts/dev.sh
```

체크:
- `/integration/admin` 접속 → 목록 표시
- 목록의 row 클릭 → `/integration/projects/<targetSourceId>` 로 이동 (URL 표시만 바뀜, 기능 동일)
- 에러 던지는 케이스 (`/integration/projects/abc`) → "유효하지 않은 과제 식별자입니다." 에러 페이지
- queue-board의 "상세 보기" → 같은 페이지로 이동

## Step 6: Commit + push + PR

```bash
git add -A  # 폴더 이동 + 내부 파일 수정 한번에
git commit -m "refactor(routes): [projectId] → [targetSourceId] segment rename (projid-w1)

URL 세그먼트명과 실제 값 타입을 일치시킨다. 기존 세그먼트명은
projectId였지만 page.tsx 내부에서 Number((await params).projectId)로
targetSourceId로 해석 후 사용하고 있었음 — misleading naming.

Changes:
- app/integration/projects/[projectId]/ → [targetSourceId]/ (git mv)
- app/projects/[projectId]/ → [targetSourceId]/ (git mv, 컴포넌트 저장소)
- page.tsx PageProps params 타입: { projectId } → { targetSourceId }
- page.test.ts, error.tsx, layout.tsx 내부 경로/라벨 업데이트
- app/projects/[targetSourceId]/ 내부 5개 파일의 self-reference import 업데이트
- AzureInstallationInline의 AzureSubnetGuide import 경로 업데이트
- lib/routes.ts project: 함수의 파라미터명 rename (함수명은 W4)

Scope: routing 레이어 일관성만. 다음 wave:
- W2: mock store pivot + resolveProjectId 제거 + 타입 필드
- W3: app/projects 폴더 해체
- W4: lib/api-client/types.ts 파라미터명 + integrationRoutes 함수명"

# ⛔ CLAUDE.md rule: push/PR 전 rebase 필수
git fetch origin main
git rebase origin/main

git push -u origin refactor/projid-w1-route-segment
```

PR body (`/tmp/pr-projid-w1-body.md`에 저장 후 `gh pr create --body-file`):
```markdown
## Summary
`[projectId]` 라우트 세그먼트를 `[targetSourceId]`로 rename. URL 세그먼트명과
실제 값 타입(targetSourceId)의 misleading naming 해소. **동작 변경 없음** —
page.tsx가 기존에도 `params.projectId`를 `Number(...)`로 targetSourceId
취급하던 것을 이제는 세그먼트명부터 일관되게.

## Why
`/integration/projects/[projectId]/page.tsx` 내부:
- `params: Promise<{ projectId: string }>`
- `const targetSourceId = Number((await params).projectId)`

세그먼트명만 projectId, 실제로는 항상 targetSourceId → rename으로 의미 일치.

## Changes
- `app/integration/projects/[projectId]/` → `[targetSourceId]/` (git mv)
- `app/projects/[projectId]/` → `[targetSourceId]/` (git mv; 라우트 아닌 컴포넌트 저장소지만 경로 정합성)
- `page.tsx` PageProps 타입 + 변수명 일치
- `page.test.ts` mock 경로 / describe 라벨
- `error.tsx`, 5개 ProjectPage.tsx 등 10+ import 경로 업데이트
- `AzureInstallationInline.tsx:10` import 경로
- `lib/routes.ts` `project:` 파라미터명 `projectId` → `targetSourceId` (함수명은 W4)

## Out of scope (follow-up waves, per `00-README.md`)
- Mock store pivot + `resolveProjectId` 제거 — W2
- `app/projects/` 폴더 해체 (컴포넌트를 route 폴더로 이동) — W3
- `lib/api-client/types.ts` 파라미터명 + `integrationRoutes.project` → `.targetSource` — W4
- Swagger / docs 업데이트 — W5

## Test plan
- [x] `npx tsc --noEmit`
- [x] `npm run lint`
- [x] `npm test -- app/integration/projects`
- [x] `npm run build` (`.next/` clean 후)
- [x] Dev: `/integration/admin` → 목록 → row 클릭 → 상세 페이지 이동 + URL 확인
- [x] Dev: `/integration/projects/abc` → error page

## Verification
- `grep -rn "\[projectId\]" --include="*.ts" --include="*.tsx" .` → 0건

## Ref
- Plan: `docs/reports/projectid-removal/00-README.md`
- Inventory: `docs/reports/projectid-removal/inventory.md` §1, §2
- Parallel safe with: `projid-w2-mock-pivot`
```

## ⛔ Do NOT auto-merge
`gh pr create`까지. PR URL 보고하고 멈춘다.

## Return (under 200 words)
1. PR URL
2. `tsc` / `lint` / `test` / `build` 결과
3. Folder rename 성공 여부 (`git status` 기반 확인)
4. Remaining `[projectId]` grep count in code (기대: 0)
5. Dev 수동 검증 결과 (목록 → 상세 이동 성공 여부)
6. Spec 편차 및 사유

## Parallel coordination
- **병렬 가능**: `projid-w2-mock-pivot` — 파일 완전 분리 (W1은 routing, W2는 mock/routes/types)
- **순차 필요**:
  - `projid-w4-api-contract-rename`: 둘 다 `lib/routes.ts`를 만짐. W1 merge → W4 시작.
  - `projid-w3-component-relocate`: `app/projects/` 를 건드림. W1 merge → W3 시작.
