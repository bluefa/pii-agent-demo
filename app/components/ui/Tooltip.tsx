'use client';

import { useState, useRef, useEffect } from 'react';
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
  const [actualPosition, setActualPosition] = useState(position);
  const [horizontalOffset, setHorizontalOffset] = useState(0);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // `size` is retained for backward-compat with existing callers, but v15 fixes
  // the popover at 280px so the width no longer varies. Keep referencing it to
  // preserve the prop's place in the public API.
  void size;

  useEffect(() => {
    if (isVisible && tooltipRef.current && containerRef.current) {
      const tooltip = tooltipRef.current.getBoundingClientRect();
      const container = containerRef.current.getBoundingClientRect();
      const padding = 16; // 화면 가장자리 여백

      queueMicrotask(() => {
        // 상하 위치 조정
        if (position === 'top' && container.top - tooltip.height < padding) {
          setActualPosition('bottom');
        } else if (position === 'bottom' && container.bottom + tooltip.height > window.innerHeight - padding) {
          setActualPosition('top');
        } else {
          setActualPosition(position);
        }

        // 좌우 잘림 방지 (top/bottom 포지션일 때)
        if (position === 'top' || position === 'bottom') {
          const tooltipLeft = container.left + container.width / 2 - tooltip.width / 2;
          const tooltipRight = tooltipLeft + tooltip.width;

          if (tooltipLeft < padding) {
            // 왼쪽으로 잘림 → 오른쪽으로 이동
            setHorizontalOffset(padding - tooltipLeft);
          } else if (tooltipRight > window.innerWidth - padding) {
            // 오른쪽으로 잘림 → 왼쪽으로 이동
            setHorizontalOffset(window.innerWidth - padding - tooltipRight);
          } else {
            setHorizontalOffset(0);
          }
        }
      });
    }
  }, [isVisible, position]);

  const getPositionClasses = () => {
    const base = {
      top: 'bottom-full mb-2',
      bottom: 'top-full mt-2',
      left: 'right-full top-1/2 -translate-y-1/2 mr-2',
      right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };
    return base[actualPosition];
  };

  const box = variantStyles[variant];

  const getTooltipStyle = (): React.CSSProperties => {
    const common: React.CSSProperties = {
      width: '280px',
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
    };
    if (actualPosition === 'top' || actualPosition === 'bottom') {
      return {
        ...common,
        left: '50%',
        transform: `translateX(calc(-50% + ${horizontalOffset}px))`,
      };
    }
    return common;
  };

  // v15 arrow = a 10×10 square rotated 45deg in the box color (not a CSS border
  // triangle). Sits at the edge of the box facing the trigger.
  const getArrowStyle = (): React.CSSProperties => {
    const common: React.CSSProperties = {
      width: '10px',
      height: '10px',
      background: box.box,
      transform: 'rotate(45deg)',
    };
    const edge: Record<typeof actualPosition, React.CSSProperties> = {
      top: { top: 'calc(100% - 5px)', left: 'calc(50% - 5px)' },
      bottom: { top: '-5px', left: 'calc(50% - 5px)' },
      left: { left: 'calc(100% - 5px)', top: 'calc(50% - 5px)' },
      right: { left: '-5px', top: 'calc(50% - 5px)' },
    };
    return { ...common, ...edge[actualPosition] };
  };

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
      {isVisible && (
        <div
          ref={tooltipRef}
          style={getTooltipStyle()}
          className={cn('absolute z-50', 'animate-in fade-in-0 zoom-in-95 duration-200', getPositionClasses())}
        >
          {content}
          <div style={getArrowStyle()} className="absolute" />
        </div>
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
