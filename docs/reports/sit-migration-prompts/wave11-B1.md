# Wave 11-B1 — IdcResourceInputPanel → useReducer + Pure Validators

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
Wave 11 consumer task targeting audit §C1 (scattered form state), §D6 (oversized useCallback deps), §G1 (magic timings), and §B6 (function doing too much).

Source: `app/components/features/idc/IdcResourceInputPanel.tsx` — 441 LOC, 10 useStates, `handleSave` useCallback with 10 dependencies, and `validate` mutating an errors object inside a 40-line `forEach`.

## Precondition — wait for A1 merge
```
cd /Users/study/pii-agent-demo
git fetch origin main
git log origin/main --oneline -20 | grep -q "wave11-A1" || { echo "✗ wave11-A1 not merged — this spec imports TIMINGS"; exit 1; }
[ -f lib/constants/timings.ts ] || { echo "✗ lib/constants/timings.ts missing"; exit 1; }
```

If A1 is not yet merged: stop. Do **not** inline the timing constant as a workaround — the whole point is the consumption.

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave11-b1-idc-reducer --prefix refactor
cd /Users/study/pii-agent-demo-wave11-b1-idc-reducer
```

## Step 2: Required reading
1. `docs/reports/frontend-anti-patterns-audit-2026-04-23.md` §C1, §D6, §G1, §B6
2. `.claude/skills/anti-patterns/SKILL.md` §C1, §C3, §D6, §B6
3. `/vercel-react-best-practices` §5 — particularly `rerender-dependencies`, `rerender-functional-setstate`
4. The source file: `app/components/features/idc/IdcResourceInputPanel.tsx` (all 441 LOC)
5. `lib/constants/timings.ts` (merged via A1) — to know what's importable
6. Existing callers of the panel to understand prop contract (grep: `import.*IdcResourceInputPanel`)

## Step 3: Implementation

### 3-1. Extract pure validators → `app/components/features/idc/validation.ts`
Move the per-field validation logic out of the current `validate` callback. Each function takes the field value, returns `string | null` (the error message or null for "valid"). No `this`, no mutation.

```ts
export const validateName = (name: string): string | null => { /* ... */ };
export const validateIps = (ips: string[]): string | null => { /* ... */ };
export const validatePort = (port: number): string | null => { /* ... */ };
export const validateHost = (host: string): string | null => { /* ... */ };
// etc., matching the fields actually validated today
```

An aggregate `validateAll(state: FormState): FormErrors` composes the above. Tests not required for this PR, but structure the functions so they'd be trivial to add.

### 3-2. Introduce `useReducer` for form state
Define `FormState`, `FormAction`, and a `formReducer` in the same file (or `state.ts` sibling if the file grows too large).

```ts
interface FormState {
  name: string;
  inputFormat: 'single' | 'list';
  ips: string[];
  host: string;
  port: number;
  databaseType: DatabaseType;
  serviceId: string;
  credentialId: string;
  errors: FormErrors;
}

type FormAction =
  | { type: 'SET_FIELD'; field: keyof FormState; value: unknown }
  | { type: 'ADD_IP'; ip: string }
  | { type: 'REMOVE_IP'; index: number }
  | { type: 'SET_ERRORS'; errors: FormErrors }
  | { type: 'RESET' };

const formReducer = (state: FormState, action: FormAction): FormState => { /* ... */ };
```

Replace the 10 individual `useState` calls with a single `const [state, dispatch] = useReducer(formReducer, initialState)`.

### 3-3. Trim `handleSave`
After the reducer migration, `handleSave` dependencies should collapse to 3 or fewer: `[state, validateAll, onSave]`. Inside the body, call `validateAll(state)` and dispatch `SET_ERRORS` if anything is invalid.

### 3-4. Replace magic timings
Any `setTimeout(..., 1500)` or similar becomes `setTimeout(..., TIMINGS.COPY_FEEDBACK_MS)` (import from `@/lib/constants/timings`). Only replace values that match exactly — if a timeout doesn't correspond to an existing key, leave a comment explaining.

### 3-5. File LOC target
The refactored `IdcResourceInputPanel.tsx` should land under **300 LOC**. The new `validation.ts` carries the extracted helpers (~80 LOC).

## Step 4: Do NOT touch
- **Any file outside** `app/components/features/idc/IdcResourceInputPanel.tsx` and `app/components/features/idc/validation.ts` (new).
- The `onSave` prop contract — callers must not need updates.
- Styling / JSX structure — only touch JSX when state access must change. No raw-color cleanup, no icon migration (other waves).
- `IdcResourceList.tsx`, `IdcPendingResourceList.tsx`, and other sibling files.

## Step 5: Verify
```
npx tsc --noEmit
npm run lint -- app/components/features/idc/
npm run build
```
All three must pass.

Manual check:
- Open the IDC project page, toggle between 'single' and 'list' input modes
- Add, edit, remove rows — errors surface on the right field
- Submit succeeds when valid; submit shows errors when invalid
- No console warnings about stale state / dependency mismatches

## Step 6: Commit + push + PR
```
git add app/components/features/idc/
git commit -m "refactor(idc): IdcResourceInputPanel useReducer + pure validators (wave11-B1)

Addresses audit §C1/§D6/§G1/§B6.

- 10 useStates → single useReducer(formReducer)
- validate() 40-line forEach with in-place mutation → validateName /
  validateIps / validatePort / validateHost / validateAll pure functions
  in new validation.ts
- handleSave useCallback deps: 10 → 3 ([state, validateAll, onSave])
- Magic setTimeout values → TIMINGS.* from lib/constants/timings
- File LOC: 441 → <300; validation.ts ~80 LOC

No prop contract changes. Callers (IdcProjectPage, IdcResourceTable) untouched."
git push -u origin refactor/wave11-b1-idc-reducer
```

PR body (write to `/tmp/pr-wave11-b1-body.md`):
```
## Summary

Refactor `IdcResourceInputPanel` from 10 scattered useStates and a
440-line single-function design into a `useReducer` + pure-validator
split, per audit §C1/§D6/§G1/§B6.

## Why

The current file is the clearest case of form-state sprawl in the
codebase:
- 10 separate useStates for one logical form
- `handleSave` useCallback with 10 dependencies — memoization no-op
- `validate()` mutates an errors object inside a 40-line forEach
- Magic timings that `wave11-A1` already centralized

## Changes
- `app/components/features/idc/IdcResourceInputPanel.tsx`
  - 10 useStates → 1 useReducer
  - handleSave deps 10 → 3
  - Swap inline timings for `TIMINGS.*`
  - LOC 441 → ≤300
- `app/components/features/idc/validation.ts` (new)
  - `validateName`, `validateIps`, `validatePort`, `validateHost`, `validateAll`
  - Pure functions, no state mutation

## Depends on
- `wave11-A1` (constants foundation — merged) — imports `TIMINGS`

## Deliberately excluded
- Prop contract changes (callers unchanged)
- JSX restructure outside what state-access demands
- Icon / raw-color cleanup (different waves)

## Test plan
- [x] `npx tsc --noEmit`
- [x] `npm run lint`
- [x] `npm run build`
- [x] Manual: single/list toggle, add/edit/remove row, valid submit, invalid submit
- [x] No console warnings

## Ref
- Audit: `docs/reports/frontend-anti-patterns-audit-2026-04-23.md`
- Skill: `.claude/skills/anti-patterns/SKILL.md` §C1, §D6, §B6
- Parallel: not parallel-safe with A1 (depends on it)
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report the URL.

## Return (under 200 words)
1. PR URL
2. `tsc` / `lint` / `build` results
3. LOC before/after for `IdcResourceInputPanel.tsx` and the new `validation.ts`
4. Final useCallback dep count for `handleSave`
5. Any validator semantics that surprised you during extraction (edge cases not obvious from the original code)
6. Deviations from spec with rationale

## Parallel coordination
- **Depends on**: `wave11-A1` merged (must appear in origin/main before this starts)
- Safe to run in parallel with `wave11-A2`, `wave11-B2`, `wave11-B3` once A1 is merged — no file overlap
