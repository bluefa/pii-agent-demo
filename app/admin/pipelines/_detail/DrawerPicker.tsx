'use client';

/**
 * The task drawer's dropdown — a trigger plus a popover list in the repo's own
 * menu grammar (`JiraTicketMenu`, the request list's `FilterMenu`), not a native
 * `<select>`: `appearance: auto` had the browser draw both the control and its
 * option list, which read as an OS widget in a panel with no other form control
 * (owner 2026-08-17).
 *
 * Two consumers, one shape. The attempt picker sits on the verdict line; the Job
 * status filter sits in the job list's header. Both choose one of a short list of
 * options that each carry a verdict dot, and both are where a segmented control
 * ran out of room — the filter's four buckets measured 353px against 351px of
 * panel and wrapped to a second line.
 *
 * The dot is the option's own verdict, the channel the job rows below use, so
 * which run or which bucket failed reads without opening the list.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { d, j } from '@/app/admin/pipelines/_detail/taskDrawerShared';
import type { JobVerdict } from '@/app/admin/pipelines/_detail/jobRows';

export interface PickerOption {
  key: string;
  /** Leading dot. Omitted for an option with no verdict of its own (전체). */
  tone?: JobVerdict;
  /** Shown on the trigger and in the list — keep the whole phrase here. */
  label: string;
  /** Muted suffix in the list only, so the trigger stays one phrase. */
  meta?: string;
}

export function DrawerPicker({
  ariaLabel,
  options,
  value,
  onPick,
}: {
  ariaLabel: string;
  options: readonly PickerOption[];
  value: string;
  onPick: (key: string) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.key === value) ?? options[0];

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
        aria-label={ariaLabel}
        className={d.pickTrigger}
        onClick={() => setOpen((prev) => !prev)}
      >
        {current.tone && (
          <span className={cn(j.filterDot, j.verdictDot[current.tone])} aria-hidden="true" />
        )}
        {current.label}
        <Icon name="chev-r" size="sm" className={cn(d.pickChev, open ? '-rotate-90' : 'rotate-90')} />
      </button>

      {open && (
        <div role="listbox" aria-label={ariaLabel} className={d.pickPanel}>
          {options.map((option) => {
            const on = option.key === current.key;
            return (
              <button
                key={option.key}
                type="button"
                role="option"
                aria-selected={on}
                className={cn(d.pickItem, on && d.pickItemOn)}
                onClick={() => {
                  setOpen(false);
                  onPick(option.key);
                }}
              >
                {option.tone && (
                  <span className={cn(j.filterDot, j.verdictDot[option.tone])} aria-hidden="true" />
                )}
                {option.label}
                {option.meta && <span className={d.pickItemMeta}>{option.meta}</span>}
                {on && <Icon name="check" size="sm" className={d.pickCheck} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
