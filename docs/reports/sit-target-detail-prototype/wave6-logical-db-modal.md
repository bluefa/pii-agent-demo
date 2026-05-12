# Wave 6 — Step 5 logical DB modal (UI shell, no persistence)

## Context

The prototype's `screen-4` Step 5 (WAITING_CONNECTION_TEST) renders a per-row "논리 DB 확인" `<button class="btn sm ghost">` that opens the `#logicalModal` modal. The modal has:

- Title "논리 DB 확인 · `<resource name>`"
- Two-panel split (`lgPanelA` / `lgPanelB`):
  - Panel A: 연동 대상 후보 — list of logical DBs detected on the resource
  - Panel B: 연동 제외 후보 — drag/select destination for excluded items
- Per-panel search box (`lgSearchA` / `lgSearchB`)
- Per-panel count badge (`lgCountA` / `lgCountB`)
- Pending change indicator (`lgPending` — "변경사항 N건")
- Save button (`lgSaveBtn`) with derived label "추가 N · 제거 M"
- Optional reason popover (`lgReasonPop`) for individual exclusions

There is no BFF endpoint for logical DBs today. The memory note `project_logical_db_deny_model` records the **domain shape** the team aligned on but does not include API contracts. This wave ships the **UI shell**: a fully working modal driven by local state, with `onSave` doing `toast.info("논리 DB 정보 저장은 BFF 연동 후 활성화됩니다.")` so the visual is reviewable in a browser today.

When the BFF later exposes endpoints, only the data hook (`useLogicalDatabases`) needs to swap.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
git grep -l "InstallationCompleteStep" app/integration/target-sources && echo "✓ Wave 4 merged"
git grep -l "WaitingConnectionTestStep" app/integration/target-sources && echo "✓ Wave 4 merged"
test -f memory/project_logical_db_deny_model.md 2>/dev/null && echo "note: memory record exists" || true
```

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-detail-wave6-logical-db-modal --prefix feat
cd /Users/study/pii-agent-demo-sit-detail-wave6-logical-db-modal
```

## Step 2: Required reading

1. `design/SIT Prototype v7 - standalone.html` — search `id="logicalModal"` and read the full modal body and the `openLogicalModal`/`closeLogicalModal`/`lgSave` script handlers. The JS is design-state only but the DOM structure and the count/badge labels must match.
2. `memory/project_logical_db_deny_model.md` (if accessible — it's in `~/.claude/projects/-Users-study-pii-agent-demo/memory/`). It describes the conceptual model: "(A)조회결과 ⊥ (B)Deny정책 두 데이터셋 독립, Deny는 정책이지 사실 아님".
3. `app/integration/target-sources/[targetSourceId]/_components/layout/WaitingConnectionTestStep.tsx` — where the modal trigger lands.
4. `app/components/features/process-status/ConnectionTestPanel.tsx` — the existing connection test panel rendered in Step 5. Adding a per-row action requires reading where row CTAs live today.
5. `app/components/ui/Modal.tsx` (if present) or `app/components/ui/ConfirmStepModal.tsx` for a reference shell shape.

## Step 3: Implementation

### 3-1. Types — local domain shape

Create `app/integration/target-sources/[targetSourceId]/_components/logical-db/logical-db-types.ts`:

```typescript
/**
 * Local domain shape for the logical-DB modal. No BFF backing yet —
 * the shapes are declared here, not in `lib/types`, to make it explicit
 * that they will move to `lib/types` (or under `swagger/`) when the
 * BFF endpoints land.
 */

export interface LogicalDatabase {
  /** unique identifier — typically `<server>.<database>` */
  id: string;
  /** display name shown in the panel */
  name: string;
  /** when present, an existing deny policy already excludes this entry */
  existingDenyReason?: string;
}

export interface LogicalDbModalDraft {
  /** ids the user has moved into Panel B (deny side) */
  excludedIds: ReadonlySet<string>;
  /** optional per-id reason text the user entered */
  reasons: Readonly<Record<string, string>>;
}

export interface LogicalDbModalProps {
  open: boolean;
  resourceName: string;
  /** loaded list. UI does not fetch — caller passes data in. */
  databases: ReadonlyArray<LogicalDatabase>;
  /** initial draft (defaults to empty if omitted) */
  initialDraft?: LogicalDbModalDraft;
  onSave: (draft: LogicalDbModalDraft) => void;
  onClose: () => void;
}

export interface LogicalDbDataHook {
  state:
    | { status: 'loading' }
    | { status: 'ready'; databases: LogicalDatabase[] }
    | { status: 'error'; message: string };
  retry: () => void;
}
```

### 3-2. Data hook — local-state stub

Create `app/integration/target-sources/[targetSourceId]/_components/logical-db/useLogicalDatabases.ts`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import type { LogicalDatabase, LogicalDbDataHook } from './logical-db-types';

/**
 * Local stub for logical-database data.
 *
 * BFF endpoint is not implemented. This hook returns a deterministic
 * fake list keyed on resourceId so the modal renders for any row. When
 * the BFF endpoint lands, replace the body with a real fetch call —
 * the hook's return shape is the BFF integration contract.
 */
export const useLogicalDatabases = (resourceId: string): LogicalDbDataHook => {
  const [retryNonce, setRetryNonce] = useState(0);
  const [state, setState] = useState<LogicalDbDataHook['state']>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      const databases = buildFakeDatabases(resourceId);
      setState({ status: 'ready', databases });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [resourceId, retryNonce]);

  return {
    state,
    retry: () => setRetryNonce((n) => n + 1),
  };
};

const buildFakeDatabases = (resourceId: string): LogicalDatabase[] => {
  // Deterministic fake list keyed on resourceId so the modal looks plausible.
  // Length 12 to exercise scroll + search + pagination paths.
  return Array.from({ length: 12 }, (_, i) => ({
    id: `${resourceId}.db_${String(i + 1).padStart(2, '0')}`,
    name: `db_${String(i + 1).padStart(2, '0')}`,
  }));
};
```

Notes:
- The 200ms `setTimeout` is deliberate — surfaces the loading state in the UI for review.
- Tests can mock `useLogicalDatabases` to return synchronous ready state to skip the timer.
- This hook lives **outside** `app/lib/api/` because there is no real API to wrap. When BFF lands, the new fetch hook moves to `app/lib/api/` and this file becomes a thin re-export with `@deprecated`.

### 3-3. Modal — UI shell

Create `app/integration/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModal.tsx`:

```typescript
'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';
import { SearchIcon } from '@/app/components/ui/icons';
import { cn, primaryColors, textColors } from '@/lib/theme';
import type { LogicalDbModalProps, LogicalDbModalDraft } from './logical-db-types';

const EMPTY_DRAFT: LogicalDbModalDraft = { excludedIds: new Set(), reasons: {} };

export const LogicalDbModal = ({
  open,
  resourceName,
  databases,
  initialDraft = EMPTY_DRAFT,
  onSave,
  onClose,
}: LogicalDbModalProps) => {
  const [excludedIds, setExcludedIds] = useState<ReadonlySet<string>>(initialDraft.excludedIds);
  const [reasons, setReasons] = useState<Readonly<Record<string, string>>>(initialDraft.reasons);
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');

  const { panelA, panelB } = useMemo(
    () => splitPanels(databases, excludedIds, { searchA, searchB }),
    [databases, excludedIds, searchA, searchB],
  );

  const addedCount = excludedIds.size - initialDraft.excludedIds.size; // approximate
  const removedCount = Math.max(0, initialDraft.excludedIds.size - excludedIds.size);
  const pendingCount = addedCount + removedCount;

  const moveToB = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const moveToA = (id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setReasons((prev) => {
      if (!(id in prev)) return prev;
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleSave = () => {
    onSave({ excludedIds, reasons });
  };

  return (
    <Modal isOpen={open} onClose={onClose} size="lg" title={`논리 DB 확인 · ${resourceName}`}>
      <div className="grid grid-cols-2 gap-3">
        <Panel
          label="연동 대상 후보"
          count={panelA.length}
          searchValue={searchA}
          onSearchChange={setSearchA}
          items={panelA}
          onItemClick={moveToB}
          actionLabel="제외"
        />
        <Panel
          label="연동 제외 후보"
          count={panelB.length}
          searchValue={searchB}
          onSearchChange={setSearchB}
          items={panelB}
          onItemClick={moveToA}
          actionLabel="복원"
        />
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-gray-100 mt-4 pt-4">
        <span className={cn('text-[12px]', textColors.tertiary)}>
          변경사항 <strong className={cn(textColors.primary, 'tabular-nums')}>{pendingCount}</strong>건
          {' · '}추가 <strong className={cn(primaryColors.text, 'tabular-nums')}>{addedCount}</strong>
          {' · '}제거 <strong className="text-gray-700 tabular-nums">{removedCount}</strong>
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>취소</Button>
          <Button variant="primary" disabled={pendingCount === 0} onClick={handleSave}>저장</Button>
        </div>
      </footer>
    </Modal>
  );
};

// Panel — small inline component (≤30 lines).
interface PanelProps {
  label: string;
  count: number;
  searchValue: string;
  onSearchChange: (next: string) => void;
  items: ReadonlyArray<{ id: string; name: string }>;
  onItemClick: (id: string) => void;
  actionLabel: string;
}

const Panel = ({ label, count, searchValue, onSearchChange, items, onItemClick, actionLabel }: PanelProps) => (
  <div className="flex flex-col rounded-lg border border-gray-200 bg-white min-h-[280px] max-h-[400px] overflow-hidden">
    <header className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
      <span className="text-[13px] font-semibold text-gray-800">{label}</span>
      <span className="text-[11.5px] text-gray-500 tabular-nums">{count}개</span>
    </header>
    <div className="border-b border-gray-100 px-2 py-1.5">
      <div className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2">
        <SearchIcon className="h-3 w-3 text-gray-400" />
        <input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="DB 이름 검색"
          className="h-7 w-full bg-transparent text-[12px] outline-none"
        />
      </div>
    </div>
    <ul className="flex-1 overflow-y-auto">
      {items.length === 0 ? (
        <li className="px-3 py-6 text-center text-[12px] text-gray-400">조건에 맞는 결과가 없어요.</li>
      ) : items.map((it) => (
        <li key={it.id} className="flex items-center justify-between px-3 py-2 text-[12.5px] hover:bg-gray-50">
          <span className="font-mono text-gray-700">{it.name}</span>
          <button
            type="button"
            onClick={() => onItemClick(it.id)}
            className={cn('text-[11.5px] hover:underline', primaryColors.text)}
          >
            {actionLabel}
          </button>
        </li>
      ))}
    </ul>
  </div>
);

const splitPanels = (
  databases: ReadonlyArray<{ id: string; name: string }>,
  excluded: ReadonlySet<string>,
  search: { searchA: string; searchB: string },
) => {
  const a = databases.filter((d) => !excluded.has(d.id));
  const b = databases.filter((d) => excluded.has(d.id));
  return {
    panelA: filterByName(a, search.searchA),
    panelB: filterByName(b, search.searchB),
  };
};

const filterByName = <T extends { name: string }>(items: ReadonlyArray<T>, q: string): T[] => {
  if (!q) return [...items];
  const needle = q.toLowerCase();
  return items.filter((it) => it.name.toLowerCase().includes(needle));
};
```

Notes:
- `Modal` is the existing primitive. Check its actual API — `size`, `title`, `onClose` may differ; adapt as needed.
- `0064FF` raw hex appears in the move button. Replace with `primaryColors.text` import:
  ```typescript
  import { primaryColors } from '@/lib/theme';
  // <button className={cn('text-[11.5px] hover:underline', primaryColors.text)}>
  ```
- `addedCount` computation above is a simplification (uses set difference cardinality). The accurate version subtracts the intersection of `initialDraft.excludedIds` and `excludedIds`. Keep the implementation correct — use set arithmetic:
  ```typescript
  const truePos = (id: string) => excludedIds.has(id) && !initialDraft.excludedIds.has(id);
  const trueNeg = (id: string) => !excludedIds.has(id) && initialDraft.excludedIds.has(id);
  const ids = new Set([...excludedIds, ...initialDraft.excludedIds]);
  let addedCount = 0;
  let removedCount = 0;
  ids.forEach((id) => {
    if (truePos(id)) addedCount++;
    if (trueNeg(id)) removedCount++;
  });
  ```

### 3-4. `WaitingConnectionTestStep` — wire the modal trigger

Add to `WaitingConnectionTestStep.tsx`:

```typescript
import { useModal } from '@/app/hooks/useModal';
import { useToast } from '@/app/components/ui/toast';
import { LogicalDbModal } from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModal';
import { useLogicalDatabases } from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/useLogicalDatabases';
```

`AGENTS.md:57` mandates "For modal state, use `useModal()`." The hook supports a typed payload, so the resource being inspected travels through `data` rather than a parallel `useState`.

The per-row "논리 DB 확인" button lives inside the connection-test panel. The cleanest insertion point depends on how `ConnectionTestPanel` exposes row CTAs. Two options:

**Option A** — extend `ConnectionTestPanel` with a `logicalDbSlot?: (resource) => ReactNode` prop. The Step 5 step then passes a render prop that returns the button per row.

**Option B** — render the logical-DB trigger as a sibling, not inside the test panel — a per-resource panel below the connection test results.

Choose **Option A** unless `ConnectionTestPanel` proves expensive to extend. Read the file to decide; if the row rendering is fully internal and changing it explodes the diff, fall back to Option B.

State holder lives in `WaitingConnectionTestStep`:

```typescript
const logicalDbModal = useModal<{ id: string; name: string }>();
const toast = useToast();

const handleSave = () => {
  toast.info('논리 DB 정보 저장은 BFF 연동 후 활성화됩니다.');
  logicalDbModal.close();
};

// inside JSX
{logicalDbModal.data && (
  <LogicalDbModalLoader
    open={logicalDbModal.isOpen}
    resourceId={logicalDbModal.data.id}
    resourceName={logicalDbModal.data.name}
    onSave={handleSave}
    onClose={logicalDbModal.close}
  />
)}

// from the per-row CTA:
// onClick={() => logicalDbModal.open({ id: resource.resourceId, name: resource.name })}
```

Confirm `app/hooks/useModal.ts` exposes `isOpen`, `data`, `open(payload)`, and `close()` before relying on this shape — if the project's `useModal` API differs, adapt the destructuring and update the spec.

Where `LogicalDbModalLoader` is a tiny wrapper that calls `useLogicalDatabases` and feeds the result into `LogicalDbModal`. Loading state shows a thin "불러오는 중…" inside the modal frame.

### 3-5. Tests

`LogicalDbModal.test.tsx`:
- Renders panel labels and counts.
- Clicking an item in Panel A moves it to Panel B (excludedIds grows).
- Clicking an item in Panel B moves it back (excludedIds shrinks).
- Search filters items in the panel it targets.
- Save button disabled when `pendingCount === 0`.
- Save button calls `onSave` with the final draft when clicked.
- Initial draft is respected (modal opens with the right items already in Panel B).

`useLogicalDatabases.test.ts`:
- Returns `loading` then `ready` after the timer.
- `retry` causes a refetch.
- Deterministic fake list has 12 entries keyed by resourceId.

`WaitingConnectionTestStep.test.tsx`:
- Clicking the per-row "논리 DB 확인" trigger opens the modal with the correct resource name.
- Save fires a `toast.info`.

## Step 4: Do NOT touch

- ADR-014 R3 four files (stepper).
- BFF — no `swagger`, no `lib/bff/`, no `app/integration/api/` changes.
- `lib/types.ts` — local types stay in `logical-db/` until the BFF endpoint lands.
- `ConfirmedIntegrationTable` — its column shape is Wave 5's responsibility; Wave 6 only adds the modal trigger.
- Wave 5 InstallationCompleteStep — the logical DB count columns stay `—`.
- Mock-data / mock-store — no logical-DB seed.

## Step 5: Verify

```bash
npx tsc --noEmit
npm run lint -- app/integration/target-sources/'[targetSourceId]'/_components/logical-db/ \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingConnectionTestStep.tsx
npm test --run app/integration/target-sources/'[targetSourceId]'/_components/logical-db/
```

Browser:
- Mock target source at `WAITING_CONNECTION_TEST` with at least one confirmed resource.
- Per-row "논리 DB 확인" button visible.
- Click → modal opens with two panels, search inputs, count badges.
- Move items between panels — counts update; "변경사항 N건" reflects the diff.
- Save → toast appears with the placeholder copy.
- Cancel → modal closes without firing the toast.
- Open again → state preserved? No — the initial draft is empty each open (intentional for the shell).

Stepper guard:
```bash
git diff --name-only origin/main -- \
  app/components/features/process-status/ProcessProgressBar.tsx \
  app/components/features/process-status/InstallationProcessProgressBar.tsx \
  app/components/features/process-status/StepProgressBar.tsx \
  app/components/features/process-status/motion/ \
  | (read -r line && echo "✗ stepper modified: $line" || echo "✓ stepper untouched")
```

## Step 6: Commit + push + PR

```bash
git add app/integration/target-sources/'[targetSourceId]'/_components/logical-db/ \
       app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingConnectionTestStep.tsx \
       app/integration/target-sources/'[targetSourceId]'/_components/layout/WaitingConnectionTestStep.test.tsx \
       app/components/features/process-status/ConnectionTestPanel.tsx   # only if Option A

git commit -m "feat(logical-db): Step 5 modal shell (wave6, UI-only)

Adds the '논리 DB 확인' modal trigger and the LogicalDbModal shell
matching design/SIT Prototype v7 - standalone.html screen-4 Step 5.

- logical-db/logical-db-types.ts — local domain shape
- logical-db/useLogicalDatabases.ts — stub data hook (BFF swap point)
- logical-db/LogicalDbModal.tsx — A/B panel UI with search + counts
- WaitingConnectionTestStep — opens modal per resource, save shows
  toast 'BFF 연동 후 활성화'

No BFF endpoint, no swagger change, no logical-DB seed in mock-data.
When the endpoint lands, useLogicalDatabases is the single swap point.

ProcessStatus stepper four-file guard passes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push -u origin feat/sit-detail-wave6-logical-db-modal
```

PR body:
```
## Summary

Wave 6 of the target-source detail prototype migration. Ships the Step
5 logical-DB modal as a fully working UI shell — no BFF backing.

## Why UI-only

The product team aligned on the domain shape (logical-DB selection vs
deny-policy) but the BFF endpoints are not implemented. Shipping the
modal now lets reviewers see the interaction; the `useLogicalDatabases`
hook is the single swap point when the BFF endpoint lands.

## Changes

- `logical-db/logical-db-types.ts` — local types (move to `lib/types`
  when BFF lands).
- `logical-db/useLogicalDatabases.ts` — stub returns a deterministic
  fake list with 200ms latency.
- `logical-db/LogicalDbModal.tsx` — two-panel modal with search, move,
  pending-count footer.
- `WaitingConnectionTestStep` — per-row trigger button, modal state
  holder, save → toast stub.

## On-save behavior

`onSave` fires a toast: "논리 DB 정보 저장은 BFF 연동 후 활성화됩니다."
The draft is **not** persisted. Reload reverts to the empty draft.

## Deliberately excluded

- BFF endpoint for logical databases — separate spec, blocked on
  product-side schema review.
- Persistence on save — same.
- Logical-DB count cells on Step 7 — still `—` (Wave 5 placeholders).
- ProcessStatus stepper changes (ADR-014 R3 freeze).

## Test plan
- [x] Panel A → B move
- [x] Panel B → A move
- [x] Search filters per panel
- [x] Save disabled when no diff
- [x] Save fires toast
- [x] Cancel closes without toast
- [x] Stepper four-file guard passes
```

## Step 7: Self-review checklist

- [ ] `LogicalDbModal` does not crash with empty `databases`
- [ ] Save button is disabled when `pendingCount === 0`
- [ ] `useLogicalDatabases` cleans up the timer on unmount (test by unmounting before 200ms)
- [ ] No BFF endpoint added under `app/integration/api/`
- [ ] No new file in `lib/types/` — logical types are co-located
- [ ] Stepper four-file guard passes
- [ ] No raw hex outside `lib/theme.ts` (`primaryColors.text` for the move button)

## Acceptance for this wave

Wave 6 is correct when:
- `WaitingConnectionTestStep` shows a per-row "논리 DB 확인" button.
- Clicking opens a two-panel modal with search and counts.
- Move actions update the counts; the pending row shows added/removed totals.
- Save fires the placeholder toast; cancel closes silently.
- No BFF endpoint or swagger file was modified.
- Stepper four-file guard passes.
