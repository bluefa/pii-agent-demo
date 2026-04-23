# Wave 4 — API Client 파라미터명 + `integrationRoutes.project` 함수명 rename

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
projectId 폐기 프로젝트의 API 계약 표면 정리 wave. `lib/api-client/types.ts`의 메서드 파라미터명 `projectId: string` 을 `targetSourceId: string`으로 통일하고, `integrationRoutes.project()` 함수명을 `integrationRoutes.targetSource()`로 rename.

**범위는 표면만**: 파라미터/함수 이름 (식별자)만 바꿈. 타입(`string`)과 전달값은 이미 targetSourceId이므로 **동작 변경 없음**. 내부 함수 이름(`client.projects.get` 같은)은 이 wave **범위 밖** (follow-up).

**Simplify 효과**:
- `(projectId: string)` 파라미터에 `String(targetSourceId)` 전달하던 관행 해소 — 의미와 이름 일치
- `integrationRoutes.project(targetSourceId)` 같은 읽기 어려운 호출 → `integrationRoutes.targetSource(targetSourceId)` 일관
- API 계약 문서(`lib/api-client/types.ts`)가 실제 계약과 정합

## Precondition
```bash
cd /Users/study/pii-agent-demo
git fetch origin main

# W1 merge 필요 (routes.ts 파라미터명 충돌 방지 — W1에서 param만 rename했음)
git log origin/main --oneline | grep -q "projid-w1" || { echo "✗ W1 먼저 merge"; exit 1; }

# W2 merge 권장 (mock 구현체 signature가 W2와 연동)
git log origin/main --oneline | grep -q "projid-w2" || { echo "⚠ W2 아직 미merge — 진행은 가능하나 types.ts / mock shim drift 가능"; }

# 대상 파일 존재
[ -f lib/api-client/types.ts ] || { echo "✗"; exit 1; }
[ -f lib/routes.ts ] || { echo "✗"; exit 1; }

# types.ts projectId 파라미터 수 (기대: ~50)
count=$(grep -c "projectId: string" lib/api-client/types.ts)
echo "projectId 파라미터 선언 수: $count"
```

**Depends on**: W1 merge (lib/routes.ts 충돌 방지).
**권장**: W2 merge (mock shim 정합성).
**병렬 가능**: W3 (component relocate).

## Step 1: Worktree
```bash
bash scripts/create-worktree.sh --topic projid-w4-api-contract --prefix refactor
cd /Users/study/pii-agent-demo-projid-w4-api-contract
```

## Step 2: Required reading
1. `docs/reports/projectid-removal/00-README.md`
2. `docs/reports/projectid-removal/inventory.md` §2, §8
3. `lib/api-client/types.ts` (145 LOC 전체)
4. `lib/api-client/mock/*.ts` — 시그니처 일치 필요
5. `lib/routes.ts` — 9 LOC

## Step 3: Implementation

### 3-1. `lib/api-client/types.ts` — 파라미터명 통일

네임스페이스별 rename:

**`targetSources` (L12-13)** — 이미 네임스페이스는 올바름, 파라미터만:
```ts
get: (projectId: string) => Promise<NextResponse>;
// ↓
get: (targetSourceId: string) => Promise<NextResponse>;
```

**`projects` (L15-31)** — 15개 메서드의 `(projectId: string)` → `(targetSourceId: string)`. **함수명(`projects`, `.get`, `.approve` 등)은 유지** (이번 wave 범위 밖).

**`sdu` (L38-51)** — 12개 메서드의 파라미터명만 rename.

**`aws` (L53-58)** — 5개 메서드.

**`idc` (L77-84)** — 7개 메서드.

**`confirm` (L128-144)** — 15개 메서드.

**Azure (L60-68), GCP (L70-74), Scan (L119-123)** — 이미 `targetSourceId` 사용. **변경 없음** — 검증만.

**자동 치환 (주의해서)**:
```bash
# types.ts 단일 파일 대상 — 안전
sed -i '' 's|projectId: string|targetSourceId: string|g' lib/api-client/types.ts
sed -i '' 's|projectId, body|targetSourceId, body|g' lib/api-client/types.ts
sed -i '' 's|projectId, query|targetSourceId, query|g' lib/api-client/types.ts
sed -i '' 's|projectId, page|targetSourceId, page|g' lib/api-client/types.ts
```

**수동 검증**: 치환 후 `grep -n "projectId" lib/api-client/types.ts` 결과 0건이어야 함.

### 3-2. `lib/api-client/mock/*.ts` — 구현체 시그니처 일치

각 mock 파일 (bff-client.ts 포함)의 함수 시그니처도 `(projectId: string)` → `(targetSourceId: string)`로 맞추기. TS 컴파일러가 types.ts와 구현체 일치를 강제함.

**파일 리스트**:
- `lib/api-client/bff-client.ts`
- `lib/api-client/mock/projects.ts`
- `lib/api-client/mock/sdu.ts`
- `lib/api-client/mock/idc.ts`
- `lib/api-client/mock/aws.ts`
- `lib/api-client/mock/confirm.ts`
- `lib/api-client/mock/target-sources.ts`
- 기타 참고: `mock/scan.ts`, `mock/azure.ts`, `mock/gcp.ts` 은 이미 targetSourceId 사용

**일괄 치환 (안전)**:
```bash
# mock shim의 파라미터만 rename — 함수 본문 변수명도 자연히 바뀜
for f in lib/api-client/mock/projects.ts \
         lib/api-client/mock/sdu.ts \
         lib/api-client/mock/idc.ts \
         lib/api-client/mock/aws.ts \
         lib/api-client/mock/confirm.ts \
         lib/api-client/mock/target-sources.ts \
         lib/api-client/bff-client.ts; do
  # 파라미터 선언만 치환 (본문 변수명은 수동 검증)
  sed -i '' 's|projectId: string|targetSourceId: string|g' "$f"
done
```

**변수명 잔여 처리**:
```bash
# 함수 본문 내 `projectId` 사용 전수 grep
grep -n "projectId" lib/api-client/mock/*.ts lib/api-client/bff-client.ts
# 남은 것 수동 수정 — 변수 사용 부분을 targetSourceId로
```

**주의**:
- W2에서 mock shim 내부가 `checkIdcInstallation(Number(projectId))` 형태로 number 변환을 하고 있을 것. W4에서 파라미터명이 `targetSourceId`로 바뀌면 `Number(targetSourceId)`로 자연스러움.
- BFF client (`bff-client.ts`)의 URL 리터럴이 `/api/projects/${projectId}` 로 되어 있으면 URL에서 `${projectId}` 참조는 그대로(변수 이름이 `targetSourceId`로 바뀌었으므로 `${targetSourceId}`) 가되 **URL path 자체(`/api/projects/...`)는 유지** — 이는 W5에서 swagger와 함께 판단.

### 3-3. `lib/routes.ts` — 함수명 rename

Before (W1 merge 상태):
```ts
export const integrationRoutes = {
  admin: '/integration/admin',
  adminDashboard: '/integration/admin/dashboard',
  taskAdmin: '/integration/task_admin',
  project: (targetSourceId: number | string) => `/integration/projects/${targetSourceId}`,
  credentials: '/integration/credentials',
  piiTag: '/integration/pii-tag',
  piiMap: '/integration/pii-map',
} as const;
```

After:
```ts
export const integrationRoutes = {
  admin: '/integration/admin',
  adminDashboard: '/integration/admin/dashboard',
  taskAdmin: '/integration/task_admin',
  targetSource: (targetSourceId: number | string) => `/integration/projects/${targetSourceId}`,
  credentials: '/integration/credentials',
  piiTag: '/integration/pii-tag',
  piiMap: '/integration/pii-map',
} as const;
```

**URL 경로 `/integration/projects/${targetSourceId}` 는 유지** — 사용자에게 노출되는 URL 변경은 이 wave 범위 밖 (레거시 링크 breakage 위험). W5 논의 시 고려.

### 3-4. `integrationRoutes.project()` call site 4곳 업데이트

**수정**:
- `app/components/features/AdminDashboard.tsx:160` — `integrationRoutes.project(...)` → `integrationRoutes.targetSource(...)`
- `app/components/features/AdminDashboard.tsx:165` — 동상
- `app/components/features/queue-board/TaskDetailModal.tsx:70` — 동상
- `design/components/features/admin/ProjectsTable.tsx:107` — 동상 (SIT 시안 파일, 비프로덕션이지만 grep 잔여 회피 위해 수정)

**일괄 치환**:
```bash
grep -rl "integrationRoutes.project" --include="*.ts" --include="*.tsx" . \
  | xargs sed -i '' 's|integrationRoutes\.project|integrationRoutes.targetSource|g'
```

**검증**:
```bash
grep -rn "integrationRoutes\.project\b" --include="*.ts" --include="*.tsx" .
# 기대: 0건
grep -rn "integrationRoutes\.targetSource\b" --include="*.ts" --include="*.tsx" .
# 기대: 4건 + lib/routes.ts 정의 1건 = 5건
```

### 3-5. 잔여 `projectId` 전수 검증 (코드)

```bash
# 이 wave 완료 후 코드의 projectId 잔여는 아래만 허용:
# 1. ConfirmResourceMetadata.projectId (GCP native)
# 2. 주석 / 문서 문자열
# 3. URL 경로 리터럴 (있다면 — W5 판단)

grep -rn "projectId" --include="*.ts" --include="*.tsx" . \
  | grep -v "GCP\|Cloud Project\|ConfirmResourceMetadata\|^docs/\|// "
```

기대 결과:
- `lib/types.ts:805` ConfirmResourceMetadata (1건, 주석 포함 의도적 유지)
- `lib/api-client/bff-client.ts` URL 경로 `/api/projects/...` (있으면)
- 그 외 0건

## Step 4: Do NOT touch

- **함수 이름** `client.projects.*`, `client.confirm.*`, `client.sdu.*` 등 네임스페이스/메서드명 — 이 wave 범위 밖. 별도 wave로 고려.
- **URL 경로 리터럴** `/api/projects/...`, `/integration/projects/...` — W5에서 판단 (breakage 리스크).
- `lib/types.ts` — W2 담당 (이미 merge)
- `lib/mock-*.ts` — W2 담당
- `app/api/_lib/target-source.ts` — W2 담당
- `app/integration/api/v1/**` — W2 담당
- `app/projects/` / `_components/` 구조 — W3 담당
- `docs/**` — W5 담당
- UI 컴포넌트 파일명 / export 이름

## Step 5: Verify

```bash
npx tsc --noEmit
npm run lint
npm test
rm -rf .next && npm run build
```

**TS 에러 흔한 원인**:
- mock shim 함수 본문에서 `projectId` 변수 잔여 (param 이름만 바꾸고 본문은 안 바꿨을 때)
- 파라미터 위치에서 분해 할당 사용 시 `({ projectId })` 형태

## Step 5.5: Dev 수동 확인

```bash
bash scripts/dev.sh
```

- `/integration/admin` 목록 → row 클릭 → 정상 라우팅 (W1 완료 상태)
- Queue board → task detail modal → "상세 보기" 링크 정상
- Scan 실행, Approval 요청 등 API 동작 (mock 모드) 정상
- Azure/GCP 페이지 (이미 targetSourceId 파라미터 사용) — 이전과 동일 동작

## Step 6: Commit + push + PR

```bash
# 1. types.ts + mock shim 파라미터 rename
git add lib/api-client/
git commit -m "refactor(api-client): (projectId: string) → (targetSourceId: string) 파라미터명 통일 (projid-w4 part 1)

함수명과 동작은 유지 — 파라미터 식별자만 rename.

lib/api-client/types.ts:
- targetSources, projects, sdu, aws, idc, confirm 네임스페이스의
  (projectId: string) 파라미터 모두 (targetSourceId: string)로
- Azure/GCP/Scan 은 이미 올바름 (변경 없음)

lib/api-client/mock/*, bff-client.ts:
- 시그니처 일치 + 함수 본문 변수명 정리

실제 호출자가 이미 String(targetSourceId)를 전달하고 있었음 → 동작 변경 없음"

# 2. lib/routes.ts + 4 call sites
git add lib/routes.ts app/components/ design/components/
git commit -m "refactor(routes): integrationRoutes.project() → .targetSource() rename (projid-w4 part 2)

URL 경로 /integration/projects/\${...} 는 유지 (breakage 리스크 회피).
함수명만 rename — 4개 call site (AdminDashboard x2, TaskDetailModal, design ProjectsTable).

모든 call site가 이미 targetSourceId 값을 전달하고 있었음 → 동작 변경 없음."

git push -u origin refactor/projid-w4-api-contract
```

PR body:
```markdown
## Summary
API client 계약과 라우팅 유틸의 **식별자 이름만** projectId → targetSourceId로 통일.
실제 전달값은 이전에도 targetSourceId 였음 — **동작 변경 없음**. 의미와 이름 일치.

## Changes
### `lib/api-client/types.ts`
- 6 네임스페이스 (`targetSources`, `projects`, `sdu`, `aws`, `idc`, `confirm`) 의
  `(projectId: string)` 파라미터 → `(targetSourceId: string)`
- Azure/GCP/Scan 은 이미 `targetSourceId` 사용 중 (변경 없음)
- 약 50+ 메서드 시그니처 수정

### `lib/api-client/mock/**`, `bff-client.ts`
- types.ts 시그니처와 일치시킴 (TS 타입 통과 강제)

### `lib/routes.ts`
- `integrationRoutes.project()` → `integrationRoutes.targetSource()`
- URL 경로 `/integration/projects/${...}` 는 유지 (외부 breakage 방지)

### Call sites (4곳)
- `app/components/features/AdminDashboard.tsx:160, 165`
- `app/components/features/queue-board/TaskDetailModal.tsx:70`
- `design/components/features/admin/ProjectsTable.tsx:107`

## Why
- `(projectId: string)` 에 `String(targetSourceId)` 전달하던 관행 해소
- API 계약 문서와 실제 호출이 일치
- `integrationRoutes.project(targetSourceId)` 의 misleading naming 해소

## Out of scope (follow-up)
- `client.projects.*` 같은 **함수명** rename — breakage 크므로 별도 wave
- URL 경로 리터럴 `/api/projects/...`, `/integration/projects/...` — Swagger 상태 확인 후 W5 또는 별도

## Preserved
- 함수 이름 / 네임스페이스 이름 (`client.projects`, `.confirm` 등)
- URL 경로 리터럴
- `ConfirmResourceMetadata.projectId` (GCP native)
- 동작 / 호출 전달 값

## Test plan
- [x] `npx tsc --noEmit`
- [x] `npm run lint`
- [x] `npm test`
- [x] `npm run build`
- [x] Dev: admin 목록 → 상세 이동, queue board → task detail link
- [x] Dev: scan / approval / 5 provider 페이지 정상

## Verification
- `grep -rn "integrationRoutes\.project\b"` → 0건
- `grep -rn "projectId: string" lib/api-client/types.ts` → 0건
- `grep -rn "projectId" --include="*.ts" --include="*.tsx" .` → `ConfirmResourceMetadata.projectId` 외 0건 (URL 리터럴 제외)

## Ref
- Plan: `docs/reports/projectid-removal/00-README.md`
- Inventory: §2, §8
- Depends on: W1 (merged)
- 권장: W2 merge 후 (mock shim 정합)
- Parallel safe: W3
```

## ⛔ Do NOT auto-merge
PR URL 보고 후 stop.

## Return (under 200 words)
1. PR URL
2. `tsc` / `lint` / `test` / `build` 결과
3. `lib/api-client/types.ts` 의 `projectId: string` 잔여 (기대: 0)
4. `integrationRoutes.project\b` grep 결과 (기대: 0)
5. `integrationRoutes.targetSource\b` grep 결과 (기대: 5)
6. 코드의 전체 `projectId` 잔여 목록 (기대: ConfirmResourceMetadata + URL 리터럴만)
7. Spec 편차 및 사유

## Parallel coordination
- **Depends on**: `projid-w1-route-segment` merge (lib/routes.ts 충돌)
- **권장**: `projid-w2-mock-pivot` merge (mock shim signature 정합성)
- **병렬 가능**: `projid-w3-component-relocate`
- **Blocks**: `projid-w5-docs-sync` 의 일부 섹션
