'use client';

/**
 * 시도 피커 — which attempt the Job list below belongs to.
 *
 * A native `<select>` was the first cut of design-benchmark 시안 C, and the owner
 * turned it down: `appearance: auto` means the browser draws both the control and
 * the option list, so it read as a raw form field in a panel that has no other
 * form controls. This wears the repo's own dropdown grammar instead — the trigger
 * plus popover card that `JiraTicketMenu` and the request list's `FilterMenu`
 * already use.
 *
 * The dot is the attempt's own verdict, the same channel the Job 상태 필터 below
 * takes, so which run failed reads without opening the list. The trigger doubles
 * as the label ("시도 #2"), which is why the retry-budget line that used to sit
 * beside it is gone (owner 2026-08-17).
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { statusKo } from '@/lib/pipeline/format';
import { d, j } from '@/app/admin/pipelines/_detail/taskDrawerShared';
import type { JobVerdict } from '@/app/admin/pipelines/_detail/jobRows';
import type { TaskAttemptView, TaskStatus } from '@/lib/pipeline/types';

export function AttemptPicker({
  attempts,
  current,
  tone,
  onPick,
}: {
  /** Newest first — the order the list is rendered in. */
  attempts: readonly TaskAttemptView[];
  current: TaskAttemptView;
  tone: Record<TaskStatus, JobVerdict>;
  onPick: (attemptNumber: number) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Escape closes the list only — captured, so the drawer's own Escape handler
  // does not also close the panel out from under it (CustomBuildStep precedent).
  // Outside pointer-down closes too; the trigger itself owns the toggle.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      rootRef.current?.querySelector('button')?.focus();
    };
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="시도 선택"
        className={d.pickTrigger}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={cn(j.filterDot, j.verdictDot[tone[current.status]])} aria-hidden="true" />
        시도 #{current.attempt_number}
        <Icon name="chev-r" size="sm" className={cn(d.pickChev, open ? '-rotate-90' : 'rotate-90')} />
      </button>

      {open && (
        <div role="listbox" aria-label="시도" className={d.pickPanel}>
          {attempts.map((attempt) => {
            const on = attempt.attempt_number === current.attempt_number;
            return (
              <button
                key={attempt.attempt_number}
                type="button"
                role="option"
                aria-selected={on}
                className={cn(d.pickItem, on && d.pickItemOn)}
                onClick={() => {
                  setOpen(false);
                  onPick(attempt.attempt_number);
                }}
              >
                <span
                  className={cn(j.filterDot, j.verdictDot[tone[attempt.status]])}
                  aria-hidden="true"
                />
                시도 #{attempt.attempt_number}
                <span className={d.pickItemVerdict}>{statusKo(attempt.status)}</span>
                {on && <Icon name="check" size="sm" className={d.pickCheck} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
