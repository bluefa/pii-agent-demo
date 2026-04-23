# Wave 6 — URL 경로 `/integration/projects/` → `/integration/target-sources/`

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
projectId 폐기 프로젝트의 **사용자 노출 URL 정합화 wave**. 내부 개념이 전부 targetSourceId 로 통일된 상태에서 URL 만 legacy `/integration/projects/` 로 남아있던 것을 `/integration/target-sources/` 로 변경.

**범위**: page route 폴더 rename + URL 리터럴 교체. 동작은 동일 (같은 id, 같은 렌더링).

## Precondition
```bash
cd /Users/study/pii-agent-demo
git fetch origin main

# W3 merge 확인 (_components/ 구조 완료)
git log origin/main --oneline | grep -q "projid-w3" || { echo "✗ W3 먼저 merge"; exit 1; }

# W4 merge 확인 (integrationRoutes.targetSource 함수명 rename 완료)
git log origin/main --oneline | grep -q "projid-w4" || { echo "✗ W4 먼저 merge"; exit 1; }

# 현 폴더 상태
[ -d "app/integration/projects/[targetSourceId]" ] || { echo "✗ route folder missing"; exit 1; }
[ ! -d "app/integration/target-sources/[targetSourceId]" ] || { echo "⚠ 이미 rename 됨"; exit 1; }

# API routes 는 이미 target-sources (건드리지 말 것)
[ -d "app/integration/api/v1/target-sources" ] || { echo "✗ API target-sources dir missing"; exit 1; }
```

**Depends on**: W3 merge, W4 merge.

## Step 1: Worktree
```bash
bash scripts/create-worktree.sh --topic projid-w6-url-path --prefix refactor
cd /Users/study/pii-agent-demo-projid-w6-url-path
```

## Step 2: Required reading
1. `docs/reports/projectid-removal/00-README.md`
2. `app/integration/projects/[targetSourceId]/page.tsx` (+ 동일 폴더의 error.tsx, layout.tsx, page.test.ts, _components/)
3. `lib/routes.ts` (W4 merge 후 상태 — `targetSource:` 함수)
4. `app/components/layout/TopNav.tsx:30-35` — pathname.startsWith 하드코딩

## Step 3: Implementation

### 3-1. 폴더 rename (git mv)

```bash
git mv app/integration/projects app/integration/target-sources

# 검증
ls app/integration/target-sources/\[targetSourceId\]/
# → error.tsx  layout.tsx  page.test.ts  page.tsx  _components/

[ ! -d "app/integration/projects" ] || { echo "✗ old folder still exists"; exit 1; }
```

**주의**: `app/integration/api/v1/target-sources/` (API routes) 는 이미 올바른 이름 — 변경 없음. `app/integration/api/` 와 `app/integration/target-sources/` 는 별개 라우트 (`/integration/api/v1/target-sources/...` vs `/integration/target-sources/<id>`). **충돌 없음**.

### 3-2. `lib/routes.ts` — URL 리터럴 교체

Before (W4 merge 후):
```ts
targetSource: (targetSourceId: number | string) => `/integration/projects/${targetSourceId}`,
```

After:
```ts
targetSource: (targetSourceId: number | string) => `/integration/target-sources/${targetSourceId}`,
```

### 3-3. `page.test.ts` describe label + import 경로

```bash
# page.test.ts 안 import path 는 폴더 rename 으로 git이 자동 추적하지만,
# 절대 경로 `@/app/integration/projects/...` 문자열이 있으면 수동 업데이트 필요
grep -n "integration/projects" app/integration/target-sources/\[targetSourceId\]/page.test.ts
```

수정:
- `import ProjectDetailPage from '@/app/integration/projects/[targetSourceId]/page'` → `@/app/integration/target-sources/[targetSourceId]/page`
- `describe('GET /integration/projects/[targetSourceId]', ...)` → `describe('GET /integration/target-sources/[targetSourceId]', ...)`

### 3-4. `_components/` self-reference import 경로 업데이트

W3 에서 `_components/` 내부가 `@/app/integration/projects/[targetSourceId]/_components/...` 절대 경로를 쓰고 있음. 전부 교체:

```bash
find app/integration/target-sources -type f \( -name "*.tsx" -o -name "*.ts" \) \
  -exec sed -i '' 's|@/app/integration/projects/|@/app/integration/target-sources/|g' {} +

# 잔여 확인
grep -rn "@/app/integration/projects/" --include="*.ts" --include="*.tsx" .
# 기대: 0건
```

외부 import (page.tsx, error.tsx 가 _components 참조) 도 같은 치환으로 처리됨.

### 3-5. `app/components/layout/TopNav.tsx:34` — 활성 탭 하드코딩

Before:
```ts
pathname.startsWith('/integration/admin') ||
pathname.startsWith('/integration/projects'),
```

After:
```ts
pathname.startsWith('/integration/admin') ||
pathname.startsWith('/integration/target-sources'),
```

### 3-6. 하드코딩 URL 잔여 검증

```bash
# 코드 전체 — 0건 기대
grep -rn "'/integration/projects\|\"/integration/projects\|\`/integration/projects" \
  --include="*.ts" --include="*.tsx" . 2>/dev/null

# /integration/projects 경로 일반 검색
grep -rn "/integration/projects" --include="*.ts" --include="*.tsx" . 2>/dev/null \
  | grep -v "node_modules\|.next\|/integration/projects\b" || echo "✓ clean"
```

docs/ 의 잔여는 W5 담당 (이미 merge 됐으면 docs 상태 최신화 follow-up 필요 — §Step 6 PR description 에 기록).

## Step 4: Do NOT touch

- `app/integration/api/v1/target-sources/**` — API routes, 이미 올바름
- `lib/api-client/**` — API 네임스페이스, URL 과 무관
- `lib/bff/**` — upstream 경로 (`/target-sources/{id}`) 이미 올바름
- `integrationRoutes.targetSource` 함수명 — W4 담당 (이미 merge)
- `_components/` 내부 컴포넌트 로직
- `docs/**` — W5 담당 (이 wave 는 URL 만)
- `ConfirmResourceMetadata.projectId` — GCP native

## Step 5: Verify — Behavior Preservation

### Layer 1 — TypeScript
```bash
rm -rf .next && npx tsc --noEmit
```

### Layer 2 — 기존 테스트 (assertion 불변)
```bash
npm test -- app/integration/target-sources
npm test  # 전체 regression
```
`page.test.ts` 의 describe label 과 import path 만 변경. assertion 불변.

### Layer 3 — 빌드 + 린트
```bash
npm run lint
npm run build
```

### Layer 4 — 코드 잔여 검증
```bash
grep -rn "/integration/projects\b" --include="*.ts" --include="*.tsx" .
# 기대: 0건 (API path 인 `/integration/api/v1/target-sources/` 제외)

find app -type d -name projects
# 기대: 비어있음 (app/integration/projects 삭제됨)

ls app/integration/
# 기대: admin  api  api-docs  swagger  target-sources  task_admin
```

## Step 5.5: Dev 수동 검증

```bash
rm -rf .next && bash scripts/dev.sh
```

체크:
- `/integration/admin` → 목록 로드 → row 클릭 → **URL 이 `/integration/target-sources/<id>`** 로 이동 (기존 `/integration/projects/<id>` 아님)
- 상세 페이지 렌더 정상 (5 provider 중 최소 2개 확인)
- TopNav 의 "Service List" 탭이 상세 페이지에서도 active 하이라이트 유지 (pathname.startsWith 업데이트 반영)
- Queue board → task detail modal → "상세 보기" 링크 클릭 → 새 URL 로 이동
- `/integration/projects/<id>` 직접 입력 → 404 (정상 — legacy URL 은 redirect 없이 제거)

## Step 6: Commit + push + PR

```bash
git add -A
git commit -m "refactor(routes): /integration/projects → /integration/target-sources URL 경로 (projid-w6)

내부 개념이 targetSourceId 로 통일된 상태에서 URL 만 legacy /projects/ 로
남아있던 것 정합화. 동작 동일 (같은 id, 같은 렌더링).

- git mv app/integration/projects → app/integration/target-sources
- lib/routes.ts targetSource() URL 리터럴 교체
- _components/ self-reference import 경로 (@/app/integration/target-sources/)
- TopNav pathname.startsWith 업데이트
- page.test.ts describe label + import path

API routes (app/integration/api/v1/target-sources/) 는 이미 올바름 — touch 없음.
docs/ 잔여는 W5 담당."

# ⛔ CLAUDE.md rule: push/PR 전 rebase 필수
git fetch origin main
git rebase origin/main

git push -u origin refactor/projid-w6-url-path
```

PR body:
```markdown
## Summary
사용자 노출 URL `/integration/projects/<id>` → `/integration/target-sources/<id>` rename. 내부 네이밍이 전부 targetSourceId 로 통일된 상태에서 URL 만 legacy 로 남아있던 것 해소. **동작 변경 없음** — 같은 id, 같은 페이지.

## Why
- W1: 라우트 세그먼트 `[projectId]` → `[targetSourceId]` ✓
- W2: mock / 타입 / 59 routes ✓
- W3: `app/projects/` 해체 ✓
- W4: API client 파라미터 + `integrationRoutes.targetSource` 함수명 ✓
- **W6: URL 경로 자체** — 이전 wave 들에서 breakage 리스크로 보류했던 마지막 조각

## Changes
- `app/integration/projects/` → `app/integration/target-sources/` (git mv)
- `lib/routes.ts` `targetSource()` URL 리터럴
- `_components/` self-reference import (절대 경로 sed 치환)
- `app/components/layout/TopNav.tsx:34` 활성 탭 판정
- `page.test.ts` describe label + import path

## Out of scope
- `docs/**` 의 URL 표기 — W5 담당
- Legacy URL (`/integration/projects/<id>`) 을 새 URL 로 redirect — 요구사항에 없음. 404 로 처리 (사용자가 북마크 없다고 판단 시)

## Test plan
- [x] `npx tsc --noEmit`
- [x] `npm test` (page.test.ts 포함)
- [x] `npm run build`
- [x] Dev: `/integration/admin` → row 클릭 → URL 이 `/integration/target-sources/<id>` 로 이동
- [x] Dev: 5 provider 상세 페이지 렌더
- [x] Dev: TopNav 활성 탭 유지
- [x] Dev: Queue board 상세 링크
- [x] `grep -rn "/integration/projects\b"` → 0건 (API route 제외)

## Ref
- Plan: `docs/reports/projectid-removal/00-README.md`
- Depends on: W3, W4 merged
- Blocks: W5 (docs sync — URL 표기 최종 반영)
```

## ⛔ Do NOT auto-merge
PR URL 보고 후 stop.

## Return (under 200 words)
1. PR URL
2. `tsc` / `test` / `build` 결과
3. `/integration/projects` grep 잔여 (기대: 0건, API `/integration/api/v1/target-sources/` 제외)
4. Dev 수동 검증 결과 (URL 이동 + TopNav active + 5 provider 렌더)
5. Spec 편차 및 사유

## Parallel coordination
- **Depends on**: W3 merge (component relocate), W4 merge (integrationRoutes.targetSource)
- **Blocks**: W5 (docs 가 최종 URL 반영)
- **병렬 불가**: W3, W4, W5 — 폴더 구조/URL 리터럴 모두 영향
