# Wave 11-B2 — QueueBoard Modal State → Discriminated Union

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
Wave 11 consumer task targeting audit §C1 (scattered state), §C3 (scattered modal state), §C6 (setState clusters).

Source: `app/components/features/queue-board/QueueBoard.tsx` — 13 useStates, including 3 modal-open booleans and 2 "currently selected item" slots that could all become one discriminated union.

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f app/components/features/queue-board/QueueBoard.tsx ] || { echo "✗ source file missing"; exit 1; }
```

No foundation dependency — this spec can run in parallel with A1/A2/B3.

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave11-b2-queueboard-modal --prefix refactor
cd /Users/study/pii-agent-demo-wave11-b2-queueboard-modal
```

## Step 2: Required reading
1. `docs/reports/frontend-anti-patterns-audit-2026-04-23.md` §C1, §C3, §C6
2. `.claude/skills/anti-patterns/SKILL.md` §C3 (discriminated union modal pattern)
3. `app/components/features/queue-board/QueueBoard.tsx:29-41` — current useState cluster
4. `app/components/features/queue-board/QueueBoard.tsx:93-94,290,303,308` — the setState clusters (3+ setStates per handler)
5. Sibling files to confirm they don't set this state externally:
   - `app/components/features/queue-board/RejectModal.tsx`
   - `app/components/features/queue-board/ApproveModal.tsx`
   - `app/components/features/queue-board/DetailModal.tsx` (or equivalent)

## Step 3: Implementation

### 3-1. Define the union
At module scope (or inline above the component):
```ts
type ModalState =
  | { type: 'none' }
  | { type: 'reject'; item: ApprovalItem }
  | { type: 'detail'; item: ApprovalItem }
  | { type: 'approve'; target: ApprovalItem };

const MODAL_CLOSED: ModalState = { type: 'none' };
```

Replace the concrete types with whatever the existing `selectedItem` and `approveTarget` types are — do **not** change those types.

### 3-2. Collapse 5 useStates into 1
Current:
```ts
const [rejectModalOpen, setRejectModalOpen] = useState(false);
const [detailModalOpen, setDetailModalOpen] = useState(false);
const [approveModalOpen, setApproveModalOpen] = useState(false);
const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
const [approveTarget, setApproveTarget] = useState<ApprovalItem | null>(null);
```

After:
```ts
const [modal, setModal] = useState<ModalState>(MODAL_CLOSED);
```

### 3-3. Update handlers
Every site that flipped an `*Open` boolean + set an item becomes a single `setModal({ type: '...', item/target })`. Every close handler becomes `setModal(MODAL_CLOSED)`.

Each modal's `open` prop derives from the union:
```tsx
<RejectModal
  open={modal.type === 'reject'}
  item={modal.type === 'reject' ? modal.item : null}
  onClose={() => setModal(MODAL_CLOSED)}
/>
```

### 3-4. Keep the 8 other useStates alone
`loading`, `error`, `activeTab`, `requestType`, `search`, `page`, `data`, `selectedService` (or whatever is there) — **out of scope**. The audit flags `loading`/`error` separately (§C4) and pagination state separately; those belong to later waves.

### 3-5. useState count target
`useState` count in the file: **13 → ≤ 8**. If you end up at 9 or 10, something went wrong — confirm the 5 targeted useStates (above) are the ones collapsed.

## Step 4: Do NOT touch
- Any sibling component (`RejectModal.tsx`, `ApproveModal.tsx`, etc.) — only their `open` / `item` props are consumed differently; their internals are untouched.
- Pagination logic, server-state (`data`, `loading`, `error`) — §C2 / §C4 belong to other waves.
- JSX structure outside handler wiring.
- Files outside `app/components/features/queue-board/`.

## Step 5: Verify
```
npx tsc --noEmit
npm run lint -- app/components/features/queue-board/
npm run build
```

Manual check:
- Open QueueBoard as an admin
- Click a row → detail modal opens, data displayed
- Click reject on a pending item → reject modal opens with the right item
- Click approve → approve modal opens with the right target
- Close each modal → QueueBoard returns to clean state
- Open one modal, dismiss, open another — no stale data from the previous one

## Step 6: Commit + push + PR
```
git add app/components/features/queue-board/QueueBoard.tsx
git commit -m "refactor(queue-board): modal state → discriminated union (wave11-B2)

Addresses audit §C1/§C3/§C6.

- 3 open-flag booleans + 2 item slots → one ModalState union
  ({ type: 'none' | 'reject' | 'detail' | 'approve'; ... })
- Handlers collapse 3-setState clusters (open flag + item + error reset)
  into a single setModal(...)
- useState count in QueueBoard.tsx: 13 → ≤ 8

Scope: modal state only. Out-of-scope (flagged in audit, not fixed here):
- loading/error boolean pair (§C4)
- server state → React Query migration (§C2)
- pagination calculation extraction
- approve/reject submodule internals"
git push -u origin refactor/wave11-b2-queueboard-modal
```

PR body (write to `/tmp/pr-wave11-b2-body.md`):
```
## Summary

Collapse five useStates (three modal-open booleans + two "selected item"
slots) in QueueBoard into a single `ModalState` discriminated union, per
audit §C3. Incidentally cleans up the 3-consecutive-setState clusters
(§C6) in the handlers that managed them.

## Why

`rejectModalOpen`, `detailModalOpen`, `approveModalOpen` can each be
true in principle — plus two `selectedItem`/`approveTarget` slots that
must stay synchronized. The union makes illegal states unrepresentable
and shrinks every handler by 2-3 lines.

## Changes
- `app/components/features/queue-board/QueueBoard.tsx`
  - 5 useStates → 1 useState<ModalState>
  - Handler sites reduced from 3 setStates each to 1
  - Sibling modals' `open` / `item` props derived from `modal.type`

## Out of scope (per audit, left for later waves)
- `loading` / `error` boolean pair (§C4)
- Server-state migration to React Query (§C2)
- Pagination calculation (`items`, `pageInfo`, `pageNumbers`, `rangeStart` computed inline)
- Sibling modal internals

## Test plan
- [x] `npx tsc --noEmit`
- [x] `npm run lint`
- [x] `npm run build`
- [x] Manual: detail modal on row click
- [x] Manual: reject modal with correct item
- [x] Manual: approve modal with correct target
- [x] Manual: close-then-open-another leaves no stale data

## Ref
- Audit: `docs/reports/frontend-anti-patterns-audit-2026-04-23.md` §C3
- Skill: `.claude/skills/anti-patterns/SKILL.md` §C3
- Parallel: `wave11-A1`, `wave11-A2`, `wave11-B3` — no shared files
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report the URL.

## Return (under 200 words)
1. PR URL
2. `tsc` / `lint` / `build` results
3. useState count before/after
4. Number of setState call sites collapsed
5. Any handler you touched that had **4+** setStates clustered (flag for audit accuracy — §C6 listed 3-ish)
6. Deviations from spec with rationale

## Parallel coordination
- Safe to run in parallel with `wave11-A1`, `wave11-A2`, `wave11-B3` — no shared files
- No prerequisite merges required
