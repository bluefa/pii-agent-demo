'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { StatusInfoIcon } from '@/app/components/ui/icons';
import { cn, idcStyles } from '@/lib/theme';

interface ReasonChipInlineProps {
  /** Full reason text — shown inside the floating tip. */
  reason: string;
  /** Short summary text inside the chip (≤ DEFAULT_SUMMARY_LIMIT chars). Derives from reason when omitted. */
  summary?: string;
  /** Secondary line inside the floating tip — typically the registrant and date as a single pre-formatted string. */
  meta?: string;
}

const DEFAULT_SUMMARY_LIMIT = 40;

const deriveSummary = (reason: string): string => {
  if (reason.length <= DEFAULT_SUMMARY_LIMIT) return reason;
  return reason.slice(0, DEFAULT_SUMMARY_LIMIT).trimEnd() + '…';
};

// `.reason-floating-tip` geometry — transcribed verbatim from
// `design/SIT Prototype Athena v16.html` (CSS vars resolved to hex:
// --fg-1 = --gray-900 #111827, --fg-3 = --gray-500 #6B7280,
// --border-default = --gray-200 #E5E7EB). A fixed-position portal so the card
// escapes the table's overflow clipping; flips above the chip when there is no
// room below, and clamps into the viewport horizontally.
const TIP_WIDTH = 340;
const TIP_MARGIN = 10; // gap between the chip and the tip
const VIEWPORT_MARGIN = 8; // viewport edge padding

const tipStyle = (
  coords: { left: number; top: number } | null,
): React.CSSProperties => ({
  position: 'fixed',
  // While `coords` is null the card is opacity-0 (see render), so the 0,0
  // origin is never a visible frame — by the time opacity flips to 1 these are
  // the real measured coordinates (calm: appears in place, no corner slide).
  left: `${coords?.left ?? 0}px`,
  top: `${coords?.top ?? 0}px`,
  width: `${TIP_WIDTH}px`,
  background: '#FFFFFF',
  color: '#111827',
  padding: '14px 16px',
  borderRadius: '12px',
  fontSize: '12.5px',
  fontWeight: 400,
  lineHeight: 1.65,
  border: '1px solid #E5E7EB',
  boxShadow: '0 16px 40px rgba(15, 23, 42, 0.14), 0 4px 12px rgba(15, 23, 42, 0.08)',
  // Reset the global inherited letter-spacing so the body text is not spaced.
  letterSpacing: 0,
  textTransform: 'none',
  whiteSpace: 'normal',
  pointerEvents: 'none',
});

export const ReasonChipInline = ({ reason, summary, meta }: ReasonChipInlineProps) => {
  const displaySummary = summary ?? deriveSummary(reason);
  const chipRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  // Fixed-viewport coordinates for the portaled card. `null` until measured.
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  // True when the card had to flip above the chip — moves the arrow to the bottom.
  const [flipUp, setFlipUp] = useState(false);

  useLayoutEffect(() => {
    // When hidden, drop coords so the next reveal re-measures from scratch.
    // Deferred to keep the commit out of the effect body (repo lint: no sync
    // setState in effects).
    if (!isVisible) {
      queueMicrotask(() => setCoords(null));
      return;
    }
    if (!chipRef.current || !tipRef.current) return;

    // Read the card's real height while it is mounted invisibly; width is fixed.
    const chip = chipRef.current.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();

    let left = chip.left;
    let top = chip.bottom + TIP_MARGIN;
    let resolvedFlipUp = false;
    if (top + tip.height + VIEWPORT_MARGIN > window.innerHeight) {
      top = chip.top - tip.height - TIP_MARGIN;
      resolvedFlipUp = true;
    }
    if (left + TIP_WIDTH + VIEWPORT_MARGIN > window.innerWidth) {
      left = window.innerWidth - TIP_WIDTH - VIEWPORT_MARGIN;
    }
    if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;

    queueMicrotask(() => {
      setFlipUp(resolvedFlipUp);
      setCoords({ left, top });
    });
  }, [isVisible]);

  return (
    <>
      <span
        ref={chipRef}
        tabIndex={0}
        className={idcStyles.reasonChip.base}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
      >
        <StatusInfoIcon className={cn('h-3 w-3', idcStyles.reasonChip.icon)} />
        <span className={idcStyles.reasonChip.text}>{displaySummary}</span>
      </span>
      {isVisible &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tipRef}
            style={tipStyle(coords)}
            // Mounted invisibly while coords are measured, then fades in at its
            // final fixed position. Opacity + 4px translate only (calm reveal).
            className={cn(
              'z-[9999] transition-[opacity,transform] duration-150 ease-out',
              coords ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0',
            )}
          >
            {/* rft-label: uppercase, orange, leading 4px dot */}
            <span className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#C2410C]">
              <span className="h-1 w-1 rounded-full bg-[#C2410C]" aria-hidden="true" />
              제외 사유
            </span>
            <span className="block">{reason}</span>
            {meta && (
              <span className="mt-2.5 block border-t border-[#E5E7EB] pt-2.5 text-[11.5px] text-[#6B7280]">
                {meta}
              </span>
            )}
            {/* Arrow — 11px rotated square pointing at the chip; moves to the
                bottom edge when the card flips above the chip. */}
            <span
              aria-hidden="true"
              className={cn(
                'absolute left-[22px] h-[11px] w-[11px] rotate-45 bg-[#FFFFFF]',
                flipUp
                  ? 'bottom-[-6px] border-b border-r border-[#E5E7EB]'
                  : 'top-[-6px] border-l border-t border-[#E5E7EB]',
              )}
            />
          </div>,
          document.body,
        )}
    </>
  );
};
