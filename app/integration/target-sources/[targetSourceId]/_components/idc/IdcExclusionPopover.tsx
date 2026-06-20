'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EditIcon } from '@/app/components/ui/icons';
import { IDC_EXCL_PRESETS } from '@/lib/constants/idc';
import { cn, idcStyles } from '@/lib/theme';

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
      className={idcStyles.popover.container}
    >
      <div className={idcStyles.popover.title}>제외 사유 선택</div>
      {IDC_EXCL_PRESETS.map((reason) => {
        const active = !customActive && selectedPreset === reason;
        return (
          <button
            key={reason}
            type="button"
            role="menuitem"
            onClick={() => onPickPreset(reason)}
            className={cn(idcStyles.popover.opt, active && idcStyles.popover.optSelected)}
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
          idcStyles.popover.opt,
          idcStyles.popover.custom,
          customActive && idcStyles.popover.optSelected,
        )}
      >
        <EditIcon className="h-3 w-3" />
        사유 직접 입력
      </button>
    </div>
  );
};
