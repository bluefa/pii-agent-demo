# Wave 3 — `app/projects/` 폴더 해체 (컴포넌트 재배치)

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
projectId 폐기 프로젝트의 구조 정리 wave. `app/projects/` 는 page.tsx가 없는 **컴포넌트 저장소**였음 (라우트 기능 없음). W1 이후엔 `app/projects/[targetSourceId]/` 로 rename되어 있음.

**목표**: 이 컴포넌트들을 **실제 라우트 폴더 내부**(`app/integration/projects/[targetSourceId]/_components/`)로 이동해서 `app/projects/` 자체를 **삭제**. Next.js App Router에서 `_`로 시작하는 폴더는 private — 라우트로 인식되지 않음 ([공식 문서](https://nextjs.org/docs/app/building-your-application/routing/colocation#private-folders)).

**Simplify 효과**:
- `app/projects/` / `app/integration/projects/` 이중 구조 → `app/integration/projects/[targetSourceId]/` 단일
- 컴포넌트와 이를 소비하는 page.tsx가 같은 폴더 트리 → navigation 단순화
- 21개 파일 이동 (rename 아님, 파일 시스템 위치만) — main@`2b4f641` 기준 (PR #303 `ProjectIdentityCard`, `DeleteInfrastructureButton` 추가 반영)

## Precondition
```bash
cd /Users/study/pii-agent-demo
git fetch origin main

# W1 merge 확인
git log origin/main --oneline | grep -q "projid-w1" || { echo "✗ W1 (route segment rename) 먼저 merge 되어야 함"; exit 1; }

# 대상 폴더 상태 확인
[ -d "app/projects/[targetSourceId]" ] || { echo "✗ W1 merge 상태가 아님 — app/projects/[targetSourceId] 없음"; exit 1; }
[ -d "app/integration/projects/[targetSourceId]" ] || { echo "✗ 라우트 폴더 없음"; exit 1; }

# 파일 수 확인 (21개, main@2b4f641 기준 — 이후 증가 가능)
count=$(find "app/projects/[targetSourceId]" -type f \( -name "*.tsx" -o -name "*.ts" \) | wc -l)
[ "$count" -ge "20" ] || { echo "✗ 컴포넌트 파일 수가 예상보다 적음: $count"; exit 1; }
echo "✓ $count component files ready to move"
```

**Depends on W1** (route segment rename) merge.
**병렬 가능**: `projid-w4-api-contract-rename` — 서로 다른 파일.

## Step 1: Worktree
```bash
bash scripts/create-worktree.sh --topic projid-w3-relocate --prefix refactor
cd /Users/study/pii-agent-demo-projid-w3-relocate
```

## Step 2: Required reading
1. `docs/reports/projectid-removal/00-README.md`
2. `docs/reports/projectid-removal/inventory.md` §3 — 폴더 트리 + 역참조 4곳
3. Next.js App Router private folder 규칙 (`_` prefix) — 이동 대상 폴더는 `_components/` 네이밍
4. `app/integration/projects/[targetSourceId]/page.tsx` — 현 진입점
5. `app/projects/[targetSourceId]/ProjectDetail.tsx` — 이동 대상의 top-level

## Step 3: Implementation

### 3-1. 대상 구조 결정

**Option A (선택 — 권장)**: 단일 `_components/` 폴더에 평탄화 없이 이동
```
app/integration/projects/[targetSourceId]/
├── page.tsx
├── layout.tsx
├── error.tsx
├── page.test.ts
└── _components/
    ├── ProjectDetail.tsx
    ├── common/
    │   ├── ErrorState.tsx
    │   ├── LoadingState.tsx
    │   ├── ProjectPageMeta.tsx
    │   ├── ProjectIdentityCard.tsx         ← 신규 반영 (PR #303)
    │   ├── DeleteInfrastructureButton.tsx  ← 신규 반영
    │   ├── RejectionAlert.tsx
    │   └── index.ts
    ├── aws/
    │   ├── AwsProjectPage.tsx
    │   └── index.ts
    ├── azure/
    │   ├── AzureProjectPage.tsx
    │   ├── AzureSubnetGuide.tsx
    │   └── index.ts
    ├── gcp/
    │   ├── GcpProjectPage.tsx
    │   └── index.ts
    ├── idc/
    │   ├── IdcProjectPage.tsx
    │   ├── IdcProcessStatusCard.tsx
    │   └── index.ts
    └── sdu/
        ├── SduProjectPage.tsx
        ├── SduProcessStatusCard.tsx
        └── index.ts
```

**Option B (대안, 채택 않음)**: provider별로 `_components/` 쪼개서 그 자리의 형태 유지. 현 구조 흐름을 유지하지만 폴더 수 많아짐 → simplify 원칙상 Option A 채택.

### 3-2. `git mv`로 통째로 이동

```bash
cd app/integration/projects/\[targetSourceId\]

# 새 _components 폴더 위치로 이동
git mv ../../../projects/\[targetSourceId\] ./_components

# 결과 확인
ls _components
# → ProjectDetail.tsx  aws  azure  common  gcp  idc  sdu
```

### 3-3. 빈 `app/projects/` 부모 폴더 삭제

```bash
# app/projects/[targetSourceId]가 비었으므로 (위에서 이동됨)
# app/projects/ 자체가 비어있어야 함
cd /Users/study/pii-agent-demo-projid-w3-relocate

# 확인
find app/projects -type f 2>/dev/null
# → 아무 것도 없어야 함

rmdir app/projects
# git에는 이미 이동 변경으로 반영되어 rmdir만으로 충분
```

### 3-4. Import 경로 업데이트 (4개 외부 import)

**(1)** `app/integration/projects/[targetSourceId]/page.tsx`

Before:
```ts
import { ProjectDetail } from '@/app/projects/[targetSourceId]/ProjectDetail';
import { ErrorState } from '@/app/projects/[targetSourceId]/common';
```

After:
```ts
import { ProjectDetail } from './_components/ProjectDetail';
import { ErrorState } from './_components/common';
```

**(2)** `app/integration/projects/[targetSourceId]/error.tsx`

Before:
```ts
import { ErrorState } from '@/app/projects/[targetSourceId]/common';
```

After:
```ts
import { ErrorState } from './_components/common';
```

**(3)** `app/integration/projects/[targetSourceId]/page.test.ts`

Before:
```ts
vi.mock('@/app/projects/[targetSourceId]/ProjectDetail', () => ({ ... }));
vi.mock('@/app/projects/[targetSourceId]/common', () => ({ ... }));
```

After:
```ts
vi.mock('./_components/ProjectDetail', () => ({ ... }));
vi.mock('./_components/common', () => ({ ... }));
```

**(4)** `app/components/features/process-status/azure/AzureInstallationInline.tsx:10`

**이 파일은 `_components/` 내부를 참조할 수 없음** (private folder — 같은 라우트 세그먼트 내부에서만 접근 가능. App Router 규칙은 느슨하지만, 라우트 외부 컴포넌트가 private folder를 import하는 것은 **원칙 위반**).

**해법**: `AzureSubnetGuide.tsx`는 복수 소비자가 있으므로 **공통 컴포넌트 위치로 승격**:

Option 1 (선택): `app/components/features/process-status/azure/AzureSubnetGuide.tsx`로 이동 (같은 폴더)
```bash
git mv app/integration/projects/\[targetSourceId\]/_components/azure/AzureSubnetGuide.tsx \
       app/components/features/process-status/azure/AzureSubnetGuide.tsx
```

- `AzureInstallationInline.tsx`의 import 경로: `./AzureSubnetGuide`로 짧아짐
- `_components/azure/AzureProjectPage.tsx` 내부에서의 import 경로도 업데이트:
  ```ts
  import { AzureSubnetGuide } from '@/app/components/features/process-status/azure/AzureSubnetGuide';
  ```
- `_components/azure/index.ts`에서 `AzureSubnetGuide` re-export 있었으면 삭제

Option 2 (보류): `app/components/features/target-source/` 같은 새 공통 위치 — 스코프 커짐. Option 1로.

### 3-5. `_components/` 내부 self-reference import 수정

`_components/` 내부 파일들이 서로를 `@/app/projects/[targetSourceId]/...` 로 참조 중. 모두 상대 경로로 변경:

**자동 치환 (macOS)**:
```bash
cd app/integration/projects/\[targetSourceId\]/_components

# 각 폴더의 파일에서 self-reference 찾기
grep -rn "@/app/projects/\[targetSourceId\]" . 2>/dev/null
```

**예시 (아래 `~`는 해당 파일 위치 기준 상대):**

`_components/ProjectDetail.tsx` (폴더 root):
- `@/app/projects/[targetSourceId]/common` → `./common`
- `@/app/projects/[targetSourceId]/aws` → `./aws`
- `@/app/projects/[targetSourceId]/azure` → `./azure`
- `@/app/projects/[targetSourceId]/gcp` → `./gcp`
- `@/app/projects/[targetSourceId]/idc` → `./idc`
- `@/app/projects/[targetSourceId]/sdu` → `./sdu`

`_components/aws/AwsProjectPage.tsx`:
- `@/app/projects/[targetSourceId]/common` → `../common`

`_components/azure/AzureProjectPage.tsx`, `gcp/GcpProjectPage.tsx`, `idc/IdcProjectPage.tsx`, `sdu/SduProjectPage.tsx` — 동일하게 `../common`

`_components/idc/IdcProjectPage.tsx:22`:
- `@/app/projects/[targetSourceId]/idc/IdcProcessStatusCard` → `./IdcProcessStatusCard`

`_components/sdu/SduProjectPage.tsx:30`:
- `@/app/projects/[targetSourceId]/sdu/SduProcessStatusCard` → `./SduProcessStatusCard`

**일괄 sed** (주의해서):
```bash
# 이동 후, _components 하위에서만 실행
find app/integration/projects/\[targetSourceId\]/_components -type f \( -name "*.tsx" -o -name "*.ts" \) \
  -exec sed -i '' 's|@/app/projects/\[targetSourceId\]|RELPLACEHOLDER|g' {} +

# 실제로는 상대 경로가 폴더별로 다르므로 수동 검증 필수.
# sed로 일괄 패턴 치환보다 에디터 find-replace + 파일별 상대 경로 계산이 안전.
```

**권장**: 수동으로 파일별 import 수정. 실수 방지.

### 3-6. grep 잔여 확인

```bash
# 전체 프로젝트에서 app/projects 경로 참조 0건이어야 함
grep -rn "app/projects\|@/app/projects" --include="*.ts" --include="*.tsx" .
# 기대: 0건 (docs/ 제외)

grep -rn "app/projects" docs/ | head -10
# 기대: 여러 건 — W5에서 처리
```

## Step 4: Do NOT touch

- 컴포넌트 **이름**, export 이름 (ProjectDetail, AzureProjectPage 등) — 유지
- 컴포넌트 내부 로직 (props, JSX, handlers) — 이동만
- `lib/types.ts`, mock — W2 담당 (이미 merge됨)
- `lib/api-client/types.ts` — W4 담당
- `docs/**` — W5 담당

## Step 5: Verify

```bash
# `.next/` 정리 (라우트 폴더 구조 변경으로 stale cache 위험)
rm -rf .next

# TypeScript
npx tsc --noEmit

# Lint
npm run lint

# 테스트 (특히 page.test.ts)
npm test -- app/integration/projects

# Build
npm run build
```

**빌드 에러 흔한 원인**:
- `_components/` private folder 규칙 위반 (바깥에서 내부 참조) → AzureSubnetGuide 승격이 제대로 안 됨
- self-reference import 누락 — grep으로 검증

## Step 5.5: Dev 수동 확인

```bash
bash scripts/dev.sh
```

체크:
- `/integration/projects/<id>` 5개 provider 각각 로드 성공
- Azure 페이지에서 AzureInstallationInline 내부의 AzureSubnetGuide 렌더 확인 (승격된 경로)
- Error 상태 표시 확인

## Step 6: Commit + push + PR

큰 파일 이동이라 `git mv` 덕분에 diff는 작을 것. 2 commit으로 쪼개면 리뷰 편함:

```bash
# 1. 파일 이동 + _components 진입
git add -A  # 이동 + 내부 import 수정
git commit -m "refactor(structure): relocate app/projects/ into route's _components/ (projid-w3)

App Router private folder convention으로 컴포넌트를 라우트 폴더 안쪽으로.
이중 구조(app/projects + app/integration/projects) → 단일 app/integration/projects.

- git mv app/projects/[targetSourceId]/*  →  app/integration/projects/[targetSourceId]/_components/
- 4개 외부 import (page.tsx / error.tsx / page.test.ts / AzureInstallationInline.tsx) 업데이트
- _components 내부 self-reference는 상대 경로로 변경
- AzureSubnetGuide.tsx: private folder 바깥에서 소비되므로 app/components/features/process-status/azure/ 로 승격
- app/projects/ 폴더 삭제"

git push -u origin refactor/projid-w3-relocate
```

PR body:
```markdown
## Summary
`app/projects/[targetSourceId]/` 폴더를 `app/integration/projects/[targetSourceId]/_components/`
로 이동하고 `app/projects/` 폴더를 삭제. Next.js App Router의 private folder (`_` prefix) 규칙 활용.

## Why
- `app/projects/[targetSourceId]/` 는 page.tsx가 없는 **컴포넌트 저장소**였음 — 라우트 아님
- 같은 URL 경로(`/integration/projects/<id>`)의 컴포넌트가 두 폴더에 걸쳐 있어 네비게이션 불편
- route colocation 권장 패턴 채택

## Changes
### 이동
- `app/projects/[targetSourceId]/*` → `app/integration/projects/[targetSourceId]/_components/*` (21 파일)
- `AzureSubnetGuide.tsx`: `_components/azure/` → `app/components/features/process-status/azure/` (소비자가 private folder 바깥에 있어 승격)

### Import 경로 업데이트 (4 외부 + N 내부)
- `page.tsx`, `error.tsx`, `page.test.ts` — `./​_components/*` 상대 경로
- `AzureInstallationInline.tsx:10` — `AzureSubnetGuide` 승격된 경로
- `_components/` 내부 self-reference — 상대 경로

### 삭제
- `app/projects/` 폴더 (빈 디렉토리)

## Simplification
- 컴포넌트-라우트 colocation → navigation 단순화
- 두 개 `projects` 경로 → 하나
- private folder 규칙 준수 → 컴포넌트가 라우트로 오인되지 않음

## Preserved
- 컴포넌트 이름, export 이름 (ProjectDetail, AzureProjectPage 등) 유지
- 내부 로직, props, JSX 미변경

## Test plan
- [x] `npx tsc --noEmit`
- [x] `npm run lint`
- [x] `npm test -- app/integration/projects`
- [x] `npm run build` (`.next/` clean)
- [x] Dev: 5 provider 상세 페이지 렌더
- [x] Dev: AzureInstallationInline의 AzureSubnetGuide 정상 표시

## Verification
- `grep -rn "app/projects" --include="*.ts" --include="*.tsx" .` → 0건
- `find app -type d -name "projects"` → `app/integration/projects` 하나만

## Ref
- Plan: `docs/reports/projectid-removal/00-README.md`
- Inventory: §3
- Depends on: W1 (route segment rename) — merged
- Parallel safe: W4 (api-contract-rename)
```

## ⛔ Do NOT auto-merge
PR URL 보고 후 stop.

## Return (under 200 words)
1. PR URL
2. `tsc` / `lint` / `test` / `build` 결과
3. 파일 이동 수 (기대: 21 → `_components/`, +1 승격(AzureSubnetGuide) = 22 `git mv`)
4. `grep -rn "app/projects"` code 검색 결과 (기대: 0건)
5. Dev 수동 검증 결과 (5 provider + AzureSubnetGuide)
6. Spec 편차 및 사유

## Parallel coordination
- **Depends on**: `projid-w1-route-segment` — merge 필요
- **병렬 가능**: `projid-w4-api-contract-rename` — 파일 영역 분리
- **Blocks**: 없음 (단, W5 docs 업데이트는 모든 코드 wave 완료 후)
