# W1-c — API Pipeline (NextResponse dispatch + Mock + Bff-client + Route + Seed + Tests)

> **Recommended model**: **Opus 4.7 MAX** (10+ 파일 · ADR-007 NextResponse 디스패치 · ProblemDetails · drift seed · drift CI + resolver 6-case tests 통합)
> **Estimated LOC**: ~900 (~600 src + ~300 tests)
> **Branch prefix**: `feat/guide-cms-w1c-api-pipeline`
> **Depends on**: W1-a, W1-b (둘 다 merged)

## Context

CSR pipeline 전체 통합. **ADR-007 을 엄격히 따른다** — 이 점이 이전 draft 의 Critical 결함이었다.

검증된 실체 (`lib/api-client/types.ts`, `app/integration/api/v1/admin/dashboard/summary/route.ts`):

```ts
// ApiClient 의 모든 method 는 Promise<NextResponse> 반환
export interface ApiClient {
  dashboard: { summary: () => Promise<NextResponse>; /* ... */ };
}

// Route handler 는 client.method() 디스패치만
export const GET = withV1(async () => {
  return client.dashboard.summary();
}, { expectedDuration: '100ms ~ 500ms' });
```

→ **Path validation, body parsing, ProblemDetails 생성, NextResponse.json() 모두 `lib/api-client/mock/guides.ts` (mock layer) 에서 수행**한다. Route 는 thin dispatch.

또한 W1-d (drift CI + resolver 6-case tests) 를 이 PR 에 통합한다 — drift 검증은 API pipeline 의 acceptance gate 이지 별도 PR 가치가 없다 (Codex 권고).

Spec: `docs/reports/guide-cms/spec.md` §4 + §4.5 (drift) + §7 (seed) + §8.1 (resolver tests) + §8.2 (drift CI)

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f lib/types/guide.ts ] && [ -f lib/constants/guide-registry.ts ] || { echo "✗ W1-a 미머지"; exit 1; }
[ -f lib/utils/validate-guide-html.ts ] || { echo "✗ W1-b 미머지"; exit 1; }
grep -q "GUIDE_NAMES" lib/constants/guide-registry.ts || { echo "✗ W1-a 가 GUIDE_NAMES 를 registry 에서 re-export 해야 함"; exit 1; }
[ ! -f lib/api-client/mock/guides.ts ] || { echo "✗ already exists"; exit 1; }
grep -q "guides:" lib/api-client/types.ts && { echo "✗ already added"; exit 1; }
[ -f lib/infra-api.ts ] && grep -q "INTERNAL_INFRA_API_PREFIX" lib/infra-api.ts || { echo "✗ infra-api 누락"; exit 1; }
```

## Required reading (필독)

1. `docs/reports/guide-cms/spec.md` §4, §4.5 (drift), §7 (seed)
2. `docs/swagger/guides.yaml` 전체 (계약 검증 대상)
3. `docs/api/boundaries.md` — CSR vs SSR pipeline (`bffClient` vs `bff` 충돌 주의)
4. `docs/adr/007-api-client-pattern.md` 전체 — `client.method()` 디스패치 패턴
5. `lib/api-client/types.ts` (전체 — `ApiClient` 인터페이스 의 method signature 모두 `Promise<NextResponse>`)
6. `lib/api-client/index.ts`, `lib/api-client/mock/index.ts`, `lib/api-client/bff-client.ts` (~30줄씩)
7. `lib/api-client/mock/dashboard.ts` (예시 namespace — `NextResponse.json(...)` 패턴)
8. `app/integration/api/v1/admin/dashboard/summary/route.ts` 전체 (~5줄, 디스패치 패턴 정확히 준수)
9. `app/api/_lib/handler.ts` — `withV1` 시그니처 (`expectedDuration` opt 등)
10. `app/api/_lib/problem.ts` lines 1-90 — `KnownErrorCode` (W1-a 가 `GUIDE_NOT_FOUND`/`GUIDE_CONTENT_INVALID` 추가했음), `createProblem`, `problemResponse`, `application/problem+json`
11. `lib/fetch-json.ts` lines 122-160 — **`body` 가 object 면 자동 `JSON.stringify` 처리**. 호출부에서 `JSON.stringify` 절대 금지 (이중 인코딩 발생)
12. `app/hooks/useApiMutation.ts` — mutation pattern (CLAUDE.md `try-catch 직접 작성 금지` 규칙)
13. `lib/constants/process-guides.ts` `DEFAULT_STEP_GUIDES` + provider override 의 `guide` 필드 (시드 변환 대상)

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic guide-cms-w1c-api-pipeline --prefix feat
```

## Step 2: ApiClient 타입 확장

### `lib/api-client/types.ts` (+10 LOC)

```ts
export interface ApiClient {
  // ... 기존 namespace 모두 유지
  guides: {
    get: (name: string) => Promise<NextResponse>;
    put: (name: string, body: unknown) => Promise<NextResponse>;
  };
}
```

> `body: unknown` 채택 이유: 다른 namespace 와 동일 패턴 (`projects.create: (body: unknown)`). 실제 검증은 mock 안에서 수행.

## Step 3: Mock namespace (실제 비즈니스 로직 위치)

### `lib/api-client/mock/guides.ts` (~250 LOC)

```ts
import { NextResponse } from 'next/server';
import { GUIDE_NAMES } from '@/lib/constants/guide-registry';
import { validateGuideHtml } from '@/lib/utils/validate-guide-html';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';
import { getRequestId } from '@/app/api/_lib/request-id';
import type { GuideName, GuideDetail, GuideContents } from '@/lib/types/guide';

// In-memory store (process 재시작 시 초기화)
const store: Map<GuideName, GuideDetail> = new Map();

// Seed (첫 호출 시 lazy)
let seeded = false;
function ensureSeeded() {
  if (seeded) return;
  // require 사용 — circular dep 방지. 빌드 시점에 seed 모듈이 평가되지 않게.
  const { guidesSeed } = require('./guides-seed') as { guidesSeed: Record<GuideName, GuideDetail> };
  for (const name of GUIDE_NAMES) {
    const entry = guidesSeed[name];
    if (entry) store.set(name, entry);
  }
  seeded = true;
}

function isGuideName(name: string): name is GuideName {
  return (GUIDE_NAMES as readonly string[]).includes(name);
}

interface UpdateBody { contents: GuideContents }

function isUpdateBody(body: unknown): body is UpdateBody {
  if (typeof body !== 'object' || body === null) return false;
  const c = (body as Record<string, unknown>).contents;
  if (typeof c !== 'object' || c === null) return false;
  const co = c as Record<string, unknown>;
  return typeof co.ko === 'string' && typeof co.en === 'string';
}

export const mockGuides = {
  async get(name: string): Promise<NextResponse> {
    const requestId = getRequestId();
    if (!isGuideName(name)) {
      return problemResponse(
        createProblem('GUIDE_NOT_FOUND', `Unknown guide name: ${name}`, requestId),
      );
    }
    ensureSeeded();
    const existing = store.get(name);
    if (existing) return NextResponse.json(existing);
    // Drift: registry 에 있는데 store 비어있으면 빈 콘텐츠 seed (spec §4.5)
    console.warn(`[mockGuides.get] drift: ${name} not in store, seeding empty`);
    const empty: GuideDetail = {
      name,
      contents: { ko: '', en: '' },
      updatedAt: new Date(0).toISOString(),  // epoch — 비어있는 신호
    };
    store.set(name, empty);
    return NextResponse.json(empty);
  },

  async put(name: string, body: unknown): Promise<NextResponse> {
    const requestId = getRequestId();
    if (!isGuideName(name)) {
      return problemResponse(
        createProblem('GUIDE_NOT_FOUND', `Unknown guide name: ${name}`, requestId),
      );
    }
    if (!isUpdateBody(body)) {
      return problemResponse(
        createProblem('VALIDATION_FAILED', 'contents.ko 와 contents.en 이 모두 문자열이어야 합니다', requestId),
      );
    }
    ensureSeeded();
    const koResult = validateGuideHtml(body.contents.ko);
    const enResult = validateGuideHtml(body.contents.en);
    if (!koResult.valid || !enResult.valid) {
      const problem = createProblem(
        'GUIDE_CONTENT_INVALID',
        'ko, en 모두 작성되어야 하며 허용된 HTML 태그만 사용할 수 있습니다.',
        requestId,
      );
      // ProblemDetails extension — errors 필드 추가
      return NextResponse.json(
        {
          ...problem,
          errors: {
            ko: !koResult.valid ? koResult.errors : undefined,
            en: !enResult.valid ? enResult.errors : undefined,
          },
        },
        { status: problem.status, headers: { 'content-type': 'application/problem+json' } },
      );
    }
    const detail: GuideDetail = {
      name,
      contents: body.contents,
      updatedAt: new Date().toISOString(),
    };
    store.set(name, detail);
    return NextResponse.json(detail);
  },
};

// Test infra
export function __resetMockGuideStore() {
  store.clear();
  seeded = false;
}
```

> 핵심: 이 layer 가 `NextResponse` 를 반환한다. 외부에서는 envelope 변환 없음.

### `lib/api-client/mock/guides-seed.ts` (~150 LOC)

Step 6 의 migration 스크립트 출력. 형식:

```ts
import type { GuideName, GuideDetail } from '@/lib/types/guide';

export const guidesSeed: Record<GuideName, GuideDetail> = {
  AWS_TARGET_CONFIRM: {
    name: 'AWS_TARGET_CONFIRM',
    contents: {
      ko: '<h4>...</h4><p>...</p><ul><li>...</li></ul>',
      en: '',
    },
    updatedAt: '2026-04-25T00:00:00Z',
  },
  // ... 22개
};
```

### `lib/api-client/mock/index.ts` (+2 LOC)

```ts
import { mockGuides } from './guides';

export const mockClient: ApiClient = {
  // ... 기존
  guides: mockGuides,
};
```

## Step 4: BFF client 확장

### `lib/api-client/bff-client.ts` (+30 LOC)

상류 BFF 호출. `Promise<NextResponse>` 반환 위해 응답을 그대로 전달:

```ts
import { UPSTREAM_INFRA_API_PREFIX } from '@/lib/infra-api';
// 기존 fetchUpstream / proxyUpstream 헬퍼 패턴 확인 후 따름

const guidesPath = (name: string) => `${UPSTREAM_INFRA_API_PREFIX}/admin/guides/${encodeURIComponent(name)}`;

export const bffClient: ApiClient = {
  // ... 기존
  guides: {
    get: (name) => proxyUpstream(guidesPath(name)),
    put: (name, body) => proxyUpstream(guidesPath(name), { method: 'PUT', body }),
  },
};
```

> 실 BFF 미연동 — Mock 모드 전용. 실 응답 envelope 변환은 향후 wave.

## Step 5: Route handler (thin dispatch)

### `app/integration/api/v1/admin/guides/[name]/route.ts` (~30 LOC)

```ts
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';

export const GET = withV1(async (_req, ctx) => {
  return client.guides.get(ctx.params.name);
}, { expectedDuration: '100ms ~ 500ms' });

export const PUT = withV1(async (req, ctx) => {
  const body = await req.json().catch(() => null) as unknown;
  return client.guides.put(ctx.params.name, body);
}, { expectedDuration: '200ms ~ 1s' });
```

> `body === null` 일 때도 mock layer 의 `isUpdateBody` 가 false → `VALIDATION_FAILED` 반환.

## Step 6: Seed migration 스크립트

### `scripts/migrate-guides-to-html.ts` (~150 LOC)

```ts
// 실행: npx tsx scripts/migrate-guides-to-html.ts > lib/api-client/mock/guides-seed.ts
import { GUIDE_SLOTS } from '@/lib/constants/guide-registry';
import {
  AWS_AUTO_GUIDE, AWS_MANUAL_GUIDE, /* AZURE_GUIDE, GCP_GUIDE */
} from '@/lib/constants/process-guides';
import type { GuideInline, StepGuideContent } from '@/lib/types/process-guide';
import { validateGuideHtml } from '@/lib/utils/validate-guide-html';

function inlineToHtml(parts: GuideInline[]): string {
  return parts.map(p => {
    if (typeof p === 'string') return escapeHtml(p);
    if ('strong' in p) return `<strong>${escapeHtml(p.strong)}</strong>`;
    return `<a href="${escapeAttr(p.href)}">${escapeHtml(p.link)}</a>`;
  }).join('');
}

function stepGuideToHtml(g: StepGuideContent): string {
  const heading = `<h4>${escapeHtml(g.heading)}</h4>`;
  const summary = `<p>${inlineToHtml(g.summary)}</p>`;
  const bullets = g.bullets.length > 0
    ? `<ul>${g.bullets.map(b => `<li>${inlineToHtml(b)}</li>`).join('')}</ul>`
    : '';
  return heading + summary + bullets;
}

// (provider, variant, step) → original guide 매핑 → guideName 별 ko HTML 생성
// 22 결과 모두 validateGuideHtml() 통과 검증 (실패 시 process exit 1)
```

스크립트 결과를 `lib/api-client/mock/guides-seed.ts` 로 commit.

## Step 7: Swagger sync 검증

`docs/swagger/guides.yaml` 은 PR #372 에서 작성 완료. 변경 없음 — 단 정합성 grep:

```bash
grep -c "GUIDE_NOT_FOUND\|GUIDE_CONTENT_INVALID" docs/swagger/guides.yaml  # ≥ 4
grep -q "/integration/api/v1" docs/swagger/guides.yaml  # → 1
```

## Step 8: useGuide 훅

### `app/hooks/useGuide.ts` (~80 LOC)

CLAUDE.md `try-catch 직접 작성 금지` → `useApiMutation()` 활용. **`fetchJson` 의 body 자동 stringify 활용** (호출부에서 JSON.stringify 사용 X — 이중 인코딩 발생).

```ts
import { useEffect, useState, useCallback } from 'react';
import { fetchJson } from '@/lib/fetch-json';
import { useApiMutation } from '@/app/hooks/useApiMutation';
import { INTERNAL_INFRA_API_PREFIX } from '@/lib/infra-api';
import type { GuideName, GuideDetail, GuideUpdateInput } from '@/lib/types/guide';

const url = (name: GuideName) =>
  `${INTERNAL_INFRA_API_PREFIX}/admin/guides/${encodeURIComponent(name)}`;

export function useGuide(name: GuideName | null) {
  const [data, setData] = useState<GuideDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!name) return;
    setLoading(true); setError(null);
    try {
      const r = await fetchJson<GuideDetail>(url(name));
      setData(r);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => { refresh(); }, [refresh]);

  const saveMutation = useApiMutation(async (body: GuideUpdateInput) => {
    if (!name) throw new Error('No guide selected');
    // body 는 object — fetchJson 이 자동 stringify (lib/fetch-json.ts:138-150)
    const r = await fetchJson<GuideDetail>(url(name), { method: 'PUT', body });
    setData(r);
    return r;
  });

  return { data, loading, error, refresh, save: saveMutation.execute, saving: saveMutation.loading };
}
```

> ⚠️ `fetchJson` 호출 시 `body` 는 object 그대로 전달. `JSON.stringify(body)` 사용 시 **이중 인코딩 버그** (lib/fetch-json.ts:138-150 이 자동 stringify 함).

## Step 9: 통합 테스트

### `lib/api-client/mock/__tests__/guides.test.ts` (~120 LOC)

```ts
import { mockGuides, __resetMockGuideStore } from '../guides';

beforeEach(() => __resetMockGuideStore());

describe('mockGuides.get', () => {
  it('returns 200 + GuideDetail for a valid seeded name', async () => {});
  it('returns 404 GUIDE_NOT_FOUND with application/problem+json for invalid name', async () => {
    const res = await mockGuides.get('NOT_A_NAME');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
    const body = await res.json();
    expect(body.code).toBe('GUIDE_NOT_FOUND');
  });
  it('drift: valid name with empty store seeds empty contents (200) + warn', async () => {});
});

describe('mockGuides.put', () => {
  it('200 + updated detail with new updatedAt', async () => {});
  it('400 GUIDE_CONTENT_INVALID with errors.ko EMPTY_CONTENT when ko empty', async () => {});
  it('400 GUIDE_CONTENT_INVALID with errors.ko DISALLOWED_TAG when ko has <script>', async () => {});
  it('400 VALIDATION_FAILED when body is not the expected shape', async () => {});
  it('404 GUIDE_NOT_FOUND for invalid name', async () => {});
});
```

### `app/integration/api/v1/admin/guides/[name]/__tests__/route.test.ts` (~80 LOC)

```ts
// withV1 wrapper + dispatch 검증 — Next.js test util 또는 직접 invoke
// 단순히 route 가 client.guides.* 를 호출하는지만 확인 (mock layer 가 별도 테스트됨)
```

### Drift CI + Resolver 6-case (`__tests__/guide-registry-drift.test.ts`, `lib/constants/__tests__/guide-resolver.test.ts`) (~150 LOC)

W1-d 에서 분리되어 있던 내용 통합:

```ts
describe('Guide registry drift', () => {
  it('seed keys === GUIDE_NAMES', () => {});
  it('all GUIDE_SLOTS[*].guideName ⊂ GUIDE_NAMES', () => {});
  it('every name in GUIDE_NAMES is referenced by ≥1 slot', () => {});
  it('every seed entry passes validateGuideHtml on ko (en may be empty)', () => {});
});

describe('Guide resolver — 6 cases', () => {
  it('case 1: resolveSlot for process-step key', () => {});
  it('case 2: AUTO and MANUAL share guideName at step 1', () => {});
  it('case 3: invalid key returns undefined at runtime', () => {});
  it('case 4: GUIDE_SLOTS has 28 unique keys (compile-time guard)', () => {});
  it('case 5: every current slot is process-step kind', () => {});
  it('case 6: findSlotsForGuide returns shared (N=2), forked (N=1), orphan (N=0)', () => {});
});
```

## Step 10: 검증

```bash
npx tsc --noEmit
npm run lint -- lib/api-client/mock/guides.ts lib/api-client/bff-client.ts \
                lib/api-client/types.ts app/hooks/useGuide.ts \
                app/integration/api/v1/admin/guides/
npm run test:run -- guides guide-registry-drift guide-resolver
npm run build  # CSR pipeline + route handler 추가 → 빌드 영향 큼
# Dev smoke
bash scripts/dev.sh
curl -s http://localhost:3000/integration/api/v1/admin/guides/AZURE_APPLYING | jq .
curl -s http://localhost:3000/integration/api/v1/admin/guides/INVALID -i | head -5    # 404 problem+json
curl -s -X PUT http://localhost:3000/integration/api/v1/admin/guides/AZURE_APPLYING \
  -H 'content-type: application/json' \
  -d '{"contents":{"ko":"<h4>x</h4><p>y</p>","en":"<h4>z</h4><p>w</p>"}}' | jq .
```

- tsc 0
- lint 0 새 warning
- 테스트 20+ pass (guides 11 + drift 4 + resolver 6)
- `npm run build` exit 0
- Dev smoke: 200 (valid) / 404 problem+json (invalid name) / 400 problem+json + errors (invalid HTML) 모두 재현

## ⛔ 함정 / 자주 하는 실수

- ❌ Route handler 에서 try/catch + `NextResponse.json()` — ADR-007 위반. mock layer 가 NextResponse 반환.
- ❌ `client.guides.get/put` 가 `Promise<GuideDetail>` 반환 — 실제 ApiClient 시그니처 어김. 반드시 `Promise<NextResponse>`.
- ❌ `(e as any)` — `unknown` + 타입 가드 사용
- ❌ `fetchJson(url, { body: JSON.stringify(body) })` — 이중 인코딩. `body: body` (object) 그대로.
- ❌ `lib/mocks/` 또는 `lib/bff/client.ts` 확장 — ADR-007 어김. `lib/api-client/mock/`, `lib/api-client/bff-client.ts` 만 사용.

## Out of scope

- Admin UI 페이지 → W3
- GuideCard 분리 → W4-a
- Tiptap 통합 → W3-b
- 실 BFF 응답 envelope 변환 → 향후 wave

## PR body template

```markdown
## Summary
- Spec: `docs/reports/guide-cms/wave-tasks/W1-c-api-pipeline.md` @ <SHA>
- Wave: W1-c (API pipeline + drift CI + resolver tests)
- 의존: W1-a, W1-b

## Changed files (net LOC)
<git diff --stat>

## Verification
- [ ] tsc exit 0
- [ ] npm run lint — 0 new warnings
- [ ] npm run test — guides + drift + resolver 20+ pass
- [ ] npm run build — exit 0
- [ ] Dev smoke — 200 / 404 problem+json / 400 problem+json + errors 모두 재현

## ADR-007 compliance
- [ ] `client.guides.get/put` 반환 타입 `Promise<NextResponse>`
- [ ] Route handler 는 `withV1(() => client.guides.x())` 디스패치만
- [ ] Mock 비즈니스 로직은 `lib/api-client/mock/guides.ts`
- [ ] `lib/bff/client.ts` (`bff` export) 미수정 (서로 다른 pipeline)

## Deviations from spec
<없으면 "None">

## Deferred to later waves
<없으면 "None">
```
