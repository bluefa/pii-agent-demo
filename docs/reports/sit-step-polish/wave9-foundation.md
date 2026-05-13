# Wave 9 — Foundation primitives & shared tokens

## Context

The audit (`docs/reports/sit-prototype-implementation-gaps-audit-2026-05-14.md`)
identified four cross-cutting primitives that every step polish wave needs:

1. **`CopyButton`** — extracted from `PageMeta` so tables can adopt the
   copy-on-hover pattern (audit G2).
2. **`cardStyles.cardTitle`** — the 22 px / 700 / `-0.01em` token the
   prototype uses for in-card titles. Three step components currently
   hardcode `text-lg font-semibold` (=18 px) and miss the visual cue (audit G3).
3. **`ScanPill` semantic states** — extend the existing `'integrated' |
   'pending' | 'none'` union with `'new'` and `'changed'` so future waves
   can wire the full prototype scan-pill palette (audit G8).
4. **Page `bg-muted` shell** — the prototype renders cards over a
   `--bg-muted` `#F9FAFB` shell; today the layout is white-on-white,
   which collapses the visual hierarchy (audit G4).

This wave ships only the primitives + the layout one-liner. **No
step-level wiring is in scope.** Waves 10–13 consume what this wave exports.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
git grep -l "ScanPill" app/components/ui && echo "✓ Wave 7 merged"
git grep -l "PageMeta" app/components/ui && echo "✓ Wave 1 merged"
```

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-step-polish-wave9-foundation --prefix feat
cd /Users/study/pii-agent-demo-sit-step-polish-wave9-foundation
```

## Step 2: Required reading

1. `design/SIT Prototype v7 - standalone.html` — search for `.copy-btn`
   (the hover-revealed pattern), `--type-h1` (22 px card title rule),
   `.scan-pill` (3 semantic variants), `--bg-muted` (`#F9FAFB`).
2. `app/components/ui/PageMeta.tsx` — the source of truth for the copy-on-hover
   pattern. The new `CopyButton` is a strict extraction of what `PageMetaRow`
   already does — do not invent new copy semantics.
3. `app/components/ui/ScanPill.tsx` (post-Wave-7) — current palette.
4. `lib/theme.ts` — `cardStyles`, `statusColors`, `pageMetaStyles`,
   `interactiveColors`, `bgColors`.
5. `app/integration/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout.tsx`
   — the one line that gets `bg-muted`.

## Step 3: Implementation

### 3-1. `CopyButton` primitive

Create `app/components/ui/CopyButton.tsx`:

```typescript
'use client';

import { useState, useCallback } from 'react';
import { CheckIcon, CopyIcon } from '@/app/components/ui/icons';
import { cn, interactiveColors, statusColors, textColors } from '@/lib/theme';

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
}

const COPIED_RESET_MS = 1500;

export const CopyButton = ({ value, label, className }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label ?? `${value} 복사`}
      className={cn(
        'inline-grid h-[22px] w-[22px] place-items-center rounded-md',
        'transition-opacity transition-colors',
        copied ? statusColors.success.textDark : textColors.quaternary,
        interactiveColors.closeButton,
        className,
      )}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
};
```

**Notes:**
- Default styling matches the prototype's `.copy-btn` (22 × 22, opacity-controlled
  via parent `group-hover:opacity-100`).
- The `className` prop is the seam consumers use to wire `opacity-0
  group-hover:opacity-100` on a row-hover-revealed variant.
- `interactiveColors.closeButton` is reused (already mapped to `hover:bg-gray-50`
  in `lib/theme.ts`), which matches the prototype's `:hover { background:
  #F9FAFB }`.
- `setTimeout` cleanup is intentionally omitted — same pattern as `PageMeta`
  (1.5 s reset doesn't need a cleanup; component unmount discards the
  timer's setState target).

### 3-2. `CopyButton` tests

Create `app/components/ui/CopyButton.test.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CopyButton } from '@/app/components/ui/CopyButton';

describe('CopyButton', () => {
  it('writes value to clipboard on click', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CopyButton value="abc-123" />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('abc-123'));
  });

  it('uses provided label as aria-label', () => {
    render(<CopyButton value="abc" label="리소스 ID 복사" />);
    expect(screen.getByRole('button', { name: '리소스 ID 복사' })).toBeInTheDocument();
  });

  it('defaults aria-label to "<value> 복사"', () => {
    render(<CopyButton value="r-99" />);
    expect(screen.getByRole('button', { name: 'r-99 복사' })).toBeInTheDocument();
  });

  it('flips to checkmark for 1.5s after copy', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    render(<CopyButton value="x" />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const button = screen.getByRole('button');
    // CopyIcon has <rect>, CheckIcon does not — use that as the state probe.
    expect(button.querySelector('rect')).not.toBeInTheDocument();
    vi.advanceTimersByTime(1500);
    expect(button.querySelector('rect')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
```

### 3-3. `cardStyles.cardTitle` token

Update `lib/theme.ts` — extend `cardStyles`:

```ts
export const cardStyles = {
  // ... existing fields (base, eyebrow, displayTitle, subtitle, warmVariant)
  cardTitle: 'text-[22px] font-bold tracking-[-0.01em] leading-[1.25] text-gray-900',
};
```

**Rationale (per audit §4 D2):** Prototype `--type-h1` is 22 px / 700 / `-0.01em` /
1.25 line-height / `#111827`. Steps 2, 6, 7 currently hardcode `text-lg
font-semibold` (= 18 / 600). Wave 9 introduces the token; Waves 11 and 12
swap consumers.

No deprecation of `cardStyles.displayTitle` (30 px page-level title) — they
are distinct levels in the hierarchy.

### 3-4. `ScanPill` `new` and `changed` states

Update `app/components/ui/ScanPill.tsx`:

```typescript
import { cn, statusColors, textColors } from '@/lib/theme';

export type ScanPillState = 'integrated' | 'pending' | 'new' | 'changed' | 'none';

interface ScanPillProps {
  state: ScanPillState;
}

type ScanPillPalette = { bg: string; text: string; dot: string; label: string };

const PALETTE: Record<Exclude<ScanPillState, 'none'>, ScanPillPalette> = {
  integrated: {
    bg: statusColors.success.bg,
    text: statusColors.success.textDark,
    dot: statusColors.success.dot,
    label: 'Integrated',
  },
  pending: {
    bg: statusColors.warning.bg,
    text: statusColors.warning.textDark,
    dot: statusColors.warning.dot,
    label: 'Pending',
  },
  new: {
    bg: statusColors.info.bg,
    text: statusColors.info.textDark,
    dot: statusColors.info.dot,
    label: 'New',
  },
  changed: {
    bg: statusColors.warning.bg,
    text: statusColors.warning.textDark,
    dot: statusColors.warning.dot,
    label: 'Changed',
  },
};

export const ScanPill = ({ state }: ScanPillProps) => {
  if (state === 'none') {
    return <span className={cn('text-[12px]', textColors.quaternary)}>—</span>;
  }
  const palette = PALETTE[state];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium',
        palette.bg,
        palette.text,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', palette.dot)} />
      {palette.label}
    </span>
  );
};
```

**Note on palette overlap:** Prototype uses orange for both `pending` and
`changed`. The two states are semantically distinct (in-flight vs.
"different from last scan") but share styling. Acceptable per spec; if a
future design separates them, only the palette table changes.

If `statusColors.info` doesn't exist yet, add it in the same edit:

```ts
// lib/theme.ts — statusColors
info: {
  bg: 'bg-blue-50',
  textDark: 'text-blue-900',
  dot: 'bg-blue-500',
},
```

### 3-5. `ScanPill` test additions

Append to `app/components/ui/ScanPill.test.tsx`:

```typescript
it('renders New state with blue palette', () => {
  render(<ScanPill state="new" />);
  expect(screen.getByText('New')).toBeInTheDocument();
});

it('renders Changed state with amber palette', () => {
  render(<ScanPill state="changed" />);
  expect(screen.getByText('Changed')).toBeInTheDocument();
});
```

### 3-6. Page `bg-muted` shell

Update `app/integration/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout.tsx`:

```diff
- return <main className="max-w-[1200px] mx-auto p-7 space-y-6">{step}</main>;
+ return <main className={cn(bgColors.muted, 'min-h-screen')}>
+   <div className="max-w-[1200px] mx-auto p-7 space-y-6">{step}</div>
+ </main>;
```

Imports:
```ts
import { bgColors, cn } from '@/lib/theme';
```

**Why not on `<body>`:** The root `app/layout.tsx` is shared with every other
page in the app (admin list, login, etc.). The detail page is the only
surface that wants the muted shell, so the wrapper is the right scope.

**Note:** This is the one place where the wave intentionally crosses into
the step shell. It is a single 4-line change and does not touch step rendering.

### 3-7. Coverage test sanity

`CloudTargetSourceLayout.coverage.test.tsx` already asserts the inner step
sentinel for each `ProcessStatus`. The new wrapper does not change that
hierarchy. Verify the existing test still passes; do not modify it.

## Step 4: Do NOT touch

- ADR-014 R3 four files (stepper).
- Any step component (Waves 10–13 own them).
- Any table component (Wave 13 owns the table polish).
- `app/layout.tsx` — root layout is shared with other pages.
- BFF — no new field, no new endpoint.
- `lib/types.ts` — no schema change.

## Step 5: Verify

```bash
npx tsc --noEmit
npm run lint -- \
  app/components/ui/CopyButton.tsx \
  app/components/ui/CopyButton.test.tsx \
  app/components/ui/ScanPill.tsx \
  app/components/ui/ScanPill.test.tsx \
  lib/theme.ts \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/CloudTargetSourceLayout.tsx
npm test --run \
  app/components/ui/CopyButton.test.tsx \
  app/components/ui/ScanPill.test.tsx \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/CloudTargetSourceLayout.coverage.test.tsx
```

Browser smoke (any mock target source):
- The page background is visibly off-white (gray-50), cards float on top.
- Existing PageMeta copy-button still works (no regression).
- ScanPill on Step 3 still renders Pending pills (no consumer change yet).

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
git add \
  app/components/ui/CopyButton.tsx \
  app/components/ui/CopyButton.test.tsx \
  app/components/ui/ScanPill.tsx \
  app/components/ui/ScanPill.test.tsx \
  lib/theme.ts \
  app/integration/target-sources/'[targetSourceId]'/_components/layout/CloudTargetSourceLayout.tsx

git commit -m "feat(step-polish): foundation primitives — CopyButton, cardTitle token, ScanPill states, page shell (wave9)

- CopyButton: extracted from PageMeta. 22x22 hover-revealed button,
  1.5s checkmark, aria-label aware.
- cardStyles.cardTitle: 22px / 700 / -0.01em token; replaces ad-hoc
  text-lg in Waves 11/12 consumers.
- ScanPill: extended with New (blue) and Changed (amber) states.
  statusColors.info added.
- CloudTargetSourceLayout: bg-muted shell on the main wrapper so
  cards float on the prototype's #F9FAFB surface.

No step-level wiring in this wave. Waves 10-13 consume these primitives.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push -u origin feat/sit-step-polish-wave9-foundation
```

PR body:
```
## Summary

Wave 9 of the step-polish set. Ships the four cross-cutting primitives
that Waves 10-13 import; no step-level wiring here.

## Primitives

- `app/components/ui/CopyButton.tsx` — strict extraction of PageMeta's
  copy-on-hover pattern. Consumers wire `opacity-0 group-hover:opacity-100`
  via the `className` prop.
- `lib/theme.ts` — `cardStyles.cardTitle` (22px / 700 / -0.01em) added.
  `statusColors.info` added (used by ScanPill 'new' state).
- `app/components/ui/ScanPill.tsx` — adds `'new'` (blue) and `'changed'`
  (amber) to the state union. `'pending'` and `'changed'` share amber by
  design (audit notes the prototype overlap).
- `CloudTargetSourceLayout.tsx` — single 4-line wrap: `<main bg-muted><div
  max-w-1200 ...>`. The detail page is the only surface that wants the
  muted shell; root layout untouched.

## Acceptance

- [ ] CopyButton renders, copies, flips to checkmark, resets after 1.5s.
- [ ] ScanPill 'new' / 'changed' render with their distinct palettes.
- [ ] Detail page background is visibly gray-50; cards float on top.
- [ ] No step component touched; no table component touched.
- [ ] Stepper four-file guard passes.
- [ ] `tsc` 0 errors; lint 0 new warnings.

## Out of scope (later waves)

- Step-level GuideCard mounts → Wave 10/11/12.
- Table CopyButton adoption → Wave 13 (and Wave 10 for InstallResourceTable).
- `cardTitle` token consumers → Wave 11 (WaitingApprovalCard) and Wave 12
  (ConnectionVerifiedStep, InstallationCompleteStep).
- ScanPill 'new'/'changed' wiring (deriveScanPill stays at 'pending').
- Tooltip keyboard a11y (separate Wave 5 follow-up).
```

## Step 7: Self-review checklist

- [ ] `CopyButton` does not include any inline styles — uses tokens only.
- [ ] `CopyButton` props are minimal: `value`, `label?`, `className?`. No `onClick`, no `size`.
- [ ] `cardStyles.cardTitle` is the new addition; no existing token is
      renamed or removed.
- [ ] `statusColors.info` palette aligns with the prototype's blue
      (`#1E40AF` text, `#EFF6FF` bg → Tailwind `blue-900` / `blue-50`).
- [ ] `ScanPill 'none'` still renders a dash, not a chip frame.
- [ ] Layout `bg-muted` wrapper does not change the inner step component
      tree — the coverage test sentinel remains untouched.
- [ ] No `any`, no relative imports, no raw hex.
- [ ] Stepper four-file guard passes.

## Acceptance for this wave

Wave 9 is correct when:
- `CopyButton`, `cardTitle` token, `ScanPill new/changed`, and
  `bg-muted` shell are all live on `origin/main`.
- Existing PageMeta copy still works (no regression).
- Step 3 ScanPill still renders Pending pills (deriveScanPill unchanged).
- The detail page renders cards on a gray-50 shell.
- Waves 10-13 are unblocked (their imports are satisfied).
