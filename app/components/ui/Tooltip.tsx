'use client';

import { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn, primaryColors } from '@/lib/theme';

type TooltipSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * v15 dark-popover variants. `status` = the Step 7 health-status header tooltip
 * (#111827 box, radius 8, line-height 1.5); `sourceIp` = the IDC Source-IP header
 * tooltip (#1F2937 box, radius 10, line-height 1.6). Both share the 280px fixed
 * width, 11.5px text, and rotated-square arrow per `design/v15-extract/09-tooltips.md`.
 */
type TooltipVariant = 'status' | 'sourceIp';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  size?: TooltipSize;
  variant?: TooltipVariant;
  /**
   * Extra classes for the trigger wrapper. Lets callers make the wrapper
   * shrinkable/clipping (e.g. `min-w-0 overflow-hidden`) so a `truncate` child
   * can actually ellipsis inside a constrained cell.
   */
  triggerClassName?: string;
}

// Per-variant literal hex/box geometry — values transcribed verbatim from
// design/v15-extract/09-tooltips.md (no rounding, no inference).
const variantStyles: Record<
  TooltipVariant,
  { box: string; radius: string; shadow: string; lineHeight: string }
> = {
  status: {
    box: '#111827',
    radius: '8px',
    shadow: '0 8px 24px rgba(0,0,0,0.18)',
    lineHeight: '1.5',
  },
  sourceIp: {
    box: '#1F2937',
    radius: '10px',
    shadow: '0 8px 24px rgba(0,0,0,0.22)',
    lineHeight: '1.6',
  },
};

export const Tooltip = ({
  content,
  children,
  position = 'top',
  size = 'md',
  variant = 'status',
  triggerClassName,
}: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  // `actualPosition` is the resolved top/bottom placement after viewport flip.
  // left/right requests collapse onto the top/bottom axis since the floating tip
  // is centered on the trigger horizontally.
  const [actualPosition, setActualPosition] = useState<'top' | 'bottom'>(
    position === 'bottom' ? 'bottom' : 'top'
  );
  // Fixed-viewport coordinates for the portaled popover. `null` until measured:
  // the popover mounts invisibly (opacity-0) so its height can be read, then
  // becomes visible only once these real coords are committed — so its first
  // *visible* frame is already at the final position (no slide from the origin).
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  // Horizontal pixel offset between the box center and the trigger center after
  // viewport clamping, so the arrow can keep pointing at the trigger.
  const [arrowOffset, setArrowOffset] = useState(0);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // `size` is retained for backward-compat with existing callers, but v15 fixes
  // the popover at 280px so the width no longer varies. Keep referencing it to
  // preserve the prop's place in the public API.
  void size;

  // Box geometry constants used for both positioning math and rendering.
  const BOX_WIDTH = 280;
  const GAP = 8; // distance between trigger edge and box (matches mb-2/mt-2)
  const PADDING = 16; // viewport edge padding

  useLayoutEffect(() => {
    // When hidden, drop coords so the next reveal re-measures from scratch and
    // re-arms the invisible-mount → measure → reveal sequence. Deferred to keep
    // the commit out of the effect body (repo lint: no sync setState in effects).
    if (!isVisible) {
      queueMicrotask(() => setCoords(null));
      return;
    }
    if (!tooltipRef.current || !containerRef.current) return;

    // Read the popover's real height while it is mounted invisibly; width is the
    // fixed BOX_WIDTH. Runs before paint (layout effect) so the value is ready
    // for the same frame the popover becomes visible.
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const container = containerRef.current.getBoundingClientRect();
    const triggerCenterX = container.left + container.width / 2;

    // Vertical: default place above the trigger; flip below if there isn't room
    // above within the viewport.
    const wantsBottom = position === 'bottom';
    const fitsAbove = container.top - tooltipRect.height - GAP >= PADDING;
    const fitsBelow = container.bottom + tooltipRect.height + GAP <= window.innerHeight - PADDING;

    let resolved: 'top' | 'bottom';
    if (wantsBottom) {
      resolved = fitsBelow || !fitsAbove ? 'bottom' : 'top';
    } else {
      resolved = fitsAbove || !fitsBelow ? 'top' : 'bottom';
    }

    const top =
      resolved === 'top'
        ? container.top - tooltipRect.height - GAP
        : container.bottom + GAP;

    // Horizontal: center on the trigger, then clamp into the viewport.
    const idealLeft = triggerCenterX - BOX_WIDTH / 2;
    const maxLeft = window.innerWidth - PADDING - BOX_WIDTH;
    const clampedLeft = Math.max(PADDING, Math.min(idealLeft, maxLeft));

    // Defer the position commit out of the effect body: the geometry is derived
    // from a post-mount DOM measurement, so a synchronous setState here would be
    // a cascading render. queueMicrotask matches the existing repo pattern.
    queueMicrotask(() => {
      setActualPosition(resolved);
      setCoords({ left: clampedLeft, top });
      // Arrow should sit at the trigger center relative to the (possibly clamped)
      // box left edge.
      setArrowOffset(triggerCenterX - clampedLeft);
    });
  }, [isVisible, position]);

  const box = variantStyles[variant];

  const getTooltipStyle = (): React.CSSProperties => ({
    position: 'fixed',
    // While `coords` is null the box is opacity-0 (see render), so the origin
    // 0,0 here is never a visible frame — by the time opacity flips to 1 these
    // are the real measured coordinates.
    left: `${coords?.left ?? 0}px`,
    top: `${coords?.top ?? 0}px`,
    width: `${BOX_WIDTH}px`,
    background: box.box,
    color: '#FFFFFF',
    borderRadius: box.radius,
    padding: '12px 14px',
    boxShadow: box.shadow,
    fontSize: '11.5px',
    fontWeight: 400,
    lineHeight: box.lineHeight,
    // Reset the global inherited -0.018em so popover text is not spaced.
    letterSpacing: 0,
    textTransform: 'none',
    whiteSpace: 'normal',
  });

  // v15 arrow = a 10×10 square rotated 45deg in the box color (not a CSS border
  // triangle). Sits at the box edge facing the trigger, horizontally aligned to
  // the trigger center even when the box is clamped to the viewport.
  const getArrowStyle = (): React.CSSProperties => ({
    width: '10px',
    height: '10px',
    background: box.box,
    transform: 'rotate(45deg)',
    left: `${arrowOffset - 5}px`,
    ...(actualPosition === 'top'
      ? { top: 'calc(100% - 5px)' }
      : { top: '-5px' }),
  });

  return (
    <div
      ref={containerRef}
      className={cn('relative inline-flex', triggerClassName)}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      {isVisible &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tooltipRef}
            style={getTooltipStyle()}
            // Mounted invisibly while coords are being measured, then fades in at
            // its final fixed position. Opacity-only transition — no translate or
            // zoom — so it simply appears in place rather than sliding from 0,0.
            className={cn(
              'z-[9999] transition-opacity duration-150',
              coords ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
          >
            {content}
            <div style={getArrowStyle()} className="absolute" />
          </div>,
          document.body
        )}
    </div>
  );
};

// 정보 아이콘과 함께 사용하는 Tooltip
interface InfoTooltipProps {
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  size?: TooltipSize;
  variant?: TooltipVariant;
}

export const InfoTooltip = ({ content, position = 'top', size = 'lg', variant = 'status' }: InfoTooltipProps) => {
  return (
    <Tooltip content={content} position={position} size={size} variant={variant}>
      {/* tabIndex makes the trigger keyboard-focusable so the :focus reveal path
          (onFocus on the container) fires for non-pointer users. */}
      <button
        type="button"
        tabIndex={0}
        className={cn('inline-flex items-center justify-center text-[#9CA3AF] transition-colors', primaryColors.textHoverBase)}
      >
        <svg
          width={13}
          height={13}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
          />
        </svg>
      </button>
    </Tooltip>
  );
};
