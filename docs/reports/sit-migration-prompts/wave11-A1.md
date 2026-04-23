# Wave 11-A1 — Constants Foundation

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
Wave 11 foundation task. Creates the `lib/constants/` module that audit items G1, G2, G3, G6 are meant to consume. This spec **creates new files only** — no consumer migration.

Audit evidence: `docs/reports/frontend-anti-patterns-audit-2026-04-23.md` §G.

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
ls lib/constants/ 2>/dev/null && { echo "✗ lib/constants/ already exists — rethink scope"; exit 1; } || echo "✓ clean slate"
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave11-a1-constants --prefix refactor
cd /Users/study/pii-agent-demo-wave11-a1-constants
```

## Step 2: Required reading
1. `docs/reports/frontend-anti-patterns-audit-2026-04-23.md` §G (Naming & Constants)
2. `.claude/skills/anti-patterns/SKILL.md` §G1, G2, G3, G6
3. Scan cited evidence files to confirm exact values:
   - `app/components/layout/TopNav.tsx:89` (2000ms)
   - `app/components/features/AzureInfoCard.tsx:65` (1500ms)
   - `app/components/features/ProcessStatusCard.tsx:151` (10_000ms)
   - `app/components/features/AwsInfoCard.tsx:17`, `GcpInfoCard.tsx:20`, `AzureInfoCard.tsx:20` (CREDENTIAL_PREVIEW_COUNT)
   - `app/components/features/resource-table/ResourceTypeGroup.tsx:11`, `GroupedResourceTableBody.tsx:12`, `InstancePanel.tsx:8` (COLLAPSE_THRESHOLD)
   - `lib/api-client/idc.ts:10,19,30,41,50,66,83,99` (error message duplication)

## Step 3: Implementation

### 3-1. `lib/constants/timings.ts`
```ts
export const TIMINGS = {
  TOAST_HIDE_MS: 2000,
  COPY_FEEDBACK_MS: 1500,
  SHAKE_ANIMATION_MS: 500,
  PROCESS_STATUS_POLL_MS: 10_000,
  SCAN_POLL_INTERVAL_MS: 2000,
  TEST_CONNECTION_POLL_MS: 2000,
} as const;

export type TimingKey = keyof typeof TIMINGS;
```

Only include values already present in the codebase. Do **not** invent new ones.

### 3-2. `lib/constants/ui.ts`
```ts
export const UI_LIMITS = {
  CREDENTIAL_PREVIEW_COUNT: 3,
  COLLAPSE_THRESHOLD: 5,
  PORT_MAX: 65535,
} as const;

export type UiLimitKey = keyof typeof UI_LIMITS;
```

### 3-3. `lib/constants/statuses.ts`

Derive the literal unions from the audit's G3 evidence. One `as const` object per domain:

```ts
export const ResourceStatus = {
  VALID: 'VALID',
  INVALID: 'INVALID',
  PENDING: 'PENDING',
} as const;
export type ResourceStatus = typeof ResourceStatus[keyof typeof ResourceStatus];

export const TestConnectionStatus = {
  SUCCESS: 'SUCCESS',
  FAIL: 'FAIL',
  PENDING: 'PENDING',
} as const;
export type TestConnectionStatus = typeof TestConnectionStatus[keyof typeof TestConnectionStatus];

export const ApprovalStatus = {
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PENDING: 'PENDING',
} as const;
export type ApprovalStatus = typeof ApprovalStatus[keyof typeof ApprovalStatus];

export const ScriptStatus = {
  PENDING: 'PENDING',
  INSTALLING: 'INSTALLING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type ScriptStatus = typeof ScriptStatus[keyof typeof ScriptStatus];
```

Before writing, grep each literal to confirm these are the exact strings used:
```
grep -rhE "status === '[A-Z]+'" app/ | sort -u
```

### 3-4. `lib/constants/messages.ts`
```ts
export const ERROR_MESSAGES = {
  IDC_INSTALLATION_STATUS_FETCH_FAILED: 'IDC 설치 상태 조회에 실패했습니다.',
  GCP_STATUS_FETCH_FAILED: '상태 조회에 실패했습니다.',
  GCP_STATUS_REFRESH_FAILED: '상태 새로고침에 실패했습니다.',
  // Add more only if they appear duplicated in the audit evidence.
} as const;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;
```

Do not add speculative entries. Only centralize strings that appear in 2+ files per audit §G6.

### 3-5. `lib/constants/README.md`
Short usage guide (≤ 50 lines):
- Purpose: central registry for values referenced in 2+ files.
- Rule: do **not** add single-use constants here — keep those local.
- How to add: update the relevant `as const` object, run `tsc` to propagate type narrowing.
- Cross-links to `/anti-patterns` G1/G2/G3/G6.

## Step 4: Do NOT touch
- **Any consumer file** — no `app/**`, no `lib/api-client/**`, no `lib/theme.ts`, no `lib/types/**`. Migration happens in follow-up specs.
- Existing constants scattered in components — leave them alone. Audit already logs their locations.

## Step 5: Verify
```
npx tsc --noEmit
npm run lint -- lib/constants/
```
Both must pass. Lint warning count unchanged (this spec adds files, doesn't remove violations).

## Step 6: Commit + push + PR
```
git add lib/constants/
git commit -m "refactor(constants): add timings/ui/statuses/messages foundation (wave11-A1)

Centralize values referenced from 2+ sites per the frontend anti-pattern
audit (docs/reports/frontend-anti-patterns-audit-2026-04-23.md §G).

- TIMINGS — setTimeout/setInterval values duplicated across 8 components
- UI_LIMITS — CREDENTIAL_PREVIEW_COUNT (3 sites), COLLAPSE_THRESHOLD (3 sites)
- ResourceStatus / TestConnectionStatus / ApprovalStatus / ScriptStatus —
  literal unions currently compared inline across 8 sites (§G3)
- ERROR_MESSAGES — duplicated Korean error strings (§G6)

No consumer migration in this PR — that's wave11-B1 onward."
git push -u origin refactor/wave11-a1-constants
```

PR body (write to `/tmp/pr-wave11-a1-body.md`):
```
## Summary

Foundation for the wave11 Clean Code refactor series. Adds `lib/constants/`
with four modules (`timings`, `ui`, `statuses`, `messages`) and a short
README. No consumer code is touched — migration PRs (B1, B2, B3, future)
will depend on this merge.

## Why

The frontend anti-pattern audit (PR #295) logged:
- 8 timeout/interval magic numbers (§G1)
- `CREDENTIAL_PREVIEW_COUNT=3` and `COLLAPSE_THRESHOLD=5` each redeclared
  in 3 separate files (§G2)
- 8 status-literal comparison sites across the codebase (§G3)
- Identical Korean error strings repeated across the IDC API client (§G6)

This PR creates the canonical home for those values.

## Changes
- `lib/constants/timings.ts` — TIMINGS object
- `lib/constants/ui.ts` — UI_LIMITS object
- `lib/constants/statuses.ts` — four `as const` status unions
- `lib/constants/messages.ts` — ERROR_MESSAGES object
- `lib/constants/README.md` — usage rule

## Deliberately excluded
- Any consumer migration (follow-up waves)
- Speculative constants not already duplicated in the audit evidence

## Test plan
- [x] `npx tsc --noEmit`
- [x] `npm run lint -- lib/constants/`
- [x] Lint warning count unchanged

## Ref
- Audit: `docs/reports/frontend-anti-patterns-audit-2026-04-23.md`
- Skill: `.claude/skills/anti-patterns/SKILL.md`
- Parallel: can run concurrently with `wave11-A2`, `wave11-B2`, `wave11-B3`
  (no shared files)
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report the URL.

## Return (under 200 words)
1. PR URL
2. `tsc` / `lint` results
3. List of the four constants files + README
4. Any literal values you *considered* adding but rejected for being single-use (with file:line)
5. Deviations from this spec with rationale

## Parallel coordination
- `wave11-A2`, `wave11-B2`, `wave11-B3` share **no files** with this spec — safe to run concurrently
- `wave11-B1` depends on this spec being **merged** (consumes `TIMINGS`)
