# Wave 11-A2 — Icons Module Foundation

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
Wave 11 foundation task. Creates `app/components/ui/icons/` with a uniform `IconProps` contract and extracts 6 commonly-repeated glyphs. Migrates **only one** consumer file (`GuideCard.tsx`) as a canary. The remaining 82 `<svg>` sites are deferred to later waves.

Audit evidence: `docs/reports/frontend-anti-patterns-audit-2026-04-23.md` §H (195 inline `<svg>` tags across 83 files).

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
ls app/components/ui/icons/ 2>/dev/null && { echo "✗ icons/ already exists"; exit 1; } || echo "✓ clean slate"
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave11-a2-icons --prefix refactor
cd /Users/study/pii-agent-demo-wave11-a2-icons
```

## Step 2: Required reading
1. `docs/reports/frontend-anti-patterns-audit-2026-04-23.md` §H1, H2, H3
2. `.claude/skills/anti-patterns/SKILL.md` §H (intent-based naming rules, brand icon exception)
3. Source sites to extract from:
   - `app/components/features/process-status/GuideCard.tsx:35-44` (lightbulb, the canary migration target)
   - `app/components/features/process-status/ConnectionTestPanel.tsx:92,96,225,229,293,365` (status glyphs + expand chevron)
4. Existing ad-hoc icon files — confirm they are **not** scope (they will be migrated in later waves):
   - `app/components/ui/CloudProviderIcon.tsx`, `ServiceIcon.tsx`, `AwsServiceIcon.tsx`, `AzureServiceIcon.tsx`, `GcpServiceIcon.tsx`, `DatabaseIcon.tsx`

## Step 3: Implementation

### 3-1. `app/components/ui/icons/types.ts`
```ts
export interface IconProps {
  className?: string;
  'aria-label'?: string;
}
```

Keep minimal. Do not add `size`, `color`, or variant props — className covers all current needs.

### 3-2. Six icon components

Naming rule: **intent-based, not shape-based**. Brand icons (AWS/Azure/GCP) would stay visual, but they are out of scope for this spec.

| File | Replaces | Intent |
|------|----------|--------|
| `GuideIcon.tsx` | GuideCard.tsx:35-44 lightbulb | tip/guidance cue |
| `StatusWarningIcon.tsx` | ConnectionTestPanel.tsx:92 | warning severity |
| `StatusInfoIcon.tsx` | ConnectionTestPanel.tsx:96,293 | informational |
| `StatusSuccessIcon.tsx` | ConnectionTestPanel.tsx:229 | success/check |
| `StatusErrorIcon.tsx` | ConnectionTestPanel.tsx:225 | error/failure |
| `ExpandIcon.tsx` | ConnectionTestPanel.tsx:365 chevron rotate-180 | expand/collapse affordance |

Standard component skeleton:
```tsx
import type { IconProps } from './types';

export const GuideIcon = ({ className, ...rest }: IconProps) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden={!rest['aria-label']}
    {...rest}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
    />
  </svg>
);
```

Copy each `<path>` / `<circle>` / `<rect>` verbatim from the source site. Do not redesign.

### 3-3. `app/components/ui/icons/index.ts` (barrel)
```ts
export type { IconProps } from './types';
export { ExpandIcon } from './ExpandIcon';
export { GuideIcon } from './GuideIcon';
export { StatusErrorIcon } from './StatusErrorIcon';
export { StatusInfoIcon } from './StatusInfoIcon';
export { StatusSuccessIcon } from './StatusSuccessIcon';
export { StatusWarningIcon } from './StatusWarningIcon';
```

Alphabetical order. New icons added in later waves follow the same rule.

### 3-4. Migrate `GuideCard.tsx` (canary — this file only)
- Delete the module-level `lightbulbIcon` JSX constant (lines 35-44)
- Add `import { GuideIcon } from '@/app/components/ui/icons'`
- Replace the one `{lightbulbIcon}` render site with `<GuideIcon className="w-3.5 h-3.5" />`
- Leave all other aspects of the file untouched (raw colors, magic sizes — those belong to a different wave)

## Step 4: Do NOT touch
- **Any `<svg>` site other than `GuideCard.tsx`** — 82 remaining sites are a future wave.
- **`CloudProviderIcon.tsx`, `ServiceIcon.tsx`, `*ServiceIcon.tsx`, `DatabaseIcon.tsx`** — ad-hoc icon files stay where they are; a later wave will migrate them into `icons/` as `brand/` sub-folder.
- `lib/theme.ts` — no color token changes here.
- GuideCard's raw-color / magic-value cleanup — that's outside the H category.

## Step 5: Verify
```
npx tsc --noEmit
npm run lint -- app/components/ui/icons/ app/components/features/process-status/GuideCard.tsx
npm run build
```
All three must pass. Build is required because Next.js static analysis validates the import graph.

Visual check: the GuideCard still renders a lightbulb icon in the header. No style regression (size, color, alignment).

## Step 6: Commit + push + PR
```
git add app/components/ui/icons/ app/components/features/process-status/GuideCard.tsx
git commit -m "refactor(icons): add icons module + migrate GuideCard (wave11-A2)

Create app/components/ui/icons/ as the canonical home for inline SVG
glyphs repeated across the codebase. 195 inline <svg> tags across 83
files per audit §H; this PR ships the module + one canary migration.

New files:
- types.ts (IconProps contract)
- index.ts (barrel)
- GuideIcon (replaces GuideCard lightbulb)
- StatusWarningIcon / StatusInfoIcon / StatusSuccessIcon / StatusErrorIcon
  (extracted from ConnectionTestPanel paths — not yet consumed there)
- ExpandIcon (chevron rotate-180 pattern)

Migrated:
- app/components/features/process-status/GuideCard.tsx — drops local
  lightbulbIcon const, imports GuideIcon

Deferred to later waves:
- 82 remaining <svg> sites (§H1)
- ad-hoc icon files (CloudProviderIcon, DatabaseIcon, etc.) → brand/ subfolder
- ConnectionTestPanel status-glyph migration (waits on that file's god-component split)

Naming follows intent, not shape (§H2): GuideIcon not LightbulbIcon,
ExpandIcon not ChevronDownIcon. Brand icons (Aws/Azure/Gcp) intentionally
stay visual and are not part of this batch."
git push -u origin refactor/wave11-a2-icons
```

PR body (write to `/tmp/pr-wave11-a2-body.md`):
```
## Summary

Creates `app/components/ui/icons/` — the canonical icon module — with
a uniform `IconProps` contract, a barrel, and six intent-named glyphs.
Migrates `GuideCard.tsx` as a canary to prove the pattern end-to-end.

## Why now

Audit §H logs 195 inline `<svg>` tags across 83 files and zero shared
icon infrastructure. Without a module, every incremental migration has
to argue the naming and prop contract from scratch. This PR settles both.

## What's in the module
- `types.ts` — `IconProps { className?, 'aria-label'? }`
- `GuideIcon`, `StatusWarningIcon`, `StatusInfoIcon`, `StatusSuccessIcon`,
  `StatusErrorIcon`, `ExpandIcon`
- `index.ts` barrel

## Naming follows intent, not shape
- `GuideIcon` (not `LightbulbIcon`)
- `ExpandIcon` (not `ChevronDownIcon`)
- `StatusSuccessIcon` (not `CheckIcon`)

Brand icons (Aws/Azure/Gcp) intentionally stay visual and are not part
of this batch — `brand/` subfolder will land in a later wave.

## Deliberately excluded
- 82 remaining `<svg>` sites across feature components
- `CloudProviderIcon`, `ServiceIcon`, `*ServiceIcon`, `DatabaseIcon`
- Any non-H-category cleanup in `GuideCard.tsx` (raw colors, magic sizes)
- ConnectionTestPanel consumption (waits on its god-component split)

## Test plan
- [x] `npx tsc --noEmit`
- [x] `npm run lint` on changed paths
- [x] `npm run build`
- [x] Visual: GuideCard renders the same lightbulb, same size, same color

## Ref
- Audit: `docs/reports/frontend-anti-patterns-audit-2026-04-23.md` §H
- Skill: `.claude/skills/anti-patterns/SKILL.md` §H
- Parallel: `wave11-A1`, `wave11-B2`, `wave11-B3` — no shared files
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report the URL.

## Return (under 200 words)
1. PR URL
2. `tsc` / `lint` / `build` results
3. List of 6 icon files + 1 migrated consumer
4. Any `<path>` tweaks you made during extraction and why
5. Deviations from spec with rationale

## Parallel coordination
- `wave11-A1`, `wave11-B2`, `wave11-B3` share no files — safe to run concurrently
- Later icon-migration waves depend on this spec being **merged**
