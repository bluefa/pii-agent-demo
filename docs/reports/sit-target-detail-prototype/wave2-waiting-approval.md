# Wave 2 — Step 2 (WAITING_APPROVAL) stats, toolbar, pagination

## Context

`WaitingApprovalCard` (`app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCard.tsx`) currently shows a banner + a flat `WaitingApprovalTable` that lists every selected/excluded row. The prototype's `screen-4` Step 2 adds three structures on top:

1. **Stats card** above the table — three "approval-stat" tiles (`전체 요청 / 연동 대상 / 비대상`) with percentages.
2. **Toolbar** between stats and table — search input + segmented filter `전체 / 대상 / 비대상` + DB Type select + Region select + visible row count.
3. **Pagination** below the table — page-size select + page numbers + first/prev/next/last buttons.

All three are derivable from data already in the BFF response (`approved_integration.resource_infos` + `approved_integration.excluded_resource_infos`). No new BFF endpoints.

The "전체 요청 취소" button at the right of the table footer stays where it is (already implemented as `WaitingApprovalCancelButton`).

Reason chip in the excluded rows is **Wave 3**, not this wave. This wave only adds the structural shell.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
git log --oneline origin/main | grep -E "(wave0|wave1)" | head -5
git grep -l "pageMetaStyles" lib/theme.ts && echo "✓ Wave 0 merged"
git grep -l "buildPageMetaItems" app/integration/target-sources && echo "✓ Wave 1 merged"
```

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-detail-wave2-waiting-approval --prefix feat
cd /Users/study/pii-agent-demo-sit-detail-wave2-waiting-approval
```

## Step 2: Required reading

1. `design/SIT Prototype v7 - standalone.html` `screen-4` Step 2 block (search "STEP 2: 연동 대상 승인 대기").
2. `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCard.tsx` (current 139 lines).
3. `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable.tsx` (current 95 lines).
4. `app/lib/api/index.ts:357-397` (`ApprovedIntegrationResponse` and `getApprovedIntegration`).
5. `lib/types.ts` — `ResourceScanStatus` enum.
6. The shipped Approval test fixtures in `__tests__` to know what data shape exists in mock.

## Step 3: Implementation

### 3-1. Stats card — new component

Create `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStats.tsx`:

```typescript
import { cn, primaryColors, textColors } from '@/lib/theme';

interface WaitingApprovalStatsProps {
  totalCount: number;
  selectedCount: number;
  excludedCount: number;
}

export const WaitingApprovalStats = ({
  totalCount,
  selectedCount,
  excludedCount,
}: WaitingApprovalStatsProps) => {
  const selectedPct = totalCount === 0 ? 0 : Math.round((selectedCount / totalCount) * 1000) / 10;
  const excludedPct = totalCount === 0 ? 0 : Math.round((excludedCount / totalCount) * 1000) / 10;

  return (
    <div className="grid grid-cols-3 gap-3">
      <StatTile label="전체 요청" value={totalCount} unit="건" />
      <StatTile label="연동 대상" value={selectedCount} unit="건" pct={selectedPct} swatch="target" />
      <StatTile label="비대상" value={excludedCount} unit="건" pct={excludedPct} swatch="exclude" />
    </div>
  );
};

interface StatTileProps {
  label: string;
  value: number;
  unit: string;
  pct?: number;
  swatch?: 'target' | 'exclude';
}

const StatTile = ({ label, value, unit, pct, swatch }: StatTileProps) => (
  <div className={cn('rounded-xl border border-gray-200 bg-white px-4 py-3')}>
    <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500">
      {swatch && (
        <span
          className={cn('h-2 w-2 rounded-full', swatch === 'target' ? primaryColors.bg : 'bg-gray-400')}
        />
      )}
      {label}
    </div>
    <div className={cn('mt-1 flex items-baseline gap-1.5', textColors.primary)}>
      <span className="text-[22px] font-extrabold tabular-nums tracking-[-0.02em]">{value}</span>
      <span className="text-[12px] text-gray-500">{unit}</span>
      {pct !== undefined && (
        <span className="text-[12px] text-gray-500">· {pct.toFixed(1)}%</span>
      )}
    </div>
  </div>
);
```

Notes:
- Uses `text-[22px]` for the number — Wave 0 added `--type-h1: 22px` but the token has no class-string export yet. Hardcoded `text-[22px]` is the documented escape valve until a class-string token is added. Same convention as `pageChromeStyles.title` in Wave 0.
- The target swatch consumes `primaryColors.bg` (from `lib/theme.ts`). No raw `#0064FF` hex in this file.

### 3-2. Toolbar — new component

Create `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalToolbar.tsx`:

```typescript
import { SearchIcon } from '@/app/components/ui/icons';
import { cn, textColors } from '@/lib/theme';

export type ApprovalFilter = 'all' | 'target' | 'excluded';

interface WaitingApprovalToolbarProps {
  searchValue: string;
  onSearchChange: (next: string) => void;
  filter: ApprovalFilter;
  onFilterChange: (next: ApprovalFilter) => void;
  dbType: string;
  onDbTypeChange: (next: string) => void;
  region: string;
  onRegionChange: (next: string) => void;
  dbTypeOptions: ReadonlyArray<{ value: string; label: string }>;
  regionOptions: ReadonlyArray<{ value: string; label: string }>;
  countsByFilter: { all: number; target: number; excluded: number };
  visibleStart: number;
  visibleEnd: number;
  totalCount: number;
}

export const WaitingApprovalToolbar = (props: WaitingApprovalToolbarProps) => (
  <div className="flex flex-wrap items-center gap-3 py-3 border-b border-gray-100">
    <SearchBox value={props.searchValue} onChange={props.onSearchChange} />
    <FilterSeg filter={props.filter} onChange={props.onFilterChange} counts={props.countsByFilter} />
    <Select value={props.dbType} onChange={props.onDbTypeChange} options={props.dbTypeOptions} placeholder="DB Type · 전체" />
    <Select value={props.region} onChange={props.onRegionChange} options={props.regionOptions} placeholder="Region · 전체" />
    <span className={cn('ml-auto text-[12px]', textColors.tertiary)}>
      <strong className="text-gray-800">{props.visibleStart}–{props.visibleEnd}</strong> / {props.totalCount}건
    </span>
  </div>
);

// SearchBox, FilterSeg, Select — small local components, each ~10 lines. Inline within this file.
```

Implementation hints:
- `SearchBox`: 28×28 search icon + `<input>` with `min-w-[200px] h-8 px-2 text-[13px]` + clear-on-blur not required.
- `FilterSeg`: three buttons sharing a rounded container; active state uses `primaryColors.bg` for the fill plus `text-white` for the label (Tailwind utility — `primaryColors` does not export an `textInverse` key today; introduce one in `lib/theme.ts` if a second consumer materializes). Counts shown as a small chip.
- `Select`: native `<select>` styled to match the toolbar (`h-8 rounded-md border border-gray-300 px-2 text-[13px]`).

All three small components live inline in `WaitingApprovalToolbar.tsx`. No new files. Reason: each is a 10-line component with one consumer.

### 3-3. Pagination — shared UI component

Create `app/components/ui/Pagination.tsx`:

```typescript
import { cn, textColors } from '@/lib/theme';
import {
  ChevronFirstIcon, ChevronLastIcon,
  ChevronLeftIcon, ChevronRightIcon,
} from '@/app/components/ui/icons';

interface PaginationProps {
  page: number;            // 0-based
  pageSize: number;
  totalCount: number;
  onPageChange: (next: number) => void;
  onPageSizeChange: (next: number) => void;
  pageSizeOptions?: ReadonlyArray<number>;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export const Pagination = (props: PaginationProps) => {
  const options = props.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS;
  const totalPages = Math.max(1, Math.ceil(props.totalCount / props.pageSize));
  const start = props.totalCount === 0 ? 0 : props.page * props.pageSize + 1;
  const end = Math.min(props.totalCount, (props.page + 1) * props.pageSize);

  const visiblePageNums = buildVisiblePages(props.page, totalPages);

  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <div className="flex items-center gap-2 text-[12px] text-gray-600">
        <span>표시</span>
        <select
          value={props.pageSize}
          onChange={(e) => props.onPageSizeChange(Number(e.target.value))}
          className="h-7 rounded-md border border-gray-300 px-1 text-[12px]"
        >
          {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <span>건씩</span>
      </div>
      <span className={cn('text-[12px]', textColors.tertiary)}>
        <strong className="text-gray-800">{start}–{end}</strong> / 전체 <strong className="text-gray-800">{props.totalCount}</strong>건
      </span>
      <div className="ml-auto flex items-center gap-1">
        <IconBtn aria-label="처음" disabled={props.page === 0} onClick={() => props.onPageChange(0)}><ChevronFirstIcon /></IconBtn>
        <IconBtn aria-label="이전" disabled={props.page === 0} onClick={() => props.onPageChange(props.page - 1)}><ChevronLeftIcon /></IconBtn>
        {visiblePageNums.map((entry, index) =>
          entry === '…'
            ? <span key={`ellipsis-${index}`} className="px-1 text-[12px] text-gray-400">…</span>
            : <PageBtn key={entry} active={entry === props.page} onClick={() => props.onPageChange(entry)}>{entry + 1}</PageBtn>
        )}
        <IconBtn aria-label="다음" disabled={props.page >= totalPages - 1} onClick={() => props.onPageChange(props.page + 1)}><ChevronRightIcon /></IconBtn>
        <IconBtn aria-label="끝" disabled={props.page >= totalPages - 1} onClick={() => props.onPageChange(totalPages - 1)}><ChevronLastIcon /></IconBtn>
      </div>
    </div>
  );
};

export const buildVisiblePages = (current: number, total: number): Array<number | '…'> => {
  // Show first, last, current ±1, with ellipses for gaps. Standard pattern.
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const out: Array<number | '…'> = [0];
  const left = Math.max(1, current - 1);
  const right = Math.min(total - 2, current + 1);
  if (left > 1) out.push('…');
  for (let p = left; p <= right; p++) out.push(p);
  if (right < total - 2) out.push('…');
  out.push(total - 1);
  return out;
};

// IconBtn, PageBtn — inline small components. Style via cn.
```

Icons required:
```bash
git grep -l "ChevronFirst\|ChevronLast\|ChevronLeft\|ChevronRight" app/components/ui/icons
```

If `ChevronFirstIcon` / `ChevronLastIcon` do not exist:
- Check current `app/components/ui/icons/` directory.
- Add 12×12 `<svg>` icons matching the prototype's `<polyline points="11 17 6 12 11 7"></polyline><polyline points="18 17 13 12 18 7"></polyline>` for first; mirror for last.

If `ChevronLeftIcon` and `ChevronRightIcon` already exist, reuse them.

### 3-4. `WaitingApprovalCard` — integrate

Update `WaitingApprovalCard.tsx` to:

1. Lift state for `searchValue`, `filter`, `dbType`, `region`, `page`, `pageSize` into the card.
2. Compute `filteredResources` via a `useMemo` reducing over the loaded resources.
3. Compute paginated slice for the table.
4. Render: banner → `WaitingApprovalStats` → `WaitingApprovalToolbar` → `WaitingApprovalTable` (only paginated slice) → `Pagination` → existing action row.

State default values:
- `searchValue`: `''`
- `filter`: `'all'`
- `dbType`: `''` (empty = "전체")
- `region`: `''` (empty = "전체")
- `page`: `0`
- `pageSize`: `10`

Filter pipeline:
1. Apply `dbType` if non-empty (compare to `resource.resourceType`).
2. Apply `region` if non-empty.
3. Apply `filter`:
   - `target` → keep only `selected === true`
   - `excluded` → keep only `selected === false`
4. Apply `searchValue` (case-insensitive substring match on `resourceId`, `resourceName`).

When filters/search change, `setPage(0)` to avoid landing on an out-of-range page.

`countsByFilter` are computed from the pre-filter list:
- `all`: total length
- `target`: count where `selected === true`
- `excluded`: count where `selected === false`

`dbTypeOptions` / `regionOptions` are derived from the full resource list — collect unique values, sort alphabetically. Empty value → "전체" placeholder.

### 3-5. Empty/edge cases

- `totalCount === 0` → show the existing empty-state row inside the table. Stats render all zeros. Toolbar still shows but filters are no-ops.
- `filteredCount === 0` (filter excludes everything) → show a slim "조건에 맞는 결과가 없어요" row inside the table, not the existing "표시할 리소스가 없습니다" (which is for the source-level empty case).
- Loading state — keep existing `LoadingRow`. Stats and toolbar do not render during loading.
- Error state — keep existing `ErrorRow`. Stats and toolbar do not render during error.

### 3-6. Tests — add

Add `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCard.test.tsx` cases:

- Stats values match input data (3 selected + 2 excluded → 5 / 3 / 2).
- Filter `target` reduces table to selected rows.
- Search filters by resourceId substring case-insensitively.
- Page size change resets page to 0.
- Pagination button "다음" is disabled on the last page.
- Empty resource list shows all-zero stats and the table empty state.

Add `app/components/ui/Pagination.test.tsx`:
- `buildVisiblePages(0, 5) === [0,1,2,3,4]`
- `buildVisiblePages(0, 20) === [0,1,'…',19]` (or whatever the visible-page algorithm produces — assert exact output)
- onPageChange called with correct page index when clicking each button
- First/Prev disabled on page 0
- Next/Last disabled on last page

## Step 4: Do NOT touch

- `app/components/features/process-status/ProcessProgressBar.tsx` and the four files in ADR-014 R3.
- `WaitingApprovalTable.tsx` — keep the row rendering as-is. This wave adds a toolbar+pagination wrapper; the row design changes in Wave 3 (reason chip).
- `lib/approval-bff.ts` — the BFF response shape is unchanged.
- `app/lib/api/index.ts` — no API change.
- `lib/types.ts` — no type change.
- Other steps' components (WaitingTargetConfirmationStep, ApplyingApprovedStep, ConnectionTestStep, etc.).

## Step 5: Verify

```bash
npx tsc --noEmit
npm run lint -- \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/ \
  app/components/ui/Pagination.tsx
npm test --run \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingApprovalCard.test.tsx \
  app/components/ui/Pagination.test.tsx
```

Browser:
```bash
USE_MOCK_DATA=true npm run dev
```
- Find a mock target source in `WAITING_APPROVAL` state. Use the mock-store helpers to seed if necessary — check `lib/mock-store.ts`.
- Visual check: stats render, toolbar filters work, pagination buttons respond.

Stepper guard — use explicit paths so all of `motion/` is covered, not just `stepperMotionEngine`:
```bash
git diff --name-only origin/main -- \
  app/components/features/process-status/ProcessProgressBar.tsx \
  app/components/features/process-status/InstallationProcessProgressBar.tsx \
  app/components/features/process-status/StepProgressBar.tsx \
  app/components/features/process-status/motion/ \
  | (read -r line && echo "✗ stepper modified: $line" || echo "✓ stepper untouched")
```

## Step 6: Commit + push + PR

Single commit:
```bash
git add app/integration/target-sources/'[targetSourceId]'/_components/layout/ app/components/ui/Pagination.tsx app/components/ui/icons/

git commit -m "feat(waiting-approval): stats card + toolbar + pagination (wave2)

Step 2 strengthening per design/SIT Prototype v7 - standalone.html
screen-4 Step 2 block.

- WaitingApprovalStats: 3-tile stats (전체 / 대상 / 비대상 + %).
- WaitingApprovalToolbar: search + filter seg + DB Type / Region
  selects + visible-row counter.
- Pagination: shared UI primitive with first/prev/page-numbers/next/
  last + page-size select.
- WaitingApprovalCard owns filter/search/pagination state and feeds
  the table only the paginated slice.

All filter inputs are client-side; no BFF change.

ProcessStatus stepper four-file guard passes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push -u origin feat/sit-detail-wave2-waiting-approval
```

PR body (`/tmp/pr-wave2-body.md`):
```
## Summary

Wave 2 of the target-source detail prototype migration. Adds stats
card, filter toolbar, and pagination to the WAITING_APPROVAL step,
matching the prototype's `screen-4` Step 2 block.

## Changes

- `WaitingApprovalStats.tsx` — new, 3-tile stats grid.
- `WaitingApprovalToolbar.tsx` — new, contains inline SearchBox / FilterSeg / Select.
- `Pagination.tsx` — new shared UI primitive in `app/components/ui/`.
- `WaitingApprovalCard.tsx` — orchestrates state + slicing.
- `app/components/ui/icons/` — added ChevronFirst / ChevronLast SVGs
  (12×12) when not present.

## Data source

All values derived from the existing `approved_integration.resource_infos`
+ `excluded_resource_infos` response. No BFF endpoint changes.

## Deliberately excluded

- Reason chip in excluded rows: Wave 3.
- Banner timestamps + approver name: Wave 3.
- ProcessStatus stepper changes: frozen by ADR-014 R3.
- Server-driven pagination: the underlying response is client-paginated
  for now; if scale demands server pagination, that's a separate spec.

## Verification

- tsc / lint / unit tests green.
- Manual check on a `WAITING_APPROVAL` mock target source.

## Test plan
- [x] Stats reflect input counts and percentages
- [x] Filter seg reduces visible rows
- [x] Search filters by resourceId substring
- [x] Page size change resets page to 0
- [x] First/Prev disabled on page 0; Next/Last disabled on last page
- [x] Empty resource list shows all-zero stats
- [x] Stepper four-file guard passes
```

## Step 7: Self-review checklist

- [ ] No raw hex outside `lib/theme.ts` (`primaryColors` consumed for primary blue, not hardcoded)
- [ ] `WaitingApprovalTable` row shape unchanged (Wave 3 owns the row design)
- [ ] `pageSize` change resets `page` to 0
- [ ] Search is case-insensitive
- [ ] `buildVisiblePages` covers ≤ 7 total pages without ellipses
- [ ] `dbTypeOptions` / `regionOptions` only contain values actually present in the loaded resources
- [ ] Stepper four-file guard passes (`git diff origin/main -- <files>` empty)

## Acceptance for this wave

Wave 2 is correct when:
- A `WAITING_APPROVAL` target source page shows a 3-tile stats row above the table.
- The toolbar's filter seg switches the table between all/target/excluded counts.
- Pagination works on a fixture with 12+ resources (mock needs ≥ 12 rows; if the existing mock has fewer, the test fixture grows in `__tests__/` only, not in production seeds).
- Stepper four-file guard passes.
