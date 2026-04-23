# Wave 2 — Mock Store Pivot + `resolveProjectId` 삭제 + 타입 필드 rename

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
projectId 폐기 프로젝트의 **핵심 이관 wave**. 이 wave가 코드베이스의 가장 큰 단순화를 가져온다.

**삭제 대상 (simplify 관점):**
- `app/api/_lib/target-source.ts::resolveProjectId()` — 59개 BFF route에서 매번 호출되던 `targetSourceId → projectId` 역변환 helper
- `lib/mock-data.ts::getProjectIdByTargetSourceId()`, `::getTargetSourceIdByProjectId()` — mapping helpers
- 59개 route 파일에서 각 3-4 LOC의 resolver 호출 코드

**Rename 대상:**
- Mock provider store의 key: `projectId` → `targetSourceId`
- Mock 함수 시그니처: `(projectId: string)` → `(targetSourceId: number)`
- `lib/types.ts` 3개 타입 필드: `projectId: string` → `targetSourceId: number`

**보존 대상 (절대 수정 금지):**
- `ConfirmResourceMetadata.projectId?: string` — GCP Cloud Project ID (외부 계약)
- `Project` interface의 id/targetSourceId/projectCode 필드 구성 (도메인 객체 골격)
- `resolveProject()` — (필요하면) targetSourceId 직접 받는 형태로만 수정, 완전 삭제 금지
- BFF 모드 동작 (`USE_MOCK_DATA=false`)

## Precondition
```bash
cd /Users/study/pii-agent-demo
git fetch origin main

# 핵심 파일 존재 확인
[ -f app/api/_lib/target-source.ts ] || { echo "✗ target-source.ts missing"; exit 1; }
[ -f lib/mock-data.ts ] || { echo "✗ mock-data.ts missing"; exit 1; }
[ -f lib/types.ts ] || { echo "✗ types.ts missing"; exit 1; }

# resolveProjectId 호출 route 수
count=$(grep -rl "resolveProjectId" app/integration/api | wc -l)
[ "$count" -ge "50" ] || { echo "✗ resolveProjectId 호출 route가 예상보다 적음: $count"; exit 1; }
echo "✓ $count routes use resolveProjectId"
```

No foundation dependency. **W1과 병렬 가능** — 파일 영역 분리됨.

## Step 1: Worktree
```bash
bash scripts/create-worktree.sh --topic projid-w2-mock-pivot --prefix refactor
cd /Users/study/pii-agent-demo-projid-w2-mock-pivot
```

## Step 2: Required reading
1. `docs/reports/projectid-removal/00-README.md` — 전체 배경 & simplify rationale
2. `docs/reports/projectid-removal/inventory.md` §4, §5, §6, §7 — 증거 + 파일 리스트
3. `app/api/_lib/target-source.ts` (89 LOC) — 현재 resolver 구현
4. `lib/bff/mock-adapter.ts` (73 LOC) — **mock 모드의 BFF client**. `getProjectIdByTargetSourceId` 의존 + 자체 `resolveProjectId` 내부 함수 존재
5. `lib/bff/client.ts:9` — `IS_MOCK ? mockBff : httpBff` 진입점
6. `lib/mock-data.ts:855-868` — mapping 헬퍼 3개
7. `lib/types.ts:444-471, 752-759, 800-810` — 해당 타입 정의
8. `lib/mock-idc.ts` — store 구조 레퍼런스 (다른 provider도 동일 패턴)
9. 샘플 route: `app/integration/api/v1/idc/target-sources/[targetSourceId]/installation-status/route.ts` — 전형적 호출 패턴
10. `app/api/_lib/__tests__/target-source.test.ts` — `resolveProjectId` 직접 테스트 (§3-7 에서 업데이트 대상)
11. `.claude/skills/coding-standards/SKILL.md` — 스타일 참고
12. `.claude/skills/simplify/SKILL.md` — 단순화 원칙

## Step 3: Implementation

**순서가 중요하다.** 타입 먼저 → mock 파일 → resolver 삭제 → route 업데이트. 역순으로 하면 타입 에러의 cascade가 생긴다.

### 3-1. `lib/types.ts` — 3개 타입 필드 rename

**ScanJob** (L444-459):
```ts
export interface ScanJob {
  id: string;
  targetSourceId: number;   // ← projectId: string 에서 변경
  provider: CloudProvider;
  // ... 나머지 유지
}
```

**ScanHistory** (L461-471):
```ts
export interface ScanHistory {
  id: string;
  targetSourceId: number;   // ← projectId: string 에서 변경
  scanId: string;
  // ... 나머지 유지
}
```

**ProjectHistory** (L752-759):
```ts
export interface ProjectHistory {
  id: string;
  targetSourceId: number;   // ← projectId: string 에서 변경
  type: ProjectHistoryType;
  // ... 나머지 유지
}
```

**⛔ `ConfirmResourceMetadata.projectId` (L805)는 유지.** GCP native. 주석으로 의도 명확화 가능:
```ts
// GCP Cloud Project ID (외부 계약). 내부 projectId(legacy)와 다름.
projectId?: string;
```

### 3-2. Mock provider stores — key type & 함수 signature

대상 파일 10개 (main@`2b4f641` 기준). 각 파일에서:
- `Record<string, T>` → `Record<number, T>` (store value type)
- 함수 파라미터: `(projectId: string, ...)` → `(targetSourceId: number, ...)`
- 내부 store 접근: `store.xxx[projectId]` → `store.xxx[targetSourceId]`
- `getProjectById(projectId)` 호출 guard는 `getProjectByTargetSourceId(targetSourceId)`로 교체
- `projectId.slice(-8)` 같은 string 연산은 `String(targetSourceId).slice(-8)` 또는 `targetSourceId.toString()`으로 변환

**파일별 작업량**:
- `lib/mock-sdu.ts` (65건) — 가장 큼. S3 버킷명 등에 projectId 문자열 쓰는 곳 확인 필요
- `lib/mock-idc.ts` (33건)
- `lib/mock-azure.ts` (30건)
- `lib/mock-history.ts` (22건) — filter `h.projectId === projectId` → `h.targetSourceId === targetSourceId`
- `lib/mock-scan.ts` (17건) — ScanJob 생성시 `projectId: project.id` → `targetSourceId: project.targetSourceId`
- `lib/mock-installation.ts` (13건)
- `lib/mock-test-connection.ts` (11건) ← 2026-04-23 검증 시 추가 발견
- `lib/mock-gcp.ts` (10건)
- `lib/mock-data.ts` — §3-3 참조
- `lib/mock-store.ts` (1건)

**영향 없음 (건드리지 말 것)**: `lib/mock-dashboard.ts`, `lib/mock-service-settings.ts` — projectId 0건

**시뮬레이션 해시 함수 주의** (mock-idc.ts:46-50 등):
```ts
const generateTfStatus = (projectId: string): IdcTfStatus => {
  const hash = projectId.split('').reduce(...);  // ← string 기반
```
→ 변경:
```ts
const generateTfStatus = (targetSourceId: number): IdcTfStatus => {
  const hash = targetSourceId;  // number 직접 사용 — 더 단순
  // ...
};
```
또는 `String(targetSourceId).split('')` 유지. **더 단순한 쪽 선택** (simplify skill).

### 3-3. `lib/mock-data.ts` — 매핑 헬퍼 정리

**삭제:**
```ts
// L864-865 — 역방향, 불필요
export const getTargetSourceIdByProjectId = (projectId: string): number | undefined =>
  getStore().projects.find(p => p.id === projectId)?.targetSourceId;

// L867-868 — 소비자 2곳: app/api/_lib/target-source.ts 의 resolveProjectId + lib/bff/mock-adapter.ts
export const getProjectIdByTargetSourceId = (targetSourceId: number): string | undefined =>
  getStore().projects.find(p => p.targetSourceId === targetSourceId)?.id;
```

**유지 (W2 범위 외):**
```ts
// L861-862 — 다른 많은 곳에서 사용
export const getProjectByTargetSourceId = (targetSourceId: number): Project | undefined => ...;

// L855 — 신규 project 생성 시 필요
export const generateTargetSourceId = (): number => ...;
```

**`getProjectById(projectId)` 호출자 재구성**: mock 파일들이 `getProjectById(projectId)`로 guard하던 곳을 `getProjectByTargetSourceId(targetSourceId)`로 교체. `getProjectById`는 다른 소비자가 있으면 유지, 없으면 이 wave에서 제거 고려 (grep으로 확인).

### 3-4. `app/api/_lib/target-source.ts` — resolver 삭제

**Before (89 LOC)**:
```ts
import { getProjectByTargetSourceId, getProjectIdByTargetSourceId } from '@/lib/mock-data';
import type { Project } from '@/lib/types';
// ...
export function parseTargetSourceId(...) { ... }       // 유지
export function resolveProjectId(...) { ... }          // 삭제
export function resolveProject(...) { ... }            // 삭제 또는 rewire
```

**After (~40 LOC):** `parseTargetSourceId` 유지 + `resolveProject` 는 소비자 3곳이 있으므로 **mock-data 의존성만 교체해 보존**:

```ts
import { getProjectByTargetSourceId } from '@/lib/mock-data';
import type { Project } from '@/lib/types';
import type { ProblemDetails } from '@/app/api/_lib/problem';
import { createProblem } from '@/app/api/_lib/problem';

type ParseResult =
  | { ok: true; value: number }
  | { ok: false; problem: ProblemDetails };

export function parseTargetSourceId(param: string, requestId: string): ParseResult {
  const id = Number(param);
  if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) {
    return {
      ok: false,
      problem: createProblem(
        'INVALID_PARAMETER',
        `targetSourceId는 양의 정수여야 합니다: "${param}"`,
        requestId,
      ),
    };
  }
  return { ok: true, value: id };
}

export function resolveProject(
  targetSourceId: number,
  requestId: string,
): { ok: true; project: Project } | { ok: false; problem: ProblemDetails } {
  const project = getProjectByTargetSourceId(targetSourceId);
  if (!project) {
    return {
      ok: false,
      problem: createProblem(
        'TARGET_SOURCE_NOT_FOUND',
        `targetSourceId ${targetSourceId}에 해당하는 리소스를 찾을 수 없습니다.`,
        requestId,
      ),
    };
  }
  return { ok: true, project };
}
```

**삭제된 것**:
- `resolveProjectId` 함수 전체
- `getProjectIdByTargetSourceId` import
- `resolveProject` 내부의 `!IS_MOCK` 분기 + `IS_MOCK` const
- `const IS_MOCK = process.env.USE_MOCK_DATA !== 'false'` 선언 (불필요)

**`resolveProject` 호출처 (main@`2b4f641` 기준 3개 — 이 wave에서 호출부 수정 불필요)**:
```
app/integration/api/v1/azure/target-sources/[targetSourceId]/settings/route.ts:22
app/integration/api/v1/gcp/target-sources/[targetSourceId]/settings/route.ts:11
app/integration/api/v1/aws/target-sources/[targetSourceId]/verify-scan-role/route.ts:10
```
시그니처 동일하므로 변경 불필요 — mock-data 내부 조회만 단순화됨.

### 3-4.5. `lib/bff/mock-adapter.ts` — legacy helper 의존 제거

**중요**: 이 파일은 mock 모드(`USE_MOCK_DATA=true`)의 기본 BFF client (`lib/bff/client.ts:9` — `mockBff` export). `getProjectIdByTargetSourceId` 에 의존 + 자체 `resolveProjectId` 내부 함수까지 정의. W2 에서 이를 단순화하지 않으면 mock 모드가 **런타임에 깨짐**.

**현재 구조 (main@`2b4f641`):**
```ts
// lib/bff/mock-adapter.ts
import { getProjectIdByTargetSourceId } from '@/lib/mock-data';
import { mockTargetSources } from '@/lib/api-client/mock/target-sources';
import { mockProjects } from '@/lib/api-client/mock/projects';

function resolveProjectId(targetSourceId: number): string {
  const projectId = getProjectIdByTargetSourceId(targetSourceId);
  if (!projectId) {
    throw new BffError(404, 'NOT_FOUND', '...');
  }
  return projectId;
}

export const mockBff: BffClient = {
  targetSources: {
    get: async (id) => {
      const projectId = resolveProjectId(id);
      const res = await mockTargetSources.get(projectId);
      // ...
    },
    secrets: async (id) => {
      const projectId = resolveProjectId(id);
      const res = await mockProjects.credentials(projectId);
      // ...
    },
  },
  // ...
};
```

**After (W2):**
`lib/api-client/mock/target-sources.ts`, `mock/projects.ts` 내부가 targetSourceId(number)를 직접 처리하게 되었으므로 (§3-2 참조), mock-adapter의 resolver는 불필요. `String(id)` passthrough 로 축약:

```ts
// lib/bff/mock-adapter.ts (after)
import type { NextResponse } from 'next/server';
import type { BffClient } from '@/lib/bff/types';
import type { SecretKey } from '@/lib/types';
import type { CurrentUser } from '@/app/lib/api';
import { BffError } from '@/lib/bff/errors';
import { mockTargetSources } from '@/lib/api-client/mock/target-sources';
import { mockProjects } from '@/lib/api-client/mock/projects';
import { mockUsers } from '@/lib/api-client/mock/users';
import { extractTargetSource, type TargetSourceDetailResponse } from '@/lib/target-source-response';

// getProjectIdByTargetSourceId import 삭제
// 자체 resolveProjectId 내부 함수 삭제 (-7 LOC)

async function unwrap<T>(response: NextResponse): Promise<T> { /* unchanged */ }

export const mockBff: BffClient = {
  targetSources: {
    get: async (id) => {
      const res = await mockTargetSources.get(String(id));
      const data = await unwrap<TargetSourceDetailResponse>(res);
      return extractTargetSource(data);
    },
    secrets: async (id) => {
      const res = await mockProjects.credentials(String(id));
      const data = await unwrap<...>(res);
      return data.credentials.map(...);
    },
  },
  users: { /* unchanged */ },
};
```

**효과**: mock-adapter.ts −10 LOC 추가 단순화. 404 NOT_FOUND 에러는 이제 mock-client 내부(`mockTargetSources.get`)에서 발생 — behavior 동일.

**주의**: `mockTargetSources.get(projectId: string)` 시그니처는 W4 에서 `targetSourceId: string` 으로 rename 예정. W2 에서는 `String(id)` passthrough 이므로 W4 merge 후에도 자연스러움.

### 3-5. BFF Route 59개 업데이트

**공통 패턴 변경**:

Before:
```ts
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProjectId(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const response = await client.idc.getInstallationStatus(resolved.projectId);
  // ...
});
```

After:
```ts
import { parseTargetSourceId } from '@/app/api/_lib/target-source';

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const response = await client.idc.getInstallationStatus(String(parsed.value));
  // ...
});
```

**→ 파일당 ~3 LOC 감소 × 59 파일 = 약 180 LOC 감소**

#### 중요 주의사항

1. **`String(parsed.value)` 감싸기**: `client.X.Y()` 시그니처가 `(projectId: string)`으로 정의되어 있음 (W4에서 rename 예정). W2에서는 타입 호환을 위해 `String()` 유지. W4 merge 후 불필요해지면 W4가 정리.

2. **일부 route에서 `resolved.projectId`를 2회 사용** (ex: URL 구성 + body 구성). 모두 `String(parsed.value)`로 대체하거나, 로컬 변수로:
   ```ts
   const targetSourceIdStr = String(parsed.value);
   ```

3. **POST body에서 projectId 키를 담는 곳** — grep:
   ```bash
   grep -rn "projectId:" app/integration/api --include="*.ts"
   ```
   결과 있으면 각각 확인: upstream BFF가 `projectId` 키를 body에서 받는다면 **유지**, 단순 passthrough면 rename. Swagger (`docs/swagger/*.yaml`) 확인.

4. **`resolveProject` (단수) 호출자**: 있으면 §3-4 계획대로 처리.

### 3-6. Mock api-client 파일 시그니처 맞추기

`lib/api-client/mock/*.ts`의 함수들이 `lib/api-client/types.ts`의 시그니처에 맞춰 구현되어 있다. W4에서 types.ts 파라미터명을 rename할 예정이므로, **W2에서는 mock 구현체의 시그니처는 그대로 두고** mock이 내부에서 호출하는 `lib/mock-*.ts` 함수 시그니처만 `(targetSourceId: number)`로 맞춘다.

중간 계층은 `Number(projectId)`를 mock 호출 직전에 추가:
```ts
// lib/api-client/mock/idc.ts 예시
export async function checkInstallation(projectId: string) {
  // ... 내부 mock-idc 호출시:
  const result = checkIdcInstallation(Number(projectId));
  // ...
}
```

**TS 컴파일 에러의 대부분이 이 레이어에서 발생**. 인내심 있게 각 파일 처리.

### 3-7. 테스트 파일 업데이트

- `lib/__tests__/mock-history.test.ts` (13건) — filter/assertion의 projectId → targetSourceId. test fixture의 projectId 값이 string이었다면 number로.
- `lib/__tests__/mock-scan.test.ts` (8건) — ScanJob fixture & assertion.
- `lib/__tests__/mock-target-source.test.ts` (8건) — `getProjectIdByTargetSourceId`/`getTargetSourceIdByProjectId` 테스트 **삭제**. `getProjectByTargetSourceId`만 남는다면 해당 테스트로 축소.
- `app/api/_lib/__tests__/target-source.test.ts` — `parseTargetSourceId` 테스트는 유지. `describe('resolveProjectId', ...)` 블록은 **삭제** (production helper 삭제와 동반). `resolveProject` 테스트는 §3-4의 보존 helper에 맞춰 새로 작성:
  ```ts
  // vi.mock('@/lib/mock-data', () => ({ getProjectByTargetSourceId: vi.fn() }))
  describe('resolveProject', () => {
    it('존재하지 않는 targetSourceId 는 TARGET_SOURCE_NOT_FOUND 반환', ...);
    it('존재하는 targetSourceId 는 project 반환', ...);
  });
  ```
- 갭 파일 (mock-sdu/mock-gcp/mock-test-connection): Wave 0 에서 선행 작성된 상태여야 함 — Wave 0 merge 확인 후 이 wave 진행.

### 3-8. 잔여 `projectId` 검증

```bash
# 잔여 참조 (GCP native + docs 제외)
grep -rn "projectId" --include="*.ts" --include="*.tsx" . \
  | grep -v "ConfirmResourceMetadata\|// GCP Cloud Project\|lib/api-client/types\.ts\|lib/api-client/mock/"

# 위 결과는 W4에서 처리할 `lib/api-client/` 네임스페이스 외에 0건이어야 함
```

## Step 4: Do NOT touch

- `lib/types.ts::ConfirmResourceMetadata.projectId` — GCP native
- `lib/types.ts::Project` interface 필드 구성 (id/targetSourceId/projectCode) — 도메인
- `lib/bff/client.ts` — projectId 직접 참조 없음, 변경 불필요 (`mockBff` / `httpBff` 분기만 수행)
- `lib/bff/http.ts`, `lib/bff/types.ts`, `lib/bff/errors.ts` — 변경 없음
- `app/integration/projects/[projectId]/` folder rename — W1 담당
- `app/projects/` folder 해체 — W3 담당
- `lib/api-client/types.ts` 파라미터명 — W4 담당
- `integrationRoutes.project` — W1(param)/W4(function name) 담당
- UI 컴포넌트 파일명 (`ProjectDetail.tsx` 등) — 유지
- `docs/swagger/*.yaml`, `docs/api/**/*.md` — W5 담당
- ADR 문서

## Step 5: Verify — Behavior Preservation (핵심)

이 wave 의 성공 기준은 **외부에서 관찰 가능한 동작 불변**. 5-layer 검증:

### Layer 1 — TypeScript cascade (자동, 가장 강력한 보증)
```bash
npx tsc --noEmit
```
`projectId: string` 필드를 `targetSourceId: number` 로 바꿨기 때문에 아직 잘못 참조하는 소비자가 있으면 즉시 컴파일 실패. **0 에러가 되어야** 모든 전파가 완료된 것.

주요 에러 패턴:
- `Record<string, T>` vs `Record<number, T>` 불일치 → 위쪽 호출자부터 고침
- 변수명이 `projectId` 지만 타입은 number 인 임시 케이스 → 변수명도 `targetSourceId` 로 정리
- 테스트 fixture 의 타입 미스매치

### Layer 2 — 기존 behavior 테스트 (assertion 불변 증명)
```bash
# 먼저 전체 전체 regression
npm test

# 특히 중요 (assertion 한 줄도 수정하지 않고 통과해야 함):
npm test -- lib/__tests__/mock-history.test.ts
npm test -- lib/__tests__/mock-scan.test.ts
npm test -- lib/__tests__/mock-idc.test.ts         # W0 아님 — 기존 테스트
npm test -- lib/__tests__/mock-azure.test.ts       # W0 아님
npm test -- lib/__tests__/mock-installation.test.ts
```

**⛔ assertion 수정 금지**. fixture 객체의 `projectId: 'sdu-1'` 을 `targetSourceId: 1001` 로 바꾸는 것은 허용 — 값의 의미가 같고 타입만 바뀌는 것이므로. `expect(result.data?.status).toBe('COMPLETED')` 같은 behavior assertion 은 건드리지 않음. assertion 을 바꿔야 green 이 나오면 **behavior drift 가 생긴 것** — 원인 찾아 production 코드 수정.

### Layer 3 — W0 behavior lock-in 통과 (가장 crucial)
```bash
# W0 에서 sdu / gcp / test-connection 에 lock-in 된 behavior 가 그대로 통과해야 함
npm test -- lib/__tests__/mock-sdu.test.ts
npm test -- lib/__tests__/mock-gcp.test.ts
npm test -- lib/__tests__/mock-test-connection.test.ts
```

이 세 파일의 assertion **한 줄도 수정하지 않고** 모두 GREEN 이어야 한다. fixture 의 string projectId 를 number targetSourceId 로 치환하는 변경만 허용.

만약 red 면:
- production behavior 가 실제로 바뀐 것 → 코드 수정
- 또는 W0 quirk 가 실수로 의존한 내부 구현이 바뀐 것 → W0 assertion 이 너무 tight 했던 것. 상의 후 loosen.

### Layer 4 — 린트 + 빌드
```bash
npm run lint
rm -rf .next && npm run build
```

### Layer 5 — 코드 잔여 검증
```bash
# 이 wave 완료 후 이하 grep 전부 0건 (예외 제외)
grep -rn "resolveProjectId" app/ lib/ --include="*.ts" --include="*.tsx"
# → 0 건 (lib/bff/mock-adapter.ts 도 제거됨)

grep -rn "getProjectIdByTargetSourceId\|getTargetSourceIdByProjectId" --include="*.ts" .
# → 0 건

grep -rn "projectId" lib/types.ts
# → 1 건 (L805 ConfirmResourceMetadata.projectId — GCP native 의도적 유지)
```

## Step 5.5: Dev 수동 E2E — 5 provider × 5 flow 매트릭스

```bash
bash scripts/dev.sh
```

반드시 5개 provider 각각 다음 flow 를 직접 클릭하여 확인. mock 모드는 결정론적이므로 동일 target source ID 로 W2 전/후 같은 화면/데이터가 나와야 한다.

| Flow | AWS | Azure | GCP | IDC | SDU |
|---|---|---|---|---|---|
| 목록 로딩 (`/integration/admin`) | ✓ | ✓ | ✓ | ✓ | ✓ |
| 상세 페이지 로드 (`/integration/projects/<id>`) | | | | | |
| 설치 상태 폴링 (10초 간격) | | | | | |
| Scan 실행 + 결과 | | | | | |
| Approval 요청 + 취소 | | | | | |

추가:
- Queue board (`/integration/task_admin`) 목록 + 상세 modal 링크 → 상세 페이지 이동
- Error 상태 — `/integration/projects/abc` → "유효하지 않은 과제 식별자" 에러 페이지 (W1 merge 후부터)
- Process status: REQUEST_REQUIRED / WAITING_APPROVAL / APPLYING_APPROVED / TARGET_CONFIRMED 각 상태 렌더

**비교 기준**: 같은 clicks 로 main@`2b4f641` (W2 전) 에서 본 것과 **화면/데이터 동일**. 다른 부분 발견 시 즉시 rollback 후 원인 분석.

**BFF 모드** 는 별도 환경 필요. 이 wave 에서는 mock 만 확인 — Layer 1/2 의 타입 안전성이 BFF 모드 안정성을 간접 보증 (같은 시그니처, `String(targetSourceId)` passthrough).

## Step 6: Commit + push + PR

이 wave는 LOC 큼 (>500). 변경 파일 >70. **하나의 PR로 가되, commit 구분**:

```bash
# 1. 타입 + mock-data helper 정리
git add lib/types.ts lib/mock-data.ts
git commit -m "refactor(types): 3 legacy projectId fields → targetSourceId (projid-w2 part 1)

ScanJob.projectId: string → targetSourceId: number
ScanHistory.projectId: string → targetSourceId: number
ProjectHistory.projectId: string → targetSourceId: number
ConfirmResourceMetadata.projectId 유지 (GCP native).

mock-data helpers 정리:
- getProjectIdByTargetSourceId 삭제 (resolveProjectId 전용 소비)
- getTargetSourceIdByProjectId 삭제 (역방향 미사용)
- getProjectByTargetSourceId 유지 (다수 소비자)"

# 2. Mock provider stores
git add lib/mock-*.ts lib/__tests__/
git commit -m "refactor(mock): provider stores key pivot (projid-w2 part 2)

Record<string, T> (keyed by projectId string) →
Record<number, T> (keyed by targetSourceId number).

9 mock files + 3 test files updated.
SDU S3 버킷명 등 문자열 연산은 String(targetSourceId).slice(-8) 변환."

# 3. API client mock shim
git add lib/api-client/mock/
git commit -m "refactor(api-client/mock): convert String(projectId) → Number for mock calls (projid-w2 part 3)

mock 구현체 시그니처는 types.ts에 맞춰 (projectId: string) 유지 (W4 담당).
내부 lib/mock-*.ts 호출 전 Number() 변환."

# 4. Resolver 삭제 + 59 routes
git add app/api/_lib/target-source.ts app/integration/api/
git commit -m "refactor(api): resolveProjectId 제거 + 59 routes 정리 (projid-w2 part 4)

Mock store가 targetSourceId를 직접 key로 사용하므로 resolver 불필요.

app/api/_lib/target-source.ts: 89 LOC → ~30 LOC
- parseTargetSourceId 유지
- resolveProjectId 삭제
- resolveProject (rewire or 삭제) — 호출자 따라 결정

59 route 파일: 각 3-4 LOC 감소 (resolver 호출 + guard 삭제).
총 LOC: −200 이상."

# ⛔ CLAUDE.md rule: push/PR 전 rebase 필수
git fetch origin main
git rebase origin/main

git push -u origin refactor/projid-w2-mock-pivot
```

PR body (`/tmp/pr-projid-w2-body.md`):
```markdown
## Summary
projectId legacy 개념의 데이터 레이어 전면 폐기. Mock store의 key를
targetSourceId(number)로 pivot하여 `resolveProjectId` adapter를 제거.
59개 BFF route에서 2-step(parse → resolve)을 1-step(parse)으로 단순화.

## Why
현재 구조:
```
BFF route → parseTargetSourceId → resolveProjectId → mock fn (keyed by projectId string)
```
Pivot 후:
```
BFF route → parseTargetSourceId → mock fn (keyed by targetSourceId number)
```
resolver는 mock-data에서 string id를 역조회하는 glue였을 뿐, 값 자체는 항상 targetSourceId.

## Changes
### 타입 (lib/types.ts)
- `ScanJob`, `ScanHistory`, `ProjectHistory`: `projectId: string` → `targetSourceId: number`
- `ConfirmResourceMetadata.projectId` 유지 (GCP native, 주석 추가)

### Mock (lib/mock-*.ts, 9 files)
- Store type: `Record<string, T>` → `Record<number, T>`
- 함수 시그니처: `(projectId: string)` → `(targetSourceId: number)`

### Resolver (app/api/_lib/target-source.ts)
- `resolveProjectId` 삭제 (59 routes에서 호출)
- `resolveProject` (호출자 유무에 따라) rewire 또는 삭제
- `parseTargetSourceId` 유지 (숫자 검증 필요)
- 약 89 LOC → ~30 LOC

### BFF Routes (59 files)
- `resolveProjectId` import/call 제거
- `client.X.Y(String(parsed.value))` 로 직접 전달

### mock-data helpers (lib/mock-data.ts)
- `getProjectIdByTargetSourceId` 삭제
- `getTargetSourceIdByProjectId` 삭제
- `getProjectByTargetSourceId` 유지

### Tests (lib/__tests__)
- mock-history.test.ts, mock-scan.test.ts: fixture + assertion 업데이트
- mock-target-source.test.ts: deleted helper 테스트 제거

## Simplification achieved
- **~200 LOC 감소** (routes + resolver)
- BFF route 공통 패턴 3-step → 2-step
- Mock store 데이터 모델 단순화 (string id 인덱싱 제거)
- 역방향 매핑 helper 제거 (단방향만 남음)

## Out of scope
- `lib/api-client/types.ts` 파라미터명 `projectId` → `targetSourceId`: W4
- URL segment [projectId] rename: W1 (병렬 진행)
- app/projects/ 폴더 해체: W3
- Docs/Swagger: W5

## Preserved (NOT changed)
- `ConfirmResourceMetadata.projectId` — GCP Cloud Project ID
- `Project` interface 필드 구성 (id/targetSourceId/projectCode)
- `lib/bff/client.ts` — 이미 깨끗함
- BFF 모드 동작 (USE_MOCK_DATA=false path)

## Test plan
- [x] `npx tsc --noEmit`
- [x] `npm test`
- [x] `npm run lint`
- [x] `npm run build`
- [x] Mock dev: admin 목록 → 상세 → scan/approval/설치상태 확인 (5 providers)
- [x] Mock dev: queue board

## Ref
- Plan: `docs/reports/projectid-removal/00-README.md`
- Inventory: §4-§7
- Parallel safe: W1 (routing only)
- Follow-up: W4 (api-client types — parameter names), W3 (folder), W5 (docs)
```

## ⛔ Do NOT auto-merge
`gh pr create`까지. PR URL 보고.

## Return (under 300 words — 이 wave는 큰 규모라 250은 부족)
1. PR URL
2. `tsc` / `test` / `lint` / `build` 결과
3. LOC delta 실제 수치 (+N/-M)
4. 수정된 route 파일 수 (기대: ≥50, ideally 59)
5. 삭제된 helper 개수 (기대: 2 from mock-data, 1 from target-source)
6. `ConfirmResourceMetadata.projectId` 보존 확인
7. Mock 전환 중 발견한 비정상 케이스 (있으면):
   - String 연산으로 projectId 쓰던 곳 (S3 bucket 등)
   - 시뮬레이션 해시 함수
   - BFF 모드 전용 경로 (`!IS_MOCK` 분기)
8. Spec 편차 및 사유

## Parallel coordination
- **병렬 가능**: `projid-w1-route-segment` — 파일 완전 분리
- **순차 필요**:
  - `projid-w3-component-relocate`: W1 merge 필요 (이 wave와는 무관)
  - `projid-w4-api-contract-rename`: `lib/api-client/types.ts` 파라미터명 rename — **이 wave의 mock 파일 변경과 signature 연동**. W2 merge 후 W4 착수.
  - `projid-w5-docs-sync`: W1-W4 merge 후.
