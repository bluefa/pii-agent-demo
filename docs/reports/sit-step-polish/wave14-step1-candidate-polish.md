# Wave 14 — Step 1 (WAITING_TARGET_CONFIRMATION) candidate polish

## Context

The prototype-vs-implementation audit (PR #473) recorded Step 1 as
"already complete" because `WaitingTargetConfirmationStep` mounts the
`GuideCardContainer`. A subsequent comparison against
`design/SIT Prototype v7 - standalone.html` Step 1 surface found four
additional gaps inside the **inner section** (`CandidateResourceSection`
+ `CandidateResourceTable`) that the audit missed:

| # | Where | Current | Prototype |
|---|---|---|---|
| 1 | `CandidateResourceSection.tsx:247` h2 | `text-[15px] font-semibold` (~15 px / 600) | bare `<h2>` (22 px / 700 / `-0.01em` from CSS) |
| 2 | `CandidateResourceTable.tsx:74` header | `DB Type` | `Database Type` |
| 3 | `CandidateResourceTable.tsx:77` header | `DB Name` | `Resource Name` |
| 4 | `CandidateResourceTable.tsx:79` header | `스캔 이력` column (8 columns total) | column does not exist (7 columns total) |
| 5 | `CandidateResourceTable.tsx` Resource ID cell | plain mono text, no copy affordance | `.res-id-cell` + `.copy-btn` (hover-revealed) |
| 6 | `CandidateResourceTable.tsx:59,67` empty state + card wrapper | `bg-white` raw class | uses `--bg-surface` (#FFFFFF) — same color, but the token, not the raw class |

This wave closes 1, 2, 3, 5, 6 outright. Gap 4 (`스캔 이력` column)
involves a functionality decision — the column visualises
`ResourceScanStatus` (`NEW_SCAN | UNCHANGED`), which the prototype omits.
The wave records the decision procedure but does not force removal; see
§3-3.

This wave depends on Wave 9 only and runs in parallel with Waves 10–13
(no file overlap).

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
git grep -l "cardStyles.cardTitle" lib/theme.ts && echo "✓ Wave 9 merged"
git grep -l "CopyButton" app/components/ui && echo "✓ Wave 9 CopyButton merged"
```

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-step-polish-wave14-step1-candidate --prefix feat
cd /Users/study/pii-agent-demo-sit-step-polish-wave14-step1-candidate
```

## Step 2: Required reading

1. `design/SIT Prototype v7 - standalone.html` — search for
   `연동 대상 DB 선택` (the Step 1 card title) and the Step 1 table's
   `<thead>` block. Note the prototype renders the candidate table with
   **seven** columns (checkbox, 연동 대상 여부, Database Type,
   Resource ID, Region, Resource Name, 연동 완료 여부) — no
   `스캔 이력` column. The Resource ID cell uses
   `<span class="res-id-cell"><span class="res-id-text">…</span>
   <button class="copy-btn">…</button></span>`.
2. `app/integration/target-sources/[targetSourceId]/_components/candidate/CandidateResourceSection.tsx`
   — Step 1 section component. Line 247 has the ad-hoc 15 px h2.
3. `app/integration/target-sources/[targetSourceId]/_components/candidate/CandidateResourceTable.tsx`
   — the candidate table. Lines 59, 67 carry the `bg-white` raw class.
   Lines 73–79 list the column headers. The Resource ID cell is in
   `CandidateResourceRow` (read it in full before editing).
4. `app/components/ui/CopyButton.tsx` (Wave 9) — the primitive this wave
   imports. Wire `opacity-0 group-hover:opacity-100` via `className`.
5. `lib/theme.ts` — `cardStyles.cardTitle` (Wave 9), `bgColors.surface`,
   `tableStyles`.
6. `app/components/ui/PageMeta.tsx` — reference for the row-hover-reveal
   pattern (do not modify).
7. `lib/types/resources/candidate.ts` — `CandidateResource` shape. Used
   when building the test fixture builder (§3-7).

## Step 3: Implementation

### 3-1. `CandidateResourceSection` — `cardTitle` token swap

Replace the ad-hoc 15 px heading with the Wave 9 token.

```diff
- <h2 className={cn('text-[15px] font-semibold whitespace-nowrap', textColors.primary)}>
-   연동 대상 DB 선택
- </h2>
+ <h2 className={cn(cardStyles.cardTitle, 'whitespace-nowrap')}>
+   연동 대상 DB 선택
+ </h2>
```

`cardStyles.cardTitle` already includes `text-gray-900` (= `textColors.primary`),
so the explicit `textColors.primary` is no longer needed in the className.
Verify after the edit that `textColors` is still used elsewhere in the
file (it is — the subtitle `<p>` and several `cn(...)` blocks still
import it). Do **not** remove the `textColors` import.

The subtitle `<p>` already uses `text-xs` (= 12 px), which matches the
prototype's `font-size: 12px`. No change needed there.

### 3-2. `CandidateResourceTable` — column header text rename

```diff
- <th className="px-6 py-3">DB Type</th>
+ <th className="px-6 py-3">Database Type</th>
```

```diff
- <th className="px-6 py-3">DB Name</th>
+ <th className="px-6 py-3">Resource Name</th>
```

The visible column copy now matches the prototype's `<thead>` exactly.
The data the column renders does not change — only the header label.

### 3-3. `CandidateResourceTable` — "스캔 이력" column decision

Today the table has **eight columns** (checkbox + seven data columns);
the eighth is "스캔 이력", driven by `ResourceScanStatus`. The
prototype has **seven columns** (checkbox + six data columns) and omits
the scan-history column entirely.

**Decision procedure** (execute before the edit):

1. Grep for consumers of the scan-history visual on the candidate
   surface:
   ```bash
   git grep -n "ResourceScanStatus" app/integration/target-sources \
     app/components/features/process-status
   ```
2. If `ResourceScanStatus` is read only inside the candidate table row
   (i.e., dropping the column does not orphan a data field elsewhere),
   **drop the column**:
   ```diff
   - <th className="px-6 py-3">스캔 이력</th>
   ```
   …plus the matching `<td>` inside `CandidateResourceRow`, plus any
   unused imports the cell brought in (`ScanPill`, the derive helper,
   etc.).
3. If `ResourceScanStatus` is also displayed elsewhere on the same
   surface (banner, summary, etc.), **keep the column** and explain in
   the PR body why removing it from the table would orphan a signal.
4. Either outcome is acceptable — the prototype's omission is a
   visual-density choice, not a hard requirement. The PR body must
   record the decision.

### 3-4. `CandidateResourceTable` — Resource ID copy-on-hover

Mirror the prototype's `<span class="res-id-cell">…<button class="copy-btn">…`
pattern using the Wave 9 `CopyButton` primitive and the row-hover-reveal
className.

Add the import:
```ts
import { CopyButton } from '@/app/components/ui/CopyButton';
```

The candidate row's `<tr>` needs the `group` class so descendants can
use `group-hover:*`. Find the row's outer `<tr>` in
`CandidateResourceRow` and add `group` to its className (preserve
existing classes via `cn(...)`):

```diff
- <tr className={cn(rowClasses)}>
+ <tr className={cn(rowClasses, 'group')}>
```

The Resource ID cell currently renders the value as plain mono text.
Wrap it so the copy button sits beside the text, hidden by default and
revealed on row hover:

```tsx
<td className={cn(TABLE_BODY_CELL, TABLE_MONO_CELL, textColors.secondary)}>
  <span className="inline-flex items-center gap-1.5">
    <span className="truncate">{candidate.resourceId}</span>
    <CopyButton
      value={candidate.resourceId}
      label={`${candidate.resourceId} 복사`}
      className="opacity-0 group-hover:opacity-100"
    />
  </span>
</td>
```

Use the existing `TABLE_BODY_CELL` / `TABLE_MONO_CELL` constants if the
candidate row imports a table-styles helper; otherwise use the existing
className already attached to the Resource ID `<td>`. The point is to
add the `CopyButton` without disturbing the cell's current styling.

### 3-5. `CandidateResourceTable` — `bg-white` raw class

Two occurrences (lines 59 and 67 at the time of the audit):

```diff
- <div className={cn('rounded-lg border bg-white px-6 py-10 text-center text-sm', borderColors.default, textColors.tertiary)}>
+ <div className={cn('rounded-lg border px-6 py-10 text-center text-sm', bgColors.surface, borderColors.default, textColors.tertiary)}>
    발견된 리소스가 없습니다
  </div>
```

```diff
- <div className={cn('rounded-lg border bg-white shadow-sm overflow-hidden', borderColors.default)}>
+ <div className={cn('rounded-lg border shadow-sm overflow-hidden', bgColors.surface, borderColors.default)}>
```

Add `bgColors` to the existing import from `@/lib/theme` (it may already
be imported — check first).

### 3-6. Tests

Two test files. Extend, do not rewrite.

#### `CandidateResourceSection.test.tsx`

Add a single assertion that the card title uses the new token:

```tsx
it('renders the card title with the cardTitle token', () => {
  // …existing render setup…
  const h2 = screen.getByRole('heading', { level: 2, name: '연동 대상 DB 선택' });
  expect(h2.className).toContain('text-[22px]');
  expect(h2.className).toContain('font-bold');
});
```

#### `CandidateResourceTable.test.tsx`

Three assertions:

1. Header rename: `getByRole('columnheader', { name: 'Database Type' })`
   resolves; `getByRole('columnheader', { name: 'Resource Name' })`
   resolves.
2. `스캔 이력` column: if dropped (per §3-3), assert
   `queryByRole('columnheader', { name: '스캔 이력' })` is `null`. If
   kept, leave the existing assertion as-is.
3. CopyButton mount: each row renders a hover-revealed CopyButton on
   the Resource ID cell.

Fixture pattern (no `as` casts — use `satisfies`):

```tsx
const candidateFixture = (overrides: Partial<CandidateResource>): CandidateResource =>
  ({
    id: 'c-1',
    resourceId: 'res-1',
    type: 'DB',
    region: 'ap-northeast-2',
    resourceName: 'res-1-name',
    // …any other required CandidateResource fields…
    ...overrides,
  }) satisfies CandidateResource;

it('renders a hover-revealed CopyButton on each Resource ID cell', () => {
  render(
    <CandidateResourceTable
      candidates={[candidateFixture({ resourceId: 'res-1' })]}
      // …other required props (selectedIds, drafts, etc.)…
    />,
  );
  const button = screen.getByRole('button', { name: 'res-1 복사' });
  expect(button.className).toContain('opacity-0');
  expect(button.className).toContain('group-hover:opacity-100');
});
```

If the table's existing test file already mocks props that this new
test does not need, reuse the existing `defaultProps` shape rather than
duplicating it.

## Step 4: Do NOT touch

- **ADR-014 R3 stepper four files.**
  `app/components/features/process-status/ProcessProgressBar.tsx`,
  `InstallationProcessProgressBar.tsx`, `StepProgressBar.tsx`,
  `app/components/features/process-status/motion/`. Frozen by ADR.
- **`WaitingTargetConfirmationStep.tsx`** — already mounts the
  `GuideCardContainer`. Untouched in this wave.
- **Other steps (2–7).** Waves 10/11/12 own them.
- **`CandidateResourceRow` internal panels** (expand toggle, endpoint
  draft editor, etc.) — out of scope. Only the row's outer `<tr>` and
  the Resource ID `<td>` are touched.
- **`app/components/ui/CopyButton.tsx`** — Wave 9 ships it; Wave 14
  only imports.
- **`lib/theme.ts`** — Wave 9 ships `cardStyles.cardTitle`. Wave 14
  consumes; no token edit.
- **BFF / swagger / `lib/types.ts`.** No schema change.
- **`ResourceScanStatus` enum and its mappers.** Even if §3-3 drops
  the column, the enum stays — other surfaces may still consume it.
- **`CandidateResourceSection` scan controller / approval modal
  wiring.** Only the card header h2 changes.

## Step 5: Verify

```bash
npx tsc --noEmit

npm run lint -- \
  app/integration/target-sources/'[targetSourceId]'/_components/candidate/CandidateResourceSection.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/candidate/CandidateResourceTable.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/candidate/__tests__/

npm test --run \
  app/integration/target-sources/'[targetSourceId]'/_components/candidate/__tests__/CandidateResourceSection.test.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/candidate/__tests__/CandidateResourceTable.test.tsx
```

- `tsc` must exit 0.
- Lint: no new warnings.
- Test count must be strictly greater than before (one to three new
  assertions added; nothing removed unless §3-3 explicitly dropped the
  scan-history assertion).

Browser smoke:

- **Azure × WAITING_TARGET_CONFIRMATION** with a mock containing at
  least three candidate rows:
  - Card title reads visibly larger than before (22 px vs 15 px).
  - Column headers read `Database Type` and `Resource Name` (not
    `DB Type` / `DB Name`).
  - "스캔 이력" column status (present or removed) matches the §3-3
    decision.
  - Hovering a row reveals the copy button next to the Resource ID;
    clicking copies the full identifier to the clipboard.
- **Empty state:** the placeholder card (`발견된 리소스가 없습니다`)
  still renders on a white surface; no visible color change (the token
  resolves to `#FFFFFF`).

Stepper guard:
```bash
git diff --name-only origin/main -- \
  app/components/features/process-status/ProcessProgressBar.tsx \
  app/components/features/process-status/InstallationProcessProgressBar.tsx \
  app/components/features/process-status/StepProgressBar.tsx \
  app/components/features/process-status/motion/ \
  | (read -r line && echo "✗ stepper modified: $line" || echo "✓ stepper untouched")
```

Out-of-scope file guard:
```bash
git diff --name-only origin/main -- \
  app/components/ui/CopyButton.tsx \
  app/components/ui/PageMeta.tsx \
  lib/theme.ts \
  | (read -r line && echo "✗ out-of-scope file modified: $line" || echo "✓ out-of-scope files untouched")
```

## Step 6: Commit + push + PR

```bash
git add \
  app/integration/target-sources/'[targetSourceId]'/_components/candidate/CandidateResourceSection.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/candidate/CandidateResourceTable.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/candidate/__tests__/

git commit -F /tmp/wave14-commit-msg.txt

git push -u origin feat/sit-step-polish-wave14-step1-candidate
```

Commit message (write to `/tmp/wave14-commit-msg.txt` first to avoid
heredoc quoting hazards):

```
feat(step-polish): Step 1 candidate section + table polish (wave14)

Step 1 visual gaps surfaced after the original audit:
- CandidateResourceSection card title: text-[15px] → cardStyles.cardTitle
  (22 px / 700) — matches prototype <h2>.
- CandidateResourceTable column headers: DB Type → Database Type,
  DB Name → Resource Name. Matches prototype <thead>.
- Resource ID cell: adds Wave 9 CopyButton with opacity-0
  group-hover:opacity-100 (mirrors prototype .res-id-cell pattern).
- bg-white raw class replaced with bgColors.surface in two places.
- 스캔 이력 column: <kept | dropped> per §3-3 decision; rationale in
  PR body.

No BFF change, no schema change. Wave 9 primitives consumed as-is.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

PR body:
```
## Summary

Wave 14 of the step-polish set. Closes the Step 1
(WAITING_TARGET_CONFIRMATION) gaps that the original audit missed.

## Changes

- Card title uses cardStyles.cardTitle (Wave 9 token).
- Column headers match the prototype: Database Type, Resource Name.
- 스캔 이력 column: <kept | dropped — describe decision and reason>.
- Resource ID gains the hover-revealed CopyButton.
- Two bg-white raw classes replaced with bgColors.surface.

## Out of scope

- WaitingTargetConfirmationStep itself — already mounts GuideCard.
- CandidateResourceRow internal panels (expand / endpoint editor).
- Other steps — Waves 10-13.

## Test plan
- [ ] Card title renders at 22 px (font-bold).
- [ ] Column headers read Database Type / Resource Name.
- [ ] 스캔 이력 column matches decision.
- [ ] Hover a row → CopyButton appears beside Resource ID.
- [ ] Click CopyButton → clipboard contains the Resource ID.
- [ ] Empty state placeholder still renders on a white surface.
- [ ] Stepper four-file guard passes.
```

## Step 7: Self-review checklist

- [ ] `cardStyles.cardTitle` is imported once; the inline class string
      is gone.
- [ ] `textColors.primary` is no longer applied to the h2 directly
      (the token already carries gray-900), but the import is retained
      if other consumers in the file still use it.
- [ ] Column header strings exactly match the prototype's `<thead>`.
- [ ] Whichever §3-3 decision was chosen, the PR body explains it and
      the tests reflect it.
- [ ] `CopyButton` mounts only on the Resource ID cell — not on every
      mono field (region etc. stay plain unless the prototype also
      copies them, which it does not).
- [ ] `<tr>` carries `group`; `<CopyButton>` carries
      `opacity-0 group-hover:opacity-100`.
- [ ] `bgColors.surface` replaces both `bg-white` occurrences.
- [ ] No `any`, no relative imports, no other raw color classes.
- [ ] Stepper four-file guard passes.

## Acceptance for this wave

Wave 14 is correct when:
- The Step 1 card header `<h2>` measures 22 px in the browser.
- Step 1 column headers read `Database Type` and `Resource Name`.
- Hovering a candidate row reveals a copy button next to the
  Resource ID; clicking it writes the identifier to the clipboard.
- The empty-state placeholder still renders on a white surface
  (no visible regression).
- §3-3 decision is recorded in the PR body and reflected in tests.
- Step 1 surface visually matches the prototype's Step 1 card section.
