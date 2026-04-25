# W1-d — Drift CI Test + Resolver 6-Case Coverage

> **Recommended model**: Sonnet 4.6 (테스트 추가 위주)
> **Estimated LOC**: ~200 (~180 tests + ~20 inline doc)
> **Branch prefix**: `test/guide-cms-w1d-drift-ci`
> **Depends on**: W1-a, W1-c (둘 다 merged)

## Context

Registry ↔ store drift 를 CI 가 잡아내고, resolver 의 6 케이스 (process / shared / missing / duplicate / placement kind / findSlotsForGuide) 모두 커버.

Spec: `docs/reports/guide-cms/spec.md` §8.1 (resolver 6 cases) + §8.2 (drift CI)

## Precondition

```bash
[ -f lib/api-client/mock/guides-seed.ts ] || { echo "✗ W1-c 미머지"; exit 1; }
[ -f lib/constants/guide-registry.ts ] || { echo "✗ W1-a 미머지"; exit 1; }
```

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic guide-cms-w1d-drift-ci --prefix test
```

## Step 2: Drift CI 테스트

### `__tests__/guide-registry-drift.test.ts` (~80 LOC)

```ts
import { GUIDE_NAMES, GUIDE_SLOTS } from '@/lib/constants/guide-registry';
import { guidesSeed } from '@/lib/api-client/mock/guides-seed';
import { validateGuideHtml } from '@/lib/utils/validate-guide-html';

describe('Guide registry drift', () => {
  it('seed keys === GUIDE_NAMES (no extra, no missing)', () => {
    expect(new Set(Object.keys(guidesSeed))).toEqual(new Set(GUIDE_NAMES));
  });

  it('all GUIDE_SLOTS[*].guideName ⊂ GUIDE_NAMES', () => {
    const names = new Set(GUIDE_NAMES);
    for (const slot of Object.values(GUIDE_SLOTS)) {
      expect(names.has(slot.guideName)).toBe(true);
    }
  });

  it('every name in GUIDE_NAMES is referenced by ≥1 slot', () => {
    const referenced = new Set(Object.values(GUIDE_SLOTS).map(s => s.guideName));
    for (const name of GUIDE_NAMES) {
      expect(referenced.has(name)).toBe(true);
    }
  });

  it('every seed entry passes validateGuideHtml on ko (en may be empty)', () => {
    for (const [name, detail] of Object.entries(guidesSeed)) {
      const ko = validateGuideHtml(detail.contents.ko);
      expect(ko.valid, `${name}.ko invalid: ${JSON.stringify((ko as any).errors)}`).toBe(true);
    }
  });
});
```

## Step 3: Resolver 6-case test

### `lib/constants/__tests__/guide-resolver.test.ts` (~100 LOC)

W1-a 에서 만든 기본 테스트를 6 케이스로 확장 (spec §8.1):

```ts
import { resolveSlot, findSlotsForGuide, GUIDE_SLOTS } from '@/lib/constants/guide-registry';
import type { GuideSlotKey, GuideName } from '@/lib/types/guide';

describe('Guide resolver — 6 cases', () => {
  // 1. process-step slot
  it('case 1: resolveSlot returns the correct GuideSlot for a process-step key', () => {
    const slot = resolveSlot('process.aws.auto.3');
    expect(slot.guideName).toBe('AWS_APPLYING');
    expect(slot.placement.kind).toBe('process-step');
    if (slot.placement.kind === 'process-step') {
      expect(slot.placement.provider).toBe('AWS');
      expect(slot.placement.variant).toBe('AUTO');
      expect(slot.placement.step).toBe(3);
    }
  });

  // 2. many-to-one shared slot
  it('case 2: AUTO and MANUAL share the same guideName at step 1', () => {
    expect(resolveSlot('process.aws.auto.1').guideName)
      .toBe(resolveSlot('process.aws.manual.1').guideName);  // = 'AWS_TARGET_CONFIRM'
  });

  // 3. missing slot key (TypeScript error at compile, runtime returns undefined)
  it('case 3: invalid key returns undefined at runtime', () => {
    const r = (GUIDE_SLOTS as Record<string, unknown>)['process.aws.auto.99'];
    expect(r).toBeUndefined();
  });

  // 4. duplicate slot guard (compile-time)
  it('case 4: GUIDE_SLOTS has no duplicate keys (object literal guarantees this)', () => {
    const keys = Object.keys(GUIDE_SLOTS);
    expect(keys.length).toBe(new Set(keys).size);
    expect(keys.length).toBe(28);  // spec §3.3 — 28 slots
  });

  // 5. placement kind branching
  it('case 5: every current slot is process-step kind (out-of-scope kinds not yet used)', () => {
    for (const slot of Object.values(GUIDE_SLOTS)) {
      expect(slot.placement.kind).toBe('process-step');
    }
  });

  // 6. findSlotsForGuide
  it('case 6: findSlotsForGuide returns shared (N=2), forked (N=1), and orphan (N=0)', () => {
    expect(findSlotsForGuide('AWS_TARGET_CONFIRM').length).toBe(2);   // AUTO + MANUAL share step 1
    expect(findSlotsForGuide('AWS_AUTO_INSTALLING').length).toBe(1);  // step 4 fork — AUTO only
    expect(findSlotsForGuide('AZURE_TARGET_CONFIRM').length).toBe(1); // single provider
    // Orphan — type cast to test runtime
    expect(findSlotsForGuide('NON_EXISTENT' as GuideName).length).toBe(0);
  });
});
```

## Step 4: 검증

```bash
npx tsc --noEmit
npm run test:run -- guide-registry-drift guide-resolver
```

- 10+ test cases all pass

## Out of scope

- Admin UI · GuideCard 분리 → W3 / W4
- Cleanup script for orphan store entries — 별도 wave (수동)

## PR body checklist

- [ ] Drift test 4건 (seed keys / slot ⊂ names / 모든 name referenced / 모든 seed validateGuideHtml pass)
- [ ] Resolver test 6 cases per spec §8.1
- [ ] tsc 0, tests 10+ pass
