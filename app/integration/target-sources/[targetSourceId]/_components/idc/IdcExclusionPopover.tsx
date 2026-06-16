'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EditIcon } from '@/app/components/ui/icons';
import { IDC_EXCL_PRESETS } from '@/lib/constants/idc';
import {
  bgColors,
  borderColors,
  cn,
  primaryColors,
  textColors,
} from '@/lib/theme';

interface IdcExclusionPopoverProps {
  /** Element the popover anchors to (the unchecked checkbox or reason chip). */
  anchor: HTMLElement;
  /** Currently selected preset (when a preset reason is active). */
  selectedPreset?: string;
  /** True when the active reason is custom (highlights the "직접 입력" row). */
  customActive: boolean;
  /** Picked a preset reason. */
  onPickPreset: (reason: string) => void;
  /** Chose "사유 직접 입력" — parent opens the reason modal. */
  onPickCustom: () => void;
  /** Outside-click or ESC without a confirmed reason → parent reverts. */
  onDismiss: () => void;
}

const POPOVER_GAP = 6;
const VIEWPORT_MARGIN = 8;

/**
 * Exclusion-reason picker anchored to a row. Presets + "사유 직접 입력".
 * Outside-click / ESC closes via `onDismiss` so the parent can revert the check
 * when no reason was confirmed (v15 closeIdcReasonPopover).
 */
export const IdcExclusionPopover = ({
  anchor,
  selectedPreset,
  customActive,
  onPickPreset,
  onPickCustom,
  onDismiss,
}: IdcExclusionPopoverProps) => {
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });

  useLayoutEffect(() => {
    const pop = popRef.current;
    if (!pop) return;
    const rect = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(rect.left, window.innerWidth - pw - VIEWPORT_MARGIN),
    );
    const top =
      rect.bottom + POPOVER_GAP + ph > window.innerHeight
        ? rect.top - ph - POPOVER_GAP
        : rect.bottom + POPOVER_GAP;
    setPos({ top, left });
  }, [anchor]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onDismiss();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    // Defer to skip the same click that opened the popover.
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', onPointerDown, true);
    }, 0);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onDismiss]);

  return (
    <div
      ref={popRef}
      role="menu"
      aria-label="제외 사유 선택"
      style={{ top: pos.top, left: pos.left }}
      className={cn(
        'fixed z-50 w-[200px] rounded-xl border p-1.5 shadow-xl',
        borderColors.default,
        bgColors.surface,
      )}
    >
      <div className={cn('px-2 py-1.5 text-[11px] font-semibold', textColors.tertiary)}>
        제외 사유 선택
      </div>
      {IDC_EXCL_PRESETS.map((reason) => {
        const active = !customActive && selectedPreset === reason;
        return (
          <button
            key={reason}
            type="button"
            role="menuitem"
            onClick={() => onPickPreset(reason)}
            className={cn(
              'flex w-full items-center rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors',
              active
                ? cn(primaryColors.bgLight, primaryColors.text)
                : cn(textColors.secondary, bgColors.mutedHover),
            )}
          >
            {reason}
          </button>
        );
      })}
      <button
        type="button"
        role="menuitem"
        onClick={onPickCustom}
        className={cn(
          'mt-0.5 flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors',
          customActive
            ? cn(primaryColors.bgLight, primaryColors.text)
            : cn(textColors.secondary, bgColors.mutedHover),
        )}
      >
        <EditIcon className="h-3 w-3" />
        사유 직접 입력
      </button>
    </div>
  );
};
