# W1-c — API Pipeline (Mock + Bff-client + Route + Swagger + Seed + useGuide)

> **Recommended model**: **Opus 4.7 MAX** (10 파일 · ADR-007 경계 · ProblemDetails · seed migration · drift 처리 통합)
> **Estimated LOC**: ~700 (~500 src + ~200 tests)
> **Branch prefix**: `feat/guide-cms-w1c-api-pipeline`
> **Depends on**: W1-a, W1-b (둘 다 merged)

## Context

CSR pipeline 전체 통합. ADR-007 패턴을 엄격히 따른다:
- Route handler 는 `client.method()` 디스패치만
- Mock 비즈니스 로직은 `lib/api-client/mock/guides.ts` (NOT `lib/mocks/`)
- BFF client 는 `lib/api-client/bff-client.ts` 확장 (NOT `lib/bff/client.ts`)
- 에러는 `application/problem+json` (`ProblemDetails`)

Spec: `docs/reports/guide-cms/spec.md` §4 (API contract), §4.5 (drift 처리), §7 (seed)

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f lib/types/guide.ts ] && [ -f lib/constants/guide-registry.ts ] || { echo "✗ W1-a 미머지"; exit 1; }
[ -f lib/utils/validate-guide-html.ts ] || { echo "✗ W1-b 미머지"; exit 1; }
[ ! -f lib/api-client/mock/guides.ts ] || { echo "✗ already exists"; exit 1; }
grep -q "guides:" lib/api-client/types.ts && { echo "✗ already added"; exit 1; }
```

## Required reading

1. `docs/reports/guide-cms/spec.md` §4 (API), §4.5 (drift), §7 (seed)
2. `docs/swagger/guides.yaml` (전체 — 이번에 sync 시킬 대상)
3. `docs/api/boundaries.md` — CSR vs SSR pipeline (`bffClient` vs `bff` 충돌 주의)
4. `docs/adr/007-api-client-pattern.md` — ADR 패턴
5. `lib/api-client/index.ts`, `lib/api-client/types.ts`, `lib/api-client/bff-client.ts` (~30줄씩)
6. `lib/api-client/mock/index.ts`, `lib/api-client/mock/dashboard.ts` (예시 namespace)
7. `app/integration/api/v1/admin/dashboard/summary/route.ts` (예시 route handler — `client.method()` 디스패치 패턴)
8. `app/api/_lib/problem.ts` lines 60-90 — `createProblem`, `problemResponse`
9. `lib/fetch-json.ts` (CSR 에러 정규화)
10. `lib/constants/process-guides.ts` `DEFAULT_STEP_GUIDES` + provider 별 `guide` 필드 (시드 변환 대상)

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic guide-cms-w1c-api-pipeline --prefix feat
```

## Step 2: ApiClient 타입 확장

### `lib/api-client/types.ts` (+15 LOC)

```ts
import type { GuideName, GuideDetail, GuideUpdateInput } from '@/lib/types/guide';

export interface ApiClient {
  // ... 기존
  guides: {
    get(name: GuideName): Promise<GuideDetail>;
    put(name: GuideName, body: GuideUpdateInput): Promise<GuideDetail>;
  };
}
```

## Step 3: Mock namespace

### `lib/api-client/mock/guides.ts` (~200 LOC)

```ts
import 'server-only';
import { GUIDE_NAMES } from '@/lib/constants/guide-registry';
import { validateGuideHtml } from '@/lib/utils/validate-guide-html';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';
import type { GuideName, GuideDetail, GuideUpdateInput } from '@/lib/types/guide';
import { generateRequestId } from '@/lib/request-id';  // 기존 util 확인 — 없으면 inline

// In-memory store (process 재시작 시 초기화)
const store: Map<GuideName, GuideDetail> = new Map();

// Seed (지연 로드 — 첫 호출 시)
let seeded = false;
function ensureSeeded() {
  if (seeded) return;
  const initial = require('@/lib/api-client/mock/guides-seed').guidesSeed;
  for (const [name, detail] of Object.entries(initial) as Array<[GuideName, GuideDetail]>) {
    store.set(name, detail);
  }
  seeded = true;
}

export const mockGuides = {
  async get(name: GuideName): Promise<GuideDetail> {
    ensureSeeded();
    if (!GUIDE_NAMES.includes(name)) {
      // 호출자(route)에서 명시적 catch → problemResponse 변환. 여기선 throw + code attach.
      const e = new Error('Guide not found');
      (e as any).code = 'GUIDE_NOT_FOUND';
      throw e;
    }
    const existing = store.get(name);
    if (existing) return existing;
    // Drift: registry 에 있는데 store 비어있으면 빈 콘텐츠 seed (spec §4.5)
    console.warn(`[mockGuides.get] drift: ${name} not in store, seeding empty`);
    const empty: GuideDetail = { name, contents: { ko: '', en: '' }, updatedAt: new Date(0).toISOString() };
    store.set(name, empty);
    return empty;
  },

  async put(name: GuideName, body: GuideUpdateInput): Promise<GuideDetail> {
    ensureSeeded();
    if (!GUIDE_NAMES.includes(name)) {
      const e = new Error('Guide not found');
      (e as any).code = 'GUIDE_NOT_FOUND';
      throw e;
    }
    // Validation
    const koResult = validateGuideHtml(body.contents.ko);
    const enResult = validateGuideHtml(body.contents.en);
    if (!koResult.valid || !enResult.valid) {
      const e = new Error('Guide content invalid');
      (e as any).code = 'GUIDE_CONTENT_INVALID';
      (e as any).errors = {
        ko: !koResult.valid ? koResult.errors : undefined,
        en: !enResult.valid ? enResult.errors : undefined,
      };
      throw e;
    }
    const detail: GuideDetail = {
      name,
      contents: body.contents,
      updatedAt: new Date().toISOString(),
    };
    store.set(name, detail);
    return detail;
  },
};

// Test infra
export function __resetMockGuideStore() {
  store.clear();
  seeded = false;
}
```

### `lib/api-client/mock/guides-seed.ts` (~150 LOC)

`scripts/migrate-guides-to-html.ts` (Step 6) 의 출력을 그대로 import. 형식:

```ts
import type { GuideName, GuideDetail } from '@/lib/types/guide';

export const guidesSeed: Record<GuideName, GuideDetail> = {
  AWS_TARGET_CONFIRM: {
    name: 'AWS_TARGET_CONFIRM',
    contents: {
      ko: '<h4>...</h4><p>...</p><ul><li>...</li></ul>',
      en: '',  // Admin 이 작성하기 전엔 빈 문자열
    },
    updatedAt: '2026-04-25T00:00:00Z',
  },
  // ... 22개
};
```

### `lib/api-client/mock/index.ts` 수정 (+2 LOC)

```ts
import { mockGuides } from './guides';

export const mockClient: ApiClient = {
  // ... 기존
  guides: mockGuides,
};
```

## Step 4: BFF client 확장

### `lib/api-client/bff-client.ts` (+30 LOC)

```ts
import { fetchUpstream } from './bff-fetch';  // 기존 util — 확인
import type { ApiClient } from './types';
import type { GuideName, GuideDetail, GuideUpdateInput } from '@/lib/types/guide';
import { UPSTREAM_INFRA_API_PREFIX } from '@/lib/infra-api';

const guidesPath = (name: GuideName) => `${UPSTREAM_INFRA_API_PREFIX}/admin/guides/${encodeURIComponent(name)}`;

export const bffClient: ApiClient = {
  // ... 기존
  guides: {
    get: (name) => fetchUpstream<GuideDetail>(guidesPath(name)),
    put: (name, body) => fetchUpstream<GuideDetail>(guidesPath(name), { method: 'PUT', body }),
  },
};
```

> 실 BFF 미연동 — Mock 전용 wave. BFF 응답 envelope 변환은 향후 wave (현 단계는 type 만 맞춤).

## Step 5: Route handler

### `app/integration/api/v1/admin/guides/[name]/route.ts` (~80 LOC)

```ts
import { NextRequest, NextResponse } from 'next/server';
import { client } from '@/lib/api-client';
import { GUIDE_NAMES } from '@/lib/constants/guide-registry';
import type { GuideName, GuideUpdateInput } from '@/lib/types/guide';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';

function isGuideName(name: string): name is GuideName {
  return (GUIDE_NAMES as readonly string[]).includes(name);
}

export async function GET(req: NextRequest, ctx: { params: { name: string } }) {
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  const { name } = ctx.params;
  if (!isGuideName(name)) {
    return problemResponse(createProblem('GUIDE_NOT_FOUND', `Unknown guide name: ${name}`, requestId));
  }
  try {
    const detail = await client.guides.get(name);
    return NextResponse.json(detail);
  } catch (e) {
    const code = (e as any).code ?? 'INTERNAL_ERROR';
    return problemResponse(createProblem(code, (e as Error).message, requestId));
  }
}

export async function PUT(req: NextRequest, ctx: { params: { name: string } }) {
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  const { name } = ctx.params;
  if (!isGuideName(name)) {
    return problemResponse(createProblem('GUIDE_NOT_FOUND', `Unknown guide name: ${name}`, requestId));
  }
  let body: GuideUpdateInput;
  try {
    body = (await req.json()) as GuideUpdateInput;
  } catch {
    return problemResponse(createProblem('INVALID_PARAMETER', 'Invalid JSON', requestId));
  }
  if (!body?.contents || typeof body.contents.ko !== 'string' || typeof body.contents.en !== 'string') {
    return problemResponse(createProblem('VALIDATION_FAILED', 'contents.ko 와 contents.en 이 모두 문자열이어야 합니다', requestId));
  }
  try {
    const detail = await client.guides.put(name, body);
    return NextResponse.json(detail);
  } catch (e) {
    const code = (e as any).code ?? 'INTERNAL_ERROR';
    const problem = createProblem(code, (e as Error).message, requestId);
    if (code === 'GUIDE_CONTENT_INVALID' && (e as any).errors) {
      // ProblemDetails extension — errors 필드 추가
      return NextResponse.json({ ...problem, errors: (e as any).errors }, {
        status: problem.status,
        headers: { 'content-type': 'application/problem+json' },
      });
    }
    return problemResponse(problem);
  }
}
```

## Step 6: Seed migration 스크립트

### `scripts/migrate-guides-to-html.ts` (~120 LOC)

기존 `lib/constants/process-guides.ts` 의 `DEFAULT_STEP_GUIDES` + provider override 를 HTML 로 변환:

```ts
// node tsx scripts/migrate-guides-to-html.ts > lib/api-client/mock/guides-seed.ts
import { GUIDE_SLOTS } from '@/lib/constants/guide-registry';
import { DEFAULT_STEP_GUIDES, AWS_AUTO_GUIDE, AWS_MANUAL_GUIDE, /*...*/ } from '@/lib/constants/process-guides';

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

// Build seed by mapping each GUIDE_SLOTS entry → resolve original via (provider, variant, step)
// 출력 검증: 각 HTML 이 validateGuideHtml() 통과해야 함
```

스크립트 실행 결과를 `lib/api-client/mock/guides-seed.ts` 로 commit.

## Step 7: Swagger sync 검증

`docs/swagger/guides.yaml` 은 PR #372 에서 작성 완료. 이번 PR 에서 변경 없음 — 단 spec 과 정합성 grep 으로 확인:

```bash
grep -c "GUIDE_NOT_FOUND\|GUIDE_CONTENT_INVALID" docs/swagger/guides.yaml
# → 4 이상 (200/PUT 양쪽 응답에 등장)
```

## Step 8: useGuide 훅

### `app/hooks/useGuide.ts` (~60 LOC)

기존 `useApi*` 훅 패턴 참고 (예: `app/hooks/useApiQuery.ts`). SWR 사용 안 함.

```ts
import { useEffect, useState, useCallback } from 'react';
import type { GuideName, GuideDetail, GuideUpdateInput } from '@/lib/types/guide';
import { fetchJson } from '@/lib/fetch-json';
import { INTERNAL_INFRA_API_PREFIX } from '@/lib/infra-api';

interface UseGuideResult {
  data: GuideDetail | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  save: (body: GuideUpdateInput) => Promise<GuideDetail>;
}

export function useGuide(name: GuideName | null): UseGuideResult {
  const [data, setData] = useState<GuideDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!name) return;
    setLoading(true); setError(null);
    try {
      const r = await fetchJson<GuideDetail>(`${INTERNAL_INFRA_API_PREFIX}/admin/guides/${encodeURIComponent(name)}`);
      setData(r);
    } catch (e) { setError(e as Error); }
    finally { setLoading(false); }
  }, [name]);

  useEffect(() => { refresh(); }, [refresh]);

  const save = useCallback(async (body: GuideUpdateInput) => {
    if (!name) throw new Error('No guide selected');
    const r = await fetchJson<GuideDetail>(
      `${INTERNAL_INFRA_API_PREFIX}/admin/guides/${encodeURIComponent(name)}`,
      { method: 'PUT', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } },
    );
    setData(r);
    return r;
  }, [name]);

  return { data, loading, error, refresh, save };
}
```

## Step 9: 통합 테스트

### `lib/api-client/mock/__tests__/guides.test.ts`

```ts
beforeEach(() => __resetMockGuideStore());

it('GET valid name → seeded content', () => {});
it('GET invalid name → throws GUIDE_NOT_FOUND', () => {});
it('GET valid name with empty store → drift seeds empty + warn', () => {});
it('PUT valid → updates store + new updatedAt', () => {});
it('PUT empty ko → throws GUIDE_CONTENT_INVALID with errors.ko EMPTY_CONTENT', () => {});
it('PUT disallowed tag → throws GUIDE_CONTENT_INVALID with DISALLOWED_TAG', () => {});
it('PUT invalid name → throws GUIDE_NOT_FOUND', () => {});
```

### `app/integration/api/v1/admin/guides/[name]/__tests__/route.test.ts`

```ts
it('GET returns 200 with GuideDetail for valid name', () => {});
it('GET returns 404 GUIDE_NOT_FOUND with application/problem+json', () => {});
it('PUT returns 200 + updated detail', () => {});
it('PUT returns 400 GUIDE_CONTENT_INVALID with errors field', () => {});
```

## Step 10: 검증

```bash
npx tsc --noEmit
npm run lint -- lib/api-client/mock/guides.ts lib/api-client/bff-client.ts \
                lib/api-client/types.ts app/hooks/useGuide.ts \
                app/integration/api/v1/admin/guides/
npm run test:run -- guides
# Dev smoke:
bash scripts/dev.sh   # mock 모드
curl http://localhost:3000/integration/api/v1/admin/guides/AZURE_APPLYING | jq .
curl -X PUT http://localhost:3000/integration/api/v1/admin/guides/AZURE_APPLYING \
  -H 'content-type: application/json' \
  -d '{"contents":{"ko":"<h4>x</h4><p>y</p>","en":"<h4>z</h4><p>w</p>"}}' | jq .
```

- tsc 0
- lint 0 새 warning
- 11+ test cases pass
- Dev smoke: 200 / 404 / 400 모두 재현

## Out of scope

- Drift CI · resolver 6-case tests → W1-d
- Admin UI 페이지 → W3
- GuideCard 분리 → W4-a
- Tiptap 통합 → W3-b
- 실 BFF 응답 envelope 변환 — 향후 wave

## PR body checklist

- [ ] `lib/api-client/mock/guides.ts` (NOT `lib/mocks/`) — ADR-007 준수
- [ ] `lib/api-client/bff-client.ts` 확장 (NOT `lib/bff/client.ts`)
- [ ] Route handler 가 `client.guides.*` 디스패치만 (mock 분기 X)
- [ ] ProblemDetails (`application/problem+json`) 응답 + `errors` extension
- [ ] Drift 케이스: 빈 콘텐츠 seed + warn
- [ ] Seed 22 entries 모두 `validateGuideHtml()` 통과
- [ ] Dev smoke 3 케이스 재현
- [ ] tsc 0, lint 0, tests 11+ pass
