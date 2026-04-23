# Wave 11-B3 — Polling Hooks Consolidation

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
Wave 11 consumer task targeting audit §D2 (`mountedRef` overuse), §D4 (duplicated polling logic), §D6 (oversized useCallback deps).

Source:
- `app/hooks/useScanPolling.ts` — 245 LOC, 4 refs (`mountedRef`, `pollingRef`, `prevScanStatusRef`, `onScanCompleteRef`), and setInterval logic duplicated in `init()` (lines 179-199) vs `startPolling()` (lines 121-132)
- `app/hooks/useTestConnectionPolling.ts` — 163 LOC, near-identical skeleton

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f app/hooks/useScanPolling.ts ] && [ -f app/hooks/useTestConnectionPolling.ts ] || { echo "✗ source files missing"; exit 1; }
[ -f app/hooks/usePollingBase.ts ] && { echo "✗ usePollingBase already exists"; exit 1; } || echo "✓ clean slate"
```

No foundation dependency — safe to run in parallel with A1/A2/B2.

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave11-b3-polling-base --prefix refactor
cd /Users/study/pii-agent-demo-wave11-b3-polling-base
```

## Step 2: Required reading
1. `docs/reports/frontend-anti-patterns-audit-2026-04-23.md` §D2, §D4, §D6
2. `.claude/skills/anti-patterns/SKILL.md` §D2, §D4
3. `/vercel-react-best-practices` §5 `rerender-dependencies`, `rerender-use-ref-transient-values`
4. Both hook files end-to-end — compare to spot the shared skeleton vs the genuine differences
5. All consumers to understand the public API each hook exposes:
   ```
   grep -rn 'useScanPolling\|useTestConnectionPolling' app/
   ```

## Step 3: Implementation

### 3-1. Define the base hook → `app/hooks/usePollingBase.ts`

```ts
interface UsePollingBaseOptions<T> {
  interval: number;                              // ms
  fetchOnce: () => Promise<T>;                   // one iteration
  shouldStop: (value: T) => boolean;             // stop polling when true
  onUpdate?: (value: T) => void;                 // called after each successful fetch
  onComplete?: (value: T) => void;               // called once when shouldStop returns true
  enabled?: boolean;                             // default true
}

interface UsePollingBaseResult<T> {
  data: T | null;
  error: Error | null;
  isPolling: boolean;
  refresh: () => Promise<void>;                  // one-shot manual poll
}

export const usePollingBase = <T,>(options: UsePollingBaseOptions<T>): UsePollingBaseResult<T> => { /* ... */ };
```

### 3-2. Implementation rules for the base hook
- **No `mountedRef`**. Use a local `cancelled` boolean captured in effect scope. `return () => { cancelled = true; }` on cleanup.
- `setInterval` is created exactly once per effect. No duplicate scheduling paths.
- `shouldStop` is called after each successful fetch — when it returns true, clear the interval, fire `onComplete`, stop.
- `fetchOnce` errors: capture into `error` state, do **not** stop polling (unless that matches both source hooks' current behavior — double-check).
- `refresh()` performs one fetch, respects `cancelled`, updates the same state as the timer path.

### 3-3. Rewrite `useScanPolling.ts` on top of the base
- Keep the public signature identical — **callers must not change**.
- Collapse internal logic to: build `UsePollingBaseOptions`, hand to `usePollingBase`, return the translated result.
- `prevScanStatusRef` was used for transition detection — if it survives the rewrite, use a `useRef` with a single, clearly-named purpose. Otherwise, encode the transition inside `onComplete` / `shouldStop`.
- Target LOC: under 80.

### 3-4. Rewrite `useTestConnectionPolling.ts` on top of the base
- Same rules as 3-3.
- Target LOC: under 60.

### 3-5. mountedRef count
After the refactor:
```
grep -n mountedRef app/hooks/*.ts
```
must return zero hits.

## Step 4: Do NOT touch
- **Any consumer file** (`ProcessStatusCard`, `ConnectionTestPanel`, etc.). The hook signatures stay stable.
- Other hooks in `app/hooks/` not listed above.
- `lib/` anything.

## Step 5: Verify
```
npx tsc --noEmit
npm run lint -- app/hooks/
npm run build
```

Manual check — this is the highest-risk spec in Wave 11 because polling is stateful across time:
- Open an AWS project, trigger a scan, watch it poll through `RUNNING` → `SUCCESS`
- Trigger a test connection, watch it poll through `PENDING` → `SUCCESS` / `FAIL`
- Unmount the page mid-poll (navigate away) — no errors in console about updates on unmounted components
- Trigger a scan that errors (e.g. invalid credential) — error bubbles to UI, polling recovers on retry

## Step 6: Commit + push + PR
```
git add app/hooks/
git commit -m "refactor(hooks): extract usePollingBase, drop mountedRef (wave11-B3)

Addresses audit §D2/§D4/§D6.

- New usePollingBase<T>({ interval, fetchOnce, shouldStop, onUpdate,
  onComplete, enabled }) — single shared polling skeleton
- useScanPolling.ts 245 → ~80 LOC
- useTestConnectionPolling.ts 163 → ~60 LOC
- mountedRef pattern eliminated (cleanup + cancelled local instead)
- setInterval now created exactly once per effect (previously duplicated
  in init() and startPolling() branches of useScanPolling)
- Public hook signatures unchanged — no consumer migration needed"
git push -u origin refactor/wave11-b3-polling-base
```

PR body (write to `/tmp/pr-wave11-b3-body.md`):
```
## Summary

Extract `usePollingBase<T>` and rewrite `useScanPolling` + `useTest
ConnectionPolling` on top of it, per audit §D2/§D4/§D6.

## Why

`useScanPolling` (245 LOC) and `useTestConnectionPolling` (163 LOC)
share ~70% of their body: setInterval wiring, mount/unmount tracking,
cancellation, error capture. `useScanPolling` even duplicates its own
setInterval logic across two code paths (`init()` vs `startPolling()`).

The `mountedRef` pattern everywhere is a cleanup-shaped problem solved
with a ref — standard anti-pattern §D2.

## Changes
- `app/hooks/usePollingBase.ts` (new, ~80 LOC)
- `app/hooks/useScanPolling.ts` — LOC 245 → ~80
- `app/hooks/useTestConnectionPolling.ts` — LOC 163 → ~60
- `mountedRef` references in `app/hooks/` after this PR: 0

## Preserves
- Public hook signatures — all call sites unchanged
- Observable behavior (poll rate, stop condition, error propagation)

## Test plan
- [x] `npx tsc --noEmit`
- [x] `npm run lint`
- [x] `npm run build`
- [x] Manual: full scan lifecycle (start → RUNNING → SUCCESS)
- [x] Manual: test connection lifecycle (start → PENDING → SUCCESS/FAIL)
- [x] Manual: navigate away mid-poll, no unmount warnings
- [x] Manual: error path (bad credential) surfaces, retries

## Risk
Higher than B1/B2 — polling is time-dependent and edge cases are
harder to spot. Reviewers: pay attention to the `shouldStop` exit
path and the `cancelled` flag in cleanup.

## Ref
- Audit: `docs/reports/frontend-anti-patterns-audit-2026-04-23.md` §D
- Skill: `.claude/skills/anti-patterns/SKILL.md` §D2, §D4
- Parallel: `wave11-A1`, `wave11-A2`, `wave11-B2` — no shared files
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report the URL.

## Return (under 200 words)
1. PR URL
2. `tsc` / `lint` / `build` results
3. LOC before/after for each of the three files
4. `grep mountedRef app/hooks/*.ts` output (should be empty)
5. Any observable behavior that changed (this should be zero — flag if not)
6. Deviations from spec with rationale

## Parallel coordination
- Safe to run in parallel with `wave11-A1`, `wave11-A2`, `wave11-B2` — no shared files
- No prerequisite merges required
