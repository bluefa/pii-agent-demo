# Task B5 — Consolidate Detail Shell into ProjectPageMeta

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
Wave 5a parallel task (pairs with B6).
B4 merged: the 5 `*ProjectPage.tsx` files now each inline the same `Breadcrumb + PageHeader + PageMeta` block with `breadcrumbCrumbs` / `pageMetaItems` arrays. B5 extracts this into a shared `ProjectPageMeta` helper and cleans up vestigial JSX.

## Precondition — verify B4 is merged
```
cd /Users/study/pii-agent-demo
git fetch origin main
git log origin/main --oneline -15 | grep -q "B4" && echo "✓ B4 merged" || { echo "✗ B4 not merged"; exit 1; }
[ -f app/components/ui/PageHeader.tsx ] || { echo "✗ T2 missing"; exit 1; }
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic sit-b5-page-meta --prefix refactor
cd /Users/study/pii-agent-demo-sit-b5-page-meta
```

## Step 2: Required reading (in order)
1. `docs/reports/sit-migration-todo-phase1.md` §B5
2. `docs/reports/sit-prototype-migration-plan.md` §3-5-b
3. `app/projects/[projectId]/common/ProjectHeader.tsx` — current file; will be **replaced** by `ProjectPageMeta.tsx`
4. `app/projects/[projectId]/common/index.ts`
5. The 5 `*ProjectPage.tsx` files — observe the repeated `breadcrumbCrumbs` / `pageMetaItems` pattern B4 introduced
6. `app/components/ui/{Breadcrumb,PageHeader,PageMeta}.tsx` — prop shapes from T2

## Step 3: Implementation

### 3-1. Create `app/projects/[projectId]/common/ProjectPageMeta.tsx`
```tsx
import type { Project } from '@/lib/types';
import { Breadcrumb } from '@/app/components/ui/Breadcrumb';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { PageMeta } from '@/app/components/ui/PageMeta';
import { integrationRoutes } from '@/lib/routes';

interface ProjectPageMetaProps {
  project: Project;
  providerLabel: string;           // e.g. "AWS Infrastructure"
  metaItems: Array<{ label: string; value: React.ReactNode }>;
  action?: React.ReactNode;         // optional right-side action (e.g. 인프라 삭제)
}

const STATIC_HEAD_CRUMBS = [
  { label: 'SIT Home', href: '/' },
  { label: 'Service List', href: integrationRoutes.admin },
];

export const ProjectPageMeta = ({ project, providerLabel, metaItems, action }: ProjectPageMetaProps) => {
  const crumbs = [
    ...STATIC_HEAD_CRUMBS,
    { label: project.serviceCode, href: integrationRoutes.admin },
    { label: providerLabel },
  ];

  return (
    <>
      <Breadcrumb crumbs={crumbs} />
      <PageHeader
        title={`${project.name || project.projectCode} (${project.serviceCode})`}
        backHref={integrationRoutes.admin}
        action={action}
      />
      <PageMeta items={metaItems} />
    </>
  );
};
```

Note the hoisted `STATIC_HEAD_CRUMBS` const (resolves Vercel rule `rendering-hoist-jsx` P3 from PR #284 review).

### 3-2. Update 5 `*ProjectPage.tsx` files

For each provider page:
1. **Delete** local `breadcrumbCrumbs` array
2. **Delete** local `<Breadcrumb>` + `<PageHeader>` + `<PageMeta>` JSX
3. **Insert** `<ProjectPageMeta project={project} providerLabel="<provider> Infrastructure" metaItems={pageMetaItems} />` in their place
4. Keep `pageMetaItems` array (or inline it) — provider-specific
5. **Remove the empty `<>` fragment** wrapper that B4 left behind in Azure/GCP/IDC/SDU
6. **Remove the vestigial `<div>`** wrapper in IDC/SDU (original `grid grid-cols-[350px_1fr]`)
7. Fix over-indentation (1 level) in Azure/GCP/IDC/SDU internal JSX

Example — AwsProjectPage:
```tsx
// Before (from B4)
const breadcrumbCrumbs = [ ... ];
const pageMetaItems = [ ... ];
return (
  <main className="max-w-[1200px] mx-auto p-7 space-y-6">
    <Breadcrumb crumbs={breadcrumbCrumbs} />
    <PageHeader title={...} backHref={...} />
    <PageMeta items={pageMetaItems} />
    <ProcessStatusCard ... />
    ...
  </main>
);

// After (B5)
const pageMetaItems = [ ... ];  // kept
return (
  <main className="max-w-[1200px] mx-auto p-7 space-y-6">
    <ProjectPageMeta project={project} providerLabel="AWS Infrastructure" metaItems={pageMetaItems} />
    <ProcessStatusCard ... />
    ...
  </main>
);
```

### 3-3. Update `app/projects/[projectId]/common/index.ts`
Add `export { ProjectPageMeta } from './ProjectPageMeta';`. Keep `ProjectHeader` export (T17 will delete the file).

### 3-4. Remove imports that become unused in each ProjectPage
After switching to `ProjectPageMeta`, these imports per file are no longer needed:
- `Breadcrumb`, `PageHeader`, `PageMeta` from `@/app/components/ui/...`
- `integrationRoutes` from `@/lib/routes` (only if no other usage — AWS still uses it for project route navigation elsewhere, double-check)

## Step 4: Do NOT touch
- `app/projects/[projectId]/common/ProjectHeader.tsx` file (T17 deletes it)
- `ProcessStatusCard`, `ScanPanel`, `ResourceTable` internals (B6, B8 scopes)
- Orphan imports/variables from removed InfoCards (T17 scope)

## Step 5: Verify
```
npx tsc --noEmit
npm run lint -- app/projects/ app/components/ui/
```
Both must pass. Total lint warning count should **decrease** by ~4-5 (removed redundant imports). Pre-existing orphan state warnings remain.

## Step 6: Commit + push + PR
```
git add app/projects/[projectId]/
git commit -m "refactor(detail): ProjectPageMeta consolidation (B5)

Extract Breadcrumb + PageHeader + PageMeta combo from 5 provider pages into
app/projects/[projectId]/common/ProjectPageMeta.tsx helper.

- Hoist STATIC_HEAD_CRUMBS (SIT Home, Service List) to module const
  (Vercel rule rendering-hoist-jsx — P3 from PR #284 review)
- Remove empty <> fragment wrappers in Azure/GCP/IDC/SDU (leftover from B4)
- Remove vestigial <div> wrappers in IDC/SDU
- Normalize inner JSX indentation

ProjectHeader.tsx file preserved for T17 deletion.

Spec: docs/reports/sit-migration-todo-phase1.md §B5"
git push -u origin refactor/sit-b5-page-meta
```

PR body (write to `/tmp/pr-b5-body.md`):
```
## Summary
Wave 5a — consolidate the 5 provider page headers into `ProjectPageMeta`.

## Changes
- New: `app/projects/[projectId]/common/ProjectPageMeta.tsx`
- Updated: 5 `*ProjectPage.tsx` files swap inline Breadcrumb/PageHeader/PageMeta for single `<ProjectPageMeta />` render
- `STATIC_HEAD_CRUMBS` hoisted as module const (resolves PR #284 Vercel P3)
- Remove empty `<>` fragment wrappers in non-AWS files (B4 leftover)
- Remove vestigial `<div>` wrappers in IDC/SDU
- Normalize indentation

## Preserved
- ProjectHeader.tsx file (T17 deletion scope)

## Vercel rule updates
- rendering-hoist-jsx: static crumbs now hoisted ✅
- rerender-simple-expression-in-memo: pageMetaItems kept inline (correct) ✅

## Test plan
- [x] npx tsc --noEmit
- [x] npm run lint (warning count decreases)
- [x] 5 provider pages render correctly
- [x] Back button + Breadcrumb navigation intact

## Ref
- docs/reports/sit-migration-todo-phase1.md §B5
- PR #284 Vercel review: P3 rendering-hoist-jsx
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report the URL.

## Return (under 200 words)
1. PR URL
2. `tsc` / `lint` results (before/after warning count)
3. List of the 5 modified provider files
4. Any JSX structure surprises found during consolidation
5. Deviations from spec + rationale

## Parallel coordination
- **B6 (Wave 5b)** runs in parallel. B6 touches `app/components/features/scan/*` only. No file collision.
- B4 is the single shared prerequisite for both.
