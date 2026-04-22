# Task T2 — Shared UI primitives

## Context
Project: pii-agent-demo (Next.js 14 App Router, TypeScript, TailwindCSS, Korean UI).
You are one of 7 parallel Wave 2 sessions executing the SIT prototype migration.
Your task is isolated: you only create new files under `app/components/ui/`.
Do NOT touch any other files.

## Precondition — verify T1 is merged
```
cd /Users/study/pii-agent-demo
git fetch origin main
git log origin/main --oneline -10 | grep -q "T1" && echo "✓ T1 merged" || { echo "✗ T1 not merged yet. Abort."; exit 1; }
grep -q 'export const navStyles' lib/theme.ts || { echo "✗ navStyles missing — T1 tokens not present"; exit 1; }
```
If either check fails, stop and report to the user.

## Step 1: Create worktree
```
bash scripts/create-worktree.sh --topic sit-t2-shared-ui --prefix feat
cd /Users/study/pii-agent-demo-sit-t2-shared-ui
```

## Step 2: Required reading (in order)
1. `docs/reports/sit-migration-todo-phase1.md` §T2
2. `docs/reports/sit-prototype-migration-plan.md` §3-3-a, §3-3-b
3. `design/SIT Prototype.html` L157-172 (visual spec)
4. `lib/theme.ts` — confirm T1 tokens are present (`navStyles`, `tagStyles`, etc.)

## Step 3: Implementation

Create 3 new files under `app/components/ui/`:

### `Breadcrumb.tsx`
```tsx
interface BreadcrumbProps {
  crumbs: Array<{ label: string; href?: string }>;  // last item without href = current
}
```
- Wrap with `<nav aria-label="breadcrumb">`; current item gets `aria-current="page"`
- Style: `text-xs` using `textColors.tertiary`; separator `'›'` with `mx-1.5`; current uses `textColors.secondary`
- Conditional render: `href` present → `<Link>` from `next/link`, else `<span>`

### `PageHeader.tsx`
```tsx
interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;   // right-aligned action area
  backHref?: string;          // optional left "← 목록으로" ghost button (I-07)
}
```
- Title: `text-2xl font-bold tracking-tight`
- Layout: `flex justify-between items-start`
- When `backHref` is provided, render a left-side ghost button with chevron-left icon and the Korean label `목록으로`

### `PageMeta.tsx`
```tsx
interface PageMetaProps {
  items: Array<{ label: string; value: React.ReactNode }>;
}
```
- Container: `flex flex-wrap gap-7`
- Each item is a column: label (`text-[11px] uppercase tracking-wide`, `textColors.tertiary`) above value (`text-sm font-medium`, `textColors.primary`)

## Step 4: Constraints (strict)
- No raw hex values. Use `textColors`, `borderColors`, and friends from `lib/theme.ts`.
- No `any` type, no relative imports (use `@/` absolute).
- Only create the 3 new files. Do NOT modify `Button.tsx`, `LoadingSpinner.tsx`, or any other existing UI file.
- Keep Korean UI strings as-is (e.g., `목록으로`).

## Step 5: Verification
```
npm run type-check
npm run lint
```
Both must pass. Optional: temporarily mount all 3 primitives in `app/integration/admin/page.tsx` for visual confirmation, then revert the mount.

## Step 6: Commit, push, create PR
```
git add app/components/ui/Breadcrumb.tsx app/components/ui/PageHeader.tsx app/components/ui/PageMeta.tsx
git fetch origin main && git rebase origin/main
git commit -m "feat(ui): shared primitives Breadcrumb/PageHeader/PageMeta (T2)

Reusable UI primitives for both the service list and target-source detail
screens. PageHeader.backHref implements the I-07 return UX (← 목록으로).

Spec: docs/reports/sit-migration-todo-phase1.md §T2"
git push -u origin feat/sit-t2-shared-ui
gh pr create --title "feat(ui): shared primitives Breadcrumb/PageHeader/PageMeta (T2)" --body "$(cat <<'EOF'
## Summary
Wave 2 (parallel) — SIT migration shared UI primitives.

## New
- `Breadcrumb` — accessible nav with conditional Link
- `PageHeader` — title + action + optional backHref (I-07)
- `PageMeta` — 4-kv inline row

## Test plan
- [x] type-check, lint pass
- [x] visual mount verified then reverted
- [x] a11y attributes present

## Ref
- docs/reports/sit-migration-todo-phase1.md §T2
EOF
)"
```

## Step 7: Stop here
Report the PR URL. Do NOT auto-merge. Do NOT start the next task.

## Parallel coordination
Other Wave 2 sessions running in parallel: T3, A1, A3, A6, B1, B2.
None of them touch `app/components/ui/*`. No coordination needed.
