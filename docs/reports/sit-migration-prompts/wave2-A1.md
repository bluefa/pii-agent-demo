# Task A1 — ServiceSidebar redesign

## Context
Wave 2 parallel task. You only modify `app/components/features/admin/ServiceSidebar.tsx`.

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
grep -q 'export const navStyles' lib/theme.ts || { echo "✗ T1 missing"; exit 1; }
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic sit-a1-sidebar --prefix feat
cd /Users/study/pii-agent-demo-sit-a1-sidebar
```

## Step 2: Required reading
1. `docs/reports/sit-migration-todo-phase1.md` §A1
2. `docs/reports/sit-prototype-migration-plan.md` §3-2
3. `design/SIT Prototype.html` L80-147
4. `app/components/features/admin/ServiceSidebar.tsx` (current)

## Step 3: Implementation (apply this change matrix)

| Aspect | Current | Target |
|---|---|---|
| Width | `w-64` | `w-[280px]` |
| Title | "서비스 코드" uppercase | "Service List" `text-base font-semibold` |
| Search placeholder | "서비스 검색..." | "Service name or Service Code" |
| Selected item | left 4px bar + bgLight | `primaryColors.bgLight` background + `1px primaryColors.border` full box (adjust padding to 11/13px to compensate) |
| Item structure | code + name + projectCount badge | code (13px 600) + name (12px) — **remove badge** |
| Footer | pager only | pager + `border-t` + 3 icon links: Notice / Guide / FAQ (href `#` for now) |

## Step 4: Constraints
- No raw hex.
- Keep the `projectCount` prop accepted (even if unused inside) — A2 will remove the prop path later.
- Pagination/search/selection behavior unchanged.

## Step 5: Verification
```
npm run type-check
npm run lint
```
Manual: visit `/integration/admin`, select services, search, paginate — no regressions.

## Step 6: Commit, push, PR
```
git add app/components/features/admin/ServiceSidebar.tsx
git fetch origin main && git rebase origin/main
git commit -m "feat(admin): ServiceSidebar visual redesign (A1)

- Width 256 → 280px, 'Service List' title
- Selection style: left bar → full box border
- Footer: Notice/Guide/FAQ links added
- projectCount badge removed from item

Spec: docs/reports/sit-migration-todo-phase1.md §A1"
git push -u origin feat/sit-a1-sidebar
gh pr create --title "feat(admin): ServiceSidebar redesign (A1)" --body "$(cat <<'EOF'
## Summary
Wave 2 — ServiceSidebar visual refresh per prototype L80-147.

## Changes
- 256 → 280px
- Box-style selection
- Footer links
- Remove projectCount badge

## Test plan
- [x] select/search/paginate no regressions
- [x] type-check, lint

## Ref
- docs/reports/sit-migration-todo-phase1.md §A1
EOF
)"
```

## Step 7: Stop. Report URL.

## Parallel coordination
No file overlap with T2, T3, A3, A6, B1, B2.
