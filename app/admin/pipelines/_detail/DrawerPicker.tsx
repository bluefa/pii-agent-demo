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

export interface PickerOption<K extends string = string> {
  key: K;
  /** Leading dot. Omitted for an option with no verdict of its own (전체). */
  tone?: JobVerdict;
  /** Shown on the trigger and in the list — keep the whole phrase here. */
  label: string;
  /** Muted suffix in the list only, so the trigger stays one phrase. */
  meta?: string;
}

/** Generic in the key so the caller gets its OWN union back in `onPick`. With a
 *  bare `string` the job filter had to re-narrow with `key as JobFilter`, which
 *  the compiler could not check: a renamed bucket would still compile and the
 *  click would just look dead (`options.includes` rejects it and the filter
 *  silently falls back). */
export function DrawerPicker<K extends string>({
  ariaLabel,
  options,
  value,
  align = 'left',
  onPick,
}: {
  ariaLabel: string;
  options: readonly PickerOption<K>[];
  value: K;
  /** Which edge the panel hangs from. The panel is wider than the trigger, so a
   *  right-anchored trigger (the job filter) must grow left or it runs past the
   *  400px drawer, which clips it. */
  align?: 'left' | 'right';
  onPick: (key: K) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.key === value) ?? options[0];

  const focusTrigger = (): void => {
    rootRef.current?.querySelector('button')?.focus();
  };

  // Escape closes the list only — captured, so the drawer's own Escape handler
  // does not also close the panel out from under it (CustomBuildStep precedent).
  // Outside pointer-down closes too; the trigger itself owns the toggle.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      focusTrigger();
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
    <div
      ref={rootRef}
      className="relative"
      // Tab fires no pointerdown, so without this the list stays open behind
      // whatever the next Enter opens — and its captured Escape then eats the
      // modal's first Escape. Also what keeps two pickers from being open at once.
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && rootRef.current?.contains(next)) return;
        setOpen(false);
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        // The value has to be IN the name: an aria-label overrides the button's
        // own text, so naming it "시도 선택" alone announced the control and never
        // which attempt was on it.
        aria-label={`${ariaLabel}: ${current.label}`}
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
        // menu/menuitemradio, not listbox/option: the sibling menus this copies
        // (JiraTicketMenu, FilterMenu) are menus of native buttons reached by Tab,
        // and `listbox` promises arrow-key navigation this list does not implement.
        <div role="menu" aria-label={ariaLabel} className={cn(d.pickPanel, align === 'right' && 'left-auto right-0')}>
          {options.map((option) => {
            const on = option.key === current.key;
            return (
              <button
                key={option.key}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                className={cn(d.pickItem, on && d.pickItemOn)}
                onClick={() => {
                  setOpen(false);
                  onPick(option.key);
                  // The picked button unmounts with the panel; without this focus
                  // falls to <body> and the drawer loses the keyboard's place.
                  focusTrigger();
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
