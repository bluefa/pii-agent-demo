# W1-a — Foundation: Types + Registry + Error Catalog

> **Recommended model**: Sonnet 4.6 (데이터 정의 위주, MAX 불필요)
> **Estimated LOC**: ~400 (~280 src + ~120 tests)
> **Branch prefix**: `feat/guide-cms-w1a-foundation`

## Context

Guide CMS 의 type system + slot registry + error catalog 기반 작업. 이후 W1-b/c/d 가 모두 이 모듈을 import 한다.

Source: 신규.
Spec: `docs/reports/guide-cms/spec.md` §3 + `docs/adr/010-guide-cms-slot-registry.md`

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f docs/reports/guide-cms/spec.md ] || { echo "✗ spec missing — PR #372 미머지?"; exit 1; }
[ -f docs/adr/010-guide-cms-slot-registry.md ] || { echo "✗ ADR missing"; exit 1; }
[ ! -f lib/constants/guide-registry.ts ] || { echo "✗ already exists"; exit 1; }
grep -q "GUIDE_NOT_FOUND" app/api/_lib/problem.ts && { echo "✗ already added"; exit 1; }
```

## Required reading

1. `docs/reports/guide-cms/spec.md` §3 (data model) + §4.7 (error codes)
2. `docs/adr/010-guide-cms-slot-registry.md` (slot registry 결정 근거)
3. `app/api/_lib/problem.ts` lines 1-90 — `KnownErrorCode` union, `ERROR_CATALOG`, `ProblemDetails`
4. `lib/types/process-guide.ts` — 기존 가이드 타입 (참고)

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic guide-cms-w1a-foundation --prefix feat
```

## Step 2: 신규 파일

### `lib/types/guide.ts` (~80 LOC)

```ts
// 22 guide names — spec §3.1 그대로
export const GUIDE_NAMES = [/* 22개 */] as const;
export type GuideName = (typeof GUIDE_NAMES)[number];

// Discriminated union — spec §3.2
export type GuidePlacement =
  | { kind: 'process-step'; provider: 'AWS' | 'AZURE' | 'GCP'; variant?: 'AUTO' | 'MANUAL'; step: 1|2|3|4|5|6|7; stepLabel: string }
  | { kind: 'side-panel'; surface: string }
  | { kind: 'tooltip'; surface: string; field: string }
  | { kind: 'faq'; section: string; order: number };

export interface GuideSlot {
  guideName: GuideName;
  placement: GuidePlacement;
  component: 'GuideCard' | 'TooltipGuide' | 'SidePanelGuide';
}

export interface GuideContents { ko: string; en: string }
export interface GuideDetail {
  name: GuideName;
  contents: GuideContents;
  updatedAt: string;  // ISO 8601, non-null. drift 케이스 = epoch ISO ('1970-01-01T00:00:00Z'), NOT null — Swagger contract 은 non-null date-time
}
export interface GuideUpdateInput { contents: GuideContents }
```

### `lib/constants/guide-registry.ts` (~150 LOC)

spec §3.3 의 `GUIDE_SLOTS` 28개를 그대로 const 객체로. 추가로 `GUIDE_NAMES` / `GuideName` 을 `lib/types/guide.ts` 에서 재-export (W1-c 가 `@/lib/constants/guide-registry` 경로로 import 하므로 두 경로 모두 지원 필요):

```ts
// lib/constants/guide-registry.ts
export { GUIDE_NAMES, type GuideName } from '@/lib/types/guide';

export const GUIDE_SLOTS = { /* 28 entries — spec §3.3 */ } as const;
export type GuideSlotKey = keyof typeof GUIDE_SLOTS;

export function resolveSlot(key: GuideSlotKey): GuideSlot {
  return GUIDE_SLOTS[key];
}

export function findSlotsForGuide(name: GuideName): GuideSlot[] {
  return Object.values(GUIDE_SLOTS).filter(s => s.guideName === name);
}
```

### `app/api/_lib/problem.ts` 수정 (~10 LOC)

기존 `KnownErrorCode` union + `ERROR_CATALOG` 에 2 개 추가:

```ts
| 'GUIDE_NOT_FOUND'
| 'GUIDE_CONTENT_INVALID'
```

```ts
GUIDE_NOT_FOUND:        { status: 404, title: 'Guide Not Found',        retriable: false },
GUIDE_CONTENT_INVALID:  { status: 400, title: 'Guide Content Invalid',  retriable: false },
```

## Step 3: 테스트 (~120 LOC)

### `lib/constants/__tests__/guide-registry.test.ts`

6 케이스 (spec §8.1):

```ts
describe('guide-registry', () => {
  it('GUIDE_NAMES has exactly 22 entries', () => {});
  it('all GUIDE_SLOTS[*].guideName ⊂ GUIDE_NAMES', () => {});
  it('resolveSlot returns the correct slot for a process-step key', () => {});
  it('findSlotsForGuide returns N=2 for AWS_TARGET_CONFIRM (auto + manual)', () => {});
  it('findSlotsForGuide returns N=1 for AWS_AUTO_INSTALLING (auto-only fork)', () => {});
  it('findSlotsForGuide returns N=0 for an orphan name (type-cast)', () => {});
});
```

### `lib/types/__tests__/guide.test.ts`

타입 가드 :
```ts
it('GuidePlacement narrows correctly via kind', () => {
  const p: GuidePlacement = { kind: 'process-step', provider: 'AWS', step: 1, stepLabel: 'x' };
  if (p.kind === 'process-step') expect(p.provider).toBeDefined();
});
```

## Step 4: 검증

```bash
npx tsc --noEmit
npm run lint -- lib/types/guide.ts lib/constants/guide-registry.ts app/api/_lib/problem.ts
npm run test:run -- guide-registry guide
```

- `tsc` exit 0
- 새 lint warning 0
- 8 tests pass

## Out of scope

- Mock store · API route · seed migration → W1-c
- HTML validator · AST renderer → W1-b
- Drift CI test (mock store ↔ registry) → W1-d
- Admin UI → W3
- GuideCard refactor → W4

## PR body checklist

- [ ] 22 GUIDE_NAMES 모두 spec §3.1 표와 1:1 일치
- [ ] 28 GUIDE_SLOTS 모두 spec §3.3 와 1:1 일치 (slot key 명명, stepLabel)
- [ ] 2 신규 error code `ERROR_CATALOG` 등록
- [ ] tsc 0, lint 0, tests 8 pass

## PR body template

```markdown
## Summary
- Spec: `docs/reports/guide-cms/wave-tasks/W1-a-foundation-types-registry.md` @ <SHA>
- Wave: W1-a (foundation: types + registry + error catalog)
- 의존: 없음 (PR #372 머지 후 main 기준)

## Verification
- [ ] tsc exit 0
- [ ] npm run lint — 0 new warnings
- [ ] npm run test — registry/types tests pass
- (npm run build 불필요 — 타입과 상수만, no UI/API)

## Deviations from spec
<없으면 "None">

## Deferred to later waves
<없으면 "None">
```
