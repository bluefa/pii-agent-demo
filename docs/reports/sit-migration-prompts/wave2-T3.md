# Task T3 — TopNav + admin segment layout

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
Wave 2 parallel task. You own TopNav visibility: it must appear on `/integration/admin*` but NOT on `/integration/projects/[projectId]`.

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
grep -q 'export const navStyles' lib/theme.ts || { echo "✗ T1 tokens missing"; exit 1; }
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic sit-t3-topnav --prefix feat
cd /Users/study/pii-agent-demo-sit-t3-topnav
```

## Step 2: Required reading
1. `docs/reports/sit-migration-todo-phase1.md` §T3
2. `docs/reports/sit-prototype-migration-plan.md` §3-1
3. `design/SIT Prototype.html` L28-75 (TopNav visual)
4. `lib/routes.ts` (current routes)
5. `lib/theme.ts` `navStyles` (from T1)

## Step 3: Implementation

### New: `app/components/layout/TopNav.tsx`
- Height 56px, use `navStyles.bg` (slate-900)
- Left brand: 8×8 rounded box with `navStyles.brandGradient` + white dot + "SIT" label + small "Self Installation Tool"
- Nav links (icon + label), 4 items:
  - `Service List` → `integrationRoutes.admin` (**enabled**)
  - `Credentials` → `integrationRoutes.credentials` (**disabled**)
  - `PII Tag mgmt.` → `integrationRoutes.piiTag` (**disabled**)
  - `PII Map` → `integrationRoutes.piiMap` (**disabled**)
- Active detection: `usePathname().startsWith('/integration/admin')` → apply `navStyles.link.active`
- Disabled items: `aria-disabled="true"`, opacity-50, on click → show a "Coming soon" toast. If no toast library exists, implement a minimal inline toast with `useState` (auto-dismiss 2s).
- Right side: user email + 2-letter initial avatar (hard-coded placeholder is fine)

### New: `app/integration/admin/layout.tsx`
```tsx
import { TopNav } from '@/app/components/layout/TopNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      {children}
    </>
  );
}
```

### Modify: `lib/routes.ts`
Append 3 route constants:
```ts
integrationRoutes.credentials = '/integration/credentials';
integrationRoutes.piiTag = '/integration/pii-tag';
integrationRoutes.piiMap = '/integration/pii-map';
```

## Step 4: Constraints
- Do NOT modify root `app/layout.tsx`. Target-source detail page must remain TopNav-free (I-07).
- No raw hex. All colors via `navStyles`.
- Do NOT wire disabled menus to real pages (no actual credentials/piiTag/piiMap route files in this PR).
- Keep Korean labels as-is.

## Step 5: Verification
```
npm run type-check
npm run lint
npm run build
```
Manual checks:
- `/integration/admin` → TopNav renders, Service List active
- `/integration/projects/123` → TopNav absent (falls through to root layout)
- Clicking a disabled menu → toast appears

## Step 6: Commit, push, PR
```
git add app/components/layout/TopNav.tsx app/integration/admin/layout.tsx lib/routes.ts
git fetch origin main && git rebase origin/main
git commit -m "feat(layout): TopNav + admin segment layout (T3)

TopNav injected only into the admin segment. The root layout is untouched
so the target-source detail page remains nav-free per I-07.
Unimplemented menus render disabled with a 'Coming soon' toast per I-08.

Spec: docs/reports/sit-migration-todo-phase1.md §T3"
git push -u origin feat/sit-t3-topnav
gh pr create --title "feat(layout): TopNav + admin segment layout (T3)" --body "$(cat <<'EOF'
## Summary
Wave 2 — admin-only TopNav. Detail page stays nav-free.

## Phase 0
- I-07: TopNav absent on detail page
- I-08: Unimplemented menus visible but show 'Coming soon' toast

## Test plan
- [x] /integration/admin renders TopNav
- [x] /integration/projects/:id has no TopNav
- [x] disabled menu shows toast

## Ref
- docs/reports/sit-migration-todo-phase1.md §T3
EOF
)"
```

## Step 7: Stop. Report PR URL.

## Parallel coordination
- `lib/routes.ts` is also touched by B3 (Wave 2b). To avoid rebase conflict, T3 MUST merge before B3 starts.
- No collision with T2, A1, A3, A6, B1, B2.
