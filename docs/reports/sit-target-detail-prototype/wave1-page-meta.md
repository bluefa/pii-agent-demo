# Wave 1 — Header & Page Meta

## Context

Replaces the current `ProjectIdentityCard` gradient banner with the horizontal page-meta kv strip from the prototype. Adopts the Wave 0 tokens (`pageChromeStyles.title` 30/800, `pageMetaStyles.*`, `cardStyles.subtitle`). Also performs the consumer migration for the deprecated `cardStyles.title` alias on this page's surfaces.

The prototype's `screen-4` header is:

```
<div class="breadcrumb">SIT Home › Service List › Big Data Platform (999) › Azure Infrastructure</div>
<div class="page-header">
  <div><h1 class="page-title">Big Data Platform <span>(999)</span></h1></div>
  <div>… [Provider toggle — Wave 8, not implemented] [인프라 삭제] …</div>
</div>
<div class="page-meta">
  <div class="kv"><span class="k">Cloud Provider</span><span class="v">Azure</span></div>
  <div class="kv"><span class="k">Subscription ID</span><span class="v mono">…</span></div>
  <div class="kv"><span class="k">Jira Link</span><span class="v"><a>…</a></span></div>
  <div class="kv"><span class="k">모니터링 방식</span><span class="v">Azure Agent</span></div>
</div>
```

Current production renders `ProjectIdentityCard` (gradient banner card with cloud icon, monitoring chip, Jira chip, and a `dl` grid of identifiers) below the page header. This wave replaces it with the flat strip.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
git log --oneline origin/main | grep "wave0" | head -1  # confirm Wave 0 merged
test -f docs/adr/014-toss-typography-tokens.md && echo "✓ ADR-014 merged"
git grep -l "pageMetaStyles" lib/theme.ts && echo "✓ Wave 0 tokens present" || echo "✗ Wave 0 not merged"
```

If Wave 0 is not on `origin/main`, this wave blocks.

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-detail-wave1-page-meta --prefix feat
cd /Users/study/pii-agent-demo-sit-detail-wave1-page-meta
```

## Step 2: Required reading

1. `docs/adr/014-toss-typography-tokens.md` — D1, R4, "Migration triggers" section.
2. `docs/reports/sit-target-detail-prototype/wave0-design-tokens.md` — confirm what tokens landed.
3. Current implementation:
   - `app/integration/target-sources/[targetSourceId]/_components/common/ProjectPageMeta.tsx` — wraps Breadcrumb + PageHeader + ProjectIdentityCard.
   - `app/integration/target-sources/[targetSourceId]/_components/common/ProjectIdentityCard.tsx` — the card being replaced.
   - `app/components/ui/PageMeta.tsx` — existing minimal `dl`-based page meta utility (line count: 25). May be used or extended.
   - `app/components/ui/PageHeader.tsx` — h1 + subtitle + action slot.
   - `app/components/ui/Breadcrumb.tsx` — already correct, no change needed.
4. `design/SIT Prototype v7 - standalone.html` — `screen-4` header section.
5. The three provider page files that compose `ProjectIdentityCard` via `ProjectPageMeta`:
   - `app/integration/target-sources/[targetSourceId]/_components/aws/AwsProjectPage.tsx`
   - `app/integration/target-sources/[targetSourceId]/_components/azure/AzureProjectPage.tsx`
   - `app/integration/target-sources/[targetSourceId]/_components/gcp/GcpProjectPage.tsx`

## Step 3: Implementation

### 3-1. `app/components/ui/PageMeta.tsx` — extend to support mono + copy-to-clipboard

Current PageMeta (25 lines) accepts `items: { label, value: ReactNode }[]`. Extend to:

```typescript
import { useState } from 'react';
import { pageMetaStyles, cn } from '@/lib/theme';
import { CopyIcon, StatusSuccessIcon } from '@/app/components/ui/icons';
import { TIMINGS } from '@/lib/constants/timings';

export interface PageMetaItem {
  label: string;
  value: React.ReactNode;
  /** when true, value is rendered with font-mono and hover-reveals a copy button.
   *  copy target is taken from `copyText` if provided, else from `value` if it's a string. */
  mono?: boolean;
  copyText?: string;
}

interface PageMetaProps {
  items: PageMetaItem[];
}

export const PageMeta = ({ items }: PageMetaProps) => (
  <dl className={pageMetaStyles.container}>
    {items.map((item, index) => (
      <PageMetaRow key={`${item.label}-${index}`} item={item} />
    ))}
  </dl>
);

const PageMetaRow = ({ item }: { item: PageMetaItem }) => {
  const [copied, setCopied] = useState(false);
  const copyTarget = item.copyText ?? (typeof item.value === 'string' ? item.value : null);

  const handleCopy = async () => {
    if (!copyTarget) return;
    try {
      await navigator.clipboard.writeText(copyTarget);
      setCopied(true);
      window.setTimeout(() => setCopied(false), TIMINGS.COPY_FEEDBACK_MS);
    } catch (error) {
      console.warn('[PageMeta] clipboard.writeText failed', { error, label: item.label });
    }
  };

  return (
    <div className={pageMetaStyles.item}>
      <dt className={pageMetaStyles.key}>{item.label}</dt>
      <dd className="group flex min-w-0 items-center gap-1.5">
        <span className={cn(pageMetaStyles.value, item.mono && pageMetaStyles.mono, 'truncate')}>
          {item.value}
        </span>
        {item.mono && copyTarget && (
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'shrink-0 rounded p-0.5 transition-opacity',
              copied
                ? 'opacity-100 text-green-600'
                : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 hover:bg-gray-100',
            )}
            aria-label={`${item.label} 복사`}
          >
            {copied ? <StatusSuccessIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
          </button>
        )}
      </dd>
    </div>
  );
};
```

Notes:
- `pageMetaStyles` came from Wave 0.
- `TIMINGS.COPY_FEEDBACK_MS` (1500) already exists in `lib/constants/timings.ts`.
- `CopyIcon` and `StatusSuccessIcon` already exist in `app/components/ui/icons` (used by `ProjectIdentityCard`).
- Replacement vs new component: extend the existing 25-line `PageMeta.tsx`. Do not create a parallel component.

### 3-2. `ProjectPageMeta.tsx` — rebuild composition

`app/integration/target-sources/[targetSourceId]/_components/common/ProjectPageMeta.tsx` currently renders:
```
<Breadcrumb />
<PageHeader title={...} action={action} />
<ProjectIdentityCard identity={identity} />
```

Change to:
```typescript
import type { TargetSource } from '@/lib/types';
import { Breadcrumb } from '@/app/components/ui/Breadcrumb';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { PageMeta, type PageMetaItem } from '@/app/components/ui/PageMeta';
import { integrationRoutes } from '@/lib/routes';
import type { ProjectIdentity } from './ProjectIdentityCard';

interface ProjectPageMetaProps {
  project: TargetSource;
  providerLabel: string;
  identity: ProjectIdentity;
  action?: React.ReactNode;
}

const STATIC_HEAD_CRUMBS = [
  { label: 'SIT Home', href: '/' },
  { label: 'Service List', href: integrationRoutes.admin },
];

const buildPageMetaItems = (identity: ProjectIdentity): PageMetaItem[] => {
  const items: PageMetaItem[] = [
    { label: 'Cloud Provider', value: identity.cloudProvider },
  ];

  for (const id of identity.identifiers) {
    items.push({
      label: id.label,
      value: id.value ?? '-',
      mono: id.mono,
      copyText: id.value ?? undefined,
    });
  }

  if (identity.jiraLink) {
    items.push({
      label: 'Jira Link',
      value: (
        <a href={identity.jiraLink} target="_blank" rel="noopener noreferrer" className="text-[#0064FF] hover:underline">
          {extractJiraLabel(identity.jiraLink)}
        </a>
      ),
    });
  }

  items.push({ label: '모니터링 방식', value: identity.monitoringMethod });
  return items;
};

const JIRA_KEY_PATTERN = /\/browse\/([A-Z][A-Z0-9]+-\d+)/;
const extractJiraLabel = (url: string): string => {
  const match = url.match(JIRA_KEY_PATTERN);
  return match ? match[1] : 'Jira';
};

export const ProjectPageMeta = ({ project, providerLabel, identity, action }: ProjectPageMetaProps) => {
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
        action={action}
      />
      <PageMeta items={buildPageMetaItems(identity)} />
    </>
  );
};
```

Notes:
- The `extractJiraLabel` helper used to live inside `ProjectIdentityCard`. Move it (do not duplicate).
- `ProjectIdentity` type is re-imported from `./ProjectIdentityCard` for the wave (the file is still in `common/index.ts`). Wave 1 keeps the type alive even though the card itself is deleted; consumers (Wave 4 step-split waves) still build their identity object.
- Move `ProjectIdentity` type to its own file `app/integration/target-sources/[targetSourceId]/_components/common/project-identity.ts` so deleting `ProjectIdentityCard.tsx` does not break the type import.

### 3-3. `ProjectIdentityCard.tsx` — delete

Delete `app/integration/target-sources/[targetSourceId]/_components/common/ProjectIdentityCard.tsx`. Remove its `export { ... } from './ProjectIdentityCard'` line from `common/index.ts`.

Re-export `ProjectIdentity` and `TargetSourceIdentifier` from `common/index.ts` via the new `project-identity.ts` file:

```typescript
// app/integration/target-sources/[targetSourceId]/_components/common/index.ts
export { ProjectPageMeta } from './ProjectPageMeta';
export { ErrorState } from './ErrorState';
export { LoadingState } from './LoadingState';
export { RejectionAlert } from './RejectionAlert';
export { DeleteInfrastructureButton } from './DeleteInfrastructureButton';
export type { ProjectIdentity, TargetSourceIdentifier } from './project-identity';
```

### 3-4. `PageHeader.tsx` — apply Wave 0 title token

Current `PageHeader.tsx` line 13:
```typescript
<h1 className={cn('text-2xl font-bold tracking-tight', textColors.primary)}>{title}</h1>
```

Replace the inline `text-2xl font-bold tracking-tight` with `pageChromeStyles.title` minus the `px-6 mt-1` (those are page-chrome positional classes, not character properties — handled by the parent layout):

```typescript
import { pageChromeStyles, textColors, cn } from '@/lib/theme';

<h1 className={cn(
  'text-[30px] font-extrabold tracking-[-0.03em] leading-[1.2]',
  textColors.primary,
)}>
  {title}
</h1>
```

Rationale for not using `pageChromeStyles.title` directly: that token includes `px-6 mt-1` for the admin guides layout. `PageHeader` is a generic component used in multiple contexts. Extract the character-level part of the token here, leave the positional part where it lives.

Alternative considered: split `pageChromeStyles.title` into `title-text` (character) and `title-position` (px-6 mt-1). Deferred — this wave changes one consumer; if a second consumer needs the same character set, that wave splits the token.

### 3-5. Provider page files — no functional change

`AwsProjectPage.tsx`, `AzureProjectPage.tsx`, `GcpProjectPage.tsx` already pass an `identity` object to `CloudTargetSourceLayout`. They build `identity.identifiers[]` — that input shape is unchanged. No edits needed in this wave.

### 3-6. Tests — update

Files likely to have snapshot/text assertions that reference `ProjectIdentityCard`'s gradient header or specific class strings:

```bash
git grep -l "ProjectIdentityCard\|gradient\|모니터링 방식" app/integration/target-sources -- '*.test.tsx' '*.test.ts'
```

For each match:
- Snapshot tests: update snapshots in this commit.
- Text assertions for `모니터링 방식` and `Cloud Provider` labels: keep — the new strip still renders these.
- Assertions for `Jira Link` chip: keep — the link is still rendered, with the BDCDIP-NNNN label.

Also update:
- `app/integration/target-sources/[targetSourceId]/_components/common/ProjectIdentityCard.test.tsx` — delete if present.
- Any test that imports from `'./ProjectIdentityCard'` directly — switch to `from '@/app/integration/target-sources/[targetSourceId]/_components/common'`.

### 3-7. e2e / playwright — verify

If `playwright/` or `e2e/` directories exist and contain a target-source detail flow:
```bash
ls playwright/ e2e/ 2>/dev/null || echo "no e2e dir"
```
- Run the existing target-source detail e2e (if any) — accept visual diffs on the header strip but reject on action button position or breadcrumb text.

## Step 4: Do NOT touch

- `app/components/features/process-status/ProcessProgressBar.tsx`, `InstallationProcessProgressBar.tsx`, `StepProgressBar.tsx`, `motion/**` — ADR-014 R3.
- `lib/theme.ts` — Wave 0 already shipped all tokens this wave needs.
- `app/globals.css` — ADR-014 R5.
- Provider page files (`AwsProjectPage.tsx`, `AzureProjectPage.tsx`, `GcpProjectPage.tsx`) — no behavior change.
- Step content (CandidateResourceSection, WaitingApprovalCard, etc.) — out of scope.
- `lib/types.ts` `ProjectIdentity` shape — keep `identifiers[]` shape, just move the type file.

## Step 5: Verify

```bash
npx tsc --noEmit
npm run lint -- \
  app/components/ui/PageMeta.tsx \
  app/components/ui/PageHeader.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/common/
npm test --run app/integration/target-sources
```

Browser verification:
```bash
USE_MOCK_DATA=true npm run dev
```
- Navigate to `http://localhost:3000/integration/target-sources/1001` (Azure mock).
- Visual check:
  - Page title is large (30px / 800 weight).
  - Below the page header, a horizontal strip shows: Cloud Provider, Subscription ID (mono, hover shows copy button), Tenant ID (mono, copy button), 모니터링 방식.
  - Hover on `Subscription ID` → copy button fades in. Click → green check, then back to copy icon.
  - Breadcrumb: 13px, medium weight.
- Repeat for `/1002` (GCP) and `/1003` (AWS).

```bash
# Confirm no stepper-related file changed
git diff --name-only origin/main | grep -E "ProcessProgressBar|StepProgressBar|stepperMotion" && echo "✗ stepper edited" || echo "✓ stepper untouched"
```

## Step 6: Commit + push + PR

```bash
git add \
  app/components/ui/PageMeta.tsx \
  app/components/ui/PageHeader.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/common/

# Delete the gradient card and add the renamed type file
git rm app/integration/target-sources/'[targetSourceId]'/_components/common/ProjectIdentityCard.tsx 2>/dev/null || true

git commit -m "feat(target-source-detail): adopt Toss page-meta strip (wave1)

Replace the gradient ProjectIdentityCard with a horizontal kv strip
matching design/SIT Prototype v7 - standalone.html screen-4 header.

- Extend PageMeta to support mono identifiers + hover copy button.
- ProjectPageMeta composes Breadcrumb + PageHeader + PageMeta strip.
- Move ProjectIdentity type to project-identity.ts so card deletion
  does not break Wave 4 step-component imports.
- PageHeader h1 uses 30px / extrabold / -0.03em (Wave 0 token).
- Delete ProjectIdentityCard.tsx and its test.

ProcessStatus stepper four-file guard checked.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push -u origin feat/sit-detail-wave1-page-meta
```

PR body:
```
## Summary

Wave 1 of the target-source detail prototype migration. Adopts the
horizontal page-meta kv strip from `design/SIT Prototype v7 -
standalone.html` `screen-4` header and applies the Wave 0 page-title
30/800 token.

## Changes

- `app/components/ui/PageMeta.tsx` — extended: `mono` + `copyText`,
  hover-reveal copy button, success toast indicator.
- `app/components/ui/PageHeader.tsx` — h1 uses 30/800/-0.03em (Wave 0
  token character-set, position classes still come from page layout).
- `app/integration/.../common/ProjectPageMeta.tsx` — composes
  `<Breadcrumb /> <PageHeader /> <PageMeta />` and builds the items
  array from `ProjectIdentity`.
- `app/integration/.../common/project-identity.ts` — new file with the
  `ProjectIdentity` and `TargetSourceIdentifier` types extracted from
  the deleted card.
- `app/integration/.../common/ProjectIdentityCard.tsx` — deleted.
- `common/index.ts` — re-exports the types from the new file.

## What this fixes

- Page title now matches the prototype's `.page-title` (30/800/-0.03em).
- Page identity reads as a flat strip, not a card-within-a-card.
- Identifier copy-to-clipboard ergonomics (hover-reveal) ported.

## Deliberately excluded

- Provider toggle (Azure↔GCP segmented control next to "인프라 삭제"):
  decision recorded in `docs/adr/015-provider-toggle-decision.md`
  (Wave 8).
- Page background flip to `surface-page` gray (`#F2F4F6`): opt-in per
  ADR-014 R2; out of scope for Wave 1.
- ProcessStatus stepper visual: ADR-014 R3 freezes
  `ProcessProgressBar.tsx`, `InstallationProcessProgressBar.tsx`,
  `StepProgressBar.tsx`, `motion/**`. Verified via `git diff`.
- Removing the deprecated `cardStyles.title` alias: waits for all
  consumers to migrate.

## Verification

- `tsc --noEmit` — 0
- `lint` — no new warnings
- `npm test --run app/integration/target-sources` — green
- Manual browser check: /integration/target-sources/1001 (Azure),
  /1002 (GCP), /1003 (AWS) all render the strip correctly. Copy
  buttons fire and show success indicator.

## Test plan
- [x] tsc
- [x] lint
- [x] unit tests
- [x] manual visual verification on 3 mock target sources
- [x] stepper four-file guard (`git diff origin/main -- <stepper files>` empty)
```

## Step 7: Self-review checklist

- [ ] `PageMeta.tsx` exports both `PageMeta` and `PageMetaItem` types
- [ ] `mono: true` triggers `font-mono` class application
- [ ] Copy button does not render when `mono: false`
- [ ] Copy button does not render when `value` is not a string and `copyText` is not provided
- [ ] `ProjectIdentity` type still importable from `'@/.../common'`
- [ ] No file under `app/components/features/process-status/` modified (`git diff` empty)
- [ ] `app/globals.css` not modified

## Acceptance for this wave

Wave 1 is correct when:
- The page meta strip renders in place of the gradient card on `/integration/target-sources/{1001,1002,1003}`.
- Copy-to-clipboard works on Subscription ID and Tenant ID (Azure), Account ID (AWS), Project ID (GCP).
- `ProjectIdentityCard.tsx` no longer exists in the tree.
- `ProjectIdentity` type is still importable by Wave 4 step components.
- Stepper four-file guard passes.
