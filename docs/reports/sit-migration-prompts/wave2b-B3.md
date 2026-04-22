# Task B3 — detail segment layout

## Context
Wave 2b — runs after T3 is merged (both touch `lib/routes.ts`). You create a new Next.js segment layout for `/integration/projects/[projectId]/*` that explicitly omits the TopNav (I-07 safety rail).

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
git log origin/main --oneline -10 | grep -q "T3" || { echo "✗ T3 not merged yet"; exit 1; }
[ -f app/components/layout/TopNav.tsx ] && echo "✓ TopNav present" || { echo "✗ TopNav missing"; exit 1; }
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic sit-b3-detail-layout --prefix feat
cd /Users/study/pii-agent-demo-sit-b3-detail-layout
```

## Step 2: Required reading
1. `docs/reports/sit-migration-todo-phase1.md` §B3
2. `docs/reports/sit-prototype-migration-plan.md` §3-5-a

## Step 3: Implementation

New file: `app/integration/projects/[projectId]/layout.tsx`
```tsx
export default function ProjectDetailLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
```
If `lib/theme.ts` defines a `bgColors.muted` token, prefer that over `bg-slate-50`.

## Step 4: Rationale
T3 only injects `TopNav` in `app/integration/admin/layout.tsx`. The root layout is untouched, so detail pages already lack TopNav today. This segment layout is an explicit safety rail so that future root-level additions don't leak into detail pages.

## Step 5: Constraints
- Do NOT modify root `app/layout.tsx`
- Do NOT modify `app/projects/[projectId]/ProjectDetail.tsx` or any existing detail component (that's B4's scope)
- Avoid duplicating backgrounds if the inner component already sets one

## Step 6: Verification
```
npm run type-check
npm run lint
```
Manual:
- `/integration/projects/123` renders without TopNav
- `/integration/admin` unaffected

## Step 7: Commit, push, PR
```
git add app/integration/projects/[projectId]/layout.tsx
git fetch origin main && git rebase origin/main
git commit -m "feat(layout): detail segment layout (B3)

Explicit segment layout that omits TopNav. Pair-wise safety rail with the
admin segment layout introduced by T3.

Spec: docs/reports/sit-migration-todo-phase1.md §B3"
git push -u origin feat/sit-b3-detail-layout
gh pr create --title "feat(layout): detail segment layout (B3)" --body "$(cat <<'EOF'
## Summary
Wave 2b — explicit nav-free segment layout for target-source detail.

## Rationale
Safety rail: pair with T3's admin segment layout.

## Test plan
- [x] detail page: no TopNav
- [x] admin page: unaffected

## Ref
- docs/reports/sit-migration-todo-phase1.md §B3
EOF
)"
```

## Step 8: Stop. Report URL.

## Parallel coordination
`lib/routes.ts` was touched by T3. T3 MUST be merged before B3 starts. The precondition check above enforces this.
